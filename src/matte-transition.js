(() => {
  'use strict';

  const STATES = Object.freeze({
    LOADING: 'LOADING',
    IDLE: 'IDLE',
    PRELUDE: 'PRELUDE',
    REWINDING: 'REWINDING',
    PLAYING: 'PLAYING',
    FALLBACK: 'FALLBACK',
    DONE: 'DONE',
  });

  const clamp01 = (value) => Math.max(0, Math.min(1, value));
  const smoothStep = (value) => {
    const progress = clamp01(value);
    return progress * progress * (3 - 2 * progress);
  };

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(src);
      image.onerror = () => reject(new Error(`Failed to load matte asset: ${src}`));
      image.src = src;
    });
  }

  function createMattePlayer(root) {
    const fullStage = root?.querySelector('[data-ink-stage]');
    const preludeStage = root?.querySelector('[data-ink-prelude-stage]');

    const fps = Number(root?.dataset.fps ?? 30);
    const frameCount = Number(root?.dataset.frameCount ?? 57);
    const continuationStartFrame = Number(root?.dataset.continuationStartFrame ?? 7);
    const nearBlackIndex = Number(root?.dataset.nearBlackIndex ?? 42);
    const framesPerAtlas = Number(root?.dataset.framesPerAtlas ?? 15);
    const atlasColumns = Number(root?.dataset.atlasColumns ?? 5);
    const atlasRows = Number(root?.dataset.atlasRows ?? 3);
    const atlasBase = String(root?.dataset.atlasBase ?? '');
    const atlasCount = Number(root?.dataset.atlasCount ?? 0);
    const atlasPaths = Array.from({ length: atlasCount }, (_, index) => `${atlasBase}${index + 1}.png`);

    const preludeFrameCount = Number(root?.dataset.preludeFrameCount ?? 60);
    const preludeColumns = Number(root?.dataset.preludeColumns ?? 10);
    const preludeRows = Number(root?.dataset.preludeRows ?? 6);
    const preludeCropRatio = Number(root?.dataset.preludeCropRatio ?? (256 / 900));
    const preludeSrc = String(root?.dataset.preludeSrc ?? '');

    let preloadPromise = null;
    let currentPreludeFrame = 0;
    let currentFullFrame = 0;

    if (preludeStage) {
      const size = `${preludeCropRatio * 100}%`;
      preludeStage.style.width = size;
      preludeStage.style.height = size;
    }

    function showPrelude(frameIndex) {
      if (!preludeStage || !preludeSrc) return;
      const safeIndex = Math.max(0, Math.min(preludeFrameCount - 1, Math.round(frameIndex)));
      const col = safeIndex % preludeColumns;
      const row = Math.floor(safeIndex / preludeColumns);
      const x = preludeColumns > 1 ? (col / (preludeColumns - 1)) * 100 : 0;
      const y = preludeRows > 1 ? (row / (preludeRows - 1)) * 100 : 0;

      if (fullStage) fullStage.style.visibility = 'hidden';
      preludeStage.style.visibility = 'visible';
      preludeStage.style.backgroundImage = `url('${preludeSrc}')`;
      preludeStage.style.backgroundSize = `${preludeColumns * 100}% ${preludeRows * 100}%`;
      preludeStage.style.backgroundPosition = `${x}% ${y}%`;
      preludeStage.dataset.frame = String(safeIndex + 1);
      currentPreludeFrame = safeIndex;
    }

    function showFull(frameIndex) {
      if (!fullStage || !atlasPaths.length) return;
      const safeIndex = Math.max(0, Math.min(frameCount - 1, Math.round(frameIndex)));
      const atlasIndex = Math.min(Math.floor(safeIndex / framesPerAtlas), atlasPaths.length - 1);
      const atlasFrameIndex = safeIndex - atlasIndex * framesPerAtlas;
      const col = atlasFrameIndex % atlasColumns;
      const row = Math.floor(atlasFrameIndex / atlasColumns);
      const x = atlasColumns > 1 ? (col / (atlasColumns - 1)) * 100 : 0;
      const y = atlasRows > 1 ? (row / (atlasRows - 1)) * 100 : 0;

      if (preludeStage) preludeStage.style.visibility = 'hidden';
      fullStage.style.visibility = 'visible';
      fullStage.style.backgroundImage = `url('${atlasPaths[atlasIndex]}')`;
      fullStage.style.backgroundSize = `${atlasColumns * 100}% ${atlasRows * 100}%`;
      fullStage.style.backgroundPosition = `${x}% ${y}%`;
      fullStage.dataset.frame = String(safeIndex + 1);
      currentFullFrame = safeIndex;
    }

    function preload() {
      if (preloadPromise) return preloadPromise;
      const paths = [preludeSrc, ...atlasPaths].filter(Boolean);
      preloadPromise = Promise.all(paths.map(loadImage));
      return preloadPromise;
    }

    function reset() {
      currentPreludeFrame = 0;
      currentFullFrame = 0;
      if (preludeStage) {
        preludeStage.style.visibility = 'hidden';
        preludeStage.dataset.frame = '1';
      }
      if (fullStage) fullStage.style.visibility = 'hidden';
    }

    return {
      fps,
      frameCount,
      continuationStartFrame,
      nearBlackIndex,
      preludeFrameCount,
      preload,
      showPrelude,
      showFull,
      reset,
      getCurrentPreludeFrame: () => currentPreludeFrame,
      getCurrentFullFrame: () => currentFullFrame,
    };
  }

  function createMatteTransition(options) {
    const {
      spriteRoot,
      fallback,
      reducedMotion = false,
      fallbackMs = 920,
      rewindMaxMs = 320,
      onNearBlack = () => {},
      onDone = () => {},
      onPreludeIdle = () => {},
    } = options;

    if (!spriteRoot) throw new Error('MatteTransition requires a spriteRoot element.');

    const sourceLeft = spriteRoot.querySelector('[data-ink-source-left]');
    const sourceRight = spriteRoot.querySelector('[data-ink-source-right]');
    const mergeLayer = spriteRoot.querySelector('[data-ink-merge-layer]');
    if (!sourceLeft || !sourceRight || !mergeLayer) {
      throw new Error('MatteTransition requires two source layers and a merge layer.');
    }

    const player = createMattePlayer(spriteRoot);
    const mergeStartProgress = clamp01(Number(spriteRoot.dataset.mergeStartProgress ?? 0.42));
    const sourceAbsorbStart = Math.max(mergeStartProgress, clamp01(Number(spriteRoot.dataset.sourceAbsorbStart ?? 0.82)));

    let state = STATES.LOADING;
    let rafHandle = 0;
    let fallbackNearTimer = 0;
    let fallbackDoneTimer = 0;
    let nearBlackFired = false;
    let runId = 0;
    let preludeProgress = 0;
    let assetsReady = false;
    let loadSettled = false;
    let sourceGeometry = null;
    let mergeOrigin = null;

    const readyPromise = player.preload()
      .then(() => {
        assetsReady = true;
        loadSettled = true;
        if (state === STATES.LOADING) state = STATES.IDLE;
        return true;
      })
      .catch(() => {
        assetsReady = false;
        loadSettled = true;
        if (state === STATES.LOADING) state = STATES.IDLE;
        return false;
      });

    function farthestCornerDistance(origin) {
      const corners = [
        [0, 0],
        [window.innerWidth, 0],
        [0, window.innerHeight],
        [window.innerWidth, window.innerHeight],
      ];
      return Math.max(...corners.map(([x, y]) => Math.hypot(x - origin.x, y - origin.y)));
    }

    function getMergeOrigin() {
      return {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      };
    }

    function positionMergeLayer(origin, overscan = 1.08) {
      const size = Math.ceil(farthestCornerDistance(origin) * 2 * overscan);
      mergeLayer.style.left = `${origin.x}px`;
      mergeLayer.style.top = `${origin.y}px`;
      mergeLayer.style.width = `${size}px`;
      mergeLayer.style.height = `${size}px`;
    }

    function measureSourceGeometry() {
      const leftRect = sourceLeft.getBoundingClientRect();
      const rightRect = sourceRight.getBoundingClientRect();
      sourceGeometry = {
        left: {
          x: leftRect.left + leftRect.width / 2,
          y: leftRect.top + leftRect.height / 2,
        },
        right: {
          x: rightRect.left + rightRect.width / 2,
          y: rightRect.top + rightRect.height / 2,
        },
      };
    }

    function resetSourceVisuals() {
      [sourceLeft, sourceRight].forEach((source) => {
        source.style.removeProperty('transform');
        source.style.removeProperty('visibility');
      });
    }

    function resetMergeVisual() {
      mergeLayer.style.visibility = 'hidden';
      mergeLayer.style.width = '1px';
      mergeLayer.style.height = '1px';
      player.reset();
    }

    function renderSources(progress) {
      if (!sourceGeometry || !mergeOrigin) return;

      const move = smoothStep(progress);
      const grow = 1 + 0.24 * smoothStep(progress / Math.max(sourceAbsorbStart, 0.001));
      const absorb = assetsReady
        ? smoothStep((progress - sourceAbsorbStart) / Math.max(1 - sourceAbsorbStart, 0.001))
        : 0;
      const scale = grow * (1 - 0.5 * absorb);
      const curve = Math.min(window.innerWidth * 0.055, 26) * Math.sin(Math.PI * move);

      const renderSource = (source, start, direction) => {
        const dx = (mergeOrigin.x - start.x) * move + curve * direction;
        const dy = (mergeOrigin.y - start.y) * move;
        source.style.transform = `translate3d(${dx.toFixed(2)}px,${dy.toFixed(2)}px,0) scale(${scale.toFixed(4)})`;
        source.style.visibility = assetsReady && progress >= 0.995 ? 'hidden' : 'visible';
      };

      renderSource(sourceLeft, sourceGeometry.left, 1);
      renderSource(sourceRight, sourceGeometry.right, -1);
    }

    function renderMerge(progress) {
      if (!assetsReady) {
        mergeLayer.style.visibility = 'hidden';
        return;
      }

      const local = clamp01((progress - mergeStartProgress) / Math.max(1 - mergeStartProgress, 0.001));
      if (local <= 0) {
        mergeLayer.style.visibility = 'hidden';
        return;
      }

      mergeLayer.style.visibility = 'visible';
      const frame = Math.round((player.preludeFrameCount - 1) * smoothStep(local));
      player.showPrelude(frame);
    }

    function renderPrelude(progress) {
      preludeProgress = clamp01(progress);
      if (reducedMotion) return;
      renderSources(preludeProgress);
      renderMerge(preludeProgress);
    }

    function fireNearBlack() {
      if (nearBlackFired) return;
      nearBlackFired = true;
      onNearBlack();
    }

    function cancelPlayback() {
      cancelAnimationFrame(rafHandle);
      rafHandle = 0;
    }

    function clearFallbackTimers() {
      window.clearTimeout(fallbackNearTimer);
      window.clearTimeout(fallbackDoneTimer);
      fallbackNearTimer = 0;
      fallbackDoneTimer = 0;
    }

    function hideMatte() {
      spriteRoot.classList.remove('is-active');
    }

    function resetFallbackVisual() {
      if (!fallback) return;
      fallback.classList.remove('is-active');
      fallback.style.removeProperty('--matte-fallback-ms');
    }

    function returnToIdle() {
      hideMatte();
      resetSourceVisuals();
      resetMergeVisual();
      resetFallbackVisual();
      preludeProgress = 0;
      sourceGeometry = null;
      mergeOrigin = null;
      state = loadSettled ? STATES.IDLE : STATES.LOADING;
      onPreludeIdle();
    }

    function beginPrelude() {
      if (reducedMotion && (state === STATES.LOADING || state === STATES.IDLE)) {
        runId += 1;
        nearBlackFired = false;
        preludeProgress = 0;
        state = STATES.PRELUDE;
        return true;
      }

      if (!loadSettled || state !== STATES.IDLE) return false;

      runId += 1;
      cancelPlayback();
      clearFallbackTimers();
      nearBlackFired = false;
      preludeProgress = 0;
      state = STATES.PRELUDE;

      resetSourceVisuals();
      player.reset();
      mergeOrigin = getMergeOrigin();
      positionMergeLayer(mergeOrigin);
      spriteRoot.classList.add('is-active');
      measureSourceGeometry();
      renderPrelude(0);
      return true;
    }

    function setPreludeProgress(value) {
      if (state !== STATES.PRELUDE) return;
      renderPrelude(value);
    }

    function cancelPrelude() {
      if (state !== STATES.PRELUDE) return;

      runId += 1;
      const activeRunId = runId;
      const startProgress = preludeProgress;

      if (reducedMotion || startProgress <= 0.001) {
        returnToIdle();
        return;
      }

      state = STATES.REWINDING;
      const duration = Math.max(110, Math.round(rewindMaxMs * startProgress));
      const startedAt = performance.now();

      const tick = (now) => {
        if (activeRunId !== runId || state !== STATES.REWINDING) return;
        const elapsed = Math.max(0, now - startedAt);
        const linear = Math.min(1, elapsed / duration);
        const eased = 1 - Math.pow(1 - linear, 3);
        renderPrelude(startProgress * (1 - eased));

        if (linear < 1) {
          rafHandle = requestAnimationFrame(tick);
          return;
        }

        rafHandle = 0;
        returnToIdle();
      };

      rafHandle = requestAnimationFrame(tick);
    }

    function finish(activeRunId) {
      if (activeRunId !== runId || state !== STATES.PLAYING) return;
      fireNearBlack();
      cancelPlayback();
      hideMatte();
      state = STATES.DONE;
      sourceGeometry = null;
      mergeOrigin = null;
      onDone();
    }

    function startFallback(activeRunId) {
      cancelPlayback();
      clearFallbackTimers();
      mergeLayer.style.visibility = 'hidden';
      state = STATES.FALLBACK;

      if (!fallback) {
        fireNearBlack();
        hideMatte();
        state = STATES.DONE;
        sourceGeometry = null;
        mergeOrigin = null;
        onDone();
        return;
      }

      fallback.style.setProperty('--matte-fallback-ms', `${fallbackMs}ms`);
      fallback.classList.remove('is-active');
      void fallback.offsetWidth;
      fallback.classList.add('is-active');

      fallbackNearTimer = window.setTimeout(() => {
        if (activeRunId !== runId || state !== STATES.FALLBACK) return;
        fireNearBlack();
      }, Math.round(fallbackMs * 0.76));

      fallbackDoneTimer = window.setTimeout(() => {
        if (activeRunId !== runId || state !== STATES.FALLBACK) return;
        fireNearBlack();
        hideMatte();
        resetFallbackVisual();
        state = STATES.DONE;
        sourceGeometry = null;
        mergeOrigin = null;
        onDone();
      }, fallbackMs);
    }

    function commit() {
      if (state !== STATES.PRELUDE) return false;

      runId += 1;
      const activeRunId = runId;
      nearBlackFired = false;
      renderPrelude(1);

      if (reducedMotion) {
        state = STATES.DONE;
        fireNearBlack();
        hideMatte();
        sourceGeometry = null;
        mergeOrigin = null;
        onDone();
        return true;
      }

      if (!assetsReady) {
        startFallback(activeRunId);
        return true;
      }

      state = STATES.PLAYING;
      sourceLeft.style.visibility = 'hidden';
      sourceRight.style.visibility = 'hidden';
      mergeLayer.style.visibility = 'visible';
      spriteRoot.classList.add('is-active');

      const startFrame = Math.max(0, Math.min(player.frameCount - 1, player.continuationStartFrame));
      const remainingFrames = Math.max(1, player.frameCount - startFrame);
      const durationMs = (remainingFrames / player.fps) * 1000;
      const startedAt = performance.now();
      player.showFull(startFrame);

      const tick = (now) => {
        if (activeRunId !== runId || state !== STATES.PLAYING) return;

        const elapsed = Math.max(0, now - startedAt);
        const offset = Math.min(remainingFrames - 1, Math.floor((elapsed / 1000) * player.fps));
        const frame = startFrame + offset;
        player.showFull(frame);

        if (frame >= player.nearBlackIndex) fireNearBlack();

        if (elapsed < durationMs) {
          rafHandle = requestAnimationFrame(tick);
          return;
        }

        finish(activeRunId);
      };

      rafHandle = requestAnimationFrame(tick);
      return true;
    }

    function reset() {
      runId += 1;
      cancelPlayback();
      clearFallbackTimers();
      nearBlackFired = false;
      sourceGeometry = null;
      mergeOrigin = null;
      preludeProgress = 0;
      hideMatte();
      resetSourceVisuals();
      resetMergeVisual();
      resetFallbackVisual();
      state = loadSettled ? STATES.IDLE : STATES.LOADING;
      onPreludeIdle();
    }

    resetSourceVisuals();
    resetMergeVisual();

    return {
      ready: () => readyPromise,
      isReady: () => loadSettled,
      hasAssets: () => assetsReady,
      beginPrelude,
      setPreludeProgress,
      cancelPrelude,
      commit,
      reset,
      getState: () => state,
      states: STATES,
    };
  }

  window.createMatteTransition = createMatteTransition;
})();

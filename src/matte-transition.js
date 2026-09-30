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
      showPrelude(0);
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
      rewindMaxMs = 300,
      onNearBlack = () => {},
      onDone = () => {},
    } = options;

    if (!spriteRoot) throw new Error('MatteTransition requires a spriteRoot element.');

    const player = createMattePlayer(spriteRoot);
    let state = STATES.LOADING;
    let rafHandle = 0;
    let fallbackNearTimer = 0;
    let fallbackDoneTimer = 0;
    let nearBlackFired = false;
    let runId = 0;
    let activeOrigin = null;
    let preludeProgress = 0;
    let assetsReady = false;
    let loadSettled = false;

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

    function positionLayer(layer, origin, overscan = 1.08) {
      if (!layer || !origin) return;
      const size = Math.ceil(farthestCornerDistance(origin) * 2 * overscan);
      layer.style.left = `${origin.x}px`;
      layer.style.top = `${origin.y}px`;
      layer.style.width = `${size}px`;
      layer.style.height = `${size}px`;
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
      fallback.classList.remove('is-active', 'is-prelude-active');
      fallback.style.removeProperty('--matte-fallback-start-scale');
      fallback.style.removeProperty('--matte-fallback-prelude-scale');
    }

    function beginPrelude(origin) {
      if (reducedMotion && (state === STATES.LOADING || state === STATES.IDLE)) {
        runId += 1;
        nearBlackFired = false;
        activeOrigin = origin;
        preludeProgress = 0;
        state = STATES.PRELUDE;
        return true;
      }

      if (!loadSettled || state !== STATES.IDLE) return false;

      runId += 1;
      cancelPlayback();
      clearFallbackTimers();
      nearBlackFired = false;
      activeOrigin = origin;
      preludeProgress = 0;
      state = STATES.PRELUDE;

      if (assetsReady) {
        positionLayer(spriteRoot, origin);
        player.showPrelude(0);
        spriteRoot.classList.add('is-active');
        return true;
      }

      if (fallback) {
        positionLayer(fallback, origin, 1.10);
        fallback.style.setProperty('--matte-fallback-prelude-scale', '.015');
        fallback.classList.add('is-prelude-active');
      }
      return true;
    }

    function setPreludeProgress(value) {
      if (state !== STATES.PRELUDE) return;
      preludeProgress = clamp01(value);

      if (reducedMotion) return;

      if (assetsReady) {
        const lastFrame = Math.max(0, player.preludeFrameCount - 1);
        player.showPrelude(Math.round(lastFrame * preludeProgress));
        return;
      }

      if (fallback) {
        const scale = 0.015 + preludeProgress * 0.065;
        fallback.style.setProperty('--matte-fallback-prelude-scale', scale.toFixed(4));
      }
    }

    function cancelPrelude() {
      if (state !== STATES.PRELUDE) return;

      runId += 1;
      const activeRunId = runId;
      const startProgress = preludeProgress;
      preludeProgress = 0;

      if (reducedMotion || startProgress <= 0.001) {
        hideMatte();
        resetFallbackVisual();
        player.reset();
        state = STATES.IDLE;
        activeOrigin = null;
        return;
      }

      state = STATES.REWINDING;
      const duration = Math.max(100, Math.round(rewindMaxMs * startProgress));
      const startedAt = performance.now();
      const startFrame = assetsReady ? player.getCurrentPreludeFrame() : 0;
      const fallbackStartScale = 0.015 + startProgress * 0.065;

      const tick = (now) => {
        if (activeRunId !== runId || state !== STATES.REWINDING) return;
        const elapsed = Math.max(0, now - startedAt);
        const linear = Math.min(1, elapsed / duration);
        const eased = 1 - Math.pow(1 - linear, 3);
        const remaining = 1 - eased;

        if (assetsReady) {
          player.showPrelude(Math.round(startFrame * remaining));
        } else if (fallback) {
          const scale = 0.015 + (fallbackStartScale - 0.015) * remaining;
          fallback.style.setProperty('--matte-fallback-prelude-scale', scale.toFixed(4));
        }

        if (linear < 1) {
          rafHandle = requestAnimationFrame(tick);
          return;
        }

        hideMatte();
        resetFallbackVisual();
        player.reset();
        state = STATES.IDLE;
        activeOrigin = null;
        rafHandle = 0;
      };

      rafHandle = requestAnimationFrame(tick);
    }

    function finish(activeRunId) {
      if (activeRunId !== runId || state !== STATES.PLAYING) return;
      fireNearBlack();
      cancelPlayback();
      hideMatte();
      state = STATES.DONE;
      activeOrigin = null;
      onDone();
    }

    function startFallback(origin, activeRunId) {
      cancelPlayback();
      clearFallbackTimers();
      hideMatte();
      state = STATES.FALLBACK;
      positionLayer(fallback, origin, 1.10);

      if (!fallback) {
        fireNearBlack();
        state = STATES.DONE;
        activeOrigin = null;
        onDone();
        return;
      }

      const startScale = 0.015 + clamp01(preludeProgress) * 0.065;
      fallback.style.setProperty('--matte-fallback-ms', `${fallbackMs}ms`);
      fallback.style.setProperty('--matte-fallback-start-scale', startScale.toFixed(4));
      fallback.classList.remove('is-prelude-active', 'is-active');
      void fallback.offsetWidth;
      fallback.classList.add('is-active');

      fallbackNearTimer = window.setTimeout(() => {
        if (activeRunId !== runId || state !== STATES.FALLBACK) return;
        fireNearBlack();
      }, Math.round(fallbackMs * 0.76));

      fallbackDoneTimer = window.setTimeout(() => {
        if (activeRunId !== runId || state !== STATES.FALLBACK) return;
        fireNearBlack();
        resetFallbackVisual();
        state = STATES.DONE;
        activeOrigin = null;
        onDone();
      }, fallbackMs);
    }

    function commit(origin = activeOrigin) {
      if (state !== STATES.PRELUDE) return false;

      runId += 1;
      const activeRunId = runId;
      activeOrigin = origin || activeOrigin;
      nearBlackFired = false;
      preludeProgress = 1;

      if (reducedMotion) {
        state = STATES.DONE;
        fireNearBlack();
        activeOrigin = null;
        onDone();
        return true;
      }

      if (!assetsReady) {
        startFallback(activeOrigin, activeRunId);
        return true;
      }

      state = STATES.PLAYING;
      positionLayer(spriteRoot, activeOrigin);
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
      activeOrigin = null;
      preludeProgress = 0;
      hideMatte();
      player.reset();
      resetFallbackVisual();
      state = loadSettled ? STATES.IDLE : STATES.LOADING;
    }

    player.reset();

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

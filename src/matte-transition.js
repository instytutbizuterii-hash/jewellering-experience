(() => {
  'use strict';

  const STATES = Object.freeze({
    LOADING: 'LOADING',
    IDLE: 'IDLE',
    PRELUDE: 'PRELUDE',
    REWINDING: 'REWINDING',
    COMMITTING: 'COMMITTING',
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

  function createDualMattePlayer(root) {
    const leftStage = root?.querySelector('[data-ink-stage-left]');
    const rightStage = root?.querySelector('[data-ink-stage-right]');

    const frameCount = Number(root?.dataset.frameCount ?? 57);
    const framesPerAtlas = Number(root?.dataset.framesPerAtlas ?? 15);
    const atlasColumns = Number(root?.dataset.atlasColumns ?? 5);
    const atlasRows = Number(root?.dataset.atlasRows ?? 3);
    const atlasBase = String(root?.dataset.atlasBase ?? '');
    const atlasCount = Number(root?.dataset.atlasCount ?? 0);
    const atlasPaths = Array.from({ length: atlasCount }, (_, index) => `${atlasBase}${index + 1}.png`);

    let preloadPromise = null;
    let currentFrame = 0;

    function showFrame(frameIndex) {
      if (!leftStage || !rightStage || !atlasPaths.length) return;

      const safeIndex = Math.max(0, Math.min(frameCount - 1, Math.round(frameIndex)));
      const atlasIndex = Math.min(Math.floor(safeIndex / framesPerAtlas), atlasPaths.length - 1);
      const atlasFrameIndex = safeIndex - atlasIndex * framesPerAtlas;
      const col = atlasFrameIndex % atlasColumns;
      const row = Math.floor(atlasFrameIndex / atlasColumns);
      const x = atlasColumns > 1 ? (col / (atlasColumns - 1)) * 100 : 0;
      const y = atlasRows > 1 ? (row / (atlasRows - 1)) * 100 : 0;
      const path = atlasPaths[atlasIndex];

      [leftStage, rightStage].forEach((stage) => {
        stage.style.backgroundImage = `url('${path}')`;
        stage.style.backgroundSize = `${atlasColumns * 100}% ${atlasRows * 100}%`;
        stage.style.backgroundPosition = `${x}% ${y}%`;
        stage.dataset.frame = String(safeIndex + 1);
      });

      currentFrame = safeIndex;
    }

    function preload() {
      if (preloadPromise) return preloadPromise;
      preloadPromise = Promise.all(atlasPaths.map(loadImage));
      return preloadPromise;
    }

    function reset() {
      currentFrame = 0;
      [leftStage, rightStage].forEach((stage) => {
        if (!stage) return;
        stage.dataset.frame = '1';
      });
    }

    return {
      frameCount,
      preload,
      showFrame,
      reset,
      getCurrentFrame: () => currentFrame,
    };
  }

  function createMatteTransition(options) {
    const {
      spriteRoot,
      fallback,
      reducedMotion = false,
      fallbackMs = 920,
      rewindMaxMs = 320,
      commitSettleMs = 120,
      onNearBlack = () => {},
      onDone = () => {},
      onPreludeIdle = () => {},
    } = options;

    if (!spriteRoot) throw new Error('MatteTransition requires a spriteRoot element.');

    const originLeft = spriteRoot.querySelector('[data-ink-origin-left]');
    const originRight = spriteRoot.querySelector('[data-ink-origin-right]');
    const fieldLeft = spriteRoot.querySelector('[data-ink-field-left]');
    const fieldRight = spriteRoot.querySelector('[data-ink-field-right]');

    if (!originLeft || !originRight || !fieldLeft || !fieldRight) {
      throw new Error('MatteTransition requires two fixed origins and two matte fields.');
    }

    const player = createDualMattePlayer(spriteRoot);
    const holdFrameGamma = Math.max(1, Number(spriteRoot.dataset.holdFrameGamma ?? 2.6));
    const overscan = Math.max(1, Number(spriteRoot.dataset.fieldOverscan ?? 1.08));

    let state = STATES.LOADING;
    let rafHandle = 0;
    let fallbackNearTimer = 0;
    let fallbackDoneTimer = 0;
    let settleTimer = 0;
    let runId = 0;
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

    function rectCenter(element) {
      const rect = element.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }

    function positionField(field, origin) {
      const size = Math.ceil(farthestCornerDistance(origin) * 2 * overscan);
      field.style.left = `${origin.x}px`;
      field.style.top = `${origin.y}px`;
      field.style.width = `${size}px`;
      field.style.height = `${size}px`;
    }

    function positionFields() {
      positionField(fieldLeft, rectCenter(originLeft));
      positionField(fieldRight, rectCenter(originRight));
    }

    function cancelPlayback() {
      cancelAnimationFrame(rafHandle);
      rafHandle = 0;
      window.clearTimeout(settleTimer);
      settleTimer = 0;
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

    function frameForProgress(progress) {
      const curved = Math.pow(clamp01(progress), holdFrameGamma);
      return Math.round((player.frameCount - 1) * curved);
    }

    function renderPrelude(progress) {
      preludeProgress = clamp01(progress);
      if (reducedMotion || !assetsReady) return;
      player.showFrame(frameForProgress(preludeProgress));
    }

    function returnToIdle() {
      hideMatte();
      resetFallbackVisual();
      player.reset();
      preludeProgress = 0;
      state = loadSettled ? STATES.IDLE : STATES.LOADING;
      onPreludeIdle();
    }

    function beginPrelude() {
      if (reducedMotion && (state === STATES.LOADING || state === STATES.IDLE)) {
        runId += 1;
        preludeProgress = 0;
        state = STATES.PRELUDE;
        return true;
      }

      if (!loadSettled || state !== STATES.IDLE) return false;

      runId += 1;
      cancelPlayback();
      clearFallbackTimers();
      preludeProgress = 0;
      state = STATES.PRELUDE;

      player.reset();
      positionFields();
      spriteRoot.classList.add('is-active');
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

    function finishCommit(activeRunId) {
      if (activeRunId !== runId || state !== STATES.COMMITTING) return;
      onNearBlack();
      settleTimer = window.setTimeout(() => {
        if (activeRunId !== runId || state !== STATES.COMMITTING) return;
        hideMatte();
        state = STATES.DONE;
        onDone();
      }, reducedMotion ? 0 : commitSettleMs);
    }

    function startFallback(activeRunId) {
      cancelPlayback();
      clearFallbackTimers();
      state = STATES.FALLBACK;

      if (!fallback) {
        onNearBlack();
        hideMatte();
        state = STATES.DONE;
        onDone();
        return;
      }

      fallback.style.setProperty('--matte-fallback-ms', `${fallbackMs}ms`);
      fallback.classList.remove('is-active');
      void fallback.offsetWidth;
      fallback.classList.add('is-active');

      fallbackNearTimer = window.setTimeout(() => {
        if (activeRunId !== runId || state !== STATES.FALLBACK) return;
        onNearBlack();
      }, Math.round(fallbackMs * 0.76));

      fallbackDoneTimer = window.setTimeout(() => {
        if (activeRunId !== runId || state !== STATES.FALLBACK) return;
        hideMatte();
        resetFallbackVisual();
        state = STATES.DONE;
        onDone();
      }, fallbackMs);
    }

    function commit() {
      if (state !== STATES.PRELUDE) return false;

      runId += 1;
      const activeRunId = runId;
      renderPrelude(1);

      if (reducedMotion) {
        state = STATES.COMMITTING;
        if (fallback) {
          fallback.style.setProperty('--matte-fallback-ms', '0ms');
          fallback.classList.add('is-active');
        }
        finishCommit(activeRunId);
        return true;
      }

      if (!assetsReady) {
        startFallback(activeRunId);
        return true;
      }

      state = STATES.COMMITTING;
      spriteRoot.classList.add('is-active');
      player.showFrame(player.frameCount - 1);
      finishCommit(activeRunId);
      return true;
    }

    function reset() {
      runId += 1;
      cancelPlayback();
      clearFallbackTimers();
      preludeProgress = 0;
      hideMatte();
      player.reset();
      resetFallbackVisual();
      state = loadSettled ? STATES.IDLE : STATES.LOADING;
      onPreludeIdle();
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

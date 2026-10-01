(() => {
  'use strict';

  const STATES = Object.freeze({
    LOADING: 'LOADING',
    IDLE: 'IDLE',
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
      onNearBlack = () => {},
      onDone = () => {},
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
    const playbackMs = Math.max(1, Number(spriteRoot.dataset.playbackMs ?? 2000));
    const frameGamma = Math.max(1, Number(spriteRoot.dataset.frameGamma ?? 3.2));
    const leadInMs = Math.max(0, Number(spriteRoot.dataset.leadInMs ?? 120));
    const leadInTargetFrame = Math.max(
      0,
      Math.min(player.frameCount - 1, Number(spriteRoot.dataset.leadInTargetFrame ?? 4) - 1),
    );
    const nearBlackFrame = Math.max(1, Math.min(player.frameCount, Number(spriteRoot.dataset.nearBlackFrame ?? 43))) - 1;
    const overscan = Math.max(1, Number(spriteRoot.dataset.fieldOverscan ?? 1.08));

    let state = STATES.LOADING;
    let rafHandle = 0;
    let fallbackNearTimer = 0;
    let fallbackDoneTimer = 0;
    let runId = 0;
    let assetsReady = false;
    let loadSettled = false;
    let nearBlackSent = false;

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

    function frameForProgress(progress) {
      const curved = Math.pow(clamp01(progress), frameGamma);
      return Math.round((player.frameCount - 1) * curved);
    }

    function originalFrameOnsetMs(frameIndex) {
      if (frameIndex <= 0) return 0;
      const denominator = Math.max(1, player.frameCount - 1);
      const roundedThreshold = Math.max(0, (frameIndex - 0.5) / denominator);
      return playbackMs * Math.pow(roundedThreshold, 1 / frameGamma);
    }

    const originalLeadInTargetMs = originalFrameOnsetMs(leadInTargetFrame);
    const effectivePlaybackMs = leadInMs + Math.max(0, playbackMs - originalLeadInTargetMs);

    function frameForElapsed(elapsedMs) {
      const safeElapsed = Math.max(0, elapsedMs);

      if (leadInMs > 0 && safeElapsed < leadInMs && leadInTargetFrame > 0) {
        const leadProgress = clamp01(safeElapsed / leadInMs);
        return Math.round(leadInTargetFrame * leadProgress);
      }

      const virtualElapsed = originalLeadInTargetMs + Math.max(0, safeElapsed - leadInMs);
      return frameForProgress(virtualElapsed / playbackMs);
    }

    function maybeSignalNearBlack(frameIndex) {
      if (nearBlackSent || frameIndex < nearBlackFrame) return;
      nearBlackSent = true;
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

    function finishPlayback(activeRunId) {
      if (activeRunId !== runId || state !== STATES.PLAYING) return;
      const finalFrame = player.frameCount - 1;
      player.showFrame(finalFrame);
      maybeSignalNearBlack(finalFrame);
      hideMatte();
      state = STATES.DONE;
      onDone();
    }

    function startFallback(activeRunId, duration = fallbackMs) {
      cancelPlayback();
      clearFallbackTimers();
      state = STATES.FALLBACK;

      if (!fallback) {
        nearBlackSent = true;
        onNearBlack();
        state = STATES.DONE;
        onDone();
        return true;
      }

      fallback.style.setProperty('--matte-fallback-ms', `${duration}ms`);
      fallback.classList.remove('is-active');
      void fallback.offsetWidth;
      fallback.classList.add('is-active');

      const finish = () => {
        if (activeRunId !== runId || state !== STATES.FALLBACK) return;
        if (!nearBlackSent) {
          nearBlackSent = true;
          onNearBlack();
        }
        resetFallbackVisual();
        state = STATES.DONE;
        onDone();
      };

      if (duration <= 0) {
        finish();
        return true;
      }

      fallbackNearTimer = window.setTimeout(() => {
        if (activeRunId !== runId || state !== STATES.FALLBACK || nearBlackSent) return;
        nearBlackSent = true;
        onNearBlack();
      }, Math.round(duration * 0.76));

      fallbackDoneTimer = window.setTimeout(finish, duration);
      return true;
    }

    function play() {
      const canPlay = state === STATES.IDLE || (reducedMotion && state === STATES.LOADING);
      if (!canPlay) return false;

      runId += 1;
      const activeRunId = runId;
      cancelPlayback();
      clearFallbackTimers();
      resetFallbackVisual();
      nearBlackSent = false;

      if (reducedMotion) {
        return startFallback(activeRunId, 0);
      }

      if (!loadSettled || !assetsReady) {
        return startFallback(activeRunId, fallbackMs);
      }

      state = STATES.PLAYING;
      player.reset();
      positionFields();
      spriteRoot.classList.add('is-active');
      player.showFrame(0);

      const startedAt = performance.now();

      const tick = (now) => {
        if (activeRunId !== runId || state !== STATES.PLAYING) return;

        const elapsed = Math.max(0, now - startedAt);
        const frame = frameForElapsed(elapsed);
        player.showFrame(frame);
        maybeSignalNearBlack(frame);

        if (elapsed < effectivePlaybackMs) {
          rafHandle = requestAnimationFrame(tick);
          return;
        }

        rafHandle = 0;
        finishPlayback(activeRunId);
      };

      rafHandle = requestAnimationFrame(tick);
      return true;
    }

    function reset() {
      runId += 1;
      cancelPlayback();
      clearFallbackTimers();
      nearBlackSent = false;
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
      play,
      reset,
      getState: () => state,
      states: STATES,
    };
  }

  window.createMatteTransition = createMatteTransition;
})();

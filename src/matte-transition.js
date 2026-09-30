(() => {
  'use strict';

  const STATES = Object.freeze({
    IDLE: 'IDLE',
    PLAYING: 'PLAYING',
    FALLBACK: 'FALLBACK',
    DONE: 'DONE',
  });

  function createSpritePlayer(root) {
    const stage = root?.querySelector('[data-ink-stage]');
    const fps = Number(root?.dataset.fps ?? 30);
    const frameCount = Number(root?.dataset.frameCount ?? 57);
    const framesPerAtlas = Number(root?.dataset.framesPerAtlas ?? 15);
    const atlasColumns = Number(root?.dataset.atlasColumns ?? 5);
    const atlasRows = Number(root?.dataset.atlasRows ?? 3);
    const atlasBase = String(root?.dataset.atlasBase ?? '');
    const atlasCount = Number(root?.dataset.atlasCount ?? 0);
    const atlasPaths = Array.from({ length: atlasCount }, (_, index) => `${atlasBase}${index + 1}.png`);
    let loadPromise = null;

    function showFrame(frameIndex) {
      if (!stage || !atlasPaths.length) return;
      const safeIndex = Math.max(0, Math.min(frameCount - 1, frameIndex));
      const atlasIndex = Math.min(Math.floor(safeIndex / framesPerAtlas), atlasPaths.length - 1);
      const atlasFrameIndex = safeIndex - atlasIndex * framesPerAtlas;
      const col = atlasFrameIndex % atlasColumns;
      const row = Math.floor(atlasFrameIndex / atlasColumns);
      const x = atlasColumns > 1 ? (col / (atlasColumns - 1)) * 100 : 0;
      const y = atlasRows > 1 ? (row / (atlasRows - 1)) * 100 : 0;

      stage.style.backgroundImage = `url('${atlasPaths[atlasIndex]}')`;
      stage.style.backgroundSize = `${atlasColumns * 100}% ${atlasRows * 100}%`;
      stage.style.backgroundPosition = `${x}% ${y}%`;
      stage.dataset.frame = String(safeIndex + 1);
    }

    function preload() {
      if (loadPromise) return loadPromise;
      loadPromise = Promise.all(
        atlasPaths.map((src) => new Promise((resolve, reject) => {
          const image = new Image();
          image.decoding = 'async';
          image.onload = () => resolve(src);
          image.onerror = () => reject(new Error(`Failed to load atlas: ${src}`));
          image.src = src;
        })),
      );
      return loadPromise;
    }

    return {
      fps,
      frameCount,
      preload,
      reset() {
        showFrame(0);
      },
      showFrame,
    };
  }

  function createMatteTransition(options) {
    const {
      spriteRoot,
      fallback,
      reducedMotion = false,
      nearBlackAt = 1.36,
      fallbackMs = 920,
      onNearBlack = () => {},
      onDone = () => {},
    } = options;

    if (!spriteRoot) throw new Error('MatteTransition requires a spriteRoot element.');

    const spritePlayer = createSpritePlayer(spriteRoot);
    let state = STATES.IDLE;
    let rafHandle = 0;
    let fallbackNearTimer = 0;
    let fallbackDoneTimer = 0;
    let nearBlackFired = false;
    let runId = 0;

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
      if (!layer) return;
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

    function finish(activeRunId) {
      if (activeRunId !== runId || state !== STATES.PLAYING) return;
      fireNearBlack();
      cancelPlayback();
      spriteRoot.classList.remove('is-active');
      state = STATES.DONE;
      onDone();
    }

    function startFallback(origin, activeRunId) {
      cancelPlayback();
      clearFallbackTimers();
      spriteRoot.classList.remove('is-active');
      state = STATES.FALLBACK;
      positionLayer(fallback, origin, 1.10);

      if (!fallback) {
        fireNearBlack();
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
        fireNearBlack();
      }, Math.round(fallbackMs * 0.76));

      fallbackDoneTimer = window.setTimeout(() => {
        if (activeRunId !== runId || state !== STATES.FALLBACK) return;
        fireNearBlack();
        fallback.classList.remove('is-active');
        state = STATES.DONE;
        onDone();
      }, fallbackMs);
    }

    async function start(origin) {
      if (state !== STATES.IDLE) return false;

      runId += 1;
      const activeRunId = runId;
      nearBlackFired = false;

      if (reducedMotion) {
        state = STATES.DONE;
        fireNearBlack();
        onDone();
        return true;
      }

      state = STATES.PLAYING;
      positionLayer(spriteRoot, origin);
      spritePlayer.reset();
      spriteRoot.classList.add('is-active');

      try {
        await spritePlayer.preload();
      } catch (_) {
        if (activeRunId !== runId) return false;
        startFallback(origin, activeRunId);
        return false;
      }

      const durationMs = (spritePlayer.frameCount / spritePlayer.fps) * 1000;
      const startedAt = performance.now();

      const tick = (now) => {
        if (activeRunId !== runId || state !== STATES.PLAYING) return;

        const elapsed = Math.max(0, now - startedAt);
        const frame = Math.min(spritePlayer.frameCount - 1, Math.floor((elapsed / 1000) * spritePlayer.fps));
        const seconds = frame / spritePlayer.fps;
        spritePlayer.showFrame(frame);

        if (seconds >= nearBlackAt) fireNearBlack();

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
      spriteRoot.classList.remove('is-active');
      spritePlayer.reset();
      if (fallback) fallback.classList.remove('is-active');
      state = STATES.IDLE;
    }

    spritePlayer.preload().catch(() => {});
    spritePlayer.reset();

    return {
      start,
      reset,
      getState: () => state,
      states: STATES,
    };
  }

  window.createMatteTransition = createMatteTransition;
})();

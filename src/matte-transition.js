(() => {
  'use strict';

  const STATES = Object.freeze({
    IDLE: 'IDLE',
    PLAYING: 'PLAYING',
    FALLBACK: 'FALLBACK',
    DONE: 'DONE',
  });

  const clamp01 = (value) => Math.max(0, Math.min(1, value));

  function createMatteTransition(options) {
    const {
      video,
      fallback,
      reducedMotion = false,
      nearBlackAt = 1.36,
      fallbackMs = 920,
      onNearBlack = () => {},
      onDone = () => {},
    } = options;

    if (!video) throw new Error('MatteTransition requires a video element.');

    let state = STATES.IDLE;
    let frame = 0;
    let videoFrameHandle = 0;
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

      return Math.max(
        ...corners.map(([x, y]) => Math.hypot(x - origin.x, y - origin.y)),
      );
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

    function cancelMonitoring() {
      cancelAnimationFrame(frame);
      frame = 0;

      if (videoFrameHandle && typeof video.cancelVideoFrameCallback === 'function') {
        try {
          video.cancelVideoFrameCallback(videoFrameHandle);
        } catch (_) {
          // Browser may have already released the callback.
        }
      }
      videoFrameHandle = 0;
    }

    function monitorWithRaf(activeRunId) {
      if (activeRunId !== runId || state !== STATES.PLAYING) return;
      if (video.currentTime >= nearBlackAt) fireNearBlack();
      if (!video.ended) frame = requestAnimationFrame(() => monitorWithRaf(activeRunId));
    }

    function monitorWithVideoFrames(activeRunId) {
      if (activeRunId !== runId || state !== STATES.PLAYING) return;

      const callback = (_, metadata) => {
        if (activeRunId !== runId || state !== STATES.PLAYING) return;
        const mediaTime = Number(metadata?.mediaTime ?? video.currentTime);
        if (mediaTime >= nearBlackAt) fireNearBlack();
        if (!video.ended) videoFrameHandle = video.requestVideoFrameCallback(callback);
      };

      videoFrameHandle = video.requestVideoFrameCallback(callback);
    }

    function startMonitoring(activeRunId) {
      cancelMonitoring();
      if (typeof video.requestVideoFrameCallback === 'function') {
        monitorWithVideoFrames(activeRunId);
      } else {
        frame = requestAnimationFrame(() => monitorWithRaf(activeRunId));
      }
    }

    function finishVideo(activeRunId) {
      if (activeRunId !== runId || state !== STATES.PLAYING) return;
      fireNearBlack();
      cancelMonitoring();
      video.pause();
      video.classList.remove('is-active');
      state = STATES.DONE;
      onDone();
    }

    function clearFallbackTimers() {
      window.clearTimeout(fallbackNearTimer);
      window.clearTimeout(fallbackDoneTimer);
      fallbackNearTimer = 0;
      fallbackDoneTimer = 0;
    }

    function startFallback(origin, activeRunId) {
      cancelMonitoring();
      clearFallbackTimers();
      video.pause();
      video.classList.remove('is-active');

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
      positionLayer(video, origin);

      try {
        video.pause();
        video.currentTime = 0;
      } catch (_) {
        // Some engines disallow seeking before metadata; play() below remains the source of truth.
      }

      video.classList.add('is-active');

      const handleEnded = () => {
        video.removeEventListener('ended', handleEnded);
        finishVideo(activeRunId);
      };
      video.addEventListener('ended', handleEnded);

      try {
        const playPromise = video.play();
        if (playPromise && typeof playPromise.then === 'function') await playPromise;
        if (activeRunId !== runId || state !== STATES.PLAYING) return false;
        startMonitoring(activeRunId);
        return true;
      } catch (_) {
        video.removeEventListener('ended', handleEnded);
        if (activeRunId !== runId) return false;
        startFallback(origin, activeRunId);
        return false;
      }
    }

    function reset() {
      runId += 1;
      cancelMonitoring();
      clearFallbackTimers();
      nearBlackFired = false;

      video.pause();
      video.classList.remove('is-active');
      try {
        video.currentTime = 0;
      } catch (_) {
        // No-op when metadata has not loaded yet.
      }

      if (fallback) fallback.classList.remove('is-active');
      state = STATES.IDLE;
    }

    // Preload early while the handwriting / intro copy is playing.
    if (video.preload !== 'auto') video.preload = 'auto';
    try {
      video.load();
    } catch (_) {
      // Browsers may ignore explicit load() in constrained data-saving modes.
    }

    return {
      start,
      reset,
      getState: () => state,
      states: STATES,
    };
  }

  window.createMatteTransition = createMatteTransition;
})();

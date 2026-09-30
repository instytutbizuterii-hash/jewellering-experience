(() => {
  'use strict';

  const STATES = Object.freeze({
    IDLE: 'IDLE',
    HOLDING: 'HOLDING',
    COMMITTED: 'COMMITTED',
  });

  const clamp01 = (value) => Math.max(0, Math.min(1, value));

  function createHoldCTA(options) {
    const {
      trigger,
      originTarget = trigger,
      reducedMotion = false,
      holdMs = reducedMotion ? 420 : 2000,
      canStart = () => true,
      onStart = () => true,
      onProgress = () => {},
      onCommit = () => {},
      onCancel = () => {},
    } = options;

    if (!trigger) throw new Error('HoldCTA requires a trigger element.');

    let state = STATES.IDLE;
    let frame = 0;
    let holdStartedAt = 0;
    let pointerId = null;
    let keyboardKey = null;
    let progress = 0;
    let activeOrigin = null;

    function getOrigin() {
      const target = originTarget || trigger;
      const rect = target.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        width: rect.width,
        height: rect.height,
      };
    }

    function setProgress(value, notify = true) {
      progress = clamp01(value);
      trigger.style.setProperty('--hold-progress', progress.toFixed(4));
      trigger.classList.toggle('is-holding', state === STATES.HOLDING && progress > 0);
      if (notify) onProgress(progress, activeOrigin || getOrigin());
    }

    function setCommittedState(committed) {
      trigger.classList.toggle('is-committed', committed);
      trigger.setAttribute('aria-disabled', committed ? 'true' : 'false');
    }

    function releaseCapturedPointer() {
      if (pointerId === null) return;
      const capturedId = pointerId;
      pointerId = null;

      if (!trigger.releasePointerCapture) return;

      try {
        if (!trigger.hasPointerCapture || trigger.hasPointerCapture(capturedId)) {
          trigger.releasePointerCapture(capturedId);
        }
      } catch (_) {
        // The browser may have already released capture.
      }
    }

    function cancelHold() {
      if (state !== STATES.HOLDING) return;

      const cancelledProgress = progress;
      const cancelledOrigin = activeOrigin || getOrigin();

      cancelAnimationFrame(frame);
      frame = 0;
      holdStartedAt = 0;
      keyboardKey = null;
      state = STATES.IDLE;
      releaseCapturedPointer();
      setProgress(0, false);
      activeOrigin = null;
      onCancel(cancelledProgress, cancelledOrigin);
    }

    function commit() {
      if (state !== STATES.HOLDING) return;

      cancelAnimationFrame(frame);
      frame = 0;
      holdStartedAt = 0;
      keyboardKey = null;
      state = STATES.COMMITTED;
      setProgress(1);
      trigger.classList.remove('is-holding');
      setCommittedState(true);
      releaseCapturedPointer();

      const committedOrigin = activeOrigin || getOrigin();
      activeOrigin = null;
      onCommit(committedOrigin);
    }

    function tick(now) {
      if (state !== STATES.HOLDING) return;

      const nextProgress = clamp01((now - holdStartedAt) / holdMs);
      setProgress(nextProgress);

      if (nextProgress >= 1) {
        commit();
        return;
      }

      frame = requestAnimationFrame(tick);
    }

    function startHold(event) {
      if (state !== STATES.IDLE || !canStart()) return;
      if (event.type === 'pointerdown') {
        if (event.button !== 0 || event.isPrimary === false) return;
      }

      event.preventDefault();
      activeOrigin = getOrigin();

      if (onStart(activeOrigin) === false) {
        activeOrigin = null;
        return;
      }

      state = STATES.HOLDING;
      holdStartedAt = performance.now();
      setCommittedState(false);
      setProgress(0);

      if (event.type === 'pointerdown') {
        pointerId = event.pointerId;
        if (trigger.setPointerCapture) {
          try {
            trigger.setPointerCapture(pointerId);
          } catch (_) {
            // Keep tracking the primary pointer even if capture is unavailable.
          }
        }
      } else if (event.type === 'keydown') {
        keyboardKey = event.key;
      }

      frame = requestAnimationFrame(tick);
    }

    function onPointerUp(event) {
      if (state !== STATES.HOLDING || pointerId === null || event.pointerId !== pointerId) return;
      releaseCapturedPointer();
      cancelHold();
    }

    function onPointerCancel(event) {
      if (state !== STATES.HOLDING || pointerId === null || event.pointerId !== pointerId) return;
      releaseCapturedPointer();
      cancelHold();
    }

    function onLostPointerCapture(event) {
      if (state !== STATES.HOLDING || pointerId === null || event.pointerId !== pointerId) return;
      pointerId = null;
      cancelHold();
    }

    function onKeyDown(event) {
      if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) startHold(event);
    }

    function onKeyUp(event) {
      if (state === STATES.HOLDING && keyboardKey && event.key === keyboardKey) {
        keyboardKey = null;
        cancelHold();
      }
    }

    function reset() {
      cancelAnimationFrame(frame);
      frame = 0;
      holdStartedAt = 0;
      keyboardKey = null;
      state = STATES.IDLE;
      releaseCapturedPointer();
      activeOrigin = null;
      progress = 0;
      trigger.style.setProperty('--hold-progress', '0');
      trigger.classList.remove('is-holding', 'is-committed');
      trigger.setAttribute('aria-disabled', 'false');
    }

    function destroy() {
      reset();
      trigger.removeEventListener('pointerdown', startHold);
      trigger.removeEventListener('pointerup', onPointerUp);
      trigger.removeEventListener('pointercancel', onPointerCancel);
      trigger.removeEventListener('lostpointercapture', onLostPointerCapture);
      trigger.removeEventListener('keydown', onKeyDown);
      trigger.removeEventListener('keyup', onKeyUp);
    }

    trigger.addEventListener('pointerdown', startHold);
    trigger.addEventListener('pointerup', onPointerUp);
    trigger.addEventListener('pointercancel', onPointerCancel);
    trigger.addEventListener('lostpointercapture', onLostPointerCapture);
    trigger.addEventListener('keydown', onKeyDown);
    trigger.addEventListener('keyup', onKeyUp);

    reset();

    return {
      reset,
      destroy,
      getState: () => state,
      getProgress: () => progress,
      states: STATES,
    };
  }

  window.createHoldCTA = createHoldCTA;
})();

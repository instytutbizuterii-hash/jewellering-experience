(() => {
  'use strict';

  const STATES = Object.freeze({
    IDLE: 'IDLE',
    HOLDING: 'HOLDING',
    COMPLETING: 'COMPLETING',
    COMMITTED: 'COMMITTED',
  });

  const clamp01 = (value) => Math.max(0, Math.min(1, value));

  function createHoldCTA(options) {
    const {
      trigger,
      reducedMotion = false,
      holdMs = reducedMotion ? 420 : 1350,
      completionMs = reducedMotion ? 0 : 150,
      canStart = () => true,
      onCommit = () => {},
      onCancel = () => {},
    } = options;

    if (!trigger) throw new Error('HoldCTA requires a trigger element.');

    const progressPaths = Array.from(trigger.querySelectorAll('[data-hold-progress-path]'));

    let state = STATES.IDLE;
    let frame = 0;
    let completionTimer = 0;
    let holdStartedAt = 0;
    let pointerId = null;
    let keyboardKey = null;

    function setProgress(value) {
      const progress = clamp01(value);
      trigger.style.setProperty('--hold-progress', progress.toFixed(4));
      progressPaths.forEach((path) => {
        path.style.strokeDashoffset = String(1 - progress);
      });
      trigger.classList.toggle('is-holding', state === STATES.HOLDING && progress > 0);
    }

    function setCommittedState(committed) {
      trigger.classList.toggle('is-committed', committed);
      trigger.setAttribute('aria-disabled', committed ? 'true' : 'false');
    }

    function releaseCapturedPointer() {
      if (pointerId === null) return;

      if (trigger.releasePointerCapture) {
        try {
          if (!trigger.hasPointerCapture || trigger.hasPointerCapture(pointerId)) {
            trigger.releasePointerCapture(pointerId);
          }
        } catch (_) {
          // Browser may have already released capture.
        }
      }

      pointerId = null;
    }

    function getOrigin() {
      const rect = trigger.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        width: rect.width,
        height: rect.height,
      };
    }

    function cancelHold() {
      if (state !== STATES.HOLDING) return;

      cancelAnimationFrame(frame);
      frame = 0;
      holdStartedAt = 0;
      keyboardKey = null;
      releaseCapturedPointer();
      state = STATES.IDLE;
      setProgress(0);
      trigger.classList.remove('is-completing');
      onCancel();
    }

    function commit() {
      if (state !== STATES.COMPLETING) return;

      state = STATES.COMMITTED;
      trigger.classList.remove('is-completing');
      setCommittedState(true);
      onCommit(getOrigin());
    }

    function completeHold() {
      if (state !== STATES.HOLDING) return;

      cancelAnimationFrame(frame);
      frame = 0;
      holdStartedAt = 0;
      keyboardKey = null;
      releaseCapturedPointer();
      state = STATES.COMPLETING;
      setProgress(1);
      trigger.classList.remove('is-holding');
      trigger.classList.add('is-completing');
      trigger.setAttribute('aria-disabled', 'true');

      if (completionMs <= 0) {
        commit();
        return;
      }

      completionTimer = window.setTimeout(commit, completionMs);
    }

    function tick(now) {
      if (state !== STATES.HOLDING) return;

      const progress = clamp01((now - holdStartedAt) / holdMs);
      setProgress(progress);

      if (progress >= 1) {
        completeHold();
        return;
      }

      frame = requestAnimationFrame(tick);
    }

    function startHold(event) {
      if (state !== STATES.IDLE || !canStart()) return;
      if (event.type === 'pointerdown' && event.button !== 0) return;

      event.preventDefault();
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
            pointerId = null;
          }
        }
      } else if (event.type === 'keydown') {
        keyboardKey = event.key;
      }

      frame = requestAnimationFrame(tick);
    }

    function onPointerUp(event) {
      if (pointerId !== null && event.pointerId === pointerId) releaseCapturedPointer();
      cancelHold();
    }

    function onPointerCancel(event) {
      if (pointerId !== null && event.pointerId === pointerId) releaseCapturedPointer();
      cancelHold();
    }

    function onKeyDown(event) {
      if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) startHold(event);
    }

    function onKeyUp(event) {
      if (keyboardKey && event.key === keyboardKey) {
        keyboardKey = null;
        cancelHold();
      }
    }

    function reset() {
      cancelAnimationFrame(frame);
      frame = 0;
      window.clearTimeout(completionTimer);
      completionTimer = 0;
      holdStartedAt = 0;
      keyboardKey = null;
      releaseCapturedPointer();
      state = STATES.IDLE;
      trigger.classList.remove('is-holding', 'is-completing', 'is-committed');
      trigger.setAttribute('aria-disabled', 'false');
      setProgress(0);
    }

    function destroy() {
      reset();
      trigger.removeEventListener('pointerdown', startHold);
      trigger.removeEventListener('pointerup', onPointerUp);
      trigger.removeEventListener('pointercancel', onPointerCancel);
      trigger.removeEventListener('keydown', onKeyDown);
      trigger.removeEventListener('keyup', onKeyUp);
    }

    progressPaths.forEach((path) => {
      path.style.strokeDasharray = '1';
      path.style.strokeDashoffset = '1';
    });

    trigger.addEventListener('pointerdown', startHold);
    trigger.addEventListener('pointerup', onPointerUp);
    trigger.addEventListener('pointercancel', onPointerCancel);
    trigger.addEventListener('keydown', onKeyDown);
    trigger.addEventListener('keyup', onKeyUp);

    setProgress(0);

    return {
      reset,
      destroy,
      getState: () => state,
      states: STATES,
    };
  }

  window.createHoldCTA = createHoldCTA;
})();

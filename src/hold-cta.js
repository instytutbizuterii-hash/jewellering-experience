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
      reducedMotion = false,
      holdMs = reducedMotion ? 420 : 1280,
      canStart = () => true,
      onCommit = () => {},
      onCancel = () => {},
    } = options;

    if (!trigger) throw new Error('HoldCTA requires a trigger element.');

    const progressPaths = Array.from(trigger.querySelectorAll('[data-hold-progress-path]'));

    let state = STATES.IDLE;
    let frame = 0;
    let holdStartedAt = 0;
    let pointerId = null;
    let keyboardKey = null;

    function setProgress(value) {
      const progress = clamp01(value);
      const pulseCycle = progress * 3.5;
      const pulsePhase = pulseCycle - Math.floor(pulseCycle);
      const pulse = reducedMotion ? 0 : Math.sin(Math.PI * pulsePhase);
      const pulseStrength = reducedMotion ? 0 : pulse * (0.34 + progress * 0.66);

      const scale = 1 + progress * 0.004 + pulseStrength * 0.014;
      const haloInset = -(7 + progress * 5 + pulseStrength * 8);
      const haloOpacity = Math.min(0.92, progress * 0.34 + pulseStrength * 0.56);
      const haloScale = 1 + progress * 0.012 + pulseStrength * 0.025;
      const haloBlur = 10 + progress * 12 + pulseStrength * 18;
      const haloTightBlur = 3 + pulseStrength * 5;
      const innerInset = 5 - pulseStrength * 1.5;
      const innerOpacity = Math.min(1, 0.72 + progress * 0.18 + pulseStrength * 0.10);
      const strokeWidth = 2.35 + progress * 0.75;
      const strokeOpacity = 0.72 + progress * 0.28;

      trigger.style.setProperty('--hold-progress', progress.toFixed(4));
      trigger.style.setProperty('--hold-growth', progress.toFixed(4));
      trigger.style.setProperty('--hold-pulse', pulseStrength.toFixed(4));
      trigger.style.setProperty('--hold-scale', scale.toFixed(4));
      trigger.style.setProperty('--hold-halo-inset', `${haloInset.toFixed(2)}px`);
      trigger.style.setProperty('--hold-halo-opacity', haloOpacity.toFixed(4));
      trigger.style.setProperty('--hold-halo-scale', haloScale.toFixed(4));
      trigger.style.setProperty('--hold-halo-blur', `${haloBlur.toFixed(2)}px`);
      trigger.style.setProperty('--hold-halo-tight-blur', `${haloTightBlur.toFixed(2)}px`);
      trigger.style.setProperty('--hold-inner-inset', `${innerInset.toFixed(2)}px`);
      trigger.style.setProperty('--hold-inner-opacity', innerOpacity.toFixed(4));
      trigger.style.setProperty('--hold-stroke-width', `${strokeWidth.toFixed(2)}px`);
      trigger.style.setProperty('--hold-stroke-opacity', strokeOpacity.toFixed(4));

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
      onCancel();
    }

    function commit() {
      if (state !== STATES.HOLDING) return;

      cancelAnimationFrame(frame);
      frame = 0;
      holdStartedAt = 0;
      keyboardKey = null;
      releaseCapturedPointer();
      state = STATES.COMMITTED;
      setProgress(1);
      trigger.classList.remove('is-holding');
      setCommittedState(true);
      onCommit(getOrigin());
    }

    function tick(now) {
      if (state !== STATES.HOLDING) return;

      const progress = clamp01((now - holdStartedAt) / holdMs);
      setProgress(progress);

      if (progress >= 1) {
        commit();
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
      holdStartedAt = 0;
      keyboardKey = null;
      releaseCapturedPointer();
      state = STATES.IDLE;
      trigger.classList.remove('is-holding', 'is-committed');
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

(() => {
  'use strict';

  const STATES = Object.freeze({
    IDLE: 'IDLE',
    HOLDING: 'HOLDING',
    COMMITTED: 'COMMITTED',
  });

  const clamp01 = (value) => Math.max(0, Math.min(1, value));
  const smoothstep = (value) => {
    const x = clamp01(value);
    return x * x * (3 - 2 * x);
  };

  // Art-directed hold pulse. Peaks get progressively larger while the retreats
  // never return fully to zero, which keeps the interaction feeling cumulative.
  const PULSE_KEYS = Object.freeze([
    { at: 0.00, spread: 0, intensity: 0.00 },
    { at: 0.28, spread: 8, intensity: 0.66 },
    { at: 0.42, spread: 3, intensity: 0.34 },
    { at: 0.64, spread: 13, intensity: 0.79 },
    { at: 0.77, spread: 5, intensity: 0.42 },
    { at: 1.00, spread: 19, intensity: 0.96 },
  ]);

  function samplePulse(progress) {
    const p = clamp01(progress);

    for (let index = 0; index < PULSE_KEYS.length - 1; index += 1) {
      const from = PULSE_KEYS[index];
      const to = PULSE_KEYS[index + 1];
      if (p > to.at) continue;

      const range = Math.max(to.at - from.at, 0.0001);
      const local = smoothstep((p - from.at) / range);
      return {
        spread: from.spread + (to.spread - from.spread) * local,
        intensity: from.intensity + (to.intensity - from.intensity) * local,
      };
    }

    return PULSE_KEYS[PULSE_KEYS.length - 1];
  }

  function createHoldCTA(options) {
    const {
      trigger,
      reducedMotion = false,
      holdMs = reducedMotion ? 420 : 2000,
      canStart = () => true,
      onCommit = () => {},
      onCancel = () => {},
    } = options;

    if (!trigger) throw new Error('HoldCTA requires a trigger element.');

    let state = STATES.IDLE;
    let frame = 0;
    let holdStartedAt = 0;
    let pointerId = null;
    let keyboardKey = null;

    function setProgress(value) {
      const progress = clamp01(value);
      const pulse = reducedMotion ? { spread: 0, intensity: 0 } : samplePulse(progress);
      const spread = pulse.spread;
      const intensity = pulse.intensity;

      // The button itself stays readable and almost still. The visible forward /
      // backward motion belongs to the black soft ring around the fixed outline.
      const scale = 1 + intensity * 0.0018;
      const haloInset = -(2 + spread);
      const haloOpacity = Math.min(0.92, intensity * 0.92);
      const haloBlur = 1.35 + intensity * 2.65;
      const coreInset = -(1 + spread * 0.66);
      const coreOpacity = Math.min(0.72, intensity * 0.72);
      const coreBlur = 0.65 + intensity * 1.15;

      trigger.style.setProperty('--hold-scale', scale.toFixed(4));
      trigger.style.setProperty('--hold-halo-inset', `${haloInset.toFixed(2)}px`);
      trigger.style.setProperty('--hold-halo-opacity', haloOpacity.toFixed(4));
      trigger.style.setProperty('--hold-halo-blur', `${haloBlur.toFixed(2)}px`);
      trigger.style.setProperty('--hold-core-inset', `${coreInset.toFixed(2)}px`);
      trigger.style.setProperty('--hold-core-opacity', coreOpacity.toFixed(4));
      trigger.style.setProperty('--hold-core-blur', `${coreBlur.toFixed(2)}px`);
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

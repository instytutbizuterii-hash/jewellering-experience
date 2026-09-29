(() => {
  'use strict';

  const STATES = Object.freeze({
    IDLE: 'IDLE',
    HOLDING: 'HOLDING',
    COMMITTED: 'COMMITTED',
    SPLASH: 'SPLASH',
    BLEED: 'BLEED',
    FLOOD: 'FLOOD',
    COVERED: 'COVERED',
    DONE: 'DONE',
  });

  const clamp01 = (value) => Math.max(0, Math.min(1, value));

  function easeOutCubic(value) {
    const x = clamp01(value);
    return 1 - Math.pow(1 - x, 3);
  }

  function easeInOutCubic(value) {
    const x = clamp01(value);
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  function easeOutBack(value) {
    const x = clamp01(value);
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  function rngFactory(seed) {
    let state = seed >>> 0 || 1;
    return () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 4294967296;
    };
  }

  function createInkTransition(options) {
    const {
      canvas,
      trigger,
      reducedMotion = false,
      seed = 1707,
      canStart = () => true,
      onCommit = () => {},
      onCovered = () => {},
      onDone = () => {},
    } = options;

    if (!canvas || !trigger) {
      throw new Error('InkTransition requires canvas and trigger elements.');
    }

    const context = canvas.getContext('2d', { alpha: true });
    if (!context) {
      throw new Error('InkTransition requires Canvas 2D support.');
    }

    const HOLD_MS = reducedMotion ? 400 : 1350;
    const SPLASH_MS = 440;
    const BLEED_MS = 720;
    const FLOOD_MS = 1040;
    const TOTAL_MS = SPLASH_MS + BLEED_MS + FLOOD_MS;
    const DPR_CAP = 2;
    const INK = '#0c0c0d';

    let state = STATES.IDLE;
    let frame = 0;
    let width = 1;
    let height = 1;
    let dpr = 1;
    let model = null;
    let holdStartedAt = 0;
    let transitionStartedAt = 0;
    let pointerId = null;
    let keyboardKey = null;
    let released = false;

    function makeBlob(rng, radius, lobes = 13) {
      const points = [];
      const phase = rng() * Math.PI * 2;

      for (let index = 0; index < lobes; index += 1) {
        const angle = phase + (index / lobes) * Math.PI * 2;
        const jitter = 0.72 + rng() * 0.5;
        points.push({ angle, radius: radius * jitter });
      }

      return points;
    }

    function createModel(modelSeed) {
      const rng = rngFactory(modelSeed);
      const rect = trigger.getBoundingClientRect();
      const origin = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };

      const farthest = Math.max(
        Math.hypot(origin.x, origin.y),
        Math.hypot(width - origin.x, origin.y),
        Math.hypot(origin.x, height - origin.y),
        Math.hypot(width - origin.x, height - origin.y)
      );

      const splats = Array.from({ length: 9 }, (_, index) => {
        const upperBias = index < 3;
        const angle = upperBias
          ? -Math.PI * 0.82 + rng() * Math.PI * 0.64
          : rng() * Math.PI * 2;
        const distance = 44 + rng() * Math.min(width, height) * 0.35;
        const radius = 25 + rng() * 68;
        const drip = index < 5 || rng() > 0.43;

        return {
          x: origin.x + Math.cos(angle) * distance,
          y: origin.y + Math.sin(angle) * distance,
          radius,
          delay: index * 24 + rng() * 76,
          points: makeBlob(rng, radius, 10 + Math.floor(rng() * 6)),
          drip,
          dripDelay: 40 + rng() * 170,
          dripLength: 78 + rng() * Math.max(130, height * 0.38),
          dripWidth: 3.2 + rng() * 8.6,
          drift: (rng() - 0.5) * 34,
        };
      });

      const droplets = Array.from({ length: 28 }, (_, index) => {
        const angle = rng() * Math.PI * 2;
        const distance = 26 + rng() * Math.min(width, height) * 0.48;
        return {
          x: origin.x + Math.cos(angle) * distance,
          y: origin.y + Math.sin(angle) * distance,
          radius: 1.6 + rng() * 6.4,
          stretch: 0.75 + rng() * 0.9,
          rotation: angle + (rng() - 0.5) * 0.7,
          delay: (index % 7) * 18 + rng() * 145,
        };
      });

      return {
        origin,
        farthest,
        seedBlob: makeBlob(rng, 24, 12),
        floodBlob: makeBlob(rng, farthest * 1.2, 24),
        splats,
        droplets,
      };
    }

    function resizeCanvas(force = false) {
      if (!force && ![STATES.IDLE, STATES.HOLDING].includes(state)) return;

      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width || window.innerWidth));
      height = Math.max(1, Math.round(rect.height || window.innerHeight));
      dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);

      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      model = createModel(seed);

      if (state === STATES.HOLDING) {
        drawFrame(0, currentHoldProgress());
      } else {
        clearCanvas();
      }
    }

    function freezeCanvasSize() {
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    function unfreezeCanvasSize() {
      canvas.style.removeProperty('width');
      canvas.style.removeProperty('height');
    }

    function pathBlob(cx, cy, points, scaleX = 1, scaleY = 1) {
      const vertices = points.map((point) => ({
        x: cx + Math.cos(point.angle) * point.radius * scaleX,
        y: cy + Math.sin(point.angle) * point.radius * scaleY,
      }));

      const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      const start = midpoint(vertices[vertices.length - 1], vertices[0]);

      context.beginPath();
      context.moveTo(start.x, start.y);
      vertices.forEach((vertex, index) => {
        const next = vertices[(index + 1) % vertices.length];
        const end = midpoint(vertex, next);
        context.quadraticCurveTo(vertex.x, vertex.y, end.x, end.y);
      });
      context.closePath();
    }

    function fillBlob(cx, cy, points, scale, alpha = 1, stretchY = 1) {
      context.globalAlpha = alpha;
      pathBlob(cx, cy, points, scale, scale * stretchY);
      context.fill();
    }

    function clearCanvas() {
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      context.globalAlpha = 1;
      context.fillStyle = INK;
      context.strokeStyle = INK;
    }

    function drawSeed(progress) {
      if (!model || progress <= 0) return;

      const eased = progress * 0.35 + easeInOutCubic(progress) * 0.65;
      const scale = 0.08 + eased * 0.78;
      context.fillStyle = INK;

      fillBlob(model.origin.x, model.origin.y, model.seedBlob, scale * 1.14, 0.07 + progress * 0.1, 1.06);
      fillBlob(model.origin.x, model.origin.y, model.seedBlob, scale, 0.72 + progress * 0.26, 1);
    }

    function drawSplash(time) {
      if (!model) return;

      context.fillStyle = INK;

      for (const splat of model.splats) {
        const local = clamp01((time - splat.delay) / Math.max(175, SPLASH_MS - splat.delay));
        if (local <= 0) continue;

        const eased = easeOutBack(local);
        fillBlob(splat.x, splat.y, splat.points, eased * 1.1, 0.065, 1.035);
        fillBlob(splat.x, splat.y, splat.points, eased, 0.96, 1);
      }

      for (const drop of model.droplets) {
        const local = clamp01((time - drop.delay) / 190);
        if (local <= 0) continue;

        const eased = easeOutBack(local);
        context.globalAlpha = 0.88 * easeOutCubic(local);
        context.save();
        context.translate(drop.x, drop.y);
        context.rotate(drop.rotation);
        context.beginPath();
        context.ellipse(0, 0, drop.radius * eased, drop.radius * drop.stretch * eased, 0, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }
    }

    function drawDrip(splat, local) {
      if (!splat.drip || local <= 0) return;

      const progress = easeInOutCubic(local);
      const length = splat.dripLength * progress;
      const endX = splat.x + splat.drift * progress;
      const startY = splat.y + splat.radius * 0.32;
      const widthNow = splat.dripWidth * (1 - progress * 0.26);

      context.globalAlpha = 0.94;
      context.lineCap = 'round';
      context.strokeStyle = INK;
      context.lineWidth = widthNow;
      context.beginPath();
      context.moveTo(splat.x, startY);
      context.bezierCurveTo(
        splat.x + splat.drift * 0.12,
        startY + length * 0.28,
        endX - splat.drift * 0.1,
        startY + length * 0.72,
        endX,
        startY + length
      );
      context.stroke();

      context.fillStyle = INK;
      context.beginPath();
      context.ellipse(
        endX,
        startY + length,
        widthNow * (1.2 + progress * 0.5),
        widthNow * (1.45 + progress * 0.68),
        0,
        0,
        Math.PI * 2
      );
      context.fill();
    }

    function drawBleed(time) {
      if (!model) return;

      const phaseTime = time - SPLASH_MS;
      const phaseProgress = clamp01(phaseTime / BLEED_MS);
      if (phaseProgress <= 0) return;

      context.fillStyle = INK;

      model.splats.forEach((splat, index) => {
        const local = clamp01((phaseTime - index * 20) / (BLEED_MS * 0.84));
        const swell = 1 + easeOutCubic(local) * 0.19;

        fillBlob(splat.x, splat.y, splat.points, swell * 1.09, 0.05, 1.04);
        fillBlob(splat.x, splat.y, splat.points, swell, 0.98, 1);

        const dripLocal = clamp01((phaseTime - splat.dripDelay) / (BLEED_MS - splat.dripDelay * 0.45));
        drawDrip(splat, dripLocal);
      });
    }

    function drawFlood(time) {
      if (!model) return;

      const phaseTime = time - SPLASH_MS - BLEED_MS;
      const progress = clamp01(phaseTime / FLOOD_MS);
      if (progress <= 0) return;

      const eased = easeInOutCubic(progress);
      context.fillStyle = INK;

      const floodScale = 0.055 + eased * 1.03;
      fillBlob(model.origin.x, model.origin.y, model.floodBlob, floodScale * 1.03, 0.085, 1.08 + eased * 0.1);
      fillBlob(
        model.origin.x,
        model.origin.y,
        model.floodBlob,
        floodScale,
        Math.min(1, 0.77 + eased * 0.28),
        1.06 + eased * 0.1
      );

      if (progress > 0.8) {
        context.globalAlpha = clamp01((progress - 0.8) / 0.2);
        context.fillRect(0, 0, width, height);
      }
    }

    function drawFrame(timeMs = 0, holdProgress = 0) {
      clearCanvas();
      drawSeed(holdProgress);

      if (timeMs > 0) {
        drawSplash(timeMs);
        drawBleed(timeMs);
        drawFlood(timeMs);
      }

      context.globalAlpha = 1;
    }

    function drawCoveredFrame() {
      clearCanvas();
      context.globalAlpha = 1;
      context.fillStyle = INK;
      context.fillRect(0, 0, width, height);
    }

    function setButtonProgress(progress) {
      const value = clamp01(progress);
      trigger.style.setProperty('--ink-press', value.toFixed(4));
      trigger.classList.toggle('is-holding', state === STATES.HOLDING && value > 0);
    }

    function currentHoldProgress() {
      if (state !== STATES.HOLDING || !holdStartedAt) return 0;
      return clamp01((performance.now() - holdStartedAt) / HOLD_MS);
    }

    function setCanvasVisible(visible) {
      canvas.classList.toggle('is-active', visible);
    }

    function setCommittedVisualState(committed) {
      canvas.classList.toggle('is-committed', committed);
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
          // Pointer capture can already be released by the browser.
        }
      }

      pointerId = null;
    }

    function resetHoldOnly() {
      cancelAnimationFrame(frame);
      frame = 0;
      holdStartedAt = 0;
      keyboardKey = null;
      releaseCapturedPointer();
      state = STATES.IDLE;
      setButtonProgress(0);
      setCommittedVisualState(false);
      setCanvasVisible(false);
      clearCanvas();
    }

    function cancelHold() {
      if (state !== STATES.HOLDING) return;
      resetHoldOnly();
    }

    function finishCovered() {
      cancelAnimationFrame(frame);
      frame = 0;
      drawCoveredFrame();
      state = STATES.COVERED;
      onCovered();
    }

    function tickTransition(now) {
      if (![STATES.COMMITTED, STATES.SPLASH, STATES.BLEED, STATES.FLOOD].includes(state)) return;

      const elapsed = now - transitionStartedAt;

      if (elapsed < SPLASH_MS) {
        state = STATES.SPLASH;
      } else if (elapsed < SPLASH_MS + BLEED_MS) {
        state = STATES.BLEED;
      } else {
        state = STATES.FLOOD;
      }

      drawFrame(elapsed, 1);

      if (elapsed >= TOTAL_MS) {
        finishCovered();
        return;
      }

      frame = requestAnimationFrame(tickTransition);
    }

    function commitTransition(now) {
      if (state !== STATES.HOLDING) return;

      cancelAnimationFrame(frame);
      frame = 0;
      state = STATES.COMMITTED;
      holdStartedAt = 0;
      keyboardKey = null;
      releaseCapturedPointer();
      setButtonProgress(1);
      setCommittedVisualState(true);
      setCanvasVisible(true);
      freezeCanvasSize();
      model = createModel(seed);
      onCommit();

      if (reducedMotion) {
        drawCoveredFrame();
        state = STATES.COVERED;
        onCovered();
        return;
      }

      transitionStartedAt = now;
      frame = requestAnimationFrame(tickTransition);
    }

    function tickHold(now) {
      if (state !== STATES.HOLDING) return;

      const progress = clamp01((now - holdStartedAt) / HOLD_MS);
      setButtonProgress(progress);
      drawFrame(0, progress);

      if (progress >= 1) {
        commitTransition(now);
        return;
      }

      frame = requestAnimationFrame(tickHold);
    }

    function startHold(event) {
      if (state !== STATES.IDLE || !canStart()) return;
      if (event.type === 'pointerdown' && event.button !== 0) return;

      event.preventDefault();
      resizeCanvas(true);
      model = createModel(seed);
      state = STATES.HOLDING;
      holdStartedAt = performance.now();
      setCanvasVisible(true);
      setButtonProgress(0);

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

      frame = requestAnimationFrame(tickHold);
    }

    function onPointerUp(event) {
      if (pointerId !== null && event.pointerId === pointerId) {
        releaseCapturedPointer();
      }
      cancelHold();
    }

    function onPointerCancel(event) {
      if (pointerId !== null && event.pointerId === pointerId) {
        releaseCapturedPointer();
      }
      cancelHold();
    }

    function onKeyDown(event) {
      if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
        startHold(event);
      }
    }

    function onKeyUp(event) {
      if (keyboardKey && event.key === keyboardKey) {
        keyboardKey = null;
        cancelHold();
      }
    }

    function onResize() {
      resizeCanvas();
    }

    function release() {
      if (state !== STATES.COVERED || released) return;
      released = true;
      state = STATES.DONE;

      const finish = () => {
        canvas.removeEventListener('transitionend', onTransitionEnd);
        canvas.classList.remove('is-releasing', 'is-committed', 'is-active');
        unfreezeCanvasSize();
        clearCanvas();
        onDone();
      };

      const onTransitionEnd = (event) => {
        if (event.target === canvas && event.propertyName === 'opacity') finish();
      };

      if (reducedMotion) {
        finish();
        return;
      }

      canvas.addEventListener('transitionend', onTransitionEnd);
      requestAnimationFrame(() => canvas.classList.add('is-releasing'));

      // Fallback only for browsers that do not emit transitionend reliably.
      window.setTimeout(() => {
        if (canvas.classList.contains('is-releasing')) finish();
      }, 650);
    }

    function reset() {
      cancelAnimationFrame(frame);
      frame = 0;
      released = false;
      transitionStartedAt = 0;
      holdStartedAt = 0;
      keyboardKey = null;
      releaseCapturedPointer();
      state = STATES.IDLE;
      canvas.classList.remove('is-releasing', 'is-committed', 'is-active');
      unfreezeCanvasSize();
      setCommittedVisualState(false);
      setButtonProgress(0);
      resizeCanvas(true);
      clearCanvas();
    }

    function destroy() {
      cancelAnimationFrame(frame);
      trigger.removeEventListener('pointerdown', startHold);
      trigger.removeEventListener('pointerup', onPointerUp);
      trigger.removeEventListener('pointercancel', onPointerCancel);
      trigger.removeEventListener('keydown', onKeyDown);
      trigger.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      clearCanvas();
    }

    trigger.addEventListener('pointerdown', startHold);
    trigger.addEventListener('pointerup', onPointerUp);
    trigger.addEventListener('pointercancel', onPointerCancel);
    trigger.addEventListener('keydown', onKeyDown);
    trigger.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onResize, { passive: true });

    resizeCanvas(true);

    return {
      reset,
      release,
      destroy,
      getState: () => state,
      getSeed: () => seed,
      states: STATES,
    };
  }

  window.createInkTransition = createInkTransition;
})();

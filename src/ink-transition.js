(() => {
  'use strict';

  const STATES = Object.freeze({
    IDLE: 'IDLE',
    SPLASH: 'SPLASH',
    BLEED: 'BLEED',
    COVERAGE: 'COVERAGE',
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
      reducedMotion = false,
      seed = 1808,
      onCovered = () => {},
      onDone = () => {},
    } = options;

    if (!canvas) throw new Error('InkTransition requires a canvas element.');

    const display = canvas.getContext('2d', { alpha: true });
    if (!display) throw new Error('InkTransition requires Canvas 2D support.');

    const buffer = document.createElement('canvas');
    const ink = buffer.getContext('2d', { alpha: true });
    if (!ink) throw new Error('InkTransition requires an offscreen Canvas 2D buffer.');

    const SPLASH_MS = 650;
    const BLEED_END_MS = 1450;
    const COVERED_MS = 2700;
    const BLEED_STEP_MS = 58;
    const COVERAGE_STEP_MS = 66;
    const DPR_CAP = 2;
    const INK = '#0c0c0d';

    let state = STATES.IDLE;
    let frame = 0;
    let width = 1;
    let height = 1;
    let dpr = 1;
    let model = null;
    let startedAt = 0;
    let lastFrameAt = 0;
    let released = false;

    function makeBlob(rng, radius, lobes = 15) {
      const points = [];
      const phase = rng() * Math.PI * 2;

      for (let index = 0; index < lobes; index += 1) {
        const angle = phase + (index / lobes) * Math.PI * 2;
        const wave = Math.sin(index * 1.73 + phase) * 0.08;
        const jitter = 0.72 + rng() * 0.42 + wave;
        points.push({ angle, radius: radius * jitter });
      }

      return points;
    }

    function pathBlob(context, cx, cy, points, scaleX = 1, scaleY = 1) {
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

    function fillBlob(context, cx, cy, points, scale, alpha = 1, stretchY = 1) {
      context.save();
      context.globalAlpha = alpha;
      context.fillStyle = INK;
      pathBlob(context, cx, cy, points, scale, scale * stretchY);
      context.fill();
      context.restore();
    }

    function configureContexts() {
      display.setTransform(dpr, 0, 0, dpr, 0, 0);
      ink.setTransform(dpr, 0, 0, dpr, 0, 0);
      display.fillStyle = INK;
      display.strokeStyle = INK;
      ink.fillStyle = INK;
      ink.strokeStyle = INK;
    }

    function clearDisplay() {
      display.setTransform(1, 0, 0, 1, 0, 0);
      display.clearRect(0, 0, canvas.width, canvas.height);
      display.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function clearBuffer() {
      ink.setTransform(1, 0, 0, 1, 0, 0);
      ink.clearRect(0, 0, buffer.width, buffer.height);
      ink.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function compositeBuffer() {
      clearDisplay();
      display.setTransform(1, 0, 0, 1, 0, 0);
      display.drawImage(buffer, 0, 0);
      display.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function resizeCanvas(force = false) {
      if (!force && state !== STATES.IDLE) return;

      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width || window.innerWidth));
      height = Math.max(1, Math.round(rect.height || window.innerHeight));
      dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);

      const pixelWidth = Math.max(1, Math.round(width * dpr));
      const pixelHeight = Math.max(1, Math.round(height * dpr));
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      buffer.width = pixelWidth;
      buffer.height = pixelHeight;
      configureContexts();
      clearBuffer();
      clearDisplay();
    }

    function freezeCanvasSize() {
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    function unfreezeCanvasSize() {
      canvas.style.removeProperty('width');
      canvas.style.removeProperty('height');
    }

    function createModel(originInput) {
      const rng = rngFactory(seed);
      const origin = {
        x: Math.max(0, Math.min(width, originInput.x)),
        y: Math.max(0, Math.min(height, originInput.y)),
      };

      const targetTemplate = [
        [0.09, 0.11], [0.43, 0.08], [0.84, 0.14],
        [0.10, 0.36], [0.52, 0.31], [0.89, 0.40],
        [0.14, 0.66], [0.50, 0.60], [0.84, 0.67],
        [0.30, 0.86], [0.72, 0.84],
      ];

      const gravity = Math.max(720, Math.min(1120, height * 1.18));
      const projectiles = targetTemplate.map(([nx, ny], index) => {
        const jitterX = (rng() - 0.5) * width * 0.075;
        const jitterY = (rng() - 0.5) * height * 0.055;
        const impactX = Math.max(16, Math.min(width - 16, nx * width + jitterX));
        const impactY = Math.max(16, Math.min(height - 16, ny * height + jitterY));
        const launchDelay = index < 3 ? rng() * 45 : 35 + rng() * 115;
        const flightMs = 280 + rng() * 285;
        const t = flightMs / 1000;
        const vx = (impactX - origin.x) / t;
        const vy = (impactY - origin.y - 0.5 * gravity * t * t) / t;
        const radius = 24 + rng() * 39 + (index % 4 === 0 ? 14 : 0);
        const impactBlob = makeBlob(rng, radius, 12 + Math.floor(rng() * 6));
        const satellites = Array.from({ length: 2 + Math.floor(rng() * 4) }, () => ({
          angle: rng() * Math.PI * 2,
          distance: radius * (0.75 + rng() * 1.2),
          radius: 1.6 + rng() * Math.max(3.4, radius * 0.10),
          stretch: 0.72 + rng() * 0.65,
        }));
        const canDrip = impactY < height * 0.78 && (index === 1 || index === 3 || index === 4 || index === 5 || index === 7 || index === 8);

        return {
          index,
          launchDelay,
          flightMs,
          impactAt: launchDelay + flightMs,
          gravity,
          vx,
          vy,
          impactX,
          impactY,
          radius,
          impactBlob,
          satellites,
          impacted: false,
          bleedStep: 0,
          coverageStep: 0,
          coverMaxRadius: Math.max(width * 0.34, height * 0.255) * (0.91 + rng() * 0.24),
          drip: canDrip ? {
            delay: 260 + rng() * 330,
            buildUp: 120 + rng() * 120,
            duration: 650 + rng() * 500,
            gravity: 540 + rng() * 520,
            baseWidth: 3.5 + rng() * 5.8,
            drift: (rng() - 0.5) * 52,
            wave: 4 + rng() * 11,
            phase: rng() * Math.PI * 2,
            frequency: 2.1 + rng() * 2.7,
            lastX: null,
            lastY: null,
          } : null,
        };
      });

      return { origin, projectiles };
    }

    function projectilePosition(projectile, elapsed) {
      const localMs = Math.max(0, elapsed - projectile.launchDelay);
      const t = Math.min(localMs, projectile.flightMs) / 1000;
      return {
        x: model.origin.x + projectile.vx * t,
        y: model.origin.y + projectile.vy * t + 0.5 * projectile.gravity * t * t,
        vx: projectile.vx,
        vy: projectile.vy + projectile.gravity * t,
      };
    }

    function depositImpact(projectile) {
      if (projectile.impacted) return;
      projectile.impacted = true;

      fillBlob(ink, projectile.impactX, projectile.impactY, projectile.impactBlob, 1.10, 0.045, 1.035);
      fillBlob(ink, projectile.impactX, projectile.impactY, projectile.impactBlob, 1, 0.97, 1);

      projectile.satellites.forEach((satellite) => {
        const x = projectile.impactX + Math.cos(satellite.angle) * satellite.distance;
        const y = projectile.impactY + Math.sin(satellite.angle) * satellite.distance;
        ink.save();
        ink.translate(x, y);
        ink.rotate(satellite.angle);
        ink.globalAlpha = 0.8;
        ink.fillStyle = INK;
        ink.beginPath();
        ink.ellipse(0, 0, satellite.radius, satellite.radius * satellite.stretch, 0, 0, Math.PI * 2);
        ink.fill();
        ink.restore();
      });
    }

    function updateBleed(projectile, elapsed) {
      if (!projectile.impacted) return;

      const age = elapsed - projectile.impactAt;
      if (age <= 0) return;

      const targetStep = Math.min(10, Math.floor(age / BLEED_STEP_MS));
      while (projectile.bleedStep < targetStep) {
        projectile.bleedStep += 1;
        const step = projectile.bleedStep;
        const scale = 1 + step * 0.038;
        const edgeAlpha = 0.012 + step * 0.0014;
        const coreAlpha = 0.035 + step * 0.003;
        fillBlob(ink, projectile.impactX, projectile.impactY, projectile.impactBlob, scale * 1.055, edgeAlpha, 1.035);
        fillBlob(ink, projectile.impactX, projectile.impactY, projectile.impactBlob, scale, coreAlpha, 1.01);
      }
    }

    function dripPosition(projectile, elapsed) {
      const drip = projectile.drip;
      if (!drip) return null;

      const age = elapsed - projectile.impactAt - drip.delay;
      if (age <= 0) return null;

      const startX = projectile.impactX + (projectile.index % 2 ? -1 : 1) * projectile.radius * 0.08;
      const startY = projectile.impactY + projectile.radius * 0.34;
      const build = clamp01(age / drip.buildUp);
      const movingAge = Math.max(0, age - drip.buildUp);
      const t = Math.min(movingAge, drip.duration) / 1000;
      const moving = age >= drip.buildUp;
      const x = moving
        ? startX + drip.drift * t + Math.sin(t * drip.frequency * Math.PI + drip.phase) * drip.wave
        : startX;
      const y = moving ? startY + 0.5 * drip.gravity * t * t : startY;

      return {
        x,
        y,
        age,
        build,
        moving,
        t,
        done: movingAge >= drip.duration || y > height + 30,
      };
    }

    function updateDrip(projectile, elapsed) {
      const drip = projectile.drip;
      if (!drip || !projectile.impacted) return;

      const position = dripPosition(projectile, elapsed);
      if (!position || !position.moving) return;

      if (drip.lastX === null || drip.lastY === null) {
        drip.lastX = position.x;
        drip.lastY = position.y;
        return;
      }

      const speedFactor = clamp01(position.t / Math.max(0.35, drip.duration / 1000));
      const widthNow = drip.baseWidth * (0.94 - speedFactor * 0.22 + Math.sin(position.t * 8 + drip.phase) * 0.08);
      const midX = (drip.lastX + position.x) / 2 + Math.sin(position.t * 9 + drip.phase) * 1.8;
      const midY = (drip.lastY + position.y) / 2;

      ink.save();
      ink.globalAlpha = 0.93;
      ink.strokeStyle = INK;
      ink.lineCap = 'round';
      ink.lineJoin = 'round';
      ink.lineWidth = Math.max(1.4, widthNow);
      ink.beginPath();
      ink.moveTo(drip.lastX, drip.lastY);
      ink.quadraticCurveTo(midX, midY, position.x, position.y);
      ink.stroke();
      ink.restore();

      drip.lastX = position.x;
      drip.lastY = position.y;
    }

    function updateCoverage(projectile, elapsed) {
      if (!projectile.impacted || elapsed < 1080) return;

      const coverageProgress = clamp01((elapsed - 1080) / (COVERED_MS - 1080));
      const targetStep = Math.min(22, Math.floor(coverageProgress * 22));

      while (projectile.coverageStep < targetStep) {
        projectile.coverageStep += 1;
        const local = projectile.coverageStep / 22;
        const eased = easeInOutCubic(local);
        const radius = projectile.radius + (projectile.coverMaxRadius - projectile.radius) * eased;
        const scale = radius / projectile.radius;
        const alpha = 0.085 + eased * 0.075;

        fillBlob(ink, projectile.impactX, projectile.impactY, projectile.impactBlob, scale * 1.025, alpha * 0.36, 1.025);
        fillBlob(ink, projectile.impactX, projectile.impactY, projectile.impactBlob, scale, alpha, 1);

        if (local > 0.84) {
          fillBlob(ink, projectile.impactX, projectile.impactY, projectile.impactBlob, scale * 0.955, 0.19 + eased * 0.14, 1);
        }
      }
    }

    function drawProjectile(projectile, elapsed) {
      if (elapsed < projectile.launchDelay || elapsed >= projectile.impactAt) return;

      const position = projectilePosition(projectile, elapsed);
      const local = clamp01((elapsed - projectile.launchDelay) / projectile.flightMs);
      const speed = Math.hypot(position.vx, position.vy);
      const angle = Math.atan2(position.vy, position.vx);
      const baseRadius = Math.max(3.2, projectile.radius * 0.16);
      const length = baseRadius * (1.3 + Math.min(2.2, speed / 500));
      const widthNow = baseRadius * (0.68 + local * 0.16);

      display.save();
      display.translate(position.x, position.y);
      display.rotate(angle);
      display.fillStyle = INK;
      display.globalAlpha = 0.9;
      display.beginPath();
      display.ellipse(0, 0, length, widthNow, 0, 0, Math.PI * 2);
      display.fill();
      display.globalAlpha = 0.22;
      display.beginPath();
      display.ellipse(-length * 0.95, 0, length * 0.75, widthNow * 0.45, 0, 0, Math.PI * 2);
      display.fill();
      display.restore();
    }

    function drawDripHead(projectile, elapsed) {
      const drip = projectile.drip;
      if (!drip) return;
      const position = dripPosition(projectile, elapsed);
      if (!position || position.done) return;

      const ageProgress = clamp01(Math.max(0, position.age - drip.buildUp) / drip.duration);
      const radius = drip.baseWidth * (0.75 + position.build * 0.75 + ageProgress * 0.45);
      display.save();
      display.globalAlpha = 0.95;
      display.fillStyle = INK;
      display.beginPath();
      display.ellipse(position.x, position.y, radius, radius * 1.34, 0, 0, Math.PI * 2);
      display.fill();
      display.restore();
    }

    function updatePersistentInk(elapsed) {
      model.projectiles.forEach((projectile) => {
        if (elapsed >= projectile.impactAt) depositImpact(projectile);
        updateBleed(projectile, elapsed);
        updateDrip(projectile, elapsed);
        updateCoverage(projectile, elapsed);
      });
    }

    function drawTransient(elapsed) {
      model.projectiles.forEach((projectile) => {
        drawProjectile(projectile, elapsed);
        drawDripHead(projectile, elapsed);
      });
    }

    function render(elapsed) {
      updatePersistentInk(elapsed);
      compositeBuffer();
      drawTransient(elapsed);
    }

    function drawCoveredFrame() {
      clearDisplay();
      display.save();
      display.globalAlpha = 1;
      display.fillStyle = INK;
      display.fillRect(0, 0, width, height);
      display.restore();
    }

    function setCanvasVisible(visible) {
      canvas.classList.toggle('is-active', visible);
    }

    function finishCovered() {
      cancelAnimationFrame(frame);
      frame = 0;
      render(COVERED_MS - 1);
      drawCoveredFrame();
      state = STATES.COVERED;
      onCovered();
    }

    function tick(now) {
      if (![STATES.SPLASH, STATES.BLEED, STATES.COVERAGE].includes(state)) return;

      const elapsed = now - startedAt;
      const delta = lastFrameAt ? now - lastFrameAt : 16.7;
      lastFrameAt = now;
      void delta;

      if (elapsed < SPLASH_MS) state = STATES.SPLASH;
      else if (elapsed < BLEED_END_MS) state = STATES.BLEED;
      else state = STATES.COVERAGE;

      render(elapsed);

      if (elapsed >= COVERED_MS) {
        finishCovered();
        return;
      }

      frame = requestAnimationFrame(tick);
    }

    function start(origin) {
      if (state !== STATES.IDLE) return false;

      resizeCanvas(true);
      freezeCanvasSize();
      clearBuffer();
      clearDisplay();
      model = createModel(origin);
      released = false;
      setCanvasVisible(true);

      if (reducedMotion) {
        state = STATES.COVERED;
        drawCoveredFrame();
        onCovered();
        return true;
      }

      state = STATES.SPLASH;
      startedAt = performance.now();
      lastFrameAt = startedAt;
      frame = requestAnimationFrame(tick);
      return true;
    }

    function release() {
      if (state !== STATES.COVERED || released) return;
      released = true;
      state = STATES.DONE;

      const finish = () => {
        canvas.removeEventListener('transitionend', onTransitionEnd);
        canvas.classList.remove('is-releasing', 'is-active');
        unfreezeCanvasSize();
        clearBuffer();
        clearDisplay();
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

      window.setTimeout(() => {
        if (canvas.classList.contains('is-releasing')) finish();
      }, 650);
    }

    function reset() {
      cancelAnimationFrame(frame);
      frame = 0;
      released = false;
      startedAt = 0;
      lastFrameAt = 0;
      state = STATES.IDLE;
      model = null;
      canvas.classList.remove('is-releasing', 'is-active');
      unfreezeCanvasSize();
      resizeCanvas(true);
      clearBuffer();
      clearDisplay();
    }

    function onResize() {
      resizeCanvas();
    }

    function destroy() {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      clearBuffer();
      clearDisplay();
    }

    window.addEventListener('resize', onResize, { passive: true });
    resizeCanvas(true);

    return {
      start,
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

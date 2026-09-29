(() => {
  'use strict';

  const STATES = Object.freeze({
    IDLE: 'IDLE',
    SPLASH: 'SPLASH',
    MERGE: 'MERGE',
    COVERAGE: 'COVERAGE',
    COVERED: 'COVERED',
    DONE: 'DONE',
  });

  const clamp01 = (value) => Math.max(0, Math.min(1, value));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

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

  function quadraticPoint(a, b, c, t) {
    const u = 1 - t;
    return {
      x: u * u * a.x + 2 * u * t * b.x + t * t * c.x,
      y: u * u * a.y + 2 * u * t * b.y + t * t * c.y,
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
    const MERGE_END_MS = 1800;
    const COVERED_MS = 2720;
    const DPR_CAP = 2;
    const INK = '#0c0c0d';

    let state = STATES.IDLE;
    let frame = 0;
    let width = 1;
    let height = 1;
    let dpr = 1;
    let model = null;
    let startedAt = 0;
    let released = false;

    function makeBlob(rng, radius = 1, lobes = 15) {
      const points = [];
      const phase = rng() * Math.PI * 2;

      for (let index = 0; index < lobes; index += 1) {
        const angle = phase + (index / lobes) * Math.PI * 2;
        const wave = Math.sin(index * 1.73 + phase) * 0.05;
        const jitter = 0.80 + rng() * 0.31 + wave;
        points.push({ angle, radius: radius * jitter });
      }

      return points;
    }

    function pathOrganicBlob(context, cx, cy, points, radiusX, radiusY) {
      const vertices = points.map((point) => ({
        x: cx + Math.cos(point.angle) * point.radius * radiusX,
        y: cy + Math.sin(point.angle) * point.radius * radiusY,
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

    function fillOrganicBlob(context, x, y, radius, shape, sx = 1, sy = 1, alpha = 1) {
      if (radius <= 0.2) return;
      context.save();
      context.globalAlpha = alpha;
      context.fillStyle = INK;
      pathOrganicBlob(context, x, y, shape, radius * sx, radius * sy);
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

    function createMass(rng, data) {
      const radius = Math.max(3, data.radius);
      const sx = data.sx ?? (0.94 + rng() * 0.12);
      const sy = data.sy ?? (0.98 + rng() * 0.16);
      const startScale = data.startScale ?? 0.12;

      return {
        id: data.id,
        x: data.x,
        y: data.y,
        radius,
        sx,
        sy,
        shape: makeBlob(rng, 1, 14 + Math.floor(rng() * 5)),
        startAt: data.startAt,
        growMs: data.growMs,
        startScale,
        lastScale: 0,
        isCoverage: Boolean(data.isCoverage),
        bleedMarks: Array.from({ length: data.isCoverage ? 8 : 11 }, (_, index) => ({
          trigger: 0.58 + (index / (data.isCoverage ? 8 : 11)) * 0.34 + rng() * 0.035,
          angle: rng() * Math.PI * 2,
          size: 0.018 + rng() * 0.035,
          stretch: 0.68 + rng() * 0.72,
          deposited: false,
        })),
      };
    }

    function massProgress(mass, elapsed) {
      return clamp01((elapsed - mass.startAt) / Math.max(1, mass.growMs));
    }

    function massScaleAt(mass, elapsed) {
      const progress = massProgress(mass, elapsed);
      if (progress <= 0) return 0;
      return mass.startScale + easeOutCubic(progress) * (1 - mass.startScale);
    }

    function growthSpacing(mass) {
      return clamp(mass.radius * (mass.isCoverage ? 0.018 : 0.030), 1.8, mass.isCoverage ? 5.2 : 3.4);
    }

    function depositMassScale(mass, scale, alpha = 0.985) {
      fillOrganicBlob(ink, mass.x, mass.y, mass.radius * scale, mass.shape, mass.sx, mass.sy, alpha);
    }

    function updateMassGrowth(mass, elapsed) {
      const targetScale = massScaleAt(mass, elapsed);
      if (targetScale <= 0) return;

      if (mass.lastScale <= 0) {
        const initial = Math.min(targetScale, mass.startScale);
        depositMassScale(mass, initial);
        mass.lastScale = initial;
      }

      const maxAxis = mass.radius * Math.max(mass.sx, mass.sy);
      const spacing = growthSpacing(mass);
      let edgeGap = maxAxis * (targetScale - mass.lastScale);

      while (edgeGap >= spacing) {
        const nextScale = Math.min(targetScale, mass.lastScale + spacing / maxAxis);
        depositMassScale(mass, nextScale);
        mass.lastScale = nextScale;
        edgeGap = maxAxis * (targetScale - mass.lastScale);
      }

      if (massProgress(mass, elapsed) >= 1 && mass.lastScale < 0.999) {
        depositMassScale(mass, 1);
        mass.lastScale = 1;
      }

      const progress = massProgress(mass, elapsed);
      mass.bleedMarks.forEach((mark) => {
        if (mark.deposited || progress < mark.trigger) return;
        mark.deposited = true;
        const angle = mark.angle;
        const edgeRadius = mass.radius * mass.lastScale;
        const x = mass.x + Math.cos(angle) * edgeRadius * mass.sx * (0.93 + mark.size * 2.2);
        const y = mass.y + Math.sin(angle) * edgeRadius * mass.sy * (0.93 + mark.size * 2.2);
        const r = Math.max(1.4, mass.radius * mark.size);

        ink.save();
        ink.translate(x, y);
        ink.rotate(angle);
        ink.globalAlpha = mass.isCoverage ? 0.38 : 0.52;
        ink.fillStyle = INK;
        ink.beginPath();
        ink.ellipse(0, 0, r, r * mark.stretch, 0, 0, Math.PI * 2);
        ink.fill();
        ink.restore();
      });
    }

    function createTongue(rng, projectile, index) {
      if (!projectile.canGravity) return null;

      const drift = (rng() - 0.5) * Math.min(width * 0.18, 72);
      const travel = Math.min(height * (0.26 + rng() * 0.16), projectile.radius * (5.1 + rng() * 2.0));
      const start = {
        x: projectile.impactX + (rng() - 0.5) * projectile.radius * 0.18,
        y: projectile.impactY + projectile.radius * 0.25,
      };
      const end = {
        x: clamp(start.x + drift, -projectile.radius, width + projectile.radius),
        y: Math.min(height + projectile.radius * 0.8, start.y + travel),
      };
      const control = {
        x: start.x + drift * 0.30 + (rng() - 0.5) * projectile.radius * 0.45,
        y: start.y + travel * (0.42 + rng() * 0.08),
      };

      return {
        id: `t-${index}`,
        a: start,
        b: control,
        c: end,
        shape: makeBlob(rng, 1, 13 + Math.floor(rng() * 4)),
        startAt: projectile.impactAt + 220 + rng() * 110,
        duration: 860 + rng() * 410,
        startRadius: projectile.radius * (0.72 + rng() * 0.10),
        endRadius: projectile.radius * (0.44 + rng() * 0.10),
        sx: 0.90 + rng() * 0.12,
        sy: 1.02 + rng() * 0.14,
        lastT: 0,
        lastPoint: start,
        carryDistance: 0,
        sampleIndex: 0,
        flowPhase: rng() * Math.PI * 2,
      };
    }

    function tongueRadius(tongue, t) {
      const eased = easeInOutCubic(t);
      return tongue.startRadius * (1 - eased) + tongue.endRadius * eased;
    }

    function depositTongueLobe(tongue, point, t) {
      const baseRadius = tongueRadius(tongue, t);
      const derivative = {
        x: 2 * (1 - t) * (tongue.b.x - tongue.a.x) + 2 * t * (tongue.c.x - tongue.b.x),
        y: 2 * (1 - t) * (tongue.b.y - tongue.a.y) + 2 * t * (tongue.c.y - tongue.b.y),
      };
      const length = Math.max(1, Math.hypot(derivative.x, derivative.y));
      const normalX = -derivative.y / length;
      const normalY = derivative.x / length;
      const envelope = Math.sin(Math.PI * t);
      const lateral = envelope * baseRadius * (
        Math.sin(t * Math.PI * 2.25 + tongue.flowPhase) * 0.105
        + Math.sin(t * Math.PI * 4.7 + tongue.flowPhase * 0.63) * 0.038
      );
      const pulse = 1 + Math.sin(t * Math.PI * 5.1 + tongue.flowPhase) * 0.035;

      fillOrganicBlob(
        ink,
        point.x + normalX * lateral,
        point.y + normalY * lateral,
        baseRadius * pulse,
        tongue.shape,
        tongue.sx,
        tongue.sy * (1 + t * 0.10),
        0.975,
      );
      tongue.sampleIndex += 1;
    }

    function updateTongue(tongue, elapsed) {
      if (!tongue) return;
      const targetT = clamp01((elapsed - tongue.startAt) / Math.max(1, tongue.duration));
      if (targetT <= tongue.lastT) return;

      const deltaT = targetT - tongue.lastT;
      const segments = Math.max(3, Math.ceil(deltaT * 54));
      let previous = tongue.lastPoint;

      for (let index = 1; index <= segments; index += 1) {
        const t = tongue.lastT + deltaT * (index / segments);
        const point = quadraticPoint(tongue.a, tongue.b, tongue.c, t);
        const segmentDistance = Math.hypot(point.x - previous.x, point.y - previous.y);
        tongue.carryDistance += segmentDistance;

        const radius = tongueRadius(tongue, t);
        const spacing = clamp(radius * 0.105, 1.9, 4.6);

        if (tongue.carryDistance >= spacing) {
          depositTongueLobe(tongue, point, t);
          tongue.carryDistance %= spacing;
        }

        previous = point;
      }

      tongue.lastPoint = quadraticPoint(tongue.a, tongue.b, tongue.c, targetT);
      tongue.lastT = targetT;

      if (targetT >= 1 && tongue.sampleIndex === 0) {
        depositTongueLobe(tongue, tongue.c, 1);
      }
    }

    function createCoverageMasses(rng) {
      const maxSide = Math.max(width, height);
      const templates = [
        [-0.18, 0.24, 0.43, 1380],
        [1.17, 0.34, 0.44, 1435],
        [0.18, -0.18, 0.39, 1490],
        [0.82, -0.13, 0.38, 1545],
        [0.10, 1.12, 0.44, 1580],
        [0.88, 1.10, 0.46, 1630],
        [0.52, 0.61, 0.32, 1720],
      ];

      return templates.map(([nx, ny, relative, startAt], index) => createMass(rng, {
        id: `c-${index}`,
        x: nx * width + (rng() - 0.5) * width * 0.035,
        y: ny * height + (rng() - 0.5) * height * 0.028,
        radius: maxSide * relative * (0.94 + rng() * 0.09),
        sx: 0.94 + rng() * 0.12,
        sy: 0.96 + rng() * 0.12,
        startAt: startAt + rng() * 65,
        growMs: 900 + rng() * 260,
        startScale: 0.10,
        isCoverage: true,
      }));
    }

    function createModel(originInput) {
      const rng = rngFactory(seed);
      const origin = {
        x: clamp(originInput.x, 0, width),
        y: clamp(originInput.y, 0, height),
      };

      const targetTemplate = [
        [0.09, 0.11], [0.43, 0.08], [0.84, 0.14],
        [0.10, 0.36], [0.52, 0.31], [0.89, 0.40],
        [0.14, 0.66], [0.50, 0.60], [0.84, 0.67],
        [0.30, 0.86], [0.72, 0.84],
      ];

      const gravity = Math.max(720, Math.min(1120, height * 1.18));
      const impactMasses = [];
      const tongues = [];

      const projectiles = targetTemplate.map(([nx, ny], index) => {
        const jitterX = (rng() - 0.5) * width * 0.075;
        const jitterY = (rng() - 0.5) * height * 0.055;
        const impactX = clamp(nx * width + jitterX, 16, width - 16);
        const impactY = clamp(ny * height + jitterY, 16, height - 16);
        const launchDelay = index < 3 ? rng() * 45 : 35 + rng() * 115;
        const flightMs = 280 + rng() * 285;
        const t = flightMs / 1000;
        const vx = (impactX - origin.x) / t;
        const vy = (impactY - origin.y - 0.5 * gravity * t * t) / t;
        const radius = 24 + rng() * 39 + (index % 4 === 0 ? 14 : 0);
        const canGravity = impactY < height * 0.79 && [1, 3, 4, 5, 7, 8].includes(index);

        const projectile = {
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
          impacted: false,
          canGravity,
          satellites: Array.from({ length: 2 + Math.floor(rng() * 4) }, () => ({
            angle: rng() * Math.PI * 2,
            distance: radius * (0.75 + rng() * 1.2),
            radius: 1.6 + rng() * Math.max(3.4, radius * 0.10),
            stretch: 0.72 + rng() * 0.65,
          })),
        };

        const impactMass = createMass(rng, {
          id: `i-${index}`,
          x: impactX,
          y: impactY,
          radius,
          sx: 0.96 + rng() * 0.08,
          sy: 0.98 + rng() * 0.08,
          startAt: projectile.impactAt,
          growMs: 150 + rng() * 90,
          startScale: 0.24,
        });

        impactMasses.push(impactMass);
        tongues.push(createTongue(rng, projectile, index));
        return projectile;
      });

      const coverageMasses = createCoverageMasses(rng);
      const masses = [...impactMasses, ...coverageMasses];
      return {
        origin,
        projectiles,
        impactMasses,
        coverageMasses,
        masses,
        tongues: tongues.filter(Boolean),
      };
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

      const mass = model.impactMasses[projectile.index];
      if (mass) {
        const initialScale = Math.min(0.30, massScaleAt(mass, projectile.impactAt + 1) || 0.30);
        depositMassScale(mass, initialScale);
        mass.lastScale = Math.max(mass.lastScale, initialScale);
      }

      projectile.satellites.forEach((satellite) => {
        const x = projectile.impactX + Math.cos(satellite.angle) * satellite.distance;
        const y = projectile.impactY + Math.sin(satellite.angle) * satellite.distance;
        ink.save();
        ink.translate(x, y);
        ink.rotate(satellite.angle);
        ink.globalAlpha = 0.78;
        ink.fillStyle = INK;
        ink.beginPath();
        ink.ellipse(0, 0, satellite.radius, satellite.radius * satellite.stretch, 0, 0, Math.PI * 2);
        ink.fill();
        ink.restore();
      });
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

    function updatePersistentInk(elapsed) {
      model.projectiles.forEach((projectile) => {
        if (elapsed >= projectile.impactAt) depositImpact(projectile);
      });

      model.masses.forEach((mass) => updateMassGrowth(mass, elapsed));
      model.tongues.forEach((tongue) => updateTongue(tongue, elapsed));
    }

    function drawTransient(elapsed) {
      model.projectiles.forEach((projectile) => drawProjectile(projectile, elapsed));
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
      if (![STATES.SPLASH, STATES.MERGE, STATES.COVERAGE].includes(state)) return;

      const elapsed = now - startedAt;

      if (elapsed < SPLASH_MS) state = STATES.SPLASH;
      else if (elapsed < MERGE_END_MS) state = STATES.MERGE;
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

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
    const MERGE_END_MS = 1760;
    const COVERED_MS = 2700;
    const DPR_CAP = 2;
    const INK = '#0c0c0d';

    const MASS_GROW_STEPS = 7;
    const MASS_BLEED_STEPS = 5;
    const MAX_MERGE_CONNECTIONS = 3;

    let state = STATES.IDLE;
    let frame = 0;
    let width = 1;
    let height = 1;
    let dpr = 1;
    let model = null;
    let startedAt = 0;
    let released = false;

    function makeBlob(rng, radius, lobes = 15) {
      const points = [];
      const phase = rng() * Math.PI * 2;

      for (let index = 0; index < lobes; index += 1) {
        const angle = phase + (index / lobes) * Math.PI * 2;
        const wave = Math.sin(index * 1.73 + phase) * 0.055;
        const jitter = 0.78 + rng() * 0.34 + wave;
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

    function fillBlob(context, node, scale = 1, alpha = 1) {
      context.save();
      context.globalAlpha = alpha;
      context.fillStyle = INK;
      pathBlob(
        context,
        node.x,
        node.y,
        node.shape,
        node.sx * scale,
        node.sy * scale,
      );
      context.fill();
      context.restore();
    }

    function drawMassBridge(context, a, b, widthScale = 1, alpha = 0.96) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 0.5) return;

      const ux = dx / distance;
      const uy = dy / distance;
      const px = -uy;
      const py = ux;
      const bend = ((a.bridgeBias || 0) + (b.bridgeBias || 0)) * 0.5;
      const bendMagnitude = Math.min(16, distance * 0.09) * bend;
      const midX = (a.x + b.x) / 2 + px * bendMagnitude;
      const midY = (a.y + b.y) / 2 + py * bendMagnitude;
      const neckWidth = Math.max(
        5,
        Math.min(a.radius, b.radius) * (0.92 + Math.min(widthScale, 1.25) * 0.22),
      );

      context.save();
      context.globalAlpha = alpha;
      context.strokeStyle = INK;
      context.lineWidth = neckWidth * widthScale;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.quadraticCurveTo(midX, midY, b.x, b.y);
      context.stroke();
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

    function createMassNode(rng, data) {
      const radius = Math.max(3, data.radius);
      return {
        id: data.id,
        clusterId: data.clusterId,
        parentId: data.parentId ?? null,
        x: data.x,
        y: data.y,
        radius,
        sx: data.sx ?? (0.92 + rng() * 0.16),
        sy: data.sy ?? (0.98 + rng() * 0.22),
        shape: makeBlob(rng, radius, 12 + Math.floor(rng() * 5)),
        bridgeBias: rng() * 2 - 1,
        startAt: data.startAt,
        growMs: data.growMs ?? (150 + rng() * 90),
        growStep: 0,
        bleedStep: 0,
        deposited: false,
        connected: false,
        isCoverage: Boolean(data.isCoverage),
      };
    }

    function createGravityChain(rng, projectile, impactNode, chainIndex) {
      if (!projectile.canGravity) return [];

      const nodes = [];
      const count = 6 + Math.floor(rng() * 3);
      let parent = impactNode;
      let x = impactNode.x + (rng() - 0.5) * impactNode.radius * 0.22;
      let y = impactNode.y + impactNode.radius * 0.48;
      let radius = impactNode.radius * (0.74 + rng() * 0.08);
      const drift = (rng() - 0.5) * Math.min(28, width * 0.05);

      for (let index = 0; index < count; index += 1) {
        const stepY = radius * (0.30 + rng() * 0.13);
        x += drift * (0.12 + index * 0.02) + (rng() - 0.5) * radius * 0.22;
        y += stepY;
        radius *= 0.94 + rng() * 0.035;

        if (y > height + radius * 0.4) break;

        const node = createMassNode(rng, {
          id: `g-${chainIndex}-${index}`,
          clusterId: impactNode.clusterId,
          parentId: parent.id,
          x,
          y,
          radius,
          sx: 0.90 + rng() * 0.16,
          sy: 1.06 + rng() * 0.18,
          startAt: projectile.impactAt + 290 + index * (104 + rng() * 36),
          growMs: 210 + rng() * 90,
        });

        nodes.push(node);
        parent = node;
      }

      return nodes;
    }

    function createCoverageNodes(rng, impactNodes, gravityNodes) {
      const candidates = [
        [-0.04, 0.12, 0.21], [0.27, 0.08, 0.20], [0.62, 0.11, 0.21], [1.04, 0.15, 0.22],
        [0.10, 0.38, 0.22], [0.42, 0.34, 0.21], [0.76, 0.38, 0.21], [1.02, 0.42, 0.22],
        [-0.02, 0.65, 0.22], [0.30, 0.63, 0.21], [0.60, 0.62, 0.22], [0.90, 0.66, 0.21],
        [0.10, 0.91, 0.23], [0.46, 0.90, 0.22], [0.78, 0.92, 0.24], [1.05, 0.90, 0.23],
      ];

      const allExisting = [...impactNodes, ...gravityNodes];

      return candidates.map(([nx, ny, relative], index) => {
        const x = nx * width + (rng() - 0.5) * width * 0.055;
        const y = ny * height + (rng() - 0.5) * height * 0.045;
        const radius = Math.max(width, height) * relative * (0.86 + rng() * 0.14);

        let nearest = allExisting[0];
        let nearestDistance = Infinity;
        allExisting.forEach((node) => {
          const distance = Math.hypot(node.x - x, node.y - y);
          if (distance < nearestDistance) {
            nearest = node;
            nearestDistance = distance;
          }
        });

        const node = createMassNode(rng, {
          id: `c-${index}`,
          clusterId: `coverage-${index}`,
          parentId: nearest?.id ?? null,
          x,
          y,
          radius,
          sx: 0.94 + rng() * 0.12,
          sy: 0.96 + rng() * 0.15,
          startAt: 1580 + index * 66 + rng() * 80,
          growMs: 520 + rng() * 190,
          isCoverage: true,
        });

        allExisting.push(node);
        return node;
      });
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
      const massNodes = [];
      const impactNodes = [];
      const gravityNodes = [];
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

        const impactNode = createMassNode(rng, {
          id: `i-${index}`,
          clusterId: `impact-${index}`,
          x: impactX,
          y: impactY,
          radius,
          sx: 0.96 + rng() * 0.08,
          sy: 0.98 + rng() * 0.08,
          startAt: projectile.impactAt,
          growMs: 135 + rng() * 75,
        });

        impactNodes.push(impactNode);
        massNodes.push(impactNode);

        const chain = createGravityChain(rng, projectile, impactNode, index);
        gravityNodes.push(...chain);
        massNodes.push(...chain);

        return projectile;
      });

      const coverageNodes = createCoverageNodes(rng, impactNodes, gravityNodes);
      massNodes.push(...coverageNodes);

      return {
        origin,
        projectiles,
        massNodes,
        impactNodes,
        gravityNodes,
        coverageNodes,
        depositedNodes: [],
        nodeById: new Map(massNodes.map((node) => [node.id, node])),
        bridgeKeys: new Set(),
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

    function bridgeKey(a, b) {
      return a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
    }

    function drawPermanentBridge(a, b, widthScale = 1, alpha = 0.94) {
      const key = bridgeKey(a, b);
      if (model.bridgeKeys.has(key)) return;
      model.bridgeKeys.add(key);

      drawMassBridge(ink, a, b, widthScale * 1.08, 0.055);
      drawMassBridge(ink, a, b, widthScale, alpha);
    }

    function connectNearbyMasses(node) {
      const candidates = [];

      model.depositedNodes.forEach((other) => {
        if (other.id === node.id) return;
        const distance = Math.hypot(other.x - node.x, other.y - node.y);
        const sumRadius = other.radius + node.radius;
        const sameCluster = other.clusterId === node.clusterId;
        if (sameCluster) return;

        const reach = sumRadius * 0.78;
        if (distance <= reach && distance >= sumRadius * 0.34) {
          candidates.push({ other, distance, sumRadius, sameCluster: false });
        }
      });

      candidates
        .sort((a, b) => a.distance - b.distance)
        .slice(0, MAX_MERGE_CONNECTIONS)
        .forEach(({ other, distance, sumRadius, sameCluster }) => {
          const proximity = clamp01(1 - distance / Math.max(sumRadius * 1.22, 1));
          const widthScale = (sameCluster ? 1.04 : 0.80) + proximity * 0.20;
          drawPermanentBridge(node, other, widthScale, sameCluster ? 0.96 : 0.91);
        });
    }

    function depositMassNode(node, scale = 1) {
      fillBlob(ink, node, scale * 1.075, 0.045);
      fillBlob(ink, node, scale, 0.97);
    }

    function beginMassNode(node) {
      if (node.deposited) return;
      node.deposited = true;
      model.depositedNodes.push(node);

      if (node.parentId && !node.isCoverage) {
        const parent = model.nodeById.get(node.parentId);
        if (parent?.deposited) {
          const distance = Math.hypot(parent.x - node.x, parent.y - node.y);
          const mergeLimit = (parent.radius + node.radius) * 1.48;
          if (distance <= mergeLimit) {
            drawPermanentBridge(parent, node, 1.12, 0.95);
          }
        }
      }

      connectNearbyMasses(node);
    }

    function updateMassNode(node, elapsed) {
      const age = elapsed - node.startAt;
      if (age < 0) return;

      beginMassNode(node);

      const growProgress = clamp01(age / Math.max(node.growMs, 1));
      const targetGrowStep = Math.min(MASS_GROW_STEPS, Math.floor(growProgress * MASS_GROW_STEPS));
      while (node.growStep < targetGrowStep) {
        node.growStep += 1;
        const local = node.growStep / MASS_GROW_STEPS;
        const scale = 0.20 + easeOutCubic(local) * 0.80;
        depositMassNode(node, scale);

        if (node.parentId && node.growStep >= 2) {
          const parent = model.nodeById.get(node.parentId);
          if (parent?.deposited) {
            drawMassBridge(ink, parent, node, Math.min(1, scale * 1.05), 0.20 + local * 0.10);
          }
        }
      }

      const bleedAge = age - node.growMs * 0.72;
      if (bleedAge <= 0) return;

      const targetBleedStep = Math.min(MASS_BLEED_STEPS, Math.floor(bleedAge / 82));
      while (node.bleedStep < targetBleedStep) {
        node.bleedStep += 1;
        const step = node.bleedStep;
        fillBlob(ink, node, 1 + step * 0.032, 0.018 + step * 0.0025);
      }
    }

    function depositImpact(projectile) {
      if (projectile.impacted) return;
      projectile.impacted = true;

      const node = model.nodeById.get(`i-${projectile.index}`);
      if (node) {
        beginMassNode(node);
        depositMassNode(node, 0.36);
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

      model.massNodes.forEach((node) => updateMassNode(node, elapsed));
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

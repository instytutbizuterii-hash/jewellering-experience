(() => {
  'use strict';

  const STATES = Object.freeze({
    IDLE: 'IDLE',
    SPLASH: 'SPLASH',
    FLOW: 'FLOW',
    SATURATION: 'SATURATION',
    COVERED: 'COVERED',
    DONE: 'DONE',
  });

  const clamp01 = (value) => Math.max(0, Math.min(1, value));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;

  function easeOutCubic(value) {
    const x = clamp01(value);
    return 1 - Math.pow(1 - x, 3);
  }

  function easeInOutCubic(value) {
    const x = clamp01(value);
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  function smoothstep(edge0, edge1, value) {
    if (edge0 === edge1) return value >= edge1 ? 1 : 0;
    const x = clamp01((value - edge0) / (edge1 - edge0));
    return x * x * (3 - 2 * x);
  }

  function normalize(x, y) {
    const length = Math.hypot(x, y) || 1;
    return { x: x / length, y: y / length };
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
    const SATURATION_START_MS = 1080;
    const SATURATION_FULL_MS = 2920;
    const MIN_COVERED_MS = 2280;
    const WATCHDOG_MS = 4400;
    const ANALYZE_INTERVAL_MS = 90;
    const COVERAGE_TARGET = 0.992;
    const MAX_BRIGHT_ISLAND_RATIO = 0.0045;
    const DPR_CAP = 2;
    const INK = '#0c0c0d';

    let state = STATES.IDLE;
    let frame = 0;
    let width = 1;
    let height = 1;
    let dpr = 1;
    let model = null;
    let tracker = null;
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

    function createCoverageTracker() {
      const cellSize = clamp(Math.round(Math.min(width, height) / 30), 12, 18);
      const cols = Math.max(1, Math.ceil(width / cellSize));
      const rows = Math.max(1, Math.ceil(height / cellSize));
      const values = new Float32Array(cols * rows);
      let lastAnalysisAt = -Infinity;
      let cached = {
        coverageRatio: 0,
        largestBrightIslandRatio: 1,
        largestBrightCentroid: { x: width / 2, y: height / 2 },
      };

      function markEllipse(cx, cy, rx, ry, alpha = 1) {
        const safeRx = Math.max(1, rx * 0.90);
        const safeRy = Math.max(1, ry * 0.90);
        const minCol = clamp(Math.floor((cx - safeRx) / cellSize), 0, cols - 1);
        const maxCol = clamp(Math.ceil((cx + safeRx) / cellSize), 0, cols - 1);
        const minRow = clamp(Math.floor((cy - safeRy) / cellSize), 0, rows - 1);
        const maxRow = clamp(Math.ceil((cy + safeRy) / cellSize), 0, rows - 1);

        for (let row = minRow; row <= maxRow; row += 1) {
          const py = Math.min(height - 0.5, row * cellSize + cellSize * 0.5);
          const ny = (py - cy) / safeRy;
          for (let col = minCol; col <= maxCol; col += 1) {
            const px = Math.min(width - 0.5, col * cellSize + cellSize * 0.5);
            const nx = (px - cx) / safeRx;
            const distance = Math.hypot(nx, ny);
            if (distance >= 1.03) continue;

            const core = 1 - smoothstep(0.62, 1.03, distance);
            const contribution = clamp01(core * alpha);
            const cellIndex = row * cols + col;
            values[cellIndex] = 1 - (1 - values[cellIndex]) * (1 - contribution);
          }
        }
      }

      function analyze(elapsed, force = false) {
        if (!force && elapsed - lastAnalysisAt < ANALYZE_INTERVAL_MS) return cached;
        lastAnalysisAt = elapsed;

        const total = values.length;
        let weightedCoverage = 0;
        const bright = new Uint8Array(total);

        for (let index = 0; index < total; index += 1) {
          const value = values[index];
          weightedCoverage += clamp01((value - 0.14) / 0.72);
          bright[index] = value < 0.56 ? 1 : 0;
        }

        let largestCount = 0;
        let largestSumX = 0;
        let largestSumY = 0;
        const visited = new Uint8Array(total);
        const queue = new Int32Array(total);
        const directions = [
          [-1, -1], [0, -1], [1, -1],
          [-1, 0],            [1, 0],
          [-1, 1],  [0, 1],  [1, 1],
        ];

        for (let start = 0; start < total; start += 1) {
          if (!bright[start] || visited[start]) continue;

          let head = 0;
          let tail = 0;
          let count = 0;
          let sumX = 0;
          let sumY = 0;
          queue[tail++] = start;
          visited[start] = 1;

          while (head < tail) {
            const current = queue[head++];
            const row = Math.floor(current / cols);
            const col = current - row * cols;
            count += 1;
            sumX += Math.min(width - 0.5, col * cellSize + cellSize * 0.5);
            sumY += Math.min(height - 0.5, row * cellSize + cellSize * 0.5);

            directions.forEach(([dx, dy]) => {
              const nextCol = col + dx;
              const nextRow = row + dy;
              if (nextCol < 0 || nextCol >= cols || nextRow < 0 || nextRow >= rows) return;
              const next = nextRow * cols + nextCol;
              if (!bright[next] || visited[next]) return;
              visited[next] = 1;
              queue[tail++] = next;
            });
          }

          if (count > largestCount) {
            largestCount = count;
            largestSumX = sumX;
            largestSumY = sumY;
          }
        }

        cached = {
          coverageRatio: weightedCoverage / total,
          largestBrightIslandRatio: largestCount / total,
          largestBrightCentroid: largestCount
            ? { x: largestSumX / largestCount, y: largestSumY / largestCount }
            : null,
        };
        return cached;
      }

      return { markEllipse, analyze };
    }

    function depositOrganicBlob(x, y, radius, shape, sx = 1, sy = 1, alpha = 1) {
      fillOrganicBlob(ink, x, y, radius, shape, sx, sy, alpha);
      if (tracker) tracker.markEllipse(x, y, radius * sx, radius * sy, Math.min(1, alpha * 1.02));
    }

    function depositEllipse(x, y, radiusX, radiusY, rotation = 0, alpha = 1) {
      ink.save();
      ink.translate(x, y);
      ink.rotate(rotation);
      ink.globalAlpha = alpha;
      ink.fillStyle = INK;
      ink.beginPath();
      ink.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
      ink.fill();
      ink.restore();
      if (tracker) tracker.markEllipse(x, y, radiusX, radiusY, Math.min(1, alpha));
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
        saturationDelay: rng() * 190,
        saturationMaxScale: 2.58 + rng() * 0.56,
        saturationScale: 1,
        bleedMarks: Array.from({ length: 11 }, (_, index) => ({
          trigger: 0.58 + (index / 11) * 0.34 + rng() * 0.035,
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

    function depositMassScale(mass, scale, alpha = 0.985) {
      depositOrganicBlob(mass.x, mass.y, mass.radius * scale, mass.shape, mass.sx, mass.sy, alpha);
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
      const spacing = clamp(mass.radius * 0.030, 1.8, 3.4);
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
        const radius = Math.max(1.4, mass.radius * mark.size);
        depositEllipse(x, y, radius, radius * mark.stretch, angle, 0.52);
      });
    }

    function updateMassSaturation(mass, elapsed) {
      if (elapsed < SATURATION_START_MS + mass.saturationDelay || mass.lastScale < 0.999) return;

      const local = smoothstep(
        SATURATION_START_MS + mass.saturationDelay,
        SATURATION_FULL_MS + mass.saturationDelay * 0.20,
        elapsed,
      );
      const targetScale = 1 + (mass.saturationMaxScale - 1) * local;
      if (targetScale <= mass.saturationScale) return;

      const maxAxis = mass.radius * Math.max(mass.sx, mass.sy);
      const spacing = clamp(mass.radius * 0.040, 2.4, 5.0);
      let edgeGap = maxAxis * (targetScale - mass.saturationScale);

      while (edgeGap >= spacing) {
        const nextScale = Math.min(targetScale, mass.saturationScale + spacing / maxAxis);
        depositMassScale(mass, nextScale, 0.965);
        mass.saturationScale = nextScale;
        edgeGap = maxAxis * (targetScale - mass.saturationScale);
      }
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

      depositOrganicBlob(
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

    function createFrontier(rng, projectile, index, branch = 0) {
      const centerAngle = Math.atan2(projectile.impactY - height * 0.50, projectile.impactX - width * 0.50);
      const branchOffset = branch === 0 ? 0 : (branch % 2 ? 1 : -1) * (0.78 + rng() * 0.48);
      const baseAngle = centerAngle + branchOffset + (rng() - 0.5) * 0.62;
      const startOffset = projectile.radius * (0.12 + rng() * 0.12);
      const start = {
        x: projectile.impactX + Math.cos(baseAngle) * startOffset,
        y: projectile.impactY + Math.sin(baseAngle) * startOffset,
      };

      return {
        id: `f-${index}-${branch}`,
        x: start.x,
        y: start.y,
        baseAngle,
        baseSpeed: 82 + rng() * 52,
        baseRadius: projectile.radius * (0.62 + rng() * 0.16),
        shape: makeBlob(rng, 1, 13 + Math.floor(rng() * 4)),
        sx: 0.94 + rng() * 0.10,
        sy: 1.00 + rng() * 0.16,
        startAt: projectile.impactAt + 390 + rng() * 180 + branch * 90,
        lastElapsed: null,
        carryDistance: 0,
        phase: rng() * Math.PI * 2,
        started: false,
      };
    }

    function depositFrontierSegment(frontier, from, to, radius, saturation) {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= 0.001) return;

      const spacing = clamp(radius * lerp(0.16, 0.10, saturation), 2.4, 6.0);
      let remaining = distance;
      let cursorX = from.x;
      let cursorY = from.y;
      let dirX = dx / distance;
      let dirY = dy / distance;
      let nextDistance = spacing - frontier.carryDistance;

      while (remaining >= nextDistance) {
        cursorX += dirX * nextDistance;
        cursorY += dirY * nextDistance;
        const pulse = 1 + Math.sin(frontier.phase + frontier.carryDistance * 0.09 + cursorY * 0.012) * 0.045;
        depositOrganicBlob(
          cursorX,
          cursorY,
          radius * pulse,
          frontier.shape,
          frontier.sx,
          frontier.sy * lerp(1.08, 0.98, saturation),
          0.972,
        );
        remaining -= nextDistance;
        frontier.carryDistance = 0;
        nextDistance = spacing;
      }

      frontier.carryDistance += remaining;
    }

    function frontierDirection(frontier, elapsed, saturation, metrics) {
      const wobble = Math.sin(elapsed * 0.00135 + frontier.phase) * lerp(0.30, 0.18, saturation);
      const base = {
        x: Math.cos(frontier.baseAngle + wobble),
        y: Math.sin(frontier.baseAngle + wobble),
      };
      const gravityWeight = lerp(0.76, 0.14, saturation);
      const baseWeight = lerp(0.90, 0.42, saturation);
      const holeWeight = metrics?.largestBrightCentroid
        ? lerp(0, 1.28, saturation * saturation)
        : 0;

      let hole = { x: 0, y: 0 };
      if (metrics?.largestBrightCentroid) {
        hole = normalize(
          metrics.largestBrightCentroid.x - frontier.x,
          metrics.largestBrightCentroid.y - frontier.y,
        );
      }

      const edgeMargin = Math.max(28, frontier.baseRadius * 1.4);
      let edgeX = 0;
      let edgeY = 0;
      if (frontier.x < edgeMargin) edgeX += (edgeMargin - frontier.x) / edgeMargin;
      if (frontier.x > width - edgeMargin) edgeX -= (frontier.x - (width - edgeMargin)) / edgeMargin;
      if (frontier.y < edgeMargin) edgeY += (edgeMargin - frontier.y) / edgeMargin;
      if (frontier.y > height - edgeMargin) edgeY -= (frontier.y - (height - edgeMargin)) / edgeMargin;

      return normalize(
        base.x * baseWeight + hole.x * holeWeight + edgeX * 0.74,
        base.y * baseWeight + gravityWeight + hole.y * holeWeight + edgeY * 0.74,
      );
    }

    function updateFrontier(frontier, elapsed, metrics) {
      if (elapsed < frontier.startAt) return;

      if (!frontier.started) {
        frontier.started = true;
        frontier.lastElapsed = frontier.startAt;
        depositOrganicBlob(
          frontier.x,
          frontier.y,
          frontier.baseRadius,
          frontier.shape,
          frontier.sx,
          frontier.sy,
          0.975,
        );
      }

      let remainingMs = Math.max(0, elapsed - frontier.lastElapsed);
      if (remainingMs <= 0) return;
      remainingMs = Math.min(remainingMs, 180);

      while (remainingMs > 0) {
        const stepMs = Math.min(remainingMs, 24);
        const stepEnd = frontier.lastElapsed + stepMs;
        const saturation = smoothstep(SATURATION_START_MS, SATURATION_FULL_MS, stepEnd);
        const rescue = smoothstep(SATURATION_FULL_MS, WATCHDOG_MS - 180, stepEnd);
        const direction = frontierDirection(frontier, stepEnd, saturation, metrics);
        const speed = frontier.baseSpeed * (0.88 + saturation * 1.78 + rescue * 1.18);
        const radius = frontier.baseRadius * (1 + saturation * 1.16 + rescue * 0.52);
        const from = { x: frontier.x, y: frontier.y };
        const to = {
          x: clamp(frontier.x + direction.x * speed * (stepMs / 1000), -radius * 0.45, width + radius * 0.45),
          y: clamp(frontier.y + direction.y * speed * (stepMs / 1000), -radius * 0.45, height + radius * 0.45),
        };

        depositFrontierSegment(frontier, from, to, radius, saturation);
        frontier.x = to.x;
        frontier.y = to.y;
        frontier.lastElapsed = stepEnd;
        remainingMs -= stepMs;
      }
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

      const frontiers = [];
      projectiles.forEach((projectile, index) => {
        frontiers.push(createFrontier(rng, projectile, index, 0));
        if ([0, 2, 4, 6, 8, 10].includes(index)) frontiers.push(createFrontier(rng, projectile, index, 1));
      });

      return {
        origin,
        projectiles,
        impactMasses,
        tongues: tongues.filter(Boolean),
        frontiers,
        coverageMetrics: {
          coverageRatio: 0,
          largestBrightIslandRatio: 1,
          largestBrightCentroid: { x: width / 2, y: height / 2 },
        },
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
        depositEllipse(
          x,
          y,
          satellite.radius,
          satellite.radius * satellite.stretch,
          satellite.angle,
          0.78,
        );
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

      model.impactMasses.forEach((mass) => {
        updateMassGrowth(mass, elapsed);
        updateMassSaturation(mass, elapsed);
      });
      model.tongues.forEach((tongue) => updateTongue(tongue, elapsed));

      model.coverageMetrics = tracker.analyze(elapsed);
      model.frontiers.forEach((frontier) => updateFrontier(frontier, elapsed, model.coverageMetrics));
      model.coverageMetrics = tracker.analyze(elapsed);
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

    function isGeometryCovered(metrics) {
      return metrics
        && metrics.coverageRatio >= COVERAGE_TARGET
        && metrics.largestBrightIslandRatio <= MAX_BRIGHT_ISLAND_RATIO;
    }

    function finishCovered(elapsed, reason) {
      cancelAnimationFrame(frame);
      frame = 0;
      render(elapsed);
      drawCoveredFrame();
      state = STATES.COVERED;
      canvas.dataset.inkCompletion = reason;
      canvas.dataset.inkCoverage = model?.coverageMetrics
        ? model.coverageMetrics.coverageRatio.toFixed(4)
        : '';
      canvas.dataset.inkLargestIsland = model?.coverageMetrics
        ? model.coverageMetrics.largestBrightIslandRatio.toFixed(4)
        : '';
      onCovered();
    }

    function tick(now) {
      if (![STATES.SPLASH, STATES.FLOW, STATES.SATURATION].includes(state)) return;

      const elapsed = now - startedAt;
      if (elapsed < SPLASH_MS) state = STATES.SPLASH;
      else if (elapsed < SATURATION_START_MS) state = STATES.FLOW;
      else state = STATES.SATURATION;

      render(elapsed);

      if (elapsed >= MIN_COVERED_MS && isGeometryCovered(model.coverageMetrics)) {
        finishCovered(elapsed, 'geometry');
        return;
      }

      if (elapsed >= WATCHDOG_MS) {
        finishCovered(elapsed, 'watchdog');
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
      tracker = createCoverageTracker();
      model = createModel(origin);
      released = false;
      canvas.removeAttribute('data-ink-completion');
      canvas.removeAttribute('data-ink-coverage');
      canvas.removeAttribute('data-ink-largest-island');
      setCanvasVisible(true);

      if (reducedMotion) {
        state = STATES.COVERED;
        drawCoveredFrame();
        canvas.dataset.inkCompletion = 'reduced-motion';
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
        tracker = null;
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
      tracker = null;
      canvas.classList.remove('is-releasing', 'is-active');
      canvas.removeAttribute('data-ink-completion');
      canvas.removeAttribute('data-ink-coverage');
      canvas.removeAttribute('data-ink-largest-island');
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
      tracker = null;
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

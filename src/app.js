const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const intro = document.querySelector('#intro');
const experience = document.querySelector('#experience');
const enterButton = document.querySelector('#enterButton');
const holdInk = enterButton?.querySelector('.hold-button-ink');
const themeColor = document.querySelector('meta[name="theme-color"]');
const matteSprite = document.querySelector('#inkMatte');
const matteFallback = document.querySelector('#matteFallback');

const wordmark = document.querySelector('#wordmark');
const wordmarkStrokes = Array.from(document.querySelectorAll('.wordmark-stroke'));
const wordmarkMarks = Array.from(document.querySelectorAll('.wordmark-mark'));

const storyStage = document.querySelector('#storyStage');
const storyWorld = document.querySelector('#storyWorld');
const storyMasterImage = document.querySelector('#storyMasterImage');
const storyPanel = document.querySelector('#storyPanel');
const storyStep = document.querySelector('#storyStep');
const storySection = document.querySelector('#storySection');
const storyTitle = document.querySelector('#storyTitle');
const storyText = document.querySelector('#storyText');
const storyNext = document.querySelector('#storyNext');
const storyNextIcon = document.querySelector('#storyNextIcon');
const storyProgressDots = Array.from(document.querySelectorAll('#storyProgress span'));
const storyImageReady = new Promise((resolve) => {
  if (storyMasterImage.complete && storyMasterImage.naturalWidth > 0) {
    resolve();
    return;
  }
  storyMasterImage.addEventListener('load', resolve, { once: true });
  storyMasterImage.addEventListener('error', resolve, { once: true });
});

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const HANDWRITING_TARGET_DURATION = 3400;
const HANDWRITING_START_DELAY = 340;
const HOLD_INK_FRAME_COUNT = 24;
const HOLD_INK_ATLAS_COLUMNS = 6;
const HOLD_INK_ATLAS_ROWS = 4;
const STORY_CAMERA_MS = reducedMotion ? 0 : 1280;
const STORY_PANEL_HIDE_MS = reducedMotion ? 0 : 180;
const STORY_REVEAL_MS = reducedMotion ? 0 : 900;
const STORY_IMAGE_WIDTH = 1448;
const STORY_IMAGE_HEIGHT = 1086;

/*
 * The camera follows the approved non-linear path across one master scene.
 * x/y are normalized focal points inside the 1448×1086 artwork.
 */
const STORY_STOPS = [
  {
    section: 'Historia',
    title: 'Początek opowieści',
    text: 'Każdy detal może stać się początkiem własnej historii.',
    x: 0.23,
    y: 0.78,
    zoom: 1.42,
  },
  {
    section: 'Inspiracja',
    title: 'To, od czego wszystko się zaczyna',
    text: 'Forma, wspomnienie i przypadkowy detal potrafią wyznaczyć kierunek.',
    x: 0.36,
    y: 0.15,
    zoom: 1.38,
  },
  {
    section: 'Nosisz po swojemu',
    title: 'Blisko Ciebie',
    text: 'Biżuteria zmienia się razem z osobą, która nadaje jej własny rytm.',
    x: 0.61,
    y: 0.28,
    zoom: 1.45,
  },
  {
    section: 'Ręcznie',
    title: 'Detal, który zostaje',
    text: 'Rzemiosło zostawia ślad — w proporcji, wykończeniu i drobnych decyzjach.',
    x: 0.84,
    y: 0.76,
    zoom: 1.48,
  },
  {
    section: 'Więcej niż biżuteria',
    title: 'Mały symbol. Wielka historia.',
    text: 'To, co nosimy, może znaczyć więcej niż sam przedmiot.',
    x: 0.87,
    y: 0.22,
    zoom: 1.42,
  },
];

let entered = false;
let introRunId = 0;
let introTimers = [];
let handwritingPrepared = false;
let handwritingStrokeData = [];
let handwritingMarkData = [];
let storyIndex = 0;
let storyMoving = false;
let storyBaseWidth = 0;
let storyBaseHeight = 0;
let storyTransitionTimer = 0;
let storyRevealTimer = 0;

function clearIntroTimers() {
  introTimers.forEach(window.clearTimeout);
  introTimers = [];
}

function scheduleIntro(callback, delay, runId) {
  const timer = window.setTimeout(() => {
    if (runId === introRunId) callback();
  }, delay);
  introTimers.push(timer);
}

function easeWriting(value) {
  const progress = clamp(value);
  return progress * progress * (3 - 2 * progress);
}

function prepareWordmark() {
  handwritingStrokeData = wordmarkStrokes.map((path) => {
    const length = Math.max(path.getTotalLength(), 1);
    const start = Number(path.dataset.start ?? 0);
    const end = Number(path.dataset.end ?? 1);

    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;

    return { path, length, start, end };
  });

  handwritingMarkData = wordmarkMarks.map((mark) => {
    const start = Number(mark.dataset.start ?? 0);
    const end = Number(mark.dataset.end ?? 1);
    const radius = Number(mark.dataset.radius ?? 4.2);

    mark.style.opacity = '0';
    mark.setAttribute('r', '0');

    return { mark, radius, start, end };
  });

  handwritingPrepared = true;
  wordmark.classList.add('is-prepared');
  playIntroSequence();
}

function setHandwritingProgress(progress) {
  const globalProgress = clamp(progress);

  handwritingStrokeData.forEach(({ path, length, start, end }) => {
    const range = Math.max(end - start, 0.001);
    const local = easeWriting((globalProgress - start) / range);
    path.style.strokeDashoffset = `${length * (1 - local)}`;
  });

  handwritingMarkData.forEach(({ mark, radius, start, end }) => {
    const range = Math.max(end - start, 0.001);
    const local = easeWriting((globalProgress - start) / range);
    mark.style.opacity = String(local);
    mark.setAttribute('r', `${radius * local}`);
  });
}

function resetHandwritingGeometry() {
  if (!handwritingPrepared) return;
  setHandwritingProgress(0);
}

function revealCTAWhenReady(runId) {
  Promise.all([matteTransition.ready(), storyImageReady]).then(() => {
    if (runId !== introRunId || entered) return;
    intro.classList.add('is-cta-visible');
  });
}

function revealIntroCopy(runId) {
  scheduleIntro(() => intro.classList.add('is-copy-one-visible'), 260, runId);
  scheduleIntro(() => intro.classList.add('is-copy-two-visible'), 760, runId);
  scheduleIntro(() => revealCTAWhenReady(runId), 1370, runId);
}

function finishHandwriting(runId) {
  if (runId !== introRunId) return;
  setHandwritingProgress(1);
  revealIntroCopy(runId);
}

function animateHandwriting(runId) {
  const startedAt = performance.now();

  function tick(now) {
    if (runId !== introRunId) return;

    const progress = clamp((now - startedAt) / HANDWRITING_TARGET_DURATION);
    setHandwritingProgress(progress);

    if (progress < 1) {
      requestAnimationFrame(tick);
      return;
    }

    finishHandwriting(runId);
  }

  requestAnimationFrame(tick);
}

function playIntroSequence() {
  if (!handwritingPrepared) return;

  introRunId += 1;
  const runId = introRunId;
  clearIntroTimers();

  intro.classList.remove(
    'is-copy-one-visible',
    'is-copy-two-visible',
    'is-cta-visible',
    'is-ink-growing',
  );
  resetHandwritingGeometry();

  if (reducedMotion) {
    setHandwritingProgress(1);
    intro.classList.add('is-ink-growing', 'is-copy-one-visible', 'is-copy-two-visible', 'is-cta-visible');
    return;
  }

  scheduleIntro(() => {
    intro.classList.add('is-ink-growing');
    animateHandwriting(runId);
  }, HANDWRITING_START_DELAY, runId);
}

function renderStoryPanel(index) {
  const stop = STORY_STOPS[index];
  const step = String(index + 1).padStart(2, '0');

  storyStep.textContent = step;
  storySection.textContent = stop.section;
  storyTitle.textContent = stop.title;
  storyText.textContent = stop.text;

  storyProgressDots.forEach((dot, dotIndex) => {
    dot.classList.toggle('is-active', dotIndex === index);
  });

  const isLast = index === STORY_STOPS.length - 1;
  storyNextIcon.textContent = isLast ? '↺' : '→';
  storyNext.setAttribute(
    'aria-label',
    isLast ? 'Wróć do pierwszego kadru opowieści' : `Przejdź do kadru ${String(index + 2).padStart(2, '0')}`,
  );
}

function calculateStoryBaseSize() {
  if (!storyStage) return false;

  const rect = storyStage.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return false;

  const cover = Math.max(
    rect.width / STORY_IMAGE_WIDTH,
    rect.height / STORY_IMAGE_HEIGHT,
  );

  storyBaseWidth = STORY_IMAGE_WIDTH * cover;
  storyBaseHeight = STORY_IMAGE_HEIGHT * cover;
  storyWorld.style.width = `${storyBaseWidth.toFixed(2)}px`;
  storyWorld.style.height = `${storyBaseHeight.toFixed(2)}px`;
  return true;
}

function applyStoryCamera(index, animate = true) {
  if (!storyStage || !storyWorld) return;
  if (!storyBaseWidth || !storyBaseHeight) {
    if (!calculateStoryBaseSize()) return;
  }

  const stop = STORY_STOPS[index];
  const rect = storyStage.getBoundingClientRect();
  const scaledWidth = storyBaseWidth * stop.zoom;
  const scaledHeight = storyBaseHeight * stop.zoom;
  const targetX = rect.width * 0.5;
  const targetY = rect.height * 0.48;

  const desiredX = targetX - stop.x * scaledWidth;
  const desiredY = targetY - stop.y * scaledHeight;
  const x = clamp(desiredX, rect.width - scaledWidth, 0);
  const y = clamp(desiredY, rect.height - scaledHeight, 0);

  storyWorld.style.transitionDuration = (!animate || reducedMotion) ? '0ms' : `${STORY_CAMERA_MS}ms`;
  storyWorld.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${stop.zoom})`;
}

function fitStoryCamera(animate = false) {
  storyBaseWidth = 0;
  storyBaseHeight = 0;
  if (!calculateStoryBaseSize()) return;
  applyStoryCamera(storyIndex, animate);
}

function resetStoryCamera() {
  window.clearTimeout(storyTransitionTimer);
  window.clearTimeout(storyRevealTimer);
  storyTransitionTimer = 0;
  storyRevealTimer = 0;
  storyMoving = false;
  storyIndex = 0;
  storyPanel.classList.remove('is-changing');
  storyNext.disabled = true;
  renderStoryPanel(storyIndex);
  requestAnimationFrame(() => fitStoryCamera(false));
}

function advanceStoryCamera() {
  if (!entered || storyMoving || !experience.classList.contains('is-story-ready')) return;

  storyMoving = true;
  storyNext.disabled = true;
  storyPanel.classList.add('is-changing');

  const nextIndex = (storyIndex + 1) % STORY_STOPS.length;

  storyTransitionTimer = window.setTimeout(() => {
    storyIndex = nextIndex;
    renderStoryPanel(storyIndex);
    applyStoryCamera(storyIndex, true);

    storyTransitionTimer = window.setTimeout(() => {
      storyPanel.classList.remove('is-changing');
      storyNext.disabled = false;
      storyMoving = false;
    }, STORY_CAMERA_MS + 35);
  }, STORY_PANEL_HIDE_MS);
}

function prepareForNarrativeTransition() {
  clearIntroTimers();
  introRunId += 1;
  document.body.classList.add('is-transitioning');
  if (themeColor) themeColor.setAttribute('content', '#0c0c0d');
}

function mountHistoryUnderMatte() {
  if (entered) return;

  entered = true;
  experience.hidden = false;
  intro.hidden = true;
  experience.classList.remove('is-story-ready');
  document.body.classList.add('experience-started');
  resetStoryCamera();
  window.scrollTo(0, 0);

  try {
    experience.focus({ preventScroll: true });
  } catch (_) {
    experience.focus();
  }
}

function revealStoryCamera() {
  if (!entered) mountHistoryUnderMatte();

  document.body.classList.remove('is-transitioning');
  window.clearTimeout(storyRevealTimer);

  requestAnimationFrame(() => {
    fitStoryCamera(false);
    experience.classList.add('is-story-ready');

    if (STORY_REVEAL_MS <= 0) {
      if (themeColor) themeColor.setAttribute('content', '#eee7e1');
      storyNext.disabled = false;
      return;
    }

    storyRevealTimer = window.setTimeout(() => {
      if (!entered) return;
      if (themeColor) themeColor.setAttribute('content', '#eee7e1');
      storyNext.disabled = false;
      storyRevealTimer = 0;
    }, STORY_REVEAL_MS);
  });
}

const matteTransition = window.createMatteTransition({
  spriteRoot: matteSprite,
  fallback: matteFallback,
  reducedMotion,
  onNearBlack: mountHistoryUnderMatte,
  onDone: revealStoryCamera,
});

function setHoldInkFeedback(progress) {
  const safeProgress = clamp(progress);

  if (!holdInk || safeProgress <= 0) {
    enterButton.style.setProperty('--hold-ink-opacity', '0');
    enterButton.style.setProperty('--hold-ink-x', '0%');
    enterButton.style.setProperty('--hold-ink-y', '0%');
    return;
  }

  const frameIndex = Math.min(
    HOLD_INK_FRAME_COUNT - 1,
    Math.max(1, Math.round(safeProgress * (HOLD_INK_FRAME_COUNT - 1))),
  );
  const column = frameIndex % HOLD_INK_ATLAS_COLUMNS;
  const row = Math.floor(frameIndex / HOLD_INK_ATLAS_COLUMNS);
  const x = HOLD_INK_ATLAS_COLUMNS > 1
    ? (column / (HOLD_INK_ATLAS_COLUMNS - 1)) * 100
    : 0;
  const y = HOLD_INK_ATLAS_ROWS > 1
    ? (row / (HOLD_INK_ATLAS_ROWS - 1)) * 100
    : 0;

  enterButton.style.setProperty('--hold-ink-x', `${x.toFixed(4)}%`);
  enterButton.style.setProperty('--hold-ink-y', `${y.toFixed(4)}%`);
  enterButton.style.setProperty('--hold-ink-opacity', '1');
}

const holdCTA = window.createHoldCTA({
  trigger: enterButton,
  reducedMotion,
  holdMs: reducedMotion ? 420 : 1000,
  canStart: () => (
    !entered
    && intro.classList.contains('is-cta-visible')
    && (reducedMotion || matteTransition.isReady())
    && (
      matteTransition.getState() === matteTransition.states.IDLE
      || (reducedMotion && matteTransition.getState() === matteTransition.states.LOADING)
    )
  ),
  onStart: () => true,
  onProgress: (progress) => setHoldInkFeedback(progress),
  onCancel: () => setHoldInkFeedback(0),
  onCommit: () => {
    setHoldInkFeedback(1);
    prepareForNarrativeTransition();
    matteTransition.play();
  },
});

storyNext.addEventListener('click', advanceStoryCamera);
window.addEventListener('resize', () => {
  if (!entered) return;
  fitStoryCamera(false);
});

storyMasterImage.addEventListener('load', () => {
  if (!entered) return;
  fitStoryCamera(false);
});

prepareWordmark();

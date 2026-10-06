const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const intro = document.querySelector('#intro');
const experience = document.querySelector('#experience');
const enterButton = document.querySelector('#enterButton');
const holdInk = enterButton?.querySelector('.hold-button-ink');
const themeColor = document.querySelector('meta[name="theme-color"]');
const matteSprite = document.querySelector('#inkMatte');
const matteFallback = document.querySelector('#matteFallback');

const wordmark = document.querySelector('#wordmark');
const wordmarkPens = Array.from(wordmark?.querySelectorAll('#wordmark-reveal [data-id]') ?? []);
const wordmarkAnimatedArtwork = wordmark?.querySelector('#animated-artwork');
const wordmarkFinalLock = wordmark?.querySelector('#final-lock');

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

const HANDWRITING_TARGET_DURATION = 6134.6;
const HANDWRITING_START_DELAY = 340;
const INTRO_COPY_ONE_AT = 5200;
const INTRO_COPY_TWO_AT = 6050;
const INTRO_CTA_AT = 7850;
const HOLD_INK_FRAME_COUNT = 24;
const HOLD_INK_ATLAS_COLUMNS = 6;
const HOLD_INK_ATLAS_ROWS = 4;
const STORY_CAMERA_MS = reducedMotion ? 0 : 1280;
const STORY_PANEL_HIDE_MS = reducedMotion ? 0 : 180;
const STORY_REVEAL_MS = reducedMotion ? 0 : 1050;
const STORY_PANEL_REVEAL_DELAY_MS = reducedMotion ? 0 : 220;
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
let handwritingMoveData = [];
let storyIndex = 0;
let storyMoving = false;
let storyBaseWidth = 0;
let storyBaseHeight = 0;
let storyTransitionTimer = 0;
let storyRevealTimer = 0;
let storyPanelRevealTimer = 0;

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

function prepareWordmark() {
  if (!wordmark || !wordmarkAnimatedArtwork || !wordmarkFinalLock || wordmarkPens.length === 0) return;

  handwritingMoveData = wordmarkPens.map((pen) => {
    const id = pen.dataset.id;
    if (!id) return null;

    const start = Number(pen.dataset.startMs ?? 0);
    const end = Number(pen.dataset.endMs ?? start + 1);
    const isDot = pen.tagName.toLowerCase() === 'circle';
    const length = isDot ? 0 : Math.max(pen.getTotalLength(), 1);

    if (isDot) {
      pen.style.opacity = '0';
    } else {
      pen.style.strokeDasharray = `${length}`;
      pen.style.strokeDashoffset = `${length}`;
      pen.style.opacity = '0';
    }

    return { pen, start, end, isDot, length, lastLocal: -1, isVisible: false };
  }).filter(Boolean);

  handwritingPrepared = handwritingMoveData.length === wordmarkPens.length;
  if (!handwritingPrepared) {
    wordmarkFinalLock.style.opacity = '1';
    wordmarkAnimatedArtwork.style.opacity = '0';
    wordmark.classList.add('is-prepared');
    const runId = ++introRunId;
    intro.classList.add('is-ink-growing');
    scheduleIntroChoreography(runId);
    return;
  }

  wordmarkFinalLock.style.opacity = '0';
  wordmarkAnimatedArtwork.style.opacity = '1';
  wordmark.classList.add('is-prepared');
  playIntroSequence();
}

function setHandwritingTime(elapsedMs) {
  if (!handwritingPrepared) return;

  const current = clamp(elapsedMs, 0, HANDWRITING_TARGET_DURATION);

  handwritingMoveData.forEach((move) => {
    const { pen, start, end, isDot, length } = move;
    const duration = Math.max(end - start, 1);
    const local = clamp((current - start) / duration);

    // Completed and not-yet-started phases no longer generate DOM writes on every frame.
    if (Math.abs(local - move.lastLocal) < 0.00001) return;
    move.lastLocal = local;

    if (isDot) {
      const dotProgress = 1 - Math.pow(1 - local, 3);
      pen.style.opacity = String(dotProgress);
      return;
    }

    const visible = local > 0;
    if (visible !== move.isVisible) {
      pen.style.opacity = visible ? '1' : '0';
      move.isVisible = visible;
    }
    pen.style.strokeDashoffset = `${length * (1 - local)}`;
  });

  const complete = current >= HANDWRITING_TARGET_DURATION - 1;
  wordmarkFinalLock.style.opacity = complete ? '1' : '0';
  wordmarkAnimatedArtwork.style.opacity = complete ? '0' : '1';
}

function resetHandwritingGeometry() {
  handwritingMoveData.forEach((move) => { move.lastLocal = -1; });
  setHandwritingTime(0);
}

function revealCTAWhenReady(runId) {
  Promise.all([matteTransition.ready(), storyImageReady]).then(() => {
    if (runId !== introRunId || entered) return;
    intro.classList.add('is-cta-visible');
  });
}

function scheduleIntroChoreography(runId) {
  scheduleIntro(() => intro.classList.add('is-copy-one-visible'), INTRO_COPY_ONE_AT, runId);
  scheduleIntro(() => intro.classList.add('is-copy-two-visible'), INTRO_COPY_TWO_AT, runId);
  scheduleIntro(() => revealCTAWhenReady(runId), INTRO_CTA_AT, runId);
}

function finishHandwriting(runId) {
  if (runId !== introRunId) return;
  setHandwritingTime(HANDWRITING_TARGET_DURATION);
}

function animateHandwriting(runId) {
  const startedAt = performance.now();

  function tick(now) {
    if (runId !== introRunId) return;

    const elapsed = now - startedAt;
    setHandwritingTime(elapsed);

    if (elapsed < HANDWRITING_TARGET_DURATION) {
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
    setHandwritingTime(HANDWRITING_TARGET_DURATION);
    intro.classList.add('is-ink-growing', 'is-copy-one-visible', 'is-copy-two-visible', 'is-cta-visible');
    return;
  }

  scheduleIntroChoreography(runId);

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
  window.clearTimeout(storyPanelRevealTimer);
  storyTransitionTimer = 0;
  storyRevealTimer = 0;
  storyPanelRevealTimer = 0;
  storyMoving = false;
  storyIndex = 0;
  storyPanel.classList.remove('is-changing');
  experience.classList.remove('is-story-panel-ready');
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
  experience.classList.remove('is-story-ready', 'is-story-panel-ready');
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
  window.clearTimeout(storyPanelRevealTimer);

  requestAnimationFrame(() => {
    fitStoryCamera(false);
    experience.classList.add('is-story-ready');

    if (STORY_REVEAL_MS <= 0) {
      experience.classList.add('is-story-panel-ready');
      if (themeColor) themeColor.setAttribute('content', '#eee7e1');
      storyNext.disabled = false;
      return;
    }

    storyPanelRevealTimer = window.setTimeout(() => {
      if (!entered) return;
      experience.classList.add('is-story-panel-ready');
      storyPanelRevealTimer = 0;
    }, STORY_PANEL_REVEAL_DELAY_MS);

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

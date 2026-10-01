const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const intro = document.querySelector('#intro');
const experience = document.querySelector('#experience');
const enterButton = document.querySelector('#enterButton');
const themeColor = document.querySelector('meta[name="theme-color"]');
const restartButton = document.querySelector('#restartButton');
const blackout = document.querySelector('#blackout');
const matteSprite = document.querySelector('#inkMatte');
const matteFallback = document.querySelector('#matteFallback');

const wordmark = document.querySelector('#wordmark');
const wordmarkStrokes = Array.from(document.querySelectorAll('.wordmark-stroke'));
const wordmarkMarks = Array.from(document.querySelectorAll('.wordmark-mark'));

const story = document.querySelector('#story');
const storyHalo = document.querySelector('#storyHalo');
const bloomStem = document.querySelector('#bloomStem');
const bloomLeafOne = document.querySelector('#bloomLeafOne');
const bloomLeafTwo = document.querySelector('#bloomLeafTwo');
const bloomFlower = document.querySelector('#bloomFlower');
const storyCopyOne = document.querySelector('#storyCopyOne');
const storyCopyTwo = document.querySelector('#storyCopyTwo');
const storyCopyThree = document.querySelector('#storyCopyThree');
const scrollMarker = document.querySelector('#scrollMarker');

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const HANDWRITING_TARGET_DURATION = 3400;
const HANDWRITING_START_DELAY = 340;
const RESTART_BLACKOUT_DURATION = reducedMotion ? 0 : 500;

let entered = false;
let scrollFrame = 0;
let introRunId = 0;
let introTimers = [];
let bloomStemLength = 0;
let handwritingPrepared = false;
let handwritingStrokeData = [];
let handwritingMarkData = [];
let openingTimers = [];

bloomStemLength = Math.max(bloomStem.getTotalLength(), 1);

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
  matteTransition.ready().then(() => {
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
    'is-ink-hold-active',
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

function clearOpeningTimers() {
  openingTimers.forEach(window.clearTimeout);
  openingTimers = [];
}

function scheduleOpening(callback, delay) {
  const timer = window.setTimeout(callback, reducedMotion ? 0 : delay);
  openingTimers.push(timer);
}

function resetOpeningScene() {
  clearOpeningTimers();
  experience.classList.remove(
    'is-opening-eyebrow-visible',
    'is-opening-copy-visible',
    'is-opening-note-visible',
    'is-opening-halo-visible',
  );
}

function prepareForNarrativeTransition() {
  clearIntroTimers();
  clearOpeningTimers();
  introRunId += 1;
  document.body.classList.add('is-transitioning');
  if (themeColor) themeColor.setAttribute('content', '#0c0c0d');
}

function mountHistoryUnderMatte() {
  if (entered) return;

  entered = true;
  resetOpeningScene();
  experience.hidden = false;
  intro.hidden = true;
  document.body.classList.add('experience-started');
  window.scrollTo(0, 0);
  try {
    experience.focus({ preventScroll: true });
  } catch (_) {
    experience.focus();
  }
  requestAnimationFrame(updateStory);
}

function revealHistoryOpening() {
  if (!entered) mountHistoryUnderMatte();

  document.body.classList.remove('is-transitioning');

  scheduleOpening(() => experience.classList.add('is-opening-eyebrow-visible'), 220);
  scheduleOpening(() => experience.classList.add('is-opening-copy-visible'), 540);
  scheduleOpening(() => experience.classList.add('is-opening-note-visible'), 980);
  scheduleOpening(() => experience.classList.add('is-opening-halo-visible'), 1220);
}

const matteTransition = window.createMatteTransition({
  spriteRoot: matteSprite,
  fallback: matteFallback,
  reducedMotion,
  onNearBlack: mountHistoryUnderMatte,
  onDone: revealHistoryOpening,
  onPreludeIdle: () => intro.classList.remove('is-ink-hold-active'),
});

const holdCTA = window.createHoldCTA({
  trigger: enterButton,
  reducedMotion,
  canStart: () => (
    !entered
    && intro.classList.contains('is-cta-visible')
    && (reducedMotion || matteTransition.isReady())
    && (
      matteTransition.getState() === matteTransition.states.IDLE
      || (reducedMotion && matteTransition.getState() === matteTransition.states.LOADING)
    )
  ),
  onStart: () => {
    intro.classList.add('is-ink-hold-active');
    const started = matteTransition.beginPrelude();
    if (!started) intro.classList.remove('is-ink-hold-active');
    return started;
  },
  onProgress: (progress) => matteTransition.setPreludeProgress(progress),
  onCancel: () => matteTransition.cancelPrelude(),
  onCommit: () => {
    prepareForNarrativeTransition();
    matteTransition.commit();
  },
});

function restartExperience() {
  blackout.classList.add('is-active');

  window.setTimeout(() => {
    window.scrollTo(0, 0);
    resetOpeningScene();
    experience.hidden = true;
    intro.hidden = false;
    document.body.classList.remove('experience-started', 'is-transitioning');
    if (themeColor) themeColor.setAttribute('content', '#eee7e1');
    entered = false;
    matteTransition.reset();
    holdCTA.reset();
    playIntroSequence();

    requestAnimationFrame(() => {
      blackout.classList.remove('is-active');
    });
  }, RESTART_BLACKOUT_DURATION);
}

function updateStory() {
  if (!story || experience.hidden) return;

  const rect = story.getBoundingClientRect();
  const scrollable = Math.max(rect.height - window.innerHeight, 1);
  const progress = reducedMotion ? 1 : clamp((-rect.top) / scrollable);
  const secondScene = clamp((progress - 0.28) / 0.22);
  const thirdScene = clamp((progress - 0.58) / 0.2);
  const bloom = clamp((progress - 0.32) / 0.68);
  const bloomTwo = clamp((progress - 0.53) / 0.47);

  storyHalo.style.opacity = String(0.22 + progress * 0.52);
  bloomStem.style.strokeDasharray = String(bloomStemLength);
  bloomStem.style.strokeDashoffset = String(bloomStemLength * (1 - progress));

  bloomLeafOne.style.opacity = String(bloom);
  bloomLeafOne.style.transform = `scale(${0.84 + bloom * 0.16})`;
  bloomLeafTwo.style.opacity = String(bloomTwo);
  bloomLeafTwo.style.transform = `scale(${0.82 + bloomTwo * 0.18})`;
  bloomFlower.style.opacity = String(bloom);
  bloomFlower.style.transform = `scale(${0.72 + bloom * 0.28})`;

  storyCopyOne.style.opacity = String(1 - secondScene);
  storyCopyOne.style.transform = `translateY(${secondScene * -26}px)`;

  storyCopyTwo.style.opacity = String(secondScene * (1 - thirdScene));
  storyCopyTwo.style.transform = `translateY(${30 - secondScene * 30 - thirdScene * 22}px)`;

  storyCopyThree.style.opacity = String(thirdScene);
  storyCopyThree.style.transform = `translateY(${28 - thirdScene * 28}px)`;

  scrollMarker.style.transform = `scaleX(${0.08 + progress * 0.92})`;
}

function onScroll() {
  cancelAnimationFrame(scrollFrame);
  scrollFrame = requestAnimationFrame(updateStory);
}

restartButton.addEventListener('click', restartExperience);
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll);

prepareWordmark();

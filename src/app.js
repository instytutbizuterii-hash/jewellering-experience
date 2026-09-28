const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const intro = document.querySelector('#intro');
const experience = document.querySelector('#experience');
const enterButton = document.querySelector('#enterButton');
const restartButton = document.querySelector('#restartButton');
const blackout = document.querySelector('#blackout');
const completionParticles = document.querySelector('#completionParticles');

const wordmark = document.querySelector('#wordmark');
const wordmarkText = document.querySelector('#wordmarkText');
const wordmarkMask = document.querySelector('#wordmarkMask');
const wordmarkIDot = document.querySelector('#wordmarkIDot');
const wordmarkCursor = document.querySelector('#wordmarkCursor');

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

const HOLD_DURATION = reducedMotion ? 250 : 1400;
const PARTICLE_DELAY = reducedMotion ? 0 : 110;
const BLACKOUT_DURATION = reducedMotion ? 0 : 780;
const REVEAL_DELAY = reducedMotion ? 0 : 170;
const HANDWRITING_TARGET_DURATION = 2550;
const HANDWRITING_START_DELAY = 360;
const WORDMARK_TEXT = 'Jewellerıng';
const WORDMARK_I_INDEX = 8;
const SVG_NS = 'http://www.w3.org/2000/svg';

let entered = false;
let scrollFrame = 0;
let holdFrame = 0;
let holdStartedAt = 0;
let holding = false;
let introRunId = 0;
let introTimers = [];
let bloomStemLength = 0;
let handwritingSteps = [];
let totalHandwritingLength = 1;
let wordmarkPrepared = false;

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

function point(box, x, y) {
  return {
    x: box.x + box.width * x,
    y: box.y + box.height * y,
  };
}

function pathPoint(value) {
  return `${value.x.toFixed(2)} ${value.y.toFixed(2)}`;
}

function createCharacterPath(character, box) {
  const p = (x, y) => point(box, x, y);
  const M = (x, y) => `M ${pathPoint(p(x, y))}`;
  const C = (x1, y1, x2, y2, x3, y3) => `C ${pathPoint(p(x1, y1))} ${pathPoint(p(x2, y2))} ${pathPoint(p(x3, y3))}`;

  switch (character.toLowerCase()) {
    case 'j':
      return `${M(.78, .08)} ${C(.66, .18, .60, .45, .56, .63)} ${C(.51, .84, .34, 1.04, .12, .88)}`;
    case 'e':
      return `${M(.08, .62)} ${C(.25, .46, .54, .44, .68, .57)} ${C(.75, .69, .57, .77, .31, .72)} ${C(.49, .88, .79, .82, .95, .66)}`;
    case 'w':
      return `${M(.03, .54)} ${C(.13, .73, .22, .87, .33, .62)} ${C(.40, .47, .44, .78, .55, .82)} ${C(.66, .86, .72, .61, .78, .48)} ${C(.82, .67, .87, .79, .97, .65)}`;
    case 'l':
      return `${M(.12, .78)} ${C(.30, .59, .45, .32, .44, .10)} ${C(.43, -.02, .31, .03, .32, .22)} ${C(.33, .49, .53, .77, .77, .80)} ${C(.86, .82, .92, .75, .98, .67)}`;
    case 'r':
      return `${M(.07, .64)} ${C(.18, .77, .29, .82, .40, .69)} ${C(.48, .59, .51, .48, .57, .39)} ${C(.60, .58, .67, .73, .82, .64)} ${C(.88, .60, .93, .56, .98, .51)}`;
    case 'ı':
      return `${M(.08, .62)} ${C(.22, .77, .35, .82, .48, .70)} ${C(.59, .60, .64, .51, .71, .45)} ${C(.68, .63, .74, .78, .94, .66)}`;
    case 'n':
      return `${M(.05, .65)} ${C(.17, .77, .29, .81, .41, .68)} ${C(.50, .58, .53, .45, .61, .43)} ${C(.75, .41, .73, .68, .79, .76)} ${C(.85, .84, .93, .73, .98, .64)}`;
    case 'g':
      return `${M(.06, .58)} ${C(.23, .44, .53, .46, .63, .61)} ${C(.72, .76, .57, .89, .38, .83)} ${C(.20, .77, .22, .57, .40, .51)} ${C(.60, .43, .77, .56, .78, .74)} ${C(.80, .97, .70, 1.18, .51, 1.22)} ${C(.31, 1.25, .18, 1.09, .26, .96)}`;
    default:
      return `${M(.06, .64)} ${C(.30, .48, .67, .82, .96, .62)}`;
  }
}

function getCharacterBox(index) {
  try {
    const extent = wordmarkText.getExtentOfChar(index);
    return {
      x: extent.x,
      y: extent.y,
      width: Math.max(extent.width, 12),
      height: Math.max(extent.height, 24),
    };
  } catch (error) {
    const width = 70;
    return {
      x: 72 + index * width,
      y: 58,
      width,
      height: 142,
    };
  }
}

function hideIDot() {
  wordmarkIDot.classList.remove('is-visible');
  wordmarkIDot.setAttribute('visibility', 'hidden');
}

function showIDot() {
  wordmarkIDot.setAttribute('visibility', 'visible');
  requestAnimationFrame(() => wordmarkIDot.classList.add('is-visible'));
}

function buildHandwritingGeometry() {
  wordmarkMask.replaceChildren();
  handwritingSteps = [];

  for (let index = 0; index < WORDMARK_TEXT.length; index += 1) {
    const character = WORDMARK_TEXT[index];
    const box = getCharacterBox(index);
    const path = document.createElementNS(SVG_NS, 'path');

    path.setAttribute('d', createCharacterPath(character, box));
    path.classList.add('wordmark-mask-stroke');
    wordmarkMask.appendChild(path);

    const length = Math.max(path.getTotalLength(), 1);
    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;

    handwritingSteps.push({
      type: 'stroke',
      path,
      length,
      pause: character === 'J' ? 34 : 20,
    });

    if (index === WORDMARK_I_INDEX) {
      const dotX = box.x + box.width * .52;
      const dotY = box.y - Math.max(9, box.height * .15);
      wordmarkIDot.setAttribute('cx', dotX.toFixed(2));
      wordmarkIDot.setAttribute('cy', dotY.toFixed(2));
      handwritingSteps.push({
        type: 'dot',
        x: dotX,
        y: dotY,
        length: 22,
        pause: 54,
      });
    }
  }

  totalHandwritingLength = Math.max(
    handwritingSteps.reduce((sum, step) => sum + step.length, 0),
    1,
  );

  wordmarkPrepared = true;
  wordmark.classList.add('is-prepared');
}

function setCursorOnPath(path, length, progress) {
  const current = path.getPointAtLength(length * clamp(progress));
  wordmarkCursor.setAttribute('cx', current.x.toFixed(2));
  wordmarkCursor.setAttribute('cy', current.y.toFixed(2));
}

function resetHandwritingGeometry() {
  if (!wordmarkPrepared) return;

  wordmarkText.setAttribute('mask', 'url(#wordmarkWriteMask)');
  hideIDot();

  handwritingSteps.forEach((step) => {
    if (step.type === 'stroke') {
      step.path.style.strokeDashoffset = `${step.length}`;
    }
  });

  const firstStroke = handwritingSteps.find((step) => step.type === 'stroke');
  if (firstStroke) setCursorOnPath(firstStroke.path, firstStroke.length, 0);

  wordmark.classList.remove('is-writing', 'is-complete');
}

function revealIntroCopy(runId) {
  scheduleIntro(() => intro.classList.add('is-copy-one-visible'), 260, runId);
  scheduleIntro(() => intro.classList.add('is-copy-two-visible'), 760, runId);
  scheduleIntro(() => intro.classList.add('is-cta-visible'), 1370, runId);
}

function finishHandwriting(runId) {
  if (runId !== introRunId) return;

  wordmarkText.removeAttribute('mask');
  showIDot();
  wordmark.classList.remove('is-writing');
  wordmark.classList.add('is-complete');
  revealIntroCopy(runId);
}

function animateDotStep(step, index, runId) {
  if (runId !== introRunId) return;

  wordmarkCursor.setAttribute('cx', step.x.toFixed(2));
  wordmarkCursor.setAttribute('cy', step.y.toFixed(2));

  scheduleIntro(() => showIDot(), 54, runId);
  scheduleIntro(() => animateHandwritingStep(index + 1, runId), 150 + step.pause, runId);
}

function animateStrokeStep(step, index, runId) {
  const proportionalDuration = HANDWRITING_TARGET_DURATION * (step.length / totalHandwritingLength);
  const duration = clamp(proportionalDuration, 72, 410);
  const startedAt = performance.now();

  setCursorOnPath(step.path, step.length, 0);

  function tick(now) {
    if (runId !== introRunId) return;

    const linearProgress = clamp((now - startedAt) / duration);
    const easedProgress = 1 - Math.pow(1 - linearProgress, 2.05);
    step.path.style.strokeDashoffset = `${step.length * (1 - easedProgress)}`;
    setCursorOnPath(step.path, step.length, easedProgress);

    if (linearProgress < 1) {
      requestAnimationFrame(tick);
      return;
    }

    step.path.style.strokeDashoffset = '0';
    scheduleIntro(() => animateHandwritingStep(index + 1, runId), step.pause, runId);
  }

  requestAnimationFrame(tick);
}

function animateHandwritingStep(index, runId) {
  if (runId !== introRunId) return;

  if (index >= handwritingSteps.length) {
    finishHandwriting(runId);
    return;
  }

  const step = handwritingSteps[index];
  if (step.type === 'dot') {
    animateDotStep(step, index, runId);
    return;
  }

  animateStrokeStep(step, index, runId);
}

function playIntroSequence() {
  if (!wordmarkPrepared) return;

  introRunId += 1;
  const runId = introRunId;
  clearIntroTimers();

  intro.classList.remove('is-copy-one-visible', 'is-copy-two-visible', 'is-cta-visible');
  resetHandwritingGeometry();

  if (reducedMotion) {
    handwritingSteps.forEach((step) => {
      if (step.type === 'stroke') step.path.style.strokeDashoffset = '0';
    });
    wordmarkText.removeAttribute('mask');
    showIDot();
    wordmark.classList.add('is-complete');
    intro.classList.add('is-copy-one-visible', 'is-copy-two-visible', 'is-cta-visible');
    return;
  }

  scheduleIntro(() => {
    wordmark.classList.add('is-writing');
    animateHandwritingStep(0, runId);
  }, HANDWRITING_START_DELAY, runId);
}

async function prepareWordmark() {
  wordmark.classList.remove('is-prepared');
  hideIDot();

  if (document.fonts?.load) {
    try {
      await Promise.race([
        document.fonts.load('182px "Allura"'),
        new Promise((resolve) => window.setTimeout(resolve, 1200)),
      ]);
    } catch (error) {
      // Fallback cursive remains usable; preparation must never block the intro.
    }
  }

  buildHandwritingGeometry();
  playIntroSequence();
}

function setHoldProgress(progress) {
  enterButton.style.setProperty('--hold-progress', `${Math.round(clamp(progress) * 100)}%`);
}

function resetHold() {
  holding = false;
  cancelAnimationFrame(holdFrame);
  enterButton.classList.remove('is-holding', 'is-complete');
  setHoldProgress(0);
}

function cancelHold() {
  if (!holding || entered) return;
  holding = false;
  cancelAnimationFrame(holdFrame);
  enterButton.classList.remove('is-holding');
  setHoldProgress(0);
}

function createCompletionParticles() {
  if (reducedMotion) return;

  completionParticles.replaceChildren();
  const rect = enterButton.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const particleCount = 16;

  for (let index = 0; index < particleCount; index += 1) {
    const particle = document.createElement('span');
    const angle = (Math.PI * 2 * index) / particleCount;
    const distance = 22 + (index % 4) * 9;
    const offsetX = Math.cos(angle) * distance;
    const offsetY = Math.sin(angle) * distance * 0.72;

    particle.style.setProperty('--x', `${centerX}px`);
    particle.style.setProperty('--y', `${centerY}px`);
    particle.style.setProperty('--dx', `${offsetX.toFixed(1)}px`);
    particle.style.setProperty('--dy', `${offsetY.toFixed(1)}px`);
    particle.style.setProperty('--size', `${2 + (index % 3)}px`);
    particle.style.setProperty('--delay', `${(index % 4) * 18}ms`);
    completionParticles.appendChild(particle);
  }

  window.setTimeout(() => completionParticles.replaceChildren(), 900);
}

function prepareBlackoutOrigin() {
  const rect = enterButton.getBoundingClientRect();
  const x = ((rect.left + rect.width / 2) / window.innerWidth) * 100;
  const y = ((rect.top + rect.height / 2) / window.innerHeight) * 100;
  blackout.style.setProperty('--blackout-x', `${x.toFixed(2)}%`);
  blackout.style.setProperty('--blackout-y', `${y.toFixed(2)}%`);
}

function finishHold() {
  holding = false;
  cancelAnimationFrame(holdFrame);
  setHoldProgress(1);
  enterButton.classList.remove('is-holding');
  enterButton.classList.add('is-complete');
  createCompletionParticles();
  prepareBlackoutOrigin();
  window.setTimeout(enterExperience, PARTICLE_DELAY);
}

function updateHold(now) {
  if (!holding || entered) return;

  const progress = (now - holdStartedAt) / HOLD_DURATION;
  setHoldProgress(progress);

  if (progress >= 1) {
    finishHold();
    return;
  }

  holdFrame = requestAnimationFrame(updateHold);
}

function startHold(event) {
  if (entered || holding || !intro.classList.contains('is-cta-visible')) return;
  if (event.type === 'pointerdown' && event.button !== 0) return;

  event.preventDefault();
  holding = true;
  holdStartedAt = performance.now();
  enterButton.classList.add('is-holding');
  setHoldProgress(0);
  holdFrame = requestAnimationFrame(updateHold);
}

function enterExperience() {
  if (entered) return;

  entered = true;
  clearIntroTimers();
  introRunId += 1;
  intro.classList.add('is-blackout');
  blackout.classList.add('is-active');

  window.setTimeout(() => {
    experience.hidden = false;
    experience.classList.remove('is-revealed');
    intro.hidden = true;
    document.body.classList.add('experience-started');
    window.scrollTo(0, 0);
    requestAnimationFrame(updateStory);

    window.setTimeout(() => {
      experience.classList.add('is-revealed');
      blackout.classList.remove('is-active');
    }, REVEAL_DELAY);
  }, BLACKOUT_DURATION);
}

function restartExperience() {
  blackout.classList.add('is-active');

  window.setTimeout(() => {
    window.scrollTo(0, 0);
    experience.classList.remove('is-revealed');
    experience.hidden = true;
    intro.hidden = false;
    intro.classList.remove('is-blackout');
    document.body.classList.remove('experience-started');
    entered = false;
    resetHold();
    playIntroSequence();

    requestAnimationFrame(() => {
      blackout.classList.remove('is-active');
    });
  }, reducedMotion ? 0 : 500);
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

enterButton.addEventListener('pointerdown', startHold);
enterButton.addEventListener('pointerup', cancelHold);
enterButton.addEventListener('pointercancel', cancelHold);
enterButton.addEventListener('pointerleave', cancelHold);
enterButton.addEventListener('keydown', (event) => {
  if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) startHold(event);
});
enterButton.addEventListener('keyup', (event) => {
  if (event.key === ' ' || event.key === 'Enter') cancelHold();
});
restartButton.addEventListener('click', restartExperience);
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll);

prepareWordmark();

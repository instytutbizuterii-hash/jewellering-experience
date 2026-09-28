const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const intro = document.querySelector('#intro');
const experience = document.querySelector('#experience');
const enterButton = document.querySelector('#enterButton');
const restartButton = document.querySelector('#restartButton');
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
let entered = false;
let frame = 0;
let holdFrame = 0;
let holdStartedAt = 0;
let holding = false;

function setHoldProgress(progress) {
  enterButton.style.setProperty('--hold-progress', `${Math.round(clamp(progress) * 100)}%`);
}

function cancelHold() {
  if (!holding || entered) return;
  holding = false;
  cancelAnimationFrame(holdFrame);
  enterButton.classList.remove('is-holding');
  setHoldProgress(0);
}

function finishHold() {
  holding = false;
  cancelAnimationFrame(holdFrame);
  setHoldProgress(1);
  enterButton.classList.remove('is-holding');
  enterButton.classList.add('is-complete');
  enterExperience();
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
  if (entered || holding) return;
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
  intro.classList.add('is-leaving');

  window.setTimeout(() => {
    experience.hidden = false;
    intro.hidden = true;
    document.body.classList.add('experience-started');
    window.scrollTo(0, 0);
    requestAnimationFrame(updateStory);
  }, reducedMotion ? 0 : 880);
}

function restartExperience() {
  window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
}

function updateStory() {
  if (!story || story.hidden) return;

  const rect = story.getBoundingClientRect();
  const scrollable = Math.max(rect.height - window.innerHeight, 1);
  const progress = reducedMotion ? 1 : clamp((-rect.top) / scrollable);
  const secondScene = clamp((progress - 0.28) / 0.22);
  const thirdScene = clamp((progress - 0.58) / 0.2);
  const bloom = clamp((progress - 0.32) / 0.68);
  const bloomTwo = clamp((progress - 0.53) / 0.47);

  storyHalo.style.opacity = String(0.22 + progress * 0.52);

  const stemLength = 510;
  bloomStem.style.strokeDasharray = String(stemLength);
  bloomStem.style.strokeDashoffset = String(stemLength - Math.round(stemLength * progress));

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
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(updateStory);
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

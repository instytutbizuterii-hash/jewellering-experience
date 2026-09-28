const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const intro = document.querySelector('#intro');
const experience = document.querySelector('#experience');
const enterButton = document.querySelector('#enterButton');
const restartButton = document.querySelector('#restartButton');
const blackout = document.querySelector('#blackout');
const completionParticles = document.querySelector('#completionParticles');
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
    enterButton.classList.remove('is-complete', 'is-holding');
    setHoldProgress(0);
    entered = false;
    document.body.classList.remove('experience-started');

    requestAnimationFrame(() => {
      blackout.classList.remove('is-active');
    });
  }, reducedMotion ? 0 : 500);
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

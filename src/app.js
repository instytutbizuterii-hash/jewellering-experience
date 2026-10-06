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

const WORDMARK_NIB_RATIO = 0.28;
const WORDMARK_NIB_MIN = 10;
const WORDMARK_NIB_MAX = 34;

const WORDMARK_DIRECT_PROGRESS_IDS = new Set(['t1_up', 't1_down', 't2_up', 't2_down', 'i3']);

const WORDMARK_PROGRESS_MAPS = Object.freeze({
  "B_swatch": Object.freeze([0.00000,0.01273,0.02546,0.05083,0.07847,0.10208,0.12500,0.14875,0.17500,0.19661,0.22049,0.24375,0.26458,0.28542,0.30787,0.32708,0.34974,0.37037,0.38958,0.40880,0.42801,0.44722,0.46745,0.48646,0.50625,0.52667,0.54653,0.56833,0.58698,0.60781,0.62865,0.64948,0.67031,0.69115,0.71250,0.73464,0.75547,0.77630,0.79792,0.81979,0.83981,0.86042,0.88333,0.90394,0.92250,0.94074,0.95919,0.97230,1.00000]),
  "B_body": Object.freeze([0.00000,0.01131,0.02261,0.04012,0.07470,0.09793,0.11783,0.13395,0.14694,0.16017,0.17415,0.18835,0.20295,0.22159,0.24344,0.26678,0.29047,0.31259,0.33287,0.34734,0.36142,0.37498,0.38698,0.39691,0.40684,0.41677,0.47222,0.49384,0.51317,0.53225,0.55133,0.57071,0.58984,0.60870,0.62747,0.64636,0.66567,0.68582,0.70678,0.72963,0.74783,0.76034,0.77285,0.78784,0.81318,0.88566,0.90888,0.93376,1.00000]),
  "i1": Object.freeze([0.00000,0.01130,0.02260,0.03447,0.05082,0.06943,0.08802,0.10535,0.12170,0.14102,0.15805,0.17491,0.19271,0.21050,0.22618,0.24193,0.25972,0.27426,0.28872,0.30394,0.32147,0.34119,0.36091,0.38063,0.40035,0.42033,0.44184,0.45964,0.48338,0.49973,0.52344,0.54123,0.56264,0.58997,0.61141,0.63787,0.66104,0.68345,0.70700,0.73260,0.75880,0.77933,0.80634,0.82920,0.85493,0.88418,0.90304,0.91506,1.00000]),
  "z": Object.freeze([0.00000,0.02378,0.04726,0.06724,0.08765,0.10916,0.13067,0.15218,0.17299,0.19247,0.21149,0.23109,0.24878,0.26443,0.27856,0.28971,0.30087,0.31791,0.34479,0.36815,0.38944,0.40990,0.43336,0.45231,0.47292,0.49720,0.51758,0.53516,0.54904,0.56278,0.57626,0.59000,0.60433,0.61920,0.63461,0.65061,0.66833,0.68571,0.69850,0.79245,0.81821,0.83825,0.86406,0.88379,0.90269,0.92547,0.94460,0.95772,1.00000]),
  "u": Object.freeze([0.00000,0.01522,0.02989,0.04361,0.05702,0.07000,0.08307,0.09641,0.11012,0.12534,0.14056,0.15578,0.17101,0.18668,0.20328,0.21921,0.23481,0.25004,0.26180,0.27253,0.28327,0.43294,0.45060,0.46664,0.48760,0.50722,0.52570,0.54527,0.56618,0.58514,0.60535,0.62656,0.64674,0.66571,0.68312,0.69898,0.71172,0.72409,0.73762,0.75229,0.76788,0.78375,0.79961,0.81602,0.83238,0.84824,0.86103,0.87313,1.00000]),
  "f_top": Object.freeze([0.00000,0.01751,0.03766,0.05823,0.07995,0.09946,0.11710,0.13421,0.15172,0.16705,0.18352,0.20186,0.21835,0.23520,0.25198,0.26846,0.28451,0.30100,0.31772,0.33263,0.34769,0.36294,0.37677,0.39028,0.40584,0.42235,0.43982,0.45586,0.47214,0.48853,0.50416,0.52026,0.53681,0.55378,0.57075,0.58845,0.60704,0.62518,0.64648,0.66882,0.69143,0.71555,0.73968,0.76325,0.78707,0.81316,0.83817,0.86537,1.00000]),
  "f_lower": Object.freeze([0.00000,0.14151,0.16016,0.17704,0.19222,0.20709,0.22316,0.23971,0.25625,0.27161,0.28660,0.30135,0.31731,0.33307,0.34844,0.36438,0.38045,0.39651,0.41258,0.42895,0.44583,0.46484,0.48203,0.49891,0.51571,0.53177,0.55058,0.56946,0.58958,0.61186,0.63320,0.65349,0.67396,0.69443,0.71344,0.73281,0.75292,0.77193,0.79094,0.80885,0.82847,0.84797,0.86771,0.88814,0.90739,0.92656,0.94942,0.96853,1.00000]),
  "f_exit": Object.freeze([0.00000,0.01488,0.03154,0.05217,0.07483,0.09829,0.11680,0.13332,0.14819,0.16228,0.17572,0.18823,0.19987,0.21151,0.22378,0.23620,0.24972,0.26460,0.29115,0.37107,0.38872,0.42337,0.44041,0.46479,0.48542,0.51091,0.53377,0.55703,0.58212,0.60315,0.62865,0.65616,0.67963,0.70026,0.72575,0.74770,0.78160,0.80334,0.82600,0.84303,0.86007,0.87711,0.89414,0.91118,0.92821,0.95372,0.96429,0.97485,1.00000]),
  "i2": Object.freeze([0.00000,0.01413,0.02897,0.04783,0.06311,0.07971,0.09832,0.11603,0.13483,0.14743,0.15835,0.16927,0.26641,0.28992,0.30777,0.32663,0.34549,0.36434,0.38246,0.40017,0.41815,0.43825,0.45596,0.47708,0.50521,0.53091,0.55582,0.58103,0.60399,0.63466,0.65639,0.67635,0.69407,0.72004,0.73877,0.75648,0.77633,0.79547,0.81360,0.83096,0.84771,0.86791,0.88685,0.90406,0.92082,0.93758,0.95433,0.97016,1.00000]),
  "t1_up": Object.freeze([0.00000,0.01056,0.02113,0.03169,0.04359,0.05632,0.06882,0.08095,0.09309,0.10383,0.11439,0.12496,0.13661,0.14934,0.16247,0.17681,0.19115,0.20549,0.21878,0.23150,0.24422,0.25694,0.26976,0.28320,0.29656,0.30928,0.32201,0.33534,0.34878,0.36297,0.37725,0.38938,0.40152,0.41486,0.42920,0.44354,0.45788,0.47137,0.48481,0.49907,0.51354,0.52904,0.54109,0.55015,0.55922,0.56828,0.57734,0.84956,1.00000]),
  "t1_down": Object.freeze([0.00000,0.22432,0.23712,0.24955,0.26380,0.27930,0.29349,0.30750,0.32070,0.33409,0.34961,0.36395,0.37715,0.39320,0.41168,0.42719,0.44167,0.45586,0.47572,0.49336,0.50964,0.52518,0.54255,0.55992,0.57656,0.59208,0.60911,0.62648,0.64349,0.65901,0.67452,0.69049,0.71285,0.72836,0.74516,0.76183,0.77734,0.78988,0.80169,0.81350,0.82531,0.83712,0.84971,0.86291,0.87575,0.88818,0.90137,0.92152,1.00000]),
  "t2_up": Object.freeze([0.00000,0.01311,0.02622,0.04172,0.05842,0.07634,0.09219,0.10953,0.12778,0.14557,0.16142,0.17799,0.19531,0.21335,0.22920,0.24505,0.26082,0.27507,0.28918,0.30282,0.31944,0.33973,0.35470,0.37378,0.38894,0.40258,0.41513,0.42738,0.44128,0.45820,0.47248,0.48655,0.49965,0.51280,0.52705,0.54146,0.55644,0.57040,0.58351,0.59776,0.61361,0.62946,0.64470,0.65896,0.67059,0.68015,0.68972,0.69928,1.00000]),
  "t2_down": Object.freeze([0.00000,0.30680,0.32130,0.33466,0.34802,0.36138,0.37474,0.38810,0.40146,0.41482,0.42818,0.44154,0.45490,0.46826,0.48186,0.49996,0.51562,0.53044,0.54380,0.55701,0.56918,0.58136,0.59551,0.61064,0.62578,0.64023,0.65359,0.66695,0.68031,0.69417,0.70931,0.72255,0.73472,0.74796,0.76606,0.78416,0.79800,0.81018,0.82311,0.83825,0.85229,0.86565,0.87625,0.88472,0.89320,0.90167,0.91014,0.91861,1.00000]),
  "i3": Object.freeze([0.00000,0.01448,0.02938,0.04569,0.06298,0.07993,0.09611,0.10933,0.12254,0.13452,0.14643,0.15709,0.16560,0.17411,0.18263,0.19114,0.19965,0.20817,0.26517,0.28155,0.29534,0.31010,0.32641,0.34272,0.35542,0.36425,0.37309,0.38193,0.39076,0.39960,0.58781,0.60713,0.62243,0.64141,0.65927,0.67769,0.69774,0.71908,0.73941,0.76036,0.78310,0.80616,0.82821,0.84955,0.87089,0.89466,0.91742,0.94924,1.00000]),
  "n": Object.freeze([0.00000,0.01576,0.03397,0.05190,0.06647,0.07983,0.09273,0.10348,0.11234,0.12120,0.13006,0.13891,0.14777,0.15716,0.16658,0.17600,0.18542,0.19726,0.21374,0.23101,0.25721,0.26696,0.27671,0.28647,0.39792,0.41304,0.55929,0.58506,0.60683,0.62900,0.65052,0.67295,0.68903,0.70553,0.72620,0.74626,0.76914,0.79202,0.81318,0.83415,0.85833,0.87914,0.89787,0.91839,0.94128,0.96174,0.97641,0.98821,1.00000]),
  "g_body": Object.freeze([0.00000,0.02227,0.04356,0.06777,0.09040,0.11135,0.13117,0.14957,0.16736,0.18516,0.20366,0.22299,0.24125,0.25828,0.27530,0.29176,0.30868,0.32638,0.34340,0.36171,0.37899,0.39442,0.40493,0.41543,0.42593,0.44175,0.46254,0.47811,0.48911,0.50012,0.60240,0.62571,0.64868,0.66993,0.69205,0.71315,0.73299,0.75050,0.76693,0.78269,0.79963,0.81761,0.83511,0.85087,0.86617,0.88139,0.89662,0.91401,1.00000]),
  "g_loop": Object.freeze([0.00000,0.04025,0.05851,0.07630,0.09275,0.10981,0.12822,0.14829,0.16667,0.18568,0.20320,0.21998,0.23637,0.25316,0.26995,0.28660,0.30295,0.32011,0.33738,0.35465,0.37192,0.38876,0.40608,0.42387,0.44167,0.46139,0.47842,0.49677,0.51685,0.53702,0.55807,0.58106,0.60417,0.62773,0.65234,0.67528,0.69701,0.71943,0.74131,0.76328,0.78444,0.80690,0.83047,0.85306,0.87839,0.90585,0.93281,0.96221,1.00000]),
  "g_flourish": Object.freeze([0.00000,0.01359,0.02718,0.04199,0.05680,0.07161,0.08745,0.10522,0.18247,0.20701,0.22595,0.26099,0.29557,0.32319,0.34656,0.36992,0.39288,0.41197,0.43516,0.45852,0.48016,0.49925,0.51889,0.54226,0.56563,0.58653,0.60562,0.62600,0.64628,0.66301,0.68561,0.70459,0.72111,0.73763,0.75380,0.76861,0.78555,0.80618,0.82247,0.83193,0.84138,0.85084,0.86030,0.89143,0.91272,0.93180,0.94946,0.96808,1.00000]),
  "f_cross": Object.freeze([0.00000,0.00962,0.01924,0.02887,0.03849,0.05153,0.06621,0.09183,0.10651,0.11987,0.13286,0.14586,0.15885,0.17185,0.18484,0.19918,0.21667,0.25687,0.27155,0.28623,0.30122,0.31871,0.39089,0.40388,0.41687,0.42987,0.44779,0.47090,0.48763,0.50231,0.51699,0.53167,0.54635,0.56263,0.58620,0.59926,0.60712,0.61497,0.62283,0.63069,0.63854,0.64640,0.65425,0.66211,0.87656,0.89398,0.90866,0.92418,1.00000]),
  "tt_cross": Object.freeze([0.00000,0.01252,0.02503,0.04176,0.06055,0.08077,0.10373,0.12419,0.14297,0.16061,0.17522,0.19202,0.26641,0.29772,0.34575,0.36372,0.38000,0.39628,0.41255,0.42819,0.44280,0.45740,0.47201,0.48810,0.50438,0.52065,0.54349,0.56546,0.58394,0.59855,0.61276,0.62617,0.64115,0.73285,0.75163,0.76523,0.77865,0.79471,0.81099,0.82731,0.84609,0.86488,0.88366,0.90244,0.92122,0.94001,0.95879,0.97757,1.00000]),
});

function mapWordmarkProgress(id, local) {
  if (WORDMARK_DIRECT_PROGRESS_IDS.has(id)) return local;
  const map = WORDMARK_PROGRESS_MAPS[id];
  if (!map || local <= 0) return local <= 0 ? 0 : local;
  if (local >= 1) return 1;

  const scaled = local * (map.length - 1);
  const index = Math.floor(scaled);
  const fraction = scaled - index;
  const from = map[index];
  const to = map[Math.min(index + 1, map.length - 1)];
  return from + (to - from) * fraction;
}

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
      return {
        pen,
        nib: null,
        id,
        start,
        end,
        isDot,
        length,
        bodyLagFraction: 0,
        lastLocal: -1,
        bodyVisible: false,
        nibVisible: false,
      };
    }

    const strokeWidth = Number(pen.getAttribute('stroke-width') ?? 1);
    const nibWidth = clamp(
      strokeWidth * WORDMARK_NIB_RATIO,
      WORDMARK_NIB_MIN,
      WORDMARK_NIB_MAX,
    );
    const bodyLag = Math.min(strokeWidth * 0.55, length * 0.14);
    const bodyLagFraction = clamp(bodyLag / length, 0, 0.2);

    // Keep the accepted round stroke geometry, but let the full-width body
    // trail behind the active pen position. The narrow nib reaches the true
    // position first, so the active front no longer becomes a broad blob.
    pen.setAttribute('stroke-linecap', 'round');
    pen.setAttribute('stroke-linejoin', 'round');
    pen.style.strokeDasharray = `${length}`;
    pen.style.strokeDashoffset = `${length}`;
    pen.style.opacity = '0';

    let nib = pen.parentElement?.querySelector(`[data-nib-for="${id}"]`) ?? null;
    if (!nib) {
      nib = pen.cloneNode(false);
      nib.removeAttribute('id');
      nib.removeAttribute('data-id');
      nib.removeAttribute('data-start-ms');
      nib.removeAttribute('data-end-ms');
      nib.setAttribute('data-nib-for', id);
      nib.setAttribute('stroke-width', `${nibWidth}`);
      nib.setAttribute('stroke-linecap', 'round');
      nib.setAttribute('stroke-linejoin', 'round');
      pen.insertAdjacentElement('afterend', nib);
    }

    nib.style.strokeDasharray = `${length}`;
    nib.style.strokeDashoffset = `${length}`;
    nib.style.opacity = '0';

    return {
      pen,
      nib,
      id,
      start,
      end,
      isDot,
      length,
      bodyLagFraction,
      lastLocal: -1,
      bodyVisible: false,
      nibVisible: false,
    };
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

  // final-lock is now failure fallback only. The animated SVG itself reaches
  // the exact final artwork, so no end-of-animation layer swap is needed.
  wordmarkFinalLock.style.opacity = '0';
  wordmarkAnimatedArtwork.style.opacity = '1';
  wordmark.classList.add('is-prepared');
  playIntroSequence();
}

function setHandwritingTime(elapsedMs) {
  if (!handwritingPrepared) return;

  const current = clamp(elapsedMs, 0, HANDWRITING_TARGET_DURATION);

  handwritingMoveData.forEach((move) => {
    const {
      pen,
      nib,
      id,
      start,
      end,
      isDot,
      length,
      bodyLagFraction,
    } = move;
    const duration = Math.max(end - start, 1);
    const local = clamp((current - start) / duration);

    if (Math.abs(local - move.lastLocal) < 0.00001) return;
    move.lastLocal = local;

    if (isDot) {
      const dotProgress = 1 - Math.pow(1 - local, 3);
      pen.style.opacity = String(dotProgress);
      return;
    }

    const pathProgress = mapWordmarkProgress(id, local);
    const catchupWindowMs = Math.min(48, duration * 0.4);
    const catchupStart = Math.max(0, 1 - catchupWindowMs / duration);
    const rawCatchup = clamp(
      (local - catchupStart) / Math.max(1 - catchupStart, 0.0001),
    );
    const catchup = rawCatchup * rawCatchup * (3 - 2 * rawCatchup);
    const bodyProgress = clamp(
      pathProgress - bodyLagFraction * (1 - catchup),
    );

    const nibVisible = pathProgress > 0;
    if (nibVisible !== move.nibVisible) {
      if (nib) nib.style.opacity = nibVisible ? '1' : '0';
      move.nibVisible = nibVisible;
    }

    const bodyVisible = bodyProgress > 0;
    if (bodyVisible !== move.bodyVisible) {
      pen.style.opacity = bodyVisible ? '1' : '0';
      move.bodyVisible = bodyVisible;
    }

    pen.style.strokeDashoffset = `${length * (1 - bodyProgress)}`;
    if (nib) nib.style.strokeDashoffset = `${length * (1 - pathProgress)}`;
  });

  // Stay on the same masked SVG through 100%. Switching to final-lock changes
  // antialiasing/compositing and caused the visible final snap in r8.14.
  wordmarkFinalLock.style.opacity = '0';
  wordmarkAnimatedArtwork.style.opacity = '1';
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

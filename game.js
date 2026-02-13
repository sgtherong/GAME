const BOARD_SIZE = 8;
const BOARD_PAD = 8; // 보드 padding (style.css .board와 동기화)
const LOCAL_STORAGE_KEY = 'blockblast-best-score';

/** 간단한 블록 패턴들 (1은 블록, 0은 빈 칸). 1칸 블록 제외
 *  기획서 기준 총 26종 블록 형태
 */
const SHAPES = [
  // 두 칸 직선
  [[1, 1]],
  [[1], [1]],
  // 세 칸 직선
  [[1, 1, 1]],
  [[1], [1], [1]],
  // 네 칸 직선
  [[1, 1, 1, 1]],
  [[1], [1], [1], [1]],
  // 다섯 칸 직선
  [[1, 1, 1, 1, 1]],
  [[1], [1], [1], [1], [1]],
  // 정사각형
  [
    [1, 1],
    [1, 1],
  ],
  // 3×2
  [
    [1, 1, 1],
    [1, 1, 1],
  ],
  // 2×3
  [
    [1, 1],
    [1, 1],
    [1, 1],
  ],
  // 3×3
  [
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1],
  ],
  // L자
  [
    [1, 0],
    [1, 0],
    [1, 1],
  ],
  [
    [0, 1],
    [0, 1],
    [1, 1],
  ],
  [
    [1, 1, 1],
    [1, 0, 0],
    [1, 0, 0],
  ],
  [
    [1, 1, 1],
    [0, 0, 1],
    [0, 0, 1],
  ],
  // 계단 모양
  [
    [1, 0],
    [1, 1],
    [0, 1],
  ],
  [
    [0, 1],
    [1, 1],
    [1, 0],
  ],
  // 삿갓(T) 모양 4방향
  [
    [1, 1, 1],
    [0, 1, 0],
  ],
  [
    [1, 0],
    [1, 1],
    [1, 0],
  ],
  [
    [0, 1, 0],
    [1, 1, 1],
  ],
  [
    [0, 1],
    [1, 1],
    [0, 1],
  ],
  // 추가 Z/ㄱ 계열 (기획서 3×2 “ㅏ”, “z” 계열 보강)
  [
    [1, 1, 0],
    [0, 1, 1],
  ],
  [
    [0, 1, 1],
    [1, 1, 0],
  ],
  [
    [1, 0, 0],
    [1, 1, 1],
  ],
  [
    [0, 0, 1],
    [1, 1, 1],
  ],
];

/** 블록별 배치 난이도 가중치 (기본 가중치, 총 26종) */
const SHAPE_WEIGHTS = [
  6, 6,       // 0,1: 두 칸 직선 (단순)
  5, 5,       // 2,3: 세 칸 직선 (단순)
  3, 3,       // 4,5: 네 칸 직선 (큰)
  2, 2,       // 6,7: 다섯 칸 직선 (큰)
  8,          // 8: 2×2 정사각 (단순)
  3, 3,       // 9,10: 3×2, 2×3 (큰)
  4,          // 11: 3×3 정사각 (큰)
  2, 2, 2, 2, // 12–15: L자 (복잡)
  2, 2,       // 16,17: 계단 (복잡)
  2, 2, 2, 2, // 18–21: T자 (복잡)
  2, 2, 2, 2, // 22–25: 추가 Z/ㄱ 계열 (복잡)
];

/** 블록 카테고리 분류 (기획서 기준) */
const SHAPE_CATEGORIES = {
  SIMPLE: [0, 1, 2, 3, 8],      // 단순 조각: 2칸, 3칸, 2×2
  COMPLEX: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25], // 복잡 조각: L, 계단, T, Z
  LARGE: [4, 5, 6, 7, 9, 10, 11], // 큰 조각: 4칸, 5칸, 3×2, 2×3, 3×3
};

/** 점수 구간별 블록 카테고리 확률 (기획서 밸런스 테이블) */
function getCategoryProbabilities(score) {
  if (score < 1000) {
    return { spaceFit: 0.5, simple: 0.4, complex: 0.05, large: 0.05 };
  } else if (score < 10000) {
    return { spaceFit: 0.3, simple: 0.4, complex: 0.2, large: 0.2 };
  } else if (score < 50000) {
    return { spaceFit: 0.25, simple: 0.35, complex: 0.25, large: 0.25 };
  } else if (score < 100000) {
    return { spaceFit: 0.2, simple: 0.3, complex: 0.3, large: 0.3 };
  } else {
    return { spaceFit: 0.15, simple: 0.25, complex: 0.35, large: 0.35 };
  }
}

let board = createEmptyBoard();
/** 보드 각 칸의 금괴 색상 변형(0~4). null이면 빈 칸 */
let cellVariants = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
let score = 0;
let bestScore = 0;
let totalLines = 0;
/** 연속으로 줄을 지운 턴 수 (같은 턴에 여러 줄 = 1콤보, 다음 턴에도 줄 지우면 2콤보) */
let currentCombo = 0;
let bestCombo = 0;
let activePieces = [];
/** 각 블럭의 금 색상 인덱스 (0~4). 생성 시 한 번 정하고 재렌더 시 유지 */
let activeVariants = [];
let dragging = null; // {pieceIndex, shape, offsetX, offsetY}
let hintTimeoutId = null;
/** 피버 게이지 (0~100) */
let feverGauge = 0;
/** 피버 모드 활성화 여부 */
let feverModeActive = false;
/** 피버 모드 종료 타이머 */
let feverModeTimer = null;
/** 콤보 타이머 (10초 카운트다운) */
let comboTimer = null;
let comboTimeLeft = 10;
/** 아이템 위치 선택 모드 (midas, hammer만 해당) */
let itemSelectionMode = { active: false, itemType: null };

const boardEl = document.getElementById('board');
const piecesEl = document.getElementById('pieces');
const scoreEl = document.getElementById('score');
const bestScoreEl = document.getElementById('bestScore');
const linesEl = document.getElementById('lines');
const currentComboEl = document.getElementById('currentCombo');
const bestComboEl = document.getElementById('bestCombo');
const lastGainEl = document.getElementById('lastGain');
const boardWrap = document.getElementById('boardWrap');
const effectLayer = document.getElementById('effectLayer');
const resetBtn = document.getElementById('resetBtn');
const hintBtn = document.getElementById('hintBtn');
const gameOverModal = document.getElementById('gameOverModal');
const restartBtn = document.getElementById('restartBtn');
const finalScoreEl = document.getElementById('finalScore');
const particleContainer = document.getElementById('particleContainer');
const feverGaugeEl = document.getElementById('feverGaugeFill');
const comboTimerEl = document.getElementById('comboTimer');
const itemBtn = document.getElementById('itemBtn');
const itemModal = document.getElementById('itemModal');
const closeItemModalBtn = document.getElementById('closeItemModal');
const playerRankEl = document.getElementById('playerRank');

/** 아이템 보유 개수 */
const ITEM_STORAGE_KEY = 'goldenblast-items';
let items = {
  midas: 0,
  launder: 0,
  hammer: 0,
  tax: 0,
};

/* ----- 사운드 (Web Audio API로 생성) ----- */
let audioCtx = null;
const BGM_STORAGE_KEY = 'blockblast-bgm-muted';
let bgmMuted = false;
let bgmNodes = null; // { gain, oscillators[] }
let bgmTingInterval = null; // melody interval

function initAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) {
    audioCtx = null;
  }
}

/** 동요 느낌이지만 덜 흔한 짧은 멜로디 (Hz). C major, 솔–라–도–미–레–솔–미–도 */
const BGM_MELODY = [392, 440, 262, 330, 294, 392, 330, 262];
const BGM_NOTE_DURATION = 0.52;
const BGM_NOTE_GAP = 0.1;

function startBGM() {
  if (!audioCtx || bgmNodes) return;
  bgmNodes = { active: true };

  let melodyIndex = 0;
  function playMelodyNote() {
    if (!audioCtx || !bgmNodes) return;
    const freq = BGM_MELODY[melodyIndex % BGM_MELODY.length];
    melodyIndex++;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(g);
    g.connect(audioCtx.destination);
    const t = audioCtx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.04);
    g.gain.linearRampToValueAtTime(0.04, t + BGM_NOTE_DURATION * 0.5);
    g.gain.exponentialRampToValueAtTime(0.001, t + BGM_NOTE_DURATION);
    osc.start(t);
    osc.stop(t + BGM_NOTE_DURATION);
  }
  const stepMs = (BGM_NOTE_DURATION + BGM_NOTE_GAP) * 1000;
  playMelodyNote();
  bgmTingInterval = setInterval(playMelodyNote, stepMs);
}

function stopBGM() {
  if (bgmTingInterval) {
    clearInterval(bgmTingInterval);
    bgmTingInterval = null;
  }
  bgmNodes = null;
}

function toggleBGM() {
  bgmMuted = !bgmMuted;
  try {
    localStorage.setItem(BGM_STORAGE_KEY, bgmMuted ? '1' : '0');
  } catch (e) {}
  const btn = document.getElementById('bgmBtn');
  if (btn) {
    btn.textContent = bgmMuted ? '🔇 배경음' : '🎵 배경음';
    btn.setAttribute('aria-pressed', bgmMuted ? 'true' : 'false');
  }
  if (bgmMuted) {
    stopBGM();
  } else {
    initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    function tryStart() {
      if (audioCtx.state === 'running') startBGM();
      else audioCtx.addEventListener('statechange', tryStart, { once: true });
    }
    tryStart();
  }
}

function playPlaceSound() {
  initAudio();
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.frequency.value = 280;
  osc.type = 'sine';
  gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.06);
}

function playLineClearSound(lineCount, combo) {
  initAudio();
  if (!audioCtx) return;
  const comboBoost = combo > 1 ? Math.min(combo * 0.08, 0.5) : 0;
  const baseFreq = 523 * (1 + comboBoost);
  const count = Math.min(lineCount, 5);
  for (let i = 0; i < count; i++) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = baseFreq * Math.pow(2, i * 0.2);
    osc.type = 'sine';
    const t = audioCtx.currentTime + i * 0.048;
    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.start(t);
    osc.stop(t + 0.12);
  }
}

function playGameOverSound() {
  initAudio();
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.frequency.setValueAtTime(220, audioCtx.currentTime);
  osc.frequency.linearRampToValueAtTime(165, audioCtx.currentTime + 0.35);
  osc.type = 'sine';
  gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.35);
}

function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
}

/** 보드가 완전히 비어 있는지(클리어된 상태) */
function isBoardClear() {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === 1) return false;
    }
  }
  return true;
}

function loadBestScore() {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      bestScore = parseInt(stored, 10) || 0;
      if (bestScoreEl) bestScoreEl.textContent = bestScore;
    }
  } catch (e) {
    // 무시
  }
}

function saveBestScore() {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, String(bestScore));
  } catch (e) {
    // 무시
  }
}

function loadItems() {
  try {
    const stored = localStorage.getItem(ITEM_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const sanitize = (v) => Math.max(0, parseInt(v, 10) || 0);
      items = {
        midas: sanitize(parsed.midas),
        launder: sanitize(parsed.launder),
        hammer: sanitize(parsed.hammer),
        tax: sanitize(parsed.tax),
      };
    } else {
      items = { midas: 1, launder: 2, hammer: 1, tax: 1 };
      saveItems();
    }
  } catch (e) {
    items = { midas: 1, launder: 2, hammer: 1, tax: 1 };
  }
  updateItemDisplays();
}

function saveItems() {
  try {
    localStorage.setItem(ITEM_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    // 무시
  }
}

function updateItemDisplays() {
  const midasCountEl = document.getElementById('itemMidasCount');
  const launderCountEl = document.getElementById('itemLaunderCount');
  const hammerCountEl = document.getElementById('itemHammerCount');
  const taxCountEl = document.getElementById('itemTaxCount');
  
  if (midasCountEl) midasCountEl.textContent = items.midas;
  if (launderCountEl) launderCountEl.textContent = items.launder;
  if (hammerCountEl) hammerCountEl.textContent = items.hammer;
  if (taxCountEl) taxCountEl.textContent = items.tax;
  
  /* 캔디크러시 스타일 아이템 바: 아이콘 슬롯 개수·비활성 동기화 */
  document.querySelectorAll('.item-slot').forEach((slot) => {
    const itemType = slot.dataset.item;
    const countEl = slot.querySelector('.item-slot-count');
    if (countEl) countEl.textContent = items[itemType] || 0;
    slot.disabled = !(items[itemType] > 0);
  });
  
  const useButtons = document.querySelectorAll('.item-use-btn');
  useButtons.forEach((btn) => {
    const itemType = btn.dataset.item;
    const hasItem = items[itemType] > 0;
    btn.disabled = !hasItem;
    const card = btn.closest('.item-card');
    if (card) {
      if (hasItem) {
        card.classList.remove('item-disabled');
      } else {
        card.classList.add('item-disabled');
      }
    }
  });
}

function updateRank() {
  if (!playerRankEl) return;
  const rank = calculateRank(score);
  playerRankEl.textContent = rank;
}

function calculateRank(score) {
  if (score < 1000) return 'F';
  if (score < 5000) return 'E';
  if (score < 10000) return 'D';
  if (score < 50000) return 'C';
  if (score < 100000) return 'B';
  if (score < 500000) return 'A';
  if (score < 1000000) return 'S';
  return 'SS';
}

function setupBoard() {
  boardEl.innerHTML = '';
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;

      const inner = document.createElement('div');
      inner.className = 'cell-inner';
      cell.appendChild(inner);

      boardEl.appendChild(cell);
    }
  }
  renderBoard();
}

/** 블록 재질 종류 (기획서: 5종 귀금속) */
const METAL_TYPES = {
  COPPER: 0,      // 구리 - 10p
  SILVER: 1,      // 은 - 20p
  PLATINUM: 2,    // 플래티넘 - 30p
  ROSE_GOLD: 3,   // 로즈골드 - 40p
  GOLD_24K: 4,    // 24K 순금 - 50p
};
const METAL_COUNT = 5;
const GOLD_VARIANT_COUNT = METAL_COUNT; // 호환성

/** 재질별 블록 1x1당 점수 (기획서 밸런스 테이블) */
const METAL_SCORES = [10, 20, 30, 40, 50]; // Copper, Silver, Platinum, Rose Gold, 24K Gold
const METAL_NAMES = ['Copper', 'Silver', 'Platinum', 'Rose Gold', '24K Gold'];

/** 콤보 회차별 가중치 (기획서 밸런스 테이블) */
function getComboMultiplier(comboCount) {
  if (comboCount <= 1) return 1.0;
  if (comboCount <= 5) return 1.0 + (comboCount - 1) * 0.02;  // 2~5: 10% (2%씩)
  if (comboCount <= 10) return 1.08 + (comboCount - 5) * 0.014; // 6~10: 15% (1.4%씩)
  if (comboCount <= 15) return 1.15 + (comboCount - 10) * 0.01; // 11~15: 20% (1%씩)
  return 1.2 + (comboCount - 15) * 0.01; // 16+: 계속 증가
}

/** 클리어 보드 보너스 비율 (기획서 밸런스 테이블) */
function getClearBoardBonusRatio(score) {
  if (score < 5000) return 1.0;   // 100%
  if (score < 10000) return 0.5;  // 50%
  if (score < 50000) return 0.3;  // 30%
  if (score < 100000) return 0.2; // 20%
  return 0.15; // 15%
}

function renderBoard() {
  if (!boardEl) return;
  boardEl.querySelectorAll('.cell').forEach((cell) => {
    const r = parseInt(cell.dataset.row, 10);
    const c = parseInt(cell.dataset.col, 10);
    for (let i = 0; i < GOLD_VARIANT_COUNT; i++) cell.classList.remove('gold-variant-' + i);
    cell.classList.remove('preview-okay', 'preview-bad');
    if (board[r][c] === 1) {
      let variant;
      if (feverModeActive) {
        variant = METAL_TYPES.GOLD_24K;
      } else {
        const v = cellVariants[r][c];
        variant = v != null ? v : (r + c) % GOLD_VARIANT_COUNT;
      }
      cell.classList.add('filled', 'gold-variant-' + variant);
    } else {
      cell.classList.remove('filled');
    }
  });
}

function formatScore(amount) {
  return '$' + amount.toLocaleString('en-US');
}

/** 점수 구간별 피버 발동 필요 콤보 수 (기획서 밸런스 테이블) */
function getFeverRequirement(score) {
  if (score < 5000) return 1000;
  if (score < 10000) return 2000;
  if (score < 50000) return 3000;
  if (score < 100000) return 4000;
  return 5000;
}

/** 콤보 타이머 시작/리셋 (10초) */
function startComboTimer() {
  if (comboTimer) clearInterval(comboTimer);
  comboTimeLeft = 10;
  if (comboTimerEl) comboTimerEl.textContent = '10s';
  comboTimer = setInterval(() => {
    comboTimeLeft--;
    if (comboTimerEl) comboTimerEl.textContent = comboTimeLeft + 's';
    if (comboTimeLeft <= 0) {
      clearInterval(comboTimer);
      comboTimer = null;
      if (currentCombo > 0) {
        currentCombo = 0;
        updateScoreDisplays('');
      }
      if (comboTimerEl) comboTimerEl.textContent = '';
    }
  }, 1000);
}

/** 피버 게이지 업데이트 (콤보 횟수로 축적) */
function updateFeverGauge(comboCount) {
  if (feverModeActive) return;
  const requirement = getFeverRequirement(score);
  const comboPoints = comboCount * 100;
  feverGauge = Math.min(100, feverGauge + (comboPoints / requirement) * 100);
  if (feverGaugeEl) {
    feverGaugeEl.style.width = feverGauge + '%';
  }
  if (feverGauge >= 100) {
    activateFeverMode();
  }
}

let feverOverlayEl = null;

/** 피버 모드 활성화 (골든 아워) */
function activateFeverMode() {
  feverModeActive = true;
  feverGauge = 100;
  if (feverGaugeEl) feverGaugeEl.style.width = '100%';
  if (boardWrap) boardWrap.classList.add('fever-active');
  document.body.classList.add('fever-mode');

  const overlay = document.createElement('div');
  overlay.className = 'fever-golden-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  const sparkleCount = 40;
  for (let i = 0; i < sparkleCount; i++) {
    const s = document.createElement('div');
    s.className = 'fever-sparkle';
    s.style.left = Math.random() * 100 + '%';
    s.style.top = Math.random() * 100 + '%';
    s.style.animationDelay = Math.random() * 1.5 + 's';
    s.style.animationDuration = (0.8 + Math.random() * 0.8) + 's';
    overlay.appendChild(s);
  }
  document.body.appendChild(overlay);
  feverOverlayEl = overlay;
  currentCombo = 0;
  if (comboTimer) {
    clearInterval(comboTimer);
    comboTimer = null;
  }
  if (comboTimerEl) comboTimerEl.textContent = '';
  if (effectLayer) {
    const pop = document.createElement('div');
    pop.className = 'fever-popup';
    pop.textContent = 'GOLDEN HOUR!';
    effectLayer.appendChild(pop);
    requestAnimationFrame(() => pop.classList.add('fever-popup-visible'));
    setTimeout(() => pop.remove(), 2000);
  }
  feverModeTimer = setTimeout(() => {
    deactivateFeverMode();
  }, 10000);
}

/** 피버 모드 비활성화 */
function deactivateFeverMode() {
  feverModeActive = false;
  feverGauge = 0;
  if (feverGaugeEl) feverGaugeEl.style.width = '0%';
  if (boardWrap) boardWrap.classList.remove('fever-active');
  document.body.classList.remove('fever-mode');
  if (feverOverlayEl && feverOverlayEl.parentNode) {
    feverOverlayEl.parentNode.removeChild(feverOverlayEl);
    feverOverlayEl = null;
  }
  if (feverModeTimer) {
    clearTimeout(feverModeTimer);
    feverModeTimer = null;
  }
}

function updateScoreDisplays(extraText = '') {
  if (scoreEl) scoreEl.textContent = formatScore(score);
  if (bestScoreEl) bestScoreEl.textContent = formatScore(bestScore);
  if (linesEl) linesEl.textContent = totalLines;
  if (currentComboEl) {
    currentComboEl.textContent = currentCombo;
    const comboBox = currentComboEl.closest('.score-box');
    if (comboBox) comboBox.classList.toggle('combo-active', currentCombo >= 2);
  }
  if (bestComboEl) bestComboEl.textContent = bestCombo;
  if (lastGainEl) lastGainEl.textContent = extraText;
}

/** 줄 클리어/콤보 시 띄울 감탄사 목록 */
const EXCLAMATIONS = {
  line: ['Nice!', 'Good!', 'Yeah!', 'Sweet!', 'Oh!', 'Yes!'],
  multiLine: ['Awesome!', 'Amazing!', 'Perfect!', 'Great!', 'Boom!', 'Incredible!', 'Wow!', 'Super!'],
  combo2: ['Combo!', 'Double!', 'Again!', 'Streak!', 'Two!', 'Nice!'],
  combo3: ['Legend!', 'Unreal!', 'Godlike!', 'Combo burst!', 'Incredible!', 'Ridiculous!', 'Fire!'],
};

function pickExclamation(cleared, comboCount) {
  if (comboCount >= 3) {
    return EXCLAMATIONS.combo3[Math.floor(Math.random() * EXCLAMATIONS.combo3.length)];
  }
  if (comboCount >= 2) {
    return EXCLAMATIONS.combo2[Math.floor(Math.random() * EXCLAMATIONS.combo2.length)];
  }
  if (cleared >= 2) {
    return EXCLAMATIONS.multiLine[Math.floor(Math.random() * EXCLAMATIONS.multiLine.length)];
  }
  return EXCLAMATIONS.line[Math.floor(Math.random() * EXCLAMATIONS.line.length)];
}

function showExclamationPopup(cleared, comboCount) {
  if (!effectLayer) return;
  const text = pickExclamation(cleared, comboCount);
  const pop = document.createElement('div');
  pop.className = 'exclamation-popup';
  pop.textContent = text;
  effectLayer.appendChild(pop);
  requestAnimationFrame(() => pop.classList.add('exclamation-popup-visible'));
  setTimeout(() => pop.remove(), 1000);
}

function showComboPopup(comboCount) {
  if (!effectLayer) return;
  const pop = document.createElement('div');
  pop.className = 'combo-popup';
  pop.textContent = 'COMBO x' + comboCount;
  effectLayer.appendChild(pop);
  requestAnimationFrame(() => pop.classList.add('combo-popup-visible'));
  setTimeout(() => {
    pop.remove();
  }, 900);
}

function screenShake() {
  if (!boardWrap) return;
  boardWrap.classList.remove('board-shake');
  void boardWrap.offsetWidth;
  boardWrap.classList.add('board-shake');
  setTimeout(() => boardWrap.classList.remove('board-shake'), 280);
}

function scoreFlash() {
  if (!scoreEl || !scoreEl.closest('.score-box')) return;
  const box = scoreEl.closest('.score-box');
  box.classList.remove('score-flash');
  void box.offsetWidth;
  box.classList.add('score-flash');
  setTimeout(() => box.classList.remove('score-flash'), 220);
}

function floatScorePopup(points) {
  if (!scoreEl) return;
  const rect = scoreEl.getBoundingClientRect();
  const pop = document.createElement('div');
  pop.className = 'float-score';
  pop.textContent = '+' + points;
  pop.style.left = rect.left + rect.width / 2 + 'px';
  pop.style.top = rect.top + 'px';
  document.body.appendChild(pop);
  requestAnimationFrame(() => pop.classList.add('float-score-visible'));
  setTimeout(() => pop.remove(), 800);
}

/** 3×3, 3×2, 2×3 블럭 인덱스 — 이 조합이 60% 이상 등장하도록 사용 */
const RECT_BLOCK_INDICES = [9, 10, 11]; // 3×2, 2×3, 3×3
const SHAPE_3X3 = 11;
const SHAPE_3X2 = 9;
const SHAPE_2X3 = 10;

function createRandomPiece(useBoardAware = true) {
  const rectBlockChance = 0.6; // 3×3, 3×2, 2×3 등장 비율 60%
  const weights = useBoardAware ? getPlacementWeights() : SHAPE_WEIGHTS.slice();

  const rectTotal = RECT_BLOCK_INDICES.reduce((s, i) => s + weights[i], 0);
  const restWeights = weights.slice();
  RECT_BLOCK_INDICES.forEach((i) => { restWeights[i] = 0; });
  const restTotal = restWeights.reduce((s, w) => s + w, 0);

  const useRectPool = rectTotal > 0 && (restTotal === 0 || Math.random() < rectBlockChance);
  const useRestPool = restTotal > 0 && !useRectPool;

  let index;
  if (useRectPool) {
    let r = Math.random() * rectTotal;
    for (const i of RECT_BLOCK_INDICES) {
      r -= weights[i];
      if (r <= 0) { index = i; break; }
    }
    if (index === undefined) index = RECT_BLOCK_INDICES[RECT_BLOCK_INDICES.length - 1];
  } else if (useRestPool) {
    let r = Math.random() * restTotal;
    index = 0; // fallback
    for (let i = 0; i < restWeights.length; i++) {
      if (restWeights[i] <= 0) continue;
      r -= restWeights[i];
      index = i;
      if (r <= 0) break;
    }
  } else {
    const pool = rectTotal > 0 ? RECT_BLOCK_INDICES : SHAPES.map((_, i) => i).filter((i) => !RECT_BLOCK_INDICES.includes(i));
    index = pool[Math.floor(Math.random() * pool.length)];
  }

  return SHAPES[index].map((row) => row.slice());
}

/** 두 블럭 형태가 동일한지 비교 */
function shapesEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  if (!a.length || !b.length) return false;
  if (a[0].length !== b[0].length) return false;
  for (let r = 0; r < a.length; r++) {
    for (let c = 0; c < a[0].length; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}

function generatePieces() {
  if (isBoardClear()) {
    // 클리어 상태: 3×3 2개 100%, 3×2 또는 2×3 각 80% 확률(나머지 20% 랜덤)
    let third = Math.random() < 0.8
      ? SHAPES[Math.random() < 0.5 ? SHAPE_3X2 : SHAPE_2X3].map((row) => row.slice())
      : createRandomPiece(true);
    const threeByThree = SHAPES[SHAPE_3X3].map((row) => row.slice());
    for (let retry = 0; retry < 50 && shapesEqual(third, threeByThree); retry++) {
      third = createRandomPiece(true);
    }
    activePieces = [
      SHAPES[SHAPE_3X3].map((row) => row.slice()),
      SHAPES[SHAPE_3X3].map((row) => row.slice()),
      third,
    ];
  } else {
    activePieces = [
      createRandomPiece(true),
      createRandomPiece(true),
      createRandomPiece(true),
    ];
    // 같은 블럭 3개 방지: 모두 동일하면 셋째만 다시 뽑기 (무한루프 방지: 최대 50회)
    for (let retry = 0; retry < 50 && shapesEqual(activePieces[0], activePieces[1]) && shapesEqual(activePieces[1], activePieces[2]); retry++) {
      activePieces[2] = createRandomPiece(true);
    }
  }
  activeVariants = activePieces.map(() => {
    if (feverModeActive) return METAL_TYPES.GOLD_24K;
    return Math.floor(Math.random() * GOLD_VARIANT_COUNT);
  });
  renderPieces();
}

function renderPieces() {
  if (!piecesEl) return;
  piecesEl.innerHTML = '';

  activePieces.forEach((shape, idx) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'piece-wrapper';

    if (!shape) {
      piecesEl.appendChild(wrapper);
      return;
    }

    const piece = document.createElement('div');
    const variant = activeVariants[idx] ?? Math.floor(Math.random() * GOLD_VARIANT_COUNT);
    piece.className = 'piece piece-gold-' + variant;
    piece.dataset.index = idx;

    const rows = shape.length;
    const cols = shape[0].length;
    piece.style.gridTemplateColumns = `repeat(${cols}, auto)`;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (shape[r][c] === 1) {
          const cell = document.createElement('div');
          cell.className = 'piece-cell';
          piece.appendChild(cell);
        } else {
          const empty = document.createElement('div');
          empty.className = 'piece-empty';
          piece.appendChild(empty);
        }
      }
    }

    piece.classList.add('piece-appear');
    wrapper.appendChild(piece);
    wrapper.addEventListener('mousedown', onPieceMouseDown);
    wrapper.addEventListener('touchstart', onPieceTouchStart, { passive: false });
    piecesEl.appendChild(wrapper);
  });
}

function getBoardCellFromPoint(x, y) {
  if (!boardEl) return null;
  const rect = boardEl.getBoundingClientRect();
  const cellSize = (rect.width - BOARD_PAD * 2) / BOARD_SIZE;
  const col = Math.floor((x - rect.left - BOARD_PAD) / cellSize);
  const row = Math.floor((y - rect.top - BOARD_PAD) / cellSize);

  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
    return null;
  }
  return { row, col };
}

function canPlace(shape, baseRow, baseCol) {
  const rows = shape.length;
  const cols = shape[0].length;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (shape[r][c] === 1) {
        const br = baseRow + r;
        const bc = baseCol + c;
        if (
          br < 0 ||
          br >= BOARD_SIZE ||
          bc < 0 ||
          bc >= BOARD_SIZE ||
          board[br][bc] === 1
        ) {
          return false;
        }
      }
    }
  }
  return true;
}

/** 현재 보드에서 이 블럭을 놓을 수 있는 위치 개수 */
function countValidPlacements(shape) {
  let count = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (canPlace(shape, r, c)) count++;
    }
  }
  return count;
}

/** 보드 남은 자리 기준 가중치: 각 블럭을 놓을 수 있는 위치 개수 (0이면 등장 안 함) */
function getPlacementWeights() {
  return SHAPES.map((_, i) => countValidPlacements(SHAPES[i]));
}

function placeShape(shape, baseRow, baseCol, variant) {
  const rows = shape.length;
  const cols = shape[0].length;
  let placedCount = 0;
  const v = variant != null ? variant : 0;
  const filledCells = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (shape[r][c] === 1) {
        const br = baseRow + r;
        const bc = baseCol + c;
        if (br >= 0 && br < BOARD_SIZE && bc >= 0 && bc < BOARD_SIZE) {
          board[br][bc] = 1;
          cellVariants[br][bc] = v;
          placedCount++;
          filledCells.push({ r: br, c: bc });
        }
      }
    }
  }

  playPlaceSound();

  const blockScore = placedCount * METAL_SCORES[v];
  const clearResult = clearCompletedLines();
  const cleared = typeof clearResult === 'number' ? clearResult : clearResult.count;
  const fullRows = clearResult.fullRows || [];
  const fullCols = clearResult.fullCols || [];
  const clearedBlockScore = clearResult.clearedBlockScore || 0;
  const isFullClear = clearResult.isFullClear || false;
  let gainText = `+${placedCount} ${METAL_NAMES[v]} block${placedCount !== 1 ? 's' : ''}`;
  let totalGain = blockScore;

  if (cleared > 0) {
    currentCombo++;
    totalLines += cleared;
    startComboTimer();

    const grantedItemName = currentCombo === 3 ? grantRandomItem() : null;

    const baseScore = blockScore + clearedBlockScore;
    const comboMultiplier = getComboMultiplier(currentCombo);
    let finalScore = Math.floor(baseScore * comboMultiplier);
    
    if (isFullClear) {
      const clearBoardRatio = getClearBoardBonusRatio(score);
      const clearBoardBonus = Math.floor(score * clearBoardRatio);
      finalScore += clearBoardBonus;
      if (effectLayer) {
        const pop = document.createElement('div');
        pop.className = 'clear-board-popup';
        pop.textContent = 'CLEAR BOARD!';
        effectLayer.appendChild(pop);
        requestAnimationFrame(() => pop.classList.add('clear-board-popup-visible'));
        setTimeout(() => pop.remove(), 2000);
      }
    }
    
    score += finalScore;
    totalGain = finalScore;
    if (currentCombo > bestCombo) bestCombo = currentCombo;
    updateFeverGauge(currentCombo);
    playLineClearSound(cleared, currentCombo);
    screenShake();
    scoreFlash();
    floatScorePopup(totalGain);
    // 여러 팝업 동시 노출 방지: 우선순위에 따라 하나만 표시
    if (isFullClear) {
      // 풀 클리어 시 CLEAR BOARD!만 표시 (위에서 이미 추가됨)
    } else if (currentCombo >= 2) {
      showComboPopup(currentCombo);
    } else {
      showExclamationPopup(cleared, currentCombo);
    }
    gainText = currentCombo >= 2
      ? `+${finalScore.toLocaleString()} pts (${cleared} line(s) · combo ${currentCombo}x!)`
      : `+${finalScore.toLocaleString()} pts (${cleared} line clear!)`;
    if (isFullClear) gainText += ` + Clear Board Bonus!`;
    if (grantedItemName) gainText += ` +1 ${grantedItemName}!`;
  } else {
    if (comboTimeLeft <= 0) {
      currentCombo = 0;
    }
    score += blockScore;
    scoreFlash();
    floatScorePopup(blockScore);
  }

  if (score > bestScore) {
    bestScore = score;
    saveBestScore();
  }

  updateScoreDisplays(gainText);
  updateRank();

  renderBoard();

  const clearedSet = new Set();
  fullRows.forEach((r) => { for (let c = 0; c < BOARD_SIZE; c++) clearedSet.add(`${r},${c}`); });
  fullCols.forEach((c) => { for (let r = 0; r < BOARD_SIZE; r++) clearedSet.add(`${r},${c}`); });
  filledCells.forEach(({ r, c }) => {
    if (clearedSet.has(`${r},${c}`)) return;
    const cell = boardEl.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
    if (cell) {
      cell.classList.add('cell-pop');
      setTimeout(() => cell.classList.remove('cell-pop'), 220);
    }
  });

  return cleared;
}

function clearCompletedLines() {
  const fullRows = [];
  const fullCols = [];

  // 행 검사
  for (let r = 0; r < BOARD_SIZE; r++) {
    if (board[r].every((cell) => cell === 1)) {
      fullRows.push(r);
    }
  }

  // 열 검사
  for (let c = 0; c < BOARD_SIZE; c++) {
    let allFilled = true;
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (board[r][c] === 0) {
        allFilled = false;
        break;
      }
    }
    if (allFilled) {
      fullCols.push(c);
    }
  }

  if (fullRows.length === 0 && fullCols.length === 0) return 0;

  const isFullClear = wouldBoardBeEmptyAfterClear(fullRows, fullCols);
  
  // 지워질 블록들의 재질별 점수 계산
  const clearedCells = new Set();
  let clearedBlockScore = 0;
  fullRows.forEach((r) => {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const key = `${r},${c}`;
      if (!clearedCells.has(key)) {
        clearedCells.add(key);
        const variant = cellVariants[r][c] ?? 0;
        clearedBlockScore += METAL_SCORES[variant];
      }
    }
  });
  fullCols.forEach((c) => {
    for (let r = 0; r < BOARD_SIZE; r++) {
      const key = `${r},${c}`;
      if (!clearedCells.has(key)) {
        clearedCells.add(key);
        const variant = cellVariants[r][c] ?? 0;
        clearedBlockScore += METAL_SCORES[variant];
      }
    }
  });
  
  const returnValue = { 
    count: fullRows.length + fullCols.length, 
    fullRows, 
    fullCols,
    clearedBlockScore,
    isFullClear
  };

  // 보드 번쩍임
  if (boardWrap) {
    boardWrap.classList.remove('board-flash');
    void boardWrap.offsetWidth;
    boardWrap.classList.add('board-flash');
    setTimeout(() => boardWrap.classList.remove('board-flash'), 520);
  }

  // 파티클 스폰 (번쩍번쩍 + 날아가는 효과)
  spawnClearParticles(fullRows, fullCols);

  // 애니메이션 클래스 추가 (왼쪽→오른쪽 / 위→아래로 파동처럼 터지도록 딜레이)
  boardEl.querySelectorAll('.cell').forEach((cell) => {
    const r = parseInt(cell.dataset.row, 10);
    const c = parseInt(cell.dataset.col, 10);
    if (fullRows.includes(r) || fullCols.includes(c)) {
      cell.classList.add('clearing');
      const inner = cell.querySelector('.cell-inner');
      if (inner) {
        const indexInLine = fullRows.includes(r) ? c : r;
        inner.style.animationDelay = `${indexInLine * 18}ms`;
      }
    }
  });

  // 애니메이션 후 실제 삭제 (스피디하게)
  const maxIndexInLine = BOARD_SIZE - 1;
  const extraDelay = maxIndexInLine * 18;
  setTimeout(() => {
    // 애니메이션 종료 후 clearing/지연 초기화
    boardEl.querySelectorAll('.cell').forEach((cell) => {
      cell.classList.remove('clearing');
      const inner = cell.querySelector('.cell-inner');
      if (inner) {
        inner.style.animationDelay = '';
      }
    });

    fullRows.forEach((r) => {
      for (let c = 0; c < BOARD_SIZE; c++) {
        board[r][c] = 0;
        cellVariants[r][c] = null;
      }
    });
    fullCols.forEach((c) => {
      for (let r = 0; r < BOARD_SIZE; r++) {
        board[r][c] = 0;
        cellVariants[r][c] = null;
      }
    });
    renderBoard();
    if (returnValue.isFullClear) triggerFullClearCelebration();
  }, 260 + extraDelay);

  return returnValue;
}

function wouldBoardBeEmptyAfterClear(fullRows, fullCols) {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === 1 && !fullRows.includes(r) && !fullCols.includes(c)) {
        return false;
      }
    }
  }
  return true;
}

function triggerFullClearCelebration() {
  spawnFullScreenFireworks();
  if (boardWrap) {
    boardWrap.classList.remove('board-rainbow');
    void boardWrap.offsetWidth;
    boardWrap.classList.add('board-rainbow');
    setTimeout(() => boardWrap.classList.remove('board-rainbow'), 4000);
  }
}

function spawnFullScreenFireworks() {
  const overlay = document.createElement('div');
  overlay.className = 'fireworks-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  const burstCount = 10;
  const particleCount = 14;
  const colors = ['#fef08a', '#facc15', '#fb923c', '#f97316', '#fbbf24', '#fde047'];

  for (let b = 0; b < burstCount; b++) {
    const burst = document.createElement('div');
    burst.className = 'firework-burst';
    burst.style.left = (10 + Math.random() * 80) + '%';
    burst.style.top = (10 + Math.random() * 80) + '%';
    burst.style.animationDelay = (b * 100 + Math.random() * 50) + 'ms';

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
      const dist = 80 + Math.random() * 100;
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist;
      const col = colors[b % colors.length];
      const p = document.createElement('div');
      p.className = 'firework-particle';
      p.style.setProperty('--tx', tx + 'px');
      p.style.setProperty('--ty', ty + 'px');
      p.style.background = col;
      p.style.color = col;
      burst.appendChild(p);
    }
    overlay.appendChild(burst);
  }

  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 2800);
}

function spawnClearParticles(fullRows, fullCols) {
  if (!particleContainer || !boardEl) return;
  const rect = boardEl.getBoundingClientRect();
  const cellSize = (rect.width - BOARD_PAD * 2) / BOARD_SIZE;
  const types = ['spark', 'gold', 'flare'];

  const clearingCells = new Set();
  fullRows.forEach((r) => {
    for (let c = 0; c < BOARD_SIZE; c++) clearingCells.add(`${r},${c}`);
  });
  fullCols.forEach((c) => {
    for (let r = 0; r < BOARD_SIZE; r++) clearingCells.add(`${r},${c}`);
  });

  clearingCells.forEach((key) => {
    const [r, c] = key.split(',').map(Number);
    const centerX = BOARD_PAD + c * cellSize + cellSize / 2;
    const centerY = BOARD_PAD + r * cellSize + cellSize / 2;
    const leftPct = (centerX / rect.width) * 100;
    const topPct = (centerY / rect.height) * 100;

    const count = 7 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.8;
      const dist = 35 + Math.random() * 45;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const p = document.createElement('div');
      p.className = 'clear-particle ' + types[i % types.length];
      p.style.left = leftPct + '%';
      p.style.top = topPct + '%';
      p.style.setProperty('--dx', dx + 'px');
      p.style.setProperty('--dy', dy + 'px');
      p.style.animationDelay = (Math.random() * 40 + (fullRows.includes(r) ? c : r) * 12) + 'ms';
      particleContainer.appendChild(p);
    }
  });

  setTimeout(() => {
    if (particleContainer) particleContainer.innerHTML = '';
  }, 600);
}

function clearPreview() {
  if (!boardEl) return;
  boardEl.querySelectorAll('.cell').forEach((cell) => {
    cell.classList.remove('preview-okay', 'preview-bad', 'item-target-preview');
  });
}

function clearItemTargetPreview() {
  if (!boardEl) return;
  boardEl.querySelectorAll('.cell').forEach((cell) => {
    cell.classList.remove('item-target-preview');
  });
}

/** 아이템 대상 영역 미리보기 (3×3 또는 4×4, 클릭한 셀을 중심으로) */
function applyItemTargetPreview(centerRow, centerCol, size) {
  if (!boardEl) return;
  clearItemTargetPreview();
  const r0 = Math.max(0, centerRow - 1);
  const r1 = Math.min(BOARD_SIZE - 1, centerRow + (size - 2));
  const c0 = Math.max(0, centerCol - 1);
  const c1 = Math.min(BOARD_SIZE - 1, centerCol + (size - 2));
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const cell = boardEl.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
      if (cell && board[r][c] === 1) cell.classList.add('item-target-preview');
    }
  }
}

function applyPreview(shape, baseRow, baseCol, isValid) {
  if (!boardEl) return;
  clearPreview();
  const rows = shape.length;
  const cols = shape[0].length;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (shape[r][c] === 1) {
        const br = baseRow + r;
        const bc = baseCol + c;
        const cell = boardEl.querySelector(
          `.cell[data-row="${br}"][data-col="${bc}"]`
        );
        if (cell) {
          cell.classList.add(isValid ? 'preview-okay' : 'preview-bad');
        }
      }
    }
  }
}

function createGhostPiece(shape) {
  const ghost = document.createElement('div');
  ghost.className = 'ghost-piece ghost-piece-on-board';
  const rows = shape.length;
  const cols = shape[0].length;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (shape[r][c] === 1) {
        const cell = document.createElement('div');
        cell.className = 'piece-cell';
        ghost.appendChild(cell);
      } else {
        const empty = document.createElement('div');
        empty.className = 'piece-empty';
        ghost.appendChild(empty);
      }
    }
  }

  if (boardWrap) boardWrap.appendChild(ghost);
  return ghost;
}

function onPieceMouseDown(e) {
  e.preventDefault();
  const wrapper = e.currentTarget;
  const piece = wrapper.querySelector('.piece');
  if (!piece) return;
  const index = parseInt(piece.dataset.index, 10);
  const shape = activePieces[index];
  if (!shape) return;

  const rect = piece.getBoundingClientRect();
  const offsetX = e.clientX - rect.left;
  const offsetY = e.clientY - rect.top;
  dragging = {
    pieceIndex: index,
    shape,
    offsetX,
    offsetY,
    ghost: createGhostPiece(shape),
  };

  piece.classList.add('dragging');
  wrapper.classList.add('dragging');

  updateGhostPosition(e.clientX, e.clientY);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

function onPieceTouchStart(e) {
  e.preventDefault();
  const touch = e.touches && e.touches[0];
  if (!touch) return;
  const wrapper = e.currentTarget;
  const piece = wrapper.querySelector('.piece');
  if (!piece) return;
  const index = parseInt(piece.dataset.index, 10);
  const shape = activePieces[index];
  if (!shape) return;

  const rect = piece.getBoundingClientRect();
  const offsetX = touch.clientX - rect.left;
  const offsetY = touch.clientY - rect.top;
  dragging = {
    pieceIndex: index,
    shape,
    offsetX,
    offsetY,
    ghost: createGhostPiece(shape),
  };

  piece.classList.add('dragging');
  wrapper.classList.add('dragging');

  updateGhostPosition(touch.clientX, touch.clientY);
  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('touchend', onTouchEnd);
  window.addEventListener('touchcancel', onTouchCancel);
}

const GHOST_CELL = 18;
const GHOST_GAP = 4;
const GHOST_PAD = 10;

function getGhostSize(shapeRows, shapeCols) {
  return {
    w: GHOST_PAD * 2 + shapeCols * GHOST_CELL + (shapeCols - 1) * GHOST_GAP,
    h: GHOST_PAD * 2 + shapeRows * GHOST_CELL + (shapeRows - 1) * GHOST_GAP,
  };
}

/** 보드 셀 크기 (getBoardCellFromPoint, updateGhostPosition와 동기화) */
function getBoardCellSize() {
  if (!boardEl) return 0;
  const rect = boardEl.getBoundingClientRect();
  return (rect.width - BOARD_PAD * 2) / BOARD_SIZE;
}

/** 커서보다 50px 위 지점=블럭 기준. 보드 셀 계산용 고스트 하단·좌측 픽셀 위치 */
const GHOST_OFFSET_Y = 50;

function getGhostBottomLeft(clientX, clientY, shapeRows, shapeCols) {
  const cellSize = getBoardCellSize();
  const ghostW = shapeCols * cellSize;
  return {
    x: clientX - ghostW / 2,
    y: clientY - GHOST_OFFSET_Y,
  };
}

function updateGhostPosition(clientX, clientY) {
  if (!dragging || !dragging.ghost || !boardEl || !boardWrap) return;
  const rows = dragging.shape.length;
  const cols = dragging.shape[0].length;

  const bottomLeft = getGhostBottomLeft(clientX, clientY, rows, cols);
  const cellPos = getBoardCellFromPoint(bottomLeft.x, bottomLeft.y);
  if (!cellPos) {
    dragging.ghost.style.visibility = 'hidden';
    clearPreview();
    return;
  }

  const baseRow = cellPos.row - (rows - 1);
  const baseCol = cellPos.col;
  if (baseRow < 0) {
    dragging.ghost.style.visibility = 'hidden';
    clearPreview();
    return;
  }

  const boardRect = boardEl.getBoundingClientRect();
  const wrapRect = boardWrap ? boardWrap.getBoundingClientRect() : boardRect;
  const cellSize = (boardRect.width - BOARD_PAD * 2) / BOARD_SIZE;

  dragging.ghost.style.visibility = 'visible';
  dragging.ghost.style.left = `${boardRect.left - wrapRect.left + BOARD_PAD + baseCol * cellSize}px`;
  dragging.ghost.style.top = `${boardRect.top - wrapRect.top + BOARD_PAD + baseRow * cellSize}px`;
  dragging.ghost.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
  dragging.ghost.style.gridTemplateRows = `repeat(${rows}, ${cellSize}px)`;
  dragging.ghost.style.gap = '0';
  dragging.ghost.style.padding = '0';
  dragging.ghost.style.width = `${cols * cellSize}px`;
  dragging.ghost.style.height = `${rows * cellSize}px`;

  const isValid = canPlace(dragging.shape, baseRow, baseCol);
  applyPreview(dragging.shape, baseRow, baseCol, isValid);
}

function removeDragListeners() {
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
  window.removeEventListener('touchmove', onTouchMove);
  window.removeEventListener('touchend', onTouchEnd);
  window.removeEventListener('touchcancel', onTouchCancel);
}

function cleanupDrag() {
  if (!dragging) return;
  const { pieceIndex, ghost } = dragging;
  const pieceEl = piecesEl?.querySelector(`.piece[data-index="${pieceIndex}"]`);
  if (pieceEl) {
    pieceEl.classList.remove('dragging');
    const wr = pieceEl.closest('.piece-wrapper');
    if (wr) wr.classList.remove('dragging');
  }
  if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
  clearPreview();
  removeDragListeners();
  dragging = null;
}

function finishDrag(clientX, clientY) {
  if (!dragging) return;

  const { pieceIndex, shape } = dragging;
  const pieceEl = piecesEl?.querySelector(`.piece[data-index="${pieceIndex}"]`);

  const rows = shape.length;
  const cols = shape[0].length;
  const bottomLeft = getGhostBottomLeft(clientX, clientY, rows, cols);
  const cellPos = getBoardCellFromPoint(bottomLeft.x, bottomLeft.y);
  clearPreview();

  const baseRow = cellPos ? cellPos.row - (rows - 1) : -1;
  const baseCol = cellPos ? cellPos.col : 0;
  if (cellPos && baseRow >= 0 && canPlace(shape, baseRow, baseCol)) {
    let variant = 0;
    if (pieceEl) {
      for (let i = 0; i < GOLD_VARIANT_COUNT; i++) {
        if (pieceEl.classList.contains('piece-gold-' + i)) {
          variant = i;
          break;
        }
      }
    }
    const clearedLines = placeShape(shape, baseRow, baseCol, variant);
    activePieces[pieceIndex] = null;
    renderPieces();

    if (activePieces.every((p) => p === null)) {
      generatePieces();
    }

    const checkGameOver = () => {
      if (!hasAnyValidMove()) handleGameOver();
    };
    if (clearedLines > 0) {
      const extraDelay = (BOARD_SIZE - 1) * 18;
      setTimeout(checkGameOver, 260 + extraDelay);
    } else {
      checkGameOver();
    }
  }

  if (dragging.ghost && dragging.ghost.parentNode) {
    dragging.ghost.parentNode.removeChild(dragging.ghost);
  }
  if (pieceEl) {
    pieceEl.classList.remove('dragging');
    const wr = pieceEl.closest('.piece-wrapper');
    if (wr) wr.classList.remove('dragging');
  }
  removeDragListeners();
  dragging = null;
}

function onMouseMove(e) {
  e.preventDefault();
  updateGhostPosition(e.clientX, e.clientY);
}

function onMouseUp(e) {
  e.preventDefault();
  finishDrag(e.clientX, e.clientY);
}

function onTouchMove(e) {
  e.preventDefault();
  const touch = e.touches && e.touches[0];
  if (touch) updateGhostPosition(touch.clientX, touch.clientY);
}

function onTouchEnd(e) {
  e.preventDefault();
  const touch = e.changedTouches && e.changedTouches[0];
  if (touch) {
    finishDrag(touch.clientX, touch.clientY);
  } else {
    cleanupDrag();
  }
}

function onTouchCancel(e) {
  e.preventDefault();
  const touch = e.changedTouches && e.changedTouches[0];
  if (touch) {
    finishDrag(touch.clientX, touch.clientY);
  } else {
    cleanupDrag();
  }
}

function hasAnyValidMove() {
  for (let i = 0; i < activePieces.length; i++) {
    const shape = activePieces[i];
    if (!shape) continue;

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (canPlace(shape, r, c)) {
          return true;
        }
      }
    }
  }
  return false;
}

function findHintMove() {
  for (let i = 0; i < activePieces.length; i++) {
    const shape = activePieces[i];
    if (!shape) continue;

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (canPlace(shape, r, c)) {
          return { pieceIndex: i, shape, row: r, col: c };
        }
      }
    }
  }
  return null;
}

function clearHintHighlight() {
  boardEl.querySelectorAll('.cell').forEach((cell) => {
    cell.classList.remove('preview-okay');
  });
  piecesEl.querySelectorAll('.piece').forEach((p) => p.classList.remove('hinted'));
}

function showHint() {
  if (!hasAnyValidMove()) {
    if (lastGainEl) {
      lastGainEl.textContent = 'No valid spots left. Game will end soon.';
    }
    return;
  }

  const move = findHintMove();
  if (!move) {
    if (lastGainEl) {
      lastGainEl.textContent = 'No valid spots.';
    }
    return;
  }

  clearHintHighlight();
  applyPreview(move.shape, move.row, move.col, true);
  const pieceEl = piecesEl.querySelector(`.piece[data-index="${move.pieceIndex}"]`);
  if (pieceEl) {
    pieceEl.classList.add('hinted');
  }

  if (hintTimeoutId) {
    clearTimeout(hintTimeoutId);
  }
  hintTimeoutId = setTimeout(() => {
    clearHintHighlight();
  }, 1500);

  if (lastGainEl) {
    lastGainEl.textContent = 'Hint: Place the highlighted block on the green spot.';
  }
}

function handleGameOver() {
  playGameOverSound();
  if (finalScoreEl) finalScoreEl.textContent = formatScore(score);
  if (gameOverModal) {
    gameOverModal.classList.remove('hidden');
    requestAnimationFrame(() => {
      gameOverModal.classList.add('modal-visible');
    });
  }
}

function resetGame() {
  if (itemSelectionMode.active) exitItemSelectionMode();
  cleanupDrag();
  board = createEmptyBoard();
  cellVariants = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
  score = 0;
  totalLines = 0;
  currentCombo = 0;
  bestCombo = 0;
  feverGauge = 0;
  feverModeActive = false;
  comboTimeLeft = 10;
  if (comboTimer) {
    clearInterval(comboTimer);
    comboTimer = null;
  }
  if (feverModeTimer) {
    clearTimeout(feverModeTimer);
    feverModeTimer = null;
  }
  if (feverGaugeEl) feverGaugeEl.style.width = '0%';
  if (comboTimerEl) comboTimerEl.textContent = '';
  if (boardWrap) {
    boardWrap.classList.remove('board-rainbow', 'fever-active');
  }
  document.body.classList.remove('fever-mode');
  if (feverOverlayEl && feverOverlayEl.parentNode) {
    feverOverlayEl.parentNode.removeChild(feverOverlayEl);
    feverOverlayEl = null;
  }
  updateScoreDisplays('');
  updateRank();
  if (effectLayer) effectLayer.innerHTML = '';
  document.querySelectorAll('.fireworks-overlay').forEach((el) => el.remove());
  if (boardEl) renderBoard();
  if (piecesEl) {
    piecesEl.innerHTML = '';
    generatePieces();
  }
  if (gameOverModal) {
    gameOverModal.classList.add('hidden');
    gameOverModal.classList.remove('modal-visible');
  }
}

function useMidasTouch(centerRow, centerCol) {
  if (items.midas <= 0) return false;
  const cr = centerRow != null ? centerRow : Math.floor(BOARD_SIZE / 2);
  const cc = centerCol != null ? centerCol : Math.floor(BOARD_SIZE / 2);
  const targetCells = [];
  for (let r = cr - 1; r <= cr + 1; r++) {
    for (let c = cc - 1; c <= cc + 1; c++) {
      if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === 1) {
        targetCells.push({ r, c });
      }
    }
  }
  if (targetCells.length === 0) {
    items.midas--;
    saveItems();
    updateItemDisplays();
    return true;
  }
  targetCells.forEach(({ r, c }) => {
    cellVariants[r][c] = METAL_TYPES.GOLD_24K;
  });
  renderBoard();
  setTimeout(() => {
    spawnItemExplosionEffect(targetCells);
    clearCellsWithRandomOrder(targetCells, () => METAL_SCORES[METAL_TYPES.GOLD_24K], (count, clearedScore) => {
      score += clearedScore;
      screenShake();
      scoreFlash();
      floatScorePopup(clearedScore);
      if (score > bestScore) {
        bestScore = score;
        saveBestScore();
      }
      updateScoreDisplays(`Midas Touch: ${count} blocks turned to gold!`);
      updateRank();
    });
  }, 300);
  items.midas--;
  saveItems();
  updateItemDisplays();
  return true;
}

function useMoneyLaunder() {
  if (items.launder <= 0) return false;
  generatePieces();
  items.launder--;
  saveItems();
  updateItemDisplays();
  if (lastGainEl) lastGainEl.textContent = 'Money Launder: Blocks refreshed!';
  return true;
}

function useGoldenHammer(centerRow, centerCol) {
  if (items.hammer <= 0) return false;
  const cr = centerRow != null ? centerRow : Math.floor(BOARD_SIZE / 2);
  const cc = centerCol != null ? centerCol : Math.floor(BOARD_SIZE / 2);
  const targetCells = [];
  for (let r = cr - 1; r <= cr + 2; r++) {
    for (let c = cc - 1; c <= cc + 2; c++) {
      if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === 1) {
        targetCells.push({ r, c });
      }
    }
  }
  spawnItemExplosionEffect(targetCells);
  clearCellsWithRandomOrder(targetCells, (r, c) => METAL_SCORES[cellVariants[r][c] ?? 0], (clearedCount, clearedScore) => {
    if (clearedCount > 0) {
      score += clearedScore;
      screenShake();
      scoreFlash();
      floatScorePopup(clearedScore);
      if (score > bestScore) {
        bestScore = score;
        saveBestScore();
      }
      updateScoreDisplays(`Golden Hammer cleared ${clearedCount} blocks!`);
      updateRank();
    }
  });
  items.hammer--;
  saveItems();
  updateItemDisplays();
  return true;
}

function useTaxBreak() {
  if (items.tax <= 0) return false;
  const variantCounts = [0, 0, 0, 0, 0];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === 1 && cellVariants[r][c] != null) {
        variantCounts[cellVariants[r][c]]++;
      }
    }
  }
  const mostCommonVariant = variantCounts.indexOf(Math.max(...variantCounts));
  const targetCells = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === 1 && cellVariants[r][c] === mostCommonVariant) {
        targetCells.push({ r, c });
      }
    }
  }
  spawnItemExplosionEffect(targetCells);
  clearCellsWithRandomOrder(targetCells, () => METAL_SCORES[mostCommonVariant], (clearedCount, clearedScore) => {
    if (clearedCount > 0) {
      score += clearedScore;
      screenShake();
      scoreFlash();
      floatScorePopup(clearedScore);
      if (score > bestScore) {
        bestScore = score;
        saveBestScore();
      }
      updateScoreDisplays(`Tax Break cleared ${clearedCount} ${METAL_NAMES[mostCommonVariant]} blocks!`);
      updateRank();
    }
  });
  items.tax--;
  saveItems();
  updateItemDisplays();
  return true;
}

/** 아이템으로 제거되는 블럭을 랜덤 순서로 사라지게 함 */
function clearCellsWithRandomOrder(targetCells, getScoreForCell, onComplete) {
  if (!targetCells.length || !boardEl) {
    if (onComplete) onComplete(0, 0);
    return;
  }
  const shuffled = [...targetCells].sort(() => Math.random() - 0.5);
  let maxDelay = 0;
  shuffled.forEach(({ r, c }, i) => {
    const delay = i * 25 + Math.random() * 50;
    maxDelay = Math.max(maxDelay, delay);
    const cell = boardEl.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
    if (cell) {
      cell.classList.add('clearing');
      const inner = cell.querySelector('.cell-inner');
      if (inner) inner.style.animationDelay = delay + 'ms';
    }
  });

  setTimeout(() => {
    let clearedScore = 0;
    targetCells.forEach(({ r, c }) => {
      clearedScore += getScoreForCell ? getScoreForCell(r, c) : 0;
      board[r][c] = 0;
      cellVariants[r][c] = null;
    });
    renderBoard();
    boardEl?.querySelectorAll('.cell.clearing').forEach((cell) => {
      cell.classList.remove('clearing');
      const inner = cell.querySelector('.cell-inner');
      if (inner) inner.style.animationDelay = '';
    });
    if (onComplete) onComplete(targetCells.length, clearedScore);
  }, maxDelay + 280);
}

const ITEM_NAMES = {
  midas: 'Midas Touch',
  launder: 'Money Launder',
  hammer: 'Golden Hammer',
  tax: 'Tax Break',
};

const ITEM_ICONS = {
  midas: '👑',
  launder: '💼',
  hammer: '🔨',
  tax: '📋',
};

const ITEM_TYPES = ['midas', 'launder', 'hammer', 'tax'];

function grantRandomItem() {
  const itemType = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
  items[itemType]++;
  saveItems();
  updateItemDisplays();
  return ITEM_NAMES[itemType];
}

/** 블럭 셀들에서 폭발 이펙트 스폰 */
function spawnItemExplosionEffect(cells) {
  if (!particleContainer || !boardEl || !cells.length) return;
  const rect = boardEl.getBoundingClientRect();
  const cellSize = (rect.width - BOARD_PAD * 2) / BOARD_SIZE;
  const types = ['spark', 'gold', 'flare'];

  cells.forEach(({ r, c }) => {
    const centerX = BOARD_PAD + c * cellSize + cellSize / 2;
    const centerY = BOARD_PAD + r * cellSize + cellSize / 2;
    const leftPct = (centerX / rect.width) * 100;
    const topPct = (centerY / rect.height) * 100;

    const count = 12 + Math.floor(Math.random() * 6);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 1.2;
      const dist = 55 + Math.random() * 70;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const p = document.createElement('div');
      p.className = 'clear-particle item-explosion-particle ' + types[i % types.length];
      p.style.left = leftPct + '%';
      p.style.top = topPct + '%';
      p.style.setProperty('--dx', dx + 'px');
      p.style.setProperty('--dy', dy + 'px');
      p.style.animationDelay = (Math.random() * 50) + 'ms';
      p.style.animationDuration = '0.5s';
      particleContainer.appendChild(p);
    }
  });

  setTimeout(() => {
    if (particleContainer) {
      particleContainer.querySelectorAll('.item-explosion-particle').forEach((el) => el.remove());
    }
  }, 600);
}

/** 아이템 사용 시 화려한 이펙트: 큰 아이콘 + 팝업 + 폭죽 + 보드 플래시 */
function showItemEffect(itemType) {
  const labels = {
    midas: 'MIDAS TOUCH!',
    launder: 'MONEY LAUNDER!',
    hammer: 'GOLDEN HAMMER!',
    tax: 'TAX BREAK!',
  };
  const label = labels[itemType] || 'ITEM USED!';
  const icon = ITEM_ICONS[itemType] || '✨';

  if (effectLayer) {
    const iconEl = document.createElement('div');
    iconEl.className = 'item-effect-icon';
    iconEl.textContent = icon;
    iconEl.setAttribute('aria-hidden', 'true');
    effectLayer.appendChild(iconEl);
    requestAnimationFrame(() => iconEl.classList.add('item-effect-icon-visible'));
    setTimeout(() => iconEl.remove(), 1800);
  }

  const overlay = document.createElement('div');
  overlay.className = 'item-effect-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  const pop = document.createElement('div');
  pop.className = 'item-effect-popup';
  pop.textContent = label;
  overlay.appendChild(pop);

  const burstCount = 5;
  const particleCount = 12;
  const colors = ['#fef08a', '#facc15', '#fb923c', '#f97316', '#fbbf24', '#fde047', '#a3e635', '#22d3ee'];

  for (let b = 0; b < burstCount; b++) {
    const burst = document.createElement('div');
    burst.className = 'firework-burst';
    burst.style.left = (30 + Math.random() * 40) + '%';
    burst.style.top = (25 + Math.random() * 50) + '%';
    burst.style.animationDelay = (b * 80 + Math.random() * 40) + 'ms';

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.6;
      const dist = 60 + Math.random() * 80;
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist;
      const col = colors[b % colors.length];
      const p = document.createElement('div');
      p.className = 'firework-particle';
      p.style.setProperty('--tx', tx + 'px');
      p.style.setProperty('--ty', ty + 'px');
      p.style.background = col;
      p.style.color = col;
      burst.appendChild(p);
    }
    overlay.appendChild(burst);
  }

  document.body.appendChild(overlay);
  requestAnimationFrame(() => {
    overlay.classList.add('item-effect-overlay-visible');
    pop.classList.add('item-effect-popup-visible');
  });

  if (boardWrap) {
    boardWrap.classList.remove('board-flash', 'board-shake');
    void boardWrap.offsetWidth;
    boardWrap.classList.add('board-flash');
    boardWrap.classList.add('board-shake');
    setTimeout(() => {
      boardWrap.classList.remove('board-flash');
    }, 520);
    setTimeout(() => boardWrap.classList.remove('board-shake'), 300);
  }

  setTimeout(() => overlay.remove(), 2200);
}

const ITEMS_NEED_POSITION = ['midas', 'hammer'];

let itemTouchPromptEl = null;

function enterItemSelectionMode(itemType) {
  itemSelectionMode = { active: true, itemType };
  if (boardWrap) boardWrap.classList.add('item-selection-mode');
  if (effectLayer) {
    itemTouchPromptEl = document.createElement('div');
    itemTouchPromptEl.className = 'item-touch-prompt';
    itemTouchPromptEl.setAttribute('aria-hidden', 'true');
    itemTouchPromptEl.innerHTML = '<span class="item-touch-icon">👆</span><span class="item-touch-text">보드판을 터치하세요</span>';
    effectLayer.appendChild(itemTouchPromptEl);
  }
}

function exitItemSelectionMode() {
  itemSelectionMode = { active: false, itemType: null };
  clearItemTargetPreview();
  if (itemTouchPromptEl && itemTouchPromptEl.parentNode) {
    itemTouchPromptEl.parentNode.removeChild(itemTouchPromptEl);
    itemTouchPromptEl = null;
  }
  if (boardWrap) boardWrap.classList.remove('item-selection-mode');
}

function handleItemUse(itemType) {
  if (!itemType || !ITEM_TYPES.includes(itemType)) return;
  if (items[itemType] <= 0) return;
  const itemName = ITEM_NAMES[itemType] || itemType;
  if (!confirm(`Use ${itemName}?`)) return;
  let used = false;
  if (ITEMS_NEED_POSITION.includes(itemType)) {
    enterItemSelectionMode(itemType);
    return;
  }
  switch (itemType) {
    case 'launder':
      used = useMoneyLaunder();
      break;
    case 'tax':
      used = useTaxBreak();
      break;
    default:
      return;
  }
  if (used) {
    closeItemModal();
    showItemEffect(itemType);
  }
}

function applyItemAtPosition(centerRow, centerCol) {
  const { itemType } = itemSelectionMode;
  if (!itemType) return;
  exitItemSelectionMode();
  let used = false;
  if (itemType === 'midas') used = useMidasTouch(centerRow, centerCol);
  else if (itemType === 'hammer') used = useGoldenHammer(centerRow, centerCol);
  if (used) {
    closeItemModal();
    showItemEffect(itemType);
  }
}

resetBtn.addEventListener('click', resetGame);
restartBtn.addEventListener('click', resetGame);
if (hintBtn) {
  hintBtn.addEventListener('click', showHint);
}
function openItemModal() {
  if (!itemModal) return;
  itemModal.classList.remove('hidden');
  updateItemDisplays();
  requestAnimationFrame(() => {
    itemModal.classList.add('modal-visible');
  });
}

function closeItemModal() {
  if (!itemModal) return;
  itemModal.classList.add('hidden');
  itemModal.classList.remove('modal-visible');
}

if (itemBtn) {
  itemBtn.addEventListener('click', openItemModal);
}

/* 캔디크러시 스타일: 아이템 바 슬롯 클릭 시 사용 */
document.getElementById('itemBar')?.addEventListener('click', (e) => {
  const slot = e.target.closest('.item-slot');
  if (!slot || slot.disabled) return;
  const itemType = slot.dataset.item;
  if (!itemType) return;
  handleItemUse(itemType);
});
if (closeItemModalBtn) {
  closeItemModalBtn.addEventListener('click', closeItemModal);
}

// 모달 외부 클릭 시 닫기
if (itemModal) {
  itemModal.addEventListener('click', (e) => {
    if (e.target === itemModal) {
      closeItemModal();
    }
  });
}

// ESC 키로 모달 닫기 / 아이템 선택 모드 취소
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (itemSelectionMode.active) {
    exitItemSelectionMode();
    return;
  }
  if (itemModal && !itemModal.classList.contains('hidden')) {
    closeItemModal();
  }
});

// 아이템 위치 선택: 보드 클릭
if (boardEl) {
  boardEl.addEventListener('click', (e) => {
    if (!itemSelectionMode.active) return;
    e.preventDefault();
    e.stopPropagation();
    const cellPos = getBoardCellFromPoint(e.clientX, e.clientY);
    if (cellPos) applyItemAtPosition(cellPos.row, cellPos.col);
  });
  boardEl.addEventListener('mousemove', (e) => {
    if (!itemSelectionMode.active) return;
    const cellPos = getBoardCellFromPoint(e.clientX, e.clientY);
    if (cellPos) {
      const size = itemSelectionMode.itemType === 'hammer' ? 4 : 3;
      applyItemTargetPreview(cellPos.row, cellPos.col, size);
    } else {
      clearItemTargetPreview();
    }
  });
  boardEl.addEventListener('mouseleave', () => {
    if (itemSelectionMode.active) clearItemTargetPreview();
  });
  boardEl.addEventListener('touchstart', (e) => {
    if (!itemSelectionMode.active) return;
    const touch = e.touches && e.touches[0];
    if (!touch) return;
    e.preventDefault();
    const cellPos = getBoardCellFromPoint(touch.clientX, touch.clientY);
    if (cellPos) applyItemAtPosition(cellPos.row, cellPos.col);
  }, { passive: false });
}

// 아이템 사용 버튼 이벤트 (동적으로 생성되는 요소 대응)
function setupItemButtons() {
  document.querySelectorAll('.item-use-btn').forEach((btn) => {
    // 기존 리스너 제거 후 재등록
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', (e) => {
      const itemType = e.currentTarget.dataset.item;
      handleItemUse(itemType);
    });
  });
}

setupItemButtons();

// 사용자 제스처 시 오디오 잠금 해제 (브라우저 정책)
function unlockAudio() {
  initAudio();
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  if (audioCtx && !bgmMuted) {
    function tryStartBGM() {
      if (audioCtx.state === 'running') startBGM();
      else audioCtx.addEventListener('statechange', tryStartBGM, { once: true });
    }
    tryStartBGM();
  }
}
document.addEventListener('click', unlockAudio, { once: true });
document.addEventListener('touchstart', unlockAudio, { once: true });

// 배경음 설정 로드 및 버튼 초기 상태
try {
  bgmMuted = localStorage.getItem(BGM_STORAGE_KEY) === '1';
} catch (e) {}
const bgmBtn = document.getElementById('bgmBtn');
if (bgmBtn) {
  bgmBtn.textContent = bgmMuted ? '🔇 BGM' : '🎵 BGM';
  bgmBtn.setAttribute('aria-pressed', bgmMuted ? 'true' : 'false');
  bgmBtn.addEventListener('click', toggleBGM);
}

// 초기화 - DOM이 로드된 후 실행
function initGame() {
  if (!boardEl || !piecesEl) {
    console.error('DOM elements not found');
    return;
  }
  loadBestScore();
  loadItems();
  setupBoard();
  updateScoreDisplays('');
  updateRank();
  generatePieces();
}

// DOM이 준비되면 초기화
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGame);
} else {
  // DOM이 이미 로드된 경우 즉시 실행
  initGame();
}

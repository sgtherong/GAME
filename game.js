const BOARD_SIZE = 8;
const LOCAL_STORAGE_KEY = 'blockblast-best-score';

/** 간단한 블록 패턴들 (1은 블록, 0은 빈 칸). 1칸 블록 제외 */
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
];

/** 블록별 배치 난이도 가중치 (사각형 2×2, 3×3 비율 더 높임) */
const SHAPE_WEIGHTS = [
  6, 6,       // 0,1: 두 칸 직선
  5, 5,       // 2,3: 세 칸 직선
  3, 3,       // 4,5: 네 칸 직선
  2, 2,       // 6,7: 다섯 칸 직선
  8,          // 8: 2×2 정사각
  3, 3,       // 9,10: 3×2, 2×3
  4,          // 11: 3×3 정사각
  2, 2, 2, 2, // 12–15: L자
  2, 2,       // 16,17: 계단
  2, 2, 2, 2, // 18–21: T자
];

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
const closeItemModal = document.getElementById('closeItemModal');
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

function loadBestScore() {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      bestScore = parseInt(stored, 10) || 0;
      bestScoreEl.textContent = bestScore;
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
      items = { ...items, ...parsed };
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
  document.getElementById('itemMidasCount').textContent = items.midas;
  document.getElementById('itemLaunderCount').textContent = items.launder;
  document.getElementById('itemHammerCount').textContent = items.hammer;
  document.getElementById('itemTaxCount').textContent = items.tax;
  const useButtons = document.querySelectorAll('.item-use-btn');
  useButtons.forEach((btn) => {
    const itemType = btn.dataset.item;
    btn.disabled = items[itemType] <= 0;
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

function renderBoard() {
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

/** 피버 게이지 업데이트 */
function updateFeverGauge(comboGain) {
  if (feverModeActive) return;
  const requirement = getFeverRequirement(score);
  feverGauge = Math.min(100, feverGauge + (comboGain / requirement) * 100);
  if (feverGaugeEl) {
    feverGaugeEl.style.width = feverGauge + '%';
  }
  if (feverGauge >= 100) {
    activateFeverMode();
  }
}

/** 피버 모드 활성화 (골든 아워) */
function activateFeverMode() {
  feverModeActive = true;
  feverGauge = 100;
  if (feverGaugeEl) feverGaugeEl.style.width = '100%';
  if (boardWrap) boardWrap.classList.add('fever-active');
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
  if (feverModeTimer) {
    clearTimeout(feverModeTimer);
    feverModeTimer = null;
  }
}

function updateScoreDisplays(extraText = '') {
  scoreEl.textContent = formatScore(score);
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

function createRandomPiece(useBoardAware = true) {
  const weights = useBoardAware ? getBoardAwareWeights() : SHAPE_WEIGHTS;
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  if (totalWeight <= 0) {
    const index = Math.floor(Math.random() * SHAPES.length);
    return SHAPES[index].map((row) => row.slice());
  }
  let r = Math.random() * totalWeight;
  let index = 0;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) {
      index = i;
      break;
    }
  }
  const shape = SHAPES[index];
  return shape.map((row) => row.slice());
}

function generatePieces() {
  activePieces = [
    createRandomPiece(true),
    createRandomPiece(true),
    createRandomPiece(true),
  ];
  activeVariants = activePieces.map(() => {
    if (feverModeActive) return METAL_TYPES.GOLD_24K;
    return Math.floor(Math.random() * GOLD_VARIANT_COUNT);
  });
  renderPieces();
}

function renderPieces() {
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
  const rect = boardEl.getBoundingClientRect();
  const size = rect.width;
  const cellSize = size / BOARD_SIZE;

  const col = Math.floor((x - rect.left) / cellSize);
  const row = Math.floor((y - rect.top) / cellSize);

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

/** 보드 상황에 맞는 블럭 가중치: 놓을 수 없으면 0, 놓을 수 있으면 보드에 맞을수록 확률 up */
function getBoardAwareWeights() {
  return SHAPE_WEIGHTS.map((base, i) => {
    const placements = countValidPlacements(SHAPES[i]);
    if (placements === 0) return 0;
    return base * (2 + placements);
  });
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
  let gainText = `+${placedCount} ${METAL_NAMES[v]} block${placedCount !== 1 ? 's' : ''}`;
  let lineScore = 0;
  let totalGain = blockScore;

  if (cleared > 0) {
    currentCombo++;
    totalLines += cleared;
    startComboTimer();
    const clearedBlockCount = cleared * BOARD_SIZE;
    lineScore = clearedBlockCount * 20;
    const comboMultiplier = 1 + (currentCombo - 1) * 0.1;
    const comboBonus = Math.floor((blockScore + lineScore) * (comboMultiplier - 1));
    const finalScore = Math.floor((blockScore + lineScore) * comboMultiplier);
    score += finalScore;
    totalGain = finalScore;
    if (currentCombo > bestCombo) bestCombo = currentCombo;
    updateFeverGauge(finalScore);
    playLineClearSound(cleared, currentCombo);
    screenShake();
    scoreFlash();
    floatScorePopup(totalGain);
    showExclamationPopup(cleared, currentCombo);
    if (currentCombo >= 2) showComboPopup(currentCombo);
    gainText = currentCombo >= 2
      ? `+${finalScore.toLocaleString()} pts (${cleared} line(s) · combo ${currentCombo}x!)`
      : `+${finalScore.toLocaleString()} pts (${cleared} line clear!)`;
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
  const returnValue = { count: fullRows.length + fullCols.length, fullRows, fullCols };

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
    if (isFullClear) triggerFullClearCelebration();
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
  if (!particleContainer) return;
  const rect = boardEl.getBoundingClientRect();
  const gap = 4;
  const innerWidth = rect.width - 20;
  const totalGaps = gap * (BOARD_SIZE - 1);
  const cellSize = (innerWidth - totalGaps) / BOARD_SIZE;
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
    const centerX = 10 + c * (cellSize + gap) + cellSize / 2;
    const centerY = 10 + r * (cellSize + gap) + cellSize / 2;
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
  boardEl.querySelectorAll('.cell').forEach((cell) => {
    cell.classList.remove('preview-okay', 'preview-bad');
  });
}

function applyPreview(shape, baseRow, baseCol, isValid) {
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

function createGhostPiece(shape, startX, startY) {
  const ghost = document.createElement('div');
  ghost.className = 'ghost-piece';
  const rows = shape.length;
  const cols = shape[0].length;
  ghost.style.gridTemplateColumns = `repeat(${cols}, auto)`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (shape[r][c] === 1) {
        const cell = document.createElement('div');
        cell.className = 'piece-cell';
        ghost.appendChild(cell);
      } else {
        const empty = document.createElement('div');
        empty.style.width = '20px';
        empty.style.height = '20px';
        ghost.appendChild(empty);
      }
    }
  }

  document.body.appendChild(ghost);
  ghost.style.left = `${startX}px`;
  ghost.style.top = `${startY - DRAG_GHOST_OFFSET_Y}px`;
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
    ghost: createGhostPiece(shape, e.clientX, e.clientY),
  };

  piece.classList.add('dragging');

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

function onPieceTouchStart(e) {
  e.preventDefault();
  const touch = e.touches[0];
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
    ghost: createGhostPiece(shape, touch.clientX, touch.clientY),
  };

  piece.classList.add('dragging');

  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('touchend', onTouchEnd);
  window.addEventListener('touchcancel', onTouchCancel);
}

const DRAG_GHOST_OFFSET_Y = 100;
const GHOST_CELL = 18;
const GHOST_GAP = 4;
const GHOST_PAD = 10;

function getGhostBottomLeft(clientX, clientY, shapeRows, shapeCols) {
  const ghostY = clientY - DRAG_GHOST_OFFSET_Y;
  const ghostW = GHOST_PAD * 2 + shapeCols * GHOST_CELL + (shapeCols - 1) * GHOST_GAP;
  const ghostH = GHOST_PAD * 2 + shapeRows * GHOST_CELL + (shapeRows - 1) * GHOST_GAP;
  return {
    x: clientX - ghostW / 2,
    y: ghostY + ghostH / 2,
  };
}

function updateGhostPosition(clientX, clientY) {
  if (!dragging || !dragging.ghost) return;
  const ghostY = clientY - DRAG_GHOST_OFFSET_Y;
  dragging.ghost.style.left = `${clientX}px`;
  dragging.ghost.style.top = `${ghostY}px`;

  const rows = dragging.shape.length;
  const cols = dragging.shape[0].length;
  const bottomLeft = getGhostBottomLeft(clientX, clientY, rows, cols);
  const cellPos = getBoardCellFromPoint(bottomLeft.x, bottomLeft.y);
  if (!cellPos) {
    clearPreview();
    return;
  }

  const baseRow = cellPos.row - (rows - 1);
  const baseCol = cellPos.col;
  if (baseRow < 0) {
    clearPreview();
    return;
  }
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
  const pieceEl = piecesEl.querySelector(`.piece[data-index="${pieceIndex}"]`);
  if (pieceEl) pieceEl.classList.remove('dragging');
  if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
  clearPreview();
  removeDragListeners();
  dragging = null;
}

function finishDrag(clientX, clientY) {
  if (!dragging) return;

  const { pieceIndex, shape } = dragging;
  const pieceEl = piecesEl.querySelector(`.piece[data-index="${pieceIndex}"]`);

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
  if (pieceEl) pieceEl.classList.remove('dragging');
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
  const touch = e.touches[0];
  updateGhostPosition(touch.clientX, touch.clientY);
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
  finalScoreEl.textContent = formatScore(score);
  gameOverModal.classList.remove('hidden');
  requestAnimationFrame(() => {
    gameOverModal.classList.add('modal-visible');
  });
}

function resetGame() {
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
  updateScoreDisplays('');
  updateRank();
  if (effectLayer) effectLayer.innerHTML = '';
  document.querySelectorAll('.fireworks-overlay').forEach((el) => el.remove());
  renderBoard();
  if (piecesEl) piecesEl.innerHTML = '';
  generatePieces();
  gameOverModal.classList.add('hidden');
  gameOverModal.classList.remove('modal-visible');
}

function useMidasTouch() {
  if (items.midas <= 0) return false;
  const centerRow = Math.floor(BOARD_SIZE / 2);
  const centerCol = Math.floor(BOARD_SIZE / 2);
  let clearedCount = 0;
  let clearedScore = 0;
  for (let r = centerRow - 1; r <= centerRow + 1; r++) {
    for (let c = centerCol - 1; c <= centerCol + 1; c++) {
      if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === 1) {
        board[r][c] = 0;
        cellVariants[r][c] = null;
        clearedCount++;
        clearedScore += METAL_SCORES[METAL_TYPES.GOLD_24K];
      }
    }
  }
  if (clearedCount > 0) {
    score += clearedScore;
    renderBoard();
    screenShake();
    scoreFlash();
    floatScorePopup(clearedScore);
    if (score > bestScore) {
      bestScore = score;
      saveBestScore();
    }
    updateScoreDisplays(`Midas Touch cleared ${clearedCount} blocks!`);
    updateRank();
  }
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

function useGoldenHammer() {
  if (items.hammer <= 0) return false;
  const centerRow = Math.floor(BOARD_SIZE / 2);
  const centerCol = Math.floor(BOARD_SIZE / 2);
  let clearedCount = 0;
  let clearedScore = 0;
  for (let r = centerRow - 2; r <= centerRow + 1; r++) {
    for (let c = centerCol - 2; c <= centerCol + 1; c++) {
      if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === 1) {
        const variant = cellVariants[r][c] ?? 0;
        board[r][c] = 0;
        cellVariants[r][c] = null;
        clearedCount++;
        clearedScore += METAL_SCORES[variant];
      }
    }
  }
  if (clearedCount > 0) {
    score += clearedScore;
    renderBoard();
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
  let clearedCount = 0;
  let clearedScore = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === 1 && cellVariants[r][c] === mostCommonVariant) {
        board[r][c] = 0;
        cellVariants[r][c] = null;
        clearedCount++;
        clearedScore += METAL_SCORES[mostCommonVariant];
      }
    }
  }
  if (clearedCount > 0) {
    score += clearedScore;
    renderBoard();
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
  items.tax--;
  saveItems();
  updateItemDisplays();
  return true;
}

function handleItemUse(itemType) {
  if (!confirm(`Use ${itemType}?`)) return;
  let used = false;
  switch (itemType) {
    case 'midas':
      used = useMidasTouch();
      break;
    case 'launder':
      used = useMoneyLaunder();
      break;
    case 'hammer':
      used = useGoldenHammer();
      break;
    case 'tax':
      used = useTaxBreak();
      break;
  }
  if (used && itemModal) {
    itemModal.classList.add('hidden');
    itemModal.classList.remove('modal-visible');
  }
}

resetBtn.addEventListener('click', resetGame);
restartBtn.addEventListener('click', resetGame);
if (hintBtn) {
  hintBtn.addEventListener('click', showHint);
}
if (itemBtn) {
  itemBtn.addEventListener('click', () => {
    if (!itemModal) return;
    itemModal.classList.remove('hidden');
    requestAnimationFrame(() => {
      itemModal.classList.add('modal-visible');
    });
  });
}
if (closeItemModal) {
  closeItemModal.addEventListener('click', () => {
    if (!itemModal) return;
    itemModal.classList.add('hidden');
    itemModal.classList.remove('modal-visible');
  });
}
document.querySelectorAll('.item-use-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    const itemType = e.currentTarget.dataset.item;
    handleItemUse(itemType);
  });
});

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

// 초기화
loadBestScore();
loadItems();
setupBoard();
updateScoreDisplays('');
updateRank();
generatePieces();

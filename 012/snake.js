// ─────────────────────────────────────────────
//  CONFIG — แก้ไขส่วนนี้เพื่อใส่รูปภาพ
// ─────────────────────────────────────────────

/*
  วิธีใส่รูปภาพ:
  1. เปลี่ยน useImages: true
  2. ใส่ path หรือ URL รูปภาพของคุณใน IMG_PATHS

  - SNAKE_HEAD  : รูปหัวงู (ควรหันหน้าไปทางขวา → เกมจะหมุนให้เอง)
  - SNAKE_BODY  : รูปลำตัวงู (ก้อนสี่เหลี่ยม)
  - SNAKE_TAIL  : รูปหางงู (ถ้าไม่มีใส่เหมือน BODY ได้เลย)
  - FOOD        : รูปผลไม้ปกติ
  - ITEM_SPEED  : รูปไอเทมความเร็ว
  - ITEM_DOUBLE : รูปไอเทม x2 คะแนน
  - ITEM_SHRINK : รูปไอเทมย่อตัว
*/

const CONFIG = {
  useImages: true,          // ← เปลี่ยนเป็น true เมื่อพร้อมใส่รูป

IMG_PATHS: {
  SNAKE_HEAD:   'img/SNAKE_HEAD.png',
  SNAKE_BODY:   'img/SNAKE_BODY.png',
  SNAKE_TAIL:   'img/SNAKE_TAIL.png',
  FOOD:         'img/FOOD.png',
  ITEM_SPEED:   'img/ITEM_SPEED.png',
  ITEM_DOUBLE:  'img/ITEM_DOUBLE.png',
  ITEM_SHRINK:  'img/ITEM_SHRINK.png',
}
};

// ─────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────

const CELL     = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cell')) || 36;
const COLS     = 20;
const ROWS     = 20;
const W        = CELL * COLS;
const H        = CELL * ROWS;

const canvas   = document.getElementById('canvas');
const ctx      = canvas.getContext('2d');
canvas.width   = W;
canvas.height  = H;

const overlay       = document.getElementById('overlay');
const overlayTitle  = document.getElementById('overlay-title');
const overlaySub    = document.getElementById('overlay-sub');
const startBtn      = document.getElementById('start-btn');
const scoreDisplay  = document.getElementById('score-display');
const bestDisplay   = document.getElementById('best-display');
const levelDisplay  = document.getElementById('level-display');
const levelBar      = document.getElementById('level-bar');
const effectMsg     = document.getElementById('effect-msg');

// ─────────────────────────────────────────────
//  IMAGE LOADER
// ─────────────────────────────────────────────

const IMGS = {};

function loadImages() {
  if (!CONFIG.useImages) return Promise.resolve();
  const keys = Object.keys(CONFIG.IMG_PATHS);
  const promises = keys.map(key => new Promise((resolve) => {
    const img = new Image();
    img.onload  = () => { IMGS[key] = img; resolve(); };
    img.onerror = () => { console.warn(`ไม่พบรูป: ${CONFIG.IMG_PATHS[key]}`); resolve(); };
    img.src = CONFIG.IMG_PATHS[key];
  }));
  return Promise.all(promises);
}

// ─────────────────────────────────────────────
//  GAME STATE
// ─────────────────────────────────────────────

let snake, dir, nextDir, food, items;
let score, best = 0, level, paused, running;
let doubleScore = false, doubleTimer = null;
let loopId = null;

const ITEM_DEFS = [
  { type: 'speed',  color: '#fc9218', label: '⚡ ความเร็ว!',  duration: 5000 },
  { type: 'double', color: '#433de6', label: '×2 คะแนน!',     duration: 7000 },
  { type: 'shrink', color: '#f645ff', label: '↓ ย่อตัว!',     duration: 0    },
];

function rand(n) { return Math.floor(Math.random() * n); }
function key(x, y) { return `${x},${y}`; }

function occupied() {
  const s = new Set(snake.map(c => key(c.x, c.y)));
  if (food) s.add(key(food.x, food.y));
  items.forEach(i => s.add(key(i.x, i.y)));
  return s;
}

function freeCell() {
  const occ = occupied(); let x, y, t = 0;
  do { x = rand(COLS); y = rand(ROWS); t++; } while (occ.has(key(x, y)) && t < 300);
  return { x, y };
}

function spawnFood() {
  const p = freeCell();
  food = { x: p.x, y: p.y };
}

function maybeSpawnItem() {
  if (items.length >= 2) return;
  if (Math.random() < 0.3) {
    const def = ITEM_DEFS[rand(ITEM_DEFS.length)];
    const p = freeCell();
    items.push({ ...def, x: p.x, y: p.y, born: Date.now() });
  }
}

function initGame() {
  snake = [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }];
  dir = nextDir = { x: 1, y: 0 };
  items = []; score = 0; level = 1;
  doubleScore = false;
  if (doubleTimer) clearTimeout(doubleTimer);
  spawnFood();
  updateHUD();
}

function getDelay() { return Math.max(70, 180 - (level - 1) * 12); }

function tick() {
  dir = nextDir;
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

  // wall collision
  if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) return endGame();
  // self collision
  if (snake.some(s => s.x === head.x && s.y === head.y)) return endGame();

  snake.unshift(head);
  let grow = false;

  // eat food
  if (head.x === food.x && head.y === food.y) {
    const pts = (doubleScore ? 2 : 1) * level;
    score += pts;
    grow = true;
    spawnFood();
    maybeSpawnItem();
    const threshold = 10 + level * 5;
    if (score >= threshold * level) { level++; restartLoop(); }
  }

  // eat item
  const hi = items.findIndex(i => i.x === head.x && i.y === head.y);
  if (hi !== -1) { applyItem(items.splice(hi, 1)[0]); grow = true; }
  if (!grow) snake.pop();

  // expire items
  items = items.filter(i => Date.now() - i.born < 9000);

  updateHUD();
  render();
}

function applyItem(item) {
  showEffect(item.label);
  if (item.type === 'speed') {
    level = Math.min(level + 2, 12);
    restartLoop();
    setTimeout(() => { level = Math.max(1, level - 2); restartLoop(); }, item.duration);
  } else if (item.type === 'double') {
    doubleScore = true;
    if (doubleTimer) clearTimeout(doubleTimer);
    doubleTimer = setTimeout(() => { doubleScore = false; }, item.duration);
  } else if (item.type === 'shrink') {
    const cut = Math.floor(snake.length * 0.4);
    if (snake.length > cut + 2) snake.splice(snake.length - cut, cut);
  }
}

function restartLoop() {
  if (loopId) clearInterval(loopId);
  loopId = setInterval(tick, getDelay());
}

function endGame() {
  clearInterval(loopId); running = false;
  if (score > best) best = score;
  overlayTitle.textContent = 'เกมจบ!';
  overlaySub.textContent   = `คะแนน: ${score}  •  ระดับ: ${level}`;
  startBtn.textContent     = 'เล่นอีกครั้ง';
  overlay.classList.remove('hidden');
}

function updateHUD() {
  scoreDisplay.textContent = score;
  bestDisplay.textContent  = Math.max(score, best);
  levelDisplay.textContent = level;
  const pct = Math.min(100, ((score % (10 + level * 5)) / (10 + level * 5)) * 100);
  levelBar.style.width = pct + '%';
}

let effectTimeout;
function showEffect(msg) {
  effectMsg.textContent = msg;
  effectMsg.classList.add('show');
  clearTimeout(effectTimeout);
  effectTimeout = setTimeout(() => effectMsg.classList.remove('show'), 2000);
}

// ─────────────────────────────────────────────
//  RENDER
// ─────────────────────────────────────────────

function drawCell(img, fallbackDraw, x, y, rotation = 0) {
  ctx.save();
  ctx.translate(x * CELL + CELL / 2, y * CELL + CELL / 2);
  if (rotation) ctx.rotate(rotation);
  if (CONFIG.useImages && img) {
    ctx.drawImage(img, -CELL / 2, -CELL / 2, CELL, CELL);
  } else {
    ctx.translate(-CELL / 2, -CELL / 2);
    fallbackDraw();
  }
  ctx.restore();
}

function getHeadRotation() {
  if (dir.x === 1)  return 0;
  if (dir.x === -1) return Math.PI;
  if (dir.y === -1) return -Math.PI / 2;
  if (dir.y === 1)  return Math.PI / 2;
  return 0;
}

function render() {
  // background
  ctx.fillStyle = '#0f1117';
  ctx.fillRect(0, 0, W, H);

  // grid dots
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    ctx.beginPath();
    ctx.arc(c * CELL + CELL / 2, r * CELL + CELL / 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // food
  if (food) {
    const pulse = 1 + Math.sin(Date.now() * 0.005) * 0.06;
    ctx.save();
    ctx.translate(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2);
    ctx.scale(pulse, pulse);
    ctx.translate(-CELL / 2, -CELL / 2);
    if (CONFIG.useImages && IMGS.FOOD) {
      ctx.drawImage(IMGS.FOOD, 0, 0, CELL, CELL);
    } else {
      ctx.shadowColor = '#a8e63d';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#a8e63d';
      ctx.beginPath();
      ctx.arc(CELL / 2, CELL / 2, CELL * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  // items
  items.forEach(item => {
    const age = Date.now() - item.born;
    const fade = age > 7000 ? Math.max(0.2, 1 - (age - 7000) / 2000) : 1;
    const imgKey = item.type === 'speed'  ? 'ITEM_SPEED'
                 : item.type === 'double' ? 'ITEM_DOUBLE'
                 : 'ITEM_SHRINK';
    const img = IMGS[imgKey];
    ctx.globalAlpha = fade;
    drawCell(img, () => {
      ctx.fillStyle = item.color;
      ctx.shadowColor = item.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.roundRect(3, 3, CELL - 6, CELL - 6, 6);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#000';
      ctx.font = `bold ${Math.floor(CELL * 0.4)}px Kanit`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const sym = item.type === 'speed' ? '⚡' : item.type === 'double' ? '×2' : '↓';
      ctx.fillText(sym, CELL / 2, CELL / 2);
    }, item.x, item.y);
    ctx.globalAlpha = 1;
  });

  // snake body (draw from tail to head so head is on top)
  for (let i = snake.length - 1; i >= 0; i--) {
    const seg = snake[i];
    const isHead = i === 0;
    const isTail = i === snake.length - 1;

    if (isHead) {
      drawCell(IMGS.SNAKE_HEAD, () => {
        const g = ctx.createLinearGradient(0, 0, CELL, CELL);
        g.addColorStop(0, '#b8f04a');
        g.addColorStop(1, '#7ab82e');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(1, 1, CELL - 2, CELL - 2, 7);
        ctx.fill();
        // eyes
        ctx.fillStyle = '#0f1117';
        ctx.beginPath(); ctx.arc(CELL * 0.65, CELL * 0.3, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(CELL * 0.65, CELL * 0.7, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(CELL * 0.65 + 0.8, CELL * 0.3 - 0.8, 1, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(CELL * 0.65 + 0.8, CELL * 0.7 - 0.8, 1, 0, Math.PI * 2); ctx.fill();
      }, seg.x, seg.y, getHeadRotation());
    } else if (isTail) {
      drawCell(IMGS.SNAKE_TAIL, () => {
        ctx.fillStyle = '#4f8c1a';
        ctx.beginPath();
        ctx.roundRect(4, 4, CELL - 8, CELL - 8, 8);
        ctx.fill();
      }, seg.x, seg.y);
    } else {
      drawCell(IMGS.SNAKE_BODY, () => {
        const shade = 1 - (i / snake.length) * 0.35;
        ctx.fillStyle = `hsl(88, 65%, ${Math.round(35 * shade)}%)`;
        ctx.beginPath();
        ctx.roundRect(2, 2, CELL - 4, CELL - 4, 5);
        ctx.fill();
      }, seg.x, seg.y);
    }
  }

  // double score indicator
  if (doubleScore) {
    ctx.fillStyle = 'rgba(168,230,61,0.85)';
    ctx.font = `bold 11px 'Space Mono'`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('×2', 8, 8);
  }
}

// ─────────────────────────────────────────────
//  INPUT
// ─────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (!running) return;
  if (e.code === 'Space') {
    e.preventDefault();
    paused = !paused;
    if (paused) clearInterval(loopId);
    else restartLoop();
    return;
  }
  const MAP = {
    ArrowUp:    { x: 0, y: -1 }, ArrowDown:  { x: 0, y:  1 },
    ArrowLeft:  { x: -1, y: 0 }, ArrowRight: { x: 1, y:  0 },
    KeyW:       { x: 0, y: -1 }, KeyS:       { x: 0, y:  1 },
    KeyA:       { x: -1, y: 0 }, KeyD:       { x: 1, y:  0 },
  };
  const d = MAP[e.code];
  if (d && !(d.x === -dir.x && d.y === -dir.y)) { nextDir = d; e.preventDefault(); }
});

function setDir(dx, dy) {
  if (!running || paused) return;
  const d = { x: dx, y: dy };
  if (!(d.x === -dir.x && d.y === -dir.y)) nextDir = d;
}

document.getElementById('pad-up').addEventListener('click',    () => setDir(0, -1));
document.getElementById('pad-down').addEventListener('click',  () => setDir(0,  1));
document.getElementById('pad-left').addEventListener('click',  () => setDir(-1, 0));
document.getElementById('pad-right').addEventListener('click', () => setDir(1,  0));

// ─────────────────────────────────────────────
//  START
// ─────────────────────────────────────────────

startBtn.addEventListener('click', () => {
  overlay.classList.add('hidden');
  initGame();
  render();
  running = true; paused = false;
  restartLoop();
});

// initial static render
(function init() {
  ctx.fillStyle = '#0f1117';
  ctx.fillRect(0, 0, W, H);
  loadImages().then(() => render());
})();
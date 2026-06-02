// ==========================================
// 🎵 1. ระบบเสียง Web Audio API (Synthesizer)
// ==========================================
let audioCtx;
let bgmInterval;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'coin') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } 
    else if (type === 'gameover') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    }
    else if (type === 'bgm') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
    }
    else if (type === 'jump') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    }
}

function startBGM() {
    if (bgmInterval) clearInterval(bgmInterval);
    bgmInterval = setInterval(() => {
        if (isPlaying) playSound('bgm');
    }, 400); 
}

function stopBGM() {
    if (bgmInterval) clearInterval(bgmInterval);
}


// ==========================================
// 🎮 2. การตั้งค่าเริ่มต้นของเกมและตัวแปรหลัก
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let frames = 0;
let score = 0;
let highScore = localStorage.getItem('neonGravityHighScore') || 0;
let gameSpeed = 5; 
let isGameOver = false;
let isPlaying = false;
let obstacles = [];
let items = [];


// ==========================================
// 📦 3. ออบเจกต์คลาส (Player, Obstacle, Item)
// ==========================================
const player = {
    x: 100,
    y: 200,
    size: 30,
    color: '#00ffff',
    gravity: 1,
    velocity: 0,
    direction: 1, // 1 = ตกลงพื้น, -1 = ลอยขึ้นเพดาน
    
    draw() {
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.shadowBlur = 0;
    },
    
    update() {
        this.velocity += this.gravity * this.direction;
        this.y += this.velocity;

        // ชนขอบพื้นและเพดาน
        if (this.y + this.size >= canvas.height) {
            this.y = canvas.height - this.size;
            this.velocity = 0;
        }
        if (this.y <= 0) {
            this.y = 0;
            this.velocity = 0;
        }
    },
    
    flip() {
        this.direction *= -1; 
        this.velocity = 0;    
        playSound('jump');
    }
};

class Obstacle {
    constructor() {
        this.width = 30 + Math.random() * 40;
        this.height = 50 + Math.random() * 100;
        this.x = canvas.width;
        this.isTop = Math.random() > 0.5;
        this.y = this.isTop ? 0 : canvas.height - this.height;
        this.color = '#ff0044';
    }
    
    draw() {
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.shadowBlur = 0;
    }
    
    update() {
        this.x -= gameSpeed;
    }
}

class Item {
    constructor() {
        this.size = 50;
        this.x = canvas.width;
        this.y = 50 + Math.random() * (canvas.height - 100);
        this.color = '#ffdd00';
        this.active = true;
    }
    
    draw() {
        if (!this.active) return;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        
        // วาดรูปทรงข้าวหลามตัด
        ctx.beginPath();
        ctx.moveTo(this.x + this.size/2, this.y);
        ctx.lineTo(this.x + this.size, this.y + this.size/2);
        ctx.lineTo(this.x + this.size/2, this.y + this.size);
        ctx.lineTo(this.x, this.y + this.size/2);
        ctx.closePath();
        ctx.fill();
        
        ctx.shadowBlur = 0;
    }
    
    update() {
        this.x -= gameSpeed;
    }
}


// ==========================================
// ⚙️ 4. ระบบลอจิกหลัก (อัปเดตและคำนวณ)
// ==========================================
function handleGameObjects() {
    // --- สปอว์นสิ่งกีดขวาง ---
    if (frames % Math.floor(120 / (gameSpeed / 5)) === 0) {
        obstacles.push(new Obstacle());
    }
    
    // --- สปอว์นไอเทมโบนัส (พร้อมระบบกันทับซ้อน) ---
    if (frames % 200 === 0) {
        let newItem = new Item();
        let isOverlapping = false;
        const safeMargin = 15; 

        for (let i = 0; i < obstacles.length; i++) {
            let obs = obstacles[i];
            if (newItem.x < obs.x + obs.width + safeMargin &&
                newItem.x + newItem.size > obs.x - safeMargin &&
                newItem.y < obs.y + obs.height + safeMargin &&
                newItem.y + newItem.size > obs.y - safeMargin) {
                isOverlapping = true;
                break; 
            }
        }
        if (!isOverlapping) items.push(newItem);
    }

    // --- อัปเดตและเช็คชนสิ่งกีดขวาง ---
    for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        obs.update();
        obs.draw();

        if (player.x < obs.x + obs.width &&
            player.x + player.size > obs.x &&
            player.y < obs.y + obs.height &&
            player.y + player.size > obs.y) {
            gameOver();
        }

        if (obs.x + obs.width < 0) {
            obstacles.splice(i, 1);
            i--;
        }
    }

    // --- อัปเดตและเช็คเก็บไอเทม ---
    for (let i = 0; i < items.length; i++) {
        let item = items[i];
        item.update();
        item.draw();

        if (item.active &&
            player.x < item.x + item.size &&
            player.x + player.size > item.x &&
            player.y < item.y + item.size &&
            player.y + player.size > item.y) {
            item.active = false;
            score += 50; 
            playSound('coin');
        }

        if (item.x + item.size < 0) {
            items.splice(i, 1);
            i--;
        }
    }
}


// ==========================================
// 🖥️ 5. ระบบหน้าจออินเทอร์เฟซ (UI & States)
// ==========================================
function drawUI() {
    ctx.fillStyle = 'white';
    ctx.font = '20px "Segoe UI"';
    ctx.fillText(`Score: ${Math.floor(score)}`, 20, 30);
    ctx.fillText(`High Score: ${Math.floor(highScore)}`, 20, 60);

    // หน้าจอเริ่มเกม
    if (!isPlaying && !isGameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#00ffff';
        ctx.font = '40px "Segoe UI"';
        ctx.textAlign = 'center';
        ctx.fillText('NEON GRAVITY', canvas.width/2, canvas.height/2 - 20);
        ctx.font = '20px "Segoe UI"';
        ctx.fillStyle = 'white';
        ctx.fillText('Press SPACE or CLICK to Start', canvas.width/2, canvas.height/2 + 30);
        ctx.textAlign = 'left'; 
    }

    // หน้าจอจบเกม
    if (isGameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ff0044';
        ctx.font = '50px "Segoe UI"';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width/2, canvas.height/2 - 30);
        ctx.fillStyle = 'white';
        ctx.font = '25px "Segoe UI"';
        ctx.fillText(`Final Score: ${Math.floor(score)}`, canvas.width/2, canvas.height/2 + 20);
        ctx.font = '18px "Segoe UI"';
        ctx.fillText('Press SPACE or CLICK to Restart', canvas.width/2, canvas.height/2 + 60);
        ctx.textAlign = 'left';
    }
}

function gameOver() {
    isGameOver = true;
    isPlaying = false;
    stopBGM();
    playSound('gameover');

    if (score > highScore) {
        highScore = Math.floor(score);
        localStorage.setItem('neonGravityHighScore', highScore);
    }
}

function resetGame() {
    player.y = 200;
    player.velocity = 0;
    player.direction = 1;
    obstacles = [];
    items = [];
    score = 0;
    frames = 0;
    gameSpeed = 5;
    isGameOver = false;
    isPlaying = true;
    startBGM();
    animate();
}

function animate() {
    if (!isPlaying) return; 

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    player.update();
    player.draw();
    handleGameObjects();

    // เพิ่มความเร็วเกมเพื่อความท้าทาย
    score += 0.1;
    if (frames % 600 === 0 && gameSpeed < 15) {
        gameSpeed += 1;
    }

    drawUI();
    frames++;
    requestAnimationFrame(animate);
}


// ==========================================
// 🕹️ 6. ระบบควบคุม (Input Handling)
// ==========================================
function handleInput(e) {
    if(e.code === 'Space') e.preventDefault(); 
    initAudio();
    
    if (isGameOver || !isPlaying) {
        resetGame();
    } else {
        player.flip();
    }
}

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') handleInput(e);
});
canvas.addEventListener('mousedown', handleInput);
canvas.addEventListener('touchstart', handleInput);

// วาดหน้าจอเริ่มต้นเมื่อโหลดสคริปต์เสร็จ
drawUI();
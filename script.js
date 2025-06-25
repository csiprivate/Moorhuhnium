// DOM-Elemente
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('scoreDisplay');
const ammoDisplay = document.getElementById('ammoDisplay');
const timerDisplay = document.getElementById('timerDisplay');

const startScreen = document.getElementById('startScreen');
const leaderboardScreen = document.getElementById('leaderboardScreen');
const leaderboardList = document.getElementById('leaderboardList');
const startGameBtn = document.getElementById('startGameBtn');
const restartGameBtn = document.getElementById('restartGameBtn');
const playerNameInput = document.getElementById('playerNameInput');

const customAlert = document.getElementById('customAlert');
const customAlertMessage = document.getElementById('customAlertMessage');
const customAlertButton = document.getElementById('customAlertButton');

// Globale Spielzustandsvariablen
let gameStarted = false;
let playerName = "";
let score = 0;
let ammo = 0; // Wird bei resetGame initialisiert
let timer = 0; // Wird bei startTimer initialisiert
let timerInterval = null;
const chickens = []; 

let isReloadingAfterShot = false; // Zeigt an, ob der automatische Reload nach Schuss aktiv ist
let reloading = false; // Zeigt an, ob der manuelle Reload aktiv ist

let reloadTimeout = null; // Timeout-ID für das manuelle Nachladen
let shotReloadTimeout = null; // Timeout-ID für das Nachladen nach einem Schuss

let DEBUG_MODE = false; // DEBUG-MODUS zum Anzeigen der Hitboxen

// DEFINIERTE HEADSHOT-ZONEN
const chickenHeadshotZones = [
    { relX: 0.1073, relY: 0.0455, relWidth: 0.5645, relHeight: 0.4018 },
    { relX: 0.5202, relY: 0.2104, relWidth: 0.3500, relHeight: 0.5861 },
    { relX: 0.4702, relY: 0.2012, relWidth: 0.4048, relHeight: 0.3745 },
    { relX: 0.4088, relY: 0.3274, relWidth: 0.3565, relHeight: 0.2323 },
];


// --- Konstanten ---
const GAME_ASPECT_RATIO = 800 / 600; // Breite / Höhe für Canvas
const MAX_CANVAS_WIDTH = 1000; // Maximale Breite des Canvas
const CONTAINER_PADDING = 10; // Polsterung innerhalb des Page-Containers

const GAME_DURATION = 30; // Sekunden Spielzeit
const INITIAL_AMMO = 8; // Startmunition und maximale Munition
const MAX_CHICKENS_ON_SCREEN = 5; // Maximale Anzahl gleichzeitig sichtbarer Hühner

const RELOAD_TIME_PER_BULLET_MS = 300; // Millisekunden pro Kugel beim manuellen Nachladen
const RELOAD_TIME_AFTER_SHOT_MS = 500; // Millisekunden Nachladezeit nach einem Schuss

const CHICKEN_SPAWN_OFFSET = 50; // Mindestabstand zum oberen/unteren Rand für Huhn-Spawn

// --- Assets (Bilder und Sounds) ---
const chickenAssets = []; // Array für vorgeladene Hühnerbilder mit ihren Zonen
const sounds = {}; // Objekt für vorgeladene Sounds

// Relativ zur Canvas-Größe berechneter Reload-Button
const reloadBtn = {
    x: 0, 
    y: 0, 
    width: 120, 
    height: 40,
    textIdle: "Reload",
    textReloading: "Reloading...",
    isHovered: false,
    scale: 1 
};

// Array für die Anzeige von Trefferpunkten
const hitPointsDisplays = [];

// --- Utility Funktionen ---
function showCustomAlert(message) {
    customAlertMessage.textContent = message;
    customAlert.style.display = 'flex'; 
    customAlertButton.onclick = () => {
        customAlert.style.display = 'none';
    };
}

function resizeCanvas() {
    const gameWrapper = document.getElementById('game-wrapper');
    let newWidth = gameWrapper.clientWidth;
    
    if (newWidth > MAX_CANVAS_WIDTH) {
        newWidth = MAX_CANVAS_WIDTH;
    }
    let newHeight = newWidth / GAME_ASPECT_RATIO;
    
    canvas.width = newWidth;
    canvas.height = newHeight;
    
    const uiBar = document.getElementById('ui-bar');
    uiBar.style.width = `${newWidth}px`;

    const baseCanvasWidth = 800;
    reloadBtn.scale = canvas.width / baseCanvasWidth;

    // KORRIGIERTE BUTTON-GRÖSSE FÜR MOBILE GERÄTE
    const baseWidth = 120;
    const baseHeight = 40;
    const minWidth = 90; // Mindestbreite des Buttons in Pixeln
    const minHeight = 45; // Mindesthöhe des Buttons in Pixeln

    reloadBtn.width = Math.max(baseWidth * reloadBtn.scale, minWidth);
    reloadBtn.height = Math.max(baseHeight * reloadBtn.scale, minHeight);

    const padding = 15; // Fester Abstand zum Rand
    reloadBtn.x = canvas.width - reloadBtn.width - padding;
    reloadBtn.y = canvas.height - reloadBtn.height - padding;
}


function addHitPointsDisplay(x, y, points, type = 'hit') {
    hitPointsDisplays.push({
        x: x,
        y: y,
        points: points,
        alpha: 1.0,
        lifetime: 60,
        type: type
    });
}

function getRandomChickenAsset() {
    if (chickenAssets.length === 0) {
        console.warn("Keine Hühner-Assets geladen.");
        const placeholderImg = new Image();
        placeholderImg.src = 'https://placehold.co/80x60/cccccc/000000?text=NO+IMG';
        return {
            image: placeholderImg,
            headshotZone: { relX: 0, relY: 0, relWidth: 0, relHeight: 0 }
        };
    }
    const index = Math.floor(Math.random() * chickenAssets.length);
    return chickenAssets[index];
}

function spawnChicken() {
    const direction = Math.random() < 0.5 ? 'right' : 'left';
    const speed = Math.random() * 2 + 1;

    let baseWidth, baseHeight, points;
    const sizeClass = Math.random();

    if (sizeClass < 0.33) { 
        baseWidth = 40; baseHeight = 30; points = 150;
    } else if (sizeClass < 0.66) {
        baseWidth = 60; baseHeight = 40; points = 100;
    } else {
        baseWidth = 80; baseHeight = 60; points = 50;
    }

    const chickenWidth = baseWidth * reloadBtn.scale;
    const chickenHeight = baseHeight * reloadBtn.scale;
    const chickenSpeed = speed * reloadBtn.scale;
    
    const asset = getRandomChickenAsset();

    chickens.push({
        x: direction === 'right' ? -chickenWidth : canvas.width,
        y: Math.random() * (canvas.height - chickenHeight - CHICKEN_SPAWN_OFFSET * reloadBtn.scale) + CHICKEN_SPAWN_OFFSET * reloadBtn.scale,
        width: chickenWidth,
        height: chickenHeight,
        speed: chickenSpeed,
        direction: direction,
        image: asset.image,
        points: points,
        headshotZone: asset.headshotZone 
    });
}

function drawAmmo() {
    const rectWidth = 15 * reloadBtn.scale;
    const rectHeight = 6 * reloadBtn.scale;
    const spacing = 6 * reloadBtn.scale;
    const startX = canvas.width - 20 * reloadBtn.scale;
    const totalHeight = INITIAL_AMMO * rectHeight + (INITIAL_AMMO - 1) * spacing;
    const startY = (canvas.height / 2) - (totalHeight / 2);

    for (let i = 0; i < INITIAL_AMMO; i++) {
        ctx.fillStyle = i < ammo ? 'limegreen' : '#444';
        const y = startY + i * (rectHeight + spacing);
        ctx.fillRect(startX, y, rectWidth, rectHeight);
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1 * reloadBtn.scale;
        ctx.strokeRect(startX, y, rectWidth, rectHeight);
    }
}

function drawHitPointsDisplays() {
    for (let i = hitPointsDisplays.length - 1; i >= 0; i--) {
        const display = hitPointsDisplays[i];
        ctx.save();
        ctx.globalAlpha = display.alpha;
        
        let text = `+${display.points}`;
        let color = 'yellow';
        let fontSize = 22;

        if (display.type === 'headshot') {
            text = `HEADSHOT! +${display.points}`;
            color = 'red';
            fontSize = 24;
        }

        ctx.fillStyle = color;
        ctx.font = `bold ${fontSize * reloadBtn.scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(text, display.x, display.y);
        ctx.restore();

        display.y -= 0.5 * reloadBtn.scale;
        display.alpha -= 1 / display.lifetime;
        display.lifetime--;

        if (display.lifetime <= 0 || display.alpha <= 0) {
            hitPointsDisplays.splice(i, 1);
        }
    }
}

function drawReloadButton() {
    ctx.fillStyle = reloadBtn.isHovered ? '#666' : '#444';
    ctx.fillRect(reloadBtn.x, reloadBtn.y, reloadBtn.width, reloadBtn.height);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2 * reloadBtn.scale;
    ctx.strokeRect(reloadBtn.x, reloadBtn.y, reloadBtn.width, reloadBtn.height);
    ctx.fillStyle = 'white';
    ctx.font = `${20 * reloadBtn.scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const text = reloading ? reloadBtn.textReloading : reloadBtn.textIdle;
    ctx.fillText(text, reloadBtn.x + reloadBtn.width / 2, reloadBtn.y + reloadBtn.height / 2);
}

function normalizeZone(zone) {
    const normalized = {...zone};
    if (normalized.relWidth < 0) {
        normalized.relX = normalized.relX + normalized.relWidth;
        normalized.relWidth = -normalized.relWidth;
    }
    if (normalized.relHeight < 0) {
        normalized.relY = normalized.relY + normalized.relHeight;
        normalized.relHeight = -normalized.relHeight;
    }
    return normalized;
}

async function preloadAssets() {
    const imageUrls = [
        'images/chicken1.png',
        'images/chicken2.png',
        'images/chicken3.png',
        'images/chicken4.png'
    ];
    
    const imagePromises = imageUrls.map((src, index) => {
        return new Promise(resolve => {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                const zone = normalizeZone(chickenHeadshotZones[index]);
                chickenAssets.push({ image: img, headshotZone: zone });
                resolve();
            };
            img.onerror = () => {
                console.error(`Fehler beim Laden von Bild: ${src}.`);
                resolve(); 
            };
        });
    });

    await Promise.all(imagePromises);

    sounds.gunshot = new Audio('sounds/gunshot.mp3');
    sounds.reloadAfterShot = new Audio('sounds/reload1.mp3');
    sounds.reloadManual = new Audio('sounds/reload2.mp3');
    sounds.headshot = new Audio('sounds/headshot.mp3');
    sounds.background = new Audio('sounds/background.mp3');
    sounds.background.loop = true;
    sounds.background.volume = 0.6;
    
    const soundPromises = Object.values(sounds).map(sound => {
        return new Promise(resolve => {
            sound.addEventListener('canplaythrough', resolve, { once: true });
            sound.addEventListener('error', (e) => {
                console.error(`Fehler beim Laden von Sound: ${e.target.src}`);
                resolve(); 
            });
        });
    });

    await Promise.all(soundPromises);
    console.log("Assets vorgeladen.");
}


function resetGame() {
    score = 0;
    ammo = INITIAL_AMMO;
    chickens.length = 0;
    hitPointsDisplays.length = 0;
    timer = GAME_DURATION;
    isReloadingAfterShot = false;
    reloading = false;
    cancelReload();
    scoreDisplay.textContent = `Score: ${score}`;
    ammoDisplay.textContent = `Ammo: ${ammo}`;
    timerDisplay.textContent = `Time: ${timer}`;
    for (let i = 0; i < MAX_CHICKENS_ON_SCREEN; i++) {
        spawnChicken();
    }
}

function updateGame() {
    if (!gameStarted) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = chickens.length - 1; i >= 0; i--) {
        const chicken = chickens[i];
        if (chicken.direction === 'right') {
            chicken.x += chicken.speed;
            if (chicken.x > canvas.width) chickens.splice(i, 1);
        } else {
            chicken.x -= chicken.speed;
            if (chicken.x < -chicken.width) chickens.splice(i, 1);
        }

        ctx.save();
        if (chicken.direction === 'left') {
            ctx.translate(chicken.x + chicken.width, chicken.y);
            ctx.scale(-1, 1);
            ctx.drawImage(chicken.image, 0, 0, chicken.width, chicken.height);
        } else {
            ctx.drawImage(chicken.image, chicken.x, chicken.y, chicken.width, chicken.height);
        }
        ctx.restore();

        if (DEBUG_MODE) {
            ctx.save();
            // Körper-Hitbox
            ctx.fillStyle = 'rgba(0, 0, 255, 0.3)';
            ctx.fillRect(chicken.x, chicken.y, chicken.width, chicken.height);
            
            // Headshot-Hitbox (korrigiert für beide Richtungen)
            let headshotX;
            const headshotY = chicken.y + chicken.height * chicken.headshotZone.relY;
            const headshotWidth = chicken.width * chicken.headshotZone.relWidth;
            const headshotHeight = chicken.height * chicken.headshotZone.relHeight;

            if (chicken.direction === 'left') { // Huhn kommt von rechts, Bild ist gespiegelt
                headshotX = chicken.x + chicken.width * (1 - chicken.headshotZone.relX - chicken.headshotZone.relWidth);
            } else { // Huhn kommt von links, Bild ist normal
                headshotX = chicken.x + chicken.width * chicken.headshotZone.relX;
            }
            
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.fillRect(headshotX, headshotY, headshotWidth, headshotHeight);
            ctx.restore();
        }
    }

    while (chickens.length < MAX_CHICKENS_ON_SCREEN) {
        spawnChicken();
    }

    drawReloadButton();
    drawAmmo();
    drawHitPointsDisplays();
    requestAnimationFrame(updateGame);
}

function cancelReload() {
    if (reloadTimeout) clearTimeout(reloadTimeout);
    if (shotReloadTimeout) clearTimeout(shotReloadTimeout);
    reloadTimeout = null;
    shotReloadTimeout = null;
    reloading = false;
    isReloadingAfterShot = false;
    if (sounds.reloadManual && sounds.reloadManual.pause) {
        sounds.reloadManual.pause();
        sounds.reloadManual.currentTime = 0;
    }
    ammoDisplay.textContent = `Ammo: ${ammo}`;
}

function startReload() {
    if (reloading || isReloadingAfterShot || ammo === INITIAL_AMMO) {
        if (ammo === INITIAL_AMMO) showCustomAlert("Munition ist voll!");
        return;
    }
    cancelReload();
    reloading = true;
    reloadBtn.isHovered = false;
    ammoDisplay.textContent = `Ammo: ...`;
    let bulletsToReload = INITIAL_AMMO - ammo;
    let currentBullet = 0;

    function reloadNextBullet() {
        if (!reloading) return;
        if (sounds.reloadManual) {
            sounds.reloadManual.currentTime = 0;
            sounds.reloadManual.play().catch(e => console.error("Reload sound error:", e));
        }
        ammo++;
        ammoDisplay.textContent = `Ammo: ${ammo}`;
        currentBullet++;
        if (currentBullet < bulletsToReload) {
            reloadTimeout = setTimeout(reloadNextBullet, RELOAD_TIME_PER_BULLET_MS);
        } else {
            reloading = false;
            reloadTimeout = null;
        }
    }
    reloadNextBullet();
}

function handleShot(clickX, clickY) {
    if (!gameStarted) return;
    if (clickX >= reloadBtn.x && clickX <= reloadBtn.x + reloadBtn.width && clickY >= reloadBtn.y && clickY <= reloadBtn.y + reloadBtn.height) {
        startReload();
        return;
    }
    if (reloading) cancelReload();
    if (isReloadingAfterShot || ammo <= 0) return;

    ammo--;
    ammoDisplay.textContent = `Ammo: ${ammo}`;
    if (sounds.gunshot) {
        sounds.gunshot.currentTime = 0;
        sounds.gunshot.play().catch(e => console.error("Gunshot sound error:", e));
    }

    for (let i = chickens.length - 1; i >= 0; i--) {
        const chicken = chickens[i];
        if (clickX >= chicken.x && clickX <= chicken.x + chicken.width && clickY >= chicken.y && clickY <= chicken.y + chicken.height) {
            
            // KORRIGIERTE HEADSHOT-LOGIK
            let headshotX;
            const headshotY = chicken.y + chicken.height * chicken.headshotZone.relY;
            const headshotWidth = chicken.width * chicken.headshotZone.relWidth;
            const headshotHeight = chicken.height * chicken.headshotZone.relHeight;

            if (chicken.direction === 'left') { // Huhn kommt von rechts, Bild ist gespiegelt
                headshotX = chicken.x + chicken.width * (1 - chicken.headshotZone.relX - chicken.headshotZone.relWidth);
            } else { // Huhn kommt von links, Bild ist normal
                headshotX = chicken.x + chicken.width * chicken.headshotZone.relX;
            }

            if (clickX >= headshotX && clickX <= headshotX + headshotWidth && clickY >= headshotY && clickY <= headshotY + headshotHeight) {
                const headshotPoints = chicken.points * 3;
                score += headshotPoints;
                addHitPointsDisplay(chicken.x + chicken.width / 2, chicken.y, headshotPoints, 'headshot');
                if (sounds.headshot) {
                    sounds.headshot.currentTime = 0;
                    sounds.headshot.play().catch(e => console.error("Headshot sound error:", e));
                }
            } else {
                score += chicken.points;
                addHitPointsDisplay(chicken.x + chicken.width / 2, chicken.y, chicken.points, 'hit');
            }
            scoreDisplay.textContent = `Score: ${score}`;
            chickens.splice(i, 1);
            spawnChicken();
            break;
        }
    }

    isReloadingAfterShot = true;
    if (sounds.reloadAfterShot) {
        sounds.reloadAfterShot.currentTime = 0;
        sounds.reloadAfterShot.play().catch(e => console.error("Reload after shot sound error:", e));
    }
    shotReloadTimeout = setTimeout(() => {
        isReloadingAfterShot = false;
        shotReloadTimeout = null;
    }, RELOAD_TIME_AFTER_SHOT_MS);
}

function startTimer() {
    timer = GAME_DURATION;
    timerDisplay.textContent = `Time: ${timer}`;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timer--;
        timerDisplay.textContent = `Time: ${timer}`;
        if (timer <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            endRound();
        }
    }, 1000);
}

function endRound() {
    gameStarted = false;
    cancelReload();
    if (sounds.background) {
        sounds.background.pause();
        sounds.background.currentTime = 0;
    }
    showLeaderboard();
}

function showLeaderboard() {
    leaderboardList.innerHTML = '';
    const li = document.createElement('li');
    li.textContent = `${playerName}: ${score} Punkte`;
    leaderboardList.appendChild(li);
    leaderboardScreen.style.display = 'flex';
    startScreen.style.display = 'none';
}

function startGame() {
    playerName = playerNameInput.value.trim();
    if (!playerName) {
        showCustomAlert('Bitte gib deinen Namen ein!');
        return;
    }
    
    const lowerName = playerName.toLowerCase();
    const noobNames = ["nordhuen", "globi", "globivogel"];
    let specialMessageType = null;

    if (noobNames.includes(lowerName)) {
        specialMessageType = 'noob';
    } else if (lowerName === "lou" || lowerName === "louise") {
        specialMessageType = 'heart';
    }
    
    actuallyStartGame(specialMessageType);
}

function actuallyStartGame(specialMessageType = null) {
    startScreen.style.display = 'none';
    leaderboardScreen.style.display = 'none';
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    let messageText = "LOS GEHT'S!";
    let textColor = "black";
    let textFont = `bold ${40 * reloadBtn.scale}px Arial`;

    if (specialMessageType === 'noob') {
        messageText = "HAHA du noob!!";
        textColor = "orange";
    } else if (specialMessageType === 'heart') {
        messageText = "❤️";
        textFont = `${80 * reloadBtn.scale}px Arial`;
        textColor = "red";
    }
    
    ctx.font = textFont;
    ctx.fillStyle = textColor;
    ctx.fillText(messageText, canvas.width / 2, canvas.height / 2);
    ctx.restore();

    if (sounds.background) {
        sounds.background.play().catch(e => console.error("Background music error:", e));
    }

    setTimeout(() => {
        gameStarted = true;
        resetGame();
        startTimer();
        updateGame();
    }, 1500);
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'd') {
        DEBUG_MODE = !DEBUG_MODE;
        console.log(`Debug-Modus ist ${DEBUG_MODE ? 'AN' : 'AUS'}`);
    }
});

function handleCanvasInteraction(e) {
    if (!gameStarted) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if (e.type === 'touchstart') {
        if(startScreen.style.display === 'flex' || leaderboardScreen.style.display === 'flex' || customAlert.style.display === 'flex') return;
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }
    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;
    if (e.type === 'contextmenu') {
        startReload();
    } else {
        handleShot(clickX, clickY);
    }
}

canvas.addEventListener('click', handleCanvasInteraction);
canvas.addEventListener('touchstart', handleCanvasInteraction);
canvas.addEventListener('contextmenu', handleCanvasInteraction);

canvas.addEventListener('mousemove', (e) => {
    if (!gameStarted) {
        canvas.style.cursor = 'default';
        return;
    }
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const wasHovered = reloadBtn.isHovered;
    reloadBtn.isHovered = !reloading && mouseX >= reloadBtn.x && mouseX <= reloadBtn.x + reloadBtn.width && mouseY >= reloadBtn.y && mouseY <= reloadBtn.y + reloadBtn.height;
    if (wasHovered !== reloadBtn.isHovered) {
        canvas.style.cursor = reloadBtn.isHovered ? 'pointer' : 'crosshair';
    } else if (!reloadBtn.isHovered) {
        canvas.style.cursor = 'crosshair';
    }
});

startGameBtn.addEventListener('click', startGame);
restartGameBtn.addEventListener('click', () => {
    leaderboardScreen.style.display = 'none';
    startScreen.style.display = 'flex'; 
    playerNameInput.value = '';
    scoreDisplay.textContent = 'Score: 0';
    ammoDisplay.textContent = `Ammo: ${INITIAL_AMMO}`;
    timerDisplay.textContent = `Time: ${GAME_DURATION}`;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (sounds.background) {
        sounds.background.pause();
        sounds.background.currentTime = 0;
    }
});

window.addEventListener('load', async () => {
    resizeCanvas();
    await preloadAssets();
    canvas.style.cursor = 'crosshair';
});
window.addEventListener('resize', resizeCanvas);
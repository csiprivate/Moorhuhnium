

    
    const canvas = document.getElementById("gameCanvas");   // HTML stuff
    const ctx = canvas.getContext("2d");
    const scoreDisplay = document.getElementById("scoreDisplay");
    const ammoDisplay = document.getElementById("ammoDisplay");
    const timerDisplay = document.getElementById("timerDisplay")
    const startScreen = document.getElementById("startScreen");
    const leaderboardScreen = document.getElementById("leaderboardScreen");
    const leaderboardBody = document.getElementById("leaderboardBody");
    const startGameBtn = document.getElementById("startGameBtn");
    const restartGameBtn = document.getElementById("restartGameBtn");
    const playerNameInput = document.getElementById("playerNameInput");
    const customAlert = document.getElementById("customAlert")
    const customAlertMessage = document.getElementById("customAlertMessage");
    const customAlertButton = document.getElementById("customAlertButton");
    const GAME_DURATION = 30; //  Global Constants 
    const INITIAL_AMMO = 8
    const MAX_CHICKENS = 5;
    const RELOAD_TIME_PER_BULLET = 300; 
    const RELOAD_TIME_AFTER_SHOT = 500;
    const ASPECT_RATIO = 800 / 600;
    const MAX_WIDTH = 1000;
    const GameState = {
        MENU: "MENU",
        PLAYING: "PLAYING",
        SHOWING_SCORES: "SHOWING_SCORES"
    };
    let currentGameState = GameState.MENU;
    let playerName = "";    // Dynamic Game Variables 
    let score = 0;
    let ammo = 0;
    let timer = GAME_DURATION;
    let timerInterval = null;
    
    const chickens = [];
    
    let isReloading = false;
    let isShortReloading = false
    let reloadTimeout = null;
    let shotReloadTimeout = null;
    
    const hitDisplays = [];
    const chickenImages = [];
    const sounds = {};
    
    const headshotZones = [
        { relX: 0.1073, relY: 0.0455, relWidth: 0.5645, relHeight: 0.4018 },
        { relX: 0.5202, relY: 0.2104, relWidth: 0.3500, relHeight: 0.5861 },
        { relX: 0.4702, relY: 0.2012, relWidth: 0.4048, relHeight: 0.3745 },
        { relX: 0.4088, relY: 0.3274, relWidth: 0.3565, relHeight: 0.2323 },
    ];
    const reloadButton = { x: 0, y: 0, width: 0, height: 0, textIdle: "Reload", textActive: "Reloading...", isHovered: false };


    

    const SERVER_URL = "http://moornhuhniumserver.duckdns.org"; // Scorespeichern

    async function fetchAndDisplayHighscores() {
        leaderboardBody.innerHTML = "<tr><td colspan=\"3\">Loading high scores...</td></tr>";
        try {
            const response = await fetch(`${SERVER_URL}/scores`);
            if (!response.ok) throw new Error(`Server responded with status: ${response.status}`);
            
             const highscores = await response.json();
            leaderboardBody.innerHTML = "";

            if (highscores.length === 0) {
                  leaderboardBody.innerHTML = "<tr><td colspan=\"3\">No high scores yet. Be the first!</td></tr>";
            } else {
                 highscores.forEach((score, index) => {
                    const rank = index + 1;
                    const row = leaderboardBody.insertRow();
                    if (rank <= 3) {
                        row.classList.add(`place-${rank}`);
                    }
                    const cellRank = row.insertCell(0);
                    const cellName = row.insertCell(1);
                    const cellScore = row.insertCell(2);

                    cellRank.textContent = rank + ".";
                    cellName.textContent = score.spieler
                    cellScore.textContent = score.punkte
                });
            }
        } catch (error) {
            console.error("Error fetching high scores:", error);
            leaderboardBody.innerHTML = `<tr><td colspan="3">Error: ${error.message}</td></tr>`;
          }
    }

    async function submitScore(name, points, hits) {
        console.log(`Submitting score: ${name}, ${points} points`);
        const scoreData = { spieler: name, punkte: points, treffer: hits };
        try {
             const response = await fetch(`${SERVER_URL}/scores`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(scoreData)
            });
            if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);
            const result = await response.json();
            console.log("Response from server after submit:", result);
        } catch (error) {
            console.error("Error submitting score:", error);
            showCustomAlert("Could not save your score! Check your connection.");
        }
    }


    


    async function preloadAssets()   {            // Core Game Logic
        const imageUrls = [ "images/chicken1.png", "images/chicken2.png", "images/chicken3.png", "images/chicken4.png" ];
        const imagePromises = imageUrls.map((src, index) => new Promise(resolve => {
            const img = new Image()
            img.src = src;
            img.onload = () => { chickenImages.push({ image: img, headshotZone: headshotZones[index] }); resolve(); };
            img.onerror = () => { console.error(`Failed to load image: ${src}.`); resolve(); };
        }));

        sounds.shot = new Audio("sounds/gunshot.mp3");
        sounds.reloadShort = new Audio("sounds/reload1.mp3");
        sounds.reloadLong = new Audio("sounds/reload2.mp3");
        sounds.headshot = new Audio("sounds/headshot.mp3")
        sounds.background = new Audio("sounds/background.mp3");
        sounds.background.loop = true;
        sounds.background.volume = 0.6;

        const soundPromises = Object.values(sounds).map(sound => new Promise(resolve => {
             sound.addEventListener("canplaythrough", resolve, { once: true })
             sound.addEventListener("error", (e) => { console.error(`Failed to load sound: ${e.target.src}`); resolve(); });
        }));

         await Promise.all([...imagePromises, ...soundPromises]);
        console.log("All assets (images and sounds) have been preloaded.");
    }

    async function endRound() {
        currentGameState = GameState.SHOWING_SCORES;
        clearInterval(timerInterval);
        timerInterval = null;
        cancelReload();
        if (sounds.background) sounds.background.pause();
        
        leaderboardScreen.style.display = "flex";
        leaderboardBody.innerHTML = "<tr><td colspan=\"3\">Saving your score...</td></tr>";
        
        await submitScore(playerName, score, 0);
        await fetchAndDisplayHighscores();
    }
    
    function startTimer() {
        timer = GAME_DURATION;
        timerDisplay.textContent = `Time: ${timer}`;
        if (timerInterval) clearInterval(timerInterval);
        
        timerInterval = setInterval(() => {
             timer--;
            timerDisplay.textContent = `Time: ${timer}`;
            if (timer <= 0) {
                endRound();
            }
        }, 1000);
    }
    
    function startGame() {
        playerName = playerNameInput.value.trim();
        if (!playerName) {
             showCustomAlert("Please enter your name first!");
            return;
        }
        
        currentGameState = GameState.PLAYING
        startScreen.style.display = "none"
        leaderboardScreen.style.display = "none"
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `bold ${40 * (canvas.width / 800)}px Arial`;
        ctx.fillStyle = "black"
        ctx.fillText("LET'S GO!", canvas.width / 2, canvas.height / 2);
        ctx.restore();

        setTimeout(() => {
            if (currentGameState !== GameState.PLAYING) return;
            if (sounds.background) {
                 sounds.background.currentTime = 0
                 sounds.background.play()
            }
            resetGame();
            startTimer();
            gameLoop();
        }, 1500);
    }
    
    function handleShot(clickX, clickY) {
        if (currentGameState !== GameState.PLAYING || isReloading || isShortReloading || ammo <= 0) return;

        ammo--;
        ammoDisplay.textContent = `Ammo: ${ammo}`
        if (sounds.shot) {
             sounds.shot.currentTime = 0;
            sounds.shot.play();
        }

        let hit = false;
        for (let i = chickens.length - 1; i >= 0; i--) {
            const chicken = chickens[i];
            
            if (clickX >= chicken.x && clickX <= chicken.x + chicken.width && clickY >= chicken.y && clickY <= chicken.y + chicken.height) {
                
                const headshotY = chicken.y + chicken.height * chicken.headshotZone.relY;
                const headshotWidth = chicken.width * chicken.headshotZone.relWidth;
                const headshotHeight = chicken.height * chicken.headshotZone.relHeight;
                let headshotX;

                if (chicken.direction === "left") {
                    headshotX = chicken.x + chicken.width * (1 - chicken.headshotZone.relX - chicken.headshotZone.relWidth);
                } else {
                    headshotX = chicken.x + chicken.width * chicken.headshotZone.relX;
                }

                if (clickX >= headshotX && clickX <= headshotX + headshotWidth &&
                     clickY >= headshotY && clickY <= headshotY + headshotHeight) {
                    
                    const headshotPoints = chicken.points * 2;
                    score += headshotPoints;
                    addHitDisplay(chicken.x + chicken.width / 2, chicken.y, headshotPoints, "headshot");
                    if (sounds.headshot) {
                        sounds.headshot.currentTime = 0;
                        sounds.headshot.play();
                    }

                } else {
                     score += chicken.points;
                    addHitDisplay(chicken.x + chicken.width / 2, chicken.y, chicken.points, "hit");
                }
                
                hit = true;
                chickens.splice(i, 1);
                break;
            }
        }

        scoreDisplay.textContent = `Score: ${score}`;
        
        if (hit) {
            spawnChicken();
        }

        isShortReloading = true
        if (sounds.reloadShort) {
            sounds.reloadShort.currentTime = 0
            sounds.reloadShort.play();
        }
        shotReloadTimeout = setTimeout(() => { isShortReloading = false; }, RELOAD_TIME_AFTER_SHOT);
    }
    
    function startManualReload() {
        if (isReloading || isShortReloading || ammo === INITIAL_AMMO) return;
        cancelReload();
        isReloading = true;
        ammoDisplay.textContent = "Ammo: ...";
        
        function reloadNextBullet() {
            if (!isReloading) return;
            if (sounds.reloadLong) {
                 sounds.reloadLong.currentTime = 0;
                 sounds.reloadLong.play();
            }
            ammo++;
            ammoDisplay.textContent = `Ammo: ${ammo}`;
            if (ammo < INITIAL_AMMO) {
                 reloadTimeout = setTimeout(reloadNextBullet, RELOAD_TIME_PER_BULLET);
            } else {
                isReloading = false;
            }
        }
        reloadNextBullet();
    }

  
    startGameBtn.addEventListener("click", startGame);      // Eventlistener / Helper Functions

    restartGameBtn.addEventListener("click", () => {
        currentGameState = GameState.MENU
        leaderboardScreen.style.display = "none";
        startScreen.style.display = "flex";
        playerNameInput.value = ""
    });

    window.addEventListener("load", async () => {
         resizeCanvas();
        await preloadAssets();
        canvas.style.cursor = "crosshair";
    });

    window.addEventListener("resize", resizeCanvas);
    
    canvas.addEventListener("click", (e) => handleInteraction(e));
    canvas.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        handleInteraction(e);
    });
    
    function handleInteraction(e) {
        if (currentGameState !== GameState.PLAYING) return;

        const rect = canvas.getBoundingClientRect()
        const clickX = e.clientX - rect.left
        const clickY = e.clientY - rect.top

        if (e.type === "contextmenu") {
             startManualReload();
        } else if (clickX >= reloadButton.x && clickX <= reloadButton.x + reloadButton.width && clickY >= reloadButton.y && clickY <= reloadButton.y + reloadButton.height) {
            startManualReload();
        } else {
            handleShot(clickX, clickY);
        }
    }

    canvas.addEventListener("mousemove", (e) => {
        if (currentGameState !== GameState.PLAYING) { canvas.style.cursor = "default"; return; }
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const wasHovered = reloadButton.isHovered;
        reloadButton.isHovered = !isReloading && mouseX >= reloadButton.x && mouseX <= reloadButton.x + reloadButton.width && mouseY >= reloadButton.y && mouseY <= reloadButton.y + reloadButton.height;
        if (wasHovered !== reloadButton.isHovered) {
             canvas.style.cursor = reloadButton.isHovered ? "pointer" : "crosshair";
        }
    });
    
    
    
    function resetGame()    {                   // utility functions 
        score = 0;
        ammo = INITIAL_AMMO
        chickens.length = 0;
        hitDisplays.length = 0
        scoreDisplay.textContent = `Score: ${score}`
        ammoDisplay.textContent = `Ammo: ${ammo}`;
        timerDisplay.textContent = `Time: ${GAME_DURATION}`;
        for (let i = 0; i < MAX_CHICKENS; i++) { spawnChicken(); }
    }
    
    function gameLoop() {
        if (currentGameState !== GameState.PLAYING) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        for (let i = chickens.length - 1; i >= 0; i--) {
            const chicken = chickens[i];
            chicken.x += chicken.direction === "right" ? chicken.speed : -chicken.speed;
            if (chicken.x > canvas.width + chicken.width || chicken.x < -chicken.width * 2) { chickens.splice(i, 1); continue; }
            ctx.save();
            if (chicken.direction === "left") {
                 ctx.translate(chicken.x + chicken.width, chicken.y);
                ctx.scale(-1, 1);
                ctx.drawImage(chicken.image, 0, 0, chicken.width, chicken.height);
            } else {
                ctx.drawImage(chicken.image, chicken.x, chicken.y, chicken.width, chicken.height);
            }
            ctx.restore();
        }
        
        while (chickens.length < MAX_CHICKENS) { spawnChicken(); }
        
        drawReloadButton();
        drawAmmo();
        drawHitDisplays();
        
        requestAnimationFrame(gameLoop);
    }
    
    function cancelReload() {
        if (reloadTimeout) clearTimeout(reloadTimeout);
        if (shotReloadTimeout) clearTimeout(shotReloadTimeout);
        isReloading = false;
        isShortReloading = false;
        if(sounds.reloadLong) {
             sounds.reloadLong.pause();
             sounds.reloadLong.currentTime = 0
        }
        ammoDisplay.textContent = `Ammo: ${ammo}`;
    }
    
    function showCustomAlert(message) {
        customAlertMessage.textContent = message;
        customAlert.style.display = "flex";
        customAlertButton.onclick = () => { customAlert.style.display = "none"; };
    }
    
    function resizeCanvas() {
        const wrapper = document.getElementById("game-wrapper");
        let newWidth = wrapper.clientWidth;
        if (newWidth > MAX_WIDTH) newWidth = MAX_WIDTH;
        
        let newHeight = newWidth / ASPECT_RATIO;
        canvas.width = newWidth;
        canvas.height = newHeight
        
        const uiBar = document.getElementById("ui-bar");
        uiBar.style.width = `${newWidth}px`;
        
        const scale = canvas.width / 800;
        reloadButton.width = 120 * scale
        reloadButton.height = 40 * scale;
        reloadButton.x = canvas.width - reloadButton.width - 10 * scale;
        reloadButton.y = canvas.height - reloadButton.height - 10 * scale;
    }
    
    function addHitDisplay(x, y, points, type = "hit") {
        hitDisplays.push({ x: x, y: y, points: points, alpha: 1.0, lifetime: 60, type: type });
    }
    
    function getRandomChickenImage() {
        if (chickenImages.length === 0) return { image: new Image(), headshotZone: {} };
        return chickenImages[Math.floor(Math.random() * chickenImages.length)];
    }
    
    function spawnChicken() {
        const direction = Math.random() < 0.5 ? "right" : "left";
        const scale = canvas.width / 800;
        const speed = (Math.random() * 2 + 1) * scale;
        const sizeClass = Math.random();
        let baseWidth, baseHeight, points;
        
        if (sizeClass < 0.33) { baseWidth = 40; baseHeight = 30; points = 150; }
        else if (sizeClass < 0.66) { baseWidth = 60; baseHeight = 40; points = 100; }
        else { baseWidth = 80; baseHeight = 60; points = 50; }
        
        const chickenWidth = baseWidth * scale;
        const chickenHeight = baseHeight * scale;
        const asset = getRandomChickenImage();
        
        chickens.push({ x: direction === "right" ? -chickenWidth : canvas.width, y: Math.random() * (canvas.height - chickenHeight - 50 * scale) + 25 * scale, width: chickenWidth, height: chickenHeight, speed: speed, direction: direction, image: asset.image, points: points, headshotZone: asset.headshotZone });
    }
    
    function drawAmmo() {
        const scale = canvas.width / 800;
        const rectWidth = 15 * scale;
        const rectHeight = 6 * scale;
        const spacing = 6 * scale;
        const startX = canvas.width - (20 * scale + rectWidth);
        const totalHeight = INITIAL_AMMO * rectHeight + (INITIAL_AMMO - 1) * spacing;
        const startY = canvas.height / 2 - totalHeight / 2;
        
        for (let i = 0; i < INITIAL_AMMO; i++) {
            ctx.fillStyle = i < ammo ? "limegreen" : "#444"
            const y = startY + i * (rectHeight + spacing)
            ctx.fillRect(startX, y, rectWidth, rectHeight)
            ctx.strokeStyle = "black";
            ctx.lineWidth = 1 * scale;
            ctx.strokeRect(startX, y, rectWidth, rectHeight);
        }
    }
    
    function drawHitDisplays() {
        const scale = canvas.width / 800;
        for (let i = hitDisplays.length - 1; i >= 0; i--) {
            const display = hitDisplays[i];
            ctx.save();
            ctx.globalAlpha = display.alpha;
            let text = `+${display.points}`
            let color = "yellow";
            let fontSize = 22 * scale;
            if (display.type === "headshot") { text = `HEADSHOT! +${display.points}`; color = "red"; fontSize = 24 * scale; }
            ctx.fillStyle = color;
            ctx.font = `bold ${fontSize}px Arial`;
            ctx.textAlign = "center";
            ctx.fillText(text, display.x, display.y);
            ctx.restore();
            display.y -= 0.5 * scale;
            display.alpha -= 1 / display.lifetime;
            if (display.alpha <= 0) { hitDisplays.splice(i, 1); }
        }
    }
    
    function drawReloadButton() {
        ctx.fillStyle = reloadButton.isHovered ? "#666" : "#444";
        ctx.fillRect(reloadButton.x, reloadButton.y, reloadButton.width, reloadButton.height);
        const scale = canvas.width/800;
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2 * scale;
        ctx.strokeRect(reloadButton.x, reloadButton.y, reloadButton.width, reloadButton.height);
        ctx.fillStyle = "white";
        ctx.font = `${20 * scale}px Arial`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle";
        const text = isReloading ? reloadButton.textActive : reloadButton.textIdle;
        ctx.fillText(text, reloadButton.x + reloadButton.width / 2, reloadButton.y + reloadButton.height / 2);
    }

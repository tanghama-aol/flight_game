// 弹幕大战 - 游戏引擎
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        
        // 游戏状态
        this.gameState = 'start'; // start, playing, paused, gameOver
        this.score = 0;
        this.level = 1;
        this.lives = 3;
        this.lastTime = 0;
        
        // 游戏对象
        this.player = null;
        this.enemies = [];
        this.bullets = [];
        this.enemyBullets = [];
        this.particles = [];
        this.powerUps = [];
        
        // 控制系统
        this.keys = {};
        this.mouse = { x: 0, y: 0, pressed: false };
        
        // 手柄控制系统
        this.gamepad = {
            connected: false,
            index: -1,
            deadZone: 0.1,
            vibrationEnabled: true,
            buttons: {},
            axes: { x: 0, y: 0 },
            lastState: {}
        };
        
        // 游戏设置
        this.enemySpawnTimer = 0;
        this.enemySpawnDelay = 2000; // 2秒
        this.powerUpTimer = 0;
        this.backgroundStars = [];
        
        // 性能优化
        this.frameCount = 0;
        this.fps = 60;
        this.lastFpsTime = 0;
        
        // 音效控制
        this.soundEnabled = true;
        this.audioContext = null;
        this.sounds = {};
        
        // 初始化
        this.initEventListeners();
        this.initBackground();
        this.initLeaderboard();
        this.initAudio();
        this.initGamepad();
        this.gameLoop = this.gameLoop.bind(this);
        
        // 确保初始状态正确 - 只显示开始界面
        setTimeout(() => {
            this.showScreen('startScreen');
        }, 100);
    }
    
    initEventListeners() {
        // 键盘控制
        document.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            this.keys[e.code] = true;
            if (e.key === ' ') e.preventDefault();
            
            // 暂停功能
            if (e.key === 'Escape' || e.key === 'p') {
                this.togglePause();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
            this.keys[e.code] = false;
        });
        
        // 鼠标控制
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
        });
        
        this.canvas.addEventListener('mousedown', () => {
            this.mouse.pressed = true;
        });
        
        this.canvas.addEventListener('mouseup', () => {
            this.mouse.pressed = false;
        });
        
        // UI按钮
        document.getElementById('startButton').addEventListener('click', () => this.startGame());
        document.getElementById('restartButton').addEventListener('click', () => this.startGame());
        document.getElementById('mainMenuButton').addEventListener('click', () => this.showMainMenu());
        document.getElementById('leaderboardButton').addEventListener('click', () => this.showLeaderboard());
        document.getElementById('instructionsButton').addEventListener('click', () => this.showInstructions());
        document.getElementById('gamepadSettingsButton').addEventListener('click', () => this.showGamepadSettings());
    }
    
    initBackground() {
        // 创建背景星星
        for (let i = 0; i < 100; i++) {
            this.backgroundStars.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                size: Math.random() * 2 + 1,
                speed: Math.random() * 2 + 0.5,
                opacity: Math.random() * 0.8 + 0.2
            });
        }
    }
    
    initLeaderboard() {
        if (!localStorage.getItem('bulletHellScores')) {
            localStorage.setItem('bulletHellScores', JSON.stringify([]));
        }
    }
    
    initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.createSounds();
        } catch (error) {
            console.log('Audio not supported:', error);
            this.soundEnabled = false;
        }
    }
    
    createSounds() {
        // 创建各种音效
        this.sounds.shoot = this.createSound(800, 0.1, 'square');
        this.sounds.enemyHit = this.createSound(300, 0.2, 'sawtooth');
        this.sounds.explosion = this.createSound(150, 0.5, 'square');
        this.sounds.powerUp = this.createSound(1000, 0.3, 'sine');
        this.sounds.playerHit = this.createSound(200, 0.8, 'triangle');
    }
    
    createSound(frequency, duration, type = 'sine') {
        return {
            frequency: frequency,
            duration: duration,
            type: type
        };
    }
    
    playSound(soundName) {
        if (!this.soundEnabled || !this.audioContext || !this.sounds[soundName]) return;
        
        try {
            const sound = this.sounds[soundName];
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.type = sound.type;
            oscillator.frequency.value = sound.frequency;
            
            gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + sound.duration);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + sound.duration);
        } catch (error) {
            console.log('Sound play error:', error);
        }
    }
    
    initGamepad() {
        // 检查浏览器是否支持手柄API
        if (!navigator.getGamepads) {
            console.log('Gamepad API not supported');
            return;
        }
        
        // 监听手柄连接事件
        window.addEventListener('gamepadconnected', (e) => {
            console.log('Gamepad connected:', e.gamepad.id);
            this.gamepad.connected = true;
            this.gamepad.index = e.gamepad.index;
            this.showGamepadNotification('手柄已连接: ' + e.gamepad.id, 'success');
            this.updateGamepadStatus(true, e.gamepad.id);
        });
        
        // 监听手柄断开事件
        window.addEventListener('gamepaddisconnected', (e) => {
            console.log('Gamepad disconnected:', e.gamepad.id);
            this.gamepad.connected = false;
            this.gamepad.index = -1;
            this.showGamepadNotification('手柄已断开连接', 'warning');
            this.updateGamepadStatus(false);
        });
        
        // 定期检查手柄状态
        this.gamepadCheckInterval = setInterval(() => {
            this.updateGamepadState();
        }, 16); // 60fps
    }
    
    updateGamepadState() {
        if (!this.gamepad.connected || this.gamepad.index < 0) return;
        
        const gamepads = navigator.getGamepads();
        const gp = gamepads[this.gamepad.index];
        
        if (!gp) {
            this.gamepad.connected = false;
            return;
        }
        
        // 更新按钮状态
        for (let i = 0; i < gp.buttons.length; i++) {
            const button = gp.buttons[i];
            const wasPressed = this.gamepad.buttons[i] || false;
            const isPressed = button.pressed || button.value > 0.5;
            
            this.gamepad.buttons[i] = isPressed;
            
            // 按钮按下事件
            if (isPressed && !wasPressed) {
                this.onGamepadButtonDown(i);
            }
            
            // 按钮释放事件
            if (!isPressed && wasPressed) {
                this.onGamepadButtonUp(i);
            }
        }
        
        // 更新摇杆轴向
        if (gp.axes.length >= 2) {
            // 左摇杆 (移动)
            this.gamepad.axes.x = Math.abs(gp.axes[0]) > this.gamepad.deadZone ? gp.axes[0] : 0;
            this.gamepad.axes.y = Math.abs(gp.axes[1]) > this.gamepad.deadZone ? gp.axes[1] : 0;
        }
        
        // 处理连续输入
        this.handleGamepadContinuousInput();
    }
    
    onGamepadButtonDown(buttonIndex) {
        const buttonMap = this.getGamepadButtonMap();
        const action = buttonMap[buttonIndex];
        
        if (!action) return;
        
        switch (action) {
            case 'fire':
                this.gamepad.firing = true;
                break;
            case 'pause':
                if (this.gameState === 'playing' || this.gameState === 'paused') {
                    this.togglePause();
                }
                break;
            case 'confirm':
                this.handleGamepadConfirm();
                break;
            case 'back':
                this.handleGamepadBack();
                break;
            case 'menu':
                if (this.gameState === 'start') {
                    this.startGame();
                }
                break;
        }
        
        // 触发震动反馈
        if (action === 'fire' && this.gameState === 'playing') {
            this.vibrateGamepad(0, 0, 'shoot');
        }
    }
    
    onGamepadButtonUp(buttonIndex) {
        const buttonMap = this.getGamepadButtonMap();
        const action = buttonMap[buttonIndex];
        
        if (action === 'fire') {
            this.gamepad.firing = false;
        }
    }
    
    handleGamepadContinuousInput() {
        // 连续射击
        if (this.gamepad.firing && this.gameState === 'playing' && this.player) {
            this.player.fire(this);
        }
    }
    
    getGamepadButtonMap() {
        // 标准手柄按钮映射 (Xbox/PS4风格)
        return {
            0: 'confirm',     // A/X 按钮
            1: 'back',        // B/Circle 按钮 
            2: 'fire',        // X/Square 按钮
            3: 'menu',        // Y/Triangle 按钮
            4: 'special1',    // LB/L1
            5: 'special2',    // RB/R1
            6: 'fire',        // LT/L2 (扳机)
            7: 'fire',        // RT/R2 (扳机)
            8: 'back',        // Select/Share
            9: 'pause',       // Start/Options
            10: 'menu',       // 左摇杆按下
            11: 'confirm',    // 右摇杆按下
            12: 'up',         // 方向键上
            13: 'down',       // 方向键下
            14: 'left',       // 方向键左
            15: 'right'       // 方向键右
        };
    }
    
    handleGamepadConfirm() {
        switch (this.gameState) {
            case 'start':
                this.startGame();
                break;
            case 'gameOver':
                this.startGame();
                break;
        }
    }
    
    handleGamepadBack() {
        switch (this.gameState) {
            case 'playing':
            case 'paused':
                this.togglePause();
                break;
            case 'gameOver':
                this.showMainMenu();
                break;
        }
    }
    
    vibrateGamepad(duration = 100, intensity = 0.5, pattern = 'basic') {
        if (!this.gamepad.connected || !this.gamepad.vibrationEnabled) return;
        
        const gamepads = navigator.getGamepads();
        const gp = gamepads[this.gamepad.index];
        
        if (!gp || !gp.vibrationActuator) return;
        
        // 不同震动模式
        let vibrationSettings = {};
        
        switch (pattern) {
            case 'shoot':
                vibrationSettings = {
                    duration: 50,
                    weakMagnitude: 0.1,
                    strongMagnitude: 0.2
                };
                break;
            case 'hit':
                vibrationSettings = {
                    duration: 200,
                    weakMagnitude: 0.3,
                    strongMagnitude: 0.5
                };
                break;
            case 'explosion':
                vibrationSettings = {
                    duration: 400,
                    weakMagnitude: 0.6,
                    strongMagnitude: 0.8
                };
                break;
            case 'damage':
                vibrationSettings = {
                    duration: 300,
                    weakMagnitude: 0.4,
                    strongMagnitude: 0.7
                };
                break;
            case 'powerup':
                vibrationSettings = {
                    duration: 150,
                    weakMagnitude: 0.2,
                    strongMagnitude: 0.3
                };
                break;
            case 'levelup':
                // 连续震动效果
                this.vibrateSequence([
                    {duration: 100, weak: 0.3, strong: 0.5},
                    {duration: 100, weak: 0.4, strong: 0.6},
                    {duration: 200, weak: 0.5, strong: 0.8}
                ]);
                return;
            default:
                vibrationSettings = {
                    duration: duration,
                    weakMagnitude: intensity * 0.5,
                    strongMagnitude: intensity
                };
        }
        
        // 使用新的 Vibration API
        if (gp.vibrationActuator.playEffect) {
            gp.vibrationActuator.playEffect('dual-rumble', {
                startDelay: 0,
                ...vibrationSettings
            }).catch(err => {
                console.log('Vibration not supported:', err);
            });
        }
    }
    
    vibrateSequence(sequence) {
        if (!this.gamepad.connected || !this.gamepad.vibrationEnabled) return;
        
        let delay = 0;
        sequence.forEach(vibration => {
            setTimeout(() => {
                const gamepads = navigator.getGamepads();
                const gp = gamepads[this.gamepad.index];
                
                if (gp && gp.vibrationActuator && gp.vibrationActuator.playEffect) {
                    gp.vibrationActuator.playEffect('dual-rumble', {
                        startDelay: 0,
                        duration: vibration.duration,
                        weakMagnitude: vibration.weak,
                        strongMagnitude: vibration.strong
                    }).catch(err => {
                        console.log('Vibration not supported:', err);
                    });
                }
            }, delay);
            delay += vibration.duration + 50; // 小间隔
        });
    }
    
    showGamepadNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `gamepad-notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#00ff00' : type === 'warning' ? '#ffaa00' : '#00ffff'};
            color: #000;
            padding: 10px 20px;
            border-radius: 5px;
            font-weight: bold;
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }
    
    updateGamepadStatus(connected, gamepadId = '') {
        const statusElement = document.getElementById('gamepadStatus');
        const controlsElement = document.getElementById('gamepadControls');
        const settingsButton = document.getElementById('gamepadSettingsButton');
        
        if (connected) {
            statusElement.textContent = `🎮 手柄已连接: ${gamepadId.substring(0, 20)}...`;
            statusElement.className = 'connected';
            settingsButton.style.display = 'inline-block';
            if (this.gameState === 'playing') {
                controlsElement.classList.add('show');
            }
        } else {
            statusElement.textContent = '🎮 手柄已断开';
            statusElement.className = 'disconnected';
            settingsButton.style.display = 'none';
            controlsElement.classList.remove('show');
            
            // 3秒后隐藏断开状态
            setTimeout(() => {
                statusElement.style.display = 'none';
            }, 3000);
        }
    }
    
    toggleGamepadVibration() {
        this.gamepad.vibrationEnabled = !this.gamepad.vibrationEnabled;
        const status = this.gamepad.vibrationEnabled ? '开启' : '关闭';
        this.showGamepadNotification(`震动反馈已${status}`, 'info');
        
        // 测试震动
        if (this.gamepad.vibrationEnabled) {
            this.vibrateGamepad(0, 0, 'powerup');
        }
    }
    
    adjustGamepadDeadZone(delta) {
        this.gamepad.deadZone = Math.max(0.05, Math.min(0.3, this.gamepad.deadZone + delta));
        this.showGamepadNotification(`摇杆死区: ${(this.gamepad.deadZone * 100).toFixed(0)}%`, 'info');
    }
    
    resetGamepadSettings() {
        this.gamepad.deadZone = 0.1;
        this.gamepad.vibrationEnabled = true;
        this.showGamepadNotification('手柄设置已重置', 'info');
    }
    
    startGame() {
        this.gameState = 'playing';
        this.score = 0;
        this.level = 1;
        this.lives = 3;
        this.enemies = [];
        this.bullets = [];
        this.enemyBullets = [];
        this.particles = [];
        this.powerUps = [];
        this.enemySpawnTimer = 0;
        this.powerUpTimer = 0;
        
        // 创建玩家
        this.player = new Player(this.width / 2, this.height - 80);
        
        // 显示游戏HUD界面
        this.showScreen('gameHud');
        this.updateHUD();
        
        // 显示手柄控制提示
        if (this.gamepad.connected) {
            document.getElementById('gamepadControls').classList.add('show');
        }
        
        console.log('Game started, showing gameHud');
        
        // 开始游戏循环
        requestAnimationFrame(this.gameLoop);
    }
    
    showMainMenu() {
        this.gameState = 'start';
        
        // 隐藏手柄控制提示
        document.getElementById('gamepadControls').classList.remove('show');
        
        // 显示开始界面
        this.showScreen('startScreen');
        
        console.log('Showing main menu, displaying startScreen');
    }
    
    showScreen(screenId) {
        // 首先隐藏所有界面
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
            screen.style.display = 'none';
        });
        
        // 然后显示指定界面
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
            targetScreen.style.display = 'flex';
            
            // 特殊处理游戏结束界面
            if (screenId === 'gameOverScreen') {
                this.updateLeaderboard();
            }
        }
        
        console.log(`Switched to screen: ${screenId}`);
    }
    
    updateHUD() {
        document.getElementById('score').textContent = `分数: ${this.score}`;
        document.getElementById('level').textContent = `关卡: ${this.level}`;
        
        let heartsText = '';
        for (let i = 0; i < this.lives; i++) {
            heartsText += '❤️';
        }
        document.getElementById('lives').textContent = `生命: ${heartsText}`;
    }
    
    gameLoop(currentTime) {
        if (this.gameState !== 'playing' && this.gameState !== 'paused') return;
        
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        // FPS计算
        this.frameCount++;
        if (currentTime - this.lastFpsTime > 1000) {
            this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastFpsTime));
            this.frameCount = 0;
            this.lastFpsTime = currentTime;
        }
        
        if (this.gameState === 'playing') {
            this.update(deltaTime);
        }
        this.render();
        
        requestAnimationFrame(this.gameLoop);
    }
    
    update(deltaTime) {
        // 更新背景星星
        this.updateBackground(deltaTime);
        
        // 更新玩家
        if (this.player) {
            this.player.update(deltaTime, this);
        }
        
        // 生成敌机
        this.spawnEnemies(deltaTime);
        
        // 更新敌机
        this.enemies.forEach((enemy, index) => {
            enemy.update(deltaTime, this);
            if (enemy.y > this.height + 50 || enemy.health <= 0) {
                if (enemy.health <= 0) {
                    this.addScore(enemy.points);
                    this.createExplosion(enemy.x, enemy.y, 'enemy');
                    this.playSound('explosion');
                    this.vibrateGamepad(0, 0, 'explosion');
                    // 随机掉落道具
                    if (Math.random() < 0.15) {
                        this.spawnPowerUp(enemy.x, enemy.y);
                    }
                }
                this.enemies.splice(index, 1);
            }
        });
        
        // 更新子弹
        this.updateBullets(deltaTime);
        
        // 更新道具
        this.updatePowerUps(deltaTime);
        
        // 更新粒子效果
        this.updateParticles(deltaTime);
        
        // 碰撞检测
        this.checkCollisions();
        
        // 检查关卡进度
        this.checkLevelProgress();
        
        // 检查游戏结束
        if (this.lives <= 0) {
            this.gameOver();
        }
    }
    
    updateBackground(deltaTime) {
        this.backgroundStars.forEach(star => {
            star.y += star.speed * deltaTime * 0.1;
            if (star.y > this.height) {
                star.y = -star.size;
                star.x = Math.random() * this.width;
            }
        });
    }
    
    spawnEnemies(deltaTime) {
        this.enemySpawnTimer += deltaTime;
        if (this.enemySpawnTimer > this.enemySpawnDelay) {
            const x = Math.random() * (this.width - 60) + 30;
            
            // 根据关卡调整敌机类型概率
            let enemyTypes = ['basic', 'fast', 'heavy', 'shooter'];
            if (this.level >= 3) {
                enemyTypes.push('sniper', 'bomber');
            }
            if (this.level >= 5) {
                enemyTypes.push('boss');
            }
            
            const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
            this.enemies.push(new Enemy(x, -30, type, this.level));
            this.enemySpawnTimer = 0;
            
            // 随着关卡增加，生成速度加快
            this.enemySpawnDelay = Math.max(500, 2000 - this.level * 80);
        }
    }
    
    updateBullets(deltaTime) {
        // 玩家子弹
        this.bullets.forEach((bullet, index) => {
            bullet.update(deltaTime);
            if (bullet.y < -10) {
                this.bullets.splice(index, 1);
            }
        });
        
        // 敌机子弹
        this.enemyBullets.forEach((bullet, index) => {
            bullet.update(deltaTime);
            if (bullet.y > this.height + 10) {
                this.enemyBullets.splice(index, 1);
            }
        });
    }
    
    updatePowerUps(deltaTime) {
        this.powerUpTimer += deltaTime;
        
        this.powerUps.forEach((powerUp, index) => {
            powerUp.update(deltaTime);
            if (powerUp.y > this.height + 20) {
                this.powerUps.splice(index, 1);
            }
        });
    }
    
    updateParticles(deltaTime) {
        this.particles.forEach((particle, index) => {
            particle.update(deltaTime);
            if (particle.life <= 0) {
                this.particles.splice(index, 1);
            }
        });
    }
    
    checkCollisions() {
        if (!this.player || this.player.invulnerable) return;
        
        // 玩家子弹 vs 敌机
        this.bullets.forEach((bullet, bulletIndex) => {
            this.enemies.forEach((enemy, enemyIndex) => {
                if (this.isColliding(bullet, enemy)) {
                    enemy.takeDamage(bullet.damage);
                    this.bullets.splice(bulletIndex, 1);
                    this.createHitEffect(bullet.x, bullet.y);
                    this.playSound('enemyHit');
                    this.vibrateGamepad(0, 0, 'hit');
                }
            });
        });
        
        // 敌机子弹 vs 玩家
        this.enemyBullets.forEach((bullet, index) => {
            if (this.isColliding(bullet, this.player)) {
                this.player.takeDamage(1);
                this.enemyBullets.splice(index, 1);
                this.createExplosion(bullet.x, bullet.y, 'hit');
                this.playSound('playerHit');
                this.vibrateGamepad(0, 0, 'damage');
                this.lives--;
                this.updateHUD();
                if (this.lives > 0) {
                    this.player.makeInvulnerable(2000); // 2秒无敌时间
                }
            }
        });
        
        // 敌机 vs 玩家
        this.enemies.forEach((enemy, index) => {
            if (this.isColliding(enemy, this.player)) {
                this.player.takeDamage(2);
                this.enemies.splice(index, 1);
                this.createExplosion(enemy.x, enemy.y, 'collision');
                this.playSound('explosion');
                this.vibrateGamepad(0, 0, 'explosion');
                this.lives--;
                this.updateHUD();
                if (this.lives > 0) {
                    this.player.makeInvulnerable(2000);
                }
            }
        });
        
        // 道具 vs 玩家
        this.powerUps.forEach((powerUp, index) => {
            if (this.isColliding(powerUp, this.player)) {
                this.collectPowerUp(powerUp);
                this.powerUps.splice(index, 1);
            }
        });
    }
    
    isColliding(obj1, obj2) {
        const dx = obj1.x - obj2.x;
        const dy = obj1.y - obj2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < (obj1.radius || 15) + (obj2.radius || 15);
    }
    
    collectPowerUp(powerUp) {
        this.player.applyPowerUp(powerUp.type);
        this.addScore(50);
        this.createPowerUpEffect(powerUp.x, powerUp.y, powerUp.type);
        this.showPowerUpIndicator(powerUp.type);
        this.playSound('powerUp');
        this.vibrateGamepad(0, 0, 'powerup');
    }
    
    showPowerUpIndicator(type) {
        const indicator = document.getElementById('powerUpIndicator');
        const textEl = document.getElementById('powerUpText');
        const powerUpNames = {
            'rapidFire': '🔥 快速射击',
            'multiShot': '💥 多重射击',
            'shield': '🛡️ 护盾',
            'health': '❤️ 生命回复'
        };
        
        textEl.textContent = powerUpNames[type] || '⭐ 强化';
        indicator.style.display = 'block';
        
        setTimeout(() => {
            indicator.style.display = 'none';
        }, 3000);
    }
    
    checkLevelProgress() {
        const scoreThreshold = this.level * 1000;
        if (this.score >= scoreThreshold) {
            this.level++;
            this.updateHUD();
            this.createLevelUpEffect();
            this.vibrateGamepad(0, 0, 'levelup');
        }
    }
    
    addScore(points) {
        this.score += points;
        this.updateHUD();
    }
    
    createExplosion(x, y, type = 'default') {
        const particleCount = type === 'enemy' ? 15 : 8;
        const colors = type === 'enemy' ? ['#ff6600', '#ff3300', '#ffaa00'] : 
                     type === 'hit' ? ['#00ff00', '#00ffaa', '#66ff66'] :
                     ['#ff0000', '#ff6666', '#ffaaaa'];
        
        for (let i = 0; i < particleCount; i++) {
            this.particles.push(new Particle(
                x, y,
                (Math.random() - 0.5) * 400,
                (Math.random() - 0.5) * 400,
                colors[Math.floor(Math.random() * colors.length)],
                1000 + Math.random() * 500
            ));
        }
    }
    
    createHitEffect(x, y) {
        for (let i = 0; i < 5; i++) {
            this.particles.push(new Particle(
                x, y,
                (Math.random() - 0.5) * 200,
                (Math.random() - 0.5) * 200,
                '#ffffff',
                300
            ));
        }
    }
    
    createPowerUpEffect(x, y, type) {
        const colors = {
            'rapidFire': '#ff6600',
            'multiShot': '#ff00ff',
            'shield': '#00aaff',
            'health': '#ff0066'
        };
        
        for (let i = 0; i < 10; i++) {
            this.particles.push(new Particle(
                x, y,
                (Math.random() - 0.5) * 300,
                (Math.random() - 0.5) * 300,
                colors[type] || '#ffff00',
                800
            ));
        }
    }
    
    createLevelUpEffect() {
        for (let i = 0; i < 20; i++) {
            this.particles.push(new Particle(
                this.width / 2,
                this.height / 2,
                (Math.random() - 0.5) * 500,
                (Math.random() - 0.5) * 500,
                '#ffff00',
                1500
            ));
        }
    }
    
    spawnPowerUp(x, y) {
        const types = ['rapidFire', 'multiShot', 'shield', 'health'];
        const type = types[Math.floor(Math.random() * types.length)];
        this.powerUps.push(new PowerUp(x, y, type));
    }
    
    gameOver() {
        this.gameState = 'gameOver';
        
        // 隐藏手柄控制提示
        document.getElementById('gamepadControls').classList.remove('show');
        
        // 显示游戏结束界面
        this.showScreen('gameOverScreen');
        
        // 更新最终分数
        document.getElementById('finalScore').textContent = `得分: ${this.score}`;
        
        // 检查是否创造新纪录
        const scores = this.getStoredScores();
        const isNewRecord = scores.length === 0 || this.score > Math.max(...scores.map(s => s.score));
        
        if (isNewRecord) {
            document.getElementById('newRecord').style.display = 'block';
        } else {
            document.getElementById('newRecord').style.display = 'none';
        }
        
        console.log('Game over, showing gameOverScreen');
        
        // 保存分数
        this.saveScore();
    }
    
    getStoredScores() {
        return JSON.parse(localStorage.getItem('bulletHellScores') || '[]');
    }
    
    saveScore() {
        const scores = this.getStoredScores();
        const newScore = {
            score: this.score,
            level: this.level,
            date: new Date().toLocaleDateString('zh-CN'),
            time: new Date().toLocaleTimeString('zh-CN')
        };
        
        scores.push(newScore);
        scores.sort((a, b) => b.score - a.score);
        
        // 只保留前10名
        if (scores.length > 10) {
            scores.splice(10);
        }
        
        localStorage.setItem('bulletHellScores', JSON.stringify(scores));
    }
    
    togglePause() {
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
            console.log('Game paused');
        } else if (this.gameState === 'paused') {
            this.gameState = 'playing';
            console.log('Game resumed');
        }
        // 注意：暂停时不切换界面，只是停止更新游戏逻辑
    }
    
    updateLeaderboard() {
        const scores = this.getStoredScores();
        const listEl = document.getElementById('leaderboardList');
        
        if (scores.length === 0) {
            listEl.innerHTML = '<div style="text-align: center; color: #666;">暂无记录</div>';
            return;
        }
        
        listEl.innerHTML = scores.map((score, index) => `
            <div class="leaderboard-entry">
                <span>${index + 1}. ${score.score}分 (关卡${score.level})</span>
                <span>${score.date}</span>
            </div>
        `).join('');
    }
    
    showLeaderboard() {
        this.updateLeaderboard();
        // 这里可以添加显示排行榜的逻辑
    }
    
    showInstructions() {
        // 显示游戏说明
        alert('游戏操作说明：\n\n' +
              '🎮 移动: WASD 或 方向键\n' +
              '🔫 射击: 空格键 或 鼠标点击\n' +
              '💎 道具效果:\n' +
              '   🔥 快速射击: 提高射击速度\n' +
              '   💥 多重射击: 同时发射多颗子弹\n' +
              '   🛡️ 护盾: 临时无敌\n' +
              '   ❤️ 生命回复: 恢复一点生命\n\n' +
              '⭐ 击败不同敌机获得不同分数\n' +
              '🏆 挑战更高分数和关卡！');
    }
    
    showGamepadSettings() {
        if (!this.gamepad.connected) {
            alert('请先连接手柄！');
            return;
        }
        
        const vibrationStatus = this.gamepad.vibrationEnabled ? '✅ 开启' : '❌ 关闭';
        const deadZone = (this.gamepad.deadZone * 100).toFixed(0);
        
        const settingsText = `🎮 手柄设置\n\n` +
                           `震动反馈: ${vibrationStatus}\n` +
                           `摇杆死区: ${deadZone}%\n\n` +
                           `操作说明:\n` +
                           `• 1 - 切换震动反馈\n` +
                           `• 2 - 减小摇杆死区\n` +
                           `• 3 - 增大摇杆死区\n` +
                           `• 4 - 重置所有设置\n` +
                           `• 5 - 测试震动\n` +
                           `• ESC - 返回`;
        
        alert(settingsText);
        
        // 简化版设置界面，使用键盘数字键控制
        const handleSettingsKey = (e) => {
            switch(e.key) {
                case '1':
                    this.toggleGamepadVibration();
                    break;
                case '2':
                    this.adjustGamepadDeadZone(-0.01);
                    break;
                case '3':
                    this.adjustGamepadDeadZone(0.01);
                    break;
                case '4':
                    this.resetGamepadSettings();
                    break;
                case '5':
                    this.vibrateGamepad(0, 0, 'levelup');
                    break;
                case 'Escape':
                    document.removeEventListener('keydown', handleSettingsKey);
                    break;
            }
        };
        
        document.addEventListener('keydown', handleSettingsKey);
    }
    
    render() {
        // 清空画布
        this.ctx.fillStyle = 'rgba(0, 17, 34, 0.1)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // 绘制背景星星
        this.renderBackground();
        
        // 绘制游戏对象
        if (this.player) {
            this.player.render(this.ctx);
        }
        
        this.enemies.forEach(enemy => enemy.render(this.ctx));
        this.bullets.forEach(bullet => bullet.render(this.ctx));
        this.enemyBullets.forEach(bullet => bullet.render(this.ctx));
        this.powerUps.forEach(powerUp => powerUp.render(this.ctx));
        this.particles.forEach(particle => particle.render(this.ctx));
        
        // 暂停界面
        if (this.gameState === 'paused') {
            this.renderPauseScreen();
        }
        
        // 调试信息 (开发模式)
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            this.renderDebugInfo();
        }
    }
    
    renderPauseScreen() {
        // 半透明覆盖层
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // 暂停文本
        this.ctx.fillStyle = '#00ffff';
        this.ctx.font = '48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('游戏暂停', this.width / 2, this.height / 2 - 30);
        
        this.ctx.font = '24px Arial';
        this.ctx.fillText('按 ESC 或 P 继续游戏', this.width / 2, this.height / 2 + 30);
    }
    
    renderDebugInfo() {
        this.ctx.fillStyle = '#ffff00';
        this.ctx.font = '14px monospace';
        this.ctx.textAlign = 'left';
        
        const debugInfo = [
            `FPS: ${this.fps}`,
            `状态: ${this.gameState}`,
            `敌机: ${this.enemies.length}`,
            `子弹: ${this.bullets.length}`,
            `敌弹: ${this.enemyBullets.length}`,
            `粒子: ${this.particles.length}`,
            `道具: ${this.powerUps.length}`,
            `手柄: ${this.gamepad.connected ? '已连接' : '未连接'}`
        ];
        
        debugInfo.forEach((info, index) => {
            this.ctx.fillText(info, 10, 20 + index * 16);
        });
    }
    
    renderBackground() {
        this.backgroundStars.forEach(star => {
            this.ctx.save();
            this.ctx.globalAlpha = star.opacity;
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });
    }
}

// 玩家类
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 30;
        this.radius = 15;
        this.speed = 300;
        this.health = 3;
        this.maxHealth = 3;
        
        // 射击系统
        this.fireRate = 300; // 射击间隔(ms)
        this.lastFireTime = 0;
        this.bulletSpeed = 400;
        this.bulletDamage = 1;
        
        // 强化效果
        this.powerUps = {
            rapidFire: 0,
            multiShot: 0,
            shield: 0
        };
        
        // 状态
        this.invulnerable = false;
        this.invulnerableTime = 0;
    }
    
    update(deltaTime, game) {
        // 移动控制
        let dx = 0, dy = 0;
        
        // 键盘输入
        if (game.keys['a'] || game.keys['arrowleft']) dx -= 1;
        if (game.keys['d'] || game.keys['arrowright']) dx += 1;
        if (game.keys['w'] || game.keys['arrowup']) dy -= 1;
        if (game.keys['s'] || game.keys['arrowdown']) dy += 1;
        
        // 手柄输入 (优先级高于键盘)
        if (game.gamepad.connected) {
            // 摇杆移动
            if (Math.abs(game.gamepad.axes.x) > 0.1 || Math.abs(game.gamepad.axes.y) > 0.1) {
                dx = game.gamepad.axes.x;
                dy = game.gamepad.axes.y;
            }
            
            // 方向键移动
            if (game.gamepad.buttons[12]) dy -= 1; // 上
            if (game.gamepad.buttons[13]) dy += 1; // 下
            if (game.gamepad.buttons[14]) dx -= 1; // 左
            if (game.gamepad.buttons[15]) dx += 1; // 右
        }
        
        // 鼠标移动 (如果没有其他输入)
        if (dx === 0 && dy === 0 && (game.mouse.x !== 0 || game.mouse.y !== 0)) {
            const mouseInfluence = 0.05;
            dx += (game.mouse.x - this.x) * mouseInfluence;
            dy += (game.mouse.y - this.y) * mouseInfluence;
        }
        
        // 应用移动
        if (dx !== 0 || dy !== 0) {
            const magnitude = Math.sqrt(dx * dx + dy * dy);
            dx /= magnitude;
            dy /= magnitude;
            
            this.x += dx * this.speed * deltaTime * 0.001;
            this.y += dy * this.speed * deltaTime * 0.001;
        }
        
        // 边界限制
        this.x = Math.max(this.radius, Math.min(game.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(game.height - this.radius, this.y));
        
        // 射击
        if (game.keys[' '] || game.keys['space'] || game.mouse.pressed) {
            this.fire(game);
        }
        
        // 更新强化效果
        this.updatePowerUps(deltaTime);
        
        // 更新无敌状态
        if (this.invulnerable) {
            this.invulnerableTime -= deltaTime;
            if (this.invulnerableTime <= 0) {
                this.invulnerable = false;
            }
        }
    }
    
    fire(game) {
        const currentTime = Date.now();
        let fireRate = this.fireRate;
        
        // 快速射击效果
        if (this.powerUps.rapidFire > 0) {
            fireRate = this.fireRate * 0.3;
        }
        
        if (currentTime - this.lastFireTime < fireRate) return;
        
        this.lastFireTime = currentTime;
        game.playSound('shoot');
        
        // 多重射击
        if (this.powerUps.multiShot > 0) {
            const angles = [-0.3, 0, 0.3];
            angles.forEach(angle => {
                game.bullets.push(new Bullet(
                    this.x + Math.sin(angle) * 20,
                    this.y - 20,
                    Math.sin(angle) * this.bulletSpeed,
                    -this.bulletSpeed + Math.cos(angle) * 50,
                    '#00ffff',
                    this.bulletDamage
                ));
            });
        } else {
            game.bullets.push(new Bullet(
                this.x,
                this.y - 20,
                0,
                -this.bulletSpeed,
                '#00ffff',
                this.bulletDamage
            ));
        }
    }
    
    updatePowerUps(deltaTime) {
        Object.keys(this.powerUps).forEach(key => {
            if (this.powerUps[key] > 0) {
                this.powerUps[key] -= deltaTime;
            }
        });
    }
    
    applyPowerUp(type) {
        switch (type) {
            case 'rapidFire':
                this.powerUps.rapidFire = 8000; // 8秒
                break;
            case 'multiShot':
                this.powerUps.multiShot = 10000; // 10秒
                break;
            case 'shield':
                this.powerUps.shield = 5000; // 5秒护盾
                this.makeInvulnerable(5000);
                break;
            case 'health':
                if (this.health < this.maxHealth) {
                    this.health++;
                }
                break;
        }
    }
    
    takeDamage(damage) {
        if (this.invulnerable || this.powerUps.shield > 0) return;
        this.health -= damage;
    }
    
    makeInvulnerable(duration) {
        this.invulnerable = true;
        this.invulnerableTime = duration;
    }
    
    render(ctx) {
        ctx.save();
        
        // 无敌闪烁效果
        if (this.invulnerable) {
            ctx.globalAlpha = Math.sin(Date.now() * 0.01) * 0.5 + 0.5;
        }
        
        // 护盾效果
        if (this.powerUps.shield > 0) {
            ctx.strokeStyle = '#00aaff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 5, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        // 绘制飞机
        ctx.fillStyle = '#00ffff';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.radius);
        ctx.lineTo(this.x - this.radius * 0.8, this.y + this.radius * 0.8);
        ctx.lineTo(this.x, this.y + this.radius * 0.3);
        ctx.lineTo(this.x + this.radius * 0.8, this.y + this.radius * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // 绘制引擎尾焰
        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.moveTo(this.x - 5, this.y + this.radius * 0.3);
        ctx.lineTo(this.x + 5, this.y + this.radius * 0.3);
        ctx.lineTo(this.x, this.y + this.radius + Math.sin(Date.now() * 0.01) * 5);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
    }
}

// 敌机类
class Enemy {
    constructor(x, y, type = 'basic', level = 1) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.radius = 20;
        
        // 根据类型设置属性
        this.setTypeProperties(type, level);
        
        // 移动模式
        this.movePattern = 'straight';
        this.moveTimer = 0;
        this.initialX = x;
        
        // 射击系统
        this.lastFireTime = 0;
        this.firePattern = 'none';
    }
    
    setTypeProperties(type, level) {
        const levelMultiplier = 1 + (level - 1) * 0.3;
        
        switch (type) {
            case 'basic':
                this.health = Math.floor(1 * levelMultiplier);
                this.maxHealth = this.health;
                this.speed = 80 * levelMultiplier;
                this.points = 100;
                this.color = '#ff6600';
                this.firePattern = 'none';
                break;
                
            case 'fast':
                this.health = Math.floor(1 * levelMultiplier);
                this.maxHealth = this.health;
                this.speed = 150 * levelMultiplier;
                this.points = 150;
                this.color = '#ff0066';
                this.movePattern = 'zigzag';
                this.firePattern = 'none';
                break;
                
            case 'heavy':
                this.health = Math.floor(3 * levelMultiplier);
                this.maxHealth = this.health;
                this.speed = 50 * levelMultiplier;
                this.points = 300;
                this.color = '#666666';
                this.radius = 25;
                this.firePattern = 'single';
                this.fireRate = 2000;
                break;
                
            case 'shooter':
                this.health = Math.floor(2 * levelMultiplier);
                this.maxHealth = this.health;
                this.speed = 60 * levelMultiplier;
                this.points = 200;
                this.color = '#9900ff';
                this.firePattern = 'spread';
                this.fireRate = 1500;
                break;
                
            case 'sniper':
                this.health = Math.floor(1 * levelMultiplier);
                this.maxHealth = this.health;
                this.speed = 40 * levelMultiplier;
                this.points = 250;
                this.color = '#ff9900';
                this.firePattern = 'aimed';
                this.fireRate = 2500;
                this.movePattern = 'sine';
                break;
                
            case 'bomber':
                this.health = Math.floor(4 * levelMultiplier);
                this.maxHealth = this.health;
                this.speed = 30 * levelMultiplier;
                this.points = 400;
                this.color = '#009900';
                this.radius = 30;
                this.firePattern = 'circle';
                this.fireRate = 3000;
                break;
                
            case 'boss':
                this.health = Math.floor(10 * levelMultiplier);
                this.maxHealth = this.health;
                this.speed = 20 * levelMultiplier;
                this.points = 1000;
                this.color = '#ff0000';
                this.radius = 40;
                this.firePattern = 'boss';
                this.fireRate = 800;
                this.movePattern = 'sine';
                break;
        }
    }
    
    update(deltaTime, game) {
        // 移动
        this.updateMovement(deltaTime);
        
        // 射击
        this.updateFirePattern(deltaTime, game);
        
        // 边界检查
        if (this.movePattern === 'zigzag') {
            if (this.x < this.radius || this.x > game.width - this.radius) {
                this.speed *= -1;
            }
        }
    }
    
    updateMovement(deltaTime) {
        const dt = deltaTime * 0.001;
        this.moveTimer += deltaTime;
        
        switch (this.movePattern) {
            case 'straight':
                this.y += this.speed * dt;
                break;
                
            case 'zigzag':
                this.y += Math.abs(this.speed) * 0.7 * dt;
                this.x += this.speed * dt;
                break;
                
            case 'sine':
                this.y += Math.abs(this.speed) * dt;
                this.x = this.initialX + Math.sin(this.moveTimer * 0.003) * 100;
                break;
        }
    }
    
    updateFirePattern(deltaTime, game) {
        if (this.firePattern === 'none') return;
        
        const currentTime = Date.now();
        if (currentTime - this.lastFireTime < this.fireRate) return;
        
        this.lastFireTime = currentTime;
        
        switch (this.firePattern) {
            case 'single':
                game.enemyBullets.push(new Bullet(
                    this.x, this.y + this.radius,
                    0, 200, '#ff6600', 1
                ));
                break;
                
            case 'spread':
                const angles = [-0.5, -0.25, 0, 0.25, 0.5];
                angles.forEach(angle => {
                    game.enemyBullets.push(new Bullet(
                        this.x, this.y + this.radius,
                        Math.sin(angle) * 150,
                        Math.cos(angle) * 150 + 100,
                        '#ff3366', 1
                    ));
                });
                break;
                
            case 'aimed':
                if (game.player) {
                    const dx = game.player.x - this.x;
                    const dy = game.player.y - this.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const speed = 200;
                    
                    game.enemyBullets.push(new Bullet(
                        this.x, this.y + this.radius,
                        (dx / distance) * speed,
                        (dy / distance) * speed,
                        '#ff0000', 1
                    ));
                }
                break;
                
            case 'circle':
                const bulletCount = 8;
                for (let i = 0; i < bulletCount; i++) {
                    const angle = (i * Math.PI * 2) / bulletCount;
                    const speed = 120;
                    
                    game.enemyBullets.push(new Bullet(
                        this.x, this.y + this.radius,
                        Math.cos(angle) * speed,
                        Math.sin(angle) * speed,
                        '#00ff00', 1
                    ));
                }
                break;
                
            case 'boss':
                // Boss复杂弹幕模式
                const patterns = ['spread', 'circle', 'aimed'];
                const currentPattern = patterns[Math.floor(Date.now() / 2000) % patterns.length];
                
                if (currentPattern === 'spread') {
                    const angles = [-0.8, -0.4, 0, 0.4, 0.8];
                    angles.forEach(angle => {
                        game.enemyBullets.push(new Bullet(
                            this.x, this.y + this.radius,
                            Math.sin(angle) * 180,
                            Math.cos(angle) * 180 + 80,
                            '#ff0000', 2
                        ));
                    });
                } else if (currentPattern === 'circle') {
                    const bulletCount = 12;
                    for (let i = 0; i < bulletCount; i++) {
                        const angle = (i * Math.PI * 2) / bulletCount + Date.now() * 0.001;
                        game.enemyBullets.push(new Bullet(
                            this.x, this.y + this.radius,
                            Math.cos(angle) * 150,
                            Math.sin(angle) * 150,
                            '#ff0000', 2
                        ));
                    }
                } else if (currentPattern === 'aimed' && game.player) {
                    for (let i = 0; i < 3; i++) {
                        const dx = game.player.x - this.x;
                        const dy = game.player.y - this.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        const spread = (i - 1) * 0.2;
                        
                        game.enemyBullets.push(new Bullet(
                            this.x, this.y + this.radius,
                            (dx / distance + spread) * 220,
                            (dy / distance) * 220,
                            '#ff0000', 2
                        ));
                    }
                }
                break;
        }
    }
    
    takeDamage(damage) {
        this.health -= damage;
    }
    
    render(ctx) {
        ctx.save();
        
        // 血条
        if (this.health < this.maxHealth) {
            const barWidth = this.radius * 2;
            const barHeight = 4;
            const healthPercent = this.health / this.maxHealth;
            
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(this.x - barWidth/2, this.y - this.radius - 10, barWidth, barHeight);
            
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(this.x - barWidth/2, this.y - this.radius - 10, barWidth * healthPercent, barHeight);
        }
        
        // 敌机本体
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        
        if (this.type === 'heavy') {
            // 重型敌机 - 六边形
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (i * Math.PI) / 3;
                const x = this.x + Math.cos(angle) * this.radius;
                const y = this.y + Math.sin(angle) * this.radius;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
        } else {
            // 其他敌机 - 三角形
            ctx.beginPath();
            ctx.moveTo(this.x, this.y + this.radius);
            ctx.lineTo(this.x - this.radius * 0.8, this.y - this.radius * 0.8);
            ctx.lineTo(this.x + this.radius * 0.8, this.y - this.radius * 0.8);
            ctx.closePath();
        }
        
        ctx.fill();
        ctx.stroke();
        
        // 特殊效果
        if (this.type === 'shooter') {
            // 射手型 - 炮管
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x, this.y + this.radius + 10);
            ctx.stroke();
        }
        
        ctx.restore();
    }
}

// 子弹类
class Bullet {
    constructor(x, y, vx, vy, color = '#ffffff', damage = 1) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.damage = damage;
        this.radius = 3;
        this.trail = [];
        this.maxTrailLength = 5;
    }
    
    update(deltaTime) {
        // 记录轨迹
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > this.maxTrailLength) {
            this.trail.shift();
        }
        
        // 移动
        const dt = deltaTime * 0.001;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }
    
    render(ctx) {
        ctx.save();
        
        // 绘制轨迹
        if (this.trail.length > 1) {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.3;
            
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let i = 1; i < this.trail.length; i++) {
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }
            ctx.stroke();
        }
        
        // 绘制子弹
        ctx.globalAlpha = 1;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // 发光效果
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
}

// 道具类
class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.radius = 15;
        this.speed = 100;
        this.rotationSpeed = 0.05;
        this.rotation = 0;
        this.pulseTimer = 0;
        
        // 道具颜色
        this.colors = {
            'rapidFire': '#ff6600',
            'multiShot': '#ff00ff',
            'shield': '#00aaff',
            'health': '#ff0066'
        };
        
        this.color = this.colors[type] || '#ffff00';
    }
    
    update(deltaTime) {
        const dt = deltaTime * 0.001;
        this.y += this.speed * dt;
        this.rotation += this.rotationSpeed;
        this.pulseTimer += deltaTime;
    }
    
    render(ctx) {
        ctx.save();
        
        const pulse = Math.sin(this.pulseTimer * 0.01) * 0.3 + 1;
        const size = this.radius * pulse;
        
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // 发光效果
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 15;
        
        // 绘制道具图标
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        
        switch (this.type) {
            case 'rapidFire':
                // 闪电图标
                ctx.beginPath();
                ctx.moveTo(-size*0.3, -size*0.5);
                ctx.lineTo(size*0.1, -size*0.1);
                ctx.lineTo(-size*0.1, -size*0.1);
                ctx.lineTo(size*0.3, size*0.5);
                ctx.lineTo(-size*0.1, size*0.1);
                ctx.lineTo(size*0.1, size*0.1);
                ctx.closePath();
                break;
                
            case 'multiShot':
                // 三箭头图标
                for (let i = -1; i <= 1; i++) {
                    ctx.beginPath();
                    ctx.moveTo(i * size * 0.3, -size * 0.5);
                    ctx.lineTo(i * size * 0.3 - size * 0.2, size * 0.5);
                    ctx.lineTo(i * size * 0.3, size * 0.3);
                    ctx.lineTo(i * size * 0.3 + size * 0.2, size * 0.5);
                    ctx.closePath();
                }
                break;
                
            case 'shield':
                // 盾牌图标
                ctx.beginPath();
                ctx.moveTo(0, -size * 0.6);
                ctx.quadraticCurveTo(size * 0.6, -size * 0.2, size * 0.4, size * 0.2);
                ctx.quadraticCurveTo(0, size * 0.6, -size * 0.4, size * 0.2);
                ctx.quadraticCurveTo(-size * 0.6, -size * 0.2, 0, -size * 0.6);
                ctx.closePath();
                break;
                
            case 'health':
                // 十字图标
                ctx.fillRect(-size * 0.1, -size * 0.5, size * 0.2, size);
                ctx.fillRect(-size * 0.5, -size * 0.1, size, size * 0.2);
                break;
                
            default:
                // 星形图标
                ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    const angle = (i * 4 * Math.PI) / 5;
                    const x = Math.cos(angle) * size;
                    const y = Math.sin(angle) * size;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
        }
        
        ctx.fill();
        ctx.stroke();
        
        ctx.restore();
    }
}

// 粒子类
class Particle {
    constructor(x, y, vx, vy, color, life) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.size = Math.random() * 4 + 2;
        this.gravity = 100;
        this.friction = 0.98;
    }
    
    update(deltaTime) {
        const dt = deltaTime * 0.001;
        
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.vy += this.gravity * dt;
        
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        
        this.life -= deltaTime;
    }
    
    render(ctx) {
        const alpha = this.life / this.maxLife;
        const size = this.size * alpha;
        
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = size;
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
}

// 初始化游戏
const game = new Game();

// 防止页面滚动和默认行为
document.addEventListener('keydown', (e) => {
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
    }
});

// 防止右键菜单
document.addEventListener('contextmenu', (e) => e.preventDefault());

console.log('弹幕大战 - 星际穿越 已加载完成！');
console.log('点击"开始游戏"按钮开始你的星际冒险！');
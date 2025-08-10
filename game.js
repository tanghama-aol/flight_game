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
        this.players = []; // 支持多个玩家
        this.coopMode = false; // 双人合作模式标志
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
        
        // 屏幕效果
        this.screenFlash = {
            active: false,
            intensity: 0,
            duration: 0,
            timer: 0
        };
        
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
        document.getElementById('singlePlayerButton').addEventListener('click', () => {
            this.coopMode = false;
            this.startGame();
        });
        document.getElementById('coopPlayerButton').addEventListener('click', () => {
            this.coopMode = true;
            this.startGame();
        });
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
        this.sounds.bomb = this.createBombSound(); // 大雷专用音效
    }
    
    createSound(frequency, duration, type = 'sine') {
        return {
            frequency: frequency,
            duration: duration,
            type: type
        };
    }
    
    createBombSound() {
        // 大雷音效 - 多层音效组合
        return {
            type: 'bomb', // 特殊类型标记
            frequencies: [80, 120, 200, 400], // 多频率叠加
            duration: 1.0,
            waveType: 'sawtooth'
        };
    }
    
    playSound(soundName) {
        if (!this.soundEnabled || !this.audioContext || !this.sounds[soundName]) return;
        
        try {
            const sound = this.sounds[soundName];
            
            // 特殊处理大雷音效
            if (sound.type === 'bomb') {
                this.playBombSound(sound);
                return;
            }
            
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
    
    playBombSound(sound) {
        // 播放多层大雷音效
        sound.frequencies.forEach((freq, index) => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.type = sound.waveType;
            oscillator.frequency.value = freq;
            
            // 不同频率的不同音量和时长
            const volume = 0.3 / (index + 1);
            const duration = sound.duration * (1 + index * 0.2);
            
            gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
            
            oscillator.start(this.audioContext.currentTime + index * 0.05);
            oscillator.stop(this.audioContext.currentTime + duration);
        });
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
        if (this.coopMode) {
            // 双人模式: 更多生命值和不同的生命机制
            this.lives = 5; // 双人模式有更多生命
            this.players = [
                new Player(this.width / 3, this.height - 80, 1),     // 玩家1
                new Player(this.width * 2 / 3, this.height - 80, 2)  // 玩家2
            ];
            this.player = this.players[0]; // 保持兼容性
            
            // 双人模式特殊设置
            this.players.forEach(player => {
                player.maxHealth = 4; // 每个玩家更多血量
                player.health = player.maxHealth;
            });
        } else {
            // 单人模式
            this.lives = 3;
            this.player = new Player(this.width / 2, this.height - 80, 1);
            this.players = [this.player];
        }
        
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
        
        // 双人模式显示额外信息
        if (this.coopMode) {
            let player1Health = this.players[0] ? this.players[0].health : 0;
            let player2Health = this.players[1] ? this.players[1].health : 0;
            let player1Bombs = this.players[0] ? this.players[0].bombs : 0;
            let player2Bombs = this.players[1] ? this.players[1].bombs : 0;
            
            document.getElementById('lives').innerHTML = 
                `<div>生命: ${heartsText}</div>` +
                `<div style="font-size: 0.8em; margin-top: 5px;">` +
                `<span style="color: #00ffff;">P1: ${player1Health}/4 💣${player1Bombs}</span> | ` +
                `<span style="color: #ff00ff;">P2: ${player2Health}/4 💣${player2Bombs}</span>` +
                `</div>`;
        } else {
            let playerBombs = this.player ? this.player.bombs : 0;
            document.getElementById('lives').innerHTML = 
                `<div>生命: ${heartsText}</div>` +
                `<div style="font-size: 0.9em; margin-top: 5px; color: #ffff00;">💣 大雷: ${playerBombs}</div>`;
        }
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
        
        // 更新玩家(支持双人模式)
        if (this.coopMode) {
            // 双人模式: 更新所有玩家
            this.players.forEach((player, index) => {
                if (player) {
                    player.update(deltaTime, this);
                    
                    // 检查玩家生命值
                    if (player.health <= 0) {
                        this.lives--;
                        if (this.lives <= 0) {
                            this.gameOver();
                            return;
                        }
                        // 重置玩家位置和状态
                        player.x = this.width / (this.players.length + 1) * (index + 1);
                        player.y = this.height - 80;
                        player.health = player.maxHealth;
                        player.invulnerable = true;
                        player.invulnerableTime = 2000;
                    }
                }
            });
        } else {
            // 单人模式: 只更新主玩家
            if (this.player) {
                this.player.update(deltaTime, this);
            }
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
                    
                    // 根据敌人类型掉落道具
                    this.handleEnemyDrop(enemy);
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
        
        // 更新屏幕闪光效果
        this.updateScreenFlash(deltaTime);
        
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
            
            // 双人模式: 增加敌人生成频率和数量
            if (this.coopMode) {
                // 双人模式有25%概率生成第二个敌人
                if (Math.random() < 0.25) {
                    const x2 = Math.random() * (this.width - 60) + 30;
                    const type2 = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
                    this.enemies.push(new Enemy(x2, -30, type2, this.level));
                }
            }
            
            this.enemySpawnTimer = 0;
            
            // 随着关卡增加，生成速度加快
            // 双人模式生成速度稍快
            const baseDelay = this.coopMode ? 1800 : 2000;
            const levelReduction = this.coopMode ? 100 : 80;
            this.enemySpawnDelay = Math.max(400, baseDelay - this.level * levelReduction);
        }
    }
    
    updateBullets(deltaTime) {
        // 玩家子弹
        this.bullets.forEach((bullet, index) => {
            bullet.update(deltaTime);
            if (bullet.y < -10 || bullet.shouldRemove) {
                this.bullets.splice(index, 1);
            }
        });
        
        // 敌机子弹
        this.enemyBullets.forEach((bullet, index) => {
            bullet.update(deltaTime);
            if (bullet.y > this.height + 10 || bullet.shouldRemove) {
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
    
    updateScreenFlash(deltaTime) {
        if (this.screenFlash.active) {
            this.screenFlash.timer += deltaTime;
            
            // 计算闪光强度衰减
            const progress = this.screenFlash.timer / this.screenFlash.duration;
            this.screenFlash.intensity = Math.max(0, 1 - progress);
            
            if (progress >= 1) {
                this.screenFlash.active = false;
                this.screenFlash.intensity = 0;
            }
        }
    }
    
    checkCollisions() {
        const playersToCheck = this.coopMode ? this.players : [this.player];
        
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
        
        // 敌机子弹 vs 玩家们
        this.enemyBullets.forEach((bullet, bulletIndex) => {
            playersToCheck.forEach(player => {
                if (player && !player.invulnerable && this.isColliding(bullet, player)) {
                    player.takeDamage(1);
                    this.enemyBullets.splice(bulletIndex, 1);
                    this.createExplosion(bullet.x, bullet.y, 'hit');
                    this.playSound('playerHit');
                    this.vibrateGamepad(0, 0, 'damage');
                    this.lives--;
                    this.updateHUD();
                    if (this.lives > 0) {
                        player.makeInvulnerable(2000); // 2秒无敌时间
                    }
                    return; // 防止同一子弹击中多个玩家
                }
            });
        });
        
        // 敌机 vs 玩家们
        this.enemies.forEach((enemy, enemyIndex) => {
            playersToCheck.forEach(player => {
                if (player && !player.invulnerable && this.isColliding(enemy, player)) {
                    player.takeDamage(2);
                    this.enemies.splice(enemyIndex, 1);
                    this.createExplosion(enemy.x, enemy.y, 'collision');
                    this.playSound('explosion');
                    this.vibrateGamepad(0, 0, 'explosion');
                    this.lives--;
                    this.updateHUD();
                    if (this.lives > 0) {
                        player.makeInvulnerable(2000);
                    }
                    return; // 防止同一敌机撞击多个玩家
                }
            });
        });
        
        // 道具 vs 玩家们
        this.powerUps.forEach((powerUp, powerUpIndex) => {
            playersToCheck.forEach(player => {
                if (player && this.isColliding(powerUp, player)) {
                    this.collectPowerUp(powerUp, player);
                    this.powerUps.splice(powerUpIndex, 1);
                    return; // 防止同一道具被多个玩家拾取
                }
            });
        });
    }
    
    isColliding(obj1, obj2) {
        const dx = obj1.x - obj2.x;
        const dy = obj1.y - obj2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < (obj1.radius || 15) + (obj2.radius || 15);
    }
    
    collectPowerUp(powerUp, player = null) {
        const targetPlayer = player || this.player;
        if (targetPlayer) {
            targetPlayer.applyPowerUp(powerUp.type);
            this.addScore(50);
            this.createPowerUpEffect(powerUp.x, powerUp.y, powerUp.type);
            this.showPowerUpIndicator(powerUp.type);
            this.playSound('powerUp');
            this.vibrateGamepad(0, 0, 'powerup');
        }
    }
    
    showPowerUpIndicator(type) {
        const indicator = document.getElementById('powerUpIndicator');
        const textEl = document.getElementById('powerUpText');
        const powerUpNames = {
            'rapidFire': '🔥 快速射击',
            'multiShot': '💥 多重射击',
            'shield': '🛡️ 护盾',
            'health': '❤️ 生命回复',
            'bomb': '💣 大雷获得',
            // 子弹升级道具名称
            'bullet_piercing': '🏹 穿透弹',
            'bullet_explosive': '💥 爆炸弹',
            'bullet_laser': '🔆 激光弹',
            'bullet_plasma': '⚡ 等离子弹',
            'bullet_homing': '🎯 追踪弹',
            'bullet_scatter': '💫 散射弹',
            'bullet_upgrade': '⭐ 子弹升级'
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
    
    activateBomb(player) {
        // 大雷效果：清理所有非boss敌人，boss扣1/5血量
        let destroyedEnemies = 0;
        
        this.enemies.forEach((enemy, index) => {
            if (enemy.type === 'boss') {
                // Boss扣血1/5
                const damage = Math.ceil(enemy.maxHealth / 5);
                enemy.takeDamage(damage);
                this.createBombExplosion(enemy.x, enemy.y, 'boss');
            } else {
                // 普通敌人直接销毁
                this.addScore(enemy.points);
                this.createBombExplosion(enemy.x, enemy.y, 'enemy');
                destroyedEnemies++;
                
                // 有几率掉落大雷
                if (Math.random() < 0.15) { // 15%几率
                    this.spawnBomb(enemy.x, enemy.y);
                }
            }
        });
        
        // 移除所有非boss敌人
        this.enemies = this.enemies.filter(enemy => enemy.type === 'boss');
        
        // 清理所有敌人子弹
        this.enemyBullets = [];
        
        // 创建大雷爆炸效果
        this.createBombBlast(player);
        
        // 播放大雷音效
        this.playSound('bomb');
        
        // 强力震动反馈
        this.vibrateGamepad(500, 1.0, 'bomb');
        
        console.log(`Player ${player.playerId} used bomb! Destroyed ${destroyedEnemies} enemies.`);
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
    
    createBombExplosion(x, y, type = 'enemy') {
        // 大雷专用爆炸效果 - 更大更亮
        const particleCount = type === 'boss' ? 25 : 20;
        const colors = type === 'boss' ? ['#ffff00', '#ff8800', '#ffaa00'] : 
                     ['#ffff00', '#ff6600', '#ffaa00'];
        
        for (let i = 0; i < particleCount; i++) {
            this.particles.push(new Particle(
                x + (Math.random() - 0.5) * 40, // 稍微分散
                y + (Math.random() - 0.5) * 40,
                (Math.random() - 0.5) * 600, // 更大的爆炸半径
                (Math.random() - 0.5) * 600,
                colors[Math.floor(Math.random() * colors.length)],
                1500 + Math.random() * 800 // 更持久的效果
            ));
        }
    }
    
    createBombBlast(player) {
        // 创建全屏大雷爆炸波效果
        for (let i = 0; i < 50; i++) {
            const angle = (Math.PI * 2 * i) / 50;
            const distance = 100 + Math.random() * 300;
            const x = player.x + Math.cos(angle) * distance;
            const y = player.y + Math.sin(angle) * distance;
            
            this.particles.push(new Particle(
                x, y,
                Math.cos(angle) * 200,
                Math.sin(angle) * 200,
                '#ffffff', // 白色闪光
                800 + Math.random() * 400
            ));
        }
        
        // 屏幕闪光效果
        this.screenFlash = { 
            active: true, 
            intensity: 1.0, 
            duration: 300,
            timer: 0
        };
    }
    
    spawnBomb(x, y) {
        // 生成大雷道具
        this.powerUps.push(new PowerUp(x, y, 'bomb'));
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
    
    handleEnemyDrop(enemy) {
        // 根据敌人类型设置掉落概率和类型
        let dropChance = 0;
        let possibleDrops = [];
        let bulletDropChance = 0; // 子弹升级掉落几率
        
        switch (enemy.type) {
            case 'basic':
                dropChance = 0.1; // 10%
                possibleDrops = ['rapidFire', 'health'];
                bulletDropChance = 0.05; // 5%几率掉落子弹升级
                break;
            case 'fast':
                dropChance = 0.12; // 12%
                possibleDrops = ['rapidFire', 'multiShot'];
                bulletDropChance = 0.08; // 8%几率掉落子弹升级
                break;
            case 'heavy':
                dropChance = 0.25; // 25%
                possibleDrops = ['shield', 'health', 'multiShot'];
                bulletDropChance = 0.15; // 15%几率掉落子弹升级
                break;
            case 'shooter':
                dropChance = 0.2; // 20%
                possibleDrops = ['rapidFire', 'multiShot', 'shield'];
                bulletDropChance = 0.12; // 12%几率掉落子弹升级
                break;
            case 'sniper':
                dropChance = 0.18; // 18%
                possibleDrops = ['multiShot', 'shield'];
                bulletDropChance = 0.2; // 20%几率掉落子弹升级（狙击手更容易掉落高级子弹）
                break;
            case 'bomber':
                dropChance = 0.3; // 30%
                possibleDrops = ['shield', 'health', 'multiShot', 'rapidFire'];
                bulletDropChance = 0.25; // 25%几率掉落子弹升级
                break;
            case 'boss':
                dropChance = 1.0; // 100% 掉落多个道具
                possibleDrops = ['rapidFire', 'multiShot', 'shield', 'health'];
                bulletDropChance = 0.8; // 80%几率掉落子弹升级
                break;
            default:
                dropChance = 0.1;
                possibleDrops = ['health'];
                bulletDropChance = 0.03;
        }
        
        // 检查是否掉落常规道具
        if (Math.random() < dropChance) {
            if (enemy.type === 'boss') {
                // Boss掉落多个道具
                const dropCount = 2 + Math.floor(Math.random() * 2); // 2-3个道具
                for (let i = 0; i < dropCount; i++) {
                    const dropType = possibleDrops[Math.floor(Math.random() * possibleDrops.length)];
                    const offsetX = (Math.random() - 0.5) * 60; // 分散掉落
                    const offsetY = (Math.random() - 0.5) * 40;
                    this.spawnPowerUp(
                        enemy.x + offsetX, 
                        enemy.y + offsetY, 
                        dropType
                    );
                }
            } else {
                // 普通敌人掉落一个道具
                const dropType = possibleDrops[Math.floor(Math.random() * possibleDrops.length)];
                this.spawnPowerUp(enemy.x, enemy.y, dropType);
            }
        }
        
        // 检查是否掉落子弹升级道具
        if (Math.random() < bulletDropChance) {
            const bulletUpgrades = [
                'bullet_piercing',
                'bullet_explosive', 
                'bullet_laser',
                'bullet_plasma',
                'bullet_homing',
                'bullet_scatter',
                'bullet_upgrade'
            ];
            
            // 根据关卡调整可掉落的子弹类型
            let availableUpgrades = ['bullet_piercing', 'bullet_upgrade']; // 基础类型
            
            if (this.level >= 2) {
                availableUpgrades.push('bullet_explosive', 'bullet_scatter');
            }
            if (this.level >= 3) {
                availableUpgrades.push('bullet_laser', 'bullet_homing');
            }
            if (this.level >= 5) {
                availableUpgrades.push('bullet_plasma');
            }
            
            const bulletType = availableUpgrades[Math.floor(Math.random() * availableUpgrades.length)];
            
            // Boss有几率掉落多个子弹升级
            const bulletDropCount = enemy.type === 'boss' ? (Math.random() < 0.5 ? 2 : 1) : 1;
            
            for (let i = 0; i < bulletDropCount; i++) {
                const offsetX = bulletDropCount > 1 ? (Math.random() - 0.5) * 80 : 0;
                const offsetY = bulletDropCount > 1 ? (Math.random() - 0.5) * 40 : 20;
                this.spawnPowerUp(
                    enemy.x + offsetX,
                    enemy.y + offsetY,
                    bulletType
                );
            }
        }
        
        // 特殊掉落：关卡奖励
        if (enemy.type === 'boss') {
            // Boss额外掉落特殊奖励
            setTimeout(() => {
                this.spawnPowerUp(enemy.x, enemy.y - 30, 'health');
            }, 500);
        }
    }

    spawnPowerUp(x, y, type = null) {
        const types = ['rapidFire', 'multiShot', 'shield', 'health'];
        const selectedType = type || types[Math.floor(Math.random() * types.length)];
        this.powerUps.push(new PowerUp(x, y, selectedType));
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
        
        // 绘制玩家(支持双人模式)
        if (this.coopMode) {
            // 双人模式: 渲染所有玩家
            this.players.forEach(player => {
                if (player) {
                    player.render(this.ctx);
                }
            });
        } else {
            // 单人模式: 只渲染主玩家
            if (this.player) {
                this.player.render(this.ctx);
            }
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
        
        // 屏幕闪光效果
        if (this.screenFlash.active && this.screenFlash.intensity > 0) {
            this.ctx.save();
            this.ctx.fillStyle = `rgba(255, 255, 255, ${this.screenFlash.intensity * 0.6})`;
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.restore();
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
    constructor(x, y, playerId = 1) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 30;
        this.radius = 15;
        this.speed = 300;
        this.health = 3;
        this.maxHealth = 3;
        this.playerId = playerId; // 1 = 玩家1, 2 = 玩家2
        
        // 射击系统
        this.fireRate = 300; // 射击间隔(ms)
        this.lastFireTime = 0;
        this.bulletSpeed = 400;
        this.bulletDamage = 1;
        
        // 大雷系统时间控制
        this.bombCooldown = 500; // 大雷冷却时间500ms
        this.lastBombTime = 0;
        
        // 大雷系统
        this.bombs = 3; // 每个玩家初始有3个大雷
        this.maxBombs = 3;
        
        // 子弹升级系统
        this.bulletType = 'basic'; // 当前子弹类型
        this.bulletLevel = 1; // 子弹级别 (1-5)
        this.bulletUpgrades = { // 各类型子弹的级别
            'basic': 1,
            'piercing': 0,
            'explosive': 0,
            'laser': 0,
            'plasma': 0,
            'homing': 0,
            'scatter': 0
        };
        
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
        
        // 根据玩家ID确定控制方案
        if (this.playerId === 1) {
            // 玩家1: WASD键控制
            if (game.keys['a']) dx -= 1;
            if (game.keys['d']) dx += 1;
            if (game.keys['w']) dy -= 1;
            if (game.keys['s']) dy += 1;
        } else if (this.playerId === 2) {
            // 玩家2: 方向键控制
            if (game.keys['arrowleft']) dx -= 1;
            if (game.keys['arrowright']) dx += 1;
            if (game.keys['arrowup']) dy -= 1;
            if (game.keys['arrowdown']) dy += 1;
        }
        
        // 手柄输入 (优先级高于键盘)
        if (game.gamepad.connected) {
            if (this.playerId === 1) {
                // 玩家1: 左摇杆和方向键
                if (Math.abs(game.gamepad.axes.x) > 0.1 || Math.abs(game.gamepad.axes.y) > 0.1) {
                    dx = game.gamepad.axes.x;
                    dy = game.gamepad.axes.y;
                }
                
                // 方向键移动
                if (game.gamepad.buttons[12]) dy -= 1; // 上
                if (game.gamepad.buttons[13]) dy += 1; // 下
                if (game.gamepad.buttons[14]) dx -= 1; // 左
                if (game.gamepad.buttons[15]) dx += 1; // 右
            } else if (this.playerId === 2) {
                // 玩家2: 右摇杆 (如果可用)
                if (game.gamepad.axes && game.gamepad.axes.length >= 4) {
                    if (Math.abs(game.gamepad.axes[2]) > 0.1 || Math.abs(game.gamepad.axes[3]) > 0.1) {
                        dx = game.gamepad.axes[2];
                        dy = game.gamepad.axes[3];
                    }
                }
            }
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
        
        // 射击控制
        let shouldFire = false;
        if (this.playerId === 1) {
            // 玩家1: 空格键、鼠标或手柄射击键
            shouldFire = game.keys[' '] || game.keys['space'] || game.mouse.pressed;
            
            // 手柄射击 (X/Square, LT/RT按钮)
            if (game.gamepad.connected) {
                shouldFire = shouldFire || game.gamepad.buttons[2] || // X/Square
                           game.gamepad.buttons[6] || game.gamepad.buttons[7]; // LT/RT
            }
        } else if (this.playerId === 2) {
            // 玩家2: 回车键或手柄其他按钮
            shouldFire = game.keys['enter'] || game.keys['return'];
            
            // 手柄射击 (A/Cross, RB按钮)
            if (game.gamepad.connected) {
                shouldFire = shouldFire || game.gamepad.buttons[0] || // A/Cross
                           game.gamepad.buttons[5]; // RB/R1
            }
        }
        
        if (shouldFire) {
            this.fire(game);
        }
        
        // 大雷控制
        let shouldUseBomb = false;
        if (this.playerId === 1) {
            // 玩家1: Shift键或手柄特殊按钮
            shouldUseBomb = game.keys['shift'] || game.keys['shiftleft'] || game.keys['shiftright'];
            
            // 手柄大雷 (Y/Triangle按钮)
            if (game.gamepad.connected) {
                shouldUseBomb = shouldUseBomb || game.gamepad.buttons[3]; // Y/Triangle
            }
        } else if (this.playerId === 2) {
            // 玩家2: Ctrl键或手柄其他按钮
            shouldUseBomb = game.keys['control'] || game.keys['controlleft'] || game.keys['controlright'];
            
            // 手柄大雷 (LB按钮)
            if (game.gamepad.connected) {
                shouldUseBomb = shouldUseBomb || game.gamepad.buttons[4]; // LB/L1
            }
        }
        
        if (shouldUseBomb && this.bombs > 0) {
            this.useBomb(game);
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
        
        // 获取当前子弹属性
        const bulletOptions = {
            type: this.bulletType,
            level: this.bulletLevel,
            isPlayer: true
        };
        
        // 为追踪弹选择目标
        if (this.bulletType === 'homing' && game.enemies.length > 0) {
            let closestEnemy = null;
            let minDistance = Infinity;
            
            game.enemies.forEach(enemy => {
                const dx = enemy.x - this.x;
                const dy = enemy.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestEnemy = enemy;
                }
            });
            
            bulletOptions.target = closestEnemy;
        }
        
        // 多重射击或特殊射击模式
        if (this.powerUps.multiShot > 0 || this.bulletType === 'scatter') {
            this.fireMultipleBullets(game, bulletOptions);
        } else {
            this.fireSingleBullet(game, bulletOptions);
        }
    }
    
    fireSingleBullet(game, options) {
        game.bullets.push(new Bullet(
            this.x,
            this.y - 20,
            0,
            -this.bulletSpeed,
            options
        ));
    }
    
    fireMultipleBullets(game, options) {
        let angles = [];
        
        if (this.bulletType === 'scatter') {
            // 散射弹的角度
            const count = 3 + this.bulletLevel;
            const spread = 0.8; // 扩散角度
            for (let i = 0; i < count; i++) {
                angles.push((i - (count - 1) / 2) * spread / count);
            }
        } else {
            // 普通多重射击
            angles = [-0.3, 0, 0.3];
        }
        
        angles.forEach(angle => {
            game.bullets.push(new Bullet(
                this.x + Math.sin(angle) * 20,
                this.y - 20,
                Math.sin(angle) * this.bulletSpeed,
                -this.bulletSpeed + Math.cos(angle) * 50,
                options
            ));
        });
    }
    
    useBomb(game) {
        const currentTime = Date.now();
        
        // 检查大雷冷却时间
        if (currentTime - this.lastBombTime < this.bombCooldown) return;
        
        if (this.bombs <= 0) return;
        
        this.bombs--;
        this.lastBombTime = currentTime; // 记录使用时间
        game.activateBomb(this);
        game.updateHUD(); // 更新显示
    }
    
    updatePowerUps(deltaTime) {
        // 增强效果现在持续到被击中为止，不再基于时间递减
        // 这里可以添加一些视觉效果更新，但不改变效果状态
    }
    
    applyPowerUp(type) {
        switch (type) {
            case 'rapidFire':
                this.powerUps.rapidFire = 1; // 设为1表示激活，不再使用时间
                break;
            case 'multiShot':
                this.powerUps.multiShot = 1; // 设为1表示激活，不再使用时间
                break;
            case 'shield':
                this.powerUps.shield = 1; // 护盾激活
                this.makeInvulnerable(2000); // 短暂无敌帮助适应
                break;
            case 'health':
                if (this.health < this.maxHealth) {
                    this.health++;
                }
                break;
            case 'bomb':
                if (this.bombs < this.maxBombs) {
                    this.bombs++;
                }
                break;
                
            // 子弹升级道具
            case 'bullet_piercing':
                this.upgradeBulletType('piercing');
                break;
            case 'bullet_explosive':
                this.upgradeBulletType('explosive');
                break;
            case 'bullet_laser':
                this.upgradeBulletType('laser');
                break;
            case 'bullet_plasma':
                this.upgradeBulletType('plasma');
                break;
            case 'bullet_homing':
                this.upgradeBulletType('homing');
                break;
            case 'bullet_scatter':
                this.upgradeBulletType('scatter');
                break;
            case 'bullet_upgrade':
                this.upgradeBulletLevel();
                break;
        }
    }
    
    upgradeBulletType(newType) {
        // 解锁或升级指定子弹类型
        if (this.bulletUpgrades[newType] === 0) {
            // 新解锁的子弹类型
            this.bulletUpgrades[newType] = 1;
            this.bulletType = newType;
            this.bulletLevel = 1;
        } else if (this.bulletUpgrades[newType] < 5) {
            // 升级现有子弹类型
            this.bulletUpgrades[newType]++;
            if (this.bulletType === newType) {
                this.bulletLevel = this.bulletUpgrades[newType];
            }
        }
        
        // 如果当前使用的不是这种子弹，切换到新子弹
        if (this.bulletType !== newType) {
            this.bulletType = newType;
            this.bulletLevel = this.bulletUpgrades[newType];
        }
    }
    
    upgradeBulletLevel() {
        // 升级当前子弹类型的级别
        if (this.bulletUpgrades[this.bulletType] < 5) {
            this.bulletUpgrades[this.bulletType]++;
            this.bulletLevel = this.bulletUpgrades[this.bulletType];
        }
    }
    
    takeDamage(damage) {
        if (this.invulnerable) return;
        
        // 护盾可以抵挡一次攻击
        if (this.powerUps.shield > 0) {
            this.powerUps.shield = 0;
            this.makeInvulnerable(1000); // 破盾后短暂无敌
            return;
        }
        
        this.health -= damage;
        
        // 受伤时清除所有增强效果（除了生命恢复）
        this.powerUps.rapidFire = 0;
        this.powerUps.multiShot = 0;
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
        
        // 根据玩家ID设置颜色
        if (this.playerId === 1) {
            // 玩家1: 青色
            ctx.fillStyle = '#00ffff';
            ctx.strokeStyle = '#ffffff';
        } else if (this.playerId === 2) {
            // 玩家2: 紫色
            ctx.fillStyle = '#ff00ff';
            ctx.strokeStyle = '#ffffff';
        }
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
                this.firePattern = 'single';
                this.fireRate = 3000; // 3秒射击一次
                break;
                
            case 'fast':
                this.health = Math.floor(1 * levelMultiplier);
                this.maxHealth = this.health;
                this.speed = 150 * levelMultiplier;
                this.points = 150;
                this.color = '#ff0066';
                this.movePattern = 'zigzag';
                this.firePattern = 'single';
                this.fireRate = 2500; // 2.5秒射击一次
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
                    0, 200, 
                    { type: 'basic', level: 1, isPlayer: false }
                ));
                break;
                
            case 'spread':
                const angles = [-0.5, -0.25, 0, 0.25, 0.5];
                angles.forEach(angle => {
                    game.enemyBullets.push(new Bullet(
                        this.x, this.y + this.radius,
                        Math.sin(angle) * 150,
                        Math.cos(angle) * 150 + 100,
                        { type: 'scatter', level: 1, isPlayer: false }
                    ));
                });
                break;
                
            case 'aimed':
                // 选择最近的玩家作为目标
                let targetPlayer = null;
                let minDistance = Infinity;
                
                const playersToCheck = game.coopMode ? game.players : [game.player];
                playersToCheck.forEach(player => {
                    if (player) {
                        const dx = player.x - this.x;
                        const dy = player.y - this.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        if (distance < minDistance) {
                            minDistance = distance;
                            targetPlayer = player;
                        }
                    }
                });
                
                if (targetPlayer) {
                    const dx = targetPlayer.x - this.x;
                    const dy = targetPlayer.y - this.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const speed = 200;
                    
                    game.enemyBullets.push(new Bullet(
                        this.x, this.y + this.radius,
                        (dx / distance) * speed,
                        (dy / distance) * speed,
                        { type: 'homing', level: 1, isPlayer: false, target: targetPlayer }
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
                        { type: 'basic', level: 1, isPlayer: false }
                    ));
                }
                break;
                
            case 'boss':
                // Boss复杂弹幕模式 - 根据时间切换不同弹幕
                const timePhase = Math.floor(Date.now() / 3000) % 4; // 每3秒切换模式
                const subPhase = Math.floor((Date.now() % 3000) / 500); // 子阶段
                
                switch (timePhase) {
                    case 0: // 密集扫射
                        this.bossSpreadBarrage(game);
                        break;
                    case 1: // 旋转弹幕
                        this.bossRotatingBarrage(game);
                        break;
                    case 2: // 螺旋弹幕
                        this.bossSpiralBarrage(game);
                        break;
                    case 3: // 追踪弹幕
                        this.bossHomingBarrage(game);
                        break;
                }
                
                // 随机额外弹幕
                if (Math.random() < 0.3) {
                    this.bossRandomBurst(game);
                }
                break;
        }
    }
    
    takeDamage(damage) {
        this.health -= damage;
    }
    
    // Boss弹幕模式方法
    bossSpreadBarrage(game) {
        // 密集扫射弹幕
        const angleCount = 9;
        const baseAngle = -Math.PI * 0.4;
        const angleStep = (Math.PI * 0.8) / (angleCount - 1);
        
        for (let i = 0; i < angleCount; i++) {
            const angle = baseAngle + angleStep * i;
            const speed = 180 + Math.random() * 40;
            
            game.enemyBullets.push(new Bullet(
                this.x, this.y + this.radius,
                Math.sin(angle) * speed,
                Math.cos(angle) * speed,
                { type: 'explosive', level: 2, isPlayer: false }
            ));
        }
    }
    
    bossRotatingBarrage(game) {
        // 旋转弹幕
        const bulletCount = 16;
        const rotationSpeed = Date.now() * 0.002;
        
        for (let i = 0; i < bulletCount; i++) {
            const angle = (i * Math.PI * 2) / bulletCount + rotationSpeed;
            const speed = 120;
            
            game.enemyBullets.push(new Bullet(
                this.x, this.y + this.radius,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                { type: 'laser', level: 2, isPlayer: false }
            ));
        }
    }
    
    bossSpiralBarrage(game) {
        // 螺旋弹幕
        const spiralCount = 3;
        const bulletPerSpiral = 2;
        const rotationOffset = Date.now() * 0.003;
        
        for (let spiral = 0; spiral < spiralCount; spiral++) {
            for (let bullet = 0; bullet < bulletPerSpiral; bullet++) {
                const angle = (spiral * Math.PI * 2 / spiralCount) + 
                             (bullet * 0.3) + rotationOffset;
                const speed = 140 + bullet * 30;
                
                game.enemyBullets.push(new Bullet(
                    this.x, this.y + this.radius,
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed,
                    { type: 'plasma', level: 2, isPlayer: false }
                ));
            }
        }
    }
    
    bossHomingBarrage(game) {
        // 追踪弹幕 - 瞄准最近的玩家
        let targetPlayer = null;
        let minDistance = Infinity;
        
        const playersToCheck = game.coopMode ? game.players : [game.player];
        playersToCheck.forEach(player => {
            if (player) {
                const dx = player.x - this.x;
                const dy = player.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < minDistance) {
                    minDistance = distance;
                    targetPlayer = player;
                }
            }
        });
        
        if (targetPlayer) {
            const bulletCount = 5;
            for (let i = 0; i < bulletCount; i++) {
                const dx = targetPlayer.x - this.x;
                const dy = targetPlayer.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const spread = (i - 2) * 0.15; // -0.3 到 0.3 的扩散
                const speed = 200;
                
                game.enemyBullets.push(new Bullet(
                    this.x, this.y + this.radius,
                    (dx / distance + spread) * speed,
                    (dy / distance) * speed,
                    { type: 'homing', level: 2, isPlayer: false, target: targetPlayer }
                ));
            }
        }
    }
    
    bossRandomBurst(game) {
        // 随机爆发弹幕
        const burstCount = 3 + Math.floor(Math.random() * 4); // 3-6发
        
        for (let i = 0; i < burstCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 100 + Math.random() * 80;
            
            game.enemyBullets.push(new Bullet(
                this.x + (Math.random() - 0.5) * this.radius,
                this.y + this.radius,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                { type: 'basic', level: 1, isPlayer: false }
            ));
        }
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
    constructor(x, y, vx, vy, options = {}) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        
        // 子弹类型和级别系统
        this.type = options.type || 'basic'; // 子弹类型
        this.level = options.level || 1; // 子弹级别 (1-5)
        this.isPlayerBullet = options.isPlayer || true; // 是否为玩家子弹
        
        // 基础属性
        this.damage = options.damage || this.calculateDamage();
        this.color = options.color || this.getTypeColor();
        this.radius = this.getTypeRadius();
        this.trail = [];
        this.maxTrailLength = this.getTrailLength();
        
        // 特殊效果
        this.penetration = this.getPenetration(); // 穿透力
        this.explosionRadius = this.getExplosionRadius(); // 爆炸半径
        this.homingTarget = options.target || null; // 追踪目标
        this.lifetime = this.getLifetime(); // 生存时间
        this.createdTime = Date.now();
    }
    
    calculateDamage() {
        const baseDamage = {
            'basic': 1,
            'piercing': 2,
            'explosive': 3,
            'laser': 2,
            'plasma': 4,
            'homing': 2,
            'scatter': 1
        };
        
        return (baseDamage[this.type] || 1) * this.level;
    }
    
    getTypeColor() {
        if (!this.isPlayerBullet) {
            // 敌人子弹颜色 - 偏红色系
            return {
                'basic': '#ff6600',
                'piercing': '#ff3300',
                'explosive': '#ff0000',
                'laser': '#ff4400',
                'plasma': '#ff0044',
                'homing': '#ff8800',
                'scatter': '#ff5500'
            }[this.type] || '#ff6600';
        }
        
        // 玩家子弹颜色 - 偏蓝绿色系，按级别变化
        const baseColors = {
            'basic': ['#00ffff', '#00ddff', '#00bbff', '#0099ff', '#0077ff'],
            'piercing': ['#00ff88', '#00ee77', '#00dd66', '#00cc55', '#00bb44'],
            'explosive': ['#ffaa00', '#ff9900', '#ff8800', '#ff7700', '#ff6600'],
            'laser': ['#ff00ff', '#ee00ee', '#dd00dd', '#cc00cc', '#bb00bb'],
            'plasma': ['#ffffff', '#eeeeee', '#dddddd', '#cccccc', '#bbbbbb'],
            'homing': ['#00aaff', '#0099ee', '#0088dd', '#0077cc', '#0066bb'],
            'scatter': ['#88ff00', '#77ee00', '#66dd00', '#55cc00', '#44bb00']
        };
        
        const colors = baseColors[this.type] || baseColors.basic;
        return colors[Math.min(this.level - 1, colors.length - 1)];
    }
    
    getTypeRadius() {
        const baseRadius = {
            'basic': 3,
            'piercing': 2,
            'explosive': 4,
            'laser': 1,
            'plasma': 5,
            'homing': 3,
            'scatter': 2
        };
        
        return (baseRadius[this.type] || 3) + Math.floor(this.level / 2);
    }
    
    getTrailLength() {
        return {
            'basic': 5,
            'piercing': 8,
            'explosive': 4,
            'laser': 10,
            'plasma': 6,
            'homing': 7,
            'scatter': 3
        }[this.type] || 5;
    }
    
    getPenetration() {
        return {
            'basic': 0,
            'piercing': this.level,
            'explosive': 0,
            'laser': Math.floor(this.level / 2),
            'plasma': 1,
            'homing': 0,
            'scatter': 0
        }[this.type] || 0;
    }
    
    getExplosionRadius() {
        return {
            'basic': 0,
            'piercing': 0,
            'explosive': 20 + this.level * 5,
            'laser': 0,
            'plasma': 15 + this.level * 3,
            'homing': 10 + this.level * 2,
            'scatter': 0
        }[this.type] || 0;
    }
    
    getLifetime() {
        return {
            'basic': 3000,
            'piercing': 4000,
            'explosive': 2500,
            'laser': 1500,
            'plasma': 3500,
            'homing': 5000,
            'scatter': 2000
        }[this.type] || 3000;
    }
    
    update(deltaTime) {
        // 检查生存时间
        if (Date.now() - this.createdTime > this.lifetime) {
            this.shouldRemove = true;
            return;
        }
        
        // 记录轨迹
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > this.maxTrailLength) {
            this.trail.shift();
        }
        
        // 特殊行为更新
        this.updateSpecialBehavior(deltaTime);
        
        // 移动
        const dt = deltaTime * 0.001;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }
    
    updateSpecialBehavior(deltaTime) {
        const dt = deltaTime * 0.001;
        
        switch (this.type) {
            case 'homing':
                this.updateHoming(dt);
                break;
            case 'laser':
                this.updateLaser(dt);
                break;
            case 'plasma':
                this.updatePlasma(dt);
                break;
            case 'scatter':
                this.updateScatter(dt);
                break;
        }
    }
    
    updateHoming(dt) {
        // 追踪逻辑 - 如果有目标则调整方向
        if (this.homingTarget && this.homingTarget.health > 0) {
            const dx = this.homingTarget.x - this.x;
            const dy = this.homingTarget.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
                const turnSpeed = 200 * this.level; // 转向速度
                const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
                
                const targetVx = (dx / distance) * currentSpeed;
                const targetVy = (dy / distance) * currentSpeed;
                
                this.vx += (targetVx - this.vx) * turnSpeed * dt * 0.001;
                this.vy += (targetVy - this.vy) * turnSpeed * dt * 0.001;
            }
        }
    }
    
    updateLaser(dt) {
        // 激光效果 - 速度逐渐加快
        const speedIncrease = 50 * this.level * dt;
        const magnitude = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        
        if (magnitude > 0) {
            const newMagnitude = magnitude + speedIncrease;
            this.vx = (this.vx / magnitude) * newMagnitude;
            this.vy = (this.vy / magnitude) * newMagnitude;
        }
    }
    
    updatePlasma(dt) {
        // 等离子效果 - 轻微摆动
        const time = (Date.now() - this.createdTime) * 0.005;
        const wobbleStrength = 20 * this.level;
        
        this.x += Math.sin(time) * wobbleStrength * dt;
    }
    
    updateScatter(dt) {
        // 散射效果 - 随机偏移
        if (Math.random() < 0.1) {
            const randomOffset = (Math.random() - 0.5) * 100 * this.level;
            this.vx += randomOffset * dt;
            this.vy += randomOffset * dt;
        }
    }
    
    render(ctx) {
        ctx.save();
        
        // 绘制轨迹
        if (this.trail.length > 1) {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = Math.max(1, this.radius - 1);
            ctx.globalAlpha = 0.3;
            
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let i = 1; i < this.trail.length; i++) {
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }
            ctx.stroke();
        }
        
        // 绘制特殊类型效果
        this.renderSpecialEffects(ctx);
        
        // 绘制子弹本体
        ctx.globalAlpha = 1;
        ctx.fillStyle = this.color;
        
        // 根据类型调整形状
        switch (this.type) {
            case 'basic':
                this.renderBasic(ctx);
                break;
            case 'piercing':
                this.renderPiercing(ctx);
                break;
            case 'explosive':
                this.renderExplosive(ctx);
                break;
            case 'laser':
                this.renderLaser(ctx);
                break;
            case 'plasma':
                this.renderPlasma(ctx);
                break;
            case 'homing':
                this.renderHoming(ctx);
                break;
            case 'scatter':
                this.renderScatter(ctx);
                break;
            default:
                this.renderBasic(ctx);
        }
        
        ctx.restore();
    }
    
    renderSpecialEffects(ctx) {
        // 发光效果
        const glowIntensity = 10 + this.level * 2;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = glowIntensity;
        
        // 爆炸类子弹的额外光晕
        if (this.type === 'explosive' || this.type === 'plasma') {
            ctx.globalAlpha = 0.2;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius * 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }
    
    renderBasic(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
    
    renderPiercing(ctx) {
        // 尖锐的箭头形状
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.radius * 1.5);
        ctx.lineTo(this.x - this.radius, this.y + this.radius);
        ctx.lineTo(this.x, this.y + this.radius * 0.5);
        ctx.lineTo(this.x + this.radius, this.y + this.radius);
        ctx.closePath();
        ctx.fill();
    }
    
    renderExplosive(ctx) {
        // 菱形爆炸弹
        const size = this.radius;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - size);
        ctx.lineTo(this.x + size, this.y);
        ctx.lineTo(this.x, this.y + size);
        ctx.lineTo(this.x - size, this.y);
        ctx.closePath();
        ctx.fill();
        
        // 内部十字
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.x - size * 0.5, this.y);
        ctx.lineTo(this.x + size * 0.5, this.y);
        ctx.moveTo(this.x, this.y - size * 0.5);
        ctx.lineTo(this.x, this.y + size * 0.5);
        ctx.stroke();
    }
    
    renderLaser(ctx) {
        // 长条形激光
        const width = this.radius * 0.5;
        const length = this.radius * 3;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.atan2(this.vy, this.vx));
        
        ctx.fillRect(-length/2, -width/2, length, width);
        
        ctx.restore();
    }
    
    renderPlasma(ctx) {
        // 波动的等离子球
        const time = (Date.now() - this.createdTime) * 0.01;
        const pulseRadius = this.radius + Math.sin(time) * 2;
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, pulseRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // 内核
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
    }
    
    renderHoming(ctx) {
        // 带尾迹的追踪弹
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // 方向指示器
        if (this.homingTarget) {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2;
            const dx = this.homingTarget.x - this.x;
            const dy = this.homingTarget.y - this.y;
            const angle = Math.atan2(dy, dx);
            
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + Math.cos(angle) * this.radius * 1.5, 
                      this.y + Math.sin(angle) * this.radius * 1.5);
            ctx.stroke();
        }
    }
    
    renderScatter(ctx) {
        // 不规则散射弹
        const time = (Date.now() - this.createdTime) * 0.02;
        const sides = 6 + this.level;
        
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
            const angle = (i / sides) * Math.PI * 2 + time;
            const radius = this.radius + Math.sin(angle * 3) * 1;
            const x = this.x + Math.cos(angle) * radius;
            const y = this.y + Math.sin(angle) * radius;
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
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
            'health': '#ff0066',
            'bomb': '#ffff00', // 大雷金黄色
            // 子弹升级道具
            'bullet_piercing': '#00ff88',
            'bullet_explosive': '#ffaa00', 
            'bullet_laser': '#ff00ff',
            'bullet_plasma': '#ffffff',
            'bullet_homing': '#00aaff',
            'bullet_scatter': '#88ff00',
            'bullet_upgrade': '#ffff88' // 通用升级
        };
        
        this.color = this.colors[type] || '#ffff00';
        
        // 大雷特殊属性
        if (type === 'bomb') {
            this.radius = 20; // 大雷更大
            this.pulseTimer = Math.random() * Math.PI * 2; // 随机起始脉冲
        }
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
                
            case 'bomb':
                // 大雷特殊图标 - 炸弹形状
                // 更强的发光效果
                ctx.shadowBlur = 25;
                ctx.shadowColor = '#ffff00';
                
                // 炸弹主体
                ctx.beginPath();
                ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                
                // 导火线
                ctx.strokeStyle = '#ff6600';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(0, -size * 0.6);
                ctx.lineTo(-size * 0.2, -size * 0.9);
                ctx.stroke();
                
                // 火花效果
                const sparkCount = 3;
                for (let i = 0; i < sparkCount; i++) {
                    const angle = Date.now() * 0.02 + i * Math.PI * 2 / sparkCount;
                    const sparkSize = 2 + Math.sin(Date.now() * 0.05 + i) * 1;
                    const sparkX = -size * 0.2 + Math.cos(angle) * 5;
                    const sparkY = -size * 0.9 + Math.sin(angle) * 5;
                    
                    ctx.fillStyle = '#ff8800';
                    ctx.beginPath();
                    ctx.arc(sparkX, sparkY, sparkSize, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
                
            // 子弹升级道具图标
            case 'bullet_piercing':
                // 穿透弹图标 - 尖锐箭头
                ctx.beginPath();
                ctx.moveTo(0, -size * 0.7);
                ctx.lineTo(-size * 0.4, size * 0.4);
                ctx.lineTo(0, size * 0.2);
                ctx.lineTo(size * 0.4, size * 0.4);
                ctx.closePath();
                break;
                
            case 'bullet_explosive':
                // 爆炸弹图标 - 菱形炸弹
                ctx.beginPath();
                ctx.moveTo(0, -size * 0.6);
                ctx.lineTo(size * 0.6, 0);
                ctx.lineTo(0, size * 0.6);
                ctx.lineTo(-size * 0.6, 0);
                ctx.closePath();
                // 内部十字
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(-size * 0.3, 0);
                ctx.lineTo(size * 0.3, 0);
                ctx.moveTo(0, -size * 0.3);
                ctx.lineTo(0, size * 0.3);
                break;
                
            case 'bullet_laser':
                // 激光弹图标 - 长条形
                ctx.fillRect(-size * 0.6, -size * 0.2, size * 1.2, size * 0.4);
                ctx.fillRect(-size * 0.2, -size * 0.4, size * 0.4, size * 0.8);
                break;
                
            case 'bullet_plasma':
                // 等离子弹图标 - 波动圆形
                const time = Date.now() * 0.01;
                for (let i = 0; i < 3; i++) {
                    const radius = size * (0.3 + i * 0.2) + Math.sin(time + i) * 3;
                    ctx.beginPath();
                    ctx.arc(0, 0, radius, 0, Math.PI * 2);
                    ctx.stroke();
                }
                break;
                
            case 'bullet_homing':
                // 追踪弹图标 - 带方向的圆形
                ctx.beginPath();
                ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
                ctx.fill();
                // 方向箭头
                ctx.beginPath();
                ctx.moveTo(size * 0.3, 0);
                ctx.lineTo(size * 0.7, -size * 0.2);
                ctx.lineTo(size * 0.7, size * 0.2);
                ctx.closePath();
                break;
                
            case 'bullet_scatter':
                // 散射弹图标 - 多角星形
                ctx.beginPath();
                for (let i = 0; i < 8; i++) {
                    const angle = (i * Math.PI) / 4;
                    const radius = i % 2 === 0 ? size * 0.6 : size * 0.3;
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                break;
                
            case 'bullet_upgrade':
                // 通用升级图标 - 向上箭头加星形
                ctx.beginPath();
                ctx.moveTo(0, -size * 0.6);
                ctx.lineTo(-size * 0.3, -size * 0.1);
                ctx.lineTo(-size * 0.1, -size * 0.1);
                ctx.lineTo(-size * 0.1, size * 0.4);
                ctx.lineTo(size * 0.1, size * 0.4);
                ctx.lineTo(size * 0.1, -size * 0.1);
                ctx.lineTo(size * 0.3, -size * 0.1);
                ctx.closePath();
                
                // 小星形
                ctx.fill();
                ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
                    const radius = size * 0.2;
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius + size * 0.6;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
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
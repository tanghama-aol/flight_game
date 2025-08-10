# 界面显示修复说明

## 问题描述
游戏中的开始界面、游戏界面和结束界面可能会叠加显示，而不是正确切换。

## 修复内容

### 1. CSS 修复
```css
.screen {
    display: none !important;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 10;
}

.screen.active {
    display: flex !important;
}
```

### 2. JavaScript 修复
```javascript
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
    }
}
```

### 3. 界面层级设置
- 开始界面 (startScreen): z-index: 20
- 游戏结束界面 (gameOverScreen): z-index: 20  
- 游戏HUD (gameHud): z-index: 15
- 其他UI元素: z-index: 10

### 4. 游戏状态切换
- **开始游戏**: `startGame()` → 显示 `gameHud`
- **游戏结束**: `gameOver()` → 显示 `gameOverScreen`
- **返回主菜单**: `showMainMenu()` → 显示 `startScreen`
- **暂停**: `togglePause()` → 不切换界面，只改变游戏状态

## 界面切换流程

```
开始界面 (startScreen) 
    ↓ [点击开始游戏]
游戏界面 (gameHud + Canvas)
    ↓ [生命值为0]
结束界面 (gameOverScreen)
    ↓ [点击返回主菜单]
开始界面 (startScreen)
```

## 调试功能
- 添加了控制台日志输出，显示界面切换状态
- 开发模式下显示当前游戏状态
- 创建了 `test_ui.html` 用于测试界面切换

## 测试方法
1. 打开 `index.html` 游戏
2. 观察开始时只显示开始界面
3. 点击"开始游戏"，应该只显示游戏画布和HUD
4. 游戏结束时，应该只显示结束界面
5. 点击"返回主菜单"，应该只显示开始界面

如果仍有问题，可以打开 `test_ui.html` 进行界面切换测试。
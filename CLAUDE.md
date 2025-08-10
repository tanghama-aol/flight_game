# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chinese sci-fi themed bullet hell flight game called "弹幕大战 - 星际穿越" (Bullet Hell - Interstellar). It's a complete single-page web application built with vanilla HTML5, CSS3, and JavaScript using Canvas API for 60fps gameplay.

## Running and Testing

**To run the game:**
```bash
# Simply open index.html in a web browser
# No build process or dependencies required
```

**Testing interface changes:**
- Use `test_ui.html` for testing UI screen transitions without gameplay
- Check browser console for debugging information
- Game includes performance metrics in development mode

## Architecture

### Core Game Engine (`game.js`)
- **Game Class**: Main game engine managing all systems
- **Player Class**: Player ship with movement, shooting, and powerup states
- **Enemy Class**: Different enemy types (basic, fast, heavy, shooter, sniper, bomber, boss)
- **Bullet Class**: Projectile system for both player and enemy bullets
- **PowerUp Class**: Item drops (rapid fire, multi-shot, shield, health)
- **Particle Class**: Visual effects for explosions and trails

### Key Systems
- **Gamepad Support**: Full Xbox/PlayStation controller support with vibration
- **Audio System**: Web Audio API for procedurally generated sound effects
- **State Management**: Game states (start, playing, paused, gameOver)
- **Performance**: Object pooling, 60fps target with performance monitoring
- **Responsive Design**: Canvas auto-scaling for different screen sizes

### Game Flow
```
Start Screen → Game Canvas (HUD overlay) → Game Over Screen → Start Screen
```

### UI Screen Management
The game uses a screen system with proper state management:
- Screens are hidden/shown using CSS classes and JavaScript
- Only one screen should be visible at a time
- Screen switching is handled by `showScreen()` method

## Known Issues & Requirements

### Current Bugs (from `req_and_bug.md`)
1. Start screen menu and instructions overlap - need to move instructions right
2. Gamepad display area overlaps with score area during gameplay
3. Mouse cursor invisible on start and end screens

### Planned Features
1. Two-player cooperative mode with dual player ships
2. Enemy drop system with various bullet enhancements and health bonuses
3. Enhanced enemy AI with bullet patterns, boss bullet hell patterns

### Interface Fixes
- Refer to `INTERFACE_FIX.md` for detailed screen transition debugging
- Use CSS classes with `!important` for proper screen visibility control
- Ensure proper z-index layering for UI elements

## Development Notes

- **Language**: All UI text and comments are in Chinese
- **Browser Compatibility**: Requires modern browser with Canvas, Gamepad API, and Web Audio support
- **No External Dependencies**: Pure vanilla JavaScript implementation
- **Local Storage**: Used for leaderboard and gamepad settings persistence

## File Structure

- `index.html` - Main game file with embedded CSS and UI structure
- `game.js` - Complete game engine and all game classes
- `test_ui.html` - UI testing interface for debugging screen transitions
- `README.md` - Comprehensive game documentation in Chinese


## 开发规则
1. 语言：所有文本和注释都使用中文。
2. 需要记录所有修改的索引到文件work_log.md,方便后续修改查找
3. req_and_bug.md 存放所有需求和bug,按条逐步完成,完成后移动done.list.md中整理
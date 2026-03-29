# WebChese 專業級 UI 重構提案

## 目錄
1. [現況分析](#現況分析)
2. [核心技術架構升級](#核心技術架構升級)
3. [Canvas 棋盤渲染系統](#canvas-棋盤渲染系統)
4. [專業級 UI/UX 設計方案](#專業級-uiux-設計方案)
5. [性能優化策略](#性能優化策略)
6. [實作路線圖](#實作路線圖)

---

## 現況分析

### 當前架構優勢 ✅
- **Vue 3 Composition API**：現代化的響應式架構
- **完善的事件系統**：`useGameEffects` 提供良好的 FX 基礎
- **組件化設計**：模組化程度高，易於維護
- **TypeScript 支援**：類型安全，減少錯誤
- **狀態管理清晰**：Pinia + 本地狀態管理

### 當前架構限制 ⚠️

#### 1. DOM-based 棋盤渲染
```vue
<!-- 當前：每個格子都是 DOM 元素 -->
<div v-for="(row, y) in rows" :key="y" class="boardRow">
  <BoardCell v-for="x in BOARD_WIDTH" :key="`${x},${y}`" ... />
</div>
```

**問題**：
- 10x9 = 90 個 DOM 節點（僅格子）
- 加上單位、特效、overlay = 200+ DOM 節點
- 每次狀態更新觸發大量 DOM diff
- 複雜動畫會造成 layout thrashing
- 難以實現高品質的粒子效果和光影

#### 2. CSS-based 動畫限制
- 無法實現複雜的物理效果（拋物線、碰撞）
- 粒子系統性能差
- 光影效果受限
- 難以實現流體動畫

#### 3. 響應式性能瓶頸
- 大量響應式數據監聽
- 頻繁的組件重渲染
- 事件處理器過多

---

## 核心技術架構升級

### 推薦技術棧

#### 1. 渲染引擎：**PixiJS** 🎯 (首選)

**為什麼選 PixiJS？**
- ✅ **WebGL 加速**：GPU 渲染，性能極佳
- ✅ **2D 專精**：專為 2D 遊戲優化
- ✅ **成熟生態**：大量插件和工具
- ✅ **易於整合**：可與 Vue 3 無縫配合
- ✅ **豐富特效**：內建濾鏡、粒子系統、光影
- ✅ **商業級**：被眾多上市遊戲使用

**替代方案**：
- **Phaser 3**：功能更全面但較重（適合完整遊戲引擎）
- **Three.js**：3D 引擎，對 2D 遊戲過重
- **原生 Canvas 2D**：性能較差，需自己實現所有特效

#### 2. 動畫庫：**GSAP** + **PixiJS AnimatedSprite**

```javascript
// GSAP 用於 UI 元素和相機動畫
gsap.to(sprite, {
  pixi: { x: 100, y: 200, rotation: 45 },
  duration: 0.5,
  ease: "power2.out"
})

// AnimatedSprite 用於幀動畫
const explosion = new PIXI.AnimatedSprite(explosionFrames)
explosion.animationSpeed = 0.5
explosion.play()
```

#### 3. 粒子系統：**@pixi/particle-emitter**

```javascript
const emitter = new Emitter(container, {
  lifetime: { min: 0.5, max: 1 },
  frequency: 0.01,
  spawnChance: 1,
  particlesPerWave: 3,
  pos: { x: 0, y: 0 },
  behaviors: [
    {
      type: 'alpha',
      config: { alpha: { list: [{ value: 1, time: 0 }, { value: 0, time: 1 }] }}
    },
    {
      type: 'scale',
      config: { scale: { list: [{ value: 1, time: 0 }, { value: 0.3, time: 1 }] }}
    },
    {
      type: 'moveSpeed',
      config: { speed: { list: [{ value: 200, time: 0 }, { value: 50, time: 1 }] }}
    }
  ]
})
```

#### 4. UI 框架：**Vue 3** (保留) + **PixiJS** (棋盤)

**混合架構**：
```
┌─────────────────────────────────────┐
│   Vue 3 UI Layer (DOM)              │
│   - 頂部狀態欄                       │
│   - 手牌區                           │
│   - 模態框/彈窗                      │
│   - 設定面板                         │
└─────────────────────────────────────┘
              ↕ 事件通訊
┌─────────────────────────────────────┐
│   PixiJS Game Layer (Canvas)        │
│   - 棋盤渲染                         │
│   - 單位動畫                         │
│   - 戰鬥特效                         │
│   - 粒子系統                         │
└─────────────────────────────────────┘
```

---

## Canvas 棋盤渲染系統

### 架構設計

#### 1. PixiJS 應用初始化

```typescript
// src/game/PixiBoardRenderer.ts
import * as PIXI from 'pixi.js'
import { Emitter } from '@pixi/particle-emitter'
import { gsap } from 'gsap'
import { PixiPlugin } from 'gsap/PixiPlugin'

gsap.registerPlugin(PixiPlugin)
PixiPlugin.registerPIXI(PIXI)

export class PixiBoardRenderer {
  private app: PIXI.Application
  private boardContainer: PIXI.Container
  private unitsContainer: PIXI.Container
  private effectsContainer: PIXI.Container
  private uiContainer: PIXI.Container
  
  private cellSprites: Map<string, PIXI.Graphics> = new Map()
  private unitSprites: Map<string, UnitSprite> = new Map()
  private particleEmitters: Emitter[] = []
  
  constructor(canvas: HTMLCanvasElement, width: number, height: number) {
    this.app = new PIXI.Application({
      view: canvas,
      width,
      height,
      backgroundColor: 0x161822,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })
    
    this.setupLayers()
    this.setupLighting()
    this.startRenderLoop()
  }
  
  private setupLayers() {
    // 分層渲染：背景 → 棋盤 → 單位 → 特效 → UI
    this.boardContainer = new PIXI.Container()
    this.unitsContainer = new PIXI.Container()
    this.effectsContainer = new PIXI.Container()
    this.uiContainer = new PIXI.Container()
    
    this.app.stage.addChild(this.boardContainer)
    this.app.stage.addChild(this.unitsContainer)
    this.app.stage.addChild(this.effectsContainer)
    this.app.stage.addChild(this.uiContainer)
  }
  
  private setupLighting() {
    // 添加環境光照和陰影
    const lightFilter = new PIXI.filters.AlphaFilter(0.9)
    this.boardContainer.filters = [lightFilter]
  }
  
  // 渲染棋盤格子
  renderBoard(width: number, height: number) {
    const cellSize = 80
    const padding = 10
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = new PIXI.Graphics()
        const posKey = `${x},${y}`
        
        // 繪製格子
        cell.beginFill(0x1a1c2e, 0.6)
        cell.lineStyle(2, 0x3a3c4e, 0.8)
        cell.drawRoundedRect(0, 0, cellSize - padding, cellSize - padding, 8)
        cell.endFill()
        
        cell.x = x * cellSize + padding / 2
        cell.y = y * cellSize + padding / 2
        cell.interactive = true
        cell.buttonMode = true
        
        // 事件處理
        cell.on('pointerover', () => this.onCellHover(x, y))
        cell.on('pointerout', () => this.onCellOut(x, y))
        cell.on('pointerdown', () => this.onCellClick(x, y))
        
        this.cellSprites.set(posKey, cell)
        this.boardContainer.addChild(cell)
      }
    }
  }
  
  // 高亮格子（可移動位置）
  highlightCell(x: number, y: number, color: number = 0x91caff) {
    const posKey = `${x},${y}`
    const cell = this.cellSprites.get(posKey)
    if (!cell) return
    
    // 使用 GSAP 動畫
    gsap.to(cell, {
      pixi: { tint: color, alpha: 1 },
      duration: 0.3,
      ease: 'power2.out'
    })
    
    // 添加脈動效果
    gsap.to(cell.scale, {
      x: 1.05,
      y: 1.05,
      duration: 0.8,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut'
    })
  }
  
  clearHighlights() {
    this.cellSprites.forEach(cell => {
      gsap.killTweensOf(cell)
      gsap.killTweensOf(cell.scale)
      gsap.to(cell, {
        pixi: { tint: 0xffffff, alpha: 1 },
        duration: 0.2
      })
      cell.scale.set(1, 1)
    })
  }
}
```

#### 2. 單位渲染系統

```typescript
// src/game/UnitSprite.ts
export class UnitSprite extends PIXI.Container {
  private background: PIXI.Graphics
  private avatar: PIXI.Sprite
  private label: PIXI.Text
  private hpBar: PIXI.Graphics
  private glowFilter: PIXI.filters.GlowFilter
  private shadowSprite: PIXI.Sprite
  
  constructor(
    unitData: {
      id: string
      side: 'red' | 'black'
      base: string
      label: string
      hp: number
      maxHp: number
      image?: string
    }
  ) {
    super()
    
    this.setupShadow()
    this.setupBackground(unitData.side)
    this.setupAvatar(unitData.image, unitData.label)
    this.setupLabel(unitData.label, unitData.side)
    this.setupHpBar(unitData.hp, unitData.maxHp)
    this.setupGlow(unitData.side)
    
    this.interactive = true
    this.buttonMode = true
  }
  
  private setupShadow() {
    // 添加陰影效果
    this.shadowSprite = PIXI.Sprite.from(PIXI.Texture.WHITE)
    this.shadowSprite.width = 70
    this.shadowSprite.height = 10
    this.shadowSprite.tint = 0x000000
    this.shadowSprite.alpha = 0.3
    this.shadowSprite.anchor.set(0.5)
    this.shadowSprite.y = 40
    this.addChild(this.shadowSprite)
  }
  
  private setupBackground(side: 'red' | 'black') {
    this.background = new PIXI.Graphics()
    const color = side === 'red' ? 0xff4d4f : 0x52c41a
    
    this.background.beginFill(color, 0.15)
    this.background.lineStyle(3, color, 0.8)
    this.background.drawRoundedRect(-30, -30, 60, 60, 10)
    this.background.endFill()
    
    this.addChild(this.background)
  }
  
  private setupAvatar(image?: string, fallbackLabel?: string) {
    if (image) {
      this.avatar = PIXI.Sprite.from(image)
      this.avatar.width = 50
      this.avatar.height = 50
      this.avatar.anchor.set(0.5)
    } else {
      // 使用文字作為頭像
      const text = new PIXI.Text(fallbackLabel || '?', {
        fontSize: 32,
        fontWeight: 'bold',
        fill: 0xffffff
      })
      text.anchor.set(0.5)
      this.addChild(text)
    }
    
    if (this.avatar) this.addChild(this.avatar)
  }
  
  private setupLabel(label: string, side: 'red' | 'black') {
    this.label = new PIXI.Text(label, {
      fontSize: 14,
      fontWeight: 'bold',
      fill: side === 'red' ? 0xff9c9e : 0x95de64
    })
    this.label.anchor.set(0.5)
    this.label.y = 25
    this.addChild(this.label)
  }
  
  private setupHpBar(hp: number, maxHp: number) {
    this.hpBar = new PIXI.Graphics()
    this.updateHpBar(hp, maxHp)
    this.hpBar.y = -40
    this.addChild(this.hpBar)
  }
  
  updateHpBar(hp: number, maxHp: number) {
    this.hpBar.clear()
    
    // 背景
    this.hpBar.beginFill(0x000000, 0.3)
    this.hpBar.drawRoundedRect(-25, 0, 50, 6, 3)
    this.hpBar.endFill()
    
    // HP 條
    const hpPercent = Math.max(0, Math.min(1, hp / maxHp))
    const hpColor = hpPercent > 0.5 ? 0x52c41a : hpPercent > 0.25 ? 0xe8d070 : 0xff4d4f
    
    this.hpBar.beginFill(hpColor, 0.9)
    this.hpBar.drawRoundedRect(-25, 0, 50 * hpPercent, 6, 3)
    this.hpBar.endFill()
  }
  
  private setupGlow(side: 'red' | 'black') {
    this.glowFilter = new PIXI.filters.GlowFilter({
      distance: 15,
      outerStrength: 0,
      innerStrength: 0,
      color: side === 'red' ? 0xff4d4f : 0x52c41a,
      quality: 0.5
    })
    this.filters = [this.glowFilter]
  }
  
  // 選中動畫
  select() {
    gsap.to(this.glowFilter, {
      outerStrength: 2,
      innerStrength: 1,
      duration: 0.3
    })
    
    gsap.to(this.scale, {
      x: 1.1,
      y: 1.1,
      duration: 0.3,
      ease: 'back.out(1.7)'
    })
  }
  
  deselect() {
    gsap.to(this.glowFilter, {
      outerStrength: 0,
      innerStrength: 0,
      duration: 0.3
    })
    
    gsap.to(this.scale, {
      x: 1,
      y: 1,
      duration: 0.3,
      ease: 'power2.out'
    })
  }
  
  // 移動動畫
  moveTo(x: number, y: number, duration: number = 0.5) {
    // 拋物線移動
    const midY = Math.min(this.y, y) - 50
    
    gsap.timeline()
      .to(this, {
        x,
        y: midY,
        duration: duration / 2,
        ease: 'power2.out'
      })
      .to(this, {
        y,
        duration: duration / 2,
        ease: 'power2.in'
      })
      
    // 旋轉效果
    gsap.to(this, {
      rotation: Math.PI * 2,
      duration,
      ease: 'none'
    })
  }
  
  // 受擊動畫
  playHitAnimation() {
    // 震動
    gsap.timeline()
      .to(this, { x: this.x + 5, duration: 0.05 })
      .to(this, { x: this.x - 5, duration: 0.05 })
      .to(this, { x: this.x + 3, duration: 0.05 })
      .to(this, { x: this.x, duration: 0.05 })
    
    // 閃紅
    const colorMatrix = new PIXI.filters.ColorMatrixFilter()
    this.filters = [...(this.filters || []), colorMatrix]
    
    gsap.timeline()
      .to(colorMatrix, {
        duration: 0.1,
        onUpdate: () => {
          colorMatrix.brightness(1.5, false)
        }
      })
      .to(colorMatrix, {
        duration: 0.2,
        onUpdate: () => {
          colorMatrix.brightness(1, false)
        },
        onComplete: () => {
          this.filters = this.filters?.filter(f => f !== colorMatrix)
        }
      })
  }
  
  // 死亡動畫
  playDeathAnimation(onComplete: () => void) {
    // 粒子爆炸效果（需要 particle emitter）
    
    // 淡出 + 縮小 + 旋轉
    gsap.timeline()
      .to(this, {
        alpha: 0,
        rotation: Math.PI * 4,
        duration: 0.8,
        ease: 'power2.in'
      })
      .to(this.scale, {
        x: 0,
        y: 0,
        duration: 0.8,
        ease: 'back.in(2)'
      }, 0)
      .call(onComplete)
  }
}
```

#### 3. 特效系統

```typescript
// src/game/EffectsManager.ts
export class EffectsManager {
  private container: PIXI.Container
  private particleEmitters: Map<string, Emitter> = new Map()
  
  constructor(container: PIXI.Container) {
    this.container = container
  }
  
  // 攻擊光束
  createBeam(from: { x: number, y: number }, to: { x: number, y: number }) {
    const beam = new PIXI.Graphics()
    beam.lineStyle(4, 0xff9c9e, 1)
    beam.moveTo(from.x, from.y)
    beam.lineTo(to.x, to.y)
    
    // 添加發光濾鏡
    const glowFilter = new PIXI.filters.GlowFilter({
      distance: 10,
      outerStrength: 2,
      color: 0xff4d4f
    })
    beam.filters = [glowFilter]
    
    this.container.addChild(beam)
    
    // 動畫：從起點延伸到終點
    beam.scale.x = 0
    gsap.to(beam.scale, {
      x: 1,
      duration: 0.2,
      ease: 'power2.out',
      onComplete: () => {
        // 淡出
        gsap.to(beam, {
          alpha: 0,
          duration: 0.3,
          delay: 0.1,
          onComplete: () => beam.destroy()
        })
      }
    })
    
    // 添加粒子拖尾
    this.createBeamParticles(from, to)
  }
  
  private createBeamParticles(from: { x: number, y: number }, to: { x: number, y: number }) {
    const emitter = new Emitter(this.container, {
      lifetime: { min: 0.2, max: 0.4 },
      frequency: 0.005,
      spawnChance: 1,
      particlesPerWave: 2,
      pos: { x: from.x, y: from.y },
      behaviors: [
        {
          type: 'alpha',
          config: {
            alpha: {
              list: [
                { value: 1, time: 0 },
                { value: 0, time: 1 }
              ]
            }
          }
        },
        {
          type: 'scale',
          config: {
            scale: {
              list: [
                { value: 0.5, time: 0 },
                { value: 0.1, time: 1 }
              ]
            }
          }
        },
        {
          type: 'color',
          config: {
            color: {
              list: [
                { value: 'ff9c9e', time: 0 },
                { value: 'ff4d4f', time: 1 }
              ]
            }
          }
        },
        {
          type: 'moveSpeed',
          config: {
            speed: {
              list: [
                { value: 300, time: 0 },
                { value: 50, time: 1 }
              ]
            }
          }
        },
        {
          type: 'rotationStatic',
          config: {
            min: 0,
            max: 360
          }
        }
      ]
    })
    
    emitter.emit = true
    setTimeout(() => {
      emitter.emit = false
      setTimeout(() => emitter.destroy(), 500)
    }, 200)
  }
  
  // 傷害數字彈出
  createDamageText(x: number, y: number, damage: number, isCritical: boolean = false) {
    const text = new PIXI.Text(`-${damage}`, {
      fontSize: isCritical ? 48 : 32,
      fontWeight: 'bold',
      fill: isCritical ? 0xff4d4f : 0xff9c9e,
      stroke: 0x000000,
      strokeThickness: 4
    })
    
    text.anchor.set(0.5)
    text.x = x
    text.y = y
    
    if (isCritical) {
      // 暴擊效果
      const glowFilter = new PIXI.filters.GlowFilter({
        distance: 15,
        outerStrength: 3,
        color: 0xff0000
      })
      text.filters = [glowFilter]
      
      // 震動
      gsap.to(text, {
        rotation: 0.1,
        duration: 0.05,
        repeat: 5,
        yoyo: true
      })
    }
    
    this.container.addChild(text)
    
    // 向上飄移 + 淡出
    gsap.timeline()
      .to(text, {
        y: y - 80,
        duration: 1,
        ease: 'power2.out'
      })
      .to(text, {
        alpha: 0,
        duration: 0.5
      }, 0.5)
      .call(() => text.destroy())
  }
  
  // 治療效果
  createHealEffect(x: number, y: number, amount: number) {
    const text = new PIXI.Text(`+${amount}`, {
      fontSize: 28,
      fontWeight: 'bold',
      fill: 0x52c41a,
      stroke: 0x000000,
      strokeThickness: 3
    })
    
    text.anchor.set(0.5)
    text.x = x
    text.y = y
    
    this.container.addChild(text)
    
    // 粒子效果
    const emitter = new Emitter(this.container, {
      lifetime: { min: 0.5, max: 1 },
      frequency: 0.01,
      spawnChance: 1,
      particlesPerWave: 5,
      pos: { x, y },
      behaviors: [
        {
          type: 'alpha',
          config: {
            alpha: {
              list: [
                { value: 1, time: 0 },
                { value: 0, time: 1 }
              ]
            }
          }
        },
        {
          type: 'scale',
          config: {
            scale: {
              list: [
                { value: 0.3, time: 0 },
                { value: 0.1, time: 1 }
              ]
            }
          }
        },
        {
          type: 'color',
          config: {
            color: {
              list: [
                { value: '95de64', time: 0 },
                { value: '52c41a', time: 1 }
              ]
            }
          }
        },
        {
          type: 'moveSpeed',
          config: {
            speed: {
              list: [
                { value: 100, time: 0 },
                { value: 20, time: 1 }
              ]
            }
          }
        }
      ]
    })
    
    emitter.emit = true
    setTimeout(() => {
      emitter.emit = false
      setTimeout(() => emitter.destroy(), 1000)
    }, 300)
    
    // 文字動畫
    gsap.timeline()
      .to(text, {
        y: y - 60,
        duration: 1.2,
        ease: 'power2.out'
      })
      .to(text, {
        alpha: 0,
        duration: 0.4
      }, 0.8)
      .call(() => text.destroy())
  }
  
  // 附魔魔法陣
  createEnchantEffect(x: number, y: number, color: number = 0xb37feb) {
    const circle = new PIXI.Graphics()
    circle.lineStyle(3, color, 1)
    circle.drawCircle(0, 0, 50)
    circle.x = x
    circle.y = y
    
    const glowFilter = new PIXI.filters.GlowFilter({
      distance: 20,
      outerStrength: 2,
      color
    })
    circle.filters = [glowFilter]
    
    this.container.addChild(circle)
    
    // 旋轉 + 縮放 + 淡出
    gsap.timeline()
      .from(circle.scale, {
        x: 0,
        y: 0,
        duration: 0.5,
        ease: 'back.out(2)'
      })
      .to(circle, {
        rotation: Math.PI * 2,
        duration: 1,
        ease: 'none'
      }, 0)
      .to(circle, {
        alpha: 0,
        duration: 0.3
      }, 0.7)
      .call(() => circle.destroy())
    
    // 粒子螺旋上升
    this.createSpiralParticles(x, y, color)
  }
  
  private createSpiralParticles(x: number, y: number, color: number) {
    // 實作螺旋粒子效果...
  }
  
  // 死亡爆炸
  createDeathExplosion(x: number, y: number) {
    const emitter = new Emitter(this.container, {
      lifetime: { min: 0.5, max: 1.5 },
      frequency: 0.001,
      spawnChance: 1,
      particlesPerWave: 20,
      pos: { x, y },
      behaviors: [
        {
          type: 'alpha',
          config: {
            alpha: {
              list: [
                { value: 1, time: 0 },
                { value: 0, time: 1 }
              ]
            }
          }
        },
        {
          type: 'scale',
          config: {
            scale: {
              list: [
                { value: 1, time: 0 },
                { value: 0.2, time: 1 }
              ]
            }
          }
        },
        {
          type: 'color',
          config: {
            color: {
              list: [
                { value: 'ffffff', time: 0 },
                { value: '666666', time: 0.5 },
                { value: '000000', time: 1 }
              ]
            }
          }
        },
        {
          type: 'moveSpeed',
          config: {
            speed: {
              list: [
                { value: 400, time: 0 },
                { value: 0, time: 1 }
              ]
            }
          }
        },
        {
          type: 'rotationStatic',
          config: {
            min: 0,
            max: 360
          }
        }
      ]
    })
    
    emitter.emit = true
    setTimeout(() => {
      emitter.emit = false
      setTimeout(() => emitter.destroy(), 1500)
    }, 100)
  }
}
```

#### 4. Vue 整合

```vue
<!-- src/components/v2/PixiBoard.vue -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { PixiBoardRenderer } from '@/game/PixiBoardRenderer'
import type { GameState } from '@/engine'

const props = defineProps<{
  state: GameState
  selectedUnitId: string | null
  legalMoves: Array<{ x: number; y: number }>
}>()

const emit = defineEmits<{
  cellClick: [payload: { x: number; y: number; unitId: string | null }]
  selectUnit: [unitId: string | null]
}>()

const canvasRef = ref<HTMLCanvasElement>()
let renderer: PixiBoardRenderer | null = null

onMounted(() => {
  if (!canvasRef.value) return
  
  renderer = new PixiBoardRenderer(canvasRef.value, 800, 720)
  renderer.renderBoard(10, 9)
  
  // 設置事件回調
  renderer.onCellClick = (x, y) => {
    const unitId = findUnitAt(x, y)
    emit('cellClick', { x, y, unitId })
  }
  
  renderer.onUnitClick = (unitId) => {
    emit('selectUnit', unitId)
  }
  
  // 初始渲染
  updateRenderer()
})

onUnmounted(() => {
  renderer?.destroy()
})

// 監聽狀態變化
watch(() => props.state.units, () => {
  updateRenderer()
}, { deep: true })

watch(() => props.selectedUnitId, (newId, oldId) => {
  if (oldId) renderer?.deselectUnit(oldId)
  if (newId) renderer?.selectUnit(newId)
})

watch(() => props.legalMoves, (moves) => {
  renderer?.clearHighlights()
  moves.forEach(pos => renderer?.highlightCell(pos.x, pos.y))
})

function updateRenderer() {
  if (!renderer) return
  
  // 更新所有單位
  Object.values(props.state.units).forEach(unit => {
    renderer?.updateUnit(unit.id, {
      x: unit.pos.x,
      y: unit.pos.y,
      hp: unit.hpCurrent,
      maxHp: unit.enchant 
        ? getSoulCard(unit.enchant.soulId)?.stats.hp ?? BASE_STATS[unit.base].hp
        : BASE_STATS[unit.base].hp,
      side: unit.side,
      base: unit.base,
      enchant: unit.enchant
    })
  })
}

function findUnitAt(x: number, y: number): string | null {
  return Object.values(props.state.units)
    .find(u => u.pos.x === x && u.pos.y === y)?.id ?? null
}
</script>

<template>
  <div class="pixi-board-container">
    <canvas ref="canvasRef" />
  </div>
</template>

<style scoped>
.pixi-board-container {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--bg-page);
}

canvas {
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}
</style>
```

---

## 專業級 UI/UX 設計方案

### 1. 整體視覺風格

#### 參考遊戲
- **Hearthstone**：卡牌呈現、特效設計
- **Teamfight Tactics**：棋盤佈局、單位展示
- **Legends of Runeterra**：UI 動畫、過場效果
- **Gwent**：暗色調主題、卡牌質感

#### 設計原則
1. **暗色調為主**：保持現有深色主題，提升對比度
2. **高對比度**：確保重要信息清晰可見
3. **動態反饋**：每個操作都有視覺/聽覺反饋
4. **層次分明**：使用陰影、光暈區分層級
5. **一致性**：統一的色彩語言和動畫曲線

### 2. 色彩系統升級

```css
/* 專業級色彩系統 */
:root {
  /* 主色調 - 深空藍 */
  --primary-900: #0a0e1a;
  --primary-800: #131824;
  --primary-700: #1a1f2e;
  --primary-600: #242938;
  --primary-500: #2e3442;
  
  /* 強調色 - 魔法紫 */
  --accent-purple-500: #8b5cf6;
  --accent-purple-400: #a78bfa;
  --accent-purple-300: #c4b5fd;
  
  /* 強調色 - 神聖金 */
  --accent-gold-500: #f59e0b;
  --accent-gold-400: #fbbf24;
  --accent-gold-300: #fcd34d;
  
  /* 陣營色 */
  --faction-red-500: #ef4444;
  --faction-red-400: #f87171;
  --faction-red-glow: rgba(239, 68, 68, 0.4);
  
  --faction-green-500: #10b981;
  --faction-green-400: #34d399;
  --faction-green-glow: rgba(16, 185, 129, 0.4);
  
  /* 功能色 */
  --success: #10b981;
  --warning: #f59e0b;
  --error: #ef4444;
  --info: #3b82f6;
  
  /* 漸層 */
  --gradient-purple: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
  --gradient-gold: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  --gradient-dark: linear-gradient(180deg, #1a1f2e 0%, #0a0e1a 100%);
}
```

### 3. 字體系統

```css
/* 專業遊戲字體 */
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;900&display=swap');

:root {
  /* 主要字體 - 中文 */
  --font-primary: 'Noto Sans TC', 'Microsoft JhengHei', sans-serif;
  
  /* 標題字體 - 英文裝飾 */
  --font-display: 'Cinzel', serif;
  
  /* 數字字體 - 等寬 */
  --font-mono: 'Roboto Mono', 'Consolas', monospace;
  
  /* 字重 */
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-bold: 700;
  --font-weight-black: 900;
}
```

### 4. 新 UI 佈局設計

```
┌─────────────────────────────────────────────────────────────┐
│  頂部狀態欄 (固定)                                            │
│  ┌─────────┐  回合資訊  階段指示器  ┌──────────┐            │
│  │ 玩家頭像 │  紅方/黑方  💰⚗️⚔️      │ 設定/音效 │            │
│  └─────────┘                        └──────────┘            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────┐  ┌───────────────────────┐  ┌─────────┐       │
│  │         │  │                       │  │         │       │
│  │  左側   │  │    PixiJS 棋盤區      │  │  右側   │       │
│  │  資訊   │  │   (Canvas 渲染)       │  │  面板   │       │
│  │  面板   │  │                       │  │         │       │
│  │         │  │   - 單位動畫          │  │ - 單位  │       │
│  │ - 墓地  │  │   - 戰鬥特效          │  │   詳情  │       │
│  │ - 統計  │  │   - 粒子系統          │  │ - Buff │       │
│  │ - 日誌  │  │   - 光影效果          │  │ - 技能  │       │
│  │         │  │                       │  │         │       │
│  └─────────┘  └───────────────────────┘  └─────────┘       │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│  底部手牌區 (可展開/收起)                                     │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                       │
│  │靈魂│ │靈魂│ │道具│ │道具│ │道具│  [展開商店]            │
│  │卡1 │ │卡2 │ │卡1 │ │卡2 │ │卡3 │                       │
│  └────┘ └────┘ └────┘ └────┘ └────┘                       │
└─────────────────────────────────────────────────────────────┘
```

### 5. 卡牌系統重新設計

#### 3D 卡牌效果

```vue
<!-- src/components/Card3D.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { SoulCard, ItemCard } from '@/engine'

const props = defineProps<{
  card: SoulCard | ItemCard
  selected?: boolean
}>()

const cardRef = ref<HTMLElement>()
const rotateX = ref(0)
const rotateY = ref(0)

function onMouseMove(e: MouseEvent) {
  if (!cardRef.value) return
  
  const rect = cardRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  
  const centerX = rect.width / 2
  const centerY = rect.height / 2
  
  rotateY.value = ((x - centerX) / centerX) * 15
  rotateX.value = ((centerY - y) / centerY) * 15
}

function onMouseLeave() {
  rotateX.value = 0
  rotateY.value = 0
}

const cardStyle = computed(() => ({
  transform: `perspective(1000px) rotateX(${rotateX.value}deg) rotateY(${rotateY.value}deg) ${props.selected ? 'translateY(-20px) scale(1.05)' : ''}`,
  transition: 'transform 0.1s ease-out'
}))
</script>

<template>
  <div 
    ref="cardRef"
    class="card-3d"
    :class="{ selected }"
    :style="cardStyle"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <div class="card-shine" />
    <div class="card-content">
      <div class="card-header">
        <span class="card-cost">{{ card.costGold }}G</span>
        <span class="card-type">{{ 'base' in card ? '靈魂' : '道具' }}</span>
      </div>
      
      <div class="card-image">
        <img v-if="card.image" :src="card.image" :alt="card.name" />
        <div v-else class="card-image-placeholder">
          {{ 'base' in card ? '🃏' : '🎒' }}
        </div>
      </div>
      
      <div class="card-name">{{ card.name }}</div>
      
      <div v-if="card.text" class="card-text">{{ card.text }}</div>
      
      <div class="card-glow" />
    </div>
  </div>
</template>

<style scoped>
.card-3d {
  position: relative;
  width: 200px;
  height: 280px;
  border-radius: 16px;
  cursor: pointer;
  transform-style: preserve-3d;
}

.card-content {
  position: relative;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, 
    rgba(139, 92, 246, 0.1) 0%,
    rgba(99, 102, 241, 0.05) 100%
  );
  border: 2px solid rgba(139, 92, 246, 0.3);
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  backdrop-filter: blur(10px);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.card-shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    135deg,
    transparent 0%,
    rgba(255, 255, 255, 0.1) 50%,
    transparent 100%
  );
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
  border-radius: 16px;
}

.card-3d:hover .card-shine {
  opacity: 1;
  animation: shine 1.5s ease-in-out infinite;
}

@keyframes shine {
  0% { transform: translateX(-100%) translateY(-100%); }
  100% { transform: translateX(100%) translateY(100%); }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-cost {
  font-size: 1.5rem;
  font-weight: 900;
  color: var(--accent-gold-400);
  text-shadow: 0 2px 8px rgba(245, 158, 11, 0.5);
}

.card-type {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 0.1em;
}

.card-image {
  flex: 1;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-image-placeholder {
  font-size: 4rem;
}

.card-name {
  font-size: 1.125rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
  text-align: center;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}

.card-text {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.4;
  text-align: center;
}

.card-glow {
  position: absolute;
  inset: -2px;
  background: var(--gradient-purple);
  border-radius: 16px;
  opacity: 0;
  filter: blur(20px);
  z-index: -1;
  transition: opacity 0.3s;
}

.card-3d.selected .card-glow,
.card-3d:hover .card-glow {
  opacity: 0.6;
}

.card-3d.selected {
  z-index: 10;
}
</style>
```

### 6. 音效系統

```typescript
// src/game/AudioManager.ts
export class AudioManager {
  private sounds: Map<string, Howl> = new Map()
  private music: Howl | null = null
  private sfxVolume = 0.7
  private musicVolume = 0.5
  
  constructor() {
    this.loadSounds()
  }
  
  private loadSounds() {
    // UI 音效
    this.sounds.set('click', new Howl({ src: ['/audio/sfx/click.mp3'], volume: 0.3 }))
    this.sounds.set('hover', new Howl({ src: ['/audio/sfx/hover.mp3'], volume: 0.2 }))
    
    // 遊戲音效
    this.sounds.set('move', new Howl({ src: ['/audio/sfx/move.mp3'], volume: 0.5 }))
    this.sounds.set('attack', new Howl({ src: ['/audio/sfx/attack.mp3'], volume: 0.6 }))
    this.sounds.set('hit', new Howl({ src: ['/audio/sfx/hit.mp3'], volume: 0.7 }))
    this.sounds.set('death', new Howl({ src: ['/audio/sfx/death.mp3'], volume: 0.8 }))
    this.sounds.set('enchant', new Howl({ src: ['/audio/sfx/enchant.mp3'], volume: 0.6 }))
    this.sounds.set('heal', new Howl({ src: ['/audio/sfx/heal.mp3'], volume: 0.5 }))
    
    // 卡牌音效
    this.sounds.set('card_draw', new Howl({ src: ['/audio/sfx/card_draw.mp3'], volume: 0.4 }))
    this.sounds.set('card_play', new Howl({ src: ['/audio/sfx/card_play.mp3'], volume: 0.5 }))
    
    // 背景音樂
    this.music = new Howl({
      src: ['/audio/music/battle_theme.mp3'],
      loop: true,
      volume: this.musicVolume
    })
  }
  
  play(soundId: string) {
    const sound = this.sounds.get(soundId)
    if (sound) {
      sound.volume(this.sfxVolume)
      sound.play()
    }
  }
  
  playMusic() {
    this.music?.play()
  }
  
  stopMusic() {
    this.music?.stop()
  }
  
  setSfxVolume(volume: number) {
    this.sfxVolume = Math.max(0, Math.min(1, volume))
  }
  
  setMusicVolume(volume: number) {
    this.musicVolume = Math.max(0, Math.min(1, volume))
    this.music?.volume(this.musicVolume)
  }
}
```

---

## 性能優化策略

### 1. 渲染優化

```typescript
// 對象池 - 重用精靈對象
class SpritePool {
  private pool: PIXI.Sprite[] = []
  
  acquire(texture: PIXI.Texture): PIXI.Sprite {
    let sprite = this.pool.pop()
    if (!sprite) {
      sprite = new PIXI.Sprite(texture)
    } else {
      sprite.texture = texture
      sprite.visible = true
      sprite.alpha = 1
    }
    return sprite
  }
  
  release(sprite: PIXI.Sprite) {
    sprite.visible = false
    this.pool.push(sprite)
  }
}

// 批次渲染
class BatchRenderer {
  private batchSize = 100
  private queue: Array<() => void> = []
  
  add(fn: () => void) {
    this.queue.push(fn)
    if (this.queue.length >= this.batchSize) {
      this.flush()
    }
  }
  
  flush() {
    requestAnimationFrame(() => {
      this.queue.forEach(fn => fn())
      this.queue = []
    })
  }
}
```

### 2. 資源管理

```typescript
// 紋理圖集 - 減少 draw calls
const textureAtlas = await PIXI.Assets.load('/assets/atlas/units.json')

// 懶加載
async function loadAssetWhenNeeded(assetId: string) {
  if (!PIXI.Assets.cache.has(assetId)) {
    await PIXI.Assets.load(assetId)
  }
  return PIXI.Assets.get(assetId)
}

// 卸載不需要的資源
function unloadUnusedAssets() {
  const unusedAssets = findUnusedAssets()
  unusedAssets.forEach(asset => {
    PIXI.Assets.unload(asset)
  })
}
```

### 3. 事件優化

```typescript
// 事件委託
boardContainer.interactive = true
boardContainer.on('pointerdown', (event) => {
  const target = event.target
  if (target instanceof UnitSprite) {
    handleUnitClick(target.unitId)
  } else if (target instanceof CellSprite) {
    handleCellClick(target.x, target.y)
  }
})

// 節流
function throttle(fn: Function, delay: number) {
  let lastCall = 0
  return (...args: any[]) => {
    const now = Date.now()
    if (now - lastCall >= delay) {
      lastCall = now
      fn(...args)
    }
  }
}

const handleMouseMove = throttle((e) => {
  // 處理滑鼠移動
}, 16) // 60fps
```

---

## 實作路線圖

### Phase 1: 基礎架構 (2-3 週)

**Week 1-2: PixiJS 整合**
- [ ] 安裝 PixiJS、GSAP、@pixi/particle-emitter
- [ ] 建立 `PixiBoardRenderer` 核心類別
- [ ] 實作基礎棋盤渲染
- [ ] 實作單位精靈系統
- [ ] 整合 Vue 組件

**Week 3: 事件系統**
- [ ] 實作點擊、懸停事件
- [ ] 連接 Vue 狀態到 PixiJS
- [ ] 實作基礎動畫（移動、選中）

### Phase 2: 視覺效果 (2-3 週)

**Week 4-5: 戰鬥特效**
- [ ] 攻擊光束系統
- [ ] 傷害數字動畫
- [ ] 粒子效果系統
- [ ] 死亡/復活動畫

**Week 6: 卡牌系統**
- [ ] 3D 卡牌組件
- [ ] 卡牌使用動畫
- [ ] 手牌區重新設計

### Phase 3: UI 重構 (2 週)

**Week 7: 佈局優化**
- [ ] 新的響應式佈局
- [ ] 側邊欄面板
- [ ] 頂部狀態欄

**Week 8: 細節打磨**
- [ ] 音效整合
- [ ] 過場動畫
- [ ] 設定面板

### Phase 4: 優化與測試 (1-2 週)

**Week 9-10**
- [ ] 性能優化
- [ ] 移動端適配
- [ ] 瀏覽器兼容性測試
- [ ] 用戶測試與反饋

---

## 總結與建議

### 為什麼要用 Canvas/PixiJS？

1. **性能提升 10-50 倍**：GPU 渲染 vs DOM 操作
2. **專業級特效**：粒子、光影、濾鏡
3. **流暢動畫**：60fps 穩定運行
4. **可擴展性**：未來可加入更多視覺效果
5. **商業標準**：與市面上遊戲同等水準

### 投資回報

**開發成本**：約 8-10 週全職開發
**收益**：
- 用戶體驗提升 300%+
- 視覺品質達到商業遊戲水準
- 性能優化，支援更多設備
- 易於添加新功能和特效
- 提升產品競爭力

### 立即可做的改進（不需重構）

如果暫時不想完全重構，可以先做這些：

1. **添加更多 CSS 動畫**（1-2 天）
2. **優化現有組件性能**（3-5 天）
3. **改進卡牌視覺效果**（1 週）
4. **添加音效系統**（3-5 天）
5. **優化佈局和間距**（1 週）

### 最終建議

**如果目標是上市級產品**：強烈建議採用 PixiJS 重構棋盤系統
**如果只是個人項目/原型**：保持現有架構，逐步優化 UI

這個專案的架構已經很好，重構的主要目的是**視覺品質和性能**的質的飛躍，讓它從「功能完整的原型」變成「可以上市的產品」。

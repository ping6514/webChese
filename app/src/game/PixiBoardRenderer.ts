import * as PIXI from 'pixi.js'
import { gsap } from 'gsap'
import { UnitSprite, type UnitSpriteData } from './UnitSprite'
import { CorpseSprite, type CorpseData } from './CorpseSprite'
import { EffectsManager } from './EffectsManager'
import type { GameState } from '../engine'
import { BOARD_WIDTH, BOARD_HEIGHT } from '../engine'
import { getMaxHpForUnitInState } from '../engine/stats'
import { getSoulCard } from '../engine/cards'

export interface BoardConfig {
  cellSize: number
  padding: number
  boardOffsetX: number
  boardOffsetY: number
}

export class PixiBoardRenderer {
  private app: PIXI.Application
  private boardContainer: PIXI.Container
  private unitsContainer: PIXI.Container
  private corpsesContainer: PIXI.Container
  private effectsContainer: PIXI.Container
  private highlightContainer: PIXI.Container
  
  private cellSprites: Map<string, PIXI.Graphics> = new Map()
  private unitSprites: Map<string, UnitSprite> = new Map()
  private corpseSprites: Map<string, CorpseSprite> = new Map()
  private highlightSprites: Map<string, PIXI.Graphics> = new Map()
  
  public effectsManager: EffectsManager
  
  private config: BoardConfig = {
    cellSize: 70,
    padding: 2,
    boardOffsetX: 10,
    boardOffsetY: 20
  }
  
  public onCellClick?: (x: number, y: number) => void
  public onUnitClick?: (unitId: string) => void
  public onCellHover?: (x: number, y: number) => void
  public onCellOut?: (x: number, y: number) => void
  public onUnitHover?: (unitId: string, x: number, y: number) => void
  public onUnitHoverOut?: () => void
  
  constructor(canvas: HTMLCanvasElement, width: number, height: number) {
    this.app = new PIXI.Application()
    
    this.app.init({
      canvas,
      width,
      height,
      backgroundColor: 0x161822,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    }).then(() => {
      this.setupLayers()
      this.renderBoard()
      this.startRenderLoop()
    })
    
    this.boardContainer = new PIXI.Container()
    this.highlightContainer = new PIXI.Container()
    this.unitsContainer = new PIXI.Container()
    this.corpsesContainer = new PIXI.Container()
    this.effectsContainer = new PIXI.Container()
    this.effectsManager = new EffectsManager(this.effectsContainer)
  }
  
  private setupLayers() {
    this.app.stage.addChild(this.boardContainer)
    this.app.stage.addChild(this.highlightContainer)
    this.app.stage.addChild(this.corpsesContainer)
    this.app.stage.addChild(this.unitsContainer)
    this.app.stage.addChild(this.effectsContainer)
  }
  
  private renderBoard() {
    const { cellSize, padding, boardOffsetX, boardOffsetY } = this.config
    
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        const cell = new PIXI.Graphics()
        const posKey = `${x},${y}`
        
        const cellX = x * cellSize + boardOffsetX
        const cellY = y * cellSize + boardOffsetY
        
        cell.roundRect(0, 0, cellSize - padding * 2, cellSize - padding * 2, 8)
        cell.fill({ color: 0x1a1c2e, alpha: 0.6 })
        cell.stroke({ width: 2, color: 0x3a3c4e, alpha: 0.8 })
        
        // Add palace area markings (九宮格)
        const isPalace = (x >= 3 && x <= 5) && ((y >= 0 && y <= 2) || (y >= 7 && y <= 9))
        if (isPalace) {
          const palaceColor = 0xffffff
          const palaceAlpha = 0.42
          const palaceWidth = 3
          
          // North border
          if (y === 0 || y === 7) {
            cell.moveTo(0, 0)
            cell.lineTo(cellSize - padding * 2, 0)
            cell.stroke({ width: palaceWidth, color: palaceColor, alpha: palaceAlpha })
          }
          // South border
          if (y === 2 || y === 9) {
            cell.moveTo(0, cellSize - padding * 2)
            cell.lineTo(cellSize - padding * 2, cellSize - padding * 2)
            cell.stroke({ width: palaceWidth, color: palaceColor, alpha: palaceAlpha })
          }
          // West border
          if (x === 3) {
            cell.moveTo(0, 0)
            cell.lineTo(0, cellSize - padding * 2)
            cell.stroke({ width: palaceWidth, color: palaceColor, alpha: palaceAlpha })
          }
          // East border
          if (x === 5) {
            cell.moveTo(cellSize - padding * 2, 0)
            cell.lineTo(cellSize - padding * 2, cellSize - padding * 2)
            cell.stroke({ width: palaceWidth, color: palaceColor, alpha: palaceAlpha })
          }
        }
        
        // Add river boundary (楚河漢界)
        if (y === 4) {
          // North side of river
          cell.moveTo(0, cellSize - padding * 2)
          cell.lineTo(cellSize - padding * 2, cellSize - padding * 2)
          cell.stroke({ width: 5, color: 0x4a9eff, alpha: 0.6 })
        }
        if (y === 5) {
          // South side of river
          cell.moveTo(0, 0)
          cell.lineTo(cellSize - padding * 2, 0)
          cell.stroke({ width: 5, color: 0x4a9eff, alpha: 0.6 })
        }
        
        cell.x = cellX + padding
        cell.y = cellY + padding
        cell.eventMode = 'static'
        cell.cursor = 'pointer'
        
        cell.on('pointerover', () => {
          this.onCellHoverHandler(x, y)
        })
        cell.on('pointerout', () => {
          this.onCellOutHandler(x, y)
        })
        cell.on('pointerdown', () => {
          this.onCellClickHandler(x, y)
        })
        
        this.cellSprites.set(posKey, cell)
        this.boardContainer.addChild(cell)
      }
    }
  }
  
  private onCellHoverHandler(x: number, y: number) {
    const posKey = `${x},${y}`
    const cell = this.cellSprites.get(posKey)
    if (cell) {
      gsap.to(cell, {
        alpha: 0.9,
        duration: 0.2
      })
    }
    this.onCellHover?.(x, y)
  }
  
  private onCellOutHandler(x: number, y: number) {
    const posKey = `${x},${y}`
    const cell = this.cellSprites.get(posKey)
    if (cell) {
      gsap.to(cell, {
        alpha: 1,
        duration: 0.2
      })
    }
    this.onCellOut?.(x, y)
  }
  
  private onCellClickHandler(x: number, y: number) {
    this.onCellClick?.(x, y)
  }
  
  getCellPosition(x: number, y: number): { x: number; y: number } {
    const { cellSize, padding, boardOffsetX, boardOffsetY } = this.config
    // No coordinate flipping - use coordinates as-is to match DOM version
    return {
      x: x * cellSize + boardOffsetX + padding + (cellSize - padding * 2) / 2,
      y: y * cellSize + boardOffsetY + padding + (cellSize - padding * 2) / 2
    }
  }
  
  highlightCell(x: number, y: number, color: number = 0x91caff) {
    const posKey = `${x},${y}`
    
    if (this.highlightSprites.has(posKey)) {
      return
    }
    
    const highlight = new PIXI.Graphics()
    const { cellSize, padding } = this.config
    const pos = this.getCellPosition(x, y)
    
    highlight.roundRect(
      -((cellSize - padding * 2) / 2),
      -((cellSize - padding * 2) / 2),
      cellSize - padding * 2,
      cellSize - padding * 2,
      8
    )
    highlight.fill({ color, alpha: 0.3 })
    highlight.stroke({ width: 3, color, alpha: 0.8 })
    
    highlight.x = pos.x
    highlight.y = pos.y
    
    gsap.to(highlight.scale, {
      x: 1.05,
      y: 1.05,
      duration: 0.8,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut'
    })
    
    this.highlightSprites.set(posKey, highlight)
    this.highlightContainer.addChild(highlight)
  }
  
  clearHighlights() {
    this.highlightSprites.forEach((highlight, posKey) => {
      gsap.killTweensOf(highlight.scale)
      this.highlightContainer.removeChild(highlight)
      highlight.destroy()
    })
    this.highlightSprites.clear()
  }
  
  updateHighlights(options: {
    selectedUnitId: string | null
    legalMoves: Array<{ x: number; y: number }>
    shootableTargetIds: string[]
    highlightUnitIds: string[]
  }) {
    this.clearHighlights()
    
    // Highlight selected unit
    this.unitSprites.forEach(sprite => {
      sprite.deselect()
    })
    if (options.selectedUnitId) {
      const sprite = this.unitSprites.get(options.selectedUnitId)
      if (sprite) sprite.select()
    }
    
    // Highlight legal moves (teal/cyan - better contrast with black pieces)
    options.legalMoves.forEach(move => {
      this.highlightCell(move.x, move.y, 0x36cfc9)
    })
    
    // Highlight shootable targets (yellow - better visibility on red pieces)
    options.shootableTargetIds.forEach(unitId => {
      const sprite = this.unitSprites.get(unitId)
      if (sprite) {
        const highlight = new PIXI.Graphics()
        highlight.roundRect(0, 0, this.config.cellSize - this.config.padding * 2, this.config.cellSize - this.config.padding * 2, 8)
        highlight.fill({ color: 0xfaad14, alpha: 0.2 })
        highlight.stroke({ width: 3, color: 0xfaad14, alpha: 0.9 })
        
        highlight.x = sprite.x - this.config.cellSize / 2 + this.config.padding
        highlight.y = sprite.y - this.config.cellSize / 2 + this.config.padding
        
        this.highlightContainer.addChild(highlight)
        this.highlightSprites.set(`shootable_${unitId}`, highlight)
      }
    })
    
    // Highlight enchantable/targetable units (purple)
    options.highlightUnitIds.forEach(unitId => {
      const sprite = this.unitSprites.get(unitId)
      if (sprite) {
        const highlight = new PIXI.Graphics()
        highlight.roundRect(0, 0, this.config.cellSize - this.config.padding * 2, this.config.cellSize - this.config.padding * 2, 8)
        highlight.fill({ color: 0x722ed1, alpha: 0.14 })
        highlight.stroke({ width: 3, color: 0x722ed1, alpha: 0.9 })
        
        highlight.x = sprite.x - this.config.cellSize / 2 + this.config.padding
        highlight.y = sprite.y - this.config.cellSize / 2 + this.config.padding
        
        this.highlightContainer.addChild(highlight)
        this.highlightSprites.set(`highlight_${unitId}`, highlight)
      }
    })
  }
  
  addUnit(data: UnitSpriteData) {
    if (this.unitSprites.has(data.id)) {
      this.updateUnit(data.id, data)
      return
    }
    
    const unitSprite = new UnitSprite(data)
    const pos = this.getCellPosition(data.side === 'red' ? 0 : BOARD_WIDTH - 1, 0)
    unitSprite.x = pos.x
    unitSprite.y = pos.y
    
    unitSprite.on('pointerdown', () => {
      this.onUnitClick?.(data.id)
    })
    
    this.unitSprites.set(data.id, unitSprite)
    this.unitsContainer.addChild(unitSprite)
  }
  
  updateUnit(unitId: string, data: Partial<UnitSpriteData>) {
    const unitSprite = this.unitSprites.get(unitId)
    if (!unitSprite) return
    
    unitSprite.updateData(data)
  }
  
  moveUnit(unitId: string, toX: number, toY: number, duration: number = 0.5): Promise<void> {
    const unitSprite = this.unitSprites.get(unitId)
    if (!unitSprite) return Promise.resolve()
    
    const targetPos = this.getCellPosition(toX, toY)
    return unitSprite.moveTo(targetPos.x, targetPos.y, duration)
  }
  
  removeUnit(unitId: string, withAnimation: boolean = true): Promise<void> {
    const unitSprite = this.unitSprites.get(unitId)
    if (!unitSprite) return Promise.resolve()
    
    this.unitSprites.delete(unitId)
    
    if (withAnimation) {
      return unitSprite.playDeathAnimation()
    } else {
      this.unitsContainer.removeChild(unitSprite)
      unitSprite.destroy()
      return Promise.resolve()
    }
  }
  
  selectUnit(unitId: string) {
    const unitSprite = this.unitSprites.get(unitId)
    if (unitSprite) {
      unitSprite.select()
    }
  }
  
  deselectUnit(unitId: string) {
    const unitSprite = this.unitSprites.get(unitId)
    if (unitSprite) {
      unitSprite.deselect()
    }
  }
  
  playUnitHitAnimation(unitId: string) {
    const unitSprite = this.unitSprites.get(unitId)
    if (unitSprite) {
      unitSprite.playHitAnimation()
    }
  }
  
  playUnitAttackAnimation(unitId: string) {
    const unitSprite = this.unitSprites.get(unitId)
    if (unitSprite) {
      unitSprite.playAttackAnimation()
    }
  }
  
  syncUnitsFromState(state: GameState) {
    const currentUnitIds = new Set(Object.keys(state.units))
    
    this.unitSprites.forEach((_sprite, unitId) => {
      if (!currentUnitIds.has(unitId)) {
        this.removeUnit(unitId, false)
      }
    })
    
    Object.values(state.units).forEach(unit => {
      const pos = this.getCellPosition(unit.pos.x, unit.pos.y)
      const maxHp = getMaxHpForUnitInState(state, unit.id)
      
      if (this.unitSprites.has(unit.id)) {
        const sprite = this.unitSprites.get(unit.id)!
        const oldX = sprite.x
        const oldY = sprite.y
        const hasMoved = oldX !== pos.x || oldY !== pos.y
        
        // Animate movement if position changed
        if (hasMoved) {
          this.animatePieceMovement(sprite, oldX, oldY, pos.x, pos.y)
        } else {
          sprite.x = pos.x
          sprite.y = pos.y
        }
        
        const soulCard = unit.enchant ? getSoulCard(unit.enchant.soulId) : null
        const isSealed = state.turnFlags.sealedUnitIds?.includes(unit.id) ?? false
        sprite.updateData({
          hp: unit.hpCurrent,
          maxHp,
          enchantName: soulCard?.name || null,
          enchantImage: soulCard?.image || null,
          isSealed
        })
      } else {
        const soulCard = unit.enchant ? getSoulCard(unit.enchant.soulId) : null
        const isSealed = state.turnFlags.sealedUnitIds?.includes(unit.id) ?? false
        const unitData: UnitSpriteData = {
          id: unit.id,
          side: unit.side,
          base: unit.base,
          label: this.getUnitLabel(unit.side, unit.base),
          hp: unit.hpCurrent,
          maxHp,
          enchantName: soulCard?.name || null,
          enchantImage: soulCard?.image || null,
          isSealed
        }
        
        const unitSprite = new UnitSprite(unitData)
        unitSprite.x = pos.x
        unitSprite.y = pos.y
        
        unitSprite.on('pointerdown', () => {
          this.onUnitClick?.(unit.id)
        })
        
        unitSprite.on('pointerover', (event) => {
          const globalPos = event.global
          this.onUnitHover?.(unit.id, globalPos.x, globalPos.y)
        })
        
        unitSprite.on('pointerout', () => {
          this.onUnitHoverOut?.()
        })
        
        this.unitSprites.set(unit.id, unitSprite)
        this.unitsContainer.addChild(unitSprite)
      }
    })
  }
  
  syncCorpsesFromState(state: GameState) {
    // Clean up corpses that no longer exist
    this.corpseSprites.forEach((sprite, posKey) => {
      if (!state.corpsesByPos[posKey] || state.corpsesByPos[posKey].length === 0) {
        this.corpsesContainer.removeChild(sprite)
        sprite.destroy()
        this.corpseSprites.delete(posKey)
      }
    })
    
    // Update or create corpse sprites
    Object.entries(state.corpsesByPos).forEach(([posKey, corpses]) => {
      if (corpses.length === 0) return
      
      const coords = posKey.split(',').map(Number)
      if (coords.length !== 2 || coords.some(isNaN)) return
      const [x, y] = coords
      const pos = this.getCellPosition(x, y)
      
      const corpseData = corpses.map(c => ({
        base: c.base,
        ownerSide: c.ownerSide
      }))
      
      if (this.corpseSprites.has(posKey)) {
        this.corpseSprites.get(posKey)!.updateCorpses(corpseData)
      } else {
        const sprite = new CorpseSprite(corpseData)
        sprite.x = pos.x
        sprite.y = pos.y
        this.corpseSprites.set(posKey, sprite)
        this.corpsesContainer.addChild(sprite)
      }
    })
  }
  
  updateCorpseHighlights(highlightPosKeys: string[]) {
    this.corpseSprites.forEach((sprite, posKey) => {
      if (highlightPosKeys.includes(posKey)) {
        gsap.to(sprite, { alpha: 1, duration: 0.2 })
      } else {
        gsap.to(sprite, { alpha: 0.7, duration: 0.2 })
      }
    })
  }
  
  private animatePieceMovement(sprite: UnitSprite, fromX: number, fromY: number, toX: number, toY: number) {
    // Calculate movement distance for duration scaling
    const distance = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2))
    const baseDuration = 0.25
    const duration = Math.min(baseDuration + distance / 500, 0.6) // Scale with distance, max 0.6s
    
    // Create particle trail
    const trailParticles: PIXI.Graphics[] = []
    for (let i = 0; i < 5; i++) {
      const particle = new PIXI.Graphics()
      particle.circle(0, 0, 3)
      particle.fill({ color: sprite.unitId.includes('red') ? 0xff4d4f : 0x52c41a, alpha: 0.6 })
      particle.x = fromX
      particle.y = fromY
      this.effectsManager.container.addChild(particle)
      trailParticles.push(particle)
      
      // Animate particles with delay
      gsap.to(particle, {
        x: toX,
        y: toY,
        alpha: 0,
        duration: duration * 0.8,
        delay: i * 0.02,
        ease: 'power1.out',
        onComplete: () => {
          if (particle.parent) {
            particle.parent.removeChild(particle)
          }
          particle.destroy()
        }
      })
    }
    
    // Pick-up effect
    const timeline = gsap.timeline()
    timeline
      // Lift and scale up
      .to(sprite.scale, {
        x: 1.15,
        y: 1.15,
        duration: 0.12,
        ease: 'back.out(2)'
      })
      .to(sprite, {
        y: fromY - 8,
        duration: 0.12,
        ease: 'power2.out'
      }, 0)
      // Add slight rotation during movement
      .to(sprite, {
        rotation: (toX - fromX) > 0 ? 0.05 : -0.05,
        duration: 0.08,
        ease: 'sine.inOut'
      }, 0.12)
      // Move to target with arc
      .to(sprite, {
        x: toX,
        y: toY - 12, // Arc peak
        duration: duration * 0.5,
        ease: 'power1.inOut'
      }, 0.12)
      // Descend to target
      .to(sprite, {
        y: toY,
        duration: duration * 0.5,
        ease: 'power2.in'
      }, 0.12 + duration * 0.5)
      // Rotate back
      .to(sprite, {
        rotation: 0,
        duration: duration * 0.3,
        ease: 'sine.inOut'
      }, 0.12 + duration * 0.3)
      // Drop and bounce
      .to(sprite.scale, {
        x: 0.95,
        y: 0.95,
        duration: 0.08,
        ease: 'power2.in'
      }, 0.12 + duration)
      .to(sprite.scale, {
        x: 1.05,
        y: 1.05,
        duration: 0.1,
        ease: 'power2.out'
      })
      .to(sprite.scale, {
        x: 1,
        y: 1,
        duration: 0.12,
        ease: 'elastic.out(1.5, 0.3)'
      })
    
    // Landing ripple effect
    timeline.call(() => {
      this.createLandingRipple(toX, toY, sprite.unitId.includes('red') ? 0xff4d4f : 0x52c41a)
    }, [], 0.12 + duration)
  }
  
  private createLandingRipple(x: number, y: number, color: number) {
    const ripple = new PIXI.Graphics()
    ripple.circle(0, 0, 5)
    ripple.stroke({ width: 2, color, alpha: 0.8 })
    ripple.x = x
    ripple.y = y
    
    this.effectsManager.container.addChild(ripple)
    
    gsap.timeline()
      .to(ripple.scale, {
        x: 4,
        y: 4,
        duration: 0.4,
        ease: 'power2.out'
      })
      .to(ripple, {
        alpha: 0,
        duration: 0.4,
        ease: 'power1.in'
      }, 0)
      .call(() => {
        if (ripple.parent) {
          ripple.parent.removeChild(ripple)
        }
        ripple.destroy()
      })
  }
  
  private getUnitLabel(side: 'red' | 'black', base: string): string {
    switch (base) {
      case 'king':
        return side === 'red' ? '帥' : '將'
      case 'advisor':
        return side === 'red' ? '仕' : '士'
      case 'elephant':
        return side === 'red' ? '相' : '象'
      case 'rook':
        return '車'
      case 'knight':
        return '馬'
      case 'cannon':
        return side === 'red' ? '砲' : '炮'
      case 'soldier':
        return side === 'red' ? '兵' : '卒'
      default:
        return base.slice(0, 1)
    }
  }
  
  private startRenderLoop() {
    this.app.ticker.add((ticker) => {
      this.effectsManager.update(ticker.deltaTime)
    })
  }
  
  resize(width: number, height: number) {
    this.app.renderer.resize(width, height)
  }
  
  destroy() {
    this.effectsManager.destroy()
    this.app.destroy(true, { children: true })
  }
}

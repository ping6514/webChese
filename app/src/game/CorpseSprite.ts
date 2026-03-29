import * as PIXI from 'pixi.js'
import type { PieceBase, Side } from '../engine'

export interface CorpseData {
  base: PieceBase
  ownerSide: Side
}

export class CorpseSprite extends PIXI.Container {
  private background: PIXI.Graphics
  private labelText: PIXI.Text
  
  constructor(corpses: CorpseData[]) {
    super()
    
    this.background = new PIXI.Graphics()
    this.labelText = new PIXI.Text()
    
    this.setupVisuals(corpses)
  }
  
  private setupVisuals(corpses: CorpseData[]) {
    // Clear previous graphics
    this.background.clear()
    this.removeChild(this.labelText)
    
    if (corpses.length === 0) return
    
    // Get the top corpse (most recent)
    const topCorpse = corpses[corpses.length - 1]
    if (!topCorpse) return
    
    const color = topCorpse.ownerSide === 'red' ? 0xff4d4f : 0x52c41a
    
    // Draw semi-transparent background
    this.background.roundRect(-25, -25, 50, 50, 8)
    this.background.fill({ color: 0x1a1c2e, alpha: 0.7 })
    this.background.stroke({ width: 2, color, alpha: 0.5 })
    
    // Draw X mark to indicate corpse
    this.background.moveTo(-15, -15)
    this.background.lineTo(15, 15)
    this.background.moveTo(15, -15)
    this.background.lineTo(-15, 15)
    this.background.stroke({ width: 3, color, alpha: 0.6 })
    
    this.addChild(this.background)
    
    // Show corpse count if multiple
    if (corpses.length > 1) {
      this.labelText = new PIXI.Text({
        text: `×${corpses.length}`,
        style: {
          fontSize: 14,
          fontWeight: 'bold',
          fill: 0xffffff,
          stroke: { color: 0x000000, width: 3 }
        }
      })
      this.labelText.anchor.set(0.5)
      this.labelText.y = 20
      this.addChild(this.labelText)
    }
  }
  
  updateCorpses(corpses: CorpseData[]) {
    this.setupVisuals(corpses)
  }
}

import * as PIXI from 'pixi.js'
import type { PieceBase, Side } from '../engine'

export interface CorpseData {
  base: PieceBase
  ownerSide: Side
}

export class CorpseSprite extends PIXI.Container {
  private background: PIXI.Graphics
  private labelText: PIXI.Text
  private k: number

  constructor(corpses: CorpseData[], cellSize = 70) {
    super()
    this.k = cellSize / 70
    this.eventMode = 'none'  // 不參與事件系統，避免攔截底層格子的 pointerup
    this.background = new PIXI.Graphics()
    this.labelText = new PIXI.Text()

    this.setupVisuals(corpses)
  }

  private setupVisuals(corpses: CorpseData[]) {
    const k = this.k
    this.background.clear()
    this.removeChild(this.labelText)

    if (corpses.length === 0) return

    const topCorpse = corpses[corpses.length - 1]
    if (!topCorpse) return

    const color = topCorpse.ownerSide === 'red' ? 0xff4d4f : 0x52c41a

    this.background.roundRect(-25 * k, -25 * k, 50 * k, 50 * k, 8 * k)
    this.background.fill({ color: 0x1a1c2e, alpha: 0.7 })
    this.background.stroke({ width: 2, color, alpha: 0.5 })

    this.background.moveTo(-15 * k, -15 * k)
    this.background.lineTo(15 * k, 15 * k)
    this.background.moveTo(15 * k, -15 * k)
    this.background.lineTo(-15 * k, 15 * k)
    this.background.stroke({ width: Math.max(1, 3 * k), color, alpha: 0.6 })

    this.addChild(this.background)

    if (corpses.length > 1) {
      this.labelText = new PIXI.Text({
        text: `×${corpses.length}`,
        style: {
          fontSize: Math.round(14 * k),
          fontWeight: 'bold',
          fill: 0xffffff,
          stroke: { color: 0x000000, width: Math.max(1, 3 * k) }
        }
      })
      this.labelText.anchor.set(0.5)
      this.labelText.y = 20 * k
      this.addChild(this.labelText)
    }
  }
  
  updateCorpses(corpses: CorpseData[]) {
    this.setupVisuals(corpses)
  }
}

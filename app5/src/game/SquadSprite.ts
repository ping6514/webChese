import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import type { SquadInstance } from '../engine/types'
import { hexToPixel } from './hexUtils'

const LERP_SPEED   = 15
const TEAM_COLOR   = { player: 0x2850b4, enemy: 0xa02814 }
const BORDER_COLOR = { player: 0x66aaff, enemy: 0xff8866 }
const RADIUS       = 22
const BAR_W        = 44
const BAR_H        = 5
const BAR_Y        = RADIUS + 3
const DOT_Y        = BAR_Y + BAR_H + 3   // 護盾圓點列
const DOT_R        = 3
const DOT_GAP      = 8

export class SquadSprite extends Container {
  readonly squadId: string
  readonly team: 'player' | 'enemy'

  private bg: Graphics
  private bars: Graphics
  private nameLabel: Text

  private vx: number
  private vy: number
  private tx: number
  private ty: number

  constructor(squad: SquadInstance, captainName: string) {
    super()
    this.squadId = squad.squadId
    this.team    = squad.team

    const px = hexToPixel(squad.pos.q, squad.pos.r)
    this.vx = this.tx = px.x
    this.vy = this.ty = px.y
    this.x = px.x
    this.y = px.y

    this.bg   = new Graphics()
    this.bars = new Graphics()
    this.nameLabel = new Text({
      text: captainName,
      style: new TextStyle({ fontSize: 8, fill: 0xffffff, fontWeight: 'bold', align: 'center' }),
    })
    this.nameLabel.anchor.set(0.5, 0.5)
    this.nameLabel.y = -6

    this.addChild(this.bg)
    this.addChild(this.bars)
    this.addChild(this.nameLabel)

    this.eventMode = 'static'
    this.cursor = squad.team === 'player' ? 'pointer' : 'default'

    this.redraw(squad)
  }

  sync(squad: SquadInstance) {
    const px = hexToPixel(squad.pos.q, squad.pos.r)
    this.tx = px.x
    this.ty = px.y
    this.redraw(squad)
  }

  update(deltaMS: number) {
    const alpha = 1 - Math.exp(-LERP_SPEED * deltaMS / 1000)
    this.vx += (this.tx - this.vx) * alpha
    this.vy += (this.ty - this.vy) * alpha
    this.x = this.vx
    this.y = this.vy
  }

  setSelected(on: boolean) {
    this.bg.tint = on ? 0xffee00 : 0xffffff
  }

  onZoomChange(zoom: number) {
    this.nameLabel.style.fontSize = 8 * zoom
    this.nameLabel.scale.set(1 / zoom)
  }

  // ─────────────────────────────────────────────────────────────────────────

  private redraw(squad: SquadInstance) {
    const isAlive = squad.hp > 0 && squad.state !== 'retreating'
    this.visible = isAlive
    this.alpha   = squad.state === 'retreating' ? 0.35 : 1

    // ── 背景圓 ────────────────────────────────────────────────────────────
    this.bg.clear()
      .circle(0, 0, RADIUS)
      .fill({ color: TEAM_COLOR[squad.team] })
      .circle(0, 0, RADIUS)
      .stroke({ color: BORDER_COLOR[squad.team], width: 2 })

    this.bars.clear()

    // ── 隊長 HP 條 ────────────────────────────────────────────────────────
    const capPct = squad.maxHp > 0 ? squad.hp / squad.maxHp : 0
    this.bars
      .rect(-BAR_W / 2, BAR_Y, BAR_W, BAR_H)
      .fill({ color: 0x000000, alpha: 0.45 })
    if (capPct > 0) {
      const barColor = capPct > 0.5 ? 0x77ff44 : capPct > 0.25 ? 0xffcc00 : 0xff4422
      this.bars
        .rect(-BAR_W / 2, BAR_Y, BAR_W * capPct, BAR_H)
        .fill({ color: barColor })
    }

    // ── 護盾圓點（每個存活從者一個點）────────────────────────────────────
    const aliveShields = squad.shieldLayers.filter(s => !s.isDead)
    const totalSlots   = squad.maxShieldSlots
    const totalW       = totalSlots * DOT_R * 2 + (totalSlots - 1) * (DOT_GAP - DOT_R * 2)
    const startX       = -totalW / 2 + DOT_R

    for (let i = 0; i < totalSlots; i++) {
      const cx = startX + i * DOT_GAP
      const filled = i < aliveShields.length
      this.bars
        .circle(cx, DOT_Y, DOT_R)
        .fill({ color: filled ? 0x66ccff : 0x333333, alpha: filled ? 1 : 0.4 })
    }
  }
}

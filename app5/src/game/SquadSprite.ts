import { Container, Graphics, Text, TextStyle, Sprite } from 'pixi.js'
import type { SquadInstance, CaptainType } from '../engine/types'
import { hexToPixel } from './hexUtils'
import { CAPTAIN_PORTRAIT } from './portraitMap'

const LERP_SPEED = 15

const TEAM_COLOR   = { player: 0x1a3a7a, enemy: 0x7a1a1a }
const BORDER_COLOR = { player: 0x66aaff, enemy: 0xff6644 }

// ── 立牌尺寸 ─────────────────────────────────────────────────────────────────
// 錨點 = 格子中心（local y=0）
// 卡片往上延伸至 y=-CARD_H，往下 HP 條到 y=BAR_BOT
const CARD_W     = 40     // 卡片寬度
const CARD_H     = 48     // 卡片高度（往上）
const CARD_R     = 4      // 圓角半徑
const NAME_H     = 11     // 頂部名稱列高度
const PORT_PAD   = 2      // 頭貼內縮

const BAR_W      = CARD_W
const BAR_H      = 5
const BAR_Y      = 4      // HP 條相對 y=0 的位移
const DOT_Y      = BAR_Y + BAR_H + 3
const DOT_R      = 3
const DOT_GAP    = 8

// ─────────────────────────────────────────────────────────────────────────────

export class SquadSprite extends Container {
  readonly squadId: string
  readonly team: 'player' | 'enemy'

  private shadowGfx:     Graphics
  private cardBg:        Graphics
  private portrait:      Sprite
  private portMask:      Graphics
  private cardBorder:    Graphics
  private nameLabel:     Text
  private stateBadge:    Text
  private bars:          Graphics
  private flashGfx:      Graphics

  private vx: number
  private vy: number
  private tx: number
  private ty: number
  private flashTimer = 0

  constructor(squad: SquadInstance, captainName: string, captainType: CaptainType = 'infantry') {
    super()
    this.squadId = squad.squadId
    this.team    = squad.team

    const px = hexToPixel(squad.pos.q, squad.pos.r)
    this.vx = this.tx = px.x
    this.vy = this.ty = px.y
    this.x = px.x
    this.y = px.y

    const tc = TEAM_COLOR[squad.team]
    const bc = BORDER_COLOR[squad.team]

    // ── 地面陰影（橢圓，略扁模擬 ISO 視角） ──────────────────────────────
    this.shadowGfx = new Graphics()
      .ellipse(0, 2, CARD_W / 2 + 3, 6)
      .fill({ color: 0x000000, alpha: 0.25 })

    // ── 卡片背景 ─────────────────────────────────────────────────────────
    this.cardBg = new Graphics()
      .roundRect(-CARD_W / 2, -CARD_H, CARD_W, CARD_H, CARD_R)
      .fill({ color: tc, alpha: 0.88 })

    // ── 頭貼 Sprite + 遮罩（只顯示頭貼區域，排除名稱列） ─────────────────
    const portW = CARD_W - PORT_PAD * 2
    const portH = CARD_H - NAME_H - PORT_PAD
    // 遮罩：頭貼區塊（在 name 列下方到卡底部）
    this.portMask = new Graphics()
      .roundRect(
        -CARD_W / 2 + PORT_PAD,
        -CARD_H + NAME_H,
        portW, portH,
        CARD_R - 1,
      )
      .fill(0xffffff)

    this.portrait = Sprite.from(CAPTAIN_PORTRAIT[captainType])
    this.portrait.anchor.set(0.5, 1)   // 底部置中
    this.portrait.width  = portW
    this.portrait.height = portH
    this.portrait.x = 0
    this.portrait.y = -PORT_PAD         // 底邊貼齊卡底減 padding
    this.portrait.mask = this.portMask

    // ── 卡片邊框（在頭貼上方，覆蓋邊緣更乾淨） ───────────────────────────
    this.cardBorder = new Graphics()
      .roundRect(-CARD_W / 2, -CARD_H, CARD_W, CARD_H, CARD_R)
      .stroke({ color: bc, width: 2 })

    // ── 名稱文字（卡頂列） ────────────────────────────────────────────────
    this.nameLabel = new Text({
      text: captainName,
      style: new TextStyle({
        fontSize: 7,
        fill: 0xffffff,
        fontWeight: 'bold',
        align: 'center',
      }),
    })
    this.nameLabel.anchor.set(0.5, 0.5)
    this.nameLabel.y = -CARD_H + NAME_H / 2

    // ── 狀態 badge（卡片中央） ─────────────────────────────────────────
    this.stateBadge = new Text({
      text: '',
      style: new TextStyle({ fontSize: 13, align: 'center' }),
    })
    this.stateBadge.anchor.set(0.5, 0.5)
    this.stateBadge.y = -CARD_H / 2 + NAME_H / 2

    // ── HP 條 + 護盾圓點 ──────────────────────────────────────────────
    this.bars = new Graphics()

    // ── 受擊白閃 ─────────────────────────────────────────────────────
    this.flashGfx = new Graphics()

    // ── 層級（由下到上） ──────────────────────────────────────────────
    this.addChild(this.shadowGfx)
    this.addChild(this.cardBg)
    this.addChild(this.portMask)
    this.addChild(this.portrait)
    this.addChild(this.cardBorder)
    this.addChild(this.nameLabel)
    this.addChild(this.stateBadge)
    this.addChild(this.bars)
    this.addChild(this.flashGfx)

    this.eventMode = 'static'
    this.cursor = squad.team === 'player' ? 'pointer' : 'default'

    this.redraw(squad)
  }

  // ─── 引擎同步 ─────────────────────────────────────────────────────────────

  sync(squad: SquadInstance, elevationOffset = 0) {
    const px = hexToPixel(squad.pos.q, squad.pos.r)
    this.tx = px.x
    this.ty = px.y - elevationOffset
    this.redraw(squad)
  }

  /** 立即傳送到指定位置（不 lerp），復活/入場時呼叫 */
  teleport(toX: number, toY: number) {
    this.vx = this.tx = toX
    this.vy = this.ty = toY
    this.x  = toX
    this.y  = toY
  }

  // ─── 每幀插值 ─────────────────────────────────────────────────────────────

  update(deltaMS: number) {
    const alpha = 1 - Math.exp(-LERP_SPEED * deltaMS / 1000)
    this.vx += (this.tx - this.vx) * alpha
    this.vy += (this.ty - this.vy) * alpha
    this.x = this.vx
    this.y = this.vy
    if (this.flashTimer > 0) {
      this.flashTimer -= deltaMS
      this.flashGfx.alpha = Math.max(0, this.flashTimer / 120)
    }
  }

  // ─── 受擊閃白 ─────────────────────────────────────────────────────────────

  flash() {
    this.flashTimer = 120
    this.flashGfx.clear()
      .roundRect(-CARD_W / 2, -CARD_H, CARD_W, CARD_H, CARD_R)
      .fill({ color: 0xffffff, alpha: 0.7 })
  }

  // ─── 選中高亮 ─────────────────────────────────────────────────────────────

  setSelected(on: boolean) {
    this.cardBorder.tint = on ? 0xffee00 : 0xffffff
  }

  // ─── 縮放補償（Text 清晰度） ─────────────────────────────────────────────

  onZoomChange(zoom: number) {
    this.nameLabel.style.fontSize  = 7 * zoom
    this.nameLabel.scale.set(1 / zoom)
    this.stateBadge.style.fontSize = 13 * zoom
    this.stateBadge.scale.set(1 / zoom)
  }

  // ─── 重繪動態資訊 ─────────────────────────────────────────────────────────

  private redraw(squad: SquadInstance) {
    this.visible = squad.hp > 0
    this.alpha   = squad.state === 'retreating' ? 0.35 : 1

    this.bars.clear()

    // HP 條
    const pct = squad.maxHp > 0 ? squad.hp / squad.maxHp : 0
    this.bars
      .rect(-BAR_W / 2, BAR_Y, BAR_W, BAR_H)
      .fill({ color: 0x000000, alpha: 0.45 })
    if (pct > 0) {
      const barColor = pct > 0.5 ? 0x77ff44 : pct > 0.25 ? 0xffcc00 : 0xff4422
      this.bars
        .rect(-BAR_W / 2, BAR_Y, BAR_W * pct, BAR_H)
        .fill({ color: barColor })
    }

    // 護盾圓點
    const alive  = squad.shieldLayers.filter(s => !s.isDead)
    const slots  = squad.maxShieldSlots
    const totalW = slots * DOT_R * 2 + (slots - 1) * (DOT_GAP - DOT_R * 2)
    const startX = -totalW / 2 + DOT_R
    for (let i = 0; i < slots; i++) {
      const cx = startX + i * DOT_GAP
      this.bars
        .circle(cx, DOT_Y, DOT_R)
        .fill({ color: i < alive.length ? 0x66ccff : 0x333333, alpha: i < alive.length ? 1 : 0.4 })
    }

    const STATE_ICON: Partial<Record<string, string>> = {
      fighting:  '⚔',
      capturing: '🏴',
      retreating:'↩',
    }
    this.stateBadge.text = STATE_ICON[squad.state] ?? ''
  }
}

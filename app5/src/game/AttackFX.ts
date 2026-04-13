import { Container, Graphics } from 'pixi.js'
import type { AttackFXType } from '../engine/types'

const DURATION: Record<AttackFXType, number> = {
  slash:      380,
  stab:       300,
  arrow:      420,
  cannonball: 560,
}

export class AttackFX extends Container {
  readonly fxType: AttackFXType
  private life:    number
  private maxLife: number
  private sx: number
  private sy: number
  private tx: number
  private ty: number
  private gfx: Graphics

  constructor(
    fxType: AttackFXType,
    fromX: number, fromY: number,
    toX:   number, toY:   number,
  ) {
    super()
    this.fxType  = fxType
    this.maxLife = this.life = DURATION[fxType]
    this.sx = fromX; this.sy = fromY
    this.tx = toX;   this.ty = toY
    this.gfx = new Graphics()
    this.addChild(this.gfx)
  }

  tick(deltaMS: number): boolean {
    this.life -= deltaMS
    if (this.life <= 0) return true

    const t   = 1 - this.life / this.maxLife   // 0→1 進度
    const inv = this.life / this.maxLife        // 1→0 fade

    this.gfx.clear()

    switch (this.fxType) {
      case 'slash':      this.drawSlash(t, inv);      break
      case 'stab':       this.drawStab(t, inv);       break
      case 'arrow':      this.drawArrow(t, inv);      break
      case 'cannonball': this.drawCannonball(t, inv); break
    }
    return false
  }

  // ─── 劈砍：目標位置大型 X 形爆裂，帶衝擊圓環 ─────────────────────────────

  private drawSlash(t: number, inv: number) {
    const cx = this.tx
    const cy = this.ty

    // 衝擊圓環（從中心向外擴散）
    const ringR = t * 36
    this.gfx
      .circle(cx, cy, ringR)
      .stroke({ color: 0xffffff, alpha: inv * 0.5, width: 4 })
    this.gfx
      .circle(cx, cy, ringR * 0.6)
      .stroke({ color: 0xffee44, alpha: inv * 0.4, width: 2.5 })

    // X 形 4 道劈砍弧線
    const angles = [-Math.PI / 4, Math.PI / 4, Math.PI * 3 / 4, -Math.PI * 3 / 4]
    const spread = 22 + t * 28

    for (const base of angles) {
      const arc = 0.55
      const x0 = cx + Math.cos(base - arc) * spread
      const y0 = cy + Math.sin(base - arc) * spread
      const mx = cx + Math.cos(base) * spread * 1.5
      const my = cy + Math.sin(base) * spread * 1.5
      const x2 = cx + Math.cos(base + arc) * spread
      const y2 = cy + Math.sin(base + arc) * spread

      // 外層白色粗線
      this.gfx
        .moveTo(x0, y0).quadraticCurveTo(mx, my, x2, y2)
        .stroke({ color: 0xffffff, alpha: inv * 0.95, width: 6 - t * 2 })
      // 內層黃色細線
      this.gfx
        .moveTo(x0, y0).quadraticCurveTo(mx, my, x2, y2)
        .stroke({ color: 0xffee44, alpha: inv * 0.85, width: 3 - t })
      // 核心亮線
      this.gfx
        .moveTo(x0, y0).quadraticCurveTo(mx, my, x2, y2)
        .stroke({ color: 0xffffff, alpha: inv * 0.6, width: 1.2 })
    }

    // 中心爆點
    this.gfx
      .circle(cx, cy, 8 * (1 - t * 0.5))
      .fill({ color: 0xffffff, alpha: inv * 0.9 })
    this.gfx
      .circle(cx, cy, 5 * (1 - t * 0.5))
      .fill({ color: 0xffee44, alpha: inv })
  }

  // ─── 刺擊：藍白衝刺光束，帶電光殘影 ──────────────────────────────────────

  private drawStab(t: number, inv: number) {
    const progress = t < 0.55 ? t / 0.55 : 1
    const fadeOut  = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45

    const tip  = { x: this.sx + (this.tx - this.sx) * progress,      y: this.sy + (this.ty - this.sy) * progress }
    const tail = { x: this.sx + (this.tx - this.sx) * Math.max(0, progress - 0.4), y: this.sy + (this.ty - this.sy) * Math.max(0, progress - 0.4) }

    const a = fadeOut * inv

    // 外層光暈（最粗）
    this.gfx
      .moveTo(tail.x, tail.y).lineTo(tip.x, tip.y)
      .stroke({ color: 0x44aaff, alpha: a * 0.4, width: 14 })
    // 中層
    this.gfx
      .moveTo(tail.x, tail.y).lineTo(tip.x, tip.y)
      .stroke({ color: 0x88ddff, alpha: a * 0.7, width: 7 })
    // 核心白線
    this.gfx
      .moveTo(tail.x, tail.y).lineTo(tip.x, tip.y)
      .stroke({ color: 0xffffff, alpha: a * 0.95, width: 3 })

    // 尖端爆點
    if (progress > 0.85) {
      const burst = (progress - 0.85) / 0.15
      this.gfx.circle(tip.x, tip.y, 10 * burst).fill({ color: 0xffffff, alpha: a * 0.8 })
      this.gfx.circle(tip.x, tip.y, 6  * burst).fill({ color: 0xaaddff, alpha: a * 0.9 })
    }

    // 殘影粒子（沿路徑散落）
    for (let i = 0; i < 5; i++) {
      const bt = Math.max(0, progress - i * 0.07)
      const bx = this.sx + (this.tx - this.sx) * bt + (Math.random() - 0.5) * 6
      const by = this.sy + (this.ty - this.sy) * bt + (Math.random() - 0.5) * 6
      this.gfx.circle(bx, by, 2.5 - i * 0.3).fill({ color: 0x88ddff, alpha: a * (0.5 - i * 0.08) })
    }
  }

  // ─── 弓箭：細長箭頭飛行 + 明顯落點釘入效果 ───────────────────────────────

  private drawArrow(t: number, inv: number) {
    const inFlight = t < 0.82

    if (inFlight) {
      const px = this.sx + (this.tx - this.sx) * (t / 0.82)
      const py = this.sy + (this.ty - this.sy) * (t / 0.82) - Math.sin(t / 0.82 * Math.PI) * 18

      const dx = this.tx - this.sx
      const dy = this.ty - this.sy - Math.sin(t / 0.82 * Math.PI) * 18
      const len = Math.sqrt(dx * dx + dy * dy) || 1
      const nx = dx / len; const ny = dy / len

      // 箭身光暈
      this.gfx
        .moveTo(px - nx * 12, py - ny * 12)
        .lineTo(px + nx * 4,  py + ny * 4)
        .stroke({ color: 0xffdd66, alpha: 0.45, width: 7 })

      // 箭身
      this.gfx
        .moveTo(px - nx * 14, py - ny * 14)
        .lineTo(px + nx * 5,  py + ny * 5)
        .stroke({ color: 0xddaa22, alpha: 0.95, width: 3 })

      // 箭頭（三角）
      const hw = 4
      this.gfx.poly([
        px + nx * 12,          py + ny * 12,
        px + nx * 2  - ny * hw, py + ny * 2  + nx * hw,
        px + nx * 2  + ny * hw, py + ny * 2  - nx * hw,
      ]).fill({ color: 0xffeebb, alpha: 0.95 })

      // 尾羽
      const fx = px - nx * 16
      const fy = py - ny * 16
      this.gfx.poly([fx, fy, fx - ny * 5 - nx * 4, fy + nx * 5 - ny * 4, fx - nx * 2, fy - ny * 2]).fill({ color: 0xccaa44, alpha: 0.8 })
      this.gfx.poly([fx, fy, fx + ny * 5 - nx * 4, fy - nx * 5 - ny * 4, fx - nx * 2, fy - ny * 2]).fill({ color: 0xccaa44, alpha: 0.8 })

    } else {
      // 釘入爆散（t 0.82→1.0）
      const puff = (t - 0.82) / 0.18
      const cx = this.tx; const cy = this.ty

      // 放射線
      for (let i = 0; i < 6; i++) {
        const a  = (Math.PI / 3) * i
        const r  = puff * 22
        this.gfx
          .moveTo(cx, cy)
          .lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
          .stroke({ color: 0xffee88, alpha: (1 - puff) * 0.9, width: 3 - puff * 2 })
      }
      // 衝擊圓
      this.gfx.circle(cx, cy, puff * 16).stroke({ color: 0xffffff, alpha: (1 - puff) * 0.7, width: 3 })
      // 中心點
      this.gfx.circle(cx, cy, (1 - puff) * 6).fill({ color: 0xffd700, alpha: (1 - puff) })
    }
  }

  // ─── 砲彈：實心球拋物線 + 大爆炸 ─────────────────────────────────────────

  private drawCannonball(t: number, inv: number) {
    const arcH  = -40
    const inFlight = t < 0.80

    if (inFlight) {
      const prog = t / 0.80
      const px   = this.sx + (this.tx - this.sx) * prog
      const py   = this.sy + (this.ty - this.sy) * prog + arcH * Math.sin(prog * Math.PI)

      // 外光暈
      this.gfx.circle(px, py, 12).fill({ color: 0x333333, alpha: 0.35 })
      // 球體
      this.gfx.circle(px, py, 8).fill({ color: 0x222222, alpha: 0.95 })
      // 高光
      this.gfx.circle(px - 2, py - 2, 3).fill({ color: 0x888888, alpha: 0.7 })

      // 尾跡（5 個漸層圓）
      for (let i = 1; i <= 5; i++) {
        const bt = Math.max(0, prog - i * 0.045)
        const bx = this.sx + (this.tx - this.sx) * bt
        const by = this.sy + (this.ty - this.sy) * bt + arcH * Math.sin(bt * Math.PI)
        this.gfx.circle(bx, by, 7 - i).fill({ color: 0x444444, alpha: 0.35 / i })
      }

    } else {
      // 爆炸（t 0.80→1.0）
      const boom = (t - 0.80) / 0.20
      const cx = this.tx; const cy = this.ty

      // 外爆炸環（橘）
      this.gfx
        .circle(cx, cy, boom * 44)
        .stroke({ color: 0xff6600, alpha: (1 - boom) * 0.9, width: 8 - boom * 6 })
      // 中爆炸環（黃）
      this.gfx
        .circle(cx, cy, boom * 32)
        .stroke({ color: 0xffcc00, alpha: (1 - boom) * 0.95, width: 6 - boom * 4 })
      // 內環（白）
      this.gfx
        .circle(cx, cy, boom * 20)
        .stroke({ color: 0xffffff, alpha: (1 - boom) * 0.8, width: 4 - boom * 3 })
      // 中心填充
      this.gfx
        .circle(cx, cy, (1 - boom) * 14)
        .fill({ color: 0xffffff, alpha: (1 - boom) * 0.9 })

      // 8 方向爆散碎片
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI / 4) * i
        const r = boom * 38
        const sx2 = cx + Math.cos(a) * r * 0.3
        const sy2 = cy + Math.sin(a) * r * 0.3
        const ex  = cx + Math.cos(a) * r
        const ey  = cy + Math.sin(a) * r
        this.gfx
          .moveTo(sx2, sy2).lineTo(ex, ey)
          .stroke({ color: 0xff9900, alpha: (1 - boom) * 0.85, width: 3 - boom * 2 })
      }
    }
  }
}

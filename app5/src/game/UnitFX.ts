import { Container, Graphics } from 'pixi.js'

export type UnitFXType = 'death' | 'revive' | 'spawn'

const DURATION: Record<UnitFXType, number> = {
  death:  600,
  revive: 700,
  spawn:  600,
}

export class UnitFX extends Container {
  private life:    number
  private maxLife: number
  private fxType:  UnitFXType
  private gfx:     Graphics
  private cx:      number
  private cy:      number

  constructor(fxType: UnitFXType, x: number, y: number) {
    super()
    this.fxType  = fxType
    this.maxLife = this.life = DURATION[fxType]
    this.cx = x
    this.cy = y
    this.gfx = new Graphics()
    this.addChild(this.gfx)
  }

  tick(deltaMS: number): boolean {
    this.life -= deltaMS
    if (this.life <= 0) return true

    const t   = 1 - this.life / this.maxLife   // 0→1
    const inv = this.life / this.maxLife        // 1→0

    this.gfx.clear()
    switch (this.fxType) {
      case 'death':  this.drawDeath(t, inv);  break
      case 'revive': this.drawRevive(t, inv); break
      case 'spawn':  this.drawSpawn(t, inv);  break
    }
    return false
  }

  // ─── 死亡：單位碎裂成灰塵向上飄散 ───────────────────────────────────────

  private drawDeath(t: number, inv: number) {
    const cx = this.cx
    const cy = this.cy

    // 黑色衝擊環（前半）
    if (t < 0.4) {
      const ring = (t / 0.4)
      this.gfx
        .circle(cx, cy, ring * 30)
        .stroke({ color: 0x222222, alpha: (1 - ring) * 0.8, width: 5 - ring * 3 })
    }

    // 8 個碎片往外飄散
    const SEEDS = [0, 42, 137, 251, 89, 180, 310, 220]
    for (let i = 0; i < 8; i++) {
      const seed = SEEDS[i]
      const angle  = (Math.PI * 2 / 8) * i + 0.3
      const spread = t * (28 + (seed % 16))
      const rise   = t * t * (18 + (seed % 12))   // 加速向上（受重力往下感）
      const px = cx + Math.cos(angle) * spread
      const py = cy + Math.sin(angle) * spread - rise
      const r  = (4 - i * 0.3) * inv
      this.gfx
        .circle(px, py, Math.max(0.5, r))
        .fill({ color: 0x888888, alpha: inv * 0.85 })
    }

    // 中央消散（卡片輪廓淡出）
    const w = 40 * (1 + t * 0.3)
    const h = 48 * (1 + t * 0.3)
    this.gfx
      .roundRect(cx - w / 2, cy - h, w, h, 4)
      .stroke({ color: 0xffffff, alpha: inv * 0.5, width: 2 })

    // 最後的白光閃滅
    if (t < 0.2) {
      this.gfx
        .circle(cx, cy, (0.2 - t) / 0.2 * 22)
        .fill({ color: 0xffffff, alpha: (0.2 - t) / 0.2 * 0.7 })
    }
  }

  // ─── 復活：光柱從下往上貫穿，粒子落下 ───────────────────────────────────

  private drawRevive(t: number, inv: number) {
    const cx = this.cx
    const cy = this.cy

    // 光柱（t 0→0.6 出現，0.6→1 消退）
    const pillarAlpha = t < 0.6
      ? (t / 0.6) * 0.85
      : ((1 - t) / 0.4) * 0.85
    const pillarH = 80 + t * 20

    // 外層光暈柱
    this.gfx
      .rect(cx - 16, cy - pillarH, 32, pillarH)
      .fill({ color: 0x4488ff, alpha: pillarAlpha * 0.3 })
    // 核心白柱
    this.gfx
      .rect(cx - 6, cy - pillarH, 12, pillarH)
      .fill({ color: 0xaaddff, alpha: pillarAlpha * 0.7 })
    // 最亮核心
    this.gfx
      .rect(cx - 2, cy - pillarH, 4, pillarH)
      .fill({ color: 0xffffff, alpha: pillarAlpha * 0.9 })

    // 向外擴散環（3 道）
    for (let i = 0; i < 3; i++) {
      const phase = ((t + i * 0.25) % 0.75) / 0.75
      const r = phase * 36
      this.gfx
        .circle(cx, cy, r)
        .stroke({ color: 0x66aaff, alpha: (1 - phase) * 0.6, width: 3 - phase * 2 })
    }

    // 落下的光粒子（t > 0.3）
    if (t > 0.3) {
      const PSEED = [10, 35, 62, 88, 14]
      for (let i = 0; i < 5; i++) {
        const s = PSEED[i]
        const px = cx + ((s % 40) - 20)
        const fallT = ((t - 0.3 + i * 0.1) % 0.7) / 0.7
        const py = cy - pillarH * (1 - fallT)
        this.gfx
          .circle(px, py, 2.5)
          .fill({ color: 0xaaddff, alpha: (1 - fallT) * 0.9 })
      }
    }

    // 地面光暈圈
    this.gfx
      .ellipse(cx, cy, 26 + t * 8, 10 + t * 3)
      .fill({ color: 0x4488ff, alpha: pillarAlpha * 0.35 })
  }

  // ─── 入場：從天而降 + 落地衝擊環（首次召喚用）───────────────────────────

  private drawSpawn(t: number, inv: number) {
    const cx = this.cx
    const cy = this.cy

    // 落下軌跡（t < 0.5）
    if (t < 0.55) {
      const dropT = t / 0.55
      const trailY = cy - (1 - dropT) * (1 - dropT) * 60   // 加速落下
      // 拖尾光點
      for (let i = 0; i < 4; i++) {
        const bt = Math.max(0, dropT - i * 0.1)
        const by = cy - (1 - bt) * (1 - bt) * 60
        this.gfx
          .circle(cx, by, 5 - i)
          .fill({ color: 0xffdd88, alpha: (1 - dropT) * (0.7 - i * 0.15) })
      }
      // 本體光點
      this.gfx.circle(cx, trailY, 8).fill({ color: 0xffffff, alpha: (1 - dropT * 0.5) * 0.9 })
    } else {
      // 落地衝擊（t 0.55→1.0）
      const boom = (t - 0.55) / 0.45
      // 塵土環
      this.gfx
        .circle(cx, cy, boom * 36)
        .stroke({ color: 0xddbb66, alpha: (1 - boom) * 0.8, width: 5 - boom * 4 })
      this.gfx
        .circle(cx, cy, boom * 22)
        .stroke({ color: 0xffffff, alpha: (1 - boom) * 0.7, width: 3 - boom * 2 })
      // 地面橢圓
      this.gfx
        .ellipse(cx, cy, boom * 30, boom * 12)
        .fill({ color: 0xddbb66, alpha: (1 - boom) * 0.3 })
    }
  }
}

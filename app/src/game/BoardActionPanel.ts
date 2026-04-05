import * as PIXI from 'pixi.js'
import { gsap } from 'gsap'

// ── Types ────────────────────────────────────────────────────────────────────

export interface SkillOption {
  key: string
  label: string
  style: 'blood' | 'gold'
}

export interface SkillSelectConfig {
  title: string
  skills: SkillOption[]
  pierceCount?: number          // 若 > 0 顯示貫通提示行
  chainEligibleCount?: number   // 若 > 0 顯示連鎖提示行
  targetScreenPos?: { x: number; y: number }
  onContinue: (activeKeys: string[]) => void
  onCancel: () => void
}

export interface ModePanelConfig {
  label: string
  extraBtnLabel?: string
  extraBtnStyle?: 'blood' | 'gold' | 'normal'
  onExtraBtn?: () => void
  onCancel: () => void
}

export interface AttackConfirmConfig {
  title: string
  summary?: string
  confirmLabel?: string
  confirmDisabled?: boolean
  onSelectChain?: () => void    // 提供時顯示連鎖選擇按鈕
  targetScreenPos?: { x: number; y: number }
  onConfirm: () => void
  onBack?: () => void
  onCancel: () => void
  onPreview?: () => void
}

// ── Theme ────────────────────────────────────────────────────────────────────

const T = {
  panelBg: 0x1a1c2e,
  panelBorder: 0x3a3d5e,
  text: 0xffffff,
  textMuted: 0x8888aa,
  textHint: 0x6688aa,
  confirm:  { bg: 0x1a3a1a, border: 0x52c41a, text: 0xb7eb8f },
  cancel:   { bg: 0x1e2035, border: 0x3a3d5e, text: 0x777799 },
  normal:   { bg: 0x252840, border: 0x4a4d6e, text: 0xddddff },
  disabled: { bg: 0x1a1c2e, border: 0x3a3d5e, text: 0x555577 },
  blood:    { bg: 0x2a1010, border: 0x993333, text: 0xfca5a5, activeBg: 0x5b0e0e, activeBorder: 0xdc2626 },
  gold:     { bg: 0x2a1f08, border: 0x996633, text: 0xfde68a, activeBg: 0x78420a, activeBorder: 0xd97706 },
  chain:    { bg: 0x0a1f3f, border: 0x1677ff, text: 0x91d5ff, activeBg: 0x0f3460, activeBorder: 0x40a9ff },
} as const

const PAD = 10
const BTN_H = 36
const GAP = 6
const INFO_H = 18    // 資訊行高度
const PANEL_R = 12
const BTN_R = 8
const PANEL_W = 280
const FONT = 'system-ui, -apple-system, sans-serif'
const EDGE = 8       // 距畫布邊緣安全距離

// ── Class ────────────────────────────────────────────────────────────────────

export class BoardActionPanel extends PIXI.Container {
  private backdrop: PIXI.Graphics
  private panelContainer: PIXI.Container
  private cw: number
  private ch: number
  private activeSkillKeys: Set<string> = new Set()
  private chainCheckText: PIXI.Text | null = null   // 連鎖按鈕右側勾選文字
  private chainBtnGraphics: PIXI.Graphics | null = null  // 連鎖按鈕背景

  constructor(canvasW: number, canvasH: number) {
    super()
    this.cw = canvasW
    this.ch = canvasH
    this.visible = false
    // passive：子元素（面板 bg）仍可攔截點擊，但 Container 本身不吃掉棋盤事件
    this.eventMode = 'passive'

    // 只做視覺暗化，不阻擋棋盤事件（讓連鎖點選可以穿透）
    this.backdrop = new PIXI.Graphics()
    this.backdrop.rect(0, 0, canvasW, canvasH)
    this.backdrop.fill({ color: 0x000000, alpha: 0.45 })
    this.backdrop.eventMode = 'none'
    this.addChild(this.backdrop)

    this.panelContainer = new PIXI.Container()
    this.addChild(this.panelContainer)
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  showSkillSelect(config: SkillSelectConfig) {
    this._reset()
    // 技能選擇階段：完全阻擋棋盤事件，避免誤觸連鎖目標
    this.eventMode = 'static'
    this.backdrop.eventMode = 'static'

    const numSkills = config.skills.length
    const numInfoRows =
      (numSkills > 0 ? 1 : 0) +                     // 提示文字行
      (config.pierceCount ? 1 : 0) +
      (config.chainEligibleCount ? 1 : 0)

    const panelH =
      PAD + 18 +
      (numInfoRows > 0 ? GAP + numInfoRows * (INFO_H + 3) : 0) +
      (numSkills > 0 ? GAP + numSkills * (BTN_H + GAP) : 0) +
      PAD / 2 + BTN_H + PAD

    const pos = this._calcPosition(panelH, config.targetScreenPos)
    this._buildBg(PANEL_W, panelH, pos)

    // Title
    const title = this._txt(config.title, 13, T.text, 'bold')
    title.x = PAD
    title.y = PAD
    this.panelContainer.addChild(title)

    let y = PAD + 18

    // Info rows
    if (numInfoRows > 0) {
      y += GAP
      if (numSkills > 0) {
        const hint = this._txt('點擊啟用技能（可不選）', 11, T.textMuted)
        hint.x = PAD
        hint.y = y
        this.panelContainer.addChild(hint)
        y += INFO_H + 3
      }
      if (config.pierceCount) {
        const pt = this._txt(`⬡ 貫通效果：將穿透 ${config.pierceCount} 個目標`, 11, T.textHint)
        pt.x = PAD
        pt.y = y
        this.panelContainer.addChild(pt)
        y += INFO_H + 3
      }
      if (config.chainEligibleCount) {
        const ct = this._txt(`↗ 連鎖可用：確認後可點棋盤選擇額外目標`, 11, T.textHint)
        ct.x = PAD
        ct.y = y
        this.panelContainer.addChild(ct)
        y += INFO_H + 3
      }
    }

    // Skill toggle buttons
    if (numSkills > 0) {
      y += GAP
      for (const skill of config.skills) {
        this._buildSkillToggle(skill, PANEL_W - PAD * 2, y)
        y += BTN_H + GAP
      }
    }

    y += PAD / 2

    // Bottom buttons
    const bw = (PANEL_W - PAD * 2 - GAP) / 2
    const continueBtn = this._btn('繼續攻擊', bw, BTN_H, 'confirm', () => {
      config.onContinue(Array.from(this.activeSkillKeys))
    })
    continueBtn.x = PAD
    continueBtn.y = y
    this.panelContainer.addChild(continueBtn)

    const cancelBtn = this._btn('取消', bw, BTN_H, 'cancel', () => {
      this.hide(); config.onCancel()
    })
    cancelBtn.x = PAD + bw + GAP
    cancelBtn.y = y
    this.panelContainer.addChild(cancelBtn)

    this._animateIn(pos.y)
  }

  showAttackConfirm(config: AttackConfirmConfig) {
    this._reset()
    // 確認階段：backdrop 攔截棋盤點擊，避免面板下方的格子/棋子誤觸
    this.eventMode = 'static'
    this.backdrop.eventMode = 'static'

    const hasSummary = !!config.summary
    const hasChain = !!config.onSelectChain
    const hasPreview = !!config.onPreview
    const numBtns = 1 + (hasPreview ? 1 : 0) + 1

    const panelH =
      PAD + 18 +
      (hasSummary ? GAP + INFO_H : 0) +
      (hasChain ? GAP + BTN_H + GAP : 0) +
      PAD + BTN_H + PAD

    const pos = this._calcPosition(panelH, config.targetScreenPos)
    this._buildBg(PANEL_W, panelH, pos)

    const title = this._txt(config.title, 13, T.text, 'bold')
    title.x = PAD
    title.y = PAD
    this.panelContainer.addChild(title)

    let y = PAD + 18

    if (config.summary) {
      const st = this._txt(config.summary, 11, T.textMuted)
      st.x = PAD
      st.y = y + GAP
      this.panelContainer.addChild(st)
      y += GAP + INFO_H
    }

    if (hasChain) {
      y += GAP
      const chainBtn = this._buildChainButton(PANEL_W - PAD * 2, false, config.onSelectChain!)
      chainBtn.x = PAD
      chainBtn.y = y
      this.panelContainer.addChild(chainBtn)
      y += BTN_H + GAP
    }

    y += PAD

    const bw = (PANEL_W - PAD * 2 - GAP * (numBtns - 1)) / numBtns
    let bx = PAD

    const confirmStyle = config.confirmDisabled ? 'disabled' : 'confirm'
    const confirmBtn = this._btn(config.confirmLabel ?? '確認射擊', bw, BTN_H, confirmStyle, () => {
      this.hide(); config.onConfirm()
    })
    confirmBtn.x = bx; confirmBtn.y = y
    this.panelContainer.addChild(confirmBtn)
    bx += bw + GAP

    if (hasPreview) {
      const previewBtn = this._btn('射擊預覽', bw, BTN_H, 'normal', () => config.onPreview!())
      previewBtn.x = bx; previewBtn.y = y
      this.panelContainer.addChild(previewBtn)
      bx += bw + GAP
    }

    const backLabel = config.onBack ? '返回' : '取消'
    const backBtn = this._btn(backLabel, bw, BTN_H, 'cancel', () => {
      if (config.onBack) config.onBack()
      else { this.hide(); config.onCancel() }
    })
    backBtn.x = bx; backBtn.y = y
    this.panelContainer.addChild(backBtn)

    this._animateIn(pos.y)
  }

  /** 由外部呼叫，更新確認面板的連鎖按鈕顯示 */
  updateChainTarget(selected: boolean) {
    const colors = T.chain
    const w = PANEL_W - PAD * 2

    if (this.chainCheckText) {
      this.chainCheckText.text = selected ? '✓ 已選擇' : ''
      this.chainCheckText.style.fill = selected ? colors.activeBorder : colors.text
      this.chainCheckText.x = w - this.chainCheckText.width - 10
    }

    if (this.chainBtnGraphics) {
      this.chainBtnGraphics.clear()
      this.chainBtnGraphics.roundRect(0, 0, w, BTN_H, BTN_R)
      this.chainBtnGraphics.fill({ color: selected ? colors.activeBg : colors.bg })
      this.chainBtnGraphics.stroke({ color: selected ? colors.activeBorder : colors.border, width: selected ? 2 : 1 })
    }
  }

  showModePanel(config: ModePanelConfig) {
    this._reset()
    // 模式選擇條：不阻擋棋盤事件，讓使用者可以正常點選棋子/格子
    this.eventMode = 'passive'
    this.backdrop.eventMode = 'none'

    const barH = PAD * 2 + BTN_H
    const barW = this.cw - EDGE * 2

    this.panelContainer.x = EDGE

    const bg = new PIXI.Graphics()
    bg.roundRect(0, 0, barW, barH, PANEL_R)
    bg.fill({ color: T.panelBg })
    bg.stroke({ color: T.panelBorder, width: 1 })
    bg.eventMode = 'static'
    this.panelContainer.addChild(bg)

    const label = this._txt(config.label, 12, T.text)
    label.x = PAD
    label.y = Math.round((barH - label.height) / 2)
    this.panelContainer.addChild(label)

    const cancelW = 56
    let rightX = barW - PAD - cancelW

    if (config.onExtraBtn && config.extraBtnLabel) {
      const extraStyle = config.extraBtnStyle ?? 'normal'
      const extraW = 70
      const extraBtn = this._btn(config.extraBtnLabel, extraW, BTN_H, extraStyle, () => {
        config.onExtraBtn!()
      })
      extraBtn.x = rightX - GAP - extraW
      extraBtn.y = PAD
      this.panelContainer.addChild(extraBtn)
    }

    const cancelBtn = this._btn('取消', cancelW, BTN_H, 'cancel', () => {
      this.hide(); config.onCancel()
    })
    cancelBtn.x = rightX
    cancelBtn.y = PAD
    this.panelContainer.addChild(cancelBtn)

    this._animateIn(EDGE)
  }

  hide() {
    gsap.killTweensOf(this.panelContainer)
    this.visible = false
    this._reset()
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private _reset() {
    this.panelContainer.removeChildren()
    this.activeSkillKeys.clear()
    this.chainCheckText = null
    this.chainBtnGraphics = null
  }

  /** 根據目標棋子位置計算面板位置，偏向棋盤中心，夾在邊界內 */
  private _calcPosition(panelH: number, targetPos?: { x: number; y: number }): { x: number; y: number } {
    const cx = this.cw / 2
    const cy = this.ch / 2

    if (!targetPos) {
      return {
        x: Math.round(cx - PANEL_W / 2),
        y: Math.round(cy - panelH / 2),
      }
    }

    const dx = cx - targetPos.x
    const dy = cy - targetPos.y
    const dist = Math.hypot(dx, dy)
    const OFFSET = 100

    let px: number, py: number
    if (dist < 20) {
      px = cx - PANEL_W / 2
      py = cy - panelH / 2
    } else {
      px = targetPos.x + (dx / dist) * OFFSET - PANEL_W / 2
      py = targetPos.y + (dy / dist) * OFFSET - panelH / 2
    }

    return {
      x: Math.round(Math.max(EDGE, Math.min(px, this.cw - PANEL_W - EDGE))),
      y: Math.round(Math.max(EDGE, Math.min(py, this.ch - panelH - EDGE))),
    }
  }

  private _buildBg(w: number, h: number, pos: { x: number; y: number }) {
    this.panelContainer.x = pos.x
    this.panelContainer.y = pos.y

    const bg = new PIXI.Graphics()
    bg.roundRect(0, 0, w, h, PANEL_R)
    bg.fill({ color: T.panelBg })
    bg.stroke({ color: T.panelBorder, width: 1 })
    // 面板背景阻擋事件（避免點到面板時觸發棋盤）
    bg.eventMode = 'static'
    this.panelContainer.addChild(bg)
  }

  private _animateIn(targetY: number) {
    this.panelContainer.y = targetY - 10
    this.panelContainer.alpha = 0
    this.visible = true
    gsap.to(this.panelContainer, { y: targetY, alpha: 1, duration: 0.18, ease: 'power2.out' })
  }

  private _txt(
    text: string, fontSize: number, fill: number,
    fontWeight: 'normal' | 'bold' = 'normal',
  ): PIXI.Text {
    return new PIXI.Text({ text, style: { fill, fontSize, fontWeight, fontFamily: FONT } })
  }

  private _btn(
    label: string, w: number, h: number,
    style: 'confirm' | 'cancel' | 'normal' | 'disabled' | 'blood' | 'gold',
    onTap: () => void,
  ): PIXI.Container {
    const c = new PIXI.Container()
    const colors = T[style] as unknown as { bg: number; border: number; text: number }

    const g = new PIXI.Graphics()
    g.roundRect(0, 0, w, h, BTN_R)
    g.fill({ color: colors.bg })
    g.stroke({ color: colors.border, width: 1 })
    c.addChild(g)

    const txt = this._txt(label, 12, colors.text, 'bold')
    txt.x = Math.round((w - txt.width) / 2)
    txt.y = Math.round((h - txt.height) / 2)
    c.addChild(txt)

    if (style !== 'disabled') {
      c.eventMode = 'static'
      c.cursor = 'pointer'
      c.on('pointerover', () => { g.alpha = 0.72 })
      c.on('pointerout',  () => { g.alpha = 1 })
      c.on('pointerup',   () => { g.alpha = 1; onTap() })
    } else {
      c.alpha = 0.42
    }

    return c
  }

  private _buildChainButton(w: number, selected: boolean, onTap: () => void): PIXI.Container {
    const colors = T.chain
    const c = new PIXI.Container()
    c.eventMode = 'static'
    c.cursor = 'pointer'

    const g = new PIXI.Graphics()
    g.roundRect(0, 0, w, BTN_H, BTN_R)
    g.fill({ color: selected ? colors.activeBg : colors.bg })
    g.stroke({ color: selected ? colors.activeBorder : colors.border, width: selected ? 2 : 1 })
    c.addChild(g)
    this.chainBtnGraphics = g

    const labelTxt = this._txt('↗ 選擇連鎖目標', 12, colors.text, 'bold')
    labelTxt.x = 10
    labelTxt.y = Math.round((BTN_H - labelTxt.height) / 2)
    c.addChild(labelTxt)

    const checkTxt = this._txt(selected ? '✓ 已選擇' : '', 11, selected ? colors.activeBorder : colors.text)
    checkTxt.y = Math.round((BTN_H - checkTxt.height) / 2)
    checkTxt.x = w - checkTxt.width - 10
    c.addChild(checkTxt)
    this.chainCheckText = checkTxt

    c.on('pointerover', () => { g.alpha = 0.72 })
    c.on('pointerout',  () => { g.alpha = 1 })
    c.on('pointerup',   () => { g.alpha = 1; onTap() })

    return c
  }

  private _buildSkillToggle(skill: SkillOption, w: number, y: number) {
    const colors = T[skill.style] as typeof T['blood']
    const c = new PIXI.Container()
    c.eventMode = 'static'
    c.cursor = 'pointer'

    const g = new PIXI.Graphics()
    g.roundRect(0, 0, w, BTN_H, BTN_R)
    g.fill({ color: colors.bg })
    g.stroke({ color: colors.border, width: 1 })
    c.addChild(g)

    const labelTxt = this._txt(skill.label, 12, colors.text, 'bold')
    labelTxt.x = 10
    labelTxt.y = Math.round((BTN_H - labelTxt.height) / 2)
    c.addChild(labelTxt)

    const checkTxt = this._txt('', 11, colors.text)
    checkTxt.y = Math.round((BTN_H - checkTxt.height) / 2)
    c.addChild(checkTxt)

    let active = false

    c.on('pointerup', () => {
      active = !active
      if (active) this.activeSkillKeys.add(skill.key)
      else this.activeSkillKeys.delete(skill.key)

      g.clear()
      g.roundRect(0, 0, w, BTN_H, BTN_R)
      g.fill({ color: active ? colors.activeBg : colors.bg })
      g.stroke({ color: active ? colors.activeBorder : colors.border, width: active ? 2 : 1 })

      checkTxt.text = active ? '✓ 已啟用' : ''
      checkTxt.x = w - checkTxt.width - 10
    })

    c.x = PAD
    c.y = y
    this.panelContainer.addChild(c)
  }
}

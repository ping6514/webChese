import { Application, Assets, Container, Graphics, Text, TextStyle, Ticker } from 'pixi.js'
import type { GameState, MapCell, HexPos, ZoneState, LaneDef } from '../engine/types'
import { MAP_LABELS } from '../engine/mapData'
import {
  hexToPixel, hexPolygonPoints, pixelToHex,
  hexElevatedPoints, hexSideFaces,
  HEX_SIZE, ELEVATION,
} from './hexUtils'
import { SquadSprite } from './SquadSprite'
import { AttackFX } from './AttackFX'
import { UnitFX } from './UnitFX'
import type { CaptainDef, CaptainType } from '../engine/types'
import { hexDistance, hexKey } from '../engine/types'
import { ALL_PORTRAIT_URLS } from './portraitMap'

// ─── 地形色彩 ────────────────────────────────────────────────────────────────

const TERRAIN_FILL: Record<string, number> = {
  normal:      0xd8c8a8,
  highGround:  0xb8c890,
  forest:      0x789060,
  river:       0x8ab4c8,
  bridge:      0xc8b478,
  wall:        0x8a7a68,
  impassable:  0x3a2a18,
}

const BUILDING_ICON: Record<string, string> = {
  playerBase: '🏰', enemyBase: '🏯', outpost: '⛺', barracks: '⚔️',
  highGround: '🏔', gate: '🚪', enemyTower: '�',
}

const TAP_THRESHOLD = 8   // px，超過才算拖動

// ─────────────────────────────────────────────────────────────────────────────

export class PixiHexRenderer {
  private app!: Application

  // Pixi 容器層級
  private world!: Container          // 整體 pan，worldContainer
  private terrainLayer!: Container   // 靜態地形（只建一次）
  private buildingLayer!: Container  // 建築（佔領狀態會變）
  private squadLayer!: Container     // 小隊 token
  private uiLayer!: Container        // 不隨 pan 移動的 UI（暫時留空）

  // 小隊 sprites
  private squadSprites = new Map<string, SquadSprite>()

  // 隊長名稱 / 型別快取（captainDefId → name/type）
  private captainNames = new Map<string, string>()
  private captainTypes = new Map<string, CaptainType>()

  // 建築文字 refs（zoom 時更新解析度）
  private buildingTexts: Text[] = []

  // 地圖區域標籤（zoom 時更新解析度）
  private labelTexts: Text[] = []

  // 建築佔領進度條（單格建築：主堡）
  private buildingBars = new Map<string, Graphics>()

  // 區域佔領進度條（多格 zone）
  private zoneBars = new Map<string, Graphics>()

  // 特效層（浮動傷害數字 + 攻擊特效）
  private effectLayer!: Container
  private floatTexts: Array<{ text: Text; life: number; maxLife: number }> = []
  private attackFXList: AttackFX[] = []
  private unitFXList:   UnitFX[]   = []

  // 遠程命中延遲（arrow/cannonball 飛行結束後才顯示傷害數字）
  // delay 單位：ms；對應 AttackFX 各 fxType 的 in-flight 比例
  private static readonly RANGED_HIT_DELAY: Partial<Record<string, number>> = {
    arrow:      Math.round(420 * 0.82),   // 344 ms
    cannonball: Math.round(560 * 0.80),   // 448 ms
  }
  private pendingDamage: Array<{
    targetId: string
    x: number
    y: number
    amount: number
    delay: number
  }> = []

  // 選中層
  private selectionLayer!: Container

  // NAMED_ZONES 資料（由外部注入）
  private namedZones: Record<string, HexPos[]> = {}



  // ── Pan 狀態 ─────────────────────────────────────────────────────────────
  private panActive  = false
  private panStartX  = 0
  private panStartY  = 0
  private panOriginX = 0
  private panOriginY = 0
  private didDrag    = false
  private mapPixW    = 0
  private mapPixH    = 0
  // sprite pointerup 比 stage pointerup 先觸發，用此旗標阻止 cell click
  private suppressCellClick = false

  // ── 縮放 ─────────────────────────────────────────────────────────────────
  private zoom = 1.0
  static readonly MIN_ZOOM = 0.5
  static readonly MAX_ZOOM = 2.5
  static readonly ZOOM_STEP = 0.25

  // ── 回呼（由 Vue 層設定） ─────────────────────────────────────────────────
  onSquadClick: (squadId: string) => void = () => {}
  onCellClick:  (pos: HexPos)    => void = () => {}

  // ─────────────────────────────────────────────────────────────────────────

  async init(canvas: HTMLCanvasElement) {
    this.app = new Application()
    await this.app.init({
      canvas,
      width:           canvas.clientWidth  || 800,
      height:          canvas.clientHeight || 500,
      background:      0xede0c8,
      antialias:       true,
      autoDensity:     true,
      resolution:      window.devicePixelRatio || 1,
    })

    // ── 容器層建立 ────────────────────────────────────────────────────────
    this.world          = new Container()
    this.terrainLayer   = new Container()
    this.buildingLayer  = new Container()
    this.selectionLayer = new Container()
    this.squadLayer     = new Container()
    this.uiLayer        = new Container()

    this.effectLayer  = new Container()

    this.squadLayer.sortableChildren = true   // 啟用 zIndex Y-sort

    this.world.addChild(this.terrainLayer)
    this.world.addChild(this.buildingLayer)
    this.world.addChild(this.selectionLayer)
    this.world.addChild(this.squadLayer)
    this.world.addChild(this.effectLayer)
    this.app.stage.addChild(this.world)
    this.app.stage.addChild(this.uiLayer)

    // ── Pan 事件（綁在 stage）────────────────────────────────────────────
    this.app.stage.eventMode = 'static'
    this.app.stage.hitArea   = this.app.screen
    this.app.stage.on('pointerdown',  this.onPointerDown, this)
    this.app.stage.on('pointermove',  this.onPointerMove, this)
    this.app.stage.on('pointerup',    this.onPointerUp,   this)
    this.app.stage.on('pointerupoutside', this.onPointerUp, this)

    // ── 預載所有隊長頭貼，確保 Sprite.from() 在建構子內同步可用 ──────────
    await Assets.load(ALL_PORTRAIT_URLS)

    // ── Ticker：每幀更新所有 sprite 的插值位置 ────────────────────────────
    this.app.ticker.add(this.onTick, this)
  }

  // ── 設定隊長名稱表（供 sprite 顯示文字）─────────────────────────────────

  setCaptainDefs(defs: CaptainDef[]) {
    defs.forEach(d => {
      this.captainNames.set(d.id, d.name)
      this.captainTypes.set(d.id, d.type)
    })
  }

  // ── 建立靜態地形層（只需呼叫一次）──────────────────────────────────────

  buildMap(cells: Record<string, MapCell>, zones: Record<string, ZoneState> = {}) {
    this.terrainLayer.removeChildren()
    this.buildingLayer.removeChildren()
    this.buildingTexts = []
    this.labelTexts = []
    this.buildingBars.clear()
    this.zoneBars.clear()

    const terrainGfx = new Graphics()
    this.terrainLayer.addChild(terrainGfx)

    let maxX = 0
    let maxY = 0

    // 依 r 排序（painter's algorithm：遠的先畫，近的後畫）
    const sortedCells = Object.values(cells).sort((a, b) =>
      a.pos.r !== b.pos.r ? a.pos.r - b.pos.r : a.pos.q - b.pos.q,
    )

    for (const cell of sortedCells) {
      const { x, y } = hexToPixel(cell.pos.q, cell.pos.r)

      if (cell.terrain === 'highGround') {
        // ── 高地擠出（偽 3D）────────────────────────────────────────────
        // 1. 側面（右→底→左，顏色遞暗模擬光影）
        const sides      = hexSideFaces(x, y, HEX_SIZE - 1)
        const sideColors = [0x8a9a50, 0x788840, 0x647030] as const
        sides.forEach((pts, fi) => {
          terrainGfx.poly(pts).fill({ color: sideColors[fi] })
        })
        // 2. 頂面（亮色）
        const topPts = hexElevatedPoints(x, y, HEX_SIZE - 1)
        terrainGfx
          .poly(topPts).fill({ color: 0xd0e878 })
          .poly(topPts).stroke({ color: 0x000000, alpha: 0.15, width: 1 })
      } else {
        // ── 一般地形 ────────────────────────────────────────────────────
        const pts   = hexPolygonPoints(x, y, HEX_SIZE - 1)
        const fill  = TERRAIN_FILL[cell.terrain] ?? 0xaaaaaa
        const alpha = cell.terrain === 'impassable' ? 0.5 : 1.0
        terrainGfx
          .poly(pts).fill({ color: fill, alpha })
          .poly(pts).stroke({ color: 0x000000, alpha: 0.12, width: 1 })
      }

      if (x > maxX) maxX = x
      if (y > maxY) maxY = y

      // 建築圖示
      if (cell.building) {
        const icon = BUILDING_ICON[cell.building.nodeType] ?? '?'
        const label = new Text({
          text: icon,
          style: new TextStyle({ fontSize: 16 * this.zoom }),
        })
        this.buildingTexts.push(label)
        label.anchor.set(0.5, 0.5)
        label.scale.set(1 / this.zoom)
        label.x = x
        label.y = y
        this.buildingLayer.addChild(label)

        // 佔領進度條（barGfx 本地原點 = hex 中心）
        const barGfx = new Graphics()
        barGfx.x = x
        barGfx.y = y
        barGfx.rect(-16, 12, 32, 3).fill({ color: 0x000000, alpha: 0.4 })
        const ratio = cell.building.captureHp / cell.building.maxCaptureHp
        const fillColor = cell.building.team === 'player' ? 0x4488ff
          : cell.building.team === 'enemy' ? 0xff4422
          : 0xaaaaaa
        if (ratio > 0) {
          barGfx.rect(-16, 12, Math.round(32 * ratio), 3).fill({ color: fillColor, alpha: 1 })
        }
        this.buildingLayer.addChild(barGfx)
        this.buildingBars.set(cell.building.buildingId, barGfx)
      }
    }

    // 實際地圖像素尺寸（含邊距）
    this.mapPixW = maxX + HEX_SIZE * 2
    this.mapPixH = maxY + HEX_SIZE * 2

    // ── 區域圖示 + 佔領進度條 ───────────────────────────────────────────────
    for (const zone of Object.values(zones)) {
      // 取所有 zone 格子的像素中心平均
      let sumX = 0, sumY = 0
      for (const zp of zone.cells) {
        const px = hexToPixel(zp.q, zp.r)
        sumX += px.x; sumY += px.y
      }
      const cx = sumX / zone.cells.length
      const cy = sumY / zone.cells.length

      // 圖示
      const icon = BUILDING_ICON[zone.nodeType] ?? '?'
      const iconText = new Text({
        text: icon,
        style: new TextStyle({ fontSize: 16 * this.zoom }),
      })
      iconText.anchor.set(0.5, 0.5)
      iconText.scale.set(1 / this.zoom)
      iconText.x = cx
      iconText.y = cy
      this.buildingTexts.push(iconText)
      this.buildingLayer.addChild(iconText)

      // 佔領進度條（初始為中立灰）
      const barGfx = new Graphics()
      barGfx.x = cx
      barGfx.y = cy
      barGfx.rect(-16, 12, 32, 3).fill({ color: 0x000000, alpha: 0.4 })
      barGfx.rect(-16, 12, 32, 3).fill({ color: 0xaaaaaa, alpha: 1 })
      this.buildingLayer.addChild(barGfx)
      this.zoneBars.set(zone.zoneId, barGfx)
    }

    // ── 地區標籤（永遠顯示）────────────────────────────────────────────────
    for (const lbl of MAP_LABELS) {
      const { x, y } = hexToPixel(lbl.pos.q, lbl.pos.r)
      const t = new Text({
        text: lbl.text,
        style: new TextStyle({
          fontSize:   12 * this.zoom,
          fill:       lbl.color,
          fontWeight: 'bold',
          stroke:     { color: 0x000000, width: 3 },
        }),
      })
      t.anchor.set(0.5, 0.5)
      t.scale.set(1 / this.zoom)
      t.x = x
      t.y = y + HEX_SIZE * 0.55   // 略低於 hex 中心，避開建築圖示
      this.labelTexts.push(t)
      this.buildingLayer.addChild(t)
    }

    // 初始置中
    this.centerMap()
  }

  /** 將 world 置中於當前 canvas，地圖比 canvas 小時置中，大時貼左上 */
  private centerMap() {
    const sw = this.app.screen.width
    const sh = this.app.screen.height
    this.world.x = Math.max(0, (sw - this.mapPixW) / 2)
    this.world.y = Math.max(0, (sh - this.mapPixH) / 2)
  }

  // ── 每 tick 同步引擎狀態 ─────────────────────────────────────────────────

  syncState(state: GameState) {
    // 更新建築佔領進度條
    for (const cell of Object.values(state.cells)) {
      if (!cell.building) continue
      const barGfx = this.buildingBars.get(cell.building.buildingId)
      if (!barGfx) continue
      barGfx.clear()
      barGfx.rect(-16, 12, 32, 3).fill({ color: 0x000000, alpha: 0.4 })
      const ratio = cell.building.captureHp / cell.building.maxCaptureHp
      const fillColor = cell.building.team === 'player' ? 0x4488ff
        : cell.building.team === 'enemy' ? 0xff4422
        : 0xaaaaaa
      if (ratio > 0) {
        barGfx.rect(-16, 12, Math.round(32 * ratio), 3).fill({ color: fillColor, alpha: 1 })
      }
    }

    // 更新區域佔領進度條
    for (const [zoneId, zone] of Object.entries(state.zones)) {
      const barGfx = this.zoneBars.get(zoneId)
      if (!barGfx) continue
      barGfx.clear()
      barGfx.rect(-16, 12, 32, 3).fill({ color: 0x000000, alpha: 0.4 })
      const ratio = zone.captureHp / zone.maxCaptureHp
      const fillColor = zone.team === 'player' ? 0x4488ff
        : zone.team === 'enemy' ? 0xff4422
        : 0xaaaaaa
      if (ratio > 0) {
        barGfx.rect(-16, 12, Math.round(32 * ratio), 3).fill({ color: fillColor, alpha: 1 })
      }
    }

    // 處理戰鬥事件：攻擊特效 + 浮動傷害數字 + 受擊 flash
    for (const event of state.events) {
      if (event.type === 'death') {
        const { x, y } = hexToPixel(event.pos.q, event.pos.r)
        const fx = new UnitFX('death', x, y)
        this.effectLayer.addChild(fx)
        this.unitFXList.push(fx)
      }
      if (event.type === 'revive') {
        const sprite = this.squadSprites.get(event.squadId)
        if (sprite) {
          const { x, y } = hexToPixel(event.pos.q, event.pos.r)
          sprite.teleport(x, y)
        }
        const { x, y } = hexToPixel(event.pos.q, event.pos.r)
        const fx = new UnitFX('revive', x, y)
        this.effectLayer.addChild(fx)
        this.unitFXList.push(fx)
      }
      if (event.type === 'spawn') {
        const { x, y } = hexToPixel(event.pos.q, event.pos.r)
        const fx = new UnitFX('spawn', x, y)
        this.effectLayer.addChild(fx)
        this.unitFXList.push(fx)
      }
      if (event.type === 'attack') {
        const from = hexToPixel(event.fromPos.q, event.fromPos.r)
        const to   = hexToPixel(event.toPos.q,   event.toPos.r)
        const fx   = new AttackFX(event.fxType, from.x, from.y, to.x, to.y)
        this.effectLayer.addChild(fx)
        this.attackFXList.push(fx)
      }
      if (event.type === 'sp_skill') {
        const { x, y } = hexToPixel(event.pos.q, event.pos.r)
        this.showSkillName(x, y, event.skillName)
        this.squadSprites.get(event.squadId)?.flash()
      }
      if (event.type === 'damage') {
        const { x, y } = hexToPixel(event.pos.q, event.pos.r)
        // 尋找是否有飛行中的遠程攻擊命中同一個目標
        const matchingAttack = state.events.find(
          e => e.type === 'attack' &&
          e.toPos.q === event.pos.q && e.toPos.r === event.pos.r &&
          PixiHexRenderer.RANGED_HIT_DELAY[e.fxType] !== undefined
        )
        if (matchingAttack && matchingAttack.type === 'attack') {
          // 遠程命中：延遲顯示
          const delay = PixiHexRenderer.RANGED_HIT_DELAY[matchingAttack.fxType]!
          this.pendingDamage.push({ targetId: event.targetId, x, y, amount: event.amount, delay })
        } else {
          // 近戰：立即顯示
          this.showDamageNumber(x, y, event.amount)
          this.squadSprites.get(event.targetId)?.flash()
        }
      }
    }

    for (const squad of Object.values(state.squads)) {
      let sprite = this.squadSprites.get(squad.squadId)

      if (!sprite) {
        const name = this.captainNames.get(squad.captainDefId) ?? squad.captainDefId
        const type = this.captainTypes.get(squad.captainDefId) ?? 'infantry'
        sprite = new SquadSprite(squad, name, type)
        // pointerup 先於 stage 的 pointerup 觸發，設旗標阻止 cell click
        sprite.on('pointerup', () => { this.suppressCellClick = true })
        sprite.on('pointertap', () => {
          if (!this.didDrag) this.onSquadClick(squad.squadId)
        })
        this.squadSprites.set(squad.squadId, sprite)
        this.squadLayer.addChild(sprite)
      }

      const cell       = state.cells[hexKey(squad.pos)]
      const elevOffset = cell?.terrain === 'highGround' ? ELEVATION : 0
      sprite.sync(squad, elevOffset)
    }

    // 移除已不存在的 sprite（關卡重置等情況）
    for (const [id, sprite] of this.squadSprites) {
      if (!state.squads[id]) {
        this.squadLayer.removeChild(sprite)
        this.squadSprites.delete(id)
      }
    }
  }

  // ── 選中某小隊（視覺高亮）────────────────────────────────────────────────

  setSelectedSquad(squadId: string | null) {
    for (const [id, sprite] of this.squadSprites) {
      sprite.setSelected(id === squadId)
    }
  }

  // ── 縮放（以螢幕中央為錨點）──────────────────────────────────────────────

  setZoom(newZoom: number) {
    newZoom = Math.max(PixiHexRenderer.MIN_ZOOM, Math.min(PixiHexRenderer.MAX_ZOOM, newZoom))
    const sw = this.app.screen.width
    const sh = this.app.screen.height
    const cx = (sw / 2 - this.world.x) / this.zoom
    const cy = (sh / 2 - this.world.y) / this.zoom
    this.zoom = newZoom
    this.world.scale.set(newZoom)
    this.world.x = this.clampX(sw / 2 - cx * newZoom)
    this.world.y = this.clampY(sh / 2 - cy * newZoom)

    // Text 用高 fontSize + 反向 scale 保持清晰（Graphics 放大不模糊，只有 Text 需要）
    const invZ = 1 / newZoom
    for (const t of this.buildingTexts) {
      t.style.fontSize = 16 * newZoom
      t.scale.set(invZ)
    }
    for (const t of this.labelTexts) {
      t.style.fontSize = 12 * newZoom
      t.scale.set(invZ)
    }
    for (const sprite of this.squadSprites.values()) {
      sprite.onZoomChange(newZoom)
    }
  }

  getZoom() { return this.zoom }

  // ── Resize（Vue 層的 ResizeObserver 呼叫）────────────────────────────────

  resize(w: number, h: number) {
    this.app.renderer.resize(w, h)
    this.app.stage.hitArea = this.app.screen
    const scaledW = this.mapPixW * this.zoom
    const scaledH = this.mapPixH * this.zoom
    if (scaledW < w) this.world.x = (w - scaledW) / 2
    if (scaledH < h) this.world.y = (h - scaledH) / 2
  }

  // ── NAMED_ZONES 注入 ────────────────────────────────────────────────────

  setNamedZones(zones: Record<string, HexPos[]>) {
    this.namedZones = zones
  }

  // ── 顯示小隊選中覆蓋層 ──────────────────────────────────────────────────

  showSquadSelection(
    squad: { pos: HexPos; team: string; aiConfig: { alertRange: number; route: string } },
    cells: Record<string, MapCell>,
    lanes: LaneDef[] = [],
    clickableZones: Array<{ id: string; label: string; route: string; cells: HexPos[] }> = [],
  ) {
    this.selectionLayer.removeChildren()

    // 警戒圈
    const alertGfx = new Graphics()
    const alertColor = squad.team === 'player' ? 0x4488ff : 0xff4422
    const alertAlpha = squad.team === 'player' ? 0.18 : 0.15

    for (const cell of Object.values(cells)) {
      const dist = hexDistance(squad.pos, cell.pos)
      if (dist <= squad.aiConfig.alertRange) {
        const { x, y } = hexToPixel(cell.pos.q, cell.pos.r)
        const pts = hexPolygonPoints(x, y, HEX_SIZE - 1)
        alertGfx.poly(pts).fill({ color: alertColor, alpha: alertAlpha })
      }
    }
    this.selectionLayer.addChild(alertGfx)

    // 可點選佔點高亮（讓玩家知道點哪裡可以改路線）
    if (clickableZones.length > 0) {
      const zoneGfx = new Graphics()
      for (const zone of clickableZones) {
        const isActive = zone.route === squad.aiConfig.route
        const color  = isActive ? 0x4488ff : 0xffcc44
        const alpha  = isActive ? 0.35 : 0.28
        for (const zp of zone.cells) {
          const { x, y } = hexToPixel(zp.q, zp.r)
          const pts = hexPolygonPoints(x, y, HEX_SIZE - 1)
          zoneGfx.poly(pts).fill({ color, alpha })
          zoneGfx.poly(pts).stroke({ color, alpha: isActive ? 0.9 : 0.6, width: 2 })
        }
      }
      this.selectionLayer.addChild(zoneGfx)
    }

    // 路由虛線（從 lanes 讀，不寫死）
    const laneDef = lanes.find(l => l.id === squad.aiConfig.route)
    const seq = laneDef?.sequence ?? []
    if (seq.length > 0) {
      // 節點：小隊當前位置 + 各 zone 中心
      const nodes: { x: number; y: number }[] = []
      const startPx = hexToPixel(squad.pos.q, squad.pos.r)
      nodes.push(startPx)

      for (const zoneName of seq) {
        const zoneCells = this.namedZones[zoneName]
        if (!zoneCells || zoneCells.length === 0) continue
        let sumX = 0
        let sumY = 0
        for (const zp of zoneCells) {
          const px = hexToPixel(zp.q, zp.r)
          sumX += px.x
          sumY += px.y
        }
        nodes.push({ x: sumX / zoneCells.length, y: sumY / zoneCells.length })
      }

      // 畫虛線（每 10px 一個圓點）
      if (nodes.length >= 2) {
        const dotGfx = new Graphics()
        for (let ni = 0; ni < nodes.length - 1; ni++) {
          const from = nodes[ni]
          const to   = nodes[ni + 1]
          const dx = to.x - from.x
          const dy = to.y - from.y
          const len = Math.sqrt(dx * dx + dy * dy)
          const steps = Math.floor(len / 10)
          for (let s = 0; s <= steps; s++) {
            const t = steps === 0 ? 0 : s / steps
            const cx = from.x + dx * t
            const cy = from.y + dy * t
            dotGfx.circle(cx, cy, 2.5).fill({ color: 0xffffff, alpha: 0.75 })
          }
        }
        this.selectionLayer.addChild(dotGfx)

        // 菱形標記（從第二個節點開始，即各 zone 中心）
        const diamondGfx = new Graphics()
        for (let ni = 1; ni < nodes.length; ni++) {
          const { x: cx, y: cy } = nodes[ni]
          const half = 4 // 邊長8/2
          // 旋轉45°的正方形 = 菱形，頂點在上下左右
          diamondGfx
            .poly([cx, cy - half * Math.SQRT2, cx + half * Math.SQRT2, cy, cx, cy + half * Math.SQRT2, cx - half * Math.SQRT2, cy])
            .fill({ color: 0xffffff, alpha: 0.9 })
        }
        this.selectionLayer.addChild(diamondGfx)
      }
    }
  }

  // ── SP 技能名稱浮字（金色大字，持續較久）────────────────────────────────

  private showSkillName(x: number, y: number, name: string) {
    const floatText = new Text({
      text: `✨ ${name}`,
      style: new TextStyle({
        fontSize:   16 * this.zoom,
        fill:       0xffcc00,
        fontWeight: 'bold',
        stroke:     { color: 0x4a2800, width: 4 },
      }),
    })
    floatText.anchor.set(0.5, 1)
    floatText.scale.set(1 / this.zoom)
    floatText.x = x
    floatText.y = y - 36
    this.effectLayer.addChild(floatText)
    this.floatTexts.push({ text: floatText, life: 1600, maxLife: 1600 })
  }

  // ── 浮動傷害數字（近戰直接呼叫；遠程由 pendingDamage 延遲呼叫）─────────

  private showDamageNumber(x: number, y: number, amount: number) {
    const floatText = new Text({
      text: `-${amount}`,
      style: new TextStyle({
        fontSize:   13 * this.zoom,
        fill:       0xff3333,
        fontWeight: 'bold',
        stroke:     { color: 0x000000, width: 3 },
      }),
    })
    floatText.anchor.set(0.5, 1)
    floatText.scale.set(1 / this.zoom)
    floatText.x = x + (Math.random() - 0.5) * 16
    floatText.y = y - 22
    this.effectLayer.addChild(floatText)
    this.floatTexts.push({ text: floatText, life: 900, maxLife: 900 })
  }

  // ── 清除選中覆蓋層 ───────────────────────────────────────────────────────

  clearSquadSelection() {
    this.selectionLayer.removeChildren()
  }

  // ── World → Screen 座標轉換 ──────────────────────────────────────────────

  worldToScreen(worldX: number, worldY: number) {
    return {
      x: worldX * this.zoom + this.world.x,
      y: worldY * this.zoom + this.world.y,
    }
  }

  // ── 銷毀 ────────────────────────────────────────────────────────────────

  destroy() {
    this.app.ticker.remove(this.onTick, this)
    this.app.destroy()
  }

  // ─── Ticker 回呼（60fps）─────────────────────────────────────────────────

  private onTick(ticker: Ticker) {
    for (const sprite of this.squadSprites.values()) {
      sprite.update(ticker.deltaMS)
      sprite.zIndex = sprite.y   // Y-sort：y 越大（越靠前）越晚畫
    }
    if (this.squadLayer.children.length > 1) {
      this.squadLayer.sortChildren()
    }
    for (const ft of this.floatTexts) {
      ft.text.y -= 28 * ticker.deltaMS / 1000
      ft.life -= ticker.deltaMS
      ft.text.alpha = Math.max(0, ft.life / ft.maxLife)
    }
    for (const ft of this.floatTexts.filter(f => f.life <= 0)) {
      this.effectLayer.removeChild(ft.text)
    }
    this.floatTexts = this.floatTexts.filter(f => f.life > 0)

    // 單位特效（死亡 / 復活 / 入場）
    const nextUnitFX: UnitFX[] = []
    for (const fx of this.unitFXList) {
      if (fx.tick(ticker.deltaMS)) {
        this.effectLayer.removeChild(fx)
        fx.destroy()
      } else {
        nextUnitFX.push(fx)
      }
    }
    this.unitFXList = nextUnitFX

    // 攻擊特效
    const nextFXList: AttackFX[] = []
    for (const fx of this.attackFXList) {
      if (fx.tick(ticker.deltaMS)) {
        this.effectLayer.removeChild(fx)
        fx.destroy()
      } else {
        nextFXList.push(fx)
      }
    }
    this.attackFXList = nextFXList

    // 遠程命中延遲（倒數到 0 → 顯示傷害數字 + flash）
    const nextPending: typeof this.pendingDamage = []
    for (const pd of this.pendingDamage) {
      pd.delay -= ticker.deltaMS
      if (pd.delay <= 0) {
        this.showDamageNumber(pd.x, pd.y, pd.amount)
        this.squadSprites.get(pd.targetId)?.flash()
      } else {
        nextPending.push(pd)
      }
    }
    this.pendingDamage = nextPending
  }

  // ─── Pan 指標事件 ────────────────────────────────────────────────────────

  private onPointerDown(e: { global: { x: number; y: number } }) {
    this.panActive  = true
    this.panStartX  = e.global.x
    this.panStartY  = e.global.y
    this.panOriginX = this.world.x
    this.panOriginY = this.world.y
    this.didDrag    = false
  }

  private onPointerMove(e: { global: { x: number; y: number } }) {
    if (!this.panActive) return
    const dx = e.global.x - this.panStartX
    const dy = e.global.y - this.panStartY

    if (!this.didDrag && (Math.abs(dx) > TAP_THRESHOLD || Math.abs(dy) > TAP_THRESHOLD)) {
      this.didDrag = true
    }
    if (!this.didDrag) return

    this.world.x = this.clampX(this.panOriginX + dx)
    this.world.y = this.clampY(this.panOriginY + dy)
  }

  private onPointerUp(e: { global: { x: number; y: number } }) {
    if (!this.panActive) return
    this.panActive = false

    // sprite pointerup 已提前設旗標 → 跳過 cell click
    const suppressed = this.suppressCellClick
    this.suppressCellClick = false

    if (!this.didDrag && !suppressed) {
      const worldX = (e.global.x - this.world.x) / this.zoom
      const worldY = (e.global.y - this.world.y) / this.zoom
      const pos    = pixelToHex(worldX, worldY)
      this.onCellClick(pos)
    }
  }

  // ── Pan 邊界 clamp（含縮放）─────────────────────────────────────────────

  private clampX(x: number): number {
    const sw = this.app.screen.width
    const scaledW = this.mapPixW * this.zoom
    if (scaledW <= sw) return (sw - scaledW) / 2   // 地圖比視窗小 → 置中
    return Math.min(0, Math.max(sw - scaledW, x))
  }

  private clampY(y: number): number {
    const sh = this.app.screen.height
    const scaledH = this.mapPixH * this.zoom
    if (scaledH <= sh) return (sh - scaledH) / 2
    return Math.min(0, Math.max(sh - scaledH, y))
  }
}

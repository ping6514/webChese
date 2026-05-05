import type { MapCell, HexPos, TerrainType, ZoneState, LaneDef, MapTemplate } from './types'
import { hexKey } from './types'

// ─── 地圖尺寸 ─────────────────────────────────────────────────────────────────
// q: 0-15（16 欄），r: 0-14（15 行）
// r=0, r=14：不可通行牆壁
// 三條路線（r=2, r=7, r=12）

export const MAP_COLS = 16
export const MAP_ROWS = 15
export const LANE_ROWS = { top: 2, mid: 7, bottom: 12 } as const

// ─── 地圖模板資訊（供 UI 顯示）───────────────────────────────────────────────

export type MapTemplateInfo = {
  id:       MapTemplate
  label:    string
  icon:     string
  desc:     string
  maxTicks: number
}

export const MAP_TEMPLATES: MapTemplateInfo[] = [
  {
    id: 'standard', label: '標準戰場', icon: '⚔️',
    desc: '三路推進，稀疏地形，兼顧攻守',
    maxTicks: 5400,
  },
  {
    id: 'fortress', label: '要塞戰場', icon: '🏰',
    desc: '每路兩個佔點，需逐步突破，戰事綿長',
    maxTicks: 6600,
  },
  {
    id: 'jungle', label: '密林戰場', icon: '🌿',
    desc: '密集森林阻礙視野與移速，拉鋸為主',
    maxTicks: 5400,
  },
  {
    id: 'blitz', label: '閃擊戰場', icon: '⚡',
    desc: '開闊地形，佔點更近，快速決勝負',
    maxTicks: 3600,
  },
]

export function getTemplateInfo(template: MapTemplate): MapTemplateInfo {
  return MAP_TEMPLATES.find(t => t.id === template)!
}

// ─── 內部輔助型別 ─────────────────────────────────────────────────────────────

type ZoneDef = {
  zoneId:    string
  nodeType:  ZoneState['nodeType']
  captureHp: number
  cells:     HexPos[]
}

// ─── 底層地圖（牆壁 + 主堡，所有模板共享）────────────────────────────────────

function buildBaseMap(): Record<string, MapCell> {
  const cells: Record<string, MapCell> = {}
  for (let q = 0; q < MAP_COLS; q++) {
    for (let r = 0; r < MAP_ROWS; r++) {
      const pos: HexPos = { q, r }
      const key = hexKey(pos)

      if (r === 0 || r === MAP_ROWS - 1) {
        cells[key] = { pos, terrain: 'impassable', passable: false }
        continue
      }
      if (q === 0 && r >= 2 && r <= 12) {
        cells[key] = {
          pos, terrain: 'normal', passable: true,
          building: { buildingId: 'player_base', nodeType: 'playerBase', team: 'player',
            captureHp: 1000, maxCaptureHp: 1000, hp: 1000, maxHp: 1000 },
        }
        continue
      }
      if (q === 15 && r >= 2 && r <= 12) {
        cells[key] = {
          pos, terrain: 'normal', passable: true,
          building: { buildingId: 'enemy_base', nodeType: 'enemyBase', team: 'enemy',
            captureHp: 1000, maxCaptureHp: 1000, hp: 1000, maxHp: 1000 },
        }
        continue
      }
      cells[key] = { pos, terrain: 'normal', passable: true }
    }
  }
  return cells
}

// ─── 套用地形 ─────────────────────────────────────────────────────────────────

function applyTerrain(
  cells: Record<string, MapCell>,
  patches: { pos: HexPos; terrain: TerrainType }[]
) {
  for (const { pos, terrain } of patches) {
    const key = hexKey(pos)
    const c = cells[key]
    if (c && c.passable && !c.building) cells[key] = { ...c, terrain }
  }
}

// ─── 套用佔領區 ───────────────────────────────────────────────────────────────

function applyZoneCells(
  cells: Record<string, MapCell>,
  zones: ZoneDef[]
) {
  for (const z of zones) {
    for (const pos of z.cells) {
      const key = hexKey(pos)
      const c = cells[key]
      if (c && !c.building) cells[key] = { ...c, zoneId: z.zoneId }
    }
  }
}

// ─── 快速產生地形列表的輔助 ──────────────────────────────────────────────────

function terrainRect(
  qs: number[], rs: number[], terrain: TerrainType
): { pos: HexPos; terrain: TerrainType }[] {
  const out: { pos: HexPos; terrain: TerrainType }[] = []
  for (const q of qs) for (const r of rs) out.push({ pos: { q, r }, terrain })
  return out
}

function range(from: number, to: number): number[] {
  const arr: number[] = []
  for (let i = from; i <= to; i++) arr.push(i)
  return arr
}

// ─── ① 標準戰場 ──────────────────────────────────────────────────────────────
// 三路 + 稀疏高地 / 森林

function buildStandard() {
  const cells = buildBaseMap()

  const terrain: { pos: HexPos; terrain: TerrainType }[] = [
    // 高地：上路、下路前後段
    ...terrainRect([3],  [2, 3],   'highGround'),
    ...terrainRect([3],  [11, 12], 'highGround'),
    ...terrainRect([12], [2, 3],   'highGround'),
    ...terrainRect([12], [11, 12], 'highGround'),
    // 森林：中段屏障
    ...terrainRect([5],  range(3, 5),  'forest'),
    ...terrainRect([5],  range(9, 11), 'forest'),
    ...terrainRect([10], range(3, 5),  'forest'),
    ...terrainRect([10], range(9, 11), 'forest'),
  ]
  applyTerrain(cells, terrain)

  const zones: ZoneDef[] = [
    { zoneId: 'outpost_top', nodeType: 'outpost', captureHp: 500, cells: [{q:6,r:2},{q:7,r:2}] },
    { zoneId: 'outpost_mid', nodeType: 'outpost', captureHp: 500, cells: [{q:7,r:7},{q:8,r:7}] },
    { zoneId: 'outpost_bot', nodeType: 'outpost', captureHp: 500, cells: [{q:6,r:12},{q:7,r:12}] },
  ]
  applyZoneCells(cells, zones)

  const lanes: LaneDef[] = [
    { id: 'top',    label: '上路', row: LANE_ROWS.top,
      sequence: ['outpost_top', 'enemy_base'] },
    { id: 'mid',    label: '中路', row: LANE_ROWS.mid,
      sequence: ['outpost_mid', 'enemy_base'] },
    { id: 'bottom', label: '下路', row: LANE_ROWS.bottom,
      sequence: ['outpost_bot', 'enemy_base'] },
    // 跨路路線
    { id: 'cross_top_mid', label: '上→中', row: LANE_ROWS.mid,
      waypoints: [{ q: 7, r: LANE_ROWS.top }, { q: 9, r: 5 }],
      sequence: ['outpost_top', 'outpost_mid', 'enemy_base'] },
    { id: 'cross_bot_mid', label: '下→中', row: LANE_ROWS.mid,
      waypoints: [{ q: 7, r: LANE_ROWS.bottom }, { q: 9, r: 9 }],
      sequence: ['outpost_bot', 'outpost_mid', 'enemy_base'] },
  ]

  const initialZones = buildZoneStates(zones)
  return { cells, zones: initialZones, lanes }
}

// ─── ② 要塞戰場 ──────────────────────────────────────────────────────────────
// 三路各兩個佔點（近+遠），高地廣泛，森林稀疏

function buildFortress() {
  const cells = buildBaseMap()

  const terrain: { pos: HexPos; terrain: TerrainType }[] = [
    // 廣泛高地：前後段翼側
    ...terrainRect([2, 3], [2, 3],   'highGround'),
    ...terrainRect([2, 3], [11, 12], 'highGround'),
    ...terrainRect([12, 13], [2, 3],   'highGround'),
    ...terrainRect([12, 13], [11, 12], 'highGround'),
    // 少量森林（中間隔離帶）
    ...terrainRect([6],  [4, 5],  'forest'),
    ...terrainRect([6],  [9, 10], 'forest'),
    ...terrainRect([9],  [4, 5],  'forest'),
    ...terrainRect([9],  [9, 10], 'forest'),
  ]
  applyTerrain(cells, terrain)

  // 近端佔點（q=4-5）+ 遠端佔點（q=10-11）
  const zones: ZoneDef[] = [
    { zoneId: 'outpost_top',  nodeType: 'outpost', captureHp: 400, cells: [{q:4,r:2},{q:5,r:2}] },
    { zoneId: 'outpost_mid',  nodeType: 'outpost', captureHp: 400, cells: [{q:4,r:7},{q:5,r:7}] },
    { zoneId: 'outpost_bot',  nodeType: 'outpost', captureHp: 400, cells: [{q:4,r:12},{q:5,r:12}] },
    { zoneId: 'dungeon_top',  nodeType: 'outpost', captureHp: 400, cells: [{q:10,r:2},{q:11,r:2}] },
    { zoneId: 'dungeon_mid',  nodeType: 'outpost', captureHp: 400, cells: [{q:10,r:7},{q:11,r:7}] },
    { zoneId: 'dungeon_bot',  nodeType: 'outpost', captureHp: 400, cells: [{q:10,r:12},{q:11,r:12}] },
  ]
  applyZoneCells(cells, zones)

  const lanes: LaneDef[] = [
    { id: 'top',    label: '上路', row: LANE_ROWS.top,
      sequence: ['outpost_top', 'dungeon_top', 'enemy_base'] },
    { id: 'mid',    label: '中路', row: LANE_ROWS.mid,
      sequence: ['outpost_mid', 'dungeon_mid', 'enemy_base'] },
    { id: 'bottom', label: '下路', row: LANE_ROWS.bottom,
      sequence: ['outpost_bot', 'dungeon_bot', 'enemy_base'] },
  ]

  return { cells, zones: buildZoneStates(zones), lanes }
}

// ─── ③ 密林戰場 ──────────────────────────────────────────────────────────────
// 大範圍森林（非路線格），佔點在地圖中央，無高地

function buildJungle() {
  const cells = buildBaseMap()

  // 密集森林：q=3-5 和 q=10-12，r=3-6 和 r=8-11
  // 刻意避開路線行（r=2,7,12）和主堡列
  const forestR1 = range(3, 6)
  const forestR2 = range(8, 11)
  const terrain: { pos: HexPos; terrain: TerrainType }[] = [
    ...terrainRect([3, 4, 5], forestR1, 'forest'),
    ...terrainRect([3, 4, 5], forestR2, 'forest'),
    ...terrainRect([10, 11, 12], forestR1, 'forest'),
    ...terrainRect([10, 11, 12], forestR2, 'forest'),
  ]
  applyTerrain(cells, terrain)

  // 佔點在更偏中央（q=7-8），戰鬥在地圖核心
  const zones: ZoneDef[] = [
    { zoneId: 'outpost_top', nodeType: 'outpost', captureHp: 500, cells: [{q:7,r:2},{q:8,r:2}] },
    { zoneId: 'outpost_mid', nodeType: 'outpost', captureHp: 500, cells: [{q:7,r:7},{q:8,r:7}] },
    { zoneId: 'outpost_bot', nodeType: 'outpost', captureHp: 500, cells: [{q:7,r:12},{q:8,r:12}] },
  ]
  applyZoneCells(cells, zones)

  const lanes: LaneDef[] = [
    { id: 'top',    label: '上路', row: LANE_ROWS.top,
      sequence: ['outpost_top', 'enemy_base'] },
    { id: 'mid',    label: '中路', row: LANE_ROWS.mid,
      sequence: ['outpost_mid', 'enemy_base'] },
    { id: 'bottom', label: '下路', row: LANE_ROWS.bottom,
      sequence: ['outpost_bot', 'enemy_base'] },
  ]

  return { cells, zones: buildZoneStates(zones), lanes }
}

// ─── ④ 閃擊戰場 ──────────────────────────────────────────────────────────────
// 無地形障礙，佔點更近，快速決勝

function buildBlitz() {
  const cells = buildBaseMap()
  // 不套用任何地形

  // 佔點更靠近玩家側（q=5-6），推進壓力更快
  const zones: ZoneDef[] = [
    { zoneId: 'outpost_top', nodeType: 'outpost', captureHp: 300, cells: [{q:5,r:2},{q:6,r:2}] },
    { zoneId: 'outpost_mid', nodeType: 'outpost', captureHp: 300, cells: [{q:5,r:7},{q:6,r:7}] },
    { zoneId: 'outpost_bot', nodeType: 'outpost', captureHp: 300, cells: [{q:5,r:12},{q:6,r:12}] },
  ]
  applyZoneCells(cells, zones)

  const lanes: LaneDef[] = [
    { id: 'top',    label: '上路', row: LANE_ROWS.top,
      sequence: ['outpost_top', 'enemy_base'] },
    { id: 'mid',    label: '中路', row: LANE_ROWS.mid,
      sequence: ['outpost_mid', 'enemy_base'] },
    { id: 'bottom', label: '下路', row: LANE_ROWS.bottom,
      sequence: ['outpost_bot', 'enemy_base'] },
  ]

  return { cells, zones: buildZoneStates(zones), lanes }
}

// ─── ZoneDef → ZoneState 轉換 ────────────────────────────────────────────────

function buildZoneStates(zones: ZoneDef[]): Record<string, ZoneState> {
  const result: Record<string, ZoneState> = {}
  for (const z of zones) {
    result[z.zoneId] = {
      zoneId:       z.zoneId,
      nodeType:     z.nodeType,
      team:         'neutral',
      captureHp:    z.captureHp,
      maxCaptureHp: z.captureHp,
      cells:        z.cells,
    }
  }
  return result
}

// ─── 主入口 ───────────────────────────────────────────────────────────────────

export function createMap(template: MapTemplate = 'standard'): {
  cells: Record<string, MapCell>
  zones: Record<string, ZoneState>
  lanes: LaneDef[]
} {
  switch (template) {
    case 'fortress': return buildFortress()
    case 'jungle':   return buildJungle()
    case 'blitz':    return buildBlitz()
    default:         return buildStandard()
  }
}

// ─── 向後相容（gameStore 舊呼叫仍可用）──────────────────────────────────────
export const createTestMap     = () => createMap('standard').cells
export const createInitialZones = () => createMap('standard').zones
export const createDefaultLanes = () => createMap('standard').lanes

// ─── 命名區域（標準地圖 renderer overlay 用，不隨模板改變）─────────────────
export const NAMED_ZONES: Record<string, HexPos[]> = {
  player_base:   [{ q: 1, r: 2 }, { q: 1, r: 7 }, { q: 1, r: 12 }],
  front_upper:   [{ q: 3, r: 2 }],
  outpost_top:   [{ q: 6, r: 2 }, { q: 7, r: 2 }],
  dungeon_upper: [{ q: 11, r: 2 }],
  front_mid:     [{ q: 3, r: 7 }],
  outpost_mid:   [{ q: 7, r: 7 }, { q: 8, r: 7 }],
  dungeon_mid:   [{ q: 11, r: 7 }],
  front_lower:   [{ q: 3, r: 12 }],
  outpost_bot:   [{ q: 6, r: 12 }, { q: 7, r: 12 }],
  dungeon_lower: [{ q: 11, r: 12 }],
  enemy_base:    [{ q: 14, r: 2 }, { q: 14, r: 7 }, { q: 14, r: 12 }],
}

// ─── 玩家可點選的目標區域（標準地圖，renderer + UI 互動用）─────────────────
export const CLICKABLE_ZONES: {
  id:    string
  label: string
  route: 'top' | 'mid' | 'bottom'
  cells: HexPos[]
}[] = [
  { id: 'outpost_top', label: '上路佔點', route: 'top',    cells: NAMED_ZONES.outpost_top },
  { id: 'outpost_mid', label: '中路佔點', route: 'mid',    cells: NAMED_ZONES.outpost_mid },
  { id: 'outpost_bot', label: '下路佔點', route: 'bottom', cells: NAMED_ZONES.outpost_bot },
  { id: 'enemy_base',  label: '敵方基地', route: 'mid',    cells: NAMED_ZONES.enemy_base  },
]

// ─── 地圖標籤（renderer 永久顯示）───────────────────────────────────────────
export const MAP_LABELS: { pos: HexPos; text: string; color: number }[] = [
  { pos: { q: 0,  r: 7  }, text: '我方基地', color: 0x4488ff },
  { pos: { q: 6,  r: 2  }, text: '上路佔點', color: 0xffcc44 },
  { pos: { q: 7,  r: 7  }, text: '中路佔點', color: 0xffcc44 },
  { pos: { q: 6,  r: 12 }, text: '下路佔點', color: 0xffcc44 },
  { pos: { q: 15, r: 7  }, text: '敵方基地', color: 0xff6644 },
]

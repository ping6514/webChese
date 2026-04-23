import type { MapCell, HexPos, TerrainType, ZoneState, LaneDef } from './types'
import { hexKey } from './types'

// ─── 地圖尺寸 ────────────────────────────────────────────────────────────────
// q: 0-15（16 欄），r: 0-14（15 行）
// r=0, r=14：不可通行牆壁
// 三條路線（r=2, r=7, r=12）垂直間距 5 格，感覺寬闊
//
// 佔領點：上路 q=6-7,r=2 / 中路 q=7-8,r=7 / 下路 q=6-7,r=12
// 玩家基地：q=0, r=2~12 / 敵方基地：q=15, r=2~12

export const MAP_COLS = 16
export const MAP_ROWS = 15

// 主要路線行號
export const LANE_ROWS = { top: 2, mid: 7, bottom: 12 } as const

export function createTestMap(): Record<string, MapCell> {
  const cells: Record<string, MapCell> = {}

  for (let q = 0; q <= MAP_COLS - 1; q++) {
    for (let r = 0; r <= MAP_ROWS - 1; r++) {
      const pos: HexPos = { q, r }
      const key = hexKey(pos)

      // 上下邊界
      if (r === 0 || r === MAP_ROWS - 1) {
        cells[key] = { pos, terrain: 'impassable', passable: false }
        continue
      }

      // ── 玩家主堡（q=0, r=2~12）──────────────────────────────────────────
      if (q === 0 && r >= 2 && r <= 12) {
        cells[key] = {
          pos, terrain: 'normal', passable: true,
          building: {
            buildingId: 'player_base',
            nodeType:   'playerBase',
            team:       'player',
            captureHp: 200, maxCaptureHp: 200,
            hp: 1000, maxHp: 1000,
          },
        }
        continue
      }

      // ── 敵方主堡（q=15, r=2~12）─────────────────────────────────────────
      if (q === 15 && r >= 2 && r <= 12) {
        cells[key] = {
          pos, terrain: 'normal', passable: true,
          building: {
            buildingId: 'enemy_base',
            nodeType:   'enemyBase',
            team:       'enemy',
            captureHp: 200, maxCaptureHp: 200,
            hp: 1000, maxHp: 1000,
          },
        }
        continue
      }

      // ── 中立佔領點：上路（q=6-7, r=2）──────────────────────────────────
      if ((q === 6 || q === 7) && r === LANE_ROWS.top) {
        cells[key] = { pos, terrain: 'normal', passable: true, zoneId: 'outpost_top' }
        continue
      }

      // ── 中立佔領點：中路（q=7-8, r=7）──────────────────────────────────
      if ((q === 7 || q === 8) && r === LANE_ROWS.mid) {
        cells[key] = { pos, terrain: 'normal', passable: true, zoneId: 'outpost_mid' }
        continue
      }

      // ── 中立佔領點：下路（q=6-7, r=12）─────────────────────────────────
      if ((q === 6 || q === 7) && r === LANE_ROWS.bottom) {
        cells[key] = { pos, terrain: 'normal', passable: true, zoneId: 'outpost_bot' }
        continue
      }

      // ── 地形 ─────────────────────────────────────────────────────────────
      let terrain: TerrainType = 'normal'

      // 高地：上路和下路前段（玩家側）
      if (q === 3 && (r === 2 || r === 3)) terrain = 'highGround'
      if (q === 3 && (r === 11 || r === 12)) terrain = 'highGround'
      // 高地：上路和下路後段（敵方側）
      if (q === 12 && (r === 2 || r === 3)) terrain = 'highGround'
      if (q === 12 && (r === 11 || r === 12)) terrain = 'highGround'

      // 森林：中段屏障（製造繞路壓力，讓路線分明）
      if (q === 5 && (r >= 3 && r <= 5)) terrain = 'forest'
      if (q === 5 && (r >= 9 && r <= 11)) terrain = 'forest'
      if (q === 10 && (r >= 3 && r <= 5)) terrain = 'forest'
      if (q === 10 && (r >= 9 && r <= 11)) terrain = 'forest'

      cells[key] = { pos, terrain, passable: true }
    }
  }

  return cells
}

// ─── 命名區域（供 AI 路線 + 玩家指令使用）──────────────────────────────────
export const NAMED_ZONES: Record<string, HexPos[]> = {
  // 玩家出生區
  player_base: [{ q: 1, r: 2 }, { q: 1, r: 7 }, { q: 1, r: 12 }],

  // 上路
  front_upper:   [{ q: 3, r: 2 }],
  outpost_top:   [{ q: 6, r: 2 }, { q: 7, r: 2 }],
  dungeon_upper: [{ q: 11, r: 2 }],

  // 中路
  front_mid:    [{ q: 3, r: 7 }],
  outpost_mid:  [{ q: 7, r: 7 }, { q: 8, r: 7 }],
  dungeon_mid:  [{ q: 11, r: 7 }],

  // 下路
  front_lower:   [{ q: 3, r: 12 }],
  outpost_bot:   [{ q: 6, r: 12 }, { q: 7, r: 12 }],
  dungeon_lower: [{ q: 11, r: 12 }],

  // 共用
  enemy_base: [{ q: 14, r: 2 }, { q: 14, r: 7 }, { q: 14, r: 12 }],
}

// ─── 玩家可點選的目標區域（供 UI 顯示 + 互動）──────────────────────────────
export const CLICKABLE_ZONES: {
  id:    string
  label: string
  route: 'top' | 'mid' | 'bottom'
  cells: HexPos[]
}[] = [
  { id: 'outpost_top', label: '上路佔點', route: 'top',    cells: NAMED_ZONES.outpost_top  },
  { id: 'outpost_mid', label: '中路佔點', route: 'mid',    cells: NAMED_ZONES.outpost_mid  },
  { id: 'outpost_bot', label: '下路佔點', route: 'bottom', cells: NAMED_ZONES.outpost_bot  },
  { id: 'enemy_base',  label: '敵方基地', route: 'mid',    cells: NAMED_ZONES.enemy_base   },
]

// ─── 預設路線定義（標準三路 + 兩條跨路）────────────────────────────────────
export function createDefaultLanes(): LaneDef[] {
  return [
    // ── 標準三路 ───────────────────────────────────────────────────────────
    { id: 'top',    label: '上路', row: LANE_ROWS.top,    sequence: ['front_upper', 'outpost_top', 'dungeon_upper', 'enemy_base'] },
    { id: 'mid',    label: '中路', row: LANE_ROWS.mid,    sequence: ['front_mid',   'outpost_mid', 'dungeon_mid',   'enemy_base'] },
    { id: 'bottom', label: '下路', row: LANE_ROWS.bottom, sequence: ['front_lower', 'outpost_bot', 'dungeon_lower', 'enemy_base'] },

    // ── 跨路路線（waypoints 控制移動軌跡，sequence 控制佔領目標）──────────
    // 上支援中：從上路出發 → 佔上路點 → 斜切中路 → 佔中路點 → 推主堡
    {
      id: 'cross_top_mid', label: '上→中', row: LANE_ROWS.mid,
      waypoints: [
        { q: 7, r: LANE_ROWS.top },   // 先抵達上路佔點位置
        { q: 9, r: 5 },               // 再斜切到上中路中間地帶
      ],
      sequence: ['outpost_top', 'outpost_mid', 'dungeon_mid', 'enemy_base'],
    },
    // 下支援中：從下路出發 → 佔下路點 → 斜切中路 → 佔中路點 → 推主堡
    {
      id: 'cross_bot_mid', label: '下→中', row: LANE_ROWS.mid,
      waypoints: [
        { q: 7, r: LANE_ROWS.bottom }, // 先抵達下路佔點位置
        { q: 9, r: 9 },                // 再斜切到下中路中間地帶
      ],
      sequence: ['outpost_bot', 'outpost_mid', 'dungeon_mid', 'enemy_base'],
    },
  ]
}

// ─── 初始區域狀態（每場戰鬥呼叫一次）───────────────────────────────────────
export function createInitialZones(): Record<string, ZoneState> {
  return {
    outpost_top: {
      zoneId: 'outpost_top', nodeType: 'outpost', team: 'neutral',
      captureHp: 100, maxCaptureHp: 100,
      cells: [{ q: 6, r: 2 }, { q: 7, r: 2 }],
    },
    outpost_mid: {
      zoneId: 'outpost_mid', nodeType: 'outpost', team: 'neutral',
      captureHp: 100, maxCaptureHp: 100,
      cells: [{ q: 7, r: 7 }, { q: 8, r: 7 }],
    },
    outpost_bot: {
      zoneId: 'outpost_bot', nodeType: 'outpost', team: 'neutral',
      captureHp: 100, maxCaptureHp: 100,
      cells: [{ q: 6, r: 12 }, { q: 7, r: 12 }],
    },
  }
}

// ─── 地圖標籤（建築/區域名稱，永遠顯示）────────────────────────────────────
export const MAP_LABELS: { pos: HexPos; text: string; color: number }[] = [
  { pos: { q: 0,  r: 7  }, text: '我方基地', color: 0x4488ff },
  { pos: { q: 6,  r: 2  }, text: '上路佔點', color: 0xffcc44 },
  { pos: { q: 7,  r: 7  }, text: '中路佔點', color: 0xffcc44 },
  { pos: { q: 6,  r: 12 }, text: '下路佔點', color: 0xffcc44 },
  { pos: { q: 15, r: 7  }, text: '敵方基地', color: 0xff6644 },
]

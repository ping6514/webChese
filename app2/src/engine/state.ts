/**
 * engine/state.ts — app2 核心狀態型別
 *
 * 座標系統：axial (q, r)，pointy-top 六角格
 * 異常系統：MH 風格積蓄值（buildupAccum + 閾值遞增）
 */

import type { HexCoord } from '../game/hex'

// ─── 座標別名 ─────────────────────────────────────────────────────────────────

export type HexPos = HexCoord  // { q: number; r: number }

// ─── 六角格方向（0=右, 1=右上, 2=左上, 3=左, 4=左下, 5=右下）──────────────────

export type FacingDir = 0 | 1 | 2 | 3 | 4 | 5

// ─── 異常狀態 ID ─────────────────────────────────────────────────────────────

export type StatusId =
  | 'burn'      // 燒傷：短期高 DoT
  | 'poison'    // 中毒：長期低 DoT
  | 'paralyze'  // 麻痺：暫時無法行動
  | 'sleep'     // 睡眠：暫時無法行動 + 首擊 150% + 受傷解除
  | 'freeze'    // 冰凍：ATB 充能速率降低

// ─── ATB ────────────────────────────────────────────────────────────────────

export type ATBEntry = {
  unitId: string
  atb: number               // 0–100
  castRemaining: number     // 讀條剩餘 ms（0 = 不在讀條）
  recoveryRemaining: number // 後搖剩餘 ms
  /** 速度倍率（1.0 = 正常，冰凍時降低）*/
  speedMult: number
}

export type TimelineState = {
  tick: number                   // 全域累積遊戲時間 ms
  pendingUnitId: string | null   // 目前輪到誰行動（null = 推進時間中）
  entries: ATBEntry[]
}

// ─── 激活中的異常效果 ─────────────────────────────────────────────────────────

export type ActiveStatus = {
  id: StatusId
  /** 到期時間（ms，超過 tick 則移除；Infinity = 靠外部條件解除）*/
  expiresAt: number
  // DoT 用（burn / poison）
  dotDamagePerTick?: number
  dotTickMs?: number
  nextTickAt?: number
  /**
   * 中毒專用：本次激活的 DoT 總傷害上限（= 目標 maxHp × 0.25）
   * 每次 tick 累積，超過上限後提前結束
   */
  dotTotalCap?: number
  /** 本次已造成的 DoT 累積量（達到 dotTotalCap 後效果結束）*/
  dotTotalDealt?: number
  // 睡眠用
  sleepAmplifyOnWake?: boolean  // true = 下一次受傷 ×1.5 並解除
}

// ─── 積蓄值資料（MH 風格）────────────────────────────────────────────────────

export type BuildupData = {
  /** 目前累積量 */
  accum: number
  /** 觸發閾值（激活後遞增）*/
  threshold: number
  /** 初始閾值（用於計算上限：max = baseThreshold × 3）*/
  baseThreshold: number
}

export type RevivePendingState = {
  /** 是否仍有可用復活次數 */
  enabled: boolean
  /** 剩餘可觸發次數，MVP 先以 0/1 為主 */
  charges: number
  /** 何時允許復活（以 timeline.tick 比較）*/
  reviveAtTick: number | null
  /** 復活血量比例，例如 0.3 = 30% maxHp */
  reviveHpRatio: number
  /** 尋找復活格的半徑，0 = 只允許原地 */
  searchRadius: number
}

// ─── 單位 ─────────────────────────────────────────────────────────────────────

export type UnitTeam = 'player' | 'enemy'

export type CombatUnit = {
  id: string
  name: string
  team: UnitTeam
  certId: string

  // ── 位置與朝向 ──
  pos: HexPos
  facing: FacingDir

  // ── 基本數值 ──
  hp: number
  maxHp: number
  /** ATB 充能速率（ATB/秒），基準 = 30 */
  speed: number
  /** 每次行動可移動的 hex 距離 */
  move: number
  /** 武器傷害（簡化：直接數值，未來接 WeaponDef）*/
  damage: number
  /** 打斷強度 */
  interrupt: number

  isDead: boolean
  /** 死亡後可保留位置供 UI 表現，但邏輯上不再佔格 */
  blocksCell: boolean
  /** 每戰一次類型的延遲復活預留欄位 */
  revivePending?: RevivePendingState | null

  // ── 異常積蓄 ──
  /** 各異常的積蓄資料 */
  buildup: Record<StatusId, BuildupData>
  /** 積蓄值抗性（0–1，接近 1 = 高抗性，減少每次積蓄的增加量）*/
  buildupResist: Record<StatusId, number>

  // ── 激活中的異常效果 ──
  statusEffects: ActiveStatus[]
}

// ─── 戰場格子 ─────────────────────────────────────────────────────────────────

export type TerrainType =
  | 'normal'
  | 'high_ground'    // 投射物射程 +1，受攻擊 -10%
  | 'obstacle'       // 不可進入，提供掩護
  | 'hazard_zone'    // 危險格（毒霧/陷阱）
  | 'buff_physical'  // 物理傷害增幅
  | 'buff_magic'     // 魔法傷害增幅

export type BattleCell = {
  pos: HexPos
  terrain: TerrainType
  passable: boolean
  /** 危險區域（Zone 技能的預定落點），來源技能 id */
  hazardSkillId?: string
  hazardExpiresAt?: number
}

// ─── 戰場狀態 ─────────────────────────────────────────────────────────────────

export type BattlePhase =
  | 'running'   // 戰鬥進行中
  | 'player_won'
  | 'enemy_won'

export type GameState = {
  phase: BattlePhase
  timeline: TimelineState
  /** 所有單位，key = unit.id */
  units: Record<string, CombatUnit>
  /** 戰場格子 */
  cells: Record<string, BattleCell>  // key = hexKey(q,r)
}

// ─── 數值常數 ─────────────────────────────────────────────────────────────────

/** 基礎異常閾值（每個職業的抗性在此基礎上修正）*/
export const BASE_STATUS_THRESHOLDS: Record<StatusId, number> = {
  burn:     100,
  poison:   80,
  paralyze: 120,
  sleep:    100,
  freeze:   80,
}

/** 每次異常激活後，閾值乘以此倍率（MH 耐性遞增）*/
export const STATUS_THRESHOLD_SCALE = 1.5

/** 閾值上限倍率（最多增加到 base × 3）*/
export const STATUS_THRESHOLD_MAX_MULT = 3.0

/** 燒傷 DoT 參數 */
export const BURN_DOT_PER_TICK  = 10
export const BURN_DOT_TICK_MS   = 800
export const BURN_TICK_COUNT    = 4   // 總傷害 = 40
export const BURN_DURATION_MS   = BURN_DOT_TICK_MS * BURN_TICK_COUNT  // 3200ms

/**
 * 中毒 DoT 參數（百分比制）
 *
 * 每跳 = ceil(目標 maxHp × POISON_DOT_PCT_PER_TICK)
 * 本次激活總上限 = ceil(目標 maxHp × POISON_DOT_TOTAL_CAP_PCT)
 *   → 最多扣 25% maxHp，無法靠中毒單獨擊殺
 *
 * 範例：目標 maxHp=100
 *   每跳 = 3，上限 = 25，理論跳數 = 25/3 ≈ 8.3 跳（約 10 秒消耗完）
 */
export const POISON_DOT_PCT_PER_TICK  = 0.03  // 每跳 3% maxHp
export const POISON_DOT_TOTAL_CAP_PCT = 0.25  // 總上限 25% maxHp
export const POISON_DOT_TICK_MS       = 1200  // 每 1.2 秒一跳
export const POISON_DURATION_MS       = 14400 // 最長 12 跳 × 1.2 秒 = 14.4 秒（通常被上限截止）

/** 麻痺持續 ms */
export const PARALYZE_DURATION_MS = 3000

/** 睡眠持續 ms（或直到被攻擊解除）*/
export const SLEEP_DURATION_MS = Infinity

/** 冰凍 ATB 速率倍率 */
export const FREEZE_SPEED_MULT = 0.4
/** 冰凍持續 ms */
export const FREEZE_DURATION_MS = 4000

/**
 * 職業預設積蓄值抗性
 * 數值 = 每次積蓄輸入被減少的比例（0.2 = 收到 80% 的積蓄）
 */
export const CERT_BUILDUP_RESIST: Record<string, Partial<Record<StatusId, number>>> = {
  // 牙刃系 — 高機動，麻痺抗性強（避免動作中被鎖住）
  cert_fang_moonwolf:   { burn: 0.10, poison: 0.05, paralyze: 0.25, sleep: 0.10, freeze: 0.15 },
  cert_fang_huntmoon:   { burn: 0.10, poison: 0.05, paralyze: 0.30, sleep: 0.10, freeze: 0.15 },
  cert_fang_breaktooth: { burn: 0.15, poison: 0.05, paralyze: 0.30, sleep: 0.05, freeze: 0.10 },

  // 護膜系 — 凝膠體，毒/燃燒抗性強（生物黏液中和）
  cert_membrane_gel:     { burn: 0.20, poison: 0.35, paralyze: 0.05, sleep: 0.15, freeze: 0.20 },
  cert_membrane_tideguard: { burn: 0.25, poison: 0.30, paralyze: 0.10, sleep: 0.15, freeze: 0.20 },
  cert_membrane_corrosive: { burn: 0.20, poison: 0.40, paralyze: 0.05, sleep: 0.10, freeze: 0.15 },

  // 妖織系 — 有翼、靈敏，睡眠/冰凍抗性強（感知靈銳，難以入眠）
  cert_weave_windfeather:  { burn: 0.15, poison: 0.05, paralyze: 0.10, sleep: 0.25, freeze: 0.25 },
  cert_weave_songtail:     { burn: 0.15, poison: 0.05, paralyze: 0.15, sleep: 0.30, freeze: 0.25 },
  cert_weave_cinderfeather:{ burn: 0.30, poison: 0.05, paralyze: 0.10, sleep: 0.25, freeze: 0.20 },
}

/** 工廠函數：建立空白積蓄資料（供 createUnit 使用）*/
export function createBuildupData(certId: string): Record<StatusId, BuildupData> {
  const resist = CERT_BUILDUP_RESIST[certId] ?? {}
  const statuses: StatusId[] = ['burn', 'poison', 'paralyze', 'sleep', 'freeze']
  const result = {} as Record<StatusId, BuildupData>
  for (const sid of statuses) {
    const base = BASE_STATUS_THRESHOLDS[sid]
    // 高抗性的職業有更高的初始閾值（最多 +50%）
    const resistBonus = 1 + (resist[sid] ?? 0) * 0.5
    const adjustedBase = Math.round(base * resistBonus)
    result[sid] = { accum: 0, threshold: adjustedBase, baseThreshold: adjustedBase }
  }
  return result
}

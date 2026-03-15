/**
 * state.ts — 核心狀態型別定義
 *
 * 所有型別純資料（無方法），供 reduce / guards / ai 共用。
 * 無任何 DOM / 框架依賴。
 */

// ─── 座標 ────────────────────────────────────────────────────────────────────

export type Pos = { x: number; y: number }

// ─── 地圖格子 ─────────────────────────────────────────────────────────────────

export type CellType =
  | 'floor'
  | 'wall'
  | 'stairs_up'
  | 'stairs_down'
  | 'recovery'    // 踩到回復 HP/SP
  | 'chest'
  | 'trap'
  | 'mechanism'   // 機關（可啟動）
  | 'barrier'     // 機關連動屏障
  | 'portal'      // 傳送格

export type TerrainType =
  | 'normal'
  | 'forest'   // 木元素抗性 +20%，移動讀條 ×1.1
  | 'water'    // 火焰抗性 +20%，水元素抗性 −15%
  | 'rubble'   // 瓦礫（遺跡）移動讀條 ×1.3
  | 'altar'    // 古祭壇 暗/光傷害 +15%

export type Cell = {
  type: CellType
  height: 0 | 1 | 2              // 低地 / 平地 / 高台
  passable: boolean
  blockLineOfSight: boolean
  terrain: TerrainType
  /** 格上的持久傷害物件（陷阱、毒池等），id 指向 FloorState.hazards */
  hazardId?: string
}

// ─── 持久傷害物件（HazardObject）────────────────────────────────────────────

export type HazardObject = {
  id: string
  ownerId: string                // 放置者 unitId
  pos: Pos
  /** 絕對到期時間（ms，Infinity = 永久）*/
  expiresAt: number
  triggerOn: 'step_on' | 'interval' | 'both'
  intervalMs?: number
  /** 下次 interval 觸發的絕對時間（interval/both 模式由 skills.ts 初始化）*/
  nextTriggerAt?: number
  maxTriggers?: number
  triggersUsed: number
  effectId: string               // 對應技能/武器的 effect 定義 id
}

// ─── ATB ────────────────────────────────────────────────────────────────────

export type ATBEntry = {
  unitId: string
  atb: number           // 0–100
  castRemaining: number // 讀條剩餘 ms（0 = 不在讀條中）
  recoveryRemaining: number // 硬直剩餘 ms
}

export type TimelineState = {
  tick: number                   // 全域累積 ms
  pendingUnitId: string | null   // 當前可行動的單位（null = 推進時間中）
  entries: ATBEntry[]            // 所有活躍單位的 ATB 條目，與 units 同步
}

// ─── 狀態效果 ─────────────────────────────────────────────────────────────────

export type StatusEffect = {
  id: string             // e.g. 'slow', 'bleed', 'poison', 'stun', 'entangle'
  /** 絕對到期時間（ms，`state.timeline.tick` 超過此值時移除）*/
  expiresAt: number
  /** 週期傷害（bleed / poison 用），每 dotTickMs 觸發一次 */
  dotDamagePerTick?: number
  dotTickMs?: number
  dotElement?: string
  /** 下一次 DoT tick 的絕對時間（由 buildStatusEffect 初始化）*/
  nextTickAt?: number
  /** 移動/行動減速倍率（slow / entangle 用），1.0 = 無效果 */
  speedMult?: number
  moveRangeMult?: number
  /** 行動封鎖（stun 用）*/
  stunned?: boolean
}

// ─── 裝備詞條（已附加到武器/防具的實例）─────────────────────────────────────

export type AppliedAffix = {
  id: string                        // 對應 weapon_affixes / armor_affixes 中的 id
  /** 個體差異：覆蓋 value（若有）*/
  overwrite?: Record<string, number | string>
}

// ─── 武器實例 ─────────────────────────────────────────────────────────────────

export type ResolvedWeapon = {
  /** 唯一識別（baseId + hash），null 代表怪物內嵌武器 */
  idHash: string | null
  baseId: string
  name: string
  /** ActionDef id，指向 data/actions/ */
  actionId: string
  hitMode: HitMode
  actionTags: string[]
  statScaling: 'STR' | 'AGI' | 'INT'
  atkFinal: number
  spCostFinal: number
  mpCostFinal: number
  castTimeFinal: number
  recoveryTimeFinal: number
  cooldownMs: number
  /** slot1 元素（'slash'/'fire'/'water'…）*/
  element: string
  /** slot2 模式（'mode_slash'/'mode_charge'…）*/
  attackMode: string
  /** slot5 附魔（null = 無）*/
  enchant: string | null
  /** 已附加詞條的 id 清單（保留供 FormulaKeySet 展開）*/
  appliedAffixIds: string[]
}

// ─── HitMode ─────────────────────────────────────────────────────────────────

export type HitMode =
  | { type: 'instant' }
  | { type: 'delayed'; warningMs: number }
  | { type: 'check_at_resolve' }
  | {
      type: 'persistent_zone'
      duration: number
      triggerOn: 'step_on' | 'interval' | 'both'
      intervalMs?: number
      maxTriggers?: number
    }
  | { type: 'projectile'; speedCellsPerSec: number; piercing: boolean }

// ─── FormulaKeySet（攻擊傷害計算用的扁平 key-value 集合）────────────────────

export type FormulaKeySet = Record<string, number>

// ─── 單位（玩家 & 怪物共用）───────────────────────────────────────────────────

export type UnitKind = 'player' | 'monster'

export type Unit = {
  id: string
  kind: UnitKind
  name: string
  pos: Pos
  facing: 'up' | 'down' | 'left' | 'right'

  // ── 基礎屬性 ──
  stats: {
    str: number
    agi: number
    int: number
    lck: number
  }

  // ── 資源 ──
  maxHP: number;  currentHP: number
  maxSP: number;  currentSP: number
  maxMP: number;  currentMP: number
  /** 每次行動後（consumeATB）自動回復的 SP 量（0 = 不回復，怪物預設 0）*/
  spRecoveryFlat: number

  // ── 移動 ──
  speed: number       // ATB 速度（影響 ATB 充能速率）
  moveRange: number   // 每次行動可移動格數

  // ── 武器（玩家 1 把，怪物 1–3 把）──
  /** 已 resolve 的武器，null 表示該槽空）*/
  weapons: (ResolvedWeapon | null)[]
  /** 各武器的冷卻到期絕對時間（ms，0 = 不在冷卻）*/
  weaponCooldownUntil: number[]

  // ── 防禦 ──
  /** 各元素物理抗性 0~1（0 = 無抗性，1 = 免疫）*/
  resistances: Record<string, number>
  /** 各元素防禦 flat 值（先乘抗性再減防禦）*/
  defenses: Record<string, number>

  // ── 狀態效果 ──
  statusEffects: StatusEffect[]

  // ── 行動暫存（每次行動後更新）──
  pendingAction?: PendingAction   // 讀條中的行動

  // ── 玩家專用 ──
  /** 職業證 def id（e.g. 'warrior'）*/
  jobId?: string
  /** 玩家持有的職業證個體 ID（對應 JobCertInstance.instanceId）*/
  jobCertInstanceId?: string

  // ── 怪物專用 ──
  ai?: 'chase' | 'patrol' | 'guard' | 'boss'
  /** 怪物基底定義 id（供 passive 和 skill 查找）*/
  monsterId?: string
  /** 技能冷卻到期絕對時間（skillId → 到期 ms，0 = 不在冷卻）*/
  skillCooldownUntil?: Record<string, number>
  /** 是否已死亡但屍體仍在格上（有些技能讀屍體）*/
  isDead?: boolean

  // ── 被動追蹤（spawner 初始化，passive.ts 更新）──
  /** once=true 被動已觸發的 key 清單（`${monsterId}_passive_${index}`）*/
  triggeredPassiveIds?: string[]
  /** on_time 被動的下次觸發絕對時間（passiveKey → absoluteMs）*/
  passiveNextTriggerAt?: Record<string, number>
  /** 被動加成的攻擊倍率（預設 1.0，由 buff_self/enter_phase 設置）*/
  passiveAtkMult?: number
}

// ─── 讀條中的行動暫存 ────────────────────────────────────────────────────────

export type PendingAction =
  | { kind: 'weapon'; weaponSlot: number; targetPos: Pos; lockedCells: Pos[] }
  | { kind: 'skill';  skillId: string;    targetPos: Pos; lockedCells: Pos[] }
  | { kind: 'move';   path: Pos[] }

// ─── 飛行物件（投射物）───────────────────────────────────────────────────────

export type Projectile = {
  id: string
  ownerId: string
  origin: Pos
  target: Pos
  /** 目前視覺位置（供 UI 插值，引擎邏輯不用）*/
  currentPos: Pos
  speedCellsPerSec: number
  piercing: boolean
  /** 命中後套用的效果 id */
  effectId: string
  /** 已命中的 unitId 清單（piercing 時不重複命中同一單位）*/
  hitUnitIds: string[]
}

// ─── 掉落物（地圖上即時掉落，保留供未來使用）────────────────────────────────

export type LootItem =
  | { kind: 'weapon'; weapon: ResolvedWeapon }
  | { kind: 'gold';   amount: number }
  | { kind: 'item';   itemId: string }

export type LootDrop = {
  id: string
  pos: Pos
  item: LootItem
}

// ─── 戰利品分配模式（地城開始前設定）────────────────────────────────────────

/**
 * 層間打寶時，戰利品如何分配給各玩家。
 *
 * - `free_for_all`：各人獨立選擇（單人 / 無競爭）
 * - `captain`：隊長（host）替全隊決定
 * - `round_robin`：玩家輪流選，每人選一件
 * - `need_greed`：每件物品各自投票（Need > Greed > Pass），類 WoW
 */
export type LootDistributionMode = 'free_for_all' | 'captain' | 'round_robin' | 'need_greed'

// ─── 層間打寶：寶相 hint（開箱前可見資訊）──────────────────────────────────

/**
 * 寶相的外觀提示，讓玩家在投票前判斷值不值得搶。
 * 不透漏具體 affixIds（保留開箱驚喜感）。
 */
export type LootHint = {
  itemType: 'weapon' | 'armor' | 'tool'
  /** 裝備槽（weapon 無此欄位）*/
  slot?: string
  /** 物品品級（從最高 affix rarity 推算）*/
  rarity: 'common' | 'rare' | 'elite'
  /** 職業可用標籤（來自基底的 requiredTags，讓玩家判斷誰能裝備）*/
  usableTags: string[]
}

// ─── 層間打寶：寶相選項 ───────────────────────────────────────────────────────

import type { FrozenItem } from './item'

/**
 * 一個可選擇的寶相。進層時即 seed 鎖定，層通關後才顯示。
 *
 * `item` 已完整 resolve（含 affixIds）；
 * `hint` 是對外顯示的摘要（不包含 affixIds 細節）。
 */
export type LootOption = {
  instanceId: string       // 等同 item.instanceId，供 action 引用
  item: FrozenItem         // 完整凍結物品（進層時已確定）
  hint: LootHint           // 投票前可見的摘要
  /** 已被某位玩家選走（opened=true 後不可再選）*/
  isOpened: boolean
  /** 選走這件物品的玩家 id（null = 未開）*/
  takenByPlayerId: string | null
}

// ─── 層間打寶：Need/Greed 投票紀錄 ──────────────────────────────────────────

export type LootVoteRecord = {
  instanceId: string
  votes: Record<string, 'need' | 'greed' | 'pass'>  // playerId → vote
  /** 解析完成後填入（null = 無人想要）*/
  winnerId: string | null
  isResolved: boolean
}

// ─── 層間打寶：層通關後的打寶階段狀態 ───────────────────────────────────────

/**
 * 存在於 RunState.lootPhase 中，當層通關後進入此狀態，
 * 玩家全部確認（或跳過）後清除。
 */
export type LootPhaseState = {
  /** 本階段進行到哪個步驟 */
  phase: 'selecting' | 'voting' | 'done'

  /** 全部寶相選項（1 + playerCount×2 件，進層時 seed 鎖定）*/
  options: LootOption[]

  /** 剩餘開箱次數（playerCount + bonus）*/
  picksRemaining: number

  /** 本層金幣獎勵（開箱前顯示）*/
  bonusGold: number

  /** 額外次數來源說明（'boss_room' | 'elite_bonus' | 'objective'，顯示用）*/
  bonusReasons: string[]

  // ── need_greed 模式專用 ──
  /** 當前正在投票的物品（null = 未開始投票）*/
  currentVote: LootVoteRecord | null

  // ── round_robin 模式專用 ──
  /** 當前輪到的玩家 id */
  currentPickerId: string | null

  // ── captain 模式專用 ──
  /** 隊長 playerId（由 host 設定）*/
  captainId: string | null

  /** 本次通關結算後，各玩家已獲得的物品 */
  awarded: Record<string, FrozenItem[]>  // playerId → items
}

// ─── 樓層目標 ─────────────────────────────────────────────────────────────────

export type FloorObjective =
  | { type: 'clear_all' }                          // 消滅全部怪物
  | { type: 'reach_exit'; exitPos: Pos }            // 到達出口（不必殲滅）
  | { type: 'kill_boss'; bossId: string }           // 擊殺指定 Boss
  | { type: 'kill_targets'; targetIds: string[] }   // 消滅特定敵人
  | { type: 'survive'; untilTick: number }          // 生存至指定時間點

// ─── 樓層狀態 ─────────────────────────────────────────────────────────────────

export type FloorState = {
  width: number
  height: number
  cells: Cell[][]          // [y][x]
  seed: string
  floorNumber: number
  pathType: 'safe' | 'trial'
  theme: 'forest' | 'ruins'
  objective: FloorObjective
  hazards: Record<string, HazardObject>
  projectiles: Projectile[]
  loot: LootDrop[]
}

// ─── 跑圖全域狀態 ─────────────────────────────────────────────────────────────

export type RunState = {
  runSeed: string
  difficulty: number
  theme: 'forest' | 'ruins'
  floorNumber: number
  maxFloors: number
  pathHistory: Array<'safe' | 'trial'>
  trialFloorCount: number
  dungeonQuality: number
  lootQuality: number
  status: 'active' | 'cleared' | 'failed'

  // ── 多人設定（地城建立時決定）──
  /** 玩家人數（影響寶相數量與選擇次數）*/
  playerCount: number
  /** 戰利品分配方式 */
  lootDistributionMode: LootDistributionMode
  /** 隊長 playerId（captain 模式使用，其他模式可為 null）*/
  captainPlayerId: string | null

  // ── 層間打寶階段（FLOOR_CLEARED 後出現，TAKE_LOOT_DONE 後清除）──
  lootPhase: LootPhaseState | null
}

// ─── 回合旗標（每個單位行動前重置）──────────────────────────────────────────

export type TurnFlags = {
  actingUnitId: string | null
}

// ─── 完整遊戲狀態 ─────────────────────────────────────────────────────────────

export type GameState = {
  floor: FloorState
  units: Record<string, Unit>
  timeline: TimelineState
  turnFlags: TurnFlags
  run: RunState
}

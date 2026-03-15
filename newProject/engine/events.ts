/**
 * events.ts — Event union type
 *
 * reduce() 回傳的 events[] 供 UI 讀取做動畫/音效/浮字。
 * Events 不影響 state（state 已在 reduce 內直接更新）。
 */

import type { Pos, LootItem } from './state'

// ─── ATB / 時間 ───────────────────────────────────────────────────────────────

/** 某單位 ATB 充到 100，獲得行動權 */
export type ATBReadyEvent = {
  type: 'ATB_READY'
  unitId: string
}

// ─── 移動 ─────────────────────────────────────────────────────────────────────

export type UnitMovedEvent = {
  type: 'UNIT_MOVED'
  unitId: string
  from: Pos
  to: Pos
  /** 完整路徑（供 UI 沿路播放動畫）*/
  path: Pos[]
}

// ─── 攻擊讀條 ─────────────────────────────────────────────────────────────────

/** 武器讀條開始 */
export type CastStartedEvent = {
  type: 'CAST_STARTED'
  unitId: string
  weaponSlot: number
  castTimeMs: number
  /** 讀條開始時鎖定的格子（instant/delayed hitMode 用，供 UI 顯示預警）*/
  lockedCells: Pos[]
}

/** 技能讀條開始 */
export type SkillCastStartedEvent = {
  type: 'SKILL_CAST_STARTED'
  unitId: string
  skillId: string
  skillName: string
  castTimeMs: number
  lockedCells: Pos[]
}

// ─── 傷害 / 治療 ──────────────────────────────────────────────────────────────

export type DamageDealtEvent = {
  type: 'DAMAGE_DEALT'
  sourceId: string
  targetId: string
  amount: number         // 最終扣血量（已算抗性/防禦）
  element: string        // 'slash'/'fire' 等
  isCrit: boolean
  pos: Pos               // 目標位置（供 UI 顯示浮字）
}

export type HealEvent = {
  type: 'HEAL'
  unitId: string
  amount: number
  resource: 'hp' | 'sp' | 'mp'
  pos: Pos
}

/** DoT tick（bleed/poison 每次觸發）*/
export type DotTickEvent = {
  type: 'DOT_TICK'
  sourceStatusId: string
  targetId: string
  amount: number
  element: string
  pos: Pos
}

// ─── 狀態效果 ─────────────────────────────────────────────────────────────────

export type StatusAppliedEvent = {
  type: 'STATUS_APPLIED'
  unitId: string
  statusId: string       // 'slow'/'bleed'/'poison'/'stun'/'entangle'…
  durationMs: number
  pos: Pos
}

export type StatusExpiredEvent = {
  type: 'STATUS_EXPIRED'
  unitId: string
  statusId: string
}

// ─── 被動觸發 ─────────────────────────────────────────────────────────────────

export type PassiveTriggeredEvent = {
  type: 'PASSIVE_TRIGGERED'
  unitId: string
  passiveId: string      // 觸發來源（cert/affix/monster passive id）
  effectType: string     // 'recover_hp' / 'stat_modifier' 等
  pos: Pos
}

// ─── 單位死亡 ─────────────────────────────────────────────────────────────────

export type UnitDiedEvent = {
  type: 'UNIT_DIED'
  unitId: string
  pos: Pos
  /** 擊殺者 id（null = 環境傷害）*/
  killedById: string | null
}

// ─── 飛行物件 ─────────────────────────────────────────────────────────────────

export type ProjectileFiredEvent = {
  type: 'PROJECTILE_FIRED'
  projectileId: string
  ownerId: string
  from: Pos
  to: Pos
  speedCellsPerSec: number
}

export type ProjectileHitEvent = {
  type: 'PROJECTILE_HIT'
  projectileId: string
  pos: Pos
  hitUnitId: string | null   // null = 命中牆壁/地板
}

// ─── 持久傷害物件 ─────────────────────────────────────────────────────────────

export type HazardPlacedEvent = {
  type: 'HAZARD_PLACED'
  hazardId: string
  pos: Pos
  effectId: string
}

export type HazardTriggeredEvent = {
  type: 'HAZARD_TRIGGERED'
  hazardId: string
  triggerUnitId: string
  pos: Pos
}

export type HazardExpiredEvent = {
  type: 'HAZARD_EXPIRED'
  hazardId: string
  pos: Pos
}

// ─── 召喚 / 生成 ──────────────────────────────────────────────────────────────

export type UnitSpawnedEvent = {
  type: 'UNIT_SPAWNED'
  unitId: string
  monsterId: string
  pos: Pos
}

// ─── 掉落 / 拾取 ──────────────────────────────────────────────────────────────

export type LootDroppedEvent = {
  type: 'LOOT_DROPPED'
  lootId: string
  pos: Pos
  item: LootItem
}

export type LootPickedUpEvent = {
  type: 'LOOT_PICKED_UP'
  lootId: string
  unitId: string
  item: LootItem
}

// ─── 樓層 ─────────────────────────────────────────────────────────────────────

export type FloorClearedEvent = {
  type: 'FLOOR_CLEARED'
  floorNumber: number
}

export type FloorFailedEvent = {
  type: 'FLOOR_FAILED'
  floorNumber: number
  /** 失敗原因：all_dead（全員陣亡）*/
  reason: 'all_dead'
}

// ─── 層間打寶 ─────────────────────────────────────────────────────────────────

export type LootPhaseStartedEvent = {
  type: 'LOOT_PHASE_STARTED'
  floorNumber: number
  optionCount: number
  picksRemaining: number
}

export type OptionOpenedEvent = {
  type: 'OPTION_OPENED'
  instanceId: string
  playerId: string
  /** need_greed 模式下此次只是開箱待投票（item 暫未分配）*/
  pendingVote: boolean
}

export type VoteResolvedEvent = {
  type: 'VOTE_RESOLVED'
  instanceId: string
  winnerId: string | null
}

export type PathSelectedEvent = {
  type: 'PATH_SELECTED'
  pathType: 'safe' | 'trial'
  nextFloor: number
}

// ─── Union ───────────────────────────────────────────────────────────────────

export type Event =
  | ATBReadyEvent
  | UnitMovedEvent
  | CastStartedEvent
  | SkillCastStartedEvent
  | DamageDealtEvent
  | HealEvent
  | DotTickEvent
  | StatusAppliedEvent
  | StatusExpiredEvent
  | PassiveTriggeredEvent
  | UnitDiedEvent
  | ProjectileFiredEvent
  | ProjectileHitEvent
  | HazardPlacedEvent
  | HazardTriggeredEvent
  | HazardExpiredEvent
  | UnitSpawnedEvent
  | LootDroppedEvent
  | LootPickedUpEvent
  | FloorClearedEvent
  | FloorFailedEvent
  | LootPhaseStartedEvent
  | OptionOpenedEvent
  | VoteResolvedEvent
  | PathSelectedEvent

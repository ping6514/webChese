/**
 * actions.ts — Action union type
 *
 * 所有可以改變 GameState 的動作。
 * UI / AI 只能透過 dispatch(action) 修改狀態，不可直接寫 state。
 */

import type { Pos } from './state'

// ─── 時間推進 ─────────────────────────────────────────────────────────────────

/** 系統推進 ATB，直到下一個單位獲得行動權 */
export type AdvanceTimeAction = {
  type: 'ADVANCE_TIME'
}

// ─── 移動 ─────────────────────────────────────────────────────────────────────

/** 移動單位到指定格（guard 會驗證路徑合法性與 moveRange）*/
export type MoveAction = {
  type: 'MOVE'
  unitId: string
  to: Pos
}

// ─── 武器攻擊（兩階段：開始讀條 → 結算）────────────────────────────────────

/**
 * 宣告使用武器，開始讀條。
 * - guard 檢查：是否輪到該單位、有無冷卻、資源是否足夠
 * - reduce：設定 unit.pendingAction，鎖定 lockedCells（instant/delayed 用）
 */
export type QueueWeaponAction = {
  type: 'QUEUE_WEAPON'
  unitId: string
  weaponSlot: number
  targetPos: Pos
}

/**
 * 讀條時間到，結算傷害/效果。
 * - 由 ATB 推進系統自動發出（非玩家手動）
 * - reduce：依 hitMode 分派：instant/delayed → 直接結算；check_at_resolve → 重判範圍
 */
export type ResolveCastAction = {
  type: 'RESOLVE_CAST'
  unitId: string
}

// ─── 主動技能（怪物 skillPool / 未來玩家特技）───────────────────────────────

/**
 * 宣告使用主動技能，開始讀條。
 * 格式與 QueueWeapon 相似，但讀 skillPool 定義而非武器。
 */
export type QueueSkillAction = {
  type: 'QUEUE_SKILL'
  unitId: string
  skillId: string
  targetPos: Pos
}

/** 技能讀條結算，由 ATB 推進系統自動發出 */
export type ResolveSkillCastAction = {
  type: 'RESOLVE_SKILL_CAST'
  unitId: string
}

// ─── 硬直結束 ─────────────────────────────────────────────────────────────────

/** 硬直時間結束，單位重新進入 ATB 充能（由 ATB 推進系統自動發出）*/
export type ResolveRecoveryAction = {
  type: 'RESOLVE_RECOVERY'
  unitId: string
}

// ─── 投射物推進 ───────────────────────────────────────────────────────────────

/** 推進所有飛行物件一步（由 ATB 推進系統自動發出）*/
export type AdvanceProjectilesAction = {
  type: 'ADVANCE_PROJECTILES'
  deltaMs: number
}

// ─── 持久傷害物件 ─────────────────────────────────────────────────────────────

/** 更新所有 HazardObject 的計時與 interval 觸發（由 ATB 推進系統自動發出）*/
export type AdvanceHazardsAction = {
  type: 'ADVANCE_HAZARDS'
  deltaMs: number
}

// ─── 狀態效果推進 ─────────────────────────────────────────────────────────────

/** 更新所有 StatusEffect 計時（DoT tick、slow 倒數等）*/
export type AdvanceStatusEffectsAction = {
  type: 'ADVANCE_STATUS_EFFECTS'
  deltaMs: number
}

// ─── 玩家跳過 ─────────────────────────────────────────────────────────────────

/** 玩家選擇不行動，直接結束本輪 */
export type EndTurnAction = {
  type: 'END_TURN'
  unitId: string
}

// ─── SP → MP 轉換 ──────────────────────────────────────────────────────────────

/** 消耗 SP 換取 MP（法師用，防止 MP 耗盡後卡死）*/
export type ConvertSpToMpAction = {
  type: 'CONVERT_SP_TO_MP'
  unitId: string
}

// ─── 拾取掉落物 ───────────────────────────────────────────────────────────────

export type PickupLootAction = {
  type: 'PICKUP_LOOT'
  unitId: string
  lootId: string
}

// ─── 層間打寶階段 ─────────────────────────────────────────────────────────────

import type { FrozenItem } from './item'

/**
 * 層通關後，由遊戲循環發出，攜帶預先 resolve 好的 FrozenItem 清單。
 * reduce 收到後呼叫 generateLootPhase 並寫入 RunState.lootPhase。
 */
export type StartLootPhaseAction = {
  type: 'START_LOOT_PHASE'
  items: FrozenItem[]
  bonusGold: number
  bonusReasons?: string[]
  /** 額外 picks（boss 層 +1 等）*/
  bonusPicks?: number
  /** 玩家 id 清單（round_robin 順序 / awarded map 初始化）*/
  playerIds: string[]
}

/**
 * 玩家（或隊長）選擇開啟一個寶相。
 * - free_for_all / captain / round_robin → 直接分配
 * - need_greed → 建立 currentVote，進入 voting 狀態
 */
export type OpenOptionAction = {
  type: 'OPEN_OPTION'
  instanceId: string
  playerId: string
}

/**
 * need_greed 模式：玩家提交投票。
 * 所有玩家都投完後自動解析（resolveVote），回到 selecting 狀態。
 */
export type SubmitVoteAction = {
  type: 'SUBMIT_VOTE'
  /** 必須與 currentVote.instanceId 相符 */
  instanceId: string
  playerId: string
  vote: 'need' | 'greed' | 'pass'
}

/**
 * 打寶階段結束後，玩家確認並選擇下一層路線。
 * reduce 呼叫 advanceRun，清除 lootPhase。
 */
export type SelectPathAction = {
  type: 'SELECT_PATH'
  pathType: 'safe' | 'trial'
}

// ─── Union ───────────────────────────────────────────────────────────────────

export type Action =
  | AdvanceTimeAction
  | MoveAction
  | QueueWeaponAction
  | ResolveCastAction
  | QueueSkillAction
  | ResolveSkillCastAction
  | ResolveRecoveryAction
  | AdvanceProjectilesAction
  | AdvanceHazardsAction
  | AdvanceStatusEffectsAction
  | EndTurnAction
  | ConvertSpToMpAction
  | PickupLootAction
  | StartLootPhaseAction
  | OpenOptionAction
  | SubmitVoteAction
  | SelectPathAction

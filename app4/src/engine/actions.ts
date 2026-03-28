// BG Card Game Engine — Action 型別定義

import type { PlayerId, ZoneId, BrickAreaId } from './types'

export type Action =
  // ── 補充階段 ──────────────────────────────────────
  | { type: 'DRAW_CARD' }
  | { type: 'PLACE_BRICK'; areaId: BrickAreaId }  // 從牌組補充一張磚堆

  // ── 主要階段 ──────────────────────────────────────
  | { type: 'PLAY_BUILDING'; cardId: string; areaId: BrickAreaId }
  | { type: 'PLAY_EVENT'; cardId: string; params: EventParams }

  // ── 行動階段 ──────────────────────────────────────
  | { type: 'START_BG_ACTION'; bgId: string }
  | { type: 'MOVE_BG'; toZone: ZoneId; ignoreBlock?: boolean }
  | { type: 'USE_SKILL'; skillIndex: 0 | 1; params: SkillParams; fromBGId?: string }  // fromBGId = 由哪個BG施放（不填=actingBG，填ally=聯合技能）
  | { type: 'DO_ATTACK'; targetBGId: string; allyId?: string }  // allyId = 選擇協助的友軍
  | { type: 'DO_CLEAR_BRICK'; areaId: BrickAreaId; slotIndex?: number }  // slotIndex 用於選擇建築卡
  | { type: 'DO_SIEGE' }
  | { type: 'END_BG_ACTION' }

  // ── 反應階段 ──────────────────────────────────────
  | { type: 'INSTALL_REACTION'; bgId: string; cardId: string }

  // ── 反應卡觸發回應 ────────────────────────────────
  | { type: 'RESOLVE_REACTION'; choice: ReactionChoice }

  // ── 通用 ──────────────────────────────────────────
  | { type: 'NEXT_PHASE' }
  | { type: 'SURRENDER' }

// ── 技能參數 ─────────────────────────────────────

export type SkillParams = {
  // 目標 BG ID（多個時為陣列）
  targetBGIds?: string[]
  targetBGId?: string
  // 目標區域
  targetZone?: ZoneId
  targetAreaId?: BrickAreaId
  // 磚堆操作目標
  brickAreaId?: BrickAreaId
  brickSlotIndex?: number    // 指定清第幾個 slot（不填 = 自動選最後一個非中繼點格）
  // 普倫/蜜瓜等技能的多次效果目標列表
  multiTargets?: Array<{ type: 'bg' | 'repair'; bgId?: string; zone?: ZoneId }>
  // 其他
  discardCardIds?: string[]  // 額外捨棄的手牌（技能費用）
  isCounterattack?: boolean  // 由反擊觸發（非主動施放）
}

// ── 事件卡參數 ───────────────────────────────────

export type EventParams = {
  targetBGId?: string
  targetZone?: ZoneId
  targetBGId2?: string     // 呼朋引伴：被移動的友軍
  discardCardId?: string   // 反應大師：捨棄的手牌
}

// ── 反應卡選擇 ───────────────────────────────────

export type ReactionChoice = {
  reactionId: string
  triggerBGId: string
  // 威嚇反應：A(受傷) 或 B(退回)
  intimidateBGId?: string       // 持有威嚇卡的守方 BG ID（讓 applyAttack 用正確的 attacker）
  intimidateChoice?: 'take_damage' | 'move_back'
  // 玉石俱焚：選擇目標
  mutualDestroyTargetId?: string
}

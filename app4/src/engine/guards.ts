// BG Card Game Engine — 行動合法性驗證

import type { GameState } from './state'
import { effectiveHP, hasBricks, isPlazaBlocked, isSiegeBlocked, getBGsInZone } from './state'
import type { Action } from './actions'
import type { PlayerId, ZoneId, BrickAreaId } from './types'
import { opponentOf, homeZone, frontZone } from './types'
import { buildingById } from '../data/buildings'
import { reactionById } from '../data/reactions'
import { eventById } from '../data/events'
import { bgCardById } from '../data/bg-cards'

export type GuardResult = { ok: true } | { ok: false; reason: string }

const OK: GuardResult = { ok: true }
const fail = (reason: string): GuardResult => ({ ok: false, reason })

export function canDispatch(state: GameState, player: PlayerId, action: Action): GuardResult {
  if (state.winner) return fail('遊戲已結束')

  switch (action.type) {
    case 'SURRENDER': return OK

    case 'DRAW_CARD':      return canDrawCard(state, player)
    case 'PLACE_BRICK':    return canPlaceBrick(state, player, action.areaId)
    case 'PLAY_BUILDING':  return canPlayBuilding(state, player, action.cardId, action.areaId)
    case 'PLAY_EVENT':     return canPlayEvent(state, player, action.cardId)
    case 'START_BG_ACTION': return canStartBGAction(state, player, action.bgId)
    case 'MOVE_BG':        return canMoveBG(state, player, action.toZone, action.ignoreBlock)
    case 'USE_SKILL':      return canUseSkill(state, player, action.skillIndex, action.fromBGId)
    case 'DO_ATTACK':      return canDoAttack(state, player, action.targetBGId, action.allyId)
    case 'DO_CLEAR_BRICK': return canDoClearBrick(state, player, action.areaId, action.slotIndex)
    case 'DO_SIEGE':       return canDoSiege(state, player)
    case 'END_BG_ACTION':  return canEndBGAction(state, player)
    case 'INSTALL_REACTION': return canInstallReaction(state, player, action.bgId, action.cardId)
    case 'RESOLVE_REACTION': return OK
    case 'NEXT_PHASE':     return canNextPhase(state, player)
    default: return fail('未知的行動類型')
  }
}

// ── 補充階段 ─────────────────────────────────────

function canDrawCard(state: GameState, player: PlayerId): GuardResult {
  if (state.phase !== 'draw') return fail('不在補充階段')
  if (state.currentPlayer !== player) return fail('不是你的回合')
  if (state.drawActionsUsed >= 2) return fail('本回合補充行動已用完（最多2次）')
  return OK
}

function canPlaceBrick(state: GameState, player: PlayerId, areaId: BrickAreaId): GuardResult {
  // 砌磚僅限 BLC 技能效果（行動階段內部呼叫），不開放補充階段系統操作
  if (state.phase !== 'action') return fail('砌磚僅限BLC技能效果')
  // 只能補充自己的磚堆
  if (!areaId.startsWith(player)) return fail('只能補充自己的磚堆區')
  // 城牆歸零後主堡磚不可再補（讓敵方可完成攻城）
  if (areaId.endsWith('_base') && state.cityWalls[player] === 0) return fail('城牆已歸零，主堡磚堆無法再補充')
  const area = state.brickAreas[areaId]
  const brickCount = area.slots.filter(s => !s.isBuilding).length
  if (brickCount >= area.maxSlots) return fail('磚堆區已滿')
  const ps = state.players[player]
  if (ps.deck.length === 0 && ps.graveyard.length === 0) return fail('牌組和墓地都沒有牌')
  return OK
}

// ── 主要階段 ─────────────────────────────────────

function canPlayBuilding(state: GameState, player: PlayerId, cardId: string, areaId: BrickAreaId): GuardResult {
  if (state.phase !== 'main') return fail('不在主要階段')
  if (state.currentPlayer !== player) return fail('不是你的回合')
  if (state.mainBuildingPlayed) return fail('本回合已打出過建築卡')
  if (!areaId.startsWith(player)) return fail('只能放在自己的磚堆區')
  const def = buildingById[cardId]
  if (!def) return fail('找不到建築卡定義')
  const areaType = areaId.endsWith('plaza') ? 'plaza' : 'base'
  if (!def.placeable.includes(areaType)) return fail(`${def.name} 不能放在此區域`)
  const area = state.brickAreas[areaId]
  if (area.slots.some(s => s.isBuilding && s.cardId === cardId)) return fail(`${def.name} 已在此區域，不能重複放置`)
  const hand = state.players[player].hand
  if (!hand.includes(cardId)) return fail('手牌中沒有此建築卡')
  return OK
}

function canPlayEvent(state: GameState, player: PlayerId, cardId: string): GuardResult {
  if (state.phase !== 'main') return fail('不在主要階段')
  if (state.currentPlayer !== player) return fail('不是你的回合')
  const hand = state.players[player].hand
  if (!hand.includes(cardId)) return fail('手牌中沒有此事件卡')
  const def = eventById[cardId]
  if (!def) return fail('找不到事件卡定義')
  if (cardId === 'rush_time') {
    if (state.rushTimeUsed) return fail('RUSH TIME 一場遊戲只能使用一次')
    const myWalls = state.cityWalls[player]
    const enemyWalls = state.cityWalls[opponentOf(player)]
    if (!(myWalls <= enemyWalls - 2)) return fail('RUSH TIME 發動條件不符（我方城牆需低於敵方2個以上）')
  }
  return OK
}

// ── 行動階段 ─────────────────────────────────────

function canStartBGAction(state: GameState, player: PlayerId, bgId: string): GuardResult {
  if (state.phase !== 'action') return fail('不在行動階段')
  if (state.currentPlayer !== player) return fail('不是你的回合')
  if (state.actingBGId !== null) return fail('已有 BG 正在行動中')
  if (state.bgActionsUsed >= state.bgActionsMax) return fail('本回合 BG 行動次數已用完')
  const bg = state.bgs[bgId]
  if (!bg) return fail('找不到 BG')
  if (bg.owner !== player) return fail('不是你的 BG')
  if (bg.actedThisPhase) return fail('此 BG 本回合已行動過')
  if (bg.state === 'ko') return fail('KO 狀態的 BG 無法行動')
  if (bg.state === 'stunned') return fail('暈眩狀態的 BG 無法行動（除非技能允許）')
  return OK
}

function canMoveBG(state: GameState, player: PlayerId, toZone: ZoneId, ignoreBlock?: boolean): GuardResult {
  if (state.phase !== 'action') return fail('不在行動階段')
  if (state.currentPlayer !== player) return fail('不是你的回合')
  const bgId = state.actingBGId
  if (!bgId) return fail('沒有 BG 正在行動')
  const bg = state.bgs[bgId]
  // freeMovePending（靈動反應）允許額外移動一次，無視 movedThisAction 與 cantMoveThisTurn
  if (!bg.freeMovePending) {
    if (bg.movedThisAction) return fail('此次行動已移動過')
    if (bg.cantMoveThisTurn) return fail('此 BG 本回合不能移動')
  }

  // 相鄰區域檢查
  const zones: ZoneId[] = ['p1_base', 'plaza', 'p2_base']
  const fromIdx = zones.indexOf(bg.zone)
  const toIdx = zones.indexOf(toZone)
  if (Math.abs(fromIdx - toIdx) > 1) return fail('只能移動到相鄰區域')
  if (fromIdx === toIdx) return OK  // 留在原地

  // 磚堆阻擋（移向敵方主堡時受阻；靈動的 freeMovePending 不跳過磚堆阻擋）
  if (!ignoreBlock) {
    const enemy = opponentOf(player)
    const enemyBase = homeZone(enemy)
    if (toZone === enemyBase && bg.zone === 'plaza') {
      if (isPlazaBlocked(state, player)) return fail('敵方廣場磚堆阻止你移動到敵主堡區')
    }
  }
  return OK
}

function canUseSkill(state: GameState, player: PlayerId, skillIndex: 0 | 1, fromBGId?: string): GuardResult {
  if (state.phase !== 'action') return fail('不在行動階段')
  if (state.currentPlayer !== player) return fail('不是你的回合')
  const actingId = state.actingBGId
  if (!actingId) return fail('沒有 BG 正在行動')
  const actingBG = state.bgs[actingId]
  if (actingBG.usedSkillThisAction) return fail('此次行動已使用過技能')

  // 決定施放技能的 BG（actingBG 或指定的聯合 ally）
  let casterBG = actingBG
  if (fromBGId) {
    if (fromBGId === actingId) return fail('fromBGId 不需要等於 actingBGId，留空即可')
    const ally = state.bgs[fromBGId]
    if (!ally) return fail('找不到指定的聯合 BG')
    if (ally.owner !== player) return fail('只能讓自己的 BG 施放技能')
    if (ally.zone !== actingBG.zone) return fail('聯合技能施放者必須與行動 BG 在同一區域')
    if (ally.state === 'ko') return fail('KO 狀態的 BG 無法施放技能')
    if (ally.actedThisPhase) return fail('此 BG 本回合已行動過，不能作為聯合對象')
    if (ally.usedSkillThisAction) return fail('聯合 BG 本次行動已使用過技能')
    // 若已宣告聯合 ally，必須使用同一個
    if (state.jointAllyId && state.jointAllyId !== fromBGId) return fail('聯合對象已鎖定，不能更換')
    casterBG = ally
  }

  if (casterBG.skillCooldowns[skillIndex] > 0) return fail(`技能冷卻中（剩 ${casterBG.skillCooldowns[skillIndex]} 回合）`)
  const def = bgCardById[casterBG.cardId]
  const skill = def?.skills[skillIndex]
  if (!skill) return fail('找不到技能定義')
  if (casterBG.state === 'stunned' && !skill.canUseWhenStunned) return fail(`暈眩狀態無法使用 ${skill.name}`)
  const handCost = skill.handCost ?? 0
  if (handCost > 0 && state.players[player].hand.length < handCost) {
    return fail(`手牌不足（需要${handCost}張，目前${state.players[player].hand.length}張）`)
  }
  return OK
}

function canDoAttack(state: GameState, player: PlayerId, targetBGId: string, allyId?: string): GuardResult {
  if (state.phase !== 'action') return fail('不在行動階段')
  if (state.currentPlayer !== player) return fail('不是你的回合')
  const bgId = state.actingBGId
  if (!bgId) return fail('沒有 BG 正在行動')
  const bg = state.bgs[bgId]
  if (bg.state === 'stunned') return fail('暈眩狀態的 BG 無法執行對敵')
  if (bg.doneNormalAction) return fail('本次行動已執行過通常動作')
  const target = state.bgs[targetBGId]
  if (!target) return fail('找不到目標 BG')
  if (target.owner === player) return fail('不能攻擊自己的 BG')
  if (target.state === 'ko') return fail('KO 狀態的 BG 不能被攻擊')
  if (target.zone !== bg.zone) return fail('目標不在同一區域')
  // 若已透過 USE_SKILL(fromBGId) 宣告聯合 ally，攻擊必須帶上同一個 ally
  if (state.jointAllyId && allyId !== state.jointAllyId) return fail('已宣告聯合對象，此次攻擊必須帶上該聯合 BG')
  if (allyId) {
    const ally = state.bgs[allyId]
    if (!ally || ally.owner !== player) return fail('ally 不屬於你')
    if (ally.state === 'stunned' || ally.state === 'ko') return fail('暈眩/KO 狀態的 BG 不能作為聯合攻擊隊友')
    if (ally.actedThisPhase) return fail('此 BG 本回合已行動過，不能作為聯合對象')
    if (ally.zone !== state.bgs[bgId!]?.zone) return fail('聯合對象必須在同一區域')
  }
  return OK
}

function canDoClearBrick(state: GameState, player: PlayerId, areaId: BrickAreaId, slotIndex?: number): GuardResult {
  if (state.phase !== 'action') return fail('不在行動階段')
  if (state.currentPlayer !== player) return fail('不是你的回合')
  const bgId = state.actingBGId
  if (!bgId) return fail('沒有 BG 正在行動')
  const bg = state.bgs[bgId]
  if (bg.state === 'stunned') return fail('暈眩狀態的 BG 無法執行清磚')
  if (bg.doneNormalAction) return fail('本次行動已執行過通常動作')

  // 只能清除敵方磚堆
  if (areaId.startsWith(player)) return fail('不能清除自己的磚堆')

  const area = state.brickAreas[areaId]
  if (area.slots.length === 0) return fail('目標磚堆為空')

  // 位置對應規則：廣場清廣場磚，前線清主堡磚
  const validAreas = getClearTargetAreas(bg.zone, player)
  if (!validAreas.includes(areaId)) {
    return fail(`此位置只能清除 ${validAreas.join(' 或 ')}`)
  }

  // 中繼點限制：只有 BLC 職業才能清除
  const slotIdx = slotIndex != null ? slotIndex : area.slots.length - 1
  const targetSlot = area.slots[slotIdx]
  if (targetSlot?.isBuilding && targetSlot.cardId === 'relay_point' && bg.bgClass !== 'BLC') {
    return fail('中繼點只有 BLC 職業的清磚動作才能移除')
  }
  return OK
}

/** 根據 BG 當前位置，可清除的敵方磚堆 */
export function getClearTargetAreas(zone: ZoneId, player: PlayerId): BrickAreaId[] {
  const enemy = opponentOf(player)
  if (zone === 'plaza') return [`${enemy}_plaza` as BrickAreaId]
  if (zone === homeZone(enemy)) return [`${enemy}_base` as BrickAreaId]
  return []  // 自己主堡無法清磚
}

function canDoSiege(state: GameState, player: PlayerId): GuardResult {
  if (state.phase !== 'action') return fail('不在行動階段')
  if (state.currentPlayer !== player) return fail('不是你的回合')
  const bgId = state.actingBGId
  if (!bgId) return fail('沒有 BG 正在行動')
  const bg = state.bgs[bgId]
  if (bg.state === 'stunned') return fail('暈眩狀態的 BG 無法攻城')
  if (bg.doneNormalAction) return fail('本次行動已執行過通常動作')
  if (bg.zone !== frontZone(player)) return fail('只有在敵主堡區才能攻城')
  if (isSiegeBlocked(state, player)) return fail('敵方主堡磚堆阻止攻城')
  return OK
}

function canEndBGAction(state: GameState, player: PlayerId): GuardResult {
  if (state.phase !== 'action') return fail('不在行動階段')
  if (state.currentPlayer !== player) return fail('不是你的回合')
  if (!state.actingBGId) return fail('沒有 BG 正在行動')
  return OK
}

// ── 反應階段 ─────────────────────────────────────

function canInstallReaction(state: GameState, player: PlayerId, bgId: string, cardId: string): GuardResult {
  if (state.phase !== 'react') return fail('不在反應階段')
  if (state.currentPlayer !== player) return fail('不是你的回合')
  const bg = state.bgs[bgId]
  if (!bg || bg.owner !== player) return fail('找不到你的 BG')
  const hand = state.players[player].hand
  if (!hand.includes(cardId)) return fail('手牌中沒有此反應卡')
  const def = reactionById[cardId]
  if (!def) return fail('找不到反應卡定義')
  if (def.suitableClass !== 'ALL' && def.suitableClass !== bg.bgClass) {
    return fail(`${def.name} 不適合 ${bg.bgClass} 職業`)
  }
  return OK
}

// ── 通用 ─────────────────────────────────────────

function canNextPhase(state: GameState, player: PlayerId): GuardResult {
  if (state.currentPlayer !== player) return fail('不是你的回合')
  if (state.actingBGId !== null) return fail('有 BG 正在行動，請先結束')
  return OK
}

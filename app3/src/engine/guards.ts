// Beast Conquest Engine — 動作驗證（Guards）（3-zone redesign）

import type { GameState } from './state'
import type { Action } from './actions'
import type { ZoneId } from './types'
import { getAdjacentZones, isEnemyZone, enemyLairZone } from './types'
import { getLegionCard, getTacticalCard, getLeaderPassive, getEventCard } from './cards'

export type GuardResult = { ok: true } | { ok: false; reason: string }

const ok = (): GuardResult => ({ ok: true })
const err = (reason: string): GuardResult => ({ ok: false, reason })

export function canDispatch(state: GameState, action: Action): GuardResult {
  if (state.winner) return err('Game is already over')

  switch (action.type) {
    case 'NEXT_PHASE':        return ok()
    case 'SURRENDER':         return ok()
    case 'MOVE':              return canMove(state, action.leaderId, action.toZone)
    case 'ATTACK':            return canAttack(state, action.attackerId, action.targetId)
    case 'CLEAR_FORT':        return canClearFort(state, action.leaderId)
    case 'SIEGE':             return canSiege(state, action.leaderId)
    case 'SKILL':             return canUseSkill(state, action.leaderId)
    case 'SUMMON_LEGION':     return canSummonLegion(state, action.cardId, action.leaderId)
    case 'INSTALL_TACTICAL':  return canInstallTactical(state, action.cardId, action.leaderId)
    case 'PLAY_EVENT':        return canPlayEvent(state, action.cardId, action.discardIds)
    default:                  return err('Unknown action type')
  }
}

// ── 個別 Guard ────────────────────────────────────────

export function canMove(state: GameState, leaderId: string, toZone: ZoneId): GuardResult {
  if (state.phase !== 'battle') return err('Can only move in battle phase')

  const leader = state.leaders[leaderId]
  if (!leader) return err('Leader not found')
  if (leader.owner !== state.currentPlayer) return err('Not your leader')
  if (leader.state !== 'normal') return err('Leader is not in normal state')
  if (leader.immobilized) return err('Leader is immobilized')

  // double_move 被動允許每階段移動 2 次，否則只能移動 1 次
  const passive = getLeaderPassive(leader)
  const maxMoves = passive?.type === 'double_move' ? 2 : 1
  if (leader.moveCount >= maxMoves) return err('Leader already moved this turn')

  const adj = getAdjacentZones(leader.zone)
  if (!adj.includes(toZone)) return err('Target zone not adjacent')

  // 進入敵方基地需要該基地 fortLevel = 0（ignore_fortification 被動可繞過）
  if (isEnemyZone(toZone, state.currentPlayer)) {
    const zone = state.zones[toZone]
    if (zone.fortLevel > 0 && passive?.type !== 'ignore_fortification') {
      return err(`Enemy base is fortified (fortLevel ${zone.fortLevel})`)
    }
  }

  return ok()
}

export function canAttack(
  state: GameState,
  attackerId: string,
  targetId: string
): GuardResult {
  if (state.phase !== 'battle') return err('Can only attack in battle phase')
  if (state.actedLeaders.includes(attackerId)) return err('Leader has already acted this turn')

  const attacker = state.leaders[attackerId]
  if (!attacker) return err('Attacker not found')
  if (attacker.owner !== state.currentPlayer) return err('Not your attacker')
  if (attacker.state !== 'normal') return err('Attacker not in normal state')
  if (attacker.moveCount > 0) return err('Leader has moved this turn and cannot attack')

  const target = state.leaders[targetId]
  if (!target) return err('Target not found')
  if (target.owner === state.currentPlayer) return err('Cannot attack own leader')
  if (target.state === 'ko' || target.state === 'reviving') return err('Target is KO/reviving')

  // 同區域攻擊
  if (attacker.zone !== target.zone) return err('Can only attack targets in same zone')

  return ok()
}

export function canClearFort(state: GameState, leaderId: string): GuardResult {
  if (state.phase !== 'battle') return err('Can only clear fort in battle phase')
  if (state.actedLeaders.includes(leaderId)) return err('Leader has already acted this turn')

  const leader = state.leaders[leaderId]
  if (!leader) return err('Leader not found')
  if (leader.owner !== state.currentPlayer) return err('Not your leader')
  if (leader.state !== 'normal') return err('Leader is not in normal state')

  // 必須在 plaza
  if (leader.zone !== 'plaza') return err('Leader must be in plaza to clear fort')

  // 本回合已移動不可清磚
  if (leader.moveCount > 0) return err('Leader has moved this turn and cannot clear fort')

  // 敵方基地 fortLevel > 0
  const enemyBase = enemyLairZone(state.currentPlayer)
  const zone = state.zones[enemyBase]
  if (zone.fortLevel <= 0) return err('Enemy base has no fortification to clear')

  return ok()
}

export function canSiege(state: GameState, leaderId: string): GuardResult {
  if (state.phase !== 'battle') return err('Can only siege in battle phase')
  if (state.actedLeaders.includes(leaderId)) return err('Leader has already acted this turn')

  const leader = state.leaders[leaderId]
  if (!leader) return err('Leader not found')
  if (leader.owner !== state.currentPlayer) return err('Not your leader')
  if (leader.state !== 'normal') return err('Leader is not in normal state')

  // 必須在敵方基地
  const enemyBase = enemyLairZone(state.currentPlayer)
  if (leader.zone !== enemyBase) return err('Leader must be in enemy base to siege')

  // 本回合已移動不可攻城
  if (leader.moveCount > 0) return err('Leader has moved this turn and cannot siege')

  const zone = state.zones[enemyBase]
  if (zone.fortLevel > 0) return err('Enemy base is still fortified')
  if (zone.cityWalls <= 0) return err('Enemy base has no city walls remaining')

  return ok()
}

export function canUseSkill(state: GameState, leaderId: string): GuardResult {
  if (state.phase !== 'battle') return err('Can only use skill in battle phase')
  if (state.actedLeaders.includes(leaderId)) return err('Leader has already acted this turn')

  const leader = state.leaders[leaderId]
  if (!leader) return err('Leader not found')
  if (leader.owner !== state.currentPlayer) return err('Not your leader')
  if (leader.state !== 'normal') return err('Leader is not in normal state')
  if (leader.skillCooldown > 0) return err(`Skill on cooldown (${leader.skillCooldown} turns)`)
  if (leader.moveCount > 0) return err('Leader has moved this turn and cannot use skill')

  return ok()
}

export function canSummonLegion(
  state: GameState,
  cardId: string,
  leaderId: string
): GuardResult {
  if (state.phase !== 'main') return err('Can only summon legion in main phase')

  const player = state.currentPlayer
  const ps = state.players[player]
  if (!ps) return err('Player state not found')
  if (!ps.hand.includes(cardId)) return err('Card not in hand')
  if (ps.normalSummonUsed) return err('Normal summon already used this turn')
  if (!getLegionCard(cardId)) return err('Unknown legion card')

  const leader = state.leaders[leaderId]
  if (!leader) return err('Leader not found')
  if (leader.owner !== player) return err('Not your leader')
  if (leader.state === 'ko' || leader.state === 'reviving') return err('Leader is KO/reviving')
  if (leader.legions.length >= leader.legionSlots) return err('No legion slots available')

  return ok()
}

export function canInstallTactical(
  state: GameState,
  cardId: string,
  leaderId: string
): GuardResult {
  if (state.phase !== 'react') return err('Can only install tactical in react phase')

  const player = state.currentPlayer
  const ps = state.players[player]
  if (!ps) return err('Player state not found')
  if (!ps.hand.includes(cardId)) return err('Card not in hand')
  if (!getTacticalCard(cardId)) return err('Not a tactical card')

  const leader = state.leaders[leaderId]
  if (!leader) return err('Leader not found')
  if (leader.owner !== player) return err('Not your leader')
  if (leader.state === 'ko' || leader.state === 'reviving') return err('Leader is KO/reviving')
  if (leader.tacticalCard !== null) return err('Leader already has a tactical card installed')

  return ok()
}

export function canPlayEvent(state: GameState, cardId: string, discardIds: string[]): GuardResult {
  if (state.phase !== 'main') return err('Can only play events in main phase')

  const player = state.currentPlayer
  const ps = state.players[player]
  if (!ps.hand.includes(cardId)) return err('Card not in hand')

  const edef = getEventCard(cardId)
  if (!edef) return err('Not an event card')

  if (discardIds.length !== edef.cost.discard) return err(`Must discard exactly ${edef.cost.discard} cards`)
  for (const id of discardIds) {
    if (id === cardId) return err('Cannot discard the event card itself as cost')
    if (!ps.hand.includes(id)) return err(`Discard card ${id} not in hand`)
  }

  return ok()
}

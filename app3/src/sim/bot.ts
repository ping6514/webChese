// Beast Conquest — Bot 決策（unified scoring epsilon-greedy）（3-zone redesign）

import type { GameState } from '../engine/state'
import { totalAttack, totalToughness, totalSupport } from '../engine/state'
import type { Action } from '../engine/actions'
import type { PlayerId } from '../engine/types'
import {
  lairZone, enemyLairZone, isEnemyZone, getAdjacentZones, ZONE_ORDER,
} from '../engine/types'
import { listLegalActions, listEquipmentActions } from '../engine/reduce'
import { getLegionCard, getTacticalCard } from '../engine/cards'
import type { BotWeights } from './botWeights'
import { BASE_WEIGHTS } from './botWeights'

export type BotCtx = {
  seed: number
  epsilon?: number
  weights?: BotWeights
}

// ── seeded PRNG ──────────────────────────────────────

function makePrng(seed: number) {
  let s = seed >>> 0
  return (): number => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

// ── 主決策函式 ────────────────────────────────────────

/**
 * 對所有合法動作統一評分，回傳最高分的那個（epsilon-greedy）。
 */
export function decideAction(
  state: GameState,
  player: PlayerId,
  ctx: BotCtx
): Action {
  // main 階段：決定是否召喚軍團
  if (state.phase === 'main') {
    return decideMainPhase(state, player, ctx)
  }

  // react 階段：決定是否安裝戰術卡
  if (state.phase === 'react') {
    return decideReactPhase(state, player, ctx)
  }

  if (state.phase !== 'battle') return { type: 'NEXT_PHASE' }

  const rng = makePrng(ctx.seed + state.turn * 97 + (player === 'p1' ? 0 : 1000))
  const epsilon = ctx.epsilon ?? 0.15
  const weights = ctx.weights ?? BASE_WEIGHTS

  const actions = listLegalActions(state)
  if (actions.length === 0) return { type: 'NEXT_PHASE' }

  const scored = actions.map((a) => ({ action: a, score: scoreAction(state, player, a, weights) }))

  if (rng() < epsilon) {
    const candidates = scored.filter((x) => x.score > -500)
    if (candidates.length > 0) {
      return candidates[Math.floor(rng() * candidates.length)].action
    }
  }

  scored.sort((a, b) => b.score - a.score)
  return scored[0].action
}

// ── main 階段決策 ──────────────────────────────────────

function decideMainPhase(state: GameState, player: PlayerId, ctx: BotCtx): Action {
  const rng = makePrng(ctx.seed + state.turn * 53)
  const weights = ctx.weights ?? BASE_WEIGHTS
  const actions = listEquipmentActions(state)
  // listEquipmentActions 在 main 階段回傳 SUMMON_LEGION actions
  const installable = actions.filter((a) => a.type === 'SUMMON_LEGION')

  // 也考慮事件卡
  const allActions = listLegalActions(state)
  const eventActions = allActions.filter(a => a.type === 'PLAY_EVENT')

  const candidates = [...installable, ...eventActions]
  if (candidates.length === 0) return { type: 'NEXT_PHASE' }

  const best = pickEpsilonGreedy(
    candidates,
    (a) => scoreMainPhaseAction(state, player, a, weights),
    rng,
    ctx.epsilon ?? 0.15
  )

  return best ?? { type: 'NEXT_PHASE' }
}

// ── react 階段決策 ──────────────────────────────────────

function decideReactPhase(state: GameState, player: PlayerId, ctx: BotCtx): Action {
  const rng = makePrng(ctx.seed + state.turn * 71)
  const weights = ctx.weights ?? BASE_WEIGHTS
  const actions = listEquipmentActions(state)
  const installable = actions.filter((a) => a.type === 'INSTALL_TACTICAL')

  if (installable.length === 0) return { type: 'NEXT_PHASE' }

  const best = pickEpsilonGreedy(
    installable,
    (a) => scoreMainPhaseAction(state, player, a, weights),
    rng,
    ctx.epsilon ?? 0.15
  )

  return best ?? { type: 'NEXT_PHASE' }
}

function scoreMainPhaseAction(state: GameState, player: PlayerId, action: Action, _weights: BotWeights): number {
  if (action.type === 'SUMMON_LEGION') {
    const leader = state.leaders[action.leaderId]
    const card = getLegionCard(action.cardId)
    if (!leader || !card) return 0
    const leaderAttackScore = totalAttack(leader) * 50
    const cardOffenseScore = (card.bonusAttack + card.bonusSupport) * 100
    const cardDefenseScore = card.bonusToughness * 30
    return leaderAttackScore + cardOffenseScore + cardDefenseScore
  }

  if (action.type === 'INSTALL_TACTICAL') {
    const leader = state.leaders[action.leaderId]
    const card = getTacticalCard(action.cardId)
    if (!leader || !card) return 0

    const isExposed = isEnemyZone(leader.zone, player)
    const isFrontline = leader.zone !== lairZone(player)
    const positionScore = isExposed ? 500 : isFrontline ? 300 : 150
    const vulnerabilityScore = Math.max(0, 8 - totalToughness(leader)) * 40
    const triggerScore =
      card.trigger === 'on_receive_damage' ? 250 :
      card.trigger === 'on_stunned' ? 200 :
      card.trigger === 'on_enemy_enter_zone' ? 180 :
      card.trigger === 'on_enemy_clear_brick' ? 160 :
      card.trigger === 'on_ko' ? 120 : 100

    return positionScore + vulnerabilityScore + triggerScore
  }

  if (action.type === 'PLAY_EVENT') {
    return scorePlayEvent(state, player, action.cardId, _weights)
  }

  return 0
}

// ── 統一評分 ──────────────────────────────────────────

function scoreAction(state: GameState, player: PlayerId, action: Action, weights: BotWeights): number {
  switch (action.type) {
    case 'NEXT_PHASE': {
      // 如果還有首領可以行動，不建議跳過
      const unacted = Object.values(state.leaders).filter(
        l => l.owner === player && l.state === 'normal' && !state.actedLeaders.includes(l.id)
      )
      return unacted.length > 0 ? -200 : 0
    }

    case 'MOVE':
      return scoreMoveAction(state, player, action.leaderId, action.toZone, weights)

    case 'ATTACK': {
      return scoreAttackAction(state, action.attackerId, action.targetId, weights)
    }

    case 'CLEAR_FORT':
      return scoreClearFort(state, player, action.leaderId, weights)

    case 'SIEGE':
      return weights.lairSiege * 7000 + 2000

    case 'SKILL':
      return scoreSkill(state, player, action.leaderId, weights)

    case 'PLAY_EVENT':
      return scorePlayEvent(state, player, action.cardId, weights)

    default:
      return 0
  }
}

// ── 移動評分 ──────────────────────────────────────────

function scoreMoveAction(
  state: GameState,
  player: PlayerId,
  leaderId: string,
  toZone: import('../engine/types').ZoneId,
  weights: BotWeights
): number {
  const leader = state.leaders[leaderId]
  if (!leader || leader.moveCount > 0) return -9999

  const enemyBase = enemyLairZone(player)
  const enemyZone = state.zones[enemyBase]
  const lairIdx = ZONE_ORDER.indexOf(enemyBase)
  const curIdx = ZONE_ORDER.indexOf(leader.zone)
  const toIdx = ZONE_ORDER.indexOf(toZone)

  const curDist = Math.abs(curIdx - lairIdx)
  const toDist = Math.abs(toIdx - lairIdx)

  if (toDist > curDist) return -150

  const advanceScore = (curDist - toDist) * weights.moveAdvance * 300

  // 進入敵方基地（sieging）
  const invasionBonus = isEnemyZone(toZone, player) ? 600 : 0

  let potentialBonus = 0

  // 若敵方基地築城=0，進入敵方基地可攻城
  if (isEnemyZone(toZone, player) && enemyZone.fortLevel === 0 && enemyZone.cityWalls > 0) {
    potentialBonus += 800
  }

  // 若在 plaza，且敵方基地有築城，可以清磚
  if (toZone === 'plaza' && enemyZone.fortLevel > 0) {
    potentialBonus += (enemyZone.fortLevel === 1 ? 400 : 200)
  }

  // 若敵方基地築城>0，前往 plaza 有清磚機會
  for (const adj of getAdjacentZones(toZone)) {
    if (isEnemyZone(adj, player) && state.zones[adj].fortLevel > 0) {
      potentialBonus += state.zones[adj].fortLevel === 1 ? 300 : 100
    }
  }

  return advanceScore + invasionBonus + potentialBonus
}

// ── 攻擊評分 ──────────────────────────────────────────

function scoreAttackAction(
  state: GameState,
  attackerId: string,
  targetId: string,
  weights: BotWeights
): number {
  const target = state.leaders[targetId]
  const attacker = state.leaders[attackerId]
  if (!target || !attacker) return 0

  // 估算傷害（簡化：不含所有被動光環，只算攻擊力 + 同區域友軍支援）
  const atkDmg = totalAttack(attacker)
  const supportDmg = Object.values(state.leaders)
    .filter(l => l.owner === attacker.owner && l.id !== attacker.id && l.zone === attacker.zone && l.state === 'normal')
    .reduce((sum, l) => sum + totalSupport(l), 0)
  const damage = atkDmg + supportDmg

  const t = totalToughness(target)

  let score = 0
  if (target.state === 'stunned' || damage >= t * 2) {
    // KO
    score += weights.attackKo * 7500
  } else if (damage >= t) {
    // 擊暈
    score += weights.attackStun * 5000
  } else {
    // 造成傷害但不足以擊暈
    const ratio = damage / t
    score += ratio * 800
  }

  if (isEnemyZone(target.zone, state.currentPlayer)) score += 200

  return score
}

// ── 清磚評分 ──────────────────────────────────────────

function scoreClearFort(
  state: GameState,
  player: PlayerId,
  leaderId: string,
  weights: BotWeights
): number {
  const leader = state.leaders[leaderId]
  if (!leader) return 0

  const enemyBase = enemyLairZone(player)
  const fort = state.zones[enemyBase].fortLevel

  if (fort === 1) {
    return weights.fortBreak * 4000
  }

  return weights.fortProgress * 2000
}

// ── 技能評分 ──────────────────────────────────────────

function scoreSkill(
  state: GameState,
  player: PlayerId,
  leaderId: string,
  weights: BotWeights
): number {
  const leader = state.leaders[leaderId]
  if (!leader) return 0

  const base = weights.skill

  switch (leader.leaderClass) {
    case 'destroyer': {
      const dmg = Math.max(1, Math.ceil(totalAttack(leader) / 2))
      const enemies = Object.values(state.leaders).filter(
        (e) => e.owner !== player &&
               (e.state === 'normal' || e.state === 'stunned') &&
               e.zone === leader.zone
      )
      if (enemies.length === 0) return -100
      let score = 0
      for (const e of enemies) {
        const t = totalToughness(e)
        if (e.state === 'stunned' || dmg >= t * 2) score += 4000
        else if (dmg >= t) score += 2500
        else score += 300
      }
      return score * base
    }

    case 'conqueror': {
      const enemyBase = enemyLairZone(player)
      const lairIdx = ZONE_ORDER.indexOf(enemyBase)
      const curDist = Math.abs(ZONE_ORDER.indexOf(leader.zone) - lairIdx)
      const adj = getAdjacentZones(leader.zone)
      const bestDist = Math.min(
        ...adj.map((z) => Math.abs(ZONE_ORDER.indexOf(z) - lairIdx))
      )
      if (bestDist >= curDist) return -100
      // 最有價值：衝進有築城的敵方區域
      const hasBlockedAdvance = adj.some(
        (z) => Math.abs(ZONE_ORDER.indexOf(z) - lairIdx) < curDist &&
               isEnemyZone(z, player) && state.zones[z].fortLevel > 0
      )
      return (hasBlockedAdvance ? 1200 : 400) * base
    }

    case 'commander': {
      // 號令 = 抽2牌，卡牌優勢在手牌較少時更有價值
      const handSize = (state.players[player]?.hand.length ?? 0)
      return (handSize < 3 ? 600 : handSize < 5 ? 400 : 200) * base
    }

    case 'guardian': {
      // 純防禦：加強己方基地築城
      const ownBase = lairZone(player)
      const ownFort = leader.zone !== 'plaza'
        ? state.zones[leader.zone].fortLevel
        : state.zones[ownBase].fortLevel
      if (ownFort >= 3) return -50   // 已滿，沒必要用
      // 敵方已突破我方防線時更有價值
      const enemyInOwnBase = Object.values(state.leaders).some(
        l => l.owner !== player && l.zone === ownBase && l.state === 'normal'
      )
      const urgency = enemyInOwnBase ? 3 : 1
      return (ownFort === 0 ? 600 : ownFort === 1 ? 400 : 200) * base * urgency
    }

    default:
      return 0
  }
}

// ── 事件評分 ─────────────────────────────────────────

function scorePlayEvent(
  _state: GameState, _player: PlayerId, cardId: string, _weights: BotWeights
): number {
  switch (cardId) {
    case 'battle_cry':      return 700
    case 'mass_stun':       return 800
    case 'rush_time':       return 600
    case 'freeze':          return 500
    case 'ambush':          return 600
    case 'divine_blessing': return 400
    case 'draw_cards':      return 300
    case 'forced_march':    return 350
    case 'tactical_retreat':return 250
    case 'emergency_repair':return 300
    default: return 200
  }
}

// ── 工具函式 ──────────────────────────────────────────

function pickEpsilonGreedy<T>(
  arr: T[],
  getScore: (t: T) => number,
  rng: () => number,
  epsilon: number
): T | undefined {
  if (arr.length === 0) return undefined
  if (rng() < epsilon) return arr[Math.floor(rng() * arr.length)]
  return arr.reduce((best, cur) => (getScore(cur) >= getScore(best) ? cur : best))
}

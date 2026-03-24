// BG Card Game — 簡易 Bot（貪心策略）

import type { GameState, BGInstance } from '../engine/state'
import {
  getEnemyBGsInZone, getAllyBGsInZone,
  effectiveAttack, effectiveSupport, effectiveHP,
  isPlazaBlocked,
} from '../engine/state'
import type { Action, SkillParams } from '../engine/actions'
import { canDispatch } from '../engine/guards'
import type { PlayerId, ZoneId, BrickAreaId } from '../engine/types'
import { opponentOf, homeZone, frontZone } from '../engine/types'
import { bgCardById } from '../data/bg-cards'
import { reactionById } from '../data/reactions'
import { type BotWeights, type ActionCategory, DYNAMIC_WEIGHTS } from './botWeights'

/** 回傳 bot 在此回合想執行的行動 */
export function botDecide(state: GameState, player: PlayerId, weights: BotWeights = DYNAMIC_WEIGHTS): Action {
  const phase = state.phase
  if (state.currentPlayer !== player) return { type: 'NEXT_PHASE' }

  switch (phase) {
    case 'draw':   return decideDrawPhase(state, player)
    case 'main':   return decideMainPhase(state, player, weights)
    case 'action': return decideActionPhase(state, player)
    case 'react':  return decideReactPhase(state, player, weights)
    case 'end':    return { type: 'NEXT_PHASE' }
    default:       return { type: 'NEXT_PHASE' }
  }
}

/** 卡片預設優先分（無訓練資料時使用） */
export const DEFAULT_CARD_WEIGHTS: Record<string, number> = {
  // 事件卡
  rush_time:       99,   // 條件達到必打，不參與競爭
  fighting_spirit: 2.5,
  joystick_fail:   2.5,
  go_home:         2.0,
  see_through:     2.0,
  best_partner:    2.5,
  call_friends:    2.0,
  reaction_master: 1.5,
  // 建築卡
  city_gate:       2.5,
  mob_group:       2.0,
  relay_point:     2.0,
  // 反應卡
  dodge:            3.5,
  calm_thinking:    3.0,
  block:            3.0,
  mutual_destruction: 3.5,
  mislead:          3.0,
  agile:            3.5,
  intimidate:       3.5,
}

function cardScore(id: string, weights: BotWeights): number {
  return weights.cardWeights[id] ?? DEFAULT_CARD_WEIGHTS[id] ?? 2.0
}

// ── 補充階段 ─────────────────────────────────────

function decideDrawPhase(s: GameState, player: PlayerId): Action {
  if (s.drawActionsUsed >= 2) return { type: 'NEXT_PHASE' }

  // 抽牌（補磚僅限BLC技能，補充階段不再提供系統砌磚）
  const ok = canDispatch(s, player, { type: 'DRAW_CARD' })
  if (ok.ok) return { type: 'DRAW_CARD' }

  return { type: 'NEXT_PHASE' }
}

// ── 主要階段 ─────────────────────────────────────

function decideMainPhase(s: GameState, player: PlayerId, weights: BotWeights): Action {
  const hand = s.players[player].hand
  const enemy = opponentOf(player)
  type CardCandidate = { action: Action; cardId: string; score: number }
  const candidates: CardCandidate[] = []

  // 手牌保護門檻：手牌 ≤ 3 時留牌給反應卡，只考慮高分卡
  const handGate = hand.length <= 3 ? 3.0 : 0

  // RUSH TIME：條件達到直接打，不參與計分競爭
  if (!s.rushTimeUsed && s.cityWalls[player] <= s.cityWalls[enemy] - 2 && hand.includes('rush_time')) {
    const ok = canDispatch(s, player, { type: 'PLAY_EVENT', cardId: 'rush_time', params: {} })
    if (ok.ok) return { type: 'PLAY_EVENT', cardId: 'rush_time', params: {} }
  }

  // 氣合
  if (hand.includes('fighting_spirit')) {
    const myBGs = Object.values(s.bgs).filter(bg => bg.owner === player && bg.state !== 'ko')
    if (myBGs.length > 0) {
      const target = myBGs.sort((a, b) => effectiveHP(a) - effectiveHP(b))[0]
      const action: Action = { type: 'PLAY_EVENT', cardId: 'fighting_spirit', params: { targetBGId: target.id } }
      if (canDispatch(s, player, action).ok)
        candidates.push({ action, cardId: 'fighting_spirit', score: cardScore('fighting_spirit', weights) })
    }
  }

  // 搖桿失靈
  if (hand.includes('joystick_fail')) {
    const enemyBGs = Object.values(s.bgs).filter(bg => bg.owner === enemy && bg.state === 'normal')
    if (enemyBGs.length > 0) {
      const target = enemyBGs.sort((a, b) => effectiveAttack(b) - effectiveAttack(a))[0]
      const action: Action = { type: 'PLAY_EVENT', cardId: 'joystick_fail', params: { targetBGId: target.id } }
      if (canDispatch(s, player, action).ok)
        candidates.push({ action, cardId: 'joystick_fail', score: cardScore('joystick_fail', weights) })
    }
  }

  // 回家
  if (hand.includes('go_home')) {
    const stunnedBG = Object.values(s.bgs).find(bg => bg.owner === player && bg.state === 'stunned')
    if (stunnedBG) {
      const action: Action = { type: 'PLAY_EVENT', cardId: 'go_home', params: { targetBGId: stunnedBG.id } }
      if (canDispatch(s, player, action).ok)
        candidates.push({ action, cardId: 'go_home', score: cardScore('go_home', weights) })
    }
  }

  // 看穿
  if (hand.includes('see_through')) {
    const withReaction = Object.values(s.bgs).filter(bg => bg.owner === enemy && bg.reactionCard && bg.state !== 'ko')
    if (withReaction.length > 0) {
      const target = withReaction.sort((a, b) => effectiveAttack(b) - effectiveAttack(a))[0]
      const action: Action = { type: 'PLAY_EVENT', cardId: 'see_through', params: { targetBGId: target.id } }
      if (canDispatch(s, player, action).ok)
        candidates.push({ action, cardId: 'see_through', score: cardScore('see_through', weights) })
    }
  }

  // 最佳拍檔
  if (hand.includes('best_partner')) {
    const zones: ZoneId[] = [homeZone(player), 'plaza', homeZone(enemy)]
    for (const z of zones) {
      if (getAllyBGsInZone(s, z, player).filter(bg => bg.state !== 'ko').length >= 2) {
        const action: Action = { type: 'PLAY_EVENT', cardId: 'best_partner', params: { targetZone: z } }
        if (canDispatch(s, player, action).ok) {
          candidates.push({ action, cardId: 'best_partner', score: cardScore('best_partner', weights) })
          break
        }
      }
    }
  }

  // 呼朋引伴
  if (hand.includes('call_friends')) {
    const myBGs = Object.values(s.bgs).filter(bg => bg.owner === player && bg.state !== 'ko')
    const frontBG = myBGs.find(bg => bg.zone === frontZone(player))
    const plazaBG = myBGs.find(bg => bg.zone === 'plaza')
    const homeBG  = myBGs.find(bg => bg.zone === homeZone(player))
    const pair = (frontBG && plazaBG)
      ? { targetBGId: frontBG.id, targetBGId2: plazaBG.id }
      : (plazaBG && homeBG)
        ? { targetBGId: plazaBG.id, targetBGId2: homeBG.id }
        : null
    if (pair) {
      const action: Action = { type: 'PLAY_EVENT', cardId: 'call_friends', params: pair }
      if (canDispatch(s, player, action).ok)
        candidates.push({ action, cardId: 'call_friends', score: cardScore('call_friends', weights) })
    }
  }

  // 反應大師
  if (hand.includes('reaction_master') && hand.length >= 2) {
    const discardId = hand.find(id => id !== 'reaction_master' && !reactionById[id])
    if (discardId) {
      const action: Action = { type: 'PLAY_EVENT', cardId: 'reaction_master', params: { discardCardId: discardId } }
      if (canDispatch(s, player, action).ok)
        candidates.push({ action, cardId: 'reaction_master', score: cardScore('reaction_master', weights) })
    }
  }

  // 建築卡
  for (const cardId of ['city_gate', 'mob_group', 'relay_point'] as const) {
    if (!hand.includes(cardId)) continue
    const zones: ZoneId[] = ['plaza', homeZone(player)]
    for (const z of zones) {
      const areaId = (z === homeZone(player) ? `${player}_base` : `${player}_plaza`) as `${typeof player}_base` | `${typeof player}_plaza`
      if (s.brickAreas[areaId].slots.length >= s.brickAreas[areaId].maxSlots) continue
      const action: Action = { type: 'PLAY_BUILDING', cardId, areaId }
      if (canDispatch(s, player, action).ok) {
        candidates.push({ action, cardId, score: cardScore(cardId, weights) })
        break
      }
    }
  }

  if (candidates.length === 0) return { type: 'NEXT_PHASE' }
  // 手牌不足時濾掉低優先卡，留牌給反應卡
  const eligible = candidates.filter(c => c.score >= handGate)
  if (eligible.length === 0) return { type: 'NEXT_PHASE' }
  return eligible.reduce((a, b) => b.score > a.score ? b : a).action
}

// ── 行動階段 ─────────────────────────────────────

function decideActionPhase(s: GameState, player: PlayerId): Action {
  // 若有正在行動的BG，繼續其行動
  if (s.actingBGId) {
    return continueActingBG(s, player).action
  }

  // 若行動次數已用完，進入下一階段
  if (s.bgActionsUsed >= s.bgActionsMax) return { type: 'NEXT_PHASE' }

  // 選擇下一個要行動的BG（優先選在前線的BG）
  const availableBGs = Object.values(s.bgs)
    .filter(bg => bg.owner === player && !bg.actedThisPhase && bg.state !== 'ko' && bg.state !== 'stunned')

  if (availableBGs.length === 0) return { type: 'NEXT_PHASE' }

  // 優先選擇：前線 > 廣場 > 主堡
  const prioritized = [...availableBGs].sort((a, b) => {
    const score = (bg: BGInstance) => {
      if (bg.zone === frontZone(player)) return 3
      if (bg.zone === 'plaza') return 2
      return 1
    }
    return score(b) - score(a)
  })

  const chosen = prioritized[0]
  const ok = canDispatch(s, player, { type: 'START_BG_ACTION', bgId: chosen.id })
  if (ok.ok) return { type: 'START_BG_ACTION', bgId: chosen.id }

  return { type: 'NEXT_PHASE' }
}

/** 候選行動（帶類別與得分） */
type Candidate = { action: Action; category: ActionCategory; score: number }

/**
 * 行動中BG的下一步決策（計分制）
 * @param weights  使用的權重（預設 DYNAMIC_WEIGHTS）
 * @param epsilon  探索率 0=純貪心，1=純隨機（訓練用）
 * @param rng      亂數生成器（訓練傳入，確保可重現）
 */
export function continueActingBG(
  s: GameState,
  player: PlayerId,
  weights: BotWeights = DYNAMIC_WEIGHTS,
  epsilon = 0,
  rng: () => number = Math.random,
): { action: Action; category: ActionCategory } {
  const bgId = s.actingBGId!
  const bg = s.bgs[bgId]
  if (!bg) return { action: { type: 'END_BG_ACTION' }, category: 'end_early' }

  const enemiesInZone = getEnemyBGsInZone(s, bg.zone, player).filter(e => e.state !== 'ko')
  const alliesInZone  = getAllyBGsInZone(s, bg.zone, player).filter(a => a.id !== bg.id && a.state !== 'stunned')
  const hand = s.players[player].hand

  // 移動優先（移動本身不納入候選計分，先移再選動作）
  if (!bg.movedThisAction && !bg.cantMoveThisTurn && !bg.doneNormalAction) {
    const moveTarget = decideMoveTarget(s, bg, player)
    if (moveTarget && moveTarget !== bg.zone) {
      const ok = canDispatch(s, player, { type: 'MOVE_BG', toZone: moveTarget })
      if (ok.ok) return { action: { type: 'MOVE_BG', toZone: moveTarget }, category: 'move_forward' }
    }
  }

  const candidates: Candidate[] = []

  // ── 攻城 ──
  if (canDispatch(s, player, { type: 'DO_SIEGE' }).ok) {
    candidates.push({ action: { type: 'DO_SIEGE' }, category: 'siege', score: weights.siege })
  }

  // ── 敵主堡清磚 ──
  if (!bg.doneNormalAction && bg.zone === frontZone(player)) {
    const clearTargets = getPossibleClearTargets(s, bg, player)
    if (clearTargets.length > 0) {
      const areaId = clearTargets[0]
      const slotIndex = bestClearSlotIndex(s, areaId)
      if (canDispatch(s, player, { type: 'DO_CLEAR_BRICK', areaId, slotIndex }).ok) {
        candidates.push({ action: { type: 'DO_CLEAR_BRICK', areaId, slotIndex }, category: 'clear_front', score: weights.clear_front })
      }
    }
  }

  // ── 技能 S2 ──
  if (!bg.usedSkillThisAction) {
    for (let si = 1; si >= 0; si--) {
      const def = bgCardById[bg.cardId]?.skills[si]
      if (!def) continue
      if (bg.skillCooldowns[si] > 0) continue
      const handCost = def.handCost ?? 0
      const minHand = si === 1 ? weights.s2MinHand : weights.s1MinHand
      if (hand.length - handCost < minHand) continue  // 手牌保留門檻
      const discardCardIds = handCost > 0 ? hand.slice(0, handCost) : []
      const params = {
        discardCardIds,
        targetBGIds: enemiesInZone.map(e => e.id),
        targetBGId: enemiesInZone[0]?.id,
        targetZone: frontZone(player),
        brickSlotIndex: (() => {
          const clearAreaId = bg.zone !== (bg.zone === homeZone(player) ? bg.zone : undefined)
            ? (bg.zone === 'plaza' ? `${opponentOf(player)}_plaza` : `${opponentOf(player)}_base`) as BrickAreaId
            : undefined
          return clearAreaId ? bestClearSlotIndex(s, clearAreaId) : undefined
        })(),
      }
      if (canDispatch(s, player, { type: 'USE_SKILL', skillIndex: si as 0 | 1, params }).ok) {
        const category: ActionCategory = si === 1 ? 'skill_s2' : 'skill_s1'
        const genericScore = si === 1 ? weights.skill_s2 : weights.skill_s1
        // 個別技能權重覆蓋通用 fallback
        const skillKey = `${bg.cardId}_s${si}`
        const score = weights.skillWeights[skillKey] ?? genericScore
        candidates.push({ action: { type: 'USE_SKILL', skillIndex: si as 0 | 1, params }, category, score })
        break  // 只加一個技能候選（高優先的 S2 或 S1）
      }
    }

    // ── 聯合 ally 技能 ──
    if (enemiesInZone.length > 0) {
      const allySkillAction = decideAllySkill(s, player, bgId, alliesInZone)
      if (allySkillAction && allySkillAction.type === 'USE_SKILL') {
        const fromBGId = allySkillAction.fromBGId ?? bgId
        const allyBG = s.bgs[fromBGId]
        const skillKey = allyBG ? `${allyBG.cardId}_s${allySkillAction.skillIndex}` : null
        const score = (skillKey != null ? weights.skillWeights[skillKey] : undefined) ?? weights.ally_skill
        candidates.push({ action: allySkillAction, category: 'ally_skill', score })
      }
    }
  }

  // ── 聯合攻擊 / 普通攻擊 ──
  if (!bg.doneNormalAction && enemiesInZone.length > 0) {
    const target = enemiesInZone.sort((a, b) => effectiveHP(a) - effectiveHP(b))[0]
    const lockedAlly = s.jointAllyId ? s.bgs[s.jointAllyId] : null
    const allySupporter = lockedAlly ?? alliesInZone.sort((a, b) => effectiveSupport(b) - effectiveSupport(a))[0]
    const attackAction: Action = { type: 'DO_ATTACK', targetBGId: target.id, allyId: allySupporter?.id }
    if (canDispatch(s, player, attackAction).ok) {
      const category: ActionCategory = allySupporter ? 'attack_joint' : 'attack'
      const score = allySupporter ? weights.attack_joint : weights.attack
      candidates.push({ action: attackAction, category, score })
    }
  }

  // ── 廣場清磚（無敵可打時）──
  if (!bg.doneNormalAction && bg.zone !== frontZone(player)) {
    const clearTargets = getPossibleClearTargets(s, bg, player)
    if (clearTargets.length > 0) {
      const areaId = clearTargets[0]
      const slotIndex = bestClearSlotIndex(s, areaId)
      if (canDispatch(s, player, { type: 'DO_CLEAR_BRICK', areaId, slotIndex }).ok) {
        candidates.push({ action: { type: 'DO_CLEAR_BRICK', areaId, slotIndex }, category: 'clear_plaza', score: weights.clear_plaza })
      }
    }
  }

  // ── 提前結束 ──
  candidates.push({ action: { type: 'END_BG_ACTION' }, category: 'end_early', score: weights.end_early })

  // 選擇：epsilon 探索 or 貪心
  if (candidates.length > 1 && epsilon > 0 && rng() < epsilon) {
    const picked = candidates[Math.floor(rng() * candidates.length)]
    return { action: picked.action, category: picked.category }
  }
  const best = candidates.reduce((a, b) => b.score > a.score ? b : a)
  return { action: best.action, category: best.category }
}

function getPossibleClearTargets(s: GameState, bg: BGInstance, player: PlayerId): BrickAreaId[] {
  const enemy = opponentOf(player)
  const targets: BrickAreaId[] = []
  if (bg.zone === 'plaza') {
    const id = `${enemy}_plaza` as BrickAreaId
    if (s.brickAreas[id].slots.length > 0) targets.push(id)
  }
  if (bg.zone === frontZone(player)) {
    const id = `${enemy}_base` as BrickAreaId
    if (s.brickAreas[id].slots.length > 0) targets.push(id)
  }
  return targets
}

/** 選最佳清磚目標 slot — 優先選非建築普通磚，次選建築卡 */
function bestClearSlotIndex(s: GameState, areaId: BrickAreaId): number | undefined {
  const slots = s.brickAreas[areaId].slots
  if (slots.length === 0) return undefined
  // 找最後一個非建築 slot
  for (let i = slots.length - 1; i >= 0; i--) {
    if (!slots[i].isBuilding) return i
  }
  // 全是建築，選最後一個
  return slots.length - 1
}

function decideMoveTarget(s: GameState, bg: BGInstance, player: PlayerId): ZoneId | null {
  const enemy = opponentOf(player)
  const myBase = homeZone(player)
  const enemyBase = homeZone(enemy)

  // 若在己方主堡，向廣場移動
  if (bg.zone === myBase) {
    return 'plaza'
  }

  // 若在廣場，嘗試向敵主堡移動
  if (bg.zone === 'plaza') {
    if (!isPlazaBlocked(s, player)) return enemyBase
    // 若被阻擋，留在廣場等候機會（不浪費行動）
    return null
  }

  // 若在敵主堡，不需要移動（已在最佳位置）
  return null
}

/** 嘗試使用聯合 ally 的技能（用於聯合攻擊前） */
function decideAllySkill(s: GameState, player: PlayerId, actingBGId: string, allies: BGInstance[]): Action | null {
  const actingBG = s.bgs[actingBGId]
  const hand = s.players[player].hand

  for (const ally of allies.sort((a, b) => effectiveSupport(b) - effectiveSupport(a))) {
    if (ally.id === actingBGId) continue
    if (ally.actedThisPhase) continue  // ally 已行動過就不能聯合
    if (ally.state === 'ko') continue

    const def = bgCardById[ally.cardId]
    if (!def) continue

    const enemiesInZone = getEnemyBGsInZone(s, actingBG.zone, player).filter(e => e.state !== 'ko')

    for (let i = 0; i < 2; i++) {
      const skill = def.skills[i]
      if (ally.state === 'stunned' && !skill.canUseWhenStunned) continue
      if (ally.skillCooldowns[i] > 0) continue
      const handCost = skill.handCost ?? 0
      if (handCost > 0 && hand.length < handCost) continue

      const discardCardIds = handCost > 0 ? hand.slice(0, handCost) : []
      const clearAreaId = ally.zone !== homeZone(player)
        ? (ally.zone === 'plaza' ? `${opponentOf(player)}_plaza` : `${opponentOf(player)}_base`) as BrickAreaId
        : undefined
      const params: SkillParams = {
        discardCardIds,
        targetBGIds: enemiesInZone.map(e => e.id),
        targetBGId: enemiesInZone[0]?.id,
        targetZone: frontZone(player),
        brickSlotIndex: clearAreaId ? bestClearSlotIndex(s, clearAreaId) : undefined,
      }

      const ok = canDispatch(s, player, { type: 'USE_SKILL', skillIndex: i as 0 | 1, params, fromBGId: ally.id })
      if (ok.ok) return { type: 'USE_SKILL', skillIndex: i as 0 | 1, params, fromBGId: ally.id }
    }
  }
  return null
}

// ── 反應階段 ─────────────────────────────────────

function decideReactPhase(s: GameState, player: PlayerId, weights: BotWeights): Action {
  const hand = s.players[player].hand
  const enemy = opponentOf(player)

  // 按 trigger 決定反應卡適合的區域
  // on_receive_attack / on_ko / on_stunned → 前線（會被攻擊才有用）
  // on_enemy_clear_brick                  → 守衛自家磚堆（廣場或主堡）
  // on_enemy_enter_zone                   → 守在自家（敵人進入才觸發）
  function preferredZones(trigger: string): ZoneId[] {
    if (trigger === 'on_enemy_clear_brick' || trigger === 'on_enemy_enter_zone') {
      return [homeZone(player), 'plaza']
    }
    return [homeZone(enemy), 'plaza']
  }

  const reactionsInHand = hand.filter(id => reactionById[id])
  if (reactionsInHand.length === 0) return { type: 'NEXT_PHASE' }

  let bestScore = -Infinity
  let bestAction: Action | null = null

  for (const cardId of reactionsInHand) {
    const def = reactionById[cardId]
    if (!def) continue

    const preferred = preferredZones(def.trigger)
    // 優先區 → 次選區，避免重複
    const zonesToTry = [...new Set([...preferred, homeZone(enemy), 'plaza' as ZoneId, homeZone(player)])]

    for (const zone of zonesToTry) {
      const bgsHere = Object.values(s.bgs).filter(bg =>
        bg.owner === player &&
        bg.zone === zone &&
        bg.state !== 'ko' &&
        !bg.reactionCard &&
        (def.suitableClass === 'ALL' || def.suitableClass === bg.bgClass)
      )
      for (const bg of bgsHere) {
        const ok = canDispatch(s, player, { type: 'INSTALL_REACTION', bgId: bg.id, cardId })
        if (ok.ok) {
          // 在首選區域加分
          const zoneBonus = preferred[0] === zone ? 1.0 : preferred.includes(zone) ? 0.5 : 0
          const score = cardScore(cardId, weights) + zoneBonus
          if (score > bestScore) {
            bestScore = score
            bestAction = { type: 'INSTALL_REACTION', bgId: bg.id, cardId }
          }
          break
        }
      }
    }
  }

  return bestAction ?? { type: 'NEXT_PHASE' }
}

// ── 技能決策（可選用） ───────────────────────────

/** 決定是否使用技能，回傳 USE_SKILL 行動或 null */
export function decideSkilll(s: GameState, player: PlayerId, bgId: string): Action | null {
  const bg = s.bgs[bgId]
  if (!bg || bg.usedSkillThisAction) return null

  const def = bgCardById[bg.cardId]
  if (!def) return null

  const hand = s.players[player].hand

  // 嘗試每個技能（CD 制：冷卻為 0 即可使用）
  for (let i = 0; i < 2; i++) {
    const skill = def.skills[i]
    if (bg.state === 'stunned' && !skill.canUseWhenStunned) continue
    if (bg.skillCooldowns[i] > 0) continue

    // 手牌消耗檢查（S2）
    const handCost = skill.handCost ?? 0
    if (handCost > 0 && hand.length < handCost) continue

    // 選擇目標
    const enemiesInZone = getEnemyBGsInZone(s, bg.zone, player)
      .filter(e => e.state !== 'ko')
      .sort((a, b) => effectiveHP(a) - effectiveHP(b))

    // 自動選擇要捨棄的手牌（優先捨棄非技能牌/事件牌）
    const discardCardIds = handCost > 0 ? hand.slice(0, handCost) : []

    const clearAreaId = bg.zone !== homeZone(player)
      ? (bg.zone === 'plaza' ? `${opponentOf(player)}_plaza` : `${opponentOf(player)}_base`) as BrickAreaId
      : undefined
    const params: SkillParams = {
      discardCardIds,
      targetBGIds: enemiesInZone.map(e => e.id),
      targetBGId: enemiesInZone[0]?.id,
      targetZone: frontZone(player),
      brickSlotIndex: clearAreaId ? bestClearSlotIndex(s, clearAreaId) : undefined,
    }

    const ok = canDispatch(s, player, { type: 'USE_SKILL', skillIndex: i as 0 | 1, params })
    if (ok.ok) return { type: 'USE_SKILL', skillIndex: i as 0 | 1, params }
  }

  return null
}

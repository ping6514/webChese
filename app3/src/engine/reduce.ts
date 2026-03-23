// Beast Conquest Engine — 主 Reducer（3-zone redesign）

import type { GameState, LeaderInstance } from './state'
import { totalAttack, totalToughness, totalSupport, drawCard, reshuffleGraveyard } from './state'
import type { Action } from './actions'
import type { GameEvent, AttackResult } from './events'
import { canDispatch } from './guards'
import { opponent, lairZone, enemyLairZone, getAdjacentZones, ZONE_ORDER } from './types'
import type { PlayerId, ZoneId } from './types'
import { getLegionCard, getTacticalCard, getLeaderPassive, getLegionPassives, getEventCard } from './cards'


export type ReduceResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; reason: string }

const MAX_TURNS = 100  // 防止無限迴圈

// ── 被動/光環計算 ────────────────────────────────────────

/**
 * 計算首領的有效攻擊力（含被動、軍團被動、移動後加成、光環）
 */
function effectiveAttack(leader: LeaderInstance): number {
  let atk = totalAttack(leader)

  // 移動後攻擊加成
  const lp = getLeaderPassive(leader)
  if (lp?.type === 'attack_bonus_after_move' && leader.moveCount > 0) {
    atk += lp.value
  }

  // 軍團被動：attack_bonus_if_leader_tag
  for (const p of getLegionPassives(leader)) {
    if (p.type === 'attack_bonus_if_leader_tag' && leader.tags.includes(p.tag)) {
      atk += p.value
    }
    // all_stats_if_leader_elemental（元素標籤）
    if (p.type === 'all_stats_if_leader_elemental' && p.tags.some((t) => leader.tags.includes(t))) {
      atk += p.value
    }
  }

  return atk
}

/**
 * 計算首領的有效協助力（含軍團被動）
 */
function effectiveSupport(leader: LeaderInstance, supportAura = 0): number {
  let sup = totalSupport(leader) + supportAura

  // 軍團被動：support_bonus_if_leader_tag
  for (const p of getLegionPassives(leader)) {
    if (p.type === 'support_bonus_if_leader_tag' && leader.tags.includes(p.tag)) {
      sup += p.value
    }
    if (p.type === 'all_stats_if_leader_elemental' && p.tags.some((t) => leader.tags.includes(t))) {
      sup += p.value
    }
  }

  return sup
}

/**
 * 計算首領受到傷害後的有效韌性（含被動、軍團被動）
 */
function effectiveDamageReduction(leader: LeaderInstance): number {
  let reduction = 0

  // 首領被動：damage_reduction
  const lp = getLeaderPassive(leader)
  if (lp?.type === 'damage_reduction') reduction += lp.value

  // 軍團被動：damage_reduction_if_leader_tag
  for (const p of getLegionPassives(leader)) {
    if (p.type === 'damage_reduction_if_leader_tag' && leader.tags.includes(p.tag)) {
      reduction += p.value
    }
    if (p.type === 'all_stats_if_leader_elemental' && p.tags.some((t) => leader.tags.includes(t))) {
      reduction += p.value
    }
  }

  return reduction
}

/** 取得某區域內所有友軍的 ally_support_buff 光環加總 */
function zoneAllySupportAura(s: GameState, zone: ZoneId, owner: PlayerId, excludeId: string): number {
  let bonus = 0
  for (const l of Object.values(s.leaders)) {
    if (l.owner !== owner || l.id === excludeId || l.zone !== zone) continue
    if (l.state === 'ko' || l.state === 'reviving') continue
    const p = getLeaderPassive(l)
    if (p?.type === 'ally_support_buff') bonus += p.value
  }
  return bonus
}

/** 取得某區域內所有友軍的 ally_damage_reduction 光環加總 */
function zoneAllyDamageReduction(s: GameState, zone: ZoneId, owner: PlayerId): number {
  let bonus = 0
  for (const l of Object.values(s.leaders)) {
    if (l.owner !== owner || l.zone !== zone) continue
    if (l.state === 'ko' || l.state === 'reviving') continue
    const p = getLeaderPassive(l)
    if (p?.type === 'ally_damage_reduction') bonus += p.value
  }
  return bonus
}

/** 取得某區域內所有敵軍的 enemy_attack_debuff 光環加總 */
function zoneEnemyAttackDebuff(s: GameState, zone: ZoneId, attOwner: PlayerId): number {
  let debuff = 0
  for (const l of Object.values(s.leaders)) {
    if (l.owner === attOwner || l.zone !== zone) continue
    if (l.state === 'ko' || l.state === 'reviving') continue
    // 首領被動
    const lp = getLeaderPassive(l)
    if (lp?.type === 'enemy_attack_debuff') debuff += lp.value
    // 軍團被動
    for (const p of getLegionPassives(l)) {
      if (p.type === 'enemy_attack_debuff') debuff += p.value
    }
  }
  return debuff
}

export function reduce(state: GameState, action: Action): ReduceResult {
  const guard = canDispatch(state, action)
  if (!guard.ok) return { ok: false, reason: guard.reason }

  // 深複製 state（引擎為純函式）
  const s: GameState = structuredClone(state)
  const events: GameEvent[] = []

  switch (action.type) {
    case 'NEXT_PHASE':
      advancePhase(s, events)
      break

    case 'SURRENDER':
      s.winner = opponent(action.player)
      s.winReason = 'surrender'
      events.push({ type: 'GAME_OVER', winner: s.winner, reason: 'surrender' })
      break

    case 'MOVE':
      applyMove(s, action.leaderId, action.toZone, events)
      break

    case 'ATTACK':
      applyAttack(s, action.attackerId, action.targetId, events)
      break

    case 'CLEAR_FORT':
      applyClearFort(s, action.leaderId, events)
      break

    case 'SIEGE':
      applySiege(s, action.leaderId, events)
      break

    case 'SUMMON_LEGION':
      applySummonLegion(s, action.cardId, action.leaderId, events)
      break

    case 'INSTALL_TACTICAL':
      applyInstallTactical(s, action.cardId, action.leaderId, events)
      break

    case 'SKILL':
      applySkill(s, action.leaderId, events)
      break

    case 'PLAY_EVENT':
      applyPlayEvent(s, action.cardId, action.discardIds, action.targetLeaderId, action.targetZone, events)
      break
  }

  // 檢查城牆 HP 勝利條件（也在 applySiege 內檢查，這是二次保障）
  checkCityWallWin(s, events)

  // 超過回合上限：以場面優勢判定
  if (!s.winner && s.turn > MAX_TURNS) {
    s.winner = evaluateLeader(s)
    s.winReason = 'turn_limit'
    events.push({ type: 'GAME_OVER', winner: s.winner, reason: 'turn_limit' })
  }

  return { ok: true, state: s, events }
}

// ── 回合階段推進 ───────────────────────────────────────

function advancePhase(s: GameState, events: GameEvent[]) {
  if (s.phase === 'main') {
    // main → battle：重置 actedLeaders + moveCount
    s.phase = 'battle'
    s.actedLeaders = []
    for (const l of Object.values(s.leaders)) {
      if (l.owner === s.currentPlayer) l.moveCount = 0
    }
    events.push({ type: 'PHASE_CHANGED', player: s.currentPlayer, to: 'battle' })
  } else if (s.phase === 'battle') {
    // battle → react：本方被擊暈的首領在戰鬥結束時恢復
    for (const l of Object.values(s.leaders)) {
      if (l.owner === s.currentPlayer && l.state === 'stunned') {
        l.state = 'normal'
        events.push({ type: 'STUN_RECOVERED', leaderId: l.id })
      }
    }
    s.phase = 'react'
    events.push({ type: 'PHASE_CHANGED', player: s.currentPlayer, to: 'react' })
  } else {
    // react → [auto prep next player] → main
    const next = opponent(s.currentPlayer)
    s.currentPlayer = next
    if (next === 'p1') s.turn++

    // 自動準備階段
    applyPreparation(s, events)
    events.push({ type: 'TURN_STARTED', player: s.currentPlayer, turn: s.turn })

    s.phase = 'main'
    events.push({ type: 'PHASE_CHANGED', player: s.currentPlayer, to: 'main' })
  }
}

// ── 準備階段自動處理 ──────────────────────────────────

function applyPreparation(s: GameState, events: GameEvent[]) {
  const player = s.currentPlayer
  const ps = s.players[player]

  // 0. 回合旗標重置
  s.turnFlags[player] = { battle_cry: false, divine_blessing: false }

  // 1. 復活中 → 普通（HP 恢復滿）
  for (const l of Object.values(s.leaders)) {
    if (l.owner === player && l.state === 'reviving') {
      l.state = 'normal'
      l.zone = lairZone(player)
      l.koTurnCount = 0
      events.push({ type: 'LEADER_REVIVED', leaderId: l.id, at: l.zone })
    }
  }

  // 2. KO 倒計時（暈眩改在 battle→react 時恢復，此處不處理）
  for (const l of Object.values(s.leaders)) {
    if (l.owner === player && l.state === 'ko') {
      l.koTurnCount++
      if (l.koTurnCount >= l.reviveTime) {
        l.state = 'reviving'
      }
    }
  }

  // 4. 技能冷卻倒計時
  for (const l of Object.values(s.leaders)) {
    if (l.owner === player && l.skillCooldown > 0) {
      l.skillCooldown--
    }
  }

  // 5. 抽牌（每回合 2 張）+ 重置一般召喚
  if (ps) {
    for (let i = 0; i < 2; i++) {
      drawCardForPlayer(s, player, events)
    }
    ps.normalSummonUsed = false
  }

  // 6. 禁錮解除
  for (const l of Object.values(s.leaders)) {
    if (l.owner === player && l.immobilized) {
      l.immobilized = false
      events.push({ type: 'LEADER_FREED', leaderId: l.id })
    }
  }
}

// ── 牌組輔助 ──────────────────────────────────────────

function drawCardForPlayer(s: GameState, player: PlayerId, events: GameEvent[]) {
  const ps = s.players[player]
  if (ps.deck.length === 0 && ps.graveyard.length > 0) {
    s.rngSeed = (s.rngSeed + 1) & 0xffffffff
    reshuffleGraveyard(ps, s.rngSeed)
  }
  const card = drawCard(ps)
  if (card) events.push({ type: 'CARD_DRAWN', player, cardId: card })
}

// ── MOVE ──────────────────────────────────────────────

function applyMove(s: GameState, leaderId: string, toZone: ZoneId, events: GameEvent[]) {
  const leader = s.leaders[leaderId]
  const from = leader.zone
  leader.zone = toZone
  leader.moveCount++
  events.push({ type: 'LEADER_MOVED', leaderId, from, to: toZone })

  // 觸發：目標區域內敵方首領的 on_enemy_enter_zone 戰術卡
  triggerOnEnemyEnterZone(s, leader, toZone, events)
}

// ── ATTACK ────────────────────────────────────────────

function applyAttack(s: GameState, attackerId: string, targetId: string, events: GameEvent[]) {
  const attacker = s.leaders[attackerId]
  const target = s.leaders[targetId]

  // 計算傷害：攻擊者對敵力 + 同區域友軍協助力（含光環）
  const debuff = zoneEnemyAttackDebuff(s, attacker.zone, attacker.owner)
  let atkDmg = Math.max(0, effectiveAttack(attacker) - debuff)
  // TurnFlag: battle_cry +2
  if (s.turnFlags[attacker.owner]?.battle_cry) atkDmg += 2

  const supportDmg = Object.values(s.leaders)
    .filter(
      (l) =>
        l.owner === attacker.owner &&
        l.id !== attacker.id &&
        l.zone === attacker.zone &&
        l.state === 'normal'
    )
    .reduce((sum, l) => {
      const aura = zoneAllySupportAura(s, l.zone, l.owner, l.id)
      return sum + effectiveSupport(l, aura)
    }, 0)

  let damage = atkDmg + supportDmg

  // 觸發：目標的 on_receive_damage 戰術卡（可修改傷害）
  damage = triggerOnReceiveDamage(s, target, [attackerId], damage, events)

  // 被動：damage_reduction（首領）+ ally_damage_reduction（友軍光環）
  const totalReduction = effectiveDamageReduction(target) + zoneAllyDamageReduction(s, target.zone, target.owner)
  if (totalReduction > 0) {
    const before = damage
    damage = Math.max(1, damage - totalReduction)
    if (damage < before) {
      events.push({ type: 'PASSIVE_TRIGGERED', leaderId: target.id, passiveType: 'damage_reduction', desc: `傷害 ${before}→${damage}` })
    }
  }

  // TurnFlag: divine_blessing 傷害 -1（守方）
  if (s.turnFlags[target.owner]?.divine_blessing) {
    const before2 = damage
    damage = Math.max(1, damage - 1)
    if (damage < before2) events.push({ type: 'PASSIVE_TRIGGERED', leaderId: target.id, passiveType: 'divine_blessing', desc: `傷害 ${before2}→${damage}` })
  }

  // 規則：
  // damage ≥ 2× toughness → KO（強擊一擊必殺）
  // damage >= toughness → stun（暈眩，敵方行動結束時恢復）
  // else → no_effect
  const effectiveToughness = totalToughness(target)
  let result: AttackResult
  if (damage >= effectiveToughness * 2) {
    result = 'ko'
  } else if (damage >= effectiveToughness) {
    result = 'stunned'
  } else {
    result = 'no_effect'
  }

  events.push({ type: 'ATTACK_RESOLVED', attackerId, targetId, damage, toughness: effectiveToughness, result })

  if (result === 'stunned') {
    target.state = 'stunned'
    events.push({ type: 'LEADER_STUNNED', leaderId: targetId })
    triggerOnStunned(s, target, [attackerId], events)
  } else if (result === 'ko') {
    applyKO(s, target, events)
  }

  // 被動：counter_damage（反擊攻擊者）
  const targetPassive = getLeaderPassive(target)
  if (targetPassive?.type === 'counter_damage' && result !== 'ko') {
    const firstAttacker = s.leaders[attackerId]
    if (firstAttacker) {
      applyDirectDamage(s, firstAttacker, targetPassive.value, events)
      events.push({ type: 'PASSIVE_TRIGGERED', leaderId: target.id, passiveType: 'counter_damage', desc: `反擊${targetPassive.value}傷害` })
    }
  }

  // 被動：on_ko_or_stun_draw（擊暈或擊殺時抽牌）
  if (result === 'stunned' || result === 'ko') {
    const att = s.leaders[attackerId]
    const atkPassive = getLeaderPassive(att)
    if (atkPassive?.type === 'on_ko_or_stun_draw') {
      for (let i = 0; i < atkPassive.value; i++) drawCardForPlayer(s, att.owner, events)
      events.push({ type: 'PASSIVE_TRIGGERED', leaderId: att.id, passiveType: 'on_ko_or_stun_draw', desc: `抽${atkPassive.value}張牌` })
    }
  }

  // 被動：splash_damage（對目標同區域其他敵首領）
  const atkPassive2 = getLeaderPassive(attacker)
  if (atkPassive2?.type === 'splash_damage') {
    const splashTargets = Object.values(s.leaders).filter(
      (l) => l.owner === target.owner && l.id !== target.id &&
        l.zone === target.zone && l.state !== 'ko' && l.state !== 'reviving'
    )
    for (const st of splashTargets) {
      applyDirectDamage(s, st, atkPassive2.value, events)
    }
    if (splashTargets.length > 0) {
      events.push({ type: 'PASSIVE_TRIGGERED', leaderId: attacker.id, passiveType: 'splash_damage', desc: `濺射${atkPassive2.value}傷害×${splashTargets.length}` })
    }
  }

  // 標記攻擊者已行動
  s.actedLeaders.push(attackerId)
}

// ── KO 共用 ───────────────────────────────────────────

function applyKO(s: GameState, target: LeaderInstance, events: GameEvent[]) {
  target.state = 'ko'
  target.koTurnCount = 0

  // KO 時丟棄身上的軍團裝備卡
  if (target.legions.length > 0) {
    const ps = s.players[target.owner]
    if (ps) {
      for (const cardId of target.legions) ps.graveyard.push(cardId)
    }
    target.legions = []
    target.bonusToughness = 0
    target.bonusAttack = 0
    target.bonusSupport = 0
  }

  // 同時移除戰術卡
  if (target.tacticalCard) {
    const ps = s.players[target.owner]
    if (ps) ps.graveyard.push(target.tacticalCard)
    target.tacticalCard = null
  }

  // 回到己方基地
  target.zone = lairZone(target.owner)
  events.push({ type: 'LEADER_KO', leaderId: target.id, returnedTo: target.zone })

  // 觸發：on_ko 戰術卡
  triggerOnKo(s, target, events)
}

/** 直接傷害（不觸發 on_receive_damage/on_stunned，但仍觸發 on_ko）*/
function applyDirectDamage(s: GameState, target: LeaderInstance, damage: number, events: GameEvent[]) {
  if (damage >= totalToughness(target) * 2) {
    applyKO(s, target, events)
    return
  }
  if (damage >= totalToughness(target)) {
    target.state = 'stunned'
    events.push({ type: 'LEADER_STUNNED', leaderId: target.id })
    // 不連鎖觸發 on_stunned，防止無限遞迴
  }
}

// ── CLEAR_FORT ────────────────────────────────────────

function applyClearFort(s: GameState, leaderId: string, events: GameEvent[]) {
  const enemyBase = enemyLairZone(s.currentPlayer)
  const zone = s.zones[enemyBase]

  // 觸發：on_enemy_clear_brick 戰術卡（在敵方基地的防守者）
  if (triggerOnEnemyClearBrick(s, enemyBase, events)) {
    // 攻城被阻擋：仍標記行動
    s.actedLeaders.push(leaderId)
    return
  }

  zone.fortLevel = Math.max(0, zone.fortLevel - 1)

  events.push({ type: 'FORT_CLEARED', leaderId, zone: enemyBase, newFortLevel: zone.fortLevel })
  s.actedLeaders.push(leaderId)
}

// ── SIEGE ─────────────────────────────────────────────

function applySiege(s: GameState, leaderId: string, events: GameEvent[]) {
  const enemyBase = enemyLairZone(s.currentPlayer)
  const zone = s.zones[enemyBase]

  zone.cityWalls = Math.max(0, zone.cityWalls - 1)
  const lairOwner = opponent(s.currentPlayer)
  events.push({ type: 'CITY_WALL_DAMAGED', player: lairOwner, remaining: zone.cityWalls })

  if (zone.cityWalls <= 0) {
    s.winner = s.currentPlayer
    s.winReason = 'city_walls_destroyed'
    events.push({ type: 'GAME_OVER', winner: s.winner, reason: 'city_walls_destroyed' })
  }

  s.actedLeaders.push(leaderId)
}

// ── 勝利條件 ──────────────────────────────────────────

function checkCityWallWin(s: GameState, events: GameEvent[]) {
  if (s.winner) return

  for (const zone of Object.values(s.zones)) {
    if (zone.cityWalls !== undefined && zone.cityWalls <= 0 && zone.id !== 'plaza') {
      // 只有基地有城牆，plaza cityWalls 永遠為 0
      if (zone.id === 'p1_base' && s.zones.p1_base.cityWalls <= 0) {
        s.winner = 'p2'
        s.winReason = 'city_walls_destroyed'
        events.push({ type: 'GAME_OVER', winner: 'p2', reason: 'city_walls_destroyed' })
        return
      }
      if (zone.id === 'p2_base' && s.zones.p2_base.cityWalls <= 0) {
        s.winner = 'p1'
        s.winReason = 'city_walls_destroyed'
        events.push({ type: 'GAME_OVER', winner: 'p1', reason: 'city_walls_destroyed' })
        return
      }
    }
  }
}

function evaluateLeader(s: GameState): PlayerId {
  let p1Score = 0, p2Score = 0

  // 城牆剩餘
  p1Score += (s.zones.p1_base.cityWalls ?? 0) * 10
  p2Score += (s.zones.p2_base.cityWalls ?? 0) * 10

  // 首領在場
  for (const l of Object.values(s.leaders)) {
    const active = l.state === 'normal' || l.state === 'stunned' ? 1 : 0
    if (l.owner === 'p1') p1Score += active * 3
    else p2Score += active * 3
  }

  // 築城差距
  p1Score += s.zones.p1_base.fortLevel
  p2Score += s.zones.p2_base.fortLevel

  return p1Score >= p2Score ? 'p1' : 'p2'
}

// ── 戰術卡觸發 ────────────────────────────────────────

/** 目標受到攻擊時（on_receive_damage）→ 回傳修改後的傷害值 */
function triggerOnReceiveDamage(
  s: GameState,
  defender: LeaderInstance,
  attackerIds: string[],
  damage: number,
  events: GameEvent[]
): number {
  if (!defender.tacticalCard) return damage
  const card = getTacticalCard(defender.tacticalCard)
  if (!card || card.trigger !== 'on_receive_damage') return damage

  const cardId = defender.tacticalCard
  defender.tacticalCard = null
  s.players[defender.owner].graveyard.push(cardId)
  events.push({ type: 'TACTICAL_TRIGGERED', leaderId: defender.id, cardId, cardName: card.name, effectDesc: card.name })

  switch (cardId) {
    case 'dodge':
      // 傷害歸 0，抽 1 張牌
      drawCardForPlayer(s, defender.owner, events)
      return 0

    case 'counter_strike': {
      // 反擊第一位攻擊者 3 傷害
      const attacker = s.leaders[attackerIds[0]]
      if (attacker) applyDirectDamage(s, attacker, 3, events)
      return damage
    }

    case 'agile':
      // 堅韌 +4，允許再次移動（重置移動次數）
      defender.bonusToughness += 4
      defender.moveCount = 0
      return damage

    case 'tactical_retreat_reaction': {
      // 傷害 -2，同區域友軍 +2 堅韌
      const allies = Object.values(s.leaders).filter(
        (l) => l.owner === defender.owner && l.id !== defender.id &&
          l.zone === defender.zone && l.state !== 'ko' && l.state !== 'reviving'
      )
      for (const ally of allies) ally.bonusToughness += 2
      return Math.max(0, damage - 2)
    }

    case 'iron_body':
      // 傷害 -4，防守方所在區域 +1 築城（上限 2 for bases）
      if (defender.zone !== 'plaza') {
        s.zones[defender.zone].fortLevel = Math.min(2, s.zones[defender.zone].fortLevel + 1)
      }
      return Math.max(0, damage - 4)

    case 'guardian_shield': {
      // 傷害 -2，同區域友軍 +2 堅韌
      const allies = Object.values(s.leaders).filter(
        (l) => l.owner === defender.owner && l.id !== defender.id &&
          l.zone === defender.zone && l.state !== 'ko' && l.state !== 'reviving'
      )
      for (const ally of allies) ally.bonusToughness += 2
      return Math.max(0, damage - 2)
    }

    default:
      return damage
  }
}

/** 首領進入暈眩時（on_stunned）*/
function triggerOnStunned(
  s: GameState,
  stunned: LeaderInstance,
  attackerIds: string[],
  events: GameEvent[]
) {
  if (!stunned.tacticalCard) return
  const card = getTacticalCard(stunned.tacticalCard)
  if (!card || card.trigger !== 'on_stunned') return

  const cardId = stunned.tacticalCard
  stunned.tacticalCard = null
  s.players[stunned.owner].graveyard.push(cardId)
  events.push({ type: 'TACTICAL_TRIGGERED', leaderId: stunned.id, cardId, cardName: card.name, effectDesc: card.name })

  if (cardId === 'mutual_destruction') {
    // 對第一位攻擊者造成 5 傷害
    const attacker = s.leaders[attackerIds[0]]
    if (attacker) applyDirectDamage(s, attacker, 5, events)
  }
}

/** 首領被 KO 時（on_ko）*/
function triggerOnKo(s: GameState, koLeader: LeaderInstance, events: GameEvent[]) {
  if (!koLeader.tacticalCard) return
  const card = getTacticalCard(koLeader.tacticalCard)
  if (!card || card.trigger !== 'on_ko') return

  const cardId = koLeader.tacticalCard
  koLeader.tacticalCard = null
  s.players[koLeader.owner].graveyard.push(cardId)
  events.push({ type: 'TACTICAL_TRIGGERED', leaderId: koLeader.id, cardId, cardName: card.name, effectDesc: card.name })

  if (cardId === 'calm_thinking') {
    // 抽 3 張牌
    for (let i = 0; i < 3; i++) drawCardForPlayer(s, koLeader.owner, events)
  }
}

/** 敵方首領進入區域時（on_enemy_enter_zone）*/
function triggerOnEnemyEnterZone(
  s: GameState,
  enteringLeader: LeaderInstance,
  zone: ZoneId,
  events: GameEvent[]
) {
  for (const defender of Object.values(s.leaders)) {
    if (defender.owner === enteringLeader.owner) continue
    if (defender.zone !== zone) continue
    if (!defender.tacticalCard) continue
    const card = getTacticalCard(defender.tacticalCard)
    if (!card || card.trigger !== 'on_enemy_enter_zone') continue

    const cardId = defender.tacticalCard
    defender.tacticalCard = null
    s.players[defender.owner].graveyard.push(cardId)
    events.push({ type: 'TACTICAL_TRIGGERED', leaderId: defender.id, cardId, cardName: card.name, effectDesc: card.name })

    if (cardId === 'intimidate') {
      // 對進入者造成 4 傷害
      applyDirectDamage(s, enteringLeader, 4, events)
    }

    break  // 每次移動只觸發一張戰術卡
  }
}

/** 清磚時（on_enemy_clear_brick）→ 回傳 true 表示被阻擋 */
function triggerOnEnemyClearBrick(
  s: GameState,
  targetZone: ZoneId,
  events: GameEvent[]
): boolean {
  const defender = Object.values(s.leaders).find(
    (l) =>
      l.owner !== s.currentPlayer &&
      l.zone === targetZone &&
      l.tacticalCard !== null &&
      getTacticalCard(l.tacticalCard ?? '')?.trigger === 'on_enemy_clear_brick'
  )
  if (!defender?.tacticalCard) return false

  const card = getTacticalCard(defender.tacticalCard)
  if (!card) return false

  const cardId = defender.tacticalCard
  defender.tacticalCard = null
  s.players[defender.owner].graveyard.push(cardId)
  events.push({ type: 'TACTICAL_TRIGGERED', leaderId: defender.id, cardId, cardName: card.name, effectDesc: card.name })

  if (cardId === 'block') {
    // 無效攻城，抽 1 張牌
    drawCardForPlayer(s, defender.owner, events)
    return true
  }

  return false
}

// ── 列出所有合法動作（供 Bot 使用）─────────────────────

export function listLegalActions(state: GameState): Action[] {
  if (state.winner) return []

  const actions: Action[] = [{ type: 'NEXT_PHASE' }]
  const player = state.currentPlayer

  if (state.phase === 'main') {
    const ps = state.players[player]

    // SUMMON_LEGION
    if (!ps.normalSummonUsed) {
      const myActiveLeaders = Object.values(state.leaders).filter(
        (l) => l.owner === player && l.state !== 'ko' && l.state !== 'reviving'
      )
      for (const cardId of ps.hand) {
        if (getLegionCard(cardId)) {
          for (const leader of myActiveLeaders) {
            if (leader.legions.length < leader.legionSlots) {
              actions.push({ type: 'SUMMON_LEGION', cardId, leaderId: leader.id })
            }
          }
        }
      }
    }

    // PLAY_EVENT
    const enemies = Object.values(state.leaders).filter(
      (l) => l.owner !== player && (l.state === 'normal' || l.state === 'stunned')
    )
    const myLeaders = Object.values(state.leaders).filter(
      (l) => l.owner === player && l.state !== 'ko' && l.state !== 'reviving'
    )
    for (const cardId of ps.hand) {
      const edef = getEventCard(cardId)
      if (!edef) continue
      const others = ps.hand.filter(id => id !== cardId)
      if (others.length < edef.cost.discard) continue
      const discardIds = others.slice(0, edef.cost.discard)
      if (['freeze', 'ambush'].includes(cardId)) {
        for (const e of enemies) {
          if (canDispatch(state, { type: 'PLAY_EVENT', cardId, discardIds, targetLeaderId: e.id }).ok) {
            actions.push({ type: 'PLAY_EVENT', cardId, discardIds, targetLeaderId: e.id })
          }
        }
      } else if (cardId === 'mass_stun') {
        const enemyZones = [...new Set(enemies.map(e => e.zone))]
        for (const z of enemyZones) {
          actions.push({ type: 'PLAY_EVENT', cardId, discardIds, targetZone: z })
        }
      } else if (cardId === 'tactical_retreat') {
        for (const l of myLeaders) {
          actions.push({ type: 'PLAY_EVENT', cardId, discardIds, targetLeaderId: l.id })
        }
      } else if (cardId === 'forced_march') {
        for (const l of myLeaders) {
          for (const z of (Object.keys(state.zones) as ZoneId[])) {
            if (z !== l.zone) {
              actions.push({ type: 'PLAY_EVENT', cardId, discardIds, targetLeaderId: l.id, targetZone: z })
            }
          }
        }
      } else {
        if (canDispatch(state, { type: 'PLAY_EVENT', cardId, discardIds }).ok) {
          actions.push({ type: 'PLAY_EVENT', cardId, discardIds })
        }
      }
    }

    return actions
  }

  if (state.phase === 'react') {
    return listReactPhaseActions(state)
  }

  if (state.phase !== 'battle') return actions

  const myLeaders = Object.values(state.leaders).filter(
    (l) => l.owner === player && l.state === 'normal'
  )
  const enemies = Object.values(state.leaders).filter(
    (l) => l.owner !== player && (l.state === 'normal' || l.state === 'stunned')
  )

  // MOVE（不消耗行動，但 moveCount 限制）
  for (const l of myLeaders) {
    if (l.immobilized) continue
    const passive = getLeaderPassive(l)
    const maxMoves = passive?.type === 'double_move' ? 2 : 1
    if (l.moveCount >= maxMoves) continue
    for (const z of getAdjacentZones(l.zone)) {
      if (canDispatch(state, { type: 'MOVE', leaderId: l.id, toZone: z }).ok) {
        actions.push({ type: 'MOVE', leaderId: l.id, toZone: z })
      }
    }
  }

  // 以下行動需要未在 actedLeaders 中
  const unactedLeaders = myLeaders.filter(l => !state.actedLeaders.includes(l.id))

  // ATTACK（同區域）
  for (const atk of unactedLeaders) {
    for (const tgt of enemies.filter(e => e.zone === atk.zone)) {
      actions.push({ type: 'ATTACK', attackerId: atk.id, targetId: tgt.id })
    }
  }

  // CLEAR_FORT（在 plaza 的首領清敵方基地 fortLevel）
  const enemyBase = enemyLairZone(player)
  for (const atk of unactedLeaders) {
    if (atk.zone === 'plaza' && state.zones[enemyBase].fortLevel > 0) {
      actions.push({ type: 'CLEAR_FORT', leaderId: atk.id })
    }
  }

  // SIEGE（在敵方基地且 fortLevel=0 的首領攻城）
  for (const atk of unactedLeaders) {
    if (atk.zone === enemyBase && state.zones[enemyBase].fortLevel === 0 && state.zones[enemyBase].cityWalls > 0) {
      actions.push({ type: 'SIEGE', leaderId: atk.id })
    }
  }

  // SKILL
  for (const l of unactedLeaders) {
    if (l.skillCooldown <= 0) {
      actions.push({ type: 'SKILL', leaderId: l.id })
    }
  }

  return actions
}

/** 列出 react 階段的合法動作（供 Bot 使用）*/
export function listReactPhaseActions(state: GameState): Action[] {
  if (state.winner) return []
  if (state.phase !== 'react') return [{ type: 'NEXT_PHASE' }]

  const actions: Action[] = [{ type: 'NEXT_PHASE' }]
  const player = state.currentPlayer
  const ps = state.players[player]
  if (!ps || ps.hand.length === 0) return actions

  const myActiveLeaders = Object.values(state.leaders).filter(
    (l) => l.owner === player && l.state !== 'ko' && l.state !== 'reviving'
  )

  for (const cardId of ps.hand) {
    if (getTacticalCard(cardId)) {
      // 戰術卡：INSTALL_TACTICAL（react 階段無次數限制）
      for (const leader of myActiveLeaders) {
        if (leader.tacticalCard === null) {
          actions.push({ type: 'INSTALL_TACTICAL', cardId, leaderId: leader.id })
        }
      }
    }
  }

  return actions
}

/** 列出裝備相關動作（供 Bot 使用，相容舊接口）*/
export function listEquipmentActions(state: GameState): Action[] {
  if (state.phase === 'main') {
    // main 階段：SUMMON_LEGION
    const actions: Action[] = [{ type: 'NEXT_PHASE' }]
    const player = state.currentPlayer
    const ps = state.players[player]
    if (!ps || ps.normalSummonUsed || ps.hand.length === 0) return actions

    const myActiveLeaders = Object.values(state.leaders).filter(
      (l) => l.owner === player && l.state !== 'ko' && l.state !== 'reviving'
    )
    for (const cardId of ps.hand) {
      if (getLegionCard(cardId)) {
        for (const leader of myActiveLeaders) {
          if (leader.legions.length < leader.legionSlots) {
            actions.push({ type: 'SUMMON_LEGION', cardId, leaderId: leader.id })
          }
        }
      }
    }
    return actions
  }

  if (state.phase === 'react') {
    return listReactPhaseActions(state)
  }

  return [{ type: 'NEXT_PHASE' }]
}

// ── SUMMON_LEGION ──────────────────────────────────────

function applySummonLegion(
  s: GameState,
  cardId: string,
  leaderId: string,
  events: GameEvent[]
) {
  const player = s.currentPlayer
  const ps = s.players[player]
  const leader = s.leaders[leaderId]
  const card = getLegionCard(cardId)!

  const idx = ps.hand.indexOf(cardId)
  ps.hand.splice(idx, 1)

  leader.legions.push(cardId)
  leader.bonusToughness += card.bonusToughness
  leader.bonusAttack += card.bonusAttack
  leader.bonusSupport += card.bonusSupport

  ps.normalSummonUsed = true

  events.push({
    type: 'LEGION_SUMMONED',
    leaderId,
    cardId,
    cardName: card.name,
  })
}

// ── INSTALL_TACTICAL ───────────────────────────────────

function applyInstallTactical(
  s: GameState,
  cardId: string,
  leaderId: string,
  events: GameEvent[]
) {
  const player = s.currentPlayer
  const ps = s.players[player]
  const leader = s.leaders[leaderId]
  const card = getTacticalCard(cardId)!

  const idx = ps.hand.indexOf(cardId)
  ps.hand.splice(idx, 1)

  leader.tacticalCard = cardId

  events.push({
    type: 'TACTICAL_INSTALLED',
    leaderId,
    cardId,
    cardName: card.name,
  })
}

// ── SKILL ─────────────────────────────────────────────

const SKILL_COOLDOWN = 3
const SKILL_NAMES: Record<string, string> = {
  destroyer: '戰吼',
  conqueror: '衝鋒',
  commander: '號令',
  guardian: '鐵壁',
}

function applySkill(s: GameState, leaderId: string, events: GameEvent[]) {
  const leader = s.leaders[leaderId]
  const skillName = SKILL_NAMES[leader.leaderClass] ?? '技能'

  switch (leader.leaderClass) {
    case 'destroyer': applyWarcry(s, leader, skillName, events); break
    case 'conqueror': applyCharge(s, leader, skillName, events); break
    case 'commander': applyRally(s, leader, skillName, events); break
    case 'guardian':  applyFortify(s, leader, skillName, events); break
    default:
      events.push({ type: 'SKILL_USED', leaderId, skillName, effectDesc: '（未知技能）' })
  }

  leader.skillCooldown = SKILL_COOLDOWN
  s.actedLeaders.push(leaderId)
}

/** 破壞者 — 戰吼：對同區域的所有敵首領造成 attack/2 傷害 */
function applyWarcry(s: GameState, leader: LeaderInstance, skillName: string, events: GameEvent[]) {
  const damage = Math.max(1, Math.ceil(totalAttack(leader) / 2))
  const enemies = Object.values(s.leaders).filter(
    (e) => e.owner !== leader.owner &&
           (e.state === 'normal' || e.state === 'stunned') &&
           e.zone === leader.zone
  )
  for (const enemy of enemies) {
    applyDirectDamage(s, enemy, damage, events)
  }
  events.push({ type: 'SKILL_USED', leaderId: leader.id, skillName, effectDesc: `AOE傷害${damage}（影響${enemies.length}個目標）` })
}

/** 征服者 — 衝鋒：無視築城強行進入最近敵方相鄰區域 */
function applyCharge(s: GameState, leader: LeaderInstance, skillName: string, events: GameEvent[]) {
  const adj = getAdjacentZones(leader.zone)
  const enemyLair = enemyLairZone(leader.owner)
  const lairIdx = ZONE_ORDER.indexOf(enemyLair)
  const curDist = Math.abs(ZONE_ORDER.indexOf(leader.zone) - lairIdx)

  const candidates = adj.filter(
    (z) => Math.abs(ZONE_ORDER.indexOf(z) - lairIdx) < curDist
  )
  if (candidates.length === 0) {
    events.push({ type: 'SKILL_USED', leaderId: leader.id, skillName, effectDesc: '無可衝鋒的目標' })
    return
  }

  const target = candidates.reduce((a, b) =>
    Math.abs(ZONE_ORDER.indexOf(a) - lairIdx) <= Math.abs(ZONE_ORDER.indexOf(b) - lairIdx) ? a : b
  )

  const from = leader.zone
  leader.zone = target
  leader.moveCount++
  events.push({ type: 'LEADER_MOVED', leaderId: leader.id, from, to: target })
  events.push({ type: 'SKILL_USED', leaderId: leader.id, skillName, effectDesc: `衝鋒至 ${target}（無視築城）` })
  triggerOnEnemyEnterZone(s, leader, target, events)
}

/** 指揮官 — 號令：抽 2 張牌 */
function applyRally(s: GameState, leader: LeaderInstance, skillName: string, events: GameEvent[]) {
  drawCardForPlayer(s, leader.owner, events)
  drawCardForPlayer(s, leader.owner, events)
  events.push({ type: 'SKILL_USED', leaderId: leader.id, skillName, effectDesc: '抽2張牌' })
}

/** 守護者 — 鐵壁：己方所在基地+1築城（上限3），若在 plaza 則兩個友方相鄰基地各+1 */
function applyFortify(s: GameState, leader: LeaderInstance, skillName: string, events: GameEvent[]) {
  if (leader.zone === 'plaza') {
    // 在 plaza：強化兩側友方基地
    const ownBase = lairZone(leader.owner)
    const zone = s.zones[ownBase]
    zone.fortLevel = Math.min(3, zone.fortLevel + 1)
    events.push({
      type: 'SKILL_USED', leaderId: leader.id, skillName,
      effectDesc: `${ownBase}築城+1（現為${zone.fortLevel}）`,
    })
  } else {
    // 在己方基地：加強本區域
    const zone = s.zones[leader.zone]
    zone.fortLevel = Math.min(3, zone.fortLevel + 1)
    events.push({
      type: 'SKILL_USED', leaderId: leader.id, skillName,
      effectDesc: `${leader.zone}築城+1（現為${zone.fortLevel}）`,
    })
  }
}

// ── PLAY_EVENT ─────────────────────────────────────

function applyPlayEvent(
  s: GameState,
  cardId: string,
  discardIds: string[],
  targetLeaderId: string | undefined,
  targetZone: ZoneId | undefined,
  events: GameEvent[]
) {
  const player = s.currentPlayer
  const ps = s.players[player]
  const edef = getEventCard(cardId)!

  // 從手牌移除主卡 + 棄牌費
  const removeIds = [cardId, ...discardIds]
  for (const id of removeIds) {
    const i = ps.hand.indexOf(id)
    if (i !== -1) { ps.hand.splice(i, 1); ps.graveyard.push(id) }
  }

  events.push({ type: 'EVENT_PLAYED', cardId, cardName: edef.name, player, effectDesc: edef.name })

  switch (cardId) {
    case 'tactical_retreat': {
      const leader = targetLeaderId ? s.leaders[targetLeaderId] : Object.values(s.leaders).find(l => l.owner === player && l.state !== 'ko' && l.state !== 'reviving')
      if (leader) {
        const from = leader.zone
        leader.zone = lairZone(player)
        events.push({ type: 'LEADER_MOVED', leaderId: leader.id, from, to: leader.zone })
        applyRecover(s, leader, 2, events)
      }
      break
    }
    case 'forced_march': {
      const leader = targetLeaderId ? s.leaders[targetLeaderId] : null
      if (leader && targetZone) {
        const from = leader.zone
        leader.zone = targetZone
        events.push({ type: 'LEADER_MOVED', leaderId: leader.id, from, to: targetZone })
      }
      break
    }
    case 'battle_cry':
      s.turnFlags[player].battle_cry = true
      break
    case 'divine_blessing':
      s.turnFlags[player].divine_blessing = true
      for (const l of Object.values(s.leaders)) {
        if (l.owner === player && l.state !== 'ko' && l.state !== 'reviving') applyRecover(s, l, 2, events)
      }
      break
    case 'mass_stun': {
      const zone = targetZone ?? Object.values(s.leaders).find(l => l.owner === player && l.state === 'normal')?.zone
      if (zone) {
        for (const l of Object.values(s.leaders)) {
          if (l.owner !== player && l.zone === zone && l.state === 'normal') {
            l.state = 'stunned'
            events.push({ type: 'LEADER_STUNNED', leaderId: l.id })
          }
        }
      }
      break
    }
    case 'freeze': {
      const target = targetLeaderId ? s.leaders[targetLeaderId] : null
      if (target) {
        target.immobilized = true
        events.push({ type: 'LEADER_IMMOBILIZED', leaderId: target.id })
      }
      break
    }
    case 'draw_cards':
      drawCardForPlayer(s, player, events)
      drawCardForPlayer(s, player, events)
      break
    case 'emergency_repair': {
      // 加強我方基地 fortLevel（而不是 fortification）
      const myBase = lairZone(player)
      s.zones[myBase].fortLevel = Math.min(2, s.zones[myBase].fortLevel + 1)
      for (const l of Object.values(s.leaders)) {
        if (l.owner === player && l.zone === myBase) applyRecover(s, l, 1, events)
      }
      break
    }
    case 'rush_time':
      for (let i = 0; i < 5; i++) drawCardForPlayer(s, player, events)
      for (const l of Object.values(s.leaders)) {
        if (l.owner === player) {
          if (l.state === 'stunned') { l.state = 'normal'; events.push({ type: 'STUN_RECOVERED', leaderId: l.id }) }
          l.skillCooldown = 0
        }
      }
      break
    case 'ambush': {
      const target = targetLeaderId ? s.leaders[targetLeaderId] : Object.values(s.leaders).find(l => l.owner !== player && (l.state === 'normal' || l.state === 'stunned'))
      if (target) {
        applyDirectDamage(s, target, 4, events)
        applyKnockback(s, target, events)
      }
      break
    }
  }
}

// ── 回復輔助 ──────────────────────────────────────

function applyRecover(_s: GameState, leader: LeaderInstance, amount: number, events: GameEvent[]) {
  if (leader.state === 'stunned') {
    leader.state = 'normal'
    events.push({ type: 'STUN_RECOVERED', leaderId: leader.id })
    events.push({ type: 'LEADER_RECOVERED', leaderId: leader.id, amount })
  } else if (leader.state === 'ko') {
    leader.koTurnCount = Math.max(0, leader.koTurnCount - amount)
    events.push({ type: 'LEADER_RECOVERED', leaderId: leader.id, amount })
  } else if (leader.state === 'normal') {
    events.push({ type: 'LEADER_RECOVERED', leaderId: leader.id, amount })
  }
}

// ── 擊退輔助 ──────────────────────────────────────

function applyKnockback(_s: GameState, target: LeaderInstance, events: GameEvent[]) {
  const ownLair = lairZone(target.owner)
  const targetIdx = ZONE_ORDER.indexOf(target.zone)
  const lairIdx   = ZONE_ORDER.indexOf(ownLair)
  if (targetIdx === lairIdx) return
  const direction = lairIdx > targetIdx ? 1 : -1
  const newZone = ZONE_ORDER[targetIdx + direction] as ZoneId
  const from = target.zone
  target.zone = newZone
  events.push({ type: 'LEADER_PUSHED_BACK', leaderId: target.id, from, to: newZone })
}


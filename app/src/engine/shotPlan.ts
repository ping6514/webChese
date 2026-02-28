import type { Event } from './events'
import { BASE_STATS, type GameState } from './state'
import { canShoot } from './shooting'
import { getDefValueInState } from './stats'
import { getEffectHandlers, type ShotPlan } from './effects'
import { getSoulCard } from './cards'
import { computeRawDamage } from './damage'
import { killUnit as killUnitShared } from './kill'
import { rollDice, type RngState } from '../serverSim'
import { countCorpses, countSoldiers } from './corpses'

export type ShotPlanResult = { ok: true; plan: ShotPlan } | { ok: false; error: string }

export function buildShotPlan(state: GameState, attackerId: string, targetUnitId: string, extraTargetUnitId?: string | null): ShotPlanResult {
  const handlers = getEffectHandlers(state)

  const events: Event[] = []

  const shootRules = {
    ignoreBlockingCount: 0,
    ignoreBlockingAll: false,
    manaCostOverride: undefined as number | undefined,
  }

  for (const h of handlers) {
    const res = h.onBeforeShootValidate?.({ state, attackerId, targetUnitId, shootRules, events })
    if (res && !res.ok) return res
  }

  const check = canShoot(state, attackerId, targetUnitId, shootRules)
  if (!check.ok) return { ok: false, error: check.error }

  const plan: ShotPlan = {
    attackerId,
    cost: state.rules.shootManaCost,
    instances: [{ kind: 'direct', sourceUnitId: attackerId, targetUnitId }],
    abilityUses: [],
  }

  for (const h of handlers) {
    h.onAfterShotPlanBuilt?.({ state, attackerId, targetUnitId, extraTargetUnitId, events }, plan)
  }

  ;(plan as any).__buildEvents = events
  return { ok: true, plan }
}

export type ExecuteShotPlanResult = { ok: true; state: GameState; events: Event[] } | { ok: false; error: string }

export function executeShotPlan(state: GameState, plan: ShotPlan): ExecuteShotPlanResult {
  const attacker = state.units[plan.attackerId]
  if (!attacker) return { ok: false, error: 'Attacker not found' }

  const events: Event[] = []

  const instancePriority: Record<string, number> = {
    direct: 0,
    chain: 1,
    splash: 2,
    pierce: 3,
    counter: 4,
  }

  const sortedInstances = [...plan.instances].sort((a, b) => {
    const ak = String((a as any).kind ?? '')
    const bk = String((b as any).kind ?? '')
    const ap = instancePriority[ak] ?? 999
    const bp = instancePriority[bk] ?? 999
    if (ap !== bp) return ap - bp

    const asrc = String((a as any).sourceUnitId ?? '')
    const bsrc = String((b as any).sourceUnitId ?? '')
    if (asrc !== bsrc) return asrc.localeCompare(bsrc)

    const atgt = String((a as any).targetUnitId ?? '')
    const btgt = String((b as any).targetUnitId ?? '')
    if (atgt !== btgt) return atgt.localeCompare(btgt)

    return 0
  })

  if (state.turnFlags.shotUsed[plan.attackerId]) {
    const soulId = attacker.enchant?.soulId
    const card = soulId ? getSoulCard(soulId) : undefined
    const ab = card?.abilities.find((a) => a.type === 'MOVE_THEN_SHOOT')
    const when = (ab as any)?.when
    if (when && String(when.type ?? '') === 'CORPSES_GTE') {
      const need = Number(when.count ?? 0)
      if (Number.isFinite(need) && need > 0) {
        const corpses = countCorpses(state, attacker.side)
        if (corpses < need) return { ok: false, error: 'Already shot this turn' }
      }
    }
    if (when && String(when.type ?? '') === 'SOLDIERS_GTE') {
      const need = Number(when.count ?? 0)
      if (Number.isFinite(need) && need > 0) {
        if (countSoldiers(state, attacker.side) < need) return { ok: false, error: 'Already shot this turn' }
      }
    }
    const perTurn = Number((ab as any)?.perTurn ?? 0)
    const moved = !!state.turnFlags.movedThisTurn?.[plan.attackerId]
    const key = `${plan.attackerId}:MOVE_THEN_SHOOT`
    const used = Number(state.turnFlags.abilityUsed?.[key] ?? 0)
    const canExtra = moved && Number.isFinite(perTurn) && perTurn > 0 && used < perTurn
    if (!canExtra) return { ok: false, error: 'Already shot this turn' }
    const nextUses = plan.abilityUses ? [...plan.abilityUses] : []
    nextUses.push({ key })
    plan.abilityUses = nextUses
  }

  const r = state.resources[state.turn.side]
  if (r.mana < plan.cost) return { ok: false, error: 'Not enough mana' }

  let nextState: GameState = {
    ...state,
    turnFlags: {
      ...state.turnFlags,
      shotUsed: {
        ...state.turnFlags.shotUsed,
        [plan.attackerId]: true,
      },
    },
    resources: {
      ...state.resources,
      [state.turn.side]: {
        ...r,
        mana: r.mana - plan.cost,
      },
    },
    units: { ...state.units },
    corpsesByPos: { ...state.corpsesByPos },
    graveyard: {
      red: [...state.graveyard.red],
      black: [...state.graveyard.black],
    },
  }

  if (plan.abilityUses && plan.abilityUses.length > 0) {
    const cur = nextState.turnFlags.abilityUsed ?? {}
    const next: Record<string, number> = { ...cur }
    for (const u of plan.abilityUses) {
      const key = String((u as any).key ?? '')
      if (!key) continue
      next[key] = Number(next[key] ?? 0) + 1

      const parts = key.split(':')
      const unitId = parts[0] ?? ''
      const abilityType = parts.slice(1).join(':')
      if (unitId && abilityType) {
        events.push({ type: 'ABILITY_TRIGGERED', unitId, abilityType, text: abilityType })
      }
    }
    nextState = {
      ...nextState,
      turnFlags: {
        ...nextState.turnFlags,
        abilityUsed: next,
      },
    }
  }

  const rngState: RngState | null = state.rules.rngMode === 'seeded' ? (state.rngState ? { x: state.rngState.x } : null) : null
  const dice = rngState ? rollDice(6, rngState) : state.rules.diceFixed

  function maxHpForUnit(s: GameState, unitId: string): number {
    const u = s.units[unitId]
    if (!u) return 0
    const soulId = u.enchant?.soulId
    if (!soulId) {
      const base = BASE_STATS[u.base]
      return base?.hp ?? 0
    }
    const card = getSoulCard(soulId)
    return card?.stats.hp ?? 0
  }

  function findKingId(s: GameState, side: 'red' | 'black'): string | null {
    for (const u of Object.values(s.units)) {
      if (u.side === side && u.base === 'king') return u.id
    }
    return null
  }

  function healKingOnKill(s: GameState, events: Event[], killerUnitId: string, amount: number): GameState {
    if (!(Number.isFinite(amount) && amount > 0)) return s
    const killer = s.units[killerUnitId]
    if (!killer) return s

    const kingId = findKingId(s, killer.side)
    if (!kingId) return s
    const king = s.units[kingId]
    if (!king) return s

    const maxHp = maxHpForUnit(s, kingId)
    const cappedMax = maxHp > 0 ? maxHp : king.hpCurrent
    const nextHp = Math.min(cappedMax, king.hpCurrent + Math.floor(amount))
    if (nextHp === king.hpCurrent) return s
    s.units[kingId] = { ...king, hpCurrent: nextHp }
    events.push({ type: 'UNIT_HP_CHANGED', unitId: kingId, from: king.hpCurrent, to: nextHp, reason: 'HEAL_KING_ON_KILL' })
    return s
  }

  function palaceContains(side: 'red' | 'black', pos: { x: number; y: number }): boolean {
    if (pos.x < 3 || pos.x > 5) return false
    if (side === 'red') return pos.y >= 7 && pos.y <= 9
    return pos.y >= 0 && pos.y <= 2
  }

  function alliesInPalaceCount(s: GameState, side: 'red' | 'black'): number {
    let n = 0
    for (const u of Object.values(s.units)) {
      if (u.side !== side) continue
      if (palaceContains(side, u.pos)) n++
    }
    return n
  }

  function findDamageSharer(s: GameState, targetSide: 'red' | 'black'): { unitId: string; amount: number } | null {
    const alliesInPalace = alliesInPalaceCount(s, targetSide)

    for (const u of Object.values(s.units).sort((a, b) => a.id.localeCompare(b.id))) {
      if (u.side !== targetSide) continue
      if (!palaceContains(targetSide, u.pos)) continue

      const soulId = u.enchant?.soulId
      if (!soulId) continue
      const card = getSoulCard(soulId)
      if (!card) continue

      for (const ab of card.abilities) {
        if (ab.type !== 'DAMAGE_SHARE') continue
        const amount = Number((ab as any).amount ?? 0)
        if (!Number.isFinite(amount) || amount <= 0) continue
        const when = (ab as any).when
        if (when && when.type === 'ALLIES_IN_PALACE_GTE') {
          const need = Number(when.count ?? 0)
          if (alliesInPalace < need) continue
        }
        return { unitId: u.id, amount }
      }
    }

    return null
  }

  function findPalaceGuard(s: GameState, kingside: 'red' | 'black'): { unitId: string; amount: number } | null {
    for (const u of Object.values(s.units).sort((a, b) => a.id.localeCompare(b.id))) {
      if (u.side !== kingside) continue
      if (!palaceContains(kingside, u.pos)) continue
      const soulId = u.enchant?.soulId
      if (!soulId) continue
      const card = getSoulCard(soulId)
      if (!card) continue
      for (const ab of card.abilities) {
        if (ab.type !== 'PALACE_GUARD') continue
        const amount = Number((ab as any).amount ?? 1)
        const perTurn = Number((ab as any).perTurn ?? 1)
        const key = `${u.id}:PALACE_GUARD`
        const used = Number(s.turnFlags.abilityUsed?.[key] ?? 0)
        if (used >= perTurn) continue
        return { unitId: u.id, amount }
      }
    }
    return null
  }

  function applyCounterOnKingDamaged(s: GameState, events: Event[], attackSourceId: string, damagedKingId: string): GameState {
    const king = s.units[damagedKingId]
    const src = s.units[attackSourceId]
    if (!king || !src) return s

    // Find first eligible counter unit (deterministic by id)
    const counters = Object.values(s.units)
      .filter((u) => u.side === king.side)
      .filter((u) => u.enchant?.soulId)
      .sort((a, b) => a.id.localeCompare(b.id))

    for (const u of counters) {
      const soulId = u.enchant?.soulId
      if (!soulId) continue
      const card = getSoulCard(soulId)
      if (!card) continue

      const ab = card.abilities.find((a) => a.type === 'COUNTER_ON_KING_DAMAGED')
      if (!ab) continue

      const perTurn = Number((ab as any).perTurn ?? 0)
      const key = `${u.id}:COUNTER_ON_KING_DAMAGED`
      const used = Number(s.turnFlags.abilityUsed?.[key] ?? 0)
      if (Number.isFinite(perTurn) && perTurn > 0 && used >= perTurn) continue

      const dmg = (ab as any).damage ?? {}
      const dice = Number(dmg.dice ?? 0)
      const atkKey = String(dmg.atkKey ?? 'phys')
      const atkValue = Number(dmg.atkValue ?? 0)
      if (!(Number.isFinite(dice) && dice > 0)) continue

      const defValue = getDefValueInState(s, src, atkKey)
      const raw = Math.max(1, dice + atkValue - defValue)
      const nextHp = src.hpCurrent - raw
      s.units[src.id] = { ...src, hpCurrent: nextHp }
      events.push({ type: 'DAMAGE_DEALT', attackerId: u.id, targetUnitId: src.id, amount: raw })

      const cur = s.turnFlags.abilityUsed ?? {}
      s.turnFlags = {
        ...s.turnFlags,
        abilityUsed: {
          ...cur,
          [key]: Number(cur[key] ?? 0) + 1,
        },
      }

      if (nextHp <= 0) {
        s = killUnit(s, src.id, events)
      }

      break
    }

    return s
  }

  function killUnit(s: GameState, unitId: string, events: Event[]): GameState {
    return killUnitShared(s, unitId, events)
  }

  for (const inst of sortedInstances) {
    const src = nextState.units[inst.sourceUnitId]
    const tgt = nextState.units[inst.targetUnitId]
    if (!src || !tgt) continue

    const rawDamage = (() => {
      const fixed = Number((inst as any).fixedDamage ?? 0)
      if (Number.isFinite(fixed) && fixed > 0) return Math.floor(fixed)

      return computeRawDamage(nextState, src.id, tgt.id, dice)
    })()

    // DAMAGE_SHARE: transfer up to N damage from target to an eligible allied unit.
    // Keep target damage minimum 1.
    let sharedToUnitId: string | null = null
    let sharedAmount = 0
    const sharer = findDamageSharer(nextState, tgt.side)
    if (sharer && sharer.unitId !== tgt.id) {
      sharedToUnitId = sharer.unitId
      sharedAmount = Math.max(0, Math.min(sharer.amount, rawDamage - 1))
    }

    let damageToTarget = rawDamage - sharedAmount

    // PALACE_GUARD (宮護): reduce damage to king when ally advisor is in palace
    if (tgt.base === 'king' && damageToTarget > 0) {
      const guard = findPalaceGuard(nextState, tgt.side)
      if (guard) {
        const key = `${guard.unitId}:PALACE_GUARD`
        const cur = nextState.turnFlags.abilityUsed ?? {}
        nextState.turnFlags = {
          ...nextState.turnFlags,
          abilityUsed: { ...cur, [key]: Number(cur[key] ?? 0) + 1 },
        }
        damageToTarget = Math.max(0, damageToTarget - guard.amount)
        events.push({ type: 'ABILITY_TRIGGERED', unitId: guard.unitId, abilityType: 'PALACE_GUARD', text: '宮護' })
      }
    }

    const kingInvincible = tgt.base === 'king' && nextState.status.kingInvincibleSide === tgt.side
    const finalDamageToTarget = kingInvincible ? 0 : damageToTarget

    const nextHp = tgt.hpCurrent - finalDamageToTarget
    nextState.units[tgt.id] = { ...tgt, hpCurrent: nextHp }

    if (sharedToUnitId && sharedAmount > 0) {
      const shareUnit = nextState.units[sharedToUnitId]
      if (shareUnit) {
        const shareNextHp = shareUnit.hpCurrent - sharedAmount
        nextState.units[sharedToUnitId] = { ...shareUnit, hpCurrent: shareNextHp }
        if (shareNextHp <= 0) {
          nextState = killUnit(nextState, sharedToUnitId, events)
        }
      }
    }

    events.push({ type: 'SHOT_FIRED', attackerId: src.id, targetUnitId: tgt.id })
    events.push({ type: 'DICE_ROLLED', sides: 6, value: dice })
    events.push({ type: 'DAMAGE_DEALT', attackerId: src.id, targetUnitId: tgt.id, amount: finalDamageToTarget })

    if (sharedToUnitId && sharedAmount > 0) {
      events.push({ type: 'DAMAGE_DEALT', attackerId: src.id, targetUnitId: sharedToUnitId, amount: sharedAmount })
    }

    if (finalDamageToTarget > 0 && tgt.base === 'king') {
      nextState = applyCounterOnKingDamaged(nextState, events, src.id, tgt.id)
    }

    if (nextHp <= 0) {
      if (kingInvincible) continue
      const killedSide = tgt.side
      nextState = killUnit(nextState, tgt.id, events)

      // HEAL_KING_ON_KILL: if src has the ability and it killed an enemy, heal allied king.
      if (killedSide !== src.side) {
        const soulId = src.enchant?.soulId
        const card = soulId ? getSoulCard(soulId) : undefined
        const heal = card?.abilities.find((a) => a.type === 'HEAL_KING_ON_KILL')
        const amount = Number((heal as any)?.amount ?? 0)
        if (Number.isFinite(amount) && amount > 0) {
          nextState = healKingOnKill(nextState, events, src.id, amount)
        }
      }
    }
  }

  const rr = nextState.resources[state.turn.side]
  events.push({
    type: 'RESOURCES_CHANGED',
    side: state.turn.side,
    gold: rr.gold,
    mana: rr.mana,
    storageMana: rr.storageMana,
  })

  if (rngState) {
    nextState = {
      ...nextState,
      rngState: { x: rngState.x },
    }
  }

  return { ok: true, state: nextState, events }
}

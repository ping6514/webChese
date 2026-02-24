import type { Event } from './events'
import type { GameState } from './state'
import { canShoot } from './shooting'
import { getDefValue } from './stats'
import { getEffectHandlers, type ShotPlan } from './effects'
import { getSoulCard } from './cards'

export type ShotPlanResult = { ok: true; plan: ShotPlan } | { ok: false; error: string }

export function buildShotPlan(state: GameState, attackerId: string, targetUnitId: string): ShotPlanResult {
  const handlers = getEffectHandlers(state)

  const shootRules = {
    ignoreBlockingCount: 0,
    ignoreBlockingAll: false,
  }

  for (const h of handlers) {
    const res = h.onBeforeShootValidate?.({ state, attackerId, targetUnitId, shootRules })
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
    h.onAfterShotPlanBuilt?.({ state, attackerId, targetUnitId }, plan)
  }

  return { ok: true, plan }
}

export type ExecuteShotPlanResult = { ok: true; state: GameState; events: Event[] } | { ok: false; error: string }

export function executeShotPlan(state: GameState, plan: ShotPlan): ExecuteShotPlanResult {
  const attacker = state.units[plan.attackerId]
  if (!attacker) return { ok: false, error: 'Attacker not found' }

  if (state.turnFlags.shotUsed[plan.attackerId]) {
    const soulId = attacker.enchant?.soulId
    const card = soulId ? getSoulCard(soulId) : undefined
    const ab = card?.abilities.find((a) => a.type === 'MOVE_THEN_SHOOT')
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
    }
    nextState = {
      ...nextState,
      turnFlags: {
        ...nextState.turnFlags,
        abilityUsed: next,
      },
    }
  }

  const events: Event[] = []

  const dice = state.rules.diceFixed

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

  function crossedRiver(side: 'red' | 'black', y: number): boolean {
    return side === 'red' ? y <= 4 : y >= 5
  }

  function getDamageBonusForAttacker(s: GameState, attackerId: string): number {
    const u = s.units[attackerId]
    if (!u) return 0
    const soulId = u.enchant?.soulId
    if (!soulId) return 0
    const card = getSoulCard(soulId)
    if (!card) return 0

    const hasCrossRiver = card.abilities.some((a) => a.type === 'CROSS_RIVER')
    if (hasCrossRiver && !crossedRiver(u.side, u.pos.y)) return 0

    let bonus = 0
    for (const ab of card.abilities) {
      if (ab.type !== 'DAMAGE_BONUS') continue
      const amount = Number((ab as any).amount ?? 0)
      if (Number.isFinite(amount) && amount > 0) bonus += amount
    }

    // AURA_DAMAGE_BONUS from allied aura units.
    for (const auraUnit of Object.values(s.units)) {
      if (auraUnit.side !== u.side) continue
      const auraSoulId = auraUnit.enchant?.soulId
      if (!auraSoulId) continue
      const auraCard = getSoulCard(auraSoulId)
      if (!auraCard) continue

      for (const ab of auraCard.abilities) {
        if (ab.type !== 'AURA_DAMAGE_BONUS') continue
        const when = (ab as any).when
        if (when && when.type === 'RESONANCE_ACTIVE') {
          const res = auraCard.abilities.find((a) => a.type === 'RESONANCE')
          const need = Number((res as any)?.need ?? 0)
          if (!(Number.isFinite(need) && need > 0)) continue
          let count = 0
          for (const uu of Object.values(s.units)) {
            if (uu.side !== auraUnit.side) continue
            const sid = uu.enchant?.soulId
            if (!sid) continue
            const cc = getSoulCard(sid)
            if (!cc) continue
            if (cc.clan !== auraCard.clan) continue
            count++
          }
          if (count < need) continue
        }

        const forKey = String((ab as any).for ?? '')
        if (forKey === 'CROSS_RIVER_UNITS' && !crossedRiver(u.side, u.pos.y)) continue

        const amount = Number((ab as any).amount ?? 0)
        if (Number.isFinite(amount) && amount > 0) bonus += amount
      }
    }

    return bonus
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

      const defValue = getDefValue(src, atkKey)
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
        const posKey = `${src.pos.x},${src.pos.y}`
        const corpse = { ownerSide: src.side, base: src.base }
        const stack = s.corpsesByPos[posKey] ? [...s.corpsesByPos[posKey]] : []
        stack.push(corpse)
        s.corpsesByPos[posKey] = stack
        if (src.enchant?.soulId) s.graveyard[src.side] = [src.enchant.soulId, ...s.graveyard[src.side]]
        delete s.units[src.id]
        events.push({ type: 'UNIT_KILLED', unitId: src.id })
      }

      break
    }

    return s
  }

  for (const inst of plan.instances) {
    const src = nextState.units[inst.sourceUnitId]
    const tgt = nextState.units[inst.targetUnitId]
    if (!src || !tgt) continue

    const rawDamage = (() => {
      const fixed = Number((inst as any).fixedDamage ?? 0)
      if (Number.isFinite(fixed) && fixed > 0) return Math.floor(fixed)

      const defValue = getDefValue(tgt, src.atk.key)
      const bonus = getDamageBonusForAttacker(nextState, src.id)
      return Math.max(1, dice + src.atk.value + bonus - defValue)
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

    const damageToTarget = rawDamage - sharedAmount

    const nextHp = tgt.hpCurrent - damageToTarget
    nextState.units[tgt.id] = { ...tgt, hpCurrent: nextHp }

    if (sharedToUnitId && sharedAmount > 0) {
      const shareUnit = nextState.units[sharedToUnitId]
      if (shareUnit) {
        nextState.units[sharedToUnitId] = { ...shareUnit, hpCurrent: shareUnit.hpCurrent - sharedAmount }
      }
    }

    events.push({ type: 'SHOT_FIRED', attackerId: src.id, targetUnitId: tgt.id })
    events.push({ type: 'DICE_ROLLED', sides: 6, value: dice })
    events.push({ type: 'DAMAGE_DEALT', attackerId: src.id, targetUnitId: tgt.id, amount: damageToTarget })

    if (sharedToUnitId && sharedAmount > 0) {
      events.push({ type: 'DAMAGE_DEALT', attackerId: src.id, targetUnitId: sharedToUnitId, amount: sharedAmount })
    }

    if (damageToTarget > 0 && tgt.base === 'king') {
      nextState = applyCounterOnKingDamaged(nextState, events, src.id, tgt.id)
    }

    if (nextHp <= 0) {
      const posKey = `${tgt.pos.x},${tgt.pos.y}`
      const corpse = {
        ownerSide: tgt.side,
        base: tgt.base,
      }
      const stack = nextState.corpsesByPos[posKey] ? [...nextState.corpsesByPos[posKey]] : []
      stack.push(corpse)
      nextState.corpsesByPos[posKey] = stack

      if (tgt.enchant?.soulId) {
        nextState.graveyard[tgt.side] = [tgt.enchant.soulId, ...nextState.graveyard[tgt.side]]
      }

      delete nextState.units[tgt.id]
      events.push({ type: 'UNIT_KILLED', unitId: tgt.id })
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

  return { ok: true, state: nextState, events }
}

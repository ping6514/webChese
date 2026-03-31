import type { Event } from './events'
import { BASE_STATS, type GameState, type Unit } from './state'
import { SHOT_INSTANCE_PRIORITY } from './gameConfig'
import { canShoot } from './shooting'
import { getDefValueInState } from './stats'
import { getEffectHandlers, type ShotPlan } from './effects'
import { getSoulCard } from './cards'
import { computeDamageWithBreakdown, findFirstDamagedReduction } from './damage'
import { killUnit as killUnitShared } from './kill'
import { rollDice, type RngState } from '../serverSim'
import { countCorpses, countSoldiers } from './corpses'

export type ShotPlanResult = { ok: true; plan: ShotPlan } | { ok: false; error: string }

export function buildShotPlan(state: GameState, attackerId: string, targetUnitId: string, extraTargetUnitId?: string | null, suppressPierce?: boolean): ShotPlanResult {
  const handlers = getEffectHandlers(state)

  const events: Event[] = []

  const shootRules = {
    ignoreBlockingCount: 0,
    ignoreBlockingAll: false,
    manaCostOverride: undefined as number | undefined,
  }

  for (const h of handlers) {
    const res = h.onBeforeShootValidate?.({ state, attackerId, targetUnitId, extraTargetUnitId, shootRules, events })
    if (res && !res.ok) return { ok: false, error: (res as { ok: false; error: string }).error }
  }

  const check = canShoot(state, attackerId, targetUnitId, shootRules)
  if (!check.ok) return { ok: false, error: (check as { ok: false; error: string }).error }

  const cost = Number.isFinite(shootRules.manaCostOverride as any)
    ? Math.max(0, Math.floor(shootRules.manaCostOverride as number))
    : state.rules.shootManaCost

  const plan: ShotPlan = {
    attackerId,
    cost,
    instances: [{ kind: 'direct', sourceUnitId: attackerId, targetUnitId }],
    abilityUses: [],
  }

  for (const h of handlers) {
    h.onAfterShotPlanBuilt?.({ state, attackerId, targetUnitId, extraTargetUnitId, suppressPierce, events }, plan)
  }

  ;(plan as any).__buildEvents = events
  return { ok: true, plan }
}

export type ExecuteShotPlanResult = { ok: true; state: GameState; events: Event[] } | { ok: false; error: string }

export function executeShotPlan(state: GameState, plan: ShotPlan): ExecuteShotPlanResult {
  const attacker = state.units[plan.attackerId]
  if (!attacker) return { ok: false, error: '找不到攻擊者' }

  const events: Event[] = []

  // Track direct-hit damage so SPLASH can mirror it as fixed damage.
  let lastDirectDamage = 0

  const sortedInstances = [...plan.instances].sort((a, b) => {
    const ak = String((a as any).kind ?? '')
    const bk = String((b as any).kind ?? '')
    const ap = SHOT_INSTANCE_PRIORITY[ak] ?? 999
    const bp = SHOT_INSTANCE_PRIORITY[bk] ?? 999
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
    let usedExtraShot = false
    const extra = card?.abilities.find((a) => a.type === 'EXTRA_SHOT')
    if (extra) {
      const crossedRiver = (side: 'red' | 'black', y: number): boolean => (side === 'red' ? y <= 4 : y >= 5)
      const whenType = String((extra as any)?.when?.type ?? '')
      const crossed = crossedRiver(attacker.side, attacker.pos.y)
      if (!(whenType === 'AFTER_CROSS_RIVER' && !crossed)) {
        const perTurn = Number((extra as any)?.perTurn ?? 0)
        const key = `${plan.attackerId}:EXTRA_SHOT`
        const used = Number(state.turnFlags.abilityUsed?.[key] ?? 0)
        const canExtra = Number.isFinite(perTurn) && perTurn > 0 && used < perTurn
        if (canExtra) {
          const nextUses = plan.abilityUses ? [...plan.abilityUses] : []
          nextUses.push({ key })
          plan.abilityUses = nextUses
          usedExtraShot = true
        }
      }
    }

    if (usedExtraShot) {
      // EXTRA_SHOT already authorizes this additional shot; do not require other extra-shot mechanisms.
      // (MOVE_THEN_SHOOT / BLOOD_SACRIFICE rules remain as fallback when EXTRA_SHOT is not available.)
      // continue
    }

    const ab = usedExtraShot ? undefined : card?.abilities.find((a) => a.type === 'MOVE_THEN_SHOOT')
    const when = (ab as any)?.when
    if (when && String(when.type ?? '') === 'CORPSES_GTE') {
      const need = Number(when.count ?? 0)
      if (Number.isFinite(need) && need > 0) {
        const corpses = countCorpses(state, attacker.side)
        if (corpses < need) return { ok: false, error: '本回合已射擊過' }
      }
    }
    if (when && String(when.type ?? '') === 'SOLDIERS_GTE') {
      const need = Number(when.count ?? 0)
      if (Number.isFinite(need) && need > 0) {
        if (countSoldiers(state, attacker.side) < need) return { ok: false, error: '本回合已射擊過' }
      }
    }
    const perTurn = Number((ab as any)?.perTurn ?? 0)
    const moved = !!state.turnFlags.movedThisTurn?.[plan.attackerId]
    const key = `${plan.attackerId}:MOVE_THEN_SHOOT`
    const used = Number(state.turnFlags.abilityUsed?.[key] ?? 0)
    const canExtra = moved && Number.isFinite(perTurn) && perTurn > 0 && used < perTurn
    // BLOOD_SACRIFICE MOVE_THEN_SHOOT: grants move-then-shoot via blood sacrifice
    const bsMtsKey = `${plan.attackerId}:BLOOD_SACRIFICE_MTS`
    const bsMts = !!(state.turnFlags.bloodSacrificeMoveThenShoot?.[plan.attackerId])
    const bsMtsUsed = Number(state.turnFlags.abilityUsed?.[bsMtsKey] ?? 0)
    const canExtraBS = bsMts && moved && bsMtsUsed < 1
    if (!usedExtraShot && !canExtra && !canExtraBS) return { ok: false, error: '本回合已射擊過' }
    const nextUses = plan.abilityUses ? [...plan.abilityUses] : []
    if (canExtra) nextUses.push({ key })
    else nextUses.push({ key: bsMtsKey })
    plan.abilityUses = nextUses
  }

  const r = state.resources[state.turn.side]
  if (r.mana < plan.cost) return { ok: false, error: '魔力不足' }

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

  // GOLD_FOR_DAMAGE: deduct gold and store bonus for damage computation
  const goldForDamage = (plan as any).__goldForDamage as { cost: number; bonus: number } | undefined
  if (goldForDamage) {
    const side = state.turn.side
    const rg = nextState.resources[side]
    nextState = { ...nextState, resources: { ...nextState.resources, [side]: { ...rg, gold: Math.max(0, rg.gold - goldForDamage.cost) } } }
    events.push({ type: 'ABILITY_TRIGGERED', unitId: plan.attackerId, abilityType: 'GOLD_FOR_DAMAGE', text: `以財傷敵 -${goldForDamage.cost}G +${goldForDamage.bonus}` })
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

  function counterTargetsMatch(damaged: Unit, counterUnit: Unit, targets: any[]): boolean {
    if (!Array.isArray(targets) || targets.length === 0) return false
    for (const t of targets) {
      const type = String((t as any)?.type ?? '')
      if (type === 'SELF') {
        if (counterUnit.id === damaged.id) return true
      }
      if (type === 'ALLY_BASE') {
        const base = String((t as any)?.base ?? '')
        if (base && damaged.side === counterUnit.side && damaged.base === base) return true
      }
    }
    return false
  }

  function applyCounterOnUnitDamaged(s: GameState, events: Event[], attackSourceId: string, damagedUnitId: string): GameState {
    const damaged = s.units[damagedUnitId]
    const src = s.units[attackSourceId]
    if (!damaged || !src) return s

    // Find first eligible counter unit (deterministic by id)
    const counters = Object.values(s.units)
      .filter((u) => u.side === damaged.side)
      .filter((u) => u.enchant?.soulId)
      .sort((a, b) => a.id.localeCompare(b.id))

    for (const u of counters) {
      const soulId = u.enchant?.soulId
      if (!soulId) continue
      const card = getSoulCard(soulId)
      if (!card) continue

      // New generic COUNTER
      const counterAb = card.abilities.find((a) => a.type === 'COUNTER') as any
      // Legacy compat: COUNTER_ON_KING_DAMAGED treated as COUNTER(targets=[ALLY_BASE king])
      const legacyAb = card.abilities.find((a) => a.type === 'COUNTER_ON_KING_DAMAGED') as any

      let ab: any = null
      let perTurn = 0
      let key = ''
      let targets: any[] | null = null

      if (counterAb) {
        ab = counterAb
        perTurn = Number(counterAb.perTurn ?? 0)
        key = `${u.id}:COUNTER`
        targets = Array.isArray(counterAb.targets) ? counterAb.targets : null
        if (!targets || !counterTargetsMatch(damaged, u, targets)) continue
      } else if (legacyAb) {
        ab = legacyAb
        perTurn = Number(legacyAb.perTurn ?? 0)
        key = `${u.id}:COUNTER_ON_KING_DAMAGED`
        if (!(damaged.base === 'king' && damaged.side === u.side)) continue
      } else {
        continue
      }

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

  function healUnitById(s: GameState, events: Event[], unitId: string, amount: number, reason: string): GameState {
    if (!(Number.isFinite(amount) && amount > 0)) return s
    const unit = s.units[unitId]
    if (!unit) return s

    const maxHp = maxHpForUnit(s, unitId)
    const cappedMax = maxHp > 0 ? maxHp : unit.hpCurrent
    const nextHp = Math.min(cappedMax, unit.hpCurrent + Math.floor(amount))
    if (nextHp === unit.hpCurrent) return s
    s.units[unitId] = { ...unit, hpCurrent: nextHp }
    events.push({ type: 'UNIT_HP_CHANGED', unitId, from: unit.hpCurrent, to: nextHp, reason })
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

  function killUnit(s: GameState, unitId: string, events: Event[], killerId?: string): GameState {
    return killUnitShared(s, unitId, events, killerId)
  }

  for (const inst of sortedInstances) {
    const src = nextState.units[inst.sourceUnitId]
    const tgt = nextState.units[inst.targetUnitId]
    if (!src || !tgt) continue

    const fixedDamage = Number((inst as any).fixedDamage ?? 0)
    const isFixed = Number.isFinite(fixedDamage) && fixedDamage > 0
    const splashMirror = !isFixed && inst.kind === 'splash' && Number.isFinite(lastDirectDamage) && lastDirectDamage > 0
    const dmgMult = Number((inst as any).damageMultiplier ?? 0)
    const hasMult = !isFixed && !splashMirror && Number.isFinite(dmgMult) && dmgMult > 0
    // GOLD_FOR_DAMAGE bonus only applies to the direct shot (not splash/chain)
    const extraBonus = (inst.kind === 'direct' && inst.sourceUnitId === plan.attackerId) ? (goldForDamage?.bonus ?? 0) : 0
    const rawResult = (isFixed || splashMirror)
      ? { damage: Math.floor(isFixed ? fixedDamage : lastDirectDamage), breakdown: undefined }
      : computeDamageWithBreakdown(nextState, src.id, tgt.id, dice, extraBonus)
    const rawDamage = hasMult ? Math.max(0, Math.floor(rawResult.damage * dmgMult)) : rawResult.damage
    const firstDamagedReduction = findFirstDamagedReduction(nextState, tgt.id)

    // DAMAGE_SHARE: transfer exactly N damage from target to an eligible allied unit.
    // Only activates if full N can be shared this time, and sharer will not die from sharing.
    // Keep target damage minimum 1.
    let sharedToUnitId: string | null = null
    let sharedAmount = 0
    const sharer = findDamageSharer(nextState, tgt.side)
    if (sharer && sharer.unitId !== tgt.id) {
      const shareUnit = nextState.units[sharer.unitId]
      const want = Math.floor(Number(sharer.amount ?? 0))
      const canFromDamage = Number.isFinite(want) && want > 0 && rawDamage - 1 >= want
      const canFromHp = !!shareUnit && shareUnit.hpCurrent - want >= 1
      if (canFromDamage && canFromHp) {
        sharedToUnitId = sharer.unitId
        sharedAmount = want
      }
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

    if (firstDamagedReduction) {
      const cur = nextState.turnFlags.abilityUsed ?? {}
      nextState.turnFlags = {
        ...nextState.turnFlags,
        abilityUsed: {
          ...cur,
          [firstDamagedReduction.key]: Number(cur[firstDamagedReduction.key] ?? 0) + 1,
        },
      }
      events.push({
        type: 'ABILITY_TRIGGERED',
        unitId: tgt.id,
        abilityType: 'FIRST_DAMAGED_REDUCTION',
        text: '迴避',
      })
    }

    const nextHp = tgt.hpCurrent - finalDamageToTarget
    nextState.units[tgt.id] = { ...tgt, hpCurrent: nextHp }

    if (sharedToUnitId && sharedAmount > 0) {
      const shareUnit = nextState.units[sharedToUnitId]
      if (shareUnit) {
        const shareNextHp = Math.max(1, shareUnit.hpCurrent - sharedAmount)
        nextState.units[sharedToUnitId] = { ...shareUnit, hpCurrent: shareNextHp }
      }
    }

    events.push({ type: 'SHOT_FIRED', attackerId: src.id, targetUnitId: tgt.id })
    events.push({ type: 'DICE_ROLLED', sides: 6, value: dice })
    events.push({ type: 'DAMAGE_DEALT', attackerId: src.id, targetUnitId: tgt.id, amount: finalDamageToTarget, breakdown: rawResult.breakdown })

    if (inst.kind === 'direct' && inst.sourceUnitId === plan.attackerId) {
      lastDirectDamage = finalDamageToTarget
    }

    if (sharedToUnitId && sharedAmount > 0) {
      events.push({ type: 'DAMAGE_DEALT', attackerId: src.id, targetUnitId: sharedToUnitId, amount: sharedAmount })
    }

    if (inst.kind === 'direct' && finalDamageToTarget > 0) {
      nextState = applyCounterOnUnitDamaged(nextState, events, src.id, tgt.id)
    }

    if (nextHp <= 0) {
      if (kingInvincible) continue
      const killedSide = tgt.side
      nextState = killUnit(nextState, tgt.id, events, src.id)

      // Per-turn kill tracking (for data-driven when conditions)
      if (killedSide !== src.side) {
        const cur = Number(nextState.turnFlags.enemyKilledThisTurnCount ?? 0)
        nextState = {
          ...nextState,
          turnFlags: {
            ...nextState.turnFlags,
            enemyKilledThisTurnCount: cur + 1,
          },
        }
      }

      // HEAL_KING_ON_KILL: if src has the ability and it killed an enemy, heal allied king.
      if (killedSide !== src.side) {
        const soulId = src.enchant?.soulId
        const card = soulId ? getSoulCard(soulId) : undefined
        const heal = card?.abilities.find((a) => a.type === 'HEAL_KING_ON_KILL')
        const amount = Number((heal as any)?.amount ?? 0)
        if (Number.isFinite(amount) && amount > 0) {
          nextState = healKingOnKill(nextState, events, src.id, amount)
        }

        const dualHeal = card?.abilities.find((a) => a.type === 'HEAL_SELF_AND_KING_ON_KILL')
        if (dualHeal) {
          const selfAmount = Number((dualHeal as any)?.selfAmount ?? 0)
          const kingAmount = Number((dualHeal as any)?.kingAmount ?? 0)
          if (Number.isFinite(selfAmount) && selfAmount > 0) {
            nextState = healUnitById(nextState, events, src.id, selfAmount, 'HEAL_SELF_AND_KING_ON_KILL')
          }
          if (Number.isFinite(kingAmount) && kingAmount > 0) {
            nextState = healKingOnKill(nextState, events, src.id, kingAmount)
          }
          if ((Number.isFinite(selfAmount) && selfAmount > 0) || (Number.isFinite(kingAmount) && kingAmount > 0)) {
            events.push({ type: 'ABILITY_TRIGGERED', unitId: src.id, abilityType: 'HEAL_SELF_AND_KING_ON_KILL', text: '血回' })
          }
        }

        // KILL_MANA_GAIN: gain mana when this unit kills an enemy
        const manaAb = card?.abilities.find((a) => a.type === 'KILL_MANA_GAIN')
        const manaAmount = Number((manaAb as any)?.amount ?? 0)
        if (Number.isFinite(manaAmount) && manaAmount > 0) {
          const ms = src.side
          const rr0 = nextState.resources[ms]
          const newMana = Math.min(nextState.limits.manaMax, rr0.mana + Math.floor(manaAmount))
          nextState = { ...nextState, resources: { ...nextState.resources, [ms]: { ...rr0, mana: newMana } } }
          events.push({ type: 'ABILITY_TRIGGERED', unitId: src.id, abilityType: 'KILL_MANA_GAIN', text: `回魔 +${Math.floor(manaAmount)}` })
        }

        // KILL_GOLD_GAIN: gain gold when this unit kills an enemy
        const gainAb = card?.abilities.find((a) => a.type === 'KILL_GOLD_GAIN')
        const gainAmount = Number((gainAb as any)?.amount ?? 0)
        if (Number.isFinite(gainAmount) && gainAmount > 0) {
          const gs = src.side
          const rg = nextState.resources[gs]
          const newGold = Math.min(nextState.limits.goldMax, rg.gold + gainAmount)
          nextState = { ...nextState, resources: { ...nextState.resources, [gs]: { ...rg, gold: newGold } } }
          events.push({ type: 'ABILITY_TRIGGERED', unitId: src.id, abilityType: 'KILL_GOLD_GAIN', text: `掠奪 +${gainAmount}G` })
        }

        // BLOOD_TITHE_ON_KILL: kill enchanted enemy → heal allied king ceil(cost/2) HP
        const titheAb = card?.abilities.find((a) => a.type === 'BLOOD_TITHE_ON_KILL')
        if (titheAb) {
          const deadSoulId2 = nextState.graveyard[killedSide]?.[0]
          const deadCard = deadSoulId2 ? getSoulCard(deadSoulId2) : undefined
          if (deadCard) {
            const healAmount = Math.ceil(deadCard.costGold / 2)
            if (healAmount > 0) nextState = healKingOnKill(nextState, events, src.id, healAmount)
          }
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

  // Eternal Night: SACRIFICE_SHOT_BUFF applies to the next shot only.
  if (nextState.status?.sacrificeBuffByUnitId?.[plan.attackerId]) {
    const next = { ...nextState.status.sacrificeBuffByUnitId }
    delete next[plan.attackerId]
    nextState = {
      ...nextState,
      status: {
        ...nextState.status,
        sacrificeBuffByUnitId: next,
      },
    }
  }

  return { ok: true, state: nextState, events }
}

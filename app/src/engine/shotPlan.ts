import type { Event } from './events'
import type { GameState } from './state'
import { canShoot } from './shooting'
import { getDefValue } from './stats'
import { getEffectHandlers, type ShotPlan } from './effects'

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

  if (state.turnFlags.shotUsed[plan.attackerId]) return { ok: false, error: 'Already shot this turn' }

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
  }

  const events: Event[] = []

  const dice = state.rules.diceFixed

  for (const inst of plan.instances) {
    const src = nextState.units[inst.sourceUnitId]
    const tgt = nextState.units[inst.targetUnitId]
    if (!src || !tgt) continue

    const defValue = getDefValue(tgt, src.atk.key)
    const damage = Math.max(1, dice + src.atk.value - defValue)

    const nextHp = tgt.hpCurrent - damage
    nextState.units[tgt.id] = { ...tgt, hpCurrent: nextHp }

    events.push({ type: 'SHOT_FIRED', attackerId: src.id, targetUnitId: tgt.id })
    events.push({ type: 'DICE_ROLLED', sides: 6, value: dice })
    events.push({ type: 'DAMAGE_DEALT', attackerId: src.id, targetUnitId: tgt.id, amount: damage })

    if (nextHp <= 0) {
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

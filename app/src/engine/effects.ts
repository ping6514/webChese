import type { GameState } from './state'
import { getSoulCard } from './cards'
import { getDefValue } from './stats'

export type ShootValidateContext = {
  state: GameState
  attackerId: string
  targetUnitId: string
  shootRules: {
    ignoreBlockingCount: number
    ignoreBlockingAll: boolean
  }
}

export type ShootPlanContext = {
  state: GameState
  attackerId: string
  targetUnitId: string
}

export type ShootValidationResult = { ok: true } | { ok: false; error: string }

export type AttackInstance = {
  kind: 'direct' | 'splash' | 'chain' | 'pierce' | 'counter'
  sourceUnitId: string
  targetUnitId: string
  fixedDamage?: number
}

export type ShotPlan = {
  attackerId: string
  cost: number
  instances: AttackInstance[]
  abilityUses?: Array<{ key: string }>
}

function abilityUseKey(unitId: string, abilityType: string): string {
  return `${unitId}:${abilityType}`
}

export type EffectHandler = {
  onBeforeShootValidate?: (ctx: ShootValidateContext) => ShootValidationResult | void
  onAfterShotPlanBuilt?: (ctx: ShootPlanContext, plan: ShotPlan) => void
}

function palaceContains(side: 'red' | 'black', pos: { x: number; y: number }): boolean {
  if (pos.x < 3 || pos.x > 5) return false
  if (side === 'red') return pos.y >= 7 && pos.y <= 9
  return pos.y >= 0 && pos.y <= 2
}

function crossedRiver(side: 'red' | 'black', y: number): boolean {
  return side === 'red' ? y <= 4 : y >= 5
}

function chebyshev(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

function enemiesWithinRangeGte(state: GameState, sourceUnitId: string, range: number, count: number): boolean {
  const src = state.units[sourceUnitId]
  if (!src) return false
  let n = 0
  for (const u of Object.values(state.units)) {
    if (u.side === src.side) continue
    if (chebyshev(u.pos, src.pos) <= range) n++
  }
  return n >= count
}

function getDamageBonusForAttacker(state: GameState, attackerId: string): number {
  const u = state.units[attackerId]
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

  // AURA_DAMAGE_BONUS: from allied aura units when conditions match.
  for (const auraUnit of Object.values(state.units)) {
    if (auraUnit.side !== u.side) continue
    const auraSoulId = auraUnit.enchant?.soulId
    if (!auraSoulId) continue
    const auraCard = getSoulCard(auraSoulId)
    if (!auraCard) continue

    for (const ab of auraCard.abilities) {
      if (ab.type !== 'AURA_DAMAGE_BONUS') continue
      if (!auraAppliesToAttacker(state, auraUnit.id, attackerId, (ab as any).when, auraCard.clan)) continue

      const forKey = String((ab as any).for ?? '')
      if (forKey === 'CROSS_RIVER_UNITS' && !crossedRiver(u.side, u.pos.y)) continue

      const amount = Number((ab as any).amount ?? 0)
      if (Number.isFinite(amount) && amount > 0) bonus += amount
    }
  }

  return bonus
}

function isResonanceActive(state: GameState, sourceUnitId: string, need: number, clan: string): boolean {
  if (!Number.isFinite(need) || need <= 0) return false
  const source = state.units[sourceUnitId]
  if (!source) return false
  let count = 0
  for (const u of Object.values(state.units)) {
    if (u.side !== source.side) continue
    const soulId = u.enchant?.soulId
    if (!soulId) continue
    const c = getSoulCard(soulId)
    if (!c) continue
    if (c.clan !== clan) continue
    count++
  }
  return count >= need
}

function auraAppliesToAttacker(state: GameState, auraUnitId: string, attackerId: string, when: any, clan: string): boolean {
  const auraUnit = state.units[auraUnitId]
  const attacker = state.units[attackerId]
  if (!auraUnit || !attacker) return false
  if (auraUnit.side !== attacker.side) return false

  const type = String(when?.type ?? '')
  if (!type) return true

  if (type === 'ATTACKER_IN_PALACE') {
    return palaceContains(attacker.side, attacker.pos)
  }

  if (type === 'RESONANCE_ACTIVE') {
    // Find resonance need from aura unit's own card abilities.
    const soulId = auraUnit.enchant?.soulId
    const card = soulId ? getSoulCard(soulId) : undefined
    const res = card?.abilities.find((a) => a.type === 'RESONANCE')
    const need = Number((res as any)?.need ?? 0)
    return isResonanceActive(state, auraUnit.id, need, clan)
  }

  return true
}

export function getEffectHandlers(_state: GameState): EffectHandler[] {
  const handlers: EffectHandler[] = []

  for (const u of Object.values(_state.units)) {
    const soulId = u.enchant?.soulId
    if (!soulId) continue
    const card = getSoulCard(soulId)
    if (!card) continue

    const hasCrossRiver = card.abilities.some((a) => a.type === 'CROSS_RIVER')

    for (const ab of card.abilities) {
      if (ab.type !== 'IGNORE_BLOCKING') continue

      handlers.push({
        onBeforeShootValidate: (ctx) => {
          if (ctx.attackerId !== u.id) return

          if (hasCrossRiver) {
            const crossed = u.side === 'red' ? u.pos.y <= 4 : u.pos.y >= 5
            if (!crossed) return
          }

          const mode = String((ab as any).mode ?? '')
          const when = (ab as any).when
          if (when && when.type === 'ENEMIES_WITHIN_RANGE_GTE') {
            const range = Number(when.range ?? 0)
            const count = Number(when.count ?? 0)
            if (!(Number.isFinite(range) && range > 0 && Number.isFinite(count) && count > 0)) return
            if (!enemiesWithinRangeGte(ctx.state, u.id, range, count)) return
          }
          if (mode === 'all') {
            ctx.shootRules.ignoreBlockingAll = true
            return
          }
          const count = Number((ab as any).count ?? 0)
          if (Number.isFinite(count) && count > 0) {
            ctx.shootRules.ignoreBlockingCount = Math.max(ctx.shootRules.ignoreBlockingCount, count)
          }
        },
      })
    }

    for (const ab of card.abilities) {
      if (ab.type !== 'AURA_IGNORE_BLOCKING') continue

      handlers.push({
        onBeforeShootValidate: (ctx) => {
          // Aura source is u; it can modify allied attacker shots.
          if (!auraAppliesToAttacker(ctx.state, u.id, ctx.attackerId, (ab as any).when, card.clan)) return

          const perTurn = Number((ab as any).perTurn ?? 0)
          if (Number.isFinite(perTurn) && perTurn > 0) {
            const key = abilityUseKey(u.id, 'AURA_IGNORE_BLOCKING')
            const used = Number(ctx.state.turnFlags.abilityUsed?.[key] ?? 0)
            if (used >= perTurn) return
          }

          const forKey = String((ab as any).for ?? '')
          if (forKey === 'CROSS_RIVER_UNITS') {
            const attacker = ctx.state.units[ctx.attackerId]
            if (!attacker) return
            if (!crossedRiver(attacker.side, attacker.pos.y)) return
          }

          const mode = String((ab as any).mode ?? '')
          if (mode === 'all') {
            ctx.shootRules.ignoreBlockingAll = true
            return
          }

          const count = Number((ab as any).count ?? 0)
          if (Number.isFinite(count) && count > 0) {
            ctx.shootRules.ignoreBlockingCount = Math.max(ctx.shootRules.ignoreBlockingCount, count)
          }
        },
        onAfterShotPlanBuilt: (ctx, plan) => {
          if (!auraAppliesToAttacker(ctx.state, u.id, ctx.attackerId, (ab as any).when, card.clan)) return

          const perTurn = Number((ab as any).perTurn ?? 0)
          if (!(Number.isFinite(perTurn) && perTurn > 0)) return

          const key = abilityUseKey(u.id, 'AURA_IGNORE_BLOCKING')
          const used = Number(ctx.state.turnFlags.abilityUsed?.[key] ?? 0)
          if (used >= perTurn) return

          const forKey = String((ab as any).for ?? '')
          if (forKey === 'CROSS_RIVER_UNITS') {
            const attacker = ctx.state.units[ctx.attackerId]
            if (!attacker) return
            if (!crossedRiver(attacker.side, attacker.pos.y)) return
          }

          const next = plan.abilityUses ? [...plan.abilityUses] : []
          next.push({ key })
          plan.abilityUses = next
        },
      })
    }

    for (const ab of card.abilities) {
      if (ab.type !== 'SPLASH') continue

      handlers.push({
        onAfterShotPlanBuilt: (ctx, plan) => {
          if (ctx.attackerId !== u.id) return

          if (hasCrossRiver && !crossedRiver(u.side, u.pos.y)) return

          const target = ctx.state.units[ctx.targetUnitId]
          const attacker = ctx.state.units[ctx.attackerId]
          if (!target || !attacker) return

          const radius = Number((ab as any).radius ?? 0)
          if (!Number.isFinite(radius) || radius <= 0) return

          const perTurn = Number((ab as any).perTurn ?? 0)
          if (Number.isFinite(perTurn) && perTurn > 0) {
            const key = abilityUseKey(u.id, 'SPLASH')
            const used = Number(ctx.state.turnFlags.abilityUsed?.[key] ?? 0)
            if (used >= perTurn) return
            const next = plan.abilityUses ? [...plan.abilityUses] : []
            next.push({ key })
            plan.abilityUses = next
          }

          const bonus = getDamageBonusForAttacker(ctx.state, attacker.id)
          const defValue = getDefValue(target, attacker.atk.key)
          const rawDamage = Math.max(1, ctx.state.rules.diceFixed + attacker.atk.value + bonus - defValue)

          const extraTargets = Object.values(ctx.state.units)
            .filter((t) => t.side !== attacker.side)
            .filter((t) => t.id !== target.id)
            .filter((t) => chebyshev(t.pos, target.pos) <= radius)
            .sort((a, b) => a.id.localeCompare(b.id))

          for (const t of extraTargets) {
            plan.instances.push({ kind: 'splash', sourceUnitId: attacker.id, targetUnitId: t.id, fixedDamage: rawDamage })
          }
        },
      })
    }
  }

  return handlers
}

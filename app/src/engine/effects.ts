import type { GameState } from './state'
import { getSoulCard } from './cards'

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
  extraTargetUnitId?: string | null
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

function countBetweenOrthogonal(state: GameState, a: { x: number; y: number }, b: { x: number; y: number }): number | null {
  if (a.x !== b.x && a.y !== b.y) return null
  let count = 0
  if (a.x === b.x) {
    const x = a.x
    const y1 = Math.min(a.y, b.y)
    const y2 = Math.max(a.y, b.y)
    for (let y = y1 + 1; y <= y2 - 1; y++) {
      if (Object.values(state.units).some((u) => u.pos.x === x && u.pos.y === y)) count++
    }
  } else {
    const y = a.y
    const x1 = Math.min(a.x, b.x)
    const x2 = Math.max(a.x, b.x)
    for (let x = x1 + 1; x <= x2 - 1; x++) {
      if (Object.values(state.units).some((u) => u.pos.x === x && u.pos.y === y)) count++
    }
  }
  return count
}

function firstUnitBetweenOrthogonal(state: GameState, a: { x: number; y: number }, b: { x: number; y: number }): string | null {
  if (a.x !== b.x && a.y !== b.y) return null
  if (a.x === b.x) {
    const x = a.x
    const y1 = Math.min(a.y, b.y)
    const y2 = Math.max(a.y, b.y)
    for (let y = y1 + 1; y <= y2 - 1; y++) {
      const found = Object.values(state.units).find((u) => u.pos.x === x && u.pos.y === y)
      if (found) return found.id
    }
    return null
  }
  const y = a.y
  const x1 = Math.min(a.x, b.x)
  const x2 = Math.max(a.x, b.x)
  for (let x = x1 + 1; x <= x2 - 1; x++) {
    const found = Object.values(state.units).find((u) => u.pos.x === x && u.pos.y === y)
    if (found) return found.id
  }
  return null
}

function abilityUsedCount(state: GameState, unitId: string, abilityType: string): number {
  const key = abilityUseKey(unitId, abilityType)
  return Number(state.turnFlags.abilityUsed?.[key] ?? 0)
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

          const splashTargets = Object.values(ctx.state.units)
            .filter((uu) => uu.side !== attacker.side)
            .filter((uu) => uu.id !== target.id)
            .filter((uu) => chebyshev(uu.pos, target.pos) <= radius)
            .sort((a, b) => a.id.localeCompare(b.id))

          for (const t of splashTargets) {
            plan.instances.push({ kind: 'splash', sourceUnitId: attacker.id, targetUnitId: t.id })
          }
        },
      })
    }

    for (const ab of card.abilities) {
      if (ab.type !== 'CHAIN') continue

      handlers.push({
        onAfterShotPlanBuilt: (ctx, plan) => {
          if (ctx.attackerId !== u.id) return

          const perTurn = Number((ab as any).perTurn ?? 0)
          if (Number.isFinite(perTurn) && perTurn > 0) {
            const used = abilityUsedCount(ctx.state, u.id, 'CHAIN')
            if (used >= perTurn) return
          }

          const extraId = ctx.extraTargetUnitId
          if (!extraId) return
          if (extraId === ctx.targetUnitId) return

          const mainTarget = ctx.state.units[ctx.targetUnitId]
          const extraTarget = ctx.state.units[extraId]
          const attacker = ctx.state.units[ctx.attackerId]
          if (!mainTarget || !extraTarget || !attacker) return
          if (extraTarget.side === attacker.side) return

          const radius = Number((ab as any).radius ?? 0)
          if (!(Number.isFinite(radius) && radius > 0)) return
          if (chebyshev(extraTarget.pos, mainTarget.pos) > radius) return

          // Track per-turn usage.
          if (Number.isFinite(perTurn) && perTurn > 0) {
            const next = plan.abilityUses ? [...plan.abilityUses] : []
            next.push({ key: abilityUseKey(u.id, 'CHAIN') })
            plan.abilityUses = next
          }

          plan.instances.push({ kind: 'chain', sourceUnitId: attacker.id, targetUnitId: extraTarget.id })
        },
      })
    }

    for (const ab of card.abilities) {
      if (ab.type !== 'PIERCE') continue

      handlers.push({
        onAfterShotPlanBuilt: (ctx, plan) => {
          if (ctx.attackerId !== u.id) return

          const attacker = ctx.state.units[ctx.attackerId]
          const target = ctx.state.units[ctx.targetUnitId]
          if (!attacker || !target) return

          const mode = String((ab as any).mode ?? '')
          if (mode === 'CANNON_SCREEN_AND_TARGET') {
            if (attacker.base !== 'cannon') return
            const between = countBetweenOrthogonal(ctx.state, attacker.pos, target.pos)
            if (between !== 1) return
            const screenId = firstUnitBetweenOrthogonal(ctx.state, attacker.pos, target.pos)
            if (!screenId) return
            const screen = ctx.state.units[screenId]
            if (!screen) return
            if (screen.side === attacker.side) return

            plan.instances.push({ kind: 'pierce', sourceUnitId: attacker.id, targetUnitId: screen.id })
            return
          }

          if (mode === 'LINE_ENEMIES') {
            const count = Number((ab as any).count ?? 0)
            if (!(Number.isFinite(count) && count > 1)) return

            const dx = Math.sign(target.pos.x - attacker.pos.x)
            const dy = Math.sign(target.pos.y - attacker.pos.y)
            if (!((dx === 0 && dy !== 0) || (dy === 0 && dx !== 0))) return

            const enemies: string[] = []
            for (let step = 1; step < 20; step++) {
              const pos = { x: attacker.pos.x + dx * step, y: attacker.pos.y + dy * step }
              if (pos.x < 0 || pos.x > 8 || pos.y < 0 || pos.y > 9) break
              const hit = Object.values(ctx.state.units).find((uu) => uu.pos.x === pos.x && uu.pos.y === pos.y)
              if (!hit) continue
              if (hit.side === attacker.side) continue
              enemies.push(hit.id)
              if (enemies.length >= count) break
            }

            if (!enemies.includes(target.id)) return
            for (const id of enemies) {
              if (id === target.id) continue
              plan.instances.push({ kind: 'pierce', sourceUnitId: attacker.id, targetUnitId: id })
            }
          }
        },
      })
    }
  }

  return handlers
}

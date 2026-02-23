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
}

export type ShootValidationResult = { ok: true } | { ok: false; error: string }

export type AttackInstance = {
  kind: 'direct' | 'splash' | 'chain' | 'pierce' | 'counter'
  sourceUnitId: string
  targetUnitId: string
}

export type ShotPlan = {
  attackerId: string
  cost: number
  instances: AttackInstance[]
}

export type EffectHandler = {
  onBeforeShootValidate?: (ctx: ShootValidateContext) => ShootValidationResult | void
  onAfterShotPlanBuilt?: (ctx: ShootPlanContext, plan: ShotPlan) => void
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
  }

  return handlers
}

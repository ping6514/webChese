import { describe, it } from 'vitest'
import type { Side } from '../engine'
import { listSoulCards } from '../engine'
import { decideActions, type BotContext } from './balanceBot'
import { runMatch } from './balanceRunner'

type CardStats = {
  picked: number
  winsWhenPicked: number
  goldSpentWhenPicked: number
}

describe('sim: balance report', () => {
  it('runs a small self-play batch and prints a report', () => {
    const env = ((globalThis as any).process?.env ?? {}) as Record<string, string | undefined>
    const N = Number(env.SIM_MATCHES ?? 50)
    const MAX_STEPS = Number(env.SIM_MAX_STEPS ?? 400)

    const bySoulId: Record<string, CardStats> = {}
    for (const c of listSoulCards()) bySoulId[c.id] = { picked: 0, winsWhenPicked: 0, goldSpentWhenPicked: 0 }

    for (let i = 0; i < N; i++) {
      const pickedBySide: Record<Side, string[]> = { red: [], black: [] }
      const soulSpendBySoulId: Record<string, number> = {}

      const ctxBySide: Record<Side, BotContext> = {
        red: { seed: 1000 + i * 2 },
        black: { seed: 1001 + i * 2 },
      }

      const stepper = (state: any, side: Side) => {
        const res = decideActions(state, side, ctxBySide[side])
        pickedBySide[side].push(...res.boughtSoulIds)
        if (res.boughtSoulIds.length > 0 && res.soulGoldSpent > 0) {
          const perSoul = res.soulGoldSpent / res.boughtSoulIds.length
          for (const soulId of res.boughtSoulIds) soulSpendBySoulId[soulId] = (soulSpendBySoulId[soulId] ?? 0) + perSoul
        }
        ctxBySide[side].seed += 1
        return res.actions
      }

      const out = runMatch(stepper, {
        seed: 5000 + i,
        maxSteps: MAX_STEPS,
      })

      const winner = out.winner
      for (const side of ['red', 'black'] as const) {
        const picked = pickedBySide[side]
        for (const soulId of picked) {
          const st = bySoulId[soulId]
          if (!st) continue
          st.picked += 1
          st.goldSpentWhenPicked += soulSpendBySoulId[soulId] ?? 0
          if (winner === side) st.winsWhenPicked += 1
        }
      }
    }

    const rows = Object.entries(bySoulId)
      .filter(([, s]) => s.picked > 0)
      .map(([soulId, s]) => {
        const winRate = s.winsWhenPicked / s.picked
        const avgSpend = s.goldSpentWhenPicked / s.picked
        const efficiency = avgSpend > 0 ? winRate / avgSpend : winRate
        return { soulId, picked: s.picked, winRate: Number(winRate.toFixed(3)), avgSpend: Number(avgSpend.toFixed(2)), efficiency: Number(efficiency.toFixed(4)) }
      })
      .sort((a, b) => (b.winRate - a.winRate) || (b.picked - a.picked) || a.soulId.localeCompare(b.soulId))

    // eslint-disable-next-line no-console
    console.log('\n=== Balance Sim Report ===')
    // eslint-disable-next-line no-console
    console.log(`matches=${N} maxSteps=${MAX_STEPS}`)
    // eslint-disable-next-line no-console
    console.table(rows.slice(0, 30))
  })
})

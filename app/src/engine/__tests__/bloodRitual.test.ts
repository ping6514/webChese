import { describe, expect, it } from 'vitest'
import { createInitialState, reduce } from '../index'

function setPhase(s: ReturnType<typeof createInitialState>, phase: any) {
  return { ...s, turn: { ...s.turn, phase } }
}

describe('blood ritual', () => {
  it('BLOOD_RITUAL deducts 3 HP from king, grants +1 necro bonus action, once per turn', () => {
    const s0 = setPhase(createInitialState(), 'necro')
    const side = s0.turn.side

    const king0 = Object.values(s0.units).find((u) => u.side === side && u.base === 'king')
    expect(king0).toBeTruthy()
    if (!king0) return

    const res1 = reduce(s0, { type: 'BLOOD_RITUAL' })
    expect(res1.ok).toBe(true)
    if (!res1.ok) return

    const s1 = res1.state
    const king1 = s1.units[king0.id]
    expect(king1).toBeTruthy()
    if (!king1) return
    expect(king1.hpCurrent).toBe(king0.hpCurrent - 3)
    expect(s1.turnFlags.bloodRitualUsed).toBe(true)
    expect(s1.turnFlags.necroBonusActions).toBe(1)

    const res2 = reduce(s1, { type: 'BLOOD_RITUAL' })
    expect(res2.ok).toBe(false)
  })

  it('BLOOD_RITUAL fails when king hp <= 3', () => {
    const s0 = setPhase(createInitialState(), 'necro')
    const side = s0.turn.side
    const king0 = Object.values(s0.units).find((u) => u.side === side && u.base === 'king')
    if (!king0) throw new Error('Expected king')

    const sLow = {
      ...s0,
      units: {
        ...s0.units,
        [king0.id]: {
          ...king0,
          hpCurrent: 3,
        },
      },
    }

    const res = reduce(sLow, { type: 'BLOOD_RITUAL' })
    expect(res.ok).toBe(false)
  })
})

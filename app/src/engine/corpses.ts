import type { GameState } from './state'

export function countCorpses(state: GameState, side: 'red' | 'black'): number {
  let n = 0
  for (const stack of Object.values(state.corpsesByPos)) {
    for (const c of stack) {
      if (c.ownerSide === side) n++
    }
  }
  return n
}

export function chebyshev(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

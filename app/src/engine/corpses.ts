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

export function countSoldiers(state: GameState, side: 'red' | 'black'): number {
  let n = 0
  for (const u of Object.values(state.units)) {
    if (u.side === side && u.base === 'soldier') n++
  }
  return n
}

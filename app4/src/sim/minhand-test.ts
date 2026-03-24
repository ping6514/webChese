// 測試 s2MinHand / s1MinHand 對勝率的影響
// 用法：npx tsx src/sim/tsconfig.json src/sim/minhand-test.ts

import { createInitialState } from '../engine/state'
import { reduce } from '../engine/reduce'
import { canDispatch } from '../engine/guards'
import type { GameState } from '../engine/state'
import type { Action } from '../engine/types'
import type { PlayerId } from '../engine/types'
import { botDecide, continueActingBG } from './bot'
import { DYNAMIC_WEIGHTS } from './botWeights'
import type { BotWeights } from './botWeights'

function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 0x100000000
  }
}

const MAX_TURNS = 120
const MAX_ACTIONS_PER_TURN = 30

function runGame(seed: number, p1W: BotWeights, p2W: BotWeights): 'p1' | 'p2' | null {
  const rng = lcg(seed)
  let state: GameState = createInitialState({ rngSeed: seed })
  let actionsThisTurn = 0

  while (!state.winner && state.turn <= MAX_TURNS) {
    const player = state.currentPlayer
    actionsThisTurn++

    if (actionsThisTurn > MAX_ACTIONS_PER_TURN) {
      if (state.actingBGId) {
        const ok = canDispatch(state, player, { type: 'END_BG_ACTION' })
        if (ok.ok) { state = reduce(state, player, { type: 'END_BG_ACTION' }).state; actionsThisTurn = 0; continue }
      }
      const ok = canDispatch(state, player, { type: 'NEXT_PHASE' })
      if (ok.ok) { state = reduce(state, player, { type: 'NEXT_PHASE' }).state; actionsThisTurn = 0 }
      else break
      continue
    }

    const w = player === 'p1' ? p1W : p2W
    const prevTurn = state.turn
    let action: Action

    if (state.phase === 'action' && state.actingBGId) {
      action = continueActingBG(state, player, w, 0.0, rng).action
    } else {
      action = botDecide(state, player, w)
    }

    const guard = canDispatch(state, player, action)
    if (!guard.ok) {
      const fallback: Action = { type: 'NEXT_PHASE' }
      if (!canDispatch(state, player, fallback).ok) break
      state = reduce(state, player, fallback).state
      actionsThisTurn = 0
      continue
    }
    state = reduce(state, player, action).state
    if (state.turn !== prevTurn) actionsThisTurn = 0
  }

  return state.winner
}

function runBatch(n: number, p1W: BotWeights, p2W: BotWeights, label: string) {
  let p1 = 0, p2 = 0, draws = 0
  for (let i = 0; i < n; i++) {
    const w = runGame(i * 7919 + 42, p1W, p2W)
    if (w === 'p1') p1++
    else if (w === 'p2') p2++
    else draws++
  }
  const total = p1 + p2 + draws
  console.log(`${label}`)
  console.log(`  P1 ${(p1/total*100).toFixed(1)}%  P2 ${(p2/total*100).toFixed(1)}%  平 ${draws}  (${n}局)`)
}

const N = 2000
const base = DYNAMIC_WEIGHTS

// 測試不同門檻值（P1 用測試值 vs P2 用 minHand=0）
const opponent = { ...base, s2MinHand: 0, s1MinHand: 0 }

console.log('=== s2MinHand / s1MinHand 效果測試 ===\n')
console.log('P1 = 測試門檻，P2 = minHand=0（基準）\n')

for (const v of [0, 1, 2, 3]) {
  const tester = { ...base, s2MinHand: v, s1MinHand: v }
  runBatch(N, tester, opponent, `minHand = ${v}`)
}

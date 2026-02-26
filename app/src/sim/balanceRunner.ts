import type { GameState, Side } from '../engine'
import type { GameConfig } from '../engine/gameConfig'
import { DEFAULT_CONFIG } from '../engine/gameConfig'
import { createInitialState, reduce } from '../engine'
import type { Action } from '../engine'

export type MatchOutcome = {
  winner: Side | 'unknown' | null
  finalState: GameState
  steps: number
}

export type RunMatchOpts = {
  seed: number
  config?: Partial<GameConfig>
  maxSteps: number
  onStep?: (state: GameState, action: Action, step: number) => void
}

function computeWinner(state: GameState): Side | 'unknown' | null {
  const hasRedKing = Object.values(state.units).some((u) => u.side === 'red' && u.base === 'king')
  const hasBlackKing = Object.values(state.units).some((u) => u.side === 'black' && u.base === 'king')
  if (!hasRedKing && hasBlackKing) return 'black'
  if (!hasBlackKing && hasRedKing) return 'red'
  if (!hasRedKing && !hasBlackKing) return 'unknown'
  return null
}

function heuristicScore(state: GameState, side: Side): number {
  const units = Object.values(state.units).filter((u) => u.side === side)
  const king = units.find((u) => u.base === 'king')
  const kingHp = king?.hpCurrent ?? 0
  const hpSum = units.reduce((acc, u) => acc + (u.hpCurrent ?? 0), 0)
  const material = units.reduce((acc, u) => {
    // rough value by base
    const v =
      u.base === 'king'
        ? 0
        : u.base === 'rook'
          ? 5
          : u.base === 'cannon'
            ? 5
            : u.base === 'knight'
              ? 4
              : u.base === 'elephant'
                ? 3
                : u.base === 'advisor'
                  ? 3
                  : 2
    return acc + v
  }, 0)

  const r = state.resources[side]
  const gold = r?.gold ?? 0
  const mana = r?.mana ?? 0
  const storage = r?.storageMana ?? 0

  // weights are arbitrary but stable; goal is to avoid tons of undecided matches.
  return kingHp * 100 + hpSum * 2 + material * 10 + gold * 1 + mana * 0.5 + storage * 0.5
}

function decideWinnerHeuristic(state: GameState): Side | 'unknown' {
  const sr = heuristicScore(state, 'red')
  const sb = heuristicScore(state, 'black')
  if (sr === sb) return 'unknown'
  return sr > sb ? 'red' : 'black'
}

export function runMatch(stepper: (s: GameState, side: Side) => Action[], opts: RunMatchOpts): MatchOutcome {
  const merged: Partial<GameConfig> = {
    limits: {
      ...DEFAULT_CONFIG.limits,
      ...(opts.config?.limits ?? {}),
    },
    phaseActionLimits: {
      ...DEFAULT_CONFIG.phaseActionLimits,
      ...(opts.config?.phaseActionLimits ?? {}),
    },
    rules: {
      ...DEFAULT_CONFIG.rules,
      ...(opts.config?.rules ?? {}),
      rngMode: 'seeded',
      matchSeed: String(opts.seed),
    },
  }

  let state = createInitialState(merged)

  for (let step = 0; step < opts.maxSteps; step++) {
    const w = computeWinner(state)
    if (w) return { winner: w, finalState: state, steps: step }

    const side = state.turn.side
    const actions = stepper(state, side)
    if (actions.length === 0) {
      const r = reduce(state, { type: 'NEXT_PHASE' })
      if (!r.ok) return { winner: computeWinner(state), finalState: state, steps: step }
      state = r.state
      continue
    }

    for (const action of actions) {
      const r = reduce(state, action)
      if (opts.onStep) opts.onStep(state, action, step)
      if (!r.ok) {
        // If bot emits an invalid action, just advance phase to avoid deadlock.
        const rr = reduce(state, { type: 'NEXT_PHASE' })
        if (!rr.ok) return { winner: computeWinner(state), finalState: state, steps: step }
        state = rr.state
      } else {
        state = r.state
      }

      const ww = computeWinner(state)
      if (ww) return { winner: ww, finalState: state, steps: step }
    }
  }

  return { winner: computeWinner(state) ?? decideWinnerHeuristic(state), finalState: state, steps: opts.maxSteps }
}

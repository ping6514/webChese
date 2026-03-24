// BG Card Game — 模擬引擎

import { createInitialState } from '../engine/state'
import type { GameConfig } from '../engine/state'
import { reduce } from '../engine/reduce'
import { canDispatch } from '../engine/guards'
import type { GameState } from '../engine/state'
import type { Action } from '../engine/actions'
import type { PlayerId } from '../engine/types'
import { botDecide } from './bot'

export type GameResult = {
  winner: PlayerId | null
  turns: number
  p1WallsLeft: number
  p2WallsLeft: number
  p1BGsKOd: number
  p2BGsKOd: number
  p1SkillsUsed: number
  p2SkillsUsed: number
  drawReason: string | null
}

export type SimStats = {
  games: number
  p1Wins: number
  p2Wins: number
  draws: number
  avgTurns: number
  avgP1Walls: number
  avgP2Walls: number
  avgP1KOs: number
  avgP2KOs: number
  p1WinRate: number
  p2WinRate: number
}

const MAX_TURNS = 120
const MAX_ACTIONS_PER_TURN = 30  // 防止無限迴圈

/** 執行一場遊戲，回傳結果 */
export function runGame(seed?: number, config?: Omit<GameConfig, 'rngSeed'>): GameResult {
  let state = createInitialState({ rngSeed: seed ?? Math.floor(Math.random() * 1000000), ...config })

  let p1BGsKOd = 0
  let p2BGsKOd = 0
  let p1SkillsUsed = 0
  let p2SkillsUsed = 0
  let actionsThisTurn = 0

  while (!state.winner && state.turn <= MAX_TURNS) {
    const player = state.currentPlayer
    actionsThisTurn++

    if (actionsThisTurn > MAX_ACTIONS_PER_TURN) {
      // 若有 BG 正在行動，先強制結束
      if (state.actingBGId) {
        const endOk = canDispatch(state, player, { type: 'END_BG_ACTION' })
        if (endOk.ok) {
          const result = reduce(state, player, { type: 'END_BG_ACTION' })
          state = result.state
          actionsThisTurn = 0
          continue
        }
      }
      // 強制進入下一階段防止卡死
      const ok = canDispatch(state, player, { type: 'NEXT_PHASE' })
      if (ok.ok) {
        const result = reduce(state, player, { type: 'NEXT_PHASE' })
        state = result.state
      } else {
        break
      }
      actionsThisTurn = 0
      continue
    }

    const prevTurn = state.turn
    const action = botDecide(state, player)

    // 驗證行動
    const guard = canDispatch(state, player, action)
    if (!guard.ok) {
      // Bot 給出非法行動，強制 NEXT_PHASE
      const fallback: Action = { type: 'NEXT_PHASE' }
      const fallbackOk = canDispatch(state, player, fallback)
      if (!fallbackOk.ok) break
      const result = reduce(state, player, fallback)
      state = result.state
      actionsThisTurn = 0
      continue
    }

    const result = reduce(state, player, action)
    state = result.state

    // 統計事件
    for (const evt of result.events) {
      if (evt.type === 'bg_ko') {
        const bgOwner = state.bgs[evt.bgId]?.owner ?? (evt.bgId.startsWith('p1') ? 'p1' : 'p2')
        if (bgOwner === 'p1') p1BGsKOd++
        else p2BGsKOd++
      }
      if (evt.type === 'use_skill') {
        const bgOwner = evt.bgId.startsWith('p1') ? 'p1' : 'p2'
        if (bgOwner === 'p1') p1SkillsUsed++
        else p2SkillsUsed++
      }
    }

    // 若回合改變，重置行動計數
    if (state.turn !== prevTurn) actionsThisTurn = 0
  }

  const isTimeout = state.turn > MAX_TURNS

  return {
    winner: state.winner,
    turns: state.turn,
    p1WallsLeft: state.cityWalls.p1,
    p2WallsLeft: state.cityWalls.p2,
    p1BGsKOd,
    p2BGsKOd,
    p1SkillsUsed,
    p2SkillsUsed,
    drawReason: isTimeout ? `超過 ${MAX_TURNS} 回合` : (!state.winner ? '引擎卡死' : null),
  }
}

/** 執行 N 場遊戲，彙整統計 */
export function runSimulation(n: number, verbose = false): SimStats {
  let p1Wins = 0, p2Wins = 0, draws = 0
  let totalTurns = 0
  let totalP1Walls = 0, totalP2Walls = 0
  let totalP1KOs = 0, totalP2KOs = 0

  for (let i = 0; i < n; i++) {
    const res = runGame(i * 7919 + 42)

    if (res.winner === 'p1') p1Wins++
    else if (res.winner === 'p2') p2Wins++
    else draws++

    totalTurns += res.turns
    totalP1Walls += res.p1WallsLeft
    totalP2Walls += res.p2WallsLeft
    totalP1KOs += res.p1BGsKOd
    totalP2KOs += res.p2BGsKOd

    if (verbose && (i + 1) % Math.max(1, Math.floor(n / 10)) === 0) {
      process.stdout.write(`  進度: ${i + 1}/${n} (P1勝:${p1Wins} P2勝:${p2Wins} 平:${draws})\n`)
    }
  }

  return {
    games: n,
    p1Wins,
    p2Wins,
    draws,
    avgTurns: totalTurns / n,
    avgP1Walls: totalP1Walls / n,
    avgP2Walls: totalP2Walls / n,
    avgP1KOs: totalP1KOs / n,
    avgP2KOs: totalP2KOs / n,
    p1WinRate: p1Wins / n,
    p2WinRate: p2Wins / n,
  }
}

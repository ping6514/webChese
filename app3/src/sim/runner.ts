// Beast Conquest — 模擬對戰跑步機

import { createInitialState } from '../engine/state'
import type { GameConfig } from '../engine/state'
import { reduce } from '../engine/reduce'
import type { PlayerId } from '../engine/types'
import type { GameEvent } from '../engine/events'
import { decideAction } from './bot'
import type { BotCtx } from './bot'
import type { BotWeights } from './botWeights'

export type MatchResult = {
  winner: PlayerId
  reason: string
  turns: number
  lairHPRemaining: { p1: number; p2: number }
  koCount: { p1: number; p2: number }
  legionSummons: { p1: number; p2: number }   // 軍團召喚次數
  tacticalTriggers: { p1: number; p2: number } // 戰術卡觸發次數
  skillUses: { p1: number; p2: number }
  events: GameEvent[]
}

export type BatchResult = {
  total: number
  p1Wins: number
  p2Wins: number
  avgTurns: number
  winRate: { p1: number; p2: number }
  avgLairHP: { p1: number; p2: number }
  avgKO: { p1: number; p2: number }
  avgSummons: { p1: number; p2: number }
  avgTactical: { p1: number; p2: number }
  avgSkill: { p1: number; p2: number }
}

const MAX_STEPS = 2000  // 防止無限迴圈

// ── 單場模擬 ─────────────────────────────────────────

export function runMatch(
  config?: GameConfig,
  seed?: number,
  weights?: BotWeights
): MatchResult {
  let state = createInitialState(config)
  const allEvents: GameEvent[] = []
  let steps = 0
  const koCount = { p1: 0, p2: 0 }
  const legionSummons = { p1: 0, p2: 0 }
  const tacticalTriggers = { p1: 0, p2: 0 }
  const skillUses = { p1: 0, p2: 0 }

  // 初始狀態已在 main 階段，不需要額外 NEXT_PHASE

  while (!state.winner && steps < MAX_STEPS) {
    steps++

    const player = state.currentPlayer
    const ctx: BotCtx = {
      seed: (seed ?? 42) + steps,
      epsilon: 0.15,
      weights,
    }

    const action = decideAction(state, player, ctx)

    const result = reduce(state, action)
    if (!result.ok) {
      // 無效動作：強制 NEXT_PHASE 避免卡死
      const fallback = reduce(state, { type: 'NEXT_PHASE' })
      if (!fallback.ok) break
      state = fallback.state
      allEvents.push(...fallback.events)
    } else {
      // 統計事件
      for (const e of result.events) {
        if (e.type === 'LEADER_KO') {
          const koOwner = state.leaders[e.leaderId]?.owner
          if (koOwner) koCount[koOwner]++
        }
        if (e.type === 'LEGION_SUMMONED') {
          const summonOwner = state.leaders[e.leaderId]?.owner
          if (summonOwner) legionSummons[summonOwner]++
        }
        if (e.type === 'TACTICAL_TRIGGERED') {
          const triggerOwner = state.leaders[e.leaderId]?.owner
          if (triggerOwner) tacticalTriggers[triggerOwner]++
        }
        if (e.type === 'SKILL_USED') {
          const skillOwner = state.leaders[e.leaderId]?.owner
          if (skillOwner) skillUses[skillOwner]++
        }
      }
      state = result.state
      allEvents.push(...result.events)
    }
  }

  return {
    winner: state.winner ?? 'p1',
    reason: state.winReason ?? 'timeout',
    turns: state.turn,
    lairHPRemaining: {
      p1: state.zones.p1_base.cityWalls ?? 0,
      p2: state.zones.p2_base.cityWalls ?? 0,
    },
    koCount,
    legionSummons,
    tacticalTriggers,
    skillUses,
    events: allEvents,
  }
}

// ── 批次模擬 ─────────────────────────────────────────

export function runBatch(
  n: number,
  config?: GameConfig,
  weights?: BotWeights
): BatchResult {
  let p1Wins = 0, p2Wins = 0
  let totalTurns = 0
  let totalLairP1 = 0, totalLairP2 = 0
  let totalKOP1 = 0, totalKOP2 = 0
  let totalSumP1 = 0, totalSumP2 = 0
  let totalTacP1 = 0, totalTacP2 = 0
  let totalSkillP1 = 0, totalSkillP2 = 0

  for (let i = 0; i < n; i++) {
    const result = runMatch(config, i * 137 + 1, weights)
    if (result.winner === 'p1') p1Wins++
    else p2Wins++
    totalTurns += result.turns
    totalLairP1 += result.lairHPRemaining.p1
    totalLairP2 += result.lairHPRemaining.p2
    totalKOP1 += result.koCount.p1
    totalKOP2 += result.koCount.p2
    totalSumP1 += result.legionSummons.p1
    totalSumP2 += result.legionSummons.p2
    totalTacP1 += result.tacticalTriggers.p1
    totalTacP2 += result.tacticalTriggers.p2
    totalSkillP1 += result.skillUses.p1
    totalSkillP2 += result.skillUses.p2
  }

  return {
    total: n,
    p1Wins,
    p2Wins,
    avgTurns: totalTurns / n,
    winRate: { p1: p1Wins / n, p2: p2Wins / n },
    avgLairHP: { p1: totalLairP1 / n, p2: totalLairP2 / n },
    avgKO: { p1: totalKOP1 / n, p2: totalKOP2 / n },
    avgSummons: { p1: totalSumP1 / n, p2: totalSumP2 / n },
    avgTactical: { p1: totalTacP1 / n, p2: totalTacP2 / n },
    avgSkill: { p1: totalSkillP1 / n, p2: totalSkillP2 / n },
  }
}

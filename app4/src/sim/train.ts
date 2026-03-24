// BG Card Game — Bot 訓練腳本（epsilon-greedy + Wilson CI）
//
// 訓練流程：
//   Phase 1: 2500 局，epsilon=1.0（純隨機探索）
//   Phase 2: 2500 局，epsilon=0.5（半隨機）
//   Phase 3: 2500 局，epsilon=0.25（偏貪心）
//   Phase 4: 2500 局，epsilon=0.1（接近收斂）
//
// 每 Phase 結束後：用 Wilson CI 下界估計各類別 & 個別技能的勝率貢獻，
// 更新 DYNAMIC_WEIGHTS（宏觀權重 + skillWeights），然後繼續下一 Phase。
// 最終結果寫回 botWeights.ts。

import { createInitialState } from '../engine/state'
import { reduce } from '../engine/reduce'
import { canDispatch } from '../engine/guards'
import type { GameState } from '../engine/state'
import type { Action } from '../engine/actions'
import type { PlayerId } from '../engine/types'
import { botDecide, continueActingBG, DEFAULT_CARD_WEIGHTS } from './bot'
import {
  type ActionCategory,
  type BotWeights,
  BASE_WEIGHTS,
  DYNAMIC_WEIGHTS,
  OPPONENT_WEIGHTS,
} from './botWeights'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

// ── LCG 亂數（確保訓練可重現）──────────────────────

function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 0x100000000
  }
}

// ── Wilson CI 下界（95% 信賴區間）──────────────────

function wilsonLower(wins: number, total: number, z = 1.96): number {
  if (total === 0) return 0.5
  const p = wins / total
  const denom = 1 + (z * z) / total
  const center = p + (z * z) / (2 * total)
  const margin = z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))
  return (center - margin) / denom
}

// ── 追蹤器 ─────────────────────────────────────────

type WinEntry = { wins: number; total: number }
type ActionTracker = Map<ActionCategory, WinEntry>
type SkillTracker  = Map<string, WinEntry>   // key = `${cardId}_s${skillIndex}`
type CardTracker   = Map<string, WinEntry>   // key = cardId（事件卡/建築卡/反應卡）

const ALL_CATEGORIES: ActionCategory[] = [
  'siege', 'clear_front', 'attack_joint', 'attack',
  'skill_s2', 'skill_s1', 'ally_skill', 'clear_plaza',
  'move_forward', 'end_early',
]

function makeTracker(): ActionTracker {
  const m: ActionTracker = new Map()
  for (const cat of ALL_CATEGORIES) m.set(cat, { wins: 0, total: 0 })
  return m
}

function makeSkillTracker(): SkillTracker {
  return new Map()
}

function makeCardTracker(): CardTracker {
  return new Map()
}

function recordCard(tracker: CardTracker, cardId: string, player: PlayerId, winner: PlayerId | null): void {
  if (!tracker.has(cardId)) tracker.set(cardId, { wins: 0, total: 0 })
  const e = tracker.get(cardId)!
  e.total++
  if (player === winner) e.wins++
}

// ── 單場訓練遊戲 ────────────────────────────────────

const MAX_TURNS = 120
const MAX_ACTIONS_PER_TURN = 30

function runTrainingGame(
  seed: number,
  p1Weights: BotWeights,
  p2Weights: BotWeights,
  epsilon: number,
  tracker: ActionTracker,
  skillTracker: SkillTracker,
  cardTracker: CardTracker,
): 'p1' | 'p2' | null {
  const rng = lcg(seed)
  let state: GameState = createInitialState({ rngSeed: seed })

  const usedActions: Array<{ player: PlayerId; category: ActionCategory }> = []
  const usedSkills:  Array<{ player: PlayerId; skillKey: string }> = []
  const usedCards:   Array<{ player: PlayerId; cardId: string }> = []
  let actionsThisTurn = 0

  while (!state.winner && state.turn <= MAX_TURNS) {
    const player = state.currentPlayer
    actionsThisTurn++

    if (actionsThisTurn > MAX_ACTIONS_PER_TURN) {
      if (state.actingBGId) {
        const endOk = canDispatch(state, player, { type: 'END_BG_ACTION' })
        if (endOk.ok) {
          state = reduce(state, player, { type: 'END_BG_ACTION' }).state
          actionsThisTurn = 0
          continue
        }
      }
      const ok = canDispatch(state, player, { type: 'NEXT_PHASE' })
      if (ok.ok) state = reduce(state, player, { type: 'NEXT_PHASE' }).state
      else break
      actionsThisTurn = 0
      continue
    }

    const prevTurn = state.turn
    let action: Action

    const playerWeights = player === 'p1' ? p1Weights : p2Weights

    if (state.phase === 'action' && state.actingBGId) {
      const result = continueActingBG(state, player, playerWeights, epsilon, rng)
      action = result.action
      usedActions.push({ player, category: result.category })

      if (action.type === 'USE_SKILL') {
        const fromBGId = action.fromBGId ?? state.actingBGId
        const bg = fromBGId ? state.bgs[fromBGId] : null
        if (bg) usedSkills.push({ player, skillKey: `${bg.cardId}_s${action.skillIndex}` })
      }
    } else {
      action = botDecide(state, player, playerWeights)
    }

    // 記錄卡牌使用（事件卡/建築卡/反應卡安裝）
    if (action.type === 'PLAY_EVENT' || action.type === 'PLAY_BUILDING') {
      usedCards.push({ player, cardId: action.cardId })
    } else if (action.type === 'INSTALL_REACTION') {
      usedCards.push({ player, cardId: action.cardId })
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

  const winner = state.winner

  for (const { player, category } of usedActions) {
    const entry = tracker.get(category)!
    entry.total++
    if (player === winner) entry.wins++
  }

  for (const { player, skillKey } of usedSkills) {
    if (!skillTracker.has(skillKey)) skillTracker.set(skillKey, { wins: 0, total: 0 })
    const entry = skillTracker.get(skillKey)!
    entry.total++
    if (player === winner) entry.wins++
  }

  for (const { player, cardId } of usedCards) {
    recordCard(cardTracker, cardId, player, winner)
  }

  return winner
}

// ── Wilson 更新宏觀權重 ─────────────────────────────

function updateWeights(
  current: BotWeights,
  tracker: ActionTracker,
  skillTracker: SkillTracker,
  cardTracker: CardTracker,
  momentum: number,
): BotWeights {
  const qualities = new Map<ActionCategory, number>()
  for (const cat of ALL_CATEGORIES) {
    const e = tracker.get(cat)!
    qualities.set(cat, wilsonLower(e.wins, e.total))
  }

  const vals = [...qualities.values()]
  const avgQ = vals.reduce((a, b) => a + b, 0) / vals.length || 0.5

  const next = { ...current, skillWeights: { ...current.skillWeights } }

  for (const cat of ALL_CATEGORIES) {
    const q = qualities.get(cat) ?? 0.5
    const scale = avgQ > 0 ? q / avgQ : 1
    const target = BASE_WEIGHTS[cat] * scale
    const blended = momentum * current[cat] + (1 - momentum) * target
    next[cat] = Math.max(0.1, Math.min(20, blended))
  }

  // s2MinHand / s1MinHand
  const s2Q = qualities.get('skill_s2') ?? 0.5
  const s1Q = qualities.get('skill_s1') ?? 0.5
  const threshold = 0.04

  // s2MinHand 下限 1（實驗證明保留至少 1 張手牌比 0 好）
  next.s2MinHand = s2Q < avgQ - threshold
    ? Math.min(3, current.s2MinHand + 0.5)
    : s2Q >= avgQ ? Math.max(1, current.s2MinHand - 0.25) : current.s2MinHand

  next.s1MinHand = s1Q < avgQ - threshold
    ? Math.min(3, current.s1MinHand + 0.5)
    : s1Q >= avgQ ? Math.max(0, current.s1MinHand - 0.25) : current.s1MinHand

  // ── 個別技能權重 ─────────────────────────────────
  // 只更新樣本足夠（≥50）的技能；稀少技能保留上一輪估計
  const MIN_SKILL_SAMPLES = 50

  // 計算所有技能的平均 Wilson 品質（用於 scale 基準）
  const skillQualities: number[] = []
  for (const [, e] of skillTracker) {
    if (e.total >= MIN_SKILL_SAMPLES) skillQualities.push(wilsonLower(e.wins, e.total))
  }
  const avgSkillQ = skillQualities.length > 0
    ? skillQualities.reduce((a, b) => a + b, 0) / skillQualities.length
    : avgQ

  for (const [key, e] of skillTracker) {
    if (e.total < MIN_SKILL_SAMPLES) continue

    const q = wilsonLower(e.wins, e.total)
    const scale = avgSkillQ > 0 ? q / avgSkillQ : 1

    // baseline = 對應的通用技能權重（s0 = S1, s1 = S2）
    const isS2 = key.endsWith('_s1')
    const baseline = isS2 ? next.skill_s2 : next.skill_s1
    const target = baseline * scale
    const existing = current.skillWeights[key] ?? baseline
    next.skillWeights[key] = Math.max(0.1, Math.min(20, momentum * existing + (1 - momentum) * target))
  }

  // ── 卡片權重 ──────────────────────────────────────
  const MIN_CARD_SAMPLES = 30

  const cardQualities: number[] = []
  for (const [, e] of cardTracker) {
    if (e.total >= MIN_CARD_SAMPLES) cardQualities.push(wilsonLower(e.wins, e.total))
  }
  const avgCardQ = cardQualities.length > 0
    ? cardQualities.reduce((a, b) => a + b, 0) / cardQualities.length
    : 0.5

  // rush_time 只在落後時使用，Wilson 勝率天生偏低，不納入訓練
  const CARD_WEIGHT_SKIP = new Set(['rush_time'])

  next.cardWeights = { ...current.cardWeights }
  for (const [cardId, e] of cardTracker) {
    if (e.total < MIN_CARD_SAMPLES) continue
    if (CARD_WEIGHT_SKIP.has(cardId)) continue
    const q = wilsonLower(e.wins, e.total)
    const scale = avgCardQ > 0 ? q / avgCardQ : 1
    const baseline = DEFAULT_CARD_WEIGHTS[cardId] ?? 2.0
    const target = baseline * scale
    const existing = current.cardWeights[cardId] ?? baseline
    next.cardWeights[cardId] = Math.max(0.1, Math.min(20, momentum * existing + (1 - momentum) * target))
  }

  return next
}

// ── 寫回 botWeights.ts ──────────────────────────────

function writeWeightsToFile(weights: BotWeights): void {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const filePath = path.join(__dirname, 'botWeights.ts')

  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')

  const startMarker = '/** 訓練後動態更新的權重'
  const startIdx = lines.findIndex((l: string) => l.startsWith(startMarker))
  if (startIdx === -1) { console.error('找不到 DYNAMIC_WEIGHTS 注釋行，寫回失敗'); return }

  const exportIdx = lines.findIndex((l: string, i: number) => i >= startIdx && l.startsWith('export const DYNAMIC_WEIGHTS'))
  if (exportIdx === -1) { console.error('找不到 DYNAMIC_WEIGHTS export 行，寫回失敗'); return }

  let endIdx = exportIdx
  if (!lines[exportIdx].includes('}')) {
    for (let i = exportIdx + 1; i < lines.length; i++) {
      if (lines[i].startsWith('}')) { endIdx = i; break }
    }
  }

  // 個別技能權重行（依 key 排序）
  const skillLines = Object.entries(weights.skillWeights)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `    '${k}': ${v.toFixed(4)},`)

  const newBlock = [
    `/** 訓練後動態更新的權重（train.ts 直接修改此物件） */`,
    `export const DYNAMIC_WEIGHTS: BotWeights = {`,
    `  siege: ${weights.siege.toFixed(4)},`,
    `  clear_front: ${weights.clear_front.toFixed(4)},`,
    `  attack_joint: ${weights.attack_joint.toFixed(4)},`,
    `  attack: ${weights.attack.toFixed(4)},`,
    `  skill_s2: ${weights.skill_s2.toFixed(4)},`,
    `  skill_s1: ${weights.skill_s1.toFixed(4)},`,
    `  ally_skill: ${weights.ally_skill.toFixed(4)},`,
    `  clear_plaza: ${weights.clear_plaza.toFixed(4)},`,
    `  move_forward: ${weights.move_forward.toFixed(4)},`,
    `  end_early: ${weights.end_early.toFixed(4)},`,
    `  s2MinHand: ${weights.s2MinHand.toFixed(4)},`,
    `  s1MinHand: ${weights.s1MinHand.toFixed(4)},`,
    `  skillWeights: {`,
    ...skillLines,
    `  },`,
    `  cardWeights: {`,
    ...Object.entries(weights.cardWeights)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `    '${k}': ${v.toFixed(4)},`),
    `  },`,
    `}`,
  ]

  lines.splice(startIdx, endIdx - startIdx + 1, ...newBlock)
  writeFileSync(filePath, lines.join('\n'), 'utf-8')
}

// ── 印出統計 ────────────────────────────────────────

function printTracker(tracker: ActionTracker): void {
  console.log('  類別               勝場/使用   勝率    Wilson↓')
  for (const cat of ALL_CATEGORIES) {
    const e = tracker.get(cat)!
    const wr = e.total > 0 ? (e.wins / e.total * 100).toFixed(1) : '-   '
    const wl = e.total > 0 ? (wilsonLower(e.wins, e.total) * 100).toFixed(1) : '-   '
    console.log(`  ${cat.padEnd(18)} ${String(e.wins).padStart(5)}/${String(e.total).padEnd(6)} ${wr.padStart(5)}%  ${wl.padStart(5)}%`)
  }
}

function printSkillTracker(skillTracker: SkillTracker, w: BotWeights): void {
  const entries = [...skillTracker.entries()]
    .filter(([, e]) => e.total >= 50)
    .sort(([, a], [, b]) => wilsonLower(b.wins, b.total) - wilsonLower(a.wins, a.total))

  if (entries.length === 0) return
  console.log('\n  個別技能（top/bottom 各5，樣本≥50）：')
  console.log('  技能key              勝場/使用   Wilson↓  權重')
  const show = [...entries.slice(0, 5), ...(entries.length > 10 ? entries.slice(-5) : [])]
  for (const [key, e] of show) {
    const wl = (wilsonLower(e.wins, e.total) * 100).toFixed(1)
    const sw = (w.skillWeights[key] ?? 0).toFixed(4)
    console.log(`  ${key.padEnd(22)} ${String(e.wins).padStart(5)}/${String(e.total).padEnd(6)} ${wl.padStart(5)}%  ${sw}`)
  }
}

function printCardTracker(cardTracker: CardTracker, w: BotWeights): void {
  const entries = [...cardTracker.entries()]
    .filter(([, e]) => e.total >= 30)
    .sort(([, a], [, b]) => wilsonLower(b.wins, b.total) - wilsonLower(a.wins, a.total))

  if (entries.length === 0) return
  console.log('\n  卡片使用（依 Wilson↓ 排序，樣本≥30）：')
  console.log('  卡片id               勝場/使用   Wilson↓  權重')
  for (const [key, e] of entries) {
    const wl = (wilsonLower(e.wins, e.total) * 100).toFixed(1)
    const cw = (w.cardWeights[key] ?? DEFAULT_CARD_WEIGHTS[key] ?? 2.0).toFixed(4)
    console.log(`  ${key.padEnd(22)} ${String(e.wins).padStart(5)}/${String(e.total).padEnd(6)} ${wl.padStart(5)}%  ${cw}`)
  }
}

function printWeights(w: BotWeights): void {
  console.log('  更新後宏觀權重:')
  for (const cat of ALL_CATEGORIES) {
    console.log(`    ${cat.padEnd(16)} ${(w[cat] as number).toFixed(4)}`)
  }
  console.log(`    s2MinHand        ${w.s2MinHand.toFixed(4)}`)
  console.log(`    s1MinHand        ${w.s1MinHand.toFixed(4)}`)
  const skillCount = Object.keys(w.skillWeights).length
  if (skillCount > 0) console.log(`    skillWeights     ${skillCount} 條`)
}

// ── CLI 參數解析 ─────────────────────────────────────

const args = process.argv.slice(2)
const isQuick  = args.includes('--quick')
const roundsArg = args.find(a => a.startsWith('--rounds=') || a === '--rounds')
const totalRounds = roundsArg
  ? parseInt(roundsArg.includes('=') ? roundsArg.split('=')[1] : args[args.indexOf('--rounds') + 1] ?? '1', 10)
  : 1

const GAMES_PER_PHASE = isQuick ? 500 : 2500

const PHASES = [
  { games: GAMES_PER_PHASE, epsilon: 1.00, momentum: 0.5, label: 'Phase 1 — 廣泛探索（ε=1.0）' },
  { games: GAMES_PER_PHASE, epsilon: 0.50, momentum: 0.6, label: 'Phase 2 — 半隨機（ε=0.5）' },
  { games: GAMES_PER_PHASE, epsilon: 0.25, momentum: 0.7, label: 'Phase 3 — 偏貪心（ε=0.25）' },
  { games: GAMES_PER_PHASE, epsilon: 0.10, momentum: 0.8, label: 'Phase 4 — 收斂（ε=0.1）' },
]

// ── 主訓練迴圈 ──────────────────────────────────────

async function main(): Promise<void> {
  console.log(`=== BG Card Game Bot 訓練開始（${totalRounds} 輪，${isQuick ? 'quick' : 'full'}）===\n`)

  // 從已訓練的 DYNAMIC_WEIGHTS 接續，不從 BASE 重頭開始
  let currentWeights: BotWeights = {
    ...DYNAMIC_WEIGHTS,
    skillWeights: { ...DYNAMIC_WEIGHTS.skillWeights },
    cardWeights:  { ...DYNAMIC_WEIGHTS.cardWeights },
  }
  let opponentWeights: BotWeights = { ...OPPONENT_WEIGHTS }

  let grandTotalGames = 0
  let grandP1Wins = 0, grandP2Wins = 0, grandDraws = 0

  for (let round = 1; round <= totalRounds; round++) {
    console.log(`\n${'█'.repeat(50)}`)
    console.log(`輪次 ${round} / ${totalRounds}`)
    console.log(`${'█'.repeat(50)}`)

    let totalGames = 0
    let totalP1Wins = 0, totalP2Wins = 0, totalDraws = 0

    for (const phase of PHASES) {
      console.log(`\n${'─'.repeat(50)}`)
      console.log(`${phase.label}`)
      console.log(`${'─'.repeat(50)}`)

      const tracker = makeTracker()
      const skillTracker = makeSkillTracker()
      const cardTracker = makeCardTracker()
      let p1Wins = 0, p2Wins = 0, draws = 0

      for (let i = 0; i < phase.games; i++) {
        const seed = (grandTotalGames + i) * 7919 + round * 1031 + 42
        const winner = runTrainingGame(seed, currentWeights, opponentWeights, phase.epsilon, tracker, skillTracker, cardTracker)

        if (winner === 'p1') p1Wins++
        else if (winner === 'p2') p2Wins++
        else draws++

        if ((i + 1) % 500 === 0) {
          const p1r = (p1Wins / (i + 1) * 100).toFixed(1)
          const p2r = (p2Wins / (i + 1) * 100).toFixed(1)
          process.stdout.write(`  局數 ${i + 1}/${phase.games}  P1:${p1r}% P2:${p2r}% 平:${draws}\n`)
        }
      }

      totalGames += phase.games
      totalP1Wins += p1Wins
      totalP2Wins += p2Wins
      totalDraws += draws
      grandTotalGames += phase.games

      console.log(`\n本 Phase 結果：P1(新) ${p1Wins}勝 / P2(舊) ${p2Wins}勝 / 平 ${draws}`)
      console.log(`  P1勝率 ${(p1Wins / phase.games * 100).toFixed(1)}%  P2勝率 ${(p2Wins / phase.games * 100).toFixed(1)}%\n`)

      printTracker(tracker)

      opponentWeights = { ...currentWeights }
      currentWeights = updateWeights(currentWeights, tracker, skillTracker, cardTracker, phase.momentum)

      printSkillTracker(skillTracker, currentWeights)
      printCardTracker(cardTracker, currentWeights)
      console.log()
      printWeights(currentWeights)
    }

    grandP1Wins += totalP1Wins
    grandP2Wins += totalP2Wins
    grandDraws  += totalDraws

    // 每輪結束立即寫回，中途中斷也保有成果
    writeWeightsToFile(currentWeights)
    console.log(`\n輪次 ${round} 完成：P1 ${totalP1Wins}勝 / P2 ${totalP2Wins}勝 / 平 ${totalDraws}`)
    console.log(`  P1勝率 ${(totalP1Wins / totalGames * 100).toFixed(1)}%  P2勝率 ${(totalP2Wins / totalGames * 100).toFixed(1)}%`)
    console.log(`✓ DYNAMIC_WEIGHTS 已寫回 botWeights.ts`)
  }

  console.log('\n' + '='.repeat(50))
  console.log(`全部完成！共 ${totalRounds} 輪 ${grandTotalGames} 局`)
  console.log(`累計：P1 ${grandP1Wins}勝 / P2 ${grandP2Wins}勝 / 平 ${grandDraws}`)
  console.log(`累計勝率：P1 ${(grandP1Wins / grandTotalGames * 100).toFixed(1)}%  P2 ${(grandP2Wins / grandTotalGames * 100).toFixed(1)}%`)
}

main().catch(err => {
  console.error('訓練失敗：', err)
  process.exit(1)
})

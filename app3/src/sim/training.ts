#!/usr/bin/env node
// Beast Conquest — Bot 平衡訓練腳本（座標下降法）
// 執行：npx tsx src/sim/training.ts [輪數]

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { runBatch } from './runner'
import type { BotWeights } from './botWeights'
import { BASE_WEIGHTS, DYNAMIC_WEIGHTS } from './botWeights'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROUNDS = parseInt(process.argv[2] ?? '3', 10)
const EVAL_GAMES = 200
const PERTURB = 0.3
const IMPROVE_THRESHOLD = 0.008

/** 平衡分數：越高越好（最大 1.0） */
function balanceScore(result: ReturnType<typeof runBatch>): number {
  const bias = Math.abs(result.winRate.p1 - 0.5) * 2
  const turnScore = Math.min(1, result.avgTurns / 12)
  return (1 - bias) * 0.7 + turnScore * 0.3
}

function evalWeights(weights: BotWeights): { score: number; p1: number; turns: number } {
  const r = runBatch(EVAL_GAMES, undefined, weights)
  return {
    score: balanceScore(r),
    p1: parseFloat((r.winRate.p1 * 100).toFixed(1)),
    turns: parseFloat(r.avgTurns.toFixed(1)),
  }
}

function cloneWeights(w: BotWeights): BotWeights { return { ...w } }

function clampWeight(v: number): number {
  return Math.min(3.0, Math.max(0.2, parseFloat(v.toFixed(3))))
}

function writeDynamicWeights(weights: BotWeights): void {
  const weightsJson = JSON.stringify(weights, null, 2)
  const content = `// Beast Conquest — Bot 評分權重
// BASE_WEIGHTS：手動調整的基準
// DYNAMIC_WEIGHTS：由 training.ts 自動訓練更新

export type BotWeights = {
  harvest: number
  lairSiege: number
  attackKo: number
  attackStun: number
  fortBreak: number
  fortProgress: number
  moveAdvance: number
  skill: number
}

export const BASE_WEIGHTS: BotWeights = {
  harvest: 1.0,
  lairSiege: 1.0,
  attackKo: 1.0,
  attackStun: 1.0,
  fortBreak: 1.0,
  fortProgress: 1.0,
  moveAdvance: 1.0,
  skill: 1.0,
}

// 由訓練腳本更新（${new Date().toISOString().slice(0, 10)}）
export const DYNAMIC_WEIGHTS: BotWeights = ${weightsJson}
`
  fs.writeFileSync(path.join(__dirname, 'botWeights.ts'), content, 'utf-8')
}

const keys = Object.keys(BASE_WEIGHTS) as (keyof BotWeights)[]

let current = cloneWeights(DYNAMIC_WEIGHTS)  // 從上次訓練結果繼續
const baseline = evalWeights(current)
let currentScore = baseline.score

console.log(`\n🐾 Beast Conquest Bot 訓練 (座標下降法)`)
console.log(`  輪次：${ROUNDS}  評估場數：${EVAL_GAMES}  擾動幅度：±${(PERTURB * 100).toFixed(0)}%`)
console.log(`\n  基準分數：${currentScore.toFixed(4)} (P1勝率:${baseline.p1}% 平均回合:${baseline.turns})`)
console.log('-'.repeat(55))

for (let round = 1; round <= ROUNDS; round++) {
  console.log(`\n第 ${round} 輪`)
  let roundImproved = false

  for (const key of keys) {
    // 嘗試 ×(1+PERTURB)
    const upW = cloneWeights(current)
    upW[key] = clampWeight(current[key] * (1 + PERTURB))
    const up = evalWeights(upW)

    if (up.score > currentScore + IMPROVE_THRESHOLD) {
      current = upW
      currentScore = up.score
      roundImproved = true
      console.log(`  ✅ ${key.padEnd(14)} ×${(1+PERTURB).toFixed(1)} → ${upW[key].toFixed(3)}  score=${up.score.toFixed(4)} P1=${up.p1}% turns=${up.turns}`)
      continue
    }

    // 嘗試 ×(1-PERTURB)
    const downW = cloneWeights(current)
    downW[key] = clampWeight(current[key] * (1 - PERTURB))
    const down = evalWeights(downW)

    if (down.score > currentScore + IMPROVE_THRESHOLD) {
      current = downW
      currentScore = down.score
      roundImproved = true
      console.log(`  ✅ ${key.padEnd(14)} ×${(1-PERTURB).toFixed(1)} → ${downW[key].toFixed(3)}  score=${down.score.toFixed(4)} P1=${down.p1}% turns=${down.turns}`)
    }
  }

  if (!roundImproved) {
    console.log(`  （本輪無改善，提前結束）`)
    break
  }
}

console.log(`\n${'='.repeat(55)}`)
console.log(`最終分數：${currentScore.toFixed(4)} (提升 +${(currentScore - baseline.score).toFixed(4)})`)
console.log(`最終權重：`)
for (const key of keys) {
  const diff = current[key] - BASE_WEIGHTS[key]
  const mark = Math.abs(diff) < 0.01 ? '' : diff > 0 ? ' ▲' : ' ▼'
  console.log(`  ${key.padEnd(14)} ${current[key].toFixed(3)}${mark}`)
}

writeDynamicWeights(current)
console.log(`\n✅ 已寫入 src/sim/botWeights.ts`)

#!/usr/bin/env node
// scripts/train.mjs
// 自動執行 N 輪訓練迴圈：模擬 → 更新權重 → 驗證（blend vs base）
//
// 用法：
//   node scripts/train.mjs [輪數=1] [場數=300]
//
// 範例：
//   npm run train              # 1 輪 × 300 場
//   npm run train:3            # 3 輪 × 300 場
//   node scripts/train.mjs 10 500

import { spawnSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_DIR    = path.resolve(__dirname, '..')
const REPORT     = 'report_auto.json'
const VALIDATE   = 'report_validate.json'
const WEIGHTS_TS = 'src/sim/botWeights.ts'

const ROUNDS  = parseInt(process.argv[2] ?? '1',   10)
const MATCHES = parseInt(process.argv[3] ?? '300', 10)
const VAL_N   = Math.max(50, Math.floor(MATCHES / 4))  // 驗證場數 = 訓練的 1/4

if (isNaN(ROUNDS) || ROUNDS < 1) { console.error('輪數必須是正整數'); process.exit(1) }

// ─── Helpers ───────────────────────────────────────────────────────────────────

function run(cmd, args, env = {}) {
  const result = spawnSync(cmd, args, {
    cwd: APP_DIR, stdio: 'inherit', shell: true,
    env: { ...process.env, ...env },
  })
  if (result.status !== 0) {
    console.error(`\n✗ 失敗: ${cmd} ${args.join(' ')}`)
    process.exit(result.status ?? 1)
  }
}

function readMeta(file) {
  const p = path.join(APP_DIR, file)
  if (!existsSync(p)) return null
  try { return JSON.parse(readFileSync(p, 'utf-8')).meta ?? null }
  catch { return null }
}

function fmt(n) { return n != null ? n.toFixed(3) : '?' }

// ─── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(52)}`)
console.log(` 訓練設定：${ROUNDS} 輪 × ${MATCHES} 場  |  驗證：每輪 ${VAL_N} 場`)
console.log(`${'═'.repeat(52)}`)
console.log(` 說明：訓練場次紅=blend（受訓）vs 黑=opponent（上輪快照）`)
console.log(`        驗證場次：紅方=blend（受訓）vs 黑方=base（固定基準）`)
console.log(`        [驗證 redWinRate > 0.5] 代表訓練真的有提升`)
console.log(`${'═'.repeat(52)}`)

for (let round = 1; round <= ROUNDS; round++) {
  console.log(`\n─── Round ${round}/${ROUNDS} ${'─'.repeat(40 - String(round).length * 2)}`)

  // ── Step 1：訓練場次（blend vs opponent，探索 epsilon=0.2） ─────────────
  console.log(`[1/3] 訓練模擬（${MATCHES} 場，紅=blend vs 黑=opponent）...`)
  run('npx', ['vitest', 'run', 'src/sim/balanceReport.test.ts'], {
    SIM_OUTPUT:        'json',
    SIM_MATCHES:       String(MATCHES),
    SIM_OUTPUT_FILE:   REPORT,
    SIM_RED_MODE:      'blend',
    SIM_BLACK_MODE:    'opponent',
    SIM_RED_EPSILON:   '0.2',
    SIM_BLACK_EPSILON: '0.1',    // 對手略少探索，偏穩健
  })

  const trainMeta = readMeta(REPORT)
  if (!existsSync(path.join(APP_DIR, REPORT))) {
    console.error(`✗ 找不到 ${REPORT}`); process.exit(1)
  }
  if (trainMeta) {
    console.log(`    avgSteps=${fmt(trainMeta.avgSteps)}  redWinRate≈${fmt(trainMeta.redWinRate)}  corpseSnowball=${fmt(trainMeta.avgCorpseSnowball)}`)
  }

  // ── Step 2：更新權重（含 momentum） ─────────────────────────────────────
  console.log(`[2/3] 更新權重（Wilson CI + momentum=0.4）...`)
  run('node', ['src/sim/updateDynamicWeights.js', REPORT, WEIGHTS_TS])

  // ── Step 3：驗證（blend=受訓 vs base=基準，貪心模式 epsilon=0）──────────
  console.log(`[3/3] 驗證（${VAL_N} 場，紅=blend 貪心 vs 黑=base 隨機）...`)
  run('npx', ['vitest', 'run', 'src/sim/balanceReport.test.ts'], {
    SIM_OUTPUT:        'json',
    SIM_MATCHES:       String(VAL_N),
    SIM_OUTPUT_FILE:   VALIDATE,
    SIM_RED_MODE:      'blend',   // 受訓 bot
    SIM_BLACK_MODE:    'base',    // 固定基準
    SIM_RED_EPSILON:   '0.0',     // 純貪心（充分利用訓練結果）
    SIM_BLACK_EPSILON: '0.3',     // 基準方保留探索
  })

  const valMeta = readMeta(VALIDATE)
  if (valMeta) {
    const wr = valMeta.redWinRate ?? 0
    const indicator = wr > 0.55 ? '↑ 明顯提升' : wr > 0.5 ? '↗ 小幅領先' : wr < 0.45 ? '↓ 退步了' : '→ 持平'
    console.log(`\n  ┌─ 驗證結果 ─────────────────────────────────┐`)
    console.log(`  │  blend vs base 紅方勝率: ${fmt(wr)}  ${indicator.padEnd(12)} │`)
    console.log(`  └────────────────────────────────────────────┘`)
  }
}

console.log(`\n✓ 訓練完成（${ROUNDS} 輪 × ${MATCHES} 場）`)
console.log(`  最新權重：${WEIGHTS_TS}`)
console.log(`  最新報告：${REPORT}`)

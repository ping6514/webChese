// BG Card Game — 模擬報告
// 執行: npx tsx src/sim/report.ts [遊戲局數]

import { runSimulation, runGame } from './simulate'

const n = parseInt(process.argv[2] ?? '200')

console.log('═══════════════════════════════════════')
console.log(`  BG 卡牌遊戲 Bot 模擬 (${n} 場)`)
console.log('═══════════════════════════════════════')

// 先跑 1 場詳細輸出
console.log('\n[單場測試]')
const sample = runGame(42)
console.log(`  勝方: ${sample.winner ?? '平手（' + sample.drawReason + '）'}`)
console.log(`  回合數: ${sample.turns}`)
console.log(`  P1城牆剩餘: ${sample.p1WallsLeft}  P2城牆剩餘: ${sample.p2WallsLeft}`)
console.log(`  P1被KO次數: ${sample.p1BGsKOd}  P2被KO次數: ${sample.p2BGsKOd}`)

console.log(`\n[大量模擬 ${n} 場...]`)
const stats = runSimulation(n, true)

console.log('\n═══════════════════════════════════════')
console.log('  模擬結果')
console.log('───────────────────────────────────────')
console.log(`  總場數:       ${stats.games}`)
console.log(`  P1 勝場:      ${stats.p1Wins}  (${(stats.p1WinRate * 100).toFixed(1)}%)`)
console.log(`  P2 勝場:      ${stats.p2Wins}  (${(stats.p2WinRate * 100).toFixed(1)}%)`)
console.log(`  平局/逾時:    ${stats.draws}`)
console.log('───────────────────────────────────────')
console.log(`  平均回合數:   ${stats.avgTurns.toFixed(1)}`)
console.log(`  P1 平均剩牆:  ${stats.avgP1Walls.toFixed(2)}`)
console.log(`  P2 平均剩牆:  ${stats.avgP2Walls.toFixed(2)}`)
console.log(`  P1 平均KO數:  ${stats.avgP1KOs.toFixed(2)}`)
console.log(`  P2 平均KO數:  ${stats.avgP2KOs.toFixed(2)}`)
console.log('═══════════════════════════════════════')

// 平衡性評估
const bias = Math.abs(stats.p1WinRate - stats.p2WinRate)
if (bias < 0.05) {
  console.log('  ✅ 先後攻平衡良好（勝率差 < 5%）')
} else if (bias < 0.10) {
  console.log(`  ⚠️  輕微不平衡（勝率差 ${(bias * 100).toFixed(1)}%）`)
} else {
  const adv = stats.p1WinRate > stats.p2WinRate ? 'P1（先攻）' : 'P2（後攻）'
  console.log(`  ❌ 明顯不平衡：${adv} 優勢 ${(bias * 100).toFixed(1)}%`)
}

if (stats.avgTurns > 50) {
  console.log(`  ⚠️  遊戲過長（平均 ${stats.avgTurns.toFixed(0)} 回合），考慮增強攻擊力`)
} else if (stats.avgTurns < 15) {
  console.log(`  ⚠️  遊戲過短（平均 ${stats.avgTurns.toFixed(0)} 回合），考慮增加防禦`)
} else {
  console.log(`  ✅ 遊戲長度適中（平均 ${stats.avgTurns.toFixed(0)} 回合）`)
}

const drawRate = stats.draws / stats.games
if (drawRate > 0.1) {
  console.log(`  ❌ 平局率過高 (${(drawRate * 100).toFixed(1)}%)，bot 可能有問題`)
} else {
  console.log(`  ✅ 平局率正常 (${(drawRate * 100).toFixed(1)}%)`)
}
console.log('═══════════════════════════════════════')

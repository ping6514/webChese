#!/usr/bin/env node
// Beast Conquest — Bot 對戰模擬報告
// 執行：npx tsx src/sim/report.ts [場數]

import { runBatch, runMatch } from './runner'

const N = parseInt(process.argv[2] ?? '200', 10)

console.log(`\n🐾 Beast Conquest Bot 對戰模擬 (${N} 場)\n`)
console.log('-'.repeat(50))

const result = runBatch(N)

console.log(`\n📊 勝率統計：`)
console.log(`  P1 (先攻) : ${result.p1Wins} 勝 (${(result.winRate.p1 * 100).toFixed(1)}%)`)
console.log(`  P2 (後攻) : ${result.p2Wins} 勝 (${(result.winRate.p2 * 100).toFixed(1)}%)`)

console.log(`\n⏱️  平均回合數：${result.avgTurns.toFixed(1)}`)

console.log(`\n🏯 平均存活獸穴 HP：`)
console.log(`  P1 獸穴：${result.avgLairHP.p1.toFixed(2)}`)
console.log(`  P2 獸穴：${result.avgLairHP.p2.toFixed(2)}`)

console.log(`\n💀 平均 KO 次數：`)
console.log(`  P1 首領被 KO：${result.avgKO.p1.toFixed(2)} 次`)
console.log(`  P2 首領被 KO：${result.avgKO.p2.toFixed(2)} 次`)

console.log(`\n⚔️  平均軍團召喚次數：`)
console.log(`  P1：${result.avgSummons.p1.toFixed(1)} 次`)
console.log(`  P2：${result.avgSummons.p2.toFixed(1)} 次`)

console.log(`\n🃏 平均戰術卡觸發次數：`)
console.log(`  P1：${result.avgTactical.p1.toFixed(1)} 次`)
console.log(`  P2：${result.avgTactical.p2.toFixed(1)} 次`)

console.log(`\n⚡ 平均技能使用次數：`)
console.log(`  P1：${result.avgSkill.p1.toFixed(1)} 次`)
console.log(`  P2：${result.avgSkill.p2.toFixed(1)} 次`)

// 平衡性分析
console.log('\n' + '-'.repeat(50))
console.log('📋 平衡性分析：')
const diff = Math.abs(result.winRate.p1 - result.winRate.p2) * 100
if (diff < 5) {
  console.log(`  ✅ 非常平衡（差距 ${diff.toFixed(1)}%）`)
} else if (diff < 15) {
  console.log(`  ⚠️  輕微失衡（差距 ${diff.toFixed(1)}%），${result.p1Wins > result.p2Wins ? 'P1（先攻）優勢' : 'P2（後攻）優勢'}`)
} else {
  console.log(`  ❌ 嚴重失衡（差距 ${diff.toFixed(1)}%），需要調整數值`)
}

const avgTurns = result.avgTurns
if (avgTurns < 5) {
  console.log(`  ❌ 遊戲過快結束（${avgTurns.toFixed(1)} 回合），數值可能失衡`)
} else if (avgTurns < 10) {
  console.log(`  ⚠️  遊戲偏短（${avgTurns.toFixed(1)} 回合）`)
} else if (avgTurns < 25) {
  console.log(`  ✅ 遊戲長度適中（${avgTurns.toFixed(1)} 回合）`)
} else {
  console.log(`  ⚠️  遊戲偏長（${avgTurns.toFixed(1)} 回合），可能防守過強`)
}

// 顯示一場詳細對戰記錄
console.log('\n' + '-'.repeat(50))
console.log('🔍 範例單場詳細記錄（seed=1）：')
const sample = runMatch(undefined, 1)
console.log(`  勝者：${sample.winner.toUpperCase()}，原因：${sample.reason}，共 ${sample.turns} 回合`)
console.log(`  P1 獸穴剩餘 HP：${sample.lairHPRemaining.p1}`)
console.log(`  P2 獸穴剩餘 HP：${sample.lairHPRemaining.p2}`)
console.log(`  KO 次數 - P1 首領：${sample.koCount.p1}，P2 首領：${sample.koCount.p2}`)
console.log(`  技能使用 - P1：${sample.skillUses.p1}，P2：${sample.skillUses.p2}`)

// 顯示最後幾個關鍵事件
const keyEvents = sample.events.filter(
  (e) =>
    e.type === 'LEADER_KO' ||
    e.type === 'CITY_WALL_DAMAGED' ||
    e.type === 'FORT_CLEARED' ||
    e.type === 'GAME_OVER' ||
    e.type === 'TURN_STARTED'
).slice(-15)
console.log('\n  最後關鍵事件（最多15筆）：')
for (const e of keyEvents) {
  console.log(`    [${e.type}]`, JSON.stringify(e).slice(0, 80))
}

console.log('\n' + '-'.repeat(50))

// 角色強度分析腳本
// 執行: npx tsx src/sim/charAnalysis.ts

import { runGame } from './simulate'
import { allBGCards } from '../data/bg-cards'
import type { BGClass } from '../engine/types'

const classes: BGClass[] = ['BOM', 'ATK', 'SHT', 'BLC']
const cardsByClass: Record<BGClass, string[]> = { BOM: [], ATK: [], SHT: [], BLC: [] }
for (const c of allBGCards) cardsByClass[c.bgClass].push(c.id)

const GAMES = 300

// 基準勝率（全隨機）
let baseP1 = 0
for (let i = 0; i < GAMES; i++) {
  const r = runGame(i * 7919 + 42)
  if (r.winner === 'p1') baseP1++
}
const baseRate = baseP1 / GAMES * 100
console.log(`基準 (隨機) P1=${baseRate.toFixed(1)}%`)
console.log()

// 每張卡固定給P1
for (const cls of classes) {
  console.log(`── ${cls} ──`)
  for (const cardId of cardsByClass[cls]) {
    const def = allBGCards.find(c => c.id === cardId)!
    let w = 0
    for (let i = 0; i < GAMES; i++) {
      const r = runGame(i * 7919 + 42, { p1Cards: { [cls]: cardId } as any })
      if (r.winner === 'p1') w++
    }
    const rate = w / GAMES * 100
    const diff = rate - baseRate
    const mark = diff > 6 ? ' ⬆️ 強' : diff < -6 ? ' ⬇️ 弱' : ''
    console.log(`  ${def.name.padEnd(5)} HP${def.hp} ATK${def.attack}: ${rate.toFixed(1)}%  (${diff > 0 ? '+' : ''}${diff.toFixed(1)}%)${mark}`)
  }
  console.log()
}

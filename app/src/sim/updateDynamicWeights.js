// app/src/sim/updateDynamicWeights.js (ESM)
// 用途：從模擬報告 JSON 計算新的動態權重，並寫回 botWeights.ts
//
// 使用方式：
//   node src/sim/updateDynamicWeights.js <report.json> <path/to/botWeights.ts>

import fs from 'fs'
import path from 'path'

if (process.argv.length < 4) {
  console.error('Usage: node src/sim/updateDynamicWeights.js <input_report.json> <botWeights.ts>')
  process.exit(1)
}

const inputFile  = process.argv[2]
const outputFile = process.argv[3]

// ── Wilson CI 下界：樣本小時更保守，不亂跳 ──
function wilsonLower(wins, n, z = 1.645) {  // z=1.645 → 90% CI
  if (n === 0) return 0.5
  const p = wins / n
  const z2 = z * z
  return (p + z2 / (2 * n) - z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / (1 + z2 / n)
}

// ── 用括號計數法提取 export const <NAME> = {...} 的 JSON 物件 ──
function extractExportObject(src, exportName) {
  const declIdx = src.indexOf(`export const ${exportName}`)
  if (declIdx === -1) return null
  const bracketIdx = src.indexOf('{', declIdx)
  if (bracketIdx === -1) return null
  let depth = 0, endIdx = -1
  for (let i = bracketIdx; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') { depth--; if (depth === 0) { endIdx = i; break } }
  }
  if (endIdx === -1) return null
  try { return JSON.parse(src.substring(bracketIdx, endIdx + 1)) }
  catch { return null }
}

// ── 從 botWeights.ts 讀取現有的 DYNAMIC_WEIGHTS（用於 momentum） ──
function readExistingDynamic(filePath) {
  try {
    const src = fs.readFileSync(filePath, 'utf-8')
    return extractExportObject(src, 'DYNAMIC_WEIGHTS')
  } catch {
    return null
  }
}

try {
  const reportData = JSON.parse(fs.readFileSync(inputFile, 'utf-8'))
  const existing   = readExistingDynamic(outputFile)

  // ── momentum 比例：新 60% + 舊 40%，防止震盪 ──
  const MOMENTUM = 0.4

  function blend(newVal, oldVal) {
    if (oldVal == null) return newVal
    return Math.round(MOMENTUM * oldVal + (1 - MOMENTUM) * newVal)
  }

  // ── shootScoring：根據 avgCorpseSnowball 微調 ──
  const newShoot = {
    targetIsKing:             -15000,
    targetIsHighValueBase:    -8000,
    targetHasHighPrioritySoul: -5000,
    targetHpPerPoint:         -80,
    canPierceExtra:           -600,
    canChainExtra:            -500,
    ignoreBlockingBonus:      -400,
    myCorpsesBonusPer10: Math.round(-300 - reportData.meta.avgCorpseSnowball * 20),
  }

  // ── moveScoring：redWinRate 偏低時增加防守 ──
  const newMove = {
    distanceToEnemyKingPerTile: 60,
    distanceToAnyEnemyPerTile:  40,
    corpsesNearbyBonusPerCorpse: -35,
    palaceSafetyBonus: Math.round(-250 - (0.5 - reportData.meta.redWinRate) * 100),
    avoidEnemyRangeMalus: 300,
  }

  const dynamic = {
    buyPriority:  { default: 30 },
    shootScoring: {},
    moveScoring:  {},
  }

  // Momentum for shootScoring / moveScoring
  for (const k of Object.keys(newShoot)) {
    dynamic.shootScoring[k] = blend(newShoot[k], existing?.shootScoring?.[k])
  }
  for (const k of Object.keys(newMove)) {
    dynamic.moveScoring[k] = blend(newMove[k], existing?.moveScoring?.[k])
  }

  // ── buyPriority：用 Wilson CI 下界做更穩健的勝率估計 ──
  // 公式：wilsonLower(wins, n) * 300 + costDelta * 100 + enchantRate * 50
  // 再和舊值 momentum 混合
  for (const card of reportData.cards) {
    if (!card.id) {
      console.warn(`跳過缺少 id 的卡牌：${card.name ?? '?'}`)
      continue
    }
    // 從 card 取出 wins 和 n
    const n    = card.n ?? 0
    const wins = Math.round((card.winRate ?? 0) * n)
    const stableWinRate = wilsonLower(wins, n)

    const newScore = Math.round(
      stableWinRate * 300 +
      (card.costDelta ?? 0) * 100 +
      (typeof card.enchantRate === 'number' ? card.enchantRate * 50 : 0)
    )
    const oldScore = existing?.buyPriority?.[card.id]
    dynamic.buyPriority[card.id] = blend(newScore, oldScore)
  }

  // ── 產生新的 DYNAMIC_WEIGHTS TS 區塊 ──
  const tsContent = `export const DYNAMIC_WEIGHTS: typeof BASE_WEIGHTS = ${JSON.stringify(dynamic, null, 2)}`

  if (path.basename(outputFile) === 'botWeights.ts') {
    const originalContent = fs.readFileSync(outputFile, 'utf-8')

    // ── Step A：先把現有的 DYNAMIC_WEIGHTS 寫入 OPPONENT_WEIGHTS ──
    const opponentMarkerStart = '// ─── 對手權重（訓練時黑方使用，每輪前由 updateDynamicWeights.js 更新為上輪的 DYNAMIC） ─'
    const opponentMarkerEnd   = '// ─── 合併函數 ──────────────────────────────────────────────────────────────────'
    const oppStartIdx = originalContent.indexOf(opponentMarkerStart)
    const oppEndIdx   = originalContent.indexOf(opponentMarkerEnd, oppStartIdx)

    let contentAfterOpponent = originalContent
    if (existing && oppStartIdx !== -1 && oppEndIdx !== -1) {
      const opponentTs = `export const OPPONENT_WEIGHTS: typeof BASE_WEIGHTS = ${JSON.stringify(existing, null, 2)}`
      contentAfterOpponent =
        originalContent.substring(0, oppStartIdx + opponentMarkerStart.length) + '\n' +
        '// 初始等同 BASE，第一輪訓練後自動更新為上一輪的 DYNAMIC_WEIGHTS\n' +
        opponentTs + '\n\n' +
        originalContent.substring(oppEndIdx)
      console.log(`✓ Updated OPPONENT_WEIGHTS ← previous DYNAMIC_WEIGHTS`)
    } else if (oppStartIdx === -1) {
      console.warn('⚠ OPPONENT_WEIGHTS marker not found, skipping opponent update')
    }

    // ── Step B：再更新 DYNAMIC_WEIGHTS ──
    const startMarker = '// ─── 動態權重（從 report JSON 訓練後更新，由 updateDynamicWeights.js 寫入） ─'
    const endMarker   = opponentMarkerStart   // DYNAMIC 區塊結束於 OPPONENT 區塊開頭
    const startIdx = contentAfterOpponent.indexOf(startMarker)
    const endIdx   = contentAfterOpponent.indexOf(endMarker, startIdx)

    if (startIdx !== -1 && endIdx !== -1) {
      const newContent =
        contentAfterOpponent.substring(0, startIdx + startMarker.length) + '\n' +
        '// 初始為空，等第一次模擬後自動填入\n' +
        tsContent + '\n\n' +
        contentAfterOpponent.substring(endIdx)
      fs.writeFileSync(outputFile, newContent, 'utf-8')

      const topCards = Object.entries(dynamic.buyPriority)
        .filter(([k]) => k !== 'default')
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([k, v]) => `${k}:${v}`)
        .join(', ')

      console.log(`✓ Updated DYNAMIC_WEIGHTS (momentum=${MOMENTUM})`)
      console.log(`  Top cards: ${topCards}`)
      console.log(`  shootScoring.myCorpsesBonusPer10: ${dynamic.shootScoring.myCorpsesBonusPer10}`)
      console.log(`  moveScoring.palaceSafetyBonus:    ${dynamic.moveScoring.palaceSafetyBonus}`)
    } else {
      console.error('✗ DYNAMIC_WEIGHTS markers not found in botWeights.ts')
      console.log(tsContent)
    }
  } else {
    fs.writeFileSync(outputFile, tsContent, 'utf-8')
    console.log(`✓ Wrote to ${outputFile}`)
  }
  // ── 長期卡牌平衡報告（balance-report.json）────────────────────────────────────
  const reportOutPath = path.join(path.dirname(path.resolve(outputFile)), 'balance-report.json')
  let balanceReport = { cards: {}, sessions: [], updatedAt: '', balanceFlags: {} }
  try { balanceReport = JSON.parse(fs.readFileSync(reportOutPath, 'utf-8')) } catch {}
  if (!balanceReport.cards)    balanceReport.cards    = {}
  if (!balanceReport.sessions) balanceReport.sessions = []

  for (const card of reportData.cards) {
    if (!card.id) continue
    const prev    = balanceReport.cards[card.id] ?? { totalN: 0, totalWins: 0, sessions: 0, prevWilson: null }
    const n       = card.n ?? 0
    const wins    = Math.round((card.winRate ?? 0) * n)
    const totalN  = prev.totalN  + n
    const totalWins = prev.totalWins + wins
    const wilson  = wilsonLower(totalWins, totalN)
    const prevW   = prev.prevWilson ?? wilson
    const trend   = wilson > prevW + 0.015 ? '↑' : wilson < prevW - 0.015 ? '↓' : '='
    balanceReport.cards[card.id] = {
      id:               card.id,
      name:             card.name ?? card.id,
      totalN,
      totalWins,
      winRate:          totalN > 0 ? Math.round(totalWins / totalN * 1000) / 1000 : 0,
      wilsonScore:      Math.round(wilson * 1000) / 1000,
      sessions:         prev.sessions + 1,
      lastEnchantRate:  Math.round((card.enchantRate ?? 0) * 100) / 100,
      lastCostDelta:    card.costDelta ?? 0,
      dynamicScore:     dynamic.buyPriority[card.id] ?? 0,
      prevWilson:       wilson,
      trend,
    }
  }

  // 分位數算力級（A/B/C）
  const allScores = Object.values(balanceReport.cards).map(c => c.wilsonScore ?? 0).sort((a, b) => a - b)
  const p33 = allScores[Math.floor(allScores.length * 0.33)] ?? 0.48
  const p67 = allScores[Math.floor(allScores.length * 0.67)] ?? 0.52
  for (const c of Object.values(balanceReport.cards)) {
    c.tier = (c.wilsonScore ?? 0) >= p67 ? 'A' : (c.wilsonScore ?? 0) <= p33 ? 'C' : 'B'
  }

  // 記錄本次 session
  balanceReport.sessions.push({
    date:               new Date().toISOString(),
    totalGames:         reportData.meta?.totalGames ?? 0,
    redWinRate:         Math.round((reportData.meta?.redWinRate ?? 0) * 1000) / 1000,
    avgCorpseSnowball:  Math.round((reportData.meta?.avgCorpseSnowball ?? 0) * 100) / 100,
  })
  if (balanceReport.sessions.length > 50) balanceReport.sessions = balanceReport.sessions.slice(-50)

  // 平衡旗標：強勢 / 弱勢
  const overpowered  = Object.values(balanceReport.cards).filter(c => c.wilsonScore >= p67 + 0.06).map(c => `${c.name}(勝率${(c.winRate*100).toFixed(1)}%,動態${c.dynamicScore})`)
  const underpowered = Object.values(balanceReport.cards).filter(c => c.wilsonScore <= p33 - 0.06).map(c => `${c.name}(勝率${(c.winRate*100).toFixed(1)}%,動態${c.dynamicScore})`)
  balanceReport.balanceFlags = { overpowered, underpowered, updatedAt: new Date().toISOString() }
  balanceReport.updatedAt = new Date().toISOString()

  fs.writeFileSync(reportOutPath, JSON.stringify(balanceReport, null, 2), 'utf-8')
  console.log(`✓ Updated balance-report.json (${Object.keys(balanceReport.cards).length} cards, ${balanceReport.sessions.length} sessions)`)
  if (overpowered.length  > 0) console.log(`  ⚠ 強勢卡牌: ${overpowered.join(' | ')}`)
  if (underpowered.length > 0) console.log(`  ⚠ 弱勢卡牌: ${underpowered.join(' | ')}`)

} catch (err) {
  console.error('Error:', err.message)
  process.exit(1)
}

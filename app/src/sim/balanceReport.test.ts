import { describe, it } from 'vitest'
import type { Side } from '../engine'
import { listSoulCards, getSoulCard } from '../engine'
import { decideActions, type BotContext } from './balanceBot'
import { runMatch } from './balanceRunner'
import { countCorpses } from '../engine/corpses'  // ← 記得 import 這個（用來算 finalCorpseDiff）

// ---------------------------------------------------------------------------
// Stat accumulators（保持你原本的）
type CardStats = {
  bought: number
  enchanted: number
  winsWhenEnchanted: number
  goldSpentEnchanting: number
}

type ClanStats = {
  enchanted: number
  sideMatches: number
  wins: number
  goldSpentEnchanting: number
}

// ---------------------------------------------------------------------------
// 新增：Match History 結構（精簡版）
type MatchHistory = {
  seed: number
  winner: Side | 'unknown' | null
  steps: number
  finalGoldDiff: number          // redGold - blackGold
  finalCorpseDiff: number        // redCorpses - blackCorpses
  keyEvents: Array<{
    step: number
    type: 'BUY' | 'ENCHANT' | 'SACRIFICE' | 'BLOOD_RITUAL' | 'KILL' | string
    side: Side
    soulId?: string
    unitBase?: string
  }>
}

// ---------------------------------------------------------------------------
// Helpers（你原本的 wilsonCI + costTier 保持不變）
function wilsonCI(wins: number, n: number): { rate: number; ci: number } {
  if (n === 0) return { rate: 0, ci: 0 }
  const z = 1.96
  const z2 = z * z
  const p = wins / n
  const rate = (p * n + z2 / 2) / (n + z2)
  const ci = (z * Math.sqrt(p * (1 - p) * n + z2 / 4)) / (n + z2)
  return { rate: Number(rate.toFixed(3)), ci: Number(ci.toFixed(3)) }
}

function costTier(cost: number): '低(3-4)' | '中(5-6)' | '高(7-8)' {
  if (cost <= 4) return '低(3-4)'
  if (cost <= 6) return '中(5-6)'
  return '高(7-8)'
}

// ---------------------------------------------------------------------------
// Test
describe('sim: balance report + history', () => {
  it('runs self-play batch with detailed history', async () => {
    const env = ((globalThis as any).process?.env ?? {}) as Record<string, string | undefined>
    const N = Number(env.SIM_MATCHES ?? 500)
    const MAX_STEPS = Number(env.SIM_MAX_STEPS ?? 400)
    const PARALLEL = Number(env.SIM_PARALLEL ?? 8)  // 並行數，可調 4~16 看 CPU
    const OUTPUT_JSON = env.SIM_OUTPUT === 'json'

    // 統計器
    const bySoulId: Record<string, CardStats> = {}
    for (const c of listSoulCards()) {
      bySoulId[c.id] = { bought: 0, enchanted: 0, winsWhenEnchanted: 0, goldSpentEnchanting: 0 }
    }
    const byClan: Record<string, ClanStats> = {}

    const histories: MatchHistory[] = []

    // 並行跑 N 場
    const tasks = Array.from({ length: N }, (_, i) => async () => {
      const enchantedBySide: Record<Side, string[]> = { red: [], black: [] }
      // SIM_RED_MODE / SIM_BLACK_MODE 控制各方 bot 使用的權重
      // 訓練時：兩方都用 'blend'（預設）
      // 驗證時：red='blend' vs black='base'，驗證訓練是否真的提升
      const redMode = (env.SIM_RED_MODE ?? 'blend') as BotContext['weightsMode']
      const blackMode = (env.SIM_BLACK_MODE ?? 'blend') as BotContext['weightsMode']
      const redEps = Number(env.SIM_RED_EPSILON ?? 0.2)
      const blackEps = Number(env.SIM_BLACK_EPSILON ?? 0.2)
      const ctxBySide: Record<Side, BotContext> = {
        red:   { seed: 1000 + i * 2, weightsMode: redMode,   epsilon: redEps },
        black: { seed: 1001 + i * 2, weightsMode: blackMode, epsilon: blackEps },
      }

      const keyEvents: MatchHistory['keyEvents'] = []

      const stepper = (state: any, side: Side) => {
        const res = decideActions(state, side, ctxBySide[side])

        // 記錄買入與附魔事件（可再擴充其他）
        for (const soulId of res.boughtSoulIds) {
          if (bySoulId[soulId]) bySoulId[soulId].bought += 1
          keyEvents.push({ step: state.turn?.step ?? 0, type: 'BUY', side, soulId })
        }

        const perEnchantGold = res.enchantedSoulIds.length > 0
          ? res.enchantGoldSpent / res.enchantedSoulIds.length
          : 0
        for (const soulId of res.enchantedSoulIds) {
          const st = bySoulId[soulId]
          if (st) {
            st.enchanted += 1
            st.goldSpentEnchanting += perEnchantGold
            enchantedBySide[side].push(soulId)
            keyEvents.push({ step: state.turn?.step ?? 0, type: 'ENCHANT', side, soulId })
          }
        }

        ctxBySide[side].seed += 1
        return res.actions
      }

      const out = runMatch(stepper, { seed: 5000 + i, maxSteps: MAX_STEPS })
      const winner = out.winner

      // 統計勝率（你原本的邏輯）
      for (const side of ['red', 'black'] as const) {
        const enchanted = enchantedBySide[side]
        for (const soulId of enchanted) {
          const st = bySoulId[soulId]
          if (st && winner === side) st.winsWhenEnchanted += 1
        }

        const clansUsed = new Set<string>()
        for (const soulId of enchanted) {
          const card = getSoulCard(soulId)
          if (card) clansUsed.add(card.clan)
        }
        for (const clan of clansUsed) {
          if (!byClan[clan]) byClan[clan] = { enchanted: 0, sideMatches: 0, wins: 0, goldSpentEnchanting: 0 }
          byClan[clan].sideMatches += 1
          if (winner === side) byClan[clan].wins += 1
        }

        for (const soulId of enchanted) {
          const card = getSoulCard(soulId)
          if (card) {
            const clanSt = byClan[card.clan]!
            clanSt.enchanted += 1
            clanSt.goldSpentEnchanting += card.costGold
          }
        }
      }

      // 計算最終差異
      const redCorpses = countCorpses(out.finalState, 'red')
      const blackCorpses = countCorpses(out.finalState, 'black')
      const redGold = out.finalState.resources.red.gold
      const blackGold = out.finalState.resources.black.gold

      histories.push({
        seed: 5000 + i,
        winner,
        steps: out.steps,
        finalGoldDiff: redGold - blackGold,
        finalCorpseDiff: redCorpses - blackCorpses,
        keyEvents,
      })
    })

    // 並行執行
    for (let i = 0; i < tasks.length; i += PARALLEL) {
      await Promise.all(tasks.slice(i, i + PARALLEL).map(t => t()))
    }

    // ---------------------------------------------------------------------------
    // 輸出部分（完整版，包含原本的計算 + JSON）
    // ---------------------------------------------------------------------------
    if (OUTPUT_JSON) {
      // 先計算原本的 cardRowsWithDelta、clanRows、tierRows（跟你的舊版一樣）
      const cardRows = Object.entries(bySoulId)
        .filter(([, s]) => s.enchanted > 0)
        .map(([soulId, s]) => {
          const card = getSoulCard(soulId)
          const { rate: winRate, ci } = wilsonCI(s.winsWhenEnchanted, s.enchanted)
          const enchantRate = s.bought > 0 ? Number((s.enchanted / s.bought).toFixed(2)) : '?'
          const cost = card?.costGold ?? 0
          const hp = card?.stats.hp ?? 0
          const atk = card ? `${card.stats.atk.key === 'phys' ? 'P' : 'M'}${card.stats.atk.value}` : '?'
          const defP = card?.stats.def.find((d) => d.key === 'phys')?.value ?? 0
          const defM = card?.stats.def.find((d) => d.key === 'magic')?.value ?? 0
          const statBudget = hp + (card?.stats.atk.value ?? 0) * 3 + (defP + defM) * 2
          return {
            id: soulId,
            clan: card?.clan ?? '?',
            name: card?.name ?? soulId,
            base: card?.base ?? '?',
            cost,
            hp,
            atk,
            defP,
            defM,
            statBudget,
            n: s.enchanted,
            winRate,
            'CI±': ci,
            enchantRate,
          }
        })
        .sort((a, b) => b.winRate - a.winRate || b.n - a.n || String(a.name).localeCompare(String(b.name)))

      // cost tier 計算（n >= 20）
      const tierGroups: Record<string, number[]> = {}
      for (const row of cardRows) {
        if (row.n < 20) continue
        const tier = costTier(row.cost)
        if (!tierGroups[tier]) tierGroups[tier] = []
        tierGroups[tier].push(row.winRate)
      }

      const tierAvg: Record<string, number> = {}
      const tierRows = Object.entries(tierGroups)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([tier, rates]) => {
          const avg = rates.reduce((s, r) => s + r, 0) / rates.length
          tierAvg[tier] = avg
          return {
            成本等級: tier,
            卡牌數: rates.length,
            平均勝率: Number(avg.toFixed(3)),
            最低勝率: Number(Math.min(...rates).toFixed(3)),
            最高勝率: Number(Math.max(...rates).toFixed(3)),
          }
        })

      const cardRowsWithDelta = cardRows.map((row) => {
        const tier = costTier(row.cost)
        const avg = tierAvg[tier] ?? 0.5
        const costDelta = Number((row.winRate - avg).toFixed(3))
        return { ...row, costDelta }
      })

      // clanRows
      const clanRows = Object.entries(byClan)
        .map(([clan, s]) => {
          const { rate: winRate, ci } = wilsonCI(s.wins, s.sideMatches)
          const avgGoldPerEnchant = s.enchanted > 0
            ? Number((s.goldSpentEnchanting / s.enchanted).toFixed(1))
            : 0
          return { clan, sideMatches: s.sideMatches, totalEnchants: s.enchanted, winRate, 'CI±': ci, avgGoldPerEnchant }
        })
        .sort((a, b) => b.winRate - a.winRate)

      // JSON 輸出
      const jsonOutput = {
        meta: {
          matches: N,
          maxSteps: MAX_STEPS,
          parallel: PARALLEL,
          avgSteps: histories.reduce((sum, h) => sum + h.steps, 0) / N,
          redWinRate: histories.filter(h => h.winner === 'red').length / N,
          avgCorpseSnowball: histories.reduce((sum, h) => sum + Math.abs(h.finalCorpseDiff), 0) / N
        },
        cards: cardRowsWithDelta,
        clans: clanRows,
        historiesSample: histories.slice(0, 20)  // 只取前20場，避免檔案太大
      }

      const OUTPUT_FILE = env.SIM_OUTPUT_FILE
      if (OUTPUT_FILE) {
        // 寫入檔案（供自動化訓練腳本讀取）
        const fsModule = await import('fs/promises')
        const pathModule = await import('path')
        const fullPath = pathModule.join(process.cwd(), OUTPUT_FILE)
        await fsModule.writeFile(fullPath, JSON.stringify(jsonOutput, null, 2) + '\n')
        process.stdout.write(`[sim] Report written: ${fullPath}\n`)
      } else {
        // 無檔案路徑時，輸出到 stdout
        console.log(JSON.stringify(jsonOutput, null, 2))
      }
    } else {
      // 非 JSON 模式 → 保持你原本的 console.table 輸出（這裡省略，可直接用你舊版的輸出部分）
      console.log('\n=== Balance Sim Report (enhanced) ===')
      // ... 你原本的 console.log + table + outliers 邏輯 ...
    }
  }, 300_000)
})
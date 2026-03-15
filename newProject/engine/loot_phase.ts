/**
 * loot_phase.ts — 層間打寶階段邏輯
 *
 * 職責：
 *   - generateLootPhase()：通關後生成 LootPhaseState
 *       · options 數量 = 1 + playerCount × 2（seed 鎖定）
 *       · picks 數量 = playerCount × 1 + bonus（boss/菁英/目標）
 *       · 為每個 FrozenItem 產生 LootHint
 *   - resolveVote()：need_greed 模式，所有玩家投完票後決定誰拿走
 *   - applyOpenOption()：玩家開箱，消耗 pick，標記 isOpened
 *   - computeHint()：從 FrozenItem + registry 推算 LootHint
 *
 * 設計原則：
 *   - 純函數，不做 I/O
 *   - rng 可注入（用於同 rarity 中隨機決勝）
 */

import type { LootPhaseState, LootOption, LootHint, LootVoteRecord, LootDistributionMode } from './state'
import type { FrozenItem, FrozenArmor } from './item'
import type { LootRegistry } from './loot'

// ─── 產生參數 ─────────────────────────────────────────────────────────────────

export type GenerateLootPhaseParams = {
  /** 本層通關後提供的 FrozenItem 選項（由 resolveLoot 預先 resolve）*/
  items: FrozenItem[]
  /** 玩家人數（決定 picks 基礎數量）*/
  playerCount: number
  /** 玩家 id 清單（round_robin 用）*/
  playerIds: string[]
  /** 本層金幣獎勵 */
  bonusGold: number
  /** 額外 picks 來源（boss_room / elite_bonus / objective）*/
  bonusPicks?: number
  bonusReasons?: string[]
  /** 分配模式 */
  distributionMode: LootDistributionMode
  /** 隊長 playerId（captain 模式）*/
  captainId?: string
  /** 道具庫（推算 hint 用）*/
  registry: LootRegistry
}

// ─── 主函數：生成 LootPhaseState ─────────────────────────────────────────────

/**
 * 層通關後，根據 FrozenItem 清單產生完整的 LootPhaseState。
 *
 * 呼叫方責任：
 *   - 依 playerCount 決定 items 數量（= 1 + playerCount × 2）
 *   - 傳入已 resolve 好的 FrozenItem[]（進層時 seed 鎖定）
 */
export function generateLootPhase(params: GenerateLootPhaseParams): LootPhaseState {
  const {
    items,
    playerCount,
    playerIds,
    bonusGold,
    bonusPicks = 0,
    bonusReasons = [],
    distributionMode,
    captainId = null,
    registry,
  } = params

  const picksRemaining = playerCount + bonusPicks

  const options: LootOption[] = items.map(item => ({
    instanceId: item.instanceId,
    item,
    hint: computeHint(item, registry),
    isOpened: false,
    takenByPlayerId: null,
  }))

  return {
    phase: 'selecting',
    options,
    picksRemaining,
    bonusGold,
    bonusReasons,
    currentVote: null,
    currentPickerId: distributionMode === 'round_robin' ? (playerIds[0] ?? null) : null,
    captainId: distributionMode === 'captain' ? captainId : null,
    awarded: Object.fromEntries(playerIds.map(id => [id, []])),
  }
}

// ─── computeHint ─────────────────────────────────────────────────────────────

/**
 * 從 FrozenItem + registry 推算 LootHint。
 * - rarity：物品中最高稀有度的詞條（沒有詞條時為 'common'）
 * - usableTags：從 ArmorBaseDef.requiredTags 取得
 */
export function computeHint(item: FrozenItem, registry: LootRegistry): LootHint {
  if (item.kind === 'armor') {
    const base = registry.armorBases.find(b => b.id === item.baseId)
    const rarity = highestRarityAmong(item.affixIds, registry)
    return {
      itemType: 'armor',
      slot: item.slot,
      rarity,
      usableTags: base?.requiredTags ?? [],
    }
  }

  // weapon（未來）
  return {
    itemType: 'weapon',
    rarity: highestRarityAmong(item.affixIds, registry),
    usableTags: [],
  }
}

// ─── applyOpenOption ─────────────────────────────────────────────────────────

/**
 * 玩家（或隊長）選擇開啟一個寶相：消耗 1 pick，標記 isOpened。
 *
 * free_for_all / captain / round_robin 模式下，picksRemaining 歸 0 前
 * 可直接 takenByPlayerId = playerId 並進入 awarded。
 *
 * need_greed 模式下，此函數只開啟寶相、建立 currentVote，
 * 等所有玩家投完後由 resolveVote() 決定誰拿走。
 *
 * @returns 更新後的 LootPhaseState（pure，不 mutate 輸入）
 */
export function applyOpenOption(
  state: LootPhaseState,
  instanceId: string,
  playerId: string,
  mode: LootDistributionMode,
  allPlayerIds: string[]
): LootPhaseState {
  if (state.picksRemaining <= 0) return state

  const optionIdx = state.options.findIndex(o => o.instanceId === instanceId && !o.isOpened)
  if (optionIdx === -1) return state

  const newOptions = state.options.map((o, i) =>
    i === optionIdx ? { ...o, isOpened: true } : o
  )
  const newPicksRemaining = state.picksRemaining - 1

  if (mode === 'need_greed') {
    // 建立投票記錄（votes 為空，等玩家逐一 SUBMIT_VOTE 填入）
    const vote: LootVoteRecord = {
      instanceId,
      votes: {},
      winnerId: null,
      isResolved: false,
    }
    return {
      ...state,
      options: newOptions,
      picksRemaining: newPicksRemaining,
      phase: 'voting',
      currentVote: vote,
    }
  }

  // free_for_all / captain / round_robin：直接分配給 playerId
  const item = state.options[optionIdx]!.item
  const newAwarded = {
    ...state.awarded,
    [playerId]: [...(state.awarded[playerId] ?? []), item],
  }

  // round_robin：輪到下一位
  const nextPicker = mode === 'round_robin'
    ? nextPlayerInRoundRobin(playerId, allPlayerIds)
    : state.currentPickerId

  const nextOptions = newOptions.map((o, i) =>
    i === optionIdx ? { ...o, takenByPlayerId: playerId } : o
  )

  return {
    ...state,
    options: nextOptions,
    picksRemaining: newPicksRemaining,
    awarded: newAwarded,
    currentPickerId: nextPicker,
    phase: newPicksRemaining <= 0 ? 'done' : 'selecting',
  }
}

// ─── resolveVote ─────────────────────────────────────────────────────────────

/**
 * need_greed 模式：所有玩家投完票後，決定誰獲得物品。
 *
 * 優先序：Need 投票者 > Greed 投票者 > 無人獲得。
 * 同優先序內隨機抽一位（由 rng 決定）。
 *
 * @returns 更新後的 LootPhaseState
 */
export function resolveVote(
  state: LootPhaseState,
  rng: () => number = Math.random
): LootPhaseState {
  const vote = state.currentVote
  if (!vote || vote.isResolved) return state

  const needers  = Object.entries(vote.votes).filter(([, v]) => v === 'need').map(([id]) => id)
  const greeders = Object.entries(vote.votes).filter(([, v]) => v === 'greed').map(([id]) => id)
  const pool     = needers.length > 0 ? needers : greeders

  const winnerId = pool.length > 0
    ? pool[Math.floor(rng() * pool.length)]!
    : null

  // 標記物品歸屬
  const newOptions = state.options.map(o =>
    o.instanceId === vote.instanceId ? { ...o, takenByPlayerId: winnerId } : o
  )

  // 若有贏家，加入 awarded
  const item = state.options.find(o => o.instanceId === vote.instanceId)?.item
  const newAwarded = winnerId && item
    ? { ...state.awarded, [winnerId]: [...(state.awarded[winnerId] ?? []), item] }
    : state.awarded

  const resolvedVote: LootVoteRecord = { ...vote, winnerId, isResolved: true }
  const newPicksRemaining = state.picksRemaining  // picks 在 applyOpenOption 時已扣

  return {
    ...state,
    options: newOptions,
    awarded: newAwarded,
    currentVote: resolvedVote,
    phase: newPicksRemaining <= 0 ? 'done' : 'selecting',
  }
}

// ─── 工具 ─────────────────────────────────────────────────────────────────────

const RARITY_LEVEL: Record<string, number> = { common: 0, rare: 1, elite: 2 }

function highestRarityAmong(
  affixIds: string[],
  registry: LootRegistry
): 'common' | 'rare' | 'elite' {
  let max = 0
  for (const id of affixIds) {
    const affix = registry.armorAffixes.find(a => a.id === id)
    if (affix) max = Math.max(max, RARITY_LEVEL[affix.rarity] ?? 0)
  }
  if (max >= 2) return 'elite'
  if (max >= 1) return 'rare'
  return 'common'
}

function nextPlayerInRoundRobin(currentId: string, allIds: string[]): string | null {
  const idx = allIds.indexOf(currentId)
  if (idx === -1 || allIds.length === 0) return null
  return allIds[(idx + 1) % allIds.length] ?? null
}

// Beast Conquest Engine — 卡牌定義與登錄表
// 從 data/ 層讀取並轉換為引擎格式

import { allLegions } from '../data/legions'
import { allLeaders } from '../data/leaders'
import { allReactions } from '../data/reactions'
import { allEvents } from '../data/events'
import type { LeaderInstance } from './state'

// ── 被動技能型別 ────────────────────────────────────

export type LeaderPassive =
  | { type: 'counter_damage';          value: number }   // 受攻擊時反擊 N 傷害
  | { type: 'damage_reduction';        value: number }   // 受到傷害 -N（最少 1）
  | { type: 'ignore_fortification' }                     // 移動無視築城
  | { type: 'double_move' }                              // 可連續移動 2 次
  | { type: 'attack_bonus_after_move'; value: number }   // 移動後攻擊 +N
  | { type: 'ally_support_buff';       value: number }   // 同區域友軍協助 +N（光環）
  | { type: 'ally_damage_reduction';   value: number }   // 同區域友軍受傷 -N（光環）
  | { type: 'enemy_attack_debuff';     value: number }   // 同區域敵首領攻擊 -N（光環）
  | { type: 'splash_damage';           value: number }   // 攻擊時對同區域其他敵首領造成 N 傷害
  | { type: 'on_ko_or_stun_draw';      value: number }   // 擊暈或擊殺敵首領時抽 N 張牌

export type LegionPassive =
  | { type: 'attack_bonus_if_leader_tag';           tag: string; value: number }
  | { type: 'support_bonus_if_leader_tag';          tag: string; value: number }
  | { type: 'damage_reduction_if_leader_tag';       tag: string; value: number }
  | { type: 'siege_damage_bonus';                   value: number }
  | { type: 'all_stats_if_leader_elemental';        tags: string[]; value: number }
  | { type: 'enemy_attack_debuff';                  value: number }   // 裝備者所在區域敵首領攻擊 -N

// ── 映射函式（data 層 → engine 層）────────────────────

function mapLeaderPassive(effect: { type: string; value?: number; tags?: string[] }): LeaderPassive | null {
  switch (effect.type) {
    case 'counter_damage':           return { type: 'counter_damage',          value: effect.value ?? 1 }
    case 'damage_reduction':         return { type: 'damage_reduction',        value: effect.value ?? 1 }
    case 'ignore_fortification':     return { type: 'ignore_fortification' }
    case 'double_move':              return { type: 'double_move' }
    case 'attack_bonus_after_move':  return { type: 'attack_bonus_after_move', value: effect.value ?? 1 }
    case 'ally_support_buff':        return { type: 'ally_support_buff',       value: effect.value ?? 1 }
    case 'ally_damage_reduction':    return { type: 'ally_damage_reduction',   value: effect.value ?? 1 }
    case 'enemy_attack_debuff':
    case 'enemy_attack_debuff_zone': return { type: 'enemy_attack_debuff',     value: effect.value ?? 1 }
    case 'splash_damage':            return { type: 'splash_damage',           value: effect.value ?? 1 }
    case 'on_ko_or_stun_draw':       return { type: 'on_ko_or_stun_draw',      value: effect.value ?? 1 }
    default: return null
  }
}

function mapLegionPassive(effect: { type: string; value?: number; tag?: string; tags?: string[] }): LegionPassive | null {
  switch (effect.type) {
    case 'attack_bonus_if_leader_has_tag':
      return effect.tag ? { type: 'attack_bonus_if_leader_tag', tag: effect.tag, value: effect.value ?? 1 } : null
    case 'support_bonus_if_leader_has_tag':
      return effect.tag ? { type: 'support_bonus_if_leader_tag', tag: effect.tag, value: effect.value ?? 1 } : null
    case 'damage_reduction_if_leader_has_tag':
      return effect.tag ? { type: 'damage_reduction_if_leader_tag', tag: effect.tag, value: effect.value ?? 1 } : null
    case 'siege_damage_bonus':
      return { type: 'siege_damage_bonus', value: effect.value ?? 1 }
    case 'all_stats_bonus_if_leader_has_elemental_tag':
      return { type: 'all_stats_if_leader_elemental', tags: effect.tags ?? ['fire', 'ice', 'lightning'], value: effect.value ?? 1 }
    case 'enemy_attack_debuff':
      return { type: 'enemy_attack_debuff', value: effect.value ?? 1 }
    default: return null
  }
}

// ── 事件卡定義 ─────────────────────────────────────

export type EventCardDef = {
  id: string
  name: string
  category: string
  cost: { discard: number }
}

// ── 軍團卡定義 ─────────────────────────────────────

export type LegionCardDef = {
  id: string
  name: string
  bonusToughness: number
  bonusAttack: number
  bonusSupport: number   // offensiveSupport（影響友軍攻擊協助）
  tags: string[]
  passive: LegionPassive | null
}

// 建立軍團卡登錄表（從 data/legions.ts）
const LEGION_REGISTRY: Record<string, LegionCardDef> = {}
for (const l of allLegions) {
  LEGION_REGISTRY[l.id] = {
    id: l.id,
    name: l.name,
    bonusToughness: l.bonusStats.toughness,
    bonusAttack: l.bonusStats.attack,
    bonusSupport: l.bonusStats.offensiveSupport,
    tags: l.tags,
    passive: mapLegionPassive(l.passive?.effect ?? { type: '' }),
  }
}

export function getLegionCard(id: string): LegionCardDef | undefined {
  return LEGION_REGISTRY[id]
}

export function allLegionIds(): string[] {
  return Object.keys(LEGION_REGISTRY)
}

/** 建立預設牌組（軍團卡各 2 張 + 全部戰術卡各 1 張 + 全部事件卡各 1 張，不含建築卡） */
export function makeDefaultDeck(rngSeed?: number): string[] {
  const deck: string[] = []
  for (const id of allLegionIds()) {
    deck.push(id, id)  // 每種 2 張
  }
  deck.push(...allTacticalIds())  // 戰術卡各 1 張
  deck.push(...allEventIds())     // 事件卡各 1 張
  return seededShuffle(deck, rngSeed ?? 42)
}

// ── 首領卡定義 ─────────────────────────────────────

export type LeaderCardDef = {
  id: string
  name: string
  baseToughness: number
  baseAttack: number
  baseSupport: number   // offensiveSupport
  reviveTime: 1 | 2 | 3
  legionSlots: number
  tags: string[]
  leaderClass: string
  passive: LeaderPassive | null
}

// 建立首領卡登錄表（從 data/leaders.ts）
const LEADER_REGISTRY: Record<string, LeaderCardDef> = {}
for (const l of allLeaders) {
  LEADER_REGISTRY[l.id] = {
    id: l.id,
    name: l.name,
    baseToughness: l.baseToughness,
    baseAttack: l.baseAttack,
    baseSupport: l.baseOffensiveSupport,
    reviveTime: resolveReviveTime(l.class),
    legionSlots: 2,
    tags: l.tags,
    leaderClass: l.class,
    passive: mapLeaderPassive(l.passive?.effect ?? { type: '' }),
  }
}

export function getLeaderCard(id: string): LeaderCardDef | undefined {
  return LEADER_REGISTRY[id]
}

export function allLeaderIds(): string[] {
  return Object.keys(LEADER_REGISTRY)
}

/** 每種職業隨機選 1 位首領（4 位），用 seed 保證可重現（選 3 位首領） */
export function randomLeaderSelection(seed: number): string[] {
  const classes = ['destroyer', 'conqueror', 'commander', 'guardian'] as const
  const byClass: Record<string, string[]> = { destroyer: [], conqueror: [], commander: [], guardian: [] }
  for (const [id, card] of Object.entries(LEADER_REGISTRY)) {
    if (byClass[card.leaderClass]) byClass[card.leaderClass].push(id)
  }
  let s = seed >>> 0
  const result: string[] = []
  // Pick 3 leaders (one per class, up to 3)
  const selectedClasses = classes.slice(0, 3)
  for (const cls of selectedClasses) {
    const pool = byClass[cls]
    if (pool.length === 0) continue
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    result.push(pool[s % pool.length])
  }
  return result
}

/** 根據職業決定復活時間 */
function resolveReviveTime(cls: string): 1 | 2 | 3 {
  if (cls === 'guardian') return 1  // 守護者快速復活
  if (cls === 'destroyer') return 3  // 破壞者慢速復活
  return 2  // 征服者 / 指揮官
}

// ── 被動技能查詢輔助 ────────────────────────────────

/** 取得首領實例的被動（null = 無效果） */
export function getLeaderPassive(leader: LeaderInstance): LeaderPassive | null {
  if (!leader.cardId) return null
  return LEADER_REGISTRY[leader.cardId]?.passive ?? null
}

/** 取得首領所有已裝備軍團的被動列表 */
export function getLegionPassives(leader: LeaderInstance): LegionPassive[] {
  return leader.legions
    .map((cardId) => LEGION_REGISTRY[cardId]?.passive)
    .filter((p): p is LegionPassive => p != null)
}

// ── 戰術卡定義 ─────────────────────────────────────

export type TacticalTrigger =
  | 'on_receive_damage'
  | 'on_ko'
  | 'on_stunned'
  | 'on_enemy_enter_zone'
  | 'on_enemy_clear_brick'

export type TacticalCardDef = {
  id: string
  name: string
  trigger: TacticalTrigger
  suitableClass: string[]
}

const TACTICAL_REGISTRY: Record<string, TacticalCardDef> = {}
for (const r of allReactions) {
  TACTICAL_REGISTRY[r.id] = {
    id: r.id,
    name: r.name,
    trigger: r.trigger.timing as TacticalTrigger,
    suitableClass: r.suitableClass,
  }
}

export function getTacticalCard(id: string): TacticalCardDef | undefined {
  return TACTICAL_REGISTRY[id]
}

export function allTacticalIds(): string[] {
  return Object.keys(TACTICAL_REGISTRY)
}

// ── 事件卡登錄表 ──────────────────────────────────

const EVENT_REGISTRY: Record<string, EventCardDef> = {}
for (const e of allEvents) {
  EVENT_REGISTRY[e.id] = {
    id: e.id,
    name: e.name,
    category: e.category,
    cost: e.cost,
  }
}

export function getEventCard(id: string): EventCardDef | undefined {
  return EVENT_REGISTRY[id]
}

export function allEventIds(): string[] {
  return Object.keys(EVENT_REGISTRY)
}

// ── RNG 工具 ──────────────────────────────────────

export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const shuffled = [...arr]
  let s = seed >>> 0
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    const j = s % (i + 1)
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

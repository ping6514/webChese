// Beast Conquest Engine — 遊戲狀態（3-zone redesign）

import type { PlayerId, ZoneId, Phase, LeaderState } from './types'
import { lairZone } from './types'
import { seededShuffle, makeDefaultDeck, randomLeaderSelection, getLeaderCard } from './cards'

// ── 玩家手牌狀態 ──────────────────────────────────

export type PlayerState = {
  hand: string[]       // 手牌中的卡 ID
  deck: string[]       // 牌組（頂部 = 第一個元素）
  graveyard: string[]  // 墓地（打出/棄置的卡）
  normalSummonUsed: boolean  // 本回合一般召喚是否已使用
}

// ── 首領實例 ──────────────────────────────────────

export type LeaderInstance = {
  id: string
  name: string
  owner: PlayerId
  zone: ZoneId
  state: LeaderState

  // 基礎屬性（來自首領卡定義）
  baseToughness: number
  baseAttack: number
  baseSupport: number

  // 軍團加成（從已附加軍團卡加總）
  bonusToughness: number
  bonusAttack: number
  bonusSupport: number

  // 已附加軍團卡 ID 列表
  legions: string[]
  legionSlots: number   // 最多可附加數量

  // KO 狀態追蹤
  koTurnCount: number
  reviveTime: 1 | 2 | 3

  // 技能冷卻
  skillCooldown: number

  // 行動旗標
  moveCount: number   // 本 battle 階段移動次數（0=未移動）

  // 首領卡 ID 與標籤（被動查詢用）
  cardId: string | null
  tags: string[]

  // 首領職業
  leaderClass: string

  // 戰術卡（react 階段安裝，事件觸發時自動使用）
  tacticalCard: string | null

  // 禁錮狀態（事件/技能設置，準備階段清除）
  immobilized: boolean
}

// 計算總屬性
export function totalToughness(l: LeaderInstance): number {
  return l.baseToughness + l.bonusToughness
}
export function totalAttack(l: LeaderInstance): number {
  return l.baseAttack + l.bonusAttack
}
export function totalSupport(l: LeaderInstance): number {
  return l.baseSupport + l.bonusSupport
}

// ── 區域 ──────────────────────────────────────────

export type Zone = {
  id: ZoneId
  fortLevel: number    // 0-2，基地才有城堡；plaza=0。fort>0 阻止敵方進入
  cityWalls: number    // 0-3，基地的城牆HP；plaza=0。勝利條件
}

export type PlayerTurnFlags = {
  battle_cry: boolean      // 本回合攻擊+2、清磚+1
  divine_blessing: boolean // 本回合受傷-1
}

// ── 遊戲狀態 ──────────────────────────────────────

export type GameState = {
  turn: number
  phase: Phase
  currentPlayer: PlayerId

  zones: Record<ZoneId, Zone>
  leaders: Record<string, LeaderInstance>
  players: Record<PlayerId, PlayerState>

  actedLeaders: string[]   // 本 battle 階段已行動過的首領 ID 列表

  rngSeed: number   // 用於洗牌等隨機操作

  turnFlags: Record<PlayerId, PlayerTurnFlags>

  winner: PlayerId | null
  winReason: string | null
}

// ── 初始設定 ──────────────────────────────────────

export type LeaderConfig = {
  id?: string          // 首領卡 ID（使用 allLeaders 資料）
  name?: string        // 自訂名稱（不使用卡 ID 時）
  baseToughness?: number
  baseAttack?: number
  baseSupport?: number
  reviveTime?: 1 | 2 | 3
  legionSlots?: number
}

export type GameConfig = {
  p1Leaders?: LeaderConfig[]
  p2Leaders?: LeaderConfig[]
  p1Deck?: string[]    // 卡 ID 列表
  p2Deck?: string[]
  rngSeed?: number
}


export function createInitialState(config?: GameConfig): GameState {
  const seed = config?.rngSeed ?? 42

  // 首領選擇：優先使用 config，否則每種職業各隨機 1 位（seed 不同保證 P1/P2 選法獨立）
  const p1LeaderConfigs = config?.p1Leaders ?? randomLeaderSelection(seed).map((id) => ({ id }))
  const p2LeaderConfigs = config?.p2Leaders ?? randomLeaderSelection(seed + 7919).map((id) => ({ id }))

  const leaders: Record<string, LeaderInstance> = {}
  for (const [i, cfg] of p1LeaderConfigs.entries()) {
    const id = `p1_${i}`
    leaders[id] = makeLeaderInstance(id, cfg, 'p1', lairZone('p1'))
  }
  for (const [i, cfg] of p2LeaderConfigs.entries()) {
    const id = `p2_${i}`
    leaders[id] = makeLeaderInstance(id, cfg, 'p2', lairZone('p2'))
  }

  const p1Deck = config?.p1Deck ?? makeDefaultDeck(seed)
  const p2Deck = config?.p2Deck ?? makeDefaultDeck(seed + 1)

  // P1 先攻：準備階段已自動執行，先拿 2 張牌
  const p1InitHand: string[] = []
  const p1DeckTemp = [...p1Deck]
  for (let i = 0; i < 2; i++) {
    if (p1DeckTemp.length > 0) p1InitHand.push(p1DeckTemp.shift()!)
  }

  // P2 後攻補償：先拿 3 張牌（compensation for going second）
  const p2InitHand: string[] = []
  const p2DeckTemp = [...p2Deck]
  for (let i = 0; i < 3; i++) {
    if (p2DeckTemp.length > 0) p2InitHand.push(p2DeckTemp.shift()!)
  }

  const players: Record<PlayerId, PlayerState> = {
    p1: { hand: p1InitHand, deck: p1DeckTemp, graveyard: [], normalSummonUsed: false },
    p2: { hand: p2InitHand, deck: p2DeckTemp, graveyard: [], normalSummonUsed: false },
  }

  // P1 starts in main phase (preparation has already run for P1 at game start)
  // actedLeaders will be reset when battle phase starts
  return {
    turn: 1,
    phase: 'main',
    currentPlayer: 'p1',
    zones: {
      p1_base: { id: 'p1_base', fortLevel: 3, cityWalls: 3 },
      plaza:   { id: 'plaza',   fortLevel: 0, cityWalls: 0 },
      p2_base: { id: 'p2_base', fortLevel: 4, cityWalls: 4 },
    },
    leaders,
    players,
    actedLeaders: [],
    rngSeed: seed,
    turnFlags: {
      p1: { battle_cry: false, divine_blessing: false },
      p2: { battle_cry: false, divine_blessing: false },
    },
    winner: null,
    winReason: null,
  }
}

function makeLeaderInstance(
  id: string,
  cfg: LeaderConfig,
  owner: PlayerId,
  zone: ZoneId
): LeaderInstance {
  // 優先從卡牌資料讀取
  if (cfg.id) {
    const card = getLeaderCard(cfg.id)
    if (card) {
      return {
        id,
        name: card.name,
        owner,
        zone,
        state: 'normal',
        baseToughness: card.baseToughness,
        baseAttack: card.baseAttack,
        baseSupport: card.baseSupport,
        bonusToughness: 0,
        bonusAttack: 0,
        bonusSupport: 0,
        legions: [],
        legionSlots: card.legionSlots,
        koTurnCount: 0,
        reviveTime: card.reviveTime,
        skillCooldown: 0,
        moveCount: 0,
        cardId: cfg.id,
        tags: card.tags,
        leaderClass: card.leaderClass,
        tacticalCard: null,
        immobilized: false,
      }
    }
  }

  // fallback：使用直接數值
  return {
    id,
    name: cfg.name ?? `首領 ${id}`,
    owner,
    zone,
    state: 'normal',
    baseToughness: cfg.baseToughness ?? 5,
    baseAttack: cfg.baseAttack ?? 3,
    baseSupport: cfg.baseSupport ?? 1,
    bonusToughness: 0,
    bonusAttack: 0,
    bonusSupport: 0,
    legions: [],
    legionSlots: cfg.legionSlots ?? 2,
    koTurnCount: 0,
    reviveTime: cfg.reviveTime ?? 2,
    skillCooldown: 0,
    moveCount: 0,
    cardId: null,
    tags: [],
    leaderClass: 'unknown',
    tacticalCard: null,
    immobilized: false,
  }
}

// ── 牌組操作工具 ──────────────────────────────────

/** 從牌組頂部抽牌（deck 陣列前端 = 頂部） */
export function drawCard(ps: PlayerState): string | null {
  if (ps.deck.length === 0) return null
  const card = ps.deck.shift()!
  ps.hand.push(card)
  return card
}

/** 牌組耗盡時洗回墓地 */
export function reshuffleGraveyard(ps: PlayerState, seed: number): void {
  ps.deck = seededShuffle([...ps.graveyard], seed)
  ps.graveyard = []
}

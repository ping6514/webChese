import type { Phase, PieceBase, Pos, Side } from './types'
import { listSoulCards } from './cards'
import { listItemDeckIds } from './items'
import { DEFAULT_CONFIG, type GameConfig, type GameRules } from './gameConfig'
import { createRngState, shuffle, type RngState } from '../serverSim'

export type StatKey = string

export type KeyValueStat = {
  key: StatKey
  value: number
}

export type Unit = {
  id: string
  side: Side
  base: PieceBase
  pos: Pos
  hpCurrent: number
  atk: {
    key: StatKey
    value: number
  }
  def: KeyValueStat[]
  enchant?: {
    soulId: string
  }
}

export type Resources = {
  gold: number
  mana: number
  storageMana: number
}

export type HandState = {
  souls: string[]
  items: string[]
}

export type CorpseEntry = {
  ownerSide: Side
  base: PieceBase
}

export type GameState = {
  units: Record<string, Unit>
  corpsesByPos: Record<string, CorpseEntry[]>
  graveyard: Record<Side, string[]>
  rngState: RngState | null
  soulDeckByBase: Partial<Record<PieceBase, string[]>>
  displayByBase: Partial<Record<PieceBase, string | null>>
  itemDeck: string[]
  itemDisplay: Array<string | null>
  itemDiscard: string[]
  turn: {
    side: Side
    phase: Phase
  }
  status: {
    kingInvincibleSide: Side | null
    sacrificeBuffByUnitId: Record<
      string,
      {
        ignoreBlockingAll?: true
        chainRadius?: number
        damageBonusPerCorpsesCap?: number
      }
    >
  }
  turnFlags: {
    shotUsed: Record<string, true>
    movedThisTurn: Record<string, true>
    soulReturnUsedCount: number
    abilityUsed: Record<string, number>
    soulBuyUsed: boolean
    buySoulActionsUsed: number
    buyItemActionsUsed: number
    necroActionsUsed: number
    bloodRitualUsed: boolean
    necroBonusActions: number
    freeShootBonus: number
    enchantGoldDiscount: number
    itemNecroBonus: number
    lastStandContractBonus: number
    lastStandNoEnchantUnitIds: string[]
    darkMoonScopeActive: boolean
  }
  hands: Record<Side, HandState>
  resources: Record<Side, Resources>
  limits: {
    manaMax: number
    storageManaMax: number
    goldMax: number
    soulHandMax: number
    itemHandMax: number
    buySoulActionsPerTurn: number
    buyItemActionsPerTurn: number
    necroActionsPerTurn: number
    soulReturnPerTurn: number
  }
  rules: GameRules
}

export const BASE_STATS: Record<PieceBase, { hp: number; atkKey: StatKey; atk: number; def: KeyValueStat[] }> = {
  king: { hp: 15, atkKey: 'phys', atk: 1, def: [{ key: 'phys', value: 2 }, { key: 'magic', value: 2 }] },
  advisor: { hp: 10, atkKey: 'phys', atk: 1, def: [{ key: 'phys', value: 1 }, { key: 'magic', value: 1 }] },
  elephant: { hp: 10, atkKey: 'phys', atk: 1, def: [{ key: 'phys', value: 1 }, { key: 'magic', value: 1 }] },
  rook: { hp: 10, atkKey: 'phys', atk: 2, def: [{ key: 'phys', value: 1 }, { key: 'magic', value: 0 }] },
  knight: { hp: 10, atkKey: 'phys', atk: 2, def: [{ key: 'phys', value: 1 }, { key: 'magic', value: 0 }] },
  cannon: { hp: 10, atkKey: 'phys', atk: 2, def: [{ key: 'phys', value: 0 }, { key: 'magic', value: 1 }] },
  soldier: { hp: 8, atkKey: 'phys', atk: 1, def: [{ key: 'phys', value: 0 }, { key: 'magic', value: 0 }] },
}

export const REVIVE_GOLD_COST_BY_BASE: Record<PieceBase, number> = {
  king: 999,
  advisor: 3,
  elephant: 3,
  rook: 5,
  knight: 4,
  cannon: 5,
  soldier: 2,
}

export function getReviveGoldCost(base: PieceBase): number {
  return REVIVE_GOLD_COST_BY_BASE[base] ?? 3
}

function makeUnitId(side: Side, base: PieceBase, index: number): string {
  return `${side}:${base}:${index}`
}

function makeUnitsForSide(side: Side): Unit[] {
  const backRankY = side === 'red' ? 9 : 0
  const cannonY = side === 'red' ? 7 : 2
  const soldierY = side === 'red' ? 6 : 3

  const units: Unit[] = []

  const add = (base: PieceBase, x: number, y: number, index: number) => {
    const s = BASE_STATS[base]
    units.push({
      id: makeUnitId(side, base, index),
      side,
      base,
      pos: { x, y },
      hpCurrent: s.hp,
      atk: {
        key: s.atkKey,
        value: s.atk,
      },
      def: s.def.map((d) => ({ ...d })),
    })
  }

  add('rook', 0, backRankY, 0)
  add('knight', 1, backRankY, 0)
  add('elephant', 2, backRankY, 0)
  add('advisor', 3, backRankY, 0)
  add('king', 4, backRankY, 0)
  add('advisor', 5, backRankY, 1)
  add('elephant', 6, backRankY, 1)
  add('knight', 7, backRankY, 1)
  add('rook', 8, backRankY, 1)

  add('cannon', 1, cannonY, 0)
  add('cannon', 7, cannonY, 1)

  add('soldier', 0, soldierY, 0)
  add('soldier', 2, soldierY, 1)
  add('soldier', 4, soldierY, 2)
  add('soldier', 6, soldierY, 3)
  add('soldier', 8, soldierY, 4)

  return units
}

export function createInitialState(config?: Partial<GameConfig>): GameState {
  const unitsArr = [...makeUnitsForSide('red'), ...makeUnitsForSide('black')]
  const units: Record<string, Unit> = Object.fromEntries(unitsArr.map((u) => [u.id, u]))

  const merged: GameConfig = {
    limits: {
      ...DEFAULT_CONFIG.limits,
      ...(config?.limits ?? {}),
    },
    rules: {
      ...DEFAULT_CONFIG.rules,
      ...(config?.rules ?? {}),
    },
    phaseActionLimits: {
      ...DEFAULT_CONFIG.phaseActionLimits,
      ...(config?.phaseActionLimits ?? {}),
    },
  }

  const limits = {
    ...merged.limits,
    ...merged.phaseActionLimits,
  }

  const rules = merged.rules

  const rngState: RngState | null = rules.rngMode === 'seeded' ? createRngState(String(rules.matchSeed ?? 'default')) : null

  const firstSide: Side = rules.firstSide === 'black' ? 'black' : 'red'

  const firstStart: Resources = {
    gold: rules.startGoldFirst,
    mana: rules.startMana,
    storageMana: 0,
  }

  const secondStart: Resources = {
    gold: rules.startGoldSecond,
    // 後手方第一個回合會經過 autoTurnStart（+incomeMana），所以初始 mana=0
    // 避免後手第一回合 mana = startMana + incomeMana（即 6）的 bug
    mana: 0,
    storageMana: 0,
  }

  const redStart: Resources = firstSide === 'red' ? firstStart : secondStart
  const blackStart: Resources = firstSide === 'black' ? firstStart : secondStart

  const bases: PieceBase[] = ['king', 'advisor', 'elephant', 'rook', 'knight', 'cannon', 'soldier']
  const deckByBase: Partial<Record<PieceBase, string[]>> = {}
  const displayByBase: Partial<Record<PieceBase, string | null>> = {}

  const enabled = Array.isArray((rules as any).enabledClans) ? (rules as any).enabledClans.map(String) : []
  const enabledSet = enabled.length > 0 ? new Set(enabled) : null
  const all = listSoulCards()
    .filter((c) => !enabledSet || enabledSet.has(String((c as any).clan ?? '')))
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
  for (const b of bases) {
    const deck = all.filter((c) => c.base === b).map((c) => c.id)
    deckByBase[b] = rngState ? shuffle(deck, rngState) : deck
    displayByBase[b] = null
  }

  // Fill display (one face-up card per base if available)
  for (const b of bases) {
    const deck = deckByBase[b] ?? []
    if (deck.length > 0) {
      displayByBase[b] = deck.shift() ?? null
      deckByBase[b] = deck
    }
  }

  const itemDeck = (() => {
    const base = listItemDeckIds()
    return rngState ? shuffle(base, rngState) : base
  })()

  const itemDisplay: Array<string | null> = [null, null, null]
  for (let i = 0; i < itemDisplay.length; i++) {
    itemDisplay[i] = itemDeck.shift() ?? null
  }

  return {
    units,
    corpsesByPos: {},
    graveyard: {
      red: [],
      black: [],
    },
    rngState,
    soulDeckByBase: deckByBase,
    displayByBase,
    itemDeck,
    itemDisplay,
    itemDiscard: [],
    turn: {
      side: firstSide,
      phase: 'buy',
    },
    status: {
      kingInvincibleSide: null,
      sacrificeBuffByUnitId: {},
    },
    turnFlags: {
      shotUsed: {},
      movedThisTurn: {},
      soulReturnUsedCount: 0,
      abilityUsed: {},
      soulBuyUsed: false,
      buySoulActionsUsed: 0,
      buyItemActionsUsed: 0,
      necroActionsUsed: 0,
      bloodRitualUsed: false,
      necroBonusActions: 0,
      freeShootBonus: 0,
      enchantGoldDiscount: 0,
      itemNecroBonus: 0,
      lastStandContractBonus: 0,
      lastStandNoEnchantUnitIds: [],
      darkMoonScopeActive: false,
    },
    hands: {
      red: { souls: [], items: [] },
      black: { souls: [], items: [] },
    },
    resources: {
      red: redStart,
      black: blackStart,
    },
    limits,
    rules,
  }
}

export function getUnitAt(state: GameState, pos: Pos): Unit | undefined {
  for (const unit of Object.values(state.units)) {
    if (unit.pos.x === pos.x && unit.pos.y === pos.y) return unit
  }
  return undefined
}

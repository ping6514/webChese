import type { Phase, PieceBase, Pos, Side } from './types'

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

export type GameState = {
  units: Record<string, Unit>
  turn: {
    side: Side
    phase: Phase
  }
  turnFlags: {
    shotUsed: Record<string, true>
  }
  hands: Record<Side, HandState>
  resources: Record<Side, Resources>
  limits: {
    manaMax: number
    storageManaMax: number
    goldMax: number
  }
  rules: {
    incomeGold: number
    incomeMana: number
    storageToGoldRate: number
    moveManaCost: number
    shootManaCost: number
    diceFixed: number
  }
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

export function createInitialState(): GameState {
  const unitsArr = [...makeUnitsForSide('red'), ...makeUnitsForSide('black')]
  const units: Record<string, Unit> = Object.fromEntries(unitsArr.map((u) => [u.id, u]))

  const limits = {
    manaMax: 999,
    storageManaMax: 5,
    goldMax: 15,
  }

  const rules = {
    incomeGold: 4,
    incomeMana: 3,
    storageToGoldRate: 2,
    moveManaCost: 1,
    shootManaCost: 1,
    diceFixed: 3,
  }

  const redStart: Resources = {
    gold: 999,
    mana: 999,
    storageMana: 0,
  }

  const blackStart: Resources = {
    gold: 999,
    mana: 999,
    storageMana: 0,
  }

  // No hand limit for now: both players start with all souls available.
  // Loaded elsewhere into registry; keep ids as strings.
  const allSoulIds: string[] = [
    'dark_moon_rook_lanhua',
    'dark_moon_rook_yinghua',
    'dark_moon_knight_yingzi',
    'dark_moon_knight_wuying',
    'dark_moon_cannon_yehua',
    'dark_moon_cannon_fenghua',
    'dark_moon_advisor_yeji',
    'dark_moon_advisor_yingji',
    'dark_moon_elephant_yueji',
    'dark_moon_elephant_youji'
  ]

  return {
    units,
    turn: {
      side: 'red',
      phase: 'buy',
    },
    turnFlags: {
      shotUsed: {},
    },
    hands: {
      red: { souls: [...allSoulIds], items: [] },
      black: { souls: [...allSoulIds], items: [] },
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

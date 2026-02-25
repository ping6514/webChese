export type GameLimits = {
  manaMax: number
  storageManaMax: number
  goldMax: number
  soulHandMax: number
  itemHandMax: number
}

export type GameRules = {
  incomeGold: number
  incomeMana: number
  storageToGoldRate: number
  reviveGoldCost: number
  buySoulFromDeckGoldCost: number
  buySoulFromDisplayGoldCost: number
  buySoulFromEnemyGraveyardGoldCost: number
  moveManaCost: number
  shootManaCost: number
  diceFixed: number
  rngMode: 'fixed' | 'seeded'
  matchSeed: string
  enabledClans: string[]
}

export type PhaseActionLimits = {
  buySoulActionsPerTurn: number
  buyItemActionsPerTurn: number
  necroActionsPerTurn: number
  soulReturnPerTurn: number
}

export type GameConfig = {
  limits: GameLimits
  rules: GameRules
  phaseActionLimits: PhaseActionLimits
}

export const DEFAULT_LIMITS: GameLimits = {
  manaMax: 999,
  storageManaMax: 5,
  goldMax: 15,
  soulHandMax: 5,
  itemHandMax: 3,
}

export const DEFAULT_RULES: GameRules = {
  incomeGold: 4,
  incomeMana: 3,
  storageToGoldRate: 2,
  reviveGoldCost: 3,
  buySoulFromDeckGoldCost: 1,
  buySoulFromDisplayGoldCost: 2,
  buySoulFromEnemyGraveyardGoldCost: 3,
  moveManaCost: 1,
  shootManaCost: 1,
  diceFixed: 3,
  rngMode: 'seeded',
  matchSeed: 'default',
  enabledClans: ['dark_moon', 'styx', 'eternal_night'],
}

export const DEFAULT_PHASE_ACTION_LIMITS: PhaseActionLimits = {
  buySoulActionsPerTurn: 1,
  buyItemActionsPerTurn: 1,
  necroActionsPerTurn: 1,
  soulReturnPerTurn: 1,
}

export const DEFAULT_CONFIG: GameConfig = {
  limits: DEFAULT_LIMITS,
  rules: DEFAULT_RULES,
  phaseActionLimits: DEFAULT_PHASE_ACTION_LIMITS,
}

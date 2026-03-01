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

  firstSide: 'red' | 'black'
  startGoldFirst: number
  startGoldSecond: number
  startMana: number

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

  firstSide: 'red',
  startGoldFirst: 4,
  startGoldSecond: 7,
  startMana: 3,

  reviveGoldCost: 3,
  buySoulFromDeckGoldCost: 1,
  buySoulFromDisplayGoldCost: 2,
  buySoulFromEnemyGraveyardGoldCost: 3,
  moveManaCost: 1,
  shootManaCost: 1,
  diceFixed: 3,
  rngMode: 'seeded',
  // 每次啟動使用不同隨機種子，確保牌組順序每局不同
  matchSeed: String(Date.now()),
  enabledClans: ['dark_moon', 'styx', 'eternal_night', 'iron_guard'],
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

// ── 魔法常數（散落在引擎各處的硬編碼數值）──────────────────────────────────

/** 免費射擊時暫時賦予的超高魔力哨兵值，確保魔力消耗檢查通過 */
export const FREE_SHOOT_MANA_SENTINEL = 9999

/** 靈血聖杯道具每次回血量 */
export const HOLY_GRAIL_HEAL_AMOUNT = 4

/** 死亡連鎖每回合最多觸發次數 */
export const DEATH_CHAIN_MAX_KILLS = 3

/** 射擊 instance 的執行優先度 map（數字小的先執行） */
export const SHOT_INSTANCE_PRIORITY: Record<string, number> = {
  direct: 0,
  chain: 1,
  splash: 2,
  pierce: 3,
  counter: 4,
}

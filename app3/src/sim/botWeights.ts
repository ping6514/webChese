// Beast Conquest — Bot 評分權重
// BASE_WEIGHTS：手動調整的基準
// DYNAMIC_WEIGHTS：由 training.ts 自動訓練更新

export type BotWeights = {
  harvest: number
  lairSiege: number
  attackKo: number
  attackStun: number
  fortBreak: number
  fortProgress: number
  moveAdvance: number
  skill: number
}

export const BASE_WEIGHTS: BotWeights = {
  harvest: 1.0,
  lairSiege: 1.0,
  attackKo: 1.0,
  attackStun: 1.0,
  fortBreak: 1.0,
  fortProgress: 1.0,
  moveAdvance: 1.0,
  skill: 1.0,
}

// 由訓練腳本更新（2026-03-22）
export const DYNAMIC_WEIGHTS: BotWeights = {
  "harvest": 0.7,
  "lairSiege": 1,
  "attackKo": 1,
  "attackStun": 0.91,
  "fortBreak": 0.91,
  "fortProgress": 1,
  "moveAdvance": 0.91,
  "skill": 0.637
}

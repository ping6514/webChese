// 軍團卡資料匯出

import { dragonLegions } from './dragon'
import { harpyLegions } from './harpy'
import { lamiaLegions } from './lamia'
import { slimeLegions } from './slime'
import { centaurLegions } from './centaur'
import { aquaticLegions } from './aquatic'
import type { LegionCard } from '../../types'

// 匯出所有軍團卡（30 張）
export const allLegions: LegionCard[] = [
  ...dragonLegions,
  ...harpyLegions,
  ...lamiaLegions,
  ...slimeLegions,
  ...centaurLegions,
  ...aquaticLegions
]

// 按種族分類
export const legionsByRace = {
  dragon: dragonLegions,
  harpy: harpyLegions,
  lamia: lamiaLegions,
  slime: slimeLegions,
  centaur: centaurLegions,
  aquatic: aquaticLegions
}

// 按等級分類
export const legionsByRank = {
  normal: allLegions.filter(l => l.rank === 'normal'),
  elite: allLegions.filter(l => l.rank === 'elite'),
  legendary: allLegions.filter(l => l.rank === 'legendary')
}

// 工具函數：根據 ID 查找軍團卡
export function getLegionById(id: string): LegionCard | undefined {
  return allLegions.find(legion => legion.id === id)
}

// 工具函數：根據種族和類型查找軍團卡
export function getLegionsByRaceAndType(race: string, type: string): LegionCard[] {
  return allLegions.filter(legion => legion.race === race && legion.type === type)
}

// 工具函數：根據 Tags 查找軍團卡
export function getLegionsByTag(tag: string): LegionCard[] {
  return allLegions.filter(legion => legion.tags.includes(tag as any))
}

export {
  dragonLegions,
  harpyLegions,
  lamiaLegions,
  slimeLegions,
  centaurLegions,
  aquaticLegions
}

// 首領卡資料匯出

import { dragonLeaders } from './dragon'
import { harpyLeaders } from './harpy'
import { lamiaLeaders } from './lamia'
import { slimeLeaders } from './slime'
import { centaurLeaders } from './centaur'
import { aquaticLeaders } from './aquatic'
import type { LeaderCard } from '../../types'

// 匯出所有首領卡
export const allLeaders: LeaderCard[] = [
  ...dragonLeaders,
  ...harpyLeaders,
  ...lamiaLeaders,
  ...slimeLeaders,
  ...centaurLeaders,
  ...aquaticLeaders
]

// 按種族分類
export const leadersByRace = {
  dragon: dragonLeaders,
  harpy: harpyLeaders,
  lamia: lamiaLeaders,
  slime: slimeLeaders,
  centaur: centaurLeaders,
  aquatic: aquaticLeaders
}

// 按職業分類
export const leadersByClass = {
  destroyer: allLeaders.filter(l => l.class === 'destroyer'),
  conqueror: allLeaders.filter(l => l.class === 'conqueror'),
  commander: allLeaders.filter(l => l.class === 'commander'),
  guardian: allLeaders.filter(l => l.class === 'guardian')
}

// 工具函數：根據 ID 查找首領卡
export function getLeaderById(id: string): LeaderCard | undefined {
  return allLeaders.find(leader => leader.id === id)
}

// 工具函數：根據種族和職業查找首領卡
export function getLeaderByRaceAndClass(race: string, className: string): LeaderCard | undefined {
  return allLeaders.find(leader => leader.race === race && leader.class === className)
}

export {
  dragonLeaders,
  harpyLeaders,
  lamiaLeaders,
  slimeLeaders,
  centaurLeaders,
  aquaticLeaders
}

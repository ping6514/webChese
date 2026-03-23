// 建築卡資料
// 特色：獨立堅韌度、代價系統、放置條件、地利效果、破壞效果

import type { BuildingCard } from '../../app3/src/types'

export const allBuildings: BuildingCard[] = [
  // ==================== 防禦型 ====================
  
  // 1. 元素祭壇
  {
    id: 'building_001',
    name: '元素祭壇',
    category: 'defense',
    
    durability: 2,
    
    cost: {
      discardCount: 1
    },
    
    placementCondition: {
      myFortification: {
        min: 1
      }
    },
    
    placement: ['my_base', 'my_battlefield'],
    
    tagRequirement: {
      myTags: ['elemental'],
      condition: 'any'
    },
    
    areaEffect: {
      name: '元素共鳴',
      description: '區域內所有 elemental tag 首領堅韌+2',
      effect: {
        type: 'toughness_bonus',
        value: 2,
        target: 'zone_elemental_allies',
        tags: ['elemental'],
        duration: 'permanent',
        description: '區域內 elemental tag 首領堅韌+2'
      },
      target: 'ally'
    },
    
    onDestroy: {
      type: 'heal_all',
      value: 1,
      target: 'all_allies',
      duration: 'instant',
      description: '所有我方首領堅韌+1'
    },
    
    description: '元素之力匯聚的祭壇，提升元素首領的防禦。',
    flavor: '元素的力量在此凝聚。'
  },

  // 2. 石牆要塞
  {
    id: 'building_002',
    name: '石牆要塞',
    category: 'defense',
    
    durability: 3,
    
    cost: {
      discardCount: 2
    },
    
    placementCondition: {
      myFortification: {
        min: 2
      }
    },
    
    placement: ['my_base'],
    
    areaEffect: {
      name: '堅固防禦',
      description: '區域內所有我方首領受到傷害-1',
      effect: {
        type: 'damage_reduction',
        value: 1,
        target: 'zone_all_allies',
        duration: 'permanent',
        description: '區域內我方首領受到傷害-1'
      },
      target: 'ally'
    },
    
    onDestroy: {
      type: 'build_fortification',
      value: 1,
      target: 'my_base',
      duration: 'instant',
      description: '我方基地築城計數器+1'
    },
    
    description: '堅固的石牆要塞，提供強大的防禦。',
    flavor: '堅如磐石的防線。'
  },

  // 3. 龍族聖殿
  {
    id: 'building_003',
    name: '龍族聖殿',
    category: 'defense',
    
    durability: 2,
    
    cost: {
      discardCount: 1,
      fortificationCost: 1
    },
    
    placement: ['my_base', 'my_battlefield'],
    
    tagRequirement: {
      myTags: ['dragon'],
      condition: 'any'
    },
    
    areaEffect: {
      name: '龍族庇護',
      description: '區域內所有 dragon tag 首領堅韌+1，對敵+1',
      effect: {
        type: 'all_stats_bonus',
        value: 1,
        target: 'zone_dragon_allies',
        tags: ['dragon'],
        duration: 'permanent',
        description: '區域內 dragon tag 首領全屬性+1'
      },
      target: 'ally'
    },
    
    onDestroy: {
      type: 'draw',
      value: 2,
      target: 'self',
      duration: 'instant',
      description: '抽 2 張牌'
    },
    
    description: '龍族的聖殿，提升龍族首領的能力。',
    flavor: '龍族的榮耀在此閃耀。'
  },

  // ==================== 經濟型 ====================

  // 4. 魔力泉水
  {
    id: 'building_004',
    name: '魔力泉水',
    category: 'economy',
    
    durability: 1,
    
    cost: {
      discardCount: 1
    },
    
    placement: ['my_base', 'my_battlefield'],
    
    areaEffect: {
      name: '魔力湧現',
      description: '每回合準備階段，抽 1 張牌',
      effect: {
        type: 'draw_per_turn',
        value: 1,
        target: 'self',
        duration: 'permanent',
        description: '每回合準備階段抽 1 張牌'
      },
      target: 'ally'
    },
    
    onDestroy: {
      type: 'draw',
      value: 3,
      target: 'self',
      duration: 'instant',
      description: '抽 3 張牌'
    },
    
    description: '魔力泉水，提供源源不絕的資源。',
    flavor: '魔力如泉水般湧現。'
  },

  // 5. 知識圖書館
  {
    id: 'building_005',
    name: '知識圖書館',
    category: 'economy',
    
    durability: 2,
    
    cost: {
      discardCount: 2
    },
    
    placement: ['my_base'],
    
    tagRequirement: {
      myTags: ['mage'],
      condition: 'any'
    },
    
    areaEffect: {
      name: '知識之力',
      description: '區域內所有 mage tag 首領技能冷卻-1',
      effect: {
        type: 'cooldown_reduction',
        value: 1,
        target: 'zone_mage_allies',
        tags: ['mage'],
        duration: 'permanent',
        description: '區域內 mage tag 首領技能冷卻-1'
      },
      target: 'ally'
    },
    
    onDestroy: {
      type: 'search',
      value: 2,
      target: 'deck',
      duration: 'instant',
      description: '從牌組搜尋 2 張卡到手牌'
    },
    
    description: '知識圖書館，提升法師的能力。',
    flavor: '知識就是力量。'
  },

  // ==================== 進攻型 ====================

  // 6. 攻城塔
  {
    id: 'building_006',
    name: '攻城塔',
    category: 'offense',
    
    durability: 2,
    
    cost: {
      discardCount: 1
    },
    
    placementCondition: {
      enemyFortification: {
        min: 1
      }
    },
    
    placement: ['enemy_battlefield'],
    
    areaEffect: {
      name: '攻城加成',
      description: '區域內所有我方首領攻城時，築城計數器額外-1',
      effect: {
        type: 'siege_damage_bonus',
        value: 1,
        target: 'zone_all_allies',
        duration: 'permanent',
        description: '區域內我方首領攻城+1'
      },
      target: 'ally'
    },
    
    onDestroy: {
      type: 'fortification_breaker',
      value: 2,
      target: 'current_zone',
      duration: 'instant',
      description: '當前區域築城計數器-2'
    },
    
    description: '攻城塔，提升攻城能力。',
    flavor: '破城利器。'
  },

  // 7. 火焰陷阱
  {
    id: 'building_007',
    name: '火焰陷阱',
    category: 'offense',
    
    durability: 1,
    
    cost: {
      discardCount: 1
    },
    
    placement: ['enemy_battlefield', 'enemy_base'],
    
    tagRequirement: {
      myTags: ['fire'],
      condition: 'any'
    },
    
    areaEffect: {
      name: '火焰灼燒',
      description: '區域內所有敵首領每回合開始時受到 1 點火焰傷害',
      effect: {
        type: 'burn_per_turn',
        value: 1,
        target: 'zone_all_enemies',
        duration: 'permanent',
        description: '區域內敵首領每回合受到 1 點火焰傷害'
      },
      target: 'enemy'
    },
    
    onDestroy: {
      type: 'area_damage',
      value: 3,
      target: 'zone_all_enemies',
      duration: 'instant',
      description: '對當前區域所有敵首領造成 3 點傷害'
    },
    
    description: '火焰陷阱，持續灼燒敵人。',
    flavor: '踏入者必受火焰之苦。'
  },

  // 8. 戰爭要塞
  {
    id: 'building_008',
    name: '戰爭要塞',
    category: 'offense',
    
    durability: 3,
    
    cost: {
      discardCount: 2,
      fortificationCost: 1
    },
    
    placement: ['my_battlefield', 'enemy_battlefield'],
    
    areaEffect: {
      name: '戰爭鼓舞',
      description: '區域內所有我方首領對敵+2',
      effect: {
        type: 'attack_bonus',
        value: 2,
        target: 'zone_all_allies',
        duration: 'permanent',
        description: '區域內我方首領對敵+2'
      },
      target: 'ally'
    },
    
    onDestroy: {
      type: 'attack_boost_all',
      value: 3,
      target: 'all_allies',
      duration: 'turn',
      description: '所有我方首領對敵+3（本回合）'
    },
    
    description: '戰爭要塞，提升攻擊力。',
    flavor: '戰爭的號角響起。'
  },

  // ==================== 輔助型 ====================

  // 9. 天空平台
  {
    id: 'building_009',
    name: '天空平台',
    category: 'support',
    
    durability: 2,
    
    cost: {
      discardCount: 1
    },
    
    placement: ['my_base', 'my_battlefield'],
    
    tagRequirement: {
      myTags: ['flying'],
      condition: 'any'
    },
    
    areaEffect: {
      name: '天空優勢',
      description: '區域內所有 flying tag 首領移動時無視築城計數器',
      effect: {
        type: 'ignore_fortification',
        target: 'zone_flying_allies',
        tags: ['flying'],
        duration: 'permanent',
        description: '區域內 flying tag 首領無視築城'
      },
      target: 'ally'
    },
    
    onDestroy: {
      type: 'move_all',
      target: 'all_flying_allies',
      duration: 'instant',
      description: '所有 flying tag 首領移動到任意區域'
    },
    
    description: '天空平台，提升飛行單位的機動性。',
    flavor: '掌控天空，掌控戰場。'
  },

  // 10. 治癒聖泉
  {
    id: 'building_010',
    name: '治癒聖泉',
    category: 'support',
    
    durability: 1,
    
    cost: {
      discardCount: 1
    },
    
    placement: ['my_base'],
    
    tagRequirement: {
      myTags: ['holy'],
      condition: 'any'
    },
    
    areaEffect: {
      name: '聖泉治癒',
      description: '區域內所有我方首領每回合準備階段堅韌+1',
      effect: {
        type: 'regeneration',
        value: 1,
        target: 'zone_all_allies',
        duration: 'permanent',
        description: '區域內我方首領每回合堅韌+1'
      },
      target: 'ally'
    },
    
    onDestroy: {
      type: 'heal_all',
      value: 3,
      target: 'all_allies',
      duration: 'instant',
      description: '所有我方首領堅韌+3'
    },
    
    description: '治癒聖泉，持續治癒盟友。',
    flavor: '聖光如泉水般流淌。'
  },

  // ==================== 特殊型 ====================

  // 11. 復活祭壇
  {
    id: 'building_011',
    name: '復活祭壇',
    category: 'special',
    
    durability: 2,
    
    cost: {
      discardCount: 2,
      fortificationCost: 1
    },
    
    placement: ['my_base'],
    
    areaEffect: {
      name: '復活加速',
      description: '所有 KO 狀態的我方首領復活時間-1',
      effect: {
        type: 'reduce_revive_time',
        value: 1,
        target: 'all_ko_allies',
        duration: 'permanent',
        description: '所有 KO 首領復活時間-1'
      },
      target: 'ally'
    },
    
    onDestroy: {
      type: 'instant_revive',
      target: 'ko_ally_leader',
      duration: 'instant',
      description: '立即復活 1 位 KO 狀態的我方首領'
    },
    
    description: '復活祭壇，加速首領復活。',
    flavor: '死亡不是終點。'
  },

  // 12. 築城工坊
  {
    id: 'building_012',
    name: '築城工坊',
    category: 'special',
    
    durability: 2,
    
    cost: {
      discardCount: 1
    },
    
    placement: ['my_base', 'my_battlefield'],
    
    areaEffect: {
      name: '築城加速',
      description: '每回合準備階段，當前區域築城計數器+1（最多 2）',
      effect: {
        type: 'build_fortification_per_turn',
        value: 1,
        target: 'current_zone',
        duration: 'permanent',
        description: '每回合築城計數器+1'
      },
      target: 'ally'
    },
    
    onDestroy: {
      type: 'build_fortification_all',
      value: 1,
      target: 'all_my_zones',
      duration: 'instant',
      description: '所有我方區域築城計數器+1'
    },
    
    description: '築城工坊，持續加固防禦。',
    flavor: '防禦永遠不嫌多。'
  }
]

// 按類別分類
export const buildingsByCategory = {
  defense: allBuildings.filter(b => b.category === 'defense'),
  economy: allBuildings.filter(b => b.category === 'economy'),
  offense: allBuildings.filter(b => b.category === 'offense'),
  support: allBuildings.filter(b => b.category === 'support'),
  special: allBuildings.filter(b => b.category === 'special')
}

// 按放置區域分類
export const buildingsByZone = {
  myBase: allBuildings.filter(b => b.placement.includes('my_base')),
  myBattlefield: allBuildings.filter(b => b.placement.includes('my_battlefield')),
  enemyBattlefield: allBuildings.filter(b => b.placement.includes('enemy_battlefield')),
  enemyBase: allBuildings.filter(b => b.placement.includes('enemy_base'))
}

// 工具函數：根據 ID 查找建築卡
export function getBuildingById(id: string): BuildingCard | undefined {
  return allBuildings.find(building => building.id === id)
}

// 工具函數：根據 Tags 查找建築卡
export function getBuildingsByTag(tag: string): BuildingCard[] {
  return allBuildings.filter(building => 
    building.tagRequirement?.myTags?.includes(tag as any)
  )
}

// 工具函數：根據耐久度查找建築卡
export function getBuildingsByDurability(durability: number): BuildingCard[] {
  return allBuildings.filter(building => building.durability === durability)
}

// 工具函數：查找無條件建築卡
export function getUnconditionalBuildings(): BuildingCard[] {
  return allBuildings.filter(building => 
    !building.tagRequirement && !building.placementCondition
  )
}

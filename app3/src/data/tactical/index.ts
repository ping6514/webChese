// 戰術卡資料
// 特色：面朝下安裝、觸發時機反應、消耗品

import type { TacticalCard } from '../../types'

export const allTacticals: TacticalCard[] = [
  // ==================== 防禦型 ====================
  
  // 1. 元素護盾
  {
    id: 'tactical_001',
    name: '元素護盾',
    category: 'defense',
    
    trigger: {
      timing: 'on_attacked',
      conditionDescription: '首領有 elemental tag 時'
    },
    
    tagRequirement: {
      myTags: ['elemental'],
      condition: 'target'
    },
    
    effect: [
      {
        type: 'damage_reduction',
        value: 3,
        target: 'self',
        duration: 'instant',
        description: '本次攻擊受到傷害-3'
      }
    ],
    
    description: '元素之力形成護盾，減少傷害。',
    flavor: '元素的力量守護著我。'
  },

  // 2. 鋼鐵意志
  {
    id: 'tactical_002',
    name: '鋼鐵意志',
    category: 'defense',
    
    trigger: {
      timing: 'on_damage_taken',
      conditionDescription: '受到傷害後堅韌度≤2 時'
    },
    
    effect: [
      {
        type: 'shield',
        target: 'self',
        duration: 'turn',
        description: '下次受到攻擊時，傷害歸 0'
      },
      {
        type: 'toughness_bonus',
        value: 2,
        target: 'self',
        duration: 'turn',
        description: '堅韌+2（本回合）'
      }
    ],
    
    description: '在危機時刻，鋼鐵般的意志守護自己。',
    flavor: '我不會倒下！'
  },

  // 3. 聖光庇護
  {
    id: 'tactical_003',
    name: '聖光庇護',
    category: 'defense',
    
    trigger: {
      timing: 'on_attacked',
      conditionDescription: '首領有 holy tag 時'
    },
    
    tagRequirement: {
      myTags: ['holy'],
      condition: 'target'
    },
    
    effect: [
      {
        type: 'negate_attack',
        target: 'self',
        duration: 'instant',
        description: '取消本次攻擊'
      },
      {
        type: 'heal',
        value: 2,
        target: 'self',
        duration: 'instant',
        description: '堅韌+2'
      }
    ],
    
    description: '聖光降臨，庇護信徒。',
    flavor: '聖光與我同在。'
  },

  // ==================== 反擊型 ====================

  // 4. 雷霆反擊
  {
    id: 'tactical_004',
    name: '雷霆反擊',
    category: 'counter',
    
    trigger: {
      timing: 'on_attacked',
      conditionDescription: '首領有 lightning tag 時'
    },
    
    tagRequirement: {
      myTags: ['lightning'],
      condition: 'target'
    },
    
    effect: [
      {
        type: 'reflect',
        value: 3,
        target: 'attacker',
        duration: 'instant',
        description: '對攻擊者造成 3 點反擊傷害'
      },
      {
        type: 'stun',
        target: 'attacker',
        duration: 'instant',
        description: '攻擊者暈眩'
      }
    ],
    
    description: '雷霆之力反擊敵人。',
    flavor: '你會為你的攻擊付出代價。'
  },

  // 5. 毒刺反擊
  {
    id: 'tactical_005',
    name: '毒刺反擊',
    category: 'counter',
    
    trigger: {
      timing: 'on_attacked',
      conditionDescription: '首領有 poison tag 時'
    },
    
    tagRequirement: {
      myTags: ['poison'],
      condition: 'target'
    },
    
    effect: [
      {
        type: 'poison',
        value: 3,
        target: 'attacker',
        duration: 'turn',
        description: '攻擊者下 3 回合開始時受到 1 點毒素傷害'
      },
      {
        type: 'attack_debuff',
        value: 2,
        target: 'attacker',
        duration: 'turn',
        description: '攻擊者對敵-2（持續 2 回合）'
      }
    ],
    
    description: '毒刺反擊，讓敵人痛苦不堪。',
    flavor: '嘗嘗我的毒液。'
  },

  // 6. 冰霜反制
  {
    id: 'tactical_006',
    name: '冰霜反制',
    category: 'counter',
    
    trigger: {
      timing: 'on_attacked',
      conditionDescription: '首領有 ice tag 時'
    },
    
    tagRequirement: {
      myTags: ['ice'],
      condition: 'target'
    },
    
    effect: [
      {
        type: 'damage_reduction',
        value: 2,
        target: 'self',
        duration: 'instant',
        description: '本次攻擊受到傷害-2'
      },
      {
        type: 'freeze',
        target: 'attacker',
        duration: 'turn',
        description: '攻擊者下回合無法移動'
      }
    ],
    
    description: '冰霜之力凍結敵人。',
    flavor: '冰封你的腳步。'
  },

  // ==================== 移動型 ====================

  // 7. 戰術閃避
  {
    id: 'tactical_007',
    name: '戰術閃避',
    category: 'movement',
    
    trigger: {
      timing: 'on_attacked',
      conditionDescription: '無條件'
    },
    
    effect: [
      {
        type: 'dodge',
        target: 'self',
        duration: 'instant',
        description: '取消本次攻擊'
      },
      {
        type: 'move',
        value: 1,
        target: 'self',
        duration: 'instant',
        description: '移動到相鄰區域'
      }
    ],
    
    description: '閃避攻擊，戰術移動。',
    flavor: '你打不到我。'
  },

  // 8. 天空降臨
  {
    id: 'tactical_008',
    name: '天空降臨',
    category: 'movement',
    
    trigger: {
      timing: 'on_enemy_move',
      conditionDescription: '首領有 flying tag 時'
    },
    
    tagRequirement: {
      myTags: ['flying'],
      condition: 'target'
    },
    
    effect: [
      {
        type: 'teleport',
        target: 'self',
        duration: 'instant',
        description: '移動到任意區域'
      },
      {
        type: 'attack_bonus',
        value: 3,
        target: 'self',
        duration: 'turn',
        description: '本回合對敵+3'
      }
    ],
    
    description: '從天而降，突襲敵人。',
    flavor: '從天空俯衝而下！'
  },

  // ==================== 築城型 ====================

  // 9. 緊急加固
  {
    id: 'tactical_009',
    name: '緊急加固',
    category: 'fortification',
    
    trigger: {
      timing: 'on_fortification_attacked',
      conditionDescription: '築城計數器被攻擊時'
    },
    
    effect: [
      {
        type: 'build_fortification',
        value: 1,
        target: 'current_zone',
        duration: 'instant',
        description: '當前區域築城計數器+1（最多 2）'
      },
      {
        type: 'damage_reduction',
        value: 2,
        target: 'zone_all_allies',
        duration: 'turn',
        description: '當前區域所有我方首領受到傷害-2（本回合）'
      }
    ],
    
    description: '緊急加固防禦工事。',
    flavor: '防禦永遠不嫌多。'
  },

  // 10. 獸穴守護
  {
    id: 'tactical_010',
    name: '獸穴守護',
    category: 'fortification',
    
    trigger: {
      timing: 'on_lair_attacked',
      conditionDescription: '獸穴HP被攻擊時'
    },
    
    effect: [
      {
        type: 'lair_damage_reduction',
        value: 2,
        target: 'my_lair',
        duration: 'instant',
        description: '本次攻擊對獸穴HP的傷害-2（最少 0）'
      },
      {
        type: 'build_fortification',
        value: 1,
        target: 'my_base',
        duration: 'instant',
        description: '我方基地築城計數器+1（最多 2）'
      }
    ],
    
    description: '守護獸穴，抵擋攻擊。',
    flavor: '獸穴是我們的家園，絕不能失守。'
  }
]

// 按類別分類
export const tacticalsByCategory = {
  defense: allTacticals.filter(t => t.category === 'defense'),
  counter: allTacticals.filter(t => t.category === 'counter'),
  movement: allTacticals.filter(t => t.category === 'movement'),
  fortification: allTacticals.filter(t => t.category === 'fortification')
}

// 工具函數：根據 ID 查找戰術卡
export function getTacticalById(id: string): TacticalCard | undefined {
  return allTacticals.find(tactical => tactical.id === id)
}

// 工具函數：根據 Tags 查找戰術卡
export function getTacticalsByTag(tag: string): TacticalCard[] {
  return allTacticals.filter(tactical => 
    tactical.tagRequirement?.myTags?.includes(tag as any)
  )
}

// 工具函數：根據觸發時機查找戰術卡
export function getTacticalsByTiming(timing: string): TacticalCard[] {
  return allTacticals.filter(tactical => 
    tactical.trigger.timing === timing
  )
}

// 工具函數：查找無條件戰術卡
export function getUnconditionalTacticals(): TacticalCard[] {
  return allTacticals.filter(tactical => 
    !tactical.tagRequirement || tactical.trigger.conditionDescription === '無條件'
  )
}

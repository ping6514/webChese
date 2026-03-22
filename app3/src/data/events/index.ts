// 事件卡資料
// 基於 Tags 系統和效果關鍵詞設計

import type { EventCard } from '../../types'

export const allEvents: EventCard[] = [
  // ==================== 召喚類 ====================
  
  // 1. 元素集結
  {
    id: 'event_001',
    name: '元素集結',
    category: 'summon',
    
    cost: { tech: 1 },
    
    tagRequirement: {
      myTags: ['elemental'],
      condition: 'any'
    },
    
    effect: [
      {
        type: 'special_summon_from_hand',
        target: 'all_elemental_legions',
        duration: 'instant',
        description: '從手牌特殊召喚所有 elemental tag 軍團'
      }
    ],
    
    bonusEffect: {
      conditionDescription: '如果場上有 3+ 個 elemental tag 首領',
      effect: [
        {
          type: 'draw',
          value: 2,
          target: 'self',
          duration: 'instant',
          description: '額外抽 2 張牌'
        }
      ]
    },
    
    description: '元素之力匯聚，召喚所有元素軍團。',
    flavor: '當元素之力達到頂峰，大地為之震顫。'
  },

  // 2. 緊急召喚
  {
    id: 'event_002',
    name: '緊急召喚',
    category: 'summon',
    
    cost: { any: 2 },
    
    effect: [
      {
        type: 'search_and_summon',
        target: 'deck',
        duration: 'instant',
        description: '從牌組搜尋 1 張軍團卡，特殊召喚到任一我方首領'
      }
    ],
    
    bonusEffect: {
      conditionDescription: '如果目標首領堅韌度低於一半',
      effect: [
        {
          type: 'toughness_bonus',
          value: 3,
          target: 'target_leader',
          duration: 'turn',
          description: '該首領堅韌+3（本回合）'
        }
      ]
    },
    
    description: '緊急時刻，召喚援軍。',
    flavor: '危機時刻，援軍總會及時趕到。'
  },

  // 3. 種族召集
  {
    id: 'event_003',
    name: '種族召集',
    category: 'summon',
    
    cost: { tech: 1, any: 1 },
    
    tagRequirement: {
      myTags: ['dragon', 'harpy', 'lamia', 'slime', 'centaur', 'aquatic'],
      condition: 'any'
    },
    
    effect: [
      {
        type: 'search_by_race',
        value: 2,
        target: 'deck',
        duration: 'instant',
        description: '選擇 1 個種族，從牌組搜尋最多 2 張該種族軍團卡到手牌'
      }
    ],
    
    bonusEffect: {
      conditionDescription: '如果場上有 3+ 個相同種族 tag 首領',
      effect: [
        {
          type: 'special_summon',
          value: 1,
          target: 'hand',
          duration: 'instant',
          description: '從手牌特殊召喚 1 個該種族軍團'
        }
      ]
    },
    
    description: '召集同族，共赴戰場。',
    flavor: '血脈相連，榮辱與共。'
  },

  // ==================== 戰鬥類 ====================

  // 4. 飛行突襲
  {
    id: 'event_004',
    name: '飛行突襲',
    category: 'combat',
    
    cost: { any: 2 },
    
    tagRequirement: {
      myTags: ['flying'],
      condition: 'any'
    },
    
    effect: [
      {
        type: 'move_all',
        target: 'all_flying_leaders',
        duration: 'instant',
        description: '所有 flying tag 首領移動到任意區域'
      },
      {
        type: 'attack_bonus',
        value: 3,
        target: 'all_flying_leaders',
        duration: 'turn',
        description: '所有 flying tag 首領對敵+3（本回合）'
      }
    ],
    
    bonusEffect: {
      conditionDescription: '如果場上有 2+ 個 flying tag 首領',
      effect: [
        {
          type: 'ignore_fortification',
          target: 'all_flying_leaders',
          duration: 'turn',
          description: '本回合移動時無視築城計數器'
        }
      ]
    },
    
    description: '天空的統治者發動突襲。',
    flavor: '從天而降的攻擊，無人能擋。'
  },

  // 5. 全軍突擊
  {
    id: 'event_005',
    name: '全軍突擊',
    category: 'combat',
    
    cost: { tech: 2 },
    
    effect: [
      {
        type: 'attack_bonus_all',
        value: 2,
        target: 'all_allies',
        duration: 'turn',
        description: '所有我方首領對敵+2（本回合）'
      },
      {
        type: 'extra_action',
        value: 1,
        target: 'all_allies',
        duration: 'instant',
        description: '所有我方首領可以執行 1 次額外通常動作'
      }
    ],
    
    bonusEffect: {
      conditionDescription: '如果敵方獸穴HP ≤ 2',
      effect: [
        {
          type: 'attack_bonus',
          value: 3,
          target: 'all_allies',
          duration: 'turn',
          description: '額外對敵+3'
        }
      ]
    },
    
    description: '全軍出擊，一舉攻破敵陣！',
    flavor: '勝利就在眼前，全力以赴！'
  },

  // 6. 破城衝鋒
  {
    id: 'event_006',
    name: '破城衝鋒',
    category: 'fortification',
    
    cost: { tech: 1, any: 1 },
    
    effect: [
      {
        type: 'fortification_breaker',
        value: 2,
        target: 'target_zone',
        duration: 'instant',
        description: '選擇 1 個敵方區域，築城計數器-2'
      },
      {
        type: 'attack_bonus',
        value: 2,
        target: 'zone_all_allies',
        duration: 'turn',
        description: '該區域所有我方首領對敵+2（本回合）'
      }
    ],
    
    bonusEffect: {
      conditionDescription: '如果目標區域築城計數器歸 0',
      effect: [
        {
          type: 'lair_assault',
          value: 2,
          target: 'enemy_lair',
          duration: 'instant',
          description: '對敵方獸穴HP造成 2 點傷害'
        }
      ]
    },
    
    description: '破壞防禦，直搗黃龍！',
    flavor: '沒有任何防禦能阻擋我們的進攻。'
  },

  // ==================== 防禦類 ====================

  // 7. 緊急築城
  {
    id: 'event_007',
    name: '緊急築城',
    category: 'fortification',
    
    cost: { any: 2 },
    
    effect: [
      {
        type: 'build_fortification_all',
        value: 1,
        target: 'all_my_zones',
        duration: 'instant',
        description: '所有我方區域築城計數器+1（最多 2）'
      },
      {
        type: 'toughness_bonus',
        value: 2,
        target: 'all_allies',
        duration: 'turn',
        description: '所有我方首領堅韌+2（本回合）'
      }
    ],
    
    bonusEffect: {
      conditionDescription: '如果我方獸穴HP ≤ 2',
      effect: [
        {
          type: 'lair_repair',
          value: 1,
          target: 'my_lair',
          duration: 'instant',
          description: '我方獸穴HP+1（最多 4）'
        }
      ]
    },
    
    description: '緊急加固防禦，守護獸穴。',
    flavor: '防禦是最好的進攻。'
  },

  // 8. 戰術撤退
  {
    id: 'event_008',
    name: '戰術撤退',
    category: 'movement',
    
    cost: { any: 1 },
    
    effect: [
      {
        type: 'recall_all',
        target: 'all_allies',
        duration: 'instant',
        description: '所有我方首領移動到我方基地'
      },
      {
        type: 'heal_all',
        value: 2,
        target: 'all_allies',
        duration: 'instant',
        description: '所有我方首領堅韌+2'
      }
    ],
    
    bonusEffect: {
      conditionDescription: '如果有我方首領堅韌度低於一半',
      effect: [
        {
          type: 'build_fortification',
          value: 1,
          target: 'my_lair',
          duration: 'instant',
          description: '我方基地築城計數器+1'
        }
      ]
    },
    
    description: '戰術性撤退，保存實力。',
    flavor: '留得青山在，不怕沒柴燒。'
  },

  // ==================== 復活類 ====================

  // 9. 亡者復甦
  {
    id: 'event_009',
    name: '亡者復甦',
    category: 'summon',
    
    cost: { tech: 2, any: 1 },
    
    effect: [
      {
        type: 'instant_revive',
        target: 'ko_ally_leader',
        duration: 'instant',
        description: '選擇 1 位 KO 狀態的我方首領，立即復活在我方基地'
      },
      {
        type: 'summon_from_graveyard',
        value: 1,
        target: 'graveyard',
        duration: 'instant',
        description: '從墓地特殊召喚 1 個軍團到該首領'
      }
    ],
    
    bonusEffect: {
      conditionDescription: '如果該首領有 elemental tag',
      effect: [
        {
          type: 'toughness_bonus',
          value: 3,
          target: 'revived_leader',
          duration: 'turn',
          description: '該首領堅韌+3（本回合）'
        }
      ]
    },
    
    description: '死者歸來，重返戰場。',
    flavor: '死亡不是終點，而是新的開始。'
  },

  // 10. 戰術重整
  {
    id: 'event_010',
    name: '戰術重整',
    category: 'draw',
    
    cost: { any: 1 },
    
    effect: [
      {
        type: 'draw',
        value: 3,
        target: 'self',
        duration: 'instant',
        description: '抽 3 張牌'
      },
      {
        type: 'reduce_revive_time',
        value: 1,
        target: 'all_ko_allies',
        duration: 'instant',
        description: '所有 KO 狀態的我方首領復活時間-1'
      }
    ],
    
    bonusEffect: {
      conditionDescription: '如果有 2+ 位我方首領處於 KO 狀態',
      effect: [
        {
          type: 'draw',
          value: 2,
          target: 'self',
          duration: 'instant',
          description: '額外抽 2 張牌'
        }
      ]
    },
    
    description: '重整旗鼓，再戰一場。',
    flavor: '失敗是成功之母。'
  },

  // ==================== 控制類 ====================

  // 11. 時間扭曲
  {
    id: 'event_011',
    name: '時間扭曲',
    category: 'control',
    
    cost: { tech: 2, any: 2 },
    
    effect: [
      {
        type: 'mass_stun',
        target: 'zone_all_enemies',
        duration: 'instant',
        description: '選擇 1 個區域，該區域所有敵首領暈眩'
      },
      {
        type: 'reset_cooldown',
        target: 'all_allies',
        duration: 'instant',
        description: '所有我方首領技能冷卻歸 0'
      }
    ],
    
    bonusEffect: {
      conditionDescription: '如果場上有 magic tag 首領',
      effect: [
        {
          type: 'extend_stun',
          value: 1,
          target: 'stunned_enemies',
          duration: 'turn',
          description: '暈眩持續時間+1 回合'
        }
      ]
    },
    
    description: '扭曲時間，掌控戰局。',
    flavor: '時間是最強大的武器。'
  },

  // 12. 元素爆發
  {
    id: 'event_012',
    name: '元素爆發',
    category: 'combat',
    
    cost: { tech: 1, any: 1 },
    
    tagRequirement: {
      myTags: ['elemental'],
      condition: 'any'
    },
    
    effect: [
      {
        type: 'area_damage_all_zones',
        value: 3,
        target: 'all_enemy_zones',
        duration: 'instant',
        description: '對所有敵方區域的敵首領造成 3 點傷害'
      }
    ],
    
    bonusEffect: {
      conditionDescription: '如果場上有 3+ 個不同元素 tag（fire/ice/lightning）',
      effect: [
        {
          type: 'area_damage',
          value: 2,
          target: 'all_enemies',
          duration: 'instant',
          description: '額外對所有敵首領造成 2 點傷害'
        },
        {
          type: 'fortification_breaker',
          value: 1,
          target: 'all_enemy_zones',
          duration: 'instant',
          description: '所有敵方區域築城計數器-1'
        }
      ]
    },
    
    description: '元素之力爆發，毀滅一切。',
    flavor: '當所有元素匯聚，世界為之顫抖。'
  }
]

// 按類別分類
export const eventsByCategory = {
  summon: allEvents.filter(e => e.category === 'summon'),
  combat: allEvents.filter(e => e.category === 'combat'),
  fortification: allEvents.filter(e => e.category === 'fortification'),
  movement: allEvents.filter(e => e.category === 'movement'),
  draw: allEvents.filter(e => e.category === 'draw'),
  control: allEvents.filter(e => e.category === 'control')
}

// 工具函數：根據 ID 查找事件卡
export function getEventById(id: string): EventCard | undefined {
  return allEvents.find(event => event.id === id)
}

// 工具函數：根據 Tags 查找事件卡
export function getEventsByTag(tag: string): EventCard[] {
  return allEvents.filter(event => 
    event.tagRequirement?.myTags?.includes(tag as any)
  )
}

// 工具函數：根據成本查找事件卡
export function getEventsByCost(maxCost: number): EventCard[] {
  return allEvents.filter(event => {
    const totalCost = (event.cost.tech || 0) + (event.cost.any || 0)
    return totalCost <= maxCost
  })
}

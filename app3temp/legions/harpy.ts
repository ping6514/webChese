// 哈比族軍團卡
// 特色：高機動、飛行、移動後加成

import type { LegionCard } from '../../types'

export const harpyLegions: LegionCard[] = [
  // ==================== 普通軍團 ====================
  
  // 1. 風翼斥候（普通）- 機動型
  {
    id: 'legion_harpy_001',
    name: '風翼斥候',
    race: 'harpy',
    type: 'archer',
    rank: 'normal',
    
    tags: ['harpy', 'archer', 'flying', 'ranged'],
    
    bonusStats: {
      toughness: 1,
      attack: 2,
      defensiveSupport: 0,
      offensiveSupport: 1,
      recovery: 0
    },
    
    passive: {
      name: '疾風之翼',
      description: '如果首領有 flying tag，移動後本回合對敵+1',
      effect: {
        type: 'attack_bonus_after_move_if_leader_has_tag',
        value: 1,
        tag: 'flying',
        target: 'self',
        duration: 'turn',
        description: '首領有 flying tag 時移動後對敵+1'
      }
    },
    
    onLeaderKO: {
      type: 'discard',
      effect: {
        type: 'extra_move',
        value: 1,
        target: 'ally_leader',
        duration: 'instant',
        description: '選擇 1 位我方首領可以移動 1 次'
      }
    },
    
    flavor: '哈比族的斥候，擅長快速移動和偵查。'
  },

  // 2. 雷鳥戰士（普通）- 攻擊型
  {
    id: 'legion_harpy_002',
    name: '雷鳥戰士',
    race: 'harpy',
    type: 'infantry',
    rank: 'normal',
    
    tags: ['harpy', 'infantry', 'lightning', 'flying', 'melee'],
    
    bonusStats: {
      toughness: 2,
      attack: 1,
      defensiveSupport: 0,
      offensiveSupport: 1,
      recovery: 0
    },
    
    passive: {
      name: '雷霆之擊',
      description: '如果首領有 lightning tag，對敵+1',
      effect: {
        type: 'attack_bonus_if_leader_has_tag',
        value: 1,
        tag: 'lightning',
        target: 'self',
        duration: 'permanent',
        description: '首領有 lightning tag 時對敵+1'
      }
    },
    
    onLeaderKO: {
      type: 'discard',
      effect: {
        type: 'stun',
        target: 'attacker',
        duration: 'instant',
        description: '擊破者暈眩'
      }
    },
    
    flavor: '雷鳥一族的戰士，掌握著雷電的力量。'
  },

  // ==================== 精英軍團 ====================

  // 3. 聖光哈比（精英）- 輔助型
  {
    id: 'legion_harpy_003',
    name: '聖光哈比',
    race: 'harpy',
    type: 'mage',
    rank: 'elite',
    
    tags: ['harpy', 'mage', 'holy', 'flying', 'magic', 'ranged'],
    
    bonusStats: {
      toughness: 1,
      attack: 0,
      defensiveSupport: 2,
      offensiveSupport: 0,
      recovery: 2
    },
    
    passive: {
      name: '聖光祝福',
      description: '如果首領有 holy tag，協助+1',
      effect: {
        type: 'support_bonus_if_leader_has_tag',
        value: 1,
        tag: 'holy',
        target: 'self',
        duration: 'permanent',
        description: '首領有 holy tag 時協助+1'
      }
    },
    
    activeSkill: {
      name: '聖光治癒',
      timing: ['preparation_start', 'end_start'],
      cost: { any: 1 },
      cooldown: 2,
      effect: {
        type: 'heal',
        value: 2,
        target: 'ally_leader',
        duration: 'instant',
        description: '選擇 1 位我方首領，堅韌+2'
      }
    },
    
    onLeaderKO: {
      type: 'choice',
      cost: { discard: 1 },
      effect: {
        type: 'heal_all',
        value: 2,
        target: 'all_allies',
        duration: 'instant',
        description: '丟棄1張手牌保留，否則丟棄並所有我方首領堅韌+2'
      }
    },
    
    flavor: '聖光哈比一族的治療者，擁有治癒的聖光。'
  },

  // 4. 風暴獵手（精英）- 控制型
  {
    id: 'legion_harpy_004',
    name: '風暴獵手',
    race: 'harpy',
    type: 'archer',
    rank: 'elite',
    
    tags: ['harpy', 'archer', 'flying', 'ranged'],
    
    bonusStats: {
      toughness: 1,
      attack: 2,
      defensiveSupport: 0,
      offensiveSupport: 1,
      recovery: 0
    },
    
    passive: {
      name: '風暴之眼',
      description: '如果首領有 flying tag，可以無視築城計數器移動',
      effect: {
        type: 'ignore_fortification_if_leader_has_tag',
        tag: 'flying',
        target: 'self',
        duration: 'permanent',
        description: '首領有 flying tag 時無視築城'
      }
    },
    
    activeSkill: {
      name: '風暴箭雨',
      timing: ['action_start'],
      cost: { tech: 1 },
      cooldown: 2,
      effect: {
        type: 'area_damage',
        value: 3,
        target: 'zone_all_enemies',
        duration: 'instant',
        description: '對當前區域所有敵首領造成 3 點傷害'
      }
    },
    
    onLeaderKO: {
      type: 'choice',
      cost: { any: 1 },
      effect: {
        type: 'push',
        target: 'zone_all_enemies',
        duration: 'instant',
        description: '支付成本保留，否則丟棄並將當前區域所有敵首領推回相鄰區域'
      }
    },
    
    flavor: '風暴獵手一族的精英，擅長遠程攻擊和控場。'
  },

  // ==================== 傳說軍團 ====================

  // 5. 天空女王親衛（傳說）- 全能型
  {
    id: 'legion_harpy_005',
    name: '天空女王親衛',
    race: 'harpy',
    type: 'cavalry',
    rank: 'legendary',
    
    tags: ['harpy', 'cavalry', 'flying', 'lightning', 'ranged'],
    
    bonusStats: {
      toughness: 2,
      attack: 3,
      defensiveSupport: 1,
      offensiveSupport: 1,
      recovery: 2
    },
    
    summonCost: {
      tributeCount: 2,
      tributeRace: 'harpy'
    },
    
    passive: {
      name: '天空霸主',
      description: '如果首領有 flying tag，移動時無視築城且可以連續移動 2 次',
      effect: {
        type: 'double_move_and_ignore_fortification_if_leader_has_tag',
        tag: 'flying',
        target: 'self',
        duration: 'permanent',
        description: '首領有 flying tag 時連續移動 2 次且無視築城'
      }
    },
    
    activeSkill: {
      name: '天空突襲',
      timing: ['after_move'],
      cost: { any: 1 },
      cooldown: 1,
      effect: {
        type: 'attack_boost_and_extra_action',
        value: 4,
        target: 'self',
        duration: 'turn',
        description: '本回合對敵+4，可以再次執行通常動作'
      }
    },
    
    sacrificeSkill: {
      name: '天空降臨',
      effect: {
        type: 'teleport_all_allies',
        target: 'all_allies',
        duration: 'instant',
        description: '犧牲本軍團，所有我方首領移動到任意區域'
      }
    },
    
    onLeaderKO: {
      type: 'keep',
      effect: {
        type: 'attack_bonus',
        value: 3,
        target: 'self',
        duration: 'turn',
        description: '保留，下次復活時對敵+3（本回合）'
      }
    },
    
    flavor: '天空女王的親衛隊，擁有無與倫比的飛行能力和戰鬥技巧。'
  }
]

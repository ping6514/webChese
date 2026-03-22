// 龍族軍團卡
// 特色：高攻擊、火焰/冰霜/雷電元素、攻城能力

import type { LegionCard } from '../../types'

export const dragonLegions: LegionCard[] = [
  // ==================== 普通軍團 ====================
  
  // 1. 炎龍戰士（普通）- 攻擊型
  {
    id: 'legion_dragon_001',
    name: '炎龍戰士',
    race: 'dragon',
    type: 'infantry',
    rank: 'normal',
    
    tags: ['dragon', 'infantry', 'fire', 'elemental', 'melee'],
    
    bonusStats: {
      toughness: 2,
      attack: 1,
      defensiveSupport: 0,
      offensiveSupport: 1,
      recovery: 0
    },
    
    passive: {
      name: '火焰之力',
      description: '如果首領有 fire tag，對敵+1',
      effect: {
        type: 'attack_bonus_if_leader_has_tag',
        value: 1,
        tag: 'fire',
        target: 'self',
        duration: 'permanent',
        description: '首領有 fire tag 時對敵+1'
      }
    },
    
    onLeaderKO: {
      type: 'discard',
      effect: {
        type: 'burn',
        value: 2,
        target: 'attacker',
        duration: 'turn',
        description: '對擊破者造成 2 點火焰傷害'
      }
    },
    
    flavor: '炎龍一族的基礎戰士，掌握著火焰的力量。'
  },

  // 2. 冰龍守衛（普通）- 防禦型
  {
    id: 'legion_dragon_002',
    name: '冰龍守衛',
    race: 'dragon',
    type: 'infantry',
    rank: 'normal',
    
    tags: ['dragon', 'infantry', 'ice', 'elemental'],
    
    bonusStats: {
      toughness: 3,
      attack: 0,
      defensiveSupport: 1,
      offensiveSupport: 0,
      recovery: 1
    },
    
    passive: {
      name: '冰霜護甲',
      description: '如果首領有 ice tag，受到傷害-1',
      effect: {
        type: 'damage_reduction_if_leader_has_tag',
        value: 1,
        tag: 'ice',
        target: 'self',
        duration: 'permanent',
        description: '首領有 ice tag 時受到傷害-1'
      }
    },
    
    onLeaderKO: {
      type: 'discard',
      effect: {
        type: 'freeze',
        target: 'attacker',
        duration: 'turn',
        description: '擊破者下回合無法移動'
      }
    },
    
    flavor: '冰龍一族的守衛，擁有堅固的冰霜護甲。'
  },

  // ==================== 精英軍團 ====================

  // 3. 雷龍法師（精英）- 控制型
  {
    id: 'legion_dragon_003',
    name: '雷龍法師',
    race: 'dragon',
    type: 'mage',
    rank: 'elite',
    
    tags: ['dragon', 'mage', 'lightning', 'elemental', 'magic', 'ranged'],
    
    bonusStats: {
      toughness: 1,
      attack: 2,
      defensiveSupport: 1,
      offensiveSupport: 1,
      recovery: 1
    },
    
    passive: {
      name: '雷電共鳴',
      description: '如果首領有 lightning tag，協助+1',
      effect: {
        type: 'support_bonus_if_leader_has_tag',
        value: 1,
        tag: 'lightning',
        target: 'self',
        duration: 'permanent',
        description: '首領有 lightning tag 時協助+1'
      }
    },
    
    activeSkill: {
      name: '雷霆鎖鏈',
      timing: ['action_start'],
      cost: { any: 1 },
      cooldown: 2,
      effect: {
        type: 'stun',
        target: 'enemy_leader',
        duration: 'instant',
        description: '選擇 1 位敵首領，暈眩'
      }
    },
    
    onLeaderKO: {
      type: 'choice',
      cost: { discard: 1 },
      effect: {
        type: 'area_damage',
        value: 3,
        target: 'zone_all_enemies',
        duration: 'instant',
        description: '丟棄1張手牌保留，否則丟棄並對當前區域所有敵首領造成 3 點傷害'
      }
    },
    
    flavor: '雷龍一族的法師，掌控著雷電的力量。'
  },

  // 4. 龍族攻城兵（精英）- 攻城型
  {
    id: 'legion_dragon_004',
    name: '龍族攻城兵',
    race: 'dragon',
    type: 'siege',
    rank: 'elite',
    
    tags: ['dragon', 'siege', 'elemental'],
    
    bonusStats: {
      toughness: 2,
      attack: 1,
      defensiveSupport: 0,
      offensiveSupport: 1,
      recovery: 0
    },
    
    passive: {
      name: '破城之力',
      description: '攻城時，築城計數器額外-1',
      effect: {
        type: 'siege_damage_bonus',
        value: 1,
        target: 'self',
        duration: 'permanent',
        description: '攻城時築城計數器額外-1'
      }
    },
    
    activeSkill: {
      name: '龍炎攻城',
      timing: ['before_siege'],
      cost: { tech: 1 },
      cooldown: 2,
      effect: {
        type: 'fortification_breaker',
        value: 2,
        target: 'target_zone',
        duration: 'instant',
        description: '目標區域築城計數器-2'
      }
    },
    
    onLeaderKO: {
      type: 'choice',
      cost: { discard: 1 },
      effect: {
        type: 'building_destroyer',
        target: 'zone_building',
        duration: 'instant',
        description: '丟棄1張手牌保留，否則丟棄並破壞當前區域 1 張建築卡'
      }
    },
    
    flavor: '龍族專門的攻城部隊，擅長破壞防禦工事。'
  },

  // ==================== 傳說軍團 ====================

  // 5. 古龍長老（傳說）- 全能型
  {
    id: 'legion_dragon_005',
    name: '古龍長老',
    race: 'dragon',
    type: 'mage',
    rank: 'legendary',
    
    tags: ['dragon', 'mage', 'elemental', 'fire', 'ice', 'lightning', 'magic', 'flying'],
    
    bonusStats: {
      toughness: 3,
      attack: 2,
      defensiveSupport: 1,
      offensiveSupport: 1,
      recovery: 1
    },
    
    summonCost: {
      tributeCount: 2,
      tributeRace: 'dragon'
    },
    
    passive: {
      name: '元素掌控',
      description: '如果首領有任一元素 tag（fire/ice/lightning），全屬性+1',
      effect: {
        type: 'all_stats_bonus_if_leader_has_elemental_tag',
        value: 1,
        tags: ['fire', 'ice', 'lightning'],
        target: 'self',
        duration: 'permanent',
        description: '首領有元素 tag 時全屬性+1'
      }
    },
    
    activeSkill: {
      name: '元素爆發',
      timing: ['action_start'],
      cost: { tech: 1 },
      cooldown: 3,
      effect: {
        type: 'area_damage_and_debuff',
        value: 4,
        target: 'zone_all_enemies',
        duration: 'instant',
        description: '對當前區域所有敵首領造成 4 點傷害，並使其下回合對敵-2'
      }
    },
    
    sacrificeSkill: {
      name: '龍魂獻祭',
      effect: {
        type: 'instant_revive',
        target: 'ko_ally_leader',
        duration: 'instant',
        description: '犧牲本軍團，立即復活 1 位 KO 狀態的我方首領'
      }
    },
    
    onLeaderKO: {
      type: 'keep',
      effect: {
        type: 'toughness_bonus',
        value: 3,
        target: 'self',
        duration: 'turn',
        description: '保留，下次復活時堅韌+3（本回合）'
      }
    },
    
    flavor: '古老的龍族長老，掌握著所有元素的力量。傳說中，他們曾是這片大陸的統治者。'
  }
]

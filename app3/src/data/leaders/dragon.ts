// 龍族首領卡
// 特色：高攻擊、高堅韌、攻城能力強

import type { LeaderCard } from '../../types'

export const dragonLeaders: LeaderCard[] = [
  // 1. 破壞者 - 炎龍女王·艾格妮絲
  {
    id: 'leader_dragon_001',
    name: '炎龍女王·艾格妮絲',
    race: 'dragon',
    class: 'destroyer',
    
    baseToughness: 5,
    baseAttack: 5,
    baseDefensiveSupport: 0,
    baseOffensiveSupport: 1,
    baseRecovery: 0,
    
    tags: ['dragon', 'destroyer', 'flying', 'fire', 'elemental'],
    
    passive: {
      name: '龍炎護甲',
      description: '受到攻擊時，對攻擊者造成 1 點反擊傷害',
      effect: {
        type: 'counter_damage',
        value: 1,
        target: 'attacker',
        duration: 'permanent',
        description: '受到攻擊時反擊 1 點傷害'
      }
    },
    
    skill: {
      name: '龍炎爆發',
      timing: ['action_start', 'after_move'],
      cost: { tech: 1 },
      cooldown: 2,
      effect: [
        {
          type: 'area_damage',
          value: 3,
          target: 'zone_all_enemies',
          duration: 'instant',
          description: '對當前區域所有敵首領造成 3 點傷害'
        },
        {
          type: 'fortification_damage',
          value: 1,
          target: 'current_zone',
          duration: 'instant',
          description: '當前區域築城計數器 -1'
        }
      ]
    },
    
    linkSupport: {
      name: '龍族協同',
      conditionDescription: '與其他 dragon tag 首領聯合攻擊時',
      bonus: {
        attackBonus: 2,
        additionalEffects: [
          {
            type: 'fortification_damage',
            value: 1,
            target: 'target_zone',
            duration: 'instant',
            description: '目標區域築城計數器額外 -1'
          }
        ]
      }
    },
    
    legionSlots: 2,
    tacticalSlot: 1,
    reviveTime: 2,
    
    flavor: '炎龍一族的女王，掌控著毀滅性的龍炎。她的怒火能焚盡一切阻礙。'
  },

  // 2. 征服者 - 風龍女王·希爾薇亞
  {
    id: 'leader_dragon_002',
    name: '風龍女王·希爾薇亞',
    race: 'dragon',
    class: 'conqueror',
    
    baseToughness: 5,
    baseAttack: 4,
    baseDefensiveSupport: 1,
    baseOffensiveSupport: 3,
    baseRecovery: 2,
    
    tags: ['dragon', 'conqueror', 'flying', 'ranged'],
    
    passive: {
      name: '風之翼',
      description: '移動時無視築城計數器阻擋',
      effect: {
        type: 'ignore_fortification',
        target: 'self',
        duration: 'permanent',
        description: '移動時無視築城計數器'
      }
    },
    
    skill: {
      name: '疾風突襲',
      timing: ['after_move'],
      cost: { any: 1 },
      cooldown: 1,
      effect: [
        {
          type: 'attack_bonus',
          value: 3,
          target: 'self',
          duration: 'turn',
          description: '本回合對敵 +3'
        },
        {
          type: 'extra_move',
          value: 1,
          target: 'self',
          duration: 'instant',
          description: '可以再次移動'
        }
      ]
    },
    
    linkSupport: {
      name: '風龍協同',
      conditionDescription: '與其他 flying tag 首領聯合攻擊時',
      bonus: {
        attackBonus: 3,
        offensiveSupportBonus: 1
      }
    },
    
    legionSlots: 2,
    tacticalSlot: 1,
    reviveTime: 2,
    
    flavor: '風龍一族的女王，擁有無與倫比的速度。她的突襲如同狂風，無法阻擋。'
  },

  // 3. 統御者 - 冰龍女王·弗蕾雅
  {
    id: 'leader_dragon_003',
    name: '冰龍女王·弗蕾雅',
    race: 'dragon',
    class: 'commander',
    
    baseToughness: 6,
    baseAttack: 3,
    baseDefensiveSupport: 3,
    baseOffensiveSupport: 3,
    baseRecovery: 3,
    
    tags: ['dragon', 'commander', 'ice', 'magic', 'ranged'],
    
    passive: {
      name: '冰霜光環',
      description: '同區域敵首領對敵 -1',
      effect: {
        type: 'enemy_attack_debuff',
        value: 1,
        target: 'zone_all_enemies',
        duration: 'permanent',
        description: '同區域敵首領對敵 -1'
      }
    },
    
    skill: {
      name: '冰封',
      timing: ['action_start', 'after_attack'],
      cost: { tech: 1 },
      cooldown: 2,
      effect: [
        {
          type: 'freeze',
          target: 'enemy_leader',
          duration: 'turn',
          description: '選擇 1 位敵首領，下回合無法移動'
        },
        {
          type: 'draw',
          value: 1,
          target: 'self',
          duration: 'instant',
          description: '抽 1 張牌'
        }
      ]
    },
    
    linkSupport: {
      name: '冰龍協同',
      conditionDescription: '與其他 dragon tag 首領聯合攻擊時',
      bonus: {
        defensiveSupportBonus: 2,
        additionalEffects: [
          {
            type: 'freeze',
            target: 'attack_target',
            duration: 'turn',
            description: '目標下回合無法移動'
          }
        ]
      }
    },
    
    legionSlots: 2,
    tacticalSlot: 1,
    reviveTime: 1,
    
    flavor: '冰龍一族的女王，掌控著凍結萬物的寒冰。她的智慧如同冰晶般清澈。'
  },

  // 4. 守護者 - 大地龍王·托爾
  {
    id: 'leader_dragon_004',
    name: '大地龍王·托爾',
    race: 'dragon',
    class: 'guardian',
    
    baseToughness: 8,
    baseAttack: 2,
    baseDefensiveSupport: 5,
    baseOffensiveSupport: 0,
    baseRecovery: 4,
    
    tags: ['dragon', 'guardian', 'melee', 'elemental'],
    
    passive: {
      name: '大地之盾',
      description: '受到傷害 -1（最少 1）',
      effect: {
        type: 'damage_reduction',
        value: 1,
        target: 'self',
        duration: 'permanent',
        description: '受到傷害 -1'
      }
    },
    
    skill: {
      name: '石牆築城',
      timing: ['preparation_start', 'action_start'],
      cost: { any: 1 },
      cooldown: 2,
      effect: [
        {
          type: 'fortification_build',
          value: 1,
          target: 'my_zone',
          duration: 'instant',
          description: '選擇 1 個我方區域，築城計數器 +1（最多 2）'
        },
        {
          type: 'toughness_bonus',
          value: 2,
          target: 'zone_all_allies',
          duration: 'turn',
          description: '該區域所有我方首領堅韌 +2（本回合）'
        }
      ]
    },
    
    linkSupport: {
      name: '大地龍協同',
      conditionDescription: '與其他 guardian tag 首領聯合攻擊時',
      bonus: {
        defensiveSupportBonus: 3,
        additionalEffects: [
          {
            type: 'fortification_build',
            value: 1,
            target: 'my_lair',
            duration: 'instant',
            description: '我方基地築城計數器 +1'
          }
        ]
      }
    },
    
    legionSlots: 2,
    tacticalSlot: 1,
    reviveTime: 2,
    
    flavor: '大地龍一族的龍王，擁有堅不可摧的防禦。他的存在就是最強的堡壘。'
  }
]

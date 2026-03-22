// 哈比族首領卡
// 特色：高機動、空中優勢、移動後對敵加成

import type { LeaderCard } from '../../types'

export const harpyLeaders: LeaderCard[] = [
  // 1. 破壞者 - 風暴哈比·蓋爾
  {
    id: 'leader_harpy_001',
    name: '風暴哈比·蓋爾',
    race: 'harpy',
    class: 'destroyer',
    
    baseToughness: 5,
    baseAttack: 5,
    baseDefensiveSupport: 0,
    baseOffensiveSupport: 2,
    baseRecovery: 0,
    
    tags: ['harpy', 'destroyer', 'flying', 'lightning', 'ranged'],
    
    passive: {
      name: '雷霆之翼',
      description: '移動後攻擊時，對敵 +2',
      effect: {
        type: 'attack_bonus_after_move',
        value: 2,
        target: 'self',
        duration: 'turn',
        description: '移動後攻擊時對敵 +2'
      }
    },
    
    skill: {
      name: '雷暴突襲',
      timing: ['after_move'],
      cost: { tech: 1 },
      cooldown: 2,
      effect: [
        {
          type: 'attack_bonus',
          value: 4,
          target: 'self',
          duration: 'turn',
          description: '本回合對敵 +4'
        },
        {
          type: 'area_damage',
          value: 2,
          target: 'zone_all_enemies',
          duration: 'instant',
          description: '對當前區域所有敵首領造成 2 點傷害'
        }
      ]
    },
    
    linkSupport: {
      name: '風暴協同',
      conditionDescription: '與其他 flying tag 首領聯合攻擊時',
      bonus: {
        attackBonus: 3,
        additionalEffects: [
          {
            type: 'stun_chance',
            value: 1,
            target: 'attack_target',
            duration: 'instant',
            description: '如果造成傷害，目標暈眩'
          }
        ]
      }
    },
    
    legionSlots: 2,
    tacticalSlot: 1,
    reviveTime: 1,
    
    flavor: '風暴哈比一族的戰士，掌控著雷霆的力量。她的突襲如同閃電，迅猛無比。'
  },

  // 2. 征服者 - 哈比女王·加魯達
  {
    id: 'leader_harpy_002',
    name: '哈比女王·加魯達',
    race: 'harpy',
    class: 'conqueror',
    
    baseToughness: 5,
    baseAttack: 4,
    baseDefensiveSupport: 1,
    baseOffensiveSupport: 3,
    baseRecovery: 1,
    
    tags: ['harpy', 'conqueror', 'flying', 'ranged', 'beast'],
    
    passive: {
      name: '天空霸主',
      description: '移動時無視築城計數器阻擋',
      effect: {
        type: 'ignore_fortification',
        target: 'self',
        duration: 'permanent',
        description: '移動時無視築城計數器'
      }
    },
    
    skill: {
      name: '天空突襲',
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
      name: '哈比協同',
      conditionDescription: '與其他 harpy tag 首領聯合攻擊時',
      bonus: {
        attackBonus: 2,
        offensiveSupportBonus: 1,
        additionalEffects: [
          {
            type: 'extra_move',
            value: 1,
            target: 'all_participants',
            duration: 'instant',
            description: '所有參與者可以再次移動'
          }
        ]
      }
    },
    
    legionSlots: 2,
    tacticalSlot: 1,
    reviveTime: 1,
    
    flavor: '哈比一族的女王，擁有無與倫比的飛行能力。天空是她的領域，無人能及。'
  },

  // 3. 統御者 - 智慧哈比·雅典娜
  {
    id: 'leader_harpy_003',
    name: '智慧哈比·雅典娜',
    race: 'harpy',
    class: 'commander',
    
    baseToughness: 6,
    baseAttack: 2,
    baseDefensiveSupport: 4,
    baseOffensiveSupport: 4,
    baseRecovery: 3,
    
    tags: ['harpy', 'commander', 'flying', 'magic', 'ranged'],
    
    passive: {
      name: '戰術指揮',
      description: '同區域我方首領協助 +1',
      effect: {
        type: 'ally_support_buff',
        value: 1,
        target: 'zone_all_allies',
        duration: 'permanent',
        description: '同區域我方首領協助 +1'
      }
    },
    
    skill: {
      name: '戰術重組',
      timing: ['preparation_start', 'main_start'],
      cost: { any: 1 },
      cooldown: 2,
      effect: [
        {
          type: 'draw',
          value: 2,
          target: 'self',
          duration: 'instant',
          description: '抽 2 張牌'
        },
        {
          type: 'move_ally',
          value: 1,
          target: 'ally_leader',
          duration: 'instant',
          description: '選擇 1 位我方首領移動到相鄰區域'
        }
      ]
    },
    
    linkSupport: {
      name: '智慧協同',
      conditionDescription: '與其他 commander tag 首領聯合攻擊時',
      bonus: {
        offensiveSupportBonus: 3,
        additionalEffects: [
          {
            type: 'draw',
            value: 1,
            target: 'self',
            duration: 'instant',
            description: '抽 1 張牌'
          }
        ]
      }
    },
    
    legionSlots: 2,
    tacticalSlot: 1,
    reviveTime: 1,
    
    flavor: '智慧哈比一族的領袖，擁有卓越的戰術眼光。她的指揮能扭轉戰局。'
  },

  // 4. 守護者 - 守護哈比·菲莉亞
  {
    id: 'leader_harpy_004',
    name: '守護哈比·菲莉亞',
    race: 'harpy',
    class: 'guardian',
    
    baseToughness: 7,
    baseAttack: 1,
    baseDefensiveSupport: 5,
    baseOffensiveSupport: 1,
    baseRecovery: 3,
    
    tags: ['harpy', 'guardian', 'flying', 'holy'],
    
    passive: {
      name: '聖光庇護',
      description: '同區域我方首領受到傷害 -1',
      effect: {
        type: 'ally_damage_reduction',
        value: 1,
        target: 'zone_all_allies',
        duration: 'permanent',
        description: '同區域我方首領受到傷害 -1'
      }
    },
    
    skill: {
      name: '聖光治癒',
      timing: ['preparation_start', 'end_start'],
      cost: { tech: 1 },
      cooldown: 2,
      effect: [
        {
          type: 'heal',
          value: 3,
          target: 'ally_leader',
          duration: 'instant',
          description: '選擇 1 位我方首領，堅韌 +3（本回合）'
        },
        {
          type: 'remove_debuff',
          target: 'ally_leader',
          duration: 'instant',
          description: '移除該首領的所有負面狀態'
        }
      ]
    },
    
    linkSupport: {
      name: '守護協同',
      conditionDescription: '與其他 guardian tag 首領聯合攻擊時',
      bonus: {
        defensiveSupportBonus: 2,
        additionalEffects: [
          {
            type: 'toughness_bonus',
            value: 2,
            target: 'all_participants',
            duration: 'turn',
            description: '所有參與者堅韌 +2（本回合）'
          }
        ]
      }
    },
    
    legionSlots: 2,
    tacticalSlot: 1,
    reviveTime: 1,
    
    flavor: '守護哈比一族的聖女，擁有治癒的聖光。她的存在是盟友的希望。'
  }
]

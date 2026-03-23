// 海族首領卡
// 特色：治療、水流、協助力強

import type { LeaderCard } from '../../types'

export const aquaticLeaders: LeaderCard[] = [
  // 1. 破壞者 - 深海龍·利維坦
  {
    id: 'leader_aquatic_001',
    name: '深海龍·利維坦',
    race: 'aquatic',
    class: 'destroyer',
    baseToughness: 5,
    baseAttack: 4,
    baseDefensiveSupport: 1,
    baseOffensiveSupport: 1,
    baseRecovery: 1,
    tags: ['aquatic', 'destroyer', 'ice', 'elemental', 'ranged'],
    passive: {
      name: '深海潮汐',
      description: '攻擊時，對同區域所有敵首領造成 1 點傷害',
      effect: {
        type: 'splash_damage',
        value: 1,
        target: 'zone_all_enemies',
        duration: 'permanent',
        description: '攻擊時對同區域所有敵首領造成 1 點傷害'
      }
    },
    skill: {
      name: '海嘯',
      timing: ['action_start'],
      cost: { tech: 1 },
      cooldown: 2,
      effect: [
        {
          type: 'area_damage',
          value: 4,
          target: 'zone_all_enemies',
          duration: 'instant',
          description: '對當前區域所有敵首領造成 4 點傷害'
        },
        {
          type: 'push',
          target: 'zone_all_enemies',
          duration: 'instant',
          description: '將所有敵首領推回相鄰區域'
        }
      ]
    },
    linkSupport: {
      name: '深海協同',
      conditionDescription: '與其他 aquatic tag 首領聯合攻擊時',
      bonus: {
        attackBonus: 2,
        additionalEffects: [
          {
            type: 'freeze',
            target: 'zone_all_enemies',
            duration: 'turn',
            description: '當前區域所有敵首領下回合無法移動'
          }
        ]
      }
    },
    legionSlots: 2,
    tacticalSlot: 1,
    reviveTime: 2,
    flavor: '深海龍一族的霸主，掌控著海洋的力量。他的海嘯能吞沒一切。'
  },

  // 2. 征服者 - 人魚女王·涅瑞伊德
  {
    id: 'leader_aquatic_002',
    name: '人魚女王·涅瑞伊德',
    race: 'aquatic',
    class: 'conqueror',
    baseToughness: 6,
    baseAttack: 3,
    baseDefensiveSupport: 2,
    baseOffensiveSupport: 3,
    baseRecovery: 2,
    tags: ['aquatic', 'conqueror', 'magic', 'ranged'],
    passive: {
      name: '水流加速',
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
      name: '水流突襲',
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
          type: 'heal',
          value: 2,
          target: 'self',
          duration: 'instant',
          description: '堅韌 +2'
        }
      ]
    },
    linkSupport: {
      name: '女王協同',
      conditionDescription: '與其他 aquatic tag 首領聯合攻擊時',
      bonus: {
        attackBonus: 3,
        offensiveSupportBonus: 1,
        additionalEffects: [
          {
            type: 'heal_all',
            value: 1,
            target: 'all_participants',
            duration: 'instant',
            description: '所有參與者堅韌 +1'
          }
        ]
      }
    },
    legionSlots: 2,
    tacticalSlot: 1,
    reviveTime: 1,
    flavor: '人魚一族的女王，擁有優雅的水流之力。她的突襲如同潮水，連綿不絕。'
  },

  // 3. 統御者 - 海神使者·波塞冬
  {
    id: 'leader_aquatic_003',
    name: '海神使者·波塞冬',
    race: 'aquatic',
    class: 'commander',
    baseToughness: 6,
    baseAttack: 2,
    baseDefensiveSupport: 4,
    baseOffensiveSupport: 3,
    baseRecovery: 3,
    tags: ['aquatic', 'commander', 'magic', 'holy', 'ranged'],
    passive: {
      name: '海神祝福',
      description: '同區域我方首領協助 +2',
      effect: {
        type: 'ally_support_buff',
        value: 2,
        target: 'zone_all_allies',
        duration: 'permanent',
        description: '同區域我方首領協助 +2'
      }
    },
    skill: {
      name: '海神恩賜',
      timing: ['preparation_start', 'action_start'],
      cost: { tech: 1 },
      cooldown: 2,
      effect: [
        {
          type: 'heal_all',
          value: 3,
          target: 'all_allies',
          duration: 'instant',
          description: '所有我方首領堅韌 +3'
        },
        {
          type: 'draw',
          value: 2,
          target: 'self',
          duration: 'instant',
          description: '抽 2 張牌'
        }
      ]
    },
    linkSupport: {
      name: '海神協同',
      conditionDescription: '與其他 aquatic tag 首領聯合攻擊時',
      bonus: {
        defensiveSupportBonus: 4,
        additionalEffects: [
          {
            type: 'heal_all',
            value: 2,
            target: 'all_allies',
            duration: 'instant',
            description: '所有我方首領堅韌 +2'
          }
        ]
      }
    },
    legionSlots: 2,
    tacticalSlot: 1,
    reviveTime: 1,
    flavor: '海神使者一族的祭司，擁有海神的祝福。他的恩賜能治癒一切傷痛。'
  },

  // 4. 守護者 - 守護海龜·蓋亞
  {
    id: 'leader_aquatic_004',
    name: '守護海龜·蓋亞',
    race: 'aquatic',
    class: 'guardian',
    baseToughness: 8,
    baseAttack: 2,
    baseDefensiveSupport: 5,
    baseOffensiveSupport: 0,
    baseRecovery: 4,
    tags: ['aquatic', 'guardian', 'beast'],
    passive: {
      name: '龜甲護盾',
      description: '受到傷害 -2（最少 1）',
      effect: {
        type: 'damage_reduction',
        value: 2,
        target: 'self',
        duration: 'permanent',
        description: '受到傷害 -2'
      }
    },
    skill: {
      name: '治癒之泉',
      timing: ['preparation_start', 'end_start'],
      cost: { any: 1 },
      cooldown: 2,
      effect: [
        {
          type: 'heal_all',
          value: 2,
          target: 'all_allies',
          duration: 'instant',
          description: '所有我方首領堅韌 +2'
        },
        {
          type: 'regeneration_buff',
          value: 1,
          target: 'all_allies',
          duration: 'turn',
          description: '所有我方首領下回合開始時堅韌 +1'
        }
      ]
    },
    linkSupport: {
      name: '守護協同',
      conditionDescription: '與其他 guardian tag 首領聯合攻擊時',
      bonus: {
        defensiveSupportBonus: 3,
        additionalEffects: [
          {
            type: 'damage_reduction',
            value: 1,
            target: 'all_participants',
            duration: 'turn',
            description: '所有參與者受到傷害 -1（本回合）'
          }
        ]
      }
    },
    legionSlots: 2,
    tacticalSlot: 1,
    reviveTime: 2,
    flavor: '守護海龜一族的長老，擁有堅不可摧的龜甲。他的存在是最強的防線。'
  }
]

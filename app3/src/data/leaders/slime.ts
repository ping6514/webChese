// 史萊姆族首領卡
// 特色：分裂、復原、生存能力強

import type { LeaderCard } from '../../types'

export const slimeLeaders: LeaderCard[] = [
  // 1. 破壞者 - 熔岩史萊姆王·伊格尼斯
  {
    id: 'leader_slime_001',
    name: '熔岩史萊姆王·伊格尼斯',
    race: 'slime',
    class: 'destroyer',
    baseToughness: 6,
    baseAttack: 4,
    baseDefensiveSupport: 0,
    baseOffensiveSupport: 1,
    baseRecovery: 0,
    tags: ['slime', 'destroyer', 'fire', 'elemental'],
    passive: {
      name: '熔岩之軀',
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
      name: '熔岩爆發',
      timing: ['action_start', 'on_damage_taken'],
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
          type: 'summon_slime',
          value: 1,
          target: 'self',
          duration: 'instant',
          description: '從牌組特殊召喚 1 個史萊姆軍團'
        }
      ]
    },
    linkSupport: {
      name: '熔岩協同',
      conditionDescription: '與其他 slime tag 首領聯合攻擊時',
      bonus: {
        attackBonus: 2,
        additionalEffects: [
          {
            type: 'burn',
            value: 2,
            target: 'attack_target',
            duration: 'turn',
            description: '目標下回合開始時受到 2 點傷害'
          }
        ]
      }
    },
    legionSlots: 2,
    tacticalSlot: 1,
    reviveTime: 2,
    flavor: '熔岩史萊姆一族的王者，擁有灼熱的熔岩之軀。他的怒火能焚盡一切。'
  },

  // 2. 征服者 - 金屬史萊姆·米斯瑞爾
  {
    id: 'leader_slime_002',
    name: '金屬史萊姆·米斯瑞爾',
    race: 'slime',
    class: 'conqueror',
    baseToughness: 6,
    baseAttack: 3,
    baseDefensiveSupport: 2,
    baseOffensiveSupport: 2,
    baseRecovery: 2,
    tags: ['slime', 'conqueror', 'elemental'],
    passive: {
      name: '金屬硬化',
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
      name: '金屬突刺',
      timing: ['after_move', 'before_attack'],
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
          type: 'pierce',
          target: 'self',
          duration: 'turn',
          description: '本回合攻擊無視敵人的傷害減免'
        }
      ]
    },
    linkSupport: {
      name: '金屬協同',
      conditionDescription: '與其他 slime tag 首領聯合攻擊時',
      bonus: {
        attackBonus: 3,
        offensiveSupportBonus: 1
      }
    },
    legionSlots: 2,
    tacticalSlot: 1,
    reviveTime: 1,
    flavor: '金屬史萊姆一族的戰士，擁有堅硬的金屬之軀。他的突刺無堅不摧。'
  },

  // 3. 統御者 - 史萊姆女王·吉莉
  {
    id: 'leader_slime_003',
    name: '史萊姆女王·吉莉',
    race: 'slime',
    class: 'commander',
    baseToughness: 5,
    baseAttack: 2,
    baseDefensiveSupport: 3,
    baseOffensiveSupport: 4,
    baseRecovery: 3,
    tags: ['slime', 'commander', 'elemental'],
    passive: {
      name: '分裂增殖',
      description: '軍團被擊破時，從牌組特殊召喚 2 個普通史萊姆軍團',
      effect: {
        type: 'split_on_legion_destroyed',
        value: 2,
        target: 'self',
        duration: 'permanent',
        description: '軍團被擊破時召喚 2 個小史萊姆'
      }
    },
    skill: {
      name: '史萊姆召集',
      timing: ['preparation_start', 'main_start'],
      cost: { any: 1 },
      cooldown: 2,
      effect: [
        {
          type: 'summon_from_deck',
          value: 2,
          target: 'self',
          duration: 'instant',
          description: '從牌組搜尋最多 2 張史萊姆軍團卡到手牌'
        },
        {
          type: 'special_summon',
          value: 1,
          target: 'self',
          duration: 'instant',
          description: '從手牌特殊召喚 1 個史萊姆軍團'
        }
      ]
    },
    linkSupport: {
      name: '女王協同',
      conditionDescription: '與其他 slime tag 首領聯合攻擊時',
      bonus: {
        offensiveSupportBonus: 3,
        additionalEffects: [
          {
            type: 'summon_slime',
            value: 1,
            target: 'all_participants',
            duration: 'instant',
            description: '所有參與者從牌組特殊召喚 1 個史萊姆軍團'
          }
        ]
      }
    },
    legionSlots: 2,
    tacticalSlot: 1,
    reviveTime: 1,
    flavor: '史萊姆一族的女王，掌控著分裂增殖的能力。她的軍團永無止境。'
  },

  // 4. 守護者 - 治癒史萊姆·希爾
  {
    id: 'leader_slime_004',
    name: '治癒史萊姆·希爾',
    race: 'slime',
    class: 'guardian',
    baseToughness: 7,
    baseAttack: 1,
    baseDefensiveSupport: 5,
    baseOffensiveSupport: 1,
    baseRecovery: 4,
    tags: ['slime', 'guardian', 'elemental', 'holy'],
    passive: {
      name: '自我修復',
      description: '每回合開始時，堅韌 +1（最多恢復到基礎堅韌度）',
      effect: {
        type: 'regeneration',
        value: 1,
        target: 'self',
        duration: 'permanent',
        description: '每回合開始時堅韌 +1'
      }
    },
    skill: {
      name: '治癒波動',
      timing: ['preparation_start', 'end_start'],
      cost: { tech: 1 },
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
          type: 'remove_debuff_all',
          target: 'all_allies',
          duration: 'instant',
          description: '移除所有我方首領的負面狀態'
        }
      ]
    },
    linkSupport: {
      name: '治癒協同',
      conditionDescription: '與其他 guardian tag 首領聯合攻擊時',
      bonus: {
        defensiveSupportBonus: 2,
        additionalEffects: [
          {
            type: 'heal',
            value: 3,
            target: 'all_participants',
            duration: 'instant',
            description: '所有參與者堅韌 +3'
          }
        ]
      }
    },
    legionSlots: 2,
    tacticalSlot: 1,
    reviveTime: 1,
    flavor: '治癒史萊姆一族的守護者，擁有強大的再生能力。他的存在是盟友的希望。'
  }
]

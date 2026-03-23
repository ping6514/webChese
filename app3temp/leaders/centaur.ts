// 半人馬族首領卡
// 特色：突襲、踐踏、連續移動

import type { LeaderCard } from '../../types'

export const centaurLeaders: LeaderCard[] = [
  // 1. 破壞者 - 戰爭半人馬·阿瑞斯
  {
    id: 'leader_centaur_001',
    name: '戰爭半人馬·阿瑞斯',
    race: 'centaur',
    class: 'destroyer',
    baseToughness: 5,
    baseAttack: 5,
    baseDefensiveSupport: 0,
    baseOffensiveSupport: 2,
    baseRecovery: 0,
    tags: ['centaur', 'destroyer', 'melee', 'beast'],
    passive: {
      name: '踐踏衝鋒',
      description: '移動後攻擊時，對敵 +3',
      effect: {
        type: 'attack_bonus_after_move',
        value: 3,
        target: 'self',
        duration: 'turn',
        description: '移動後攻擊時對敵 +3'
      }
    },
    skill: {
      name: '狂暴衝鋒',
      timing: ['after_move'],
      cost: { tech: 1 },
      cooldown: 2,
      effect: [
        {
          type: 'attack_bonus',
          value: 5,
          target: 'self',
          duration: 'turn',
          description: '本回合對敵 +5'
        },
        {
          type: 'trample',
          target: 'self',
          duration: 'turn',
          description: '本回合攻擊造成傷害時，對同區域其他敵首領造成 1 點傷害'
        }
      ]
    },
    linkSupport: {
      name: '戰爭協同',
      conditionDescription: '與其他 centaur tag 首領聯合攻擊時',
      bonus: {
        attackBonus: 3,
        additionalEffects: [
          {
            type: 'trample_all',
            value: 2,
            target: 'zone_all_enemies',
            duration: 'instant',
            description: '對當前區域所有敵首領造成 2 點傷害'
          }
        ]
      }
    },
    legionSlots: 2,
    tacticalSlot: 1,
    reviveTime: 2,
    flavor: '戰爭半人馬一族的戰神，擁有無可匹敵的衝鋒力量。他的踐踏能粉碎一切。'
  },

  // 2. 征服者 - 半人馬女王·希波呂忒
  {
    id: 'leader_centaur_002',
    name: '半人馬女王·希波呂忒',
    race: 'centaur',
    class: 'conqueror',
    baseToughness: 5,
    baseAttack: 4,
    baseDefensiveSupport: 1,
    baseOffensiveSupport: 3,
    baseRecovery: 2,
    tags: ['centaur', 'conqueror', 'melee', 'beast'],
    passive: {
      name: '疾風奔馳',
      description: '可以連續移動 2 次',
      effect: {
        type: 'double_move',
        target: 'self',
        duration: 'permanent',
        description: '可以連續移動 2 次'
      }
    },
    skill: {
      name: '閃電突襲',
      timing: ['after_move'],
      cost: { any: 1 },
      cooldown: 1,
      effect: [
        {
          type: 'attack_bonus',
          value: 4,
          target: 'self',
          duration: 'turn',
          description: '本回合對敵 +4'
        },
        {
          type: 'extra_action',
          value: 1,
          target: 'self',
          duration: 'instant',
          description: '可以再次執行通常動作'
        }
      ]
    },
    linkSupport: {
      name: '女王協同',
      conditionDescription: '與其他 centaur tag 首領聯合攻擊時',
      bonus: {
        attackBonus: 4,
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
    flavor: '半人馬一族的女王，擁有疾風般的速度。她的突襲如同閃電，無法預測。'
  },

  // 3. 統御者 - 智者半人馬·喀戎
  {
    id: 'leader_centaur_003',
    name: '智者半人馬·喀戎',
    race: 'centaur',
    class: 'commander',
    baseToughness: 6,
    baseAttack: 3,
    baseDefensiveSupport: 3,
    baseOffensiveSupport: 4,
    baseRecovery: 3,
    tags: ['centaur', 'commander', 'ranged', 'beast'],
    passive: {
      name: '戰術機動',
      description: '同區域我方首領移動時無視築城計數器',
      effect: {
        type: 'ally_ignore_fortification',
        target: 'zone_all_allies',
        duration: 'permanent',
        description: '同區域我方首領移動時無視築城計數器'
      }
    },
    skill: {
      name: '戰術指導',
      timing: ['preparation_start', 'action_start'],
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
          type: 'move_all_allies',
          value: 1,
          target: 'all_allies',
          duration: 'instant',
          description: '所有我方首領可以移動 1 次'
        }
      ]
    },
    linkSupport: {
      name: '智者協同',
      conditionDescription: '與其他 commander tag 首領聯合攻擊時',
      bonus: {
        offensiveSupportBonus: 3,
        additionalEffects: [
          {
            type: 'attack_bonus',
            value: 2,
            target: 'all_allies',
            duration: 'turn',
            description: '所有我方首領本回合對敵 +2'
          }
        ]
      }
    },
    legionSlots: 2,
    tacticalSlot: 1,
    reviveTime: 1,
    flavor: '智者半人馬一族的導師，擁有卓越的戰術智慧。他的指導能提升全軍戰力。'
  },

  // 4. 守護者 - 守護半人馬·菲洛斯
  {
    id: 'leader_centaur_004',
    name: '守護半人馬·菲洛斯',
    race: 'centaur',
    class: 'guardian',
    baseToughness: 7,
    baseAttack: 3,
    baseDefensiveSupport: 4,
    baseOffensiveSupport: 1,
    baseRecovery: 4,
    tags: ['centaur', 'guardian', 'melee', 'beast'],
    passive: {
      name: '護衛衝鋒',
      description: '同區域我方首領受到攻擊時，可以代替受到傷害',
      effect: {
        type: 'protect_ally',
        target: 'zone_all_allies',
        duration: 'permanent',
        description: '可以代替同區域盟友受到傷害'
      }
    },
    skill: {
      name: '守護衝鋒',
      timing: ['action_start', 'on_ally_attacked'],
      cost: { tech: 1 },
      cooldown: 2,
      effect: [
        {
          type: 'toughness_bonus',
          value: 3,
          target: 'zone_all_allies',
          duration: 'turn',
          description: '同區域所有我方首領堅韌 +3（本回合）'
        },
        {
          type: 'counter_attack',
          value: 2,
          target: 'attacker',
          duration: 'instant',
          description: '對攻擊者造成 2 點反擊傷害'
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
            type: 'damage_reduction',
            value: 2,
            target: 'all_participants',
            duration: 'turn',
            description: '所有參與者受到傷害 -2（本回合）'
          }
        ]
      }
    },
    legionSlots: 2,
    tacticalSlot: 1,
    reviveTime: 2,
    flavor: '守護半人馬一族的騎士，擁有堅定的守護意志。他的存在是盟友的盾牌。'
  }
]

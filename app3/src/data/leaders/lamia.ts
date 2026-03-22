// 拉米亞族首領卡
// 特色：詛咒、控制、負面狀態

import type { LeaderCard } from '../../types'

export const lamiaLeaders: LeaderCard[] = [
  // 1. 破壞者 - 毒蛇拉米亞·維諾姆
  {
    id: 'leader_lamia_001',
    name: '毒蛇拉米亞·維諾姆',
    race: 'lamia',
    class: 'destroyer',
    baseToughness: 5,
    baseAttack: 4,
    baseDefensiveSupport: 1,
    baseOffensiveSupport: 1,
    baseRecovery: 1,
    tags: ['lamia', 'destroyer', 'poison', 'melee'],
    passive: {
      name: '劇毒之牙',
      description: '造成傷害時，目標下回合對敵 -2',
      effect: {
        type: 'poison_debuff',
        value: 2,
        target: 'damage_target',
        duration: 'turn',
        description: '造成傷害時目標下回合對敵 -2'
      }
    },
    skill: {
      name: '毒霧',
      timing: ['action_start'],
      cost: { tech: 1 },
      cooldown: 2,
      effect: [
        {
          type: 'area_debuff',
          value: 2,
          target: 'zone_all_enemies',
          duration: 'turn',
          description: '當前區域所有敵首領對敵 -2（本回合）'
        },
        {
          type: 'damage_over_time',
          value: 1,
          target: 'zone_all_enemies',
          duration: 'turn',
          description: '下回合開始時受到 1 點傷害'
        }
      ]
    },
    linkSupport: {
      name: '毒蛇協同',
      conditionDescription: '與其他 lamia tag 首領聯合攻擊時',
      bonus: {
        attackBonus: 2,
        additionalEffects: [
          {
            type: 'disable_move',
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
    flavor: '毒蛇拉米亞一族的刺客，掌控著致命的毒素。她的毒牙能癱瘓敵人。'
  },

  // 2. 征服者 - 暗影拉米亞·夜影
  {
    id: 'leader_lamia_002',
    name: '暗影拉米亞·夜影',
    race: 'lamia',
    class: 'conqueror',
    baseToughness: 6,
    baseAttack: 3,
    baseDefensiveSupport: 2,
    baseOffensiveSupport: 2,
    baseRecovery: 1,
    tags: ['lamia', 'conqueror', 'dark', 'melee'],
    passive: {
      name: '暗影潛行',
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
      name: '軟癱瘓',
      timing: ['action_start', 'after_attack'],
      cost: { discard: 1 },
      cooldown: 2,
      effect: [
        {
          type: 'disable_move',
          target: 'enemy_leader',
          duration: 'turn',
          description: '選擇 1 位敵首領，下回合無法移動'
        },
        {
          type: 'attack_debuff',
          value: 3,
          target: 'same_target',
          duration: 'turn',
          description: '目標下回合對敵 -3'
        },
        {
          type: 'support_debuff',
          value: 3,
          target: 'same_target',
          duration: 'turn',
          description: '目標下回合攻擊協助 -3'
        }
      ]
    },
    linkSupport: {
      name: '暗影協同',
      conditionDescription: '與其他 dark tag 首領聯合攻擊時',
      bonus: {
        attackBonus: 3,
        additionalEffects: [
          {
            type: 'execute',
            target: 'attack_target',
            duration: 'instant',
            description: '如果目標已暈眩，直接收割'
          }
        ]
      }
    },
    legionSlots: 2,
    tacticalSlot: 1,
    reviveTime: 1,
    flavor: '暗影拉米亞一族的殺手，擅長暗殺。她的利刃在黑暗中閃爍。'
  },

  // 3. 統御者 - 拉米亞女王·梅杜莎
  {
    id: 'leader_lamia_003',
    name: '拉米亞女王·梅杜莎',
    race: 'lamia',
    class: 'commander',
    baseToughness: 6,
    baseAttack: 2,
    baseDefensiveSupport: 4,
    baseOffensiveSupport: 3,
    baseRecovery: 2,
    tags: ['lamia', 'commander', 'magic', 'ranged'],
    passive: {
      name: '石化凝視',
      description: '造成傷害時，目標下回合對敵 -2',
      effect: {
        type: 'attack_debuff_on_damage',
        value: 2,
        target: 'damage_target',
        duration: 'turn',
        description: '造成傷害時目標下回合對敵 -2'
      }
    },
    skill: {
      name: '女王召喚',
      timing: ['action_start'],
      cost: { discard: 1 },
      cooldown: 3,
      effect: [
        {
          type: 'force_move',
          target: 'enemy_leader',
          direction: 'towards_self',
          value: 1,
          duration: 'instant',
          description: '選擇 1 位敵首領，強制移動 1 格朝向自己所在區域'
        },
        {
          type: 'toughness_debuff',
          value: 2,
          target: 'same_target',
          duration: 'turn',
          description: '目標本回合堅韌 -2'
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
      name: '女王協同',
      conditionDescription: '與其他 lamia tag 首領聯合攻擊時',
      bonus: {
        offensiveSupportBonus: 2,
        additionalEffects: [
          {
            type: 'extend_stun',
            value: 1,
            target: 'attack_target',
            duration: 'turn',
            description: '目標暈眩持續時間 +1 回合'
          }
        ]
      }
    },
    legionSlots: 2,
    tacticalSlot: 1,
    reviveTime: 2,
    flavor: '拉米亞一族的女王，擁有石化的魔眼。凝視她的雙眼，將化為石像。'
  },

  // 4. 守護者 - 守護拉米亞·塞壬
  {
    id: 'leader_lamia_004',
    name: '守護拉米亞·塞壬',
    race: 'lamia',
    class: 'guardian',
    baseToughness: 7,
    baseAttack: 2,
    baseDefensiveSupport: 4,
    baseOffensiveSupport: 2,
    baseRecovery: 3,
    tags: ['lamia', 'guardian', 'magic'],
    passive: {
      name: '魅惑之歌',
      description: '敵人攻擊同區域我方首領時，對敵 -1',
      effect: {
        type: 'enemy_attack_debuff_zone',
        value: 1,
        target: 'zone_all_enemies',
        duration: 'permanent',
        description: '同區域敵人攻擊時對敵 -1'
      }
    },
    skill: {
      name: '催眠之歌',
      timing: ['preparation_start', 'action_start'],
      cost: { any: 1 },
      cooldown: 2,
      effect: [
        {
          type: 'disable_action',
          target: 'enemy_leader',
          duration: 'turn',
          description: '選擇 1 位敵首領，本回合無法行動'
        },
        {
          type: 'support_bonus',
          value: 2,
          target: 'zone_all_allies',
          duration: 'turn',
          description: '同區域我方首領協助 +2（本回合）'
        }
      ]
    },
    linkSupport: {
      name: '塞壬協同',
      conditionDescription: '與其他 guardian tag 首領聯合攻擊時',
      bonus: {
        defensiveSupportBonus: 3,
        additionalEffects: [
          {
            type: 'disable_move',
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
    flavor: '守護拉米亞一族的歌者，擁有魅惑的歌聲。她的歌聲能控制敵人的心智。'
  }
]

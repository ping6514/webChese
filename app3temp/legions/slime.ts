// 史萊姆族軍團卡
// 特色：分裂、復原、召喚、生存

import type { LegionCard } from '../../types'

export const slimeLegions: LegionCard[] = [
  // ==================== 普通軍團 ====================
  
  // 1. 小史萊姆（普通）
  {
    id: 'legion_slime_001',
    name: '小史萊姆',
    race: 'slime',
    type: 'infantry',
    rank: 'normal',
    tags: ['slime', 'infantry', 'elemental'],
    bonusStats: { toughness: 2, attack: 0, defensiveSupport: 1, offensiveSupport: 0, recovery: 1 },
    passive: {
      name: '分裂增殖',
      description: '被擊破時，從牌組特殊召喚 1 個小史萊姆',
      effect: {
        type: 'split_on_destroyed',
        value: 1,
        target: 'deck',
        duration: 'instant',
        description: '被擊破時分裂'
      }
    },
    onLeaderKO: {
      type: 'discard',
      effect: {
        type: 'summon_from_deck',
        value: 1,
        target: 'self',
        duration: 'instant',
        description: '從牌組特殊召喚 1 個史萊姆軍團'
      }
    },
    flavor: '最基礎的史萊姆，擁有分裂增殖的能力。'
  },

  // 2. 金屬史萊姆（普通）
  {
    id: 'legion_slime_002',
    name: '金屬史萊姆',
    race: 'slime',
    type: 'infantry',
    rank: 'normal',
    tags: ['slime', 'infantry', 'elemental'],
    bonusStats: { toughness: 3, attack: 0, defensiveSupport: 1, offensiveSupport: 0, recovery: 1 },
    passive: {
      name: '金屬硬化',
      description: '如果首領有 elemental tag，受到傷害-1',
      effect: {
        type: 'damage_reduction_if_leader_has_tag',
        value: 1,
        tag: 'elemental',
        target: 'self',
        duration: 'permanent',
        description: '首領有 elemental tag 時受到傷害-1'
      }
    },
    onLeaderKO: {
      type: 'discard',
      effect: {
        type: 'shield',
        target: 'ally_leader',
        duration: 'turn',
        description: '選擇 1 位我方首領，下次受到攻擊傷害歸 0'
      }
    },
    flavor: '金屬史萊姆一族，擁有堅硬的金屬之軀。'
  },

  // ==================== 精英軍團 ====================

  // 3. 熔岩史萊姆（精英）
  {
    id: 'legion_slime_003',
    name: '熔岩史萊姆',
    race: 'slime',
    type: 'mage',
    rank: 'elite',
    tags: ['slime', 'mage', 'fire', 'elemental'],
    bonusStats: { toughness: 2, attack: 2, defensiveSupport: 0, offensiveSupport: 1, recovery: 0 },
    passive: {
      name: '熔岩之軀',
      description: '如果首領有 fire tag，受到攻擊時對攻擊者造成 1 點反擊傷害',
      effect: {
        type: 'reflect_if_leader_has_tag',
        value: 1,
        tag: 'fire',
        target: 'attacker',
        duration: 'permanent',
        description: '首領有 fire tag 時反擊傷害'
      }
    },
    activeSkill: {
      name: '熔岩爆發',
      timing: ['action_start', 'on_damage_taken'],
      cost: { any: 1 },
      cooldown: 2,
      effect: {
        type: 'area_damage_and_summon',
        value: 3,
        target: 'zone_all_enemies',
        duration: 'instant',
        description: '對當前區域所有敵首領造成 3 點傷害，並從牌組特殊召喚 1 個史萊姆'
      }
    },
    onLeaderKO: {
      type: 'choice',
      cost: { discard: 1 },
      effect: {
        type: 'burn',
        value: 3,
        target: 'zone_all_enemies',
        duration: 'turn',
        description: '丟棄1張手牌保留，否則丟棄並對當前區域所有敵首領造成 3 點火焰傷害'
      }
    },
    flavor: '熔岩史萊姆一族，擁有灼熱的熔岩之軀。'
  },

  // 4. 治癒史萊姆（精英）
  {
    id: 'legion_slime_004',
    name: '治癒史萊姆',
    race: 'slime',
    type: 'mage',
    rank: 'elite',
    tags: ['slime', 'mage', 'holy', 'elemental'],
    bonusStats: { toughness: 2, attack: 0, defensiveSupport: 2, offensiveSupport: 0, recovery: 2 },
    passive: {
      name: '自我修復',
      description: '每回合開始時，首領堅韌+1',
      effect: {
        type: 'regeneration',
        value: 1,
        target: 'leader',
        duration: 'permanent',
        description: '每回合開始時堅韌+1'
      }
    },
    activeSkill: {
      name: '治癒波動',
      timing: ['preparation_start', 'end_start'],
      cost: { any: 1 },
      cooldown: 2,
      effect: {
        type: 'heal_all',
        value: 2,
        target: 'all_allies',
        duration: 'instant',
        description: '所有我方首領堅韌+2'
      }
    },
    onLeaderKO: {
      type: 'choice',
      cost: { tech: 1 },
      effect: {
        type: 'instant_revive',
        target: 'self',
        duration: 'instant',
        description: '支付1技能點保留，否則丟棄並首領立即復活'
      }
    },
    flavor: '治癒史萊姆一族，擁有強大的再生能力。'
  },

  // ==================== 傳說軍團 ====================

  // 5. 史萊姆王（傳說）
  {
    id: 'legion_slime_005',
    name: '史萊姆王',
    race: 'slime',
    type: 'mage',
    rank: 'legendary',
    tags: ['slime', 'mage', 'elemental', 'fire', 'ice', 'holy'],
    bonusStats: { toughness: 3, attack: 1, defensiveSupport: 2, offensiveSupport: 1, recovery: 2 },
    summonCost: { tributeCount: 3 },
    passive: {
      name: '史萊姆召集',
      description: '每回合準備階段，從牌組特殊召喚 1 個史萊姆軍團',
      effect: {
        type: 'summon_from_deck_per_turn',
        value: 1,
        target: 'deck',
        duration: 'permanent',
        description: '每回合召喚史萊姆'
      }
    },
    activeSkill: {
      name: '史萊姆大軍',
      timing: ['main_start'],
      cost: { tech: 1 },
      cooldown: 3,
      effect: {
        type: 'mass_summon',
        target: 'hand_all_slimes',
        duration: 'instant',
        description: '從手牌特殊召喚所有史萊姆軍團'
      }
    },
    sacrificeSkill: {
      name: '王者獻祭',
      effect: {
        type: 'heal_all_and_summon',
        value: 5,
        target: 'all_allies',
        duration: 'instant',
        description: '犧牲本軍團，所有我方首領堅韌+5，並從牌組特殊召喚 3 個史萊姆'
      }
    },
    onLeaderKO: {
      type: 'keep',
      effect: {
        type: 'summon_from_deck',
        value: 2,
        target: 'self',
        duration: 'instant',
        description: '保留，並從牌組特殊召喚 2 個史萊姆軍團'
      }
    },
    flavor: '史萊姆一族的王者，掌控著所有史萊姆的力量。'
  }
]

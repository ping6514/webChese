// 半人馬族軍團卡
// 特色：突襲、踐踏、連續移動、衝鋒

import type { LegionCard } from '../../types'

export const centaurLegions: LegionCard[] = [
  // ==================== 普通軍團 ====================
  
  // 1. 半人馬騎兵（普通）
  {
    id: 'legion_centaur_001',
    name: '半人馬騎兵',
    race: 'centaur',
    type: 'cavalry',
    rank: 'normal',
    tags: ['centaur', 'cavalry', 'melee', 'beast'],
    bonusStats: { toughness: 1, attack: 2, defensiveSupport: 0, offensiveSupport: 1, recovery: 0 },
    passive: {
      name: '衝鋒之力',
      description: '移動後攻擊時，對敵+1',
      effect: {
        type: 'attack_bonus_after_move',
        value: 1,
        target: 'self',
        duration: 'turn',
        description: '移動後攻擊時對敵+1'
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
    flavor: '半人馬一族的騎兵，擅長衝鋒突襲。'
  },

  // 2. 半人馬弓手（普通）
  {
    id: 'legion_centaur_002',
    name: '半人馬弓手',
    race: 'centaur',
    type: 'archer',
    rank: 'normal',
    tags: ['centaur', 'archer', 'ranged', 'beast'],
    bonusStats: { toughness: 1, attack: 1, defensiveSupport: 1, offensiveSupport: 1, recovery: 1 },
    passive: {
      name: '移動射擊',
      description: '移動後，協助+1（本回合）',
      effect: {
        type: 'support_bonus_after_move',
        value: 1,
        target: 'self',
        duration: 'turn',
        description: '移動後協助+1'
      }
    },
    onLeaderKO: {
      type: 'discard',
      effect: {
        type: 'attack_bonus',
        value: 2,
        target: 'all_allies',
        duration: 'turn',
        description: '所有我方首領對敵+2（本回合）'
      }
    },
    flavor: '半人馬一族的弓手，擅長移動射擊。'
  },

  // ==================== 精英軍團 ====================

  // 3. 戰爭半人馬（精英）
  {
    id: 'legion_centaur_003',
    name: '戰爭半人馬',
    race: 'centaur',
    type: 'cavalry',
    rank: 'elite',
    tags: ['centaur', 'cavalry', 'melee', 'beast'],
    bonusStats: { toughness: 2, attack: 3, defensiveSupport: 0, offensiveSupport: 1, recovery: 0 },
    passive: {
      name: '踐踏衝鋒',
      description: '移動後攻擊時，對敵+2，並對同區域其他敵首領造成 1 點傷害',
      effect: {
        type: 'trample_after_move',
        value: 2,
        target: 'self',
        duration: 'turn',
        description: '移動後攻擊加成並踐踏'
      }
    },
    activeSkill: {
      name: '狂暴衝鋒',
      timing: ['after_move'],
      cost: { any: 1 },
      cooldown: 2,
      effect: {
        type: 'attack_boost_and_trample',
        value: 4,
        target: 'self',
        duration: 'turn',
        description: '本回合對敵+4，攻擊造成傷害時對同區域其他敵首領造成 2 點傷害'
      }
    },
    onLeaderKO: {
      type: 'choice',
      cost: { discard: 1 },
      effect: {
        type: 'trample_all',
        value: 3,
        target: 'zone_all_enemies',
        duration: 'instant',
        description: '丟棄1張手牌保留，否則丟棄並對當前區域所有敵首領造成 3 點傷害'
      }
    },
    flavor: '戰爭半人馬一族的精銳，擁有無可匹敵的衝鋒力量。'
  },

  // 4. 智者半人馬（精英）
  {
    id: 'legion_centaur_004',
    name: '智者半人馬',
    race: 'centaur',
    type: 'mage',
    rank: 'elite',
    tags: ['centaur', 'mage', 'ranged', 'beast'],
    bonusStats: { toughness: 1, attack: 1, defensiveSupport: 2, offensiveSupport: 1, recovery: 1 },
    passive: {
      name: '戰術機動',
      description: '同區域所有我方首領移動時無視築城計數器',
      effect: {
        type: 'ally_ignore_fortification',
        target: 'zone_all_allies',
        duration: 'permanent',
        description: '盟友移動時無視築城'
      }
    },
    activeSkill: {
      name: '戰術指導',
      timing: ['preparation_start', 'action_start'],
      cost: { any: 1 },
      cooldown: 2,
      effect: {
        type: 'draw_and_move_allies',
        value: 2,
        target: 'all_allies',
        duration: 'instant',
        description: '抽 2 張牌，所有我方首領可以移動 1 次'
      }
    },
    onLeaderKO: {
      type: 'choice',
      cost: { tech: 1 },
      effect: {
        type: 'recall_all',
        target: 'all_allies',
        duration: 'instant',
        description: '支付1技能點保留，否則丟棄並所有我方首領移動到我方基地'
      }
    },
    flavor: '智者半人馬一族的導師，擁有卓越的戰術智慧。'
  },

  // ==================== 傳說軍團 ====================

  // 5. 半人馬戰神（傳說）
  {
    id: 'legion_centaur_005',
    name: '半人馬戰神',
    race: 'centaur',
    type: 'cavalry',
    rank: 'legendary',
    tags: ['centaur', 'cavalry', 'melee', 'beast'],
    bonusStats: { toughness: 3, attack: 4, defensiveSupport: 1, offensiveSupport: 1, recovery: 1 },
    summonCost: { tributeCount: 2, tributeRace: 'centaur' },
    passive: {
      name: '疾風奔馳',
      description: '可以連續移動 2 次，移動後本回合對敵+3',
      effect: {
        type: 'double_move_and_attack_boost',
        value: 3,
        target: 'self',
        duration: 'permanent',
        description: '連續移動並獲得攻擊加成'
      }
    },
    activeSkill: {
      name: '閃電突襲',
      timing: ['after_move'],
      cost: { any: 1 },
      cooldown: 1,
      effect: {
        type: 'attack_boost_and_extra_action',
        value: 5,
        target: 'self',
        duration: 'turn',
        description: '本回合對敵+5，可以再次執行通常動作'
      }
    },
    sacrificeSkill: {
      name: '戰神衝鋒',
      effect: {
        type: 'move_all_and_attack_boost',
        value: 3,
        target: 'all_allies',
        duration: 'turn',
        description: '犧牲本軍團，所有我方首領移動到任意區域並對敵+3（本回合）'
      }
    },
    onLeaderKO: {
      type: 'keep',
      effect: {
        type: 'attack_bonus',
        value: 4,
        target: 'self',
        duration: 'turn',
        description: '保留，下次復活時對敵+4（本回合）'
      }
    },
    flavor: '半人馬一族的戰神，擁有疾風般的速度和無可匹敵的戰鬥力。'
  }
]

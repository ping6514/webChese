// 海族軍團卡
// 特色：治療、水流、協助力、冰霜

import type { LegionCard } from '../../app3/src/types'

export const aquaticLegions: LegionCard[] = [
  // ==================== 普通軍團 ====================
  
  // 1. 海族戰士（普通）
  {
    id: 'legion_aquatic_001',
    name: '海族戰士',
    race: 'aquatic',
    type: 'infantry',
    rank: 'normal',
    tags: ['aquatic', 'infantry', 'ice', 'elemental'],
    bonusStats: { toughness: 2, attack: 1, defensiveSupport: 0, offensiveSupport: 1, recovery: 0 },
    passive: {
      name: '冰霜之力',
      description: '如果首領有 ice tag，攻擊時目標下回合無法移動',
      effect: {
        type: 'freeze_on_attack_if_leader_has_tag',
        tag: 'ice',
        target: 'attack_target',
        duration: 'turn',
        description: '首領有 ice tag 時攻擊凍結敵人'
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
    flavor: '海族的基礎戰士，掌握著冰霜的力量。'
  },

  // 2. 海族治療者（普通）
  {
    id: 'legion_aquatic_002',
    name: '海族治療者',
    race: 'aquatic',
    type: 'mage',
    rank: 'normal',
    tags: ['aquatic', 'mage', 'holy', 'magic'],
    bonusStats: { toughness: 1, attack: 0, defensiveSupport: 2, offensiveSupport: 0, recovery: 2 },
    passive: {
      name: '治癒之力',
      description: '每回合準備階段，首領堅韌+1',
      effect: {
        type: 'regeneration',
        value: 1,
        target: 'leader',
        duration: 'permanent',
        description: '每回合開始時堅韌+1'
      }
    },
    onLeaderKO: {
      type: 'discard',
      effect: {
        type: 'heal',
        value: 3,
        target: 'ally_leader',
        duration: 'instant',
        description: '選擇 1 位我方首領，堅韌+3'
      }
    },
    flavor: '海族的治療者，擁有治癒的能力。'
  },

  // ==================== 精英軍團 ====================

  // 3. 深海法師（精英）
  {
    id: 'legion_aquatic_003',
    name: '深海法師',
    race: 'aquatic',
    type: 'mage',
    rank: 'elite',
    tags: ['aquatic', 'mage', 'ice', 'magic', 'ranged'],
    bonusStats: { toughness: 1, attack: 2, defensiveSupport: 1, offensiveSupport: 1, recovery: 1 },
    passive: {
      name: '深海潮汐',
      description: '如果首領有 ice tag，攻擊時對同區域所有敵首領造成 1 點傷害',
      effect: {
        type: 'splash_damage_if_leader_has_tag',
        value: 1,
        tag: 'ice',
        target: 'zone_all_enemies',
        duration: 'permanent',
        description: '首領有 ice tag 時濺射傷害'
      }
    },
    activeSkill: {
      name: '海嘯',
      timing: ['action_start'],
      cost: { tech: 1 },
      cooldown: 2,
      effect: {
        type: 'area_damage_and_push',
        value: 4,
        target: 'zone_all_enemies',
        duration: 'instant',
        description: '對當前區域所有敵首領造成 4 點傷害，並推回相鄰區域'
      }
    },
    onLeaderKO: {
      type: 'choice',
      cost: { discard: 1 },
      effect: {
        type: 'push_all',
        target: 'zone_all_enemies',
        duration: 'instant',
        description: '丟棄1張手牌保留，否則丟棄並將當前區域所有敵首領推回相鄰區域'
      }
    },
    flavor: '深海法師一族，掌控著海洋的力量。'
  },

  // 4. 海神祭司（精英）
  {
    id: 'legion_aquatic_004',
    name: '海神祭司',
    race: 'aquatic',
    type: 'mage',
    rank: 'elite',
    tags: ['aquatic', 'mage', 'holy', 'magic'],
    bonusStats: { toughness: 2, attack: 0, defensiveSupport: 2, offensiveSupport: 1, recovery: 2 },
    passive: {
      name: '海神祝福',
      description: '同區域所有我方首領協助+1',
      effect: {
        type: 'ally_support_buff',
        value: 1,
        target: 'zone_all_allies',
        duration: 'permanent',
        description: '盟友協助+1'
      }
    },
    activeSkill: {
      name: '海神恩賜',
      timing: ['preparation_start', 'action_start'],
      cost: { any: 1 },
      cooldown: 2,
      effect: {
        type: 'heal_all_and_draw',
        value: 2,
        target: 'all_allies',
        duration: 'instant',
        description: '所有我方首領堅韌+2，抽 1 張牌'
      }
    },
    onLeaderKO: {
      type: 'choice',
      cost: { tech: 1 },
      effect: {
        type: 'heal_all',
        value: 3,
        target: 'all_allies',
        duration: 'instant',
        description: '支付1技能點保留，否則丟棄並所有我方首領堅韌+3'
      }
    },
    flavor: '海神祭司一族，擁有海神的祝福。'
  },

  // ==================== 傳說軍團 ====================

  // 5. 深海龍王（傳說）
  {
    id: 'legion_aquatic_005',
    name: '深海龍王',
    race: 'aquatic',
    type: 'mage',
    rank: 'legendary',
    tags: ['aquatic', 'mage', 'ice', 'holy', 'elemental', 'magic'],
    bonusStats: { toughness: 3, attack: 2, defensiveSupport: 3, offensiveSupport: 1, recovery: 2 },
    summonCost: { tributeCount: 2, tributeRace: 'aquatic' },
    passive: {
      name: '深海領域',
      description: '同區域所有我方首領協助+2，所有敵首領對敵-1',
      effect: {
        type: 'area_buff_and_debuff',
        value: 2,
        target: 'zone',
        duration: 'permanent',
        description: '區域增益和減益'
      }
    },
    activeSkill: {
      name: '深海之怒',
      timing: ['action_start'],
      cost: { tech: 1 },
      cooldown: 2,
      effect: {
        type: 'area_damage_freeze_heal',
        value: 5,
        target: 'zone_all_enemies',
        duration: 'instant',
        description: '對當前區域所有敵首領造成 5 點傷害並凍結，所有我方首領堅韌+3'
      }
    },
    sacrificeSkill: {
      name: '深海獻祭',
      effect: {
        type: 'heal_all_and_instant_revive',
        value: 5,
        target: 'all_allies',
        duration: 'instant',
        description: '犧牲本軍團，所有我方首領堅韌+5，立即復活 1 位 KO 狀態的我方首領'
      }
    },
    onLeaderKO: {
      type: 'keep',
      effect: {
        type: 'support_bonus',
        value: 4,
        target: 'self',
        duration: 'turn',
        description: '保留，下次復活時協助+4（本回合）'
      }
    },
    flavor: '深海龍王一族的統治者，掌控著深海的所有力量。'
  }
]

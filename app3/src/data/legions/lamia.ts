// 拉米亞族軍團卡
// 特色：控制、詛咒、毒素、暗影

import type { LegionCard } from '../../types'

export const lamiaLegions: LegionCard[] = [
  // ==================== 普通軍團 ====================
  
  // 1. 毒蛇刺客（普通）
  {
    id: 'legion_lamia_001',
    name: '毒蛇刺客',
    race: 'lamia',
    type: 'infantry',
    rank: 'normal',
    tags: ['lamia', 'infantry', 'poison', 'melee'],
    bonusStats: { toughness: 1, attack: 2, defensiveSupport: 0, offensiveSupport: 1, recovery: 0 },
    passive: {
      name: '劇毒之刃',
      description: '如果首領有 poison tag，造成傷害時目標下回合對敵-1',
      effect: {
        type: 'poison_debuff_if_leader_has_tag',
        value: 1,
        tag: 'poison',
        target: 'damage_target',
        duration: 'turn',
        description: '首領有 poison tag 時造成中毒效果'
      }
    },
    onLeaderKO: {
      type: 'discard',
      effect: {
        type: 'poison',
        value: 2,
        target: 'attacker',
        duration: 'turn',
        description: '擊破者下 2 回合開始時受到 1 點毒素傷害'
      }
    },
    flavor: '毒蛇拉米亞一族的刺客，擅長使用毒素。'
  },

  // 2. 暗影潛行者（普通）
  {
    id: 'legion_lamia_002',
    name: '暗影潛行者',
    race: 'lamia',
    type: 'archer',
    rank: 'normal',
    tags: ['lamia', 'archer', 'dark', 'ranged'],
    bonusStats: { toughness: 1, attack: 1, defensiveSupport: 1, offensiveSupport: 1, recovery: 1 },
    passive: {
      name: '暗影之力',
      description: '如果首領有 dark tag，對暈眩敵人對敵+2',
      effect: {
        type: 'attack_bonus_vs_stunned_if_leader_has_tag',
        value: 2,
        tag: 'dark',
        target: 'self',
        duration: 'permanent',
        description: '首領有 dark tag 時對暈眩敵人對敵+2'
      }
    },
    onLeaderKO: {
      type: 'discard',
      effect: {
        type: 'stealth',
        target: 'ally_leader',
        duration: 'turn',
        description: '選擇 1 位我方首領，本回合無法被指定為攻擊目標'
      }
    },
    flavor: '暗影拉米亞一族的潛行者，擅長暗殺。'
  },

  // ==================== 精英軍團 ====================

  // 3. 魅惑歌者（精英）
  {
    id: 'legion_lamia_003',
    name: '魅惑歌者',
    race: 'lamia',
    type: 'mage',
    rank: 'elite',
    tags: ['lamia', 'mage', 'magic', 'ranged'],
    bonusStats: { toughness: 2, attack: 1, defensiveSupport: 1, offensiveSupport: 1, recovery: 1 },
    passive: {
      name: '魅惑之歌',
      description: '如果首領有 magic tag，同區域敵首領攻擊時對敵-1',
      effect: {
        type: 'enemy_attack_debuff_if_leader_has_tag',
        value: 1,
        tag: 'magic',
        target: 'zone_all_enemies',
        duration: 'permanent',
        description: '首領有 magic tag 時敵人攻擊減弱'
      }
    },
    activeSkill: {
      name: '催眠術',
      timing: ['action_start'],
      cost: { any: 1 },
      cooldown: 2,
      effect: {
        type: 'disable',
        target: 'enemy_leader',
        duration: 'turn',
        description: '選擇 1 位敵首領，本回合無法行動'
      }
    },
    onLeaderKO: {
      type: 'choice',
      cost: { discard: 1 },
      effect: {
        type: 'confuse',
        target: 'zone_all_enemies',
        duration: 'turn',
        description: '丟棄1張手牌保留，否則丟棄並當前區域所有敵首領混亂（攻擊隨機目標）'
      }
    },
    flavor: '魅惑歌者一族的法師，擁有控制心智的能力。'
  },

  // 4. 石化蛇妖（精英）
  {
    id: 'legion_lamia_004',
    name: '石化蛇妖',
    race: 'lamia',
    type: 'mage',
    rank: 'elite',
    tags: ['lamia', 'mage', 'magic'],
    bonusStats: { toughness: 2, attack: 2, defensiveSupport: 0, offensiveSupport: 1, recovery: 0 },
    passive: {
      name: '石化凝視',
      description: '造成傷害時，如果傷害≥目標堅韌度，目標暈眩',
      effect: {
        type: 'petrify_on_damage',
        target: 'damage_target',
        duration: 'instant',
        description: '造成足夠傷害時使目標暈眩'
      }
    },
    activeSkill: {
      name: '群體石化',
      timing: ['action_start'],
      cost: { tech: 1 },
      cooldown: 3,
      effect: {
        type: 'area_stun',
        target: 'zone_all_enemies',
        duration: 'instant',
        description: '當前區域所有敵首領暈眩'
      }
    },
    onLeaderKO: {
      type: 'choice',
      cost: { tech: 1 },
      effect: {
        type: 'destroy_legion',
        target: 'attacker_legion',
        duration: 'instant',
        description: '支付1技能點保留，否則丟棄並破壞擊破者的 1 個軍團'
      }
    },
    flavor: '石化蛇妖一族的魔眼持有者，凝視即可石化敵人。'
  },

  // ==================== 傳說軍團 ====================

  // 5. 蛇妖女王（傳說）
  {
    id: 'legion_lamia_005',
    name: '蛇妖女王',
    race: 'lamia',
    type: 'mage',
    rank: 'legendary',
    tags: ['lamia', 'mage', 'poison', 'dark', 'magic'],
    bonusStats: { toughness: 2, attack: 2, defensiveSupport: 2, offensiveSupport: 1, recovery: 1 },
    summonCost: { tributeCount: 2, tributeRace: 'lamia' },
    passive: {
      name: '詛咒領域',
      description: '同區域所有敵首領對敵-2，協助-1',
      effect: {
        type: 'area_debuff',
        value: 2,
        target: 'zone_all_enemies',
        duration: 'permanent',
        description: '敵人全屬性降低'
      }
    },
    activeSkill: {
      name: '死亡詛咒',
      timing: ['action_start'],
      cost: { tech: 1 },
      cooldown: 2,
      effect: {
        type: 'curse_and_destroy_legion',
        target: 'enemy_leader',
        duration: 'instant',
        description: '選擇 1 位敵首領，暈眩並破壞其所有軍團'
      }
    },
    sacrificeSkill: {
      name: '蛇妖獻祭',
      effect: {
        type: 'mass_stun',
        target: 'all_enemies',
        duration: 'instant',
        description: '犧牲本軍團，所有敵首領暈眩'
      }
    },
    onLeaderKO: {
      type: 'keep',
      effect: {
        type: 'support_bonus',
        value: 3,
        target: 'self',
        duration: 'turn',
        description: '保留，下次復活時協助+3（本回合）'
      }
    },
    flavor: '蛇妖一族的女王，掌握著最強大的詛咒之力。'
  }
]

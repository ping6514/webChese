export const allLegions = [
  {
    id: 'dragon_whelp',
    name: '幼龍',
    suitableClass: 'destroyer',
    bonusStats: {
      toughness: 2,
      attack: 2,
      defensiveSupport: 0,
      offensiveSupport: 1,
      recovery: 0
    },
    passive: {
      name: '龍威',
      description: '裝備時：區域內敵首領對敵-1',
      effect: { type: 'enemy_attack_debuff', value: 1 }
    },
    activeSkill: {
      name: '龍息',
      description: '對區域內1位敵首領對敵2、清磚1',
      cooldown: 2
    },
    tags: ['破壞者', '龍族']
  },
  {
    id: 'goblin_squad',
    name: '哥布林小隊',
    suitableClass: 'all',
    bonusStats: {
      toughness: 1,
      attack: 1,
      defensiveSupport: 1,
      offensiveSupport: 1,
      recovery: 0
    },
    passive: {
      name: '數量優勢',
      description: '裝備時：攻擊協助+1'
    },
    tags: ['通用', '哥布林']
  },
  {
    id: 'orc_warrior',
    name: '獸人戰士',
    suitableClass: 'destroyer',
    bonusStats: {
      toughness: 2,
      attack: 2,
      defensiveSupport: 0,
      offensiveSupport: 1,
      recovery: 0
    },
    passive: {
      name: '狂戰士',
      description: '裝備時：對敵+1'
    },
    activeSkill: {
      name: '狂暴打擊',
      description: '對區域內1位敵首領對敵3',
      cooldown: 2
    },
    tags: ['破壞者', '獸人']
  },
  {
    id: 'skeleton_archer',
    name: '骷髏弓手',
    suitableClass: 'conqueror',
    bonusStats: {
      toughness: 1,
      attack: 1,
      defensiveSupport: 0,
      offensiveSupport: 2,
      recovery: 0
    },
    passive: {
      name: '遠程支援',
      description: '裝備時：攻擊協助+2'
    },
    tags: ['征服者', '骷髏']
  },
  {
    id: 'dark_elf_assassin',
    name: '暗精靈刺客',
    suitableClass: 'conqueror',
    bonusStats: {
      toughness: 1,
      attack: 2,
      defensiveSupport: 0,
      offensiveSupport: 2,
      recovery: 0
    },
    passive: {
      name: '暗殺',
      description: '裝備時：對敵擊暈敵首領時，清磚1'
    },
    activeSkill: {
      name: '致命一擊',
      description: '對區域內1位敵首領對敵4',
      cooldown: 3
    },
    tags: ['征服者', '暗精靈']
  },
  {
    id: 'fairy_mage',
    name: '妖精法師',
    suitableClass: 'commander',
    bonusStats: {
      toughness: 1,
      attack: 1,
      defensiveSupport: 1,
      offensiveSupport: 2,
      recovery: 1
    },
    passive: {
      name: '魔法支援',
      description: '裝備時：攻擊協助+1、防護協助+1'
    },
    activeSkill: {
      name: '魔法彈',
      description: '對區域內1位敵首領對敵2、禁錮1回合',
      cooldown: 2
    },
    tags: ['指揮官', '妖精']
  },
  {
    id: 'witch_apprentice',
    name: '見習魔女',
    suitableClass: 'commander',
    bonusStats: {
      toughness: 1,
      attack: 1,
      defensiveSupport: 1,
      offensiveSupport: 2,
      recovery: 1
    },
    passive: {
      name: '魔法陣',
      description: '裝備時：區域內敵首領對敵-1',
      effect: { type: 'enemy_attack_debuff', value: 1 }
    },
    tags: ['指揮官', '魔女']
  },
  {
    id: 'dwarf_guard',
    name: '矮人守衛',
    suitableClass: 'guardian',
    bonusStats: {
      toughness: 2,
      attack: 0,
      defensiveSupport: 2,
      offensiveSupport: 0,
      recovery: 1
    },
    passive: {
      name: '堅固防線',
      description: '裝備時：防護協助+2'
    },
    activeSkill: {
      name: '盾牆',
      description: '本回合堅韌+3、受到對敵-2',
      cooldown: 2
    },
    tags: ['守護者', '矮人']
  },
  {
    id: 'treant_sapling',
    name: '樹人幼苗',
    suitableClass: 'guardian',
    bonusStats: {
      toughness: 2,
      attack: 0,
      defensiveSupport: 2,
      offensiveSupport: 0,
      recovery: 2
    },
    passive: {
      name: '生命之樹',
      description: '裝備時：回復力+2'
    },
    activeSkill: {
      name: '治療',
      description: '回復3',
      cooldown: 2
    },
    tags: ['守護者', '樹人']
  },
  {
    id: 'angel_healer',
    name: '天使治療師',
    suitableClass: 'guardian',
    bonusStats: {
      toughness: 1,
      attack: 0,
      defensiveSupport: 2,
      offensiveSupport: 1,
      recovery: 2
    },
    passive: {
      name: '神聖光環',
      description: '裝備時：回復力+2、防護協助+1'
    },
    tags: ['守護者', '天使']
  }
]

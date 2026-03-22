export const allLeaders = [
  {
    id: 'fire_dragon_girl',
    name: '炎龍娘',
    class: 'destroyer',
    baseToughness: 8,
    baseAttack: 4,
    baseDefensiveSupport: 0,
    baseOffensiveSupport: 2,
    baseRecovery: 0,
    passive: {
      name: '破壞衝動',
      description: '攻城時，回復3'
    },
    skill: {
      name: '火龍吐息',
      description: '對區域內及前方區域清磚1，區域內所有敵首領對敵2，若範圍內有敵主堡則攻城1',
      cooldown: 3,
      effect: []
    },
    tags: ['破壞者', '龍族', '攻城']
  },
  {
    id: 'golem_girl',
    name: '哥雷姆娘',
    class: 'destroyer',
    baseToughness: 10,
    baseAttack: 3,
    baseDefensiveSupport: 1,
    baseOffensiveSupport: 1,
    baseRecovery: 1,
    passive: {
      name: '易怒體質',
      description: '受到傷害的下回合，清磚效果+1'
    },
    skill: {
      name: '地震重擊',
      description: '對區域內所有敵首領對敵3、清磚2，若敵人被擊暈則額外清磚1',
      cooldown: 3,
      effect: []
    },
    tags: ['破壞者', '哥雷姆', '清磚']
  },
  {
    id: 'minotaur_girl',
    name: '牛頭人娘',
    class: 'destroyer',
    baseToughness: 9,
    baseAttack: 4,
    baseDefensiveSupport: 0,
    baseOffensiveSupport: 2,
    baseRecovery: 0,
    passive: {
      name: '狂暴衝鋒',
      description: '移動後對敵+2（本回合）'
    },
    skill: {
      name: '破城之角',
      description: '清磚3、攻城2，若成功攻城則抽1張牌',
      cooldown: 4,
      effect: []
    },
    tags: ['破壞者', '牛頭人', '衝鋒']
  },
  {
    id: 'harpy_girl',
    name: '哈比娘',
    class: 'conqueror',
    baseToughness: 6,
    baseAttack: 3,
    baseDefensiveSupport: 1,
    baseOffensiveSupport: 3,
    baseRecovery: 1,
    passive: {
      name: '空中優勢',
      description: '移動時不受敵人阻擋'
    },
    skill: {
      name: '俯衝突襲',
      description: '移動至任意區域，對區域內1位敵首領對敵4、擊退1格',
      cooldown: 2,
      effect: []
    },
    tags: ['征服者', '哈比', '機動']
  },
  {
    id: 'centaur_girl',
    name: '半人馬娘',
    class: 'conqueror',
    baseToughness: 7,
    baseAttack: 3,
    baseDefensiveSupport: 2,
    baseOffensiveSupport: 2,
    baseRecovery: 1,
    passive: {
      name: '快速機動',
      description: '移動後可以再次移動（一回合一次）'
    },
    skill: {
      name: '踐踏衝鋒',
      description: '移動至相鄰區域，對路徑上所有敵首領對敵2、擊退1格',
      cooldown: 3,
      effect: []
    },
    tags: ['征服者', '半人馬', '衝鋒']
  },
  {
    id: 'werewolf_girl',
    name: '狼人娘',
    class: 'conqueror',
    baseToughness: 7,
    baseAttack: 4,
    baseDefensiveSupport: 1,
    baseOffensiveSupport: 2,
    baseRecovery: 1,
    passive: {
      name: '獵殺本能',
      description: '對敵擊暈敵首領時，抽1張牌'
    },
    skill: {
      name: '月光狂襲',
      description: '對區域內1位敵首領對敵5、癱瘓1回合，若擊暈則可再次移動',
      cooldown: 3,
      effect: []
    },
    tags: ['征服者', '狼人', '獵殺']
  },
  {
    id: 'lamia_girl',
    name: '拉米亞娘',
    class: 'commander',
    baseToughness: 6,
    baseAttack: 2,
    baseDefensiveSupport: 2,
    baseOffensiveSupport: 3,
    baseRecovery: 2,
    passive: {
      name: '神經毒素',
      description: '對敵目標成功造成傷害時，該目標下一回合不能主動移動'
    },
    skill: {
      name: '毒蛇飛匕',
      description: '本區域與相鄰區域內所有敵人造成2點傷害，該目標下一回合不能主動移動、不能攻城',
      cooldown: 3,
      effect: []
    },
    tags: ['指揮官', '拉米亞', '控制']
  },
  {
    id: 'succubus_girl',
    name: '魅魔蝙蝠娘',
    class: 'commander',
    baseToughness: 5,
    baseAttack: 2,
    baseDefensiveSupport: 2,
    baseOffensiveSupport: 3,
    baseRecovery: 2,
    passive: {
      name: '魅惑神智',
      description: '對敵目標成功造成傷害時，該目標下一回合不能主動攻城'
    },
    skill: {
      name: '禁錮音波',
      description: '本區域與相鄰區域內一個敵方單位下一回合不能行動、不能跟其他單位聯手（等於被癱瘓一回合）',
      cooldown: 3,
      effect: []
    },
    tags: ['指揮官', '魅魔', '禁錮']
  },
  {
    id: 'kitsune_girl',
    name: '妖狐娘',
    class: 'commander',
    baseToughness: 6,
    baseAttack: 2,
    baseDefensiveSupport: 2,
    baseOffensiveSupport: 3,
    baseRecovery: 2,
    passive: {
      name: '因果輪迴',
      description: '擊暈或擊殺一個敵方首領時抽一張卡'
    },
    skill: {
      name: '妖狐法陣',
      description: '區域內一回合，所有敵人的堅韌下降2、對敵下降2、敵人不能主動移動',
      cooldown: 4,
      effect: []
    },
    tags: ['指揮官', '妖狐', '削弱']
  },
  {
    id: 'mermaid_girl',
    name: '人魚娘',
    class: 'guardian',
    baseToughness: 7,
    baseAttack: 1,
    baseDefensiveSupport: 3,
    baseOffensiveSupport: 1,
    baseRecovery: 3,
    passive: {
      name: '大海氣息',
      description: '回合開始，區域內所有我方單位清除2點傷害（回復）'
    },
    skill: {
      name: '人魚之歌',
      description: '本回合全場我方單位協助力（攻擊跟防禦）增加3點',
      cooldown: 3,
      effect: []
    },
    tags: ['守護者', '人魚', '回復']
  },
  {
    id: 'slime_girl',
    name: '史萊姆娘',
    class: 'guardian',
    baseToughness: 8,
    baseAttack: 1,
    baseDefensiveSupport: 3,
    baseOffensiveSupport: 1,
    baseRecovery: 2,
    passive: {
      name: '分裂築城',
      description: '一回合一次，受到傷害時，我方可以築城1次，不限範圍'
    },
    skill: {
      name: '重生',
      description: '修復我方基地2點生命力，本首領堅韌增加3點一回合',
      cooldown: 3,
      effect: []
    },
    tags: ['守護者', '史萊姆', '築城']
  },
  {
    id: 'dryad_girl',
    name: '樹精娘',
    class: 'guardian',
    baseToughness: 7,
    baseAttack: 1,
    baseDefensiveSupport: 3,
    baseOffensiveSupport: 1,
    baseRecovery: 3,
    passive: {
      name: '糾纏樹根',
      description: '區域內建築受到攻城傷害時下降1點（一回合一次）'
    },
    skill: {
      name: '森林復甦',
      description: '回復所有我方區域基本築城到2',
      cooldown: 4,
      effect: []
    },
    tags: ['守護者', '樹精', '修城']
  }
]

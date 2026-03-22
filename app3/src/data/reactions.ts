export const allReactions = [
  {
    id: 'dodge',
    name: '閃避',
    suitableClass: ['all'],
    trigger: {
      timing: 'on_receive_damage',
      description: '受到對敵時'
    },
    effect: {
      description: '對敵改為0，抽1張牌'
    },
    afterUse: 'discard'
  },
  {
    id: 'calm_thinking',
    name: '冷靜思考',
    suitableClass: ['all'],
    trigger: {
      timing: 'on_ko',
      description: '進入擊敗時'
    },
    effect: {
      description: '抽3張牌'
    },
    afterUse: 'discard'
  },
  {
    id: 'block',
    name: '阻擋',
    suitableClass: ['all'],
    trigger: {
      timing: 'on_enemy_clear_brick',
      description: '敵人清磚時'
    },
    effect: {
      description: '無效清磚，抽1張牌'
    },
    afterUse: 'discard'
  },
  {
    id: 'mutual_destruction',
    name: '玉石俱焚',
    suitableClass: ['all'],
    trigger: {
      timing: 'on_stunned',
      description: '進入暈眩時'
    },
    effect: {
      description: '對區域內1位敵首領對敵5'
    },
    afterUse: 'discard'
  },
  {
    id: 'counter_strike',
    name: '反擊打擊',
    suitableClass: ['destroyer'],
    trigger: {
      timing: 'on_receive_damage',
      description: '受到對敵時'
    },
    effect: {
      description: '反擊對敵3，清磚1'
    },
    afterUse: 'discard'
  },
  {
    id: 'agile',
    name: '靈動',
    suitableClass: ['conqueror'],
    trigger: {
      timing: 'on_receive_damage',
      description: '受到對敵時'
    },
    effect: {
      description: '堅韌+4，可移動1次'
    },
    afterUse: 'discard'
  },
  {
    id: 'intimidate',
    name: '威嚇',
    suitableClass: ['conqueror'],
    trigger: {
      timing: 'on_enemy_enter_zone',
      description: '敵人進入區域時'
    },
    effect: {
      description: '敵人選擇：受傷4或退回'
    },
    afterUse: 'discard'
  },
  {
    id: 'tactical_retreat_reaction',
    name: '戰術撤退',
    suitableClass: ['commander'],
    trigger: {
      timing: 'on_receive_damage',
      description: '受到對敵時'
    },
    effect: {
      description: '對敵-2，友軍防護+2'
    },
    afterUse: 'discard'
  },
  {
    id: 'iron_body',
    name: '鋼鐵之軀',
    suitableClass: ['guardian'],
    trigger: {
      timing: 'on_receive_damage',
      description: '受到對敵時'
    },
    effect: {
      description: '對敵-4，堆磚1'
    },
    afterUse: 'discard'
  },
  {
    id: 'guardian_shield',
    name: '守護之盾',
    suitableClass: ['guardian'],
    trigger: {
      timing: 'on_receive_damage',
      description: '受到對敵時'
    },
    effect: {
      description: '對敵-2，友軍堅韌+2'
    },
    afterUse: 'discard'
  }
]

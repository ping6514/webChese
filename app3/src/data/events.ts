export const allEvents = [
  {
    id: 'tactical_retreat',
    name: '戰術撤退',
    category: 'movement',
    cost: { discard: 1 },
    effect: [
      { description: '將1位我方首領移動至我方基地，回復2' }
    ]
  },
  {
    id: 'forced_march',
    name: '強行軍',
    category: 'movement',
    cost: { discard: 0 },
    effect: [
      { description: '將1位我方首領移動至距離2格內的區域' }
    ]
  },
  {
    id: 'battle_cry',
    name: '戰吼',
    category: 'buff',
    cost: { discard: 1 },
    effect: [
      { description: '本回合我方所有首領對敵+2、清磚+1' }
    ]
  },
  {
    id: 'divine_blessing',
    name: '神聖祝福',
    category: 'buff',
    cost: { discard: 1 },
    effect: [
      { description: '我方所有首領回復2、本回合受到對敵-1' }
    ]
  },
  {
    id: 'mass_stun',
    name: '群體暈眩',
    category: 'control',
    cost: { discard: 2 },
    effect: [
      { description: '區域內所有敵首領癱瘓1回合' }
    ]
  },
  {
    id: 'freeze',
    name: '冰凍',
    category: 'control',
    cost: { discard: 1 },
    effect: [
      { description: '1位敵首領禁錮1回合、不能移動' }
    ]
  },
  {
    id: 'draw_cards',
    name: '戰術規劃',
    category: 'resource',
    cost: { discard: 0 },
    effect: [
      { description: '抽2張牌' }
    ]
  },
  {
    id: 'emergency_repair',
    name: '緊急修復',
    category: 'resource',
    cost: { discard: 1 },
    effect: [
      { description: '修城1、堆磚1' }
    ]
  },
  {
    id: 'rush_time',
    name: 'RUSH TIME',
    category: 'special',
    cost: { discard: 0 },
    effect: [
      { description: '抽5張牌、所有我方首領完全回復受到的傷害、所有首領技能冷卻重置' }
    ]
  },
  {
    id: 'ambush',
    name: '埋伏',
    category: 'special',
    cost: { discard: 1 },
    effect: [
      { description: '對1位敵首領對敵4、擊退1格' }
    ]
  }
]

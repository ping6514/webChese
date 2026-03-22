export const allBuildings = [
  {
    id: 'gate',
    name: '城門',
    placement: ['我方戰場', '我方基地'],
    toughness: 3,
    effect: {
      description: '區域內我方所有首領受到對敵-1'
    }
  },
  {
    id: 'minion_swarm',
    name: '雜魚群體',
    placement: ['我方戰場', '敵方戰場'],
    toughness: 1,
    effect: {
      description: '每個我方主要階段開始時，對區域內所有敵首領對敲2'
    }
  },
  {
    id: 'arrow_tower',
    name: '箭塔',
    placement: ['我方戰場', '我方基地'],
    toughness: 2,
    effect: {
      description: '區域內我方所有首領對敵+1、清磚+1'
    }
  },
  {
    id: 'relay_point',
    name: '中繼點',
    placement: ['我方戰場'],
    toughness: Infinity,
    effect: {
      description: '我方首領進入擊敗狀態時可以改為從我方戰場復活'
    }
  },
  {
    id: 'fortress_wall',
    name: '要塞城牆',
    placement: ['我方基地'],
    toughness: 5,
    effect: {
      description: '我方基地內所有首領受到對敵-2、防護協助+2，敵人不能對我方基地攻城'
    }
  },
  {
    id: 'sacred_altar',
    name: '神聖祭壇',
    placement: ['我方基地'],
    toughness: 3,
    effect: {
      description: '每個我方回合開始時，我方基地內所有首領回復1，若我方城牆生命力低於2則改為回復2'
    }
  }
]

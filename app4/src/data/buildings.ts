// 建築卡牌定義（3 種可入牌組的建築）

export type BuildingCardDef = {
  id: string
  name: string
  placeable: ('plaza' | 'base')[]
  /** 建築耐久度：被清磚動作命中 N 次後移除，送棄牌區 */
  durability: number
  description: string
}

export const allBuildings: BuildingCardDef[] = [
  {
    id: 'relay_point',
    name: '中繼點',
    placeable: ['plaza'],
    durability: 1,
    description: '此卡在場上時：我方BG進入KO狀態時可以改為從廣場區移動（只有敵BLC職業在廣場區發動清磚動作才能選擇此卡，清除後送入墓地）',
  },
  {
    id: 'city_gate',
    name: '城門',
    placeable: ['plaza', 'base'],
    durability: 2,
    description: '此卡在場上時：區域內我方所有BG受到對敵-1（耐久2，被清磚動作命中2次後送入墓地）',
  },
  {
    id: 'mob_group',
    name: '雜魚群體',
    placeable: ['plaza', 'base'],
    durability: 1,
    description: '此卡在場上時：每個我方主要階段開始時，對區域內所有敵BG對敵2',
  },
]

export const buildingById: Record<string, BuildingCardDef> = {}
for (const b of allBuildings) buildingById[b.id] = b

export const allBuildingIds = allBuildings.map(b => b.id)

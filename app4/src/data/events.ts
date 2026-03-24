// 事件卡牌定義（8 張）

export type EventCardDef = {
  id: string
  name: string
  description: string
  /** RUSH TIME 一場只能用一次 */
  oncePerGame?: boolean
}

export const allEvents: EventCardDef[] = [
  {
    id: 'joystick_fail',
    name: '搖桿失靈',
    description: '選擇1位敵BG：1回合不能移動',
  },
  {
    id: 'best_partner',
    name: '最佳拍檔',
    description: '選擇一個區域：如果區域內有兩位以上的我方BG，則所有該區域內的我方BG 1回合協助+3',
  },
  {
    id: 'call_friends',
    name: '呼朋引伴',
    description: '選擇1位我方BG：將相鄰區域的1位我方BG移動到該BG的區域（此移動無視磚堆）',
  },
  {
    id: 'fighting_spirit',
    name: '氣合',
    description: '選擇1位我方BG：1回合堅韌+4',
  },
  {
    id: 'go_home',
    name: '回家',
    description: '選擇1位非KO狀態的BG：移動到我方主堡區並且回復為正常狀態，抽一張牌',
  },
  {
    id: 'see_through',
    name: '看穿',
    description: '選擇1位敵BG：該BG移除其身上的反應卡',
  },
  {
    id: 'rush_time',
    name: 'RUSH TIME',
    oncePerGame: true,
    description: '我方城牆區指示物數量低於敵城牆區指示物2個以上發動：抽5張牌，所有我方BG回復暈眩狀態，這回合行動階段可以多2次BG行動',
  },
  {
    id: 'reaction_master',
    name: '反應大師',
    description: '捨棄一張手牌發動：從牌組檢索一張反應卡牌展示給對手並加入手牌',
  },
]

export const eventById: Record<string, EventCardDef> = {}
for (const e of allEvents) eventById[e.id] = e

export const allEventIds = allEvents.map(e => e.id)

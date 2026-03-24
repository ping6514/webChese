// 反應卡牌定義（7 張）

import type { BGClass } from '../engine/types'

export type ReactionTrigger =
  | 'on_receive_attack'      // 本BG受到對敵判定時
  | 'on_ko'                  // 本BG進入KO狀態時
  | 'on_stunned'             // 本BG進入暈眩狀態時
  | 'on_enemy_clear_brick'   // 區域內敵BG進行清磚動作時
  | 'on_enemy_enter_zone'    // 敵BG移動進入本BG所在區域時

export type ReactionCardDef = {
  id: string
  name: string
  suitableClass: BGClass | 'ALL'
  trigger: ReactionTrigger
  description: string
}

export const allReactions: ReactionCardDef[] = [
  {
    id: 'dodge',
    name: '閃避',
    suitableClass: 'ALL',
    trigger: 'on_receive_attack',
    description: '本BG受到對敵判定時可以發動：那個對敵改為0，抽1張牌',
  },
  {
    id: 'calm_thinking',
    name: '冷靜思考',
    suitableClass: 'ALL',
    trigger: 'on_ko',
    description: '此BG進入KO狀態時可以發動：抽3張牌',
  },
  {
    id: 'block',
    name: '阻擋',
    suitableClass: 'ALL',
    trigger: 'on_enemy_clear_brick',
    description: '本BG區域內的敵BG進行「清磚動作」時可以發動：無效那次清磚並抽1張牌',
  },
  {
    id: 'mutual_destruction',
    name: '玉石俱焚',
    suitableClass: 'ALL',
    trigger: 'on_stunned',
    description: '本BG進入暈眩狀態的時候可以發動：區域內1位敵BG對敵5',
  },
  {
    id: 'mislead',
    name: '誤導',
    suitableClass: 'ALL',
    trigger: 'on_receive_attack',
    description: '本BG受到「對敵行動」時可以發動：那個對敵改為0，本區域清磚1',
  },
  {
    id: 'agile',
    name: '靈動',
    suitableClass: 'ATK',
    trigger: 'on_receive_attack',
    description: '本BG受到對敵時可以發動：1回合堅韌+4，並且可以執行一次角色移動（無視磚堆阻擋）',
  },
  {
    id: 'intimidate',
    name: '威嚇',
    suitableClass: 'SHT',
    trigger: 'on_enemy_enter_zone',
    description: '敵BG移動進入本BG所在區域時可以發動：對方玩家選擇一項：A.該BG受到對敵4，B.回到移動前的位置',
  },
]

export const reactionById: Record<string, ReactionCardDef> = {}
for (const r of allReactions) reactionById[r.id] = r

export const allReactionIds = allReactions.map(r => r.id)

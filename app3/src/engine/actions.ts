// Beast Conquest Engine — 動作類型（3-zone redesign）

import type { PlayerId, ZoneId } from './types'

export type Action =
  /** 推進到下一個回合階段 */
  | { type: 'NEXT_PHASE' }
  /** 投降 */
  | { type: 'SURRENDER'; player: PlayerId }

  // ── battle 階段 ───────────────────────────────────
  /** 移動首領到相鄰區域（不消耗行動；每首領 battle 階段限 1 次） */
  | { type: 'MOVE'; leaderId: string; toZone: ZoneId }
  /** 對敵首領發動攻擊（單一攻擊者，同區域友軍自動加算協助力） */
  | { type: 'ATTACK'; attackerId: string; targetId: string }
  /** 清磚：在 plaza 的首領削減敵方基地 fortLevel 1 */
  | { type: 'CLEAR_FORT'; leaderId: string }
  /** 攻城：在敵方基地（fortLevel=0）的首領削減 cityWalls 1 */
  | { type: 'SIEGE'; leaderId: string }
  /** 使用首領主動技能 */
  | { type: 'SKILL'; leaderId: string }

  // ── main 階段 ───────────────────────────────────
  /** 從手牌打出事件卡（discardIds 棄牌費） */
  | { type: 'PLAY_EVENT'; cardId: string; discardIds: string[]; targetLeaderId?: string; targetZone?: ZoneId }
  /** 從手牌召喚軍團卡到首領（main 階段，每回合 1 次） */
  | { type: 'SUMMON_LEGION'; cardId: string; leaderId: string }

  // ── react 階段 ───────────────────────────────────
  /** 從手牌安裝戰術卡到首領（react 階段，無次數限制） */
  | { type: 'INSTALL_TACTICAL'; cardId: string; leaderId: string }

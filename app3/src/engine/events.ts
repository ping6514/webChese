// Beast Conquest Engine — 事件類型（供 UI 動畫/FX 使用）

import type { PlayerId, ZoneId } from './types'

export type AttackResult = 'no_effect' | 'stunned' | 'ko'

export type GameEvent =
  | { type: 'PHASE_CHANGED'; player: PlayerId; to: string }
  | { type: 'TURN_STARTED'; player: PlayerId; turn: number }
  | { type: 'STUN_RECOVERED'; leaderId: string }
  | { type: 'LEADER_REVIVED'; leaderId: string; at: ZoneId }
  | { type: 'LEADER_MOVED'; leaderId: string; from: ZoneId; to: ZoneId }
  | {
      type: 'ATTACK_RESOLVED'
      attackerId: string
      targetId: string
      damage: number
      toughness: number
      result: AttackResult
    }
  | { type: 'LEADER_STUNNED'; leaderId: string }
  | { type: 'LEADER_KO'; leaderId: string; returnedTo: ZoneId }
  | { type: 'FORT_CLEARED'; leaderId: string; zone: ZoneId; newFortLevel: number }
  | { type: 'CITY_WALL_DAMAGED'; player: PlayerId; remaining: number }
  | { type: 'GAME_OVER'; winner: PlayerId; reason: string }
  | { type: 'CARD_DRAWN'; player: PlayerId; cardId: string }
  | { type: 'LEGION_SUMMONED'; leaderId: string; cardId: string; cardName: string }
  | { type: 'TACTICAL_INSTALLED'; leaderId: string; cardId: string; cardName: string }
  | { type: 'TACTICAL_TRIGGERED'; leaderId: string; cardId: string; cardName: string; effectDesc: string }
  | { type: 'SKILL_USED'; leaderId: string; skillName: string; effectDesc: string }
  | { type: 'PASSIVE_TRIGGERED'; leaderId: string; passiveType: string; desc: string }
  | { type: 'EVENT_PLAYED'; cardId: string; cardName: string; player: PlayerId; effectDesc: string }
  | { type: 'LEADER_IMMOBILIZED'; leaderId: string }
  | { type: 'LEADER_FREED'; leaderId: string }
  | { type: 'LEADER_PUSHED_BACK'; leaderId: string; from: ZoneId; to: ZoneId }
  | { type: 'LEADER_RECOVERED'; leaderId: string; amount: number }

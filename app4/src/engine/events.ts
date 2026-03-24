// BG Card Game Engine — 遊戲事件定義（UI 用）

import type { PlayerId, ZoneId, BrickAreaId } from './types'

export type GameEvent =
  | { type: 'surrender';         player: PlayerId }
  | { type: 'draw_card';         player: PlayerId; card: string }
  | { type: 'shuffle_graveyard'; player: PlayerId }
  | { type: 'place_brick';       player: PlayerId; areaId: BrickAreaId }
  | { type: 'clear_brick';       bgId: string; areaId: BrickAreaId; extra?: boolean; building?: boolean; destroyed?: boolean }
  | { type: 'play_building';     player: PlayerId; cardId: string; areaId: BrickAreaId }
  | { type: 'play_event';        player: PlayerId; cardId: string }
  | { type: 'event_effect';      cardId: string; [key: string]: unknown }
  | { type: 'skill_effect';      bgId: string; detail: string }
  | { type: 'start_bg_action';   bgId: string }
  | { type: 'end_bg_action';     bgId: string }
  | { type: 'bg_move';           bgId: string; from: ZoneId; to: ZoneId }
  | { type: 'bg_pushed';         bgId: string; to: ZoneId }
  | { type: 'use_skill';         bgId: string; skillName: string }
  | { type: 'do_attack';         attackerId: string; targetId: string; attackValue: number }
  | { type: 'take_damage';       targetId: string; damage: number; hpLeft: number }
  | { type: 'attack_blocked';    targetId: string; reason: string }
  | { type: 'bg_stunned';        bgId: string }
  | { type: 'bg_ko';             bgId: string; fromZone: ZoneId; toZone: ZoneId }
  | { type: 'bg_recover';        bgId: string; wasKO: boolean }
  | { type: 'relay_ko';          bgId: string }
  | { type: 'siege';             attackerId: string; defender: PlayerId; wallsLeft: number }
  | { type: 'walls_destroyed';   defender: PlayerId }
  | { type: 'repair_wall';       player: PlayerId; amount: number; wallsNow: number }
  | { type: 'reaction_triggered'; reactionId: string; bgId: string; triggerBGId?: string }
  | { type: 'install_reaction';  bgId: string; cardId: string }
  | { type: 'turn_start';        player: PlayerId; turn: number }
  | { type: 'phase_start';       player: PlayerId; phase: string }

// 型別安全的工廠函式
export function makeEvent<T extends GameEvent['type']>(
  type: T,
  payload: Omit<Extract<GameEvent, { type: T }>, 'type'>,
): GameEvent {
  return { type, ...payload } as unknown as GameEvent
}

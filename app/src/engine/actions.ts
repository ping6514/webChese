import type { Pos } from './types'
import type { PieceBase } from './types'

export type MoveAction = {
  type: 'MOVE'
  unitId: string
  to: Pos
}

export type NextPhaseAction = {
  type: 'NEXT_PHASE'
}

export type ShootAction = {
  type: 'SHOOT'
  attackerId: string
  targetUnitId: string
  extraTargetUnitId?: string | null
}

export type EnchantAction = {
  type: 'ENCHANT'
  unitId: string
  soulId: string
}

export type ReviveAction = {
  type: 'REVIVE'
  pos: Pos
  corpseIndex?: number
}

export type BuySoulFromDeckAction = {
  type: 'BUY_SOUL_FROM_DECK'
  base: PieceBase
}

export type BuySoulFromDisplayAction = {
  type: 'BUY_SOUL_FROM_DISPLAY'
  base: PieceBase
}

export type BuySoulFromEnemyGraveyardAction = {
  type: 'BUY_SOUL_FROM_ENEMY_GRAVEYARD'
}

export type ReturnSoulToDeckBottomAction = {
  type: 'RETURN_SOUL_TO_DECK_BOTTOM'
  soulId: string
}

export type BuyItemFromDisplayAction = {
  type: 'BUY_ITEM_FROM_DISPLAY'
  slot: number
}

export type DiscardItemFromHandAction = {
  type: 'DISCARD_ITEM_FROM_HAND'
  itemId: string
}

export type BloodRitualAction = {
  type: 'BLOOD_RITUAL'
}

export type SacrificeAction = {
  type: 'SACRIFICE'
  sourceUnitId: string
  targetUnitId: string
  range?: number
}

export type Action =
  | MoveAction
  | ShootAction
  | EnchantAction
  | ReviveAction
  | BloodRitualAction
  | SacrificeAction
  | BuySoulFromDeckAction
  | BuySoulFromDisplayAction
  | BuySoulFromEnemyGraveyardAction
  | ReturnSoulToDeckBottomAction
  | BuyItemFromDisplayAction
  | DiscardItemFromHandAction
  | NextPhaseAction

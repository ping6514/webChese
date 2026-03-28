// BG Card Game Engine — 公開 API

export type { GameState, BGInstance, PlayerState, BrickArea, BrickSlot, PendingEffect, GameConfig } from './state'
export { createInitialState, getBGsInZone, getEnemyBGsInZone, getAllyBGsInZone, effectiveAttack, effectiveSupport, effectiveHP, hasBricks, isPlazaBlocked, isSiegeBlocked } from './state'
export type { Action, SkillParams, EventParams, ReactionChoice } from './actions'
export { canDispatch, getClearTargetAreas } from './guards'
export type { GuardResult } from './guards'
export { reduce } from './reduce'
export type { ReduceResult, ReduceOk, ReduceErr } from './reduce'
export type { GameEvent } from './events'
export type { PlayerId, ZoneId, BGClass, BGState, Phase, BrickAreaId } from './types'
export { opponentOf, homeZone, frontZone, areAdjacent } from './types'

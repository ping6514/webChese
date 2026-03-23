// Beast Conquest Engine — 公開 API（3-zone redesign）

export type { PlayerId, ZoneId, Phase, LeaderState } from './types'
export { opponent, lairZone, enemyLairZone, getAdjacentZones, zoneDistance, isEnemyZone, ZONE_ORDER } from './types'

export type { LeaderInstance, Zone, GameState, LeaderConfig, GameConfig, PlayerTurnFlags } from './state'
export { totalToughness, totalAttack, totalSupport, createInitialState } from './state'

export type { Action } from './actions'

export type { GameEvent, AttackResult } from './events'

export type { GuardResult } from './guards'
export { canDispatch, canMove, canAttack, canClearFort, canSiege, canUseSkill, canSummonLegion, canInstallTactical, canPlayEvent } from './guards'

export type { ReduceResult } from './reduce'
export { reduce, listLegalActions, listEquipmentActions, listReactPhaseActions } from './reduce'

export type { LegionCardDef, LeaderCardDef, TacticalCardDef, TacticalTrigger, LeaderPassive, LegionPassive, EventCardDef } from './cards'
export { getLegionCard, getLeaderCard, allLegionIds, allLeaderIds, makeDefaultDeck, getTacticalCard, allTacticalIds, getLeaderPassive, getLegionPassives, randomLeaderSelection, getEventCard, allEventIds } from './cards'

export type { PlayerState } from './state'

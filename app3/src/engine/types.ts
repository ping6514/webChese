// Beast Conquest Engine — 核心類型（3-zone redesign）

export type PlayerId = 'p1' | 'p2'

// 三個區域：線性排列 p1_base ←→ plaza ←→ p2_base
export type ZoneId = 'p1_base' | 'plaza' | 'p2_base'

export type Phase = 'main' | 'battle' | 'react'

export type LeaderState = 'normal' | 'stunned' | 'ko' | 'reviving'

export const ZONE_ORDER: ZoneId[] = ['p1_base', 'plaza', 'p2_base']

export function opponent(p: PlayerId): PlayerId {
  return p === 'p1' ? 'p2' : 'p1'
}

export function getAdjacentZones(zone: ZoneId): ZoneId[] {
  const idx = ZONE_ORDER.indexOf(zone)
  const result: ZoneId[] = []
  if (idx > 0) result.push(ZONE_ORDER[idx - 1])
  if (idx < ZONE_ORDER.length - 1) result.push(ZONE_ORDER[idx + 1])
  return result
}

export function zoneDistance(a: ZoneId, b: ZoneId): number {
  return Math.abs(ZONE_ORDER.indexOf(a) - ZONE_ORDER.indexOf(b))
}

/** 判斷某區域對指定玩家來說是否為敵方區域（plaza 是中立，不算敵方） */
export function isEnemyZone(zone: ZoneId, player: PlayerId): boolean {
  if (player === 'p1') return zone === 'p2_base'
  return zone === 'p1_base'
}

export function lairZone(player: PlayerId): ZoneId {
  return player === 'p1' ? 'p1_base' : 'p2_base'
}

export function enemyLairZone(player: PlayerId): ZoneId {
  return player === 'p1' ? 'p2_base' : 'p1_base'
}

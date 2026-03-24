// BG Card Game Engine — 基礎型別

export type PlayerId = 'p1' | 'p2'
export type ZoneId = 'p1_base' | 'plaza' | 'p2_base'
export type BGClass = 'BOM' | 'ATK' | 'SHT' | 'BLC'
export type BGState = 'normal' | 'stunned' | 'ko'
export type Phase = 'draw' | 'main' | 'action' | 'react' | 'end'
export type BrickAreaId = 'p1_plaza' | 'p1_base' | 'p2_plaza' | 'p2_base'

export function opponentOf(p: PlayerId): PlayerId {
  return p === 'p1' ? 'p2' : 'p1'
}

/** 玩家的主堡區 */
export function homeZone(p: PlayerId): ZoneId {
  return p === 'p1' ? 'p1_base' : 'p2_base'
}

/** 玩家的前線（敵主堡）區 */
export function frontZone(p: PlayerId): ZoneId {
  return p === 'p1' ? 'p2_base' : 'p1_base'
}

/** 從玩家視角的「廣場磚堆」ID（敵人不能移動到我方主堡） */
export function plazaBrickId(owner: PlayerId): BrickAreaId {
  return `${owner}_plaza` as BrickAreaId
}

/** 從玩家視角的「主堡磚堆」ID（敵人不能攻城） */
export function baseBrickId(owner: PlayerId): BrickAreaId {
  return `${owner}_base` as BrickAreaId
}

/** 兩區域是否相鄰 */
export function areAdjacent(a: ZoneId, b: ZoneId): boolean {
  const zones: ZoneId[] = ['p1_base', 'plaza', 'p2_base']
  return Math.abs(zones.indexOf(a) - zones.indexOf(b)) === 1
}

/** 朝敵方方向移動一格 */
export function moveToward(from: ZoneId, toward: PlayerId): ZoneId | null {
  const targetBase = homeZone(toward)
  if (from === targetBase) return null
  if (from === 'plaza') return targetBase
  return 'plaza'
}

/** 朝我方方向移動一格 */
export function moveBack(from: ZoneId, owner: PlayerId): ZoneId | null {
  const myBase = homeZone(owner)
  if (from === myBase) return null
  if (from === 'plaza') return myBase
  return 'plaza'
}

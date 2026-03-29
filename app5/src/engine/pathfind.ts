import type { HexPos, MapCell } from './types'
import { hexKey, hexDistance } from './types'

// odd-r offset 的六個鄰居方向（偶數行 / 奇數行各不同）
function neighbors(pos: HexPos): HexPos[] {
  const { q, r } = pos
  const isOdd = r & 1
  return isOdd
    ? [
        { q: q + 1, r },
        { q: q - 1, r },
        { q: q,     r: r - 1 },
        { q: q + 1, r: r - 1 },
        { q: q,     r: r + 1 },
        { q: q + 1, r: r + 1 },
      ]
    : [
        { q: q + 1, r },
        { q: q - 1, r },
        { q: q - 1, r: r - 1 },
        { q: q,     r: r - 1 },
        { q: q - 1, r: r + 1 },
        { q: q,     r: r + 1 },
      ]
}

// A* 路尋，回傳從 start 到 goal 的路徑（不含 start，含 goal）
// blockedKeys：額外不可通行的格子（其他小隊占用的位置）
export function findPath(
  start: HexPos,
  goal: HexPos,
  cells: Record<string, MapCell>,
  blockedKeys: Set<string> = new Set()
): HexPos[] {
  const startKey = hexKey(start)
  const goalKey  = hexKey(goal)

  if (startKey === goalKey) return []

  const gScore: Record<string, number> = { [startKey]: 0 }
  const fScore: Record<string, number> = { [startKey]: hexDistance(start, goal) }
  const cameFrom: Record<string, string> = {}
  const openSet = new Set<string>([startKey])
  const posMap: Record<string, HexPos> = { [startKey]: start, [goalKey]: goal }

  while (openSet.size > 0) {
    // 取 fScore 最低的節點
    let current = ''
    let bestF = Infinity
    for (const k of openSet) {
      if ((fScore[k] ?? Infinity) < bestF) { bestF = fScore[k]; current = k }
    }

    if (current === goalKey) {
      // 重建路徑
      const path: HexPos[] = []
      let c = current
      while (cameFrom[c]) {
        path.unshift(posMap[c])
        c = cameFrom[c]
      }
      return path
    }

    openSet.delete(current)
    const currentPos = posMap[current]

    for (const nb of neighbors(currentPos)) {
      const nbKey = hexKey(nb)
      posMap[nbKey] = nb

      const cell = cells[nbKey]
      // 目標格即使被佔用也允許（小隊可以相鄰停下）
      if (nbKey !== goalKey) {
        if (!cell || !cell.passable) continue
        if (blockedKeys.has(nbKey)) continue
      } else {
        if (!cell || !cell.passable) continue
      }

      const tentG = (gScore[current] ?? Infinity) + 1
      if (tentG < (gScore[nbKey] ?? Infinity)) {
        cameFrom[nbKey] = current
        gScore[nbKey] = tentG
        fScore[nbKey] = tentG + hexDistance(nb, goal)
        openSet.add(nbKey)
      }
    }
  }

  return [] // 無路可走
}

// 取 zone 中距離 pos 最近的格子
export function nearestInZone(pos: HexPos, zone: HexPos[]): HexPos {
  return zone.reduce((best, p) =>
    hexDistance(pos, p) < hexDistance(pos, best) ? p : best
  , zone[0])
}

export { neighbors }

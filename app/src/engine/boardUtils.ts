/** 純幾何工具函式，供引擎各模組共用 */

export function palaceContains(side: 'red' | 'black', pos: { x: number; y: number }): boolean {
  if (pos.x < 3 || pos.x > 5) return false
  if (side === 'red') return pos.y >= 7 && pos.y <= 9
  return pos.y >= 0 && pos.y <= 2
}

export function crossedRiver(side: 'red' | 'black', y: number): boolean {
  return side === 'red' ? y <= 4 : y >= 5
}

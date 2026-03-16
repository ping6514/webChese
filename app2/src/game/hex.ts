/**
 * hex.ts — 六角格坐標系統與幾何工具
 *
 * 坐標系統：pointy-top（尖頭朝上），odd-r offset + axial 雙軌
 *
 *   offset (col, row) — 用於格子生成與視覺排列
 *   axial  (q, r)     — 用於距離計算、範圍查詢、引擎邏輯
 *
 * 轉換規則（odd-r offset）：
 *   axial  → offset:  col = q + floor(r / 2),  row = r
 *   offset → axial:   q = col - floor(r / 2),  r = row
 */

// ─── 型別 ─────────────────────────────────────────────────────────────────────

export type HexCoord = { q: number; r: number }

// ─── 坐標轉換 ─────────────────────────────────────────────────────────────────

/** offset (col, row) → axial (q, r)，odd-r pointy-top */
export function offsetToAxial(col: number, row: number): HexCoord {
  return { q: col - Math.floor(row / 2), r: row }
}

/** axial (q, r) → offset (col, row)，odd-r pointy-top */
export function axialToOffset(q: number, r: number): { col: number; row: number } {
  return { col: q + Math.floor(r / 2), row: r }
}

/** axial → SVG pixel（pointy-top，中心點） */
export function axialToPixel(q: number, r: number, size: number): { x: number; y: number } {
  return {
    x: size * Math.sqrt(3) * (q + r / 2),
    y: size * 1.5 * r,
  }
}

/** offset → SVG pixel（pointy-top，中心點） */
export function offsetToPixel(col: number, row: number, size: number): { x: number; y: number } {
  const { q, r } = offsetToAxial(col, row)
  return axialToPixel(q, r, size)
}

// ─── 幾何計算 ─────────────────────────────────────────────────────────────────

/** 兩個 axial 座標之間的六角格距離 */
export function hexDistance(a: HexCoord, b: HexCoord): number {
  const dq = a.q - b.q
  const dr = a.r - b.r
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2
}

/** 六個方向向量（axial） */
export const HEX_DIRECTIONS: HexCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
]

/** 取得相鄰六格 */
export function hexNeighbors(coord: HexCoord): HexCoord[] {
  return HEX_DIRECTIONS.map(d => ({ q: coord.q + d.q, r: coord.r + d.r }))
}

/** 取得半徑 N 以內所有格子（含中心） */
export function hexRange(center: HexCoord, range: number): HexCoord[] {
  const results: HexCoord[] = []
  for (let dq = -range; dq <= range; dq++) {
    const rMin = Math.max(-range, -dq - range)
    const rMax = Math.min(range, -dq + range)
    for (let dr = rMin; dr <= rMax; dr++) {
      results.push({ q: center.q + dq, r: center.r + dr })
    }
  }
  return results
}

// ─── SVG 工具 ─────────────────────────────────────────────────────────────────

/** 產生 pointy-top 六角形的 SVG polygon points（以 0,0 為中心） */
export function hexPoints(size: number): string {
  const pts: string[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30) // pointy-top: 從 -30° 開始
    pts.push(`${(size * Math.cos(angle)).toFixed(2)},${(size * Math.sin(angle)).toFixed(2)}`)
  }
  return pts.join(' ')
}

/** 用 axial 坐標建立唯一 key */
export function hexKey(q: number, r: number): string {
  return `${q}:${r}`
}

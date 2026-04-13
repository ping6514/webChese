// ─── Hex 座標系（pointy-top, odd-r offset）─────────────────────────────────

export const HEX_SIZE    = 38
export const HEX_W       = Math.sqrt(3) * HEX_SIZE    // ≈ 65.8px，格寬
export const HEX_H       = 2 * HEX_SIZE               // 76px，格高
export const HEX_VERT    = HEX_SIZE * 1.5             // 57px，行間距

export const ISO_Y_SCALE = 0.65   // 斜角壓縮比（0.65=約 35° 仰角，1.0=正上方俯視）
export const ELEVATION   = 12     // 高地擠出高度 px（screen space）

/**
 * 格子中心座標（worldContainer 空間內）
 * Y 軸套用 ISO_Y_SCALE，產生斜角透視效果
 */
export function hexToPixel(q: number, r: number): { x: number; y: number } {
  return {
    x: HEX_W * (q + (r & 1) * 0.5) + HEX_W / 2,
    y: (HEX_VERT * r + HEX_H / 2) * ISO_Y_SCALE,
  }
}

/**
 * 像素 → 最近的格子（用於點擊 hit-test）
 * 先反算 ISO_Y_SCALE 再轉格座標
 */
export function pixelToHex(px: number, py: number): { q: number; r: number } {
  const rawY = py / ISO_Y_SCALE
  const r    = Math.round((rawY - HEX_H / 2) / HEX_VERT)
  const q    = Math.round((px - HEX_W / 2 - (r & 1) * HEX_W * 0.5) / HEX_W)
  return { q, r }
}

/**
 * 六角形頂點（pointy-top），Y 軸含 ISO 壓縮
 * 用於繪製一般地形格子
 */
export function hexPolygonPoints(cx: number, cy: number, size: number): number[] {
  const pts: number[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6
    pts.push(
      cx + size * Math.cos(angle),
      cy + size * Math.sin(angle) * ISO_Y_SCALE,
    )
  }
  return pts
}

/**
 * 高地頂面頂點（ISO 壓縮，整體上移 ELEVATION px）
 */
export function hexElevatedPoints(cx: number, cy: number, size: number): number[] {
  const pts: number[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6
    pts.push(
      cx + size * Math.cos(angle),
      cy + size * Math.sin(angle) * ISO_Y_SCALE - ELEVATION,
    )
  }
  return pts
}

/**
 * 高地側面梯形頂點陣列（下半 3 個可見面：右→底→左）
 * 每個元素為 8 個數值 [x0,y0, x1,y1, x2,y2, x3,y3]（四邊形）
 */
export function hexSideFaces(cx: number, cy: number, size: number): number[][] {
  const v: Array<[number, number]> = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6
    v.push([
      cx + size * Math.cos(angle),
      cy + size * Math.sin(angle) * ISO_Y_SCALE,
    ])
  }
  // 可見下半面：[1→2] 右面、[2→3] 底面、[3→4] 左面
  return ([[ 1, 2 ], [ 2, 3 ], [ 3, 4 ]] as [number, number][]).map(([a, b]) => [
    v[a][0], v[a][1] - ELEVATION,   // 頂面 A
    v[b][0], v[b][1] - ELEVATION,   // 頂面 B
    v[b][0], v[b][1],               // 地面 B
    v[a][0], v[a][1],               // 地面 A
  ])
}

/** 整張地圖的像素尺寸（含 ISO 壓縮，用於 pan 邊界 clamp）*/
export function mapPixelSize(cols: number, rows: number) {
  return {
    w: HEX_W * cols + HEX_W / 2,
    h: (HEX_VERT * rows + HEX_H / 2) * ISO_Y_SCALE,
  }
}

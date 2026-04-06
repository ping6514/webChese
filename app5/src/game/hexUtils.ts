// ─── Hex 座標系（pointy-top, odd-r offset）─────────────────────────────────

export const HEX_SIZE = 38                         // 外接圓半徑 px
export const HEX_W    = Math.sqrt(3) * HEX_SIZE    // ≈ 65.8px，格寬
export const HEX_H    = 2 * HEX_SIZE               // 76px，格高
export const HEX_VERT = HEX_SIZE * 1.5             // 57px，行間距

/**
 * 格子中心座標（worldContainer 空間內）
 * origin 在 (HEX_W/2, HEX_H/2)，讓第一格 (0,0) 不貼邊
 */
export function hexToPixel(q: number, r: number): { x: number; y: number } {
  return {
    x: HEX_W * (q + (r & 1) * 0.5) + HEX_W / 2,
    y: HEX_VERT * r + HEX_H / 2,
  }
}

/**
 * 像素 → 最近的格子（用於點擊 hit-test）
 */
export function pixelToHex(px: number, py: number): { q: number; r: number } {
  const r = Math.round((py - HEX_H / 2) / HEX_VERT)
  const q = Math.round((px - HEX_W / 2 - (r & 1) * HEX_W * 0.5) / HEX_W)
  return { q, r }
}

/**
 * 六角形頂點（pointy-top，用於 Pixi Graphics 繪製）
 */
export function hexPolygonPoints(cx: number, cy: number, size: number): number[] {
  const pts: number[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6   // pointy-top：從右上角開始
    pts.push(cx + size * Math.cos(angle), cy + size * Math.sin(angle))
  }
  return pts
}

/** 整張地圖的像素尺寸（用於 pan 邊界 clamp）*/
export function mapPixelSize(cols: number, rows: number) {
  return {
    w: HEX_W * cols + HEX_W / 2,
    h: HEX_VERT * rows + HEX_H / 2,
  }
}

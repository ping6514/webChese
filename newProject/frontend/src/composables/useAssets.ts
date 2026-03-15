/**
 * useAssets.ts — 圖片路徑解析
 *
 * 根據引擎 id（monsterId / jobId）回傳對應的圖片 URL。
 * 圖片以 import.meta.glob 靜態引入，確保 Vite build 時正確處理。
 */

// 靜態引入所有資產（Vite 在 build 時處理 hash）
const monsterImages = import.meta.glob<{ default: string }>(
  '../assets/monsters/*.jpg', { eager: true }
)
const jobImages = import.meta.glob<{ default: string }>(
  '../assets/jobs/*.jpg', { eager: true }
)

function lookupImage(
  map: Record<string, { default: string }>,
  id: string
): string | null {
  const key = Object.keys(map).find(k => k.includes(`/${id}.jpg`))
  return key ? (map[key]?.default ?? null) : null
}

/**
 * 怪物圖片 URL（依 monsterId，e.g. 'forest_wolf'）
 * 找不到時回傳 null，UI 可顯示佔位符。
 */
export function monsterImage(monsterId: string): string | null {
  return lookupImage(monsterImages, monsterId)
}

/**
 * 職業證圖片 URL（依 jobId，e.g. 'warrior'）
 */
export function jobImage(jobId: string): string | null {
  return lookupImage(jobImages, jobId)
}

import type { CaptainType } from '../engine/types'

/**
 * 素材目錄規範
 *
 * public/assets/
 * ├── units/
 * │   └── portraits/
 * │       ├── infantry.jpg   步兵隊長（衝鋒）
 * │       ├── cavalry.jpg    騎士隊長
 * │       ├── heavy.jpg      重甲隊長（防守）
 * │       ├── ranged.jpg     弓手隊長
 * │       └── siege.jpg      攻城隊長
 * └── cards/                 靈魂卡藝術圖（幽冥棋，供參考）
 *
 * 替換素材：只需把 units/portraits/ 下的對應 .jpg 換成新圖即可，
 * 無需改任何程式碼。
 */

export const CAPTAIN_PORTRAIT: Record<CaptainType, string> = {
  infantry: '/assets/units/portraits/infantry.jpg',
  cavalry:  '/assets/units/portraits/cavalry.jpg',
  heavy:    '/assets/units/portraits/heavy.jpg',
  ranged:   '/assets/units/portraits/ranged.jpg',
  siege:    '/assets/units/portraits/siege.jpg',
}

/** 預載用的 URL 列表（傳給 Pixi Assets.load） */
export const ALL_PORTRAIT_URLS = Object.values(CAPTAIN_PORTRAIT)

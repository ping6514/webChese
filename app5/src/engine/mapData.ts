import type { MapCell, HexPos } from './types'
import { hexKey } from './types'

// 測試地圖：10 列 × 6 行（rect offset 座標轉 axial）
// 玩家在左（col 0-1），敵人在右（col 8-9），中間是爭奪區

export function createTestMap(): Record<string, MapCell> {
  const cells: Record<string, MapCell> = {}

  // 簡化：用矩形 offset 座標，q = col, r = row（0-based）
  // 可通行範圍 col 0-9, row 0-5

  for (let q = 0; q <= 9; q++) {
    for (let r = 0; r <= 5; r++) {
      const pos: HexPos = { q, r }
      const key = hexKey(pos)

      let passable = true
      let terrain: MapCell['terrain'] = 'normal'

      // 上下邊界不可通行（row 0, row 5 邊緣效果，實際只跑 1-4）
      if (r === 0 || r === 5) passable = false

      // 玩家主堡（col 0）
      if (q === 0 && (r === 2 || r === 3)) {
        cells[key] = {
          pos, terrain: 'normal', passable: true,
          building: {
            buildingId: 'player_base',
            nodeType: 'playerBase',
            team: 'player',
            captureHp: 100, maxCaptureHp: 100,
            hp: 500, maxHp: 500
          }
        }
        continue
      }

      // 敵方主堡（col 9）
      if (q === 9 && (r === 2 || r === 3)) {
        cells[key] = {
          pos, terrain: 'normal', passable: true,
          building: {
            buildingId: 'enemy_base',
            nodeType: 'enemyBase',
            team: 'enemy',
            captureHp: 100, maxCaptureHp: 100,
            hp: 500, maxHp: 500
          }
        }
        continue
      }

      // 中央前哨站（col 4-5, row 2-3）
      if ((q === 4 || q === 5) && (r === 2 || r === 3)) {
        cells[key] = {
          pos, terrain: 'normal', passable: true,
          building: {
            buildingId: `outpost_${q}_${r}`,
            nodeType: 'outpost',
            team: 'neutral',
            captureHp: 100, maxCaptureHp: 100
          }
        }
        continue
      }

      // 高地（col 2, row 1 和 row 4）
      if (q === 2 && (r === 1 || r === 4)) terrain = 'highGround'

      // 叢林（col 3, row 1 和 row 4）
      if (q === 3 && (r === 1 || r === 4)) terrain = 'forest'

      cells[key] = { pos, terrain, passable }
    }
  }

  return cells
}

// 命名區域對應格子（供 AI moveSequence 使用）
export const NAMED_ZONES: Record<string, HexPos[]> = {
  player_base:    [{ q: 0, r: 2 }, { q: 0, r: 3 }],
  front_upper:    [{ q: 2, r: 1 }],
  front_mid:      [{ q: 2, r: 2 }, { q: 2, r: 3 }],
  front_lower:    [{ q: 2, r: 4 }],
  center:         [{ q: 4, r: 2 }, { q: 5, r: 3 }],
  gate:           [{ q: 5, r: 2 }, { q: 5, r: 3 }],
  dungeon_upper:  [{ q: 7, r: 1 }],
  dungeon_mid:    [{ q: 7, r: 2 }, { q: 7, r: 3 }],
  dungeon_lower:  [{ q: 7, r: 4 }],
  enemy_base:     [{ q: 9, r: 2 }, { q: 9, r: 3 }],
}

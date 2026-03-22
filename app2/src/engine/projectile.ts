/**
 * engine/projectile.ts — 投射物射線追蹤與阻擋判定
 */

import type { GameState, HexPos, CombatUnit } from './state'
import { hexDistance, hexKey } from '../game/hex'

export type ProjectileTraceResult = {
  /** 投射物經過的路徑（不含起點） */
  path: HexPos[]
  /** 是否被阻擋 */
  blocked: boolean
  /** 阻擋原因 */
  blockedBy: 'obstacle' | 'unit' | null
  /** 阻擋位置（若有） */
  blockedAt: HexPos | null
  /** 最終命中的單位 ID（可能是原目標或攔截者） */
  finalTargetId: string | null
  /** 是否被攔截（前排保護） */
  intercepted: boolean
  /** 攔截者 ID */
  interceptorId: string | null
}

/**
 * 追蹤投射物從起點到目標的路徑
 * 
 * 規則：
 * 1. 沿直線路徑前進（六角格的六個主軸方向之一）
 * 2. 遇到障礙物格子時阻擋
 * 3. 遇到單位時檢查是否攔截
 * 4. 前排單位可以攔截投射物（protect 機制）
 */
export function traceProjectilePath(
  state: GameState,
  from: HexPos,
  targetUnitId: string,
  options: {
    maxRange?: number
    piercing?: boolean  // 穿透：忽略第一個單位
    ignoreObstacles?: boolean
  } = {},
): ProjectileTraceResult {
  const targetUnit = state.units[targetUnitId]
  if (!targetUnit || targetUnit.isDead) {
    return {
      path: [],
      blocked: true,
      blockedBy: null,
      blockedAt: null,
      finalTargetId: null,
      intercepted: false,
      interceptorId: null,
    }
  }

  const to = targetUnit.pos
  const path = buildLinePath(from, to)
  
  // 移除起點
  const pathWithoutOrigin = path.slice(1)

  const maxRange = options.maxRange ?? 99
  if (hexDistance(from, to) > maxRange) {
    return {
      path: pathWithoutOrigin,
      blocked: true,
      blockedBy: null,
      blockedAt: null,
      finalTargetId: null,
      intercepted: false,
      interceptorId: null,
    }
  }

  // 逐格檢查路徑
  let piercedOneUnit = false
  for (const pos of pathWithoutOrigin) {
    const cellKey = hexKey(pos.q, pos.r)
    const cell = state.cells[cellKey]

    // 檢查地形阻擋
    if (!options.ignoreObstacles && cell && cell.terrain === 'obstacle') {
      return {
        path: pathWithoutOrigin,
        blocked: true,
        blockedBy: 'obstacle',
        blockedAt: pos,
        finalTargetId: null,
        intercepted: false,
        interceptorId: null,
      }
    }

    // 檢查單位阻擋/攔截
    const unitAtPos = findUnitAtPos(state, pos)
    if (unitAtPos && !unitAtPos.isDead) {
      // 穿透模式：忽略第一個單位
      if (options.piercing && !piercedOneUnit) {
        piercedOneUnit = true
        continue
      }

      // 如果這是目標單位，正常命中
      if (unitAtPos.id === targetUnitId) {
        return {
          path: pathWithoutOrigin,
          blocked: false,
          blockedBy: null,
          blockedAt: null,
          finalTargetId: targetUnitId,
          intercepted: false,
          interceptorId: null,
        }
      }

      // 如果是其他單位，檢查是否攔截
      // 攔截條件：敵對陣營的單位在路徑上
      const attacker = findUnitAtPos(state, from)
      if (attacker && unitAtPos.team !== attacker.team) {
        // 敵方單位阻擋投射物
        return {
          path: pathWithoutOrigin,
          blocked: true,
          blockedBy: 'unit',
          blockedAt: pos,
          finalTargetId: unitAtPos.id,
          intercepted: false,
          interceptorId: null,
        }
      }

      // 友方單位可能攔截（保護機制）
      if (attacker && unitAtPos.team === targetUnit.team && unitAtPos.team !== attacker.team) {
        // 前排保護：友方單位在攻擊者與目標之間
        const distToInterceptor = hexDistance(from, pos)
        const distToTarget = hexDistance(from, to)
        if (distToInterceptor < distToTarget) {
          // 檢查攔截機率（如果有的話）
          // 這裡先簡化為 100% 攔截
          return {
            path: pathWithoutOrigin,
            blocked: true,
            blockedBy: 'unit',
            blockedAt: pos,
            finalTargetId: unitAtPos.id,
            intercepted: true,
            interceptorId: unitAtPos.id,
          }
        }
      }
    }
  }

  // 路徑暢通，命中目標
  return {
    path: pathWithoutOrigin,
    blocked: false,
    blockedBy: null,
    blockedAt: null,
    finalTargetId: targetUnitId,
    intercepted: false,
    interceptorId: null,
  }
}

/**
 * 建立從起點到終點的直線路徑（六角格）
 * 
 * 使用 Bresenham-like 算法在六角格上畫直線
 */
function buildLinePath(from: HexPos, to: HexPos): HexPos[] {
  const dq = to.q - from.q
  const dr = to.r - from.r
  const ds = -dq - dr  // s = -q - r (cube coordinate)

  const distance = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds))
  if (distance === 0) return [from]

  const path: HexPos[] = []
  for (let i = 0; i <= distance; i++) {
    const t = i / distance
    const q = Math.round(from.q + dq * t)
    const r = Math.round(from.r + dr * t)
    path.push({ q, r })
  }

  return path
}

/**
 * 查找指定位置的單位
 */
function findUnitAtPos(state: GameState, pos: HexPos): CombatUnit | null {
  for (const unit of Object.values(state.units)) {
    if (unit.pos.q === pos.q && unit.pos.r === pos.r && !unit.isDead) {
      return unit
    }
  }
  return null
}

/**
 * 檢查投射物是否可以命中目標（考慮射程與阻擋）
 */
export function canProjectileHit(
  state: GameState,
  attackerId: string,
  targetId: string,
  maxRange: number,
): boolean {
  const attacker = state.units[attackerId]
  const target = state.units[targetId]
  if (!attacker || !target || attacker.isDead || target.isDead) return false

  const dist = hexDistance(attacker.pos, target.pos)
  if (dist > maxRange) return false

  const trace = traceProjectilePath(state, attacker.pos, targetId, { maxRange })
  return !trace.blocked && trace.finalTargetId === targetId
}

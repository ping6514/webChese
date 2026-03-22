import type { CombatUnit, GameState, ActiveStatus } from './state'
import type { StatusId } from '../game/schema'
import type { Event } from './events'

/**
 * 狀態效果應用與管理模組
 * 
 * 根據 MVP_BATTLE_DATA.md 的設計：
 * - DoT：輕 4×3、中 6×3、重 8×3
 * - 降抗：Expose +25%、Vulnerable +15%
 * - 控制：Bind、Slow、Chill
 */

/**
 * 狀態效果配置
 */
export const STATUS_CONFIGS: Record<StatusId, {
  duration: number // 持續回合數或毫秒
  tickDamage?: number // DoT 每跳傷害
  tickInterval?: number // DoT 跳動間隔（毫秒）
  movementPenalty?: number // 移動懲罰（0-1）
  atkSpeedPenalty?: number // 攻速懲罰（0-1）
  damageVulnerability?: number // 承傷增加（0-1）
  resistReduction?: { type: string; value: number } // 抗性降低
}> = {
  // DoT 狀態
  burn: {
    duration: 3,
    tickDamage: 6,
    tickInterval: 1000,
  },
  shock: {
    duration: 2,
    tickDamage: 4,
    tickInterval: 1000,
  },
  chill: {
    duration: 3,
    movementPenalty: 0.3,
    atkSpeedPenalty: 0.2,
  },
  
  // 控制狀態
  bind: {
    duration: 2,
    movementPenalty: 1.0, // 完全無法移動
  },
  slow: {
    duration: 2,
    movementPenalty: 0.5,
    atkSpeedPenalty: 0.3,
  },
  
  // 降抗狀態
  vulnerable: {
    duration: 3,
    damageVulnerability: 0.15, // +15% 承傷
  },
  expose_slash: {
    duration: 3,
    resistReduction: { type: 'slash', value: 0.25 },
  },
  expose_pierce: {
    duration: 3,
    resistReduction: { type: 'pierce', value: 0.25 },
  },
  expose_impact: {
    duration: 3,
    resistReduction: { type: 'impact', value: 0.25 },
  },
  
  // 防禦狀態
  guarded: {
    duration: 2,
  },
  intercept: {
    duration: 1,
  },
  
  // 其他狀態（預留）
  guard_break: {
    duration: 1,
  },
}

/**
 * 應用狀態到單位
 * 
 * @param state 當前遊戲狀態
 * @param targetId 目標單位 ID
 * @param statusId 狀態 ID
 * @param sourceId 來源單位 ID（可選）
 * @param durationOverride 持續時間覆蓋（可選）
 */
export function applyStatus(
  state: GameState,
  targetId: string,
  statusId: StatusId,
  sourceId?: string,
  durationOverride?: number,
): { newState: GameState; events: Event[] } {
  const target = state.units[targetId]
  if (!target || target.isDead) {
    return { newState: state, events: [] }
  }

  const config = STATUS_CONFIGS[statusId]
  const duration = durationOverride ?? config.duration

  // 檢查是否已有相同狀態
  const existingIndex = target.statusEffects.findIndex(s => s.statusId === statusId)
  
  let newStatusEffects: ActiveStatus[]
  if (existingIndex >= 0) {
    // 刷新持續時間
    newStatusEffects = [...target.statusEffects]
    newStatusEffects[existingIndex] = {
      ...newStatusEffects[existingIndex],
      remainingDuration: duration,
    }
  } else {
    // 新增狀態
    const newStatus: ActiveStatus = {
      statusId,
      sourceId: sourceId ?? null,
      remainingDuration: duration,
      stackCount: 1,
    }
    newStatusEffects = [...target.statusEffects, newStatus]
  }

  const newUnit: CombatUnit = {
    ...target,
    statusEffects: newStatusEffects,
  }

  const newState: GameState = {
    ...state,
    units: {
      ...state.units,
      [targetId]: newUnit,
    },
  }

  const events: Event[] = [{
    type: 'STATUS_APPLIED',
    unitId: targetId,
    statusId,
    sourceId: sourceId ?? null,
    duration,
  }]

  return { newState, events }
}

/**
 * 移除單位的狀態
 */
export function removeStatus(
  state: GameState,
  targetId: string,
  statusId: StatusId,
): { newState: GameState; events: Event[] } {
  const target = state.units[targetId]
  if (!target || target.isDead) {
    return { newState: state, events: [] }
  }

  const newStatusEffects = target.statusEffects.filter(s => s.statusId !== statusId)
  
  if (newStatusEffects.length === target.statusEffects.length) {
    // 沒有該狀態，不需要更新
    return { newState: state, events: [] }
  }

  const newUnit: CombatUnit = {
    ...target,
    statusEffects: newStatusEffects,
  }

  const newState: GameState = {
    ...state,
    units: {
      ...state.units,
      [targetId]: newUnit,
    },
  }

  const events: Event[] = [{
    type: 'STATUS_REMOVED',
    unitId: targetId,
    statusId,
  }]

  return { newState, events }
}

/**
 * 處理 DoT 傷害
 * 
 * 應該在每個 tick 或回合結束時調用
 */
export function processDotDamage(
  state: GameState,
  unitId: string,
): { newState: GameState; events: Event[] } {
  const unit = state.units[unitId]
  if (!unit || unit.isDead) {
    return { newState: state, events: [] }
  }

  let currentState = state
  const allEvents: Event[] = []

  // 處理所有 DoT 狀態
  for (const status of unit.statusEffects) {
    const config = STATUS_CONFIGS[status.statusId]
    if (!config.tickDamage) continue

    const damage = config.tickDamage
    const newHp = Math.max(0, unit.hp - damage)
    const isDead = newHp <= 0

    const updatedUnit: CombatUnit = {
      ...currentState.units[unitId],
      hp: newHp,
      isDead,
    }

    currentState = {
      ...currentState,
      units: {
        ...currentState.units,
        [unitId]: updatedUnit,
      },
    }

    allEvents.push({
      type: 'DAMAGE_DEALT',
      sourceId: status.sourceId ?? 'dot',
      targetId: unitId,
      amount: damage,
      damageType: status.statusId, // 使用狀態 ID 作為傷害類型
      isBackstab: false,
      pos: unit.pos,
    })

    if (isDead) {
      allEvents.push({
        type: 'UNIT_DIED',
        unitId,
        killedById: status.sourceId ?? null,
        pos: unit.pos,
      })
      break // 單位死亡，停止處理其他 DoT
    }
  }

  return { newState: currentState, events: allEvents }
}

/**
 * 減少所有狀態的持續時間
 * 
 * 應該在每個回合結束時調用
 */
export function tickStatusDurations(
  state: GameState,
  unitId: string,
  tickAmount: number = 1,
): { newState: GameState; events: Event[] } {
  const unit = state.units[unitId]
  if (!unit || unit.isDead) {
    return { newState: state, events: [] }
  }

  const events: Event[] = []
  const newStatusEffects: ActiveStatus[] = []

  for (const status of unit.statusEffects) {
    const newDuration = status.remainingDuration - tickAmount
    
    if (newDuration <= 0) {
      // 狀態過期
      events.push({
        type: 'STATUS_REMOVED',
        unitId,
        statusId: status.statusId,
      })
    } else {
      // 狀態持續
      newStatusEffects.push({
        ...status,
        remainingDuration: newDuration,
      })
    }
  }

  const newUnit: CombatUnit = {
    ...unit,
    statusEffects: newStatusEffects,
  }

  const newState: GameState = {
    ...state,
    units: {
      ...state.units,
      [unitId]: newUnit,
    },
  }

  return { newState, events }
}

/**
 * 檢查單位是否有特定狀態
 */
export function hasStatus(unit: CombatUnit, statusId: StatusId): boolean {
  return unit.statusEffects.some(s => s.statusId === statusId)
}

/**
 * 取得單位的所有狀態修正值
 * 
 * 用於計算傷害、移動速度等
 */
export function getStatusModifiers(unit: CombatUnit): {
  damageVulnerability: number
  movementPenalty: number
  atkSpeedPenalty: number
  exposeSlash: number
  exposePierce: number
  exposeImpact: number
} {
  let damageVulnerability = 0
  let movementPenalty = 0
  let atkSpeedPenalty = 0
  let exposeSlash = 0
  let exposePierce = 0
  let exposeImpact = 0

  for (const status of unit.statusEffects) {
    const config = STATUS_CONFIGS[status.statusId]
    
    if (config.damageVulnerability) {
      damageVulnerability += config.damageVulnerability
    }
    
    if (config.movementPenalty) {
      movementPenalty = Math.max(movementPenalty, config.movementPenalty)
    }
    
    if (config.atkSpeedPenalty) {
      atkSpeedPenalty = Math.max(atkSpeedPenalty, config.atkSpeedPenalty)
    }
    
    if (config.resistReduction) {
      const { type, value } = config.resistReduction
      if (type === 'slash') exposeSlash += value
      if (type === 'pierce') exposePierce += value
      if (type === 'impact') exposeImpact += value
    }
  }

  return {
    damageVulnerability,
    movementPenalty,
    atkSpeedPenalty,
    exposeSlash,
    exposePierce,
    exposeImpact,
  }
}

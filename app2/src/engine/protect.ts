/**
 * engine/protect.ts — 保護與攔截系統
 * 
 * 保護機制：
 * - 前排單位可以保護後排隊友
 * - 投射物可被前排攔截
 * - 近戰攻擊可被保護者承受
 */

import type { GameState, CombatUnit } from './state'
import { hexDistance } from '../game/hex'
import type { AttackClass } from '../game/schema'

export type ProtectResult = {
  /** 是否觸發保護 */
  protected: boolean
  /** 保護者 ID（若有） */
  protectorId: string | null
  /** 最終目標 ID（可能被改寫） */
  finalTargetId: string
  /** 保護類型 */
  protectType: 'intercept_projectile' | 'body_block' | null
}

/**
 * 檢查是否有單位保護目標
 * 
 * 保護條件：
 * 1. 保護者與被保護者同陣營
 * 2. 保護者在攻擊者與目標之間
 * 3. 保護者距離目標 <= 2 格（保護範圍）
 * 4. 保護者未死亡且未被控制
 */
export function resolveProtection(
  state: GameState,
  attackerId: string,
  targetId: string,
  attackClass: AttackClass,
): ProtectResult {
  const attacker = state.units[attackerId]
  const target = state.units[targetId]

  if (!attacker || !target || attacker.isDead || target.isDead) {
    return {
      protected: false,
      protectorId: null,
      finalTargetId: targetId,
      protectType: null,
    }
  }

  // 同陣營不觸發保護
  if (attacker.team === target.team) {
    return {
      protected: false,
      protectorId: null,
      finalTargetId: targetId,
      protectType: null,
    }
  }

  // 尋找可能的保護者
  const potentialProtectors = findPotentialProtectors(state, attacker, target)

  if (potentialProtectors.length === 0) {
    return {
      protected: false,
      protectorId: null,
      finalTargetId: targetId,
      protectType: null,
    }
  }

  // 投射物攔截
  if (attackClass === 'projectile') {
    // 選擇最近的保護者（最有可能攔截）
    const protector = potentialProtectors[0]!
    
    // 簡化版：100% 攔截機率
    // 完整版可以加入 interceptProjectileChance 判定
    return {
      protected: true,
      protectorId: protector.id,
      finalTargetId: protector.id,
      protectType: 'intercept_projectile',
    }
  }

  // 近戰保護（body block）
  if (attackClass === 'melee') {
    // 近戰保護需要保護者緊鄰目標
    const adjacentProtector = potentialProtectors.find(p => 
      hexDistance(p.pos, target.pos) === 1
    )

    if (adjacentProtector) {
      return {
        protected: true,
        protectorId: adjacentProtector.id,
        finalTargetId: adjacentProtector.id,
        protectType: 'body_block',
      }
    }
  }

  // 其他攻擊類型暫不支援保護
  return {
    protected: false,
    protectorId: null,
    finalTargetId: targetId,
    protectType: null,
  }
}

/**
 * 尋找可能的保護者
 * 
 * 條件：
 * - 與目標同陣營
 * - 在攻擊者與目標之間
 * - 距離目標 <= 2 格
 * - 未死亡且未被控制
 */
function findPotentialProtectors(
  state: GameState,
  attacker: CombatUnit,
  target: CombatUnit,
): CombatUnit[] {
  const protectors: CombatUnit[] = []

  for (const unit of Object.values(state.units)) {
    // 基本條件檢查
    if (unit.isDead) continue
    if (unit.id === target.id) continue
    if (unit.team !== target.team) continue

    // 檢查是否被控制（麻痺/睡眠）
    const isStunned = unit.statusEffects.some(s => 
      s.id === 'paralyze' || s.id === 'sleep'
    )
    if (isStunned) continue

    // 距離檢查：保護者需要在目標附近
    const distToTarget = hexDistance(unit.pos, target.pos)
    if (distToTarget > 2) continue

    // 位置檢查：保護者需要在攻擊者與目標之間
    const distAttackerToProtector = hexDistance(attacker.pos, unit.pos)
    const distAttackerToTarget = hexDistance(attacker.pos, target.pos)
    
    if (distAttackerToProtector < distAttackerToTarget) {
      protectors.push(unit)
    }
  }

  // 按距離目標排序（最近的優先）
  protectors.sort((a, b) => {
    const distA = hexDistance(a.pos, target.pos)
    const distB = hexDistance(b.pos, target.pos)
    return distA - distB
  })

  return protectors
}

/**
 * 檢查單位是否可以保護目標
 */
export function canProtect(
  state: GameState,
  protectorId: string,
  targetId: string,
): boolean {
  const protector = state.units[protectorId]
  const target = state.units[targetId]

  if (!protector || !target) return false
  if (protector.isDead || target.isDead) return false
  if (protector.team !== target.team) return false

  const isStunned = protector.statusEffects.some(s => 
    s.id === 'paralyze' || s.id === 'sleep'
  )
  if (isStunned) return false

  const dist = hexDistance(protector.pos, target.pos)
  return dist <= 2
}

/**
 * 計算保護值加成
 * 某些職業有額外的保護效果
 */
export function calculateProtectValue(
  protectValueMult?: number,
): number {
  const baseValue = 1.0
  const mult = protectValueMult ?? 1.0
  return baseValue * mult
}

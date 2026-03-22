import type { CombatUnit } from './state'
import type { WeaponDef, ScalingStat, DamageType, ElementType, AttackClass } from '../game/schema'
import type { DamageProfile } from './damage'

/**
 * 武器傷害計算模組
 * 
 * 根據 MVP_BATTLE_DATA.md 的設計：
 * - 基準傷害：輕快招 18-24、標準 28-36、重招 40-55
 * - 屬性成長：STR/AGI/INT 影響最終傷害
 * - 武器匹配：base_mode vs perfect_match_mode
 */

/**
 * 屬性成長倍率計算
 * 
 * MVP 建議：
 * - STR 10 = 100% 物理傷害
 * - AGI 10 = 100% 敏捷傷害
 * - INT 10 = 100% 奧術傷害
 * 
 * 每點屬性約 +10% 傷害
 */
export function calculateStatScaling(unit: CombatUnit, scalingStat: ScalingStat): number {
  // 從 CombatUnit 取得屬性值（目前簡化版本，未來從 bloodline + genes 計算）
  // 暫時使用固定基準值
  const baseStatValue = 10 // 基準屬性值
  
  // TODO: 從 unit 的 bloodline 和 genes 計算實際屬性
  // const actualStat = getUnitStat(unit, scalingStat)
  
  // 暫時返回 1.0 倍率（未來實作完整屬性系統後調整）
  return 1.0
}

/**
 * 計算武器基礎傷害
 * 
 * 考慮因素：
 * 1. 武器定義的 baseDamage
 * 2. 屬性成長倍率
 * 3. 武器匹配模式（base_mode / perfect_match_mode）
 */
export function calculateWeaponDamage(
  unit: CombatUnit,
  weapon: WeaponDef,
  matchMode: 'base_mode' | 'perfect_match_mode' = 'base_mode',
): number {
  // 1. 武器基礎傷害
  const baseDamage = weapon.baseDamage
  
  // 2. 屬性成長倍率
  const statMult = calculateStatScaling(unit, weapon.statScaling)
  
  // 3. 武器匹配模式加成
  const modeEffect = matchMode === 'perfect_match_mode' 
    ? weapon.perfectMatchMode 
    : weapon.baseMode
  const modeDamageMult = modeEffect.damageMult ?? 1.0
  
  // 最終傷害 = 基礎 × 屬性倍率 × 模式倍率
  return Math.round(baseDamage * statMult * modeDamageMult)
}

/**
 * 從武器定義建立 DamageProfile
 * 
 * 這是連接 WeaponDef 和戰鬥系統的橋樑
 */
export function weaponToDamageProfile(
  unit: CombatUnit,
  weapon: WeaponDef,
  matchMode: 'base_mode' | 'perfect_match_mode' = 'base_mode',
  overrides?: Partial<DamageProfile>,
): DamageProfile {
  const baseDamage = calculateWeaponDamage(unit, weapon, matchMode)
  
  return {
    baseDamage,
    damageType: weapon.damageType,
    elementType: weapon.elementType,
    attackClass: weapon.attackClass,
    elementDamageRatio: weapon.elementType !== 'none' ? 0.3 : 0, // 元素傷害佔 30%
    canBackstab: weapon.actionTags.includes('backstab'),
    guaranteedBackstab: false,
    alwaysMiss: false,
    ...overrides,
  }
}

/**
 * 計算武器的打斷值
 * 
 * 考慮因素：
 * 1. 武器基礎打斷值
 * 2. 武器匹配模式的額外打斷 tags
 * 3. 單位的打斷加成（從 genes 或 buffs）
 */
export function calculateWeaponInterrupt(
  weapon: WeaponDef,
  matchMode: 'base_mode' | 'perfect_match_mode' = 'base_mode',
): { value: number; tags: string[] } {
  const baseInterrupt = weapon.baseInterrupt
  
  const modeEffect = matchMode === 'perfect_match_mode' 
    ? weapon.perfectMatchMode 
    : weapon.baseMode
  
  const extraTags = modeEffect.extraInterruptTags ?? []
  
  return {
    value: baseInterrupt,
    tags: extraTags,
  }
}

/**
 * 計算武器的施法時間和恢復時間
 * 
 * MVP 數值範例：
 * - 快速技能：cast 0-8, recovery 16-20
 * - 標準技能：cast 16-24, recovery 24-32
 * - 重型技能：cast 24-32, recovery 32-40
 */
export function calculateWeaponTiming(
  weapon: WeaponDef,
  castMult: number = 1.0,
  recoveryMult: number = 1.0,
): { castMs: number; recoveryMs: number } {
  // 將 action 值轉換為毫秒（1 action ≈ 100ms）
  const ACTION_TO_MS = 100
  
  const baseCastMs = weapon.baseCast * ACTION_TO_MS
  const baseRecoveryMs = weapon.baseRecovery * ACTION_TO_MS
  
  return {
    castMs: Math.round(baseCastMs * castMult),
    recoveryMs: Math.round(baseRecoveryMs * recoveryMult),
  }
}

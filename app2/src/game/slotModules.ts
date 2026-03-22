import type { InterruptTag, StatusId, ElementType } from './schema'

/**
 * 插槽模組系統
 * 
 * 用於武器自訂，玩家可以將模組插入武器的三種插槽：
 * - tempo（時序孔）：影響施法/恢復時間、傷害權衡
 * - tactical（戰術孔）：影響範圍、位移、目標選擇
 * - enchant（附魔孔）：影響元素、狀態效果
 */

export type SlotType = 'tempo' | 'tactical' | 'enchant'

/**
 * 時序修正
 */
export type TimingModifiers = {
  castMult?: number      // 施法時間倍率
  recoveryMult?: number  // 恢復時間倍率
}

/**
 * 傷害修正
 */
export type DamageModifiers = {
  damageMult?: number           // 總傷害倍率
  elementType?: ElementType     // 改變元素類型
  elementRatio?: number         // 元素傷害比例
  criticalChance?: number       // 暴擊率
  criticalDamage?: number       // 暴擊傷害
}

/**
 * 戰術效果
 */
export type TacticalEffects = {
  // 位移效果
  enableSelfAdvance?: boolean      // 攻擊前前進
  enablePush?: boolean             // 推擊
  enableSwap?: boolean             // 換位
  enablePull?: boolean             // 拉扯
  
  // 保護效果
  enableProtectNeighbor?: boolean  // 保護鄰格
  enableIntercept?: boolean        // 攔截投射物
  
  // 範圍效果
  areaExpansion?: 'front_arc_3' | 'radius_1' | 'cross_1'  // 擴大範圍
  piercing?: boolean               // 穿透
  maxPierceTargets?: number        // 最大穿透數
  
  // 特殊效果
  chainAttack?: boolean            // 連鎖攻擊
  maxChains?: number               // 最大連鎖數
}

/**
 * 狀態效果
 */
export type StatusEffects = {
  applyStatuses?: StatusId[]       // 施加的狀態
  applyChance?: number             // 施加機率
  removeStatuses?: StatusId[]      // 移除的狀態
}

/**
 * 打斷效果
 */
export type InterruptEffects = {
  interruptBonus?: number          // 額外打斷值
  extraInterruptTags?: InterruptTag[]  // 額外打斷類型
}

/**
 * 插槽模組定義
 */
export type SlotModule = {
  id: string
  name: string
  slotType: SlotType
  description: string
  
  // 各種效果修正
  timingModifiers?: TimingModifiers
  damageModifiers?: DamageModifiers
  tacticalEffects?: TacticalEffects
  statusEffects?: StatusEffects
  interruptEffects?: InterruptEffects
  
  // 限制條件
  requireAttackClass?: string      // 需要特定攻擊類型
  requireBloodlineFamily?: string  // 需要特定血統家族
  
  // UI 提示
  icon?: string
  rarity?: 'common' | 'rare' | 'epic' | 'legendary'
}

/**
 * 武器插槽配置
 */
export type WeaponSlotConfig = {
  weaponId: string
  
  // 已裝備的模組
  tempoModules: string[]      // tempo 插槽模組 ID
  tacticalModules: string[]   // tactical 插槽模組 ID
  enchantModules: string[]    // enchant 插槽模組 ID
}

/**
 * 合併多個模組的效果
 */
export function mergeModuleEffects(modules: SlotModule[]): {
  timingModifiers: TimingModifiers
  damageModifiers: DamageModifiers
  tacticalEffects: TacticalEffects
  statusEffects: StatusEffects
  interruptEffects: InterruptEffects
} {
  let castMult = 1.0
  let recoveryMult = 1.0
  let damageMult = 1.0
  let elementType: ElementType = 'none'
  let elementRatio = 0
  let criticalChance = 0
  let criticalDamage = 0
  
  const tacticalEffects: TacticalEffects = {}
  const statusEffects: StatusEffects = {
    applyStatuses: [],
    removeStatuses: [],
  }
  const interruptEffects: InterruptEffects = {
    extraInterruptTags: [],
  }
  
  for (const module of modules) {
    // 合併時序修正（累乘）
    if (module.timingModifiers?.castMult) {
      castMult *= module.timingModifiers.castMult
    }
    if (module.timingModifiers?.recoveryMult) {
      recoveryMult *= module.timingModifiers.recoveryMult
    }
    
    // 合併傷害修正（累乘）
    if (module.damageModifiers?.damageMult) {
      damageMult *= module.damageModifiers.damageMult
    }
    
    // 元素類型（最後一個覆蓋）
    if (module.damageModifiers?.elementType) {
      elementType = module.damageModifiers.elementType
    }
    if (module.damageModifiers?.elementRatio) {
      elementRatio = Math.max(elementRatio, module.damageModifiers.elementRatio)
    }
    
    // 暴擊（累加）
    if (module.damageModifiers?.criticalChance) {
      criticalChance += module.damageModifiers.criticalChance
    }
    if (module.damageModifiers?.criticalDamage) {
      criticalDamage += module.damageModifiers.criticalDamage
    }
    
    // 合併戰術效果（OR 邏輯）
    if (module.tacticalEffects) {
      Object.assign(tacticalEffects, module.tacticalEffects)
    }
    
    // 合併狀態效果（合併陣列）
    if (module.statusEffects?.applyStatuses) {
      statusEffects.applyStatuses = [
        ...(statusEffects.applyStatuses ?? []),
        ...module.statusEffects.applyStatuses,
      ]
    }
    if (module.statusEffects?.removeStatuses) {
      statusEffects.removeStatuses = [
        ...(statusEffects.removeStatuses ?? []),
        ...module.statusEffects.removeStatuses,
      ]
    }
    
    // 合併打斷效果（累加）
    if (module.interruptEffects?.interruptBonus) {
      interruptEffects.interruptBonus = 
        (interruptEffects.interruptBonus ?? 0) + module.interruptEffects.interruptBonus
    }
    if (module.interruptEffects?.extraInterruptTags) {
      interruptEffects.extraInterruptTags = [
        ...(interruptEffects.extraInterruptTags ?? []),
        ...module.interruptEffects.extraInterruptTags,
      ]
    }
  }
  
  return {
    timingModifiers: { castMult, recoveryMult },
    damageModifiers: { 
      damageMult, 
      elementType: elementType !== 'none' ? elementType : undefined,
      elementRatio: elementRatio > 0 ? elementRatio : undefined,
      criticalChance: criticalChance > 0 ? criticalChance : undefined,
      criticalDamage: criticalDamage > 0 ? criticalDamage : undefined,
    },
    tacticalEffects,
    statusEffects,
    interruptEffects,
  }
}

/**
 * 驗證模組是否可以裝備到武器
 */
export function canEquipModule(
  module: SlotModule,
  weaponAttackClass: string,
  bloodlineFamily?: string,
): { canEquip: boolean; reason?: string } {
  // 檢查攻擊類型限制
  if (module.requireAttackClass && module.requireAttackClass !== weaponAttackClass) {
    return {
      canEquip: false,
      reason: `需要 ${module.requireAttackClass} 類型武器`,
    }
  }
  
  // 檢查血統限制
  if (module.requireBloodlineFamily && module.requireBloodlineFamily !== bloodlineFamily) {
    return {
      canEquip: false,
      reason: `需要 ${module.requireBloodlineFamily} 血統`,
    }
  }
  
  return { canEquip: true }
}

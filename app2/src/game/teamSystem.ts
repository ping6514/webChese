/**
 * 隊伍編成系統
 * 
 * 管理 3 個戰棋位置的配置
 * 武器和模組為獨立資產，不共用
 */

import type { BloodlineDef, WeaponDef, GeneDef, ToolDef } from './schema'
import type { SlotModule } from './slotModules'

/**
 * 單個戰棋的配置
 */
export type UnitBuild = {
  id: string
  position: 1 | 2 | 3
  bloodlineId: string | null
  
  // 裝備的武器（含插槽配置）
  equippedWeapons: EquippedWeaponInstance[]
  
  // 裝備的基因
  equippedGeneIds: string[]
  
  // 裝備的工具
  equippedToolIds: string[]
}

/**
 * 武器實例（每個武器是獨立資產）
 */
export type EquippedWeaponInstance = {
  instanceId: string  // 武器實例 ID（唯一）
  weaponId: string    // 武器定義 ID
  
  // 插槽配置
  slotConfig: {
    tempoModules: string[]    // tempo 模組實例 ID
    tacticalModules: string[] // tactical 模組實例 ID
    enchantModules: string[]  // enchant 模組實例 ID
  }
}

/**
 * 完整隊伍配置
 */
export type TeamBuild = {
  id: string
  name: string
  units: [UnitBuild, UnitBuild, UnitBuild]
  createdAt: number
  updatedAt: number
}

/**
 * 創建空的戰棋配置
 */
export function createEmptyUnitBuild(position: 1 | 2 | 3): UnitBuild {
  return {
    id: `unit_${position}_${Date.now()}`,
    position,
    bloodlineId: null,
    equippedWeapons: [],
    equippedGeneIds: [],
    equippedToolIds: [],
  }
}

/**
 * 創建空的隊伍配置
 */
export function createEmptyTeamBuild(name: string = '新隊伍'): TeamBuild {
  return {
    id: `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    units: [
      createEmptyUnitBuild(1),
      createEmptyUnitBuild(2),
      createEmptyUnitBuild(3),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

/**
 * 為戰棋設定血統卡
 */
export function setUnitBloodline(
  unit: UnitBuild,
  bloodlineId: string | null
): UnitBuild {
  // 切換血統卡時清空所有裝備
  if (bloodlineId !== unit.bloodlineId) {
    return {
      ...unit,
      bloodlineId,
      equippedWeapons: [],
      equippedGeneIds: [],
      equippedToolIds: [],
    }
  }
  
  return { ...unit, bloodlineId }
}

/**
 * 為戰棋裝備武器實例
 */
export function equipWeaponInstance(
  unit: UnitBuild,
  weaponInstanceId: string,
  weaponId: string,
  bloodline: BloodlineDef
): { success: boolean; unit?: UnitBuild; error?: string } {
  // 檢查武器槽位限制
  if (unit.equippedWeapons.length >= bloodline.weaponSlots) {
    return {
      success: false,
      error: `武器槽位已滿（${bloodline.weaponSlots}/${bloodline.weaponSlots}）`,
    }
  }
  
  // 檢查是否已裝備此實例
  if (unit.equippedWeapons.some(w => w.instanceId === weaponInstanceId)) {
    return {
      success: false,
      error: '此武器已裝備',
    }
  }
  
  const newWeapon: EquippedWeaponInstance = {
    instanceId: weaponInstanceId,
    weaponId,
    slotConfig: {
      tempoModules: [],
      tacticalModules: [],
      enchantModules: [],
    },
  }
  
  return {
    success: true,
    unit: {
      ...unit,
      equippedWeapons: [...unit.equippedWeapons, newWeapon],
    },
  }
}

/**
 * 卸下武器實例
 */
export function unequipWeaponInstance(
  unit: UnitBuild,
  weaponInstanceId: string
): UnitBuild {
  return {
    ...unit,
    equippedWeapons: unit.equippedWeapons.filter(
      w => w.instanceId !== weaponInstanceId
    ),
  }
}

/**
 * 為武器實例安裝模組
 */
export function installModuleToWeapon(
  unit: UnitBuild,
  weaponInstanceId: string,
  moduleInstanceId: string,
  slotType: 'tempo' | 'tactical' | 'enchant',
  weapon: WeaponDef
): { success: boolean; unit?: UnitBuild; error?: string } {
  const weaponIndex = unit.equippedWeapons.findIndex(
    w => w.instanceId === weaponInstanceId
  )
  
  if (weaponIndex === -1) {
    return { success: false, error: '找不到武器' }
  }
  
  const equippedWeapon = unit.equippedWeapons[weaponIndex]
  if (!equippedWeapon) {
    return { success: false, error: '找不到武器' }
  }
  
  const slotProfile = weapon.slotProfile
  
  // 檢查插槽數量限制
  let currentModules: string[] = []
  if (slotType === 'tempo') {
    currentModules = equippedWeapon.slotConfig.tempoModules
  } else if (slotType === 'tactical') {
    currentModules = equippedWeapon.slotConfig.tacticalModules
  } else {
    currentModules = equippedWeapon.slotConfig.enchantModules
  }
  const maxSlots = slotProfile[slotType]
  
  if (currentModules.length >= maxSlots) {
    return {
      success: false,
      error: `${slotType} 插槽已滿（${maxSlots}/${maxSlots}）`,
    }
  }
  
  // 檢查是否已安裝此模組實例
  if (currentModules.includes(moduleInstanceId)) {
    return { success: false, error: '此模組已安裝' }
  }
  
  // 安裝模組
  const newEquippedWeapons = [...unit.equippedWeapons]
  const updatedSlotConfig = {
    ...equippedWeapon.slotConfig,
  }
  
  if (slotType === 'tempo') {
    updatedSlotConfig.tempoModules = [...currentModules, moduleInstanceId]
  } else if (slotType === 'tactical') {
    updatedSlotConfig.tacticalModules = [...currentModules, moduleInstanceId]
  } else {
    updatedSlotConfig.enchantModules = [...currentModules, moduleInstanceId]
  }
  
  newEquippedWeapons[weaponIndex] = {
    instanceId: equippedWeapon.instanceId,
    weaponId: equippedWeapon.weaponId,
    slotConfig: updatedSlotConfig,
  }
  
  return {
    success: true,
    unit: {
      ...unit,
      equippedWeapons: newEquippedWeapons,
    },
  }
}

/**
 * 從武器實例卸下模組
 */
export function uninstallModuleFromWeapon(
  unit: UnitBuild,
  weaponInstanceId: string,
  moduleInstanceId: string,
  slotType: 'tempo' | 'tactical' | 'enchant'
): UnitBuild {
  const weaponIndex = unit.equippedWeapons.findIndex(
    w => w.instanceId === weaponInstanceId
  )
  
  if (weaponIndex === -1) return unit
  
  const equippedWeapon = unit.equippedWeapons[weaponIndex]
  if (!equippedWeapon) return unit
  
  const newEquippedWeapons = [...unit.equippedWeapons]
  const updatedSlotConfig = {
    ...equippedWeapon.slotConfig,
  }
  
  if (slotType === 'tempo') {
    updatedSlotConfig.tempoModules = updatedSlotConfig.tempoModules.filter(id => id !== moduleInstanceId)
  } else if (slotType === 'tactical') {
    updatedSlotConfig.tacticalModules = updatedSlotConfig.tacticalModules.filter(id => id !== moduleInstanceId)
  } else {
    updatedSlotConfig.enchantModules = updatedSlotConfig.enchantModules.filter(id => id !== moduleInstanceId)
  }
  
  newEquippedWeapons[weaponIndex] = {
    instanceId: equippedWeapon.instanceId,
    weaponId: equippedWeapon.weaponId,
    slotConfig: updatedSlotConfig,
  }
  
  return {
    ...unit,
    equippedWeapons: newEquippedWeapons,
  }
}

/**
 * 裝備基因
 */
export function equipGene(
  unit: UnitBuild,
  geneId: string,
  bloodline: BloodlineDef,
  gene: GeneDef
): { success: boolean; unit?: UnitBuild; error?: string } {
  // 檢查是否為專用基因
  const isExclusive = gene.geneType === 'exclusive'
  
  if (isExclusive) {
    // 專用基因：檢查是否在選項中
    if (!bloodline.exclusiveGeneOptions.includes(geneId)) {
      return { success: false, error: '此專用基因不適用於當前血統卡' }
    }
    
    // 檢查是否已裝備其他專用基因
    const hasExclusive = unit.equippedGeneIds.some(id => {
      return bloodline.exclusiveGeneOptions.includes(id)
    })
    
    if (hasExclusive) {
      return { success: false, error: '已裝備專用基因，請先卸下' }
    }
  } else {
    // 通用基因：檢查數量限制
    const genericCount = unit.equippedGeneIds.filter(id => {
      return !bloodline.exclusiveGeneOptions.includes(id)
    }).length
    
    if (genericCount >= bloodline.genericGeneSlots) {
      return {
        success: false,
        error: `通用基因槽位已滿（${bloodline.genericGeneSlots}/${bloodline.genericGeneSlots}）`,
      }
    }
  }
  
  // 檢查是否已裝備
  if (unit.equippedGeneIds.includes(geneId)) {
    return { success: false, error: '此基因已裝備' }
  }
  
  return {
    success: true,
    unit: {
      ...unit,
      equippedGeneIds: [...unit.equippedGeneIds, geneId],
    },
  }
}

/**
 * 卸下基因
 */
export function unequipGene(unit: UnitBuild, geneId: string): UnitBuild {
  return {
    ...unit,
    equippedGeneIds: unit.equippedGeneIds.filter(id => id !== geneId),
  }
}

/**
 * 裝備工具
 */
export function equipTool(
  unit: UnitBuild,
  toolId: string,
  bloodline: BloodlineDef
): { success: boolean; unit?: UnitBuild; error?: string } {
  // 檢查工具槽位限制
  if (unit.equippedToolIds.length >= bloodline.toolSlots) {
    return {
      success: false,
      error: `工具槽位已滿（${bloodline.toolSlots}/${bloodline.toolSlots}）`,
    }
  }
  
  // 檢查是否已裝備
  if (unit.equippedToolIds.includes(toolId)) {
    return { success: false, error: '此工具已裝備' }
  }
  
  return {
    success: true,
    unit: {
      ...unit,
      equippedToolIds: [...unit.equippedToolIds, toolId],
    },
  }
}

/**
 * 卸下工具
 */
export function unequipTool(unit: UnitBuild, toolId: string): UnitBuild {
  return {
    ...unit,
    equippedToolIds: unit.equippedToolIds.filter(id => id !== toolId),
  }
}

/**
 * 驗證戰棋配置
 */
export function validateUnitBuild(
  unit: UnitBuild,
  bloodline: BloodlineDef | null
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  
  if (!bloodline) {
    errors.push('未選擇血統卡')
    return { valid: false, errors, warnings }
  }
  
  // 檢查武器數量
  if (unit.equippedWeapons.length > bloodline.weaponSlots) {
    errors.push(`武器數量超過限制（${unit.equippedWeapons.length}/${bloodline.weaponSlots}）`)
  }
  
  // 檢查基因數量
  const exclusiveCount = unit.equippedGeneIds.filter(id =>
    bloodline.exclusiveGeneOptions.includes(id)
  ).length
  
  const genericCount = unit.equippedGeneIds.filter(id =>
    !bloodline.exclusiveGeneOptions.includes(id)
  ).length
  
  if (exclusiveCount > 1) {
    errors.push(`專用基因數量超過限制（${exclusiveCount}/1）`)
  }
  
  if (genericCount > bloodline.genericGeneSlots) {
    errors.push(`通用基因數量超過限制（${genericCount}/${bloodline.genericGeneSlots}）`)
  }
  
  // 檢查工具數量
  if (unit.equippedToolIds.length > bloodline.toolSlots) {
    errors.push(`工具數量超過限制（${unit.equippedToolIds.length}/${bloodline.toolSlots}）`)
  }
  
  // 警告：未裝備武器
  if (unit.equippedWeapons.length === 0) {
    warnings.push('未裝備任何武器')
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

import type { BloodlineDef, WeaponDef, GeneDef, ToolDef } from './schema'
import type { SlotModule, WeaponSlotConfig } from './slotModules'

/**
 * 配裝系統
 * 
 * 管理玩家的血統卡配裝，包括：
 * - 血統卡選擇
 * - 武器裝備（含插槽模組）
 * - 基因裝備
 * - 工具裝備
 * - 配裝儲存/讀取
 */

/**
 * 單個武器的完整配置
 */
export type EquippedWeapon = {
  weaponId: string
  slotConfig: WeaponSlotConfig
}

/**
 * 完整的配裝定義
 */
export type Loadout = {
  id: string
  name: string
  bloodlineId: string
  
  // 裝備的武器（含插槽配置）
  equippedWeapons: EquippedWeapon[]
  
  // 裝備的基因
  equippedGeneIds: string[]
  
  // 裝備的工具
  equippedToolIds: string[]
  
  // 元數據
  createdAt: number
  updatedAt: number
}

/**
 * 配裝驗證結果
 */
export type LoadoutValidation = {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * 驗證配裝是否合法
 */
export function validateLoadout(
  loadout: Loadout,
  bloodline: BloodlineDef,
  allWeapons: WeaponDef[],
  allGenes: GeneDef[],
  allTools: ToolDef[],
  allModules: SlotModule[],
): LoadoutValidation {
  const errors: string[] = []
  const warnings: string[] = []
  
  // 1. 驗證血統卡匹配
  if (loadout.bloodlineId !== bloodline.id) {
    errors.push('配裝的血統卡 ID 不匹配')
  }
  
  // 2. 驗證武器數量
  if (loadout.equippedWeapons.length > bloodline.weaponSlots) {
    errors.push(`武器數量超過限制（${loadout.equippedWeapons.length}/${bloodline.weaponSlots}）`)
  }
  
  // 3. 驗證每個武器
  for (const equippedWeapon of loadout.equippedWeapons) {
    const weapon = allWeapons.find(w => w.id === equippedWeapon.weaponId)
    if (!weapon) {
      errors.push(`找不到武器：${equippedWeapon.weaponId}`)
      continue
    }
    
    // 驗證武器的必要 tags
    const missingTags = weapon.requiredTags.filter(
      tag => !bloodline.raceTags.includes(tag)
    )
    if (missingTags.length > 0) {
      errors.push(`武器 ${weapon.name} 需要 tags：${missingTags.join(', ')}`)
    }
    
    // 驗證插槽模組
    const slotConfig = equippedWeapon.slotConfig
    const weaponSlotProfile = weapon.slotProfile
    
    // 檢查 tempo 插槽
    if (slotConfig.tempoModules.length > weaponSlotProfile.tempo) {
      errors.push(`武器 ${weapon.name} 的 tempo 插槽超過限制`)
    }
    
    // 檢查 tactical 插槽
    if (slotConfig.tacticalModules.length > weaponSlotProfile.tactical) {
      errors.push(`武器 ${weapon.name} 的 tactical 插槽超過限制`)
    }
    
    // 檢查 enchant 插槽
    if (slotConfig.enchantModules.length > weaponSlotProfile.enchant) {
      errors.push(`武器 ${weapon.name} 的 enchant 插槽超過限制`)
    }
    
    // 驗證每個模組
    const allModuleIds = [
      ...slotConfig.tempoModules,
      ...slotConfig.tacticalModules,
      ...slotConfig.enchantModules,
    ]
    
    for (const moduleId of allModuleIds) {
      const module = allModules.find(m => m.id === moduleId)
      if (!module) {
        errors.push(`找不到模組：${moduleId}`)
      }
    }
  }
  
  // 4. 驗證基因數量
  const exclusiveGenes = loadout.equippedGeneIds.filter(geneId => {
    const gene = allGenes.find(g => g.id === geneId)
    return gene?.geneType === 'exclusive'
  })
  
  const genericGenes = loadout.equippedGeneIds.filter(geneId => {
    const gene = allGenes.find(g => g.id === geneId)
    return gene?.geneType === 'generic'
  })
  
  // 專用基因：必須在 exclusiveGeneOptions 中
  for (const geneId of exclusiveGenes) {
    if (!bloodline.exclusiveGeneOptions.includes(geneId)) {
      errors.push(`專用基因 ${geneId} 不適用於此血統卡`)
    }
  }
  
  if (exclusiveGenes.length > 1) {
    errors.push(`專用基因只能裝備 1 個（目前：${exclusiveGenes.length}）`)
  }
  
  if (genericGenes.length > bloodline.genericGeneSlots) {
    errors.push(`通用基因數量超過限制（${genericGenes.length}/${bloodline.genericGeneSlots}）`)
  }
  
  // 5. 驗證工具數量
  if (loadout.equippedToolIds.length > bloodline.toolSlots) {
    errors.push(`工具數量超過限制（${loadout.equippedToolIds.length}/${bloodline.toolSlots}）`)
  }
  
  // 6. 警告：武器匹配度
  for (const equippedWeapon of loadout.equippedWeapons) {
    const weapon = allWeapons.find(w => w.id === equippedWeapon.weaponId)
    if (!weapon) continue
    
    const matchedFamily = weapon.preferredFamilies.includes(bloodline.family)
    const matchedTags = weapon.preferredTags.filter(
      tag => bloodline.raceTags.includes(tag)
    )
    
    if (!matchedFamily && matchedTags.length === 0) {
      warnings.push(`武器 ${weapon.name} 與血統卡匹配度較低`)
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * 創建新配裝
 */
export function createLoadout(
  name: string,
  bloodlineId: string,
): Loadout {
  return {
    id: `loadout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    bloodlineId,
    equippedWeapons: [],
    equippedGeneIds: [],
    equippedToolIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

/**
 * 裝備武器
 */
export function equipWeapon(
  loadout: Loadout,
  weaponId: string,
  bloodline: BloodlineDef,
): { success: boolean; loadout?: Loadout; error?: string } {
  // 檢查武器數量限制
  if (loadout.equippedWeapons.length >= bloodline.weaponSlots) {
    return {
      success: false,
      error: `武器欄位已滿（${bloodline.weaponSlots}/${bloodline.weaponSlots}）`,
    }
  }
  
  // 檢查是否已裝備
  if (loadout.equippedWeapons.some(w => w.weaponId === weaponId)) {
    return {
      success: false,
      error: '此武器已裝備',
    }
  }
  
  const newLoadout: Loadout = {
    ...loadout,
    equippedWeapons: [
      ...loadout.equippedWeapons,
      {
        weaponId,
        slotConfig: {
          weaponId,
          tempoModules: [],
          tacticalModules: [],
          enchantModules: [],
        },
      },
    ],
    updatedAt: Date.now(),
  }
  
  return { success: true, loadout: newLoadout }
}

/**
 * 卸下武器
 */
export function unequipWeapon(
  loadout: Loadout,
  weaponId: string,
): Loadout {
  return {
    ...loadout,
    equippedWeapons: loadout.equippedWeapons.filter(w => w.weaponId !== weaponId),
    updatedAt: Date.now(),
  }
}

/**
 * 為武器裝備插槽模組
 */
export function equipModuleToWeapon(
  loadout: Loadout,
  weaponId: string,
  moduleId: string,
  slotType: 'tempo' | 'tactical' | 'enchant',
  weapon: WeaponDef,
): { success: boolean; loadout?: Loadout; error?: string } {
  const weaponIndex = loadout.equippedWeapons.findIndex(w => w.weaponId === weaponId)
  if (weaponIndex === -1) {
    return { success: false, error: '武器未裝備' }
  }
  
  const equippedWeapon = loadout.equippedWeapons[weaponIndex]
  const slotConfig = equippedWeapon.slotConfig
  const slotProfile = weapon.slotProfile
  
  // 檢查插槽數量限制
  let currentModules: string[]
  let maxSlots: number
  
  switch (slotType) {
    case 'tempo':
      currentModules = slotConfig.tempoModules
      maxSlots = slotProfile.tempo
      break
    case 'tactical':
      currentModules = slotConfig.tacticalModules
      maxSlots = slotProfile.tactical
      break
    case 'enchant':
      currentModules = slotConfig.enchantModules
      maxSlots = slotProfile.enchant
      break
  }
  
  if (currentModules.length >= maxSlots) {
    return {
      success: false,
      error: `${slotType} 插槽已滿（${currentModules.length}/${maxSlots}）`,
    }
  }
  
  // 檢查是否已裝備
  if (currentModules.includes(moduleId)) {
    return { success: false, error: '此模組已裝備' }
  }
  
  // 創建新配置
  const newSlotConfig = { ...slotConfig }
  switch (slotType) {
    case 'tempo':
      newSlotConfig.tempoModules = [...currentModules, moduleId]
      break
    case 'tactical':
      newSlotConfig.tacticalModules = [...currentModules, moduleId]
      break
    case 'enchant':
      newSlotConfig.enchantModules = [...currentModules, moduleId]
      break
  }
  
  const newEquippedWeapons = [...loadout.equippedWeapons]
  newEquippedWeapons[weaponIndex] = {
    ...equippedWeapon,
    slotConfig: newSlotConfig,
  }
  
  return {
    success: true,
    loadout: {
      ...loadout,
      equippedWeapons: newEquippedWeapons,
      updatedAt: Date.now(),
    },
  }
}

/**
 * 從武器卸下插槽模組
 */
export function unequipModuleFromWeapon(
  loadout: Loadout,
  weaponId: string,
  moduleId: string,
  slotType: 'tempo' | 'tactical' | 'enchant',
): Loadout {
  const weaponIndex = loadout.equippedWeapons.findIndex(w => w.weaponId === weaponId)
  if (weaponIndex === -1) return loadout
  
  const equippedWeapon = loadout.equippedWeapons[weaponIndex]
  const slotConfig = { ...equippedWeapon.slotConfig }
  
  switch (slotType) {
    case 'tempo':
      slotConfig.tempoModules = slotConfig.tempoModules.filter(id => id !== moduleId)
      break
    case 'tactical':
      slotConfig.tacticalModules = slotConfig.tacticalModules.filter(id => id !== moduleId)
      break
    case 'enchant':
      slotConfig.enchantModules = slotConfig.enchantModules.filter(id => id !== moduleId)
      break
  }
  
  const newEquippedWeapons = [...loadout.equippedWeapons]
  newEquippedWeapons[weaponIndex] = {
    ...equippedWeapon,
    slotConfig,
  }
  
  return {
    ...loadout,
    equippedWeapons: newEquippedWeapons,
    updatedAt: Date.now(),
  }
}

/**
 * 裝備基因
 */
export function equipGene(
  loadout: Loadout,
  geneId: string,
  bloodline: BloodlineDef,
  gene: GeneDef,
): { success: boolean; loadout?: Loadout; error?: string } {
  // 檢查是否已裝備
  if (loadout.equippedGeneIds.includes(geneId)) {
    return { success: false, error: '此基因已裝備' }
  }
  
  const isExclusive = gene.geneType === 'exclusive'
  
  if (isExclusive) {
    // 專用基因檢查
    if (!bloodline.exclusiveGeneOptions.includes(geneId)) {
      return { success: false, error: '此專用基因不適用於當前血統卡' }
    }
    
    const hasExclusive = loadout.equippedGeneIds.some(id => {
      // 需要查找基因類型，這裡簡化處理
      return bloodline.exclusiveGeneOptions.includes(id)
    })
    
    if (hasExclusive) {
      return { success: false, error: '已裝備專用基因，請先卸下' }
    }
  } else {
    // 通用基因檢查
    const genericCount = loadout.equippedGeneIds.filter(id => {
      return !bloodline.exclusiveGeneOptions.includes(id)
    }).length
    
    if (genericCount >= bloodline.genericGeneSlots) {
      return {
        success: false,
        error: `通用基因欄位已滿（${genericCount}/${bloodline.genericGeneSlots}）`,
      }
    }
  }
  
  return {
    success: true,
    loadout: {
      ...loadout,
      equippedGeneIds: [...loadout.equippedGeneIds, geneId],
      updatedAt: Date.now(),
    },
  }
}

/**
 * 卸下基因
 */
export function unequipGene(
  loadout: Loadout,
  geneId: string,
): Loadout {
  return {
    ...loadout,
    equippedGeneIds: loadout.equippedGeneIds.filter(id => id !== geneId),
    updatedAt: Date.now(),
  }
}

/**
 * 裝備工具
 */
export function equipTool(
  loadout: Loadout,
  toolId: string,
  bloodline: BloodlineDef,
): { success: boolean; loadout?: Loadout; error?: string } {
  if (loadout.equippedToolIds.includes(toolId)) {
    return { success: false, error: '此工具已裝備' }
  }
  
  if (loadout.equippedToolIds.length >= bloodline.toolSlots) {
    return {
      success: false,
      error: `工具欄位已滿（${loadout.equippedToolIds.length}/${bloodline.toolSlots}）`,
    }
  }
  
  return {
    success: true,
    loadout: {
      ...loadout,
      equippedToolIds: [...loadout.equippedToolIds, toolId],
      updatedAt: Date.now(),
    },
  }
}

/**
 * 卸下工具
 */
export function unequipTool(
  loadout: Loadout,
  toolId: string,
): Loadout {
  return {
    ...loadout,
    equippedToolIds: loadout.equippedToolIds.filter(id => id !== toolId),
    updatedAt: Date.now(),
  }
}

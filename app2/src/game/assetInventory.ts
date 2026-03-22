/**
 * 資產庫存系統
 * 
 * 管理玩家擁有的武器、模組、基因、工具實例
 * 每個實例都是獨立的，不共用
 */

import type { SlotModule } from './slotModules'

/**
 * 武器實例
 */
export type WeaponInstance = {
  instanceId: string
  weaponId: string
  isEquipped: boolean
  equippedToUnitId: string | null
}

/**
 * 模組實例
 */
export type ModuleInstance = {
  instanceId: string
  moduleId: string
  isEquipped: boolean
  equippedToWeaponInstanceId: string | null
}

/**
 * 資產庫存
 */
export type AssetInventory = {
  weapons: WeaponInstance[]
  modules: ModuleInstance[]
  
  // 基因和工具目前使用定義 ID（未來可改為實例）
  availableGeneIds: string[]
  availableToolIds: string[]
}

/**
 * 創建空的資產庫存
 */
export function createEmptyInventory(): AssetInventory {
  return {
    weapons: [],
    modules: [],
    availableGeneIds: [],
    availableToolIds: [],
  }
}

/**
 * 創建測試用資產庫存（所有資產都擁有）
 */
export function createTestInventory(
  weaponIds: string[],
  moduleIds: string[],
  geneIds: string[],
  toolIds: string[]
): AssetInventory {
  // 每個武器創建 2 個實例
  const weapons: WeaponInstance[] = []
  weaponIds.forEach(weaponId => {
    for (let i = 0; i < 2; i++) {
      weapons.push({
        instanceId: `${weaponId}_instance_${i + 1}`,
        weaponId,
        isEquipped: false,
        equippedToUnitId: null,
      })
    }
  })
  
  // 每個模組創建 3 個實例
  const modules: ModuleInstance[] = []
  moduleIds.forEach(moduleId => {
    for (let i = 0; i < 3; i++) {
      modules.push({
        instanceId: `${moduleId}_instance_${i + 1}`,
        moduleId,
        isEquipped: false,
        equippedToWeaponInstanceId: null,
      })
    }
  })
  
  return {
    weapons,
    modules,
    availableGeneIds: [...geneIds],
    availableToolIds: [...toolIds],
  }
}

/**
 * 取得未裝備的武器實例
 */
export function getAvailableWeapons(inventory: AssetInventory): WeaponInstance[] {
  return inventory.weapons.filter(w => !w.isEquipped)
}

/**
 * 取得未裝備的模組實例
 */
export function getAvailableModules(
  inventory: AssetInventory,
  slotType?: 'tempo' | 'tactical' | 'enchant',
  allModules?: SlotModule[]
): ModuleInstance[] {
  let available = inventory.modules.filter(m => !m.isEquipped)
  
  // 如果指定插槽類型，過濾模組
  if (slotType && allModules) {
    const moduleIdsOfType = allModules
      .filter(m => m.slotType === slotType)
      .map(m => m.id)
    
    available = available.filter(m => moduleIdsOfType.includes(m.moduleId))
  }
  
  return available
}

/**
 * 標記武器實例為已裝備
 */
export function markWeaponEquipped(
  inventory: AssetInventory,
  weaponInstanceId: string,
  unitId: string
): AssetInventory {
  return {
    ...inventory,
    weapons: inventory.weapons.map(w =>
      w.instanceId === weaponInstanceId
        ? { ...w, isEquipped: true, equippedToUnitId: unitId }
        : w
    ),
  }
}

/**
 * 標記武器實例為未裝備
 */
export function markWeaponUnequipped(
  inventory: AssetInventory,
  weaponInstanceId: string
): AssetInventory {
  return {
    ...inventory,
    weapons: inventory.weapons.map(w =>
      w.instanceId === weaponInstanceId
        ? { ...w, isEquipped: false, equippedToUnitId: null }
        : w
    ),
  }
}

/**
 * 標記模組實例為已裝備
 */
export function markModuleEquipped(
  inventory: AssetInventory,
  moduleInstanceId: string,
  weaponInstanceId: string
): AssetInventory {
  return {
    ...inventory,
    modules: inventory.modules.map(m =>
      m.instanceId === moduleInstanceId
        ? { ...m, isEquipped: true, equippedToWeaponInstanceId: weaponInstanceId }
        : m
    ),
  }
}

/**
 * 標記模組實例為未裝備
 */
export function markModuleUnequipped(
  inventory: AssetInventory,
  moduleInstanceId: string
): AssetInventory {
  return {
    ...inventory,
    modules: inventory.modules.map(m =>
      m.instanceId === moduleInstanceId
        ? { ...m, isEquipped: false, equippedToWeaponInstanceId: null }
        : m
    ),
  }
}

/**
 * 取得武器實例的統計
 */
export function getWeaponStats(
  inventory: AssetInventory,
  weaponId: string
): { total: number; equipped: number; available: number } {
  const instances = inventory.weapons.filter(w => w.weaponId === weaponId)
  const equipped = instances.filter(w => w.isEquipped).length
  
  return {
    total: instances.length,
    equipped,
    available: instances.length - equipped,
  }
}

/**
 * 取得模組實例的統計
 */
export function getModuleStats(
  inventory: AssetInventory,
  moduleId: string
): { total: number; equipped: number; available: number } {
  const instances = inventory.modules.filter(m => m.moduleId === moduleId)
  const equipped = instances.filter(m => m.isEquipped).length
  
  return {
    total: instances.length,
    equipped,
    available: instances.length - equipped,
  }
}

import type { Loadout } from './loadoutSystem'

/**
 * 配裝儲存系統
 * 
 * 使用 localStorage 儲存玩家的配裝
 */

const STORAGE_KEY = 'webchese_loadouts'
const MAX_LOADOUTS = 10

/**
 * 儲存的配裝集合
 */
export type LoadoutCollection = {
  loadouts: Loadout[]
  activeLoadoutId: string | null
}

/**
 * 讀取所有配裝
 */
export function loadAllLoadouts(): LoadoutCollection {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return { loadouts: [], activeLoadoutId: null }
    }
    
    const parsed = JSON.parse(stored) as LoadoutCollection
    return parsed
  } catch (error) {
    console.error('Failed to load loadouts:', error)
    return { loadouts: [], activeLoadoutId: null }
  }
}

/**
 * 儲存所有配裝
 */
export function saveAllLoadouts(collection: LoadoutCollection): boolean {
  try {
    const json = JSON.stringify(collection)
    localStorage.setItem(STORAGE_KEY, json)
    return true
  } catch (error) {
    console.error('Failed to save loadouts:', error)
    return false
  }
}

/**
 * 新增配裝
 */
export function addLoadout(loadout: Loadout): { success: boolean; error?: string } {
  const collection = loadAllLoadouts()
  
  // 檢查數量限制
  if (collection.loadouts.length >= MAX_LOADOUTS) {
    return {
      success: false,
      error: `配裝數量已達上限（${MAX_LOADOUTS}）`,
    }
  }
  
  // 檢查 ID 衝突
  if (collection.loadouts.some(l => l.id === loadout.id)) {
    return {
      success: false,
      error: '配裝 ID 已存在',
    }
  }
  
  collection.loadouts.push(loadout)
  
  // 如果是第一個配裝，設為啟用
  if (collection.loadouts.length === 1) {
    collection.activeLoadoutId = loadout.id
  }
  
  const saved = saveAllLoadouts(collection)
  return saved
    ? { success: true }
    : { success: false, error: '儲存失敗' }
}

/**
 * 更新配裝
 */
export function updateLoadout(loadout: Loadout): { success: boolean; error?: string } {
  const collection = loadAllLoadouts()
  
  const index = collection.loadouts.findIndex(l => l.id === loadout.id)
  if (index === -1) {
    return {
      success: false,
      error: '找不到配裝',
    }
  }
  
  collection.loadouts[index] = {
    ...loadout,
    updatedAt: Date.now(),
  }
  
  const saved = saveAllLoadouts(collection)
  return saved
    ? { success: true }
    : { success: false, error: '儲存失敗' }
}

/**
 * 刪除配裝
 */
export function deleteLoadout(loadoutId: string): { success: boolean; error?: string } {
  const collection = loadAllLoadouts()
  
  const index = collection.loadouts.findIndex(l => l.id === loadoutId)
  if (index === -1) {
    return {
      success: false,
      error: '找不到配裝',
    }
  }
  
  collection.loadouts.splice(index, 1)
  
  // 如果刪除的是啟用配裝，切換到第一個
  if (collection.activeLoadoutId === loadoutId) {
    collection.activeLoadoutId = collection.loadouts[0]?.id ?? null
  }
  
  const saved = saveAllLoadouts(collection)
  return saved
    ? { success: true }
    : { success: false, error: '儲存失敗' }
}

/**
 * 取得單個配裝
 */
export function getLoadout(loadoutId: string): Loadout | null {
  const collection = loadAllLoadouts()
  return collection.loadouts.find(l => l.id === loadoutId) ?? null
}

/**
 * 設定啟用配裝
 */
export function setActiveLoadout(loadoutId: string): { success: boolean; error?: string } {
  const collection = loadAllLoadouts()
  
  const exists = collection.loadouts.some(l => l.id === loadoutId)
  if (!exists) {
    return {
      success: false,
      error: '找不到配裝',
    }
  }
  
  collection.activeLoadoutId = loadoutId
  
  const saved = saveAllLoadouts(collection)
  return saved
    ? { success: true }
    : { success: false, error: '儲存失敗' }
}

/**
 * 取得啟用配裝
 */
export function getActiveLoadout(): Loadout | null {
  const collection = loadAllLoadouts()
  if (!collection.activeLoadoutId) return null
  
  return collection.loadouts.find(l => l.id === collection.activeLoadoutId) ?? null
}

/**
 * 複製配裝
 */
export function duplicateLoadout(loadoutId: string, newName: string): { success: boolean; loadout?: Loadout; error?: string } {
  const original = getLoadout(loadoutId)
  if (!original) {
    return {
      success: false,
      error: '找不到原始配裝',
    }
  }
  
  const newLoadout: Loadout = {
    ...original,
    id: `loadout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: newName,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  
  const result = addLoadout(newLoadout)
  return result.success
    ? { success: true, loadout: newLoadout }
    : { success: false, error: result.error }
}

/**
 * 匯出配裝為 JSON
 */
export function exportLoadout(loadoutId: string): string | null {
  const loadout = getLoadout(loadoutId)
  if (!loadout) return null
  
  return JSON.stringify(loadout, null, 2)
}

/**
 * 從 JSON 匯入配裝
 */
export function importLoadout(json: string): { success: boolean; loadout?: Loadout; error?: string } {
  try {
    const loadout = JSON.parse(json) as Loadout
    
    // 驗證基本結構
    if (!loadout.id || !loadout.name || !loadout.bloodlineId) {
      return {
        success: false,
        error: '配裝格式不正確',
      }
    }
    
    // 生成新 ID 避免衝突
    const newLoadout: Loadout = {
      ...loadout,
      id: `loadout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    
    const result = addLoadout(newLoadout)
    return result.success
      ? { success: true, loadout: newLoadout }
      : { success: false, error: result.error }
  } catch (error) {
    return {
      success: false,
      error: 'JSON 解析失敗',
    }
  }
}

/**
 * 清空所有配裝（危險操作）
 */
export function clearAllLoadouts(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY)
    return true
  } catch (error) {
    console.error('Failed to clear loadouts:', error)
    return false
  }
}

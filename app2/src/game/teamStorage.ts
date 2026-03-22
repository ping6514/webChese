import type { TeamBuild } from './teamSystem'
import type { AssetInventory } from './assetInventory'

/**
 * 隊伍記錄儲存系統
 * 支援多個隊伍槽位的儲存、讀取、切換
 */

export type TeamSlot = {
  id: string
  name: string
  teamBuild: TeamBuild
  inventory: AssetInventory
  lastModified: number
}

export type TeamSlotList = {
  slots: TeamSlot[]
  currentSlotId: string | null
}

const STORAGE_KEY = 'team_slots'
const MAX_SLOTS = 3

/**
 * 從 localStorage 讀取所有隊伍槽位
 */
export function loadTeamSlots(): TeamSlotList {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) {
      return {
        slots: [],
        currentSlotId: null,
      }
    }
    return JSON.parse(data)
  } catch (error) {
    console.error('讀取隊伍記錄失敗:', error)
    return {
      slots: [],
      currentSlotId: null,
    }
  }
}

/**
 * 儲存所有隊伍槽位到 localStorage
 */
export function saveTeamSlots(slotList: TeamSlotList): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slotList))
  } catch (error) {
    console.error('儲存隊伍記錄失敗:', error)
  }
}

/**
 * 創建新的隊伍槽位
 */
export function createTeamSlot(
  name: string,
  teamBuild: TeamBuild,
  inventory: AssetInventory
): TeamSlot {
  return {
    id: `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    teamBuild,
    inventory,
    lastModified: Date.now(),
  }
}

/**
 * 添加新的隊伍槽位
 */
export function addTeamSlot(
  name: string,
  teamBuild: TeamBuild,
  inventory: AssetInventory
): TeamSlotList {
  const slotList = loadTeamSlots()
  
  if (slotList.slots.length >= MAX_SLOTS) {
    throw new Error(`最多只能有 ${MAX_SLOTS} 個隊伍槽位`)
  }
  
  const newSlot = createTeamSlot(name, teamBuild, inventory)
  slotList.slots.push(newSlot)
  slotList.currentSlotId = newSlot.id
  
  saveTeamSlots(slotList)
  return slotList
}

/**
 * 更新現有的隊伍槽位
 */
export function updateTeamSlot(
  slotId: string,
  teamBuild: TeamBuild,
  inventory: AssetInventory
): TeamSlotList {
  const slotList = loadTeamSlots()
  const slotIndex = slotList.slots.findIndex(s => s.id === slotId)
  
  if (slotIndex === -1) {
    throw new Error('找不到指定的隊伍槽位')
  }
  
  const existingSlot = slotList.slots[slotIndex]!
  slotList.slots[slotIndex] = {
    id: existingSlot.id,
    name: existingSlot.name,
    teamBuild,
    inventory,
    lastModified: Date.now(),
  }
  
  saveTeamSlots(slotList)
  return slotList
}

/**
 * 重命名隊伍槽位
 */
export function renameTeamSlot(slotId: string, newName: string): TeamSlotList {
  const slotList = loadTeamSlots()
  const slotIndex = slotList.slots.findIndex(s => s.id === slotId)
  
  if (slotIndex === -1) {
    throw new Error('找不到指定的隊伍槽位')
  }
  
  const existingSlot = slotList.slots[slotIndex]!
  slotList.slots[slotIndex] = {
    id: existingSlot.id,
    name: newName,
    teamBuild: existingSlot.teamBuild,
    inventory: existingSlot.inventory,
    lastModified: Date.now(),
  }
  
  saveTeamSlots(slotList)
  return slotList
}

/**
 * 刪除隊伍槽位
 */
export function deleteTeamSlot(slotId: string): TeamSlotList {
  const slotList = loadTeamSlots()
  const slotIndex = slotList.slots.findIndex(s => s.id === slotId)
  
  if (slotIndex === -1) {
    throw new Error('找不到指定的隊伍槽位')
  }
  
  slotList.slots.splice(slotIndex, 1)
  
  // 如果刪除的是當前槽位，切換到第一個槽位
  if (slotList.currentSlotId === slotId) {
    slotList.currentSlotId = slotList.slots.length > 0 ? slotList.slots[0]!.id : null
  }
  
  saveTeamSlots(slotList)
  return slotList
}

/**
 * 切換當前隊伍槽位
 */
export function switchTeamSlot(slotId: string): TeamSlotList {
  const slotList = loadTeamSlots()
  const slot = slotList.slots.find(s => s.id === slotId)
  
  if (!slot) {
    throw new Error('找不到指定的隊伍槽位')
  }
  
  slotList.currentSlotId = slotId
  saveTeamSlots(slotList)
  return slotList
}

/**
 * 獲取當前隊伍槽位
 */
export function getCurrentTeamSlot(): TeamSlot | null {
  const slotList = loadTeamSlots()
  if (!slotList.currentSlotId) return null
  
  return slotList.slots.find(s => s.id === slotList.currentSlotId) || null
}

/**
 * 獲取所有隊伍槽位
 */
export function getAllTeamSlots(): TeamSlot[] {
  const slotList = loadTeamSlots()
  return slotList.slots
}

/**
 * 檢查是否可以添加新槽位
 */
export function canAddTeamSlot(): boolean {
  const slotList = loadTeamSlots()
  return slotList.slots.length < MAX_SLOTS
}

/**
 * 獲取剩餘可用槽位數量
 */
export function getRemainingSlots(): number {
  const slotList = loadTeamSlots()
  return MAX_SLOTS - slotList.slots.length
}

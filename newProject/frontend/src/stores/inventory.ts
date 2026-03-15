/**
 * stores/inventory.ts — 玩家物品欄（localStorage 持久化）
 *
 * 管理：
 *   - armorStash / weaponStash：共用背包池
 *   - equippedArmor / equippedWeapons：per-job 裝備配置（各職業獨立）
 *
 * 換層時裝備保持，不隨 GameState 消失。
 * 切換職業時自動存/載各職業的裝備組合。
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { FrozenArmor, FrozenWeapon, ArmorSlot } from '@engine/item'

export { type ArmorSlot }

const STORAGE_KEY = 'dungeon_inventory_v3'

export const ARMOR_SLOTS: ArmorSlot[] = ['head', 'chest', 'gloves', 'legs', 'boots']
export const SLOT_LABEL: Record<ArmorSlot, string> = {
  head:   '頭盔',
  chest:  '胸甲',
  gloves: '手套',
  legs:   '護腿',
  boots:  '靴子',
}

// ─── 型別 ──────────────────────────────────────────────────────────────────────

type JobLoadout = {
  equippedArmor:   Partial<Record<ArmorSlot, FrozenArmor | null>>
  equippedWeapons: (FrozenWeapon | null)[]
}

type SavedInventory = {
  armorStash:  FrozenArmor[]
  weaponStash: FrozenWeapon[]
  loadouts:    Record<string, JobLoadout>
}

// ─── 工具 ──────────────────────────────────────────────────────────────────────

function initEquippedArmor(raw: Partial<Record<ArmorSlot, FrozenArmor | null>>): Record<ArmorSlot, FrozenArmor | null> {
  const r = {} as Record<ArmorSlot, FrozenArmor | null>
  for (const s of ARMOR_SLOTS) r[s] = raw[s] ?? null
  return r
}

function initEquippedWeapons(raw?: (FrozenWeapon | null)[]): (FrozenWeapon | null)[] {
  return raw?.length === 3 ? raw : [null, null, null]
}

function load(): SavedInventory {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as SavedInventory
  } catch { /* ignore */ }
  return { armorStash: [], weaponStash: [], loadouts: {} }
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useInventoryStore = defineStore('inventory', () => {
  const saved = load()

  // 共用背包
  const armorStash  = ref<FrozenArmor[]>(saved.armorStash ?? [])
  const weaponStash = ref<FrozenWeapon[]>(saved.weaponStash ?? [])

  // per-job 裝備組合（所有職業）
  const loadouts = ref<Record<string, JobLoadout>>(saved.loadouts ?? {})

  // 目前選中的職業 id
  const currentJobId = ref<string>('')

  // 當前職業的已裝備 refs（會隨 currentJobId 切換內容）
  const equippedArmor   = ref<Record<ArmorSlot, FrozenArmor | null>>(initEquippedArmor({}))
  const equippedWeapons = ref<(FrozenWeapon | null)[]>([null, null, null])

  // ── 持久化（不使用 loadouts 作為 watch source，避免循環）──────────────────

  function persist() {
    // 序列化時把當前職業最新狀態合併進 loadouts（僅本地拷貝，不寫回 reactive）
    const snapshotLoadouts: Record<string, JobLoadout> = { ...loadouts.value }
    if (currentJobId.value) {
      snapshotLoadouts[currentJobId.value] = {
        equippedArmor:   { ...equippedArmor.value },
        equippedWeapons: [...equippedWeapons.value],
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      armorStash:  armorStash.value,
      weaponStash: weaponStash.value,
      loadouts:    snapshotLoadouts,
    } as SavedInventory))
  }

  // watch 只監聽「不會被自身觸發」的 sources
  watch([armorStash, weaponStash, equippedArmor, equippedWeapons], persist, { deep: true })

  // ── 切換職業：存舊的，載新的 ──────────────────────────────────────────────

  function setCurrentJob(jobId: string) {
    if (!jobId || jobId === currentJobId.value) return
    // 把目前裝備寫入 loadouts（plain object，不觸發 watch）
    if (currentJobId.value) {
      loadouts.value[currentJobId.value] = {
        equippedArmor:   { ...equippedArmor.value },
        equippedWeapons: [...equippedWeapons.value],
      }
    }
    currentJobId.value = jobId
    const existing = loadouts.value[jobId]
    equippedArmor.value   = initEquippedArmor(existing?.equippedArmor ?? {})
    equippedWeapons.value = initEquippedWeapons(existing?.equippedWeapons)
    persist()
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  const equippedArmorList = computed((): FrozenArmor[] =>
    ARMOR_SLOTS.map(s => equippedArmor.value[s]).filter(Boolean) as FrozenArmor[]
  )

  const armorStashBySlot = computed(() => {
    const map: Record<ArmorSlot, FrozenArmor[]> = {} as Record<ArmorSlot, FrozenArmor[]>
    for (const s of ARMOR_SLOTS) map[s] = []
    for (const item of armorStash.value) map[item.slot]?.push(item)
    return map
  })

  // ── Armor Actions ─────────────────────────────────────────────────────────

  function equipArmor(item: FrozenArmor) {
    const old = equippedArmor.value[item.slot]
    if (old) armorStash.value.push(old)
    equippedArmor.value[item.slot] = item
    armorStash.value = armorStash.value.filter(i => i.instanceId !== item.instanceId)
  }

  function unequipArmor(slot: ArmorSlot) {
    const item = equippedArmor.value[slot]
    if (item) { armorStash.value.push(item); equippedArmor.value[slot] = null }
  }

  function addArmorToStash(items: FrozenArmor[]) {
    for (const item of items) {
      if (!armorStash.value.find(i => i.instanceId === item.instanceId)) armorStash.value.push(item)
    }
  }

  // ── Weapon Actions ────────────────────────────────────────────────────────

  function equipWeapon(item: FrozenWeapon, slot: 0 | 1 | 2 = 0) {
    const old = equippedWeapons.value[slot]
    if (old) weaponStash.value.push(old)
    equippedWeapons.value = equippedWeapons.value.map((w, i) => i === slot ? item : w)
    weaponStash.value = weaponStash.value.filter(i => i.instanceId !== item.instanceId)
  }

  function unequipWeapon(slot: 0 | 1 | 2) {
    const item = equippedWeapons.value[slot]
    if (item) {
      weaponStash.value.push(item)
      equippedWeapons.value = equippedWeapons.value.map((w, i) => i === slot ? null : w)
    }
  }

  function addWeaponsToStash(items: FrozenWeapon[]) {
    for (const item of items) {
      if (!weaponStash.value.find(i => i.instanceId === item.instanceId)) weaponStash.value.push(item)
    }
  }

  // ── General ───────────────────────────────────────────────────────────────

  function discardArmor(instanceId: string) {
    armorStash.value = armorStash.value.filter(i => i.instanceId !== instanceId)
  }

  function discardWeapon(instanceId: string) {
    weaponStash.value = weaponStash.value.filter(i => i.instanceId !== instanceId)
  }

  /** 清空背包（不清除其他職業的裝備）*/
  function clearAll() {
    armorStash.value = []; weaponStash.value = []
    for (const s of ARMOR_SLOTS) equippedArmor.value[s] = null
    equippedWeapons.value = [null, null, null]
    // 同步清除所有職業的裝備
    for (const key of Object.keys(loadouts.value)) {
      loadouts.value[key] = {
        equippedArmor: initEquippedArmor({}),
        equippedWeapons: [null, null, null],
      }
    }
  }

  return {
    // state
    armorStash, equippedArmor,
    weaponStash, equippedWeapons,
    currentJobId,
    // computed
    equippedArmorList, armorStashBySlot,
    // consts
    ARMOR_SLOTS, SLOT_LABEL,
    // job
    setCurrentJob,
    // armor actions
    equipArmor, unequipArmor, addArmorToStash, discardArmor,
    // weapon actions
    equipWeapon, unequipWeapon, addWeaponsToStash, discardWeapon,
    // general
    clearAll,
  }
})

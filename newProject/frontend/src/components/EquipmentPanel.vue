<template>
  <div class="equip-panel">
    <div class="equip-panel__title">裝備配置</div>

    <!-- ── 武器槽（3 slots）── -->
    <div class="section-label">⚔️ 武器</div>
    <div class="slot-list">
      <div
        v-for="(wSlot, idx) in [0, 1, 2] as const"
        :key="`w${idx}`"
        class="slot-row"
        :class="{ 'slot-row--active': activeWeaponSlot === idx }"
        @click="toggleWeaponSlot(idx)"
      >
        <span class="slot-icon">{{ WEAPON_SLOT_ICON[idx] }}</span>
        <div class="slot-info">
          <span class="slot-name">武器 {{ idx + 1 }}</span>
          <template v-if="inventory.equippedWeapons[idx]">
            <span class="slot-item-name">{{ inventory.equippedWeapons[idx]!.name }}</span>
            <span class="slot-item-affixes">Lv{{ inventory.equippedWeapons[idx]!.itemLevel }}</span>
          </template>
          <span v-else class="slot-empty">（未裝備）</span>
        </div>
        <button
          v-if="inventory.equippedWeapons[idx]"
          class="slot-unequip-btn"
          title="卸下"
          @click.stop="inventory.unequipWeapon(idx)"
        >✕</button>
      </div>
    </div>

    <!-- 武器選擇器 -->
    <div v-if="activeWeaponSlot !== null" class="stash-picker">
      <div class="stash-picker__title">
        選擇武器 {{ activeWeaponSlot + 1 }}
        <span class="stash-count">（{{ inventory.weaponStash.length }} 件）</span>
      </div>
      <div v-if="inventory.weaponStash.length === 0" class="stash-empty">背包中無武器</div>
      <div
        v-for="item in inventory.weaponStash"
        :key="item.instanceId"
        class="stash-item"
        @click="pickWeapon(item)"
      >
        <div class="stash-item__header">
          <span class="stash-item__name">{{ item.name }}</span>
          <span class="stash-item__level">Lv{{ item.itemLevel }}</span>
        </div>
        <div class="stash-item__affixes">{{ item.affixIds.join(', ') || '無詞條' }}</div>
      </div>
    </div>

    <!-- ── 防具槽（5 slots）── -->
    <div class="section-label" style="margin-top:8px">🛡️ 防具</div>
    <div class="slot-list">
      <div
        v-for="slot in inventory.ARMOR_SLOTS"
        :key="slot"
        class="slot-row"
        :class="{ 'slot-row--active': activeArmorSlot === slot }"
        @click="toggleArmorSlot(slot)"
      >
        <span class="slot-icon">{{ SLOT_ICON[slot] }}</span>
        <div class="slot-info">
          <span class="slot-name">{{ inventory.SLOT_LABEL[slot] }}</span>
          <template v-if="inventory.equippedArmor[slot]">
            <span class="slot-item-name">{{ inventory.equippedArmor[slot]!.name }}</span>
            <span class="slot-item-affixes">
              {{ affixSummary(inventory.equippedArmor[slot]!) }}
            </span>
          </template>
          <span v-else class="slot-empty">（未裝備）</span>
        </div>
        <button
          v-if="inventory.equippedArmor[slot]"
          class="slot-unequip-btn"
          title="卸下"
          @click.stop="inventory.unequipArmor(slot)"
        >✕</button>
      </div>
    </div>

    <!-- 防具選擇器 -->
    <div v-if="activeArmorSlot" class="stash-picker">
      <div class="stash-picker__title">
        選擇 {{ inventory.SLOT_LABEL[activeArmorSlot] }}
        <span class="stash-count">（{{ stashForSlot.length }} 件）</span>
      </div>
      <div v-if="stashForSlot.length === 0" class="stash-empty">背包中無此槽位裝備</div>
      <div
        v-for="item in stashForSlot"
        :key="item.instanceId"
        class="stash-item"
        @click="pickArmor(item)"
      >
        <div class="stash-item__header">
          <span class="stash-item__name">{{ item.name }}</span>
          <span class="stash-item__level">Lv{{ item.itemLevel }}</span>
          <span class="stash-item__rarity" :class="`rarity-${itemRarity(item)}`">{{ itemRarity(item) }}</span>
        </div>
        <div class="stash-item__affixes">{{ affixSummary(item) }}</div>
      </div>
    </div>

    <!-- 背包概覽 -->
    <div v-if="!activeArmorSlot && activeWeaponSlot === null" class="stash-summary">
      <span class="stash-summary__label">背包總計</span>
      <span class="stash-summary__count">{{ inventory.armorStash.length + inventory.weaponStash.length }} 件</span>
      <button v-if="inventory.armorStash.length + inventory.weaponStash.length > 0" class="btn-clear" @click="confirmClear">清空</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useInventoryStore, type ArmorSlot } from '@/stores/inventory'
import { lootRegistry } from '@/data/index'
import type { FrozenArmor, FrozenWeapon } from '@engine/item'

const inventory = useInventoryStore()

const SLOT_ICON: Record<ArmorSlot, string> = {
  head:   '🪖',
  chest:  '🛡️',
  gloves: '🧤',
  legs:   '🩳',
  boots:  '👢',
}

const WEAPON_SLOT_ICON: Record<number, string> = {
  0: '⚔️',
  1: '🗡️',
  2: '🏹',
}

const activeArmorSlot = ref<ArmorSlot | null>(null)
const activeWeaponSlot = ref<0 | 1 | 2 | null>(null)

function toggleArmorSlot(slot: ArmorSlot) {
  activeWeaponSlot.value = null
  activeArmorSlot.value = activeArmorSlot.value === slot ? null : slot
}

function toggleWeaponSlot(idx: 0 | 1 | 2) {
  activeArmorSlot.value = null
  activeWeaponSlot.value = activeWeaponSlot.value === idx ? null : idx
}

const stashForSlot = computed((): FrozenArmor[] => {
  if (!activeArmorSlot.value) return []
  return inventory.armorStashBySlot[activeArmorSlot.value] ?? []
})

function pickArmor(item: FrozenArmor) {
  inventory.equipArmor(item)
  activeArmorSlot.value = null
}

function pickWeapon(item: FrozenWeapon) {
  if (activeWeaponSlot.value === null) return
  inventory.equipWeapon(item, activeWeaponSlot.value)
  activeWeaponSlot.value = null
}

function affixSummary(item: FrozenArmor): string {
  return item.affixIds
    .map(id => lootRegistry.armorAffixes.find(a => a.id === id)?.id ?? id)
    .join(', ')
}

const RARITY_LEVEL: Record<string, number> = { common: 0, rare: 1, elite: 2 }
function itemRarity(item: FrozenArmor): 'common' | 'rare' | 'elite' {
  let max = 0
  for (const id of item.affixIds) {
    const affix = lootRegistry.armorAffixes.find(a => a.id === id)
    if (affix) max = Math.max(max, RARITY_LEVEL[affix.rarity] ?? 0)
  }
  return max >= 2 ? 'elite' : max >= 1 ? 'rare' : 'common'
}

function confirmClear() {
  if (confirm('確定清空所有背包物品？')) inventory.clearAll()
}
</script>

<style scoped>
.equip-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
}

.equip-panel__title {
  font-size: 13px;
  font-weight: 700;
  color: var(--accent);
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-light);
}

.section-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: .05em;
}

/* ── 裝備槽 ── */
.slot-list { display: flex; flex-direction: column; gap: 3px; }

.slot-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 6px;
  border: 1px solid var(--border-light);
  background: var(--bg-card);
  cursor: pointer;
  transition: border-color .12s, background .12s;
  min-height: 40px;
}
.slot-row:hover { border-color: var(--accent-light); background: var(--accent-bg); }
.slot-row--active { border-color: var(--accent); background: var(--accent-bg); }

.slot-icon { font-size: 16px; flex-shrink: 0; width: 22px; text-align: center; }
.slot-info { flex: 1; display: flex; flex-direction: column; gap: 1px; overflow: hidden; }
.slot-name { font-size: 10px; color: var(--text-dim); }
.slot-item-name { font-size: 12px; font-weight: 600; color: var(--text); }
.slot-item-affixes { font-size: 10px; color: var(--text-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.slot-empty { font-size: 11px; color: var(--text-dim); opacity: .5; }

.slot-unequip-btn {
  background: transparent; border: none; color: var(--text-dim);
  cursor: pointer; font-size: 11px; padding: 3px 5px;
  border-radius: 4px; flex-shrink: 0;
}
.slot-unequip-btn:hover { background: var(--bg-panel); color: var(--red, #c0392b); }

/* ── 選擇器 ── */
.stash-picker {
  border: 1px solid var(--accent-light);
  border-radius: 6px;
  padding: 8px;
  background: var(--bg-card);
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 180px;
  overflow-y: auto;
}
.stash-picker__title {
  font-size: 11px; font-weight: 600; color: var(--accent); margin-bottom: 2px;
}
.stash-count { font-weight: 400; color: var(--text-dim); }
.stash-empty { font-size: 11px; color: var(--text-dim); padding: 4px 0; }

.stash-item {
  padding: 5px 6px;
  border-radius: 4px;
  border: 1px solid var(--border-light);
  background: var(--bg);
  cursor: pointer;
}
.stash-item:hover { border-color: var(--accent-light); background: var(--accent-bg); }

.stash-item__header {
  display: flex; align-items: center; gap: 6px; margin-bottom: 2px;
}
.stash-item__name { flex: 1; font-size: 12px; font-weight: 600; color: var(--text); }
.stash-item__level { font-size: 10px; color: var(--text-dim); }
.stash-item__rarity {
  font-size: 9px; padding: 1px 4px; border-radius: 2px; font-weight: 700;
}
.rarity-common { background: #e0e0e0; color: #555; }
.rarity-rare   { background: #d0e8ff; color: #1a5fa0; }
.rarity-elite  { background: #e8d0ff; color: #7b2ca0; }

.stash-item__affixes { font-size: 10px; color: var(--text-dim); }

/* ── 概覽 ── */
.stash-summary {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  font-size: 11px;
}
.stash-summary__label { color: var(--text-dim); }
.stash-summary__count { font-weight: 700; color: var(--accent); }
.btn-clear {
  margin-left: auto; font-size: 10px; padding: 2px 8px;
  border-radius: 4px; border: 1px solid var(--red, #c0392b);
  background: transparent; color: var(--red, #c0392b); cursor: pointer;
}
.btn-clear:hover { background: rgba(192,57,43,.1); }
</style>

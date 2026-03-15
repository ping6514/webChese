<template>
  <div class="action-menu-overlay" @click.self="$emit('close')">
    <div class="action-menu panel">
      <div class="action-menu__title">{{ unit.name }} 的行動</div>

      <div class="action-menu__stats">
        <span>SP {{ unit.currentSP }}/{{ unit.maxSP }}</span>
        <span>MP {{ unit.currentMP }}/{{ unit.maxMP }}</span>
      </div>

      <div class="action-menu__buttons">
        <button class="btn" @click="$emit('action', 'move')">
          移動 <span class="action-range">（範圍 {{ unit.moveRange }}）</span>
        </button>

        <template v-for="s in weaponSlots" :key="s.slot">
          <div class="weapon-btn-row">
            <button
              class="btn weapon-btn"
              :disabled="!canAffordWeapon(s.weapon)"
              :title="weaponCostLabel(s.weapon)"
              @click="onAttack(s.slot)"
            >
              攻擊：{{ s.weapon.name }}
              <span class="action-range">（{{ weaponCostLabel(s.weapon) }}）</span>
            </button>
            <button class="info-btn" title="武器詳情" @click.stop="showWeaponDetail(s.weapon)">ℹ️</button>
          </div>
        </template>

        <button
          v-if="unit.maxMP > 0"
          class="btn btn--convert"
          :disabled="!canConvertSpToMp"
          title="消耗 5 SP 換取 12 MP"
          @click="$emit('action', 'convertSpToMp')"
        >
          SP→MP 轉化
          <span class="action-range">（5 SP → 12 MP）</span>
        </button>

        <button class="btn" style="margin-top:8px" @click="$emit('action', 'endTurn')">
          結束行動
        </button>
      </div>

      <button class="close-btn" @click="$emit('close')">✕</button>
    </div>
  </div>

  <!-- 武器詳情彈窗 -->
  <WeaponDetailModal
    v-if="detailWeapon"
    :weapon="detailWeapon"
    :unit="unit"
    @close="detailWeapon = null"
  />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Unit, ResolvedWeapon } from '@engine/state'
import WeaponDetailModal from './WeaponDetailModal.vue'

const props = defineProps<{ unit: Unit }>()
const emit = defineEmits<{
  (e: 'action', type: 'move' | 'attack' | 'endTurn' | 'convertSpToMp', weaponSlot?: number): void
  (e: 'close'): void
}>()

const detailWeapon = ref<ResolvedWeapon | null>(null)

const weaponSlots = computed(() =>
  props.unit.weapons
    .map((w, i) => ({ slot: i, weapon: w }))
    .filter((s): s is { slot: number; weapon: ResolvedWeapon } => s.weapon !== null)
)

const canConvertSpToMp = computed(() =>
  props.unit.maxMP > 0 && props.unit.currentSP >= 5
)

function canAffordWeapon(w: ResolvedWeapon) {
  return props.unit.currentSP >= w.spCostFinal && props.unit.currentMP >= w.mpCostFinal
}

function weaponCostLabel(w: ResolvedWeapon) {
  const parts: string[] = []
  if (w.spCostFinal > 0) parts.push(`SP ${w.spCostFinal}`)
  if (w.mpCostFinal > 0) parts.push(`MP ${w.mpCostFinal}`)
  return parts.join('、') || '無消耗'
}

function onAttack(slot: number) {
  emit('action', 'attack', slot)
}

function showWeaponDetail(w: ResolvedWeapon) {
  detailWeapon.value = w
}
</script>

<style scoped>
.action-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-overlay);
}

.action-menu {
  position: relative;
  padding: 20px 24px;
  min-width: 240px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--bg-card);
}

.action-menu__title {
  font-size: 15px;
  font-weight: 700;
  color: var(--accent);
  border-bottom: 1px solid var(--border-light);
  padding-bottom: 8px;
}

.action-menu__stats {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-dim);
}

.action-menu__buttons {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.action-menu__buttons .btn {
  justify-content: flex-start;
  text-align: left;
  font-size: 13px;
}

/* 武器按鈕列（攻擊 + ℹ️） */
.weapon-btn-row {
  display: flex;
  gap: 4px;
  align-items: center;
}
.weapon-btn {
  flex: 1;
}
.info-btn {
  flex-shrink: 0;
  width: 28px; height: 28px;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  background: var(--bg);
  cursor: pointer;
  display: grid; place-items: center;
  font-size: 13px;
  line-height: 1;
}
.info-btn:hover { background: var(--accent-bg); }

.action-range {
  margin-left: 4px;
  font-size: 11px;
  color: var(--text-dim);
  font-weight: 400;
}

.btn--convert {
  border-color: var(--purple, #8b4eb5);
  color: var(--purple, #8b4eb5);
}
.btn--convert:hover:not(:disabled) {
  background: rgba(139,78,181,.1);
}

.close-btn {
  position: absolute;
  top: 8px;
  right: 10px;
  background: transparent;
  border: none;
  font-size: 14px;
  color: var(--text-dim);
  cursor: pointer;
  line-height: 1;
  padding: 2px 4px;
}
.close-btn:hover { color: var(--text); }
</style>

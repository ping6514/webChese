<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-panel panel">
      <div class="modal-header">
        <span class="modal-title">{{ unit.kind === 'player' ? '🧍' : '👾' }} {{ unit.name }}</span>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>

      <div class="modal-body">
        <!-- 基本屬性 -->
        <div class="info-section">
          <div class="section-label">基本屬性</div>
          <div class="stat-grid">
            <div class="stat-cell">
              <span class="stat-name">STR 力量</span>
              <span class="stat-val">{{ unit.stats.str }}</span>
            </div>
            <div class="stat-cell">
              <span class="stat-name">AGI 敏捷</span>
              <span class="stat-val">{{ unit.stats.agi }}</span>
            </div>
            <div class="stat-cell">
              <span class="stat-name">INT 智力</span>
              <span class="stat-val">{{ unit.stats.int }}</span>
            </div>
            <div class="stat-cell">
              <span class="stat-name">LCK 幸運</span>
              <span class="stat-val">{{ unit.stats.lck }}</span>
            </div>
          </div>
        </div>

        <!-- 行動屬性 -->
        <div class="info-section">
          <div class="section-label">行動</div>
          <div class="kv-row">
            <span class="kv-label">ATB 速度</span>
            <span class="kv-val">{{ unit.speed }} <span class="kv-hint">ATB/秒</span></span>
          </div>
          <div class="kv-row">
            <span class="kv-label">移動範圍</span>
            <span class="kv-val">{{ unit.moveRange }} 格</span>
          </div>
          <div class="kv-row" v-if="unit.spRecoveryFlat > 0">
            <span class="kv-label">每回合 SP 回復</span>
            <span class="kv-val">+{{ unit.spRecoveryFlat }}</span>
          </div>
        </div>

        <!-- 資源 -->
        <div class="info-section">
          <div class="section-label">資源</div>
          <div class="res-bar-row">
            <span class="res-label hp-c">HP</span>
            <div class="bar-wrap">
              <div class="bar-fill bar-hp" :style="{ width: pct(unit.currentHP, unit.maxHP) + '%' }" />
            </div>
            <span class="res-num">{{ unit.currentHP }} / {{ unit.maxHP }}</span>
          </div>
          <div class="res-bar-row">
            <span class="res-label sp-c">SP</span>
            <div class="bar-wrap">
              <div class="bar-fill bar-sp" :style="{ width: pct(unit.currentSP, unit.maxSP) + '%' }" />
            </div>
            <span class="res-num">{{ unit.currentSP }} / {{ unit.maxSP }}</span>
          </div>
          <div class="res-bar-row" v-if="unit.maxMP > 0">
            <span class="res-label mp-c">MP</span>
            <div class="bar-wrap">
              <div class="bar-fill bar-mp" :style="{ width: pct(unit.currentMP, unit.maxMP) + '%' }" />
            </div>
            <span class="res-num">{{ unit.currentMP }} / {{ unit.maxMP }}</span>
          </div>
        </div>

        <!-- 防禦 / 抗性 -->
        <div class="info-section" v-if="defenseRows.length > 0">
          <div class="section-label">防禦</div>
          <div class="kv-row" v-for="d in defenseRows" :key="d.el">
            <span class="kv-label">{{ d.elLabel }}</span>
            <span class="kv-val">-{{ d.flat }}</span>
          </div>
        </div>

        <div class="info-section" v-if="resistanceRows.length > 0">
          <div class="section-label">元素抗性</div>
          <div class="kv-row" v-for="r in resistanceRows" :key="r.el">
            <span class="kv-label">{{ r.elLabel }}</span>
            <div class="bar-wrap small">
              <div class="bar-fill bar-res" :style="{ width: (r.pct * 100) + '%' }" />
            </div>
            <span class="kv-val resist-val">{{ Math.round(r.pct * 100) }}%</span>
          </div>
        </div>

        <div class="info-section" v-if="defenseRows.length === 0 && resistanceRows.length === 0">
          <div class="no-def">無防禦 / 抗性</div>
        </div>

        <!-- 武器列表 -->
        <div class="info-section" v-if="weapons.length > 0">
          <div class="section-label">武器</div>
          <div v-for="(w, i) in weapons" :key="i" class="weapon-row weapon-row--clickable"
               @click="weaponDetail = w.weapon" title="點擊查看武器詳情">
            <span class="weapon-slot">#{{ w.slot + 1 }}</span>
            <span class="weapon-name">{{ w.weapon.name }}</span>
            <span class="weapon-atk">ATK {{ w.weapon.atkFinal.toFixed(1) }}</span>
            <span class="weapon-hint">ℹ️</span>
          </div>
        </div>

        <!-- 狀態效果 -->
        <div class="info-section" v-if="unit.statusEffects.length > 0">
          <div class="section-label">當前狀態</div>
          <div class="status-list">
            <span v-for="se in unit.statusEffects" :key="se.id" class="status-tag">{{ se.id }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 武器詳情彈窗（疊加在上層） -->
  <WeaponDetailModal
    v-if="weaponDetail"
    :weapon="weaponDetail"
    :unit="props.unit"
    @close="weaponDetail = null"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Unit, ResolvedWeapon } from '@engine/state'
import WeaponDetailModal from './WeaponDetailModal.vue'

const props = defineProps<{ unit: Unit }>()
defineEmits<{ (e: 'close'): void }>()

const weaponDetail = ref<ResolvedWeapon | null>(null)

const ELEMENT_LABELS: Record<string, string> = {
  slash: '斬', crush: '錘', pierce: '刺',
  fire: '🔥火', water: '💧水', wood: '🌿木',
  light: '✨光', dark: '🌑暗',
}

function pct(cur: number, max: number) {
  return max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0
}

const defenseRows = computed(() =>
  Object.entries(props.unit.defenses)
    .filter(([, v]) => v > 0)
    .map(([el, v]) => ({ el, elLabel: ELEMENT_LABELS[el] ?? el, flat: v }))
)

const resistanceRows = computed(() =>
  Object.entries(props.unit.resistances)
    .filter(([, v]) => v > 0)
    .map(([el, v]) => ({ el, elLabel: ELEMENT_LABELS[el] ?? el, pct: v }))
)

const weapons = computed(() =>
  props.unit.weapons
    .map((w, i) => ({ slot: i, weapon: w }))
    .filter((s): s is { slot: number; weapon: ResolvedWeapon } => s.weapon !== null)
)
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: var(--bg-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.modal-panel {
  width: 100%;
  max-width: 340px;
  max-height: 85vh;
  overflow-y: auto;
  background: var(--bg-card);
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}
.modal-title { font-weight: 700; font-size: 14px; color: var(--accent); }

.close-btn {
  background: transparent; border: none;
  color: var(--text-dim); cursor: pointer; font-size: 14px;
  padding: 2px 6px; border-radius: 4px;
}
.close-btn:hover { background: var(--accent-bg); color: var(--text); }

.modal-body {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-section { display: flex; flex-direction: column; gap: 5px; }
.section-label {
  font-size: 10px; font-weight: 600; color: var(--text-dim);
  text-transform: uppercase; padding-bottom: 2px;
  border-bottom: 1px solid var(--border-light);
}

/* 基本屬性 2×2 格 */
.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}
.stat-cell {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg);
  border: 1px solid var(--border-light);
  border-radius: 4px;
  padding: 4px 8px;
}
.stat-name { font-size: 11px; color: var(--text-dim); }
.stat-val  { font-size: 14px; font-weight: 700; color: var(--accent); }

/* KV 行 */
.kv-row { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.kv-label { color: var(--text-dim); min-width: 90px; }
.kv-val   { font-weight: 600; color: var(--text); }
.kv-hint  { font-size: 10px; color: var(--text-dim); font-weight: 400; }

/* 資源條 */
.res-bar-row { display: flex; align-items: center; gap: 6px; font-size: 11px; }
.res-label { min-width: 22px; font-weight: 600; }
.hp-c { color: var(--red, #c0392b); }
.sp-c { color: var(--gold, #c47a1e); }
.mp-c { color: #8b4eb5; }

.bar-wrap {
  flex: 1;
  height: 8px;
  background: var(--border-light);
  border-radius: 4px;
  overflow: hidden;
}
.bar-wrap.small { height: 6px; }
.bar-fill { height: 100%; border-radius: 4px; transition: width .2s; }
.bar-hp  { background: var(--bar-hp, #e74c3c); }
.bar-sp  { background: var(--bar-sp, #f39c12); }
.bar-mp  { background: #8b4eb5; }
.bar-res { background: #2980b9; }

.res-num { min-width: 60px; text-align: right; color: var(--text-dim); }

/* 抗性 */
.resist-val { min-width: 36px; text-align: right; color: #2980b9; }

/* 武器 */
.weapon-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  background: var(--bg);
  border: 1px solid var(--border-light);
  border-radius: 4px;
  padding: 4px 8px;
}
.weapon-slot { color: var(--text-dim); font-size: 10px; min-width: 18px; }
.weapon-name { flex: 1; font-weight: 600; color: var(--text); }
.weapon-atk  { font-size: 11px; color: var(--text-dim); }
.weapon-hint { font-size: 11px; opacity: .5; }
.weapon-row--clickable { cursor: pointer; }
.weapon-row--clickable:hover { background: var(--accent-bg); border-color: var(--accent-light); }

/* 狀態 */
.status-list { display: flex; flex-wrap: wrap; gap: 4px; }
.status-tag {
  font-size: 10px; padding: 1px 7px; border-radius: 3px;
  background: var(--accent-bg); border: 1px solid var(--accent-light);
  color: var(--accent);
}

.no-def { font-size: 12px; color: var(--text-dim); text-align: center; padding: 4px 0; }
</style>

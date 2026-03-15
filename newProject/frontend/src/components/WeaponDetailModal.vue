<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-panel panel">
      <div class="modal-header">
        <span class="modal-title">⚔️ {{ weapon.name }}</span>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>

      <div class="modal-body">
        <!-- 標籤列 -->
        <div class="tag-row">
          <span class="tag tag--element">{{ elementLabel }}</span>
          <span class="tag tag--mode">{{ attackModeLabel }}</span>
          <span v-for="t in weapon.actionTags" :key="t" class="tag">{{ t }}</span>
          <span v-if="weapon.enchant" class="tag tag--enchant">{{ weapon.enchant }}</span>
        </div>

        <!-- 攻擊方式 -->
        <div class="info-section">
          <div class="info-row">
            <span class="info-label">攻擊方式</span>
            <span>{{ actionName }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">命中模式</span>
            <span>{{ hitModeLabel }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">縮放屬性</span>
            <span>{{ weapon.statScaling }}</span>
          </div>
        </div>

        <!-- 傷害估算 -->
        <div class="info-section damage-section">
          <div class="section-label">傷害估算</div>
          <div class="damage-formula">
            ATK <b>{{ weapon.atkFinal.toFixed(2) }}</b>
            × {{ weapon.statScaling }} <b>{{ scalingStatValue }}</b>
            ≈ <span class="dmg-est">{{ estimatedDmg }}</span>
          </div>
          <div class="info-hint">（不計暴擊、抗性、防禦）</div>
        </div>

        <!-- 費用 / 時間 -->
        <div class="info-section">
          <div class="section-label">消耗 / 時間</div>
          <div class="cost-grid">
            <div class="cost-cell" v-if="weapon.spCostFinal > 0">
              <span class="cost-label">SP</span>
              <span class="cost-val">{{ weapon.spCostFinal }}</span>
            </div>
            <div class="cost-cell" v-if="weapon.mpCostFinal > 0">
              <span class="cost-label">MP</span>
              <span class="cost-val">{{ weapon.mpCostFinal }}</span>
            </div>
            <div class="cost-cell">
              <span class="cost-label">讀條</span>
              <span class="cost-val">{{ weapon.castTimeFinal }}ms</span>
            </div>
            <div class="cost-cell">
              <span class="cost-label">硬直</span>
              <span class="cost-val">{{ weapon.recoveryTimeFinal }}ms</span>
            </div>
            <div class="cost-cell" v-if="weapon.cooldownMs > 0">
              <span class="cost-label">冷卻</span>
              <span class="cost-val">{{ weapon.cooldownMs }}ms</span>
            </div>
          </div>
        </div>

        <!-- 詞條 -->
        <div class="info-section" v-if="weapon.appliedAffixIds.length > 0">
          <div class="section-label">附加詞條</div>
          <div class="affix-list">
            <span v-for="a in weapon.appliedAffixIds" :key="a" class="affix-tag">{{ a }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ResolvedWeapon, Unit } from '@engine/state'

const props = defineProps<{ weapon: ResolvedWeapon; unit: Unit | null }>()
defineEmits<{ (e: 'close'): void }>()

const ACTION_NAMES: Record<string, string> = {
  single_melee:        '單體近戰 (1格)',
  single_melee_reach:  '延伸近戰 (2格)',
  frontal_sweep:       '前方扇形 (3格)',
  frontal_wide_sweep:  '前方180° (5格)',
  line_pierce:         '直線穿透 (3格)',
  line_no_pierce:      '直線 (2格)',
  burst_small:         '爆炸 (半徑1格)',
  burst_medium:        '爆炸 (半徑2格)',
  ranged_single:       '遠程單體 (6格)',
  ranged_single_nlos:  '遠程單體 (5格)',
  ranged_aoe_small:    '遠程AOE (5格)',
  ranged_aoe_medium:   '遠程AOE (4格)',
  circle_small:        '圓形範圍 (3格)',
  circle_large:        '圓形範圍 (3格)',
}

const ELEMENT_LABELS: Record<string, string> = {
  slash: '斬', crush: '錘', pierce: '刺',
  fire: '🔥火', water: '💧水', wood: '🌿木',
  light: '✨光', dark: '🌑暗',
}

const actionName = computed(() => ACTION_NAMES[props.weapon.actionId] ?? props.weapon.actionId)

const elementLabel = computed(() => ELEMENT_LABELS[props.weapon.element] ?? props.weapon.element)

const attackModeLabel = computed(() => {
  const m = props.weapon.attackMode
  if (!m || m === 'mode_slash') return '普通'
  return m.replace('mode_', '')
})

const hitModeLabel = computed(() => {
  const hm = props.weapon.hitMode
  switch (hm.type) {
    case 'instant':          return '即時命中'
    case 'delayed':          return `延遲命中 (${hm.warningMs}ms 預警)`
    case 'check_at_resolve': return '施法結算時命中'
    case 'projectile':       return `投射物 (${hm.speedCellsPerSec} 格/秒)`
    case 'persistent_zone':  return `持續區域 (${hm.duration}ms)`
    default:                 return '—'
  }
})

const scalingStatValue = computed(() => {
  const u = props.unit
  if (!u) return '?'
  switch (props.weapon.statScaling) {
    case 'STR': return u.stats.str
    case 'AGI': return u.stats.agi
    case 'INT': return u.stats.int
  }
})

const estimatedDmg = computed(() => {
  const sv = scalingStatValue.value
  if (sv === '?') return '?'
  return Math.round(props.weapon.atkFinal * Number(sv))
})
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
  max-width: 360px;
  max-height: 80vh;
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

/* 標籤列 */
.tag-row { display: flex; flex-wrap: wrap; gap: 4px; }
.tag {
  font-size: 10px; padding: 1px 7px; border-radius: 3px;
  background: var(--accent-bg); border: 1px solid var(--border-light);
  color: var(--text-dim);
}
.tag--element { background: rgba(255,140,0,.12); border-color: #f08030; color: #d07020; }
.tag--mode    { background: rgba(80,130,200,.12); border-color: #5082c8; color: #4070b8; }
.tag--enchant { background: rgba(139,78,181,.12); border-color: #8b4eb5; color: #8b4eb5; }

/* 資訊區塊 */
.info-section { display: flex; flex-direction: column; gap: 4px; }
.section-label { font-size: 10px; font-weight: 600; color: var(--text-dim); text-transform: uppercase; }

.info-row { display: flex; justify-content: space-between; font-size: 12px; }
.info-label { color: var(--text-dim); }
.info-hint { font-size: 10px; color: var(--text-dim); }

/* 傷害估算 */
.damage-section { background: var(--accent-bg); border-radius: 4px; padding: 8px; }
.damage-formula { font-size: 12px; color: var(--text); }
.damage-formula b { color: var(--accent); }
.dmg-est { font-size: 16px; font-weight: 700; color: var(--accent); margin-left: 4px; }

/* 消耗格 */
.cost-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.cost-cell {
  display: flex; flex-direction: column; align-items: center;
  background: var(--bg); border: 1px solid var(--border-light);
  border-radius: 4px; padding: 4px 10px; min-width: 52px;
}
.cost-label { font-size: 9px; color: var(--text-dim); }
.cost-val   { font-size: 13px; font-weight: 600; color: var(--text); }

/* 詞條 */
.affix-list { display: flex; flex-wrap: wrap; gap: 4px; }
.affix-tag {
  font-size: 10px; padding: 1px 7px; border-radius: 3px;
  background: rgba(139,78,181,.1); border: 1px solid #8b4eb5;
  color: #8b4eb5;
}
</style>

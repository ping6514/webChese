<template>
  <div class="unit-detail">
    <div class="section-title">{{ unit.name }}</div>

    <!-- 圖片（玩家：職業圖，怪物：怪物圖）-->
    <img
      v-if="imgSrc"
      :src="imgSrc"
      :alt="unit.name"
      class="unit-detail__img"
    />

    <!-- 屬性 -->
    <div class="stat-grid">
      <span>STR <b>{{ unit.stats.str }}</b></span>
      <span>AGI <b>{{ unit.stats.agi }}</b></span>
      <span>INT <b>{{ unit.stats.int }}</b></span>
      <span>LCK <b>{{ unit.stats.lck }}</b></span>
    </div>

    <!-- 資源 -->
    <div class="res-row">
      <span class="res-label">HP</span>
      <span>{{ unit.currentHP }}/{{ unit.maxHP }}</span>
    </div>
    <div class="res-row">
      <span class="res-label">SP</span>
      <span>{{ unit.currentSP }}/{{ unit.maxSP }}</span>
    </div>
    <div class="res-row">
      <span class="res-label">MP</span>
      <span>{{ unit.currentMP }}/{{ unit.maxMP }}</span>
    </div>

    <!-- 武器 -->
    <template v-if="weapon">
      <div class="section-title" style="margin-top:8px">武器</div>
      <div class="weapon-name">{{ weapon.name }}</div>
      <div class="weapon-tags">{{ weapon.actionTags.join('・') }}</div>
      <div class="weapon-stats">
        ATK {{ weapon.atkFinal.toFixed(1) }} ·
        {{ weapon.castTimeFinal }}ms 讀條
      </div>
    </template>

    <!-- 狀態效果 -->
    <template v-if="unit.statusEffects.length > 0">
      <div class="section-title" style="margin-top:8px">狀態</div>
      <div class="status-list">
        <span
          v-for="se in unit.statusEffects"
          :key="se.id"
          class="status-tag"
        >{{ se.id }}</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Unit, ResolvedWeapon } from '@engine/state'
import { monsterImage, jobImage } from '@/composables/useAssets'

const props = defineProps<{ unit: Unit }>()

const weapon = computed((): ResolvedWeapon | null =>
  props.unit.weapons?.[0] ?? null
)

const imgSrc = computed((): string | null => {
  if (props.unit.kind === 'monster' && props.unit.monsterId) {
    return monsterImage(props.unit.monsterId)
  }
  if (props.unit.kind === 'player' && props.unit.jobId) {
    return jobImage(props.unit.jobId)
  }
  return null
})
</script>

<style scoped>
.unit-detail {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}

.unit-detail__img {
  width: 100%;
  aspect-ratio: 4/3;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid var(--border-light);
}

.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px 8px;
  color: var(--text);
}
.stat-grid b { color: var(--accent); }

.res-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.res-label { color: var(--text-dim); min-width: 24px; }

.weapon-name { font-weight: 600; color: var(--text); }
.weapon-tags { font-size: 11px; color: var(--text-dim); }
.weapon-stats { font-size: 11px; color: var(--text-dim); }

.status-list { display: flex; flex-wrap: wrap; gap: 4px; }
.status-tag {
  background: var(--accent-bg);
  border: 1px solid var(--accent-light);
  color: var(--accent);
  border-radius: 3px;
  padding: 1px 6px;
  font-size: 10px;
}
</style>

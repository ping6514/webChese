<template>
  <div class="cell-info" :class="{ 'cell-info--expanded': expanded }">
    <button class="cell-info__toggle" @click="expanded = !expanded">
      地形
      <span v-if="hovered">：{{ terrainName(hovered.terrain) }}</span>
      <span class="toggle-icon">{{ expanded ? '▲' : '▼' }}</span>
    </button>

    <div v-if="expanded && hovered" class="cell-info__body">
      <div class="info-row">
        <span class="info-key">格子類型</span>
        <span class="info-val">{{ cellTypeName(hovered.type) }}</span>
      </div>
      <div class="info-row">
        <span class="info-key">地形</span>
        <span class="info-val">{{ terrainName(hovered.terrain) }}</span>
      </div>
      <div class="info-row" v-if="hovered.terrain !== 'normal'">
        <span class="info-key">效果</span>
        <span class="info-val terrain-effect">{{ terrainEffect(hovered.terrain) }}</span>
      </div>
      <div class="info-row">
        <span class="info-key">高度</span>
        <span class="info-val">{{ ['低地','平地','高台'][hovered.height] }}</span>
      </div>
      <div class="info-row" v-if="!hovered.passable">
        <span class="info-key tag-wall">不可通行</span>
      </div>
    </div>

    <div v-if="expanded && !hovered" class="cell-info__body hint">
      將滑鼠移到格子上查看地形資訊
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useGameStore } from '@/stores/game'
import type { Cell } from '@engine/state'

const game = useGameStore()
const expanded = ref(false)

const hovered = computed((): Cell | null => {
  const pos = game.hoveredPos
  if (!pos || !game.gameState) return null
  const { floor } = game.gameState
  if (pos.y < 0 || pos.y >= floor.height || pos.x < 0 || pos.x >= floor.width) return null
  return floor.cells[pos.y][pos.x]
})

function terrainName(t: string) {
  const map: Record<string, string> = {
    normal: '普通', forest: '森林', water: '水地', rubble: '瓦礫', altar: '古祭壇',
  }
  return map[t] ?? t
}

function terrainEffect(t: string) {
  const map: Record<string, string> = {
    forest: '木元素抗性 +20%，移動讀條 ×1.1',
    water:  '火焰抗性 +20%，水元素抗性 −15%',
    rubble: '移動讀條 ×1.3',
    altar:  '暗/光傷害 +15%',
  }
  return map[t] ?? ''
}

function cellTypeName(type: string) {
  const map: Record<string, string> = {
    floor: '地板', wall: '牆壁', stairs_up: '上行樓梯', stairs_down: '下行樓梯',
    recovery: '恢復格', chest: '寶箱', trap: '陷阱', mechanism: '機關',
    barrier: '屏障', portal: '傳送門',
  }
  return map[type] ?? type
}
</script>

<style scoped>
.cell-info {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 20;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 6px;
  min-width: 140px;
  max-width: 220px;
  box-shadow: 0 2px 8px rgba(0,0,0,.12);
  font-size: 12px;
}

.cell-info__toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 6px 10px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  text-align: left;
}
.cell-info__toggle:hover { background: var(--accent-bg); border-radius: 6px; }
.toggle-icon { margin-left: auto; font-size: 10px; color: var(--text-dim); }

.cell-info__body {
  padding: 6px 10px 8px;
  border-top: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cell-info__body.hint { color: var(--text-dim); font-size: 11px; text-align: center; }

.info-row {
  display: flex;
  gap: 8px;
  align-items: baseline;
}
.info-key {
  color: var(--text-dim);
  min-width: 52px;
  flex-shrink: 0;
}
.info-val { color: var(--text); }
.terrain-effect { font-size: 11px; color: var(--text-dim); line-height: 1.4; }
.tag-wall {
  background: var(--cell-wall);
  color: var(--text-inv);
  border-radius: 3px;
  padding: 1px 6px;
  font-size: 10px;
}
</style>

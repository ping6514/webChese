<script lang="ts">
import { defineComponent } from 'vue'
import type { PieceBase } from '../engine'

type UnitRow = {
  id: string
  side: 'red' | 'black'
  base: PieceBase
  hpCurrent: number
  name: string
  image?: string
  pos: { x: number; y: number }
  dead?: boolean
}

const BASE_LABEL: Record<string, string> = {
  king: '帥', advisor: '仕', elephant: '象', rook: '車', knight: '馬', cannon: '砲', soldier: '卒',
}

export default defineComponent({
  name: 'UnitListPanel',
  props: {
    title: { type: String, required: true },
    units: { type: Array as () => UnitRow[], required: true },
  },
  emits: ['show-unit-detail', 'select-cell'],
  methods: {
    baseLabel(b: string) { return BASE_LABEL[b] ?? b },
    hpColor(hp: number) {
      if (hp <= 3) return '#ff4d4f'
      if (hp <= 6) return '#fa8c16'
      return '#ff9c9e'
    },
  },
})
</script>

<template>
  <div class="panel">
    <div class="panelTitle">{{ title }}</div>

    <div v-if="units.length === 0" class="empty">（無單位）</div>

    <div class="unitList">
      <div
        v-for="u in units"
        :key="u.id"
        class="unitRow"
        :class="{ dead: u.dead, sideRed: u.side === 'red', sideBlack: u.side === 'black' }"
      >
        <!-- Image -->
        <div class="imgCell">
          <img v-if="u.image && !u.dead" class="unitImg" :src="u.image" alt="" />
          <div v-else-if="u.dead" class="unitImgDead">💀</div>
          <div v-else class="unitImgEmpty">{{ baseLabel(u.base) }}</div>
        </div>

        <!-- Info -->
        <div class="infoCell" @click="$emit('show-unit-detail', u.id)">
          <div class="unitName" :class="{ strikethrough: u.dead }">{{ u.name }}</div>
          <div class="unitBase">{{ u.side === 'red' ? '🔴' : '🟢' }} {{ baseLabel(u.base) }}</div>
          <div v-if="!u.dead" class="hpRow">
            <span class="hpIcon">❤️</span>
            <span class="hpNum" :style="{ color: hpColor(u.hpCurrent) }">{{ u.hpCurrent }}</span>
          </div>
          <div v-else class="deadLabel">已陣亡</div>
        </div>

        <!-- Select cell button -->
        <button
          type="button"
          class="locateBtn"
          :class="{ locateBtnDead: u.dead }"
          :title="u.dead ? '選擇屍骸格（可執行復活）' : '在棋盤上定位'"
          @click.stop="$emit('select-cell', u.id)"
        >{{ u.dead ? '🪦' : '📍' }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel {
  display: grid;
  gap: 10px;
}

.panelTitle {
  font-size: 0.9375rem;
  font-weight: 900;
  opacity: 0.9;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.empty {
  font-size: 0.8125rem;
  opacity: 0.45;
  padding: 8px 0;
}

.unitList {
  display: grid;
  gap: 6px;
  max-height: 70vh;
  overflow-y: auto;
}

/* ── Unit row ────────────────────────────────────────────────────────── */
.unitRow {
  display: grid;
  grid-template-columns: 52px 1fr 36px;
  gap: 10px;
  align-items: center;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  transition: background 0.15s, border-color 0.15s;
}

.unitRow:not(.dead):hover {
  background: rgba(255, 255, 255, 0.1);
}

.unitRow.sideBlack { border-left: 3px solid rgba(82, 196, 26, 0.6); }
.unitRow.sideRed   { border-left: 3px solid rgba(255, 77, 79, 0.6); }

.unitRow.dead {
  border-left-color: rgba(255, 255, 255, 0.2) !important;
  background: rgba(0, 0, 0, 0.15);
}

.unitRow.dead .imgCell,
.unitRow.dead .infoCell {
  opacity: 0.45;
}

.unitRow.dead .locateBtn {
  opacity: 1;
}

/* ── Image cell ──────────────────────────────────────────────────────── */
.imgCell {
  width: 52px;
  height: 68px;
  flex-shrink: 0;
}

.unitImg {
  width: 52px;
  height: 68px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.18);
}

.unitImgDead {
  width: 52px;
  height: 68px;
  display: grid;
  place-items: center;
  font-size: 1.75rem;
  border-radius: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.12);
}

.unitImgEmpty {
  width: 52px;
  height: 68px;
  display: grid;
  place-items: center;
  font-size: 1.5rem;
  font-weight: 900;
  border-radius: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.04);
  opacity: 0.7;
}

/* ── Info cell ───────────────────────────────────────────────────────── */
.infoCell {
  display: grid;
  gap: 4px;
  cursor: pointer;
  min-width: 0;
}

.unitName {
  font-size: 1rem;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.strikethrough { text-decoration: line-through; }

.unitBase {
  font-size: 0.75rem;
  opacity: 0.65;
}

.hpRow {
  display: flex;
  align-items: center;
  gap: 4px;
}

.hpIcon { font-size: 0.8125rem; }

.hpNum {
  font-size: 1.125rem;
  font-weight: 900;
  line-height: 1;
}

.deadLabel {
  font-size: 0.75rem;
  color: rgba(255, 77, 79, 0.75);
  font-weight: 700;
}

/* ── Locate button ───────────────────────────────────────────────────── */
.locateBtn {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.07);
  font-size: 1rem;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background 0.15s;
  padding: 0;
  align-self: center;
}
.locateBtn:hover {
  background: rgba(145, 202, 255, 0.2);
  border-color: rgba(145, 202, 255, 0.5);
}

.locateBtnDead:hover {
  background: rgba(255, 165, 0, 0.2);
  border-color: rgba(255, 165, 0, 0.5);
}
</style>

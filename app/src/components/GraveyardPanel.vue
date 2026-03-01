<script lang="ts">
import { defineComponent, ref } from 'vue'

export default defineComponent({
  name: 'GraveyardPanel',
  props: {
    red: { type: Array as () => string[], required: true },
    black: { type: Array as () => string[], required: true },
    previewCount: { type: Number, required: false, default: 6 },
  },
  emits: {
    'show-soul-detail': (_soulId: string) => true,
  },
  setup() {
    const expanded = ref(false)
    return { expanded }
  },
})
</script>

<template>
  <div class="graveyardPanel">
    <div class="panelHead" @click="expanded = !expanded">
      <span class="panelTitle">⚰️ 靈魂卡墓場</span>
      <div class="panelMeta">
        <span class="countBadge red">🔴 {{ red.length }}</span>
        <span class="countBadge green">🟢 {{ black.length }}</span>
        <span class="expandIcon">{{ expanded ? '▲' : '▼' }}</span>
      </div>
    </div>

    <div v-if="expanded" class="columns">
      <!-- Red graveyard -->
      <div class="column">
        <div class="colHead red">🔴 紅方 <span class="colCount">{{ red.length }}</span></div>
        <div class="chipList">
          <div v-if="red.length === 0" class="emptyMsg">空</div>
          <button
            v-for="(id, idx) in red.slice(0, previewCount)"
            :key="`r:${id}:${idx}`"
            type="button"
            class="chip chipRed"
            @click="$emit('show-soul-detail', id)"
          >{{ id }}</button>
          <div v-if="red.length > previewCount" class="moreChip">+{{ red.length - previewCount }}</div>
        </div>
      </div>

      <!-- Black graveyard -->
      <div class="column">
        <div class="colHead green">🟢 黑方 <span class="colCount">{{ black.length }}</span></div>
        <div class="chipList">
          <div v-if="black.length === 0" class="emptyMsg">空</div>
          <button
            v-for="(id, idx) in black.slice(0, previewCount)"
            :key="`b:${id}:${idx}`"
            type="button"
            class="chip chipBlack"
            @click="$emit('show-soul-detail', id)"
          >{{ id }}</button>
          <div v-if="black.length > previewCount" class="moreChip">+{{ black.length - previewCount }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.graveyardPanel {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.18);
  overflow: hidden;
}

/* ── Header ──────────────────────────────────────────────────────────── */
.panelHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}
.panelHead:hover { background: rgba(255, 255, 255, 0.05); }

.panelTitle {
  font-size: 0.75rem;
  font-weight: 700;
  opacity: 0.65;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.panelMeta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.countBadge {
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 999px;
}
.countBadge.red {
  background: rgba(255, 77, 79, 0.15);
  color: #ff9c9e;
  border: 1px solid rgba(255, 77, 79, 0.3);
}
.countBadge.green {
  background: rgba(82, 196, 26, 0.12);
  color: #95de64;
  border: 1px solid rgba(82, 196, 26, 0.3);
}

.expandIcon {
  font-size: 0.625rem;
  opacity: 0.45;
  margin-left: 2px;
}

/* ── Columns ─────────────────────────────────────────────────────────── */
.columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.column {
  padding: 8px;
}

.column + .column {
  border-left: 1px solid rgba(255, 255, 255, 0.08);
}

.colHead {
  font-size: 0.6875rem;
  font-weight: 700;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.colHead.red { color: #ff9c9e; }
.colHead.green { color: #95de64; }

.colCount {
  font-size: 0.625rem;
  opacity: 0.65;
  font-weight: 400;
}

/* ── Chip list ───────────────────────────────────────────────────────── */
.chipList {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 130px;
  overflow-y: auto;
}

.chip {
  padding: 3px 7px;
  border-radius: 6px;
  font-size: 0.625rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: background 0.12s;
}

.chipRed {
  background: rgba(255, 77, 79, 0.1);
  border: 1px solid rgba(255, 77, 79, 0.25);
  color: #ffb3b4;
}
.chipRed:hover { background: rgba(255, 77, 79, 0.22); }

.chipBlack {
  background: rgba(82, 196, 26, 0.08);
  border: 1px solid rgba(82, 196, 26, 0.22);
  color: #b7eb8f;
}
.chipBlack:hover { background: rgba(82, 196, 26, 0.18); }

.moreChip {
  font-size: 0.625rem;
  opacity: 0.5;
  padding: 2px 4px;
}

.emptyMsg {
  font-size: 0.6875rem;
  opacity: 0.35;
  padding: 4px 0;
}
</style>

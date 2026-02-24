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
}

export default defineComponent({
  name: 'UnitListPanel',
  props: {
    title: { type: String, required: true },
    units: { type: Array as () => UnitRow[], required: true },
  },
  emits: ['show-unit-detail'],
})
</script>

<template>
  <div>
    <h2>{{ title }}</h2>
    <div class="unitCard">
      <div v-if="units.length === 0" class="muted">(empty)</div>
      <button v-for="u in units" :key="u.id" type="button" class="row" @click="$emit('show-unit-detail', u.id)">
        <div class="rowMain">
          <div class="mono rowTop">{{ u.side }} | {{ u.base }} | hp {{ u.hpCurrent }}</div>
          <div class="rowName">{{ u.name }}</div>
        </div>
        <div class="rowImg">
          <img v-if="u.image" :src="u.image" alt="" />
          <div v-else class="noImg mono">no img</div>
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.unitCard {
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.18);
  display: grid;
  gap: 6px;
}

.row {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.92);
  padding: 8px;
  display: grid;
  grid-template-columns: 1fr 46px;
  gap: 10px;
  align-items: center;
  text-align: left;
}

.row:hover {
  border-color: rgba(145, 202, 255, 0.55);
}

.rowTop {
  opacity: 0.85;
  font-size: 12px;
}

.rowName {
  font-weight: 700;
  font-size: 13px;
}

.rowImg {
  width: 46px;
  height: 62px;
  display: grid;
  place-items: center;
}

.rowImg img {
  width: 46px;
  height: 62px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.noImg {
  width: 46px;
  height: 62px;
  border-radius: 6px;
  border: 1px dashed rgba(255, 255, 255, 0.18);
  display: grid;
  place-items: center;
  font-size: 11px;
  opacity: 0.8;
}

.muted {
  opacity: 0.75;
  font-size: 12px;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}
</style>

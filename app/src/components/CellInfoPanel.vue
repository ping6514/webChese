<script lang="ts">
import { defineComponent } from 'vue'
import type { GameState, Pos, PieceBase } from '../engine'
import type { GuardResult } from '../engine'

type UnitLite = {
  id: string
  side: 'red' | 'black'
  base: PieceBase
  hpCurrent: number
  enchant?: { soulId: string }
}

type CorpseLite = {
  ownerSide: 'red' | 'black'
  base: PieceBase
}

export default defineComponent({
  name: 'CellInfoPanel',
  props: {
    phase: { type: String as () => GameState['turn']['phase'], required: true },
    selectedCell: { type: Object as () => Pos | null, required: true },
    cellUnit: { type: Object as () => UnitLite | null, required: true },
    corpses: { type: Array as () => CorpseLite[], required: true },
    reviveGuard: { type: Object as () => GuardResult, required: true },
  },
  emits: ['revive'],
})
</script>

<template>
  <div>
    <h2>Cell</h2>
    <div class="unitCard">
      <div class="mono">pos: {{ selectedCell ? `(${selectedCell.x},${selectedCell.y})` : '-' }}</div>
      <div class="mono">unit: {{ cellUnit?.id ?? '-' }}</div>
      <div v-if="cellUnit" class="mono">
        hp {{ cellUnit.hpCurrent }} | base {{ cellUnit.base }} | side {{ cellUnit.side }} | soul
        {{ cellUnit.enchant?.soulId ?? '-' }}
      </div>

      <div style="height: 8px"></div>
      <div class="mono">corpses: {{ corpses.length }}</div>
      <div class="enchantRow">
        <button
          type="button"
          :disabled="!reviveGuard.ok"
          :title="reviveGuard.ok ? '' : reviveGuard.reason"
          @click="$emit('revive', selectedCell)"
        >
          Revive top corpse here
        </button>
      </div>
      <div v-if="corpses.length" class="corpseList">
        <div v-for="(c, idx) in corpses" :key="idx" class="mono corpseRow">{{ idx + 1 }}. {{ c.ownerSide }} {{ c.base }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.unitCard {
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.18);
}

.enchantRow {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
}

.corpseList {
  margin-top: 6px;
  max-height: 140px;
  overflow: auto;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 6px;
}

.corpseRow {
  font-size: 12px;
  opacity: 0.9;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}
</style>

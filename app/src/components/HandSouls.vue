<script lang="ts">
import { defineComponent } from 'vue'
import type { GameState } from '../engine'
import type { PieceBase } from '../engine'
import type { SoulCard } from '../engine'
import type { GuardResult } from '../engine'

type UnitLite = {
  id: string
  side: 'red' | 'black'
  base: PieceBase
}

export default defineComponent({
  name: 'HandSouls',
  props: {
    phase: { type: String as () => GameState['turn']['phase'], required: true },
    cards: { type: Array as () => SoulCard[], required: true },
    selectedSoulId: { type: String, required: true },
    selectedUnit: { type: Object as () => UnitLite | null, required: true },
    enchantGuard: { type: Object as () => GuardResult, required: true },
    returnGuards: {
      type: Object as () => Partial<Record<string, GuardResult>>,
      required: true,
    },
    // Drag uses this mime type in BoardGrid drop handler.
    dragMime: { type: String, required: false, default: 'application/x-soul-id' },
  },
  emits: ['select', 'dragstart', 'dragend', 'enchant', 'return'],
  methods: {
    getReturnTitle(soulId: string): string {
      const g = this.returnGuards[soulId]
      if (!g) return ''
      if (g.ok) return ''
      return g.reason
    },
  },
})
</script>

<template>
  <div class="handBlock">
    <div class="handTitle">Souls hand</div>
    <div class="handSoulBar">
      <div v-if="cards.length === 0" class="handEmpty muted">(empty)</div>
      <button
        v-for="c in cards"
        :key="c.id"
        type="button"
        class="soulBtn handSoulCard"
        :class="{ selected: selectedSoulId === c.id, disabled: phase === 'necro' && selectedUnit && c.base !== selectedUnit.base }"
        :draggable="phase === 'necro'"
        @dragstart="phase === 'necro' && $emit('dragstart', $event, c.id)"
        @dragend="$emit('dragend', $event, c.id)"
        @click="$emit('select', c.id)"
      >
        <div class="metaTop mono">{{ c.base }} | cost {{ c.costGold }}G</div>
        <div class="soulName">{{ c.name }}</div>
        <img v-if="c.image" class="thumb" :src="c.image" alt="" />
        <div v-else class="thumbNo mono">no img</div>

        <div v-if="phase === 'buy'" class="soulActions" @click.stop>
          <button
            type="button"
            class="miniBtn"
            :disabled="!(returnGuards[c.id]?.ok ?? false)"
            :title="getReturnTitle(c.id)"
            @click="$emit('return', c.id)"
          >
            Return
          </button>
        </div>
      </button>
    </div>

    <!-- <div class="enchantRow">
      <button
        type="button"
        :disabled="!enchantGuard.ok"
        :title="enchantGuard.ok ? '' : enchantGuard.reason"
        @click="$emit('enchant')"
      >
        Enchant selected unit
      </button>
    </div> -->
  </div>
</template>

<style scoped>
.handBlock {
  display: grid;
  gap: 8px;
}

.handTitle {
  font-size: 12px;
  opacity: 0.85;
}

.handSoulBar {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 6px;
}

.handSoulCard {
  flex: 0 0 auto;
  min-width: 180px;
}

.metaTop {
  font-size: 12px;
  opacity: 0.85;
}

.thumb {
  width: 100%;
  height: 140px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.thumbNo {
  width: 100%;
  height: 140px;
  border-radius: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.18);
  display: grid;
  place-items: center;
  opacity: 0.8;
  font-size: 11px;
}

.soulBtn {
  text-align: left;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.22);
  color: rgba(255, 255, 255, 0.92);
}

.soulBtn:hover {
  border-color: rgba(145, 202, 255, 0.55);
}

.soulBtn.selected {
  border-color: rgba(145, 202, 255, 0.95);
  background: rgba(145, 202, 255, 0.12);
}

.soulBtn.disabled {
  opacity: 0.5;
}

.soulTop {
  display: grid;
  gap: 2px;
  margin-bottom: 6px;
}

.soulName {
  font-weight: 700;
}

.soulMeta {
  opacity: 0.85;
  font-size: 12px;
}

.soulStats {
  font-size: 12px;
  opacity: 0.95;
  margin-bottom: 6px;
}

.soulText {
  font-size: 12px;
  line-height: 1.35;
  opacity: 0.85;
}

.soulActions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.miniBtn {
  padding: 6px 10px;
  font-size: 12px;
}

.enchantRow {
  display: flex;
  justify-content: flex-end;
}

.handEmpty {
  font-size: 12px;
}

.muted {
  opacity: 0.75;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}
</style>

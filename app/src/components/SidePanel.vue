<script lang="ts">
import { defineComponent } from 'vue'
import type { GuardResult, GameState, Pos, PieceBase } from '../engine'
import UnitInfoPanel from './UnitInfoPanel.vue'
import CellInfoPanel from './CellInfoPanel.vue'
import GraveyardPanel from './GraveyardPanel.vue'

type UnitLite = {
  id: string
  side: 'red' | 'black'
  base: PieceBase
  pos: { x: number; y: number }
  hpCurrent: number
  atk: { key: string; value: number }
  def: { key: string; value: number }[]
  enchant?: { soulId: string }
}

type EnchantSoulLite = {
  id: string
  name: string
  image?: string
}

type CorpseLite = {
  ownerSide: 'red' | 'black'
  base: PieceBase
}

export default defineComponent({
  name: 'SidePanel',
  components: { UnitInfoPanel, CellInfoPanel, GraveyardPanel },
  props: {
    phase: { type: String as () => GameState['turn']['phase'], required: true },

    selectedUnit: { type: Object as () => UnitLite | null, required: true },
    selectedEnchantSoul: { type: Object as () => EnchantSoulLite | null, required: true },

    selectedCell: { type: Object as () => Pos | null, required: true },
    selectedCellUnit: { type: Object as () => UnitLite | null, required: true },
    selectedCellCorpses: { type: Array as () => CorpseLite[], required: true },
    reviveGuard: { type: Object as () => GuardResult, required: true },

    graveyardRed: { type: Array as () => string[], required: true },
    graveyardBlack: { type: Array as () => string[], required: true },

    bloodRitualGuard: { type: Object as () => GuardResult, required: true },
    lastEvents: { type: Array as () => string[], required: true },
  },
  emits: ['show-soul-detail', 'revive', 'blood-ritual', 'open-shop', 'open-units', 'next-phase', 'open-events'],
})
</script>

<template>
  <div>
    <div class="quickActions">
      <button type="button" @click="$emit('open-shop')">Shop</button>
      <button type="button" @click="$emit('open-units')">Units</button>
      <button type="button" @click="$emit('next-phase')">Next</button>
    </div>

    <div class="unitCard" v-if="phase === 'necro'">
      <div class="muted">Necro actions</div>
      <div style="height: 8px"></div>
      <button
        type="button"
        @click="$emit('blood-ritual')"
        :disabled="!bloodRitualGuard.ok"
        :title="bloodRitualGuard.ok ? '' : bloodRitualGuard.reason"
      >
        Blood Ritual (King -3 HP, Necro +1)
      </button>
    </div>

    <UnitInfoPanel
      v-if="selectedUnit"
      :unit="selectedUnit"
      :enchant-soul="selectedEnchantSoul"
      @show-soul-detail="$emit('show-soul-detail', $event)"
    />

    <CellInfoPanel
      :phase="phase"
      :selected-cell="selectedCell"
      :cell-unit="selectedCellUnit"
      :corpses="selectedCellCorpses"
      :revive-guard="reviveGuard"
      @revive="$emit('revive', $event)"
    />

    <GraveyardPanel
      :red="graveyardRed"
      :black="graveyardBlack"
      :preview-count="5"
      @show-soul-detail="$emit('show-soul-detail', $event)"
    />

    <h2>Last events</h2>
    <textarea class="events" readonly :value="lastEvents.join('\n')" @click="$emit('open-events')" />
  </div>
</template>

<style scoped>
.quickActions {
  display: grid;
  gap: 8px;
  margin-bottom: 12px;
  grid-template-columns: 1fr 1fr 1fr;
}

.quickActions > button {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  font-weight: 800;
}

.events {
  width: 100%;
  min-height: 160px;
  max-height: 320px;
  resize: vertical;
  overflow: auto;
  box-sizing: border-box;
  white-space: pre;
  background: rgba(0, 0, 0, 0.18);
  color: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 8px;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}
</style>

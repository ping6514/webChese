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
  emits: ['show-soul-detail', 'revive', 'blood-ritual'],
})
</script>

<template>
  <div>
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

    <UnitInfoPanel :unit="selectedUnit" :enchant-soul="selectedEnchantSoul" @show-soul-detail="$emit('show-soul-detail', $event)" />

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
    <pre class="events">{{ lastEvents.join('\n') }}</pre>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import type { GuardResult, GameState, PieceBase, SoulCard } from '../engine'
import HandSouls from './HandSouls.vue'
import HandItems from './HandItems.vue'

type UnitLite = {
  id: string
  side: 'red' | 'black'
  base: PieceBase
}

export default defineComponent({
  name: 'HandBar',
  components: { HandSouls, HandItems },
  props: {
    phase: { type: String as () => GameState['turn']['phase'], required: true },

    soulCards: { type: Array as () => SoulCard[], required: true },
    selectedSoulId: { type: String, required: true },
    selectedUnit: { type: Object as () => UnitLite | null, required: true },
    enchantGuard: { type: Object as () => GuardResult, required: true },
    returnGuards: { type: Object as () => Partial<Record<string, GuardResult>>, required: true },

    items: { type: Array as () => string[], required: true },
    discardGuards: { type: Object as () => Partial<Record<string, GuardResult>>, required: true },
    getItemName: {
      type: Function as unknown as () => (itemId: string) => string,
      required: true,
    },
    getItem: {
      type: Function as unknown as () => (itemId: string) => any,
      required: false,
      default: undefined,
    },
  },
  emits: ['select-soul', 'dragstart-soul', 'dragend-soul', 'enchant', 'return-soul', 'discard-item', 'show-item-detail'],
})
</script>

<template>
  <div class="handBarWrap">
    <HandSouls
      :phase="phase"
      :cards="soulCards"
      :selected-soul-id="selectedSoulId"
      :selected-unit="selectedUnit"
      :enchant-guard="enchantGuard"
      :return-guards="returnGuards"
      @select="$emit('select-soul', $event)"
      @dragstart="(e, soulId) => $emit('dragstart-soul', e, soulId)"
      @dragend="(e, soulId) => $emit('dragend-soul', e, soulId)"
      @enchant="$emit('enchant')"
      @return="$emit('return-soul', $event)"
    />

    <div style="height: 8px"></div>

    <HandItems
      :phase="phase"
      :items="items"
      :discard-guards="discardGuards"
      :get-item-name="getItemName"
      :get-item="getItem"
      @discard="$emit('discard-item', $event)"
      @show-item-detail="$emit('show-item-detail', $event)"
    />
  </div>
</template>

<style scoped>
.handBarWrap {
  position: sticky;
  bottom: 8px;
  z-index: 15;
  margin-top: 8px;
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(6px);
}
</style>

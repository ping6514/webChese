<script lang="ts">
import { defineComponent } from 'vue'
import type { GuardResult } from '../engine'
import type { GameState } from '../engine'
import type { ItemCard } from '../engine'

export default defineComponent({
  name: 'HandItems',
  props: {
    phase: { type: String as () => GameState['turn']['phase'], required: true },
    items: { type: Array as () => string[], required: true },
    discardGuards: {
      type: Object as () => Partial<Record<string, GuardResult>>,
      required: true,
    },
    getItemName: {
      type: Function as unknown as () => (itemId: string) => string,
      required: true,
    },
    getItem: {
      type: Function as unknown as () => (itemId: string) => ItemCard | undefined,
      required: false,
      default: undefined,
    },
  },
  emits: ['discard', 'show-item-detail'],
})
</script>

<template>
  <div class="handBlock">
    <div class="handTitle">Items hand</div>
    <div class="handBar">
      <div v-if="items.length === 0" class="handEmpty muted">(empty)</div>
      <div v-for="(id, idx) in items" :key="`${id}:${idx}`" class="itemCard">
        <button type="button" class="cardBody" @click="$emit('show-item-detail', id)">
          <div class="metaTop mono">
            {{ (getItem && getItem(id)?.timing) ? getItem(id)?.timing : '-' }} | cost
            {{ (getItem && getItem(id)?.costGold != null) ? `${getItem(id)?.costGold}G` : '-' }}
          </div>
          <div class="cardName">{{ getItemName(id) }}</div>
          <img v-if="getItem && getItem(id)?.image" class="thumb" :src="getItem(id)?.image || ''" alt="" />
          <div v-else class="thumbNo mono">no img</div>
        </button>

        <button
          type="button"
          class="chipBtn"
          @click="$emit('discard', id)"
          :disabled="phase !== 'buy' || !(discardGuards[id]?.ok ?? false)"
          :title="phase !== 'buy' ? 'Buy phase only' : (discardGuards[id]?.ok ? '' : (discardGuards[id]?.reason ?? ''))"
        >
          Discard
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.handBlock {
  display: grid;
  gap: 6px;
}

.handTitle {
  font-size: 12px;
  opacity: 0.85;
}

.handBar {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.itemCard {
  flex: 0 0 auto;
  width: 180px;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.22);
  display: grid;
  gap: 8px;
}

.itemCard:hover {
  border-color: rgba(145, 202, 255, 0.55);
}

.cardBody {
  padding: 0;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.92);
  text-align: left;
  cursor: pointer;
  display: grid;
  gap: 6px;
}

.metaTop {
  font-size: 12px;
  opacity: 0.85;
}

.cardName {
  font-weight: 700;
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

.chipBtn {
  padding: 4px 8px;
  font-size: 12px;
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

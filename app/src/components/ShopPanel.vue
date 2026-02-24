<script lang="ts">
import { defineComponent } from 'vue'
import type { GameState, GuardResult, PieceBase } from '../engine'

export default defineComponent({
  name: 'ShopPanel',
  props: {
    phase: { type: String as () => GameState['turn']['phase'], required: true },
    shopBases: { type: Array as () => PieceBase[], required: true },
    buyDisplayGuards: {
      type: Object as () => Partial<Record<PieceBase, GuardResult>>,
      required: true,
    },
    buyDeckGuards: {
      type: Object as () => Partial<Record<PieceBase, GuardResult>>,
      required: true,
    },
    buyEnemyGraveGuard: {
      type: Object as () => GuardResult,
      required: true,
    },
    displayByBase: {
      type: Object as () => Partial<Record<PieceBase, string | null>>,
      required: true,
    },
    soulDeckByBase: {
      type: Object as () => Partial<Record<PieceBase, string[]>>,
      required: true,
    },
    enemyGraveTop: { type: String as () => string | null, required: true },
    getDisplaySoulName: {
      type: Function as unknown as () => (base: PieceBase) => string,
      required: true,
    },

    itemDisplay: {
      type: Array as () => Array<string | null>,
      required: true,
    },
    buyItemGuards: {
      type: Array as () => GuardResult[],
      required: true,
    },
    getDisplayItemName: {
      type: Function as unknown as () => (slot: number) => string,
      required: true,
    },
    getDisplayItemCost: {
      type: Function as unknown as () => (slot: number) => number | null,
      required: true,
    },
  },
  emits: [
    'buy-display',
    'buy-deck',
    'buy-enemy-graveyard',
    'buy-item',
    'show-soul-detail',
    'show-item-detail',
    'show-enemy-grave-top-detail',
  ],
})
</script>

<template>
  <div>
    <h2>Shop</h2>
    <div class="unitCard" v-if="phase === 'buy'">
      <div class="muted">Buy phase only</div>
      <div class="shopGrid">
        <div v-for="b in shopBases" :key="b" class="shopRow">
          <div class="mono shopBase">{{ b }}</div>
          <div class="shopCard">
            <button
              v-if="displayByBase[b]"
              type="button"
              class="linkBtn mono"
              @click="$emit('show-soul-detail', displayByBase[b])"
            >
              display: {{ getDisplaySoulName(b) }}
            </button>
            <div class="mono" v-else>display: -</div>
            <div class="mono">deck: {{ soulDeckByBase[b]?.length ?? 0 }}</div>
          </div>
          <div class="shopBtns">
            <button
              type="button"
              @click="$emit('buy-display', b)"
              :disabled="!(buyDisplayGuards[b]?.ok ?? false)"
              :title="buyDisplayGuards[b]?.ok ? '' : (buyDisplayGuards[b]?.reason ?? '')"
            >
              Buy display (2G)
            </button>
            <button
              type="button"
              @click="$emit('buy-deck', b)"
              :disabled="!(buyDeckGuards[b]?.ok ?? false)"
              :title="buyDeckGuards[b]?.ok ? '' : (buyDeckGuards[b]?.reason ?? '')"
            >
              Buy deck top (1G)
            </button>
          </div>
        </div>
      </div>

      <div style="height: 12px"></div>

      <div class="unitCard">
        <div class="muted">Items</div>
        <div class="itemGrid">
          <div v-for="slot in [0, 1, 2]" :key="slot" class="itemRow">
            <div class="mono">slot {{ slot }}</div>
            <div class="shopCard">
              <button
                v-if="itemDisplay[slot]"
                type="button"
                class="linkBtn mono"
                @click="$emit('show-item-detail', itemDisplay[slot])"
              >
                {{ getDisplayItemName(slot) }}
              </button>
              <div v-else class="mono">-</div>
              <div class="mono">cost: {{ getDisplayItemCost(slot) ?? '-' }}</div>
            </div>
            <div class="shopBtns">
              <button
                type="button"
                @click="$emit('buy-item', slot)"
                :disabled="!(buyItemGuards[slot]?.ok ?? false)"
                :title="buyItemGuards[slot]?.ok ? '' : (buyItemGuards[slot]?.reason ?? '')"
              >
                Buy item
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style="height: 10px"></div>
      <div class="mono">
        enemy grave top:
        <button
          v-if="enemyGraveTop"
          type="button"
          class="linkBtn mono"
          @click="$emit('show-enemy-grave-top-detail')"
        >
          {{ enemyGraveTop }}
        </button>
        <span v-else>-</span>
      </div>
      <button
        type="button"
        @click="$emit('buy-enemy-graveyard')"
        :disabled="!buyEnemyGraveGuard.ok"
        :title="buyEnemyGraveGuard.ok ? '' : buyEnemyGraveGuard.reason"
      >
        Buy enemy grave top (3G)
      </button>
    </div>
    <div class="unitCard" v-else>
      <div class="muted">Enter buy phase to purchase souls.</div>
    </div>
  </div>
</template>

<style scoped>
.shopGrid {
  display: grid;
  gap: 10px;
  margin-top: 10px;
}

.shopRow {
  display: grid;
  grid-template-columns: 70px 1fr;
  gap: 8px;
}

.shopBase {
  opacity: 0.9;
}

.shopCard {
  display: grid;
  gap: 2px;
}

.shopBtns {
  grid-column: 1 / -1;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.itemGrid {
  display: grid;
  gap: 10px;
  margin-top: 10px;
}

.itemRow {
  display: grid;
  grid-template-columns: 70px 1fr;
  gap: 8px;
}

.linkBtn {
  padding: 0;
  border: none;
  background: transparent;
  color: rgba(145, 202, 255, 0.95);
  text-align: left;
  cursor: pointer;
}

.linkBtn:hover {
  text-decoration: underline;
}
</style>

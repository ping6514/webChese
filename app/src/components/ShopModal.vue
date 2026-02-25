<script lang="ts">
import { defineComponent } from 'vue'
import type { GuardResult, PieceBase } from '../engine'
import { getItemCard, getSoulCard, type GameState } from '../engine'

export default defineComponent({
  name: 'ShopModal',
  props: {
    open: { type: Boolean, required: true },
    phase: { type: String as () => GameState['turn']['phase'], required: true },

    shopBases: { type: Array as () => PieceBase[], required: true },
    displayByBase: {
      type: Object as () => Partial<Record<PieceBase, string | null>>,
      required: true,
    },
    soulDeckByBase: {
      type: Object as () => Partial<Record<PieceBase, string[]>>,
      required: true,
    },

    buyDisplayGuards: {
      type: Object as () => Partial<Record<PieceBase, GuardResult>>,
      required: true,
    },
    buyDeckGuards: {
      type: Object as () => Partial<Record<PieceBase, GuardResult>>,
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

    itemDeckCount: { type: Number, required: false, default: 0 },

    enemyGraveTop: { type: String as () => string | null, required: true },
    buyEnemyGraveGuard: { type: Object as () => GuardResult, required: true },

    buySoulFromDeckGoldCost: { type: Number, required: true },
    buySoulFromDisplayGoldCost: { type: Number, required: true },
    buySoulFromEnemyGraveyardGoldCost: { type: Number, required: true },
  },
  emits: [
    'close',
    'buy-display',
    'buy-deck',
    'buy-item',
    'buy-enemy-graveyard',
    'show-soul-detail',
    'show-item-detail',
    'show-enemy-grave-top-detail',
  ],
  methods: {
    soulName(id: string | null | undefined): string {
      if (!id) return '-'
      return getSoulCard(id)?.name ?? id
    },
    soulImage(id: string | null | undefined): string | undefined {
      if (!id) return undefined
      const img = getSoulCard(id)?.image
      return img || undefined
    },
    itemName(id: string | null | undefined): string {
      if (!id) return '-'
      return getItemCard(id)?.name ?? id
    },
    itemImage(id: string | null | undefined): string | undefined {
      if (!id) return undefined
      const img = getItemCard(id)?.image
      return img || undefined
    },
    itemCost(id: string | null | undefined): number | null {
      if (!id) return null
      return getItemCard(id)?.costGold ?? null
    },
  },
})
</script>

<template>
  <div v-if="open" class="modalOverlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modalHead">
        <div class="modalTitle">Shop</div>
        <button type="button" class="closeBtn" @click="$emit('close')">Close</button>
      </div>

      <div v-if="phase !== 'buy'" class="muted">You can view the shop any time, but only buy phase allows purchases.</div>

      <div class="grid">
        <section class="panel">
          <div class="panelTitle mono">Souls</div>
          <div class="soulGrid">
            <div v-for="b in shopBases" :key="b" class="soulRow">
              <div class="base mono">{{ b }}</div>

              <div class="card">
                <button
                  v-if="displayByBase[b]"
                  type="button"
                  class="cardBtn"
                  @click="$emit('show-soul-detail', displayByBase[b])"
                >
                  <img v-if="soulImage(displayByBase[b])" class="thumb" :src="soulImage(displayByBase[b])" alt="" />
                  <div v-else class="thumbNo mono">no img</div>
                  <div class="cardMeta">
                    <div class="name">{{ soulName(displayByBase[b]) }}</div>
                    <div class="mono sub">display</div>
                  </div>
                </button>
                <div v-else class="cardBtn cardBtnEmpty">
                  <div class="thumbNo mono">-</div>
                  <div class="cardMeta">
                    <div class="name">(empty)</div>
                    <div class="mono sub">display</div>
                  </div>
                </div>

                <div class="mono deck">deck: {{ soulDeckByBase[b]?.length ?? 0 }}</div>
              </div>

              <div class="btns">
                <button
                  type="button"
                  @click="$emit('buy-display', b)"
                  :disabled="phase !== 'buy' || !(buyDisplayGuards[b]?.ok ?? false)"
                  :title="buyDisplayGuards[b]?.ok ? '' : (buyDisplayGuards[b]?.reason ?? '')"
                >
                  Buy display ({{ buySoulFromDisplayGoldCost }}G)
                </button>
                <button
                  type="button"
                  @click="$emit('buy-deck', b)"
                  :disabled="phase !== 'buy' || !(buyDeckGuards[b]?.ok ?? false)"
                  :title="buyDeckGuards[b]?.ok ? '' : (buyDeckGuards[b]?.reason ?? '')"
                >
                  Buy deck top ({{ buySoulFromDeckGoldCost }}G)
                </button>
              </div>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panelTitle mono">Items <span class="muted" style="font-weight: 400">(deck {{ itemDeckCount }})</span></div>
          <div class="itemGrid">
            <div v-for="slot in [0, 1, 2]" :key="slot" class="itemRow">
              <div class="base mono">slot {{ slot }}</div>

              <div class="card">
                <button
                  v-if="itemDisplay[slot]"
                  type="button"
                  class="cardBtn"
                  @click="$emit('show-item-detail', itemDisplay[slot])"
                >
                  <img v-if="itemImage(itemDisplay[slot])" class="thumb" :src="itemImage(itemDisplay[slot])" alt="" />
                  <div v-else class="thumbNo mono">no img</div>
                  <div class="cardMeta">
                    <div class="name">{{ itemName(itemDisplay[slot]) }}</div>
                    <div class="mono sub">cost {{ itemCost(itemDisplay[slot]) ?? '-' }}G</div>
                  </div>
                </button>
                <div v-else class="cardBtn cardBtnEmpty">
                  <div class="thumbNo mono">-</div>
                  <div class="cardMeta">
                    <div class="name">(empty)</div>
                    <div class="mono sub">cost -</div>
                  </div>
                </div>
              </div>

              <div class="btns">
                <button
                  type="button"
                  @click="$emit('buy-item', slot)"
                  :disabled="phase !== 'buy' || !(buyItemGuards[slot]?.ok ?? false)"
                  :title="buyItemGuards[slot]?.ok ? '' : (buyItemGuards[slot]?.reason ?? '')"
                >
                  Buy item
                </button>
              </div>
            </div>
          </div>

          <div class="panelTitle mono" style="margin-top: 12px">Enemy grave</div>
          <div class="enemyGrave">
            <button
              v-if="enemyGraveTop"
              type="button"
              class="cardBtn"
              @click="$emit('show-enemy-grave-top-detail')"
            >
              <img v-if="soulImage(enemyGraveTop)" class="thumb" :src="soulImage(enemyGraveTop)" alt="" />
              <div v-else class="thumbNo mono">no img</div>
              <div class="cardMeta">
                <div class="name">{{ soulName(enemyGraveTop) }}</div>
                <div class="mono sub">enemy grave top</div>
              </div>
            </button>
            <div v-else class="muted">(empty)</div>

            <div class="btns">
              <button
                type="button"
                @click="$emit('buy-enemy-graveyard')"
                :disabled="phase !== 'buy' || !buyEnemyGraveGuard.ok"
                :title="buyEnemyGraveGuard.ok ? '' : buyEnemyGraveGuard.reason"
              >
                Buy enemy grave top ({{ buySoulFromEnemyGraveyardGoldCost }}G)
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modalOverlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: grid;
  place-items: center;
  padding: 24px;
  z-index: 60;
}

.modal {
  width: min(1040px, 96vw);
  max-height: min(92vh, 900px);
  overflow: auto;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(0, 0, 0, 0.92);
  padding: 16px;
}

.modalHead {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.modalTitle {
  font-weight: 800;
  font-size: 18px;
}

.closeBtn {
  padding: 6px 10px;
}

.grid {
  display: grid;
  grid-template-columns: 1.35fr 1fr;
  gap: 14px;
  align-items: start;
}

.panel {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.04);
}

.panelTitle {
  font-weight: 700;
  opacity: 0.9;
  margin-bottom: 8px;
}

.soulGrid,
.itemGrid {
  display: grid;
  gap: 10px;
}

.soulRow,
.itemRow {
  display: grid;
  grid-template-columns: 70px minmax(260px, 1fr) 280px;
  gap: 10px;
  align-items: start;
}

.base {
  opacity: 0.9;
}

.card {
  display: grid;
  gap: 6px;
}

.cardBtn {
  display: grid;
  grid-template-columns: 44px 1fr;
  gap: 10px;
  align-items: center;
  padding: 8px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.22);
  text-align: left;
  color: rgba(255, 255, 255, 0.92);
}

.cardBtnEmpty {
  cursor: default;
}

.thumb {
  width: 44px;
  height: 60px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.thumbNo {
  width: 44px;
  height: 60px;
  border-radius: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.18);
  display: grid;
  place-items: center;
  opacity: 0.8;
}

.cardMeta {
  display: grid;
  gap: 2px;
}

.name {
  font-weight: 700;
}

.sub {
  font-size: 12px;
  opacity: 0.8;
}

.deck {
  opacity: 0.85;
  font-size: 12px;
}

.btns {
  display: grid;
  gap: 8px;
  align-content: start;
}

.enemyGrave {
  display: grid;
  gap: 10px;
}

.muted {
  opacity: 0.75;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}
</style>

<script lang="ts">
import { defineComponent } from 'vue'
import type { GuardResult, GameState, ItemCard } from '../engine'

const TIMING_LABEL: Record<string, string> = {
  buy: '💰 購買', necro: '⚗️ 死靈', combat: '⚔️ 戰鬥',
}

const TIMING_CLASS: Record<string, string> = {
  buy: 'timingBuy', necro: 'timingNecro', combat: 'timingCombat',
}

export default defineComponent({
  name: 'HandItems',
  props: {
    phase: { type: String as () => GameState['turn']['phase'], required: true },
    items: { type: Array as () => string[], required: true },
    discardGuards: { type: Object as () => Partial<Record<string, GuardResult>>, required: true },
    useGuards: {
      type: Object as () => Partial<Record<string, GuardResult>>,
      required: false,
      default: () => ({}),
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
  emits: ['discard', 'use-item', 'show-item-detail'],
  methods: {
    timingLabel(t?: string) { return t ? (TIMING_LABEL[t] ?? t) : '—' },
    timingClass(t?: string) { return t ? (TIMING_CLASS[t] ?? '') : '' },
    useTitle(id: string) {
      const g = this.useGuards[id]
      return g && !g.ok ? g.reason : ''
    },
    discardTitle(id: string) {
      if (this.phase !== 'buy') return '只能在購買階段棄置'
      const g = this.discardGuards[id]
      return g && !g.ok ? g.reason : ''
    },
  },
})
</script>

<template>
  <div class="handBlock">
    <div v-if="items.length === 0" class="handEmpty">手牌為空</div>
    <div v-else class="cardRow">
      <div
        v-for="(id, idx) in items"
        :key="`${id}:${idx}`"
        class="itemCard"
      >
        <!-- Card body (clickable for detail) -->
        <div class="cardBody" @click="$emit('show-item-detail', id)">
          <!-- Meta chips -->
          <div class="metaRow">
            <span class="timingChip" :class="timingClass(getItem && getItem(id)?.timing)">
              {{ timingLabel(getItem && getItem(id)?.timing) }}
            </span>
            <span class="costChip">
              {{ (getItem && getItem(id)?.costGold != null) ? `${getItem(id)?.costGold}G` : '—' }}
            </span>
          </div>

          <!-- Image -->
          <img v-if="getItem && getItem(id)?.image" class="cardImg" :src="getItem(id)!.image!" alt="" />
          <div v-else class="cardImgEmpty">🎒</div>

          <!-- Name -->
          <div class="cardName">{{ getItemName(id) }}</div>
        </div>

        <!-- Action buttons -->
        <div class="btnRow">
          <button
            type="button"
            class="actionBtn useBtn"
            @click="$emit('use-item', id)"
            :disabled="!(useGuards[id]?.ok ?? false)"
            :title="useTitle(id)"
          >使用</button>
          <button
            type="button"
            class="actionBtn discardBtn"
            @click="$emit('discard', id)"
            :disabled="phase !== 'buy' || !(discardGuards[id]?.ok ?? false)"
            :title="discardTitle(id)"
          >棄置</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.handBlock {
  min-height: 40px;
}

.handEmpty {
  font-size: 13px;
  opacity: 0.4;
  padding: 12px 0;
  text-align: center;
}

/* ── Card row ────────────────────────────────────────────────────────── */
.cardRow {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.itemCard {
  flex: 0 0 auto;
  width: 150px;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  display: grid;
  gap: 8px;
  transition: border-color 0.15s;
}
.itemCard:hover { border-color: rgba(145, 202, 255, 0.45); }

/* ── Card body ───────────────────────────────────────────────────────── */
.cardBody {
  cursor: pointer;
  display: grid;
  gap: 7px;
}

/* ── Meta row ────────────────────────────────────────────────────────── */
.metaRow {
  display: flex;
  align-items: center;
  gap: 5px;
}

.timingChip {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 6px;
}

.timingBuy {
  background: rgba(232, 208, 112, 0.15);
  border: 1px solid rgba(232, 208, 112, 0.35);
  color: #e8d070;
}
.timingNecro {
  background: rgba(145, 202, 255, 0.12);
  border: 1px solid rgba(145, 202, 255, 0.3);
  color: #91caff;
}
.timingCombat {
  background: rgba(255, 120, 100, 0.12);
  border: 1px solid rgba(255, 120, 100, 0.35);
  color: #ff9c9e;
}

.costChip {
  font-size: 11px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 6px;
  background: rgba(232, 208, 112, 0.1);
  border: 1px solid rgba(232, 208, 112, 0.2);
  color: #e8d070;
  margin-left: auto;
}

/* ── Image ───────────────────────────────────────────────────────────── */
.cardImg {
  width: 100%;
  height: 130px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.cardImgEmpty {
  width: 100%;
  height: 130px;
  border-radius: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.15);
  display: grid;
  place-items: center;
  font-size: 32px;
  background: rgba(255, 255, 255, 0.03);
}

/* ── Name ────────────────────────────────────────────────────────────── */
.cardName {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.3;
  word-break: break-all;
  color: rgba(255, 255, 255, 0.92);
}

/* ── Buttons ─────────────────────────────────────────────────────────── */
.btnRow {
  display: flex;
  gap: 5px;
}

.actionBtn {
  flex: 1;
  padding: 5px 4px;
  font-size: 12px;
  font-weight: 700;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.12s;
}

.useBtn {
  background: rgba(200, 160, 40, 0.18);
  border: 1px solid rgba(200, 160, 40, 0.45);
  color: #e8d8a0;
}
.useBtn:not(:disabled):hover { background: rgba(200, 160, 40, 0.32); }
.useBtn:disabled { opacity: 0.3; cursor: not-allowed; }

.discardBtn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.55);
}
.discardBtn:not(:disabled):hover {
  background: rgba(255, 77, 79, 0.15);
  border-color: rgba(255, 77, 79, 0.35);
  color: #ff9c9e;
}
.discardBtn:disabled { opacity: 0.3; cursor: not-allowed; }
</style>

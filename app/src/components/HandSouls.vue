<script lang="ts">
import { defineComponent } from 'vue'
import type { GameState, PieceBase, SoulCard, GuardResult } from '../engine'

type UnitLite = {
  id: string
  side: 'red' | 'black'
  base: PieceBase
}

const BASE_LABEL: Record<string, string> = {
  king: '帥', advisor: '仕', elephant: '象', rook: '車', knight: '馬', cannon: '砲', soldier: '卒',
}

export default defineComponent({
  name: 'HandSouls',
  props: {
    phase: { type: String as () => GameState['turn']['phase'], required: true },
    cards: { type: Array as () => SoulCard[], required: true },
    selectedSoulId: { type: String, required: true },
    selectedUnit: { type: Object as () => UnitLite | null, default: null },
    enchantGuard: { type: Object as () => GuardResult, required: true },
    returnGuards: { type: Object as () => Partial<Record<string, GuardResult>>, required: true },
    dragMime: { type: String, required: false, default: 'application/x-soul-id' },
  },
  emits: ['select', 'dragstart', 'dragend', 'enchant', 'return', 'show-detail'],
  methods: {
    baseLabel(b: string) { return BASE_LABEL[b] ?? b },
    returnTitle(soulId: string) {
      const g = this.returnGuards[soulId]
      return g && !g.ok ? g.reason : ''
    },
    isDisabled(c: SoulCard) {
      return this.phase === 'necro' && this.selectedUnit && c.base !== this.selectedUnit.base
    },
  },
})
</script>

<template>
  <div class="handBlock">
    <div v-if="cards.length === 0" class="handEmpty">手牌為空</div>
    <div v-else class="cardRow">
      <div
        v-for="c in cards"
        :key="c.id"
        class="soulCard"
        :class="{ selected: selectedSoulId === c.id, dimmed: isDisabled(c) }"
        :draggable="phase === 'necro'"
        @dragstart="phase === 'necro' && $emit('dragstart', $event, c.id)"
        @dragend="$emit('dragend', $event, c.id)"
        @click="$emit('show-detail', c.id)"
      >
        <!-- Top meta chips -->
        <div class="metaRow">
          <span class="baseChip">{{ baseLabel(c.base) }}</span>
          <span class="costChip">{{ c.costGold }}G</span>
        </div>

        <!-- Image -->
        <img v-if="c.image" class="cardImg" :src="c.image" alt="" />
        <div v-else class="cardImgEmpty">🃏</div>

        <!-- Name -->
        <div class="cardName">{{ c.name }}</div>

        <!-- Actions row -->
        <div v-if="phase === 'necro' || phase === 'buy'" class="actions" @click.stop>
          <!-- Necro phase: enchant button -->
          <button
            v-if="phase === 'necro'"
            type="button"
            class="enchantBtn"
            :class="{ active: selectedSoulId === c.id }"
            @click="$emit('select', c.id)"
          >{{ selectedSoulId === c.id ? '✓ 已選取' : '⚗ 附魔' }}</button>
          <!-- Buy phase: return button -->
          <button
            v-if="phase === 'buy'"
            type="button"
            class="returnBtn"
            :disabled="!(returnGuards[c.id]?.ok ?? false)"
            :title="returnTitle(c.id)"
            @click="$emit('return', c.id)"
          >↩ 歸還</button>
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
  font-size: 0.8125rem;
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

.soulCard {
  flex: 0 0 auto;
  width: 150px;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--bg-surface-1);
  cursor: pointer;
  display: grid;
  gap: 7px;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}

.soulCard:hover {
  border-color: rgba(145, 202, 255, 0.5);
  background: rgba(145, 202, 255, 0.08);
}

.soulCard.selected {
  border-color: rgba(145, 202, 255, 0.95);
  background: rgba(145, 202, 255, 0.14);
  box-shadow: 0 0 12px rgba(145, 202, 255, 0.25);
}

.soulCard.dimmed {
  opacity: 0.38;
  pointer-events: none;
}

/* ── Meta row ────────────────────────────────────────────────────────── */
.metaRow {
  display: flex;
  gap: 5px;
  align-items: center;
}

.baseChip {
  font-size: 0.6875rem;
  font-weight: 800;
  padding: 1px 7px;
  border-radius: 6px;
  background: var(--bg-surface-2);
  border: 1px solid var(--border-strong);
  color: var(--text);
}

.costChip {
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 6px;
  background: rgba(232, 208, 112, 0.15);
  border: 1px solid rgba(232, 208, 112, 0.3);
  color: #e8d070;
  margin-left: auto;
}

/* ── Image ───────────────────────────────────────────────────────────── */
.cardImg {
  width: 100%;
  height: 130px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.cardImgEmpty {
  width: 100%;
  height: 130px;
  border-radius: 8px;
  border: 1px dashed var(--border-strong);
  display: grid;
  place-items: center;
  font-size: 2rem;
  background: var(--bg-surface-3);
}

/* ── Name ────────────────────────────────────────────────────────────── */
.cardName {
  font-size: 0.8125rem;
  font-weight: 700;
  line-height: 1.3;
  word-break: break-all;
  color: var(--text);
}

/* ── Actions ─────────────────────────────────────────────────────────── */
.actions {
  display: flex;
  justify-content: flex-end;
}

.enchantBtn {
  flex: 1;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 7px;
  border: 1px solid rgba(180, 130, 255, 0.35);
  background: rgba(180, 130, 255, 0.09);
  color: rgba(180, 130, 255, 0.8);
  cursor: pointer;
  transition: background 0.12s, box-shadow 0.12s;
}
.enchantBtn:hover {
  background: rgba(180, 130, 255, 0.2);
  color: rgba(200, 160, 255, 1);
}
.enchantBtn.active {
  background: rgba(180, 130, 255, 0.22);
  border-color: rgba(180, 130, 255, 0.75);
  color: #c9a3ff;
  box-shadow: 0 0 8px rgba(180, 130, 255, 0.3);
}


.returnBtn {
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 7px;
  border: 1px solid var(--border-strong);
  background: var(--bg-surface-2);
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.12s;
}
.returnBtn:not(:disabled):hover {
  background: var(--bg-surface-1);
  color: var(--text);
}
.returnBtn:disabled { opacity: 0.3; cursor: not-allowed; }
</style>

<script lang="ts">
import { computed, defineComponent, type PropType } from 'vue'
import type { GameState, Pos, PieceBase } from '../engine'
import type { GuardResult } from '../engine'
import { getReviveGoldCost } from '../engine'

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

const BASE_LABEL: Record<string, string> = {
  king: '帥', advisor: '仕', elephant: '象', rook: '車', knight: '馬', cannon: '砲', soldier: '卒',
}

export default defineComponent({
  name: 'CellInfoPanel',
  props: {
    phase: { type: String as () => GameState['turn']['phase'], required: true },
    selectedCell: { type: Object as () => Pos | null, default: null },
    cellUnit: { type: Object as PropType<UnitLite | null>, default: null },
    corpses: { type: Array as () => CorpseLite[], required: true },
    reviveGuard: { type: Object as () => GuardResult, required: true },
  },
  emits: ['revive'],
  setup(props) {
    const reviveCost = computed(() => {
      const top = props.corpses[props.corpses.length - 1]
      return top ? getReviveGoldCost(top.base) : 0
    })
    return { reviveCost }
  },
  methods: {
    baseLabel(b: string) { return BASE_LABEL[b] ?? b },
  },
})
</script>

<template>
  <div class="cellPanel">
    <div class="sectionTitle">🗺️ 選中格子</div>

    <div class="cellCard">
      <!-- Position -->
      <div class="posRow">
        <span class="posLabel">座標</span>
        <span class="posVal mono">{{ selectedCell ? `(${selectedCell.x}, ${selectedCell.y})` : '—' }}</span>
      </div>

      <!-- Unit on cell -->
      <div v-if="cellUnit" class="cellUnitBlock">
        <div class="cellUnitRow">
          <span class="sideTag" :class="cellUnit.side">{{ cellUnit.side === 'red' ? '🔴' : '🟢' }}</span>
          <span class="cellUnitName">{{ baseLabel(cellUnit.base) }}</span>
          <span class="hpBadge">❤️ {{ cellUnit.hpCurrent }}</span>
        </div>
        <div v-if="cellUnit.enchant" class="cellSoulId mono">{{ cellUnit.enchant.soulId }}</div>
      </div>
      <div v-else-if="selectedCell" class="cellEmpty">空格</div>

      <!-- Corpses -->
      <div class="corpseSection">
        <div class="corpseSectionHead">
          <span class="corpseSectionLabel">屍骸</span>
          <span class="corpseCount">{{ corpses.length }}</span>
        </div>
        <div v-if="corpses.length" class="corpseList">
          <div v-for="(c, idx) in corpses" :key="idx" class="corpseRow">
            <span class="corpseNum">{{ idx + 1 }}</span>
            <span class="corpseSide" :class="c.ownerSide">{{ c.ownerSide === 'red' ? '🔴' : '🟢' }}</span>
            <span class="corpseBase">{{ baseLabel(c.base) }}</span>
          </div>
        </div>
      </div>

      <!-- Revive button -->
      <button
        v-if="phase === 'necro'"
        type="button"
        class="reviveBtn"
        :disabled="!reviveGuard.ok"
        :title="reviveGuard.ok ? '' : reviveGuard.reason"
        @click="$emit('revive', selectedCell)"
      >
        ✨ 復活 ({{ reviveCost }}💰)
      </button>
    </div>
  </div>
</template>

<style scoped>
.cellPanel { display: grid; gap: 8px; }

.sectionTitle {
  font-size: 12px;
  font-weight: 800;
  opacity: 0.65;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.cellCard {
  padding: 12px;
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  background: var(--bg-surface-1);
  display: grid;
  gap: 10px;
}

.posRow {
  display: flex;
  align-items: center;
  gap: 8px;
}
.posLabel { font-size: 12px; opacity: 0.55; }
.posVal { font-size: 15px; font-weight: 800; }

.cellUnitBlock {
  display: grid;
  gap: 4px;
  padding: 8px;
  border-radius: 8px;
  background: var(--bg-surface-2);
  border: 1px solid var(--border);
}

.cellUnitRow {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sideTag { font-size: 16px; }

.cellUnitName {
  font-size: 16px;
  font-weight: 900;
  flex: 1;
}

.hpBadge {
  font-size: 13px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255, 77, 79, 0.15);
  border: 1px solid rgba(255, 77, 79, 0.3);
  color: #ff9c9e;
}

.cellSoulId {
  font-size: 10px;
  opacity: 0.55;
  word-break: break-all;
}

.cellEmpty {
  font-size: 13px;
  opacity: 0.4;
}

.corpseSection {
  display: grid;
  gap: 6px;
}

.corpseSectionHead {
  display: flex;
  align-items: center;
  gap: 8px;
}

.corpseSectionLabel {
  font-size: 12px;
  opacity: 0.55;
  font-weight: 600;
}

.corpseCount {
  font-size: 13px;
  font-weight: 900;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--bg-surface-2);
  border: 1px solid var(--border-strong);
}

.corpseList {
  display: grid;
  gap: 3px;
  max-height: 120px;
  overflow: auto;
  padding: 6px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-surface-2);
}

.corpseRow {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.corpseNum {
  font-size: 11px;
  opacity: 0.45;
  min-width: 14px;
}

.corpseSide { font-size: 13px; }
.corpseBase { font-weight: 700; }

.reviveBtn {
  width: 100%;
  padding: 9px 14px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  border: 1px solid rgba(145, 202, 255, 0.5);
  background: rgba(145, 202, 255, 0.14);
  color: rgba(145, 202, 255, 0.95);
  transition: background 0.15s;
}
.reviveBtn:not(:disabled):hover { background: rgba(145, 202, 255, 0.25); }
.reviveBtn:disabled { opacity: 0.3; cursor: not-allowed; }

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}
</style>

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
    selectedUnitBaseImage: { type: String as () => string | undefined, required: false, default: undefined },

    selectedCell: { type: Object as () => Pos | null, required: true },
    selectedCellUnit: { type: Object as () => UnitLite | null, required: true },
    selectedCellCorpses: { type: Array as () => CorpseLite[], required: true },
    reviveGuard: { type: Object as () => GuardResult, required: true },

    graveyardRed: { type: Array as () => string[], required: true },
    graveyardBlack: { type: Array as () => string[], required: true },

    bloodRitualGuard: { type: Object as () => GuardResult, required: true },
    lastEvents: { type: Array as () => string[], required: true },
  },
  emits: ['show-soul-detail', 'revive', 'blood-ritual', 'open-shop', 'open-units', 'open-effects', 'next-phase', 'open-events'],
})
</script>

<template>
  <div class="sidePanel">
    <!-- Quick actions -->
    <div class="quickActions">
      <button type="button" class="actionBtn" @click="$emit('open-shop')">🛒 商店</button>
      <button type="button" class="actionBtn" @click="$emit('open-units')">📋 單位</button>
      <button type="button" class="actionBtn actionBtnFx" @click="$emit('open-effects')">⚡ 效果</button>
    </div>

    <!-- Blood ritual (necro only) -->
    <div v-if="phase === 'necro'" class="ritualBlock">
      <button
        type="button"
        class="ritualBtn"
        @click="$emit('blood-ritual')"
        :disabled="!bloodRitualGuard.ok"
        :title="bloodRitualGuard.ok ? '' : bloodRitualGuard.reason"
      >
        🩸 血液祭儀（帥 -3 HP，死靈術 +1）
      </button>
    </div>

    <UnitInfoPanel
      :unit="selectedUnit"
      :enchant-soul="selectedEnchantSoul"
      :base-image="selectedUnitBaseImage"
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

    <!-- Event log -->
    <div class="eventsBlock">
      <div class="eventsHead">
        <span class="eventsTitle">📜 最近事件</span>
        <button type="button" class="eventsOpenBtn" @click="$emit('open-events')">展開</button>
      </div>
      <textarea class="eventsArea" readonly :value="lastEvents.slice(-20).join('\n')" />
    </div>
  </div>
</template>

<style scoped>
.sidePanel {
  display: grid;
  gap: 12px;
}

/* ── Quick actions ───────────────────────────────────────────────────── */
.quickActions {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}

.actionBtnFx {
  border-color: rgba(250, 173, 20, 0.3) !important;
  color: #ffd666 !important;
}
.actionBtnFx:hover {
  background: rgba(250, 173, 20, 0.1) !important;
  border-color: rgba(250, 173, 20, 0.55) !important;
}

.actionBtn {
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 800;
  border: 1px solid var(--border-strong);
  background: var(--bg-surface-2);
  color: var(--text);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.actionBtn:hover {
  background: var(--bg-surface-1);
  border-color: var(--border-focus);
}

/* ── Blood ritual ────────────────────────────────────────────────────── */
.ritualBlock {
  padding: 8px;
  border: 1px solid rgba(255, 77, 79, 0.3);
  border-radius: 10px;
  background: rgba(255, 77, 79, 0.06);
}

.ritualBtn {
  width: 100%;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid rgba(255, 77, 79, 0.4);
  background: rgba(255, 77, 79, 0.14);
  color: #ff9c9e;
  transition: background 0.15s;
  text-align: left;
}
.ritualBtn:not(:disabled):hover { background: rgba(255, 77, 79, 0.25); }
.ritualBtn:disabled { opacity: 0.35; cursor: not-allowed; }

/* ── Event log ───────────────────────────────────────────────────────── */
.eventsBlock {
  display: grid;
  gap: 6px;
}

.eventsHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.eventsTitle {
  font-size: 12px;
  font-weight: 700;
  opacity: 0.65;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.eventsOpenBtn {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-surface-2);
  color: var(--text-muted);
  cursor: pointer;
}
.eventsOpenBtn:hover { background: var(--bg-surface-1); }

.eventsArea {
  width: 100%;
  height: 100px;
  resize: none;
  overflow: auto;
  box-sizing: border-box;
  white-space: pre;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 10px;
  line-height: 1.5;
  background: var(--bg-surface-2);
  color: var(--text-muted);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 8px;
}
</style>

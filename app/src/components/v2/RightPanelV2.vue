<script setup lang="ts">
import { computed, inject, type Ref } from 'vue'
import { GAME_V2_KEY, type GameV2Ctx } from '../../composables/useGameV2Context'
import type { GameState, PieceBase, Pos } from '../../engine'
import { canRevive, canBloodRitual, getSoulCard } from '../../engine'
import { useUiStore } from '../../stores/ui'
import UnitInfoPanel from '../UnitInfoPanel.vue'
import CellInfoPanel from '../CellInfoPanel.vue'
import GraveyardPanel from '../GraveyardPanel.vue'

const ctx = inject(GAME_V2_KEY) as GameV2Ctx
const state = ctx.state as Ref<GameState>
const ui = useUiStore()

const BASE_IMAGES: Partial<Record<PieceBase, string>> = {
  king:     '/assets/cards/base/king.jpg',
  advisor:  '/assets/cards/base/advisor.jpg',
  elephant: '/assets/cards/base/elephant.jpg',
  rook:     '/assets/cards/base/rook.jpg',
  knight:   '/assets/cards/base/knight.jpg',
  cannon:   '/assets/cards/base/cannon.jpg',
  soldier:  '/assets/cards/base/soldier.jpg',
}

// ── Action lock (PVE bot turn / online opponent turn) ──────────────────────────
const isLocked = computed(() => {
  if (ctx.isPve && ctx.botRunning?.value) return true
  if (ctx.onlineSide != null && ctx.onlineSide !== state.value.turn.side) return true
  return false
})

// ── Selected unit ──────────────────────────────────────────────────────────────
const selectedUnit = computed(() => {
  const id = ui.selectedUnitId
  if (!id) return null
  const u = state.value.units[id]
  if (!u) return null
  return {
    id: u.id, side: u.side, base: u.base, pos: u.pos,
    hpCurrent: u.hpCurrent, atk: u.atk, def: u.def, enchant: u.enchant,
  }
})

const selectedEnchantSoul = computed(() => {
  if (!selectedUnit.value?.enchant?.soulId) return null
  const c = getSoulCard(selectedUnit.value.enchant.soulId)
  return c ? { id: c.id, name: c.name, image: c.image ?? undefined } : null
})

const selectedUnitBaseImage = computed(() =>
  selectedUnit.value ? BASE_IMAGES[selectedUnit.value.base] : undefined
)

// ── Selected cell ──────────────────────────────────────────────────────────────
const selectedCell = computed(() => ui.selectedCell)

const selectedCellUnit = computed(() => {
  const pos = selectedCell.value
  if (!pos) return null
  const u = Object.values(state.value.units).find((u) => u.pos.x === pos.x && u.pos.y === pos.y)
  if (!u) return null
  return {
    id: u.id, side: u.side, base: u.base, pos: u.pos,
    hpCurrent: u.hpCurrent, atk: u.atk, def: u.def, enchant: u.enchant,
  }
})

const selectedCellCorpses = computed(() => {
  const pos = selectedCell.value
  if (!pos) return []
  return state.value.corpsesByPos[`${pos.x},${pos.y}`] ?? []
})

// ── Guards ─────────────────────────────────────────────────────────────────────
const reviveGuard = computed(() => {
  if (isLocked.value) return { ok: false as const, reason: '不是你的回合' }
  if (!selectedCell.value) return { ok: false as const, reason: '請先選擇格子' }
  return canRevive(state.value, selectedCell.value)
})

const bloodRitualGuard = computed(() => {
  if (isLocked.value) return { ok: false as const, reason: '不是你的回合' }
  return canBloodRitual(state.value)
})

// ── Actions ────────────────────────────────────────────────────────────────────
function reviveAt(pos: Pos) {
  const key = `${pos.x},${pos.y}`
  const stack = state.value.corpsesByPos[key] ?? []
  const side = state.value.turn.side
  let corpseIndex: number | undefined
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i]?.ownerSide === side) { corpseIndex = i; break }
  }
  ctx.dispatch({ type: 'REVIVE', pos: { ...pos }, ...(corpseIndex !== undefined ? { corpseIndex } : {}) })
}

function bloodRitual() {
  ctx.dispatch({ type: 'BLOOD_RITUAL' })
}

const BASE_NAMES: Record<string, string> = {
  king: '帥', advisor: '士', elephant: '象', rook: '車', knight: '馬', cannon: '炮', soldier: '兵',
}
const CLAN_NAMES: Record<string, string> = {
  dark_moon: '暗月', styx: '冥河', eternal_night: '永夜', iron_guard: '鐵衛',
}

function showSoulDetail(id: string | null | undefined) {
  if (!id) return
  const c = getSoulCard(id)
  if (!c) return
  const lines: string[] = []
  lines.push(`棋種：${BASE_NAMES[c.base] ?? c.base}`)
  lines.push(`氏族：${CLAN_NAMES[c.clan] ?? c.clan}`)
  lines.push(`生命：${c.stats.hp}`)
  if (c.stats.atk) {
    const k = c.stats.atk.key === 'phys' ? '物理' : '魔法'
    lines.push(`攻擊：${k} ${c.stats.atk.value}`)
  }
  if (c.stats.def && c.stats.def.length > 0) {
    const defStr = c.stats.def.map((d) => `${d.key === 'phys' ? '物理' : '魔法'} ${d.value}`).join(' / ')
    lines.push(`防禦：${defStr}`)
  }
  lines.push(`費用：${c.costGold} 財力`)
  if (c.text) lines.push(`\n效果：${c.text}`)
  ui.openDetailModal({
    title: c.name,
    image: c.image || null,
    actionLabel: null,
    actionDisabled: false,
    actionTitle: '',
    detail: lines.join('\n'),
  })
}

// ── Misc ───────────────────────────────────────────────────────────────────────
const lastEvents = computed(() => ctx.lastEvents?.value ?? [])
const phase = computed(() => state.value.turn.phase)
</script>

<template>
  <div class="rightPanel">
    <!-- Blood ritual (necro only) -->
    <div v-if="phase === 'necro'" class="ritualBlock">
      <button
        type="button"
        class="ritualBtn"
        :disabled="!bloodRitualGuard.ok"
        :title="bloodRitualGuard.ok ? '' : bloodRitualGuard.reason"
        @click="bloodRitual"
      >
        🩸 血液祭儀（帥 -3 HP，死靈術 +1）
      </button>
    </div>

    <!-- Selected unit info -->
    <UnitInfoPanel
      :unit="selectedUnit"
      :enchant-soul="selectedEnchantSoul"
      :base-image="selectedUnitBaseImage"
      @show-soul-detail="showSoulDetail"
    />

    <!-- Selected cell info -->
    <CellInfoPanel
      :phase="phase"
      :selected-cell="selectedCell"
      :cell-unit="selectedCellUnit"
      :corpses="selectedCellCorpses"
      :revive-guard="reviveGuard"
      @revive="reviveAt"
    />

    <!-- Graveyard -->
    <GraveyardPanel
      :red="state.graveyard.red"
      :black="state.graveyard.black"
      :preview-count="5"
      @show-soul-detail="showSoulDetail"
    />

    <!-- Event log -->
    <div class="eventsBlock" role="button" tabindex="0" @click="ctx.openEvents?.()" @keydown.enter="ctx.openEvents?.()">
      <div class="eventsHead">
        <span class="eventsTitle">📜 最近事件</span>
        <span class="eventsMore">▶</span>
      </div>
      <div class="eventsArea">
        <div
          v-for="(line, i) in lastEvents.slice().reverse()"
          :key="i"
          class="eventsRow"
          :class="{ eventsRowAlt: i % 2 === 1 }"
        >{{ line }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rightPanel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 10px 16px;
  overflow-y: auto;
  height: 100%;
  box-sizing: border-box;
}

/* ── Blood ritual ── */
.ritualBlock {
  padding: 8px;
  border: 1px solid rgba(255, 77, 79, 0.3);
  border-radius: 10px;
  background: rgba(255, 77, 79, 0.06);
  flex-shrink: 0;
}

.ritualBtn {
  width: 100%;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 0.8125rem;
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

/* ── Event log ── */
.eventsBlock {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1 1 0;
  min-height: 120px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px;
  cursor: pointer;
  transition: border-color 0.15s;
}
.eventsBlock:hover {
  border-color: var(--border-strong);
}

.eventsHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.eventsTitle {
  font-size: 0.75rem;
  font-weight: 700;
  opacity: 0.65;
  letter-spacing: 0.04em;
}

.eventsMore {
  font-size: 0.6rem;
  opacity: 0.4;
}

.eventsArea {
  flex: 1 1 0;
  overflow-y: auto;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 4px 0;
}

.eventsRow {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace;
  font-size: 0.625rem;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.5);
  padding: 2px 8px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background 0.1s, color 0.1s;
}
.eventsRow:hover {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.85);
}
.eventsRowAlt {
  background: rgba(255, 255, 255, 0.015);
}
</style>

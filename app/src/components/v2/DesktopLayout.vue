<script setup lang="ts">
import { ref, computed, watch, inject, type Ref } from 'vue'
import type { GameState } from '../../engine'
import StatusBarV2 from './StatusBarV2.vue'
import BoardV2 from './BoardV2.vue'
import HandPanelV2 from './HandPanelV2.vue'
import RightPanelV2 from './RightPanelV2.vue'
import type { GameV2Ctx } from '../../composables/useGameV2Context'
import { GAME_V2_KEY } from '../../composables/useGameV2Context'

const ctx = inject(GAME_V2_KEY) as GameV2Ctx
const state = ctx.state as Ref<GameState>

const leftCollapsed = ref(localStorage.getItem('v2_left_collapsed') === '1')
const rightCollapsed = ref(localStorage.getItem('v2_right_collapsed') === '1')

// ── Right panel width cycle ────────────────────────────────────────────────────
type PanelSize = 'sm' | 'md' | 'lg'
const VALID_SIZES: PanelSize[] = ['sm', 'md', 'lg']
const panelSize = ref<PanelSize>(
  VALID_SIZES.includes(localStorage.getItem('v2_panel_size') as PanelSize)
    ? (localStorage.getItem('v2_panel_size') as PanelSize)
    : 'md'
)
const PANEL_WIDTHS: Record<PanelSize, string> = { sm: '20%', md: '28%', lg: '38%' }
const PANEL_LABELS: Record<PanelSize, string> = { sm: '◀◀', md: '◀▶', lg: '▶▶' }
function cyclePanelSize() {
  panelSize.value = panelSize.value === 'sm' ? 'md' : panelSize.value === 'md' ? 'lg' : 'sm'
}
watch(leftCollapsed,  (v) => localStorage.setItem('v2_left_collapsed',  v ? '1' : '0'))
watch(rightCollapsed, (v) => localStorage.setItem('v2_right_collapsed', v ? '1' : '0'))
watch(panelSize,      (v) => localStorage.setItem('v2_panel_size', v))

const rightPanelStyle = computed(() =>
  rightCollapsed.value ? { width: '28px' } : { width: PANEL_WIDTHS[panelSize.value] }
)

const currentSide  = computed(() => state.value.turn.side)
const currentPhase = computed(() => state.value.turn.phase)
const necroUsed    = computed(() => state.value.turnFlags.necroActionsUsed ?? 0)
const necroMax     = computed(() =>
  state.value.limits.necroActionsPerTurn +
  (state.value.turnFlags.necroBonusActions ?? 0) +
  (state.value.turnFlags.itemNecroBonus ?? 0)
)

const kingHp = computed(() => {
  const red   = Object.values(state.value.units).find((u) => u.side === 'red'   && u.base === 'king')?.hpCurrent ?? null
  const black = Object.values(state.value.units).find((u) => u.side === 'black' && u.base === 'king')?.hpCurrent ?? null
  return { red, black }
})
const res = computed(() => state.value.resources)
</script>

<template>
  <div class="gameDesktop" :class="currentSide === 'red' ? 'turn-red' : 'turn-black'">
    <!-- ── Status bar ── -->
    <StatusBarV2
      :current-side="currentSide"
      :current-phase="currentPhase"
      :necro-used="necroUsed"
      :necro-max="necroMax"
      :black-hp="kingHp.black"
      :black-gold="res.black.gold"
      :black-mana="res.black.mana"
      :black-storage-mana="res.black.storageMana"
      :red-hp="kingHp.red"
      :red-gold="res.red.gold"
      :red-mana="res.red.mana"
      :red-storage-mana="res.red.storageMana"
      :online-side="ctx.onlineSide"
      :action-locked="ctx.actionLocked"
      @next-phase="ctx.dispatch({ type: 'NEXT_PHASE' })"
    />

    <!-- ── Main body ── -->
    <div class="body" :class="currentSide === 'red' ? 'body--red' : 'body--black'">
      <!-- Left nav -->
      <nav class="leftNav" :class="{ collapsed: leftCollapsed }">
        <button class="navCollapseBtn" @click="leftCollapsed = !leftCollapsed" :title="leftCollapsed ? '展開' : '收合'">
          {{ leftCollapsed ? '▶' : '◀' }}
        </button>
        <div class="navItems">
          <button class="navBtn" @click="ctx.openShop?.()">
            <span class="navIcon">🏪</span>
            <span class="navTooltip">商店</span>
          </button>
          <button class="navBtn" @click="ctx.openAllUnits?.()">
            <span class="navIcon">👥</span>
            <span class="navTooltip">全單位列表</span>
          </button>
          <button class="navBtn" @click="ctx.openEffects?.()">
            <span class="navIcon">📖</span>
            <span class="navTooltip">效果說明</span>
          </button>
          <button class="navBtn" @click="ctx.openEvents?.()">
            <span class="navIcon">📋</span>
            <span class="navTooltip">事件紀錄</span>
          </button>
        </div>
      </nav>

      <!-- Board area -->
      <main class="boardArea">
        <!-- Buff bar (sticky top of board area) -->
        <div v-if="ctx.activeBuffs && ctx.activeBuffs.length > 0" class="buffBar">
          <span
            v-for="(b, i) in ctx.activeBuffs"
            :key="i"
            class="buffPill"
            :class="`buffPill--${b.kind}`"
          >{{ b.label }}</span>
        </div>

        <!-- Board -->
        <div class="boardPlaceholder">
          <BoardV2 />
          <!-- Bot running overlay -->
          <div v-if="ctx.isPve && ctx.botRunning?.value" class="botOverlay">
            <span class="botSpinner">🤖 電腦思考中…</span>
          </div>
        </div>
      </main>

      <!-- Right panel -->
      <aside class="rightPanel" :style="rightPanelStyle">
        <div class="rightPanelHeader">
          <button
            v-if="!rightCollapsed"
            class="panelSizeBtn"
            @click="cyclePanelSize"
            :title="'切換面板寬度'"
          >{{ PANEL_LABELS[panelSize] }}</button>
          <button
            class="panelCollapseBtn"
            @click="rightCollapsed = !rightCollapsed"
            :title="rightCollapsed ? '展開' : '收合'"
          >{{ rightCollapsed ? '◀' : '▶' }}</button>
        </div>
        <div v-if="!rightCollapsed" class="rightPanelContent">
          <RightPanelV2 />
        </div>
      </aside>
    </div>

    <!-- Bottom panel: hand cards -->
    <div class="bottomPanel">
      <HandPanelV2 />
    </div>
  </div>
</template>

<style scoped>
.gameDesktop {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  overflow: hidden;
  background: #1a1c2e;
  transition: background 0.5s ease;
}
.turn-red   { background: linear-gradient(180deg, rgba(255, 77, 79, 0.18) 0%, #1a1c2e 30%); }
.turn-black { background: linear-gradient(180deg, rgba(82, 196, 26, 0.18) 0%, #1a1c2e 30%); }

/* ── Body (3 columns) ── */
.body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  transition: box-shadow 0.5s ease;
}
.body--red   { box-shadow: inset 0 0 60px rgba(255, 77, 79, 0.06); }
.body--black { box-shadow: inset 0 0 60px rgba(82, 196, 26, 0.06); }

/* ── Left nav ── */
.leftNav {
  width: 64px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
  gap: 4px;
  background: rgba(0, 0, 0, 0.25);
  border-right: 1px solid rgba(255, 255, 255, 0.07);
  transition: width 0.2s;
  overflow: visible;
  z-index: 50;
  position: relative;
}

.leftNav.collapsed {
  width: 28px;
}

.leftNav.collapsed .navItems {
  opacity: 0;
  pointer-events: none;
}

.navCollapseBtn {
  width: 24px;
  height: 28px;
  padding: 0;
  font-size: 0.625rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.45);
  cursor: pointer;
  margin-bottom: 4px;
  flex-shrink: 0;
  transition: background 0.15s;
}

.navCollapseBtn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.8);
}

.navItems {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  align-items: center;
  transition: opacity 0.15s;
}

.navBtn {
  width: 44px;
  height: 44px;
  padding: 0;
  font-size: 1.25rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 10px;
  cursor: pointer;
  display: grid;
  place-items: center;
  position: relative;
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
}

.navBtn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  transform: scale(1.05);
}

.navIcon {
  pointer-events: none;
}

.navTooltip {
  position: absolute;
  left: calc(100% + 10px);
  top: 50%;
  transform: translateY(-50%);
  white-space: nowrap;
  background: rgba(20, 22, 40, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.85);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s;
  backdrop-filter: blur(6px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.navBtn:hover .navTooltip {
  opacity: 1;
}

/* ── Board area ── */
.boardArea {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
}

/* Buff bar: sticky within boardArea */
.buffBar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 6px 10px;
  background: rgba(14, 16, 30, 0.9);
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  backdrop-filter: blur(6px);
}

.buffPill {
  font-size: 0.6875rem;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid;
  white-space: nowrap;
}
.buffPill--free   { color: #e8d070; border-color: rgba(232, 208, 112, 0.4); background: rgba(232, 208, 112, 0.08); }
.buffPill--buff   { color: #91caff; border-color: rgba(145, 202, 255, 0.4); background: rgba(145, 202, 255, 0.08); }
.buffPill--aura   { color: #b37feb; border-color: rgba(179, 127, 235, 0.4); background: rgba(179, 127, 235, 0.08); }


/* Board slot placeholder */
.boardPlaceholder {
  flex: 1;
  display: flex;
  min-height: 0;
  position: relative;
}

/* Bot overlay */
.botOverlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 16px;
  pointer-events: none;
}
.botSpinner {
  background: rgba(16, 18, 36, 0.85);
  border: 1px solid rgba(179, 127, 235, 0.4);
  color: #b37feb;
  font-size: 0.875rem;
  font-weight: 600;
  padding: 6px 16px;
  border-radius: 20px;
  backdrop-filter: blur(6px);
  animation: botPulse 1.2s ease-in-out infinite;
}
@keyframes botPulse {
  0%, 100% { opacity: 0.75; }
  50%       { opacity: 1; }
}

/* ── Right panel ── */
.rightPanel {
  flex-shrink: 0;
  background: rgba(0, 0, 0, 0.18);
  border-left: 1px solid rgba(255, 255, 255, 0.07);
  overflow: hidden;
  transition: width 0.2s;
  display: flex;
  flex-direction: column;
}

.rightPanelHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 2px;
  gap: 4px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.panelCollapseBtn {
  width: 24px;
  height: 28px;
  padding: 0;
  font-size: 0.625rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.45);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;
}
.panelCollapseBtn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.8);
}

.panelSizeBtn {
  padding: 2px 7px;
  font-size: 0.625rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.45);
  cursor: pointer;
  transition: background 0.15s;
}
.panelSizeBtn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.8);
}

.rightPanelContent {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

/* ── Bottom panel ── */
.bottomPanel {
  flex-shrink: 0;
  background: rgba(8, 10, 22, 0.97);
  border-top: 1px solid rgba(255, 255, 255, 0.09);
}
</style>

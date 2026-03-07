<script setup lang="ts">
import { ref, computed, inject, onMounted, onUnmounted, type Ref } from 'vue'
import { useRouter } from 'vue-router'
import type { GameState, Phase } from '../../engine'
import { getSoulCard, getItemCard, canReturnSoulToDeckBottom, canDiscardItemFromHand, canUseItemFromHand, BASE_STATS } from '../../engine'
import { useConnection } from '../../stores/connection'
import { useGameSetup } from '../../stores/gameSetup'
import BoardV2 from './BoardV2.vue'
import HandSouls from '../HandSouls.vue'
import HandItems from '../HandItems.vue'
import RightPanelV2 from './RightPanelV2.vue'
import type { GameV2Ctx } from '../../composables/useGameV2Context'
import { GAME_V2_KEY } from '../../composables/useGameV2Context'
import { useUiStore } from '../../stores/ui'

const ctx = inject(GAME_V2_KEY) as GameV2Ctx
const state = ctx.state as Ref<GameState>
const ui = useUiStore()

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

// ── Hand data ─────────────────────────────────────────────────────────────────
const mySide = computed<'red' | 'black'>(() => ctx.onlineSide ?? state.value.turn.side)
const phase  = computed(() => state.value.turn.phase)

const handSoulCards = computed(() =>
  state.value.hands[mySide.value].souls.map((id) => getSoulCard(id)).filter((c): c is NonNullable<typeof c> => !!c)
)
const handItemIds = computed(() => state.value.hands[mySide.value].items)
const selectedSoulId = ref('')
const selectedUnit = computed(() => {
  const id = ui.selectedUnitId
  return id ? state.value.units[id] ?? null : null
})
const enchantGuard = computed(() => ({ ok: false as const, reason: 'Click board unit' }))
const returnGuards = computed(() => {
  const out: Partial<Record<string, ReturnType<typeof canReturnSoulToDeckBottom>>> = {}
  for (const c of handSoulCards.value) out[c.id] = canReturnSoulToDeckBottom(state.value, c.id)
  return out
})
const discardGuards = computed(() => {
  const out: Partial<Record<string, ReturnType<typeof canDiscardItemFromHand>>> = {}
  for (const id of handItemIds.value) out[id] = canDiscardItemFromHand(state.value, id)
  return out
})
const useGuards = computed(() => {
  const out: Partial<Record<string, ReturnType<typeof canUseItemFromHand>>> = {}
  for (const id of handItemIds.value) out[id] = canUseItemFromHand(state.value, id)
  return out
})

function selectSoul(id: string) {
  selectedSoulId.value = id
  if (phase.value === 'necro') ui.startEnchantSelectUnit(id)
}
function onSoulDragStart(e: DragEvent, soulId: string) {
  selectedSoulId.value = soulId
  e.dataTransfer?.setData('application/x-soul-id', soulId)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy'
  if (phase.value === 'necro') ui.startEnchantSelectUnit(soulId)
}
function onSoulDragEnd() {
  if (ui.interactionMode.kind === 'enchant_select_unit') ui.clearInteractionMode()
}
function returnSoul(soulId: string) { ctx.dispatch({ type: 'RETURN_SOUL_TO_DECK_BOTTOM', soulId }) }
function discardItem(itemId: string) { ctx.dispatch({ type: 'DISCARD_ITEM_FROM_HAND', itemId }) }
function getUnitHpMax(unit: GameState['units'][string]) {
  const soul = unit.enchant?.soulId ? getSoulCard(unit.enchant.soulId) : null
  return soul?.stats.hp ?? (BASE_STATS as any)[unit.base]?.hp ?? 10
}
function useItem(itemId: string) {
  const side = state.value.turn.side
  switch (itemId) {
    case 'item_lingxue_holy_grail': {
      const ids = Object.values(state.value.units).filter((u) => u.side === side && u.hpCurrent < getUnitHpMax(u)).map((u) => u.id)
      ui.startUseItemTargetUnit(itemId, ids); break
    }
    case 'item_dead_return_path': {
      const ids = Object.values(state.value.units).filter((u) => u.side === side && !!u.enchant).map((u) => u.id)
      ui.startUseItemTargetUnit(itemId, ids); break
    }
    case 'item_bone_refine': ui.startUseItemTargetCorpse(itemId); break
    case 'item_nether_seal': {
      const ids = Object.values(state.value.units).filter((u) => u.side !== side).map((u) => u.id)
      ui.startUseItemTargetUnit(itemId, ids); break
    }
    case 'item_soul_detach_needle': {
      const ids = Object.values(state.value.units).filter((u) => u.side !== side && !!u.enchant).map((u) => u.id)
      ui.startUseItemTargetUnit(itemId, ids); break
    }
    default: {
      const item = getItemCard(itemId)
      ui.setPendingConfirm({ action: { type: 'USE_ITEM_FROM_HAND', itemId } as any, title: item?.name ?? itemId, detail: item?.text ?? '' })
    }
  }
}
function getItemName(id: string) { return getItemCard(id)?.name ?? id }

// ── Mobile header ─────────────────────────────────────────────────────────────
const router  = useRouter()
const conn    = useConnection()
const setup   = useGameSetup()

const nextPhaseLabel = computed(() => {
  if (currentPhase.value === 'buy')    return '死靈術→'
  if (currentPhase.value === 'necro')  return '戰鬥→'
  if (currentPhase.value === 'combat') return '結束→'
  return '下一階段'
})

const isOnline = computed(() => setup.mode === 'online')
const connDotClass = computed(() => {
  if (!isOnline.value) return null
  switch (conn.status) {
    case 'playing':    return 'dot--green'
    case 'waiting':    return 'dot--yellow'
    case 'connecting': return 'dot--yellow'
    case 'error':      return 'dot--red'
    default:           return null
  }
})
const connLabel = computed(() => {
  const m: Record<string, string> = { playing: '連線', waiting: '等待', connecting: '連線中', error: '錯誤' }
  return m[conn.status] ?? ''
})

const gearOpen = ref(false)
function goHome() { router.push({ name: 'home' }); gearOpen.value = false }
onMounted(() => {
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') gearOpen.value = false }
  window.addEventListener('keydown', onKey)
  onUnmounted(() => window.removeEventListener('keydown', onKey))
})

// Bottom panel tab
type TabKey = 'souls' | 'items' | 'panel' | 'tools'
const activeTab = ref<TabKey | null>(null)
function toggleTab(tab: TabKey) {
  activeTab.value = activeTab.value === tab ? null : tab
}
</script>

<template>
  <div class="gameMobile" :class="currentSide === 'red' ? 'turn-red' : 'turn-black'">
    <!-- ── Compact mobile header ── -->
    <header class="mobileHeader" :class="currentSide === 'red' ? 'bar--red' : 'bar--black'">
      <!-- Row 1: Black -->
      <div class="playerRow" :class="{ 'playerRow--active': currentSide === 'black' }">
        <span class="sdot sdot--black" />
        <span class="pname">{{ ctx.onlineSide === 'black' ? '你' : ctx.onlineSide === 'red' ? '敵' : 'BLACK' }}</span>
        <span class="mres mrHp">♥ {{ kingHp.black ?? '?' }}</span>
        <span class="mres">💰 <span class="rl">財力</span> {{ res.black.gold }}</span>
        <span class="mres">🌟 <span class="rl">魔力</span> {{ res.black.mana }}</span>
        <span class="mres">⚖ <span class="rl">存魔</span> {{ res.black.storageMana }}</span>
      </div>
      <!-- Row 2: Red -->
      <div class="playerRow playerRow--red" :class="{ 'playerRow--active': currentSide === 'red' }">
        <span class="sdot sdot--red" />
        <span class="pname">{{ ctx.onlineSide === 'red' ? '你' : ctx.onlineSide === 'black' ? '敵' : 'RED' }}</span>
        <span class="mres mrHp">♥ {{ kingHp.red ?? '?' }}</span>
        <span class="mres">💰 <span class="rl">財力</span> {{ res.red.gold }}</span>
        <span class="mres">🌟 <span class="rl">魔力</span> {{ res.red.mana }}</span>
        <span class="mres">⚖ <span class="rl">存魔</span> {{ res.red.storageMana }}</span>
      </div>
      <!-- Row 3: Phase + next + gear -->
      <div class="controlRow">
        <div class="phaseTabs">
          <div
            v-for="p in (['buy', 'necro', 'combat'] as Phase[])"
            :key="p"
            class="pTab"
            :class="{ active: currentPhase === p, [`pTab--${p}`]: true }"
          >
            <span>{{ p === 'buy' ? '💰' : p === 'necro' ? '⚗️' : '⚔️' }}</span>
            <span class="ptLabel">{{ p === 'buy' ? '購買' : p === 'necro' ? '死靈術' : '戰鬥' }}</span>
            <span v-if="p === 'necro' && currentPhase === 'necro'" class="nc">{{ necroUsed }}/{{ necroMax }}</span>
          </div>
        </div>
        <button
          class="nextBtn"
          :class="currentSide === 'red' ? 'nextRed' : 'nextGreen'"
          :disabled="ctx.actionLocked"
          @click="ctx.dispatch({ type: 'NEXT_PHASE' })"
        >{{ nextPhaseLabel }}</button>
        <div class="gearWrap">
          <template v-if="isOnline && connDotClass">
            <span class="connDot" :class="connDotClass" :title="connLabel" />
          </template>
          <button class="gearBtn" :class="{ gearActive: gearOpen }" @click="gearOpen = !gearOpen">⚙️</button>
          <div v-if="gearOpen" class="gearPop" @click.stop>
            <button class="gearItem" @click="goHome">🏠 返回首頁</button>
            <template v-if="ctx.isPve">
              <div class="gearDivider" />
              <button class="gearItem" @click="ctx.cycleBotSpeed?.()">
                🤖 Bot速度：{{ ctx.botSpeedLabel?.value ?? '正常' }}
              </button>
            </template>
            <button class="gearItem gearClose" @click="gearOpen = false">✕ 關閉</button>
          </div>
          <div v-if="gearOpen" class="gearBackdrop" @click="gearOpen = false" />
        </div>
      </div>
    </header>

    <!-- ── Board area ── -->
    <div class="boardArea">
      <!-- Buff bar -->
      <div v-if="ctx.activeBuffs && ctx.activeBuffs.length > 0" class="buffBar">
        <span
          v-for="(b, i) in ctx.activeBuffs"
          :key="i"
          class="buffPill"
          :class="`buffPill--${b.kind}`"
        >{{ b.label }}</span>
      </div>

      <!-- Board (mobile: forced flat + 100%) -->
      <div class="boardSlot">
        <BoardV2 :mobile="true" />
        <div v-if="ctx.isPve && ctx.botRunning?.value" class="botOverlay">
          <span class="botSpinner">🤖 電腦思考中…</span>
        </div>
      </div>
    </div>

    <!-- ── Fixed bottom panel ── -->
    <div class="bottomPanel">
      <!-- Action strip (overlaid above tab bar, shows when content exists) -->
      <div v-if="ctx.actionStripContent" class="actionStrip">
        <slot name="actionStrip" />
      </div>

      <!-- Tab bar (always visible) -->
      <div class="tabBar">
        <button
          v-for="tab in (['souls', 'items', 'panel', 'tools'] as TabKey[])"
          :key="tab"
          :class="['tabBtn', activeTab === tab && 'active']"
          @click="toggleTab(tab)"
        >
          <span class="tabIcon">
            {{ tab === 'souls' ? '🃏' : tab === 'items' ? '🎒' : tab === 'panel' ? '📋' : '🛠' }}
          </span>
          <span class="tabLabel">
            {{ tab === 'souls' ? '靈魂' : tab === 'items' ? '道具' : tab === 'panel' ? '面板' : '工具' }}
          </span>
        </button>
      </div>

      <!-- Tab content -->
      <div v-if="activeTab" class="tabContent">
        <HandSouls
          v-if="activeTab === 'souls'"
          :phase="phase"
          :cards="handSoulCards"
          :selected-soul-id="selectedSoulId"
          :selected-unit="selectedUnit"
          :enchant-guard="enchantGuard"
          :return-guards="returnGuards"
          @select="selectSoul"
          @dragstart="onSoulDragStart"
          @dragend="onSoulDragEnd"
          @return="returnSoul"
        />
        <HandItems
          v-else-if="activeTab === 'items'"
          :phase="phase"
          :items="handItemIds"
          :discard-guards="discardGuards"
          :use-guards="useGuards"
          :get-item-name="getItemName"
          :get-item="getItemCard"
          @discard="discardItem"
          @use-item="useItem"
        />
        <RightPanelV2
          v-else-if="activeTab === 'panel'"
          :style="{ height: 'auto', overflowY: 'visible', padding: '4px 0' }"
        />
        <div v-else-if="activeTab === 'tools'" class="toolsTab">
          <button class="toolBtn" @click="ctx.openShop?.(); toggleTab('tools')">🏪 商店</button>
          <button class="toolBtn" @click="ctx.openAllUnits?.(); toggleTab('tools')">👥 所有單位</button>
          <button class="toolBtn" @click="ctx.openEffects?.(); toggleTab('tools')">📖 場上效果</button>
          <button class="toolBtn" @click="ctx.openEvents?.(); toggleTab('tools')">📜 事件紀錄</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gameMobile {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  overflow: hidden;
  background: #1a1c2e;
}
.turn-red   { background: linear-gradient(180deg, rgba(255, 77, 79, 0.18) 0%, #1a1c2e 35%); }
.turn-black { background: linear-gradient(180deg, rgba(82, 196, 26, 0.18) 0%, #1a1c2e 35%); }

/* ── Compact mobile header ── */
.mobileHeader {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: linear-gradient(90deg, rgba(10, 12, 26, 0.97) 0%, rgba(20, 22, 40, 0.97) 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  z-index: 100;
  transition: border-bottom-color 0.4s;
}
.bar--red   { border-bottom-color: rgba(255, 90, 90, 0.45); }
.bar--black { border-bottom-color: rgba(82, 196, 26, 0.45); }

.playerRow {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  transition: background 0.3s;
}
.playerRow--active {
  background: rgba(82, 200, 82, 0.06);
}
.playerRow--red.playerRow--active {
  background: rgba(255, 70, 70, 0.06);
}

.sdot {
  width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
}
.sdot--black { background: #52c41a; box-shadow: 0 0 4px rgba(82, 196, 26, 0.7); }
.sdot--red   { background: #ff4d4f; box-shadow: 0 0 4px rgba(255, 77, 79, 0.7); }

.pname {
  font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.08em;
  color: rgba(255,255,255,0.45); text-transform: uppercase; white-space: nowrap; min-width: 30px;
}

.mres {
  font-size: 0.8125rem; color: rgba(255,255,255,0.75);
  display: flex; align-items: center; gap: 2px; white-space: nowrap;
}
.mrHp { font-size: 0.875rem; color: #ff9c9e; font-weight: 700; }
.rl { font-size: 0.6875rem; opacity: 0.55; }

.controlRow {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
}

.phaseTabs {
  display: flex; gap: 3px; flex: 1;
}

.pTab {
  padding: 4px 8px;
  border-radius: 7px;
  border: 1px solid rgba(255,255,255,0.06);
  background: rgba(0,0,0,0.2);
  opacity: 0.38;
  font-size: 0.8125rem;
  display: flex; align-items: center; gap: 4px;
  transition: opacity 0.2s, border-color 0.2s;
}
.ptLabel { font-size: 0.75rem; font-weight: 600; color: rgba(255,255,255,0.7); }
.pTab.active { opacity: 1; border-color: rgba(255,255,255,0.15); }
.pTab--buy.active   { border-color: rgba(232,200,60,0.4); }
.pTab--necro.active { border-color: rgba(179,127,235,0.4); }
.pTab--combat.active { border-color: rgba(255,120,70,0.4); }

.nc { font-size: 0.5rem; color: #b37feb; }

.nextBtn {
  padding: 6px 12px;
  border-radius: 7px;
  font-size: 0.875rem; font-weight: 700;
  cursor: pointer; white-space: nowrap;
  transition: background 0.15s;
}
.nextRed  { background: rgba(255,77,79,0.15); border: 1px solid rgba(255,100,100,0.45); color: #ffb0b2; }
.nextRed:hover:not(:disabled)  { background: rgba(255,77,79,0.28); }
.nextGreen { background: rgba(82,196,26,0.12); border: 1px solid rgba(82,196,26,0.45); color: #b7eb8f; }
.nextGreen:hover:not(:disabled) { background: rgba(82,196,26,0.22); }
.nextBtn:disabled { opacity: 0.3; cursor: not-allowed; }

.gearWrap { position: relative; display: flex; align-items: center; gap: 4px; }

.connDot {
  width: 6px; height: 6px; border-radius: 50%;
}
.dot--green  { background: #52c41a; box-shadow: 0 0 4px rgba(82,196,26,0.7); }
.dot--yellow { background: #faad14; box-shadow: 0 0 4px rgba(250,173,20,0.7); }
.dot--red    { background: #ff4d4f; box-shadow: 0 0 4px rgba(255,77,79,0.7); }

.gearBtn {
  width: 26px; height: 26px; padding: 0;
  font-size: 0.875rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px; cursor: pointer;
  display: grid; place-items: center;
}
.gearBtn:hover, .gearBtn.gearActive {
  background: rgba(255,255,255,0.1);
}

.gearPop {
  position: absolute; top: calc(100% + 4px); right: 0;
  min-width: 140px;
  background: rgba(16,18,36,0.98);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px; padding: 6px;
  display: flex; flex-direction: column; gap: 4px;
  z-index: 200; backdrop-filter: blur(10px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
}
.gearItem {
  width: 100%; padding: 7px 10px; text-align: left;
  font-size: 0.8125rem;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 6px; color: rgba(255,255,255,0.75); cursor: pointer;
}
.gearItem:hover { background: rgba(255,255,255,0.1); }
.gearClose { border-color: rgba(255,77,79,0.2); color: rgba(255,150,150,0.8); }
.gearClose:hover { background: rgba(255,77,79,0.12); }
.gearDivider { height: 1px; background: rgba(255,255,255,0.07); margin: 4px 0; }
.gearBackdrop { position: fixed; inset: 0; z-index: 199; }

/* ── Board area ── */
.boardArea {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
}

.buffBar {
  position: sticky; top: 0; z-index: 10;
  display: flex; flex-wrap: wrap; gap: 4px;
  padding: 5px 8px;
  background: rgba(14, 16, 30, 0.92);
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  backdrop-filter: blur(6px);
}
.buffPill {
  font-size: 0.625rem; padding: 2px 7px; border-radius: 999px; border: 1px solid; white-space: nowrap;
}
.buffPill--free { color: #e8d070; border-color: rgba(232, 208, 112, 0.4); background: rgba(232, 208, 112, 0.08); }
.buffPill--buff { color: #91caff; border-color: rgba(145, 202, 255, 0.4); background: rgba(145, 202, 255, 0.08); }
.buffPill--aura { color: #b37feb; border-color: rgba(179, 127, 235, 0.4); background: rgba(179, 127, 235, 0.08); }

.boardSlot {
  flex: 1;
  display: flex;
  min-height: 0;
  position: relative;
}

.botOverlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 12px;
  pointer-events: none;
}
.botSpinner {
  background: rgba(16, 18, 36, 0.85);
  border: 1px solid rgba(179, 127, 235, 0.4);
  color: #b37feb;
  font-size: 0.8125rem;
  font-weight: 600;
  padding: 5px 14px;
  border-radius: 20px;
  backdrop-filter: blur(6px);
  animation: botPulse 1.2s ease-in-out infinite;
}
@keyframes botPulse {
  0%, 100% { opacity: 0.75; }
  50%       { opacity: 1; }
}

/* ── Bottom panel ── */
.bottomPanel {
  flex-shrink: 0;
  background: rgba(8, 10, 22, 0.97);
  border-top: 1px solid rgba(255, 255, 255, 0.09);
  position: relative;
}

/* Action strip: overlays above tab bar */
.actionStrip {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: rgba(20, 22, 40, 0.96);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(8px);
  font-size: 0.8125rem;
  flex-wrap: wrap;
}

/* Tab bar */
.tabBar {
  display: flex;
  height: 52px;
}

.tabBtn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 0;
  border: none;
  border-radius: 0;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.tabBtn:last-child { border-right: none; }

.tabBtn.active {
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.88);
  border-top: 2px solid rgba(232, 208, 112, 0.6);
}

.tabIcon { font-size: 1rem; }
.tabLabel { font-size: 0.5625rem; letter-spacing: 0.04em; }

/* Tab content */
.tabContent {
  overflow-y: auto;
  max-height: 40vh;
  padding: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

/* Tools tab */
.toolsTab {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 4px 0;
}
.toolBtn {
  padding: 12px 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  text-align: center;
}
.toolBtn:hover { background: rgba(255, 255, 255, 0.1); }
</style>

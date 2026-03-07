<script setup lang="ts">
import { ref, computed, inject, watch, type Ref } from 'vue'
import { GAME_V2_KEY, type GameV2Ctx } from '../../composables/useGameV2Context'
import type { GameState } from '../../engine'
import {
  canEnchant, canReturnSoulToDeckBottom, canDiscardItemFromHand,
  canUseItemFromHand, getSoulCard, getItemCard, BASE_STATS,
} from '../../engine'
import HandSouls from '../HandSouls.vue'
import HandItems from '../HandItems.vue'
import { useUiStore } from '../../stores/ui'

const ctx = inject(GAME_V2_KEY) as GameV2Ctx
const state = ctx.state as Ref<GameState>
const ui = useUiStore()

// Which side's hand to show
const mySide = computed<'red' | 'black'>(() => ctx.onlineSide ?? state.value.turn.side)
const phase  = computed(() => state.value.turn.phase)

const handSoulCards = computed(() =>
  state.value.hands[mySide.value].souls
    .map((id) => getSoulCard(id))
    .filter((c): c is NonNullable<typeof c> => !!c)
)
const handItemIds = computed(() => state.value.hands[mySide.value].items)

// ── Selected soul (for enchant) ────────────────────────────────────────────────
const selectedSoulId = ref('')
const selectedUnit = computed(() => {
  const id = ui.selectedUnitId
  return id ? state.value.units[id] ?? null : null
})

const enchantGuard = computed(() => {
  if (!selectedUnit.value || !selectedSoulId.value)
    return { ok: false as const, reason: 'Select soul + unit' }
  return canEnchant(state.value, selectedUnit.value.id, selectedSoulId.value)
})

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

// ── Soul actions ───────────────────────────────────────────────────────────────
function tryEnchantOrToast(soulId: string) {
  const side = state.value.turn.side
  const hasValid = Object.values(state.value.units).some(u => u.side === side && canEnchant(state.value, u.id, soulId).ok)
  if (!hasValid) {
    const firstOwn = Object.values(state.value.units).find(u => u.side === side)
    if (firstOwn) ctx.dispatch({ type: 'ENCHANT', unitId: firstOwn.id, soulId })
    return
  }
  ui.startEnchantSelectUnit(soulId)
}
function selectSoul(id: string) {
  selectedSoulId.value = id
  if (phase.value === 'necro') tryEnchantOrToast(id)
}
function onSoulDragStart(e: DragEvent, soulId: string) {
  selectedSoulId.value = soulId
  e.dataTransfer?.setData('application/x-soul-id', soulId)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy'
  if (phase.value === 'necro') tryEnchantOrToast(soulId)
}
function onSoulDragEnd() {
  if (ui.interactionMode.kind === 'enchant_select_unit') ui.clearInteractionMode()
}
function returnSoul(soulId: string) {
  ctx.dispatch({ type: 'RETURN_SOUL_TO_DECK_BOTTOM', soulId })
}

// ── Item actions ───────────────────────────────────────────────────────────────
function discardItem(itemId: string) {
  ctx.dispatch({ type: 'DISCARD_ITEM_FROM_HAND', itemId })
}

function getUnitHpMax(unit: GameState['units'][string]): number {
  const soul = unit.enchant?.soulId ? getSoulCard(unit.enchant.soulId) : null
  return soul?.stats.hp ?? (BASE_STATS as any)[unit.base]?.hp ?? 10
}

function useItem(itemId: string) {
  const side = state.value.turn.side
  switch (itemId) {
    case 'item_lingxue_holy_grail': {
      const validUnitIds = Object.values(state.value.units)
        .filter((u) => u.side === side && u.hpCurrent < getUnitHpMax(u))
        .map((u) => u.id)
      ui.startUseItemTargetUnit(itemId, validUnitIds)
      break
    }
    case 'item_dead_return_path': {
      const validUnitIds = Object.values(state.value.units)
        .filter((u) => u.side === side && !!u.enchant)
        .map((u) => u.id)
      ui.startUseItemTargetUnit(itemId, validUnitIds)
      break
    }
    case 'item_bone_refine':
      ui.startUseItemTargetCorpse(itemId)
      break
    case 'item_nether_seal': {
      const validUnitIds = Object.values(state.value.units)
        .filter((u) => u.side !== side)
        .map((u) => u.id)
      ui.startUseItemTargetUnit(itemId, validUnitIds)
      break
    }
    case 'item_soul_detach_needle': {
      const validUnitIds = Object.values(state.value.units)
        .filter((u) => u.side !== side && !!u.enchant)
        .map((u) => u.id)
      ui.startUseItemTargetUnit(itemId, validUnitIds)
      break
    }
    default: {
      const item = getItemCard(itemId)
      ui.setPendingConfirm({
        action: { type: 'USE_ITEM_FROM_HAND', itemId } as any,
        title: item?.name ?? itemId,
        detail: item?.text ?? '',
      })
    }
  }
}

function getItemName(id: string) { return getItemCard(id)?.name ?? id }

type TabKey = 'souls' | 'items'
const activeTab = ref<TabKey>('souls')
const handCollapsed = ref(localStorage.getItem('v2_hand_collapsed') === '1')
watch(handCollapsed, (v) => localStorage.setItem('v2_hand_collapsed', v ? '1' : '0'))

// ── Expose for parent (optional) ───────────────────────────────────────────────
defineExpose({ selectedSoulId })
</script>

<template>
  <div class="handPanel" :class="{ 'handPanel--collapsed': handCollapsed }">
    <!-- Tab header -->
    <div class="handTabs">
      <button
        class="handTab"
        :class="{ active: activeTab === 'souls' && !handCollapsed }"
        @click="activeTab = 'souls'; handCollapsed = false"
      >
        🃏 靈魂 <span class="cnt">{{ handSoulCards.length }}/5</span>
      </button>
      <button
        class="handTab"
        :class="{ active: activeTab === 'items' && !handCollapsed }"
        @click="activeTab = 'items'; handCollapsed = false"
      >
        🎒 道具 <span class="cnt">{{ handItemIds.length }}/3</span>
      </button>
      <div class="tabSpacer" />
      <button class="collapseBtn" @click="handCollapsed = !handCollapsed" :title="handCollapsed ? '展開手牌' : '收合手牌'">
        {{ handCollapsed ? '▲' : '▼' }}
      </button>
    </div>

    <!-- Content -->
    <Transition name="hand-slide">
    <div v-if="!handCollapsed" class="handContent">
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
    </div>
    </Transition>
  </div>
</template>

<style scoped>
.handPanel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.handTabs {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  gap: 2px;
  flex-shrink: 0;
}

.handTab {
  padding: 4px 12px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 7px;
  color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.02);
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  white-space: nowrap;
}
.handTab.active {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.18);
  color: rgba(255, 255, 255, 0.88);
}
.handTab:hover:not(.active) {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.65);
}

.cnt {
  font-size: 0.5625rem;
  opacity: 0.6;
  margin-left: 3px;
}

.tabSpacer { flex: 1; }

.collapseBtn {
  width: 24px;
  height: 24px;
  padding: 0;
  font-size: 0.5625rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.45);
  cursor: pointer;
  transition: background 0.15s;
}
.collapseBtn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}

.handContent {
  overflow-x: auto;
  padding: 4px 8px 6px;
  min-height: 0;
}

.hand-slide-enter-active {
  transition: max-height 0.22s ease, opacity 0.15s ease;
  overflow: hidden;
}
.hand-slide-leave-active {
  transition: max-height 0.18s ease, opacity 0.12s ease;
  overflow: hidden;
}
.hand-slide-enter-from,
.hand-slide-leave-to {
  max-height: 0;
  opacity: 0;
}
.hand-slide-enter-to,
.hand-slide-leave-from {
  max-height: 320px;
  opacity: 1;
}
</style>

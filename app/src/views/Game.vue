<script lang="ts">
export default {
  name: 'Game',
}
</script>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  canBuySoulFromDeck,
  canBuySoulFromDisplay,
  canBuySoulFromEnemyGraveyard,
  canBuyItemFromDisplay,
  canDiscardItemFromHand,
  canReturnSoulToDeckBottom,
  canEnchant,
  canBloodRitual,
  canRevive,
  createInitialState,
  getItemCard,
  getSoulCard,
  reduce,
  type GameState,
  type Pos,
  type PieceBase,
} from '../engine'
import BoardGrid from '../components/BoardGrid.vue'
import TopBar from '../components/TopBar.vue'
import ShopModal from '../components/ShopModal.vue'
import ConfirmModal from '../components/ConfirmModal.vue'
import CardDetailModal from '../components/CardDetailModal.vue'
import ShootPreviewModal from '../components/ShootPreviewModal.vue'
import AllUnitsModal from '../components/AllUnitsModal.vue'
import HandBar from '../components/HandBar.vue'
import SidePanel from '../components/SidePanel.vue'
import { useCardDetailModal } from '../useCardDetailModal'
import { usePendingConfirm } from '../usePendingConfirm'
import { useSelection } from '../useSelection'
import { useShootPreview } from '../useShootPreview'
import { useUiStore } from '../stores/ui'

const state = ref<GameState>(createInitialState())
const lastError = ref<string | null>(null)
const lastEvents = ref<string[]>([])

const router = useRouter()

const ui = useUiStore()

const shopOpen = computed(() => ui.shopOpen)
function openShop() {
  ui.openShop()
}
function closeShop() {
  ui.closeShop()
}

const allUnitsOpen = computed(() => ui.allUnitsOpen)

const currentSide = computed(() => state.value.turn.side)
const currentPhase = computed(() => state.value.turn.phase)

const winnerSide = computed(() => {
  const hasRedKing = Object.values(state.value.units).some((u) => u.side === 'red' && u.base === 'king')
  const hasBlackKing = Object.values(state.value.units).some((u) => u.side === 'black' && u.base === 'king')
  if (!hasRedKing && hasBlackKing) return 'black'
  if (!hasBlackKing && hasRedKing) return 'red'
  if (!hasRedKing && !hasBlackKing) return 'unknown'
  return null
})

watch(
  winnerSide,
  (w) => {
    if (!w) return
    router.push({ name: 'gameOver', query: { winner: w } })
  },
  { immediate: true },
)

watch(
  () => state.value.turn.phase,
  (phase, prev) => {
    if (phase === 'buy' && prev !== 'buy') ui.openShop()
  },
)

const {
  pending,
  pendingImage,
  pendingGuard,
  setPending,
  clearPending,
  confirmPending: confirmPendingFromComposable,
} = usePendingConfirm({ getState: () => state.value })

const {
  selectedUnitId,
  selectedCell,
  selectedUnit,
  legalMoves,
  shootableTargetIds,
  selectedCellUnit,
  selectedCellCorpses,
  onSelectUnit,
  onCellClick: onCellClickSelection,
} = useSelection({ getState: () => state.value })

const {
  shootPreview,
  openShootPreview,
  closeShootPreview,
  attacker: shootPreviewAttacker,
  target: shootPreviewTarget,
  guard: shootPreviewGuard,
  info: shootPreviewInfo,
  confirm: confirmShootPreviewFromComposable,
} = useShootPreview({ getState: () => state.value })

const turnTintClass = computed(() => (currentSide.value === 'red' ? 'turn-red' : 'turn-green'))

const resources = computed(() => state.value.resources)
const handItems = computed(() => state.value.hands[state.value.turn.side].items)

const selectedSoulId = ref<string>('')
const detailSoulId = ref<string | null>(null)

const handSoulCards = computed(() =>
  state.value.hands[state.value.turn.side].souls.map((id) => getSoulCard(id)).filter((c): c is NonNullable<typeof c> => !!c),
)

const shopBases = computed<PieceBase[]>(() => {
  const bases: PieceBase[] = ['king', 'advisor', 'elephant', 'rook', 'knight', 'cannon', 'soldier']
  return bases.filter((b) => {
    const deck = state.value.soulDeckByBase[b]
    const display = state.value.displayByBase[b]
    return (deck && deck.length > 0) || display != null
  })
})

const buyDisplayGuards = computed(() => {
  const out: Partial<Record<PieceBase, ReturnType<typeof canBuySoulFromDisplay>>> = {}
  for (const b of shopBases.value) out[b] = canBuySoulFromDisplay(state.value, b)
  return out
})

const buyDeckGuards = computed(() => {
  const out: Partial<Record<PieceBase, ReturnType<typeof canBuySoulFromDeck>>> = {}
  for (const b of shopBases.value) out[b] = canBuySoulFromDeck(state.value, b)
  return out
})

const buyEnemyGraveGuard = computed(() => canBuySoulFromEnemyGraveyard(state.value))

const enemySide = computed(() => (state.value.turn.side === 'red' ? 'black' : 'red'))
const enemyGraveTop = computed(() => state.value.graveyard[enemySide.value][0] ?? null)

const kingHp = computed(() => {
  const redKing = Object.values(state.value.units).find((u) => u.side === 'red' && u.base === 'king')
  const blackKing = Object.values(state.value.units).find((u) => u.side === 'black' && u.base === 'king')
  return {
    red: redKing?.hpCurrent ?? null,
    black: blackKing?.hpCurrent ?? null,
  }
})


const selectedEnchantSoul = computed(() => {
  const soulId = selectedUnit.value?.enchant?.soulId
  if (!soulId) return null
  const c = getSoulCard(soulId)
  if (!c) return null
  return {
    id: c.id,
    name: c.name,
    image: c.image || undefined,
  }
})

type UnitRow = { id: string; side: 'red' | 'black'; base: PieceBase; hpCurrent: number; name: string; image?: string }

function toUnitRow(u: GameState['units'][string]): UnitRow {
  const soul = u.enchant?.soulId ? getSoulCard(u.enchant.soulId) : null
  return {
    id: u.id,
    side: u.side,
    base: u.base,
    hpCurrent: u.hpCurrent,
    name: soul?.name ?? u.base,
    image: soul?.image || undefined,
  }
}

const myUnitRows = computed(() => {
  const side = state.value.turn.side
  const out: UnitRow[] = []
  for (const u of Object.values(state.value.units)) {
    if (u.side !== side) continue
    out.push(toUnitRow(u))
  }
  out.sort((a, b) => a.id.localeCompare(b.id))
  return out
})

const enemyUnitRows = computed(() => {
  const enemy = state.value.turn.side === 'red' ? 'black' : 'red'
  const out: UnitRow[] = []
  for (const u of Object.values(state.value.units)) {
    if (u.side !== enemy) continue
    out.push(toUnitRow(u))
  }
  out.sort((a, b) => a.id.localeCompare(b.id))
  return out
})

const enchantGuard = computed(() => {
  if (!selectedUnit.value) return { ok: false as const, reason: 'Select a unit' }
  if (!selectedSoulId.value) return { ok: false as const, reason: 'Select a soul card' }
  return canEnchant(state.value, selectedUnit.value.id, selectedSoulId.value)
})

const enchantMode = computed(() => ui.interactionMode.kind === 'enchant_select_unit')
const enchantModeSoulId = computed(() => (ui.interactionMode.kind === 'enchant_select_unit' ? ui.interactionMode.soulId : null))

const enchantModeSoulName = computed(() => {
  const id = enchantModeSoulId.value
  if (!id) return null
  return getSoulCard(id)?.name ?? id
})

const enchantableUnitIds = computed(() => {
  if (state.value.turn.phase !== 'necro') return []
  if (ui.interactionMode.kind !== 'enchant_select_unit') return []
  const soulId = ui.interactionMode.soulId
  const out: string[] = []
  for (const u of Object.values(state.value.units)) {
    if (u.side !== state.value.turn.side) continue
    const g = canEnchant(state.value, u.id, soulId)
    if (g.ok) out.push(u.id)
  }
  return out
})

const canStartEnchantMode = computed(() => {
  if (state.value.turn.phase !== 'necro') return { ok: false as const, reason: 'Not in necro phase' }
  if (!selectedSoulId.value) return { ok: false as const, reason: 'Select a soul card' }
  for (const u of Object.values(state.value.units)) {
    if (u.side !== state.value.turn.side) continue
    const g = canEnchant(state.value, u.id, selectedSoulId.value)
    if (g.ok) return { ok: true as const }
  }
  return { ok: false as const, reason: 'No valid unit to enchant' }
})

function cancelEnchantMode() {
  ui.clearInteractionMode()
}

onMounted(() => {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && ui.interactionMode.kind !== 'idle') {
      ui.clearInteractionMode()
    }
  }
  window.addEventListener('keydown', onKeyDown)
  onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
})

const soulReturnGuards = computed(() => {
  const out: Partial<Record<string, ReturnType<typeof canReturnSoulToDeckBottom>>> = {}
  for (const c of handSoulCards.value) out[c.id] = canReturnSoulToDeckBottom(state.value, c.id)
  return out
})


function buyFromDisplay(base: PieceBase) {
  dispatch({ type: 'BUY_SOUL_FROM_DISPLAY', base })
}

function buyFromDeck(base: PieceBase) {
  dispatch({ type: 'BUY_SOUL_FROM_DECK', base })
}

function buyFromEnemyGraveyard() {
  dispatch({ type: 'BUY_SOUL_FROM_ENEMY_GRAVEYARD' })
}

const buyItemGuards = computed(() => {
  return [0, 1, 2].map((slot) => canBuyItemFromDisplay(state.value, slot))
})

const discardItemGuards = computed(() => {
  const out: Partial<Record<string, ReturnType<typeof canDiscardItemFromHand>>> = {}
  for (const id of handItems.value) out[id] = canDiscardItemFromHand(state.value, id)
  return out
})

function getItemName(id: string): string {
  return getItemCard(id)?.name ?? id
}

function buyItem(slot: number) {
  dispatch({ type: 'BUY_ITEM_FROM_DISPLAY', slot })
}

function discardItem(itemId: string) {
  dispatch({ type: 'DISCARD_ITEM_FROM_HAND', itemId })
}

const { detailModal, closeDetail, runDetailAction, showSoulDetail, showItemDetail, showEnemyGraveTopDetail } =
  useCardDetailModal({
    getState: () => state.value,
    getEnemyGraveTop: () => enemyGraveTop.value,
    getBuyEnemyGraveGuard: () => buyEnemyGraveGuard.value,
    getBuyEnemyGraveGoldCost: () => state.value.rules.buySoulFromEnemyGraveyardGoldCost,
    buyFromEnemyGraveyard: () => buyFromEnemyGraveyard(),
  })

function showUnitDetail(unitId: string) {
  const u = state.value.units[unitId]
  if (!u) return
  const soulId = u.enchant?.soulId
  const soul = soulId ? getSoulCard(soulId) : null
  ui.openDetailModal({
    title: soul?.name ?? unitId,
    image: soul?.image || null,
    actionLabel: null,
    actionDisabled: false,
    actionTitle: '',
    detail: [
      `unitId: ${u.id}`,
      `side: ${u.side}`,
      `base: ${u.base}`,
      `pos: (${u.pos.x},${u.pos.y})`,
      `hp: ${u.hpCurrent}`,
      `atk: ${u.atk.key} ${u.atk.value}`,
      `def: ${u.def.map((d) => `${d.key} ${d.value}`).join(' / ')}`,
      `enchant: ${soulId ?? '-'}`,
      soul?.text ? `\ntext: ${soul.text}` : '',
    ].join('\n'),
  })
}


const reviveGuard = computed(() => {
  if (!selectedCell.value) return { ok: false as const, reason: 'Select a cell' }
  return canRevive(state.value, selectedCell.value)
})

function reviveAt(pos: Pos) {
  dispatch({ type: 'REVIVE', pos: { ...pos } })
}

const bloodRitualGuard = computed(() => {
  return canBloodRitual(state.value)
})

function bloodRitual() {
  const side = state.value.turn.side
  const king = Object.values(state.value.units).find((u) => u.side === side && u.base === 'king')
  const before = king?.hpCurrent ?? null
  const after = before != null ? before - 3 : null
  setPending({
    action: { type: 'BLOOD_RITUAL' },
    title: 'Confirm Blood Ritual',
    detail: [`King HP: ${before ?? '-'} -> ${after ?? '-'}`, 'Effect: Necro actions +1 (this turn)'].join('\n'),
  })
}

function openAllUnits() {
  ui.openAllUnits()
}

function closeAllUnits() {
  ui.closeAllUnits()
}


function dispatch(action: Parameters<typeof reduce>[1]) {
  const res = reduce(state.value, action)
  if (res.ok === false) {
    lastError.value = res.error
    return
  }
  lastError.value = null
  state.value = res.state
  lastEvents.value = res.events.map((e) => JSON.stringify(e))
}

function onEnchantDrop(payload: { unitId: string; soulId: string }) {
  if (state.value.turn.phase !== 'necro') return
  const unit = state.value.units[payload.unitId]
  const card = getSoulCard(payload.soulId)
  if (!unit || !card) return
  if (unit.side !== state.value.turn.side) return

  setPending({
    action: { type: 'ENCHANT', unitId: unit.id, soulId: card.id },
    title: 'Confirm Enchant',
    detail: [`${card.name} -> ${unit.id}`, `base: ${card.base}`, `cost: ${card.costGold}G`].join('\n'),
  })
}

function onCellClick(payload: { x: number; y: number; unitId: string | null }) {
  if (ui.interactionMode.kind === 'enchant_select_unit') {
    ui.setSelectedCell({ x: payload.x, y: payload.y })
    const unitId = payload.unitId
    const soulId = ui.interactionMode.soulId
    if (unitId && enchantableUnitIds.value.includes(unitId)) {
      const card = getSoulCard(soulId)
      setPending({
        action: { type: 'ENCHANT', unitId, soulId },
        title: 'Confirm Enchant',
        detail: [`${card?.name ?? soulId} -> ${unitId}`, `base: ${card?.base ?? '-'}`, `cost: ${card?.costGold ?? '-'}G`].join('\n'),
      })
      ui.clearInteractionMode()
      return
    }
    return
  }

  const prevSelectedUnit = selectedUnit.value

  onCellClickSelection(payload, (enemyUnitId: string) => {
    if (!prevSelectedUnit) return
    openShootPreview(prevSelectedUnit.id, enemyUnitId)
  })

  if (state.value.turn.phase !== 'combat') return
  if (payload.unitId) return
  if (!prevSelectedUnit) return
  if (!legalMoves.value.some((p) => p.x === payload.x && p.y === payload.y)) return

  setPending({
    action: { type: 'MOVE', unitId: prevSelectedUnit.id, to: { x: payload.x, y: payload.y } },
    title: 'Confirm Move',
    detail: `${prevSelectedUnit.id} -> (${payload.x},${payload.y})`,
  })
}

function confirmPending() {
  confirmPendingFromComposable((a) => dispatch(a))
}

function cancelPending() {
  clearPending()
}

function confirmShootPreview() {
  confirmShootPreviewFromComposable((a) => dispatch(a))
}

function onCardDetailAction() {
  if (detailModal.value.actionLabel === 'Enchant') {
    const soulId = detailSoulId.value
    if (!soulId) return
    if (!canStartEnchantMode.value.ok) return
    ui.startEnchantSelectUnit(soulId)
    closeDetail()
    return
  }
  runDetailAction()
}

function enchantSelected() {
  if (state.value.turn.phase !== 'necro') return
  if (!selectedUnit.value) return
  if (selectedUnit.value.side !== state.value.turn.side) return
  if (!selectedSoulId.value) return
  dispatch({ type: 'ENCHANT', unitId: selectedUnit.value.id, soulId: selectedSoulId.value })
}

function returnSoulToDeckBottom(soulId: string) {
  dispatch({ type: 'RETURN_SOUL_TO_DECK_BOTTOM', soulId })
}

function selectSoul(id: string) {
  selectedSoulId.value = id
  detailSoulId.value = id
  showSoulDetail(id)
  if (state.value.turn.phase === 'necro') {
    ui.openDetailModal({
      title: ui.detailModal.title,
      detail: ui.detailModal.detail,
      image: ui.detailModal.image,
      actionLabel: 'Enchant',
      actionDisabled: !canStartEnchantMode.value.ok,
      actionTitle: canStartEnchantMode.value.ok ? '' : canStartEnchantMode.value.reason,
    })
  }
}

function onSoulDragStart(e: DragEvent, soulId: string) {
  selectedSoulId.value = soulId
  detailSoulId.value = soulId
  e.dataTransfer?.setData('application/x-soul-id', soulId)
  e.dataTransfer?.setData('text/plain', soulId)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy'

  if (state.value.turn.phase === 'necro') {
    ui.startEnchantSelectUnit(soulId)
  }
}

function onSoulDragEnd() {
  if (ui.interactionMode.kind === 'enchant_select_unit') ui.clearInteractionMode()
}

function nextPhase() {
  dispatch({ type: 'NEXT_PHASE' })
}

</script>

<template>
  <div class="page" :class="turnTintClass">
    <TopBar
      title="webChese"
      :current-side="currentSide"
      :current-phase="currentPhase"
      :king-hp="kingHp"
      :resources="resources"
      @next-phase="nextPhase"
      @open-units="openAllUnits"
      @open-shop="openShop"
    />

    <div v-if="enchantMode" class="actionStatusBar">
      <div class="mono">Selecting unit to enchant: {{ enchantModeSoulName ?? '-' }}</div>
      <button type="button" @click="cancelEnchantMode">Cancel (Esc)</button>
    </div>

    <main class="main">
      <section class="boardArea">
        <BoardGrid
          :state="state"
          :selected-unit-id="selectedUnitId"
          :legal-moves="legalMoves"
          :shootable-target-ids="shootableTargetIds"
          :highlight-unit-ids="enchantableUnitIds"
          :enchant-drag-soul-id="ui.interactionMode.kind === 'enchant_select_unit' ? ui.interactionMode.soulId : null"
          @select-unit="onSelectUnit"
          @cell-click="onCellClick"
          @enchant-drop="onEnchantDrop"
        />

        <div v-if="lastError" class="error">{{ lastError }}</div>

        <HandBar
          :phase="state.turn.phase"
          :soul-cards="handSoulCards"
          :selected-soul-id="selectedSoulId"
          :selected-unit="selectedUnit ? { id: selectedUnit.id, side: selectedUnit.side, base: selectedUnit.base } : null"
          :enchant-guard="enchantGuard"
          :return-guards="soulReturnGuards"
          :items="handItems"
          :discard-guards="discardItemGuards"
          :get-item-name="getItemName"
          :get-item="getItemCard"
          @select-soul="selectSoul"
          @dragstart-soul="onSoulDragStart"
          @dragend-soul="onSoulDragEnd"
          @enchant="enchantSelected"
          @return-soul="returnSoulToDeckBottom"
          @discard-item="discardItem"
          @show-item-detail="showItemDetail"
        />
      </section>

      <aside class="sidePanel">
        <SidePanel
          :phase="state.turn.phase"
          :selected-unit="selectedUnit"
          :selected-enchant-soul="selectedEnchantSoul"
          :selected-cell="selectedCell"
          :selected-cell-unit="selectedCellUnit"
          :selected-cell-corpses="selectedCellCorpses"
          :revive-guard="reviveGuard"
          :graveyard-red="state.graveyard.red"
          :graveyard-black="state.graveyard.black"
          :blood-ritual-guard="bloodRitualGuard"
          :last-events="lastEvents"
          @show-soul-detail="showSoulDetail"
          @revive="reviveAt"
          @blood-ritual="bloodRitual"
        />
      </aside>
    </main>

    <ConfirmModal
      :open="!!pending"
      :title="pending?.title ?? ''"
      :detail="pending?.detail ?? ''"
      :image="pendingImage"
      :guard="pending ? pendingGuard : null"
      @confirm="confirmPending"
      @cancel="cancelPending"
    />

    <ShootPreviewModal
      :open="!!shootPreview"
      :attacker="shootPreviewAttacker"
      :target="shootPreviewTarget"
      :guard="shootPreviewGuard"
      :raw-damage="shootPreviewInfo?.rawDamage ?? null"
      :damage-to-target="shootPreviewInfo?.damageToTarget ?? null"
      :shared="shootPreviewInfo?.shared ?? null"
      :effects="shootPreviewInfo?.effects ?? []"
      @confirm="confirmShootPreview"
      @cancel="closeShootPreview"
    />

    <AllUnitsModal
      :open="allUnitsOpen"
      :my-title="`My units (${currentSide})`"
      :enemy-title="`Enemy units (${enemySide})`"
      :my-units="myUnitRows"
      :enemy-units="enemyUnitRows"
      @close="closeAllUnits"
      @show-unit-detail="showUnitDetail"
    />

    <CardDetailModal
      :open="detailModal.open"
      :title="detailModal.title"
      :detail="detailModal.detail"
      :image="detailModal.image"
      :action-label="detailModal.actionLabel ?? null"
      :action-disabled="detailModal.actionDisabled ?? false"
      :action-title="detailModal.actionTitle ?? ''"
      @close="closeDetail"
      @action="onCardDetailAction"
    />

    <ShopModal
      :open="shopOpen"
      :phase="state.turn.phase"
      :shop-bases="shopBases"
      :display-by-base="state.displayByBase"
      :soul-deck-by-base="state.soulDeckByBase"
      :buy-display-guards="buyDisplayGuards"
      :buy-deck-guards="buyDeckGuards"
      :item-display="state.itemDisplay"
      :buy-item-guards="buyItemGuards"
      :item-deck-count="state.itemDeck.length"
      :enemy-grave-top="enemyGraveTop"
      :buy-enemy-grave-guard="buyEnemyGraveGuard"
      :buy-soul-from-deck-gold-cost="state.rules.buySoulFromDeckGoldCost"
      :buy-soul-from-display-gold-cost="state.rules.buySoulFromDisplayGoldCost"
      :buy-soul-from-enemy-graveyard-gold-cost="state.rules.buySoulFromEnemyGraveyardGoldCost"
      @close="closeShop"
      @buy-display="buyFromDisplay"
      @buy-deck="buyFromDeck"
      @buy-item="buyItem"
      @buy-enemy-graveyard="buyFromEnemyGraveyard"
      @show-soul-detail="showSoulDetail"
      @show-item-detail="showItemDetail"
      @show-enemy-grave-top-detail="showEnemyGraveTopDetail"
    />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.page.turn-red {
  background: linear-gradient(180deg, rgba(255, 77, 79, 0.06) 0%, rgba(0, 0, 0, 0) 45%);
}

.page.turn-green {
  background: linear-gradient(180deg, rgba(82, 196, 26, 0.06) 0%, rgba(0, 0, 0, 0) 45%);
}

.main {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 16px;
  align-items: start;
}

.boardArea {
  min-width: 0;
  padding-bottom: 220px;
}

.sidePanel {
  position: sticky;
  top: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.12);
  border-radius: 10px;
  padding: 12px;
}

.unitCard {
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.18);
}

.enchantRow {
  display: none;
}

.corpseList {
  margin-top: 6px;
  max-height: 140px;
  overflow: auto;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 6px;
}

.corpseRow {
  font-size: 12px;
  opacity: 0.9;
}

.muted {
  opacity: 0.75;
}

.error {
  margin: 12px 0;
  padding: 8px;
  border: 1px solid #ff4d4f;
  color: #ff4d4f;
}

.events {
  padding: 8px;
  border: 1px solid #ddd;
  background: #fafafa;
  color: #111;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 12px;
  min-height: 80px;
  overflow: auto;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}
</style>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  createInitialState,
  getLegalMoves,
  getShootableTargetIds,
  getSoulCard,
  reduce,
  type Action,
  type GameState,
  type Pos,
} from './engine'
import BoardGrid from './components/BoardGrid.vue'

const state = ref<GameState>(createInitialState())
const lastError = ref<string | null>(null)
const lastEvents = ref<string[]>([])
const selectedUnitId = ref<string | null>(null)

const currentSide = computed(() => state.value.turn.side)
const currentPhase = computed(() => state.value.turn.phase)

const resources = computed(() => state.value.resources)
const handSouls = computed(() => state.value.hands[state.value.turn.side].souls)

const selectedSoulId = ref<string>('')

const handSoulCards = computed(() =>
  handSouls.value.map((id) => getSoulCard(id)).filter((c): c is NonNullable<typeof c> => !!c),
)

const selectedSoulCard = computed(() => (selectedSoulId.value ? getSoulCard(selectedSoulId.value) : undefined))

const debugUnits = computed(() =>
  Object.values(state.value.units)
    .map((u) => ({ id: u.id, side: u.side, base: u.base, x: u.pos.x, y: u.pos.y, hp: u.hpCurrent }))
    .sort((a, b) => a.id.localeCompare(b.id)),
)

const legalMoves = computed<Pos[]>(() => {
  if (!selectedUnitId.value) return []
  const unit = state.value.units[selectedUnitId.value]
  if (!unit) return []
  if (unit.side !== state.value.turn.side) return []
  if (state.value.turn.phase !== 'combat') return []
  return getLegalMoves(state.value, unit.id)
})

const shootableTargetIds = computed<string[]>(() => {
  if (!selectedUnitId.value) return []
  const unit = state.value.units[selectedUnitId.value]
  if (!unit) return []
  if (unit.side !== state.value.turn.side) return []
  if (state.value.turn.phase !== 'combat') return []
  return getShootableTargetIds(state.value, unit.id)
})

const selectedUnit = computed(() => {
  if (!selectedUnitId.value) return null
  return state.value.units[selectedUnitId.value] ?? null
})

type Pending = {
  action: Action
  title: string
  detail: string
} | null

const pending = ref<Pending>(null)

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
  // Drag/drop enchant flow: validate in UI minimally, then confirm.
  if (state.value.turn.phase !== 'necro') return
  const unit = state.value.units[payload.unitId]
  const card = getSoulCard(payload.soulId)
  if (!unit || !card) return
  if (unit.side !== state.value.turn.side) return

  pending.value = {
    action: { type: 'ENCHANT', unitId: unit.id, soulId: card.id },
    title: 'Confirm Enchant',
    detail: `${card.name} -> ${unit.id}`,
  }
}

function onSelectUnit(unitId: string | null) {
  if (!unitId) {
    selectedUnitId.value = null
    return
  }
  const unit = state.value.units[unitId]
  if (!unit) return
  selectedUnitId.value = unitId
}

function onCellClick(payload: { x: number; y: number; unitId: string | null }) {
  if (state.value.turn.phase !== 'combat') return

  if (payload.unitId) {
    const clicked = state.value.units[payload.unitId]
    if (!clicked) return

    if (clicked.side === state.value.turn.side) {
      onSelectUnit(clicked.id)
      return
    }

    // enemy clicked: treat as SHOOT (requires selected attacker)
    if (!selectedUnit.value) return
    if (selectedUnit.value.side !== state.value.turn.side) return

    pending.value = {
      action: { type: 'SHOOT', attackerId: selectedUnit.value.id, targetUnitId: clicked.id },
      title: 'Confirm Shoot',
      detail: `${selectedUnit.value.id} -> ${clicked.id}`,
    }
    return
  }

  // empty cell clicked: treat as MOVE
  if (!selectedUnit.value) return
  if (!legalMoves.value.some((p) => p.x === payload.x && p.y === payload.y)) return

  pending.value = {
    action: { type: 'MOVE', unitId: selectedUnit.value.id, to: { x: payload.x, y: payload.y } },
    title: 'Confirm Move',
    detail: `${selectedUnit.value.id} -> (${payload.x},${payload.y})`,
  }
}

function confirmPending() {
  if (!pending.value) return
  const a = pending.value.action
  pending.value = null
  dispatch(a)
}

function cancelPending() {
  pending.value = null
}

function enchantSelected() {
  if (state.value.turn.phase !== 'necro') return
  if (!selectedUnit.value) return
  if (selectedUnit.value.side !== state.value.turn.side) return
  if (!selectedSoulId.value) return
  dispatch({ type: 'ENCHANT', unitId: selectedUnit.value.id, soulId: selectedSoulId.value })
}

function selectSoul(id: string) {
  selectedSoulId.value = id
}

function onSoulDragStart(e: DragEvent, soulId: string) {
  selectedSoulId.value = soulId
  e.dataTransfer?.setData('application/x-soul-id', soulId)
  e.dataTransfer?.setData('text/plain', soulId)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy'
}

function nextPhase() {
  selectedUnitId.value = null
  dispatch({ type: 'NEXT_PHASE' })
}
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div class="title">webChese</div>
      <div class="statusCenter">
        <div class="statusLine">Side: <span class="mono">{{ currentSide }}</span></div>
        <div class="statusLine">Phase: <span class="mono">{{ currentPhase }}</span></div>
        <div class="mono statusLine">red G{{ resources.red.gold }} M{{ resources.red.mana }} S{{ resources.red.storageMana }}</div>
        <div class="mono statusLine">black G{{ resources.black.gold }} M{{ resources.black.mana }} S{{ resources.black.storageMana }}</div>
      </div>
      <div class="actions">
        <button type="button" @click="nextPhase">Next phase</button>
      </div>
    </header>

    <main class="main">
      <section class="boardArea">
        <BoardGrid
          :state="state"
          :selected-unit-id="selectedUnitId"
          :legal-moves="legalMoves"
          :shootable-target-ids="shootableTargetIds"
          @select-unit="onSelectUnit"
          @cell-click="onCellClick"
          @enchant-drop="onEnchantDrop"
        />

        <div v-if="lastError" class="error">{{ lastError }}</div>

        <h2>Last events</h2>
        <pre class="events">{{ lastEvents.join('\n') }}</pre>
      </section>

      <aside class="sidePanel">
        <h2>Unit</h2>
        <div v-if="selectedUnit" class="unitCard">
          <div class="mono">id: {{ selectedUnit.id }}</div>
          <div class="mono">side: {{ selectedUnit.side }}</div>
          <div class="mono">base: {{ selectedUnit.base }}</div>
          <div class="mono">pos: ({{ selectedUnit.pos.x }},{{ selectedUnit.pos.y }})</div>
          <div class="mono">hp: {{ selectedUnit.hpCurrent }}</div>
          <div class="mono">atk: {{ selectedUnit.atk.key }} {{ selectedUnit.atk.value }}</div>
          <div class="mono">def: {{ selectedUnit.def.map((d) => `${d.key} ${d.value}`).join(' / ') }}</div>
          <div class="mono">soul: {{ selectedUnit.enchant?.soulId ?? '-' }}</div>
        </div>
        <div v-else class="muted">Select a unit on the board.</div>

        <h2>Souls</h2>
        <div class="unitCard">
          <div class="muted">
            Drag a soul onto a unit (necro phase). Or click to select and use button.
          </div>
          <div class="soulGrid">
            <button
              v-for="c in handSoulCards"
              :key="c.id"
              type="button"
              class="soulBtn"
              :class="{ selected: selectedSoulId === c.id, disabled: selectedUnit && c.base !== selectedUnit.base }"
              draggable="true"
              @dragstart="onSoulDragStart($event, c.id)"
              @click="selectSoul(c.id)"
            >
              <div class="soulTop">
                <div class="soulName">{{ c.name }}</div>
                <div class="mono soulMeta">{{ c.base }} | cost {{ c.costGold }}</div>
              </div>
              <div class="mono soulStats">
                hp {{ c.stats.hp }} | atk {{ c.stats.atk.key }} {{ c.stats.atk.value }} | def
                {{ c.stats.def.map((d) => `${d.key} ${d.value}`).join(' / ') }}
              </div>
              <div class="soulText">{{ c.text ?? '' }}</div>
            </button>
          </div>

          <div class="enchantRow">
            <button
              type="button"
              :disabled="
                !selectedUnit ||
                !selectedSoulCard ||
                selectedSoulCard.base !== selectedUnit.base ||
                state.turn.phase !== 'necro'
              "
              @click="enchantSelected"
            >
              Enchant selected unit
            </button>
          </div>
        </div>

        <h2>Debug</h2>
        <pre class="events">{{ JSON.stringify({ turn: state.turn, selectedUnitId, units: debugUnits }, null, 2) }}</pre>
      </aside>
    </main>

    <div v-if="pending" class="modalOverlay" @click.self="cancelPending">
      <div class="modal">
        <div class="modalTitle">{{ pending.title }}</div>
        <div class="modalDetail mono">{{ pending.detail }}</div>
        <div class="modalBtns">
          <button type="button" @click="confirmPending">Confirm</button>
          <button type="button" @click="cancelPending">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.topbar {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
  align-items: start;
}

.title {
  font-size: 24px;
  font-weight: 700;
}

.status {
  display: grid;
  gap: 2px;
}

.statusCenter {
  display: grid;
  justify-items: center;
  gap: 2px;
}

.statusLine {
  text-align: center;
}

.actions {
  justify-self: end;
}

.main {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 16px;
  align-items: start;
}

.boardArea {
  min-width: 0;
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

.soulGrid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin-top: 8px;
}

.soulBtn {
  text-align: left;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.22);
  color: rgba(255, 255, 255, 0.92);
}

.soulBtn:hover {
  border-color: rgba(145, 202, 255, 0.55);
}

.soulBtn.selected {
  border-color: rgba(145, 202, 255, 0.95);
  background: rgba(145, 202, 255, 0.12);
}

.soulBtn.disabled {
  opacity: 0.5;
}

.soulTop {
  display: grid;
  gap: 2px;
  margin-bottom: 6px;
}

.soulName {
  font-weight: 700;
}

.soulMeta {
  opacity: 0.85;
  font-size: 12px;
}

.soulStats {
  font-size: 12px;
  opacity: 0.95;
  margin-bottom: 6px;
}

.soulText {
  font-size: 12px;
  line-height: 1.35;
  opacity: 0.85;
}

.enchantRow {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
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
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
    'Courier New', monospace;
  font-size: 12px;
  min-height: 80px;
  overflow: auto;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
    'Courier New', monospace;
}

.modalOverlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: grid;
  place-items: center;
  z-index: 50;
}

.modal {
  width: min(520px, calc(100vw - 24px));
  border-radius: 12px;
  background: #1f1f1f;
  border: 1px solid rgba(255, 255, 255, 0.12);
  padding: 12px;
}

.modalTitle {
  font-weight: 700;
  margin-bottom: 6px;
}

.modalDetail {
  opacity: 0.9;
  margin-bottom: 12px;
}

.modalBtns {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>

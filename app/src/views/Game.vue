<script lang="ts">
export default {
  name: 'Game',
}
</script>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { decideActions, type BotContext } from '../sim/balanceBot'
import { useGameSetup } from '../stores/gameSetup'
import {
  canBuySoulFromDeck,
  canBuySoulFromDisplay,
  canBuySoulFromEnemyGraveyard,
  canBuyItemFromDisplay,
  canDiscardItemFromHand,
  canUseItemFromHand,
  canReturnSoulToDeckBottom,
  canEnchant,
  canSacrifice,
  canBloodRitual,
  canRevive,
  createInitialState,
  getItemCard,
  getSoulCard,
  reduce,
  BASE_STATS,
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
import DebugMenuModal from '../components/DebugMenuModal.vue'
import EventLogModal from '../components/EventLogModal.vue'
import { useCardDetailModal } from '../useCardDetailModal'
import { usePendingConfirm } from '../usePendingConfirm'
import { useSelection } from '../useSelection'
import { useShootPreview } from '../useShootPreview'
import { useUiStore } from '../stores/ui'
import { countCorpses } from '../engine/corpses'

// ── NPC / Game setup ──────────────────────────────────────────────────────────
const setup = useGameSetup()

function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)) }

const state = ref<GameState>(createInitialState({
  rules: { firstSide: setup.resolvedFirstPlayer } as any,
}))
const lastError = ref<string | null>(null)
const lastEvents = ref<string[]>([])

type FloatText = { id: string; text: string; kind: 'damage' | 'heal' }
type BeamFx = { id: string; from: { x: number; y: number }; to: { x: number; y: number } }

const fxAttackUnitIds = ref<string[]>([])
const fxHitUnitIds = ref<string[]>([])
const fxKilledUnitIds = ref<string[]>([])
const fxAbilityUnitIds = ref<string[]>([])
const floatTextsByPos = ref<Record<string, FloatText[]>>({})
const fxBeams = ref<BeamFx[]>([])
const fxKilledPosKeys = ref<string[]>([])
const fxRevivedPosKeys = ref<string[]>([])
const fxEnchantedPosKeys = ref<string[]>([])

const debugOpen = ref(false)
const eventLogOpen = ref(false)

// ── Sidebar width toggle ───────────────────────────────────────────────────────
type SidebarSize = 'sm' | 'md' | 'lg'
const SIDEBAR_WIDTHS: Record<SidebarSize, number> = { sm: 220, md: 340, lg: 500 }
const SIDEBAR_LABELS: Record<SidebarSize, string> = { sm: '◀◀', md: '◀▶', lg: '▶▶' }
const sidebarSize = ref<SidebarSize>('lg')
function cycleSidebarWidth() {
  sidebarSize.value = sidebarSize.value === 'sm' ? 'md' : sidebarSize.value === 'md' ? 'lg' : 'sm'
}
const mainGridStyle = computed(() => ({ gridTemplateColumns: `1fr ${SIDEBAR_WIDTHS[sidebarSize.value]}px` }))

// ── Board scale toggle ─────────────────────────────────────────────────────────
type BoardScale = 50 | 75 | 100
const boardScale = ref<BoardScale>(100)
const BOARD_SCALE_LABELS: Record<BoardScale, string> = { 50: '50%', 75: '75%', 100: '100%' }
function cycleBoardScale() {
  boardScale.value = boardScale.value === 100 ? 75 : boardScale.value === 75 ? 50 : 100
}
const boardScaleStyle = computed(() =>
  boardScale.value === 100 ? {} : { zoom: boardScale.value / 100 }
)
const debugMatchSeed = ref<string>(state.value.rules.matchSeed)
const debugEnabledClans = ref<string[]>(state.value.rules.enabledClans)

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

// ── NPC computed & watcher ────────────────────────────────────────────────────
const npcSide = computed<'red' | 'black' | null>(() => {
  if (setup.mode !== 'pve') return null
  return setup.resolvedPlayerSide === 'red' ? 'black' : 'red'
})

const isNpcTurn = computed(() =>
  npcSide.value !== null && state.value.turn.side === npcSide.value,
)

const botRunning = ref(false)
let botSeed = Date.now()

type BotSpeedKey = '最慢' | '慢' | '正常' | '快' | '即時'
const botSpeedLabel = ref<BotSpeedKey>('正常')
const botDelays = computed((): { init: number; action: number } => {
  switch (botSpeedLabel.value) {
    case '最慢':  return { init: 1800, action: 1800 }
    case '慢':  return { init: 1000, action: 1000 }
    case '快':  return { init: 120, action: 60 }
    case '即時': return { init: 20,  action: 0 }
    default:    return { init: 350, action: 180 }
  }
})

watch(
  () => [state.value.turn.side, state.value.turn.phase] as const,
  async ([side, phase]) => {
    if (!npcSide.value || side !== npcSide.value || botRunning.value) return
    if (phase === 'turnStart') return  // engine auto-advances; no action needed
    botRunning.value = true
    await sleep(botDelays.value.init)

    const weightsMode = setup.difficulty === 'easy' ? 'base' : 'blend'
    const ctx: BotContext = { seed: botSeed++, epsilon: 0, weightsMode }
    const result = decideActions(state.value, side as 'red' | 'black', ctx)

    for (const action of result.actions) {
      dispatch(action)
      if (action.type !== 'NEXT_PHASE') await sleep(botDelays.value.action)
    }
    botRunning.value = false
  },
  { immediate: true },
)

// ── Phase change toast ────────────────────────────────────────────────────────
const phaseToastText = ref('')
const phaseToastVisible = ref(false)
let phaseToastTimer: ReturnType<typeof setTimeout> | null = null

function showPhaseToast(text: string) {
  phaseToastText.value = text
  phaseToastVisible.value = true
  if (phaseToastTimer) clearTimeout(phaseToastTimer)
  phaseToastTimer = setTimeout(() => {
    phaseToastVisible.value = false
  }, 1800)
}

watch(
  () => state.value.turn.phase,
  (phase, prev) => {
    if (phase === 'buy' && prev !== 'buy' && !isNpcTurn.value) ui.openShop()

    if (phase === 'combat') ui.setHandCollapsedOverride(true)
    else ui.setHandCollapsedOverride(null)

    ui.setSelectedUnitId(null)
    ui.setSelectedCell(null)
    ui.clearShootPreview()
    ui.clearInteractionMode()
    selectedSoulId.value = ''

    if (phase !== 'turnStart') {
      const phaseNames: Record<string, string> = {
        buy: '💰 購買階段',
        necro: '⚗️ 死靈術階段',
        combat: '⚔️ 戰鬥階段',
      }
      const text = phaseNames[phase]
      if (text) showPhaseToast(text)
    }
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

const shootExtraTargetUnitId = computed(() => shootPreview.value?.extraTargetUnitId ?? null)

const shootPreviewPierceMarks = computed(() => {
  const info = shootPreviewInfo.value
  if (!info) return {}
  const out: Record<string, number> = {}
  for (const e of info.effects) {
    if ((e as any).kind !== 'PIERCE') continue
    const ids = Array.isArray((e as any).targetUnitIds) ? ((e as any).targetUnitIds as string[]) : []
    for (let i = 1; i < ids.length; i++) {
      const id = ids[i]
      if (!id) continue
      const u = state.value.units[id]
      if (!u) continue
      out[`${u.pos.x},${u.pos.y}`] = i + 1
    }
  }
  return out
})

const shootPreviewSplashPosKeys = computed(() => {
  const info = shootPreviewInfo.value
  if (!info) return []
  const set = new Set<string>()
  for (const e of info.effects) {
    if ((e as any).kind !== 'SPLASH') continue
    const ids = Array.isArray((e as any).targetUnitIds) ? ((e as any).targetUnitIds as string[]) : []
    for (const id of ids) {
      if (!id) continue
      const u = state.value.units[id]
      if (!u) continue
      set.add(`${u.pos.x},${u.pos.y}`)
    }
  }
  return [...set]
})

const shootPreviewChainEligiblePosKeys = computed(() => {
  const set = new Set<string>()
  for (const id of shootChainEligibleEnemyIds.value) {
    const u = state.value.units[id]
    if (!u) continue
    set.add(`${u.pos.x},${u.pos.y}`)
  }
  return [...set]
})

const shootPreviewChainSelectedPosKey = computed(() => {
  const id = shootExtraTargetUnitId.value
  if (!id) return null
  const u = state.value.units[id]
  if (!u) return null
  return `${u.pos.x},${u.pos.y}`
})

const shootDetailsOpen = ref(false)

function openShootDetails() {
  shootDetailsOpen.value = true
}

function closeShootDetails() {
  shootDetailsOpen.value = false
}

function cancelShootPreview() {
  closeShootDetails()
  closeShootPreview()
}

const shootChainEligibleEnemyIds = computed(() => {
  if (!shootPreview.value) return []
  const attacker = state.value.units[shootPreview.value.attackerId]
  const target = state.value.units[shootPreview.value.targetUnitId]
  if (!attacker || !target) return []
  const soulId = attacker.enchant?.soulId
  if (!soulId) return []
  const card = getSoulCard(soulId)
  if (!card) return []
  const chain = card.abilities.find((a) => a.type === 'CHAIN')
  const radius0 = Number((chain as any)?.radius ?? 0)
  const sb = state.value.status.sacrificeBuffByUnitId?.[attacker.id] ?? null
  const radius = Number.isFinite(sb?.chainRadius as any) && Number((sb as any).chainRadius) > 0 ? Number((sb as any).chainRadius) : radius0

  const when = (chain as any)?.when
  if (when && !(Number.isFinite(sb?.chainRadius as any) && Number((sb as any).chainRadius) > 0) && String((when as any).type ?? '') === 'CORPSES_GTE') {
    const need = Number((when as any).count ?? 0)
    if (Number.isFinite(need) && need > 0) {
      const corpses = countCorpses(state.value, attacker.side)
      if (corpses < need) return []
    }
  }
  if (!(Number.isFinite(radius) && radius > 0)) return []
  const cheb = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
  const out: string[] = []
  for (const u of Object.values(state.value.units)) {
    if (u.side === attacker.side) continue
    if (u.id === target.id) continue
    if (cheb(u.pos, target.pos) <= radius) out.push(u.id)
  }
  out.sort((a, b) => a.localeCompare(b))
  return out
})

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
const enemyGraveyard = computed(() => state.value.graveyard[enemySide.value])
const darkMoonScopeActive = computed(() => state.value.turnFlags.darkMoonScopeActive ?? false)

const kingHp = computed(() => {
  const red = Object.values(state.value.units).find((u) => u.side === 'red' && u.base === 'king')?.hpCurrent ?? null
  const black = Object.values(state.value.units).find((u) => u.side === 'black' && u.base === 'king')?.hpCurrent ?? null
  return { red, black }
})

const necroActionsUsed = computed(() => state.value.turnFlags.necroActionsUsed ?? 0)
const necroActionsMax = computed(() => state.value.limits.necroActionsPerTurn + (state.value.turnFlags.necroBonusActions ?? 0))

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

const selectedUnitBaseImage = computed(() => {
  const base = selectedUnit.value?.base
  return base ? BASE_IMAGES[base] : undefined
})

const BASE_IMAGES: Partial<Record<PieceBase, string>> = {
  king:     '/assets/cards/base/king.jpg',
  advisor:  '/assets/cards/base/advisor.jpg',
  elephant: '/assets/cards/base/elephant.jpg',
  rook:     '/assets/cards/base/rook.jpg',
  knight:   '/assets/cards/base/knight.jpg',
  cannon:   '/assets/cards/base/cannon.jpg',
  soldier:  '/assets/cards/base/soldier.jpg',
}

type UnitRow = { id: string; side: 'red' | 'black'; base: PieceBase; hpCurrent: number; name: string; image?: string; pos: { x: number; y: number }; dead?: boolean }

function toUnitRow(u: GameState['units'][string]): UnitRow {
  const soul = u.enchant?.soulId ? getSoulCard(u.enchant.soulId) : null
  return {
    id: u.id,
    side: u.side,
    base: u.base,
    hpCurrent: u.hpCurrent,
    name: soul?.name ?? u.base,
    image: soul?.image || BASE_IMAGES[u.base] || undefined,
    pos: { ...u.pos },
  }
}

// 從 corpsesByPos 建立死亡單位列表（每個位置的頂部屍骸各一筆）
function deadUnitRowsForSide(side: 'red' | 'black'): UnitRow[] {
  const out: UnitRow[] = []
  for (const [posKey, stack] of Object.entries(state.value.corpsesByPos)) {
    for (let i = stack.length - 1; i >= 0; i--) {
      const corpse = stack[i]
      if (!corpse || corpse.ownerSide !== side) continue
      const [xs, ys] = posKey.split(',')
      const pos = { x: Number(xs), y: Number(ys) }
      out.push({
        id: `dead:${posKey}:${i}`,
        side,
        base: corpse.base,
        hpCurrent: 0,
        name: corpse.base,
        image: BASE_IMAGES[corpse.base],
        pos,
        dead: true,
      })
    }
  }
  return out
}

const myUnitRows = computed(() => {
  const side = state.value.turn.side
  const alive: UnitRow[] = []
  for (const u of Object.values(state.value.units)) {
    if (u.side !== side) continue
    alive.push(toUnitRow(u))
  }
  alive.sort((a, b) => a.id.localeCompare(b.id))
  return [...alive, ...deadUnitRowsForSide(side)]
})

const enemyUnitRows = computed(() => {
  const enemy = state.value.turn.side === 'red' ? 'black' : 'red'
  const alive: UnitRow[] = []
  for (const u of Object.values(state.value.units)) {
    if (u.side !== enemy) continue
    alive.push(toUnitRow(u))
  }
  alive.sort((a, b) => a.id.localeCompare(b.id))
  return [...alive, ...deadUnitRowsForSide(enemy)]
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

const sacrificeMode = computed(() => ui.interactionMode.kind === 'sacrifice_select_target')

const sacrificeSourceUnitId = computed(() => (ui.interactionMode.kind === 'sacrifice_select_target' ? ui.interactionMode.sourceUnitId : null))

const sacrificeRange = computed(() => (ui.interactionMode.kind === 'sacrifice_select_target' ? ui.interactionMode.range : 1))

const sacrificeTargetableUnitIds = computed(() => {
  if (state.value.turn.phase !== 'combat') return []
  if (ui.interactionMode.kind !== 'sacrifice_select_target') return []
  const srcId = ui.interactionMode.sourceUnitId
  const range = ui.interactionMode.range
  const out: string[] = []
  for (const u of Object.values(state.value.units)) {
    if (u.side !== state.value.turn.side) continue
    const g = canSacrifice(state.value, srcId, u.id, range)
    if (g.ok) out.push(u.id)
  }
  return out
})

const canStartSacrificeMode = computed(() => {
  if (state.value.turn.phase !== 'combat') return { ok: false as const, reason: 'Not in combat phase' }
  if (!selectedUnit.value) return { ok: false as const, reason: 'Select a unit' }
  if (selectedUnit.value.side !== state.value.turn.side) return { ok: false as const, reason: 'Not your turn' }

  for (const u of Object.values(state.value.units)) {
    if (u.side !== state.value.turn.side) continue
    const g = canSacrifice(state.value, selectedUnit.value.id, u.id, 1)
    if (g.ok) return { ok: true as const }
  }

  return { ok: false as const, reason: 'No valid sacrifice target' }
})

const sacrificeOverlayVisible = computed(() => {
  if (state.value.turn.phase !== 'combat') return false
  if (!selectedUnit.value) return false
  if (selectedUnit.value.side !== state.value.turn.side) return false
  if (!canStartSacrificeMode.value.ok) return false
  if (shootPreview.value) return false
  if (pending.value) return false
  if (ui.interactionMode.kind !== 'idle') return false
  return true
})

function confirmSacrificeOverlay() {
  if (!selectedUnit.value) return
  if (!canStartSacrificeMode.value.ok) return
  startSacrificeMode(selectedUnit.value.id, 1)
}

function cancelSacrificeOverlay() {
  ui.setSelectedUnitId(null)
}

function startSacrificeMode(sourceUnitId: string, range?: number) {
  if (state.value.turn.phase !== 'combat') return
  const src = state.value.units[sourceUnitId]
  const soulId = src?.enchant?.soulId ?? null
  if (soulId === 'eternal_night_advisor_guhu' || soulId === 'eternal_night_advisor_hunshi') {
    setPending({
      action: { type: 'SACRIFICE', sourceUnitId, targetUnitId: sourceUnitId, range: 0 },
      title: 'Confirm Sacrifice',
      detail: [`${sourceUnitId} -> sacrifice self`, 'range: 0'].join('\n'),
    })
    return
  }
  ui.startSacrificeSelectTarget(sourceUnitId, range)
}

function cancelSacrificeMode() {
  ui.clearInteractionMode()
}

onMounted(() => {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && ui.interactionMode.kind !== 'idle') {
      ui.clearInteractionMode()
    }

    if (e.key === 'Escape' && shootPreview.value) {
      closeShootDetails()
      closeShootPreview()
    }

    if (e.key === 'Enter' && shootPreview.value) {
      confirmShootPreview()
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

function buyFromEnemyGraveyard(soulId?: string) {
  dispatch({ type: 'BUY_SOUL_FROM_ENEMY_GRAVEYARD', soulId })
}

const buyItemGuards = computed(() => {
  return [0, 1, 2].map((slot) => canBuyItemFromDisplay(state.value, slot))
})

const discardItemGuards = computed(() => {
  const out: Partial<Record<string, ReturnType<typeof canDiscardItemFromHand>>> = {}
  for (const id of handItems.value) out[id] = canDiscardItemFromHand(state.value, id)
  return out
})

const useItemGuards = computed(() => {
  const out: Partial<Record<string, ReturnType<typeof canUseItemFromHand>>> = {}
  for (const id of handItems.value) out[id] = canUseItemFromHand(state.value, id)
  return out
})

// 骸骨煉化二選一：暫存選中的屍骸位置
const boneRefineChoicePos = ref<Pos | null>(null)

function getItemName(id: string): string {
  return getItemCard(id)?.name ?? id
}

function buyItem(slot: number) {
  dispatch({ type: 'BUY_ITEM_FROM_DISPLAY', slot })
}

function discardItem(itemId: string) {
  dispatch({ type: 'DISCARD_ITEM_FROM_HAND', itemId })
}

function getUnitHpMax(unit: GameState['units'][string]): number {
  if (unit.enchant) return getSoulCard(unit.enchant.soulId)?.stats.hp ?? BASE_STATS[unit.base].hp
  return BASE_STATS[unit.base].hp
}

function onUseItem(itemId: string) {
  const item = getItemCard(itemId)
  if (!item) return
  const side = state.value.turn.side

  switch (itemId) {
    case 'item_lingxue_holy_grail': {
      const validUnitIds = Object.values(state.value.units)
        .filter((u) => u.side === side && u.hpCurrent < getUnitHpMax(u))
        .map((u) => u.id)
      if (validUnitIds.length === 0) { lastError.value = '沒有可治療的單位'; return }
      ui.startUseItemTargetUnit(itemId, validUnitIds)
      break
    }
    case 'item_dead_return_path': {
      const validUnitIds = Object.values(state.value.units)
        .filter((u) => u.side === side && !!u.enchant)
        .map((u) => u.id)
      if (validUnitIds.length === 0) { lastError.value = '沒有附魔單位'; return }
      ui.startUseItemTargetUnit(itemId, validUnitIds)
      break
    }
    case 'item_bone_refine': {
      ui.startUseItemTargetCorpse(itemId)
      break
    }
    default: {
      // 無目標道具：直接彈出確認
      setPending({
        action: { type: 'USE_ITEM_FROM_HAND', itemId },
        title: item.name,
        detail: item.text ?? '',
      })
    }
  }
}

function boneRefineChoose(choice: 'gold' | 'mana') {
  if (!boneRefineChoicePos.value) return
  setPending({
    action: { type: 'USE_ITEM_FROM_HAND', itemId: 'item_bone_refine', targetPos: boneRefineChoicePos.value, choice },
    title: '骸骨煉化',
    detail: choice === 'gold' ? '移除屍骸 → 獲得 +3 財力' : '移除屍骸 → 獲得 +2 魔力',
  })
  boneRefineChoicePos.value = null
  ui.clearInteractionMode()
}

function cancelBoneRefine() {
  boneRefineChoicePos.value = null
  ui.clearInteractionMode()
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
    image: soul?.image || BASE_IMAGES[u.base] || null,
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

function selectCellFromUnits(unitId: string) {
  closeAllUnits()
  // dead row IDs are formatted "dead:x,y:stackIndex"
  if (unitId.startsWith('dead:')) {
    const posKey = unitId.split(':')[1] ?? ''
    const [xs, ys] = posKey.split(',')
    const pos = { x: Number(xs), y: Number(ys) }
    if (Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
      ui.setSelectedUnitId(null)
      ui.setSelectedCell(pos)
    }
    return
  }
  const u = state.value.units[unitId]
  if (!u) return
  ui.setSelectedUnitId(unitId)
  ui.setSelectedCell({ ...u.pos })
}


function dispatch(action: Parameters<typeof reduce>[1]) {
  const prevState = state.value
  const res = reduce(state.value, action)
  if (res.ok === false) {
    lastError.value = res.error
    return
  }

  lastError.value = null
  state.value = res.state

  const nextState = res.state

  for (const e of res.events) {
    if ((e as any).type === 'ITEM_USED') {
      // 道具使用：在己方帥的位置顯示道具名稱浮字
      const itemName = String((e as any).itemName ?? '')
      const usedSide = String((e as any).side ?? state.value.turn.side)
      const king = Object.values(nextState.units).find((u) => u.side === usedSide && u.base === 'king')
      if (king && itemName) {
        const key = `${king.pos.x},${king.pos.y}`
        const id = `${Date.now()}-${Math.random()}`
        const floatItem: FloatText = { id, text: itemName, kind: 'heal' }
        const cur = floatTextsByPos.value[key] ?? []
        floatTextsByPos.value = { ...floatTextsByPos.value, [key]: [...cur, floatItem] }
        window.setTimeout(() => {
          const cur2 = floatTextsByPos.value[key] ?? []
          floatTextsByPos.value = { ...floatTextsByPos.value, [key]: cur2.filter((x) => x.id !== id) }
        }, 900)
      }
    }

    if ((e as any).type === 'ABILITY_TRIGGERED') {
      const unitId = String((e as any).unitId ?? '')
      const text = String((e as any).text ?? (e as any).abilityType ?? '')
      const u = unitId ? nextState.units[unitId] : null
      if (u && text) {
        // B: highlight
        fxAbilityUnitIds.value = [...fxAbilityUnitIds.value.filter((id) => id !== unitId), unitId]
        window.setTimeout(() => {
          fxAbilityUnitIds.value = fxAbilityUnitIds.value.filter((id) => id !== unitId)
        }, 520)

        // A: float text
        const key = `${u.pos.x},${u.pos.y}`
        const id = `${Date.now()}-${Math.random()}`
        const item: FloatText = { id, text, kind: 'heal' }
        const cur = floatTextsByPos.value[key] ?? []
        floatTextsByPos.value = { ...floatTextsByPos.value, [key]: [...cur, item] }
        window.setTimeout(() => {
          const cur2 = floatTextsByPos.value[key] ?? []
          floatTextsByPos.value = { ...floatTextsByPos.value, [key]: cur2.filter((x) => x.id !== id) }
        }, 780)
      }
    }

    if ((e as any).type === 'SHOT_FIRED') {
      const attackerId = String((e as any).attackerId ?? '')
      const targetId = String((e as any).targetUnitId ?? '')

      const attacker = attackerId ? nextState.units[attackerId] : null
      const target = targetId ? nextState.units[targetId] : null
      if (attacker && target) {
        const id = `${Date.now()}-${Math.random()}`
        const beam: BeamFx = { id, from: { ...attacker.pos }, to: { ...target.pos } }
        fxBeams.value = [...fxBeams.value, beam]
        window.setTimeout(() => {
          fxBeams.value = fxBeams.value.filter((b) => b.id !== id)
        }, 240)
      }

      if (attackerId) {
        fxAttackUnitIds.value = [...fxAttackUnitIds.value.filter((id) => id !== attackerId), attackerId]
        window.setTimeout(() => {
          fxAttackUnitIds.value = fxAttackUnitIds.value.filter((id) => id !== attackerId)
        }, 520)
      }
      if (targetId) {
        fxHitUnitIds.value = [...fxHitUnitIds.value.filter((id) => id !== targetId), targetId]
        window.setTimeout(() => {
          fxHitUnitIds.value = fxHitUnitIds.value.filter((id) => id !== targetId)
        }, 620)
      }
    }

    if ((e as any).type === 'DAMAGE_DEALT') {
      const attackerId = String((e as any).attackerId ?? '')
      const targetId = String((e as any).targetUnitId ?? '')
      const amount = Number((e as any).amount ?? 0)

      if (attackerId) {
        fxAttackUnitIds.value = [...fxAttackUnitIds.value.filter((id) => id !== attackerId), attackerId]
        window.setTimeout(() => {
          fxAttackUnitIds.value = fxAttackUnitIds.value.filter((id) => id !== attackerId)
        }, 520)
      }

      if (targetId) {
        fxHitUnitIds.value = [...fxHitUnitIds.value.filter((id) => id !== targetId), targetId]
        window.setTimeout(() => {
          fxHitUnitIds.value = fxHitUnitIds.value.filter((id) => id !== targetId)
        }, 620)
      }

      const u = targetId ? nextState.units[targetId] : null
      if (u && Number.isFinite(amount) && amount !== 0) {
        const key = `${u.pos.x},${u.pos.y}`
        const id = `${Date.now()}-${Math.random()}`
        const item: FloatText = { id, text: amount > 0 ? `-${amount}` : `${amount}`, kind: 'damage' }
        const cur = floatTextsByPos.value[key] ?? []
        floatTextsByPos.value = { ...floatTextsByPos.value, [key]: [...cur, item] }
        window.setTimeout(() => {
          const cur2 = floatTextsByPos.value[key] ?? []
          floatTextsByPos.value = { ...floatTextsByPos.value, [key]: cur2.filter((x) => x.id !== id) }
        }, 780)
      }
    }

    if ((e as any).type === 'UNIT_HP_CHANGED') {
      const unitId = String((e as any).unitId ?? '')
      const from = Number((e as any).from ?? 0)
      const to = Number((e as any).to ?? 0)
      const delta = to - from
      const u = unitId ? nextState.units[unitId] : null
      if (u && Number.isFinite(delta) && delta > 0) {
        const key = `${u.pos.x},${u.pos.y}`
        const id = `${Date.now()}-${Math.random()}`
        const item: FloatText = { id, text: `+${delta}`, kind: 'heal' }
        const cur = floatTextsByPos.value[key] ?? []
        floatTextsByPos.value = { ...floatTextsByPos.value, [key]: [...cur, item] }
        window.setTimeout(() => {
          const cur2 = floatTextsByPos.value[key] ?? []
          floatTextsByPos.value = { ...floatTextsByPos.value, [key]: cur2.filter((x) => x.id !== id) }
        }, 780)
      }
    }

    if ((e as any).type === 'UNIT_KILLED') {
      const unitId = String((e as any).unitId ?? '')
      if (unitId) {
        fxKilledUnitIds.value = [...fxKilledUnitIds.value.filter((id) => id !== unitId), unitId]
        window.setTimeout(() => {
          fxKilledUnitIds.value = fxKilledUnitIds.value.filter((id) => id !== unitId)
        }, 760)

        const pos = prevState.units[unitId]?.pos
        if (pos) {
          const key = `${pos.x},${pos.y}`
          fxKilledPosKeys.value = [...fxKilledPosKeys.value.filter((k) => k !== key), key]
          window.setTimeout(() => {
            fxKilledPosKeys.value = fxKilledPosKeys.value.filter((k) => k !== key)
          }, 760)
        }
      }
    }

    if ((e as any).type === 'REVIVED') {
      const pos = (e as any).pos
      if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
        const key = `${pos.x},${pos.y}`
        fxRevivedPosKeys.value = [...fxRevivedPosKeys.value.filter((k) => k !== key), key]
        window.setTimeout(() => {
          fxRevivedPosKeys.value = fxRevivedPosKeys.value.filter((k) => k !== key)
        }, 760)
      }
    }

    if ((e as any).type === 'ENCHANTED') {
      const unitId = String((e as any).unitId ?? '')
      const u = unitId ? nextState.units[unitId] : null
      if (u) {
        const key = `${u.pos.x},${u.pos.y}`
        fxEnchantedPosKeys.value = [...fxEnchantedPosKeys.value.filter((k) => k !== key), key]
        window.setTimeout(() => {
          fxEnchantedPosKeys.value = fxEnchantedPosKeys.value.filter((k) => k !== key)
        }, 820)
      }
    }
  }

  // Fallback: if engine didn't emit UNIT_KILLED but a unit disappeared this dispatch, still show killed FX.
  for (const [unitId, prevU] of Object.entries(prevState.units)) {
    if (nextState.units[unitId]) continue
    const key = `${prevU.pos.x},${prevU.pos.y}`
    fxKilledPosKeys.value = [...fxKilledPosKeys.value.filter((k) => k !== key), key]
    window.setTimeout(() => {
      fxKilledPosKeys.value = fxKilledPosKeys.value.filter((k) => k !== key)
    }, 760)
  }

  lastEvents.value = [...lastEvents.value, ...res.events.map((e) => JSON.stringify(e))].slice(-300)
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

  if (ui.interactionMode.kind === 'sacrifice_select_target') {
    ui.setSelectedCell({ x: payload.x, y: payload.y })
    const targetUnitId = payload.unitId
    const sourceUnitId = ui.interactionMode.sourceUnitId
    const range = ui.interactionMode.range
    if (targetUnitId && sacrificeTargetableUnitIds.value.includes(targetUnitId)) {
      setPending({
        action: { type: 'SACRIFICE', sourceUnitId, targetUnitId, range },
        title: 'Confirm Sacrifice',
        detail: [`${sourceUnitId} -> sacrifice ${targetUnitId}`, `range: ${range}`].join('\n'),
      })
      ui.clearInteractionMode()
      return
    }
    return
  }

  if (ui.interactionMode.kind === 'use_item_target_unit') {
    const unitId = payload.unitId
    const itemId = ui.interactionMode.itemId
    if (unitId && ui.interactionMode.validUnitIds.includes(unitId)) {
      const item = getItemCard(itemId)
      const unit = state.value.units[unitId]
      setPending({
        action: { type: 'USE_ITEM_FROM_HAND', itemId, targetUnitId: unitId },
        title: item?.name ?? itemId,
        detail: `目標: ${unit ? (getSoulCard(unit.enchant?.soulId ?? '')?.name ?? unit.base) : unitId}`,
      })
      ui.clearInteractionMode()
    }
    return
  }

  if (ui.interactionMode.kind === 'use_item_target_corpse') {
    const posKey = `${payload.x},${payload.y}`
    const stack = state.value.corpsesByPos[posKey]
    const hasFriendlyCorpse = stack && stack.some((c) => c.ownerSide === state.value.turn.side)
    if (hasFriendlyCorpse) {
      boneRefineChoicePos.value = { x: payload.x, y: payload.y }
    }
    return
  }

  const prevSelectedUnit = selectedUnit.value

  // While shoot preview is open, allow selecting a CHAIN extra target by clicking a second eligible enemy.
  if (shootPreview.value && payload.unitId) {
    const clicked = state.value.units[payload.unitId]
    if (clicked && clicked.side !== state.value.turn.side) {
      const eligible = shootChainEligibleEnemyIds.value
      if (eligible.includes(clicked.id)) {
        ui.setShootPreview({
          attackerId: shootPreview.value.attackerId,
          targetUnitId: shootPreview.value.targetUnitId,
          extraTargetUnitId: shootExtraTargetUnitId.value === clicked.id ? null : clicked.id,
        })
        return
      }
    }
  }

  // More natural: while shoot preview is active, clicking an empty cell cancels it.
  if (shootPreview.value && !payload.unitId) {
    cancelShootPreview()
    return
  }

  onCellClickSelection(payload, (enemyUnitId: string) => {
    if (!prevSelectedUnit) return

    // Unified flow: always enter shoot preview; never shoot immediately on click.
    openShootPreview(prevSelectedUnit.id, enemyUnitId, null)
    shootDetailsOpen.value = false
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
  shootDetailsOpen.value = false
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

function cycleConnection() {
  ;(ui as any).cycleConnectionStatus()
}

function openMenu() {
  debugMatchSeed.value = state.value.rules.matchSeed
  debugEnabledClans.value = [...state.value.rules.enabledClans]
  debugOpen.value = true
}

function closeDebugMenu() {
  debugOpen.value = false
}

function applyDebugSettings(payload: { matchSeed: string; enabledClans: string[] }) {
  debugOpen.value = false
  debugMatchSeed.value = payload.matchSeed
  debugEnabledClans.value = payload.enabledClans

  state.value = createInitialState({
    rules: {
      rngMode: 'seeded',
      matchSeed: payload.matchSeed,
      enabledClans: payload.enabledClans,
    } as any,
  })
  lastError.value = null
  lastEvents.value = []
}

const eventLogText = computed(() => lastEvents.value.join('\n'))

function openEventLog() {
  eventLogOpen.value = true
}

function closeEventLog() {
  eventLogOpen.value = false
}

async function copyEventLog() {
  try {
    await navigator.clipboard.writeText(eventLogText.value)
  } catch {
    // ignore
  }
}

</script>

<template>
  <div class="page" :class="turnTintClass">
    <!-- 視窗固定背景色調 -->
    <div class="turnBg" :class="turnTintClass" />

    <!-- 階段切換 Toast -->
    <Transition name="phase-toast">
      <div v-if="phaseToastVisible" class="phaseToast" :class="currentSide === 'red' ? 'toastRed' : 'toastGreen'">
        {{ phaseToastText }}
      </div>
    </Transition>

    <!-- NPC 回合鎖定：防止玩家誤點 -->
    <div v-if="isNpcTurn" class="npc-overlay" />

    <div class="topbarWrap">
      <TopBar
        title="webChese"
        :connection-status="ui.connectionStatus"
        :current-side="currentSide"
        :current-phase="currentPhase"
        :necro-actions-used="necroActionsUsed"
        :necro-actions-max="necroActionsMax"
        :king-hp="kingHp"
        :resources="resources"
        @cycle-connection="cycleConnection"
        @open-menu="openMenu"
        @next-phase="nextPhase"
      />
      <div v-if="npcSide !== null" class="speedRow">
        <span class="speedLabel">電腦速度</span>
        <button
          v-for="s in (['最慢', '慢', '正常', '快', '即時'] as const)"
          :key="s"
          type="button"
          class="speedBtn"
          :class="{ speedActive: botSpeedLabel === s }"
          @click="botSpeedLabel = s"
        >{{ s }}</button>
      </div>
    </div>

    <div v-if="enchantMode" class="actionStatusBar">
      <div class="mono">Selecting unit to enchant: {{ enchantModeSoulName ?? '-' }}</div>
      <button type="button" @click="cancelEnchantMode">Cancel (Esc)</button>
    </div>

    <div v-if="sacrificeMode" class="actionStatusBar">
      <div class="mono">Selecting unit to sacrifice (range {{ sacrificeRange }}): {{ sacrificeSourceUnitId ?? '-' }}</div>
      <button type="button" @click="cancelSacrificeMode">Cancel (Esc)</button>
    </div>

    <div v-if="ui.interactionMode.kind === 'use_item_target_unit'" class="actionStatusBar">
      <div class="mono">選擇目標單位：{{ getItemCard(ui.interactionMode.itemId)?.name ?? ui.interactionMode.itemId }}</div>
      <button type="button" @click="ui.clearInteractionMode()">取消 (Esc)</button>
    </div>

    <div v-if="ui.interactionMode.kind === 'use_item_target_corpse' && !boneRefineChoicePos" class="actionStatusBar">
      <div class="mono">選擇要消耗的屍骸格：{{ getItemCard(ui.interactionMode.itemId)?.name ?? ui.interactionMode.itemId }}</div>
      <button type="button" @click="cancelBoneRefine()">取消 (Esc)</button>
    </div>

    <div v-if="boneRefineChoicePos" class="actionStatusBar">
      <div class="mono">骸骨煉化：選擇增益（位置 {{ boneRefineChoicePos.x }},{{ boneRefineChoicePos.y }}）</div>
      <button type="button" class="choiceBtn choiceGold" @click="boneRefineChoose('gold')">+3 財力</button>
      <button type="button" class="choiceBtn choiceMana" @click="boneRefineChoose('mana')">+2 魔力</button>
      <button type="button" @click="cancelBoneRefine()">取消</button>
    </div>

    <main class="main" :style="mainGridStyle">
      <section class="boardArea">
        <!-- Board scale toggle -->
        <div class="boardScaleBar">
          <button
            v-for="s in ([50, 75, 100] as BoardScale[])"
            :key="s"
            type="button"
            class="scaleBtn"
            :class="{ scaleActive: boardScale === s }"
            @click="boardScale = s"
          >{{ BOARD_SCALE_LABELS[s] }}</button>
        </div>

        <div class="boardScaleWrap" :style="boardScaleStyle">
        <BoardGrid
          :state="state"
          :selected-unit-id="selectedUnitId"
          :legal-moves="legalMoves"
          :shootable-target-ids="shootableTargetIds"
          :highlight-unit-ids="enchantMode ? enchantableUnitIds : sacrificeMode ? sacrificeTargetableUnitIds : ui.interactionMode.kind === 'use_item_target_unit' ? ui.interactionMode.validUnitIds : []"
          :enchant-drag-soul-id="ui.interactionMode.kind === 'enchant_select_unit' ? ui.interactionMode.soulId : null"
          :preview-pierce-marks="shootPreviewPierceMarks"
          :preview-splash-pos-keys="shootPreviewSplashPosKeys"
          :preview-chain-eligible-pos-keys="shootPreviewChainEligiblePosKeys"
          :preview-chain-selected-pos-key="shootPreviewChainSelectedPosKey"
          :shoot-action-pos-key="shootPreviewTarget ? `${shootPreviewTarget.pos.x},${shootPreviewTarget.pos.y}` : null"
          :shoot-actions-visible="!shootDetailsOpen"
          :shoot-confirm-disabled="!shootPreviewGuard.ok"
          :shoot-confirm-title="shootPreviewGuard.ok ? '' : shootPreviewGuard.reason"

          :sacrifice-action-pos-key="sacrificeOverlayVisible && selectedUnit ? `${selectedUnit.pos.x},${selectedUnit.pos.y}` : null"
          :sacrifice-actions-visible="sacrificeOverlayVisible"
          :sacrifice-confirm-disabled="!canStartSacrificeMode.ok"
          :sacrifice-confirm-title="canStartSacrificeMode.ok ? '' : canStartSacrificeMode.reason"

          :fx-attack-unit-ids="fxAttackUnitIds"
          :fx-hit-unit-ids="fxHitUnitIds"
          :fx-killed-unit-ids="fxKilledUnitIds"
          :fx-ability-unit-ids="fxAbilityUnitIds"
          :fx-killed-pos-keys="fxKilledPosKeys"
          :fx-revived-pos-keys="fxRevivedPosKeys"
          :fx-enchanted-pos-keys="fxEnchantedPosKeys"
          :float-texts-by-pos="floatTextsByPos"
          :fx-beams="fxBeams"
          @select-unit="onSelectUnit"
          @cell-click="onCellClick"
          @enchant-drop="onEnchantDrop"
          @shoot-confirm="confirmShootPreview"
          @shoot-cancel="cancelShootPreview"
          @shoot-details="openShootDetails"
          @sacrifice-confirm="confirmSacrificeOverlay"
          @sacrifice-cancel="cancelSacrificeOverlay"
        />
        </div><!-- end boardScaleWrap -->

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
          :use-guards="useItemGuards"
          :get-item-name="getItemName"
          :get-item="getItemCard"
          @select-soul="selectSoul"
          @dragstart-soul="onSoulDragStart"
          @dragend-soul="onSoulDragEnd"
          @enchant="enchantSelected"
          @return-soul="returnSoulToDeckBottom"
          @discard-item="discardItem"
          @use-item="onUseItem"
          @show-item-detail="showItemDetail"
        />
      </section>

      <aside class="sidePanel">
        <button
          type="button"
          class="sideWidthBtn"
          :title="`側欄寬度：${SIDEBAR_WIDTHS[sidebarSize]}px（點擊切換）`"
          @click="cycleSidebarWidth"
        >{{ SIDEBAR_LABELS[sidebarSize] }}</button>
        <SidePanel
          :phase="state.turn.phase"
          :selected-unit="selectedUnit"
          :selected-enchant-soul="selectedEnchantSoul"
          :selected-unit-base-image="selectedUnitBaseImage"
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
          @open-shop="openShop"
          @open-units="openAllUnits"
          @next-phase="nextPhase"
          @open-events="openEventLog"
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
      :open="shootDetailsOpen"
      :attacker="shootPreviewAttacker"
      :target="shootPreviewTarget"
      :guard="shootPreviewGuard"
      :raw-damage="shootPreviewInfo?.rawDamage ?? null"
      :damage-to-target="shootPreviewInfo?.damageToTarget ?? null"
      :shared="shootPreviewInfo?.shared ?? null"
      :effects="shootPreviewInfo?.effects ?? []"
      @confirm="confirmShootPreview"
      @cancel="closeShootDetails"
    />

    <AllUnitsModal
      :open="allUnitsOpen"
      :my-title="`My units (${currentSide})`"
      :enemy-title="`Enemy units (${enemySide})`"
      :my-units="myUnitRows"
      :enemy-units="enemyUnitRows"
      @close="closeAllUnits"
      @show-unit-detail="showUnitDetail"
      @select-cell="selectCellFromUnits"
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
      :enemy-graveyard="enemyGraveyard"
      :dark-moon-scope-active="darkMoonScopeActive"
      :buy-enemy-grave-guard="buyEnemyGraveGuard"
      :buy-soul-from-deck-gold-cost="state.rules.buySoulFromDeckGoldCost"
      :buy-soul-from-display-gold-cost="state.rules.buySoulFromDisplayGoldCost"
      :buy-soul-from-enemy-graveyard-gold-cost="state.rules.buySoulFromEnemyGraveyardGoldCost"
      @close="closeShop"
      @buy-display="buyFromDisplay"
      @buy-deck="buyFromDeck"
      @buy-item="buyItem"
      @buy-enemy-graveyard="(soulId?: string) => buyFromEnemyGraveyard(soulId)"
      @show-soul-detail="showSoulDetail"
      @show-item-detail="showItemDetail"
      @show-enemy-grave-top-detail="showEnemyGraveTopDetail"
    />

    <DebugMenuModal
      :open="debugOpen"
      :match-seed="debugMatchSeed"
      :enabled-clans="debugEnabledClans"
      @close="closeDebugMenu"
      @apply="applyDebugSettings"
      @open-events="openEventLog"
      @go-home="router.push({ name: 'home' })"
    />

    <EventLogModal :open="eventLogOpen" :text="eventLogText" @close="closeEventLog" @copy="copyEventLog" />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 10px 10px;
  box-sizing: border-box;
}

.topbarWrap {
  position: sticky;
  top: 0;
  z-index: 50;
  background: var(--bg-topbar);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border);
  padding: 8px 14px;
  overflow: visible;
}

.speedRow {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  margin-top: 6px;
}

.speedLabel {
  font-size: 0.6875rem;
  opacity: 0.65;
  margin-right: 2px;
}

.speedBtn {
  padding: 2px 10px;
  font-size: 0.75rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  transition: all 0.15s;
}

.speedBtn:hover {
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(255, 255, 255, 0.35);
  color: rgba(255, 255, 255, 0.95);
}

.speedActive {
  background: rgba(145, 202, 255, 0.2) !important;
  border-color: rgba(145, 202, 255, 0.65) !important;
  color: rgba(145, 202, 255, 0.95) !important;
}

.turnBg {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  transition: background 0.5s ease;
}

.turnBg.turn-red {
  background: linear-gradient(180deg, rgba(255, 77, 79, 0.13) 0%, rgba(0, 0, 0, 0) 45%);
}

.turnBg.turn-green {
  background: linear-gradient(180deg, rgba(82, 196, 26, 0.13) 0%, rgba(0, 0, 0, 0) 45%);
}

.main {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 12px;
  align-items: start;
}

.boardArea {
  min-width: 0;
  padding-bottom: 180px;
}

.boardScaleBar {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
}

.scaleBtn {
  padding: 3px 10px;
  font-size: 0.6875rem;
  font-weight: 700;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: all 0.15s;
}
.scaleBtn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.85);
}
.scaleActive {
  background: rgba(145, 202, 255, 0.18) !important;
  border-color: rgba(145, 202, 255, 0.65) !important;
  color: rgba(145, 202, 255, 0.95) !important;
}

.boardScaleWrap {
  transition: zoom 0.2s ease;
}

.sidePanel {
  position: sticky;
  top: 130px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 14px;
  max-height: calc(100vh - 160px);
  overflow-y: auto;
}

.sideWidthBtn {
  display: block;
  margin-left: auto;
  margin-bottom: 8px;
  padding: 3px 10px;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.55);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.sideWidthBtn:hover {
  background: rgba(255, 255, 255, 0.14);
  color: rgba(255, 255, 255, 0.9);
}

.unitCard {
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
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
  font-size: 0.75rem;
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
  font-size: 0.75rem;
  min-height: 80px;
  overflow: auto;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

.npc-overlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
  cursor: wait;
}

.actionStatusBar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: rgba(30, 34, 55, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: rgba(255, 255, 255, 0.95);
}

.choiceBtn {
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
}

.choiceGold {
  background: rgba(200, 160, 40, 0.2);
  border: 1px solid rgba(200, 160, 40, 0.55);
  color: #e8d8a0;
}

.choiceGold:hover {
  background: rgba(200, 160, 40, 0.35);
}

.choiceMana {
  background: rgba(60, 120, 200, 0.2);
  border: 1px solid rgba(60, 120, 200, 0.55);
  color: #a0c8f4;
}

.choiceMana:hover {
  background: rgba(60, 120, 200, 0.35);
}

/* ── Phase Toast ─────────────────────────────────────────────────────────── */
.phaseToast {
  position: fixed;
  top: 90px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9100;
  padding: 10px 28px;
  border-radius: 999px;
  font-size: 1.125rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  pointer-events: none;
  white-space: nowrap;
  backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(20, 22, 36, 0.85);
  color: rgba(255, 255, 255, 0.95);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
}

.phaseToast.toastRed {
  border-color: rgba(255, 77, 79, 0.5);
  box-shadow: 0 4px 28px rgba(255, 77, 79, 0.2);
}

.phaseToast.toastGreen {
  border-color: rgba(82, 196, 26, 0.5);
  box-shadow: 0 4px 28px rgba(82, 196, 26, 0.2);
}

.phase-toast-enter-active,
.phase-toast-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.phase-toast-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-12px) scale(0.92);
}

.phase-toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px) scale(0.96);
}
</style>

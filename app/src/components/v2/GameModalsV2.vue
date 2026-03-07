<script setup lang="ts">
import { computed, inject, type Ref } from 'vue'
import { GAME_V2_KEY, type GameV2Ctx } from '../../composables/useGameV2Context'
import type { GameState, PieceBase } from '../../engine'
import {
  canBuySoulFromDisplay, canBuySoulFromDeck, canBuySoulFromEnemyGraveyard,
  canBuyItemFromDisplay, getSoulCard, getItemCard,
} from '../../engine'
import ShopModal from '../ShopModal.vue'
import AllUnitsModal from '../AllUnitsModal.vue'
import CardDetailModal from '../CardDetailModal.vue'
import EffectsModal from '../EffectsModal.vue'
import EventLogModal from '../EventLogModal.vue'
import { useUiStore } from '../../stores/ui'

const ctx = inject(GAME_V2_KEY) as GameV2Ctx
const state = ctx.state as Ref<GameState>
const ui = useUiStore()

const BASE_IMAGES: Partial<Record<PieceBase, string>> = {
  king: '/assets/cards/base/king.jpg', advisor: '/assets/cards/base/advisor.jpg',
  elephant: '/assets/cards/base/elephant.jpg', rook: '/assets/cards/base/rook.jpg',
  knight: '/assets/cards/base/knight.jpg', cannon: '/assets/cards/base/cannon.jpg',
  soldier: '/assets/cards/base/soldier.jpg',
}

// ── Shop computed ──────────────────────────────────────────────────────────────
const mySide = computed<'red' | 'black'>(() => ctx.onlineSide ?? state.value.turn.side)
const enemySide = computed<'red' | 'black'>(() => mySide.value === 'red' ? 'black' : 'red')
const phase = computed(() => state.value.turn.phase)

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

const enemyGraveTop = computed(() => state.value.graveyard[enemySide.value][0] ?? null)
const enemyGraveyard = computed(() => state.value.graveyard[enemySide.value])

const buyEnemyGraveGuard = computed(() => canBuySoulFromEnemyGraveyard(state.value))
const buyItemGuards = computed(() => [0, 1, 2].map((slot) => canBuyItemFromDisplay(state.value, slot)))
const itemDeckCount = computed(() => (state.value as any).itemDeck?.length ?? 0)

// ── AllUnits computed ──────────────────────────────────────────────────────────
function toUnitRow(u: GameState['units'][string]) {
  const soul = u.enchant?.soulId ? getSoulCard(u.enchant.soulId) : null
  return {
    id: u.id, side: u.side, base: u.base, hpCurrent: u.hpCurrent,
    name: soul?.name ?? u.base,
    image: soul?.image || BASE_IMAGES[u.base] || undefined,
    pos: { ...u.pos },
  }
}

const myUnitRows = computed(() => {
  const side = mySide.value
  const alive = Object.values(state.value.units)
    .filter((u) => u.side === side)
    .map(toUnitRow)
    .sort((a, b) => a.id.localeCompare(b.id))
  const dead: ReturnType<typeof toUnitRow>[] = []
  for (const [posKey, stack] of Object.entries(state.value.corpsesByPos)) {
    for (let i = stack.length - 1; i >= 0; i--) {
      const corpse = stack[i]
      if (!corpse || corpse.ownerSide !== side) continue
      const [xs, ys] = posKey.split(',')
      dead.push({
        id: `dead:${posKey}:${i}`, side,
        base: corpse.base, hpCurrent: 0, name: corpse.base,
        image: BASE_IMAGES[corpse.base], pos: { x: Number(xs), y: Number(ys) }, dead: true,
      } as any)
    }
  }
  return [...alive, ...dead]
})

const enemyUnitRows = computed(() => {
  const side = enemySide.value
  const alive = Object.values(state.value.units)
    .filter((u) => u.side === side)
    .map(toUnitRow)
    .sort((a, b) => a.id.localeCompare(b.id))
  const dead: ReturnType<typeof toUnitRow>[] = []
  for (const [posKey, stack] of Object.entries(state.value.corpsesByPos)) {
    for (let i = stack.length - 1; i >= 0; i--) {
      const corpse = stack[i]
      if (!corpse || corpse.ownerSide !== side) continue
      const [xs, ys] = posKey.split(',')
      dead.push({
        id: `dead:${posKey}:${i}`, side,
        base: corpse.base, hpCurrent: 0, name: corpse.base,
        image: BASE_IMAGES[corpse.base], pos: { x: Number(xs), y: Number(ys) }, dead: true,
      } as any)
    }
  }
  return [...alive, ...dead]
})

const myTitle = computed(() => mySide.value === 'red' ? '🔴 我方（紅）' : '⚫ 我方（黑）')
const enemyTitle = computed(() => mySide.value === 'red' ? '⚫ 敵方（黑）' : '🔴 敵方（紅）')

function selectCellFromUnits(unitId: string) {
  ui.closeAllUnits()
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

// ── Dispatch handlers ──────────────────────────────────────────────────────────
function buyDisplay(base: PieceBase) { ctx.dispatch({ type: 'BUY_SOUL_FROM_DISPLAY', base }) }
function buyDeck(base: PieceBase)    { ctx.dispatch({ type: 'BUY_SOUL_FROM_DECK', base }) }
function buyItem(slot: number)       { ctx.dispatch({ type: 'BUY_ITEM_FROM_DISPLAY', slot }) }
function buyEnemyGraveyard(soulId?: string) {
  ctx.dispatch({ type: 'BUY_SOUL_FROM_ENEMY_GRAVEYARD', soulId })
}

// ── Effects / Events modal ─────────────────────────────────────────────────────
const effectsOpen = computed(() => ctx.effectsOpen?.value ?? false)
const eventsOpen  = computed(() => ctx.eventsOpen?.value  ?? false)
const eventLogText = computed(() => [...(ctx.lastEvents?.value ?? [])].reverse().join('\n'))

function closeEffects() { if (ctx.effectsOpen) ctx.effectsOpen.value = false }
function closeEvents()  { if (ctx.eventsOpen)  ctx.eventsOpen.value  = false }
async function copyEvents() {
  try { await navigator.clipboard.writeText(eventLogText.value) } catch { /* ignore */ }
}

// ── Card detail helpers ────────────────────────────────────────────────────────
const BASE_NAMES: Record<string, string> = {
  king: '帥', advisor: '士', elephant: '象', rook: '車', knight: '馬', cannon: '炮', soldier: '兵',
}
const CLAN_NAMES: Record<string, string> = {
  dark_moon: '暗月', styx: '冥河', eternal_night: '永夜', iron_guard: '鐵衛',
}
const TIMING_NAMES: Record<string, string> = { buy: '買入', necro: '死靈術', combat: '戰鬥' }

function buildSoulDetail(c: NonNullable<ReturnType<typeof getSoulCard>>): string {
  const lines: string[] = []
  lines.push(`base: ${BASE_NAMES[c.base] ?? c.base}`)
  lines.push(`clan: ${CLAN_NAMES[c.clan] ?? c.clan}`)
  lines.push(`hp: ${c.stats.hp}`)
  if (c.stats.atk) {
    const k = c.stats.atk.key === 'phys' ? '物理' : '魔法'
    lines.push(`atk: ${k} ${c.stats.atk.value}`)
  }
  if (c.stats.def && c.stats.def.length > 0) {
    const defStr = c.stats.def.map((d) => `${d.key === 'phys' ? '物理' : '魔法'} ${d.value}`).join(' / ')
    lines.push(`def: ${defStr}`)
  }
  lines.push(`cost: ${c.costGold} 財力`)
  if (c.text) lines.push(`text: ${c.text}`)
  return lines.join('\n')
}

function buildItemDetail(item: NonNullable<ReturnType<typeof getItemCard>>): string {
  const lines: string[] = []
  if (item.timing) lines.push(`timing: ${TIMING_NAMES[item.timing] ?? item.timing}`)
  lines.push(`cost: ${item.costGold} 財力`)
  if (item.text) lines.push(`text: ${item.text}`)
  return lines.join('\n')
}

// ── Shop detail handlers ────────────────────────────────────────────────────────
function showShopSoulDetail(soulId: string | null | undefined) {
  if (!soulId) return
  const c = getSoulCard(soulId)
  if (!c) return
  ui.openDetailModal({ title: c.name, image: c.image || null, detail: buildSoulDetail(c), actionLabel: null, actionDisabled: false, actionTitle: '' })
}

function showShopItemDetail(itemId: string | null | undefined) {
  if (!itemId) return
  const item = getItemCard(itemId)
  if (!item) return
  ui.openDetailModal({ title: item.name, image: item.image || null, detail: buildItemDetail(item), actionLabel: null, actionDisabled: false, actionTitle: '' })
}

function showEnemyGraveTopDetail() {
  const soulId = enemyGraveTop.value
  if (!soulId) return
  const c = getSoulCard(soulId)
  if (!c) return
  const guard = buyEnemyGraveGuard.value
  const cost = state.value.rules.buySoulFromEnemyGraveyardGoldCost
  ui.openDetailModal({
    title: c.name,
    image: c.image || null,
    detail: buildSoulDetail(c),
    actionLabel: guard.ok ? `盜取 (${cost}G)` : null,
    actionDisabled: !guard.ok,
    actionTitle: guard.ok ? '' : ((guard as any).reason ?? ''),
  })
}

// ── CardDetailModal handlers ───────────────────────────────────────────────────
function closeDetail() { ui.closeDetailModal() }

function onDetailAction() {
  const modal = ui.detailModal
  if (modal.actionLabel === 'Enchant') {
    // enchant mode will open via enchant_select_unit interaction
    closeDetail()
    return
  }
  // default: for buy-enemy-graveyard we can trigger here
  if (modal.actionLabel?.includes('盜取') || modal.actionLabel?.includes('Buy')) {
    buyEnemyGraveyard()
    closeDetail()
  }
}
</script>

<template>
  <!-- Shop modal -->
  <ShopModal
    :open="ui.shopOpen"
    :phase="phase"
    :shop-bases="shopBases"
    :display-by-base="state.displayByBase"
    :soul-deck-by-base="state.soulDeckByBase"
    :buy-display-guards="buyDisplayGuards"
    :buy-deck-guards="buyDeckGuards"
    :item-display="state.itemDisplay"
    :buy-item-guards="buyItemGuards"
    :item-deck-count="itemDeckCount"
    :enemy-grave-top="enemyGraveTop"
    :enemy-graveyard="enemyGraveyard"
    :buy-enemy-grave-guard="buyEnemyGraveGuard"
    :buy-soul-from-deck-gold-cost="state.rules.buySoulFromDeckGoldCost"
    :buy-soul-from-display-gold-cost="state.rules.buySoulFromDisplayGoldCost"
    :buy-soul-from-enemy-graveyard-gold-cost="state.rules.buySoulFromEnemyGraveyardGoldCost"
    @close="ui.closeShop()"
    @buy-display="buyDisplay"
    @buy-deck="buyDeck"
    @buy-item="buyItem"
    @buy-enemy-graveyard="buyEnemyGraveyard"
    @show-soul-detail="showShopSoulDetail"
    @show-item-detail="showShopItemDetail"
    @show-enemy-grave-top-detail="showEnemyGraveTopDetail"
  />

  <!-- All units modal -->
  <AllUnitsModal
    :open="ui.allUnitsOpen"
    :my-title="myTitle"
    :enemy-title="enemyTitle"
    :my-units="myUnitRows"
    :enemy-units="enemyUnitRows"
    @close="ui.closeAllUnits()"
    @select-cell="selectCellFromUnits"
  />

  <!-- Effects modal -->
  <EffectsModal
    :open="effectsOpen"
    :state="state"
    @close="closeEffects"
  />

  <!-- Event log modal -->
  <EventLogModal
    :open="eventsOpen"
    :text="eventLogText"
    @close="closeEvents"
    @copy="copyEvents"
  />

  <!-- Card detail modal -->
  <CardDetailModal
    :open="ui.detailModal.open"
    :title="ui.detailModal.title"
    :detail="ui.detailModal.detail"
    :image="ui.detailModal.image"
    :action-label="ui.detailModal.actionLabel"
    :action-disabled="ui.detailModal.actionDisabled"
    :action-title="ui.detailModal.actionTitle"
    @close="closeDetail"
    @action="onDetailAction"
  />
</template>

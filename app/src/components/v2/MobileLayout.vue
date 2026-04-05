<script setup lang="ts">
import { ref, computed, watch, inject, onMounted, onUnmounted, type Ref } from 'vue'
import { useRouter } from 'vue-router'
import type { GameState, Phase } from '../../engine'
import { getSoulCard, getItemCard, canEnchant, canReturnSoulToDeckBottom, canDiscardItemFromHand, canUseItemFromHand, BASE_STATS } from '../../engine'
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
// In PVE mode always show the human player's hand (hide bot cards)
const mySide = computed<'red' | 'black'>(() => {
  if (ctx.onlineSide) return ctx.onlineSide
  if (ctx.isPve) return setup.resolvedPlayerSide
  return state.value.turn.side
})
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

function tryEnchantOrToast(soulId: string) {
  const side = state.value.turn.side
  const hasValid = Object.values(state.value.units).some(u => u.side === side && canEnchant(state.value, u.id, soulId).ok)
  if (!hasValid) {
    // 找看看有沒有底層可附魔的單位（忽略財力）
    const soulCard = getSoulCard(soulId)
    const firstMatch = soulCard ? Object.values(state.value.units).find(u =>
      u.side === side && u.base === soulCard.base && !u.enchant
    ) : null
    // 有匹配單位但附魔仍失敗 → 派送以觸發錯誤提示（財力不足等）
    if (firstMatch) ctx.dispatch({ type: 'ENCHANT', unitId: firstMatch.id, soulId })
    return
  }
  ui.startEnchantSelectUnit(soulId)
}
function selectSoul(id: string) {
  if (phase.value === 'necro') {
    const side = state.value.turn.side
    const hasValid = Object.values(state.value.units).some(u => u.side === side && canEnchant(state.value, u.id, id).ok)
    if (!hasValid) {
      tryEnchantOrToast(id)
      return
    }
  }
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
function returnSoul(soulId: string) { ctx.dispatch({ type: 'RETURN_SOUL_TO_DECK_BOTTOM', soulId }) }
function discardItem(itemId: string) {
  const card = getItemCard(itemId)
  ui.setPendingConfirm({
    action: { type: 'DISCARD_ITEM_FROM_HAND', itemId },
    title: '確認棄置',
    detail: ['確認將道具卡棄置到棄牌堆', card ? `道具：${card.name}` : `id: ${itemId}`].filter(Boolean).join('\n'),
  })
}
function getUnitHpMax(unit: GameState['units'][string]) {
  const soul = unit.enchant?.soulId ? getSoulCard(unit.enchant.soulId) : null
  return soul?.stats.hp ?? BASE_STATS[unit.base]?.hp ?? 10
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
      ui.setPendingConfirm({ action: { type: 'USE_ITEM_FROM_HAND', itemId }, title: item?.name ?? itemId, detail: item?.text ?? '' })
    }
  }
}
function getItemName(id: string) { return getItemCard(id)?.name ?? id }

const BASE_TIMING_LABEL: Record<string, string> = { buy: '購買', necro: '死靈術', combat: '戰鬥' }
function showHandItemDetail(itemId: string) {
  const item = getItemCard(itemId)
  if (!item) return
  const lines: string[] = []
  lines.push(`timing: ${BASE_TIMING_LABEL[item.timing ?? ''] ?? item.timing ?? '—'}`)
  lines.push(`cost: ${item.costGold ?? 0} 財力`)
  if (item.text) lines.push(`text: ${item.text}`)
  ui.openDetailModal({ title: item.name, image: item.image || null, detail: lines.join('\n'), actionLabel: null, actionDisabled: false, actionTitle: '' })
}

const BASE_NAMES: Record<string, string> = {
  king: '帥', advisor: '士', elephant: '象', rook: '車', knight: '馬', cannon: '炮', soldier: '兵',
}
const CLAN_NAMES: Record<string, string> = {
  dark_moon: '暗月', styx: '冥河', eternal_night: '永夜', iron_guard: '鐵衛',
}

function showHandSoulDetail(soulId: string) {
  const c = getSoulCard(soulId)
  if (!c) return
  const lines: string[] = []
  lines.push(`base: ${BASE_NAMES[c.base] ?? c.base}`)
  lines.push(`clan: ${CLAN_NAMES[c.clan] ?? c.clan}`)
  lines.push(`hp: ${c.stats.hp}`)
  if (c.stats.atk) {
    const k = c.stats.atk.key === 'phys' ? '物理' : '魔法'
    lines.push(`atk: ${k} ${c.stats.atk.value}`)
  }
  if (c.stats.def?.length) {
    lines.push(`def: ${c.stats.def.map((d) => `${d.key === 'phys' ? '物理' : '魔法'} ${d.value}`).join(' / ')}`)
  }
  lines.push(`cost: ${c.costGold} 財力`)
  if (c.text) lines.push(`text: ${c.text}`)
  ui.openDetailModal({ title: c.name, image: c.image || null, detail: lines.join('\n'), actionLabel: null, actionDisabled: false, actionTitle: '' })
}

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
  if (conn.isOffline) return 'dot--red'
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
  if (conn.isOffline) return '離線'
  return m[conn.status] ?? ''
})
const playerDetailHint = '點擊查看玩家詳情'
function openPlayerDetail(side: 'red' | 'black') {
  const playerRes = state.value.resources[side]
  const hands = state.value.hands[side]
  const sideLabel =
    side === 'red'
      ? (ctx.onlineSide === 'red' ? '我方（紅）' : ctx.onlineSide === 'black' ? '敵方（紅）' : '紅方')
      : (ctx.onlineSide === 'black' ? '我方（黑）' : ctx.onlineSide === 'red' ? '敵方（黑）' : '黑方')
  ui.openDetailModal({
    title: `${sideLabel} 詳情`,
    image: null,
    detail: [
      `💰 財力: ${playerRes.gold}`,
      `🌟 魔力: ${playerRes.mana}`,
      `⚖ 存魔: ${playerRes.storageMana}`,
      `🃏 靈魂手牌: ${hands.souls.length}`,
      `🎒 道具手牌: ${hands.items.length}`,
    ].join('\n'),
    actionLabel: null,
    actionDisabled: false,
    actionTitle: '',
  })
}

const buffBarCollapsed = ref(localStorage.getItem('v2_buff_collapsed') !== '0')
watch(buffBarCollapsed, (v) => localStorage.setItem('v2_buff_collapsed', v ? '1' : '0'))

const gearOpen = ref(false)
const homePending = ref(false)
const surrenderPending = ref(false)

function closeGear() { gearOpen.value = false; homePending.value = false; surrenderPending.value = false }
function goHome() {
  if (!homePending.value) { homePending.value = true; surrenderPending.value = false; return }
  router.push({ name: 'home' })
  closeGear()
}
function surrender() {
  if (!surrenderPending.value) { surrenderPending.value = true; return }
  closeGear()
  if (setup.mode === 'online' || setup.mode === 'pve') {
    const side = (setup.mode === 'online' && conn.side) ? conn.side : currentSide.value
    ctx.dispatch({ type: 'SURRENDER', side })
    return
  }
  const winner = currentSide.value === 'red' ? 'black' : 'red'
  router.push({ name: 'gameOver', query: { winner } })
}

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

const PHASE_TABS: Phase[] = ['buy', 'necro', 'combat']
const HAND_TABS: TabKey[] = ['souls', 'items']
const UTIL_TABS: TabKey[] = ['panel', 'tools']
</script>

<template>
  <div class="gameMobile" :class="currentSide === 'red' ? 'turn-red' : 'turn-black'">
    <!-- ── Compact mobile header ── -->
    <header class="mobileHeader" :class="currentSide === 'red' ? 'bar--red' : 'bar--black'">
      <!-- Row 1: Black -->
      <button class="playerRow playerRowBtn" :class="{ 'playerRow--active': currentSide === 'black' }" :title="playerDetailHint" @click="openPlayerDetail('black')">
        <span class="sdot sdot--black" />
        <span class="pname">{{ ctx.onlineSide === 'black' ? '你' : ctx.onlineSide === 'red' ? '敵' : 'BLACK' }}</span>
        <span class="playerHint">ⓘ</span>
        <span v-if="currentSide === 'black'" class="turnBadge">▶ 回合</span>
        <span class="mres mrHp">♥ {{ kingHp.black ?? '?' }}</span>
        <span class="mres">💰 {{ res.black.gold }}</span>
        <span class="mres">🌟 {{ res.black.mana }}</span>
        <span class="mres">⚖ {{ res.black.storageMana }}</span>
      </button>
      <!-- Row 2: Red -->
      <button class="playerRow playerRowBtn playerRow--red" :class="{ 'playerRow--active': currentSide === 'red' }" :title="playerDetailHint" @click="openPlayerDetail('red')">
        <span class="sdot sdot--red" />
        <span class="pname">{{ ctx.onlineSide === 'red' ? '你' : ctx.onlineSide === 'black' ? '敵' : 'RED' }}</span>
        <span class="playerHint">ⓘ</span>
        <span v-if="currentSide === 'red'" class="turnBadge turnBadge--red">▶ 回合</span>
        <span class="mres mrHp">♥ {{ kingHp.red ?? '?' }}</span>
        <span class="mres">💰 {{ res.red.gold }}</span>
        <span class="mres">🌟 {{ res.red.mana }}</span>
        <span class="mres">⚖ {{ res.red.storageMana }}</span>
      </button>
      <!-- Row 3: Phase + next + gear -->
      <div class="controlRow">
        <div class="phaseTabs">
          <div
            v-for="p in PHASE_TABS"
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
          @click="ctx.dispatch({ type: 'NEXT_PHASE', expectedPhase: currentPhase })"
        >{{ nextPhaseLabel }}</button>
        <div class="gearWrap">
          <template v-if="isOnline && connDotClass">
            <span class="connDot" :class="connDotClass" :title="connLabel" />
          </template>
          <button class="gearBtn" :class="{ gearActive: gearOpen }" @click="gearOpen = !gearOpen">⚙️</button>
          <div v-if="gearOpen" class="gearPop" @click.stop>
            <template v-if="!homePending">
              <button class="gearItem" @click="goHome">🏠 返回首頁</button>
            </template>
            <template v-else>
              <div class="gearItem gearSurrenderConfirm">確認返回首頁？</div>
              <div class="gearConfirmRow">
                <button class="gearItem gearClose" @click="goHome">確認</button>
                <button class="gearItem" @click="homePending = false">取消</button>
              </div>
            </template>
            <template v-if="isOnline">
              <div class="gearDivider" />
              <button class="gearItem" @click="conn.resyncNow(true); closeGear()">🔄 重新同步</button>
            </template>
            <template v-if="ctx.isPve">
              <div class="gearDivider" />
              <button class="gearItem" @click="ctx.cycleBotSpeed?.()">
                🤖 Bot速度：{{ ctx.botSpeedLabel?.value ?? '正常' }}
              </button>
            </template>
            <div class="gearDivider" />
            <button class="gearItem" @click="ui.cycleBodyFontSize()">🔤 字體：{{ ui.bodyFontSize }}px</button>
            <button class="gearItem" @click="ui.toggleAutoOpenShop()">🛒 買階段自動開商店：<span :class="ui.autoOpenShopOnBuy ? 'toggleOn' : 'toggleOff'">{{ ui.autoOpenShopOnBuy ? '開' : '關' }}</span></button>
            <div class="gearDivider" />
            <button v-if="!surrenderPending" class="gearItem gearSurrender" @click="surrender">🏳️ 投降</button>
            <template v-else>
              <div class="gearItem gearSurrenderConfirm">確認投降？</div>
              <div class="gearConfirmRow">
                <button class="gearItem gearClose" @click="surrender">確認</button>
                <button class="gearItem" @click="surrenderPending = false">取消</button>
              </div>
            </template>
            <button class="gearItem gearClose" @click="closeGear">✕ 關閉</button>
          </div>
          <div v-if="gearOpen" class="gearBackdrop" @click="gearOpen = false" />
        </div>
      </div>
    </header>

    <!-- ── Board area ── -->
    <div class="boardArea">
      <!-- Buff bar -->
      <div class="buffBar" :class="{ 'buffBar--collapsed': buffBarCollapsed }">
        <button class="buffToggle" @click="buffBarCollapsed = !buffBarCollapsed" :title="buffBarCollapsed ? '展開場效' : '收合場效'">
          {{ buffBarCollapsed ? '▶ 場效' : '▼ 場效' }}
        </button>
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
          v-for="tab in HAND_TABS"
          :key="tab"
          :class="['tabBtn', activeTab === tab && 'active']"
          @click="toggleTab(tab)"
        >
          <span class="tabIcon">{{ tab === 'souls' ? '🃏' : '🎒' }}</span>
          <span class="tabLabel">{{ tab === 'souls' ? '靈魂' : '道具' }}</span>
        </button>

        <button class="tabBtn tabShop" @click="ctx.openShop?.()">
          <span class="tabIcon">🏪</span>
          <span class="tabLabel">商店</span>
        </button>

        <button
          v-for="tab in UTIL_TABS"
          :key="tab"
          :class="['tabBtn', activeTab === tab && 'active']"
          @click="toggleTab(tab)"
        >
          <span class="tabIcon">{{ tab === 'panel' ? '📋' : '🛠' }}</span>
          <span class="tabLabel">{{ tab === 'panel' ? '面板' : '工具' }}</span>
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
          @show-detail="showHandSoulDetail"
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
          @show-item-detail="showHandItemDetail"
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
  overscroll-behavior: none;
  touch-action: pan-x pan-y;
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
.playerRowBtn {
  width: 100%;
  appearance: none;
  background: transparent;
  border-right: 0;
  border-top: 0;
  cursor: pointer;
  text-align: left;
}
.playerHint {
  font-size: 0.625rem;
  color: rgba(145, 202, 255, 0.72);
}
.playerRow--active {
  background: linear-gradient(90deg, rgba(82, 196, 26, 0.22) 0%, rgba(82, 196, 26, 0.07) 55%, rgba(0,0,0,0) 100%);
  border-left: 3px solid rgba(82, 196, 26, 0.95);
  border-bottom-color: rgba(82, 196, 26, 0.22);
}
.playerRow--red.playerRow--active {
  background: linear-gradient(90deg, rgba(255, 77, 79, 0.22) 0%, rgba(255, 77, 79, 0.07) 55%, rgba(0,0,0,0) 100%);
  border-left: 3px solid rgba(255, 77, 79, 0.95);
  border-bottom-color: rgba(255, 77, 79, 0.22);
}

.turnBadge {
  font-size: 0.5625rem; font-weight: 800;
  padding: 1px 5px; border-radius: 4px;
  border: 1px solid rgba(82, 196, 26, 0.55);
  background: rgba(82, 196, 26, 0.13);
  color: #b7eb8f;
  white-space: nowrap; letter-spacing: 0.05em;
}
.turnBadge--red {
  border-color: rgba(255, 77, 79, 0.55);
  background: rgba(255, 77, 79, 0.13);
  color: #ffb0b2;
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
.gearSurrender { border-color: rgba(250,173,20,0.25); color: rgba(250,210,80,0.85); }
.gearSurrender:hover { background: rgba(250,173,20,0.12); color: #ffd666; }
.toggleOn { color: #95de64; font-weight: 700; }
.toggleOff { color: #ff7875; font-weight: 700; }
.gearSurrenderConfirm { font-weight: 700; color: rgba(250,210,80,0.9); cursor: default; border-color: rgba(250,173,20,0.2); }
.gearSurrenderConfirm:hover { background: rgba(255,255,255,0.03); color: rgba(250,210,80,0.9); }
.gearConfirmRow { display: flex; gap: 6px; }
.gearConfirmRow .gearItem { flex: 1; text-align: center; }
.gearBackdrop { position: fixed; inset: 0; z-index: 199; }

/* ── Board area ── */
.boardArea {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.buffBar {
  position: sticky; top: 0; z-index: 10;
  display: flex; flex-wrap: wrap; gap: 4px;
  padding: 5px 8px;
  background: rgba(14, 16, 30, 0.92);
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  backdrop-filter: blur(6px);
}
.buffBar--collapsed {
  flex-wrap: nowrap;
  overflow-x: auto;
  touch-action: pan-x;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.2) transparent;
}
.buffBar--collapsed::-webkit-scrollbar { height: 3px; }
.buffBar--collapsed::-webkit-scrollbar-track { background: transparent; }
.buffBar--collapsed::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 99px; }
.buffToggle {
  position: sticky;
  left: 0;
  z-index: 2;
  flex-shrink: 0;
  font-size: 0.625rem;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.2);
  background: rgb(14, 16, 30);
  box-shadow: 6px 0 8px 4px rgb(14, 16, 30);
  color: rgba(255,255,255,0.55);
  cursor: pointer;
  white-space: nowrap;
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

.tabShop {
  background: rgba(232, 200, 60, 0.08);
  color: rgba(232, 210, 80, 0.75);
  border-right: 1px solid rgba(255, 255, 255, 0.06);
}
.tabShop:hover { background: rgba(232, 200, 60, 0.15); color: rgba(232, 210, 80, 1); }

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

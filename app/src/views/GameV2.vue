<script lang="ts">
export default { name: 'GameV2' }
</script>

<script setup lang="ts">
import { ref, computed, watch, watchEffect, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameSetup } from '../stores/gameSetup'
import { useConnection } from '../stores/connection'
import { useUiStore } from '../stores/ui'
import { createInitialState, type GameState } from '../engine'
import { useGameEffects } from '../composables/useGameEffects'
import { useActiveBuffs } from '../composables/useActiveBuffs'
import { useGameDispatch } from '../composables/useGameDispatch'
import { provideGameV2 } from '../composables/useGameV2Context'
import { decideActions, type BotContext } from '../sim/balanceBot'
import DesktopLayout from '../components/v2/DesktopLayout.vue'
import MobileLayout from '../components/v2/MobileLayout.vue'
import GameModalsV2 from '../components/v2/GameModalsV2.vue'
import CardUsageToast from '../components/CardUsageToast.vue'

// ── Window size (hard breakpoint 768px) ───────────────────────────────────────
const windowWidth = ref(window.innerWidth)
function onResize() { windowWidth.value = window.innerWidth }
onMounted(() => window.addEventListener('resize', onResize))
onUnmounted(() => window.removeEventListener('resize', onResize))
const isDesktop = computed(() => windowWidth.value >= 768)

// ── Game setup ─────────────────────────────────────────────────────────────────
const setup = useGameSetup()
const conn  = useConnection()
const ui    = useUiStore()
const router = useRouter()

const state = ref<GameState>(
  setup.mode === 'online' && conn.gameState
    ? conn.gameState
    : createInitialState({
      rules: {
        firstSide: setup.resolvedFirstPlayer,
        enabledClans: setup.enabledClans,
        rngMode: 'seeded',
        matchSeed: String(setup.matchSeed ?? 'default'),
      },
    })
)

// Online: sync state from connection
watch(() => conn.gameState, (gs) => {
  if (gs && setup.mode === 'online') state.value = gs
}, { immediate: true })

// ── FX + dispatch ──────────────────────────────────────────────────────────────
const {
  fxAttackUnitIds, fxHitUnitIds, fxKilledUnitIds, fxAbilityUnitIds,
  fxKilledPosKeys, fxRevivedPosKeys, fxEnchantedPosKeys,
  floatTextsByPos, fxBeams, damageToasts, incomeToasts, cardUsageToasts, itemUsedEvents, processEventFx,
} = useGameEffects()
const { dispatch, onlineWaiting, lastEvents, lastError } = useGameDispatch({ state, processEventFx, setup, conn })

// ── Error toast (e.g. 財力不足) ────────────────────────────────────────────────
const errorToastText = ref<string | null>(null)
let errorToastTimer: ReturnType<typeof setTimeout> | null = null
watch(lastError, (err) => {
  if (!err) return
  errorToastText.value = err
  if (errorToastTimer) clearTimeout(errorToastTimer)
  errorToastTimer = setTimeout(() => { errorToastText.value = null }, 1600)
})
watch(() => conn.errorMsg, (err) => {
  if (!err) return
  errorToastText.value = err
  if (errorToastTimer) clearTimeout(errorToastTimer)
  errorToastTimer = setTimeout(() => { errorToastText.value = null }, 2200)
})

// ── Active buffs ───────────────────────────────────────────────────────────────
const { activeBuffs } = useActiveBuffs(state)

// ── 3D toggle ─────────────────────────────────────────────────────────────────
const board3D = ref(localStorage.getItem('board3d') === '1')
watch(board3D, (v) => localStorage.setItem('board3d', v ? '1' : '0'))
function toggleBoard3D() { board3D.value = !board3D.value }

const sideSplashVisible = ref(false)
const sideSplashText = ref('')
const sideSplashColor = ref<'red' | 'black'>('red')
const splashActive = ref(true)

// ── PVE bot ────────────────────────────────────────────────────────────────────
const npcSide = computed<'red' | 'black' | null>(() => {
  if (setup.mode !== 'pve') return null
  return setup.resolvedPlayerSide === 'red' ? 'black' : 'red'
})

type BotSpeedKey = '最慢' | '慢' | '正常' | '快' | '即時'
const BOT_SPEED_OPTIONS: BotSpeedKey[] = ['最慢', '慢', '正常', '快', '即時']
const botRunning = ref(false)
const botSpeedLabel = ref<BotSpeedKey>(
  (['最慢', '慢', '正常', '快', '即時'] as BotSpeedKey[]).includes(
    localStorage.getItem('v2_bot_speed') as BotSpeedKey
  )
    ? (localStorage.getItem('v2_bot_speed') as BotSpeedKey)
    : '正常'
)
watch(botSpeedLabel, (v) => localStorage.setItem('v2_bot_speed', v))
let botSeed = Date.now()

function cycleBotSpeed() {
  const idx = BOT_SPEED_OPTIONS.indexOf(botSpeedLabel.value)
  botSpeedLabel.value = BOT_SPEED_OPTIONS[(idx + 1) % BOT_SPEED_OPTIONS.length] ?? '正常'
}

const botDelays = computed((): { init: number; action: number } => {
  switch (botSpeedLabel.value) {
    case '最慢': return { init: 1800, action: 1800 }
    case '慢':   return { init: 1000, action: 1000 }
    case '快':   return { init: 120,  action: 60  }
    case '即時': return { init: 0,    action: 0   }
    default:     return { init: 800,  action: 700 }
  }
})

function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)) }

// ──────────────── 修改重點：這裡的 watch ────────────────────────
watch(
  () => [state.value.turn.side, state.value.turn.phase, splashActive.value] as const,
  async ([side, phase, isSplashActive]) => {
    // 為了 debug，先印出每次觸發的狀態（之後可以註解或刪除）
    console.log('[BOT WATCH TRIGGER]', {
      side,
      phase,
      isSplashActive,
      npcSide: npcSide.value,
      botRunning: botRunning.value
    })

    // 基本防呆條件
    if (!npcSide.value) return
    if (side !== npcSide.value) return
    if (botRunning.value) return

    // 如果 splash 還在顯示 → 先跳過，不執行 bot
    if (isSplashActive) {
      console.log('[BOT] Splash 還在顯示，暫不行動')
      return
    }

    // 跳過 turnStart 階段
    if (phase === 'turnStart') {
      console.log('[BOT] 目前是 turnStart 階段，跳過')
      return
    }

    // 到這裡代表：splash 已結束 + 輪到 bot + 不是 turnStart
    console.log('[BOT] Splash 已結束，開始執行 bot 決策', { phase })

    botRunning.value = true

    // 初始延遲
    await sleep(botDelays.value.init)

    const weightsMode = setup.difficulty === 'easy' ? 'base' : 'blend'
    const ctx: BotContext = { seed: botSeed++, epsilon: 0, weightsMode }

    const result = decideActions(state.value, side as 'red' | 'black', ctx)

    for (const action of result.actions) {
      console.log('[BOT ACTION]', action)
      dispatch(action)
      // 注意：只有非 NEXT_PHASE 的動作才需要等待
      if (action.type !== 'NEXT_PHASE') {
        await sleep(botDelays.value.action)
      }
    }

    botRunning.value = false
    console.log('[BOT] 本回合 bot 行動結束')
  },
  { immediate: true }
)

// ── Win detection ──────────────────────────────────────────────────────────────
const winnerSide = computed(() => {
  const statusWinner = state.value.status?.winnerSide ?? null
  if (statusWinner) return statusWinner
  const hasRedKing   = Object.values(state.value.units).some((u) => u.side === 'red'   && u.base === 'king')
  const hasBlackKing = Object.values(state.value.units).some((u) => u.side === 'black' && u.base === 'king')
  if (!hasRedKing && hasBlackKing) return 'black'
  if (!hasBlackKing && hasRedKing) return 'red'
  return null
})
const kingDying = ref(false)
watch(winnerSide, (w) => {
  if (!w) return
  kingDying.value = true
  setTimeout(() => router.push({ name: 'gameOver', query: { winner: w } }), 2000)
}, { immediate: true })

// ── Online turn lock ───────────────────────────────────────────────────────────
const isMyTurn = computed(() =>
  setup.mode !== 'online' || conn.side === state.value.turn.side
)
const onlineBusy = computed(() =>
  setup.mode === 'online' && (onlineWaiting.value || conn.isSyncing || conn.isSendingAction || conn.status === 'connecting')
)
const actionLocked = computed(() => {
  if (splashActive.value) return true
  if (kingDying.value) return true
  if (setup.mode === 'online') return !isMyTurn.value || onlineBusy.value
  if (setup.mode === 'pve')    return botRunning.value
  return false
})

// ── Effects / Events modals ────────────────────────────────────────────────────
const effectsOpen = ref(false)
const eventsOpen  = ref(false)

// ── Online side-assignment splash ──────────────────────────────────────────────
const CLAN_LABELS: Record<string, string> = {
  dark_moon: '🌙暗月', styx: '💧冥河', eternal_night: '🌑永夜', iron_guard: '🛡️鐵衛',
  gold_merc: '💰金傭', death_oath: '🩸死誓',
}

onMounted(() => {
  const clans = (state.value.rules.enabledClans ?? []).map((c) => CLAN_LABELS[c] ?? c).join('・')
  function showSplash(text: string, color: 'red' | 'black') {
    sideSplashText.value = text
    sideSplashColor.value = color
    splashActive.value = true
    sideSplashVisible.value = true
    setTimeout(() => { sideSplashVisible.value = false; splashActive.value = false }, 3500)
  }
  if (setup.mode === 'online' && conn.side) {
    const sideLabel = conn.side === 'red' ? '你是 RED 紅方' : '你是 BLACK 黑方'
    showSplash(`${sideLabel}\n${clans}`, conn.side)
  } else if (setup.mode === 'pve') {
    const mySide = setup.resolvedPlayerSide
    const sideLabel = mySide === 'red' ? '你是 RED 紅方' : '你是 BLACK 黑方'
    showSplash(`${sideLabel}\n${clans}`, mySide)
  } else {
    const firstSide = setup.resolvedFirstPlayer
    const sideLabel = firstSide === 'red' ? '先手：紅方' : '先手：黑方'
    showSplash(`${sideLabel}\n${clans}`, firstSide)
  }
})

// ── Clear all interaction state on any phase transition ────────────────────────
watch(
  () => state.value.turn.phase,
  () => {
    ui.clearInteractionMode()
    ui.clearPendingConfirm()
    ui.clearShootPreview()
  },
)

// ── Auto-open shop at buy phase (human turn only) ──────────────────────────────
const autoShopOpenedForCurrentBuy = ref(false)
watch(
  () => [state.value.turn.phase, state.value.turn.side, splashActive.value] as const,
  ([phase, side, isSplashActive], prevTuple) => {
    const [prevPhase, prevSide] = prevTuple ?? []
    if (phase !== 'buy') {
      autoShopOpenedForCurrentBuy.value = false
      return
    }
    if (prevPhase !== phase || prevSide !== side) autoShopOpenedForCurrentBuy.value = false
    if (isSplashActive) return
    if (autoShopOpenedForCurrentBuy.value) return
    if (setup.mode === 'pve' && side === npcSide.value) return
    if (setup.mode === 'online' && conn.side !== side) return
    autoShopOpenedForCurrentBuy.value = true
    if (ui.autoOpenShopOnBuy) setTimeout(() => ui.openShop(), 1600)
  },
  { immediate: true },
)

// ── Turn-based background ──────────────────────────────────────────────────────
watchEffect(() => {
  document.body.style.backgroundImage =
    state.value.turn.side === 'red'
      ? 'linear-gradient(180deg, rgba(255, 77, 79, 0.22) 0%, rgba(0,0,0,0) 50%)'
      : 'linear-gradient(180deg, rgba(82, 196, 26, 0.22) 0%, rgba(0,0,0,0) 50%)'
})

// ── Disable pull-to-refresh when any modal is open ─────────────────────────────
watchEffect(() => {
  const anyOpen = ui.shopOpen || ui.allUnitsOpen || effectsOpen.value || eventsOpen.value || splashActive.value
  document.body.style.overscrollBehavior = anyOpen ? 'none' : ''
})

watchEffect(() => {
  document.body.style.cursor = onlineBusy.value ? 'wait' : ''
})

onUnmounted(() => {
  document.body.style.backgroundImage = ''
  document.body.style.cursor = ''
  if (setup.mode === 'online') conn.disconnect()
})

// ── Provide game context to layout children ────────────────────────────────────
provideGameV2({
  state,
  dispatch,
  onlineSide:     setup.mode === 'online' ? (conn.side ?? null) : null,
  get actionLocked() { return actionLocked.value },
  get activeBuffs()  { return activeBuffs.value },
  get board3D()      { return board3D.value },
  toggleBoard3D,
  openShop:      () => ui.openShop(),
  openAllUnits:  () => ui.openAllUnits(),
  openEffects:   () => { effectsOpen.value = true },
  openEvents:    () => { eventsOpen.value  = true },
  lastEvents,
  effectsOpen,
  eventsOpen,
  isPve:         setup.mode === 'pve',
  botRunning,
  botSpeedLabel,
  cycleBotSpeed,
  fx: {
    fxAttackUnitIds,
    fxHitUnitIds,
    fxKilledUnitIds,
    fxAbilityUnitIds,
    fxKilledPosKeys,
    fxRevivedPosKeys,
    fxEnchantedPosKeys,
    itemUsedEvents,
    floatTextsByPos,
    fxBeams,
    damageToasts,
    incomeToasts,
    cardUsageToasts,
  },
})
</script>

<template>
  <div class="gameRoot">
    <DesktopLayout v-if="isDesktop" />
    <MobileLayout  v-else />
    <GameModalsV2 />

    <CardUsageToast :toasts="cardUsageToasts" />

    <Transition name="error-toast">
      <div v-if="errorToastText" class="errorToast">{{ errorToastText }}</div>
    </Transition>

    <div v-if="kingDying" class="kingDyingOverlay" />

    <div v-if="splashActive" class="splashBlocker" />
    <div v-if="onlineBusy" class="syncBlocker">
      <div class="syncPanel">{{ conn.isSendingAction ? '送出中…' : '同步中…' }}</div>
    </div>
    <Transition name="side-splash">
      <div
        v-if="sideSplashVisible"
        class="sideSplash"
        :class="sideSplashColor === 'red' ? 'splashRed' : 'splashGreen'"
      >
        <div v-for="(line, i) in sideSplashText.split('\n')" :key="i" :class="i === 1 ? 'splashClanLine' : ''">
          {{ line }}
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.sideSplash {
  position: fixed;
  inset: 0;
  z-index: 9200;
  display: grid;
  place-items: center;
  font-size: 2.5rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  text-shadow: 0 0 40px currentColor;
}
.splashBlocker {
  position: fixed;
  inset: 0;
  z-index: 9150;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(3px);
  pointer-events: all;
  touch-action: none;
}
.syncBlocker {
  position: fixed;
  inset: 0;
  z-index: 9170;
  background: rgba(6, 10, 18, 0.22);
  backdrop-filter: blur(1px);
  pointer-events: all;
  touch-action: none;
  cursor: wait;
  display: grid;
  place-items: start center;
  padding-top: 84px;
}
.syncPanel {
  min-width: 132px;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(12, 18, 30, 0.92);
  color: rgba(240, 245, 255, 0.94);
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.32);
}
.splashRed   { color: #ffb0b2; }
.splashGreen { color: #b7eb8f; }
.splashClanLine { font-size: 1.2rem; font-weight: 600; margin-top: 12px; letter-spacing: 0.1em; opacity: 0.85; }

.side-splash-enter-active { transition: opacity 0.5s ease; }
.side-splash-leave-active { transition: opacity 1.2s ease; }
.side-splash-enter-from,
.side-splash-leave-to { opacity: 0; }

.errorToast {
  position: fixed;
  top: 76px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(35, 16, 16, 0.96);
  color: #ffb0b2;
  border: 1px solid rgba(255, 77, 79, 0.65);
  padding: 8px 24px;
  border-radius: 10px;
  font-size: 0.9375rem;
  font-weight: 700;
  z-index: 9100;
  pointer-events: none;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.55), 0 0 14px rgba(255, 77, 79, 0.22);
  white-space: nowrap;
  letter-spacing: 0.04em;
}

.error-toast-enter-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.error-toast-leave-active { transition: opacity 0.35s ease, transform 0.35s ease; }
.error-toast-enter-from   { opacity: 0; transform: translateX(-50%) translateY(-12px); }
.error-toast-leave-to     { opacity: 0; transform: translateX(-50%) translateY(-8px); }

.kingDyingOverlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(3px);
  pointer-events: all;
  animation: kingDyingPulse 0.6s ease-in-out infinite alternate;
}

@keyframes kingDyingPulse {
  from { background: rgba(0, 0, 0, 0.62); }
  to   { background: rgba(180, 0, 0, 0.32); }
}
</style>

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
    : createInitialState({ rules: { firstSide: setup.resolvedFirstPlayer, enabledClans: setup.enabledClans } as any })
)

// Online: sync state from connection
watch(() => conn.gameState, (gs) => {
  if (gs && setup.mode === 'online') state.value = gs
}, { immediate: true })

// ── FX + dispatch ──────────────────────────────────────────────────────────────
const {
  fxAttackUnitIds, fxHitUnitIds, fxKilledUnitIds, fxAbilityUnitIds,
  fxKilledPosKeys, fxRevivedPosKeys, fxEnchantedPosKeys,
  floatTextsByPos, fxBeams, damageToasts, processEventFx,
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

// ── Active buffs ───────────────────────────────────────────────────────────────
const { activeBuffs } = useActiveBuffs(state)

// ── 3D toggle ─────────────────────────────────────────────────────────────────
const board3D = ref(localStorage.getItem('board3d') === '1')
watch(board3D, (v) => localStorage.setItem('board3d', v ? '1' : '0'))
function toggleBoard3D() { board3D.value = !board3D.value }

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
    default:     return { init: 500,  action: 300 }
  }
})

function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)) }

watch(
  () => [state.value.turn.side, state.value.turn.phase] as const,
  async ([side, phase]) => {
    if (!npcSide.value || side !== npcSide.value || botRunning.value) return
    if (phase === 'turnStart') return
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

// ── Online turn lock ───────────────────────────────────────────────────────────
const isMyTurn = computed(() =>
  setup.mode !== 'online' || conn.side === state.value.turn.side
)
const actionLocked = computed(() => {
  if (setup.mode === 'online') return !isMyTurn.value || onlineWaiting.value
  if (setup.mode === 'pve')    return botRunning.value
  return false
})

// ── Win detection ──────────────────────────────────────────────────────────────
const winnerSide = computed(() => {
  const hasRedKing   = Object.values(state.value.units).some((u) => u.side === 'red'   && u.base === 'king')
  const hasBlackKing = Object.values(state.value.units).some((u) => u.side === 'black' && u.base === 'king')
  if (!hasRedKing && hasBlackKing) return 'black'
  if (!hasBlackKing && hasRedKing) return 'red'
  return null
})
watch(winnerSide, (w) => { if (w) router.push({ name: 'gameOver', query: { winner: w } }) }, { immediate: true })

// ── Effects / Events modals ────────────────────────────────────────────────────
const effectsOpen = ref(false)
const eventsOpen  = ref(false)

// ── Online side-assignment splash ──────────────────────────────────────────────
const CLAN_LABELS: Record<string, string> = {
  dark_moon: '🌙暗月', styx: '💧冥河', eternal_night: '🌑永夜', iron_guard: '🛡️鐵衛',
}
const sideSplashVisible = ref(false)
const sideSplashText = ref('')

onMounted(() => {
  if (setup.mode === 'online' && conn.side) {
    const sideLabel = conn.side === 'red' ? '你是 RED 紅方' : '你是 BLACK 黑方'
    const clans = (state.value.rules.enabledClans ?? []).map((c) => CLAN_LABELS[c] ?? c).join('・')
    sideSplashText.value = `${sideLabel}\n${clans}`
    sideSplashVisible.value = true
    setTimeout(() => { sideSplashVisible.value = false }, 5000)

    // Auto-resync when tab regains focus (e.g. after backgrounding)
    const onVisible = () => { if (!document.hidden) conn._fetchState() }
    document.addEventListener('visibilitychange', onVisible)
    onUnmounted(() => document.removeEventListener('visibilitychange', onVisible))
  }
})

// ── Auto-open shop at buy phase (human turn only) ──────────────────────────────
watch(
  () => [state.value.turn.phase, state.value.turn.side] as const,
  ([phase, side]) => {
    if (phase !== 'buy') return
    if (setup.mode === 'pve' && side === npcSide.value) return  // skip bot turns
    if (setup.mode === 'online' && conn.side !== side) return   // skip opponent turns
    ui.openShop()
  },
)

// ── Turn-based background ──────────────────────────────────────────────────────
watchEffect(() => {
  document.body.style.backgroundImage =
    state.value.turn.side === 'red'
      ? 'linear-gradient(180deg, rgba(255, 77, 79, 0.22) 0%, rgba(0,0,0,0) 50%)'
      : 'linear-gradient(180deg, rgba(82, 196, 26, 0.22) 0%, rgba(0,0,0,0) 50%)'
})

onUnmounted(() => {
  document.body.style.backgroundImage = ''
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
    floatTextsByPos,
    fxBeams,
    damageToasts,
  },
})
</script>

<template>
  <DesktopLayout v-if="isDesktop" />
  <MobileLayout  v-else />
  <GameModalsV2 />

  <Transition name="error-toast">
    <div v-if="errorToastText" class="errorToast">{{ errorToastText }}</div>
  </Transition>

  <Transition name="side-splash">
    <div
      v-if="sideSplashVisible"
      class="sideSplash"
      :class="conn.side === 'red' ? 'splashRed' : 'splashGreen'"
    >
      <div v-for="(line, i) in sideSplashText.split('\n')" :key="i" :class="i === 1 ? 'splashClanLine' : ''">
        {{ line }}
      </div>
    </div>
  </Transition>
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
</style>

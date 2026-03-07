<script setup lang="ts">
import { computed, ref, inject, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import type { Phase, Side } from '../../engine'
import { useConnection } from '../../stores/connection'
import { useGameSetup } from '../../stores/gameSetup'
import { GAME_V2_KEY, type GameV2Ctx } from '../../composables/useGameV2Context'

const gameCtx = inject(GAME_V2_KEY) as GameV2Ctx | null

const props = defineProps<{
  currentSide: Side
  currentPhase: Phase
  necroUsed: number
  necroMax: number
  blackHp: number | null
  blackGold: number
  blackMana: number
  blackStorageMana: number
  redHp: number | null
  redGold: number
  redMana: number
  redStorageMana: number
  onlineSide?: 'red' | 'black' | null
  actionLocked?: boolean
}>()

const emit = defineEmits<{ nextPhase: [] }>()

const router = useRouter()
const conn   = useConnection()
const setup  = useGameSetup()

const PHASE_LABELS: Partial<Record<Phase, string>> = {
  buy: '購買', necro: '死靈術', combat: '戰鬥',
}

const nextPhaseLabel = computed(() => {
  if (props.currentPhase === 'buy')    return '進入死靈術 →'
  if (props.currentPhase === 'necro')  return '進入戰鬥 →'
  if (props.currentPhase === 'combat') return '結束回合 →'
  return '下一階段 →'
})

const nextBtnClass = computed(() =>
  props.currentSide === 'red' ? 'nextRed' : 'nextGreen'
)

// ── Connection ─────────────────────────────────────────────────────────────────
const isOnline = computed(() => setup.mode === 'online')

const connDotClass = computed(() => {
  if (!isOnline.value) return null
  switch (conn.status) {
    case 'playing':    return 'dot--green'
    case 'waiting':    return 'dot--yellow'
    case 'connecting': return 'dot--yellow'
    case 'error':      return 'dot--red'
    default:           return 'dot--gray'
  }
})
const connLabel = computed(() => {
  const labels: Record<string, string> = {
    playing: '已連線', waiting: '等待對手', connecting: '連線中', error: '連線錯誤',
  }
  return labels[conn.status] ?? conn.status
})

// ── Gear popover ───────────────────────────────────────────────────────────────
const gearOpen = ref(false)

function closeGear() { gearOpen.value = false }
function goHome() { router.push({ name: 'home' }); closeGear() }

onMounted(() => {
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') gearOpen.value = false }
  window.addEventListener('keydown', onKey)
  onUnmounted(() => window.removeEventListener('keydown', onKey))
})
</script>

<template>
  <header class="statusBar" :class="currentSide === 'red' ? 'bar--red' : 'bar--black'">
    <!-- 黑方 -->
    <div class="playerBlock" :class="{ active: currentSide === 'black' }">
      <span class="sideDot sideBlack" />
      <span class="playerLabel">
        {{ onlineSide === 'black' ? '你' : onlineSide === 'red' ? '敵' : 'BLACK' }}
      </span>
      <span v-if="currentSide === 'black'" class="turnBadge turnBadge--black">▶ 回合</span>
      <span class="hp">♥ {{ blackHp ?? '?' }}</span>
      <span class="res">💰 <span class="resLbl">財力</span> {{ blackGold }}</span>
      <span class="res">🌟 <span class="resLbl">魔力</span> {{ blackMana }}</span>
      <span class="res">⚖ <span class="resLbl">存魔</span> {{ blackStorageMana }}</span>
    </div>

    <!-- 中央控制 -->
    <div class="centerBlock">
      <div class="phaseTabs">
        <div
          v-for="p in (['buy', 'necro', 'combat'] as Phase[])"
          :key="p"
          class="phaseTab"
          :class="{ active: currentPhase === p, [`tab-${p}`]: true }"
        >
          <span class="tabIcon">{{ p === 'buy' ? '💰' : p === 'necro' ? '⚗️' : '⚔️' }}</span>
          <span class="tabLabel">{{ PHASE_LABELS[p] }}</span>
          <span v-if="p === 'necro' && currentPhase === 'necro'" class="tabCounter">
            {{ necroUsed }}/{{ necroMax }}
          </span>
        </div>
       

      <button
        class="nextBtn"
        :class="nextBtnClass"
        :disabled="actionLocked"
        @click="emit('nextPhase')"
      >{{ nextPhaseLabel }}</button>
      <span style="margin: auto 0.5rem;">|</span>
      <button
        class="shopShortcut"
        title="開啟商店"
        @click="gameCtx?.openShop?.()"
      >🏪開啟商店</button>
    </div>
    </div>

    <!-- 紅方 + 齒輪（包在 rightSide 內） -->
    <div class="rightSide">
      <div class="playerBlock sideRed" :class="{ active: currentSide === 'red' }">
        <span class="sideDot sideRedDot" />
        <span class="playerLabel">
          {{ onlineSide === 'red' ? '你' : onlineSide === 'black' ? '敵' : 'RED' }}
        </span>
        <span v-if="currentSide === 'red'" class="turnBadge turnBadge--red">▶ 回合</span>
        <span class="hp">♥ {{ redHp ?? '?' }}</span>
        <span class="res">💰 <span class="resLbl">財力</span> {{ redGold }}</span>
        <span class="res">🌟 <span class="resLbl">魔力</span> {{ redMana }}</span>
        <span class="res">⚖ <span class="resLbl">存魔</span> {{ redStorageMana }}</span>
      </div>

      <!-- 連線品質 + 商店 + 齒輪（獨立於紅方資訊格外） -->
      <div class="rightTools">
        <template v-if="isOnline">
          <span class="connDot" :class="connDotClass ?? 'dot--gray'" :title="connLabel" />
          <span class="connLabel">{{ connLabel }}</span>
        </template>

        <!-- <button
          class="shopBtn"
          :disabled="actionLocked"
          title="開啟商店"
          @click="gameCtx?.openShop?.()"
        >🏪開啟商店</button> -->

        <div class="gearWrap">
          <button class="gearBtn" :class="{ gearActive: gearOpen }" @click="gearOpen = !gearOpen">⚙️</button>
          <div v-if="gearOpen" class="gearPopover" @click.stop>
            <div class="gearTitle">選項</div>
            <button class="gearItem" @click="goHome">🏠 返回首頁</button>
            <template v-if="isOnline">
              <div class="gearDivider" />
              <button class="gearItem" @click="conn._fetchState(); closeGear()">🔄 重新同步</button>
            </template>
            <template v-if="gameCtx?.isPve">
              <div class="gearDivider" />
              <button class="gearItem" @click="gameCtx?.cycleBotSpeed?.()">
                🤖 Bot速度：{{ gameCtx?.botSpeedLabel?.value ?? '正常' }}
              </button>
            </template>
            <button class="gearItem gearClose" @click="closeGear">✕ 關閉</button>
          </div>
          <div v-if="gearOpen" class="gearBackdrop" @click="closeGear" />
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.statusBar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  height: 58px;
  padding: 0 12px;
  background: linear-gradient(90deg,
    rgba(10, 12, 26, 0.97) 0%,
    rgba(20, 22, 40, 0.97) 40%,
    rgba(20, 22, 40, 0.97) 60%,
    rgba(10, 12, 26, 0.97) 100%
  );
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(10px);
  flex-shrink: 0;
  transition: border-bottom-color 0.4s;
}

.bar--red   { border-bottom-color: rgba(255, 90, 90, 0.45); }
.bar--black { border-bottom-color: rgba(82, 196, 26, 0.45); }

/* ── Player block ── */
.playerBlock {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 10px;
  border: 1px solid transparent;
  transition: border-color 0.3s, background 0.3s, box-shadow 0.3s;
  min-width: 0;
}

.playerBlock.active {
  background: linear-gradient(90deg, rgba(82, 196, 26, 0.22) 0%, rgba(82, 196, 26, 0.07) 60%, rgba(0,0,0,0) 100%);
  border-color: rgba(80, 200, 80, 0.72);
  box-shadow: 0 0 18px rgba(80, 200, 80, 0.28);
  border-left: 3px solid rgba(82, 196, 26, 1);
}
.playerBlock.sideRed.active {
  background: linear-gradient(90deg, rgba(255, 77, 79, 0.22) 0%, rgba(255, 77, 79, 0.07) 60%, rgba(0,0,0,0) 100%);
  border-color: rgba(255, 100, 100, 0.72);
  box-shadow: 0 0 18px rgba(255, 80, 80, 0.28);
  border-left: 3px solid rgba(255, 77, 79, 1);
}

.sideDot {
  width: 8px; height: 8px;
  border-radius: 50%; flex-shrink: 0;
}
.sideDot.sideBlack  { background: #52c41a; box-shadow: 0 0 5px rgba(82, 196, 26, 0.7); }
.sideDot.sideRedDot { background: #ff4d4f; box-shadow: 0 0 5px rgba(255, 77, 79, 0.7); }

.playerLabel {
  font-size: 0.8125rem; font-weight: 700;
  letter-spacing: 0.08em; color: rgba(255,255,255,0.45);
  text-transform: uppercase; white-space: nowrap;
}

.turnBadge {
  font-size: 0.5625rem; font-weight: 800;
  padding: 1px 5px; border-radius: 4px;
  border: 1px solid; white-space: nowrap;
  letter-spacing: 0.05em;
}
.turnBadge--black { color: #b7eb8f; border-color: rgba(82,196,26,0.55); background: rgba(82,196,26,0.13); }
.turnBadge--red   { color: #ffb0b2; border-color: rgba(255,77,79,0.55); background: rgba(255,77,79,0.13); }

.hp {
  font-weight: 700; font-size: 1.0625rem;
  color: #ff9c9e; white-space: nowrap;
  display: flex; align-items: center; gap: 3px;
}
.res { font-size: 0.875rem; color: rgba(255,255,255,0.75); white-space: nowrap; display: flex; align-items: center; gap: 3px; }
.resLbl { font-size: 0.6875rem; opacity: 0.55; letter-spacing: 0; }

/* ── Center ── */
.centerBlock {
  display: flex; align-items: center; gap: 10px; flex-shrink: 0;
}

.phaseTabs {
  display: flex; gap: 4px;
}

.phaseTab {
  display: flex; flex-direction: row; align-items: center; gap: 5px;
  padding: 5px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.06);
  background: rgba(0,0,0,0.2);
  opacity: 0.38;
  transition: opacity 0.2s, background 0.2s, border-color 0.2s;
  cursor: default;
  white-space: nowrap;
}
.phaseTab.active {
  opacity: 1;
  background: rgba(255,255,255,0.07);
  border-color: rgba(255,255,255,0.15);
}
.tab-buy.active   { border-color: rgba(232,200,60,0.4); }
.tab-necro.active { border-color: rgba(179,127,235,0.4); }
.tab-combat.active { border-color: rgba(255,120,70,0.4); }

.tabIcon  { font-size: 1rem; line-height: 1; }
.tabLabel { font-size: 0.75rem; font-weight: 600; letter-spacing: 0.04em; color: rgba(255,255,255,0.72); }
.tabCounter {
  font-family: ui-monospace, monospace; font-size: 0.625rem;
  color: #b37feb;
}

.shopShortcut {
  padding: 5px 8px;
  border-radius: 8px;
  text-align: center;
  align-items: center;
  font-size: 1rem;
  line-height: 1;
  border: 2px solid rgba(232,200,60,0.35);
  background: rgba(232,200,60,0.1);
  cursor: pointer;
  transition: background 0.15s;
  font-family: 'Courier New', Courier, monospace;
}
.shopShortcut:hover:not(:disabled) {
  background: rgba(232,200,60,0.22);
}
.shopShortcut:disabled { opacity: 0.3; cursor: not-allowed; }

.nextBtn {
  padding: 7px 16px;
  border-radius: 8px;
  font-size: 0.9375rem; font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;
  white-space: nowrap;
}
.nextRed {
  background: rgba(255,77,79,0.15);
  border: 1px solid rgba(255,100,100,0.45);
  color: #ffb0b2;
}
.nextRed:hover:not(:disabled) {
  background: rgba(255,77,79,0.28);
  box-shadow: 0 0 12px rgba(255,77,79,0.2);
}
.nextGreen {
  background: rgba(82,196,26,0.12);
  border: 1px solid rgba(82,196,26,0.45);
  color: #b7eb8f;
}
.nextGreen:hover:not(:disabled) {
  background: rgba(82,196,26,0.22);
  box-shadow: 0 0 12px rgba(82,196,26,0.2);
}
.nextBtn:disabled { opacity: 0.3; cursor: not-allowed; }

/* ── Right side wrapper (red block + gear) ── */
.rightSide {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ── Right tools (gear + conn, separate from red block) ── */
.rightTools {
  display: flex; align-items: center; gap: 6px;
}

.connDot {
  width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
}
.dot--green  { background: #52c41a; box-shadow: 0 0 5px rgba(82,196,26,0.7); }
.dot--yellow { background: #faad14; box-shadow: 0 0 5px rgba(250,173,20,0.7); }
.dot--red    { background: #ff4d4f; box-shadow: 0 0 5px rgba(255,77,79,0.7); }
.dot--gray   { background: rgba(255,255,255,0.25); }

.connLabel {
  font-size: 0.5625rem; color: rgba(255,255,255,0.4); white-space: nowrap;
}

/* ── Shop btn ── */
.shopBtn {
  width: auto; height: 28px; padding: 0;
  font-size: 0.875rem;
  background: rgba(232, 200, 60, 0.08);
  border: 1px solid rgba(232, 200, 60, 0.25);
  border-radius: 7px;
  cursor: pointer;
  display: flex;
  transition: background 0.15s, border-color 0.15s;
}
.shopBtn:hover:not(:disabled) {
  background: rgba(232, 200, 60, 0.2);
  border-color: rgba(232, 200, 60, 0.5);
}
.shopBtn:disabled { opacity: 0.3; cursor: not-allowed; }

/* ── Gear ── */
.gearWrap { position: relative; }

.gearBtn {
  width: 28px; height: 28px; padding: 0;
  font-size: 0.9rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 7px;
  color: rgba(255,255,255,0.45);
  cursor: pointer;
  display: grid; place-items: center;
  transition: background 0.15s, border-color 0.15s;
}
.gearBtn:hover, .gearBtn.gearActive {
  background: rgba(255,255,255,0.1);
  border-color: rgba(255,255,255,0.25);
  color: rgba(255,255,255,0.85);
}

.gearPopover {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 160px;
  background: rgba(16, 18, 36, 0.98);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px;
  padding: 8px;
  display: flex; flex-direction: column; gap: 4px;
  z-index: 200;
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
}

.gearTitle {
  font-size: 0.625rem; font-weight: 700;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.35);
  padding: 2px 8px 6px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  margin-bottom: 4px;
  text-transform: uppercase;
}

.gearDivider {
  height: 1px;
  background: rgba(255, 255, 255, 0.07);
  margin: 4px 0;
}

.gearItem {
  width: 100%;
  padding: 8px 12px;
  text-align: left;
  font-size: 0.8125rem;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 7px;
  color: rgba(255,255,255,0.75);
  cursor: pointer;
  transition: background 0.12s;
}
.gearItem:hover { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.95); }
.gearClose { border-color: rgba(255,77,79,0.2); color: rgba(255,150,150,0.8); }
.gearClose:hover { background: rgba(255,77,79,0.12); color: #ffb0b2; }

.gearBackdrop {
  position: fixed; inset: 0; z-index: 199;
}
</style>

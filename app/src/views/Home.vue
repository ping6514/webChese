<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGameSetup, type GameMode, type SideOrRandom, type Difficulty } from '../stores/gameSetup'
import { useThemeStore } from '../stores/theme'
import { useConnection } from '../stores/connection'

const router = useRouter()
const setup = useGameSetup()
const theme = useThemeStore()
const conn = useConnection()

const mode = ref<GameMode>(setup.mode)
const playerSide = ref<SideOrRandom>(setup.playerSide)
const firstPlayer = ref<SideOrRandom>(setup.firstPlayer)
const difficulty = ref<Difficulty>(setup.difficulty)

const isPve = computed(() => mode.value === 'pve')
const isOnline = computed(() => mode.value === 'online')

// ── Online sub-state ───────────────────────────────────────────────────────
type OnlineAction = 'create' | 'join'
const onlineAction = ref<OnlineAction>('create')
const joinRoomId = ref('')
const onlineLoading = ref(false)
const onlineError = ref('')
const createdRoomId = ref('')

// Debug: check if env vars are baked in at build time
const supabaseUrlOk = !!(import.meta.env.VITE_SUPABASE_URL)
const supabaseKeyOk = !!(import.meta.env.VITE_SUPABASE_ANON_KEY)

// Auto-navigate when opponent joins (create mode: waiting → playing)
watch(() => conn.status, (s) => {
  if (s === 'playing' && mode.value === 'online') {
    setup.mode = 'online'
    router.push({ name: 'game' })
  }
})

async function handleOnlineStart() {
  onlineError.value = ''
  onlineLoading.value = true
  try {
    if (onlineAction.value === 'create') {
      const roomId = await conn.createRoom()
      if (!roomId) {
        onlineError.value = conn.errorMsg ?? '建立失敗'
      } else {
        createdRoomId.value = roomId
      }
    } else {
      const id = joinRoomId.value.trim().toUpperCase()
      if (!id) { onlineLoading.value = false; onlineError.value = '請輸入房間碼'; return }
      const ok = await conn.joinRoom(id)
      if (ok) {
        setup.mode = 'online'
        router.push({ name: 'game' })
      } else {
        onlineError.value = conn.errorMsg ?? '加入失敗'
      }
    }
  } catch (e) {
    onlineError.value = `[JS Error] ${e instanceof Error ? e.message : String(e)}`
  }
  onlineLoading.value = false
}

function copyRoomId() {
  navigator.clipboard.writeText(createdRoomId.value)
}

// ── Local game start ───────────────────────────────────────────────────────
const buildLabel = new Date(__BUILD_TIME__).toLocaleString('zh-TW', {
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit',
})

function startGame() {
  setup.mode = mode.value
  setup.playerSide = playerSide.value
  setup.firstPlayer = firstPlayer.value
  setup.difficulty = difficulty.value
  setup.resolve()
  router.push({ name: 'game' })
}
</script>

<template>
  <div class="page">
    <div class="topBtns">
      <!-- 主題旋鈕 -->
      <div
        class="themeSwitch"
        :class="{ 'is-light': theme.current === 'light' }"
        @click="theme.toggle()"
        :title="theme.current === 'dark' ? '目前：暗色 ── 點擊切換亮色' : '目前：亮色 ── 點擊切換暗色'"
      >
        <span class="switchLabel">🌙 暗色</span>
        <div class="switchTrack">
          <div class="switchKnob"></div>
        </div>
        <span class="switchLabel">☀️ 亮色</span>
      </div>
      <button type="button" class="iconBtn" title="規則與卡牌圖鑑" @click="router.push({ name: 'intro' })">
        📖
      </button>
    </div>

    <h1 class="title">幽冥棋</h1>
    <div class="buildVer">build {{ buildLabel }}</div>

    <div class="card">
      <!-- 遊戲模式 -->
      <div class="section">
        <div class="section-label">遊戲模式</div>
        <div class="btn-group">
          <button
            type="button"
            :class="['opt-btn', mode === 'pvp' && 'active']"
            @click="mode = 'pvp'; createdRoomId = ''"
          >雙人對戰</button>
          <button
            type="button"
            :class="['opt-btn', mode === 'pve' && 'active']"
            @click="mode = 'pve'; createdRoomId = ''"
          >對電腦</button>
          <button
            type="button"
            :class="['opt-btn online-opt', mode === 'online' && 'active']"
            @click="mode = 'online'; createdRoomId = ''; onlineError = ''"
          >網路連線</button>
        </div>
      </div>

      <!-- ── 網路連線設定 ── -->
      <template v-if="isOnline">

        <!-- 等待對手（建立後顯示） -->
        <div v-if="createdRoomId" class="waiting-box">
          <div class="waiting-label">房間已建立，等待對手加入</div>
          <div class="room-code-row">
            <span class="room-code">{{ createdRoomId }}</span>
            <button type="button" class="copy-btn" @click="copyRoomId" title="複製">複製</button>
          </div>
          <div class="waiting-dots">等待中<span class="dots">…</span></div>
        </div>

        <!-- 主要行動（尚未建立房間時） -->
        <template v-else>
          <!-- 建立新房間 -->
          <button
            type="button"
            class="start-btn online-create-btn"
            :disabled="onlineLoading && onlineAction === 'create'"
            @click="onlineAction = 'create'; handleOnlineStart()"
          >
            {{ onlineLoading && onlineAction === 'create' ? '連線中...' : '建立新房間' }}
          </button>

          <div class="online-divider">或</div>

          <!-- 加入房間 -->
          <div class="section">
            <input
              v-model="joinRoomId"
              class="room-input"
              placeholder="輸入 6 位房間碼"
              maxlength="6"
              autocomplete="off"
              spellcheck="false"
              @input="joinRoomId = (joinRoomId as string).toUpperCase()"
            />
            <button
              type="button"
              class="start-btn online-join-btn"
              :disabled="onlineLoading && onlineAction === 'join'"
              @click="onlineAction = 'join'; handleOnlineStart()"
            >
              {{ onlineLoading && onlineAction === 'join' ? '連線中...' : '加入房間' }}
            </button>
          </div>
        </template>

        <!-- 錯誤訊息 -->
        <div v-if="onlineError" class="error-msg">{{ onlineError }}</div>

        <!-- Env 狀態（debug） -->
        <div class="env-debug">
          <span :class="supabaseUrlOk ? 'env-ok' : 'env-fail'">
            {{ supabaseUrlOk ? '✓' : '✗' }} SUPABASE_URL
          </span>
          <span :class="supabaseKeyOk ? 'env-ok' : 'env-fail'">
            {{ supabaseKeyOk ? '✓' : '✗' }} SUPABASE_KEY
          </span>
        </div>
      </template>

      <!-- ── 本機模式設定 ── -->
      <template v-else>
        <!-- 先攻 -->
        <div class="section">
          <div class="section-label">先攻方</div>
          <div class="btn-group">
            <button
              type="button"
              :class="['opt-btn red-opt', firstPlayer === 'red' && 'active']"
              @click="firstPlayer = 'red'"
            >紅方</button>
            <button
              type="button"
              :class="['opt-btn black-opt', firstPlayer === 'black' && 'active']"
              @click="firstPlayer = 'black'"
            >黑方</button>
            <button
              type="button"
              :class="['opt-btn', firstPlayer === 'random' && 'active']"
              @click="firstPlayer = 'random'"
            >隨機</button>
          </div>
        </div>

        <!-- 玩家選邊（PVE 限定） -->
        <div v-if="isPve" class="section">
          <div class="section-label">我方陣營</div>
          <div class="btn-group">
            <button
              type="button"
              :class="['opt-btn red-opt', playerSide === 'red' && 'active']"
              @click="playerSide = 'red'"
            >紅方</button>
            <button
              type="button"
              :class="['opt-btn black-opt', playerSide === 'black' && 'active']"
              @click="playerSide = 'black'"
            >黑方</button>
            <button
              type="button"
              :class="['opt-btn', playerSide === 'random' && 'active']"
              @click="playerSide = 'random'"
            >隨機</button>
          </div>
        </div>

        <!-- 難度（PVE 限定） -->
        <div v-if="isPve" class="section">
          <div class="section-label">難度</div>
          <div class="btn-group">
            <button
              type="button"
              :class="['opt-btn', difficulty === 'easy' && 'active']"
              @click="difficulty = 'easy'"
            >
              <span class="diff-label">簡單</span>
              <span class="diff-desc">固定規則 AI</span>
            </button>
            <button
              type="button"
              :class="['opt-btn', difficulty === 'hard' && 'active']"
              @click="difficulty = 'hard'"
            >
              <span class="diff-label">困難</span>
              <span class="diff-desc">訓練強化 AI</span>
            </button>
          </div>
        </div>

        <button type="button" class="start-btn" @click="startGame">開始遊戲</button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  position: relative;
  color: rgba(255, 255, 255, 0.92);
  background:
    linear-gradient(to bottom, rgba(0, 0, 0, 0.28) 0%, rgba(13, 13, 18, 0.58) 100%),
    url('/assets/home/homeImg.jpg') center / auto 100vh no-repeat fixed;
}

.topBtns {
  position: fixed;
  top: 14px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 10;
}

/* ── Theme toggle switch ─────────────────────── */
.themeSwitch {
  display: flex;
  align-items: center;
  gap: 7px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(0, 0, 0, 0.40);
  backdrop-filter: blur(10px);
  user-select: none;
  transition: border-color 0.2s, background 0.2s;
}
.themeSwitch:hover {
  border-color: rgba(255, 255, 255, 0.42);
  background: rgba(0, 0, 0, 0.55);
}

.switchLabel {
  font-size: 0.75rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.42);
  white-space: nowrap;
  transition: color 0.25s;
  letter-spacing: 0.03em;
}
/* Current active label lights up */
.themeSwitch:not(.is-light) .switchLabel:first-child { color: rgba(255, 255, 255, 0.92); }
.themeSwitch.is-light .switchLabel:last-child { color: rgba(255, 255, 255, 0.92); }

.switchTrack {
  width: 38px;
  height: 22px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.28);
  position: relative;
  flex-shrink: 0;
  transition: background 0.3s, border-color 0.3s;
}
.themeSwitch.is-light .switchTrack {
  background: rgba(232, 200, 60, 0.55);
  border-color: rgba(232, 200, 60, 0.75);
}

.switchKnob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
  transition: transform 0.26s cubic-bezier(0.4, 0, 0.2, 1), background 0.26s;
}
.themeSwitch.is-light .switchKnob {
  transform: translateX(16px);
  background: #e8c83c;
}

/* ── Intro button ────────────────────────────── */
.iconBtn {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(8px);
  font-size: 1.125rem;
  cursor: pointer;
  display: grid;
  place-items: center;
  padding: 0;
  transition: background 0.15s, border-color 0.15s;
}
.iconBtn:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.35);
}

.title {
  margin: 0 0 6px;
  font-size: 2rem;
  letter-spacing: 0.15em;
  color: #e8d8a0;
  text-shadow: 0 0 24px rgba(220, 180, 80, 0.4);
}

.buildVer {
  margin: 0 0 18px;
  font-size: 0.7rem;
  opacity: 0.35;
  letter-spacing: 0.05em;
  font-family: ui-monospace, monospace;
}

.card {
  width: min(440px, 95vw);
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(50, 50, 50, 0.7);
  border-radius: 14px;
  padding: 24px 28px 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  opacity: 0.55;
  text-transform: uppercase;
}

.btn-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.opt-btn {
  flex: 1;
  min-width: 80px;
  padding: 9px 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font-size: 0.8125rem;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  line-height: 1.3;
}

.opt-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.opt-btn.active {
  background: rgba(200, 160, 60, 0.18);
  border-color: rgba(200, 160, 60, 0.55);
  color: #e8d8a0;
}

.opt-btn.online-opt.active {
  background: rgba(60, 140, 200, 0.18);
  border-color: rgba(60, 140, 200, 0.55);
  color: #a0c8e8;
}

.opt-btn.red-opt.active {
  background: rgba(200, 60, 60, 0.18);
  border-color: rgba(200, 60, 60, 0.55);
  color: #f4a0a0;
}

.opt-btn.black-opt.active {
  background: rgba(80, 80, 80, 0.25);
  border-color: rgba(180, 180, 180, 0.45);
  color: #ccc;
}

.diff-label {
  font-size: 0.8125rem;
  font-weight: 600;
}

.diff-desc {
  font-size: 0.625rem;
  opacity: 0.6;
}

/* ── Online UI ───────────────────────────────── */
.room-input {
  width: 100%;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  color: #fff;
  font-size: 1.1rem;
  letter-spacing: 0.2em;
  text-align: center;
  font-family: ui-monospace, monospace;
  text-transform: uppercase;
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.15s;
}
.room-input:focus {
  border-color: rgba(60, 140, 200, 0.6);
}
.room-input::placeholder {
  opacity: 0.35;
  letter-spacing: 0.05em;
  font-size: 0.8rem;
}

.waiting-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 16px;
  background: rgba(60, 140, 200, 0.08);
  border: 1px solid rgba(60, 140, 200, 0.25);
  border-radius: 10px;
}

.waiting-label {
  font-size: 0.75rem;
  opacity: 0.65;
  letter-spacing: 0.05em;
}

.room-code-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.room-code {
  font-size: 1.75rem;
  font-family: ui-monospace, monospace;
  letter-spacing: 0.3em;
  color: #a0c8e8;
  font-weight: 700;
}

.copy-btn {
  padding: 4px 10px;
  background: rgba(60, 140, 200, 0.15);
  border: 1px solid rgba(60, 140, 200, 0.4);
  border-radius: 6px;
  color: #a0c8e8;
  font-size: 0.75rem;
  cursor: pointer;
  transition: background 0.15s;
}
.copy-btn:hover {
  background: rgba(60, 140, 200, 0.28);
}

.waiting-dots {
  font-size: 0.8rem;
  opacity: 0.5;
}

.online-create-btn {
  background: rgba(60, 140, 200, 0.18);
  border-color: rgba(60, 140, 200, 0.5);
  color: #a0c8e8;
}
.online-create-btn:hover:not(:disabled) {
  background: rgba(60, 140, 200, 0.3);
}
.online-join-btn {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.75);
}
.online-join-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
}

.online-divider {
  text-align: center;
  color: #e8c83c;
  font-size: 0.75rem;
  opacity: 0.9;
  letter-spacing: 0.15em;
  margin: -6px 0;
}

.env-debug {
  display: flex;
  gap: 12px;
  justify-content: center;
  font-size: 0.7rem;
  font-family: ui-monospace, monospace;
}
.env-ok { color: #80c880; }
.env-fail { color: #f4a0a0; font-weight: 700; }

.error-msg {
  font-size: 0.8rem;
  color: #f4a0a0;
  text-align: center;
  padding: 6px;
  background: rgba(200, 60, 60, 0.1);
  border-radius: 6px;
  border: 1px solid rgba(200, 60, 60, 0.25);
  word-break: break-all;
}

.start-btn {
  margin-top: 4px;
  padding: 13px;
  background: rgba(200, 160, 60, 0.2);
  border: 1px solid rgba(200, 160, 60, 0.5);
  border-radius: 10px;
  color: #e8d8a0;
  font-size: 0.9375rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: background 0.15s;
}

.start-btn:hover:not(:disabled) {
  background: rgba(200, 160, 60, 0.32);
}

.start-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

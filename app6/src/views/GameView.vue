<script setup lang="ts">
import { ref, computed } from 'vue'
import { useGameStore, simulateSlide, simulatePushDest, collectableCells, posEq } from '../stores/gameStore'
import type { Pos, FaceKey, FaceSet, Direction } from '../engine/types'
import { CORNERS, CROWN_CENTER, faceCount } from '../engine/types'

const store = useGameStore()
const s = computed(() => store.state)

// ─── 組裝冰塊 UI 狀態 ───────────────────────────────────────────────────────────
const isAssembling  = ref(false)
const isPlacing     = ref(false)
const pendingFaces  = ref<FaceSet>({})

function openAssembly() { isAssembling.value = true; isPlacing.value = false; pendingFaces.value = {} }
function cancelAssembly() { isAssembling.value = false; isPlacing.value = false; pendingFaces.value = {}; actionMode.value = null }
function toggleFace(k: FaceKey) {
  const cur = pendingFaces.value[k]
  const next = { ...pendingFaces.value }
  if (cur === undefined) next[k] = 'slash'
  else if (cur === 'slash') next[k] = 'backslash'
  else delete next[k]
  pendingFaces.value = next
}
function confirmAssembly() { isAssembling.value = false; isPlacing.value = true; actionMode.value = 'placeMountain' }

// ─── 動作模式 ──────────────────────────────────────────────────────────────────
type ActionMode = 'placeMountain' | 'collect' | 'rotate_cw' | 'rotate_ccw' | null
const actionMode = ref<ActionMode>(null)

function selectMode(m: ActionMode) {
  actionMode.value = actionMode.value === m ? null : m
  if (m !== 'placeMountain') { isPlacing.value = false; isAssembling.value = false }
}

// ─── 移動預覽 ──────────────────────────────────────────────────────────────────
const movePreviewPos = ref<Pos | null>(null)
const pushPreviewPos = ref<Pos | null>(null)

function previewMove(dir: Direction | null) {
  if (!dir || s.value.phase !== 'playing' || !store.isHumanTurn || s.value.moveActionUsed) {
    movePreviewPos.value = null; return
  }
  const st = s.value
  const pp  = st.turn === 'A' ? st.posA : st.posB
  const dest = simulateSlide(st, st.turn, dir)
  movePreviewPos.value = pp && !posEq(dest, pp) ? dest : null
}
function previewPush(dir: Direction | null) {
  if (!dir || s.value.phase !== 'playing' || !store.isHumanTurn || s.value.moveActionUsed) {
    pushPreviewPos.value = null; return
  }
  const st = s.value
  const pp  = st.turn === 'A' ? st.posA : st.posB
  if (!pp) { pushPreviewPos.value = null; return }
  pushPreviewPos.value = simulatePushDest(st, pp, dir)
}

// ─── 高亮格子 ─────────────────────────────────────────────────────────────────
function isHighlighted(x: number, y: number): boolean {
  const state = s.value
  const pos: Pos = { x, y }
  const isOcc = (p: Pos) =>
    (!!state.posA && posEq(p, state.posA)) ||
    (!!state.posB && posEq(p, state.posB)) ||
    (!!state.crown && posEq(p, state.crown))

  if (state.phase === 'setup_crown') {
    const { minX, maxX, minY, maxY } = CROWN_CENTER
    return x >= minX && x <= maxX && y >= minY && y <= maxY
      && state.grid[y][x].floatIce === null && !isOcc(pos)
  }
  if (state.phase === 'setup_float') return state.grid[y][x].floatIce === null && !isOcc(pos)
  if (state.phase === 'setup_chars') {
    return CORNERS.some(c => posEq(c, pos))
      && !(state.posA && posEq(pos, state.posA))
      && !(state.posB && posEq(pos, state.posB))
  }
  if (state.phase !== 'playing' || !store.isHumanTurn) return false

  const playerPos = state.turn === 'A' ? state.posA : state.posB

  if (actionMode.value === 'placeMountain' && isPlacing.value && !state.iceActionUsed)
    return state.grid[y][x].floatIce === null && !isOcc(pos)
  if (actionMode.value === 'collect' && !state.iceActionUsed)
    return collectableCells(state).some(p => posEq(p, pos))
  if ((actionMode.value === 'rotate_cw' || actionMode.value === 'rotate_ccw') && !state.moveActionUsed && playerPos) {
    const dirs: [number,number][] = [[0,-1],[0,1],[-1,0],[1,0]]
    return dirs.some(([dx, dy]) => {
      const nx = playerPos.x + dx, ny = playerPos.y + dy
      if (nx !== x || ny !== y) return false
      const fi = state.grid[ny][nx].floatIce
      return fi !== null && faceCount(fi.faces) > 0
    })
  }
  return false
}

// ─── 格子資訊 ─────────────────────────────────────────────────────────────────
function cellInfo(x: number, y: number) {
  const state = s.value
  const pos: Pos = { x, y }
  return {
    isA:      !!state.posA  && posEq(pos, state.posA),
    isB:      !!state.posB  && posEq(pos, state.posB),
    isCrown:  !!state.crown && posEq(pos, state.crown),
    floatIce: state.grid[y][x].floatIce,
  }
}
function faceChar(ori: 'slash'|'backslash'|undefined) {
  return ori === 'slash' ? '╱' : ori === 'backslash' ? '╲' : '空'
}

// ─── 格子點擊 ─────────────────────────────────────────────────────────────────
function handleCellClick(x: number, y: number) {
  const state = s.value
  const pos: Pos = { x, y }
  if (['setup_crown','setup_float','setup_chars'].includes(state.phase)) {
    store.handleSetupClick(pos); return
  }
  if (state.phase !== 'playing' || !store.isHumanTurn) return
  if (!actionMode.value) return

  if (actionMode.value === 'placeMountain' && isPlacing.value && !state.iceActionUsed) {
    if (!isHighlighted(x, y)) return
    store.handleAction({ kind: 'placeMountain', pos, faces: { ...pendingFaces.value } })
    isPlacing.value = false; pendingFaces.value = {}; actionMode.value = null; return
  }
  if (actionMode.value === 'collect' && !state.iceActionUsed) {
    if (!isHighlighted(x, y)) return
    store.handleAction({ kind: 'collect', pos })
    actionMode.value = null; return
  }
  if ((actionMode.value === 'rotate_cw' || actionMode.value === 'rotate_ccw') && !state.moveActionUsed) {
    if (!isHighlighted(x, y)) return
    store.handleAction({ kind: 'rotate', pos, cw: actionMode.value === 'rotate_cw' })
    actionMode.value = null; return
  }
}

function doMove(dir: Direction) {
  movePreviewPos.value = null
  store.handleAction({ kind: 'move', dir })
}
function doPush(dir: Direction) {
  pushPreviewPos.value = null
  store.handleAction({ kind: 'push', dir })
}

// ─── 推冰是否有效 ─────────────────────────────────────────────────────────────
function canPush(dir: Direction): boolean {
  const state = s.value
  if (state.phase !== 'playing' || !store.isHumanTurn || state.moveActionUsed) return false
  const pp = state.turn === 'A' ? state.posA : state.posB
  if (!pp) return false
  return simulatePushDest(state, pp, dir) !== null
}

// ─── 階段提示 ─────────────────────────────────────────────────────────────────
const phaseLabel = computed(() => {
  const state = s.value
  if (state.phase === 'setup_crown') return '👑 玩家A：點擊中央淺色格放置王冠'
  if (state.phase === 'setup_float') return `🧊 玩家A：放置漂浮冰塊（${state.setupFloatCount}/2），完成後按確定`
  if (state.phase === 'setup_chars') return `🐾 玩家B：點角落放 ${!state.posA ? '🐧企鵝(A)' : '🐻北極熊(B)'}`
  if (state.phase === 'playing') {
    if (store.isComputerThinking) return '🤖 電腦思考中…'
    const who = state.turn === 'A' ? '🐧 玩家A' : '🐻 玩家B'
    const ice  = state.iceActionUsed  ? '✅冰' : '⬜冰'
    const mov  = state.moveActionUsed ? '✅移' : '⬜移'
    return `${who} 的回合　${ice} ${mov}`
  }
  if (state.winner === 'draw') return '🤝 平局！'
  if (state.winner === 'A')    return '🏆 玩家A（🐧 企鵝）獲勝！'
  if (state.winner === 'B')    return '🏆 玩家B（🐻 北極熊）獲勝！'
  return ''
})

const modeOptions = [
  { value: 'hvh', label: '👤 對 👤' },
  { value: 'hvc', label: '👤 對 🤖' },
  { value: 'cvh', label: '🤖 對 👤' },
  { value: 'cvc', label: '🤖 對 🤖' },
]
const pendingFacesCost = computed(() => faceCount(pendingFaces.value))

// 本回合至少做了一個動作，才能結束回合
const canEndTurn = computed(() =>
  s.value.phase === 'playing' && store.isHumanTurn &&
  (s.value.iceActionUsed || s.value.moveActionUsed)
)
</script>

<template>
  <div class="game-root">
    <!-- 標題列 -->
    <header class="header">
      <h1>❄️ 極地之王 <span class="subtitle">Frozen King</span></h1>
      <div class="controls-row">
        <div class="mode-btns">
          <button v-for="opt in modeOptions" :key="opt.value"
            :class="['mode-btn', { active: store.mode === opt.value }]"
            @click="store.newGame(opt.value as any)">{{ opt.label }}</button>
        </div>
        <button class="btn-new" @click="store.newGame()">↺ 重新開始</button>
      </div>
      <div class="phase-label">{{ phaseLabel }}</div>
    </header>

    <main class="main">
      <!-- 玩家資訊 -->
      <aside class="pool-info">
        <div class="pool-card" :class="{ active: s.turn === 'A' && s.phase === 'playing' }">
          <div class="player-icon">🐧</div>
          <div class="player-label">玩家 A</div>
        </div>
        <div class="pool-stats">
          <div class="stat">🧊 <strong>{{ s.availFloat }}</strong></div>
          <div class="stat">❄ <strong>{{ s.availReflect }}</strong></div>
          <div class="stat">🔄 <strong>{{ s.turnCount }}</strong></div>
        </div>
        <div class="pool-card" :class="{ active: s.turn === 'B' && s.phase === 'playing' }">
          <div class="player-icon">🐻</div>
          <div class="player-label">玩家 B</div>
        </div>
      </aside>

      <!-- 棋盤 -->
      <section class="board-section">
        <div class="board">
          <div v-for="yi in 7" :key="yi" class="board-row">
            <div v-for="xi in 7" :key="xi"
              :class="[
                'cell',
                cellInfo(xi-1,yi-1).isA     ? 'cell--a'       : '',
                cellInfo(xi-1,yi-1).isB     ? 'cell--b'       : '',
                cellInfo(xi-1,yi-1).isCrown ? 'cell--crown'   : '',
                (cellInfo(xi-1,yi-1).floatIce
                  && !cellInfo(xi-1,yi-1).isA
                  && !cellInfo(xi-1,yi-1).isB) ? 'cell--ice'  : '',
                isHighlighted(xi-1,yi-1)    ? 'cell--hi'      : '',
                (movePreviewPos && posEq({x:xi-1,y:yi-1}, movePreviewPos)) ? 'cell--preview' : '',
                (pushPreviewPos && posEq({x:xi-1,y:yi-1}, pushPreviewPos)) ? 'cell--push-preview' : '',
              ]"
              @click="handleCellClick(xi-1, yi-1)">

              <!-- 角色 / 王冠（王冠顯示固定冰山視覺） -->
              <span v-if="cellInfo(xi-1,yi-1).isA"    class="piece">🐧</span>
              <span v-else-if="cellInfo(xi-1,yi-1).isB"    class="piece">🐻</span>
              <span v-else-if="cellInfo(xi-1,yi-1).isCrown" class="piece crown-piece">
                <span class="crown-mountain">🏔</span>
                <span class="crown-icon">👑</span>
              </span>

              <!-- 漂浮冰塊（含四面反射指示） -->
              <template v-else-if="cellInfo(xi-1,yi-1).floatIce">
                <div class="ice-core">🧊</div>
                <span v-if="cellInfo(xi-1,yi-1).floatIce.faces.up"
                  class="face-ind face-top">
                  {{ cellInfo(xi-1,yi-1).floatIce.faces.up === 'slash' ? '╱' : '╲' }}
                </span>
                <span v-if="cellInfo(xi-1,yi-1).floatIce.faces.down"
                  class="face-ind face-bot">
                  {{ cellInfo(xi-1,yi-1).floatIce.faces.down === 'slash' ? '╱' : '╲' }}
                </span>
                <span v-if="cellInfo(xi-1,yi-1).floatIce.faces.left"
                  class="face-ind face-lft">
                  {{ cellInfo(xi-1,yi-1).floatIce.faces.left === 'slash' ? '╱' : '╲' }}
                </span>
                <span v-if="cellInfo(xi-1,yi-1).floatIce.faces.right"
                  class="face-ind face-rgt">
                  {{ cellInfo(xi-1,yi-1).floatIce.faces.right === 'slash' ? '╱' : '╲' }}
                </span>
              </template>

              <span class="coord">{{ xi-1 }},{{ yi-1 }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 操作面板（遊戲中，輪到人類） -->
      <aside class="action-panel" v-if="s.phase === 'playing' && store.isHumanTurn">

        <!-- 冰塊動作 -->
        <div class="action-group" :class="{ 'group-done': s.iceActionUsed }">
          <div class="action-title">
            冰塊動作
            <span class="done-badge" v-if="s.iceActionUsed">✅</span>
          </div>

          <template v-if="!s.iceActionUsed">
            <!-- 放置：組裝面板 -->
            <button v-if="!isAssembling && !isPlacing"
              class="action-btn"
              :disabled="s.availFloat === 0"
              @click="openAssembly()">
              🧊 放冰（{{ s.availFloat }}）
            </button>

            <div v-if="isAssembling" class="assembly-panel">
              <div class="asm-title">組裝反射面</div>
              <div class="asm-hint">點擊：空 → ╱ → ╲ → 空</div>
              <div class="asm-grid">
                <div></div>
                <button class="asm-face" @click="toggleFace('up')">
                  <span class="face-ori">{{ faceChar(pendingFaces.up) }}</span>
                  <span class="face-label">上</span>
                </button>
                <div></div>
                <button class="asm-face" @click="toggleFace('left')">
                  <span class="face-ori">{{ faceChar(pendingFaces.left) }}</span>
                  <span class="face-label">左</span>
                </button>
                <div class="asm-center">🧊</div>
                <button class="asm-face" @click="toggleFace('right')">
                  <span class="face-ori">{{ faceChar(pendingFaces.right) }}</span>
                  <span class="face-label">右</span>
                </button>
                <div></div>
                <button class="asm-face" @click="toggleFace('down')">
                  <span class="face-ori">{{ faceChar(pendingFaces.down) }}</span>
                  <span class="face-label">下</span>
                </button>
                <div></div>
              </div>
              <div class="asm-cost">1🧊 + {{ pendingFacesCost }}❄ （剩 {{ s.availFloat }}🧊 {{ s.availReflect }}❄）</div>
              <div class="asm-actions">
                <button class="btn-cancel" @click="cancelAssembly()">取消</button>
                <button class="btn-confirm" :disabled="s.availReflect < pendingFacesCost" @click="confirmAssembly()">確認 →</button>
              </div>
            </div>

            <div v-if="isPlacing" class="placing-hint">
              <p>點擊棋盤空格放置冰塊</p>
              <button class="btn-cancel" @click="cancelAssembly()">取消</button>
            </div>

            <!-- 回收 -->
            <button v-if="!isAssembling && !isPlacing"
              :class="['action-btn', { active: actionMode === 'collect' }]"
              @click="selectMode('collect')">📦 回收（最遠）</button>
          </template>
          <template v-else>
            <div class="done-msg">本回合已完成冰塊動作</div>
          </template>
        </div>

        <!-- 移動動作 -->
        <div class="action-group" :class="{ 'group-done': s.moveActionUsed }">
          <div class="action-title">
            移動動作
            <span class="done-badge" v-if="s.moveActionUsed">✅</span>
          </div>

          <template v-if="!s.moveActionUsed">
            <!-- 旋轉 -->
            <button :class="['action-btn', { active: actionMode === 'rotate_cw' }]"
              @click="selectMode('rotate_cw')">↻ 順時針旋轉</button>
            <button :class="['action-btn', { active: actionMode === 'rotate_ccw' }]"
              @click="selectMode('rotate_ccw')">↺ 逆時針旋轉</button>

            <!-- 滑動 D-pad -->
            <div class="dpad-label">🏃 滑動</div>
            <div class="dpad">
              <div></div>
              <button class="dpad-btn" @click="doMove('up')" @mouseenter="previewMove('up')" @mouseleave="previewMove(null)">▲</button>
              <div></div>
              <button class="dpad-btn" @click="doMove('left')" @mouseenter="previewMove('left')" @mouseleave="previewMove(null)">◄</button>
              <div class="dpad-center">{{ s.turn }}</div>
              <button class="dpad-btn" @click="doMove('right')" @mouseenter="previewMove('right')" @mouseleave="previewMove(null)">►</button>
              <div></div>
              <button class="dpad-btn" @click="doMove('down')" @mouseenter="previewMove('down')" @mouseleave="previewMove(null)">▼</button>
              <div></div>
            </div>

            <!-- 推冰 D-pad -->
            <div class="dpad-label">💪 推冰（需緊鄰純浮冰）</div>
            <div class="dpad">
              <div></div>
              <button class="dpad-btn push-btn" :disabled="!canPush('up')" @click="doPush('up')" @mouseenter="previewPush('up')" @mouseleave="previewPush(null)">▲</button>
              <div></div>
              <button class="dpad-btn push-btn" :disabled="!canPush('left')" @click="doPush('left')" @mouseenter="previewPush('left')" @mouseleave="previewPush(null)">◄</button>
              <div class="dpad-center push-ctr">推</div>
              <button class="dpad-btn push-btn" :disabled="!canPush('right')" @click="doPush('right')" @mouseenter="previewPush('right')" @mouseleave="previewPush(null)">►</button>
              <div></div>
              <button class="dpad-btn push-btn" :disabled="!canPush('down')" @click="doPush('down')" @mouseenter="previewPush('down')" @mouseleave="previewPush(null)">▼</button>
              <div></div>
            </div>
          </template>
          <template v-else>
            <div class="done-msg">本回合已完成移動動作</div>
          </template>
        </div>

        <!-- 結束回合 -->
        <button class="btn-end-turn" :disabled="!canEndTurn" @click="store.handleEndTurn()">
          ⏩ 結束回合
        </button>
      </aside>

      <!-- 設置階段：確定放冰 -->
      <aside class="action-panel" v-else-if="s.phase === 'setup_float'">
        <div class="action-group">
          <div class="action-title">放置漂浮冰塊</div>
          <p class="hint">已放置：{{ s.setupFloatCount }}/2<br>點擊棋盤空格（可選）</p>
          <button class="btn-done" @click="store.doneFloatSetup()">✅ 確定完成</button>
        </div>
      </aside>

      <!-- 遊戲結束 -->
      <aside class="action-panel" v-else-if="s.phase === 'ended'">
        <div class="action-group ended-panel">
          <div class="winner-text">{{ phaseLabel }}</div>
          <button class="btn-done" @click="store.newGame()">↺ 再玩一局</button>
        </div>
      </aside>

      <!-- 電腦回合 / 其他等待 -->
      <aside class="action-panel" v-else>
        <div class="action-group">
          <div class="action-title">{{ store.isComputerThinking ? '🤖 電腦思考中…' : '等待中…' }}</div>
        </div>
      </aside>
    </main>

    <!-- 遊戲記錄 -->
    <footer class="log-panel">
      <div class="log-title">📋 遊戲記錄</div>
      <div class="log-entries">
        <div v-for="(entry, i) in [...s.log].reverse().slice(0,8)" :key="i" class="log-entry">{{ entry }}</div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
*,*::before,*::after { box-sizing: border-box }
.game-root { min-height:100vh; background:linear-gradient(135deg,#0a1628,#0d2445,#0a1628); color:#e8f4fd; display:flex; flex-direction:column; font-family:'Segoe UI',system-ui,sans-serif }
.header { padding:12px 24px; border-bottom:1px solid rgba(100,180,255,.2); background:rgba(0,0,0,.3) }
.header h1 { margin:0 0 8px; font-size:1.4rem; color:#a8d8ff }
.subtitle { font-size:.8em; color:#6ab4ff; font-weight:300 }
.controls-row { display:flex; align-items:center; gap:12px; flex-wrap:wrap }
.mode-btns { display:flex; gap:6px }
.mode-btn { padding:4px 10px; border-radius:6px; border:1px solid #3a6090; background:#1a3a5c; color:#9cc; cursor:pointer; font-size:.85rem; transition:all .2s }
.mode-btn.active { background:#1a6090; border-color:#4ab0ff; color:#fff }
.mode-btn:hover:not(.active) { background:#243a5c }
.btn-new { padding:4px 14px; border-radius:6px; border:1px solid #5a8090; background:#1a4060; color:#adf; cursor:pointer; font-size:.85rem }
.phase-label { margin-top:8px; font-size:.9rem; color:#ffe97a; min-height:1.2em }
.main { display:flex; align-items:flex-start; gap:16px; padding:16px 24px; flex:1 }
.pool-info { display:flex; flex-direction:column; align-items:center; gap:10px; min-width:80px }
.pool-card { background:rgba(255,255,255,.05); border:1px solid rgba(100,180,255,.2); border-radius:10px; padding:8px; text-align:center; width:75px; transition:all .3s }
.pool-card.active { border-color:#ffe97a; background:rgba(255,233,122,.1); box-shadow:0 0 12px rgba(255,233,122,.3) }
.player-icon { font-size:1.8rem } .player-label { font-size:.75rem; font-weight:600; color:#a8d8ff }
.pool-stats { display:flex; flex-direction:column; gap:4px; align-items:center } .stat { font-size:.8rem; color:#8ab4c4 }
.board-section { flex-shrink:0 }
.board { display:flex; flex-direction:column; gap:3px; background:#0a2040; border:2px solid #2a5080; border-radius:8px; padding:3px }
.board-row { display:flex; gap:3px }
.cell { width:68px; height:68px; background:#c8e8f8; border-radius:4px; position:relative; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all .15s; overflow:hidden }
.cell:hover { filter:brightness(1.08) }
.cell--a     { background:#1a2a40; box-shadow:inset 0 0 0 3px #3a80ff }
.cell--b     { background:#2a1a10; box-shadow:inset 0 0 0 3px #c87040 }
.cell--crown { background:#302010; box-shadow:inset 0 0 0 3px #ffd700 }
.cell--ice   { background:#e0f4ff }
.cell--hi    { box-shadow:inset 0 0 0 3px #40ff80; background:rgba(64,255,128,.15); animation:pulse 1.2s ease-in-out infinite }
.cell--preview { box-shadow:inset 0 0 0 3px #ffee40; background:rgba(255,238,64,.15) }
.cell--push-preview { box-shadow:inset 0 0 0 3px #ff8040; background:rgba(255,128,64,.15) }
@keyframes pulse { 0%,100% { box-shadow:inset 0 0 0 3px #40ff80 } 50% { box-shadow:inset 0 0 0 3px #00cc50,0 0 8px #40ff8044 } }
.piece { font-size:1.8rem; z-index:2; position:relative }
.crown-piece { display:flex; flex-direction:column; align-items:center; gap:0; line-height:1; z-index:2; position:relative }
.crown-mountain { font-size:1.1rem; line-height:1 }
.crown-icon    { font-size:1rem;   line-height:1 }
.ice-core { font-size:1.4rem; z-index:2; position:relative }
.face-ind { position:absolute; font-size:.85rem; font-weight:700; color:#1a6ab4; line-height:1; z-index:3; background:rgba(200,235,255,.75); border-radius:3px; padding:0 2px }
.face-top { top:1px;    left:50%; transform:translateX(-50%) }
.face-bot { bottom:1px; left:50%; transform:translateX(-50%) }
.face-lft { left:1px;   top:50%;  transform:translateY(-50%) }
.face-rgt { right:1px;  top:50%;  transform:translateY(-50%) }
.coord { position:absolute; bottom:2px; left:3px; font-size:.5rem; color:rgba(0,0,0,.2); user-select:none; pointer-events:none }
.action-panel { display:flex; flex-direction:column; gap:10px; min-width:175px; max-width:210px }
.action-group { background:rgba(255,255,255,.04); border:1px solid rgba(100,180,255,.15); border-radius:10px; padding:10px; display:flex; flex-direction:column; gap:6px; transition:opacity .3s }
.action-group.group-done { opacity:.55 }
.action-title { font-size:.7rem; text-transform:uppercase; letter-spacing:.05em; color:#6ab4c4; font-weight:600; display:flex; align-items:center; gap:6px }
.done-badge { font-size:.85rem }
.done-msg { font-size:.75rem; color:#5a8060; font-style:italic }
.action-btn { padding:7px 10px; border-radius:6px; border:1px solid #2a5070; background:#0e2840; color:#9cc4d4; cursor:pointer; font-size:.8rem; text-align:left; transition:all .15s }
.action-btn:hover:not(:disabled) { background:#1a3a54; border-color:#4a90c0 } .action-btn.active { background:#1a4060; border-color:#4ab0ff; color:#fff } .action-btn:disabled { opacity:.35; cursor:not-allowed }
/* ─ 組裝面板 ─ */
.assembly-panel { display:flex; flex-direction:column; gap:6px; padding:8px; background:rgba(0,0,0,.25); border-radius:8px; border:1px solid rgba(100,200,255,.2) }
.asm-title { font-size:.75rem; font-weight:600; color:#7ad4f0 }
.asm-hint  { font-size:.65rem; color:#5a9090 }
.asm-grid  { display:grid; grid-template-columns:repeat(3,50px); grid-template-rows:repeat(3,50px); gap:3px; justify-content:center }
.asm-face  { border-radius:6px; border:1px solid #2a6080; background:#0e2840; color:#6df; cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; padding:0 }
.asm-face:hover { background:#1a3a54; border-color:#4ab0ff }
.face-ori   { font-size:.95rem; line-height:1 } .face-label { font-size:.6rem; color:#5a9090 }
.asm-center { display:flex; align-items:center; justify-content:center; font-size:1.4rem; background:rgba(255,255,255,.05); border-radius:6px; border:1px solid #2a5060 }
.asm-cost   { font-size:.7rem; color:#9ab4c4 }
.asm-actions { display:flex; gap:6px }
.placing-hint p { font-size:.8rem; color:#ffe97a; margin:0 0 6px }
.btn-cancel  { flex:1; padding:6px; border-radius:6px; border:1px solid #603030; background:#2a1010; color:#f88; cursor:pointer; font-size:.8rem }
.btn-cancel:hover { background:#3a1a1a }
.btn-confirm { flex:1; padding:6px; border-radius:6px; border:1px solid #206040; background:#0e3020; color:#6df0a0; cursor:pointer; font-size:.8rem }
.btn-confirm:hover:not(:disabled) { background:#1a4030 } .btn-confirm:disabled { opacity:.35; cursor:not-allowed }
.hint { font-size:.75rem; color:#6a9090; margin:0 }
.btn-done { padding:8px; border-radius:8px; border:1px solid #2a8060; background:#0e3828; color:#6dffc0; cursor:pointer; font-size:.85rem }
.btn-done:hover { background:#1a5040 }
/* D-pad */
.dpad-label { font-size:.68rem; color:#5a8090; margin-top:4px }
.dpad { display:grid; grid-template-columns:repeat(3,36px); grid-template-rows:repeat(3,36px); gap:3px; justify-content:center }
.dpad-btn { width:36px; height:36px; border-radius:6px; border:1px solid #2a6090; background:#0e2840; color:#9cc; font-size:.9rem; cursor:pointer; transition:all .1s }
.dpad-btn:hover:not(:disabled) { background:#1a4060; border-color:#4ab0ff } .dpad-btn:active:not(:disabled) { transform:scale(.92) } .dpad-btn:disabled { opacity:.3; cursor:not-allowed }
.push-btn { border-color:#6a3030; background:#200e0e; color:#f8a0a0 }
.push-btn:hover:not(:disabled) { background:#3a1a1a; border-color:#ff6060 }
.dpad-center { display:flex; align-items:center; justify-content:center; font-size:.7rem; font-weight:700; color:#ffe97a }
.push-ctr { color:#ff8060 }
/* 結束回合 */
.btn-end-turn { padding:10px; border-radius:8px; border:1px solid #304860; background:#0e1e30; color:#8ab4d4; cursor:pointer; font-size:.9rem; font-weight:600; transition:all .2s }
.btn-end-turn:hover:not(:disabled) { background:#1a3040; border-color:#4a80b0; color:#c8e8ff }
.btn-end-turn:disabled { opacity:.3; cursor:not-allowed }
.ended-panel { text-align:center; gap:12px } .winner-text { font-size:1rem; color:#ffe97a; font-weight:600 }
.log-panel { border-top:1px solid rgba(100,180,255,.15); padding:8px 24px; background:rgba(0,0,0,.2) }
.log-title { font-size:.7rem; color:#4a8090; margin-bottom:4px }
.log-entries { display:flex; gap:8px; flex-wrap:wrap }
.log-entry { font-size:.75rem; color:#7ab0b4; background:rgba(255,255,255,.04); border-radius:4px; padding:2px 6px; white-space:nowrap }
</style>

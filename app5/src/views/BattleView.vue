<template>
  <div class="battle-view">

    <!-- ── Top Bar ─────────────────────────────────────────────────────────── -->
    <div class="top-bar">
      <router-link to="/">← 返回備戰</router-link>
      <span class="phase">{{ phaseLabel }}</span>
      <div class="speed-controls">
        <button v-for="s in [1,2,3]" :key="s" @click="store.setSpeed(s)" :class="{ active: store.speedMultiplier === s }">×{{ s }}</button>
      </div>
    </div>

    <!-- ── 勝敗結果 overlay ──────────────────────────────────────────────── -->
    <div v-if="store.gameState?.phase === 'player_won' || store.gameState?.phase === 'enemy_won'" class="result-overlay">
      <div class="result-box">
        <div class="result-title">{{ store.gameState.phase === 'player_won' ? '🎉 勝利' : '💀 敗北' }}</div>
        <router-link to="/" class="result-btn">返回備戰</router-link>
      </div>
    </div>

    <!-- ── Pixi Canvas ───────────────────────────────────────────────────── -->
    <div class="canvas-wrapper" ref="wrapperRef">
      <canvas ref="canvasRef" class="game-canvas" />
      <!-- 縮放控制（右上角 DOM overlay） -->
      <div class="zoom-controls">
        <button class="zoom-btn" @click="changeZoom(1)" title="放大">＋</button>
        <span class="zoom-label">{{ zoomLabel }}</span>
        <button class="zoom-btn" @click="changeZoom(-1)" title="縮小">－</button>
      </div>
    </div>

    <!-- ── 戰鬥 log ───────────────────────────────────────────────────────── -->
    <div class="battle-log">
      <div v-for="(entry, i) in recentLog" :key="i">{{ entry }}</div>
    </div>

    <!-- ── 小隊狀態面板 ───────────────────────────────────────────────────── -->
    <div class="squad-panels">
      <div v-for="squad in store.playerSquads" :key="squad.squadId" class="squad-panel player">
        <div class="panel-name">{{ captainName(squad.captainDefId) }}</div>
        <div class="panel-state">{{ squad.state }}</div>
        <div class="sp-bar"><div class="sp-fill" :style="{ width: squad.sp + '%' }"></div></div>
        <div v-if="squad.state === 'retreating'" class="revive-count">
          ⏳ {{ squad.reviveAtTick !== null ? squad.reviveAtTick - (store.gameState?.tick ?? 0) : '—' }} tick
        </div>
        <div v-else class="panel-members">
          <span class="member-badge">隊 {{ Math.ceil(squad.hp / squad.maxHp * 100) }}%</span>
          <span v-for="s in squad.shieldLayers" :key="s.instanceId" class="member-badge" :class="{ dead: s.isDead }">
            盾 {{ s.isDead ? '✗' : Math.ceil(s.hp / s.maxHp * 100) + '%' }}
          </span>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted } from 'vue'
import { useGameStore } from '../stores/gameStore'
import type { HexPos } from '../engine/types'
import { PixiHexRenderer } from '../game/PixiHexRenderer'
import { ref } from 'vue'
import { NAMED_ZONES } from '../engine/mapData'

const store = useGameStore()

// ─── Canvas / Renderer refs ──────────────────────────────────────────────────

const canvasRef  = ref<HTMLCanvasElement>()
const wrapperRef = ref<HTMLDivElement>()
let renderer: PixiHexRenderer | null = null
let resizeObserver: ResizeObserver | null = null
let mapBuilt = false

// ─── 選中小隊 ────────────────────────────────────────────────────────────────

const selectedSquadId = ref<string | null>(null)

function deselect() {
  selectedSquadId.value = null
  renderer?.setSelectedSquad(null)
  renderer?.clearSquadSelection()
}

// ─── Renderer 回呼 ───────────────────────────────────────────────────────────

function onSquadClick(squadId: string) {
  const squad = store.gameState?.squads[squadId]
  if (!squad) return

  if (squad.team === 'player') {
    // 己方：選中 / 取消
    if (selectedSquadId.value === squadId) {
      deselect()
    } else {
      selectedSquadId.value = squadId
      renderer?.setSelectedSquad(squadId)
      if (store.gameState) {
        renderer?.showSquadSelection(squad, store.gameState.cells)
      }
    }
  }
  // 敵方：未來可開詳情面板
}

function onCellClick(_pos: HexPos) {
  // v2: cell click 將用於顯示設施脈絡面板，目前暫空網
  deselect()
}

// ─── 初始化 Renderer ─────────────────────────────────────────────────────────

onMounted(async () => {
  if (!canvasRef.value || !wrapperRef.value) return

  renderer = new PixiHexRenderer()
  renderer.onSquadClick = onSquadClick
  renderer.onCellClick  = onCellClick

  await renderer.init(canvasRef.value)
  renderer.setCaptainDefs(store.captainDefs)
  renderer.setNamedZones(NAMED_ZONES)

  // 若遊戲已在進行（頁面切回來），立即建圖 + 同步
  if (store.gameState) {
    renderer.buildMap(store.gameState.cells)
    renderer.syncState(store.gameState)
    mapBuilt = true
  }

  // ResizeObserver 讓 canvas 隨容器縮放
  resizeObserver = new ResizeObserver(entries => {
    const rect = entries[0].contentRect
    renderer?.resize(rect.width, rect.height)
  })
  resizeObserver.observe(wrapperRef.value)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  renderer?.destroy()
  renderer = null
})

// ─── 每 tick 同步狀態 ────────────────────────────────────────────────────────

watch(
  () => store.gameState,
  (state) => {
    if (!renderer || !state) return
    if (!mapBuilt) {
      renderer.buildMap(state.cells)
      mapBuilt = true
    }
    renderer.syncState(state)
  },
  { deep: false }   // gameState 每 tick 替換為新物件，shallow watch 即可
)

// ─── 顯示用 ──────────────────────────────────────────────────────────────────

// ─── 縮放 ────────────────────────────────────────────────────────────────────

const currentZoom = ref(1.0)
const zoomLabel   = computed(() => `${Math.round(currentZoom.value * 100)}%`)

function changeZoom(dir: 1 | -1) {
  if (!renderer) return
  const next = currentZoom.value + dir * PixiHexRenderer.ZOOM_STEP
  renderer.setZoom(next)
  currentZoom.value = renderer.getZoom()
}

const phaseLabel = computed(() => {
  const p = store.gameState?.phase
  if (p === 'running')    return `⚔️ 戰鬥中 (tick: ${store.gameState?.tick})`
  if (p === 'player_won') return '🎉 玩家勝利'
  if (p === 'enemy_won')  return '💀 敵方勝利'
  return '準備中'
})

const recentLog = computed(() => {
  const log = store.gameState?.log ?? []
  return log.slice(-8).reverse()
})

function captainName(defId: string) {
  return store.captainDefs.find(c => c.id === defId)?.name ?? defId
}
</script>

<style scoped>
.battle-view {
  display: flex; flex-direction: column; height: 100vh;
  padding: 12px; gap: 10px;
  background: #f5ead8; color: #3a2e1e;
}

/* ── Top Bar ── */
.top-bar {
  display: flex; align-items: center; gap: 16px;
  background: #fdf6e8; border: 1px solid #c8b090;
  border-radius: 8px; padding: 0 16px; flex-shrink: 0;
  height: 44px; box-sizing: border-box;
}
.top-bar a { color: #8a5a1e; font-size: 13px; }
.phase { flex: 1; text-align: center; font-size: 16px; font-weight: 700; color: #5a3e1e; }
.speed-controls { display: flex; gap: 6px; }
.speed-controls button {
  padding: 4px 12px; background: #f4ead8;
  border: 1px solid #c8b090; color: #5a3e1e;
  border-radius: 5px; font-size: 13px; cursor: pointer;
}
.speed-controls button.active { background: #c8701e; color: #fff; border-color: #c8701e; }


/* ── Canvas ── */
.canvas-wrapper {
  flex: 1; overflow: hidden; position: relative;
  border: 1px solid #c8b090; border-radius: 8px;
  background: #ede0c8;
  /* 斜角效果：從下方視角往上看棋盤 */
  perspective: 1000px;
}
.game-canvas {
  display: block; width: 100%; height: 100%;
  transform: rotateX(22deg);
  transform-origin: 50% 100%;   /* 以底部為軸旋轉，底邊不動 */
}

/* 縮放按鈕（右上角懸浮） */
.zoom-controls {
  position: absolute; top: 8px; right: 8px;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  background: rgba(253,246,232,0.88); border: 1px solid #c8b090;
  border-radius: 8px; padding: 4px 6px;
  backdrop-filter: blur(4px);
}
.zoom-btn {
  width: 28px; height: 28px; border: 1px solid #c8b090;
  background: #f4ead8; color: #5a3e1e; border-radius: 5px;
  font-size: 16px; line-height: 1; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.zoom-btn:hover { background: #e8d4b0; }
.zoom-label { font-size: 11px; color: #8a6a3e; min-width: 36px; text-align: center; }

/* ── Battle Log ── */
.battle-log {
  height: 72px; overflow-y: auto; flex-shrink: 0; box-sizing: border-box;
  background: #fdf6e8; border: 1px solid #c8b090;
  padding: 8px 10px; font-size: 11px; font-family: monospace;
  border-radius: 6px; color: #5a3e1e;
}

/* ── Squad Panels ── */
.squad-panels { display: flex; gap: 10px; flex-shrink: 0; height: 80px; box-sizing: border-box; }
.squad-panel {
  flex: 1; background: #fdf6e8; overflow: hidden;
  border: 1px solid #c8a870; border-radius: 8px; padding: 6px 10px;
  box-sizing: border-box;
}
.panel-name  { font-weight: 700; font-size: 14px; color: #5a3e1e; }
.panel-state { font-size: 11px; color: #8a6a3e; margin-top: 1px; }
.sp-bar  { height: 4px; background: #e8d4b0; border-radius: 2px; margin: 5px 0; }
.sp-fill { height: 100%; background: #9a50e0; border-radius: 2px; }
.panel-members { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 4px; }
.member-badge {
  font-size: 10px; background: #f4ead8;
  border: 1px solid #c8b090; padding: 2px 6px; border-radius: 10px; color: #5a3e1e;
}
.member-badge.dead { opacity: 0.35; text-decoration: line-through; }
.revive-count { font-size: 11px; color: #8a6a3e; text-align: center; padding: 4px 0; }


/* ── Result Overlay ── */
.result-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,0.55);
  display: flex; align-items: center; justify-content: center;
}
.result-box {
  background: #fdf6e8; border: 2px solid #c8b090;
  border-radius: 14px; padding: 40px 60px;
  display: flex; flex-direction: column; align-items: center; gap: 20px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
}
.result-title { font-size: 36px; font-weight: 800; color: #5a3e1e; }
.result-btn {
  padding: 10px 30px; background: #c8701e; color: #fff;
  border-radius: 8px; font-size: 15px; font-weight: 600; text-decoration: none;
}
.result-btn:hover { background: #a85818; }
</style>

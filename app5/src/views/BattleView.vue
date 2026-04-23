<template>
  <div class="battle-view">

    <!-- ── Top Bar ─────────────────────────────────────────────────────────── -->
    <div class="top-bar">
      <router-link to="/">← 返回備戰</router-link>
      <span class="phase">{{ phaseLabel }}</span>

      <!-- 主堡 HP + 計時器 -->
      <div v-if="store.gameState" class="base-status">
        <!-- 玩家主堡 -->
        <div class="base-hp player-base" :title="`主堡耐久：${Math.ceil(store.gameState.playerBaseHp)} / 1000`">
          <span class="base-label">🏰我方</span>
          <div class="hp-bar-bg">
            <div class="hp-bar-fill player" :style="{ width: (store.gameState.playerBaseHp / 1000 * 100) + '%' }" />
          </div>
          <span class="base-pct">{{ Math.ceil(store.gameState.playerBaseHp / 10) }}%</span>
        </div>

        <!-- 計時器 -->
        <div class="timer" :class="{ warning: timerWarning }">
          <span class="timer-icon">⏱</span>
          <span class="timer-val">{{ timerDisplay }}</span>
        </div>

        <!-- 敵方主堡 -->
        <div class="base-hp enemy-base" :title="`敵堡耐久：${Math.ceil(store.gameState.enemyBaseHp)} / 1000`">
          <span class="base-pct">{{ Math.ceil(store.gameState.enemyBaseHp / 10) }}%</span>
          <div class="hp-bar-bg">
            <div class="hp-bar-fill enemy" :style="{ width: (store.gameState.enemyBaseHp / 1000 * 100) + '%' }" />
          </div>
          <span class="base-label">敵方🏯</span>
        </div>
      </div>

      <div v-if="store.gameState" class="resources">
        <span class="res-mana">💧 {{ Math.floor(store.gameState.resources.mana) }}</span>
      </div>
      <div class="speed-controls">
        <button v-for="s in [1,2,3]" :key="s" @click="store.setSpeed(s)" :class="{ active: store.speedMultiplier === s }">×{{ s }}</button>
      </div>
    </div>

    <!-- ── 勝敗結果 overlay ──────────────────────────────────────────────── -->
    <div v-if="store.gameState?.phase === 'player_won' || store.gameState?.phase === 'enemy_won'" class="result-overlay">
      <div class="result-box">
        <div class="result-title">{{ store.gameState.phase === 'player_won' ? '🎉 勝利' : '💀 敗北' }}</div>
        <div class="result-reason">{{ resultReason }}</div>
        <router-link to="/" class="result-btn">返回備戰</router-link>
      </div>
    </div>

    <!-- ── Pixi Canvas ───────────────────────────────────────────────────── -->
    <div class="canvas-wrapper" ref="wrapperRef">
      <canvas ref="canvasRef" class="game-canvas" />
      <div class="zoom-controls">
        <button class="zoom-btn" @click="changeZoom(1)" title="放大">＋</button>
        <span class="zoom-label">{{ zoomLabel }}</span>
        <button class="zoom-btn" @click="changeZoom(-1)" title="縮小">－</button>
      </div>
    </div>

    <!-- ── 運輸帶區（從者帶 | 暫存區 | Trait 帶）──────────────────────────── -->
    <div v-if="store.gameState" class="conveyors">

      <!-- 從者帶 -->
      <div class="belt-col">
        <div class="belt-header">
          <span class="belt-title">從者帶</span>
          <span class="belt-status" :class="{ stopped: isFollowerBeltStopped }">
            {{ isFollowerBeltStopped ? '⏸ 滿' : `⏱ ${store.gameState.followerBelt.cooldownTicks}` }}
          </span>
        </div>
        <div class="belt-row">
          <div class="belt-hand">
            <div
              v-for="card in store.gameState.followerBelt.hand"
              :key="card.instanceId"
              class="belt-card"
              :title="`移入暫存：${followerName(card.followerDefId)}`"
              @click="handleStage(card.instanceId)"
            >
              <div class="bc-type">{{ followerName(card.followerDefId) }}</div>
              <div class="bc-cost">💧{{ followerCost(card.followerDefId) }}</div>
              <button class="bc-discard" @click.stop="store.discardFollower(card.instanceId)">✕</button>
            </div>
            <div v-for="i in followerEmptySlots" :key="`fe-${i}`" class="belt-card empty" />
          </div>
          <div class="belt-arrow">▶</div>
          <div class="belt-upcoming">
            <div
              v-for="(card, idx) in store.gameState.followerBelt.upcoming"
              :key="card.instanceId"
              class="belt-card preview"
              :style="{ opacity: 1 - idx * 0.2 }"
            >
              <div class="bc-type">{{ followerName(card.followerDefId) }}</div>
              <div class="bc-cost">💧{{ followerCost(card.followerDefId) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 暫存區 -->
      <div class="staging-col">
        <div class="belt-header">
          <span class="belt-title">暫存區</span>
          <span class="belt-status">{{ store.gameState.stagingArea.slots.length }}/{{ store.gameState.stagingArea.maxSlots }}</span>
        </div>
        <div class="staging-slots">
          <div
            v-for="staged in store.gameState.stagingArea.slots"
            :key="staged.instanceId"
            class="staged-card"
            :class="{ selected: selectedStagedId === staged.instanceId }"
            @click="handleStagedClick(staged.instanceId)"
          >
            <div class="sc-name">{{ followerName(staged.followerCard.followerDefId) }}</div>
            <div class="sc-cost">💧{{ followerCost(staged.followerCard.followerDefId) }}</div>
            <div class="sc-traits">
              <span v-for="t in staged.traits" :key="t" class="trait-badge">
                {{ traitIcon(t) }}
              </span>
              <span v-for="i in (staged.maxTraits - staged.traits.length)" :key="`empty-t-${i}`" class="trait-badge empty">+</span>
            </div>
            <button class="bc-discard" @click.stop="store.discardStaged(staged.instanceId)">✕</button>
          </div>
          <!-- 空槽 -->
          <div
            v-for="i in (store.gameState.stagingArea.maxSlots - store.gameState.stagingArea.slots.length)"
            :key="`se-${i}`"
            class="staged-card empty"
          >
            <div class="sc-empty-hint">點從者帶↑</div>
          </div>
        </div>
      </div>

      <!-- Trait 帶 -->
      <div class="belt-col belt-col-right">
        <div class="belt-header">
          <span class="belt-title">Trait 帶</span>
          <span class="belt-status" :class="{ stopped: isTraitBeltStopped }">
            {{ isTraitBeltStopped ? '⏸ 滿' : `⏱ ${store.gameState.traitBelt.cooldownTicks}` }}
          </span>
        </div>
        <div class="belt-row belt-row-rtl">
          <div class="belt-upcoming">
            <div
              v-for="(card, idx) in store.gameState.traitBelt.upcoming"
              :key="card.instanceId"
              class="belt-card preview trait-preview"
              :style="{ opacity: 1 - idx * 0.2 }"
            >
              <div class="bc-icon">{{ traitIcon(card.traitId) }}</div>
              <div class="bc-type">{{ traitName(card.traitId) }}</div>
            </div>
          </div>
          <div class="belt-arrow">◀</div>
          <div class="belt-hand">
            <div
              v-for="card in store.gameState.traitBelt.hand"
              :key="card.instanceId"
              class="belt-card trait-card"
              :class="{ selected: selectedTraitCardId === card.instanceId }"
              :title="traitDesc(card.traitId)"
              @click="toggleTraitCard(card.instanceId)"
            >
              <div class="bc-icon">{{ traitIcon(card.traitId) }}</div>
              <div class="bc-type">{{ traitName(card.traitId) }}</div>
              <button class="bc-discard" @click.stop="store.discardTrait(card.instanceId)">✕</button>
            </div>
            <div v-for="i in traitEmptySlots" :key="`te-${i}`" class="belt-card empty" />
          </div>
        </div>
      </div>

    </div>

    <!-- ── 小隊狀態面板 ───────────────────────────────────────────────────── -->
    <div class="squad-panels">
      <div v-for="squad in store.playerSquads" :key="squad.squadId" class="squad-panel player">
        <!-- 名稱 + 狀態 -->
        <div class="panel-top">
          <span class="panel-name">{{ captainName(squad.captainDefId) }}</span>
          <span class="panel-state" :class="squad.state">{{ STATE_LABEL[squad.state] ?? squad.state }}</span>
        </div>

        <!-- SP 條 -->
        <div class="sp-bar"><div class="sp-fill" :style="{ width: squad.sp + '%' }"></div></div>

        <!-- 復活倒數 / 護盾狀態 -->
        <div v-if="squad.state === 'retreating'" class="revive-count">
          ⏳ {{ squad.reviveAtTick !== null ? squad.reviveAtTick - (store.gameState?.tick ?? 0) : '—' }} tick
        </div>
        <div v-else class="panel-members">
          <span class="member-badge">{{ Math.ceil(squad.hp / squad.maxHp * 100) }}%</span>
          <span
            v-for="s in squad.shieldLayers" :key="s.instanceId"
            class="member-badge shield"
            :class="{ dead: s.isDead }"
            :title="s.traits.map(t => traitName(t)).join(', ') || '無 Trait'"
          >
            {{ s.isDead ? '✗' : (s.traits.length ? s.traits.map(t => traitIcon(t)).join('') : '🛡') }}
          </span>
        </div>

        <!-- 路線切換 -->
        <div class="route-btns">
          <button v-for="r in ROUTES" :key="r.value"
            class="route-btn"
            :class="{ active: squad.aiConfig.route === r.value }"
            @click.stop="store.setSquadRoute(squad.squadId, r.value); if (selectedSquadId === squad.squadId) showSelection(squad.squadId)">
            {{ r.label }}
          </button>
        </div>

        <!-- 行為切換 -->
        <div class="behavior-btns">
          <button v-for="b in BEHAVIORS" :key="b.value"
            class="behavior-btn"
            :class="{ active: squad.aiConfig.behavior === b.value }"
            @click.stop="store.setSquadBehavior(squad.squadId, b.value)">
            {{ b.label }}
          </button>
        </div>

        <!-- 召喚按鈕（選中暫存從者時出現）-->
        <button
          v-if="selectedStagedId"
          class="summon-btn"
          :disabled="!canSummon(squad.squadId)"
          @click.stop="handleSummon(squad.squadId)"
        >
          ➕ 召喚 {{ selectedStagedName }}
        </button>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted } from 'vue'
import { useGameStore } from '../stores/gameStore'
import type { HexPos, RouteAssign, AIBehavior, SquadState, TraitType } from '../engine/types'
import { PixiHexRenderer } from '../game/PixiHexRenderer'
import { ref } from 'vue'
import { NAMED_ZONES, CLICKABLE_ZONES } from '../engine/mapData'

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

function showSelection(squadId: string) {
  const squad = store.gameState?.squads[squadId]
  if (!squad || !store.gameState) return
  renderer?.setSelectedSquad(squadId)
  renderer?.showSquadSelection(
    squad,
    store.gameState.cells,
    store.gameState.lanes,
    CLICKABLE_ZONES,
  )
}

function onSquadClick(squadId: string) {
  const squad = store.gameState?.squads[squadId]
  if (!squad) return

  if (squad.team === 'player') {
    if (selectedSquadId.value === squadId) {
      deselect()
    } else {
      selectedSquadId.value = squadId
      showSelection(squadId)
    }
  }
}

function onCellClick(pos: HexPos) {
  const sid = selectedSquadId.value
  if (!sid) return

  const hit = CLICKABLE_ZONES.find(z =>
    z.cells.some(c => c.q === pos.q && c.r === pos.r)
  )
  if (hit) {
    store.setSquadRoute(sid, hit.route)
    showSelection(sid)
  } else {
    deselect()
  }
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

  if (store.gameState) {
    renderer.buildMap(store.gameState.cells, store.gameState.zones)
    renderer.syncState(store.gameState)
    mapBuilt = true
  }

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
      renderer.buildMap(state.cells, state.zones)
      mapBuilt = true
    }
    renderer.syncState(state)
  },
  { deep: false }
)

// ─── 顯示用 ──────────────────────────────────────────────────────────────────

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

// ── 計時器 ───────────────────────────────────────────────────────────────────
const timerDisplay = computed(() => {
  if (!store.gameState) return '--:--'
  const remaining = Math.max(0, store.gameState.maxTicks - store.gameState.tick)
  const secs = Math.ceil(remaining * 0.12)   // 120ms per tick
  const mm = Math.floor(secs / 60).toString().padStart(2, '0')
  const ss = (secs % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
})

const timerWarning = computed(() => {
  if (!store.gameState) return false
  return (store.gameState.maxTicks - store.gameState.tick) < 600  // 最後 ~72s
})

// ── 勝因說明（取最後一行有意義的 log）────────────────────────────────────────
const resultReason = computed(() => {
  if (!store.gameState) return ''
  const log = store.gameState.log
  for (let i = log.length - 1; i >= 0; i--) {
    const line = log[i]
    if (line.includes('主堡') || line.includes('佔點') || line.includes('佔領'))
      return line
  }
  return ''
})

function captainName(defId: string) {
  return store.captainDefs.find(c => c.id === defId)?.name ?? defId
}

const ROUTES = computed<{ label: string; value: RouteAssign }[]>(() =>
  store.gameState?.lanes.map(l => ({ label: l.label, value: l.id })) ?? [
    { label: '上路', value: 'top'    },
    { label: '中路', value: 'mid'    },
    { label: '下路', value: 'bottom' },
  ]
)

const BEHAVIORS: { label: string; value: AIBehavior }[] = [
  { label: '進攻', value: 'aggressive' },
  { label: '佔點', value: 'capture'    },
]

const STATE_LABEL: Partial<Record<SquadState, string>> = {
  moving:     '前進中',
  fighting:   '戰鬥中',
  capturing:  '佔領中',
  idle:       '待機',
  retreating: '敗退',
}

// ─── Follower 輔助 ───────────────────────────────────────────────────────────

function followerName(defId: string) {
  return store.followerDefs.find(f => f.id === defId)?.name ?? defId
}
function followerCost(defId: string) {
  return store.followerDefs.find(f => f.id === defId)?.productionCost ?? 0
}

const isFollowerBeltStopped = computed(() => {
  const belt = store.gameState?.followerBelt
  return belt ? belt.hand.length >= belt.maxHand : false
})
const followerEmptySlots = computed(() => {
  const belt = store.gameState?.followerBelt
  return belt ? Math.max(0, belt.maxHand - belt.hand.length) : 4
})

// ─── Trait 輔助 ───────────────────────────────────────────────────────────────

function traitIcon(id: TraitType)  { return store.traitDefs.find(t => t.id === id)?.icon  ?? id }
function traitName(id: TraitType)  { return store.traitDefs.find(t => t.id === id)?.name  ?? id }
function traitDesc(id: TraitType)  { return store.traitDefs.find(t => t.id === id)?.desc  ?? id }

const isTraitBeltStopped = computed(() => {
  const belt = store.gameState?.traitBelt
  return belt ? belt.hand.length >= belt.maxHand : false
})
const traitEmptySlots = computed(() => {
  const belt = store.gameState?.traitBelt
  return belt ? Math.max(0, belt.maxHand - belt.hand.length) : 4
})

// ─── 暫存區互動 ──────────────────────────────────────────────────────────────

const selectedTraitCardId = ref<string | null>(null)
const selectedStagedId    = ref<string | null>(null)

function toggleTraitCard(instanceId: string) {
  selectedTraitCardId.value = selectedTraitCardId.value === instanceId ? null : instanceId
}

// 點從者帶牌 → 移入暫存區
function handleStage(cardInstanceId: string) {
  store.stageFollower(cardInstanceId)
}

// 點暫存牌
function handleStagedClick(stagedInstanceId: string) {
  if (selectedTraitCardId.value) {
    // 有 Trait 選中 → 疊加 Trait
    const ok = store.applyTraitToStaged(selectedTraitCardId.value, stagedInstanceId)
    if (ok) selectedTraitCardId.value = null
  } else {
    // 無 Trait 選中 → 切換選中狀態（準備召喚）
    selectedStagedId.value = selectedStagedId.value === stagedInstanceId ? null : stagedInstanceId
  }
}

const selectedStagedName = computed(() => {
  if (!selectedStagedId.value || !store.gameState) return ''
  const staged = store.gameState.stagingArea.slots.find(s => s.instanceId === selectedStagedId.value)
  return staged ? followerName(staged.followerCard.followerDefId) : ''
})

function canSummon(squadId: string): boolean {
  if (!selectedStagedId.value || !store.gameState) return false
  const staged = store.gameState.stagingArea.slots.find(s => s.instanceId === selectedStagedId.value)
  if (!staged) return false
  const cost  = followerCost(staged.followerCard.followerDefId)
  const squad = store.gameState.squads[squadId]
  if (!squad) return false
  const alive = squad.shieldLayers.filter(s => !s.isDead).length
  return store.gameState.resources.mana >= cost && alive < squad.maxShieldSlots
}

function handleSummon(squadId: string) {
  if (!selectedStagedId.value) return
  const ok = store.summonStagedFollower(selectedStagedId.value, squadId)
  if (ok) selectedStagedId.value = null
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
.resources { display: flex; gap: 12px; font-size: 13px; font-weight: 700; }
.res-mana  { color: #1a6a8a; }

/* ── 主堡 HP + 計時器 ── */
.base-status {
  display: flex; align-items: center; gap: 10px; flex: 1;
  justify-content: center;
}
.base-hp {
  display: flex; align-items: center; gap: 5px;
}
.base-label { font-size: 11px; font-weight: 700; white-space: nowrap; }
.hp-bar-bg {
  width: 72px; height: 8px; background: #e0cca0;
  border-radius: 4px; overflow: hidden;
  border: 1px solid #c8b090;
}
.hp-bar-fill {
  height: 100%; border-radius: 3px; transition: width 0.3s;
}
.hp-bar-fill.player { background: #3a9a5a; }
.hp-bar-fill.enemy  { background: #c03020; }
.base-pct { font-size: 10px; font-weight: 700; color: #5a3e1e; min-width: 28px; text-align: center; }

.timer {
  display: flex; align-items: center; gap: 3px;
  background: #fdf6e8; border: 1px solid #c8b090;
  border-radius: 6px; padding: 2px 8px;
  font-size: 13px; font-weight: 700; color: #5a3e1e;
}
.timer.warning { border-color: #c05020; color: #c05020; background: #fff4e0; }
.timer-icon { font-size: 12px; }
.timer-val  { font-variant-numeric: tabular-nums; letter-spacing: 1px; }

/* ── Canvas ── */
.canvas-wrapper {
  flex: 1; overflow: hidden; position: relative;
  border: 1px solid #c8b090; border-radius: 8px;
  background: #ede0c8;
}
.game-canvas { display: block; width: 100%; height: 100%; }
.zoom-controls {
  position: absolute; top: 8px; right: 8px;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  background: rgba(253,246,232,0.88); border: 1px solid #c8b090;
  border-radius: 8px; padding: 4px 6px; backdrop-filter: blur(4px);
}
.zoom-btn {
  width: 28px; height: 28px; border: 1px solid #c8b090;
  background: #f4ead8; color: #5a3e1e; border-radius: 5px;
  font-size: 16px; line-height: 1; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.zoom-btn:hover { background: #e8d4b0; }
.zoom-label { font-size: 11px; color: #8a6a3e; min-width: 36px; text-align: center; }

/* ── 運輸帶區（三欄） ── */
.conveyors {
  display: flex; gap: 8px; flex-shrink: 0;
  background: #fdf6e8; border: 1px solid #c8b090;
  border-radius: 8px; padding: 6px 10px; box-sizing: border-box;
}

.belt-col {
  display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0;
}
.belt-col-right { /* right belt, upcoming on left side */ }
.staging-col {
  display: flex; flex-direction: column; gap: 4px;
  flex: 0 0 auto; min-width: 130px;
  border-left: 1px solid #e0cca0; border-right: 1px solid #e0cca0;
  padding: 0 8px;
}

.belt-header {
  display: flex; align-items: center; justify-content: space-between;
}
.belt-title  { font-size: 11px; font-weight: 700; color: #5a3e1e; }
.belt-status { font-size: 10px; color: #8a6a3e; }
.belt-status.stopped { color: #c05020; font-weight: 700; }

.belt-row { display: flex; align-items: center; gap: 5px; }
.belt-row-rtl { flex-direction: row-reverse; }
.belt-hand     { display: flex; gap: 4px; }
.belt-upcoming { display: flex; gap: 3px; }
.belt-arrow    { font-size: 11px; color: #c8b090; flex-shrink: 0; }

/* ── Belt Cards ── */
.belt-card {
  width: 58px; height: 68px; flex-shrink: 0;
  background: #f4ead8; border: 2px solid #c8b090;
  border-radius: 8px; padding: 4px 3px;
  display: flex; flex-direction: column; align-items: center; justify-content: space-between;
  cursor: pointer; position: relative; transition: border-color 0.12s;
  box-sizing: border-box;
}
.belt-card:hover:not(.empty) { border-color: #a07040; }
.belt-card.empty   { background: #ede0c8; border-style: dashed; cursor: default; opacity: 0.4; }
.belt-card.preview { width: 46px; height: 56px; cursor: default; border-color: #c8b090; background: #ede0c8; }
.belt-card.selected { border-color: #c8701e; background: #fff4e0; box-shadow: 0 0 0 2px #c8701e44; }

.bc-type { font-size: 10px; font-weight: 700; color: #3a2e1e; text-align: center; line-height: 1.2; }
.bc-icon { font-size: 16px; line-height: 1; }
.bc-cost { font-size: 9px; color: #1a6a8a; font-weight: 600; }
.bc-discard {
  position: absolute; top: 2px; right: 3px;
  background: none; border: none; font-size: 9px; color: #a07040;
  cursor: pointer; padding: 0; line-height: 1;
}
.bc-discard:hover { color: #c03020; }

/* ── Trait cards ── */
.trait-card { border-color: #9a60c0; background: #f4eaff; }
.trait-card:hover:not(.empty) { border-color: #7a40a0; }
.trait-card.selected { border-color: #9a20c0; background: #f0e0ff; box-shadow: 0 0 0 2px #9a20c044; }
.trait-preview { border-color: #c0a0d8; background: #ede0f4; }

/* ── Staging Area ── */
.staging-slots { display: flex; gap: 6px; align-items: flex-start; }

.staged-card {
  width: 62px; min-height: 80px; flex-shrink: 0;
  background: #e8f4e8; border: 2px solid #60a060;
  border-radius: 8px; padding: 5px 4px;
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  cursor: pointer; position: relative; transition: border-color 0.12s;
  box-sizing: border-box;
}
.staged-card:hover:not(.empty) { border-color: #3a8a3a; }
.staged-card.empty {
  background: #ede0c8; border-style: dashed; border-color: #a0c0a0;
  cursor: default; opacity: 0.5;
  display: flex; align-items: center; justify-content: center;
}
.staged-card.selected { border-color: #1a7a3e; background: #d0f0d0; box-shadow: 0 0 0 2px #1a7a3e44; }

.sc-name  { font-size: 10px; font-weight: 700; color: #1a4a1a; text-align: center; }
.sc-cost  { font-size: 9px; color: #1a6a8a; }
.sc-traits { display: flex; gap: 2px; flex-wrap: wrap; justify-content: center; }
.sc-empty-hint { font-size: 9px; color: #8a9a80; text-align: center; }

.trait-badge {
  font-size: 12px; line-height: 1;
  background: #d0e8ff; border: 1px solid #88aacc;
  border-radius: 4px; padding: 1px 2px;
}
.trait-badge.empty {
  background: #e8e8e8; border-color: #c0c0c0; color: #888;
  font-size: 10px;
}

/* ── Squad Panels ── */
.squad-panels { display: flex; gap: 8px; flex-shrink: 0; box-sizing: border-box; }
.squad-panel {
  flex: 1; background: #fdf6e8; overflow: hidden;
  border: 1px solid #c8a870; border-radius: 8px; padding: 6px 8px;
  box-sizing: border-box; display: flex; flex-direction: column; gap: 4px;
}
.panel-top { display: flex; align-items: center; justify-content: space-between; gap: 4px; }
.panel-name  { font-weight: 700; font-size: 13px; color: #5a3e1e; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.panel-state { font-size: 10px; padding: 1px 5px; border-radius: 6px; background: #e8d4b0; color: #5a3e1e; white-space: nowrap; flex-shrink: 0; }
.panel-state.fighting  { background: #ffd4d4; color: #8a1a1a; }
.panel-state.capturing { background: #d4f0d4; color: #1a6a1a; }
.panel-state.retreating{ background: #d4d4f0; color: #1a1a8a; }
.sp-bar  { height: 3px; background: #e8d4b0; border-radius: 2px; }
.sp-fill { height: 100%; background: #9a50e0; border-radius: 2px; }
.panel-members { display: flex; gap: 4px; flex-wrap: wrap; }
.member-badge {
  font-size: 10px; background: #f4ead8;
  border: 1px solid #c8b090; padding: 1px 5px; border-radius: 8px; color: #5a3e1e;
}
.member-badge.shield { background: #d4e8f4; border-color: #88aacc; }
.member-badge.dead { opacity: 0.3; }
.revive-count { font-size: 10px; color: #8a6a3e; }

/* 路線 / 行為按鈕 */
.route-btns, .behavior-btns { display: flex; gap: 3px; flex-wrap: wrap; }
.route-btn, .behavior-btn {
  flex: 1; padding: 2px 0; font-size: 10px; font-weight: 600;
  border: 1px solid #c8b090; border-radius: 4px;
  background: #f4ead8; color: #5a3e1e; cursor: pointer;
  transition: all 0.12s; white-space: nowrap;
}
.route-btn.active   { background: #c8701e; border-color: #c8701e; color: #fff; }
.behavior-btn.active { background: #1a7a3e; border-color: #1a7a3e; color: #fff; }

.summon-btn {
  width: 100%; margin-top: 2px;
  padding: 3px 0; font-size: 10px; font-weight: 700;
  background: #1a7a3e; border: none; color: #fff;
  border-radius: 4px; cursor: pointer;
}
.summon-btn:disabled { background: #8a9a88; cursor: not-allowed; opacity: 0.6; }
.summon-btn:not(:disabled):hover { background: #156030; }

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
.result-title  { font-size: 36px; font-weight: 800; color: #5a3e1e; }
.result-reason { font-size: 14px; color: #7a5e3e; min-height: 20px; }
.result-btn {
  padding: 10px 30px; background: #c8701e; color: #fff;
  border-radius: 8px; font-size: 15px; font-weight: 600; text-decoration: none;
}
.result-btn:hover { background: #a85818; }
</style>

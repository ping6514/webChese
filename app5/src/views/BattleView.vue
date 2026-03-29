<template>
  <div class="battle-view">
    <div class="top-bar">
      <router-link to="/">← 返回備戰</router-link>
      <span class="phase">{{ phaseLabel }}</span>
      <div class="speed-controls">
        <button v-for="s in [1,2,3]" :key="s" @click="store.setSpeed(s)" :class="{ active: store.speedMultiplier === s }">×{{ s }}</button>
      </div>
    </div>

    <!-- 選中小隊提示 -->
    <div class="select-hint" v-if="selectedSquadId">
      <span>已選中：{{ captainName(selectedSquad?.captainDefId ?? '') }}</span>
      <span class="hint-sub">點擊地圖格子設定移動目標</span>
      <button class="deselect-btn" @click="selectedSquadId = null">取消選中</button>
    </div>
    <div class="select-hint muted" v-else>
      點擊己方小隊 token 可指定移動目標
    </div>

    <!-- 勝敗結果 overlay -->
    <div v-if="store.gameState?.phase === 'player_won' || store.gameState?.phase === 'enemy_won'" class="result-overlay">
      <div class="result-box">
        <div class="result-title">{{ store.gameState.phase === 'player_won' ? '🎉 勝利' : '💀 敗北' }}</div>
        <router-link to="/" class="result-btn">返回備戰</router-link>
      </div>
    </div>

    <!-- 地圖格子 -->
    <div class="map-container">
      <div class="map-grid" :style="mapContainerSize">
        <div
          v-for="cell in sortedCells"
          :key="`${cell.pos.q},${cell.pos.r}`"
          class="cell"
          :class="[cell.terrain, { impassable: !cell.passable, 'cell-target': isManualTarget(cell.pos) }]"
          :style="cellStyle(cell.pos)"
          @click="onCellClick(cell.pos)"
        >
          <!-- 建築顯示 -->
          <div v-if="cell.building" class="building" :class="cell.building.team">
            {{ buildingIcon(cell.building.type) }}
          </div>
          <!-- 小隊顯示 -->
          <div
            v-for="squad in squadsAt(cell.pos)"
            :key="squad.squadId"
            class="squad-token"
            :class="[squad.team, { 'squad-selected': squad.squadId === selectedSquadId }]"
            @click.stop="onSquadClick(squad)"
          >
            <div class="squad-name">{{ captainName(squad.captainDefId) }}</div>
            <div class="squad-hp-bar">
              <div class="hp-fill" :style="{ width: captainHpPct(squad) + '%' }"></div>
            </div>
            <div class="member-pips">
              <span v-for="m in squad.members" :key="m.instanceId" class="pip" :class="{ dead: m.isDead, captain: m.isCaptain }"></span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 戰鬥 log -->
    <div class="battle-log">
      <div v-for="(entry, i) in recentLog" :key="i">{{ entry }}</div>
    </div>

    <!-- 小隊狀態面板 -->
    <div class="squad-panels">
      <div v-for="squad in store.playerSquads" :key="squad.squadId" class="squad-panel player">
        <div class="panel-name">{{ captainName(squad.captainDefId) }}</div>
        <div class="panel-state">{{ squad.state }}</div>
        <div class="sp-bar"><div class="sp-fill" :style="{ width: squad.sp + '%' }"></div></div>
        <div v-if="squad.state === 'retreating'" class="revive-count">
          ⏳ {{ squad.reviveAtTick !== null ? squad.reviveAtTick - (store.gameState?.tick ?? 0) : '—' }} tick
        </div>
        <div v-else class="panel-members">
          <span v-for="m in squad.members" :key="m.instanceId" class="member-badge" :class="{ dead: m.isDead }">
            {{ m.isCaptain ? '隊' : '從' }} {{ Math.ceil(m.hp / m.maxHp * 100) }}%
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '../stores/gameStore'
import type { HexPos, SquadInstance } from '../engine/types'
import { hexKey } from '../engine/types'

const store = useGameStore()

// ─── 選中小隊 ────────────────────────────────────────────────────────────────
const selectedSquadId = ref<string | null>(null)

const selectedSquad = computed(() =>
  selectedSquadId.value ? store.gameState?.squads[selectedSquadId.value] ?? null : null
)

function onSquadClick(squad: SquadInstance) {
  if (squad.team !== 'player') return   // 只能選己方
  selectedSquadId.value = squad.squadId === selectedSquadId.value ? null : squad.squadId
}

function onCellClick(pos: HexPos) {
  if (!selectedSquadId.value) return
  const cell = store.gameState?.cells[hexKey(pos)]
  if (!cell || !cell.passable) return
  store.setManualTarget(selectedSquadId.value, pos)
  selectedSquadId.value = null   // 設定完自動取消選中
}

function isManualTarget(pos: HexPos): boolean {
  if (!store.gameState) return false
  return Object.values(store.gameState.squads).some(sq =>
    sq.manualTargetPos &&
    sq.manualTargetPos.q === pos.q &&
    sq.manualTargetPos.r === pos.r
  )
}

const phaseLabel = computed(() => {
  const p = store.gameState?.phase
  if (p === 'running') return `⚔️ 戰鬥中 (tick: ${store.gameState?.tick})`
  if (p === 'player_won') return '🎉 玩家勝利'
  if (p === 'enemy_won') return '💀 敵方勝利'
  return '準備中'
})

const sortedCells = computed(() => {
  if (!store.gameState) return []
  return Object.values(store.gameState.cells).sort((a, b) =>
    a.pos.r !== b.pos.r ? a.pos.r - b.pos.r : a.pos.q - b.pos.q
  )
})

// pointy-top 六角格，odd-r offset（奇數行右偏半格）
const HEX_SIZE = 38        // 外接圓半徑 px
const HEX_W = Math.sqrt(3) * HEX_SIZE   // ≈ 65.8px，格子寬
const HEX_H = 2 * HEX_SIZE              // 76px，格子高
const HEX_VERT = HEX_SIZE * 1.5         // 57px，行間距（上下六角重疊）

function cellStyle(pos: HexPos) {
  const x = pos.q * HEX_W + (pos.r & 1) * (HEX_W / 2)
  const y = pos.r * HEX_VERT
  return {
    position: 'absolute' as const,
    left: `${x}px`,
    top: `${y}px`,
    width: `${HEX_W}px`,
    height: `${HEX_H}px`,
  }
}

const mapContainerSize = computed(() => ({
  width: `${10 * HEX_W + HEX_W / 2 + 4}px`,
  height: `${5 * HEX_VERT + HEX_H + 4}px`,
}))

function squadsAt(pos: HexPos): SquadInstance[] {
  if (!store.gameState) return []
  return Object.values(store.gameState.squads).filter(
    s => s.pos.q === pos.q && s.pos.r === pos.r && s.members.some(m => !m.isDead)
  )
}

function captainName(defId: string) {
  return store.captainDefs.find(c => c.id === defId)?.name ?? defId
}

function captainHpPct(squad: SquadInstance) {
  const cap = squad.members.find(m => m.isCaptain)
  if (!cap) return 0
  return Math.ceil((cap.hp / cap.maxHp) * 100)
}

function buildingIcon(type: string) {
  const icons: Record<string, string> = {
    mainBase: '🏰', tower: '🗼', outpost: '⛺', barracks: '⚔️',
    spring: '💧', workshop: '🔧', altar: '✨', gate: '🚪',
  }
  return icons[type] ?? '?'
}

const recentLog = computed(() => {
  const log = store.gameState?.log ?? []
  return log.slice(-8).reverse()
})
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
  border-radius: 8px; padding: 8px 16px;
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

/* ── Select Hint ── */
.select-hint {
  display: flex; align-items: center; gap: 12px;
  background: #fdf6e8; border: 1px solid #c8b090;
  border-radius: 6px; padding: 6px 14px; font-size: 13px; font-weight: 600;
  color: #5a3e1e;
}
.select-hint.muted { color: #a08060; font-weight: 400; font-size: 12px; }
.hint-sub { font-size: 11px; color: #8a6a3e; font-weight: 400; }
.deselect-btn {
  margin-left: auto; padding: 2px 10px;
  border: 1px solid #c8b090; background: #f4ead8;
  color: #5a3e1e; border-radius: 4px; font-size: 12px;
}

/* ── Map ── */
.map-container {
  flex: 1; overflow: auto;
  display: flex; align-items: center; justify-content: center;
  background: #ede0c8; border: 1px solid #c8b090; border-radius: 8px;
}
.map-grid { position: relative; }

/* pointy-top 六角形 */
.cell {
  position: absolute;
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  cursor: default; transition: filter 0.1s;
}
.cell:hover { filter: brightness(1.15); cursor: pointer; }
.cell-target { outline: 3px solid #c8701e; outline-offset: -3px; filter: brightness(1.2); }
.cell.normal     { background: #d8c8a8; }
.cell.highGround { background: #b8c890; }
.cell.forest     { background: #789060; }
.cell.river      { background: #8ab4c8; }
.cell.bridge     { background: #c8b478; }
.cell.impassable { background: #6a5a48; opacity: 0.5; }

.building { font-size: 16px; line-height: 1; }

/* squad token 置中在六角中，不受 clip-path 裁切 */
.squad-token {
  position: absolute;
  left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  width: 52px; height: 52px;
  border-radius: 50%;
  padding: 3px;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  font-size: 9px; z-index: 2; pointer-events: auto;
}
.squad-token.player { background: rgba(40, 80, 180, 0.90); border: 2px solid #6af; cursor: pointer; }
.squad-token.enemy  { background: rgba(160, 40, 20, 0.90); border: 2px solid #f86; pointer-events: none; }
.squad-selected { border: 3px solid #ff0 !important; box-shadow: 0 0 8px rgba(255,220,0,0.8); }
.squad-name { font-weight: 700; font-size: 8px; text-align: center; line-height: 1.1; color: #fff; }
.squad-hp-bar { width: 88%; height: 3px; background: rgba(0,0,0,0.3); border-radius: 2px; margin: 2px 0; }
.hp-fill { height: 100%; background: #7f4; border-radius: 2px; transition: width 0.15s; }
.member-pips { display: flex; gap: 1px; flex-wrap: wrap; justify-content: center; }
.pip { width: 5px; height: 5px; border-radius: 50%; background: rgba(255,255,255,0.6); }
.pip.dead    { background: rgba(0,0,0,0.3); }
.pip.captain { background: #ff0; }

/* ── Battle Log ── */
.battle-log {
  height: 72px; overflow-y: auto;
  background: #fdf6e8; border: 1px solid #c8b090;
  padding: 8px 10px; font-size: 11px; font-family: monospace;
  border-radius: 6px; color: #5a3e1e;
}

/* ── Squad Panels ── */
.squad-panels { display: flex; gap: 10px; }
.squad-panel {
  flex: 1; background: #fdf6e8;
  border: 1px solid #c8a870; border-radius: 8px; padding: 8px 10px;
}
.panel-name { font-weight: 700; font-size: 14px; color: #5a3e1e; }
.panel-state { font-size: 11px; color: #8a6a3e; margin-top: 1px; }
.sp-bar { height: 4px; background: #e8d4b0; border-radius: 2px; margin: 5px 0; }
.sp-fill { height: 100%; background: #9a50e0; border-radius: 2px; }
.panel-members { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 4px; }
.member-badge {
  font-size: 10px; background: #f4ead8;
  border: 1px solid #c8b090; padding: 2px 6px; border-radius: 10px;
  color: #5a3e1e;
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
  border-radius: 8px; font-size: 15px; font-weight: 600;
  text-decoration: none;
}
.result-btn:hover { background: #a85818; }
</style>

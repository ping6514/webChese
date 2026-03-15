<template>
  <div class="combat-root">

    <!-- ── 左側導航欄 ──────────────────────────────────────────────────────── -->
    <nav class="left-nav" :class="{ 'left-nav--collapsed': navCollapsed }">
      <!-- 收合按鈕 -->
      <button class="nav-collapse-btn" @click="navCollapsed = !navCollapsed"
              :title="navCollapsed ? '展開' : '收合'">
        {{ navCollapsed ? '▶' : '◀' }}
      </button>

      <div class="nav-items">
        <!-- 💡 房間狀態 -->
        <button class="nav-btn" :class="{ 'nav-btn--active': showRoomStatus }"
                @click="showRoomStatus = !showRoomStatus" title="房間狀態">
          <span class="nav-icon">💡</span>
          <span class="nav-label">房間狀態</span>
        </button>

        <!-- ⚔️ 行動選單（只在玩家回合顯示） -->
        <button class="nav-btn" :class="{ 'nav-btn--pulse': game.isPlayerTurn }"
                :disabled="!game.isPlayerTurn"
                @click="openActionMenu" title="行動選單">
          <span class="nav-icon">⚔️</span>
          <span class="nav-label">行動</span>
        </button>

        <!-- 📋 結束回合 -->
        <button class="nav-btn" :disabled="!game.isPlayerTurn"
                @click="onEndTurn" title="結束行動">
          <span class="nav-icon">⏭</span>
          <span class="nav-label">結束</span>
        </button>

        <!-- 🎒 背包 -->
        <button class="nav-btn" :class="{ 'nav-btn--active': showInventory }"
                @click="showInventory = !showInventory" title="背包 / 資產">
          <span class="nav-icon">🎒</span>
          <span class="nav-label">背包</span>
        </button>
      </div>

      <!-- 背包展開面板 -->
      <Transition name="inventory">
        <div v-if="showInventory && !navCollapsed" class="inventory-panel">
          <div class="inventory-title">🎒 玩家資產</div>
          <template v-for="u in game.playerUnits" :key="u.id">
            <div class="inv-unit-name">{{ u.name }}</div>
            <!-- 武器 -->
            <div class="inv-section-label">武器</div>
            <template v-for="(w, i) in u.weapons" :key="i">
              <div v-if="w" class="inv-item inv-item--weapon"
                   @click="inventoryWeapon = w" title="點擊查看詳情">
                <span class="inv-item-slot">#{{ i + 1 }}</span>
                <span class="inv-item-name">{{ w.name }}</span>
                <span class="inv-item-atk">{{ w.atkFinal.toFixed(0) }}</span>
              </div>
              <div v-else class="inv-item inv-item--empty">
                <span class="inv-item-slot">#{{ i + 1 }}</span>
                <span class="inv-item-empty">（空）</span>
              </div>
            </template>
          </template>
        </div>
      </Transition>
    </nav>

    <!-- ── 棋盤中央區 ──────────────────────────────────────────────────────── -->
    <div class="board-area">
      <!-- 地形資訊面板（左上角） -->
      <CellInfoPanel />

      <div class="board-center">
        <BoardGrid
          v-if="game.gameState"
          @cell-click="onCellClick"
          @unit-click="onUnitClick"
        />
      </div>

      <!-- 回合狀態徽章 -->
      <div class="turn-badge" :class="{ 'turn-badge--enemy': !game.isPlayerTurn }">
        <template v-if="game.isPlayerTurn">⚔️ 你的回合（{{ game.pendingUnit?.name }}）</template>
        <template v-else-if="game.pendingUnitId">{{ game.pendingUnit?.name }} 行動中…</template>
        <template v-else>時間推進中…</template>
      </div>
    </div>

    <!-- ── 右側詳情面板 ────────────────────────────────────────────────────── -->
    <aside class="right-panel" :class="{ 'right-panel--collapsed': rightCollapsed }">
      <div class="right-panel__header">
        <span v-if="!rightCollapsed" class="right-panel__title">單位詳情</span>
        <button class="right-collapse-btn" @click="rightCollapsed = !rightCollapsed"
                :title="rightCollapsed ? '展開詳情' : '收合'">
          {{ rightCollapsed ? '◀' : '▶' }}
        </button>
      </div>

      <div v-if="!rightCollapsed" class="right-panel__body">
        <!-- 選中敵方單位詳情（優先顯示） -->
        <template v-if="selectedUnit && selectedUnit.kind !== 'player'">
          <div class="panel-section-title-row">
            <span class="panel-section-title">👾 敵方單位</span>
            <button class="panel-info-btn" title="詳細屬性" @click="statsModalUnit = selectedUnit">ℹ️</button>
          </div>
          <UnitDetailPanel :unit="selectedUnit" />
          <div class="divider" />
        </template>

        <!-- 玩家資訊 -->
        <div class="panel-section-title-row">
          <span class="panel-section-title">🧍 我的角色</span>
        </div>
        <section v-for="u in game.playerUnits" :key="u.id" class="player-card"
                 :class="{ 'player-card--selected': u.id === game.selectedUnitId }"
                 @click="game.selectUnit(u.id)">
          <div class="player-card__header">
            <span class="player-card__name">{{ u.name }}</span>
            <span class="player-card__job">{{ u.jobId }}</span>
            <button class="player-info-btn" title="詳細屬性" @click.stop="statsModalUnit = u">ℹ️</button>
          </div>
          <div class="mini-bar-row">
            <span class="mini-bar-label">HP</span>
            <div class="bar-wrap flex1"><div class="bar-fill bar-hp" :style="{width: pct(u.currentHP, u.maxHP)+'%'}" /></div>
            <span class="mini-bar-val">{{ u.currentHP }}/{{ u.maxHP }}</span>
          </div>
          <div class="mini-bar-row">
            <span class="mini-bar-label">SP</span>
            <div class="bar-wrap flex1"><div class="bar-fill bar-sp" :style="{width: pct(u.currentSP, u.maxSP)+'%'}" /></div>
            <span class="mini-bar-val">{{ u.currentSP }}/{{ u.maxSP }}</span>
          </div>
          <div class="mini-bar-row">
            <span class="mini-bar-label">MP</span>
            <div class="bar-wrap flex1"><div class="bar-fill" style="background:#8b4eb5" :style="{width: pct(u.currentMP, u.maxMP)+'%'}" /></div>
            <span class="mini-bar-val">{{ u.currentMP }}/{{ u.maxMP }}</span>
          </div>
        </section>

        <!-- 點擊玩家展開詳情 -->
        <template v-if="selectedUnit && selectedUnit.kind === 'player'">
          <div class="divider" />
          <UnitDetailPanel :unit="selectedUnit" />
        </template>
        <div v-else-if="!selectedUnit" class="hint-text">點擊棋盤單位查看詳情</div>
      </div>
    </aside>

    <!-- ── 房間狀態 Overlay ──────────────────────────────────────────────── -->
    <Transition name="room-panel">
      <div v-if="showRoomStatus" class="room-overlay" @click.self="showRoomStatus = false">
        <div class="room-panel panel">
          <div class="room-panel__header">
            <span>💡 房間狀態</span>
            <button class="close-btn" @click="showRoomStatus = false">✕</button>
          </div>

          <!-- 任務目標 -->
          <div class="room-section">
            <div class="section-title">任務目標</div>
            <div class="objective-row">
              <span class="objective-icon">{{ objectiveIcon }}</span>
              <span class="objective-text">{{ objectiveText }}</span>
            </div>
          </div>

          <!-- 玩家陣列 -->
          <div class="room-section">
            <div class="section-title">我方單位（{{ game.playerUnits.length }}）</div>
            <div v-for="u in game.playerUnits" :key="u.id" class="unit-row unit-row--player"
                 @click="game.selectUnit(u.id); showRoomStatus = false">
              <div class="unit-row__glyph player-glyph">{{ u.name[0] }}</div>
              <div class="unit-row__info">
                <div class="unit-row__name">{{ u.name }}
                  <span v-if="u.id === game.pendingUnitId" class="tag-pending">行動中</span>
                </div>
                <div class="unit-row__bars">
                  <div class="bar-wrap" style="flex:1"><div class="bar-fill bar-hp" :style="{width: pct(u.currentHP,u.maxHP)+'%'}" /></div>
                  <span class="bar-num">{{ u.currentHP }}/{{ u.maxHP }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 怪物陣列 -->
          <div class="room-section">
            <div class="section-title">敵方單位（{{ game.monsterUnits.length }}）</div>
            <div v-if="game.monsterUnits.length === 0" class="hint-text">所有敵人已清除！</div>
            <div v-for="u in game.monsterUnits" :key="u.id" class="unit-row unit-row--monster"
                 @click="game.selectUnit(u.id); showRoomStatus = false">
              <div class="unit-row__glyph monster-glyph">{{ u.name[0] }}</div>
              <div class="unit-row__info">
                <div class="unit-row__name">{{ u.name }}
                  <span v-if="u.id === game.pendingUnitId" class="tag-pending tag-pending--enemy">行動中</span>
                </div>
                <div class="unit-row__bars">
                  <div class="bar-wrap" style="flex:1"><div class="bar-fill bar-hp" :style="{width: pct(u.currentHP,u.maxHP)+'%'}" /></div>
                  <span class="bar-num">{{ u.currentHP }}/{{ u.maxHP }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 樓層資訊 -->
          <div class="room-section floor-info">
            <span>🗺️ 第 {{ game.gameState?.run.floorNumber }} 層</span>
            <span>{{ game.gameState?.floor.theme === 'forest' ? '🌲 森林' : '🏚️ 遺跡' }}</span>
            <span>{{ game.gameState?.floor.pathType === 'safe' ? '平穩路線' : '試煉路線' }}</span>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ── 單位詳細屬性彈窗 ─────────────────────────────────────────────── -->
    <UnitStatsModal
      v-if="statsModalUnit"
      :unit="statsModalUnit"
      @close="statsModalUnit = null"
    />

    <!-- ── 背包武器詳情彈窗 ────────────────────────────────────────────── -->
    <WeaponDetailModal
      v-if="inventoryWeapon"
      :weapon="inventoryWeapon"
      :unit="game.playerUnits[0] ?? null"
      @close="inventoryWeapon = null"
    />

    <!-- ── ATB 時間軸追蹤器（左下角）────────────────────────────────────── -->
    <ATBTracker v-if="game.gameState" />

    <!-- ── ActionMenu 彈窗 ──────────────────────────────────────────────── -->
    <ActionMenu
      v-if="showActionMenu && game.pendingUnit"
      :unit="game.pendingUnit"
      @action="onAction"
      @close="closeActionMenu"
    />

    <!-- ── 手機底部抽屜 ─────────────────────────────────────────────────── -->
    <div class="mobile-drawer" :class="{ 'mobile-drawer--open': mobileDrawerOpen }">
      <button class="mobile-drawer__handle" @click="mobileDrawerOpen = !mobileDrawerOpen">
        <span>{{ mobileDrawerOpen ? '▼ 收起' : '▲ 詳情' }}</span>
        <span v-if="game.isPlayerTurn" class="drawer-turn-dot" />
      </button>
      <div class="mobile-drawer__body">
        <div class="mobile-actions" v-if="game.isPlayerTurn && game.pendingUnit">
          <button class="btn btn--primary" @click="openActionMenu">⚔️ 行動</button>
          <button class="btn" @click="onEndTurn">⏭ 結束</button>
          <button class="btn" @click="showRoomStatus = true">💡 狀態</button>
        </div>
        <div class="divider" v-if="game.isPlayerTurn" />
        <UnitDetailPanel v-if="selectedUnit" :unit="selectedUnit" />
        <div v-else class="hint-text">點擊單位查看詳情</div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useGameStore } from '@/stores/game'
import type { Action } from '@engine/actions'
import type { Pos, Unit, FloorObjective } from '@engine/state'
import { canMove, canUseWeapon, getHitCells, getActionRange, chebyshev, hasLineOfSight, isRangedAction } from '@engine/guards'
import BoardGrid from './BoardGrid.vue'
import ActionMenu from './ActionMenu.vue'
import CellInfoPanel from './CellInfoPanel.vue'
import UnitDetailPanel from './UnitDetailPanel.vue'
import UnitStatsModal from './UnitStatsModal.vue'
import WeaponDetailModal from './WeaponDetailModal.vue'
import ATBTracker from './ATBTracker.vue'

const emit = defineEmits<{ (e: 'action', action: Action): void }>()
const game = useGameStore()

const navCollapsed   = ref(false)
const rightCollapsed = ref(false)
const showRoomStatus = ref(false)
const showActionMenu = ref(false)
const showInventory  = ref(false)
const mobileDrawerOpen = ref(false)
const actionMode = ref<'none' | 'move' | 'attack'>('none')
const selectedWeaponSlot = ref(0)
const statsModalUnit = ref<import('@engine/state').Unit | null>(null)
const inventoryWeapon = ref<import('@engine/state').ResolvedWeapon | null>(null)

// ── 選中單位 ────────────────────────────────────────────────────────────────
const selectedUnit = computed((): Unit | null => {
  const id = game.selectedUnitId
  return id ? (game.gameState?.units[id] ?? null) : null
})

// ── 任務目標 ─────────────────────────────────────────────────────────────────
const objectiveIcon = computed(() => {
  const obj = game.gameState?.floor.objective as FloorObjective | undefined
  if (!obj) return '❓'
  switch (obj.type) {
    case 'clear_all':     return '⚔️'
    case 'reach_exit':    return '🚪'
    case 'kill_boss':     return '💀'
    case 'kill_targets':  return '🎯'
    case 'survive':       return '⏱️'
    default:              return '❓'
  }
})

const objectiveText = computed(() => {
  const obj = game.gameState?.floor.objective as FloorObjective | undefined
  if (!obj) return '—'
  const alive = game.monsterUnits.length
  switch (obj.type) {
    case 'clear_all':    return `消滅所有敵人（剩餘 ${alive}）`
    case 'reach_exit': {
      const pos = (obj as any).exitPos
      return pos ? `到達出口 🪜 (${pos.x}, ${pos.y})` : '到達出口 🪜'
    }
    case 'kill_boss':    return '擊殺 Boss'
    case 'kill_targets': return `消滅指定目標（剩餘 ${alive}）`
    case 'survive':      return `生存至指定時間`
    default:             return '—'
  }
})

// ── 百分比工具 ────────────────────────────────────────────────────────────────
function pct(cur: number, max: number) {
  return max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0
}

// ── 棋盤互動 ─────────────────────────────────────────────────────────────────
function onUnitClick(unitId: string) {
  if (!game.gameState) return
  const unit = game.gameState.units[unitId]
  if (!unit) return

  if (actionMode.value === 'attack') {
    const attacker = game.pendingUnit
    if (attacker && unit.kind === 'monster') {
      tryAttack(attacker.id, unit.pos)
      actionMode.value = 'none'
      game.clearHighlights()
      return
    }
  }

  game.selectUnit(unitId)
  if (unit.kind === 'player' && unit.id === game.pendingUnitId) openActionMenu()
}

function onCellClick(pos: Pos) {
  if (!game.gameState) return

  if (actionMode.value === 'move') {
    const unitId = game.pendingUnitId
    if (unitId && canMove(game.gameState, unitId, pos).ok) {
      emit('action', { type: 'MOVE', unitId, to: pos })
    }
    actionMode.value = 'none'
    game.clearHighlights()
    return
  }

  if (actionMode.value === 'attack') {
    const unitId = game.pendingUnitId
    if (unitId) tryAttack(unitId, pos)
    actionMode.value = 'none'
    game.clearHighlights()
    return
  }
}

function tryAttack(unitId: string, targetPos: Pos) {
  if (!game.gameState) return
  const slot = selectedWeaponSlot.value
  if (canUseWeapon(game.gameState, unitId, slot, targetPos).ok) {
    emit('action', { type: 'QUEUE_WEAPON', unitId, weaponSlot: slot, targetPos })
  }
}

// ── ActionMenu ────────────────────────────────────────────────────────────────
function openActionMenu()  { showActionMenu.value = true }
function closeActionMenu() {
  showActionMenu.value = false
  actionMode.value = 'none'
  game.clearHighlights()
}

function onAction(type: 'move' | 'attack' | 'endTurn' | 'convertSpToMp', weaponSlot = 0) {
  closeActionMenu()
  const unitId = game.pendingUnitId
  if (!unitId || !game.gameState) return
  if (type === 'endTurn') { emit('action', { type: 'END_TURN', unitId }); return }
  if (type === 'convertSpToMp') { emit('action', { type: 'CONVERT_SP_TO_MP', unitId }); return }

  const unit = game.gameState.units[unitId]
  if (!unit) return

  if (type === 'move') {
    actionMode.value = 'move'
    game.setHighlights(getReachableCells(unit).map(p => ({ pos: p, kind: 'move' as const })))
  }
  if (type === 'attack') {
    selectedWeaponSlot.value = weaponSlot
    actionMode.value = 'attack'
    game.setHighlights(getAttackTargetCells(unit, weaponSlot).map(p => ({ pos: p, kind: 'attack' as const })))
  }
}

function onEndTurn() {
  const unitId = game.pendingUnitId
  if (unitId) emit('action', { type: 'END_TURN', unitId })
}

// ── 範圍計算 ──────────────────────────────────────────────────────────────────
function getReachableCells(unit: Unit): Pos[] {
  if (!game.gameState) return []
  const { floor } = game.gameState
  const cells: Pos[] = []
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      if (!floor.cells[y][x].passable) continue
      const dist = Math.abs(x - unit.pos.x) + Math.abs(y - unit.pos.y)
      if (dist > 0 && dist <= unit.moveRange) cells.push({ x, y })
    }
  }
  return cells
}

function calcFacingLocal(from: Pos, to: Pos): 'up' | 'down' | 'left' | 'right' {
  const dx = to.x - from.x, dy = to.y - from.y
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left'
  return dy >= 0 ? 'down' : 'up'
}

function getAttackTargetCells(unit: Unit, weaponSlot = 0): Pos[] {
  const weapon = unit.weapons?.[weaponSlot]
  if (!weapon || !game.gameState) return []
  const range = getActionRange(weapon.actionId)
  const ranged = isRangedAction(weapon.actionId)
  const gs = game.gameState
  const { floor } = gs
  const cells: Pos[] = []
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      if (chebyshev(unit.pos, { x, y }) > range) continue
      if (x === unit.pos.x && y === unit.pos.y) continue
      if (ranged && !hasLineOfSight(gs, unit.pos, { x, y })) continue
      cells.push({ x, y })
    }
  }
  return cells
}

// 動態攻擊預覽：懸停時顯示實際命中格
watch(() => game.hoveredPos, (hovered) => {
  if (actionMode.value !== 'attack' || !hovered || !game.pendingUnit || !game.gameState) return
  const unit = game.pendingUnit
  const slot = selectedWeaponSlot.value
  const weapon = unit.weapons?.[slot]
  if (!weapon) return

  const range = getActionRange(weapon.actionId)
  if (chebyshev(unit.pos, hovered) > range || (hovered.x === unit.pos.x && hovered.y === unit.pos.y)) {
    game.setHighlights(getAttackTargetCells(unit, slot).map(p => ({ pos: p, kind: 'attack' as const })))
    return
  }
  const facing = calcFacingLocal(unit.pos, hovered)
  const hitCells = getHitCells(weapon.actionId, unit.pos, hovered, facing)
  game.setHighlights([
    ...getAttackTargetCells(unit, slot).map(p => ({ pos: p, kind: 'attack' as const })),
    ...hitCells.map(p => ({ pos: p, kind: 'select' as const })),
  ])
})
</script>

<style scoped>
/* ── 根佈局（全螢幕 flex）─────────────────────────────────────────────────── */
.combat-root {
  display: flex;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: var(--bg);
  position: relative;
}

/* ═══════════════════════ 左側導航欄 ═══════════════════════ */
.left-nav {
  flex-shrink: 0;
  width: 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
  gap: 4px;
  background: var(--bg-panel);
  border-right: 1px solid var(--border);
  transition: width .2s;
  z-index: 40;
  overflow: hidden;
}
.left-nav--collapsed { width: 28px; }

.nav-collapse-btn {
  width: 22px; height: 22px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-dim);
  font-size: 9px;
  cursor: pointer;
  display: grid; place-items: center;
  flex-shrink: 0;
  margin-bottom: 4px;
}
.nav-collapse-btn:hover { background: var(--accent-bg); color: var(--accent); }

.nav-items {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 100%;
}

.nav-btn {
  position: relative;
  width: 44px; height: 44px;
  border-radius: 8px;
  border: 1px solid var(--border-light);
  background: var(--bg-card);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  transition: background .12s, border-color .12s;
  overflow: hidden;
}
.nav-btn:hover:not(:disabled) { background: var(--accent-bg); border-color: var(--accent-light); }
.nav-btn:disabled { opacity: .35; cursor: default; }
.nav-btn--active { background: var(--accent-bg); border-color: var(--accent); }
.nav-btn--pulse  { border-color: var(--accent-light); animation: nav-pulse 1.4s ease-in-out infinite; }

.nav-icon  { font-size: 18px; line-height: 1; }
.nav-label {
  font-size: 9px;
  color: var(--text-dim);
  white-space: nowrap;
  overflow: hidden;
  max-width: 40px;
  text-overflow: ellipsis;
  /* 收合時隱藏 */
}
.left-nav--collapsed .nav-btn { width: 22px; height: 22px; border-radius: 4px; }
.left-nav--collapsed .nav-icon { font-size: 12px; }
.left-nav--collapsed .nav-label { display: none; }

@keyframes nav-pulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(196,146,76,.5); }
  50%      { box-shadow: 0 0 0 4px rgba(196,146,76,.0); }
}

/* ═══════════════════════ 棋盤中央區 ═══════════════════════ */
.board-area {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: auto;
  position: relative;
  padding: 12px;
}

.board-center {
  /* 讓棋盤在中央，不過度拉伸 */
  display: inline-block;
}

/* 回合徽章 */
.turn-badge {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 16px;
  border-radius: 20px;
  background: var(--cell-player);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  pointer-events: none;
  white-space: nowrap;
  z-index: 20;
  box-shadow: 0 2px 8px rgba(0,0,0,.15);
}
.turn-badge--enemy { background: var(--cell-monster); }

/* ═══════════════════════ 右側詳情面板 ═══════════════════════ */
.right-panel {
  flex-shrink: 0;
  width: 220px;
  display: flex;
  flex-direction: column;
  background: var(--bg-panel);
  border-left: 1px solid var(--border);
  transition: width .2s;
  overflow: hidden;
}
.right-panel--collapsed { width: 28px; }

.right-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
  min-height: 32px;
}
.right-panel__title { font-size: 12px; font-weight: 600; color: var(--text-dim); }
.right-collapse-btn {
  width: 20px; height: 20px;
  border-radius: 4px;
  border: 1px solid var(--border-light);
  background: transparent;
  color: var(--text-dim);
  font-size: 9px;
  cursor: pointer;
  display: grid; place-items: center;
  flex-shrink: 0;
}
.right-collapse-btn:hover { background: var(--accent-bg); color: var(--accent); }

.right-panel__body {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.panel-section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.panel-section-title {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: .05em;
  padding: 2px 0 4px;
}
.panel-info-btn {
  background: transparent; border: none; cursor: pointer;
  font-size: 12px; line-height: 1; padding: 1px 3px;
  border-radius: 3px; opacity: .7;
}
.panel-info-btn:hover { opacity: 1; background: var(--accent-bg); }
.player-info-btn {
  background: transparent; border: none; cursor: pointer;
  font-size: 11px; line-height: 1; padding: 0 2px;
  border-radius: 3px; opacity: .6; margin-left: auto;
}
.player-info-btn:hover { opacity: 1; background: var(--accent-bg); }

/* 玩家卡片 */
.player-card {
  cursor: pointer;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 6px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.player-card:hover { background: var(--accent-bg); }
.player-card--selected { outline: 1px solid var(--accent); }
.player-card__header { display: flex; justify-content: space-between; align-items: center; }
.player-card__name   { font-weight: 600; font-size: 13px; color: var(--text); }
.player-card__job    { font-size: 10px;  color: var(--text-dim); }

.mini-bar-row   { display: flex; align-items: center; gap: 4px; font-size: 10px; }
.mini-bar-label { color: var(--text-dim); min-width: 18px; }
.mini-bar-val   { color: var(--text-dim); min-width: 24px; text-align: right; }
.flex1          { flex: 1; }

.divider { height: 1px; background: var(--border-light); }
.hint-text { font-size: 11px; color: var(--text-dim); text-align: center; padding: 8px 0; }

/* ═══════════════════════ 房間狀態 Overlay ═══════════════════ */
.room-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: var(--bg-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.room-panel {
  width: 100%;
  max-width: 420px;
  max-height: 80vh;
  overflow-y: auto;
  background: var(--bg-card);
  padding: 0;
  display: flex;
  flex-direction: column;
}
.room-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-light);
  font-weight: 700;
  font-size: 14px;
  color: var(--accent);
  flex-shrink: 0;
}
.close-btn {
  background: transparent; border: none;
  color: var(--text-dim); cursor: pointer;
  font-size: 14px; padding: 2px 6px;
  border-radius: 4px;
}
.close-btn:hover { background: var(--accent-bg); color: var(--text); }

.room-section {
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-light);
}
.room-section:last-child { border-bottom: none; }

.objective-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  font-size: 13px;
  color: var(--text);
}
.objective-icon { font-size: 16px; }
.objective-text { flex: 1; }

/* 單位行列 */
.unit-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 4px;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 4px;
}
.unit-row:hover { background: var(--accent-bg); }

.unit-row__glyph {
  width: 30px; height: 30px;
  border-radius: 4px;
  display: grid; place-items: center;
  font-size: 13px; font-weight: 700;
  flex-shrink: 0;
}
.player-glyph  { background: rgba(26,95,160,.12); border: 1px solid var(--cell-player); color: var(--cell-player); }
.monster-glyph { background: rgba(139,32,32,.12); border: 1px solid var(--cell-monster); color: var(--cell-monster); }

.unit-row__info { flex: 1; min-width: 0; }
.unit-row__name {
  font-size: 12px; font-weight: 600; color: var(--text);
  display: flex; align-items: center; gap: 6px; margin-bottom: 4px;
}
.unit-row__bars { display: flex; align-items: center; gap: 6px; }
.bar-num { font-size: 10px; color: var(--text-dim); min-width: 52px; text-align: right; }

.tag-pending {
  font-size: 9px; font-weight: 600; padding: 1px 5px;
  border-radius: 3px; background: var(--cell-player); color: #fff;
}
.tag-pending--enemy { background: var(--cell-monster); }

/* 樓層資訊行 */
.floor-info {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-dim);
  flex-wrap: wrap;
}

/* 房間面板 Transition */
.room-panel-enter-active, .room-panel-leave-active { transition: opacity .2s, transform .2s; }
.room-panel-enter-from, .room-panel-leave-to { opacity: 0; transform: scale(.96); }

/* ═══════════════════════ 背包展開面板 ════════════════════════ */
.inventory-panel {
  width: 100%;
  padding: 6px 4px 8px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  border-top: 1px solid var(--border-light);
  overflow-y: auto;
  max-height: calc(100vh - 260px);
}
.inventory-title {
  font-size: 10px;
  font-weight: 700;
  color: var(--accent);
  padding: 2px 0 4px;
  text-align: center;
  letter-spacing: .03em;
}
.inv-unit-name {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-dim);
  padding: 2px 2px 0;
}
.inv-section-label {
  font-size: 9px;
  color: var(--text-dim);
  padding: 1px 2px;
  opacity: .7;
}
.inv-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 4px;
  border-radius: 4px;
  border: 1px solid var(--border-light);
  background: var(--bg-card);
  font-size: 10px;
  cursor: pointer;
}
.inv-item:hover { background: var(--accent-bg); border-color: var(--accent-light); }
.inv-item--empty { cursor: default; opacity: .4; }
.inv-item--empty:hover { background: var(--bg-card); border-color: var(--border-light); }
.inv-item-slot { color: var(--text-dim); min-width: 14px; font-size: 9px; }
.inv-item-name { flex: 1; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px; }
.inv-item-atk  { color: var(--accent); font-weight: 700; font-size: 10px; }
.inv-item-empty { color: var(--text-dim); font-size: 9px; }

.inventory-enter-active, .inventory-leave-active { transition: opacity .15s, max-height .2s; }
.inventory-enter-from, .inventory-leave-to { opacity: 0; max-height: 0; }

/* ═══════════════════════ 手機底部抽屜 ════════════════════════ */
.mobile-drawer {
  display: none;
  position: fixed;
  bottom: 0; left: 0; right: 0;
  z-index: 50;
  background: var(--bg-panel);
  border-top: 1px solid var(--border);
  border-radius: 12px 12px 0 0;
  max-height: 80vh;
  overflow: hidden;
}
.mobile-drawer__handle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 8px;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--border-light);
  color: var(--text-dim);
  font-size: 12px;
  cursor: pointer;
}
.drawer-turn-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--accent-light);
  animation: nav-pulse 1.4s infinite;
}
.mobile-drawer__body {
  display: none;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  overflow-y: auto;
  max-height: calc(80vh - 36px);
}
.mobile-drawer--open .mobile-drawer__body { display: flex; }

.mobile-actions { display: flex; gap: 8px; }
.mobile-actions .btn { flex: 1; font-size: 12px; }

/* ═══════════════════════ 響應式 ════════════════════════════ */
@media (max-width: 767px) {
  /* 手機：隱藏桌機右側面板，顯示底部抽屜 */
  .right-panel { display: none; }
  .mobile-drawer { display: block; }
  /* 左側導航收合 */
  .left-nav { width: 28px; }
  .left-nav .nav-label { display: none; }
  .left-nav .nav-btn { width: 22px; height: 22px; }
  .left-nav .nav-icon { font-size: 12px; }
  /* 棋盤可完整捲動 */
  .board-area { padding: 6px; padding-bottom: 52px; align-items: flex-start; justify-content: flex-start; }
}

@media (min-width: 768px) {
  .mobile-drawer { display: none; }
}
</style>

<template>
  <div class="sim-wrapper">
    <!-- Toolbar -->
    <div class="sim-toolbar">
      <h2 class="sim-title">ATB 戰鬥模擬</h2>
      <div class="sim-toolbar__right">
        <span :class="['phase-badge', phaseClass]">{{ phaseLabel }}</span>
        <label class="toggle-label">
          <input v-model="showCoords" type="checkbox" />座標
        </label>
        <button class="btn-sim" @click="resetBattle">重置</button>
      </div>
    </div>

    <div class="sim-scene">
      <!-- Left Panel: 玩家隊 + 操作 -->
      <div class="sim-panel sim-panel--left">
        <div class="info-card">
          <h3 class="info-card__name team-label--player">玩家隊</h3>
          <div
            v-for="row in unitStatusRows.filter(r => r.team === 'player')"
            :key="row.id"
            class="unit-row"
            :class="{ 'unit-row--dead': row.isDead, 'unit-row--active': pendingUnitId === row.id, 'unit-row--selected': selectedUnitId === row.id && pendingUnitId !== row.id }"
          >
            <div class="unit-row__header">
              <span class="unit-row__name">{{ row.name }}</span>
              <span :class="['unit-row__status', `status--${row.statusKind}`]">{{ row.statusLabel }}</span>
            </div>
            <div class="dual-bars">
              <div class="bar-track"><div class="bar-fill bar-fill--hp-p" :style="`width:${Math.max(0, row.hp / row.maxHp * 100)}%`" /></div>
              <span class="bar-num">{{ row.hp }}/{{ row.maxHp }}</span>
            </div>
            <div class="dual-bars">
              <div class="bar-track">
                <div :class="['bar-fill', row.statusKind === 'windup' ? 'bar-fill--windup' : 'bar-fill--atb-p']" :style="`width:${row.barPct}%`" />
              </div>
              <span class="bar-num">{{ row.barLabel }}</span>
            </div>
          </div>
        </div>

        <!-- 操作區 -->
        <div class="info-card">
          <h3 class="info-card__name">{{ turnLabel }}</h3>
          <template v-if="isPlayerTurn">
            <div class="action-buttons">
              <button class="btn-sim" :class="actionMode === 'move' && moveStep === 'select_target' ? 'btn-sim--active' : ''" :disabled="moveStep === 'attack_windup' || turnMoved" @click="beginMoveMode">MOVE</button>
              <button class="btn-sim" :class="actionMode === 'combo' ? 'btn-sim--active' : ''" :disabled="moveStep === 'attack_windup' || turnMoved" @click="beginComboMode">COMBO</button>
              <button class="btn-sim" :class="actionMode === 'attack' ? 'btn-sim--active' : ''" :disabled="moveStep === 'attack_windup'" @click="beginAttackMode">ATTACK</button>
              <button class="btn-sim" :disabled="moveStep === 'attack_windup'" @click="beginWaitMode">待機</button>
            </div>
            <div class="stat-row"><span>步驟</span><strong>{{ moveStepLabel }}</strong></div>
            <div v-if="turnMoved" class="stat-row"><span>已移動</span><strong>可攻擊或 PASS</strong></div>
            <div v-if="moveStep === 'attack_windup' && pendingAttack" class="stat-row">
              <span>讀條</span><strong>{{ Math.round(pendingAttackRemainingMs) }} ms</strong>
            </div>
            <div v-if="attackPreviewVictims.length > 0 && moveStep === 'select_attack'" class="stat-row">
              <span>預覽命中</span><strong>{{ attackPreviewVictims.length }} 人</strong>
            </div>
            <div class="step-actions">
              <button v-if="moveStep !== 'idle'" class="btn-sim btn-sim--cancel" @click="cancelAction">取消</button>
            </div>
          </template>
          <div v-else-if="isEnemyTurn" class="enemy-thinking">敵方行動中…</div>
          <template v-else-if="enemyWindup">
            <div class="enemy-windup-alert">⚠ {{ state.units[enemyWindup.attackerId]?.name }} 發動{{ enemyWindup.attackName }}！</div>
            <div class="stat-row"><span>讀條剩餘</span><strong class="windup-countdown">{{ Math.round(enemyWindupRemainingMs) }} ms</strong></div>
            <div class="stat-row"><span>可閃避</span><strong>移動出紫色格</strong></div>
          </template>
          <div v-else class="empty-text">ATB 推進中</div>
        </div>
      </div>

      <!-- SVG Grid -->
      <svg :width="svgWidth" :height="svgHeight" class="battle-svg">
        <!-- Cells -->
        <g v-for="cell in cells" :key="cell.key" class="hex-cell-group">
          <polygon
            :points="HEX_PTS"
            :transform="`translate(${cell.px + PAD}, ${cell.py + PAD})`"
            :class="['hex-cell', cellStateClass(cell)]"
            @mouseenter="handleCellHover(cell)"
            @click="handleCellClick(cell)"
          />
          <text
            v-if="showCoords"
            :x="cell.px + PAD"
            :y="cell.py + PAD + 5"
            class="hex-coord"
            text-anchor="middle"
          >{{ cell.q }},{{ cell.r }}</text>
        </g>

        <!-- Units -->
        <g
          v-for="unit in displayedUnits"
          :key="unit.id"
          :transform="`translate(${unitPx(unit).x + PAD}, ${unitPx(unit).y + PAD})`"
          class="hex-unit-group"
          @click.stop="handleUnitClick(unit)"
        >
          <circle
            v-if="selectedUnitId === unit.id"
            :r="HEX_SIZE * 0.58"
            class="unit-select-ring"
          />
          <polygon
            :points="FACING_TRIANGLE_PTS"
            :transform="facingTransform(unit)"
            :class="['facing-indicator', unit.team === 'player' ? 'facing-indicator--player' : 'facing-indicator--enemy']"
          />
          <circle
            :r="HEX_SIZE * 0.48"
            :class="[
              'unit-circle',
              unit.team === 'player' ? 'unit-circle--player' : 'unit-circle--enemy',
              pendingUnitId === unit.id ? 'unit-circle--active' : '',
            ]"
          />
          <text
            text-anchor="middle"
            dy="1"
            :font-size="HEX_SIZE * 0.3"
            font-weight="700"
            fill="#fff"
            style="pointer-events:none;user-select:none"
          >{{ unit.name.slice(0, 1) }}</text>
        </g>

        <!-- Facing Wheel -->
        <g
          v-for="unit in facingWheelUnits"
          :key="`${unit.id}-wheel`"
          :transform="`translate(${unitPx(unit).x + PAD}, ${unitPx(unit).y + PAD})`"
        >
          <g
            v-for="dir in FACING_OPTIONS"
            :key="dir"
            :transform="facingWheelTransform(dir)"
            class="facing-wheel__node"
            @mouseenter="handleFacingWheelHover(dir)"
            @click.stop="handleFacingWheelClick(dir)"
          >
            <circle
              :r="10"
              :class="['facing-wheel__dot', attackPreviewDir === dir && 'facing-wheel__dot--active']"
            />
            <text text-anchor="middle" dy="4" class="facing-wheel__label">{{ dir }}</text>
          </g>
        </g>
      </svg>

      <!-- Right Panel: 敵方隊 + 記錄 -->
      <div class="sim-panel sim-panel--right">
        <div class="info-card">
          <h3 class="info-card__name team-label--enemy">敵方隊</h3>
          <div
            v-for="row in unitStatusRows.filter(r => r.team === 'enemy')"
            :key="row.id"
            class="unit-row"
            :class="{ 'unit-row--dead': row.isDead, 'unit-row--active': pendingUnitId === row.id, 'unit-row--selected': selectedUnitId === row.id && pendingUnitId !== row.id }"
          >
            <div class="unit-row__header">
              <span class="unit-row__name">{{ row.name }}</span>
              <span :class="['unit-row__status', `status--${row.statusKind}`]">{{ row.statusLabel }}</span>
            </div>
            <div class="dual-bars">
              <div class="bar-track"><div class="bar-fill bar-fill--hp-e" :style="`width:${Math.max(0, row.hp / row.maxHp * 100)}%`" /></div>
              <span class="bar-num">{{ row.hp }}/{{ row.maxHp }}</span>
            </div>
            <div class="dual-bars">
              <div class="bar-track">
                <div :class="['bar-fill', row.statusKind === 'windup' ? 'bar-fill--windup' : 'bar-fill--atb-e']" :style="`width:${row.barPct}%`" />
              </div>
              <span class="bar-num">{{ row.barLabel }}</span>
            </div>
          </div>
        </div>

        <!-- 選中單位資訊 -->
        <div v-if="selectedUnit" class="info-card">
          <h3 class="info-card__name">{{ selectedUnit.name }} 詳情</h3>
          <div class="stat-row"><span>HP</span><strong>{{ selectedUnit.hp }} / {{ selectedUnit.maxHp }}</strong></div>
          <div class="stat-row"><span>傷害</span><strong>{{ selectedUnit.damage }}</strong></div>
          <div class="stat-row"><span>速度</span><strong>{{ selectedUnit.speed }}</strong></div>
          <div class="stat-row"><span>移動</span><strong>{{ selectedUnit.move }}</strong></div>
          <div class="stat-row"><span>位置</span><strong>{{ selectedUnit.pos.q }},{{ selectedUnit.pos.r }}</strong></div>
        </div>

        <!-- 戰鬥記錄 -->
        <div class="info-card">
          <h3 class="info-card__name">戰鬥記錄</h3>
          <div v-if="battleLog.length === 0" class="empty-text">—</div>
          <div v-for="(line, i) in battleLog" :key="i" class="log-line">{{ line }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { BattleAction } from '../engine/actions'
import type { Event } from '../engine/events'
import type { BattleCell, CombatUnit, FacingDir, GameState, HexPos } from '../engine/state'
import { createBuildupData } from '../engine/state'
import { advanceTime, consumeATB } from '../engine/atb'
import { tickStatusEffects } from '../engine/status'
import { reduce } from '../engine/reduce'
import { applyResolvedDamage, resolveAttackDamage } from '../engine/damage'
import type { DirectedAttackArea } from '../game/schema'
import { axialToPixel, HEX_DIRECTIONS, hexDistance, hexKey, hexPoints, offsetToAxial } from '../game/hex'

// ── Types ─────────────────────────────────────────────────────────────────────

type Cell = { key: string; q: number; r: number; px: number; py: number }
type MoveStep = 'idle' | 'select_target' | 'select_facing' | 'select_attack' | 'attack_windup'
type AbilityDef = {
  id: string; name: string; unitId: string
  damage: number; windupMs: number; cooldownMs: number
  makeArea: (pos: HexPos, facing: FacingDir) => DirectedAttackArea
}
type PendingAttack = {
  attackerId: string
  attackName: string
  damage?: number        // 技能傷害覆蓋（不填用 unit.damage）
  abilityId?: string     // 設定冷卻用
  readyAtTick: number
  area: DirectedAttackArea
}
type EnemyWindup = {
  attackerId: string
  attackName: string
  area: DirectedAttackArea
  readyAtTick: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COLS = 9
const ROWS = 7

// ── Ability Definitions ───────────────────────────────────────────────────────

const ABILITIES: Record<string, AbilityDef> = {
  lang_ya_charge: {
    id: 'lang_ya_charge', name: '破甲衝刺', unitId: 'p_a',
    damage: 88, windupMs: 3800, cooldownMs: 14000,
    makeArea: (pos, facing) => {
      const vec = HEX_DIRECTIONS[facing]!
      const warningCells = [1, 2, 3, 4].map(i => ({ q: pos.q + vec.q * i, r: pos.r + vec.r * i }))
      return { kind: 'directed_attack', origin: { ...pos }, facing, pattern: 'front_arc_3', warningCells }
    },
  },
  yao_zhi_dance: {
    id: 'yao_zhi_dance', name: '幽魂漫舞', unitId: 'p_b',
    damage: 65, windupMs: 3200, cooldownMs: 11000,
    makeArea: (pos, facing) => {
      const warningCells = (HEX_DIRECTIONS as { q: number; r: number }[]).map(d => ({ q: pos.q + d.q, r: pos.r + d.r }))
      return { kind: 'directed_attack', origin: { ...pos }, facing, pattern: 'front_arc_3', warningCells }
    },
  },
}
const HEX_SIZE = 38
const PAD = 52
const HEX_PTS = hexPoints(HEX_SIZE)
const FACING_TRIANGLE_PTS = '0,-22 8,-8 -8,-8'
const FACING_OPTIONS = [0, 1, 2, 3, 4, 5] as const
const ATTACK_WINDUP_MS = 2200            // 玩家攻擊讀條（可閃避窗口）
const PLAYER_ATTACK_RECOVERY_MS = 200    // 玩家攻擊後搖
const MOVE_AUTO_PASS_RECOVERY_MS = 50    // MOVE/PASS 結束後快速硬直
const ENEMY_AI_DELAY_MS = 400            // 敵人決策延遲
const ENEMY_WINDUP_MS = 2000             // 敵人攻擊讀條（可閃避）
const ENEMY_WINDUP_MS_BOSS = 3500        // 首領讀條更長
const ENEMY_RECOVERY_MS = 200           // 敵人攻擊後搖

// ── Map / Unit Setup ──────────────────────────────────────────────────────────

function makeCells(): Record<string, BattleCell> {
  const result: Record<string, BattleCell> = {}
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const pos = offsetToAxial(col, row)
      result[hexKey(pos.q, pos.r)] = { pos, terrain: 'normal', passable: true }
    }
  }
  return result
}

function makeUnit(
  input: Partial<CombatUnit> & Pick<CombatUnit, 'id' | 'name' | 'team' | 'certId' | 'pos' | 'facing'>,
): CombatUnit {
  return {
    hp: 100, maxHp: 100, speed: 30, move: 3, damage: 28, interrupt: 1,
    isDead: false, blocksCell: true, revivePending: null,
    buildup: createBuildupData(input.certId),
    buildupResist: { burn: 0, poison: 0, paralyze: 0, sleep: 0, freeze: 0 },
    statusEffects: [],
    ...input,
  }
}

function makeBattleState(): GameState {
  const units = [
    makeUnit({ id: 'p_a', name: '狼牙', team: 'player', certId: 'cert_wolf', pos: offsetToAxial(1, 2), facing: 0, move: 3, damage: 34, speed: 34 }),
    makeUnit({ id: 'p_b', name: '妖織', team: 'player', certId: 'cert_weave', pos: offsetToAxial(1, 4), facing: 0, move: 4, damage: 24, speed: 28 }),
    makeUnit({ id: 'e_a', name: '哨兵甲', team: 'enemy', certId: 'cert_dummy', pos: offsetToAxial(7, 1), facing: 3, move: 3, damage: 24, speed: 26 }),
    makeUnit({ id: 'e_b', name: '哨兵乙', team: 'enemy', certId: 'cert_dummy', pos: offsetToAxial(7, 3), facing: 3, move: 3, damage: 24, speed: 22 }),
    makeUnit({ id: 'e_c', name: '首領', team: 'enemy', certId: 'cert_dummy', pos: offsetToAxial(7, 5), facing: 3, move: 2, damage: 42, speed: 18, hp: 200, maxHp: 200 }),
  ]
  const unitRecord: Record<string, CombatUnit> = {}
  for (const u of units) unitRecord[u.id] = u

  return {
    phase: 'running',
    timeline: {
      tick: 0,
      pendingUnitId: null,
      entries: units.map((u) => ({
        unitId: u.id,
        atb: Math.floor(Math.random() * 70),
        castRemaining: 0,
        recoveryRemaining: 0,
        speedMult: 1,
      })),
    },
    units: unitRecord,
    cells: makeCells(),
  }
}

// ── Reactive State ────────────────────────────────────────────────────────────

const showCoords = ref(false)
const state = ref<GameState>(makeBattleState())
const selectedUnitId = ref<string | null>(null)
const moveStep = ref<MoveStep>('idle')
const actionMode = ref<'move' | 'attack' | 'combo'>('move')
const pendingMoveTo = ref<HexPos | null>(null)
const pendingAttack = ref<PendingAttack | null>(null)
const enemyWindup = ref<EnemyWindup | null>(null)
const attackPreviewDir = ref<FacingDir | null>(null)
const turnMoved = ref(false)
const battleLog = ref<string[]>([])
const abilityCooldowns = ref<Record<string, number>>({})  // key: `${unitId}:${abilityId}` → readyAtTick
const activeAbility = ref<string | null>(null)

let loopId: number | null = null
let windupLoopId: number | null = null

// ── ATB Loop ──────────────────────────────────────────────────────────────────

function startLoop() {
  if (loopId !== null) return
  if (state.value.phase !== 'running') return
  if (state.value.timeline.pendingUnitId !== null) return
  loopId = window.setInterval(tick, 50)
}

function stopLoop() {
  if (loopId === null) return
  window.clearInterval(loopId)
  loopId = null
}

function tick() {
  if (state.value.phase !== 'running') { stopLoop(); return }
  const adv = advanceTime(state.value, 50)
  const statusResult = tickStatusEffects(adv.newState)
  state.value = statusResult.newState
  appendEvents([...adv.events, ...statusResult.events])
  checkBattleEnd()
  if (state.value.phase !== 'running') { stopLoop(); return }

  // 敵人讀條倒數：以 ATB tick 為基準，玩家停頓思考時不計時
  if (enemyWindup.value && state.value.timeline.tick >= enemyWindup.value.readyAtTick) {
    stopLoop()
    resolveEnemyWindup()
    return
  }

  if (state.value.timeline.pendingUnitId !== null) {
    stopLoop()
    handleTurn(state.value.timeline.pendingUnitId)
  }
}

// ── Turn Routing ──────────────────────────────────────────────────────────────

function handleTurn(unitId: string) {
  const unit = state.value.units[unitId]
  if (!unit || unit.isDead) { skipTurn(unitId); return }

  if (unit.team === 'player') {
    selectedUnitId.value = unitId
    turnMoved.value = false
    actionMode.value = 'move'
    moveStep.value = 'idle'
  } else {
    window.setTimeout(() => runEnemyAI(unitId), ENEMY_AI_DELAY_MS)
  }
}

function skipTurn(unitId: string) {
  const ns = consumeATB(state.value, unitId, 0)
  state.value = { ...ns, timeline: { ...ns.timeline, pendingUnitId: null } }
  startLoop()
}

// ── Enemy AI ──────────────────────────────────────────────────────────────────

function runEnemyAI(unitId: string) {
  const enemy = state.value.units[unitId]
  if (!enemy || enemy.isDead) { skipTurn(unitId); return }

  const players = Object.values(state.value.units).filter((u) => u.team === 'player' && !u.isDead)
  if (players.length === 0) { skipTurn(unitId); return }

  const nearest = players.reduce((a, b) =>
    hexDistance(enemy.pos, a.pos) <= hexDistance(enemy.pos, b.pos) ? a : b,
  )

  // 哨兵乙 攻擊射程 2（直線穿刺），其餘攻擊射程 1
  const attackRange = unitId === 'e_b' ? 2 : 1
  const dist = hexDistance(enemy.pos, nearest.pos)

  if (dist <= attackRange) {
    const facing = getFacingToward(enemy.pos, nearest.pos)
    startEnemyWindup(enemy, facing)
  } else {
    const target = findBestMoveCell(enemy, nearest.pos)
    if (target) {
      endTurn({
        type: 'MOVE',
        unitId,
        to: target,
        facing: getFacingToward(enemy.pos, target),
        recoveryMs: 300,
      })
    } else {
      skipTurn(unitId)
    }
  }
}

function findBestMoveCell(unit: CombatUnit, targetPos: HexPos): HexPos | null {
  const visited = new Set<string>([hexKey(unit.pos.q, unit.pos.r)])
  const reachable: HexPos[] = []
  const queue: Array<{ pos: HexPos; steps: number }> = [{ pos: unit.pos, steps: 0 }]

  while (queue.length > 0) {
    const { pos, steps } = queue.shift()!
    if (steps >= unit.move) continue
    for (const dir of HEX_DIRECTIONS) {
      const next = { q: pos.q + dir.q, r: pos.r + dir.r }
      const key = hexKey(next.q, next.r)
      if (visited.has(key)) continue
      visited.add(key)
      const cell = state.value.cells[key]
      if (!cell || !cell.passable) continue
      if (isCellOccupied(next.q, next.r, unit.id)) continue
      reachable.push(next)
      queue.push({ pos: next, steps: steps + 1 })
    }
  }

  if (reachable.length === 0) return null
  return reachable.reduce((best, cell) =>
    hexDistance(cell, targetPos) < hexDistance(best, targetPos) ? cell : best,
  )
}

function getFacingToward(from: HexPos, to: HexPos): FacingDir {
  const fromPx = axialToPixel(from.q, from.r, 1)
  const toPx = axialToPixel(to.q, to.r, 1)
  const dx = toPx.x - fromPx.x
  const dy = toPx.y - fromPx.y
  let best = 0
  let bestScore = -Infinity
  for (let i = 0; i < 6; i++) {
    const vec = HEX_DIRECTIONS[i]!
    const vPx = axialToPixel(vec.q, vec.r, 1)
    const score = dx * vPx.x + dy * vPx.y
    if (score > bestScore) { bestScore = score; best = i }
  }
  return best as FacingDir
}

// ── Player Actions ────────────────────────────────────────────────────────────

/** MOVE 不結束回合：reduce 後把 pendingUnitId 還原，讓玩家繼續 ATTACK 或 PASS */
function commitMove(action: Extract<BattleAction, { type: 'MOVE' }>) {
  const unitId = action.unitId
  const result = reduce(state.value, action)
  state.value = { ...result.newState, timeline: { ...result.newState.timeline, pendingUnitId: unitId } }
  appendEvents(result.events)
  turnMoved.value = true
}

/** ATTACK / PASS 結束回合並恢復 ATB 推進 */
function endTurn(action: BattleAction) {
  const result = reduce(state.value, action)
  state.value = { ...result.newState, timeline: { ...result.newState.timeline, pendingUnitId: null } }
  appendEvents(result.events)
  checkBattleEnd()
  selectedUnitId.value = null
  moveStep.value = 'idle'
  actionMode.value = 'move'
  turnMoved.value = false
  if (state.value.phase === 'running') startLoop()
}

function beginWaitMode() {
  if (moveStep.value === 'attack_windup' || !isPlayerTurn.value) return
  const unit = selectedPlayerUnit.value
  if (!unit) return
  // 待機：原地選朝向，不走 MOVE 引擎
  pendingMoveTo.value = { ...unit.pos }
  moveStep.value = 'select_facing'
  actionMode.value = 'move'
}

function beginMoveMode() {
  if (turnMoved.value || !isPlayerTurn.value) return
  actionMode.value = 'move'
  moveStep.value = 'select_target'
  pendingMoveTo.value = null
  attackPreviewDir.value = null
}

function beginAttackMode() {
  if (!isPlayerTurn.value) return
  actionMode.value = 'attack'
  moveStep.value = 'select_attack'
  attackPreviewDir.value = selectedPlayerUnit.value?.facing ?? null
}

function beginComboMode() {
  if (turnMoved.value || !isPlayerTurn.value) return
  actionMode.value = 'combo'
  moveStep.value = 'select_target'
  pendingMoveTo.value = null
  attackPreviewDir.value = null
}

function cancelAction() {
  clearPendingAttack()
  pendingMoveTo.value = null
  moveStep.value = 'idle'
  actionMode.value = 'move'
  attackPreviewDir.value = null
}

// ── Attack Windup ─────────────────────────────────────────────────────────────

function buildMeleeWarningCells(origin: HexPos, facing: FacingDir): HexPos[] {
  const left = ((facing + 5) % 6) as FacingDir
  const right = ((facing + 1) % 6) as FacingDir
  const dirOffset = (dir: FacingDir) => {
    const vec = HEX_DIRECTIONS[dir]!
    return { q: origin.q + vec.q, r: origin.r + vec.r }
  }
  return [dirOffset(left), dirOffset(facing), dirOffset(right)]
}

function makeAttackArea(origin: HexPos, facing: FacingDir): DirectedAttackArea {
  return {
    kind: 'directed_attack',
    origin: { ...origin },
    facing,
    pattern: 'front_arc_3',
    warningCells: buildMeleeWarningCells(origin, facing),
  }
}

function clearPendingAttack() {
  if (windupLoopId !== null) { window.clearInterval(windupLoopId); windupLoopId = null }
  pendingAttack.value = null
}

function clearEnemyWindup() {
  enemyWindup.value = null
}

/** 圓形 AOE：攻擊者周圍全部 6 格 */
function buildAoeCells(origin: HexPos): HexPos[] {
  return HEX_DIRECTIONS.map((dir) => ({ q: origin.q + dir.q, r: origin.r + dir.r }))
}

/** 直線衝刺：沿朝向延伸 length 格 */
function buildLineCells(origin: HexPos, facing: FacingDir, length: number): HexPos[] {
  const vec = HEX_DIRECTIONS[facing]!
  return Array.from({ length }, (_, i) => ({ q: origin.q + vec.q * (i + 1), r: origin.r + vec.r * (i + 1) }))
}

function makeEnemyAttackArea(enemy: CombatUnit, facing: FacingDir): DirectedAttackArea {
  if (enemy.id === 'e_c') {
    // 首領：全圍攻擊（6格 AOE）
    return { kind: 'directed_attack', origin: { ...enemy.pos }, facing, pattern: 'front_arc_3', warningCells: buildAoeCells(enemy.pos) }
  }
  if (enemy.id === 'e_b') {
    // 哨兵乙：直線穿刺（前方 3 格直線）
    return { kind: 'directed_attack', origin: { ...enemy.pos }, facing, pattern: 'front_arc_3', warningCells: buildLineCells(enemy.pos, facing, 3) }
  }
  return makeAttackArea(enemy.pos, facing)
}

function startEnemyWindup(enemy: CombatUnit, facing: FacingDir) {
  clearEnemyWindup()
  const area = makeEnemyAttackArea(enemy, facing)
  const windupMs = enemy.id === 'e_c' ? ENEMY_WINDUP_MS_BOSS : ENEMY_WINDUP_MS

  // 更新敵人朝向 + 立即推入硬直（讀條 + 後搖），ATB 循環期間玩家可行動閃避
  const withFacing: GameState = {
    ...state.value,
    units: { ...state.value.units, [enemy.id]: { ...enemy, facing } },
  }
  const consumed = consumeATB(withFacing, enemy.id, windupMs + ENEMY_RECOVERY_MS)
  state.value = { ...consumed, timeline: { ...consumed.timeline, pendingUnitId: null } }

  const attackNames: Record<string, string> = { e_a: '弧形斬', e_b: '穿刺衝刺', e_c: '全圍爆擊' }
  enemyWindup.value = { attackerId: enemy.id, attackName: attackNames[enemy.id] ?? '攻擊', area, readyAtTick: state.value.timeline.tick + windupMs }
  startLoop()  // 讀條期間 ATB 正常推進，玩家可趁機移動閃避
}

function resolveEnemyWindup() {
  const ew = enemyWindup.value
  clearEnemyWindup()
  if (!ew) return

  const attacker = state.value.units[ew.attackerId]
  if (!attacker || attacker.isDead) { if (state.value.phase === 'running') startLoop(); return }

  // 傷害結算：只打仍在警告格內的玩家單位（已閃避的不受傷）
  const victims = aliveUnits.value.filter((u) =>
    u.team === 'player' && ew.area.warningCells.some((c) => c.q === u.pos.q && c.r === u.pos.r),
  )
  if (victims.length > 0) {
    let current = state.value
    const allEvents: Event[] = []
    for (const victim of victims) {
      const target = current.units[victim.id]
      if (!target || target.isDead) continue
      const resolved = resolveAttackDamage(attacker, target, {
        baseDamage: attacker.damage, damageType: 'slash', elementType: 'none',
        attackClass: 'melee', canBackstab: false,
      })
      const dmgResult = applyResolvedDamage(current, resolved)
      current = dmgResult.newState
      allEvents.push(...dmgResult.events)
    }
    state.value = current
    appendEvents(allEvents)
  }
  checkBattleEnd()
  if (state.value.phase === 'running') {
    const pid = state.value.timeline.pendingUnitId
    if (pid !== null) { handleTurn(pid) } else { startLoop() }
  }
}

function startAttackWindup(
  attacker: CombatUnit,
  facing: FacingDir,
  opts: { attackName?: string; damage?: number; windupMs?: number; abilityId?: string; areaOverride?: DirectedAttackArea } = {},
) {
  clearPendingAttack()
  const windupMs = opts.windupMs ?? ATTACK_WINDUP_MS
  const area = opts.areaOverride ?? makeAttackArea(attacker.pos, facing)

  const withFacing: GameState = {
    ...state.value,
    units: { ...state.value.units, [attacker.id]: { ...attacker, facing } },
  }
  const consumed = consumeATB(withFacing, attacker.id, windupMs + PLAYER_ATTACK_RECOVERY_MS)
  state.value = { ...consumed, timeline: { ...consumed.timeline, pendingUnitId: null } }

  pendingAttack.value = {
    attackerId: attacker.id,
    attackName: opts.attackName ?? '近戰斬',
    damage: opts.damage,
    abilityId: opts.abilityId,
    readyAtTick: state.value.timeline.tick + windupMs,
    area,
  }
  moveStep.value = 'attack_windup'

  windupLoopId = window.setInterval(() => {
    state.value = advanceClockQuiet(state.value, 50)
    const pa = pendingAttack.value
    if (!pa) { window.clearInterval(windupLoopId!); windupLoopId = null; return }
    if (state.value.timeline.tick >= pa.readyAtTick) {
      window.clearInterval(windupLoopId!); windupLoopId = null
      resolvePendingAttack()
    }
  }, 50)
}

/**
 * 靜默推進遊戲時鐘（tick + ATB），不設 pendingUnitId。
 * 用於讀條期間讓所有單位（含處於 recoveryRemaining 的攻擊者）正常計時。
 */
function advanceClockQuiet(gs: GameState, deltaMs: number): GameState {
  const entries = gs.timeline.entries.map((entry) => {
    const unit = gs.units[entry.unitId]
    if (!unit || unit.isDead) return entry
    const ne = { ...entry }
    if (ne.recoveryRemaining > 0) {
      ne.recoveryRemaining = Math.max(0, ne.recoveryRemaining - deltaMs)
    } else {
      const isStunned = unit.statusEffects.some((s) => s.id === 'paralyze' || s.id === 'sleep')
      if (!isStunned) {
        const effectiveSpeed = unit.speed * ne.speedMult
        ne.atb = Math.min(100, ne.atb + effectiveSpeed * (deltaMs / 1000))
      }
    }
    return ne
  })
  return {
    ...gs,
    timeline: { ...gs.timeline, tick: gs.timeline.tick + deltaMs, entries },
  }
}

function resolvePendingAttack() {
  const pending = pendingAttack.value
  clearPendingAttack()
  if (!pending) return

  // 攻擊者已在 startAttackWindup 時進入 recovery，此處只做傷害結算，不再呼叫 consumeATB
  const attacker = state.value.units[pending.attackerId]
  if (!attacker || attacker.isDead) {
    selectedUnitId.value = null; moveStep.value = 'idle'; actionMode.value = 'move'; turnMoved.value = false
    if (state.value.phase === 'running') startLoop()
    return
  }

  const victims = findVictimsInArea(pending.area)
  if (victims.length > 0) {
    let current = state.value
    const allEvents: Event[] = []
    for (const victim of victims) {
      const target = current.units[victim.id]
      if (!target || target.isDead) continue
      const resolved = resolveAttackDamage(attacker, target, {
        baseDamage: pending.damage ?? attacker.damage, damageType: 'slash', elementType: 'none',
        attackClass: 'melee', canBackstab: true,
      })
      const dmgResult = applyResolvedDamage(current, resolved)
      current = dmgResult.newState
      allEvents.push(...dmgResult.events)
    }
    state.value = current
    appendEvents(allEvents)
  }

  // 技能冷卻
  if (pending.abilityId) {
    const ab = ABILITIES[pending.abilityId]
    if (ab) abilityCooldowns.value = { ...abilityCooldowns.value, [`${attacker.id}:${ab.id}`]: state.value.timeline.tick + ab.cooldownMs }
  }

  checkBattleEnd()
  selectedUnitId.value = null; moveStep.value = 'idle'; actionMode.value = 'move'; turnMoved.value = false
  if (state.value.phase === 'running') {
    const pid = state.value.timeline.pendingUnitId
    if (pid !== null) { handleTurn(pid) } else { startLoop() }
  }
}

// ── Cell / Unit Queries ───────────────────────────────────────────────────────

function isCellOccupied(q: number, r: number, excludeId?: string): boolean {
  return aliveUnits.value.some((u) => u.id !== excludeId && u.pos.q === q && u.pos.r === r)
}

function findVictimsInArea(area: DirectedAttackArea): CombatUnit[] {
  return aliveUnits.value.filter((u) =>
    u.team === 'enemy' &&
    area.warningCells.some((c) => c.q === u.pos.q && c.r === u.pos.r),
  )
}

function findNearestFacingDir(from: HexPos, to: HexPos): FacingDir | null {
  if (from.q === to.q && from.r === to.r) return null
  const fromPx = axialToPixel(from.q, from.r, 1)
  const toPx = axialToPixel(to.q, to.r, 1)
  const dx = toPx.x - fromPx.x
  const dy = toPx.y - fromPx.y
  let best = 0
  let bestScore = -Infinity
  for (let i = 0; i < 6; i++) {
    const vec = HEX_DIRECTIONS[i]!
    const vPx = axialToPixel(vec.q, vec.r, 1)
    const score = dx * vPx.x + dy * vPx.y
    if (score > bestScore) { bestScore = score; best = i }
  }
  return best as FacingDir
}

// ── Win Condition ─────────────────────────────────────────────────────────────

function checkBattleEnd() {
  const alive = Object.values(state.value.units).filter((u) => !u.isDead)
  if (!alive.some((u) => u.team === 'enemy')) {
    state.value = { ...state.value, phase: 'player_won' }
  } else if (!alive.some((u) => u.team === 'player')) {
    state.value = { ...state.value, phase: 'enemy_won' }
  }
}

// ── Event Log ─────────────────────────────────────────────────────────────────

function appendEvents(events: Event[]) {
  for (const e of events) {
    let line: string | null = null
    if (e.type === 'DAMAGE_DEALT') {
      const src = state.value.units[e.sourceId]?.name ?? e.sourceId
      const tgt = state.value.units[e.targetId]?.name ?? e.targetId
      line = `${src} → ${tgt} -${e.amount}${e.isBackstab ? ' ★' : ''}`
    } else if (e.type === 'UNIT_DIED') {
      line = `☠ ${state.value.units[e.unitId]?.name ?? e.unitId} 倒下`
    } else if (e.type === 'ATTACK_EVADED') {
      line = `${state.value.units[e.targetId]?.name ?? e.targetId} 閃避`
    } else if (e.type === 'DOT_TICK') {
      line = `${state.value.units[e.targetId]?.name ?? e.targetId} ${e.statusId} -${e.amount}`
    } else if (e.type === 'STATUS_TRIGGERED') {
      line = `[${e.statusId}] ${state.value.units[e.targetId]?.name ?? e.targetId}`
    }
    if (line) {
      battleLog.value.unshift(line)
      if (battleLog.value.length > 14) battleLog.value.pop()
    }
  }
}

// ── Computeds ─────────────────────────────────────────────────────────────────

const cells = computed<Cell[]>(() => {
  const result: Cell[] = []
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const { q, r } = offsetToAxial(col, row)
      const { x, y } = axialToPixel(q, r, HEX_SIZE)
      result.push({ key: hexKey(q, r), q, r, px: x, py: y })
    }
  }
  return result
})

const svgWidth = computed(() => Math.max(...cells.value.map((c) => c.px)) + PAD * 2 + HEX_SIZE * Math.sqrt(3) / 2)
const svgHeight = computed(() => Math.max(...cells.value.map((c) => c.py)) + PAD * 2 + HEX_SIZE)

const aliveUnits = computed(() => Object.values(state.value.units).filter((u) => !u.isDead))
const selectedUnit = computed(() => selectedUnitId.value ? (state.value.units[selectedUnitId.value] ?? null) : null)
const selectedPlayerUnit = computed(() => selectedUnit.value?.team === 'player' ? selectedUnit.value : null)
const pendingUnitId = computed(() => state.value.timeline.pendingUnitId)
const isPlayerTurn = computed(() => !!pendingUnitId.value && state.value.units[pendingUnitId.value]?.team === 'player')
const isEnemyTurn = computed(() => !!pendingUnitId.value && state.value.units[pendingUnitId.value]?.team === 'enemy')

const unitStatusRows = computed(() =>
  state.value.timeline.entries.map((entry) => {
    const unit = state.value.units[entry.unitId]
    if (!unit) return null

    // 判斷狀態種類
    let statusKind: 'active' | 'windup' | 'recovery' | 'dead' | 'idle' = 'idle'
    let statusLabel = '—'
    let barPct = Math.min(100, entry.atb)
    let barLabel = `${Math.floor(entry.atb)}`

    if (unit.isDead) {
      statusKind = 'dead'; statusLabel = '死亡'; barPct = 0; barLabel = '—'
    } else if (pendingUnitId.value === unit.id) {
      statusKind = 'active'
      if (unit.team === 'player') {
        const stepMap: Record<typeof moveStep.value, string> = {
          idle: '行動中', select_target: '移動中', select_facing: '選朝向',
          select_attack: '選攻擊', attack_windup: '讀條中',
        }
        statusLabel = stepMap[moveStep.value]
      } else {
        statusLabel = 'AI 思考'
      }
    } else if (pendingAttack.value?.attackerId === unit.id) {
      const ms = Math.round(pendingAttackRemainingMs.value)
      const name = pendingAttack.value.attackName
      statusKind = 'windup'; statusLabel = `${name} ${ms}ms`
      barPct = Math.max(0, (1 - ms / ATTACK_WINDUP_MS) * 100)
      barLabel = `${ms}ms`
    } else if (enemyWindup.value?.attackerId === unit.id) {
      const ms = Math.round(enemyWindupRemainingMs.value)
      const name = enemyWindup.value.attackName
      const total = unit.id === 'e_c' ? ENEMY_WINDUP_MS_BOSS : ENEMY_WINDUP_MS
      statusKind = 'windup'; statusLabel = `${name} ${ms}ms`
      barPct = Math.max(0, (1 - ms / total) * 100)
      barLabel = `${ms}ms`
    } else if (entry.recoveryRemaining > 0) {
      statusKind = 'recovery'; statusLabel = '硬直'; barPct = 0; barLabel = '—'
    }

    return { id: unit.id, name: unit.name, team: unit.team, hp: unit.hp, maxHp: unit.maxHp, isDead: unit.isDead, atb: entry.atb, statusKind, statusLabel, barPct, barLabel }
  }).filter((x): x is NonNullable<typeof x> => x !== null),
)

const reachableMoveKeys = computed(() => {
  const unit = selectedPlayerUnit.value
  if (!unit || moveStep.value !== 'select_target') return new Set<string>()
  const visited = new Set<string>([hexKey(unit.pos.q, unit.pos.r)])
  const reachable = new Set<string>()
  const queue: Array<{ q: number; r: number; steps: number }> = [{ q: unit.pos.q, r: unit.pos.r, steps: 0 }]
  while (queue.length > 0) {
    const cur = queue.shift()!
    if (cur.steps >= unit.move) continue
    for (const dir of HEX_DIRECTIONS) {
      const next = { q: cur.q + dir.q, r: cur.r + dir.r }
      const key = hexKey(next.q, next.r)
      if (visited.has(key)) continue
      visited.add(key)
      const cell = state.value.cells[key]
      if (!cell || !cell.passable) continue
      if (isCellOccupied(next.q, next.r, unit.id)) continue
      reachable.add(key)
      queue.push({ q: next.q, r: next.r, steps: cur.steps + 1 })
    }
  }
  return reachable
})

const attackWarningKeys = computed(() => {
  if (moveStep.value !== 'select_attack' && moveStep.value !== 'attack_windup') return new Set<string>()
  const area = pendingAttack.value?.area ?? (
    selectedPlayerUnit.value && attackPreviewDir.value !== null
      ? makeAttackArea(selectedPlayerUnit.value.pos, attackPreviewDir.value)
      : null
  )
  if (!area) return new Set<string>()
  return new Set(area.warningCells.map((c) => hexKey(c.q, c.r)))
})

const enemyWarningKeys = computed(() => {
  if (!enemyWindup.value) return new Set<string>()
  return new Set(enemyWindup.value.area.warningCells.map((c) => hexKey(c.q, c.r)))
})

const enemyWindupRemainingMs = computed(() =>
  enemyWindup.value ? Math.max(0, enemyWindup.value.readyAtTick - state.value.timeline.tick) : 0,
)

const attackPreviewVictims = computed(() => {
  if (moveStep.value !== 'select_attack' || attackPreviewDir.value === null || !selectedPlayerUnit.value) return []
  const area = makeAttackArea(selectedPlayerUnit.value.pos, attackPreviewDir.value)
  return findVictimsInArea(area)
})

const displayedUnits = computed(() =>
  aliveUnits.value.map((unit) => {
    if (moveStep.value === 'select_facing' && pendingMoveTo.value && selectedPlayerUnit.value?.id === unit.id) {
      return { ...unit, pos: { ...pendingMoveTo.value } }
    }
    if (moveStep.value === 'select_attack' && attackPreviewDir.value !== null && selectedPlayerUnit.value?.id === unit.id) {
      return { ...unit, facing: attackPreviewDir.value }
    }
    return unit
  }),
)

const facingWheelUnits = computed(() => {
  const unit = selectedPlayerUnit.value
  if (!unit) return []
  if (moveStep.value === 'select_facing' && pendingMoveTo.value) return [{ ...unit, pos: { ...pendingMoveTo.value } }]
  if (moveStep.value === 'select_attack') return [{ ...unit }]
  return []
})

const pendingAttackRemainingMs = computed(() =>
  pendingAttack.value ? Math.max(0, pendingAttack.value.readyAtTick - state.value.timeline.tick) : 0,
)

const moveStepLabel = computed((): string => {
  const m: Record<MoveStep, string> = {
    idle: '待命',
    select_target: '選擇移動格',
    select_facing: '選擇朝向',
    select_attack: '選擇攻擊方向',
    attack_windup: '讀條中…',
  }
  return m[moveStep.value]
})

const turnLabel = computed(() => {
  const id = pendingUnitId.value
  if (!id) return '推進中'
  const unit = state.value.units[id]
  return unit ? `${unit.name}（${unit.team === 'player' ? '玩家' : '敵方'}）的回合` : '—'
})

const phaseLabel = computed(() => {
  if (state.value.phase === 'player_won') return '玩家勝利！'
  if (state.value.phase === 'enemy_won') return '敵方勝利'
  if (isPlayerTurn.value) return '玩家回合'
  if (isEnemyTurn.value) return '敵方行動'
  if (enemyWindup.value) return '⚠ 敵方讀條'
  return 'ATB 推進中'
})

const phaseClass = computed(() => {
  if (state.value.phase === 'player_won') return 'phase-win'
  if (state.value.phase === 'enemy_won') return 'phase-lose'
  if (isPlayerTurn.value) return 'phase-player'
  if (isEnemyTurn.value) return 'phase-enemy'
  if (enemyWindup.value) return 'phase-enemy-windup'
  return ''
})

// ── Interaction ───────────────────────────────────────────────────────────────

function unitPx(unit: CombatUnit) { return axialToPixel(unit.pos.q, unit.pos.r, HEX_SIZE) }

function facingTransform(unit: CombatUnit): string {
  const vec = HEX_DIRECTIONS[unit.facing] ?? HEX_DIRECTIONS[0]!
  const { x, y } = axialToPixel(vec.q, vec.r, 1)
  const angle = Math.atan2(y, x) * (180 / Math.PI) + 90
  return `rotate(${angle}) translate(0,-2)`
}

function facingWheelTransform(dir: (typeof FACING_OPTIONS)[number]): string {
  const vec = HEX_DIRECTIONS[dir] ?? HEX_DIRECTIONS[0]!
  const { x, y } = axialToPixel(vec.q * 1.02, vec.r * 1.02, HEX_SIZE)
  return `translate(${x},${y})`
}

function cellStateClass(cell: Cell): string {
  const key = hexKey(cell.q, cell.r)
  if (attackWarningKeys.value.has(key)) {
    return moveStep.value === 'attack_windup' ? 'hex-cell--windup' : 'hex-cell--attack'
  }
  if (enemyWarningKeys.value.has(key)) return 'hex-cell--enemy-windup'
  if (reachableMoveKeys.value.has(key)) return 'hex-cell--move'
  if (pendingMoveTo.value?.q === cell.q && pendingMoveTo.value?.r === cell.r) return 'hex-cell--pending'
  return 'hex-cell--default'
}

function handleUnitClick(unit: CombatUnit) {
  if (moveStep.value === 'attack_windup' || !isPlayerTurn.value) return
  if (unit.team !== 'player') return
  if (unit.id !== pendingUnitId.value) return

  selectedUnitId.value = unit.id
  if (actionMode.value === 'attack') {
    moveStep.value = 'select_attack'
    attackPreviewDir.value = unit.facing
  } else if (!turnMoved.value) {
    actionMode.value = 'move'
    moveStep.value = 'select_target'
  }
}

function handleCellHover(cell: Cell) {
  if (moveStep.value !== 'select_attack' || !selectedPlayerUnit.value) return
  attackPreviewDir.value = findNearestFacingDir(selectedPlayerUnit.value.pos, { q: cell.q, r: cell.r })
}

function handleCellClick(cell: Cell) {
  if (moveStep.value === 'attack_windup' || !isPlayerTurn.value) return

  if (moveStep.value === 'select_attack') {
    const actor = selectedPlayerUnit.value
    if (!actor) return
    const dir = findNearestFacingDir(actor.pos, { q: cell.q, r: cell.r })
    if (dir === null) return
    startAttackWindup(actor, dir)
    return
  }

  if (moveStep.value === 'select_target') {
    const key = hexKey(cell.q, cell.r)
    if (!reachableMoveKeys.value.has(key)) return
    const actor = selectedPlayerUnit.value
    if (!actor) return

    if (actionMode.value === 'combo') {
      // COMBO：跳過選方向步驟，自動面向目標格，直接進入選攻擊方向
      const autoFacing = findNearestFacingDir(actor.pos, { q: cell.q, r: cell.r }) ?? actor.facing as FacingDir
      commitMove({ type: 'MOVE', unitId: actor.id, to: { q: cell.q, r: cell.r }, facing: autoFacing, recoveryMs: 8 })
      moveStep.value = 'select_attack'
      attackPreviewDir.value = autoFacing
    } else {
      pendingMoveTo.value = { q: cell.q, r: cell.r }
      moveStep.value = 'select_facing'
    }
    return
  }
}

function handleFacingWheelHover(dir: FacingDir) {
  if (moveStep.value === 'select_attack') attackPreviewDir.value = dir
}

function handleFacingWheelClick(dir: FacingDir) {
  if (moveStep.value === 'select_attack') {
    const actor = selectedPlayerUnit.value
    if (actor) startAttackWindup(actor, dir)
    return
  }
  if (moveStep.value === 'select_facing') applyFacing(dir)
}

function applyFacing(dir: FacingDir) {
  const unit = selectedPlayerUnit.value
  if (!unit || !pendingMoveTo.value) return
  const unitId = unit.id
  const isSameCell = pendingMoveTo.value.q === unit.pos.q && pendingMoveTo.value.r === unit.pos.r
  if (isSameCell) {
    // 待機：直接更新朝向，不走 MOVE 引擎（避免自己擋自己）
    state.value = { ...state.value, units: { ...state.value.units, [unitId]: { ...unit, facing: dir } } }
  } else {
    commitMove({ type: 'MOVE', unitId, to: { ...pendingMoveTo.value }, facing: dir, recoveryMs: 0 })
  }
  pendingMoveTo.value = null
  moveStep.value = 'idle'
  actionMode.value = 'move'
  endTurn({ type: 'PASS', unitId, recoveryMs: MOVE_AUTO_PASS_RECOVERY_MS })
}

// ── Reset / Lifecycle ─────────────────────────────────────────────────────────

function resetBattle() {
  clearPendingAttack()
  clearEnemyWindup()
  stopLoop()
  state.value = makeBattleState()
  selectedUnitId.value = null
  moveStep.value = 'idle'
  actionMode.value = 'move'
  turnMoved.value = false
  battleLog.value = []
  startLoop()
}

onBeforeUnmount(() => { clearPendingAttack(); clearEnemyWindup(); stopLoop() })

startLoop()
</script>

<style scoped>
.sim-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0;
  background: #f0ebe0;
  min-height: 100vh;
  color: #2a2520;
}

.sim-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #e8e2d6;
  border-bottom: 1px solid #c8bfb0;
}
.sim-title { margin: 0; font-size: 16px; color: #5a5040; }
.sim-toolbar__right { display: flex; align-items: center; gap: 10px; }

.phase-badge {
  font-size: 12px; font-weight: 700;
  padding: 3px 10px; border-radius: 4px;
  background: #d8d0c4; color: #7a7060;
}
.phase-player        { background: #c8e8d8; color: #1b5e3a; }
.phase-enemy         { background: #f0d0cc; color: #8b2020; }
.phase-enemy-windup  { background: #f0d8f8; color: #6b1a8a; }
.phase-win           { background: #f0e8a0; color: #7b5e00; }
.phase-lose          { background: #d0d4d8; color: #4a5560; }

.toggle-label { font-size: 12px; color: #8a8070; cursor: pointer; user-select: none; }
.toggle-label input { margin-right: 4px; }

.sim-scene {
  display: flex;
  flex: 1;
  gap: 0;
  overflow: hidden;
}

.battle-svg { display: block; flex-shrink: 0; }

/* Hex cells */
.hex-cell { cursor: pointer; transition: fill 0.08s; }
.hex-cell--default { fill: #d8d2c4; stroke: #b8b0a0; stroke-width: 1; }
.hex-cell--move     { fill: #c8e8d8; stroke: #40916c; stroke-width: 1.5; }
.hex-cell--attack   { fill: #f0d8b8; stroke: #d07020; stroke-width: 1.5; }
.hex-cell--windup   { fill: #f0c0c0; stroke: #c83030; stroke-width: 2; }
.hex-cell--pending      { fill: #e8e8b0; stroke: #909020; stroke-width: 1.5; }
.hex-cell--enemy-windup { fill: #e8c0f0; stroke: #8020a0; stroke-width: 2; }
.hex-coord { font-size: 9px; fill: #9a9080; pointer-events: none; }

/* Units */
.unit-circle--player { fill: #2d6a4f; stroke: #52b788; stroke-width: 1.5; }
.unit-circle--enemy  { fill: #7a2020; stroke: #c0392b; stroke-width: 1.5; }
.unit-circle--active { stroke: #d4a017; stroke-width: 3; }
.unit-select-ring    { fill: none; stroke: rgba(0,0,0,0.15); stroke-width: 2; stroke-dasharray: 4 2; }
.facing-indicator--player { fill: rgba(82, 183, 136, 0.8); }
.facing-indicator--enemy  { fill: rgba(192, 57, 43, 0.8); }

/* Facing wheel */
.facing-wheel__node { cursor: pointer; }
.facing-wheel__dot  { fill: #c8c0b4; stroke: #a09888; stroke-width: 1; }
.facing-wheel__dot:hover { fill: #b8b0a4; }
.facing-wheel__dot--active { fill: #d4a017; stroke: #b08010; }
.facing-wheel__label { font-size: 9px; fill: #7a7060; pointer-events: none; }

/* Side panels */
.sim-panel {
  flex: 0 0 190px;
  overflow-y: auto;
  background: #e8e2d6;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sim-panel--left  { border-right: 1px solid #c8bfb0; }
.sim-panel--right { border-left:  1px solid #c8bfb0; }

.info-card {
  background: #f0ebe0;
  border: 1px solid #c8bfb0;
  border-radius: 6px;
  padding: 8px 10px;
}
.info-card__name {
  font-size: 11px; font-weight: 700; color: #9a8878;
  text-transform: uppercase; letter-spacing: 0.5px;
  margin: 0 0 6px;
}

/* Unit status list */
.team-label { font-size: 10px; font-weight: 700; letter-spacing: 0.5px; padding: 4px 0 2px; }
.team-label--player { color: #2d6a4f; }
.team-label--enemy  { color: #8b2020; }

.unit-row { padding: 4px 0; border-bottom: 1px solid #ddd6c8; }
.unit-row:last-child { border-bottom: none; }
.unit-row--dead     { opacity: 0.45; }
.unit-row--active   { background: rgba(212,160,23,0.12); border-radius: 4px; padding: 4px 4px; }
.unit-row--selected { background: rgba(60,120,200,0.10); border-radius: 4px; padding: 4px 4px; border-left: 2px solid #4a80c8; }

.unit-row__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; }
.unit-row__name { font-size: 11px; font-weight: 600; color: #3a3028; }
.unit-row__status { font-size: 10px; padding: 1px 5px; border-radius: 3px; font-variant-numeric: tabular-nums; }
.status--idle     { color: #9a8878; }
.status--active   { background: #fdf0c0; color: #7a5800; }
.status--windup   { background: #f0ddf8; color: #6b1a8a; }
.status--recovery { background: #fce8d0; color: #8a4010; }
.status--dead     { background: #e0ddd8; color: #888078; }

.dual-bars { display: flex; align-items: center; gap: 4px; margin-bottom: 2px; }
.bar-track { flex: 1; height: 5px; background: #ccc4b4; border-radius: 3px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 3px; transition: width 0.08s linear; }
.bar-fill--hp-p   { background: #52b788; }
.bar-fill--hp-e   { background: #c0392b; }
.bar-fill--atb-p  { background: #95d5b2; }
.bar-fill--atb-e  { background: #e07060; }
.bar-fill--windup { background: #b060d0; }
.bar-num { font-size: 9px; color: #8a8070; font-variant-numeric: tabular-nums; min-width: 28px; text-align: right; flex-shrink: 0; }

/* Action buttons */
.action-buttons { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 6px; }
.btn-sim {
  font-size: 11px; padding: 4px 8px;
  background: #e0dbd0; border: 1px solid #b8b0a0; border-radius: 4px;
  color: #4a4038; cursor: pointer;
}
.btn-sim:hover:not(:disabled) { background: #d0cbc0; }
.btn-sim:disabled { opacity: 0.4; cursor: default; }
.btn-sim--active { background: #c8e8d8; border-color: #40916c; color: #1b5e3a; }
.btn-sim--cancel { border-color: #c04040; color: #8b2020; }
.step-actions { margin-top: 4px; }

.stat-row { display: flex; justify-content: space-between; font-size: 11px; padding: 1px 0; }
.stat-row span { color: #9a8878; }
.stat-row strong { color: #2a2520; }

.empty-text { font-size: 11px; color: #b0a898; }
.enemy-thinking { font-size: 12px; color: #8b2020; font-style: italic; }
.enemy-windup-alert {
  font-size: 12px; font-weight: 700; color: #6b1a8a;
  padding: 4px 6px; background: #f0ddf8; border: 1px solid #c080d8; border-radius: 4px;
  margin-bottom: 4px;
}
.windup-countdown { color: #8020a0; font-variant-numeric: tabular-nums; }

/* Battle log */
.log-line {
  font-size: 11px; color: #5a5040;
  padding: 2px 0;
  border-bottom: 1px solid #d8d0c4;
}
.log-line:last-child { border-bottom: none; }
</style>

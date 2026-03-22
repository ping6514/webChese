<template>
  <div class="enhanced-battle-sim">
    <!-- 頂部控制欄 -->
    <div class="sim-toolbar">
      <h2>⚔️ 隊伍戰鬥模擬（增強版）</h2>
      <div class="toolbar-controls">
        <button @click="loadTeams" class="btn-ctrl">📂 載入隊伍</button>
        <button @click="startBattle" class="btn-ctrl btn-start" :disabled="!canStart">開始戰鬥</button>
        <button @click="resetBattle" class="btn-ctrl">🔄 重置</button>
        <label class="toggle-label">
          <input v-model="showCoords" type="checkbox" />座標
        </label>
      </div>
    </div>

    <!-- 隊伍選擇（戰鬥前） -->
    <div v-if="!battleStarted" class="team-selection-panel">
      <div class="team-selector">
        <h3>👥 玩家隊伍</h3>
        <select v-model="playerSlotId" class="team-dropdown">
          <option value="">-- 選擇隊伍 --</option>
          <option v-for="slot in teamSlots" :key="slot.id" :value="slot.id">
            {{ slot.name }}
          </option>
        </select>
      </div>
      <div class="team-selector">
        <h3>👹 敵方隊伍</h3>
        <select v-model="enemySlotId" class="team-dropdown">
          <option value="">-- 選擇隊伍 --</option>
          <option v-for="slot in teamSlots" :key="slot.id" :value="slot.id">
            {{ slot.name }}
          </option>
        </select>
      </div>
    </div>

    <!-- 戰鬥場景 -->
    <div v-if="battleStarted" class="battle-layout-horizontal">
      <!-- 左側：玩家隊伍詳情 -->
      <div class="side-panel left-panel">
        <h3 class="panel-header player-header">👥 玩家隊伍</h3>
        <div v-for="unit in playerUnits" :key="unit.id" 
             :class="['unit-card', { active: currentUnitId === unit.id, dead: unit.isDead }]">
          <div class="unit-info">
            <span class="unit-name">{{ unit.name }}</span>
            <span class="unit-hp">{{ unit.hp }}/{{ unit.maxHp }}</span>
          </div>
          <div class="hp-bar-track">
            <div class="hp-bar-fill player-hp" :style="{ width: `${unit.hp / unit.maxHp * 100}%` }"></div>
          </div>
          <div class="atb-bar-track">
            <div class="atb-bar-fill player-atb" :style="{ width: `${getUnitATB(unit.id)}%` }"></div>
            <span class="atb-text">{{ Math.round(getUnitATB(unit.id)) }}%</span>
          </div>
        </div>

        <!-- 行動面板 -->
        <div v-if="isPlayerTurn" class="action-panel">
          <h4>🎯 {{ currentUnit?.name }} 的回合</h4>
          <p class="action-hint">{{ actionHint }}</p>
          
          <!-- 武器列表 -->
          <div v-if="currentWeapons.length > 0 && moveStep === 'idle'" class="weapon-grid">
            <button v-for="wpn in currentWeapons" :key="wpn.instanceId"
                    @click="selectWeapon(wpn)" class="weapon-btn">
              <span>{{ wpn.name }}</span>
              <span class="wpn-dmg">💥{{ wpn.damage }}</span>
            </button>
          </div>

          <!-- 基本行動 -->
          <div class="basic-actions">
            <button @click="beginMove" :disabled="moveStep !== 'idle'" class="action-btn">
              🏃 移動
            </button>
            <button @click="endTurnWait" :disabled="moveStep !== 'idle'" class="action-btn">
              ⏳ 待機
            </button>
            <button v-if="moveStep !== 'idle'" @click="cancelAction" class="action-btn cancel-btn">
              ❌ 取消
            </button>
          </div>
        </div>
      </div>

      <!-- 中央：戰場 -->
      <div class="center-section">
        <svg :width="svgWidth" :height="svgHeight" class="battle-svg" :viewBox="`0 0 ${svgWidth} ${svgHeight}`" preserveAspectRatio="xMidYMid meet">
          <!-- 六角格 -->
          <g v-for="cell in cells" :key="cell.key">
            <polygon
              :points="hexPts"
              :transform="`translate(${cell.px + padding}, ${cell.py + padding})`"
              :class="['hex-cell', getCellClass(cell)]"
              @click="onCellClick(cell)"
              @mouseenter="onCellHover(cell)"
            />
            <text v-if="showCoords"
                  :x="cell.px + padding" :y="cell.py + padding + 5"
                  class="coord-text" text-anchor="middle">
              {{ cell.q }},{{ cell.r }}
            </text>
          </g>

          <!-- 讀條警告文字 -->
          <g v-for="(cast, idx) in pendingCasts" :key="cast.unitId + '_' + cast.readyAtTick">
            <text :x="svgWidth / 2" :y="padding / 2 + idx * 25" 
                  class="cast-warning-text" text-anchor="middle">
              ⚠️ {{ allUnits.find(u => u.id === cast.unitId)?.name }} 讀條中... {{ ((cast.readyAtTick - gameTick) / 1000).toFixed(1) }}s
            </text>
          </g>

          <!-- 單位 -->
          <g v-for="unit in allUnits" :key="unit.id"
             :transform="`translate(${getUnitPx(unit).x + padding}, ${getUnitPx(unit).y + padding})`">
            <!-- 選中光環 -->
            <circle v-if="currentUnitId === unit.id" :r="hexSize * 0.6" class="unit-glow" />
            
            <!-- 讀條光環 -->
            <circle v-if="pendingCasts.some(c => c.unitId === unit.id)" :r="hexSize * 0.7" class="cast-glow" />
            
            <!-- 朝向三角形 -->
            <polygon :points="facingPts" :transform="getFacingTransform(unit)"
                     :class="['facing-tri', unit.team === 'player' ? 'facing-player' : 'facing-enemy']" />
            
            <!-- 單位圓圈 -->
            <circle :r="hexSize * 0.45"
                    :class="['unit-circle', unit.team === 'player' ? 'unit-player' : 'unit-enemy', 
                             { 'unit-active': currentUnitId === unit.id, 'unit-dead': unit.isDead }]"
                    @click.stop="onUnitClick(unit)" />
            
            <!-- 單位標籤 -->
            <text text-anchor="middle" dy="5" class="unit-text">
              {{ unit.name.slice(0, 2) }}
            </text>
          </g>

          <!-- 朝向選擇輪盤 -->
          <g v-if="showFacingWheel" :transform="`translate(${facingWheelPos.x + padding}, ${facingWheelPos.y + padding})`">
            <g v-for="dir in [0,1,2,3,4,5]" :key="dir"
               :transform="getFacingWheelTransform(dir)"
               @click.stop="selectFacing(dir)">
              <circle :r="12" class="facing-dot" />
              <text text-anchor="middle" dy="4" class="facing-label">{{ dir }}</text>
            </g>
          </g>
        </svg>

        <!-- ATB 時間軸 -->
        <div class="timeline-panel-horizontal">
          <h4>⏱️ ATB 時間軸</h4>
          <div class="timeline-track">
            <div v-for="entry in sortedTimeline" :key="entry.unitId"
                 class="timeline-marker" :style="{ left: `${entry.atb}%` }">
              <div :class="['marker-dot', entry.team === 'player' ? 'marker-player' : 'marker-enemy']">
                {{ entry.name.slice(0, 1) }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右側：敵方隊伍詳情 -->
      <div class="side-panel right-panel">
        <h3 class="panel-header enemy-header">👹 敵方隊伍</h3>
        <div v-for="unit in enemyUnits" :key="unit.id"
             :class="['unit-card', { active: currentUnitId === unit.id, dead: unit.isDead }]">
          <div class="unit-info">
            <span class="unit-name">{{ unit.name }}</span>
            <span class="unit-hp">{{ unit.hp }}/{{ unit.maxHp }}</span>
          </div>
          <div class="hp-bar-track">
            <div class="hp-bar-fill enemy-hp" :style="{ width: `${unit.hp / unit.maxHp * 100}%` }"></div>
          </div>
          <div class="atb-bar-track">
            <div class="atb-bar-fill enemy-atb" :style="{ width: `${getUnitATB(unit.id)}%` }"></div>
            <span class="atb-text">{{ Math.round(getUnitATB(unit.id)) }}%</span>
          </div>
        </div>

        <!-- 戰鬥日誌 -->
        <div class="battle-log-panel">
          <h4>📜 戰鬥日誌</h4>
          <div class="log-scroll">
            <div v-for="(log, i) in battleLog" :key="i" class="log-line">{{ log }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 勝負結果 -->
    <div v-if="battleResult" class="result-overlay">
      <div class="result-card">
        <h2>{{ battleResult === 'player' ? '🎉 勝利！' : '💀 失敗' }}</h2>
        <button @click="closeResult" class="btn-result">關閉</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { loadTeamSlots } from '../game/teamStorage'
import type { TeamSlot } from '../game/teamStorage'
import type { UnitBuild } from '../game/teamSystem'
import { demoBloodlines, demoWeapons } from '../game/mockData'
import { hexPoints, axialToPixel, offsetToAxial, hexKey, hexDistance, HEX_DIRECTIONS } from '../game/hex'

// 類型定義
type BattleUnit = {
  id: string
  name: string
  team: 'player' | 'enemy'
  bloodlineId: string
  hp: number
  maxHp: number
  damage: number
  speed: number
  move: number
  pos: { q: number; r: number }
  facing: number
  isDead: boolean
  weapons: Array<{ 
    instanceId: string
    weaponId: string
    name: string
    damage: number
    attackClass: string
    baseCast: number
    baseRecovery: number
  }>
  toolIds: string[]
}

type ATBEntry = {
  unitId: string
  atb: number
  recovery: number
  casting: number
}

type PendingCast = {
  unitId: string
  weaponName: string
  targetCell: { q: number; r: number }
  readyAtTick: number  // 改為使用 tick 而非 gameTime
  damage: number
  attackClass: string
}

type Cell = {
  key: string
  q: number
  r: number
  px: number
  py: number
}

type MoveStep = 'idle' | 'select_move' | 'select_facing' | 'select_attack' | 'casting'

// 常數
const hexSize = 36
const padding = 50
const hexPts = hexPoints(hexSize)
const facingPts = '0,-20 8,-8 -8,-8'

// 狀態
const teamSlots = ref<TeamSlot[]>([])
const playerSlotId = ref('')
const enemySlotId = ref('')
const battleStarted = ref(false)
const battleResult = ref<'player' | 'enemy' | null>(null)
const showCoords = ref(false)

const playerUnits = ref<BattleUnit[]>([])
const enemyUnits = ref<BattleUnit[]>([])
const timeline = ref<ATBEntry[]>([])
const currentUnitId = ref<string | null>(null)
const battleLog = ref<string[]>([])

const moveStep = ref<MoveStep>('idle')
const MOVE_RECOVERY_MS = 500  // 移動後的短硬直時間
const MOVE_CAST_MS = 200       // 移動的快速施放時間
const pendingMove = ref<{ q: number; r: number } | null>(null)
const selectedWeapon = ref<any>(null)
const hoveredCell = ref<{ q: number; r: number } | null>(null)
const pendingCasts = ref<PendingCast[]>([])
const gameTick = ref(0)  // 使用 tick 代替 gameTime

let loopInterval: number | null = null
const TICK_MS = 100  // ATB 推進間隔

// 計算屬性
const canStart = computed(() => playerSlotId.value && enemySlotId.value)
const allUnits = computed(() => [...playerUnits.value, ...enemyUnits.value])
const currentUnit = computed(() => allUnits.value.find(u => u.id === currentUnitId.value) || null)
const isPlayerTurn = computed(() => currentUnit.value?.team === 'player')

const currentWeapons = computed(() => currentUnit.value?.weapons || [])

const cells = computed<Cell[]>(() => {
  const result: Cell[] = []
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 9; col++) {
      const { q, r } = offsetToAxial(col, row)
      const { x, y } = axialToPixel(q, r, hexSize)
      result.push({ key: hexKey(q, r), q, r, px: x, py: y })
    }
  }
  return result
})

const svgWidth = computed(() => Math.max(...cells.value.map(c => c.px)) + padding * 2 + hexSize * 2)
const svgHeight = computed(() => Math.max(...cells.value.map(c => c.py)) + padding * 2 + hexSize * 2)

const reachableCells = computed(() => {
  if (!currentUnit.value || moveStep.value !== 'select_move') return new Set<string>()
  
  const unit = currentUnit.value
  const visited = new Set<string>([hexKey(unit.pos.q, unit.pos.r)])
  const reachable = new Set<string>()
  const queue: Array<{ q: number; r: number; steps: number }> = [{ ...unit.pos, steps: 0 }]
  
  while (queue.length > 0) {
    const cur = queue.shift()!
    if (cur.steps >= unit.move) continue
    
    for (const dir of HEX_DIRECTIONS) {
      const next = { q: cur.q + dir.q, r: cur.r + dir.r }
      const key = hexKey(next.q, next.r)
      if (visited.has(key)) continue
      visited.add(key)
      
      // 檢查是否被佔據
      if (allUnits.value.some(u => !u.isDead && u.id !== unit.id && u.pos.q === next.q && u.pos.r === next.r)) continue
      
      reachable.add(key)
      queue.push({ ...next, steps: cur.steps + 1 })
    }
  }
  
  return reachable
})

const attackWarningCells = computed(() => {
  // 選擇攻擊時的預覽
  if (moveStep.value === 'select_attack' && currentUnit.value && hoveredCell.value && selectedWeapon.value) {
    const unit = currentUnit.value
    const facing = getFacingToward(unit.pos, hoveredCell.value)
    if (facing !== null) {
      const attackClass = selectedWeapon.value.attackClass || 'melee'
      const rangeCells = getAttackRangeCells(unit.pos, facing, attackClass)
      return new Set(rangeCells.map(c => hexKey(c.q, c.r)))
    }
  }
  
  // 讀條期間顯示所有攻擊警告區域
  if (moveStep.value === 'casting' && pendingCasts.value.length > 0) {
    const allWarningCells = new Set<string>()
    for (const cast of pendingCasts.value) {
      const attacker = allUnits.value.find(u => u.id === cast.unitId)
      if (attacker) {
        const rangeCells = getAttackRangeCells(attacker.pos, attacker.facing, cast.attackClass)
        rangeCells.forEach(c => allWarningCells.add(hexKey(c.q, c.r)))
      }
    }
    return allWarningCells
  }
  
  return new Set<string>()
})

const sortedTimeline = computed(() => {
  return timeline.value.map(e => {
    const unit = allUnits.value.find(u => u.id === e.unitId)
    return { ...e, name: unit?.name || '', team: unit?.team || 'enemy' }
  }).sort((a, b) => b.atb - a.atb)
})

const actionHint = computed(() => {
  if (pendingCasts.value.length > 0) {
    const myCast = pendingCasts.value.find(c => c.unitId === currentUnit.value?.id)
    if (myCast) {
      const remaining = Math.max(0, myCast.readyAtTick - gameTick.value)
      return `讀條中... ${(remaining / 1000).toFixed(1)}s`
    }
  }
  if (moveStep.value === 'idle') return '選擇武器攻擊，或移動/待機'
  if (moveStep.value === 'select_move') return '點擊藍色格子移動'
  if (moveStep.value === 'select_facing') return '選擇朝向'
  if (moveStep.value === 'select_attack') return '點擊目標方向攻擊'
  return ''
})

const showFacingWheel = computed(() => moveStep.value === 'select_facing' && pendingMove.value !== null)
const facingWheelPos = computed(() => {
  if (!pendingMove.value) return { x: 0, y: 0 }
  return axialToPixel(pendingMove.value.q, pendingMove.value.r, hexSize)
})

// 方法
function loadTeams() {
  const slots = loadTeamSlots()
  teamSlots.value = slots.slots
  addLog('📂 已載入隊伍')
}

function startBattle() {
  const playerSlot = teamSlots.value.find(s => s.id === playerSlotId.value)
  const enemySlot = teamSlots.value.find(s => s.id === enemySlotId.value)
  if (!playerSlot || !enemySlot) return
  
  // 創建單位
  playerUnits.value = createUnits(playerSlot, 'player', [
    offsetToAxial(1, 2), offsetToAxial(1, 3), offsetToAxial(1, 4)
  ])
  enemyUnits.value = createUnits(enemySlot, 'enemy', [
    offsetToAxial(7, 2), offsetToAxial(7, 3), offsetToAxial(7, 4)
  ])
  
  // 初始化 ATB
  timeline.value = allUnits.value.map(u => ({
    unitId: u.id,
    atb: Math.random() * 30,
    recovery: 0,
    casting: 0
  }))
  
  battleStarted.value = true
  addLog('⚔️ 戰鬥開始！')
  startLoop()
}

function createUnits(slot: TeamSlot, team: 'player' | 'enemy', positions: Array<{ q: number; r: number }>): BattleUnit[] {
  const builds = slot.teamBuild.units.filter(u => u.bloodlineId)
  return builds.map((build, i) => {
    const bloodline = demoBloodlines.find(b => b.id === build.bloodlineId)
    const weapons = build.equippedWeapons.map(w => {
      const weaponDef = demoWeapons.find(wd => wd.id === w.weaponId)
      return {
        instanceId: w.instanceId,
        weaponId: w.weaponId,
        name: weaponDef?.name || '未知武器',
        damage: weaponDef?.baseDamage || 20,
        attackClass: weaponDef?.attackClass || 'melee',
        baseCast: weaponDef?.baseCast || 8,
        baseRecovery: weaponDef?.baseRecovery || 15
      }
    })
    
    return {
      id: `${team}_${i}`,
      name: bloodline?.name || `單位${i + 1}`,
      team,
      bloodlineId: build.bloodlineId || '',
      hp: bloodline?.baseStats.hp || 100,
      maxHp: bloodline?.baseStats.hp || 100,
      damage: bloodline?.baseStats.str || 10,
      speed: bloodline?.baseStats.agi || 10,
      move: bloodline?.baseStats.move || 3,
      pos: positions[i] || { q: 0, r: 0 },
      facing: team === 'player' ? 0 : 3,
      isDead: false,
      weapons,
      toolIds: build.equippedToolIds
    }
  })
}

function startLoop() {
  if (loopInterval) return
  // 如果有玩家正在行動，不啟動循環
  if (currentUnitId.value && isPlayerTurn.value) return
  loopInterval = window.setInterval(tick, 100)
}

function stopLoop() {
  if (loopInterval) {
    clearInterval(loopInterval)
    loopInterval = null
  }
}

function tick() {
  gameTick.value += TICK_MS
  
  // 檢查所有讀條是否有完成的
  const completedCasts = pendingCasts.value.filter(cast => gameTick.value >= cast.readyAtTick)
  if (completedCasts.length > 0) {
    for (const cast of completedCasts) {
      resolveCast(cast)
    }
  }
  
  // 推進 ATB
  timeline.value = timeline.value.map(e => {
    const unit = allUnits.value.find(u => u.id === e.unitId)
    if (!unit || unit.isDead) return e
    
    if (e.recovery > 0) {
      return { ...e, recovery: Math.max(0, e.recovery - TICK_MS) }
    }
    
    const gain = (unit.speed / 100) * 10
    return { ...e, atb: Math.min(100, e.atb + gain) }
  })
  
  // 檢查是否有單位達到 100（讀條期間仍可處理新回合）
  if (true) {
    const ready = timeline.value.find(e => e.atb >= 100 && e.recovery === 0)
    if (ready && !currentUnitId.value) {
      const unit = allUnits.value.find(u => u.id === ready.unitId)
      if (unit && !unit.isDead) {
        currentUnitId.value = unit.id
        // 重置回合狀態
        moveStep.value = 'idle'
        selectedWeapon.value = null
        pendingMove.value = null
        
        addLog(`⏰ ${unit.name} 的回合`)
        
        // 玩家回合時停止循環
        if (unit.team === 'player') {
          stopLoop()
        } else {
          // 敵方回合繼續循環但延遲執行 AI
          setTimeout(() => executeEnemyTurn(unit), 500)
        }
      }
    }
  }
  
  checkBattleEnd()
}

function executeEnemyTurn(unit: BattleUnit) {
  if (!currentUnitId.value || currentUnitId.value !== unit.id) return
  
  const targets = playerUnits.value.filter(u => !u.isDead)
  if (targets.length > 0) {
    const target = targets[0]!
    const damage = Math.floor(unit.damage * (0.8 + Math.random() * 0.4))
    target.hp = Math.max(0, target.hp - damage)
    
    if (target.hp === 0) {
      target.isDead = true
      addLog(`💀 ${target.name} 被擊倒！`)
    } else {
      addLog(`⚔️ ${unit.name} 攻擊 ${target.name}，造成 ${damage} 傷害`)
    }
  }
  
  // 敵方回合結束
  const entry = timeline.value.find(e => e.unitId === unit.id)
  if (entry) {
    entry.atb = 0
    entry.recovery = 800  // 敵方攻擊後的硬直
  }
  
  currentUnitId.value = null
  moveStep.value = 'idle'
  selectedWeapon.value = null
  pendingMove.value = null
  
  // 繼續循環
  // startLoop() 已經在運行中，不需要重新啟動
}

function beginMove() {
  moveStep.value = 'select_move'
}

function selectWeapon(weapon: any) {
  selectedWeapon.value = weapon
  moveStep.value = 'select_attack'
}

function cancelAction() {
  moveStep.value = 'idle'
  pendingMove.value = null
  selectedWeapon.value = null
}

function endTurnWait() {
  if (!currentUnitId.value) return
  
  addLog(`⏳ ${currentUnit.value?.name} 待機`)
  
  const entry = timeline.value.find(e => e.unitId === currentUnitId.value)
  if (entry) {
    entry.atb = 0
    entry.recovery = 300  // 待機的短硬直
  }
  
  currentUnitId.value = null
  moveStep.value = 'idle'
  selectedWeapon.value = null
  pendingMove.value = null
  
  // 重新啟動循環
  startLoop()
}

function onCellClick(cell: Cell) {
  if (!isPlayerTurn.value || !currentUnit.value) return
  
  if (moveStep.value === 'select_move') {
    const key = hexKey(cell.q, cell.r)
    if (!reachableCells.value.has(key)) return
    
    pendingMove.value = { q: cell.q, r: cell.r }
    moveStep.value = 'select_facing'
  } else if (moveStep.value === 'select_attack') {
    executeAttack(cell)
  }
}

function onCellHover(cell: Cell) {
  hoveredCell.value = { q: cell.q, r: cell.r }
}

function onUnitClick(unit: BattleUnit) {
  // 點擊單位邏輯
}

function selectFacing(dir: number) {
  if (!currentUnit.value || !pendingMove.value) return
  
  // 移動單位
  currentUnit.value.pos = { ...pendingMove.value }
  currentUnit.value.facing = dir
  
  addLog(`🏃 ${currentUnit.value.name} 移動到 (${pendingMove.value.q},${pendingMove.value.r})`)
  
  // 移動完成後結束回合（移動是獨立動作）
  const entry = timeline.value.find(e => e.unitId === currentUnit.value!.id)
  if (entry) {
    entry.atb = 0
    entry.recovery = MOVE_RECOVERY_MS  // 移動的短硬直
  }
  
  pendingMove.value = null
  moveStep.value = 'idle'
  currentUnitId.value = null
  selectedWeapon.value = null
  
  // 重新啟動循環
  startLoop()
}

function executeAttack(targetCell: Cell) {
  if (!currentUnit.value || !selectedWeapon.value) return
  
  const facing = getFacingToward(currentUnit.value.pos, targetCell)
  if (facing === null) return
  
  currentUnit.value.facing = facing
  
  // 計算傷害
  const baseDmg = selectedWeapon.value.damage
  const bloodline = demoBloodlines.find(b => b.id === currentUnit.value.bloodlineId)
  const stat = bloodline?.baseStats.str || 10
  const finalDmg = Math.floor(baseDmg * (1 + stat * 0.05) * (0.9 + Math.random() * 0.2))
  
  // 開始讀條（增加讀條時間讓玩家有時間閃避）
  const windupMs = selectedWeapon.value.baseCast * 400 // 增加至 4倍，讓讀條更長更明顯
  const newCast: PendingCast = {
    unitId: currentUnit.value.id,
    weaponName: selectedWeapon.value.name,
    targetCell: { q: targetCell.q, r: targetCell.r },
    readyAtTick: gameTick.value + windupMs,
    damage: finalDmg,
    attackClass: selectedWeapon.value.attackClass
  }
  pendingCasts.value.push(newCast)
  
  // 消耗 ATB 並進入恢復期
  const entry = timeline.value.find(e => e.unitId === currentUnit.value!.id)
  if (entry) {
    entry.atb = 0
    entry.recovery = selectedWeapon.value.baseRecovery * 100 + windupMs
  }
  
  moveStep.value = 'casting'
  addLog(`⏳ ${currentUnit.value.name} 準備使用 ${selectedWeapon.value.name}...`)
  
  // 不再使用獨立計時器，讓 ATB 循環處理讀條
  currentUnitId.value = null  // 釋放回合，讓其他單位可以行動
  startLoop()
}

function resolveCast(cast: PendingCast) {
  // 從陣列中移除這個讀條
  const index = pendingCasts.value.findIndex(c => c.unitId === cast.unitId && c.readyAtTick === cast.readyAtTick)
  if (index !== -1) {
    pendingCasts.value.splice(index, 1)
  }
  
  const attacker = allUnits.value.find(u => u.id === cast.unitId)
  if (!attacker || attacker.isDead) {
    return
  }
  
  // 計算攻擊範圍
  const warningCells = getAttackRangeCells(attacker.pos, attacker.facing, cast.attackClass)
  
  // 找出範圍內的敵人
  const victims = enemyUnits.value.filter(u => {
    if (u.isDead) return false
    return warningCells.some(c => c.q === u.pos.q && c.r === u.pos.r)
  })
  
  if (victims.length > 0) {
    for (const victim of victims) {
      victim.hp = Math.max(0, victim.hp - cast.damage)
      
      if (victim.hp === 0) {
        victim.isDead = true
        addLog(`💀 ${victim.name} 被擊倒！`)
      } else {
        addLog(`⚔️ ${attacker.name} 使用 ${cast.weaponName} 攻擊 ${victim.name}，造成 ${cast.damage} 傷害`)
      }
    }
  }
  
  // 攻擊完成後結束回合
  if (cast.unitId === currentUnit.value?.id) {
    currentUnitId.value = null
    moveStep.value = 'idle'
    selectedWeapon.value = null
    pendingMove.value = null
  }
}

function getAttackRangeCells(origin: { q: number; r: number }, facing: number, attackClass: string): Array<{ q: number; r: number }> {
  const cells: Array<{ q: number; r: number }> = []
  
  if (attackClass === 'melee') {
    // 近戰：前方扇形 3 格
    const left = ((facing + 5) % 6)
    const right = ((facing + 1) % 6)
    for (const dir of [left, facing, right]) {
      const vec = HEX_DIRECTIONS[dir]!
      cells.push({ q: origin.q + vec.q, r: origin.r + vec.r })
    }
  } else if (attackClass === 'projectile') {
    // 投射：直線 3 格
    const vec = HEX_DIRECTIONS[facing]!
    for (let i = 1; i <= 3; i++) {
      cells.push({ q: origin.q + vec.q * i, r: origin.r + vec.r * i })
    }
  } else if (attackClass === 'zone') {
    // 範圍：周圍 6 格
    for (const dir of HEX_DIRECTIONS) {
      cells.push({ q: origin.q + dir.q, r: origin.r + dir.r })
    }
  } else if (attackClass === 'arcane_cast') {
    // 奧術施法：前方錐形範圍（前方 + 左右兩側各 2 格）
    const vec = HEX_DIRECTIONS[facing]!
    const left = ((facing + 5) % 6)
    const right = ((facing + 1) % 6)
    const leftVec = HEX_DIRECTIONS[left]!
    const rightVec = HEX_DIRECTIONS[right]!
    
    // 正前方 2 格
    cells.push({ q: origin.q + vec.q, r: origin.r + vec.r })
    cells.push({ q: origin.q + vec.q * 2, r: origin.r + vec.r * 2 })
    // 左側 2 格
    cells.push({ q: origin.q + leftVec.q, r: origin.r + leftVec.r })
    cells.push({ q: origin.q + leftVec.q * 2, r: origin.r + leftVec.r * 2 })
    // 右側 2 格
    cells.push({ q: origin.q + rightVec.q, r: origin.r + rightVec.r })
    cells.push({ q: origin.q + rightVec.q * 2, r: origin.r + rightVec.r * 2 })
  } else if (attackClass === 'breath') {
    // 吐息：前方大範圍錐形
    const left = ((facing + 5) % 6)
    const right = ((facing + 1) % 6)
    const vec = HEX_DIRECTIONS[facing]!
    const leftVec = HEX_DIRECTIONS[left]!
    const rightVec = HEX_DIRECTIONS[right]!
    
    // 第一排：3 格
    cells.push({ q: origin.q + leftVec.q, r: origin.r + leftVec.r })
    cells.push({ q: origin.q + vec.q, r: origin.r + vec.r })
    cells.push({ q: origin.q + rightVec.q, r: origin.r + rightVec.r })
    
    // 第二排：5 格
    const left2 = ((facing + 4) % 6)
    const right2 = ((facing + 2) % 6)
    const left2Vec = HEX_DIRECTIONS[left2]!
    const right2Vec = HEX_DIRECTIONS[right2]!
    cells.push({ q: origin.q + left2Vec.q, r: origin.r + left2Vec.r })
    cells.push({ q: origin.q + leftVec.q * 2, r: origin.r + leftVec.r * 2 })
    cells.push({ q: origin.q + vec.q * 2, r: origin.r + vec.r * 2 })
    cells.push({ q: origin.q + rightVec.q * 2, r: origin.r + rightVec.r * 2 })
    cells.push({ q: origin.q + right2Vec.q, r: origin.r + right2Vec.r })
  } else {
    // 默認：前方扇形 3 格
    const left = ((facing + 5) % 6)
    const right = ((facing + 1) % 6)
    for (const dir of [left, facing, right]) {
      const vec = HEX_DIRECTIONS[dir]!
      cells.push({ q: origin.q + vec.q, r: origin.r + vec.r })
    }
  }
  
  return cells
}

function getFacingToward(from: { q: number; r: number }, to: { q: number; r: number }): number | null {
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
    if (score > bestScore) {
      bestScore = score
      best = i
    }
  }
  
  return best
}

function checkBattleEnd() {
  const playersAlive = playerUnits.value.filter(u => !u.isDead).length
  const enemiesAlive = enemyUnits.value.filter(u => !u.isDead).length
  
  if (playersAlive === 0) {
    battleResult.value = 'enemy'
    stopLoop()
  } else if (enemiesAlive === 0) {
    battleResult.value = 'player'
    stopLoop()
  }
}

function getUnitATB(unitId: string): number {
  return timeline.value.find(e => e.unitId === unitId)?.atb || 0
}

function getUnitPx(unit: BattleUnit) {
  return axialToPixel(unit.pos.q, unit.pos.r, hexSize)
}

function getFacingTransform(unit: BattleUnit): string {
  const vec = HEX_DIRECTIONS[unit.facing] || HEX_DIRECTIONS[0]!
  const { x, y } = axialToPixel(vec.q, vec.r, 1)
  const angle = Math.atan2(y, x) * (180 / Math.PI) + 90
  return `rotate(${angle}) translate(0,-2)`
}

function getFacingWheelTransform(dir: number): string {
  const vec = HEX_DIRECTIONS[dir]!
  const { x, y } = axialToPixel(vec.q * 1.1, vec.r * 1.1, hexSize)
  return `translate(${x},${y})`
}

function getCellClass(cell: Cell): string {
  const key = hexKey(cell.q, cell.r)
  
  if (attackWarningCells.value.has(key)) return 'cell-attack'
  if (reachableCells.value.has(key)) return 'cell-move'
  if (pendingMove.value && cell.q === pendingMove.value.q && cell.r === pendingMove.value.r) return 'cell-pending'
  
  return ''
}

function resetBattle() {
  stopLoop()
  battleStarted.value = false
  battleResult.value = null
  playerUnits.value = []
  enemyUnits.value = []
  timeline.value = []
  currentUnitId.value = null
  battleLog.value = []
  moveStep.value = 'idle'
  pendingCasts.value = []
  gameTick.value = 0
}

function closeResult() {
  battleResult.value = null
  resetBattle()
}

function addLog(msg: string) {
  battleLog.value.unshift(msg)
  if (battleLog.value.length > 30) battleLog.value.pop()
}

onMounted(() => {
  loadTeams()
})

onBeforeUnmount(() => {
  stopLoop()
})
</script>

<style scoped>
.enhanced-battle-sim {
  padding: 20px;
  max-width: 1800px;
  margin: 0 auto;
}

.sim-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: white;
  margin-bottom: 20px;
}

.sim-toolbar h2 {
  margin: 0;
}

.toolbar-controls {
  display: flex;
  gap: 10px;
  align-items: center;
}

.btn-ctrl {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.2s;
}

.btn-ctrl:hover {
  background: rgba(255, 255, 255, 0.3);
}

.btn-start {
  background: #FF5722;
}

.btn-start:disabled {
  background: rgba(255, 255, 255, 0.1);
  cursor: not-allowed;
}

.toggle-label {
  color: white;
  display: flex;
  align-items: center;
  gap: 5px;
}

/* 隊伍選擇 */
.team-selection-panel {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  margin-bottom: 30px;
}

.team-selector {
  padding: 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.team-selector h3 {
  margin: 0 0 15px 0;
}

.team-dropdown {
  width: 100%;
  padding: 12px;
  font-size: 1em;
  border: 2px solid #ddd;
  border-radius: 6px;
}

/* 戰鬥佈局 - 左中右結構 */
.battle-layout-horizontal {
  display: grid;
  grid-template-columns: 280px 1fr 280px;
  gap: 20px;
  align-items: start;
}

.center-section {
  display: flex;
  flex-direction: column;
  gap: 15px;
  align-items: center;
  min-height: 600px;
}

.side-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 85vh;
  overflow-y: auto;
}

.left-panel {
  position: sticky;
  top: 20px;
}

.right-panel {
  position: sticky;
  top: 20px;
}

.panel-header {
  margin: 0;
  padding: 15px;
  border-radius: 8px;
  text-align: center;
  color: white;
}

.player-header {
  background: linear-gradient(135deg, #4CAF50, #8BC34A);
}

.enemy-header {
  background: linear-gradient(135deg, #f44336, #FF5722);
}

/* 單位卡片 */
.unit-card {
  padding: 10px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
  font-size: 0.9em;
}

.unit-card.active {
  border: 3px solid #FFC107;
  box-shadow: 0 0 15px rgba(255, 193, 7, 0.5);
}

.unit-card.dead {
  opacity: 0.4;
  filter: grayscale(1);
}

.unit-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.unit-name {
  font-weight: bold;
}

.unit-hp {
  color: #f44336;
  font-weight: bold;
  font-size: 0.9em;
}

.hp-bar-track, .atb-bar-track {
  position: relative;
  height: 18px;
  background: #e0e0e0;
  border-radius: 9px;
  overflow: hidden;
  margin-bottom: 6px;
}

.hp-bar-fill, .atb-bar-fill {
  height: 100%;
  transition: width 0.3s;
}

.player-hp {
  background: linear-gradient(90deg, #4CAF50, #8BC34A);
}

.enemy-hp {
  background: linear-gradient(90deg, #f44336, #FF5722);
}

.player-atb {
  background: linear-gradient(90deg, #2196F3, #03A9F4);
}

.enemy-atb {
  background: linear-gradient(90deg, #9C27B0, #E91E63);
}

.atb-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.75em;
  font-weight: bold;
  color: white;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
}

/* 行動面板 */
.action-panel {
  padding: 12px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  font-size: 0.9em;
}

.action-panel h4 {
  margin: 0 0 8px 0;
  font-size: 1em;
}

.action-hint {
  margin: 0 0 15px 0;
  font-size: 0.9em;
  color: #666;
}

.weapon-grid {
  display: grid;
  gap: 8px;
  margin-bottom: 15px;
}

.weapon-btn {
  display: flex;
  justify-content: space-between;
  padding: 10px;
  border: 2px solid #ddd;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.weapon-btn:hover {
  border-color: #f44336;
  background: #ffebee;
  transform: translateX(3px);
}

.wpn-dmg {
  color: #f44336;
  font-weight: bold;
}

.basic-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.action-btn {
  padding: 10px;
  border: none;
  border-radius: 6px;
  background: #2196F3;
  color: white;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(33, 150, 243, 0.4);
}

.action-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.cancel-btn {
  background: #f44336;
  grid-column: 1 / -1;
}

.battle-svg {
  background: #f5f5f5;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 1200px;
  height: auto;
}

.hex-cell {
  fill: #fff;
  stroke: #ccc;
  stroke-width: 1.5;
  transition: all 0.2s;
  cursor: pointer;
}

.hex-cell.cell-move {
  fill: #e3f2fd;
  stroke: #2196F3;
  stroke-width: 2;
}

.hex-cell.cell-attack {
  fill: #ffebee;
  stroke: #f44336;
  stroke-width: 2;
  animation: attack-pulse 0.8s infinite;
}

@keyframes attack-pulse {
  0%, 100% { 
    fill: #ffebee;
    stroke-width: 2;
  }
  50% { 
    fill: #ffcdd2;
    stroke-width: 3;
  }
}

.hex-cell.cell-pending {
  fill: #fff3e0;
  stroke: #FF9800;
  stroke-width: 2.5;
}

.coord-text {
  font-size: 10px;
  fill: #999;
  pointer-events: none;
}

.unit-glow {
  fill: none;
  stroke: #FFC107;
  stroke-width: 3;
  animation: glow-pulse 1s infinite;
}

@keyframes glow-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.cast-glow {
  fill: none;
  stroke: #FF5722;
  stroke-width: 4;
  animation: cast-pulse 0.5s infinite;
}

@keyframes cast-pulse {
  0%, 100% { 
    opacity: 0.3;
    stroke-width: 4;
  }
  50% { 
    opacity: 0.8;
    stroke-width: 6;
  }
}

.cast-warning-text {
  font-size: 20px;
  font-weight: bold;
  fill: #FF5722;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
  animation: text-pulse 0.5s infinite;
}

@keyframes text-pulse {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; }
}

.facing-tri {
  pointer-events: none;
}

.facing-player {
  fill: #2E7D32;
}

.facing-enemy {
  fill: #C62828;
}

.unit-circle {
  cursor: pointer;
  transition: all 0.2s;
}

.unit-player {
  fill: #4CAF50;
  stroke: #2E7D32;
  stroke-width: 2;
}

.unit-enemy {
  fill: #f44336;
  stroke: #C62828;
  stroke-width: 2;
}

.unit-active {
  stroke-width: 3;
}

.unit-dead {
  fill: #757575;
  stroke: #424242;
}

.unit-circle:hover {
  transform: scale(1.1);
}

.unit-text {
  fill: white;
  font-weight: bold;
  font-size: 14px;
  pointer-events: none;
}

.facing-dot {
  fill: rgba(255, 255, 255, 0.8);
  stroke: #333;
  stroke-width: 2;
  cursor: pointer;
}

.facing-dot:hover {
  fill: #FFC107;
}

.facing-label {
  font-size: 12px;
  fill: #333;
  font-weight: bold;
  pointer-events: none;
}

/* 時間軸 - 水平版本 */
.timeline-panel-horizontal {
  width: 100%;
  padding: 15px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.timeline-panel-horizontal h4 {
  margin: 0 0 15px 0;
}

.timeline-track {
  position: relative;
  height: 50px;
  background: linear-gradient(90deg, #e0e0e0 0%, #4CAF50 100%);
  border-radius: 25px;
  width: 100%;
  max-width: 1200px;
}

.timeline-marker {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
}

.marker-dot {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  color: white;
  border: 3px solid white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.marker-player {
  background: #4CAF50;
}

.marker-enemy {
  background: #f44336;
}

/* 戰鬥日誌 */
.battle-log-panel {
  padding: 12px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  font-size: 0.85em;
}

.battle-log-panel h4 {
  margin: 0 0 8px 0;
  font-size: 1em;
}

.log-scroll {
  max-height: 200px;
  overflow-y: auto;
}

.log-line {
  padding: 6px;
  margin-bottom: 4px;
  background: #f5f5f5;
  border-radius: 4px;
  font-size: 0.85em;
}

/* 結果 */
.result-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.result-card {
  padding: 40px;
  background: white;
  border-radius: 16px;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.result-card h2 {
  margin: 0 0 20px 0;
  font-size: 2.5em;
}

.btn-result {
  padding: 12px 30px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1.1em;
  font-weight: bold;
  cursor: pointer;
}
</style>

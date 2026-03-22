<template>
  <div class="team-battle-sim">
    <div class="sim-header">
      <h1>🎮 隊伍戰鬥模擬</h1>
      <div class="sim-controls">
        <button @click="loadTeamSlots" class="btn-load">📂 載入隊伍</button>
        <button @click="startBattle" class="btn-start" :disabled="!canStartBattle">⚔️ 開始戰鬥</button>
        <button @click="resetBattle" class="btn-reset">🔄 重置</button>
        <button @click="toggleAutoPlay" :class="['btn-auto', autoPlay && 'btn-auto--active']">
          {{ autoPlay ? '⏸️ 暫停' : '▶️ 自動' }}
        </button>
      </div>
    </div>

    <!-- 隊伍選擇區 -->
    <div v-if="!battleStarted" class="team-selection">
      <div class="team-slot-card">
        <h2>👥 玩家隊伍</h2>
        <select v-model="selectedPlayerSlotId" class="team-select">
          <option value="">-- 選擇隊伍 --</option>
          <option v-for="slot in teamSlots" :key="slot.id" :value="slot.id">
            {{ slot.name }} ({{ getTeamUnitCount(slot) }} 人)
          </option>
        </select>
        <div v-if="selectedPlayerSlot" class="team-preview">
          <div v-for="(unit, idx) in getTeamUnits(selectedPlayerSlot)" :key="idx" class="unit-preview">
            <span class="unit-name">{{ getBloodlineName(unit.bloodlineId) }}</span>
            <span class="unit-weapons">{{ getWeaponNames(unit.equippedWeapons) }}</span>
          </div>
        </div>
      </div>

      <div class="team-slot-card">
        <h2>👹 敵方隊伍</h2>
        <select v-model="selectedEnemySlotId" class="team-select">
          <option value="">-- 選擇隊伍 --</option>
          <option v-for="slot in teamSlots" :key="slot.id" :value="slot.id">
            {{ slot.name }} ({{ getTeamUnitCount(slot) }} 人)
          </option>
        </select>
        <div v-if="selectedEnemySlot" class="team-preview">
          <div v-for="(unit, idx) in getTeamUnits(selectedEnemySlot)" :key="idx" class="unit-preview">
            <span class="unit-name">{{ getBloodlineName(unit.bloodlineId) }}</span>
            <span class="unit-weapons">{{ getWeaponNames(unit.equippedWeapons) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 戰鬥場景 -->
    <div v-if="battleStarted" class="battle-scene">
      <!-- 左側：玩家隊伍狀態 -->
      <div class="battle-panel battle-panel--left">
        <h3 class="panel-title">👥 玩家隊伍</h3>
        <div v-for="unit in playerUnits" :key="unit.id" class="unit-status-card" :class="{ 'unit-status-card--active': currentUnitId === unit.id, 'unit-status-card--dead': unit.isDead }">
          <div class="unit-header">
            <span class="unit-name">{{ unit.name }}</span>
            <span class="unit-hp">{{ unit.hp }}/{{ unit.maxHp }}</span>
          </div>
          <div class="hp-bar">
            <div class="hp-fill" :style="{ width: `${(unit.hp / unit.maxHp) * 100}%` }"></div>
          </div>
          <div class="atb-bar">
            <div class="atb-fill" :style="{ width: `${getATB(unit.id)}%` }"></div>
            <span class="atb-text">ATB {{ Math.round(getATB(unit.id)) }}%</span>
          </div>
          <div class="unit-stats">
            <span>💪 {{ unit.damage }}</span>
            <span>⚡ {{ unit.speed }}</span>
            <span>🏃 {{ unit.move }}</span>
          </div>
        </div>

        <!-- 行動控制 -->
        <div v-if="isPlayerTurn" class="action-panel">
          <h4>🎯 行動選擇</h4>
          
          <!-- 武器列表 -->
          <div v-if="currentUnitWeapons.length > 0" class="weapon-list">
            <h5>⚔️ 武器</h5>
            <button
              v-for="weapon in currentUnitWeapons"
              :key="weapon.instanceId"
              @click="useWeapon(weapon)"
              class="btn-weapon"
            >
              {{ weapon.name }}
              <span class="weapon-dmg">💥 {{ weapon.damage }}</span>
            </button>
          </div>
          
          <!-- 工具列表 -->
          <div v-if="currentUnitTools.length > 0" class="tool-list">
            <h5>🔧 工具</h5>
            <button
              v-for="tool in currentUnitTools"
              :key="tool.id"
              @click="useTool(tool)"
              class="btn-tool"
            >
              {{ tool.name }}
            </button>
          </div>
          
          <div class="action-buttons">
            <button @click="playerMove" class="btn-action">🏃 移動</button>
            <button @click="playerWait" class="btn-action">⏳ 待機</button>
          </div>
        </div>
      </div>

      <!-- 中央：戰場網格 -->
      <div class="battle-field">
        <svg :width="fieldWidth" :height="fieldHeight" class="field-svg" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid meet">
          <!-- 網格 -->
          <g v-for="cell in battleCells" :key="cell.key">
            <polygon
              :points="cell.points"
              :transform="`translate(${cell.x}, ${cell.y})`"
              :class="['hex-cell', getCellClass(cell)]"
              @click="handleCellClick(cell)"
              @mouseenter="handleCellHover(cell)"
            />
            <text
              v-if="showCoords"
              :x="cell.x"
              :y="cell.y + 5"
              class="cell-coord"
              text-anchor="middle"
            >{{ cell.q }},{{ cell.r }}</text>
          </g>

          <!-- 單位 -->
          <g v-for="unit in allUnits" :key="unit.id" :transform="`translate(${getUnitX(unit)}, ${getUnitY(unit)})`">
            <circle
              v-if="currentUnitId === unit.id"
              :r="hexSize * 0.6"
              class="unit-glow"
            />
            <circle
              :r="hexSize * 0.45"
              :class="['unit-circle', unit.team === 'player' ? 'unit-circle--player' : 'unit-circle--enemy', unit.isDead && 'unit-circle--dead']"
              @click="handleUnitClick(unit)"
            />
            <text
              text-anchor="middle"
              dy="5"
              class="unit-label"
            >{{ unit.name.slice(0, 2) }}</text>
            
            <!-- 朝向指示 -->
            <polygon
              :points="facingTriangle"
              :transform="`rotate(${unit.facing * 60})`"
              :class="['facing-arrow', unit.team === 'player' ? 'facing-arrow--player' : 'facing-arrow--enemy']"
            />
          </g>
        </svg>

        <!-- 時間軸顯示 -->
        <div class="timeline-display">
          <h4>⏱️ ATB 時間軸</h4>
          <div class="timeline-bar">
            <div v-for="entry in sortedTimeline" :key="entry.unitId" class="timeline-entry" :style="{ left: `${entry.atb}%` }">
              <div :class="['timeline-marker', entry.team === 'player' ? 'timeline-marker--player' : 'timeline-marker--enemy']">
                {{ entry.name.slice(0, 1) }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右側：敵方隊伍狀態 -->
      <div class="battle-panel battle-panel--right">
        <h3 class="panel-title">👹 敵方隊伍</h3>
        <div v-for="unit in enemyUnits" :key="unit.id" class="unit-status-card" :class="{ 'unit-status-card--active': currentUnitId === unit.id, 'unit-status-card--dead': unit.isDead }">
          <div class="unit-header">
            <span class="unit-name">{{ unit.name }}</span>
            <span class="unit-hp">{{ unit.hp }}/{{ unit.maxHp }}</span>
          </div>
          <div class="hp-bar">
            <div class="hp-fill hp-fill--enemy" :style="{ width: `${(unit.hp / unit.maxHp) * 100}%` }"></div>
          </div>
          <div class="atb-bar">
            <div class="atb-fill atb-fill--enemy" :style="{ width: `${getATB(unit.id)}%` }"></div>
            <span class="atb-text">ATB {{ Math.round(getATB(unit.id)) }}%</span>
          </div>
          <div class="unit-stats">
            <span>💪 {{ unit.damage }}</span>
            <span>⚡ {{ unit.speed }}</span>
            <span>🏃 {{ unit.move }}</span>
          </div>
        </div>

        <!-- 戰鬥日誌 -->
        <div class="battle-log">
          <h4>📜 戰鬥日誌</h4>
          <div class="log-content">
            <div v-for="(log, idx) in battleLogs" :key="idx" class="log-entry">
              {{ log }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 戰鬥結果 -->
    <div v-if="battleResult" class="battle-result">
      <div class="result-modal">
        <h2>{{ battleResult === 'player' ? '🎉 勝利！' : '💀 失敗...' }}</h2>
        <p>{{ battleResult === 'player' ? '玩家隊伍獲勝！' : '敵方隊伍獲勝！' }}</p>
        <button @click="closeBattleResult" class="btn-close">關閉</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import type { TeamSlot } from '../game/teamStorage'
import type { UnitBuild } from '../game/teamSystem'
import { loadTeamSlots as loadSlotsFromStorage } from '../game/teamStorage'
import { demoBloodlines, demoWeapons, demoTools } from '../game/mockData'
import { hexPoints, axialToPixel, offsetToAxial, hexKey } from '../game/hex'

// 戰鬥單位類型
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
  weapons: WeaponData[]
  toolIds: string[]
  unitBuild?: UnitBuild
}

type ATBEntry = {
  unitId: string
  atb: number
  castRemaining: number
  recoveryRemaining: number
}

type BattleCell = {
  key: string
  q: number
  r: number
  x: number
  y: number
  points: string
}

// 常數
const hexSize = 35
const fieldWidth = 800
const fieldHeight = 600
const facingTriangle = '0,-20 8,-8 -8,-8'

// 武器和工具資料
type WeaponData = {
  instanceId: string
  weaponId: string
  name: string
  damage: number
}

type ToolData = {
  id: string
  name: string
}

// 狀態
const teamSlots = ref<TeamSlot[]>([])
const selectedPlayerSlotId = ref<string>('')
const selectedEnemySlotId = ref<string>('')
const battleStarted = ref(false)
const battleResult = ref<'player' | 'enemy' | null>(null)
const autoPlay = ref(false)
const showCoords = ref(false)

const playerUnits = ref<BattleUnit[]>([])
const enemyUnits = ref<BattleUnit[]>([])
const timeline = ref<ATBEntry[]>([])
const currentUnitId = ref<string | null>(null)
const battleLogs = ref<string[]>([])
const battleCells = ref<BattleCell[]>([])

const hoveredCell = ref<{ q: number; r: number } | null>(null)
const selectedCell = ref<{ q: number; r: number } | null>(null)

let autoPlayInterval: number | null = null

// 計算屬性
const selectedPlayerSlot = computed(() => 
  teamSlots.value.find(s => s.id === selectedPlayerSlotId.value) || null
)

const selectedEnemySlot = computed(() => 
  teamSlots.value.find(s => s.id === selectedEnemySlotId.value) || null
)

const canStartBattle = computed(() => 
  selectedPlayerSlotId.value && selectedEnemySlotId.value
)

const allUnits = computed(() => [...playerUnits.value, ...enemyUnits.value])

const isPlayerTurn = computed(() => {
  if (!currentUnitId.value) return false
  const unit = allUnits.value.find(u => u.id === currentUnitId.value)
  return unit?.team === 'player'
})

const currentUnit = computed(() => {
  if (!currentUnitId.value) return null
  return allUnits.value.find(u => u.id === currentUnitId.value) || null
})

const currentUnitWeapons = computed(() => {
  return currentUnit.value?.weapons || []
})

const currentUnitTools = computed(() => {
  if (!currentUnit.value) return []
  return currentUnit.value.toolIds.map(toolId => {
    const tool = demoTools.find(t => t.id === toolId)
    return tool ? { id: tool.id, name: tool.name } : null
  }).filter(t => t !== null) as ToolData[]
})

const sortedTimeline = computed(() => {
  return timeline.value.map(entry => {
    const unit = allUnits.value.find(u => u.id === entry.unitId)
    return {
      ...entry,
      name: unit?.name || '',
      team: unit?.team || 'enemy'
    }
  }).sort((a, b) => b.atb - a.atb)
})

// 方法
function loadTeamSlots() {
  const slotList = loadSlotsFromStorage()
  teamSlots.value = slotList.slots
  addLog('📂 已載入隊伍槽位')
}

function getTeamUnitCount(slot: TeamSlot): number {
  return slot.teamBuild.units.filter(u => u.bloodlineId !== null).length
}

function getTeamUnits(slot: TeamSlot): UnitBuild[] {
  return slot.teamBuild.units.filter(u => u.bloodlineId !== null)
}

function getBloodlineName(bloodlineId: string | null): string {
  if (!bloodlineId) return '空'
  const bloodline = demoBloodlines.find(b => b.id === bloodlineId)
  return bloodline?.name || bloodlineId
}

function getWeaponNames(weapons: any[]): string {
  if (weapons.length === 0) return '無武器'
  return weapons.map(w => {
    const weapon = demoWeapons.find(wp => wp.id === w.weaponId)
    return weapon?.name || '?'
  }).join(', ')
}

function startBattle() {
  if (!selectedPlayerSlot.value || !selectedEnemySlot.value) return

  // 初始化戰場
  initializeBattleField()
  
  // 創建玩家單位
  playerUnits.value = createBattleUnits(selectedPlayerSlot.value, 'player', [
    { q: 1, r: 2 }, { q: 1, r: 3 }, { q: 1, r: 4 }
  ])
  
  // 創建敵方單位
  enemyUnits.value = createBattleUnits(selectedEnemySlot.value, 'enemy', [
    { q: 7, r: 2 }, { q: 7, r: 3 }, { q: 7, r: 4 }
  ])
  
  // 初始化 ATB
  timeline.value = allUnits.value.map(unit => ({
    unitId: unit.id,
    atb: Math.random() * 30,
    castRemaining: 0,
    recoveryRemaining: 0
  }))
  
  battleStarted.value = true
  addLog('⚔️ 戰鬥開始！')
  
  // 開始 ATB 推進
  advanceATB()
}

function createBattleUnits(slot: TeamSlot, team: 'player' | 'enemy', positions: { q: number; r: number }[]): BattleUnit[] {
  const units = getTeamUnits(slot)
  return units.map((unit, idx) => {
    const bloodline = demoBloodlines.find(b => b.id === unit.bloodlineId)
    const pos = positions[idx] || { q: 0, r: 0 }
    
    // 整理武器資料
    const weapons: WeaponData[] = unit.equippedWeapons.map(w => {
      const weaponDef = demoWeapons.find(wd => wd.id === w.weaponId)
      return {
        instanceId: w.instanceId,
        weaponId: w.weaponId,
        name: weaponDef?.name || '未知武器',
        damage: weaponDef?.baseDamage || 20
      }
    })
    
    return {
      id: `${team}_${idx}`,
      name: bloodline?.name || `單位${idx + 1}`,
      team,
      bloodlineId: unit.bloodlineId || '',
      hp: bloodline?.baseStats.hp || 100,
      maxHp: bloodline?.baseStats.hp || 100,
      damage: bloodline?.baseStats.str || 10,
      speed: bloodline?.baseStats.agi || 10,
      move: bloodline?.baseStats.move || 3,
      pos,
      facing: team === 'player' ? 0 : 3,
      isDead: false,
      weapons,
      toolIds: unit.equippedToolIds,
      unitBuild: unit
    }
  })
}

function initializeBattleField() {
  const cells: BattleCell[] = []
  const cols = 9
  const rows = 7
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const pos = offsetToAxial(col, row)
      const pixel = axialToPixel(pos.q, pos.r, hexSize)
      
      cells.push({
        key: hexKey(pos.q, pos.r),
        q: pos.q,
        r: pos.r,
        x: pixel.x + 50,
        y: pixel.y + 50,
        points: hexPoints(hexSize)
      })
    }
  }
  
  battleCells.value = cells
}

function advanceATB() {
  if (!battleStarted.value) return
  
  // 推進所有單位的 ATB
  timeline.value = timeline.value.map(entry => {
    const unit = allUnits.value.find(u => u.id === entry.unitId)
    if (!unit || unit.isDead) return entry
    
    if (entry.recoveryRemaining > 0) {
      return { ...entry, recoveryRemaining: Math.max(0, entry.recoveryRemaining - 50) }
    }
    
    const speedGain = (unit.speed / 100) * 5
    return { ...entry, atb: Math.min(100, entry.atb + speedGain) }
  })
  
  // 檢查是否有單位達到 100
  const readyEntry = timeline.value.find(e => e.atb >= 100 && e.recoveryRemaining === 0)
  if (readyEntry) {
    const unit = allUnits.value.find(u => u.id === readyEntry.unitId)
    if (unit && !unit.isDead) {
      currentUnitId.value = unit.id
      addLog(`⏰ ${unit.name} 的回合`)
      
      if (unit.team === 'enemy' && autoPlay.value) {
        setTimeout(() => executeEnemyTurn(unit), 1000)
      }
    }
  }
  
  // 檢查勝負
  checkBattleEnd()
}

function executeEnemyTurn(unit: BattleUnit) {
  // 簡單 AI：攻擊最近的玩家單位
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
  
  endTurn(unit.id)
}

function playerMove() {
  addLog('🏃 選擇移動目標...')
}

function useWeapon(weapon: WeaponData) {
  if (!currentUnitId.value) return
  
  const attacker = currentUnit.value
  if (!attacker) return
  
  const targets = enemyUnits.value.filter(u => !u.isDead)
  if (targets.length > 0) {
    const target = targets[0]!
    
    // 使用武器的傷害值
    const baseDamage = weapon.damage
    const bloodline = demoBloodlines.find(b => b.id === attacker.bloodlineId)
    const scalingStat = bloodline?.baseStats.str || 10
    
    // 傷害 = 武器傷害 × (1 + 屬性 × 0.05) × 隨機係數
    const statBonus = 1 + (scalingStat * 0.05)
    const randomFactor = 0.9 + Math.random() * 0.2
    const finalDamage = Math.floor(baseDamage * statBonus * randomFactor)
    
    target.hp = Math.max(0, target.hp - finalDamage)
    
    if (target.hp === 0) {
      target.isDead = true
      addLog(`💀 ${target.name} 被擊倒！`)
    } else {
      addLog(`⚔️ ${attacker.name} 使用 ${weapon.name} 政擊 ${target.name}，造成 ${finalDamage} 傷害`)
    }
    
    endTurn(attacker.id)
  }
}

function useTool(tool: ToolData) {
  if (!currentUnitId.value) return
  
  const user = currentUnit.value
  if (!user) return
  
  const toolDef = demoTools.find(t => t.id === tool.id)
  if (!toolDef) return
  
  // 簡單實作：治療效果
  const healAmount = 30
  user.hp = Math.min(user.maxHp, user.hp + healAmount)
  
  addLog(`💊 ${user.name} 使用 ${tool.name}，恢復 ${healAmount} HP`)
  
  endTurn(user.id)
}

function playerWait() {
  if (!currentUnitId.value) return
  addLog('⏳ 待機')
  endTurn(currentUnitId.value)
}

function endTurn(unitId: string) {
  const entry = timeline.value.find(e => e.unitId === unitId)
  if (entry) {
    entry.atb = 0
    entry.recoveryRemaining = 200
  }
  currentUnitId.value = null
  
  setTimeout(() => advanceATB(), 100)
}

function checkBattleEnd() {
  const playersAlive = playerUnits.value.filter(u => !u.isDead).length
  const enemiesAlive = enemyUnits.value.filter(u => !u.isDead).length
  
  if (playersAlive === 0) {
    battleResult.value = 'enemy'
    battleStarted.value = false
    addLog('💀 戰鬥失敗...')
  } else if (enemiesAlive === 0) {
    battleResult.value = 'player'
    battleStarted.value = false
    addLog('🎉 戰鬥勝利！')
  }
}

function getATB(unitId: string): number {
  const entry = timeline.value.find(e => e.unitId === unitId)
  return entry?.atb || 0
}

function getUnitX(unit: BattleUnit): number {
  const pixel = axialToPixel(unit.pos.q, unit.pos.r, hexSize)
  return pixel.x + 50
}

function getUnitY(unit: BattleUnit): number {
  const pixel = axialToPixel(unit.pos.q, unit.pos.r, hexSize)
  return pixel.y + 50
}

function getCellClass(cell: BattleCell): string {
  if (hoveredCell.value && cell.q === hoveredCell.value.q && cell.r === hoveredCell.value.r) {
    return 'hex-cell--hover'
  }
  if (selectedCell.value && cell.q === selectedCell.value.q && cell.r === selectedCell.value.r) {
    return 'hex-cell--selected'
  }
  return ''
}

function handleCellClick(cell: BattleCell) {
  selectedCell.value = { q: cell.q, r: cell.r }
}

function handleCellHover(cell: BattleCell) {
  hoveredCell.value = { q: cell.q, r: cell.r }
}

function handleUnitClick(unit: BattleUnit) {
  addLog(`👁️ 選中 ${unit.name}`)
}

function resetBattle() {
  battleStarted.value = false
  battleResult.value = null
  playerUnits.value = []
  enemyUnits.value = []
  timeline.value = []
  currentUnitId.value = null
  battleLogs.value = []
  autoPlay.value = false
  
  if (autoPlayInterval) {
    clearInterval(autoPlayInterval)
    autoPlayInterval = null
  }
}

function toggleAutoPlay() {
  autoPlay.value = !autoPlay.value
  
  if (autoPlay.value) {
    autoPlayInterval = window.setInterval(() => {
      if (battleStarted.value && !currentUnitId.value) {
        advanceATB()
      }
    }, 100)
  } else {
    if (autoPlayInterval) {
      clearInterval(autoPlayInterval)
      autoPlayInterval = null
    }
  }
}

function closeBattleResult() {
  battleResult.value = null
  resetBattle()
}

function addLog(message: string) {
  battleLogs.value.unshift(`[${new Date().toLocaleTimeString()}] ${message}`)
  if (battleLogs.value.length > 50) {
    battleLogs.value = battleLogs.value.slice(0, 50)
  }
}

onMounted(() => {
  loadTeamSlots()
})

onBeforeUnmount(() => {
  if (autoPlayInterval) {
    clearInterval(autoPlayInterval)
  }
})
</script>

<style scoped>
.team-battle-sim {
  padding: 20px;
  max-width: 1800px;
  margin: 0 auto;
}

.sim-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: white;
}

.sim-header h1 {
  margin: 0;
  font-size: 2em;
}

.sim-controls {
  display: flex;
  gap: 10px;
}

.btn-load, .btn-start, .btn-reset, .btn-auto {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1em;
  font-weight: bold;
  transition: all 0.2s;
}

.btn-load {
  background: #4CAF50;
  color: white;
}

.btn-start {
  background: #FF5722;
  color: white;
}

.btn-start:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.btn-reset {
  background: #2196F3;
  color: white;
}

.btn-auto {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.btn-auto--active {
  background: #FFC107;
  color: #333;
}

/* 隊伍選擇 */
.team-selection {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  margin-bottom: 30px;
}

.team-slot-card {
  padding: 25px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.team-slot-card h2 {
  margin: 0 0 15px 0;
  font-size: 1.3em;
}

.team-select {
  width: 100%;
  padding: 12px;
  font-size: 1em;
  border: 2px solid #ddd;
  border-radius: 6px;
  margin-bottom: 15px;
}

.team-preview {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.unit-preview {
  display: flex;
  justify-content: space-between;
  padding: 10px;
  background: #f5f5f5;
  border-radius: 6px;
}

.unit-name {
  font-weight: bold;
}

.unit-weapons {
  color: #666;
  font-size: 0.9em;
}

/* 戰鬥場景 */
.battle-scene {
  display: grid;
  grid-template-columns: 300px 1fr 300px;
  gap: 20px;
}

.battle-panel {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.panel-title {
  margin: 0;
  padding: 15px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 8px;
  text-align: center;
}

.unit-status-card {
  padding: 15px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
}

.unit-status-card--active {
  border: 3px solid #FFC107;
  box-shadow: 0 0 20px rgba(255, 193, 7, 0.5);
}

.unit-status-card--dead {
  opacity: 0.5;
  filter: grayscale(1);
}

.unit-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}

.unit-name {
  font-weight: bold;
  font-size: 1.1em;
}

.unit-hp {
  color: #f44336;
  font-weight: bold;
}

.hp-bar, .atb-bar {
  position: relative;
  height: 20px;
  background: #e0e0e0;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 8px;
}

.hp-fill {
  height: 100%;
  background: linear-gradient(90deg, #4CAF50, #8BC34A);
  transition: width 0.3s;
}

.hp-fill--enemy {
  background: linear-gradient(90deg, #f44336, #FF5722);
}

.atb-fill {
  height: 100%;
  background: linear-gradient(90deg, #2196F3, #03A9F4);
  transition: width 0.1s linear;
}

.atb-fill--enemy {
  background: linear-gradient(90deg, #9C27B0, #E91E63);
}

.atb-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.8em;
  font-weight: bold;
  color: white;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
}

.unit-stats {
  display: flex;
  justify-content: space-around;
  font-size: 0.9em;
  color: #666;
}

/* 行動面板 */
.action-panel {
  padding: 15px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  max-height: 500px;
  overflow-y: auto;
}

.action-panel h4 {
  margin: 0 0 15px 0;
}

.action-panel h5 {
  margin: 15px 0 10px 0;
  font-size: 0.9em;
  color: #666;
}

.weapon-list, .tool-list {
  margin-bottom: 15px;
}

.btn-weapon, .btn-tool {
  width: 100%;
  padding: 10px;
  margin-bottom: 8px;
  border: 2px solid #ddd;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 500;
}

.btn-weapon:hover {
  border-color: #f44336;
  background: #ffebee;
  transform: translateX(5px);
}

.btn-tool:hover {
  border-color: #4CAF50;
  background: #e8f5e9;
  transform: translateX(5px);
}

.weapon-dmg {
  font-size: 0.9em;
  color: #f44336;
  font-weight: bold;
}

.action-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 15px;
}

.btn-action {
  padding: 12px;
  border: none;
  border-radius: 6px;
  background: #2196F3;
  color: white;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-action:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(33, 150, 243, 0.4);
}

/* 戰場 */
.battle-field {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  flex: 1;
  min-width: 0;
}

.field-svg {
  background: #f0f0f0;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  max-width: 100%;
  height: auto;
}

.hex-cell {
  fill: #fff;
  stroke: #ccc;
  stroke-width: 1.5;
  transition: all 0.2s;
}

.hex-cell--hover {
  fill: #e3f2fd;
  stroke: #2196F3;
  stroke-width: 2;
}

.hex-cell--selected {
  fill: #fff3e0;
  stroke: #FF9800;
  stroke-width: 2.5;
}

.cell-coord {
  font-size: 10px;
  fill: #999;
  pointer-events: none;
}

.unit-glow {
  fill: none;
  stroke: #FFC107;
  stroke-width: 3;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.unit-circle {
  cursor: pointer;
  transition: all 0.2s;
}

.unit-circle--player {
  fill: #4CAF50;
  stroke: #2E7D32;
  stroke-width: 2;
}

.unit-circle--enemy {
  fill: #f44336;
  stroke: #C62828;
  stroke-width: 2;
}

.unit-circle--dead {
  fill: #757575;
  stroke: #424242;
}

.unit-circle:hover {
  transform: scale(1.1);
}

.unit-label {
  fill: white;
  font-weight: bold;
  font-size: 14px;
  pointer-events: none;
  user-select: none;
}

.facing-arrow {
  pointer-events: none;
}

.facing-arrow--player {
  fill: #2E7D32;
}

.facing-arrow--enemy {
  fill: #C62828;
}

/* 時間軸 */
.timeline-display {
  width: 100%;
  padding: 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.timeline-display h4 {
  margin: 0 0 15px 0;
}

.timeline-bar {
  position: relative;
  height: 50px;
  background: linear-gradient(90deg, #e0e0e0 0%, #4CAF50 100%);
  border-radius: 25px;
  overflow: visible;
}

.timeline-entry {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
}

.timeline-marker {
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

.timeline-marker--player {
  background: #4CAF50;
}

.timeline-marker--enemy {
  background: #f44336;
}

/* 戰鬥日誌 */
.battle-log {
  padding: 15px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.battle-log h4 {
  margin: 0 0 15px 0;
}

.log-content {
  max-height: 300px;
  overflow-y: auto;
}

.log-entry {
  padding: 8px;
  margin-bottom: 5px;
  background: #f5f5f5;
  border-radius: 4px;
  font-size: 0.9em;
}

/* 戰鬥結果 */
.battle-result {
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

.result-modal {
  padding: 40px;
  background: white;
  border-radius: 16px;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.result-modal h2 {
  margin: 0 0 20px 0;
  font-size: 2.5em;
}

.result-modal p {
  margin: 0 0 30px 0;
  font-size: 1.2em;
}

.btn-close {
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

<template>
  <div class="team-builder">
    <h1>隊伍編成</h1>
    
    <!-- 頁簽切換 -->
    <div class="tabs">
      <button
        :class="['tab', { active: currentTab === 'team' }]"
        @click="currentTab = 'team'"
      >
        隊伍配置
      </button>
      <button
        :class="['tab', { active: currentTab === 'assets' }]"
        @click="currentTab = 'assets'"
      >
        資產庫存
      </button>
    </div>

    <!-- 隊伍配置頁 -->
    <div v-if="currentTab === 'team'" class="team-page">
      <!-- 隊伍槽位管理 -->
      <div class="team-slots">
        <div class="slot-tabs">
          <button
            v-for="slot in teamSlots"
            :key="slot.id"
            :class="['slot-tab', { active: currentSlotId === slot.id }]"
            @click="switchSlot(slot.id)"
          >
            {{ slot.name }}
            <span class="slot-modified">{{ formatDate(slot.lastModified) }}</span>
          </button>
          <button
            v-if="canAddSlot"
            @click="createNewSlot"
            class="slot-tab slot-add"
          >
            + 新增隊伍
          </button>
        </div>
        <div class="slot-actions">
          <button @click="saveCurrentSlot" class="btn-save">💾 儲存</button>
          <button @click="showRenameDialog = true" class="btn-action">✂️ 重命名</button>
          <button @click="deleteCurrentSlot" class="btn-danger" :disabled="teamSlots.length <= 1">🗑️ 刪除</button>
        </div>
      </div>

      <div class="team-header">
        <input
          v-model="teamBuild.name"
          class="team-name-input"
          placeholder="隊伍名稱"
        />
      </div>

      <!-- 三個戰棋位置 -->
      <div class="units-grid">
        <div
          v-for="(unit, index) in teamBuild.units"
          :key="unit.id"
          class="unit-card"
        >
          <div class="unit-header">
            <h2>位置 {{ index + 1 }}</h2>
            <button
              v-if="unit.bloodlineId"
              @click="clearUnit(index)"
              class="btn-clear"
            >
              清空
            </button>
          </div>

          <!-- 血統卡選擇 -->
          <div class="bloodline-section">
            <h3>血統卡</h3>
            <select
              v-model="unit.bloodlineId"
              @change="onBloodlineChange(index)"
              class="bloodline-select"
            >
              <option :value="null">-- 選擇血統卡 --</option>
              <option
                v-for="bloodline in availableBloodlines"
                :key="bloodline.id"
                :value="bloodline.id"
              >
                {{ bloodline.name }} ({{ bloodline.family }})
              </option>
            </select>

            <div v-if="getBloodline(unit.bloodlineId)" class="bloodline-detail">
              <img 
                :src="getBloodlineImage(unit.bloodlineId)"
                :alt="getBloodline(unit.bloodlineId)!.name"
                class="bloodline-image"
              />
              <div class="bloodline-stats">
                <h4>{{ getBloodline(unit.bloodlineId)!.name }}</h4>
                <div class="stats-grid">
                  <div class="stat-item">
                    <span class="stat-label">HP</span>
                    <span class="stat-value">{{ getBloodline(unit.bloodlineId)!.baseStats.hp }}</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">移動</span>
                    <span class="stat-value">{{ getBloodline(unit.bloodlineId)!.baseStats.move }}</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">力量</span>
                    <span class="stat-value">{{ getBloodline(unit.bloodlineId)!.baseStats.str }}</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">敏捷</span>
                    <span class="stat-value">{{ getBloodline(unit.bloodlineId)!.baseStats.agi }}</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">智力</span>
                    <span class="stat-value">{{ getBloodline(unit.bloodlineId)!.baseStats.int }}</span>
                  </div>
                </div>
                <div class="slot-info">
                  <span>武器槽: {{ getBloodline(unit.bloodlineId)!.weaponSlots }}</span>
                  <span>基因槽: 1+{{ getBloodline(unit.bloodlineId)!.genericGeneSlots }}</span>
                  <span>工具槽: {{ getBloodline(unit.bloodlineId)!.toolSlots }}</span>
                </div>
                <div class="race-tags">
                  <span v-for="tag in getBloodline(unit.bloodlineId)!.raceTags" :key="tag" class="tag">{{ tag }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 武器裝備 -->
          <div v-if="unit.bloodlineId" class="equipment-section">
            <h3>武器 ({{ unit.equippedWeapons.length }}/{{ getBloodline(unit.bloodlineId)!.weaponSlots }})</h3>
            
            <div class="equipped-items">
              <div
                v-for="weaponInstance in unit.equippedWeapons"
                :key="weaponInstance.instanceId"
                class="equipped-item"
              >
                <div class="item-info">
                  <strong>{{ getWeaponName(weaponInstance.weaponId) }}</strong>
                  <span class="instance-id">{{ weaponInstance.instanceId }}</span>
                </div>
                <div class="item-actions">
                  <button
                    @click="openWeaponModuleEditor(index, weaponInstance.instanceId)"
                    class="btn-edit"
                  >
                    ⚙️ 插槽
                  </button>
                  <button
                    @click="unequipWeapon(index, weaponInstance.instanceId)"
                    class="btn-remove"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>

            <button
              v-if="unit.equippedWeapons.length < getBloodline(unit.bloodlineId)!.weaponSlots"
              @click="openWeaponSelector(index)"
              class="btn-add"
            >
              + 添加武器
            </button>
          </div>

          <!-- 基因裝備 -->
          <div v-if="unit.bloodlineId" class="equipment-section">
            <h3>基因</h3>
            
            <div class="gene-category">
              <h4>專用基因 ({{ getExclusiveGeneCount(unit) }}/1)</h4>
              <div class="equipped-items">
                <div
                  v-for="geneId in getExclusiveGenes(unit)"
                  :key="geneId"
                  class="equipped-item-small"
                >
                  {{ getGeneName(geneId) }}
                  <button @click="unequipGene(index, geneId)" class="btn-remove-small">✕</button>
                </div>
              </div>
              <button
                v-if="getExclusiveGeneCount(unit) < 1"
                @click="openGeneSelector(index, 'exclusive')"
                class="btn-add-small"
              >
                + 添加
              </button>
            </div>

            <div class="gene-category">
              <h4>通用基因 ({{ getGenericGeneCount(unit) }}/{{ getBloodline(unit.bloodlineId)!.genericGeneSlots }})</h4>
              <div class="equipped-items">
                <div
                  v-for="geneId in getGenericGenes(unit)"
                  :key="geneId"
                  class="equipped-item-small"
                >
                  {{ getGeneName(geneId) }}
                  <button @click="unequipGene(index, geneId)" class="btn-remove-small">✕</button>
                </div>
              </div>
              <button
                v-if="getGenericGeneCount(unit) < getBloodline(unit.bloodlineId)!.genericGeneSlots"
                @click="openGeneSelector(index, 'generic')"
                class="btn-add-small"
              >
                + 添加
              </button>
            </div>
          </div>

          <!-- 工具裝備 -->
          <div v-if="unit.bloodlineId" class="equipment-section">
            <h3>工具 ({{ unit.equippedToolIds.length }}/{{ getBloodline(unit.bloodlineId)!.toolSlots }})</h3>
            
            <div class="equipped-items">
              <div
                v-for="toolId in unit.equippedToolIds"
                :key="toolId"
                class="equipped-item-small"
              >
                {{ getToolName(toolId) }}
                <button @click="unequipTool(index, toolId)" class="btn-remove-small">✕</button>
              </div>
            </div>

            <button
              v-if="unit.equippedToolIds.length < getBloodline(unit.bloodlineId)!.toolSlots"
              @click="openToolSelector(index)"
              class="btn-add-small"
            >
              + 添加工具
            </button>
          </div>

          <!-- 驗證結果 -->
          <div v-if="unit.bloodlineId" class="validation">
            <div v-if="getValidation(index).errors.length > 0" class="errors">
              <p v-for="(error, i) in getValidation(index).errors" :key="i">❌ {{ error }}</p>
            </div>
            <div v-if="getValidation(index).warnings.length > 0" class="warnings">
              <p v-for="(warning, i) in getValidation(index).warnings" :key="i">⚠️ {{ warning }}</p>
            </div>
            <div v-if="getValidation(index).valid && unit.equippedWeapons.length > 0" class="success">
              ✅ 配置完成
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 資產庫存頁 -->
    <div v-if="currentTab === 'assets'" class="assets-page">
      <h2>資產庫存</h2>
      
      <!-- 武器資產 -->
      <div class="asset-section">
        <h3>武器</h3>
        <div class="asset-grid">
          <div
            v-for="weapon in availableWeapons"
            :key="weapon.id"
            class="asset-card"
          >
            <h4>{{ weapon.name }}</h4>
            <p class="description">{{ weapon.description }}</p>
            <div class="stats">
              <span>傷害: {{ weapon.baseDamage }}</span>
              <span>{{ weapon.damageType }}</span>
              <span>{{ weapon.elementType }}</span>
            </div>
            <div class="inventory-count">
              擁有: {{ getWeaponStats(weapon.id).total }} 
              (可用: {{ getWeaponStats(weapon.id).available }})
            </div>
          </div>
        </div>
      </div>

      <!-- 模組資產 -->
      <div class="asset-section">
        <h3>插槽模組</h3>
        
        <div class="module-tabs">
          <button
            :class="['module-tab', { active: moduleFilter === 'all' }]"
            @click="moduleFilter = 'all'"
          >
            全部 ({{ allModules.length }})
          </button>
          <button
            :class="['module-tab', { active: moduleFilter === 'tempo' }]"
            @click="moduleFilter = 'tempo'"
          >
            ⚡ 時序 ({{ getModulesByType('tempo').length }})
          </button>
          <button
            :class="['module-tab', { active: moduleFilter === 'tactical' }]"
            @click="moduleFilter = 'tactical'"
          >
            ⚔️ 戰術 ({{ getModulesByType('tactical').length }})
          </button>
          <button
            :class="['module-tab', { active: moduleFilter === 'enchant' }]"
            @click="moduleFilter = 'enchant'"
          >
            🔮 附魔 ({{ getModulesByType('enchant').length }})
          </button>
        </div>

        <div class="asset-grid">
          <div
            v-for="module in filteredModules"
            :key="module.id"
            class="asset-card module-card"
          >
            <div class="module-header">
              <h4>{{ module.name }}</h4>
              <span :class="['rarity', module.rarity]">{{ module.rarity }}</span>
            </div>
            <p class="description">{{ module.description }}</p>
            <div class="inventory-count">
              擁有: {{ getModuleStats(module.id).total }} 
              (可用: {{ getModuleStats(module.id).available }})
            </div>
          </div>
        </div>
      </div>

      <!-- 基因資產 -->
      <div class="asset-section">
        <h3>基因</h3>
        <div class="asset-grid">
          <div
            v-for="gene in availableGenes"
            :key="gene.id"
            class="asset-card"
          >
            <div class="gene-header">
              <h4>{{ gene.name }}</h4>
              <span :class="['gene-type', gene.geneType]">{{ gene.geneType === 'exclusive' ? '專用' : '通用' }}</span>
            </div>
            <p class="description">{{ gene.description }}</p>
            <div class="compatible">
              適用: {{ gene.compatibleFamilies.join(', ') }}
            </div>
          </div>
        </div>
      </div>

      <!-- 工具資產 -->
      <div class="asset-section">
        <h3>戰術工具</h3>
        <div class="asset-grid">
          <div
            v-for="tool in availableTools"
            :key="tool.id"
            class="asset-card"
          >
            <h4>{{ tool.name }}</h4>
            <p class="description">{{ tool.description }}</p>
            <div class="stats">
              <span>充能: {{ tool.charges }}</span>
              <span>{{ tool.toolType }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 武器選擇彈窗 -->
    <div v-if="showWeaponSelector" class="modal" @click="closeWeaponSelector">
      <div class="modal-content" @click.stop>
        <h3>選擇武器</h3>
        <div class="selector-grid">
          <div
            v-for="weaponInstance in getAvailableWeaponInstances()"
            :key="weaponInstance.instanceId"
            class="selector-item"
            @click="selectWeapon(weaponInstance)"
          >
            <h4>{{ getWeaponName(weaponInstance.weaponId) }}</h4>
            <p class="instance-id">{{ weaponInstance.instanceId }}</p>
          </div>
        </div>
        <button @click="closeWeaponSelector" class="btn-close">關閉</button>
      </div>
    </div>

    <!-- 基因選擇彈窗 -->
    <div v-if="showGeneSelector" class="modal" @click="closeGeneSelector">
      <div class="modal-content" @click.stop>
        <h3>選擇基因</h3>
        <div class="selector-grid">
          <div
            v-for="gene in getAvailableGenesForSelector()"
            :key="gene.id"
            class="selector-item"
            @click="selectGene(gene.id)"
          >
            <h4>{{ gene.name }}</h4>
            <p>{{ gene.description }}</p>
          </div>
        </div>
        <button @click="closeGeneSelector" class="btn-close">關閉</button>
      </div>
    </div>

    <!-- 工具選擇彈窗 -->
    <div v-if="showToolSelector" class="modal" @click="closeToolSelector">
      <div class="modal-content" @click.stop>
        <h3>選擇工具</h3>
        <div class="selector-grid">
          <div
            v-for="tool in availableTools"
            :key="tool.id"
            class="selector-item"
            @click="selectTool(tool.id)"
          >
            <h4>{{ tool.name }}</h4>
            <p>{{ tool.description }}</p>
          </div>
        </div>
        <button @click="closeToolSelector" class="btn-close">關閉</button>
      </div>
    </div>

    <!-- 武器插槽編輯彈窗 -->
    <WeaponModuleEditor
      v-if="showModuleEditor"
      :weapon-instance-id="editingWeaponInstanceId"
      :weapon-id="editingWeaponId"
      :unit-index="editingUnitIndex"
      :team-build="teamBuild"
      :inventory="inventory"
      :all-weapons="availableWeapons"
      :all-modules="allModules"
      :bloodline="getBloodline(teamBuild.units[editingUnitIndex].bloodlineId)"
      @close="closeModuleEditor"
      @update="onModuleUpdate"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { TeamBuild, UnitBuild } from '../game/teamSystem'
import type { AssetInventory, WeaponInstance } from '../game/assetInventory'
import type { BloodlineDef, WeaponDef, GeneDef, ToolDef } from '../game/schema'
import type { SlotModule } from '../game/slotModules'
import type { TeamSlot } from '../game/teamStorage'
import {
  createEmptyTeamBuild,
  setUnitBloodline,
  equipWeaponInstance,
  unequipWeaponInstance,
  equipGene,
  unequipGene as unequipGeneFromUnit,
  equipTool,
  unequipTool as unequipToolFromUnit,
  validateUnitBuild,
} from '../game/teamSystem'
import {
  createTestInventory,
  getAvailableWeapons,
  markWeaponEquipped,
  markWeaponUnequipped,
  getWeaponStats as getWeaponStatsFromInventory,
  getModuleStats as getModuleStatsFromInventory,
} from '../game/assetInventory'
import { demoBloodlines, demoWeapons, demoGenes, demoTools } from '../game/mockData'
import { allModules } from '../game/moduleDatabase'
import WeaponModuleEditor from './WeaponModuleEditor.vue'
import {
  loadTeamSlots,
  addTeamSlot,
  updateTeamSlot,
  renameTeamSlot,
  deleteTeamSlot,
  switchTeamSlot,
  canAddTeamSlot,
  getAllTeamSlots,
} from '../game/teamStorage'

// 資料
const availableBloodlines = ref<BloodlineDef[]>(demoBloodlines)
const availableWeapons = ref<WeaponDef[]>(demoWeapons)
const availableGenes = ref<GeneDef[]>(demoGenes)
const availableTools = ref<ToolDef[]>(demoTools)

// 隊伍槽位管理
const teamSlots = ref<TeamSlot[]>([])
const currentSlotId = ref<string | null>(null)
const showRenameDialog = ref(false)

// 隊伍配置
const teamBuild = ref<TeamBuild>(createEmptyTeamBuild())

// 資產庫存
const inventory = ref<AssetInventory>(
  createTestInventory(
    demoWeapons.map(w => w.id),
    allModules.map(m => m.id),
    demoGenes.map(g => g.id),
    demoTools.map(t => t.id)
  )
)

// UI 狀態
const currentTab = ref<'team' | 'assets'>('team')
const moduleFilter = ref<'all' | 'tempo' | 'tactical' | 'enchant'>('all')

// 選擇器狀態
const showWeaponSelector = ref(false)
const showGeneSelector = ref(false)
const showToolSelector = ref(false)
const showModuleEditor = ref(false)

const currentUnitIndex = ref<number>(0)
const currentGeneType = ref<'exclusive' | 'generic'>('exclusive')

const editingUnitIndex = ref<number>(0)
const editingWeaponInstanceId = ref<string>('')
const editingWeaponId = ref<string>('')

// 輔助函數
function getBloodline(bloodlineId: string | null): BloodlineDef | null {
  if (!bloodlineId) return null
  return availableBloodlines.value.find(b => b.id === bloodlineId) || null
}

function getWeaponName(weaponId: string): string {
  return availableWeapons.value.find(w => w.id === weaponId)?.name || '未知'
}

function getGeneName(geneId: string): string {
  return availableGenes.value.find(g => g.id === geneId)?.name || '未知'
}

function getToolName(toolId: string): string {
  return availableTools.value.find(t => t.id === toolId)?.name || '未知'
}

function getBloodlineImage(bloodlineId: string | null): string {
  if (!bloodlineId) return ''
  const imageMap: Record<string, string> = {
    'cert_wolf_guard': '/assets/bloodlines/wolf_guard.jpg',
    'cert_moth_oracle': '/assets/bloodlines/moth_oracle.jpg',
    'cert_slime_gel': '/assets/bloodlines/slime_gel.jpg',
  }
  return imageMap[bloodlineId] || ''
}

function canEquipWeapon(bloodline: BloodlineDef, weapon: WeaponDef): boolean {
  // 檢查必需標籤
  const hasAllRequiredTags = weapon.requiredTags.every(tag => 
    bloodline.raceTags.includes(tag)
  )
  return hasAllRequiredTags
}

function getExclusiveGenes(unit: UnitBuild): string[] {
  const bloodline = getBloodline(unit.bloodlineId)
  if (!bloodline) return []
  return unit.equippedGeneIds.filter(id => bloodline.exclusiveGeneOptions.includes(id))
}

function getGenericGenes(unit: UnitBuild): string[] {
  const bloodline = getBloodline(unit.bloodlineId)
  if (!bloodline) return []
  return unit.equippedGeneIds.filter(id => !bloodline.exclusiveGeneOptions.includes(id))
}

function getExclusiveGeneCount(unit: UnitBuild): number {
  return getExclusiveGenes(unit).length
}

function getGenericGeneCount(unit: UnitBuild): number {
  return getGenericGenes(unit).length
}

function getValidation(unitIndex: number) {
  const unit = teamBuild.value.units[unitIndex]
  const bloodline = getBloodline(unit.bloodlineId)
  return validateUnitBuild(unit, bloodline)
}

const filteredModules = computed(() => {
  if (moduleFilter.value === 'all') return allModules
  return allModules.filter(m => m.slotType === moduleFilter.value)
})

function getModulesByType(type: 'tempo' | 'tactical' | 'enchant'): SlotModule[] {
  return allModules.filter(m => m.slotType === type)
}

function getWeaponStats(weaponId: string) {
  return getWeaponStatsFromInventory(inventory.value, weaponId)
}

function getModuleStats(moduleId: string) {
  return getModuleStatsFromInventory(inventory.value, moduleId)
}

// 血統卡操作
function onBloodlineChange(unitIndex: number) {
  const unit = teamBuild.value.units[unitIndex]
  teamBuild.value.units[unitIndex] = setUnitBloodline(unit, unit.bloodlineId)
}

function clearUnit(unitIndex: number) {
  const unit = teamBuild.value.units[unitIndex]
  
  // 卸下所有武器
  unit.equippedWeapons.forEach(w => {
    inventory.value = markWeaponUnequipped(inventory.value, w.instanceId)
  })
  
  teamBuild.value.units[unitIndex] = setUnitBloodline(unit, null)
}

// 武器操作
function openWeaponSelector(unitIndex: number) {
  currentUnitIndex.value = unitIndex
  showWeaponSelector.value = true
}

function closeWeaponSelector() {
  showWeaponSelector.value = false
}

function getAvailableWeaponInstances(): WeaponInstance[] {
  const unitIndex = currentUnitIndex.value
  const unit = teamBuild.value.units[unitIndex]
  const bloodline = getBloodline(unit.bloodlineId)
  
  if (!bloodline) return []
  
  // 篩選可裝備的武器實例
  const allAvailable = getAvailableWeapons(inventory.value)
  return allAvailable.filter(instance => {
    const weapon = availableWeapons.value.find(w => w.id === instance.weaponId)
    return weapon && canEquipWeapon(bloodline, weapon)
  })
}

function selectWeapon(weaponInstance: WeaponInstance) {
  const unitIndex = currentUnitIndex.value
  const unit = teamBuild.value.units[unitIndex]
  const bloodline = getBloodline(unit.bloodlineId)
  
  if (!bloodline) return
  
  // 再次檢查武器條件
  const weapon = availableWeapons.value.find(w => w.id === weaponInstance.weaponId)
  if (!weapon || !canEquipWeapon(bloodline, weapon)) {
    alert(`此武器不符合血統卡條件！需要標籤: ${weapon?.requiredTags.join(', ')}`)
    return
  }
  
  const result = equipWeaponInstance(unit, weaponInstance.instanceId, weaponInstance.weaponId, bloodline)
  
  if (result.success && result.unit) {
    teamBuild.value.units[unitIndex] = result.unit
    inventory.value = markWeaponEquipped(inventory.value, weaponInstance.instanceId, unit.id)
    closeWeaponSelector()
  } else {
    alert(result.error)
  }
}

function unequipWeapon(unitIndex: number, weaponInstanceId: string) {
  const unit = teamBuild.value.units[unitIndex]
  teamBuild.value.units[unitIndex] = unequipWeaponInstance(unit, weaponInstanceId)
  inventory.value = markWeaponUnequipped(inventory.value, weaponInstanceId)
}

// 基因操作
function openGeneSelector(unitIndex: number, geneType: 'exclusive' | 'generic') {
  currentUnitIndex.value = unitIndex
  currentGeneType.value = geneType
  showGeneSelector.value = true
}

function closeGeneSelector() {
  showGeneSelector.value = false
}

function getAvailableGenesForSelector(): GeneDef[] {
  const unitIndex = currentUnitIndex.value
  const unit = teamBuild.value.units[unitIndex]
  const bloodline = getBloodline(unit.bloodlineId)
  
  if (!bloodline) return []
  
  if (currentGeneType.value === 'exclusive') {
    return availableGenes.value.filter(g => bloodline.exclusiveGeneOptions.includes(g.id))
  } else {
    return availableGenes.value.filter(g => g.geneType === 'generic')
  }
}

function selectGene(geneId: string) {
  const unitIndex = currentUnitIndex.value
  const unit = teamBuild.value.units[unitIndex]
  const bloodline = getBloodline(unit.bloodlineId)
  const gene = availableGenes.value.find(g => g.id === geneId)
  
  if (!bloodline || !gene) return
  
  const result = equipGene(unit, geneId, bloodline, gene)
  
  if (result.success && result.unit) {
    teamBuild.value.units[unitIndex] = result.unit
    closeGeneSelector()
  } else {
    alert(result.error)
  }
}

function unequipGene(unitIndex: number, geneId: string) {
  const unit = teamBuild.value.units[unitIndex]
  teamBuild.value.units[unitIndex] = unequipGeneFromUnit(unit, geneId)
}

// 工具操作
function openToolSelector(unitIndex: number) {
  currentUnitIndex.value = unitIndex
  showToolSelector.value = true
}

function closeToolSelector() {
  showToolSelector.value = false
}

function selectTool(toolId: string) {
  const unitIndex = currentUnitIndex.value
  const unit = teamBuild.value.units[unitIndex]
  const bloodline = getBloodline(unit.bloodlineId)
  
  if (!bloodline) return
  
  const result = equipTool(unit, toolId, bloodline)
  
  if (result.success && result.unit) {
    teamBuild.value.units[unitIndex] = result.unit
    closeToolSelector()
  } else {
    alert(result.error)
  }
}

function unequipTool(unitIndex: number, toolId: string) {
  const unit = teamBuild.value.units[unitIndex]
  teamBuild.value.units[unitIndex] = unequipToolFromUnit(unit, toolId)
}

// 武器插槽編輯
function openWeaponModuleEditor(unitIndex: number, weaponInstanceId: string) {
  const unit = teamBuild.value.units[unitIndex]
  const weapon = unit.equippedWeapons.find(w => w.instanceId === weaponInstanceId)
  
  if (!weapon) return
  
  editingUnitIndex.value = unitIndex
  editingWeaponInstanceId.value = weaponInstanceId
  editingWeaponId.value = weapon.weaponId
  showModuleEditor.value = true
}

function closeModuleEditor() {
  showModuleEditor.value = false
}

function onModuleUpdate(updatedTeamBuild: TeamBuild, updatedInventory: AssetInventory) {
  teamBuild.value = updatedTeamBuild
  inventory.value = updatedInventory
}

// 儲存隊伍
// 隊伍槽位管理函數
const canAddSlot = computed(() => canAddTeamSlot())

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  
  if (minutes < 1) return '剛剛'
  if (minutes < 60) return `${minutes}分鐘前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小時前`
  const days = Math.floor(hours / 24)
  return `${days}天前`
}

function loadSlots() {
  const slotList = loadTeamSlots()
  teamSlots.value = slotList.slots
  currentSlotId.value = slotList.currentSlotId
  
  // 如果沒有槽位，創建預設槽位
  if (teamSlots.value.length === 0) {
    createNewSlot()
  } else if (currentSlotId.value) {
    // 載入當前槽位的隊伍
    const currentSlot = teamSlots.value.find(s => s.id === currentSlotId.value)
    if (currentSlot) {
      teamBuild.value = currentSlot.teamBuild
      inventory.value = currentSlot.inventory
    }
  }
}

function createNewSlot() {
  const slotNumber = teamSlots.value.length + 1
  const newSlotList = addTeamSlot(
    `隊伍 ${slotNumber}`,
    createEmptyTeamBuild(),
    createTestInventory(
      demoWeapons.map(w => w.id),
      allModules.map(m => m.id),
      demoGenes.map(g => g.id),
      demoTools.map(t => t.id)
    )
  )
  
  teamSlots.value = newSlotList.slots
  currentSlotId.value = newSlotList.currentSlotId
  
  // 載入新槽位
  const newSlot = teamSlots.value.find(s => s.id === currentSlotId.value)
  if (newSlot) {
    teamBuild.value = newSlot.teamBuild
    inventory.value = newSlot.inventory
  }
}

function switchSlot(slotId: string) {
  const slotList = switchTeamSlot(slotId)
  currentSlotId.value = slotList.currentSlotId
  
  const slot = teamSlots.value.find(s => s.id === slotId)
  if (slot) {
    teamBuild.value = slot.teamBuild
    inventory.value = slot.inventory
  }
}

function saveCurrentSlot() {
  if (!currentSlotId.value) return
  
  const slotList = updateTeamSlot(currentSlotId.value, teamBuild.value, inventory.value)
  teamSlots.value = slotList.slots
  alert('隊伍已儲存！')
}

function deleteCurrentSlot() {
  if (!currentSlotId.value || teamSlots.value.length <= 1) return
  
  if (!confirm('確定要刪除這個隊伍槽位嗎？')) return
  
  const slotList = deleteTeamSlot(currentSlotId.value)
  teamSlots.value = slotList.slots
  currentSlotId.value = slotList.currentSlotId
  
  // 載入新的當前槽位
  if (currentSlotId.value) {
    const slot = teamSlots.value.find(s => s.id === currentSlotId.value)
    if (slot) {
      teamBuild.value = slot.teamBuild
      inventory.value = slot.inventory
    }
  }
}

function renameCurrentSlot() {
  if (!currentSlotId.value) return
  
  const newName = prompt('輸入新名稱:', teamBuild.value.name)
  if (!newName) return
  
  const slotList = renameTeamSlot(currentSlotId.value, newName)
  teamSlots.value = slotList.slots
  teamBuild.value.name = newName
  showRenameDialog.value = false
}

function saveTeam() {
  saveCurrentSlot()
}

onMounted(() => {
  loadSlots()
  console.log('📊 資產庫存:', inventory.value)
  console.log('🎮 隊伍配置:', teamBuild.value)
})
</script>

<style scoped>
.team-builder {
  padding: 20px;
  max-width: 1600px;
  margin: 0 auto;
}

h1 {
  margin-bottom: 20px;
}

/* 頁簽 */
.tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  border-bottom: 2px solid #ddd;
}

.tab {
  padding: 12px 24px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 1em;
  border-bottom: 3px solid transparent;
  transition: all 0.2s;
}

.tab:hover {
  background: #f5f5f5;
}

.tab.active {
  border-bottom-color: #4CAF50;
  font-weight: bold;
}

/* 隊伍槽位管理 */
.team-slots {
  margin-bottom: 25px;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: white;
}

.slot-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
  flex-wrap: wrap;
}

.slot-tab {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.15);
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  color: white;
  font-size: 1em;
  transition: all 0.2s;
  backdrop-filter: blur(10px);
}

.slot-tab:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: translateY(-2px);
}

.slot-tab.active {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.6);
  font-weight: bold;
}

.slot-tab.slot-add {
  background: rgba(76, 175, 80, 0.3);
  border: 2px dashed rgba(255, 255, 255, 0.5);
}

.slot-tab.slot-add:hover {
  background: rgba(76, 175, 80, 0.5);
}

.slot-modified {
  font-size: 0.75em;
  opacity: 0.8;
  margin-top: 4px;
}

.slot-actions {
  display: flex;
  gap: 10px;
}

.btn-action {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
  transition: all 0.2s;
}

.btn-action:hover {
  background: rgba(255, 255, 255, 0.3);
}

.btn-danger {
  padding: 8px 16px;
  background: rgba(244, 67, 54, 0.3);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
  transition: all 0.2s;
}

.btn-danger:hover:not(:disabled) {
  background: rgba(244, 67, 54, 0.5);
}

.btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 隊伍頁 */
.team-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.team-name-input {
  font-size: 1.2em;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  flex: 1;
  max-width: 400px;
}

.btn-save {
  padding: 10px 20px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1em;
}

.units-grid {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.unit-card {
  border: 2px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  background: white;
  width: 100%;
}

.unit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.unit-header h2 {
  margin: 0;
}

.btn-clear {
  padding: 6px 12px;
  background: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.bloodline-section,
.equipment-section {
  margin-bottom: 20px;
}

.equipment-section > * {
  max-width: 100%;
}

.bloodline-section h3,
.equipment-section h3 {
  margin: 0 0 10px 0;
  font-size: 1.1em;
}

.bloodline-select {
  width: 100%;
  max-width: 400px;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1em;
  margin-bottom: 15px;
}

.bloodline-detail {
  display: flex;
  gap: 20px;
  padding: 15px;
  background: #f9f9f9;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.bloodline-image {
  width: 150px;
  height: 150px;
  object-fit: cover;
  border-radius: 8px;
  border: 2px solid #ddd;
}

.bloodline-stats {
  flex: 1;
}

.bloodline-stats h4 {
  margin: 0 0 10px 0;
  font-size: 1.2em;
  color: #333;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
  margin-bottom: 12px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  background: white;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.stat-label {
  font-size: 0.75em;
  color: #666;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 1.3em;
  font-weight: bold;
  color: #2196F3;
}

.slot-info {
  display: flex;
  gap: 15px;
  margin-bottom: 10px;
  font-size: 0.9em;
  color: #555;
}

.race-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.race-tags .tag {
  padding: 4px 10px;
  background: #e3f2fd;
  border-radius: 12px;
  font-size: 0.8em;
  color: #1976d2;
}

.equipped-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}

.equipped-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background: #f9f9f9;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.instance-id {
  font-size: 0.75em;
  color: #666;
}

.item-actions {
  display: flex;
  gap: 8px;
}

.btn-edit,
.btn-remove {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
}

.btn-edit {
  background: #2196F3;
  color: white;
}

.btn-remove {
  background: #f44336;
  color: white;
}

.btn-add {
  width: 100%;
  padding: 10px;
  border: 1px dashed #999;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.95em;
}

.btn-add:hover {
  background: #f5f5f5;
}

.gene-category {
  margin-bottom: 15px;
}

.gene-category h4 {
  margin: 0 0 8px 0;
  font-size: 0.95em;
  color: #666;
}

.equipped-item-small {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #e3f2fd;
  border-radius: 16px;
  font-size: 0.9em;
  margin-right: 8px;
  margin-bottom: 8px;
}

.btn-remove-small {
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 1.1em;
  padding: 0;
  line-height: 1;
}

.btn-add-small {
  padding: 6px 12px;
  border: 1px dashed #999;
  background: white;
  border-radius: 16px;
  cursor: pointer;
  font-size: 0.85em;
}

.validation {
  margin-top: 15px;
  padding: 10px;
  border-radius: 4px;
}

.errors p {
  color: #d32f2f;
  margin: 4px 0;
  font-size: 0.9em;
}

.warnings p {
  color: #f57c00;
  margin: 4px 0;
  font-size: 0.9em;
}

.success {
  color: #2e7d32;
  font-weight: bold;
}

/* 資產頁 */
.assets-page h2 {
  margin-bottom: 20px;
}

.asset-section {
  margin-bottom: 40px;
}

.asset-section h3 {
  margin-bottom: 15px;
  font-size: 1.3em;
}

.module-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.module-tab {
  padding: 8px 16px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.module-tab:hover {
  background: #f5f5f5;
}

.module-tab.active {
  background: #4CAF50;
  color: white;
  border-color: #4CAF50;
}

.asset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 15px;
}

.asset-card {
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
  transition: all 0.2s;
}

.asset-card:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.asset-card h4 {
  margin: 0 0 8px 0;
}

.description {
  font-size: 0.9em;
  color: #666;
  margin: 8px 0;
}

.stats {
  display: flex;
  gap: 10px;
  margin: 8px 0;
  font-size: 0.85em;
}

.stats span {
  padding: 4px 8px;
  background: #f5f5f5;
  border-radius: 4px;
}

.inventory-count {
  margin-top: 10px;
  padding: 6px;
  background: #e8f5e9;
  border-radius: 4px;
  font-size: 0.85em;
  text-align: center;
}

.module-card .module-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.rarity {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75em;
  font-weight: bold;
  text-transform: uppercase;
}

.rarity.common {
  background: #e0e0e0;
  color: #666;
}

.rarity.rare {
  background: #bbdefb;
  color: #1976d2;
}

.rarity.epic {
  background: #e1bee7;
  color: #7b1fa2;
}

.rarity.legendary {
  background: #ffecb3;
  color: #f57c00;
}

.gene-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.gene-type {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75em;
  font-weight: bold;
}

.gene-type.exclusive {
  background: #ffcdd2;
  color: #c62828;
}

.gene-type.generic {
  background: #c8e6c9;
  color: #2e7d32;
}

.compatible {
  font-size: 0.85em;
  color: #666;
  margin-top: 8px;
}

/* 彈窗 */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 30px;
  border-radius: 12px;
  max-width: 800px;
  max-height: 80vh;
  overflow-y: auto;
  min-width: 500px;
}

.modal-content h3 {
  margin: 0 0 20px 0;
}

.selector-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.selector-item {
  padding: 15px;
  border: 2px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.selector-item:hover {
  border-color: #4CAF50;
  background: #f5f5f5;
}

.selector-item h4 {
  margin: 0 0 8px 0;
}

.selector-item p {
  margin: 0;
  font-size: 0.9em;
  color: #666;
}

.btn-close {
  padding: 10px 20px;
  background: #999;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1em;
}
</style>

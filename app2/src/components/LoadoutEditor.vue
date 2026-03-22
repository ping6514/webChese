<template>
  <div class="loadout-editor">
    <!-- 配裝列表 -->
    <div class="loadout-list">
      <div class="loadout-header">
        <h2>我的配裝</h2>
        <button @click="createNewLoadout" class="btn-primary">
          + 新增配裝
        </button>
      </div>
      
      <div class="loadout-items">
        <div
          v-for="loadout in loadouts"
          :key="loadout.id"
          class="loadout-item"
          :class="{ active: loadout.id === activeLoadoutId }"
          @click="selectLoadout(loadout.id)"
        >
          <div class="loadout-info">
            <h3>{{ loadout.name }}</h3>
            <p class="bloodline-name">{{ getBloodlineName(loadout.bloodlineId) }}</p>
            <p class="update-time">{{ formatTime(loadout.updatedAt) }}</p>
          </div>
          <div class="loadout-actions">
            <button @click.stop="duplicateLoadout(loadout.id)" title="複製">📋</button>
            <button @click.stop="exportLoadout(loadout.id)" title="匯出">💾</button>
            <button @click.stop="deleteLoadout(loadout.id)" title="刪除">🗑️</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 配裝編輯器 -->
    <div v-if="currentLoadout" class="loadout-detail">
      <!-- 配裝名稱 -->
      <div class="loadout-name-editor">
        <input
          v-model="currentLoadout.name"
          @blur="saveCurrentLoadout"
          placeholder="配裝名稱"
          class="loadout-name-input"
        />
      </div>

      <!-- 血統卡選擇 -->
      <div class="section">
        <h3>血統卡</h3>
        <select
          v-model="currentLoadout.bloodlineId"
          @change="onBloodlineChange"
          class="bloodline-select"
        >
          <option v-for="bloodline in availableBloodlines" :key="bloodline.id" :value="bloodline.id">
            {{ bloodline.name }} ({{ bloodline.family }})
          </option>
        </select>
        
        <div v-if="selectedBloodline" class="bloodline-stats">
          <p>武器欄位: {{ selectedBloodline.weaponSlots }}</p>
          <p>專用基因: 1 / {{ selectedBloodline.exclusiveGeneOptions.length }}</p>
          <p>通用基因: {{ selectedBloodline.genericGeneSlots }}</p>
          <p>工具欄位: {{ selectedBloodline.toolSlots }}</p>
        </div>
      </div>

      <!-- 武器裝備 -->
      <div class="section">
        <h3>武器裝備 ({{ currentLoadout.equippedWeapons.length }}/{{ selectedBloodline?.weaponSlots || 0 }})</h3>
        
        <div class="equipped-weapons">
          <div
            v-for="(equippedWeapon, index) in currentLoadout.equippedWeapons"
            :key="equippedWeapon.weaponId"
            class="equipped-weapon"
          >
            <div class="weapon-header">
              <h4>{{ getWeaponName(equippedWeapon.weaponId) }}</h4>
              <button @click="unequipWeapon(equippedWeapon.weaponId)" class="btn-remove">卸下</button>
            </div>
            
            <!-- 插槽模組 -->
            <div class="weapon-slots">
              <!-- Tempo 插槽 -->
              <div class="slot-section">
                <h5>⚡ 時序孔 ({{ equippedWeapon.slotConfig.tempoModules.length }}/{{ getWeaponSlotProfile(equippedWeapon.weaponId).tempo }})</h5>
                <div class="modules">
                  <div
                    v-for="moduleId in equippedWeapon.slotConfig.tempoModules"
                    :key="moduleId"
                    class="module-chip"
                  >
                    {{ getModuleName(moduleId) }}
                    <button @click="unequipModule(equippedWeapon.weaponId, moduleId, 'tempo')" class="btn-chip-remove">×</button>
                  </div>
                  <button
                    v-if="equippedWeapon.slotConfig.tempoModules.length < getWeaponSlotProfile(equippedWeapon.weaponId).tempo"
                    @click="openModuleSelector(equippedWeapon.weaponId, 'tempo')"
                    class="btn-add-module"
                  >
                    + 添加
                  </button>
                </div>
              </div>

              <!-- Tactical 插槽 -->
              <div class="slot-section">
                <h5>⚔️ 戰術孔 ({{ equippedWeapon.slotConfig.tacticalModules.length }}/{{ getWeaponSlotProfile(equippedWeapon.weaponId).tactical }})</h5>
                <div class="modules">
                  <div
                    v-for="moduleId in equippedWeapon.slotConfig.tacticalModules"
                    :key="moduleId"
                    class="module-chip"
                  >
                    {{ getModuleName(moduleId) }}
                    <button @click="unequipModule(equippedWeapon.weaponId, moduleId, 'tactical')" class="btn-chip-remove">×</button>
                  </div>
                  <button
                    v-if="equippedWeapon.slotConfig.tacticalModules.length < getWeaponSlotProfile(equippedWeapon.weaponId).tactical"
                    @click="openModuleSelector(equippedWeapon.weaponId, 'tactical')"
                    class="btn-add-module"
                  >
                    + 添加
                  </button>
                </div>
              </div>

              <!-- Enchant 插槽 -->
              <div class="slot-section">
                <h5>🔮 附魔孔 ({{ equippedWeapon.slotConfig.enchantModules.length }}/{{ getWeaponSlotProfile(equippedWeapon.weaponId).enchant }})</h5>
                <div class="modules">
                  <div
                    v-for="moduleId in equippedWeapon.slotConfig.enchantModules"
                    :key="moduleId"
                    class="module-chip"
                  >
                    {{ getModuleName(moduleId) }}
                    <button @click="unequipModule(equippedWeapon.weaponId, moduleId, 'enchant')" class="btn-chip-remove">×</button>
                  </div>
                  <button
                    v-if="equippedWeapon.slotConfig.enchantModules.length < getWeaponSlotProfile(equippedWeapon.weaponId).enchant"
                    @click="openModuleSelector(equippedWeapon.weaponId, 'enchant')"
                    class="btn-add-module"
                  >
                    + 添加
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 添加武器按鈕 -->
        <button
          v-if="currentLoadout.equippedWeapons.length < (selectedBloodline?.weaponSlots || 0)"
          @click="openWeaponSelector"
          class="btn-add-weapon"
        >
          + 添加武器
        </button>
      </div>

      <!-- 基因裝備 -->
      <div class="section">
        <h3>基因強化</h3>
        <div class="gene-slots">
          <div class="gene-category">
            <h4>專用基因 ({{ getExclusiveGeneCount() }}/1)</h4>
            <div class="genes">
              <div
                v-for="geneId in getExclusiveGenes()"
                :key="geneId"
                class="gene-chip"
              >
                {{ getGeneName(geneId) }}
                <button @click="unequipGene(geneId)" class="btn-chip-remove">×</button>
              </div>
              <button
                v-if="getExclusiveGeneCount() < 1"
                @click="openGeneSelector('exclusive')"
                class="btn-add-gene"
              >
                + 添加
              </button>
            </div>
          </div>

          <div class="gene-category">
            <h4>通用基因 ({{ getGenericGeneCount() }}/{{ selectedBloodline?.genericGeneSlots || 0 }})</h4>
            <div class="genes">
              <div
                v-for="geneId in getGenericGenes()"
                :key="geneId"
                class="gene-chip"
              >
                {{ getGeneName(geneId) }}
                <button @click="unequipGene(geneId)" class="btn-chip-remove">×</button>
              </div>
              <button
                v-if="getGenericGeneCount() < (selectedBloodline?.genericGeneSlots || 0)"
                @click="openGeneSelector('generic')"
                class="btn-add-gene"
              >
                + 添加
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 工具裝備 -->
      <div class="section">
        <h3>戰術工具 ({{ currentLoadout.equippedToolIds.length }}/{{ selectedBloodline?.toolSlots || 0 }})</h3>
        <div class="tools">
          <div
            v-for="toolId in currentLoadout.equippedToolIds"
            :key="toolId"
            class="tool-chip"
          >
            {{ getToolName(toolId) }}
            <button @click="unequipTool(toolId)" class="btn-chip-remove">×</button>
          </div>
          <button
            v-if="currentLoadout.equippedToolIds.length < (selectedBloodline?.toolSlots || 0)"
            @click="openToolSelector"
            class="btn-add-tool"
          >
            + 添加
          </button>
        </div>
      </div>

      <!-- 驗證結果 -->
      <div v-if="validationResult" class="validation-result">
        <div v-if="validationResult.errors.length > 0" class="errors">
          <h4>❌ 錯誤</h4>
          <ul>
            <li v-for="(error, i) in validationResult.errors" :key="i">{{ error }}</li>
          </ul>
        </div>
        <div v-if="validationResult.warnings.length > 0" class="warnings">
          <h4>⚠️ 警告</h4>
          <ul>
            <li v-for="(warning, i) in validationResult.warnings" :key="i">{{ warning }}</li>
          </ul>
        </div>
        <div v-if="validationResult.valid" class="success">
          ✅ 配裝驗證通過
        </div>
      </div>
    </div>

    <!-- 選擇器彈窗（簡化版，實際需要更完整的 UI） -->
    <div v-if="showSelector" class="selector-modal" @click="closeSelector">
      <div class="selector-content" @click.stop>
        <h3>{{ selectorTitle }}</h3>
        <div class="selector-items">
          <div
            v-for="item in selectorItems"
            :key="item.id"
            class="selector-item"
            @click="selectItem(item)"
          >
            <h4>{{ item.name }}</h4>
            <p>{{ item.description || '' }}</p>
          </div>
        </div>
        <button @click="closeSelector" class="btn-close">關閉</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { Loadout } from '../game/loadoutSystem'
import type { BloodlineDef, WeaponDef, GeneDef, ToolDef } from '../game/schema'
import type { SlotModule } from '../game/slotModules'
import {
  createLoadout,
  validateLoadout,
  equipWeapon as equipWeaponFn,
  unequipWeapon as unequipWeaponFn,
  equipModuleToWeapon,
  unequipModuleFromWeapon,
  equipGene as equipGeneFn,
  unequipGene as unequipGeneFn,
  equipTool as equipToolFn,
  unequipTool as unequipToolFn,
} from '../game/loadoutSystem'
import {
  loadAllLoadouts,
  addLoadout,
  updateLoadout,
  deleteLoadout as deleteLoadoutFn,
  duplicateLoadout as duplicateLoadoutFn,
  exportLoadout as exportLoadoutFn,
  setActiveLoadout,
} from '../game/loadoutStorage'

// 資料（需要從外部傳入或從 store 取得）
const availableBloodlines = ref<BloodlineDef[]>([])
const availableWeapons = ref<WeaponDef[]>([])
const availableGenes = ref<GeneDef[]>([])
const availableTools = ref<ToolDef[]>([])
const availableModules = ref<SlotModule[]>([])

// 配裝列表
const loadouts = ref<Loadout[]>([])
const activeLoadoutId = ref<string | null>(null)
const currentLoadout = ref<Loadout | null>(null)

// 選擇器狀態
const showSelector = ref(false)
const selectorType = ref<'weapon' | 'module' | 'gene' | 'tool'>('weapon')
const selectorTitle = ref('')
const selectorItems = ref<any[]>([])
const selectorContext = ref<any>(null)

// 計算屬性
const selectedBloodline = computed(() => {
  if (!currentLoadout.value) return null
  return availableBloodlines.value.find(b => b.id === currentLoadout.value!.bloodlineId) || null
})

const validationResult = computed(() => {
  if (!currentLoadout.value || !selectedBloodline.value) return null
  
  return validateLoadout(
    currentLoadout.value,
    selectedBloodline.value,
    availableWeapons.value,
    availableGenes.value,
    availableTools.value,
    availableModules.value,
  )
})

// 載入配裝
function loadLoadouts() {
  const collection = loadAllLoadouts()
  loadouts.value = collection.loadouts
  activeLoadoutId.value = collection.activeLoadoutId
  
  if (activeLoadoutId.value) {
    currentLoadout.value = loadouts.value.find(l => l.id === activeLoadoutId.value) || null
  }
}

// 創建新配裝
function createNewLoadout() {
  const name = prompt('請輸入配裝名稱')
  if (!name) return
  
  const bloodlineId = availableBloodlines.value[0]?.id
  if (!bloodlineId) {
    alert('沒有可用的血統卡')
    return
  }
  
  const newLoadout = createLoadout(name, bloodlineId)
  const result = addLoadout(newLoadout)
  
  if (result.success) {
    loadLoadouts()
    selectLoadout(newLoadout.id)
  } else {
    alert(result.error)
  }
}

// 選擇配裝
function selectLoadout(loadoutId: string) {
  currentLoadout.value = loadouts.value.find(l => l.id === loadoutId) || null
  setActiveLoadout(loadoutId)
  activeLoadoutId.value = loadoutId
}

// 儲存當前配裝
function saveCurrentLoadout() {
  if (!currentLoadout.value) return
  updateLoadout(currentLoadout.value)
}

// 血統卡變更
function onBloodlineChange() {
  // 清空所有裝備
  if (currentLoadout.value) {
    currentLoadout.value.equippedWeapons = []
    currentLoadout.value.equippedGeneIds = []
    currentLoadout.value.equippedToolIds = []
    saveCurrentLoadout()
  }
}

// 輔助函數
function getBloodlineName(bloodlineId: string): string {
  return availableBloodlines.value.find(b => b.id === bloodlineId)?.name || '未知'
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

function getModuleName(moduleId: string): string {
  return availableModules.value.find(m => m.id === moduleId)?.name || '未知'
}

function getWeaponSlotProfile(weaponId: string) {
  const weapon = availableWeapons.value.find(w => w.id === weaponId)
  return weapon?.slotProfile || { tempo: 0, tactical: 0, enchant: 0 }
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-TW')
}

function getExclusiveGenes(): string[] {
  if (!currentLoadout.value || !selectedBloodline.value) return []
  return currentLoadout.value.equippedGeneIds.filter(id =>
    selectedBloodline.value!.exclusiveGeneOptions.includes(id)
  )
}

function getGenericGenes(): string[] {
  if (!currentLoadout.value || !selectedBloodline.value) return []
  return currentLoadout.value.equippedGeneIds.filter(id =>
    !selectedBloodline.value!.exclusiveGeneOptions.includes(id)
  )
}

function getExclusiveGeneCount(): number {
  return getExclusiveGenes().length
}

function getGenericGeneCount(): number {
  return getGenericGenes().length
}

// 武器操作
function openWeaponSelector() {
  selectorType.value = 'weapon'
  selectorTitle.value = '選擇武器'
  selectorItems.value = availableWeapons.value
  showSelector.value = true
}

function unequipWeapon(weaponId: string) {
  if (!currentLoadout.value) return
  currentLoadout.value = unequipWeaponFn(currentLoadout.value, weaponId)
  saveCurrentLoadout()
}

// 模組操作
function openModuleSelector(weaponId: string, slotType: 'tempo' | 'tactical' | 'enchant') {
  selectorType.value = 'module'
  selectorTitle.value = `選擇${slotType === 'tempo' ? '時序' : slotType === 'tactical' ? '戰術' : '附魔'}模組`
  selectorItems.value = availableModules.value.filter(m => m.slotType === slotType)
  selectorContext.value = { weaponId, slotType }
  showSelector.value = true
}

function unequipModule(weaponId: string, moduleId: string, slotType: 'tempo' | 'tactical' | 'enchant') {
  if (!currentLoadout.value) return
  currentLoadout.value = unequipModuleFromWeapon(currentLoadout.value, weaponId, moduleId, slotType)
  saveCurrentLoadout()
}

// 基因操作
function openGeneSelector(geneType: 'exclusive' | 'generic') {
  selectorType.value = 'gene'
  selectorTitle.value = `選擇${geneType === 'exclusive' ? '專用' : '通用'}基因`
  
  if (geneType === 'exclusive' && selectedBloodline.value) {
    selectorItems.value = availableGenes.value.filter(g =>
      selectedBloodline.value!.exclusiveGeneOptions.includes(g.id)
    )
  } else {
    selectorItems.value = availableGenes.value.filter(g => g.geneType === geneType)
  }
  
  selectorContext.value = { geneType }
  showSelector.value = true
}

function unequipGene(geneId: string) {
  if (!currentLoadout.value) return
  currentLoadout.value = unequipGeneFn(currentLoadout.value, geneId)
  saveCurrentLoadout()
}

// 工具操作
function openToolSelector() {
  selectorType.value = 'tool'
  selectorTitle.value = '選擇工具'
  selectorItems.value = availableTools.value
  showSelector.value = true
}

function unequipTool(toolId: string) {
  if (!currentLoadout.value) return
  currentLoadout.value = unequipToolFn(currentLoadout.value, toolId)
  saveCurrentLoadout()
}

// 選擇器操作
function selectItem(item: any) {
  if (!currentLoadout.value || !selectedBloodline.value) return
  
  if (selectorType.value === 'weapon') {
    const result = equipWeaponFn(currentLoadout.value, item.id, selectedBloodline.value)
    if (result.success && result.loadout) {
      currentLoadout.value = result.loadout
      saveCurrentLoadout()
    } else {
      alert(result.error)
    }
  } else if (selectorType.value === 'module') {
    const { weaponId, slotType } = selectorContext.value
    const weapon = availableWeapons.value.find(w => w.id === weaponId)
    if (!weapon) return
    
    const result = equipModuleToWeapon(currentLoadout.value, weaponId, item.id, slotType, weapon)
    if (result.success && result.loadout) {
      currentLoadout.value = result.loadout
      saveCurrentLoadout()
    } else {
      alert(result.error)
    }
  } else if (selectorType.value === 'gene') {
    const result = equipGeneFn(currentLoadout.value, item.id, selectedBloodline.value, item)
    if (result.success && result.loadout) {
      currentLoadout.value = result.loadout
      saveCurrentLoadout()
    } else {
      alert(result.error)
    }
  } else if (selectorType.value === 'tool') {
    const result = equipToolFn(currentLoadout.value, item.id, selectedBloodline.value)
    if (result.success && result.loadout) {
      currentLoadout.value = result.loadout
      saveCurrentLoadout()
    } else {
      alert(result.error)
    }
  }
  
  closeSelector()
}

function closeSelector() {
  showSelector.value = false
  selectorContext.value = null
}

// 配裝管理
function duplicateLoadout(loadoutId: string) {
  const name = prompt('請輸入新配裝名稱')
  if (!name) return
  
  const result = duplicateLoadoutFn(loadoutId, name)
  if (result.success) {
    loadLoadouts()
  } else {
    alert(result.error)
  }
}

function exportLoadout(loadoutId: string) {
  const json = exportLoadoutFn(loadoutId)
  if (json) {
    // 複製到剪貼簿或下載
    navigator.clipboard.writeText(json)
    alert('配裝已複製到剪貼簿')
  }
}

function deleteLoadout(loadoutId: string) {
  if (!confirm('確定要刪除此配裝？')) return
  
  const result = deleteLoadoutFn(loadoutId)
  if (result.success) {
    loadLoadouts()
  } else {
    alert(result.error)
  }
}

// 初始化
onMounted(() => {
  loadLoadouts()
  // TODO: 載入可用的血統卡、武器、基因、工具、模組資料
})
</script>

<style scoped>
.loadout-editor {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 20px;
  height: 100vh;
  padding: 20px;
}

.loadout-list {
  border-right: 1px solid #ddd;
  padding-right: 20px;
}

.loadout-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.loadout-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.loadout-item {
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.loadout-item:hover {
  background: #f5f5f5;
}

.loadout-item.active {
  border-color: #4CAF50;
  background: #e8f5e9;
}

.loadout-info h3 {
  margin: 0 0 4px 0;
}

.loadout-info p {
  margin: 2px 0;
  font-size: 0.9em;
  color: #666;
}

.loadout-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.loadout-detail {
  overflow-y: auto;
}

.section {
  margin-bottom: 30px;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.section h3 {
  margin-top: 0;
}

.equipped-weapon {
  margin-bottom: 20px;
  padding: 15px;
  background: #f9f9f9;
  border-radius: 8px;
}

.weapon-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.weapon-slots {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.slot-section h5 {
  margin: 0 0 8px 0;
}

.modules, .genes, .tools {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.module-chip, .gene-chip, .tool-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #2196F3;
  color: white;
  border-radius: 16px;
  font-size: 0.9em;
}

.btn-chip-remove {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 1.2em;
  padding: 0;
  line-height: 1;
}

.btn-add-module, .btn-add-gene, .btn-add-tool, .btn-add-weapon {
  padding: 6px 12px;
  border: 1px dashed #999;
  background: white;
  border-radius: 16px;
  cursor: pointer;
}

.validation-result {
  margin-top: 20px;
  padding: 15px;
  border-radius: 8px;
}

.errors {
  background: #ffebee;
  padding: 10px;
  margin-bottom: 10px;
  border-radius: 4px;
}

.warnings {
  background: #fff3e0;
  padding: 10px;
  margin-bottom: 10px;
  border-radius: 4px;
}

.success {
  background: #e8f5e9;
  padding: 10px;
  border-radius: 4px;
  color: #2e7d32;
}

.selector-modal {
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

.selector-content {
  background: white;
  padding: 30px;
  border-radius: 12px;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
}

.selector-items {
  display: grid;
  gap: 10px;
  margin: 20px 0;
}

.selector-item {
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.selector-item:hover {
  background: #f5f5f5;
  border-color: #4CAF50;
}

.btn-primary {
  padding: 8px 16px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-remove {
  padding: 4px 12px;
  background: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-close {
  padding: 8px 16px;
  background: #999;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 15px;
}
</style>

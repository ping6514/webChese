<template>
  <div class="loadout-test-bench">
    <h1>配裝測試台</h1>
    
    <!-- 資料摘要 -->
    <div class="data-summary">
      <h2>📊 可用資料</h2>
      <div class="summary-grid">
        <div class="summary-item">
          <span class="label">血統卡:</span>
          <span class="value">{{ dataSummary.bloodlines }}</span>
        </div>
        <div class="summary-item">
          <span class="label">武器:</span>
          <span class="value">{{ dataSummary.weapons }}</span>
        </div>
        <div class="summary-item">
          <span class="label">基因:</span>
          <span class="value">{{ dataSummary.genes }}</span>
        </div>
        <div class="summary-item">
          <span class="label">工具:</span>
          <span class="value">{{ dataSummary.tools }}</span>
        </div>
        <div class="summary-item">
          <span class="label">模組:</span>
          <span class="value">{{ dataSummary.modules.total }} (T:{{ dataSummary.modules.tempo }} / Tc:{{ dataSummary.modules.tactical }} / E:{{ dataSummary.modules.enchant }})</span>
        </div>
      </div>
    </div>

    <!-- 預設測試配裝 -->
    <div class="test-loadouts">
      <h2>🎮 預設測試配裝</h2>
      <div class="loadout-cards">
        <div
          v-for="loadout in testLoadouts"
          :key="loadout.id"
          class="loadout-card"
          :class="{ selected: selectedLoadouts.includes(loadout.id) }"
          @click="toggleLoadout(loadout.id)"
        >
          <h3>{{ loadout.name }}</h3>
          <div class="loadout-details">
            <p><strong>血統:</strong> {{ getBloodlineName(loadout.bloodlineId) }}</p>
            <p><strong>武器:</strong> {{ loadout.equippedWeapons.length }}</p>
            <p><strong>基因:</strong> {{ loadout.equippedGeneIds.length }}</p>
            <p><strong>工具:</strong> {{ loadout.equippedToolIds.length }}</p>
          </div>
          
          <!-- 武器模組詳情 -->
          <div v-if="loadout.equippedWeapons.length > 0" class="weapon-modules">
            <div v-for="weapon in loadout.equippedWeapons" :key="weapon.weaponId">
              <p class="weapon-name">{{ getWeaponName(weapon.weaponId) }}</p>
              <div class="modules-compact">
                <span v-if="weapon.slotConfig.tempoModules.length > 0" class="module-badge tempo">
                  ⚡{{ weapon.slotConfig.tempoModules.length }}
                </span>
                <span v-if="weapon.slotConfig.tacticalModules.length > 0" class="module-badge tactical">
                  ⚔️{{ weapon.slotConfig.tacticalModules.length }}
                </span>
                <span v-if="weapon.slotConfig.enchantModules.length > 0" class="module-badge enchant">
                  🔮{{ weapon.slotConfig.enchantModules.length }}
                </span>
              </div>
            </div>
          </div>
          
          <div v-if="selectedLoadouts.includes(loadout.id)" class="selected-indicator">
            ✓ 已選擇
          </div>
        </div>
      </div>
    </div>

    <!-- 配裝效果預覽 -->
    <div v-if="selectedLoadouts.length > 0" class="effect-preview">
      <h2>📋 配裝效果預覽</h2>
      <div class="preview-cards">
        <div v-for="loadoutId in selectedLoadouts" :key="loadoutId" class="preview-card">
          <h3>{{ getLoadoutName(loadoutId) }}</h3>
          <div v-if="getLoadoutSummary(loadoutId)" class="summary-content">
            <div class="bloodline-info">
              <h4>血統卡</h4>
              <p>{{ getLoadoutSummary(loadoutId)?.bloodline.name }} ({{ getLoadoutSummary(loadoutId)?.bloodline.family }})</p>
              <p>HP: {{ getLoadoutSummary(loadoutId)?.bloodline.baseHp }} → {{ getLoadoutSummary(loadoutId)?.bloodline.finalHp }}</p>
            </div>
            
            <div class="weapons-info">
              <h4>武器</h4>
              <div v-for="(weapon, idx) in getLoadoutSummary(loadoutId)?.weapons" :key="idx" class="weapon-summary">
                <p><strong>{{ weapon.weaponName }}</strong></p>
                <p>傷害: {{ weapon.baseDamage }} → {{ weapon.finalDamage }}</p>
                <p class="modules-list">模組: {{ weapon.modules.join(', ') }}</p>
              </div>
            </div>
            
            <div class="genes-info">
              <h4>基因</h4>
              <p>{{ getLoadoutSummary(loadoutId)?.genes.equipped.join(', ') }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 操作按鈕 -->
    <div class="actions">
      <button
        @click="enterBattleSandbox"
        :disabled="selectedLoadouts.length === 0"
        class="btn-primary btn-large"
      >
        🎮 進入戰鬥沙盒 ({{ selectedLoadouts.length }} 個配裝)
      </button>
      
      <button @click="clearSelection" class="btn-secondary">
        清除選擇
      </button>
      
      <button @click="openLoadoutEditor" class="btn-secondary">
        📝 打開配裝編輯器
      </button>
      
      <button @click="saveToLocalStorage" class="btn-secondary">
        💾 儲存到瀏覽器
      </button>
      
      <button @click="loadFromLocalStorage" class="btn-secondary">
        📂 從瀏覽器讀取
      </button>
    </div>

    <!-- 驗證結果 -->
    <div v-if="validationResult" class="validation-info">
      <h3>{{ validationResult.valid ? '✅ 資料驗證通過' : '❌ 資料驗證失敗' }}</h3>
      <ul v-if="validationResult.errors.length > 0">
        <li v-for="(error, i) in validationResult.errors" :key="i" class="error">{{ error }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  testLoadouts,
  demoBloodlines,
  demoWeapons,
  demoGenes,
  allModules,
  getTestDataSummary,
  validateTestData,
} from '../game/testData'
import { getLoadoutEffectSummary, createCombatUnitsFromLoadouts } from '../game/loadoutToCombat'
import { addLoadout, loadAllLoadouts } from '../game/loadoutStorage'

// 資料摘要
const dataSummary = ref(getTestDataSummary())

// 驗證結果
const validationResult = ref(validateTestData())

// 選中的配裝
const selectedLoadouts = ref<string[]>([])

// 切換配裝選擇
function toggleLoadout(loadoutId: string) {
  const index = selectedLoadouts.value.indexOf(loadoutId)
  if (index > -1) {
    selectedLoadouts.value.splice(index, 1)
  } else {
    selectedLoadouts.value.push(loadoutId)
  }
}

// 清除選擇
function clearSelection() {
  selectedLoadouts.value = []
}

// 取得血統卡名稱
function getBloodlineName(bloodlineId: string): string {
  return demoBloodlines.find(b => b.id === bloodlineId)?.name || '未知'
}

// 取得武器名稱
function getWeaponName(weaponId: string): string {
  return demoWeapons.find(w => w.id === weaponId)?.name || '未知'
}

// 取得配裝名稱
function getLoadoutName(loadoutId: string): string {
  return testLoadouts.find(l => l.id === loadoutId)?.name || '未知'
}

// 取得配裝效果摘要
function getLoadoutSummary(loadoutId: string) {
  const loadout = testLoadouts.find(l => l.id === loadoutId)
  if (!loadout) return null
  
  const bloodline = demoBloodlines.find(b => b.id === loadout.bloodlineId)
  if (!bloodline) return null
  
  return getLoadoutEffectSummary(
    loadout,
    bloodline,
    demoWeapons,
    demoGenes,
    allModules
  )
}

// 進入戰鬥沙盒
function enterBattleSandbox() {
  if (selectedLoadouts.value.length === 0) {
    alert('請至少選擇一個配裝')
    return
  }
  
  // 取得選中的配裝
  const selectedLoadoutData = testLoadouts.filter(l => 
    selectedLoadouts.value.includes(l.id)
  )
  
  // 創建戰鬥單位
  try {
    const playerUnits = createCombatUnitsFromLoadouts(
      selectedLoadoutData,
      demoBloodlines,
      demoWeapons,
      demoGenes,
      allModules,
      'player',
      { q: 0, r: 0 },
      0
    )
    
    console.log('✅ 創建戰鬥單位成功:', playerUnits)
    
    // TODO: 跳轉到戰鬥沙盒頁面
    // 暫時顯示在控制台
    alert(`成功創建 ${playerUnits.length} 個戰鬥單位！\n請查看控制台 (F12) 查看詳細資料`)
    
    // 儲存到 sessionStorage 供戰鬥沙盒使用
    sessionStorage.setItem('battleUnits', JSON.stringify(playerUnits))
    sessionStorage.setItem('selectedLoadouts', JSON.stringify(selectedLoadoutData))
    
  } catch (error) {
    console.error('創建戰鬥單位失敗:', error)
    alert('創建戰鬥單位失敗: ' + (error as Error).message)
  }
}

// 打開配裝編輯器
function openLoadoutEditor() {
  // TODO: 路由到配裝編輯器
  alert('配裝編輯器功能開發中...')
}

// 儲存到 localStorage
function saveToLocalStorage() {
  for (const loadout of testLoadouts) {
    addLoadout(loadout)
  }
  alert(`已儲存 ${testLoadouts.length} 個配裝到瀏覽器`)
}

// 從 localStorage 讀取
function loadFromLocalStorage() {
  const collection = loadAllLoadouts()
  alert(`從瀏覽器讀取到 ${collection.loadouts.length} 個配裝`)
  console.log('讀取的配裝:', collection.loadouts)
}

// 初始化
onMounted(() => {
  console.log('📊 測試資料摘要:', dataSummary.value)
  console.log('✅ 驗證結果:', validationResult.value)
})
</script>

<style scoped>
.loadout-test-bench {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

h1 {
  text-align: center;
  margin-bottom: 30px;
}

.data-summary {
  background: #f5f5f5;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 30px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-top: 15px;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  padding: 10px;
  background: white;
  border-radius: 4px;
}

.summary-item .label {
  font-weight: bold;
}

.summary-item .value {
  color: #2196F3;
}

.test-loadouts {
  margin-bottom: 30px;
}

.loadout-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  margin-top: 15px;
}

.loadout-card {
  border: 2px solid #ddd;
  border-radius: 8px;
  padding: 15px;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
}

.loadout-card:hover {
  border-color: #4CAF50;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.loadout-card.selected {
  border-color: #4CAF50;
  background: #e8f5e9;
}

.loadout-card h3 {
  margin: 0 0 10px 0;
  color: #333;
}

.loadout-details p {
  margin: 5px 0;
  font-size: 0.9em;
}

.weapon-modules {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #ddd;
}

.weapon-name {
  font-size: 0.85em;
  font-weight: bold;
  margin: 5px 0;
}

.modules-compact {
  display: flex;
  gap: 5px;
  margin-top: 5px;
}

.module-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75em;
  font-weight: bold;
}

.module-badge.tempo {
  background: #FFF3E0;
  color: #F57C00;
}

.module-badge.tactical {
  background: #E3F2FD;
  color: #1976D2;
}

.module-badge.enchant {
  background: #F3E5F5;
  color: #7B1FA2;
}

.selected-indicator {
  position: absolute;
  top: 10px;
  right: 10px;
  background: #4CAF50;
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.85em;
  font-weight: bold;
}

.effect-preview {
  margin-bottom: 30px;
  background: #f9f9f9;
  padding: 20px;
  border-radius: 8px;
}

.preview-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
  margin-top: 15px;
}

.preview-card {
  background: white;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #ddd;
}

.preview-card h3 {
  margin: 0 0 15px 0;
  color: #4CAF50;
}

.summary-content > div {
  margin-bottom: 15px;
}

.summary-content h4 {
  margin: 0 0 8px 0;
  color: #666;
  font-size: 0.9em;
  text-transform: uppercase;
}

.summary-content p {
  margin: 4px 0;
  font-size: 0.9em;
}

.weapon-summary {
  background: #f5f5f5;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 8px;
}

.modules-list {
  color: #666;
  font-size: 0.85em;
}

.actions {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
  margin-bottom: 30px;
}

.btn-primary, .btn-secondary {
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  font-size: 1em;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #4CAF50;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #45a049;
}

.btn-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.btn-large {
  padding: 15px 30px;
  font-size: 1.1em;
  font-weight: bold;
}

.btn-secondary {
  background: #2196F3;
  color: white;
}

.btn-secondary:hover {
  background: #0b7dda;
}

.validation-info {
  background: #fff3cd;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #ffc107;
}

.validation-info h3 {
  margin: 0 0 10px 0;
}

.validation-info ul {
  margin: 10px 0;
  padding-left: 20px;
}

.validation-info .error {
  color: #d32f2f;
}
</style>

<template>
  <div class="modal" @click="$emit('close')">
    <div class="modal-content weapon-module-editor" @click.stop>
      <h3>武器插槽編輯</h3>
      
      <div class="weapon-info">
        <h4>{{ weaponName }}</h4>
        <p class="instance-id">{{ weaponInstanceId }}</p>
      </div>

      <!-- 傷害試算與 ATB 屬性 -->
      <div v-if="weapon && bloodline" class="damage-calculator">
        <h4>傷害試算</h4>
        <div class="calc-grid">
          <div class="calc-item">
            <span class="calc-label">基礎傷害</span>
            <span class="calc-value">{{ weapon.baseDamage }}</span>
          </div>
          <div class="calc-item">
            <span class="calc-label">屬性縮放 ({{ weapon.statScaling }})</span>
            <span class="calc-value">{{ getStatValue(weapon.statScaling) }}</span>
          </div>
          <div class="calc-item">
            <span class="calc-label">模組傷害加成</span>
            <span class="calc-value">+{{ (moduleDamageBonus * 100).toFixed(0) }}%</span>
          </div>
          <div class="calc-item highlight">
            <span class="calc-label">預估傷害</span>
            <span class="calc-value damage">{{ calculatedDamage.toFixed(1) }}</span>
          </div>
        </div>

        <h4 style="margin-top: 15px">ATB 時序屬性</h4>
        <div class="atb-grid">
          <div class="atb-item">
            <span class="atb-label">施法時間 (Cast)</span>
            <span class="atb-value">{{ weapon.baseCast || 0 }}</span>
          </div>
          <div class="atb-item">
            <span class="atb-label">恢復時間 (Recovery)</span>
            <span class="atb-value">{{ weapon.baseRecovery || 0 }}</span>
          </div>
          <div class="atb-item">
            <span class="atb-label">打斷值 (Interrupt)</span>
            <span class="atb-value">{{ weapon.baseInterrupt || 0 }}</span>
          </div>
          <div class="atb-item">
            <span class="atb-label">時序修正 (Tempo)</span>
            <span class="atb-value tempo">{{ totalTempoMod > 0 ? '+' : '' }}{{ totalTempoMod }}</span>
          </div>
          <div class="atb-item">
            <span class="atb-label">施法倍率 (Cast Mult)</span>
            <span class="atb-value">{{ (totalCastMult * 100).toFixed(0) }}%</span>
          </div>
          <div class="atb-item">
            <span class="atb-label">最終打斷值</span>
            <span class="atb-value interrupt">{{ finalInterruptValue }}</span>
          </div>
        </div>

        <div class="weapon-mode-info">
          <div class="mode-section">
            <h5>基礎模式</h5>
            <p>傷害倍率: {{ (weapon.baseMode?.damageMult || 1) * 100 }}%</p>
          </div>
          <div class="mode-section">
            <h5>完美匹配模式</h5>
            <p>傷害倍率: {{ (weapon.perfectMatchMode?.damageMult || 1) * 100 }}%</p>
            <p v-if="weapon.perfectMatchMode?.extraStatuses">
              額外狀態: {{ weapon.perfectMatchMode.extraStatuses.join(', ') }}
            </p>
          </div>
        </div>
      </div>

      <div class="slots-container">
        <!-- Tempo 插槽 -->
        <div class="slot-section">
          <h4>⚡ 時序孔 ({{ currentSlotConfig.tempoModules.length }}/{{ slotProfile.tempo }})</h4>
          
          <div class="installed-modules">
            <div
              v-for="moduleInstanceId in currentSlotConfig.tempoModules"
              :key="moduleInstanceId"
              class="module-chip"
            >
              {{ getModuleName(moduleInstanceId) }}
              <button
                @click="uninstallModule(moduleInstanceId, 'tempo')"
                class="btn-chip-remove"
              >
                ✕
              </button>
            </div>
          </div>

          <button
            v-if="currentSlotConfig.tempoModules.length < slotProfile.tempo"
            @click="openModuleSelector('tempo')"
            class="btn-add-module"
          >
            + 添加時序模組
          </button>
        </div>

        <!-- Tactical 插槽 -->
        <div class="slot-section">
          <h4>⚔️ 戰術孔 ({{ currentSlotConfig.tacticalModules.length }}/{{ slotProfile.tactical }})</h4>
          
          <div class="installed-modules">
            <div
              v-for="moduleInstanceId in currentSlotConfig.tacticalModules"
              :key="moduleInstanceId"
              class="module-chip"
            >
              {{ getModuleName(moduleInstanceId) }}
              <button
                @click="uninstallModule(moduleInstanceId, 'tactical')"
                class="btn-chip-remove"
              >
                ✕
              </button>
            </div>
          </div>

          <button
            v-if="currentSlotConfig.tacticalModules.length < slotProfile.tactical"
            @click="openModuleSelector('tactical')"
            class="btn-add-module"
          >
            + 添加戰術模組
          </button>
        </div>

        <!-- Enchant 插槽 -->
        <div class="slot-section">
          <h4>🔮 附魔孔 ({{ currentSlotConfig.enchantModules.length }}/{{ slotProfile.enchant }})</h4>
          
          <div class="installed-modules">
            <div
              v-for="moduleInstanceId in currentSlotConfig.enchantModules"
              :key="moduleInstanceId"
              class="module-chip"
            >
              {{ getModuleName(moduleInstanceId) }}
              <button
                @click="uninstallModule(moduleInstanceId, 'enchant')"
                class="btn-chip-remove"
              >
                ✕
              </button>
            </div>
          </div>

          <button
            v-if="currentSlotConfig.enchantModules.length < slotProfile.enchant"
            @click="openModuleSelector('enchant')"
            class="btn-add-module"
          >
            + 添加附魔模組
          </button>
        </div>
      </div>

      <div class="modal-actions">
        <button @click="$emit('close')" class="btn-close">完成</button>
      </div>

      <!-- 模組選擇器 -->
      <div v-if="showModuleSelector" class="module-selector-overlay" @click="closeModuleSelector">
        <div class="module-selector" @click.stop>
          <h4>選擇{{ selectorSlotType === 'tempo' ? '時序' : selectorSlotType === 'tactical' ? '戰術' : '附魔' }}模組</h4>
          
          <div class="module-list">
            <div
              v-for="moduleInstance in availableModuleInstances"
              :key="moduleInstance.instanceId"
              class="module-item"
              @click="installModule(moduleInstance.instanceId)"
            >
              <div class="module-item-header">
                <strong>{{ getModuleNameById(moduleInstance.moduleId) }}</strong>
                <span :class="['rarity', getModuleRarity(moduleInstance.moduleId)]">
                  {{ getModuleRarity(moduleInstance.moduleId) }}
                </span>
              </div>
              <p class="module-description">{{ getModuleDescription(moduleInstance.moduleId) }}</p>
              <p class="instance-id">{{ moduleInstance.instanceId }}</p>
            </div>
          </div>

          <button @click="closeModuleSelector" class="btn-close">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { TeamBuild } from '../game/teamSystem'
import type { AssetInventory, ModuleInstance } from '../game/assetInventory'
import type { WeaponDef, BloodlineDef } from '../game/schema'
import type { SlotModule } from '../game/slotModules'
import { mergeModuleEffects } from '../game/slotModules'
import {
  installModuleToWeapon,
  uninstallModuleFromWeapon,
} from '../game/teamSystem'
import {
  getAvailableModules,
  markModuleEquipped,
  markModuleUnequipped,
} from '../game/assetInventory'

const props = defineProps<{
  weaponInstanceId: string
  weaponId: string
  unitIndex: number
  teamBuild: TeamBuild
  inventory: AssetInventory
  allWeapons: WeaponDef[]
  allModules: SlotModule[]
  bloodline: BloodlineDef | null
}>()

const emit = defineEmits<{
  close: []
  update: [teamBuild: TeamBuild, inventory: AssetInventory]
}>()

const showModuleSelector = ref(false)
const selectorSlotType = ref<'tempo' | 'tactical' | 'enchant'>('tempo')

const weapon = computed(() => {
  return props.allWeapons.find(w => w.id === props.weaponId)
})

const weaponName = computed(() => weapon.value?.name || '未知')

const slotProfile = computed(() => weapon.value?.slotProfile || { tempo: 0, tactical: 0, enchant: 0 })

const currentUnit = computed(() => props.teamBuild.units[props.unitIndex])

const currentWeapon = computed(() => {
  return currentUnit.value?.equippedWeapons.find(w => w.instanceId === props.weaponInstanceId)
})

const currentSlotConfig = computed(() => {
  return currentWeapon.value?.slotConfig || {
    tempoModules: [],
    tacticalModules: [],
    enchantModules: [],
  }
})

const availableModuleInstances = computed(() => {
  return getAvailableModules(props.inventory, selectorSlotType.value, props.allModules)
})

function getModuleName(moduleInstanceId: string): string {
  const instance = props.inventory.modules.find(m => m.instanceId === moduleInstanceId)
  if (!instance) return '未知'
  
  const module = props.allModules.find(m => m.id === instance.moduleId)
  return module?.name || '未知'
}

function getModuleNameById(moduleId: string): string {
  return props.allModules.find(m => m.id === moduleId)?.name || '未知'
}

function getModuleDescription(moduleId: string): string {
  return props.allModules.find(m => m.id === moduleId)?.description || ''
}

function getModuleRarity(moduleId: string): string {
  return props.allModules.find(m => m.id === moduleId)?.rarity || 'common'
}

// 傷害試算與 ATB 屬性計算
const installedModules = computed(() => {
  if (!currentWeapon.value) return []
  
  const allModuleIds = [
    ...currentWeapon.value.slotConfig.tempoModules,
    ...currentWeapon.value.slotConfig.tacticalModules,
    ...currentWeapon.value.slotConfig.enchantModules,
  ]
  
  return allModuleIds
    .map(instanceId => {
      const instance = props.inventory.modules.find(m => m.instanceId === instanceId)
      if (!instance) return null
      return props.allModules.find(m => m.id === instance.moduleId)
    })
    .filter((m): m is SlotModule => m !== null)
})

const moduleEffects = computed(() => {
  return mergeModuleEffects(installedModules.value)
})

const moduleDamageBonus = computed(() => {
  return moduleEffects.value.damageModifiers.damageMult || 0
})

const totalTempoMod = computed(() => {
  // Tempo 修正來自模組的 timing modifiers
  const castMult = moduleEffects.value.timingModifiers?.castMult || 0
  const recoveryMult = moduleEffects.value.timingModifiers?.recoveryMult || 0
  return Math.round((castMult + recoveryMult) * 10) // 簡化顯示
})

const totalCastMult = computed(() => {
  return 1 + (moduleEffects.value.timingModifiers?.castMult || 0)
})

const finalInterruptValue = computed(() => {
  const base = weapon.value?.baseInterrupt || 0
  const add = moduleEffects.value.interruptEffects?.interruptBonus || 0
  return base + add
})

function getStatValue(scalingStat: string): number {
  if (!props.bloodline) return 0
  const stat = scalingStat.toLowerCase()
  if (stat === 'str') return props.bloodline.baseStats.str
  if (stat === 'agi') return props.bloodline.baseStats.agi
  if (stat === 'int') return props.bloodline.baseStats.int
  return 0
}

const calculatedDamage = computed(() => {
  if (!weapon.value || !props.bloodline) return 0
  
  const baseDamage = weapon.value.baseDamage
  const statValue = getStatValue(weapon.value.statScaling)
  
  // 傷害 = 基礎傷害 × (1 + 屬性 × 0.05) × (1 + 模組加成)
  const statBonus = 1 + (statValue * 0.05)
  const moduleBonus = 1 + moduleDamageBonus.value
  
  return baseDamage * statBonus * moduleBonus
})

function openModuleSelector(slotType: 'tempo' | 'tactical' | 'enchant') {
  selectorSlotType.value = slotType
  showModuleSelector.value = true
}

function closeModuleSelector() {
  showModuleSelector.value = false
}

function installModule(moduleInstanceId: string) {
  if (!currentUnit.value || !weapon.value) return
  
  const result = installModuleToWeapon(
    currentUnit.value,
    props.weaponInstanceId,
    moduleInstanceId,
    selectorSlotType.value,
    weapon.value
  )
  
  if (result.success && result.unit) {
    const newTeamBuild = { ...props.teamBuild }
    newTeamBuild.units[props.unitIndex] = result.unit
    
    const newInventory = markModuleEquipped(
      props.inventory,
      moduleInstanceId,
      props.weaponInstanceId
    )
    
    emit('update', newTeamBuild, newInventory)
    closeModuleSelector()
  } else {
    alert(result.error)
  }
}

function uninstallModule(moduleInstanceId: string, slotType: 'tempo' | 'tactical' | 'enchant') {
  if (!currentUnit.value) return
  
  const updatedUnit = uninstallModuleFromWeapon(
    currentUnit.value,
    props.weaponInstanceId,
    moduleInstanceId,
    slotType
  )
  
  const newTeamBuild = { ...props.teamBuild }
  newTeamBuild.units[props.unitIndex] = updatedUnit
  
  const newInventory = markModuleUnequipped(props.inventory, moduleInstanceId)
  
  emit('update', newTeamBuild, newInventory)
}
</script>

<style scoped>
.weapon-module-editor {
  min-width: 700px;
  max-width: 900px;
  max-height: 85vh;
  overflow-y: auto;
  overflow-x: hidden;
}

.weapon-info {
  margin-bottom: 15px;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 8px;
}

/* 傷害計算器 */
.damage-calculator {
  margin-bottom: 20px;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: white;
}

.damage-calculator h4 {
  margin: 0 0 15px 0;
  font-size: 1.1em;
  color: white;
}

.calc-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.calc-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  backdrop-filter: blur(10px);
}

.calc-item.highlight {
  background: rgba(255, 255, 255, 0.25);
  border: 2px solid rgba(255, 255, 255, 0.5);
}

.calc-label {
  font-size: 0.8em;
  margin-bottom: 6px;
  opacity: 0.9;
}

.calc-value {
  font-size: 1.4em;
  font-weight: bold;
}

.calc-value.damage {
  font-size: 1.8em;
  color: #ffd700;
}

/* ATB 屬性 */
.atb-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 15px;
}

.atb-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
}

.atb-label {
  font-size: 0.75em;
  margin-bottom: 4px;
  opacity: 0.85;
}

.atb-value {
  font-size: 1.2em;
  font-weight: bold;
}

.atb-value.tempo {
  color: #ffeb3b;
}

.atb-value.interrupt {
  color: #ff5722;
}

/* 武器模式資訊 */
.weapon-mode-info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-top: 15px;
}

.mode-section {
  padding: 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
}

.mode-section h5 {
  margin: 0 0 8px 0;
  font-size: 0.95em;
  color: #ffd700;
}

.mode-section p {
  margin: 4px 0;
  font-size: 0.85em;
}

.weapon-info h4 {
  margin: 0 0 4px 0;
}

.instance-id {
  font-size: 0.75em;
  color: #666;
  margin: 0;
}

.slots-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 20px;
}

.slot-section {
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
}

.slot-section h4 {
  margin: 0 0 12px 0;
}

.installed-modules {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
  min-height: 40px;
}

.module-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
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

.btn-add-module {
  width: 100%;
  padding: 10px;
  border: 1px dashed #999;
  background: white;
  border-radius: 4px;
  cursor: pointer;
}

.btn-add-module:hover {
  background: #f5f5f5;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn-close {
  padding: 10px 20px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1em;
}

.btn-close:hover {
  background: #45a049;
}

.module-selector-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.module-selector {
  background: white;
  padding: 20px;
  border-radius: 8px;
  max-width: 500px;
  max-height: 70vh;
  overflow-y: auto;
}

.module-selector h4 {
  margin: 0 0 15px 0;
}

.module-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 15px;
}

.module-item {
  padding: 12px;
  border: 2px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.module-item:hover {
  border-color: #4CAF50;
  background: #f5f5f5;
}

.module-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.module-description {
  font-size: 0.9em;
  color: #666;
  margin: 6px 0;
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
</style>

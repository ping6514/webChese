<script setup lang="ts">
import { ref, computed } from 'vue'
import { allLeaders } from '../data/leaders'
import { allLegions } from '../data/legions'
import { allEvents } from '../data/events'
import { allReactions } from '../data/reactions'
import { allBuildings } from '../data/buildings'

type CardTab = 'leaders' | 'legions' | 'events' | 'reactions' | 'buildings'

const activeTab = ref<CardTab>('leaders')
const selectedLeader = ref<any>(null)
const selectedLegion = ref<any>(null)
const selectedEvent = ref<any>(null)
const selectedReaction = ref<any>(null)
const selectedBuilding = ref<any>(null)

// 職業篩選（用於軍團卡和反應卡）
const selectedSuitableClass = ref<string>('all')
const suitableClasses = ['all', 'destroyer', 'conqueror', 'commander', 'guardian']
const suitableClassNames: Record<string, string> = {
  all: '通用',
  destroyer: '破壞者',
  conqueror: '征服者',
  commander: '指揮官',
  guardian: '守護者'
}

// 職業篩選（首領用）
const selectedClass = ref<string>('all')
const classes = ['destroyer', 'conqueror', 'commander', 'guardian']
const classNames: Record<string, string> = {
  destroyer: '破壞者',
  conqueror: '征服者',
  commander: '指揮官',
  guardian: '守護者'
}

// 事件卡分類篩選
const selectedEventCategory = ref<string>('all')
const eventCategories = ['movement', 'buff', 'control', 'resource', 'special']
const eventCategoryNames: Record<string, string> = {
  movement: '移動類',
  buff: '增益類',
  control: '控制類',
  resource: '資源類',
  special: '特殊類'
}

// 篩選後的卡牌
const filteredLeaders = computed(() => {
  let result = allLeaders
  if (selectedClass.value !== 'all') {
    result = result.filter(c => c.class === selectedClass.value)
  }
  return result
})

const filteredLegions = computed(() => {
  if (selectedSuitableClass.value === 'all') return allLegions
  return allLegions.filter(c => 
    c.suitableClass === 'all' || c.suitableClass === selectedSuitableClass.value
  )
})

const filteredEvents = computed(() => {
  if (selectedEventCategory.value === 'all') return allEvents
  return allEvents.filter(c => c.category === selectedEventCategory.value)
})

const filteredReactions = computed(() => {
  if (selectedSuitableClass.value === 'all') return allReactions
  return allReactions.filter(c => 
    c.suitableClass.includes('all') || c.suitableClass.includes(selectedSuitableClass.value)
  )
})

const hasDetail = computed(() => 
  !!(selectedLeader.value || selectedLegion.value || selectedEvent.value || 
     selectedReaction.value || selectedBuilding.value)
)

function selectLeader(card: any) {
  selectedLeader.value = selectedLeader.value?.id === card.id ? null : card
  clearOtherSelections('leader')
}

function selectLegion(card: any) {
  selectedLegion.value = selectedLegion.value?.id === card.id ? null : card
  clearOtherSelections('legion')
}

function selectEvent(card: any) {
  selectedEvent.value = selectedEvent.value?.id === card.id ? null : card
  clearOtherSelections('event')
}

function selectReaction(card: any) {
  selectedReaction.value = selectedReaction.value?.id === card.id ? null : card
  clearOtherSelections('reaction')
}

function selectBuilding(card: any) {
  selectedBuilding.value = selectedBuilding.value?.id === card.id ? null : card
  clearOtherSelections('building')
}

function clearOtherSelections(keep: string) {
  if (keep !== 'leader') selectedLeader.value = null
  if (keep !== 'legion') selectedLegion.value = null
  if (keep !== 'event') selectedEvent.value = null
  if (keep !== 'reaction') selectedReaction.value = null
  if (keep !== 'building') selectedBuilding.value = null
}

function closeDetail() {
  selectedLeader.value = null
  selectedLegion.value = null
  selectedEvent.value = null
  selectedReaction.value = null
  selectedBuilding.value = null
}

function changeTab(tab: CardTab) {
  activeTab.value = tab
  closeDetail()
}
</script>

<template>
  <div class="cards-gallery">
    <header class="gallery-header">
      <h1>🎴 魔物娘卡牌圖鑑</h1>
      <p class="subtitle">共 80 張核心卡牌</p>
    </header>

    <!-- Tab 切換 -->
    <div class="card-tabs">
      <button 
        :class="['tab', activeTab === 'leaders' && 'tab-active']"
        @click="changeTab('leaders')"
      >
        👑 首領卡 (12)
      </button>
      <button 
        :class="['tab', activeTab === 'legions' && 'tab-active']"
        @click="changeTab('legions')"
      >
        ⚔️ 軍團卡 (22)
      </button>
      <button 
        :class="['tab', activeTab === 'events' && 'tab-active']"
        @click="changeTab('events')"
      >
        ✨ 事件卡 (20)
      </button>
      <button 
        :class="['tab', activeTab === 'reactions' && 'tab-active']"
        @click="changeTab('reactions')"
      >
        🛡️ 反應卡 (20)
      </button>
      <button 
        :class="['tab', activeTab === 'buildings' && 'tab-active']"
        @click="changeTab('buildings')"
      >
        🏰 建築卡 (6)
      </button>
    </div>

    <!-- 篩選器 -->
    <div class="filters">
      <!-- 首領卡篩選 -->
      <div v-if="activeTab === 'leaders'" class="filter-group">
        <label>職業：</label>
        <button 
          :class="['filter-btn', selectedClass === 'all' && 'active']"
          @click="selectedClass = 'all'"
        >
          全部
        </button>
        <button 
          v-for="cls in classes" 
          :key="cls"
          :class="['filter-btn', selectedClass === cls && 'active']"
          @click="selectedClass = cls"
        >
          {{ classNames[cls] }}
        </button>
      </div>
      
      <!-- 軍團卡和反應卡篩選 -->
      <div v-if="activeTab === 'legions' || activeTab === 'reactions'" class="filter-group">
        <label>適用職業：</label>
        <button 
          v-for="cls in suitableClasses" 
          :key="cls"
          :class="['filter-btn', selectedSuitableClass === cls && 'active']"
          @click="selectedSuitableClass = cls"
        >
          {{ suitableClassNames[cls] }}
        </button>
      </div>
      
      <!-- 事件卡篩選 -->
      <div v-if="activeTab === 'events'" class="filter-group">
        <label>類別：</label>
        <button 
          :class="['filter-btn', selectedEventCategory === 'all' && 'active']"
          @click="selectedEventCategory = 'all'"
        >
          全部
        </button>
        <button 
          v-for="cat in eventCategories" 
          :key="cat"
          :class="['filter-btn', selectedEventCategory === cat && 'active']"
          @click="selectedEventCategory = cat"
        >
          {{ eventCategoryNames[cat] }}
        </button>
      </div>
    </div>

    <div class="gallery-layout">
      <!-- 卡牌網格 -->
      <div class="cards-grid">
        <!-- 首領卡 -->
        <template v-if="activeTab === 'leaders'">
          <div 
            v-for="card in filteredLeaders" 
            :key="card.id"
            :class="['card-item', 'leader-card', selectedLeader?.id === card.id && 'selected']"
            @click="selectLeader(card)"
          >
            <div class="card-image-placeholder">
              <span class="placeholder-icon">👑</span>
              <span class="placeholder-text">圖片待補</span>
            </div>
            <div class="card-info">
              <h3 class="card-name">{{ card.name }}</h3>
              <div class="card-meta">
                <span class="badge class">{{ classNames[card.class] }}</span>
              </div>
              <div class="card-stats">
                <span class="stat">❤️ {{ card.baseToughness }}</span>
                <span class="stat">⚔️ {{ card.baseAttack }}</span>
                <span class="stat">🛡️ {{ card.baseDefensiveSupport }}</span>
                <span class="stat">⚡ {{ card.baseOffensiveSupport }}</span>
                <span class="stat">💚 {{ card.baseRecovery }}</span>
              </div>
            </div>
          </div>
        </template>

        <!-- 軍團卡 -->
        <template v-if="activeTab === 'legions'">
          <div 
            v-for="card in filteredLegions" 
            :key="card.id"
            :class="['card-item', 'legion-card', selectedLegion?.id === card.id && 'selected']"
            @click="selectLegion(card)"
          >
            <div class="card-image-placeholder">
              <span class="placeholder-icon">⚔️</span>
              <span class="placeholder-text">圖片待補</span>
            </div>
            <div class="card-info">
              <h3 class="card-name">{{ card.name }}</h3>
              <div class="card-meta">
                <span class="badge suitable-class">{{ suitableClassNames[card.suitableClass] }}</span>
              </div>
              <div class="card-stats">
                <span class="stat">+{{ card.bonusStats.toughness }}</span>
                <span class="stat">+{{ card.bonusStats.attack }}</span>
                <span class="stat">+{{ card.bonusStats.defensiveSupport }}</span>
                <span class="stat">+{{ card.bonusStats.offensiveSupport }}</span>
                <span class="stat">+{{ card.bonusStats.recovery }}</span>
              </div>
            </div>
          </div>
        </template>

        <!-- 事件卡 -->
        <template v-if="activeTab === 'events'">
          <div 
            v-for="card in filteredEvents" 
            :key="card.id"
            :class="['card-item', 'event-card', selectedEvent?.id === card.id && 'selected']"
            @click="selectEvent(card)"
          >
            <div class="card-image-placeholder">
              <span class="placeholder-icon">✨</span>
              <span class="placeholder-text">圖片待補</span>
            </div>
            <div class="card-info">
              <h3 class="card-name">{{ card.name }}</h3>
              <div class="card-meta">
                <span :class="['badge', 'category', card.category]">{{ eventCategoryNames[card.category] }}</span>
              </div>
              <div class="card-cost">
                <span v-if="card.cost?.discard">�️ 丟牌{{ card.cost.discard }}</span>
                <span v-else>✨ 免費</span>
              </div>
            </div>
          </div>
        </template>

        <!-- 反應卡 -->
        <template v-if="activeTab === 'reactions'">
          <div 
            v-for="card in filteredReactions" 
            :key="card.id"
            :class="['card-item', 'reaction-card', selectedReaction?.id === card.id && 'selected']"
            @click="selectReaction(card)"
          >
            <div class="card-image-placeholder">
              <span class="placeholder-icon">🛡️</span>
              <span class="placeholder-text">圖片待補</span>
            </div>
            <div class="card-info">
              <h3 class="card-name">{{ card.name }}</h3>
              <div class="card-meta">
                <span class="badge suitable-class">{{ suitableClassNames[card.suitableClass[0]] }}</span>
              </div>
              <div class="card-trigger">
                <span class="trigger-text">{{ card.trigger?.timing }}</span>
              </div>
            </div>
          </div>
        </template>

        <!-- 建築卡 -->
        <template v-if="activeTab === 'buildings'">
          <div 
            v-for="card in allBuildings" 
            :key="card.id"
            :class="['card-item', 'building-card', selectedBuilding?.id === card.id && 'selected']"
            @click="selectBuilding(card)"
          >
            <div class="card-image-placeholder">
              <span class="placeholder-icon">🏰</span>
              <span class="placeholder-text">圖片待補</span>
            </div>
            <div class="card-info">
              <h3 class="card-name">{{ card.name }}</h3>
              <div class="card-meta">
                <span class="badge placement">{{ card.placement?.join('/') }}</span>
                <span class="badge durability">堅韌 {{ card.toughness }}</span>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- 詳情面板 -->
      <aside v-if="hasDetail" class="detail-panel">
        <!-- 首領詳情 -->
        <template v-if="selectedLeader">
          <div class="detail-image-placeholder">
            <span class="placeholder-icon-large">👑</span>
            <span class="placeholder-text">圖片待補</span>
          </div>
          <div class="detail-info">
            <h2 class="detail-name">{{ selectedLeader.name }}</h2>
            <div class="detail-meta">
              <span class="badge class">{{ classNames[selectedLeader.class] }}</span>
            </div>
            
            <div class="detail-section">
              <h3>基礎屬性</h3>
              <div class="stats-grid">
                <div class="stat-item">
                  <span class="stat-label">堅韌</span>
                  <span class="stat-value">{{ selectedLeader.baseToughness }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">對敵</span>
                  <span class="stat-value">{{ selectedLeader.baseAttack }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">防護協助</span>
                  <span class="stat-value">{{ selectedLeader.baseDefensiveSupport }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">攻擊協助</span>
                  <span class="stat-value">{{ selectedLeader.baseOffensiveSupport }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">回復力</span>
                  <span class="stat-value">{{ selectedLeader.baseRecovery }}</span>
                </div>
              </div>
            </div>

            <div class="detail-section">
              <h3>Tags</h3>
              <div class="tags-list">
                <span v-for="tag in selectedLeader.tags" :key="tag" class="tag">{{ tag }}</span>
              </div>
            </div>

            <div v-if="selectedLeader.passive" class="detail-section">
              <h3>被動技能</h3>
              <div class="skill-box">
                <h4>{{ selectedLeader.passive.name }}</h4>
                <p>{{ selectedLeader.passive.description }}</p>
              </div>
            </div>

            <div v-if="selectedLeader.skill" class="detail-section">
              <h3>主動技能</h3>
              <div class="skill-box">
                <h4>{{ selectedLeader.skill.name }}</h4>
                <div class="effect-list">
                  <div v-for="(eff, idx) in selectedLeader.skill.effect" :key="idx" class="effect-item">
                    <p>{{ eff.description }}</p>
                  </div>
                </div>
                <div class="skill-meta">
                  <span>冷卻: {{ selectedLeader.skill.cooldown }} 回合</span>
                </div>
              </div>
            </div>

            <button class="close-btn" @click="closeDetail">✕ 關閉</button>
          </div>
        </template>

        <!-- 軍團詳情 -->
        <template v-if="selectedLegion">
          <div class="detail-image-placeholder">
            <span class="placeholder-icon-large">⚔️</span>
            <span class="placeholder-text">圖片待補</span>
          </div>
          <div class="detail-info">
            <h2 class="detail-name">{{ selectedLegion.name }}</h2>
            <div class="detail-meta">
              <span class="badge suitable-class">{{ suitableClassNames[selectedLegion.suitableClass] }}</span>
            </div>
            
            <div class="detail-section">
              <h3>屬性加成</h3>
              <div class="stats-grid">
                <div class="stat-item">
                  <span class="stat-label">堅韌</span>
                  <span class="stat-value">+{{ selectedLegion.bonusStats.toughness }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">對敵</span>
                  <span class="stat-value">+{{ selectedLegion.bonusStats.attack }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">防護協助</span>
                  <span class="stat-value">+{{ selectedLegion.bonusStats.defensiveSupport }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">攻擊協助</span>
                  <span class="stat-value">+{{ selectedLegion.bonusStats.offensiveSupport }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">回復力</span>
                  <span class="stat-value">+{{ selectedLegion.bonusStats.recovery }}</span>
                </div>
              </div>
            </div>

            <div class="detail-section">
              <h3>Tags</h3>
              <div class="tags-list">
                <span v-for="tag in selectedLegion.tags" :key="tag" class="tag">{{ tag }}</span>
              </div>
            </div>

            <div class="detail-section">
              <h3>被動能力</h3>
              <div class="skill-box">
                <h4>{{ selectedLegion.passive.name }}</h4>
                <p>{{ selectedLegion.passive.description }}</p>
              </div>
            </div>

            <div v-if="selectedLegion.activeSkill" class="detail-section">
              <h3>主動技能</h3>
              <div class="skill-box">
                <h4>{{ selectedLegion.activeSkill.name }}</h4>
                <p>{{ selectedLegion.activeSkill.description }}</p>
                <div class="skill-meta">
                  <span>冷卻: {{ selectedLegion.activeSkill.cooldown }} 回合</span>
                </div>
              </div>
            </div>

            <button class="close-btn" @click="closeDetail">✕ 關閉</button>
          </div>
        </template>

        <!-- 事件詳情 -->
        <template v-if="selectedEvent">
          <div class="detail-image-placeholder">
            <span class="placeholder-icon-large">✨</span>
            <span class="placeholder-text">圖片待補</span>
          </div>
          <div class="detail-info">
            <h2 class="detail-name">{{ selectedEvent.name }}</h2>
            <div class="detail-meta">
              <span :class="['badge', 'category', selectedEvent.category]">{{ selectedEvent.category }}</span>
            </div>
            
            <div v-if="selectedEvent.cost" class="detail-section">
              <h3>成本</h3>
              <div class="cost-display">
                <span v-if="selectedEvent.cost.tech">🔧 技能點 {{ selectedEvent.cost.tech }}</span>
                <span v-if="selectedEvent.cost.any">💎 任意資源 {{ selectedEvent.cost.any }}</span>
              </div>
            </div>

            <div class="detail-section">
              <h3>效果</h3>
              <div class="effect-list">
                <div v-for="(eff, idx) in selectedEvent.effect" :key="idx" class="effect-item">
                  <p>{{ eff.description }}</p>
                </div>
              </div>
            </div>

            <div v-if="selectedEvent.bonusEffect" class="detail-section">
              <h3>額外效果</h3>
              <p class="bonus-condition">{{ selectedEvent.bonusEffect.conditionDescription }}</p>
              <div class="effect-list">
                <div v-for="(eff, idx) in selectedEvent.bonusEffect.effect" :key="idx" class="effect-item">
                  <p>{{ eff.description }}</p>
                </div>
              </div>
            </div>

            <p class="flavor-text">{{ selectedEvent.flavor }}</p>

            <button class="close-btn" @click="closeDetail">✕ 關閉</button>
          </div>
        </template>

        <!-- 反應卡詳情 -->
        <template v-if="selectedReaction">
          <div class="detail-image-placeholder">
            <span class="placeholder-icon-large">🛡️</span>
            <span class="placeholder-text">圖片待補</span>
          </div>
          <div class="detail-info">
            <h2 class="detail-name">{{ selectedReaction.name }}</h2>
            <div class="detail-meta">
              <span class="badge suitable-class">{{ suitableClassNames[selectedReaction.suitableClass[0]] }}</span>
            </div>
            
            <div class="detail-section">
              <h3>觸發時機</h3>
              <p class="trigger-info">{{ selectedReaction.trigger?.description }}</p>
            </div>

            <div class="detail-section">
              <h3>效果</h3>
              <p class="effect-description">{{ selectedReaction.effect?.description }}</p>
            </div>

            <div class="detail-section">
              <h3>使用後</h3>
              <p class="after-use">{{ selectedReaction.afterUse === 'discard' ? '棄置此卡' : '保留此卡' }}</p>
            </div>

            <button class="close-btn" @click="closeDetail">✕ 關閉</button>
          </div>
        </template>

        <!-- 建築詳情 -->
        <template v-if="selectedBuilding">
          <div class="detail-image-placeholder">
            <span class="placeholder-icon-large">🏰</span>
            <span class="placeholder-text">圖片待補</span>
          </div>
          <div class="detail-info">
            <h2 class="detail-name">{{ selectedBuilding.name }}</h2>
            <div class="detail-meta">
              <span :class="['badge', 'category', selectedBuilding.category]">{{ selectedBuilding.category }}</span>
              <span class="badge durability">耐久 {{ selectedBuilding.durability }}</span>
            </div>
            
            <div v-if="selectedBuilding.cost" class="detail-section">
              <h3>代價</h3>
              <div class="cost-display">
                <span v-if="selectedBuilding.cost.discardCount">🗑️ 丟棄 {{ selectedBuilding.cost.discardCount }} 張</span>
                <span v-if="selectedBuilding.cost.fortificationCost">🏗️ 築城 {{ selectedBuilding.cost.fortificationCost }}</span>
              </div>
            </div>

            <div class="detail-section">
              <h3>地利效果</h3>
              <div class="skill-box">
                <h4>{{ selectedBuilding.areaEffect.name }}</h4>
                <p>{{ selectedBuilding.areaEffect.description }}</p>
              </div>
            </div>

            <div v-if="selectedBuilding.onDestroy" class="detail-section">
              <h3>破壞效果</h3>
              <p>{{ selectedBuilding.onDestroy.description }}</p>
            </div>

            <p class="flavor-text">{{ selectedBuilding.flavor }}</p>

            <button class="close-btn" @click="closeDetail">✕ 關閉</button>
          </div>
        </template>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.cards-gallery {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 2rem;
}

.gallery-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2rem;
  text-align: center;
}

.gallery-header h1 {
  margin: 0;
  font-size: 2.5rem;
}

.subtitle {
  margin: 0.5rem 0 0 0;
  opacity: 0.9;
}

.card-tabs {
  display: flex;
  gap: 0.5rem;
  padding: 1rem;
  background: white;
  border-bottom: 2px solid #e0e0e0;
  overflow-x: auto;
}

.tab {
  padding: 0.75rem 1.5rem;
  border: none;
  background: #f5f5f5;
  color: #333;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.3s;
  white-space: nowrap;
}

.tab:hover {
  background: #e0e0e0;
}

.tab-active {
  background: #667eea;
  color: white;
}

.filters {
  background: white;
  padding: 1rem;
  border-bottom: 1px solid #e0e0e0;
}

.filter-group {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}

.filter-group label {
  font-weight: 600;
  color: #666;
}

.filter-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  background: white;
  color: #333;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
  font-size: 0.9rem;
}

.filter-btn:hover {
  border-color: #667eea;
  color: #667eea;
}

.filter-btn.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.gallery-layout {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 1rem;
  padding: 1rem;
  max-width: 1600px;
  margin: 0 auto;
}

@media (max-width: 1200px) {
  .gallery-layout {
    grid-template-columns: 1fr;
  }
  
  .detail-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 400px;
    max-width: 90vw;
    z-index: 1000;
    box-shadow: -4px 0 12px rgba(0,0,0,0.2);
  }
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.card-item {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s;
  border: 3px solid transparent;
}

.card-item:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0,0,0,0.15);
}

.card-item.selected {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
}

.card-image-placeholder {
  aspect-ratio: 3/4;
  background: linear-gradient(135deg, #e0e0e0 0%, #f5f5f5 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: #999;
}

.placeholder-icon {
  font-size: 3rem;
}

.placeholder-text {
  font-size: 0.8rem;
}

.card-info {
  padding: 1rem;
}

.card-name {
  margin: 0 0 0.5rem 0;
  font-size: 1.1rem;
  color: #1a1a1a;
  font-weight: 600;
}

.card-meta {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}

.badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge.race {
  background: #e3f2fd;
  color: #1976d2;
}

.badge.class {
  background: #f3e5f5;
  color: #7b1fa2;
}

.badge.rank.normal {
  background: #f5f5f5;
  color: #666;
}

.badge.rank.elite {
  background: #fff3e0;
  color: #f57c00;
}

.badge.rank.legendary {
  background: #fce4ec;
  color: #c2185b;
}

.badge.category {
  background: #e8f5e9;
  color: #388e3c;
}

.badge.durability {
  background: #fff9c4;
  color: #f57f17;
}

.card-stats {
  display: flex;
  gap: 0.75rem;
  font-size: 0.9rem;
  color: #444;
  font-weight: 500;
}

.card-cost {
  display: flex;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: #666;
}

.detail-panel {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  position: sticky;
  top: 1rem;
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
}

.detail-image-placeholder {
  aspect-ratio: 3/4;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: white;
}

.placeholder-icon-large {
  font-size: 5rem;
}

.detail-info {
  padding: 1.5rem;
}

.detail-name {
  margin: 0 0 1rem 0;
  font-size: 1.8rem;
  color: #1a1a1a;
  font-weight: 700;
}

.detail-meta {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.detail-section {
  margin-bottom: 1.5rem;
}

.detail-section h3 {
  margin: 0 0 0.75rem 0;
  font-size: 1.1rem;
  color: #667eea;
  border-bottom: 2px solid #667eea;
  padding-bottom: 0.25rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.stat-item {
  text-align: center;
  padding: 0.75rem;
  background: #f5f5f5;
  border-radius: 8px;
}

.stat-label {
  display: block;
  font-size: 0.8rem;
  color: #666;
  margin-bottom: 0.25rem;
}

.stat-value {
  display: block;
  font-size: 1.5rem;
  font-weight: 700;
  color: #333;
}

.tags-list {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.tag {
  padding: 0.5rem 0.75rem;
  background: #e3f2fd;
  color: #1976d2;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
}

.skill-box {
  background: #f9f9f9;
  padding: 1rem;
  border-radius: 8px;
  border-left: 4px solid #667eea;
}

.skill-box h4 {
  margin: 0 0 0.5rem 0;
  color: #667eea;
}

.skill-box p {
  margin: 0;
  color: #333;
  line-height: 1.6;
}

.skill-meta {
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: #999;
}

.cost-display {
  display: flex;
  gap: 1rem;
  font-size: 1rem;
  color: #666;
}

.effect-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.effect-item {
  background: #f9f9f9;
  padding: 0.75rem;
  border-radius: 6px;
}

.effect-item p {
  margin: 0;
  color: #333;
  line-height: 1.5;
}

.bonus-condition {
  background: #fff3e0;
  padding: 0.75rem;
  border-radius: 6px;
  color: #f57c00;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.trigger-info {
  background: #f9f9f9;
  padding: 0.75rem;
  border-radius: 6px;
  color: #666;
}

.flavor-text {
  font-style: italic;
  color: #999;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e0e0e0;
}

.close-btn {
  width: 100%;
  padding: 0.75rem;
  margin-top: 1rem;
  border: none;
  background: #667eea;
  color: white;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.3s;
}

.close-btn:hover {
  background: #5568d3;
}
</style>

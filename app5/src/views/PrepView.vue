<template>
  <div class="prep-view">

    <!-- ── Header ── -->
    <div class="prep-header">
      <h1>魔物娘戰場</h1>
      <p class="subtitle">備戰配置</p>
    </div>

    <!-- ── Tabs ── -->
    <div class="tabs">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'squads' }"
        @click="activeTab = 'squads'"
      >
        小隊卡
        <span class="tab-count">{{ selectedCardIds.length }} / {{ MAX_SQUADS }}</span>
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'summoner' }"
        @click="activeTab = 'summoner'"
      >
        裝備卡
        <span class="tab-count">{{ selectedSummonerCardIds.length }} / {{ MAX_SUMMONER }}</span>
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'map' }"
        @click="activeTab = 'map'"
      >
        地圖
        <span class="tab-count">{{ selectedTemplateLabel }}</span>
      </button>
    </div>

    <!-- ── 小隊卡 Tab ── -->
    <div v-if="activeTab === 'squads'" class="card-grid">
      <div
        v-for="card in store.captainCards"
        :key="card.id"
        class="card captain-card"
        :class="{ selected: selectedCardIds.includes(card.id), disabled: !selectedCardIds.includes(card.id) && selectedCardIds.length >= MAX_SQUADS }"
        @click="toggleSquadCard(card.id)"
      >
        <div class="card-header">
          <span class="card-type-badge" :class="captainType(card.captainDefId)">
            {{ TYPE_LABEL[captainType(card.captainDefId)] }}
          </span>
          <span v-if="selectedCardIds.includes(card.id)" class="check">✓</span>
        </div>
        <div class="card-name">{{ captainName(card.captainDefId) }}</div>
        <div class="card-route">
          路線：{{ routeForCard(card.id) }}
        </div>
        <div class="card-passive">{{ card.innatePassive.name }}</div>
        <div class="card-passive-desc">{{ card.innatePassive.desc }}</div>
      </div>
    </div>

    <!-- ── 裝備卡 Tab ── -->
    <div v-if="activeTab === 'summoner'" class="card-grid">
      <div
        v-for="card in store.summonerCards"
        :key="card.id"
        class="card summoner-card"
        :class="{ selected: selectedSummonerCardIds.includes(card.id), disabled: !selectedSummonerCardIds.includes(card.id) && selectedSummonerCardIds.length >= MAX_SUMMONER }"
        @click="toggleSummonerCard(card.id)"
      >
        <div class="card-header">
          <span class="card-type-badge summoner">裝備</span>
          <span v-if="selectedSummonerCardIds.includes(card.id)" class="check">✓</span>
        </div>
        <div class="card-name">{{ card.name }}</div>
        <div class="card-passive-desc">{{ card.desc }}</div>
        <div class="effects-list">
          <div v-for="(eff, i) in card.effects" :key="i" class="effect-item">
            {{ formatEffect(eff) }}
          </div>
        </div>
      </div>
    </div>

    <!-- ── 地圖模板 Tab ── -->
    <div v-if="activeTab === 'map'" class="card-grid map-grid">
      <div
        v-for="tmpl in MAP_TEMPLATES"
        :key="tmpl.id"
        class="card map-card"
        :class="{ selected: store.selectedTemplate === tmpl.id }"
        @click="store.setTemplate(tmpl.id)"
      >
        <div class="card-header">
          <span class="card-type-badge map-badge">地圖</span>
          <span v-if="store.selectedTemplate === tmpl.id" class="check">✓</span>
        </div>
        <div class="map-icon">{{ tmpl.icon }}</div>
        <div class="card-name">{{ tmpl.label }}</div>
        <div class="card-passive-desc">{{ tmpl.desc }}</div>
        <div class="map-meta">
          <span class="map-time">⏱ {{ formatTicks(tmpl.maxTicks) }}</span>
        </div>
      </div>
    </div>

    <!-- ── Footer ── -->
    <div class="prep-footer">
      <div class="footer-info">
        <span>小隊：{{ selectedCardIds.length }} / {{ MAX_SQUADS }}</span>
        <span>裝備：{{ selectedSummonerCardIds.length }} / {{ MAX_SUMMONER }}</span>
      </div>
      <button
        class="start-btn"
        :disabled="selectedCardIds.length === 0"
        @click="handleStart"
      >
        開始戰鬥 →
      </button>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../stores/gameStore'
import type { SummonerEffect, CaptainType } from '../engine/types'
import { MAP_TEMPLATES } from '../engine/mapData'

const store  = useGameStore()
const router = useRouter()

const activeTab = ref<'squads' | 'summoner' | 'map'>('squads')

const MAX_SQUADS   = 5
const MAX_SUMMONER = 2

const { selectedCardIds, selectedSummonerCardIds } = store

// ── 地圖模板 ─────────────────────────────────────────────────────────────────

const selectedTemplateLabel = computed(() =>
  MAP_TEMPLATES.find(t => t.id === store.selectedTemplate)?.label ?? '—'
)

function formatTicks(ticks: number): string {
  const secs = Math.round(ticks * 0.12)
  const mm = Math.floor(secs / 60)
  const ss = secs % 60
  return `${mm}:${ss.toString().padStart(2, '0')}`
}

// ── 路線自動分配 ─────────────────────────────────────────────────────────────

const ROUTES = ['上路', '中路', '下路', '中路', '上路']
function routeForCard(cardId: string): string {
  const idx = selectedCardIds.indexOf(cardId)
  return idx >= 0 ? ROUTES[idx] ?? '中路' : '—'
}

// ── 隊長資訊 ─────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<CaptainType, string> = {
  infantry: '步兵',
  cavalry:  '騎兵',
  heavy:    '重甲',
  ranged:   '弓兵',
  siege:    '攻城',
}

function captainName(defId: string) {
  return store.captainDefs.find(c => c.id === defId)?.name ?? defId
}
function captainType(defId: string): CaptainType {
  return (store.captainDefs.find(c => c.id === defId)?.type ?? 'infantry') as CaptainType
}

// ── 效果文字 ──────────────────────────────────────────────────────────────────

const EFFECT_LABEL: Record<string, string> = {
  productionSpeed:    '從者生產速度',
  followerTypeSpeed:  '生產速度',
  inventoryCapacity:  '庫存上限',
  tacticSpeed:        '計策帶速度',
  tacticHandSize:     '計策手牌上限',
  facilityAtk:        '防禦塔攻擊力',
  facilityOutput:     '採集站產出',
  facilityHeal:       '急救站回血',
  buildCostReduction: '建造費用',
  initialMana:        '初始靈力',
  initialTacticCard:  '初始計策牌',
  pauseCooldown:      '暫停冷卻',
}

const TYPE_NAME: Record<string, string> = {
  infantry: '步兵', cavalry: '騎兵', heavy: '重甲', ranged: '弓兵', siege: '攻城',
}

function formatEffect(eff: SummonerEffect): string {
  const label = EFFECT_LABEL[eff.type] ?? eff.type
  const target = eff.targetType ? `（${TYPE_NAME[eff.targetType] ?? eff.targetType}）` : ''
  if (eff.type === 'buildCostReduction') return `${label} -${eff.value}%`
  if (eff.type === 'initialMana' || eff.type === 'initialTacticCard' || eff.type === 'inventoryCapacity' || eff.type === 'tacticHandSize')
    return `${label} +${eff.value}`
  return `${label}${target} +${eff.value}%`
}

// ── 選牌邏輯 ──────────────────────────────────────────────────────────────────

function toggleSquadCard(cardId: string) {
  const idx = selectedCardIds.indexOf(cardId)
  if (idx >= 0) {
    selectedCardIds.splice(idx, 1)
  } else if (selectedCardIds.length < MAX_SQUADS) {
    selectedCardIds.push(cardId)
  }
}

function toggleSummonerCard(cardId: string) {
  const idx = selectedSummonerCardIds.indexOf(cardId)
  if (idx >= 0) {
    selectedSummonerCardIds.splice(idx, 1)
  } else if (selectedSummonerCardIds.length < MAX_SUMMONER) {
    selectedSummonerCardIds.push(cardId)
  }
}

// ── 開始戰鬥 ──────────────────────────────────────────────────────────────────

function handleStart() {
  store.startBattle()
  router.push('/battle')
}
</script>

<style scoped>
.prep-view {
  min-height: 100vh;
  background: #f5ead8;
  color: #3a2e1e;
  display: flex;
  flex-direction: column;
  padding: 20px 24px 0;
  gap: 16px;
  box-sizing: border-box;
}

/* ── Header ── */
.prep-header { text-align: center; }
h1 { font-size: 26px; font-weight: 800; margin: 0; color: #5a3e1e; }
.subtitle { font-size: 13px; color: #8a6a3e; margin: 4px 0 0; }

/* ── Tabs ── */
.tabs { display: flex; gap: 8px; }
.tab-btn {
  flex: 1; padding: 10px 16px;
  background: #fdf6e8; border: 2px solid #c8b090;
  border-radius: 8px; font-size: 14px; font-weight: 600;
  color: #8a6a3e; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: all 0.15s;
}
.tab-btn.active {
  background: #c8701e; border-color: #c8701e; color: #fff;
}
.tab-count {
  font-size: 12px; font-weight: 700;
  background: rgba(0,0,0,0.12); border-radius: 10px;
  padding: 1px 7px;
}

/* ── Card Grid ── */
.card-grid {
  flex: 1; overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
  padding-bottom: 16px;
}

.card {
  background: #fdf6e8;
  border: 2px solid #c8b090;
  border-radius: 10px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
}
.card:hover:not(.disabled) { border-color: #a07040; transform: translateY(-2px); }
.card.selected { border-color: #c8701e; background: #fff4e0; box-shadow: 0 0 0 2px #c8701e44; }
.card.disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Card Header ── */
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-type-badge {
  font-size: 10px; font-weight: 700;
  padding: 2px 7px; border-radius: 8px;
  background: #e8d4b0; color: #5a3e1e;
}
.card-type-badge.infantry { background: #d4e8d4; color: #2a5a2a; }
.card-type-badge.cavalry  { background: #d4e0f0; color: #1a3a6a; }
.card-type-badge.heavy    { background: #e0d4f0; color: #3a1a6a; }
.card-type-badge.ranged   { background: #f0e8d4; color: #6a4a1a; }
.card-type-badge.siege    { background: #f0d4d4; color: #6a1a1a; }
.card-type-badge.summoner { background: #d4eef0; color: #1a4a5a; }
.check { font-size: 16px; color: #c8701e; font-weight: 900; }

/* ── Card Content ── */
.card-name { font-size: 15px; font-weight: 700; color: #3a2e1e; }
.card-route { font-size: 11px; color: #a07840; }
.card-passive { font-size: 11px; font-weight: 600; color: #5a3e1e; }
.card-passive-desc { font-size: 10px; color: #8a6a3e; line-height: 1.4; }

.effects-list { display: flex; flex-direction: column; gap: 3px; margin-top: 4px; }
.effect-item {
  font-size: 10px; color: #1a5a3a; font-weight: 600;
  background: #e4f4ea; border-radius: 4px; padding: 2px 6px;
}

/* ── Map Tab ── */
.map-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
.map-card { align-items: center; text-align: center; gap: 8px; }
.map-icon  { font-size: 32px; line-height: 1; }
.map-badge { background: #d4eef0; color: #1a4a5a; }
.map-meta  { margin-top: 4px; }
.map-time  { font-size: 10px; color: #8a6a3e; font-weight: 600;
  background: #f0e8d4; padding: 2px 7px; border-radius: 8px; }

/* ── Footer ── */
.prep-footer {
  background: #fdf6e8;
  border-top: 1px solid #c8b090;
  padding: 12px 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.footer-info { display: flex; gap: 16px; font-size: 13px; color: #8a6a3e; font-weight: 600; }
.start-btn {
  padding: 12px 36px;
  background: #c8701e; border: none;
  color: #fff; border-radius: 8px;
  font-size: 16px; font-weight: 700; cursor: pointer;
  transition: background 0.15s;
}
.start-btn:hover:not(:disabled) { background: #a85818; }
.start-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>

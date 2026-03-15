<template>
  <div class="setup-screen">

    <!-- ── 左側：職業選擇 ────────────────────────────────────────────────── -->
    <div class="setup-left panel">
      <h1 class="setup-title">時間地城</h1>
      <p class="setup-sub">選擇職業，踏入未知的地城</p>

      <div class="job-list">
        <button
          v-for="job in availableJobs"
          :key="job.id"
          class="job-btn"
          :class="{ 'job-btn--active': selectedJobId === job.id }"
          @click="selectedJobId = job.id"
        >
          <img
            v-if="jobImg(job.id)"
            :src="jobImg(job.id)!"
            :alt="job.name"
            class="job-img"
          />
          <div v-else class="job-img job-img--placeholder">{{ job.name[0] }}</div>
          <div class="job-info">
            <span class="job-name">{{ job.name }}</span>
            <span class="job-tags">{{ job.tags.slice(0, 3).join('・') }}</span>
          </div>
          <span class="job-tier-tag" :class="`tier-${job.tier}`">{{ JOB_TIER_LABEL[job.tier] }}</span>
        </button>
      </div>

      <!-- 職業屬性預覽 -->
      <div v-if="selectedJob" class="job-stats">
        <div class="section-title">基礎屬性</div>
        <div class="stat-grid">
          <span>STR <b>{{ selectedJob.stats.str.base }}</b></span>
          <span>AGI <b>{{ selectedJob.stats.agi.base }}</b></span>
          <span>INT <b>{{ selectedJob.stats.int.base }}</b></span>
          <span>LCK <b>{{ selectedJob.stats.lck.base }}</b></span>
        </div>
        <div class="stat-grid" style="margin-top:4px">
          <span>HP <b>{{ selectedJob.resources.hp.base }}</b></span>
          <span>SP <b>{{ selectedJob.resources.sp.base }}</b></span>
          <span>MP <b>{{ selectedJob.resources.mp.base }}</b></span>
          <span>移動 <b>{{ selectedJob.moveRange }}</b></span>
        </div>
        <div class="job-tags-row">
          <span v-for="t in selectedJob.tags" :key="t" class="job-tag">{{ t }}</span>
        </div>
      </div>

      <!-- 裝備加成預覽（有裝備時顯示） -->
      <div v-if="equippedBonusSummary" class="equip-bonus-preview">
        <div class="section-title">裝備加成</div>
        <div class="equip-bonus-text">{{ equippedBonusSummary }}</div>
      </div>

      <button class="btn btn--primary start-btn" :disabled="!selectedJobId" @click="onStart">
        ⚔️ 進入地城
      </button>

    </div>

    <!-- ── 右側：裝備面板（選了職業後才展開）────────────────────────────── -->
    <Transition name="equip-slide">
      <div v-if="selectedJobId" class="setup-right panel">
        <EquipmentPanel />
      </div>
    </Transition>

    <!-- ── 模擬器彈窗 ──────────────────────────────────────────────────── -->
    <LootSimulator v-if="showSimulator" @close="showSimulator = false" />

    <!-- ── 固定左下角：寶相模擬器按鈕 ──────────────────────────────────── -->
    <button class="sim-launch-btn" @click="showSimulator = true" title="寶相模擬器（測試用）">
      🎲 抽獎寶相
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useGameStore } from '@/stores/game'
import { useInventoryStore } from '@/stores/inventory'
import { jobCerts, armorAffixDefs } from '@/data/index'
import { jobImage } from '@/composables/useAssets'
import { resolveArmorStats } from '@engine/armor'
import EquipmentPanel from '@/components/EquipmentPanel.vue'
import LootSimulator from '@/components/LootSimulator.vue'

const game = useGameStore()
const inventory = useInventoryStore()

const availableJobs = computed(() => Object.values(jobCerts))
const selectedJobId = ref<string>(game.setupJobId ?? 'warrior')
const selectedJob   = computed(() => selectedJobId.value ? jobCerts[selectedJobId.value] : null)
const showSimulator = ref(false)

// 切換職業時通知 inventory 載入對應的裝備組合
watch(selectedJobId, (id) => inventory.setCurrentJob(id), { immediate: true })

const JOB_TIER_LABEL: Record<string, string> = {
  basic: '初階', advanced: '進階', master: '大師',
}

function jobImg(id: string) { return jobImage(id) }

/** 統計已裝備的總 delta，顯示加成摘要 */
const equippedBonusSummary = computed((): string => {
  const items = inventory.equippedArmorList
  if (items.length === 0) return ''
  const parts: string[] = []
  let bonusHP = 0, bonusSP = 0, bonusMP = 0
  let bonusStr = 0, bonusAgi = 0, bonusInt = 0, bonusLck = 0
  for (const armor of items) {
    const delta = resolveArmorStats(armor.affixIds, armorAffixDefs, armor.dungeonQuality)
    bonusHP  += delta.maxHP; bonusSP  += delta.maxSP; bonusMP  += delta.maxMP
    bonusStr += delta.str;   bonusAgi += delta.agi
    bonusInt += delta.int;   bonusLck += delta.lck
  }
  if (bonusStr)  parts.push(`STR+${bonusStr}`)
  if (bonusAgi)  parts.push(`AGI+${bonusAgi}`)
  if (bonusInt)  parts.push(`INT+${bonusInt}`)
  if (bonusLck)  parts.push(`LCK+${bonusLck}`)
  if (bonusHP)   parts.push(`HP+${bonusHP}`)
  if (bonusSP)   parts.push(`SP+${bonusSP}`)
  if (bonusMP)   parts.push(`MP+${bonusMP}`)
  return parts.join('  ')
})

function onStart() {
  if (!selectedJobId.value) return
  game.setupJobId = selectedJobId.value
  game.startGame(selectedJobId.value)
}
</script>

<style scoped>
.setup-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 24px;
  background: var(--bg);
}

/* ── 左側卡 ── */
.setup-left {
  width: 100%;
  max-width: 400px;
  padding: 28px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
}

.setup-title {
  font-size: 26px; font-weight: 700; color: var(--accent);
  text-align: center; letter-spacing: .06em;
}
.setup-sub {
  text-align: center; color: var(--text-dim); font-size: 12px; margin-top: -10px;
}

/* ── 職業列表 ── */
.job-list { display: flex; flex-direction: column; gap: 6px; }
.job-btn {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px; border-radius: 6px;
  border: 2px solid var(--border-light); background: var(--bg-card);
  cursor: pointer; transition: border-color .15s, background .15s; text-align: left;
}
.job-btn:hover    { border-color: var(--accent-light); background: var(--accent-bg); }
.job-btn--active  { border-color: var(--accent); background: var(--accent-bg); }

.job-img {
  width: 46px; height: 46px; border-radius: 5px; object-fit: cover; flex-shrink: 0;
}
.job-img--placeholder {
  display: flex; align-items: center; justify-content: center;
  background: var(--bg-panel); border: 1px solid var(--border);
  font-size: 18px; font-weight: 700; color: var(--text-dim);
}
.job-info { flex: 1; display: flex; flex-direction: column; gap: 1px; }
.job-name { font-weight: 600; color: var(--text); font-size: 14px; }
.job-tags { font-size: 10px; color: var(--text-dim); }
.job-tier-tag {
  font-size: 9px; padding: 2px 6px; border-radius: 3px; font-weight: 600; flex-shrink: 0;
}
.tier-basic    { background: #e0e0e0; color: #555; }
.tier-advanced { background: #d0e8ff; color: #1a5fa0; }
.tier-master   { background: #e8d0ff; color: #7b2ca0; }

/* ── 屬性預覽 ── */
.job-stats {
  padding: 10px; background: var(--bg); border-radius: 4px;
  border: 1px solid var(--border-light);
}
.section-title { font-size: 10px; font-weight: 600; color: var(--text-dim); margin-bottom: 4px; text-transform: uppercase; }
.stat-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 3px 12px;
  font-size: 12px; color: var(--text-dim);
}
.stat-grid b { color: var(--accent); font-weight: 700; }

.job-tags-row { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 6px; }
.job-tag {
  font-size: 9px; padding: 1px 5px; border-radius: 3px;
  background: var(--accent-bg); border: 1px solid var(--border-light); color: var(--text-dim);
}

/* ── 裝備加成 ── */
.equip-bonus-preview {
  padding: 8px 10px; background: rgba(26,95,160,.06);
  border: 1px solid var(--accent-light); border-radius: 4px;
}
.equip-bonus-text { font-size: 11px; color: var(--accent); font-weight: 600; line-height: 1.5; }

/* ── 按鈕 ── */
.start-btn { width: 100%; padding: 10px; font-size: 15px; font-weight: 600; }

/* ── 模擬器按鈕（視窗左下角固定）── */
.sim-launch-btn {
  position: fixed; bottom: 16px; left: 16px; z-index: 100;
  font-size: 10px; padding: 4px 10px; border-radius: 4px;
  border: 1px dashed var(--border-light); background: var(--bg-card);
  color: var(--text-dim); cursor: pointer; opacity: .7;
}
.sim-launch-btn:hover { opacity: 1; border-color: var(--accent-light); color: var(--accent); }

/* ── 右側裝備面板 ── */
.setup-right {
  width: 100%; max-width: 300px;
  padding: 20px 16px;
  min-height: 400px;
  align-self: flex-start;
}

/* ── 滑入動畫 ── */
.equip-slide-enter-active { transition: opacity .25s, transform .25s; }
.equip-slide-leave-active { transition: opacity .15s, transform .15s; }
.equip-slide-enter-from   { opacity: 0; transform: translateX(20px); }
.equip-slide-leave-to     { opacity: 0; transform: translateX(20px); }

/* 手機：單列 */
@media (max-width: 767px) {
  .setup-screen { flex-direction: column; align-items: center; padding: 12px; }
  .setup-right  { max-width: 400px; }
  .sim-launch-btn { bottom: 12px; left: 12px; }
}
</style>

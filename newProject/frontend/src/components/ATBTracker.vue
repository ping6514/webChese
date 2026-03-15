<template>
  <div class="atb-tracker" :class="{ 'atb-tracker--collapsed': collapsed }">
    <!-- 標題列 + 收合 + 模式切換 -->
    <div class="atb-header">
      <button class="atb-collapse-btn" @click="collapsed = !collapsed" :title="collapsed ? '展開' : '收合'">
        {{ collapsed ? '▲' : '▼' }}
      </button>
      <span v-if="!collapsed" class="atb-title">ATB 時間軸</span>
      <div v-if="!collapsed" class="atb-mode-toggle" title="切換時間模式">
        <button
          class="mode-btn"
          :class="{ 'mode-btn--active': game.atbMode === 'instant' }"
          @click="game.setAtbMode('instant')"
        >⚡ 瞬間</button>
        <button
          class="mode-btn"
          :class="{ 'mode-btn--active': game.atbMode === 'timer' }"
          @click="game.setAtbMode('timer')"
        >⏱ 計時</button>
      </div>
    </div>

    <!-- 單位列表 -->
    <div v-if="!collapsed" class="atb-list">
      <div
        v-for="row in rows"
        :key="row.unitId"
        class="atb-row"
        :class="{
          'atb-row--player':  row.kind === 'player',
          'atb-row--monster': row.kind === 'monster',
          'atb-row--pending': row.isPending,
        }"
      >
        <!-- 名稱 -->
        <div class="atb-name" :title="row.name">
          <span class="atb-name-text">{{ row.name }}</span>
          <span v-if="row.isPending" class="atb-badge">行動</span>
          <span v-else-if="row.isCasting" class="atb-badge atb-badge--cast">讀條</span>
          <span v-else-if="row.isRecovery" class="atb-badge atb-badge--rec">硬直</span>
        </div>

        <!-- ATB 條 -->
        <div class="atb-bars">
          <!-- ATB 充能條 -->
          <div class="bar-track">
            <div
              class="bar-fill"
              :class="row.kind === 'player' ? 'bar-player' : 'bar-monster'"
              :style="{ width: row.atbPct + '%' }"
            />
          </div>

          <!-- 讀條 / 硬直條（有時顯示） -->
          <div v-if="row.isCasting || row.isRecovery" class="bar-track bar-track--sub">
            <div
              class="bar-fill"
              :class="row.isCasting ? 'bar-cast' : 'bar-recovery'"
              :style="{ width: (100 - row.subPct) + '%' }"
            />
          </div>
        </div>

        <!-- HP -->
        <div class="atb-hp">{{ row.hp }}/{{ row.maxHp }}</div>
      </div>

      <div v-if="rows.length === 0" class="atb-empty">無單位</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useGameStore } from '@/stores/game'

const game = useGameStore()
const collapsed = ref(false)

const rows = computed(() => {
  const gs = game.gameState
  if (!gs) return []

  return gs.timeline.entries
    .map(entry => {
      const unit = gs.units[entry.unitId]
      if (!unit || unit.isDead) return null

      const isPending  = gs.timeline.pendingUnitId === entry.unitId
      const isCasting  = entry.castRemaining > 0
      const isRecovery = entry.recoveryRemaining > 0

      // 讀條 / 硬直的百分比（剩餘比例，0=完成，100=剛開始）
      // 我們只知道剩餘 ms，不知道原始 ms，所以用相對百分比（剩餘 / 最大 cast 時間）
      // 簡易：顯示剩餘 ms 對 2000ms 的比（封底）
      const subRaw = isCasting ? entry.castRemaining : entry.recoveryRemaining
      const subPct = Math.min(100, (subRaw / 2000) * 100)

      return {
        unitId:     entry.unitId,
        name:       unit.name,
        kind:       unit.kind,
        atbPct:     Math.min(100, entry.atb),
        isPending,
        isCasting,
        isRecovery,
        subPct,           // 剩餘比例（大 = 剩餘多）
        hp:    unit.currentHP,
        maxHp: unit.maxHP,
      }
    })
    .filter(Boolean)
    // 排序：玩家在前，同類依 ATB 降序（最接近行動的在上）
    .sort((a, b) => {
      if (a!.isPending !== b!.isPending) return a!.isPending ? -1 : 1
      if (a!.kind !== b!.kind) return a!.kind === 'player' ? -1 : 1
      return b!.atbPct - a!.atbPct
    }) as NonNullable<ReturnType<typeof rows.value[0] extends null ? never : (typeof rows.value)[0]>>[]
})
</script>

<style scoped>
.atb-tracker {
  position: fixed;
  bottom: 12px;
  left: 72px;   /* 左側導航欄寬度 64px + 8px 間隔 */
  z-index: 60;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  min-width: 220px;
  max-width: 260px;
  box-shadow: 0 4px 12px rgba(0,0,0,.3);
  font-size: 11px;
}
.atb-tracker--collapsed { min-width: 0; }

/* ── 標題列 ── */
.atb-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}
.atb-collapse-btn {
  background: transparent; border: none;
  color: var(--text-dim); cursor: pointer;
  font-size: 10px; padding: 2px 4px;
  border-radius: 3px;
  flex-shrink: 0;
}
.atb-collapse-btn:hover { background: var(--accent-bg); color: var(--accent); }
.atb-title {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-dim);
  flex: 1;
  white-space: nowrap;
}

/* ── 模式切換 ── */
.atb-mode-toggle {
  display: flex;
  gap: 2px;
}
.mode-btn {
  font-size: 9px;
  padding: 2px 5px;
  border-radius: 4px;
  border: 1px solid var(--border-light);
  background: var(--bg-card);
  color: var(--text-dim);
  cursor: pointer;
  white-space: nowrap;
  transition: background .1s, border-color .1s;
}
.mode-btn:hover { background: var(--accent-bg); }
.mode-btn--active {
  background: var(--accent-bg);
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 600;
}

/* ── 列表 ── */
.atb-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 6px;
  max-height: 240px;
  overflow-y: auto;
}

.atb-empty { color: var(--text-dim); text-align: center; padding: 8px 0; }

/* ── 每行 ── */
.atb-row {
  display: grid;
  grid-template-columns: 80px 1fr 46px;
  align-items: center;
  gap: 4px;
  padding: 3px 4px;
  border-radius: 4px;
  border: 1px solid transparent;
}
.atb-row--player  { background: rgba(26,95,160,.06); }
.atb-row--monster { background: rgba(139,32,32,.06); }
.atb-row--pending {
  border-color: var(--accent-light);
  background: var(--accent-bg);
}

.atb-name {
  display: flex;
  align-items: center;
  gap: 3px;
  overflow: hidden;
}
.atb-name-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  font-size: 10px;
  color: var(--text);
}
.atb-badge {
  font-size: 8px;
  padding: 1px 3px;
  border-radius: 2px;
  background: var(--accent);
  color: #fff;
  flex-shrink: 0;
}
.atb-badge--cast    { background: #8b4eb5; }
.atb-badge--rec     { background: #c47a1e; }

/* ── 條 ── */
.atb-bars {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.bar-track {
  height: 6px;
  background: var(--border-light);
  border-radius: 3px;
  overflow: hidden;
}
.bar-track--sub { height: 4px; }

.bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width .1s linear;
}
.bar-player  { background: var(--cell-player, #1a5fa0); }
.bar-monster { background: var(--cell-monster, #8b2020); }
.bar-cast    { background: #8b4eb5; }
.bar-recovery { background: #c47a1e; }

.atb-hp {
  font-size: 9px;
  color: var(--text-dim);
  text-align: right;
  white-space: nowrap;
}

/* 手機 → 隱藏（避免遮擋棋盤） */
@media (max-width: 767px) {
  .atb-tracker { display: none; }
}
</style>

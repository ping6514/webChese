<template>
  <div class="phase-screen">
    <div class="phase-card panel">
      <h2 class="phase-title">層間打寶</h2>
      <p class="phase-sub">選取戰利品</p>

      <div v-if="lootPhase" class="loot-options">
        <div
          v-for="opt in lootPhase.options"
          :key="opt.instanceId"
          class="loot-opt"
          :class="{ 'loot-opt--taken': opt.isOpened }"
        >
          <div class="loot-hint">
            <span class="loot-rarity" :class="`rarity-${opt.hint.rarity}`">{{ opt.hint.rarity }}</span>
            <span class="loot-type">{{ opt.hint.itemType }}</span>
            <span v-if="opt.hint.slot" class="loot-slot">{{ opt.hint.slot }}</span>
          </div>
          <div class="loot-tags">{{ opt.hint.usableTags.join(' / ') }}</div>
          <button
            class="btn btn--primary"
            :disabled="opt.isOpened || lootPhase.picksRemaining <= 0"
            @click="onOpenOption(opt.instanceId)"
          >
            {{ opt.isOpened ? (opt.takenByPlayerId ? '已取走' : '已開啟') : '選取' }}
          </button>
        </div>
      </div>

      <div class="bonus-gold" v-if="lootPhase?.bonusGold">
        💰 獲得 {{ lootPhase.bonusGold }} 金
      </div>

      <div class="picks-left" v-if="lootPhase">
        剩餘選擇次數：{{ lootPhase.picksRemaining }}
      </div>

      <button class="btn btn--primary confirm-btn" @click="onDone">
        完成，前往路徑選擇
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { useInventoryStore } from '@/stores/inventory'
import type { FrozenArmor } from '@engine/item'

const game = useGameStore()
const inventory = useInventoryStore()

const lootPhase = computed(() => game.gameState?.run.lootPhase ?? null)

function onOpenOption(instanceId: string) {
  const unitId = game.playerUnits[0]?.id
  if (!unitId) return
  game.dispatchAction({ type: 'OPEN_OPTION', instanceId, playerId: unitId })
}

function onDone() {
  // 把本輪 awarded 的物品存入背包
  const lp = lootPhase.value
  if (lp) {
    const armorItems: FrozenArmor[] = []
    for (const items of Object.values(lp.awarded)) {
      for (const item of items) {
        if (item.kind === 'armor') armorItems.push(item as FrozenArmor)
      }
    }
    if (armorItems.length > 0) inventory.addArmorToStash(armorItems)

    // 強制將 lootPhase 標為 done，避免 SELECT_PATH 被引擎阻擋
    if (lp.phase !== 'done' && game.gameState) {
      game.gameState = {
        ...game.gameState,
        run: { ...game.gameState.run, lootPhase: { ...lp, phase: 'done' } },
      }
    }
  }
  game.phase = 'path'
}
</script>

<style scoped>
.phase-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--bg);
}
.phase-card {
  width: 100%;
  max-width: 480px;
  padding: 28px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.phase-title { font-size: 22px; font-weight: 700; color: var(--accent); text-align: center; }
.phase-sub   { text-align: center; color: var(--text-dim); font-size: 13px; margin-top: -8px; }

.loot-options { display: flex; flex-direction: column; gap: 8px; }
.loot-opt {
  padding: 10px 12px;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  background: var(--bg-card);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.loot-opt--taken { opacity: .5; }

.loot-hint { display: flex; gap: 8px; align-items: center; }
.loot-rarity { font-size: 11px; font-weight: 700; padding: 1px 6px; border-radius: 3px; }
.rarity-common  { background: #e0e0e0; color: #555; }
.rarity-rare    { background: #d0e8ff; color: var(--blue); }
.rarity-elite   { background: #e8d0ff; color: var(--purple); }
.loot-type  { font-size: 12px; color: var(--text); }
.loot-slot  { font-size: 11px; color: var(--text-dim); }
.loot-tags  { font-size: 11px; color: var(--text-dim); }

.bonus-gold { text-align: center; font-weight: 600; color: var(--gold); }
.picks-left { text-align: center; font-size: 12px; color: var(--text-dim); }
.confirm-btn { width: 100%; padding: 10px; font-size: 14px; font-weight: 600; }
</style>

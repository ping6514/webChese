<template>
  <div class="dungeon-root">
    <!-- 設定畫面 -->
    <DungeonSetup v-if="game.phase === 'setup'" />

    <!-- 戰鬥場景 -->
    <CombatScene
      v-else-if="game.phase === 'combat'"
      @action="handleAction"
    />

    <!-- 打寶 / 路徑選擇（MVP1 暫時簡單佔位） -->
    <LootPhase v-else-if="game.phase === 'loot'" />
    <PathSelect v-else-if="game.phase === 'path'" />

    <!-- Game Over -->
    <GameOverScreen v-else-if="game.phase === 'gameover'" />
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '@/stores/game'
import type { Action } from '@engine/actions'
import DungeonSetup from './DungeonSetup.vue'
import CombatScene from '@/components/CombatScene.vue'
import LootPhase from '@/components/LootPhase.vue'
import PathSelect from '@/components/PathSelect.vue'
import GameOverScreen from '@/components/GameOverScreen.vue'

const game = useGameStore()

function handleAction(action: Action) {
  game.dispatchAction(action)
}
</script>

<style scoped>
.dungeon-root {
  width: 100%;
  min-height: 100vh;
}
</style>

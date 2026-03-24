<template>
  <div class="game" v-if="gs">
    <!-- 頂部資訊欄 -->
    <div class="topbar">
      <div class="player-info p1">
        <span class="player-label">P1</span>
        <span class="walls">城牆: {{ gs.cityWalls.p1 }} / 4</span>
        <span class="hand-count">手牌: {{ gs.players.p1.hand.length }}</span>
      </div>
      <div class="turn-info">
        <div class="turn">回合 {{ gs.turn }}</div>
        <div class="phase">{{ phaseLabel }}</div>
        <div class="current-player" :class="gs.currentPlayer">
          {{ gs.currentPlayer === 'p1' ? 'P1' : 'P2' }} 的回合
        </div>
      </div>
      <div class="player-info p2">
        <span class="player-label">P2</span>
        <span class="walls">城牆: {{ gs.cityWalls.p2 }} / 4</span>
        <span class="hand-count">手牌: {{ gs.players.p2.hand.length }}</span>
      </div>
    </div>

    <!-- 威嚇反應選擇彈窗 -->
    <ReactionChoiceModal />

    <!-- 勝利提示 -->
    <div class="winner-overlay" v-if="gs.winner">
      <div class="winner-box">
        <h2>{{ gs.winner === 'p1' ? 'P1' : 'P2' }} 勝利！</h2>
        <p>{{ gs.winReason }}</p>
        <button @click="goHome">返回主頁</button>
      </div>
    </div>

    <!-- 主場地 -->
    <div class="field">
      <!-- P2 主堡區 -->
      <ZonePanel zone="p2_base" :active-bg-id="gs.actingBGId" />
      <!-- 廣場區 -->
      <ZonePanel zone="plaza" :active-bg-id="gs.actingBGId" />
      <!-- P1 主堡區 -->
      <ZonePanel zone="p1_base" :active-bg-id="gs.actingBGId" />
    </div>

    <!-- 磚堆區 -->
    <div class="brick-row">
      <BrickAreaPanel area-id="p2_base" label="P2主堡磚" />
      <BrickAreaPanel area-id="p2_plaza" label="P2廣場磚" />
      <BrickAreaPanel area-id="p1_plaza" label="P1廣場磚" />
      <BrickAreaPanel area-id="p1_base" label="P1主堡磚" />
    </div>

    <!-- 行動面板 -->
    <div class="action-panel">
      <div v-if="isBotTurn" class="bot-thinking">🤖 Bot 思考中…</div>
      <ActionPanel v-else />
    </div>

    <!-- 選擇模式提示列 -->
    <SelectionBar />

    <!-- 手牌 -->
    <div class="hand-panel">
      <HandPanel />
    </div>

    <!-- 錯誤提示 -->
    <div class="error-bar" v-if="game.error">
      ⚠ {{ game.error }}
    </div>
  </div>
  <div v-else class="no-game">
    <p>尚未開始遊戲</p>
    <button @click="goHome">返回主頁</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../stores/game'
import ZonePanel from '../components/ZonePanel.vue'
import BrickAreaPanel from '../components/BrickAreaPanel.vue'
import ActionPanel from '../components/ActionPanel.vue'
import HandPanel from '../components/HandPanel.vue'
import SelectionBar from '../components/SelectionBar.vue'
import ReactionChoiceModal from '../components/ReactionChoiceModal.vue'

const router = useRouter()
const game = useGameStore()
const gs = computed(() => game.state)

const phaseLabels: Record<string, string> = {
  draw: '補充階段', main: '主要階段', action: '行動階段', react: '反應階段', end: '結束階段',
}
const phaseLabel = computed(() => phaseLabels[gs.value?.phase ?? ''] ?? '')

const isBotTurn = computed(() => game.pveMode && gs.value?.currentPlayer !== game.localPlayer)

function goHome() { router.push('/') }
</script>

<style scoped>
.game { display: flex; flex-direction: column; min-height: 100vh; gap: 0.5rem; padding: 0.5rem; }
.topbar {
  display: flex; justify-content: space-between; align-items: center;
  background: #ede8dc; border: 1px solid #c0b5a5; border-radius: 8px; padding: 0.7rem 1rem;
}
.player-info { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.9rem; }
.player-label { font-weight: bold; font-size: 1.1rem; }
.walls { color: #b8820a; }
.hand-count { color: #7a6a58; }
.turn-info { text-align: center; }
.turn { font-size: 1.2rem; font-weight: bold; }
.phase { color: #1a8090; }
.current-player { font-size: 0.85rem; }
.current-player.p1 { color: #1a5090; }
.current-player.p2 { color: #901a3a; }
.field { display: flex; gap: 0.5rem; }
.brick-row { display: flex; gap: 0.5rem; }
.action-panel, .hand-panel { background: #ede8dc; border: 1px solid #c0b5a5; border-radius: 8px; padding: 0.7rem; }
.error-bar {
  background: #f0d4d4; color: #7a1010; border: 1px solid #c07070; padding: 0.5rem 1rem;
  border-radius: 6px; font-size: 0.85rem;
}
.winner-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.winner-box {
  background: #f5f0e8; border: 2px solid #b8820a; border-radius: 12px;
  padding: 2rem 3rem; text-align: center;
}
.winner-box h2 { font-size: 2rem; color: #b8820a; margin-bottom: 1rem; }
.winner-box button {
  margin-top: 1rem; padding: 0.6rem 1.5rem;
  background: #b8820a; color: #fff; border: none; border-radius: 6px;
  cursor: pointer; font-size: 1rem;
}
.no-game { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; gap: 1rem; }
.no-game button { padding: 0.6rem 1.5rem; background: #b8820a; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
.bot-thinking { color: #1a8090; font-style: italic; padding: 0.5rem; animation: blink 1s infinite; }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
</style>

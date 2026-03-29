<template>
  <div class="game" v-if="gs">
    <!-- 頂部資訊欄 -->
    <div class="topbar" :class="`active-${gs.currentPlayer}`">
      <div class="player-info p1" :class="{ 'is-active': gs.currentPlayer === 'p1' }">
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
        <Transition name="bot-badge">
          <div v-if="isBotTurn" class="bot-badge">🤖 思考中…</div>
        </Transition>
        <button class="surrender-btn" @click="surrender">投降</button>
      </div>
      <div class="player-info p2" :class="{ 'is-active': gs.currentPlayer === 'p2' }">
        <span class="player-label">P2</span>
        <span class="walls">城牆: {{ gs.cityWalls.p2 }} / 4</span>
        <span class="hand-count">手牌: {{ gs.players.p2.hand.length }}</span>
      </div>
    </div>

    <!-- 階段跑馬燈 -->
    <PhaseToast />
    <!-- 事件 Toast（反應卡、免疫、KO 等） -->
    <EventToast />

    <!-- 待確認行動蓋板 -->
    <ConfirmOverlay />
    <!-- 守方反應/反擊選擇彈窗 -->
    <InterceptModal />
    <!-- 反應大師：選反應卡 -->
    <ReactionMasterModal />
    <!-- 威嚇反應選擇彈窗 -->
    <ReactionChoiceModal />
    <!-- BG 詳情彈窗（右鍵開啟） -->
    <BGDetailModal />

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
      <ActionPanel v-if="!isBotTurn" />
    </div>

    <!-- 選擇模式提示列 -->
    <SelectionBar />

    <!-- 手牌 -->
    <div class="hand-panel">
      <HandPanel />
    </div>

    <!-- 戰鬥紀錄 -->
    <EventLog />

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
import ConfirmOverlay from '../components/ConfirmOverlay.vue'
import InterceptModal from '../components/InterceptModal.vue'
import ReactionMasterModal from '../components/ReactionMasterModal.vue'
import ReactionChoiceModal from '../components/ReactionChoiceModal.vue'
import BGDetailModal from '../components/BGDetailModal.vue'
import EventLog from '../components/EventLog.vue'
import PhaseToast from '../components/PhaseToast.vue'
import EventToast from '../components/EventToast.vue'

const router = useRouter()
const game = useGameStore()
const gs = computed(() => game.state)

const phaseLabels: Record<string, string> = {
  draw: '補充階段', main: '主要階段', action: '行動階段', react: '反應階段', end: '結束階段',
}
const phaseLabel = computed(() => phaseLabels[gs.value?.phase ?? ''] ?? '')

const isBotTurn = computed(() => game.pveMode && gs.value?.currentPlayer !== game.localPlayer)

function goHome() { router.push('/') }
function surrender() { game.dispatchForCurrentPlayer({ type: 'SURRENDER' }) }
</script>

<style scoped>
.game { display: flex; flex-direction: column; min-height: 100vh; gap: 0.5rem; padding: 0.5rem; }
.topbar {
  display: flex; justify-content: space-between; align-items: center;
  background: #ede8dc; border: 2px solid #c0b5a5; border-radius: 8px; padding: 0.7rem 1rem;
  transition: border-color 0.3s;
}
.topbar.active-p1 { border-color: #1a6eb5; box-shadow: 0 0 8px rgba(26,110,181,0.25); }
.topbar.active-p2 { border-color: #c01a1a; box-shadow: 0 0 8px rgba(192,26,26,0.25); }
.player-info { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.9rem; transition: opacity 0.3s; }
.player-info.is-active { opacity: 1; }
.player-info:not(.is-active) { opacity: 0.5; }
.player-label { font-weight: bold; font-size: 1.1rem; }
.walls { color: #b8820a; }
.hand-count { color: #7a6a58; }
.turn-info { text-align: center; position: relative; min-width: 120px; }
.turn { font-size: 1.2rem; font-weight: bold; }
.phase { color: #1a8090; }
.current-player { font-size: 0.85rem; }
.current-player.p1 { color: #1a5090; }
.current-player.p2 { color: #901a3a; }
.bot-badge {
  display: inline-block; margin-top: 0.3rem;
  font-size: 0.75rem; color: #fff;
  background: #1a8090; padding: 2px 10px; border-radius: 99px;
  animation: botPulse 1s ease-in-out infinite alternate;
}
@keyframes botPulse { from { opacity: 0.6; } to { opacity: 1; } }
.bot-badge-enter-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.bot-badge-leave-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.bot-badge-enter-from, .bot-badge-leave-to { opacity: 0; transform: translateY(-4px); }
.field { display: flex; gap: 0.5rem; }
.brick-row { display: flex; gap: 0.5rem; }
.action-panel, .hand-panel { background: #ede8dc; border: 1px solid #c0b5a5; border-radius: 8px; padding: 0.7rem; }
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
.surrender-btn {
  margin-top: 0.4rem; padding: 0.25rem 0.8rem;
  background: #f0d8d8; color: #7a1010; border: 1px solid #c07070;
  border-radius: 6px; cursor: pointer; font-size: 0.78rem;
  transition: background 0.15s;
}
.surrender-btn:hover { background: #e0b0b0; }
.no-game { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; gap: 1rem; }
.no-game button { padding: 0.6rem 1.5rem; background: #b8820a; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
</style>

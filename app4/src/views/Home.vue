<template>
  <div class="home">
    <h1>BG 卡牌遊戲</h1>
    <p class="subtitle">2 人策略對戰遊戲</p>

    <div class="card-select" v-if="!started">
      <h2>選擇 BG</h2>
      <div class="class-row" v-for="cls in classes" :key="cls">
        <span class="cls-label">{{ cls }}</span>
        <button
          v-for="card in bgsByClass[cls]"
          :key="card.id"
          :class="['card-btn', { selected: p1Picks[cls] === card.id }]"
          @click="p1Picks[cls] = card.id"
        >
          {{ card.name }}
        </button>
      </div>

      <div class="actions">
        <button class="start-btn" @click="startRandom">隨機開始（本機對戰）</button>
        <button class="start-btn" @click="startWithPicks">使用選擇開始（本機對戰）</button>
      </div>
      <div class="actions pve-actions">
        <div class="pve-label">人機對戰：</div>
        <button class="start-btn pve-btn" @click="startPVEAs('p1')">我是P1（先手）</button>
        <button class="start-btn pve-btn" @click="startPVEAs('p2')">我是P2（後手）</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../stores/game'
import { bgsByClass } from '../data/bg-cards'
import type { BGClass } from '../engine'
import type { PlayerId } from '../engine'

const router = useRouter()
const game = useGameStore()
const started = ref(false)
const classes: BGClass[] = ['BOM', 'ATK', 'SHT', 'BLC']

const p1Picks = reactive<Partial<Record<BGClass, string>>>({})

function startRandom() {
  game.startLocalPVP()
  router.push('/game')
}

function startWithPicks() {
  game.startLocalPVP({ p1Cards: p1Picks })
  router.push('/game')
}

function startPVEAs(humanPlayer: 'p1' | 'p2') {
  game.startPVE({ p1Cards: Object.keys(p1Picks).length > 0 ? p1Picks : undefined }, humanPlayer)
  router.push('/game')
}
</script>

<style scoped>
.home { max-width: 800px; margin: 0 auto; padding: 2rem; text-align: center; }
h1 { font-size: 2.5rem; margin-bottom: 0.5rem; color: #e8c97a; }
.subtitle { color: #aaa; margin-bottom: 2rem; }
.card-select { background: #16213e; border-radius: 12px; padding: 1.5rem; text-align: left; }
h2 { color: #e8c97a; margin-bottom: 1rem; }
.class-row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.8rem; }
.cls-label { width: 3rem; font-weight: bold; color: #aaa; }
.card-btn {
  padding: 0.4rem 0.8rem; border: 1px solid #333; border-radius: 6px;
  background: #1a1a2e; color: #eee; cursor: pointer; transition: all 0.2s;
}
.card-btn:hover { border-color: #e8c97a; }
.card-btn.selected { background: #e8c97a; color: #1a1a2e; border-color: #e8c97a; }
.actions { margin-top: 1.5rem; display: flex; gap: 1rem; justify-content: center; }
.start-btn {
  padding: 0.7rem 1.5rem; background: #e8c97a; color: #1a1a2e;
  border: none; border-radius: 8px; cursor: pointer; font-size: 1rem; font-weight: bold;
}
.start-btn:hover { background: #f0d88a; }
.pve-actions { margin-top: 0.5rem; align-items: center; }
.pve-label { color: #9ad4d6; font-size: 0.9rem; white-space: nowrap; }
.pve-btn { background: #1a4a1a; border: 2px solid #4caf50; color: #eee; }
.pve-btn:hover { background: #256325; }
</style>

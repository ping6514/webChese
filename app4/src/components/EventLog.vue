<template>
  <div class="event-log" ref="logEl">
    <div class="log-header">
      <span class="log-title">戰鬥紀錄</span>
      <button class="clear-btn" @click="game.eventLog = []">清除</button>
    </div>
    <div class="log-body" ref="bodyEl">
      <div
        v-for="(entry, i) in logEntries"
        :key="i"
        class="log-entry"
        :class="entry.cls"
      >{{ entry.text }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useGameStore } from '../stores/game'

const game = useGameStore()
const bodyEl = ref<HTMLElement | null>(null)

function bgName(id: string): string {
  return game.state?.bgs[id]?.name ?? id
}
function playerLabel(p: string) { return p === 'p1' ? 'P1' : 'P2' }
function zoneLabel(z: string) {
  return z === 'p1_base' ? 'P1主堡' : z === 'p2_base' ? 'P2主堡' : '廣場'
}

const logEntries = computed(() => {
  return game.eventLog.map(ev => {
    switch (ev.type) {
      case 'turn_start':
        return { text: `══ 回合 ${ev.turn}（${playerLabel(ev.player)}）══`, cls: 'turn' }
      case 'phase_start':
        return { text: `── ${playerLabel(ev.player)} 進入${phaseLabel(ev.phase)}階段 ──`, cls: 'phase' }
      case 'start_bg_action':
        return { text: `▶ ${bgName(ev.bgId)} 開始行動`, cls: 'action' }
      case 'end_bg_action':
        return { text: `◀ ${bgName(ev.bgId)} 結束行動`, cls: 'action' }
      case 'bg_move':
        return { text: `  ${bgName(ev.bgId)} ${zoneLabel(ev.from)} → ${zoneLabel(ev.to)}`, cls: 'move' }
      case 'use_skill':
        return { text: `  ✦ ${bgName(ev.bgId)} 使用【${ev.skillName}】`, cls: 'skill' }
      case 'skill_effect':
        return { text: `    ${bgName(ev.bgId)}: ${ev.detail}`, cls: 'effect' }
      case 'do_attack':
        return { text: `  ⚔ ${bgName(ev.attackerId)} 攻擊 ${bgName(ev.targetId)}（⚔${ev.attackValue}）`, cls: 'attack' }
      case 'take_damage':
        return { text: `    ${bgName(ev.targetId)} 受到 ${ev.damage} 傷害（剩 ${ev.hpLeft}）`, cls: 'damage' }
      case 'attack_blocked':
        return { text: `    ${bgName(ev.targetId)} 攻擊被阻擋【${ev.reason}】`, cls: 'block' }
      case 'bg_stunned':
        return { text: `  ★ ${bgName(ev.bgId)} 暈眩！`, cls: 'stun' }
      case 'bg_ko':
        return { text: `  ✖ ${bgName(ev.bgId)} KO！→ ${zoneLabel(ev.toZone)}`, cls: 'ko' }
      case 'bg_recover':
        return { text: `  ✔ ${bgName(ev.bgId)} ${ev.wasKO ? '復活' : '恢復'}！`, cls: 'recover' }
      case 'siege':
        return { text: `  🏰 ${bgName(ev.attackerId)} 攻城！${playerLabel(ev.defender)} 城牆剩 ${ev.wallsLeft}`, cls: 'siege' }
      case 'walls_destroyed':
        return { text: `  💥 ${playerLabel(ev.defender)} 城牆歸零！`, cls: 'walls' }
      case 'reaction_triggered':
        return { text: `  ⚡ 反應觸發：${ev.reactionId}（${bgName(ev.bgId)}）`, cls: 'reaction' }
      case 'install_reaction':
        return { text: `  🔰 ${bgName(ev.bgId)} 安裝反應卡`, cls: 'reaction' }
      case 'surrender':
        return { text: `  🏳 ${playerLabel(ev.player)} 投降`, cls: 'ko' }
      case 'play_building':
        return { text: `  🏗 ${playerLabel(ev.player)} 打出建築卡`, cls: 'effect' }
      case 'place_brick':
        return { text: `  🧱 ${playerLabel(ev.player)} 堆磚`, cls: 'effect' }
      case 'clear_brick':
        return { text: `  🔨 清磚${ev.building ? '（建築）' : ''}`, cls: 'effect' }
      case 'draw_card':
        return { text: `  🃏 ${playerLabel(ev.player)} 抽牌`, cls: 'draw' }
      case 'repair_wall':
        return { text: `  🔧 ${playerLabel(ev.player)} 修復城牆 +${ev.amount}（現 ${ev.wallsNow}）`, cls: 'recover' }
      default:
        return null
    }
  }).filter(Boolean) as { text: string; cls: string }[]
})

function phaseLabel(p: string) {
  return p === 'draw' ? '補充' : p === 'main' ? '主要' : p === 'action' ? '行動' : p === 'react' ? '反應' : p
}

// 自動滾到底部
watch(() => game.eventLog.length, () => {
  nextTick(() => {
    if (bodyEl.value) bodyEl.value.scrollTop = bodyEl.value.scrollHeight
  })
})
</script>

<style scoped>
.event-log {
  background: #1a1a2a; border: 1px solid #3a3a5a; border-radius: 8px;
  display: flex; flex-direction: column; max-height: 200px;
}
.log-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.3rem 0.6rem; border-bottom: 1px solid #3a3a5a; flex-shrink: 0;
}
.log-title { font-size: 0.75rem; color: #8888aa; font-weight: bold; }
.clear-btn {
  font-size: 0.65rem; padding: 1px 6px; background: #2a2a4a; border: 1px solid #4a4a7a;
  color: #8888aa; border-radius: 3px; cursor: pointer;
}
.clear-btn:hover { background: #3a3a5a; }
.log-body {
  overflow-y: auto; padding: 0.3rem 0.5rem;
  display: flex; flex-direction: column; gap: 1px;
  font-family: monospace; font-size: 0.72rem;
}
.log-entry { padding: 1px 2px; border-radius: 2px; white-space: pre-wrap; line-height: 1.4; }
.turn   { color: #e0c060; font-weight: bold; margin-top: 4px; }
.phase  { color: #6080c0; }
.action { color: #a0a0c0; }
.move   { color: #80c0d0; }
.skill  { color: #c080ff; font-weight: bold; }
.effect { color: #a0c0a0; }
.attack { color: #ff9060; font-weight: bold; }
.damage { color: #ff6040; }
.block  { color: #80c080; }
.stun   { color: #ffe040; font-weight: bold; }
.ko     { color: #ff4040; font-weight: bold; }
.recover{ color: #40e080; }
.siege  { color: #ff8020; font-weight: bold; }
.walls  { color: #ff4020; font-weight: bold; }
.reaction { color: #c0a0ff; }
.draw   { color: #6090a0; }
</style>

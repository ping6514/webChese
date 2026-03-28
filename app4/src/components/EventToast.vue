<template>
  <Transition name="evt-toast">
    <div v-if="current" class="evt-toast" :class="`type-${current.type}`">
      {{ current.text }}
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useGameStore } from '../stores/game'

const game = useGameStore()

interface ToastItem { type: string; text: string }

const queue = ref<ToastItem[]>([])
const current = ref<ToastItem | null>(null)
let timer: ReturnType<typeof setTimeout> | null = null

function bgName(id: string) {
  return game.state?.bgs[id]?.name ?? id
}

function reactionText(reactionId: string): string {
  const map: Record<string, string> = {
    block: '🛡 格擋！',
    counterattack: '⚡ 反擊！',
    intimidate: '😨 威嚇！',
    agile: '💨 靈動！',
    absorb: '🌀 吸收！',
    revive: '✨ 復生！',
  }
  return map[reactionId] ?? `⚡ ${reactionId}`
}

function eventToToast(e: Record<string, unknown>): ToastItem | null {
  switch (e.type) {
    case 'reaction_triggered':
      return {
        type: 'reaction',
        text: `${reactionText(e.reactionId as string)} ${bgName(e.bgId as string)}`,
      }
    case 'attack_blocked':
      return {
        type: 'block',
        text: `🛡 ${bgName(e.targetId as string)} 免疫攻擊！`,
      }
    case 'bg_ko':
      return {
        type: 'ko',
        text: `💀 ${bgName(e.bgId as string)} 被擊倒！`,
      }
    case 'bg_recover':
      return {
        type: 'recover',
        text: `✨ ${bgName(e.bgId as string)} ${e.wasKO ? 'KO 復原' : '解除暈眩'}`,
      }
    case 'walls_destroyed':
      return {
        type: 'walls',
        text: `🏚 ${e.defender === 'p1' ? 'P1' : 'P2'} 城牆全毀！`,
      }
    default:
      return null
  }
}

function showNext() {
  if (queue.value.length === 0) { current.value = null; return }
  current.value = queue.value.shift()!
  timer = setTimeout(() => {
    current.value = null
    setTimeout(showNext, 150)  // brief gap between toasts
  }, 1800)
}

watch(
  () => game.lastEvents,
  (events) => {
    if (!events?.length) return
    const items = events
      .map(e => eventToToast(e as Record<string, unknown>))
      .filter(Boolean) as ToastItem[]
    if (!items.length) return
    queue.value.push(...items)
    if (!current.value) {
      if (timer) clearTimeout(timer)
      showNext()
    }
  },
)

watch(
  () => game.error,
  (err) => {
    if (!err) return
    queue.value.push({ type: 'error', text: `⚠ ${err}` })
    game.error = null
    if (!current.value) {
      if (timer) clearTimeout(timer)
      showNext()
    }
  },
)
</script>

<style scoped>
.evt-toast {
  position: fixed;
  bottom: 30%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 160;
  pointer-events: none;
  padding: 0.55rem 1.4rem;
  border-radius: 20px;
  font-size: 1rem;
  font-weight: bold;
  white-space: nowrap;
  box-shadow: 0 4px 18px rgba(0,0,0,0.3);
  color: #fff;
}

/* 樣式依事件類型 */
.evt-toast.type-reaction  { background: rgba(120, 30, 180, 0.88); border: 2px solid rgba(200,120,255,0.5); }
.evt-toast.type-block     { background: rgba(30, 80, 180, 0.88);  border: 2px solid rgba(100,160,255,0.5); }
.evt-toast.type-ko        { background: rgba(160, 20, 20, 0.88);  border: 2px solid rgba(255,100,100,0.5); }
.evt-toast.type-recover   { background: rgba(20, 130, 60, 0.88);  border: 2px solid rgba(100,220,140,0.5); }
.evt-toast.type-walls     { background: rgba(160, 80, 0, 0.88);   border: 2px solid rgba(255,180,60,0.5); }
.evt-toast.type-error     { background: rgba(160, 20, 20, 0.92);  border: 2px solid rgba(255,80,80,0.6); }

/* Vue Transition */
.evt-toast-enter-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.evt-toast-leave-active { transition: opacity 0.35s ease, transform 0.35s ease; }
.evt-toast-enter-from   { opacity: 0; transform: translateX(-50%) translateY(10px); }
.evt-toast-leave-to     { opacity: 0; transform: translateX(-50%) translateY(-8px); }
</style>

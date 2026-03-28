<template>
  <Transition name="phase-toast">
    <div v-if="visible" class="phase-toast" :class="`player-${player}`">
      <div class="toast-player">{{ playerLabel }}</div>
      <div class="toast-phase">{{ phaseLabel }}</div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useGameStore } from '../stores/game'

const game = useGameStore()

const visible = ref(false)
const player = ref('p1')
const phaseLabel = ref('')
const playerLabel = ref('')

const phaseLabels: Record<string, string> = {
  draw: '補充階段',
  main: '主要階段',
  action: '行動階段',
  react: '反應階段',
}
const playerLabels: Record<string, string> = { p1: 'P1', p2: 'P2' }

let timer: ReturnType<typeof setTimeout> | null = null

function showToast(p: string, phase: string) {
  if (timer) clearTimeout(timer)
  player.value = p
  phaseLabel.value = phaseLabels[phase] ?? phase
  playerLabel.value = playerLabels[p] ?? p
  visible.value = true
  timer = setTimeout(() => { visible.value = false }, 1500)
}

watch(
  () => game.state ? `${game.state.currentPlayer}:${game.state.phase}:${game.state.turn}` : '',
  (val, old) => {
    if (!val || !game.state) return
    const [p, phase] = val.split(':')
    const [, oldPhase] = (old ?? ':').split(':')
    // 跳過 draw 階段（自動過渡，不用特別標示）
    if (phase === 'draw') return
    if (val !== old) showToast(p, phase)
  }
)
</script>

<style scoped>
.phase-toast {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 150;
  pointer-events: none;
  text-align: center;
  padding: 1rem 2.5rem;
  border-radius: 12px;
  backdrop-filter: blur(6px);
  border: 2px solid rgba(255,255,255,0.2);
  min-width: 200px;
}
.phase-toast.player-p1 {
  background: rgba(20, 60, 140, 0.82);
  border-color: rgba(100, 160, 255, 0.5);
  box-shadow: 0 4px 24px rgba(26, 80, 180, 0.6);
}
.phase-toast.player-p2 {
  background: rgba(140, 20, 40, 0.82);
  border-color: rgba(255, 100, 120, 0.5);
  box-shadow: 0 4px 24px rgba(180, 26, 50, 0.6);
}
.toast-player {
  font-size: 0.85rem;
  font-weight: bold;
  color: rgba(255,255,255,0.7);
  letter-spacing: 0.1em;
  margin-bottom: 0.2rem;
}
.toast-phase {
  font-size: 1.6rem;
  font-weight: bold;
  color: #fff;
  letter-spacing: 0.05em;
  text-shadow: 0 0 16px rgba(255,255,255,0.4);
}

/* Vue Transition */
.phase-toast-enter-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.phase-toast-leave-active {
  transition: opacity 0.5s ease, transform 0.5s ease;
}
.phase-toast-enter-from {
  opacity: 0;
  transform: translate(-50%, calc(-50% - 14px));
}
.phase-toast-leave-to {
  opacity: 0;
  transform: translate(-50%, calc(-50% + 10px));
}
</style>

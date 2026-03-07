<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps<{ winner?: unknown }>()
const router = useRouter()

const winnerLabel = computed(() => {
  const w = String(props.winner ?? '')
  if (w === 'red') return '紅方勝利'
  if (w === 'black') return '黑方勝利'
  return '平局'
})

const winnerClass = computed(() => {
  const w = String(props.winner ?? '')
  if (w === 'red') return 'red'
  if (w === 'black') return 'black'
  return ''
})

// Scale fly-in distance down on small screens
const vmin = typeof window !== 'undefined' ? Math.min(window.innerWidth, window.innerHeight) : 600
const s = Math.min(1, vmin / 520)

const DIRS = [
  { x: -460, y: -320, r: -55 },
  { x:    0, y: -520, r:  20 },
  { x:  460, y: -320, r:  55 },
  { x:  540, y:    0, r: -35 },
  { x:  460, y:  320, r:  45 },
  { x:    0, y:  520, r: -20 },
  { x: -460, y:  320, r:  50 },
  { x: -540, y:    0, r: -45 },
]

const chars = computed(() =>
  winnerLabel.value.split('').map((ch, i) => {
    const d = DIRS[i % DIRS.length]
    return {
      ch,
      style: {
        '--tx':  `${Math.round(d.x * s)}px`,
        '--ty':  `${Math.round(d.y * s)}px`,
        '--rot': `${d.r}deg`,
        animationDelay: `${0.4 + i * 0.2}s`,
      },
    }
  })
)

function goHome() {
  router.push({ name: 'home' })
}
</script>

<template>
  <div class="page" :class="winnerClass">

    <!-- BG: colour wash rising from bottom -->
    <div class="bgRise"    :class="winnerClass" />
    <!-- BG: radial bloom -->
    <div class="bgBloom"   :class="winnerClass" />
    <!-- BG: edge vignette -->
    <div class="bgVignette" :class="winnerClass" />

    <!-- Main stage (full-screen, no card) -->
    <div class="stage">

      <!-- Small label -->
      <p class="subtitle">遊 戲 結 束</p>

      <!-- Giant winner text -->
      <h1 class="winnerText" :class="winnerClass">
        <span
          v-for="(item, i) in chars"
          :key="i"
          class="char"
          :style="item.style"
        >{{ item.ch }}</span>
      </h1>

      <!-- Decorative expanding line -->
      <div class="divider" :class="winnerClass" />

      <!-- Button -->
      <button type="button" class="btn" :class="winnerClass" @click="goHome">
        重新選擇
      </button>

    </div>
  </div>
</template>

<style scoped>
/* ── Page ─────────────────────────────────────────────────────────── */
.page {
  min-height: 100svh;
  display: grid;
  place-items: center;
  background: #080810;
  overflow: hidden;
  position: relative;
}

/* ── BG: colour wash from bottom ─────────────────────────────────── */
.bgRise {
  position: fixed; inset: 0;
  pointer-events: none;
  opacity: 0;
  animation: bgRise 2.4s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
}
.bgRise.red {
  background: linear-gradient(to top,
    rgba(210, 30, 30, 0.6)  0%,
    rgba(140, 15, 15, 0.28) 45%,
    transparent              72%);
}
.bgRise.black {
  background: linear-gradient(to top,
    rgba(20, 160, 70, 0.55)  0%,
    rgba(10, 100, 40, 0.26)  45%,
    transparent              72%);
}
@keyframes bgRise {
  from { opacity: 0; transform: translateY(50%); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── BG: radial bloom ─────────────────────────────────────────────── */
.bgBloom {
  position: fixed; inset: 0;
  pointer-events: none;
  opacity: 0;
  animation: bloomIn 3.2s ease-out 0.5s both,
             bloomPulse 4.5s ease-in-out 3.7s infinite alternate;
}
.bgBloom.red {
  background: radial-gradient(ellipse 80% 55% at 50% 52%,
    rgba(230, 50, 50, 0.3) 0%, transparent 65%);
}
.bgBloom.black {
  background: radial-gradient(ellipse 80% 55% at 50% 52%,
    rgba(40, 200, 90, 0.26) 0%, transparent 65%);
}
@keyframes bloomIn {
  from { opacity: 0; transform: scale(0.3); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes bloomPulse {
  from { transform: scale(1);    opacity: 0.75; }
  to   { transform: scale(1.15); opacity: 1; }
}

/* ── BG: vignette ─────────────────────────────────────────────────── */
.bgVignette {
  position: fixed; inset: 0;
  pointer-events: none;
  opacity: 0;
  animation: fadeIn 2.2s ease 0.9s both;
}
.bgVignette.red   { box-shadow: inset 0 0 140px rgba(200, 35, 35, 0.4); }
.bgVignette.black { box-shadow: inset 0 0 140px rgba(20, 180, 80, 0.35); }

/* ── Stage ────────────────────────────────────────────────────────── */
.stage {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(20px, 5vh, 40px);
  padding: 24px 20px;
  width: 100%;
}

/* ── Subtitle ─────────────────────────────────────────────────────── */
.subtitle {
  margin: 0;
  font-size: clamp(0.85rem, 3vw, 1.25rem);
  letter-spacing: 0.35em;
  color: rgba(232, 216, 160, 0.6);
  opacity: 0;
  animation: slideDown 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0s both;
}

/* ── Winner text ──────────────────────────────────────────────────── */
.winnerText {
  margin: 0;
  font-size: clamp(3.2rem, 13vw, 6.5rem);
  font-weight: 900;
  letter-spacing: 0.2em;
  display: flex;
  gap: clamp(2px, 1vw, 8px);
  line-height: 1;
}
.winnerText.red {
  color: #ff8888;
  text-shadow:
    0 0 30px rgba(255, 80, 80, 0.9),
    0 0 70px rgba(200, 30, 30, 0.5),
    0 2px 4px rgba(0,0,0,0.6);
}
.winnerText.black {
  color: #7deca1;
  text-shadow:
    0 0 30px rgba(60, 220, 110, 0.9),
    0 0 70px rgba(20, 160, 70, 0.55),
    0 2px 4px rgba(0,0,0,0.6);
}

/* ── Character fly-in ─────────────────────────────────────────────── */
.char {
  display: inline-block;
  opacity: 0;
  animation: flyIn 0.9s cubic-bezier(0.34, 1.52, 0.64, 1) both;
}
@keyframes flyIn {
  0% {
    opacity: 0;
    transform: translate(var(--tx), var(--ty)) scale(0.06) rotate(var(--rot));
    filter: blur(16px);
  }
  50% { opacity: 1; filter: blur(2px); }
  75% {
    transform: translate(0, 0) scale(1.14) rotate(calc(var(--rot) * -0.04));
    filter: blur(0);
  }
  100% {
    opacity: 1;
    transform: translate(0, 0) scale(1) rotate(0deg);
    filter: blur(0);
  }
}

/* ── Decorative line expanding from centre ───────────────────────── */
.divider {
  height: 1px;
  width: 0;
  /* appear after last char lands: 0.4 + 3×0.2 + 0.9 = 1.9s → delay 2s */
  animation: lineExpand 0.9s cubic-bezier(0.22, 1, 0.36, 1) 2s both;
  max-width: min(380px, 80vw);
}
.divider.red   { background: linear-gradient(to right, transparent, rgba(255,100,100,0.7), transparent); }
.divider.black { background: linear-gradient(to right, transparent, rgba(60,210,110,0.7), transparent); }
@keyframes lineExpand {
  from { width: 0; opacity: 0; }
  to   { width: min(380px, 80vw); opacity: 1; }
}

/* ── Button ───────────────────────────────────────────────────────── */
.btn {
  opacity: 0;
  animation: fadeUp 1s ease 2.4s both;
  padding: clamp(10px, 2.5vh, 14px) clamp(32px, 10vw, 56px);
  border-radius: 10px;
  font-size: clamp(13px, 3.5vw, 16px);
  font-weight: 700;
  letter-spacing: 0.12em;
  cursor: pointer;
  background: rgba(200, 160, 60, 0.14);
  border: 1px solid rgba(200, 160, 60, 0.45);
  color: #e8d8a0;
  transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
}
.btn:hover {
  background: rgba(200, 160, 60, 0.28);
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(200, 160, 60, 0.2);
}
.btn:active { transform: translateY(0); }

/* ── Shared keyframes ─────────────────────────────────────────────── */
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-24px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0)      scale(1); }
}
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
</style>

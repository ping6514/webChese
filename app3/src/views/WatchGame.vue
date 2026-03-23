<script setup lang="ts">
import { ref, computed, onUnmounted, toRaw } from 'vue'
import { useRouter } from 'vue-router'
import { createInitialState, totalToughness, totalAttack, totalSupport } from '../engine/state'
import type { LeaderInstance } from '../engine/state'
import { reduce } from '../engine/reduce'
import { decideAction } from '../sim/bot'
import type { GameEvent } from '../engine/events'
import type { Action } from '../engine/actions'

const router = useRouter()

// ── 遊戲狀態 ──────────────────────────────────────
const seed = ref(Date.now())
const gameState = ref(createInitialState({ rngSeed: seed.value }))
const eventLog = ref<GameEvent[]>([])
const lastActionDesc = ref('等待開始…')
const playing = ref(false)
const speed = ref<0 | 100 | 400 | 1000>(400)
let timerId: ReturnType<typeof setTimeout> | null = null
let stepSeed = seed.value + 1

// ── 輔助函式 ──────────────────────────────────────
const CLASS_EMOJI: Record<string, string> = {
  destroyer: '🔥',
  conqueror: '⚡',
  commander: '📯',
  guardian:  '🛡️',
}
const ZONE_LABEL: Record<string, string> = {
  p1_base: 'P1 基地',
  plaza:   '廣場',
  p2_base: 'P2 基地',
}

function classEmoji(c: string) { return CLASS_EMOJI[c] ?? '⚔️' }
function zoneLabel(z: string)  { return ZONE_LABEL[z] ?? z }

function stateBadge(s: string): { text: string; cls: string } {
  switch (s) {
    case 'stunned':  return { text: '暈眩',  cls: 'badge-stunned' }
    case 'ko':       return { text: 'KO',    cls: 'badge-ko' }
    case 'reviving': return { text: '復活中', cls: 'badge-reviving' }
    default:         return { text: '正常',  cls: 'badge-normal' }
  }
}

function formatAction(a: Action): string {
  const s = gameState.value
  const cp = s.currentPlayer === 'p1' ? 'P1' : 'P2'
  const ph = ({ main: '主', battle: '戰鬥', react: '反應' } as Record<string,string>)[s.phase] ?? s.phase
  const pre = `[${cp}·${ph}] `
  const L = (id: string) => s.leaders[id]?.name ?? id
  switch (a.type) {
    case 'NEXT_PHASE':       return pre + '結束階段'
    case 'MOVE':             return pre + `${L(a.leaderId)} → ${zoneLabel(a.toZone)}`
    case 'ATTACK':           return pre + `${L(a.attackerId)} ⚔️ ${L(a.targetId)}`
    case 'CLEAR_FORT':       return pre + `${L(a.leaderId)} 清磚`
    case 'SIEGE':            return pre + `${L(a.leaderId)} 🏹 攻城！`
    case 'SKILL':            return pre + `${L(a.leaderId)} 使用技能`
    case 'SUMMON_LEGION':    return pre + `${L(a.leaderId)} 召喚軍團`
    case 'INSTALL_TACTICAL': return pre + `${L(a.leaderId)} 安裝戰術卡`
    case 'PLAY_EVENT':       return pre + `打出事件卡 [${a.cardId}]`
    case 'SURRENDER':        return pre + `投降`
    default:                 return pre + (a as { type: string }).type
  }
}

function formatEvent(e: GameEvent): string {
  const L = (id: string) => gameState.value.leaders[id]?.name ?? id
  switch (e.type) {
    case 'TURN_STARTED':
      return `🔄 第 ${e.turn} 回合 — ${e.player === 'p1' ? 'P1' : 'P2'}`
    case 'PHASE_CHANGED':
      return `▶ ${e.player === 'p1' ? 'P1' : 'P2'} · ${{ main:'主', battle:'戰鬥', react:'反應' }[e.to] ?? e.to}階段`
    case 'ATTACK_RESOLVED': {
      const r = ({ ko:'KO', stunned:'擊暈', no_effect:'無效' } as Record<string,string>)[e.result] ?? e.result
      return `⚔️ ${L(e.attackerId)} 攻 ${L(e.targetId)} — 傷${e.damage} [${r}]`
    }
    case 'LEADER_KO':
      return `💀 ${L(e.leaderId)} KO → ${zoneLabel(e.returnedTo)}`
    case 'LEADER_STUNNED':
      return `😵 ${L(e.leaderId)} 暈眩`
    case 'STUN_RECOVERED':
      return `✨ ${L(e.leaderId)} 解除暈眩`
    case 'LEADER_REVIVED':
      return `💚 ${L(e.leaderId)} 復活`
    case 'LEADER_MOVED':
      return `🚶 ${L(e.leaderId)} ${zoneLabel(e.from)}→${zoneLabel(e.to)}`
    case 'FORT_CLEARED':
      return `🏚️ ${L(e.leaderId)} 清磚 剩${e.newFortLevel}`
    case 'CITY_WALL_DAMAGED':
      return `🧱 ${e.player === 'p1' ? 'P1' : 'P2'} 城牆 剩${e.remaining}`
    case 'SKILL_USED':
      return `✨ ${L(e.leaderId)}「${e.skillName}」${e.effectDesc}`
    case 'LEGION_SUMMONED':
      return `🐉 ${L(e.leaderId)} 召喚 ${e.cardName}`
    case 'TACTICAL_INSTALLED':
      return `🃏 ${L(e.leaderId)} 裝戰術 ${e.cardName}`
    case 'TACTICAL_TRIGGERED':
      return `🛡️ ${L(e.leaderId)} 觸發「${e.cardName}」`
    case 'EVENT_PLAYED':
      return `🎴 ${e.player === 'p1' ? 'P1' : 'P2'} 打出「${e.cardName}」`
    case 'PASSIVE_TRIGGERED':
      return `💡 ${L(e.leaderId)} 被動 ${e.desc}`
    case 'GAME_OVER':
      return `🏆 ${e.winner === 'p1' ? 'P1' : 'P2'} 獲勝！(${e.reason})`
    case 'LEADER_IMMOBILIZED':
      return `🔒 ${L(e.leaderId)} 被禁錮`
    case 'LEADER_FREED':
      return `🔓 ${L(e.leaderId)} 解除禁錮`
    case 'LEADER_PUSHED_BACK':
      return `↩️ ${L(e.leaderId)} 被推回 ${zoneLabel(e.to)}`
    case 'CARD_DRAWN':
      return `🃏 ${e.player === 'p1' ? 'P1' : 'P2'} 抽牌`
    default:
      return `• ${e.type}`
  }
}

function eventColor(e: GameEvent): string {
  switch (e.type) {
    case 'ATTACK_RESOLVED':     return '#fbbf24'
    case 'LEADER_KO':           return '#f87171'
    case 'LEADER_STUNNED':      return '#fb923c'
    case 'CITY_WALL_DAMAGED':   return '#f472b6'
    case 'FORT_CLEARED':        return '#c084fc'
    case 'SKILL_USED':          return '#34d399'
    case 'TACTICAL_TRIGGERED':  return '#a78bfa'
    case 'EVENT_PLAYED':        return '#60a5fa'
    case 'LEGION_SUMMONED':     return '#67e8f9'
    case 'GAME_OVER':           return '#22d3ee'
    case 'TURN_STARTED':        return '#f1f5f9'
    case 'PHASE_CHANGED':       return '#c084fc'
    case 'LEADER_MOVED':        return '#94a3b8'
    default:                    return '#4b5563'
  }
}

// ── Computed ──────────────────────────────────────
const leadersByZone = computed(() => {
  const m: Record<string, LeaderInstance[]> = { p1_base: [], plaza: [], p2_base: [] }
  for (const l of Object.values(gameState.value.leaders)) {
    m[l.zone]?.push(l)
  }
  // P1 leaders first in P1 zones, P2 leaders first in P2 zones
  m.p1_base.sort((a, b) => (a.owner === 'p1' ? -1 : 1) - (b.owner === 'p1' ? -1 : 1))
  m.p2_base.sort((a, b) => (a.owner === 'p2' ? -1 : 1) - (b.owner === 'p2' ? -1 : 1))
  return m
})

const phaseLabel = computed(() =>
  ({ main: '主階段', battle: '戰鬥階段', react: '反應階段' } as Record<string,string>)[gameState.value.phase] ?? ''
)

// ── 核心 Step ─────────────────────────────────────
function step() {
  const s = toRaw(gameState.value)
  if (s.winner) { playing.value = false; return }

  const player = s.currentPlayer
  let action: Action
  try {
    action = decideAction(s, player, { seed: stepSeed++, epsilon: 0.1 })
  } catch {
    action = { type: 'NEXT_PHASE' }
  }

  lastActionDesc.value = formatAction(action)

  const result = reduce(s, action)
  if (result.ok) {
    // 推入事件到日誌頂部
    for (const e of result.events) {
      eventLog.value.unshift(e)
    }
    if (eventLog.value.length > 60) eventLog.value.length = 60
    gameState.value = result.state
  } else {
    // guard 阻擋：強制跳過
    const fallback = reduce(s, { type: 'NEXT_PHASE' })
    if (fallback.ok) {
      for (const e of fallback.events) eventLog.value.unshift(e)
      if (eventLog.value.length > 60) eventLog.value.length = 60
      gameState.value = fallback.state
      lastActionDesc.value = `[guard拒絕: ${result.reason}] → 跳相`
    }
  }
}

function scheduleNext() {
  if (!playing.value || speed.value === 0) return
  timerId = setTimeout(() => {
    step()
    if (!gameState.value.winner) scheduleNext()
    else playing.value = false
  }, speed.value)
}

function togglePlay() {
  if (gameState.value.winner) return
  playing.value = !playing.value
  if (playing.value) scheduleNext()
  else if (timerId) { clearTimeout(timerId); timerId = null }
}

function setSpeed(s: 0 | 100 | 400 | 1000) {
  if (timerId) { clearTimeout(timerId); timerId = null }
  speed.value = s
  if (playing.value && s > 0) scheduleNext()
}

function manualStep() {
  step()
  if (gameState.value.winner) playing.value = false
}

function restart() {
  if (timerId) { clearTimeout(timerId); timerId = null }
  playing.value = false
  seed.value = Date.now()
  stepSeed = seed.value + 1
  eventLog.value = []
  lastActionDesc.value = '等待開始…'
  gameState.value = createInitialState({ rngSeed: seed.value })
}

onUnmounted(() => { if (timerId) clearTimeout(timerId) })
</script>

<template>
  <div class="watch-page">

    <!-- Header -->
    <header class="watch-header">
      <button class="btn-back" @click="router.push('/')">← 返回</button>
      <h1>觀戰模式</h1>
      <div class="turn-info">
        <template v-if="!gameState.winner">
          第 <strong>{{ gameState.turn }}</strong> 回合 ·
          <span :class="gameState.currentPlayer === 'p1' ? 'tag-p1' : 'tag-p2'">
            {{ gameState.currentPlayer === 'p1' ? 'P1 先攻' : 'P2 後攻' }}
          </span>
          · {{ phaseLabel }}
        </template>
        <span v-else class="winner-banner">
          🏆 {{ gameState.winner === 'p1' ? 'P1' : 'P2' }} 獲勝！
          ({{ gameState.winReason }}) · 共 {{ gameState.turn }} 回合
        </span>
      </div>
    </header>

    <div class="watch-layout">

      <!-- 主棋盤區 -->
      <main class="board-area">

        <!-- P2 基地（上） -->
        <section class="zone zone-p2">
          <div class="zone-header">
            <span class="zone-title">⬛ P2 基地</span>
            <div class="zone-defenses">
              <span class="defense-pips">
                <span v-for="i in 4" :key="i"
                  class="pip fort-pip"
                  :class="{ active: i <= gameState.zones.p2_base.fortLevel }">🏰</span>
              </span>
              <span class="defense-pips">
                <span v-for="i in 4" :key="i"
                  class="pip wall-pip"
                  :class="{ active: i <= gameState.zones.p2_base.cityWalls }">🧱</span>
              </span>
            </div>
          </div>
          <div class="zone-body">
            <div v-for="l in leadersByZone.p2_base" :key="l.id"
              class="leader-card"
              :class="[`owner-${l.owner}`, `state-${l.state}`,
                       gameState.actedLeaders.includes(l.id) ? 'acted' : '']">
              <div class="lc-top">
                <span class="lc-icon">{{ classEmoji(l.leaderClass) }}</span>
                <span class="lc-name">{{ l.name }}</span>
                <span class="badge" :class="stateBadge(l.state).cls">{{ stateBadge(l.state).text }}</span>
              </div>
              <div class="lc-stats">
                <span title="韌性">🛡️{{ totalToughness(l) }}</span>
                <span title="攻擊">⚔️{{ totalAttack(l) }}</span>
                <span title="協助">🤝{{ totalSupport(l) }}</span>
              </div>
              <div class="lc-tags">
                <span v-if="gameState.actedLeaders.includes(l.id)" class="tag-acted">行動完</span>
                <span v-if="l.legions.length" class="tag-legion">🐉×{{ l.legions.length }}</span>
                <span v-if="l.tacticalCard" class="tag-tactic">🃏</span>
                <span v-if="l.skillCooldown > 0" class="tag-cd">CD{{ l.skillCooldown }}</span>
                <span v-if="l.immobilized" class="tag-lock">🔒</span>
              </div>
            </div>
            <div v-if="!leadersByZone.p2_base.length" class="zone-empty">空</div>
          </div>
        </section>

        <!-- 分隔線：P2 fort bar -->
        <div class="divider">
          <div class="divider-label">← 廣場 →</div>
        </div>

        <!-- 廣場（中）-->
        <section class="zone zone-plaza">
          <div class="zone-header">
            <span class="zone-title">⬜ 廣場（中立）</span>
          </div>
          <div class="zone-body">
            <div v-for="l in leadersByZone.plaza" :key="l.id"
              class="leader-card"
              :class="[`owner-${l.owner}`, `state-${l.state}`,
                       gameState.actedLeaders.includes(l.id) ? 'acted' : '']">
              <div class="lc-top">
                <span class="lc-icon">{{ classEmoji(l.leaderClass) }}</span>
                <span class="lc-name">{{ l.name }}</span>
                <span class="badge" :class="stateBadge(l.state).cls">{{ stateBadge(l.state).text }}</span>
              </div>
              <div class="lc-stats">
                <span>🛡️{{ totalToughness(l) }}</span>
                <span>⚔️{{ totalAttack(l) }}</span>
                <span>🤝{{ totalSupport(l) }}</span>
              </div>
              <div class="lc-tags">
                <span v-if="gameState.actedLeaders.includes(l.id)" class="tag-acted">行動完</span>
                <span v-if="l.legions.length" class="tag-legion">🐉×{{ l.legions.length }}</span>
                <span v-if="l.tacticalCard" class="tag-tactic">🃏</span>
                <span v-if="l.skillCooldown > 0" class="tag-cd">CD{{ l.skillCooldown }}</span>
                <span v-if="l.immobilized" class="tag-lock">🔒</span>
              </div>
            </div>
            <div v-if="!leadersByZone.plaza.length" class="zone-empty">空</div>
          </div>
        </section>

        <!-- 分隔線 -->
        <div class="divider">
          <div class="divider-label">← P1 基地 →</div>
        </div>

        <!-- P1 基地（下） -->
        <section class="zone zone-p1">
          <div class="zone-header">
            <span class="zone-title">⬛ P1 基地</span>
            <div class="zone-defenses">
              <span class="defense-pips">
                <span v-for="i in 3" :key="i"
                  class="pip fort-pip"
                  :class="{ active: i <= gameState.zones.p1_base.fortLevel }">🏰</span>
              </span>
              <span class="defense-pips">
                <span v-for="i in 3" :key="i"
                  class="pip wall-pip"
                  :class="{ active: i <= gameState.zones.p1_base.cityWalls }">🧱</span>
              </span>
            </div>
          </div>
          <div class="zone-body">
            <div v-for="l in leadersByZone.p1_base" :key="l.id"
              class="leader-card"
              :class="[`owner-${l.owner}`, `state-${l.state}`,
                       gameState.actedLeaders.includes(l.id) ? 'acted' : '']">
              <div class="lc-top">
                <span class="lc-icon">{{ classEmoji(l.leaderClass) }}</span>
                <span class="lc-name">{{ l.name }}</span>
                <span class="badge" :class="stateBadge(l.state).cls">{{ stateBadge(l.state).text }}</span>
              </div>
              <div class="lc-stats">
                <span>🛡️{{ totalToughness(l) }}</span>
                <span>⚔️{{ totalAttack(l) }}</span>
                <span>🤝{{ totalSupport(l) }}</span>
              </div>
              <div class="lc-tags">
                <span v-if="gameState.actedLeaders.includes(l.id)" class="tag-acted">行動完</span>
                <span v-if="l.legions.length" class="tag-legion">🐉×{{ l.legions.length }}</span>
                <span v-if="l.tacticalCard" class="tag-tactic">🃏</span>
                <span v-if="l.skillCooldown > 0" class="tag-cd">CD{{ l.skillCooldown }}</span>
                <span v-if="l.immobilized" class="tag-lock">🔒</span>
              </div>
            </div>
            <div v-if="!leadersByZone.p1_base.length" class="zone-empty">空</div>
          </div>
        </section>

        <!-- 操控列 -->
        <div class="controls-bar">
          <div class="speed-group">
            <span class="speed-label">速度</span>
            <button v-for="s in ([0, 1000, 400, 100] as const)" :key="s"
              class="speed-btn" :class="{ active: speed === s }"
              @click="setSpeed(s)">
              {{ s === 0 ? '步進' : s === 1000 ? '慢' : s === 400 ? '正常' : '快' }}
            </button>
          </div>

          <button class="ctrl-btn play-btn"
            :disabled="!!gameState.winner"
            @click="speed === 0 ? manualStep() : togglePlay()">
            <template v-if="speed === 0">▶ 下一步</template>
            <template v-else-if="playing">⏸ 暫停</template>
            <template v-else>▶ 播放</template>
          </button>

          <button class="ctrl-btn restart-btn" @click="restart">🔄 重新開始</button>

          <div class="action-desc">{{ lastActionDesc }}</div>
        </div>

      </main>

      <!-- 側欄 -->
      <aside class="sidebar">

        <!-- P2 資訊（上） -->
        <div class="player-panel player-p2">
          <div class="pp-title">P2 後攻</div>
          <div class="pp-cards">
            <span>手牌 <strong>{{ gameState.players.p2.hand.length }}</strong></span>
            <span>牌組 <strong>{{ gameState.players.p2.deck.length }}</strong></span>
            <span>墓地 <strong>{{ gameState.players.p2.graveyard.length }}</strong></span>
          </div>
          <div class="pp-walls">
            <span v-for="i in 4" :key="i" class="wall-icon"
              :class="{ active: i <= gameState.zones.p2_base.cityWalls }">🧱</span>
            <span class="wall-num">{{ gameState.zones.p2_base.cityWalls }}/4</span>
          </div>
        </div>

        <!-- 勝利橫幅 -->
        <Transition name="win-fade">
          <div v-if="gameState.winner" class="win-banner"
            :class="gameState.winner === 'p1' ? 'win-p1' : 'win-p2'">
            <div class="win-icon">🏆</div>
            <div class="win-who">{{ gameState.winner === 'p1' ? 'P1' : 'P2' }} 獲勝</div>
            <div class="win-detail">{{ gameState.winReason }}</div>
          </div>
        </Transition>

        <!-- 事件記錄 -->
        <div class="event-log-wrap">
          <div class="log-title">事件記錄</div>
          <div class="event-log" ref="logEl">
            <div v-for="(e, i) in eventLog" :key="i"
              class="log-entry"
              :style="{ color: eventColor(e) }">
              {{ formatEvent(e) }}
            </div>
            <div v-if="!eventLog.length" class="log-empty">等待事件…</div>
          </div>
        </div>

        <!-- P1 資訊（下） -->
        <div class="player-panel player-p1">
          <div class="pp-title">P1 先攻</div>
          <div class="pp-cards">
            <span>手牌 <strong>{{ gameState.players.p1.hand.length }}</strong></span>
            <span>牌組 <strong>{{ gameState.players.p1.deck.length }}</strong></span>
            <span>墓地 <strong>{{ gameState.players.p1.graveyard.length }}</strong></span>
          </div>
          <div class="pp-walls">
            <span v-for="i in 3" :key="i" class="wall-icon"
              :class="{ active: i <= gameState.zones.p1_base.cityWalls }">🧱</span>
            <span class="wall-num">{{ gameState.zones.p1_base.cityWalls }}/3</span>
          </div>
        </div>

      </aside>
    </div>
  </div>
</template>

<style scoped>
/* ── 全頁覆蓋全局 #app 寬度限制 ───────────────── */
.watch-page {
  position: fixed;
  inset: 0;
  background: #0f172a;
  color: #e2e8f0;
  display: flex;
  flex-direction: column;
  font-family: system-ui, 'Segoe UI', sans-serif;
  font-size: 14px;
  overflow: hidden;
}

/* ── Header ──────────────────────────────────── */
.watch-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 1rem;
  background: #1e293b;
  border-bottom: 1px solid #334155;
  flex-shrink: 0;
  height: 44px;
}
.watch-header h1 {
  color: #f59e0b;
  font-size: 1.1rem;
  margin: 0;
  flex-shrink: 0;
}
.btn-back {
  background: transparent;
  border: 1px solid #475569;
  color: #94a3b8;
  padding: 3px 10px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 0.8rem;
  flex-shrink: 0;
}
.btn-back:hover { border-color: #f59e0b; color: #f59e0b; }
.turn-info {
  font-size: 0.82rem;
  color: #94a3b8;
  flex: 1;
}
.turn-info strong { color: #f1f5f9; }
.tag-p1 { color: #60a5fa; font-weight: 700; }
.tag-p2 { color: #f87171; font-weight: 700; }
.winner-banner { color: #fbbf24; font-weight: 700; }

/* ── 主佈局 ──────────────────────────────────── */
.watch-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}
.board-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0.5rem;
  gap: 0;
  overflow-y: auto;
  min-width: 0;
}
.sidebar {
  width: 240px;
  flex-shrink: 0;
  background: #1e293b;
  border-left: 1px solid #334155;
  display: flex;
  flex-direction: column;
  padding: 0.5rem;
  gap: 0.5rem;
  overflow-y: auto;
}

/* ── 區域 ────────────────────────────────────── */
.zone {
  border-radius: 8px;
  padding: 0.5rem 0.6rem;
  flex-shrink: 0;
}
.zone-p2   { background: rgba(248, 113, 113, 0.06); border: 1px solid rgba(248,113,113,0.2); }
.zone-plaza{ background: rgba(148, 163, 184, 0.06); border: 1px solid rgba(148,163,184,0.2); }
.zone-p1   { background: rgba(96, 165, 250, 0.06);  border: 1px solid rgba(96,165,250,0.2);  }

.zone-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.4rem;
}
.zone-title { font-size: 0.78rem; font-weight: 700; color: #cbd5e1; letter-spacing: 0.04em; }
.zone-defenses { display: flex; gap: 0.6rem; align-items: center; }
.defense-pips  { display: flex; gap: 2px; }
.pip { font-size: 0.9rem; opacity: 0.18; transition: opacity 0.25s; }
.pip.active { opacity: 1; }

.zone-body {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  min-height: 60px;
  align-items: flex-start;
}
.zone-empty { font-size: 0.72rem; color: #475569; font-style: italic; padding: 0.3rem; }

/* ── 分隔線 ──────────────────────────────────── */
.divider {
  text-align: center;
  padding: 3px 0;
  flex-shrink: 0;
}
.divider-label {
  font-size: 0.65rem;
  color: #475569;
  letter-spacing: 0.06em;
}

/* ── 首領卡 ──────────────────────────────────── */
.leader-card {
  background: #1e293b;
  border-radius: 7px;
  padding: 0.35rem 0.45rem;
  min-width: 110px;
  max-width: 145px;
  border: 1px solid #334155;
  transition: opacity 0.2s, border-color 0.2s;
  cursor: default;
}
.owner-p1 { border-left: 3px solid #3b82f6; }
.owner-p2 { border-left: 3px solid #ef4444; }
.state-ko       { opacity: 0.4; }
.state-reviving { opacity: 0.6; border-style: dashed; }
.state-stunned  { border-top: 2px solid #f97316; }
.acted          { opacity: 0.65; background: #131e2e; }

.lc-top {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-bottom: 3px;
}
.lc-icon { font-size: 0.9rem; flex-shrink: 0; }
.lc-name {
  font-size: 0.78rem;
  font-weight: 600;
  color: #f1f5f9;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lc-stats {
  display: flex;
  gap: 5px;
  font-size: 0.72rem;
  color: #94a3b8;
  margin-bottom: 3px;
  flex-wrap: wrap;
}
.lc-tags {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
}

/* ── 徽章 ────────────────────────────────────── */
.badge {
  font-size: 0.6rem;
  padding: 1px 4px;
  border-radius: 99px;
  font-weight: 700;
  flex-shrink: 0;
}
.badge-normal   { background: #14532d; color: #4ade80; }
.badge-stunned  { background: #7c2d12; color: #fb923c; }
.badge-ko       { background: #450a0a; color: #fca5a5; }
.badge-reviving { background: #1e1b4b; color: #a78bfa; }

.tag-acted  { font-size: 0.6rem; background: #1e293b; color: #64748b; border: 1px solid #334155; border-radius: 3px; padding: 0 3px; }
.tag-legion { font-size: 0.6rem; background: #1a2a1a; color: #4ade80; border-radius: 3px; padding: 0 3px; }
.tag-tactic { font-size: 0.65rem; }
.tag-cd     { font-size: 0.6rem; background: #2d1810; color: #fb923c; border-radius: 3px; padding: 0 3px; }
.tag-lock   { font-size: 0.65rem; }

/* ── 操控列 ──────────────────────────────────── */
.controls-bar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.6rem;
  background: #1e293b;
  border-radius: 8px;
  border: 1px solid #334155;
  margin-top: 0.4rem;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.speed-group  { display: flex; align-items: center; gap: 4px; }
.speed-label  { font-size: 0.72rem; color: #64748b; margin-right: 2px; }
.speed-btn {
  padding: 3px 8px;
  font-size: 0.75rem;
  border: 1px solid #334155;
  border-radius: 5px;
  background: #0f172a;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.12s;
}
.speed-btn.active { background: #f59e0b; color: #0f172a; border-color: #f59e0b; font-weight: 700; }
.speed-btn:hover:not(.active) { border-color: #94a3b8; color: #e2e8f0; }

.ctrl-btn {
  padding: 4px 14px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 600;
  transition: all 0.12s;
}
.play-btn { background: #f59e0b; color: #0f172a; }
.play-btn:disabled { background: #334155; color: #64748b; cursor: not-allowed; }
.play-btn:hover:not(:disabled) { background: #fbbf24; }
.restart-btn { background: #1e293b; color: #94a3b8; border: 1px solid #334155; }
.restart-btn:hover { color: #f59e0b; border-color: #f59e0b; }

.action-desc {
  flex: 1;
  font-size: 0.75rem;
  color: #c084fc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  text-align: right;
}

/* ── 側欄 ────────────────────────────────────── */
.player-panel {
  background: #0f172a;
  border-radius: 7px;
  padding: 0.45rem 0.6rem;
  border: 1px solid #334155;
  flex-shrink: 0;
}
.player-p2 { border-left: 3px solid #ef4444; }
.player-p1 { border-left: 3px solid #3b82f6; }
.pp-title  { font-size: 0.7rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
.pp-cards  { display: flex; gap: 8px; font-size: 0.75rem; color: #64748b; margin-bottom: 5px; flex-wrap: wrap; }
.pp-cards strong { color: #cbd5e1; }
.pp-walls  { display: flex; align-items: center; gap: 3px; }
.wall-icon { font-size: 0.85rem; opacity: 0.18; transition: opacity 0.25s; }
.wall-icon.active { opacity: 1; }
.wall-num  { font-size: 0.7rem; color: #64748b; margin-left: 4px; }

.win-banner {
  border-radius: 8px;
  padding: 0.6rem;
  text-align: center;
  flex-shrink: 0;
}
.win-p1 { background: linear-gradient(135deg, #1d4ed8, #2563eb); }
.win-p2 { background: linear-gradient(135deg, #b91c1c, #dc2626); }
.win-icon { font-size: 1.5rem; }
.win-who  { font-size: 1rem; font-weight: 800; color: white; margin-top: 2px; }
.win-detail { font-size: 0.72rem; color: rgba(255,255,255,0.75); margin-top: 2px; }
.win-fade-enter-active { transition: all 0.4s ease; }
.win-fade-enter-from   { opacity: 0; transform: scale(0.9); }

/* ── 事件記錄 ────────────────────────────────── */
.event-log-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: #0a0f1a;
  border-radius: 7px;
  border: 1px solid #1e293b;
  overflow: hidden;
}
.log-title {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #334155;
  padding: 4px 8px;
  border-bottom: 1px solid #1e293b;
  flex-shrink: 0;
}
.event-log {
  flex: 1;
  overflow-y: auto;
  padding: 4px 6px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.event-log::-webkit-scrollbar { width: 3px; }
.event-log::-webkit-scrollbar-track { background: transparent; }
.event-log::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
.log-entry {
  font-size: 0.7rem;
  line-height: 1.45;
  padding: 1px 0;
  border-bottom: 1px solid rgba(255,255,255,0.03);
}
.log-empty { font-size: 0.72rem; color: #334155; font-style: italic; padding: 6px 0; }
</style>

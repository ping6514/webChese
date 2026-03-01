<script lang="ts">
import { defineComponent } from 'vue'
import type { Side, Phase } from '../engine'

type Resources = {
  gold: number
  mana: number
  storageMana: number
}

export default defineComponent({
  name: 'TopBar',
  props: {
    title: { type: String, required: true },
    connectionStatus: { type: String as () => 'connecting' | 'connected' | 'disconnected' | 'lagging' | null, default: null },
    currentSide: { type: String as () => Side, required: true },
    currentPhase: { type: String as () => Phase, required: true },
    necroActionsUsed: { type: Number, required: true },
    necroActionsMax: { type: Number, required: true },
    kingHp: {
      type: Object as () => { red: number | null; black: number | null },
      required: true,
    },
    resources: {
      type: Object as () => { red: Resources; black: Resources },
      required: true,
    },
    onlineSide: { type: String as () => 'red' | 'black' | null, default: null },
  },
  emits: ['cycle-connection', 'open-menu', 'next-phase'],
  methods: {
    phaseIcon(p: string): string {
      if (p === 'buy') return '💰'
      if (p === 'necro') return '⚗️'
      if (p === 'combat') return '⚔️'
      return '⏭️'
    },
    phaseLabel(p: string): string {
      if (p === 'buy') return '購買'
      if (p === 'necro') return '死靈術'
      if (p === 'combat') return '戰鬥'
      return p
    },
    nextPhaseLabel(p: string): string {
      if (p === 'buy') return '進入死靈術'
      if (p === 'necro') return '進入戰鬥'
      if (p === 'combat') return '結束回合'
      return '下一階段'
    },
  },
})
</script>

<template>
  <header class="topbar">
    <!-- LEFT: BLACK player (horizontal) -->
    <div class="playerRow" :class="{ activeRow: currentSide === 'black', rowBlack: true }">
      <span class="dot dotBlack" />
      <span class="playerName">BLACK<span v-if="onlineSide" class="youTag">{{ onlineSide === 'black' ? '(你)' : '(敵)' }}</span></span>
      <span class="statChip hp">❤️ <b>{{ kingHp.black ?? '-' }}</b></span>
      <span class="statChip gold">💰 財力 <b>{{ resources.black.gold }}</b></span>
      <span class="statChip mana">⭐ 魔力 <b>{{ resources.black.mana }}</b></span>
      <span class="statChip store">⚖️ 存魔 <b>{{ resources.black.storageMana }}</b></span>
    </div>

    <!-- CENTER: title + phase + next -->
    <div class="center">
      <div class="topRow">
        <span class="gameTitle">{{ title }}</span>
        <div v-if="connectionStatus !== null" class="conn">
          <span class="connDot" :class="connectionStatus" />
          <span class="connLabel">{{ connectionStatus === 'connected' ? '線上對戰' : connectionStatus === 'connecting' ? '連線中...' : connectionStatus === 'lagging' ? '等待回應...' : '已斷線' }}</span>
        </div>
        <button type="button" class="iconBtn" title="Menu" @click="$emit('open-menu')">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path fill="currentColor" d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.32-.02-.63-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.65l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.06 7.06 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 12.9 1h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.58.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L1.71 7.5a.5.5 0 0 0 .12.65l2.03 1.58c-.05.31-.07.62-.07.94s.02.63.07.94L1.83 14.5a.5.5 0 0 0-.12.65l1.92 3.32c.13.22.39.31.6.22l2.39-.96c.5.4 1.05.71 1.63.94l.36 2.54c.04.24.25.42.49.42h3.8c.24 0 .45-.18.49-.42l.36-2.54c.58-.23 1.12-.54 1.63-.94l2.39.96c.22.09.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.65l-2.03-1.56ZM11 15.5A3.5 3.5 0 1 1 11 8.5a3.5 3.5 0 0 1 0 7Z"/>
          </svg>
        </button>
      </div>

      <!-- Phase tabs -->
      <div class="phaseTabs">
        <div
          v-for="p in ['buy', 'necro', 'combat']"
          :key="p"
          class="phaseTab"
          :class="{ activeTab: currentPhase === p, [`tab-${p}`]: true }"
        >
          <span class="tabIcon">{{ phaseIcon(p) }}</span>
          <span class="tabLabel">{{ phaseLabel(p) }}</span>
          <span v-if="p === 'necro' && currentPhase === 'necro'" class="tabCounter">
            {{ necroActionsUsed }}/{{ necroActionsMax }}
          </span>
        </div>

        <button
          type="button"
          class="nextBtn"
          :class="currentSide === 'red' ? 'nextRed' : 'nextGreen'"
          @click="$emit('next-phase')"
        >
          {{ nextPhaseLabel(currentPhase) }} →
        </button>
      </div>
    </div>

    <!-- RIGHT: RED player (horizontal) -->
    <div class="playerRow" :class="{ activeRow: currentSide === 'red', rowRed: true }">
      <span class="dot dotRed" />
      <span class="playerName">RED<span v-if="onlineSide" class="youTag">{{ onlineSide === 'red' ? '(你)' : '(敵)' }}</span></span>
      <span class="statChip hp">❤️ <b>{{ kingHp.red ?? '-' }}</b></span>
      <span class="statChip gold">💰 財力 <b>{{ resources.red.gold }}</b></span>
      <span class="statChip mana">⭐ 魔力 <b>{{ resources.red.mana }}</b></span>
      <span class="statChip store">⚖️ 存魔 <b>{{ resources.red.storageMana }}</b></span>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 12px;
  align-items: center;
  width: 100%;
  box-sizing: border-box;
}

/* ── Player rows (horizontal) ────────────────────────────────────────── */
.playerRow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.2);
  transition: border-color 0.3s, background 0.3s, box-shadow 0.3s;
  min-width: 0;
}

.playerRow.rowBlack.activeRow {
  border-color: rgba(82, 196, 26, 0.55);
  background: rgba(82, 196, 26, 0.08);
  box-shadow: 0 0 16px rgba(82, 196, 26, 0.15);
}

.playerRow.rowRed.activeRow {
  border-color: rgba(255, 77, 79, 0.55);
  background: rgba(255, 77, 79, 0.08);
  box-shadow: 0 0 16px rgba(255, 77, 79, 0.15);
}

.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dotBlack { background: rgba(82, 196, 26, 0.9); }
.dotRed   { background: rgba(255, 77, 79, 0.9); }

.playerName {
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.06em;
  opacity: 0.85;
}

.statChip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.2);
  white-space: nowrap;
}

.statChip b {
  font-size: 15px;
  font-weight: 900;
}

.statChip.hp b   { color: #ff9c9e; }
.statChip.gold b { color: #e8d070; }
.statChip.mana b { color: #91caff; }
.statChip.store b{ color: rgba(255, 255, 255, 0.7); }

.youTag {
  font-size: 11px;
  font-weight: 600;
  opacity: 0.65;
  letter-spacing: 0;
  margin-left: 4px;
}

/* ── Center ──────────────────────────────────────────────────────────── */
.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: 320px;
}

.topRow {
  display: flex;
  align-items: center;
  gap: 10px;
}

.gameTitle {
  font-size: 17px;
  font-weight: 900;
  letter-spacing: 0.05em;
}

.conn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.22);
  color: rgba(255, 255, 255, 0.65);
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}

.connDot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #666;
  flex-shrink: 0;
}
.connDot.connected    { background: #52c41a; }
.connDot.connecting   { background: #faad14; }
.connDot.disconnected { background: #ff4d4f; }
.connDot.lagging      { background: #fa8c16; }

.iconBtn {
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.22);
  color: rgba(255, 255, 255, 0.7);
  display: grid;
  place-items: center;
  box-sizing: border-box;
  cursor: pointer;
  transition: background 0.15s;
}
.iconBtn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.95);
}

/* ── Phase tabs ──────────────────────────────────────────────────────── */
.phaseTabs {
  display: flex;
  align-items: center;
  gap: 6px;
}

.phaseTab {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.2);
  font-size: 13px;
  opacity: 0.45;
  transition: opacity 0.2s, border-color 0.2s, background 0.2s;
  white-space: nowrap;
}

.phaseTab.activeTab {
  opacity: 1;
  font-weight: 800;
}

.phaseTab.activeTab.tab-buy {
  border-color: rgba(200, 160, 40, 0.6);
  background: rgba(200, 160, 40, 0.15);
  color: #e8d070;
}

.phaseTab.activeTab.tab-necro {
  border-color: rgba(145, 202, 255, 0.6);
  background: rgba(145, 202, 255, 0.12);
  color: #91caff;
}

.phaseTab.activeTab.tab-combat {
  border-color: rgba(255, 77, 79, 0.6);
  background: rgba(255, 77, 79, 0.15);
  color: #ff9c9e;
}

.tabIcon { font-size: 15px; }

.tabLabel { font-size: 13px; }

.tabCounter {
  font-size: 11px;
  padding: 1px 5px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.3);
  opacity: 0.85;
}

/* ── Next phase button ───────────────────────────────────────────────── */
.nextBtn {
  padding: 8px 20px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 900;
  letter-spacing: 0.03em;
  cursor: pointer;
  border: 2px solid transparent;
  transition: background 0.18s, box-shadow 0.18s, transform 0.12s;
  white-space: nowrap;
  margin-left: 6px;
}

.nextBtn:active { transform: scale(0.96); }

.nextBtn.nextRed {
  background: rgba(255, 77, 79, 0.22);
  border-color: rgba(255, 77, 79, 0.6);
  color: #ffb0b2;
  box-shadow: 0 0 12px rgba(255, 77, 79, 0.18);
}
.nextBtn.nextRed:hover {
  background: rgba(255, 77, 79, 0.36);
  box-shadow: 0 0 20px rgba(255, 77, 79, 0.3);
}

.nextBtn.nextGreen {
  background: rgba(82, 196, 26, 0.18);
  border-color: rgba(82, 196, 26, 0.55);
  color: #b7eb8f;
  box-shadow: 0 0 12px rgba(82, 196, 26, 0.15);
}
.nextBtn.nextGreen:hover {
  background: rgba(82, 196, 26, 0.3);
  box-shadow: 0 0 20px rgba(82, 196, 26, 0.25);
}
</style>

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
    connectionStatus: { type: String as () => 'connecting' | 'connected' | 'disconnected' | 'lagging', required: true },
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
  },
  emits: ['cycle-connection', 'open-menu'],
})
</script>

<template>
  <header class="topbar">
    <div class="left">
      <button type="button" class="conn" @click="$emit('cycle-connection')">
        <span class="mono">{{ connectionStatus }}</span>
      </button>
      <div class="title">{{ title }}</div>
    </div>

    <div class="center">
      <div class="row mono rowVs">
        <span class="hp hpBlack">BLACK ❤️ {{ kingHp.black ?? '-' }}</span>
        <span class="res">💰{{ resources.black.gold }} ⭐{{ resources.black.mana }} ⚖️{{ resources.black.storageMana }}</span>
        <span class="vs">VS</span>
        <span class="hp hpRed">RED ❤️ {{ kingHp.red ?? '-' }}</span>
        <span class="res">💰{{ resources.red.gold }} ⭐{{ resources.red.mana }} ⚖️{{ resources.red.storageMana }}</span>
      </div>
      <div class="row mono rowTurn">
        <span>Turn:</span>
        <span class="turnSide" :class="currentSide === 'red' ? 'turnRed' : 'turnBlack'">{{ currentSide }}</span>
        <span>|</span>
        <span>Phase:</span>
        <span>
          {{ currentPhase }}
          <span v-if="currentPhase === 'necro'" class="phaseCounter">({{ necroActionsUsed }}/{{ necroActionsMax }})</span>
        </span>
      </div>
    </div>

    <div class="right">
      <button type="button" class="iconBtn" title="Menu" @click="$emit('open-menu')">
        <svg class="gear" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.32-.02-.63-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.65l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.06 7.06 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 12.9 1h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.58.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L1.71 7.5a.5.5 0 0 0 .12.65l2.03 1.58c-.05.31-.07.62-.07.94s.02.63.07.94L1.83 14.5a.5.5 0 0 0-.12.65l1.92 3.32c.13.22.39.31.6.22l2.39-.96c.5.4 1.05.71 1.63.94l.36 2.54c.04.24.25.42.49.42h3.8c.24 0 .45-.18.49-.42l.36-2.54c.58-.23 1.12-.54 1.63-.94l2.39.96c.22.09.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.65l-2.03-1.56ZM11 15.5A3.5 3.5 0 1 1 11 8.5a3.5 3.5 0 0 1 0 7Z"
          />
        </svg>
      </button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr) auto;
  grid-template-areas: "left center right";
  gap: 12px;
  align-items: center;
  width: 100%;
  box-sizing: border-box;
  min-height: 56px;
  overflow: visible;
}

.left {
  grid-area: left;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.title {
  font-size: 24px;
  font-weight: 700;
}


.center {
  grid-area: center;
  display: grid;
  gap: 4px;
  min-width: 0;
  justify-items: center;
}

.right {
  grid-area: right;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  min-width: 0;
}

.vs {
  font-weight: 900;
  opacity: 0.9;
}

.conn {
  padding: 2px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.22);
  color: rgba(255, 255, 255, 0.92);
  font-weight: 800;
}

.iconBtn {
  width: 34px;
  height: 34px;
  padding: 0;
  line-height: 0;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.22);
  color: rgba(255, 255, 255, 0.92);
  display: grid;
  place-items: center;
  box-sizing: border-box;
}

.gear {
  width: 18px;
  height: 18px;
  display: block;
}

.res {
  opacity: 0.9;
}

.hp {
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.22);
  font-weight: 800;
}

.hpRed {
  color: rgba(255, 77, 79, 0.98);
}

.hpBlack {
  color: rgba(82, 196, 26, 0.98);
}


.turnSide {
  font-weight: 900;
}

.turnRed {
  color: rgba(255, 77, 79, 0.98);
}

.turnBlack {
  color: rgba(82, 196, 26, 0.98);
}

.phaseCounter {
  opacity: 0.9;
}
</style>

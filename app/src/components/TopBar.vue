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
    currentSide: { type: String as () => Side, required: true },
    currentPhase: { type: String as () => Phase, required: true },
    kingHp: {
      type: Object as () => { red: number | null; black: number | null },
      required: true,
    },
    resources: {
      type: Object as () => { red: Resources; black: Resources },
      required: true,
    },
  },
  emits: ['next-phase', 'open-units', 'open-shop'],
})
</script>

<template>
  <header class="topbar">
    <div class="title">{{ title }}</div>
    <div class="statusCenter">
      <div class="hpRow">
        <div class="hp hpRed mono">RED HP {{ kingHp.red ?? '-' }}</div>
        <div class="hp hpBlack mono">BLACK HP {{ kingHp.black ?? '-' }}</div>
      </div>
      <div class="statusLine">Side: <span class="mono">{{ currentSide }}</span></div>
      <div class="statusLine">Phase: <span class="mono">{{ currentPhase }}</span></div>
      <div class="mono statusLine">
        red G{{ resources.red.gold }} M{{ resources.red.mana }} S{{ resources.red.storageMana }}
      </div>
      <div class="mono statusLine">
        black G{{ resources.black.gold }} M{{ resources.black.mana }} S{{ resources.black.storageMana }}
      </div>
    </div>
    <div class="actions">
      <button type="button" @click="$emit('open-shop')">Shop</button>
      <button type="button" @click="$emit('open-units')">Units</button>
      <button type="button" @click="$emit('next-phase')">Next phase</button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
  align-items: start;
}

.title {
  font-size: 24px;
  font-weight: 700;
}

.statusCenter {
  display: grid;
  justify-items: center;
  gap: 2px;
}

.hpRow {
  display: flex;
  gap: 10px;
  margin-bottom: 2px;
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

.statusLine {
  text-align: center;
}

.actions {
  justify-self: end;
  display: flex;
  gap: 8px;
}
</style>

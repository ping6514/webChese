<script lang="ts">
import { defineComponent, type PropType } from 'vue'

type UnitView = {
  id: string
  label: string
  sideClass: string
  hp: number
  enchantName: string | null
  enchantImage: string | null
}

type FloatText = {
  id: string
  text: string
  kind: 'damage' | 'heal'
}

export default defineComponent({
  name: 'BoardCell',
  props: {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    cellClass: { type: Object as PropType<Record<string, boolean>>, required: true },
    unit: { type: Object as () => UnitView | null, required: true },
    corpseCount: { type: Number as PropType<number | null>, required: true },
    titleText: { type: String as PropType<string | null>, required: false, default: null },
    allowDrop: { type: Boolean, required: false, default: false },
    floatTexts: { type: Array as () => FloatText[], required: false, default: () => [] },
    pierceMark: { type: Number as PropType<number | null>, required: false, default: null },
    splashMark: { type: String as PropType<string | null>, required: false, default: null },
    chainMark: { type: String as PropType<string | null>, required: false, default: null },
  },
  emits: {
    click: (_payload: { x: number; y: number; unitId: string | null }) => true,
    dropSoul: (_payload: { x: number; y: number; unitId: string; soulId: string }) => true,
  },
  setup(props, { emit }) {
    function onClick() {
      emit('click', { x: props.x, y: props.y, unitId: props.unit?.id ?? null })
    }

    function onDrop(e: DragEvent) {
      if (!props.allowDrop) return
      const soulId = e.dataTransfer?.getData('application/x-soul-id') || ''
      if (!soulId) return
      if (!props.unit) return
      emit('dropSoul', { x: props.x, y: props.y, unitId: props.unit.id, soulId })
    }

    function onDragOver(e: DragEvent) {
      if (!props.allowDrop) return
      e.preventDefault()
    }

    return { onClick, onDrop, onDragOver }
  },
})
</script>

<template>
  <button
    class="cell"
    :class="cellClass"
    type="button"
    :title="titleText ?? ''"
    :data-pos="`${x},${y}`"
    @click="onClick"
    @dragover="onDragOver"
    @drop="onDrop"
  >
    <div v-if="cellClass['cell-fx-killed']" class="killedOverlay" />
    <span v-if="pierceMark != null" class="pierceBadge mono" :title="'貫通：連帶命中 #' + pierceMark">貫{{ pierceMark }}</span>
    <span v-if="splashMark" class="splashBadge mono" title="波及：連帶命中">{{ splashMark }}</span>
    <span v-if="chainMark" class="chainBadge mono" :title="chainMark === '連' ? '連鎖：已選第二目標' : '連鎖：可選第二目標'">{{ chainMark }}</span>
    <span v-if="corpseCount" class="corpseBadge mono">x{{ corpseCount }}</span>

    <span v-if="unit" class="hp mono"><span class="hpHeart">♥</span>{{ unit.hp }}</span>

    <span v-if="unit" class="unit mono" :class="[unit.sideClass, { enchanted: !!unit.enchantName }]">
      {{ unit.label }}
    </span>

    <div v-if="floatTexts.length > 0" class="floats">
      <div
        v-for="f in floatTexts"
        :key="f.id"
        class="float"
        :class="f.kind === 'heal' ? 'float-heal' : 'float-damage'"
      >
        {{ f.text }}
      </div>
    </div>

    <div v-if="unit?.enchantName" class="tip">
      <div class="tipRow">{{ unit.enchantName }}</div>
      <img v-if="unit.enchantImage" class="tipImg" :src="unit.enchantImage" alt="" />
      <div v-else class="tipNoImg mono">no img</div>
    </div>

    <div v-if="!unit && titleText" class="tip tip-invalid">
      <div class="tipRow">{{ titleText }}</div>
    </div>
  </button>
</template>

<style scoped>
.cell {
  aspect-ratio: 1 / 1;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(0, 0, 0, 0.15);
  color: #eaeaea;
  text-align: left;
  padding: 4px 6px;
  border-radius: 6px;
  position: relative;
}

.cell-preview-pierce {
  box-shadow: 0 0 0 4px rgba(145, 202, 255, 0.22), 0 0 18px rgba(145, 202, 255, 0.16);
  border-color: rgba(200, 230, 255, 0.75);
}

.cell-preview-splash {
  box-shadow: 0 0 0 4px rgba(255, 140, 0, 0.16), 0 0 18px rgba(255, 140, 0, 0.12);
  border-color: rgba(255, 170, 70, 0.75);
}

.cell-preview-chain-eligible {
  box-shadow: 0 0 0 4px rgba(186, 85, 211, 0.16), 0 0 18px rgba(186, 85, 211, 0.12);
  border-color: rgba(220, 140, 255, 0.68);
}

.cell-preview-chain-selected {
  box-shadow: 0 0 0 5px rgba(186, 85, 211, 0.22), 0 0 22px rgba(186, 85, 211, 0.16);
  border-color: rgba(240, 200, 255, 0.9);
}

.pierceBadge {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 45;
  padding: 1px 6px;
  border-radius: 999px;
  border: 1px solid rgba(200, 230, 255, 0.5);
  background: rgba(145, 202, 255, 0.16);
  color: rgba(230, 246, 255, 0.95);
  font-size: 11px;
  font-weight: 900;
}

.splashBadge {
  position: absolute;
  top: 4px;
  left: 4px;
  z-index: 45;
  padding: 1px 6px;
  border-radius: 999px;
  border: 1px solid rgba(255, 200, 140, 0.5);
  background: rgba(255, 140, 0, 0.14);
  color: rgba(255, 232, 205, 0.95);
  font-size: 11px;
  font-weight: 900;
}

.chainBadge {
  position: absolute;
  top: 26px;
  left: 4px;
  z-index: 45;
  padding: 1px 6px;
  border-radius: 999px;
  border: 1px solid rgba(220, 160, 255, 0.5);
  background: rgba(186, 85, 211, 0.14);
  color: rgba(245, 232, 255, 0.95);
  font-size: 11px;
  font-weight: 900;
}

.killedOverlay {
  position: absolute;
  inset: -2px;
  border-radius: 8px;
  pointer-events: none;
  z-index: 35;
  opacity: 0;
  background:
    radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.65) 0%, rgba(255, 255, 255, 0) 18%),
    radial-gradient(circle at 50% 50%, rgba(255, 77, 79, 0.32) 0%, rgba(0, 0, 0, 0) 58%),
    radial-gradient(circle at 50% 50%, rgba(120, 0, 255, 0.26) 0%, rgba(0, 0, 0, 0) 68%);
  box-shadow: 0 0 32px rgba(255, 77, 79, 0.18), 0 0 28px rgba(120, 0, 255, 0.16);
  filter: saturate(1.2) contrast(1.05);
  animation: killedExplosion 820ms cubic-bezier(0.14, 0.85, 0.21, 1) 1;
}

.killedOverlay::before {
  content: '';
  position: absolute;
  inset: -10px;
  border-radius: 999px;
  pointer-events: none;
  opacity: 0;
  border: 2px solid rgba(255, 140, 0, 0.55);
  box-shadow: 0 0 20px rgba(255, 77, 79, 0.18), 0 0 26px rgba(255, 140, 0, 0.14);
  animation: killedShockwave 820ms ease-out 1;
}

.killedOverlay::after {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: 8px;
  pointer-events: none;
  opacity: 0;
  background:
    radial-gradient(circle at 25% 35%, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0) 10%),
    radial-gradient(circle at 70% 28%, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0) 9%),
    radial-gradient(circle at 60% 70%, rgba(255, 255, 255, 0.75) 0%, rgba(255, 255, 255, 0) 9%),
    radial-gradient(circle at 32% 72%, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0) 9%),
    radial-gradient(circle at 50% 50%, rgba(255, 77, 79, 0.2) 0%, rgba(0, 0, 0, 0) 52%);
  filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.25)) drop-shadow(0 0 14px rgba(255, 77, 79, 0.18));
  animation: killedSparks 820ms ease-out 1;
}

.cell-fx-attack {
  animation: fxAttack 520ms ease-out 1;
}

.cell-fx-attack::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 6px;
  pointer-events: none;
  background: radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.0) 58%);
  opacity: 0;
  animation: attackFlash 520ms ease-out 1;
}

.cell-fx-hit {
  animation: fxHit 620ms ease-out 1;
}

.cell-fx-hit::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 14px;
  height: 14px;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  border: 2px solid rgba(255, 77, 79, 0.95);
  box-shadow: 0 0 18px rgba(255, 77, 79, 0.32);
  opacity: 0;
  pointer-events: none;
  animation: shockwave 620ms ease-out 1;
}

.cell-fx-killed {
  animation: fxKilled 760ms ease-out 1;
  box-shadow: 0 0 0 7px rgba(255, 77, 79, 0.14), 0 0 26px 10px rgba(120, 0, 255, 0.12);
  border-color: rgba(255, 77, 79, 0.8);
  background: rgba(255, 77, 79, 0.06);
}

.cell-fx-killed::after {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: 8px;
  pointer-events: none;
  z-index: 40;
  opacity: 0;
  background:
    radial-gradient(circle at 50% 50%, rgba(255, 77, 79, 0.22) 0%, rgba(0, 0, 0, 0) 62%),
    radial-gradient(circle at 50% 50%, rgba(120, 0, 255, 0.16) 0%, rgba(0, 0, 0, 0) 68%);
  box-shadow: 0 0 22px rgba(255, 77, 79, 0.12);
  animation: killedBurst 760ms ease-out 1;
}

.cell-fx-revived {
  animation: fxRevived 760ms ease-out 1;
}

.cell-fx-revived::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 14px;
  height: 14px;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  border: 2px solid rgba(145, 202, 255, 0.98);
  box-shadow: 0 0 18px rgba(145, 202, 255, 0.3);
  opacity: 0;
  pointer-events: none;
  animation: reviveWave 760ms ease-out 1;
}

.cell-fx-enchanted {
  animation: fxEnchanted 820ms ease-out 1;
}

.cell-fx-enchanted::before {
  content: '';
  position: absolute;
  left: 10%;
  top: -55%;
  width: 80%;
  height: 155%;
  border-radius: 12px;
  pointer-events: none;
  opacity: 0;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(200, 230, 255, 0.8) 18%,
    rgba(145, 202, 255, 0.55) 42%,
    rgba(255, 255, 255, 0) 78%
  );
  filter: drop-shadow(0 0 10px rgba(145, 202, 255, 0.35));
  animation: enchantDrop 820ms ease-out 1;
}

@keyframes fxAttack {
  0% {
    box-shadow: 0 0 0 0 rgba(145, 202, 255, 0.0);
    border-color: rgba(145, 202, 255, 0.7);
    background: rgba(145, 202, 255, 0.04);
    transform: scale(1);
  }
  18% {
    box-shadow: 0 0 0 7px rgba(145, 202, 255, 0.35), 0 0 22px 6px rgba(145, 202, 255, 0.22);
    border-color: rgba(200, 230, 255, 0.98);
    background: rgba(145, 202, 255, 0.14);
    transform: scale(1.04);
  }
  45% {
    box-shadow: 0 0 0 5px rgba(145, 202, 255, 0.22), 0 0 16px 4px rgba(145, 202, 255, 0.14);
    border-color: rgba(145, 202, 255, 0.9);
    background: rgba(145, 202, 255, 0.1);
    transform: scale(1.02);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(145, 202, 255, 0.0);
    border-color: rgba(255, 255, 255, 0.18);
    background: rgba(0, 0, 0, 0.15);
    transform: scale(1);
  }
}

@keyframes fxRevived {
  0% {
    box-shadow: 0 0 0 0 rgba(145, 202, 255, 0);
    border-color: rgba(145, 202, 255, 0.78);
    background: rgba(145, 202, 255, 0.05);
    transform: scale(0.98);
  }
  18% {
    box-shadow: 0 0 0 7px rgba(145, 202, 255, 0.26), 0 0 22px 6px rgba(145, 202, 255, 0.16);
    border-color: rgba(200, 230, 255, 0.98);
    background: rgba(145, 202, 255, 0.14);
    transform: scale(1.04);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(145, 202, 255, 0);
    border-color: rgba(255, 255, 255, 0.18);
    background: rgba(0, 0, 0, 0.15);
    transform: scale(1);
  }
}

@keyframes fxEnchanted {
  0% {
    box-shadow: 0 0 0 0 rgba(145, 202, 255, 0.0);
    border-color: rgba(145, 202, 255, 0.75);
    background: rgba(145, 202, 255, 0.04);
  }
  20% {
    box-shadow: 0 0 0 10px rgba(145, 202, 255, 0.22), 0 0 30px 10px rgba(145, 202, 255, 0.14);
    border-color: rgba(200, 230, 255, 0.98);
    background: rgba(145, 202, 255, 0.14);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(145, 202, 255, 0.0);
    border-color: rgba(255, 255, 255, 0.18);
    background: rgba(0, 0, 0, 0.15);
  }
}

@keyframes enchantDrop {
  0% {
    opacity: 0;
    transform: translateY(-18%) scaleY(0.8);
  }
  14% {
    opacity: 1;
  }
  48% {
    opacity: 0.9;
    transform: translateY(18%) scaleY(1.05);
  }
  100% {
    opacity: 0;
    transform: translateY(32%) scaleY(1.0);
  }
}

@keyframes killedBurst {
  0% {
    opacity: 0;
    transform: scale(0.96);
  }
  18% {
    opacity: 1;
    transform: scale(1.02);
  }
  100% {
    opacity: 0;
    transform: scale(1.03);
  }
}

@keyframes killedExplosion {
  0% {
    opacity: 0;
    transform: scale(0.72);
  }
  10% {
    opacity: 1;
    transform: scale(1.06);
  }
  28% {
    opacity: 0.95;
    transform: scale(1.22);
  }
  100% {
    opacity: 0;
    transform: scale(1.38);
  }
}

@keyframes killedShockwave {
  0% {
    opacity: 0;
    transform: scale(0.55);
  }
  16% {
    opacity: 0.9;
  }
  100% {
    opacity: 0;
    transform: scale(2.2);
  }
}

@keyframes killedSparks {
  0% {
    opacity: 0;
    transform: scale(0.7) rotate(-12deg);
  }
  12% {
    opacity: 1;
  }
  45% {
    opacity: 0.9;
    transform: scale(1.18) rotate(10deg);
  }
  100% {
    opacity: 0;
    transform: scale(1.45) rotate(24deg);
  }
}

@keyframes reviveWave {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.6);
  }
  18% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(5.2);
  }
}

@keyframes fxHit {
  0% {
    box-shadow: 0 0 0 0 rgba(255, 77, 79, 0.0);
    background: rgba(255, 77, 79, 0.02);
    transform: translateX(0) scale(1);
  }
  18% {
    box-shadow: 0 0 0 8px rgba(255, 77, 79, 0.28), 0 0 22px 6px rgba(255, 77, 79, 0.18);
    background: rgba(255, 77, 79, 0.12);
    transform: translateX(-2px) scale(1.03);
  }
  45% {
    box-shadow: 0 0 0 7px rgba(255, 77, 79, 0.22), 0 0 16px 4px rgba(255, 77, 79, 0.12);
    background: rgba(255, 77, 79, 0.08);
    transform: translateX(2px) scale(1.02);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(255, 77, 79, 0.0);
    background: rgba(0, 0, 0, 0.15);
    transform: translateX(0) scale(1);
  }
}

@keyframes fxKilled {
  0% {
    filter: grayscale(0);
    opacity: 1;
  }
  35% {
    filter: grayscale(1);
    opacity: 0.85;
    transform: scale(0.98);
  }
  100% {
    filter: grayscale(1);
    opacity: 0.72;
    transform: scale(0.98);
  }
}

@keyframes attackFlash {
  0% {
    opacity: 0;
  }
  14% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

@keyframes shockwave {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.7);
  }
  18% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(5.2);
  }
}

.floats {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 20;
}

.float {
  position: absolute;
  left: 50%;
  top: 38%;
  transform: translateX(-50%);
  font-weight: 900;
  font-size: 18px;
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.55);
  animation: floatUp 760ms ease-out 1;
}

.float-damage {
  color: rgba(255, 77, 79, 0.98);
}

.float-heal {
  color: rgba(82, 196, 26, 0.98);
}

@keyframes floatUp {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(6px) scale(0.92);
  }
  15% {
    opacity: 1;
    transform: translateX(-50%) translateY(0px) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px) scale(1.04);
  }
}

.cell-river-north {
  border-bottom-color: rgba(255, 255, 255, 0.55);
  border-bottom-width: 5px;
}

.cell-river-south {
  border-top-color: rgba(255, 255, 255, 0.55);
  border-top-width: 5px;
}

.cell-palace-north {
  border-top-color: rgba(255, 255, 255, 0.42);
  border-top-width: 3px;
}

.cell-palace-south {
  border-bottom-color: rgba(255, 255, 255, 0.42);
  border-bottom-width: 3px;
}

.cell-palace-west {
  border-left-color: rgba(255, 255, 255, 0.42);
  border-left-width: 3px;
}

.cell-palace-east {
  border-right-color: rgba(255, 255, 255, 0.42);
  border-right-width: 3px;
}

.cell:hover {
  background: rgba(255, 255, 255, 0.12);
}

.unit.enchanted {
  font-weight: 800;
  font-size: 15px;
  letter-spacing: 0.2px;
}

.tip {
  visibility: hidden;
  opacity: 0;
  position: absolute;
  left: 0;
  top: -6px;
  transform: translateY(-100%);
  z-index: 999;
  background: rgba(0, 0, 0, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 6px 8px;
  color: rgba(255, 255, 255, 0.92);
  min-width: 180px;
  pointer-events: none;
  transition: opacity 120ms ease;
}

.cell:hover .tip {
  visibility: visible;
  opacity: 1;
}

.cell-invalid-hoverable:hover {
  border-color: rgba(255, 77, 79, 0.85);
  background: rgba(255, 77, 79, 0.1);
}

.tip-invalid {
  min-width: 220px;
}

.tipRow {
  font-size: 11px;
  line-height: 14px;
  white-space: nowrap;
}

.tipImg {
  margin-top: 6px;
  width: 120px;
  height: 165px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.tipNoImg {
  margin-top: 6px;
  width: 120px;
  height: 165px;
  border-radius: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.18);
  display: grid;
  place-items: center;
  font-size: 11px;
  opacity: 0.8;
}

.cell-selected {
  border-color: rgba(145, 202, 255, 0.85);
  background: rgba(145, 202, 255, 0.12);
}

.cell-legal {
  border-color: rgba(82, 196, 26, 0.7);
  background: rgba(82, 196, 26, 0.12);
}

.cell-shootable {
  border-color: rgba(250, 173, 20, 0.9);
  background: rgba(250, 173, 20, 0.12);
}

.cell-enchantable {
  border-color: rgba(114, 46, 209, 0.9);
  background: rgba(114, 46, 209, 0.14);
}

.cell:focus-visible {
  outline: 2px solid #91caff;
  outline-offset: 2px;
}

.corpseBadge {
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.18);
  opacity: 0.95;
}

.unit {
  font-size: 18px;
  line-height: 20px;
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-weight: 800;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.6);
}

.hp {
  position: absolute;
  left: 3px;
  bottom: 3px;
  font-size: 1rem;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.18);
}

.hpHeart {
  color: #ff4d4f;
  margin-right: 3px;
}

.unit-red {
  color: #ff4d4f;
}

.unit-black {
  color: #52c41a;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}
</style>

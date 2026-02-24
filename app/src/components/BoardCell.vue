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
    @click="onClick"
    @dragover="onDragOver"
    @drop="onDrop"
  >
    <span v-if="corpseCount" class="corpseBadge mono">x{{ corpseCount }}</span>

    <span v-if="unit" class="hp mono"><span class="hpHeart">♥</span>{{ unit.hp }}</span>

    <span v-if="unit" class="unit mono" :class="[unit.sideClass, { enchanted: !!unit.enchantName }]">
      {{ unit.label }}
    </span>

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
  font-size: 11px;
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

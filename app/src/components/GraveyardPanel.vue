<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'GraveyardPanel',
  props: {
    red: { type: Array as () => string[], required: true },
    black: { type: Array as () => string[], required: true },
    previewCount: { type: Number, required: false, default: 5 },
  },
  emits: {
    'show-soul-detail': (_soulId: string) => true,
  },
})
</script>

<template>
  <div>
    <h2>Graveyard</h2>
    <div class="unitCard">
      <div class="row">
        <div class="label mono">red:</div>
        <div class="list">
          <button
            v-for="(id, idx) in red.slice(0, previewCount)"
            :key="`red:${id}:${idx}`"
            type="button"
            class="linkBtn mono"
            @click="$emit('show-soul-detail', id)"
          >
            {{ id }}
          </button>
          <div v-if="red.length === 0" class="mono">-</div>
        </div>
      </div>

      <div class="row">
        <div class="label mono">black:</div>
        <div class="list">
          <button
            v-for="(id, idx) in black.slice(0, previewCount)"
            :key="`black:${id}:${idx}`"
            type="button"
            class="linkBtn mono"
            @click="$emit('show-soul-detail', id)"
          >
            {{ id }}
          </button>
          <div v-if="black.length === 0" class="mono">-</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.unitCard {
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.18);
}

.row {
  display: grid;
  grid-template-columns: 52px 1fr;
  gap: 8px;
  align-items: start;
}

.label {
  opacity: 0.85;
}

.list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.linkBtn {
  padding: 0;
  border: none;
  background: transparent;
  color: rgba(145, 202, 255, 0.95);
  text-align: left;
  cursor: pointer;
}

.linkBtn:hover {
  text-decoration: underline;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}
</style>

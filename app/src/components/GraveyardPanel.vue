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
      <details class="row" :open="red.length > 0">
        <summary class="label mono">red: <span class="count">({{ red.length }})</span></summary>
        <div class="dropdown">
          <div v-if="red.length === 0" class="mono">-</div>
          <button
            v-for="(id, idx) in red.slice(0, previewCount)"
            :key="`red:${id}:${idx}`"
            type="button"
            class="linkBtn mono"
            @click="$emit('show-soul-detail', id)"
          >
            {{ id }}
          </button>
          <div v-if="red.length > previewCount" class="more mono">… +{{ red.length - previewCount }}</div>
        </div>
      </details>

      <details class="row" :open="black.length > 0">
        <summary class="label mono">black: <span class="count">({{ black.length }})</span></summary>
        <div class="dropdown">
          <div v-if="black.length === 0" class="mono">-</div>
          <button
            v-for="(id, idx) in black.slice(0, previewCount)"
            :key="`black:${id}:${idx}`"
            type="button"
            class="linkBtn mono"
            @click="$emit('show-soul-detail', id)"
          >
            {{ id }}
          </button>
          <div v-if="black.length > previewCount" class="more mono">… +{{ black.length - previewCount }}</div>
        </div>
      </details>
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
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 6px;
  padding-bottom: 6px;
}

.row:first-of-type {
  border-top: none;
  padding-top: 0;
}

.label {
  opacity: 0.85;
  cursor: pointer;
  list-style: none;
}

.label::-webkit-details-marker {
  display: none;
}

.count {
  opacity: 0.7;
}

.dropdown {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 180px;
  overflow: auto;
  padding: 6px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.15);
}

.linkBtn {
  padding: 0;
  border: none;
  background: transparent;
  color: rgba(145, 202, 255, 0.95);
  text-align: left;
  cursor: pointer;
  display: block;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.linkBtn:hover {
  text-decoration: underline;
}

.more {
  opacity: 0.75;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}
</style>

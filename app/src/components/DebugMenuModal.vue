<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'DebugMenuModal',
  props: {
    open: { type: Boolean, required: true },
    matchSeed: { type: String, required: true },
    enabledClans: { type: Array as () => string[], required: true },
  },
  emits: ['close', 'apply', 'open-events'],
  data() {
    return {
      seed: this.matchSeed,
      clans: new Set<string>(this.enabledClans),
    }
  },
  watch: {
    open(v: boolean) {
      if (!v) return
      this.seed = this.matchSeed
      this.clans = new Set<string>(this.enabledClans)
    },
    matchSeed(v: string) {
      this.seed = v
    },
    enabledClans(v: string[]) {
      this.clans = new Set<string>(v)
    },
  },
  methods: {
    toggleClan(id: string) {
      const next = new Set<string>(this.clans)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      this.clans = next
    },
    apply() {
      this.$emit('apply', { matchSeed: this.seed, enabledClans: Array.from(this.clans) })
    },
  },
})
</script>

<template>
  <div v-if="open" class="modalOverlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modalHead">
        <div class="modalTitle">Debug menu</div>
        <button type="button" class="closeBtn" @click="$emit('close')">Close</button>
      </div>

      <div class="panel">
        <div class="label mono">matchSeed</div>
        <input v-model="seed" class="input mono" type="text" />
      </div>

      <div class="panel">
        <div class="label mono">enabledClans</div>
        <label class="check mono">
          <input type="checkbox" :checked="clans.has('dark_moon')" @change="toggleClan('dark_moon')" />
          dark_moon
        </label>
        <label class="check mono">
          <input type="checkbox" :checked="clans.has('styx')" @change="toggleClan('styx')" />
          styx
        </label>
        <label class="check mono">
          <input type="checkbox" :checked="clans.has('eternal_night')" @change="toggleClan('eternal_night')" />
          eternal_night
        </label>
      </div>

      <div class="btnRow">
        <button type="button" @click="$emit('open-events')">Event log</button>
        <button type="button" class="primary" @click="apply">Restart with settings</button>
      </div>

      <div class="muted mono">Restart will reset the match state and apply the settings above.</div>
    </div>
  </div>
</template>

<style scoped>
.modalOverlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: grid;
  place-items: center;
  padding: 24px;
  z-index: 60;
}

.modal {
  width: min(640px, 96vw);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(0, 0, 0, 0.92);
  padding: 16px;
}

.modalHead {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.modalTitle {
  font-weight: 800;
  font-size: 16px;
}

.closeBtn {
  padding: 6px 10px;
}

.panel {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.04);
  margin-bottom: 10px;
}

.label {
  font-size: 12px;
  opacity: 0.85;
  margin-bottom: 6px;
}

.input {
  width: 100%;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.24);
  color: rgba(255, 255, 255, 0.92);
}

.check {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px 0;
}

.btnRow {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: 10px;
}

.primary {
  font-weight: 900;
}

.muted {
  opacity: 0.75;
  font-size: 12px;
  margin-top: 10px;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}
</style>

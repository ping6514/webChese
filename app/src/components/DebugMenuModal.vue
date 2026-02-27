<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'DebugMenuModal',
  props: {
    open: { type: Boolean, required: true },
    matchSeed: { type: String, required: true },
    enabledClans: { type: Array as () => string[], required: true },
  },
  emits: ['close', 'apply', 'open-events', 'go-home'],
  data() {
    return {
      seed: this.matchSeed,
      clans: new Set<string>(this.enabledClans),
      showAdvanced: false,
    }
  },
  watch: {
    open(v: boolean) {
      if (!v) return
      this.seed = this.matchSeed
      this.clans = new Set<string>(this.enabledClans)
    },
    matchSeed(v: string) { this.seed = v },
    enabledClans(v: string[]) { this.clans = new Set<string>(v) },
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

      <!-- ── Header ─────────────────────────────────── -->
      <div class="modalHead">
        <div class="headIcon">⚙️</div>
        <div class="modalTitle">遊戲選單</div>
        <button type="button" class="closeBtn" @click="$emit('close')">✕</button>
      </div>

      <!-- ── Quick actions ───────────────────────────── -->
      <div class="quickActions">
        <button type="button" class="actionCard homeBtn" @click="$emit('go-home')">
          <span class="actionIcon">🏠</span>
          <span class="actionLabel">回到標題</span>
        </button>
        <button type="button" class="actionCard eventsBtn" @click="$emit('open-events')">
          <span class="actionIcon">📜</span>
          <span class="actionLabel">事件紀錄</span>
        </button>
        <button type="button" class="actionCard closeBtn2" @click="$emit('close')">
          <span class="actionIcon">▶</span>
          <span class="actionLabel">繼續遊戲</span>
        </button>
      </div>

      <!-- ── Divider ──────────────────────────────────── -->
      <button type="button" class="advancedToggle" @click="showAdvanced = !showAdvanced">
        {{ showAdvanced ? '▲' : '▼' }} 開發者設定
      </button>

      <!-- ── Advanced settings ────────────────────────── -->
      <div v-if="showAdvanced" class="advancedSection">
        <div class="settingBlock">
          <div class="settingLabel mono">匹配種子 (matchSeed)</div>
          <input v-model="seed" class="input mono" type="text" placeholder="seed string" />
        </div>

        <div class="settingBlock">
          <div class="settingLabel mono">啟用氏族 (enabledClans)</div>
          <div class="clanRow">
            <label class="clanChip" :class="{ active: clans.has('dark_moon') }">
              <input type="checkbox" :checked="clans.has('dark_moon')" @change="toggleClan('dark_moon')" />
              🌙 暗月
            </label>
            <label class="clanChip" :class="{ active: clans.has('styx') }">
              <input type="checkbox" :checked="clans.has('styx')" @change="toggleClan('styx')" />
              💧 冥河
            </label>
            <label class="clanChip" :class="{ active: clans.has('eternal_night') }">
              <input type="checkbox" :checked="clans.has('eternal_night')" @change="toggleClan('eternal_night')" />
              🌑 永夜
            </label>
          </div>
        </div>

        <button type="button" class="restartBtn" @click="apply">
          🔄 套用設定並重新開局
        </button>
        <div class="muted mono">套用後會重置當前對局並使用上方設定重新開始。</div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.modalOverlay {
  position: fixed;
  inset: 0;
  background: var(--bg-modal-overlay);
  display: grid;
  place-items: center;
  padding: 24px;
  z-index: 60;
  backdrop-filter: blur(4px);
}

.modal {
  width: min(480px, 94vw);
  border-radius: 18px;
  border: 1px solid var(--border-strong);
  background: var(--bg-modal-strong);
  padding: 20px;
  box-shadow: 0 12px 56px rgba(0, 0, 0, 0.4);
}

/* ── Head ─────────────────────────────────────────── */
.modalHead {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border);
}

.headIcon {
  font-size: 1.375rem;
  line-height: 1;
}

.modalTitle {
  font-weight: 900;
  font-size: 1.125rem;
  letter-spacing: 0.05em;
  color: var(--text);
  flex: 1;
}

.closeBtn {
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: 8px;
  border: 1px solid var(--border-strong);
  background: var(--bg-surface-2);
  color: var(--text-muted);
  font-size: 0.875rem;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background 0.15s;
}
.closeBtn:hover { background: var(--bg-surface-1); }

/* ── Quick actions grid ───────────────────────────── */
.quickActions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 14px;
}

.actionCard {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  padding: 16px 10px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--bg-surface-2);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
  font-family: inherit;
}
.actionCard:hover {
  background: var(--bg-surface-1);
  border-color: var(--border-strong);
  transform: translateY(-1px);
}
.actionCard:active { transform: translateY(0); }

.actionIcon {
  font-size: 1.75rem;
  line-height: 1;
}

.actionLabel {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.03em;
}

/* Specific tints */
.homeBtn:hover {
  background: rgba(82, 196, 26, 0.10);
  border-color: rgba(82, 196, 26, 0.35);
}
.homeBtn:hover .actionLabel { color: var(--accent-green-light); }

.eventsBtn:hover {
  background: rgba(145, 202, 255, 0.10);
  border-color: rgba(145, 202, 255, 0.35);
}
.eventsBtn:hover .actionLabel { color: var(--accent-blue); }

.closeBtn2:hover {
  background: rgba(232, 208, 112, 0.10);
  border-color: rgba(232, 208, 112, 0.35);
}
.closeBtn2:hover .actionLabel { color: var(--accent-gold); }

/* ── Advanced toggle ─────────────────────────────── */
.advancedToggle {
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-surface-2);
  color: var(--text-dim);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  letter-spacing: 0.04em;
  transition: background 0.15s, color 0.15s;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.advancedToggle:hover { background: var(--bg-surface-1); color: var(--text-muted); }

/* ── Advanced section ────────────────────────────── */
.advancedSection {
  margin-top: 10px;
  display: grid;
  gap: 10px;
}

.settingBlock {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  background: var(--bg-surface-2);
  display: grid;
  gap: 7px;
}

.settingLabel {
  font-size: 0.6875rem;
  opacity: 0.65;
  letter-spacing: 0.06em;
}

.input {
  width: 100%;
  padding: 7px 10px;
  border-radius: 8px;
  border: 1px solid var(--border-strong);
  background: var(--bg-surface-3);
  color: var(--text);
  font-size: 0.8125rem;
  box-sizing: border-box;
}
.input:focus { outline: none; border-color: var(--border-focus); }

/* ── Clan chips ──────────────────────────────────── */
.clanRow {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.clanChip {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-surface-3);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  color: var(--text-muted);
  transition: all 0.15s;
}
.clanChip input { display: none; }
.clanChip.active {
  background: rgba(145, 202, 255, 0.14);
  border-color: rgba(145, 202, 255, 0.55);
  color: var(--accent-blue);
}

/* ── Restart button ──────────────────────────────── */
.restartBtn {
  width: 100%;
  padding: 11px;
  border-radius: 10px;
  border: 1px solid rgba(255, 77, 79, 0.40);
  background: rgba(255, 77, 79, 0.12);
  color: var(--accent-red-light);
  font-size: 0.9375rem;
  font-weight: 800;
  cursor: pointer;
  letter-spacing: 0.04em;
  transition: background 0.15s;
}
.restartBtn:hover { background: rgba(255, 77, 79, 0.22); }

.muted {
  font-size: 0.6875rem;
  color: var(--text-dim);
  line-height: 1.5;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}
</style>

<script lang="ts">
import { defineComponent, computed } from 'vue'

type ParsedLine = {
  icon: string
  key: string
  value: string
  highlight?: 'hp' | 'atk' | 'def' | 'gold' | 'text' | 'enchant'
}

const KEY_META: Record<string, { icon: string; label: string; highlight?: ParsedLine['highlight'] }> = {
  unitId:  { icon: '🆔', label: 'ID' },
  id:      { icon: '🆔', label: 'ID' },
  side:    { icon: '⚑', label: '陣營' },
  base:    { icon: '♟️', label: '基底' },
  pos:     { icon: '📍', label: '位置' },
  hp:      { icon: '❤️', label: 'HP', highlight: 'hp' },
  atk:     { icon: '⚔️', label: '攻擊', highlight: 'atk' },
  def:     { icon: '🛡️', label: '防禦', highlight: 'def' },
  enchant: { icon: '✨', label: '靈魂', highlight: 'enchant' },
  soul:    { icon: '✨', label: '靈魂', highlight: 'enchant' },
  clan:    { icon: '🏴', label: '氏族' },
  cost:    { icon: '💰', label: '費用', highlight: 'gold' },
  text:    { icon: '📝', label: '效果', highlight: 'text' },
  name:    { icon: '📛', label: '名稱' },
  type:    { icon: '🔖', label: '類型' },
  timing:  { icon: '⏱️', label: '時機' },
  range:   { icon: '📏', label: '範圍' },
}

function parseDetail(detail: string): { stats: ParsedLine[]; text: string } {
  const lines = detail.split('\n')
  const stats: ParsedLine[] = []
  const textLines: string[] = []
  let inText = false

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    // Once we hit text/effect line, collect the rest as text block
    if (inText) { textLines.push(raw); continue }

    const colonIdx = line.indexOf(':')
    if (colonIdx > 0 && colonIdx < 20) {
      const rawKey = line.slice(0, colonIdx).trim()
      const value  = line.slice(colonIdx + 1).trim()
      const meta = KEY_META[rawKey] ?? null
      const icon  = meta?.icon ?? '•'
      const key   = meta?.label ?? rawKey
      const highlight = meta?.highlight
      if (rawKey === 'text') {
        inText = true
        textLines.push(value)
      } else {
        stats.push({ icon, key, value, highlight })
      }
    } else {
      textLines.push(raw)
    }
  }

  return { stats, text: textLines.join('\n').trim() }
}

export default defineComponent({
  name: 'CardDetailModal',
  props: {
    open: { type: Boolean, required: true },
    title: { type: String, required: true },
    detail: { type: String, required: true },
    image: { type: String as () => string | null, required: false, default: null },
    actionLabel: { type: String as () => string | null, required: false, default: null },
    actionDisabled: { type: Boolean, required: false, default: false },
    actionTitle: { type: String as () => string, required: false, default: '' },
  },
  emits: ['close', 'action'],
  setup(props) {
    const parsed = computed(() => parseDetail(props.detail))
    return { parsed }
  },
})
</script>

<template>
  <div v-if="open" class="modalOverlay" @click.self="$emit('close')">
    <div class="modal">
      <!-- Head -->
      <div class="modalHead">
        <div class="modalTitle">{{ title }}</div>
        <button type="button" class="closeBtn" @click="$emit('close')">✕</button>
      </div>

      <!-- Body -->
      <div class="modalBody">
        <!-- Image column -->
        <div class="imgCol">
          <img v-if="image" class="img" :src="image" alt="" />
          <div v-else class="noImg">🃏</div>
        </div>

        <!-- Stats column -->
        <div class="statsCol">
          <div
            v-for="(line, i) in parsed.stats"
            :key="i"
            class="statRow"
            :class="line.highlight ? `hl-${line.highlight}` : ''"
          >
            <span class="statIcon">{{ line.icon }}</span>
            <span class="statKey">{{ line.key }}</span>
            <span class="statVal">{{ line.value }}</span>
          </div>

          <!-- Effect text block -->
          <div v-if="parsed.text" class="textBlock">
            <div class="textHead">📝 效果</div>
            <div class="textBody">{{ parsed.text }}</div>
          </div>

          <!-- Fallback: raw detail if no stats parsed -->
          <div v-if="parsed.stats.length === 0 && !parsed.text" class="rawDetail">{{ detail }}</div>
        </div>
      </div>

      <!-- Action button -->
      <div v-if="actionLabel" class="modalBtns">
        <button
          type="button"
          class="actionBtn"
          @click="$emit('action')"
          :disabled="actionDisabled"
          :title="actionTitle"
        >
          {{ actionLabel }}
        </button>
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
  z-index: 80;
  backdrop-filter: blur(3px);
}

.modal {
  width: min(660px, 92vw);
  border-radius: 16px;
  border: 1px solid var(--border-strong);
  background: var(--bg-modal-strong);
  padding: 20px;
  box-shadow: 0 8px 48px rgba(0, 0, 0, 0.35);
}

/* ── Head ────────────────────────────────────────────────────────────── */
.modalHead {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}

.modalTitle {
  font-weight: 900;
  font-size: 22px;
  letter-spacing: 0.02em;
}

.closeBtn {
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 8px;
  border: 1px solid var(--border-strong);
  background: var(--bg-surface-2);
  color: var(--text-muted);
  font-size: 14px;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background 0.15s;
}
.closeBtn:hover { background: var(--bg-surface-1); }

/* ── Body ────────────────────────────────────────────────────────────── */
.modalBody {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 18px;
  align-items: start;
}

.imgCol { width: 160px; }

.img {
  width: 160px;
  height: 220px;
  object-fit: cover;
  border-radius: 12px;
  border: 1px solid var(--border-strong);
}

.noImg {
  width: 160px;
  height: 220px;
  border-radius: 12px;
  border: 1px dashed var(--border-strong);
  display: grid;
  place-items: center;
  font-size: 48px;
  background: var(--bg-surface-3);
}

/* ── Stats column ────────────────────────────────────────────────────── */
.statsCol {
  display: grid;
  gap: 6px;
}

.statRow {
  display: grid;
  grid-template-columns: 22px 72px 1fr;
  gap: 8px;
  align-items: baseline;
  padding: 5px 8px;
  border-radius: 8px;
  background: var(--bg-surface-2);
  border: 1px solid var(--border);
  transition: background 0.12s;
}
.statRow:hover { background: var(--bg-surface-1); }

.statIcon { font-size: 14px; text-align: center; }

.statKey {
  font-size: 12px;
  opacity: 0.55;
  font-weight: 600;
}

.statVal {
  font-size: 14px;
  font-weight: 700;
  word-break: break-all;
}

/* ── Highlights ──────────────────────────────────────────────────────── */
.hl-hp .statVal    { font-size: 20px; color: #ff9c9e; font-weight: 900; }
.hl-atk .statVal   { color: #ffa39e; }
.hl-def .statVal   { color: #91caff; }
.hl-gold .statVal  { color: #e8d070; }
.hl-enchant .statVal { color: rgba(145, 202, 255, 0.9); }

/* ── Text block ──────────────────────────────────────────────────────── */
.textBlock {
  margin-top: 4px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(145, 202, 255, 0.07);
  border: 1px solid rgba(145, 202, 255, 0.2);
}

.textHead {
  font-size: 12px;
  font-weight: 700;
  opacity: 0.65;
  margin-bottom: 6px;
}

.textBody {
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  color: var(--text);
}

.rawDetail {
  font-size: 13px;
  white-space: pre-wrap;
  opacity: 0.85;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

/* ── Action button ───────────────────────────────────────────────────── */
.modalBtns {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.actionBtn {
  padding: 9px 24px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
  border: 1px solid rgba(82, 196, 26, 0.55);
  background: rgba(82, 196, 26, 0.18);
  color: #b7eb8f;
  transition: background 0.15s;
}
.actionBtn:not(:disabled):hover { background: rgba(82, 196, 26, 0.3); }
.actionBtn:disabled { opacity: 0.35; cursor: not-allowed; }
</style>

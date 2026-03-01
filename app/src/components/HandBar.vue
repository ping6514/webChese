<script lang="ts">
import { computed, defineComponent, ref } from 'vue'
import type { GuardResult, GameState, PieceBase, SoulCard } from '../engine'
import HandSouls from './HandSouls.vue'
import HandItems from './HandItems.vue'
import { useUiStore } from '../stores/ui'

type UnitLite = {
  id: string
  side: 'red' | 'black'
  base: PieceBase
}

export default defineComponent({
  name: 'HandBar',
  components: { HandSouls, HandItems },
  props: {
    phase: { type: String as () => GameState['turn']['phase'], required: true },

    soulCards: { type: Array as () => SoulCard[], required: true },
    selectedSoulId: { type: String, required: true },
    selectedUnit: { type: Object as () => UnitLite | null, required: true },
    enchantGuard: { type: Object as () => GuardResult, required: true },
    returnGuards: { type: Object as () => Partial<Record<string, GuardResult>>, required: true },

    items: { type: Array as () => string[], required: true },
    discardGuards: { type: Object as () => Partial<Record<string, GuardResult>>, required: true },
    useGuards: {
      type: Object as () => Partial<Record<string, GuardResult>>,
      required: false,
      default: () => ({}),
    },
    getItemName: {
      type: Function as unknown as () => (itemId: string) => string,
      required: true,
    },
    getItem: {
      type: Function as unknown as () => (itemId: string) => any,
      required: false,
      default: undefined,
    },
  },
  emits: ['select-soul', 'dragstart-soul', 'dragend-soul', 'enchant', 'return-soul', 'discard-item', 'use-item', 'show-item-detail'],
  setup(props) {
    const tab = ref<'souls' | 'items'>('souls')
    const ui = useUiStore()
    const isCollapsed = computed(() => ui.handCollapsedOverride ?? ui.handCollapsedUser)

    function toggleCollapsed() {
      const next = !isCollapsed.value
      if (ui.handCollapsedOverride != null) ui.setHandCollapsedOverride(null)
      ui.setHandCollapsedUser(next)
    }

    const soulCount = computed(() => props.soulCards.length)
    const itemCount = computed(() => props.items.length)

    return { tab, ui, isCollapsed, toggleCollapsed, soulCount, itemCount }
  },
})
</script>

<template>
  <div class="handBarWrap">
    <!-- Tab header -->
    <div class="tabBar">
      <button
        type="button"
        class="tabBtn"
        :class="{ active: tab === 'souls' }"
        @click="tab = 'souls'"
      >
        ✨ 靈魂
        <span class="badge" :class="{ badgeActive: tab === 'souls' }">{{ soulCount }}</span>
      </button>
      <button
        type="button"
        class="tabBtn"
        :class="{ active: tab === 'items' }"
        @click="tab = 'items'"
      >
        🎒 道具
        <span class="badge" :class="{ badgeActive: tab === 'items' }">{{ itemCount }}</span>
      </button>

      <button type="button" class="collapseBtn" @click="toggleCollapsed()">
        {{ isCollapsed ? '▲ 展開' : '▼ 收起' }}
      </button>
    </div>

    <!-- Content -->
    <div class="handBody" :class="{ collapsed: isCollapsed }">
      <HandSouls
        v-if="tab === 'souls'"
        :phase="phase"
        :cards="soulCards"
        :selected-soul-id="selectedSoulId"
        :selected-unit="selectedUnit"
        :enchant-guard="enchantGuard"
        :return-guards="returnGuards"
        @select="$emit('select-soul', $event)"
        @dragstart="(e, soulId) => $emit('dragstart-soul', e, soulId)"
        @dragend="(e, soulId) => $emit('dragend-soul', e, soulId)"
        @enchant="$emit('enchant')"
        @return="$emit('return-soul', $event)"
      />

      <HandItems
        v-else
        :phase="phase"
        :items="items"
        :discard-guards="discardGuards"
        :use-guards="useGuards"
        :get-item-name="getItemName"
        :get-item="getItem"
        @discard="$emit('discard-item', $event)"
        @use-item="$emit('use-item', $event)"
        @show-item-detail="$emit('show-item-detail', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.handBarWrap {
  position: sticky;
  bottom: 8px;
  z-index: 15;
  margin-top: 8px;
  border: 1px solid var(--border-strong);
  border-radius: 14px;
  background: var(--bg-modal);
  backdrop-filter: blur(8px);
  overflow: hidden;
}

/* ── Tab bar ─────────────────────────────────────────────────────────── */
.tabBar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
}

.tabBtn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  font-size: 0.8125rem;
  font-weight: 700;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg-surface-2);
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.tabBtn:hover {
  background: var(--bg-surface-1);
  color: var(--text);
}
.tabBtn.active {
  background: rgba(145, 202, 255, 0.14);
  border-color: rgba(145, 202, 255, 0.7);
  color: var(--accent-blue);
}

.badge {
  font-size: 0.6875rem;
  font-weight: 800;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--bg-surface-2);
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
.badge.badgeActive {
  background: rgba(145, 202, 255, 0.25);
  color: var(--accent-blue);
}

.collapseBtn {
  margin-left: auto;
  padding: 5px 12px;
  font-size: 0.75rem;
  font-weight: 700;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-surface-2);
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.collapseBtn:hover {
  background: var(--bg-surface-1);
  color: var(--text);
}

/* ── Content area ────────────────────────────────────────────────────── */
.handBody {
  padding: 10px;
  max-height: 300px;
  overflow: visible;
  transition: max-height 180ms ease, padding 180ms ease;
}

.handBody.collapsed {
  max-height: 0;
  overflow: hidden;
  padding-top: 0;
  padding-bottom: 0;
}
</style>

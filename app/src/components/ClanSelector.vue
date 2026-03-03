<script setup lang="ts">
defineProps<{
  clans: { id: string; label: string }[]
  selected: string[]
}>()

defineEmits<{ toggle: [id: string] }>()
</script>

<template>
  <div class="section">
    <div class="section-label">卡池氏族 <span class="clan-hint">（至少選 1 個）</span></div>
    <div class="btn-group">
      <button
        v-for="c in clans"
        :key="c.id"
        type="button"
        :class="['opt-btn', 'clan-btn', selected.includes(c.id) && 'active']"
        @click="$emit('toggle', c.id)"
      >{{ c.label }}</button>
    </div>
  </div>
</template>

<style scoped>
.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  opacity: 0.55;
  text-transform: uppercase;
}

.btn-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.opt-btn {
  flex: 1;
  min-width: 80px;
  padding: 9px 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font-size: 0.8125rem;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  line-height: 1.3;
}

.opt-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.clan-hint {
  font-size: 0.7rem;
  opacity: 0.55;
  font-weight: 400;
}

.clan-btn {
  flex: 1;
  font-size: 0.85rem;
  padding: 8px 4px;
}

.clan-btn.active {
  background: rgba(145, 202, 255, 0.16);
  border-color: rgba(145, 202, 255, 0.55);
  color: #91caff;
}
</style>

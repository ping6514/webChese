import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import type { Action, GuardResult, GameState } from './engine'
import { canDispatch, getSoulCard } from './engine'
import { useUiStore } from './stores/ui'

export function usePendingConfirm(opts: { getState: () => GameState }) {
  const ui = useUiStore()
  const { pendingConfirm: pending } = storeToRefs(ui)

  const pendingImage = computed(() => {
    if (!pending.value) return null
    const a = pending.value.action
    if (a.type !== 'ENCHANT') return null
    const c = getSoulCard(a.soulId)
    return c?.image || null
  })

  const pendingGuard = computed<GuardResult>(() => {
    if (!pending.value) return { ok: false as const, reason: 'No action' }
    return canDispatch(opts.getState(), pending.value.action)
  })

  function setPending(p: Exclude<(typeof pending.value), null>) {
    ui.setPendingConfirm(p)
  }

  function clearPending() {
    ui.clearPendingConfirm()
  }

  function confirmPending(dispatch: (a: Action) => void) {
    if (!pending.value) return
    if (!pendingGuard.value.ok) return
    const a = pending.value.action
    ui.clearPendingConfirm()
    dispatch(a)
  }

  return {
    pending,
    pendingImage,
    pendingGuard,
    setPending,
    clearPending,
    confirmPending,
  }
}

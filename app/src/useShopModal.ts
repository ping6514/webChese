import { ref, watch } from 'vue'
import type { GameState } from './engine'

export function useShopModal(opts: { getPhase: () => GameState['turn']['phase'] }) {
  const shopOpen = ref(false)

  function openShop() {
    shopOpen.value = true
  }

  function closeShop() {
    shopOpen.value = false
  }

  watch(
    () => opts.getPhase(),
    (phase, prev) => {
      if (phase === 'buy' && prev !== 'buy') {
        shopOpen.value = true
      }
    },
  )

  return { shopOpen, openShop, closeShop }
}

import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { getItemCard, getSoulCard, type GuardResult, type GameState } from './engine'
import { useUiStore } from './stores/ui'

export function useCardDetailModal(opts: {
  getState: () => GameState
  getEnemyGraveTop: () => string | null
  getBuyEnemyGraveGuard: () => GuardResult
  getBuyEnemyGraveGoldCost: () => number
  buyFromEnemyGraveyard: () => void
}) {
  const ui = useUiStore()
  const { detailModal } = storeToRefs(ui)
  const onAction = ref<(() => void) | null>(null)

  function closeDetail() {
    onAction.value = null
    ui.closeDetailModal()
  }

  function runDetailAction() {
    const fn = onAction.value
    if (!fn) return
    closeDetail()
    fn()
  }

  function showSoulDetail(id: string | null | undefined) {
    if (!id) return
    const c = getSoulCard(id)
    if (!c) return
    onAction.value = null
    ui.openDetailModal({
      title: c.name,
      image: c.image || null,
      actionLabel: null,
      actionDisabled: false,
      actionTitle: '',
      detail: [
        `id: ${c.id}`,
        `base: ${c.base}`,
        `cost: ${c.costGold}G`,
        `hp: ${c.stats.hp}`,
        `atk: ${c.stats.atk.key} ${c.stats.atk.value}`,
        `def: ${c.stats.def.map((d) => `${d.key} ${d.value}`).join(' / ')}`,
        c.text ? `\ntext: ${c.text}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    })
  }

  function showItemDetail(id: string | null | undefined) {
    if (!id) return
    const c = getItemCard(id)
    if (!c) return
    onAction.value = null
    ui.openDetailModal({
      title: c.name,
      image: c.image || null,
      actionLabel: null,
      actionDisabled: false,
      actionTitle: '',
      detail: [
        `id: ${c.id}`,
        `timing: ${c.timing ?? '-'}`,
        `cost: ${c.costGold}G`,
        c.text ? `\ntext: ${c.text}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    })
  }

  function showEnemyGraveTopDetail() {
    const id = opts.getEnemyGraveTop()
    if (!id) return
    const c = getSoulCard(id)
    if (!c) return

    const g = opts.getBuyEnemyGraveGuard()
    const cost = opts.getBuyEnemyGraveGoldCost()
    const actionDisabled = !g.ok
    const actionTitle = !g.ok && 'reason' in g ? String((g as any).reason) : ''

    onAction.value = () => opts.buyFromEnemyGraveyard()
    ui.openDetailModal({
      title: c.name,
      image: c.image || null,
      actionLabel: `Buy enemy grave top (${cost}G)`,
      actionDisabled,
      actionTitle,
      detail: [
        `id: ${c.id}`,
        `base: ${c.base}`,
        `cost: ${c.costGold}G`,
        `hp: ${c.stats.hp}`,
        `atk: ${c.stats.atk.key} ${c.stats.atk.value}`,
        `def: ${c.stats.def.map((d) => `${d.key} ${d.value}`).join(' / ')}`,
        c.text ? `\ntext: ${c.text}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    })
  }

  return {
    detailModal,
    closeDetail,
    runDetailAction,
    showSoulDetail,
    showItemDetail,
    showEnemyGraveTopDetail,
  }
}

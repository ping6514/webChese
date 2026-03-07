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

  const BASE_NAMES: Record<string, string> = {
    king: '帥', advisor: '士', elephant: '象', rook: '車', knight: '馬', cannon: '炮', soldier: '兵',
  }
  const CLAN_NAMES: Record<string, string> = {
    dark_moon: '暗月', styx: '冥河', eternal_night: '永夜', iron_guard: '鐵衛',
  }
  const TIMING_NAMES: Record<string, string> = { buy: '買入', necro: '死靈術', combat: '戰鬥' }

  function buildSoulLines(c: NonNullable<ReturnType<typeof getSoulCard>>): string[] {
    const lines: string[] = []
    lines.push(`base: ${BASE_NAMES[c.base] ?? c.base}`)
    lines.push(`clan: ${CLAN_NAMES[c.clan] ?? c.clan}`)
    lines.push(`hp: ${c.stats.hp}`)
    if (c.stats.atk) {
      const k = c.stats.atk.key === 'phys' ? '物理' : '魔法'
      lines.push(`atk: ${k} ${c.stats.atk.value}`)
    }
    if (c.stats.def && c.stats.def.length > 0) {
      const defStr = c.stats.def.map((d) => `${d.key === 'phys' ? '物理' : '魔法'} ${d.value}`).join(' / ')
      lines.push(`def: ${defStr}`)
    }
    lines.push(`cost: ${c.costGold} 財力`)
    if (c.text) lines.push(`text: ${c.text}`)
    return lines
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
      detail: buildSoulLines(c).join('\n'),
    })
  }

  function showItemDetail(id: string | null | undefined) {
    if (!id) return
    const c = getItemCard(id)
    if (!c) return
    onAction.value = null
    const lines: string[] = []
    if (c.timing) lines.push(`timing: ${TIMING_NAMES[c.timing] ?? c.timing}`)
    lines.push(`cost: ${c.costGold} 財力`)
    if (c.text) lines.push(`text: ${c.text}`)
    ui.openDetailModal({
      title: c.name,
      image: c.image || null,
      actionLabel: null,
      actionDisabled: false,
      actionTitle: '',
      detail: lines.join('\n'),
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
      actionLabel: `盜取 (${cost}G)`,
      actionDisabled,
      actionTitle,
      detail: buildSoulLines(c).join('\n'),
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

import { ref, watch } from 'vue'
import type { Ref } from 'vue'
import { reduce } from '../engine'
import type { GameState } from '../engine'
import type { useGameEffects } from './useGameEffects'
import type { useGameSetup } from '../stores/gameSetup'
import type { useConnection } from '../stores/connection'

const PHASE_LABELS: Record<string, string> = {
  buy: '購買', necro: '死靈術', combat: '戰鬥', turnEnd: '回合結束', turnStart: '換手',
}

function eventToText(e: Record<string, unknown>, getState: () => GameState): string {
  const s = (side: unknown) => side === 'red' ? '🔴紅' : '⚫黑'
  switch (e.type) {
    case 'PHASE_CHANGED': {
      const to = e.to as string
      if (to === 'buy' || to === 'necro' || to === 'combat')
        return `── ${s(e.side)}方 ${PHASE_LABELS[to] ?? to}階段 ──`
      if (to === 'turnStart') return `──────── 換手 ────────`
      return ''
    }
    case 'SOUL_BOUGHT':
      return `${s(e.side)}方 購買靈魂「${e.soulName}」(${e.base}) [${e.source === 'deck' ? '盲抽' : e.source === 'display' ? '展示' : '盜取'}]`
    case 'ENCHANTED':
      return `${s((getState().units as any)[e.unitId as string]?.side ?? '?')}方 附魔 ${e.unitId} ← ${e.soulId}`
    case 'REVIVED':
      return `${s((getState().units as any)[e.unitId as string]?.side ?? '?')}方 復活 ${e.unitId}`
    case 'UNIT_MOVED':
      return `移動 (${(e.from as any)?.x},${(e.from as any)?.y})→(${(e.to as any)?.x},${(e.to as any)?.y})`
    case 'SHOT_FIRED':
      return `射擊 ${e.attackerId} → ${e.targetUnitId}`
    case 'DAMAGE_DEALT':
      return `傷害 ${e.targetUnitId} -${e.amount}`
    case 'UNIT_HP_CHANGED': {
      const delta = (e.to as number) - (e.from as number)
      return `${e.unitId} HP ${delta > 0 ? '+' : ''}${delta}（${e.from}→${e.to}）`
    }
    case 'UNIT_KILLED':
      return `💀 ${e.unitId} 陣亡`
    case 'ABILITY_TRIGGERED':
      return `⚡ ${e.text ?? e.abilityType ?? e.unitId}`
    case 'ITEM_USED':
      return `${s(e.side)}方 使用道具「${e.itemName}」`
    case 'RESOURCES_CHANGED':
      return `${s(e.side)}方 財力${e.gold} 魔力${e.mana}`
    default:
      return JSON.stringify(e)
  }
}

export function useGameDispatch(opts: {
  state: Ref<GameState>
  processEventFx: ReturnType<typeof useGameEffects>['processEventFx']
  setup: ReturnType<typeof useGameSetup>
  conn: ReturnType<typeof useConnection>
}) {
  const { state, processEventFx, setup, conn } = opts

  const lastError = ref<string | null>(null)
  const lastEvents = ref<string[]>([])
  const onlineWaiting = ref(false)

  function toText(e: Record<string, unknown>): string {
    return eventToText(e, () => state.value)
  }

  function processEvents(events: unknown[], nextState: GameState, prevState?: GameState) {
    processEventFx(events, nextState, prevState)
  }

  // Sync server state → local state in online mode; process opponent events
  watch(
    () => conn.gameState,
    (gs) => {
      if (!gs || setup.mode !== 'online') return
      state.value = gs
      if (conn.pollEvents.length > 0) {
        const evts = conn.pollEvents as Record<string, unknown>[]
        processEvents(evts as unknown[], state.value, undefined)
        const lines = evts.map(toText).filter(Boolean)
        lastEvents.value = [...lastEvents.value, ...lines].slice(-300)
      }
    },
    { immediate: true },
  )

  async function dispatchOnline(action: Parameters<typeof reduce>[1]) {
    if (onlineWaiting.value) return
    onlineWaiting.value = true
    const prevState = state.value
    const result = await conn.sendAction(action)
    onlineWaiting.value = false
    if (!result.ok) {
      lastError.value = result.error ?? 'Server error'
      return
    }
    lastError.value = null
    if (conn.gameState) state.value = conn.gameState
    processEvents(conn.lastEvents as unknown[], state.value, prevState)
    lastEvents.value = [
      ...lastEvents.value,
      ...(conn.lastEvents as Record<string, unknown>[]).map(toText).filter(Boolean),
    ].slice(-300)
  }

  function dispatch(action: Parameters<typeof reduce>[1]) {
    if (setup.mode === 'online') {
      dispatchOnline(action)
      return
    }

    const prevState = state.value
    const res = reduce(state.value, action)
    if (res.ok === false) {
      lastError.value = res.error
      return
    }

    lastError.value = null
    state.value = res.state

    processEvents(res.events as unknown[], res.state, prevState)
    lastEvents.value = [...lastEvents.value, ...(res.events as Record<string, unknown>[]).map(toText).filter(Boolean)].slice(-300)
  }

  return { dispatch, lastError, lastEvents, onlineWaiting }
}

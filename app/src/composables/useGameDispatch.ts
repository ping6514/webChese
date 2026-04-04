import { ref, watch, nextTick } from 'vue'
import type { Ref } from 'vue'
import { reduce } from '../engine'
import type { GameState } from '../engine'
import type { Event } from '../engine/events'
import { getSoulCard } from '../engine/cards'
import type { useGameEffects } from './useGameEffects'
import type { useGameSetup } from '../stores/gameSetup'
import type { useConnection } from '../stores/connection'

const PHASE_LABELS: Record<string, string> = {
  buy: '購買', necro: '死靈術', combat: '戰鬥', turnEnd: '回合結束', turnStart: '換手',
}

const PIECE_ZH: Record<string, Record<string, string>> = {
  red:   { king: '帥', advisor: '仕', elephant: '相', rook: '車', knight: '馬', cannon: '炮', soldier: '兵' },
  black: { king: '將', advisor: '士', elephant: '象', rook: '車', knight: '馬', cannon: '砲', soldier: '卒' },
}

function unitLabel(unit: { side: string; base: string } | undefined | null, fallback: string): string {
  if (!unit) return fallback
  const zh = PIECE_ZH[unit.side]?.[unit.base] ?? unit.base
  return `${unit.side === 'red' ? '🔴' : '⚫'}${zh}`
}

function eventToText(
  e: Event,
  getState: () => GameState,
  getPrevState?: () => GameState | undefined,
): string {
  const s = (side: string | undefined) => side === 'red' ? '🔴紅' : '⚫黑'
  const findUnit = (unitId: string) => {
    const u = getState().units[unitId]
    if (u) return u
    return getPrevState ? getPrevState()?.units[unitId] ?? null : null
  }
  switch (e.type) {
    case 'PHASE_CHANGED': {
      const to = e.to
      if (to === 'buy' || to === 'necro' || to === 'combat')
        return `── ${s(e.side)}方 ${PHASE_LABELS[to] ?? to}階段 ──`
      if (to === 'turnStart') return `──────── 換手 ────────`
      return ''
    }
    case 'SOUL_BOUGHT':
      return `${s(e.side)}方 購買靈魂「${e.soulName}」(${e.base}) [${e.source === 'deck' ? '盲抽' : e.source === 'display' ? '展示' : '盜取'}]`
    case 'ENCHANTED': {
      const unit = findUnit(e.unitId)
      const soulName = getSoulCard(e.soulId)?.name ?? e.soulId
      return `${s(unit?.side)}方 附魔 ${unitLabel(unit, e.unitId)} ← 「${soulName}」`
    }
    case 'REVIVED': {
      const unit = findUnit(e.unitId)
      return `${s(unit?.side ?? e.unitId.split(':')[0])}方 復活 ${unitLabel(unit, e.unitId)} @ (${e.pos.x},${e.pos.y})`
    }
    case 'UNIT_MOVED': {
      const unit = findUnit(e.unitId)
      return `${unitLabel(unit, e.unitId)} 移動 (${e.from.x},${e.from.y})→(${e.to.x},${e.to.y})`
    }
    case 'SHOT_FIRED': {
      const atk = findUnit(e.attackerId)
      const tgt = findUnit(e.targetUnitId)
      return `${unitLabel(atk, e.attackerId)} 射擊 ${unitLabel(tgt, e.targetUnitId)}`
    }
    case 'DAMAGE_DEALT': {
      const atkUnit = findUnit(e.attackerId)
      const tgtUnit = findUnit(e.targetUnitId)
      const atkName = unitLabel(atkUnit, e.attackerId)
      const tgtName = unitLabel(tgtUnit, e.targetUnitId)
      const bd = e.breakdown
      if (bd?.length) {
        const formula = bd.map((b) => (b.amount > 0 ? `+${b.amount}${b.label}` : `${b.amount}${b.label}`)).join(' ')
        return `⚔ ${atkName} → ${tgtName}：${formula} = ${e.amount}`
      }
      return `⚔ ${atkName} → ${tgtName}：${e.amount} 傷`
    }
    case 'UNIT_HP_CHANGED': {
      const unit = findUnit(e.unitId)
      const delta = e.to - e.from
      return `${unitLabel(unit, e.unitId)} HP ${delta > 0 ? '+' : ''}${delta}（${e.from}→${e.to}）`
    }
    case 'UNIT_KILLED': {
      const unit = findUnit(e.unitId)
      return `💀 ${unitLabel(unit, e.unitId)} 陣亡`
    }
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

  function toText(e: Event, prevState?: GameState): string {
    return eventToText(e, () => state.value, prevState ? () => prevState : undefined)
  }

  function processEvents(events: Event[], nextState: GameState, prevState?: GameState) {
    processEventFx(events, nextState, prevState)
  }

  // Sync server state → local state in online mode; process opponent events
  watch(
    () => conn.gameState,
    (gs) => {
      if (!gs || setup.mode !== 'online') return
      state.value = gs
      if (conn.pollEvents.length > 0) {
        const evts = conn.pollEvents as Event[]
        conn.pollEvents = []  // clear before processing to prevent re-play if watch fires again
        processEvents(evts, state.value, undefined)
        const lines = evts.map((e) => toText(e)).filter(Boolean)
        lastEvents.value = [...lastEvents.value, ...lines].slice(-300)
      }
    },
    { immediate: true },
  )

  async function dispatchOnline(action: Parameters<typeof reduce>[1]) {
    if (onlineWaiting.value || conn.isSyncing || conn.isSendingAction) return
    const onlineAction = { ...action, expectedVersion: conn.localVersion } as unknown as Parameters<typeof reduce>[1]
    const isSurrender = action.type === 'SURRENDER'
    if (!isSurrender && conn.side !== state.value.turn.side) {
      lastError.value = '現在是對手的回合'
      return
    }
    onlineWaiting.value = true
    const prevState = state.value
    const result = await conn.sendAction(onlineAction)
    onlineWaiting.value = false
    if (!result.ok) {
      // sendAction already called _fetchState() on failure; no extra resync needed
      if (result.code === 'VERSION_MISMATCH') {
        lastError.value = '狀態已過期，正在重新同步最新戰局…'
      } else {
        lastError.value = result.error ?? '操作失敗，已重新同步'
      }
      return
    }
    lastError.value = null
    if (conn.gameState) state.value = conn.gameState
    const lastEvts = conn.lastEvents as Event[]
    processEvents(lastEvts, state.value, prevState)
    lastEvents.value = [
      ...lastEvents.value,
      ...lastEvts.map((e) => toText(e, prevState)).filter(Boolean),
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
      // Force watch to fire even when the same error repeats
      if (lastError.value === res.error) {
        lastError.value = null
        nextTick(() => { lastError.value = res.error })
      } else {
        lastError.value = res.error
      }
      return
    }

    lastError.value = null
    state.value = res.state

    processEvents(res.events, res.state, prevState)
    lastEvents.value = [...lastEvents.value, ...res.events.map((e) => toText(e, prevState)).filter(Boolean)].slice(-300)
  }

  return { dispatch, lastError, lastEvents, onlineWaiting }
}

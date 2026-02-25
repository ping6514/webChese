import { defineStore } from 'pinia'
import type { Action, Pos } from '../engine'

type PendingConfirm = {
  action: Action
  title: string
  detail: string
} | null

type ShootPreview = {
  attackerId: string
  targetUnitId: string
  extraTargetUnitId?: string | null
} | null

type DetailModalState = {
  open: boolean
  title: string
  detail: string
  image: string | null
  actionLabel?: string | null
  actionDisabled?: boolean
  actionTitle?: string
}

type InteractionMode =
  | { kind: 'idle' }
  | {
      kind: 'enchant_select_unit'
      soulId: string
    }
  | {
      kind: 'sacrifice_select_target'
      sourceUnitId: string
      range: number
    }

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'lagging'

export const useUiStore = defineStore('ui', {
  state: () => ({
    shopOpen: false,
    allUnitsOpen: false,

    connectionStatus: 'connected' as ConnectionStatus,

    selectedUnitId: null as string | null,
    selectedCell: null as Pos | null,

    pendingConfirm: null as PendingConfirm,
    shootPreview: null as ShootPreview,

    detailModal: {
      open: false,
      title: '',
      detail: '',
      image: null,
      actionLabel: null,
      actionDisabled: false,
      actionTitle: '',
    } as DetailModalState,

    interactionMode: { kind: 'idle' } as InteractionMode,
  }),
  actions: {
    openShop: function () {
      this.shopOpen = true
    },
    closeShop: function () {
      this.shopOpen = false
    },
    openAllUnits: function () {
      this.allUnitsOpen = true
    },
    closeAllUnits: function () {
      this.allUnitsOpen = false
    },

    setSelectedUnitId: function (unitId: string | null) {
      this.selectedUnitId = unitId
    },
    setSelectedCell: function (pos: Pos | null) {
      this.selectedCell = pos
    },

    setPendingConfirm: function (p: PendingConfirm) {
      this.pendingConfirm = p
    },
    clearPendingConfirm: function () {
      this.pendingConfirm = null
    },

    setShootPreview: function (p: ShootPreview) {
      this.shootPreview = p
    },
    clearShootPreview: function () {
      this.shootPreview = null
    },

    openDetailModal: function (next: Omit<DetailModalState, 'open'>) {
      this.detailModal = { ...next, open: true }
    },
    closeDetailModal: function () {
      this.detailModal = {
        open: false,
        title: '',
        detail: '',
        image: null,
        actionLabel: null,
        actionDisabled: false,
        actionTitle: '',
      }
    },

    startEnchantSelectUnit: function (soulId: string) {
      this.interactionMode = { kind: 'enchant_select_unit', soulId }
    },

    startSacrificeSelectTarget: function (sourceUnitId: string, range?: number) {
      const r = Number.isFinite(range as any) ? Math.max(0, Math.floor(range as number)) : 1
      this.interactionMode = { kind: 'sacrifice_select_target', sourceUnitId, range: r }
    },
    clearInteractionMode: function () {
      this.interactionMode = { kind: 'idle' }
    },

    setConnectionStatus: function (s: ConnectionStatus) {
      this.connectionStatus = s
    },

    cycleConnectionStatus: function () {
      const order: ConnectionStatus[] = ['connected', 'lagging', 'disconnected', 'connecting']
      const i = order.indexOf(this.connectionStatus)
      this.connectionStatus = order[(i + 1) % order.length] ?? 'connected'
    },
  },
})

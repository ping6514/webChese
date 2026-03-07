import { provide, type InjectionKey, type Ref } from 'vue'
import type { GameState } from '../engine'
import type { BuffEntry } from './useActiveBuffs'
import type { FloatText, BeamFx, DamageToast } from './useGameEffects'

export interface GameV2FxCtx {
  fxAttackUnitIds: Ref<string[]>
  fxHitUnitIds: Ref<string[]>
  fxKilledUnitIds: Ref<string[]>
  fxAbilityUnitIds: Ref<string[]>
  fxKilledPosKeys: Ref<string[]>
  fxRevivedPosKeys: Ref<string[]>
  fxEnchantedPosKeys: Ref<string[]>
  floatTextsByPos: Ref<Record<string, FloatText[]>>
  fxBeams: Ref<BeamFx[]>
  damageToasts: Ref<DamageToast[]>
}

export interface GameV2Ctx {
  state: Ref<GameState>
  dispatch: (action: any) => void
  onlineSide?: 'red' | 'black' | null
  actionLocked?: boolean
  activeBuffs?: BuffEntry[]
  board3D?: boolean
  toggleBoard3D?: () => void
  openShop?: () => void
  openAllUnits?: () => void
  openEffects?: () => void
  openEvents?: () => void
  actionStripContent?: boolean
  lastEvents?: Ref<string[]>
  effectsOpen?: Ref<boolean>
  eventsOpen?: Ref<boolean>
  fx?: GameV2FxCtx
  // PVE bot
  isPve?: boolean
  botRunning?: Ref<boolean>
  botSpeedLabel?: Ref<string>
  cycleBotSpeed?: () => void
}

export const GAME_V2_KEY: InjectionKey<GameV2Ctx> = Symbol('gameV2')

export function provideGameV2(ctx: GameV2Ctx) {
  provide(GAME_V2_KEY, ctx)
}

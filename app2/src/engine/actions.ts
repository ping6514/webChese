import type { AttackClass, DamageType, ElementType, InterruptTag, StatusId } from '../game/schema'
import type { FacingDir, HexPos } from './state'

export type AttackAction = {
  type: 'ATTACK'
  attackerId: string
  targetIds: string[]
  profile: {
    baseDamage: number
    damageType: DamageType
    elementType: ElementType
    attackClass: AttackClass
    elementDamageRatio?: number
    canBackstab?: boolean
    guaranteedBackstab?: boolean
    alwaysMiss?: boolean
    // 投射物相關
    projectileId?: string
    piercing?: boolean
    maxPierceTargets?: number
    // 打斷相關
    interruptValue?: number
    interruptTags?: InterruptTag[]
    // 施法相關
    castingTag?: InterruptTag
    castRemaining?: number
    // 狀態應用
    applyStatuses?: StatusId[]
    applyStatusChance?: number
  }
  defense?: {
    frontCoreDamageReduction?: number
    frontFlankDamageReduction?: number
    slashResist?: number
    pierceResist?: number
    impactResist?: number
    arcaneResist?: number
    fireResist?: number
    iceResist?: number
    lightningResist?: number
    windResist?: number
    lightResist?: number
    shadowResist?: number
    vulnerable?: number
    exposeSlash?: number
    exposePierce?: number
    exposeImpact?: number
    evadeNextHit?: boolean
    evadeNextProjectile?: boolean
    negateNextDamage?: boolean
    reduceNextHitBy?: number
  }
  recoveryMs?: number
}

export type PassAction = {
  type: 'PASS'
  unitId: string
  recoveryMs?: number
}

export type MoveRouteRule = 'free' | 'straight_line'

export type MoveSpec = {
  mode?: 'walk' | 'dash' | 'charge' | 'teleport' | 'leap'
  routeRule?: MoveRouteRule
  ignoreTerrain?: boolean
  ignoreUnits?: boolean
  maxRangeOverride?: number
}

export type MoveAction = {
  type: 'MOVE'
  unitId: string
  to: HexPos
  facing?: FacingDir
  path?: HexPos[]
  moveSpec?: MoveSpec
  recoveryMs?: number
}

export type BattleAction = AttackAction | PassAction | MoveAction

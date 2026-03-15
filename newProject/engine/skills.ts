/**
 * skills.ts — 技能定義型別 + 效果分派
 *
 * SkillDef：對應 data/monsters/forest/wolf_skills.json 等格式
 * applySkillEffect()：RESOLVE_SKILL_CAST 呼叫，依 effect.type 分派效果
 */

import type { GameState, Unit, Pos, HazardObject, StatusEffect } from './state'
import type { HitMode } from './state'
import type {
  Event, DamageDealtEvent, UnitDiedEvent, StatusAppliedEvent,
  HazardPlacedEvent, ProjectileFiredEvent, UnitSpawnedEvent, LootDroppedEvent
} from './events'
import type { AffixDefData } from './weapons'
import { calcDamage } from './damage'
import { getHitCells, chebyshev } from './guards'

// ─── SkillDef 型別（JSON 結構）────────────────────────────────────────────────

export type SkillAiTrigger = {
  condition:
    | 'enemies_in_range'       // 範圍內有敵人
    | 'allies_in_range_below'  // 附近盟友數量低於 count
    | 'self_hp_below'          // 自身 HP 低於 threshold
  count?: number
  range: number
  threshold?: number           // 0~1，HP 比例
}

export type SkillEffect =
  | {
      type: 'damage'
      /** 傷害倍率（乘上武器 atkFinal × stat）*/
      damageTypeMult: number
      /** 擊退格數（0 = 不擊退）*/
      knockback?: number
    }
  | {
      type: 'apply_debuff'
      debuff: string           // 'slow' | 'entangle' | 'webbed' | 'stun' 等
      duration: number         // ms
      additionalEffect?: AdditionalEffect
    }
  | {
      type: 'summon_allies'
      monsterId: string
      count: number
    }

export type AdditionalEffect =
  | { type: 'apply_poison'; dps: number; duration: number }

export type SkillDef = {
  id: string
  name: string
  castTime: number
  cooldown: number
  actionId: string
  /** 覆蓋 ActionDef 部分參數（radius/range/targetFilter）*/
  actionOverride?: { radius?: number; range?: number; targetFilter?: string }
  hitMode: HitMode
  actionTags: string[]
  aiTrigger: SkillAiTrigger
  effect: SkillEffect
}

// ─── 技能查找表（在 GameLoop 初始化時載入）───────────────────────────────────

export type SkillRegistry = Record<string, SkillDef>

// ─── AI 觸發條件判斷 ──────────────────────────────────────────────────────────

/**
 * 判斷怪物是否滿足某技能的觸發條件
 */
export function checkAiTrigger(
  state: GameState,
  unit: Unit,
  trigger: SkillAiTrigger
): boolean {
  switch (trigger.condition) {
    case 'enemies_in_range': {
      const count = trigger.count ?? 1
      const inRange = Object.values(state.units).filter(
        u => u.kind !== unit.kind && !u.isDead && chebyshev(u.pos, unit.pos) <= trigger.range
      ).length
      return inRange >= count
    }

    case 'allies_in_range_below': {
      const threshold = trigger.count ?? 1
      const allies = Object.values(state.units).filter(
        u => u.kind === unit.kind && u.id !== unit.id && !u.isDead &&
             chebyshev(u.pos, unit.pos) <= trigger.range
      ).length
      return allies < threshold
    }

    case 'self_hp_below': {
      const ratio = trigger.threshold ?? 0.5
      return unit.currentHP / unit.maxHP < ratio
    }
  }
}

// ─── 技能效果分派 ─────────────────────────────────────────────────────────────

export type SkillEffectResult = {
  state: GameState
  events: Event[]
}

/**
 * RESOLVE_SKILL_CAST 呼叫，依 skill.hitMode 和 skill.effect 分派效果
 *
 * @param state      當前 GameState
 * @param caster     施法者
 * @param skill      技能定義
 * @param targetPos  目標格
 * @param allAffixDefs 詞條定義（damage 類技能用）
 * @param dungeonQuality 地城品質係數
 */
export function applySkillEffect(
  state: GameState,
  caster: Unit,
  skill: SkillDef,
  targetPos: Pos,
  allAffixDefs: Record<string, AffixDefData>,
  dungeonQuality: number
): SkillEffectResult {
  const events: Event[] = []
  let currentState = state

  switch (skill.hitMode.type) {

    // ── 即時結算（instant / check_at_resolve）────────────────────────────────
    case 'instant':
    case 'check_at_resolve': {
      const hitCells = getHitCells(skill.actionId, caster.pos, targetPos, caster.facing)
      for (const cell of hitCells) {
        const result = applyEffectToCell(
          currentState, caster, skill, cell, allAffixDefs, dungeonQuality
        )
        currentState = result.state
        events.push(...result.events)
      }
      break
    }

    // ── 延遲結算（delayed）───────────────────────────────────────────────────
    case 'delayed': {
      // 讀條時已鎖定格子，resolve 時再判斷（MVP1 簡化：直接結算）
      const hitCells = getHitCells(skill.actionId, caster.pos, targetPos, caster.facing)
      for (const cell of hitCells) {
        const result = applyEffectToCell(
          currentState, caster, skill, cell, allAffixDefs, dungeonQuality
        )
        currentState = result.state
        events.push(...result.events)
      }
      break
    }

    // ── 持久傷害物件（persistent_zone）───────────────────────────────────────
    case 'persistent_zone': {
      const nowMs = state.timeline.tick
      const hitCells = getHitCells(skill.actionId, caster.pos, targetPos, caster.facing)
      for (const cell of hitCells) {
        if (!isValidCell(currentState, cell)) continue
        const hazardId = `hazard_${caster.id}_${skill.id}_${cell.x}_${cell.y}_${Date.now()}`
        const hazard: HazardObject = {
          id: hazardId,
          ownerId: caster.id,
          pos: cell,
          expiresAt: nowMs + skill.hitMode.duration,
          triggerOn: skill.hitMode.triggerOn,
          intervalMs: skill.hitMode.intervalMs,
          nextTriggerAt: skill.hitMode.intervalMs ? nowMs + skill.hitMode.intervalMs : undefined,
          maxTriggers: skill.hitMode.maxTriggers,
          triggersUsed: 0,
          effectId: skill.id,
        }
        currentState = addHazard(currentState, hazard)

        const placedEvent: HazardPlacedEvent = {
          type: 'HAZARD_PLACED',
          hazardId,
          pos: cell,
          effectId: skill.id,
        }
        events.push(placedEvent)
      }
      break
    }

    // ── 投射物（projectile）───────────────────────────────────────────────────
    case 'projectile': {
      // MVP1：投射物直接在目標格結算（不做移動動畫的 state 推進）
      // 若目標格有敵方單位，立即套用效果
      const target = findUnitAt(currentState, targetPos, caster.id)
      if (target && target.kind !== caster.kind && !target.isDead) {
        const result = applyEffectToTarget(
          currentState, caster, skill, target, allAffixDefs, dungeonQuality
        )
        currentState = result.state
        events.push(...result.events)
      }

      const firedEvent: ProjectileFiredEvent = {
        type: 'PROJECTILE_FIRED',
        projectileId: `proj_${caster.id}_${skill.id}_${Date.now()}`,
        ownerId: caster.id,
        from: caster.pos,
        to: targetPos,
        speedCellsPerSec: skill.hitMode.speedCellsPerSec,
      }
      events.push(firedEvent)
      break
    }
  }

  return { state: currentState, events }
}

// ─── 對單格套用效果 ───────────────────────────────────────────────────────────

function applyEffectToCell(
  state: GameState,
  caster: Unit,
  skill: SkillDef,
  cell: Pos,
  allAffixDefs: Record<string, AffixDefData>,
  dungeonQuality: number
): SkillEffectResult {
  const events: Event[] = []
  let currentState = state

  switch (skill.effect.type) {
    case 'damage': {
      const target = findUnitAt(state, cell, caster.id)
      if (!target || target.kind === caster.kind || target.isDead) break

      const result = applyEffectToTarget(currentState, caster, skill, target, allAffixDefs, dungeonQuality)
      currentState = result.state
      events.push(...result.events)
      break
    }

    case 'apply_debuff': {
      const target = findUnitAt(state, cell, caster.id)
      if (!target || target.kind === caster.kind || target.isDead) break

      const result = applyEffectToTarget(currentState, caster, skill, target, allAffixDefs, dungeonQuality)
      currentState = result.state
      events.push(...result.events)
      break
    }

    case 'summon_allies': {
      // 找目標格周圍的空格生成怪物
      if (!isValidCell(state, cell)) break
      const occupant = findUnitAt(state, cell, '')
      if (occupant) break

      const { effect } = skill
      const newUnitId = `${effect.monsterId}_summon_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      // MVP1：生成最小化的怪物（完整屬性由 spawner.ts 產生，此處僅做骨架）
      const newUnit = createMinimalUnit(newUnitId, effect.monsterId, cell, caster.kind)
      currentState = { ...currentState, units: { ...currentState.units, [newUnitId]: newUnit } }

      // 同步加入 ATB timeline
      currentState = addUnitToTimeline(currentState, newUnitId)

      const spawnEvent: UnitSpawnedEvent = {
        type: 'UNIT_SPAWNED',
        unitId: newUnitId,
        monsterId: effect.monsterId,
        pos: cell,
      }
      events.push(spawnEvent)
      break
    }
  }

  return { state: currentState, events }
}

// ─── 對單個目標套用效果 ───────────────────────────────────────────────────────

export function applyEffectToTarget(
  state: GameState,
  caster: Unit,
  skill: SkillDef,
  target: Unit,
  allAffixDefs: Record<string, AffixDefData>,
  dungeonQuality: number
): SkillEffectResult {
  const events: Event[] = []
  let currentState = state

  const { effect } = skill

  switch (effect.type) {
    case 'damage': {
      // 技能傷害 = 武器傷害 × damageTypeMult
      const weapon = caster.weapons[0]
      if (!weapon) break

      const baseResult = calcDamage(caster, target, weapon, allAffixDefs, dungeonQuality)
      const totalDamage = baseResult.totalFinal * effect.damageTypeMult

      const damageEvent: DamageDealtEvent = {
        type: 'DAMAGE_DEALT',
        sourceId: caster.id,
        targetId: target.id,
        amount: totalDamage,
        element: weapon.element,
        isCrit: baseResult.isCrit,
        pos: target.pos,
      }
      events.push(damageEvent)

      const newHP = target.currentHP - totalDamage
      let newTarget: Unit = { ...target, currentHP: Math.max(0, newHP) }

      // 擊退（knockback）
      if (effect.knockback && effect.knockback > 0) {
        const knocked = calcKnockback(caster.pos, target.pos, effect.knockback, currentState)
        if (knocked) newTarget = { ...newTarget, pos: knocked }
      }

      if (newTarget.currentHP <= 0) {
        newTarget = { ...newTarget, isDead: true }
        const dieEvent: UnitDiedEvent = {
          type: 'UNIT_DIED',
          unitId: target.id,
          pos: target.pos,
          killedById: caster.id,
        }
        events.push(dieEvent)
      }

      currentState = setUnit(currentState, newTarget)
      break
    }

    case 'apply_debuff': {
      const nowMs = state.timeline.tick
      const status: StatusEffect = buildStatusEffect(effect.debuff, effect.duration, nowMs)
      const newTarget: Unit = {
        ...target,
        statusEffects: [
          ...target.statusEffects.filter(s => s.id !== effect.debuff),
          status,
        ],
      }
      currentState = setUnit(currentState, newTarget)

      const statusEvent: StatusAppliedEvent = {
        type: 'STATUS_APPLIED',
        unitId: target.id,
        statusId: effect.debuff,
        durationMs: effect.duration,
        pos: target.pos,
      }
      events.push(statusEvent)

      // 附加效果（web_shot 的 apply_poison）
      if (effect.additionalEffect?.type === 'apply_poison') {
        const { dps, duration } = effect.additionalEffect
        const tickMs = 1000
        const poisonStatus: StatusEffect = {
          id: 'poison',
          expiresAt: nowMs + duration,
          dotDamagePerTick: dps,  // 每次 tick（1s）的傷害
          dotTickMs: tickMs,
          dotElement: 'dark',
          nextTickAt: nowMs + tickMs,
        }
        const poisonedTarget: Unit = {
          ...currentState.units[target.id]!,
          statusEffects: [
            ...currentState.units[target.id]!.statusEffects.filter(s => s.id !== 'poison'),
            poisonStatus,
          ],
        }
        currentState = setUnit(currentState, poisonedTarget)

        const poisonEvent: StatusAppliedEvent = {
          type: 'STATUS_APPLIED',
          unitId: target.id,
          statusId: 'poison',
          durationMs: duration,
          pos: target.pos,
        }
        events.push(poisonEvent)
      }
      break
    }

    case 'summon_allies':
      // summon_allies 對格子操作，不走 applyEffectToTarget
      break
  }

  return { state: currentState, events }
}

// ─── 工具函數 ─────────────────────────────────────────────────────────────────

/** 根據 debuff 名稱建立 StatusEffect（nowMs = state.timeline.tick）*/
function buildStatusEffect(debuffId: string, durationMs: number, nowMs: number): StatusEffect {
  const base: StatusEffect = { id: debuffId, expiresAt: nowMs + durationMs }

  switch (debuffId) {
    case 'slow':
      return { ...base, speedMult: 0.5, moveRangeMult: 0.5 }
    case 'entangle':
      return { ...base, moveRangeMult: 0, speedMult: 0.7 }
    case 'webbed':
      return { ...base, moveRangeMult: 0.5, speedMult: 0.6 }
    case 'stun':
      return { ...base, stunned: true }
    default:
      return base
  }
}

/** 計算擊退後的目標位置 */
function calcKnockback(
  casterPos: Pos,
  targetPos: Pos,
  cells: number,
  state: GameState
): Pos | null {
  const dx = Math.sign(targetPos.x - casterPos.x)
  const dy = Math.sign(targetPos.y - casterPos.y)
  let x = targetPos.x + dx * cells
  let y = targetPos.y + dy * cells

  // 邊界與牆壁檢查（取最近合法格）
  while (cells > 0) {
    x = targetPos.x + dx * cells
    y = targetPos.y + dy * cells
    const cell = state.floor.cells[y]?.[x]
    if (cell?.passable && !findUnitAt(state, { x, y }, '')) {
      return { x, y }
    }
    cells--
  }
  return null
}

function findUnitAt(state: GameState, pos: Pos, excludeId: string): Unit | undefined {
  return Object.values(state.units).find(
    u => u.id !== excludeId && !u.isDead && u.pos.x === pos.x && u.pos.y === pos.y
  )
}

function setUnit(state: GameState, unit: Unit): GameState {
  return { ...state, units: { ...state.units, [unit.id]: unit } }
}

function isValidCell(state: GameState, pos: Pos): boolean {
  return state.floor.cells[pos.y]?.[pos.x]?.passable === true
}

function addHazard(state: GameState, hazard: HazardObject): GameState {
  return {
    ...state,
    floor: { ...state.floor, hazards: { ...state.floor.hazards, [hazard.id]: hazard } },
  }
}

function addUnitToTimeline(state: GameState, unitId: string): GameState {
  const already = state.timeline.entries.some(e => e.unitId === unitId)
  if (already) return state
  return {
    ...state,
    timeline: {
      ...state.timeline,
      entries: [
        ...state.timeline.entries,
        { unitId, atb: 0, castRemaining: 0, recoveryRemaining: 0 },
      ],
    },
  }
}

/** 召喚技能用的最小化 Unit（完整屬性之後由 spawner.ts 覆蓋）*/
function createMinimalUnit(id: string, monsterId: string, pos: Pos, ownerKind: 'player' | 'monster'): Unit {
  return {
    id,
    kind: ownerKind,
    name: monsterId,
    pos,
    facing: 'down',
    stats: { str: 8, agi: 10, int: 2, lck: 4 },
    maxHP: 30, currentHP: 30,
    maxSP: 20, currentSP: 20,
    maxMP: 0,  currentMP: 0,
    speed: 12,
    moveRange: 3,
    weapons: [],
    weaponCooldownUntil: [],
    resistances: {},
    defenses: {},
    statusEffects: [],
    ai: 'chase',
    monsterId,
    skillCooldownUntil: {},
  }
}

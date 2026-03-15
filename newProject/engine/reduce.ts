/**
 * reduce.ts — 核心狀態機
 *
 * reduce(state, action, deps) → { state, events }
 *
 * 規則：
 *   - 不直接 mutate，每次回傳新的 state（淺拷貝 + 需要改的深拷貝）
 *   - 每個 case 先呼叫 guard，guard 失敗就返回原 state + 空 events
 *   - 所有副作用（傷害/死亡/掉落）集中在這裡，不散落在 guard
 */

import type { GameState, Unit, Pos, LootDrop, StatusEffect } from './state'
import type { Action } from './actions'
import type { Event, DamageDealtEvent, UnitDiedEvent, LootDroppedEvent, FloorClearedEvent, FloorFailedEvent, DotTickEvent, StatusExpiredEvent } from './events'
import type { AffixDefData } from './weapons'
import type { SkillRegistry } from './skills'
import {
  canAct, canMove, canUseWeapon, canUseSkill, canPickupLoot,
  getHitCells, getActionRange, chebyshev,
} from './guards'
import { calcDamage } from './damage'
import { applySkillEffect, applyEffectToTarget } from './skills'
import { consumeATB, startCast } from './atb'
import type { PassiveRegistry } from './passive'
import { checkPassiveTriggers } from './passive'
import type { LootRegistry } from './loot'
import { generateLootPhase, applyOpenOption, resolveVote } from './loot_phase'
import { advanceRun } from './campaign'

// ─── 外部依賴（靜態資料，避免 reduce 直接 import JSON）──────────────────────

export type ReduceDeps = {
  allAffixDefs: Record<string, AffixDefData>
  skillRegistry?: SkillRegistry
  dungeonQuality?: number
  /** 被動能力定義（monsterId → PassiveAbilityDef[]）*/
  passiveRegistry?: PassiveRegistry
  /** 道具庫（START_LOOT_PHASE 用，生成 LootHint 需要）*/
  lootRegistry?: LootRegistry
}

export type ReduceResult = {
  state: GameState
  events: Event[]
}

// ─── 主函數 ───────────────────────────────────────────────────────────────────

export function reduce(
  state: GameState,
  action: Action,
  deps: ReduceDeps = { allAffixDefs: {} }
): ReduceResult {
  const dq = deps.dungeonQuality ?? state.run.dungeonQuality

  switch (action.type) {

    // ── 移動 ──────────────────────────────────────────────────────────────────

    case 'MOVE': {
      const { unitId, to } = action
      const g = canMove(state, unitId, to)
      if (!g.ok) return { state, events: [] }

      const unit = state.units[unitId]!
      const from = unit.pos

      // 更新面向
      const facing = calcFacing(from, to)

      const newUnit: Unit = { ...unit, pos: to, facing }
      let newState = setUnit(state, newUnit)

      // 移動消耗行動（recoveryTime = 0，移動後還能繼續等其他行動）
      // 設計決策：移動本身不觸發硬直，但消耗本輪 pendingUnitId
      newState = {
        ...newState,
        timeline: { ...newState.timeline, pendingUnitId: null },
      }
      // 重置 ATB 為 0（行動用掉）
      newState = resetATB(newState, unitId, 0)

      // 格子觸發（踩到 recovery / chest / 危害物）
      const { events: cellEvents, state: stateAfterCell } = applyCellEffect(newState, unitId, to, deps)
      newState = stateAfterCell

      // 檢查目標（reach_exit / 全員陣亡）
      const { event: clearEvent } = checkObjective(newState)
      if (clearEvent) {
        return {
          state: newState,
          events: [
            { type: 'UNIT_MOVED', unitId, from, to, path: [from, to] },
            ...cellEvents,
            clearEvent,
          ],
        }
      }

      return {
        state: newState,
        events: [
          { type: 'UNIT_MOVED', unitId, from, to, path: [from, to] },
          ...cellEvents,
        ],
      }
    }

    // ── 開始武器讀條 ──────────────────────────────────────────────────────────

    case 'QUEUE_WEAPON': {
      const { unitId, weaponSlot, targetPos } = action
      const g = canUseWeapon(state, unitId, weaponSlot, targetPos)
      if (!g.ok) return { state, events: [] }

      const unit = state.units[unitId]!
      const weapon = unit.weapons[weaponSlot]!

      // 鎖定格子（instant / delayed hitMode 用）
      // 使用攻擊後的新朝向來計算命中格（面朝目標後再判斷弧形）
      const newFacing = calcFacing(unit.pos, targetPos)
      const lockedCells = getHitCells(weapon.actionId, unit.pos, targetPos, newFacing)

      // 扣除資源
      const newUnit: Unit = {
        ...unit,
        currentSP: unit.currentSP - weapon.spCostFinal,
        currentMP: unit.currentMP - weapon.mpCostFinal,
        facing: newFacing,
        pendingAction: {
          kind: 'weapon',
          weaponSlot,
          targetPos,
          lockedCells,
        },
      }

      let newState = setUnit(state, newUnit)
      newState = startCast(newState, unitId, weapon.castTimeFinal)

      return {
        state: newState,
        events: [{
          type: 'CAST_STARTED',
          unitId,
          weaponSlot,
          castTimeMs: weapon.castTimeFinal,
          lockedCells,
        }],
      }
    }

    // ── 讀條結算 ──────────────────────────────────────────────────────────────

    case 'RESOLVE_CAST': {
      const { unitId } = action
      const unit = state.units[unitId]
      if (!unit || unit.isDead) return { state, events: [] }

      const pending = unit.pendingAction
      if (!pending || pending.kind !== 'weapon') return { state, events: [] }

      const { weaponSlot, targetPos, lockedCells } = pending
      const weapon = unit.weapons[weaponSlot]!

      // 根據 hitMode 決定命中格
      let hitCells: Pos[]
      if (weapon.hitMode.type === 'check_at_resolve') {
        // 重新判斷：目標格仍在射程內才命中
        const range = getActionRange(weapon.actionId)
        if (chebyshev(unit.pos, targetPos) > range) {
          // 目標離開射程 → miss
          const newUnit: Unit = { ...unit, pendingAction: undefined }
          let newState = setUnit(state, newUnit)
          newState = consumeATB(newState, unitId, weapon.recoveryTimeFinal)
          newState = applyCooldown(newState, unitId, weaponSlot, weapon.cooldownMs)
          return { state: newState, events: [] }
        }
        hitCells = getHitCells(weapon.actionId, unit.pos, targetPos, unit.facing)
      } else {
        // instant / delayed：用讀條開始時鎖定的格子
        hitCells = lockedCells
      }

      // 收集命中的敵方單位
      const events: Event[] = []
      let currentState = state

      for (const cell of hitCells) {
        const target = findUnitAt(currentState, cell, unitId)
        if (!target) continue
        if (target.kind === unit.kind) continue  // 不打同陣營

        const result = calcDamage(unit, target, weapon, deps.allAffixDefs, dq)

        const damageEvent: DamageDealtEvent = {
          type: 'DAMAGE_DEALT',
          sourceId: unitId,
          targetId: target.id,
          amount: result.totalFinal,
          element: weapon.element,
          isCrit: result.isCrit,
          pos: target.pos,
        }
        events.push(damageEvent)

        // 扣血
        const newHP = target.currentHP - result.totalFinal
        let newTarget: Unit = { ...target, currentHP: Math.max(0, newHP) }

        if (newTarget.currentHP <= 0) {
          newTarget = { ...newTarget, isDead: true }
          const dieEvent: UnitDiedEvent = {
            type: 'UNIT_DIED',
            unitId: target.id,
            pos: target.pos,
            killedById: unitId,
          }
          events.push(dieEvent)

          // 掉落物
          const lootEvents = generateLoot(currentState, target)
          events.push(...lootEvents.events)
          currentState = lootEvents.state
        }

        currentState = setUnit(currentState, newTarget)
      }

      // 武器使用後狀態
      const finishedUnit: Unit = { ...currentState.units[unitId]!, pendingAction: undefined }
      currentState = setUnit(currentState, finishedUnit)
      currentState = consumeATB(currentState, unitId, weapon.recoveryTimeFinal)
      currentState = applyCooldown(currentState, unitId, weaponSlot, weapon.cooldownMs)

      // 傷後被動（on_below_hp）即時響應
      if (deps.passiveRegistry) {
        const nowMs = currentState.timeline.tick
        for (const u of Object.values(currentState.units)) {
          if (u.isDead || !u.monsterId) continue
          const passiveDefs = deps.passiveRegistry[u.monsterId]
          if (!passiveDefs?.length) continue
          const r = checkPassiveTriggers(currentState, u.id, passiveDefs, nowMs)
          currentState = r.state
          events.push(...r.events)
        }
      }

      // 檢查樓層目標（勝利 / 敗北）
      const { event: clearEvent } = checkObjective(currentState)
      if (clearEvent) events.push(clearEvent)

      return { state: currentState, events }
    }

    // ── 技能讀條開始 ──────────────────────────────────────────────────────────

    case 'QUEUE_SKILL': {
      const { unitId, skillId, targetPos } = action
      const g = canUseSkill(state, unitId, skillId, targetPos)
      if (!g.ok) return { state, events: [] }

      const unit = state.units[unitId]!
      const skillDef = deps.skillRegistry?.[skillId]
      const castTime = skillDef?.castTime ?? 1000
      const skillName = skillDef?.name ?? skillId

      const newFacing = calcFacing(unit.pos, targetPos)
      const lockedCells = skillDef
        ? getHitCells(skillDef.actionId, unit.pos, targetPos, newFacing)
        : [targetPos]

      const newUnit: Unit = {
        ...unit,
        facing: newFacing,
        pendingAction: { kind: 'skill', skillId, targetPos, lockedCells },
      }

      // 技能開始讀條時扣除冷卻（防止讀條期間再次觸發）
      let newState = setUnit(state, newUnit)
      if (skillDef?.cooldown) {
        const newCooldowns = { ...(unit.skillCooldownUntil ?? {}), [skillId]: state.timeline.tick + skillDef.cooldown }
        newState = setUnit(newState, { ...newState.units[unitId]!, skillCooldownUntil: newCooldowns })
      }
      newState = startCast(newState, unitId, castTime)

      return {
        state: newState,
        events: [{
          type: 'SKILL_CAST_STARTED',
          unitId, skillId,
          skillName,
          castTimeMs: castTime,
          lockedCells,
        }],
      }
    }

    // ── 技能結算 ──────────────────────────────────────────────────────────────

    case 'RESOLVE_SKILL_CAST': {
      const { unitId } = action
      const unit = state.units[unitId]
      if (!unit || unit.isDead) return { state, events: [] }
      const pending = unit.pendingAction
      if (!pending || pending.kind !== 'skill') return { state, events: [] }

      const { skillId, targetPos } = pending
      const skillDef = deps.skillRegistry?.[skillId]

      const cleanUnit: Unit = { ...unit, pendingAction: undefined }
      let currentState = setUnit(state, cleanUnit)

      const events: Event[] = []

      if (skillDef) {
        // check_at_resolve：重新確認目標仍在射程
        if (skillDef.hitMode.type === 'check_at_resolve') {
          const skillRange = skillDef.actionOverride?.range ?? 4
          if (chebyshev(unit.pos, targetPos) > skillRange) {
            // miss — 仍消耗 cooldown（已在 QUEUE_SKILL 扣除）
            currentState = consumeATB(currentState, unitId, 500)
            return { state: currentState, events: [] }
          }
        }

        const result = applySkillEffect(
          currentState,
          currentState.units[unitId]!,
          skillDef,
          targetPos,
          deps.allAffixDefs,
          dq
        )
        currentState = result.state
        events.push(...result.events)
      }

      // 技能後硬直（用 castTime 的一半估算，或固定 500ms）
      const recoveryMs = skillDef ? Math.floor(skillDef.castTime * 0.3) : 500
      currentState = consumeATB(currentState, unitId, recoveryMs)

      // 傷後被動（on_below_hp）即時響應
      if (deps.passiveRegistry) {
        const nowMs = currentState.timeline.tick
        for (const u of Object.values(currentState.units)) {
          if (u.isDead || !u.monsterId) continue
          const passiveDefs = deps.passiveRegistry[u.monsterId]
          if (!passiveDefs?.length) continue
          const r = checkPassiveTriggers(currentState, u.id, passiveDefs, nowMs)
          currentState = r.state
          events.push(...r.events)
        }
      }

      // 檢查樓層目標（勝利 / 敗北）
      const { event: clearEvent } = checkObjective(currentState)
      if (clearEvent) events.push(clearEvent)

      return { state: currentState, events }
    }

    // ── 硬直結束（ATB 系統自動發，此處只做 log 用）──────────────────────────

    case 'RESOLVE_RECOVERY': {
      return { state, events: [] }
    }

    // ── 跳過行動 ──────────────────────────────────────────────────────────────

    case 'END_TURN': {
      const { unitId } = action
      const g = canAct(state, unitId)
      if (!g.ok) return { state, events: [] }
      const newState = consumeATB(state, unitId, 0)
      return { state: newState, events: [] }
    }

    // ── SP → MP 轉換（法師用）─────────────────────────────────────────────────

    case 'CONVERT_SP_TO_MP': {
      const { unitId } = action
      const g = canAct(state, unitId)
      if (!g.ok) return { state, events: [] }

      const unit = state.units[unitId]!
      const spCost = 5
      const mpGain = 12
      if (unit.currentSP < spCost || unit.maxMP === 0) return { state, events: [] }

      const newUnit: Unit = {
        ...unit,
        currentSP: unit.currentSP - spCost,
        currentMP: Math.min(unit.maxMP, unit.currentMP + mpGain),
      }
      // 手動清除 pendingUnitId + 重置 ATB，不走 consumeATB（避免 SP 回復抵消消耗）
      const newEntries = state.timeline.entries.map(e =>
        e.unitId !== unitId ? e : { ...e, atb: 0, recoveryRemaining: 0 }
      )
      const newState: GameState = {
        ...state,
        units: { ...state.units, [unitId]: newUnit },
        timeline: {
          ...state.timeline,
          pendingUnitId: state.timeline.pendingUnitId === unitId ? null : state.timeline.pendingUnitId,
          entries: newEntries,
        },
      }
      return {
        state: newState,
        events: [{ type: 'HEAL', unitId, amount: mpGain, resource: 'mp', pos: unit.pos }],
      }
    }

    // ── 拾取掉落物 ────────────────────────────────────────────────────────────

    case 'PICKUP_LOOT': {
      const { unitId, lootId } = action
      const g = canPickupLoot(state, unitId, lootId)
      if (!g.ok) return { state, events: [] }

      const loot = state.floor.loot.find(l => l.id === lootId)!
      const newFloor = {
        ...state.floor,
        loot: state.floor.loot.filter(l => l.id !== lootId),
      }
      const newState: GameState = { ...state, floor: newFloor }

      return {
        state: newState,
        events: [{ type: 'LOOT_PICKED_UP', lootId, unitId, item: loot.item }],
      }
    }

    // ── 時間推進（ATB 系統處理，reduce 此處無需額外邏輯）──────────────────────

    case 'ADVANCE_TIME':
      return { state, events: [] }

    // ── 投射物推進（視覺位置更新；目前技能採即時結算，此處處理 floor.projectiles）──

    case 'ADVANCE_PROJECTILES': {
      const { deltaMs } = action
      if (state.floor.projectiles.length === 0) return { state, events: [] }

      const events: Event[] = []
      let currentState = state
      const remaining = []

      for (const proj of currentState.floor.projectiles) {
        // 推進視覺位置
        const totalDist = chebyshev(proj.origin, proj.target)
        if (totalDist === 0) continue
        const elapsed = currentState.timeline.tick - (currentState.timeline.tick - deltaMs)
        const dx = (proj.target.x - proj.origin.x) / totalDist
        const dy = (proj.target.y - proj.origin.y) / totalDist
        const moveCells = proj.speedCellsPerSec * deltaMs / 1000
        const newX = proj.currentPos.x + dx * moveCells
        const newY = proj.currentPos.y + dy * moveCells

        // 是否到達目標
        const distLeft = chebyshev({ x: newX, y: newY }, proj.target)
        const reached = distLeft <= 0.5

        // 檢查目標格是否有單位
        const intPos = { x: Math.round(newX), y: Math.round(newY) }
        const hitUnit = findUnitAt(currentState, intPos, proj.ownerId)
        const owner = currentState.units[proj.ownerId]

        if (hitUnit && owner && hitUnit.kind !== owner.kind && !proj.hitUnitIds.includes(hitUnit.id)) {
          events.push({
            type: 'PROJECTILE_HIT',
            projectileId: proj.id,
            pos: intPos,
            hitUnitId: hitUnit.id,
          })
          if (!proj.piercing || reached) continue  // 穿刺：繼續；否則移除
        }

        if (reached) {
          events.push({ type: 'PROJECTILE_HIT', projectileId: proj.id, pos: proj.target, hitUnitId: null })
          continue  // 到達終點 → 移除
        }

        remaining.push({ ...proj, currentPos: { x: newX, y: newY } })
      }

      currentState = {
        ...currentState,
        floor: { ...currentState.floor, projectiles: remaining },
      }
      return { state: currentState, events }
    }

    // ── 地板危害物更新（到期 + interval 觸發）────────────────────────────────

    case 'ADVANCE_HAZARDS': {
      const nowMs = state.timeline.tick
      if (Object.keys(state.floor.hazards).length === 0) return { state, events: [] }

      const events: Event[] = []
      let currentState = state

      for (const [hazardId, hazard] of Object.entries(currentState.floor.hazards)) {
        // 到期：移除並發出事件
        if (hazard.expiresAt <= nowMs) {
          currentState = removeHazard(currentState, hazardId)
          events.push({ type: 'HAZARD_EXPIRED', hazardId, pos: hazard.pos })
          continue
        }

        // interval / both：固定頻率觸發
        if (
          (hazard.triggerOn === 'interval' || hazard.triggerOn === 'both') &&
          hazard.intervalMs &&
          (hazard.nextTriggerAt ?? Infinity) <= nowMs
        ) {
          const result = applyHazardToCell(currentState, hazard, null, deps)
          currentState = result.state
          events.push(
            { type: 'HAZARD_TRIGGERED', hazardId, triggerUnitId: '', pos: hazard.pos },
            ...result.events
          )

          const newUsed = hazard.triggersUsed + 1
          if (hazard.maxTriggers && newUsed >= hazard.maxTriggers) {
            currentState = removeHazard(currentState, hazardId)
            events.push({ type: 'HAZARD_EXPIRED', hazardId, pos: hazard.pos })
          } else {
            currentState = updateHazard(currentState, {
              ...hazard,
              triggersUsed: newUsed,
              nextTriggerAt: nowMs + hazard.intervalMs,
            })
          }
        }
      }

      return { state: currentState, events }
    }

    // ── 狀態效果到期 / DoT tick ───────────────────────────────────────────────

    case 'ADVANCE_STATUS_EFFECTS': {
      const nowMs = state.timeline.tick
      const events: Event[] = []
      let currentState = state

      for (const unitId of Object.keys(currentState.units)) {
        const unit = currentState.units[unitId]!
        if (unit.isDead || unit.statusEffects.length === 0) continue

        let newHP = unit.currentHP
        let died = false
        const remaining: StatusEffect[] = []

        for (const effect of unit.statusEffects) {
          // 到期：移除並發出事件
          if (effect.expiresAt <= nowMs) {
            const expiredEvent: StatusExpiredEvent = {
              type: 'STATUS_EXPIRED',
              unitId,
              statusId: effect.id,
            }
            events.push(expiredEvent)
            continue
          }

          // DoT tick
          if (
            effect.dotDamagePerTick !== undefined &&
            effect.nextTickAt !== undefined &&
            effect.nextTickAt <= nowMs
          ) {
            const dmg = effect.dotDamagePerTick
            newHP = Math.max(0, newHP - dmg)
            const dotEvent: DotTickEvent = {
              type: 'DOT_TICK',
              sourceStatusId: effect.id,
              targetId: unitId,
              amount: dmg,
              element: effect.dotElement ?? 'dark',
              pos: unit.pos,
            }
            events.push(dotEvent)
            remaining.push({ ...effect, nextTickAt: effect.nextTickAt + (effect.dotTickMs ?? 1000) })
            continue
          }

          remaining.push(effect)
        }

        if (newHP <= 0 && !unit.isDead) {
          died = true
          const dieEvent: UnitDiedEvent = {
            type: 'UNIT_DIED',
            unitId,
            pos: unit.pos,
            killedById: null,
          }
          events.push(dieEvent)
        }

        const updatedUnit: Unit = {
          ...unit,
          currentHP: newHP,
          statusEffects: remaining,
          ...(died ? { isDead: true } : {}),
        }
        currentState = setUnit(currentState, updatedUnit)
      }

      // 被動觸發（on_time HP regen + on_below_hp 因 DoT 扣血觸發）
      if (deps.passiveRegistry) {
        for (const unitId of Object.keys(currentState.units)) {
          const u = currentState.units[unitId]!
          if (u.isDead || !u.monsterId) continue
          const passiveDefs = deps.passiveRegistry[u.monsterId]
          if (!passiveDefs || passiveDefs.length === 0) continue
          const passiveResult = checkPassiveTriggers(currentState, unitId, passiveDefs, nowMs)
          currentState = passiveResult.state
          events.push(...passiveResult.events)
        }
      }

      return { state: currentState, events }
    }

    // ── 層間打寶：開始打寶階段 ────────────────────────────────────────────────

    case 'START_LOOT_PHASE': {
      const { items, bonusGold, bonusReasons = [], bonusPicks = 0, playerIds } = action

      // lootRegistry 必須在 deps 中提供
      if (!deps.lootRegistry) {
        console.warn('[reduce] START_LOOT_PHASE 需要 deps.lootRegistry，跳過')
        return { state, events: [] }
      }

      const lootPhase = generateLootPhase({
        items,
        playerCount: state.run.playerCount,
        playerIds,
        bonusGold,
        bonusReasons,
        bonusPicks,
        distributionMode: state.run.lootDistributionMode,
        captainId: state.run.captainPlayerId ?? undefined,
        registry: deps.lootRegistry,
      })

      const newRun = { ...state.run, lootPhase }
      const newState: GameState = { ...state, run: newRun }

      return {
        state: newState,
        events: [{
          type: 'LOOT_PHASE_STARTED',
          floorNumber: state.floor.floorNumber,
          optionCount: lootPhase.options.length,
          picksRemaining: lootPhase.picksRemaining,
        }],
      }
    }

    // ── 層間打寶：開箱 ────────────────────────────────────────────────────────

    case 'OPEN_OPTION': {
      if (!state.run.lootPhase) return { state, events: [] }
      const { instanceId, playerId } = action

      // 從存活玩家推導 allPlayerIds（保持 id 穩定排序）
      const allPlayerIds = Object.values(state.units)
        .filter(u => u.kind === 'player' && !u.isDead)
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(u => u.id)

      const newLootPhase = applyOpenOption(
        state.run.lootPhase,
        instanceId,
        playerId,
        state.run.lootDistributionMode,
        allPlayerIds
      )
      const newRun = { ...state.run, lootPhase: newLootPhase }
      const newState: GameState = { ...state, run: newRun }

      return {
        state: newState,
        events: [{
          type: 'OPTION_OPENED',
          instanceId,
          playerId,
          pendingVote: state.run.lootDistributionMode === 'need_greed',
        }],
      }
    }

    // ── 層間打寶：投票（need_greed）──────────────────────────────────────────

    case 'SUBMIT_VOTE': {
      const lootPhase = state.run.lootPhase
      if (!lootPhase?.currentVote) return { state, events: [] }

      const { instanceId, playerId, vote } = action
      if (lootPhase.currentVote.instanceId !== instanceId) return { state, events: [] }

      // 記錄這位玩家的投票
      const updatedVote = {
        ...lootPhase.currentVote,
        votes: { ...lootPhase.currentVote.votes, [playerId]: vote },
      }
      let updatedPhase = { ...lootPhase, currentVote: updatedVote }

      // 從存活玩家推導 allPlayerIds
      const allPlayerIds = Object.values(state.units)
        .filter(u => u.kind === 'player' && !u.isDead)
        .map(u => u.id)

      // 所有玩家都投完票（key 存在即算投票）→ 自動解析
      const allVoted = allPlayerIds.every(id => id in updatedVote.votes)
      const events: Event[] = []

      if (allVoted) {
        updatedPhase = resolveVote(updatedPhase)
        events.push({
          type: 'VOTE_RESOLVED',
          instanceId,
          winnerId: updatedPhase.currentVote?.winnerId ?? null,
        })
      }

      const newRun = { ...state.run, lootPhase: updatedPhase }
      return { state: { ...state, run: newRun }, events }
    }

    // ── 選擇下一層路線 ────────────────────────────────────────────────────────

    case 'SELECT_PATH': {
      // 打寶階段未結束時不允許選路
      if (state.run.lootPhase && state.run.lootPhase.phase !== 'done') {
        return { state, events: [] }
      }

      const { pathType } = action
      const newRun = { ...advanceRun(state.run, pathType), lootPhase: null }
      const newState: GameState = { ...state, run: newRun }

      return {
        state: newState,
        events: [{
          type: 'PATH_SELECTED',
          pathType,
          nextFloor: newRun.floorNumber,
        }],
      }
    }

    default:
      return { state, events: [] }
  }
}

// ─── 樓層目標檢查 ─────────────────────────────────────────────────────────────

export function checkObjective(state: GameState): {
  cleared: boolean
  failed: boolean
  event: FloorClearedEvent | FloorFailedEvent | null
} {
  const floorNumber = state.floor.floorNumber

  // ── 敗北優先判斷：所有玩家陣亡 ──────────────────────────────────────────
  const players = Object.values(state.units).filter(u => u.kind === 'player')
  if (players.length > 0 && players.every(u => u.isDead)) {
    return {
      cleared: false,
      failed: true,
      event: { type: 'FLOOR_FAILED', floorNumber, reason: 'all_dead' },
    }
  }

  const obj = state.floor.objective

  switch (obj.type) {
    case 'clear_all': {
      const monstersAlive = Object.values(state.units).some(
        u => u.kind === 'monster' && !u.isDead
      )
      if (!monstersAlive) {
        return { cleared: true, failed: false, event: { type: 'FLOOR_CLEARED', floorNumber } }
      }
      return { cleared: false, failed: false, event: null }
    }

    case 'kill_boss': {
      const boss = state.units[obj.bossId]
      if (boss?.isDead) {
        return { cleared: true, failed: false, event: { type: 'FLOOR_CLEARED', floorNumber } }
      }
      return { cleared: false, failed: false, event: null }
    }

    case 'reach_exit': {
      const alivePlayers = players.filter(u => !u.isDead)
      const anyAtExit = alivePlayers.some(
        p => p.pos.x === obj.exitPos.x && p.pos.y === obj.exitPos.y
      )
      if (anyAtExit) {
        return { cleared: true, failed: false, event: { type: 'FLOOR_CLEARED', floorNumber } }
      }
      return { cleared: false, failed: false, event: null }
    }

    case 'kill_targets': {
      const allDead = obj.targetIds.every(id => state.units[id]?.isDead)
      if (allDead) {
        return { cleared: true, failed: false, event: { type: 'FLOOR_CLEARED', floorNumber } }
      }
      return { cleared: false, failed: false, event: null }
    }

    case 'survive': {
      if (state.timeline.tick >= obj.untilTick) {
        return { cleared: true, failed: false, event: { type: 'FLOOR_CLEARED', floorNumber } }
      }
      return { cleared: false, failed: false, event: null }
    }

    default:
      return { cleared: false, failed: false, event: null }
  }
}

// ─── 內部工具 ─────────────────────────────────────────────────────────────────

function setUnit(state: GameState, unit: Unit): GameState {
  return {
    ...state,
    units: { ...state.units, [unit.id]: unit },
  }
}

function resetATB(state: GameState, unitId: string, value: number): GameState {
  return {
    ...state,
    timeline: {
      ...state.timeline,
      pendingUnitId: null,
      entries: state.timeline.entries.map(e =>
        e.unitId === unitId ? { ...e, atb: value } : e
      ),
    },
  }
}

function applyCooldown(state: GameState, unitId: string, slot: number, ms: number): GameState {
  if (ms <= 0) return state
  const unit = state.units[unitId]!
  const newCDs = [...unit.weaponCooldownUntil]
  newCDs[slot] = state.timeline.tick + ms
  return setUnit(state, { ...unit, weaponCooldownUntil: newCDs })
}

function findUnitAt(state: GameState, pos: Pos, excludeId: string): Unit | undefined {
  return Object.values(state.units).find(
    u => u.id !== excludeId && !u.isDead && u.pos.x === pos.x && u.pos.y === pos.y
  )
}

function calcFacing(from: Pos, to: Pos): 'up' | 'down' | 'left' | 'right' {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'right' : 'left'
  }
  return dy >= 0 ? 'down' : 'up'
}

function applyCellEffect(
  state: GameState,
  unitId: string,
  pos: Pos,
  deps: ReduceDeps = { allAffixDefs: {} }
): { state: GameState; events: Event[] } {
  const cell = state.floor.cells[pos.y]?.[pos.x]
  if (!cell) return { state, events: [] }

  const events: Event[] = []
  let currentState = state

  // 回復格（HP/SP/MP 各回復 50%）
  if (cell.type === 'recovery') {
    const unit = currentState.units[unitId]!
    const healHP = Math.floor(unit.maxHP * 0.5)
    const healSP = Math.floor(unit.maxSP * 0.5)
    const healMP = Math.floor(unit.maxMP * 0.5)
    const newHP = Math.min(unit.maxHP, unit.currentHP + healHP)
    const newSP = Math.min(unit.maxSP, unit.currentSP + healSP)
    const newMP = Math.min(unit.maxMP, unit.currentMP + healMP)
    currentState = setUnit(currentState, { ...unit, currentHP: newHP, currentSP: newSP, currentMP: newMP })
    events.push({ type: 'HEAL', unitId, amount: healHP, resource: 'hp', pos })
    if (healSP > 0) events.push({ type: 'HEAL', unitId, amount: healSP, resource: 'sp', pos })
    if (healMP > 0) events.push({ type: 'HEAL', unitId, amount: healMP, resource: 'mp', pos })
  }

  // step_on 危害物觸發
  for (const hazard of Object.values(currentState.floor.hazards)) {
    if (hazard.pos.x !== pos.x || hazard.pos.y !== pos.y) continue
    if (hazard.triggerOn !== 'step_on' && hazard.triggerOn !== 'both') continue

    const result = applyHazardToCell(currentState, hazard, unitId, deps)
    currentState = result.state
    events.push(
      { type: 'HAZARD_TRIGGERED', hazardId: hazard.id, triggerUnitId: unitId, pos: hazard.pos },
      ...result.events
    )

    const newUsed = hazard.triggersUsed + 1
    if (hazard.maxTriggers && newUsed >= hazard.maxTriggers) {
      currentState = removeHazard(currentState, hazard.id)
      events.push({ type: 'HAZARD_EXPIRED', hazardId: hazard.id, pos: hazard.pos })
    } else {
      currentState = updateHazard(currentState, { ...hazard, triggersUsed: newUsed })
    }
  }

  return { state: currentState, events }
}

// ─── 危害物工具 ───────────────────────────────────────────────────────────────

import type { HazardObject } from './state'
import type { HazardTriggeredEvent, HazardExpiredEvent } from './events'

function removeHazard(state: GameState, hazardId: string): GameState {
  const newHazards = { ...state.floor.hazards }
  delete newHazards[hazardId]
  return { ...state, floor: { ...state.floor, hazards: newHazards } }
}

function updateHazard(state: GameState, hazard: HazardObject): GameState {
  return {
    ...state,
    floor: { ...state.floor, hazards: { ...state.floor.hazards, [hazard.id]: hazard } },
  }
}

/**
 * 將危害物效果套用到格上的單位（或指定 triggerUnitId）。
 * 依 skillRegistry 查找 effectId 對應的技能效果。
 */
function applyHazardToCell(
  state: GameState,
  hazard: HazardObject,
  triggerUnitId: string | null,
  deps: ReduceDeps
): { state: GameState; events: Event[] } {
  const skillDef = deps.skillRegistry?.[hazard.effectId]
  if (!skillDef) return { state, events: [] }

  // 找到觸發單位（step_on 傳入指定 id；interval 找格上的敵方單位）
  const targetUnit = triggerUnitId
    ? state.units[triggerUnitId]
    : findUnitAt(state, hazard.pos, hazard.ownerId)
  if (!targetUnit || targetUnit.isDead) return { state, events: [] }

  // 找施法者（owner）；若已死亡則用 target 自身作為偽施法者（效果仍套用）
  const caster = state.units[hazard.ownerId] ?? targetUnit

  // 直接套用技能的 effect（不透過 applySkillEffect，避免 persistent_zone hitMode 再次創建危害物）
  return applyEffectToTarget(
    state, caster, skillDef, targetUnit,
    deps.allAffixDefs, deps.dungeonQuality ?? state.run.dungeonQuality
  )
}

// ─── 掉落物生成 ───────────────────────────────────────────────────────────────

type LootResult = { state: GameState; events: LootDroppedEvent[] }

function generateLoot(state: GameState, deadUnit: Unit): LootResult {
  // MVP1：怪物死亡掉金幣（簡單版，之後由 spawner 的 dropTable 驅動）
  const gold = Math.floor(Math.random() * 5) + 2
  const lootId = `loot_${deadUnit.id}_${Date.now()}`
  const drop: LootDrop = {
    id: lootId,
    pos: deadUnit.pos,
    item: { kind: 'gold', amount: gold },
  }
  const newFloor = { ...state.floor, loot: [...state.floor.loot, drop] }
  const newState: GameState = { ...state, floor: newFloor }
  const event: LootDroppedEvent = {
    type: 'LOOT_DROPPED',
    lootId,
    pos: deadUnit.pos,
    item: drop.item,
  }
  return { state: newState, events: [event] }
}

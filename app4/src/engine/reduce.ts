// BG Card Game Engine — 狀態轉換（Reducer）

import type { GameState, BGInstance, PlayerState } from './state'
import {
  drawCard, effectiveAttack, effectiveSupport, effectiveHP,
  getBGsInZone, getEnemyBGsInZone, getAllyBGsInZone,
  hasBricks, isPlazaBlocked, isSiegeBlocked
} from './state'
import type { Action, EventParams, SkillParams } from './actions'
import type { PlayerId, ZoneId, BrickAreaId } from './types'
import { opponentOf, homeZone, frontZone, plazaBrickId, baseBrickId, areAdjacent, moveToward, moveBack } from './types'
import { bgCardById } from '../data/bg-cards'
import { reactionById } from '../data/reactions'
import { buildingById } from '../data/buildings'
import { eventById } from '../data/events'
import { canDispatch } from './guards'
import type { GameEvent } from './events'
import { makeEvent } from './events'

// 深拷貝（簡單版）
function clone<T>(x: T): T { return JSON.parse(JSON.stringify(x)) }

export type ReduceOk  = { ok: true;  state: GameState; events: GameEvent[] }
export type ReduceErr = { ok: false; error: string }
export type ReduceResult = ReduceOk | ReduceErr

export function reduce(state: GameState, player: PlayerId, action: Action): ReduceResult {
  const guard = canDispatch(state, player, action)
  if (!guard.ok) return { ok: false, error: `非法行動 [${action.type}]: ${guard.reason}` }

  const s = clone(state) as GameState
  const events: GameEvent[] = []
  const emit = (e: GameEvent) => events.push(e)

  switch (action.type) {
    case 'SURRENDER':
      s.winner = opponentOf(player)
      s.winReason = `${player} 投降`
      emit(makeEvent('surrender', { player }))
      break

    case 'DRAW_CARD': {
      const rng = makeRNG(s)
      const card = drawCard(s.players[player], rng)
      s.drawActionsUsed++
      if (card) {
        s.players[player].hand.push(card)
        emit(makeEvent('draw_card', { player, card }))
      }
      break
    }

    case 'PLACE_BRICK': {
      const rng = makeRNG(s)
      const ps = s.players[player]
      if (ps.deck.length === 0) {
        // 洗墓地
        ps.deck = shuffleArr([...ps.graveyard], rng)
        ps.graveyard = []
        emit(makeEvent('shuffle_graveyard', { player }))
      }
      const card = ps.deck.pop()
      if (card) {
        s.brickAreas[action.areaId].slots.push({ cardId: card, isBuilding: false })
        emit(makeEvent('place_brick', { player, areaId: action.areaId }))
      }
      s.drawActionsUsed++
      s.drawBrickUsed = true
      break
    }

    case 'PLAY_BUILDING': {
      const ps = s.players[player]
      const idx = ps.hand.indexOf(action.cardId)
      ps.hand.splice(idx, 1)
      const buildingDef = buildingById[action.cardId]
      s.brickAreas[action.areaId].slots.push({ cardId: action.cardId, isBuilding: true, durability: buildingDef?.durability ?? 1 })
      s.mainBuildingPlayed = true
      emit(makeEvent('play_building', { player, cardId: action.cardId, areaId: action.areaId }))
      break
    }

    case 'PLAY_EVENT': {
      const ps = s.players[player]
      const idx = ps.hand.indexOf(action.cardId)
      ps.hand.splice(idx, 1)
      ps.graveyard.push(action.cardId)
      if (action.cardId === 'rush_time') s.rushTimeUsed = true
      applyEventEffect(s, player, action.cardId, action.params, events)
      emit(makeEvent('play_event', { player, cardId: action.cardId }))
      break
    }

    case 'START_BG_ACTION': {
      s.actingBGId = action.bgId
      s.jointAllyId = null
      const bg = s.bgs[action.bgId]
      bg.movedThisAction = false
      bg.usedSkillThisAction = false
      bg.doneNormalAction = false
      emit(makeEvent('start_bg_action', { bgId: action.bgId }))
      break
    }

    case 'MOVE_BG': {
      const bg = s.bgs[s.actingBGId!]
      const fromZone = bg.zone
      bg.zone = action.toZone
      if (bg.freeMovePending) {
        bg.freeMovePending = false  // 靈動額外移動已使用
      } else {
        bg.movedThisAction = true
      }
      emit(makeEvent('bg_move', { bgId: bg.id, from: fromZone, to: action.toZone }))

      // 威嚇反應觸發（由前端/遊戲協調器處理 RESOLVE_REACTION）
      checkReaction_enemyEnterZone(s, bg, action.toZone, events)
      break
    }

    case 'USE_SKILL': {
      const actingBG = s.bgs[s.actingBGId!]
      // 決定施放技能的 BG（actingBG 或聯合 ally）
      const casterBG = action.fromBGId ? s.bgs[action.fromBGId] : actingBG
      const def = bgCardById[casterBG.cardId]
      const skill = def.skills[action.skillIndex]

      // 暈眩狀態檢查
      if (casterBG.state === 'stunned' && !skill.canUseWhenStunned) {
        throw new Error(`暈眩狀態無法使用 ${skill.name}`)
      }

      // 設定冷卻 & 消費手牌（S2 有 handCost，從 acting 玩家手牌扣）
      casterBG.skillCooldowns[action.skillIndex] = skill.cd
      actingBG.usedSkillThisAction = true  // 不論誰施放，此次行動的技能配額消耗
      if (action.fromBGId) {
        casterBG.usedSkillThisAction = true  // ally 也標記（本行動結束前不能再被其他 actingBG 用）
        s.jointAllyId = action.fromBGId     // 鎖定聯合 ally，後續 DO_ATTACK 必須帶此 ally
      }
      const handCost = skill.handCost ?? 0
      if (handCost > 0) {
        const ps = s.players[player]
        const toDiscard = action.params.discardCardIds?.slice(0, handCost) ?? []
        // 若未指定，自動取手牌前 N 張
        if (toDiscard.length < handCost) {
          const remaining = ps.hand.filter(id => !toDiscard.includes(id))
          toDiscard.push(...remaining.slice(0, handCost - toDiscard.length))
        }
        for (const cardId of toDiscard) {
          const idx = ps.hand.indexOf(cardId)
          if (idx >= 0) {
            ps.hand.splice(idx, 1)
            ps.graveyard.push(cardId)
          }
        }
      }

      // 執行技能效果（以 casterBG 為施放者）
      applySkillEffect(s, player, casterBG, action.skillIndex, action.params, events)
      emit(makeEvent('use_skill', { bgId: casterBG.id, skillName: skill.name }))
      break
    }

    case 'DO_ATTACK': {
      const bg = s.bgs[s.actingBGId!]
      const target = s.bgs[action.targetBGId]
      const ally = action.allyId ? s.bgs[action.allyId] : null

      let attackVal = effectiveAttack(bg)
      if (ally && ally.owner === player && ally.zone === bg.zone && ally.state !== 'stunned') {
        attackVal += effectiveSupport(ally)
      }
      // 大可黑暗元素模式額外攻擊已含在 effectiveAttack 中
      // 愛的輪迴攻擊加成
      if (bg.attackBonusNextSkill > 0) {
        attackVal += bg.attackBonusNextSkill
        bg.attackBonusNextSkill = 0
      }

      applyAttack(s, player, bg, target, attackVal, events)
      bg.doneNormalAction = true
      // 聯合攻擊的支援 BG 本回合不能再行動
      if (ally && ally.owner === player) {
        ally.actedThisPhase = true
      }
      emit(makeEvent('do_attack', { attackerId: bg.id, targetId: target.id, attackValue: attackVal }))
      break
    }

    case 'DO_CLEAR_BRICK': {
      const bg = s.bgs[s.actingBGId!]
      const area = s.brickAreas[action.areaId]
      const enemy = opponentOf(player)

      // 若指定 slotIndex 就清除該格，否則取最後一格
      const slotIdx = action.slotIndex ?? area.slots.length - 1
      const slot = area.slots[slotIdx]

      let blocked = false
      // 阻擋反應卡檢查
      const enemyBGsHere = getEnemyBGsInZone(s, bg.zone, player)
      for (const eb of enemyBGsHere) {
        if (eb.reactionCard === 'block' && eb.state !== 'ko') {
          emit(makeEvent('reaction_triggered', { reactionId: 'block', bgId: eb.id }))
          blocked = true
          eb.reactionCard = null
          const ps = s.players[enemy]
          ps.graveyard.push('block')
          const rng = makeRNG(s)
          const drawn = drawCard(ps, rng)
          if (drawn) emit(makeEvent('draw_card', { player: enemy, card: drawn }))
          break
        }
      }

      if (!blocked) {
        const enemyPS = s.players[enemy]
        if (slot.isBuilding) {
          // 建築物：扣耐久，降至 0 才移除送棄牌區
          const dur = (slot.durability ?? 1) - 1
          if (dur <= 0) {
            area.slots.splice(slotIdx, 1)
            enemyPS.graveyard.push(slot.cardId)
            emit(makeEvent('clear_brick', { bgId: bg.id, areaId: action.areaId, building: true, destroyed: true }))
          } else {
            slot.durability = dur
            emit(makeEvent('clear_brick', { bgId: bg.id, areaId: action.areaId, building: true, destroyed: false }))
          }
        } else {
          // 普通磚牌：移除並送回防守方手牌
          area.slots.splice(slotIdx, 1)
          enemyPS.hand.push(slot.cardId)
          emit(makeEvent('clear_brick', { bgId: bg.id, areaId: action.areaId }))
        }
        // 大可黑暗元素模式清磚+1（額外清最後一格，若為建築同樣扣耐久）
        if (bg.darkModeActive && area.slots.length > 0) {
          const extraSlot = area.slots[area.slots.length - 1]
          if (extraSlot.isBuilding) {
            const dur = (extraSlot.durability ?? 1) - 1
            if (dur <= 0) {
              area.slots.pop()
              enemyPS.graveyard.push(extraSlot.cardId)
            } else {
              extraSlot.durability = dur
            }
          } else {
            area.slots.pop()
            enemyPS.hand.push(extraSlot.cardId)
          }
          emit(makeEvent('clear_brick', { bgId: bg.id, areaId: action.areaId, extra: true }))
        }
      }
      bg.doneNormalAction = true
      break
    }

    case 'DO_SIEGE': {
      const bg = s.bgs[s.actingBGId!]
      const enemy = opponentOf(player)

      const walls = s.cityWalls[enemy]
      if (walls <= 0) {
        s.winner = player
        s.winReason = '攻城成功，敵方城牆已為0'
      } else {
        s.cityWalls[enemy] = walls - 1
        // 敵方抽1張
        const rng = makeRNG(s)
        const drawn = drawCard(s.players[enemy], rng)
        if (drawn) emit(makeEvent('draw_card', { player: enemy, card: drawn }))
        emit(makeEvent('siege', { attackerId: bg.id, defender: enemy, wallsLeft: s.cityWalls[enemy] }))
        // 城牆減為 0 後再次攻城才勝利，但若此次攻城前城牆已 0，上面已設 winner
        if (s.cityWalls[enemy] === 0) {
          emit(makeEvent('walls_destroyed', { defender: enemy }))
        }
      }
      bg.doneNormalAction = true
      break
    }

    case 'END_BG_ACTION': {
      const bg = s.bgs[s.actingBGId!]
      bg.actedThisPhase = true
      s.bgActionsUsed++
      s.actingBGId = null
      s.jointAllyId = null
      emit(makeEvent('end_bg_action', { bgId: bg.id }))
      break
    }

    case 'INSTALL_REACTION': {
      const bg = s.bgs[action.bgId]
      // 移除舊反應卡
      if (bg.reactionCard) {
        s.players[player].graveyard.push(bg.reactionCard)
      }
      bg.reactionCard = action.cardId
      const idx = s.players[player].hand.indexOf(action.cardId)
      s.players[player].hand.splice(idx, 1)
      emit(makeEvent('install_reaction', { bgId: action.bgId, cardId: action.cardId }))
      break
    }

    case 'RESOLVE_REACTION': {
      const { choice } = action
      if (choice.reactionId === 'intimidate' && choice.intimidateChoice) {
        const triggerBG = s.bgs[choice.triggerBGId]   // 移動的 BG（受害者）
        const intimidateBG = choice.intimidateBGId ? s.bgs[choice.intimidateBGId] : null  // 持有威嚇卡的 BG（攻擊方）
        if (choice.intimidateChoice === 'take_damage') {
          // 用威嚇 BG 作為正式 attacker，避免 triggerBG 對自己觸發反擊
          applyAttack(s, opponentOf(player), intimidateBG ?? triggerBG, triggerBG, 4, events)
        } else {
          // B: 退回移動前的位置（往自方方向退一格）
          const currentZone = triggerBG.zone
          const prevZone = moveBack(currentZone, triggerBG.owner)
          if (prevZone) {
            triggerBG.zone = prevZone
            events.push(makeEvent('bg_move', { bgId: triggerBG.id, from: currentZone, to: prevZone }))
          }
        }
      }
      break
    }

    case 'NEXT_PHASE': {
      advancePhase(s, player, events)
      break
    }
  }

  // 檢查勝利條件（已在 DO_SIEGE 中處理，這裡為保底）
  if (!s.winner) checkWinCondition(s)

  return { ok: true, state: s, events }
}

// ── 階段推進 ─────────────────────────────────────

type PhaseSeq = 'draw' | 'main' | 'action' | 'react'

function advancePhase(s: GameState, player: PlayerId, events: GameEvent[]) {
  const phaseOrder: PhaseSeq[] = ['draw', 'main', 'action', 'react']

  const currentIdx = phaseOrder.indexOf(s.phase)
  const next = phaseOrder[currentIdx + 1]

  if (!next || s.phase === 'react') {
    // 交給下一個玩家
    const nextPlayer = opponentOf(player)
    s.currentPlayer = nextPlayer
    s.phase = 'draw'
    s.turn++
    onTurnStart(s, nextPlayer, events)
  } else {
    s.phase = next as PhaseSeq
    onPhaseStart(s, player, s.phase as PhaseSeq, events)
  }
}

function onTurnStart(s: GameState, player: PlayerId, events: GameEvent[]) {
  s.drawActionsUsed = 0
  s.drawBrickUsed = false
  s.mainBuildingPlayed = false
  s.bgActionsUsed = 0
  s.bgActionsMax = 2
  s.actingBGId = null

  // 遞減技能冷卻
  for (const bg of Object.values(s.bgs)) {
    if (bg.owner !== player) continue
    if (bg.skillCooldowns[0] > 0) bg.skillCooldowns[0]--
    if (bg.skillCooldowns[1] > 0) bg.skillCooldowns[1]--
  }

  // 處理 BG 狀態恢復
  for (const bg of Object.values(s.bgs)) {
    if (bg.owner !== player) continue

    bg.cantMoveThisTurn = bg.cantMoveNextTurn
    bg.cantMoveNextTurn = false
    bg.freeMovePending = false  // 靈動額外移動若未使用則清除

    if (bg.recoveryCountdown > 0) {
      bg.recoveryCountdown--
      if (bg.recoveryCountdown === 0) {
        const wasKO = bg.state === 'ko'
        bg.state = 'normal'
        bg.hpCurrent = bg.hpBase
        bg.tempHpBonus = 0
        bg.tempAttackBonus = 0
        bg.tempSupportBonus = 0
        events.push(makeEvent('bg_recover', { bgId: bg.id, wasKO }))
      }
    } else if (bg.state === 'normal') {
      // 正常狀態：回復 HP
      bg.hpCurrent = bg.hpBase
      bg.tempHpBonus = 0
      bg.tempAttackBonus = 0
      bg.tempSupportBonus = 0
    }

    // 傷害減免倒計時
    if (bg.damageReductionTurns > 0) {
      bg.damageReductionTurns--
      if (bg.damageReductionTurns === 0) bg.damageReduction = 0
    }

    // 黑暗元素模式倒計時
    if (bg.darkModeActive && bg.darkModeTurns > 0) {
      bg.darkModeTurns--
      if (bg.darkModeTurns === 0) {
        bg.darkModeActive = false
        bg.tempAttackBonus = Math.max(0, bg.tempAttackBonus - 2)
        bg.tempSupportBonus = Math.max(0, bg.tempSupportBonus - 1)
      }
    }

    // 免疫旗標清除
    bg.immuneThisTurn = false
    bg.immuneFirstAttack = false
    bg.firstAttackImmunityUsed = false

    bg.actedThisPhase = false
  }

  // 處理延遲效果
  const toRemove: number[] = []
  for (let i = 0; i < s.pendingEffects.length; i++) {
    const pe = s.pendingEffects[i]
    pe.turnsLeft--
    if (pe.turnsLeft <= 0) {
      resolvePendingEffect(s, player, pe, events)
      toRemove.push(i)
    }
  }
  for (let i = toRemove.length - 1; i >= 0; i--) {
    s.pendingEffects.splice(toRemove[i], 1)
  }

  events.push(makeEvent('turn_start', { player, turn: s.turn }))
}

function onPhaseStart(s: GameState, player: PlayerId, phase: PhaseSeq, events: GameEvent[]) {
  if (phase === 'main') {
    // 雜魚群體建築效果
    applyMobGroupEffect(s, player, events)
  }
  if (phase === 'action') {
    // 重置行動旗標
    for (const bg of Object.values(s.bgs)) {
      if (bg.owner === player) bg.actedThisPhase = false
    }
  }
  events.push(makeEvent('phase_start', { player, phase }))
}

// ── 戰鬥計算 ─────────────────────────────────────

function applyAttack(
  s: GameState,
  attacker: PlayerId,
  attackerBG: BGInstance,
  target: BGInstance,
  rawValue: number,
  events: GameEvent[],
  isCounterContext = false,  // 防止反擊再觸發反擊
) {
  if (!target || !attackerBG) return
  if (target.state === 'ko') return

  // 免疫檢查
  if (target.immuneThisTurn) {
    events.push(makeEvent('attack_blocked', { targetId: target.id, reason: '免疫' }))
    return
  }
  if (target.immuneFirstAttack && !target.firstAttackImmunityUsed) {
    target.firstAttackImmunityUsed = true
    events.push(makeEvent('attack_blocked', { targetId: target.id, reason: '第1次免疫' }))
    return
  }

  // on_receive_attack 反應卡（閃避 / 誤導 / 靈動）
  const rcId = target.reactionCard
  if (rcId === 'dodge' || rcId === 'mislead' || rcId === 'agile') {
    target.reactionCard = null
    s.players[target.owner].graveyard.push(rcId)
    events.push(makeEvent('reaction_triggered', { reactionId: rcId, bgId: target.id }))

    if (rcId === 'dodge') {
      // 傷害改為 0，抽 1 張牌
      const rng = makeRNG(s)
      const drawn = drawCard(s.players[target.owner], rng)
      if (drawn) events.push(makeEvent('draw_card', { player: target.owner, card: drawn }))
      return
    }
    if (rcId === 'mislead') {
      // 傷害改為 0，本區域清磚 1（目標BG所在區域自己的磚堆被擊中）
      const ownAreaId = (target.zone === homeZone(target.owner)
        ? baseBrickId(target.owner) : plazaBrickId(target.owner)) as BrickAreaId
      const ownArea = s.brickAreas[ownAreaId]
      if (ownArea.slots.length > 0) {
        const removed = ownArea.slots.pop()!
        s.players[attacker].hand.push(removed.cardId)
      }
      return
    }
    if (rcId === 'agile') {
      // 傷害照算，但此回合堅韌 +4，且下次行動可額外移動一次（無視磚堆阻擋）
      target.tempHpBonus += 4
      target.freeMovePending = true
      // 繼續後續傷害計算
    }
  }

  // 可反擊技能觸發（守方在傷害計算前宣告反擊）
  if (!isCounterContext && tryCounterattack(s, target, attackerBG, events)) return

  // 傷害減免
  let finalValue = rawValue - target.damageReduction
  if (finalValue < 0) finalValue = 0

  // 城門建築效果（降低 1 傷害）
  const areaId = target.zone === homeZone(target.owner) ? baseBrickId(target.owner) : plazaBrickId(target.owner)
  const area = s.brickAreas[areaId]
  for (const slot of area.slots) {
    if (slot.isBuilding && slot.cardId === 'city_gate') {
      finalValue = Math.max(0, finalValue - 1)
      break
    }
  }

  const hpBefore = effectiveHP(target)

  if (target.state === 'stunned') {
    // 暈眩 → KO
    triggerKO(s, target, events)
    return
  }

  if (finalValue > 2 * hpBefore) {
    // 直接 KO
    triggerKO(s, target, events)
    return
  }

  if (finalValue >= hpBefore) {
    // 暈眩（傷害 >= 剩餘堅韌則暈眩）
    target.hpCurrent = 0
    triggerStun(s, attacker, target, events)
    // 愛的輪迴：技能造成暈眩時直接 KO
    if (attackerBG.directKONextSkill) {
      attackerBG.directKONextSkill = false
      triggerKO(s, target, events)
    }
    return
  }

  // 未超過 HP，減少 HP
  target.hpCurrent -= finalValue
  events.push(makeEvent('take_damage', { targetId: target.id, damage: finalValue, hpLeft: effectiveHP(target) }))
}

/** 嘗試觸發可反擊技能。成功反擊回傳 true（取消傷害），否則回傳 false */
function tryCounterattack(
  s: GameState,
  defBG: BGInstance,
  attackerBG: BGInstance,
  events: GameEvent[],
): boolean {
  // 攻擊方不是合法 BG（如建築效果觸發），不允許反擊
  if (!s.bgs[attackerBG.id]) return false
  // 暈眩/KO 狀態無法反擊
  if (defBG.state === 'stunned' || defBG.state === 'ko') return false

  const defPlayer = defBG.owner
  const defDef = bgCardById[defBG.cardId]
  for (let si = 0; si < 2; si++) {
    const skill = defDef?.skills[si]
    if (!skill?.counterattack) continue
    if (defBG.skillCooldowns[si] > 0) continue
    const totalHandCost = (skill.handCost ?? 0) + (skill.counterattack.extraHandCost ?? 0)
    if (s.players[defPlayer].hand.length < totalHandCost) continue

    // 反擊觸發：消耗手牌
    const discardIds = s.players[defPlayer].hand.splice(0, totalHandCost)
    s.players[defPlayer].graveyard.push(...discardIds)

    // 設冷卻（正常 CD + extraCd）
    defBG.skillCooldowns[si] = skill.cd + (skill.counterattack.extraCd ?? 0)
    defBG.usedSkillThisAction = true

    // 反擊目標 = 攻擊方 BG
    const params: SkillParams = {
      isCounterattack: true,
      targetBGIds: [attackerBG.id],
      targetBGId: attackerBG.id,
    }
    events.push(makeEvent('skill_effect', { bgId: defBG.id, detail: `反擊：${skill.name}` }))
    applySkillEffect(s, defPlayer, defBG, si as 0 | 1, params, events)
    return true
  }
  return false
}

function triggerStun(s: GameState, attackerPlayer: PlayerId, target: BGInstance, events: GameEvent[]) {
  target.state = 'stunned'
  target.recoveryCountdown = 2  // 2 → owner turn 1: 2→1 (miss full turn); owner turn 2: 1→0 (recover)

  // 玉石俱焚反應
  if (target.reactionCard === 'mutual_destruction') {
    const attackerBGs = getAllyBGsInZone(s, target.zone, attackerPlayer)
    if (attackerBGs.length > 0) {
      const victimBG = attackerBGs[0]
      events.push(makeEvent('reaction_triggered', { reactionId: 'mutual_destruction', bgId: target.id }))
      applyAttack(s, target.owner, target, victimBG, 5, events)
    }
    target.reactionCard = null
    s.players[target.owner].graveyard.push('mutual_destruction')
  }

  events.push(makeEvent('bg_stunned', { bgId: target.id }))
}

function triggerKO(s: GameState, target: BGInstance, events: GameEvent[]) {
  if (!target) return
  target.state = 'ko'
  target.recoveryCountdown = 2
  const savedReaction = target.reactionCard
  target.reactionCard = null

  // 冷靜思考反應
  if (savedReaction === 'calm_thinking') {
    const rng = makeRNG(s)
    for (let i = 0; i < 3; i++) {
      const card = drawCard(s.players[target.owner], rng)
      if (card) events.push(makeEvent('draw_card', { player: target.owner, card }))
    }
    s.players[target.owner].graveyard.push('calm_thinking')
    events.push(makeEvent('reaction_triggered', { reactionId: 'calm_thinking', bgId: target.id }))
  }

  // 移回自方主堡
  const wasZone = target.zone
  target.zone = homeZone(target.owner)

  // 中繼點建築：可改為從廣場復出
  const plazaArea = s.brickAreas[plazaBrickId(target.owner)]
  const hasRelay = plazaArea.slots.some(slot => slot.isBuilding && slot.cardId === 'relay_point')
  if (hasRelay) {
    target.zone = 'plaza'
    events.push(makeEvent('relay_ko', { bgId: target.id }))
  }

  events.push(makeEvent('bg_ko', { bgId: target.id, fromZone: wasZone, toZone: target.zone }))
}

// ── 事件卡效果 ───────────────────────────────────

function applyEventEffect(s: GameState, player: PlayerId, cardId: string, params: EventParams, events: GameEvent[]) {
  const enemy = opponentOf(player)
  const rng = makeRNG(s)

  switch (cardId) {
    case 'joystick_fail': {
      const target = s.bgs[params.targetBGId!]
      target.cantMoveNextTurn = true
      events.push(makeEvent('event_effect', { cardId, targetId: target.id }))
      break
    }
    case 'best_partner': {
      const zone = params.targetZone!
      const allies = getAllyBGsInZone(s, zone, player)
      if (allies.length >= 2) {
        for (const a of allies) a.tempSupportBonus += 3
        events.push(makeEvent('event_effect', { cardId, zone, count: allies.length }))
      }
      break
    }
    case 'call_friends': {
      const targetBG = s.bgs[params.targetBGId!]
      const moveBG = s.bgs[params.targetBGId2!]
      if (areAdjacent(targetBG.zone, moveBG.zone)) {
        moveBG.zone = targetBG.zone
        events.push(makeEvent('event_effect', { cardId, bgId: moveBG.id, toZone: targetBG.zone }))
      }
      break
    }
    case 'fighting_spirit': {
      const bg = s.bgs[params.targetBGId!]
      bg.tempHpBonus += 4
      events.push(makeEvent('event_effect', { cardId, bgId: bg.id }))
      break
    }
    case 'go_home': {
      const bg = s.bgs[params.targetBGId!]
      bg.zone = homeZone(bg.owner)
      bg.state = 'normal'
      bg.recoveryCountdown = 0
      bg.hpCurrent = bg.hpBase
      bg.tempHpBonus = 0
      const drawn = drawCard(s.players[bg.owner], rng)
      if (drawn) events.push(makeEvent('draw_card', { player: bg.owner, card: drawn }))
      events.push(makeEvent('event_effect', { cardId, bgId: bg.id }))
      break
    }
    case 'see_through': {
      const target = s.bgs[params.targetBGId!]
      if (target.reactionCard) {
        s.players[target.owner].graveyard.push(target.reactionCard)
        target.reactionCard = null
        events.push(makeEvent('event_effect', { cardId, bgId: target.id }))
      }
      break
    }
    case 'rush_time': {
      for (let i = 0; i < 5; i++) {
        const drawn = drawCard(s.players[player], rng)
        if (drawn) events.push(makeEvent('draw_card', { player, card: drawn }))
      }
      for (const bg of Object.values(s.bgs)) {
        if (bg.owner === player && bg.state === 'stunned') {
          bg.state = 'normal'
          bg.recoveryCountdown = 0
        }
      }
      s.bgActionsMax += 2
      events.push(makeEvent('event_effect', { cardId }))
      break
    }
    case 'reaction_master': {
      // 捨棄手牌由 params.discardCardId 指定（已在調用前驗證）
      if (params.discardCardId) {
        const ps = s.players[player]
        const idx = ps.hand.indexOf(params.discardCardId)
        if (idx >= 0) {
          ps.hand.splice(idx, 1)
          ps.graveyard.push(params.discardCardId)
        }
      }
      // 從牌組檢索反應卡（簡化：從牌組找第一張反應卡）
      const ps = s.players[player]
      const reactionIdx = ps.deck.findIndex(id => reactionById[id])
      if (reactionIdx >= 0) {
        const found = ps.deck.splice(reactionIdx, 1)[0]
        ps.hand.push(found)
        events.push(makeEvent('event_effect', { cardId, found }))
      } else {
        // 從墓地找
        const gravIdx = ps.graveyard.findIndex(id => reactionById[id])
        if (gravIdx >= 0) {
          const found = ps.graveyard.splice(gravIdx, 1)[0]
          ps.hand.push(found)
          ps.deck = shuffleArr(ps.deck, rng)
          events.push(makeEvent('event_effect', { cardId, found }))
        }
      }
      break
    }
  }
}

// ── 技能效果 ─────────────────────────────────────

function applySkillEffect(
  s: GameState,
  player: PlayerId,
  bg: BGInstance,
  skillIndex: 0 | 1,
  params: SkillParams,
  events: GameEvent[],
) {
  const enemy = opponentOf(player)
  const rng = makeRNG(s)
  const skillId = bgCardById[bg.cardId].skills[skillIndex].id

  switch (skillId) {
    // ── 小白 ──
    case 'xiabai_s1': {
      if (bg.zone === homeZone(player)) break
      clearBrickForce(s, `${enemy}_base` as BrickAreaId, enemy, events, params.brickSlotIndex)
      clearBrickForce(s, `${enemy}_plaza` as BrickAreaId, enemy, events, params.brickSlotIndex)
      break
    }
    case 'xiabai_s2': {
      const clearArea = getBrickAreaForZone(bg.zone, player, 'clear')
      clearBrickForce(s, clearArea, enemy, events, params.brickSlotIndex)
      clearBrickForce(s, clearArea, enemy, events, params.brickSlotIndex)
      doSiege(s, player, bg, events)
      for (const eb of getEnemyBGsInZone(s, bg.zone, player)) {
        applyAttack(s, player, bg, eb, 4, events)
      }
      triggerStun(s, enemy, bg, events)
      break
    }
    // ── 小黑 ──
    case 'xiahei_s1': {
      bg.damageReduction += 2
      bg.damageReductionTurns = 2
      break
    }
    case 'xiahei_s2': {
      if (bg.zone === frontZone(player) && s.brickAreas[baseBrickId(enemy)].slots.length <= 1) {
        clearBrickForce(s, baseBrickId(enemy), enemy, events, params.brickSlotIndex)
        doSiege(s, player, bg, events)
        doSiege(s, player, bg, events)
      }
      break
    }
    // ── 白金 ──
    case 'baijin_s1': {
      if (bg.zone !== homeZone(player)) {
        clearBrickForce(s, baseBrickId(enemy), enemy, events, params.brickSlotIndex)
        clearBrickForce(s, plazaBrickId(enemy), enemy, events, params.brickSlotIndex)
        const targets = params.targetBGIds ?? []
        for (const tid of targets.slice(0, 1)) {
          applyAttack(s, player, bg, s.bgs[tid], 3, events)
        }
      }
      break
    }
    case 'baijin_s2': {
      if (bg.zone !== homeZone(player)) {
        clearBrickForce(s, baseBrickId(enemy), enemy, events, params.brickSlotIndex)
        clearBrickForce(s, plazaBrickId(enemy), enemy, events, params.brickSlotIndex)
        doSiege(s, player, bg, events)
      }
      break
    }
    // ── 小灰 ──
    case 'xiaohui_s1': {
      // 只在廣場或敵主堡時才能清磚（自家主堡無法清敵磚）
      if (bg.zone !== homeZone(player)) {
        clearBrickForce(s, getBrickAreaForZone(bg.zone, player, 'clear'), enemy, events, params.brickSlotIndex)
      }
      const targets = getEnemyBGsInZone(s, bg.zone, player).slice(0, 1)
      for (const t of targets) applyAttack(s, player, bg, t, 3, events)
      break
    }
    case 'xiaohui_s2': {
      for (const eb of getEnemyBGsInZone(s, bg.zone, player)) {
        applyAttack(s, player, bg, eb, 3, events)
        eb.cantMoveNextTurn = true
      }
      if (bg.zone !== homeZone(player)) {
        clearBrickForce(s, getBrickAreaForZone(bg.zone, player, 'clear'), enemy, events, params.brickSlotIndex)
      }
      if (bg.zone === frontZone(player)) doSiege(s, player, bg, events)
      break
    }
    // ── 大可 ──
    case 'dake_s1': {
      bg.darkModeActive = true
      bg.darkModeTurns = 2
      bg.tempAttackBonus += 2
      bg.tempSupportBonus += 1
      bg.tempHpBonus += 1
      break
    }
    case 'dake_s2': {
      addPendingEffect(s, 1, 'delayed_siege_and_ko', {
        zone: bg.zone, player, areaId: getBrickAreaForZone(bg.zone, player, 'clear'),
        targetBGId: params.targetBGId,
      })
      break
    }
    // ── 小橘 ──
    case 'xiaochu_s1': {
      // 無視磚堆移動 1 格
      const targetZone = params.targetZone
      if (targetZone && targetZone !== bg.zone) {
        const fromZone = bg.zone
        bg.zone = targetZone
        bg.movedThisAction = true
        events.push(makeEvent('bg_move', { bgId: bg.id, from: fromZone, to: targetZone }))
        // 對移動目標區1位敵BG對敵2
        const targets = getEnemyBGsInZone(s, targetZone, player).slice(0, 1)
        for (const t of targets) applyAttack(s, player, bg, t, 2, events)
      }
      break
    }
    case 'xiaochu_s2': {
      bg.tempHpBonus += 4
      if (bg.state === 'stunned') {
        bg.state = 'normal'
        bg.recoveryCountdown = 0
        events.push(makeEvent('bg_recover', { bgId: bg.id, wasKO: false }))
      }
      bg.immuneThisTurn = true
      break
    }
    // ── 其阿莫 ──
    case 'qiamo_s1': {
      const targets = params.targetBGIds ?? []
      for (const tid of targets.slice(0, 1)) applyAttack(s, player, bg, s.bgs[tid], 2, events)
      bg.immuneFirstAttack = true
      break
    }
    case 'qiamo_s2': {
      bg.tempHpBonus += 2
      bg.immuneThisTurn = true
      const targets = params.targetBGIds ?? []
      for (const tid of targets.slice(0, 1)) applyAttack(s, player, bg, s.bgs[tid], 3, events)
      clearBrickForce(s, getBrickAreaForZone(bg.zone, player, 'clear'), enemy, events, params.brickSlotIndex)
      break
    }
    // ── 賽菲亞 ──
    case 'saifiya_s1': {
      const targets = params.targetBGIds ?? []
      for (const tid of targets.slice(0, 1)) applyAttack(s, player, bg, s.bgs[tid], 3, events)
      // 非反擊時：移除區域內一個非中繼點建築
      if (!params.isCounterattack) {
        const brickArea = getBrickAreaForZone(bg.zone, player, 'clear')
        const area = s.brickAreas[brickArea]
        const bIdx = area.slots.findIndex(sl => sl.isBuilding && sl.cardId !== 'relay_point')
        if (bIdx >= 0) {
          const removed = area.slots.splice(bIdx, 1)[0]
          s.players[enemy].graveyard.push(removed.cardId)
          events.push(makeEvent('clear_brick', { bgId: bg.id, areaId: brickArea, building: true, destroyed: true }))
        }
      }
      break
    }
    case 'saifiya_s2': {
      bg.tempHpBonus += 1
      bg.attackBonusNextSkill += 2
      bg.directKONextSkill = true
      break
    }
    // ── 鐵火 ──
    case 'tiehuo_s1': {
      const targets = params.targetBGIds ?? []
      for (const tid of targets.slice(0, 1)) {
        const t = s.bgs[tid]
        applyAttack(s, player, bg, t, 2, events)
        // 命中後推向相鄰區
        if (t.state !== 'ko') {
          const pushed = moveToward(t.zone, player)
          if (pushed) {
            t.zone = pushed
            events.push(makeEvent('bg_pushed', { bgId: t.id, to: pushed }))
          }
        }
      }
      break
    }
    case 'tiehuo_s2': {
      const targets = params.targetBGIds ?? []
      for (const tid of targets.slice(0, 2)) applyAttack(s, player, bg, s.bgs[tid], 3, events)
      if (bg.zone === frontZone(player)) doSiege(s, player, bg, events)
      break
    }
    // ── 淺蔥 ──
    case 'qiancong_s1': {
      const targets = params.targetBGIds ?? []
      for (const tid of targets.slice(0, 1)) {
        const t = s.bgs[tid]
        const hpBefore = effectiveHP(t)
        applyAttack(s, player, bg, t, 2, events)
        if (effectiveHP(t) < hpBefore) bg.tempHpBonus += 2
      }
      break
    }
    case 'qiancong_s2': {
      const targets = params.targetBGIds ?? []
      for (let i = 0; i < 3; i++) {
        for (const tid of targets.slice(0, 1)) {
          const t = s.bgs[tid]
          const hpBefore = effectiveHP(t)
          applyAttack(s, player, bg, t, 2, events)
          if (effectiveHP(t) < hpBefore) bg.tempHpBonus += 2
        }
      }
      break
    }
    // ── 普拉斯 ──
    case 'pulasi_s1': {
      const targets = params.targetBGIds ?? []
      for (const tid of targets.slice(0, 2)) applyAttack(s, player, bg, s.bgs[tid], 2, events)
      break
    }
    case 'pulasi_s2': {
      bg.immuneThisTurn = true
      addPendingEffect(s, 1, 'delayed_stun_zone', { zone: bg.zone, attacker: player })
      break
    }
    // ── 艾美拉 ──
    case 'aimela_s1': {
      // 只能攻擊當前區或相鄰區（不跨越2格）
      const validZones = new Set([bg.zone, ...getAdjacentZones(bg.zone)])
      const targets = (params.targetBGIds ?? []).filter(tid => validZones.has(s.bgs[tid]?.zone))
      for (const tid of targets.slice(0, 1)) applyAttack(s, player, bg, s.bgs[tid], 3, events)
      break
    }
    case 'aimela_s2': {
      // 當前區及前方所有區域（敵方方向）
      const zones = getZonesAhead(bg.zone, player)
      for (const z of zones) {
        for (const eb of getEnemyBGsInZone(s, z, player)) {
          applyAttack(s, player, bg, eb, 3, events)
        }
      }
      break
    }
    // ── 津輕 ──
    case 'jingqing_s1': {
      // 任意選 1 位敵 BG（跨區）
      const targets = params.targetBGIds ?? []
      for (const tid of targets.slice(0, 1)) applyAttack(s, player, bg, s.bgs[tid], 2, events)
      break
    }
    case 'jingqing_s2': {
      // 鄰近區 1 位敵 BG 直接暈眩
      const targets = params.targetBGIds ?? []
      for (const tid of targets.slice(0, 1)) {
        const t = s.bgs[tid]
        if (areAdjacent(bg.zone, t.zone) && t.state !== 'ko') {
          triggerStun(s, player, t, events)
        }
      }
      break
    }
    // ── 小紫 ──
    case 'xiaozi_s1': {
      const targets = params.targetBGIds ?? []
      for (const tid of targets.slice(0, 1)) {
        const t = s.bgs[tid]
        const hpBefore = effectiveHP(t)
        applyAttack(s, player, bg, t, 3, events)
        if (effectiveHP(t) < hpBefore) t.cantMoveNextTurn = true
      }
      break
    }
    case 'xiaozi_s2': {
      const enemiesHere = getEnemyBGsInZone(s, bg.zone, player)
      const val = enemiesHere.length === 1 ? 6 : 3
      for (const eb of enemiesHere.slice(0, 3)) applyAttack(s, player, bg, eb, val, events)
      // 1位非自身友軍堅韌+3
      const allyTargets = params.targetBGIds ?? []
      for (const tid of allyTargets.slice(0, 1)) {
        if (tid !== bg.id) s.bgs[tid].tempHpBonus += 3
      }
      break
    }
    // ── 奧莉薇 ──
    case 'aoliwei_s1': {
      addPendingEffect(s, 1, 'delayed_attack', {
        bgId: params.targetBGId, value: 3, attacker: player, attackerBGId: bg.id,
      })
      break
    }
    case 'aoliwei_s2': {
      bg.immuneThisTurn = true
      addPendingEffect(s, 1, 'delayed_zone_attack', { zone: bg.zone, value: 4, attacker: player, attackerBGId: bg.id })
      break
    }
    // ── 派因 ──
    case 'pain_s1': {
      addBrickToZone(s, player, bg.zone, events)
      break
    }
    case 'pain_s2': {
      for (const a of getAllyBGsInZone(s, bg.zone, player)) {
        if (a.state === 'stunned') { a.state = 'normal'; a.recoveryCountdown = 0 }
        a.tempHpBonus += 3
      }
      if (bg.zone === homeZone(player)) repairWall(s, player, 3, events)
      break
    }
    // ── 阿庫雅 ──
    case 'akuya_s1': {
      // 從牌組或墓地取雜魚群體，直接置入磚堆
      const ps = s.players[player]
      const fromDeck = ps.deck.findIndex(id => id === 'mob_group')
      const fromGrave = ps.graveyard.findIndex(id => id === 'mob_group')
      const brickArea = getBrickAreaForZone(bg.zone, player, 'place')
      const area = s.brickAreas[brickArea]
      const noMobYet = !area.slots.some(sl => sl.isBuilding && sl.cardId === 'mob_group')
      if (noMobYet && fromDeck >= 0) {
        ps.deck.splice(fromDeck, 1)
        area.slots.push({ cardId: 'mob_group', isBuilding: true })
        events.push(makeEvent('skill_effect', { bgId: bg.id, detail: '召喚僕人（牌組）' }))
      } else if (noMobYet && fromGrave >= 0) {
        ps.graveyard.splice(fromGrave, 1)
        area.slots.push({ cardId: 'mob_group', isBuilding: true })
        events.push(makeEvent('skill_effect', { bgId: bg.id, detail: '召喚僕人（墓地）' }))
      }
      break
    }
    case 'akuya_s2': {
      bg.immuneThisTurn = true
      addPendingEffect(s, 1, 'delayed_push_enemies', {
        zone: bg.zone, attacker: player, targetDir: enemy, repair: bg.zone === homeZone(player) ? 1 : 0,
      })
      break
    }
    // ── 希洛 ──
    case 'xiluo_s1': {
      addBrickToZone(s, player, bg.zone, events)
      const targets = params.targetBGIds ?? []
      for (const tid of targets.slice(0, 1)) {
        const t = s.bgs[tid]
        const pushed = moveToward(t.zone, enemy)
        if (pushed) { t.zone = pushed; events.push(makeEvent('bg_pushed', { bgId: t.id, to: pushed })) }
        t.cantMoveNextTurn = true
      }
      break
    }
    case 'xiluo_s2': {
      addBrickToZone(s, player, bg.zone, events)
      if (bg.zone === homeZone(player)) repairWall(s, player, 1, events)
      break
    }
    // ── 普倫 ──
    case 'pulun_s1': {
      addBrickToZone(s, player, bg.zone, events)
      break
    }
    case 'pulun_s2': {
      const multiTargets = params.multiTargets ?? []
      for (const mt of multiTargets.slice(0, 3)) {
        if (mt.type === 'bg' && mt.bgId) {
          const t = s.bgs[mt.bgId]
          if (t && t.id !== bg.id) {
            if (t.state === 'stunned') { t.state = 'normal'; t.recoveryCountdown = 0 }
            t.tempHpBonus += 3
          }
        } else if (mt.type === 'repair') {
          repairWall(s, player, 1, events)
        }
      }
      break
    }
    // ── 蜜瓜 ──
    case 'migua_s1': {
      // 最多堆到3層
      const areaId = getBrickAreaForZone(bg.zone, player, 'place')
      const area = s.brickAreas[areaId]
      area.maxSlots = 3  // 臨時允許3層
      addBrickToZone(s, player, bg.zone, events)
      addBrickToZone(s, player, bg.zone, events)
      area.maxSlots = Math.max(area.maxSlots, 3)
      break
    }
    case 'migua_s2': {
      const zones = [bg.zone, ...getAdjacentZones(bg.zone)]
      for (const z of zones) {
        for (const a of getAllyBGsInZone(s, z, player)) {
          if (a.state === 'stunned') { a.state = 'normal'; a.recoveryCountdown = 0 }
          a.tempHpBonus += 3
        }
      }
      if (zones.includes(homeZone(player))) repairWall(s, player, 3, events)
      break
    }
  }
}

// ── 輔助函式 ─────────────────────────────────────

function makeRNG(s: GameState) {
  let seed = s.rngSeed
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0
    s.rngSeed = seed
    return seed / 0x100000000
  }
}

function shuffleArr<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}


function clearBrickForce(s: GameState, areaId: BrickAreaId, defender: PlayerId, events: GameEvent[], slotIndex?: number) {
  const area = s.brickAreas[areaId]
  if (area.slots.length === 0) return

  // 決定目標 slot：指定 slotIndex 優先，否則自動找最後一個非中繼點格
  let slotIdx: number | undefined
  if (slotIndex != null && slotIndex < area.slots.length) {
    const target = area.slots[slotIndex]
    // 指定格若為中繼點，技能不能清（同 DO_CLEAR_BRICK 的限制）
    if (target.isBuilding && target.cardId === 'relay_point') return
    slotIdx = slotIndex
  } else {
    slotIdx = [...area.slots].map((sl, i) => ({ sl, i }))
      .reverse()
      .find(({ sl }) => !(sl.isBuilding && sl.cardId === 'relay_point'))?.i
  }
  if (slotIdx == null) return  // 全是中繼點，不做事

  const slot = area.slots[slotIdx]
  if (slot.isBuilding) {
    const dur = (slot.durability ?? 1) - 1
    if (dur <= 0) {
      area.slots.splice(slotIdx, 1)
      s.players[defender].graveyard.push(slot.cardId)
      events.push(makeEvent('clear_brick', { bgId: 'skill', areaId, building: true, destroyed: true }))
    } else {
      slot.durability = dur
      events.push(makeEvent('clear_brick', { bgId: 'skill', areaId, building: true, destroyed: false }))
    }
  } else {
    area.slots.splice(slotIdx, 1)
    s.players[defender].hand.push(slot.cardId)
    events.push(makeEvent('clear_brick', { bgId: 'skill', areaId }))
  }
}

function doSiege(s: GameState, player: PlayerId, bg: BGInstance, events: GameEvent[]) {
  const enemy = opponentOf(player)
  if (s.cityWalls[enemy] <= 0) {
    s.winner = player
    s.winReason = '攻城成功，敵方城牆已為0'
  } else {
    s.cityWalls[enemy]--
    const rng = makeRNG(s)
    const drawn = drawCard(s.players[enemy], rng)
    if (drawn) events.push(makeEvent('draw_card', { player: enemy, card: drawn }))
    events.push(makeEvent('siege', { attackerId: bg.id, defender: enemy, wallsLeft: s.cityWalls[enemy] }))
    if (s.cityWalls[enemy] === 0) events.push(makeEvent('walls_destroyed', { defender: enemy }))
  }
}

function repairWall(s: GameState, player: PlayerId, amount: number, events: GameEvent[]) {
  const max = 4
  s.cityWalls[player] = Math.min(max, s.cityWalls[player] + amount)
  events.push(makeEvent('repair_wall', { player, amount, wallsNow: s.cityWalls[player] }))
}

function addBrickToZone(s: GameState, player: PlayerId, zone: ZoneId, events: GameEvent[]) {
  const areaId = getBrickAreaForZone(zone, player, 'place')
  const area = s.brickAreas[areaId]
  if (area.slots.filter(s => !s.isBuilding).length >= area.maxSlots) return
  const ps = s.players[player]
  const rng = makeRNG(s)
  if (ps.deck.length === 0) {
    if (ps.graveyard.length === 0) return
    ps.deck = shuffleArr([...ps.graveyard], rng)
    ps.graveyard = []
  }
  const card = ps.deck.pop()
  if (card) {
    area.slots.push({ cardId: card, isBuilding: false })
    events.push(makeEvent('place_brick', { player, areaId }))
  }
}

/** 根據 BG 所在區域，取得對應的磚堆區 ID
 * mode='clear': 清除敵方磚堆時使用
 * mode='place': 放置我方磚堆時使用
 */
function getBrickAreaForZone(zone: ZoneId, player: PlayerId, mode: 'clear' | 'place'): BrickAreaId {
  const enemy = opponentOf(player)
  if (mode === 'clear') {
    if (zone === 'plaza') return `${enemy}_plaza` as BrickAreaId
    if (zone === frontZone(player)) return `${enemy}_base` as BrickAreaId
  } else {
    if (zone === homeZone(player)) return `${player}_base` as BrickAreaId
    if (zone === 'plaza') return `${player}_plaza` as BrickAreaId
  }
  return `${player}_base` as BrickAreaId
}

function getZonesAhead(from: ZoneId, player: PlayerId): ZoneId[] {
  const zones: ZoneId[] = ['p1_base', 'plaza', 'p2_base']
  const idx = zones.indexOf(from)
  const dir = player === 'p1' ? 1 : -1
  const result: ZoneId[] = [from]
  let i = idx + dir
  while (i >= 0 && i < zones.length) {
    result.push(zones[i])
    i += dir
  }
  return result
}

function getAdjacentZones(zone: ZoneId): ZoneId[] {
  const zones: ZoneId[] = ['p1_base', 'plaza', 'p2_base']
  const idx = zones.indexOf(zone)
  const result: ZoneId[] = []
  if (idx > 0) result.push(zones[idx - 1])
  if (idx < zones.length - 1) result.push(zones[idx + 1])
  return result
}

function addPendingEffect(s: GameState, turnsLeft: number, type: string, payload: Record<string, unknown>) {
  s.pendingEffects.push({
    uid: `pe_${++s.pendingEffectCounter}`,
    turnsLeft,
    type,
    payload,
  })
}

function resolvePendingEffect(s: GameState, player: PlayerId, pe: typeof s.pendingEffects[0], events: GameEvent[]) {
  const rng = makeRNG(s)
  switch (pe.type) {
    case 'delayed_attack': {
      const target = s.bgs[pe.payload.bgId as string]
      const attackerBG = s.bgs[pe.payload.attackerBGId as string]
      if (target && target.state !== 'ko') {
        applyAttack(s, pe.payload.attacker as PlayerId, attackerBG, target, pe.payload.value as number, events)
      }
      break
    }
    case 'delayed_zone_attack': {
      const attackerBG = s.bgs[pe.payload.attackerBGId as string]
      for (const eb of getEnemyBGsInZone(s, pe.payload.zone as ZoneId, pe.payload.attacker as PlayerId)) {
        applyAttack(s, pe.payload.attacker as PlayerId, attackerBG, eb, pe.payload.value as number, events)
      }
      break
    }
    case 'delayed_stun_zone': {
      const atk = pe.payload.attacker as PlayerId
      for (const eb of getEnemyBGsInZone(s, pe.payload.zone as ZoneId, atk)) {
        if (eb.state !== 'ko') triggerStun(s, atk, eb, events)
      }
      break
    }
    case 'delayed_siege_and_ko': {
      const atk = pe.payload.player as PlayerId
      const attBG = { id: 'delayed', zone: pe.payload.zone as ZoneId } as BGInstance
      clearBrickForce(s, pe.payload.areaId as BrickAreaId, opponentOf(atk), events)
      clearBrickForce(s, pe.payload.areaId as BrickAreaId, opponentOf(atk), events)
      doSiege(s, atk, attBG, events)
      const target = s.bgs[pe.payload.targetBGId as string]
      if (target && target.state !== 'ko') triggerKO(s, target, events)
      break
    }
    case 'delayed_push_enemies': {
      const atk = pe.payload.attacker as PlayerId
      const enemy = opponentOf(atk)
      for (const eb of getEnemyBGsInZone(s, pe.payload.zone as ZoneId, atk)) {
        eb.zone = homeZone(enemy)
        events.push(makeEvent('bg_pushed', { bgId: eb.id, to: eb.zone }))
      }
      if (pe.payload.repair) repairWall(s, atk, pe.payload.repair as number, events)
      break
    }
  }
}

function applyMobGroupEffect(s: GameState, player: PlayerId, events: GameEvent[]) {
  // 雜魚群體：每個主要階段開始時，對區域內所有敵BG對敵2
  for (const [areaId, area] of Object.entries(s.brickAreas)) {
    const owner = areaId.startsWith('p1') ? 'p1' : 'p2' as PlayerId
    if (owner !== player) continue  // 只看當前玩家的建築
    for (const slot of area.slots) {
      if (!slot.isBuilding || slot.cardId !== 'mob_group') continue
      const zone = areaId.includes('plaza') ? 'plaza' : homeZone(owner)
      const enemies = getEnemyBGsInZone(s, zone as ZoneId, owner)
      const fakeAttacker = { id: 'mob_group', attack: 0, support: 0 } as BGInstance
      for (const eb of enemies) {
        applyAttack(s, owner, fakeAttacker, eb, 2, events)
      }
    }
  }
}

function checkReaction_enemyEnterZone(s: GameState, bg: BGInstance, zone: ZoneId, events: GameEvent[]) {
  // 威嚇反應：敵BG進入此區時觸發
  const enemy = opponentOf(bg.owner)
  for (const defBG of getAllyBGsInZone(s, zone, enemy)) {
    if (defBG.reactionCard === 'intimidate' && defBG.state !== 'ko') {
      // 消耗反應卡（觸發即使用，不可再次觸發）
      defBG.reactionCard = null
      s.players[defBG.owner].graveyard.push('intimidate')
      events.push(makeEvent('reaction_triggered', { reactionId: 'intimidate', bgId: defBG.id, triggerBGId: bg.id }))
      // 前端收到此 event 後要求對方玩家選擇 A/B，然後發送 RESOLVE_REACTION
    }
  }
}

function checkWinCondition(s: GameState) {
  // 城牆為0時，敵方進入主堡區並攻城成功 → 已在 DO_SIEGE 中處理
  // 備援：若有任何一方 BG 在敵方主堡且對方城牆為 0，允許下次攻城時判定
}

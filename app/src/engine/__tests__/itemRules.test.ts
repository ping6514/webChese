import { describe, expect, it } from 'vitest'
import {
  canBuyItemFromDisplay,
  canDiscardItemFromHand,
  createInitialState,
  listItemCards,
  reduce,
} from '../index'

describe('items: hand limit + discard', () => {
  it('item hand full (3) blocks item buy; discarding frees space then buy succeeds', () => {
    const s0 = createInitialState()
    const side = s0.turn.side

    const ids = listItemCards().map((c) => c.id)
    expect(ids.length).toBeGreaterThanOrEqual(4)

    const fullHandState = {
      ...s0,
      limits: {
        ...s0.limits,
        buyItemActionsPerTurn: 2,
      },
      resources: {
        ...s0.resources,
        [side]: {
          ...s0.resources[side],
          gold: 999,
        },
      },
      hands: {
        ...s0.hands,
        [side]: {
          ...s0.hands[side],
          items: [ids[0]!, ids[1]!, ids[2]!],
        },
      },
    }

    const gBlocked = canBuyItemFromDisplay(fullHandState, 0)
    expect(gBlocked.ok).toBe(false)
    if (!gBlocked.ok) expect(gBlocked.reason).toBe('Item hand full (3)')

    const discardId = fullHandState.hands[side].items[0]!
    const gDiscard = canDiscardItemFromHand(fullHandState, discardId)
    expect(gDiscard.ok).toBe(true)

    const rDiscard = reduce(fullHandState, { type: 'DISCARD_ITEM_FROM_HAND', itemId: discardId })
    expect(rDiscard.ok).toBe(true)
    if (!rDiscard.ok) return

    const afterDiscard = rDiscard.state
    expect(afterDiscard.hands[side].items.length).toBe(2)
    expect(afterDiscard.itemDiscard).toContain(discardId)

    // Now buy should be allowed (if the slot has a card)
    const gAllowed = canBuyItemFromDisplay(afterDiscard, 0)
    if (gAllowed.ok) {
      const rBuy = reduce(afterDiscard, { type: 'BUY_ITEM_FROM_DISPLAY', slot: 0 })
      expect(rBuy.ok).toBe(true)
      if (!rBuy.ok) return
      expect(rBuy.state.hands[side].items.length).toBe(3)
    } else {
      // If the slot happened to be empty, reason should reflect that.
      expect(gAllowed.reason).toBe('No item in display')
    }
  })
})

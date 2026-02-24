# WebChese Checklist

## Rules/Engine Alignment
- [x] Default buy action limits: `buySoulActionsPerTurn = 1`, `buyItemActionsPerTurn = 1`
- [x] Revive cost is enforced: `REVIVE` costs **3 gold** (guards + reducer)
- [x] Enemy graveyard soul buy cost stays **3 gold**
- [ ] Default necro action limit matches rulesbook (rulesbook often states base **2** actions; engine currently uses base **1** + Blood Ritual bonus)
- [ ] Turn-start economy matches rulesbook (storage conversion + income)

## Necro: Blood Ritual
- [x] Blood Ritual (B) implemented: king -3 HP, +1 necro action once per turn (`turnFlags.bloodRitualUsed`, `turnFlags.necroBonusActions`)
- [x] Blood Ritual UI confirm modal shows king HP delta

## Item System
- [x] Item discard pile exists in engine state: `state.itemDiscard` (shared)
- [x] `DISCARD_ITEM_FROM_HAND` pushes item id into `state.itemDiscard`
- [ ] Add `USE_ITEM` action and effect resolution
- [ ] After `USE_ITEM`, push used item into `state.itemDiscard`

## Board UX
- [x] Hover invalid move target shows red highlight and tooltip with MOVE guard reason
- [ ] Show shoot feasibility/invalid reason with the same UX pattern

## UI Refactor / State Management
- [x] Shop is consolidated into `ShopModal` (TopBar button + auto-open on buy phase)
- [x] TopBar shows both King HP persistently
- [x] Introduce Pinia for UI state (start with modal open/close; expand to selection/modals)
- [ ] Move UI interaction state into Pinia (selection, pending confirm, shoot preview, card detail modal)

## Docs
- [ ] Keep `docs/engine-notes.md` aligned with implemented UI/engine
- [ ] Keep `象棋桌遊規則NOW.md` aligned with web implementation notes

## Tests
- [x] Update item tests for new default item buy action limit (override `buyItemActionsPerTurn` in test state)
- [ ] Add tests for `REVIVE` gold cost (success + insufficient gold)

## Known Constraints
- [ ] Node.js version: Vite build requires Node 20.19+ (Node 18 will fail `vite build`)

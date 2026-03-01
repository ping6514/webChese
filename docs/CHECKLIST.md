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
- [x] `USE_ITEM_FROM_HAND` action + effect resolution for all 8 items
- [x] After `USE_ITEM_FROM_HAND`, used item pushed into `state.itemDiscard`
- [x] Item use UI: target-unit mode, target-corpse mode, no-target confirm, bone-refine 2-choice UI

## Board UX
- [x] Hover invalid move target shows red highlight and tooltip with MOVE guard reason
- [x] Unified shoot flow: click target enters preview; explicit confirm/cancel
- [x] Multi-target shooting preview is visualized on board (貫/濺/連)
- [x] Draggable shoot action overlay near target (Shoot/Cancel/Shoot Preview)
- [x] Sacrifice action uses a draggable board overlay (disabled + reason), not SidePanel
- [x] Sacrifice overlay auto-hides when a confirm modal is open
- [x] Graveyard panel uses collapsible dropdown lists to avoid overflow
- [x] Ability activation FX: engine emits `ABILITY_TRIGGERED`, UI shows float text + distinct highlight
- [ ] Show shoot feasibility/invalid reason with the same UX pattern

## UI Refactor / State Management
- [x] Shop is consolidated into `ShopModal` (TopBar button + auto-open on buy phase)
- [x] TopBar shows both King HP persistently
- [x] Introduce Pinia for UI state (start with modal open/close; expand to selection/modals)
- [x] Move UI interaction state into Pinia (selection, pending confirm, shoot preview, card detail modal)

## Docs
- [ ] Keep `docs/engine-notes.md` aligned with implemented UI/engine
- [ ] Keep `象棋桌遊規則NOW.md` aligned with web implementation notes

## Localization
- [x] Multi-target board badges + tooltips use Chinese skill hints
- [ ] Localize `ShootPreviewModal` effect text to Chinese (貫通/連鎖/波及...)

## Tests
- [x] Update item tests for new default item buy action limit (override `buyItemActionsPerTurn` in test state)
- [ ] Add tests for `REVIVE` gold cost (success + insufficient gold)

## Online Multiplayer
- [x] Vercel Serverless API: create / join / action / state endpoints
- [x] Supabase PostgreSQL `rooms` table for game state persistence
- [x] Random side assignment (red/black) + first-mover by server on room create
- [x] Hybrid sync adapter: Supabase Realtime + 4s polling fallback
- [x] `_lastEvents` propagation: opponent events decoded as `pollEvents` in client
- [x] `_suppressPollEvents` flag prevents double-processing own events
- [x] Disconnect + localStorage reconnect on page reload
- [x] Clan selection UI on room create (online + local PVP/PVE)
- [x] Side splash on game start shows player colour + enabled clans
- [x] Online gear menu hides developer settings
- [ ] Surrender / resign action
- [ ] Room expiry / cleanup (old rooms linger in Supabase)
- [ ] Spectator / observer mode

## Known Constraints
- [ ] Node.js version: Vite build requires Node 20.19+ (Node 18 will fail `vite build`)

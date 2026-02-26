---
description: Engine/UI notes (WIP)
---

# Dead NecroChess (WebChess) — Engine notes

## 1) High-level architecture

- **Engine**: pure-ish reducer style (**authoritative game state**).
  - `reduce(state, action)` returns `{ ok, state, events }`.
  - Core game rule logic should stay in `app/src/engine/*`.
- **UI**: Vue components + **Pinia UI store** (**authoritative UI/interaction state**).
  - Engine `GameState` stays deterministic and replayable.
  - UI-only state (selection/modals/pending confirms) should live in Pinia (not in `GameState`).
  - UI dispatches engine `Action` to reducer and renders derived state.

## 2) Core state shape (GameState)

Authoritative location: `app/src/engine/state.ts`

Key fields (conceptual):

- **`turn`**
  - `side`: `'red' | 'black'`
  - `phase`: buy/combat/necro/... (phase flow controlled by `NEXT_PHASE`)
  - per-turn flags exist to enforce limits (e.g. per-unit shooting usage)

- **`units: Record<UnitId, Unit>`**
  - Unit has `side`, `base`, `pos`, `hpCurrent`, combat stats, and optional `enchant`.

- **`resources`**
  - By side: `gold`, `mana`, `storageMana`.
  - Resource changes are applied by reducer and emitted as events.

- **`hands`**
  - `hands[side].souls: string[]`
  - `hands[side].items: string[]`

- **`corpsesByPos: Record<"x,y", CorpseEntry[]>`**
  - Corpses are **stackable** per tile.
  - Current rule: corpses **do not retain enchantments**.

- **`graveyard`**
  - `graveyard[side]: string[]` (stores **soul card ids**) 
  - When an enchanted unit dies, the soul goes to graveyard top.

- **Soul shop fields**
  - `soulDeckByBase[base]: string[]` (per base deck, contains soul card ids)
  - `displayByBase[base]: string | null` (one display slot per base)

## 3) Phase flow

Authoritative implementation: `app/src/engine/reduce.ts` (`case 'NEXT_PHASE'`).

### 3.1 Concrete order (as implemented)

`Phase` type: `turnStart | buy | necro | combat | turnEnd`.

Important nuance: **`turnStart` is transient** in current implementation.

The effective player-facing loop is:

`buy -> necro -> combat -> turnEnd -> (swap side + autoTurnStart income) -> buy -> ...`

Implementation details:

- When entering **`turnEnd`**:
  - `autoTurnEnd()` runs immediately (moves all remaining `mana` into `storageMana`).
- When the phase would become **`turnStart`**:
  - reducer first **swaps side**.
  - resets per-turn flags (currently: `turnFlags.shotUsed = {}`)
  - runs `autoTurnStart()` income (storage->gold, +income mana/gold)
  - then immediately sets phase to **`buy`** and emits `PHASE_CHANGED` from `turnStart` to `buy`.

### 3.2 What is allowed in each phase (current rules)

This is the current engine gate + UI expectation; treat it as the source of truth until refactor.

| Phase | Allowed player actions (engine-validated) |
| --- | --- |
| `buy` | `BUY_SOUL_FROM_DECK`, `BUY_SOUL_FROM_DISPLAY`, `BUY_SOUL_FROM_ENEMY_GRAVEYARD`, `NEXT_PHASE` |
| `necro` | `ENCHANT`, `REVIVE`, `BLOOD_RITUAL`, `NEXT_PHASE` |
| `combat` | `MOVE`, `SHOOT`, `NEXT_PHASE` |
| `turnEnd` | `NEXT_PHASE` |
| `turnStart` | (no direct player actions; transient) |

Notes:

- Even if UI doesn't disable a button, reducer checks phase and will return `{ ok: false, error }` if called at the wrong time.
- Per-turn limits (e.g. one shot per unit) are enforced via `turnFlags` and reset during the `turnStart` handling.

## 4) Combat & shooting pipeline

- Legal move highlight: `getLegalMoves(state, unitId)`
- Shootable targets highlight: `getShootableTargetIds(state, unitId)`
  - Must respect effect overrides (e.g. IGNORE_BLOCKING).

Shooting execution uses a "plan" pattern:
- `ShotPlan` is built, then executed.
- On death:
  - corpse is added to `corpsesByPos` (stack)
  - enchanted soul (if any) goes to `graveyard` top
  - unit removed from `units`

UI preview / confirmation (current UX):

- Clicking a shootable enemy **enters shoot preview** (does not immediately dispatch `SHOOT`).
- A draggable, inline overlay menu is rendered near the target cell:
  - `Shoot (Enter)`
  - `Cancel (Esc)`
  - `Shoot Preview` (opens the large modal)
- Multi-target effects are visualized directly on the board during preview:
  - `貫N`: PIERCE collateral hit index
  - `濺`: SPLASH collateral
  - `連?` / `連`: CHAIN eligible/selected extra target
- Clicking an empty cell during preview cancels the preview.

Additional combat UX (implemented):

- Sacrifice uses a **draggable board overlay** (confirm/cancel) and enters a target-selection mode.
- The sacrifice overlay **auto-hides** while a confirm modal is open.

## 5) Effect system (souls/abilities)

- Soul cards live as JSON and are loaded into a registry.
- Effects map card abilities to effect handlers.
- Example implemented ability:
  - `IGNORE_BLOCKING`: can override shooting line-of-sight checks for UI legality and execution.

Notes (current implementation):

- Several Eternal Night mechanics have been migrated from hardcoded soulId checks to ability-driven logic.
- The engine can emit `ABILITY_TRIGGERED` events when an ability actually activates; UI uses it for ability FX.

## 6) Economy / shop / acquisition

Buy phase actions:
- `BUY_SOUL_FROM_DECK` (cost 1G)
- `BUY_SOUL_FROM_DISPLAY` (cost 2G, then refill display from deck)
- `BUY_SOUL_FROM_ENEMY_GRAVEYARD` (cost 3G, buys enemy grave top)

All purchases push the acquired soul id into `hands[currentSide].souls`.

## 7) Necro phase interactions

- `ENCHANT`
  - Apply a soul from hand onto a unit (base must match).
  - Costs gold.
  - Sets `unit.enchant.soulId` and applies stats.

- `REVIVE`
  - Revive top corpse at a position (only if cell is empty).
  - Current rule: revived unit uses base stats only (no auto-enchant).

## 8) UI component map (current)

- `App.vue`
  - app shell, currently renders `<Game />`

- `views/Game.vue`
  - main sandbox UI
  - should stay thin: render + glue code; UI state moves into Pinia UI store

- Components
  - `TopBar.vue`
  - `BoardGrid.vue`
  - `ShootActionOverlay.vue` (draggable inline shoot confirm/cancel menu)
  - (reused) `ShootActionOverlay.vue` is also used for sacrifice menu
  - `HandBar.vue` (wraps HandSouls + HandItems)
  - `ShopModal.vue`
  - `SidePanel.vue` (wraps UnitInfo/CellInfo/Graveyard + last events)
  - `UnitInfoPanel.vue`
  - `CellInfoPanel.vue`
  - `GraveyardPanel.vue`
  - `ConfirmModal.vue`
  - `CardDetailModal.vue`
  - `ShootPreviewModal.vue`
  - `AllUnitsModal.vue`

- Composables (UI glue)
  - `useSelection`
  - `usePendingConfirm`
  - `useShootPreview`
  - `useCardDetailModal`

- Store
  - `stores/ui.ts` (UI-only single source of truth)

## 9) Known TODOs (suggested next)

- Formalize phase enum & flow (document exact order and allowed actions).
- Add tests for:
  - shooting legality (with/without IGNORE_BLOCKING)
  - per-turn/per-unit attack limits
  - shop purchase + refill logic
- Keep Pinia UI store as the home for UI-only state (selection/detail modals/pending confirms/shoot preview), keeping engine `GameState` deterministic.

## 10) Development progress (log)

### 10.1 UI refactor / componentization

- `App.vue` is now a shell that renders `views/Game.vue`.
- `views/Game.vue` is the main sandbox view, and the large UI has been split into components:
  - `TopBar.vue`
  - `BoardGrid.vue`
  - `HandSouls.vue`
  - `HandItems.vue`
  - `HandBar.vue`
  - `ShopModal.vue`
  - `SidePanel.vue`
  - `CellInfoPanel.vue`
  - `UnitInfoPanel.vue`
  - `GraveyardPanel.vue`
  - `ConfirmModal.vue`
  - `CardDetailModal.vue`
  - `ShootPreviewModal.vue`
  - `AllUnitsModal.vue`

### 10.2 Engine guards (single source of truth for UI disabled + reason)

- Engine guard helpers live in `app/src/engine/guards.ts` and are exported via `app/src/engine/index.ts`.
- UI has started consuming guard results (`{ ok, reason }`) to drive:
  - disabled state
  - tooltip/hover reason
- Completed wiring:
  - `ShopModal.vue` buy buttons use engine guard results.
  - `HandSouls.vue` enchant button uses engine guard result.
  - `CellInfoPanel.vue` revive button uses engine guard result.

### 10.5 Shooting UX (preview + multi-target visualization)

- Unified shoot interaction is now preview-first (explicit confirm/cancel).
- Added on-board multi-target visualization for PIERCE/SPLASH/CHAIN with Chinese badges.
- Added `ShootActionOverlay.vue` as a draggable inline menu near the target cell.

### 10.6 Sacrifice UX (board overlay)

- Sacrifice action is presented as a draggable overlay and uses engine guards for disabled + reason.

### 10.7 Ability-triggered FX

- Engine emits `ABILITY_TRIGGERED` for activations (e.g. FREE_SHOOT / IGNORE_BLOCKING / PIERCE).
- UI renders float text + distinct purple/blue cell highlight for ability triggers.

### 10.4 Pinia UI state (UI-only single source of truth)

- Pinia is introduced to store UI-only state (selection/modals/pending confirms).
- Engine `GameState` stays authoritative and deterministic.

### 10.3 Engine tests (Vitest)

- Test runner: Vitest
- Scripts: `npm run test`, `npm run test:watch`
- Current test coverage (minimal, high value invariants):
  - `phaseFlow.test.ts`: `NEXT_PHASE` from `turnEnd` swaps side, runs transient `turnStart`, and auto-enters `buy`.
  - `ignoreBlocking.test.ts`: `IGNORE_BLOCKING` effect can turn a previously blocked rook shot into an allowed shot (after crossing river).
  - `shopBuyRefill.test.ts`: `BUY_SOUL_FROM_DISPLAY` deducts gold, adds to hand, and refills display from deck.

## 11) Upcoming rules (design notes)

### 11.1 Soul hand limit (rulebook: 5)

- Target rule: `hands[side].souls.length <= 5`.
- Proposed flow: when soul hand is full, the player must free a slot before buying a new soul.
- Proposed mechanism: during `buy` phase, allow returning a soul card from hand back to the **bottom** of its base deck.
  - This also supports the idea: “靈魂牌手牌一回合一次，在購買階段可以，返回該兵種牌堆的正下方”.
  - Needs per-turn flag (e.g. `turnFlags.returnSoulUsed`) to enforce “once per turn”.

### 11.2 Item deck + item hand limit (rulebook: 3)

- Target rule: `hands[side].items.length <= 3`.
- Planned: add an item deck and shop purchase entry points (effects can be stubbed initially).
- Proposed difference vs souls: item purchases may be allowed even when item hand is full; extra items are immediately discarded.
  - This implies purchase guard logic differs between souls vs items.

# Game Engine Design (Draft)

## Goal
Implement a deterministic, testable game engine for Dead NecroChess that is UI/network-agnostic.

- The UI (Vue/Pinia) never mutates game state directly.
- All changes happen via `dispatch(action)` into the engine.
- The engine reducer returns `{ ok, state, events }` (or `{ ok: false, error }`).

## Layering
### Layer 0: Board + Units
- Coordinate system: 9x10.
- Base movement rules: King/Advisor/Elephant/Rook/Knight/Cannon/Soldier.
- Occupancy: empty / live unit / corpse marker.

### Layer 1: Combat Resolution
- Shooting line, blocking rules, cannon exception.
- Damage pipeline: (dice) + ATK - DEF, min 1.
- Death pipeline: corpse marker + detach soul card to graveyard top.

### Layer 2: Cards + Effects
- Soul cards override stats and add abilities.
- Item cards are one-shot effects.
- Market/draw is a separate "card flow" subsystem.

## Core Data Model (State)
### Types
- `Side`: `"red" | "black"`
- `Phase`: `"turnStart" | "buy" | "necro" | "combat" | "turnEnd"`
- `PieceBase`: `"king" | "advisor" | "elephant" | "rook" | "knight" | "cannon" | "soldier"`

### Coordinates
- `Pos = { x: 0..8, y: 0..9 }`
- Helpers: `toKey(pos) => string` such as `"x,y"`.

### Unit
- `id: string`
- `side: Side`
- `base: PieceBase`
- `pos: Pos`
- `alive: boolean` (false means removed; avoid if we use corpse markers)
- `hpCurrent: number`
- `enchant?: { soulId: string }`

### Board / Corpse
- Board occupancy derived from units + corpse markers.
- `corpses: Record<string, { side: Side, pos: Pos }>` (key by posKey or corpseId).

### Turn / Resources (can start minimal)
- `turn: { side: Side, phase: Phase }`
- `resources: Record<Side, { gold: number, mana: number, storageMana: number }>`
- `limits: { storageManaMax: 5, goldMax: 15, manaMax: 5 }`

### Cards (can be stubbed in first milestone)
- `graveyard: Record<Side, string[]>` (top at index 0)
- `cage: Record<Side, string[]>` (max 5)
- Market / decks later.

### Per-turn flags
Used to implement "once per turn" limits.
- `flags: Record<Side, Record<string, number | boolean>>`

## Actions (Commands)
All player intents are Actions; engine validates legality.

Minimal set:
- `MOVE { unitId, to }`
- `SHOOT { attackerId, targetUnitId, extraTargetUnitId?: string | null }`
- `END_PHASE {}` / `END_TURN {}`

Later:
- `ENCHANT { unitId, soulId }`
- `REVIVE { corpseId | pos }`
- `BUY_*`, `USE_ITEM_*`

## Engine API
- `reduce(state, action) -> { ok, state, events } | { ok: false, error }`

`deps` includes deterministic services:
- `rng` (optional in MVP)
- `rulesConfig` (costs, caps, etc.)

## Events
Events are for UI/FX/logging; they are derived outputs.
Examples:
- `UNIT_MOVED { unitId, from, to }`
- `DICE_ROLLED { sides: 6, value }`
- `DAMAGE_DEALT { attackerId, targetId, amount }`
- `UNIT_KILLED { unitId, pos }`
- `SOUL_DETACHED { unitId, soulId, to: "graveyardTop" }`

## Hooks (Timing Points)
Effects attach to these hooks.

- `OnTurnStart(side)`
- `OnPhaseStart(phase)` / `OnPhaseEnd(phase)`
- `OnBeforeMove(ctx)` / `OnAfterMove(ctx)`
- `OnBeforeShoot(ctx)` / `OnAfterShoot(ctx)`
- `OnDamageCalculated(ctx)`
- `OnUnitKilled(ctx)`
- `OnKingDamaged(ctx)`
- `AuraRecompute()`

## Extensible Shooting / Attack Pipeline (Recommended)
The rulebook includes many effects that modify targeting rules and/or expand a single shot into multiple hits.
To avoid hardcoding `canShoot` for every new clan/item, model shooting as a pipeline that produces a `ShotPlan`.

### Concepts
- **Targeting**: turn UI intent into a canonical target selection (unit id, cell, direction, etc.).
- **Validation**: check whether the shot is allowed (phase/turn/mana/LOS/range). Effects can *override* or *extend* rules.
- **ShotPlan**: a normalized list of `AttackInstance`s to execute (supports splash/chain/pierce/multi-shot).

### Suggested Types
- `ShootIntent`
  - `{ attackerId, targetUnitId, extraTargetUnitId?: string | null }` (current)
  - later: `{ attackerId, targetPos }` / `{ attackerId, ray }`

- `ShootContext`
  - `state`
  - `attacker`
  - `target` / `targetPos`
  - `cost` (mana)
  - `errors[]` (collectable)

- `ShotPlan`
  - `attackerId`
  - `cost` (mana)
  - `instances: AttackInstance[]`

- `AttackInstance`
  - `kind: 'direct' | 'splash' | 'chain' | 'pierce' | 'counter'`
  - `sourceUnitId`
  - `targetUnitId`
  - `damageProfile: { atkKey, atkValue, dice }` (or ref to attacker stats)
  - `meta` (e.g. hopIndex, pierceIndex)

Implementation note (current codebase):

- `buildShotPlan(...)` constructs a plan and effect handlers can expand it.
- A separate `buildShotPreview(...)` mirrors the plan/effect intent for UI preview (damage + multi-target ids).

### Pipeline Hooks
These hooks should be called in order for each shooting action.

1. `OnBeforeShoot(ctx)`
   - Effects can change:
     - allowed targets
     - range/LOS rules
     - ignore-blocking count
     - cost adjustments
2. `BuildShotPlan(ctx) -> ShotPlan | error`
   - Base rules produce a minimal plan: 1 direct `AttackInstance`.
3. `OnAfterShotPlanBuilt(ctx, plan)`
   - Effects can expand plan:
     - add splash instance(s)
     - add chain hops
     - convert to pierce instances
4. Execute each instance:
   - `OnBeforeDamage(instanceCtx)`
   - `OnDamageCalculated(instanceCtx)`
   - Apply damage
   - `OnAfterDamage(instanceCtx)`
   - If killed: `OnUnitKilled(killCtx)`
5. `OnAfterShoot(ctx, plan)`

### Why this helps your clans
- **暗月影刃**
  - `IGNORE_BLOCKING` / `ignore N blockers` becomes a `OnBeforeShoot` modifier.
  - “越境” triggers are conditions in ctx.
- **冥河焰巫**
  - `CHAIN` / `PIERCE` is implemented by expanding the `ShotPlan` in `OnAfterShotPlanBuilt`.
  - “冥雷(魔防-1)” fits `OnDamageCalculated` (temporary def modifier for this instance).

### Event model implication
To keep UI/network deterministic, prefer emitting events from the plan execution:
- `SHOT_FIRED { attackerId, targetUnitId }`
- `SHOT_PLAN_BUILT { instances: [...] }` (optional for debugging)
- `DICE_ROLLED` (per instance or per action)
- `DAMAGE_DEALT` (per instance)
- `UNIT_KILLED` (per kill)

## Effect System (Template-based)
Avoid arbitrary scripts in MVP. Use a limited set of ability templates.

Examples:
- `CROSS_RIVER_BONUS`
- `IGNORE_BLOCKING { count | all }`
- `MOVE_THEN_SHOOT { perTurn: 1 }`
- `SPLASH { radius: 1, perTurn: 1 }`
- `CHAIN { hops: 1, perTurn: 1 }`
- `PIERCE { count: 2 }`
- `AURA_THRESHOLD { metric: "corpses"|"soldiers"|"clanCount", tiers: [...] }`

## RNG Strategy (Deferred in single-machine MVP)
MVP can use:
- fixed dice value (e.g. 3)
- fixed deck order (no shuffle)

Later:
- seeded RNG in the authority engine (local or server)
- server broadcasts random outcomes as Events.

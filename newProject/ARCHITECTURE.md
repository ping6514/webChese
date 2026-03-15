# 時間地城 — 架構計劃（實作導向）

> 以「能跑的 MVP1」為準繩。凡是「待討論」的，本文件直接給預設值。
> 後續迭代以 PR 修改本文件為準。

---

## 0. 技術棧（沿用幽冥棋）

```
前端：Vue 3 + Vite + TypeScript + Pinia
後端：Vercel Serverless Functions（Node.js / TypeScript）
DB：Supabase PostgreSQL（多人存檔用，MVP1 可先只用 LocalStorage）
引擎：純 TypeScript，Action → Guard → Reduce → Events（與幽冥棋相同模式）
```

**目錄結構（新 repo 或 monorepo 子目錄）：**

```
newGame/
├── app/
│   ├── src/
│   │   ├── engine/          # 核心引擎（pure TS，無 DOM 依賴）
│   │   │   ├── state.ts     # GameState / Unit / Cell 介面
│   │   │   ├── actions.ts   # Action union type
│   │   │   ├── events.ts    # Event union type
│   │   │   ├── guards.ts    # canXxx() → { ok, reason }
│   │   │   ├── reduce.ts    # reduce(state, action) → { state, events }
│   │   │   ├── atb.ts       # ATB 時間軸推進邏輯
│   │   │   ├── ai.ts        # 怪物 AI 決策
│   │   │   └── weapons.ts   # 武器/詞綴 resolve 工具
│   │   ├── data/
│   │   │   ├── monsters/    # 怪物 JSON
│   │   │   ├── weapons/     # 武器基底 JSON
│   │   │   ├── affixes/     # 詞綴 JSON（5 類各一檔）
│   │   │   ├── maps/        # preset 地圖 JSON（5×5）
│   │   │   └── items/       # 消耗品 JSON
│   │   ├── stores/          # Pinia（game.ts, ui.ts）
│   │   ├── components/
│   │   └── views/
│   └── api/                 # Vercel functions（存檔/讀檔）
```

---

## 1. 核心引擎 State 介面

### GameState

```typescript
type GameState = {
  // 地圖
  floor: FloorState

  // 所有單位（玩家 + 怪物）
  units: Record<string, Unit>

  // ATB 時間軸
  timeline: TimelineState

  // 回合旗標（每次某單位行動後重置）
  turnFlags: TurnFlags

  // 跑圖全域狀態
  run: RunState
}
```

### Unit

```typescript
type Unit = {
  id: string
  kind: 'player' | 'monster'

  // 位置
  pos: { x: number; y: number }

  // 基礎數值
  maxHP: number; currentHP: number
  maxSP: number; currentSP: number
  speed: number          // ATB 速度（8–20）
  moveRange: number      // 每次行動可移動格數

  // ATB 狀態
  atb: number            // 0–100，到 100 獲得行動權

  // 武器槽（玩家 3 格，怪物 1–3 格）
  weapons: (WeaponInstance | null)[]

  // 狀態效果
  buffs: BuffInstance[]
  debuffs: DebuffInstance[]

  // 行動鎖
  recoveryRemaining: number   // 硬直剩餘「戳數」
  weaponCooldowns: Record<string, number>  // weaponId → 剩餘 CD 戳數

  // 怪物專用
  ai?: 'chase' | 'patrol' | 'guard'
  monsterType?: string
}
```

### FloorState

```typescript
type CellType =
  | 'floor' | 'wall'
  | 'stairs_up' | 'stairs_down' | 'ramp' | 'cliff_edge'
  | 'recovery'    // 踩到回復 HP/SP/MP
  | 'chest'
  | 'trap'
  | 'mechanism'   // 機關（啟動推進目標 or 連動屏障）
  | 'barrier'     // 機關連動屏障（預設阻擋，機關啟動後開通）
  | 'portal'      // 傳送法陣
  | 'door'        // 門（條件開啟）

type TerrainType =
  | 'normal'
  | 'forest'   // 木元素抗性 +20%，移動讀條 ×1.1
  | 'water'    // 火焰抗性 +20%，水元素抗性 −15%
  | 'rubble'   // 瓦礫（遺跡）：移動讀條 ×1.3
  | 'altar'    // 古祭壇（遺跡）：暗/光元素傷害 +15%

type Cell = {
  id?: string                    // 命名 ID（傳送/機關連動用）
  type: CellType
  height: 0 | 1 | 2             // 低地 / 平地 / 高台
  passable: boolean
  blockLineOfSight: boolean
  terrain: TerrainType
  elementalAura?: {              // 站此格的元素效果
    element: string
    resistMod: number            // 抗性修正（正=提高，負=降低）
    damageMod?: number           // 傷害修正（正=增強）
  }
  condition?: {                  // 機關連動（barrier/door 用）
    mechanismId: string
    defaultPassable: boolean
    activatedPassable: boolean
  }
  teleportTo?: string            // 目標 cell id（portal 用）
  teleportCondition?: 'always' | 'one_way' | 'mechanism_activated'
  content: { monsterId?: string; itemId?: string } | null
}

type FloorState = {
  width: number; height: number  // MVP1 固定 16×16
  cells: Cell[][]                // [y][x]
  seed: string
  floorNumber: number
  pathType: 'safe' | 'trial'    // 安穩 / 試煉路線
  objective: FloorObjective
  theme: 'forest' | 'ruins'     // MVP1 兩主題；大型地城未來支援多主題
}

// ── RunState ──────────────────────────────────────────────
// 一次完整跑圖的全域狀態，與 GameState 分開存放（可 persist 至 LocalStorage）

type RunState = {
  // === 玩家開局設定（不可中途修改）===
  runSeed:    string            // 整趟亂數種子（可手動輸入複現）
  difficulty: number            // 難度係數，1.0 起跳無上限（e.g. 1.0 / 1.5 / 2.0）
  theme:      'forest' | 'ruins' // MVP1 整趟固定，未來大型地城可多主題

  // === 跑圖進度 ===
  floorNumber:     number       // 當前層（1~maxFloors）
  maxFloors:       number       // MVP1 固定 10
  pathHistory:     Array<'safe' | 'trial'>  // 每層的路線選擇紀錄
  trialFloorCount: number       // 已走試煉層數（由 pathHistory 推導，快取用）

  // === 推導係數（引擎計算，唯讀）===
  // dungeonQuality = difficulty × (1 + floorNumber × 0.1)
  // trialRatio     = trialFloorCount / floorNumber
  // lootQuality    = dungeonQuality × (1 + trialRatio × 0.5)
  dungeonQuality: number        // 怪物屬性縮放、裝備詞條 valueExpr 的 dungeonQuality 變數
  lootQuality:    number        // 掉落裝備品質係數

  // === 跑圖結果 ===
  status: 'active' | 'cleared' | 'failed'
}
```

### TimelineState

```typescript
type TimelineState = {
  tick: number          // 全域時間戳記（累積）
  pendingUnitId: string | null   // 目前輪到誰（null = 推進中）
}
```

---

## 2. Action Union Type

```typescript
// ATB 時間推進（系統自動發出，或玩家確認「等待」）
type AdvanceTimeAction  = { type: 'ADVANCE_TIME' }

// 移動
type MoveAction         = { type: 'MOVE'; unitId: string; to: { x: number; y: number } }

// 武器使用（開始讀條）
type QueueWeaponAction  = {
  type: 'QUEUE_WEAPON'
  unitId: string
  weaponSlot: number
  targetPos?: { x: number; y: number }   // 指向目標格
  extraTarget?: string                   // chain 用
}

// 讀條完成，結算傷害/效果
type ResolveCastAction  = { type: 'RESOLVE_CAST'; unitId: string; weaponSlot: number }

// 硬直結束
type ResolveRecoveryAction = { type: 'RESOLVE_RECOVERY'; unitId: string }

// 使用消耗品
type UseItemAction      = { type: 'USE_ITEM'; unitId: string; itemId: string; targetPos?: { x: number; y: number } }

// 拾取掉落物
type PickupLootAction   = { type: 'PICKUP_LOOT'; unitId: string; lootId: string }

// 玩家跳過行動
type EndTurnAction      = { type: 'END_TURN'; unitId: string }

type Action =
  | AdvanceTimeAction | MoveAction | QueueWeaponAction
  | ResolveCastAction | ResolveRecoveryAction
  | UseItemAction | PickupLootAction | EndTurnAction
```

---

## 3. Event Union Type

```typescript
// UI 讀 events 做動畫/音效，不影響 state
type UnitMovedEvent     = { type: 'UNIT_MOVED'; unitId: string; from: Pos; to: Pos }
type CastStartedEvent   = { type: 'CAST_STARTED'; unitId: string; weaponSlot: number; castTime: number }
type DamageDealtEvent   = { type: 'DAMAGE_DEALT'; sourceId: string; targetId: string; amount: number; element: string }
type HealEvent          = { type: 'HEAL'; unitId: string; amount: number; resource: 'hp' | 'sp' }
type BuffAppliedEvent   = { type: 'BUFF_APPLIED'; unitId: string; buffType: string }
type DebuffAppliedEvent = { type: 'DEBUFF_APPLIED'; unitId: string; debuffType: string }
type UnitDiedEvent      = { type: 'UNIT_DIED'; unitId: string }
type LootDroppedEvent   = { type: 'LOOT_DROPPED'; lootId: string; pos: Pos; item: LootItem }
type FloorClearedEvent  = { type: 'FLOOR_CLEARED' }
type ATBReadyEvent      = { type: 'ATB_READY'; unitId: string }

type Event =
  | UnitMovedEvent | CastStartedEvent | DamageDealtEvent
  | HealEvent | BuffAppliedEvent | DebuffAppliedEvent
  | UnitDiedEvent | LootDroppedEvent | FloorClearedEvent | ATBReadyEvent
```

---

## 4. ATB 時間軸（設計決策）

**預設值（不再討論）：**
- 行動後 atb **重置為 0**（不溢出保留，避免複雜度）
- 同時到達 100：玩家 > 怪物；同類別依 id sort（可重現）
- `ADVANCE_TIME` reduce 邏輯：

```typescript
// 每次呼叫找下一個最快到達 100 的單位
// 推進所有單位的 atb += speed × Δt，直到最快的剛好到 100
// 設 timeline.pendingUnitId = 該單位
// 發出 ATB_READY event
```

- 讀條（castTime）與硬直（recoveryTime）都用「戳數」計
- `ADVANCE_TIME` 也同步扣減 `recoveryRemaining` 與 `weaponCooldowns`

---

## 5. 統一被動觸發系統

### 核心設計

被動能力有三個來源，但**格式完全相同**，引擎啟動時合併進同一個監聽池：

| 來源 | 欄位 | 說明 |
|---|---|---|
| 職業 cert | `passives[]` | 角色永久持有 |
| 裝備詞條 | `abilities[]`（含 `trigger`） | 裝備時生效，卸下移除 |
| 怪物定義 | `passiveAbilities[]` | 怪物永久持有 |

### PassiveAbility 格式

```typescript
type PassiveAbility = {
  trigger: 'on_hit'          // 己方命中敵人後
         | 'on_kill'         // 己方擊殺後
         | 'on_damaged'      // 己方受傷後
         | 'on_time'         // 固定間隔（interval ms）
         | 'on_hp_below'     // HP 首次低於閾值（once: true）
         | 'on_floor_clear'  // 清層後
         | 'on_action_used'  // 使用特定 actionTag 的動作後

  condition?: {
    hpBelow?: number         // 0~1 比例
    actionTag?: string       // 限定觸發動作的 tag
    damageType?: string      // 限定傷害類型
  }
  interval?: number          // on_time 專用（ms）
  once?: boolean             // true = 觸發一次後從監聽池移除

  effect: {
    type: 'recover_hp' | 'recover_sp' | 'recover_mp'
        | 'stat_modifier'    // 修改 speed / atkMult 等（通常搭配 once）
        | 'apply_status'     // 施加 buff/debuff
        | 'emit_event'       // 呼叫自定義引擎事件（怪物技能用）
    amount?: number
    // stat_modifier 專用
    speedBonus?: number
    atkMult?: number
    // apply_status 專用
    statusId?: string
    duration?: number
    // emit_event 專用
    eventId?: string
    params?: Record<string, unknown>
  }
}
```

### 三個來源對照範例

```json
// 職業 cert（遊俠）— 命中後回 SP
{ "trigger": "on_hit", "condition": { "actionTag": "物理" },
  "effect": { "type": "recover_sp", "amount": 8 } }

// 裝備詞條（高階護手）— 擊殺後回血
{ "trigger": "on_kill",
  "effect": { "type": "recover_hp", "amount": 15 } }

// 怪物（菁英野狼）— 血量低時狂化
{ "trigger": "on_hp_below", "condition": { "hpBelow": 0.3 }, "once": true,
  "effect": { "type": "stat_modifier", "speedBonus": 4, "atkMult": 1.3 } }
```

### 主動技能 vs 被動的分界

| | 主動技能 | 被動能力 |
|---|---|---|
| 觸發方式 | ATB 充能 → AI/玩家選擇 → 讀條 | 條件監聽，自動觸發 |
| 可被中斷 | 是（蓄力類） | 否 |
| 格式 | 同武器 ActionDef（有 castTime） | PassiveAbility（無 castTime） |
| 來源 | 武器、怪物 skillPool | 職業 cert、裝備詞條、怪物 passiveAbilities |

---

## 6. 裝備穿著條件系統

### Tag 分類

角色身上由**職業 cert** 提供 tags，裝備宣告需要符合幾項才能穿戴：

| 分類 | 範例值 |
|---|---|
| 階級 | `"初階職業"` `"高等職業"` `"傳說職業"` |
| 功能取向 | `"近戰"` `"遠程"` `"物理輸出"` `"魔法輸出"` `"防禦型"` `"支援型"` |
| 特定職業 | `"戰士"` `"狂戰士"` `"遊俠"` `"法師"` `"聖騎士"` … |
| 護甲熟練 | `"重甲"` `"輕甲"` `"布甲"` |

### 裝備穿著條件格式（武器 & 防具通用）

```json
{
  "requiredTags": ["高等職業", "物理輸出", "戰士", "狂戰士", "重甲"],
  "requiredTagCount": 3
}
```

- `requiredTags`：候選 tag 池
- `requiredTagCount`：角色需符合其中幾項才可裝備
  - 普通裝備 → `1`（寬鬆，只要有一項相關特性）
  - 稀有裝備 → `2`
  - 高階裝備 → `3+`（嚴格，需多重身份契合）
- 省略 `requiredTagCount` 時預設為 `1`

### 職業 cert tags 範例

```json
// warrior.json
"tags": ["近戰", "物理輸出", "戰士", "初階職業", "重甲"]

// berserker.json（高等職業，繼承戰士路線）
"tags": ["近戰", "物理輸出", "戰士", "狂戰士", "高等職業", "重甲"]
```

### 護甲材質

防具宣告自身材質，職業 cert 的 `allowedArmorTypes` 宣告可穿材質（陣列，支援多材質）：

```json
// 防具
{ "armorType": "重甲" }

// 職業 cert
{ "allowedArmorTypes": ["重甲"] }               // warrior
{ "allowedArmorTypes": ["輕甲", "布甲"] }        // ranger（未來彈性擴充）
```

裝備詞條的 `usedTags` 使用材質名稱（`"重甲"/"輕甲"/"布甲"`），決定詞條出現在哪類防具的 affix pool 中。

---

## 6. 武器資料模型

### 核心設計原則：武器 = 技能配置集

**一把武器定義了角色的全部攻擊行為。** 不存在多把武器切換或主副手概念。
武器的 slot1~slot5 詞條組合決定了攻擊的元素、模式、特性、動態效果、附魔，
等同於這個角色本回合所有可發動的「技能組合」。

- 玩家在副本外自由更換武器（更換 = 整套技能配置替換）
- 進入副本後武器組合鎖定，不可中途換裝
- 武器上的 `actionId` + `hitMode` 決定攻擊形狀與結算時機（與傷害公式無關）

### WeaponBase（JSON，可掉落的基底）

各職業的基底武器定義在 `data/weapons/bases/` 下（str/agi/int 三類）。

```typescript
type WeaponBase = {
  id: string
  name: string
  requiredTags: string[]      // 穿著條件 tag 池，e.g. ['法師']
  requiredTagCount?: number   // 需符合幾項，省略預設 1
  statScaling: 'STR' | 'AGI' | 'INT'
  atkBase: number             // 基礎傷害係數
  mpCost?: number
  spCost?: number
  castTimeBase: number        // 基準讀條 ms
  recoveryTimeBase: number    // 基準硬直 ms
  actionTags: string[]        // ['物理','即發'] / ['法術','蓄力'] 等

  // 每個槽位的定義：固定值用 Default，隨機池用 Pool，兩者互斥
  slot1Default?: string       // 元素槽（固定）
  slot1Pool?: string[]        // 元素槽（隨機選一）
  slot2Default?: string       // 模式槽（固定）
  slot2Pool?: string[]        // 模式槽（隨機選一）
  slot3Pool?: string[]        // 特性槽（可為空 → 無特性）
  slot4Pool?: string[]        // 動態槽
  slot5Pool?: string[]        // 附魔槽
}
```

### 統一詞條模型（武器詞條 & 裝備詞條）

所有詞條（武器/防具）做同一件事：**往 `FormulaKeySet` 貢獻 `{ key: value }` 對**。
`formula_keys.json` 是 key 名稱的字典（純參考），不是獨立系統。

```typescript
type AffixAbility = {
  key: string              // FormulaKeySet 中的節點名稱
  value: number
  valueExpr?: string       // 含變數的算式，e.g. '5 * dungeonQuality'（覆蓋 value）
  condition?: {            // 不填 = 無條件貢獻；填了 = 只在符合時開通此節點
    damageType?: string    // 攻擊必須含此傷害類型組件，e.g. 'fire' / 'slash'
    actionTag?: string     // 攻擊必須含此 actionTag，e.g. '法術' / '物理' / '蓄力'
    scalingStat?: string   // 武器必須使用此屬性縮放，e.g. 'INT'
  }
}

type AffixDef = {
  id: string
  name: string
  usedTags: string[]       // 武器詞條 → 相容的 actionTags（決定能掛哪類武器）
                           // 裝備詞條 → 相容的護甲類型（'鎧甲'/'皮甲'/'布甲'）
  abilities: AffixAbility[]
  costs?: {                // 武器詞條專用，只在武器有使用對應資源時才套用
    sp_plus?: number;  mp_plus?: number
    cast_time_add?: number;  recovery_time_add?: number;  cooldown_time_add?: number
  }
}
```

**武器詞條 vs 裝備詞條的關鍵差異：**

| | 武器詞條 | 裝備詞條 |
|---|---|---|
| 掛載位置 | 武器本身 | 防具（5 部位） |
| `usedTags` | 決定哪類武器能持有此詞條 | 決定哪類防具能持有此詞條 |
| `condition` | 通常不需要（已在武器上） | **通常必填**，否則任意攻擊都觸發 |

**範例：**
```json
// 武器詞條：劈砍 + 火焰附加（只在劈砍攻擊時產生火焰組件）
{ "id": "wp-fire-slash-01", "usedTags": ["物理"],
  "abilities": [
    { "key": "slash_increase", "value": 0.5 },
    { "key": "fire_base",      "value": 12, "condition": { "damageType": "slash" } }
  ]
}

// 裝備詞條（手套）：火焰增幅 + 法術火焰也爆擊
{ "id": "ar-glove-fire-01", "usedTags": ["皮甲", "布甲"],
  "abilities": [
    { "key": "fire_increase",   "value": 0.2, "condition": { "damageType": "fire" } },
    { "key": "crit_affects_fire","value": 1,  "condition": { "damageType": "fire", "actionTag": "法術" } }
  ]
}
```

### FormulaKeySet 收集流程

```
攻擊觸發
  → 確定本次攻擊屬性（damageTypes[], actionTags[], scalingStat）
  → 遍歷所有已裝備詞條的 abilities：
      有 condition → 逐欄檢查是否符合本次攻擊屬性
      符合 / 無 condition → FormulaKeySet[key] += value
  → 傷害模組讀取 FormulaKeySet 計算 DamageProfile
```

### 傷害計算（DamageComponent[]）

```typescript
// 每次攻擊拆成若干組件，每組件獨立跑抗性公式後加總
type DamageComponent = {
  type: DamageType     // 'slash'|'crush'|'pierce'|'fire'|'water'|'wood'|'light'|'dark'
  amount: number
  canCrit: boolean
}

// 組件來源：
// 主組件 → type = slot1元素，amount = atkBase × stat × base_multiplier × (1+[type]_increase) + [type]_damage_plus
// 附加組件 → 每個 [type]_base > 0 時產生，amount = [type]_base × (1+[type]_increase)

// 爆擊判定（一次性）：
// critChance = min(0.95, base_crit + crit_chance_add + LCK × lck_crit_mult)
// isCrit → 主組件 × crit_damage_mult；附加組件看 crit_affects_[type] 是否開通

// 最終傷害（每組件）：
// max(1, amount × (1 − target.resistance[type]) − target.defense[type])
```

**裝備詞條 slot 偏向：** head→抗性% / chest→防禦flat+hp / gloves→傷害增幅 / legs→屬性+消耗品格 / boots→移動地形

### WeaponInstance（持有中的武器實例）

每把掉落的武器是獨立實例，在定義基礎上加一層 `overwrite` 允許個體差異：

```typescript
type AppliedAffix = {
  id: string                  // 對應 weapon_affixes.json 中的 id
  overwrite?: {               // 個體差異覆蓋層（可選）
    abilities?: Record<string, number | string>   // key → 覆蓋值
    costs?: Partial<{
      sp_plus: number; mp_plus: number
      cast_time_add: number; recovery_time_add: number; cooldown_time_add: number
    }>
  }
}

type WeaponInstance = {
  idHash: string              // "{baseId}-{timestamp}-{dungeonSeed}-{random}"
  baseId: string              // 對應 WeaponBase id
  appliedAffixes: AppliedAffix[]   // 依 slot1~slot5 順序（可為 null）
  // resolveWeapon() 計算後的實際數值快照（供 UI 顯示與引擎讀取）
  resolved: {
    name: string
    actionTags: string[]
    atkFinal: number
    spCostFinal?: number
    mpCostFinal?: number
    castTimeFinal: number
    recoveryTimeFinal: number
    element: string           // slot1 結果
    attackMode: string        // slot2 結果
    enchant: string | null    // slot5 結果
  }
}
```

**resolveWeapon 計算順序**：
1. 從 base 取 `castTimeBase`、`recoveryTimeBase`、`atkBase`
2. 依序 apply `appliedAffixes`（先讀 def abilities，再用 overwrite 覆蓋對應 key）
3. formula_keys 中 `base_multiplier` 乘上 `atkBase` → `atkFinal`
4. costs 只在 base 有使用對應資源（sp/mp）時才累加
5. 快照寫入 `resolved`

---

## 7. 攻擊動作系統（ActionDef）

### 核心原則

「攻擊動作」決定**打到哪些格子**，與傷害計算（FormulaKeySet）和被動觸發（PassiveAbility）完全無關。
三個層次分工：

| 層次 | 職責 | 資料來源 |
|---|---|---|
| ActionDef | 目標格選取（範圍形狀、距離） | `data/actions/` |
| FormulaKeySet | 傷害數值計算 | weapon/armor affixes |
| PassiveAbility | 條件觸發效果 | cert passives、裝備詞條、怪物 passives |

### ActionDef 型別

```typescript
type ActionShape =
  | 'single'         // 單體：指定一個目標格
  | 'line'           // 直線穿透：施法者→目標方向延伸，可貫穿
  | 'cone'           // 扇形：施法者前方角度範圍
  | 'burst'          // 爆發：以施法者本身為圓心
  | 'circle'         // 圓形落點：以目標格為圓心
  | 'ranged_single'  // 遠程單體：指定遠處一個目標格
  | 'ranged_circle'  // 遠程落地：指定遠處落點，圓形範圍

type ActionDef = {
  id: string
  name: string
  shape: ActionShape
  range: number                  // 最大作用距離（格數）；burst 類以施法者為圓心可省略
  radius?: number                // circle / burst / ranged_circle 的爆炸半徑（格）
  angle?: number                 // cone 的角度（度），預設 90
  pierce?: boolean               // line 是否貫穿多個目標，預設 false
  isProjectile?: boolean         // 飛行物：受障礙物視線規則限制，預設 false
  requiresLineOfSight?: boolean  // 需要視線，預設跟隨 isProjectile
  targetFilter:
    | 'enemy'        // 只能選敵方單位
    | 'ally'         // 只能選友方單位
    | 'any_unit'     // 任何單位
    | 'cell'         // 空地（召喚/放置效果用）
  heightRule?:
    | 'any'                    // 無高度限制（預設）
    | 'above_can_hit_below'    // 高台可打低地，反之不行
    | 'same_only'              // 僅同高度目標
}
```

### HitMode — 傷害結算時機

`ActionDef` 決定「哪些格子被框住」，`HitMode` 決定「框住後如何結算」。兩者正交組合。

```typescript
type HitMode =
  | {
      type: 'instant'
      // 讀條完成 → 對讀條開始時鎖定的格子立即結算
      // 目標移走後格子仍結算（打空地 = 無效），不重新追蹤
      // 用途：大多數標準攻擊、瞬發法術
    }
  | {
      type: 'delayed'
      delay: number          // ms，讀條完成後再等多久才結算
      showWarning: boolean   // 預警顯示（建議 true，讓玩家能看到警告格）
      // 讀條開始時鎖定格子；delay 期間玩家可以走開，走開就不受傷
      // 用途：Boss 電報技、範圍落地攻擊、定時炸彈
    }
  | {
      type: 'check_at_resolve'
      // 讀條完成時重新判斷：目標單位是否仍在 ActionDef 定義的射程內
      // 若目標已離開射程 → miss（無傷害）
      // 若仍在射程 → 結算（以目標當前位置，不是讀條開始時的格子）
      // 用途：精準狙擊、需要玩家「站樁」才能被打中的強攻
    }
  | {
      type: 'persistent_zone'
      duration: number       // ms（-1 = 永久直到被觸發或清除）
      triggerOn: 'step_on' | 'interval' | 'both'
      intervalMs?: number    // interval / both 模式專用
      maxTriggers?: number   // 最多觸發幾次（省略 = 無限，直到 duration 到期）
      // 讀條完成 → 在目標格放置持久傷害物件（HazardObject，屬於 FloorState）
      // 用途：毒池、火焰地板、陷阱格、魔法法陣、障礙牆
    }
  | {
      type: 'projectile'
      speedCellsPerSec: number  // 視覺移動速度（格/秒，僅影響動畫，不影響回合時序）
      piercing: boolean          // false = 碰到第一個目標或牆後消失；true = 貫穿
      // 讀條完成 → 發射飛行物件，沿路徑移動；以命中時的目標格結算
      // 與 ActionDef.isProjectile 的差異：
      //   isProjectile = 是否受視線遮擋（幾何判斷）
      //   hitMode.projectile = 攻擊是否有「飛行物件」移動過程（時序+貫穿）
      // 用途：箭矢、魔法彈、投矛、吐絲
    }
```

**五種模式對比：**

| HitMode | 目標格鎖定時間 | 可迴避 | 產生物件 |
|---|---|---|---|
| `instant` | 讀條開始 | 否 | 否 |
| `delayed` | 讀條開始 | 是（離開預警格）| 否（暫時預警格） |
| `check_at_resolve` | 讀條完成 | 是（離開射程）| 否 |
| `persistent_zone` | 讀條完成 | 是（不踩/等 duration）| 是（HazardObject）|
| `projectile` | 讀條完成 | 是（離開路徑）| 是（飛行物件）|

`HitMode` 放在**武器/技能定義**上（不在 ActionDef），因為同一個形狀可以有不同的結算方式。

### 武器如何引用

武器 JSON（`WeaponBase` 或怪物 weapon inline）新增 `actionId` + `hitMode` 欄位：

```json
{
  "id": "wolf_fang",
  "actionId": "single_melee",
  "hitMode": { "type": "instant" },
  "slot1": "slash",
  ...
}
```

技能（`skillPool` 條目）同樣使用 `actionId` + `hitMode`：

```json
{
  "id": "howl_aoe_slow",
  "actionId": "burst",
  "actionOverride": { "radius": 4 },
  "hitMode": { "type": "instant" }
},
{
  "id": "guardian_charge",
  "actionId": "line_pierce",
  "hitMode": { "type": "check_at_resolve" }
},
{
  "id": "vine_entangle",
  "actionId": "circle_small",
  "hitMode": {
    "type": "persistent_zone",
    "duration": 4000,
    "triggerOn": "step_on",
    "maxTriggers": 1
  }
}
```

### 預設動作 ID 一覽

| id | 形狀 | range | 備註 |
|---|---|---|---|
| `single_melee` | single | 1 | 標準近戰單體 |
| `single_melee_reach` | single | 2 | 延伸近戰（長柄武器） |
| `frontal_sweep` | cone | 1 | 前方 90° 扇掃（劍） |
| `line_pierce` | line | 3 | 直線穿透（槍、長矛） |
| `burst_small` | burst | — | 以施法者為圓心 r=1 |
| `burst_medium` | burst | — | 以施法者為圓心 r=2 |
| `ranged_single` | ranged_single | 6 | 遠程指向單體（弓） |
| `ranged_aoe` | ranged_circle | 5 | 遠程落地圓形 r=1 |
| `aoe_large` | circle | — | 以目標格為圓心 r=2 |

攻擊動作定義存放於 `data/actions/melee_actions.json` 與 `data/actions/ranged_actions.json`。

---

## 8. 地圖生成策略

### 普通層 vs Boss 層

| 層類型 | 生成方式 | 來源 |
|---|---|---|
| 普通層（safe/trial）| 主題房間模板拼接（程序生成） | `data/maps/{theme}/rooms/` |
| Boss 層 | 固定劇本地圖（hand-crafted） | `data/maps/{theme}/boss/` |

### Boss 地圖劇本（mapScript）

每個 Boss 綁定自己的專屬地圖劇本，由 spawner 的 `mapScript` 欄位指定：

```json
// forest_guardian_spawner.json（片段）
{
  "monsterId": "forest_guardian",
  "mapScript": "forest_guardian_arena",
  "boss": { ... }
}
```

劇本 JSON 格式（`data/maps/forest/boss/forest_guardian_arena.json`）：

```typescript
type BossMapScript = {
  id: string
  bossId: string              // 對應的 Boss monsterId
  size: { width: number; height: number }
  terrain: TerrainType        // 整體底層地形
  cells: CellOverride[]       // 非預設格子（牆 / 障礙 / 特殊地形 / 機關）
  spawnPoints: {
    boss: Pos
    players: Pos[]
    reinforcementZones?: Pos[]  // 援軍出現區域
  }
  events?: MapEvent[]
}

type MapEvent = {
  trigger: 'on_enter' | 'boss_hp_below' | 'phase_change'
  threshold?: number          // boss_hp_below 專用
  effect:
    | { type: 'spawn_monster'; monsterId: string; positions: Pos[] }
    | { type: 'change_terrain'; positions: Pos[]; newTerrain: TerrainType }
    | { type: 'emit_event'; eventId: string }
}
```

### 隨機 Boss 選擇流程（未來多 Boss 時適用）

```
到達 Boss 層
  → 從主題設定的 bossPool[] 隨機選一個 Boss id
  → 讀對應 spawner.mapScript → 載入 BossMapScript
  → 按 spawner.boss tier 生成 Boss 實例
  → 開始戰鬥
```

MVP1 每個主題一個 Boss（`bossPool` 長度 = 1），架構保留擴充性，不改設計就能新增。

### 目錄結構

```
data/maps/
  forest/
    rooms/             ← 普通層房間模板（程序生成拼接用）
    boss/
      forest_guardian_arena.json
  ruins/
    rooms/
    boss/
```

---

## 9. MVP1 範圍邊界（硬鎖定）

### ✅ 做

- 5×5 格子地圖（3–5 張 preset JSON）
- 玩家單位 1 名，武器槽 3 格
- 怪物 3 種（數值 + AI：chase / guard / patrol）
- ATB 時間軸（單人，怪物回合自動執行）
- 武器系統：基底 4 種 × 各類詞綴 4–5 個
- 傷害結算（物理/魔法，無命中率）
- Buff/Debuff：燒傷（DoT）、減速、腿軟（禁移）、凍結（禁行動）
- 掉落：武器（基底 + 隨機詞綴）、金幣、HP 小藥水
- LocalStorage 存檔（地城狀態 + inventory）
- 地城結算畫面（帶走全部，失敗帶走 50% 金幣）

### ❌ 不做（MVP1 後）

- 多人連線
- 村莊（只有「進地城」按鈕）
- 裝備槽（頭/衣/鞋等）
- 命中率/抵抗系統
- 地圖生成演算法（preset 就好）
- Boss 特殊技能
- 碎片經濟/重 roll 詞綴

---

## 10. 開發順序

```
Phase 1 — 引擎骨架（無 UI）
  ✦ state.ts / actions.ts / events.ts 型別
  ✦ atb.ts：ADVANCE_TIME reduce
  ✦ 基本 MOVE reduce + guard（格子可走判定）
  ✦ Vitest 測試：ATB 推進、移動合法性

Phase 2 — 武器戰鬥
  ✦ weapons.ts：resolveWeapon()
  ✦ QUEUE_WEAPON + RESOLVE_CAST reduce
  ✦ 傷害計算（含 buff/debuff）
  ✦ 怪物 AI（chase 先做）
  ✦ 測試：武器流程、傷害、AI 一回合

Phase 3 — 地圖 + UI 骨架
  ✦ preset 地圖 JSON × 3
  ✦ GridView 組件（5×5 格子 + 單位顯示）
  ✦ ATB 條顯示
  ✦ 武器選擇 + 目標選擇 UI

Phase 4 — 掉落 + 存檔
  ✦ LootSystem（seed RNG）
  ✦ Inventory UI
  ✦ LocalStorage 存檔/讀檔
  ✦ 結算畫面（通關/失敗）

Phase 5 — 打磨
  ✦ 3 種怪物 + AI 調整
  ✦ 詞綴池擴充
  ✦ 平衡調整（數值）
```

---

## 11. 待定資料（需要在 Phase 2 前填完）

這些是**內容數值**，不影響架構，需要另建文件定義：

| 項目 | 文件 |
|------|------|
| 3 種怪物數值表 | `data/monsters/README.md` |
| 4 種武器基底 | `data/weapons/bases.json` |
| 各類詞綴清單（各 4–5 個） | `data/affixes/*.json` |
| 消耗品清單（HP/SP 藥水） | `data/items/consumables.json` |
| preset 地圖 × 3 | `data/maps/*.json` |

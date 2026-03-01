# 幽冥棋 — 大型 Clean Code 計畫

> 審計日期：2026-03-01
> 專案狀態：1.0 MVP 完成（線上對戰 + 四氏族 + 道具系統）
> 目標：在不改動任何遊戲邏輯與規則的前提下，提升可維護性與可讀性

---

## 整體問題摘要

| 問題類型 | 嚴重度 | 主要對象 |
|---|---|---|
| 超大檔案（>400行） | 🔴 高 | Game.vue (2234行), reduce.ts (1276行), BoardCell.vue (832行) |
| 巢狀 switch/case | 🟡 中 | reduce.ts：NEXT_PHASE 5層、USE_ITEM_FROM_HAND 16層 |
| 重複 FX 樣板程式碼 | 🟡 中 | Game.vue：float text 建立/清除樣板出現 8+ 次 |
| 魔法數字/硬編碼常數 | 🟡 中 | reduce.ts (9999, 4, 3)、FX 延遲 (520ms, 780ms 等) |
| UI 重複片段 | 🟡 中 | Home.vue 氏族選擇器出現 2 次（線上/本機） |
| CSS 重複規則 | 🟠 低 | BoardCell.vue badge 樣式 3 組，結構完全相同 |

---

## Phase 1：引擎層重構（風險低，影響廣）

### ✅ 1-A｜`gameConfig.ts` 新增魔法常數

**目的**：消滅引擎中散落的硬編碼數值，讓調整數值只需改一個地方。

**要加入的常數**：

```ts
// 目前散落在 reduce.ts 的魔法數字
FREE_SHOOT_MANA_BOOST: 9999       // SHOOT free-shoot 暫時最大魔力值
HOLY_GRAIL_HEAL_AMOUNT: 4         // 靈血聖杯回血量
DEATH_CHAIN_MAX_CORPSE_KILLS: 3   // 死亡連鎖最多殺死 3 個屍骸
REVIVE_COST: 3                    // 復活費用（已有但確認集中）
```

**影響檔案**：`engine/gameConfig.ts`、`engine/reduce.ts`

---

### 1-B｜`reduce.ts` 拆分 — 道具子 reducer

**目的**：將 `USE_ITEM_FROM_HAND` 的 16 個 case 從 reduce.ts 移出，建立獨立檔案。

**新檔案**：`engine/itemReducers.ts`

**結構**：
```ts
// engine/itemReducers.ts
export type ItemReducerArgs = {
  state: GameState
  action: UseItemFromHandAction
  side: Side
}

export function reduceUseItem(state: GameState, action: UseItemFromHandAction): ReduceResult {
  switch (action.itemId) {
    case 'item_lingxue_holy_grail': return reduceHolyGrail(state, action)
    case 'item_bone_refine':        return reduceBoneRefine(state, action)
    // ... 其他 14 個
  }
}
```

**reduce.ts 的 USE_ITEM_FROM_HAND case 改成一行**：
```ts
case 'USE_ITEM_FROM_HAND': return reduceUseItem(state, action)
```

**影響檔案**：`engine/reduce.ts`（刪除 ~230 行）、新增 `engine/itemReducers.ts`

---

### ✅ 1-C｜`reduce.ts` 拆分 — 回合相位轉換

**目的**：將 `NEXT_PHASE` 的五層巢狀 case 移至獨立函數，提升可讀性。

**新函數（放在 reduce.ts 內或獨立檔案）**：
```ts
function reduceNextPhase(state: GameState): ReduceResult { ... }
```

**影響檔案**：`engine/reduce.ts`（移出 ~100 行）

---

### ✅ 1-D｜`shotPlan.ts` — 優先度 map 移至 `gameConfig.ts`

**目前**（shotPlan.ts 第 56-62 行）：
```ts
const instancePriority: Record<string, number> = {
  direct: 0, chain: 1, splash: 2, pierce: 3, counter: 4,
}
```

**改為**：從 `gameConfig.ts` 引用 `SHOT_INSTANCE_PRIORITY`

**影響檔案**：`engine/shotPlan.ts`、`engine/gameConfig.ts`

---

## Phase 2：UI Composable 拆分（Game.vue 減肥）

Game.vue 目前 **2234 行**，是整個專案最大的維護風險。
拆分原則：**不改任何遊戲邏輯**，只移動程式碼到 composable 檔案。

### 2-A｜`composables/useGameEffects.ts`（最高優先）

**目的**：將 FX 系統（float text、beam、unit highlight）的重複樣板全部集中。

**目前問題**：Game.vue 中以下樣板出現 8+ 次：
```ts
const id = `${Date.now()}-${Math.random()}`
floatTextsByPos.value = { ...floatTextsByPos.value, [key]: [...cur, item] }
window.setTimeout(() => { /* 清除 */ }, 780)
```

**新 composable 提供的 API**：
```ts
const {
  floatTextsByPos,
  fxHitUnitIds,
  fxBeams,
  fxSpecialUnitIds,
  addFloatText,      // addFloatText(posKey, text, kind, durationMs?)
  addHitFx,          // addHitFx(unitId, durationMs?)
  addBeam,           // addBeam(from, to, kind, durationMs?)
  addSpecialFx,      // addSpecialFx(unitId, durationMs?)
} = useGameEffects()
```

**FX 延遲常數**（目前魔法數字）：
```ts
// 集中在 composable 頂部
const FX_HIT_MS = 520
const FX_FLOAT_MS = 780
const FX_BEAM_MS = 820
const FX_SPECIAL_MS = 620
```

**預計 Game.vue 減少行數**：約 200-250 行

---

### 2-B｜`composables/useGameDispatch.ts`

**目的**：將 `dispatch()`、`dispatchOnline()`、`processEvents()` 移出 Game.vue。

**目前散落位置**：
- `processEvents()` — 約 180 行（lines 1049-1228）
- `dispatch()` / `dispatchOnline()` — 約 80 行（lines 1230-1268）
- `eventToText()` — 約 60 行

**新 composable**：
```ts
export function useGameDispatch(
  state: Ref<GameState>,
  effects: ReturnType<typeof useGameEffects>,
  conn: ReturnType<typeof useConnection>,
  setup: ReturnType<typeof useGameSetup>,
) {
  const eventLog = ref<string[]>([])

  function processEvents(events: Event[], nextState: GameState) { ... }
  async function dispatch(action: Action) { ... }

  return { dispatch, eventLog, onlineWaiting }
}
```

**預計 Game.vue 減少行數**：約 320-360 行

---

### 2-C｜`composables/useInteractionMode.ts`

**目的**：將 enchant/sacrifice/item 目標選擇的交互模式處理集中。

**目前問題**：Game.vue 的 `onCellClick()` 和 `onUseItem()` 中有多個 `if (ui.interactionMode.kind === ...)` 分支，混雜著不同操作的邏輯。

**新 composable 提供**：
```ts
const {
  onCellClick,
  onUseItem,
  onBoneRefineChoiceConfirm,
  boneRefineChoicePos,
} = useInteractionMode(state, dispatch)
```

**預計 Game.vue 減少行數**：約 150-200 行

---

### 2-D｜`composables/useActiveBuffs.ts`

**目的**：將 `activeBuffs` computed 屬性（目前 ~75 行）移出，讓 Game.vue 不負責業務邏輯計算。

**目前狀況**（lines 523-597）：
- 遍歷所有己方單位
- 逐一判斷 12+ 種 ability type
- 累積 buff 清單用於 TopBar 顯示

**新 composable**：
```ts
export function useActiveBuffs(state: Ref<GameState>, side: Ref<Side>) {
  const activeBuffs = computed(() => computeBuffsForSide(state.value, side.value))
  return { activeBuffs }
}
```

**預計 Game.vue 減少行數**：約 75-90 行

---

### 拆分後 Game.vue 預期行數

| 移出內容 | 預計減少行數 |
|---|---|
| useGameEffects（FX樣板） | ~230行 |
| useGameDispatch（dispatch + processEvents + eventToText） | ~350行 |
| useInteractionMode（onCellClick + onUseItem） | ~175行 |
| useActiveBuffs | ~80行 |
| **合計** | **~835行** |

**目標：Game.vue 從 2234 行縮減至約 1400 行**（再進一步可抽元件）

---

## Phase 3：元件層重構（UI 重複消除）

### 3-A｜新增 `<ClanSelector />` 元件

**目前問題**：Home.vue 中氏族選擇器出現 2 次（線上建房 / 本機開局），程式碼完全相同。

**新元件** `components/ClanSelector.vue`：
```vue
<ClanSelector
  :selected="selectedClans"
  @toggle="toggleClan"
/>
```

**影響**：Home.vue 減少 ~24 行重複，且未來新增選擇器模式只改一個地方。

---

### ✅ 3-B｜`BoardCell.vue` badge CSS 統一

**目前問題**：pierceBadge / splashBadge / chainBadge 三組 CSS 結構完全相同，各約 14 行。

**改法**：提取共用 `.attackBadge` 基礎 class，各 badge 只覆蓋 `--badge-color` CSS 變數。

**影響**：BoardCell.vue CSS 減少 ~28 行。

---

### ✅ 3-D｜`UnitListPanel.vue` 陣亡單位定位按鈕修復（Bug Fix）

**問題描述**：
- 陣亡單位列（`.unitRow.dead`）套用 `opacity: 0.4`，整行包含 📍 按鈕全部半透明，**視覺上看起來不可互動**
- `infoCell`（名字/HP 區）點擊死亡單位時，`showUnitDetail()` 直接 `return`，讓用戶以為整列都不能按
- 按鈕的確有發出 `select-cell` 事件（ID 格式 `dead:x,y:stackIndex`），Game.vue 的 `selectCellFromUnits()` 也有對應處理，但用戶感知不到按鈕可用

**修復清單**：

**① `UnitListPanel.vue` — 視覺分離**
```css
/* 目前：整行 opacity 0.4，按鈕也跟著暗 */
.unitRow.dead { opacity: 0.4; }

/* 改為：只讓 infoCell/imgCell 半透明，locateBtn 保持完整亮度 */
.unitRow.dead .imgCell,
.unitRow.dead .infoCell { opacity: 0.45; }
.unitRow.dead .locateBtn { opacity: 1; }  /* 明確保持可見 */
```

**② `UnitListPanel.vue` — Dead 按鈕專屬視覺**：
- 死亡單位的 `locateBtn`：改圖示為 🪦 或 📍（加上骨頭標記）
- hover 顏色改為橘色系（`rgba(255, 165, 0, 0.2)`）以區分「定位屍骸」與「定位活單位」
- `title` 維持現有的「選擇屍骸格（可執行復活）」

**③ `Game.vue` — `showUnitDetail()` 支援屍骸**：
- 目前對 `dead:x,y:i` 格式 unitId 直接 return（因為 `state.value.units[unitId]` 是 undefined）
- 改為：若 unitId 以 `dead:` 開頭，從 `corpsesByPos` 找到對應屍骸資料，顯示簡易詳情（基底兵種、位置）

```ts
function showUnitDetail(unitId: string) {
  if (unitId.startsWith('dead:')) {
    // 解析 dead:x,y:stackIndex，從 corpsesByPos 取屍骸資料顯示
    // ...
    return
  }
  const u = state.value.units[unitId]
  // ... 現有邏輯不變
}
```

**影響檔案**：`components/UnitListPanel.vue`（CSS + template）、`views/Game.vue`（showUnitDetail）

---

### ✅ 3-E｜射擊相關 UI 補上基礎棋子圖片（Bug Fix）

**問題描述**：
- 射擊目標確認（`ShootPreviewModal`）或射擊結算時，未附魔（無 `enchant.image`）的單位顯示區塊**空白或只顯示文字代碼**，沒有兵種圖示
- 基礎棋子圖（車/馬/砲/卒/仕/象/帥）應做為 fallback，與 `UnitListPanel` 的 `.unitImgEmpty` 邏輯對齊

**修復方向**：

① 確認 `ShootPreviewModal.vue` 中攻擊方/目標的 unit 圖片顯示邏輯
- 若 `unit.image` 不存在 → fallback 顯示兵種漢字（帥/車/馬/砲/卒/仕/象），與 `UnitListPanel.unitImgEmpty` 一致
- 確認 template 中圖片的 `v-if` / `v-else` 分支完整

② 確認 `DamageFormulaToast.vue`（Phase 5-F 新元件）一開始就套用相同 fallback pattern，避免重複出現此問題

**影響檔案**：`components/ShootPreviewModal.vue`（優先）、Phase 5-F 新元件設計規範

---

### 3-C｜考慮將 BoardCell 邏輯移入 BoardGrid

**目前問題**：BoardCell.vue 有 832 行，主要是 computed props + template + CSS。

**選項 A（建議）**：不做完全合併，只將 BoardCell 的 computed 邏輯（依賴 Game.vue 傳下來的 props）整理為更清楚的 props interface，減少 prop drilling。

**選項 B**：將 BoardCell 拆成 `BoardCellBase.vue`（純顯示）+ `BoardCellLogic.vue`（互動），使用 render prop / slot 模式。

---

## Phase 4：測試補強

### 4-A｜引擎新增缺口測試

根據審計報告，目前引擎測試覆蓋良好但有以下缺口：

- [ ] `REVIVE` 費用驗證（金幣不足應失敗）— 已在 CHECKLIST.md 標記
- [ ] `USE_ITEM_FROM_HAND` 各道具成功路徑（現有 itemRules.test.ts 僅測部分）
- [ ] 鐵衛氏族 `iron_guard` 的 ability 測試（目前只有 dark_moon/styx/eternal_night 有獨立測試）
- [ ] `NEXT_PHASE` 的完整相位流程（buy → necro → combat → turnEnd → 自動進下一回合）

### 4-B｜新增 `iron_guard` 氏族測試

**新增** `engine/__tests__/ironGuardAbilities.test.ts`：
- 軍勢（ARMY_RALLY）條件達成觸發追加攻擊
- 整編（REORGANIZE）/ 後勤（LOGISTICS）免費復活路徑
- 軍援（SUPPORT）條件驗證

---

## Phase 5：傷害運算可視化（新功能）

> 目標：讓雙方玩家都能看到「這次射擊為什麼造成這個傷害」，提升遊戲透明度與可讀性。
> 此 Phase 新增功能，需同時更新引擎、UI、事件紀錄三層。

---

### 5-A｜`DamageDealtEvent` 擴充 `breakdown`（引擎層）

**目的**：讓 DAMAGE_DEALT 事件攜帶傷害來源明細，雙方都能重現計算過程。

**修改** `engine/events.ts`：

```ts
export type DamageBreakdownItem = {
  label: string   // 人類可讀標籤：'1d6(4)', '攻擊力', '暗月增益', '光環加成', '物防', '傷害減免'
  amount: number  // 正數=加分，負數=減分
}

export type DamageDealtEvent = {
  type: 'DAMAGE_DEALT'
  attackerId: string
  targetUnitId: string
  amount: number
  breakdown?: DamageBreakdownItem[]  // 新增，可選（不破壞現有測試）
}
```

**示例 breakdown**（骰出4點，有光環加成2，物防3）：
```ts
[
  { label: '1d6(4)', amount: 4 },
  { label: '攻擊力', amount: 2 },
  { label: '暗月增益', amount: 2 },
  { label: '物防', amount: -3 },
  // => 最終 max(1, 4+2+2-3) = 5
]
```

---

### 5-B｜`damage.ts` 新增 `computeDamageWithBreakdown()`

**目的**：不破壞現有 `computeRawDamage()` API，新增一個同時回傳傷害值與明細的函數。

**新增函數**（`engine/damage.ts`）：
```ts
export function computeDamageWithBreakdown(
  state: GameState,
  attackerId: string,
  targetUnitId: string,
  diceValue: number,
): { damage: number; breakdown: DamageBreakdownItem[] }
```

**breakdown 建構邏輯**（依序）：
| 項目 | label 範例 | amount |
|---|---|---|
| 骰子 | `1d6(4)` | `diceValue`（例如 4） |
| 攻擊力 | `攻擊力` | `attacker.atk.value` |
| 附魔卡加成 | 靈魂卡 name | `+N` |
| 光環加成 | 來源卡 name + `光環` | `+N` |
| 跨河加成 | `跨河` | `+N` |
| 目標物防/魔防 | `物防` / `魔防` | `-defValue`（負數） |
| 傷害減免光環 | 來源卡 name + `減傷` | `-N`（負數） |

實作可直接以現有 `computeRawDamage()` 邏輯為基礎，**同步建構 breakdown 陣列**。

---

### 5-C｜`shotPlan.ts` — 主射擊路徑附加 breakdown

在 `executeShotPlan()` 的主目標 `DAMAGE_DEALT` 事件建構處：

```ts
// 目前
events.push({ type: 'DAMAGE_DEALT', attackerId: src.id, targetUnitId: tgt.id, amount: finalDamageToTarget })

// 改為
const { breakdown } = computeDamageWithBreakdown(s, src.id, tgt.id, dice)
events.push({ type: 'DAMAGE_DEALT', attackerId: src.id, targetUnitId: tgt.id, amount: finalDamageToTarget, breakdown })
```

> 注意：連鎖/波及的固定傷害不帶 breakdown（固定傷害來源清楚，不需要拆解）。

---

### 5-D｜`shotPreview.ts` — 新增 `damageFormula` 欄位

**目的**：讓射擊預覽 modal 能顯示傷害範圍算式（骰子未知時用範圍）。

**修改** `ShotPreview` 型別（`engine/shotPreview.ts`）：

```ts
export type DamageFormulaItem = {
  label: string
  amount: number | [number, number]  // 固定值 或 [min, max] 範圍
  isBonus: boolean   // true=加分(黃色)，false=減分(灰色)
}

export type ShotPreview = {
  ok: true
  // ... 現有欄位 ...
  damageFormula: {
    items: DamageFormulaItem[]
    resultMin: number
    resultMax: number
  }
}
```

**計算邏輯**（shotPreview.ts 中）：
- 骰子用範圍 `[1, 6]`（或 `[fixed, fixed]`）
- 攻擊力用固定值
- 各 bonus 來源用現有的 `damageBonus` 追蹤邏輯，加上 label
- defValue 從 `computeRawDamage()` 邏輯中提取

---

### 5-E｜`ShootPreviewModal.vue` — 重新設計公式顯示

**目的**：將現在的純文字 effect list 換成玩家可讀的傷害公式 UI。

**現況**（開發者格式）：
```
原始傷害：7
傷害加成：+2（來源 unit_xxx）
光環：+1（來源 unit_yyy）
```

**改後（玩家格式）**：
```
┌─ 傷害預測 ─────────────────────────┐
│  1d6    1 ~ 6              (骰子)   │
│  +2     攻擊力                      │
│  +2  ★  暗月增益  (影弓·附魔)      │  ← 黃色
│  +1  ★  光環加成  (暗月影士)        │  ← 黃色
│  -3     物防       (紅將)           │
│  ──────────────────                 │
│     預期傷害：3 ~ 9                 │
└────────────────────────────────────┘
```

**CSS 設計**：
```css
.formulaRow.bonus .amount { color: var(--accent-gold); font-weight: 800; }
.formulaRow.penalty .amount { color: var(--text-muted); }
.formulaResult { font-size: 1.25rem; font-weight: 900; color: var(--accent-gold); }
```

**同時**：移除現有的 `byUnitId` raw string 顯示，改為 soulCard.name（靈魂卡名稱）。

---

### 5-F｜`DamageFormulaToast.vue` — 傷害結算 Toast（3秒）

**目的**：射擊結算後，以 Toast 形式讓雙方玩家看到完整傷害算式。

**觸發時機**：`processEvents()` 處理到 `DAMAGE_DEALT` 且 `breakdown` 存在時。

**新元件** `components/DamageFormulaToast.vue`：

```
┌──────────────────────────────────┐
│  ⚔  影弓 → 紅將                  │
│  1d6(4) + 2攻 + 2暗月 − 3防 = 5  │
│                            💥 5  │
└──────────────────────────────────┘
```

**規格**：
- 位置：`position: fixed`，畫面右上角（`top: 80px; right: 16px`），不遮擋棋盤
- 尺寸：`width: min(340px, 88vw)`
- 動畫：淡入 0.2s → 停留 2.6s → 淡出 0.4s（共 3.2s）
- 可同時堆疊（連鎖傷害多個目標時，從上往下堆）
- 僅顯示主目標 DAMAGE_DEALT（有 breakdown 的那一筆），連鎖/波及不顯示

**Game.vue / `useGameEffects.ts`** 新增：
```ts
type DamageToast = {
  id: string
  attackerName: string
  targetName: string
  formula: string          // 組裝好的算式字串
  finalAmount: number
  expiry: number           // Date.now() + 3200
}
const damageToasts = ref<DamageToast[]>([])

function addDamageToast(event: DamageDealtEvent, state: GameState) {
  if (!event.breakdown) return
  const formula = buildFormulaString(event.breakdown)  // '1d6(4) +2攻 +2暗月 -3防 = 5'
  // ... push to damageToasts, schedule removal
}
```

**線上對戰**：雙方都會觸發（紅方射擊 → breakdown 存在 → 黑方拉取 pollEvents 後也會 processEvents → 也會顯示 toast）

---

### 5-G｜`eventToText()` 更新 — EventLog 格式

**目前** `DAMAGE_DEALT` 顯示：
```
damage: unitA → unitB 5
```

**改後**（有 breakdown 時）：
```
⚔ 影弓 → 紅將：1d6(4) +2攻 +2暗月 -3防 = 5
```

**實作**（`Game.vue` 的 `eventToText()`）：
```ts
case 'DAMAGE_DEALT': {
  const atk = state.value.units[e.attackerId]?.name ?? e.attackerId
  const tgt = state.value.units[e.targetUnitId]?.name ?? e.targetUnitId
  if (e.breakdown?.length) {
    const formula = e.breakdown
      .map(b => `${b.amount > 0 ? '+' : ''}${b.amount} ${b.label}`)
      .join(' ')
    return `⚔ ${atk} → ${tgt}：${formula} = ${e.amount}`
  }
  return `⚔ ${atk} → ${tgt}：${e.amount} 傷害`
}
```

---

### 5-H｜單位詳情面板 — Buff 數值加法展示

**目的**：讓玩家在點開單位詳情時，清楚看到 ATK/DEF 是「怎麼算出來的」，與 Phase 5 的傷害可視化一致。

**目前狀況**（`showUnitDetail()` 在 Game.vue 約 line 970）：
```
atk: phys 2
def: phys 1 / magic 0
enchant: dark_moon_archer_shadow
```
→ 完全是 debug 格式，看不出加成來源。

**改後格式**（重寫 `showUnitDetail()` 的 `detail` 欄位）：

```
【影弓】暗月影刃
─────────────────
⚔ 攻擊 (phys)
  基礎      +2
  暗月增益  +2  ← 附魔卡本身 DAMAGE_BONUS
  光環加成  +1  ← 盟友 AURA_DAMAGE_BONUS
  ────────────
  合計      5

🛡 防禦 (phys)
  基礎      2
  （無防禦降低效果）

❤ HP：7
📍 位置：(3, 6)
```

**實作方法**：

新增工具函數 `computeUnitStatBreakdown(state, unitId)` 於 `engine/damage.ts` 或新檔案（可與 5-B 的 `computeDamageWithBreakdown` 共用邏輯）：

```ts
export type StatBreakdownItem = {
  label: string    // '基礎', '暗月增益', '光環加成' etc.
  amount: number
  sourceUnitId?: string   // 光環來源單位 ID（可選）
}

export function computeAtkBreakdown(state: GameState, unitId: string): StatBreakdownItem[]
export function computeDefBreakdown(state: GameState, unitId: string): StatBreakdownItem[]
```

**計算範圍**（複用現有 `computeRawDamage()` 邏輯）：
- ATK breakdown：基礎攻擊力 + 附魔 DAMAGE_BONUS + 各 AURA_DAMAGE_BONUS + 跨河條件
- DEF breakdown：基礎防禦 + 目前無防禦加成（但保留架構供未來擴充）

**UI 呈現**：
- 用現有的 `ui.openDetailModal({ detail: ... })` 文字格式（不需新元件）
- `detail` 字串以 `\n` 分隔行，加法項目用縮排 `  +N  label` 格式
- 有加成時用 `  +N  label (★)` 標記（純文字，無需 HTML）
- 合計行加 `────` 分隔線

**特殊情境**：
- 跨河加成（CROSS_RIVER）：`  +1  跨河加成（已過河）` 或 `  (跨河加成：尚未過河）`
- 條件型加成（CORPSES_GTE 等）：`  +2  暗月增益（需屍骸 ≥ 6，目前 8）✓`
- 鐵衛階級加成（SOLDIERS_TIERED）：`  +2  軍勢加成（卒 6 支）`

**影響檔案**：`engine/damage.ts`（新增 breakdownn 函數）、`views/Game.vue`（showUnitDetail 重寫）

---

### Phase 5 執行順序

```
5-A (events.ts 型別) → 5-B (damage.ts 新函數 + computeAtkBreakdown)
 → 5-C (shotPlan.ts 附加 breakdown) → npm run test 確認現有測試全綠

5-H (showUnitDetail 重寫)  ← 可與 5-B 同時做，共用 breakdown 函數
5-D (shotPreview.ts 新增 damageFormula) → 5-E (ShootPreviewModal.vue 重設計)
5-F (DamageFormulaToast.vue) → 5-G (eventToText 更新)
 → 手動測試：射擊後 Toast 出現、EventLog 顯示算式、雙方線上均可看到
```

### Phase 5 驗收條件

1. `npm run test` 全綠（`breakdown` 為可選欄位，不破壞現有測試）
2. `npm run build` 無 TypeScript error
3. 手動：PVE 模式射擊 → Toast 顯示算式 + EventLog 顯示算式
4. 手動：線上對戰 → 對手射擊後，己方也看到 Toast 與 EventLog 算式
5. 手動：射擊預覽 modal → 顯示黃色 `+N` 加成數字與來源名稱
6. 手動：點開單位詳情 → ATK 顯示基礎值 + 各加成來源拆解

---

## 執行順序建議

```
Phase 1（引擎層）先做：
  - 不影響 UI，可以隨時 npm run test 驗證
  - 為 Phase 2 composable 拆分打好基礎，風險最低

Phase 5-A~C（傷害算式引擎層）可與 Phase 1 同時進行：
  - 5-A 只加 breakdown 可選欄位，不影響現有測試
  - 5-B 新函數，不改舊函數
  - 5-C 只在 DAMAGE_DEALT push 前多呼叫一次

Phase 2（Game.vue composable）接著做：
  - 建議順序：useGameEffects → useGameDispatch → useInteractionMode → useActiveBuffs
  - Phase 2-A（useGameEffects）完成後，Phase 5-F（DamageFormulaToast）最適合一起做

Phase 3（元件層）：
  - ClanSelector 最簡單，可任何時間獨立進行
  - BoardCell 改動涉及 props，需審慎測試

Phase 5-D~G（傷害 UI 層）在 Phase 2-A 完成後進行：
  - 5-D（shotPreview）→ 5-E（Modal 重設計）→ 5-F（Toast）→ 5-G（EventLog）

Phase 4（測試）穿插進行：
  - Phase 1 引擎改動後補測試
  - Phase 5-A~C 引擎改動後，補 breakdown 相關測試
  - iron_guard 測試可獨立進行
```

---

## 驗收條件

每個 Phase 完成後，必須滿足：

1. `npm run test` — 所有引擎測試全綠（不允許任何 skip）
2. `npm run build` — TypeScript 無 error（warning 可容忍）
3. 手動測試：PVE 模式跑完一回合（買牌、附魔、射擊、結束回合）
4. 手動測試：線上對戰建房 → 加入 → 雙方互動一回合

---

## 不在本次計畫範圍內

- 遊戲規則/數值調整
- 新功能開發（投降、新氏族、觀戰等）
- 大幅 UI 視覺設計修改（Phase 5 僅針對傷害顯示，其他不動）
- 前端單元/整合測試框架（Vue Test Utils）
- CI/CD 流程建立

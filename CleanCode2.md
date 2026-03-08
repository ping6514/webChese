# 幽冥棋 第二次 CleanCode 計畫

> 日期：2026-03-08
> 前提：MVP2 功能完整、build 通過、33 source tests 全綠、vitest CJS 假失敗已修

---

## 🐛 待修 Bug（CleanCode 前先解）

### B1. `api/rooms/create.ts` — 線上對戰缺少新氏族
**問題**：`ALL_CLANS` whitelist 只有 4 個氏族，`gold_merc` / `death_oath` 被過濾掉，線上開房無法選用這兩個氏族。
**修法**：
```ts
// app/api/rooms/create.ts 第14行
const ALL_CLANS = ['dark_moon', 'styx', 'eternal_night', 'iron_guard', 'gold_merc', 'death_oath']
```

---

## 📁 Phase 1：檔案結構整理（低風險）

### 1-A. Composables 統一移入 `src/composables/`
目前根層有 5 個散落的 composable：
```
src/useCardDetailModal.ts
src/usePendingConfirm.ts
src/useSelection.ts
src/useShootPreview.ts
src/useShopModal.ts
```
全部移至 `src/composables/`，並更新所有 import 路徑。
受影響主要檔案：`BoardV2.vue`、`GameV2.vue`、`GameModalsV2.vue`

### 1-B. CLAUDE.md 更新
- 氏族列表補上 `gold_merc`（黃金傭兵 💰）和 `death_oath`（死誓 ☠️）
- 測試數量從 32 更新為 33
- 補充 vitest exclude 說明（`vite.config.ts test.include`）

---

## 🧹 Phase 2：元件瘦身（中風險）

### 2-A. `BoardV2.vue`（707 行）— 拆出 shoot 互動邏輯
Board 目前混合：棋盤渲染 + shoot preview 計算 + 連鎖目標計算 + 懸停高亮。
建議抽出 `src/composables/useBoardShoot.ts`：
- `shootChainEligibleEnemyIds`
- `shootTargetUnitId`
- `shootPreviewPos`
- hover 相關 computed
- Board 保留純渲染 + click handler

### 2-B. `MobileLayout.vue`（686 行）— 拆出 tab 狀態
Tab 切換邏輯（`activeTab`、`toggleTab`、各 slot 的 computed）可以抽成 `useMobileTabs.ts`。

### 2-C. `reduce.ts`（1042 行）— 拆出 SHOOT case
類似 `itemReducers.ts` 的做法，把 SHOOT action 的 ~200 行移至 `shootReducer.ts`。
```ts
// reduce.ts
import { reduceShoot } from './shootReducer'
// ...
case 'SHOOT': return reduceShoot(state, action)
```

---

## 🏷️ Phase 3：命名明確化（低風險）

### 3-A. `src/components/` 非 v2 元件
這些元件仍在使用（被 v2 元件引用），命名上沒有 V2 後綴容易混淆。
選項 A：整批移入 `src/components/shared/`（需更新所有 import）
選項 B：加上 README 或 index.ts 說明其定位

目前仍在使用的非 V2 元件：
- `BoardGrid.vue` / `BoardCell.vue`（被 BoardV2.vue 引用）
- `HandSouls.vue` / `HandItems.vue`（被 MobileLayout/DesktopLayout/HandPanelV2 引用）
- `CellInfoPanel.vue` / `UnitInfoPanel.vue`（被 RightPanelV2 引用）
- `ShootPreviewModal.vue` / `ConfirmModal.vue` / `DamageFormulaToast.vue` / `IncomeToast.vue`（被 BoardV2 引用）
- `ShopModal.vue` / `GraveyardPanel.vue` / `AllUnitsModal.vue` / `EffectsModal.vue` / `EventLogModal.vue`（被 GameModalsV2 引用）
- `CardDetailModal.vue` / `ClanSelector.vue`（被 GameModalsV2/Home 引用）

---

## 🔧 Phase 4：引擎小修（最低風險）

### 4-A. `gameConfig.ts` — 單一 CLAN 來源
目前 `ALL_CLANS` 散落在 `create.ts` 和 `gameConfig.ts`。
在 `gameConfig.ts` export `ALL_CLAN_IDS`，`create.ts` import 使用。

### 4-B. `effects.ts` — 移除 dead code（如有）
通過 grep 確認是否有已不再觸發的 ability type case。

---

## ✅ 已完成（本次 session）
- [x] vitest CJS 假失敗修復（`vite.config.ts` 加 `test.include`）

## 執行順序建議
```
B1（bug）→ 1-A → 1-B → 2-C → 2-A → 2-B → 3-A → 4-A → 4-B
```
Phase 1 最優先（純移檔），Phase 2 拆元件需要完整測試後再 deploy。

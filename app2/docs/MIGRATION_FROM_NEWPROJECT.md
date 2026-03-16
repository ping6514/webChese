# 從 newProject 移植評估

## 結論

移植策略：**只移植引擎邏輯，不移植 UI 元件**。

newProject/frontend 已驗證的核心機制中，有數個與格子形狀完全無關的邏輯層，
可以直接或稍作修改後接入 app2 的六角格戰場引擎。

---

## 移植優先順序

### 第一批（直接移植，幾乎不需修改）

#### `engine/atb.ts` → `src/engine/atb.ts`

ATB 時間軸是純時間計算，與格子形狀無關。

關鍵邏輯：
- `advanceTime(state)` — 推進時間，找出下一個行動單位
- `pendingUnitId` — 目前輪到誰
- `castRemaining` / `recoveryRemaining` — 施法前搖 / 後搖計時
- `ATB_SPEED` — 決定時間軸推進速度

移植時注意：
- 原本的 `unit.position: {x,y}` 改成 `unit.position: {q,r}` (axial)
- 其他 ATB 邏輯不需要任何修改

#### `engine/events.ts` → `src/engine/events.ts`

事件驅動的 FX 系統可以直接搬，類型定義改成新的即可。

需要的事件類型：
```typescript
UNIT_HP_CHANGED     // → 浮字 +/-N
UNIT_DIED           // → 死亡動畫
ABILITY_TRIGGERED   // → 高亮 + 浮字
STATUS_APPLIED      // → 狀態圖示
UNIT_MOVED          // → 移動軌跡動畫（新增，hex 移動用）
INTERRUPT_SUCCESS   // → 打斷特效
```

### 第二批（需要修改後使用）

#### `engine/damage.ts` → `src/engine/damage.ts`

傷害計算公式直接對應 MVP_BATTLE_DATA.md 的數值設計，幾乎可直接使用。

原版公式：
```
finalDamage = baseDamage
  × (1 + expose_modifier)   // Expose Slash +25%, Expose Pierce +25%
  × (1 + vulnerable_mod)    // General Vulnerable +15%
  × (1 + backstab_mod)      // 從背後命中 +20%
```

修改項目：
- 加入 `damageMult` from `WeaponModeEffect`（base_mode vs perfect_match_mode）
- 加入 gene 的 `slashDamageMult / pierceDamageMult / impactDamageMult`
- 背刺 `backstab_mod` 判斷改為六角格朝向邏輯（見 HEX_GRID.md）

#### `engine/passive.ts` → 改為 `src/engine/geneHooks.ts`

原版 passive 系統的 hook 概念直接對應基因的觸發效果。

需要支援的 hook 時機（從 GeneDef.baseEffect 對應）：
- `onOwnActionEnd` — `healAfterOwnAction`
- `onProtectAlly` — `extraHealAfterProtect`
- `onHit` — `exposeSlashOnHitChance`, `exposeImpactOnHitChance`
- `onTurnStart` — `removeStatuses` (部分基因)

#### `engine/loot_phase.ts` → `src/engine/rewardPhase.ts`

把拾取相位狀態機（idle → selecting → done）改為新遊戲的獎勵流程：

舊流程：`戰鬥 → 選裝備（armor/weapon）→ 繼續`

新流程：`遭遇結束 → 選素材 or 遺物 → 可選擇解鎖新證 → 繼續`

架構（guard blocking、phase ref）直接沿用。

### 第三批（概念參考，重新實作）

#### `sim/balanceBot.ts`

Epsilon-greedy 決策框架可以用，但 action scoring 要完全重寫：

原版評分基礎：方形格 Manhattan 距離 + HP 最大化

新版評分需要考慮：
- 六角格距離與方向
- 敵方 ATB 時間軸（是否能在敵人行動前完成移動+攻擊）
- 危險區（Zone 技能的預定落點）
- 保護價值（隊友在敵人攻擊範圍內的風險）

---

## 不移植的項目

| 項目 | 原因 |
|---|---|
| `engine/dungeon.ts` | 舊版是探索地圖；新版是競技場遭遇，架構完全不同 |
| `engine/campaign.ts` | 新版的 run 結構更簡單（遭遇序列而非多層地城）|
| `engine/item.ts` (affix 系統) | 新系統改用 cert + gene + tool，沒有 affix 概念 |
| `engine/armor.ts` / `weapons.ts` | 裝備系統重設計，不兼容 |
| `stores/inventory.ts` | 新背包模型完全不同（共用消耗品 + per-cert 組合）|
| `components/BoardGrid.vue` | 方形格，六角格需要全部重寫（用 SVG）|
| `components/DungeonView.vue` | 探索視角，新設計不需要 |
| `components/PathSelect.vue` | 可參考概念，但新版路線選擇更輕量 |
| `components/LootPhase.vue` | 需重寫成新的獎勵選擇 UI |

---

## 可以直接沿用的 UI 元件

| 元件 | 沿用理由 |
|---|---|
| `components/ATBTracker.vue` | 時間軸 UI 概念直接對應，調整樣式即可 |
| `components/GameOverScreen.vue` | 勝敗畫面，概念通用 |
| `components/UnitDetailPanel.vue` | 單位數值展示，改成新 schema 即可 |
| `components/ActionMenu.vue` | 行動選單概念，修改成 hex 版技能選擇 |

---

## 資料模型對應

| newProject | app2 | 說明 |
|---|---|---|
| `FrozenArmor` + `FrozenWeapon` | `WeaponDef` (equipped) | 武器改為 cert 匹配的 WeaponDef |
| `ArmorSlot` | - | 新系統沒有護甲概念（由 gene 提供防禦）|
| `dungeonQuality` | cert.tier + 品質參數 | 品質影響成長空間而非基礎定位 |
| `AppliedAffix` | `GeneDef` | 基因取代 affix，但 slot 概念類似 |
| `lootPhase.phase` | `rewardPhase.phase` | 直接對應，改名即可 |
| `GameState.run` | `RunState` | 保留 run 的概念（短篇地城 run）|
| `ATBState` | `ATBState` | 直接搬，型別一樣 |

---

## 建議的 app2 engine 目錄結構

```
src/
└── engine/
    ├── schema.ts          ✅ 已完成（cert/weapon/gene/tool 型別）
    ├── hex.ts             ✅ 已完成（六角格幾何）
    ├── atb.ts             🔄 從 newProject/engine/atb.ts 移植
    ├── state.ts           ⬜ GameState / RunState / UnitState 定義
    ├── actions.ts         ⬜ MOVE / ATTACK / SKILL / USE_TOOL / PASS
    ├── guards.ts          ⬜ canMove / canAttack / canUseSkill
    ├── reduce.ts          ⬜ reducer（action → new state + events）
    ├── damage.ts          🔄 從 newProject/engine/damage.ts 移植 + 修改
    ├── geneHooks.ts       🔄 從 newProject/engine/passive.ts 改寫
    ├── events.ts          🔄 從 newProject/engine/events.ts 移植 + 新增
    ├── spawner.ts         ⬜ 遭遇敵人生成（概念參考 newProject）
    ├── rewardPhase.ts     🔄 從 newProject/engine/loot_phase.ts 改寫
    └── resolveLoadout.ts  ✅ 已完成（武器匹配 + 基因 synergy）
```

圖例：✅ 已完成 / 🔄 從舊專案移植 / ⬜ 全新實作

---

## 設計文件調整需求

因應六角格，以下 newProject 文件需要小幅更新：

### PRODUCT_PIVOT.md
- 「地圖形狀：長方形 / 正方形」→ 改為「六角格競技場，基準尺寸 9×7 格」
- 新增：六個方向定義（前 3 格 / 後 3 格，用於保護與背刺語意）

### MVP_BATTLE_DATA.md
- 「前排保護」→ 補充：前排 = 面朝方向的前 3 個六角格
- 「背後命中 +20%」→ 補充：背後 = 面朝方向相反的 3 個六角格
- 移動數值（move: 4/3）不需更改（hexDistance 與 Manhattan 數感相似）
- 其他傷害/DoT/降抗數值完全不需更改

### MVP_CERT_DATA.md / MVP_MONSTER_GIRL_PLAN.md
- 不需要修改，所有概念天然適配六角格

# 魔物娘戰場 — 開發進度與建議

> 最後更新：2026-04-24

---

## 已完成功能

### 核心引擎

| 功能 | 說明 |
|---|---|
| 六角格地圖 + A* 尋路 | odd-r offset 座標，`hexDistance`、`findPath`、`neighbors` |
| 小隊 ATB 戰鬥系統 | 隊長 + 從者各自獨立 ATB，護盾層優先承傷 |
| 屬性傷害系統 | `phys / pierce / magic` 三種屬性，`physDef / pierceDef / magDef` 三條抗性，取代舊相剋表 |
| Trait 系統 | 6 種 Trait：Charge / Splash / Block / Pierce / LifeSteal / Taunt，全部接入戰鬥邏輯 |
| 從者帶 + Trait 帶 | 雙條運輸帶，各自有手牌上限、預覽佇列、丟棄功能 |
| 暫存區 | 從者牌 → 暫存 → 疊 Trait → 召喚到小隊的三步流程 |
| 跨路路線（Layer 3） | `LaneDef.waypoints` + Q 軸閾值無狀態路點，支援跨路切線移動 |
| 勝敗條件完整化 | 主堡佔領勝 / 主堡 HP 壓制損耗歸零 / 計時器超時比佔點 |
| 計時器（maxTicks 依模板） | 超時後比佔點數，平手比主堡剩餘 HP |
| 主堡壓制損耗 | 敵方小隊每 tick 駐紮主堡格造成 −0.4 HP，最大 1000 |
| **地圖模板系統** | `createMap(template)` 支援 4 種模板；`getTemplateInfo()` 提供 label/icon/maxTicks |
| **標準戰場** | 三路、高地、稀疏森林、各 1 佔點（captureHp 100），5400 tick |
| **要塞戰場** | 三路、廣泛高地、每路近+遠兩個佔點（各 captureHp 80），6600 tick |
| **密林戰場** | 三路、密集森林、佔點在中央（captureHp 100），5400 tick |
| **閃擊戰場** | 三路、無地形、佔點更靠近玩家（captureHp 60），3600 tick |
| 備戰模板選擇 | PrepView.vue 新增「地圖」Tab，顯示 4 張模板卡供選擇 |

### 渲染器

| 功能 | 說明 |
|---|---|
| PixiHexRenderer（Pixi.js v8）| 六角格渲染、小隊精靈、FX 動畫 |
| 遠程攻擊視覺延遲 | `pendingDamage` 佇列，arrow +344ms、cannonball +448ms 後才顯示傷害數字 |
| 縮放控制 | `ZOOM_STEP` 按鈕 + 百分比顯示 |
| 小隊點擊互動 | 點選小隊顯示可選區域高亮，點格子設路線 |

### UI

| 功能 | 說明 |
|---|---|
| 運輸帶三欄佈局 | 從者帶 ｜ 暫存區 ｜ Trait 帶 |
| 小隊面板 | 隊長名稱、狀態、SP 條、護盾層徽章（含 Trait 圖示）、路線 / 行為按鈕、召喚按鈕 |
| Top Bar | 計時器（MM:SS，最後 72 秒紅色警示）、雙側主堡 HP 進度條、靈力、速度控制 |
| 勝敗 Overlay | 顯示勝因說明（佔領 / 壓制 / 計時器） |

---

## 建議的下一步（按優先順序）

### ~~1. 地圖模板系統~~ ✅ 已完成

---

### 1. 設施建造基礎版（中優先）

**目標：** 佔領前哨站後可以花靈力建造設施，給資源管理增加深度。

**做什麼：**
- 在 `ZoneState.facility` 掛載建造狀態
- 三種基礎設施：

| 設施 | 費用 | 效果 |
|---|---|---|
| 防禦塔 | 12 靈力 | 每 N tick 自動攻擊附近敵方 |
| 急救站 | 10 靈力 | 每 N tick 回復駐紮小隊 HP |
| 採集站 |  8 靈力 | 每 tick 額外產出靈力 |

- UI：佔領後的區域格子上出現建造按鈕

**涉及檔案：** `engine/types.ts`、`engine/squadEngine.ts`、`stores/gameStore.ts`、`views/BattleView.vue`

---

### 3. SP 技能觸發（低優先，但有趣）

**目標：** 讓隊長的 SP 技能真正觸發並有效果，目前 SP 條累積但不做事。

**做什麼：**
- 在 `tickATB` 中偵測 `squad.sp >= 100 && squad.aiConfig.spMode === 'auto'`
- 依 `captainDef.spSkillId` 執行對應效果：
  - `charge_roar`：下一擊傷害 ×1.6 + 目標 ATB 清零
  - `iron_wall`：60 tick 內 DEF ×2、移速歸零（防禦陣型）
  - `trample`：衝向目標，路徑敵方 ATB 清零
  - `arrow_rain`：對目標格周圍 1 格所有敵方造成 ATK×1.5 傷害
  - `breach`：對最近建築造成 ATK×3 傷害 + 佔領進度 +20%

**涉及檔案：** `engine/squadEngine.ts`（新增 `triggerSPSkill()` 函式）

---

### 4. 敵方 AI 強化（低優先，補完性）

**目標：** 敵方不只有直衝，會根據戰況動態調整。

**做什麼：**
- 敵方小隊佔領前哨站後切換至 `'capture'` 行為
- 敵方 AI 也能使用跨路路線（設定 `aiConfig.route = 'cross_xxx'`）
- 敵方 HP 低於 30% 時自動撤退（觸發 `'retreating'`）

**涉及檔案：** `engine/squadEngine.ts`（`tickSquad` 邏輯擴充）

---

### 5. 備戰畫面完善（UX 補強）

**目標：** 讓玩家在開戰前能真正有意義地選擇陣容。

**做什麼：**
- 隊長卡選擇（目前固定 3 張）→ 從全部 5 種中選 1-3 張
- 召喚師裝備卡選擇（目前不生效）→ 接入效果邏輯
- 顯示各隊長的 Trait 偏好和 stats 預覽

**涉及檔案：** `views/PrepView.vue`（或 Home.vue 備戰區）、`stores/gameStore.ts`

---

## 技術債 / 已知問題

| 項目 | 嚴重度 | 說明 |
|---|---|---|
| SP 技能無效果 | 中 | SP 條滿了但不觸發技能 |
| 敵方永遠 aggressive | 低 | 敵方不會主動佔點 |
| 備戰卡選擇固定 | 低 | `selectedCardIds` 寫死 3 張 |
| 地圖只有一張 | 低 | 每次戰鬥相同地圖 |
| 從者帶沒有玩家池自訂 | 低 | 所有兵種均等機率，無偏好權重 |

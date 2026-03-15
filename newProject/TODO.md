# 時間地城 TODO

> 依優先度排列，上方先做。完成打 ✅。

---

## 資產庫

### 怪物
- [x] 修正 `wolf_spawner.json`：`specialModifiers` 拆成 `skillPool`（主動）+ `passiveAbilities`（被動）
- [x] 建立 `wolf_skills.json`（pack_call、howl_aoe_slow）
- [x] 補菁英野狼的 `passiveAbilities`（enrage_on_low_hp）
- [x] 森林怪物：`poison_spider.json` + spawner
- [x] 森林怪物：`vine_beast.json` + spawner
- [x] 森林精英：`forest_hunter.json` + spawner
- [x] 森林精英：`ancient_treant.json` + spawner
- [x] 森林 Boss：`forest_guardian.json` + spawner
- [x] 建立技能定義：`web_shot`（毒蜘蛛菁英）、`vine_entangle`（古藤獸菁英）、`guardian_charge`（守護者）
- [ ] 廢墟怪物資產（整組）

### 地圖
- [x] 森林主題房間模板 JSON（`data/maps/forest/`）— rooms 01–06 + guardian_arena 已完成
- [ ] 廢墟主題房間模板 JSON（`data/maps/ruins/`）

---

## 引擎實作

- [ ] `engine/state.ts`：照 ARCHITECTURE.md 定義 GameState / RunState / Unit 等型別
- [ ] `engine/actions.ts`：Action union type
- [ ] `engine/events.ts`：Event union type
- [ ] `engine/guards.ts`：canMove / canUseWeapon / canUseSkill 等
- [ ] `engine/reduce.ts`：MOVE / USE_WEAPON / ADVANCE_TIME 等 case
- [ ] `engine/atb.ts`：ATB 時間軸推進邏輯
- [ ] `engine/damage.ts`：統一傷害公式（FormulaKeySet → DamageComponent[]）
- [ ] `engine/passive.ts`：統一被動監聽池
- [ ] **Unit 效果狀態池（Effect Status Pool）**
  - 每個 Unit 持有 `statusEffects: StatusEffect[]`（已在 state.ts 定義）
  - 每個 StatusEffect 帶有 `remainingMs`（生命期）、`intensity`（強度）、debuff 類型
  - **ADVANCE_STATUS_EFFECTS** action：每次 ATB 推進時同步縮短 remainingMs，過期則移除
  - DoT（毒/灼燒）：每 tick 發出 DOT_TICK event → 計算傷害 → DAMAGE_DEALT
  - 狀態查詢：guards.ts 中的 `canMove()` / `canAct()` 讀取 `unit.statusEffects` 判斷是否 stunned/webbed
  - 狀態疊加規則：同 debuffId 是否刷新時間還是疊加層數（MVP1：刷新 remainingMs）
- [ ] `engine/ai.ts`：chase / guard / patrol AI
- [ ] `engine/spawner.ts`：讀 *_spawner.json 產生怪物實例
- [ ] `engine/weapons.ts`：resolveWeapon()（base + affixes + overwrite → resolved）

---

## 系統設計（待補文件 / 確認）

- [ ] ARCHITECTURE.md：`DungeonState`（舊欄位）改名確認清理
- [ ] DESIGN.md §10：強奪機制標題編號修正（§9.2 → §10.2）
- [ ] 補給層頻率設計（每幾層出現一次？）
- [ ] 8 元素怪物抗性設計（各地城主題的抗性傾向）
- [ ] 許願池系統（記憶中已記，實作時再開）

---

## 打寶系統

- [x] `engine/item.ts`：FrozenArmor / FrozenWeapon / LootResult 型別
- [x] `engine/loot_utils.ts`：共用工具（rollAffixesForBase / makeInstanceId / weightedPick 等）
- [x] `engine/loot.ts`：StandardTicket + LootRegistry + resolveLoot()（抽獎券路徑）
- [x] `engine/loot_boss.ts`：BossPoolEntry + resolveBossLoot()（Boss 必定掉落路徑）
- [x] `engine/tests/loot_test.ts`：32 測試全綠（標準 18 + Boss 14）
- [ ] `engine/armor.ts`：resolveArmorStats()（bake dungeonQuality 到 valueExpr，產生 stat 快照）
- [ ] 玩家道具欄（inventory）LocalStorage 存取
- [ ] 裝備時套用 FrozenArmor affixIds 到 Unit.defenses / passiveEffects

---

## 玩家資產與存檔系統（待討論）

### 裝備組合（Build）格式
- [ ] **如何定義玩家的裝備組合**
  - 玩家擁有的 Unit（職業＋等級）＋ 裝備各槽位（武器/頭/胸/手/腳）
  - 每件裝備由 `baseId` + `resolvedAffixes[]`（slot1~slot5 各選一）組成
  - 問題：玩家是否可以自由換裝（副本外自由換），還是一次探索鎖定組合？
  - 問題：武器 slot 是否允許多把備用（主副手切換）？

### 帳號資產儲存
- [ ] **玩家帳號資產如何儲存**
  - 目前決策：**本地快取（LocalStorage / IndexedDB）**，不需要後端帳號
  - 儲存內容候選：
    - `inventory`：已獲得的裝備清單（每件帶 instanceId + baseId + affixes）
    - `units`：角色清單（職業/等級/已裝備組合）
    - `runHistory`：歷次探索紀錄（種子/樓層/死亡原因）
    - `settings`：音效/語言等偏好
  - 問題：跨裝置同步？（MVP1 先不考慮）

### 存檔紀錄格式
- [ ] **輸出紀錄檔（Run Record）格式設計**
  - 一次地城探索結束後輸出 JSON，涵蓋：
    ```
    {
      "runId": "<uuid>",
      "runSeed": "<seed string>",
      "dungeon": "forest",
      "startedAt": "<ISO8601>",
      "endedAt": "<ISO8601>",
      "result": "victory" | "defeat",
      "floorReached": 7,
      "playerUnits": [ { unitId, jobId, level, equipment: {...} } ],
      "loot": [ { instanceId, baseId, affixes } ],
      "goldEarned": 240,
      "timeline": [ { floor, roomId, outcome, events: [...] } ]
    }
    ```
  - 用途：本地歷史紀錄顯示、未來排行榜基礎、除錯回放
  - 問題：`timeline.events` 要細到什麼粒度？（每次攻擊 vs 每個房間結果）

---

## 未來（MVP2+）

- [ ] 多主題大型地城（30 層，途中換主題）
- [ ] 廢墟 + 森林以外的第三地城主題
- [ ] 高等職業 cert（狂戰士等）
- [ ] 消耗品系統完整實作
- [ ] 村莊系統
- [ ] 許願池系統（玩家 id + runSeed 雜湊 → 影響任務寶相掉落裝備類型偏向）

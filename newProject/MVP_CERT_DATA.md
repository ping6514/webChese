# MVP Cert Data

## 文件目的

本文件是 `MVP_MONSTER_GIRL_PLAN.md` 的第一版資料表規格化整理。

目標是把以下內容整理成可直接轉成 `ts/json` 的欄位：

- 職業證 / 種族證
- 武器基底與進階專用武器
- 專用基因與通用基因
- 玩家戰術工具
- 武器 `base_mode / perfect_match_mode`

本文件先服務 MVP1：

- 單一森林主題地城
- 玩家使用御三家基礎證
- 敵人可使用基礎證與進階證
- 最終 Boss 為牙刃系三階個體 `山王牙證`

---

## 一、欄位設計總覽

### 1. 職業證資料欄位

每張證建議至少包含：

- `id`
- `name`
- `family`
- `tier`
- `raceTags`
- `combatRole`
- `baseStats`
- `weaponSlots`
- `exclusiveGeneOptions`
- `genericGeneSlots`
- `toolSlots`
- `specializedInterruptTags`
- `weaponStyleTags`
- `notes`

### 2. 武器資料欄位

每把武器建議至少包含：

- `id`
- `name`
- `familyHint`
- `weaponType`
- `damageType`
- `elementType`
- `statScaling`
- `actionTags`
- `requiredTags`
- `preferredFamilies`
- `preferredTags`
- `baseCast`
- `baseRecovery`
- `baseDamage`
- `baseInterrupt`
- `baseMode`
- `perfectMatchMode`
- `slotProfile`
- `notes`

### 3. 基因資料欄位

每顆基因建議至少包含：

- `id`
- `name`
- `geneType`
- `compatibleFamilies`
- `baseEffect`
- `synergyEffect`
- `notes`

專用基因另外需要：

- `ownerCertId`

### 4. 工具資料欄位

每個工具建議至少包含：

- `id`
- `name`
- `toolType`
- `charges`
- `timing`
- `effectSummary`
- `notes`

---

## 二、職業證資料表

### 共通 enum 建議

```ts
family = 'fang' | 'membrane' | 'weave'
tier = 1 | 2 | 3
combatRole = 'striker' | 'protector' | 'controller' | 'boss'
raceTags =
  | 'has_claws'
  | 'has_tail'
  | 'has_wings'
  | 'gel_body'
  | 'has_horns'
  | 'forest_apex'
weaponStyleTags =
  | 'dash'
  | 'backstab'
  | 'guard'
  | 'bind'
  | 'shot'
  | 'blast'
  | 'interrupt_heavy'
  | 'interrupt_projectile'
```
```

### 玩家可用基礎證

```yaml
- id: cert_fang_moonwolf
  name: 月狼證
  family: fang
  tier: 1
  raceTags: [has_claws, has_tail]
  combatRole: striker
  baseStats:
    hp: 95
    move: 4
    str: 1.0
    agi: 1.1
    int: 0.8
  weaponSlots: 3
  exclusiveGeneOptions: [gene_ex_fang_hunt_echo, gene_ex_fang_break_instinct]
  genericGeneSlots: 2
  toolSlots: 1
  specializedInterruptTags: [heavy_cast, light_cast]
  weaponStyleTags: [dash, backstab, interrupt_heavy]
  notes: 牙刃系基礎證，主攻手與切入手

- id: cert_membrane_gel
  name: 凝膠證
  family: membrane
  tier: 1
  raceTags: [gel_body]
  combatRole: protector
  baseStats:
    hp: 120
    move: 3
    str: 0.95
    agi: 0.75
    int: 0.9
  weaponSlots: 3
  exclusiveGeneOptions: [gene_ex_membrane_regen, gene_ex_membrane_corrode]
  genericGeneSlots: 2
  toolSlots: 1
  specializedInterruptTags: [light_cast, projectile_cast, guard_cast]
  weaponStyleTags: [guard, bind]
  notes: 護膜系基礎證，保護與限位核心

- id: cert_weave_windfeather
  name: 風羽證
  family: weave
  tier: 1
  raceTags: [has_wings]
  combatRole: controller
  baseStats:
    hp: 85
    move: 4
    str: 0.75
    agi: 1.0
    int: 1.1
  weaponSlots: 3
  exclusiveGeneOptions: [gene_ex_weave_hex_extend, gene_ex_weave_resonance]
  genericGeneSlots: 2
  toolSlots: 1
  specializedInterruptTags: [projectile_cast, zone_cast]
  weaponStyleTags: [shot, blast, interrupt_projectile]
  notes: 妖織系基礎證，debuff 與遠程干擾核心
```

### 進階證

```yaml
- id: cert_fang_huntmoon
  name: 獵月證
  family: fang
  tier: 2
  raceTags: [has_claws, has_tail]
  combatRole: striker
  baseStats:
    hp: 90
    move: 5
    str: 1.0
    agi: 1.2
    int: 0.8
  weaponSlots: 3
  exclusiveGeneOptions: []
  genericGeneSlots: 2
  toolSlots: 1
  specializedInterruptTags: [light_cast, heavy_cast]
  weaponStyleTags: [dash, backstab]
  notes: 高機動追獵型牙刃進階證

- id: cert_fang_rendfang
  name: 裂牙證
  family: fang
  tier: 2
  raceTags: [has_claws, has_tail]
  combatRole: striker
  baseStats:
    hp: 105
    move: 4
    str: 1.1
    agi: 1.0
    int: 0.8
  weaponSlots: 3
  exclusiveGeneOptions: []
  genericGeneSlots: 2
  toolSlots: 1
  specializedInterruptTags: [heavy_cast]
  weaponStyleTags: [dash, interrupt_heavy]
  notes: 正面破陣型牙刃進階證

- id: cert_membrane_tideguard
  name: 護潮證
  family: membrane
  tier: 2
  raceTags: [gel_body]
  combatRole: protector
  baseStats:
    hp: 130
    move: 3
    str: 0.9
    agi: 0.7
    int: 0.95
  weaponSlots: 3
  exclusiveGeneOptions: []
  genericGeneSlots: 2
  toolSlots: 1
  specializedInterruptTags: [projectile_cast, guard_cast]
  weaponStyleTags: [guard]
  notes: 吃傷與保護更強的護膜進階證

- id: cert_membrane_corroslime
  name: 蝕黏證
  family: membrane
  tier: 2
  raceTags: [gel_body]
  combatRole: protector
  baseStats:
    hp: 115
    move: 3
    str: 1.0
    agi: 0.75
    int: 1.0
  weaponSlots: 3
  exclusiveGeneOptions: []
  genericGeneSlots: 2
  toolSlots: 1
  specializedInterruptTags: [light_cast, projectile_cast]
  weaponStyleTags: [bind]
  notes: 腐蝕與易傷導向的護膜進階證

- id: cert_weave_echofeather
  name: 鳴羽證
  family: weave
  tier: 2
  raceTags: [has_wings]
  combatRole: controller
  baseStats:
    hp: 82
    move: 4
    str: 0.75
    agi: 1.0
    int: 1.15
  weaponSlots: 3
  exclusiveGeneOptions: []
  genericGeneSlots: 2
  toolSlots: 1
  specializedInterruptTags: [projectile_cast, zone_cast]
  weaponStyleTags: [shot, interrupt_projectile]
  notes: 拆施法與遠程斷招導向的妖織進階證

- id: cert_weave_blazefeather
  name: 灼羽證
  family: weave
  tier: 2
  raceTags: [has_wings]
  combatRole: controller
  baseStats:
    hp: 88
    move: 4
    str: 0.75
    agi: 0.95
    int: 1.15
  weaponSlots: 3
  exclusiveGeneOptions: []
  genericGeneSlots: 2
  toolSlots: 1
  specializedInterruptTags: [zone_cast]
  weaponStyleTags: [blast]
  notes: 燃燒、易傷、區域壓制導向的妖織進階證
```

### Boss 證

```yaml
- id: cert_fang_mountain_king
  name: 山王牙證
  family: fang
  tier: 3
  raceTags: [has_claws, has_tail, forest_apex]
  combatRole: boss
  baseStats:
    hp: 240
    move: 3
    str: 1.25
    agi: 0.9
    int: 0.8
  weaponSlots: 1
  exclusiveGeneOptions: []
  genericGeneSlots: 0
  toolSlots: 0
  specializedInterruptTags: [heavy_cast]
  weaponStyleTags: [dash, interrupt_heavy]
  notes: 森林最終 Boss，用於展現牙刃系三階上限
```

---

## 三、專用基因資料表

### 專用基因規則

- 每張基礎證提供 `2 選 1`
- 直接綁定證件，不做自由通用裝配
- 專用基因以玩法分流為主，不以大幅純數值為主

```yaml
- id: gene_ex_fang_hunt_echo
  name: 獵性回響
  ownerCertId: cert_fang_moonwolf
  geneType: exclusive
  baseEffect:
    summary: 背後命中後，下次牙刃攻擊 recovery 降低 20%
  synergyEffect:
    summary: null
  notes: 追擊 / 收頭型月狼證專用基因

- id: gene_ex_fang_break_instinct
  name: 裂陣本能
  ownerCertId: cert_fang_moonwolf
  geneType: exclusive
  baseEffect:
    summary: 對 heavy_cast 目標造成 +15% 傷害，interrupt +1
  synergyEffect:
    summary: null
  notes: 破重招型月狼證專用基因

- id: gene_ex_membrane_regen
  name: 護膜再生
  ownerCertId: cert_membrane_gel
  geneType: exclusive
  baseEffect:
    summary: 本回合若替友軍承傷，自身行動後恢復 6 HP
  synergyEffect:
    summary: null
  notes: 純保護導向凝膠證專用基因

- id: gene_ex_membrane_corrode
  name: 蝕液滲透
  ownerCertId: cert_membrane_gel
  geneType: exclusive
  baseEffect:
    summary: 命中後更容易施加 Vulnerable 或 Expose Impact
  synergyEffect:
    summary: null
  notes: 腐蝕牽制導向凝膠證專用基因

- id: gene_ex_weave_hex_extend
  name: 羽咒延展
  ownerCertId: cert_weave_windfeather
  geneType: exclusive
  baseEffect:
    summary: 自身施加的 Burn / Shock / Vulnerable 持續時間 +1
  synergyEffect:
    summary: null
  notes: debuff 延展型風羽證專用基因

- id: gene_ex_weave_resonance
  name: 裂響共鳴
  ownerCertId: cert_weave_windfeather
  geneType: exclusive
  baseEffect:
    summary: 對 projectile_cast / zone_cast 目標命中時，interrupt +1
  synergyEffect:
    summary: null
  notes: 拆施法導向風羽證專用基因
```

---

## 四、通用基因資料表

### 通用基因規則

- 全證可裝
- 永遠先套 `baseEffect`
- 若與對應 family / tag 適配，再額外套 `synergyEffect`
- 不做裝錯懲罰
- 不削弱非適配證的基礎收益

```yaml
- id: gene_generic_vital_boost
  name: 生命增幅
  geneType: generic
  compatibleFamilies: []
  baseEffect:
    hpMult: 0.10
  synergyEffect: null
  notes: 純通用基礎生命值增幅

- id: gene_generic_power
  name: 力量基因
  geneType: generic
  compatibleFamilies: [fang]
  baseEffect:
    damageMult: 0.10
  synergyEffect:
    onBackHitDamageBonus: 0.10
  notes: 任何證都可拿到 +10% 傷害，牙刃系再多背刺收益

- id: gene_generic_regen
  name: 再生因子
  geneType: generic
  compatibleFamilies: [membrane]
  baseEffect:
    healAfterOwnAction: 4
  synergyEffect:
    extraHealAfterProtect: 3
  notes: 護膜系額外強化保護後回復

- id: gene_generic_burn_resist
  name: 灼燒耐性
  geneType: generic
  compatibleFamilies: []
  baseEffect:
    burnResist: 0.35
  synergyEffect: null
  notes: 純抗性基因

- id: gene_generic_bind_resist
  name: 束縛耐性
  geneType: generic
  compatibleFamilies: []
  baseEffect:
    bindResist: 0.35
  synergyEffect: null
  notes: 純抗性基因

- id: gene_generic_shock_circuit
  name: 震盪回路
  geneType: generic
  compatibleFamilies: [weave]
  baseEffect:
    interruptAdd: 1
  synergyEffect:
    interruptBonusVs: [projectile_cast, zone_cast]
  notes: 妖織系更能拆投射與區域施法

- id: gene_generic_swiftness
  name: 迅捷因子
  geneType: generic
  compatibleFamilies: [fang]
  baseEffect:
    castMult: -0.10
  synergyEffect:
    recoveryMult: -0.10
  notes: 牙刃系可更完整地轉化成節奏優勢

- id: gene_generic_guard_boost
  name: 保護增幅
  geneType: generic
  compatibleFamilies: [membrane]
  baseEffect:
    protectValueMult: 0.15
  synergyEffect:
    frontDamageReduction: 0.10
  notes: 護膜系防護收益更完整

- id: gene_generic_slash_boost
  name: 劈砍增幅
  geneType: generic
  compatibleFamilies: [fang]
  baseEffect:
    slashDamageMult: 0.12
  synergyEffect:
    exposeSlashOnHitChance: 0.25
  notes: 傷害與降抗鋪墊兼具

- id: gene_generic_impact_boost
  name: 衝擊增幅
  geneType: generic
  compatibleFamilies: [membrane]
  baseEffect:
    impactDamageMult: 0.12
  synergyEffect:
    exposeImpactOnHitChance: 0.25
  notes: 很適合史萊姆娘做暴力輸出流

- id: gene_generic_zone_mastery
  name: 區域調律
  geneType: generic
  compatibleFamilies: [weave]
  baseEffect:
    zoneDamageMult: 0.10
  synergyEffect:
    zoneDurationAdd: 1
  notes: 妖織系區域玩法核心通用基因

- id: gene_generic_projectile_guard
  name: 遠程抗性
  geneType: generic
  compatibleFamilies: [membrane]
  baseEffect:
    projectileDamageReduction: 0.12
  synergyEffect:
    interceptProjectileChance: 0.20
  notes: 護膜系更能把抗性轉成攔截價值
```

---

## 五、武器資料表

### 武器共通規則

- 同一把武器可被不同證使用
- 符合最低條件即可進入 `base_mode`
- 完整匹配則進入 `perfect_match_mode`
- `perfect_match_mode` 可開啟：
  - 完整傷害公式
  - 位移 / 換位 / 推拉
  - 更完整打斷
  - 附帶狀態

### 基礎武器

```yaml
- id: weapon_fang_rend_dash
  name: 裂牙突進
  familyHint: fang
  weaponType: line_thrust
  damageType: pierce
  elementType: none
  statScaling: AGI
  actionTags: [dash, interrupt_heavy]
  requiredTags: []
  preferredFamilies: [fang]
  preferredTags: [has_claws, has_tail]
  baseCast: 18
  baseRecovery: 28
  baseDamage: 32
  baseInterrupt: 1
  baseMode:
    damageMult: 0.95
    enableSelfAdvance: false
    extraInterruptTags: []
    extraStatuses: []
  perfectMatchMode:
    damageMult: 1.00
    enableSelfAdvance: true
    extraInterruptTags: [heavy_cast]
    extraStatuses: []
  slotProfile:
    tempo: 1
    tactical: 1
    enchant: 1
  notes: 牙刃系完整適配時可開啟前進與更完整破重招

- id: weapon_membrane_gel_guard
  name: 凝膠護打
  familyHint: membrane
  weaponType: guard_bash
  damageType: impact
  elementType: none
  statScaling: STR
  actionTags: [guard, bind]
  requiredTags: []
  preferredFamilies: [membrane]
  preferredTags: [gel_body]
  baseCast: 16
  baseRecovery: 24
  baseDamage: 22
  baseInterrupt: 1
  baseMode:
    damageMult: 1.00
    enableProtectNeighbor: false
    extraInterruptTags: []
    extraStatuses: [slow]
  perfectMatchMode:
    damageMult: 1.00
    enableProtectNeighbor: true
    extraInterruptTags: [projectile_cast]
    extraStatuses: [bind]
  slotProfile:
    tempo: 1
    tactical: 1
    enchant: 1
  notes: 護膜系完整適配時可開啟保護鄰格與更完整限位

- id: weapon_weave_fallburst
  name: 落羽咒爆
  familyHint: weave
  weaponType: ground_burst
  damageType: slash
  elementType: wind
  statScaling: INT
  actionTags: [blast]
  requiredTags: []
  preferredFamilies: [weave]
  preferredTags: [has_wings]
  baseCast: 24
  baseRecovery: 26
  baseDamage: 24
  baseInterrupt: 1
  baseMode:
    damageMult: 1.00
    enableZoneBonus: false
    extraInterruptTags: []
    extraStatuses: []
  perfectMatchMode:
    damageMult: 1.00
    enableZoneBonus: true
    extraInterruptTags: [zone_cast]
    extraStatuses: [burn]
  slotProfile:
    tempo: 1
    tactical: 1
    enchant: 1
  notes: 妖織系完整適配時可開啟更完整的區域與燃燒鋪墊
```

### 進階專用武器

```yaml
- id: weapon_fang_shadow_fang
  name: 影牙連襲
  familyHint: fang
  weaponType: side_slash
  damageType: slash
  elementType: none
  statScaling: AGI
  actionTags: [dash, backstab]
  requiredTags: []
  preferredFamilies: [fang]
  preferredTags: [has_claws]
  baseCast: 16
  baseRecovery: 24
  baseDamage: 34
  baseInterrupt: 1
  baseMode:
    damageMult: 0.95
    enableSelfAdvance: false
    extraInterruptTags: []
    extraStatuses: []
  perfectMatchMode:
    damageMult: 1.00
    enableSelfAdvance: true
    extraInterruptTags: []
    extraStatuses: [expose_slash]
  slotProfile: { tempo: 1, tactical: 1, enchant: 1 }
  notes: 獵月證專武，強化背刺與追擊

- id: weapon_fang_crash_tusk
  name: 崩牙重突
  familyHint: fang
  weaponType: line_thrust
  damageType: pierce
  elementType: none
  statScaling: STR
  actionTags: [dash, interrupt_heavy]
  requiredTags: []
  preferredFamilies: [fang]
  preferredTags: [has_claws, has_tail]
  baseCast: 22
  baseRecovery: 30
  baseDamage: 42
  baseInterrupt: 2
  baseMode:
    damageMult: 0.95
    enableSelfAdvance: false
    extraInterruptTags: []
    extraStatuses: []
  perfectMatchMode:
    damageMult: 1.00
    enableSelfAdvance: true
    extraInterruptTags: [heavy_cast]
    extraStatuses: []
  slotProfile: { tempo: 1, tactical: 1, enchant: 1 }
  notes: 裂牙證專武，強化正面突破與破重招

- id: weapon_membrane_tide_bash
  name: 潮膜護撞
  familyHint: membrane
  weaponType: guard_bash
  damageType: impact
  elementType: none
  statScaling: STR
  actionTags: [guard]
  requiredTags: []
  preferredFamilies: [membrane]
  preferredTags: [gel_body]
  baseCast: 18
  baseRecovery: 24
  baseDamage: 24
  baseInterrupt: 1
  baseMode:
    damageMult: 1.00
    enableProtectNeighbor: false
    extraInterruptTags: []
    extraStatuses: []
  perfectMatchMode:
    damageMult: 1.00
    enableProtectNeighbor: true
    extraInterruptTags: [projectile_cast]
    extraStatuses: [guarded]
  slotProfile: { tempo: 1, tactical: 1, enchant: 1 }
  notes: 護潮證專武，強化保護與攔截

- id: weapon_membrane_corrode_press
  name: 蝕液重壓
  familyHint: membrane
  weaponType: heavy_slam
  damageType: impact
  elementType: dark
  statScaling: INT
  actionTags: [bind]
  requiredTags: []
  preferredFamilies: [membrane]
  preferredTags: [gel_body]
  baseCast: 20
  baseRecovery: 28
  baseDamage: 26
  baseInterrupt: 1
  baseMode:
    damageMult: 1.00
    enableProtectNeighbor: false
    extraInterruptTags: []
    extraStatuses: [slow]
  perfectMatchMode:
    damageMult: 1.00
    enableProtectNeighbor: false
    extraInterruptTags: []
    extraStatuses: [vulnerable, bind]
  slotProfile: { tempo: 1, tactical: 1, enchant: 1 }
  notes: 蝕黏證專武，強化腐蝕與易傷鋪墊

- id: weapon_weave_echo_arrow
  name: 裂響羽矢
  familyHint: weave
  weaponType: line_shot
  damageType: pierce
  elementType: wind
  statScaling: INT
  actionTags: [shot, interrupt_projectile]
  requiredTags: []
  preferredFamilies: [weave]
  preferredTags: [has_wings]
  baseCast: 18
  baseRecovery: 22
  baseDamage: 26
  baseInterrupt: 1
  baseMode:
    damageMult: 1.00
    enableZoneBonus: false
    extraInterruptTags: []
    extraStatuses: []
  perfectMatchMode:
    damageMult: 1.00
    enableZoneBonus: false
    extraInterruptTags: [projectile_cast, zone_cast]
    extraStatuses: [shock]
  slotProfile: { tempo: 1, tactical: 1, enchant: 1 }
  notes: 鳴羽證專武，強化拆施法與遠程干擾

- id: weapon_weave_blaze_drop
  name: 焰羽墜爆
  familyHint: weave
  weaponType: ground_burst
  damageType: slash
  elementType: fire
  statScaling: INT
  actionTags: [blast]
  requiredTags: []
  preferredFamilies: [weave]
  preferredTags: [has_wings]
  baseCast: 26
  baseRecovery: 28
  baseDamage: 28
  baseInterrupt: 1
  baseMode:
    damageMult: 1.00
    enableZoneBonus: false
    extraInterruptTags: []
    extraStatuses: []
  perfectMatchMode:
    damageMult: 1.00
    enableZoneBonus: true
    extraInterruptTags: []
    extraStatuses: [burn, vulnerable]
  slotProfile: { tempo: 1, tactical: 1, enchant: 1 }
  notes: 灼羽證專武，強化燃燒與爆發鋪墊

- id: weapon_fang_mountain_break
  name: 山王崩牙
  familyHint: fang
  weaponType: boss_charge
  damageType: pierce
  elementType: none
  statScaling: STR
  actionTags: [dash, interrupt_heavy]
  requiredTags: [forest_apex]
  preferredFamilies: [fang]
  preferredTags: [has_claws, has_tail]
  baseCast: 28
  baseRecovery: 34
  baseDamage: 58
  baseInterrupt: 3
  baseMode:
    damageMult: 1.00
    enableSelfAdvance: true
    extraInterruptTags: [heavy_cast]
    extraStatuses: []
  perfectMatchMode:
    damageMult: 1.10
    enableSelfAdvance: true
    extraInterruptTags: [heavy_cast]
    extraStatuses: [guard_break]
  slotProfile: { tempo: 0, tactical: 0, enchant: 0 }
  notes: 山王牙證 Boss 專武，MVP1 只作 Boss 使用
```

---

## 六、戰術工具資料表

### 工具規則

- 玩家單位為主要使用者
- 地城敵人原則上不使用
- MVP1 先做有限次數工具，不以傳統補血藥為主

```yaml
- id: tool_war_drum
  name: 戰鼓
  toolType: burst
  charges: 1
  timing: combat
  effectSummary:
    teamDamageBuff: 0.20
    durationActions: 2
  notes: 爆發窗口工具，放大三人連技

- id: tool_membrane_pack
  name: 護膜包
  toolType: defense
  charges: 1
  timing: combat
  effectSummary:
    shieldValue: 20
    durationActions: 2
  notes: 緊急保命工具

- id: tool_cleanse_mist
  name: 淨化霧瓶
  toolType: utility
  charges: 1
  timing: combat
  effectSummary:
    removeStatuses: [burn, bind, shock]
  notes: 解狀態工具

- id: tool_echo_bomb
  name: 驚鳴彈
  toolType: control
  charges: 1
  timing: combat
  effectSummary:
    interruptBonusVs: [light_cast, projectile_cast]
  notes: 用於補足打斷窗口

- id: tool_sticky_capsule
  name: 黏網膠囊
  toolType: control
  charges: 1
  timing: combat
  effectSummary:
    applyStatus: bind
    area: small
  notes: 限位工具，配合史萊姆娘或鳥身女妖鋪場

- id: tool_quick_pulse
  name: 迅捷脈衝
  toolType: tempo
  charges: 1
  timing: combat
  effectSummary:
    recoveryMult: -0.20
    durationActions: 1
  notes: 節奏工具，可讓主攻手快速完成收頭
```

---

## 七、MVP1 首批推薦配置

### 玩家御三家推薦初始配置

```yaml
- cert: cert_fang_moonwolf
  weaponLoadout:
    - weapon_fang_rend_dash
  exclusiveGene:
    - gene_ex_fang_hunt_echo
    - gene_ex_fang_break_instinct
  genericGeneSlots: 2
  toolSlots: 1
  recommendedTool: tool_war_drum

- cert: cert_membrane_gel
  weaponLoadout:
    - weapon_membrane_gel_guard
  exclusiveGene:
    - gene_ex_membrane_regen
    - gene_ex_membrane_corrode
  genericGeneSlots: 2
  toolSlots: 1
  recommendedTool: tool_membrane_pack

- cert: cert_weave_windfeather
  weaponLoadout:
    - weapon_weave_fallburst
  exclusiveGene:
    - gene_ex_weave_hex_extend
    - gene_ex_weave_resonance
  genericGeneSlots: 2
  toolSlots: 1
  recommendedTool: tool_echo_bomb
```

---

## 八、對現有引擎的影響評估

### 可沿用的方向

從目前 `newProject/engine/damage.ts` 來看，現有引擎已經有：

- `ResolvedWeapon`
- `actionTags`
- `FormulaKeySet`
- 由詞條蒐集後再進傷害公式的結構

這代表以下方向可沿用：

- 把基因、武器完美適配、工具 buff 視為新的公式來源
- 在 `buildFormulaKeySet()` 前後增加資料來源，而不是全部推翻傷害計算骨架
- 用 `actionTags` 與未來的 `interruptTags`、`matchTags` 做條件判定

### 需要新增或調整的核心欄位

至少需要補進或擴充：

- `Unit.certId`
- `Unit.geneLoadout`
- `Unit.toolLoadout`
- `ResolvedWeapon.baseMode`
- `ResolvedWeapon.perfectMatchMode`
- `ResolvedWeapon.matchResult`
- `Unit.statuses` 或可被 resolve 的戰鬥狀態容器

### 建議優先重構的地方

1. `ResolvedWeapon` 的生成流程
   - 先 resolve 武器骨架
   - 再檢查證件與武器的匹配結果
   - 再決定當前是 `base_mode` 還是 `perfect_match_mode`

2. `buildFormulaKeySet()` 的來源
   - 目前主要從 affix 收集公式 key
   - 之後要擴充成：
     - 武器模式
     - 基因
     - 工具
     - 狀態效果

3. 傷害類型 enum
   - 目前 `damage.ts` 用的是 `slash | crush | pierce | fire | water | wood | light | dark`
   - 與新文件中的 `impact / fire / ice / lightning / wind` 不完全一致
   - 需要統一 nomenclature，否則後面資料表會對不上

### UI 與前端判斷

目前我傾向：

- **引擎保留部分骨架，逐步重構**
- **UI 可以考慮直接重寫**

原因：

- 新系統的核心介面已經從傳統裝備 / 詞條展示，轉成：
  - 證件
  - 武器匹配
  - 基因裝配
  - 工具配置
- 這種編成介面與戰鬥資訊顯示，很可能與舊 UI 的資訊架構完全不同

因此：

- 若舊 UI 是為前一版產品邏輯設計，直接翻掉通常比硬改更乾淨
- 引擎則可保留純計算模組、事件流與 reducer 思路，再逐步替換資料來源

### 目前的總判斷

- **資料面：可以直接往新資料表前進**
- **引擎：建議保留計算骨架、重做資料模型與 resolve 流程**
- **UI：高機率值得直接重寫**

---

## 九、下一步建議

最值得立即接續的是：

- 以本文件為藍本，建立 `ts` 型別草稿
- 定義 `CertDef`、`WeaponDef`、`GeneDef`、`ToolDef`
- 統一 `damage.ts` 的傷害類型命名
- 設計 `resolveWeaponMatch()` 與 `resolveGeneEffects()`
- 評估 UI 是否直接以新證件編成畫面重做

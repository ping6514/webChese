# 魔物娘軍團卡設計（最終版）

## 📖 名詞定義

### **核心概念**
- **首領卡** - 一個戰棋，可以率領軍團（小兵）
- **軍團卡** - 小兵，可以安裝在首領卡上
- **軍隊** - 首領卡 + 軍團卡 = 一個完整的戰鬥單位

### **軍團召喚規則**
1. **正常召喚** - 一回合一次，將手牌的軍團卡安裝在正確的首領上
2. **軍團替換** - 可以替換已安裝的軍團卡（舊軍團卡棄置）
3. **一對一** - 一個首領一次只能攜帶一個軍團
4. **特殊召喚** - 若有特殊召喚條件或事件卡效果，可一回合超過一次安裝

### **軍團卡安裝成本**
- **手牌成本** - 安裝時丟棄指定數量的手牌（任意卡牌）
- **免費安裝** - 部分基礎軍團卡可以免費安裝（不需丟棄手牌）

### **首領被擊敗處理**
- **擊敗條件** - 堅韌完全歸0被擊暈狀態後，再被攻擊一次收割，回到基地等待復活
- **軍團卡處理** - 首領被擊敗時，裝備的軍團卡**棄置**

### **軍團卡 ≠ 反應卡**
- **軍團卡** - 提供數值+主動技能+安裝效果
- **反應卡** - 被攻擊時觸發的防禦卡（另一個系統，未設計）

---

## 🎯 設計理念

### **軍團卡分類**
1. **通用軍團卡** - `suitableClass: ['all']` - 所有首領可裝備
2. **破壞者軍團卡** - `suitableClass: ['destroyer']` - 只有破壞者可裝備
3. **征服者軍團卡** - `suitableClass: ['conqueror']` - 只有征服者可裝備
4. **指揮官軍團卡** - `suitableClass: ['commander']` - 只有指揮官可裝備
5. **守護者軍團卡** - `suitableClass: ['guardian']` - 只有守護者可裝備

---

## 📊 設計原則

### **1. 屬性加成配置**

| 類型 | 堅韌 | 對敵 | 防護協助 | 攻擊協助 | 回復力 |
|------|------|------|----------|----------|--------|
| **攻擊型** | +1 | +2 | +0 | +2 | +0 |
| **防守型** | +2 | +0 | +2 | +0 | +1 |
| **回復型** | +1 | +0 | +1 | +0 | +2 |
| **平衡型** | +1 | +1 | +1 | +1 | +0 |

### **2. 安裝成本設計**

| 成本類型 | 說明 | 適用軍團卡 |
|---------|------|-----------|
| **免費** | 不需丟棄手牌 | 基礎軍團卡（通用卡） |
| **丟牌1** | 丟棄1張手牌 | 中等強度軍團卡 |
| **丟牌2** | 丟棄2張手牌 | 強力軍團卡 |
| **丟牌3** | 丟棄3張手牌 | 超強軍團卡 |

### **3. 技能成本設計**

| 成本類型 | 說明 | 適用技能 | 冷卻 |
|---------|------|---------|------|
| **免費** | 不需丟棄手牌 | 弱效技能 | 1-2回合 |
| **丟牌1** | 丟棄1張手牌 | 基礎戰術技能 | 1-2回合 |
| **丟牌2** | 丟棄2張手牌 | 強力戰術技能 | 2-3回合 |

### **4. 安裝效果（onEquip）**

| 效果類型 | 說明 |
|---------|------|
| **抽牌** | 安裝時抽1-2張牌 |
| **堆磚** | 安裝時堆磚1 |
| **回復** | 安裝時回復1-2 |
| **無** | 無安裝效果 |

### **5. 首領被擊敗處理**

**所有軍團卡在首領被擊敗時都會棄置**
- 首領被擊敗 = 堅韌歸0被擊暈後，再被攻擊一次收割
- 軍團卡自動棄置到墓地
- 首領復活後需要重新安裝軍團卡

---

## 🌐 通用軍團卡（所有首領可用）

### **1. 精銳步兵**
```typescript
{
  id: 'elite_infantry',
  name: '精銳步兵',
  suitableClass: ['all'],
  
  equipCost: {
    tech: 1
  },
  
  bonusStats: {
    toughness: 1,
    attack: 1,
    defensiveSupport: 1,
    offensiveSupport: 1,
    recovery: 0
  },
  
  // 安裝效果
  onEquip: {
    type: 'draw_card',
    value: 1,
    description: '安裝時抽1張牌'
  },
  
  // 附帶技能：戰術支援
  attachedSkill: {
    name: '戰術支援',
    description: '丟棄1張手牌：本回合攻擊協助+2、防護協助+2',
    timing: ['action_phase'],
    cost: { discard: 1 },
    cooldown: 2,
    effect: [
      {
        type: 'offensive_support_bonus',
        value: 2,
        duration: 'this_turn',
        description: '本回合攻擊協助+2'
      },
      {
        type: 'defensive_support_bonus',
        value: 2,
        duration: 'this_turn',
        description: '本回合防護協助+2'
      }
    ]
  },
  
  // 首領被擊敗時，軍團卡自動棄置
}
```

### **2. 弓箭手隊**
```typescript
{
  id: 'archer_squad',
  name: '弓箭手隊',
  suitableClass: ['all'],
  
  equipCost: {
    tech: 1
  },
  
  bonusStats: {
    toughness: 0,
    attack: 2,
    defensiveSupport: 0,
    offensiveSupport: 2,
    recovery: 0
  },
  
  // 安裝效果
  onEquip: null,
  
  // 附帶技能：遠程射擊
  attachedSkill: {
    name: '遠程射擊',
    description: '丟棄1張手牌：對任意區域內1位敵首領對敵2',
    timing: ['action_phase'],
    cost: { discard: 1 },
    cooldown: 1,
    effect: [
      {
        type: 'single_target_damage',
        value: 2,
        target: 'enemy_leader_any_zone',
        description: '對任意區域內1位敵首領對敵2'
      }
    ]
  },
  
  // 首領被擊敗時，軍團卡自動棄置
}
```

### **3. 盾兵隊**
```typescript
{
  id: 'shield_squad',
  name: '盾兵隊',
  suitableClass: ['all'],
  
  equipCost: {
    tech: 1
  },
  
  bonusStats: {
    toughness: 2,
    attack: 0,
    defensiveSupport: 2,
    offensiveSupport: 0,
    recovery: 1
  },
  
  // 安裝效果
  onEquip: {
    type: 'build_brick',
    value: 1,
    description: '安裝時在區域內堆磚1'
  },
  
  // 附帶技能：防禦陣型
  attachedSkill: {
    name: '防禦陣型',
    description: '丟棄1張手牌：本回合堅韌+3、防護協助+3',
    timing: ['action_phase'],
    cost: { discard: 1 },
    cooldown: 2,
    effect: [
      {
        type: 'toughness_bonus',
        value: 3,
        duration: 'this_turn',
        description: '本回合堅韌+3'
      },
      {
        type: 'defensive_support_bonus',
        value: 3,
        duration: 'this_turn',
        description: '本回合防護協助+3'
      }
    ]
  },
  
  onLeaderKO: {
    type: 'keep',
    cost: { discard: 0 },
  }
}
```

### **4. 醫療兵**
```typescript
{
  id: 'medic_squad',
  name: '醫療兵',
  suitableClass: ['all'],
  
  equipCost: {
    discard: 1
  },
  
  bonusStats: {
    toughness: 1,
    attack: 0,
    defensiveSupport: 1,
    offensiveSupport: 0,
    recovery: 3
  },
  
  // 安裝效果
  onEquip: {
    type: 'heal_self',
    value: 2,
    description: '安裝時回復2'
  },
  
  // 附帶技能：緊急治療
  attachedSkill: {
    name: '緊急治療',
    description: '丟棄1張手牌：區域內所有我方首領回復2',
    timing: ['action_phase'],
    cost: { discard: 1 },
    cooldown: 2,
    effect: [
      {
        type: 'area_heal',
        value: 2,
        target: 'all_ally_leaders_in_zone',
        description: '區域內所有我方首領回復2'
      }
    ]
  },
  
  // 首領被擊敗時，軍團卡自動棄置
}
```

### **5. 偵察兵**
```typescript
{
  id: 'scout_squad',
  name: '偵察兵',
  suitableClass: ['all'],
  
  equipCost: {
    discard: 1
  },
  
  bonusStats: {
    toughness: 0,
    attack: 1,
    defensiveSupport: 0,
    offensiveSupport: 1,
    recovery: 0
  },
  
  // 安裝效果
  onEquip: {
    type: 'draw_card',
    value: 2,
    description: '安裝時抽2張牌'
  },
  
  // 附帶技能：偵察情報
  attachedSkill: {
    name: '偵察情報',
    description: '丟棄1張手牌：抽2張牌',
    timing: ['action_phase'],
    cost: { discard: 1 },
    cooldown: 2,
    effect: [
      {
        type: 'draw_card',
        value: 2,
        description: '抽2張牌'
      }
    ]
  },
  
  // 首領被擊敗時，軍團卡自動棄置
}
```

### **6. 工兵隊**
```typescript
{
  id: 'engineer_squad',
  name: '工兵隊',
  suitableClass: ['all'],
  
  equipCost: {
    discard: 2
  },
  
  bonusStats: {
    toughness: 1,
    attack: 0,
    defensiveSupport: 1,
    offensiveSupport: 0,
    recovery: 1
  },
  
  // 安裝效果
  onEquip: {
    type: 'build_brick',
    value: 1,
    description: '安裝時在任意區域堆磚1'
  },
  
  // 附帶技能：快速築城
  attachedSkill: {
    name: '快速築城',
    description: '丟棄1張手牌：在任意區域堆磚2',
    timing: ['action_phase'],
    cost: { discard: 1 },
    cooldown: 2,
    effect: [
      {
        type: 'build_brick',
        value: 2,
        range: 'any_zone',
        description: '在任意區域堆磚2'
      }
    ]
  }
}
```

---

## 💥 破壞者軍團卡

### **1. 攻城兵團**
```typescript
{
  id: 'siege_legion',
  name: '攻城兵團',
  suitableClass: ['destroyer'],
  
  equipCost: {
    discard: 1
  },
  
  bonusStats: {
    toughness: 1,
    attack: 2,
    defensiveSupport: 0,
    offensiveSupport: 2,
    recovery: 0
  },
  
  // 安裝效果
  onEquip: null,
  
  // 附帶技能：破城突擊
  attachedSkill: {
    name: '破城突擊',
    description: '丟棄1張手牌：清磚2，若清除敵主堡區磚堆則攻城1',
    timing: ['action_phase'],
    cost: { discard: 1 },
    cooldown: 2,
    effect: [
      {
        type: 'clear_brick',
        value: 2,
        target: 'current_zone',
        description: '清磚2'
      },
      {
        type: 'siege',
        value: 1,
        condition: 'cleared_enemy_fortress_brick',
        description: '若清除敵主堡區磚堆則攻城1'
      }
    ]
  },
  
  // 首領被擊敗時，軍團卡自動棄置
}
```

### **2. 破壞工兵**
```typescript
{
  id: 'demolition_squad',
  name: '破壞工兵',
  suitableClass: ['destroyer'],
  
  equipCost: {
    discard: 2
  },
  
  bonusStats: {
    toughness: 1,
    attack: 1,
    defensiveSupport: 0,
    offensiveSupport: 1,
    recovery: 0
  },
  
  // 安裝效果
  onEquip: null,
  
  // 附帶技能：爆破清場
  attachedSkill: {
    name: '爆破清場',
    description: '丟棄2張手牌：區域內及相鄰區域清磚1，區域內所有敵首領對敵1',
    timing: ['action_phase'],
    cost: { discard: 2 },
    cooldown: 3,
    effect: [
      {
        type: 'clear_brick',
        value: 1,
        target: 'current_and_adjacent_zones',
        description: '區域內及相鄰區域清磚1'
      },
      {
        type: 'area_damage',
        value: 1,
        target: 'all_enemy_leaders_in_zone',
        description: '區域內所有敵首領對敵1'
      }
    ]
  },
  
  // 首領被擊敗時，軍團卡自動棄置
}
```

### **3. 狂戰士隊**
```typescript
{
  id: 'berserker_squad',
  name: '狂戰士隊',
  suitableClass: ['destroyer'],
  
  equipCost: {
    discard: 1
  },
  
  bonusStats: {
    toughness: 0,
    attack: 3,
    defensiveSupport: 0,
    offensiveSupport: 2,
    recovery: 0
  },
  
  // 安裝效果
  onEquip: null,
  
  // 附帶技能：狂暴衝鋒
  attachedSkill: {
    name: '狂暴衝鋒',
    description: '丟棄1張手牌：本回合對敵+3、清磚+1',
    timing: ['action_phase'],
    cost: { discard: 1 },
    cooldown: 2,
    effect: [
      {
        type: 'attack_bonus',
        value: 3,
        duration: 'this_turn',
        description: '本回合對敵+3'
      },
      {
        type: 'clear_brick_bonus',
        value: 1,
        duration: 'this_turn',
        description: '本回合清磚+1'
      }
    ]
  },
  
  // 首領被擊敗時，軍團卡自動棄置
}
```

### **4. 重裝突擊隊**
```typescript
{
  id: 'heavy_assault_squad',
  name: '重裝突擊隊',
  suitableClass: ['destroyer'],
  
  equipCost: {
    discard: 2
  },
  
  bonusStats: {
    toughness: 2,
    attack: 2,
    defensiveSupport: 0,
    offensiveSupport: 1,
    recovery: 0
  },
  
  // 安裝效果
  onEquip: {
    type: 'clear_brick',
    value: 1,
    description: '安裝時清磚1'
  },
  
  // 附帶技能：重裝突破
  attachedSkill: {
    name: '重裝突破',
    description: '丟棄2張手牌：清磚3並對區域內1位敵首領對敵3',
    timing: ['action_phase'],
    cost: { discard: 2 },
    cooldown: 3,
    effect: [
      {
        type: 'clear_brick',
        value: 3,
        target: 'current_zone',
        description: '清磚3'
      },
      {
        type: 'single_target_damage',
        value: 3,
        target: 'enemy_leader_in_zone',
        description: '對區域內1位敵首領對敵3'
      }
    ]
  },
  
  // 首領被擊敗時，軍團卡自動棄置
}
```

---

## ⚔️ 征服者軍團卡

### **1. 騎兵隊**
```typescript
{
  id: 'cavalry_squad',
  name: '騎兵隊',
  suitableClass: ['conqueror'],
  
  equipCost: {
    discard: 1
  },
  
  bonusStats: {
    toughness: 1,
    attack: 2,
    defensiveSupport: 0,
    offensiveSupport: 2,
    recovery: 0
  },
  
  // 安裝效果
  onEquip: null,
  
  // 附帶技能：騎兵衝鋒
  attachedSkill: {
    name: '騎兵衝鋒',
    description: '丟棄1張手牌：移動到相鄰區域並對該區域內1位敵首領對敵3',
    timing: ['action_phase'],
    cost: { discard: 1 },
    cooldown: 2,
    effect: [
      {
        type: 'force_move',
        target: 'adjacent_zone',
        description: '移動到相鄰區域'
      },
      {
        type: 'single_target_damage',
        value: 3,
        target: 'enemy_leader_in_zone',
        description: '對該區域內1位敵首領對敵3'
      }
    ]
  },
  
  // 首領被擊敗時，軍團卡自動棄置
}
```

### **2. 游擊隊**
```typescript
{
  id: 'guerrilla_squad',
  name: '游擊隊',
  suitableClass: ['conqueror'],
  
  equipCost: {
    discard: 1
  },
  
  bonusStats: {
    toughness: 0,
    attack: 2,
    defensiveSupport: 0,
    offensiveSupport: 1,
    recovery: 1
  },
  
  // 安裝效果
  onEquip: {
    type: 'draw_card',
    value: 1,
    description: '安裝時抽1張牌'
  },
  
  // 附帶技能：游擊戰術
  attachedSkill: {
    name: '游擊戰術',
    description: '丟棄1張手牌：對區域內1位敵首領對敵2並移動到相鄰區域',
    timing: ['action_phase'],
    cost: { discard: 1 },
    cooldown: 1,
    effect: [
      {
        type: 'single_target_damage',
        value: 2,
        target: 'enemy_leader_in_zone',
        description: '對區域內1位敵首領對敵2'
      },
      {
        type: 'force_move',
        target: 'adjacent_zone',
        description: '移動到相鄰區域'
      }
    ]
  },
  
  // 首領被擊敗時，軍團卡自動棄置
}
```

### **3. 突襲隊**
```typescript
{
  id: 'raider_squad',
  name: '突襲隊',
  suitableClass: ['conqueror'],
  
  equipCost: {
    discard: 2
  },
  
  bonusStats: {
    toughness: 1,
    attack: 3,
    defensiveSupport: 0,
    offensiveSupport: 2,
    recovery: 0
  },
  
  // 安裝效果
  onEquip: null,
  
  // 附帶技能：快速突襲
  attachedSkill: {
    name: '快速突襲',
    description: '丟棄2張手牌：對區域內所有敵首領對敵2並可移動到相鄰區域',
    timing: ['action_phase'],
    cost: { discard: 2 },
    cooldown: 3,
    effect: [
      {
        type: 'area_damage',
        value: 2,
        target: 'all_enemy_leaders_in_zone',
        description: '對區域內所有敵首領對敵2'
      },
      {
        type: 'force_move',
        target: 'adjacent_zone',
        optional: true,
        description: '可移動到相鄰區域'
      }
    ]
  },
  
  // 首領被擊敗時，軍團卡自動棄置
}
```

### **4. 獵殺者隊**
```typescript
{
  id: 'hunter_squad',
  name: '獵殺者隊',
  suitableClass: ['conqueror'],
  
  equipCost: {
    discard: 1
  },
  
  bonusStats: {
    toughness: 0,
    attack: 2,
    defensiveSupport: 0,
    offensiveSupport: 1,
    recovery: 1
  },
  
  // 安裝效果
  onEquip: null,
  
  // 附帶技能：追擊斬殺
  attachedSkill: {
    name: '追擊斬殺',
    description: '丟棄1張手牌：對堅韌低於3的敵首領對敵4',
    timing: ['action_phase'],
    cost: { discard: 1 },
    cooldown: 2,
    activationCondition: {
      type: 'state',
      value: 'target_toughness_below_3'
    },
    effect: [
      {
        type: 'single_target_damage',
        value: 4,
        target: 'low_toughness_enemy',
        description: '對堅韌低於3的敵首領對敵4'
      }
    ]
  },
  
  // 首領被擊敗時，軍團卡自動棄置
}
```

---

## 🎯 指揮官軍團卡

### **1. 戰術小隊**
```typescript
{
  id: 'tactical_squad',
  name: '戰術小隊',
  suitableClass: ['commander'],
  
  equipCost: {
    discard: 1
  },
  
  bonusStats: {
    toughness: 1,
    attack: 1,
    defensiveSupport: 2,
    offensiveSupport: 2,
    recovery: 0
  },
  
  // 安裝效果
  onEquip: {
    type: 'draw_card',
    value: 1,
    description: '安裝時抽1張牌'
  },
  
  // 附帶技能：戰術指揮
  attachedSkill: {
    name: '戰術指揮',
    description: '丟棄1張手牌：區域內所有我方首領本回合攻擊協助+2、防護協助+2',
    timing: ['action_phase'],
    cost: { discard: 1 },
    cooldown: 2,
    effect: [
      {
        type: 'area_buff',
        target: 'all_ally_leaders_in_zone',
        offensiveSupportBonus: 2,
        defensiveSupportBonus: 2,
        duration: 'this_turn',
        description: '區域內所有我方首領本回合攻擊協助+2、防護協助+2'
      }
    ]
  },
  
  // 首領被擊敗時，軍團卡自動棄置
}
```

### **2. 控制小隊**
```typescript
{
  id: 'control_squad',
  name: '控制小隊',
  suitableClass: ['commander'],
  
  equipCost: {
    discard: 2
  },
  
  bonusStats: {
    toughness: 1,
    attack: 1,
    defensiveSupport: 1,
    offensiveSupport: 2,
    recovery: 0
  },
  
  // 安裝效果
  onEquip: null,
  
  // 附帶技能：戰術禁錮
  attachedSkill: {
    name: '戰術禁錮',
    description: '丟棄2張手牌：選擇區域內1位敵首領，下回合禁錮（不能移動、不能攻城）',
    timing: ['action_phase'],
    cost: { discard: 2 },
    cooldown: 3,
    effect: [
      {
        type: 'immobilize',
        target: 'single_enemy_leader_in_zone',
        duration: 'next_turn',
        description: '目標下回合禁錮'
      }
    ]
  },
  
  // 首領被擊敗時，軍團卡自動棄置
}
```

### **3. 削弱小隊**
```typescript
{
  id: 'debuff_squad',
  name: '削弱小隊',
  suitableClass: ['commander'],
  
  equipCost: {
    discard: 1
  },
  
  bonusStats: {
    toughness: 1,
    attack: 1,
    defensiveSupport: 1,
    offensiveSupport: 2,
    recovery: 0
  },
  
  // 安裝效果
  onEquip: null,
  
  // 附帶技能：戰術削弱
  attachedSkill: {
    name: '戰術削弱',
    description: '丟棄1張手牌：區域內所有敵首領下回合對敵-2、防護協助-2',
    timing: ['action_phase'],
    cost: { discard: 1 },
    cooldown: 2,
    effect: [
      {
        type: 'area_debuff',
        target: 'all_enemy_leaders_in_zone',
        attackDebuff: 2,
        defensiveSupportDebuff: 2,
        duration: 'next_turn',
        description: '區域內所有敵首領下回合對敵-2、防護協助-2'
      }
    ]
  },
  
  // 首領被擊敗時，軍團卡自動棄置
}
```

### **4. 干擾小隊**
```typescript
{
  id: 'disruption_squad',
  name: '干擾小隊',
  suitableClass: ['commander'],
  
  equipCost: {
    discard: 2
  },
  
  bonusStats: {
    toughness: 1,
    attack: 1,
    defensiveSupport: 2,
    offensiveSupport: 1,
    recovery: 0
  },
  
  // 安裝效果
  onEquip: {
    type: 'draw_card',
    value: 1,
    description: '安裝時抽1張牌'
  },
  
  // 附帶技能：技能封鎖
  attachedSkill: {
    name: '技能封鎖',
    description: '丟棄2張手牌：選擇區域內1位敵首領，下回合不能使用技能',
    timing: ['action_phase'],
    cost: { discard: 2 },
    cooldown: 3,
    effect: [
      {
        type: 'disable_skill',
        target: 'single_enemy_leader_in_zone',
        duration: 'next_turn',
        description: '目標下回合不能使用技能'
      }
    ]
  },
  
  // 首領被擊敗時，軍團卡自動棄置
}
```

---

## 🛡️ 守護者軍團卡

### **1. 防禦工兵**
```typescript
{
  id: 'defensive_engineers',
  name: '防禦工兵',
  suitableClass: ['guardian'],
  
  equipCost: {
    discard: 1
  },
  
  bonusStats: {
    toughness: 2,
    attack: 0,
    defensiveSupport: 2,
    offensiveSupport: 0,
    recovery: 1
  },
  
  // 安裝效果
  onEquip: {
    type: 'build_brick',
    value: 1,
    description: '安裝時在區域內堆磚1'
  },
  
  // 附帶技能：緊急築城
  attachedSkill: {
    name: '緊急築城',
    description: '丟棄1張手牌：在任意區域堆磚2',
    timing: ['action_phase'],
    cost: { discard: 1 },
    cooldown: 2,
    effect: [
      {
        type: 'build_brick',
        value: 2,
        range: 'any_zone',
        description: '在任意區域堆磚2'
      }
    ]
  },
  
  onLeaderKO: {
    type: 'keep',
    cost: { discard: 0 },
  }
}
```

### **2. 治療小隊**
```typescript
{
  id: 'healing_squad',
  name: '治療小隊',
  suitableClass: ['guardian'],
  
  equipCost: {
    discard: 1
  },
  
  bonusStats: {
    toughness: 1,
    attack: 0,
    defensiveSupport: 1,
    offensiveSupport: 0,
    recovery: 3
  },
  
  // 安裝效果
  onEquip: {
    type: 'heal_self',
    value: 2,
    description: '安裝時回復2'
  },
  
  // 附帶技能：群體治療
  attachedSkill: {
    name: '群體治療',
    description: '丟棄1張手牌：區域內所有我方首領回復2',
    timing: ['action_phase'],
    cost: { discard: 1 },
    cooldown: 2,
    effect: [
      {
        type: 'area_heal',
        value: 2,
        target: 'all_ally_leaders_in_zone',
        description: '區域內所有我方首領回復2'
      }
    ]
  },
  
  onLeaderKO: {
    type: 'keep',
    cost: { discard: 0 },
  }
}
```

### **3. 修復工兵**
```typescript
{
  id: 'repair_engineers',
  name: '修復工兵',
  suitableClass: ['guardian'],
  
  equipCost: {
    discard: 2
  },
  
  bonusStats: {
    toughness: 2,
    attack: 0,
    defensiveSupport: 2,
    offensiveSupport: 0,
    recovery: 2
  },
  
  // 安裝效果
  onEquip: {
    type: 'repair_fortress',
    value: 1,
    condition: 'in_ally_fortress_zone',
    description: '若在我方主堡區則修城1'
  },
  
  // 附帶技能：城牆修復
  attachedSkill: {
    name: '城牆修復',
    description: '丟棄2張手牌：修城2並在我方主堡區堆磚1',
    timing: ['action_phase'],
    cost: { discard: 2 },
    cooldown: 3,
    effect: [
      {
        type: 'repair_fortress',
        value: 2,
        description: '修城2'
      },
      {
        type: 'build_brick',
        value: 1,
        target: 'ally_fortress_zone',
        description: '在我方主堡區堆磚1'
      }
    ]
  },
  
  onLeaderKO: {
    type: 'keep',
    cost: { discard: 0 },
  }
}
```

### **4. 守衛隊**
```typescript
{
  id: 'guard_squad',
  name: '守衛隊',
  suitableClass: ['guardian'],
  
  equipCost: {
    discard: 1
  },
  
  bonusStats: {
    toughness: 3,
    attack: 0,
    defensiveSupport: 3,
    offensiveSupport: 0,
    recovery: 1
  },
  
  // 安裝效果
  onEquip: null,
  
  // 附帶技能：堅守陣地
  attachedSkill: {
    name: '堅守陣地',
    description: '丟棄1張手牌：本回合堅韌+4、防護協助+4',
    timing: ['action_phase'],
    cost: { discard: 1 },
    cooldown: 2,
    effect: [
      {
        type: 'toughness_bonus',
        value: 4,
        duration: 'this_turn',
        description: '本回合堅韌+4'
      },
      {
        type: 'defensive_support_bonus',
        value: 4,
        duration: 'this_turn',
        description: '本回合防護協助+4'
      }
    ]
  },
  
  onLeaderKO: {
    type: 'keep',
    cost: { discard: 0 },
  }
}
```

---

## 📊 軍團卡設計總覽

### **通用軍團卡（6張）**
| 卡名 | 安裝成本 | 安裝效果 | 主動技能 | 技能冷卻 |
|------|---------|---------|---------|---------|
| 精銳步兵 | 丟牌1 | 抽1張牌 | 丟牌1：協助+2 | 2回合 |
| 弓箭手隊 | 丟牌1 | 無 | 丟牌1：遠程對敵2 | 1回合 |
| 盾兵隊 | 丟牌1 | 堆磚1 | 丟牌1：堅韌+3、防護+3 | 2回合 |
| 醫療兵 | 丟牌1 | 回復2 | 丟牌1：範圍回復2 | 2回合 |
| 偵察兵 | 丟牌1 | 抽2張牌 | 丟牌1：抽2張牌 | 2回合 |
| 工兵隊 | 丟牌2 | 堆磚1 | 丟牌1：堆磚2 | 2回合 |

### **破壞者軍團卡（4張）**
| 卡名 | 安裝成本 | 安裝效果 | 主動技能 | 技能冷卻 |
|------|---------|---------|---------|---------|
| 攻城兵團 | 丟牌1 | 無 | 丟牌1：清磚2+條件攻城1 | 2回合 |
| 破壞工兵 | 丟牌2 | 無 | 丟牌2：範圍清磚1+對敵1 | 3回合 |
| 狂戰士隊 | 丟牌1 | 無 | 丟牌1：對敵+3、清磚+1 | 2回合 |
| 重裝突擊隊 | 丟牌2 | 清磚1 | 丟牌2：清磚3+對敵3 | 3回合 |

### **征服者軍團卡（4張）**
| 卡名 | 安裝成本 | 安裝效果 | 主動技能 | 技能冷卻 |
|------|---------|---------|---------|---------|
| 騎兵隊 | 丟牌1 | 無 | 丟牌1：移動+對敵3 | 2回合 |
| 游擊隊 | 丟牌1 | 抽1張牌 | 丟牌1：對敵2+移動 | 1回合 |
| 突襲隊 | 丟牌2 | 無 | 丟牌2：範圍對敵2+移動 | 3回合 |
| 獵殺者隊 | 丟牌1 | 無 | 丟牌1：斬殺對敵4 | 2回合 |

### **指揮官軍團卡（4張）**
| 卡名 | 安裝成本 | 安裝效果 | 主動技能 | 技能冷卻 |
|------|---------|---------|---------|---------|
| 戰術小隊 | 丟牌1 | 抽1張牌 | 丟牌1：範圍協助+2 | 2回合 |
| 控制小隊 | 丟牌2 | 無 | 丟牌2：禁錮 | 3回合 |
| 削弱小隊 | 丟牌1 | 無 | 丟牌1：範圍削弱-2 | 2回合 |
| 干擾小隊 | 丟牌2 | 抽1張牌 | 丟牌2：禁技能 | 3回合 |

### **守護者軍團卡（4張）**
| 卡名 | 安裝成本 | 安裝效果 | 主動技能 | 技能冷卻 |
|------|---------|---------|---------|---------|
| 防禦工兵 | 丟牌1 | 堆磚1 | 丟牌1：堆磚2 | 2回合 |
| 治療小隊 | 丟牌1 | 回復2 | 丟牌1：範圍回復2 | 2回合 |
| 修復工兵 | 丟牌2 | 條件修城1 | 丟牌2：修城2+堆磚1 | 3回合 |
| 守衛隊 | 丟牌1 | 無 | 丟牌1：堅韌+4、防護+4 | 2回合 |

---

## ✅ 設計完成總結

**22張軍團卡設計完成！**

**設計特點：**
- ✅ 6張通用軍團卡（所有首領可用）
- ✅ 4張職業專屬軍團卡（破壞者、征服者、指揮官、守護者）
- ✅ 安裝效果（onEquip）- 抽牌、堆磚、回復等
- ✅ 主動技能 - **丟棄手牌**作為成本 + 冷卻時間
- ✅ 屬性加成配合職業特色
- ✅ 首領被擊敗時軍團卡自動棄置

**成本系統：**
- **安裝成本** - 丟牌1（基礎）、丟牌2（強力）
- **技能成本** - 丟牌1（基礎技能）、丟牌2（強力技能）
- **冷卻時間** - 1-3回合（根據技能強度）

**卡牌分布：**
- 通用：6張
- 破壞者：4張
- 征服者：4張
- 指揮官：4張
- 守護者：4張
- **總計：22張**

**軍團卡 vs 反應卡：**
- **軍團卡** - 提供數值+主動技能+安裝效果（丟牌成本+冷卻）
- **反應卡** - 被攻擊時觸發（另一個系統，未設計）

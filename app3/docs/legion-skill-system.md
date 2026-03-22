# 軍團卡附帶技能系統設計

## 🎯 核心概念

### **首領 + 軍團 = 完整戰鬥單位**

```
首領卡（基礎）
├─ 被動效果（持續）
└─ 大招（冷卻制）

軍團卡（裝備）
├─ 屬性加成（攻/防/回復特化）
└─ 小技能（戰術應對）
```

---

## 📊 系統架構

### **1. 首領卡結構**

```typescript
interface LeaderCard {
  // 基礎屬性
  baseToughness: number
  baseAttack: number
  baseDefensiveSupport: number
  baseOffensiveSupport: number
  baseRecovery: number
  
  // 被動效果（持續）
  passive: {
    name: string
    description: string
    effect: Effect
  }
  
  // 大招（冷卻制）
  skill: {
    name: string
    description: string
    timing: SkillTiming[]
    cooldown: number  // 開場冷卻
    activationCondition?: string  // 啟動條件
    effect: Effect[]
  }
  
  // 裝備的軍團（只能1個）
  equippedLegion?: LegionCard
}
```

---

### **2. 軍團卡結構**

```typescript
interface LegionCard {
  // 安裝成本
  equipCost: {
    tech?: number      // 科技資源
    discard?: number   // 丟棄手牌
  }
  
  // 屬性加成（特化方向）
  bonusStats: {
    toughness: number
    attack: number
    defensiveSupport: number   // 防守特化
    offensiveSupport: number   // 攻擊特化
    recovery: number            // 回復特化
  }
  
  // 附帶小技能
  attachedSkill: {
    name: string
    description: string
    timing: SkillTiming[]
    
    // 技能成本（多元化）
    cost: {
      tech?: number      // 科技資源
      discard?: number   // 丟棄手牌
      free?: boolean     // 免費技能
    }
    
    cooldown: number     // 冷卻回合
    
    // 啟動條件
    activationCondition?: {
      type: 'zone' | 'state' | 'resource'
      value: string
    }
    
    effect: Effect[]
  }
  
  // 被擊破處罰
  onLeaderKO?: {
    cost: Cost
    effect: Effect
  }
}
```

---

## 🎮 設計範例

### **範例1：火龍女王（破壞者）+ 攻城槌軍團**

#### **首領卡：炎龍女王**

```typescript
{
  id: 'dragon_queen',
  name: '炎龍女王',
  race: 'dragon',
  class: 'destroyer',
  
  // 基礎屬性
  baseToughness: 8,
  baseAttack: 4,
  baseDefensiveSupport: 0,
  baseOffensiveSupport: 2,
  baseRecovery: 0,
  
  // 被動：攻城專精
  passive: {
    name: '攻城專精',
    description: '攻城時額外造成2點傷害',
    effect: {
      type: 'siege_bonus',
      value: 2,
      description: '攻城 +2'
    }
  },
  
  // 大招：毀滅龍息
  skill: {
    name: '毀滅龍息',
    description: '清磚2 & 攻城1 & 區域內所有敵首領對敵4',
    timing: ['action_phase'],
    cooldown: 3,  // 開場冷卻3回合
    activationCondition: '非我方主堡區',
    effect: [
      {
        type: 'clear_brick',
        value: 2,
        description: '清磚2'
      },
      {
        type: 'siege',
        value: 1,
        description: '攻城1'
      },
      {
        type: 'area_damage',
        value: 4,
        target: 'enemy_leaders',
        description: '區域內所有敵首領對敵4'
      }
    ]
  }
}
```

#### **軍團卡：攻城槌**

```typescript
{
  id: 'siege_ram',
  name: '攻城槌',
  race: 'dragon',
  class: 'destroyer',
  rarity: 'elite',
  
  // 安裝成本
  equipCost: {
    tech: 1,
    discard: 1
  },
  
  // 屬性加成（攻擊特化）
  bonusStats: {
    toughness: 2,
    attack: 2,
    defensiveSupport: 0,
    offensiveSupport: 2,
    recovery: 0
  },
  
  // 附帶小技能：破城錘擊
  attachedSkill: {
    name: '破城錘擊',
    description: '直接減少該區域築城1點',
    timing: ['action_phase'],
    
    cost: {
      discard: 1  // 丟棄1張手牌
    },
    
    cooldown: 2,
    
    activationCondition: {
      type: 'zone',
      value: 'enemy_fortress'  // 必須在敵主堡區
    },
    
    effect: [
      {
        type: 'clear_brick',
        value: 1,
        description: '該區域清磚1'
      }
    ]
  },
  
  // 被擊破處罰
  onLeaderKO: {
    cost: { discard: 1 },
    effect: {
      type: 'discard_or_destroy',
      description: '丟1張手牌，否則此軍團送入墓地'
    }
  }
}
```

---

### **範例2：海族守護者 + 修建工事軍團**

#### **首領卡：珊瑚守衛**

```typescript
{
  id: 'coral_guardian',
  name: '珊瑚守衛',
  race: 'aquatic',
  class: 'guardian',
  
  baseToughness: 10,
  baseAttack: 2,
  baseDefensiveSupport: 3,
  baseOffensiveSupport: 0,
  baseRecovery: 2,
  
  passive: {
    name: '海洋壁壘',
    description: '同區域我方首領防護協助 +1',
    effect: {
      type: 'area_defensive_buff',
      value: 1,
      description: '區域內我方防護協助 +1'
    }
  },
  
  skill: {
    name: '潮汐庇護',
    description: '區域內堆磚1，我方所有首領回復暈眩，堅韌+3',
    timing: ['action_phase'],
    cooldown: 3,
    effect: [
      {
        type: 'build_brick',
        value: 1,
        description: '區域內堆磚1'
      },
      {
        type: 'heal_allies',
        value: 3,
        description: '我方所有首領堅韌+3，回復暈眩'
      }
    ]
  }
}
```

#### **軍團卡：修建工事**

```typescript
{
  id: 'fortification',
  name: '修建工事',
  race: 'aquatic',
  class: 'guardian',
  rarity: 'common',
  
  equipCost: {
    tech: 1
  },
  
  bonusStats: {
    toughness: 3,
    attack: 0,
    defensiveSupport: 2,
    offensiveSupport: 0,
    recovery: 1
  },
  
  attachedSkill: {
    name: '緊急修復',
    description: '區域內堆磚1，若在我方主堡區則修城1',
    timing: ['action_phase'],
    
    cost: {
      free: true  // 免費技能
    },
    
    cooldown: 3,
    
    effect: [
      {
        type: 'build_brick',
        value: 1,
        description: '區域內堆磚1'
      },
      {
        type: 'repair_fortress',
        value: 1,
        condition: 'in_own_fortress',
        description: '若在我方主堡區，修城1'
      }
    ]
  },
  
  onLeaderKO: {
    cost: { tech: 1 },
    effect: {
      type: 'pay_or_destroy',
      description: '支付1科技，否則此軍團送入墓地'
    }
  }
}
```

---

### **範例3：征服者 + 機動突擊軍團**

#### **軍團卡：閃電突擊隊**

```typescript
{
  id: 'lightning_raiders',
  name: '閃電突擊隊',
  race: 'harpy',
  class: 'conqueror',
  rarity: 'elite',
  
  equipCost: {
    tech: 1,
    discard: 1
  },
  
  bonusStats: {
    toughness: 1,
    attack: 2,
    defensiveSupport: 0,
    offensiveSupport: 2,
    recovery: 0
  },
  
  attachedSkill: {
    name: '閃電突襲',
    description: '移動1（無視磚堆）並對目標區域1位敵首領對敵2',
    timing: ['action_phase'],
    
    cost: {
      discard: 1
    },
    
    cooldown: 1,
    
    effect: [
      {
        type: 'force_move',
        value: 1,
        ignore_brick: true,
        description: '移動1（無視磚堆）'
      },
      {
        type: 'single_damage',
        value: 2,
        target: 'enemy_leader',
        description: '對目標區域1位敵首領對敵2'
      }
    ]
  }
}
```

---

## 💰 安裝成本設計

### **成本類型**

| 稀有度 | 科技成本 | 丟牌成本 | 總成本 |
|--------|----------|----------|--------|
| 普通 | 1 | 0 | 1 |
| 精英 | 1 | 1 | 2 |
| 傳說 | 2 | 1 | 3 |

### **成本平衡**
- **普通軍團**：低成本，基礎加成，簡單技能
- **精英軍團**：中成本，顯著加成，戰術技能
- **傳說軍團**：高成本，強力加成，關鍵技能

---

## ⚡ 小技能成本設計

### **免費技能**
- 冷卻較長（3-4回合）
- 效果較弱
- 範例：基礎堆磚、小幅增益

### **丟牌技能**
- 冷卻中等（2-3回合）
- 效果中等
- 範例：清磚、移動、對敵

### **科技技能**
- 冷卻較短（1-2回合）
- 效果較強
- 範例：範圍傷害、強力控制

---

## 🎯 啟動條件設計

### **區域條件**
```typescript
activationCondition: {
  type: 'zone',
  value: 'enemy_fortress'  // 必須在敵主堡區
}
```

### **狀態條件**
```typescript
activationCondition: {
  type: 'state',
  value: 'brick_count_below_1'  // 磚堆1以下
}
```

### **資源條件**
```typescript
activationCondition: {
  type: 'resource',
  value: 'fortress_hp_below_2'  // 城牆2以下
}
```

---

## 📋 完整範例對照

### **舊版BG：白金的宇宙雷射炸彈**
```
技能2: 宇宙雷射炸彈（技*1 任*1）
僅在非我方主堡區域發動
敵主堡區清磚1 & 敵廣場區清磚1
對敵攻城1
```

### **新版設計：火龍女王 + 攻城槌**

**首領大招：毀滅龍息**
```typescript
{
  cooldown: 3,
  activationCondition: '非我方主堡區',
  effect: [
    { type: 'clear_brick', value: 2 },
    { type: 'siege', value: 1 },
    { type: 'area_damage', value: 4 }
  ]
}
```

**軍團小技能：破城錘擊**
```typescript
{
  cost: { discard: 1 },
  cooldown: 2,
  activationCondition: { type: 'zone', value: 'enemy_fortress' },
  effect: [
    { type: 'clear_brick', value: 1 }
  ]
}
```

---

## ✅ 設計優勢

1. **保留爆發感**
   - 首領大招（高冷卻、強效果）
   - 軍團小技能（低冷卻、戰術性）

2. **增加深度**
   - 多元成本（科技/丟牌/免費）
   - 啟動條件（區域/狀態/資源）

3. **職業特色**
   - 破壞者：攻城特化
   - 征服者：機動特化
   - 指揮官：協助特化
   - 守護者：築城特化

4. **簡化系統**
   - 不需要獨立事件卡
   - 不需要獨立反應卡
   - 整合到軍團附帶技能

---

## 🔄 下一步

1. 更新 TypeScript 類型定義
2. 設計30張軍團卡的附帶技能
3. 調整首領卡大招設計
4. 創建完整範例數據

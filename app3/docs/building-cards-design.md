# 魔物娘建築卡設計

## 📖 設計理念

建築卡是放置在磚堆區的特殊卡牌，提供持續性的場地效果。

### **核心概念**
- **建築卡** - 放置在磚堆區，提供持續性場地效果
- **放置位置** - 我方戰場或我方基地域（廣場區、主堡區）或基地專用（僅主堡區）
- **堅韌值** - 建築卡有堅韌值，可被清磚動作破壞
- **持續效果** - 在場上時持續生效

### **建築卡使用規則**
1. **放置時機** - 在主要階段打出建築卡
2. **放置位置** - 放置在指定的磚堆區（取代磚堆）
3. **持續效果** - 建築卡在場上時，效果持續生效
4. **破壞規則** - 敵人清磚時可以選擇破壞建築卡（送入墓地）
5. **數量限制** - 每個磚堆區最多1張建築卡

---

## 🎯 建築卡分類

### **1. 通用區域建築卡（4張）**
- 可以放置在我方戰場或我方基地域（廣場區、主堡區）
- 提供防禦、攻擊、戰術效果

### **2. 基地區域專用建築卡（2張）**
- 只能放置在我方基地域（主堡區）
- 提供強力的基地防禦效果

---

## 📊 設計原則

### **堅韌值設計**

| 堅韌值 | 說明 | 適用建築 |
|-------|------|---------|
| **1** | 脆弱，容易被破壞 | 攻擊型建築 |
| **2-3** | 中等耐久 | 平衡型建築 |
| **4-5** | 高耐久 | 防禦型建築 |
| **∞** | 無限耐久，但有特殊破壞條件 | 特殊建築 |

### **效果類型**

| 效果類型 | 說明 |
|---------|------|
| **防禦強化** | 減少受到的傷害 |
| **攻擊強化** | 增加對敵傷害 |
| **持續傷害** | 每回合自動對敵人造成傷害 |
| **資源生成** | 提供抽牌、堆磚等資源 |
| **特殊效果** | 改變遊戲規則 |

---

## 🏰 通用區域建築卡

### **1. 城門**
```typescript
{
  id: 'gate',
  name: '城門',
  type: 'building',
  placement: ['我方戰場', '我方基地域'],  // 可放置在我方戰場或我方基地域
  
  toughness: 3,
  
  effect: {
    type: 'damage_reduction',
    description: '此卡在場上時：區域內我方所有首領受到對敵-1',
    continuous: true,
    actions: [
      {
        type: 'area_buff',
        target: 'all_ally_leaders_in_zone',
        damageReduction: 1,
        description: '區域內我方所有首領受到對敵-1'
      }
    ]
  },
  
  destroyCondition: {
    type: 'enemy_clear_brick',
    description: '敵破壞者職業在此卡所在區發動清磚動作可選擇此卡送入墓地'
  }
}
```
**參考舊版**：城門（BOM職業可破壞）

---

### **2. 雜魚群體**
```typescript
{
  id: 'minion_swarm',
  name: '雜魚群體',
  type: 'building',
  placement: ['我方戰場', '我方基地域'],
  
  toughness: 1,
  
  effect: {
    type: 'periodic_damage',
    description: '此卡在場上時：每個我方主要階段開始時，對區域內所有敵首領對敵2',
    continuous: true,
    trigger: {
      timing: 'start_of_main_phase',
      description: '每個我方主要階段開始時'
    },
    actions: [
      {
        type: 'area_damage',
        value: 2,
        target: 'all_enemy_leaders_in_zone',
        description: '對區域內所有敵首領對敵2'
      }
    ]
  },
  
  destroyCondition: {
    type: 'enemy_clear_brick',
    description: '敵人在此卡所在區發動清磚動作可選擇此卡送入墓地'
  }
}
```
**參考舊版**：雜魚群體

---

### **3. 箭塔**
```typescript
{
  id: 'arrow_tower',
  name: '箭塔',
  type: 'building',
  placement: ['我方戰場', '我方基地域'],
  
  toughness: 2,
  
  effect: {
    type: 'attack_boost',
    description: '此卡在場上時：區域內我方所有首領對敵+1、清磚+1',
    continuous: true,
    actions: [
      {
        type: 'area_buff',
        target: 'all_ally_leaders_in_zone',
        attackBonus: 1,
        clearBrickBonus: 1,
        description: '區域內我方所有首領對敵+1、清磚+1'
      }
    ]
  },
  
  destroyCondition: {
    type: 'enemy_clear_brick',
    description: '敵人在此卡所在區發動清磚動作可選擇此卡送入墓地'
  }
}
```

---

### **4. 中繼點**
```typescript
{
  id: 'relay_point',
  name: '中繼點',
  type: 'building',
  placement: ['我方戰場', '我方基地域'],  // 只能放置在廣場區
  
  toughness: Infinity,  // 無限耐久
  
  effect: {
    type: 'respawn_point',
    description: '此卡在場上時：我方首領進入擊敗狀態時可以改為從廣場區復活',
    continuous: true,
    actions: [
      {
        type: 'change_respawn_location',
        from: 'fortress_zone',
        to: 'plaza_zone',
        description: '我方首領進入擊敗狀態時可以改為從廣場區復活'
      }
    ]
  },
  
  destroyCondition: {
    type: 'special',
    description: '敵守護者職業在廣場區發動清磚動作可選擇此卡送入墓地'
  }
}
```
**參考舊版**：中繼點（BLC職業可破壞）

---

## 🏛️ 基地區域專用建築卡

### **5. 要塞城牆**
```typescript
{
  id: 'fortress_wall',
  name: '要塞城牆',
  type: 'building',
  placement: ['fortress_zone'],  // 只能放置在主堡區
  
  toughness: 5,
  
  effect: {
    type: 'fortress_protection',
    description: '此卡在場上時：我方基地內所有首領受到對敵-2、防護協助+2，敵人不能對我方基地攻城',
    continuous: true,
    actions: [
      {
        type: 'area_buff',
        target: 'all_ally_leaders_in_fortress',
        damageReduction: 2,
        defensiveSupportBonus: 2,
        description: '我方基地內所有首領受到對敵-2、防護協助+2'
      },
      {
        type: 'block_siege',
        description: '敵人不能對我方基地攻城'
      }
    ]
  },
  
  destroyCondition: {
    type: 'enemy_clear_brick',
    description: '敵人在主堡區發動清磚動作可選擇此卡送入墓地'
  }
}
```

---

### **6. 神聖祭壇**
```typescript
{
  id: 'sacred_altar',
  name: '神聖祭壇',
  type: 'building',
  placement: ['fortress_zone'],  // 只能放置在主堡區
  
  toughness: 3,
  
  effect: {
    type: 'healing_aura',
    description: '此卡在場上時：每個我方回合開始時，我方基地內所有首領回復1，若我方城牆生命力低於2則改為回復2',
    continuous: true,
    trigger: {
      timing: 'start_of_turn',
      description: '每個我方回合開始時'
    },
    actions: [
      {
        type: 'conditional_heal',
        target: 'all_ally_leaders_in_fortress',
        baseValue: 1,
        condition: {
          type: 'fortress_hp_below',
          value: 2,
          enhancedValue: 2
        },
        description: '我方基地內所有首領回復1，若我方城牆生命力低於2則改為回復2'
      }
    ]
  },
  
  destroyCondition: {
    type: 'enemy_clear_brick',
    description: '敵人在主堡區發動清磚動作可選擇此卡送入墓地'
  }
}
```

---

## 📊 建築卡設計總覽

### **通用區域建築卡（4張）**
| 卡名 | 堅韌 | 放置位置 | 效果 |
|------|------|---------|------|
| 城門 | 3 | 廣場/主堡 | 區域內友軍受到對敵-1 |
| 雜魚群體 | 1 | 廣場/主堡 | 每回合對區域內敵人對敵2 |
| 箭塔 | 2 | 廣場/主堡 | 區域內友軍對敵+1、清磚+1 |
| 中繼點 | ∞ | 廣場 | 首領從廣場區復活 |

### **基地區域專用建築卡（2張）**
| 卡名 | 堅韌 | 放置位置 | 效果 |
|------|------|---------|------|
| 要塞城牆 | 5 | 主堡 | 友軍受到對敵-2、防護+2，阻止攻城 |
| 神聖祭壇 | 3 | 主堡 | 每回合友軍回復1（城牆低時回復2） |

---

## 📋 建築卡使用策略

### **防禦型建築**
- **城門**（堅韌3）- 減少受到的傷害
- **要塞城牆**（堅韌5）- 最強防禦，阻止攻城

### **攻擊型建築**
- **雜魚群體**（堅韌1）- 持續傷害，但容易被破壞
- **箭塔**（堅韌2）- 增強攻擊力

### **戰術型建築**
- **中繼點**（堅韌∞）- 改變復活位置，前線壓制
- **神聖祭壇**（堅韌3）- 持續回復，劣勢時更強

---

## 🎯 破壞條件設計

### **職業破壞限制**
- **破壞者職業** - 可以破壞「城門」（參考舊版BOM職業）
- **守護者職業** - 可以破壞「中繼點」（參考舊版BLC職業）
- **通用破壞** - 其他建築卡可被任何職業清磚破壞

### **破壞機制**
1. 敵人在建築卡所在區域發動清磚動作
2. 可以選擇破壞建築卡（送入墓地）
3. 破壞建築卡不消耗清磚次數
4. 部分建築卡有職業限制（只有特定職業能破壞）

---

## ✅ 設計完成總結

**6張建築卡設計完成！**

**設計特點：**
- ✅ 4張通用區域建築卡（可放置在廣場區或主堡區）
- ✅ 2張基地區域專用建築卡（只能放置在主堡區）
- ✅ 參考舊版經典卡牌（城門、雜魚群體、中繼點）
- ✅ 堅韌值多樣化（1、2、3、5、∞）
- ✅ 效果類型豐富（防禦、攻擊、持續傷害、回復、戰術）

**堅韌值分布：**
- 堅韌1：1張（雜魚群體）
- 堅韌2：1張（箭塔）
- 堅韌3：2張（城門、神聖祭壇）
- 堅韌5：1張（要塞城牆）
- 堅韌∞：1張（中繼點）

**放置位置分布：**
- 通用區域（廣場/主堡）：3張
- 廣場專用：1張（中繼點）
- 主堡專用：2張（要塞城牆、神聖祭壇）

**參考舊版卡牌：**
- 城門 → 城門（BOM職業可破壞）
- 雜魚群體 → 雜魚群體
- 中繼點 → 中繼點（BLC職業可破壞）

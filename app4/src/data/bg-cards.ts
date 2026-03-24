// BG 角色卡定義（20 張，每職業 5 張）

import type { BGClass } from '../engine/types'

export type BGSkillDef = {
  id: string
  name: string
  cd: number                  // 冷卻回合數（使用後需等 cd 回合才能再用）
  handCost?: number           // 使用時需捨棄的手牌數（S2=2）
  canUseWhenStunned?: boolean
  /** 可反擊：受攻擊時可觸發，閃避傷害並執行技能效果，但有額外成本 */
  counterattack?: {
    extraCd?: number          // 反擊後額外追加 CD（S1 用，通常 +1）
    extraHandCost?: number    // 反擊時額外消耗手牌（S2 用，通常 +1）
  }
  description: string
}

export type BGCardDef = {
  id: string
  name: string
  bgClass: BGClass
  hp: number
  attack: number
  support: number
  skills: [BGSkillDef, BGSkillDef]
}

export const allBGCards: BGCardDef[] = [
  // ── BOM ──────────────────────────────────────────
  {
    id: 'xiabai',
    name: '小白',
    bgClass: 'BOM',
    hp: 4, attack: 2, support: 2,
    skills: [
      {
        id: 'xiabai_s1', name: '穿刺炸彈', cd: 2,
        description: '僅在非我方主堡區域發動：敵主堡區清磚1 & 敵廣場區清磚1',
      },
      {
        id: 'xiabai_s2', name: '超級究極炸彈', cd: 3, handCost: 2,
        description: '（消耗2手牌）區域內清磚2 & 攻城1，區域內所有敵BG對敵4，此BG暈眩',
      },
    ],
  },
  {
    id: 'xiahei',
    name: '小黑',
    bgClass: 'BOM',
    hp: 4, attack: 2, support: 2,
    skills: [
      {
        id: 'xiahei_s1', name: '小黑忍耐', cd: 3,
        description: '2回合內每次受到的對敵-2',
      },
      {
        id: 'xiahei_s2', name: '巨大炸彈', cd: 3, handCost: 2,
        description: '（消耗2手牌）在敵主堡區且敵主堡區磚堆1以下發動：清磚1 & 攻城2',
      },
    ],
  },
  {
    id: 'baijin',
    name: '白金',
    bgClass: 'BOM',
    hp: 4, attack: 2, support: 2,
    skills: [
      {
        id: 'baijin_s1', name: '遙控穿刺炸彈', cd: 3,
        description: '在非我方主堡區域發動：敵主堡區清磚1 & 敵廣場區清磚1，敵主堡區或廣場區中1位BG對敵3',
      },
      {
        id: 'baijin_s2', name: '宇宙雷射炸彈', cd: 3, handCost: 2,
        description: '（消耗2手牌）僅在非我方主堡區域發動：敵主堡區清磚1 & 敵廣場區清磚1，對敵攻城1',
      },
    ],
  },
  {
    id: 'xiaohui',
    name: '小灰',
    bgClass: 'BOM',
    hp: 4, attack: 2, support: 2,
    skills: [
      {
        id: 'xiaohui_s1', name: '閃電炸彈', cd: 2,
        description: '區域內清磚1，區域內1位敵BG對敵3',
      },
      {
        id: 'xiaohui_s2', name: '超等離子炸彈', cd: 3, handCost: 2,
        description: '（消耗2手牌）區域內所有敵BG對敵3，區域內所有敵BG下1回合無法移動，區域內清磚1，若在敵主堡區攻城1',
      },
    ],
  },
  {
    id: 'dake',
    name: '大可',
    bgClass: 'BOM',
    hp: 4, attack: 2, support: 2,
    skills: [
      {
        id: 'dake_s1', name: '黑暗元素模式', cd: 3,
        canUseWhenStunned: true,
        counterattack: { extraCd: 1 },
        description: '2回合內（可反擊）對敵+2，協助+1，堅韌+1，執行清磚動作時清磚+1',
      },
      {
        id: 'dake_s2', name: '死亡重力炸彈', cd: 3, handCost: 2,
        description: '（消耗2手牌）1回合後：區域內清磚2 & 攻城1，1回合後：區域內1位敵BG直接KO',
      },
    ],
  },
  // ── ATK ──────────────────────────────────────────
  {
    id: 'xiaochu',
    name: '小橘',
    bgClass: 'ATK',
    hp: 3, attack: 2, support: 1,
    skills: [
      {
        id: 'xiaochu_s1', name: '扣籃刃', cd: 2,
        description: '移動1格（無視磚堆），並對移動目標區域1位敵BG對敵2',
      },
      {
        id: 'xiaochu_s2', name: '午餐時間', cd: 3, handCost: 2,
        canUseWhenStunned: true,
        counterattack: { extraHandCost: 1 },
        description: '（消耗2手牌）暈眩狀態也可以使用（可反擊），1回合堅韌+4，回復暈眩狀態',
      },
    ],
  },
  {
    id: 'qiamo',
    name: '其阿莫',
    bgClass: 'ATK',
    hp: 3, attack: 2, support: 1,
    skills: [
      {
        id: 'qiamo_s1', name: '一途', cd: 2,
        description: '對區域內1位敵BG對敵2，1回合免疫第1次對敵',
      },
      {
        id: 'qiamo_s2', name: '忌妒', cd: 2, handCost: 2,
        canUseWhenStunned: true,
        counterattack: { extraHandCost: 1 },
        description: '（消耗2手牌）1回合堅韌+2（可反擊），區域內1位敵BG對敵3，區域內清磚1',
      },
    ],
  },
  {
    id: 'saifiya',
    name: '賽菲亞',
    bgClass: 'ATK',
    hp: 4, attack: 2, support: 1,
    skills: [
      {
        id: 'saifiya_s1', name: '十字碰撞', cd: 2,
        canUseWhenStunned: true,
        counterattack: { extraCd: 1 },
        description: '區域內1位敵BG對敵3（可反擊），非反擊時可破壞區域內一個非「中繼點」建築',
      },
      {
        id: 'saifiya_s2', name: '愛的輪迴', cd: 3, handCost: 2,
        description: '（消耗2手牌）堅韌+1，下次對敵技能+2，使用技能後清除效果，技能讓對手進入暈眩時直接KO',
      },
    ],
  },
  {
    id: 'tiehuo',
    name: '鐵火',
    bgClass: 'ATK',
    hp: 3, attack: 2, support: 2,
    skills: [
      {
        id: 'tiehuo_s1', name: '鉄拳制裁拳', cd: 2,
        canUseWhenStunned: true,
        counterattack: { extraCd: 1 },
        description: '對區域內1位敵BG對敵2（可反擊），命中後那個BG往相鄰區移動1格',
      },
      {
        id: 'tiehuo_s2', name: '超究極鉄拳制裁拳', cd: 2, handCost: 2,
        description: '（消耗2手牌）對區域內2位敵BG對敵3，若在敵主堡區發動則攻城1',
      },
    ],
  },
  {
    id: 'qiancong',
    name: '淺蔥',
    bgClass: 'ATK',
    hp: 3, attack: 2, support: 1,
    skills: [
      {
        id: 'qiancong_s1', name: '牙狼', cd: 2,
        canUseWhenStunned: true,
        counterattack: { extraCd: 1 },
        description: '對區域內1位敵BG對敵2（可反擊），如果造成傷害則1回合堅韌+2',
      },
      {
        id: 'qiancong_s2', name: '大念波動', cd: 3, handCost: 2,
        description: '（消耗2手牌）對區域內1位敵BG對敵2×3次（每次命中則1回合堅韌+2）',
      },
    ],
  },
  // ── SHT ──────────────────────────────────────────
  {
    id: 'pulasi',
    name: '普拉斯',
    bgClass: 'SHT',
    hp: 3, attack: 2, support: 3,
    skills: [
      {
        id: 'pulasi_s1', name: '罪過的喇叭', cd: 2,
        description: '可對區域內2位敵BG對敵2',
      },
      {
        id: 'pulasi_s2', name: '黙示録低音號', cd: 3, handCost: 2,
        description: '（消耗2手牌）1回合免疫所有對敵，1回合後區域內所有敵BG進入暈眩狀態',
      },
    ],
  },
  {
    id: 'aimela',
    name: '艾美拉',
    bgClass: 'SHT',
    hp: 3, attack: 2, support: 3,
    skills: [
      {
        id: 'aimela_s1', name: 'Delta光線', cd: 2,
        description: '對區域內或相鄰區1位敵BG對敵3',
      },
      {
        id: 'aimela_s2', name: 'Sigma光線', cd: 2, handCost: 2,
        description: '（消耗2手牌）對區域內及前方所有區域的所有敵BG對敵3',
      },
    ],
  },
  {
    id: 'jingqing',
    name: '津輕',
    bgClass: 'SHT',
    hp: 3, attack: 3, support: 2,
    skills: [
      {
        id: 'jingqing_s1', name: '喇叭狙擊步槍', cd: 2,
        description: '選擇任意1位敵BG對敵2（跨區）',
      },
      {
        id: 'jingqing_s2', name: '蘋果暈眩西打', cd: 2, handCost: 2,
        description: '（消耗2手牌）選擇1個鄰近區域的1位敵BG，將其暈眩',
      },
    ],
  },
  {
    id: 'xiaozi',
    name: '小紫',
    bgClass: 'SHT',
    hp: 3, attack: 2, support: 3,
    skills: [
      {
        id: 'xiaozi_s1', name: '審判', cd: 2,
        description: '對區域內1位敵BG對敵3，命中後該BG下回合不能移動',
      },
      {
        id: 'xiaozi_s2', name: '地獄犬', cd: 3, handCost: 2,
        description: '（消耗2手牌）區域內最多3位敵BG對敵3，若只有1位敵BG則對敵6，1回合區域內1位非自身我方BG堅韌+3',
      },
    ],
  },
  {
    id: 'aoliwei',
    name: '奧莉薇',
    bgClass: 'SHT',
    hp: 3, attack: 2, support: 3,
    skills: [
      {
        id: 'aoliwei_s1', name: '追蹤彈開火', cd: 2,
        description: '目標任意區域內1位敵BG：1回合後受到對敵3',
      },
      {
        id: 'aoliwei_s2', name: '火焰器開火', cd: 3, handCost: 2,
        description: '（消耗2手牌）1回合免疫所有對敵，1回合後區域內所有敵BG受到對敵4',
      },
    ],
  },
  // ── BLC ──────────────────────────────────────────
  {
    id: 'pain',
    name: '派因',
    bgClass: 'BLC',
    hp: 5, attack: 2, support: 2,
    skills: [
      {
        id: 'pain_s1', name: '派因牆壁', cd: 1,
        description: '區域內堆磚1',
      },
      {
        id: 'pain_s2', name: '癒天才歌聲', cd: 3, handCost: 2,
        description: '（消耗2手牌）區域內我方所有BG回復暈眩狀態，1回合堅韌+3，若在我方主堡區發動修城3',
      },
    ],
  },
  {
    id: 'akuya',
    name: '阿庫雅',
    bgClass: 'BLC',
    hp: 5, attack: 2, support: 2,
    skills: [
      {
        id: 'akuya_s1', name: '召喚僕人', cd: 2,
        description: '從牌庫或墓地檢索一張「雜魚群體」並馬上發動',
      },
      {
        id: 'akuya_s2', name: '水藍之月', cd: 3, handCost: 2,
        description: '（消耗2手牌）1回合免疫所有對敵，1回合後區域內所有敵BG移動至敵主堡區，若在我方主堡區發動修城1',
      },
    ],
  },
  {
    id: 'xiluo',
    name: '希洛',
    bgClass: 'BLC',
    hp: 5, attack: 2, support: 2,
    skills: [
      {
        id: 'xiluo_s1', name: '旋風石牆', cd: 2,
        description: '區域內堆磚1，區域內1位敵BG往敵主堡區移動1格且下1回合不能移動',
      },
      {
        id: 'xiluo_s2', name: '治癒石牆', cd: 2, handCost: 2,
        description: '（消耗2手牌）區域內堆磚1，若在我方主堡區發動修城1',
      },
    ],
  },
  {
    id: 'pulun',
    name: '普倫',
    bgClass: 'BLC',
    hp: 6, attack: 2, support: 2,
    skills: [
      {
        id: 'pulun_s1', name: '普倫牆壁', cd: 1,
        description: '區域內堆磚1',
      },
      {
        id: 'pulun_s2', name: '治癒注射歌聲', cd: 3, handCost: 2,
        description: '（消耗2手牌）選擇此區與鄰近區域的目標發動3次：A.一位非此BG 1回合堅韌+3且回復暈眩 B.指定我方主堡區修城1',
      },
    ],
  },
  {
    id: 'migua',
    name: '蜜瓜',
    bgClass: 'BLC',
    hp: 5, attack: 2, support: 2,
    skills: [
      {
        id: 'migua_s1', name: '蜜瓜牆壁', cd: 2,
        description: '區域內堆磚2（此技能在區域內的堆磚可以最多到3層）',
      },
      {
        id: 'migua_s2', name: '治癒的神之聲', cd: 3, handCost: 2,
        description: '（消耗2手牌）區域內與鄰近區域我方所有BG：回復暈眩狀態，1回合堅韌+3，若包含我方主堡區修城3',
      },
    ],
  },
]

export const bgCardById: Record<string, BGCardDef> = {}
for (const c of allBGCards) bgCardById[c.id] = c

export const bgsByClass: Record<BGClass, BGCardDef[]> = {
  BOM: allBGCards.filter(c => c.bgClass === 'BOM'),
  ATK: allBGCards.filter(c => c.bgClass === 'ATK'),
  SHT: allBGCards.filter(c => c.bgClass === 'SHT'),
  BLC: allBGCards.filter(c => c.bgClass === 'BLC'),
}

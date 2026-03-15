<template>
  <div id="dungeon-app">
    <DungeonView />
  </div>
</template>

<script setup lang="ts">
import DungeonView from './views/DungeonView.vue'
</script>

<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ── 色彩系統（羊皮紙/奇幻明亮風格）──────────────────────────── */
:root {
  --bg:           #f2ede2;   /* 羊皮紙底色 */
  --bg-panel:     #e8e2d4;   /* 面板底色 */
  --bg-card:      #faf7f0;   /* 卡片/格子底色 */
  --bg-overlay:   rgba(30,20,10,.45);  /* 遮罩半透明 */

  --border:       #b8a88a;   /* 暖棕邊框 */
  --border-light: #d4c9b0;   /* 淺邊框 */

  --text:         #1c1710;   /* 深棕文字 */
  --text-dim:     #7a6a55;   /* 次要文字 */
  --text-inv:     #f2ede2;   /* 反色（用於深色背景上）*/

  --accent:       #7a4f1a;   /* 古銅 */
  --accent-light: #c4924c;   /* 淺古銅（hover）*/
  --accent-bg:    #f0e4cc;   /* 古銅底色 */

  --hp-bar:       #c0392b;   /* HP 條 */
  --sp-bar:       #2980b9;   /* SP 條 */
  --atb-bar:      #8b5e1a;   /* ATB 條（古銅）*/

  --terrain-forest: #d4e8c8; /* 森林格淡綠 */
  --terrain-water:  #c8dff0; /* 水格淡藍 */
  --terrain-rubble: #d8d2c4; /* 瓦礫淡灰 */
  --terrain-altar:  #e0d0f0; /* 祭壇淡紫 */

  --cell-wall:    #5c4a30;   /* 牆壁深棕 */
  --cell-player:  #1a5fa0;   /* 玩家邊框藍 */
  --cell-monster: #8b2020;   /* 怪物邊框紅 */
  --cell-select:  #c4924c;   /* 選中格高亮 */
  --cell-move:    rgba(26,95,160,.25);  /* 合法移動範圍 */
  --cell-target:  rgba(139,32,32,.25); /* 攻擊範圍 */

  --red:    #b53a2a;
  --green:  #2d6e24;
  --blue:   #1e5fa0;
  --purple: #6b3a9e;
  --gold:   #a06010;
}

html, body {
  width: 100%; height: 100%;
  background: var(--bg);
  color: var(--text);
  font-family: 'Noto Sans TC', 'Noto Serif TC', system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

#dungeon-app {
  min-height: 100vh;
}

/* ── 共用工具 ──────────────────────────────────────────────────── */
button {
  cursor: pointer;
  font-family: inherit;
  font-size: inherit;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 14px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text);
  transition: background .15s, border-color .15s;
  font-size: 13px;
}
.btn:hover { background: var(--accent-bg); border-color: var(--accent-light); }
.btn:active { opacity: .85; }
.btn--primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--text-inv);
}
.btn--primary:hover { background: var(--accent-light); border-color: var(--accent-light); }
.btn--danger { background: var(--red); border-color: var(--red); color: #fff; }
.btn[disabled] { opacity: .45; pointer-events: none; }

.panel {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 6px;
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--text-dim);
  padding: 0 0 4px;
  border-bottom: 1px solid var(--border-light);
  margin-bottom: 8px;
}

/* HP/SP/ATB 條 */
.bar-wrap { height: 4px; border-radius: 2px; background: var(--border-light); overflow: hidden; }
.bar-fill  { height: 100%; border-radius: 2px; transition: width .2s; }
.bar-hp    { background: var(--hp-bar); }
.bar-sp    { background: var(--sp-bar); }
.bar-atb   { background: var(--atb-bar); }
</style>

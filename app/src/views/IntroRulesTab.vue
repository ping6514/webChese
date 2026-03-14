<template>
  <main class="rulesMain">
    <div class="rulebook">

      <section class="ruleSection">
        <h2>⚔️ 遊戲概述</h2>
        <p>幽冥棋是以中國象棋為底盤的卡牌策略遊戲。兩位玩家輪流行動，在<strong>購買、死靈術、戰鬥</strong>三個階段中運籌帷幄——購入靈魂卡強化棋子、召喚英靈或復活陣亡單位、指揮棋子移動射擊，最終<strong>擊殺對方帥（將）</strong>即獲勝。</p>
        <p style="margin-top:8px; font-size:0.8125rem; color:var(--text-muted); line-height:1.7">每回合收入讓你持續擴張手牌與戰力；屍骸、墓場與靈魂回歸系統則讓死亡不是終點，而是下一步策略的起點。</p>
      </section>

      <section class="ruleSection">
        <h2>🎲 棋盤</h2>
        <ul>
          <li>棋盤為 <strong>9 × 10</strong> 格，中央有「楚河漢界」（第 5 / 6 行之間）。</li>
          <li>紅方棋子在下半場（Y = 6–9），黑方在上半場（Y = 0–3）。</li>
          <li>九宮格：紅方 X 3–5 / Y 7–9；黑方 X 3–5 / Y 0–2，帥/將與仕/士僅限九宮內移動。</li>
        </ul>
      </section>

      <section class="ruleSection">
        <h2>💰 資源</h2>
        <div class="resourceGrid">
          <div class="resourceCard">
            <div class="resTitle">💰 財力</div>
            <div class="resDesc">購買靈魂卡、道具卡、復活棋子的主要貨幣。每回合開始自動獲得收入（+4）。上限 15。</div>
          </div>
          <div class="resourceCard">
            <div class="resTitle">✨ 魔力</div>
            <div class="resDesc">所有單位射擊均消耗 1 魔力。每回合開始 +2。未使用的魔力可在回合結束儲存（上限 5），下回合轉換為財力。</div>
          </div>
        </div>
      </section>

      <section class="ruleSection">
        <h2>🔄 回合流程</h2>
        <div class="phaseList">
          <div class="phaseItem">
            <div class="phaseTag buy">💰 購買</div>
            <div class="phaseDesc">
              <ul>
                <li><strong>購買靈魂卡</strong>：每次花費 2~1 財力，從對應棋子類型的展示卡中購入手牌（上限 5 張）。每回合限 1 次。</li>
                <li><strong>購買道具卡</strong>：花費道具標示費用，加入手牌（上限 3 張）。每回合限 1 次。</li>
                <li><strong>盜取</strong>：消耗 2 財力，從敵方墓場頂部盜取一張靈魂卡。</li>
                <li><strong>使用「購買」道具</strong>：使用手牌中時機為「購買」的道具卡。</li>
              </ul>
            </div>
          </div>
          <div class="phaseItem">
            <div class="phaseTag necro">⚗️ 死靈術</div>
            <div class="phaseDesc">
              <ul>
                <li><strong>附魂（附魔）</strong>：將手牌靈魂卡附於己方棋子，棋子獲得靈魂的 HP、ATK、防禦與特殊能力。費用依靈魂卡標示。每回合基礎 1 次（血之祭儀或道具可增加）。</li>
                <li><strong>復活</strong>：花費<strong>依兵種而定</strong>的財力費用，棋子在己方最後一具屍骸的格子原地重生。若該格已有活著的棋子佔據，則<strong>無法復活</strong>（被阻擋）。與附魂共享死靈術行動次數。</li>
                <li><strong>血之祭儀</strong>：帥失去 3 HP，本回合死靈術行動次數 +1。每回合限 1 次。</li>
                <li><strong>使用「死靈」道具</strong>：使用手牌中時機為「死靈術」的道具卡。</li>
              </ul>
            </div>
          </div>
          <div class="phaseItem">
            <div class="phaseTag combat">⚔️ 戰鬥</div>
            <div class="phaseDesc">
              <ul>
                <li><strong>移動</strong>：每個單位遵循象棋走法，消耗 1 魔力執行移動。</li>
                <li><strong>射擊</strong>：所有單位均可射擊，消耗 1 魔力，<strong>每個單位每回合限射擊一次</strong>。砲基底需要「炮架」（中間隔一個棋子）才能射擊；其他基底直線無阻擋射擊。靈魂卡能力可改變射擊規則（無視阻擋、貫通、連鎖等）。</li>
                <li><strong>使用「戰鬥」道具</strong>：使用手牌中時機為「戰鬥」的道具卡。</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section class="ruleSection">
        <h2>👻 靈魂卡系統</h2>
        <ul>
          <li>共分 6 個氏族：<strong>暗月氏族</strong>、<strong>冥河氏族</strong>、<strong>永夜氏族</strong>、<strong>鐵衛氏族</strong>、<strong>黃金傭兵</strong>、<strong>亡命誓約</strong>。開房時可自訂啟用的氏族組合。</li>
          <li>每種棋子類型有獨立的靈魂牌堆。購買時只能購入與棋子類型相符的靈魂卡（例如「車」只能買車型靈魂）。</li>
          <li>附魂後棋子的 HP、ATK、DEF 替換為靈魂卡數值，並獲得特殊能力。</li>
          <li>棋子死亡後靈魂卡進入己方墓場。可於死靈術階段復活並重新附魂。</li>
          <li>敵方墓場頂部的靈魂卡可被「盜取」（消耗 3 財力）。</li>
          <li><strong>靈魂回歸</strong>：可在購買階段將手牌中的靈魂卡送回對應牌堆底部，換取 1 財力。適合放棄不適用的靈魂、騰出手牌空間或補充資源。</li>
        </ul>
      </section>

      <section class="ruleSection">
        <h2>💀 屍骸系統</h2>
        <ul>
          <li>棋子被擊殺後，除了靈魂卡進入墓場，其<strong>屍骸</strong>也會留在原地格子上。</li>
          <li>在死靈術階段花費<strong>依兵種而定</strong>的財力費用<strong>復活</strong>時，棋子將在其屍骸所在的格子原地重生。每次只能復活<strong>最後一具</strong>己方屍骸（同格多具時取最頂層，按死亡先後堆疊）。若屍骸格已有活著的棋子佔據，則<strong>無法復活</strong>，須先移走該棋子。</li>
          <li>屍骸不影響移動或射擊，但部分靈魂卡能力以場上屍骸數量為觸發條件（如永夜氏族）。</li>
          <li>道具卡「骸骨煉化」可消耗己方屍骸換取財力或魔力。</li>
        </ul>
      </section>

      <section class="ruleSection">
        <h2>🎒 道具卡系統</h2>
        <ul>
          <li>購買後加入手牌（上限 3 張）。</li>
          <li>每張道具有固定的使用時機：<span class="inlineTag buy">💰 購買</span>、<span class="inlineTag necro">⚗️ 死靈</span>、<span class="inlineTag combat">⚔️ 戰鬥</span>。</li>
          <li>使用後進入棄牌堆（無法回手）。</li>
          <li>購買階段也可以棄置手牌中的道具卡（避免達到上限無法購買）。</li>
        </ul>
      </section>

      <section class="ruleSection">
        <h2>⚙️ 特殊能力系統</h2>
        <p>每張靈魂卡附帶一至多個<strong>被動或觸發型能力</strong>，賦予棋子超越象棋原始規則的特殊行為。能力在附魂後即刻生效，棋子死亡後隨靈魂卡一同離場。</p>
        <ul style="margin-top:10px">
          <li><strong>移動類</strong>：改變棋子的合法走格範圍，例如無視阻擋穿越敵方（鬼步）或擴展移動距離。</li>
          <li><strong>射擊類</strong>：改變射程、穿透規則或傷害方式，例如無視阻擋越境射擊、命中後繼續穿透（貫通）、爆炸波及相鄰格（波及）。</li>
          <li><strong>觸發類</strong>：在特定條件下自動發動，例如受擊反擊、擊殺後回收資源、每回合結算加成。</li>
          <li><strong>持續類</strong>：依場況持續提供加成，例如隨屍骸數量提升全軍傷害、依財力強化防禦。</li>
        </ul>
        <p style="margin-top:10px; font-size:0.8125rem; color:var(--text-muted); line-height:1.6">詳細能力描述可在「卡牌圖鑑」中查閱每張靈魂卡的效果文字。</p>
      </section>

      <section class="ruleSection">
        <h2>🏆 勝負判定</h2>
        <p><strong>帥（將）被擊殺，即判該方負。</strong>帥/將的 HP 耗盡即死亡——無論被直接攻擊還是砲擊均算。帥有 15 HP，且附有 2/2 物理/魔法防禦加成，需集中火力。</p>
      </section>

    </div>
  </main>
</template>

<style scoped>
.rulesMain {
  flex: 1;
  padding: 24px max(16px, 5vw);
  max-width: 820px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

.rulebook {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.ruleSection h2 {
  font-size: 1rem;
  font-weight: 700;
  margin: 0 0 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
  color: var(--accent-gold);
}

.ruleSection p,
.ruleSection ul,
.ruleSection li {
  font-size: 0.875rem;
  line-height: 1.7;
  color: var(--text-muted);
  margin: 0;
}
.ruleSection ul { padding-left: 20px; }
.ruleSection li { margin-bottom: 4px; }
.ruleSection strong { color: var(--text); }

.resourceGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.resourceCard {
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg-surface-1);
}
.resTitle { font-size: 0.9375rem; font-weight: 700; margin-bottom: 6px; color: var(--text); }
.resDesc { font-size: 0.8125rem; line-height: 1.6; color: var(--text-muted); }

.phaseList { display: flex; flex-direction: column; gap: 10px; }
.phaseItem {
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--bg-surface-1);
}
.phaseTag {
  padding: 6px 14px;
  font-size: 0.8125rem;
  font-weight: 700;
}
.phaseTag.buy    { background: rgba(232, 208, 112, 0.12); color: var(--accent-gold); }
.phaseTag.necro  { background: rgba(145, 202, 255, 0.10); color: var(--accent-blue); }
.phaseTag.combat { background: rgba(255, 77, 79, 0.10);   color: var(--accent-red-light); }
.phaseDesc { padding: 10px 14px; }
.phaseDesc ul { padding-left: 18px; margin: 0; }
.phaseDesc li { font-size: 0.8125rem; line-height: 1.65; color: var(--text-muted); margin-bottom: 4px; }
.phaseDesc strong { color: var(--text); }

.inlineTag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  margin: 0 2px;
}
.inlineTag.buy    { background: rgba(232, 208, 112, 0.15); color: var(--accent-gold); }
.inlineTag.necro  { background: rgba(145, 202, 255, 0.12); color: var(--accent-blue); }
.inlineTag.combat { background: rgba(255, 77, 79, 0.12);   color: var(--accent-red-light); }

@media (max-width: 700px) {
  .resourceGrid { grid-template-columns: 1fr; }
}
</style>

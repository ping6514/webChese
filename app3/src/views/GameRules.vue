<script setup lang="ts">
import { ref } from 'vue'

const activeSection = ref<string>('overview')

const sections = [
  { id: 'overview', name: '遊戲概述', icon: '📖' },
  { id: 'cards', name: '卡牌類型', icon: '🎴' },
  { id: 'flow', name: '遊戲流程', icon: '🎮' },
  { id: 'combat', name: '戰鬥規則', icon: '⚔️' },
  { id: 'area', name: '區域與磚堆', icon: '🏰' },
  { id: 'classes', name: '職業特色', icon: '🎯' },
  { id: 'terms', name: '關鍵術語', icon: '📋' },
  { id: 'advanced', name: '進階規則', icon: '🎲' },
  { id: 'tactics', name: '戰術建議', icon: '💡' },
  { id: 'faq', name: '常見問題', icon: '❓' }
]

function scrollToSection(sectionId: string) {
  activeSection.value = sectionId
  const element = document.getElementById(sectionId)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
</script>

<template>
  <div class="game-rules">
    <header class="rules-header">
      <h1>📖 魔物娘戰棋遊戲規則</h1>
      <p class="version">版本 v3.0 | 最後更新：2026年3月22日</p>
    </header>

    <div class="rules-layout">
      <!-- 側邊導航 -->
      <nav class="rules-nav">
        <div class="nav-sticky">
          <h3>目錄</h3>
          <ul class="nav-list">
            <li 
              v-for="section in sections" 
              :key="section.id"
              :class="['nav-item', activeSection === section.id && 'active']"
              @click="scrollToSection(section.id)"
            >
              <span class="nav-icon">{{ section.icon }}</span>
              <span class="nav-name">{{ section.name }}</span>
            </li>
          </ul>
        </div>
      </nav>

      <!-- 主要內容 -->
      <main class="rules-content">
        <!-- 遊戲概述 -->
        <section id="overview" class="rule-section">
          <h2>📖 遊戲概述</h2>
          <p class="intro">
            <strong>魔物娘戰棋</strong>是一款雙人對戰的卡牌戰棋遊戲。玩家扮演魔物娘軍團的指揮官，通過召喚首領、裝備軍團、使用事件卡和反應卡，最終攻破敵方基地獲得勝利。
          </p>
          
          <div class="highlight-box victory">
            <h3>🎯 勝利條件</h3>
            <p><strong>摧毀敵方基地</strong> - 將敵方城牆生命力降至0</p>
          </div>

          <div class="battlefield">
            <h3>🗺️ 戰場結構</h3>
            <div class="battlefield-diagram">
              <div class="zone my-base-zone">我方基地</div>
              <div class="zone-arrow">←</div>
              <div class="zone my-field-zone">我方戰場</div>
              <div class="zone-arrow">←</div>
              <div class="zone enemy-field-zone">敵方戰場</div>
              <div class="zone-arrow">→</div>
              <div class="zone enemy-base-zone">敵方基地</div>
            </div>
            <ul class="zone-list">
              <li><strong>我方基地</strong> - 玩家的基地區域，包含城牆（生命力5），守護者優勢區域</li>
              <li><strong>我方戰場</strong> - 我方前線區域，指揮官優勢區域</li>
              <li><strong>敵方戰場</strong> - 敵方前線區域，破壞者優勢區域</li>
              <li><strong>敵方基地</strong> - 敵方基地區域，攻城目標</li>
              <li><strong>磚堆</strong> - 每個區域都有磚堆，用於防禦和築城</li>
            </ul>
          </div>
        </section>

        <!-- 卡牌類型 -->
        <section id="cards" class="rule-section">
          <h2>🎴 卡牌類型</h2>
          
          <div class="card-type">
            <h3>1. 首領卡（Leader Card）</h3>
            <ul>
              <li><strong>數量</strong> - 每位玩家選擇3張首領卡</li>
              <li><strong>職業</strong> - 破壞者、征服者、指揮官、守護者</li>
            </ul>
            <div class="stats-grid">
              <div class="stat-box">
                <span class="stat-icon">❤️</span>
                <strong>堅韌</strong>
                <p>生命值，降至0時進入暈眩狀態</p>
              </div>
              <div class="stat-box">
                <span class="stat-icon">⚔️</span>
                <strong>對敵</strong>
                <p>攻擊力</p>
              </div>
              <div class="stat-box">
                <span class="stat-icon">🛡️</span>
                <strong>防護協助</strong>
                <p>防禦支援值</p>
              </div>
              <div class="stat-box">
                <span class="stat-icon">⚡</span>
                <strong>攻擊協助</strong>
                <p>攻擊支援值</p>
              </div>
              <div class="stat-box">
                <span class="stat-icon">💚</span>
                <strong>回復力</strong>
                <p>每回合自動回復的堅韌值</p>
              </div>
            </div>
          </div>

          <div class="card-type">
            <h3>2. 軍團卡（Legion Card）</h3>
            <p>裝備在首領身上，提供屬性加成和額外能力</p>
            <ul>
              <li><strong>通用軍團</strong> - 所有職業都可裝備</li>
              <li><strong>職業專屬軍團</strong> - 只有特定職業可裝備</li>
            </ul>
          </div>

          <div class="card-type">
            <h3>3. 事件卡（Event Card）</h3>
            <p>在主要階段使用，產生即時效果</p>
            <div class="category-tags">
              <span class="tag movement">移動類</span>
              <span class="tag buff">增益類</span>
              <span class="tag control">控制類</span>
              <span class="tag resource">資源類</span>
              <span class="tag special">特殊類</span>
            </div>
          </div>

          <div class="card-type">
            <h3>4. 反應卡（Reaction Card）</h3>
            <p>安裝在首領身上，觸發條件滿足時自動發動</p>
            <ul>
              <li>受到對敵時</li>
              <li>進入暈眩/擊敗時</li>
              <li>敵人清磚時</li>
              <li>敵人進入區域時</li>
            </ul>
          </div>

          <div class="card-type">
            <h3>5. 建築卡（Building Card）</h3>
            <p>放置在磚堆區，提供持續性場地效果</p>
            <ul>
              <li><strong>通用區域建築</strong> - 可放置在廣場區或主堡區（4張）</li>
              <li><strong>基地專用建築</strong> - 只能放置在主堡區（2張）</li>
            </ul>
          </div>
        </section>

        <!-- 遊戲流程 -->
        <section id="flow" class="rule-section">
          <h2>🎮 遊戲流程</h2>
          
          <div class="phase-box">
            <h3>遊戲準備</h3>
            <ol>
              <li><strong>選擇首領</strong> - 每位玩家選擇3張首領卡</li>
              <li><strong>構築牌組</strong> - 準備軍團卡、事件卡、反應卡、建築卡（建議30-40張）</li>
              <li><strong>初始設置</strong> - 城牆生命力：5，初始手牌：5張，所有首領放置在我方基地</li>
            </ol>
          </div>

          <div class="phase-box">
            <h3>回合結構</h3>
            
            <div class="phase">
              <h4>1️⃣ 回合開始階段</h4>
              <ul>
                <li>重置所有首領的行動狀態</li>
                <li>技能冷卻-1</li>
                <li>觸發「回合開始時」的效果</li>
                <li>所有首領根據回復力自動回復堅韌</li>
              </ul>
            </div>

            <div class="phase">
              <h4>2️⃣ 抽牌階段</h4>
              <ul>
                <li>抽1張牌（標準）</li>
                <li>若手牌為0，則抽2張牌</li>
              </ul>
            </div>

            <div class="phase">
              <h4>3️⃣ 主要階段</h4>
              <p>可以進行以下行動（無順序限制）：</p>
              
              <div class="action-list">
                <div class="action-item">
                  <strong>A. 召喚軍團</strong>
                  <p>一回合一次，將軍團卡裝備在首領上</p>
                </div>
                <div class="action-item">
                  <strong>B. 使用事件卡</strong>
                  <p>打出事件卡，執行效果</p>
                </div>
                <div class="action-item">
                  <strong>C. 安裝反應卡</strong>
                  <p>將反應卡安裝在首領身上</p>
                </div>
                <div class="action-item">
                  <strong>D. 放置建築卡</strong>
                  <p>將建築卡放置在磚堆區</p>
                </div>
                <div class="action-item">
                  <strong>E. 首領行動</strong>
                  <p>移動（1格，征服者可2格）、對敵、清磚、攻城（只能在敵方基地）、築城、修城（只能在我方基地）、使用技能</p>
                </div>
              </div>
            </div>

            <div class="phase">
              <h4>4️⃣ 回合結束階段</h4>
              <ul>
                <li>檢查手牌上限（通常為7張，超過需棄牌）</li>
                <li>觸發「回合結束時」的效果</li>
                <li>回合交給對手</li>
              </ul>
            </div>
          </div>
        </section>

        <!-- 戰鬥規則 -->
        <section id="combat" class="rule-section">
          <h2>⚔️ 戰鬥規則</h2>
          
          <div class="formula-box">
            <h3>對敵（攻擊）計算</h3>
            <div class="formula">
              實際傷害 = 攻擊方對敵 + 攻擊方攻擊協助 - 防禦方防護協助
            </div>
          </div>

          <div class="combat-rule">
            <h3>聯手攻擊</h3>
            <ul>
              <li>同區域的多個友軍可以聯手攻擊同一目標</li>
              <li>聯手時，所有參與者的對敵值和協助力加總</li>
              <li>防禦方只計算一次防護協助</li>
            </ul>
          </div>

          <div class="combat-rule">
            <h3>暈眩狀態</h3>
            <ul>
              <li>首領堅韌降至0時，進入暈眩狀態</li>
              <li>暈眩的首領：不能行動、不能提供協助、對敵值和防護協助降為0</li>
              <li>暈眩的首領在下回合開始時，堅韌回復至1，解除暈眩</li>
            </ul>
          </div>

          <div class="combat-rule">
            <h3>擊敗（KO）</h3>
            <ul>
              <li>暈眩狀態的首領再次受到傷害時，進入擊敗狀態</li>
              <li>擊敗的首領：返回我方主堡區、裝備的軍團卡棄置、堅韌回復至1</li>
              <li>下回合可以重新行動</li>
            </ul>
          </div>
        </section>

        <!-- 區域與磚堆 -->
        <section id="area" class="rule-section">
          <h2>🏰 區域與磚堆規則</h2>
          
          <div class="area-rule">
            <h3>磚堆系統</h3>
            <ul>
              <li>每個區域都有磚堆（初始值通常為2）</li>
              <li>磚堆作用：防禦（減少攻城傷害）、築城、清磚</li>
            </ul>
          </div>

          <div class="area-rule">
            <h3>攻城規則</h3>
            <p><strong>只能在敵方基地攻城</strong></p>
            <div class="example-box">
              <h4>範例：</h4>
              <p>攻城值3，磚堆2 → 磚堆歸0，城牆-1</p>
              <p>攻城值2，磚堆3 → 磚堆-2，城牆無傷害</p>
            </div>
          </div>
          
          <div class="area-rule">
            <h3>區域推進</h3>
            <p>首領需要逐步推進才能到達敵方基地</p>
            <div class="example-box">
              <h4>推進路線：</h4>
              <p>我方基地 → 我方戰場 → 敵方戰場 → 敵方基地</p>
              <p><strong>征服者優勢：</strong>可以快速穿插，移動2格</p>
            </div>
          </div>
        </section>

        <!-- 職業特色 -->
        <section id="classes" class="rule-section">
          <h2>🎯 職業特色</h2>
          
          <div class="class-grid">
            <div class="class-card destroyer">
              <h3>💥 破壞者（Destroyer）</h3>
              <p class="class-desc">高攻擊、清磚、攻城</p>
              <div class="class-pros">
                <strong>優勢：</strong>快速推進、破壞建築、在敵方戰場和敵方基地戰鬥力強
              </div>
              <div class="class-cons">
                <strong>弱點：</strong>防禦較弱、回復力低
              </div>
              <div class="class-position">
                <strong>定位：</strong>前線攻擊手，推進至敵方基地攻城
              </div>
            </div>

            <div class="class-card conqueror">
              <h3>🏃 征服者（Conqueror）</h3>
              <p class="class-desc">高機動、快速攻擊</p>
              <div class="class-pros">
                <strong>優勢：</strong>靈活移動、突襲、可以快速穿插多個區域
              </div>
              <div class="class-cons">
                <strong>弱點：</strong>堅韌較低
              </div>
              <div class="class-position">
                <strong>定位：</strong>機動突襲手，快速移動打亂敵方陣型
              </div>
            </div>

            <div class="class-card commander">
              <h3>🎖️ 指揮官（Commander）</h3>
              <p class="class-desc">高協助力、控制</p>
              <div class="class-pros">
                <strong>優勢：</strong>支援友軍、限制敵人、在我方戰場和敵方戰場提供強力支援
              </div>
              <div class="class-cons">
                <strong>弱點：</strong>單體戰鬥力較弱
              </div>
              <div class="class-position">
                <strong>定位：</strong>中場控制者，在戰場區域支援和控制
              </div>
            </div>

            <div class="class-card guardian">
              <h3>🛡️ 守護者（Guardian）</h3>
              <p class="class-desc">高堅韌、回復、築城</p>
              <div class="class-pros">
                <strong>優勢：</strong>持久戰、防禦、在我方基地和我方戰場防禦力強
              </div>
              <div class="class-cons">
                <strong>弱點：</strong>攻擊力低、機動性差
              </div>
              <div class="class-position">
                <strong>定位：</strong>後方防守者，保護我方基地和提供持續回復
              </div>
            </div>
          </div>
        </section>

        <!-- 關鍵術語 -->
        <section id="terms" class="rule-section">
          <h2>📋 關鍵術語</h2>
          
          <div class="terms-grid">
            <div class="term-group">
              <h3>基礎術語</h3>
              <dl>
                <dt>堅韌</dt><dd>首領的生命值</dd>
                <dt>對敵</dt><dd>攻擊力</dd>
                <dt>清磚</dt><dd>清除磚堆</dd>
                <dt>攻城</dt><dd>攻擊城牆</dd>
                <dt>築城</dt><dd>增加磚堆</dd>
                <dt>修城</dt><dd>修復城牆</dd>
                <dt>回復</dt><dd>恢復堅韌值</dd>
              </dl>
            </div>

            <div class="term-group">
              <h3>狀態術語</h3>
              <dl>
                <dt>暈眩</dt><dd>堅韌歸0，不能行動</dd>
                <dt>擊敗（KO）</dt><dd>暈眩狀態再受傷，返回基地</dd>
                <dt>癱瘓</dt><dd>不能行動，但保留協助力</dd>
                <dt>禁錮</dt><dd>不能移動和行動</dd>
                <dt>擊退</dt><dd>強制移動至指定區域</dd>
              </dl>
            </div>

            <div class="term-group">
              <h3>協助術語</h3>
              <dl>
                <dt>防護協助</dt><dd>減少受到的傷害</dd>
                <dt>攻擊協助</dt><dd>增加友軍的攻擊力</dd>
                <dt>聯手</dt><dd>多個單位共同攻擊</dd>
              </dl>
            </div>
          </div>
        </section>

        <!-- 進階規則 -->
        <section id="advanced" class="rule-section">
          <h2>🎲 進階規則</h2>
          
          <div class="advanced-rule">
            <h3>軍團召喚規則</h3>
            <ul>
              <li><strong>標準召喚</strong> - 一回合一次，免費裝備軍團卡</li>
              <li><strong>額外召喚</strong> - 通過事件卡或技能效果，可以額外召喚</li>
              <li><strong>召喚成本</strong> - 部分強力軍團需要丟棄手牌</li>
              <li><strong>軍團取代</strong> - 新軍團會取代舊軍團</li>
            </ul>
          </div>

          <div class="advanced-rule">
            <h3>建築破壞規則</h3>
            <ul>
              <li>敵人清磚時可以選擇破壞建築卡</li>
              <li>建築卡被破壞時送入墓地</li>
              <li>部分建築卡有職業破壞限制</li>
            </ul>
          </div>
        </section>

        <!-- 戰術建議 -->
        <section id="tactics" class="rule-section">
          <h2>💡 戰術建議</h2>
          
          <div class="tactics-grid">
            <div class="tactic-box">
              <h3>開局策略</h3>
              <ul>
                <li>平衡首領選擇</li>
                <li>前後線配置：破壞者/征服者前線，指揮官中場，守護者後方</li>
                <li>控制戰場區</li>
                <li>築城防禦：建立防禦縱深</li>
              </ul>
            </div>

            <div class="tactic-box">
              <h3>中期策略</h3>
              <ul>
                <li>推進前線：破壞者推進至敵方戰場</li>
                <li>裝備軍團</li>
                <li>使用事件卡</li>
                <li>安裝反應卡</li>
                <li>區域控制：為攻城做準備</li>
              </ul>
            </div>

            <div class="tactic-box">
              <h3>終局策略</h3>
              <ul>
                <li>推進至敵方基地</li>
                <li>清除磚堆</li>
                <li>集中攻城</li>
                <li>保護自己</li>
                <li>征服者突襲：利用快速移動</li>
              </ul>
            </div>
          </div>
        </section>

        <!-- 常見問題 -->
        <section id="faq" class="rule-section">
          <h2>❓ 常見問題</h2>
          
          <div class="faq-list">
            <div class="faq-item">
              <h4>Q: 首領被擊敗後，裝備的軍團卡會怎樣？</h4>
              <p>A: 軍團卡會被棄置，但反應卡會保留。</p>
            </div>

            <div class="faq-item">
              <h4>Q: 可以同時裝備多張軍團卡嗎？</h4>
              <p>A: 不行，每個首領同時只能裝備1張軍團卡。</p>
            </div>

            <div class="faq-item">
              <h4>Q: 暈眩的首領還能提供協助嗎？</h4>
              <p>A: 不行，暈眩的首領不能提供任何協助。</p>
            </div>

            <div class="faq-item">
              <h4>Q: 攻城時，磚堆和城牆哪個先承受傷害？</h4>
              <p>A: 磚堆先承受傷害，剩餘傷害才會傷害城牆。</p>
            </div>

            <div class="faq-item">
              <h4>Q: 反應卡可以安裝多張嗎？</h4>
              <p>A: 可以，每個首領可以安裝多張反應卡。</p>
            </div>

            <div class="faq-item">
              <h4>Q: 聯手攻擊時，如何計算傷害？</h4>
              <p>A: 所有參與者的對敵值和攻擊協助加總，減去防禦方的防護協助。</p>
            </div>
          </div>
        </section>

        <!-- 卡牌統計 -->
        <div class="stats-summary">
          <h2>📊 卡牌數量統計</h2>
          <div class="stats-cards">
            <div class="stat-card">
              <div class="stat-number">12</div>
              <div class="stat-label">首領卡</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">22</div>
              <div class="stat-label">軍團卡</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">20</div>
              <div class="stat-label">事件卡</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">20</div>
              <div class="stat-label">反應卡</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">6</div>
              <div class="stat-label">建築卡</div>
            </div>
          </div>
          <p class="total">總計：<strong>80張核心卡牌</strong></p>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.game-rules {
  min-height: 100vh;
  background: #f5f5f5;
}

.rules-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 3rem 2rem;
  text-align: center;
}

.rules-header h1 {
  margin: 0;
  font-size: 2.5rem;
}

.version {
  margin: 0.5rem 0 0 0;
  opacity: 0.9;
  font-size: 0.9rem;
}

.rules-layout {
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 2rem;
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

@media (max-width: 1024px) {
  .rules-layout {
    grid-template-columns: 1fr;
  }
  
  .rules-nav {
    display: none;
  }
}

.rules-nav {
  position: relative;
}

.nav-sticky {
  position: sticky;
  top: 2rem;
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.nav-sticky h3 {
  margin: 0 0 1rem 0;
  color: #667eea;
  font-size: 1.2rem;
}

.nav-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.nav-item:hover {
  background: #f5f5f5;
}

.nav-item.active {
  background: #667eea;
  color: white;
}

.nav-icon {
  font-size: 1.2rem;
}

.nav-name {
  font-size: 0.95rem;
  font-weight: 500;
}

.rules-content {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.rule-section {
  margin-bottom: 3rem;
  padding-bottom: 2rem;
  border-bottom: 2px solid #e0e0e0;
}

.rule-section:last-child {
  border-bottom: none;
}

.rule-section h2 {
  color: #667eea;
  font-size: 2rem;
  margin: 0 0 1.5rem 0;
}

.rule-section h3 {
  color: #333;
  font-size: 1.3rem;
  margin: 1.5rem 0 1rem 0;
}

.intro {
  font-size: 1.1rem;
  line-height: 1.8;
  color: #444;
  margin-bottom: 1.5rem;
}

.highlight-box {
  background: #e8f5e9;
  border-left: 4px solid #4caf50;
  padding: 1.5rem;
  border-radius: 8px;
  margin: 1.5rem 0;
}

.highlight-box.victory {
  background: #fff3e0;
  border-left-color: #ff9800;
}

.highlight-box h3 {
  margin: 0 0 0.5rem 0;
  color: #333;
}

.battlefield-diagram {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin: 1.5rem 0;
  padding: 1.5rem;
  background: #f9f9f9;
  border-radius: 8px;
  flex-wrap: wrap;
}

.zone {
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-weight: 600;
  text-align: center;
  min-width: 100px;
  font-size: 0.9rem;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .battlefield-diagram {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .zone {
    width: 100%;
    min-width: auto;
  }
  
  .zone-arrow {
    transform: rotate(90deg);
  }
}

.my-base-zone {
  background: #e8f5e9;
  color: #2e7d32;
  border: 2px solid #2e7d32;
}

.my-field-zone {
  background: #e3f2fd;
  color: #1976d2;
  border: 2px solid #1976d2;
}

.enemy-field-zone {
  background: #fff3e0;
  color: #f57c00;
  border: 2px solid #f57c00;
}

.enemy-base-zone {
  background: #ffebee;
  color: #c62828;
  border: 2px solid #c62828;
}

.zone-arrow {
  font-size: 1.5rem;
  color: #999;
}

.zone-list {
  margin-top: 1rem;
}

.zone-list li {
  margin-bottom: 0.5rem;
  line-height: 1.6;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin: 1.5rem 0;
}

.stat-box {
  background: #f9f9f9;
  padding: 1rem;
  border-radius: 8px;
  text-align: center;
  border: 2px solid #e0e0e0;
}

.stat-icon {
  font-size: 2rem;
  display: block;
  margin-bottom: 0.5rem;
}

.stat-box strong {
  display: block;
  margin-bottom: 0.5rem;
  color: #667eea;
}

.stat-box p {
  margin: 0;
  font-size: 0.85rem;
  color: #666;
}

.card-type {
  margin-bottom: 2rem;
}

.category-tags {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 1rem;
}

.tag {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 600;
}

.tag.movement { background: #e3f2fd; color: #1976d2; }
.tag.buff { background: #f3e5f5; color: #7b1fa2; }
.tag.control { background: #fff3e0; color: #f57c00; }
.tag.resource { background: #e8f5e9; color: #388e3c; }
.tag.special { background: #fce4ec; color: #c2185b; }

.phase-box {
  background: #f9f9f9;
  padding: 1.5rem;
  border-radius: 8px;
  margin: 1.5rem 0;
}

.phase {
  margin: 1.5rem 0;
}

.phase h4 {
  color: #667eea;
  margin-bottom: 0.75rem;
}

.action-list {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
}

.action-item {
  background: white;
  padding: 1rem;
  border-radius: 8px;
  border-left: 4px solid #667eea;
}

.action-item strong {
  display: block;
  color: #667eea;
  margin-bottom: 0.5rem;
}

.formula-box {
  background: #e8f5e9;
  padding: 1.5rem;
  border-radius: 8px;
  margin: 1.5rem 0;
}

.formula {
  font-size: 1.2rem;
  font-weight: 600;
  text-align: center;
  padding: 1rem;
  background: white;
  border-radius: 6px;
  margin-top: 1rem;
  color: #388e3c;
}

.combat-rule, .area-rule, .advanced-rule {
  margin: 1.5rem 0;
}

.example-box {
  background: #f9f9f9;
  padding: 1rem;
  border-radius: 6px;
  margin-top: 0.5rem;
}

.example-box h4 {
  margin: 0 0 0.5rem 0;
  color: #667eea;
}

.class-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin: 1.5rem 0;
}

.class-card {
  padding: 1.5rem;
  border-radius: 12px;
  border: 3px solid;
}

.class-card.destroyer {
  background: #ffebee;
  border-color: #f44336;
}

.class-card.conqueror {
  background: #fff3e0;
  border-color: #ff9800;
}

.class-card.commander {
  background: #f3e5f5;
  border-color: #9c27b0;
}

.class-card.guardian {
  background: #e3f2fd;
  border-color: #2196f3;
}

.class-card h3 {
  margin: 0 0 0.5rem 0;
}

.class-desc {
  font-weight: 600;
  margin-bottom: 1rem;
}

.class-pros, .class-cons, .class-position {
  margin: 0.5rem 0;
  font-size: 0.9rem;
}

.class-position {
  margin-top: 1rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(0,0,0,0.1);
}

.terms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  margin: 1.5rem 0;
}

.term-group h3 {
  color: #667eea;
  margin-bottom: 1rem;
}

.term-group dl {
  margin: 0;
}

.term-group dt {
  font-weight: 600;
  color: #333;
  margin-top: 0.75rem;
}

.term-group dd {
  margin: 0.25rem 0 0 1rem;
  color: #666;
}

.tactics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin: 1.5rem 0;
}

.tactic-box {
  background: #f9f9f9;
  padding: 1.5rem;
  border-radius: 8px;
  border-top: 4px solid #667eea;
}

.tactic-box h3 {
  margin: 0 0 1rem 0;
  color: #667eea;
}

.faq-list {
  margin: 1.5rem 0;
}

.faq-item {
  background: #f9f9f9;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  border-left: 4px solid #667eea;
}

.faq-item h4 {
  margin: 0 0 0.75rem 0;
  color: #333;
}

.faq-item p {
  margin: 0;
  color: #666;
}

.stats-summary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2rem;
  border-radius: 12px;
  margin-top: 3rem;
}

.stats-summary h2 {
  color: white;
  text-align: center;
  margin-bottom: 2rem;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  background: rgba(255,255,255,0.2);
  padding: 1.5rem;
  border-radius: 8px;
  text-align: center;
  backdrop-filter: blur(10px);
}

.stat-number {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.stat-label {
  font-size: 0.9rem;
  opacity: 0.9;
}

.total {
  text-align: center;
  font-size: 1.2rem;
  margin: 0;
}
</style>

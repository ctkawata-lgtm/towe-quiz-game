'use strict';

(() => {
  const XLSX_URL = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const LOCAL_PDFJS_URL = './assets/vendor/pdfjs/pdf.min.mjs';
  const LOCAL_PDFJS_WORKER_URL = './assets/vendor/pdfjs/pdf.worker.min.mjs';
  const DOCUMENT_PRESETS = [
    {
      id: 'shindanshi-economics',
      label: '診断士_経済学',
      pdf: './assets/presets/24_過去問_経済.pdf',
      excel: './assets/presets/24_過去問_経済.xlsx',
    },
    {
      id: 'shindanshi-it',
      label: '診断士_情報システム',
      pdf: './assets/presets/24_過去問_情報システム.pdf',
      excel: './assets/presets/24_過去問_情報システム.xlsx',
    },
    {
      id: 'cpa-finance',
      label: 'CPA_財務理論',
      pdf: './assets/presets/財務諸表論問題集.pdf',
      excel: './assets/presets/財務諸表論問題集_財務理論_複数回答.xlsx',
    },
  ];

  let docGs = createDocumentState();
  let renderSerial = 0;

  function createDocumentState() {
    return {
      pdfFile: null,
      excelFile: null,
      pdf: null,
      sourceQuestions: [],
      questions: [],
      currentIndex: 0,
      playMode: null,
      pendingModeReason: 'initial',
      orderMode: 'excel',
      combo: 0,
      missCount: 0,
      missStreak: 0,
      score: 0,
      phase: 'question',
      answerWasCorrect: false,
      answerResults: [],
      returnToStartAfterAnswer: false,
      returnReason: '',
      answerView: 'answer',
      zoom: getInitialDocumentZoom(),
      spreadStart: 1,
      spreadMin: 1,
      spreadMax: 1,
      reviewCount: 0,
      dashboardTheme: 'accounting',
    };
  }

  function isMobileViewport() {
    return window.matchMedia ? window.matchMedia('(max-width: 760px)').matches : window.innerWidth <= 760;
  }

  function getInitialDocumentZoom() {
    return isMobileViewport() ? 1.6 : 1;
  }

  function updateDocumentZoomLabels() {
    const label = `${Math.round(docGs.zoom * 100)}%`;
    const documentLabel = document.getElementById('documentZoomLabel');
    const dashboardLabel = document.getElementById('dashboardZoomLabel');
    if (documentLabel) documentLabel.textContent = label;
    if (dashboardLabel) dashboardLabel.textContent = label;
  }

  function addStylesheet() {
    if (document.querySelector('link[href="document-mode.css"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'document-mode.css';
    document.head.appendChild(link);
  }

  function injectDocumentMode() {
    if (document.getElementById('screen-document')) return;
    const titleReset = document.getElementById('btnResetRecords');
    titleReset.insertAdjacentHTML('beforebegin', `
      <button id="btnDocumentMode" class="btn-start btn-document-start">
        <span>PDF + Excel 攻略モード</span><span class="btn-arrow">→</span>
      </button>
    `);

    document.getElementById('screen-clear').insertAdjacentHTML('beforebegin', `
      <div id="screen-document" class="screen hidden">
        <div class="document-shell">
          <header class="document-topbar">
            <div><div class="document-kicker">PDF + EXCEL TOWER</div><h2>見開き過去問攻略</h2></div>
            <button id="btnDocumentBackTitle" class="external-mini-btn">タイトルへ</button>
          </header>
          <section id="documentSetup" class="document-setup">
            <div class="document-setup-panel">
              <h3>攻略データを読み込む</h3>
              <p>セットアップ済みの問題はボタンだけで読み込めます。別の問題を使う場合は下のアップロードを使ってください。</p>
              <div class="document-preset-grid" aria-label="セットアップ済み問題">
                ${DOCUMENT_PRESETS.map(preset => `
                  <button type="button" class="document-preset-btn" data-document-preset="${preset.id}">
                    <strong>${preset.label}</strong>
                    <span>この問題で開始</span>
                  </button>
                `).join('')}
              </div>
              <details class="document-upload-details">
                <summary>他の問題をアップロード</summary>
                <label class="document-file-label"><span>問題・解答PDF</span><input id="documentPdfFile" type="file" accept=".pdf,application/pdf"><strong id="documentPdfName">未選択</strong></label>
                <label class="document-file-label"><span>採点・ページ情報Excel</span><input id="documentExcelFile" type="file" accept=".xlsx,.xls"><strong id="documentExcelName">未選択</strong></label>
              </details>
              <div id="documentLoadStatus" class="document-load-status">2ファイルを選択してください。</div>
              <button id="btnStartDocumentGame" class="btn-start hidden">第1問を開始 <span class="btn-arrow">→</span></button>
            </div>
          </section>
          <section id="documentModeSelect" class="document-mode-select hidden" aria-label="攻略モード選択">
            <div class="document-mode-dialog">
              <div class="document-mode-kicker">SELECT ROUTE</div>
              <h3 id="documentModeSelectTitle">攻略方法を選択</h3>
              <p id="documentModeSelectMessage">現在の問題順を維持したまま、攻略方法を選べます。</p>
              <div class="document-mode-options">
                <button type="button" data-document-mode="challenge"><strong>挑戦モード</strong><span>ミス条件で第1問へ戻る、現在の高難度ルール</span></button>
                <button type="button" data-document-mode="input-normal"><strong>インプット・普通</strong><span>自力回答後に解説表示。リセットなし、誤答は3問後に復習</span></button>
                <button type="button" data-document-mode="input-easy"><strong>インプット・簡単</strong><span>問題中から解答・解説PDFを併記。リセットなし、誤答は3問後に復習</span></button>
                <button type="button" data-document-mode="dashboard"><strong>ダッシュモード</strong><span>Notion風の業務ダッシュボードで、PDFと回答入力を控えめに並べて進めます。</span></button>
                <button type="button" data-document-mode="rpg"><strong>RPGモード</strong><span>問題に正解してダイスを振り、敵を倒しながら3waveを攻略します。</span></button>
              </div>
            </div>
          </section>
          <section id="documentPlay" class="document-play hidden">
            <aside class="document-progress-panel">
              <button id="btnDocumentToggleProgress" class="document-progress-toggle" type="button" title="進捗パネルを折り畳む" aria-expanded="true">‹</button>
              <div class="document-floor" id="documentFloor">1F</div>
              <div class="external-progress"><div class="external-progress-fill" id="documentProgressFill"></div></div>
              <div class="document-stat"><span>問題</span><strong id="documentQuestionNo">-</strong></div>
              <div class="document-stat"><span>モード</span><strong id="documentModeStatus">-</strong></div>
              <div class="document-stat"><span>復習登録</span><strong id="documentReviewCount">0</strong></div>
              <div class="document-order-controls">
                <div class="document-order-status" id="documentOrderStatus">Excel順</div>
                <button id="btnDocumentShuffle" type="button">シャッフル</button>
                <button id="btnDocumentRestoreOrder" type="button">元に戻す</button>
              </div>
              <div class="document-stat"><span>連続正解</span><strong id="documentCombo">0</strong></div>
              <div class="document-stat"><span>ミス</span><strong id="documentMiss">0/4</strong></div>
              <div class="document-stat"><span>連続ミス</span><strong id="documentMissStreak">0/3</strong></div>
              <div class="document-page-nav"><button id="btnDocumentPrevPage" title="前の見開き">←</button><span id="documentPageRange">-</span><button id="btnDocumentNextPage" title="次の見開き">→</button></div>
            </aside>
            <main class="document-viewer">
              <div class="document-viewer-toolbar">
                <div class="document-phase" id="documentPhase">問題</div>
                <div class="document-zoom-controls" aria-label="PDF zoom">
                  <button id="btnDocumentZoomOut" type="button" title="縮小">−</button>
                  <span id="documentZoomLabel">100%</span>
                  <button id="btnDocumentZoomIn" type="button" title="拡大">＋</button>
                  <button id="btnDocumentZoomReset" type="button" title="標準倍率">100%</button>
                </div>
              </div>
              <div class="document-spread">
                <figure class="document-page"><canvas id="documentPageLeft"></canvas><figcaption id="documentPageLeftLabel"></figcaption></figure>
                <figure class="document-page"><canvas id="documentPageRight"></canvas><figcaption id="documentPageRightLabel"></figcaption></figure>
                <div id="documentInlineAnswerSpread" class="document-inline-answer-spread hidden">
                  <div class="document-inline-answer-title">解答・解説</div>
                  <div class="document-inline-answer-pages">
                    <figure class="document-page"><canvas id="documentAnswerPageLeft"></canvas><figcaption id="documentAnswerPageLeftLabel"></figcaption></figure>
                    <figure class="document-page"><canvas id="documentAnswerPageRight"></canvas><figcaption id="documentAnswerPageRightLabel"></figcaption></figure>
                  </div>
                </div>
              </div>
              <section id="documentEasyReference" class="document-easy-reference hidden">
                <div class="document-easy-reference-title">解答・解説を参照しながら知識を整理</div>
                <div class="document-easy-spread">
                  <figure class="document-page"><canvas id="documentEasyPageLeft"></canvas><figcaption id="documentEasyPageLeftLabel"></figcaption></figure>
                  <figure class="document-page"><canvas id="documentEasyPageRight"></canvas><figcaption id="documentEasyPageRightLabel"></figcaption></figure>
                </div>
              </section>
            </main>
            <aside class="document-answer-panel">
              <div id="documentAnswerPane" class="document-answer-pane">
                <div id="documentAnswerQuestion" class="document-answer-question">PDFを確認して解答してください。</div>
                <div id="documentAnswerInputs" class="document-answer-inputs"></div>
                <button id="btnDocumentSubmit" class="document-submit">採点する</button>
                <div id="documentResult" class="document-result hidden"></div>
                <button id="btnDocumentCompare" class="document-compare hidden" type="button"></button>
                <button id="btnDocumentProceed" class="document-proceed hidden"></button>
              </div>
              <div id="documentAnswerToolsDivider" class="document-tools-dragbar" title="上下にドラッグして高さを調整">⋮⋮ 高さ調整 ⋮⋮</div>
              <div class="document-study-tools">
                <section id="documentCalculatorPanel" class="document-tool-panel" aria-label="電卓">
                  <div class="document-tool-heading">電卓</div>
                  <div class="document-calculator-output">
                    <input id="documentCalcDisplay" class="document-calculator-display" type="text" value="0" inputmode="decimal" aria-label="電卓の表示">
                    <button id="btnDocumentCalcToMemo" type="button" title="計算結果をメモへ追加">メモへ</button>
                  </div>
                  <div class="document-calculator-grid">
                    <button type="button" data-document-calc-action="clear">C</button>
                    <button type="button" data-document-calc-action="backspace" title="1文字消す">⌫</button>
                    <button type="button" data-document-calc-action="append" data-document-calc-value="÷">÷</button>
                    <button type="button" data-document-calc-action="append" data-document-calc-value="×">×</button>
                    <button type="button" data-document-calc-action="append" data-document-calc-value="7">7</button>
                    <button type="button" data-document-calc-action="append" data-document-calc-value="8">8</button>
                    <button type="button" data-document-calc-action="append" data-document-calc-value="9">9</button>
                    <button type="button" data-document-calc-action="append" data-document-calc-value="-">−</button>
                    <button type="button" data-document-calc-action="append" data-document-calc-value="4">4</button>
                    <button type="button" data-document-calc-action="append" data-document-calc-value="5">5</button>
                    <button type="button" data-document-calc-action="append" data-document-calc-value="6">6</button>
                    <button type="button" data-document-calc-action="append" data-document-calc-value="+">+</button>
                    <button type="button" data-document-calc-action="append" data-document-calc-value="1">1</button>
                    <button type="button" data-document-calc-action="append" data-document-calc-value="2">2</button>
                    <button type="button" data-document-calc-action="append" data-document-calc-value="3">3</button>
                    <button type="button" class="is-equals" data-document-calc-action="evaluate">=</button>
                    <button type="button" data-document-calc-action="append" data-document-calc-value="0">0</button>
                    <button type="button" data-document-calc-action="append" data-document-calc-value="00">00</button>
                    <button type="button" data-document-calc-action="append" data-document-calc-value=".">.</button>
                  </div>
                </section>
                <section id="documentMemoPanel" class="document-tool-panel" aria-label="メモ">
                  <div class="document-memo-heading">
                    <div class="document-tool-heading">メモ</div>
                    <button id="btnDocumentMemoCopy" class="document-memo-copy" type="button" title="文字メモをコピー">コピー</button>
                  </div>
                  <textarea id="documentMemoText" class="document-memo-text" rows="6" placeholder="文字メモ"></textarea>
                </section>
              </div>
            </aside>
          </section>
          <section id="documentDashboard" class="document-dashboard hidden" aria-label="ダッシュモード">
            <aside class="dash-sidebar">
              <div class="dash-workspace-row"><span>›</span><strong>Notionタスク管理...</strong><span>…</span><span>＋</span></div>
              <nav class="dash-page-list" aria-label="Notion page list">
                <button type="button"><span>▧</span>菊地</button>
                <button type="button"><span>▧</span>Bocco</button>
                <button type="button"><span>▧</span>その他社内</button>
                <button type="button"><span>⚡</span>Notion</button>
                <button type="button" class="is-active"><span>⚡</span>Notionタスク管理20260409</button>
                <button type="button"><span>📁</span>入力</button>
                <button type="button"><span>▧</span>t</button>
                <button type="button"><span>▧</span>植村電機</button>
                <button type="button"><span>▧</span>タグ</button>
                <button type="button"><span>▧</span>新規ページ</button>
                <button type="button"><span>▧</span>bobob</button>
                <button type="button" class="is-muted"><span>▧</span>bcc</button>
              </nav>
            </aside>
            <main class="dash-main">
              <header class="dash-page-header">
                <div>
                  <div class="dash-breadcrumb">業務管理 / 税務レビュー / 実行管理</div>
                  <h1 class="dash-page-title">ダッシュモード</h1>
                </div>
                <div class="dash-header-actions">
                  <div class="dash-theme-tabs" aria-label="背景切り替え">
                    <button type="button" data-dashboard-theme="accounting" class="is-active">税務・会計</button>
                    <button type="button" data-dashboard-theme="agency">国税庁風</button>
                    <button type="button" data-dashboard-theme="statute">条文</button>
                  </div>
                  <button id="btnDashboardBackTitle" class="dash-ghost-btn" type="button">タイトルへ</button>
                </div>
              </header>
              <section class="dash-database">
                <div class="dash-section-title">事業進捗サマリー</div>
                <div class="dash-table">
                  <div class="dash-table-row dash-table-head"><span>項目</span><span>ステータス</span><span>優先度</span><span>オーナー</span></div>
                  <div class="dash-table-row"><span>法人税レビュー</span><span><i class="dash-tag gray" id="dashboardPhase">確認中</i></span><span>High</span><span>Finance</span></div>
                  <div class="dash-table-row"><span>KPIレビュー</span><span><i class="dash-tag blue">進行中</i></span><span>Medium</span><span>Ops</span></div>
                  <div class="dash-table-row"><span>リスク管理</span><span><i class="dash-tag amber">要確認</i></span><span>High</span><span>Legal</span></div>
                </div>
              </section>
              <section class="dash-meta-grid">
                <div><span>現在の案件</span><strong id="dashboardQuestionNo">-</strong></div>
                <div><span>進捗</span><strong id="dashboardProgress">-</strong></div>
                <div><span>表示順</span><strong id="dashboardOrderStatus">Excel順</strong></div>
                <div><span>判定</span><strong id="dashboardResultMini">未判定</strong></div>
                <div><span>レビュー待ち</span><strong id="dashboardReviewCount">0</strong></div>
              </section>
              <section class="dash-answer-block">
                <button class="dash-panel-control dash-panel-move" type="button" data-dashboard-panel="answer" title="移動">✥</button>
                <button class="dash-panel-control dash-panel-resize" type="button" data-dashboard-panel="answer" title="サイズ調整">⇔</button>
                <div class="dash-section-title">回答入力</div>
                <div id="dashboardAnswerQuestion" class="dash-answer-question">PDFを確認して回答してください。</div>
                <div id="dashboardAnswerInputs" class="dash-answer-inputs"></div>
                <div id="dashboardResult" class="dash-result hidden"></div>
                <div class="dash-actions">
                  <button id="btnDashboardSubmit" class="dash-submit" type="button">送信</button>
                  <button id="btnDashboardCompare" class="dash-ghost-btn hidden" type="button">解説を確認</button>
                  <button id="btnDashboardProceed" class="dash-ghost-btn hidden" type="button">次へ</button>
                  <button id="btnDashboardShuffle" class="dash-ghost-btn" type="button">シャッフル</button>
                  <button id="btnDashboardRestoreOrder" class="dash-ghost-btn" type="button">Excel順に戻す</button>
                  <button id="btnDashboardDummyPdf" class="dash-ghost-btn" type="button">税務PDFサンプル</button>
                </div>
              </section>
              <div id="dashboardSplitHandle" class="dash-split-handle" title="PDFと回答欄の幅を調整"></div>
              <section class="dash-pdf-block">
                <button class="dash-panel-control dash-panel-move" type="button" data-dashboard-panel="pdf" title="移動">✥</button>
                <button class="dash-panel-control dash-panel-resize" type="button" data-dashboard-panel="pdf" title="サイズ調整">⇔</button>
                <div class="dash-pdf-topline">
                  <div><div class="dash-section-title dash-pdf-title">PDFプレビュー</div><span id="dashboardPageRange">-</span></div>
                  <div class="dash-pdf-controls">
                    <button id="btnDashboardPrevPage" type="button">←</button>
                    <button id="btnDashboardNextPage" type="button">→</button>
                    <button id="btnDashboardZoomOut" type="button">−</button>
                    <span id="dashboardZoomLabel">100%</span>
                    <button id="btnDashboardZoomIn" type="button">＋</button>
                  </div>
                </div>
                <div id="dashboardPdfCanvasWrap" class="dash-pdf-canvas-wrap">
                  <figure class="dash-pdf-page"><canvas id="dashboardPageLeft"></canvas><figcaption id="dashboardPageLeftLabel"></figcaption></figure>
                  <figure class="dash-pdf-page"><canvas id="dashboardPageRight"></canvas><figcaption id="dashboardPageRightLabel"></figcaption></figure>
                  <img id="dashboardDummyPdfImage" class="dash-dummy-pdf hidden" src="assets/dashboard-tax-preview.png" alt="税務PDFサンプル">
                </div>
              </section>
            </main>
          </section>
        </div>
      </div>
    `);
  }

  function bindDocumentEvents() {
    document.getElementById('btnDocumentMode').addEventListener('click', openDocumentMode);
    document.getElementById('btnDocumentBackTitle').addEventListener('click', () => {
      showScreen('screen-title');
      initTitleScreen();
    });
    document.querySelectorAll('[data-document-preset]').forEach(button => {
      button.addEventListener('click', () => loadDocumentPreset(button.dataset.documentPreset));
    });
    document.getElementById('btnDashboardBackTitle').addEventListener('click', () => {
      showScreen('screen-title');
      initTitleScreen();
    });
    document.querySelectorAll('[data-dashboard-theme]').forEach(button => {
      button.addEventListener('click', () => setDashboardTheme(button.dataset.dashboardTheme));
    });
    document.getElementById('documentPdfFile').addEventListener('change', e => {
      docGs.pdfFile = e.target.files[0] || null;
      document.getElementById('documentPdfName').textContent = docGs.pdfFile?.name || '未選択';
      refreshDocumentSetup();
    });
    document.getElementById('documentExcelFile').addEventListener('change', e => {
      docGs.excelFile = e.target.files[0] || null;
      document.getElementById('documentExcelName').textContent = docGs.excelFile?.name || '未選択';
      refreshDocumentSetup();
    });
    document.getElementById('btnStartDocumentGame').addEventListener('click', () => showDocumentModeSelection('initial'));
    document.getElementById('documentModeSelect').addEventListener('click', e => {
      const button = e.target.closest('[data-document-mode]');
      if (!button) return;
      if (button.dataset.documentMode === 'rpg') {
        e.preventDefault();
        if (typeof window.startRpgMode === 'function') {
          window.startRpgMode();
          return;
        }
        const status = document.getElementById('documentLoadStatus');
        if (status) {
          status.textContent = 'RPGモードの読み込みに失敗しました。ページを再読み込みしてください。';
          status.className = 'document-load-status is-error';
        }
        return;
      }
      selectDocumentMode(button.dataset.documentMode);
    });
    document.getElementById('btnDocumentSubmit').addEventListener('click', submitDocumentAnswer);
    document.getElementById('documentAnswerInputs').addEventListener('keydown', e => {
      if (e.key === 'Enter' && docGs.phase === 'question') submitDocumentAnswer();
    });
    document.getElementById('documentAnswerInputs').addEventListener('click', handleDocumentQuickInput);
    document.getElementById('btnDocumentProceed').addEventListener('click', proceedDocumentGame);
    document.getElementById('btnDocumentPrevPage').addEventListener('click', () => changeDocumentSpread(-2));
    document.getElementById('btnDocumentNextPage').addEventListener('click', () => changeDocumentSpread(2));
    document.getElementById('btnDocumentZoomOut').addEventListener('click', () => changeDocumentZoom(-.15));
    document.getElementById('btnDocumentZoomIn').addEventListener('click', () => changeDocumentZoom(.15));
    document.getElementById('btnDocumentZoomReset').addEventListener('click', () => setDocumentZoom(1));
    document.getElementById('btnDocumentCompare').addEventListener('click', toggleDocumentComparison);
    document.getElementById('btnDocumentToggleProgress').addEventListener('click', toggleDocumentProgress);
    document.getElementById('btnDocumentShuffle').addEventListener('click', shuffleDocumentOrder);
    document.getElementById('btnDocumentRestoreOrder').addEventListener('click', restoreDocumentOrder);
    document.getElementById('btnDashboardSubmit').addEventListener('click', submitDocumentAnswer);
    document.getElementById('dashboardAnswerInputs').addEventListener('keydown', e => {
      if (e.key === 'Enter' && docGs.phase === 'question') submitDocumentAnswer();
    });
    document.getElementById('btnDashboardProceed').addEventListener('click', proceedDocumentGame);
    document.getElementById('btnDashboardCompare').addEventListener('click', toggleDocumentComparison);
    document.getElementById('btnDashboardPrevPage').addEventListener('click', () => changeDocumentSpread(-2));
    document.getElementById('btnDashboardNextPage').addEventListener('click', () => changeDocumentSpread(2));
    document.getElementById('btnDashboardZoomOut').addEventListener('click', () => changeDocumentZoom(-.15));
    document.getElementById('btnDashboardZoomIn').addEventListener('click', () => changeDocumentZoom(.15));
    document.getElementById('btnDashboardShuffle').addEventListener('click', shuffleDocumentOrder);
    document.getElementById('btnDashboardRestoreOrder').addEventListener('click', restoreDocumentOrder);
    document.getElementById('btnDashboardDummyPdf').addEventListener('click', showDashboardDummyPdf);
    initializeDashboardSplit();
    initializeDashboardPanelAdjustments();
    document.querySelectorAll('[data-document-calc-action]').forEach(button => {
      button.addEventListener('click', () => handleDocumentCalculator(button));
    });
    document.getElementById('documentCalcDisplay').addEventListener('keydown', handleDocumentCalculatorKeydown);
    document.getElementById('documentCalcDisplay').addEventListener('input', sanitizeDocumentCalculatorInput);
    document.getElementById('btnDocumentCalcToMemo').addEventListener('click', appendDocumentCalculatorToMemo);
    document.getElementById('btnDocumentMemoCopy').addEventListener('click', copyDocumentMemoText);
    initializeDocumentAnswerSplit();
  }

  function openDocumentMode() {
    showScreen('screen-document');
    document.getElementById('screen-document').classList.remove('is-dashboard-active');
    document.getElementById('documentSetup').classList.remove('hidden');
    document.getElementById('documentPlay').classList.add('hidden');
    document.getElementById('documentDashboard').classList.add('hidden');
  }

  async function loadRemoteScript(url, globalName) {
    if (window[globalName]) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`${globalName} の読込に失敗しました。インターネット接続を確認してください。`));
      document.head.appendChild(script);
    });
  }

  async function refreshDocumentSetup() {
    const status = document.getElementById('documentLoadStatus');
    const start = document.getElementById('btnStartDocumentGame');
    start.classList.add('hidden');
    if (!docGs.pdfFile || !docGs.excelFile) {
      status.textContent = '2ファイルを選択してください。';
      status.className = 'document-load-status';
      return;
    }
    status.textContent = 'PDFとExcelを検証しています...';
    status.className = 'document-load-status';
    try {
      const [excelBuffer, pdfBuffer] = await Promise.all([docGs.excelFile.arrayBuffer(), docGs.pdfFile.arrayBuffer()]);
      await loadDocumentBuffers({ excelBuffer, pdfBuffer });
      status.textContent = `${docGs.questions.length}問を読み込みました。PDFは${docGs.pdf.numPages}ページです。`;
      status.className = 'document-load-status is-ready';
      start.classList.remove('hidden');
    } catch (error) {
      status.textContent = error.message;
      status.className = 'document-load-status is-error';
    }
  }

  async function loadDocumentPreset(id) {
    const preset = DOCUMENT_PRESETS.find(item => item.id === id);
    if (!preset) return;
    const status = document.getElementById('documentLoadStatus');
    const start = document.getElementById('btnStartDocumentGame');
    if (start) start.classList.add('hidden');
    status.textContent = `${preset.label}を読み込んでいます...`;
    status.className = 'document-load-status';
    try {
      const [pdfBuffer, excelBuffer] = await Promise.all([
        fetchPresetBuffer(preset.pdf),
        fetchPresetBuffer(preset.excel),
      ]);
      await loadDocumentBuffers({ excelBuffer, pdfBuffer });
      docGs.pdfFile = null;
      docGs.excelFile = null;
      document.getElementById('documentPdfName').textContent = preset.pdf.split('/').pop();
      document.getElementById('documentExcelName').textContent = preset.excel.split('/').pop();
      status.textContent = `${preset.label}: ${docGs.questions.length}問を読み込みました。PDFは${docGs.pdf.numPages}ページです。`;
      status.className = 'document-load-status is-ready';
      showDocumentModeSelection('initial');
    } catch (error) {
      status.textContent = `プリセット読込に失敗しました。${window.location.protocol === 'file:' ? 'プリセットはローカルサーバーから開いた時に使えます。' : error.message}`;
      status.className = 'document-load-status is-error';
    }
  }

  async function fetchPresetBuffer(path) {
    const response = await fetch(new URL(path, window.location.href).href);
    if (!response.ok) throw new Error(`${path} を読み込めませんでした。`);
    return await response.arrayBuffer();
  }

  async function loadDocumentBuffers({ excelBuffer, pdfBuffer }) {
    await loadDocumentDependencies();
    docGs.sourceQuestions = await parseDocumentWorkbook(excelBuffer);
    docGs.questions = [...docGs.sourceQuestions];
    docGs.orderMode = 'excel';
    docGs.pdf = await window.pdfjsLib.getDocument({ data: pdfBuffer }).promise;
    validatePdfPages(docGs.questions, docGs.pdf.numPages);
    window._rpgDocData = { questions: docGs.sourceQuestions, pdf: docGs.pdf };
  }

  async function loadDocumentDependencies() {
    if (!window.pdfjsLib) {
      try {
        window.pdfjsLib = await import(new URL(LOCAL_PDFJS_URL, window.location.href).href);
      } catch (error) {
        await loadRemoteScript(PDFJS_URL, 'pdfjsLib');
      }
    }
    const localWorker = new URL(LOCAL_PDFJS_WORKER_URL, window.location.href).href;
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = window.pdfjsLib.GlobalWorkerOptions.workerSrc || (window.location.protocol === 'file:' ? PDFJS_WORKER_URL : localWorker);
  }

  function normalizeHeader(value) {
    return String(value ?? '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();
  }

  function getSheet(workbook, preferredNames) {
    const match = workbook.SheetNames.find(name => preferredNames.includes(normalizeHeader(name)));
    if (!match) throw new Error(`Excelに「${preferredNames[0]}」シートがありません。`);
    return workbook.Sheets[match];
  }

  function rowsToObjects(sheet) {
    const rows = Array.isArray(sheet)
      ? sheet
      : window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!rows.length) return [];
    const headers = rows[0].map(normalizeHeader);
    return rows.slice(1).filter(row => row.some(cell => String(cell).trim())).map(row => {
      const result = {};
      headers.forEach((header, index) => { result[header] = row[index]; });
      return result;
    });
  }

  function readCell(row, names, required = false) {
    const key = names.map(normalizeHeader).find(name => row[name] !== undefined && String(row[name]).trim() !== '');
    if (key) return row[key];
    if (required) throw new Error(`Excelの必須列「${names[0]}」が不足しています。`);
    return '';
  }

  function readPage(row, names, required = false) {
    const raw = readCell(row, names, required);
    if (raw === '' && !required) return null;
    const page = Number(raw);
    if (!Number.isInteger(page) || page < 1) throw new Error(`ページ番号「${raw}」は1以上の整数で入力してください。`);
    return page;
  }

  async function parseDocumentWorkbook(buffer) {
    const workbook = window.XLSX
      ? window.XLSX.read(buffer, { type: 'array' })
      : await readLightweightXlsx(buffer);
    const answerRows = rowsToObjects(getSheet(workbook, ['問題']));
    const pageRows = rowsToObjects(getSheet(workbook, ['ページ情報']));
    if (!answerRows.length || !pageRows.length) throw new Error('Excelのデータ行が不足しています。');

    const pageByNo = new Map();
    pageRows.forEach(row => {
      const questionNo = String(readCell(row, ['問題番号'], true)).trim();
      if (pageByNo.has(questionNo)) throw new Error(`ページ情報の問題番号「${questionNo}」が重複しています。`);
      const questionStart = readPage(row, ['PDF内問題開始ページ', '問題開始ページ'], true);
      const questionEnd = readPage(row, ['PDF内問題終了ページ', '問題終了ページ'], true);
      const answerPage = readPage(row, ['PDF内解答開始ページ', '解答ページ', '答えページ'], true);
      const answerEnd = readPage(row, ['PDF内解答終了ページ', '解答終了ページ'], false) || answerPage + 1;
      const printedQuestionStart = readPage(row, ['書籍印刷問題開始ページ', '印刷問題開始'], false);
      const printedQuestionEnd = readPage(row, ['書籍印刷問題終了ページ', '印刷問題終了'], false);
      const printedAnswerStart = readPage(row, ['書籍印刷解答開始ページ', '印刷解答開始'], false);
      const printedAnswerEnd = readPage(row, ['書籍印刷解答終了ページ', '印刷解答終了'], false);
      if (questionEnd < questionStart) throw new Error(`問題番号「${questionNo}」の問題終了ページが開始ページより前です。`);
      if (answerEnd < answerPage) {
        throw new Error(`ページ情報シートの${questionNo}で解答終了ページが解答ページより前です。`);
      }

      pageByNo.set(questionNo, {
        questionStart,
        questionEnd,
        answerPage,
        answerEnd,
        printedQuestionStart,
        printedQuestionEnd,
        printedAnswerStart,
        printedAnswerEnd,
      });
    });

    const seen = new Set();
    return answerRows.map(row => {
      const questionNo = String(readCell(row, ['問題番号'], true)).trim();
      if (seen.has(questionNo)) throw new Error(`問題シートの問題番号「${questionNo}」が重複しています。`);
      seen.add(questionNo);
      const page = pageByNo.get(questionNo);
      if (!page) throw new Error(`問題番号「${questionNo}」のページ情報がありません。`);
      const subQuestions = [];
      for (let index = 1; index <= 25; index++) {
        const range = String(readCell(row, [`${index}問目の回答範囲`, `小問${index}回答範囲`])).trim();
        const answer = String(readCell(row, [`${index}問目の正解`, `小問${index}正解`])).trim();
        if (!range && !answer) continue;
        if (!answer) throw new Error(`問題番号「${questionNo}」の${index}問目の正解がありません。`);
        subQuestions.push({
          range: range || `${index}問目`,
          answers: answer.split(/[|\n]/).map(v => v.trim()).filter(Boolean),
        });
      }
      if (!subQuestions.length) {
        const answer = String(readCell(row, ['正解'], true)).trim();
        const alternatives = String(readCell(row, ['別解', '正解候補'])).split(/[|\n]/).map(v => v.trim()).filter(Boolean);
        subQuestions.push({ range: '解答', answers: [answer, ...alternatives] });
      }
      return { questionNo, subQuestions, ...page };
    });
  }

  async function readLightweightXlsx(buffer) {
    const files = await unzipXlsxEntries(buffer);
    const parser = new DOMParser();
    const xml = name => {
      const text = files.get(name);
      if (!text) throw new Error(`Excel内部ファイル「${name}」が見つかりません。`);
      return parser.parseFromString(text, 'application/xml');
    };
    const sharedStrings = [];
    if (files.has('xl/sharedStrings.xml')) {
      Array.from(xml('xl/sharedStrings.xml').getElementsByTagName('si')).forEach(si => {
        sharedStrings.push(Array.from(si.getElementsByTagName('t')).map(t => t.textContent || '').join(''));
      });
    }
    const relDoc = xml('xl/_rels/workbook.xml.rels');
    const rels = new Map(Array.from(relDoc.getElementsByTagName('Relationship')).map(rel => [
      rel.getAttribute('Id'),
      normalizeXlsxPath(resolveXlsxTarget('xl', rel.getAttribute('Target'))),
    ]));
    const workbookDoc = xml('xl/workbook.xml');
    const sheets = Array.from(workbookDoc.getElementsByTagName('sheet'));
    const workbook = { SheetNames: [], Sheets: {} };
    sheets.forEach(sheet => {
      const name = sheet.getAttribute('name');
      const rid = sheet.getAttribute('r:id') || sheet.getAttribute('id');
      const target = rels.get(rid);
      if (!name || !target || !files.has(target)) return;
      workbook.SheetNames.push(name);
      workbook.Sheets[name] = parseWorksheetRows(files.get(target), sharedStrings);
    });
    return workbook;
  }

  function normalizeXlsxPath(path) {
    const parts = [];
    path.replace(/\\/g, '/').split('/').forEach(part => {
      if (!part || part === '.') return;
      if (part === '..') parts.pop();
      else parts.push(part);
    });
    return parts.join('/');
  }

  function resolveXlsxTarget(base, target) {
    if (!target) return base;
    return target.startsWith('/') ? target.slice(1) : `${base}/${target}`;
  }

  function parseWorksheetRows(text, sharedStrings) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    const rows = [];
    Array.from(doc.getElementsByTagName('row')).forEach(row => {
      const rowIndex = Math.max(0, Number(row.getAttribute('r') || rows.length + 1) - 1);
      const out = rows[rowIndex] || [];
      Array.from(row.getElementsByTagName('c')).forEach(cell => {
        const ref = cell.getAttribute('r') || '';
        const colIndex = xlsxColumnIndex(ref.replace(/\d+/g, '')) || out.length;
        out[colIndex] = readXlsxCell(cell, sharedStrings);
      });
      rows[rowIndex] = out;
    });
    return rows.filter(row => row && row.some(cell => String(cell ?? '').trim() !== ''));
  }

  function xlsxColumnIndex(col) {
    let n = 0;
    for (const ch of col.toUpperCase()) {
      if (ch < 'A' || ch > 'Z') continue;
      n = n * 26 + (ch.charCodeAt(0) - 64);
    }
    return Math.max(0, n - 1);
  }

  function readXlsxCell(cell, sharedStrings) {
    const type = cell.getAttribute('t');
    if (type === 'inlineStr') {
      return Array.from(cell.getElementsByTagName('t')).map(t => t.textContent || '').join('');
    }
    const v = cell.getElementsByTagName('v')[0]?.textContent ?? '';
    if (type === 's') return sharedStrings[Number(v)] ?? '';
    if (type === 'b') return v === '1';
    return v;
  }

  async function unzipXlsxEntries(buffer) {
    const view = new DataView(buffer);
    let eocd = -1;
    for (let i = view.byteLength - 22; i >= Math.max(0, view.byteLength - 66000); i--) {
      if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('ExcelファイルのZIP構造を読み取れませんでした。');
    const entryCount = view.getUint16(eocd + 10, true);
    let ptr = view.getUint32(eocd + 16, true);
    const decoder = new TextDecoder('utf-8');
    const files = new Map();
    for (let i = 0; i < entryCount; i++) {
      if (view.getUint32(ptr, true) !== 0x02014b50) throw new Error('Excelファイルの中央ディレクトリが壊れています。');
      const method = view.getUint16(ptr + 10, true);
      const compressedSize = view.getUint32(ptr + 20, true);
      const fileNameLength = view.getUint16(ptr + 28, true);
      const extraLength = view.getUint16(ptr + 30, true);
      const commentLength = view.getUint16(ptr + 32, true);
      const localOffset = view.getUint32(ptr + 42, true);
      const name = decoder.decode(new Uint8Array(buffer, ptr + 46, fileNameLength));
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.slice(dataStart, dataStart + compressedSize);
      if (!name.endsWith('/')) {
        files.set(normalizeXlsxPath(name), decoder.decode(await inflateZipEntry(compressed, method)));
      }
      ptr += 46 + fileNameLength + extraLength + commentLength;
    }
    return files;
  }

  async function inflateZipEntry(buffer, method) {
    if (method === 0) return buffer;
    if (method !== 8) throw new Error(`Excel内部ZIPの圧縮形式 ${method} は未対応です。`);
    if (!('DecompressionStream' in window)) {
      throw new Error('このブラウザではExcelのローカル解析に必要な展開APIが使えません。');
    }
    const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return await new Response(stream).arrayBuffer();
  }

  function validatePdfPages(items, maxPage) {
    items.forEach(item => {
      for (const page of [item.questionStart, item.questionEnd, item.answerPage, item.answerEnd]) {
        if (page > maxPage) throw new Error(`問題番号「${item.questionNo}」のページ${page}がPDFの総ページ数を超えています。`);
      }
    });
  }

  function startDocumentGame() {
    startDungeonBgm();
    updateComboAtmosphere(0);
    if (!docGs.questions.length && docGs.sourceQuestions.length) {
      docGs.questions = [...docGs.sourceQuestions];
      docGs.orderMode = 'excel';
    }
    docGs.currentIndex = 0;
    docGs.combo = 0;
    docGs.missCount = 0;
    docGs.missStreak = 0;
    docGs.score = 0;
    docGs.reviewCount = 0;
    docGs.phase = 'question';
    docGs.returnToStartAfterAnswer = false;
    docGs.returnReason = '';
    docGs.answerView = 'answer';
    docGs.zoom = getInitialDocumentZoom();
    updateDocumentZoomLabels();
    setDashboardTheme(docGs.dashboardTheme || 'accounting');
    records.playCount++;
    saveRecords();
    document.getElementById('documentSetup').classList.add('hidden');
    document.getElementById('screen-document').classList.toggle('is-dashboard-active', isDashboardMode());
    document.getElementById('documentPlay').classList.toggle('hidden', isDashboardMode());
    document.getElementById('documentDashboard').classList.toggle('hidden', !isDashboardMode());
    renderDocumentQuestion();
  }

  function showDocumentModeSelection(reason = 'initial') {
    docGs.pendingModeReason = reason;
    const selector = document.getElementById('documentModeSelect');
    const setup = document.getElementById('documentSetup');
    const play = document.getElementById('documentPlay');
    const dashboard = document.getElementById('documentDashboard');
    setup.classList.add('hidden');
    play.classList.add('hidden');
    dashboard.classList.add('hidden');
    document.getElementById('screen-document').classList.remove('is-dashboard-active');
    selector.classList.remove('hidden');
    document.getElementById('documentModeSelectTitle').textContent = reason === 'return'
      ? '第1問からの攻略方法を選択'
      : '攻略方法を選択';
    document.getElementById('documentModeSelectMessage').textContent = reason === 'return'
      ? '問題順はそのままです。挑戦を続けるか、インプットへ切り替えられます。'
      : 'アップロードした問題をどのルールで進めるか選んでください。';
  }

  function selectDocumentMode(mode) {
    if (!['challenge', 'input-normal', 'input-easy', 'dashboard'].includes(mode)) return;
    const wasReturn = docGs.pendingModeReason === 'return';
    docGs.playMode = mode;
    document.getElementById('documentModeSelect').classList.add('hidden');
    document.getElementById('screen-document').classList.toggle('is-dashboard-active', isDashboardMode());
    document.getElementById('documentPlay').classList.toggle('hidden', isDashboardMode());
    document.getElementById('documentDashboard').classList.toggle('hidden', !isDashboardMode());
    if (wasReturn) {
      docGs.currentIndex = 0;
      docGs.missCount = 0;
      docGs.missStreak = 0;
      docGs.combo = 0;
      docGs.returnToStartAfterAnswer = false;
      docGs.returnReason = '';
      docGs.phase = 'question';
      docGs.answerView = 'answer';
      updateComboAtmosphere(0);
      renderDocumentQuestion();
    } else {
      startDocumentGame();
    }
  }

  function isDocumentInputMode() {
    return docGs.playMode === 'input-normal' || docGs.playMode === 'input-easy';
  }

  function isDashboardMode() {
    return docGs.playMode === 'dashboard';
  }

  function setDashboardTheme(theme) {
    const allowed = ['accounting', 'agency', 'statute'];
    docGs.dashboardTheme = allowed.includes(theme) ? theme : 'accounting';
    const dashboard = document.getElementById('documentDashboard');
    if (dashboard) {
      dashboard.classList.remove('dash-theme-accounting', 'dash-theme-agency', 'dash-theme-statute');
      dashboard.classList.add(`dash-theme-${docGs.dashboardTheme}`);
      applyDashboardSplitLayout(docGs.dashboardTheme);
    }
    resetDashboardPdfPreview();
    renderDashboardThemeSummary();
    document.querySelectorAll('[data-dashboard-theme]').forEach(button => {
      button.classList.toggle('is-active', button.dataset.dashboardTheme === docGs.dashboardTheme);
    });
    if (isDashboardMode() && docGs.pdf && docGs.questions[docGs.currentIndex]) {
      renderDashboardQuestion(
        docGs.questions[docGs.currentIndex],
        docGs.phase === 'answer',
        docGs.phase === 'answer' && docGs.answerView === 'question'
      );
    }
  }

  function resetDashboardPdfPreview() {
    const image = document.getElementById('dashboardDummyPdfImage');
    if (image) image.classList.add('hidden');
    document.querySelectorAll('.dash-pdf-page').forEach(page => page.classList.remove('hidden'));
  }

  function renderDashboardThemeSummary() {
    const database = document.querySelector('#documentDashboard .dash-database');
    if (!database) return;
    const summaries = {
      accounting: {
        breadcrumb: '業務管理 / 税務レビュー / 実行管理',
        pageTitle: 'ダッシュモード',
        answerTitle: '回答入力',
        pdfTitle: 'PDFプレビュー',
        title: '事業進捗サマリー',
        head: ['項目', 'ステータス', '優先度', 'オーナー'],
        rows: [
          ['法人税レビュー', '<i class="dash-tag gray" id="dashboardPhase">確認中</i>', 'High', 'Finance'],
          ['KPIレビュー', '<i class="dash-tag blue">進行中</i>', 'Medium', 'Ops'],
          ['リスク管理', '<i class="dash-tag amber">要確認</i>', 'High', 'Legal'],
        ],
      },
      agency: {
        breadcrumb: '税務情報ガイド / 申告・納付 / 確認フロー',
        pageTitle: '税務情報ダッシュボード',
        answerTitle: '回答・確認欄',
        pdfTitle: '添付PDF確認',
        title: '制度確認サマリー',
        head: ['ガイド項目', 'ステータス', '区分', '担当'],
        rows: [
          ['申告・納付の概要', '<i class="dash-tag gray" id="dashboardPhase">確認中</i>', '基本情報', 'Tax'],
          ['よくある質問', '<i class="dash-tag blue">参照中</i>', 'FAQ', 'Review'],
          ['添付資料チェック', '<i class="dash-tag amber">要確認</i>', '証憑', 'Ops'],
        ],
      },
      statute: {
        breadcrumb: '条文レビュー / 法人税法関係通達 / 適用判断',
        pageTitle: '条文レビュー画面',
        answerTitle: '条文適用メモ',
        pdfTitle: '参照PDF',
        title: '条文確認サマリー',
        head: ['参照箇所', 'ステータス', '論点', 'メモ'],
        rows: [
          ['第1条 適用範囲', '<i class="dash-tag gray" id="dashboardPhase">確認中</i>', '課税所得', '条文照合'],
          ['第2条 損金算入', '<i class="dash-tag blue">精査中</i>', '損金算入', '要件確認'],
          ['通達 注記事項', '<i class="dash-tag amber">要確認</i>', '例外処理', '保留'],
        ],
      },
    };
    const summary = summaries[docGs.dashboardTheme] || summaries.accounting;
    const breadcrumb = document.querySelector('#documentDashboard .dash-breadcrumb');
    if (breadcrumb) breadcrumb.textContent = summary.breadcrumb;
    const title = document.querySelector('#documentDashboard .dash-page-title');
    if (title) title.textContent = summary.pageTitle;
    const answerTitle = document.querySelector('#documentDashboard .dash-answer-block .dash-section-title');
    if (answerTitle) answerTitle.textContent = summary.answerTitle;
    const pdfTitle = document.querySelector('#documentDashboard .dash-pdf-title');
    if (pdfTitle) pdfTitle.textContent = summary.pdfTitle;
    database.innerHTML = `
      <div class="dash-section-title">${summary.title}</div>
      <div class="dash-table">
        <div class="dash-table-row dash-table-head">${summary.head.map(value => `<span>${value}</span>`).join('')}</div>
        ${summary.rows.map(row => `<div class="dash-table-row">${row.map(value => `<span>${value}</span>`).join('')}</div>`).join('')}
      </div>
    `;
  }

  const DASHBOARD_SPLIT_LAYOUTS = {
    accounting: { left: 30.5, top: 52.0, right: 88.0, height: 24.5, split: 69.0, minPdf: 28, minAnswer: 12 },
    agency: { left: 17.5, top: 64.8, right: 69.3, height: 31.9, split: 50.2, minPdf: 24, minAnswer: 14 },
    statute: { left: 1.45, top: 66.5, right: 78.5, height: 29.0, split: 58.0, minPdf: 34, minAnswer: 12 },
  };

  const dashboardSplitState = {};
  const dashboardPanelState = {};

  function getDashboardSplitLayout(theme = docGs.dashboardTheme) {
    const base = DASHBOARD_SPLIT_LAYOUTS[theme] || DASHBOARD_SPLIT_LAYOUTS.accounting;
    const split = dashboardSplitState[theme] ?? base.split;
    const clamped = Math.min(base.right - base.minAnswer, Math.max(base.left + base.minPdf, split));
    return { ...base, split: clamped };
  }

  function applyDashboardSplitLayout(theme = docGs.dashboardTheme) {
    const dashboard = document.getElementById('documentDashboard');
    if (!dashboard) return;
    const layout = getDashboardSplitLayout(theme);
    const gap = 0.8;
    const pdfLayout = {
      left: layout.left,
      top: layout.top,
      width: Math.max(layout.minPdf, layout.split - layout.left - gap / 2),
      height: layout.height,
    };
    const answerLayout = {
      left: layout.split + gap / 2,
      top: layout.top,
      width: Math.max(layout.minAnswer, layout.right - (layout.split + gap / 2)),
      height: layout.height,
    };
    const custom = dashboardPanelState[theme] || {};
    const pdf = { ...pdfLayout, ...(custom.pdf || {}) };
    const answer = { ...answerLayout, ...(custom.answer || {}) };
    dashboard.style.setProperty('--dash-live-left', `${layout.left}%`);
    dashboard.style.setProperty('--dash-live-top', `${layout.top}%`);
    dashboard.style.setProperty('--dash-live-height', `${layout.height}%`);
    dashboard.style.setProperty('--dash-live-pdf-left', `${pdf.left}%`);
    dashboard.style.setProperty('--dash-live-pdf-top', `${pdf.top}%`);
    dashboard.style.setProperty('--dash-live-pdf-width', `${pdf.width}%`);
    dashboard.style.setProperty('--dash-live-pdf-height', `${pdf.height}%`);
    dashboard.style.setProperty('--dash-live-answer-left', `${answer.left}%`);
    dashboard.style.setProperty('--dash-live-answer-top', `${answer.top}%`);
    dashboard.style.setProperty('--dash-live-answer-width', `${answer.width}%`);
    dashboard.style.setProperty('--dash-live-answer-height', `${answer.height}%`);
    dashboard.style.setProperty('--dash-live-split-left', `${layout.split}%`);
  }

  function initializeDashboardSplit() {
    const handle = document.getElementById('dashboardSplitHandle');
    const dashboard = document.getElementById('documentDashboard');
    if (!handle || !dashboard) return;

    const move = event => {
      const rect = dashboard.getBoundingClientRect();
      const theme = docGs.dashboardTheme || 'accounting';
      const base = DASHBOARD_SPLIT_LAYOUTS[theme] || DASHBOARD_SPLIT_LAYOUTS.accounting;
      const percent = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 100;
      dashboardSplitState[theme] = Math.min(base.right - base.minAnswer, Math.max(base.left + base.minPdf, percent));
      applyDashboardSplitLayout(theme);
    };
    const stop = event => {
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', stop);
      handle.removeEventListener('pointercancel', stop);
      document.body.classList.remove('is-dashboard-splitting');
    };
    handle.addEventListener('pointerdown', event => {
      if (!isDashboardMode()) return;
      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
      document.body.classList.add('is-dashboard-splitting');
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', stop);
      handle.addEventListener('pointercancel', stop);
    });
  }

  function getDashboardPanelRect(panelName) {
    const theme = docGs.dashboardTheme || 'accounting';
    const layout = getDashboardSplitLayout(theme);
    const gap = 0.8;
    const defaults = panelName === 'pdf'
      ? {
          left: layout.left,
          top: layout.top,
          width: Math.max(layout.minPdf, layout.split - layout.left - gap / 2),
          height: layout.height,
        }
      : {
          left: layout.split + gap / 2,
          top: layout.top,
          width: Math.max(layout.minAnswer, layout.right - (layout.split + gap / 2)),
          height: layout.height,
        };
    return { ...defaults, ...((dashboardPanelState[theme] || {})[panelName] || {}) };
  }

  function setDashboardPanelRect(panelName, rect) {
    const theme = docGs.dashboardTheme || 'accounting';
    const minWidth = panelName === 'pdf' ? 16 : 10;
    const minHeight = panelName === 'pdf' ? 12 : 10;
    const next = {
      left: Math.min(96 - minWidth, Math.max(0, rect.left)),
      top: Math.min(96 - minHeight, Math.max(3, rect.top)),
      width: Math.min(96, Math.max(minWidth, rect.width)),
      height: Math.min(90, Math.max(minHeight, rect.height)),
    };
    next.left = Math.min(next.left, 98 - next.width);
    next.top = Math.min(next.top, 98 - next.height);
    dashboardPanelState[theme] = dashboardPanelState[theme] || {};
    dashboardPanelState[theme][panelName] = next;
    applyDashboardSplitLayout(theme);
  }

  function initializeDashboardPanelAdjustments() {
    const dashboard = document.getElementById('documentDashboard');
    if (!dashboard) return;

    document.querySelectorAll('.dash-panel-control').forEach(handle => {
      const mode = handle.classList.contains('dash-panel-resize') ? 'resize' : 'move';
      const panelName = handle.dataset.dashboardPanel;
      if (!panelName) return;

      handle.addEventListener('pointerdown', event => {
        if (!isDashboardMode()) return;
        event.preventDefault();
        event.stopPropagation();

        const start = getDashboardPanelRect(panelName);
        const bounds = dashboard.getBoundingClientRect();
        const startX = event.clientX;
        const startY = event.clientY;

        const move = moveEvent => {
          const dx = ((moveEvent.clientX - startX) / Math.max(1, bounds.width)) * 100;
          const dy = ((moveEvent.clientY - startY) / Math.max(1, bounds.height)) * 100;
          if (mode === 'move') {
            setDashboardPanelRect(panelName, {
              ...start,
              left: start.left + dx,
              top: start.top + dy,
            });
          } else {
            setDashboardPanelRect(panelName, {
              ...start,
              width: start.width + dx,
              height: start.height + dy,
            });
          }
        };

        const stop = stopEvent => {
          if (handle.hasPointerCapture(stopEvent.pointerId)) handle.releasePointerCapture(stopEvent.pointerId);
          handle.removeEventListener('pointermove', move);
          handle.removeEventListener('pointerup', stop);
          handle.removeEventListener('pointercancel', stop);
          document.body.classList.remove('is-dashboard-panel-adjusting');
        };

        handle.setPointerCapture(event.pointerId);
        document.body.classList.add('is-dashboard-panel-adjusting');
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', stop);
        handle.addEventListener('pointercancel', stop);
      });
    });
  }

  function getDocumentModeLabel() {
    if (docGs.playMode === 'dashboard') return 'ダッシュモード';
    if (docGs.playMode === 'input-easy') return 'インプット・簡単';
    if (docGs.playMode === 'input-normal') return 'インプット・普通';
    return '挑戦';
  }

  function scheduleDocumentReview(item) {
    const reviewItem = { ...item, subQuestions: item.subQuestions.map(sub => ({ ...sub, answers: [...sub.answers] })), isReview: true };
    const insertAt = Math.min(docGs.questions.length, docGs.currentIndex + 4);
    docGs.questions.splice(insertAt, 0, reviewItem);
    docGs.reviewCount++;
  }

  function resetDocumentRunState() {
    updateComboAtmosphere(0);
    docGs.currentIndex = 0;
    docGs.combo = 0;
    docGs.missCount = 0;
    docGs.missStreak = 0;
    docGs.score = 0;
    docGs.phase = 'question';
    docGs.answerWasCorrect = false;
    docGs.answerResults = [];
    docGs.returnToStartAfterAnswer = false;
    docGs.returnReason = '';
    docGs.answerView = 'answer';
    docGs.zoom = getInitialDocumentZoom();
    updateDocumentZoomLabels();
  }

  function shuffleDocumentOrder() {
    if (!docGs.sourceQuestions.length || docGs.phase === 'answer') return;
    const shuffled = [...docGs.sourceQuestions];
    for (let index = shuffled.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    docGs.questions = shuffled;
    docGs.orderMode = 'shuffle';
    resetDocumentRunState();
    renderDocumentQuestion();
  }

  function restoreDocumentOrder() {
    if (!docGs.sourceQuestions.length || docGs.phase === 'answer') return;
    docGs.questions = [...docGs.sourceQuestions];
    docGs.orderMode = 'excel';
    resetDocumentRunState();
    renderDocumentQuestion();
  }

  function renderDocumentQuestion() {
    const item = docGs.questions[docGs.currentIndex];
    const isAnswer = docGs.phase === 'answer';
    const isComparingQuestion = isAnswer && docGs.answerView === 'question';
    if (isDashboardMode()) {
      docGs.spreadMin = isAnswer && !isComparingQuestion ? item.answerPage : item.questionStart;
      docGs.spreadMax = isAnswer && !isComparingQuestion ? Math.min(docGs.pdf.numPages, item.answerEnd || item.answerPage + 1) : item.questionEnd;
    } else if (isAnswer) {
      docGs.spreadMin = item.answerPage;
      docGs.spreadMax = Math.min(docGs.pdf.numPages, item.answerEnd || item.answerPage + 1);
    } else {
      docGs.spreadMin = item.questionStart;
      docGs.spreadMax = item.questionEnd;
    }
    docGs.spreadStart = docGs.spreadMin;

    if (isDashboardMode()) {
      renderDashboardQuestion(item, isAnswer, isComparingQuestion);
      return;
    }

    document.getElementById('documentFloor').textContent = `${docGs.currentIndex + 1}F`;
    document.getElementById('documentQuestionNo').textContent = item.questionNo;
    document.getElementById('documentModeStatus').textContent = getDocumentModeLabel();
    document.getElementById('documentReviewCount').textContent = docGs.reviewCount;
    document.getElementById('documentOrderStatus').textContent = docGs.orderMode === 'shuffle' ? 'シャッフル中' : 'Excel順';
    document.getElementById('btnDocumentShuffle').disabled = isAnswer;
    document.getElementById('btnDocumentRestoreOrder').disabled = isAnswer || docGs.orderMode !== 'shuffle';
    document.getElementById('documentCombo').textContent = docGs.combo;
    document.getElementById('documentMiss').textContent = `${docGs.missCount}/4`;
    document.getElementById('documentMissStreak').textContent = `${docGs.missStreak}/3`;
    document.getElementById('documentProgressFill').style.width = `${Math.round((docGs.currentIndex / Math.max(1, docGs.questions.length)) * 100)}%`;
    document.getElementById('documentPhase').textContent = isAnswer
      ? (isComparingQuestion ? '問題ページを確認中' : '解答・解説ページ')
      : (item.isReview ? '復習問題' : '問題ページ');
    document.getElementById('documentPhase').className = `document-phase ${isAnswer ? 'is-answer' : ''}`;

    const inputs = document.getElementById('documentAnswerInputs');
    const submit = document.getElementById('btnDocumentSubmit');
    const result = document.getElementById('documentResult');
    const compare = document.getElementById('btnDocumentCompare');
    const proceed = document.getElementById('btnDocumentProceed');
    if (!isAnswer) {
      docGs.answerResults = [];
      renderDocumentAnswerInputs(item, false);
      submit.classList.remove('hidden');
      result.classList.add('hidden');
      compare.classList.add('hidden');
      proceed.classList.add('hidden');
      document.getElementById('documentAnswerQuestion').textContent = `${item.isReview ? '復習: ' : ''}第${item.questionNo}問: PDFを確認して解答してください。`;
    } else {
      renderDocumentAnswerInputs(item, true, docGs.answerResults);
      submit.classList.add('hidden');
      result.classList.remove('hidden');
      result.className = `document-result ${docGs.answerWasCorrect ? 'is-correct' : 'is-wrong'}`;
      const answers = item.subQuestions.map(subQuestion =>
        `${escapeHtml(subQuestion.range)}: ${escapeHtml(subQuestion.answers.join(' / '))}`
      ).join('<br>');
      result.innerHTML = `<strong>${docGs.answerWasCorrect ? '正解' : '不正解'}</strong><span>${answers}</span><small>${escapeHtml(getDocumentFailureStatusText())}</small>`;
      compare.textContent = isComparingQuestion ? '解説ページに戻る' : '問題ページと見比べる';
      const answerDetails = (docGs.answerResults.length ? docGs.answerResults : item.subQuestions.map(subQuestion => ({
        range: subQuestion.range,
        submitted: '',
        answers: subQuestion.answers,
        isCorrect: false,
      }))).map((answerResult, index) => `
        <div class="document-result-detail ${answerResult.isCorrect ? 'is-correct' : 'is-wrong'}">
          <b>${escapeHtml(answerResult.range || `第${index + 1}問`)}</b>
          <em>${answerResult.isCorrect ? '正解' : '不正解'}</em>
          <span>入力: ${escapeHtml(answerResult.submitted || '-')}</span>
          <span>正解: ${escapeHtml(answerResult.answers.join(' / '))}</span>
        </div>
      `).join('');
      result.innerHTML = `<strong>${docGs.answerWasCorrect ? '正解' : '不正解'}</strong><div class="document-result-details">${answerDetails}</div><small>${escapeHtml(getDocumentFailureStatusText())}</small>`;
      compare.classList.add('hidden');
      proceed.textContent = getDocumentProceedText();
      proceed.classList.remove('hidden');
    }
    const easyReference = document.getElementById('documentEasyReference');
    const showEasyReference = docGs.playMode === 'input-easy' && !isAnswer;
    easyReference.classList.toggle('hidden', !showEasyReference);
    renderDocumentSpread(true);
    if (showEasyReference) renderDocumentEasyReference(item);
  }

  async function renderDocumentEasyReference(item) {
    const serial = renderSerial;
    const left = item.answerPage;
    const right = left + 1 <= (item.answerEnd || left) ? left + 1 : null;
    await Promise.all([
      renderPdfPage('documentEasyPageLeft', 'documentEasyPageLeftLabel', left, serial, 'answer'),
      renderPdfPage('documentEasyPageRight', 'documentEasyPageRightLabel', right, serial, 'answer'),
    ]);
  }

  function renderDashboardQuestion(item, isAnswer, isComparingQuestion) {
    resetDashboardPdfPreview();
    document.getElementById('dashboardQuestionNo').textContent = `案件 ${item.questionNo}`;
    document.getElementById('dashboardProgress').textContent = `${docGs.currentIndex + 1} / ${docGs.questions.length}`;
    document.getElementById('dashboardOrderStatus').textContent = docGs.orderMode === 'shuffle' ? 'シャッフル中' : 'Excel順';
    document.getElementById('dashboardReviewCount').textContent = docGs.reviewCount;
    document.getElementById('btnDashboardShuffle').disabled = isAnswer;
    document.getElementById('btnDashboardRestoreOrder').disabled = isAnswer || docGs.orderMode !== 'shuffle';
    document.getElementById('dashboardPhase').textContent = isAnswer
      ? (isComparingQuestion ? '問題確認' : 'レビュー待ち')
      : '確認中';
    document.getElementById('dashboardResultMini').textContent = isAnswer
      ? (docGs.answerWasCorrect ? '完了' : '要確認')
      : '未判定';
    document.getElementById('dashboardResultMini').className = isAnswer
      ? (docGs.answerWasCorrect ? 'is-ok' : 'is-ng')
      : '';

    const submit = document.getElementById('btnDashboardSubmit');
    const result = document.getElementById('dashboardResult');
    const compare = document.getElementById('btnDashboardCompare');
    const proceed = document.getElementById('btnDashboardProceed');

    if (!isAnswer) {
      docGs.answerResults = [];
      renderDocumentAnswerInputs(item, false);
      submit.classList.remove('hidden');
      result.classList.add('hidden');
      compare.classList.add('hidden');
      proceed.classList.add('hidden');
      document.getElementById('dashboardAnswerQuestion').textContent = `案件 ${item.questionNo}: PDFを確認して必要事項を入力してください。`;
    } else {
      renderDocumentAnswerInputs(item, true, docGs.answerResults);
      submit.classList.add('hidden');
      result.classList.remove('hidden');
      result.className = `dash-result ${docGs.answerWasCorrect ? 'is-correct' : 'is-wrong'}`;
      const answerDetails = (docGs.answerResults.length ? docGs.answerResults : item.subQuestions.map(subQuestion => ({
        range: subQuestion.range,
        submitted: '',
        answers: subQuestion.answers,
        isCorrect: false,
      }))).map(answerResult => `
        <div class="dash-result-line ${answerResult.isCorrect ? 'is-correct' : 'is-wrong'}">
          <span>${escapeHtml(answerResult.range)}</span>
          <strong>${answerResult.isCorrect ? '完了' : '要確認'}</strong>
        </div>
      `).join('');
      result.innerHTML = `<div>${docGs.answerWasCorrect ? '照合済みです。' : '確認が必要です。'}</div>${answerDetails}`;
      compare.textContent = isComparingQuestion ? 'レビューPDFへ戻す' : '元PDFを確認';
      compare.classList.remove('hidden');
      proceed.textContent = getDocumentProceedText();
      proceed.classList.remove('hidden');
    }

    renderDocumentSpread(true);
  }

  function renderDocumentAnswerInputs(item, disabled, answerResults = []) {
    const container = document.getElementById(isDashboardMode() ? 'dashboardAnswerInputs' : 'documentAnswerInputs');
    if (isDashboardMode()) {
      container.innerHTML = item.subQuestions.map((subQuestion, index) => `
        <label class="dash-answer-field" data-answer-index="${index}">
          <span>${escapeHtml(subQuestion.range)}</span>
          <input class="document-answer-input ${answerResults[index] ? (answerResults[index].isCorrect ? 'is-correct' : 'is-wrong') : ''}" data-answer-index="${index}" type="text" autocomplete="off" placeholder="確認内容を入力" value="${escapeHtml(answerResults[index]?.submitted || '')}" ${disabled ? 'disabled' : ''}>
        </label>
      `).join('');
      return;
    }
    const quickValues = ['○', '×', 'ア', 'イ', 'ウ', 'エ', 'オ', '1', '2', '3', '4', '5'];
    container.innerHTML = item.subQuestions.map((subQuestion, index) => `
      <label class="document-answer-field" data-answer-index="${index}">
        <span>${escapeHtml(subQuestion.range)}</span>
        <input class="document-answer-input ${answerResults[index] ? (answerResults[index].isCorrect ? 'is-correct' : 'is-wrong') : ''}" data-answer-index="${index}" type="text" autocomplete="off" placeholder="数字または言葉を入力" value="${escapeHtml(answerResults[index]?.submitted || '')}" ${disabled ? 'disabled' : ''}>
        ${disabled ? '' : `
          <div class="document-quick-inputs" aria-label="${escapeHtml(subQuestion.range)}の入力補助">
            ${quickValues.map(value => `<button type="button" class="document-quick-input" data-answer-index="${index}" data-value="${escapeHtml(value)}">${escapeHtml(value)}</button>`).join('')}
            <button type="button" class="document-quick-input is-clear" data-answer-index="${index}" data-action="clear">クリア</button>
          </div>
        `}
      </label>
    `).join('');
  }

  function handleDocumentQuickInput(e) {
    const button = e.target.closest('.document-quick-input');
    if (!button || docGs.phase !== 'question') return;
    const index = button.dataset.answerIndex;
    const input = document.querySelector(`#documentAnswerInputs .document-answer-input[data-answer-index="${CSS.escape(index)}"]`);
    if (!input || input.disabled) return;
    if (button.dataset.action === 'clear') {
      input.value = '';
    } else {
      input.value = button.dataset.value || '';
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function normalizeAnswer(value) {
    return String(value ?? '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, '').replace(/[，,]/g, '');
  }

  function submitDocumentAnswer() {
    if (docGs.phase !== 'question') return;
    const inputs = Array.from(document.querySelectorAll(`${isDashboardMode() ? '#dashboardAnswerInputs' : '#documentAnswerInputs'} .document-answer-input`));
    const submitted = inputs.map(input => normalizeAnswer(input.value));
    const emptyIndex = submitted.findIndex(answer => !answer);
    if (emptyIndex !== -1) {
      markInputNeedsAttention(inputs[emptyIndex]);
      return;
    }
    const item = docGs.questions[docGs.currentIndex];
    const rawSubmitted = inputs.map(input => input.value.trim());
    docGs.answerResults = item.subQuestions.map((subQuestion, index) => {
      const isCorrect = subQuestion.answers.some(answer => normalizeAnswer(answer) === submitted[index]);
      return {
        range: subQuestion.range,
        submitted: rawSubmitted[index],
        answers: subQuestion.answers,
        isCorrect,
      };
    });
    docGs.answerWasCorrect = docGs.answerResults.every(answerResult => answerResult.isCorrect);
    docGs.phase = 'answer';
    docGs.answerView = 'answer';
    if (docGs.answerWasCorrect) {
      docGs.combo++;
      docGs.missStreak = 0;
      docGs.returnToStartAfterAnswer = false;
      docGs.returnReason = '';
      docGs.score += 100 + docGs.combo * 10;
      records.totalCorrect++;
      records.bestCombo = Math.max(records.bestCombo, docGs.combo);
      records.bestFloor = Math.max(records.bestFloor, docGs.currentIndex + 1);
      records.bestScore = Math.max(records.bestScore, docGs.score);
      if (!isDashboardMode()) {
        pulseAdrenaline(700);
        updateComboAtmosphere(docGs.combo);
        triggerCorrectImpact(docGs.combo);
      }
    } else {
      docGs.combo = 0;
      docGs.missCount++;
      docGs.missStreak++;
      if (isDocumentInputMode()) {
        docGs.returnToStartAfterAnswer = false;
        docGs.returnReason = '';
        scheduleDocumentReview(item);
      } else {
        docGs.returnToStartAfterAnswer = docGs.missCount >= 4 || docGs.missStreak >= 3;
        docGs.returnReason = docGs.missStreak >= 3
          ? '3問連続不正解'
          : (docGs.missCount >= 4 ? 'ミス4回' : '');
      }
      records.totalMiss++;
      updateComboAtmosphere(0);
      if (!isDashboardMode()) {
        pulseAdrenaline(900);
        if (docGs.returnToStartAfterAnswer) triggerCatastrophicReset();
        else if (isDocumentInputMode()) triggerDocumentKnowledgeEffect();
        else triggerDamageHit();
      }
    }
    saveRecords();
    renderDocumentQuestion();
  }

  function proceedDocumentGame() {
    if (docGs.phase !== 'answer') return;
    if (docGs.answerWasCorrect) {
      docGs.currentIndex++;
      if (docGs.currentIndex >= docGs.questions.length) {
        showDocumentClear();
        return;
      }
    } else if (docGs.returnToStartAfterAnswer) {
      showDocumentModeSelection('return');
      return;
    } else {
      docGs.currentIndex++;
      if (docGs.currentIndex >= docGs.questions.length) {
        showDocumentClear();
        return;
      }
    }
    docGs.phase = 'question';
    docGs.answerView = 'answer';
    renderDocumentQuestion();
  }

  function getDocumentProceedText() {
    if (isDashboardMode()) {
      if (docGs.returnToStartAfterAnswer) return `確認して最初の案件へ戻る（${docGs.returnReason}）`;
      return '次の案件へ';
    }
    if (docGs.answerWasCorrect) return '解説を確認して次の問題へ →';
    if (docGs.returnToStartAfterAnswer) return `解説を確認して第1問へ戻る ↩（${docGs.returnReason}）`;
    if (isDocumentInputMode()) return '知識を記録して次の問題へ →';
    return '解説を確認して次の問題へ →';
  }

  function getDocumentFailureStatusText() {
    if (isDocumentInputMode() && !docGs.answerWasCorrect) {
      return `階層リセットはありません。この問題を3問後（終盤は末尾）に復習登録しました。復習登録 ${docGs.reviewCount}件。`;
    }
    if (isDocumentInputMode()) return '正解です。解答・解説ページで知識を確認してから次へ進んでください。';
    const base = `PDFの解答・解説を確認してから進んでください。ミス ${docGs.missCount}/4、連続ミス ${docGs.missStreak}/3。`;
    if (!docGs.answerWasCorrect && docGs.returnToStartAfterAnswer) {
      return `${base} ${docGs.returnReason}に達したため、次は第1問に戻ってミスカウントを0にします。`;
    }
    if (!docGs.answerWasCorrect) return `${base} 条件未到達なので次の問題へ進みます。`;
    return base;
  }

  function toggleDocumentComparison() {
    if (docGs.phase !== 'answer') return;
    docGs.answerView = docGs.answerView === 'answer' ? 'question' : 'answer';
    renderDocumentQuestion();
  }

  function showDashboardDummyPdf() {
    document.querySelectorAll('.dash-pdf-page').forEach(page => page.classList.add('hidden'));
    const image = document.getElementById('dashboardDummyPdfImage');
    image.classList.remove('hidden');
    document.getElementById('dashboardPageRange').textContent = '税務レビュー資料 / サンプル';
  }

  function setDocumentZoom(value) {
    docGs.zoom = Math.min(2.5, Math.max(.7, Math.round(value * 100) / 100));
    updateDocumentZoomLabels();
    renderDocumentSpread(false);
    if (docGs.playMode === 'input-easy' && docGs.phase === 'question') {
      renderDocumentEasyReference(docGs.questions[docGs.currentIndex]);
    }
  }

  function changeDocumentZoom(delta) {
    setDocumentZoom(docGs.zoom + delta);
  }

  function markInputNeedsAttention(input) {
    if (!input) return;
    input.classList.add('needs-input');
    input.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    window.setTimeout(() => input.classList.remove('needs-input'), 1200);
  }

  function showDocumentClear() {
    document.getElementById('clearScore').textContent = docGs.score.toLocaleString();
    document.getElementById('clearCombo').textContent = `${docGs.combo}連続`;
    document.getElementById('clearTotalCorrect').textContent = `${records.totalCorrect}問`;
    document.getElementById('clearCoins').textContent = '0枚';
    spawnClearParticles();
    showScreen('screen-clear');
  }

  function changeDocumentSpread(delta) {
    docGs.spreadStart = Math.max(docGs.spreadMin, Math.min(docGs.spreadMax, docGs.spreadStart + delta));
    renderDocumentSpread(true);
  }

  async function renderDocumentSpread(resetScroll = false) {
    const serial = ++renderSerial;
    const left = docGs.spreadStart;
    const right = left + 1 <= docGs.spreadMax ? left + 1 : null;
    if (isDashboardMode()) {
      resetDashboardPdfPreview();
      document.getElementById('dashboardPageRange').textContent = formatDocumentPageRange(left, right);
      document.getElementById('btnDashboardPrevPage').disabled = left <= docGs.spreadMin;
      document.getElementById('btnDashboardNextPage').disabled = left + 2 > docGs.spreadMax;
      await Promise.all([
        renderPdfPage('dashboardPageLeft', 'dashboardPageLeftLabel', left, serial),
        renderPdfPage('dashboardPageRight', 'dashboardPageRightLabel', right, serial),
      ]);
      if (resetScroll) {
        document.querySelector('.dash-pdf-canvas-wrap')?.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
      }
      return;
    }
    const spread = document.querySelector('.document-spread');
    spread?.classList.toggle('is-answer-review', docGs.phase === 'answer');
    const inlineAnswerSpread = document.getElementById('documentInlineAnswerSpread');
    inlineAnswerSpread?.classList.toggle('hidden', docGs.phase !== 'answer');
    document.getElementById('documentPageRange').textContent = formatDocumentPageRange(left, right);
    document.getElementById('btnDocumentPrevPage').disabled = left <= docGs.spreadMin;
    document.getElementById('btnDocumentNextPage').disabled = left + 2 > docGs.spreadMax;
    const item = docGs.questions[docGs.currentIndex];
    if (docGs.phase === 'answer') {
      const questionLeft = item.questionStart;
      const questionRight = questionLeft + 1 <= item.questionEnd ? questionLeft + 1 : null;
      await Promise.all([
        renderPdfPage('documentPageLeft', 'documentPageLeftLabel', questionLeft, serial, 'question'),
        renderPdfPage('documentPageRight', 'documentPageRightLabel', questionRight, serial, 'question'),
        renderPdfPage('documentAnswerPageLeft', 'documentAnswerPageLeftLabel', left, serial, 'answer'),
        renderPdfPage('documentAnswerPageRight', 'documentAnswerPageRightLabel', right, serial, 'answer'),
      ]);
    } else {
      await Promise.all([
        renderPdfPage('documentPageLeft', 'documentPageLeftLabel', left, serial),
        renderPdfPage('documentPageRight', 'documentPageRightLabel', right, serial),
      ]);
    }
    if (resetScroll) {
      if (docGs.phase === 'answer') {
        requestAnimationFrame(() => {
          spread?.scrollTo({ left: 0, top: Math.max(0, (inlineAnswerSpread?.offsetTop || 0) - 8), behavior: 'smooth' });
        });
      } else {
        spread?.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
      }
    }
  }

  function getDocumentPrintedPage(pageNumber, forcedView = null) {
    const item = docGs.questions[docGs.currentIndex];
    const isQuestion = forcedView ? forcedView === 'question' : (docGs.phase !== 'answer' || docGs.answerView === 'question');
    const physicalStart = isQuestion ? item.questionStart : item.answerPage;
    const printedStart = isQuestion ? item.printedQuestionStart : item.printedAnswerStart;
    return printedStart ? printedStart + pageNumber - physicalStart : null;
  }

  function formatDocumentPageRange(left, right) {
    const printedLeft = getDocumentPrintedPage(left);
    const printedRight = right ? getDocumentPrintedPage(right) : null;
    const physical = right ? `${left}-${right}` : `${left}`;
    if (!printedLeft) return `PDF ${physical}`;
    const printed = printedRight ? `${printedLeft}-${printedRight}` : `${printedLeft}`;
    return `書籍 ${printed} / PDF ${physical}`;
  }

  async function renderPdfPage(canvasId, labelId, pageNumber, serial, forcedView = null) {
    const canvas = document.getElementById(canvasId);
    const label = document.getElementById(labelId);
    const context = canvas.getContext('2d');
    if (!pageNumber) {
      canvas.width = 1;
      canvas.height = 1;
      context.clearRect(0, 0, 1, 1);
      canvas.parentElement.classList.add('is-empty');
      canvas.parentElement.style.flexBasis = '';
      canvas.parentElement.style.minWidth = '';
      label.textContent = '';
      return;
    }
    const page = await docGs.pdf.getPage(pageNumber);
    if (serial !== renderSerial) return;
    const initial = page.getViewport({ scale: 1 });
    const initialWidth = Math.max(560, Math.floor(canvas.parentElement.clientWidth - 18));
    const maxWidth = Number(canvas.parentElement.dataset.baseWidth) || initialWidth;
    canvas.parentElement.dataset.baseWidth = String(maxWidth);
    const cssScale = (maxWidth / initial.width) * docGs.zoom;
    const pixelRatio = Math.min(3, Math.max(1.5, window.devicePixelRatio || 1));
    const viewport = page.getViewport({ scale: cssScale * pixelRatio });
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    canvas.style.width = `${Math.ceil(viewport.width / pixelRatio)}px`;
    canvas.style.height = `${Math.ceil(viewport.height / pixelRatio)}px`;
    canvas.parentElement.style.flexBasis = `${Math.ceil(viewport.width / pixelRatio) + 14}px`;
    canvas.parentElement.style.minWidth = `${Math.ceil(viewport.width / pixelRatio) + 14}px`;
    canvas.parentElement.classList.remove('is-empty');
    const printedPage = getDocumentPrintedPage(pageNumber, forcedView);
    label.textContent = printedPage
      ? `書籍 ${printedPage} / PDF ${pageNumber}`
      : `PDF ${pageNumber} / ${docGs.pdf.numPages}`;
    await page.render({ canvasContext: context, viewport }).promise;
  }

  function toggleDocumentProgress() {
    const play = document.getElementById('documentPlay');
    const button = document.getElementById('btnDocumentToggleProgress');
    const collapsed = play.classList.toggle('is-progress-collapsed');
    button.textContent = collapsed ? '›' : '‹';
    button.title = collapsed ? '進捗パネルを開く' : '進捗パネルを折り畳む';
    button.setAttribute('aria-expanded', String(!collapsed));
    document.querySelectorAll('.document-page').forEach(page => {
      delete page.dataset.baseWidth;
    });
    requestAnimationFrame(() => {
      renderDocumentSpread(false);
      if (docGs.playMode === 'input-easy' && docGs.phase === 'question') {
        renderDocumentEasyReference(docGs.questions[docGs.currentIndex]);
      }
    });
  }

  function handleDocumentCalculator(button) {
    const display = document.getElementById('documentCalcDisplay');
    const action = button.dataset.documentCalcAction;
    if (action === 'clear') {
      display.value = '0';
      return;
    }
    if (action === 'backspace') {
      display.value = display.value.length > 1 ? display.value.slice(0, -1) : '0';
      return;
    }
    if (action === 'evaluate') {
      const expression = display.value.replace(/×/g, '*').replace(/÷/g, '/');
      if (!/^[\d+\-*/. ]+$/.test(expression)) return;
      try {
        const result = Function(`"use strict"; return (${expression})`)();
        display.value = Number.isFinite(result) ? String(Math.round((result + Number.EPSILON) * 1e10) / 1e10) : 'Error';
      } catch {
        display.value = 'Error';
      }
      return;
    }
    if (action === 'append') {
      const value = button.dataset.documentCalcValue;
      display.value = display.value === '0' || display.value === 'Error' ? value : display.value + value;
    }
  }

  function handleDocumentCalculatorKeydown(event) {
    if (event.key === 'Enter' || event.key === '=') {
      event.preventDefault();
      handleDocumentCalculator({ dataset: { documentCalcAction: 'evaluate' } });
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      handleDocumentCalculator({ dataset: { documentCalcAction: 'clear' } });
      return;
    }
    if (event.key === '*' || event.key === '/') {
      event.preventDefault();
      handleDocumentCalculator({
        dataset: {
          documentCalcAction: 'append',
          documentCalcValue: event.key === '*' ? '×' : '÷',
        },
      });
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (/^[\d.+-]$/.test(event.key) || ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Tab'].includes(event.key)) return;
    event.preventDefault();
  }

  function sanitizeDocumentCalculatorInput(event) {
    const input = event.currentTarget;
    input.value = input.value.replace(/[^0-9+\-*/.×÷]/g, '');
    if (!input.value) input.value = '0';
  }

  function appendDocumentCalculatorToMemo() {
    const display = document.getElementById('documentCalcDisplay');
    const memo = document.getElementById('documentMemoText');
    const text = display.value === 'Error' ? '' : display.value;
    if (!text) return;
    memo.value += `${memo.value ? '\n' : ''}${text}`;
  }

  async function copyDocumentMemoText() {
    const memo = document.getElementById('documentMemoText');
    if (!memo.value) return;
    try {
      await navigator.clipboard.writeText(memo.value);
    } catch {
      memo.select();
      document.execCommand('copy');
      memo.setSelectionRange(memo.value.length, memo.value.length);
    }
  }

  function initializeDocumentAnswerSplit() {
    const panel = document.querySelector('.document-answer-panel');
    const dragbar = document.getElementById('documentAnswerToolsDivider');
    let startY = 0;
    let startHeight = 0;
    const move = event => {
      const maxHeight = Math.max(190, panel.clientHeight - 170);
      const nextHeight = startHeight + event.clientY - startY;
      panel.style.gridTemplateRows = `${Math.min(maxHeight, Math.max(190, nextHeight))}px auto minmax(150px, 1fr)`;
    };
    const end = event => {
      if (dragbar.hasPointerCapture(event.pointerId)) dragbar.releasePointerCapture(event.pointerId);
      dragbar.removeEventListener('pointermove', move);
      dragbar.removeEventListener('pointerup', end);
      dragbar.removeEventListener('pointercancel', end);
    };
    dragbar.addEventListener('pointerdown', event => {
      startY = event.clientY;
      startHeight = document.getElementById('documentAnswerPane').getBoundingClientRect().height;
      dragbar.setPointerCapture(event.pointerId);
      dragbar.addEventListener('pointermove', move);
      dragbar.addEventListener('pointerup', end);
      dragbar.addEventListener('pointercancel', end);
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function initDocumentMode() {
    addStylesheet();
    injectDocumentMode();
    bindDocumentEvents();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initDocumentMode);
  else initDocumentMode();
})();


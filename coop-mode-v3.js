'use strict';

(() => {
  const CLEAR_TEAM_FLOORS = 70;
  const CLEAR_SOLO_FLOORS = 45;
  const COLLAPSE_TEAM_MISSES = 10;
  const COLLAPSE_PLAYER_TOTAL_MISSES = 7;
  const COLLAPSE_PLAYER_MISS_STREAK = 4;
  const RESCUE_CORRECT_STREAK = 8;

  const coopState = {
    loaded: false,
    status: 'setup',
    teamFloors: 0,
    teamMistakes: 0,
    collapseCount: 0,
    lastEvent: '',
    lastAction: null,
    lastSeenActionId: '',
    seenActionIds: new Set(),
    pendingCollapse: null,
    roomId: '',
    roomRef: null,
    unsubscribeRoom: null,
    syncing: false,
    activeMode: '',
    players: {
      A: createPlayer('A'),
      B: createPlayer('B'),
    },
  };

  function createPlayer(id) {
    return {
      id,
      name: id,
      pdfFile: null,
      excelFile: null,
      pdf: null,
      questions: [],
      order: [],
      questionIndex: 0,
      phase: 'question',
      answerResults: [],
      lastCorrect: null,
      floors: 0,
      totalMistakes: 0,
      missStreak: 0,
      correctStreak: 0,
      zoom: 2,
      questionOffset: 0,
      answerOffset: 0,
      draftAnswers: [],
      compact: false,
    };
  }

  function initCoopMode() {
    injectCoopButton();
    injectCoopScreen();
    bindCoopEvents();
  }

  function injectCoopButton() {
    if (document.getElementById('btnCoopMode')) return;
    const docButton = document.getElementById('btnDocumentMode') || document.getElementById('btnResetRecords');
    if (!docButton) return;
    docButton.insertAdjacentHTML('afterend', `
      <button id="btnCoopMode" class="btn-start btn-coop-start" type="button">
        <span>2人協力モード</span><span class="btn-arrow">→</span>
      </button>
    `);
  }

  function injectCoopScreen() {
    if (document.getElementById('screen-coop')) return;
    const clearScreen = document.getElementById('screen-clear') || document.body.lastElementChild;
    clearScreen.insertAdjacentHTML('beforebegin', `
      <div id="screen-coop" class="screen hidden">
        <div class="coop-effect-layer" id="coopEffectLayer" aria-hidden="true"></div>
        <div class="coop-shell">
          <header class="coop-topbar">
            <div>
              <div class="coop-kicker">PDF + EXCEL CO-OP TOWER</div>
              <h2>2人協力モード</h2>
            </div>
            <button id="btnCoopBackTitle" class="external-mini-btn" type="button">タイトルへ</button>
          </header>

          <section id="coopSetup" class="coop-setup">
            <div class="coop-setup-panel">
              <h3>各プレイヤーが自分のPDF/Excelを読み込む</h3>
              <p>PDF/Excel本体はFirebaseに保存しません。AはA用、BはB用を自分の端末で選び、Firestoreには部屋コードと進行状況だけを同期します。</p>
              <div class="coop-room-panel">
                <div>
                  <span>協力部屋</span>
                  <strong id="coopRoomStatus">Firestore未接続。ローカルだけでも試せます。</strong>
                </div>
                <label>
                  <span>部屋コード</span>
                  <input id="coopRoomId" type="text" maxlength="12" placeholder="例: TOWER7">
                </label>
                <button id="btnCoopCreateRoom" class="coop-mini-btn" type="button">部屋を作る</button>
                <button id="btnCoopJoinRoom" class="coop-mini-btn" type="button">部屋に入る</button>
              </div>
              <div class="coop-upload-grid">
                ${['A', 'B'].map(id => `
                  <div class="coop-upload-card">
                    <h4>Player ${id}</h4>
                    <label><span>名前</span><input id="coopName${id}" type="text" value="${id}"></label>
                    <label><span>PDF</span><input id="coopPdf${id}" type="file" accept=".pdf,application/pdf"><strong id="coopPdfName${id}">未選択</strong></label>
                    <label><span>Excel</span><input id="coopExcel${id}" type="file" accept=".xlsx,.xls"><strong id="coopExcelName${id}">未選択</strong></label>
                  </div>
                `).join('')}
              </div>
              <div id="coopLoadStatus" class="coop-status">この端末で担当するプレイヤーのPDFとExcelを選択してください。1台でテストする場合はA/B両方を選べます。</div>
              <button id="btnCoopStart" class="btn-start hidden" type="button">読み込んだプレイヤーで開始 <span class="btn-arrow">→</span></button>
            </div>
          </section>

          <section id="coopModeSelect" class="coop-mode-select hidden">
            <div class="coop-setup-panel">
              <h3>モードを選択</h3>
              <p>PDF/Excelの読み込みチェックが完了しました。遊ぶモードを選んでください。</p>
              <div class="coop-mode-grid">
                <button id="btnTowerClimbMode" class="coop-mode-card" type="button">
                  <strong>タワークライムモード</strong>
                  <span>これまでの協力塔モードで進めます。</span>
                </button>
                <button id="btnBombEscapeMode" class="coop-mode-card is-escape" type="button">
                  <strong>爆弾エスケープモード</strong>
                  <span>ミスで爆弾、正解で脱出経路を選ぶ隠し選択モードです。</span>
                </button>
              </div>
            </div>
          </section>

          <section id="coopPlay" class="coop-play hidden">
            <aside class="coop-team-panel">
              <div class="coop-team-status" id="coopTeamStatus">準備中</div>
              <div class="coop-team-stats">
                <div><span>通算階層</span><strong id="coopTeamFloors">0 / ${CLEAR_TEAM_FLOORS}</strong></div>
                <div><span>チームミス</span><strong id="coopTeamMistakes">0 / ${COLLAPSE_TEAM_MISSES}</strong></div>
                <div><span>倒壊回数</span><strong id="coopCollapseCount">0</strong></div>
              </div>
              <div id="coopEventLog" class="coop-event-log">まだイベントはありません。</div>
              <button id="btnCoopResetRun" class="coop-mini-btn" type="button">最初からやり直す</button>
            </aside>
            <main class="coop-players" id="coopPlayers"></main>
          </section>
        </div>
      </div>
    `);
  }

  function bindCoopEvents() {
    document.getElementById('btnCoopMode')?.addEventListener('click', openCoopMode);
    document.getElementById('btnCoopBackTitle')?.addEventListener('click', () => {
      showScreen('screen-title');
      if (typeof initTitleScreen === 'function') initTitleScreen();
    });
    ['A', 'B'].forEach(id => {
      document.getElementById(`coopName${id}`)?.addEventListener('input', e => {
        coopState.players[id].name = e.target.value.trim() || id;
      });
      document.getElementById(`coopPdf${id}`)?.addEventListener('change', e => setCoopFile(id, 'pdfFile', e.target.files[0] || null));
      document.getElementById(`coopExcel${id}`)?.addEventListener('change', e => setCoopFile(id, 'excelFile', e.target.files[0] || null));
    });
    document.getElementById('btnCoopStart')?.addEventListener('click', startCoopGame);
    const loadButton = document.getElementById('btnCoopStart');
    if (loadButton) loadButton.innerHTML = '読み込む <span class="btn-arrow">→</span>';
    document.getElementById('btnTowerClimbMode')?.addEventListener('click', startTowerClimbMode);
    document.getElementById('btnBombEscapeMode')?.addEventListener('click', startBombEscapeMode);
    document.getElementById('btnCoopCreateRoom')?.addEventListener('click', createCoopRoom);
    document.getElementById('btnCoopJoinRoom')?.addEventListener('click', joinCoopRoomFromInput);
    document.getElementById('btnCoopResetRun')?.addEventListener('click', () => {
      resetCoopRun(true);
      syncCoopRoom();
      renderCoop();
    });
    document.getElementById('coopPlayers')?.addEventListener('click', handleCoopPlayerClick);
    document.getElementById('coopPlayers')?.addEventListener('input', handleCoopPlayerInput);
    document.getElementById('coopPlayers')?.addEventListener('pointerdown', e => {
      if (e.target.closest('.coop-candidate-chip')) e.preventDefault();
    });
    document.getElementById('coopPlayers')?.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const card = e.target.closest('[data-coop-player]');
      if (!card) return;
      const id = card.dataset.coopPlayer;
      if (coopState.players[id]?.phase === 'question') submitCoopAnswer(id);
    });
  }

  function openCoopMode() {
    showScreen('screen-coop');
    document.getElementById('coopSetup').classList.toggle('hidden', coopState.loaded);
    document.getElementById('coopModeSelect')?.classList.toggle('hidden', !coopState.loaded || coopState.activeMode);
    document.getElementById('coopPlay').classList.toggle('hidden', !coopState.loaded || !coopState.activeMode);
    renderCoop();
  }

  async function ensureFirebaseReady() {
    if (!window.firebase || !window.GM5_FIREBASE_CONFIG) {
      throw new Error('firebase-config.jsがまだ設定されていません。FirebaseのWeb設定を入れると部屋同期が使えます。');
    }
    if (!firebase.apps.length) firebase.initializeApp(window.GM5_FIREBASE_CONFIG);
    if (!firebase.auth().currentUser) await firebase.auth().signInAnonymously();
    return firebase.firestore();
  }

  function makeRoomId() {
    return `TOWER${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  }

  async function createCoopRoom() {
    try {
      const db = await ensureFirebaseReady();
      const roomId = makeRoomId();
      const roomRef = db.collection('rooms').doc(roomId);
      await roomRef.set(buildRoomPayload());
      document.getElementById('coopRoomId').value = roomId;
      attachCoopRoom(roomRef, roomId);
      setCoopRoomStatus(`部屋 ${roomId} を作りました。相手にこのコードを伝えてください。`);
    } catch (error) {
      setCoopRoomStatus(error.message);
    }
  }

  async function joinCoopRoomFromInput() {
    try {
      const roomId = (document.getElementById('coopRoomId')?.value || '').trim().toUpperCase();
      if (!roomId) throw new Error('部屋コードを入力してください。');
      const db = await ensureFirebaseReady();
      const roomRef = db.collection('rooms').doc(roomId);
      const snap = await roomRef.get();
      if (!snap.exists) throw new Error('その部屋コードはまだ作られていません。');
      attachCoopRoom(roomRef, roomId);
      setCoopRoomStatus(`部屋 ${roomId} に入りました。`);
    } catch (error) {
      setCoopRoomStatus(error.message);
    }
  }

  function attachCoopRoom(roomRef, roomId) {
    if (coopState.unsubscribeRoom) coopState.unsubscribeRoom();
    coopState.roomRef = roomRef;
    coopState.roomId = roomId;
    coopState.unsubscribeRoom = roomRef.onSnapshot(snapshot => {
      if (!snapshot.exists || coopState.syncing) return;
      const data = snapshot.data();
      applyRemoteRoom(data);
      if (coopState.activeMode === 'escape' && window.BombEscapeMode?.onRoomData) {
        window.BombEscapeMode.onRoomData(data);
      } else {
        renderCoop();
      }
    }, error => setCoopRoomStatus(error.message));
  }

  function setCoopRoomStatus(text) {
    setText('coopRoomStatus', text);
  }

  function buildRoomPayload() {
    return {
      status: coopState.status,
      activeMode: coopState.activeMode,
      teamFloors: coopState.teamFloors,
      teamMistakes: coopState.teamMistakes,
      collapseCount: coopState.collapseCount,
      lastEvent: coopState.lastEvent,
      lastAction: coopState.lastAction,
      pendingCollapse: coopState.pendingCollapse,
      players: {
        A: serializePlayerForRoom(coopState.players.A),
        B: serializePlayerForRoom(coopState.players.B),
      },
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
  }

  function serializePlayerForRoom(player) {
    return {
      id: player.id,
      name: player.name,
      ready: Boolean(player.questions.length && player.pdf),
      floors: player.floors,
      totalMistakes: player.totalMistakes,
      missStreak: player.missStreak,
      correctStreak: player.correctStreak,
      questionIndex: player.questionIndex,
      phase: player.phase,
      lastCorrect: player.lastCorrect,
    };
  }

  function applyRemoteRoom(data) {
    if (!data) return;
    const incomingAction = data.lastAction;
    coopState.status = data.status || coopState.status;
    coopState.teamFloors = Number(data.teamFloors || 0);
    coopState.teamMistakes = Number(data.teamMistakes || 0);
    coopState.collapseCount = Number(data.collapseCount || 0);
    coopState.lastEvent = data.lastEvent || coopState.lastEvent;
    coopState.pendingCollapse = data.pendingCollapse || null;
    ['A', 'B'].forEach(id => {
      const remote = data.players?.[id];
      if (!remote) return;
      const local = coopState.players[id];
      local.name = remote.name || local.name;
      local.floors = Number(remote.floors || 0);
      local.totalMistakes = Number(remote.totalMistakes || 0);
      local.missStreak = Number(remote.missStreak || 0);
      local.correctStreak = Number(remote.correctStreak || 0);
      local.lastCorrect = remote.lastCorrect ?? local.lastCorrect;
      if (!isLocalPlayable(local)) {
        local.questionIndex = Number(remote.questionIndex || 0);
        local.phase = remote.phase || local.phase;
      }
    });
    playRemoteEffect(incomingAction);
  }

  function playRemoteEffect(action) {
    if (!action?.id || action.id === coopState.lastSeenActionId || coopState.seenActionIds.has(action.id)) return;
    coopState.lastSeenActionId = action.id;
    coopState.seenActionIds.add(action.id);
    if (isLocalPlayable(coopState.players[action.player])) return;
    const type = action.type === 'correct' ? 'ally-correct'
      : action.type === 'miss' ? 'ally-miss'
      : action.type;
    playCoopEffect(type, action.message);
  }

  async function syncCoopRoom() {
    if (!coopState.roomRef) return;
    coopState.syncing = true;
    try {
      await coopState.roomRef.set(buildRoomPayload(), { merge: true });
      coopState.lastAction = null;
      setCoopRoomStatus(`部屋 ${coopState.roomId} と同期しました。`);
    } catch (error) {
      setCoopRoomStatus(error.message);
    } finally {
      coopState.syncing = false;
    }
  }

  function setCoopFile(id, key, file) {
    coopState.players[id][key] = file;
    const label = document.getElementById(key === 'pdfFile' ? `coopPdfName${id}` : `coopExcelName${id}`);
    if (label) label.textContent = file?.name || '未選択';
    refreshCoopSetup();
  }

  function refreshCoopSetup() {
    const readyPlayers = ['A', 'B'].filter(id => coopState.players[id].pdfFile && coopState.players[id].excelFile);
    document.getElementById('btnCoopStart')?.classList.toggle('hidden', !readyPlayers.length);
    const status = document.getElementById('coopLoadStatus');
    if (status) {
      status.textContent = readyPlayers.length
        ? `${readyPlayers.join(' / ')} の準備OKです。`
        : 'この端末で担当するプレイヤーのPDFとExcelを選択してください。';
    }
  }

  async function waitForDocumentApi() {
    for (let i = 0; i < 50; i++) {
      if (window.DocumentModeAPI?.loadQuestionSet) return window.DocumentModeAPI;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('PDF+Excel読み込み機能の準備ができませんでした。ページを再読み込みしてください。');
  }

  async function startCoopGame() {
    const status = document.getElementById('coopLoadStatus');
    try {
      if (status) status.textContent = 'PDFとExcelを読み込んでいます...';
      const api = await waitForDocumentApi();
      let loadedCount = 0;
      for (const id of ['A', 'B']) {
        const player = coopState.players[id];
        if (!player.pdfFile || !player.excelFile) {
          player.pdf = null;
          player.questions = [];
          player.order = [];
          player.compact = true;
          continue;
        }
        const [pdfBuffer, excelBuffer] = await Promise.all([
          player.pdfFile.arrayBuffer(),
          player.excelFile.arrayBuffer(),
        ]);
        const loaded = await api.loadQuestionSet({ excelBuffer, pdfBuffer });
        player.pdf = loaded.pdf;
        player.questions = loaded.questions;
        player.order = shuffledIndexes(player.questions.length);
        player.compact = false;
        loadedCount++;
      }
      if (!loadedCount) throw new Error('PDFとExcelが読み込まれていません。');
      resetCoopRun(false);
      coopState.loaded = true;
      coopState.status = 'ready';
      coopState.activeMode = '';
      coopState.lastEvent = '協力塔を開始しました。';
      syncCoopRoom();
      document.getElementById('coopSetup').classList.add('hidden');
      document.getElementById('coopModeSelect')?.classList.remove('hidden');
      document.getElementById('coopPlay').classList.add('hidden');
    } catch (error) {
      if (status) status.textContent = error.message;
    }
  }

  function startTowerClimbMode() {
    coopState.activeMode = 'tower';
    coopState.status = 'playing';
    coopState.lastEvent = 'タワークライムモードを開始しました。';
    document.getElementById('coopModeSelect')?.classList.add('hidden');
    document.getElementById('coopPlay')?.classList.remove('hidden');
    syncCoopRoom();
    renderCoop();
  }

  function startBombEscapeMode() {
    coopState.activeMode = 'escape';
    coopState.status = 'playing';
    coopState.lastEvent = '爆弾エスケープモードを開始しました。';
    document.getElementById('coopModeSelect')?.classList.add('hidden');
    document.getElementById('coopPlay')?.classList.remove('hidden');
    syncCoopRoom();
    if (window.BombEscapeMode?.start) window.BombEscapeMode.start(coopState);
    else setText('coopEventLog', 'bomb-escape-mode.js が読み込まれていません。');
  }

  function shuffledIndexes(length) {
    const arr = Array.from({ length }, (_, index) => index);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function resetCoopRun(reshuffle) {
    coopState.status = 'playing';
    coopState.teamFloors = 0;
    coopState.teamMistakes = 0;
    coopState.pendingCollapse = null;
    ['A', 'B'].forEach(id => {
      const p = coopState.players[id];
      if (reshuffle && p.questions.length) p.order = shuffledIndexes(p.questions.length);
      p.questionIndex = 0;
      p.phase = 'question';
      p.answerResults = [];
      p.draftAnswers = [];
      p.lastCorrect = null;
      p.floors = 0;
      p.totalMistakes = 0;
      p.missStreak = 0;
      p.correctStreak = 0;
      p.questionOffset = 0;
      p.answerOffset = 0;
      p.zoom = p.zoom || 1;
    });
    coopState.lastEvent = reshuffle ? '最初からやり直しました。' : '';
  }

  function getCurrentQuestion(player) {
    const orderedIndex = player.order[player.questionIndex % Math.max(1, player.order.length)];
    return player.questions[orderedIndex];
  }

  function isLocalPlayable(player) {
    return Boolean(player?.pdf && player.questions.length);
  }

  function renderCoop() {
    const play = document.getElementById('coopPlayers');
    if (!play) return;
    updateCoopTeamPanel();
    play.innerHTML = ['A', 'B'].map(id => renderPlayerCard(coopState.players[id])).join('');
    ['A', 'B'].forEach(renderPlayerPdf);
  }

  function updateCoopTeamPanel() {
    const status = document.getElementById('coopTeamStatus');
    if (status) status.textContent = coopState.status === 'cleared' ? 'CLEAR' : (coopState.pendingCollapse ? 'AUTO REVIVE' : 'PLAYING');
    setText('coopTeamFloors', `${coopState.teamFloors} / ${CLEAR_TEAM_FLOORS}`);
    setText('coopTeamMistakes', `${coopState.teamMistakes} / ${COLLAPSE_TEAM_MISSES}`);
    setText('coopCollapseCount', String(coopState.collapseCount));
    setText('coopEventLog', coopState.lastEvent || 'まだイベントはありません。');
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function renderPlayerCard(player) {
    if (!isLocalPlayable(player) || player.compact) return renderCompactPlayerCard(player);
    const q = getCurrentQuestion(player);
    if (!q) return `<section class="coop-player-card" data-coop-player="${player.id}">問題がありません。</section>`;
    const isAnswer = player.phase === 'answer';
    const answerDetails = player.answerResults.map(r => `
      <div class="coop-answer-line ${r.isCorrect ? 'is-correct' : 'is-wrong'}">
        <span>${escapeHtml(r.range)}</span>
        <strong>${r.isCorrect ? '正解' : '不正解'}</strong>
        <small>入力: ${escapeHtml(r.submitted || '-')}</small>
      </div>
    `).join('');
    return `
      <section class="coop-player-card" data-coop-player="${player.id}">
        <header class="coop-player-head">
          <div><span>Player ${player.id}</span><strong>${escapeHtml(player.name)}</strong></div>
          <div class="coop-head-actions">
            <button type="button" class="coop-mini-btn" data-coop-action="toggle-compact">最小化</button>
            <button type="button" class="coop-mini-btn" data-coop-action="shuffle">再シャッフル</button>
          </div>
        </header>
        <div class="coop-player-stats">
          <div><span>個人/チームミス</span><strong>${player.totalMistakes}/${COLLAPSE_PLAYER_TOTAL_MISSES} / ${coopState.teamMistakes}/${COLLAPSE_TEAM_MISSES}</strong></div>
          <div><span>階層</span><strong>${player.floors}F</strong></div>
          <div><span>通算ミス</span><strong>${player.totalMistakes}/${COLLAPSE_PLAYER_TOTAL_MISSES}</strong></div>
          <div><span>連続ミス</span><strong>${player.missStreak}/${COLLAPSE_PLAYER_MISS_STREAK}</strong></div>
          <div><span>連続正解</span><strong>${player.correctStreak}/${RESCUE_CORRECT_STREAK}</strong></div>
        </div>
        <div class="coop-question-bar">
          <strong>第${escapeHtml(String(q.questionNo))}問</strong>
          <span>${isAnswer ? '問題文と解説を見比べ中' : '問題PDF'}</span>
          ${renderZoomControls(player)}
        </div>
        ${isAnswer ? renderComparePdfArea() : renderQuestionPdfArea()}
        <aside class="coop-answer-panel">
          <div class="coop-answer-question">${isAnswer ? '解答・解説を確認してください。' : 'PDFを確認して回答してください。'}</div>
          <div class="coop-answer-inputs">
            ${q.subQuestions.map((sub, index) => renderAnswerInput(player, sub, index, isAnswer)).join('')}
          </div>
          ${isAnswer ? `
            <div class="coop-result ${player.lastCorrect ? 'is-correct' : 'is-wrong'}">
              <strong>${player.lastCorrect ? '正解' : '不正解'}</strong>
              ${answerDetails}
            </div>
            <button type="button" class="coop-submit" data-coop-action="next">${coopState.pendingCollapse ? '自動復活して再開' : '解説を確認して次へ'}</button>
          ` : `
            <button type="button" class="coop-submit" data-coop-action="submit">採点する</button>
          `}
        </aside>
      </section>
    `;
  }

  function renderCompactPlayerCard(player) {
    const localMissing = !isLocalPlayable(player);
    return `
      <section class="coop-player-card is-compact" data-coop-player="${player.id}">
        <header class="coop-player-head">
          <div><span>Player ${player.id}</span><strong>${escapeHtml(player.name)}</strong></div>
          ${isLocalPlayable(player) ? '<button type="button" class="coop-mini-btn" data-coop-action="toggle-compact">開く</button>' : ''}
        </header>
        <div class="coop-compact-body">
          <strong>${localMissing ? 'この端末ではPDF/Excel未読み込み' : '最小表示中'}</strong>
          <div class="coop-player-stats">
            <div><span>個人/チームミス</span><strong>${player.totalMistakes}/${COLLAPSE_PLAYER_TOTAL_MISSES} / ${coopState.teamMistakes}/${COLLAPSE_TEAM_MISSES}</strong></div>
            <div><span>階層</span><strong>${player.floors}F</strong></div>
            <div><span>通算ミス</span><strong>${player.totalMistakes}/${COLLAPSE_PLAYER_TOTAL_MISSES}</strong></div>
            <div><span>連続ミス</span><strong>${player.missStreak}/${COLLAPSE_PLAYER_MISS_STREAK}</strong></div>
            <div><span>連続正解</span><strong>${player.correctStreak}/${RESCUE_CORRECT_STREAK}</strong></div>
          </div>
        </div>
      </section>
    `;
  }

  function renderZoomControls(player) {
    const pct = Math.round((player.zoom || 1) * 100);
    return `
      <div class="coop-pdf-controls">
        <button type="button" data-coop-action="zoom-out">−</button>
        <input class="coop-zoom-range" data-coop-zoom="${player.id}" type="range" min="70" max="500" step="10" value="${pct}" aria-label="PDF縮尺">
        <span>${pct}%</span>
        <button type="button" data-coop-action="zoom-in">＋</button>
        <button type="button" data-coop-action="zoom-fit">Fit</button>
        <button type="button" data-coop-action="zoom-100">100%</button>
      </div>
    `;
  }

  function renderQuestionPdfArea() {
    return `
      <div class="coop-pdf-section">
        <div class="coop-pdf-section-head">
          <strong>問題文</strong>
          <div>
            <button type="button" class="coop-mini-btn" data-coop-action="problem-prev">←</button>
            <button type="button" class="coop-mini-btn" data-coop-action="problem-next">→</button>
          </div>
        </div>
        <div class="coop-pdf-spread">
          <figure><canvas data-coop-canvas="problem-left"></canvas><figcaption data-coop-label="problem-left"></figcaption></figure>
          <figure><canvas data-coop-canvas="problem-right"></canvas><figcaption data-coop-label="problem-right"></figcaption></figure>
        </div>
      </div>
    `;
  }

  function renderComparePdfArea() {
    return `
      <div class="coop-compare-pdfs">
        <div class="coop-pdf-section">
          <div class="coop-pdf-section-head">
            <strong>問題文</strong>
            <div>
              <button type="button" class="coop-mini-btn" data-coop-action="problem-prev">←</button>
              <button type="button" class="coop-mini-btn" data-coop-action="problem-next">→</button>
            </div>
          </div>
          <div class="coop-pdf-spread">
            <figure><canvas data-coop-canvas="problem-left"></canvas><figcaption data-coop-label="problem-left"></figcaption></figure>
            <figure><canvas data-coop-canvas="problem-right"></canvas><figcaption data-coop-label="problem-right"></figcaption></figure>
          </div>
        </div>
        <div class="coop-pdf-section">
          <div class="coop-pdf-section-head">
            <strong>解答・解説</strong>
            <div>
              <button type="button" class="coop-mini-btn" data-coop-action="answer-prev">←</button>
              <button type="button" class="coop-mini-btn" data-coop-action="answer-next">→</button>
            </div>
          </div>
          <div class="coop-pdf-spread">
            <figure><canvas data-coop-canvas="answer-left"></canvas><figcaption data-coop-label="answer-left"></figcaption></figure>
            <figure><canvas data-coop-canvas="answer-right"></canvas><figcaption data-coop-label="answer-right"></figcaption></figure>
          </div>
        </div>
      </div>
    `;
  }

  function renderAnswerInput(player, sub, index, isAnswer) {
    const result = player.answerResults[index];
    const className = result ? (result.isCorrect ? 'is-correct' : 'is-wrong') : '';
    const candidates = uniqueAnswers(sub.answers).map(answer => `
      <button type="button" class="coop-candidate-chip" data-coop-action="fill-candidate" data-answer-index="${index}" data-value="${escapeHtml(answer)}">${escapeHtml(answer)}</button>
    `).join('');
    return `
      <label>
        <span>${escapeHtml(sub.range)}</span>
        <input class="coop-answer-input ${className}" data-answer-index="${index}" value="${escapeHtml(result?.submitted ?? player.draftAnswers[index] ?? '')}" ${isAnswer ? 'disabled' : ''}>
        ${isAnswer ? '' : `<div class="coop-candidates">${candidates}</div>`}
      </label>
    `;
  }

  function uniqueAnswers(answers) {
    return ['\u25cb', '\u00d7', '\u30a2', '\u30a4', '\u30a6', '\u30a8', '\u30aa', '1', '2', '3', '4', '5'];
  }

  async function renderPlayerPdf(id) {
    const player = coopState.players[id];
    const q = getCurrentQuestion(player);
    const card = document.querySelector(`[data-coop-player="${id}"]`);
    if (!card || !player.pdf || !q || player.compact) return;
    await renderSpread(player, q, card, 'problem');
    if (player.phase === 'answer') await renderSpread(player, q, card, 'answer');
  }

  async function renderSpread(player, q, card, kind) {
    const range = getPageRange(player, q, kind);
    const offsetKey = kind === 'answer' ? 'answerOffset' : 'questionOffset';
    const start = clamp(range.start + (player[offsetKey] || 0), range.start, range.end);
    const right = start + 1 <= range.end ? start + 1 : null;
    await renderPdfPage(player, card, `${kind}-left`, start);
    if (right) await renderPdfPage(player, card, `${kind}-right`, right);
    else clearCanvas(card, `${kind}-right`);
  }

  function getPageRange(player, q, kind) {
    if (kind === 'answer') {
      const start = q.answerPage;
      const end = Math.min(q.answerEnd || q.answerPage + 1, player.pdf?.numPages || start);
      return { start, end: Math.max(start, end) };
    }
    return { start: q.questionStart, end: Math.max(q.questionStart, q.questionEnd || q.questionStart) };
  }

  async function renderPdfPage(player, card, canvasKey, pageNumber) {
    const canvas = card.querySelector(`[data-coop-canvas="${canvasKey}"]`);
    const label = card.querySelector(`[data-coop-label="${canvasKey}"]`);
    if (!canvas || !player.pdf || !pageNumber) return;
    const page = await player.pdf.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const maxWidth = Math.max(260, canvas.parentElement.clientWidth - 10);
    const scale = (maxWidth / base.width) * (player.zoom || 1);
    const viewport = page.getViewport({ scale });
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    const context = canvas.getContext('2d');
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    await page.render({ canvasContext: context, viewport }).promise;
    if (label) label.textContent = `PDF ${pageNumber} / ${player.pdf.numPages}`;
  }

  function clearCanvas(card, canvasKey) {
    const canvas = card.querySelector(`[data-coop-canvas="${canvasKey}"]`);
    const label = card.querySelector(`[data-coop-label="${canvasKey}"]`);
    if (canvas) {
      canvas.width = 1;
      canvas.height = 1;
      canvas.style.width = '1px';
      canvas.style.height = '1px';
    }
    if (label) label.textContent = '';
  }

  function handleCoopPlayerClick(e) {
    const card = e.target.closest('[data-coop-player]');
    if (!card) return;
    const id = card.dataset.coopPlayer;
    const player = coopState.players[id];
    const actionTarget = e.target.closest('[data-coop-action]');
    const action = actionTarget?.dataset.coopAction;
    if (!action || !player) return;
    if (action === 'submit') submitCoopAnswer(id);
    if (action === 'next') proceedCoopPlayer(id);
    if (action === 'shuffle') reshuffleCoopPlayer(id);
    if (action === 'toggle-compact') {
      player.compact = !player.compact;
      renderCoop();
    }
    if (action === 'fill-candidate') fillCandidate(card, actionTarget);
    if (action === 'zoom-in') setZoom(id, Math.min(5, (player.zoom || 1) + .25));
    if (action === 'zoom-out') setZoom(id, Math.max(.7, (player.zoom || 1) - .1));
    if (action === 'zoom-fit') setZoom(id, 1);
    if (action === 'zoom-100') setZoom(id, 1);
    if (action === 'problem-prev') shiftPdfPage(id, 'questionOffset', -2);
    if (action === 'problem-next') shiftPdfPage(id, 'questionOffset', 2);
    if (action === 'answer-prev') shiftPdfPage(id, 'answerOffset', -2);
    if (action === 'answer-next') shiftPdfPage(id, 'answerOffset', 2);
  }

  function handleCoopPlayerInput(e) {
    const id = e.target.dataset.coopZoom;
    if (id) {
      setZoom(id, Number(e.target.value) / 100);
      return;
    }
    const input = e.target.closest('.coop-answer-input');
    const card = e.target.closest('[data-coop-player]');
    if (!input || !card) return;
    const player = coopState.players[card.dataset.coopPlayer];
    if (!player) return;
    player.draftAnswers[Number(input.dataset.answerIndex)] = input.value;
  }

  function setZoom(id, zoom) {
    coopState.players[id].zoom = zoom;
    renderCoop();
  }

  function shiftPdfPage(id, key, delta) {
    const player = coopState.players[id];
    const q = getCurrentQuestion(player);
    if (!q) return;
    const range = getPageRange(player, q, key === 'answerOffset' ? 'answer' : 'problem');
    const next = clamp((player[key] || 0) + delta, 0, Math.max(0, range.end - range.start));
    player[key] = next;
    renderCoop();
  }

  function fillCandidate(card, button) {
    const index = button.dataset.answerIndex;
    const input = card.querySelector(`.coop-answer-input[data-answer-index="${index}"]`);
    if (!input) return;
    input.value = button.dataset.value || '';
    const player = coopState.players[card.dataset.coopPlayer];
    if (player) player.draftAnswers[Number(index)] = input.value;
  }

  function submitCoopAnswer(id) {
    if (coopState.status !== 'playing') return;
    const player = coopState.players[id];
    if (!player || player.phase !== 'question') return;
    const q = getCurrentQuestion(player);
    const inputs = Array.from(document.querySelectorAll(`[data-coop-player="${id}"] .coop-answer-input`));
    const apiNormalize = window.DocumentModeAPI?.normalizeAnswer || (value => String(value || '').trim().toLowerCase());
    const submitted = inputs.map(input => apiNormalize(input.value));
    const empty = submitted.findIndex(value => !value);
    if (empty !== -1) {
      inputs[empty].focus();
      inputs[empty].classList.add('needs-input');
      setTimeout(() => inputs[empty].classList.remove('needs-input'), 1000);
      return;
    }
    player.answerResults = q.subQuestions.map((sub, index) => {
      const isCorrect = sub.answers.some(answer => apiNormalize(answer) === submitted[index]);
      return { range: sub.range, submitted: inputs[index].value.trim(), answers: sub.answers, isCorrect };
    });
    const correct = player.answerResults.every(result => result.isCorrect);
    player.lastCorrect = correct;
    player.phase = 'answer';
    player.draftAnswers = inputs.map(input => input.value);
    player.questionOffset = 0;
    player.answerOffset = 0;
    applyCoopResult(id, correct);
    syncCoopRoom();
    renderCoop();
  }

  function applyCoopResult(id, correct) {
    const p = coopState.players[id];
    p.floors++;
    coopState.teamFloors = coopState.players.A.floors + coopState.players.B.floors;
    let effectType = correct ? 'correct' : 'miss';
    if (correct) {
      p.correctStreak++;
      p.missStreak = 0;
      coopState.lastEvent = `${p.name} が正解しました。`;
      if (p.correctStreak >= RESCUE_CORRECT_STREAK) {
        coopState.teamMistakes = 0;
        ['A', 'B'].forEach(pid => {
          coopState.players[pid].totalMistakes = 0;
          coopState.players[pid].missStreak = 0;
        });
        p.correctStreak = 0;
        effectType = 'rescue';
        coopState.lastEvent = `${p.name} の8連続正解で全ミススタックを0にしました。`;
      }
    } else {
      p.correctStreak = 0;
      p.totalMistakes++;
      p.missStreak++;
      coopState.teamMistakes++;
      coopState.lastEvent = `${p.name} が不正解でした。`;
      if (checkCoopCollapse(id)) effectType = 'collapse';
    }
    checkCoopClear();
    if (coopState.status === 'cleared') effectType = 'clear';
    setLastAction(id, effectType, coopState.lastEvent);
    playCoopEffect(effectType === 'correct' ? 'own-correct' : effectType === 'miss' ? 'own-miss' : effectType, coopState.lastEvent);
  }

  function setLastAction(playerId, type, message) {
    coopState.lastAction = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      player: playerId,
      type,
      message,
    };
    coopState.lastSeenActionId = coopState.lastAction.id;
  }

  function checkCoopCollapse(lastPlayerId) {
    const p = coopState.players[lastPlayerId];
    let reason = null;
    if (coopState.teamMistakes >= COLLAPSE_TEAM_MISSES) {
      reason = `2人の通算ミスが${COLLAPSE_TEAM_MISSES}個に達したため、塔が倒壊しました。`;
    } else if (p.missStreak >= COLLAPSE_PLAYER_MISS_STREAK) {
      reason = `${p.name} の連続ミスが${COLLAPSE_PLAYER_MISS_STREAK}回に達したため、塔が倒壊しました。`;
    } else if (p.totalMistakes >= COLLAPSE_PLAYER_TOTAL_MISSES) {
      reason = `${p.name} の通算ミスが${COLLAPSE_PLAYER_TOTAL_MISSES}回に達したため、塔が倒壊しました。`;
    }
    if (!reason) return false;
    coopState.pendingCollapse = { player: lastPlayerId, reason };
    coopState.collapseCount++;
    coopState.lastEvent = `${reason} 解説確認後に自動復活します。`;
    return true;
  }

  function checkCoopClear() {
    if (coopState.teamFloors >= CLEAR_TEAM_FLOORS) {
      coopState.status = 'cleared';
      coopState.lastEvent = `2人の通算${CLEAR_TEAM_FLOORS}階到達でクリアです。`;
    }
    ['A', 'B'].forEach(id => {
      const p = coopState.players[id];
      if (p.floors >= CLEAR_SOLO_FLOORS) {
        coopState.status = 'cleared';
        coopState.lastEvent = `${p.name} が${CLEAR_SOLO_FLOORS}階に到達してクリアです。`;
      }
    });
  }

  function proceedCoopPlayer(id) {
    if (coopState.status === 'cleared') {
      renderCoop();
      return;
    }
    if (coopState.pendingCollapse) {
      reviveCoopTower();
      renderCoop();
      return;
    }
    const p = coopState.players[id];
    p.questionIndex = (p.questionIndex + 1) % Math.max(1, p.order.length);
    p.phase = 'question';
    p.answerResults = [];
    p.draftAnswers = [];
    p.lastCorrect = null;
    p.questionOffset = 0;
    p.answerOffset = 0;
    syncCoopRoom();
    renderCoop();
  }

  function reviveCoopTower() {
    coopState.pendingCollapse = null;
    coopState.status = 'playing';
    coopState.teamFloors = 0;
    coopState.teamMistakes = 0;
    ['A', 'B'].forEach(id => {
      const p = coopState.players[id];
      p.floors = 0;
      p.questionIndex = 0;
      p.phase = 'question';
      p.answerResults = [];
      p.draftAnswers = [];
      p.lastCorrect = null;
      p.totalMistakes = 0;
      p.missStreak = 0;
      p.correctStreak = 0;
      p.questionOffset = 0;
      p.answerOffset = 0;
    });
    coopState.lastEvent = '自動復活しました。A/Bとも第1階層から再開します。';
    syncCoopRoom();
  }

  function reshuffleCoopPlayer(id) {
    const p = coopState.players[id];
    if (!p || p.phase !== 'question') return;
    p.order = shuffledIndexes(p.questions.length);
    p.questionIndex = 0;
    p.floors = 0;
    p.answerResults = [];
    p.draftAnswers = [];
    p.lastCorrect = null;
    p.questionOffset = 0;
    p.answerOffset = 0;
    coopState.teamFloors = coopState.players.A.floors + coopState.players.B.floors;
    coopState.lastEvent = `${p.name} の問題順を再シャッフルしました。`;
    syncCoopRoom();
    renderCoop();
  }

  function playCoopEffect(type, message) {
    const layer = document.getElementById('coopEffectLayer');
    if (!layer) return;
    const effect = document.createElement('div');
    effect.className = `coop-effect is-${type || 'info'}`;
    effect.innerHTML = `
      <strong>${escapeHtml(effectTitle(type))}</strong>
      <span>${escapeHtml(message || '')}</span>
      <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
    `;
    layer.appendChild(effect);
    window.setTimeout(() => effect.remove(), 1800);
  }

  function effectTitle(type) {
    return {
      'own-correct': '自分が正解',
      'ally-correct': '味方が正解',
      'own-miss': '自分がミス',
      'ally-miss': '味方がミス',
      rescue: '連続正解ボーナス',
      collapse: '塔倒壊',
      clear: '塔攻略',
    }[type] || 'イベント';
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCoopMode);
  else initCoopMode();
})();

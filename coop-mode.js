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
    pendingCollapse: null,
    roomId: '',
    roomRef: null,
    unsubscribeRoom: null,
    firebaseStatus: '未接続',
    syncing: false,
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
      answerView: 'answer',
      answerResults: [],
      lastCorrect: null,
      floors: 0,
      totalMistakes: 0,
      missStreak: 0,
      correctStreak: 0,
      zoom: 1,
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
      <button id="btnCoopMode" class="btn-start btn-coop-start">
        <span>2人協力モード</span><span class="btn-arrow">→</span>
      </button>
    `);
  }

  function injectCoopScreen() {
    if (document.getElementById('screen-coop')) return;
    const clearScreen = document.getElementById('screen-clear') || document.body.lastElementChild;
    clearScreen.insertAdjacentHTML('beforebegin', `
      <div id="screen-coop" class="screen hidden">
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
              <h3>各プレイヤーが自分の攻略データを読み込む</h3>
              <p>Storageを使わない方針では、PDF/Excel本体はFirebaseに保存しません。AはA用、BはB用のPDF/Excelを自分の端末で選び、Firebaseには進行状況と採点結果だけを同期します。</p>
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
    const open = document.getElementById('btnCoopMode');
    if (open) open.addEventListener('click', openCoopMode);
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
    document.getElementById('btnCoopCreateRoom')?.addEventListener('click', createCoopRoom);
    document.getElementById('btnCoopJoinRoom')?.addEventListener('click', joinCoopRoomFromInput);
    document.getElementById('btnCoopResetRun')?.addEventListener('click', () => {
      resetCoopRun(true);
      syncCoopRoom();
      renderCoop();
    });
    document.getElementById('coopPlayers')?.addEventListener('click', handleCoopPlayerClick);
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
    document.getElementById('coopPlay').classList.toggle('hidden', !coopState.loaded);
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
      const input = document.getElementById('coopRoomId');
      const roomId = (input?.value || '').trim().toUpperCase();
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
      applyRemoteRoom(snapshot.data());
      renderCoop();
    }, error => setCoopRoomStatus(error.message));
  }

  function setCoopRoomStatus(text) {
    coopState.firebaseStatus = text;
    setText('coopRoomStatus', text);
  }

  function buildRoomPayload() {
    return {
      status: coopState.status,
      teamFloors: coopState.teamFloors,
      teamMistakes: coopState.teamMistakes,
      collapseCount: coopState.collapseCount,
      lastEvent: coopState.lastEvent,
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
      if (!local.questions.length) {
        local.questionIndex = Number(remote.questionIndex || 0);
        local.phase = remote.phase || local.phase;
      }
    });
  }

  async function syncCoopRoom() {
    if (!coopState.roomRef) return;
    coopState.syncing = true;
    try {
      await coopState.roomRef.set(buildRoomPayload(), { merge: true });
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
    const ready = readyPlayers.length > 0;
    document.getElementById('btnCoopStart')?.classList.toggle('hidden', !ready);
    const status = document.getElementById('coopLoadStatus');
    if (status) {
      status.textContent = ready
        ? `${readyPlayers.join(' / ')} の準備OKです。1台テストならA/B両方、Firebase本番なら自分の担当だけで開始します。`
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
      if (status) status.textContent = 'A/BのPDFとExcelを読み込んでいます...';
      const api = await waitForDocumentApi();
      var loadedCount = 0;
      for (const id of ['A', 'B']) {
        const player = coopState.players[id];
        if (!player.pdfFile || !player.excelFile) {
          player.pdf = null;
          player.questions = [];
          player.order = [];
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
        loadedCount++;
      }
      if (!loadedCount) throw new Error('PDFとExcelが読み込まれていません。');
      resetCoopRun(false);
      coopState.loaded = true;
      coopState.status = 'playing';
      coopState.lastEvent = '協力塔を開始しました。';
      syncCoopRoom();
      document.getElementById('coopSetup').classList.add('hidden');
      document.getElementById('coopPlay').classList.remove('hidden');
      renderCoop();
    } catch (error) {
      if (status) status.textContent = error.message;
    }
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
      if (reshuffle) p.order = shuffledIndexes(p.questions.length);
      p.questionIndex = 0;
      p.phase = 'question';
      p.answerView = 'answer';
      p.answerResults = [];
      p.lastCorrect = null;
      p.floors = 0;
      p.totalMistakes = 0;
      p.missStreak = 0;
      p.correctStreak = 0;
      p.zoom = p.zoom || 1;
    });
    coopState.lastEvent = reshuffle ? '最初からやり直しました。' : '';
  }

  function getCurrentQuestion(player) {
    const orderedIndex = player.order[player.questionIndex % Math.max(1, player.order.length)];
    return player.questions[orderedIndex];
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
    if (status) {
      status.textContent = coopState.status === 'cleared'
        ? 'CLEAR'
        : (coopState.pendingCollapse ? 'AUTO REVIVE' : 'PLAYING');
    }
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
    if (!player.questions.length || !player.pdf) {
      return `
        <section class="coop-player-card is-waiting" data-coop-player="${player.id}">
          <header class="coop-player-head">
            <div><span>Player ${player.id}</span><strong>${escapeHtml(player.name)}</strong></div>
          </header>
          <div class="coop-waiting-card">
            <strong>この端末では未読み込みです</strong>
            <p>Firebase本番では、相手の端末が自分用PDF/Excelを読み込み、進行状況だけがここに同期されます。</p>
          </div>
        </section>
      `;
    }
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
          <button type="button" class="coop-mini-btn" data-coop-action="shuffle">再シャッフル</button>
        </header>
        <div class="coop-player-stats">
          <div><span>階層</span><strong>${player.floors}F</strong></div>
          <div><span>通算ミス</span><strong>${player.totalMistakes}/${COLLAPSE_PLAYER_TOTAL_MISSES}</strong></div>
          <div><span>連続ミス</span><strong>${player.missStreak}/${COLLAPSE_PLAYER_MISS_STREAK}</strong></div>
          <div><span>連続正解</span><strong>${player.correctStreak}/${RESCUE_CORRECT_STREAK}</strong></div>
        </div>
        <div class="coop-question-bar">
          <strong>第${escapeHtml(String(q.questionNo))}問</strong>
          <span>${isAnswer ? '解答・解説PDF' : '問題PDF'}</span>
          <div class="coop-pdf-controls">
            <button type="button" data-coop-action="prev-page">←</button>
            <span id="coopPageLabel${player.id}">PDF</span>
            <button type="button" data-coop-action="next-page">→</button>
            <button type="button" data-coop-action="zoom-out">−</button>
            <span>${Math.round((player.zoom || 1) * 100)}%</span>
            <button type="button" data-coop-action="zoom-in">＋</button>
          </div>
        </div>
        <div class="coop-pdf-spread">
          <figure><canvas id="coopCanvas${player.id}L"></canvas><figcaption id="coopCanvas${player.id}LLabel"></figcaption></figure>
          <figure><canvas id="coopCanvas${player.id}R"></canvas><figcaption id="coopCanvas${player.id}RLabel"></figcaption></figure>
        </div>
        <aside class="coop-answer-panel">
          <div class="coop-answer-question">${isAnswer ? '解答・解説を確認してください。' : 'PDFを確認して回答してください。'}</div>
          <div class="coop-answer-inputs">
            ${q.subQuestions.map((sub, index) => `
              <label>
                <span>${escapeHtml(sub.range)}</span>
                <input class="coop-answer-input ${player.answerResults[index] ? (player.answerResults[index].isCorrect ? 'is-correct' : 'is-wrong') : ''}" data-answer-index="${index}" value="${escapeHtml(player.answerResults[index]?.submitted || '')}" ${isAnswer ? 'disabled' : ''}>
              </label>
            `).join('')}
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

  async function renderPlayerPdf(id) {
    const player = coopState.players[id];
    const q = getCurrentQuestion(player);
    if (!player.pdf || !q) return;
    const isAnswer = player.phase === 'answer';
    const left = isAnswer ? q.answerPage : q.questionStart;
    const max = isAnswer ? Math.min(player.pdf.numPages, q.answerEnd || q.answerPage + 1) : q.questionEnd;
    const right = left + 1 <= max ? left + 1 : null;
    setText(`coopPageLabel${id}`, `PDF ${left}${right ? '-' + right : ''}`);
    await renderPdfPage(player, `coopCanvas${id}L`, `coopCanvas${id}LLabel`, left);
    if (right) await renderPdfPage(player, `coopCanvas${id}R`, `coopCanvas${id}RLabel`, right);
    else clearCanvas(`coopCanvas${id}R`, `coopCanvas${id}RLabel`);
  }

  async function renderPdfPage(player, canvasId, labelId, pageNumber) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !player.pdf || !pageNumber) return;
    const page = await player.pdf.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const maxWidth = Math.max(260, canvas.parentElement.clientWidth - 10);
    const scale = (maxWidth / base.width) * (player.zoom || 1);
    const viewport = page.getViewport({ scale });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    setText(labelId, `PDF ${pageNumber} / ${player.pdf.numPages}`);
  }

  function clearCanvas(canvasId, labelId) {
    const canvas = document.getElementById(canvasId);
    if (canvas) {
      canvas.width = 1;
      canvas.height = 1;
    }
    setText(labelId, '');
  }

  function handleCoopPlayerClick(e) {
    const card = e.target.closest('[data-coop-player]');
    if (!card) return;
    const id = card.dataset.coopPlayer;
    const action = e.target.closest('[data-coop-action]')?.dataset.coopAction;
    if (!action) return;
    if (action === 'submit') submitCoopAnswer(id);
    if (action === 'next') proceedCoopPlayer(id);
    if (action === 'shuffle') reshuffleCoopPlayer(id);
    if (action === 'zoom-in') { coopState.players[id].zoom = Math.min(2.5, (coopState.players[id].zoom || 1) + .15); renderCoop(); }
    if (action === 'zoom-out') { coopState.players[id].zoom = Math.max(.7, (coopState.players[id].zoom || 1) - .15); renderCoop(); }
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
    applyCoopResult(id, correct);
    syncCoopRoom();
    renderCoop();
  }

  function applyCoopResult(id, correct) {
    const p = coopState.players[id];
    p.floors++;
    coopState.teamFloors = coopState.players.A.floors + coopState.players.B.floors;
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
        coopState.lastEvent = `${p.name} の8連続正解で全ミススタックを0にしました。`;
      }
    } else {
      p.correctStreak = 0;
      p.totalMistakes++;
      p.missStreak++;
      coopState.teamMistakes++;
      coopState.lastEvent = `${p.name} が不正解でした。`;
      checkCoopCollapse(id);
    }
    checkCoopClear();
  }

  function checkCoopCollapse(lastPlayerId) {
    const p = coopState.players[lastPlayerId];
    let reason = null;
    if (coopState.teamMistakes >= COLLAPSE_TEAM_MISSES) {
      reason = `2人の通算ミスが${COLLAPSE_TEAM_MISSES}個に達したため塔が倒壊しました。`;
    } else if (p.missStreak >= COLLAPSE_PLAYER_MISS_STREAK) {
      reason = `${p.name} の連続ミスが${COLLAPSE_PLAYER_MISS_STREAK}回に達したため塔が倒壊しました。`;
    } else if (p.totalMistakes >= COLLAPSE_PLAYER_TOTAL_MISSES) {
      reason = `${p.name} の通算ミスが${COLLAPSE_PLAYER_TOTAL_MISSES}回に達したため塔が倒壊しました。`;
    }
    if (!reason) return;
    coopState.pendingCollapse = { player: lastPlayerId, reason };
    coopState.collapseCount++;
    coopState.lastEvent = `${reason} 解説確認後に自動復活します。`;
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
    p.answerView = 'answer';
    p.answerResults = [];
    p.lastCorrect = null;
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
      p.lastCorrect = null;
      p.totalMistakes = 0;
      p.missStreak = 0;
      p.correctStreak = 0;
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
    p.lastCorrect = null;
    coopState.teamFloors = coopState.players.A.floors + coopState.players.B.floors;
    coopState.lastEvent = `${p.name} の問題順を再シャッフルしました。`;
    syncCoopRoom();
    renderCoop();
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCoopMode);
  else initCoopMode();
})();

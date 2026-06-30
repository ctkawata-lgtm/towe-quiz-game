'use strict';

(() => {
  const BOMBS = {
    grudge: { name: 'ギスギス爆弾', limit: 8, desc: '2連続で入ると追加+3', art: 'art-bomb-grudge', img: 'assets/bomb-escape/gisugisu-bomb.png' },
    roulette: { name: 'ドキドキ爆弾', limit: 8, desc: '0〜5のルーレット', art: 'art-bomb-roulette', img: 'assets/bomb-escape/dokidoki-bomb.png' },
    tiny: { name: 'チマチマ爆弾', limit: 5, desc: '+1だけ。小さいけど低耐久', art: 'art-bomb-tiny is-small', img: 'assets/bomb-escape/chimachima-bomb.png' },
  };

  const ROUTES = {
    tunnel: { name: 'ヒヤヒヤトンネル', goal: 10, desc: '+1。ミスが出ると0に戻る', art: 'art-route-tunnel', img: 'assets/bomb-escape/hiyahiya-tunnel.png' },
    bridge: { name: 'ハラハラブリッジ', goal: 20, desc: '-1〜5のランダム', art: 'art-route-bridge', img: 'assets/bomb-escape/harahara-bridge.png' },
    solo: { name: 'ソロソロロード', goal: 20, desc: '非連続+3、連続なら-5', art: 'art-route-solo', img: 'assets/bomb-escape/sorosoro-road.png' },
    forest: { name: 'ジワジワフォレスト', goal: 30, desc: '+1だけ。長い安全ルート', art: 'art-route-forest', img: 'assets/bomb-escape/jiwajiwa-forest.png' },
  };

  const CHOICES = ['\u25cb', '\u00d7', '\u30a2', '\u30a4', '\u30a6', '\u30a8', '\u30aa', '1', '2', '3', '4', '5'];

  let coopState = null;
  let escapeState = null;
  let unsubscribe = null;
  let syncing = false;
  let lastSeenEvent = '';
  let introAccepted = false;

  function createState() {
    return {
      status: 'playing',
      introSeen: false,
      bombs: { grudge: 0, roulette: 0, tiny: 0 },
      routes: { tunnel: 0, bridge: 0, solo: 0, forest: 0 },
      lastBomb: '',
      lastRoute: '',
      message: '出口は見えません。正解で脱出経路を進め、ミスで爆弾に火薬を入れます。',
      event: null,
      result: null,
      history: [],
      playerChoices: { A: { bombs: {}, routes: {} }, B: { bombs: {}, routes: {} } },
    };
  }

  function start(state) {
    coopState = state;
    escapeState = createState();
    introAccepted = false;
    attachRoom();
    resetPlayersForEscape();
    render();
    if (coopState.roomRef) {
      coopState.roomRef.get().then(snapshot => {
        const existing = snapshot.exists ? snapshot.data()?.bombEscape : null;
        if (existing) {
          escapeState = { ...createState(), ...existing };
          render();
        } else {
          sync();
        }
      }).catch(() => sync());
    } else {
      sync();
    }
  }

  function onRoomData(data) {
    if (!data?.bombEscape || syncing) return;
    escapeState = { ...createState(), ...data.bombEscape };
    escapeState.history = Array.isArray(escapeState.history) ? escapeState.history : [];
    escapeState.playerChoices = escapeState.playerChoices || { A: { bombs: {}, routes: {} }, B: { bombs: {}, routes: {} } };
    playRemoteNotice(escapeState.event);
    render();
  }

  function attachRoom() {
    if (unsubscribe) unsubscribe();
    if (!coopState?.roomRef) return;
    unsubscribe = coopState.roomRef.onSnapshot(snapshot => {
      if (!snapshot.exists || syncing) return;
      onRoomData(snapshot.data());
    });
  }

  function resetPlayersForEscape() {
    ['A', 'B'].forEach(id => {
      const p = coopState.players[id];
      if (!p) return;
      p.phase = p.questions?.length ? 'question' : 'remote';
      p.answerResults = [];
      p.draftAnswers = [];
      p.questionOffset = 0;
      p.answerOffset = 0;
      p.zoom = p.zoom || 2;
    });
  }

  async function sync() {
    if (!coopState?.roomRef || !escapeState) return;
    syncing = true;
    try {
      await coopState.roomRef.set({ bombEscape: escapeState, activeMode: 'escape', status: escapeState.status }, { merge: true });
    } finally {
      syncing = false;
    }
  }

  function render() {
    const panel = document.querySelector('#coopPlay .coop-team-panel');
    const main = document.getElementById('coopPlayers');
    if (!panel || !main || !coopState || !escapeState) return;
    clearFloatingAnswerLayer();
    panel.classList.add('bomb-escape-panel');
    panel.innerHTML = renderPanel();
    main.className = 'bomb-escape-main';
    main.innerHTML = renderMain();
    portalAnswerPanels();
    ['A', 'B'].forEach(renderPdf);
  }

  function renderPanel() {
    const routeRows = Object.values(ROUTES).map(route => {
      return `<div class="escape-meter is-hidden"><span>${route.name}</span><strong>進行度非表示</strong></div>`;
    }).join('');
    return `
      <div class="escape-panel-title">ESCAPE</div>
      <div class="escape-secret-box">
        <span>爆弾状態</span>
        <strong>???</strong>
        <small>種類も蓄積量も非表示</small>
      </div>
      <div class="escape-routes">${routeRows}</div>
      <div class="coop-event-log">${escapeState.message || ''}</div>
      <button class="coop-mini-btn" type="button" data-escape-action="reset">同じ問題セットで再スタート</button>
    `;
  }

  function renderMain() {
    if (escapeState.result) return renderResult();
    if (!introAccepted) return renderIntro();
    const primary = primaryPlayerId();
    const ordered = [primary, ...['A', 'B'].filter(id => id !== primary)];
    return ordered.map((id, index) => renderPlayer(coopState.players[id], index > 0)).join('');
  }

  function renderIntro() {
    return `
      <section class="escape-intro">
        <div class="escape-intro-kicker">BOMB ESCAPE</div>
        <h3>爆弾＆脱出モード</h3>
        <p>あなたたちは今、施設の奥深くに閉じ込められている。</p>
        <p>出口は見えない。でも、道はある。</p>
        <p>問題に正解するたびに、脱出経路のどれかを選んで前へ進める。4つの経路はチームで共有されている。どれを選ぶかはあなた次第だ。</p>
        <p><strong>ヒヤヒヤトンネル</strong>は最短ルートだが、誰かがミスした瞬間に崩落する。また最初からだ。<strong>ハラハラブリッジ</strong>は足場が不安定で、踏み出すたびに前に進むか後退するかわからない。<strong>ソロソロロード</strong>は慎重に一歩ずつ進む道。ただし焦って連続で同じ道を選ぶと、道が崩れて大きく引き戻される。<strong>ジワジワフォレスト</strong>は罠も近道もない、ただひたすらに続く森の道だ。正解し続けるしかない。それだけだ。</p>
        <p>一方、ミスをするたびに爆弾のどれかに火薬が詰まっていく。3種類の爆弾が施設のどこかに仕掛けられている。<strong>ギスギス爆弾</strong>は同じ爆弾に連続で火薬を詰めると一気に危険になる。<strong>ドキドキ爆弾</strong>は詰まる量が毎回違う。<strong>チマチマ爆弾</strong>は一度に増える量は少ないが、容量が小さい。</p>
        <p>どの爆弾にどれだけ火薬が溜まっているか、あなたには見えない。相手が何を選んでいるかも、見えない。</p>
        <p>爆弾が限界を超えたら、終わりだ。</p>
        <p>脱出できるか。それとも——。</p>
        <button class="coop-submit" type="button" data-escape-action="intro-next">次へ</button>
      </section>
    `;
  }

  function primaryPlayerId() {
    const playable = ['A', 'B'].filter(id => isPlayable(coopState.players[id]));
    if (playable.length === 1) return playable[0];
    if (playable.includes('B') && !coopState.players.A?.pdf) return 'B';
    return playable[0] || 'A';
  }

  function renderPlayer(player, sidePanel = false) {
    if (sidePanel) return renderSidePlayer(player);
    if (!isPlayable(player)) return renderRemotePlayer(player);
    const q = currentQuestion(player);
    if (!q) return `<section class="escape-player-card">問題がありません。</section>`;
    if (player.phase === 'bomb-choice') return renderChoice(player, q, 'bomb');
    if (player.phase === 'route-choice') return renderChoice(player, q, 'route');
    const isAnswer = player.phase === 'answer';
    return `
      <section class="escape-player-card" data-escape-player="${player.id}">
        <header class="escape-player-head">
          <div><span>Player ${player.id}</span><strong>${escape(player.name)}</strong></div>
          <button class="coop-mini-btn" type="button" data-escape-action="shuffle">シャッフル</button>
        </header>
        <div class="escape-question-bar">
          <strong>第${escape(String(q.questionNo))}問</strong>
          <span>${isAnswer ? '解説確認中' : '問題PDF'}</span>
        </div>
        <div class="escape-pdf-wrap">
          <figure><canvas data-escape-canvas="problem"></canvas><figcaption data-escape-label="problem"></figcaption></figure>
          ${isAnswer ? '<figure><canvas data-escape-canvas="answer"></canvas><figcaption data-escape-label="answer"></figcaption></figure>' : ''}
        </div>
        <aside class="coop-answer-panel escape-answer-panel" data-escape-player="${player.id}" style="${answerPanelStyle(player)}">
          <div class="escape-answer-drag" data-escape-drag="answer-panel" title="ドラッグして回答欄を動かせます">↕ 回答パネル</div>
          <div class="escape-answer-edge-drag is-left" data-escape-drag="answer-panel" title="ドラッグして回答欄を動かせます"></div>
          <div class="escape-answer-edge-drag is-right" data-escape-drag="answer-panel" title="ドラッグして回答欄を動かせます"></div>
          <div class="coop-answer-inputs">
            ${q.subQuestions.map((sub, index) => renderInput(player, sub, index, isAnswer)).join('')}
          </div>
          ${isAnswer ? '<button class="coop-submit" type="button" data-escape-action="next">次の問題へ</button>' : '<button class="coop-submit" type="button" data-escape-action="submit">採点する</button>'}
          <div class="escape-answer-drag is-bottom" data-escape-drag="answer-panel" title="ドラッグして回答欄を動かせます">↕ 移動</div>
        </aside>
      </section>
    `;
  }

  function renderSidePlayer(player) {
    const q = currentQuestion(player);
    const phaseText = player?.phase === 'bomb-choice' ? '爆弾選択中'
      : player?.phase === 'route-choice' ? '経路選択中'
      : player?.phase === 'answer' ? '解説確認中'
      : isPlayable(player) ? '問題回答中'
      : 'この端末では未読み込み';
    return `
      <section class="escape-player-card is-side-panel" data-escape-player="${player?.id || ''}">
        <header class="escape-player-head">
          <div><span>Player ${escape(player?.id || '-')}</span><strong>${escape(player?.name || '-')}</strong></div>
        </header>
        <div class="escape-side-body">
          <span>相手画面</span>
          <strong>${escape(phaseText)}</strong>
          <small>${q ? `第${escape(String(q.questionNo))}問` : '問題情報なし'}</small>
          <p>相手の選択内容と爆弾・経路の進捗は表示されません。</p>
        </div>
      </section>
    `;
  }

  function renderRemotePlayer(player) {
    return `
      <section class="escape-player-card is-remote" data-escape-player="${player.id}">
        <header class="escape-player-head"><div><span>Player ${player.id}</span><strong>${escape(player.name)}</strong></div></header>
        <div class="escape-remote-body">この端末ではPDF/Excel未読み込みです。</div>
      </section>
    `;
  }

  function renderInput(player, sub, index, disabled) {
    const result = player.answerResults?.[index];
    const value = result?.submitted ?? player.draftAnswers?.[index] ?? '';
    return `
      <label>
        <span>${escape(sub.range)}</span>
        <input class="coop-answer-input ${result ? (result.isCorrect ? 'is-correct' : 'is-wrong') : ''}" data-answer-index="${index}" value="${escape(value)}" ${disabled ? 'disabled' : ''}>
        ${disabled ? '' : `<div class="coop-candidates">${CHOICES.map(choice => `<button class="coop-candidate-chip" type="button" data-escape-action="candidate" data-answer-index="${index}" data-value="${choice}">${choice}</button>`).join('')}</div>`}
      </label>
    `;
  }

  function renderChoice(player, q, type) {
    const items = type === 'bomb' ? BOMBS : ROUTES;
    const title = type === 'bomb' ? 'どの爆弾に火薬を入れますか？' : 'どの脱出経路を進めますか？';
    return `
      <section class="escape-player-card" data-escape-player="${player.id}">
        <header class="escape-player-head"><div><span>Player ${player.id}</span><strong>${escape(player.name)}</strong></div></header>
        <div class="escape-choice-title">${title}</div>
        <div class="escape-choice-grid">
          ${Object.entries(items).map(([key, item]) => `
            <button class="escape-choice-card ${type === 'bomb' ? 'is-bomb' : 'is-route'}" type="button" data-escape-action="${type}" data-key="${key}">
              <span class="escape-art ${item.art}">
                <img src="${item.img}" alt="${item.name}">
              </span>
              <strong>${item.name}</strong>
              <small>${item.desc}</small>
            </button>
          `).join('')}
        </div>
      </section>
    `;
  }

  function renderResult() {
    return `
      <section class="escape-result">
        <h3>${escapeState.result.type === 'clear' ? '脱出成功' : '爆発しました'}</h3>
        <p>${escape(escapeState.result.message)}</p>
        <div class="escape-result-grid">
          ${renderFinalValues()}
          ${renderChoiceSummary()}
        </div>
        <div class="escape-history">
          <h4>各解答後の選択履歴</h4>
          ${renderHistory()}
        </div>
        <button class="coop-submit" type="button" data-escape-action="reset">同じ問題セットで再スタート</button>
      </section>
    `;
  }

  function renderFinalValues() {
    const bombs = Object.entries(BOMBS).map(([key, bomb]) => `<li><span>${bomb.name}</span><strong>${escapeState.bombs[key] || 0}/${bomb.limit}</strong></li>`).join('');
    const routes = Object.entries(ROUTES).map(([key, route]) => `<li><span>${route.name}</span><strong>${escapeState.routes[key] || 0}/${route.goal}</strong></li>`).join('');
    return `
      <div class="escape-result-box"><h4>爆弾の最終値</h4><ul>${bombs}</ul></div>
      <div class="escape-result-box"><h4>脱出経路の最終値</h4><ul>${routes}</ul></div>
    `;
  }

  function renderChoiceSummary() {
    return ['A', 'B'].map(id => {
      const choices = escapeState.playerChoices?.[id] || { bombs: {}, routes: {} };
      const bombs = Object.entries(BOMBS).map(([key, bomb]) => `${bomb.name}: ${choices.bombs?.[key] || 0}`).join(' / ');
      const routes = Object.entries(ROUTES).map(([key, route]) => `${route.name}: ${choices.routes?.[key] || 0}`).join(' / ');
      return `<div class="escape-result-box"><h4>Player ${id} 選択回数</h4><p>${escape(bombs)}</p><p>${escape(routes)}</p></div>`;
    }).join('');
  }

  function renderHistory() {
    if (!escapeState.history?.length) return '<p>履歴はありません。</p>';
    return `
      <ol>
        ${escapeState.history.map(item => `
          <li>
            <span>Player ${escape(item.player)} / 第${escape(String(item.questionNo || '-'))}問</span>
            <strong>${escape(item.resultLabel)} → ${escape(item.choiceName)}</strong>
            <small>${escape(item.publicNote || '')}</small>
          </li>
        `).join('')}
      </ol>
    `;
  }

  function bindClick(e) {
    const actionEl = e.target.closest('[data-escape-action]');
    if (!actionEl) return;
    const card = e.target.closest('[data-escape-player]');
    const player = card ? coopState.players[card.dataset.escapePlayer] : null;
    const action = actionEl.dataset.escapeAction;
    if (action === 'submit' && player) submit(player);
    if (action === 'next' && player) next(player);
    if (action === 'candidate' && player) fillCandidate(card, actionEl, player);
    if (action === 'bomb' && player) chooseBomb(player, actionEl.dataset.key);
    if (action === 'route' && player) chooseRoute(player, actionEl.dataset.key);
    if (action === 'shuffle' && player) shufflePlayer(player);
    if (action === 'reset') restart();
    if (action === 'intro-next') continueIntro();
  }

  function bindInput(e) {
    const input = e.target.closest('.coop-answer-input');
    const card = e.target.closest('[data-escape-player]');
    if (!input || !card) return;
    const player = coopState.players[card.dataset.escapePlayer];
    player.draftAnswers[Number(input.dataset.answerIndex)] = input.value;
  }

  document.addEventListener('click', e => {
    if (document.getElementById('screen-coop')?.classList.contains('hidden')) return;
    bindClick(e);
  });
  document.addEventListener('input', bindInput);
  document.addEventListener('pointerdown', e => {
    if (e.target.closest('.coop-candidate-chip')) e.preventDefault();
  });
  document.addEventListener('pointerdown', startDragAnswerPanel);

  function clearFloatingAnswerLayer() {
    document.getElementById('escapeFloatingAnswerLayer')?.remove();
  }

  function portalAnswerPanels() {
    const panels = Array.from(document.querySelectorAll('.escape-answer-panel'));
    if (!panels.length) return;
    const layer = document.createElement('div');
    layer.id = 'escapeFloatingAnswerLayer';
    layer.className = 'escape-floating-answer-layer';
    panels.forEach(panel => layer.appendChild(panel));
    document.body.appendChild(layer);
  }

  function submit(player) {
    if (escapeState.status !== 'playing') return;
    const q = currentQuestion(player);
    const inputs = Array.from(document.querySelectorAll(`[data-escape-player="${player.id}"] .coop-answer-input`));
    const norm = window.DocumentModeAPI?.normalizeAnswer || (value => String(value || '').trim().toLowerCase());
    const submitted = inputs.map(input => norm(input.value));
    const empty = submitted.findIndex(value => !value);
    if (empty !== -1) {
      inputs[empty].focus();
      return;
    }
    player.answerResults = q.subQuestions.map((sub, index) => {
      const isCorrect = sub.answers.some(answer => norm(answer) === submitted[index]);
      return { range: sub.range, submitted: inputs[index].value.trim(), isCorrect };
    });
    const correct = player.answerResults.every(result => result.isCorrect);
    player.phase = correct ? 'route-choice' : 'bomb-choice';
    player.draftAnswers = inputs.map(input => input.value);
    escapeState.message = correct ? '正解しました。進める脱出経路を選んでください。' : 'ミスしました。火薬を入れる爆弾を選んでください。';
    render();
  }

  function chooseBomb(player, key) {
    const bomb = BOMBS[key];
    let add = 1;
    let note = '';
    if (key === 'grudge' && escapeState.lastBomb === key) {
      add = 4;
      note = '2連続でギスギス爆弾に入り、追加火薬が発生しました。';
    }
    if (key === 'roulette') {
      add = Math.floor(Math.random() * 6);
      note = `ドキドキ爆弾のルーレットは ${add} でした。`;
    }
    escapeState.bombs[key] = (escapeState.bombs[key] || 0) + add;
    escapeState.lastBomb = key;
    countChoice(player.id, 'bombs', key);
    resetFragileRoute(player.id);
    const over = escapeState.bombs[key] >= bomb.limit;
    addHistory(player, 'miss', bomb.name, note);
    escapeState.message = over ? '何かが限界に達しました。' : 'ミス処理を完了しました。';
    publishEvent(player.id, 'miss', '味方がミスしました。どの爆弾に入れたかは不明です。');
    if (over) finish('over', `${bomb.name}が爆発したためゲームオーバー`);
    player.phase = 'answer';
    sync();
    render();
  }

  function chooseRoute(player, key) {
    const route = ROUTES[key];
    let add = 1;
    let note = '';
    if (key === 'bridge') {
      add = Math.floor(Math.random() * 7) - 1;
      note = add < 0 ? '足場が崩れて少し後退しました。' : `橋の進行は +${add} でした。`;
    }
    if (key === 'solo') {
      add = escapeState.lastRoute === key ? -5 : 3;
      note = add < 0 ? '同じ道が連続して崩れました。' : '静かに大きく前進しました。';
    }
    if (key === 'forest') add = 1;
    if (key === 'tunnel') add = 1;
    escapeState.routes[key] = Math.max(0, (escapeState.routes[key] || 0) + add);
    escapeState.lastRoute = key;
    countChoice(player.id, 'routes', key);
    const clear = escapeState.routes[key] >= route.goal;
    addHistory(player, 'correct', route.name, note);
    escapeState.message = clear ? 'どこかの経路が開通しました。' : '脱出経路を進めました。';
    publishEvent(player.id, 'correct', '味方が正解しました。どの経路を進めたかは不明です。');
    if (clear) finish('clear', `${route.name}の経路を進み脱出した　ゲームクリア！`);
    player.phase = 'answer';
    sync();
    render();
  }

  function resetFragileRoute(playerId) {
    if ((escapeState.routes.tunnel || 0) > 0) {
      escapeState.routes.tunnel = 0;
      publishEvent(playerId, 'tunnel-reset', 'ヒヤヒヤトンネルが崩落し、進行が0に戻りました。');
    }
  }

  function finish(type, message) {
    escapeState.status = type === 'clear' ? 'cleared' : 'over';
    escapeState.result = { type, message };
  }

  function continueIntro() {
    escapeState.introSeen = true;
    introAccepted = true;
    render();
  }

  function next(player) {
    if (escapeState.result) return;
    player.questionIndex = (player.questionIndex + 1) % Math.max(1, player.order.length);
    player.phase = 'question';
    player.answerResults = [];
    player.draftAnswers = [];
    sync();
    render();
  }

  function shufflePlayer(player) {
    player.order = shuffle(player.questions.length);
    player.questionIndex = 0;
    player.phase = 'question';
    player.answerResults = [];
    player.draftAnswers = [];
    sync();
    render();
  }

  function restart() {
    escapeState = createState();
    resetPlayersForEscape();
    sync();
    render();
  }

  function countChoice(playerId, type, key) {
    const bucket = escapeState.playerChoices[playerId]?.[type] || {};
    bucket[key] = (bucket[key] || 0) + 1;
    escapeState.playerChoices[playerId][type] = bucket;
  }

  function addHistory(player, result, choiceName, publicNote) {
    const q = currentQuestion(player);
    escapeState.history.push({
      player: player.id,
      questionNo: q?.questionNo || '',
      result,
      resultLabel: result === 'correct' ? '正解' : 'ミス',
      choiceName,
      publicNote: publicNote || '',
    });
  }

  function publishEvent(playerId, type, message) {
    escapeState.event = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      player: playerId,
      type,
      message,
    };
  }

  function playRemoteNotice(event) {
    if (!event?.id || event.id === lastSeenEvent) return;
    lastSeenEvent = event.id;
    if (isPlayable(coopState.players[event.player])) return;
    escapeState.message = event.message;
  }

  async function renderPdf(id) {
    const player = coopState.players[id];
    const card = document.querySelector(`[data-escape-player="${id}"]`);
    const q = currentQuestion(player);
    if (!card || !player?.pdf || !q) return;
    await renderPage(player, card, 'problem', q.questionStart);
    if (player.phase === 'answer') await renderPage(player, card, 'answer', q.answerPage);
  }

  async function renderPage(player, card, key, pageNumber) {
    const canvas = card.querySelector(`[data-escape-canvas="${key}"]`);
    const label = card.querySelector(`[data-escape-label="${key}"]`);
    if (!canvas || !pageNumber) return;
    const page = await player.pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.6 });
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    const context = canvas.getContext('2d');
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    await page.render({ canvasContext: context, viewport }).promise;
    if (label) label.textContent = `PDF ${pageNumber}`;
  }

  function currentQuestion(player) {
    if (!player?.questions?.length) return null;
    const orderedIndex = player.order[player.questionIndex % Math.max(1, player.order.length)];
    return player.questions[orderedIndex];
  }

  function isPlayable(player) {
    return Boolean(player?.pdf && player.questions?.length);
  }

  function fillCandidate(card, button, player) {
    const index = button.dataset.answerIndex;
    const input = card.querySelector(`.coop-answer-input[data-answer-index="${index}"]`);
    if (!input) return;
    input.value = button.dataset.value || '';
    player.draftAnswers[Number(index)] = input.value;
  }

  function answerPanelStyle(player) {
    const pos = player.escapeAnswerPanel;
    if (!pos) return '';
    return `--answer-left:${Number(pos.left) || 24}px;--answer-top:${Number(pos.top) || 120}px;`;
  }

  function startDragAnswerPanel(e) {
    const handle = e.target.closest('[data-escape-drag="answer-panel"]');
    if (!handle) return;
    const panel = handle.closest('.escape-answer-panel');
    const card = handle.closest('[data-escape-player]');
    if (!card || !panel) return;
    const player = coopState?.players?.[card.dataset.escapePlayer];
    if (!player) return;
    e.preventDefault();
    handle.setPointerCapture?.(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const rect = panel.getBoundingClientRect();
    const base = { left: rect.left, top: rect.top };
    const move = event => {
      const maxLeft = Math.max(8, window.innerWidth - panel.offsetWidth - 8);
      const maxTop = Math.max(8, window.innerHeight - Math.min(panel.offsetHeight, window.innerHeight - 16) - 8);
      player.escapeAnswerPanel = {
        left: clamp((Number(base.left) || 0) + event.clientX - startX, 8, maxLeft),
        top: clamp((Number(base.top) || 0) + event.clientY - startY, 8, maxTop),
      };
      panel.style.setProperty('--answer-left', `${player.escapeAnswerPanel.left}px`);
      panel.style.setProperty('--answer-top', `${player.escapeAnswerPanel.top}px`);
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      handle.releasePointerCapture?.(e.pointerId);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop, { once: true });
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function shuffle(length) {
    const arr = Array.from({ length }, (_, index) => index);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  window.BombEscapeMode = { start, onRoomData };
})();

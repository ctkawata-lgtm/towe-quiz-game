/**
 * 塔の試練 Phase 1 - script.js
 * 塔昇降アニメ + コイン + ショップ（盾・降下軽減・選択肢削減）
 */

'use strict';

// ===================================================
//  定数
// ===================================================
const TOTAL_FLOORS = 50;

const MILESTONE_COMBOS   = [3, 5, 10, 20, 30, 40, 50];
const MILESTONE_BONUSES  = { 3:300, 5:500, 10:1500, 20:3000, 30:5000, 40:8000, 50:10000 };
const MILESTONE_MESSAGES = {
  3:  '3連続突破！',
  5:  '5連続突破！',
  10: '10階層突破！',
  20: '20階層突破！！',
  30: '30階層突破！！！',
  40: '残り10！塔の頂が見える！',
  50: '塔を完全踏破！！！'
};

// コイン獲得量
const COIN_PER_CORRECT = 5;    // 正解ごと
const COIN_COMBO_BONUS = { 3:10, 5:15, 10:30, 20:60, 30:100, 40:150, 50:200 };

const LS_KEY = 'towerQuiz_v2_records';
const FX_COLORS = {
  correct: ['rgba(48,224,144,.98)', 'rgba(61,214,192,.34)'],
  wrong:   ['rgba(224,48,80,.98)',  'rgba(255,122,92,.34)'],
  combo:   ['rgba(240,208,112,1)',  'rgba(224,48,80,.36)'],
  rise:    ['rgba(255,255,255,.96)', 'rgba(48,224,144,.38)'],
  fall:    ['rgba(255,90,96,.98)',  'rgba(224,48,80,.4)'],
};

// ===================================================
//  ショップ定義
//  levels: 各レベルの { cost, desc, value }
// ===================================================
const SHOP_ITEMS = [
  {
    id:    'shield',
    icon:  '🛡',
    name:  '鉄壁の盾',
    baseDesc: '不正解時に1問目へ戻らず耐える回数を増やします',
    levels: [
      { cost: 30,  desc: '1回まで耐える',  value: 1 },
      { cost: 80,  desc: '2回まで耐える',  value: 2 },
      { cost: 150, desc: '3回まで耐える',  value: 3 },
    ]
  },
  {
    id:    'descent',
    icon:  '🪂',
    name:  '重力軽減',
    baseDesc: '不正解時の降下階数を減らします（盾が壊れたときに発動）',
    levels: [
      { cost: 40,  desc: '誤答時に30階降下', value: 30 },
      { cost: 100, desc: '誤答時に20階降下', value: 20 },
      { cost: 200, desc: '誤答時に10階降下', value: 10 },
    ]
  },
  {
    id:    'choicecut',
    icon:  '✂️',
    name:  '消去の刃',
    baseDesc: '次の4択問題で不正解の選択肢を消去します（1問1回使い切り）',
    levels: [
      { cost: 20,  desc: '不正解1択を消す',  value: 1 },
      { cost: 50,  desc: '不正解2択を消す',  value: 2 },
    ]
  },
];

// ===================================================
//  状態管理
// ===================================================
let questions  = [];
let goalFloors = TOTAL_FLOORS;

/** ゲームセッション */
let gs = {
  currentIndex:    0,
  combo:           0,     // 現在の連続正解数
  score:           0,
  missCount:       0,
  answered:        false,
  selectedChoices: [],    // multiple_choice 選択中番号

  // コイン
  coins:           0,
  totalCoinsEarned: 0,

  // アイテム所持状態
  shieldLevel:     0,   // 0=未購入, 1〜3=レベル
  shieldHp:        0,   // 現在の残耐久
  descentLevel:    0,
  choicecutLevel:  0,   // 0=未購入, 1〜2=レベル
  choicecutReady:  false, // 次の問題で発動するか
};

/** 永続記録 */
let records = {
  bestFloor:    0,
  bestCombo:    0,
  totalCorrect: 0,
  totalMiss:    0,
  bestScore:    0,
  playCount:    0,
};

// ===================================================
//  localStorage
// ===================================================
function loadRecords() {
  try {
    const s = localStorage.getItem(LS_KEY);
    if (s) records = Object.assign(records, JSON.parse(s));
  } catch(e) { console.warn('記録読込失敗', e); }
}
function saveRecords() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(records)); }
  catch(e) { console.warn('記録保存失敗', e); }
}
function resetRecords() {
  if (!confirm('すべての記録をリセットしますか？')) return;
  records = { bestFloor:0, bestCombo:0, totalCorrect:0, totalMiss:0, bestScore:0, playCount:0 };
  saveRecords();
  renderTitleRecords();
}

// ===================================================
//  CSVパーサー（ダブルクォート対応）
// ===================================================
function parseCSV(text) {
  const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
  return lines.filter(l => l.trim()).map(parseCsvRow);
}

function parseCsvRow(line) {
  const cols = []; let inQ = false; let cur = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') { if (line[i+1]==='"') { cur+='"'; i++; } else { inQ=false; } }
      else cur += c;
    } else {
      if (c==='"') { inQ=true; }
      else if (c===',') { cols.push(cur); cur=''; }
      else cur += c;
    }
  }
  cols.push(cur);
  return cols;
}

// ===================================================
//  CSVバリデーション
// ===================================================
const REQUIRED_HEADERS = ['id','type','question','choice1','choice2','choice3','choice4','answer','explanation','category','image'];
const OPTIONAL_HEADERS = ['choice5'];
const HEADER_ALIASES = {
  id: ['id', 'ID'],
  type: ['type', '形式', '問題形式'],
  question: ['question', '問題'],
  choice1: ['choice1', '選択肢1', '選択肢１'],
  choice2: ['choice2', '選択肢2', '選択肢２'],
  choice3: ['choice3', '選択肢3', '選択肢３'],
  choice4: ['choice4', '選択肢4', '選択肢４'],
  choice5: ['choice5', '選択肢5', '選択肢５'],
  answer: ['answer', '正解の選択肢', '正解'],
  explanation: ['explanation', '全体の解説', '全体解説'],
  category: ['category', 'カテゴリ', 'カテゴリー'],
  image: ['image', '画像'],
  choiceExplanation1: ['choice1_explanation', '選択肢1の解説', '選択肢１の解説', '1の解説', '１の解説'],
  choiceExplanation2: ['choice2_explanation', '選択肢2の解説', '選択肢２の解説', '2の解説', '２の解説'],
  choiceExplanation3: ['choice3_explanation', '選択肢3の解説', '選択肢３の解説', '3の解説', '３の解説'],
  choiceExplanation4: ['choice4_explanation', '選択肢4の解説', '選択肢４の解説', '4の解説', '４の解説'],
  choiceExplanation5: ['choice5_explanation', '選択肢5の解説', '選択肢５の解説', '5の解説', '５の解説'],
};
const VALID_TYPES = ['single_choice','multiple_choice','fill_blank'];

function validateAndConvertCSV(raw) {
  const errors = [];
  if (!raw.length) return { errors: ['CSVが空です。'], questions: [] };

  const hdr = raw[0].map(h => h.trim());
  const idx = buildHeaderIndex(hdr);

  for (const col of REQUIRED_HEADERS) {
    if (idx[col] == null && !['id','type','category','image'].includes(col)) {
      errors.push(`「${HEADER_ALIASES[col][0]}」列が見つかりません`);
    }
  }
  if (errors.length) return { errors, questions: [] };

  const dataRows = raw.slice(1);
  if (!dataRows.length) return { errors: ['CSVにデータ行がありません。'], questions: [] };

  const parsed = [];
  dataRows.forEach((row, rn) => {
    const ln  = rn + 2;
    const get = col => idx[col] == null ? '' : (row[idx[col]] || '').trim();
    const type = normalizeQuestionType(get('type')) || 'single_choice';
    const question = get('question');
    const answer = normalizeAnswer(get('answer'));

    if (!VALID_TYPES.includes(type)) {
      errors.push(`${ln}行目のtype「${type||'(空)'}」が不正です`); return;
    }
    if (!answer) { errors.push(`${ln}行目のanswerが空です`); return; }

    const choices = ['choice1','choice2','choice3','choice4','choice5']
      .map(col => get(col))
      .filter(Boolean);
    const choiceExplanations = [1,2,3,4,5].map(n => get(`choiceExplanation${n}`));

    if (type==='single_choice'||type==='multiple_choice') {
      if (choices.length < 4) {
        errors.push(`${ln}行目の選択肢は4個以上必要です`);
      }
      if (choices.length > 5) {
        errors.push(`${ln}行目の選択肢は最大5個までです`);
      }
    }
    if (type==='single_choice' && !isValidChoiceAnswer(answer, choices.length)) {
      errors.push(`${ln}行目のanswerは1〜${choices.length}の数字にしてください`); return;
    }
    if (type==='multiple_choice' && !isValidChoiceAnswer(answer, choices.length, true)) {
      errors.push(`${ln}行目のanswerは1|3の形式で、1〜${choices.length}の数字にしてください`); return;
    }
    if (type==='fill_blank' && !question.includes('【blank】')) {
      errors.push(`${ln}行目の穴埋め問題に【blank】がありません`); return;
    }

    parsed.push({
      id:get('id'), type, question, choices, answer,
      explanation:get('explanation'),
      choiceExplanations,
      category:get('category'),
    });
  });

  return { errors, questions: parsed };
}

function buildHeaderIndex(headers) {
  const normalized = headers.map(normalizeHeader);
  const idx = {};
  Object.entries(HEADER_ALIASES).forEach(([key, aliases]) => {
    const candidates = aliases.map(normalizeHeader);
    const found = normalized.findIndex(h => candidates.includes(h));
    if (found !== -1) idx[key] = found;
  });
  return idx;
}

function normalizeHeader(s) {
  return String(s || '').trim().replace(/\s+/g, '').toLowerCase();
}

function normalizeQuestionType(type) {
  const t = String(type || '').trim();
  const map = {
    '単一選択': 'single_choice',
    '単一': 'single_choice',
    '4択': 'single_choice',
    '5択': 'single_choice',
    '選択': 'single_choice',
    '複数選択': 'multiple_choice',
    '複数': 'multiple_choice',
    '穴埋め': 'fill_blank',
  };
  return map[t] || t;
}

function normalizeAnswer(answer) {
  return String(answer || '')
    .trim()
    .replace(/\u3000/g, ' ')
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0)-0xFEE0))
    .replace(/選択肢/g, '')
    .replace(/[，、]/g, '|')
    .replace(/\s+/g, '')
    .replace(/／/g, '/');
}

function isValidChoiceAnswer(answer, choiceCount, allowMultiple = false) {
  if (choiceCount < 1) return false;
  const parts = allowMultiple ? answer.split('|') : [answer];
  if (!allowMultiple && parts.length !== 1) return false;
  return parts.every(part => {
    if (!/^\d+$/.test(part)) return false;
    const n = parseInt(part, 10);
    return n >= 1 && n <= choiceCount;
  });
}

// ===================================================
//  画面切り替え
// ===================================================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(el => {
    el.classList.add('hidden');
    el.classList.remove('active');
  });
  const el = document.getElementById(id);
  el.classList.remove('hidden');
  el.classList.add('active');
  document.body.dataset.scene = id.replace('screen-', '');
}

// ===================================================
//  タイトル画面
// ===================================================
function initTitleScreen() {
  renderTitleRecords();
  spawnParticles('titleParticles', 0, ['#c9a84c','#8060c0','#4a8cff','#3dd6c0']);
}

function renderTitleRecords() {
  const f = (v, unit='') => v > 0 ? `${v}${unit}` : '-';
  document.getElementById('recBestFloor').textContent    = f(records.bestFloor, 'F');
  document.getElementById('recBestScore').textContent    = records.bestScore > 0 ? records.bestScore.toLocaleString() : '-';
  document.getElementById('recPlayCount').textContent    = f(records.playCount, '回');
  document.getElementById('recTotalCorrect').textContent = f(records.totalCorrect, '問');
}

function spawnParticles(containerId, count, colors) {
  const c = document.getElementById(containerId);
  if (!c) return;
  c.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.cssText = `
      left:${Math.random()*100}%;
      width:${Math.random()*3+1}px;
      height:${Math.random()*3+1}px;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      animation-duration:${Math.random()*8+6}s;
      animation-delay:${Math.random()*8}s;
    `;
    c.appendChild(p);
  }
}

function pulseAdrenaline(ms = 650) {
  document.body.classList.remove('fx-adrenaline');
  void document.body.offsetWidth;
  document.body.classList.add('fx-adrenaline');
  setTimeout(() => document.body.classList.remove('fx-adrenaline'), ms);
}

function spawnFxBurst(type, x = window.innerWidth / 2, y = window.innerHeight * .43, intensity = 1) {
  const layer = document.getElementById('fxBurstLayer');
  if (!layer) return;

  const [c1, c2] = FX_COLORS[type] || FX_COLORS.combo;
  const core = document.createElement('div');
  core.className = 'fx-burst';
  core.style.setProperty('--x', `${x}px`);
  core.style.setProperty('--y', `${y}px`);
  core.style.setProperty('--size', `${Math.round(88 + intensity * 38)}px`);
  core.style.setProperty('--dur', `${Math.max(.55, 1.05 - intensity * .08)}s`);
  core.style.setProperty('--c1', c1);
  core.style.setProperty('--c2', c2);
  layer.appendChild(core);

  const shards = Math.round(18 + intensity * 10);
  for (let i = 0; i < shards; i++) {
    const a = (Math.PI * 2 * i / shards) + (Math.random() * .5);
    const dist = 95 + Math.random() * (110 + intensity * 42);
    const shard = document.createElement('div');
    shard.className = 'fx-shard';
    shard.style.setProperty('--x', `${x}px`);
    shard.style.setProperty('--y', `${y}px`);
    shard.style.setProperty('--w', `${2 + Math.random() * 5}px`);
    shard.style.setProperty('--h', `${10 + Math.random() * 24}px`);
    shard.style.setProperty('--dx', `${Math.cos(a) * dist}px`);
    shard.style.setProperty('--dy', `${Math.sin(a) * dist}px`);
    shard.style.setProperty('--rot', `${Math.round(Math.random() * 360)}deg`);
    shard.style.setProperty('--dur', `${.62 + Math.random() * .52}s`);
    shard.style.setProperty('--c1', c1);
    layer.appendChild(shard);
    setTimeout(() => shard.remove(), 1300);
  }

  setTimeout(() => core.remove(), 1300);
}

function burstAtElement(el, type, intensity = 1) {
  if (!el) {
    spawnFxBurst(type, window.innerWidth / 2, window.innerHeight * .43, intensity);
    return;
  }
  const r = el.getBoundingClientRect();
  spawnFxBurst(type, r.left + r.width / 2, r.top + r.height / 2, intensity);
}

let gameAudioContext;
let dungeonBgm = null;
let dungeonBgmMuted = false;
let dungeonBgmTimer = null;
let currentComboTier = 0;

function getGameAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  gameAudioContext ||= new AudioContextClass();
  if (gameAudioContext.state === 'suspended') gameAudioContext.resume();
  return gameAudioContext;
}

function playGameTone({ frequency, endFrequency, start, duration, type = 'sine', volume = .12 }) {
  const context = getGameAudioContext();
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency || frequency), start + duration);
  gain.gain.setValueAtTime(.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + .018);
  gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + .02);
}

function getComboTier(combo) {
  if (combo >= 20) return 4;
  if (combo >= 10) return 3;
  if (combo >= 5) return 2;
  if (combo >= 3) return 1;
  return 0;
}

function updateComboAtmosphere(combo = 0) {
  currentComboTier = getComboTier(combo);
  document.body.dataset.comboTier = String(currentComboTier);
}

function playCorrectImpactSound(combo = 0) {
  const context = getGameAudioContext();
  if (!context) return;
  const now = context.currentTime;
  const tier = getComboTier(combo);
  const notes = [392, 523.25, 659.25, 783.99];
  if (tier >= 1) notes.push(1046.5);
  if (tier >= 2) notes.push(1318.5);
  notes.forEach((frequency, index) => {
    playGameTone({ frequency, endFrequency: frequency * 1.035, start: now + index * .055, duration: .42, type: 'triangle', volume: .105 });
  });
  playGameTone({ frequency: 120, endFrequency: 65, start: now, duration: .2, type: 'sine', volume: .16 });
  if (tier >= 3) playGameTone({ frequency: 82, endFrequency: 42, start: now + .08, duration: .55, type: 'sawtooth', volume: .07 });
}

function playCollapseSound() {
  const context = getGameAudioContext();
  if (!context) return;
  const now = context.currentTime;
  playGameTone({ frequency: 95, endFrequency: 25, start: now, duration: 1.55, type: 'sawtooth', volume: .18 });
  playGameTone({ frequency: 58, endFrequency: 22, start: now + .12, duration: 1.9, type: 'square', volume: .09 });
  [0, .19, .42, .7].forEach((offset, index) => {
    playGameTone({ frequency: 170 - index * 25, endFrequency: 38, start: now + offset, duration: .38, type: 'sawtooth', volume: .08 });
  });
}

function playDamageSound() {
  const context = getGameAudioContext();
  if (!context) return;
  const now = context.currentTime;
  playGameTone({ frequency: 150, endFrequency: 48, start: now, duration: .3, type: 'sawtooth', volume: .14 });
  playGameTone({ frequency: 72, endFrequency: 38, start: now + .025, duration: .42, type: 'square', volume: .08 });
}

function startDungeonBgm() {
  const context = getGameAudioContext();
  if (!context || dungeonBgm) return;
  const master = context.createGain();
  const filter = context.createBiquadFilter();
  master.gain.value = dungeonBgmMuted ? .0001 : .055;
  filter.type = 'lowpass';
  filter.frequency.value = 720;
  filter.Q.value = 1.4;
  filter.connect(master).connect(context.destination);

  const drones = [41.2, 61.74, 82.41].map((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = index === 0 ? 'sine' : 'triangle';
    oscillator.frequency.value = frequency;
    oscillator.detune.value = index * 4 - 3;
    gain.gain.value = [.62, .22, .12][index];
    oscillator.connect(gain).connect(filter);
    oscillator.start();
    return oscillator;
  });
  dungeonBgm = { master, filter, drones };
  scheduleDungeonPulse();
  dungeonBgmTimer = setInterval(scheduleDungeonPulse, 3200);
  ensureBgmToggle();
}

function scheduleDungeonPulse() {
  const context = getGameAudioContext();
  if (!context || !dungeonBgm || dungeonBgmMuted) return;
  const now = context.currentTime;
  const tier = currentComboTier;
  playGameTone({ frequency: 46.25, endFrequency: 39, start: now, duration: .72, type: 'sine', volume: .025 + tier * .004 });
  playGameTone({ frequency: 69.3, endFrequency: 55, start: now + 1.55, duration: .52, type: 'triangle', volume: .018 + tier * .004 });
  if (tier >= 1) playGameTone({ frequency: 138.6, endFrequency: 110, start: now + .78, duration: .18, type: 'triangle', volume: .018 });
  if (tier >= 2) playGameTone({ frequency: 207.65, endFrequency: 164.8, start: now + 2.32, duration: .22, type: 'sine', volume: .02 });
  if (tier >= 3) [0, .4, .8, 1.2].forEach(offset => playGameTone({ frequency: 92.5, endFrequency: 72, start: now + offset, duration: .1, type: 'square', volume: .014 }));
  if (tier >= 4) playGameTone({ frequency: 329.6, endFrequency: 277.2, start: now + 1.12, duration: .65, type: 'triangle', volume: .017 });
}

function ensureBgmToggle() {
  let button = document.getElementById('bgmToggle');
  if (button) return button;
  button = document.createElement('button');
  button.id = 'bgmToggle';
  button.className = 'bgm-toggle';
  button.type = 'button';
  button.title = 'ダンジョンBGMの切り替え';
  button.textContent = dungeonBgmMuted ? 'BGM OFF' : 'BGM ON';
  button.addEventListener('click', () => {
    dungeonBgmMuted = !dungeonBgmMuted;
    button.textContent = dungeonBgmMuted ? 'BGM OFF' : 'BGM ON';
    if (dungeonBgm?.master) {
      dungeonBgm.master.gain.setTargetAtTime(dungeonBgmMuted ? .0001 : .055, getGameAudioContext().currentTime, .12);
    }
  });
  document.body.appendChild(button);
  return button;
}

function ensureCinematicFxLayer() {
  let layer = document.getElementById('cinematicFxLayer');
  if (layer) return layer;
  layer = document.createElement('div');
  layer.id = 'cinematicFxLayer';
  layer.className = 'cinematic-fx-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);
  return layer;
}

function triggerCorrectImpact(combo = 0) {
  const layer = ensureCinematicFxLayer();
  layer.className = 'cinematic-fx-layer is-correct';
  layer.innerHTML = '<div class="victory-ring"></div><div class="victory-flare"></div>';
  const tier = getComboTier(combo);
  for (let i = 0; i < 62 + tier * 14; i++) {
    const particle = document.createElement('i');
    particle.className = 'victory-particle';
    const angle = Math.random() * Math.PI * 2;
    const distance = 90 + Math.random() * Math.min(innerWidth, innerHeight) * .55;
    particle.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
    particle.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
    particle.style.setProperty('--delay', `${Math.random() * .1}s`);
    particle.style.setProperty('--size', `${3 + Math.random() * 8}px`);
    layer.appendChild(particle);
  }
  document.body.classList.remove('fx-correct-impact');
  void document.body.offsetWidth;
  document.body.classList.add('fx-correct-impact');
  playCorrectImpactSound(combo);
  setTimeout(() => {
    layer.className = 'cinematic-fx-layer';
    layer.innerHTML = '';
    document.body.classList.remove('fx-correct-impact');
  }, 1050);
}

function triggerDamageHit() {
  const layer = ensureCinematicFxLayer();
  layer.className = 'cinematic-fx-layer is-damage';
  layer.innerHTML = '<div class="damage-flash"></div><div class="damage-slash"></div>';
  document.body.classList.remove('fx-damage-hit');
  void document.body.offsetWidth;
  document.body.classList.add('fx-damage-hit');
  playDamageSound();
  setTimeout(() => {
    if (layer.classList.contains('is-damage')) {
      layer.className = 'cinematic-fx-layer';
      layer.innerHTML = '';
    }
    document.body.classList.remove('fx-damage-hit');
  }, 620);
}

function triggerDocumentKnowledgeEffect() {
  const layer = ensureCinematicFxLayer();
  layer.className = 'cinematic-fx-layer is-knowledge';
  layer.innerHTML = '<div class="knowledge-ripple"></div><div class="knowledge-title">知識を記録</div>';
  const context = getGameAudioContext();
  if (context) {
    const now = context.currentTime;
    playGameTone({ frequency: 196, endFrequency: 246.94, start: now, duration: .42, type: 'sine', volume: .06 });
    playGameTone({ frequency: 293.66, endFrequency: 369.99, start: now + .1, duration: .5, type: 'triangle', volume: .045 });
  }
  setTimeout(() => {
    if (layer.classList.contains('is-knowledge')) {
      layer.className = 'cinematic-fx-layer';
      layer.innerHTML = '';
    }
  }, 1050);
}

function triggerCatastrophicReset() {
  const layer = ensureCinematicFxLayer();
  layer.className = 'cinematic-fx-layer is-collapse';
  layer.innerHTML = '<div class="collapse-vignette"></div><div class="collapse-crack"></div><div class="collapse-title">階層崩壊</div>';
  for (let i = 0; i < 48; i++) {
    const debris = document.createElement('i');
    debris.className = 'collapse-debris';
    debris.style.setProperty('--x', `${Math.random() * 100}vw`);
    debris.style.setProperty('--fall', `${60 + Math.random() * 70}vh`);
    debris.style.setProperty('--drift', `${-90 + Math.random() * 180}px`);
    debris.style.setProperty('--delay', `${Math.random() * .38}s`);
    debris.style.setProperty('--size', `${4 + Math.random() * 15}px`);
    layer.appendChild(debris);
  }
  document.body.classList.remove('fx-catastrophic-reset');
  void document.body.offsetWidth;
  document.body.classList.add('fx-catastrophic-reset');
  playCollapseSound();
  setTimeout(() => {
    layer.className = 'cinematic-fx-layer';
    layer.innerHTML = '';
    document.body.classList.remove('fx-catastrophic-reset');
  }, 2400);
}

// ===================================================
//  塔ビジュアル（サイドバー）
// ===================================================
function buildTowerVisual() {
  const shaft = document.getElementById('towerShaft');
  const list  = document.getElementById('towerFloorsList');
  if (!list) return;
  list.innerHTML = '';

  // マーカーを goalFloors 分生成（下から上へ）
  const milestones = new Set([5, 10, 20, 30, 40, 50]);
  for (let f = 1; f <= goalFloors; f++) {
    const pct = ((f - 1) / (goalFloors - 1 || 1)) * 100; // 0〜100%
    const marker = document.createElement('div');
    marker.className = 'floor-marker' + (milestones.has(f) ? ' milestone' : '');
    // 下からの位置（bottom）
    marker.style.bottom = `${pct}%`;
    if (milestones.has(f)) marker.dataset.floor = `${f}F`;
    list.appendChild(marker);
  }
}

function updateTowerPlayer(floor) {
  const player = document.getElementById('towerPlayer');
  const shaft  = document.getElementById('towerShaft');
  if (!player || !shaft) return;

  const pct = (floor - 1) / (goalFloors - 1 || 1); // 0〜1
  // shaftの高さに対してbottomで配置
  const shaftH  = shaft.offsetHeight || 200;
  const bottomPx = pct * (shaftH - 24); // 24はアイコン高さ分余白
  player.style.bottom = `${Math.max(0, Math.min(bottomPx, shaftH - 24))}px`;
}

// ===================================================
//  ゲーム開始
// ===================================================
function startGame() {
  startDungeonBgm();
  updateComboAtmosphere(0);
  records.playCount++;
  saveRecords();

  gs = {
    currentIndex: 0, combo: 0, score: 0, missCount: 0,
    answered: false, selectedChoices: [],
    coins: 0, totalCoinsEarned: 0,
    shieldLevel: 0, shieldHp: 0,
    descentLevel: 0,
    choicecutLevel: 0, choicecutReady: false,
  };

  showScreen('screen-game');

  // 塔ビジュアル生成
  buildTowerVisual();
  setTimeout(() => {
    updateTowerPlayer(1);
  }, 100); // DOM描画後に実行

  renderQuestion();
}

// ===================================================
//  問題レンダリング
// ===================================================
function renderQuestion() {
  const q = questions[gs.currentIndex];
  if (!q) return;

  gs.answered        = false;
  gs.selectedChoices = [];

  const floor = gs.currentIndex + 1;

  updateGaugeDisplay(floor);
  updateStatusDisplay();

  document.getElementById('qFloorBadge').textContent = `第${floor}層`;
  document.getElementById('qCategory').textContent   = q.category || '';
  document.getElementById('qTypeBadge').textContent  = typeLabel(q);

  // 問題文（fill_blank は blank 変換）
  if (q.type === 'fill_blank') {
    document.getElementById('questionText').innerHTML =
      escHtml(q.question).replace('【blank】', '<span class="blank-span">　　　　</span>');
  } else {
    document.getElementById('questionText').textContent = q.question;
  }

  // エリア切り替え
  const choicesArea    = document.getElementById('choicesArea');
  const fillblankArea  = document.getElementById('fillblankArea');
  const resultArea     = document.getElementById('resultArea');

  resultArea.classList.add('hidden');
  document.getElementById('btnNext').classList.add('hidden');
  document.getElementById('btnRetry').classList.add('hidden');

  if (q.type === 'fill_blank') {
    choicesArea.classList.add('hidden');
    fillblankArea.classList.remove('hidden');
    resetFillBlank();
  } else {
    fillblankArea.classList.add('hidden');
    choicesArea.classList.remove('hidden');
    renderDoors(q);
    const btnM = document.getElementById('btnSubmitMulti');
    btnM.classList.toggle('hidden', q.type !== 'multiple_choice');
    if (q.type === 'multiple_choice') btnM.disabled = false;
  }

  renderActiveItemBadges();
}

function typeLabel(q) {
  if (q.type === 'single_choice') return `${q.choices.length}択`;
  if (q.type === 'multiple_choice') return `${q.choices.length}択・複数選択`;
  if (q.type === 'fill_blank') return '穴埋め';
  return '';
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

// ===================================================
//  扉レンダリング
// ===================================================
function renderDoors(q) {
  const grid = document.getElementById('doorsGrid');
  grid.innerHTML = '';
  grid.className = `doors-grid choice-count-${q.choices.length}`;

  // choicecutReady で削除する扉を決定
  let eliminatedNums = [];
  if (q.type === 'single_choice' && gs.choicecutReady && gs.choicecutLevel > 0) {
    eliminatedNums = pickEliminatedChoices(q, gs.choicecutLevel);
    gs.choicecutReady = false; // 発動消費
    renderActiveItemBadges();
  }

  q.choices.forEach((text, i) => {
    const num  = i + 1;
    const card = document.createElement('div');
    card.className = 'door-card';
    card.dataset.num = num;
    card.style.setProperty('--door-pos', `${q.choices.length === 1 ? 0 : (i / (q.choices.length - 1)) * 100}%`);

    card.innerHTML = `
      <div class="door-arch"></div>
      <div class="door-stage">
        <div class="door-art"></div>
        <div class="door-reveal">
          <span class="door-reveal-mark"></span>
          <span class="door-reveal-text"></span>
        </div>
      </div>
      <div class="door-inner">
        <span class="door-num">${num}</span>
        <span class="door-text">${escHtml(text)}</span>
      </div>
    `;

    if (eliminatedNums.includes(num)) {
      card.classList.add('eliminated');
    } else if (q.type === 'single_choice') {
      card.addEventListener('click', () => { if (!gs.answered) handleSingleChoice(num); });
    } else {
      card.addEventListener('click', () => { if (!gs.answered) toggleMultiChoice(card, num); });
    }

    grid.appendChild(card);
  });
}

/**
 * 消去する不正解選択肢を決める
 * @param {object} q
 * @param {number} count - 消す枚数
 */
function pickEliminatedChoices(q, count) {
  const correctNum = parseInt(q.answer, 10);
  const wrongs = q.choices.map((_, i) => i + 1).filter(n => n !== correctNum);
  // ランダムに count 枚選ぶ
  const shuffled = wrongs.sort(() => Math.random() - .5);
  return shuffled.slice(0, count);
}

function toggleMultiChoice(card, num) {
  const idx = gs.selectedChoices.indexOf(num);
  if (idx === -1) { gs.selectedChoices.push(num); card.classList.add('selected'); }
  else            { gs.selectedChoices.splice(idx,1); card.classList.remove('selected'); }
}

// ===================================================
//  回答処理
// ===================================================
function handleSingleChoice(num) {
  if (gs.answered) return;
  gs.answered = true;
  const q = questions[gs.currentIndex];
  const correctNum = parseInt(q.answer, 10);
  highlightDoorsSingle(num, correctNum);
  processResult(num === correctNum, q);
}

function handleMultipleChoice() {
  if (gs.answered) return;
  if (!gs.selectedChoices.length) { alert('選択肢を1つ以上選んでください'); return; }
  gs.answered = true;
  const q = questions[gs.currentIndex];
  const correctNums = q.answer.split('|').map(n => parseInt(n,10));
  const selSorted = [...gs.selectedChoices].sort((a,b)=>a-b);
  const corSorted = [...correctNums].sort((a,b)=>a-b);
  highlightDoorsMulti(selSorted, corSorted);
  document.getElementById('btnSubmitMulti').disabled = true;
  processResult(JSON.stringify(selSorted)===JSON.stringify(corSorted), q);
}

function handleFillBlank() {
  if (gs.answered) return;
  const input = document.getElementById('fillInput');
  if (!input.value.trim()) { alert('答えを入力してください'); return; }
  gs.answered = true;
  const q = questions[gs.currentIndex];
  const norm     = normAnswer(input.value);
  const accepted = q.answer.split('|').map(normAnswer);
  const ok = accepted.includes(norm);
  input.classList.add(ok ? 'correct' : 'wrong');
  input.disabled = true;
  document.getElementById('btnSeal').disabled = true;
  processResult(ok, q);
}

function normAnswer(s) {
  return s.trim()
    .replace(/\u3000/g,' ')
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0)-0xFEE0))
    .replace(/／/g,'/');
}

// ===================================================
//  結果処理
// ===================================================
function processResult(isCorrect, q) {
  const resultArea    = document.getElementById('resultArea');
  const resultBanner  = document.getElementById('resultBanner');
  const scorePopup    = document.getElementById('scorePopup');
  const explanationBox= document.getElementById('explanationBox');
  const btnNext       = document.getElementById('btnNext');
  const btnRetry      = document.getElementById('btnRetry');

  resultArea.classList.remove('hidden');
  requestAnimationFrame(() => {
    explanationBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  if (isCorrect) {
    // ---- 正解 ----
    gs.combo++;
    records.totalCorrect++;

    // スコア計算
    const base  = 100;
    const cb    = gs.combo * 10;
    const mb    = MILESTONE_BONUSES[gs.combo] || 0;
    const gained = base + cb + mb;
    gs.score += gained;

    // コイン計算
    const coinBase  = COIN_PER_CORRECT;
    const coinBonus = COIN_COMBO_BONUS[gs.combo] || 0;
    const coinTotal = coinBase + coinBonus;
    gs.coins += coinTotal;
    gs.totalCoinsEarned += coinTotal;

    // 最高記録更新
    const floor = gs.currentIndex + 1;
    if (gs.combo > records.bestCombo) records.bestCombo = gs.combo;
    if (floor > records.bestFloor)    records.bestFloor  = floor;
    if (gs.score > records.bestScore) records.bestScore  = gs.score;
    saveRecords();

    // バナー
    resultBanner.className = 'result-banner correct';
    resultBanner.textContent = '✓ 正解！';

    // スコア表示
    let txt = `+${gained} スコア　🪙 +${coinTotal}`;
    if (mb > 0) txt += `　🎉 COMBO BONUS +${mb}`;
    scorePopup.textContent = txt;

    // 解説
    explanationBox.innerHTML = buildExplanationHtml(q, getSelectedAnswerNums(q));

    // 演出
    flashFx('correct'); shakeFx('correct');
    burstAtElement(document.querySelector('.door-card.correct-door') || resultBanner, 'correct', Math.min(2.5, 1 + gs.combo / 8));
    pulseAdrenaline();
    updateComboAtmosphere(gs.combo);
    triggerCorrectImpact(gs.combo);

    // 塔プレイヤー移動 → 上昇エフェクト
    updateTowerPlayer(floor);
    triggerRiseEffect();

    // 節目コンボ
    if (MILESTONE_COMBOS.includes(gs.combo)) {
      setTimeout(() => showComboOverlay(gs.combo), 250);
    }

    // クリア判定
    if (gs.combo >= goalFloors) {
      setTimeout(() => showClearScreen(), 1600);
    } else {
      btnNext.classList.remove('hidden');
    }

  } else {
    // ---- 不正解 ----
    gs.missCount++;
    records.totalMiss++;
    saveRecords();

    resultBanner.className = 'result-banner wrong';
    explanationBox.innerHTML = buildExplanationHtml(q, getSelectedAnswerNums(q));
    scorePopup.textContent = '';

    flashFx('wrong'); shakeFx('wrong');
    burstAtElement(document.querySelector('.door-card.wrong-door') || resultBanner, 'wrong', 1.8);
    pulseAdrenaline();
    triggerDamageHit();

    // 盾チェック
    if (gs.shieldHp > 0) {
      gs.shieldHp--;
      resultBanner.textContent = `🛡 盾が守った！（残り${gs.shieldHp}回）`;
      if (gs.shieldHp === 0) resultBanner.textContent += ' 〔盾が壊れた〕';

      // 降下軽減チェック
      if (gs.descentLevel > 0) {
        const descentFloors = SHOP_ITEMS.find(i=>i.id==='descent').levels[gs.descentLevel-1].value;
        const newIndex = Math.max(0, gs.currentIndex - descentFloors);
        resultBanner.textContent = `🛡 盾が守った → 🪂 ${descentFloors}階降下！`;
        triggerFallEffect(() => {
          gs.combo        = newIndex;
          gs.currentIndex = newIndex;
          renderQuestion();
          window.scrollTo(0,0);
        }, `🛡 盾が守った！ ${descentFloors}階降下…`);
      } else {
        // 盾は守ったが降下なし → 1問目へ（でも盾が守ったので1問目にはならない）
        // 盾あり時：現在の階層はそのまま次の問題へ進まず再回答
        triggerFallEffect(() => {
          // 同じ問題に戻る（gs.currentIndexはそのまま）
          renderQuestion();
          window.scrollTo(0,0);
        }, '🛡 盾が守った！ 踏ん張れ……');
        return; // ここで早期リターン（ボタンは不要）
      }
      return;
    }

    // 盾なし → 降下軽減チェック
    if (gs.descentLevel > 0) {
      const descentFloors = SHOP_ITEMS.find(i=>i.id==='descent').levels[gs.descentLevel-1].value;
      const newIndex = Math.max(0, gs.currentIndex - descentFloors);
      resultBanner.textContent = `✗ 不正解…… 🪂 ${descentFloors}階降下！`;
      gs.combo = newIndex;
      triggerFallEffect(() => {
        gs.currentIndex = newIndex;
        renderQuestion();
        window.scrollTo(0,0);
      });
      return;
    }

    // 盾も降下軽減もなし → 1問目へ
    resultBanner.textContent = '✗ 塔が崩れた……';
    updateComboAtmosphere(0);
    triggerCatastrophicReset();
    triggerFallEffect(null); // fall演出後はbtnRetryで再開
    btnRetry.classList.remove('hidden');
  }

  updateStatusDisplay();
}

function buildAnswerLabel(q) {
  let label = '';
  if (q.type === 'single_choice') {
    const n = parseInt(q.answer,10);
    label = `<div class="correct-answer-hint">正解：${n}. ${escHtml(q.choices[n-1])}</div>`;
  } else if (q.type === 'multiple_choice') {
    const parts = q.answer.split('|').map(n => { const i=parseInt(n,10); return `${i}. ${escHtml(q.choices[i-1])}`; });
    label = `<div class="correct-answer-hint">正解：${parts.join('、')}</div>`;
  } else if (q.type === 'fill_blank') {
    label = `<div class="correct-answer-hint">正解：${escHtml(q.answer.replace(/\|/g,' または '))}</div>`;
  }
  return label;
}

function buildExplanationHtml(q, selectedNums = []) {
  const pieces = [buildAnswerLabel(q)];
  if (q.explanation) {
    pieces.push(`<div class="overall-explanation">${escHtml(q.explanation)}</div>`);
  }
  if ((q.type === 'single_choice' || q.type === 'multiple_choice') && q.choiceExplanations?.some(Boolean)) {
    const correctNums = getCorrectAnswerNums(q);
    pieces.push('<div class="choice-explanations">');
    q.choices.forEach((choice, i) => {
      const num = i + 1;
      const cls = [
        'choice-explanation-item',
        correctNums.includes(num) ? 'is-correct' : 'is-wrong',
        selectedNums.includes(num) ? 'is-selected' : '',
      ].filter(Boolean).join(' ');
      const expl = q.choiceExplanations[i] || 'この選択肢の解説は未設定です。';
      const status = correctNums.includes(num) ? '正解' : '不正解';
      const selected = selectedNums.includes(num) ? '<span class="choice-exp-selected">選択</span>' : '';
      pieces.push(`
        <div class="${cls}">
          <div class="choice-exp-head">
            <span class="choice-exp-num">${num}</span>
            <span class="choice-exp-status">${status}</span>
            ${selected}
          </div>
          <div class="choice-exp-choice">${escHtml(choice)}</div>
          <div class="choice-exp-body">${escHtml(expl)}</div>
        </div>
      `);
    });
    pieces.push('</div>');
  }
  return pieces.join('');
}

function getCorrectAnswerNums(q) {
  if (q.type === 'single_choice') return [parseInt(q.answer, 10)];
  if (q.type === 'multiple_choice') return q.answer.split('|').map(n => parseInt(n, 10));
  return [];
}

function getSelectedAnswerNums(q) {
  if (q.type === 'single_choice') {
    return Array.from(document.querySelectorAll('.door-card.wrong-door,.door-card.correct-door.selected-door'))
      .map(card => parseInt(card.dataset.num, 10))
      .filter(Boolean);
  }
  if (q.type === 'multiple_choice') return [...gs.selectedChoices];
  return [];
}

// ===================================================
//  扉演出
// ===================================================
function highlightDoorsSingle(selectedNum, correctNum) {
  document.querySelectorAll('.door-card').forEach(card => {
    const n = parseInt(card.dataset.num,10);
    card.style.cursor = 'default';
    if (n === selectedNum) card.classList.add('selected-door', 'door-opening');
    if (n === correctNum) {
      card.classList.add('correct-door');
      setDoorReveal(card, true);
    } else if (n === selectedNum) {
      card.classList.add('wrong-door');
      setDoorReveal(card, false);
    }
  });
}

function highlightDoorsMulti(selNums, corNums) {
  document.querySelectorAll('.door-card').forEach(card => {
    const n = parseInt(card.dataset.num,10);
    card.style.cursor = 'default';
    if (selNums.includes(n)) card.classList.add('selected-door', 'door-opening');
    if (corNums.includes(n)) {
      card.classList.add('correct-door');
      setDoorReveal(card, true);
    } else if (selNums.includes(n)) {
      card.classList.add('wrong-door');
      setDoorReveal(card, false);
    }
  });
}

function setDoorReveal(card, isCorrect) {
  const mark = card.querySelector('.door-reveal-mark');
  const text = card.querySelector('.door-reveal-text');
  if (mark) mark.textContent = isCorrect ? '✓' : '✗';
  if (text) text.textContent = isCorrect ? '正解' : '不正解';
}

// ===================================================
//  穴埋めリセット
// ===================================================
function resetFillBlank() {
  const inp = document.getElementById('fillInput');
  inp.value = ''; inp.classList.remove('correct','wrong'); inp.disabled = false;
  document.getElementById('btnSeal').disabled = false;
  setTimeout(() => inp.focus(), 80);
}

// ===================================================
//  ゲージ・ステータス更新
// ===================================================
function updateGaugeDisplay(floor) {
  const pct = ((floor - 1) / goalFloors) * 100;
  document.getElementById('miniGaugeFill').style.width = `${Math.min(pct,100)}%`;
  document.getElementById('topbarFloor').textContent   = `${floor}F`;
  document.getElementById('topbarGoal').textContent    = `/ ${goalFloors}F`;
}

function updateStatusDisplay() {
  const floor = gs.currentIndex + 1;
  document.getElementById('statFloor').textContent     = `${floor}F`;
  document.getElementById('statCombo').textContent     = gs.combo;
  document.getElementById('statScore').textContent     = gs.score.toLocaleString();
  document.getElementById('statMiss').textContent      = gs.missCount;
  document.getElementById('statRemaining').textContent = `${goalFloors - gs.combo}問`;
  document.getElementById('statCoins').textContent     = gs.coins;
  document.getElementById('topbarCoins').textContent   = gs.coins;
}

function renderActiveItemBadges() {
  const container = document.getElementById('activeItems');
  container.innerHTML = '';

  if (gs.shieldLevel > 0) {
    const b = document.createElement('div');
    b.className = 'item-badge shield';
    b.textContent = `🛡×${gs.shieldHp}`;
    container.appendChild(b);
  }
  if (gs.descentLevel > 0) {
    const v = SHOP_ITEMS.find(i=>i.id==='descent').levels[gs.descentLevel-1].value;
    const b = document.createElement('div');
    b.className = 'item-badge descent';
    b.textContent = `🪂-${v}F`;
    container.appendChild(b);
  }
  if (gs.choicecutLevel > 0 && gs.choicecutReady) {
    const b = document.createElement('div');
    b.className = 'item-badge choicecut';
    b.textContent = `✂️×${gs.choicecutLevel}`;
    container.appendChild(b);
  }
}

// ===================================================
//  演出
// ===================================================
function flashFx(type) {
  const el = document.getElementById('overlayFlash');
  const cls = `do-flash-${type}`;
  el.classList.remove('do-flash-correct','do-flash-wrong','do-flash-combo');
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 700);
}

function shakeFx(type) {
  const el = document.getElementById('screen-game');
  const cls = `do-shake-${type}`;
  el.classList.remove('do-shake-correct','do-shake-wrong','do-shake-combo');
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 600);
}

function showComboOverlay(combo) {
  const ov  = document.getElementById('overlayCombo');
  document.getElementById('comboText').textContent = `${combo} COMBO`;
  document.getElementById('comboSub').textContent  = MILESTONE_MESSAGES[combo] || '';
  ov.classList.remove('hidden');
  flashFx('combo'); shakeFx('combo');
  spawnFxBurst('combo', window.innerWidth / 2, window.innerHeight * .42, Math.min(4, 1.8 + combo / 12));
  pulseAdrenaline(900);
  setTimeout(() => ov.classList.add('hidden'), 1850);
}

// 上昇エフェクト
function triggerRiseEffect() {
  const ov = document.getElementById('riseOverlay');
  ov.classList.remove('hidden');
  spawnFxBurst('rise', window.innerWidth / 2, window.innerHeight * .56, 1.2);
  setTimeout(() => ov.classList.add('hidden'), 750);
}

// 落下エフェクト（msg省略時は「塔が崩れた……」）
function triggerFallEffect(callback, msg) {
  const ov    = document.getElementById('fallOverlay');
  const msgEl = ov.querySelector('.fall-msg');
  if (msgEl) msgEl.textContent = msg || '塔が崩れた……';
  ov.classList.remove('hidden');
  spawnFxBurst('fall', window.innerWidth / 2, window.innerHeight * .58, 2.4);
  setTimeout(() => {
    ov.classList.add('hidden');
    if (callback) callback();
  }, 1800);
}

// ===================================================
//  ゲーム進行
// ===================================================
function nextQuestion() {
  gs.currentIndex++;
  if (gs.currentIndex >= questions.length) {
    showClearScreen(); return;
  }
  renderQuestion();
  window.scrollTo(0,0);
}

function retryFromStart() {
  gs.currentIndex    = 0;
  gs.combo           = 0;
  gs.score           = 0;
  gs.answered        = false;
  gs.selectedChoices = [];
  updateComboAtmosphere(0);
  // coins・アイテムはそのまま継続
  updateTowerPlayer(1);
  renderQuestion();
  window.scrollTo(0,0);
}

// ===================================================
//  クリア画面
// ===================================================
function showClearScreen() {
  if (gs.score > records.bestScore)   records.bestScore  = gs.score;
  if (goalFloors > records.bestFloor) records.bestFloor  = goalFloors;
  if (gs.combo > records.bestCombo)   records.bestCombo  = gs.combo;
  saveRecords();

  document.getElementById('clearScore').textContent        = gs.score.toLocaleString();
  document.getElementById('clearCombo').textContent        = `${gs.combo}連続`;
  document.getElementById('clearTotalCorrect').textContent = `${records.totalCorrect}問`;
  document.getElementById('clearCoins').textContent        = `${gs.totalCoinsEarned}枚`;

  spawnClearParticles();
  showScreen('screen-clear');
}

function spawnClearParticles() {
  const c = document.getElementById('clearParticles');
  c.innerHTML = '';
  const cols = ['#f0d070','#c9a84c','#80c0ff','#a080ff','#60e0c0','#ff8060'];
  for (let i = 0; i < 60; i++) {
    const p = document.createElement('div');
    p.className = 'clear-particle';
    p.style.cssText = `
      left:${Math.random()*100}%;
      width:${Math.random()*4+2}px; height:${Math.random()*4+2}px;
      background:${cols[Math.floor(Math.random()*cols.length)]};
      animation-duration:${Math.random()*6+5}s;
      animation-delay:${Math.random()*5}s;
    `;
    c.appendChild(p);
  }
}

// ===================================================
//  ショップ
// ===================================================
function openShop() {
  renderShopItems();
  document.getElementById('shopModal').classList.remove('hidden');
  document.getElementById('shopCoinDisp').textContent = gs.coins;
}

function closeShop() {
  document.getElementById('shopModal').classList.add('hidden');
}

function renderShopItems() {
  const container = document.getElementById('shopItems');
  container.innerHTML = '';

  SHOP_ITEMS.forEach(item => {
    const currentLevel = gs[`${item.id}Level`];
    const isMaxed = currentLevel >= item.levels.length;

    const card = document.createElement('div');
    card.className = 'shop-item' + (isMaxed ? ' maxed' : '');

    // レベルドット
    const dots = item.levels.map((_, li) =>
      `<div class="level-dot ${li < currentLevel ? 'filled' : ''}"></div>`
    ).join('');

    let actionHtml = '';
    if (isMaxed) {
      actionHtml = `<button class="btn-buy maxed-btn" disabled>最大Lv</button>`;
    } else {
      const nextLv   = item.levels[currentLevel];
      const canAfford = gs.coins >= nextLv.cost;
      const btnLabel  = currentLevel === 0 ? '購入' : 'Lv UP';
      actionHtml = `
        <div class="shop-item-cost">🪙 ${nextLv.cost}</div>
        <button class="btn-buy" data-item="${item.id}" ${canAfford?'':'disabled'}>${btnLabel}</button>
      `;
    }

    const nextDesc = isMaxed ? item.levels[item.levels.length-1].desc : item.levels[currentLevel].desc;

    card.innerHTML = `
      <div class="shop-item-icon">${item.icon}</div>
      <div class="shop-item-info">
        <div class="shop-item-name">${item.name}</div>
        <div class="shop-item-desc">${item.baseDesc}</div>
        <div class="shop-item-level">${dots}</div>
        <div class="shop-item-desc" style="color:var(--text)">${isMaxed ? '✅ '+nextDesc : '→ '+nextDesc}</div>
      </div>
      <div class="shop-item-action">${actionHtml}</div>
    `;

    // 購入ボタン
    const btn = card.querySelector('.btn-buy[data-item]');
    if (btn) {
      btn.addEventListener('click', () => buyItem(item.id));
    }

    container.appendChild(card);
  });

  document.getElementById('shopCoinDisp').textContent = gs.coins;
}

function buyItem(itemId) {
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return;

  const currentLevel = gs[`${itemId}Level`];
  if (currentLevel >= item.levels.length) return;

  const cost = item.levels[currentLevel].cost;
  if (gs.coins < cost) return;

  gs.coins -= cost;
  gs[`${itemId}Level`] = currentLevel + 1;

  // アイテム固有の処理
  if (itemId === 'shield') {
    // 盾のHP = 新しいレベルの value
    gs.shieldHp = item.levels[gs.shieldLevel - 1].value;
  }
  if (itemId === 'choicecut') {
    gs.choicecutReady = true;
  }

  updateStatusDisplay();
  renderShopItems();
  renderActiveItemBadges();
}

// ===================================================
//  CSV読み込み
// ===================================================
function handleCsvFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const raw = parseCSV(e.target.result);
    const { errors, questions: parsed } = validateAndConvertCSV(raw);
    const errBox  = document.getElementById('csvError');
    const btnStart = document.getElementById('btnStart');

    if (errors.length) {
      errBox.classList.remove('hidden');
      errBox.textContent = errors.join('\n');
      btnStart.classList.add('hidden');
      questions = [];
      return;
    }

    errBox.classList.add('hidden');
    questions  = parsed;
    goalFloors = Math.min(questions.length, TOTAL_FLOORS);
    document.getElementById('csvFileName').textContent = `📜 ${file.name}（${questions.length}問）`;
    btnStart.classList.remove('hidden');
  };
  reader.onerror = () => {
    document.getElementById('csvError').classList.remove('hidden');
    document.getElementById('csvError').textContent = 'ファイルの読み込みに失敗しました。';
  };
  reader.readAsText(file, 'UTF-8');
}

// ===================================================
//  イベントリスナー
// ===================================================
function initEventListeners() {
  document.addEventListener('pointerdown', startDungeonBgm, { once: true });
  // タイトル
  document.getElementById('csvFile').addEventListener('change', e => handleCsvFile(e.target.files[0]));
  document.getElementById('btnStart').addEventListener('click', startGame);
  document.getElementById('btnResetRecords').addEventListener('click', resetRecords);

  // ゲーム
  document.getElementById('btnNext').addEventListener('click', nextQuestion);
  document.getElementById('btnRetry').addEventListener('click', retryFromStart);
  document.getElementById('btnSubmitMulti').addEventListener('click', handleMultipleChoice);
  document.getElementById('btnSeal').addEventListener('click', handleFillBlank);
  document.getElementById('fillInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !gs.answered) handleFillBlank();
  });

  // ショップ
  document.getElementById('btnShop').addEventListener('click', openShop);
  document.getElementById('shopClose').addEventListener('click', closeShop);
  document.getElementById('shopBackdrop').addEventListener('click', closeShop);

  // クリア
  document.getElementById('btnPlayAgain').addEventListener('click', () => {
    showScreen('screen-title');
    initTitleScreen();
  });

  // ドラッグ＆ドロップ
  const csvLabel = document.querySelector('.csv-label');
  csvLabel.addEventListener('dragover', e => { e.preventDefault(); csvLabel.style.borderColor = 'var(--gold)'; });
  csvLabel.addEventListener('dragleave', () => { csvLabel.style.borderColor = ''; });
  csvLabel.addEventListener('drop', e => {
    e.preventDefault(); csvLabel.style.borderColor = '';
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith('.csv')) handleCsvFile(f);
    else alert('CSVファイルをドロップしてください');
  });
}

// ===================================================
//  初期化
// ===================================================
function init() {
  loadRecords();
  initEventListeners();
  initTitleScreen();
  showScreen('screen-title');
}

document.addEventListener('DOMContentLoaded', init);

const documentModeScript = document.createElement('script');
documentModeScript.src = 'document-mode.js';
document.head.appendChild(documentModeScript);

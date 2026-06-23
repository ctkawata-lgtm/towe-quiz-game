/**
 * RPGモード - rpg-mode.js
 * 塔の試練に追加するRPGバトルモード
 * すべてのコードはIIFE内に閉じ込め、グローバル汚染を防ぐ
 */

(function () {
  'use strict';

  // ===================================================
  //  定数
  // ===================================================

  const RPG_LS_KEY = 'rpg_v1_save';
  const PLAYER_BASE_HP = 2000;
  const GACHA_CORRECTS_REQUIRED = 5;

  const ENEMY_TEMPLATES = [
    { name: 'グレイブウォーカー', emoji: '🧟', hp: 1000,   reward: 100   },
    { name: 'ブラッドオーガ',     emoji: '👹', hp: 3000,   reward: 300   },
    { name: 'ミストファントム',   emoji: '👻', hp: 6000,   reward: 600   },
    { name: 'ルーンゴーレム',     emoji: '🗿', hp: 12000,  reward: 1200  },
    { name: 'シャドウロード',     emoji: '🦹', hp: 25000,  reward: 2500  },
    { name: 'アビスデーモン',     emoji: '😈', hp: 50000,  reward: 5000  },
    { name: 'エルダードラゴン',   emoji: '🐉', hp: 100000, reward: 10000 },
    { name: '冥王ヴァルザーク',   emoji: '👺', hp: 200000, reward: 20000 },
  ];

  // ダイスグレード面数
  const DICE_GRADES = { D4: 4, D6: 6, D8: 8, D10: 10, D12: 12, D15: 15, D20: 20 };
  const GRADE_ORDER = ['D4', 'D6', 'D8', 'D10', 'D12', 'D15', 'D20'];
  const PROGRESSION_DICE_GRADES = ['D6', 'D8', 'D10', 'D12', 'D15'];
  const BOARD_ROWS = 7;
  const BOARD_COLS = 7;
  const WAVES_PER_STAGE = 1;
  const TOTAL_STAGES = 8;

  const RPG_SP_TYPES = {
    yin: { label: '陰SP', icon: '陰', cls: 'yin' },
    yang: { label: '陽SP', icon: '陽', cls: 'yang' },
  };

  const BOARD_ENEMY_TYPES = [
    { name: 'ヴェノムスライム', emoji: '🟢', hp: 1200, reward: 55, coins: 22 },
    { name: 'ナイトメアレイス', emoji: '👻', hp: 1900, reward: 75, coins: 32 },
    { name: 'グリードミミック', emoji: '📦', hp: 2800, reward: 98, coins: 44 },
    { name: 'アイアンガーディアン', emoji: '🛡️', hp: 4200, reward: 125, coins: 60 },
    { name: 'オブシディアンゴーレム', emoji: '🗿', hp: 6200, reward: 160, coins: 84 },
  ];

  // 武器未装備時のフォールバック定義
  const BARE_FIST = { id: 'bare', name: '素手（武器なし）', icon: '👊', kind: '単体', costs: [], atk: [0], pattern: 'single', desc: '武器を購入してください', fx: 'smash' };

  const WEAPONS = [
    { id: 'bat',        name: 'バット',     icon: '🏏', kind: '単体',     costs: [1500,   3000,    6000,    12000,    24000],  atk: [280,  480,  820,  1400, 2400], pattern: 'single',         desc: '扱いやすい単体攻撃。序盤の標準装備。', fx: 'smash' },
    { id: 'spear',      name: '槍',         icon: '🔱', kind: '縦列',     costs: [3000,   6000,   12000,    24000,    48000],  atk: [380,  650, 1050,  1750, 2900], pattern: 'vertical',       splash: [0.25, 0.35, 0.5, 0.7, 0.9], desc: '対象と同じ縦列へ貫通する。', fx: 'pierce' },
    { id: 'sword',      name: '剣',         icon: '🗡️', kind: '単体',     costs: [5000,  10000,   20000,    40000,    80000],  atk: [500,  800, 1250,  2000, 3300], pattern: 'single',         desc: 'バットより重い単体火力。', fx: 'slash' },
    { id: 'hammer',     name: 'ハンマー',   icon: '🔨', kind: '両横',     costs: [10000, 20000,   40000,    80000,   160000],  atk: [700, 1150, 1900,  3100, 5200], pattern: 'sideSplash',    splash: [0.35, 0.45, 0.6, 0.8, 1.0], desc: '高火力で対象と両横を叩く。攻撃後に敵を左へ寄せる。', fx: 'smash' },
    { id: 'bow',        name: '弓',         icon: '🏹', kind: '縦列貫通', costs: [20000, 40000,   80000,   160000,   320000],  atk: [650, 1050, 1700,  2800, 4700], pattern: 'verticalPierce', splash: [0.7, 0.85, 1.0, 1.2, 1.4], desc: '縦列を射抜く。連鎖対象の敵には高いダメージ。', fx: 'pierce' },
    { id: 'whip',       name: '鞭',         icon: '〰️', kind: '横列',     costs: [40000, 80000,  160000,   320000,   640000],  atk: [550,  900, 1480,  2450, 4100], pattern: 'row',            splash: [0.35, 0.45, 0.6, 0.8, 1.0], desc: '横一列の敵へ広く当てる。単体火力は控えめ。', fx: 'sweep' },
    { id: 'boomerang',  name: 'ブーメラン', icon: '🪃', kind: '跳弾',     costs: [80000, 160000,  320000,   640000,  1280000],  atk: [600,  980, 1600,  2650, 4450], pattern: 'chain',          jumps: [2, 2, 3, 4, 5], splash: [0.45, 0.55, 0.65, 0.75, 0.9], desc: '複数の敵へ跳ねる。', fx: 'sweep' },
    { id: 'kusarigama', name: '鎖鎌',       icon: '⛓️', kind: '十字',     costs: [160000, 320000, 640000,  1280000,  2560000],  atk: [720, 1180, 1920,  3200, 5400], pattern: 'cross',          splash: [0.4, 0.55, 0.7, 0.9, 1.1], desc: '対象の上下左右に鎖を走らせる。', fx: 'sweep' },
    { id: 'fan',        name: '扇',         icon: '🪭', kind: '周辺',     costs: [320000, 640000, 1280000, 2560000,  5120000],  atk: [680, 1100, 1800,  3000, 5100], pattern: 'area',           splash: [0.35, 0.5, 0.65, 0.85, 1.0], desc: '対象周辺へ会心の風を送る。', fx: 'sweep' },
    { id: 'greatsword', name: '大剣',       icon: '⚔️', kind: '両隣',     costs: [640000, 1280000, 2560000, 5120000, 10240000], atk: [950, 1550, 2550,  4250, 7200], pattern: 'adjacent',       splash: [0.5, 0.65, 0.8, 1.0, 1.15], desc: '対象と両隣を大きく斬る。', fx: 'slash' },
  ];

  const TREE_UNLOCK_RATE = 0.30;
  const RELIC_RATE = 0.08;

  const RELICS = [
    { id: 'guard_mark', name: '守護竜の刻印', icon: '🛡️', desc: '正解時、ターゲット敵からの次回ダメージを受けない。' },
    { id: 'dual_wield', name: '双牙の契約', icon: '⚔️', desc: '武器を2つ装備できる。固有効果は発動しない。' },
    { id: 'mult_die', name: '幻月の賽', icon: '🌙', desc: '倍率1.1〜1.5の倍率ダイスを追加。' },
    { id: 'mist_step', name: '霧隠れの外套', icon: '🌫️', desc: '誤答時、一定確率で敵の攻撃カウントが進まない。' },
    { id: 'enemy_weaken', name: '封魔の鎖', icon: '⛓️', desc: '敵の攻撃力を下げる。' },
    { id: 'streak_blast', name: '連星の火花', icon: '✨', desc: '連続正解時、敵全体に弱めの攻撃。' },
    { id: 'late_tree', name: '禁書の鍵', icon: '🗝️', desc: 'スキルツリー後半を開放しやすくする。' },
    { id: 'revive', name: '不死鳥の灰', icon: '🔥', desc: '死亡時に一度だけ25%の体力で復活。' },
    { id: 'double_roll', name: '双子星の祝福', icon: '🎲', desc: '50%の確率で2度ダイスロールできる。' },
    { id: 'revenge_answer', name: '逆襲の王冠', icon: '👑', desc: '不正解3回後の正解で攻撃力×3。' },
    { id: 'drain', name: '吸血鬼の杯', icon: '🍷', desc: '与えたダメージの1%を回復。' },
    { id: 'triple_eye', name: '三眼のルーン', icon: '🔮', desc: 'ATKダイス3個がぞろ目なら攻撃力×3を加算。' },
  ];

  const PERMA_SKILL_TREE = [
    { id: 'P1', name: 'HP増加', icon: '命', desc: '転生後も最大HP +10%', costs: [1, 2, 4], effect: 'max_hp', maxLevel: 3 },
    { id: 'P2', name: '攻撃力増加', icon: '攻', desc: '転生後も攻撃力 +8%', costs: [1, 2, 4], effect: 'atk', maxLevel: 3 },
    { id: 'P3', name: '攻撃ダイス追加', icon: '剣', desc: '開始時ATKダイス +1', costs: [4], effect: 'atk_count', maxLevel: 1 },
    { id: 'P4', name: 'SPダイス追加', icon: '珠', desc: '開始時SPダイス +1', costs: [4], effect: 'sp_count', maxLevel: 1 },
    { id: 'P5', name: 'コインダイス追加', icon: '貨', desc: '開始時コインダイス +1', costs: [4], effect: 'coin_count', maxLevel: 1 },
    { id: 'P6', name: '攻撃範囲の拡大', icon: '域', desc: '転生後も攻撃範囲補正 +1段階', costs: [3, 6], effect: 'range_expand', maxLevel: 2 },
    { id: 'P7', name: '正解時微回復', icon: '癒', desc: '正解のたびに最大HPの1%→2%回復', costs: [2, 5], effect: 'correct_heal', maxLevel: 2 },
    { id: 'P8', name: 'SPの初期所持', icon: '晶', desc: '開始時SP +500', costs: [2, 3, 5], effect: 'start_sp', maxLevel: 3 },
    { id: 'P9', name: 'コインの初期所持', icon: '金', desc: '開始時コイン +300', costs: [1, 2, 3], effect: 'start_coin', maxLevel: 3 },
    { id: 'P10', name: '愛用武器継承', icon: '継', desc: '前セッションで最も使った武器をLv1で引き継ぐ', costs: [6], effect: 'inherit_favorite_weapon', maxLevel: 1 },
  ];

  const GACHA_UNLOCKABLE_NODE_IDS = ['Y4', 'Y5', 'Y6', 'Y8', 'I2', 'I6', 'I7', 'I8'];

  // スキルツリー定義
  // カテゴリ定義
  const LEGACY_SKILL_CATS = [
    { id: 'dice', label: '🎲 ダイス強化', desc: 'ダイスの種類・強さを上げる' },
    { id: 'pool', label: '➕ ダイス枠', desc: '振れるダイスの個数を増やす' },
    { id: 'battle', label: '⚔️ 戦闘スキル', desc: '戦闘に有利な特性を解放' },
  ];

  const LEGACY_SKILL_TREE = [
    // ── ダイス強化 ──
    { id: 'A1', cat: 'dice', name: 'SPダイス強化',   icon: '🎲', desc: 'D4→D6→D8→D12 と段階アップ',
      costs: [180, 420, 900], prereq: [], effect: 'sp_upgrade', maxLevel: 3, stackable: true },
    { id: 'A2', cat: 'dice', name: '攻撃ダイス解放', icon: '⚔️',  desc: '攻撃ダイス(D4)を解放',        cost: 250,  prereq: [],       effect: 'unlock_atk' },
    { id: 'B1', cat: 'dice', name: '攻撃ダイス強化', icon: '⚔️',  desc: 'D4→D6→D8 と段階アップ',
      costs: [380, 950], prereq: ['A2'], effect: 'atk_upgrade', maxLevel: 2, stackable: true },
    { id: 'C4', cat: 'dice', name: '倍率ダイス解放', icon: '⚡', desc: '倍率ダイス(D4)を解放',         cost: 1200,  prereq: ['A2'],  effect: 'unlock_mult' },

    // ── ダイス枠 ──
    { id: 'A3', cat: 'pool', name: 'ダイス枠追加',   icon: '➕', desc: '+1個ずつ追加（最大5個）',
      costs: [180, 450, 1100, 2800], prereq: [], effect: 'pool_expand', maxLevel: 4, stackable: true },
    { id: 'A4', cat: 'pool', name: 'ダイスロック',   icon: '🔓', desc: 'ダイスをクリックでロック可',   cost: 380,  prereq: ['A3'],  effect: 'unlock_lock' },

    // ── 戦闘スキル ──
    { id: 'B3', cat: 'battle', name: '役「ぞろ目」', icon: '🎰', desc: '攻撃ダイスがぞろ目→×3',      cost: 600,  prereq: ['A2'],  effect: 'combo_triple' },
    { id: 'C3', cat: 'battle', name: '役「連番」',   icon: '🃏', desc: '攻撃3個以上で連番→×2+5000', cost: 1400,  prereq: ['B3'],  effect: 'combo_seq' },
    { id: 'B6', cat: 'battle', name: '正解自動ダメージ', icon: '💥', desc: 'Lv1:400 / Lv2:1500 / Lv3:3500 ダメージ（ダイスなし）',
      costs: [600, 1600, 3500], prereq: [], effect: 'auto_dmg', maxLevel: 3, stackable: true },
    { id: 'B7', cat: 'battle', name: '基礎ダメージ強化', icon: '🔥', desc: '全ダメージ: ×1.5 → ×2.0',
      costs: [800, 2200], prereq: [], effect: 'base_dmg', maxLevel: 2, stackable: true },
  ];

  // ===================================================
  //  状態
  // ===================================================

  /** 永続保存データ */
  const SKILL_CATS = [
    { id: 'yang', label: '陽ツリー', desc: '攻撃・範囲・連鎖・武器強化を伸ばす', attr: 'yang' },
    { id: 'yin', label: '陰ツリー', desc: '弱体化・クリティカル・盤面操作を伸ばす', attr: 'yin' },
  ];

  const SKILL_TREE = [
    { id: 'Y1', cat: 'yang', attr: 'yang', name: 'HP増加', icon: '命', desc: '最大HP +8%/Lv', costs: [200, 500, 1200], prereq: [], effect: 'run_hp', maxLevel: 3, stackable: true },
    { id: 'Y2', cat: 'yang', attr: 'yang', name: 'ATKダイス面数増加', icon: '攻', desc: 'ATKダイスを D8→D10→D12→D15→D20', costs: [240, 600, 1500, 3500], prereq: [], effect: 'atk_upgrade', maxLevel: 4, stackable: true },
    { id: 'Y3', cat: 'yang', attr: 'yang', name: 'ATKダイス追加', icon: '多', desc: 'ATKダイス +1→+2→+3', costs: [450, 1100, 2800], prereq: ['Y2'], effect: 'atk_count', maxLevel: 3, stackable: true },
    { id: 'Y4', cat: 'yang', attr: 'yang', name: 'ATK低威力目削除', icon: '削', desc: 'ATKダイスの1→2→3の目を削除', costs: [380, 950, 2400], prereq: ['Y2'], effect: 'atk_floor', maxLevel: 3, stackable: true },
    { id: 'Y5', cat: 'yang', attr: 'yang', name: '攻撃範囲の拡大', icon: '域', desc: '範囲攻撃をLv1〜3で拡大', costs: [620, 1600, 4000], prereq: ['Y3'], effect: 'range_expand', maxLevel: 3, stackable: true },
    { id: 'Y6', cat: 'yang', attr: 'yang', name: 'ガチャポイント効率強化', icon: '抽', desc: '正解時のガチャ進捗 +25%/Lv', costs: [280, 700, 1800], prereq: [], effect: 'gacha_eff', maxLevel: 3, stackable: true },
    { id: 'Y7', cat: 'yang', attr: 'yang', name: 'コインダイス面数増加', icon: '貨', desc: 'コインダイスを D8→D10→D12→D15→D20', costs: [200, 500, 1200, 3000], prereq: [], effect: 'coin_upgrade', maxLevel: 4, stackable: true },
    { id: 'Y8', cat: 'yang', attr: 'yang', name: '陽SP変換効率強化', icon: '陽', desc: 'SP→陽SP変換率を上げる', costs: [260, 700, 1800], prereq: [], effect: 'yang_convert', maxLevel: 3, stackable: true },
    { id: 'I1', cat: 'yin', attr: 'yin', name: '敵攻撃力減少', icon: '弱', desc: '敵攻撃力 -6%/Lv', costs: [200, 500, 1200], prereq: [], effect: 'enemy_atk_down', maxLevel: 3, stackable: true },
    { id: 'I2', cat: 'yin', attr: 'yin', name: '敵攻撃上昇の延長', icon: '遅', desc: '時間経過による敵攻撃力上昇を遅らせる', costs: [260, 650, 1600], prereq: [], effect: 'threat_delay', maxLevel: 3, stackable: true },
    { id: 'I3', cat: 'yin', attr: 'yin', name: 'SPダイス面数増加', icon: '霊', desc: 'SPダイスを D8→D10→D12→D15→D20', costs: [200, 500, 1200, 3000], prereq: [], effect: 'sp_upgrade', maxLevel: 4, stackable: true },
    { id: 'I4', cat: 'yin', attr: 'yin', name: 'SPダイス追加', icon: '珠', desc: 'SPダイス +1→+2', costs: [380, 950], prereq: ['I3'], effect: 'sp_count', maxLevel: 2, stackable: true },
    { id: 'I5', cat: 'yin', attr: 'yin', name: 'コインダイス追加', icon: '金', desc: 'コインダイス +1→+2', costs: [380, 950], prereq: ['Y7'], effect: 'coin_count', maxLevel: 2, stackable: true },
    { id: 'I6', cat: 'yin', attr: 'yin', name: 'SP低威力目削除', icon: '削', desc: 'SPダイスの1→2の目を削除', costs: [380, 950], prereq: ['I3'], effect: 'sp_floor', maxLevel: 2, stackable: true },
    { id: 'I7', cat: 'yin', attr: 'yin', name: 'コイン低威力目削除', icon: '除', desc: 'コインダイスの1→2の目を削除', costs: [380, 950], prereq: ['Y7'], effect: 'coin_floor', maxLevel: 2, stackable: true },
    { id: 'I8', cat: 'yin', attr: 'yin', name: '陰SP変換効率強化', icon: '陰', desc: 'SP→陰SP変換率を上げる', costs: [260, 700, 1800], prereq: [], effect: 'yin_convert', maxLevel: 3, stackable: true },
  ];

  let save = {
    sp: 0,
    spYin: 0,
    spYang: 0,
    coins: 200,
    weapons: {},
    equippedWeapon: '',
    equippedWeapon2: '',
    board: null,
    gachaUnlockedTrees: [],
    gachaUnlockedNodes: [],
    gachaTickets: 0,
    correctForGacha: 0,
    relics: [],
    gachaAtkBonus: 0,
    gachaAtkFlat: 0,
    gachaHpFlat: 0,
    gachaEnemyAtkDown: 0,
    gachaEnemyTurnDelay: 0,
    weaponUseCounts: {},
    favoriteWeapon: '',
    permaSkillLevels: {},
    rebirthPoints: 0,
    unlockedNodes: [],
    skillLevels: {},   // stackableスキルのレベル管理 { 'B6': 2, ... }
    enemyIndex: 0,
    enemyHp: ENEMY_TEMPLATES[0].hp,
  };

  /** セッション中のみ有効なデータ */
  let session = {
    questions: [],
    currentQ: null,
    questionIndex: 0,
    answered: false,
    waitingRoll: false,   // 正解後、ロール待ち
    rolled: false,        // ロール済み（次の問題へ待ち）
    timerInterval: null,
    secondsLeft: 0,
    playerHp: PLAYER_BASE_HP,
    playerMaxHp: PLAYER_BASE_HP,
    enemyTurn: 0,
    enemyThreat: 1,
    correctCount: 0,
    rebirthAwarded: false,
    enemyMaxHp: 0,
    wave: 0,              // 8体ループカウント
    totalDamage: 0,
    totalSp: 0,
    defeatedEnemies: 0,
    // ダイスプール
    dicePool: [],         // { type, grade, value, locked }
    curseCount: 0,
    // ドキュメントモード連携
    docData: null,        // { questions, pdf }
    useDocFormat: false,
    docPhase: 'question', // 'question' | 'answer'
    docAnswerResults: [],
    docAnswerWasCorrect: false,
    docSpreadStart: 1,
    docSpreadMin: 1,
    docSpreadMax: 1,
    docZoom: 1.0,
    battleLog: [],
    debugMode: false,
    heldRoll: null,
    rpgView: 'question',
    boardZoom: 1,
    spConvertDraft: { yang: 0, yin: 0 },
    answerOverlay: { x: 68, y: 68, w: 360, h: 170, collapsed: false, docked: false },
  };

  // ===================================================
  //  localStorage
  // ===================================================

  function loadSave() {
    try {
      const s = localStorage.getItem(RPG_LS_KEY);
      if (s) save = Object.assign(save, JSON.parse(s));
      save.sp = Math.max(0, Number(save.sp || 0));
      save.spYin = Math.max(0, Number(save.spYin || 0));
      save.spYang = Math.max(0, Number(save.spYang || 0));
      save.coins = Math.max(0, Number(save.coins || 0));
      if (!save.weapons || typeof save.weapons !== 'object') save.weapons = {};
      if (!save.equippedWeapon) save.equippedWeapon = '';
      if (!save.skillLevels || typeof save.skillLevels !== 'object') save.skillLevels = {};
      if (!save.permaSkillLevels || typeof save.permaSkillLevels !== 'object') save.permaSkillLevels = {};
      if (!Array.isArray(save.unlockedNodes)) save.unlockedNodes = [];
      if (!Array.isArray(save.gachaUnlockedTrees)) save.gachaUnlockedTrees = [];
      if (!Array.isArray(save.gachaUnlockedNodes)) save.gachaUnlockedNodes = [];
      if (!Array.isArray(save.relics)) save.relics = [];
      save.gachaTickets = Math.max(0, Number(save.gachaTickets || 0));
      save.correctForGacha = Math.max(0, Number(save.correctForGacha || 0));
      save.rebirthPoints = Math.max(0, Number(save.rebirthPoints || 0));
      save.gachaAtkBonus = Math.max(0, Number(save.gachaAtkBonus || 0));
      save.gachaAtkFlat = Math.max(0, Number(save.gachaAtkFlat || 0));
      save.gachaHpFlat = Math.max(0, Number(save.gachaHpFlat || 0));
      save.gachaEnemyAtkDown = Math.max(0, Number(save.gachaEnemyAtkDown || 0));
      save.gachaEnemyTurnDelay = Math.max(0, Number(save.gachaEnemyTurnDelay || 0));
      if (!save.weaponUseCounts || typeof save.weaponUseCounts !== 'object') save.weaponUseCounts = {};
      save.favoriteWeapon = save.favoriteWeapon || 'bat';
      if (save.unlockedNodes.length && save.gachaUnlockedTrees.length === 0) {
        SKILL_TREE.forEach(node => {
          if (save.unlockedNodes.includes(node.id) && !save.gachaUnlockedTrees.includes(node.cat)) {
            save.gachaUnlockedTrees.push(node.cat);
          }
        });
      }
      // enemyHpが0以下なら次の敵へ（異常値修正）
      if (save.enemyHp <= 0) {
        save.enemyIndex = (save.enemyIndex + 1) % ENEMY_TEMPLATES.length;
        save.enemyHp = getEnemyTemplate(save.enemyIndex).hp;
      }
      ensureBoardState();
    } catch (e) {
      console.warn('[RPG] セーブ読込失敗', e);
    }
  }

  function writeSave() {
    try {
      localStorage.setItem(RPG_LS_KEY, JSON.stringify(save));
    } catch (e) {
      console.warn('[RPG] セーブ書込失敗', e);
    }
  }

  // ===================================================
  //  CSVパーサー（独自実装）
  // ===================================================

  function rpgParseCsvRow(line) {
    const cols = [];
    let inQ = false;
    let cur = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else { inQ = false; }
        } else {
          cur += c;
        }
      } else {
        if (c === '"') { inQ = true; }
        else if (c === ',') { cols.push(cur); cur = ''; }
        else { cur += c; }
      }
    }
    cols.push(cur);
    return cols;
  }

  function rpgParseCSV(text) {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const nonEmpty = lines.filter(l => l.trim());
    if (nonEmpty.length < 2) return [];

    const rawRows = nonEmpty.map(rpgParseCsvRow);
    const hdrRaw = rawRows[0].map(h => h.trim().toLowerCase());

    // カラムインデックスを取得（エイリアス対応）
    const aliasMap = {
      id:          ['id'],
      type:        ['type', '形式', '問題形式'],
      question:    ['question', '問題'],
      choice1:     ['choice1', '選択肢1', '選択肢１'],
      choice2:     ['choice2', '選択肢2', '選択肢２'],
      choice3:     ['choice3', '選択肢3', '選択肢３'],
      choice4:     ['choice4', '選択肢4', '選択肢４'],
      choice5:     ['choice5', '選択肢5', '選択肢５'],
      answer:      ['answer', '正解の選択肢', '正解'],
      explanation: ['explanation', '全体の解説', '全体解説'],
      category:    ['category', 'カテゴリ', 'カテゴリー'],
    };

    const idx = {};
    for (const [key, aliases] of Object.entries(aliasMap)) {
      for (const alias of aliases) {
        const found = hdrRaw.indexOf(alias.toLowerCase());
        if (found !== -1) { idx[key] = found; break; }
      }
    }

    const get = (row, key) => (idx[key] != null ? (row[idx[key]] || '') : '').trim();

    const typeNorm = (t) => {
      const v = t.toLowerCase().replace(/[_\s]/g, '');
      if (v.includes('single') || v === 'singlechoice') return 'single_choice';
      if (v.includes('multiple') || v === 'multiplechoice') return 'multiple_choice';
      if (v.includes('fill') || v.includes('blank') || v === 'fillblank') return 'fill_blank';
      return t || 'single_choice';
    };

    const questions = [];
    for (let r = 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      const type = typeNorm(get(row, 'type'));
      const question = get(row, 'question');
      const answer = get(row, 'answer');
      if (!question || !answer) continue;

      const choices = ['choice1', 'choice2', 'choice3', 'choice4', 'choice5']
        .map(k => get(row, k))
        .filter(Boolean);

      questions.push({
        id: get(row, 'id'),
        type,
        question,
        choices,
        answer,
        explanation: get(row, 'explanation'),
        category: get(row, 'category'),
      });
    }
    return questions;
  }

  // ===================================================
  //  敵テンプレート取得（wave考慮）
  // ===================================================

  function getEnemyTemplate(index) {
    const base = ENEMY_TEMPLATES[index % ENEMY_TEMPLATES.length];
    const wave = Math.floor(index / ENEMY_TEMPLATES.length);
    return {
      name: base.name,
      emoji: base.emoji,
      hp: base.hp * Math.pow(2, wave),
      reward: base.reward * Math.pow(2, wave),
    };
  }

  function getWeaponDef(id) {
    if (id === 'bare') return BARE_FIST;
    return WEAPONS.find(w => w.id === id) || null;
  }

  function getWeaponLevel(id) {
    return Math.max(0, Number((save.weapons && save.weapons[id]) || 0));
  }

  function getEquippedWeapon() {
    if (!save.equippedWeapon || getWeaponLevel(save.equippedWeapon) < 1) return BARE_FIST;
    return getWeaponDef(save.equippedWeapon) || BARE_FIST;
  }

  function getEquippedWeapons() {
    const list = [getEquippedWeapon()];
    if (hasRelic('dual_wield') && save.equippedWeapon2 && save.equippedWeapon2 !== save.equippedWeapon && getWeaponLevel(save.equippedWeapon2) > 0) {
      list.push(getWeaponDef(save.equippedWeapon2));
    }
    return list;
  }

  function getWeaponAttack(weapon, level) {
    const idx = Math.max(0, Math.min((level || 1) - 1, weapon.atk.length - 1));
    return weapon.atk[idx] || weapon.atk[0] || 0;
  }

  function getWeaponSplash(weapon, level) {
    const arr = weapon.splash || [0];
    const idx = Math.max(0, Math.min((level || 1) - 1, arr.length - 1));
    return arr[idx] || 0;
  }

  function getWeaponUpgradeCost(weapon, nextLevel) {
    const raw = weapon.costs[Math.max(0, nextLevel - 1)] || 0;
    const discount = 1;
    return Math.max(0, Math.floor(raw * discount));
  }

  function getWeaponRangeLabel(weapon) {
    const labels = {
      single: '範囲: 指定マス単体',
      vertical: '範囲: 指定マスの縦列貫通',
      verticalPierce: '範囲: 指定マスの縦列貫通',
      pierce: '範囲: 指定マスから右方向へ貫通',
      sideSplash: '範囲: 指定マス + 両横',
      row: '範囲: 横一列',
      chain: '範囲: ランダム跳弾',
      cross: '範囲: 十字',
      area: '範囲: 指定マス周辺3x3',
      adjacent: '範囲: 指定マス + 両隣',
    };
    return labels[weapon.pattern] || '範囲: 単体';
  }

  function getWeaponAbilityLabel(weapon) {
    const labels = {
      bat: '固有: 20%で2問スタン',
      spear: '固有: 前問不正解なら次の槍攻撃×2',
      sword: '固有: HP20%以下の敵を即死',
      hammer: '固有: 高火力。攻撃後に敵を左へ1マス圧縮',
      bow: '固有: 連鎖対象へ2倍ダメージ',
      whip: '固有: 生き残った敵の回復を封じる',
      boomerang: '固有: ランダム跳弾。同じ敵なら2倍',
      kusarigama: '固有: 横列を右端、縦列を上端へ引き寄せ',
      fan: '固有: 同じ場所を攻撃するほど範囲拡大',
      greatsword: '固有: 連続正解3問で×1.5、5問で×2',
    };
    return labels[weapon.id] || '固有: （未実装）';
  }

  function getCoinBonusMultiplier() {
    return 1;
  }

  function getPermaLevel(id) {
    return (save.permaSkillLevels && save.permaSkillLevels[id]) || 0;
  }

  function getPermaEffectLevel(effect) {
    return PERMA_SKILL_TREE.reduce((sum, node) => sum + (node.effect === effect ? getPermaLevel(node.id) : 0), 0);
  }

  function getSkillEffectLevel(effect) {
    return SKILL_TREE.reduce((sum, node) => sum + (node.effect === effect ? getSkillLevel(node.id) : 0), 0);
  }

  function getPlayerMaxHp() {
    const mult = 1 + getPermaEffectLevel('max_hp') * 0.10 + getSkillEffectLevel('run_hp') * 0.08;
    return Math.floor(PLAYER_BASE_HP * mult + (save.gachaHpFlat || 0));
  }

  function getPermaAtkMultiplier() {
    return 1 + getPermaEffectLevel('atk') * 0.08;
  }

  function getEnemyDamageReduction() {
    return Math.min(0.65, getSkillEffectLevel('enemy_atk_down') * 0.06 + (save.gachaEnemyAtkDown || 0) * 0.03 + (hasRelic('enemy_weaken') ? 0.12 : 0));
  }

  function resetRunProgress() {
    save.sp = 0;
    save.spYang = 0;
    save.spYin = 0;
    save.coins = 200 + getPermaEffectLevel('start_coin') * 300;
    save.unlockedNodes = [];
    save.skillLevels = {};
    save.gachaUnlockedTrees = [];
    save.gachaUnlockedNodes = [];
    save.gachaTickets = 0;
    save.correctForGacha = 0;
    save.relics = [];
    save.gachaAtkBonus = 0;
    save.gachaAtkFlat = 0;
    save.gachaHpFlat = 0;
    save.gachaEnemyAtkDown = 0;
    save.gachaEnemyTurnDelay = 0;
    save.sp = getPermaEffectLevel('start_sp') * 500;
    save.weapons = {};
    if (getPermaEffectLevel('inherit_favorite_weapon') > 0 && save.favoriteWeapon && getWeaponDef(save.favoriteWeapon)) {
      save.weapons[save.favoriteWeapon] = Math.max(1, save.weapons[save.favoriteWeapon] || 0);
      save.equippedWeapon = save.favoriteWeapon;
    } else {
      save.equippedWeapon = '';
    }
    save.equippedWeapon2 = '';
    save.board = null;
  }

  function hasRelic(id) {
    return Array.isArray(save.relics) && save.relics.includes(id);
  }

  function resetRpgProgress() {
    if (!confirm('進行データをリセットします。よろしいですか？\nSP・武器・スキルがすべてクリアされます。')) return;
    try { localStorage.removeItem(RPG_LS_KEY); } catch(e) {}
    save = { sp: 0, spYang: 0, spYin: 0, coins: 200, unlockedNodes: [], skillLevels: {}, gachaUnlockedTrees: [], gachaUnlockedNodes: [], gachaTickets: 0, correctForGacha: 0, relics: [], gachaAtkBonus: 0, gachaAtkFlat: 0, gachaHpFlat: 0, gachaEnemyAtkDown: 0, gachaEnemyTurnDelay: 0, weaponUseCounts: {}, favoriteWeapon: '', permaSkillLevels: {}, rebirthPoints: 0,
      weapons: {}, equippedWeapon: '', equippedWeapon2: '', board: null, enemyIndex: 0, enemyHp: ENEMY_TEMPLATES[0].hp };
    writeSave();
    ensureBoardState(true);
    renderEnemy();
    updateSpDisplay();
    showBattleToast('🔄 進行リセット完了');
  }

  function showGameClear() {
    const gained = awardRebirthPoints(true);
    rpgLog('🏆 全8盤面クリア！');
    endSession('8盤面クリア', '転生ポイント +' + gained + '。正解数 ' + (session.correctCount || 0) + ' 回が反映されました。');
  }

  function ensureBoardState(forceNew) {
    if (forceNew || !save.board || !Array.isArray(save.board.enemies)) {
      save.board = { stage: 1, wave: 1, enemies: [], targetId: null, targetRow: 3, targetCol: 3 };
      spawnWave(1, 1);
      return;
    }
    save.board.stage = Math.max(1, Math.min(TOTAL_STAGES, Number(save.board.stage || 1)));
    save.board.wave = 1;
    if (!save.board.enemies.length) {
      spawnWave(save.board.stage || 1, 1);
      return;
    }
    const alive = save.board.enemies.filter(e => e && e.hp > 0);
    if (!alive.length) return;
    if (!alive.some(e => e.id === save.board.targetId)) {
      const next = alive[Math.floor(Math.random() * alive.length)];
      save.board.targetId = next.id;
      save.board.targetRow = next.row;
      save.board.targetCol = next.col;
    }
  }

  function spawnWave(stage, wave) {
    const board = {
      stage: Math.max(1, stage || 1),
      wave: 1,
      enemies: [],
      targetId: null,
      targetRow: 3,
      targetCol: 3,
    };
    const baseCount = 5 + Math.min(5, board.stage);
    const control = 0;
    const count = Math.max(4, Math.min(12, baseCount - (control >= 2 ? 1 : 0)));
    const used = new Set();
    const hpScale = (0.85 + Math.pow(board.stage, 1.85) * 0.38 + (board.wave - 1) * 0.18) * (1 - control * 0.04);

    for (let i = 0; i < count; i++) {
      let pos;
      do {
        pos = Math.floor(Math.random() * BOARD_ROWS * BOARD_COLS);
      } while (used.has(pos));
      used.add(pos);

      const type = BOARD_ENEMY_TYPES[(i + board.stage) % BOARD_ENEMY_TYPES.length];
      const hp = Math.max(250, Math.floor(type.hp * hpScale));
      board.enemies.push({
        id: 'e' + Date.now().toString(36) + '_' + i + '_' + Math.floor(Math.random() * 999),
        type: type.name,
        emoji: type.emoji,
        row: Math.floor(pos / BOARD_COLS),
        col: pos % BOARD_COLS,
        maxHp: hp,
        hp: hp,
        reward: Math.floor(type.reward * hpScale),
        coins: Math.floor(type.coins * (1 + (board.stage - 1) * 0.22)),
        delay: 0,
        attackMax: 2 + ((i + board.stage) % 3) + (save.gachaEnemyTurnDelay || 0),
        attackCd: 2 + ((i + board.stage) % 3) + (save.gachaEnemyTurnDelay || 0),
      });
    }
    const alive = board.enemies.filter(e => e.hp > 0);
    const firstTarget = alive.length ? alive[Math.floor(Math.random() * alive.length)] : null;
    board.targetId = firstTarget ? firstTarget.id : null;
    board.targetRow = firstTarget ? firstTarget.row : 3;
    board.targetCol = firstTarget ? firstTarget.col : 3;
    save.board = board;
  }

  function getAliveEnemies() {
    ensureBoardState();
    return save.board.enemies.filter(e => e && e.hp > 0);
  }

  function getTargetEnemy() {
    const alive = getAliveEnemies();
    if (!alive.length) return null;
    return getEnemyAt(save.board.targetRow, save.board.targetCol) || alive.find(e => e.id === save.board.targetId) || null;
  }

  function getTargetCell() {
    ensureBoardState();
    let row = Number.isInteger(save.board.targetRow) ? save.board.targetRow : 3;
    let col = Number.isInteger(save.board.targetCol) ? save.board.targetCol : 3;
    row = Math.max(0, Math.min(BOARD_ROWS - 1, row));
    col = Math.max(0, Math.min(BOARD_COLS - 1, col));
    return { row, col, enemy: getEnemyAt(row, col) };
  }

  function setTargetCell(row, col) {
    row = Number(row);
    col = Number(col);
    if (!Number.isFinite(row) || !Number.isFinite(col)) return;
    row = Math.max(0, Math.min(BOARD_ROWS - 1, row));
    col = Math.max(0, Math.min(BOARD_COLS - 1, col));
    save.board.targetRow = row;
    save.board.targetCol = col;
    const enemy = getEnemyAt(row, col);
    save.board.targetId = enemy ? enemy.id : null;
    writeSave();
    renderEnemy();
  }

  function setTargetEnemy(id) {
    const alive = getAliveEnemies();
    const enemy = alive.find(e => e.id === id);
    if (enemy) {
      setTargetCell(enemy.row, enemy.col);
    }
  }

  function getEnemyAt(row, col) {
    return save.board.enemies.find(e => e.hp > 0 && e.row === row && e.col === col) || null;
  }

  function isBoardCell(row, col) {
    return row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLS;
  }

  function collectWeaponAreaCells(target, weapon, level) {
    if (!target) return [];
    const origin = target.enemy ? target.enemy : target;
    const cells = [];
    const seen = new Set();
    const addCell = (row, col, ratio, role) => {
      if (!isBoardCell(row, col)) return;
      const key = row + ':' + col;
      if (seen.has(key)) return;
      seen.add(key);
      cells.push({ row, col, ratio, role: role || 'splash', enemy: getEnemyAt(row, col) });
    };
    const rangeLv = Math.min(5, getSkillEffectLevel('range_expand') + getPermaEffectLevel('range_expand'));
    const splash = getWeaponSplash(weapon, level) * (1 + rangeLv * 0.08);
    addCell(origin.row, origin.col, 1, 'main');

    if (weapon.pattern === 'vertical') {
      for (let r = 0; r < BOARD_ROWS; r++) if (r !== origin.row) addCell(r, origin.col, splash, 'splash');
    } else if (weapon.pattern === 'verticalPierce') {
      for (let r = 0; r < BOARD_ROWS; r++) if (r !== origin.row) addCell(r, origin.col, splash * 2, 'pierce');
    } else if (weapon.pattern === 'pierce') {
      for (let c = origin.col + 1; c < BOARD_COLS; c++) addCell(origin.row, c, splash, 'pierce');
    } else if (weapon.pattern === 'sideSplash' || weapon.pattern === 'adjacent') {
      addCell(origin.row, origin.col - 1, splash, 'splash');
      addCell(origin.row, origin.col + 1, splash, 'splash');
    } else if (weapon.pattern === 'row') {
      for (let c = 0; c < BOARD_COLS; c++) if (c !== origin.col) addCell(origin.row, c, splash, 'splash');
    } else if (weapon.pattern === 'cross') {
      for (let r = 0; r < BOARD_ROWS; r++) if (r !== origin.row) addCell(r, origin.col, splash, 'splash');
      for (let c = 0; c < BOARD_COLS; c++) if (c !== origin.col) addCell(origin.row, c, splash, 'splash');
      if (level >= 5) {
        for (let d = -BOARD_ROWS; d <= BOARD_ROWS; d++) {
          if (d === 0) continue;
          addCell(origin.row + d, origin.col + d, splash * 0.75, 'splash');
          addCell(origin.row + d, origin.col - d, splash * 0.75, 'splash');
        }
      }
    } else if (weapon.pattern === 'area') {
      const key = origin.row + ':' + origin.col;
      const repeat = save.fanTargetKey === key ? Math.min(2, Number(save.fanTargetStack || 0)) : 0;
      const radius = 1 + Math.min(3, rangeLv) + repeat;
      for (let r = origin.row - radius; r <= origin.row + radius; r++) {
        for (let c = origin.col - radius; c <= origin.col + radius; c++) addCell(r, c, splash, 'splash');
      }
    } else if (weapon.pattern === 'chain') {
      const jumps = Math.min(7, weapon.jumps[Math.max(0, Math.min(level - 1, weapon.jumps.length - 1))] || 2);
      const alive = getAliveEnemies();
      for (let i = 0; i < jumps && alive.length; i++) {
        const e = alive[Math.floor(Math.random() * alive.length)];
        addCell(e.row, e.col, splash, 'splash');
      }
    }
    return cells;
  }

  function collectWeaponTargets(target, weapon, level) {
    if (!target) return [];
    return collectWeaponAreaCells(target, weapon, level)
      .filter(cell => cell.enemy)
      .map(cell => ({ enemy: cell.enemy, ratio: cell.ratio, role: cell.role === 'main' ? 'main' : 'splash' }));
  }

  function advanceWaveIfCleared() {
    const alive = getAliveEnemies();
    if (alive.length) {
      if (!alive.some(e => e.id === save.board.targetId)) {
        save.board.targetId = alive[Math.floor(Math.random() * alive.length)].id;
      }
      return false;
    }
    const nextStage = (save.board.stage || 1) + 1;
    if (nextStage > TOTAL_STAGES) {
      showBattleToast('🏆 Stage ' + (save.board.stage || 1) + ' クリア！');
      setTimeout(showGameClear, 800);
    } else {
      showBattleToast('🏆 Stage ' + (save.board.stage || 1) + ' クリア！');
      spawnWave(nextStage, 1);
    }
    return true;
  }

  // ===================================================
  //  スキルツリー / ダイス状態管理
  // ===================================================

  function hasNode(id) {
    return save.unlockedNodes.includes(id);
  }

  function isTreeUnlocked(catId) {
    return true;
  }

  function isNodeGachaLocked(node) {
    if (hasRelic('late_tree')) return false;
    return GACHA_UNLOCKABLE_NODE_IDS.includes(node.id) && !save.gachaUnlockedNodes.includes(node.id);
  }

  function getSkillLevel(id) {
    return (save.skillLevels && save.skillLevels[id]) || 0;
  }

  function getAttrSp(attr) {
    if (attr === 'yin') return save.spYin || 0;
    if (attr === 'yang') return save.spYang || 0;
    return save.sp || 0;
  }

  function addAttrSp(attr, amount) {
    const value = Math.max(0, Math.floor(amount || 0));
    if (!value) return;
    if (attr === 'yin') save.spYin = (save.spYin || 0) + value;
    else if (attr === 'yang') save.spYang = (save.spYang || 0) + value;
    else save.sp = (save.sp || 0) + value;
  }

  function grantGachaProgress() {
    session.correctCount = (session.correctCount || 0) + 1;
    save.correctForGacha = (save.correctForGacha || 0) + 1 + getSkillEffectLevel('gacha_eff') * 0.25;
    if (save.correctForGacha >= GACHA_CORRECTS_REQUIRED) {
      const gain = Math.floor(save.correctForGacha / GACHA_CORRECTS_REQUIRED);
      save.gachaTickets = (save.gachaTickets || 0) + gain;
      save.correctForGacha = save.correctForGacha % GACHA_CORRECTS_REQUIRED;
      showBattleToast('🎰 ガチャ権 +' + gain, 'coin');
    }
    updateSpDisplay();
    writeSave();
  }

  function handleAnswerState(isCorrect) {
    if (isCorrect) {
      session.wrongStreakBeforeCorrect = session.wrongStreak || 0;
      session.correctStreak = (session.correctStreak || 0) + 1;
      session.wrongStreak = 0;
      session.lastAnswerCorrect = true;
      const healLv = getPermaEffectLevel('correct_heal');
      if (healLv > 0) {
        const heal = Math.max(1, Math.floor(getPlayerMaxHp() * healLv * 0.01));
        session.playerHp = Math.min(getPlayerMaxHp(), (session.playerHp || getPlayerMaxHp()) + heal);
      }
      if (hasRelic('guard_mark')) {
        const target = getTargetEnemy();
        session.guardTargetId = target ? target.id : null;
      }
      if (hasRelic('streak_blast') && (session.correctStreak || 0) >= 2) {
        damageAllEnemies(120 + (session.correctStreak || 0) * 30, '✨ 連星の火花');
      }
    } else {
      session.lastAnswerCorrect = false;
      session.correctStreak = 0;
      session.wrongStreak = (session.wrongStreak || 0) + 1;
      if (hasRelic('mist_step') && Math.random() < 0.35) {
        session.skipNextEnemyAdvance = true;
        showBattleToast('🌫️ 敵の攻撃カウント停止', 'coin');
      }
    }
  }

  function calculateRebirthGain(isClear) {
    const correct = session.correctCount || 0;
    const stage = (save.board && save.board.stage) || 1;
    return Math.max(1, Math.floor(correct / 3) + Math.max(0, stage - 1) + (isClear ? 5 : 0));
  }

  function getEnemyRebirthReward(enemy) {
    const stage = (save.board && save.board.stage) || 1;
    const hpBonus = Math.floor(Math.max(0, enemy && enemy.maxHp || 0) / 2600);
    return Math.max(1, 1 + Math.floor(Math.max(0, stage - 1) / 3) + hpBonus);
  }

  function grantEnemyRebirthRewards(defeated) {
    if (!Array.isArray(defeated) || !defeated.length) return 0;
    const gained = defeated.reduce((sum, enemy) => sum + getEnemyRebirthReward(enemy), 0);
    save.rebirthPoints = (save.rebirthPoints || 0) + gained;
    showBattleToast('♾️ 転生P +' + gained.toLocaleString(), 'coin');
    return gained;
  }

  function awardRebirthPoints(isClear) {
    if (session.rebirthAwarded) return 0;
    const gained = calculateRebirthGain(isClear);
    save.rebirthPoints = (save.rebirthPoints || 0) + gained;
    session.rebirthAwarded = true;
    return gained;
  }

  function spendAttrSp(attr, amount) {
    const value = Math.max(0, Math.floor(amount || 0));
    if (getAttrSp(attr) < value) return false;
    if (attr === 'yin') save.spYin -= value;
    else if (attr === 'yang') save.spYang -= value;
    else save.sp = Math.max(0, (save.sp || 0) - value);
    return true;
  }

  function getNodeAttr(node) {
    return node.attr || (SKILL_CATS.find(cat => cat.id === node.cat)?.attr) || 'yin';
  }

  function getNodeCostLabel(node, cost) {
    const meta = RPG_SP_TYPES[getNodeAttr(node)] || RPG_SP_TYPES.yin;
    return meta.icon + ' ' + cost.toLocaleString();
  }

  function getEffect(effect) {
    return save.unlockedNodes.some(id => {
      const node = SKILL_TREE.find(n => n.id === id);
      return node && node.effect === effect;
    });
  }

  function gradeFromLevel(lv) {
    return PROGRESSION_DICE_GRADES[Math.min(Math.max(lv || 0, 0), PROGRESSION_DICE_GRADES.length - 1)];
  }

  function getSpDiceGrade() {
    return gradeFromLevel(getSkillEffectLevel('sp_upgrade'));
  }

  function getSpDiceGradeByAttr(attr) {
    return getSpDiceGrade();
  }

  function getAtkDiceGrade() {
    return gradeFromLevel(getSkillEffectLevel('atk_upgrade'));
  }

  function getMultDiceGrade() {
    return 'D5';
  }

  function getMaxPoolSize() {
    return 16;
  }

  function getDiceCount(type) {
    if (type === 'atk') return 1 + Math.min(3, getSkillEffectLevel('atk_count')) + Math.min(1, getPermaEffectLevel('atk_count'));
    if (type === 'sp') return 1 + Math.min(2, getSkillEffectLevel('sp_count')) + Math.min(1, getPermaEffectLevel('sp_count'));
    if (type === 'coin') return 1 + Math.min(2, getSkillEffectLevel('coin_count')) + Math.min(1, getPermaEffectLevel('coin_count'));
    if (type === 'mult') return hasRelic('mult_die') ? 1 : 0;
    return 1;
  }

  /** 初期ダイスプールを構築 */
  function buildInitialDicePool() {
    const pool = [];
    for (let i = 0; i < getDiceCount('sp'); i++) pool.push({ type: 'sp', grade: getSpDiceGrade(), value: null, locked: false });
    for (let i = 0; i < getDiceCount('coin'); i++) pool.push({ type: 'coin', grade: gradeFromLevel(getSkillEffectLevel('coin_upgrade')), value: null, locked: false });
    for (let i = 0; i < getDiceCount('atk'); i++) pool.push({ type: 'atk', grade: getAtkDiceGrade(), value: null, locked: false });
    if (getDiceCount('mult')) pool.push({ type: 'mult', grade: getMultDiceGrade(), value: null, locked: false });

    // 最大サイズにクランプ
    return pool.slice(0, getMaxPoolSize());
  }

  function getDiceMinFace(type) {
    if (type === 'atk') return 1 + Math.min(3, getSkillEffectLevel('atk_floor'));
    if (type === 'sp') return 1 + Math.min(2, getSkillEffectLevel('sp_floor'));
    if (type === 'coin') return 1 + Math.min(2, getSkillEffectLevel('coin_floor'));
    return 1;
  }

  function rollDieValue(d) {
    if (d.type === 'mult') return (Math.floor(Math.random() * 5) + 11) * 10;
    const faces = DICE_GRADES[d.grade] || 8;
    const minFace = Math.min(faces, getDiceMinFace(d.type));
    return (Math.floor(Math.random() * (faces - minFace + 1)) + minFace) * 100;
  }

  /** ダイスに呪いを追加 */
  function addCurseDie() {
    // 呪いダイスは現在無効
  }

  // ===================================================
  //  画面切替
  // ===================================================

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => {
      s.classList.toggle('hidden', s.id !== id);
      s.classList.toggle('active', s.id === id);
    });
  }

  function setRpgView(view) {
    if (view === 'battle') view = 'roll';
    session.rpgView = view || 'question';
    const screen = document.getElementById('screen-rpg');
    if (screen) screen.dataset.rpgView = session.rpgView;
    document.querySelectorAll('.rpg-view-tab').forEach(btn => {
      const disabled = btn.dataset.view === 'explain' && !session.answered;
      btn.disabled = disabled;
      btn.classList.toggle('active', btn.dataset.view === session.rpgView);
    });
  }

  function getRpgViewOrder() {
    return session.answered ? ['question', 'explain', 'roll'] : ['question', 'roll'];
  }

  function moveRpgView(delta) {
    const order = getRpgViewOrder();
    const current = order.indexOf(session.rpgView);
    const next = order[Math.max(0, Math.min(order.length - 1, (current === -1 ? 0 : current) + delta))];
    setRpgView(next);
  }

  // ===================================================
  //  RPGセッション開始
  // ===================================================

  window.startRpgMode = function () {
    showScreen('screen-rpg');
    // ドキュメントモードで読み込み済みのデータを優先使用
    if (window._rpgDocData && window._rpgDocData.questions && window._rpgDocData.questions.length > 0) {
      rpgStartDocSession(window._rpgDocData);
      return;
    }
    const fileInput = document.getElementById('csvFile');
    if (fileInput && fileInput.files[0]) {
      const reader = new FileReader();
      reader.onload = function (e) {
        const qs = rpgParseCSV(e.target.result);
        if (!qs || qs.length === 0) { showRpgCsvPicker(); return; }
        rpgStartSession(qs);
      };
      reader.onerror = function () { showRpgCsvPicker(); };
      reader.readAsText(fileInput.files[0], 'UTF-8');
    } else {
      showRpgCsvPicker();
    }
  };

  /** CSVが未ロードの場合に問題パネル内にファイル選択UIを表示 */
  function showRpgCsvPicker() {
    const qPanel = document.getElementById('rpg-panel-question');
    if (!qPanel) return;
    qPanel.innerHTML = `
      <div class="rpg-csv-picker">
        <div class="rpg-csv-picker-icon">📂</div>
        <p class="rpg-csv-picker-title">CSVファイルを読み込んでください</p>
        <p class="rpg-csv-picker-sub">問題CSVを選択するとRPGセッションが始まります</p>
        <label class="rpg-csv-picker-label">
          <input type="file" id="rpg-csv-input" accept=".csv" style="display:none">
          ファイルを選択
        </label>
      </div>
    `;
    document.getElementById('rpg-csv-input').addEventListener('change', function (e) {
      if (!e.target.files[0]) return;
      const reader = new FileReader();
      reader.onload = function (ev) {
        const qs = rpgParseCSV(ev.target.result);
        if (!qs || qs.length === 0) {
          alert('CSVの問題が読み込めませんでした。フォーマットを確認してください。');
          return;
        }
        rpgStartSession(qs);
      };
      reader.readAsText(e.target.files[0], 'UTF-8');
    });
  }

  // ===================================================
  //  ドキュメントモード連携（PDF問題）
  // ===================================================

  let rpgDocRenderSerial = 0;

  function rpgStartDocSession(docData) {
    loadSave();

    session.docData = docData;
    session.useDocFormat = true;
    session.questions = shuffleArray(docData.questions.slice());
    session.questionIndex = 0;
    session.answered = false;
    session.waitingRoll = false;
    session.rolled = false;
    session.secondsLeft = 0;
    session.playerMaxHp = getPlayerMaxHp();
    session.playerHp = session.playerMaxHp;
    session.enemyTurn = 0;
    session.enemyThreat = 1;
    session.correctCount = 0;
    session.correctStreak = 0;
    session.wrongStreak = 0;
    session.wrongStreakBeforeCorrect = 0;
    session.lastAnswerCorrect = null;
    session.guardTargetId = null;
    session.skipNextEnemyAdvance = false;
    session.reviveUsed = false;
    session.rebirthAwarded = false;
    session.totalDamage = 0;
    session.totalSp = 0;
    session.defeatedEnemies = 0;
    session.heldRoll = null;
    session.curseCount = 0;
    session.docPhase = 'question';
    session.docAnswerResults = [];
    session.docAnswerWasCorrect = false;
    session.docZoom = 1.0;

    ensureBoardState();

    session.dicePool = buildInitialDicePool();

    renderEnemy();
    renderDicePool();
    updateHpBar();
    updateTimerBar();
    updateSpDisplay();
    setRpgView('question');

    nextDocQuestion();
    stopTimer();
    updateTimerDisplay();
  }

  function nextDocQuestion() {
    if (session.currentQ && session.answered) {
      if (session.skipNextEnemyAdvance) {
        session.skipNextEnemyAdvance = false;
      } else {
        advanceEnemyAttackCounters();
      }
      if (session.playerHp <= 0) return;
    }
    if (session.questionIndex >= session.questions.length) {
      session.questions = shuffleArray(session.questions.slice());
      session.questionIndex = 0;
    }
    session.currentQ = session.questions[session.questionIndex++];
    session.answered = false;
    session.waitingRoll = false;
    session.rolled = false;
    session.doubleRollUsed = false;
    session.docPhase = 'question';
    session.docAnswerResults = [];
    session.docAnswerWasCorrect = false;

    session.dicePool.forEach(function (d) {
      if (!d.locked) d.value = null;
    });

    renderDocQuestion();
    renderDicePool();
    setRpgView('question');
  }

  function renderDocQuestion() {
    var q = session.currentQ;
    if (!q) return;
    var panel = document.getElementById('rpg-panel-question');
    if (!panel) return;

    var isAnswer = session.docPhase === 'answer';

    // ページ範囲の設定
    var spreadMin, spreadMax;
    if (isAnswer) {
      spreadMin = q.answerPage;
      spreadMax = q.answerEnd || q.answerPage + 1;
    } else {
      spreadMin = q.questionStart;
      spreadMax = q.questionEnd;
    }
    session.docSpreadMin = spreadMin;
    session.docSpreadMax = spreadMax;
    if (!session.docSpreadStart || session.docSpreadStart < spreadMin || session.docSpreadStart > spreadMax) {
      session.docSpreadStart = spreadMin;
    }

    // 回答入力エリアHTML
    var quickValues = ['○', '×', 'ア', 'イ', 'ウ', 'エ', 'オ', '1', '2', '3', '4', '5'];
    var inputsHtml = '';
    if (!isAnswer) {
      inputsHtml = q.subQuestions.map(function (sub, i) {
        var qv = quickValues.map(function (v) {
          return '<button type="button" class="rpg-doc-quick-input" data-answer-index="' + i + '" data-value="' + escHtml(v) + '">' + escHtml(v) + '</button>';
        }).join('');
        return '<label class="rpg-doc-answer-field">' +
          '<span class="rpg-doc-answer-range">' + escHtml(sub.range) + '</span>' +
          '<input class="rpg-doc-answer-input" data-answer-index="' + i + '" type="text" autocomplete="off" placeholder="答えを入力">' +
          '<div class="rpg-doc-quick-inputs">' + qv +
          '<button type="button" class="rpg-doc-quick-input is-clear" data-answer-index="' + i + '" data-action="clear">クリア</button></div>' +
          '</label>';
      }).join('');
    } else {
      var resultClass = session.docAnswerWasCorrect ? 'rpg-doc-result-correct' : 'rpg-doc-result-wrong';
      var resultLabel = session.docAnswerWasCorrect ? '✓ 正解！' : '✗ 不正解';
      var results = session.docAnswerResults.length ? session.docAnswerResults : q.subQuestions.map(function (sub) {
        return { range: sub.range, submitted: '', answers: sub.answers, isCorrect: false };
      });
      var detailHtml = results.map(function (r) {
        return '<div class="rpg-doc-result-detail ' + (r.isCorrect ? 'is-correct' : 'is-wrong') + '">' +
          '<b>' + escHtml(r.range) + '</b>' +
          '<em>' + (r.isCorrect ? '正解' : '不正解') + '</em>' +
          '<span>入力 = ' + escHtml(r.submitted || '-') + '</span>' +
          '<span>正解 = ' + escHtml(r.answers.join(' / ')) + '</span>' +
          '</div>';
      }).join('');
      inputsHtml = '<div class="rpg-doc-result-block ' + resultClass + '"><strong>' + resultLabel + '</strong><div class="rpg-doc-result-details">' + detailHtml + '</div></div>';
    }

    // アクションエリアHTML
    var actionHtml = '';
    if (!isAnswer) {
      actionHtml = '<div class="rpg-action-row" id="rpg-action-row">' +
        '<button class="rpg-btn-answer" id="rpg-btn-answer">回答する</button>' +
        '</div>';
    } else if (session.docAnswerWasCorrect) {
      actionHtml = '<div class="rpg-action-row" id="rpg-action-row">' +
        '<p style="font-size:13px;color:#c9a84c;margin-bottom:0;">ダイスをロールして攻撃！</p>' +
        '</div>';
    } else {
      actionHtml = '<div class="rpg-action-row" id="rpg-action-row">' +
        '<button class="rpg-btn-next" id="rpg-doc-next-btn">次の問題へ →</button>' +
        '</div>';
    }

    // 出題範囲バナー
    var rangeChips = q.subQuestions.map(function (sub) {
      return '<span class="rpg-q-range-chip">' + escHtml(sub.range) + '</span>';
    }).join('');
    var pageInfo = 'p.' + q.questionStart + (q.questionEnd > q.questionStart ? '〜' + q.questionEnd : '');
    var bannerHtml = '<div class="rpg-q-banner' + (isAnswer ? ' is-answer' : '') + '">' +
      '<div class="rpg-q-banner-no">第' + escHtml(String(q.questionNo)) + '問</div>' +
      '<div class="rpg-q-banner-ranges">' +
        '<span class="rpg-q-banner-label">' + (isAnswer ? '解答・解説' : '回答欄') + '</span>' +
        rangeChips +
      '</div>' +
      '<div class="rpg-q-banner-page">' + pageInfo + '</div>' +
    '</div>';

    // パネルHTML
    panel.innerHTML = '<div class="rpg-doc-question">' +
      bannerHtml +
      '<div class="rpg-doc-meta">' +
      '<span class="rpg-q-badge">第' + escHtml(String(q.questionNo)) + '問</span>' +
      '<span class="rpg-doc-phase-label' + (isAnswer ? ' is-answer' : '') + '">' + (isAnswer ? '解答・解説ページ' : '問題ページ') + '</span>' +
      (session.debugMode && !isAnswer ? '<span class="rpg-debug-badge">🐛 DEBUG</span>' : '') +
      (isAnswer ? '' :
        '<div class="rpg-doc-page-nav">' +
        '<button class="rpg-doc-nav-btn" id="rpg-doc-prev-page"' + (session.docSpreadStart <= spreadMin ? ' disabled' : '') + '>←</button>' +
        '<span class="rpg-doc-page-range" id="rpg-doc-page-range">PDF ' + session.docSpreadStart + (session.docSpreadStart + 1 <= spreadMax ? '-' + (session.docSpreadStart + 1) : '') + '</span>' +
        '<button class="rpg-doc-nav-btn" id="rpg-doc-next-page"' + (session.docSpreadStart + 2 > spreadMax ? ' disabled' : '') + '>→</button>' +
        '</div>'
      ) +
      '<div class="rpg-doc-zoom-controls">' +
      '<button class="rpg-doc-zoom-btn" id="rpg-doc-zoom-out">−</button>' +
      '<span class="rpg-doc-zoom-label" id="rpg-doc-zoom-label">' + Math.round((session.docZoom || 1) * 100) + '%</span>' +
      '<button class="rpg-doc-zoom-btn" id="rpg-doc-zoom-in">＋</button>' +
      '</div>' +
      '</div>' +
      '<div class="rpg-doc-pdf-spread" id="rpg-doc-pdf-spread">' +
      (isAnswer ? buildAnswerSpreadHtml(q) :
        session.debugMode ? (
          '<figure class="rpg-doc-pdf-page"><canvas id="rpg-pdf-left"></canvas></figure>' +
          '<figure class="rpg-doc-pdf-page"><canvas id="rpg-pdf-right"></canvas></figure>' +
          '<div class="rpg-doc-spread-divider">｜解説(DEBUG)</div>' +
          buildDebugAnswerHtml(q)
        ) :
        '<figure class="rpg-doc-pdf-page"><canvas id="rpg-pdf-left"></canvas></figure>' +
        '<figure class="rpg-doc-pdf-page"><canvas id="rpg-pdf-right"></canvas></figure>'
      ) +
      '</div>' +
      '<div class="rpg-doc-answer-section rpg-answer-overlay' + (session.answerOverlay.docked ? ' is-docked' : '') + '" id="rpg-answer-overlay"' +
        (!session.answerOverlay.docked ? ' style="left:' + session.answerOverlay.x + 'px;top:' + session.answerOverlay.y + 'px;width:' + session.answerOverlay.w + 'px;min-height:' + session.answerOverlay.h + 'px;"' : '') + '>' +
      '<div class="rpg-answer-overlay-head" id="rpg-answer-overlay-drag">' +
        '<span>' + (isAnswer ? '判定' : '回答') + '</span>' +
        '<button type="button" class="rpg-overlay-dock-btn" id="rpg-answer-overlay-dock" title="解答欄の隣に固定">' + (session.answerOverlay.docked ? '🔓' : '📌') + '</button>' +
        '<button type="button" id="rpg-answer-overlay-toggle">−</button>' +
      '</div>' +
      '<div class="rpg-doc-inputs" id="rpg-doc-inputs">' + inputsHtml + '</div>' +
      actionHtml +
      '<span class="rpg-answer-overlay-resize" id="rpg-answer-overlay-resize"></span>' +
      '<span class="rpg-answer-overlay-move-br" id="rpg-answer-overlay-move-br" title="ドラッグで移動">⠿</span>' +
      '</div>' +
      '</div>';

    // PDF描画
    renderRpgPdfSpread();
    initAnswerOverlay();

    // ページナビイベント
    var prevBtn = document.getElementById('rpg-doc-prev-page');
    var nextBtn = document.getElementById('rpg-doc-next-page');
    if (prevBtn) prevBtn.addEventListener('click', function () { changeRpgDocSpread(-2); });
    if (nextBtn) nextBtn.addEventListener('click', function () { changeRpgDocSpread(2); });

    // ズームイベント
    var zoomInBtn = document.getElementById('rpg-doc-zoom-in');
    var zoomOutBtn = document.getElementById('rpg-doc-zoom-out');
    if (zoomInBtn) zoomInBtn.addEventListener('click', function () { changeRpgDocZoom(0.2); });
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', function () { changeRpgDocZoom(-0.2); });

    if (!isAnswer) {
      var ansBtn = document.getElementById('rpg-btn-answer');
      if (ansBtn) ansBtn.addEventListener('click', submitDocAnswer);

      // クイック入力
      var inputsArea = document.getElementById('rpg-doc-inputs');
      if (inputsArea) {
        inputsArea.addEventListener('click', function (e) {
          var btn = e.target.closest('.rpg-doc-quick-input');
          if (!btn) return;
          var idx = btn.dataset.answerIndex;
          var inp = inputsArea.querySelector('.rpg-doc-answer-input[data-answer-index="' + idx + '"]');
          if (!inp) return;
          if (btn.dataset.action === 'clear') { inp.value = ''; }
          else { inp.value = btn.dataset.value || ''; }
          inp.focus();
        });
      }
      setTimeout(function () {
        var firstInput = document.querySelector('.rpg-doc-answer-input');
        if (firstInput) firstInput.focus();
      }, 50);
    } else {
      var docNextBtn = document.getElementById('rpg-doc-next-btn');
      if (docNextBtn) docNextBtn.addEventListener('click', nextDocQuestion);
    }
  }

  function changeRpgDocSpread(delta) {
    session.docSpreadStart = Math.max(session.docSpreadMin,
      Math.min(session.docSpreadMax, session.docSpreadStart + delta));
    var right = session.docSpreadStart + 1 <= session.docSpreadMax ? session.docSpreadStart + 1 : null;
    var rangeEl = document.getElementById('rpg-doc-page-range');
    if (rangeEl) rangeEl.textContent = 'PDF ' + session.docSpreadStart + (right ? '-' + right : '');
    var prevBtn = document.getElementById('rpg-doc-prev-page');
    var nextBtn = document.getElementById('rpg-doc-next-page');
    if (prevBtn) prevBtn.disabled = session.docSpreadStart <= session.docSpreadMin;
    if (nextBtn) nextBtn.disabled = session.docSpreadStart + 2 > session.docSpreadMax;
    renderRpgPdfSpread();
  }

  function initAnswerOverlay() {
    const overlay = document.getElementById('rpg-answer-overlay');
    const drag = document.getElementById('rpg-answer-overlay-drag');
    const resize = document.getElementById('rpg-answer-overlay-resize');
    const toggle = document.getElementById('rpg-answer-overlay-toggle');
    const dockBtn = document.getElementById('rpg-answer-overlay-dock');
    const moveBr = document.getElementById('rpg-answer-overlay-move-br');
    if (!overlay || !drag) return;

    overlay.classList.toggle('is-collapsed', !!session.answerOverlay.collapsed);
    if (toggle) {
      toggle.textContent = session.answerOverlay.collapsed ? '+' : '−';
      toggle.addEventListener('click', function (e) {
        e.stopPropagation();
        session.answerOverlay.collapsed = !session.answerOverlay.collapsed;
        overlay.classList.toggle('is-collapsed', session.answerOverlay.collapsed);
        toggle.textContent = session.answerOverlay.collapsed ? '+' : '−';
      });
    }

    // ドックボタン: バナー下に固定/フロートを切り替え
    if (dockBtn) {
      dockBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        session.answerOverlay.docked = !session.answerOverlay.docked;
        if (session.answerOverlay.docked) {
          overlay.classList.add('is-docked');
          overlay.removeAttribute('style');
        } else {
          overlay.classList.remove('is-docked');
          overlay.style.left = session.answerOverlay.x + 'px';
          overlay.style.top  = session.answerOverlay.y + 'px';
          overlay.style.width = session.answerOverlay.w + 'px';
          overlay.style.minHeight = session.answerOverlay.h + 'px';
        }
        dockBtn.textContent = session.answerOverlay.docked ? '🔓' : '📌';
      });
    }

    function makeDragHandler(handle) {
      handle.addEventListener('pointerdown', function (e) {
        if (session.answerOverlay.docked) return;
        var skipIds = ['rpg-answer-overlay-toggle', 'rpg-answer-overlay-dock'];
        if (e.target && skipIds.includes(e.target.id)) return;
        overlay.setPointerCapture(e.pointerId);
        const startX = e.clientX;
        const startY = e.clientY;
        const startLeft = session.answerOverlay.x;
        const startTop = session.answerOverlay.y;
        const move = function (ev) {
          session.answerOverlay.x = Math.max(8, startLeft + ev.clientX - startX);
          session.answerOverlay.y = Math.max(8, startTop + ev.clientY - startY);
          overlay.style.left = session.answerOverlay.x + 'px';
          overlay.style.top = session.answerOverlay.y + 'px';
        };
        const up = function () {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      });
    }

    makeDragHandler(drag);
    if (moveBr) makeDragHandler(moveBr);

    if (resize) {
      resize.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        overlay.setPointerCapture(e.pointerId);
        const startX = e.clientX;
        const startY = e.clientY;
        const startW = session.answerOverlay.w;
        const startH = session.answerOverlay.h;
        const move = function (ev) {
          session.answerOverlay.w = Math.max(260, startW + ev.clientX - startX);
          session.answerOverlay.h = Math.max(110, startH + ev.clientY - startY);
          overlay.style.width = session.answerOverlay.w + 'px';
          overlay.style.minHeight = session.answerOverlay.h + 'px';
        };
        const up = function () {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      });
    }
  }

  function changeRpgDocZoom(delta) {
    session.docZoom = Math.min(3.0, Math.max(0.4, Math.round((session.docZoom + delta) * 10) / 10));
    var labelEl = document.getElementById('rpg-doc-zoom-label');
    if (labelEl) labelEl.textContent = Math.round(session.docZoom * 100) + '%';
    renderRpgPdfSpread();
  }

  function buildDebugAnswerHtml(q) {
    var html = '<div class="rpg-doc-spread-section">';
    html += '<div class="rpg-doc-spread-label" style="color:#e74c3c">📝 解説(DEBUG)</div>';
    var ansEnd = q.answerEnd || q.answerPage;
    for (var p = q.answerPage; p <= ansEnd; p++) {
      html += '<figure class="rpg-doc-pdf-page"><canvas id="rpg-pdf-dbg' + (p - q.answerPage) + '"></canvas></figure>';
    }
    html += '</div>';
    return html;
  }

  function buildAnswerSpreadHtml(q) {
    var html = '<div class="rpg-doc-spread-section">';
    html += '<div class="rpg-doc-spread-label">📝 解説</div>';
    var ansEnd = q.answerEnd || q.answerPage;
    for (var p = q.answerPage; p <= ansEnd; p++) {
      html += '<figure class="rpg-doc-pdf-page"><canvas id="rpg-pdf-a' + (p - q.answerPage) + '"></canvas></figure>';
    }
    html += '</div>';
    html += '<div class="rpg-doc-spread-divider">｜元問題</div>';
    html += '<div class="rpg-doc-spread-section">';
    html += '<div class="rpg-doc-spread-label">📄 元問題</div>';
    var qEnd = q.questionEnd || q.questionStart;
    for (var p = q.questionStart; p <= qEnd; p++) {
      html += '<figure class="rpg-doc-pdf-page"><canvas id="rpg-pdf-q' + (p - q.questionStart) + '"></canvas></figure>';
    }
    html += '</div>';
    return html;
  }

  function renderRpgPdfSpread() {
    var serial = ++rpgDocRenderSerial;
    if (session.docPhase === 'answer') {
      var q = session.currentQ;
      if (!q) return;
      var promises = [];
      var ansEnd = q.answerEnd || q.answerPage;
      var qEnd = q.questionEnd || q.questionStart;
      for (var ap = q.answerPage; ap <= ansEnd; ap++) {
        promises.push(renderRpgPdfPage('rpg-pdf-a' + (ap - q.answerPage), ap, serial));
      }
      for (var qp = q.questionStart; qp <= qEnd; qp++) {
        promises.push(renderRpgPdfPage('rpg-pdf-q' + (qp - q.questionStart), qp, serial));
      }
      Promise.all(promises);
      return;
    }
    var left = session.docSpreadStart;
    var right = left + 1 <= session.docSpreadMax ? left + 1 : null;
    var promises = [
      renderRpgPdfPage('rpg-pdf-left', left, serial),
      renderRpgPdfPage('rpg-pdf-right', right, serial),
    ];
    if (session.debugMode) {
      var q2 = session.currentQ;
      if (q2) {
        var ansEnd2 = q2.answerEnd || q2.answerPage;
        for (var dp = q2.answerPage; dp <= ansEnd2; dp++) {
          promises.push(renderRpgPdfPage('rpg-pdf-dbg' + (dp - q2.answerPage), dp, serial));
        }
      }
    }
    Promise.all(promises);
  }

  function renderRpgPdfPage(canvasId, pageNumber, serial) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return Promise.resolve();
    var context = canvas.getContext('2d');
    if (!pageNumber || !session.docData || !session.docData.pdf) {
      canvas.width = 1;
      canvas.height = 1;
      context.clearRect(0, 0, 1, 1);
      if (canvas.parentElement) canvas.parentElement.classList.add('is-empty');
      return Promise.resolve();
    }
    return session.docData.pdf.getPage(pageNumber).then(function (page) {
      if (serial !== rpgDocRenderSerial) return;
      var initial = page.getViewport({ scale: 1 });
      // A4基準: 横幅でパネル半分にフィット → zoom倍率を掛ける
      var panel = document.getElementById('rpg-panel-question');
      var panelWidth = panel ? panel.clientWidth : 700;
      var basePageWidth = Math.max(240, Math.floor(panelWidth / 2) - 20);
      var baseScale = basePageWidth / initial.width;
      var zoom = session.docZoom || 1.0;
      var scale = baseScale * zoom;
      var pixelRatio = Math.min(2, window.devicePixelRatio || 1);
      var viewport = page.getViewport({ scale: scale * pixelRatio });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      canvas.style.width = Math.ceil(viewport.width / pixelRatio) + 'px';
      canvas.style.height = Math.ceil(viewport.height / pixelRatio) + 'px';
      if (canvas.parentElement) canvas.parentElement.classList.remove('is-empty');
      return page.render({ canvasContext: context, viewport: viewport }).promise;
    }).catch(function (e) {
      console.warn('[RPG] PDF描画エラー', e);
    });
  }

  function normalizeRpgAnswer(value) {
    return String(value || '').normalize('NFKC').trim().toLowerCase()
      .replace(/\s+/g, '').replace(/[，,]/g, '');
  }

  function submitDocAnswer() {
    if (session.answered || session.docPhase !== 'question') return;
    var q = session.currentQ;
    if (!q) return;

    var inputs = Array.from(document.querySelectorAll('.rpg-doc-answer-input'));
    var submitted = inputs.map(function (inp) { return normalizeRpgAnswer(inp.value); });
    var emptyIdx = submitted.findIndex(function (s) { return !s; });
    if (emptyIdx !== -1) {
      var emptyInput = inputs[emptyIdx];
      if (emptyInput) emptyInput.focus();
      return;
    }

    session.docAnswerResults = q.subQuestions.map(function (sub, i) {
      var isCorrect = sub.answers.some(function (a) { return normalizeRpgAnswer(a) === submitted[i]; });
      return {
        range: sub.range,
        submitted: inputs[i].value.trim(),
        answers: sub.answers,
        isCorrect: isCorrect,
      };
    });
    session.docAnswerWasCorrect = session.docAnswerResults.every(function (r) { return r.isCorrect; });
    session.answered = true;
    session.docPhase = 'answer';
    handleAnswerState(session.docAnswerWasCorrect);

    // 解答ページへ切り替え
    session.docSpreadStart = q.answerPage;
    session.docSpreadMin = q.answerPage;
    session.docSpreadMax = q.answerEnd || q.answerPage + 1;

    // フラッシュ
    var panel = document.getElementById('rpg-panel-question');
    if (panel) {
      panel.classList.remove('flash-correct', 'flash-wrong');
      void panel.offsetWidth;
      panel.classList.add(session.docAnswerWasCorrect ? 'flash-correct' : 'flash-wrong');
    }

    showAnswerFlash(session.docAnswerWasCorrect);
    playRpgSe(session.docAnswerWasCorrect ? 'correct' : 'wrong');

    if (session.docAnswerWasCorrect) {
      session.waitingRoll = true;
      triggerCorrectRelics();
      grantGachaProgress();
      rpgLog('第' + q.questionNo + '問 ✓ 正解！ダイスロール待ち');
    } else {
      rpgLog('第' + q.questionNo + '問 ✗ 不正解');
    }

    renderDocQuestion();
    renderDicePool();
    setRpgView('explain');
  }

  /** SELECT ROUTEダイアログにRPGボタンを注入する */
  function tryInjectRpgIntoSelectRoute() {
    const options = document.querySelector('#documentModeSelect .document-mode-options');
    if (!options) return;
    if (options.querySelector('[data-document-mode="rpg"]')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-document-mode', 'rpg');
    btn.innerHTML = '<strong>⚔️ RPGモード</strong><span>正解でダイスを振り、SPでスキルを解放しながら敵を倒す</span>';
    btn.addEventListener('click', function (e) {
      e.stopPropagation(); // document-mode.jsのイベント委譲を止める
      window.startRpgMode && window.startRpgMode();
    });
    options.appendChild(btn);
  }

  /** documentModeSelectが表示されたときにRPGボタンを注入するMutationObserver */
  function watchForSelectRoute() {
    // 初回試行（既にDOMにある場合）
    tryInjectRpgIntoSelectRoute();
    const observer = new MutationObserver(function () {
      tryInjectRpgIntoSelectRoute();
    });
    observer.observe(document.body, { childList: true, subtree: true,
                                      attributes: true, attributeFilter: ['class'] });
  }

  function rpgStartSession(questions) {
    loadSave();

    // セッション初期化
    session.questions = shuffleArray(questions.slice());
    session.questionIndex = 0;
    session.answered = false;
    session.waitingRoll = false;
    session.rolled = false;
    session.doubleRollUsed = false;
    session.secondsLeft = 0;
    session.playerMaxHp = getPlayerMaxHp();
    session.playerHp = session.playerMaxHp;
    session.enemyTurn = 0;
    session.enemyThreat = 1;
    session.correctCount = 0;
    session.correctStreak = 0;
    session.wrongStreak = 0;
    session.wrongStreakBeforeCorrect = 0;
    session.lastAnswerCorrect = null;
    session.guardTargetId = null;
    session.skipNextEnemyAdvance = false;
    session.reviveUsed = false;
    session.rebirthAwarded = false;
    session.totalDamage = 0;
    session.totalSp = 0;
    session.defeatedEnemies = 0;
    session.heldRoll = null;
    session.curseCount = 0;

    // 敵HP初期化（saveから復元）
    ensureBoardState();

    // ダイスプール構築
    session.dicePool = buildInitialDicePool();

    // UI更新
    renderEnemy();
    renderDicePool();
    updateHpBar();
    updateTimerBar();
    updateSpDisplay();
    setRpgView('question');

    // 最初の問題
    nextQuestion();

    // タイマー開始
    stopTimer();
    updateTimerDisplay();
  }

  // ===================================================
  //  タイマー
  // ===================================================

  function startTimer() {
    stopTimer();
    updateTimerDisplay();
    updateTimerBar();
  }

  function stopTimer() {
    if (session.timerInterval) {
      clearInterval(session.timerInterval);
      session.timerInterval = null;
    }
  }

  function updateTimerDisplay() {
    const el = document.getElementById('rpg-timer-val');
    if (!el) return;
    el.textContent = 'Turn ' + (session.enemyTurn || 0);
    const timerEl = document.getElementById('rpg-timer');
    if (timerEl) {
      timerEl.classList.toggle('warning', (session.enemyThreat || 1) >= 2);
    }
  }

  function updateTimerBar() {
    const fill = document.getElementById('rpg-time-fill');
    if (!fill) return;
    const ratio = session.playerMaxHp > 0 ? session.playerHp / session.playerMaxHp : 0;
    fill.style.width = Math.max(0, ratio * 100) + '%';
    fill.className = 'rpg-time-bar-fill';
    if (ratio < 0.25) fill.classList.add('time-low');
    else if (ratio < 0.5) fill.classList.add('time-mid');
  }

  // ===================================================
  //  問題管理
  // ===================================================

  function nextQuestion() {
    if (session.currentQ && session.answered) {
      if (session.skipNextEnemyAdvance) {
        session.skipNextEnemyAdvance = false;
      } else {
        advanceEnemyAttackCounters();
      }
      if (session.playerHp <= 0) return;
    }
    if (session.questionIndex >= session.questions.length) {
      // 全問消費したらシャッフルして再利用
      session.questions = shuffleArray(session.questions.slice());
      session.questionIndex = 0;
    }
    session.currentQ = session.questions[session.questionIndex++];
    session.answered = false;
    session.waitingRoll = false;
    session.rolled = false;

    // ダイスのロック解除してvalueをリセット（ロック中は値を保持）
    session.dicePool.forEach(d => {
      if (!d.locked) d.value = null;
    });

    renderQuestion();
    renderDicePool();
  }

  function renderQuestion() {
    const q = session.currentQ;
    if (!q) return;

    const panel = document.getElementById('rpg-panel-question');
    if (!panel) return;

    // メタ情報
    const typeLabel = { single_choice: '4択', multiple_choice: '複数選択', fill_blank: '穴埋め' };
    const metaHtml = `
      <div class="rpg-question-meta">
        <span class="rpg-q-badge">問題 #${session.questionIndex}</span>
        ${q.category ? `<span class="rpg-q-category">${escHtml(q.category)}</span>` : ''}
        <span class="rpg-q-type">${typeLabel[q.type] || q.type}</span>
      </div>
    `;

    // 問題文（穴埋めの場合はinputに置換）
    let questionHtml = escHtml(q.question);
    if (q.type === 'fill_blank') {
      questionHtml = questionHtml.replace(
        /【blank】/g,
        '<input type="text" id="rpg-fill-input" class="rpg-fill-input" placeholder="答えを入力" autocomplete="off">'
      );
    }

    // 選択肢
    let choicesHtml = '';
    if (q.type === 'single_choice') {
      choicesHtml = `<div class="rpg-choices" id="rpg-choices">` +
        q.choices.map((c, i) => `
          <label class="rpg-choice-item" data-idx="${i}">
            <input type="radio" name="rpg-radio" value="${i}">
            <span>${escHtml(c)}</span>
          </label>
        `).join('') +
        `</div>`;
    } else if (q.type === 'multiple_choice') {
      choicesHtml = `<div class="rpg-choices" id="rpg-choices">` +
        q.choices.map((c, i) => `
          <label class="rpg-choice-item" data-idx="${i}">
            <input type="checkbox" name="rpg-check" value="${i}">
            <span>${escHtml(c)}</span>
          </label>
        `).join('') +
        `</div>`;
    }

    // アクションボタン
    const actionHtml = `
      <div class="rpg-action-row" id="rpg-action-row">
        <button class="rpg-btn-answer" id="rpg-btn-answer">回答する</button>
      </div>
    `;

    panel.innerHTML = metaHtml +
      `<p class="rpg-question-text" id="rpg-q-text">${questionHtml}</p>` +
      choicesHtml +
      actionHtml;

    // イベント
    const answerBtn = document.getElementById('rpg-btn-answer');
    if (answerBtn) {
      answerBtn.addEventListener('click', submitAnswer);
    }

    // 穴埋め: Enterキーで回答
    const fillInput = document.getElementById('rpg-fill-input');
    if (fillInput) {
      fillInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') submitAnswer();
      });
    }
  }

  function submitAnswer() {
    if (session.answered) return;
    const q = session.currentQ;
    if (!q) return;

    let userAnswer = null;
    let isCorrect = false;

    if (q.type === 'single_choice') {
      const sel = document.querySelector('input[name="rpg-radio"]:checked');
      if (!sel) { showAnswerHint('選択肢を選んでください'); return; }
      userAnswer = String(parseInt(sel.value, 10) + 1);
      isCorrect = (userAnswer === q.answer.trim());

    } else if (q.type === 'multiple_choice') {
      const sels = document.querySelectorAll('input[name="rpg-check"]:checked');
      if (sels.length === 0) { showAnswerHint('選択肢を選んでください'); return; }
      const nums = Array.from(sels).map(s => parseInt(s.value, 10) + 1).sort((a, b) => a - b);
      userAnswer = nums.join('|');
      const correctNums = q.answer.split('|').map(n => parseInt(n.trim(), 10)).sort((a, b) => a - b).join('|');
      isCorrect = (userAnswer === correctNums);

    } else if (q.type === 'fill_blank') {
      const inp = document.getElementById('rpg-fill-input');
      if (!inp) return;
      userAnswer = inp.value.trim();
      if (!userAnswer) { showAnswerHint('答えを入力してください'); return; }
      isCorrect = (userAnswer === q.answer.trim());
    }

    session.answered = true;
    handleAnswerState(isCorrect);
    showAnswerResult(isCorrect, q);
  }

  function showAnswerHint(msg) {
    const row = document.getElementById('rpg-action-row');
    if (!row) return;
    const existing = row.querySelector('.rpg-hint');
    if (existing) existing.remove();
    const hint = document.createElement('span');
    hint.className = 'rpg-hint';
    hint.style.cssText = 'font-size:12px;color:#e03050;margin-left:8px;';
    hint.textContent = msg;
    row.appendChild(hint);
    setTimeout(() => hint.remove(), 2000);
  }

  function showAnswerResult(isCorrect, q) {
    const panel = document.getElementById('rpg-panel-question');
    if (!panel) return;
    playRpgSe(isCorrect ? 'correct' : 'wrong');

    // フラッシュ
    panel.classList.remove('flash-correct', 'flash-wrong');
    void panel.offsetWidth; // reflow
    panel.classList.add(isCorrect ? 'flash-correct' : 'flash-wrong');

    // 選択肢に正解/不正解マーク
    markChoices(q, isCorrect);

    // 穴埋めの場合は入力を無効化
    const fillInput = document.getElementById('rpg-fill-input');
    if (fillInput) fillInput.disabled = true;

    // 解説
    const actionRow = document.getElementById('rpg-action-row');
    if (actionRow) {
      const resultLabel = document.createElement('div');
      resultLabel.className = 'rpg-result-label ' + (isCorrect ? 'correct' : 'wrong');
      resultLabel.textContent = isCorrect ? '✓ 正解！' : '✗ 不正解';
      actionRow.before(resultLabel);

      if (q.explanation) {
        const expBox = document.createElement('div');
        expBox.className = 'rpg-explanation';
        expBox.innerHTML = `<span class="rpg-explanation-label">解説</span>${escHtml(q.explanation)}`;
        actionRow.before(expBox);
      }

      // ボタン差し替え
      actionRow.innerHTML = '';
      if (isCorrect) {
        session.waitingRoll = true;
        triggerCorrectRelics();
        grantGachaProgress();
        const rollInfo = document.createElement('p');
        rollInfo.style.cssText = 'font-size:13px;color:#c9a84c;margin-bottom:0;';
        rollInfo.textContent = 'ダイスをロールして攻撃！';
        actionRow.appendChild(rollInfo);
      } else {
        const nextBtn = document.createElement('button');
        nextBtn.className = 'rpg-btn-next';
        nextBtn.textContent = '次の問題へ →';
        nextBtn.addEventListener('click', session.useDocFormat ? nextDocQuestion : nextQuestion);
        actionRow.appendChild(nextBtn);
      }
    }

    // ロールボタンの活性化
    renderDicePool();
  }

  function markChoices(q, isCorrect) {
    const choicesDiv = document.getElementById('rpg-choices');
    if (!choicesDiv) return;

    const items = choicesDiv.querySelectorAll('.rpg-choice-item');
    items.forEach(item => {
      item.classList.add('disabled');
      const idx = parseInt(item.dataset.idx, 10);
      const num = idx + 1;

      // 正解番号の判定
      let isCorrectChoice = false;
      if (q.type === 'single_choice') {
        isCorrectChoice = (String(num) === q.answer.trim());
      } else if (q.type === 'multiple_choice') {
        const correct = q.answer.split('|').map(n => parseInt(n.trim(), 10));
        isCorrectChoice = correct.includes(num);
      }

      // ユーザーが選んだかどうか
      const inp = item.querySelector('input');
      const userSelected = inp && inp.checked;

      if (isCorrectChoice) {
        item.classList.add('correct-choice');
      } else if (userSelected) {
        item.classList.add('wrong-choice');
      }
    });
  }

  // ===================================================
  //  ダイスプール
  // ===================================================

  function renderDicePool() {
    const panel = document.getElementById('rpg-panel-dice');
    if (!panel) return;

    const canLock = false;
    const canRoll = session.waitingRoll && !session.rolled;

    // ダイスを種別ごとにグループ化
    const groups = [
      { type: 'atk', label: '⚔️ ATK', color: '#e74c3c' },
      { type: 'sp',  label: '💎 SP',  color: '#5dade2' },
      { type: 'coin',  label: '💴 コイン',  color: '#f1c40f' },
      { type: 'mult', label: '⚡ 倍率', color: '#9b59b6' },
    ];

    let diceHtml = '<div class="rpg-dice-groups" id="rpg-dice-row">';
    groups.forEach(function (g) {
      const dice = session.dicePool.map(function (d, i) { return { d, i }; }).filter(function (x) { return x.d.type === g.type; });
      if (!dice.length) return;
      diceHtml += '<div class="rpg-dice-group">';
      diceHtml += '<div class="rpg-dice-group-label" style="color:' + g.color + '">' + g.label + '</div>';
      diceHtml += '<div class="rpg-dice-group-row">';
      dice.forEach(function (x) {
        const d = x.d; const i = x.i;
        const lockClass = d.locked ? ' locked' : '';
        const lockableClass = (canLock && canRoll) ? ' lockable' : '';
        const val = d.value != null ? d.value : '-';
        diceHtml += '<div class="rpg-die' + lockClass + lockableClass + '" data-dtype="' + d.type + '" data-idx="' + i + '" title="' + d.grade + ' ' + g.label + '">' +
          '<div class="die-value">' + val + '</div>' +
          '<div class="die-grade">' + d.grade + '</div>' +
          '</div>';
      });
      diceHtml += '</div></div>';
    });
    diceHtml += '</div>';

    // ロールボタン
    const rollDisabled = !canRoll ? ' disabled' : '';
    diceHtml += '<button class="rpg-roll-btn" id="rpg-roll-btn"' + rollDisabled + '>🎲 ロール！ <kbd>Ctrl+D</kbd></button>';

    // 結果テキスト
    diceHtml += '<div class="rpg-dice-result" id="rpg-dice-result">';
    if (!session.waitingRoll && !session.rolled) {
      diceHtml += '<span class="rpg-dice-waiting">正解するとダイスをロールできます</span>';
    }
    diceHtml += '</div>';

    panel.innerHTML = diceHtml;

    // イベント: ロールボタン
    const rollBtn = document.getElementById('rpg-roll-btn');
    if (rollBtn && canRoll) {
      rollBtn.addEventListener('click', rollAllDice);
    }

    // イベント: ダイスのロック/アンロック
    if (canLock && canRoll) {
      const diceEls = panel.querySelectorAll('.rpg-die.lockable');
      diceEls.forEach(el => {
        el.addEventListener('click', function () {
          const idx = parseInt(el.dataset.idx, 10);
          session.dicePool[idx].locked = !session.dicePool[idx].locked;
          renderDicePool();
        });
      });
    }
  }

  function rollAllDice() {
    if (session.rolled || !session.waitingRoll) return;
    session.rolled = true;
    rpgAudio.diceRoll();
    setRpgView('roll');
    playRpgSe('roll');

    const rollBtn = document.getElementById('rpg-roll-btn');
    if (rollBtn) rollBtn.disabled = true;

    // シェイクアニメ
    const diceEls = document.querySelectorAll('.rpg-die');
    diceEls.forEach(el => {
      const idx = parseInt(el.dataset.idx, 10);
      if (!session.dicePool[idx].locked) {
        el.classList.add('rolling');
      }
    });

    const flicker = setInterval(function () {
      document.querySelectorAll('.rpg-die.rolling .die-value').forEach(el => {
        el.textContent = (Math.floor(Math.random() * 6) + 1) * 100;
      });
    }, 85);

    setTimeout(function () {
      clearInterval(flicker);
      // ダイスを振る
      session.dicePool.forEach(d => {
        if (!d.locked) {
          d.value = rollDieValue(d);
        }
      });

      diceEls.forEach(el => el.classList.remove('rolling'));

      renderDicePool();
      showRollNumberPopups();

      const resultDiv = document.getElementById('rpg-dice-result');
      if (resultDiv) {
        resultDiv.innerHTML = '<div class="result-line"><span class="result-combo">攻撃開始...</span></div>';
      }

      setTimeout(function () {
        applyDiceResults();
        if (hasRelic('double_roll') && !session.doubleRollUsed && Math.random() < 0.5) {
          session.doubleRollUsed = true;
          session.rolled = false;
          session.dicePool.forEach(d => { d.value = null; });
          renderDicePool();
          showBattleToast('🎲 双子星の祝福: もう一度ロール可能', 'coin');
        }
      }, 520);

      // 「次の問題へ」ボタン追加
      const actionRow = document.getElementById('rpg-action-row');
      if (actionRow) {
        const existing = actionRow.querySelector('.rpg-btn-next');
        if (!existing) {
          const nextBtn = document.createElement('button');
          nextBtn.className = 'rpg-btn-next';
          nextBtn.textContent = '次の問題へ →';
          nextBtn.addEventListener('click', session.useDocFormat ? nextDocQuestion : nextQuestion);
          actionRow.appendChild(nextBtn);
        }
      }
    }, 1000);
  }

  function showRollNumberPopups() {
    const host = document.getElementById('rpg-panel-dice');
    if (!host) return;
    session.dicePool.forEach(function (d, i) {
      if (d.value == null) return;
      setTimeout(function () {
        const pop = document.createElement('div');
        pop.className = 'rpg-roll-pop dtype-' + d.type;
        pop.textContent = d.value.toLocaleString() + '!';
        host.appendChild(pop);
        setTimeout(function () {
          if (pop.parentNode) pop.parentNode.removeChild(pop);
        }, 1000);
      }, i * 180);
    });
  }

  function applyDiceResults() {
    const pool = session.dicePool;
    const resultDiv = document.getElementById('rpg-dice-result');

    const spDice   = pool.filter(d => d.type === 'sp');
    const coinDice = pool.filter(d => d.type === 'coin');
    const atkDice  = pool.filter(d => d.type === 'atk');
    const multDice  = pool.filter(d => d.type === 'mult');

    let totalDmg = 0;
    let totalSpGain = 0;
    let totalCoinGain = 0;
    const lines = [];

    spDice.forEach(d => {
      if (d.value != null) {
        const gain = Math.floor(d.value);
        totalSpGain += gain;
        lines.push(`<span class="result-sp">💎 SPダイス ${d.value.toLocaleString()} → +${gain.toLocaleString()}</span>`);
      }
    });

    coinDice.forEach(d => {
      if (d.value != null) {
        const gain = Math.floor(d.value * getCoinBonusMultiplier());
        totalCoinGain += gain;
        lines.push(`<span class="result-combo">💴 コインダイス ${d.value.toLocaleString()} ×2 ×補正 = ${gain.toLocaleString()}円</span>`);
      }
    });

    let atkTotal = 0;
    atkDice.forEach(d => {
      if (d.value != null) {
        atkTotal += d.value;
        lines.push(`<span class="result-dmg">⚔️ ATKダイス ${d.value.toLocaleString()}</span>`);
      }
    });

    let multVal = 1;
    if (multDice.length > 0 && multDice[0].value != null) {
      multVal = Math.max(1, multDice[0].value / 100);
      lines.push(`<span class="result-combo">⚡ 倍率ダイス ${multDice[0].value.toLocaleString()} → ×${multVal}</span>`);
    }

    // 正解自動ダメージ (B6スキル)
    const autoDmgLevels = [0, 400, 1500, 3500];
    const autoDmg = autoDmgLevels[Math.min(getSkillLevel('B6'), 3)];
    if (autoDmg > 0) {
      const autoWeapon = getEquippedWeapon();
      const autoHits = applyDamageToEnemy(autoDmg, autoWeapon);
      lines.push('<span class="result-combo">💥 自動ダメージ ' + autoDmg.toLocaleString() + '</span>');
    }

    // 基礎ダメージ倍率 (B7スキル)
    const baseDmgMult = [1, 1.5, 2.0][Math.min(getSkillLevel('B7'), 2)] * (1 + (save.gachaAtkBonus || 0)) * getPermaAtkMultiplier();

    if (atkTotal > 0) {
      const weapons = getEquippedWeapons();
      const weaponAtk = weapons.reduce((sum, w) => sum + getWeaponAttack(w, getWeaponLevel(w.id) || 1), 0);
      let base = Math.floor((atkTotal + weaponAtk + (save.gachaAtkFlat || 0)) * baseDmgMult);
      let critMsg = '';
      if (hasRelic('revenge_answer') && (session.wrongStreakBeforeCorrect || 0) >= 3) {
        base = Math.floor(base * 3);
        critMsg += ' / 逆襲x3';
      }
      if (hasRelic('triple_eye')) {
        const vals = atkDice.map(d => d.value).filter(v => v != null);
        if (vals.length >= 3 && vals.slice(0, 3).every(v => v === vals[0])) {
          base += Math.floor((atkTotal + weaponAtk) * 3);
          critMsg += ' / ぞろ目加算x3';
        }
      }
      const mainWeapon = weapons[0];
      if (mainWeapon.id === 'spear' && session.lastAnswerCorrect === false) {
        base = Math.floor(base * 2);
        critMsg += ' / リベンジ突きx2';
      }
      if (mainWeapon.id === 'greatsword') {
        if ((session.correctStreak || 0) >= 5) { base = Math.floor(base * 2); critMsg += ' / 闘気x2'; }
        else if ((session.correctStreak || 0) >= 3) { base = Math.floor(base * 1.5); critMsg += ' / 闘気x1.5'; }
      }
      totalDmg = Math.floor(base * multVal);
      let allHits = [];
      weapons.forEach(w => { allHits = allHits.concat(applyDamageToEnemy(totalDmg, w, weapons.length > 1)); });
      const hitCount = allHits.length || 1;
      lines.push(`<span class="result-dmg">${weapons.map(w => w.icon + w.name).join(' + ')}: ATK合計${atkTotal.toLocaleString()} + 武器${weaponAtk.toLocaleString()} = ${(atkTotal + weaponAtk).toLocaleString()} × ${multVal} = ${totalDmg.toLocaleString()}${critMsg} / ${hitCount}体</span>`);
    }

    if (totalSpGain > 0) {
      addAttrSp('sp', totalSpGain);
      session.totalSp += totalSpGain;
    }

    if (totalCoinGain > 0) {
      save.coins = (save.coins || 0) + totalCoinGain;
      showCoinToast(totalCoinGain);
    }

    updateSpDisplay();

    var logParts = [];
    if (totalSpGain > 0) logParts.push('SP+' + totalSpGain.toLocaleString());
    if (totalCoinGain > 0) logParts.push(totalCoinGain.toLocaleString() + '円');
    if (totalDmg > 0) logParts.push('⚔️' + totalDmg.toLocaleString() + 'ダメージ');
    if (logParts.length) rpgLog('ダイス結果: ' + logParts.join(' / '));

    if (resultDiv) {
      resultDiv.innerHTML = lines.map(l => `<div class="result-line">${l}</div>`).join('');
    }

    writeSave();
  }

  function isSequential(sortedVals) {
    for (let i = 1; i < sortedVals.length; i++) {
      if (sortedVals[i] !== sortedVals[i - 1] + 1) return false;
    }
    return true;
  }

  // ===================================================
  //  敵へのダメージ
  // ===================================================

  function applyDamageToEnemy(dmg, weapon, skipSpecial) {
    const targetCell = getTargetCell();
    const target = targetCell.enemy;
    weapon = weapon || getEquippedWeapon();
    const level = getWeaponLevel(weapon.id) || 1;
    const hits = collectWeaponTargets(targetCell, weapon, level);
    const defeated = [];

    hits.forEach(hit => {
      let damage = Math.max(1, Math.floor(dmg * hit.ratio));
      if (weapon.id === 'bow' && hit.role !== 'main') damage = Math.floor(damage * 2);
      hit.enemy.hp = Math.max(0, hit.enemy.hp - damage);
      hit.damage = damage;
      session.totalDamage += damage;
      if (hit.enemy.hp <= 0) defeated.push(hit.enemy);
    });

    if (defeated.length) {
      const rewardSp = defeated.reduce((sum, e) => sum + (e.reward || 0), 0);
      const rewardCoins = Math.floor(defeated.reduce((sum, e) => sum + (e.coins || 0), 0) * getCoinBonusMultiplier());
      const rewardRebirth = grantEnemyRebirthRewards(defeated);
      addAttrSp('sp', rewardSp);
      save.coins = (save.coins || 0) + rewardCoins;
      session.totalSp += rewardSp;
      session.defeatedEnemies += defeated.length;
      showCoinToast(rewardCoins, defeated.length);
      rpgLog(defeated.length + '体撃破: SP+' + rewardSp.toLocaleString() + ' / ' + rewardCoins.toLocaleString() + '円 / 転生P+' + rewardRebirth.toLocaleString());
    }

    if (!save.weaponUseCounts) save.weaponUseCounts = {};
    save.weaponUseCounts[weapon.id] = (save.weaponUseCounts[weapon.id] || 0) + 1;
    save.favoriteWeapon = Object.keys(save.weaponUseCounts).sort((a, b) => (save.weaponUseCounts[b] || 0) - (save.weaponUseCounts[a] || 0))[0] || save.favoriteWeapon || 'bat';

    if (!skipSpecial) applyWeaponSpecial(weapon, targetCell, hits, dmg);
    if (hasRelic('drain')) {
      const heal = Math.floor(hits.reduce((sum, h) => sum + (h.damage || 0), 0) * 0.01);
      if (heal > 0) session.playerHp = Math.min(getPlayerMaxHp(), (session.playerHp || getPlayerMaxHp()) + heal);
    }

    const waveCleared = getAliveEnemies().length === 0;
    showCellDamage(hits);
    renderEnemy();
    showDamagePopup('-' + hits.reduce((sum, h) => sum + h.damage, 0).toLocaleString(), dmg, weapon.fx, hits);
    playRpgSe('attack');
    if (waveCleared) {
      setTimeout(function () {
        advanceWaveIfCleared();
        renderEnemy();
        writeSave();
      }, 800);
    }
    updateSpDisplay();
    writeSave();
    return hits;
  }

  function applyWeaponSpecial(weapon, targetCell, hits, dmg) {
    if (!weapon) return;
    if (weapon.id === 'bat') {
      hits.forEach(h => {
        if (Math.random() < 0.20) h.enemy.stun = Math.max(h.enemy.stun || 0, 2);
      });
      if (hits.some(h => h.enemy.stun)) showBattleToast('🏏 スタン発生', 'coin');
    }
    if (weapon.id === 'sword') {
      hits.forEach(h => {
        if (h.enemy.hp > 0 && h.enemy.hp / h.enemy.maxHp <= 0.20) {
          h.enemy.hp = 0;
          showBattleToast('🗡️ 処刑剣', 'damage');
        }
      });
    }
    if (weapon.id === 'hammer') compressEnemiesLeft();
    if (weapon.id === 'whip') hits.forEach(h => { h.enemy.noHeal = true; });
    if (weapon.id === 'kusarigama' && targetCell) pullKusarigamaLines(targetCell.row, targetCell.col);
    if (weapon.id === 'fan' && targetCell) {
      const key = targetCell.row + ':' + targetCell.col;
      save.fanTargetStack = save.fanTargetKey === key ? Math.min(3, (save.fanTargetStack || 0) + 1) : 1;
      save.fanTargetKey = key;
    }
  }

  function compressEnemiesLeft() {
    if (!save.board || !Array.isArray(save.board.enemies)) return;
    for (let r = 0; r < BOARD_ROWS; r++) {
      const rowEnemies = save.board.enemies.filter(e => e.hp > 0 && e.row === r).sort((a, b) => a.col - b.col);
      rowEnemies.forEach((enemy, idx) => { enemy.col = idx; });
    }
    showBattleToast('🔨 重力圧', 'coin');
  }

  function pullKusarigamaLines(row, col) {
    const rowEnemies = save.board.enemies.filter(e => e.hp > 0 && e.row === row).sort((a, b) => b.col - a.col);
    rowEnemies.forEach((enemy, idx) => { enemy.col = BOARD_COLS - 1 - idx; });
    const colEnemies = save.board.enemies.filter(e => e.hp > 0 && e.col === col).sort((a, b) => a.row - b.row);
    colEnemies.forEach((enemy, idx) => { enemy.row = idx; });
    showBattleToast('⛓️ 引き寄せ', 'coin');
  }

  function knockbackEnemy(enemy, dr, dc) {
    if (!enemy || enemy.hp <= 0) return false;
    const nr = enemy.row + dr;
    const nc = enemy.col + dc;
    if (!isBoardCell(nr, nc) || getEnemyAt(nr, nc)) return false;
    enemy.row = nr;
    enemy.col = nc;
    return true;
  }

  function enemyAttackTurn() {
    const alive = getAliveEnemies();
    if (!alive.length) return;
    session.enemyTurn = (session.enemyTurn || 0) + 1;
    session.enemyThreat = 1 + Math.floor((session.enemyTurn - 1) / 4) * 0.25 + ((save.board.stage || 1) - 1) * 0.12;
    let total = 0;
    alive.forEach(enemy => {
      if (enemy.delay && enemy.delay > 0) {
        enemy.delay -= 1;
        return;
      }
      total += Math.floor((70 + enemy.maxHp * 0.025) * session.enemyThreat);
    });
    total = Math.floor(total * (1 - getEnemyDamageReduction()));
    session.playerHp = Math.max(0, (session.playerHp || getPlayerMaxHp()) - total);
    updateTimerDisplay();
    updateTimerBar();
    if (session.playerHp <= 0) {
      handlePlayerDefeat();
    } else {
      renderEnemy();
      if (total > 0) showBattleToast('敵の攻撃 -' + total.toLocaleString(), 'damage');
    }
  }

  function getEnemyAttackDamage(enemy) {
    const threatStep = 4 + getSkillEffectLevel('threat_delay') + (save.gachaEnemyTurnDelay || 0);
    const threat = 1 + Math.floor((session.enemyTurn || 0) / threatStep) * 0.28 + ((save.board.stage || 1) - 1) * 0.18;
    return Math.floor((180 + enemy.maxHp * 0.045) * threat * (1 - getEnemyDamageReduction()));
  }

  function advanceEnemyAttackCounters() {
    const alive = getAliveEnemies();
    if (!alive.length) return;
    session.enemyTurn = (session.enemyTurn || 0) + 1;
    session.enemyThreat = 1 + Math.floor((session.enemyTurn || 0) / 4) * 0.28 + ((save.board.stage || 1) - 1) * 0.18;
    let total = 0;
    alive.forEach(enemy => {
      if (enemy.stun && enemy.stun > 0) {
        enemy.stun -= 1;
        return;
      }
      if (enemy.delay && enemy.delay > 0) {
        enemy.delay -= 1;
        return;
      }
      enemy.attackCd = Math.max(0, Number(enemy.attackCd || enemy.attackMax || 2) - 1);
      if (enemy.attackCd <= 0) {
        if (!(hasRelic('guard_mark') && session.guardTargetId && session.guardTargetId === enemy.id)) {
          total += getEnemyAttackDamage(enemy);
        }
        enemy.attackCd = Math.max(1, Number(enemy.attackMax || 2));
      }
    });
    session.guardTargetId = null;
    if (total > 0) {
      session.playerHp = Math.max(0, (session.playerHp || getPlayerMaxHp()) - total);
      if (session.playerHp <= 0) {
        if (hasRelic('revive') && !session.reviveUsed) {
          session.reviveUsed = true;
          session.playerHp = Math.max(1, Math.floor(getPlayerMaxHp() * 0.25));
          showBattleToast('🔥 不死鳥の灰で復活', 'coin');
          renderEnemy();
          updateTimerDisplay();
          updateTimerBar();
          return;
        }
        handlePlayerDefeat();
        return;
      }
    }
    renderEnemy();
    updateTimerDisplay();
    updateTimerBar();
    if (total > 0) showBattleToast('敵の攻撃 -' + total.toLocaleString(), 'damage');
  }

  function handlePlayerDefeat() {
    const gained = awardRebirthPoints(false);
    resetRunProgress();
    writeSave();
    rpgLog('ゲームオーバー: 転生ポイント +' + gained);
    endSession('ゲームオーバー', '転生ポイント +' + gained + '。進行中スキルはリセットされました。');
  }

  function triggerCorrectRelics() {
    if (hasRelic('late_tree')) {
      GACHA_UNLOCKABLE_NODE_IDS.forEach(id => {
        if (!save.gachaUnlockedNodes.includes(id) && Math.random() < 0.08) save.gachaUnlockedNodes.push(id);
      });
    }
  }

  function damageAllEnemies(amount, label) {
    const alive = getAliveEnemies();
    if (!alive.length) return;
    alive.forEach(e => {
      e.hp = Math.max(0, e.hp - amount);
      session.totalDamage += amount;
    });
    advanceWaveIfCleared();
    renderEnemy();
    showBattleToast(label, 'damage');
    writeSave();
  }

  function startSlipDamage(enemies) {
    const ids = enemies.map(e => e.id);
    for (let tick = 1; tick <= 5; tick++) {
      setTimeout(function () {
        let hit = false;
        ids.forEach(id => {
          const enemy = save.board && save.board.enemies.find(e => e.id === id && e.hp > 0);
          if (enemy) {
            enemy.hp = Math.max(0, enemy.hp - 10);
            session.totalDamage += 10;
            hit = true;
          }
        });
        if (hit) {
          advanceWaveIfCleared();
          renderEnemy();
          showBattleToast('🔥 スリップ -10', 'damage');
          writeSave();
        }
      }, tick * 1000);
    }
  }

  function showDamagePopup(text, dmgVal, fx, hits) {
    const panel = document.getElementById('rpg-panel-enemy');
    if (!panel) return;
    const popup = document.createElement('div');
    // ダメージ量でサイズ・色を変える
    var sizeClass = 'dmg-small';
    if (dmgVal >= 10000) sizeClass = 'dmg-huge';
    else if (dmgVal >= 3000) sizeClass = 'dmg-big';
    else if (dmgVal >= 1000) sizeClass = 'dmg-medium';
    popup.className = 'rpg-dmg-popup ' + sizeClass + ' fx-' + (fx || 'slash');
    popup.textContent = text;
    // ランダム水平位置 + 微妙な回転
    popup.style.left = (20 + Math.random() * 50) + '%';
    popup.style.top = (20 + Math.random() * 20) + '%';
    popup.style.transform = 'rotate(' + (Math.random() * 14 - 7) + 'deg)';
    panel.appendChild(popup);
    showWeaponFx(fx || 'slash', hits || []);
    // パネルをシェイク
    panel.classList.remove('rpg-shake');
    void panel.offsetWidth;
    panel.classList.add('rpg-shake');
    panel.addEventListener('animationend', () => panel.classList.remove('rpg-shake'), { once: true });
    setTimeout(() => { if (popup.parentNode) popup.parentNode.removeChild(popup); }, 1400);
  }

  function showCellDamage(hits) {
    const grid = document.getElementById('rpg-enemy-grid');
    if (!grid) return;
    hits.forEach(function(hit, idx) {
      setTimeout(function() {
        const cell = grid.querySelector('[data-enemy-id="' + hit.enemy.id + '"]');
        if (!cell) return;
        const dmgEl = document.createElement('div');
        dmgEl.className = 'rpg-cell-dmg' + (hit.role === 'main' ? ' is-main' : '');
        dmgEl.textContent = '-' + hit.damage.toLocaleString();
        cell.appendChild(dmgEl);
        setTimeout(function() { if (dmgEl.parentNode) dmgEl.parentNode.removeChild(dmgEl); }, 900);
      }, idx * 60);
    });
  }

  function showWeaponFx(fx, hits) {
    const panel = document.getElementById('rpg-panel-enemy');
    if (!panel) return;
    const effect = document.createElement('div');
    effect.className = 'rpg-weapon-fx fx-' + fx;
    const target = hits && hits[0] ? hits[0].enemy : getTargetEnemy();
    if (target) {
      effect.style.setProperty('--fx-x', ((target.col + 0.5) / BOARD_COLS * 100) + '%');
      effect.style.setProperty('--fx-y', ((target.row + 0.5) / BOARD_ROWS * 100) + '%');
    }
    panel.appendChild(effect);
    setTimeout(() => { if (effect.parentNode) effect.parentNode.removeChild(effect); }, 700);

    // 武器固有パーティクル
    spawnWeaponParticles(panel, fx, target);
    rpgAudio.attackFx(fx);

    hits.forEach(hit => {
      const cell = panel.querySelector('[data-enemy-id="' + hit.enemy.id + '"]');
      if (!cell) return;
      cell.classList.remove('hit', 'dying');
      void cell.offsetWidth;
      cell.classList.add(hit.enemy.hp <= 0 ? 'dying' : 'hit');
    });
  }

  function spawnWeaponParticles(panel, fx, target) {
    if (!target) return;
    const ox = (target.col + 0.5) / BOARD_COLS * 100;
    const oy = (target.row + 0.5) / BOARD_ROWS * 100;
    const configs = {
      slash:  { count: 6,  cls: 'p-slash',  colors: ['#e74c3c','#f39c12','#fff'], spread: 60 },
      smash:  { count: 10, cls: 'p-smash',  colors: ['#e67e22','#f1c40f','#a04010'], spread: 80 },
      pierce: { count: 5,  cls: 'p-pierce', colors: ['#3498db','#9b59b6','#fff'], spread: 30 },
      sweep:  { count: 8,  cls: 'p-sweep',  colors: ['#2ecc71','#27ae60','#f1c40f'], spread: 100 },
    };
    const cfg = configs[fx] || configs.slash;
    for (let i = 0; i < cfg.count; i++) {
      const p = document.createElement('span');
      const angle = (Math.random() * cfg.spread * 2 - cfg.spread) * Math.PI / 180;
      const dist  = 30 + Math.random() * 50;
      const color = cfg.colors[Math.floor(Math.random() * cfg.colors.length)];
      p.className = 'rpg-particle ' + cfg.cls;
      p.style.cssText = [
        'left:' + ox + '%',
        'top:' + oy + '%',
        'background:' + color,
        '--dx:' + (Math.sin(angle) * dist).toFixed(1) + 'px',
        '--dy:' + (-Math.cos(angle) * dist * 0.6 - 10).toFixed(1) + 'px',
        'animation-delay:' + (i * 30) + 'ms',
      ].join(';');
      panel.appendChild(p);
      setTimeout(() => { if (p.parentNode) p.parentNode.removeChild(p); }, 700);
    }
  }


  function showCoinToast(amount, defeatedCount) {
    if (!amount) return;
    const label = (defeatedCount ? defeatedCount + '体撃破 / ' : '') + amount.toLocaleString() + '円獲得';
    showBattleToast(label, 'coin');
  }

  function showBattleToast(text, type) {
    const panel = document.getElementById('rpg-panel-enemy');
    if (!panel) return;
    const msg = document.createElement('div');
    msg.className = 'rpg-defeat-msg ' + (type || '');
    msg.textContent = text;
    panel.appendChild(msg);
    setTimeout(() => { if (msg.parentNode) msg.parentNode.removeChild(msg); }, 5000);
  }

  // ===================================================
  //  敵レンダリング（ボード＋装備サイドバー）
  // ===================================================

  function renderEnemy() {
    ensureBoardState();
    const panel = document.getElementById('rpg-panel-enemy');
    if (!panel) return;
    const targetCell = getTargetCell();
    const target = targetCell.enemy;
    const weapon = getEquippedWeapon() || BARE_FIST;
    const weaponLv = (weapon.id !== 'bare' ? getWeaponLevel(weapon.id) : 0) || 1;
    const alive = getAliveEnemies();
    const total = save.board.enemies.length;
    const defeatedInWave = Math.max(0, total - alive.length);
    const wavePct = total > 0 ? Math.round(defeatedInWave / total * 100) : 100;
    const previewCells = targetCell ? collectWeaponAreaCells(targetCell, weapon, weaponLv) : [];
    const previewMap = new Map(previewCells.map(cell => [cell.row + ':' + cell.col, cell]));
    const previewBase = getWeaponAttack(weapon, weaponLv);
    const relicDefs = (save.relics || []).map(id => RELICS.find(r => r.id === id)).filter(Boolean);

    // ステージ進捗pip
    let stagePips = '';
    for (let s = 1; s <= TOTAL_STAGES; s++) {
      const done = s < (save.board.stage || 1);
      const cur  = s === (save.board.stage || 1);
      stagePips += `<span class="stage-pip${done ? ' done' : ''}${cur ? ' cur' : ''}" title="Stage ${s}">${done ? '✓' : cur ? '▶' : '○'}</span>`;
    }

    // 所持武器（装備サイドバー用）
    const ownedWeapons = WEAPONS.filter(w => getWeaponLevel(w.id) > 0);

    let html = `
      <div class="rpg-battle-top">
        <div>
          <div class="rpg-stage-progress">${stagePips}</div>
          <div class="rpg-battle-kicker">盤面 ${save.board.stage} / ${TOTAL_STAGES}</div>
        </div>
        <div class="rpg-weapon-current" id="rpg-weapon-current-btn" title="ホバーで装備一覧">
          <span class="rpg-weapon-current-icon">${weapon.icon}</span>
          <span>${escHtml(weapon.name)}${weapon.id !== 'bare' ? ' Lv' + weaponLv : ''}</span>
          <strong>${weapon.id !== 'bare' ? getWeaponAttack(weapon, weaponLv).toLocaleString() : '購入してください'}</strong>
          <span class="rpg-weapon-switch-hint">▼</span>
        </div>
      </div>
      <div class="rpg-weapon-sidebar" id="rpg-weapon-sidebar">
        <div class="rpg-weapon-sidebar-title">⚔️ 装備切り替え</div>
        ${ownedWeapons.map(w => {
          const lv = getWeaponLevel(w.id);
          const eq = save.equippedWeapon === w.id;
          return `<button class="rpg-weapon-sidebar-item${eq ? ' equipped' : ''}" data-equip-id="${w.id}">
            <span>${w.icon}</span>
            <span>${escHtml(w.name)} Lv${lv}</span>
            <span class="rpg-weapon-sidebar-atk">${getWeaponAttack(w, lv).toLocaleString()}</span>
            ${eq ? '<span class="rpg-weapon-sidebar-eq">装備中</span>' : ''}
          </button>`;
        }).join('')}
      </div>
      <div class="rpg-board-status">
        <span>残敵 ${alive.length} / ${total}</span>
        <span>標的 ${String.fromCharCode(65 + targetCell.row) + (targetCell.col + 1)}${target ? '' : ' / 空'}</span>
        <span>💴 ${(save.coins || 0).toLocaleString()}円</span>
        <span>HP ${(session.playerHp || 0).toLocaleString()} / ${(session.playerMaxHp || getPlayerMaxHp()).toLocaleString()}</span>
        <span>敵脅威 x${(session.enemyThreat || 1).toFixed(2)}</span>
      </div>
      <div class="rpg-relic-bar" aria-label="所持レリック">
        ${relicDefs.length ? relicDefs.map(r => `<span class="rpg-relic-chip" title="${escHtml(r.name)}: ${escHtml(r.desc)}">${r.icon}</span>`).join('') : '<span class="rpg-relic-empty">レリックなし</span>'}
      </div>
      <div class="rpg-wave-progress">
        <span>盤面進捗</span>
        <b style="width:${wavePct}%"></b>
        <em>${defeatedInWave}/${total}</em>
      </div>
      <div class="rpg-board-tools">
        <button type="button" id="rpg-board-zoom-out">−</button>
        <span>${Math.round((session.boardZoom || 1) * 100)}%</span>
        <button type="button" id="rpg-board-zoom-in">＋</button>
      </div>
      <div class="rpg-board-scroll"><div class="rpg-enemy-grid" id="rpg-enemy-grid" style="--rpg-board-zoom:${session.boardZoom || 1}">`;

    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let cl = 0; cl < BOARD_COLS; cl++) {
        const enemy = getEnemyAt(r, cl);
        const preview = previewMap.get(r + ':' + cl);
        const cellRangeClass = preview ? (preview.enemy ? ' range-occupied' : ' range-empty') : '';
        const cellPierceClass = preview && preview.role === 'pierce' ? ' range-pierce' : '';
        const isTargetCell = targetCell && targetCell.row === r && targetCell.col === cl;
        if (!enemy) {
          html += `<button class="rpg-grid-cell empty ${isTargetCell ? 'targeted' : ''}${cellRangeClass}${cellPierceClass}" data-row="${r}" data-col="${cl}" aria-label="empty">
            <span class="rpg-grid-cursor">${isTargetCell ? '◆' : ''}</span>
          </button>`;
          continue;
        }
        const ratio = enemy.maxHp > 0 ? Math.max(0, enemy.hp / enemy.maxHp) : 0;
        const isTarget = isTargetCell;
        const previewDmg = preview ? Math.floor(previewBase * preview.ratio) : 0;
        const rangeClass = preview ? (preview.role === 'main' ? ' range-main' : (preview.ratio < 0.55 ? ' range-low' : ' range-splash')) : '';
        const killClass = previewDmg >= enemy.hp ? ' range-kill' : '';
        const nextAtk = getEnemyAttackDamage(enemy);
        const cd = Math.max(1, Number(enemy.attackCd || enemy.attackMax || 2));
        html += `<button class="rpg-grid-cell enemy ${isTarget ? 'targeted' : ''}${rangeClass}${cellRangeClass}${cellPierceClass}${killClass}" data-enemy-id="${enemy.id}" data-row="${r}" data-col="${cl}" title="${escHtml(enemy.type)} ${enemy.hp}/${enemy.maxHp} / ${cd}問後 ${nextAtk.toLocaleString()}ダメージ">
          <span class="rpg-grid-cursor">${isTarget ? '◆' : ''}</span>
          <span class="rpg-grid-emoji">${enemy.emoji}</span>${enemy.delay ? '<span class="rpg-grid-delay">遅' + enemy.delay + '</span>' : ''}
          <span class="rpg-grid-info-block"><span class="rpg-grid-turn"><em class="eg-lbl">予定</em>${cd}問後</span><span class="rpg-grid-dmg"><em class="eg-lbl">DMG</em>${nextAtk.toLocaleString()}</span><span class="rpg-grid-hpnum"><em class="eg-lbl">HP</em>${enemy.hp.toLocaleString()}<em class="eg-sep">/</em>${enemy.maxHp.toLocaleString()}</span></span>
          <span class="rpg-grid-hp"><i style="width:${Math.round(ratio * 100)}%"></i></span>
        </button>`;
      }
    }
    html += '</div></div>';
    html += '<div class="rpg-time-wrap"><div class="rpg-time-label"><span>プレイヤーHP</span><span id="rpg-time-label-text">HP</span></div><div class="rpg-time-bar-bg"><div class="rpg-time-bar-fill" id="rpg-time-fill" style="width:100%"></div></div></div>';
    html += '<div class="rpg-battle-actions" id="rpg-battle-actions"></div>';
    panel.innerHTML = html;

    panel.querySelectorAll('.rpg-grid-cell').forEach(btn => {
      btn.addEventListener('click', function () { setTargetCell(btn.dataset.row, btn.dataset.col); });
      btn.addEventListener('mouseenter', function () { previewWeaponRangeCell(btn.dataset.row, btn.dataset.col); });
      btn.addEventListener('mouseleave', clearHoverWeaponRange);
    });
    const zoomOut = document.getElementById('rpg-board-zoom-out');
    const zoomIn = document.getElementById('rpg-board-zoom-in');
    if (zoomOut) zoomOut.addEventListener('click', function () { session.boardZoom = Math.max(0.7, (session.boardZoom || 1) - 0.1); renderEnemy(); });
    if (zoomIn) zoomIn.addEventListener('click', function () { session.boardZoom = Math.min(1.45, (session.boardZoom || 1) + 0.1); renderEnemy(); });

    // 装備サイドバー ホバー表示
    const sidebar = document.getElementById('rpg-weapon-sidebar');
    const weaponBtn = document.getElementById('rpg-weapon-current-btn');
    if (sidebar && weaponBtn) {
      let sidebarTimer;
      const showSidebar = () => { clearTimeout(sidebarTimer); sidebar.classList.add('visible'); };
      const hideSidebar = () => { sidebarTimer = setTimeout(() => sidebar.classList.remove('visible'), 300); };
      const toggleSidebar = event => {
        event.preventDefault();
        event.stopPropagation();
        clearTimeout(sidebarTimer);
        sidebar.classList.toggle('visible');
        const isOpen = sidebar.classList.contains('visible');
        weaponBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        if (isOpen) {
          setTimeout(() => {
            document.addEventListener('click', function closeWeaponSidebar(closeEvent) {
              const currentSidebar = document.getElementById('rpg-weapon-sidebar');
              const currentButton = document.getElementById('rpg-weapon-current-btn');
              if (!currentSidebar || !currentButton) return;
              if (currentSidebar.contains(closeEvent.target) || currentButton.contains(closeEvent.target)) return;
              currentSidebar.classList.remove('visible');
              currentButton.setAttribute('aria-expanded', 'false');
            }, { once: true });
          }, 0);
        }
      };
      weaponBtn.setAttribute('aria-expanded', 'false');
      weaponBtn.addEventListener('click', toggleSidebar);
      if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        weaponBtn.addEventListener('pointerenter', showSidebar);
        weaponBtn.addEventListener('pointerleave', hideSidebar);
        sidebar.addEventListener('pointerenter', showSidebar);
        sidebar.addEventListener('pointerleave', hideSidebar);
      }
      sidebar.addEventListener('click', event => event.stopPropagation());
    }
    panel.querySelectorAll('.rpg-weapon-sidebar-item').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = btn.dataset.equipId;
        if (id && getWeaponDef(id)) {
          save.equippedWeapon = id;
          writeSave();
          renderEnemy();
          showBattleToast(getWeaponDef(id).icon + ' ' + getWeaponDef(id).name + ' に切り替えた');
        }
      });
    });

    updateHpBar();
    updateTimerBar();
    renderBattleActions();
  }

  function renderBattleActions() {
    const actions = document.getElementById('rpg-battle-actions');
    if (!actions) return;
    if (session.rolled || (session.answered && !session.waitingRoll && !session.docAnswerWasCorrect)) {
      actions.innerHTML = '<button class="rpg-btn-next rpg-battle-next" id="rpg-battle-next-btn">次の問題へ →</button>';
      const btn = document.getElementById('rpg-battle-next-btn');
      if (btn) btn.addEventListener('click', session.useDocFormat ? nextDocQuestion : nextQuestion);
    } else if (session.waitingRoll && !session.rolled) {
      actions.innerHTML = '<span class="rpg-next-hint">ダイスを振ると攻撃します</span>';
    } else {
      actions.innerHTML = '<span class="rpg-next-hint">問題に回答してロールを準備</span>';
    }
  }

  function clearHoverWeaponRange() {
    document.querySelectorAll('.rpg-grid-cell.hover-main, .rpg-grid-cell.hover-splash, .rpg-grid-cell.hover-low, .rpg-grid-cell.hover-kill, .rpg-grid-cell.hover-empty, .rpg-grid-cell.hover-occupied, .rpg-grid-cell.hover-pierce').forEach(el => {
      el.classList.remove('hover-main', 'hover-splash', 'hover-low', 'hover-kill', 'hover-empty', 'hover-occupied', 'hover-pierce');
    });
  }

  function previewWeaponRange(enemyId) {
    clearHoverWeaponRange();
    const target = getAliveEnemies().find(e => e.id === enemyId);
    if (!target) return;
    previewWeaponRangeCell(target.row, target.col);
  }

  function previewWeaponRangeCell(row, col) {
    clearHoverWeaponRange();
    const target = { row: Number(row), col: Number(col), enemy: getEnemyAt(Number(row), Number(col)) };
    const weapon = getEquippedWeapon();
    const level = getWeaponLevel(weapon.id) || 1;
    const base = getWeaponAttack(weapon, level);
    collectWeaponAreaCells(target, weapon, level).forEach(hit => {
      const cell = document.querySelector('.rpg-grid-cell[data-row="' + hit.row + '"][data-col="' + hit.col + '"]');
      if (!cell) return;
      cell.classList.add(hit.role === 'main' ? 'hover-main' : (hit.ratio < 0.55 ? 'hover-low' : 'hover-splash'));
      cell.classList.add(hit.enemy ? 'hover-occupied' : 'hover-empty');
      if (hit.role === 'pierce') cell.classList.add('hover-pierce');
      if (hit.enemy && Math.floor(base * hit.ratio) >= hit.enemy.hp) cell.classList.add('hover-kill');
    });
  }

  function updateHpBar() {
    const target = getTargetEnemy();
    const label = document.getElementById('rpg-hp-label');
    if (label && target) {
      label.textContent = target.hp.toLocaleString() + ' / ' + target.maxHp.toLocaleString();
    }
  }

  function updateTimerBar() {
    const fill = document.getElementById('rpg-time-fill');
    const label = document.getElementById('rpg-time-label-text');
    const ratio = session.playerMaxHp > 0 ? (session.playerHp || 0) / session.playerMaxHp : 0;
    if (fill) fill.style.width = Math.max(0, ratio * 100) + '%';
    if (label) label.textContent = 'HP ' + Math.max(0, session.playerHp || 0).toLocaleString() + ' / ' + (session.playerMaxHp || getPlayerMaxHp()).toLocaleString();
  }

  // ===================================================
  //  SP表示更新
  // ===================================================

  function updateSpDisplay() {
    const el = document.getElementById('rpg-sp-val');
    if (el) {
      el.innerHTML = '<span class="rpg-sp-chip base">未変換 ' + (save.sp || 0).toLocaleString() + '</span>' +
        '<span class="rpg-sp-chip yang">陽 ' + (save.spYang || 0).toLocaleString() + '</span>' +
        '<span class="rpg-sp-chip yin">陰 ' + (save.spYin || 0).toLocaleString() + '</span>' +
        '<span class="rpg-sp-chip coin">円 ' + (save.coins || 0).toLocaleString() + '</span>' +
        '<span class="rpg-sp-chip gacha">ガチャ ' + (save.gachaTickets || 0) + ' / 残' + Math.ceil(Math.max(0, GACHA_CORRECTS_REQUIRED - (save.correctForGacha || 0))) + '</span>' +
        '<span class="rpg-sp-chip rebirth">転生 ' + (save.rebirthPoints || 0) + '</span>';
    }
    const modalEl = document.getElementById('rpg-modal-sp-val');
    if (modalEl) {
      modalEl.innerHTML = '<span class="rpg-sp-chip base">未変換 ' + (save.sp || 0).toLocaleString() + '</span>' +
        '<span class="rpg-sp-chip yang">陽 ' + (save.spYang || 0).toLocaleString() + '</span>' +
        '<span class="rpg-sp-chip yin">陰 ' + (save.spYin || 0).toLocaleString() + '</span>';
    }
  }

  // ===================================================
  //  スキルツリー
  // ===================================================

  function getSpConvertRate(attr) {
    const lv = attr === 'yang' ? getSkillEffectLevel('yang_convert') : getSkillEffectLevel('yin_convert');
    return (1 + Math.min(3, lv) * 0.4).toFixed(1);
  }

  function openSkillTree() {
    const modal = document.getElementById('rpg-skill-modal');
    if (modal) modal.classList.remove('hidden');
    renderSkillTree();
  }

  function closeSkillTree() {
    const modal = document.getElementById('rpg-skill-modal');
    if (modal) modal.classList.add('hidden');
  }

  // モーダル間タブ切替 (スキル/転生/ガチャ/装備)
  var MODAL_TABS = ['skill', 'rebirth', 'gacha', 'weapon'];
  function switchModal(which) {
    var map = {
      skill:   { id: 'rpg-skill-modal',   open: openSkillTree },
      rebirth: { id: 'rpg-rebirth-modal', open: openRebirthTree },
      gacha:   { id: 'rpg-gacha-modal',   open: openGachaModal },
      weapon:  { id: 'rpg-weapon-modal',  open: openWeaponModal },
    };
    MODAL_TABS.forEach(function(t) {
      var el = document.getElementById(map[t].id);
      if (el) el.classList.add('hidden');
    });
    if (map[which]) map[which].open();
  }

  function openRebirthTree() {
    const modal = document.getElementById('rpg-rebirth-modal');
    if (modal) modal.classList.remove('hidden');
    renderRebirthTree();
  }

  function closeRebirthTree() {
    const modal = document.getElementById('rpg-rebirth-modal');
    if (modal) modal.classList.add('hidden');
  }

  function renderRebirthTree() {
    const body = document.getElementById('rpg-rebirth-modal-body');
    const point = document.getElementById('rpg-rebirth-point-val');
    if (point) point.textContent = (save.rebirthPoints || 0).toLocaleString();
    if (!body) return;
    let html = '<div class="rpg-rebirth-note">転生スキルはゲーム本体のリセットを押すまで永続します。ゲームオーバー時に進行中スキルはリセットされます。</div>';
    html += '<div class="rpg-skill-nodes rpg-rebirth-nodes">';
    PERMA_SKILL_TREE.forEach(node => {
      const lv = getPermaLevel(node.id);
      const max = node.maxLevel;
      const cost = lv < max ? node.costs[lv] : null;
      const can = cost != null && (save.rebirthPoints || 0) >= cost;
      html += '<div class="rpg-skill-node ' + (lv >= max ? 'unlocked' : 'available') + '">' +
        '<div class="rpg-skill-icon">' + node.icon + '</div>' +
        '<div class="rpg-skill-info"><div class="rpg-skill-name">[' + node.id + '] ' + escHtml(node.name) + ' <span class="rpg-skill-lv">Lv' + lv + '/' + max + '</span></div>' +
        '<div class="rpg-skill-desc">' + escHtml(node.desc) + '</div></div>' +
        '<div class="rpg-skill-right">' + (lv >= max ? '<div class="rpg-skill-status-icon">✅ MAX</div>' : '<div class="rpg-skill-cost">転生P ' + cost + '</div><button class="rpg-skill-unlock-btn" data-perma-node="' + node.id + '"' + (can ? '' : ' disabled style="opacity:.5;cursor:default;"') + '>Lv UP</button>') + '</div>' +
      '</div>';
    });
    html += '</div>';
    body.innerHTML = html;
    body.querySelectorAll('[data-perma-node]').forEach(btn => {
      btn.addEventListener('click', function () { unlockPermaNode(btn.dataset.permaNode); });
    });
  }

  function unlockPermaNode(id) {
    const node = PERMA_SKILL_TREE.find(n => n.id === id);
    if (!node) return;
    if (!save.permaSkillLevels) save.permaSkillLevels = {};
    const lv = getPermaLevel(id);
    if (lv >= node.maxLevel) return;
    const cost = node.costs[lv];
    if ((save.rebirthPoints || 0) < cost) return;
    save.rebirthPoints -= cost;
    save.permaSkillLevels[id] = lv + 1;
    writeSave();
    rebuildDicePool();
    session.playerMaxHp = getPlayerMaxHp();
    session.playerHp = Math.min(session.playerMaxHp, session.playerHp || session.playerMaxHp);
    updateSpDisplay();
    renderRebirthTree();
    renderEnemy();
    renderDicePool();
  }

  function renderSkillTree() {
    const body = document.getElementById('rpg-skill-modal-body');
    if (!body) return;
    updateSpDisplay();

    const draftYang = Math.min(session.spConvertDraft && session.spConvertDraft.yang || 0, save.sp || 0);
    const draftYin  = Math.min(session.spConvertDraft && session.spConvertDraft.yin  || 0, Math.max(0, (save.sp || 0) - draftYang));
    if (session.spConvertDraft) { session.spConvertDraft.yang = draftYang; session.spConvertDraft.yin = draftYin; }
    const remainSp = Math.max(0, (save.sp || 0) - draftYang - draftYin);

    let html = `
      <div class="rpg-sp-converter">
        <div class="rpg-convert-summary">
          <strong>未変換SP</strong>
          <span>${(save.sp || 0).toLocaleString()}</span>
          <small>残り ${remainSp.toLocaleString()}</small>
        </div>
        <div class="rpg-convert-row">
          <span>陽へ x${getSpConvertRate('yang')}</span>
          <button class="rpg-convert-step" data-attr="yang" data-delta="-100">-</button>
          <strong>${draftYang.toLocaleString()}</strong>
          <button class="rpg-convert-step" data-attr="yang" data-delta="100">+</button>
          <input class="rpg-convert-range yang" type="range" min="0" max="${save.sp || 0}" step="100" value="${draftYang}" data-attr="yang" aria-label="陽SPへの変換量">
        </div>
        <div class="rpg-convert-row">
          <span>陰へ x${getSpConvertRate('yin')}</span>
          <button class="rpg-convert-step" data-attr="yin" data-delta="-100">-</button>
          <strong>${draftYin.toLocaleString()}</strong>
          <button class="rpg-convert-step" data-attr="yin" data-delta="100">+</button>
          <input class="rpg-convert-range yin" type="range" min="0" max="${save.sp || 0}" step="100" value="${draftYin}" data-attr="yin" aria-label="陰SPへの変換量">
        </div>
        <button class="rpg-convert-btn" data-convert="confirm">変換確定</button>
      </div>
    `;

    SKILL_CATS.forEach(cat => {
      const nodes = SKILL_TREE.filter(n => n.cat === cat.id);
      const treeUnlocked = isTreeUnlocked(cat.id);
      html += `<div class="rpg-tier-section">
        <div class="rpg-tier-label">${cat.label}${treeUnlocked ? '' : ' <span class="rpg-tree-locked-note">ガチャで開放</span>'}</div>
        <div class="rpg-skill-nodes">`;

      nodes.forEach(node => {
        const nodeGachaLocked = isNodeGachaLocked(node);
        const prereqMet = treeUnlocked && !nodeGachaLocked && node.prereq.every(p => hasNode(p));
        if (node.stackable) {
          const lv = getSkillLevel(node.id);
          const maxLv = node.maxLevel;
          const nextCost = lv < maxLv ? node.costs[lv] : null;
          const canAffordNext = nextCost != null && getAttrSp(getNodeAttr(node)) >= nextCost;
          const isMaxed = lv >= maxLv;
          const stateClass = nodeGachaLocked ? 'locked tree-locked' : (treeUnlocked ? (isMaxed ? 'unlocked' : (lv > 0 ? 'available' : (prereqMet ? 'available' : 'locked'))) : 'locked tree-locked');
          const prereqText = node.prereq.length > 0 ? `前提: ${node.prereq.join(', ')}` : '';
          let pipsHtml = '';
          for (let p = 0; p < maxLv; p++) {
            pipsHtml += `<span class="rpg-skill-pip ${p < lv ? 'filled' : ''}"></span>`;
          }
          let rightHtml = '';
          if (isMaxed) {
            rightHtml = `<div class="rpg-skill-status-icon">✅ MAX</div>`;
          } else if (prereqMet) {
            const disabled = canAffordNext ? '' : ' disabled style="opacity:0.5;cursor:default;"';
            rightHtml = `<div class="rpg-skill-cost">${getNodeCostLabel(node, nextCost)}</div>
              <button class="rpg-skill-unlock-btn" data-node="${node.id}"${disabled}>${lv === 0 ? '解放' : 'Lv UP'}</button>`;
          } else {
            rightHtml = `<div class="rpg-skill-cost">${getNodeCostLabel(node, node.costs[0])}</div>
              <div class="rpg-skill-status-icon">${nodeGachaLocked ? '🎰' : (treeUnlocked ? '🔒' : '🎰')}</div>`;
          }
          html += `<div class="rpg-skill-node ${stateClass}">
            <div class="rpg-skill-icon">${node.icon}</div>
            <div class="rpg-skill-info">
              <div class="rpg-skill-name">[${node.id}] ${node.name} <span class="rpg-skill-lv">Lv${lv}/${maxLv}</span></div>
              <div class="rpg-skill-desc">${node.desc}</div>
              <div class="rpg-skill-pips">${pipsHtml}</div>
              ${prereqText ? `<div class="rpg-skill-prereq">${prereqText}</div>` : ''}
            </div>
            <div class="rpg-skill-right">${rightHtml}</div>
          </div>`;
        } else {
          const unlocked = hasNode(node.id);
          const canAfford = getAttrSp(getNodeAttr(node)) >= (node.cost || 0);
          const available = !unlocked && prereqMet;
          let stateClass = nodeGachaLocked ? 'locked tree-locked' : (treeUnlocked ? (unlocked ? 'unlocked' : available ? 'available' : 'locked') : 'locked tree-locked');
          const prereqText = node.prereq.length > 0 ? `前提: ${node.prereq.join(', ')}` : '';
          let rightHtml = '';
          if (unlocked) {
            rightHtml = `<div class="rpg-skill-status-icon">✅</div>`;
          } else if (available) {
            const disabled = canAfford ? '' : ' disabled style="opacity:0.5;cursor:default;"';
            rightHtml = `<div class="rpg-skill-cost">${getNodeCostLabel(node, node.cost)}</div>
              <button class="rpg-skill-unlock-btn" data-node="${node.id}"${disabled}>解放</button>`;
          } else {
            rightHtml = `<div class="rpg-skill-cost">${getNodeCostLabel(node, node.cost || 0)}</div>
              <div class="rpg-skill-status-icon">${nodeGachaLocked ? '🎰' : (treeUnlocked ? '🔒' : '🎰')}</div>`;
          }
          html += `<div class="rpg-skill-node ${stateClass}">
            <div class="rpg-skill-icon">${node.icon}</div>
            <div class="rpg-skill-info">
              <div class="rpg-skill-name">[${node.id}] ${node.name}</div>
              <div class="rpg-skill-desc">${node.desc}</div>
              ${prereqText ? `<div class="rpg-skill-prereq">${prereqText}</div>` : ''}
            </div>
            <div class="rpg-skill-right">${rightHtml}</div>
          </div>`;
        }
      });
      html += '</div></div>';
    });

    body.innerHTML = html;

    body.querySelectorAll('.rpg-skill-unlock-btn').forEach(btn => {
      btn.addEventListener('click', function () { unlockNode(btn.dataset.node); });
    });
    body.querySelectorAll('.rpg-convert-step').forEach(btn => {
      btn.addEventListener('click', function () {
        const attr = btn.dataset.attr;
        const delta = parseInt(btn.dataset.delta, 10);
        if (!session.spConvertDraft) session.spConvertDraft = { yang: 0, yin: 0 };
        session.spConvertDraft[attr] = Math.max(0, (session.spConvertDraft[attr] || 0) + delta);
        renderSkillTree();
      });
    });
    body.querySelectorAll('.rpg-convert-range').forEach(range => {
      range.addEventListener('input', function () {
        const attr = range.dataset.attr;
        const other = attr === 'yang' ? 'yin' : 'yang';
        const value = Math.max(0, parseInt(range.value, 10) || 0);
        if (!session.spConvertDraft) session.spConvertDraft = { yang: 0, yin: 0 };
        session.spConvertDraft[attr] = Math.min(value, save.sp || 0);
        const total = (session.spConvertDraft.yang || 0) + (session.spConvertDraft.yin || 0);
        if (total > (save.sp || 0)) {
          session.spConvertDraft[other] = Math.max(0, (save.sp || 0) - session.spConvertDraft[attr]);
        }
        renderSkillTree();
      });
    });
    const confirmBtn = body.querySelector('[data-convert="confirm"]');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', function () {
        const yang = session.spConvertDraft.yang || 0;
        const yin  = session.spConvertDraft.yin  || 0;
        if (yang + yin > (save.sp || 0)) { alert('SP不足'); return; }
        save.sp = Math.max(0, (save.sp || 0) - yang - yin);
        addAttrSp('yang', Math.floor(yang * parseFloat(getSpConvertRate('yang'))));
        addAttrSp('yin',  Math.floor(yin  * parseFloat(getSpConvertRate('yin'))));
        session.spConvertDraft = { yang: 0, yin: 0 };
        writeSave();
        updateSpDisplay();
        renderSkillTree();
      });
    }
  }

  function unlockNode(id) {
    const node = SKILL_TREE.find(n => n.id === id);
    if (!node) return;
    if (!isTreeUnlocked(node.cat)) { alert('このスキルツリーはガチャで開放してください'); return; }
    if (isNodeGachaLocked(node)) { alert('この応用スキルはガチャで開放してください'); return; }
    if (!node.prereq.every(p => hasNode(p))) return;
    const attr = getNodeAttr(node);

    if (node.stackable) {
      const currentLv = getSkillLevel(id);
      if (currentLv >= node.maxLevel) { alert('最大レベルに達しています'); return; }
      const cost = node.costs[currentLv];
      if (!spendAttrSp(attr, cost)) { alert('SPが不足しています'); return; }
      if (!save.skillLevels) save.skillLevels = {};
      save.skillLevels[id] = currentLv + 1;
      if (!save.unlockedNodes.includes(id)) save.unlockedNodes.push(id);
      writeSave();
      rebuildDicePool();
      session.playerMaxHp = getPlayerMaxHp();
      session.playerHp = Math.min(session.playerMaxHp, (session.playerHp || session.playerMaxHp));
      updateSpDisplay();
      renderSkillTree();
      renderDicePool();
      return;
    }

    if (hasNode(id)) return;
    if (!spendAttrSp(attr, node.cost || 0)) { alert('SPが不足しています'); return; }
    save.unlockedNodes.push(id);
    writeSave();
    rebuildDicePool();
    session.playerMaxHp = getPlayerMaxHp();
    session.playerHp = Math.min(session.playerMaxHp, (session.playerHp || session.playerMaxHp));
    updateSpDisplay();
    renderSkillTree();
    renderDicePool();
  }

  function rebuildDicePool() {
    const newPool = buildInitialDicePool();
    // ロール済みの値・ロック状態を同じ種別のダイスに引き継ぐ
    const oldByType = {};
    (session.dicePool || []).forEach(function(d) {
      if (!oldByType[d.type]) oldByType[d.type] = [];
      oldByType[d.type].push(d);
    });
    newPool.forEach(function(d) {
      const candidates = oldByType[d.type] || [];
      const old = candidates.shift();
      if (old) { d.value = old.value; d.locked = old.locked; }
    });
    session.dicePool = newPool;
  }

  function applySkillEffects(effect) {
    rebuildDicePool();
  }

  // ===================================================
  //  セッション終了
  // ===================================================

  function endSession(title, subtitle) {
    stopTimer();
    writeSave();
    const overlay = document.getElementById('rpg-end-overlay');
    if (!overlay) return;
    const titleEl = overlay.querySelector('.rpg-end-title');
    const subEl = overlay.querySelector('.rpg-end-sub');
    if (titleEl) titleEl.textContent = title || 'セッション終了';
    if (subEl) subEl.textContent = subtitle || '今回の戦績です。';
    document.getElementById('rpg-end-damage').textContent = session.totalDamage.toLocaleString();
    document.getElementById('rpg-end-sp').textContent = session.totalSp.toLocaleString();
    document.getElementById('rpg-end-defeated').textContent = session.defeatedEnemies;
    document.getElementById('rpg-end-total-sp').textContent = save.sp.toLocaleString();
    overlay.classList.remove('hidden');
  }

  function exitRpgMode() {
    stopTimer();
    writeSave();
    showScreen('screen-title');
  }

  // ===================================================
  //  フラッシュ・ログ
  // ===================================================

  function showAnswerFlash(isCorrect) {
    var el = document.getElementById('rpg-answer-flash');
    if (!el) return;
    el.className = 'rpg-answer-flash ' + (isCorrect ? 'is-correct' : 'is-wrong');
    el.innerHTML = isCorrect
      ? '<span class="flash-mark">○</span><span class="flash-label">正解！</span>'
      : '<span class="flash-mark">×</span><span class="flash-label">不正解</span>';
    el.style.display = 'flex';
    clearTimeout(el._flashTimer);
    el._flashTimer = setTimeout(function () {
      el.classList.add('fading');
      setTimeout(function () { el.style.display = 'none'; el.classList.remove('fading'); }, 400);
    }, 900);
  }

  function rpgLog(entry) {
    if (!session.battleLog) session.battleLog = [];
    var now = new Date();
    var time = ('0' + now.getMinutes()).slice(-2) + ':' + ('0' + now.getSeconds()).slice(-2);
    session.battleLog.unshift('[' + time + '] ' + entry);
    if (session.battleLog.length > 200) session.battleLog.length = 200;
    var logBody = document.getElementById('rpg-log-body');
    if (logBody) {
      logBody.innerHTML = session.battleLog.map(function (l) {
        return '<div class="rpg-log-entry">' + escHtml(l) + '</div>';
      }).join('');
    }
  }

  function toggleRpgLog() {
    var panel = document.getElementById('rpg-log-panel');
    if (!panel) return;
    panel.classList.toggle('hidden');
  }

  // ===================================================
  //  Web Audio SE
  // ===================================================

  const rpgAudio = (function () {
    let ctx = null;
    function getCtx() {
      if (!ctx) {
        try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
      }
      return ctx;
    }
    function tone(type, freq, gainVal, dur, freqEnd) {
      const c = getCtx(); if (!c) return;
      const osc = c.createOscillator();
      const g   = c.createGain();
      osc.connect(g); g.connect(c.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, c.currentTime);
      if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, c.currentTime + dur);
      g.gain.setValueAtTime(gainVal, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      osc.start(); osc.stop(c.currentTime + dur + 0.01);
    }
    function noise(gainVal, dur) {
      const c = getCtx(); if (!c) return;
      const bufLen = Math.ceil(c.sampleRate * dur);
      const buf = c.createBuffer(1, bufLen, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1);
      const src = c.createBufferSource();
      src.buffer = buf;
      const g = c.createGain();
      src.connect(g); g.connect(c.destination);
      g.gain.setValueAtTime(gainVal, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      src.start(); src.stop(c.currentTime + dur + 0.01);
    }
    return {
      attackFx: function (fx) {
        if (fx === 'slash') {
          tone('sawtooth', 520, 0.3, 0.12, 160);
          setTimeout(() => noise(0.08, 0.06), 20);
        } else if (fx === 'smash') {
          tone('square', 90, 0.4, 0.18, 40);
          noise(0.18, 0.12);
        } else if (fx === 'pierce') {
          tone('sine', 800, 0.25, 0.08, 300);
          setTimeout(() => tone('triangle', 400, 0.1, 0.06, 200), 60);
        } else if (fx === 'sweep') {
          tone('triangle', 260, 0.3, 0.22, 80);
          setTimeout(() => tone('sawtooth', 340, 0.15, 0.14, 100), 40);
        }
      },
      diceRoll: function () {
        for (let i = 0; i < 5; i++) {
          setTimeout(() => { tone('square', 300 + Math.random() * 200, 0.08, 0.04); noise(0.04, 0.03); }, i * 60);
        }
      },
      correct: function () {
        tone('sine', 660, 0.25, 0.1);
        setTimeout(() => tone('sine', 880, 0.2, 0.15), 90);
      },
      wrong: function () {
        tone('sawtooth', 200, 0.2, 0.18, 120);
      },
      stageClear: function () {
        [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone('sine', f, 0.22, 0.18), i * 110));
      }
    };
  })();

  function playRpgSe(name) {
    try {
      if (!rpgAudio) return;
      if (name === 'correct')    rpgAudio.correct();
      else if (name === 'wrong') rpgAudio.wrong();
      else if (name === 'roll' || name === 'dice') rpgAudio.diceRoll();
      else if (name === 'stageClear') rpgAudio.stageClear();
      // 'attack' は呼び出し元で rpgAudio.attackFx(fx) を直接使用
    } catch(e) {}
  }

  // ===================================================
  //  DOM構築
  // ===================================================

  function buildRpgScreenDOM() {
    const screen = document.getElementById('screen-rpg');
    if (!screen) return;

    screen.innerHTML = `
      <div id="rpg-header">
        <span class="rpg-title-label">⚔️ RPGモード</span>
        <div class="rpg-timer" id="rpg-timer">敵ターン <span id="rpg-timer-val">Turn 0</span></div>
        <div class="rpg-sp-display"><span class="sp-icon">💎</span>SP <span class="rpg-sp-val" id="rpg-sp-val">0</span></div>
        <div class="rpg-header-spacer"></div>
        <div class="rpg-header-btns">
          <button class="rpg-btn" id="rpg-btn-skill" title="SPを使ってダイス数や攻撃性能を伸ばします。">🌟 スキルツリー</button>
          <button class="rpg-btn" id="rpg-btn-rebirth" title="転生ポイントで永続強化します。">♾️ 転生</button>
          <button class="rpg-btn" id="rpg-btn-gacha" title="正解で得たガチャ権を使って応用スキルやレリックを獲得します。">🎰 ガチャ</button>
          <button class="rpg-btn" id="rpg-btn-weapon" title="コインで武器を購入・強化・装備します。">🧰 装備</button>
          <button class="rpg-btn rpg-btn-debug" id="rpg-btn-debug">🐛 DBG</button>
          <button class="rpg-btn rpg-btn-reset" id="rpg-btn-reset" title="SPとスキル・武器進行をリセット">🔄 リセット</button>
          <button class="rpg-btn rpg-btn-end" id="rpg-btn-exit">終了</button>
        </div>
      </div>

      <div id="rpg-scroll-nav" class="rpg-view-tabs">
        <button class="rpg-nav-jump rpg-view-tab active" data-view="question" title="PDFを見ながら回答します。回答欄はドラッグで動かせます。">📄 問題</button>
        <button class="rpg-nav-jump rpg-view-tab" data-view="explain" disabled title="回答後に解説と判定を確認できます。">📝 解説</button>
        <button class="rpg-nav-jump rpg-view-tab" data-view="roll" title="ダイスを振ると、右の盤面へ攻撃が反映されます。">🎲 ダイス/戦闘</button>
      </div>

      <div id="rpg-panels">
        <div id="rpg-panel-question"><p style="color:#7870a0;font-size:14px;">読み込んでいます...</p></div>
        <div id="rpg-panel-dice"><div class="rpg-dice-waiting">正解するとダイスをロールできます</div></div>
        <div id="rpg-panel-enemy"><div class="rpg-dice-waiting">盤面を準備しています...</div></div>
      </div>

      <div id="rpg-skill-modal" class="hidden">
        <div class="rpg-modal-backdrop" id="rpg-modal-backdrop"></div>
        <div class="rpg-modal-panel">
          <div class="rpg-modal-header">
            <span class="rpg-modal-title">🌟 スキルツリー</span>
            <span class="rpg-modal-sp">💎 SP: <span id="rpg-modal-sp-val">0</span></span>
            <button class="rpg-modal-close" id="rpg-modal-close">✕</button>
          </div>
          <nav class="rpg-modal-tab-nav" data-modal-nav>
            <button class="rpg-modal-tab rpg-tab-active" data-mtab="skill">🌟 スキル</button>
            <button class="rpg-modal-tab" data-mtab="rebirth">♾️ 転生</button>
            <button class="rpg-modal-tab" data-mtab="gacha">🎰 ガチャ</button>
            <button class="rpg-modal-tab" data-mtab="weapon">🧰 装備</button>
          </nav>
          <div class="rpg-modal-body" id="rpg-skill-modal-body"></div>
        </div>
      </div>

      <div id="rpg-weapon-modal" class="hidden">
        <div class="rpg-modal-backdrop" id="rpg-weapon-backdrop"></div>
        <div class="rpg-modal-panel rpg-weapon-modal-panel">
          <div class="rpg-modal-header">
            <span class="rpg-modal-title">🧰 装備・武器強化</span>
            <span class="rpg-modal-sp">💴 <span id="rpg-weapon-coin-val">0</span></span>
            <button class="rpg-modal-close" id="rpg-weapon-close">✕</button>
          </div>
          <nav class="rpg-modal-tab-nav" data-modal-nav>
            <button class="rpg-modal-tab" data-mtab="skill">🌟 スキル</button>
            <button class="rpg-modal-tab" data-mtab="rebirth">♾️ 転生</button>
            <button class="rpg-modal-tab" data-mtab="gacha">🎰 ガチャ</button>
            <button class="rpg-modal-tab rpg-tab-active" data-mtab="weapon">🧰 装備</button>
          </nav>
          <div class="rpg-modal-body" id="rpg-weapon-modal-body"></div>
        </div>
      </div>
      <div id="rpg-gacha-modal" class="hidden">
        <div class="rpg-modal-backdrop" id="rpg-gacha-backdrop"></div>
        <div class="rpg-modal-panel">
          <div class="rpg-modal-header">
            <span class="rpg-modal-title">🎰 ガチャ</span>
            <span class="rpg-modal-sp">権利 <span id="rpg-gacha-ticket-val">0</span></span>
            <button class="rpg-modal-close" id="rpg-gacha-close">✕</button>
          </div>
          <nav class="rpg-modal-tab-nav" data-modal-nav>
            <button class="rpg-modal-tab" data-mtab="skill">🌟 スキル</button>
            <button class="rpg-modal-tab" data-mtab="rebirth">♾️ 転生</button>
            <button class="rpg-modal-tab rpg-tab-active" data-mtab="gacha">🎰 ガチャ</button>
            <button class="rpg-modal-tab" data-mtab="weapon">🧰 装備</button>
          </nav>
          <div class="rpg-modal-body" id="rpg-gacha-modal-body"></div>
        </div>
      </div>
      <div id="rpg-rebirth-modal" class="hidden">
        <div class="rpg-modal-backdrop" id="rpg-rebirth-backdrop"></div>
        <div class="rpg-modal-panel">
          <div class="rpg-modal-header">
            <span class="rpg-modal-title">♾️ 転生スキルツリー</span>
            <span class="rpg-modal-sp">転生P <span id="rpg-rebirth-point-val">0</span></span>
            <button class="rpg-modal-close" id="rpg-rebirth-close">✕</button>
          </div>
          <nav class="rpg-modal-tab-nav" data-modal-nav>
            <button class="rpg-modal-tab" data-mtab="skill">🌟 スキル</button>
            <button class="rpg-modal-tab rpg-tab-active" data-mtab="rebirth">♾️ 転生</button>
            <button class="rpg-modal-tab" data-mtab="gacha">🎰 ガチャ</button>
            <button class="rpg-modal-tab" data-mtab="weapon">🧰 装備</button>
          </nav>
          <div class="rpg-modal-body" id="rpg-rebirth-modal-body"></div>
        </div>
      </div>

      <div id="rpg-answer-flash" style="display:none"></div>

      <div id="rpg-log-panel" class="hidden">
        <div class="rpg-log-header">📜 バトルログ <button class="rpg-log-close" id="rpg-log-close">✕</button></div>
        <div class="rpg-log-body" id="rpg-log-body"></div>
      </div>

      <div id="rpg-end-overlay" class="hidden">
        <div class="rpg-end-panel">
          <div class="rpg-end-title">セッション終了</div>
          <div class="rpg-end-sub">今回の戦績です。</div>
          <div class="rpg-end-stats">
            <div class="rpg-end-stat"><span class="rpg-end-stat-label">⚔️ 総ダメージ</span><span class="rpg-end-stat-val" id="rpg-end-damage">0</span></div>
            <div class="rpg-end-stat"><span class="rpg-end-stat-label">💎 獲得SP</span><span class="rpg-end-stat-val" id="rpg-end-sp">0</span></div>
            <div class="rpg-end-stat"><span class="rpg-end-stat-label">💀 撃破数</span><span class="rpg-end-stat-val" id="rpg-end-defeated">0</span></div>
            <div class="rpg-end-stat"><span class="rpg-end-stat-label">💎 合計SP</span><span class="rpg-end-stat-val" id="rpg-end-total-sp">0</span></div>
          </div>
          <div class="rpg-end-btn-row">
            <button class="rpg-end-btn primary" id="rpg-end-continue">続けてプレイ</button>
            <button class="rpg-end-btn secondary" id="rpg-end-exit">タイトルへ</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('rpg-btn-skill').addEventListener('click', openSkillTree);
    document.getElementById('rpg-btn-rebirth').addEventListener('click', openRebirthTree);
    document.getElementById('rpg-btn-gacha').addEventListener('click', openGachaModal);
    document.getElementById('rpg-btn-weapon').addEventListener('click', openWeaponModal);
    document.getElementById('rpg-btn-debug').addEventListener('click', function () {
      session.debugMode = !session.debugMode;
      var btn = document.getElementById('rpg-btn-debug');
      if (btn) btn.style.background = session.debugMode ? '#c0392b' : '';
      if (session.docPhase === 'question') renderDocQuestion();
    });
    document.getElementById('rpg-btn-exit').addEventListener('click', exitRpgMode);
    document.getElementById('rpg-btn-reset').addEventListener('click', function () {
      if (!confirm('セーブデータ（SP・スキル・武器・進行）をリセットします。よろしいですか？')) return;
      try { localStorage.removeItem(RPG_LS_KEY); } catch(e) {}
      save = { sp: 0, spYang: 0, spYin: 0, coins: 200, unlockedNodes: [], skillLevels: {}, gachaUnlockedTrees: [], gachaUnlockedNodes: [], gachaTickets: 0, correctForGacha: 0, relics: [], gachaAtkBonus: 0, gachaAtkFlat: 0, gachaHpFlat: 0, gachaEnemyAtkDown: 0, gachaEnemyTurnDelay: 0, weaponUseCounts: {}, favoriteWeapon: '', permaSkillLevels: {}, rebirthPoints: 0,
        weapons: {}, equippedWeapon: '', equippedWeapon2: '', board: null, enemyIndex: 0, enemyHp: ENEMY_TEMPLATES[0].hp };
      writeSave();
      ensureBoardState(true);
      session.dicePool = buildInitialDicePool();
      renderEnemy();
      renderDicePool();
      updateSpDisplay();
      showBattleToast('🔄 進行リセット完了');
    });

    document.querySelectorAll('#rpg-scroll-nav .rpg-view-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!btn.disabled) setRpgView(btn.dataset.view);
      });
    });

    document.addEventListener('keydown', function rpgKeyHandler(e) {
      var screen = document.getElementById('screen-rpg');
      if (!screen || screen.classList.contains('hidden')) {
        document.removeEventListener('keydown', rpgKeyHandler);
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (session.waitingRoll && !session.rolled) rollAllDice();
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        toggleRpgLog();
      }
      if (!e.ctrlKey && !e.altKey && !e.metaKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        var tag = (document.activeElement && document.activeElement.tagName || '').toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') {
          // モーダルが開いていれば矢印でタブ切替
          var modalIds = ['rpg-skill-modal', 'rpg-rebirth-modal', 'rpg-gacha-modal', 'rpg-weapon-modal'];
          var openIdx = modalIds.findIndex(function(id) { return document.getElementById(id) && !document.getElementById(id).classList.contains('hidden'); });
          if (openIdx !== -1) {
            e.preventDefault();
            var dir = e.key === 'ArrowRight' ? 1 : -1;
            switchModal(MODAL_TABS[(openIdx + dir + MODAL_TABS.length) % MODAL_TABS.length]);
          } else {
            e.preventDefault();
            moveRpgView(e.key === 'ArrowRight' ? 1 : -1);
          }
        }
      }
    });

    var logCloseBtn = document.getElementById('rpg-log-close');
    if (logCloseBtn) logCloseBtn.addEventListener('click', toggleRpgLog);

    document.getElementById('rpg-end-continue').addEventListener('click', function () {
      const overlay = document.getElementById('rpg-end-overlay');
      if (overlay) overlay.classList.add('hidden');
      if (window._rpgDocData && window._rpgDocData.questions && window._rpgDocData.questions.length > 0) {
        rpgStartDocSession(window._rpgDocData);
        return;
      }
      showRpgCsvPicker();
    });
    document.getElementById('rpg-end-exit').addEventListener('click', exitRpgMode);
    document.getElementById('rpg-modal-backdrop').addEventListener('click', closeSkillTree);
    document.getElementById('rpg-modal-close').addEventListener('click', closeSkillTree);
    document.getElementById('rpg-weapon-backdrop').addEventListener('click', closeWeaponModal);
    document.getElementById('rpg-weapon-close').addEventListener('click', closeWeaponModal);
    document.getElementById('rpg-gacha-backdrop').addEventListener('click', closeGachaModal);
    document.getElementById('rpg-gacha-close').addEventListener('click', closeGachaModal);
    document.getElementById('rpg-rebirth-backdrop').addEventListener('click', closeRebirthTree);
    document.getElementById('rpg-rebirth-close').addEventListener('click', closeRebirthTree);
    // モーダルタブクリックイベント (document委譲)
    document.addEventListener('click', function(e) {
      var tab = e.target.closest('[data-mtab]');
      if (!tab) return;
      switchModal(tab.dataset.mtab);
    });
  }

  // ===================================================
  //  ユーティリティ（欠落補完）
  // ===================================================

  function shuffleArray(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  // ===================================================
  //  武器モーダル
  // ===================================================

  function openWeaponModal() {
    var modal = document.getElementById('rpg-weapon-modal');
    if (!modal) return;
    renderWeaponShop();
    modal.classList.remove('hidden');
  }

  function closeWeaponModal() {
    var modal = document.getElementById('rpg-weapon-modal');
    if (modal) modal.classList.add('hidden');
  }

  function openGachaModal() {
    var modal = document.getElementById('rpg-gacha-modal');
    if (!modal) return;
    renderGachaPanel();
    modal.classList.remove('hidden');
  }

  function closeGachaModal() {
    var modal = document.getElementById('rpg-gacha-modal');
    if (modal) modal.classList.add('hidden');
  }

  function renderGachaPanel() {
    var body = document.getElementById('rpg-gacha-modal-body');
    if (!body) return;
    var ticketVal = document.getElementById('rpg-gacha-ticket-val');
    if (ticketVal) ticketVal.textContent = (save.gachaTickets || 0).toLocaleString();
    var lockedNodes = SKILL_TREE.filter(node => isNodeGachaLocked(node));
    var ownedRelics = (save.relics || []).map(id => RELICS.find(r => r.id === id)).filter(Boolean);
    var html = '<div class="rpg-gacha-panel standalone">';
    html += '<div><strong>🎰 深淵ガチャ</strong><span>5回正解で1回 / 30%で応用スキル開放 / 8%でレリック</span></div>';
    html += '<button class="rpg-gacha-btn' + ((save.gachaTickets || 0) > 0 ? '' : ' disabled') + '" data-rpg-gacha>1回まわす</button>';
    html += '<div class="rpg-gacha-note">ガチャ権 ' + (save.gachaTickets || 0) + ' / 次まであと ' + Math.ceil(Math.max(0, GACHA_CORRECTS_REQUIRED - (save.correctForGacha || 0))) + ' 正解' + (lockedNodes.length ? ' / 未開放応用: ' + lockedNodes.map(n => n.name).join('・') : ' / 応用スキルは全開放済み') + '</div>';
    html += '<div class="rpg-gacha-relics">' + (ownedRelics.length ? ownedRelics.map(r => '<span title="' + escHtml(r.name) + ': ' + escHtml(r.desc) + '">' + r.icon + '</span>').join('') : '<em>レリック未所持</em>') + '</div>';
    html += '</div>';
    body.innerHTML = html;
    var gachaBtn = body.querySelector('[data-rpg-gacha]');
    if (gachaBtn) gachaBtn.addEventListener('click', rollGacha);
  }

  function renderWeaponShop() {
    var body = document.getElementById('rpg-weapon-modal-body');
    if (!body) return;
    var coinVal = document.getElementById('rpg-weapon-coin-val');
    if (coinVal) coinVal.textContent = (save.coins || 0).toLocaleString();
    var html = '<div class="rpg-weapon-shop">';
    WEAPONS.forEach(function (w) {
      var lv = getWeaponLevel(w.id);
      var maxLv = (w.costs && w.costs.length) || 0;
      var cost = lv < maxLv ? w.costs[lv] : null;
      var atk  = getWeaponAttack(w, Math.max(lv, 1));
      var isEquipped = save.equippedWeapon === w.id;
      var isEquipped2 = save.equippedWeapon2 === w.id;
      var canBuy = cost !== null && (save.coins || 0) >= cost;
      var owned = lv > 0;
      html += '<div class="rpg-weapon-shop-item' + (isEquipped ? ' equipped' : '') + '">';
      html += '<span class="rpg-ws-icon">' + w.icon + '</span>';
      html += '<div class="rpg-ws-info">';
      html += '<strong>' + escHtml(w.name) + '</strong>';
      html += ' <span class="rpg-ws-fx">' + escHtml(w.fx || '') + '</span>';
      html += '<div class="rpg-ws-stats">ATK ' + atk.toLocaleString() + (lv > 0 ? ' Lv' + lv : '') + '</div>';
      html += '<div class="rpg-ws-range">' + escHtml(getWeaponRangeLabel(w)) + '</div>';
      html += '<div class="rpg-ws-ability">' + escHtml(getWeaponAbilityLabel(w)) + '</div>';
      html += '<div class="rpg-ws-desc">' + escHtml(w.desc || '') + '</div>';
      html += '</div>';
      html += '<div class="rpg-ws-btns">';
      if (cost !== null) {
        html += '<button class="rpg-ws-btn buy' + (canBuy ? '' : ' disabled') + '" data-weapon-buy="' + w.id + '">' +
          (owned ? '強化 ' : '購入 ') + cost.toLocaleString() + '\u{1F4B4}</button>';
      } else if (owned) {
        html += '<span class="rpg-ws-maxlv">MAX Lv</span>';
      }
      if (owned && !isEquipped) {
        html += '<button class="rpg-ws-btn equip" data-weapon-equip="' + w.id + '">主装備</button>';
      }
      if (hasRelic('dual_wield') && owned && !isEquipped2 && !isEquipped) {
        html += '<button class="rpg-ws-btn equip" data-weapon-equip2="' + w.id + '">副装備</button>';
      }
      if (isEquipped) {
        html += '<span class="rpg-ws-equipped">主装備中</span>';
      }
      if (isEquipped2) {
        html += '<span class="rpg-ws-equipped">副装備中</span>';
      }
      html += '</div></div>';
    });
    html += '</div>';
    body.innerHTML = html;

    body.querySelectorAll('[data-weapon-buy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.dataset.weaponBuy;
        var wdef = getWeaponDef(id);
        if (!wdef) return;
        var lv = getWeaponLevel(id);
        var cost = wdef.costs && wdef.costs[lv];
        if (cost === undefined || cost === null) return;
        if ((save.coins || 0) < cost) { showBattleToast('\u{1F4B4} コイン不足', 'warn'); return; }
        save.coins -= cost;
        if (!save.weapons) save.weapons = {};
        save.weapons[id] = (save.weapons[id] || 0) + 1;
        // 装備中の武器がない場合（初回購入など）は自動装備
        if (!save.equippedWeapon || getWeaponLevel(save.equippedWeapon) < 1) {
          save.equippedWeapon = id;
        }
        writeSave();
        renderWeaponShop();
        renderEnemy();
        updateSpDisplay();
        showBattleToast(wdef.icon + ' ' + wdef.name + ' ' + (lv === 0 ? '購入！ 自動装備しました' : 'Lv' + (lv + 1) + ' 強化！'));
      });
    });
    body.querySelectorAll('[data-weapon-equip]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.dataset.weaponEquip;
        if (getWeaponDef(id) && getWeaponLevel(id) > 0) {
          save.equippedWeapon = id;
          if (save.equippedWeapon2 === id) save.equippedWeapon2 = '';
          writeSave();
          renderWeaponShop();
          renderEnemy();
          showBattleToast(getWeaponDef(id).icon + ' ' + getWeaponDef(id).name + ' に切り替えた');
        }
      });
    });
    body.querySelectorAll('[data-weapon-equip2]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.dataset.weaponEquip2;
        if (getWeaponDef(id) && getWeaponLevel(id) > 0 && hasRelic('dual_wield')) {
          save.equippedWeapon2 = id;
          writeSave();
          renderWeaponShop();
          renderEnemy();
          showBattleToast(getWeaponDef(id).icon + ' ' + getWeaponDef(id).name + ' を副装備');
        }
      });
    });
  }

  function rollGacha() {
    if ((save.gachaTickets || 0) <= 0) { showBattleToast('🎰 ガチャ権がありません', 'warn'); return; }
    save.gachaTickets -= 1;
    if (!Array.isArray(save.gachaUnlockedTrees)) save.gachaUnlockedTrees = [];
    if (!Array.isArray(save.relics)) save.relics = [];

    const lockedNodes = SKILL_TREE.filter(node => isNodeGachaLocked(node));
    const availableRelics = RELICS.filter(r => !save.relics.includes(r.id));
    const roll = Math.random();
    let message = '';

    if (lockedNodes.length && roll < TREE_UNLOCK_RATE) {
      const node = lockedNodes[Math.floor(Math.random() * lockedNodes.length)];
      save.gachaUnlockedNodes.push(node.id);
      message = '🎰 応用スキル開放: ' + node.name;
    } else if (availableRelics.length && roll < TREE_UNLOCK_RATE + RELIC_RATE) {
      const relic = availableRelics[Math.floor(Math.random() * availableRelics.length)];
      save.relics.push(relic.id);
      message = '✨ レリック獲得: ' + relic.name;
    } else {
      const misses = [
        function () { save.gachaAtkFlat = (save.gachaAtkFlat || 0) + 10; return '⚔️ 攻撃力 +10'; },
        function () { save.gachaHpFlat = (save.gachaHpFlat || 0) + 10; return '❤️ HP +10'; },
        function () { save.gachaEnemyAtkDown = (save.gachaEnemyAtkDown || 0) + 1; return '🛡️ 敵攻撃力減少'; },
        function () { save.gachaEnemyTurnDelay = (save.gachaEnemyTurnDelay || 0) + 1; return '⏳ 敵攻撃ターン +1'; },
      ];
      message = misses[Math.floor(Math.random() * misses.length)]();
    }

    writeSave();
    session.playerMaxHp = getPlayerMaxHp();
    session.playerHp = Math.min(session.playerMaxHp, session.playerHp || session.playerMaxHp);
    updateSpDisplay();
    renderGachaPanel();
    renderEnemy();
    showBattleToast(message, 'coin');
    rpgLog('ガチャ: ' + message);
  }

  // ===================================================
  //  DOMContentLoaded
  // ===================================================

  function injectRpgButton() {
    if (document.getElementById('btnRpgMode')) return;
    const resetBtn = document.getElementById('btnResetRecords');
    if (!resetBtn) return;
    resetBtn.insertAdjacentHTML('beforebegin',
      '<button id="btnRpgMode" class="btn-start btn-rpg-start hidden">' +
      '<span>&#9876;&#65039; RPGモードで挑む</span>' +
      '<span class="btn-arrow">&#8594;</span>' +
      '</button>'
    );
    document.getElementById('btnRpgMode').addEventListener('click', function () {
      window.startRpgMode && window.startRpgMode();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    buildRpgScreenDOM();
    injectRpgButton();
    watchForSelectRoute();
  });

  window.startRpgMode = function () {
    showScreen('screen-rpg');
    if (window._rpgDocData && window._rpgDocData.questions && window._rpgDocData.questions.length > 0) {
      rpgStartDocSession(window._rpgDocData);
      return;
    }
    loadSave();
    showRpgCsvPicker();
  };

})();

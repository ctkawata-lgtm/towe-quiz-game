import fs from 'node:fs/promises';
import path from 'node:path';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const outputDir = path.resolve('outputs');
await fs.mkdir(outputDir, { recursive: true });

const standardRows = [
  [1, '宅地', 50, 4, 112],
  [2, '宅地', 40, 6, 116],
  [3, '農地', 10, 8, 119],
  [4, '農地', 5, 9, 121],
  [5, '農地', 8, 10, 122],
  [6, '農地', 15, 11, 123],
  [7, '農地', 20, 12, 125],
  [8, '区分所有家屋', 60, 13, 127],
  [9, '区分所有家屋', 80, 15, 132],
  [10, '区分所有家屋', 55, 17, 138],
  [11, '区分所有家屋', 40, 19, 143],
  [12, '区分所有家屋', 40, 21, 146],
  [13, '償却資産の課税標準', 10, 23, 149],
  [14, '総務大臣指定資産の配分（船舶）', 10, 24, 151],
  [15, '総務大臣指定資産の配分（船舶）', 10, 26, 153],
  [16, '総務大臣指定資産の配分（航空機）', 10, 27, 155],
  [17, '総務大臣指定資産の配分（鉄道、車両）', 15, 28, 156],
  [18, '大規模の償却資産の計算', 15, 29, 158],
  [19, '大規模の償却資産の計算', 20, 30, 160],
  [20, '大規模の償却資産の計算', 25, 31, 162],
  [21, '宅地', 20, 34, 166],
  [22, '宅地', 40, 35, 168],
  [23, '宅地', 60, 37, 172],
  [24, '宅地（特定空家等の特例）', 5, 39, 176],
  [25, '宅地（被災住宅用地の特例）', 25, 40, 177],
  [26, '宅地以外', 10, 42, 180],
  [27, '農地', 10, 43, 182],
  [28, '農地', 15, 44, 184],
  [29, '農地', 15, 45, 186],
  [30, '農地', 5, 46, 188],
  [31, '農地', 25, 47, 189],
  [32, '農地', 20, 48, 192],
  [33, '区分所有家屋', 50, 50, 194],
  [34, '区分所有家屋', 55, 51, 198],
  [35, '区分所有家屋', 60, 53, 202],
  [36, '区分所有家屋', 70, 55, 207],
  [37, '区分所有家屋', 75, 57, 212],
  [38, '区分所有家屋', 60, 59, 217],
  [39, '区分所有家屋', 40, 61, 222],
  [40, '区分所有家屋（被災住宅用地の特例）', 40, 63, 225],
  [41, '区分所有家屋（居住用超高層建築物）', 30, 65, 229],
  [42, '償却資産の課税標準', 10, 66, 232],
  [43, '総務大臣指定資産の配分（船舶）', 25, 68, 234],
  [44, '総務大臣指定資産の配分（航空機）', 35, 71, 236],
  [45, '総務大臣指定資産の配分（鉄道、車両）', 25, 73, 239],
  [46, '大規模の償却資産の計算', 15, 74, 241],
  [47, '大規模の償却資産の計算', 15, 75, 243],
  [48, '大規模の償却資産の計算', 30, 76, 245],
];

const examRows = [
  [66, '第66回 平成28年度（改題）', '', 81, 250],
  [67, '第67回 平成29年度（改題）', '', 84, 258],
  [68, '第68回 平成30年度（改題）', '', 88, 268],
  [69, '第69回 令和元年度（改題）', '', 96, 277],
  [70, '第70回 令和2年度（改題）', '', 101, 285],
];

const standardQuestionPages = [
  10, 16, 21, 24, 26, 28, 31, 35, 41, 49, 56, 61, 66, 69, 73, 76,
  78, 81, 84, 87, 92, 95, 101, 107, 109, 114, 117, 120, 123, 126, 128,
  132, 136, 141, 147, 154, 161, 168, 175, 180, 186, 190, 194, 199, 204,
  207, 210, 213,
];
const standardAnswerPages = [
  12, 18, 22, 25, 27, 29, 32, 37, 43, 51, 58, 63, 67, 71, 74, 77,
  79, 82, 85, 89, 93, 97, 103, 108, 111, 115, 118, 121, 124, 127, 129,
  134, 137, 143, 149, 156, 163, 170, 177, 182, 187, 192, 197, 201, 205,
  208, 211, 216,
];
const examPhysicalRows = [
  [221, 223, 224, 231],
  [232, 235, 236, 245],
  [246, 253, 254, 262],
  [263, 267, 268, 275],
  [276, 282, 283, 286],
];
const excelColumn = number => {
  let result = '';
  while (number > 0) {
    number--;
    result = String.fromCharCode(65 + number % 26) + result;
    number = Math.floor(number / 26);
  }
  return result;
};

function buildStandardRows() {
  return standardRows.map((row, index) => {
    const [number, topic, minutes, printedQuestionStart, printedAnswerStart] = row;
    const section = number <= 20 ? '第I部 基礎問題' : '第II部 応用問題';
    const next = standardRows[index + 1];
    const printedQuestionEnd = next ? next[3] - 1 : 79;
    const printedAnswerEnd = next ? next[4] - 1 : 249;
    return {
      id: `${section.includes('基礎') ? '基礎' : '応用'}-${String(number).padStart(2, '0')}`,
      section,
      topic,
      minutes,
      printedQuestionStart,
      printedQuestionEnd,
      printedAnswerStart,
      printedAnswerEnd,
      questionStart: standardQuestionPages[index],
      questionEnd: standardAnswerPages[index] - 1,
      answerStart: standardAnswerPages[index],
      answerEnd: (standardQuestionPages[index + 1] || 221) - 1,
    };
  });
}

function buildExamRows() {
  return examRows.map((row, index) => {
    const [number, topic, minutes, printedQuestionStart, printedAnswerStart] = row;
    const next = examRows[index + 1];
    const printedQuestionEnd = next ? next[3] - 1 : 111;
    const printedAnswerEnd = next ? next[4] - 1 : 288;
    const [questionStart, questionEnd, answerStart, answerEnd] = examPhysicalRows[index];
    return {
      id: `本試験-${number}`,
      section: '第III部 本試験問題',
      topic,
      minutes,
      printedQuestionStart,
      printedQuestionEnd,
      printedAnswerStart,
      printedAnswerEnd,
      questionStart,
      questionEnd,
      answerStart,
      answerEnd,
    };
  });
}

const standardAnswers = [
  [['令和2年度分 固定資産税額', '178,000'], ['令和3年度分 固定資産税額', '3,537,000']],
  [['固定資産税額', '2,620,400']],
  [['固定資産税額', '18,200']],
  [['固定資産税額', '156,300']],
  [['固定資産税額', '80,600']],
  [['固定資産税額', '134,400']],
  [['令和2年度分 固定資産税額', '78,400'], ['令和3年度分 固定資産税額', '140,000']],
  [['固定資産税額 1', '677,000'], ['固定資産税額 2', '88,900'], ['固定資産税額 3', '148,300'], ['固定資産税額 4', '473,900'], ['固定資産税額 5', '338,500'], ['固定資産税額 6', '296,600']],
  [['固定資産税額 1', '60,800'], ['固定資産税額 2', '243,400'], ['固定資産税額 3', '212,500'], ['固定資産税額 4', '265,600'], ['固定資産税額 5', '225,500'], ['固定資産税額 6', '416,100'], ['固定資産税額 7', '232,400']],
  [['固定資産税額', '1,031,000']],
  [['固定資産税額 1', '104,900'], ['固定資産税額 2', '803,900'], ['固定資産税額 3', '131,100'], ['固定資産税額 4', '364,400'], ['固定資産税額 5', '97,000'], ['固定資産税額 6', '393,500']],
  [['固定資産税額', '476,400']],
  [['固定資産税額', '1,419,600']],
  [['固定資産税額 1', '665,000'], ['固定資産税額 2', '105,000'], ['固定資産税額 3', '1,155,000']],
  [['固定資産税額 1', '420,000'], ['固定資産税額 2', '252,000']],
  [['A市 固定資産税額', '7,700,000'], ['B市 固定資産税額', '6,300,000']],
  [['固定資産税額', '7,815,400']],
  [['B町課税分 課税標準額（千円）', '73,848,000'], ['A県課税分 課税標準額（千円）', '6,152,000']],
  [['B村課税分 課税標準額（千円）', '95,368,000'], ['A県課税分 課税標準額（千円）', '8,132,000']],
  [['乙町課税分 課税標準額（千円）', '271,600,000'], ['甲県課税分 課税標準額（千円）', '20,500,000']],
  [['固定資産税額', '103,600']],
  [['固定資産税額', '1,348,400']],
  [['令和2年度分 固定資産税額', '748,400'], ['令和3年度分 固定資産税額', '2,340,700']],
  [['固定資産税額', '137,200']],
  [['固定資産税額', '648,300']],
  [['固定資産税額', '105,200']],
  [['固定資産税額', '63,200']],
  [['固定資産税額', '120,500']],
  [['固定資産税額', '36,200']],
  [['固定資産税額', '13,400']],
  [['固定資産税額 1', '128,800'], ['固定資産税額 2', '150,900'], ['固定資産税額 3', '257,600']],
  [['土地M 固定資産税額', '126,000'], ['土地N 固定資産税額', '110,100'], ['土地L 固定資産税額', '368,700']],
  [['A 固定資産税額', '98,000'], ['B 固定資産税額', '98,000'], ['C 固定資産税額', '525,000'], ['D 固定資産税額', '532,000'], ['E 固定資産税額', '630,000']],
  [['甲 固定資産税額', '482,300'], ['A 固定資産税額', '274,300'], ['C 固定資産税額', '274,300'], ['D 固定資産税額', '381,100'], ['B 固定資産税額', '404,200'], ['E 固定資産税額', '519,700']],
  [['固定資産税額 1', '805,800'], ['固定資産税額 2', '354,900'], ['固定資産税額 3', '461,200'], ['固定資産税額 4', '887,300'], ['固定資産税額 5', '766,100'], ['固定資産税額 6', '513,400']],
  [['固定資産税額 1', '556,500'], ['固定資産税額 2', '695,700'], ['固定資産税額 3', '746,700'], ['固定資産税額 4', '703,300'], ['固定資産税額 5', '139,400'], ['固定資産税額 6', '407,700']],
  [['固定資産税額 1', '1,016,800'], ['固定資産税額 2', '1,482,600'], ['固定資産税額 3', '200,100'], ['固定資産税額 4', '416,700'], ['固定資産税額 5', '266,900'], ['固定資産税額 6', '376,300']],
  [['固定資産税額 1', '459,300'], ['固定資産税額 2', '230,500'], ['固定資産税額 3', '364,400']],
  [['固定資産税額 1', '334,900'], ['固定資産税額 2', '256,700'], ['固定資産税額 3', '271,500'], ['固定資産税額 4', '148,800']],
  [['固定資産税額 1', '171,800'], ['固定資産税額 2', '85,900'], ['固定資産税額 3', '29,700'], ['固定資産税額 4', '136,800'], ['固定資産税額 5', '14,000'], ['固定資産税額 6', '410,400'], ['固定資産税額 7', '61,200']],
  [['固定資産税額 1', '954,400'], ['固定資産税額 2', '268,800'], ['固定資産税額 3', '84,000'], ['固定資産税額 4', '1,896,200']],
  [['固定資産税額', '319,100']],
  [['固定資産税額', '123,500']],
  [['A市 固定資産税額', '81,200'], ['B市 固定資産税額', '34,000'], ['C市 固定資産税額', '100,500'], ['D市 固定資産税額', '165,200']],
  [['A市 固定資産税額', '2,687,500'], ['B市 固定資産税額', '7,787,500'], ['C市 固定資産税額', '17,587,500'], ['D市 固定資産税額', '2,187,500']],
  [['乙町課税分 課税標準額（千円）', '221,761,811'], ['甲県課税分 課税標準額（千円）', '1,415,238,189']],
  [['乙市課税分 課税標準額（千円）', '68,514,285'], ['甲県課税分 課税標準額（千円）', '13,485,715']],
  [['A県課税分 課税標準額（千円）', '8,628,573'], ['B市課税分 課税標準額（千円）', '205,714,285'], ['C町課税分 課税標準額（千円）', '21,157,142']],
];

const rows = [...buildStandardRows(), ...buildExamRows()];
const workbook = Workbook.create();
const questions = workbook.worksheets.add('問題');
const pages = workbook.worksheets.add('ページ情報');
const guide = workbook.worksheets.add('使い方');

const subQuestionHeaders = Array.from({ length: 20 }, (_, index) => [
  `${index + 1}問目の回答範囲`,
  `${index + 1}問目の正解`,
]).flat();
const questionValues = [
  ['問題番号', ...subQuestionHeaders],
  ...rows.map((row, rowIndex) => {
    const answers = standardAnswers[rowIndex] || [['公式解答を確認', '確認|確認済み|check']];
    return [
      row.id,
      ...answers.flat(),
      ...Array(40 - answers.length * 2).fill(''),
    ];
  }),
];

const pageValues = [
  ['問題番号', 'PDF内問題開始ページ', 'PDF内問題終了ページ', 'PDF内解答開始ページ', 'PDF内解答終了ページ', '書籍印刷問題開始ページ', '書籍印刷問題終了ページ', '書籍印刷解答開始ページ', '書籍印刷解答終了ページ'],
  ...rows.map(row => [
    row.id,
    row.questionStart,
    row.questionEnd,
    row.answerStart,
    row.answerEnd,
    row.printedQuestionStart,
    row.printedQuestionEnd,
    row.printedAnswerStart,
    row.printedAnswerEnd,
  ]),
];

const guideValues = [
  ['TAC2021 固定資産税 過去問 PDFゲーム用データ', 'PDF + Excel モード'],
  ['対象PDF', 'TAC2021_固定資産税過去問の本 v2.pdf'],
  ['収録ステージ数', rows.length],
  ['PDF総ページ数', 296],
  ['採点方式', '第I部・第II部は公式解答冒頭の最終値を登録しています。カンマは入力してもしなくても採点できます。'],
  ['ゲーム中の入力', '表示された小問をすべて入力してください。全欄が一致すると正解です。'],
  ['厳密な自動採点', '必要な場合は「問題」シートの各小問について、回答範囲と正解を入力してください。正解候補は | 区切りで複数登録できます。'],
  ['問題シート', 'A列は問題番号です。B列以降は回答範囲と正解の組を最大20小問まで管理します。空欄の組はゲーム画面に表示されません。'],
  ['ページ情報シート', 'B-E列はPDFファイル内の物理ページ番号、F-I列は書籍に印刷されたページ番号です。ゲームの移動にはB-E列を使います。'],
  ['PDF内解答終了ページ', '解説が複数ページあるため、PDF内の解答開始ページと終了ページを登録しています。'],
  ['PDFページ番号', 'PDFファイル内の物理ページ番号です。書籍の印刷ページ順と異なるため、対応を個別に登録しています。'],
  ['本試験問題', '第III部の本試験5回分は複合問題のため、「確認」と入力して公式解答を参照する方式です。'],
  ['確認推奨', '区分所有家屋など解答要約が表組みの問題は、回答範囲を中立的な連番にしています。必要に応じて名称を編集してください。'],
  ['作成元', '目次およびPDF画像を確認して作成'],
];

questions.getRange(`A1:AO${questionValues.length}`).values = questionValues;
pages.getRange(`A1:I${pageValues.length}`).values = pageValues;
guide.getRange(`A1:B${guideValues.length}`).values = guideValues;

function styleSheet(sheet, headerRange, usedRange) {
  sheet.freezePanes.freezeRows(1);
  sheet.getRange(usedRange).format.font = { name: 'Yu Gothic UI', size: 10 };
  sheet.getRange(usedRange).format.verticalAlignment = 'center';
  sheet.getRange(headerRange).format = {
    fill: '#401720',
    font: { name: 'Yu Gothic UI', size: 10, bold: true, color: '#FFF4DF' },
    verticalAlignment: 'center',
  };
  sheet.getRange(headerRange).format.rowHeight = 27;
}

styleSheet(questions, 'A1:AO1', `A1:AO${questionValues.length}`);
styleSheet(pages, 'A1:I1', `A1:I${pageValues.length}`);
styleSheet(guide, 'A1:B1', `A1:B${guideValues.length}`);

questions.getRange('A:A').format.columnWidth = 16;
for (let index = 0; index < 20; index++) {
  const rangeColumn = excelColumn(2 + index * 2);
  const answerColumn = excelColumn(3 + index * 2);
  questions.getRange(`${rangeColumn}:${rangeColumn}`).format.columnWidth = 20;
  questions.getRange(`${answerColumn}:${answerColumn}`).format.columnWidth = 15;
}
pages.getRange('A:A').format.columnWidth = 16;
pages.getRange('B:I').format.columnWidth = 17;
guide.getRange('A:A').format.columnWidth = 22;
guide.getRange('B:B').format.columnWidth = 88;
guide.getRange(`A2:A${guideValues.length}`).format.font = {
  name: 'Yu Gothic UI',
  size: 10,
  bold: true,
  color: '#401720',
};

const fileName = 'TAC2021_固定資産税_pdf_game.xlsx';
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(path.join(outputDir, fileName));

for (const [sheetName, range, imageName] of [
  ['問題', 'A1:K10', 'TAC2021_koteishisan_questions_preview.png'],
  ['ページ情報', 'A1:I10', 'TAC2021_koteishisan_pages_preview.png'],
  ['使い方', `A1:B${guideValues.length}`, 'TAC2021_koteishisan_guide_preview.png'],
]) {
  const image = await workbook.render({ sheetName, range, scale: 1.2 });
  await fs.writeFile(path.join(outputDir, imageName), Buffer.from(await image.arrayBuffer()));
}

for (const range of ['問題!A1:K6', 'ページ情報!A1:I6', `使い方!A1:B${guideValues.length}`]) {
  const inspected = await workbook.inspect({
    kind: 'table',
    range,
    include: 'values',
    tableMaxRows: 16,
    tableMaxCols: 10,
  });
  console.log(inspected.ndjson);
}

console.log(`created=${path.join(outputDir, fileName)} stages=${rows.length}`);

import fs from 'node:fs/promises';
import path from 'node:path';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const rows = JSON.parse(await fs.readFile('outputs/chusyou_rows.json', 'utf8'));
const outputDir = path.resolve('outputs');
await fs.mkdir(outputDir, { recursive: true });

const excelColumn = number => {
  let result = '';
  while (number > 0) {
    number--;
    result = String.fromCharCode(65 + number % 26) + result;
    number = Math.floor(number / 26);
  }
  return result;
};

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
  ...rows.map(row => [
    row.id,
    ...row.values.flatMap(value => [value.label, value.answer]),
    ...Array(40 - row.values.length * 2).fill(''),
  ]),
];

const pageValues = [
  ['問題番号', 'PDF内問題開始ページ', 'PDF内問題終了ページ', 'PDF内解答開始ページ', 'PDF内解答終了ページ', '書籍印刷問題開始ページ', '書籍印刷問題終了ページ', '書籍印刷解答開始ページ', '書籍印刷解答終了ページ'],
  ...rows.map(row => [
    row.id,
    row.question_start,
    row.question_end,
    row.answer_start,
    row.answer_end,
    row.question_start - 4,
    row.question_end - 4,
    row.answer_start - 4,
    row.answer_end - 4,
  ]),
];

const guideValues = [
  ['24_kakomonn_chusyou.pdf PDFゲーム用データ', 'PDF + Excel モード'],
  ['対象PDF', '24_kakomonn_chusyou.pdf'],
  ['収録年度', '令和4年度、令和3年度、令和2年度、令和元年度、平成30年度、平成29年度'],
  ['収録ステージ数', rows.length],
  ['PDF総ページ数', 252],
  ['問題シート', 'A列は問題番号です。B列以降は回答範囲と正解の組を最大20小問まで管理します。'],
  ['複数設問', '設問1、設問2などがある問題は、ゲーム画面に複数の入力欄を表示します。'],
  ['ページ情報シート', 'B-E列はPDFファイル内の物理ページ番号、F-I列は書籍に印刷されたページ番号です。ゲームの移動にはB-E列を使います。'],
  ['正解なし', '令和3年度の一部設問は正解一覧が「－」のため、「確認」と入力して解説を参照してください。'],
  ['入力例', '選択肢は ア、イ、ウ、エ、オ のいずれかを入力します。'],
  ['作成元', 'PDFの問題編、解答・解説編、年度別正解一覧表を確認して作成'],
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

questions.getRange('A:A').format.columnWidth = 14;
for (let index = 0; index < 20; index++) {
  const rangeColumn = excelColumn(2 + index * 2);
  const answerColumn = excelColumn(3 + index * 2);
  questions.getRange(`${rangeColumn}:${rangeColumn}`).format.columnWidth = 17;
  questions.getRange(`${answerColumn}:${answerColumn}`).format.columnWidth = 12;
}
pages.getRange('A:A').format.columnWidth = 14;
pages.getRange('B:I').format.columnWidth = 21;
guide.getRange('A:A').format.columnWidth = 22;
guide.getRange('B:B').format.columnWidth = 92;
guide.getRange(`A2:A${guideValues.length}`).format.font = {
  name: 'Yu Gothic UI',
  size: 10,
  bold: true,
  color: '#401720',
};

const fileName = '24_kakomonn_chusyou_pdf_game.xlsx';
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(path.join(outputDir, fileName));

for (const [sheetName, range, imageName] of [
  ['問題', 'A1:K12', '24_kakomonn_chusyou_questions_preview.png'],
  ['ページ情報', 'A1:I12', '24_kakomonn_chusyou_pages_preview.png'],
  ['使い方', `A1:B${guideValues.length}`, '24_kakomonn_chusyou_guide_preview.png'],
]) {
  const image = await workbook.render({ sheetName, range, scale: 1.2 });
  await fs.writeFile(path.join(outputDir, imageName), Buffer.from(await image.arrayBuffer()));
}

for (const range of ['問題!A1:K10', 'ページ情報!A1:I8', `使い方!A1:B${guideValues.length}`]) {
  const inspected = await workbook.inspect({
    kind: 'table',
    range,
    include: 'values',
    tableMaxRows: 16,
    tableMaxCols: 12,
  });
  console.log(inspected.ndjson);
}

console.log(`created=${path.join(outputDir, fileName)} stages=${rows.length}`);

import fs from 'node:fs/promises';
import path from 'node:path';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const source = JSON.parse(await fs.readFile('document_mode_rows.json', 'utf8'));
const outputDir = path.resolve('outputs');
await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();
const questions = workbook.worksheets.add('問題');
const pages = workbook.worksheets.add('ページ情報');
const guide = workbook.worksheets.add('使い方');

const questionValues = [
  ['問題番号', '正解', '別解'],
  ...source.question_rows.map(row => [row['問題番号'], row['正解'], row['別解']]),
];
const pageValues = [
  ['問題番号', '問題開始ページ', '問題終了ページ', '解答ページ'],
  ...source.page_rows.map(row => [
    row['問題番号'],
    row['問題開始ページ'],
    row['問題終了ページ'],
    row['解答ページ'],
  ]),
];

questions.getRange(`A1:C${questionValues.length}`).values = questionValues;
pages.getRange(`A1:D${pageValues.length}`).values = pageValues;
guide.getRange('A1:B10').values = [
  ['24_kakomonn_jouhou.pdf 攻略データ', 'PDF + Excel 攻略モード用'],
  ['対象PDF', '24_kakomonn_jouhou.pdf'],
  ['収録問題数', source.question_rows.length],
  ['PDF総ページ数', source.pdf_pages],
  ['問題シート', '問題番号、正解、別解を管理します。'],
  ['ページ情報シート', '問題番号をキーに問題ページと解答ページを管理します。'],
  ['入力例', 'ア または 1'],
  ['複数解答', '該当する場合は | 区切りで入力します。'],
  ['注意', 'ページ番号はPDFビューア上の通しページ番号です。'],
  ['生成元', source.source],
];

for (const [sheet, headerRange, usedRange] of [
  [questions, 'A1:C1', `A1:C${questionValues.length}`],
  [pages, 'A1:D1', `A1:D${pageValues.length}`],
  [guide, 'A1:B1', 'A1:B10'],
]) {
  sheet.freezePanes.freezeRows(1);
  sheet.getRange(usedRange).format.font = { name: 'Yu Gothic UI', size: 10 };
  sheet.getRange(usedRange).format.verticalAlignment = 'center';
  sheet.getRange(headerRange).format = {
    fill: '#3A1D2A',
    font: { name: 'Yu Gothic UI', size: 10, bold: true, color: '#FFF4DF' },
    verticalAlignment: 'center',
  };
  sheet.getRange(headerRange).format.rowHeight = 26;
}

questions.getRange('A:A').format.columnWidth = 16;
questions.getRange('B:C').format.columnWidth = 14;
pages.getRange('A:A').format.columnWidth = 16;
pages.getRange('B:D').format.columnWidth = 20;
guide.getRange('A:A').format.columnWidth = 20;
guide.getRange('B:B').format.columnWidth = 78;
guide.getRange('A2:A10').format.font = { name: 'Yu Gothic UI', size: 10, bold: true, color: '#3A1D2A' };

const fileName = '24_kakomonn_jouhou_pdf_game.xlsx';
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(path.join(outputDir, fileName));

for (const [sheetName, range, imageName] of [
  ['問題', 'A1:C12', '24_kakomonn_questions_preview.png'],
  ['ページ情報', 'A1:D12', '24_kakomonn_pages_preview.png'],
  ['使い方', 'A1:B10', '24_kakomonn_guide_preview.png'],
]) {
  const image = await workbook.render({ sheetName, range, scale: 1.4 });
  await fs.writeFile(path.join(outputDir, imageName), Buffer.from(await image.arrayBuffer()));
}

for (const range of ['問題!A1:C8', 'ページ情報!A1:D8', '使い方!A1:B10']) {
  const inspected = await workbook.inspect({
    kind: 'table',
    range,
    include: 'values',
    tableMaxRows: 12,
    tableMaxCols: 6,
  });
  console.log(inspected.ndjson);
}
console.log(`created=${path.join(outputDir, fileName)} questions=${source.question_rows.length}`);

import fs from 'node:fs/promises';
import path from 'node:path';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const outputDir = path.resolve('outputs');
await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();
const questions = workbook.worksheets.add('問題');
const pages = workbook.worksheets.add('ページ情報');

questions.getRange('A1:C4').values = [
  ['問題番号', '正解', '別解'],
  [1, '42', '42.0'],
  [2, '売上高営業利益率', '営業利益率|売上高営業利益率'],
  [3, '100', '100円|100.0'],
];
pages.getRange('A1:D4').values = [
  ['問題番号', '問題開始ページ', '問題終了ページ', '解答ページ'],
  [1, 3, 4, 28],
  [2, 5, 5, 29],
  [3, 6, 7, 30],
];

for (const [sheet, headerRange] of [[questions, 'A1:C1'], [pages, 'A1:D1']]) {
  sheet.freezePanes.freezeRows(1);
  const used = sheet.getUsedRange();
  used.format.font = { name: 'Yu Gothic UI', size: 11 };
  used.format.verticalAlignment = 'center';
  sheet.getRange(headerRange).format = {
    fill: '#3A1D2A',
    font: { name: 'Yu Gothic UI', size: 11, bold: true, color: '#FFF4DF' },
    verticalAlignment: 'center',
  };
  sheet.getRange(headerRange).format.rowHeight = 26;
}

questions.getRange('A:A').format.columnWidth = 14;
questions.getRange('B:B').format.columnWidth = 30;
questions.getRange('C:C').format.columnWidth = 42;
pages.getRange('A:A').format.columnWidth = 14;
pages.getRange('B:D').format.columnWidth = 20;

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(path.join(outputDir, 'pdf_excel_quiz_template.xlsx'));
const questionPreview = await workbook.render({ sheetName: '問題', range: 'A1:C4', scale: 1.5 });
const pagePreview = await workbook.render({ sheetName: 'ページ情報', range: 'A1:D4', scale: 1.5 });
await fs.writeFile(path.join(outputDir, 'pdf_excel_quiz_template_questions.png'), Buffer.from(await questionPreview.arrayBuffer()));
await fs.writeFile(path.join(outputDir, 'pdf_excel_quiz_template_pages.png'), Buffer.from(await pagePreview.arrayBuffer()));

const questionInspect = await workbook.inspect({
  kind: 'table',
  range: '問題!A1:C4',
  include: 'values',
  tableMaxRows: 6,
  tableMaxCols: 5,
});
const pageInspect = await workbook.inspect({
  kind: 'table',
  range: 'ページ情報!A1:D4',
  include: 'values',
  tableMaxRows: 6,
  tableMaxCols: 6,
});
console.log(questionInspect.ndjson);
console.log(pageInspect.ndjson);

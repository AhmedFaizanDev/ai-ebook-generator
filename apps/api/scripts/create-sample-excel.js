/**
 * One-off script: creates batch-sample.xlsx with two book topics in column A.
 * Run from apps/api: node scripts/create-sample-excel.js
 */
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const topics = [
  'Introduction to Python Programming',
  'Data Structures and Algorithms',
];

async function main() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Books', { views: [{ state: 'frozen', ySplit: 1 }] });

  sheet.getColumn(1).width = 45;
  sheet.getCell('A1').value = 'Title of the Book';
  sheet.getCell('A1').font = { bold: true };
  topics.forEach((title, i) => {
    sheet.getCell(`A${i + 2}`).value = title;
  });

  const outPath = path.join(__dirname, '..', 'batch-sample.xlsx');
  await workbook.xlsx.writeFile(outPath);
  console.log('Created:', outPath);
  console.log('Topics:', topics.join(', '));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

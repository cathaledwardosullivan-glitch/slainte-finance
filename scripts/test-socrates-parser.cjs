const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const csvPath = path.join('C:', 'Users', 'user', 'Downloads', 'Report1.csv');
const csvText = fs.readFileSync(csvPath, 'utf-8');

const COL = { AGE_BAND: 0, GMS_FEMALE: 1, GMS_MALE: 2, GMS_TOTAL: 4, DVC_FEMALE: 5, DVC_MALE: 6, DVC_TOTAL: 8, PRIVATE_FEMALE: 9, PRIVATE_TOTAL: 13, GRAND_TOTAL: 17 };

function normalizeAgeBand(label) { return (label || '').trim().replace(/\s+/g, ' ').toLowerCase(); }
function parseCell(v) { if (v === undefined || v === null || v === '') return 0; const n = parseInt(String(v).trim(), 10); return isNaN(n) ? 0 : n; }

const parsed = Papa.parse(csvText, { skipEmptyLines: true });
let under6 = 0, age6to9 = 0, over70 = 0, w2544 = 0, w4565 = 0;
let totalGMS = 0, totalDVC = 0, totalPrivate = 0, grandTotal = 0;

console.log('=== Parsed Rows ===');
for (const row of parsed.data) {
  const label = normalizeAgeBand(row[0]);
  if (label.includes('crosstab')) { console.log('  [SKIP header]'); continue; }
  if (label === 'unknown') { console.log('  [SKIP unknown]'); continue; }
  if (label === '') { continue; }

  if (label === 'total') {
    totalGMS = parseCell(row[4]);
    totalDVC = parseCell(row[8]);
    totalPrivate = parseCell(row[13]);
    grandTotal = parseCell(row[17]);
    console.log(`  Total: GMS=${totalGMS}, DVC=${totalDVC}, Private=${totalPrivate}, Grand=${grandTotal}`);
    continue;
  }

  const gmsT = parseCell(row[4]), dvcT = parseCell(row[8]);
  const allF = parseCell(row[1]) + parseCell(row[5]) + parseCell(row[9]);
  const gmsAndDvc = gmsT + dvcT;

  console.log(`  ${label.padEnd(15)} GMS=${gmsT}, DVC=${dvcT}, GMS+DVC=${gmsAndDvc}, AllFemale=${allF}`);

  if (label.includes('under 6')) under6 = gmsAndDvc;
  if (label.startsWith('06')) age6to9 = gmsAndDvc;
  if (/^(70|75|80|85|90|95)/.test(label)) over70 += gmsAndDvc;
  if (/^(25|30|35|40)/.test(label)) w2544 += allF;
  if (/^(45|50|55|60)/.test(label)) w4565 += allF;
}

console.log('\n=== Extracted Health Check Data ===');
console.log('Under 6 (GMS+DVC):', under6);
console.log('Age 6-9 (GMS+DVC):', age6to9);
console.log('Over 70 (GMS+DVC):', over70);
console.log('Women 25-44 (all):', w2544);
console.log('Women 45-65 (all):', w4565);
console.log('\n=== Panel Summary ===');
console.log('Total GMS:', totalGMS);
console.log('Total DVC:', totalDVC);
console.log('Total Private:', totalPrivate);
console.log('Grand Total:', grandTotal);

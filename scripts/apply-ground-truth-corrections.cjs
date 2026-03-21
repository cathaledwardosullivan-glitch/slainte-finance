/**
 * apply-ground-truth-corrections.cjs
 *
 * Reads the most recent ground-truth JSON, applies category corrections
 * based on a user audit of Opus review results, and writes a corrected file.
 *
 * Usage: node scripts/apply-ground-truth-corrections.cjs
 */

const fs = require('fs');
const path = require('path');

const testDataDir = path.join(__dirname, '..', 'test-data');

// Find most recent ground-truth file
const gtFiles = fs.readdirSync(testDataDir)
  .filter(f => f.startsWith('ground-truth-') && f.endsWith('.json'))
  .sort()
  .reverse();

if (gtFiles.length === 0) {
  console.error('No ground-truth files found in test-data/');
  process.exit(1);
}

const inputFile = path.join(testDataDir, gtFiles[0]);
console.log(`Reading: ${gtFiles[0]}`);

const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
const { transactions, categoryMapping } = data;

// Helper: look up full category from mapping by code
function getCategoryByCode(code) {
  const cat = categoryMapping.find(c => c.code === code);
  if (!cat) {
    console.warn(`  WARNING: Category code "${code}" not found in categoryMapping`);
    return null;
  }
  return cat;
}

// Helper: apply a correction rule
// matcher: function(txn) => boolean
// targetCode: new category code
// description: human-readable rule description
function applyCorrection(matcher, targetCode, description) {
  const targetCat = getCategoryByCode(targetCode);
  if (!targetCat) return 0;

  let count = 0;
  for (const txn of transactions) {
    if (matcher(txn)) {
      txn.categoryCode = targetCat.code;
      txn.categoryName = targetCat.name;
      txn.category = { ...targetCat };
      count++;
    }
  }
  if (count > 0) {
    console.log(`  [${count}] ${description} -> ${targetCode} "${targetCat.name}"`);
  } else {
    console.log(`  [0]  ${description} (no matches)`);
  }
  return count;
}

// Wildcard match helper (supports * as glob)
function wildcardMatch(str, pattern) {
  // Escape regex special chars except *
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp('^' + escaped, 'i').test(str);
}

console.log('\nApplying corrections:\n');
let totalCorrections = 0;

// 1. 01-101020*SP CREDITS currently 1.0 -> 1.1
totalCorrections += applyCorrection(
  txn => wildcardMatch(txn.details, '01-101020*SP') && txn.isIncome && txn.categoryCode === '1.0',
  '1.1',
  '#1: 01-101020*SP credits from 1.0'
);

// 2. Claims *HEAL SP or *Claims*Claim Exp*SP currently 1.0 -> 1.5
totalCorrections += applyCorrection(
  txn => txn.categoryCode === '1.0' && (
    wildcardMatch(txn.details, 'Claims *HEAL SP') ||
    /Claims.*Claim Exp.*SP/i.test(txn.details)
  ),
  '1.5',
  '#2: Claims HEAL/Claim Exp from 1.0'
);

// 3. 2000*INV/DPR SP or E2E*SP or 04210*IEL1 SP currently 1.0 -> 1.5
totalCorrections += applyCorrection(
  txn => txn.categoryCode === '1.0' && (
    wildcardMatch(txn.details, '2000*INV/DPR SP') ||
    wildcardMatch(txn.details, 'E2E*SP') ||
    wildcardMatch(txn.details, '04210*IEL1 SP')
  ),
  '1.5',
  '#3: 2000*INV/DPR, E2E*, 04210*IEL1 from 1.0'
);

// 4. NEPOSCHG* currently 80 -> 41.1
totalCorrections += applyCorrection(
  txn => wildcardMatch(txn.details, 'NEPOSCHG*') && txn.categoryCode === '80',
  '41.1',
  '#4: NEPOSCHG* from 80'
);

// 5. BRIGHTHR SEPA DD currently 50.2 -> 32.1
totalCorrections += applyCorrection(
  txn => txn.details.includes('BRIGHTHR SEPA DD') && txn.categoryCode === '50.2',
  '32.1',
  '#5: BRIGHTHR SEPA DD from 50.2'
);

// 6. Eurofins Biom* currently 22.2 -> 10.5
totalCorrections += applyCorrection(
  txn => wildcardMatch(txn.details, 'Eurofins Biom*') && txn.categoryCode === '22.2',
  '10.5',
  '#6: Eurofins Biom* from 22.2'
);

// 7. 2000*INV/DPR SP or 2000*DPR SP currently 1.1 -> 1.5
totalCorrections += applyCorrection(
  txn => txn.categoryCode === '1.1' && (
    wildcardMatch(txn.details, '2000*INV/DPR SP') ||
    wildcardMatch(txn.details, '2000*DPR SP')
  ),
  '1.5',
  '#7: 2000*INV/DPR, 2000*DPR from 1.1'
);

// 8. Currently 80 "Sundry Expenses" parent -> 80.1 subcategory
totalCorrections += applyCorrection(
  txn => txn.categoryCode === '80',
  '80.1',
  '#8: Parent code 80 -> 80.1 subcategory'
);

// 9. TO COMFORT AIR CONDIT currently 2.0 -> 22.2
totalCorrections += applyCorrection(
  txn => txn.details.includes('TO COMFORT AIR CONDIT') && txn.categoryCode === '2.0',
  '22.2',
  '#9: TO COMFORT AIR CONDIT from 2.0'
);

// 10. TO COMFORT AIR CONDIT currently 21.2 -> 22.2
totalCorrections += applyCorrection(
  txn => txn.details.includes('TO COMFORT AIR CONDIT') && txn.categoryCode === '21.2',
  '22.2',
  '#10: TO COMFORT AIR CONDIT from 21.2'
);

// 11. TO RICHARD currently 40.0 -> 22.2
totalCorrections += applyCorrection(
  txn => txn.details.includes('TO RICHARD') && txn.categoryCode === '40.0',
  '22.2',
  '#11: TO RICHARD from 40.0'
);

// 12. POS09APR NEJM GRP MAS currently 10.0 -> 50.3
totalCorrections += applyCorrection(
  txn => txn.details.includes('POS09APR NEJM GRP MAS') && txn.categoryCode === '10.0',
  '50.3',
  '#12: NEJM GRP MAS from 10.0'
);

// 13. POS25SEP WWW.TONSTIX. currently 31.1 -> 10.1
totalCorrections += applyCorrection(
  txn => txn.details.includes('POS25SEP WWW.TONSTIX.') && txn.categoryCode === '31.1',
  '10.1',
  '#13: WWW.TONSTIX from 31.1'
);

// 14. POS24SEP PAYPAL *TREN currently 30.0 -> 80.2
totalCorrections += applyCorrection(
  txn => txn.details.includes('POS24SEP PAYPAL *TREN') && txn.categoryCode === '30.0',
  '80.2',
  '#14: PAYPAL *TREN from 30.0'
);

// 15. POS27NOV GRIFFITH AVE currently 80.0 -> 80.1
totalCorrections += applyCorrection(
  txn => txn.details.includes('POS27NOV GRIFFITH AVE') && txn.categoryCode === '80.0',
  '80.1',
  '#15: GRIFFITH AVE from 80.0'
);

// 16. POS26NOV WATERMARK CA currently 31.1 -> 80.1
totalCorrections += applyCorrection(
  txn => txn.details.includes('POS26NOV WATERMARK CA') && txn.categoryCode === '31.1',
  '80.1',
  '#16: WATERMARK CA from 31.1'
);

// 17. GOCARDLESS SEPA DD currently 80.2 -> 32.1
totalCorrections += applyCorrection(
  txn => txn.details.includes('GOCARDLESS SEPA DD') && txn.categoryCode === '80.2',
  '32.1',
  '#17: GOCARDLESS SEPA DD from 80.2'
);

// 18. TO BG BLINDS AND SHUT currently 22.4 -> 22.2
totalCorrections += applyCorrection(
  txn => txn.details.includes('TO BG BLINDS AND SHUT') && txn.categoryCode === '22.4',
  '22.2',
  '#18: BG BLINDS AND SHUT from 22.4'
);

// 19. TO PRODENT UNLIMITED currently 22.1 -> 10.1
totalCorrections += applyCorrection(
  txn => txn.details.includes('TO PRODENT UNLIMITED') && txn.categoryCode === '22.1',
  '10.1',
  '#19: PRODENT UNLIMITED from 22.1'
);

// 20. POS*DONAGHY BROS currently 10.6 -> 80.2
totalCorrections += applyCorrection(
  txn => /POS.*DONAGHY BROS/i.test(txn.details) && txn.categoryCode === '10.6',
  '80.2',
  '#20: DONAGHY BROS from 10.6'
);

// 21. POS08DEC NURSING AND currently 50.5 -> 50.4
totalCorrections += applyCorrection(
  txn => txn.details.includes('POS08DEC NURSING AND') && txn.categoryCode === '50.5',
  '50.4',
  '#21: NURSING AND from 50.5'
);

// 22. POS*Amazon.ie currently 31 -> 80.1
totalCorrections += applyCorrection(
  txn => /POS.*Amazon\.ie/i.test(txn.details) && txn.categoryCode === '31',
  '80.1',
  '#22: Amazon.ie from 31'
);

// Write output
const today = new Date().toISOString().slice(0, 10);
const outputFile = path.join(testDataDir, `ground-truth-${today}-corrected.json`);

data.exportedAt = new Date().toISOString();
data.source = `corrected from ${gtFiles[0]}`;
data.stats.correctedTransactions = totalCorrections;

fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));

console.log(`\n========================================`);
console.log(`Total corrections applied: ${totalCorrections}`);
console.log(`Output: test-data/ground-truth-${today}-corrected.json`);
console.log(`========================================`);

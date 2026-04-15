/**
 * Test Script: Staged Review (Phase 6)
 *
 * Creates a realistic staged result file in the Electron userData directory,
 * simulating what the background processor produces after processing a PDF.
 *
 * Usage:
 *   node scripts/test-staged-review.cjs
 *
 * Then launch the app (npm run electron-dev) and talk to Finn:
 *   - "Any staged transactions?" or "Review my transactions"
 *   - Finn should find the staged file and walk you through the review
 *
 * To clean up:
 *   node scripts/test-staged-review.cjs --cleanup
 */

const fs = require('fs');
const path = require('path');

// Electron userData path on Windows — must match package.json "name" field
const userDataPath = path.join(process.env.APPDATA, 'slainte-finance-v2');
const stagingPath = path.join(userDataPath, 'staged-results');

// --cleanup flag
if (process.argv.includes('--cleanup')) {
  console.log('\n=== Cleanup ===\n');

  // 1. Remove test staging files
  if (fs.existsSync(stagingPath)) {
    const files = fs.readdirSync(stagingPath).filter(f => f.startsWith('staged-test-'));
    files.forEach(f => {
      fs.unlinkSync(path.join(stagingPath, f));
      console.log(`Deleted staging file: ${f}`);
    });
    if (files.length === 0) console.log('No test staging files found.');
  }

  // 2. Remove test transactions from localStorage.json (applied during review)
  const localStoragePath = path.join(userDataPath, 'localStorage.json');
  if (fs.existsSync(localStoragePath)) {
    const storage = JSON.parse(fs.readFileSync(localStoragePath, 'utf8'));
    const txnsRaw = storage.gp_finance_transactions;
    if (txnsRaw) {
      const txns = JSON.parse(txnsRaw);
      const before = txns.length;
      const cleaned = txns.filter(t => !t.id || !t.id.startsWith('test-txn-'));
      const removed = before - cleaned.length;
      if (removed > 0) {
        storage.gp_finance_transactions = JSON.stringify(cleaned);
        fs.writeFileSync(localStoragePath, JSON.stringify(storage, null, 2));
        console.log(`Removed ${removed} test transactions from Electron localStorage.json`);
      } else {
        console.log('No test transactions found in Electron localStorage.json');
      }
    }
  }

  // 3. Remove test transactions from browser localStorage.
  //    Browser localStorage isn't accessible from Node, so we inject a cleanup
  //    script that the app's preload can pick up. Simpler: just tell the user
  //    to paste one line in DevTools.
  console.log('');
  console.log('Almost done! Open the app, press Ctrl+Shift+I to open DevTools,');
  console.log('paste this ONE line into the Console tab, then press Enter:');
  console.log('');
  console.log('  localStorage.setItem("gp_finance_transactions", JSON.stringify(JSON.parse(localStorage.getItem("gp_finance_transactions")||"[]").filter(t=>!t.id?.startsWith("test-txn-")))); location.reload();');
  console.log('');
  console.log('That removes the test transactions and reloads the app. Done!\n');
  process.exit(0);
}

// Ensure staging directory exists
if (!fs.existsSync(stagingPath)) {
  fs.mkdirSync(stagingPath, { recursive: true });
}

// ============================================================================
// Generate realistic test transactions
// ============================================================================

let txnCounter = 0;
function makeTxn({ date, details, debit, credit, categoryCode, categoryName, confidence, pass, cohort, suggestedGroup, groupConfirmed }) {
  txnCounter++;
  const id = `test-txn-${Date.now()}-${txnCounter}`;
  const amount = debit || credit || 0;
  return {
    id,
    date,
    details,
    debit: debit || null,
    credit: credit || null,
    amount: debit ? -debit : credit,
    balance: null,
    monthYear: date.substring(0, 7),
    fileName: 'February-2026-BOI.pdf',
    type: credit ? 'income' : 'expense',
    isIncome: !!credit,
    categoryCode: categoryCode || null,
    categoryName: categoryName || null,
    unifiedConfidence: confidence || 0,
    convergencePass: pass || 'none',
    convergenceIteration: 1,
    categoryMatchType: 'finn-background',
    stagedCohort: cohort,
    suggestedGroup: suggestedGroup || null,
    groupConfirmed: groupConfirmed || false,
    opusGroupConfidence: suggestedGroup ? (confidence || 0.5) : 0,
    opusReasoning: suggestedGroup ? 'Test data' : null,
  };
}

// --- Auto-cohort transactions (high confidence, bulk-approvable) ---
const autoTransactions = [];

// PCRS payments (identifier match, very common)
for (let i = 0; i < 12; i++) {
  autoTransactions.push(makeTxn({
    date: `2026-02-${String(3 + i).padStart(2, '0')}`,
    details: `PCRS PAYMENT ${1000 + i}`,
    credit: 2450 + Math.floor(Math.random() * 500),
    categoryCode: '1.2', categoryName: 'PCRS Payments',
    confidence: 0.98, pass: 'identifier', cohort: 'auto',
    suggestedGroup: 'INCOME', groupConfirmed: true,
  }));
}

// Card machine payments (identifier match)
for (let i = 0; i < 45; i++) {
  autoTransactions.push(makeTxn({
    date: `2026-02-${String(1 + (i % 28)).padStart(2, '0')}`,
    details: `BOIPA CARD PMT ${200 + i}`,
    credit: 60 + Math.floor(Math.random() * 40),
    categoryCode: '1.1', categoryName: 'Patient Fees',
    confidence: 0.96, pass: 'identifier', cohort: 'auto',
    suggestedGroup: 'INCOME', groupConfirmed: true,
  }));
}

// Utility bills (identifier match)
for (let i = 0; i < 4; i++) {
  autoTransactions.push(makeTxn({
    date: `2026-02-${String(5 + i * 7).padStart(2, '0')}`,
    details: `ELECTRIC IRELAND DD ${900 + i}`,
    credit: null, debit: 285 + Math.floor(Math.random() * 50),
    categoryCode: '4.1', categoryName: 'Electricity',
    confidence: 0.95, pass: 'identifier', cohort: 'auto',
    suggestedGroup: 'PREMISES', groupConfirmed: true,
  }));
}

// Phone bills
for (let i = 0; i < 2; i++) {
  autoTransactions.push(makeTxn({
    date: `2026-02-${String(10 + i * 14).padStart(2, '0')}`,
    details: `THREE IRELAND LTD DD`,
    debit: 89.99,
    categoryCode: '5.2', categoryName: 'Phone & Internet',
    confidence: 0.94, pass: 'identifier', cohort: 'auto',
    suggestedGroup: 'OFFICE', groupConfirmed: true,
  }));
}

// Staff salary (identifier match)
for (let i = 0; i < 8; i++) {
  autoTransactions.push(makeTxn({
    date: `2026-02-28`,
    details: `SALARY TFR STAFF ${['SMITH', 'MURPHY', 'KELLY', 'WALSH', 'BYRNE', 'RYAN', 'OCALLAGHAN', 'DOYLE'][i]}`,
    debit: 2200 + Math.floor(Math.random() * 800),
    categoryCode: '2.3', categoryName: 'Reception Salaries',
    confidence: 0.93, pass: 'identifier', cohort: 'auto',
    suggestedGroup: 'STAFF', groupConfirmed: true,
  }));
}

// Insurance
autoTransactions.push(makeTxn({
  date: '2026-02-15',
  details: 'ZURICH INSURANCE PLC DD',
  debit: 450,
  categoryCode: '4.4', categoryName: 'Insurance',
  confidence: 0.92, pass: 'identifier', cohort: 'auto',
  suggestedGroup: 'PREMISES', groupConfirmed: true,
}));

// --- Group-confirmed cohort (AI assigned group at >=0.85, no category yet) ---
const groupConfirmedTransactions = [];

// IT services — Opus grouped as OFFICE at 0.90
for (let i = 0; i < 3; i++) {
  groupConfirmedTransactions.push(makeTxn({
    date: `2026-02-${String(6 + i * 10).padStart(2, '0')}`,
    details: `CLANWILLIAM HPM SERVICES DD${9000 + i}`,
    debit: 320 + Math.floor(Math.random() * 40),
    confidence: 0.90, pass: 'none', cohort: 'group-confirmed',
    suggestedGroup: 'OFFICE', groupConfirmed: true,
  }));
}

// Locum payments — Opus grouped as STAFF at 0.88
for (let i = 0; i < 2; i++) {
  groupConfirmedTransactions.push(makeTxn({
    date: `2026-02-${String(12 + i * 14).padStart(2, '0')}`,
    details: `DR P CASEY LOCUM TFR${9100 + i}`,
    debit: 1800,
    confidence: 0.88, pass: 'none', cohort: 'group-confirmed',
    suggestedGroup: 'STAFF', groupConfirmed: true,
  }));
}

// --- Review-cohort transactions (lower confidence, need user input) ---
const reviewTransactions = [];

// CLUSTER 1: Medisec (medical indemnity) — 12 members, below threshold
for (let i = 0; i < 12; i++) {
  reviewTransactions.push(makeTxn({
    date: `2026-02-${String(1 + i * 2).padStart(2, '0')}`,
    details: `MEDISEC IRELAND LTD DD REF${3000 + i}`,
    debit: 1575,
    confidence: 0.45, pass: 'none', cohort: 'review',
    suggestedGroup: 'PROFESSIONAL', groupConfirmed: false,
  }));
}

// CLUSTER 2: Johnson Cleaning (premises cleaning) — 8 members
for (let i = 0; i < 8; i++) {
  reviewTransactions.push(makeTxn({
    date: `2026-02-${String(2 + i * 3).padStart(2, '0')}`,
    details: `JOHNSON CLEANING SERVICES TFR${4000 + i}`,
    debit: 375,
    confidence: 0.55, pass: 'none', cohort: 'review',
    suggestedGroup: 'PREMISES', groupConfirmed: false,
  }));
}

// CLUSTER 3: VHI Group (private health insurer payments) — 6 members
for (let i = 0; i < 6; i++) {
  reviewTransactions.push(makeTxn({
    date: `2026-02-${String(3 + i * 4).padStart(2, '0')}`,
    details: `VHI GROUP DAC PMT ${5000 + i}`,
    credit: 320 + Math.floor(Math.random() * 80),
    confidence: 0.60, pass: 'none', cohort: 'review',
    suggestedGroup: 'INCOME', groupConfirmed: false,
  }));
}

// CLUSTER 4: Medical waste — 4 members
for (let i = 0; i < 4; i++) {
  reviewTransactions.push(makeTxn({
    date: `2026-02-${String(5 + i * 7).padStart(2, '0')}`,
    details: `STERIMED WASTE MGMT LTD DD${6000 + i}`,
    debit: 195,
    confidence: 0.50, pass: 'none', cohort: 'review',
    suggestedGroup: 'MEDICAL', groupConfirmed: false,
  }));
}

// CLUSTER 5: Stationery/office supplies — 3 members
for (let i = 0; i < 3; i++) {
  reviewTransactions.push(makeTxn({
    date: `2026-02-${String(8 + i * 9).padStart(2, '0')}`,
    details: `VIKING DIRECT IE ORDER ${7000 + i}`,
    debit: 145 + Math.floor(Math.random() * 60),
    confidence: 0.40, pass: 'none', cohort: 'review',
    suggestedGroup: 'OFFICE', groupConfirmed: false,
  }));
}

// SINGLETONS (1 member each) — 5 one-off transactions
const singletons = [
  { details: 'MCGRATH SOLICITORS TFR 8001', debit: 1200, date: '2026-02-10', group: 'PROFESSIONAL' },
  { details: 'AMAZON.CO.UK PMT 8002', debit: 89.99, date: '2026-02-14', group: 'OFFICE' },
  { details: 'UNKNOWN CREDIT REF 8003', credit: 500, date: '2026-02-18', group: null },
  { details: 'DR M FITZGERALD TFR 8004', credit: 750, date: '2026-02-22', group: 'INCOME' },
  { details: 'APPLE.COM/BILL 8005', debit: 9.99, date: '2026-02-25', group: 'OFFICE' },
];
for (const s of singletons) {
  reviewTransactions.push(makeTxn({
    date: s.date,
    details: s.details,
    debit: s.debit || null,
    credit: s.credit || null,
    confidence: 0.20,
    pass: 'none',
    cohort: 'review',
    suggestedGroup: s.group || null,
    groupConfirmed: false,
  }));
}

// ============================================================================
// Build review clusters (simulating what _buildReviewClusters produces)
// ============================================================================

const reviewClusters = [
  {
    representativeId: reviewTransactions[0].id,
    representativeDescription: 'MEDISEC IRELAND LTD DD REF3000',
    suggestedCategory: 'Medical Indemnity Insurance',
    suggestedCategoryCode: '7.2',
    suggestedConfidence: 0.75,
    suggestedGroup: 'PROFESSIONAL',
    opusGroupConfidence: 0.75,
    opusReasoning: 'Medisec provides medical indemnity insurance for healthcare professionals',
    memberCount: 12,
    totalAmount: -18900,
  },
  {
    representativeId: reviewTransactions[12].id,
    representativeDescription: 'JOHNSON CLEANING SERVICES TFR4000',
    suggestedCategory: 'Cleaning',
    suggestedCategoryCode: '4.6',
    suggestedConfidence: 0.80,
    suggestedGroup: 'PREMISES',
    opusGroupConfidence: 0.80,
    opusReasoning: 'Cleaning services for practice premises',
    memberCount: 8,
    totalAmount: -3000,
  },
  {
    representativeId: reviewTransactions[20].id,
    representativeDescription: 'VHI GROUP DAC PMT 5000',
    suggestedCategory: 'Patient Fees',
    suggestedCategoryCode: '1.1',
    suggestedConfidence: 0.65,
    suggestedGroup: 'INCOME',
    opusGroupConfidence: 0.65,
    opusReasoning: 'VHI is a private health insurer — payments to the practice',
    memberCount: 6,
    totalAmount: 2100,
  },
  {
    representativeId: reviewTransactions[26].id,
    representativeDescription: 'STERIMED WASTE MGMT LTD DD6000',
    suggestedCategory: 'Medical Waste Disposal',
    suggestedCategoryCode: '3.5',
    suggestedConfidence: 0.70,
    suggestedGroup: 'MEDICAL',
    opusGroupConfidence: 0.70,
    opusReasoning: 'Sterimed provides medical waste disposal services',
    memberCount: 4,
    totalAmount: -780,
  },
  {
    representativeId: reviewTransactions[30].id,
    representativeDescription: 'VIKING DIRECT IE ORDER 7000',
    suggestedCategory: null,
    suggestedCategoryCode: null,
    suggestedConfidence: 0,
    suggestedGroup: 'OFFICE',
    opusGroupConfidence: 0.60,
    opusReasoning: 'Viking Direct is an office supplies retailer',
    memberCount: 3,
    totalAmount: -480,
  },
  // Singletons as individual clusters
  ...singletons.map((s, i) => ({
    representativeId: reviewTransactions[33 + i].id,
    representativeDescription: s.details,
    suggestedCategory: null,
    suggestedCategoryCode: null,
    suggestedConfidence: 0,
    suggestedGroup: s.group || null,
    opusGroupConfidence: s.group ? 0.50 : 0,
    opusReasoning: s.group ? 'Low-confidence group suggestion' : null,
    memberCount: 1,
    totalAmount: s.debit ? -s.debit : s.credit,
  })),
];

// ============================================================================
// Build the staged result file
// ============================================================================

const allTransactions = [...autoTransactions, ...groupConfirmedTransactions, ...reviewTransactions];
const totalDebits = allTransactions.reduce((sum, t) => sum + (t.debit || 0), 0);
const totalCredits = allTransactions.reduce((sum, t) => sum + (t.credit || 0), 0);

const stagedResult = {
  id: 'staged-test-review',
  sourceFile: 'February-2026-BOI.pdf',
  processedAt: new Date().toISOString(),

  summary: {
    totalTransactions: allTransactions.length,
    auto: autoTransactions.length,
    groupConfirmed: groupConfirmedTransactions.length,
    review: reviewTransactions.length,
    dateRange: { from: '2026-02-01', to: '2026-02-28' },
    totalDebits: Math.round(totalDebits * 100) / 100,
    totalCredits: Math.round(totalCredits * 100) / 100,
    convergenceIterations: 2,
    passBreakdown: [
      { iteration: 1, passA: 68, passB: 0, passC: 3, passD: 1, total: 72 },
      { iteration: 2, passA: 0, passB: 0, passC: 0, passD: 0, total: 0 },
    ],
    opusPassTriggered: true,
    anomaliesDemoted: 0,
  },

  anomalyWarnings: [],
  reviewClusters,

  transactions: allTransactions,

  duplicates: { count: 0, ids: [] },

  status: 'ready',
  error: null,
};

// Write the file
const outputPath = path.join(stagingPath, `${stagedResult.id}.json`);
fs.writeFileSync(outputPath, JSON.stringify(stagedResult, null, 2));

console.log('');
console.log('=== Test Staged Result Created ===');
console.log('');
console.log(`File:    ${outputPath}`);
console.log(`ID:      ${stagedResult.id}`);
console.log(`Source:  ${stagedResult.sourceFile}`);
console.log('');
console.log(`Total transactions: ${allTransactions.length}`);
console.log(`  Auto (full category):     ${autoTransactions.length}`);
console.log(`  Group-confirmed (AI):     ${groupConfirmedTransactions.length}`);
console.log(`  Review (need user group): ${reviewTransactions.length}`);
console.log('');
console.log(`Review clusters: ${reviewClusters.length}`);
reviewClusters.forEach((c, i) => {
  console.log(`  [${i}] "${c.representativeDescription.substring(0, 35)}..." — ${c.memberCount} members, €${Math.abs(c.totalAmount).toFixed(0)}`);
});
console.log('');
console.log('Next steps:');
console.log('  1. Run: npm run electron-dev');
console.log('  2. Open Finn and ask: "Any staged transactions?" or "Review my transactions"');
console.log('  3. Walk through the review rounds');
console.log('  4. Cleanup: node scripts/test-staged-review.cjs --cleanup');
console.log('');

/**
 * Export Ground Truth Data
 *
 * Reads categorized transactions, category mappings, and practice profile
 * from Electron's localStorage.json and saves them as a test fixture.
 *
 * Usage:
 *   node scripts/export-ground-truth.cjs
 *   node scripts/export-ground-truth.cjs --output test-data/my-snapshot.json
 */

const fs = require('fs');
const path = require('path');

// Electron userData path for this app
const USER_DATA_PATH = path.join(
  process.env.APPDATA || path.join(process.env.HOME, '.config'),
  'slainte-finance-v2'
);
const LOCAL_STORAGE_PATH = path.join(USER_DATA_PATH, 'localStorage.json');

function main() {
  // Parse args
  const args = process.argv.slice(2);
  const outputIdx = args.indexOf('--output');
  const defaultName = `ground-truth-${new Date().toISOString().slice(0, 10)}.json`;
  const outputPath = outputIdx !== -1 && args[outputIdx + 1]
    ? path.resolve(args[outputIdx + 1])
    : path.join(__dirname, '..', 'test-data', defaultName);

  // Read localStorage.json
  if (!fs.existsSync(LOCAL_STORAGE_PATH)) {
    console.error(`[export-ground-truth] localStorage.json not found at ${LOCAL_STORAGE_PATH}`);
    console.error('Make sure the app has been run at least once.');
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(LOCAL_STORAGE_PATH, 'utf8'));

  // Extract transactions
  const transactions = JSON.parse(raw.gp_finance_transactions || '[]');
  const categorized = transactions.filter(t => t.category && t.category !== 'uncategorized');

  if (categorized.length === 0) {
    console.error('[export-ground-truth] No categorized transactions found.');
    process.exit(1);
  }

  // Extract category mapping
  const categoryMapping = JSON.parse(raw.gp_finance_category_mapping || '[]');

  // Extract practice profile (for fee matching context)
  const practiceProfile = JSON.parse(raw.slainte_practice_profile || '{}');

  // Build ground truth object
  const groundTruth = {
    exportedAt: new Date().toISOString(),
    source: 'localStorage.json',
    stats: {
      totalTransactions: transactions.length,
      categorizedTransactions: categorized.length,
      categories: categoryMapping.length,
      categoriesWithIdentifiers: categoryMapping.filter(c => c.identifiers && c.identifiers.length > 0).length,
    },
    // Only keep fields relevant to categorization testing
    transactions: categorized.map(t => ({
      id: t.id,
      date: t.date,
      details: t.details,
      debit: t.debit,
      credit: t.credit,
      amount: t.amount,
      type: t.type,
      isIncome: t.isIncome,
      // Ground truth labels
      category: t.category,
      categoryCode: t.categoryCode,
      categoryName: t.categoryName,
      group: t.group,
      // How it was originally categorized (useful for analysis)
      categoryMatchType: t.categoryMatchType,
      unifiedConfidence: t.unifiedConfidence,
    })),
    categoryMapping,
    practiceProfile: {
      // Only include fields relevant to categorization
      privatePatients: practiceProfile.privatePatients || {},
      gps: practiceProfile.gps ? { count: Array.isArray(practiceProfile.gps) ? practiceProfile.gps.length : 0 } : {},
      staff: practiceProfile.staff || {},
    },
  };

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(groundTruth, null, 2));

  console.log(`[export-ground-truth] Exported ${categorized.length} categorized transactions`);
  console.log(`[export-ground-truth] ${groundTruth.stats.categoriesWithIdentifiers} categories have identifiers`);
  console.log(`[export-ground-truth] Saved to: ${outputPath}`);
}

main();

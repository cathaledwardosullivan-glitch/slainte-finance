/**
 * BOI Bank Statement PDF Parser Test Script v2
 *
 * This script tests the feasibility of parsing Bank of Ireland PDF statements
 * by comparing extracted data against a known-good CSV export.
 *
 * Usage:
 *   node scripts/test-boi-parser.cjs --pdf <path-to-pdf-or-folder> --csv <path-to-csv>
 *
 * Examples:
 *   node scripts/test-boi-parser.cjs --pdf ./statements/jan2025.pdf --csv ./statements/2025.csv
 *   node scripts/test-boi-parser.cjs --pdf ./statements/ --csv ./statements/2025.csv
 *
 * All processing happens locally - no data is sent externally.
 */

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const Papa = require('papaparse');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Fuzzy matching tolerance for amounts (handles rounding differences)
  amountTolerance: 0.01,
  // Days tolerance for date matching (handles timezone/cutoff differences)
  dateTolerance: 1,
  // Show detailed output for each transaction
  verbose: false,
  // Show debug output for parsing
  debug: false,
};

// ============================================================================
// PDF TEXT EXTRACTION
// ============================================================================

async function extractPdfText(pdfPath) {
  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(dataBuffer);

  return {
    text: data.text,
    pages: data.numpages,
    filename: path.basename(pdfPath)
  };
}

// ============================================================================
// BOI PDF PARSER v2 - Handles BOI's specific format
// ============================================================================

function parseBOITransactions(pdfText, debug = false) {
  const transactions = [];
  const lines = pdfText.split('\n').map(line => line.trim()).filter(line => line);

  // BOI-specific date pattern: "DD MMM YYYY" at start of line
  const datePattern = /^(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i;

  // Lines to skip (headers, footers, page breaks, etc.)
  const skipPatterns = [
    /^Bank of Ireland/i,
    /^Registered Information/i,
    /^Tel \(/i,
    /^Fax \(/i,
    /^Branch code/i,
    /^Bank Identifier/i,
    /^COLLEGE GREEN/i,
    /^Your account name/i,
    /^Account number/i,
    /^IBAN/i,
    /^Statement date/i,
    /^Your Current Account/i,
    /^Page \d+ of \d+/i,
    /^DateTransaction details/i,
    /^SUBTOTAL:/i,
    /^All Business Borrowers/i,
    /^to include a review/i,
    /^alternative arrangements/i,
    /^0818 200 372/i,
    /^DR ROBERT/i,
    /^GRIFFITH AVENUE PRACTICE/i,
    /^411 GRIFFITH/i,
    /^GLASNEVIN/i,
    /^DUBLIN \d/i,
    /^ROBERT SCANLON/i,
    /^CATHAL O'SULLIVAN/i,
    /^SINEAD MORGAN/i,
    /^T\/A GRIFFITH/i,
    /^IE\d{2}\s+BOFI/i,  // IBAN
  ];

  let currentDate = null;
  let previousBalance = null;

  for (const line of lines) {
    // Skip header/footer lines
    if (skipPatterns.some(pattern => pattern.test(line))) {
      continue;
    }

    // Skip empty or very short lines
    if (line.length < 5) continue;

    // Check if line starts with a date
    const dateMatch = line.match(datePattern);

    if (dateMatch) {
      currentDate = parseDate(dateMatch[1]);
      // Remove date from line to get the rest
      const remainder = line.substring(dateMatch[0].length).trim();

      if (remainder.length > 0) {
        const tx = parseTransactionLine(remainder, currentDate, previousBalance);
        if (tx) {
          transactions.push(tx);
          if (tx.balance !== null) previousBalance = tx.balance;
        }
      }
    } else if (currentDate) {
      // Continuation line (same date as previous)
      const tx = parseTransactionLine(line, currentDate, previousBalance);
      if (tx) {
        transactions.push(tx);
        if (tx.balance !== null) previousBalance = tx.balance;
      }
    }
  }

  return transactions;
}

function parseTransactionLine(line, date, previousBalance) {
  // Skip "BALANCE FORWARD" lines - these aren't real transactions
  if (/BALANCE FORWARD/i.test(line)) {
    // But extract the balance from it for tracking
    const amounts = line.match(/(\d{1,3}(?:,\d{3})*\.\d{2})/g);
    if (amounts && amounts.length > 0) {
      return {
        date: date,
        description: 'BALANCE FORWARD',
        debit: null,
        credit: null,
        balance: parseAmount(amounts[amounts.length - 1]),
        isBalanceForward: true
      };
    }
    return null;
  }

  // Extract all amounts from the line
  const amountMatches = line.match(/(\d{1,3}(?:,\d{3})*\.\d{2})/g);

  if (!amountMatches || amountMatches.length === 0) {
    return null;
  }

  // Get description by removing amounts
  let description = line;
  for (const amt of amountMatches) {
    description = description.replace(amt, ' ');
  }
  description = description.replace(/\s+/g, ' ').trim();

  // Skip if no meaningful description
  if (description.length < 2) {
    return null;
  }

  // Parse amounts
  const amounts = amountMatches.map(a => parseAmount(a));

  // BOI format analysis:
  // - If 1 amount: this is often just the running balance
  // - If 2 amounts: first is transaction amount, second is balance
  // - The last amount is typically the running balance

  let debit = null;
  let credit = null;
  let balance = null;

  if (amounts.length === 1) {
    // Single amount - likely just balance, but could be a transaction
    // We'll store it and let matching figure it out
    balance = amounts[0];
  } else if (amounts.length === 2) {
    // Two amounts: transaction amount and balance
    const txAmount = amounts[0];
    balance = amounts[1];

    // Determine debit vs credit based on balance change
    if (previousBalance !== null) {
      const diff = balance - previousBalance;
      if (Math.abs(diff - txAmount) < 0.02) {
        // Balance increased by this amount = credit
        credit = txAmount;
      } else if (Math.abs(diff + txAmount) < 0.02) {
        // Balance decreased by this amount = debit
        debit = txAmount;
      } else {
        // Can't determine from balance - store as potential debit or credit
        // We'll mark it and let matching resolve
        debit = txAmount; // Default assumption for business accounts
      }
    } else {
      // No previous balance context
      debit = txAmount;
    }
  } else if (amounts.length >= 3) {
    // Three or more amounts
    // Could be: amount1, amount2, balance
    // Or multiple transactions on same line (rare)
    debit = amounts[0];
    credit = amounts.length > 2 ? amounts[1] : null;
    balance = amounts[amounts.length - 1];
  }

  return {
    date: date,
    description: description,
    debit: debit,
    credit: credit,
    balance: balance,
    rawAmounts: amounts,
    raw: line
  };
}

// ============================================================================
// CSV PARSER
// ============================================================================

function parseCSV(csvPath) {
  console.log(`\n📊 Parsing CSV: ${path.basename(csvPath)}`);

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const result = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  console.log(`   Rows: ${result.data.length}`);
  console.log(`   Columns: ${Object.keys(result.data[0] || {}).join(', ')}`);

  // Normalize CSV data
  const transactions = result.data.map((row, index) => {
    const date = row.Date || row.date || row['Transaction Date'] || row['Value Date'] ||
                 row['Processing Date'] || row.TransactionDate || '';

    const description = row.Details || row.details || row.Description || row.description ||
                       row.Particulars || row.particulars || row.Transaction || row.transaction ||
                       row.Narrative || row.narrative || row.Reference || row.reference || '';

    const debit = row.Debit || row.debit || row['Debit Amount'] || row.DR || row.dr ||
                  row.Out || row.out || row.Withdrawal || row.withdrawal || '';

    const credit = row.Credit || row.credit || row['Credit Amount'] || row.CR || row.cr ||
                   row.In || row.in || row.Deposit || row.deposit || '';

    const balance = row.Balance || row.balance || row['Running Balance'] || row['Closing Balance'] || '';

    return {
      date: parseDate(date),
      description: description.trim(),
      debit: parseAmount(debit),
      credit: parseAmount(credit),
      balance: parseAmount(balance),
      raw: JSON.stringify(row),
      rowIndex: index + 1
    };
  }).filter(t => t.date !== null);

  console.log(`   Valid transactions: ${transactions.length}`);

  return transactions;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function parseDate(dateStr) {
  if (!dateStr) return null;

  const str = dateStr.toString().trim();

  // DD/MM/YYYY
  let match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
  }

  // DD-MM-YYYY
  match = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (match) {
    return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
  }

  // DD MMM YYYY (e.g., "15 Jan 2025") - BOI format
  match = str.match(/^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i);
  if (match) {
    const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    return new Date(parseInt(match[3]), months[match[2].toLowerCase()], parseInt(match[1]));
  }

  // Try native parsing as fallback
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}

function parseAmount(amountStr) {
  if (!amountStr) return null;

  const cleaned = amountStr.toString().replace(/[€£$,\s]/g, '').trim();

  if (!cleaned || cleaned === '') return null;

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function formatDate(date) {
  if (!date) return 'N/A';
  return date.toLocaleDateString('en-IE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatAmount(amount) {
  if (amount === null || amount === undefined) return 'N/A';
  return `€${amount.toFixed(2)}`;
}

// ============================================================================
// IMPROVED COMPARISON ENGINE
// ============================================================================

function compareTransactions(pdfTransactions, csvTransactions) {
  // Filter out balance forward entries from PDF
  const pdfTxFiltered = pdfTransactions.filter(tx => !tx.isBalanceForward);

  // Create a copy of CSV transactions to track what's been matched
  const unmatchedCsv = csvTransactions.map((tx, idx) => ({ ...tx, originalIndex: idx }));

  const results = {
    matched: [],
    pdfOnly: [],
    csvOnly: [],
    stats: {
      perfectMatches: 0,
      goodMatches: 0,
      partialMatches: 0,
    }
  };

  // Sort PDF transactions by date for consistent processing
  const sortedPdf = [...pdfTxFiltered].sort((a, b) => a.date - b.date);

  for (const pdfTx of sortedPdf) {
    let bestMatch = null;
    let bestScore = 0;
    let bestIndex = -1;

    for (let i = 0; i < unmatchedCsv.length; i++) {
      const csvTx = unmatchedCsv[i];
      const score = calculateMatchScore(pdfTx, csvTx);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = csvTx;
        bestIndex = i;
      }
    }

    // Match threshold: need date match plus amount or good description match
    if (bestScore >= 2.5) {
      results.matched.push({
        pdf: pdfTx,
        csv: bestMatch,
        score: bestScore
      });
      unmatchedCsv.splice(bestIndex, 1);

      if (bestScore >= 4.5) results.stats.perfectMatches++;
      else if (bestScore >= 3.5) results.stats.goodMatches++;
      else results.stats.partialMatches++;
    } else {
      results.pdfOnly.push(pdfTx);
    }
  }

  results.csvOnly = unmatchedCsv;

  return results;
}

function calculateMatchScore(pdfTx, csvTx) {
  let score = 0;

  // Date match (required - 2 points)
  if (!datesMatch(pdfTx.date, csvTx.date)) {
    return 0; // No date match = no match
  }
  score += 2;

  // Amount matching - flexible approach
  // PDF might have amount in debit, credit, balance, or rawAmounts
  const pdfAmounts = [];
  if (pdfTx.debit !== null) pdfAmounts.push(pdfTx.debit);
  if (pdfTx.credit !== null) pdfAmounts.push(pdfTx.credit);
  if (pdfTx.balance !== null) pdfAmounts.push(pdfTx.balance);
  if (pdfTx.rawAmounts) {
    for (const amt of pdfTx.rawAmounts) {
      if (!pdfAmounts.includes(amt)) pdfAmounts.push(amt);
    }
  }

  const csvAmount = csvTx.debit || csvTx.credit;

  // Check if any PDF amount matches the CSV transaction amount
  let amountMatched = false;
  for (const pdfAmt of pdfAmounts) {
    if (amountsMatch(pdfAmt, csvAmount)) {
      score += 2; // Strong signal
      amountMatched = true;
      break;
    }
  }

  // Description similarity
  if (pdfTx.description && csvTx.description) {
    const similarity = calculateStringSimilarity(
      normalizeDescription(pdfTx.description),
      normalizeDescription(csvTx.description)
    );
    score += similarity * 1.5; // Up to 1.5 points for description match
  }

  return score;
}

function normalizeDescription(desc) {
  return desc
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
}

function datesMatch(date1, date2) {
  if (!date1 || !date2) return false;

  const diff = Math.abs(date1.getTime() - date2.getTime());
  const daysDiff = diff / (1000 * 60 * 60 * 24);

  return daysDiff <= CONFIG.dateTolerance;
}

function amountsMatch(amount1, amount2) {
  if (amount1 === null && amount2 === null) return true;
  if (amount1 === null || amount2 === null) return false;

  return Math.abs(amount1 - amount2) <= CONFIG.amountTolerance;
}

function calculateStringSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;

  // Check for substring match first (high confidence)
  if (str1.includes(str2) || str2.includes(str1)) {
    return 0.95;
  }

  // Check if first N characters match (common in BOI truncation)
  const minLen = Math.min(str1.length, str2.length);
  if (minLen >= 10) {
    const prefix1 = str1.substring(0, 15);
    const prefix2 = str2.substring(0, 15);
    if (prefix1 === prefix2) {
      return 0.9;
    }
  }

  // Word overlap similarity
  const words1 = new Set(str1.split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(str2.split(/\s+/).filter(w => w.length > 2));

  if (words1.size === 0 || words2.size === 0) return 0;

  let overlap = 0;
  for (const word of words1) {
    if (words2.has(word)) overlap++;
  }

  return overlap / Math.max(words1.size, words2.size);
}

// ============================================================================
// REPORT GENERATOR
// ============================================================================

function generateReport(pdfFiles, csvTransactions, allResults) {
  console.log('\n');
  console.log('═'.repeat(80));
  console.log('                    BOI PDF PARSER ACCURACY REPORT v2');
  console.log('═'.repeat(80));

  // Aggregate results
  let totalPdfTx = 0;
  let totalMatched = 0;
  let totalPdfOnly = 0;
  const allMatchedCsvIndices = new Set();

  for (const result of allResults) {
    const nonBalanceForward = result.pdfTransactions.filter(tx => !tx.isBalanceForward);
    totalPdfTx += nonBalanceForward.length;
    totalMatched += result.comparison.matched.length;
    totalPdfOnly += result.comparison.pdfOnly.length;

    for (const match of result.comparison.matched) {
      allMatchedCsvIndices.add(match.csv.originalIndex);
    }
  }

  const unmatchedCsvCount = csvTransactions.length - allMatchedCsvIndices.size;

  console.log('\n📈 SUMMARY');
  console.log('─'.repeat(40));
  console.log(`   PDF files processed:     ${pdfFiles.length}`);
  console.log(`   CSV transactions:        ${csvTransactions.length}`);
  console.log(`   PDF transactions found:  ${totalPdfTx}`);
  console.log(`   Successfully matched:    ${totalMatched}`);
  console.log(`   PDF-only (unmatched):    ${totalPdfOnly}`);
  console.log(`   CSV-only (unmatched):    ${unmatchedCsvCount}`);

  const extractionRate = csvTransactions.length > 0
    ? ((totalPdfTx / csvTransactions.length) * 100).toFixed(1)
    : 0;

  const matchAccuracy = totalPdfTx > 0
    ? ((totalMatched / totalPdfTx) * 100).toFixed(1)
    : 0;

  const overallAccuracy = csvTransactions.length > 0
    ? ((totalMatched / csvTransactions.length) * 100).toFixed(1)
    : 0;

  console.log('\n📊 ACCURACY METRICS');
  console.log('─'.repeat(40));
  console.log(`   Extraction rate:         ${extractionRate}% (PDF tx found vs CSV total)`);
  console.log(`   Match accuracy:          ${matchAccuracy}% (matched vs PDF tx found)`);
  console.log(`   Overall coverage:        ${overallAccuracy}% (matched vs CSV total)`);

  if (totalMatched > 0) {
    const avgScore = allResults.reduce((sum, r) =>
      sum + r.comparison.matched.reduce((s, m) => s + m.score, 0), 0) / totalMatched;
    console.log(`   Average match score:     ${avgScore.toFixed(2)} / 5.5`);

    const stats = allResults.reduce((acc, r) => {
      acc.perfect += r.comparison.stats.perfectMatches;
      acc.good += r.comparison.stats.goodMatches;
      acc.partial += r.comparison.stats.partialMatches;
      return acc;
    }, { perfect: 0, good: 0, partial: 0 });

    console.log(`\n   Match quality breakdown:`);
    console.log(`     Perfect (date+amount+desc): ${stats.perfect}`);
    console.log(`     Good (date+amount):         ${stats.good}`);
    console.log(`     Partial (date+desc):        ${stats.partial}`);
  }

  // Show sample matches
  if (allResults.some(r => r.comparison.matched.length > 0)) {
    console.log('\n✅ SAMPLE MATCHED TRANSACTIONS (first 10)');
    console.log('─'.repeat(100));

    let shown = 0;
    for (const result of allResults) {
      for (const match of result.comparison.matched) {
        if (shown >= 10) break;

        const pdfAmt = match.pdf.debit || match.pdf.credit ||
                      (match.pdf.rawAmounts && match.pdf.rawAmounts[0]);
        const csvAmt = match.csv.debit || match.csv.credit;

        console.log(`\n   PDF: ${formatDate(match.pdf.date)} | ${match.pdf.description.substring(0, 35).padEnd(35)} | ${formatAmount(pdfAmt).padStart(10)}`);
        console.log(`   CSV: ${formatDate(match.csv.date)} | ${match.csv.description.substring(0, 35).padEnd(35)} | ${formatAmount(csvAmt).padStart(10)}`);
        console.log(`   Score: ${match.score.toFixed(1)}/5.5`);
        shown++;
      }
      if (shown >= 10) break;
    }
  }

  // Show unmatched from CSV (sample)
  if (unmatchedCsvCount > 0) {
    console.log(`\n❌ SAMPLE UNMATCHED CSV TRANSACTIONS (first 10 of ${unmatchedCsvCount})`);
    console.log('─'.repeat(100));

    let shown = 0;
    for (let i = 0; i < csvTransactions.length && shown < 10; i++) {
      if (!allMatchedCsvIndices.has(i)) {
        const tx = csvTransactions[i];
        const amt = tx.debit || tx.credit;
        console.log(`   ${formatDate(tx.date)} | ${tx.description.substring(0, 50).padEnd(50)} | ${formatAmount(amt).padStart(10)}`);
        shown++;
      }
    }
  }

  // Show PDF-only transactions (sample)
  if (totalPdfOnly > 0) {
    console.log(`\n⚠️  SAMPLE PDF-ONLY TRANSACTIONS (first 10 of ${totalPdfOnly})`);
    console.log('─'.repeat(100));

    let shown = 0;
    for (const result of allResults) {
      for (const tx of result.comparison.pdfOnly) {
        if (shown >= 10) break;
        const amt = tx.debit || tx.credit ||
                   (tx.rawAmounts && tx.rawAmounts[0]);
        console.log(`   ${formatDate(tx.date)} | ${tx.description.substring(0, 50).padEnd(50)} | ${formatAmount(amt).padStart(10)}`);
        shown++;
      }
      if (shown >= 10) break;
    }
  }

  console.log('\n');
  console.log('═'.repeat(80));
  console.log('                              END OF REPORT');
  console.log('═'.repeat(80));

  return {
    pdfFiles: pdfFiles.length,
    csvTransactions: csvTransactions.length,
    pdfTransactions: totalPdfTx,
    matched: totalMatched,
    extractionRate: parseFloat(extractionRate),
    matchAccuracy: parseFloat(matchAccuracy),
    overallAccuracy: parseFloat(overallAccuracy)
  };
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('═'.repeat(80));
  console.log('        BOI Bank Statement PDF Parser Test v2');
  console.log('        All processing happens locally - no data sent externally');
  console.log('═'.repeat(80));

  // Parse command line arguments
  const args = process.argv.slice(2);
  let pdfPath = null;
  let csvPath = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--pdf' && args[i + 1]) {
      pdfPath = args[i + 1];
      i++;
    } else if (args[i] === '--csv' && args[i + 1]) {
      csvPath = args[i + 1];
      i++;
    } else if (args[i] === '--verbose' || args[i] === '-v') {
      CONFIG.verbose = true;
    } else if (args[i] === '--debug' || args[i] === '-d') {
      CONFIG.debug = true;
    }
  }

  if (!pdfPath || !csvPath) {
    console.log('\nUsage: node scripts/test-boi-parser.cjs --pdf <path> --csv <path> [--verbose] [--debug]');
    console.log('\nExamples:');
    console.log('  node scripts/test-boi-parser.cjs --pdf ./statements/jan2025.pdf --csv ./statements/2025.csv');
    console.log('  node scripts/test-boi-parser.cjs --pdf ./statements/ --csv ./statements/2025.csv');
    console.log('\nOptions:');
    console.log('  --pdf     Path to PDF file or folder containing PDFs');
    console.log('  --csv     Path to CSV file with transactions');
    console.log('  --verbose Show detailed output');
    console.log('  --debug   Show parsing debug output');
    process.exit(1);
  }

  // Resolve paths
  pdfPath = path.resolve(pdfPath);
  csvPath = path.resolve(csvPath);

  // Check paths exist
  if (!fs.existsSync(pdfPath)) {
    console.error(`\n❌ PDF path not found: ${pdfPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(csvPath)) {
    console.error(`\n❌ CSV path not found: ${csvPath}`);
    process.exit(1);
  }

  // Get list of PDF files
  let pdfFiles = [];
  const pdfStat = fs.statSync(pdfPath);

  if (pdfStat.isDirectory()) {
    pdfFiles = fs.readdirSync(pdfPath)
      .filter(f => f.toLowerCase().endsWith('.pdf'))
      .map(f => path.join(pdfPath, f))
      .sort();
    console.log(`\n📁 Found ${pdfFiles.length} PDF files in folder`);
  } else {
    pdfFiles = [pdfPath];
  }

  if (pdfFiles.length === 0) {
    console.error('\n❌ No PDF files found');
    process.exit(1);
  }

  // Parse CSV (ground truth)
  const csvTransactions = parseCSV(csvPath);

  // Process each PDF
  const allResults = [];

  for (const pdfFile of pdfFiles) {
    try {
      console.log(`\n📄 Processing: ${path.basename(pdfFile)}`);
      const pdfData = await extractPdfText(pdfFile);
      console.log(`   Pages: ${pdfData.pages}, Characters: ${pdfData.text.length}`);

      const pdfTransactions = parseBOITransactions(pdfData.text, CONFIG.debug);
      console.log(`   Transactions extracted: ${pdfTransactions.filter(t => !t.isBalanceForward).length}`);

      const comparison = compareTransactions(pdfTransactions, csvTransactions);
      console.log(`   Matched to CSV: ${comparison.matched.length}`);

      allResults.push({
        filename: pdfData.filename,
        pdfTransactions,
        comparison
      });
    } catch (err) {
      console.error(`\n❌ Error processing ${pdfFile}: ${err.message}`);
      if (CONFIG.debug) {
        console.error(err.stack);
      }
    }
  }

  // Generate report
  generateReport(pdfFiles, csvTransactions, allResults);
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  if (CONFIG.debug) {
    console.error(err.stack);
  }
  process.exit(1);
});

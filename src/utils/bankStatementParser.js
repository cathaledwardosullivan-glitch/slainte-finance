/**
 * Bank Statement PDF Parser
 *
 * Extracts transaction data from bank statement PDFs.
 * Currently supports: Bank of Ireland (BOI), AIB
 * Designed to be extensible for PTSB and other Irish banks.
 */

import { reportError } from './errorReporter';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure PDF.js worker using local file from node_modules
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// ============================================================================
// MAIN EXPORTS
// ============================================================================

/**
 * Parse a bank statement PDF and extract transactions
 * @param {File} file - The PDF file to parse
 * @param {string} bankHint - Optional hint for which bank (auto-detected if not provided)
 * @returns {Promise<{transactions: Array, bank: string, metadata: Object}>}
 */
export async function parseBankStatementPDF(file, bankHint = null) {
  // First extract text for bank detection
  const text = await extractPdfText(file);

  // Debug: Log first 2000 chars of extracted text
  console.log('[BankParser] Extracted text preview (first 2000 chars):', text.substring(0, 2000));
  console.log('[BankParser] Total text length:', text.length);

  const bank = bankHint || detectBank(text);
  console.log('[BankParser] Detected bank:', bank);

  if (!bank) {
    const err = new Error('Could not identify bank format. Currently supported: Bank of Ireland, AIB');
    reportError(err, 'bank-parser');
    throw err;
  }

  // For BOI and AIB, use position-aware parsing
  let result;
  if (bank === 'boi') {
    const linesWithPositions = await extractPdfWithPositions(file);
    result = parseBOIStatementWithPositions(linesWithPositions, text);
  } else if (bank === 'aib') {
    const linesWithPositions = await extractPdfWithPositions(file);
    result = parseAIBStatementWithPositions(linesWithPositions, text);
  } else {
    const parser = BANK_PARSERS[bank];
    if (!parser) {
      const err = new Error(`No parser available for ${bank}. Currently supported: Bank of Ireland, AIB`);
      reportError(err, 'bank-parser');
      throw err;
    }
    result = parser(text);
  }

  console.log('[BankParser] Parser returned:', result.transactions.length, 'transactions');

  return {
    transactions: result.transactions,
    bank: bank,
    metadata: {
      fileName: file.name,
      extractedAt: new Date().toISOString(),
      transactionCount: result.transactions.length,
      dateRange: getDateRange(result.transactions),
      ...result.metadata
    }
  };
}

/**
 * Get list of supported banks
 */
export function getSupportedBanks() {
  return [
    { id: 'boi', name: 'Bank of Ireland', supported: true },
    { id: 'aib', name: 'AIB', supported: true },
    { id: 'ptsb', name: 'Permanent TSB', supported: false },
    { id: 'ulster', name: 'Ulster Bank', supported: false },
  ];
}

// ============================================================================
// PDF TEXT EXTRACTION
// ============================================================================

async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // Sort items by vertical position (y), then horizontal (x)
    // PDF coordinates: y=0 is bottom, so we sort descending for top-to-bottom
    const items = textContent.items
      .filter(item => item.str && item.str.trim())
      .sort((a, b) => {
        // Compare y positions (with tolerance for same-line items)
        const yDiff = b.transform[5] - a.transform[5];
        if (Math.abs(yDiff) > 5) return yDiff; // Different lines
        // Same line - sort by x position (left to right)
        return a.transform[4] - b.transform[4];
      });

    if (items.length === 0) continue;

    let pageLines = [];
    let currentLine = [];
    let lastY = items[0]?.transform[5];

    for (const item of items) {
      const currentY = item.transform[5];

      // If Y position changed significantly, it's a new line
      if (Math.abs(currentY - lastY) > 5) {
        if (currentLine.length > 0) {
          pageLines.push(currentLine.join(' '));
        }
        currentLine = [];
        lastY = currentY;
      }

      currentLine.push(item.str);
    }

    // Don't forget the last line
    if (currentLine.length > 0) {
      pageLines.push(currentLine.join(' '));
    }

    fullText += pageLines.join('\n') + '\n';
  }

  return fullText;
}

/**
 * Extract PDF with position data for column detection
 * Returns structured data with X positions for each text item
 */
async function extractPdfWithPositions(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const allLines = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Get all items with positions
    const items = textContent.items
      .filter(item => item.str && item.str.trim())
      .map(item => ({
        text: item.str.trim(),
        x: item.transform[4],
        y: item.transform[5]
      }))
      .sort((a, b) => {
        const yDiff = b.y - a.y;
        if (Math.abs(yDiff) > 5) return yDiff;
        return a.x - b.x;
      });

    if (items.length === 0) continue;

    // Group items into lines by Y position
    let currentLine = [];
    let lastY = items[0]?.y;

    for (const item of items) {
      if (Math.abs(item.y - lastY) > 5) {
        if (currentLine.length > 0) {
          allLines.push({
            items: currentLine,
            pageNum
          });
        }
        currentLine = [];
        lastY = item.y;
      }
      currentLine.push(item);
    }

    if (currentLine.length > 0) {
      allLines.push({
        items: currentLine,
        pageNum
      });
    }
  }

  return allLines;
}

/**
 * Detect BOI column positions from header row and/or transaction data
 * Returns { paymentsOut: x, paymentsIn: x, balance: x, usePatternFallback: boolean }
 */
function detectBOIColumnPositions(lines) {
  const amountPattern = /^[\d,]+\.\d{2}$/;

  // Strategy 1: Look for header row containing "Payments" column indicators
  for (const line of lines) {
    const lineText = line.items.map(i => i.text).join(' ').toLowerCase();

    // Look for "out" and "in" which appear in the header
    if (lineText.includes('out') && lineText.includes('in')) {
      const outItem = line.items.find(i => i.text.toLowerCase() === 'out');
      const inItem = line.items.find(i => i.text.toLowerCase() === 'in');
      const balanceItem = line.items.find(i => i.text.toLowerCase().includes('balance'));

      if (outItem && inItem) {
        console.log('[BOIParser] Found column headers - Out:', outItem.x, 'In:', inItem.x, 'Balance:', balanceItem?.x);
        const columns = {
          paymentsOut: outItem.x,
          paymentsIn: inItem.x,
          balance: balanceItem?.x || inItem.x + 80,
          usePatternFallback: false
        };
        // Validate spacing
        return validateColumnSpacing(columns);
      }
    }
  }

  // Strategy 2: Analyze amount positions across multiple transaction lines
  // Collect all X positions where amounts appear
  const amountPositions = [];

  for (const line of lines) {
    const amountItems = line.items.filter(i => amountPattern.test(i.text));
    for (const item of amountItems) {
      amountPositions.push(item.x);
    }
  }

  if (amountPositions.length >= 10) {
    // Cluster the positions to find column centers
    // Round to nearest 20 to group similar positions
    const clusters = {};
    amountPositions.forEach(x => {
      const bucket = Math.round(x / 20) * 20;
      clusters[bucket] = (clusters[bucket] || 0) + 1;
    });

    // Get position buckets sorted by X position
    const sortedBuckets = Object.entries(clusters)
      .map(([bucket, count]) => ({ x: parseInt(bucket), count }))
      .sort((a, b) => a.x - b.x);

    console.log('[BOIParser] Amount position clusters:', sortedBuckets);

    // Filter out clusters with very few items (noise) - require at least 5% of total
    const minCount = Math.max(3, Math.floor(amountPositions.length * 0.05));
    const significantClusters = sortedBuckets.filter(c => c.count >= minCount);

    console.log('[BOIParser] Significant clusters (min count', minCount, '):', significantClusters);

    // BOI format: description | payments-out | payments-in | balance
    // Take the 3 rightmost SIGNIFICANT clusters
    if (significantClusters.length >= 3) {
      const rightClusters = significantClusters.slice(-3);
      const columns = {
        paymentsOut: rightClusters[0].x,
        paymentsIn: rightClusters[1].x,
        balance: rightClusters[2].x,
        usePatternFallback: false
      };
      return validateColumnSpacing(columns);
    } else if (significantClusters.length === 2) {
      // Only 2 significant columns - use pattern-based inference for single-amount lines
      console.log('[BOIParser] Only 2 significant clusters - enabling pattern fallback');
      return {
        paymentsOut: significantClusters[0].x,
        paymentsIn: significantClusters[0].x + 60, // Estimate
        balance: significantClusters[1].x,
        usePatternFallback: true // Will use pattern inference for ambiguous cases
      };
    }
  }

  // Strategy 3: Fallback to typical BOI column positions with pattern inference
  console.log('[BOIParser] Using fallback column positions with pattern inference');
  return {
    paymentsOut: 380,
    paymentsIn: 460,
    balance: 540,
    usePatternFallback: true
  };
}

/**
 * Validate that column spacing is reasonable
 * If columns are too close together, enable pattern-based fallback
 */
function validateColumnSpacing(columns) {
  const MIN_COLUMN_SPACING = 50; // Minimum pixels between columns

  const outToIn = Math.abs(columns.paymentsIn - columns.paymentsOut);
  const inToBalance = Math.abs(columns.balance - columns.paymentsIn);

  if (outToIn < MIN_COLUMN_SPACING || inToBalance < MIN_COLUMN_SPACING) {
    console.log('[BOIParser] WARNING: Column spacing too tight (out→in:', outToIn, 'in→balance:', inToBalance, ') - enabling pattern fallback');
    return { ...columns, usePatternFallback: true };
  }

  return columns;
}

/**
 * Determine which column an amount is in based on X position
 * @param {number} x - X position of the amount
 * @param {Object} columns - Column positions { paymentsOut, paymentsIn, balance }
 * @returns {string} 'debit' | 'credit' | 'balance'
 */
function classifyAmountColumn(x, columns) {
  const tolerance = 40; // Allow some variance in position

  // Check if closest to balance column (rightmost)
  if (Math.abs(x - columns.balance) < tolerance) {
    return 'balance';
  }

  // Check if closest to paymentsIn column
  if (Math.abs(x - columns.paymentsIn) < tolerance) {
    return 'credit';
  }

  // Check if closest to paymentsOut column
  if (Math.abs(x - columns.paymentsOut) < tolerance) {
    return 'debit';
  }

  // If between out and in, determine by which is closer
  const distToOut = Math.abs(x - columns.paymentsOut);
  const distToIn = Math.abs(x - columns.paymentsIn);
  const distToBalance = Math.abs(x - columns.balance);

  const minDist = Math.min(distToOut, distToIn, distToBalance);

  if (minDist === distToBalance) return 'balance';
  if (minDist === distToIn) return 'credit';
  return 'debit';
}

// ============================================================================
// BANK DETECTION
// ============================================================================

function detectBank(text) {
  const textLower = text.toLowerCase();

  // AIB detection (check BEFORE BOI — AIB transaction descriptions can contain "Bank of Ireland")
  // PDF extraction sometimes concatenates words: "AlliedIrishBanks" → "alliedIrishbanks"
  if (textLower.includes('allied irish bank') ||
      textLower.includes('alliedirish') ||
      textLower.includes('aib.ie') ||
      textLower.includes('aibkie2d') ||
      /ie\d{2}\s*aibk/i.test(text)) {           // AIBK in IBAN
    return 'aib';
  }

  // Bank of Ireland detection
  if (textLower.includes('bank of ireland') ||
      textLower.includes('bofiie2d') ||
      textLower.includes('90-00-17')) {
    return 'boi';
  }

  // PTSB detection (for future implementation)
  if (textLower.includes('permanent tsb') ||
      textLower.includes('ptsb.ie')) {
    return 'ptsb';
  }

  return null;
}

// ============================================================================
// BANK-SPECIFIC PARSERS
// ============================================================================

const BANK_PARSERS = {
  boi: parseBOIStatement,
  // aib: parseAIBStatement,  // Future
  // ptsb: parsePTSBStatement, // Future
};

/**
 * Bank of Ireland Statement Parser
 */
function parseBOIStatement(pdfText) {
  const transactions = [];
  const lines = pdfText.split('\n').map(line => line.trim()).filter(line => line);

  console.log('[BOIParser] Total lines after split:', lines.length);
  console.log('[BOIParser] First 20 lines:', lines.slice(0, 20));

  // BOI date pattern: "DD MMM YYYY"
  const datePattern = /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i;

  // Lines to skip
  const skipPatterns = [
    /^Bank of Ireland/i,
    /^Registered Information/i,
    /^Tel \(/i,
    /^Fax \(/i,
    /^Branch code/i,
    /^Bank Identifier/i,
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
    /^IE\d{2}\s+BOFI/i,
    /^Current lending rate/i,
    /BALANCE FORWARD/i,
  ];

  let currentDate = null;
  let previousBalance = null;
  let statementDate = null;
  let accountNumber = null;

  // Extract metadata
  for (const line of lines) {
    const stmtDateMatch = line.match(/Statement date\s*(\d{1,2}\s+\w+\s+\d{4})/i);
    if (stmtDateMatch) {
      statementDate = stmtDateMatch[1];
    }
    const acctMatch = line.match(/Account number\s*(\d+)/i);
    if (acctMatch) {
      accountNumber = acctMatch[1];
    }
  }

  // Parse transactions
  for (const line of lines) {
    // Skip header/footer lines
    if (skipPatterns.some(pattern => pattern.test(line))) {
      continue;
    }

    if (line.length < 5) continue;

    // Check if line contains a date
    const dateMatch = line.match(datePattern);

    if (dateMatch) {
      currentDate = parseDate(dateMatch[1]);
      const remainder = line.replace(dateMatch[0], '').trim();

      if (remainder.length > 0) {
        const tx = parseTransactionLine(remainder, currentDate, previousBalance);
        if (tx && !tx.isBalanceForward) {
          transactions.push(tx);
          if (tx.balance !== null) previousBalance = tx.balance;
        } else if (tx && tx.isBalanceForward) {
          previousBalance = tx.balance;
        }
      }
    } else if (currentDate) {
      // Continuation line - same date as previous
      const tx = parseTransactionLine(line, currentDate, previousBalance);
      if (tx && !tx.isBalanceForward) {
        transactions.push(tx);
        if (tx.balance !== null) previousBalance = tx.balance;
      }
    }
  }

  // Debug: Log parsing statistics
  const withDebit = transactions.filter(t => t.debit > 0).length;
  const withCredit = transactions.filter(t => t.credit > 0).length;
  const withZeroAmount = transactions.filter(t => t.amount === 0).length;
  console.log('[BOIParser] Found', transactions.length, 'transactions');
  console.log('[BOIParser] Breakdown: debits:', withDebit, 'credits:', withCredit, 'zero amount:', withZeroAmount);
  console.log('[BOIParser] Statement date:', statementDate, 'Account:', accountNumber);

  // Log first 5 transactions for debugging
  if (transactions.length > 0) {
    console.log('[BOIParser] First 5 transactions:', transactions.slice(0, 5).map(t => ({
      details: t.details.substring(0, 40),
      debit: t.debit,
      credit: t.credit,
      amount: t.amount,
      isIncome: t.isIncome
    })));
  }

  return {
    transactions,
    metadata: {
      statementDate,
      accountNumber,
      bank: 'Bank of Ireland'
    }
  };
}

/**
 * Bank of Ireland Statement Parser - Position-Aware Version
 * Uses X coordinates to determine which column amounts are in
 */
function parseBOIStatementWithPositions(linesWithPositions, fullText) {
  const transactions = [];

  console.log('[BOIParser-Pos] Processing', linesWithPositions.length, 'lines with position data');

  // Detect column positions from header
  const columns = detectBOIColumnPositions(linesWithPositions);
  console.log('[BOIParser-Pos] Detected columns:', columns);

  // BOI date pattern: "DD MMM YYYY"
  const datePattern = /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i;
  const amountPattern = /^[\d,]+\.\d{2}$/;

  // Lines to skip (by text content)
  const skipPatterns = [
    /^Bank of Ireland/i,
    /^Registered Information/i,
    /^Tel \(/i,
    /^Branch code/i,
    /^Your account name/i,
    /^Account number/i,
    /^IBAN/i,
    /^Statement date/i,
    /^Your Current Account/i,
    /^Page \d+ of \d+/i,
    /^DateTransaction/i,
    /^Date\s*Transaction/i,
    /^SUBTOTAL:/i,
    /^All Business Borrowers/i,
    /^0818 200 372/i,
    /^IE\d{2}\s+BOFI/i,
    /BALANCE FORWARD/i,
    /^Payments\s*-?\s*out/i,
    /^Payments\s*-?\s*in/i,
    /^Balance$/i,
  ];

  let currentDate = null;
  let statementDate = null;
  let accountNumber = null;

  // Extract metadata from full text
  const stmtDateMatch = fullText.match(/Statement date\s*(\d{1,2}\s+\w+\s+\d{4})/i);
  if (stmtDateMatch) {
    statementDate = stmtDateMatch[1];
  }
  const acctMatch = fullText.match(/Account number\s*(\d+)/i);
  if (acctMatch) {
    accountNumber = acctMatch[1];
  }

  // Process each line
  for (const line of linesWithPositions) {
    const lineText = line.items.map(i => i.text).join(' ').trim();

    // Skip header/footer lines
    if (skipPatterns.some(pattern => pattern.test(lineText))) {
      continue;
    }

    if (lineText.length < 5) continue;

    // Check for date
    const dateMatch = lineText.match(datePattern);
    if (dateMatch) {
      currentDate = parseDate(dateMatch[1]);
    }

    if (!currentDate) continue;

    // Find amounts in this line with their positions
    const amountItems = line.items.filter(item => amountPattern.test(item.text));

    if (amountItems.length === 0) continue;

    // Get description (non-amount, non-date items)
    const descItems = line.items.filter(item =>
      !amountPattern.test(item.text) &&
      !datePattern.test(item.text)
    );
    const description = descItems.map(i => i.text).join(' ').trim();

    if (description.length < 2) continue;

    // Skip if it's a balance forward line
    if (/BALANCE FORWARD/i.test(description)) {
      continue;
    }

    // Classify each amount by column position
    let debit = null;
    let credit = null;
    let balance = null;

    for (const amountItem of amountItems) {
      const amount = parseAmount(amountItem.text);
      const column = classifyAmountColumn(amountItem.x, columns);

      switch (column) {
        case 'debit':
          debit = amount;
          break;
        case 'credit':
          credit = amount;
          break;
        case 'balance':
          balance = amount;
          break;
      }
    }

    // Pattern-based fallback for single-amount lines when column detection is unreliable
    // This catches cases where all amounts are incorrectly classified as one type
    if (columns.usePatternFallback && amountItems.length === 1 && debit !== null && credit === null) {
      // Double-check using pattern inference - if pattern says income, override
      const patternSaysIncome = inferIsIncome(description);
      if (patternSaysIncome) {
        console.log('[BOIParser-Pos] Pattern override: "', description.substring(0, 30), '" reclassified as CREDIT');
        credit = debit;
        debit = null;
      }
    }

    // Only create transaction if we have a debit or credit
    if (debit !== null || credit !== null) {
      const tx = {
        date: currentDate,
        details: description,
        debit: debit,
        credit: credit,
        balance: balance,
        amount: debit || credit || 0,
        isIncome: credit !== null && credit > 0
      };
      transactions.push(tx);

      // Log first 3 transactions for debugging column detection
      if (transactions.length <= 3) {
        console.log('[BOIParser-Pos] Transaction', transactions.length, ':', {
          details: description.substring(0, 35),
          debit,
          credit,
          balance,
          amountPositions: amountItems.map(a => ({ text: a.text, x: Math.round(a.x) }))
        });
      }
    }
  }

  // Debug output
  const withDebit = transactions.filter(t => t.debit > 0).length;
  const withCredit = transactions.filter(t => t.credit > 0).length;
  const withZeroAmount = transactions.filter(t => t.amount === 0).length;

  console.log('[BOIParser-Pos] Found', transactions.length, 'transactions');
  console.log('[BOIParser-Pos] Breakdown: debits:', withDebit, 'credits:', withCredit, 'zero amount:', withZeroAmount);
  console.log('[BOIParser-Pos] Statement date:', statementDate, 'Account:', accountNumber);

  if (transactions.length > 0) {
    console.log('[BOIParser-Pos] First 5 transactions:', transactions.slice(0, 5).map(t => ({
      details: t.details.substring(0, 40),
      debit: t.debit,
      credit: t.credit,
      amount: t.amount,
      isIncome: t.isIncome
    })));
  }

  return {
    transactions,
    metadata: {
      statementDate,
      accountNumber,
      bank: 'Bank of Ireland'
    }
  };
}

// ============================================================================
// AIB PARSER - Position-Aware
// ============================================================================

/**
 * Merge adjacent text items that together form an amount.
 * AIB PDFs often split amounts with spaces: "6" + ".99" or "40" + ".48"
 * or render them as single items with internal spaces: "6 .99"
 */
function mergeAmountFragments(items) {
  const amountPattern = /^[\d,]+\.\d{2}$/;
  const result = [];
  let i = 0;

  while (i < items.length) {
    // First: check if single item with internal space is an amount (e.g. "6 .99")
    const noSpace = items[i].text.replace(/\s/g, '');
    if (noSpace !== items[i].text && amountPattern.test(noSpace)) {
      result.push({ ...items[i], text: noSpace });
      i++;
      continue;
    }

    // Try merging current + next item (e.g. "40" + ".48")
    if (i + 1 < items.length) {
      const xGap = items[i + 1].x - (items[i].x + (items[i].text.length * 5));
      const merged2 = items[i].text.replace(/\s/g, '') + items[i + 1].text.replace(/\s/g, '');
      if (xGap < 30 && amountPattern.test(merged2)) {
        result.push({ text: merged2, x: items[i].x, y: items[i].y });
        i += 2;
        continue;
      }

      // Try merging 3 items (e.g. "1,234" + "." + "56")
      if (i + 2 < items.length) {
        const merged3 = items[i].text.replace(/\s/g, '') +
                         items[i + 1].text.replace(/\s/g, '') +
                         items[i + 2].text.replace(/\s/g, '');
        if (amountPattern.test(merged3)) {
          result.push({ text: merged3, x: items[i].x, y: items[i].y });
          i += 3;
          continue;
        }
      }
    }

    result.push(items[i]);
    i++;
  }

  return result;
}

/**
 * AIB Statement Parser - Position-Aware Version
 * Uses X coordinates to determine which column amounts are in
 * AIB columns: Date | Details | Debit € | Credit € | Balance €
 */
function parseAIBStatementWithPositions(linesWithPositions, fullText) {
  const transactions = [];

  console.log('[AIBParser-Pos] Processing', linesWithPositions.length, 'lines with position data');

  // Detect column positions from header
  const columns = detectAIBColumnPositions(linesWithPositions);
  console.log('[AIBParser-Pos] Detected columns:', columns);

  // AIB date pattern: "DD MMM YYYY" (same as BOI)
  const datePattern = /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i;
  const amountPattern = /^[\d,]+\.\d{2}$/;

  // Lines to skip (by text content)
  const skipPatterns = [
    /^Allied Irish Banks/i,
    /^Statement of Account/i,
    /^Personal Bank Account/i,
    /^Branch$/i,
    /^National Sort Code/i,
    /^Telephone$/i,
    /^Page Number$/i,
    /^Account Name$/i,
    /^Account Number$/i,
    /^Date of Statement/i,
    /^IBAN:/i,
    /^Authorised Limit/i,
    /^Forward$/i,
    /^DateDetails/i,
    /^Date\s*Details/i,
    /Debit\s*€.*Credit\s*€.*Balance\s*€/i,
    /^Thisisaneligibledeposit/i,
    /^DepositGuaranteeScheme/i,
    /^'DepositGuaranteeScheme/i,
    /^ourwebsite/i,
    /^ForImportantInformation/i,
    /^www\.aib\.ie/i,
    /^Thank you for banking/i,
    /^Overdrawn balances/i,
    /^AlliedIrishBanks/i,
    /^YourAuthorisedLimit/i,
    /^\d{2}-\d{2}-\d{2}$/,        // Sort code on its own line
    /^\d{3,4}$/,                    // Page numbers on their own
    /^Claremorris/i,                // Branch name lines
    /^Co\.?\s+\w+\.?$/i,           // County lines (e.g., "Co. Dublin", "Co Mayo.")
    /BALANCE FORWARD/i,
    /^Interest Rate$/i,
    /^Lending @ /i,
    /^\d+\.\d+ (?:USD|GBP|EUR)@$/i, // FX rate line (e.g., "9.99 USD@")
    /^\d+\.\d{4,}$/,               // FX conversion rate (e.g., "1.162980")
    /^INCL FX FEE/i,               // FX fee line
    /^\d{2}\w{3}\d{2}\s+\d{2}:\d{2}$/i, // Timestamp lines (e.g., "14NOV25 13:39")
    /^TxnDate:/i,                   // Transaction date reference
    /^DUBLIN$/i,                    // Location continuation lines
  ];

  let currentDate = null;
  let statementDate = null;
  let accountNumber = null;
  let sortCode = null;

  // Extract metadata from full text
  const stmtDateMatch = fullText.match(/Date of Statement\s*(\d{1,2}\s+\w+\s+\d{4})/i);
  if (stmtDateMatch) {
    statementDate = stmtDateMatch[1];
  }
  const acctMatch = fullText.match(/Account Number\s*([\d-]+)/i);
  if (acctMatch) {
    accountNumber = acctMatch[1];
  }
  const sortCodeMatch = fullText.match(/National Sort Code\s*([\d-]+)/i);
  if (sortCodeMatch) {
    sortCode = sortCodeMatch[1];
  }

  // Process each line
  for (const line of linesWithPositions) {
    // Merge split amount fragments (AIB PDFs split "40.48" into "40" + ".48")
    const normalizedItems = mergeAmountFragments(line.items);
    const lineText = normalizedItems.map(i => i.text).join(' ').trim();

    // Skip header/footer lines
    if (skipPatterns.some(pattern => pattern.test(lineText))) {
      continue;
    }

    if (lineText.length < 3) continue;

    // Skip lines that are just an address or name (no amounts, no dates)
    // These are part of the page header repeated on each page
    if (/^\d+\s+\w+$/i.test(lineText) && !datePattern.test(lineText) && !amountPattern.test(lineText)) {
      // Could be an address line like "59 WYVERN" - skip if no amounts
      const hasAmount = normalizedItems.some(i => amountPattern.test(i.text));
      if (!hasAmount) continue;
    }

    // Check for date
    const dateMatch = lineText.match(datePattern);
    if (dateMatch) {
      currentDate = parseDate(dateMatch[1]);
    }

    if (!currentDate) continue;

    // Find amounts in this line with their positions
    const amountItems = normalizedItems.filter(item => amountPattern.test(item.text));

    if (amountItems.length === 0) continue;

    // Get description (non-amount, non-date items) from normalized items
    const descItems = normalizedItems.filter(item => {
      // Skip amount items (including merged fragments)
      if (amountPattern.test(item.text)) return false;
      // Skip date components (but only if this line has a date match)
      if (dateMatch) {
        const dateStr = dateMatch[1];
        // Check if this item is part of the date text
        const dateParts = dateStr.split(/\s+/);
        if (dateParts.includes(item.text)) return false;
      }
      return true;
    });
    const description = descItems.map(i => i.text).join(' ').trim();

    // Skip if description is too short or is a known non-transaction
    if (description.length < 2) continue;
    if (/^BALANCE FORWARD/i.test(description)) continue;
    if (/^Interest Rate$/i.test(description)) continue;
    if (/^Lending @/i.test(description)) continue;
    if (/^\d+\.\d+ (?:USD|GBP|EUR)@/i.test(description)) continue;
    if (/^INCL FX FEE/i.test(description)) continue;
    if (/^\d+\.\d{4,}$/.test(description)) continue;

    // Classify amounts using AIB-specific logic
    // AIB columns are very narrow (~57px), so pure position-based classification
    // fails for right-aligned amounts. Use relative positions + pattern inference.
    let debit = null;
    let credit = null;
    let balance = null;

    // Sort amounts left-to-right by x position
    const sortedAmounts = [...amountItems].sort((a, b) => a.x - b.x);

    if (sortedAmounts.length === 1) {
      const amount = parseAmount(sortedAmounts[0].text);
      const x = sortedAmounts[0].x;
      // Single amount: could be debit, credit, or balance-only line
      // Use distance to balance header as a strong signal
      const distToBalance = Math.abs(x - columns.balance);
      const distToDebit = Math.abs(x - columns.paymentsOut);

      if (distToBalance < distToDebit) {
        // Closer to balance column — this is a balance-only line (e.g., running balance)
        balance = amount;
      } else {
        // In the debit/credit region — use pattern inference
        if (inferIsIncome(description)) {
          credit = amount;
        } else {
          debit = amount;
        }
      }
    } else if (sortedAmounts.length === 2) {
      const leftAmount = parseAmount(sortedAmounts[0].text);
      const rightAmount = parseAmount(sortedAmounts[1].text);
      // 2 amounts: rightmost is balance, leftmost is debit or credit
      balance = rightAmount;
      if (inferIsIncome(description)) {
        credit = leftAmount;
      } else {
        debit = leftAmount;
      }
    } else if (sortedAmounts.length >= 3) {
      // 3+ amounts: debit (left), credit (middle), balance (right)
      debit = parseAmount(sortedAmounts[0].text);
      credit = parseAmount(sortedAmounts[1].text);
      balance = parseAmount(sortedAmounts[sortedAmounts.length - 1].text);
    }

    // Only create transaction if we have a debit or credit
    if (debit !== null || credit !== null) {
      const tx = {
        date: currentDate,
        details: description,
        debit: debit,
        credit: credit,
        balance: balance,
        amount: debit || credit || 0,
        isIncome: credit !== null && credit > 0
      };
      transactions.push(tx);

      // Log first 3 transactions for debugging
      if (transactions.length <= 3) {
        console.log('[AIBParser-Pos] Transaction', transactions.length, ':', {
          details: description.substring(0, 35),
          debit,
          credit,
          balance,
          amountPositions: amountItems.map(a => ({ text: a.text, x: Math.round(a.x) }))
        });
      }
    }
  }

  // Debug output
  const withDebit = transactions.filter(t => t.debit > 0).length;
  const withCredit = transactions.filter(t => t.credit > 0).length;
  const withZeroAmount = transactions.filter(t => t.amount === 0).length;

  console.log('[AIBParser-Pos] Found', transactions.length, 'transactions');
  console.log('[AIBParser-Pos] Breakdown: debits:', withDebit, 'credits:', withCredit, 'zero amount:', withZeroAmount);
  console.log('[AIBParser-Pos] Statement date:', statementDate, 'Account:', accountNumber, 'Sort Code:', sortCode);

  if (transactions.length > 0) {
    console.log('[AIBParser-Pos] First 5 transactions:', transactions.slice(0, 5).map(t => ({
      details: t.details.substring(0, 40),
      debit: t.debit,
      credit: t.credit,
      amount: t.amount,
      isIncome: t.isIncome
    })));
  }

  return {
    transactions,
    metadata: {
      statementDate,
      accountNumber,
      sortCode,
      bank: 'AIB'
    }
  };
}

/**
 * Detect AIB column positions from header row and/or transaction data
 * AIB format: Date | Details | Debit € | Credit € | Balance €
 * Returns { paymentsOut: x, paymentsIn: x, balance: x, usePatternFallback: boolean }
 */
function detectAIBColumnPositions(lines) {
  const amountPattern = /^[\d,]+\.\d{2}$/;

  // Strategy 1: Look for header row containing "Debit" + "Credit" + "Balance" column indicators
  for (const line of lines) {
    const lineText = line.items.map(i => i.text).join(' ').toLowerCase();

    // AIB header: "Date Details Debit € Credit € Balance €"
    if (lineText.includes('debit') && lineText.includes('credit') && lineText.includes('balance')) {
      const debitItem = line.items.find(i => /debit/i.test(i.text));
      const creditItem = line.items.find(i => /credit/i.test(i.text));
      const balanceItem = line.items.find(i => /balance/i.test(i.text));

      if (debitItem && creditItem && balanceItem) {
        console.log('[AIBParser] Found column headers - Debit:', debitItem.x, 'Credit:', creditItem.x, 'Balance:', balanceItem.x);
        const columns = {
          paymentsOut: debitItem.x,
          paymentsIn: creditItem.x,
          balance: balanceItem.x,
          usePatternFallback: false
        };
        return validateColumnSpacing(columns);
      }
    }
  }

  // Strategy 2: Analyze amount positions across multiple transaction lines
  // Use merged fragments since AIB splits amounts (e.g. "40" + ".48")
  const amountPositions = [];

  for (const line of lines) {
    const normalizedItems = mergeAmountFragments(line.items);
    const amountItems = normalizedItems.filter(i => amountPattern.test(i.text));
    for (const item of amountItems) {
      amountPositions.push(item.x);
    }
  }

  if (amountPositions.length >= 10) {
    const clusters = {};
    amountPositions.forEach(x => {
      const bucket = Math.round(x / 20) * 20;
      clusters[bucket] = (clusters[bucket] || 0) + 1;
    });

    const sortedBuckets = Object.entries(clusters)
      .map(([bucket, count]) => ({ x: parseInt(bucket), count }))
      .sort((a, b) => a.x - b.x);

    console.log('[AIBParser] Amount position clusters:', sortedBuckets);

    const minCount = Math.max(3, Math.floor(amountPositions.length * 0.05));
    const significantClusters = sortedBuckets.filter(c => c.count >= minCount);

    console.log('[AIBParser] Significant clusters (min count', minCount, '):', significantClusters);

    if (significantClusters.length >= 3) {
      const rightClusters = significantClusters.slice(-3);
      const columns = {
        paymentsOut: rightClusters[0].x,
        paymentsIn: rightClusters[1].x,
        balance: rightClusters[2].x,
        usePatternFallback: false
      };
      return validateColumnSpacing(columns);
    } else if (significantClusters.length === 2) {
      console.log('[AIBParser] Only 2 significant clusters - enabling pattern fallback');
      return {
        paymentsOut: significantClusters[0].x,
        paymentsIn: significantClusters[0].x + 60,
        balance: significantClusters[1].x,
        usePatternFallback: true
      };
    }
  }

  // Strategy 3: Fallback with pattern inference
  console.log('[AIBParser] Using fallback column positions with pattern inference');
  return {
    paymentsOut: 350,
    paymentsIn: 430,
    balance: 510,
    usePatternFallback: true
  };
}

/**
 * Infer if a transaction is income based on description patterns
 * Used as fallback when position-based detection isn't available
 */
function inferIsIncome(description) {
  const descUpper = description.toUpperCase();

  // Income patterns (credits to account)
  const incomePatterns = [
    /\sSP$/,               // Ends with " SP" (Standing Payment received - BOI)
    /\bSP\b/,              // Standing Payment in the middle
    /^BOIPA/,              // Bank of Ireland Acquiring - card payments received
    /^BILLINK/,            // Billing Link - payments received
    /\bCREDIT\b/,          // Explicit credit
    /\bTFR FROM\b/,        // Transfer from (incoming)
    /\bFROM\s+\d/,         // From account number
    /\bSALARY\b/,          // Salary payment
    /\bWAGES?\b/,          // Wages
    /\bGMS\b/,             // GMS payment (GP income)
    /\bPCRS\b/,            // PCRS payment (GP income)
    /\bHSE\b/,             // HSE payment
    /\bVHI\b/,             // VHI payment (health insurance)
    /\bREFUND\b/,          // Refund
    /\bREIMBURSE/,         // Reimbursement
    /\bINT\s*PD\b/,        // Interest paid (to account)
    /CR$/,                 // Ends with CR (credit indicator)
    /^V\d{10,}P\d/,        // AIB V-reference credits (e.g., V435058430060126P2)
    /^XFR:/,               // AIB internal transfers
  ];

  // Expense patterns (debits from account)
  const expensePatterns = [
    /\bSEPA DD\b/,         // SEPA Direct Debit
    /\bDD\s+\d/,           // Direct Debit with reference
    /\bPOS\b/,             // Point of Sale
    /\bTO\s+\d/,           // Transfer to account number
    /\bTFR TO\b/,          // Transfer to
    /\bDEBIT\b/,           // Explicit debit
    /\bCHQ\b/,             // Cheque
    /\bCHEQUE\b/,          // Cheque spelled out
    /\bATM\b/,             // ATM withdrawal
    /\bW\/D\b/,            // Withdrawal
    /\bFEE\b/,             // Fee
    /\bCHARGE\b/,          // Charge
    /\bBILL\b/,            // Bill payment
    /\bPAYMENT\b/,         // Payment (usually out)
    /\bD\/D\b/,            // Direct Debit alternative format
    /\bS\/O\b/,            // Standing Order (usually out)
  ];

  // Check for income patterns
  for (const pattern of incomePatterns) {
    if (pattern.test(descUpper)) {
      return true;
    }
  }

  // Check for expense patterns
  for (const pattern of expensePatterns) {
    if (pattern.test(descUpper)) {
      return false;
    }
  }

  // Default to expense (more common for business accounts)
  return false;
}

function parseTransactionLine(line, date, previousBalance) {
  // Skip balance forward lines
  if (/BALANCE FORWARD/i.test(line)) {
    const amounts = line.match(/(\d{1,3}(?:,\d{3})*\.\d{2})/g);
    if (amounts && amounts.length > 0) {
      return {
        isBalanceForward: true,
        balance: parseAmount(amounts[amounts.length - 1])
      };
    }
    return null;
  }

  // Extract amounts
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

  if (description.length < 2) {
    return null;
  }

  const amounts = amountMatches.map(a => parseAmount(a));

  let debit = null;
  let credit = null;
  let balance = null;

  if (amounts.length === 1) {
    // Single amount - infer debit/credit from description patterns
    const txAmount = amounts[0];
    const isIncome = inferIsIncome(description);

    console.log('[BOIParser] Single amount line - inferred as', isIncome ? 'INCOME' : 'EXPENSE', ':', description.substring(0, 40), '=', txAmount);

    if (isIncome) {
      credit = txAmount;
    } else {
      debit = txAmount;
    }
    // Note: balance will be null for single-amount lines
  } else if (amounts.length === 2) {
    const txAmount = amounts[0];
    balance = amounts[1];

    if (previousBalance !== null) {
      const diff = balance - previousBalance;
      if (Math.abs(diff - txAmount) < 0.02) {
        credit = txAmount;
      } else if (Math.abs(diff + txAmount) < 0.02) {
        debit = txAmount;
      } else {
        // Can't determine from balance, use pattern inference
        const isIncome = inferIsIncome(description);
        if (isIncome) {
          credit = txAmount;
        } else {
          debit = txAmount;
        }
      }
    } else {
      // No previous balance to compare, use pattern inference
      const isIncome = inferIsIncome(description);
      if (isIncome) {
        credit = txAmount;
      } else {
        debit = txAmount;
      }
    }
  } else if (amounts.length >= 3) {
    debit = amounts[0];
    credit = amounts.length > 2 ? amounts[1] : null;
    balance = amounts[amounts.length - 1];
  }

  return {
    date: date,
    details: description,
    debit: debit,
    credit: credit,
    balance: balance,
    amount: debit || credit || 0,
    isIncome: credit !== null && credit > 0
  };
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

  // DD MMM YYYY (BOI format)
  match = str.match(/^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i);
  if (match) {
    const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    return new Date(parseInt(match[3]), months[match[2].toLowerCase()], parseInt(match[1]));
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

function getDateRange(transactions) {
  if (!transactions || transactions.length === 0) return null;

  const dates = transactions
    .filter(t => t.date)
    .map(t => new Date(t.date).getTime());

  if (dates.length === 0) return null;

  return {
    from: new Date(Math.min(...dates)).toISOString().split('T')[0],
    to: new Date(Math.max(...dates)).toISOString().split('T')[0]
  };
}

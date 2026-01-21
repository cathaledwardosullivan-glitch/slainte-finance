/**
 * Bank Statement PDF Parser
 *
 * Extracts transaction data from bank statement PDFs.
 * Currently supports: Bank of Ireland (BOI)
 * Designed to be extensible for AIB, PTSB, and other Irish banks.
 */

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
  const text = await extractPdfText(file);
  const bank = bankHint || detectBank(text);

  if (!bank) {
    throw new Error('Could not identify bank format. Currently supported: Bank of Ireland');
  }

  const parser = BANK_PARSERS[bank];
  if (!parser) {
    throw new Error(`No parser available for ${bank}. Currently supported: Bank of Ireland`);
  }

  const result = parser(text);

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
    { id: 'aib', name: 'AIB', supported: false },
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
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}

// ============================================================================
// BANK DETECTION
// ============================================================================

function detectBank(text) {
  const textLower = text.toLowerCase();

  // Bank of Ireland detection
  if (textLower.includes('bank of ireland') ||
      textLower.includes('bofiie2d') ||
      textLower.includes('90-00-17')) {
    return 'boi';
  }

  // AIB detection (for future implementation)
  if (textLower.includes('allied irish bank') ||
      textLower.includes('aib.ie')) {
    return 'aib';
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

  return {
    transactions,
    metadata: {
      statementDate,
      accountNumber,
      bank: 'Bank of Ireland'
    }
  };
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
    balance = amounts[0];
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
        debit = txAmount;
      }
    } else {
      debit = txAmount;
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

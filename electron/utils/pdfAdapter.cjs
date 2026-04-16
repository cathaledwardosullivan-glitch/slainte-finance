/**
 * Node.js PDF Adapter for Bank Statement Parsing
 *
 * Replaces the browser-side PDF extraction (File API + pdfjs-dist worker)
 * with filesystem-based extraction (fs.readFileSync + pdfjs-dist legacy build).
 *
 * Uses the same pure parsing functions (via categorizationBundle.cjs) as the
 * browser-side parser — identical parsing logic, different PDF extraction layer.
 */

const fs = require('fs');
const path = require('path');

// Lazy-load pdfjs-dist to avoid DOMMatrix crash in Electron main process.
// pdfjs-dist v5.x legacy build references DOMMatrix which doesn't exist in
// Node.js / Electron main process context. Loading lazily ensures it's only
// evaluated when actually parsing a PDF (in an async context).
let _pdfjsLib = null;
let _standardFontDataUrl = null;

function getPdfjsLib() {
  if (!_pdfjsLib) {
    _pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');
    _standardFontDataUrl = path.join(
      path.dirname(require.resolve('pdfjs-dist/package.json')),
      'standard_fonts'
    ).replace(/\\/g, '/') + '/';
  }
  return { pdfjsLib: _pdfjsLib, STANDARD_FONT_DATA_URL: _standardFontDataUrl };
}

// Pure parsing functions from the bundled engine
const {
  detectBank,
  parseBankStatement,
  getDateRange,
} = require('./categorizationBundle.cjs');

// ============================================================================
// PDF TEXT EXTRACTION (Node.js — uses fs.readFileSync instead of File API)
// ============================================================================

/**
 * Extract all text from a PDF file, grouped into lines by Y position.
 * Equivalent to the browser-side extractPdfText() in bankStatementParser.js.
 *
 * @param {Buffer|Uint8Array} data - PDF file contents
 * @returns {Promise<string>} Full text content with lines separated by \n
 */
async function extractPdfText(data) {
  const { pdfjsLib, STANDARD_FONT_DATA_URL } = getPdfjsLib();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(data), standardFontDataUrl: STANDARD_FONT_DATA_URL }).promise;

  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    const items = textContent.items
      .filter(item => item.str && item.str.trim())
      .sort((a, b) => {
        const yDiff = b.transform[5] - a.transform[5];
        if (Math.abs(yDiff) > 5) return yDiff;
        return a.transform[4] - b.transform[4];
      });

    if (items.length === 0) continue;

    let pageLines = [];
    let currentLine = [];
    let lastY = items[0]?.transform[5];

    for (const item of items) {
      const currentY = item.transform[5];

      if (Math.abs(currentY - lastY) > 5) {
        if (currentLine.length > 0) {
          pageLines.push(currentLine.join(' '));
        }
        currentLine = [];
        lastY = currentY;
      }

      currentLine.push(item.str);
    }

    if (currentLine.length > 0) {
      pageLines.push(currentLine.join(' '));
    }

    fullText += pageLines.join('\n') + '\n';
  }

  return fullText;
}

/**
 * Extract PDF text with position data for column-aware parsing.
 * Equivalent to the browser-side extractPdfWithPositions() in bankStatementParser.js.
 *
 * @param {Buffer|Uint8Array} data - PDF file contents
 * @returns {Promise<Array<{items: Array<{text, x, y}>, pageNum: number}>>}
 */
async function extractPdfWithPositions(data) {
  const { pdfjsLib, STANDARD_FONT_DATA_URL } = getPdfjsLib();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(data), standardFontDataUrl: STANDARD_FONT_DATA_URL }).promise;

  const allLines = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

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

    let currentLine = [];
    let lastY = items[0]?.y;

    for (const item of items) {
      if (Math.abs(item.y - lastY) > 5) {
        if (currentLine.length > 0) {
          allLines.push({ items: currentLine, pageNum });
        }
        currentLine = [];
        lastY = item.y;
      }
      currentLine.push(item);
    }

    if (currentLine.length > 0) {
      allLines.push({ items: currentLine, pageNum });
    }
  }

  return allLines;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Parse a bank statement PDF from a file path.
 *
 * @param {string} filePath - Absolute path to the PDF file
 * @param {string} [bankHint] - Optional bank identifier ('boi', 'aib')
 * @returns {Promise<{transactions: Array, bank: string, metadata: Object}>}
 */
async function parsePdfStatement(filePath, bankHint = null) {
  const data = fs.readFileSync(filePath);

  // Extract text for bank detection
  const fullText = await extractPdfText(data);
  const bank = bankHint || detectBank(fullText);

  if (!bank) {
    throw new Error(`Could not identify bank format in ${path.basename(filePath)}. Supported: Bank of Ireland, AIB`);
  }

  // Extract position data for column-aware parsing
  const linesWithPositions = await extractPdfWithPositions(data);

  // Delegate to pure parsing functions (same as browser path)
  const result = parseBankStatement(bank, fullText, linesWithPositions);

  return {
    transactions: result.transactions,
    bank,
    metadata: {
      fileName: path.basename(filePath),
      filePath,
      extractedAt: new Date().toISOString(),
      transactionCount: result.transactions.length,
      dateRange: getDateRange(result.transactions),
      ...result.metadata
    }
  };
}

/**
 * Parse a CSV bank statement from a file path.
 * Uses the bundled processTransactionData from the engine.
 *
 * @param {string} filePath - Absolute path to the CSV file
 * @returns {{ transactions: Array, metadata: Object }}
 */
function parseCsvStatement(filePath) {
  const { processTransactionData } = require('./categorizationBundle.cjs');
  const csvContent = fs.readFileSync(filePath, 'utf8');

  // processTransactionData expects an array of raw transaction objects
  // CSV parsing produces raw objects — we need to parse the CSV first
  const lines = csvContent.split('\n').filter(l => l.trim());
  if (lines.length < 2) {
    throw new Error(`CSV file ${path.basename(filePath)} is empty or has no data rows`);
  }

  // Parse CSV header and rows
  const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
  const rawTransactions = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < headers.length) continue;

    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx];
    });
    rawTransactions.push(row);
  }

  return {
    transactions: processTransactionData(rawTransactions),
    metadata: {
      fileName: path.basename(filePath),
      filePath,
      extractedAt: new Date().toISOString(),
      transactionCount: rawTransactions.length,
    }
  };
}

/**
 * Parse a single CSV line, handling quoted fields with commas.
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^["']|["']$/g, ''));

  return result;
}

/**
 * Parse a bank statement file (PDF or CSV) based on extension.
 *
 * @param {string} filePath - Absolute path to the file
 * @param {string} [bankHint] - Optional bank identifier for PDFs
 * @returns {Promise<{transactions: Array, bank: string|null, metadata: Object}>}
 */
async function parseStatement(filePath, bankHint = null) {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.pdf':
      return parsePdfStatement(filePath, bankHint);
    case '.csv':
      return { ...parseCsvStatement(filePath), bank: null };
    default:
      throw new Error(`Unsupported file type: ${ext}. Supported: .pdf, .csv`);
  }
}

module.exports = {
  parseStatement,
  parsePdfStatement,
  parseCsvStatement,
  extractPdfText,
  extractPdfWithPositions,
};

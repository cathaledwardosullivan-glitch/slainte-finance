/**
 * Bank Statement PDF Parser — Browser Entry Point
 *
 * Handles PDF text extraction via pdfjs-dist (browser worker).
 * All pure parsing logic lives in bankStatementParsers.js (bundled for Node.js too).
 */

import { reportError } from './errorReporter';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  detectBank,
  getSupportedBanks as _getSupportedBanks,
  parseBankStatement,
  getDateRange,
} from './bankStatementParsers';

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

  console.log('[BankParser] Extracted text preview (first 2000 chars):', text.substring(0, 2000));
  console.log('[BankParser] Total text length:', text.length);

  const bank = bankHint || detectBank(text);
  console.log('[BankParser] Detected bank:', bank);

  if (!bank) {
    const err = new Error('Could not identify bank format. Currently supported: Bank of Ireland, AIB');
    reportError(err, 'bank-parser');
    throw err;
  }

  // Extract position data for position-aware parsers
  const linesWithPositions = await extractPdfWithPositions(file);

  // Delegate to pure parsing functions
  let result;
  try {
    result = parseBankStatement(bank, text, linesWithPositions);
  } catch (err) {
    reportError(err, 'bank-parser');
    throw err;
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
  return _getSupportedBanks();
}

// ============================================================================
// PDF TEXT EXTRACTION (Browser-only — uses File API + pdfjs-dist worker)
// ============================================================================

async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

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

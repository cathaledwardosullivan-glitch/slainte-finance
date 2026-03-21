/**
 * Pure Bank Statement Parsing Functions
 *
 * All bank-specific parsing logic lives here — no PDF.js dependency, no browser APIs.
 * These functions operate on already-extracted text and position data.
 *
 * This file is bundled into electron/utils/categorizationBundle.cjs for use
 * by the Node.js PDF adapter in the Electron main process.
 *
 * The browser entry point (bankStatementParser.js) imports from here.
 */

// ============================================================================
// BANK DETECTION
// ============================================================================

export function detectBank(text) {
  const textLower = text.toLowerCase();

  // AIB detection (check BEFORE BOI — AIB transaction descriptions can contain "Bank of Ireland")
  if (textLower.includes('allied irish bank') ||
      textLower.includes('alliedirish') ||
      textLower.includes('aib.ie') ||
      textLower.includes('aibkie2d') ||
      /ie\d{2}\s*aibk/i.test(text)) {
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

export function getSupportedBanks() {
  return [
    { id: 'boi', name: 'Bank of Ireland', supported: true },
    { id: 'aib', name: 'AIB', supported: true },
    { id: 'ptsb', name: 'Permanent TSB', supported: false },
    { id: 'ulster', name: 'Ulster Bank', supported: false },
  ];
}

// ============================================================================
// COLUMN DETECTION
// ============================================================================

export function detectBOIColumnPositions(lines) {
  const amountPattern = /^[\d,]+\.\d{2}$/;

  // Strategy 1: Look for header row containing "Payments" column indicators
  for (const line of lines) {
    const lineText = line.items.map(i => i.text).join(' ').toLowerCase();

    if (lineText.includes('out') && lineText.includes('in')) {
      const outItem = line.items.find(i => i.text.toLowerCase() === 'out');
      const inItem = line.items.find(i => i.text.toLowerCase() === 'in');
      const balanceItem = line.items.find(i => i.text.toLowerCase().includes('balance'));

      if (outItem && inItem) {
        const columns = {
          paymentsOut: outItem.x,
          paymentsIn: inItem.x,
          balance: balanceItem?.x || inItem.x + 80,
          usePatternFallback: false
        };
        return validateColumnSpacing(columns);
      }
    }
  }

  // Strategy 2: Analyze amount positions across multiple transaction lines
  const amountPositions = [];

  for (const line of lines) {
    const amountItems = line.items.filter(i => amountPattern.test(i.text));
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

    const minCount = Math.max(3, Math.floor(amountPositions.length * 0.05));
    const significantClusters = sortedBuckets.filter(c => c.count >= minCount);

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
      return {
        paymentsOut: significantClusters[0].x,
        paymentsIn: significantClusters[0].x + 60,
        balance: significantClusters[1].x,
        usePatternFallback: true
      };
    }
  }

  // Strategy 3: Fallback
  return {
    paymentsOut: 380,
    paymentsIn: 460,
    balance: 540,
    usePatternFallback: true
  };
}

export function validateColumnSpacing(columns) {
  const MIN_COLUMN_SPACING = 50;

  const outToIn = Math.abs(columns.paymentsIn - columns.paymentsOut);
  const inToBalance = Math.abs(columns.balance - columns.paymentsIn);

  if (outToIn < MIN_COLUMN_SPACING || inToBalance < MIN_COLUMN_SPACING) {
    return { ...columns, usePatternFallback: true };
  }

  return columns;
}

export function classifyAmountColumn(x, columns) {
  const tolerance = 40;

  if (Math.abs(x - columns.balance) < tolerance) return 'balance';
  if (Math.abs(x - columns.paymentsIn) < tolerance) return 'credit';
  if (Math.abs(x - columns.paymentsOut) < tolerance) return 'debit';

  const distToOut = Math.abs(x - columns.paymentsOut);
  const distToIn = Math.abs(x - columns.paymentsIn);
  const distToBalance = Math.abs(x - columns.balance);

  const minDist = Math.min(distToOut, distToIn, distToBalance);

  if (minDist === distToBalance) return 'balance';
  if (minDist === distToIn) return 'credit';
  return 'debit';
}

export function detectAIBColumnPositions(lines) {
  const amountPattern = /^[\d,]+\.\d{2}$/;

  // Strategy 1: Look for header row
  for (const line of lines) {
    const lineText = line.items.map(i => i.text).join(' ').toLowerCase();

    if (lineText.includes('debit') && lineText.includes('credit') && lineText.includes('balance')) {
      const debitItem = line.items.find(i => /debit/i.test(i.text));
      const creditItem = line.items.find(i => /credit/i.test(i.text));
      const balanceItem = line.items.find(i => /balance/i.test(i.text));

      if (debitItem && creditItem && balanceItem) {
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

  // Strategy 2: Analyze amount positions
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

    const minCount = Math.max(3, Math.floor(amountPositions.length * 0.05));
    const significantClusters = sortedBuckets.filter(c => c.count >= minCount);

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
      return {
        paymentsOut: significantClusters[0].x,
        paymentsIn: significantClusters[0].x + 60,
        balance: significantClusters[1].x,
        usePatternFallback: true
      };
    }
  }

  // Strategy 3: Fallback
  return {
    paymentsOut: 350,
    paymentsIn: 430,
    balance: 510,
    usePatternFallback: true
  };
}

// ============================================================================
// AMOUNT FRAGMENT MERGING (AIB)
// ============================================================================

export function mergeAmountFragments(items) {
  const amountPattern = /^[\d,]+\.\d{2}$/;
  const result = [];
  let i = 0;

  while (i < items.length) {
    const noSpace = items[i].text.replace(/\s/g, '');
    if (noSpace !== items[i].text && amountPattern.test(noSpace)) {
      result.push({ ...items[i], text: noSpace });
      i++;
      continue;
    }

    if (i + 1 < items.length) {
      const xGap = items[i + 1].x - (items[i].x + (items[i].text.length * 5));
      const merged2 = items[i].text.replace(/\s/g, '') + items[i + 1].text.replace(/\s/g, '');
      if (xGap < 30 && amountPattern.test(merged2)) {
        result.push({ text: merged2, x: items[i].x, y: items[i].y });
        i += 2;
        continue;
      }

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

// ============================================================================
// PATTERN INFERENCE
// ============================================================================

export function inferIsIncome(description) {
  const descUpper = description.toUpperCase();

  const incomePatterns = [
    /\sSP$/,
    /\bSP\b/,
    /^BOIPA/,
    /^BILLINK/,
    /\bCREDIT\b/,
    /\bTFR FROM\b/,
    /\bFROM\s+\d/,
    /\bSALARY\b/,
    /\bWAGES?\b/,
    /\bGMS\b/,
    /\bPCRS\b/,
    /\bHSE\b/,
    /\bVHI\b/,
    /\bREFUND\b/,
    /\bREIMBURSE/,
    /\bINT\s*PD\b/,
    /CR$/,
    /^V\d{10,}P\d/,
    /^XFR:/,
  ];

  const expensePatterns = [
    /\bSEPA DD\b/,
    /\bDD\s+\d/,
    /\bPOS\b/,
    /\bTO\s+\d/,
    /\bTFR TO\b/,
    /\bDEBIT\b/,
    /\bCHQ\b/,
    /\bCHEQUE\b/,
    /\bATM\b/,
    /\bW\/D\b/,
    /\bFEE\b/,
    /\bCHARGE\b/,
    /\bBILL\b/,
    /\bPAYMENT\b/,
    /\bD\/D\b/,
    /\bS\/O\b/,
  ];

  for (const pattern of incomePatterns) {
    if (pattern.test(descUpper)) return true;
  }

  for (const pattern of expensePatterns) {
    if (pattern.test(descUpper)) return false;
  }

  return false;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function parseDate(dateStr) {
  if (!dateStr) return null;

  const str = dateStr.toString().trim();

  let match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
  }

  match = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (match) {
    return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
  }

  match = str.match(/^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i);
  if (match) {
    const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    return new Date(parseInt(match[3]), months[match[2].toLowerCase()], parseInt(match[1]));
  }

  return null;
}

export function parseAmount(amountStr) {
  if (!amountStr) return null;

  const cleaned = amountStr.toString().replace(/[€£$,\s]/g, '').trim();
  if (!cleaned || cleaned === '') return null;

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export function getDateRange(transactions) {
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

export function parseTransactionLine(line, date, previousBalance) {
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

  const amountMatches = line.match(/(\d{1,3}(?:,\d{3})*\.\d{2})/g);

  if (!amountMatches || amountMatches.length === 0) {
    return null;
  }

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
    const txAmount = amounts[0];
    const isIncome = inferIsIncome(description);

    if (isIncome) {
      credit = txAmount;
    } else {
      debit = txAmount;
    }
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
        const isIncome = inferIsIncome(description);
        if (isIncome) {
          credit = txAmount;
        } else {
          debit = txAmount;
        }
      }
    } else {
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
// BANK-SPECIFIC PARSERS
// ============================================================================

const BANK_PARSERS = {
  boi: parseBOIStatement,
};

export function parseBOIStatement(pdfText) {
  const transactions = [];
  const lines = pdfText.split('\n').map(line => line.trim()).filter(line => line);

  const datePattern = /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i;

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

  for (const line of lines) {
    const stmtDateMatch = line.match(/Statement date\s*(\d{1,2}\s+\w+\s+\d{4})/i);
    if (stmtDateMatch) statementDate = stmtDateMatch[1];
    const acctMatch = line.match(/Account number\s*(\d+)/i);
    if (acctMatch) accountNumber = acctMatch[1];
  }

  for (const line of lines) {
    if (skipPatterns.some(pattern => pattern.test(line))) continue;
    if (line.length < 5) continue;

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

export function parseBOIStatementWithPositions(linesWithPositions, fullText) {
  const transactions = [];

  const columns = detectBOIColumnPositions(linesWithPositions);

  const datePattern = /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i;
  const amountPattern = /^[\d,]+\.\d{2}$/;

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

  const stmtDateMatch = fullText.match(/Statement date\s*(\d{1,2}\s+\w+\s+\d{4})/i);
  if (stmtDateMatch) statementDate = stmtDateMatch[1];
  const acctMatch = fullText.match(/Account number\s*(\d+)/i);
  if (acctMatch) accountNumber = acctMatch[1];

  for (const line of linesWithPositions) {
    const lineText = line.items.map(i => i.text).join(' ').trim();

    if (skipPatterns.some(pattern => pattern.test(lineText))) continue;
    if (lineText.length < 5) continue;

    const dateMatch = lineText.match(datePattern);
    if (dateMatch) {
      currentDate = parseDate(dateMatch[1]);
    }

    if (!currentDate) continue;

    const amountItems = line.items.filter(item => amountPattern.test(item.text));
    if (amountItems.length === 0) continue;

    const descItems = line.items.filter(item =>
      !amountPattern.test(item.text) &&
      !datePattern.test(item.text)
    );
    const description = descItems.map(i => i.text).join(' ').trim();

    if (description.length < 2) continue;
    if (/BALANCE FORWARD/i.test(description)) continue;

    let debit = null;
    let credit = null;
    let balance = null;

    for (const amountItem of amountItems) {
      const amount = parseAmount(amountItem.text);
      const column = classifyAmountColumn(amountItem.x, columns);

      switch (column) {
        case 'debit': debit = amount; break;
        case 'credit': credit = amount; break;
        case 'balance': balance = amount; break;
      }
    }

    if (columns.usePatternFallback && amountItems.length === 1 && debit !== null && credit === null) {
      const patternSaysIncome = inferIsIncome(description);
      if (patternSaysIncome) {
        credit = debit;
        debit = null;
      }
    }

    if (debit !== null || credit !== null) {
      transactions.push({
        date: currentDate,
        details: description,
        debit: debit,
        credit: credit,
        balance: balance,
        amount: debit || credit || 0,
        isIncome: credit !== null && credit > 0
      });
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

export function parseAIBStatementWithPositions(linesWithPositions, fullText) {
  const transactions = [];

  const columns = detectAIBColumnPositions(linesWithPositions);

  const datePattern = /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i;
  const amountPattern = /^[\d,]+\.\d{2}$/;

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
    /^\d{2}-\d{2}-\d{2}$/,
    /^\d{3,4}$/,
    /^Claremorris/i,
    /^Co\.?\s+\w+\.?$/i,
    /BALANCE FORWARD/i,
    /^Interest Rate$/i,
    /^Lending @ /i,
    /^\d+\.\d+ (?:USD|GBP|EUR)@$/i,
    /^\d+\.\d{4,}$/,
    /^INCL FX FEE/i,
    /^\d{2}\w{3}\d{2}\s+\d{2}:\d{2}$/i,
    /^TxnDate:/i,
    /^DUBLIN$/i,
  ];

  let currentDate = null;
  let statementDate = null;
  let accountNumber = null;
  let sortCode = null;

  const stmtDateMatch = fullText.match(/Date of Statement\s*(\d{1,2}\s+\w+\s+\d{4})/i);
  if (stmtDateMatch) statementDate = stmtDateMatch[1];
  const acctMatch = fullText.match(/Account Number\s*([\d-]+)/i);
  if (acctMatch) accountNumber = acctMatch[1];
  const sortCodeMatch = fullText.match(/National Sort Code\s*([\d-]+)/i);
  if (sortCodeMatch) sortCode = sortCodeMatch[1];

  for (const line of linesWithPositions) {
    const normalizedItems = mergeAmountFragments(line.items);
    const lineText = normalizedItems.map(i => i.text).join(' ').trim();

    if (skipPatterns.some(pattern => pattern.test(lineText))) continue;
    if (lineText.length < 3) continue;

    if (/^\d+\s+\w+$/i.test(lineText) && !datePattern.test(lineText) && !amountPattern.test(lineText)) {
      const hasAmount = normalizedItems.some(i => amountPattern.test(i.text));
      if (!hasAmount) continue;
    }

    const dateMatch = lineText.match(datePattern);
    if (dateMatch) {
      currentDate = parseDate(dateMatch[1]);
    }

    if (!currentDate) continue;

    const amountItems = normalizedItems.filter(item => amountPattern.test(item.text));
    if (amountItems.length === 0) continue;

    const descItems = normalizedItems.filter(item => {
      if (amountPattern.test(item.text)) return false;
      if (dateMatch) {
        const dateParts = dateMatch[1].split(/\s+/);
        if (dateParts.includes(item.text)) return false;
      }
      return true;
    });
    const description = descItems.map(i => i.text).join(' ').trim();

    if (description.length < 2) continue;
    if (/^BALANCE FORWARD/i.test(description)) continue;
    if (/^Interest Rate$/i.test(description)) continue;
    if (/^Lending @/i.test(description)) continue;
    if (/^\d+\.\d+ (?:USD|GBP|EUR)@/i.test(description)) continue;
    if (/^INCL FX FEE/i.test(description)) continue;
    if (/^\d+\.\d{4,}$/.test(description)) continue;

    let debit = null;
    let credit = null;
    let balance = null;

    const sortedAmounts = [...amountItems].sort((a, b) => a.x - b.x);

    if (sortedAmounts.length === 1) {
      const amount = parseAmount(sortedAmounts[0].text);
      const x = sortedAmounts[0].x;
      const distToBalance = Math.abs(x - columns.balance);
      const distToDebit = Math.abs(x - columns.paymentsOut);

      if (distToBalance < distToDebit) {
        balance = amount;
      } else {
        if (inferIsIncome(description)) {
          credit = amount;
        } else {
          debit = amount;
        }
      }
    } else if (sortedAmounts.length === 2) {
      const leftAmount = parseAmount(sortedAmounts[0].text);
      const rightAmount = parseAmount(sortedAmounts[1].text);
      balance = rightAmount;
      if (inferIsIncome(description)) {
        credit = leftAmount;
      } else {
        debit = leftAmount;
      }
    } else if (sortedAmounts.length >= 3) {
      debit = parseAmount(sortedAmounts[0].text);
      credit = parseAmount(sortedAmounts[1].text);
      balance = parseAmount(sortedAmounts[sortedAmounts.length - 1].text);
    }

    if (debit !== null || credit !== null) {
      transactions.push({
        date: currentDate,
        details: description,
        debit: debit,
        credit: credit,
        balance: balance,
        amount: debit || credit || 0,
        isIncome: credit !== null && credit > 0
      });
    }
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
 * Route to the correct parser based on detected bank.
 * Takes pre-extracted text and position data (no PDF dependency).
 *
 * @param {string} bank - Bank identifier ('boi', 'aib')
 * @param {string} fullText - Extracted text from PDF
 * @param {Array} linesWithPositions - Position data from PDF
 * @returns {{ transactions: Array, metadata: Object }}
 */
export function parseBankStatement(bank, fullText, linesWithPositions) {
  if (bank === 'boi') {
    return parseBOIStatementWithPositions(linesWithPositions, fullText);
  } else if (bank === 'aib') {
    return parseAIBStatementWithPositions(linesWithPositions, fullText);
  } else {
    const parser = BANK_PARSERS[bank];
    if (!parser) {
      throw new Error(`No parser available for ${bank}. Currently supported: Bank of Ireland, AIB`);
    }
    return parser(fullText);
  }
}

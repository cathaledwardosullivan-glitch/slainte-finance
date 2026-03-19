/**
 * Export utility functions for generating CSV/ZIP files.
 * Shared between AccountantExport UI component and Finn AI agent.
 */
import JSZip from 'jszip';
import { PCRS_PAYMENT_CATEGORIES } from '../data/paymentCategories';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Format date for CSV (DD/MM/YYYY)
const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
};

// Format currency for CSV
const formatCurrency = (amount) => {
  return (amount || 0).toFixed(2);
};

// Map transaction to simplified accountant-friendly category label
export const getSimpleCategoryLabel = (transaction) => {
  if (!transaction.category) return 'Uncategorised';

  const cat = transaction.category;
  if (cat.type === 'income') return 'Income';

  const section = cat.section || '';
  if (section.includes('STAFF') || section.includes('Staff')) return 'Staff Costs';
  if (section.includes('MEDICAL') || section.includes('Medical')) return 'Medical Supplies';
  if (section.includes('PREMISES') || section.includes('Premises')) return 'Premises Costs';
  if (section.includes('OFFICE') || section.includes('Office') || section.includes('IT')) return 'Office & IT';
  if (section.includes('PROFESSIONAL') || section.includes('Professional')) return 'Professional Services';
  if (section.includes('MOTOR') || section.includes('Motor')) return 'Motor Expenses';
  if (section.includes('CAPITAL') || section.includes('Capital')) return 'Capital Items';

  return 'Petty Cash / Other';
};

/**
 * Download a blob as a file in the browser.
 */
export const downloadBlob = (content, filename, mimeType = 'text/csv') => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Build simplified transactions CSV content.
 * @returns {{ content: string, filename: string }}
 */
export const buildSimpleTransactionsCSV = (transactions, year) => {
  const csvRows = [['Date', 'Description', 'Debit', 'Credit', 'Category']];

  [...transactions]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach(t => {
      csvRows.push([
        formatDate(t.date),
        `"${(t.details || '').replace(/"/g, '""')}"`,
        formatCurrency(t.debit),
        formatCurrency(t.credit),
        getSimpleCategoryLabel(t)
      ]);
    });

  return {
    content: csvRows.map(row => row.join(',')).join('\n'),
    filename: `transactions-simple-${year}.csv`
  };
};

/**
 * Build detailed transactions CSV content.
 * @returns {{ content: string, filename: string }}
 */
export const buildDetailedTransactionsCSV = (transactions, year) => {
  const csvRows = [['Date', 'Description', 'Debit', 'Credit', 'Type', 'Group', 'Category', 'P&L Line', 'Comments']];

  [...transactions]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach(t => {
      const cat = t.category || {};
      csvRows.push([
        formatDate(t.date),
        `"${(t.details || '').replace(/"/g, '""')}"`,
        formatCurrency(t.debit),
        formatCurrency(t.credit),
        cat.type || '',
        `"${(cat.section || '').replace(/"/g, '""')}"`,
        `"${(cat.name || 'Uncategorised').replace(/"/g, '""')}"`,
        `"${(cat.accountantLine || '').replace(/"/g, '""')}"`,
        `"${(t.comment || '').replace(/"/g, '""')}"`
      ]);
    });

  return {
    content: csvRows.map(row => row.join(',')).join('\n'),
    filename: `transactions-detailed-${year}.csv`
  };
};

/**
 * Build PCRS payment summary CSV content.
 * @returns {{ content: string, filename: string }}
 */
export const buildPCRSSummaryCSV = (paymentData, year) => {
  const csvRows = [['Month', 'Doctor', 'Doctor Number', 'Payment Date', 'Gross Payment', 'Withholding Tax', 'Net Payment', 'Panel Size']];

  paymentData.forEach(p => {
    csvRows.push([
      p.month || '',
      `"${(p.doctor || '').replace(/"/g, '""')}"`,
      p.doctorNumber || '',
      p.paymentDate || '',
      formatCurrency(p.totalGrossPayment),
      formatCurrency(p.deductions?.['Less withholding Tax'] || 0),
      formatCurrency((p.totalGrossPayment || 0) - Object.values(p.deductions || {}).reduce((a, b) => a + b, 0)),
      p.panelSize || ''
    ]);
  });

  // Add detailed breakdown
  csvRows.push([]);
  csvRows.push(['--- Payment Category Breakdown ---']);
  csvRows.push(['Category', ...paymentData.map(p => p.month || 'Unknown')]);

  PCRS_PAYMENT_CATEGORIES.forEach(category => {
    csvRows.push([
      `"${category}"`,
      ...paymentData.map(p => formatCurrency(p.payments?.[category] || 0))
    ]);
  });

  return {
    content: csvRows.map(row => row.join(',')).join('\n'),
    filename: `pcrs-summary-${year}.csv`
  };
};

/**
 * Build payment overview CSV content (monthly breakdown by category).
 * @returns {{ content: string, filename: string }}
 */
export const buildPaymentOverviewCSV = (paymentData, year) => {
  const summary = {};
  PCRS_PAYMENT_CATEGORIES.forEach(category => {
    summary[category] = { TOTAL: 0 };
    MONTHS.forEach(month => { summary[category][month] = 0; });
  });

  paymentData.forEach(record => {
    const month = record.month;
    if (!month) return;
    PCRS_PAYMENT_CATEGORIES.forEach(category => {
      const amount = record.payments?.[category] || 0;
      summary[category][month] = (summary[category][month] || 0) + amount;
      summary[category].TOTAL = (summary[category].TOTAL || 0) + amount;
    });
  });

  let csvContent = `Payment Category,TOTAL,${MONTHS.join(',')}\n`;
  PCRS_PAYMENT_CATEGORIES.forEach(category => {
    csvContent += `"${category}",${formatCurrency(summary[category].TOTAL)},${MONTHS.map(m => formatCurrency(summary[category][m])).join(',')}\n`;
  });

  // Add totals row
  const monthTotals = MONTHS.map(month =>
    PCRS_PAYMENT_CATEGORIES.reduce((sum, cat) => sum + (summary[cat][month] || 0), 0)
  );
  const grandTotal = PCRS_PAYMENT_CATEGORIES.reduce((sum, cat) => sum + (summary[cat].TOTAL || 0), 0);
  csvContent += `"TOTAL",${formatCurrency(grandTotal)},${monthTotals.map(t => formatCurrency(t)).join(',')}\n`;

  return {
    content: csvContent,
    filename: `payment-overview-${year}.csv`
  };
};

/**
 * Build P&L report draft CSV content.
 * @returns {{ content: string, filename: string }}
 */
export const buildPLReportCSV = (transactions, year) => {
  const income = {};
  const expenses = {};

  transactions.forEach(t => {
    const cat = t.category;
    if (!cat) return;
    const accountantLine = cat.accountantLine || cat.name || 'Other';
    const amount = Math.abs(t.debit || t.credit || t.amount || 0);
    if (cat.type === 'income') {
      income[accountantLine] = (income[accountantLine] || 0) + amount;
    } else if (cat.type === 'expense') {
      expenses[accountantLine] = (expenses[accountantLine] || 0) + amount;
    }
  });

  const totalIncome = Object.values(income).reduce((a, b) => a + b, 0);
  const totalExpenses = Object.values(expenses).reduce((a, b) => a + b, 0);
  const netProfit = totalIncome - totalExpenses;

  let csvContent = `P&L Report Draft - ${year}\n`;
  csvContent += `Generated: ${new Date().toLocaleDateString()}\n\n`;

  csvContent += `INCOME\nCategory,Amount\n`;
  Object.entries(income).sort((a, b) => b[1] - a[1]).forEach(([cat, amount]) => {
    csvContent += `"${cat}",${formatCurrency(amount)}\n`;
  });
  csvContent += `"TOTAL INCOME",${formatCurrency(totalIncome)}\n\n`;

  csvContent += `EXPENSES\nCategory,Amount\n`;
  Object.entries(expenses).sort((a, b) => b[1] - a[1]).forEach(([cat, amount]) => {
    csvContent += `"${cat}",${formatCurrency(amount)}\n`;
  });
  csvContent += `"TOTAL EXPENSES",${formatCurrency(totalExpenses)}\n\n`;

  csvContent += `SUMMARY\n`;
  csvContent += `"Total Income",${formatCurrency(totalIncome)}\n`;
  csvContent += `"Total Expenses",${formatCurrency(totalExpenses)}\n`;
  csvContent += `"Net Profit/(Loss)",${formatCurrency(netProfit)}\n`;

  return {
    content: csvContent,
    filename: `pl-report-draft-${year}.csv`
  };
};

/**
 * Build and download a complete accountant pack as ZIP.
 * This triggers the download directly (async due to JSZip).
 */
export const buildAndDownloadAccountantPackZIP = async (transactions, paymentData, year) => {
  const zip = new JSZip();
  const folder = zip.folder(`accountant-pack-${year}`);

  // 1. Simple transactions
  const simple = buildSimpleTransactionsCSV(transactions, year);
  folder.file(simple.filename, simple.content);

  // 2. Detailed transactions
  const detailed = buildDetailedTransactionsCSV(transactions, year);
  folder.file(detailed.filename, detailed.content);

  // 3. PCRS Summary (if data available)
  if (paymentData.length > 0) {
    const pcrs = buildPCRSSummaryCSV(paymentData, year);
    folder.file(pcrs.filename, pcrs.content);

    // 4. Payment Overview
    const overview = buildPaymentOverviewCSV(paymentData, year);
    folder.file(overview.filename, overview.content);
  }

  // 5. P&L Draft
  const pl = buildPLReportCSV(transactions, year);
  folder.file(pl.filename, pl.content);

  // README
  const readme = `Accountant Export Pack - ${year}
Generated: ${new Date().toLocaleString()}

Contents:
1. ${simple.filename} - All transactions with simplified category labels
2. ${detailed.filename} - All transactions with full categorisation details
3. pcrs-summary-${year}.csv - PCRS payment summaries (if available)
4. payment-overview-${year}.csv - Monthly payment breakdown by category (if available)
5. ${pl.filename} - Draft P&L report

Notes:
- All amounts are in EUR
- Dates are in DD/MM/YYYY format
- This is a draft export - please review with your accountant

Generated by Slainte Finance
`;
  folder.file('README.txt', readme);

  // Generate and download
  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = `accountant-pack-${year}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

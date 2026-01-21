// Transaction categorization and processing utilities
import { autoCategorizeToParen } from './simpleAutoCategorization';

export const categorizeTransaction = (details, categoryMapping) => {
  if (!details) return null;

  const detailsUpper = details.toString().toUpperCase();

  // Single unified check - all identifiers in one place
  for (const category of categoryMapping) {
    for (const identifier of category.identifiers) {
      if (detailsUpper.includes(identifier.toString().toUpperCase())) {
        return category;
      }
    }
  }
  return null;
};

/**
 * Simplified categorization for onboarding
 * Uses parent categories for quick initial setup
 */
export const categorizeTransactionSimple = (transaction, categoryMapping) => {
  if (!transaction) return null;

  // First try identifier-based matching (for staff costs mainly)
  const details = transaction.details || '';
  const detailsUpper = details.toString().toUpperCase();

  // Check for exact identifier matches (staff members, etc.)
  for (const category of categoryMapping) {
    if (category.personalization === 'Personalized') {
      for (const identifier of category.identifiers || []) {
        if (detailsUpper.includes(identifier.toString().toUpperCase())) {
          return category; // Return specific staff category
        }
      }
    }
  }

  // Fall back to simple auto-categorization (parent categories)
  const categoryCode = autoCategorizeToParen(transaction, categoryMapping);
  if (categoryCode) {
    return categoryMapping.find(c => c.code === categoryCode);
  }

  return null;
};

export const extractLearningPatterns = (details) => {
  if (!details) return [];
  
  const patterns = [];
  const cleaned = details.toString().trim();
  
  patterns.push(cleaned);
  
  const words = cleaned.split(/\s+/).filter(word => 
    word.length >= 3 && 
    !['THE', 'AND', 'FOR', 'WITH', 'FROM', 'LTD', 'LIMITED'].includes(word.toUpperCase())
  );
  patterns.push(...words);
  
  const letterSequences = cleaned.match(/[A-Za-z]{4,}/g) || [];
  patterns.push(...letterSequences);
  
  if (words.length > 0) {
    patterns.push(words[0]);
  }
  
  return [...new Set(patterns)];
};

export const processTransactionData = (results, selectedFile, categorizeTransaction) => {
  if (!results.data || results.data.length === 0) {
    throw new Error('No data found in the file.');
  }
  
  const processedTransactions = results.data
    .filter((row, index) => {
      const hasData = row && Object.keys(row).length > 0 && (row.Details || row.details);
      return hasData;
    })
    .map((row, index) => {
      const details = row.Details || row.details || row.Description || row.description || 
                     row.Particulars || row.particulars || row.Transaction || row.transaction || 
                     row.Narrative || row.narrative || row.Reference || row.reference || '';
      
      const debitValue = row.Debit || row.debit || row['Debit Amount'] || row['Debit_Amount'] || 
                       row.DR || row.dr || row.Out || row.out || row.Withdrawal || row.withdrawal || 0;
      
      const creditValue = row.Credit || row.credit || row['Credit Amount'] || row['Credit_Amount'] || 
                        row.CR || row.cr || row.In || row.in || row.Deposit || row.deposit || 0;
      
      const amountValue = row.Amount || row.amount || row.Value || row.value || 0;
      
      const debit = (debitValue !== undefined && debitValue !== null) ? parseFloat(debitValue) || 0 : 0;
      const credit = (creditValue !== undefined && creditValue !== null) ? parseFloat(creditValue) || 0 : 0;
      const amount = (amountValue !== undefined && amountValue !== null) ? parseFloat(amountValue) || 0 : 0;
      
      let parsedDate = null;
      let monthYear = null;
      const dateValue = row.Date || row.date || row['Transaction Date'] || row['Value Date'] || 
                      row['Date'] || row.TransactionDate || row['Processing Date'] || '';
      
      if (dateValue) {
        try {
          let date;
          if (typeof dateValue === 'number') {
            // Excel serial date number
            date = new Date((dateValue - 25569) * 86400 * 1000);
          } else if (typeof dateValue === 'string') {
            // Handle various string date formats
            const dateStr = dateValue.toString().trim();
            
            // Check for DD/MM/YYYY or DD-MM-YYYY format (UK/Irish format)
            if (dateStr.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/)) {
              const parts = dateStr.split(/[\/\-]/);
              const day = parseInt(parts[0], 10);
              const month = parseInt(parts[1], 10);
              const year = parseInt(parts[2], 10);
              
              // Validate day and month ranges
              if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900) {
                // Create date with UK format: DD/MM/YYYY
                date = new Date(year, month - 1, day); // month is 0-based in JavaScript
              }
            }
            // Check for DD/MM/YY format (2-digit year)
            else if (dateStr.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2}$/)) {
              const parts = dateStr.split(/[\/\-]/);
              const day = parseInt(parts[0], 10);
              const month = parseInt(parts[1], 10);
              let year = parseInt(parts[2], 10);
              
              // Handle 2-digit years (assume 1900s for years > 50, 2000s for years <= 50)
              year = year > 50 ? 1900 + year : 2000 + year;
              
              if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
                date = new Date(year, month - 1, day);
              }
            }
            // Additional date format handling...
            else {
              // Try standard Date parsing as fallback
              date = new Date(dateStr);
            }
          } else {
            // Direct Date object or other type
            date = new Date(dateValue);
          }
          
          // Validate the parsed date
          if (date && !isNaN(date.getTime()) && date.getFullYear() >= 1900 && date.getFullYear() <= 2100) {
            parsedDate = date;
            monthYear = date.toISOString().substring(0, 7);
          } else {
            console.warn('Invalid or out-of-range date:', dateValue, 'parsed as:', date);
          }
        } catch (e) {
          console.warn('Date parsing error for:', dateValue, 'Error:', e.message);
        }
      }
      
      // Build transaction object first for categorization
      const transactionObj = {
        id: `${selectedFile?.name || 'manual'}-${index}`,
        date: parsedDate,
        details: details,
        debit: debit,
        credit: credit,
        amount: Math.max(Math.abs(debit), Math.abs(credit), Math.abs(amount)),
        balance: parseFloat(row.Balance || row.balance || row['Running Balance'] || row['Closing Balance'] || 0) || 0,
        monthYear: monthYear,
        fileName: selectedFile?.name || 'manual',
        rawRow: row
      };

      // Categorize - function can be either old (details only) or new (transaction object)
      let category = categorizeTransaction(transactionObj);

      // Auto-categorize incoming transactions (credits) as "Income Unclassified" if no category found
      // This prevents income transactions from appearing as unidentified one-off transactions
      const isIncomeTransaction = credit > 0 || (amount > 0 && debit === 0);
      if (!category && isIncomeTransaction) {
        // Will be set after we return to the caller who has access to categoryMapping
        category = '__AUTO_INCOME__'; // Placeholder marker
      }

      return {
        ...transactionObj,
        category: category,
        isIncome: category ? (category === '__AUTO_INCOME__' || category.type === 'income') : isIncomeTransaction
      };
    });

  const categorized = processedTransactions.filter(t => t.category && t.category !== '__AUTO_INCOME__');
  const unidentified = processedTransactions.filter(t => !t.category);
  const autoIncome = processedTransactions.filter(t => t.category === '__AUTO_INCOME__');

  return { categorized, unidentified, autoIncome };
};
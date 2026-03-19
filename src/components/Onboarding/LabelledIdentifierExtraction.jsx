import React, { useState, useEffect } from 'react';
import { User, MessageCircle, CheckCircle, ArrowRight, Loader, Tag, Search, Plus } from 'lucide-react';
import COLORS from '../../utils/colors';
import { PARENT_CATEGORIES } from '../../utils/parentCategoryMapping';
import { useAppContext } from '../../context/AppContext';
import { saveTransactions, saveCategoryMapping } from '../../utils/storageUtils';

// Parse date string to Date object
const parseDate = (dateValue) => {
  if (!dateValue) return null;

  try {
    let date;

    if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue === 'number') {
      // Excel serial date number
      date = new Date((dateValue - 25569) * 86400 * 1000);
    } else if (typeof dateValue === 'string') {
      const dateStr = dateValue.toString().trim();

      // Check for DD/MM/YYYY or DD-MM-YYYY format (UK/Irish format)
      if (dateStr.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/)) {
        const parts = dateStr.split(/[\/\-]/);
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);

        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900) {
          date = new Date(year, month - 1, day);
        }
      }
      // Check for DD/MM/YY format (2-digit year)
      else if (dateStr.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2}$/)) {
        const parts = dateStr.split(/[\/\-]/);
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        let year = parseInt(parts[2], 10);

        year = year > 50 ? 1900 + year : 2000 + year;

        if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
          date = new Date(year, month - 1, day);
        }
      }
      // Check for YYYY-MM-DD format (ISO)
      else if (dateStr.match(/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/)) {
        const parts = dateStr.split(/[\/\-]/);
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);

        if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
          date = new Date(year, month - 1, day);
        }
      }
      // Try standard Date parsing as fallback
      else {
        date = new Date(dateStr);
      }
    } else {
      date = new Date(dateValue);
    }

    // Validate the parsed date
    if (date && !isNaN(date.getTime()) && date.getFullYear() >= 1900 && date.getFullYear() <= 2100) {
      return date;
    }
  } catch (e) {
    console.warn('Date parsing error for:', dateValue, 'Error:', e.message);
  }

  return null;
};

// Check if identifier already exists in ANY category
const identifierExistsAnywhere = (identifier, categoryMapping) => {
  const lowerIdentifier = identifier.toLowerCase();
  return categoryMapping.some(cat =>
    cat.identifiers.some(id => id.toLowerCase() === lowerIdentifier)
  );
};

// Instant text display (typing animation disabled)
const useTypingEffect = (text) => {
  return { displayedText: text || '', isComplete: true };
};

export default function LabelledIdentifierExtraction({ mappingData, onComplete }) {
  const { categoryMapping, setCategoryMapping, setTransactions } = useAppContext();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processComplete, setProcessComplete] = useState(false);
  const [extractedIdentifiers, setExtractedIdentifiers] = useState([]);
  const [stats, setStats] = useState({
    totalTransactions: 0,
    categorizedTransactions: 0,
    newIdentifiers: 0,
    categoriesUpdated: 0
  });

  const [showGreeting, setShowGreeting] = useState(false);
  const [showMessage, setShowMessage] = useState(false);

  const greetingText = processComplete ? "All done!" : "Extracting patterns from your data...";
  const messageText = processComplete
    ? `Excellent! I've added ${stats.newIdentifiers} new identifiers across ${stats.categoriesUpdated} categories. Your ${stats.categorizedTransactions} pre-labelled transactions are now categorized.`
    : "I'm analyzing your transactions to find recurring patterns and adding them as identifiers. This will help auto-categorize future transactions.";

  const { displayedText: greeting, isComplete: greetingComplete } = useTypingEffect(showGreeting ? greetingText : '', 25);
  const { displayedText: message, isComplete: messageComplete } = useTypingEffect(showMessage ? messageText : '', 15);

  // Animation sequence
  useEffect(() => {
    const timer = setTimeout(() => setShowGreeting(true), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (greetingComplete) {
      const timer = setTimeout(() => setShowMessage(true), 200);
      return () => clearTimeout(timer);
    }
  }, [greetingComplete]);

  // Start processing when message is shown
  useEffect(() => {
    if (messageComplete && !isProcessing && !processComplete) {
      processTransactions();
    }
  }, [messageComplete]);

  // Extract best identifier pattern from description
  const extractPattern = (description) => {
    if (!description) return '';

    // Remove common prefixes
    let cleaned = description.toUpperCase().trim();
    cleaned = cleaned.replace(/^(POS\d{1,2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*)/i, '');
    cleaned = cleaned.replace(/^(DD|SO|TFR|FPI|FPO)\s*/i, '');
    cleaned = cleaned.replace(/^(0?[1-9]|[12][0-9]|3[01])(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*/i, '');

    // Try to find a good identifier
    // Check for numeric pattern (like account numbers, reference numbers)
    const numericMatch = cleaned.match(/[\d\-]{8,}/);
    if (numericMatch) {
      const numericStr = numericMatch[0];
      const keepLength = Math.floor(numericStr.length * 0.7);
      if (keepLength >= 6) {
        return numericStr.substring(0, keepLength);
      }
    }

    // Find meaningful words (company names, etc.)
    const words = cleaned.split(/\s+/).filter(word => {
      const w = word.toUpperCase();
      return word.length >= 4 &&
        !['THE', 'AND', 'FOR', 'WITH', 'FROM', 'LTD', 'LIMITED', 'INC', 'CORP', 'IRELAND', 'DUBLIN'].includes(w) &&
        !w.startsWith('POS') &&
        !/^[0-9]+$/.test(w);
    });

    if (words.length > 0) {
      // Return the longest word as the identifier
      return words.sort((a, b) => b.length - a.length)[0];
    }

    return '';
  };

  // Find longest common substring in a group of descriptions
  const findLongestCommonSubstring = (descriptions) => {
    if (descriptions.length === 0) return '';
    if (descriptions.length === 1) return extractPattern(descriptions[0]);

    const upperDescriptions = descriptions.map(d => d.toUpperCase().trim());
    const longest = upperDescriptions.reduce((max, str) => str.length > max.length ? str : max);

    // Find substrings that appear in all descriptions
    for (let length = Math.min(longest.length, 30); length >= 4; length--) {
      for (let start = 0; start <= longest.length - length; start++) {
        const candidate = longest.substring(start, start + length).trim();
        if (candidate.length >= 4 && upperDescriptions.every(d => d.includes(candidate))) {
          // Clean up the candidate
          let cleaned = candidate;
          cleaned = cleaned.replace(/^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*/i, '');
          cleaned = cleaned.replace(/^(0?[1-9]|[12][0-9]|3[01])\s*/, '');
          cleaned = cleaned.replace(/^(20\d{2}|'\d{2}|\d{2})\s*/, '');
          cleaned = cleaned.replace(/^POS\d{1,2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*/i, '');
          cleaned = cleaned.trim();

          if (cleaned.length >= 4) {
            return cleaned;
          }
        }
      }
    }

    // Fall back to extracting from first description
    return extractPattern(descriptions[0]);
  };

  const processTransactions = async () => {
    setIsProcessing(true);

    try {
      const { categoryMappings, transactions } = mappingData;

      // Group transactions by user category
      const transactionsByCategory = {};
      transactions.forEach(t => {
        if (t.userCategory) {
          if (!transactionsByCategory[t.userCategory]) {
            transactionsByCategory[t.userCategory] = [];
          }
          transactionsByCategory[t.userCategory].push(t);
        }
      });

      // For each mapped category, extract patterns and create identifiers
      const newIdentifiers = [];
      const updatedCategoryMapping = [...categoryMapping];
      const categoriesUpdated = new Set();

      for (const mapping of categoryMappings) {
        const userCategoryTransactions = transactionsByCategory[mapping.userCategory] || [];
        if (userCategoryTransactions.length === 0) continue;

        // Get the Sláinte parent category
        const parentCategory = PARENT_CATEGORIES[mapping.slainteCategory];
        if (!parentCategory) continue;

        // Find the default category code for this parent
        const defaultCategoryCode = parentCategory.defaultCategory;
        const categoryIndex = updatedCategoryMapping.findIndex(c => c.code === defaultCategoryCode);
        if (categoryIndex === -1) continue;

        // Group transactions by extracted pattern to find recurring ones
        const patternGroups = {};
        userCategoryTransactions.forEach(t => {
          const pattern = extractPattern(t.description);
          if (pattern) {
            if (!patternGroups[pattern]) {
              patternGroups[pattern] = [];
            }
            patternGroups[pattern].push(t);
          }
        });

        // For patterns that appear 2+ times, add as identifiers
        for (const [pattern, txns] of Object.entries(patternGroups)) {
          if (txns.length >= 2) {
            // Refine the pattern using LCS
            const refinedPattern = findLongestCommonSubstring(txns.map(t => t.description));
            const identifierToAdd = refinedPattern || pattern;

            // Check if this identifier already exists IN ANY CATEGORY (avoid duplicates)
            const alreadyExistsAnywhere = identifierExistsAnywhere(identifierToAdd, updatedCategoryMapping);
            const alreadyInNewIdentifiers = newIdentifiers.some(
              ni => ni.identifier.toLowerCase() === identifierToAdd.toLowerCase()
            );

            if (!alreadyExistsAnywhere && !alreadyInNewIdentifiers && identifierToAdd.length >= 4) {
              // Add identifier to the target category
              const category = updatedCategoryMapping[categoryIndex];
              updatedCategoryMapping[categoryIndex] = {
                ...category,
                identifiers: [...category.identifiers, identifierToAdd]
              };

              newIdentifiers.push({
                identifier: identifierToAdd,
                userCategory: mapping.userCategory,
                slainteCategory: parentCategory.name,
                slainteCategoryId: mapping.slainteCategory,
                transactionCount: txns.length,
                sampleDescriptions: txns.slice(0, 2).map(t => t.description)
              });

              categoriesUpdated.add(mapping.slainteCategory);
            }
          }
        }

        // Also try to find a pattern that covers ALL transactions in this user category
        if (userCategoryTransactions.length >= 3) {
          const groupPattern = findLongestCommonSubstring(userCategoryTransactions.map(t => t.description));
          if (groupPattern && groupPattern.length >= 4) {
            // Check if exists anywhere in mapping or in our new identifiers list
            const alreadyExistsAnywhere = identifierExistsAnywhere(groupPattern, updatedCategoryMapping);
            const alreadyInNewIdentifiers = newIdentifiers.some(
              ni => ni.identifier.toLowerCase() === groupPattern.toLowerCase()
            );

            if (!alreadyExistsAnywhere && !alreadyInNewIdentifiers) {
              const category = updatedCategoryMapping[categoryIndex];
              updatedCategoryMapping[categoryIndex] = {
                ...category,
                identifiers: [...category.identifiers, groupPattern]
              };

              newIdentifiers.push({
                identifier: groupPattern,
                userCategory: mapping.userCategory,
                slainteCategory: parentCategory.name,
                slainteCategoryId: mapping.slainteCategory,
                transactionCount: userCategoryTransactions.length,
                sampleDescriptions: userCategoryTransactions.slice(0, 2).map(t => t.description),
                isGroupPattern: true
              });

              categoriesUpdated.add(mapping.slainteCategory);
            }
          }
        }
      }

      // Update category mapping in context and save to storage
      setCategoryMapping(updatedCategoryMapping);
      saveCategoryMapping(updatedCategoryMapping);

      // Convert imported transactions to the app's transaction format
      const now = Date.now();
      const convertedTransactions = transactions.map((t, idx) => {
        // Find the Sláinte category for this transaction's user category
        const mapping = categoryMappings.find(m => m.userCategory === t.userCategory);
        const slainteCategoryId = mapping?.slainteCategory;
        const parentCategory = slainteCategoryId ? PARENT_CATEGORIES[slainteCategoryId] : null;
        const categoryCode = parentCategory?.defaultCategory || null;

        // Determine the type based on parent category
        const getTypeForCategory = (parentId) => {
          if (parentId === 'INCOME') return 'income';
          if (parentId === 'NON_BUSINESS') return 'non-business';
          return 'expense';
        };

        // Find the full category object from categoryMapping
        let categoryObj = null;
        if (categoryCode) {
          const foundCategory = updatedCategoryMapping.find(c => c.code === categoryCode);
          if (foundCategory) {
            categoryObj = {
              code: foundCategory.code,
              name: foundCategory.name,
              type: foundCategory.type || getTypeForCategory(slainteCategoryId),
              section: foundCategory.section
            };
          } else if (parentCategory) {
            // Category code not found in mapping - create a fallback category object
            // This can happen for NON_BUSINESS and other categories not yet in the user's mapping
            console.log(`[LabelledImport] Category code ${categoryCode} not found in mapping, creating fallback for ${slainteCategoryId}`);
            categoryObj = {
              code: categoryCode,
              name: parentCategory.name,
              type: getTypeForCategory(slainteCategoryId),
              section: parentCategory.sections?.[0] || slainteCategoryId
            };
          }
        }

        // Parse the date properly
        const parsedDate = parseDate(t.date);
        const monthYear = parsedDate ? parsedDate.toISOString().substring(0, 7) : null;

        // Determine if income or expense based on the category mapping, NOT the amount sign
        // Bank CSVs often have all amounts as positive, so we rely on the category type
        const isIncome = mapping?.isIncome ?? (slainteCategoryId === 'INCOME');
        const absAmount = Math.abs(t.amount || 0);

        // If amount is 0 or not provided, log a warning
        if (absAmount === 0) {
          console.warn(`[LabelledImport] Transaction has zero amount: ${t.description}`);
        }

        return {
          id: `imported-${now}-${idx}`,
          date: parsedDate,
          details: t.description,
          debit: isIncome ? 0 : absAmount,
          credit: isIncome ? absAmount : 0,
          amount: absAmount,
          balance: 0,
          monthYear: monthYear,
          category: categoryObj,
          isIncome: isIncome,
          source: 'labelled_import',
          originalUserCategory: t.userCategory,
          fileName: 'labelled_import'
        };
      });

      // Filter out transactions with invalid dates
      const validTransactions = convertedTransactions.filter(t => t.date !== null);
      const invalidDateCount = convertedTransactions.length - validTransactions.length;

      if (invalidDateCount > 0) {
        console.warn(`[LabelledImport] ${invalidDateCount} transactions had invalid dates and were skipped`);
      }

      // Save transactions to context AND localStorage
      setTransactions(validTransactions);
      saveTransactions(validTransactions);

      // Update stats
      setStats({
        totalTransactions: transactions.length,
        categorizedTransactions: validTransactions.filter(t => t.category).length,
        newIdentifiers: newIdentifiers.length,
        categoriesUpdated: categoriesUpdated.size,
        skippedInvalidDates: invalidDateCount
      });

      setExtractedIdentifiers(newIdentifiers);
      setProcessComplete(true);

    } catch (err) {
      console.error('Error processing transactions:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const getParentCategory = (id) => {
    return PARENT_CATEGORIES[id] || { name: 'Unknown', icon: '❓', color: COLORS.textSecondary };
  };

  // Group extracted identifiers by Sláinte category
  const groupedIdentifiers = extractedIdentifiers.reduce((acc, item) => {
    if (!acc[item.slainteCategoryId]) {
      acc[item.slainteCategoryId] = [];
    }
    acc[item.slainteCategoryId].push(item);
    return acc;
  }, {});

  return (
    <div style={{
      display: 'flex',
      gap: '2rem',
      alignItems: 'flex-start',
      maxWidth: '1600px',
      margin: '0 auto',
      height: 'min(80vh, 750px)'
    }}>
      {/* Left side - Finn Chat Box */}
      <div style={{
        flex: '1 1 40%',
        minWidth: '400px',
        maxWidth: '550px',
        height: '100%',
        backgroundColor: COLORS.white,
        borderRadius: '0.75rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: `1px solid ${COLORS.borderLight}`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Chat Header */}
        <div style={{
          backgroundColor: COLORS.slainteBlue,
          color: COLORS.white,
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <div style={{
            width: '2.5rem',
            height: '2.5rem',
            backgroundColor: COLORS.slainteBlueDark,
            borderRadius: '9999px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <User style={{ height: '1.25rem', width: '1.25rem' }} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '1rem' }}>Finn</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>Sláinte Guide</div>
          </div>
        </div>

        {/* Chat Messages */}
        <div style={{
          padding: '1.5rem',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          overflowY: 'auto'
        }}>
          {showGreeting && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: COLORS.bgPage,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <MessageCircle style={{ width: '16px', height: '16px', color: COLORS.slainteBlue }} />
              </div>
              <div style={{
                backgroundColor: COLORS.bgPage,
                padding: '0.875rem 1rem',
                borderRadius: '12px',
                maxWidth: '85%'
              }}>
                <div style={{
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  color: COLORS.textPrimary
                }}>
                  {greeting}
                </div>
              </div>
            </div>
          )}

          {showMessage && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', flexShrink: 0 }} />
              <div style={{
                backgroundColor: COLORS.bgPage,
                padding: '0.875rem 1rem',
                borderRadius: '12px',
                maxWidth: '85%'
              }}>
                <div style={{
                  fontSize: '0.9375rem',
                  color: COLORS.textPrimary,
                  lineHeight: 1.5
                }}>
                  {message}
                </div>
              </div>
            </div>
          )}

          {/* Processing indicator */}
          {isProcessing && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', flexShrink: 0 }} />
              <div style={{
                backgroundColor: `${COLORS.slainteBlue}10`,
                padding: '0.875rem 1rem',
                borderRadius: '12px',
                border: `1px solid ${COLORS.slainteBlue}30`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Loader style={{ width: '18px', height: '18px', color: COLORS.slainteBlue, animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: '0.9375rem', color: COLORS.textPrimary }}>
                    Processing {mappingData.transactions.length} transactions...
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Success stats */}
          {processComplete && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', flexShrink: 0 }} />
              <div style={{
                backgroundColor: `${COLORS.incomeColor}10`,
                padding: '1rem',
                borderRadius: '12px',
                maxWidth: '85%',
                border: `1px solid ${COLORS.incomeColor}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <CheckCircle style={{ width: '18px', height: '18px', color: COLORS.incomeColor }} />
                  <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: COLORS.textPrimary }}>
                    Import Complete!
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8125rem' }}>
                  <div>
                    <span style={{ color: COLORS.textSecondary }}>Transactions:</span>
                    <span style={{ marginLeft: '0.5rem', fontWeight: 600, color: COLORS.textPrimary }}>{stats.totalTransactions}</span>
                  </div>
                  <div>
                    <span style={{ color: COLORS.textSecondary }}>Categorized:</span>
                    <span style={{ marginLeft: '0.5rem', fontWeight: 600, color: COLORS.incomeColor }}>{stats.categorizedTransactions}</span>
                  </div>
                  <div>
                    <span style={{ color: COLORS.textSecondary }}>New Identifiers:</span>
                    <span style={{ marginLeft: '0.5rem', fontWeight: 600, color: COLORS.slainteBlue }}>{stats.newIdentifiers}</span>
                  </div>
                  <div>
                    <span style={{ color: COLORS.textSecondary }}>Categories:</span>
                    <span style={{ marginLeft: '0.5rem', fontWeight: 600, color: COLORS.textPrimary }}>{stats.categoriesUpdated}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Continue button */}
        <div style={{
          padding: '1rem',
          borderTop: `1px solid ${COLORS.borderLight}`
        }}>
          <button
            onClick={onComplete}
            disabled={!processComplete}
            style={{
              width: '100%',
              padding: '1rem',
              fontSize: '1rem',
              fontWeight: 600,
              color: COLORS.white,
              backgroundColor: processComplete ? COLORS.incomeColor : COLORS.textSecondary,
              border: 'none',
              borderRadius: '8px',
              cursor: processComplete ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            Continue to Dashboard
            <ArrowRight style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
      </div>

      {/* Right side - Extracted Identifiers */}
      <div style={{
        flex: '1 1 60%',
        minWidth: '500px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto'
      }}>
        <div style={{
          backgroundColor: COLORS.white,
          border: `3px solid ${COLORS.slainteBlue}`,
          borderRadius: '16px',
          padding: '1.5rem',
          flex: 1,
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: `${COLORS.slainteBlue}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Search style={{ width: '20px', height: '20px', color: COLORS.slainteBlue }} />
            </div>
            <div>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: COLORS.textPrimary,
                marginBottom: '0.25rem'
              }}>
                Extracted Identifiers
              </h3>
              <p style={{ fontSize: '0.875rem', color: COLORS.textSecondary }}>
                Patterns learned from your labelled transactions
              </p>
            </div>
          </div>

          {/* Loading state */}
          {isProcessing && (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <Loader style={{ width: '40px', height: '40px', color: COLORS.slainteBlue, animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
              <p style={{ color: COLORS.textSecondary }}>Extracting patterns...</p>
            </div>
          )}

          {/* Extracted identifiers by category */}
          {processComplete && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {extractedIdentifiers.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '2rem',
                  backgroundColor: COLORS.bgPage,
                  borderRadius: '12px'
                }}>
                  <Tag style={{ width: '32px', height: '32px', color: COLORS.textSecondary, margin: '0 auto 0.75rem' }} />
                  <p style={{ color: COLORS.textSecondary }}>
                    No new identifier patterns found. Your transactions may not have recurring patterns, or existing identifiers already cover them.
                  </p>
                </div>
              ) : (
                Object.entries(groupedIdentifiers).map(([categoryId, identifiers]) => {
                  const parent = getParentCategory(categoryId);
                  return (
                    <div
                      key={categoryId}
                      style={{
                        backgroundColor: `${parent.color}08`,
                        border: `2px solid ${parent.color}30`,
                        borderRadius: '12px',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Category header */}
                      <div style={{
                        padding: '0.875rem 1rem',
                        backgroundColor: `${parent.color}15`,
                        borderBottom: `1px solid ${parent.color}30`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        <span style={{ fontSize: '1.25rem' }}>{parent.icon}</span>
                        <span style={{ fontSize: '1rem', fontWeight: 600, color: COLORS.textPrimary }}>
                          {parent.name}
                        </span>
                        <span style={{
                          marginLeft: 'auto',
                          fontSize: '0.8125rem',
                          color: COLORS.textSecondary,
                          backgroundColor: COLORS.white,
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px'
                        }}>
                          {identifiers.length} identifier{identifiers.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Identifiers list */}
                      <div style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {identifiers.map((item, idx) => (
                            <div
                              key={idx}
                              style={{
                                backgroundColor: COLORS.white,
                                border: `1px solid ${COLORS.borderLight}`,
                                borderRadius: '8px',
                                padding: '0.625rem 0.875rem'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                <Plus style={{ width: '12px', height: '12px', color: COLORS.incomeColor }} />
                                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: COLORS.textPrimary }}>
                                  {item.identifier}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.6875rem', color: COLORS.textSecondary }}>
                                From: "{item.userCategory}" • {item.transactionCount} txns
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

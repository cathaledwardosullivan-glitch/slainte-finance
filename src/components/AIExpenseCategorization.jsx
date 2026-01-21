import React, { useState, useEffect } from 'react';
import { DollarSign, Plus, X, CheckCircle, Loader, TrendingUp, AlertCircle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import COLORS from '../utils/colors';
import SimpleCategoryPicker from './SimpleCategoryPicker';
import { callClaude } from '../utils/claudeAPI';
import { PARENT_CATEGORIES } from '../utils/parentCategoryMapping';

/**
 * AIExpenseCategorization
 *
 * Analyzes unidentified transactions to identify recurring vs one-off expenses
 * and suggests categories for recurring patterns.
 */
export default function AIExpenseCategorization({ onClose, initialApiKey = '', hideApiKeyInput = false }) {
  const {
    unidentifiedTransactions,
    categoryMapping,
    setCategoryMapping,
    getAICorrectionsPrompt,
    recordAICorrection
  } = useAppContext();

  const [apiKey, setApiKey] = useState(initialApiKey);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recurringPatterns, setRecurringPatterns] = useState([]);
  const [oneOffCount, setOneOffCount] = useState(0);
  const [appliedSuggestions, setAppliedSuggestions] = useState(new Set());
  const [error, setError] = useState(null);
  const [editingCategory, setEditingCategory] = useState(new Map()); // index -> selectedCategoryCode

  // Batch processing state
  const [allRecurringGroups, setAllRecurringGroups] = useState([]); // All patterns waiting to be processed
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);

  // Update API key when initialApiKey prop changes
  useEffect(() => {
    const loadApiKey = async () => {
      if (initialApiKey) {
        setApiKey(initialApiKey);
      } else {
        // Check Electron storage first, then localStorage
        let savedKey = null;
        if (window.electronAPI?.isElectron) {
          savedKey = await window.electronAPI.getLocalStorage('claude_api_key');
        }
        if (!savedKey) {
          savedKey = localStorage.getItem('anthropic_api_key');
        }
        if (savedKey) {
          setApiKey(savedKey);
        }
      }
    };
    loadApiKey();
  }, [initialApiKey]);

  // Auto-close when all suggestions are applied
  useEffect(() => {
    // Only auto-close if we had patterns and now they're all applied (not just initial state)
    if (recurringPatterns.length === 0 && !isAnalyzing && !error && appliedSuggestions.size > 0) {
      // Small delay to let user see the last action complete
      const timer = setTimeout(() => {
        onClose();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [recurringPatterns.length, isAnalyzing, error, appliedSuggestions.size, onClose]);

  const analyzeExpensePatterns = async () => {
    if (!apiKey) {
      setError('Please enter your license key');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      // Save API key for future use
      localStorage.setItem('anthropic_api_key', apiKey);

      // PHASE 1: Pre-filter transactions to find potential recurring patterns
      // IMPORTANT: Uses EXACT SAME logic as TransactionList.jsx groupUnidentifiedTransactions()
      const extractPattern = (details) => {
        if (!details) return '';

        // Try to extract numeric/alphanumeric patterns (like "01-101020000089" -> "01-10102000")
        // This removes trailing digits that might change between transactions
        const numericPatternMatch = details.match(/[\d\-]{8,}/);
        if (numericPatternMatch) {
          const numericStr = numericPatternMatch[0];
          // Keep the prefix (at least 70% of the string) as the pattern
          const keepLength = Math.floor(numericStr.length * 0.7);
          if (keepLength >= 6) {
            return numericStr.substring(0, keepLength);
          }
        }

        // Try word-based extraction as fallback
        const words = details.split(/\s+/).filter(word => {
          const upper = word.toUpperCase();
          return word.length >= 4 &&
            !['THE', 'AND', 'FOR', 'WITH', 'FROM', 'LTD', 'LIMITED', 'INC', 'CORP'].includes(upper) &&
            !upper.startsWith('POS') &&
            !/^POS\d/.test(upper);
        });
        if (words.length > 0) {
          return words.sort((a, b) => b.length - a.length)[0].toUpperCase();
        }
        return '';
      };

      // Count patterns across ALL unidentified transactions
      const patternCounts = new Map();
      unidentifiedTransactions.forEach(t => {
        const pattern = extractPattern(t.details);
        if (pattern) {
          patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
        }
      });

      // Identify repeating patterns (2+ occurrences)
      const repeatingTransactions = [];
      const oneOffTransactions = [];

      unidentifiedTransactions.forEach(t => {
        const pattern = extractPattern(t.details);
        const count = patternCounts.get(pattern) || 0;
        if (count >= 2) {
          repeatingTransactions.push({
            ...t,
            pattern,
            patternCount: count
          });
        } else {
          oneOffTransactions.push(t);
        }
      });

      // Group repeating transactions by pattern for AI analysis
      const patternGroups = new Map();
      repeatingTransactions.forEach(t => {
        if (!patternGroups.has(t.pattern)) {
          patternGroups.set(t.pattern, []);
        }
        patternGroups.get(t.pattern).push({
          date: t.date,
          details: t.details,
          amount: t.debit || t.credit || 0
        });
      });

      // Helper function to find longest common substring across all transaction details
      const findLongestCommonSubstring = (transactions) => {
        if (transactions.length === 0) return '';
        if (transactions.length === 1) return transactions[0].details.trim();

        // Get all detail strings and convert to uppercase for comparison
        const details = transactions.map(t => t.details.toUpperCase().trim());

        // Use the LONGEST string as our search space (not shortest!)
        // This ensures we find the longest possible common substring
        const longest = details.reduce((max, str) => str.length > max.length ? str : max);

        // Generate all possible substrings from longest string, ordered by length (descending)
        const candidates = [];
        for (let length = longest.length; length >= 4; length--) {
          for (let start = 0; start <= longest.length - length; start++) {
            const candidate = longest.substring(start, start + length).trim();

            // Only consider candidates that are at least 4 chars after trimming
            if (candidate.length >= 4) {
              candidates.push(candidate);
            }
          }
        }

        // Find the first (longest) substring that appears in ALL transaction details
        let bestMatch = '';
        for (const candidate of candidates) {
          if (details.every(detail => detail.includes(candidate))) {
            bestMatch = candidate;
            break;
          }
        }

        // Clean the identifier: remove date patterns from start
        const cleanIdentifier = (identifier) => {
          let cleaned = identifier.trim();

          // Remove common date patterns from the START only
          // Month abbreviations (JAN, FEB, MAR, etc.)
          const monthPattern = /^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*/;
          cleaned = cleaned.replace(monthPattern, '');

          // Remove day numbers at start (01-31, 1-31)
          cleaned = cleaned.replace(/^(0?[1-9]|[12][0-9]|3[01])\s*/, '');

          // Remove year patterns at start (2023, 23, etc.)
          cleaned = cleaned.replace(/^(20\d{2}|'\d{2}|\d{2})\s*/, '');

          // Remove "POS" prefix if followed by date-like patterns
          cleaned = cleaned.replace(/^POS\d{1,2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*/, '');

          return cleaned.trim();
        };

        const cleanedIdentifier = cleanIdentifier(bestMatch);

        // Return cleaned identifier if still long enough, otherwise return original
        if (cleanedIdentifier.length >= 4) {
          return cleanedIdentifier;
        }

        // Fallback to original first transaction detail if cleaning made it too short
        return bestMatch || transactions[0].details.trim();
      };

      // Convert to array format for AI analysis
      const recurringGroups = Array.from(patternGroups.entries())
        .map(([initialPattern, transactions]) => {
          // Find the longest common substring across all transactions in this group
          const refinedCoreId = findLongestCommonSubstring(transactions);

          return {
            coreId: refinedCoreId,
            initialPattern, // Keep original for debugging
            transactions,
            count: transactions.length,
            avgAmount: transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / transactions.length,
            sampleTransactions: transactions.slice(0, 3) // Keep first 3 as samples
          };
        })
        .sort((a, b) => b.count - a.count); // Sort by frequency

      const oneOffCount = oneOffTransactions.length;

      // Log identifier improvements
      recurringGroups.forEach(group => {
        if (group.initialPattern !== group.coreId) {
          console.log(`🔍 Refined identifier: "${group.initialPattern}" → "${group.coreId}" (${group.count}x)`);
        }
      });

      console.log(`📊 Pre-filter results: ${recurringGroups.length} recurring patterns, ${oneOffCount} one-offs`);

      // If no recurring patterns found, return early
      if (recurringGroups.length === 0) {
        setRecurringPatterns([]);
        setOneOffCount(oneOffCount);
        setError('No recurring patterns found. All transactions appear to be one-offs.');
        setIsAnalyzing(false);
        return;
      }

      // PHASE 2: Separate income vs expense patterns
      // If ALL transactions in a pattern are credits (income), categorize directly as Income
      // Only send expense patterns to AI

      const incomePatterns = [];
      const expenseGroups = [];

      recurringGroups.forEach(group => {
        // Check if ALL transactions in this pattern are income
        // Transactions have isIncome property, or we check: credit > 0 (income) vs debit > 0 (expense)
        const allIncome = group.transactions.every(t => {
          // Use transaction's original data from unidentifiedTransactions
          const originalTx = unidentifiedTransactions.find(ut => ut.details === t.details);
          if (originalTx?.isIncome !== undefined) {
            return originalTx.isIncome === true;
          }
          // Fallback: credit > 0 means income
          return (t.credit > 0 || t.amount > 0) && (t.debit === 0 || !t.debit);
        });

        if (allIncome) {
          // This is income - auto-apply directly (no user confirmation needed)
          const incomeCategory = categoryMapping.find(c => c.code === '1.0');
          if (incomeCategory) {
            // Check if identifier already exists
            const identifierExists = incomeCategory.identifiers.some(id =>
              id.toLowerCase() === group.coreId.toLowerCase()
            );

            if (!identifierExists) {
              // Auto-add identifier to Income category
              const updatedCategory = {
                ...incomeCategory,
                identifiers: [...incomeCategory.identifiers, group.coreId]
              };

              const categoryIndex = categoryMapping.findIndex(c => c.code === '1.0');
              const updatedMapping = [...categoryMapping];
              updatedMapping[categoryIndex] = updatedCategory;
              setCategoryMapping(updatedMapping);

              incomePatterns.push({
                pattern: group.coreId,
                count: group.count,
                avgAmount: group.avgAmount
              });

              console.log(`✓ Auto-applied income pattern: "${group.coreId}" (${group.count}x, avg €${group.avgAmount.toFixed(0)})`);
            }
          }
        } else {
          // This is an expense - send to AI
          expenseGroups.push(group);
        }
      });

      console.log(`💰 Auto-categorized ${incomePatterns.length} income patterns, sending ${expenseGroups.length} expense patterns to AI`);

      // If only income patterns (no expenses), we're done
      if (expenseGroups.length === 0) {
        setRecurringPatterns([]); // Don't show as suggestions - already applied
        setOneOffCount(oneOffCount);
        setAllRecurringGroups([]);
        setTotalBatches(0);
        setCurrentBatch(0);

        // Show success message about auto-applied income
        if (incomePatterns.length > 0) {
          setError(`✓ Auto-applied ${incomePatterns.length} income patterns. No expense patterns found.`);
        }

        console.log(`✓ All ${incomePatterns.length} patterns were income - auto-applied, no AI analysis needed`);
        setIsAnalyzing(false);
        return;
      }

      // PHASE 3: Send expense patterns to AI for PARENT CATEGORY categorization
      // Simplified approach: Only categorize to 7 parent categories (not detailed subcategories)
      // Process FIRST batch only - user can continue with "Process Next Batch" button

      // Get staff member names to filter out
      const staffNames = categoryMapping
        .filter(c => c.personalization === 'Personalized' && c.staffMember)
        .map(c => c.staffMember)
        .filter(Boolean);

      // Create SIMPLIFIED prompt template for Claude - only parent categories
      const parentCategoriesForPrompt = Object.values(PARENT_CATEGORIES)
        .filter(p => p.id !== 'INCOME'); // Only expense categories

      // Process expense patterns in batches of 80 (to stay under 8k token limit)
      const BATCH_SIZE = 80;
      const totalBatchCount = Math.ceil(expenseGroups.length / BATCH_SIZE);

      // Store all expense groups for incremental processing
      setAllRecurringGroups(expenseGroups);
      setTotalBatches(totalBatchCount);
      setCurrentBatch(1);

      // Process ONLY the first batch
      const batch = expenseGroups.slice(0, BATCH_SIZE);
      console.log(`🔄 Processing batch 1/${totalBatchCount} (${batch.length} expense patterns)`);

      // Get AI learning corrections to improve suggestions
      const learningPrompt = getAICorrectionsPrompt('expense_categorization', 15);

      const prompt = `Categorize these ${batch.length} recurring expense patterns into PARENT CATEGORIES ONLY.${learningPrompt}

PARENT CATEGORIES (choose one for each pattern):
${parentCategoriesForPrompt.map(c =>
  `${c.id} - ${c.name}: ${c.description}`
).join('\n')}

CATEGORY GUIDANCE FOR GP PRACTICES:
- MEDICAL: Includes ALL clinical supplies + staff uniforms/workwear/scrubs/PPE (anything worn by medical staff)
- PREMISES: Rent, utilities (ESB, Bord Gais), cleaning, waste disposal, building maintenance
- OFFICE_IT: Stationery, phones, software subscriptions, IT support, computers
- PROFESSIONAL: Accountants, legal, bank charges, ICGP, Medical Council, insurance, CPD
- STAFF: Only for salary/wage payments to individuals
- OTHER: Anything that doesn't fit above (sundries, personal, capital items)

PATTERNS TO CATEGORIZE (Ignore staff names: ${staffNames.join(', ')}):
${batch.map((g, idx) =>
  `${idx + 1}. "${g.coreId}" (${g.count}x, avg €${g.avgAmount.toFixed(0)})`
).join('\n')}

Return JSON ONLY with parent category assignments:
{
  "patterns": [
    {
      "pattern": "ESB",
      "parentCategory": "PREMISES",
      "confidence": "high",
      "reasoning": "Utility bill - electricity"
    }
  ]
}

IMPORTANT:
- Assign ONLY parent categories (STAFF, MEDICAL, PREMISES, OFFICE_IT, PROFESSIONAL, OTHER)
- Do NOT suggest specific subcategories
- Return ALL ${batch.length} patterns
- Use "STAFF" for salary/wage patterns
- Uniform/workwear suppliers go to MEDICAL not OFFICE_IT
- Be concise with reasoning`;

      // Call Claude API for first batch only
      const response = await callClaude(prompt, {
        model: 'claude-haiku-4-5-20251001',
        maxTokens: 8000, // Max for Haiku 4.5
        apiKey: apiKey
      });

      if (!response.success) {
        const errorMsg = response.error || 'API request failed';

        // Handle Anthropic overload error with user-friendly message
        if (errorMsg.includes('overload')) {
          throw new Error('Anthropic API is currently overloaded. Please wait 30 seconds and try again.');
        }

        throw new Error(errorMsg);
      }

      const resultText = response.content.trim();

      // Parse JSON response
      let parsedResult;
      try {
        // Remove markdown code blocks if present
        let jsonText = resultText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        // Try to extract JSON object if there's text before it
        const objectMatch = jsonText.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          jsonText = objectMatch[0];
        }

        parsedResult = JSON.parse(jsonText);
      } catch (parseError) {
        console.error('Failed to parse batch 1 response:', resultText);
        throw new Error('AI returned invalid format. Please try again.');
      }

      // Enrich AI results with sample transactions and convert parent categories to codes
      const enrichedPatterns = (parsedResult.patterns || []).map(aiPattern => {
        // Find matching recurring group to get sample transactions and stats
        const matchingGroup = expenseGroups.find(g =>
          g.coreId.toLowerCase() === aiPattern.pattern.toLowerCase() ||
          aiPattern.pattern.toLowerCase().includes(g.coreId.toLowerCase())
        );

        // Convert parent category ID to default category code (e.g., "PREMISES" → "20.0")
        const parentCategoryId = aiPattern.parentCategory;
        const parentCategory = PARENT_CATEGORIES[parentCategoryId];
        const defaultCategoryCode = parentCategory?.defaultCategory || '80.0'; // Fallback to Other

        // Find the category details from mapping
        const category = categoryMapping.find(c => c.code === defaultCategoryCode);

        return {
          pattern: aiPattern.pattern,
          suggestedCategory: defaultCategoryCode,
          categoryName: category?.name || 'Unknown',
          confidence: aiPattern.confidence,
          reasoning: aiPattern.reasoning,
          isExisting: true, // All parent categories exist in the system
          frequency: matchingGroup ? `${matchingGroup.count} times` : 'Multiple',
          occurrences: matchingGroup?.count || 0,
          averageAmount: matchingGroup?.avgAmount || 0,
          sampleTransactions: matchingGroup?.sampleTransactions || []
        };
      });

      // Only show expense patterns as suggestions (income already auto-applied)
      setRecurringPatterns(enrichedPatterns);
      setOneOffCount(oneOffCount); // Use the pre-calculated one-off count

      // Show info message about auto-applied income
      if (incomePatterns.length > 0) {
        setError(`✓ Auto-applied ${incomePatterns.length} income patterns. Review ${enrichedPatterns.length} expense suggestions below.`);
      }

      if (enrichedPatterns.length === 0 && incomePatterns.length === 0) {
        setError('No recurring patterns found. Your transactions appear to be mostly one-off.');
      }

      console.log(`✓ Auto-applied ${incomePatterns.length} income + categorized ${enrichedPatterns.length} expense patterns (${incomePatterns.length + enrichedPatterns.length} total)`);

    } catch (err) {
      console.error('AI analysis error:', err);
      setError(err.message || 'Failed to analyze patterns. Please check your API key and try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const createIndividualStaffCategory = (roleCode, pattern, index) => {
    // Extract staff name from the pattern
    // Pattern might be like "LEANN", "LEANN SALARY", "TO LEANN", etc.
    const nameParts = pattern.split(/\s+/);
    let staffName = nameParts[0]; // Default to first word

    // Clean up common words
    const commonWords = ['SALARY', 'WAGES', 'PAYMENT', 'TO', 'FROM', 'FOR'];
    const meaningfulWords = nameParts.filter(word =>
      !commonWords.includes(word.toUpperCase()) &&
      word.length >= 3
    );

    if (meaningfulWords.length > 0) {
      staffName = meaningfulWords[0];
    }

    // Capitalize first letter, rest lowercase
    staffName = staffName.charAt(0).toUpperCase() + staffName.slice(1).toLowerCase();

    // Map role code to role name
    const roleNames = {
      '3': 'Reception',
      '4': 'Nurse',
      '5': 'Phlebotomist',
      '6': 'GP Assistant',
      '7': 'Practice Manager'
    };
    const roleName = roleNames[roleCode] || 'Staff Member';

    // Confirm with user
    const confirmed = window.confirm(
      `Create new individual staff category?\n\n` +
      `Role: ${roleName}\n` +
      `Name: ${staffName}\n` +
      `Identifier: ${pattern}\n\n` +
      `This will create a new category like "${roleName} - ${staffName}"`
    );

    if (!confirmed) return;

    // Find the next available code for this role
    const existingCodes = categoryMapping
      .filter(c => c.code.startsWith(`${roleCode}.`))
      .map(c => {
        const parts = c.code.split('.');
        return parts.length > 1 ? parseInt(parts[1]) : 0;
      });

    const nextIndex = existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : 1;
    const newCode = `${roleCode}.${nextIndex}`;

    // Check if this code already exists
    if (categoryMapping.some(c => c.code === newCode)) {
      alert(`Category code ${newCode} already exists. Please try again.`);
      return;
    }

    // Create the new category
    const newCategory = {
      code: newCode,
      name: `${roleName} - ${staffName}`,
      description: `Individual ${roleName.toLowerCase()} salary`,
      identifiers: [pattern],
      accountantLine: 'Receptionists Salaries and Social Welfare',
      type: 'expense',
      personalization: 'Personalized',
      role: roleCode,
      staffMember: staffName,
      section: 'DIRECT STAFF COSTS'
    };

    // Add to category mapping
    const updatedMapping = [...categoryMapping, newCategory];
    setCategoryMapping(updatedMapping);

    // Mark as applied
    setAppliedSuggestions(prev => new Set([...prev, index]));

    // Remove from editing mode
    setEditingCategory(prev => {
      const newMap = new Map(prev);
      newMap.delete(index);
      return newMap;
    });

    console.log(`✓ Created new staff category: ${newCode} - ${newCategory.name}`);

    // Remove pattern from list
    setRecurringPatterns(prev => prev.filter((_, i) => i !== index));
  };

  const applySuggestion = (pattern, index) => {
    // Check if user has selected a different category
    const selectedCategoryCode = editingCategory.get(index);

    // If editing mode is active (user clicked "Choose Category" or is selecting from dropdown)
    if (editingCategory.has(index) && selectedCategoryCode) {
      // Add identifiers to selected category
      const categoryIndex = categoryMapping.findIndex(c => c.code === selectedCategoryCode);
      if (categoryIndex === -1) {
        alert('Category not found. Please refresh and try again.');
        return;
      }

      const category = categoryMapping[categoryIndex];

      // Check if this is a general staff category (3, 4, 5, 6, 7)
      // If so, create a new individual staff member category instead
      if (['3', '4', '5', '6', '7'].includes(category.code)) {
        createIndividualStaffCategory(category.code, pattern.pattern, index);
        return;
      }

      const newIdentifier = pattern.pattern;

      // Check if identifier already exists
      if (category.identifiers.some(id => id.toLowerCase() === newIdentifier.toLowerCase())) {
        alert('This identifier already exists in the category.');
        return;
      }

      // Update category
      const updatedCategory = {
        ...category,
        identifiers: [...category.identifiers, newIdentifier]
      };

      const updatedMapping = [...categoryMapping];
      updatedMapping[categoryIndex] = updatedCategory;
      setCategoryMapping(updatedMapping);

      console.log(`✓ Added identifier "${newIdentifier}" to ${category.name}`);

      // Record AI learning if user chose different category than AI suggested
      if (pattern.isExisting && selectedCategoryCode !== pattern.suggestedCategory) {
        const aiSuggestedCategory = categoryMapping.find(c => c.code === pattern.suggestedCategory);
        const parentCatAI = Object.values(PARENT_CATEGORIES).find(p => p.defaultCategory === pattern.suggestedCategory);
        const parentCatUser = Object.values(PARENT_CATEGORIES).find(p => p.defaultCategory === selectedCategoryCode);

        recordAICorrection(
          'expense_categorization',
          pattern.pattern,
          {
            code: pattern.suggestedCategory,
            name: aiSuggestedCategory?.name || 'Unknown',
            parentCategory: parentCatAI?.id || 'OTHER'
          },
          {
            code: category.code,
            name: category.name,
            parentCategory: parentCatUser?.id || 'OTHER'
          },
          {
            amount: pattern.averageAmount,
            occurrences: pattern.occurrences
          }
        );
      }

      // Remove pattern from list after successfully applying
      setRecurringPatterns(prev => prev.filter((_, i) => i !== index));

      // Clear editing state
      setEditingCategory(prev => {
        const newMap = new Map(prev);
        newMap.delete(index);
        return newMap;
      });
    } else if (pattern.isExisting) {
      // Existing category match - add directly
      const categoryIndex = categoryMapping.findIndex(c => c.code === pattern.suggestedCategory);
      if (categoryIndex === -1) {
        alert('Category not found. Please refresh and try again.');
        return;
      }

      const category = categoryMapping[categoryIndex];
      const newIdentifier = pattern.pattern;

      // Check if identifier already exists
      if (category.identifiers.some(id => id.toLowerCase() === newIdentifier.toLowerCase())) {
        alert('This identifier already exists in the category.');
        return;
      }

      // Update category
      const updatedCategory = {
        ...category,
        identifiers: [...category.identifiers, newIdentifier]
      };

      const updatedMapping = [...categoryMapping];
      updatedMapping[categoryIndex] = updatedCategory;
      setCategoryMapping(updatedMapping);

      console.log(`✓ Added identifier "${newIdentifier}" to ${category.name}`);

      // Remove pattern from list after successfully applying
      setRecurringPatterns(prev => prev.filter((_, i) => i !== index));
    } else {
      // Show category selection dropdown for new category suggestions
      setEditingCategory(prev => {
        const newMap = new Map(prev);
        // Set to first available category by default (include staff categories)
        const firstCategory = categoryMapping.find(c =>
          c.type === 'expense' &&
          c.personalization !== 'Personalized' &&
          !['90'].includes(c.role) // Only exclude partner drawings
        );
        newMap.set(index, firstCategory?.code || '');
        return newMap;
      });
    }
  };

  const updateCategorySelection = (index, categoryCode) => {
    setEditingCategory(prev => {
      const newMap = new Map(prev);
      newMap.set(index, categoryCode);
      return newMap;
    });
  };

  const dismissSuggestion = (index) => {
    setRecurringPatterns(prev => prev.filter((_, i) => i !== index));
  };

  const processNextBatch = async () => {
    if (currentBatch >= totalBatches) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const BATCH_SIZE = 80;
      const startIndex = currentBatch * BATCH_SIZE;
      const batch = allRecurringGroups.slice(startIndex, startIndex + BATCH_SIZE);

      console.log(`🔄 Processing batch ${currentBatch + 1}/${totalBatches} (${batch.length} patterns)`);

      // Get staff member names
      const staffNames = categoryMapping
        .filter(c => c.personalization === 'Personalized' && c.staffMember)
        .map(c => c.staffMember)
        .filter(Boolean);

      const parentCategoriesForPrompt = Object.values(PARENT_CATEGORIES)
        .filter(p => p.id !== 'INCOME');

      // Get AI learning corrections to improve suggestions
      const learningPrompt = getAICorrectionsPrompt('expense_categorization', 15);

      const prompt = `Categorize these ${batch.length} recurring expense patterns into PARENT CATEGORIES ONLY.${learningPrompt}

PARENT CATEGORIES (choose one for each pattern):
${parentCategoriesForPrompt.map(c =>
  `${c.id} - ${c.name}: ${c.description}`
).join('\n')}

CATEGORY GUIDANCE FOR GP PRACTICES:
- MEDICAL: Includes ALL clinical supplies + staff uniforms/workwear/scrubs/PPE (anything worn by medical staff)
- PREMISES: Rent, utilities (ESB, Bord Gais), cleaning, waste disposal, building maintenance
- OFFICE_IT: Stationery, phones, software subscriptions, IT support, computers
- PROFESSIONAL: Accountants, legal, bank charges, ICGP, Medical Council, insurance, CPD
- STAFF: Only for salary/wage payments to individuals
- OTHER: Anything that doesn't fit above (sundries, personal, capital items)

PATTERNS TO CATEGORIZE (Ignore staff names: ${staffNames.join(', ')}):
${batch.map((g, idx) =>
  `${idx + 1}. "${g.coreId}" (${g.count}x, avg €${g.avgAmount.toFixed(0)})`
).join('\n')}

Return JSON ONLY with parent category assignments:
{
  "patterns": [
    {
      "pattern": "ESB",
      "parentCategory": "PREMISES",
      "confidence": "high",
      "reasoning": "Utility bill - electricity"
    }
  ]
}

IMPORTANT:
- Assign ONLY parent categories (STAFF, MEDICAL, PREMISES, OFFICE_IT, PROFESSIONAL, OTHER)
- Do NOT suggest specific subcategories
- Return ALL ${batch.length} patterns
- Use "STAFF" for salary/wage patterns
- Uniform/workwear suppliers go to MEDICAL not OFFICE_IT
- Be concise with reasoning`;

      const response = await callClaude(prompt, {
        model: 'claude-haiku-4-5-20251001',
        maxTokens: 8000,
        apiKey: apiKey
      });

      if (!response.success) {
        throw new Error(response.error || 'API request failed');
      }

      let parsedResult;
      try {
        let jsonText = response.content.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const objectMatch = jsonText.match(/\{[\s\S]*\}/);
        if (objectMatch) jsonText = objectMatch[0];
        parsedResult = JSON.parse(jsonText);
      } catch (parseError) {
        console.error(`Failed to parse batch ${currentBatch + 1} response:`, response.content);
        throw new Error('AI returned invalid format. Please try again.');
      }

      // Enrich and add to existing patterns
      const enrichedPatterns = (parsedResult.patterns || []).map(aiPattern => {
        const matchingGroup = allRecurringGroups.find(g =>
          g.coreId.toLowerCase() === aiPattern.pattern.toLowerCase() ||
          aiPattern.pattern.toLowerCase().includes(g.coreId.toLowerCase())
        );

        const parentCategoryId = aiPattern.parentCategory;
        const parentCategory = PARENT_CATEGORIES[parentCategoryId];
        const defaultCategoryCode = parentCategory?.defaultCategory || '80.0';
        const category = categoryMapping.find(c => c.code === defaultCategoryCode);

        return {
          pattern: aiPattern.pattern,
          suggestedCategory: defaultCategoryCode,
          categoryName: category?.name || 'Unknown',
          confidence: aiPattern.confidence,
          reasoning: aiPattern.reasoning,
          isExisting: true,
          frequency: matchingGroup ? `${matchingGroup.count} times` : 'Multiple',
          occurrences: matchingGroup?.count || 0,
          averageAmount: matchingGroup?.avgAmount || 0,
          sampleTransactions: matchingGroup?.sampleTransactions || []
        };
      });

      // Add new patterns to existing (income patterns are already at the start)
      setRecurringPatterns(prev => [...prev, ...enrichedPatterns]);
      setCurrentBatch(prev => prev + 1);
      console.log(`✓ AI categorized ${enrichedPatterns.length} expense patterns (batch ${currentBatch + 1}/${totalBatches})`);

    } catch (err) {
      console.error('AI analysis error:', err);
      setError(err.message || 'Failed to analyze next batch.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" style={{ overflow: 'auto' }}>
      <div className="bg-white rounded-lg shadow-xl w-full flex flex-col" style={{ maxWidth: '56rem', maxHeight: '90vh', overflow: 'hidden' }}>
        {/* Fixed Header */}
        <div className="p-6 border-b" style={{ flexShrink: 0 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DollarSign className="h-6 w-6" style={{ color: COLORS.slainteBlue }} />
              <h2 className="text-2xl font-bold" style={{ color: COLORS.darkGray }}>
                AI Expense Categorization
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded"
              style={{ color: COLORS.mediumGray }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {/* Description */}
          <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: `${COLORS.slainteBlue}15` }}>
            <p className="text-sm" style={{ color: COLORS.darkGray }}>
              Our AI will analyze your unidentified transactions to identify recurring expense patterns
              (utilities, subscriptions, professional fees, etc.) and suggest appropriate categories.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 rounded-lg" style={{ backgroundColor: COLORS.backgroundGray }}>
              <p className="text-sm" style={{ color: COLORS.mediumGray }}>Unidentified Transactions</p>
              <p className="text-2xl font-bold" style={{ color: COLORS.highlightYellow }}>
                {unidentifiedTransactions.length}
              </p>
            </div>
            <div className="p-4 rounded-lg" style={{ backgroundColor: COLORS.backgroundGray }}>
              <p className="text-sm" style={{ color: COLORS.mediumGray }}>Expense Categories</p>
              <p className="text-2xl font-bold" style={{ color: COLORS.slainteBlue }}>
                {categoryMapping.filter(c => c.type === 'expense' && c.personalization !== 'Personalized').length}
              </p>
            </div>
          </div>

          {/* License Key Input */}
          {!hideApiKeyInput && !recurringPatterns.length && !isAnalyzing && appliedSuggestions.size === 0 && (
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2" style={{ color: COLORS.darkGray }}>
                Sláinte License Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your license key"
                className="w-full border rounded-lg px-4 py-2 mb-2"
                style={{ borderColor: COLORS.lightGray }}
              />
              <p className="text-xs" style={{ color: COLORS.mediumGray }}>
                Your license key is stored locally.
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 rounded-lg border-2" style={{ backgroundColor: `${COLORS.expenseColor}10`, borderColor: COLORS.expenseColor }}>
              <p className="text-sm" style={{ color: COLORS.expenseColor }}>{error}</p>
            </div>
          )}

          {/* Analyze Button */}
          {!recurringPatterns.length && !isAnalyzing && appliedSuggestions.size === 0 && (
            <button
              onClick={analyzeExpensePatterns}
              disabled={!apiKey || unidentifiedTransactions.length === 0}
              className="w-full py-3 rounded-lg text-white font-medium flex items-center justify-center gap-2"
              style={{
                backgroundColor: (apiKey && unidentifiedTransactions.length > 0) ? COLORS.slainteBlue : COLORS.lightGray,
                cursor: (apiKey && unidentifiedTransactions.length > 0) ? 'pointer' : 'not-allowed'
              }}
            >
              <TrendingUp className="h-5 w-5" />
              Analyze Expense Patterns
            </button>
          )}

          {/* Loading State */}
          {isAnalyzing && (
            <div className="text-center py-12">
              <Loader className="h-12 w-12 animate-spin mx-auto mb-4" style={{ color: COLORS.slainteBlue }} />
              <p className="text-lg font-medium" style={{ color: COLORS.darkGray }}>
                Analyzing recurring expense patterns...
              </p>
              <p className="text-sm mt-2" style={{ color: COLORS.mediumGray }}>
                This may take 15-45 seconds
              </p>
            </div>
          )}

          {/* Results */}
          {recurringPatterns.length > 0 && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border-2" style={{ borderColor: COLORS.slainteBlue, backgroundColor: `${COLORS.slainteBlue}10` }}>
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-5 w-5" style={{ color: COLORS.slainteBlue }} />
                    <p className="text-sm font-medium" style={{ color: COLORS.slainteBlue }}>Recurring Patterns</p>
                  </div>
                  <p className="text-2xl font-bold" style={{ color: COLORS.slainteBlue }}>
                    {recurringPatterns.length}
                  </p>
                </div>
                <div className="p-4 rounded-lg border-2" style={{ borderColor: COLORS.mediumGray, backgroundColor: COLORS.backgroundGray }}>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="h-5 w-5" style={{ color: COLORS.mediumGray }} />
                    <p className="text-sm font-medium" style={{ color: COLORS.mediumGray }}>One-Off Expenses</p>
                  </div>
                  <p className="text-2xl font-bold" style={{ color: COLORS.mediumGray }}>
                    {oneOffCount}
                  </p>
                </div>
              </div>

              {/* Batch Progress & Continue Button */}
              {totalBatches > 1 && (
                <div className="p-4 rounded-lg border-2" style={{
                  borderColor: currentBatch < totalBatches ? COLORS.highlightYellow : COLORS.incomeColor,
                  backgroundColor: currentBatch < totalBatches ? `${COLORS.highlightYellow}10` : `${COLORS.incomeColor}10`
                }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium" style={{ color: COLORS.darkGray }}>
                        Batch Progress: {currentBatch}/{totalBatches}
                      </p>
                      <p className="text-xs mt-1" style={{ color: COLORS.mediumGray }}>
                        Showing {recurringPatterns.length} of {allRecurringGroups.length} total patterns
                      </p>
                    </div>
                    {currentBatch < totalBatches && (
                      <button
                        onClick={processNextBatch}
                        disabled={isAnalyzing}
                        className="px-6 py-2 rounded-lg text-white font-medium flex items-center gap-2"
                        style={{
                          backgroundColor: isAnalyzing ? COLORS.lightGray : COLORS.slainteBlue,
                          cursor: isAnalyzing ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {isAnalyzing ? (
                          <>
                            <Loader className="h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <TrendingUp className="h-4 w-4" />
                            Process Next Batch ({Math.min(80, allRecurringGroups.length - (currentBatch * 80))} patterns)
                          </>
                        )}
                      </button>
                    )}
                    {currentBatch >= totalBatches && (
                      <div className="flex items-center gap-2" style={{ color: COLORS.incomeColor }}>
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-medium">All batches processed</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <h3 className="font-semibold text-lg" style={{ color: COLORS.darkGray }}>
                Recurring Expense Patterns
                {totalBatches > 1 && currentBatch < totalBatches && (
                  <span className="text-sm font-normal ml-2" style={{ color: COLORS.mediumGray }}>
                    (Showing first {recurringPatterns.length})
                  </span>
                )}
              </h3>

              {/* Pattern List */}
              {recurringPatterns.map((pattern, index) => {
                const isApplied = appliedSuggestions.has(`${pattern.suggestedCategory}-${index}`);
                const isNewCategory = !pattern.isExisting;
                const isEditing = editingCategory.has(index);
                const selectedCategory = editingCategory.get(index);

                // Get available expense categories for dropdown (include staff categories)
                const availableCategories = categoryMapping.filter(c =>
                  c.type === 'expense' &&
                  c.personalization !== 'Personalized' && // Exclude already-personalized categories
                  !['90'].includes(c.role) // Only exclude partner drawings (include staff 3-7)
                );

                return (
                  <div
                    key={index}
                    className="border-2 rounded-lg p-4"
                    style={{
                      borderColor: isApplied ? COLORS.incomeColor : (isNewCategory ? COLORS.highlightYellow : COLORS.lightGray),
                      backgroundColor: isApplied ? `${COLORS.incomeColor}10` : (isNewCategory ? `${COLORS.highlightYellow}10` : COLORS.white)
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-base mb-1" style={{ color: COLORS.darkGray }}>
                          {pattern.pattern}
                        </h4>
                        {isNewCategory ? (
                          <p className="text-sm font-medium" style={{ color: COLORS.highlightYellow }}>
                            💡 New Category Suggested
                          </p>
                        ) : (
                          <div className="mt-2 p-2 rounded" style={{ backgroundColor: `${COLORS.slainteBlue}10`, border: `1px solid ${COLORS.slainteBlue}` }}>
                            <p className="text-xs font-medium mb-1" style={{ color: COLORS.mediumGray }}>
                              Suggested Category:
                            </p>
                            <p className="text-sm font-semibold" style={{ color: COLORS.slainteBlue }}>
                              {pattern.suggestedCategory} - {pattern.categoryName}
                            </p>
                          </div>
                        )}
                      </div>
                      {isApplied && (
                        <span className="flex items-center gap-1 text-sm" style={{ color: COLORS.incomeColor }}>
                          <CheckCircle className="h-4 w-4" />
                          Applied
                        </span>
                      )}
                    </div>

                    <div className="mb-3">
                      <div className="flex gap-4 text-xs mb-2" style={{ color: COLORS.mediumGray }}>
                        <span>Frequency: {pattern.frequency}</span>
                        <span>Occurrences: {pattern.occurrences}x</span>
                        <span>Avg: €{pattern.averageAmount?.toFixed(2)}</span>
                      </div>
                      <p className="text-sm mb-2" style={{ color: COLORS.mediumGray }}>
                        {pattern.reasoning}
                      </p>

                      {/* Sample Transactions */}
                      {pattern.sampleTransactions && pattern.sampleTransactions.length > 0 && (
                        <div className="mt-2 p-2 rounded" style={{ backgroundColor: COLORS.backgroundGray, border: `1px solid ${COLORS.lightGray}` }}>
                          <p className="text-xs font-medium mb-1" style={{ color: COLORS.darkGray }}>
                            Sample Transactions:
                          </p>
                          {pattern.sampleTransactions.map((tx, txIndex) => (
                            <div key={txIndex} className="text-xs mb-1" style={{ color: COLORS.mediumGray }}>
                              • {tx.details} - €{Math.abs(tx.amount).toFixed(2)}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Simplified Category Selection */}
                      {!isApplied && isEditing && (
                        <div className="mt-3">
                          <SimpleCategoryPicker
                            transaction={null}
                            onCategorySelect={(categoryCode) => updateCategorySelection(index, categoryCode)}
                            categoryMapping={categoryMapping}
                            showStaffMembers={true}
                          />

                          {/* Show selected category feedback - BELOW picker for visibility */}
                          {selectedCategory && (
                            <div className="mt-3 p-4 rounded-lg animate-pulse" style={{
                              backgroundColor: COLORS.incomeColor,
                              border: `3px solid ${COLORS.incomeColor}`,
                              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                            }}>
                              <div className="flex items-center gap-3">
                                <CheckCircle className="h-6 w-6 text-white flex-shrink-0" />
                                <div className="flex-1">
                                  <p className="text-xs font-semibold text-white uppercase tracking-wide mb-1">
                                    ✓ Category Selected
                                  </p>
                                  <p className="text-base font-bold text-white">
                                    {categoryMapping.find(c => c.code === selectedCategory)?.code} - {categoryMapping.find(c => c.code === selectedCategory)?.name}
                                  </p>
                                </div>
                              </div>
                              {pattern.isExisting && selectedCategory !== pattern.suggestedCategory && (
                                <p className="text-xs text-white opacity-90 mt-2 italic">
                                  → Using your selection instead of AI suggestion ({pattern.suggestedCategory} - {pattern.categoryName})
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {!isApplied && (
                      <div className="flex gap-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => applySuggestion(pattern, index)}
                              className="flex-1 px-4 py-2 rounded text-white font-medium flex items-center justify-center gap-2"
                              style={{ backgroundColor: COLORS.incomeColor }}
                            >
                              <Plus className="h-4 w-4" />
                              Add Identifier to Selected Category
                            </button>
                            <button
                              onClick={() => {
                                setEditingCategory(prev => {
                                  const newMap = new Map(prev);
                                  newMap.delete(index);
                                  return newMap;
                                });
                              }}
                              className="px-4 py-2 rounded border"
                              style={{ borderColor: COLORS.lightGray, color: COLORS.mediumGray }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            {!isNewCategory && (
                              <button
                                onClick={() => applySuggestion(pattern, index)}
                                className="flex-1 px-4 py-2 rounded text-white font-medium flex items-center justify-center gap-2"
                                style={{ backgroundColor: COLORS.incomeColor }}
                              >
                                <Plus className="h-4 w-4" />
                                Add This Identifier
                              </button>
                            )}
                            <button
                              onClick={() => {
                                // Show dropdown to choose category
                                setEditingCategory(prev => {
                                  const newMap = new Map(prev);
                                  const firstCategory = categoryMapping.find(c =>
                                    c.type === 'expense' &&
                                    c.personalization !== 'Personalized' &&
                                    !['90'].includes(c.role) // Only exclude partner drawings
                                  );
                                  newMap.set(index, pattern.suggestedCategory || firstCategory?.code || '');
                                  return newMap;
                                });

                              }}
                              className={`${isNewCategory ? 'flex-1' : ''} px-4 py-2 rounded font-medium flex items-center justify-center gap-2`}
                              style={{
                                backgroundColor: isNewCategory ? COLORS.highlightYellow : 'transparent',
                                color: isNewCategory ? COLORS.white : COLORS.slainteBlue,
                                border: isNewCategory ? 'none' : `2px solid ${COLORS.slainteBlue}`
                              }}
                            >
                              <Plus className="h-4 w-4" />
                              {isNewCategory ? 'Choose Category' : 'Choose Different Category'}
                            </button>
                            <button
                              onClick={() => dismissSuggestion(index)}
                              className="px-4 py-2 rounded border"
                              style={{ borderColor: COLORS.lightGray, color: COLORS.mediumGray }}
                            >
                              Dismiss
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* All suggestions applied - Success message */}
          {recurringPatterns.length === 0 && appliedSuggestions.size > 0 && unidentifiedTransactions.length > 0 && (
            <div className="text-center py-12">
              <CheckCircle className="h-16 w-16 mx-auto mb-4" style={{ color: COLORS.incomeColor }} />
              <p className="text-lg font-medium" style={{ color: COLORS.darkGray }}>
                Great work! All recurring patterns have been categorized.
              </p>
              <p className="text-sm mt-2" style={{ color: COLORS.mediumGray }}>
                {unidentifiedTransactions.length} one-off transactions remain. You can categorize these manually or click "Done" to continue.
              </p>
            </div>
          )}

          {/* No unidentified transactions */}
          {unidentifiedTransactions.length === 0 && !isAnalyzing && (
            <div className="text-center py-12">
              <CheckCircle className="h-16 w-16 mx-auto mb-4" style={{ color: COLORS.incomeColor }} />
              <p className="text-lg font-medium" style={{ color: COLORS.darkGray }}>
                All transactions are categorized!
              </p>
              <p className="text-sm mt-2" style={{ color: COLORS.mediumGray }}>
                Upload more transaction data to get AI suggestions.
              </p>
            </div>
          )}
        </div>

        {/* Fixed Footer - Show if patterns exist OR if any suggestions were applied */}
        {(recurringPatterns.length > 0 || appliedSuggestions.size > 0) && (
          <div className="p-6 border-t" style={{ flexShrink: 0, borderColor: COLORS.lightGray }}>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setRecurringPatterns([]);
                  setOneOffCount(0);
                  setAppliedSuggestions(new Set());
                }}
                className="px-4 py-2 rounded border"
                style={{ borderColor: COLORS.lightGray, color: COLORS.darkGray }}
              >
                Start Over
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded text-white"
                style={{ backgroundColor: COLORS.slainteBlue }}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

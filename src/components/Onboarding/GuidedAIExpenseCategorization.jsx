import React, { useState, useEffect } from 'react';
import { CheckCircle, ArrowRight, User, MessageCircle, TrendingUp, Loader, Plus, SkipForward, Users, Pill, Building2, Laptop, GraduationCap, MoreHorizontal, Coins } from 'lucide-react';
import COLORS from '../../utils/colors';
import { useAppContext } from '../../context/AppContext';
import { callClaude } from '../../utils/claudeAPI';
import { MODELS } from '../../data/modelConfig';
import { PARENT_CATEGORIES } from '../../utils/parentCategoryMapping';
import SimpleCategoryPicker from '../SimpleCategoryPicker';

// Instant text display (typing animation disabled)
const useTypingEffect = (text) => {
  return { displayedText: text || '', isComplete: true };
};

// Map parent category IDs to Lucide icons
const CATEGORY_ICONS = {
  INCOME: Coins,
  STAFF: Users,
  MEDICAL: Pill,
  PREMISES: Building2,
  OFFICE_IT: Laptop,
  PROFESSIONAL: GraduationCap,
  OTHER: MoreHorizontal
};

export default function GuidedAIExpenseCategorization({ onComplete }) {
  const { unidentifiedTransactions, categoryMapping, setCategoryMapping, getAICorrectionsPrompt, recordAICorrection } = useAppContext();
  const [isReady, setIsReady] = useState(false);
  const [apiKey, setApiKey] = useState('');

  const [showGreeting, setShowGreeting] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [showCategories, setShowCategories] = useState(false);

  // Analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [recurringPatterns, setRecurringPatterns] = useState([]);
  const [appliedSuggestions, setAppliedSuggestions] = useState(new Set());
  const [error, setError] = useState(null);
  const [editingCategory, setEditingCategory] = useState(new Map());

  // Batch processing
  const [allRecurringGroups, setAllRecurringGroups] = useState([]);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [oneOffCount, setOneOffCount] = useState(0);

  const greetingText = "Time to categorize your expenses!";
  const messageText = "I'll help you quickly sort your transactions into broad categories. This is Phase 1 - a quick overview. You can refine categories in more detail later from the main dashboard.";

  const { displayedText: greeting, isComplete: greetingComplete } = useTypingEffect(showGreeting ? greetingText : '', 25);
  const { displayedText: message, isComplete: messageComplete } = useTypingEffect(showMessage ? messageText : '', 15);

  // Load API key
  useEffect(() => {
    const loadApiKey = async () => {
      let savedApiKey = null;
      if (window.electronAPI?.isElectron) {
        savedApiKey = await window.electronAPI.getLocalStorage('claude_api_key');
      }
      if (!savedApiKey) {
        savedApiKey = localStorage.getItem('anthropic_api_key');
      }
      if (savedApiKey) {
        setApiKey(savedApiKey);
      }
    };
    loadApiKey();

    setTimeout(() => {
      setIsReady(true);
    }, 1000);
  }, []);

  // Animation sequence
  useEffect(() => {
    if (isReady) {
      const timer = setTimeout(() => setShowGreeting(true), 300);
      return () => clearTimeout(timer);
    }
  }, [isReady]);

  useEffect(() => {
    if (greetingComplete) {
      const timer = setTimeout(() => setShowMessage(true), 200);
      return () => clearTimeout(timer);
    }
  }, [greetingComplete]);

  useEffect(() => {
    if (messageComplete) {
      const timer = setTimeout(() => setShowCategories(true), 300);
      return () => clearTimeout(timer);
    }
  }, [messageComplete]);

  // AI Analysis function
  const startAnalysis = async () => {
    if (!apiKey) {
      setError('API key not found. Please check your settings.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      // Pre-filter transactions to find recurring patterns
      const extractPattern = (details) => {
        if (!details) return '';
        const numericPatternMatch = details.match(/[\d\-]{8,}/);
        if (numericPatternMatch) {
          const numericStr = numericPatternMatch[0];
          const keepLength = Math.floor(numericStr.length * 0.7);
          if (keepLength >= 6) {
            return numericStr.substring(0, keepLength);
          }
        }
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

      const patternCounts = new Map();
      unidentifiedTransactions.forEach(t => {
        const pattern = extractPattern(t.details);
        if (pattern) {
          patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
        }
      });

      const repeatingTransactions = [];
      const oneOffTransactions = [];

      unidentifiedTransactions.forEach(t => {
        const pattern = extractPattern(t.details);
        const count = patternCounts.get(pattern) || 0;
        if (count >= 2) {
          repeatingTransactions.push({ ...t, pattern, patternCount: count });
        } else {
          oneOffTransactions.push(t);
        }
      });

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

      const findLongestCommonSubstring = (transactions) => {
        if (transactions.length === 0) return '';
        if (transactions.length === 1) return transactions[0].details.trim();

        const details = transactions.map(t => t.details.toUpperCase().trim());
        const longest = details.reduce((max, str) => str.length > max.length ? str : max);

        const candidates = [];
        for (let length = longest.length; length >= 4; length--) {
          for (let start = 0; start <= longest.length - length; start++) {
            const candidate = longest.substring(start, start + length).trim();
            if (candidate.length >= 4) {
              candidates.push(candidate);
            }
          }
        }

        let bestMatch = '';
        for (const candidate of candidates) {
          if (details.every(detail => detail.includes(candidate))) {
            bestMatch = candidate;
            break;
          }
        }

        const cleanIdentifier = (identifier) => {
          let cleaned = identifier.trim();
          const monthPattern = /^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*/;
          cleaned = cleaned.replace(monthPattern, '');
          cleaned = cleaned.replace(/^(0?[1-9]|[12][0-9]|3[01])\s*/, '');
          cleaned = cleaned.replace(/^(20\d{2}|'\d{2}|\d{2})\s*/, '');
          cleaned = cleaned.replace(/^POS\d{1,2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*/, '');
          return cleaned.trim();
        };

        const cleanedIdentifier = cleanIdentifier(bestMatch);
        if (cleanedIdentifier.length >= 4) {
          return cleanedIdentifier;
        }
        return bestMatch || transactions[0].details.trim();
      };

      const recurringGroups = Array.from(patternGroups.entries())
        .map(([initialPattern, transactions]) => {
          const refinedCoreId = findLongestCommonSubstring(transactions);
          return {
            coreId: refinedCoreId,
            initialPattern,
            transactions,
            count: transactions.length,
            avgAmount: transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / transactions.length,
            sampleTransactions: transactions.slice(0, 3)
          };
        })
        .sort((a, b) => b.count - a.count);

      setOneOffCount(oneOffTransactions.length);

      if (recurringGroups.length === 0) {
        setRecurringPatterns([]);
        setError('No recurring patterns found. All transactions appear to be one-offs.');
        setIsAnalyzing(false);
        setAnalysisComplete(true);
        return;
      }

      // Separate income vs expense
      const incomePatterns = [];
      const expenseGroups = [];

      recurringGroups.forEach(group => {
        const allIncome = group.transactions.every(t => {
          const originalTx = unidentifiedTransactions.find(ut => ut.details === t.details);
          if (originalTx?.isIncome !== undefined) {
            return originalTx.isIncome === true;
          }
          return (t.credit > 0 || t.amount > 0) && (t.debit === 0 || !t.debit);
        });

        if (allIncome) {
          const incomeCategory = categoryMapping.find(c => c.code === '1.0');
          if (incomeCategory) {
            const identifierExists = incomeCategory.identifiers.some(id =>
              id.toLowerCase() === group.coreId.toLowerCase()
            );

            if (!identifierExists) {
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
            }
          }
        } else {
          expenseGroups.push(group);
        }
      });

      if (expenseGroups.length === 0) {
        setRecurringPatterns([]);
        setAllRecurringGroups([]);
        setTotalBatches(0);
        setCurrentBatch(0);

        if (incomePatterns.length > 0) {
          setError(`Auto-applied ${incomePatterns.length} income patterns. No expense patterns found.`);
        }

        setIsAnalyzing(false);
        setAnalysisComplete(true);
        return;
      }

      // Send expense patterns to AI
      const staffNames = categoryMapping
        .filter(c => c.personalization === 'Personalized' && c.staffMember)
        .map(c => c.staffMember)
        .filter(Boolean);

      const parentCategoriesForPrompt = Object.values(PARENT_CATEGORIES)
        .filter(p => p.id !== 'INCOME');

      const BATCH_SIZE = 80;
      const totalBatchCount = Math.ceil(expenseGroups.length / BATCH_SIZE);

      setAllRecurringGroups(expenseGroups);
      setTotalBatches(totalBatchCount);
      setCurrentBatch(1);

      const batch = expenseGroups.slice(0, BATCH_SIZE);
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
        model: MODELS.FAST,
        maxTokens: 8000,
        apiKey: apiKey
      });

      if (!response.success) {
        const errorMsg = response.error || 'API request failed';
        if (errorMsg.includes('overload')) {
          throw new Error('Anthropic API is currently overloaded. Please wait 30 seconds and try again.');
        }
        throw new Error(errorMsg);
      }

      let parsedResult;
      try {
        let jsonText = response.content.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const objectMatch = jsonText.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          jsonText = objectMatch[0];
        }
        parsedResult = JSON.parse(jsonText);
      } catch (parseError) {
        console.error('Failed to parse AI response:', response.content);
        throw new Error('AI returned invalid format. Please try again.');
      }

      const enrichedPatterns = (parsedResult.patterns || []).map(aiPattern => {
        const matchingGroup = expenseGroups.find(g =>
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

      setRecurringPatterns(enrichedPatterns);

      if (incomePatterns.length > 0) {
        setError(`Auto-applied ${incomePatterns.length} income patterns. Review ${enrichedPatterns.length} expense suggestions below.`);
      }

      setAnalysisComplete(true);

    } catch (err) {
      console.error('AI analysis error:', err);
      setError(err.message || 'Failed to analyze patterns. Please check your API key and try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applySuggestion = (pattern, index) => {
    const selectedCategoryCode = editingCategory.get(index);

    if (editingCategory.has(index) && selectedCategoryCode) {
      const categoryIndex = categoryMapping.findIndex(c => c.code === selectedCategoryCode);
      if (categoryIndex === -1) {
        alert('Category not found. Please refresh and try again.');
        return;
      }

      const category = categoryMapping[categoryIndex];
      const newIdentifier = pattern.pattern;

      if (category.identifiers.some(id => id.toLowerCase() === newIdentifier.toLowerCase())) {
        alert('This identifier already exists in the category.');
        return;
      }

      const updatedCategory = {
        ...category,
        identifiers: [...category.identifiers, newIdentifier]
      };

      const updatedMapping = [...categoryMapping];
      updatedMapping[categoryIndex] = updatedCategory;
      setCategoryMapping(updatedMapping);

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

      setRecurringPatterns(prev => prev.filter((_, i) => i !== index));

      setEditingCategory(prev => {
        const newMap = new Map(prev);
        newMap.delete(index);
        return newMap;
      });
    } else if (pattern.isExisting) {
      const categoryIndex = categoryMapping.findIndex(c => c.code === pattern.suggestedCategory);
      if (categoryIndex === -1) {
        alert('Category not found. Please refresh and try again.');
        return;
      }

      const category = categoryMapping[categoryIndex];
      const newIdentifier = pattern.pattern;

      if (category.identifiers.some(id => id.toLowerCase() === newIdentifier.toLowerCase())) {
        alert('This identifier already exists in the category.');
        return;
      }

      const updatedCategory = {
        ...category,
        identifiers: [...category.identifiers, newIdentifier]
      };

      const updatedMapping = [...categoryMapping];
      updatedMapping[categoryIndex] = updatedCategory;
      setCategoryMapping(updatedMapping);

      setRecurringPatterns(prev => prev.filter((_, i) => i !== index));
    } else {
      setEditingCategory(prev => {
        const newMap = new Map(prev);
        const firstCategory = categoryMapping.find(c =>
          c.type === 'expense' &&
          c.personalization !== 'Personalized' &&
          !['90'].includes(c.role)
        );
        newMap.set(index, firstCategory?.code || '');
        return newMap;
      });
    }
  };

  const updateCategorySelection = (index, categoryCode) => {
    // When user confirms category selection (second click), auto-apply it
    const pattern = recurringPatterns[index];
    if (!pattern) return;

    const categoryIdx = categoryMapping.findIndex(c => c.code === categoryCode);
    if (categoryIdx === -1) {
      alert('Category not found. Please refresh and try again.');
      return;
    }

    const category = categoryMapping[categoryIdx];
    const newIdentifier = pattern.pattern;

    if (category.identifiers.some(id => id.toLowerCase() === newIdentifier.toLowerCase())) {
      alert('This identifier already exists in the category.');
      return;
    }

    const updatedCategory = {
      ...category,
      identifiers: [...category.identifiers, newIdentifier]
    };

    const updatedMapping = [...categoryMapping];
    updatedMapping[categoryIdx] = updatedCategory;
    setCategoryMapping(updatedMapping);

    // Record AI correction if different from suggestion
    if (pattern.isExisting && categoryCode !== pattern.suggestedCategory) {
      const aiSuggestedCategory = categoryMapping.find(c => c.code === pattern.suggestedCategory);
      const parentCatAI = Object.values(PARENT_CATEGORIES).find(p => p.defaultCategory === pattern.suggestedCategory);
      const parentCatUser = Object.values(PARENT_CATEGORIES).find(p => p.defaultCategory === categoryCode);

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

    // Remove the pattern from the list (it's been applied)
    setRecurringPatterns(prev => prev.filter((_, i) => i !== index));

    // Clear editing state for this index
    setEditingCategory(prev => {
      const newMap = new Map(prev);
      newMap.delete(index);
      return newMap;
    });
  };

  const dismissSuggestion = (index) => {
    setRecurringPatterns(prev => prev.filter((_, i) => i !== index));
  };

  // Get expense categories for display (excluding income)
  const expenseParentCategories = Object.values(PARENT_CATEGORIES).filter(p => p.id !== 'INCOME');

  if (!isReady || !apiKey) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <Loader style={{ width: '32px', height: '32px', color: COLORS.slainteBlue, animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
        <p style={{ color: COLORS.textSecondary }}>
          {!apiKey ? 'Loading API key...' : 'Preparing expense categorization...'}
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      gap: '2rem',
      alignItems: 'flex-start',
      maxWidth: '1600px',
      margin: '0 auto',
      height: 'min(75vh, 700px)'
    }}>
      {/* Left side - Finn Chat Box */}
      <div style={{
        flex: '1 1 45%',
        minWidth: '450px',
        maxWidth: '600px',
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

        {/* Chat Messages Area */}
        <div style={{
          padding: '1.5rem',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          overflowY: 'auto'
        }}>
          {/* Greeting Message */}
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

          {/* Message */}
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

          {/* Categories explanation */}
          {showCategories && !isAnalyzing && !analysisComplete && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', flexShrink: 0 }} />
              <div style={{
                backgroundColor: `${COLORS.slainteBlue}10`,
                padding: '0.875rem 1rem',
                borderRadius: '12px',
                maxWidth: '85%',
                border: `1px solid ${COLORS.slainteBlue}30`
              }}>
                <div style={{
                  fontSize: '0.875rem',
                  color: COLORS.textPrimary,
                  lineHeight: 1.5
                }}>
                  Click "Quick Categorization" to automatically sort your transactions into these broad categories. You can always refine them later!
                </div>
              </div>
            </div>
          )}

          {/* Analysis in progress message */}
          {isAnalyzing && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', flexShrink: 0 }} />
              <div style={{
                backgroundColor: `${COLORS.slainteBlue}10`,
                padding: '0.875rem 1rem',
                borderRadius: '12px',
                maxWidth: '85%',
                border: `1px solid ${COLORS.slainteBlue}30`
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: COLORS.textPrimary,
                  fontSize: '0.9375rem'
                }}>
                  <Loader style={{ width: '18px', height: '18px', color: COLORS.slainteBlue, animation: 'spin 1s linear infinite' }} />
                  Analyzing your transactions...
                </div>
              </div>
            </div>
          )}

          {/* Analysis complete message */}
          {analysisComplete && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', flexShrink: 0 }} />
              <div style={{
                backgroundColor: `${COLORS.incomeColor}15`,
                padding: '0.875rem 1rem',
                borderRadius: '12px',
                maxWidth: '85%',
                border: `1px solid ${COLORS.incomeColor}`
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: COLORS.textPrimary,
                  fontSize: '0.9375rem'
                }}>
                  <CheckCircle style={{ width: '18px', height: '18px', color: COLORS.incomeColor }} />
                  {recurringPatterns.length > 0
                    ? `Found ${recurringPatterns.length} expense pattern${recurringPatterns.length > 1 ? 's' : ''} to review!`
                    : 'Analysis complete. No additional patterns found.'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Continue Button at bottom of chat */}
        <div style={{
          padding: '1rem',
          borderTop: `1px solid ${COLORS.borderLight}`,
          backgroundColor: COLORS.white
        }}>
          <button
            onClick={onComplete}
            style={{
              width: '100%',
              padding: '0.875rem 1.5rem',
              fontSize: '1rem',
              fontWeight: 600,
              color: COLORS.white,
              backgroundColor: COLORS.slainteBlue,
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
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

      {/* Right side - Categories & Results */}
      <div style={{
        flex: '1 1 60%',
        minWidth: '500px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        opacity: showCategories ? 1 : 0.3,
        transition: 'opacity 0.5s ease-out',
        pointerEvents: showCategories ? 'auto' : 'none',
        overflowY: 'auto'
      }}>
        {/* Main Card - Categories Overview */}
        <div style={{
          backgroundColor: COLORS.white,
          border: `3px solid ${COLORS.slainteBlue}`,
          borderRadius: '16px',
          padding: '1.5rem',
          flexShrink: 0,
          minWidth: '100%'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: `${COLORS.slainteBlue}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <TrendingUp style={{ width: '24px', height: '24px', color: COLORS.slainteBlue }} />
            </div>

            <div style={{ flex: 1 }}>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: COLORS.textPrimary,
                marginBottom: '0.25rem'
              }}>
                Quick Expense Categorization
              </h3>

              <p style={{
                fontSize: '0.875rem',
                color: COLORS.textSecondary,
                lineHeight: 1.5
              }}>
                Phase 1: Sort transactions into broad categories
              </p>
            </div>
          </div>

          {/* Category Icons Grid */}
          {!analysisComplete && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.75rem',
              marginBottom: '1.25rem'
            }}>
              {expenseParentCategories.map(cat => {
                const IconComponent = CATEGORY_ICONS[cat.id] || MoreHorizontal;
                return (
                  <div key={cat.id} style={{
                    backgroundColor: `${cat.color}15`,
                    border: `1px solid ${cat.color}30`,
                    borderRadius: '10px',
                    padding: '0.75rem',
                    textAlign: 'center'
                  }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: cat.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 0.5rem'
                    }}>
                      <IconComponent style={{ width: '20px', height: '20px', color: COLORS.white }} />
                    </div>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: COLORS.textPrimary, marginBottom: '0.125rem' }}>
                      {cat.name}
                    </p>
                    <p style={{ fontSize: '0.6875rem', color: COLORS.textSecondary, lineHeight: 1.3 }}>
                      {cat.description}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div style={{
              backgroundColor: error.startsWith('Auto-applied') ? `${COLORS.incomeColor}10` : `${COLORS.expenseColor}10`,
              border: `1px solid ${error.startsWith('Auto-applied') ? COLORS.incomeColor : COLORS.expenseColor}`,
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1rem'
            }}>
              <p style={{ fontSize: '0.875rem', color: error.startsWith('Auto-applied') ? COLORS.incomeColor : COLORS.expenseColor }}>{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          {!analysisComplete && (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={startAnalysis}
                disabled={isAnalyzing || unidentifiedTransactions.length === 0}
                style={{
                  flex: 2,
                  padding: '1rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: COLORS.white,
                  backgroundColor: isAnalyzing ? COLORS.textSecondary : COLORS.incomeColor,
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isAnalyzing || unidentifiedTransactions.length === 0 ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s'
                }}
              >
                {isAnalyzing ? (
                  <>
                    <Loader style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <TrendingUp style={{ width: '18px', height: '18px' }} />
                    Quick Categorization
                  </>
                )}
              </button>

              <button
                onClick={onComplete}
                disabled={isAnalyzing}
                style={{
                  flex: 1,
                  padding: '1rem',
                  fontSize: '0.9375rem',
                  fontWeight: 500,
                  color: COLORS.textSecondary,
                  backgroundColor: COLORS.white,
                  border: `2px solid ${COLORS.borderLight}`,
                  borderRadius: '8px',
                  cursor: isAnalyzing ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.375rem',
                  opacity: isAnalyzing ? 0.5 : 1
                }}
              >
                <SkipForward style={{ width: '16px', height: '16px' }} />
                Skip
              </button>
            </div>
          )}

          {/* Completed State */}
          {analysisComplete && recurringPatterns.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '1.5rem',
              backgroundColor: `${COLORS.incomeColor}10`,
              borderRadius: '12px'
            }}>
              <CheckCircle style={{ width: '48px', height: '48px', color: COLORS.incomeColor, margin: '0 auto 0.75rem' }} />
              <p style={{ fontSize: '1rem', fontWeight: 600, color: COLORS.textPrimary, marginBottom: '0.5rem' }}>
                All done!
              </p>
              <p style={{ fontSize: '0.875rem', color: COLORS.textSecondary }}>
                {oneOffCount > 0 ? `${oneOffCount} one-off transactions can be categorized manually later.` : 'All patterns have been processed.'}
              </p>
            </div>
          )}
        </div>

        {/* Suggestions List */}
        {recurringPatterns.length > 0 && (
          <div style={{
            backgroundColor: COLORS.white,
            border: `2px solid ${COLORS.borderLight}`,
            borderRadius: '16px',
            padding: '1.25rem',
            flex: 1,
            overflowY: 'auto'
          }}>
            <h4 style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: COLORS.textPrimary,
              marginBottom: '1rem'
            }}>
              Expense Patterns to Review ({recurringPatterns.length})
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {recurringPatterns.map((pattern, index) => {
                const isApplied = appliedSuggestions.has(`${pattern.suggestedCategory}-${index}`);
                const isNewCategory = !pattern.isExisting;
                const isEditing = editingCategory.has(index);
                const selectedCategory = editingCategory.get(index);

                return (
                  <div
                    key={`${pattern.suggestedCategory}-${index}`}
                    style={{
                      border: `2px solid ${isApplied ? COLORS.incomeColor : COLORS.borderLight}`,
                      borderRadius: '12px',
                      padding: '1rem',
                      backgroundColor: isApplied ? `${COLORS.incomeColor}10` : COLORS.white
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <div>
                        <h5 style={{ fontSize: '0.9375rem', fontWeight: 600, color: COLORS.textPrimary }}>
                          {pattern.pattern}
                        </h5>
                        <p style={{ fontSize: '0.75rem', color: COLORS.textSecondary }}>
                          {pattern.frequency} • Avg €{pattern.averageAmount?.toFixed(0)}
                        </p>
                      </div>
                      {isApplied && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: COLORS.incomeColor }}>
                          <CheckCircle style={{ width: '14px', height: '14px' }} />
                          Applied
                        </span>
                      )}
                    </div>

                    {/* Suggested category */}
                    {!isEditing && (
                      <div style={{
                        backgroundColor: `${COLORS.slainteBlue}10`,
                        border: `1px solid ${COLORS.slainteBlue}30`,
                        borderRadius: '8px',
                        padding: '0.5rem 0.75rem',
                        marginBottom: '0.5rem'
                      }}>
                        <p style={{ fontSize: '0.75rem', color: COLORS.textSecondary, marginBottom: '0.125rem' }}>Suggested:</p>
                        <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: COLORS.slainteBlue }}>
                          {pattern.categoryName}
                        </p>
                        <p style={{ fontSize: '0.6875rem', color: COLORS.textSecondary }}>{pattern.reasoning}</p>
                      </div>
                    )}

                    {/* Category picker when editing - selection auto-applies on confirm */}
                    {!isApplied && isEditing && (
                      <div style={{ marginBottom: '0.5rem' }}>
                        <SimpleCategoryPicker
                          transaction={null}
                          onCategorySelect={(categoryCode) => updateCategorySelection(index, categoryCode)}
                          categoryMapping={categoryMapping}
                          showStaffMembers={true}
                        />
                        <button
                          onClick={() => {
                            setEditingCategory(prev => {
                              const newMap = new Map(prev);
                              newMap.delete(index);
                              return newMap;
                            });
                          }}
                          style={{
                            width: '100%',
                            marginTop: '0.5rem',
                            padding: '0.375rem 0.75rem',
                            fontSize: '0.75rem',
                            color: COLORS.textSecondary,
                            backgroundColor: COLORS.white,
                            border: `1px solid ${COLORS.borderLight}`,
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {/* Action buttons - only show when NOT editing */}
                    {!isApplied && !isEditing && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => applySuggestion(pattern, index)}
                          style={{
                            flex: 1,
                            padding: '0.5rem',
                            fontSize: '0.8125rem',
                            fontWeight: 500,
                            color: COLORS.white,
                            backgroundColor: COLORS.incomeColor,
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.25rem'
                          }}
                        >
                          <Plus style={{ width: '14px', height: '14px' }} />
                          Apply
                        </button>
                        <button
                          onClick={() => {
                            setEditingCategory(prev => {
                              const newMap = new Map(prev);
                              newMap.set(index, pattern.suggestedCategory);
                              return newMap;
                            });
                          }}
                          style={{
                            padding: '0.5rem 0.75rem',
                            fontSize: '0.8125rem',
                            color: COLORS.slainteBlue,
                            backgroundColor: COLORS.white,
                            border: `1px solid ${COLORS.slainteBlue}`,
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          Change
                        </button>
                        <button
                          onClick={() => dismissSuggestion(index)}
                          style={{
                            padding: '0.5rem 0.75rem',
                            fontSize: '0.8125rem',
                            color: COLORS.textSecondary,
                            backgroundColor: COLORS.white,
                            border: `1px solid ${COLORS.borderLight}`,
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          Skip
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

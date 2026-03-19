import React, { useState, useEffect } from 'react';
import { User, MessageCircle, CheckCircle, ArrowRight, Loader, AlertCircle, ChevronDown, ChevronRight, Edit2, Check, X } from 'lucide-react';
import COLORS from '../../utils/colors';
import { callClaude } from '../../utils/claudeAPI';
import { MODELS } from '../../data/modelConfig';
import { PARENT_CATEGORIES } from '../../utils/parentCategoryMapping';
import { useAppContext } from '../../context/AppContext';

// Instant text display (typing animation disabled)
const useTypingEffect = (text) => {
  return { displayedText: text || '', isComplete: true };
};

// Common synonyms and variations for exact matching
const CATEGORY_SYNONYMS = {
  // Income synonyms
  'income': 'INCOME',
  'revenue': 'INCOME',
  'sales': 'INCOME',
  'receipts': 'INCOME',
  'gms': 'INCOME',
  'gms income': 'INCOME',
  'fees': 'INCOME',
  'patient fees': 'INCOME',
  'private income': 'INCOME',

  // Staff synonyms
  'staff': 'STAFF',
  'staff costs': 'STAFF',
  'wages': 'STAFF',
  'salaries': 'STAFF',
  'payroll': 'STAFF',
  'employee': 'STAFF',
  'employee costs': 'STAFF',
  'paye': 'STAFF',

  // Medical synonyms
  'medical': 'MEDICAL',
  'medical supplies': 'MEDICAL',
  'drugs': 'MEDICAL',
  'medicines': 'MEDICAL',
  'vaccines': 'MEDICAL',
  'clinical': 'MEDICAL',
  'clinical supplies': 'MEDICAL',
  'consumables': 'MEDICAL',
  'medical equipment': 'MEDICAL',
  'uniforms': 'MEDICAL',
  'workwear': 'MEDICAL',
  'ppe': 'MEDICAL',
  'liquid nitrogen': 'MEDICAL',
  'nitrogen': 'MEDICAL',
  'cryotherapy': 'MEDICAL',

  // Premises synonyms
  'premises': 'PREMISES',
  'premises costs': 'PREMISES',
  'rent': 'PREMISES',
  'rates': 'PREMISES',
  'utilities': 'PREMISES',
  'electricity': 'PREMISES',
  'gas': 'PREMISES',
  'heating': 'PREMISES',
  'light & heat': 'PREMISES',
  'maintenance': 'PREMISES',
  'repairs': 'PREMISES',
  'cleaning': 'PREMISES',
  'waste': 'PREMISES',
  'refuse': 'PREMISES',
  'building': 'PREMISES',
  'building costs': 'PREMISES',
  'building maintenance': 'PREMISES',
  'building- other': 'PREMISES',
  'building other': 'PREMISES',
  'property': 'PREMISES',
  'property costs': 'PREMISES',
  'security': 'PREMISES',
  'alarm': 'PREMISES',

  // Office & IT synonyms
  'office': 'OFFICE_IT',
  'office costs': 'OFFICE_IT',
  'admin': 'OFFICE_IT',
  'administration': 'OFFICE_IT',
  'stationery': 'OFFICE_IT',
  'printing': 'OFFICE_IT',
  'postage': 'OFFICE_IT',
  'telephone': 'OFFICE_IT',
  'phone': 'OFFICE_IT',
  'communications': 'OFFICE_IT',
  'internet': 'OFFICE_IT',
  'broadband': 'OFFICE_IT',
  'it': 'OFFICE_IT',
  'it costs': 'OFFICE_IT',
  'software': 'OFFICE_IT',
  'computer': 'OFFICE_IT',
  'computers': 'OFFICE_IT',

  // Professional synonyms
  'professional': 'PROFESSIONAL',
  'professional fees': 'PROFESSIONAL',
  'accountant': 'PROFESSIONAL',
  'accountancy': 'PROFESSIONAL',
  'accountancy fees': 'PROFESSIONAL',
  'legal': 'PROFESSIONAL',
  'legal fees': 'PROFESSIONAL',
  'legal costs': 'PROFESSIONAL',
  'solicitor': 'PROFESSIONAL',
  'solicitor fees': 'PROFESSIONAL',
  'audit': 'PROFESSIONAL',
  'audit fees': 'PROFESSIONAL',
  'subscriptions': 'PROFESSIONAL',
  'membership': 'PROFESSIONAL',
  'membership fees': 'PROFESSIONAL',
  'training': 'PROFESSIONAL',
  'cpd': 'PROFESSIONAL',
  'courses': 'PROFESSIONAL',
  'conferences': 'PROFESSIONAL',
  'insurance': 'PROFESSIONAL',
  'indemnity': 'PROFESSIONAL',
  'bank charges': 'PROFESSIONAL',
  'bank fees': 'PROFESSIONAL',
  'medical indemnity': 'PROFESSIONAL',
  'medical council': 'PROFESSIONAL',
  'imc': 'PROFESSIONAL',
  'irish medical council': 'PROFESSIONAL',
  'registration fee': 'PROFESSIONAL',
  'card machine fees': 'PROFESSIONAL',
  'card machine': 'PROFESSIONAL',
  'card fees': 'PROFESSIONAL',
  'merchant fees': 'PROFESSIONAL',
  'payment processing': 'PROFESSIONAL',

  // Other synonyms (motor, depreciation, misc expenses)
  'other': 'OTHER',
  'other expenses': 'OTHER',
  'sundry': 'OTHER',
  'sundries': 'OTHER',
  'miscellaneous': 'OTHER',
  'motor': 'OTHER',
  'travel': 'OTHER',
  'mileage': 'OTHER',
  'depreciation': 'OTHER',
  'capital': 'OTHER',
  'equipment': 'OTHER',
  'capital expenditure': 'OTHER',
  'asset purchase': 'OTHER',

  // Non-Business / Drawings synonyms (partner drawings, personal, loans)
  'drawings': 'NON_BUSINESS',
  'drawing': 'NON_BUSINESS',
  'partner': 'NON_BUSINESS',
  'partner drawings': 'NON_BUSINESS',
  'partner drawing': 'NON_BUSINESS',
  'partners': 'NON_BUSINESS',
  'partners drawings': 'NON_BUSINESS',
  'partners drawing': 'NON_BUSINESS',
  'non-business': 'NON_BUSINESS',
  'non business': 'NON_BUSINESS',
  'non-business expenses': 'NON_BUSINESS',
  'personal': 'NON_BUSINESS',
  'personal expenses': 'NON_BUSINESS',
  'private': 'NON_BUSINESS',
  'private use': 'NON_BUSINESS',
  'loan': 'NON_BUSINESS',
  'loan repayment': 'NON_BUSINESS',
  'loan repayments': 'NON_BUSINESS',
  'transfer': 'NON_BUSINESS',
  'bank transfer': 'NON_BUSINESS',
  'tax': 'NON_BUSINESS',
  'tax payment': 'NON_BUSINESS',
  'vat': 'NON_BUSINESS',
  'vat payment': 'NON_BUSINESS',
  'revenue commissioners': 'NON_BUSINESS',
  'paye/prsi': 'NON_BUSINESS',
  'prsi': 'NON_BUSINESS'
};

export default function CategoryMappingReview({ importData, onComplete, onBack }) {
  const { categoryMapping, setCategoryMapping } = useAppContext();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [categoryMappings, setCategoryMappings] = useState([]);
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [editingMapping, setEditingMapping] = useState(null);
  const [error, setError] = useState(null);
  const [apiKey, setApiKey] = useState('');

  const [showGreeting, setShowGreeting] = useState(false);
  const [showMessage, setShowMessage] = useState(false);

  const greetingText = "Analyzing your categories...";
  const messageText = analysisComplete
    ? `Great! I've mapped your ${categoryMappings.length} categories. Review the suggestions below and make any adjustments needed.`
    : "I'm comparing your category labels to Sláinte's standard categories. This usually takes just a few seconds.";

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
  }, []);

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

  // Start analysis when component mounts
  useEffect(() => {
    if (apiKey && importData?.userCategories?.length > 0 && !isAnalyzing && !analysisComplete) {
      analyzeCategories();
    }
  }, [apiKey, importData]);

  // Try exact match first using synonyms
  const findExactMatch = (userCategory) => {
    const normalized = userCategory.toLowerCase().trim();

    // Check direct synonym match (exact)
    if (CATEGORY_SYNONYMS[normalized]) {
      return CATEGORY_SYNONYMS[normalized];
    }

    // Check if it contains a key phrase - prefer LONGER/more specific matches
    // Sort entries by phrase length (longest first) to prioritize more specific matches
    // e.g., "legal fees" should match before "fees"
    const sortedEntries = Object.entries(CATEGORY_SYNONYMS)
      .sort((a, b) => b[0].length - a[0].length);

    for (const [phrase, parentId] of sortedEntries) {
      // Only match if the phrase is contained within the user category
      // Don't match if phrase contains user category (too broad)
      if (normalized.includes(phrase)) {
        return parentId;
      }
    }

    // Check if it matches a parent category name directly
    for (const parent of Object.values(PARENT_CATEGORIES)) {
      if (normalized === parent.name.toLowerCase() ||
          normalized === parent.id.toLowerCase()) {
        return parent.id;
      }
    }

    return null;
  };

  const analyzeCategories = async () => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const { userCategories, transactions } = importData;

      // First pass: Try exact matches
      const mappings = [];
      const needsAIMatching = [];

      for (const userCategory of userCategories) {
        // Get transactions with this category
        const categoryTransactions = transactions.filter(t => t.userCategory === userCategory);
        const count = categoryTransactions.length;
        const totalAmount = categoryTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

        // MONEY DIRECTION CHECK: Analyze if transactions are primarily incoming or outgoing
        // This helps prevent expense categories from being incorrectly mapped to INCOME
        // Look at amount signs: negative = outgoing (expense), positive = incoming (income)
        // Also check for debit/credit columns if they exist
        let outgoingCount = 0;
        let incomingCount = 0;
        categoryTransactions.forEach(t => {
          // Check various ways money direction might be indicated
          if (t.debit && t.debit > 0) {
            outgoingCount++;
          } else if (t.credit && t.credit > 0) {
            incomingCount++;
          } else if (t.amount < 0) {
            outgoingCount++;
          } else if (t.amount > 0) {
            // If all amounts are positive (common in CSVs), we can't determine direction from amount
            // In this case, we rely on the category name matching
          }
        });

        // Determine if this is likely an expense category based on transaction direction
        // If more than 70% of transactions are outgoing, this is likely an expense
        const isLikelyExpense = outgoingCount > 0 && (outgoingCount / (outgoingCount + incomingCount)) > 0.7;
        const isLikelyIncome = incomingCount > 0 && (incomingCount / (outgoingCount + incomingCount)) > 0.7;

        const exactMatch = findExactMatch(userCategory);

        if (exactMatch) {
          // VALIDATION: If the category matched to INCOME but transactions are clearly outgoing, override
          let finalCategory = exactMatch;
          if (exactMatch === 'INCOME' && isLikelyExpense) {
            console.log(`[CategoryMapping] "${userCategory}" matched to INCOME but has ${outgoingCount} outgoing transactions - overriding to PROFESSIONAL`);
            finalCategory = 'PROFESSIONAL'; // Default expense category for fees
          }

          // isIncome is determined by the mapped Sláinte category, not by amount signs
          // INCOME category = income, everything else = expense
          const isIncome = finalCategory === 'INCOME';

          mappings.push({
            userCategory,
            slainteCategory: finalCategory,
            confidence: exactMatch === finalCategory ? 'high' : 'medium',
            matchType: exactMatch === finalCategory ? 'exact' : 'validated',
            reason: exactMatch === finalCategory ? 'Direct match with standard category' : 'Adjusted based on transaction direction',
            transactionCount: count,
            totalAmount: totalAmount,
            isIncome: isIncome,
            moneyDirection: isLikelyExpense ? 'outgoing' : (isLikelyIncome ? 'incoming' : 'unknown')
          });
        } else {
          // For AI matching, we don't yet know if it's income or expense
          // This will be determined after the AI suggests a category
          needsAIMatching.push({
            userCategory,
            transactionCount: count,
            totalAmount: totalAmount,
            isLikelyExpense: isLikelyExpense,
            isLikelyIncome: isLikelyIncome,
            sampleDescriptions: categoryTransactions
              .slice(0, 3)
              .map(t => `${t.description} (€${Math.abs(t.amount).toFixed(2)})`)
          });
        }
      }

      // Second pass: Use AI for ambiguous categories
      if (needsAIMatching.length > 0 && apiKey) {
        const parentCategoriesForPrompt = Object.values(PARENT_CATEGORIES)
          .map(p => `${p.id}: ${p.name} - ${p.description}`)
          .join('\n');

        const prompt = `Map these user category labels to the most appropriate Sláinte parent category for a GP practice accounting system.

SLÁINTE PARENT CATEGORIES:
${parentCategoriesForPrompt}

CRITICAL MAPPING RULES:

1. NON_BUSINESS is for partner drawings and non-deductible items:
   - Partner drawings (money taken out by partners for personal use)
   - Personal expenses, private use items
   - Loan repayments, tax payments
   - ANY category with "Partner", "Drawing", or "Personal" = NON_BUSINESS

2. OTHER is for miscellaneous business expenses:
   - Motor costs, travel, mileage
   - Equipment purchases, depreciation
   - Sundries, miscellaneous items

3. PREMISES includes ALL building-related costs:
   - Rent, rates, utilities (electricity, gas, water)
   - Building maintenance, repairs, cleaning
   - Property insurance, security, alarm systems
   - ANY category with "Building" in the name = PREMISES

4. STAFF is ONLY for employee wages/salaries:
   - Partner payments are NOT staff costs (partners are owners, not employees)
   - Locum doctors, nurses, reception = STAFF

5. PROFESSIONAL includes fees paid TO professionals:
   - Accountant fees, legal fees, solicitor
   - Bank charges, insurance, subscriptions
   - Training, CPD, conferences

6. INCOME is for money coming IN to the practice:
   - GMS payments, patient fees, revenue, receipts, sales

USER CATEGORIES TO MAP:
${needsAIMatching.map((item, idx) =>
  `${idx + 1}. "${item.userCategory}" (${item.transactionCount} transactions, €${item.totalAmount.toFixed(0)})
   Money direction: ${item.isLikelyExpense ? 'OUTGOING (expense)' : item.isLikelyIncome ? 'INCOMING (revenue)' : 'Unknown'}
   Sample transactions: ${item.sampleDescriptions.join('; ')}`
).join('\n\n')}

Return JSON ONLY:
{
  "mappings": [
    {
      "userCategory": "User's label",
      "slainteCategory": "PARENT_ID",
      "confidence": "high|medium|low",
      "reason": "Brief explanation"
    }
  ]
}

REMEMBER:
- "Partner", "Drawing", "Personal" = NON_BUSINESS (not STAFF, not OTHER)
- "Building" anything = PREMISES
- CRITICAL: If "Money direction" says OUTGOING, DO NOT suggest INCOME - this is money leaving the practice
- Use ONLY: INCOME, STAFF, MEDICAL, PREMISES, OFFICE_IT, PROFESSIONAL, OTHER, NON_BUSINESS
- Return ALL ${needsAIMatching.length} mappings`;

        const response = await callClaude(prompt, {
          model: MODELS.STANDARD,
          maxTokens: 4000,
          apiKey: apiKey
        });

        if (response.success) {
          try {
            let jsonText = response.content.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const objectMatch = jsonText.match(/\{[\s\S]*\}/);
            if (objectMatch) {
              jsonText = objectMatch[0];
            }
            const aiResult = JSON.parse(jsonText);

            for (const aiMapping of (aiResult.mappings || [])) {
              const originalItem = needsAIMatching.find(
                item => item.userCategory.toLowerCase() === aiMapping.userCategory.toLowerCase()
              );

              if (originalItem) {
                let suggestedCategory = aiMapping.slainteCategory;
                let matchType = 'ai';
                let reason = aiMapping.reason;
                let confidence = aiMapping.confidence;

                // VALIDATION: If AI suggested INCOME but money direction is clearly outgoing, override
                if (suggestedCategory === 'INCOME' && originalItem.isLikelyExpense) {
                  console.log(`[CategoryMapping] AI suggested INCOME for "${originalItem.userCategory}" but transactions are outgoing - overriding to PROFESSIONAL`);
                  suggestedCategory = 'PROFESSIONAL';
                  matchType = 'ai_validated';
                  reason = 'AI suggested income but transaction direction indicates expense - adjusted to Professional';
                  confidence = 'medium';
                }

                // isIncome is determined by the mapped Sláinte category
                const isIncome = suggestedCategory === 'INCOME';

                mappings.push({
                  userCategory: originalItem.userCategory, // Use original case
                  slainteCategory: suggestedCategory,
                  confidence: confidence,
                  matchType: matchType,
                  reason: reason,
                  transactionCount: originalItem.transactionCount,
                  totalAmount: originalItem.totalAmount,
                  isIncome: isIncome,
                  moneyDirection: originalItem.isLikelyExpense ? 'outgoing' : (originalItem.isLikelyIncome ? 'incoming' : 'unknown')
                });
              }
            }
          } catch (parseError) {
            console.error('Failed to parse AI response:', parseError);
            // Fall back to OTHER (expense) as default for unknown categories
            for (const item of needsAIMatching) {
              mappings.push({
                userCategory: item.userCategory,
                slainteCategory: 'OTHER',
                confidence: 'low',
                matchType: 'fallback',
                reason: 'Could not determine - please review',
                transactionCount: item.transactionCount,
                totalAmount: item.totalAmount,
                isIncome: false
              });
            }
          }
        }
      } else if (needsAIMatching.length > 0) {
        // No API key - fall back to OTHER (expense) as default
        for (const item of needsAIMatching) {
          mappings.push({
            userCategory: item.userCategory,
            slainteCategory: 'OTHER',
            confidence: 'low',
            matchType: 'fallback',
            reason: 'Could not determine - please review',
            transactionCount: item.transactionCount,
            totalAmount: item.totalAmount,
            isIncome: false
          });
        }
      }

      // Sort by Sláinte category first, then by transaction count within each category
      const categoryOrder = ['INCOME', 'STAFF', 'MEDICAL', 'PREMISES', 'OFFICE_IT', 'PROFESSIONAL', 'OTHER', 'NON_BUSINESS'];
      mappings.sort((a, b) => {
        const aOrder = categoryOrder.indexOf(a.slainteCategory);
        const bOrder = categoryOrder.indexOf(b.slainteCategory);
        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }
        return b.transactionCount - a.transactionCount;
      });

      setCategoryMappings(mappings);
      setAnalysisComplete(true);

    } catch (err) {
      console.error('Category analysis error:', err);
      setError(err.message || 'Failed to analyze categories');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleExpanded = (userCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(userCategory)) {
        next.delete(userCategory);
      } else {
        next.add(userCategory);
      }
      return next;
    });
  };

  const startEditMapping = (userCategory) => {
    setEditingMapping(userCategory);
  };

  const updateMapping = (userCategory, newSlainteCategory) => {
    setCategoryMappings(prev => prev.map(m => {
      if (m.userCategory === userCategory) {
        return {
          ...m,
          slainteCategory: newSlainteCategory,
          confidence: 'high',
          matchType: 'manual',
          reason: 'Manually selected by user',
          isIncome: newSlainteCategory === 'INCOME' // Update isIncome based on new category
        };
      }
      return m;
    }));
    setEditingMapping(null);
  };

  const handleContinue = () => {
    // Pass the final mappings to the next step for identifier extraction
    onComplete({
      categoryMappings: categoryMappings,
      transactions: importData.transactions,
      columnMapping: importData.columnMapping
    });
  };

  const getConfidenceColor = (confidence) => {
    switch (confidence) {
      case 'high': return COLORS.incomeColor;
      case 'medium': return COLORS.highlightYellow;
      case 'low': return COLORS.expenseColor;
      default: return COLORS.textSecondary;
    }
  };

  const getParentCategory = (id) => {
    return PARENT_CATEGORIES[id] || { name: 'Unknown', icon: '❓', color: COLORS.textSecondary };
  };

  // Group mappings by Sláinte category for summary
  const groupedBySlainteCategory = categoryMappings.reduce((acc, mapping) => {
    if (!acc[mapping.slainteCategory]) {
      acc[mapping.slainteCategory] = [];
    }
    acc[mapping.slainteCategory].push(mapping);
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

          {/* Loading indicator */}
          {isAnalyzing && (
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
                    Matching {importData.userCategories.length} categories...
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Summary by Sláinte category */}
          {analysisComplete && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', flexShrink: 0 }} />
              <div style={{
                backgroundColor: `${COLORS.incomeColor}10`,
                padding: '1rem',
                borderRadius: '12px',
                maxWidth: '85%',
                border: `1px solid ${COLORS.incomeColor}`
              }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: COLORS.textPrimary, marginBottom: '0.75rem' }}>
                  Category Summary:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {Object.entries(groupedBySlainteCategory).map(([slainteId, items]) => {
                    const parent = getParentCategory(slainteId);
                    const totalCount = items.reduce((sum, i) => sum + i.transactionCount, 0);
                    return (
                      <div key={slainteId} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
                        <span>{parent.icon}</span>
                        <span style={{ color: COLORS.textPrimary }}>{parent.name}:</span>
                        <span style={{ color: COLORS.textSecondary }}>{items.length} labels ({totalCount} txns)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{
          padding: '1rem',
          borderTop: `1px solid ${COLORS.borderLight}`,
          display: 'flex',
          gap: '0.75rem'
        }}>
          <button
            onClick={onBack}
            style={{
              flex: 1,
              padding: '0.75rem',
              fontSize: '0.9375rem',
              fontWeight: 500,
              color: COLORS.textSecondary,
              backgroundColor: COLORS.white,
              border: `1px solid ${COLORS.borderLight}`,
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Back
          </button>
          <button
            onClick={handleContinue}
            disabled={!analysisComplete || categoryMappings.length === 0}
            style={{
              flex: 2,
              padding: '0.75rem',
              fontSize: '0.9375rem',
              fontWeight: 600,
              color: COLORS.white,
              backgroundColor: analysisComplete ? COLORS.incomeColor : COLORS.textSecondary,
              border: 'none',
              borderRadius: '8px',
              cursor: analysisComplete ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            Apply & Extract Patterns
            <ArrowRight style={{ width: '16px', height: '16px' }} />
          </button>
        </div>
      </div>

      {/* Right side - Mapping Review */}
      <div style={{
        flex: '1 1 60%',
        minWidth: '500px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        overflowY: 'auto'
      }}>
        {/* Main mapping card */}
        <div style={{
          backgroundColor: COLORS.white,
          border: `3px solid ${COLORS.slainteBlue}`,
          borderRadius: '16px',
          padding: '1.5rem',
          flex: 1,
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: COLORS.textPrimary,
                marginBottom: '0.25rem'
              }}>
                Category Mapping
              </h3>
              <p style={{ fontSize: '0.875rem', color: COLORS.textSecondary }}>
                Your labels → Sláinte categories
              </p>
            </div>
            {analysisComplete && (
              <div style={{
                display: 'flex',
                gap: '0.75rem',
                fontSize: '0.75rem'
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS.incomeColor }}></span>
                  High
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS.highlightYellow }}></span>
                  Medium
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS.expenseColor }}></span>
                  Review
                </span>
              </div>
            )}
          </div>

          {error && (
            <div style={{
              backgroundColor: `${COLORS.expenseColor}10`,
              border: `1px solid ${COLORS.expenseColor}`,
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <AlertCircle style={{ width: '18px', height: '18px', color: COLORS.expenseColor }} />
              <p style={{ fontSize: '0.875rem', color: COLORS.expenseColor }}>{error}</p>
            </div>
          )}

          {/* Loading state */}
          {isAnalyzing && (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <Loader style={{ width: '40px', height: '40px', color: COLORS.slainteBlue, animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
              <p style={{ color: COLORS.textSecondary }}>Analyzing your categories...</p>
            </div>
          )}

          {/* Mapping list - grouped by Sláinte category */}
          {analysisComplete && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {categoryMappings.map((mapping, idx) => {
                const parent = getParentCategory(mapping.slainteCategory);
                const isExpanded = expandedCategories.has(mapping.userCategory);
                const isEditing = editingMapping === mapping.userCategory;

                // Check if this is the first item in a new category group
                const prevMapping = idx > 0 ? categoryMappings[idx - 1] : null;
                const isNewCategory = !prevMapping || prevMapping.slainteCategory !== mapping.slainteCategory;

                return (
                  <React.Fragment key={mapping.userCategory}>
                    {/* Category section header */}
                    {isNewCategory && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.75rem 0.5rem 0.25rem 0.5rem',
                        marginTop: idx > 0 ? '0.75rem' : 0
                      }}>
                        <span style={{ fontSize: '1.25rem' }}>{parent.icon}</span>
                        <span style={{
                          fontSize: '0.9375rem',
                          fontWeight: 700,
                          color: parent.color
                        }}>
                          {parent.name}
                        </span>
                        <span style={{
                          fontSize: '0.75rem',
                          color: COLORS.textSecondary,
                          marginLeft: '0.25rem'
                        }}>
                          ({categoryMappings.filter(m => m.slainteCategory === mapping.slainteCategory).length} labels)
                        </span>
                      </div>
                    )}
                    <div
                      style={{
                        border: `2px solid ${mapping.confidence === 'low' ? COLORS.expenseColor : COLORS.borderLight}`,
                        borderRadius: '10px',
                        overflow: 'hidden',
                        backgroundColor: mapping.confidence === 'low' ? `${COLORS.expenseColor}05` : COLORS.white
                      }}
                    >
                    {/* Main row */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0.75rem 1rem',
                        cursor: 'pointer',
                        gap: '0.75rem'
                      }}
                      onClick={() => toggleExpanded(mapping.userCategory)}
                    >
                      <button
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        {isExpanded ? (
                          <ChevronDown style={{ width: '18px', height: '18px', color: COLORS.textSecondary }} />
                        ) : (
                          <ChevronRight style={{ width: '18px', height: '18px', color: COLORS.textSecondary }} />
                        )}
                      </button>

                      {/* User category */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '0.9375rem',
                          fontWeight: 600,
                          color: COLORS.textPrimary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {mapping.userCategory}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: COLORS.textSecondary }}>
                          {mapping.transactionCount} transactions • €{mapping.totalAmount.toFixed(0)}
                        </div>
                      </div>

                      {/* Arrow */}
                      <ArrowRight style={{ width: '16px', height: '16px', color: COLORS.borderLight, flexShrink: 0 }} />

                      {/* Sláinte category (or dropdown if editing) */}
                      {isEditing ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={e => e.stopPropagation()}>
                          <select
                            value={mapping.slainteCategory}
                            onChange={(e) => updateMapping(mapping.userCategory, e.target.value)}
                            style={{
                              padding: '0.5rem',
                              fontSize: '0.875rem',
                              border: `2px solid ${COLORS.slainteBlue}`,
                              borderRadius: '6px',
                              backgroundColor: COLORS.white
                            }}
                          >
                            {Object.values(PARENT_CATEGORIES).map(p => (
                              <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => setEditingMapping(null)}
                            style={{
                              padding: '0.375rem',
                              backgroundColor: COLORS.borderLight,
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            <X style={{ width: '14px', height: '14px', color: COLORS.textPrimary }} />
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                            padding: '0.375rem 0.75rem',
                            backgroundColor: `${parent.color}15`,
                            borderRadius: '6px',
                            border: `1px solid ${parent.color}30`
                          }}>
                            <span style={{ fontSize: '1rem' }}>{parent.icon}</span>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: COLORS.textPrimary }}>{parent.name}</span>
                          </div>

                          {/* Confidence indicator */}
                          <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: getConfidenceColor(mapping.confidence)
                          }} />

                          {/* Edit button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditMapping(mapping.userCategory);
                            }}
                            style={{
                              padding: '0.375rem',
                              backgroundColor: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              opacity: 0.6
                            }}
                          >
                            <Edit2 style={{ width: '14px', height: '14px', color: COLORS.textSecondary }} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div style={{
                        padding: '0.75rem 1rem',
                        backgroundColor: COLORS.bgPage,
                        borderTop: `1px solid ${COLORS.borderLight}`,
                        fontSize: '0.8125rem'
                      }}>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                          <div>
                            <span style={{ color: COLORS.textSecondary }}>Match type:</span>{' '}
                            <span style={{ color: COLORS.textPrimary, fontWeight: 500 }}>
                              {mapping.matchType === 'exact' ? 'Direct match' :
                               mapping.matchType === 'ai' ? 'AI suggested' :
                               mapping.matchType === 'manual' ? 'Manually set' : 'Needs review'}
                            </span>
                          </div>
                          <div>
                            <span style={{ color: COLORS.textSecondary }}>Confidence:</span>{' '}
                            <span style={{ color: getConfidenceColor(mapping.confidence), fontWeight: 500 }}>
                              {mapping.confidence}
                            </span>
                          </div>
                        </div>
                        <div style={{ marginTop: '0.5rem', color: COLORS.textSecondary }}>
                          {mapping.reason}
                        </div>
                      </div>
                    )}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

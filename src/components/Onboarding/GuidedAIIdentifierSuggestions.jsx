import React, { useState, useEffect } from 'react';
import { CheckCircle, ArrowRight, User, MessageCircle, Users, Brain, Loader, Plus, X } from 'lucide-react';
import COLORS from '../../utils/colors';
import { useAppContext } from '../../context/AppContext';
import { callClaude } from '../../utils/claudeAPI';
import { MODELS } from '../../data/modelConfig';
import { getRoleCode } from '../../utils/categoryGenerator';

// Instant text display (typing animation disabled)
const useTypingEffect = (text) => {
  return { displayedText: text || '', isComplete: true };
};

export default function GuidedAIIdentifierSuggestions({ onComplete }) {
  const { unidentifiedTransactions, transactions, categoryMapping, setCategoryMapping } = useAppContext();
  const [isReady, setIsReady] = useState(false);
  const [apiKey, setApiKey] = useState('');

  const [showGreeting, setShowGreeting] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [showTip, setShowTip] = useState(false);

  // Analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [appliedSuggestions, setAppliedSuggestions] = useState(new Set());
  const [error, setError] = useState(null);
  const [creatingStaff, setCreatingStaff] = useState(new Map());

  const greetingText = "Now let's identify your staff payments!";
  const messageText = "I can analyze your transactions to find salary payments and match them to your team members. This helps categorize payments automatically.";
  const tipText = "Click the button on the right to start the analysis, or skip if you'd prefer to categorize manually later.";

  const { displayedText: greeting, isComplete: greetingComplete } = useTypingEffect(showGreeting ? greetingText : '', 25);
  const { displayedText: message, isComplete: messageComplete } = useTypingEffect(showMessage ? messageText : '', 15);
  const { displayedText: tip, isComplete: tipComplete } = useTypingEffect(showTip ? tipText : '', 15);

  // Load API key and check transactions
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
  }, [transactions, unidentifiedTransactions]);

  // Start animation sequence
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
      const timer = setTimeout(() => setShowTip(true), 300);
      return () => clearTimeout(timer);
    }
  }, [messageComplete]);

  // Start AI analysis automatically when button is clicked
  const startAnalysis = async () => {
    if (!apiKey) {
      setError('API key not found. Please check your settings.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      // Get sample of unidentified transactions (max 50 for performance)
      const sampleTransactions = unidentifiedTransactions
        .slice(0, 50)
        .map(t => t.details);

      // Get all staff AND partner categories (personalized ones)
      const staffCategories = categoryMapping.filter(c =>
        c.personalization === 'Personalized' &&
        (['3', '4', '5', '6', '7', '90'].includes(c.role))
      );

      // Create prompt for Claude
      const prompt = `You are analyzing bank transaction descriptions to suggest identifier patterns for staff salary payments and partner drawings.

EXISTING STAFF AND PARTNER CATEGORIES:
${staffCategories.map(c => `${c.code} - ${c.name} (Current identifiers: ${c.identifiers.join(', ')})`).join('\n')}

UNIDENTIFIED TRANSACTIONS (these couldn't be matched):
${sampleTransactions.join('\n')}

TASK:
Analyze the unidentified transactions and suggest identifier patterns. ONLY match to existing categories if you're HIGHLY CONFIDENT the names match. Otherwise, suggest a NEW category.

CRITICAL RULES:
1. ONLY suggest adding identifiers to existing categories if the staff member name CLEARLY MATCHES
   - Example: "SANDRA GARCIA" can match to "Reception - Sandra G" ✓
   - Example: "SARAH GILES" should NOT match to "Reception - Sandra G" ✗ (different person!)
2. If you find staff payments that DON'T match existing categories, use categoryCode "NEW_STAFF" to suggest creating a new category
3. Look for salary patterns: "SALARY", "WAGES", "PAYROLL", staff names
4. Suggest identifiers that are specific enough (3+ characters minimum)
5. Consider name variations: "SANDRA", "S GARCIA", "SANDRA G", but ONLY for the SAME person

Return ONLY a JSON array in this format:
[
  {
    "categoryCode": "3.1",
    "categoryName": "Reception - Sandra G",
    "suggestedIdentifiers": ["SANDRA GARCIA", "S GARCIA"],
    "reasoning": "Found 'SANDRA GARCIA SALARY' - matches Sandra G"
  },
  {
    "categoryCode": "NEW_STAFF",
    "categoryName": "Sarah Giles (New Staff Member)",
    "suggestedIdentifiers": ["SARAH GILES", "TO SARAH"],
    "reasoning": "Found 'TO SARAH GILES' - this is a NEW person not in existing categories",
    "suggestedRole": "Reception",
    "isNewCategory": true
  }
]

If no useful patterns found, return empty array: []`;

      // Call Claude API
      const response = await callClaude(prompt, {
        model: MODELS.FAST,
        maxTokens: 2000,
        apiKey: apiKey
      });

      if (!response.success) {
        throw new Error(response.error || 'API request failed');
      }

      const resultText = response.content.trim();

      // Parse JSON response
      let parsedSuggestions;
      try {
        let jsonText = resultText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        if (jsonText.startsWith('[]') || jsonText.includes('[]')) {
          const emptyArrayMatch = jsonText.match(/\[\s*\]/);
          if (emptyArrayMatch) {
            parsedSuggestions = [];
          }
        }

        if (parsedSuggestions === undefined) {
          const arrayMatch = jsonText.match(/\[\s*\{[\s\S]*\}\s*\]/);
          if (arrayMatch) {
            jsonText = arrayMatch[0];
          }
          parsedSuggestions = JSON.parse(jsonText);
        }
      } catch (parseError) {
        console.error('Failed to parse AI response:', resultText);
        if (resultText.includes('[]')) {
          parsedSuggestions = [];
        } else {
          throw new Error('AI returned invalid format. Please try again.');
        }
      }

      // Filter out suggestions where ALL identifiers already exist
      const filteredSuggestions = parsedSuggestions.filter(suggestion => {
        if (suggestion.isNewCategory || suggestion.categoryCode === 'NEW_STAFF') {
          return true;
        }

        const category = categoryMapping.find(c => c.code === suggestion.categoryCode);
        if (!category) {
          return false;
        }

        const hasNewIdentifier = suggestion.suggestedIdentifiers.some(
          suggested => !category.identifiers.some(existing =>
            existing.toLowerCase() === suggested.toLowerCase()
          )
        );

        return hasNewIdentifier;
      });

      setSuggestions(filteredSuggestions);
      setAnalysisComplete(true);

      if (filteredSuggestions.length === 0) {
        if (parsedSuggestions.length > 0) {
          setError('All suggested patterns already exist in your categories. Your identifier setup is working well!');
        } else {
          setError('No new identifier patterns found. Your existing identifiers may already be comprehensive!');
        }
      }

    } catch (err) {
      console.error('AI analysis error:', err);
      setError(err.message || 'Failed to analyze patterns. Please check your API key and try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applySuggestion = (suggestion, index) => {
    const isNewCategory = suggestion.isNewCategory || suggestion.categoryCode === 'NEW_STAFF';

    if (isNewCategory) {
      const staffName = suggestion.categoryName.replace(' (New Staff Member)', '').replace(/\s*\(.*?\)\s*$/, '');
      let suggestedRole = suggestion.suggestedRole || 'Receptionist';

      const validRoles = [
        'Receptionist', 'Nurse', 'Hygienist', 'Phlebotomist', 'GP Assistant', 'Dentist', 'Other Staff',
        'Partner', 'Associate', 'Practice Manager', 'Therapist', 'Technician',
        'Admin Staff', 'Cleaning Staff', 'Locum', 'Specialist', 'Consultant'
      ];

      if (!validRoles.includes(suggestedRole)) {
        const roleMap = {
          'Reception': 'Receptionist',
          'Nursing': 'Nurse',
          'Hygiene': 'Hygienist',
          'Phlebotomy': 'Phlebotomist',
          'Dental': 'Dentist',
          'Unknown': 'Other Staff'
        };
        suggestedRole = roleMap[suggestedRole] || 'Other Staff';
      }

      setCreatingStaff(prev => {
        const newMap = new Map(prev);
        newMap.set(index, {
          role: suggestedRole,
          name: staffName,
          identifiers: suggestion.suggestedIdentifiers,
          reasoning: suggestion.reasoning
        });
        return newMap;
      });
      return;
    }

    const categoryIndex = categoryMapping.findIndex(c => c.code === suggestion.categoryCode);
    if (categoryIndex === -1) {
      alert('Category not found. Please refresh and try again.');
      return;
    }

    const category = categoryMapping[categoryIndex];

    const newIdentifiers = suggestion.suggestedIdentifiers.filter(
      id => !category.identifiers.some(existing =>
        existing.toLowerCase() === id.toLowerCase()
      )
    );

    if (newIdentifiers.length === 0) {
      alert('All suggested identifiers already exist in this category.');
      return;
    }

    const updatedCategory = {
      ...category,
      identifiers: [...category.identifiers, ...newIdentifiers]
    };

    const updatedMapping = [...categoryMapping];
    updatedMapping[categoryIndex] = updatedCategory;
    setCategoryMapping(updatedMapping);

    setAppliedSuggestions(prev => new Set([...prev, `${suggestion.categoryCode}-${index}`]));
  };

  const dismissSuggestion = (index) => {
    setSuggestions(prev => prev.filter((s, i) => i !== index));
    setCreatingStaff(prev => {
      const newMap = new Map(prev);
      newMap.delete(index);
      return newMap;
    });
  };

  const createNewStaffCategory = (index) => {
    const staffData = creatingStaff.get(index);
    if (!staffData) return;

    const roleMap = {
      'Receptionist': '3', 'Reception': '3',
      'Nurse': '4', 'Nursing': '4',
      'Hygienist': '5', 'Hygiene': '5',
      'Phlebotomist': '5', 'Phlebotomy': '5',
      'GP Assistant': '6',
      'Dentist': '6', 'Dental': '6',
      'Other Staff': '7',
      'Partner': '90',
      'Associate': '6',
      'Practice Manager': '7',
      'Therapist': '5',
      'Technician': '7',
      'Admin Staff': '3',
      'Cleaning Staff': '7',
      'Locum': '6',
      'Specialist': '6',
      'Consultant': '6'
    };

    const roleCode = roleMap[staffData.role] || '7';
    const roleName = staffData.role;
    const isPartner = roleCode === '90';

    const existingCodes = categoryMapping
      .filter(c => c.code.startsWith(`${roleCode}.`))
      .map(c => {
        const parts = c.code.split('.');
        return parts.length > 1 ? parseInt(parts[1]) : 0;
      });

    const nextIndex = existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : 1;
    const newCode = `${roleCode}.${nextIndex}`;

    if (categoryMapping.some(c => c.code === newCode)) {
      alert(`Error: Category code ${newCode} already exists. Please refresh the page and try again.`);
      return;
    }

    const newCategory = isPartner ? {
      code: newCode,
      name: `Partner Drawings - ${staffData.name}`,
      description: 'Individual partner drawings',
      identifiers: staffData.identifiers,
      accountantLine: 'NOT ON P&L - Equity Withdrawal',
      type: 'non-business',
      personalization: 'Personalized',
      role: roleCode,
      staffMember: staffData.name,
      section: 'NON-BUSINESS'
    } : {
      code: newCode,
      name: `${roleName} - ${staffData.name}`,
      description: `Individual ${roleName.toLowerCase()} salary`,
      identifiers: staffData.identifiers,
      accountantLine: '',
      type: 'expense',
      personalization: 'Personalized',
      role: roleCode,
      staffMember: staffData.name,
      section: 'DIRECT STAFF COSTS'
    };

    const updatedMapping = [...categoryMapping, newCategory];
    setCategoryMapping(updatedMapping);

    setAppliedSuggestions(prev => new Set([...prev, `NEW_STAFF-${index}`]));

    setCreatingStaff(prev => {
      const newMap = new Map(prev);
      newMap.delete(index);
      return newMap;
    });
  };

  const cancelStaffCreation = (index) => {
    setCreatingStaff(prev => {
      const newMap = new Map(prev);
      newMap.delete(index);
      return newMap;
    });
  };

  const updateStaffCreationField = (index, field, value) => {
    setCreatingStaff(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(index);
      if (existing) {
        newMap.set(index, { ...existing, [field]: value });
      }
      return newMap;
    });
  };

  if (!isReady || !apiKey) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <Loader style={{ width: '32px', height: '32px', color: COLORS.slainteBlue, animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
        <p style={{ color: COLORS.textSecondary }}>
          {!apiKey ? 'Loading API key...' : 'Preparing AI analysis...'}
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

          {/* Tip Message */}
          {showTip && (
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
                  {tip}
                </div>
              </div>
            </div>
          )}

          {/* Analysis started message */}
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
                  {suggestions.length > 0
                    ? `Found ${suggestions.length} suggestion${suggestions.length > 1 ? 's' : ''}! Review them on the right.`
                    : 'Analysis complete. No new patterns found.'}
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
            Continue to Expenses
            <ArrowRight style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
      </div>

      {/* Right side - Action Card & Results */}
      <div style={{
        flex: '1 1 55%',
        minWidth: '400px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        opacity: tipComplete ? 1 : 0.3,
        transition: 'opacity 0.5s ease-out',
        pointerEvents: tipComplete ? 'auto' : 'none',
        overflowY: 'auto'
      }}>
        {/* Action Card */}
        <div style={{
          backgroundColor: COLORS.white,
          border: `3px solid ${COLORS.slainteBlue}`,
          borderRadius: '16px',
          padding: '1.5rem',
          flexShrink: 0
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
              <Users style={{ width: '24px', height: '24px', color: COLORS.slainteBlue }} />
            </div>

            <div style={{ flex: 1 }}>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: COLORS.textPrimary,
                marginBottom: '0.25rem'
              }}>
                Staff Payment Detection
              </h3>

              <p style={{
                fontSize: '0.875rem',
                color: COLORS.textSecondary,
                lineHeight: 1.5
              }}>
                AI will scan your transactions and suggest which ones are staff salary payments.
              </p>
            </div>
          </div>

          {/* Stats Row */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            <div style={{
              flex: 1,
              backgroundColor: COLORS.bgPage,
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              textAlign: 'center'
            }}>
              <p style={{ fontSize: '0.75rem', color: COLORS.textSecondary, marginBottom: '0.25rem' }}>Unidentified</p>
              <p style={{ fontSize: '1.25rem', fontWeight: 700, color: COLORS.highlightYellow }}>
                {unidentifiedTransactions.length}
              </p>
            </div>
            <div style={{
              flex: 1,
              backgroundColor: COLORS.bgPage,
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              textAlign: 'center'
            }}>
              <p style={{ fontSize: '0.75rem', color: COLORS.textSecondary, marginBottom: '0.25rem' }}>Staff Categories</p>
              <p style={{ fontSize: '1.25rem', fontWeight: 700, color: COLORS.slainteBlue }}>
                {categoryMapping.filter(c => c.personalization === 'Personalized' && ['3', '4', '5', '6', '7'].includes(c.role)).length}
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div style={{
              backgroundColor: `${COLORS.expenseColor}10`,
              border: `1px solid ${COLORS.expenseColor}`,
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1rem'
            }}>
              <p style={{ fontSize: '0.875rem', color: COLORS.expenseColor }}>{error}</p>
            </div>
          )}

          {/* Main Action Button */}
          <button
            onClick={startAnalysis}
            disabled={isAnalyzing || analysisComplete}
            style={{
              width: '100%',
              padding: '1rem',
              fontSize: '1rem',
              fontWeight: 600,
              color: COLORS.white,
              backgroundColor: isAnalyzing ? COLORS.textSecondary : analysisComplete ? COLORS.incomeColor : COLORS.slainteBlue,
              border: 'none',
              borderRadius: '8px',
              cursor: isAnalyzing || analysisComplete ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              transition: 'all 0.2s'
            }}
          >
            {isAnalyzing ? (
              <>
                <Loader style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite' }} />
                Analyzing...
              </>
            ) : analysisComplete ? (
              <>
                <CheckCircle style={{ width: '20px', height: '20px' }} />
                Analysis Complete
              </>
            ) : (
              <>
                <Brain style={{ width: '20px', height: '20px' }} />
                Analyze Transactions for Staff Payments
              </>
            )}
          </button>
        </div>

        {/* Suggestions List */}
        {suggestions.length > 0 && (
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
              Suggested Identifier Patterns
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {suggestions.map((suggestion, index) => {
                const isApplied = appliedSuggestions.has(`${suggestion.categoryCode}-${index}`) || appliedSuggestions.has(`NEW_STAFF-${index}`);
                const isNewCategory = suggestion.isNewCategory || suggestion.categoryCode === 'NEW_STAFF';
                const isCreating = creatingStaff.has(index);
                const staffData = creatingStaff.get(index);

                return (
                  <div
                    key={`${suggestion.categoryCode}-${index}`}
                    style={{
                      border: `2px solid ${isApplied ? COLORS.incomeColor : (isNewCategory ? COLORS.highlightYellow : COLORS.borderLight)}`,
                      borderRadius: '12px',
                      padding: '1rem',
                      backgroundColor: isApplied ? `${COLORS.incomeColor}10` : (isNewCategory ? `${COLORS.highlightYellow}10` : COLORS.white)
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <div>
                        <h5 style={{ fontSize: '0.9375rem', fontWeight: 600, color: COLORS.textPrimary }}>
                          {suggestion.categoryName}
                        </h5>
                        <p style={{ fontSize: '0.75rem', color: COLORS.textSecondary }}>
                          {isNewCategory ? (
                            <span style={{ color: COLORS.highlightYellow, fontWeight: 500 }}>New Staff Member</span>
                          ) : (
                            `Category: ${suggestion.categoryCode}`
                          )}
                        </p>
                      </div>
                      {isApplied && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: COLORS.incomeColor }}>
                          <CheckCircle style={{ width: '14px', height: '14px' }} />
                          {isNewCategory ? 'Created' : 'Applied'}
                        </span>
                      )}
                    </div>

                    <p style={{ fontSize: '0.8125rem', color: COLORS.textSecondary, marginBottom: '0.5rem' }}>
                      {suggestion.reasoning}
                    </p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.75rem' }}>
                      {suggestion.suggestedIdentifiers.map((identifier, idx) => (
                        <span
                          key={idx}
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontFamily: 'monospace',
                            backgroundColor: COLORS.bgPage,
                            color: COLORS.textPrimary
                          }}
                        >
                          {identifier}
                        </span>
                      ))}
                    </div>

                    {/* Inline Staff Creation Form */}
                    {isCreating && staffData && (
                      <div style={{
                        marginBottom: '0.75rem',
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: `1px solid ${COLORS.slainteBlue}`,
                        backgroundColor: COLORS.bgPage
                      }}>
                        <div style={{ marginBottom: '0.5rem' }}>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: COLORS.textPrimary, marginBottom: '0.25rem' }}>
                            Role
                          </label>
                          <select
                            value={staffData.role}
                            onChange={(e) => updateStaffCreationField(index, 'role', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              borderRadius: '6px',
                              border: `1px solid ${COLORS.borderLight}`,
                              fontSize: '0.875rem'
                            }}
                          >
                            <option value="Receptionist">Receptionist</option>
                            <option value="Nurse">Nurse</option>
                            <option value="Hygienist">Hygienist</option>
                            <option value="Phlebotomist">Phlebotomist</option>
                            <option value="GP Assistant">GP Assistant</option>
                            <option value="Practice Manager">Practice Manager</option>
                            <option value="Other Staff">Other Staff</option>
                            <option value="Partner">Partner</option>
                          </select>
                        </div>

                        <div style={{ marginBottom: '0.5rem' }}>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: COLORS.textPrimary, marginBottom: '0.25rem' }}>
                            Name
                          </label>
                          <input
                            type="text"
                            value={staffData.name}
                            onChange={(e) => updateStaffCreationField(index, 'name', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              borderRadius: '6px',
                              border: `1px solid ${COLORS.borderLight}`,
                              fontSize: '0.875rem'
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => createNewStaffCategory(index)}
                            disabled={!staffData.name.trim()}
                            style={{
                              flex: 1,
                              padding: '0.5rem',
                              fontSize: '0.8125rem',
                              fontWeight: 500,
                              color: COLORS.white,
                              backgroundColor: staffData.name.trim() ? COLORS.incomeColor : COLORS.borderLight,
                              border: 'none',
                              borderRadius: '6px',
                              cursor: staffData.name.trim() ? 'pointer' : 'not-allowed'
                            }}
                          >
                            Create Category
                          </button>
                          <button
                            onClick={() => cancelStaffCreation(index)}
                            style={{
                              padding: '0.5rem 0.75rem',
                              fontSize: '0.8125rem',
                              color: COLORS.textPrimary,
                              backgroundColor: COLORS.white,
                              border: `1px solid ${COLORS.borderLight}`,
                              borderRadius: '6px',
                              cursor: 'pointer'
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {!isApplied && !isCreating && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => applySuggestion(suggestion, index)}
                          style={{
                            flex: 1,
                            padding: '0.5rem 0.75rem',
                            fontSize: '0.8125rem',
                            fontWeight: 500,
                            color: COLORS.white,
                            backgroundColor: isNewCategory ? COLORS.highlightYellow : COLORS.incomeColor,
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.375rem'
                          }}
                        >
                          <Plus style={{ width: '14px', height: '14px' }} />
                          {isNewCategory ? 'Add Staff Member' : 'Add Identifiers'}
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
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Skip option */}
        {!analysisComplete && (
          <div style={{
            textAlign: 'center',
            paddingTop: '0.5rem'
          }}>
            <p style={{
              fontSize: '0.8125rem',
              color: COLORS.textSecondary
            }}>
              You can also skip this and categorize payments manually later
            </p>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

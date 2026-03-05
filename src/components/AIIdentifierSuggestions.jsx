import React, { useState, useEffect } from 'react';
import { Brain, Plus, X, CheckCircle, Loader } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import COLORS from '../utils/colors';
import { callClaude } from '../utils/claudeAPI';
import { MODELS } from '../data/modelConfig';

/**
 * AIIdentifierSuggestions
 *
 * Analyzes unidentified transactions and suggests identifier patterns to add to categories.
 * Uses AI to understand how staff names appear in actual bank transaction descriptions.
 */
export default function AIIdentifierSuggestions({ onClose, initialApiKey = '', hideApiKeyInput = false }) {
  const { unidentifiedTransactions, categoryMapping, setCategoryMapping } = useAppContext();

  const [apiKey, setApiKey] = useState(initialApiKey);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [appliedSuggestions, setAppliedSuggestions] = useState(new Set());
  const [error, setError] = useState(null);

  // For NEW_STAFF creation
  const [creatingStaff, setCreatingStaff] = useState(new Map()); // index -> {role, name}

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

  const analyzePatternsWithAI = async () => {
    if (!apiKey) {
      setError('Please enter your license key');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      // Save API key for future use
      localStorage.setItem('anthropic_api_key', apiKey);

      // Get sample of unidentified transactions (max 50 for performance)
      const sampleTransactions = unidentifiedTransactions
        .slice(0, 50)
        .map(t => t.details);

      // Get all staff AND partner categories (personalized ones)
      const staffCategories = categoryMapping.filter(c =>
        c.personalization === 'Personalized' &&
        (['3', '4', '5', '6', '7', '90'].includes(c.role))
      );

      console.log('[AIIdentifierSuggestions] Total categories:', categoryMapping.length);
      console.log('[AIIdentifierSuggestions] Personalized categories:', categoryMapping.filter(c => c.personalization === 'Personalized').length);

      const personalizedCats = categoryMapping.filter(c => c.personalization === 'Personalized');
      console.log('[AIIdentifierSuggestions] Personalized category roles:', personalizedCats.map(c => `${c.code}(role:${c.role})`).join(', '));

      console.log('[AIIdentifierSuggestions] Staff categories (3-7):', categoryMapping.filter(c => c.personalization === 'Personalized' && ['3', '4', '5', '6', '7'].includes(c.role)).length);
      console.log('[AIIdentifierSuggestions] Partner categories (90):', categoryMapping.filter(c => c.role === '90').length);
      console.log('[AIIdentifierSuggestions] Combined staff+partners for AI:', staffCategories.length);

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

      // Call Claude API using unified helper
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
        // Remove markdown code blocks if present
        let jsonText = resultText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        // Handle empty array case first (common when no patterns found)
        if (jsonText.startsWith('[]') || jsonText.includes('[]')) {
          const emptyArrayMatch = jsonText.match(/\[\s*\]/);
          if (emptyArrayMatch) {
            parsedSuggestions = [];
          }
        }

        // If not already parsed as empty array, try to extract JSON array with objects
        if (parsedSuggestions === undefined) {
          const arrayMatch = jsonText.match(/\[\s*\{[\s\S]*\}\s*\]/);
          if (arrayMatch) {
            jsonText = arrayMatch[0];
          }
          parsedSuggestions = JSON.parse(jsonText);
        }
      } catch (parseError) {
        console.error('Failed to parse AI response:', resultText);
        // If we can find an empty array in the text, treat it as "no suggestions"
        if (resultText.includes('[]')) {
          parsedSuggestions = [];
        } else {
          throw new Error('AI returned invalid format. Please try again.');
        }
      }

      // Filter out suggestions where ALL identifiers already exist
      const filteredSuggestions = parsedSuggestions.filter(suggestion => {
        // NEW_STAFF suggestions always pass through
        if (suggestion.isNewCategory || suggestion.categoryCode === 'NEW_STAFF') {
          return true;
        }

        // Find the category
        const category = categoryMapping.find(c => c.code === suggestion.categoryCode);
        if (!category) {
          console.warn(`Category ${suggestion.categoryCode} not found, skipping suggestion`);
          return false;
        }

        // Check if at least ONE suggested identifier is new
        const hasNewIdentifier = suggestion.suggestedIdentifiers.some(
          suggested => !category.identifiers.some(existing =>
            existing.toLowerCase() === suggested.toLowerCase()
          )
        );

        if (!hasNewIdentifier) {
          console.log(`Filtered out suggestion for ${category.name} - all identifiers already exist:`, suggestion.suggestedIdentifiers);
        }

        return hasNewIdentifier;
      });

      setSuggestions(filteredSuggestions);

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
    // Check if this is a NEW_STAFF suggestion
    const isNewCategory = suggestion.isNewCategory || suggestion.categoryCode === 'NEW_STAFF';

    if (isNewCategory) {
      // Show inline creation form
      const staffName = suggestion.categoryName.replace(' (New Staff Member)', '').replace(/\s*\(.*?\)\s*$/, '');
      let suggestedRole = suggestion.suggestedRole || 'Receptionist';

      // Normalize/validate the suggested role
      const validRoles = [
        'Receptionist', 'Nurse', 'Hygienist', 'Phlebotomist', 'GP Assistant', 'Dentist', 'Other Staff',
        'Partner', 'Associate', 'Practice Manager', 'Therapist', 'Technician',
        'Admin Staff', 'Cleaning Staff', 'Locum', 'Specialist', 'Consultant'
      ];

      // If AI suggested an invalid role (like "Unknown" or "Reception"), map it to a valid one
      if (!validRoles.includes(suggestedRole)) {
        // Try to match partial names
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

    // Find the category
    const categoryIndex = categoryMapping.findIndex(c => c.code === suggestion.categoryCode);
    if (categoryIndex === -1) {
      alert('Category not found. Please refresh and try again.');
      return;
    }

    const category = categoryMapping[categoryIndex];

    // Add new identifiers (filter out any that already exist)
    const newIdentifiers = suggestion.suggestedIdentifiers.filter(
      id => !category.identifiers.some(existing =>
        existing.toLowerCase() === id.toLowerCase()
      )
    );

    if (newIdentifiers.length === 0) {
      alert('All suggested identifiers already exist in this category.');
      return;
    }

    // Update category
    const updatedCategory = {
      ...category,
      identifiers: [...category.identifiers, ...newIdentifiers]
    };

    // Update category mapping
    const updatedMapping = [...categoryMapping];
    updatedMapping[categoryIndex] = updatedCategory;
    setCategoryMapping(updatedMapping);

    // Mark as applied using unique key
    setAppliedSuggestions(prev => new Set([...prev, `${suggestion.categoryCode}-${index}`]));

    console.log(`✓ Added ${newIdentifiers.length} identifiers to ${category.name}:`, newIdentifiers);
  };

  const dismissSuggestion = (index) => {
    setSuggestions(prev => prev.filter((s, i) => i !== index));
    // Also clear any creation form for this index
    setCreatingStaff(prev => {
      const newMap = new Map(prev);
      newMap.delete(index);
      return newMap;
    });
  };

  const createNewStaffCategory = (index) => {
    const staffData = creatingStaff.get(index);
    if (!staffData) return;

    console.log('Creating staff category with data:', staffData);

    // Map role names to role codes (including AI variations)
    const roleMap = {
      'Receptionist': '3',
      'Reception': '3',         // AI variation
      'Nurse': '4',
      'Nursing': '4',           // AI variation
      'Hygienist': '5',
      'Hygiene': '5',           // AI variation
      'Phlebotomist': '5',      // Same as hygienist category
      'Phlebotomy': '5',        // AI variation
      'GP Assistant': '6',      // GP assistants
      'Dentist': '6',
      'Dental': '6',            // AI variation
      'Other Staff': '7',
      'Partner': '90',          // SPECIAL: Partner drawings (non-business)
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

    console.log(`Mapped role "${staffData.role}" to code "${roleCode}"${isPartner ? ' (PARTNER DRAWINGS)' : ''}`);

    // Find the next available code for this role (use code prefix for reliability)
    const existingCodes = categoryMapping
      .filter(c => c.code.startsWith(`${roleCode}.`))
      .map(c => {
        const parts = c.code.split('.');
        return parts.length > 1 ? parseInt(parts[1]) : 0;
      });

    const nextIndex = existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : 1;
    const newCode = `${roleCode}.${nextIndex}`;

    // Check if this code already exists (safety check)
    if (categoryMapping.some(c => c.code === newCode)) {
      console.error(`⚠️ Category code ${newCode} already exists! This should not happen.`);
      alert(`Error: Category code ${newCode} already exists. Please refresh the page and try again.`);
      return;
    }

    // Create the new category (partners are special)
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
      accountantLine: '', // Could be set based on role
      type: 'expense',
      personalization: 'Personalized',
      role: roleCode,
      staffMember: staffData.name,
      section: 'DIRECT STAFF COSTS'
    };

    // Add to category mapping
    const updatedMapping = [...categoryMapping, newCategory];
    setCategoryMapping(updatedMapping);

    // Mark as applied
    setAppliedSuggestions(prev => new Set([...prev, `NEW_STAFF-${index}`]));

    // Clear the creation form
    setCreatingStaff(prev => {
      const newMap = new Map(prev);
      newMap.delete(index);
      return newMap;
    });

    console.log(`✓ Created new category: ${newCode} - ${newCategory.name}`);
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" style={{ overflow: 'auto' }}>
      <div className="bg-white rounded-lg shadow-xl w-full flex flex-col" style={{ maxWidth: '56rem', maxHeight: '90vh', overflow: 'hidden' }}>
        {/* Fixed Header */}
        <div className="p-6 border-b" style={{ flexShrink: 0 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain className="h-6 w-6" style={{ color: COLORS.slainteBlue }} />
              <h2 className="text-2xl font-bold" style={{ color: COLORS.darkGray }}>
                AI Identifier Suggestions
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
              Our AI will analyze your unidentified transactions and suggest identifier patterns
              to add to your staff categories. This helps automatically categorize salary payments
              based on how they actually appear in your bank statements.
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
              <p className="text-sm" style={{ color: COLORS.mediumGray }}>Staff Categories</p>
              <p className="text-2xl font-bold" style={{ color: COLORS.slainteBlue }}>
                {categoryMapping.filter(c => c.personalization === 'Personalized' && ['3', '4', '5', '6', '7'].includes(c.role)).length}
              </p>
            </div>
          </div>

          {/* License Key Input */}
          {!hideApiKeyInput && !suggestions.length && !isAnalyzing && (
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
          {!suggestions.length && !isAnalyzing && (
            <button
              onClick={analyzePatternsWithAI}
              disabled={!apiKey || unidentifiedTransactions.length === 0}
              className="w-full py-3 rounded-lg text-white font-medium flex items-center justify-center gap-2"
              style={{
                backgroundColor: (apiKey && unidentifiedTransactions.length > 0) ? COLORS.slainteBlue : COLORS.lightGray,
                cursor: (apiKey && unidentifiedTransactions.length > 0) ? 'pointer' : 'not-allowed'
              }}
            >
              <Brain className="h-5 w-5" />
              Analyze with AI
            </button>
          )}

          {/* Loading State */}
          {isAnalyzing && (
            <div className="text-center py-12">
              <Loader className="h-12 w-12 animate-spin mx-auto mb-4" style={{ color: COLORS.slainteBlue }} />
              <p className="text-lg font-medium" style={{ color: COLORS.darkGray }}>
                Analyzing transaction patterns...
              </p>
              <p className="text-sm mt-2" style={{ color: COLORS.mediumGray }}>
                This may take 10-30 seconds
              </p>
            </div>
          )}

          {/* Suggestions List */}
          {suggestions.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg" style={{ color: COLORS.darkGray }}>
                Suggested Identifier Patterns
              </h3>

              {suggestions.map((suggestion, index) => {
                const isApplied = appliedSuggestions.has(`${suggestion.categoryCode}-${index}`) || appliedSuggestions.has(`NEW_STAFF-${index}`);
                const isNewCategory = suggestion.isNewCategory || suggestion.categoryCode === 'NEW_STAFF';
                const isCreating = creatingStaff.has(index);
                const staffData = creatingStaff.get(index);

                return (
                  <div
                    key={`${suggestion.categoryCode}-${index}`}
                    className="border-2 rounded-lg p-4"
                    style={{
                      borderColor: isApplied ? COLORS.incomeColor : (isNewCategory ? COLORS.highlightYellow : COLORS.lightGray),
                      backgroundColor: isApplied ? `${COLORS.incomeColor}10` : (isNewCategory ? `${COLORS.highlightYellow}10` : COLORS.white)
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold" style={{ color: COLORS.darkGray }}>
                          {suggestion.categoryName}
                        </h4>
                        <p className="text-xs" style={{ color: COLORS.mediumGray }}>
                          {isNewCategory ? (
                            <span className="font-medium" style={{ color: COLORS.highlightYellow }}>
                              ⚠️ New Staff Member
                            </span>
                          ) : (
                            `Category: ${suggestion.categoryCode}`
                          )}
                        </p>
                      </div>
                      {isApplied && (
                        <span className="flex items-center gap-1 text-sm" style={{ color: COLORS.incomeColor }}>
                          <CheckCircle className="h-4 w-4" />
                          {isNewCategory ? 'Category Created' : 'Applied'}
                        </span>
                      )}
                    </div>

                    <div className="mb-3">
                      <p className="text-sm mb-2" style={{ color: COLORS.mediumGray }}>
                        {suggestion.reasoning}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {suggestion.suggestedIdentifiers.map((identifier, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 rounded-full text-sm font-mono"
                            style={{ backgroundColor: COLORS.backgroundGray, color: COLORS.darkGray }}
                          >
                            {identifier}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Inline Staff Creation Form */}
                    {isCreating && staffData && (
                      <div className="mb-3 p-3 rounded-lg border" style={{ borderColor: COLORS.slainteBlue, backgroundColor: COLORS.backgroundGray }}>
                        <h5 className="font-semibold text-sm mb-3" style={{ color: COLORS.darkGray }}>
                          Create New Staff Category
                        </h5>

                        <div className="space-y-3">
                          {/* Role Selection */}
                          <div>
                            <label className="block text-xs font-medium mb-1" style={{ color: COLORS.darkGray }}>
                              Role
                            </label>
                            <select
                              value={staffData.role}
                              onChange={(e) => updateStaffCreationField(index, 'role', e.target.value)}
                              className="w-full border rounded px-3 py-2 text-sm"
                              style={{ borderColor: COLORS.lightGray }}
                            >
                              <optgroup label="Common Roles">
                                <option value="Receptionist">Receptionist</option>
                                <option value="Nurse">Nurse</option>
                                <option value="Hygienist">Hygienist</option>
                                <option value="Phlebotomist">Phlebotomist</option>
                                <option value="GP Assistant">GP Assistant</option>
                                <option value="Dentist">Dentist</option>
                                <option value="Other Staff">Other Staff</option>
                              </optgroup>
                              <optgroup label="Other Roles">
                                <option value="Partner">Partner</option>
                                <option value="Associate">Associate</option>
                                <option value="Practice Manager">Practice Manager</option>
                                <option value="Therapist">Therapist</option>
                                <option value="Technician">Technician</option>
                                <option value="Admin Staff">Admin Staff</option>
                                <option value="Cleaning Staff">Cleaning Staff</option>
                                <option value="Locum">Locum</option>
                                <option value="Specialist">Specialist</option>
                                <option value="Consultant">Consultant</option>
                              </optgroup>
                            </select>
                          </div>

                          {/* Name Input */}
                          <div>
                            <label className="block text-xs font-medium mb-1" style={{ color: COLORS.darkGray }}>
                              Staff Name
                            </label>
                            <input
                              type="text"
                              value={staffData.name}
                              onChange={(e) => updateStaffCreationField(index, 'name', e.target.value)}
                              className="w-full border rounded px-3 py-2 text-sm"
                              style={{ borderColor: COLORS.lightGray }}
                              placeholder="e.g., Joan Smith"
                            />
                          </div>

                          {/* Preview */}
                          <div className="p-2 rounded text-xs" style={{ backgroundColor: `${COLORS.slainteBlue}15`, color: COLORS.darkGray }}>
                            <strong>Will create:</strong> {staffData.role} - {staffData.name}
                            <br />
                            <strong>Identifiers:</strong> {staffData.identifiers.join(', ')}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={() => createNewStaffCategory(index)}
                              disabled={!staffData.name.trim()}
                              className="flex-1 px-4 py-2 rounded text-white font-medium text-sm"
                              style={{
                                backgroundColor: staffData.name.trim() ? COLORS.incomeColor : COLORS.lightGray,
                                cursor: staffData.name.trim() ? 'pointer' : 'not-allowed'
                              }}
                            >
                              Create Category
                            </button>
                            <button
                              onClick={() => cancelStaffCreation(index)}
                              className="px-4 py-2 rounded border text-sm"
                              style={{ borderColor: COLORS.lightGray, color: COLORS.darkGray }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {!isApplied && !isCreating && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => applySuggestion(suggestion, index)}
                          className="flex-1 px-4 py-2 rounded text-white font-medium flex items-center justify-center gap-2"
                          style={{ backgroundColor: isNewCategory ? COLORS.highlightYellow : COLORS.incomeColor }}
                        >
                          <Plus className="h-4 w-4" />
                          {isNewCategory ? 'Add This Staff Member' : 'Add These Identifiers'}
                        </button>
                        <button
                          onClick={() => dismissSuggestion(index)}
                          className="px-4 py-2 rounded border"
                          style={{ borderColor: COLORS.lightGray, color: COLORS.mediumGray }}
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
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

        {/* Fixed Footer - only shown when there are suggestions */}
        {suggestions.length > 0 && (
          <div className="p-6 border-t" style={{ flexShrink: 0, borderColor: COLORS.lightGray }}>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setSuggestions([]);
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

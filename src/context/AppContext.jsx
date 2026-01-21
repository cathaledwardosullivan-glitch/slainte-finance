import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import Papa from 'papaparse';

// Import utilities and default data
// Correct - go up one level from /context/ to /src/, then into subfolders
import { DEFAULT_CATEGORY_MAPPING } from "../data/categoryMappings";
import { extractLearningPatterns, processTransactionData, categorizeTransaction, categorizeTransactionSimple } from "../utils/transactionProcessor";
import {
    saveTransactions,
    loadTransactions,
    saveUnidentifiedTransactions,
    loadUnidentifiedTransactions,
    saveCategoryMapping,
    loadCategoryMapping,
    saveSettings,
    loadSettings,
    clearAllStorage
} from "../utils/storageUtils";

// 1. Create the context
const AppContext = createContext(null);

// 2. Create the Provider component
export const AppProvider = ({ children }) => {
    // --- STATE MANAGEMENT ---
    // All state that was in App.jsx is now managed here.
    const [transactions, setTransactions] = useState([]);
    const [unidentifiedTransactions, setUnidentifiedTransactions] = useState([]);
    const [categoryMapping, setCategoryMapping] = useState(DEFAULT_CATEGORY_MAPPING);
    const [paymentAnalysisData, setPaymentAnalysisData] = useState([]);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [showSensitiveData, setShowSensitiveData] = useState(true);
    const [useRollingYear, setUseRollingYear] = useState(false); // New: toggle for rolling 12 months
    const [isLoading, setIsLoading] = useState(true);

    // AI Learning System - Track user corrections to improve AI suggestions
    const [aiCorrections, setAiCorrections] = useState({
        expense_categorization: [],
        repeating_transactions: [],
        chat_preferences: []
    });

    // Ref to track the previous categoryMapping to detect actual changes
    const prevCategoryMappingRef = useRef(null);

    // --- DATA PERSISTENCE & LOADING ---
    // Sync all localStorage data to Electron's file storage (for API access)
    const syncAllToElectron = async () => {
        if (!window.electronAPI?.isElectron) return;

        console.log('[AppContext] Syncing all data to Electron storage for API access...');

        const keysToSync = [
            'gp_finance_transactions',
            'gp_finance_unidentified',
            'gp_finance_category_mapping',
            'gp_finance_payment_analysis',
            'gp_finance_saved_reports',
            'gp_finance_settings',
            'slainte_practice_profile'
        ];

        for (const key of keysToSync) {
            const value = localStorage.getItem(key);
            if (value) {
                try {
                    // Parse and re-stringify to ensure clean data
                    // Handle wrapped format from storageUtils
                    let dataToSync = value;
                    try {
                        const parsed = JSON.parse(value);
                        // If it's wrapped format, extract the data
                        if (parsed && typeof parsed === 'object' && 'data' in parsed) {
                            dataToSync = JSON.stringify(parsed.data);
                        }
                    } catch (e) {
                        // Not JSON, sync as-is
                    }
                    await window.electronAPI.setLocalStorage(key, dataToSync);
                } catch (err) {
                    console.error(`[AppContext] Failed to sync ${key}:`, err);
                }
            }
        }
        console.log('[AppContext] Sync complete');
    };

    // Load data on app startup
    useEffect(() => {
        const loadAllData = async () => {
            setIsLoading(true);
            try {
                const savedTransactions = loadTransactions();
                const savedUnidentified = loadUnidentifiedTransactions();
                const savedCategories = loadCategoryMapping();
                const savedSettings = loadSettings();
                const savedPaymentAnalysis = JSON.parse(localStorage.getItem('gp_finance_payment_analysis') || '[]');
                const savedAICorrections = JSON.parse(localStorage.getItem('slainte_ai_corrections') || JSON.stringify({
                    expense_categorization: [],
                    repeating_transactions: [],
                    chat_preferences: []
                }));

                // Migrate missing default categories into saved data
                let finalCategories = savedCategories || DEFAULT_CATEGORY_MAPPING;
                if (savedCategories) {
                    const savedCodes = new Set(savedCategories.map(c => c.code));
                    const missingCategories = DEFAULT_CATEGORY_MAPPING.filter(defaultCat =>
                        !savedCodes.has(defaultCat.code) &&
                        defaultCat.personalization !== 'Personalized' // Don't add personalized templates
                    );

                    if (missingCategories.length > 0) {
                        console.log(`✓ Migration: Adding ${missingCategories.length} missing default categories:`, missingCategories.map(c => c.code));
                        finalCategories = [...savedCategories, ...missingCategories].sort((a, b) => {
                            const aCode = parseFloat(a.code);
                            const bCode = parseFloat(b.code);
                            return aCode - bCode;
                        });
                        saveCategoryMapping(finalCategories);
                    }
                }

                setTransactions(savedTransactions);
                setUnidentifiedTransactions(savedUnidentified);
                setPaymentAnalysisData(savedPaymentAnalysis);
                setCategoryMapping(finalCategories);

                // Determine the best year to select:
                // 1. Use saved year if it has transactions
                // 2. Otherwise use the most recent year with data
                // 3. Fall back to current year
                const availableYears = Array.from(new Set(
                    savedTransactions
                        .filter(t => t.date)
                        .map(t => {
                            const year = new Date(t.date).getFullYear();
                            return (year >= 1900 && year <= 2100) ? year : null;
                        })
                        .filter(Boolean)
                )).sort((a, b) => b - a);

                let yearToSelect = savedSettings.selectedYear || new Date().getFullYear();

                // If saved year has no transactions, switch to most recent year with data
                if (availableYears.length > 0 && !availableYears.includes(yearToSelect)) {
                    yearToSelect = availableYears[0]; // Most recent year with data
                    console.log(`[AppContext] Saved year ${savedSettings.selectedYear} has no data, switching to ${yearToSelect}`);
                }

                setSelectedYear(yearToSelect);
                setShowSensitiveData(savedSettings.showSensitiveData !== false);
                setUseRollingYear(savedSettings.useRollingYear || false);
                setAiCorrections(savedAICorrections);

                console.log(`Context loaded ${savedTransactions.length} transactions, ${finalCategories.reduce((sum, cat) => sum + (cat.identifiers?.length || 0), 0)} identifiers. Selected year: ${yearToSelect}`);

                // Sync all data to Electron storage for mobile API access
                await syncAllToElectron();
            } catch (error) {
                console.error('Error loading data into context:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadAllData();
    }, []);

    // Auto-save data whenever it changes
    useEffect(() => { if (!isLoading) saveTransactions(transactions); }, [transactions, isLoading]);
    useEffect(() => { if (!isLoading) saveUnidentifiedTransactions(unidentifiedTransactions); }, [unidentifiedTransactions, isLoading]);
    useEffect(() => {
        if (!isLoading) {
            saveCategoryMapping(categoryMapping);

            // Check if categoryMapping actually changed (not just initial load)
            if (prevCategoryMappingRef.current !== null) {
                // Recategorize unidentified transactions when category identifiers change
                recategorizeUnidentifiedTransactions();
            }
            prevCategoryMappingRef.current = categoryMapping;
        }
    }, [categoryMapping, isLoading]);
    useEffect(() => {
        if (!isLoading) {
            localStorage.setItem('gp_finance_payment_analysis', JSON.stringify(paymentAnalysisData));
            // Sync to Electron for API access
            if (window.electronAPI?.isElectron) {
                window.electronAPI.setLocalStorage('gp_finance_payment_analysis', JSON.stringify(paymentAnalysisData));
            }
        }
    }, [paymentAnalysisData, isLoading]);
    useEffect(() => { if (!isLoading) saveSettings({ selectedYear, showSensitiveData, useRollingYear }); }, [selectedYear, showSensitiveData, useRollingYear, isLoading]);
    useEffect(() => { if (!isLoading) localStorage.setItem('slainte_ai_corrections', JSON.stringify(aiCorrections)); }, [aiCorrections, isLoading]);


    // --- CORE BUSINESS LOGIC ---
    // All helper functions that need access to global state are now here.
    const getAvailableYears = () => {
        const years = new Set(transactions.map(t => {
            if (!t.date) return null;
            const parsed = new Date(t.date);
            const year = parsed.getFullYear();
            // Check for invalid dates (NaN or unreasonable years)
            if (isNaN(year) || year < 1900 || year > 2100) {
                return null;
            }
            return year;
        }));
        return Array.from(years).filter(Boolean).sort((a, b) => b - a);
    };

    const manualCategorize = (transactionId, categoryCode, shouldLearn = true) => {
        const category = categoryMapping.find(c => c.code === categoryCode);
        const transaction = unidentifiedTransactions.find(t => t.id === transactionId);
        if (!category || !transaction) return;

        // Categorize the transaction
        const updatedTransaction = { ...transaction, category };
        setTransactions(prev => [...prev, updatedTransaction]);
        setUnidentifiedTransactions(prev => prev.filter(t => t.id !== transactionId));

        // If learning enabled, add patterns to category identifiers
        if (shouldLearn) {
            const patterns = extractLearningPatterns(transaction.details);

            // Filter to relevant patterns only
            const relevantPatterns = patterns.filter(pattern =>
                pattern.length >= 3 &&
                pattern.length <= 20 &&
                !['LTD', 'LIMITED', 'THE', 'AND'].includes(pattern.toUpperCase())
            );

            // Filter out patterns that already exist in this category
            const newPatterns = relevantPatterns.filter(p =>
                !category.identifiers.some(id =>
                    id.toUpperCase() === p.toUpperCase()
                )
            );

            if (newPatterns.length > 0) {
                // Update category mapping with new identifiers
                setCategoryMapping(prev => prev.map(cat => {
                    if (cat.code === categoryCode) {
                        return {
                            ...cat,
                            identifiers: [...cat.identifiers, ...newPatterns]
                        };
                    }
                    return cat;
                }));

                console.log(`✓ Learned ${newPatterns.length} new patterns for ${category.name}:`, newPatterns);
            }
        }
    };

    const recategorizeTransaction = (transactionId, categoryCode, shouldLearn = true) => {
        const category = categoryMapping.find(c => c.code === categoryCode);
        if (!category) return;

        const transaction = transactions.find(t => t.id === transactionId);
        if (!transaction) return;

        // Update the transaction with new category
        setTransactions(prev =>
            prev.map(t => t.id === transactionId ? { ...t, category } : t)
        );

        // Learn from this recategorization if requested
        if (shouldLearn) {
            const patterns = extractLearningPatterns(transaction.details);

            const relevantPatterns = patterns.filter(pattern =>
                pattern.length >= 3 &&
                pattern.length <= 20 &&
                !['LTD', 'LIMITED', 'THE', 'AND'].includes(pattern.toUpperCase())
            );

            const newPatterns = relevantPatterns.filter(p =>
                !category.identifiers.some(id =>
                    id.toUpperCase() === p.toUpperCase()
                )
            );

            if (newPatterns.length > 0) {
                setCategoryMapping(prev => prev.map(cat => {
                    if (cat.code === categoryCode) {
                        return {
                            ...cat,
                            identifiers: [...cat.identifiers, ...newPatterns]
                        };
                    }
                    return cat;
                }));

                console.log(`✓ Learned ${newPatterns.length} new patterns for ${category.name}:`, newPatterns);
            }
        }
    };

    // Auto-recategorize unidentified transactions when categoryMapping changes
    const recategorizeUnidentifiedTransactions = () => {
        if (isLoading || unidentifiedTransactions.length === 0) return;

        const newlyCategorized = [];
        const stillUnidentified = [];

        unidentifiedTransactions.forEach(transaction => {
            const details = transaction.details?.toString() || '';
            let matchedCategory = null;

            // Check against all category identifiers
            for (const category of categoryMapping) {
                for (const identifier of category.identifiers) {
                    if (details.toUpperCase().includes(identifier.toString().toUpperCase())) {
                        matchedCategory = category;
                        break;
                    }
                }
                if (matchedCategory) break;
            }

            if (matchedCategory) {
                newlyCategorized.push({ ...transaction, category: matchedCategory });
            } else {
                stillUnidentified.push(transaction);
            }
        });

        if (newlyCategorized.length > 0) {
            console.log(`✓ Auto-categorized ${newlyCategorized.length} transactions based on updated identifiers`);
            setTransactions(prev => [...prev, ...newlyCategorized]);
            setUnidentifiedTransactions(stillUnidentified);
        }
    };

    // Re-apply categories to ALL transactions based on current identifier mappings
    // Use this when identifiers have been moved between subcategories
    const reapplyCategories = () => {
        if (isLoading || transactions.length === 0) return { updated: 0, unchanged: 0 };

        let updatedCount = 0;
        let unchangedCount = 0;

        const updatedTransactions = transactions.map(transaction => {
            const details = transaction.details?.toString() || '';
            let bestMatch = null;
            let matchedIdentifier = null;

            // Find the best matching category based on current identifiers
            for (const category of categoryMapping) {
                for (const identifier of category.identifiers || []) {
                    if (details.toUpperCase().includes(identifier.toString().toUpperCase())) {
                        // If we find a match, check if it's more specific (longer identifier usually = more specific)
                        if (!matchedIdentifier || identifier.length > matchedIdentifier.length) {
                            bestMatch = category;
                            matchedIdentifier = identifier;
                        }
                    }
                }
            }

            // If we found a match and it's different from current category, update
            if (bestMatch && transaction.category?.code !== bestMatch.code) {
                updatedCount++;
                console.log(`  Updating: "${details.substring(0, 40)}..." from ${transaction.category?.name || 'Unknown'} to ${bestMatch.name}`);
                return { ...transaction, category: bestMatch };
            }

            unchangedCount++;
            return transaction;
        });

        if (updatedCount > 0) {
            console.log(`✓ Re-categorized ${updatedCount} transactions based on current identifier mappings`);
            setTransactions(updatedTransactions);
        } else {
            console.log('No transactions needed re-categorization');
        }

        return { updated: updatedCount, unchanged: unchangedCount };
    };

    const uploadTransactions = async (file) => {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('No file provided'));
                return;
            }

            const fileExtension = file.name.split('.').pop().toLowerCase();

            const processUploadedData = (results) => {
                try {
                    // Helper function to categorize with simplified parent categories (for onboarding)
                    const categorizeTransactionWithContext = (transaction) => {
                        return categorizeTransactionSimple(transaction, categoryMapping);
                    };

                    const { categorized, unidentified, autoIncome } = processTransactionData(
                        results,
                        file,
                        categorizeTransactionWithContext
                    );

                    // Find the "Income Unclassified" category (code 1.0) for auto-income transactions
                    const incomeUnclassifiedCategory = categoryMapping.find(c => c.code === '1.0') ||
                        categoryMapping.find(c => c.name === 'Income Unclassified') ||
                        categoryMapping.find(c => c.type === 'income');

                    // Process auto-income transactions
                    const processedAutoIncome = (autoIncome || []).map(t => ({
                        ...t,
                        category: incomeUnclassifiedCategory,
                        autoCategorizied: true // Flag to indicate this was auto-categorized
                    }));

                    setTransactions(prev => [...prev, ...categorized, ...processedAutoIncome]);
                    setUnidentifiedTransactions(prev => [...prev, ...unidentified]);

                    const totalCategorized = categorized.length + processedAutoIncome.length;
                    console.log(`[AppContext] Uploaded ${categorized.length} categorized + ${processedAutoIncome.length} auto-income + ${unidentified.length} unidentified transactions`);
                    resolve({ categorized: totalCategorized, unidentified: unidentified.length, autoIncome: processedAutoIncome.length });
                } catch (error) {
                    console.error('Error processing transactions:', error);
                    reject(error);
                }
            };

            // Handle CSV files
            if (fileExtension === 'csv') {
                Papa.parse(file, {
                    header: true,
                    dynamicTyping: true,
                    skipEmptyLines: true,
                    complete: processUploadedData,
                    error: (error) => {
                        console.error('CSV parsing error:', error);
                        reject(error);
                    }
                });
            } else {
                reject(new Error('Unsupported file format. Please upload a CSV file.'));
            }
        });
    };

    const clearAllData = async () => {
        if (window.confirm('Are you sure you want to clear all data? This cannot be undone.')) {
            setTransactions([]);
            setUnidentifiedTransactions([]);
            setCategoryMapping(DEFAULT_CATEGORY_MAPPING);
            setPaymentAnalysisData([]);
            clearAllStorage();
            localStorage.removeItem('gp_finance_payment_analysis');
            localStorage.removeItem('slainte_onboarding_complete');
            localStorage.removeItem('slainte_practice_profile');
            localStorage.removeItem('slainte_ai_corrections');
            localStorage.removeItem('gp_finance_category_preferences');

            // Clear API key from both storage locations to restart full onboarding
            localStorage.removeItem('anthropic_api_key'); // Old localStorage key
            if (window.electronAPI?.isElectron) {
                await window.electronAPI.setLocalStorage('claude_api_key', null); // Electron storage
            }

            alert('All data has been cleared successfully. The page will reload to restart onboarding.');
            window.location.reload();
        }
    };

    // --- AI LEARNING SYSTEM ---
    /**
     * Record when user corrects an AI suggestion
     * @param {string} feature - Feature name ('expense_categorization', 'repeating_transactions', 'chat_preferences')
     * @param {string} pattern - The pattern/identifier being categorized
     * @param {object} aiSuggestion - What the AI suggested {code, name, parentCategory}
     * @param {object} userChoice - What the user chose {code, name, parentCategory}
     * @param {object} context - Optional context (amount, type, details, etc.)
     */
    const recordAICorrection = (feature, pattern, aiSuggestion, userChoice, context = {}) => {
        // Don't record if user accepted AI suggestion
        if (aiSuggestion.code === userChoice.code) {
            return;
        }

        setAiCorrections(prev => {
            const featureCorrections = prev[feature] || [];

            // Check if we already have a correction for this pattern
            const existingIndex = featureCorrections.findIndex(c =>
                c.pattern.toUpperCase() === pattern.toUpperCase()
            );

            const newCorrection = {
                pattern,
                aiSuggested: aiSuggestion,
                userChose: userChoice,
                context,
                timestamp: Date.now(),
                frequency: 1
            };

            let updatedCorrections;
            if (existingIndex >= 0) {
                // Update existing correction - increment frequency
                updatedCorrections = [...featureCorrections];
                updatedCorrections[existingIndex] = {
                    ...newCorrection,
                    frequency: featureCorrections[existingIndex].frequency + 1
                };
            } else {
                // Add new correction
                updatedCorrections = [...featureCorrections, newCorrection];
            }

            // Keep only the most recent 100 corrections per feature
            if (updatedCorrections.length > 100) {
                updatedCorrections = updatedCorrections
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .slice(0, 100);
            }

            console.log(`✓ AI Learning: Recorded correction for "${pattern}" in ${feature}`);
            console.log(`  AI suggested: ${aiSuggestion.name}`);
            console.log(`  User chose: ${userChoice.name}`);

            return {
                ...prev,
                [feature]: updatedCorrections
            };
        });
    };

    /**
     * Get formatted AI corrections to include in prompts
     * @param {string} feature - Feature name
     * @param {number} limit - Max number of corrections to include (default 20)
     * @returns {string} Formatted corrections for prompt
     */
    const getAICorrectionsPrompt = (feature, limit = 20) => {
        const corrections = aiCorrections[feature] || [];

        if (corrections.length === 0) {
            return '';
        }

        // Get most recent and most frequent corrections
        const topCorrections = corrections
            .sort((a, b) => {
                // Sort by frequency first, then by recency
                if (b.frequency !== a.frequency) {
                    return b.frequency - a.frequency;
                }
                return b.timestamp - a.timestamp;
            })
            .slice(0, limit);

        const formattedCorrections = topCorrections.map(c => {
            let contextStr = '';
            if (c.context.amount) contextStr += ` (€${Math.abs(c.context.amount)})`;
            if (c.context.type) contextStr += ` [${c.context.type}]`;

            return `- Pattern: "${c.pattern}"${contextStr}\n  ✗ Wrong: ${c.aiSuggested.name} (${c.aiSuggested.code})\n  ✓ Correct: ${c.userChose.name} (${c.userChose.code})${c.frequency > 1 ? ` [Corrected ${c.frequency}x]` : ''}`;
        }).join('\n');

        return `\n## IMPORTANT: Learn from these ${topCorrections.length} previous corrections:\n${formattedCorrections}\n\nAVOID making the same mistakes. Apply these patterns to similar transactions.\n`;
    };

    /**
     * Clear old AI corrections older than specified days
     * @param {number} daysOld - Age threshold in days (default 90)
     */
    const clearOldCorrections = (daysOld = 90) => {
        const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);

        setAiCorrections(prev => {
            const updated = {};
            let totalRemoved = 0;

            Object.keys(prev).forEach(feature => {
                const filtered = prev[feature].filter(c => c.timestamp > cutoffTime);
                totalRemoved += prev[feature].length - filtered.length;
                updated[feature] = filtered;
            });

            if (totalRemoved > 0) {
                console.log(`✓ Cleaned up ${totalRemoved} old AI corrections (older than ${daysOld} days)`);
            }

            return updated;
        });
    };

    /**
     * Get AI learning statistics
     * @returns {object} Stats about AI corrections
     */
    const getAILearningStats = () => {
        const stats = {};

        Object.keys(aiCorrections).forEach(feature => {
            const corrections = aiCorrections[feature] || [];
            stats[feature] = {
                totalCorrections: corrections.length,
                totalFrequency: corrections.reduce((sum, c) => sum + c.frequency, 0),
                oldestCorrection: corrections.length > 0
                    ? new Date(Math.min(...corrections.map(c => c.timestamp)))
                    : null,
                newestCorrection: corrections.length > 0
                    ? new Date(Math.max(...corrections.map(c => c.timestamp)))
                    : null
            };
        });

        return stats;
    };

    // --- VALUE PROVIDED TO CONSUMERS ---
    const value = {
        isLoading,
        transactions, setTransactions,
        unidentifiedTransactions, setUnidentifiedTransactions,
        categoryMapping, setCategoryMapping,
        paymentAnalysisData, setPaymentAnalysisData,
        selectedYear, setSelectedYear,
        showSensitiveData, setShowSensitiveData,
        useRollingYear, setUseRollingYear,
        getAvailableYears,
        manualCategorize,
        recategorizeTransaction,
        reapplyCategories,
        uploadTransactions,
        clearAllData,
        // AI Learning System
        aiCorrections,
        recordAICorrection,
        getAICorrectionsPrompt,
        clearOldCorrections,
        getAILearningStats
    };

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};

// 3. Create a custom hook for easy consumption
export const useAppContext = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};
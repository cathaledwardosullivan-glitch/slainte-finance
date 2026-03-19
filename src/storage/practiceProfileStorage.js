/**
 * Local Storage abstraction for Practice Profile
 *
 * This module provides a clean interface for storing and retrieving
 * practice profile data using localStorage. The interface is designed
 * to be easily replaceable with a backend API in the future.
 *
 * PRIVACY NOTE:
 * - This data is stored locally only (not sent to servers)
 * - Safe for 1-5 users on shared device
 * - For scaling beyond 5 users, migrate to backend with auth
 */

import { generatePracticeId } from '../data/practiceProfileSchemaV2';

const STORAGE_KEY = 'slainte_practice_profile';

/**
 * Get the current practice profile from localStorage
 * @returns {Object|null} The practice profile object or null if not found
 */
export function get() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return null;

        const parsed = JSON.parse(data);

        // Convert ISO strings back to Date objects
        if (parsed.metadata) {
            if (parsed.metadata.createdAt) {
                parsed.metadata.createdAt = new Date(parsed.metadata.createdAt);
            }
            if (parsed.metadata.lastUpdated) {
                parsed.metadata.lastUpdated = new Date(parsed.metadata.lastUpdated);
            }
        }

        return parsed;
    } catch (error) {
        console.error('Error reading practice profile from localStorage:', error);
        return null;
    }
}

/**
 * Save a complete practice profile to localStorage
 * @param {Object} profile - The complete practice profile object
 * @returns {boolean} True if save was successful
 */
export function save(profile) {
    try {
        // Update metadata timestamps
        const now = new Date();
        const profileWithMetadata = {
            ...profile,
            metadata: {
                ...profile.metadata,
                practiceId: profile.metadata?.practiceId || generatePracticeId(),
                lastUpdated: now,
                createdAt: profile.metadata?.createdAt || now
            }
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(profileWithMetadata));
        return true;
    } catch (error) {
        console.error('Error saving practice profile to localStorage:', error);
        return false;
    }
}

/**
 * Update specific fields in the practice profile
 * @param {Object} updates - Object containing fields to update
 * @returns {boolean} True if update was successful
 */
export function update(updates) {
    try {
        const current = get();
        if (!current) {
            console.error('Cannot update: no existing profile found');
            return false;
        }

        const updated = deepMerge(current, updates);
        return save(updated);
    } catch (error) {
        console.error('Error updating practice profile:', error);
        return false;
    }
}

/**
 * Mark the setup as complete and trigger one-time Practice ID registration
 * @returns {boolean} True if update was successful
 */
export function completeSetup() {
    const result = update({
        metadata: {
            setupComplete: true,
            setupCompletedAt: new Date()
        }
    });

    // Fire one-time Practice ID registration
    const profile = get();
    if (profile && !profile.metadata?.practiceIdRegistered) {
        registerPracticeId(profile);
    }

    return result;
}

/**
 * One-time registration: sends {practiceId, practiceName} to CRM
 * so the mapping between anonymous ID and practice is established.
 * Skips registration for demo profiles and profiles without a practice name.
 * @param {Object} profile - The practice profile
 */
function registerPracticeId(profile) {
    const practiceId = profile.metadata?.practiceId;
    const practiceName = profile.practiceDetails?.practiceName || '';

    if (!practiceId) return;

    // Skip demo profiles — demo mode should not trigger registration
    if (profile.metadata?.isDemoMode) {
        console.log('[PracticeID] Skipping registration for demo profile');
        return;
    }

    // Require a practice name — avoids registering before profile is fully populated
    if (!practiceName.trim()) {
        console.log('[PracticeID] Skipping registration — practice name is blank');
        return;
    }

    const submitFn = window.electronAPI?.submitRegistration || window.electronAPI?.submitFeedback;
    if (submitFn) {
        submitFn({
            practiceId,
            practiceName,
            appVersion: window.electronAPI?.getAppVersion ? 'fetching' : 'unknown',
            os: navigator.userAgent,
            timestamp: new Date().toISOString()
        }).then(() => {
            const p = get();
            if (p) {
                p.metadata.practiceIdRegistered = true;
                save(p);
            }
        }).catch(err => {
            console.error('[PracticeID] Registration failed:', err);
        });
    } else {
        console.log('[PracticeID] Dev mode — would register:', { practiceId, practiceName });
    }
}

/**
 * Check if setup has been completed
 * @returns {boolean} True if setup is complete
 */
export function isSetupComplete() {
    const profile = get();
    return profile?.metadata?.setupComplete === true;
}

/**
 * Check if terms of service have been accepted for the required version
 * @param {string} requiredVersion - The minimum ToS version required
 * @returns {boolean} True if terms have been accepted for this version
 */
export function hasAcceptedTerms(requiredVersion) {
    const profile = get();
    const termsAccepted = profile?.metadata?.termsAccepted;

    if (!termsAccepted || !termsAccepted.version || !termsAccepted.acceptedAt) {
        return false;
    }

    // Simple version comparison (assumes semver-like format)
    // For now, we just check if versions match exactly
    // In future, could implement proper semver comparison
    return termsAccepted.version === requiredVersion;
}

/**
 * Record acceptance of terms of service
 * @param {Object} termsData - Terms acceptance data { version, acceptedAt, scrolledToEnd }
 * @returns {boolean} True if save was successful
 */
export function acceptTerms(termsData) {
    return update({
        metadata: {
            termsAccepted: {
                version: termsData.version,
                acceptedAt: termsData.acceptedAt || new Date().toISOString(),
                scrolledToEnd: termsData.scrolledToEnd || false
            }
        }
    });
}

/**
 * Get terms acceptance info
 * @returns {Object|null} Terms acceptance data or null if not accepted
 */
export function getTermsAcceptance() {
    const profile = get();
    return profile?.metadata?.termsAccepted || null;
}

/**
 * Check if Local Only Mode is enabled
 * @returns {boolean} True if Local Only Mode is active
 */
export function isLocalOnlyMode() {
    const profile = get();
    return profile?.metadata?.localOnlyMode === true;
}

/**
 * Set Local Only Mode
 * @param {boolean} enabled - Whether to enable or disable Local Only Mode
 * @returns {boolean} True if update was successful
 */
export function setLocalOnlyMode(enabled) {
    return update({
        metadata: {
            localOnlyMode: enabled,
            localOnlyModeSetAt: new Date().toISOString()
        }
    });
}

/**
 * Clear all practice profile data
 * @returns {boolean} True if clear was successful
 */
export function clear() {
    try {
        localStorage.removeItem(STORAGE_KEY);
        return true;
    } catch (error) {
        console.error('Error clearing practice profile:', error);
        return false;
    }
}

/**
 * Create an empty practice profile with default structure
 * @returns {Object} Empty practice profile object
 */
export function createEmpty() {
    return {
        practiceDetails: {
            practiceName: '',
            location: '',
            numberOfGPs: null,
            practiceType: '', // e.g., 'urban', 'rural', 'semi-rural'
        },
        gmsContract: {
            panelSize: null,
            averageCapitationRate: null, // per patient per year
            gmsIncomePercentage: null, // % of total income
        },
        privatePatients: {
            numberOfPatients: null,
            averageConsultationFee: null,
            averageVisitsPerYear: null, // per patient
            privateIncomePercentage: null, // % of total income
        },
        expenses: {
            staffCosts: null, // annual
            rentAndUtilities: null, // annual
            medicalSupplies: null, // annual
            insurance: null, // annual
            otherExpenses: null, // annual
            totalAnnualExpenses: null,
        },
        categories: {
            customCategories: [], // Array of {name, type: 'income'|'expense', isDefault: false}
            excludedTransactionDescriptions: [], // Transactions to ignore (e.g., personal)
            specificInstructions: '', // Free-text instructions for Finn
        },
        healthCheckData: {
            // Patient demographics (from EHR)
            demographics: {
                under6: null,
                age6to7: null,
                age8to12: null,
                age13to69: null,
                over70: null,
                nursingHomeResidents: null,
            },
            // Staff complement
            staff: {
                secretaries: {
                    count: null,
                    totalHours: null,
                    yearsExperience: null,
                },
                nurses: {
                    count: null,
                    totalHours: null,
                    yearsExperience: null,
                },
                practiceManager: {
                    employed: false,
                    hours: null,
                },
            },
            // Disease registers (from EHR)
            diseaseRegisters: {
                asthmaUnder8: null,
                type2Diabetes: null,
                cvdRisk: null,
            },
            // Leave claims tracking
            leaveClaimed: {
                studyLeave: null,  // Days claimed this year
                annualLeave: null,
                sickLeave: null,
                maternityLeave: null,
            },
            // Cervical check activity
            cervicalCheckActivity: {
                eligibleWomen25to44: null,
                eligibleWomen45to65: null,
                smearsPerformed: null,
            },
            // Health check metadata
            lastHealthCheck: null,  // Date of last health check
            healthCheckComplete: false,
        },
        // Operational data for report calculations
        operations: {
            appointmentDuration: null,      // minutes per consultation, e.g. 15
            workingWeeksPerYear: null,       // e.g. 48
            gpClinicalHoursPerWeek: null,    // default clinical hours per GP per week, e.g. 40
        },
        // Action Plan - converted recommendations with assignments and tracking
        actionPlan: {
            actions: [], // Array of action items (see createActionItem for structure)
            lastUpdated: null,
        },
        // Impact Tracking - savings ledger and analysis snapshots across Health Check cycles
        impactTracking: {
            savingsLedger: [],    // Individual savings entries (projected + verified)
            snapshots: [],        // Analysis snapshots at cycle boundaries
            lastSnapshotDate: null,
            cycleCount: 0,
        },
        metadata: {
            setupComplete: false,
            createdAt: new Date(),
            lastUpdated: new Date(),
            setupCompletedAt: null,
            version: '1.0.0',
        }
    };
}

/**
 * Create a new action item from a recommendation
 * @param {Object} recommendation - The recommendation to convert
 * @param {Object} action - The specific action within the recommendation
 * @returns {Object} New action item
 */
export function createActionItem(recommendation, action = null) {
    const now = new Date();
    return {
        id: `action_${now.getTime()}_${Math.random().toString(36).substr(2, 9)}`,
        recommendationId: recommendation.id,
        title: action ? action.action : recommendation.title,
        description: action?.detail || recommendation.summary || '',
        category: recommendation.category,
        type: recommendation.type, // 'priority' or 'growth'
        potentialValue: action?.value || recommendation.potential || 0,
        effort: action?.effort || recommendation.effort || 'Medium',
        assignedTo: null, // Staff member name
        status: 'pending', // 'pending', 'in_progress', 'completed'
        dueDate: null,
        createdDate: now.toISOString(),
        completedDate: null,
        notes: '',
        showOnDashboard: true, // Reminder visibility
    };
}

/**
 * Get all action items from the practice profile
 * @returns {Array} Array of action items
 */
export function getActionItems() {
    const profile = get();
    return profile?.actionPlan?.actions || [];
}

/**
 * Save action items to the practice profile
 * @param {Array} actions - Array of action items
 * @returns {boolean} True if save was successful
 */
export function saveActionItems(actions) {
    return update({
        actionPlan: {
            actions,
            lastUpdated: new Date().toISOString()
        }
    });
}

/**
 * Add a single action item
 * @param {Object} actionItem - The action item to add
 * @returns {boolean} True if save was successful
 */
export function addActionItem(actionItem) {
    const currentActions = getActionItems();
    return saveActionItems([...currentActions, actionItem]);
}

/**
 * Update an existing action item
 * @param {string} actionId - The ID of the action to update
 * @param {Object} updates - Fields to update
 * @returns {boolean} True if update was successful
 */
export function updateActionItem(actionId, updates) {
    const currentActions = getActionItems();
    const updatedActions = currentActions.map(action => {
        if (action.id === actionId) {
            const updated = { ...action, ...updates };
            // Auto-set completedDate when status changes to completed
            if (updates.status === 'completed' && !action.completedDate) {
                updated.completedDate = new Date().toISOString();
            }
            // Clear completedDate if status changes from completed
            if (updates.status && updates.status !== 'completed') {
                updated.completedDate = null;
            }
            return updated;
        }
        return action;
    });
    return saveActionItems(updatedActions);
}

/**
 * Delete an action item
 * @param {string} actionId - The ID of the action to delete
 * @returns {boolean} True if delete was successful
 */
export function deleteActionItem(actionId) {
    const currentActions = getActionItems();
    const filteredActions = currentActions.filter(action => action.id !== actionId);
    return saveActionItems(filteredActions);
}

/**
 * Get action items that should appear on dashboard (pending/in_progress with showOnDashboard)
 * @returns {Array} Array of dashboard-visible action items
 */
export function getDashboardActions() {
    const actions = getActionItems();
    return actions.filter(action =>
        action.showOnDashboard &&
        action.status !== 'completed'
    ).sort((a, b) => {
        // Sort by due date (earliest first), then by type (priority first)
        if (a.dueDate && b.dueDate) {
            return new Date(a.dueDate) - new Date(b.dueDate);
        }
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        if (a.type === 'priority' && b.type !== 'priority') return -1;
        if (a.type !== 'priority' && b.type === 'priority') return 1;
        return 0;
    });
}

/**
 * Get overdue action items
 * @returns {Array} Array of overdue action items
 */
export function getOverdueActions() {
    const actions = getActionItems();
    const now = new Date();
    return actions.filter(action =>
        action.dueDate &&
        new Date(action.dueDate) < now &&
        action.status !== 'completed'
    );
}

/**
 * Get action items due soon (within the next 7 days)
 * @returns {Array} Array of action items due soon
 */
export function getActionsDueSoon() {
    const actions = getActionItems();
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return actions.filter(action =>
        action.dueDate &&
        new Date(action.dueDate) >= now &&
        new Date(action.dueDate) <= weekFromNow &&
        action.status !== 'completed'
    );
}

// ============================================
// IMPACT TRACKING FUNCTIONS
// ============================================

const IMPACT_TRACKING_DEFAULTS = {
    savingsLedger: [],
    snapshots: [],
    lastSnapshotDate: null,
    cycleCount: 0,
};

/**
 * Get impact tracking data from the practice profile
 * @returns {Object} Impact tracking object with defaults
 */
export function getImpactTracking() {
    const profile = get();
    return { ...IMPACT_TRACKING_DEFAULTS, ...(profile?.impactTracking || {}) };
}

/**
 * Save impact tracking data to the practice profile
 * @param {Object} impactTracking - The full impact tracking object
 * @returns {boolean} True if save was successful
 */
export function saveImpactTracking(impactTracking) {
    return update({ impactTracking });
}

/**
 * Get the savings ledger
 * @returns {Array} Array of savings entries
 */
export function getSavingsLedger() {
    return getImpactTracking().savingsLedger;
}

/**
 * Add a savings entry to the ledger
 * @param {Object} entry - Savings entry { taskId, recommendationId, category, areaId, type, amount, description, metric, cycleId }
 * @returns {boolean} True if save was successful
 */
export function addSavingsEntry(entry) {
    const tracking = getImpactTracking();
    const now = new Date();
    const fullEntry = {
        id: `saving_${now.getTime()}_${Math.random().toString(36).substr(2, 9)}`,
        taskId: null,
        recommendationId: null,
        category: '',
        areaId: '',
        type: 'projected',
        amount: 0,
        description: '',
        createdDate: now.toISOString(),
        cycleId: null,
        verifiedDate: null,
        verifiedFromSnapshot: null,
        metric: null,
        ...entry,
    };
    tracking.savingsLedger.push(fullEntry);
    return saveImpactTracking(tracking);
}

/**
 * Update a savings entry by ID
 * @param {string} entryId - The savings entry ID
 * @param {Object} updates - Fields to update (e.g. promoting projected → verified)
 * @returns {boolean} True if save was successful
 */
export function updateSavingsEntry(entryId, updates) {
    const tracking = getImpactTracking();
    tracking.savingsLedger = tracking.savingsLedger.map(entry =>
        entry.id === entryId ? { ...entry, ...updates } : entry
    );
    return saveImpactTracking(tracking);
}

/**
 * Remove savings entries by taskId (used when un-completing a task)
 * @param {string} taskId - The action item ID whose savings entries should be removed
 * @returns {boolean} True if save was successful
 */
export function removeSavingsEntryByTaskId(taskId) {
    const tracking = getImpactTracking();
    tracking.savingsLedger = tracking.savingsLedger.filter(entry => entry.taskId !== taskId);
    return saveImpactTracking(tracking);
}

/**
 * Get all analysis snapshots
 * @returns {Array} Array of snapshot objects
 */
export function getSnapshots() {
    return getImpactTracking().snapshots;
}

/**
 * Get the most recent snapshot
 * @returns {Object|null} The latest snapshot or null
 */
export function getLatestSnapshot() {
    const snapshots = getSnapshots();
    return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
}

/**
 * Add an analysis snapshot (called on cycle start)
 * @param {Object} snapshot - Snapshot with sectorMetrics, totals, and tasks state
 * @returns {boolean} True if save was successful
 */
export function addSnapshot(snapshot) {
    const tracking = getImpactTracking();
    const now = new Date();
    const fullSnapshot = {
        id: `snapshot_${now.getTime()}`,
        createdDate: now.toISOString(),
        cycleNumber: tracking.cycleCount + 1,
        ...snapshot,
    };
    tracking.snapshots.push(fullSnapshot);
    tracking.lastSnapshotDate = now.toISOString();
    tracking.cycleCount += 1;
    return saveImpactTracking(tracking);
}

// ============================================
// FINANCIAL ACTION PLAN FUNCTIONS
// ============================================

/**
 * Create a financial task
 * @param {Object} taskData - Task data
 * @returns {Object} New financial task
 */
export function createFinancialTask(taskData) {
    const now = new Date();
    return {
        id: `fin_task_${now.getTime()}_${Math.random().toString(36).substr(2, 9)}`,
        title: taskData.title,
        description: taskData.description || '',
        category: taskData.category, // 'reporting', 'transactions', 'refinement', 'upload'
        priority: taskData.priority || 'medium', // 'high', 'medium', 'low'
        assignedTo: taskData.assignedTo || null,
        status: 'pending', // 'pending', 'in_progress', 'completed'
        dueDate: taskData.dueDate || null,
        createdDate: now.toISOString(),
        completedDate: null,
        autoGenerated: taskData.autoGenerated || false, // True if system-generated
        actionLink: taskData.actionLink || null, // View to navigate to (e.g., 'export', 'upload', 'transactions')
        metadata: taskData.metadata || {}, // Additional task-specific data
    };
}

/**
 * Get all financial tasks from the practice profile
 * @returns {Array} Array of financial tasks
 */
export function getFinancialTasks() {
    const profile = get();
    return profile?.financialActionPlan?.tasks || [];
}

/**
 * Save financial tasks to the practice profile
 * @param {Array} tasks - Array of financial tasks
 * @returns {boolean} True if save was successful
 */
export function saveFinancialTasks(tasks) {
    return update({
        financialActionPlan: {
            tasks,
            lastUpdated: new Date().toISOString()
        }
    });
}

/**
 * Add a financial task
 * @param {Object} task - The task to add
 * @returns {boolean} True if save was successful
 */
export function addFinancialTask(task) {
    const currentTasks = getFinancialTasks();
    // Check if task with same title already exists (avoid duplicates for auto-generated)
    if (task.autoGenerated && currentTasks.some(t => t.title === task.title && t.status !== 'completed')) {
        return true; // Skip adding duplicate
    }
    return saveFinancialTasks([...currentTasks, task]);
}

/**
 * Update a financial task
 * @param {string} taskId - The ID of the task to update
 * @param {Object} updates - Fields to update
 * @returns {boolean} True if update was successful
 */
export function updateFinancialTask(taskId, updates) {
    const currentTasks = getFinancialTasks();
    const updatedTasks = currentTasks.map(task => {
        if (task.id === taskId) {
            const updated = { ...task, ...updates };
            if (updates.status === 'completed' && !task.completedDate) {
                updated.completedDate = new Date().toISOString();
            }
            if (updates.status && updates.status !== 'completed') {
                updated.completedDate = null;
            }
            return updated;
        }
        return task;
    });
    return saveFinancialTasks(updatedTasks);
}

/**
 * Delete a financial task
 * @param {string} taskId - The ID of the task to delete
 * @returns {boolean} True if delete was successful
 */
export function deleteFinancialTask(taskId) {
    const currentTasks = getFinancialTasks();
    return saveFinancialTasks(currentTasks.filter(task => task.id !== taskId));
}

/**
 * Get pending/in-progress financial tasks for dashboard display
 * @returns {Array} Array of active financial tasks
 */
export function getActiveFinancialTasks() {
    const tasks = getFinancialTasks();
    return tasks.filter(task => task.status !== 'completed').sort((a, b) => {
        // Sort by priority, then by due date
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        return 0;
    });
}

/**
 * Sync GMS panel numbers from uploaded PCRS payment data into the practice profile.
 * Matches doctorNumber from parsed PDFs to GP partners by fuzzy name matching.
 * Only updates partners that don't already have a panelNumber set.
 * @param {Array} paymentAnalysisData - Array of parsed PCRS payment objects
 * @returns {boolean} True if any updates were made
 */
export function syncPanelNumbersFromPaymentData(paymentAnalysisData) {
    if (!paymentAnalysisData || paymentAnalysisData.length === 0) return false;

    const profile = get();
    if (!profile?.gps?.partners || profile.gps.partners.length === 0) return false;

    // Extract unique doctor entries from payment data
    const doctorEntries = new Map();
    paymentAnalysisData.forEach(d => {
        if (d.doctorNumber && d.doctor) {
            doctorEntries.set(d.doctorNumber, d.doctor);
        }
    });

    if (doctorEntries.size === 0) return false;

    // Normalize name for fuzzy matching (strip titles, lowercase)
    const normalizeName = (name) => {
        return (name || '')
            .toLowerCase()
            .replace(/^(dr\.?\s*|doctor\s*)/i, '')
            .replace(/[^a-z\s]/g, '')
            .trim();
    };

    let updated = false;
    const updatedPartners = profile.gps.partners.map(partner => {
        // Skip if already has a panel number
        if (partner.panelNumber) return partner;

        const partnerNorm = normalizeName(partner.name);
        if (!partnerNorm) return partner;

        // Try to find a matching doctor entry
        for (const [docNum, docName] of doctorEntries) {
            const docNorm = normalizeName(docName);
            // Match if either name contains the other (handles "Karen Aylward" matching "KAREN AYLWARD")
            if (partnerNorm.includes(docNorm) || docNorm.includes(partnerNorm)) {
                updated = true;
                return { ...partner, panelNumber: docNum };
            }
            // Also try matching just the surname (last word)
            const partnerSurname = partnerNorm.split(/\s+/).pop();
            const docSurname = docNorm.split(/\s+/).pop();
            if (partnerSurname && docSurname && partnerSurname === docSurname && partnerSurname.length > 2) {
                updated = true;
                return { ...partner, panelNumber: docNum };
            }
        }
        return partner;
    });

    if (updated) {
        update({ gps: { ...profile.gps, partners: updatedPartners } });
        console.log('[PracticeProfile] Synced panel numbers from PCRS data');
    }

    return updated;
}

/**
 * Export practice profile as JSON string
 * @returns {string|null} JSON string of profile or null if error
 */
export function exportProfile() {
    try {
        const profile = get();
        if (!profile) return null;
        return JSON.stringify(profile, null, 2);
    } catch (error) {
        console.error('Error exporting practice profile:', error);
        return null;
    }
}

/**
 * Import practice profile from JSON string
 * @param {string} jsonString - JSON string containing profile data
 * @returns {boolean} True if import was successful
 */
export function importProfile(jsonString) {
    try {
        const profile = JSON.parse(jsonString);

        // Basic validation
        if (!profile.practiceDetails || !profile.metadata) {
            throw new Error('Invalid profile structure');
        }

        return save(profile);
    } catch (error) {
        console.error('Error importing practice profile:', error);
        return false;
    }
}

/**
 * Deep merge utility function
 * @param {Object} target - Target object
 * @param {Object} source - Source object to merge
 * @returns {Object} Merged object
 */
function deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
        if (source[key] instanceof Date) {
            result[key] = source[key];
        } else if (source[key] instanceof Object && !Array.isArray(source[key])) {
            result[key] = deepMerge(result[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    }

    return result;
}

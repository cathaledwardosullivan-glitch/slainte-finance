import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { Settings, CheckCircle, AlertCircle, Plus, Edit3, Trash2, Save, Download, Upload, Brain, UserCog, Building2, MessageCircle, FileText, Activity, Eye, EyeOff, Search, Layers, ChevronDown, Briefcase, Play, BookOpen, RefreshCw, Shield, Clock } from 'lucide-react';
import PrintableGuide from './PrintableGuide';
import PCRSDownloader from './PCRSDownloader';
import { usePracticeProfile } from '../hooks/usePracticeProfile';
import COLORS from '../utils/colors';
import { useTour } from './Tour';
import PracticeOnboarding from './PracticeOnboarding';
import ConversationalSetup from './Onboarding/ConversationalSetup';
import AIIdentifierSuggestions from './AIIdentifierSuggestions';
import AIExpenseCategorization from './AIExpenseCategorization';
import CategoryRefinementWizard from './CategoryRefinementWizard';
import { getCategoriesBySection, saveCategoryPreferences, loadCategoryPreferences, getCategoryVisibilityStats, resetCategoryPreferences } from '../utils/categoryPreferences';
import { shouldRecommendRefinement, getRefinementCategoryCounts } from '../utils/categoryRefinementUtils';
import Papa from 'papaparse';
import { categorizeTransactionSimple, processTransactionData } from '../utils/transactionProcessor';
import { parsePCRSPaymentPDF, validateExtractedData } from '../utils/pdfParser';
import { parseBankStatementPDF } from '../utils/bankStatementParser';

// Helper function to create a unique key for a transaction (for duplicate detection)
const getTransactionKey = (t) => {
    let dateStr = '';
    if (t.date) {
        const d = new Date(t.date);
        if (!isNaN(d.getTime())) {
            dateStr = d.toISOString().split('T')[0];
        }
    }
    const amount = Math.abs(t.debit || t.credit || t.amount || 0).toFixed(2);
    const details = (t.details || '').toLowerCase().trim();
    return `${dateStr}|${amount}|${details}`;
};

// Protected Clear All Data Button Component
function ClearAllDataButton({ onClear }) {
    const [confirmText, setConfirmText] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);

    const handleClear = () => {
        if (confirmText === 'DELETE ALL DATA') {
            onClear();
            setConfirmText('');
            setShowConfirm(false);
        } else {
            alert('Please type "DELETE ALL DATA" exactly to confirm.');
        }
    };

    return (
        <div>
            {!showConfirm ? (
                <button
                    onClick={() => setShowConfirm(true)}
                    className="px-4 py-2 rounded font-medium"
                    style={{ backgroundColor: COLORS.expenseColor, color: COLORS.white }}
                >
                    Clear All Data
                </button>
            ) : (
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: COLORS.darkGray }}>
                            Type <strong>"DELETE ALL DATA"</strong> to confirm:
                        </label>
                        <input
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            className="w-full p-2 border rounded"
                            style={{ borderColor: COLORS.lightGray }}
                            placeholder="DELETE ALL DATA"
                            autoFocus
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleClear}
                            disabled={confirmText !== 'DELETE ALL DATA'}
                            className="px-4 py-2 rounded font-medium"
                            style={{
                                backgroundColor: confirmText === 'DELETE ALL DATA' ? COLORS.expenseColor : COLORS.lightGray,
                                color: COLORS.white,
                                cursor: confirmText === 'DELETE ALL DATA' ? 'pointer' : 'not-allowed'
                            }}
                        >
                            Confirm Delete
                        </button>
                        <button
                            onClick={() => { setShowConfirm(false); setConfirmText(''); }}
                            className="px-4 py-2 rounded border"
                            style={{ borderColor: COLORS.lightGray, color: COLORS.darkGray }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function CategoryManager() {
    const {
        transactions,
        setTransactions,
        unidentifiedTransactions,
        setUnidentifiedTransactions,
        categoryMapping,
        setCategoryMapping,
        paymentAnalysisData,
        setPaymentAnalysisData,
        selectedYear,
        showSensitiveData,
        clearAllData,
        reapplyCategories
    } = useAppContext();
    const { startTour, getTourCompletionDate } = useTour();
    const [editingCategory, setEditingCategory] = useState(null);
    const [showOnboardingEdit, setShowOnboardingEdit] = useState(false);
    const [newCategory, setNewCategory] = useState({
        code: '',
        name: '',
        identifiers: '',
        type: 'expense'
    });
    const [showAdvancedAdd, setShowAdvancedAdd] = useState(false);
    const [expandedSections, setExpandedSections] = useState({});
    const [addingIdentifierTo, setAddingIdentifierTo] = useState(null);
    const [newIdentifier, setNewIdentifier] = useState('');

    // AI Tools Modal State
    const [showAISuggestions, setShowAISuggestions] = useState(false);
    const [showExpenseCategorization, setShowExpenseCategorization] = useState(false);

    // Category Refinement Wizard State
    const [showRefinementWizard, setShowRefinementWizard] = useState(false);

    // Category Preferences State
    const [categoryPreferences, setCategoryPreferences] = useState(loadCategoryPreferences());
    const [expandedPreferenceSections, setExpandedPreferenceSections] = useState({});

    // Identifier Review State
    const [showBriefIdentifiers, setShowBriefIdentifiers] = useState(false);
    const [showDuplicateIdentifiers, setShowDuplicateIdentifiers] = useState(false);
    const [showConflicts, setShowConflicts] = useState(false);

    // Printable Guide State
    const [showPrintableGuide, setShowPrintableGuide] = useState(false);

    // Category Visibility Preferences State
    const [showVisibilityPrefs, setShowVisibilityPrefs] = useState(false);

    // Export & Import collapsed state
    const [showExportImport, setShowExportImport] = useState(false);

    // Data Management collapsed state
    const [showDataManagement, setShowDataManagement] = useState(false);

    // PCRS Statement Downloader state
    const [showPCRSDownloader, setShowPCRSDownloader] = useState(false);
    const [pcrsSessionStatus, setPcrsSessionStatus] = useState(null);

    // Re-categorization state
    const [recategorizeResult, setRecategorizeResult] = useState(null);
    const [isRecategorizing, setIsRecategorizing] = useState(false);

    // Auto-backup state
    const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
    const [lastBackupDate, setLastBackupDate] = useState(null);
    const [backupList, setBackupList] = useState([]);
    const [isCreatingBackup, setIsCreatingBackup] = useState(false);
    const [securityPasswordSet, setSecurityPasswordSet] = useState(false);

    // App Updates state
    const [showAppUpdates, setShowAppUpdates] = useState(false);
    const [appVersion, setAppVersion] = useState('');
    const [updateStatus, setUpdateStatus] = useState('idle'); // 'idle', 'checking', 'available', 'downloading', 'ready', 'error'
    const [updateInfo, setUpdateInfo] = useState(null);
    const [downloadProgress, setDownloadProgress] = useState(0);

    // Upload Data state
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadResult, setUploadResult] = useState(null);
    const [pcrsProcessing, setPcrsProcessing] = useState(false);
    const [pcrsUploadResult, setPcrsUploadResult] = useState(null);
    const pcrsFileInputRef = useRef(null);
    const bankFileInputRef = useRef(null);
    // Bank Statement PDF state
    const [bankPdfProcessing, setBankPdfProcessing] = useState(false);
    const [bankPdfResult, setBankPdfResult] = useState(null);
    const bankPdfInputRef = useRef(null);

    // Check for pending upload trigger from other pages
    useEffect(() => {
        const triggerUpload = localStorage.getItem('admin_trigger_upload');
        if (triggerUpload) {
            localStorage.removeItem('admin_trigger_upload');
            // Small delay to ensure the page has rendered
            setTimeout(() => {
                if (triggerUpload === 'pcrs' && pcrsFileInputRef.current) {
                    pcrsFileInputRef.current.click();
                } else if (triggerUpload === 'bank' && bankFileInputRef.current) {
                    bankFileInputRef.current.click();
                }
            }, 300);
        }
    }, []);

    // Load auto-backup settings
    useEffect(() => {
        const loadBackupSettings = async () => {
            if (window.electronAPI?.getAutoBackupSettings) {
                try {
                    const settings = await window.electronAPI.getAutoBackupSettings();
                    setAutoBackupEnabled(settings.enabled || false);
                    setLastBackupDate(settings.lastBackup);
                } catch (error) {
                    console.error('Error loading backup settings:', error);
                }
            }
            if (window.electronAPI?.getMobileAccessStatus) {
                try {
                    const status = await window.electronAPI.getMobileAccessStatus();
                    setSecurityPasswordSet(status.isConfigured || false);
                } catch (error) {
                    console.error('Error checking security password:', error);
                }
            }
            if (window.electronAPI?.listBackups) {
                try {
                    const backups = await window.electronAPI.listBackups();
                    setBackupList(backups || []);
                } catch (error) {
                    console.error('Error loading backup list:', error);
                }
            }
        };
        loadBackupSettings();
    }, []);

    // Load PCRS session status
    useEffect(() => {
        const checkPCRSSession = async () => {
            if (window.electronAPI?.pcrs?.checkSession) {
                try {
                    const status = await window.electronAPI.pcrs.checkSession();
                    setPcrsSessionStatus(status);
                } catch (error) {
                    console.error('Error checking PCRS session:', error);
                }
            }
        };
        checkPCRSSession();
    }, [showPCRSDownloader]); // Re-check when downloader closes

    // Load app version and setup update listeners
    useEffect(() => {
        // Get app version
        if (window.electronAPI?.getAppVersion) {
            window.electronAPI.getAppVersion().then(version => {
                setAppVersion(version);
            });
        }

        // Setup update event listeners
        if (window.electronAPI?.onUpdateAvailable) {
            window.electronAPI.onUpdateAvailable((info) => {
                setUpdateStatus('available');
                setUpdateInfo(info);
            });
        }

        if (window.electronAPI?.onUpdateDownloading) {
            window.electronAPI.onUpdateDownloading(() => {
                setUpdateStatus('downloading');
            });
        }

        if (window.electronAPI?.onUpdateProgress) {
            window.electronAPI.onUpdateProgress((progress) => {
                setDownloadProgress(progress.percent);
            });
        }

        if (window.electronAPI?.onUpdateDownloaded) {
            window.electronAPI.onUpdateDownloaded((info) => {
                setUpdateStatus('ready');
                setUpdateInfo(info);
            });
        }

        if (window.electronAPI?.onUpdateError) {
            window.electronAPI.onUpdateError((error) => {
                setUpdateStatus('error');
                console.error('Update error:', error);
            });
        }
    }, []);

    // Function to check for updates
    const handleCheckForUpdates = async () => {
        if (!window.electronAPI?.checkForUpdates) {
            alert('Update checking is only available in the desktop app.');
            return;
        }

        setUpdateStatus('checking');
        const result = await window.electronAPI.checkForUpdates();

        if (!result.success) {
            setUpdateStatus('idle');
        }
        // If successful, the update events will handle the rest
    };

    // Function to install update
    const handleInstallUpdate = () => {
        if (window.electronAPI?.installUpdate) {
            window.electronAPI.installUpdate();
        }
    };

    // Practice Profile Viewer collapsed state
    const [showPracticeProfileViewer, setShowPracticeProfileViewer] = useState(false);

    // Category Management collapsed state
    const [categoryManagementExpanded, setCategoryManagementExpanded] = useState(false);

    // Top-level group expansion (Income/Expenses/Non-Business)
    const [expandedTopLevel, setExpandedTopLevel] = useState(null);

    // Ref for scrolling to categories
    const categoryRefs = useRef({});

    // Function to scroll to and highlight a specific category
    const scrollToCategory = (categoryCode) => {
        // Find the category in categoryMapping
        const category = categoryMapping.find(c => c.code === categoryCode);
        if (!category) return;

        // Expand Category Management section if collapsed
        setCategoryManagementExpanded(true);

        // Determine which top-level section to expand
        if (category.type === 'income') {
            setExpandedTopLevel('income');
        } else if (category.type === 'non-business') {
            setExpandedTopLevel('non-business');
        } else if (category.type === 'expense') {
            setExpandedTopLevel('expenses');

            // For expenses, determine which sub-group to expand
            // We need to find the sub-group by section
            let subGroupName = null;

            if (category.section === 'DIRECT STAFF COSTS') {
                subGroupName = 'Staff Costs';
            } else if (category.section === 'MEDICAL SUPPLIES') {
                subGroupName = 'Medical Supplies';
            } else if (category.section === 'PREMISES COSTS') {
                subGroupName = 'Premises';
            } else if (category.section === 'OFFICE & ADMIN' || category.section === 'SOFTWARE & IT') {
                subGroupName = 'Office & IT';
            } else if (category.section === 'PROFESSIONAL FEES' || category.section === 'PROFESSIONAL DEV') {
                subGroupName = 'Professional';
            } else if (['MOTOR & TRANSPORT', 'CAPITAL & DEPRECIATION', 'OTHER EXPENSES'].includes(category.section)) {
                subGroupName = 'Other Expenses';
            }

            if (subGroupName) {
                setExpandedSections(prev => ({
                    ...prev,
                    [subGroupName]: true
                }));
            }
        }

        // Wait for expansion animation, then scroll
        setTimeout(() => {
            const element = categoryRefs.current[categoryCode];
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Flash highlight effect
                element.style.backgroundColor = COLORS.highlightYellow + '40';
                setTimeout(() => {
                    element.style.backgroundColor = '';
                }, 2000);
            }
        }, 400);
    };

    // Practice profile hook
    const {
        profile,
        setupComplete,
        completeness,
        summary,
        saveProfile,
        updateProfile,
        completeSetup,
        clearProfile,
        exportProfile: exportPracticeProfile,
        importProfile: importPracticeProfile
    } = usePracticeProfile();

    const [showProfileEditor, setShowProfileEditor] = useState(false);
    const [profileForm, setProfileForm] = useState({});

    // Check for pending navigation from Dashboard Financial Action Plan (only on mount)
    const hasCheckedPendingSection = useRef(false);
    useEffect(() => {
        if (hasCheckedPendingSection.current) return;
        hasCheckedPendingSection.current = true;

        const pendingSection = localStorage.getItem('admin_pending_section');
        if (pendingSection) {
            localStorage.removeItem('admin_pending_section');
            if (pendingSection === 'practice-profile') {
                setShowPracticeProfileViewer(true);
                // Scroll to the section after a brief delay
                setTimeout(() => {
                    const element = document.getElementById('practice-profile-section');
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 100);
            }
        }
    }, []);

    // Calculate total learned patterns from categoryMapping
    const totalLearnedPatterns = categoryMapping.reduce((sum, cat) => sum + cat.identifiers.length, 0);

    // Check if refinement should be recommended
    const refinementCheck = shouldRecommendRefinement(transactions);
    const refinementCounts = getRefinementCategoryCounts(transactions);

    // Group categories by section
    const groupedCategories = categoryMapping.reduce((groups, category) => {
        const section = category.section || 'OTHER';
        if (!groups[section]) {
            groups[section] = [];
        }
        groups[section].push(category);
        return groups;
    }, {});

    // Create expense sub-groups matching categorization flow
    const createExpenseSubGroups = () => {
        const subGroups = [];

        // 1. Staff Costs
        const staffCategories = categoryMapping.filter(c => c.section === 'DIRECT STAFF COSTS');
        if (staffCategories.length > 0) {
            subGroups.push({
                name: 'Staff Costs',
                icon: '👥',
                categories: staffCategories,
                description: 'Salaries, wages, and staff-related expenses'
            });
        }

        // 2. Medical Supplies
        const medicalCategories = categoryMapping.filter(c => c.section === 'MEDICAL SUPPLIES');
        if (medicalCategories.length > 0) {
            subGroups.push({
                name: 'Medical Supplies',
                icon: '💉',
                categories: medicalCategories,
                description: 'Medical and surgical supplies'
            });
        }

        // 3. Premises
        const premisesCategories = categoryMapping.filter(c => c.section === 'PREMISES COSTS');
        if (premisesCategories.length > 0) {
            subGroups.push({
                name: 'Premises',
                icon: '🏢',
                categories: premisesCategories,
                description: 'Rent, rates, utilities, and building costs'
            });
        }

        // 4. Office & IT (combines Office & Admin + Software & IT)
        const officeITSections = ['OFFICE & ADMIN', 'SOFTWARE & IT'];
        const officeITCategories = categoryMapping.filter(c =>
            c.type === 'expense' && officeITSections.includes(c.section)
        );
        if (officeITCategories.length > 0) {
            subGroups.push({
                name: 'Office & IT',
                icon: '💻',
                categories: officeITCategories,
                description: 'Equipment, IT, postage, printing, and administration'
            });
        }

        // 5. Professional (combines Professional Fees + Professional Development)
        const professionalSections = ['PROFESSIONAL FEES', 'PROFESSIONAL DEV'];
        const professionalCategories = categoryMapping.filter(c =>
            c.type === 'expense' && professionalSections.includes(c.section)
        );
        if (professionalCategories.length > 0) {
            subGroups.push({
                name: 'Professional',
                icon: '📚',
                categories: professionalCategories,
                description: 'Professional fees, subscriptions, and development'
            });
        }

        // 6. Other Expenses (Motor, Capital, Other)
        const otherSections = ['MOTOR & TRANSPORT', 'CAPITAL & DEPRECIATION', 'OTHER EXPENSES'];
        const otherCategories = categoryMapping.filter(c =>
            c.type === 'expense' && otherSections.includes(c.section)
        );
        if (otherCategories.length > 0) {
            subGroups.push({
                name: 'Other Expenses',
                icon: '📊',
                categories: otherCategories,
                description: 'Motor, capital, depreciation, and other expenses'
            });
        }

        return subGroups;
    };

    const expenseSubGroups = createExpenseSubGroups();

    // Toggle section expansion
    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    // Add new category
    const addNewCategory = () => {
        if (!newCategory.code || !newCategory.name) {
            alert('Please provide both code and name for the new category.');
            return;
        }

        // Check for duplicate codes
        if (categoryMapping.find(cat => cat.code === newCategory.code)) {
            alert('Category code already exists. Please choose a different code.');
            return;
        }

        const identifiersArray = newCategory.identifiers
            .split(',')
            .map(s => s.trim())
            .filter(s => s);

        const categoryToAdd = {
            code: newCategory.code,
            name: newCategory.name,
            identifiers: identifiersArray,
            type: newCategory.type
        };

        setCategoryMapping(prev => [...prev, categoryToAdd]);
        setNewCategory({ code: '', name: '', identifiers: '', type: 'expense' });
    };

    // Update existing category
    const updateCategory = (code, updatedCategory) => {
        setCategoryMapping(prev =>
            prev.map(cat => cat.code === code ? updatedCategory : cat)
        );
        setEditingCategory(null);
    };

    // Delete category
    const deleteCategory = (code) => {
        if (window.confirm('Are you sure you want to delete this category? This cannot be undone.')) {
            setCategoryMapping(prev => prev.filter(cat => cat.code !== code));
        }
    };

    // Save inline edit
    const saveInlineEdit = (code, field, value) => {
        const category = categoryMapping.find(cat => cat.code === code);
        if (!category) return;

        let updatedCategory = { ...category };

        if (field === 'identifiers') {
            updatedCategory.identifiers = value.split(',').map(s => s.trim()).filter(s => s);
        } else {
            updatedCategory[field] = value;
        }

        updateCategory(code, updatedCategory);
    };

    // Add identifier to category
    const addIdentifier = (code) => {
        if (!newIdentifier.trim()) {
            alert('Please enter an identifier');
            return;
        }

        const category = categoryMapping.find(cat => cat.code === code);
        if (!category) return;

        // Check if identifier already exists
        if (category.identifiers.some(id => id.toLowerCase() === newIdentifier.trim().toLowerCase())) {
            alert('This identifier already exists in this category');
            return;
        }

        const updatedCategory = {
            ...category,
            identifiers: [...category.identifiers, newIdentifier.trim()]
        };

        updateCategory(code, updatedCategory);
        setNewIdentifier('');
        setAddingIdentifierTo(null);
    };

    // Remove identifier from category
    const removeIdentifier = (code, identifierToRemove) => {
        if (!window.confirm(`Remove identifier "${identifierToRemove}"?`)) return;

        const category = categoryMapping.find(cat => cat.code === code);
        if (!category) return;

        const updatedCategory = {
            ...category,
            identifiers: category.identifiers.filter(id => id !== identifierToRemove)
        };

        updateCategory(code, updatedCategory);
    };

    // Get next available category code
    const getNextCategoryCode = () => {
        const existingCodes = categoryMapping.map(cat => parseInt(cat.code)).filter(code => !isNaN(code));
        const maxCode = Math.max(...existingCodes, 0);
        return (maxCode + 1).toString().padStart(2, '0');
    };

    // Generate suggested category code
    const generateCategoryCode = () => {
        setNewCategory(prev => ({ ...prev, code: getNextCategoryCode() }));
    };

    // Practice profile handlers
    const handleProfileFieldChange = (section, field, value) => {
        setProfileForm(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value
            }
        }));
    };

    const handleSaveProfile = () => {
        const success = updateProfile(profileForm);
        if (success) {
            alert('Practice profile updated successfully!');
            setShowProfileEditor(false);
            setProfileForm({});
        } else {
            alert('Failed to save practice profile. Please try again.');
        }
    };

    const handleCompleteSetup = () => {
        if (window.confirm('Mark setup as complete? You can still edit your profile later.')) {
            const success = completeSetup();
            if (success) {
                alert('Setup marked as complete! Finn now has your full practice context.');
            }
        }
    };

    const handleExportProfile = () => {
        const jsonData = exportPracticeProfile();
        if (jsonData) {
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `practice-profile-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    };

    const handleImportProfile = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const success = importPracticeProfile(e.target.result);
                if (success) {
                    alert('Practice profile imported successfully!');
                } else {
                    alert('Failed to import practice profile.');
                }
            } catch (error) {
                alert('Error importing profile: ' + error.message);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const handleClearProfile = () => {
        if (window.confirm('Are you sure you want to clear the practice profile? This cannot be undone.')) {
            const success = clearProfile();
            if (success) {
                alert('Practice profile cleared successfully.');
                setProfileForm({});
            }
        }
    };

    // === UPLOAD DATA HANDLERS ===

    // Simplified categorization function
    const categorizeTransactionWithContext = (transaction) => {
        return categorizeTransactionSimple(transaction, categoryMapping);
    };

    // Check for duplicate transactions
    const checkForDuplicates = (newCategorized, newUnidentified) => {
        const existingKeys = new Set();
        transactions.forEach(t => existingKeys.add(getTransactionKey(t)));
        unidentifiedTransactions.forEach(t => existingKeys.add(getTransactionKey(t)));

        const uniqueCategorized = newCategorized.filter(t => !existingKeys.has(getTransactionKey(t)));
        const uniqueUnidentified = newUnidentified.filter(t => !existingKeys.has(getTransactionKey(t)));
        const duplicateCount = (newCategorized.length + newUnidentified.length) - (uniqueCategorized.length + uniqueUnidentified.length);

        return { uniqueCategorized, uniqueUnidentified, duplicateCount };
    };

    // Process JSON training data
    const processJsonTrainingData = (jsonData) => {
        try {
            if (!jsonData.trainingTransactions || !Array.isArray(jsonData.trainingTransactions)) {
                throw new Error('Invalid training data format - missing trainingTransactions array');
            }

            const processedTransactions = jsonData.trainingTransactions.map((transaction, index) => {
                const amount = Math.abs(transaction.amount || 0);
                return {
                    id: `training-${Date.now()}-${index}`,
                    date: transaction.date || new Date().toISOString(),
                    details: transaction.details || 'Imported Training Data',
                    debit: transaction.amount < 0 ? amount : 0,
                    credit: transaction.amount >= 0 ? amount : 0,
                    amount: transaction.amount || 0,
                    category: transaction.category || null,
                    type: transaction.category?.type || 'unknown',
                    isTrainingData: true,
                    imported: true,
                    fileName: selectedFile?.name || 'training-data.json',
                    rawData: transaction
                };
            });

            const categorized = processedTransactions.filter(t => t.category);
            const uncategorized = processedTransactions.filter(t => !t.category);

            setTransactions(prev => [...prev, ...categorized]);
            setUnidentifiedTransactions(prev => [...prev, ...uncategorized]);

            setUploadResult({
                type: 'training',
                categorized: categorized.length,
                unidentified: uncategorized.length
            });
            setIsProcessing(false);
        } catch (error) {
            console.error('Error processing JSON training data:', error);
            setIsProcessing(false);
            alert('Error processing training data: ' + error.message);
        }
    };

    // Process regular transaction data (CSV)
    const processUploadedData = (results) => {
        try {
            const { categorized, unidentified, autoIncome } = processTransactionData(
                results,
                selectedFile,
                categorizeTransactionWithContext
            );

            const incomeUnclassifiedCategory = categoryMapping.find(c => c.code === '1.0') ||
                categoryMapping.find(c => c.name === 'Income Unclassified') ||
                categoryMapping.find(c => c.type === 'income');

            const processedAutoIncome = (autoIncome || []).map(t => ({
                ...t,
                category: incomeUnclassifiedCategory,
                autoCategorized: true
            }));

            const allCategorized = [...categorized, ...processedAutoIncome];
            const { uniqueCategorized, uniqueUnidentified, duplicateCount } = checkForDuplicates(allCategorized, unidentified);

            setTransactions(prev => [...prev, ...uniqueCategorized]);
            setUnidentifiedTransactions(prev => [...prev, ...uniqueUnidentified]);

            setUploadResult({
                type: 'regular',
                categorized: uniqueCategorized.length,
                unidentified: uniqueUnidentified.length,
                skippedDuplicates: duplicateCount
            });
            setIsProcessing(false);
        } catch (error) {
            console.error('Error processing transactions:', error);
            setIsProcessing(false);
            alert('Error processing file data: ' + error.message);
        }
    };

    // File upload handler
    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setIsProcessing(true);
        setSelectedFile(file);
        setUploadResult(null);

        const fileExtension = file.name.split('.').pop().toLowerCase();

        if (fileExtension === 'json') {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const jsonData = JSON.parse(e.target.result);
                    processJsonTrainingData(jsonData);
                } catch (error) {
                    console.error('JSON parsing error:', error);
                    setIsProcessing(false);
                    alert('Error reading JSON file: ' + error.message);
                }
            };
            reader.readAsText(file);
        } else if (fileExtension === 'csv') {
            Papa.parse(file, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: processUploadedData,
                error: (error) => {
                    console.error('CSV parsing error:', error);
                    setIsProcessing(false);
                    alert('Error parsing CSV file: ' + error.message);
                }
            });
        } else {
            setIsProcessing(false);
            alert('Please upload a supported file format:\n- CSV (.csv)\n- Training Data (.json)');
        }
        event.target.value = '';
    };

    // Handle PCRS PDF upload
    const handlePcrsUpload = async (event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        setPcrsProcessing(true);
        setPcrsUploadResult(null);

        let successCount = 0;
        let errorCount = 0;

        for (const file of files) {
            if (file.type === 'application/pdf') {
                try {
                    const extractedData = await parsePCRSPaymentPDF(file);
                    extractedData.fileName = file.name;
                    const validationErrors = validateExtractedData(extractedData);

                    if (validationErrors.length === 0) {
                        setPaymentAnalysisData(prev => [...prev, extractedData]);
                        successCount++;
                    } else {
                        errorCount++;
                    }
                } catch (error) {
                    console.error('Error processing PCRS PDF:', error);
                    errorCount++;
                }
            }
        }

        setPcrsProcessing(false);
        setPcrsUploadResult({ success: successCount, error: errorCount, total: files.length });
        event.target.value = '';
    };

    // Handle Bank Statement PDF upload
    const handleBankPdfUpload = async (event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        setBankPdfProcessing(true);
        setBankPdfResult(null);
        setUploadResult(null);

        let allTransactions = [];
        let successCount = 0;
        let errorCount = 0;
        let detectedBank = null;

        for (const file of files) {
            if (file.type === 'application/pdf') {
                try {
                    const result = await parseBankStatementPDF(file);
                    detectedBank = result.bank;

                    // Transform transactions to match app format
                    const transformedTransactions = result.transactions.map((tx, index) => {
                        const dateObj = tx.date instanceof Date ? tx.date : new Date(tx.date);
                        const monthYear = !isNaN(dateObj.getTime())
                            ? dateObj.toISOString().substring(0, 7)
                            : null;

                        return {
                            id: `${file.name}-${index}-${Date.now()}`,
                            date: dateObj,
                            monthYear: monthYear,
                            details: tx.details || '',
                            debit: tx.debit || 0,
                            credit: tx.credit || 0,
                            amount: Math.abs(tx.debit || tx.credit || tx.amount || 0),
                            balance: tx.balance || 0,
                            fileName: file.name,
                            source: 'bank-pdf',
                            bank: result.bank
                        };
                    });

                    allTransactions = [...allTransactions, ...transformedTransactions];
                    successCount++;
                } catch (error) {
                    console.error('Error processing bank PDF:', error);
                    errorCount++;
                    setBankPdfResult({
                        success: 0,
                        error: 1,
                        errorMessage: error.message
                    });
                    setBankPdfProcessing(false);
                    event.target.value = '';
                    return;
                }
            }
        }

        if (allTransactions.length > 0) {
            // Categorize the transactions
            const categorized = [];
            const unidentified = [];
            const autoIncome = [];

            for (const tx of allTransactions) {
                const category = categorizeTransactionSimple(tx, categoryMapping);

                if (category) {
                    categorized.push({ ...tx, category, isIncome: category.type === 'income' });
                } else if (tx.credit > 0) {
                    autoIncome.push({ ...tx, category: '__AUTO_INCOME__', isIncome: true });
                } else {
                    unidentified.push(tx);
                }
            }

            // Find income unclassified category for auto-income
            const incomeUnclassifiedCategory = categoryMapping.find(c => c.code === '1.0') ||
                categoryMapping.find(c => c.name === 'Income Unclassified') ||
                categoryMapping.find(c => c.type === 'income');

            const processedAutoIncome = autoIncome.map(t => ({
                ...t,
                category: incomeUnclassifiedCategory,
                autoCategorized: true
            }));

            const allCategorized = [...categorized, ...processedAutoIncome];

            // Check for duplicates
            const existingKeys = new Set([
                ...transactions.map(getTransactionKey),
                ...unidentifiedTransactions.map(getTransactionKey)
            ]);

            const uniqueCategorized = allCategorized.filter(t => !existingKeys.has(getTransactionKey(t)));
            const uniqueUnidentified = unidentified.filter(t => !existingKeys.has(getTransactionKey(t)));
            const duplicateCount = (allCategorized.length + unidentified.length) - (uniqueCategorized.length + uniqueUnidentified.length);

            // Add unique transactions
            if (uniqueCategorized.length > 0) {
                setTransactions(prev => [...prev, ...uniqueCategorized]);
            }
            if (uniqueUnidentified.length > 0) {
                setUnidentifiedTransactions(prev => [...prev, ...uniqueUnidentified]);
            }

            setBankPdfResult({
                success: successCount,
                error: errorCount,
                total: files.length,
                transactionCount: allTransactions.length,
                categorized: uniqueCategorized.length,
                unidentified: uniqueUnidentified.length,
                duplicates: duplicateCount,
                bank: detectedBank
            });
        }

        setBankPdfProcessing(false);
        event.target.value = '';
    };

    // Show Cara conversational setup in edit mode if triggered
    if (showOnboardingEdit) {
        return (
            <ConversationalSetup
                editMode={true}
                onComplete={(updatedProfile) => {
                    // Save the updated profile to localStorage
                    if (updatedProfile) {
                        // Get existing profile to preserve any fields Cara doesn't manage
                        let existingProfile = {};
                        try {
                            const stored = localStorage.getItem('slainte_practice_profile');
                            if (stored) existingProfile = JSON.parse(stored);
                        } catch (e) {
                            console.error('Error loading existing profile:', e);
                        }

                        // Merge: Cara's changes take priority, but preserve other fields
                        const profileToSave = {
                            ...existingProfile,
                            ...updatedProfile,
                            practiceDetails: {
                                ...existingProfile.practiceDetails,
                                ...updatedProfile.practiceDetails
                            },
                            gps: {
                                ...existingProfile.gps,
                                ...updatedProfile.gps
                            },
                            staff: updatedProfile.staff || existingProfile.staff || [],
                            metadata: {
                                ...existingProfile.metadata,
                                ...updatedProfile.metadata,
                                setupComplete: true,
                                lastUpdated: new Date().toISOString()
                            }
                        };
                        localStorage.setItem('slainte_practice_profile', JSON.stringify(profileToSave));
                        console.log('[CategoryManager] Saved updated profile:', profileToSave);
                    }
                    setShowOnboardingEdit(false);
                    // Force page reload to refresh the profile display
                    window.location.reload();
                }}
                onBack={() => {
                    setShowOnboardingEdit(false);
                }}
            />
        );
    }

    return (
        <div className="space-y-6">

            {/* Upload Data Card */}
            <div data-tour-id="admin-upload-data" style={{ backgroundColor: COLORS.white, padding: '1.5rem', borderRadius: '0.5rem', border: `1px solid ${COLORS.lightGray}` }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: COLORS.darkGray, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Upload style={{ height: '1.25rem', width: '1.25rem', color: COLORS.slainteBlue }} />
                    Upload Data
                </h2>
                <p style={{ fontSize: '0.875rem', color: COLORS.mediumGray, marginBottom: '1.5rem' }}>
                    Import financial data and upload PCRS PDFs
                </p>

                {/* 4-Column Layout */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    {/* Column 1: Bank Transactions */}
                    <div style={{ border: `2px dashed ${COLORS.slainteBlue}`, borderRadius: '0.5rem', padding: '1.5rem', textAlign: 'center' }}>
                        <Upload style={{ margin: '0 auto 0.75rem', height: '2.5rem', width: '2.5rem', color: COLORS.slainteBlue }} />
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: COLORS.darkGray }}>Bank Transactions</h3>
                        <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray, marginBottom: '1rem' }}>
                            CSV files from your bank
                        </p>
                        <input
                            ref={bankFileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleFileUpload}
                            disabled={isProcessing}
                            style={{ width: '100%' }}
                        />
                    </div>

                    {/* Column 2: Training Data */}
                    <div style={{ border: `2px dashed ${COLORS.highlightYellow}`, borderRadius: '0.5rem', padding: '1.5rem', textAlign: 'center' }}>
                        <FileText style={{ margin: '0 auto 0.75rem', height: '2.5rem', width: '2.5rem', color: COLORS.highlightYellow }} />
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: COLORS.darkGray }}>Training Data</h3>
                        <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray, marginBottom: '1rem' }}>
                            Pre-categorized JSON backup files
                        </p>
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleFileUpload}
                            disabled={isProcessing}
                            style={{ width: '100%' }}
                        />
                    </div>

                    {/* Column 3: Bank Statement PDFs */}
                    <div style={{ border: `2px dashed ${COLORS.incomeColor}`, borderRadius: '0.5rem', padding: '1.5rem', textAlign: 'center' }}>
                        <Building2 style={{ margin: '0 auto 0.75rem', height: '2.5rem', width: '2.5rem', color: COLORS.incomeColor }} />
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: COLORS.darkGray }}>Bank Statement PDFs</h3>
                        <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray, marginBottom: '1rem' }}>
                            BOI statement PDFs (beta)
                        </p>
                        <input
                            ref={bankPdfInputRef}
                            type="file"
                            accept=".pdf"
                            multiple
                            onChange={handleBankPdfUpload}
                            disabled={bankPdfProcessing}
                            style={{ width: '100%' }}
                        />
                    </div>

                    {/* Column 4: PCRS Payment PDFs */}
                    <div style={{ border: `2px dashed ${COLORS.expenseColor}`, borderRadius: '0.5rem', padding: '1.5rem', textAlign: 'center' }}>
                        <Activity style={{ margin: '0 auto 0.75rem', height: '2.5rem', width: '2.5rem', color: COLORS.expenseColor }} />
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: COLORS.darkGray }}>PCRS Payments</h3>
                        <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray, marginBottom: '1rem' }}>
                            GMS payment statement PDFs
                        </p>
                        <input
                            ref={pcrsFileInputRef}
                            type="file"
                            accept=".pdf"
                            multiple
                            onChange={handlePcrsUpload}
                            disabled={pcrsProcessing}
                            style={{ width: '100%' }}
                        />
                    </div>
                </div>

                {/* Processing indicator */}
                {isProcessing && (
                    <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: `${COLORS.slainteBlue}15`, borderRadius: '0.5rem', textAlign: 'center' }}>
                        <div style={{
                            animation: 'spin 1s linear infinite',
                            borderRadius: '9999px',
                            height: '2rem',
                            width: '2rem',
                            border: `2px solid ${COLORS.slainteBlue}`,
                            borderTopColor: 'transparent',
                            margin: '0 auto'
                        }}></div>
                        <p style={{ fontSize: '0.875rem', color: COLORS.darkGray, marginTop: '0.5rem' }}>
                            Processing {selectedFile?.name.endsWith('.json') ? 'training data' : 'transactions'}...
                        </p>
                    </div>
                )}

                {/* Upload Success message */}
                {selectedFile && !isProcessing && uploadResult && (
                    <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: `${COLORS.incomeColor}20`, borderRadius: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <CheckCircle style={{ height: '1.25rem', width: '1.25rem', color: COLORS.incomeColor, marginRight: '0.5rem' }} />
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: COLORS.darkGray }}>
                                Processed {selectedFile.name}
                            </span>
                        </div>
                        {uploadResult.type === 'training' ? (
                            <p style={{ fontSize: '0.875rem', color: COLORS.darkGray }}>
                                {uploadResult.categorized} pre-categorized transactions imported
                            </p>
                        ) : (
                            <p style={{ fontSize: '0.875rem', color: COLORS.darkGray }}>
                                {uploadResult.categorized} categorized, {uploadResult.unidentified} need review
                                {uploadResult.skippedDuplicates > 0 && (
                                    <span style={{ color: COLORS.mediumGray }}>
                                        {' '}({uploadResult.skippedDuplicates} duplicates skipped)
                                    </span>
                                )}
                            </p>
                        )}
                    </div>
                )}

                {/* PCRS Processing indicator */}
                {pcrsProcessing && (
                    <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: `${COLORS.expenseColor}15`, borderRadius: '0.5rem', textAlign: 'center' }}>
                        <div style={{
                            animation: 'spin 1s linear infinite',
                            borderRadius: '9999px',
                            height: '2rem',
                            width: '2rem',
                            border: `2px solid ${COLORS.expenseColor}`,
                            borderTopColor: 'transparent',
                            margin: '0 auto'
                        }}></div>
                        <p style={{ fontSize: '0.875rem', color: COLORS.darkGray, marginTop: '0.5rem' }}>
                            Processing PCRS payment PDFs...
                        </p>
                    </div>
                )}

                {/* PCRS Upload Result */}
                {pcrsUploadResult && !pcrsProcessing && (
                    <div style={{
                        marginTop: '1.5rem',
                        padding: '1rem',
                        backgroundColor: pcrsUploadResult.success > 0 ? `${COLORS.incomeColor}20` : `${COLORS.expenseColor}20`,
                        borderRadius: '0.5rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <CheckCircle style={{
                                height: '1.25rem',
                                width: '1.25rem',
                                color: pcrsUploadResult.success > 0 ? COLORS.incomeColor : COLORS.expenseColor,
                                marginRight: '0.5rem'
                            }} />
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: COLORS.darkGray }}>
                                PCRS PDF Processing Complete
                            </span>
                        </div>
                        <p style={{ fontSize: '0.875rem', color: COLORS.darkGray }}>
                            {pcrsUploadResult.success} uploaded successfully
                            {pcrsUploadResult.error > 0 && `, ${pcrsUploadResult.error} failed`}
                        </p>
                        {pcrsUploadResult.success > 0 && (
                            <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray, marginTop: '0.5rem' }}>
                                View extracted data in GMS Dashboard
                            </p>
                        )}
                    </div>
                )}

                {/* Bank PDF Processing indicator */}
                {bankPdfProcessing && (
                    <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: `${COLORS.incomeColor}15`, borderRadius: '0.5rem', textAlign: 'center' }}>
                        <div style={{
                            animation: 'spin 1s linear infinite',
                            borderRadius: '9999px',
                            height: '2rem',
                            width: '2rem',
                            border: `2px solid ${COLORS.incomeColor}`,
                            borderTopColor: 'transparent',
                            margin: '0 auto'
                        }}></div>
                        <p style={{ fontSize: '0.875rem', color: COLORS.darkGray, marginTop: '0.5rem' }}>
                            Extracting transactions from bank statement PDF...
                        </p>
                    </div>
                )}

                {/* Bank PDF Upload Result */}
                {bankPdfResult && !bankPdfProcessing && (
                    <div style={{
                        marginTop: '1.5rem',
                        padding: '1rem',
                        backgroundColor: bankPdfResult.success > 0 ? `${COLORS.incomeColor}20` : `${COLORS.expenseColor}20`,
                        borderRadius: '0.5rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                            {bankPdfResult.success > 0 ? (
                                <CheckCircle style={{ height: '1.25rem', width: '1.25rem', color: COLORS.incomeColor, marginRight: '0.5rem' }} />
                            ) : (
                                <AlertCircle style={{ height: '1.25rem', width: '1.25rem', color: COLORS.expenseColor, marginRight: '0.5rem' }} />
                            )}
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: COLORS.darkGray }}>
                                {bankPdfResult.success > 0 ? 'Bank Statement PDF Processed' : 'Error Processing PDF'}
                            </span>
                        </div>
                        {bankPdfResult.success > 0 ? (
                            <>
                                <p style={{ fontSize: '0.875rem', color: COLORS.darkGray }}>
                                    {bankPdfResult.transactionCount} transactions extracted from {bankPdfResult.bank === 'boi' ? 'Bank of Ireland' : bankPdfResult.bank} statement
                                </p>
                                <p style={{ fontSize: '0.875rem', color: COLORS.darkGray }}>
                                    {bankPdfResult.categorized} categorized, {bankPdfResult.unidentified} need review
                                    {bankPdfResult.duplicates > 0 && (
                                        <span style={{ color: COLORS.mediumGray }}>
                                            {' '}({bankPdfResult.duplicates} duplicates skipped)
                                        </span>
                                    )}
                                </p>
                            </>
                        ) : (
                            <p style={{ fontSize: '0.875rem', color: COLORS.expenseColor }}>
                                {bankPdfResult.errorMessage || 'Could not extract transactions from PDF'}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* System Status */}
            <div className="bg-white p-6 rounded-lg border">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center">
                        <Settings className="h-5 w-5 mr-2" />
                        System Status
                    </h3>
                    <div className="flex items-center space-x-2">
                        {unidentifiedTransactions.length === 0 ? (
                            <>
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-sm text-green-600 font-medium">Excellent - All transactions categorized</span>
                            </>
                        ) : unidentifiedTransactions.length < transactions.length * 0.1 ? (
                            <>
                                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                <span className="text-sm text-yellow-600 font-medium">Good - {((transactions.length / (transactions.length + unidentifiedTransactions.length)) * 100).toFixed(1)}% categorized</span>
                            </>
                        ) : (
                            <>
                                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                <span className="text-sm text-red-600 font-medium">Needs attention - Many unidentified transactions</span>
                            </>
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-green-600">Total Transactions</p>
                                <p className="text-2xl font-bold text-green-700">{transactions.length}</p>
                                <p className="text-xs text-green-600 mt-1">Successfully categorized</p>
                            </div>
                            <CheckCircle className="h-8 w-8 text-green-600" />
                        </div>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-yellow-600">Unidentified</p>
                                <p className="text-2xl font-bold text-yellow-700">{unidentifiedTransactions.length}</p>
                                <p className="text-xs text-yellow-600 mt-1">Require manual review</p>
                            </div>
                            <AlertCircle className="h-8 w-8 text-yellow-600" />
                        </div>
                    </div>
                    <button
                        onClick={() => refinementCheck.shouldShow && setShowRefinementWizard(true)}
                        disabled={!refinementCheck.shouldShow}
                        className={`p-4 rounded-lg border transition-all ${
                            refinementCheck.shouldShow
                                ? 'bg-blue-50 border-blue-200 hover:bg-blue-100 cursor-pointer'
                                : 'bg-gray-50 border-gray-200 cursor-not-allowed'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <div className="text-left">
                                <p className={`text-sm ${refinementCheck.shouldShow ? 'text-blue-600' : 'text-gray-600'}`}>
                                    Partially Classified
                                </p>
                                <p className={`text-2xl font-bold ${refinementCheck.shouldShow ? 'text-blue-700' : 'text-gray-700'}`}>
                                    {refinementCheck.count}
                                </p>
                                <p className={`text-xs mt-1 ${refinementCheck.shouldShow ? 'text-blue-600' : 'text-gray-600'}`}>
                                    {refinementCheck.shouldShow ? `${refinementCheck.percentage}% - Click to refine` : 'All specific'}
                                </p>
                            </div>
                            <Layers className={`h-8 w-8 ${refinementCheck.shouldShow ? 'text-blue-600' : 'text-gray-400'}`} />
                        </div>
                    </button>
                    {(() => {
                        // Calculate data freshness
                        const now = new Date();
                        const oneMonthAgo = new Date(now);
                        oneMonthAgo.setMonth(now.getMonth() - 1);

                        const latestTransaction = transactions.reduce((latest, t) => {
                            if (!t.date) return latest;
                            const tDate = new Date(t.date);
                            return !latest || tDate > latest ? tDate : latest;
                        }, null);

                        const isStale = latestTransaction && latestTransaction < oneMonthAgo;
                        const daysSinceLatest = latestTransaction
                            ? Math.floor((now - latestTransaction) / (1000 * 60 * 60 * 24))
                            : null;

                        return (
                            <div className={`p-4 rounded-lg border ${
                                isStale
                                    ? 'bg-orange-50 border-orange-200'
                                    : 'bg-blue-50 border-blue-200'
                            }`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className={`text-sm ${isStale ? 'text-orange-600' : 'text-blue-600'}`}>
                                            Data Freshness
                                        </p>
                                        <p className={`text-2xl font-bold ${isStale ? 'text-orange-700' : 'text-blue-700'}`}>
                                            {latestTransaction ? `${daysSinceLatest}d` : 'N/A'}
                                        </p>
                                        <p className={`text-xs mt-1 ${isStale ? 'text-orange-600' : 'text-blue-600'}`}>
                                            {isStale ? 'Upload needed' : 'Up to date'}
                                        </p>
                                    </div>
                                    {isStale ? (
                                        <Upload className="h-8 w-8 text-orange-600" />
                                    ) : (
                                        <CheckCircle className="h-8 w-8 text-blue-600" />
                                    )}
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* P&L Report Status */}
                {(() => {
                    const now = new Date();
                    const currentYear = now.getFullYear();
                    const currentMonth = now.getMonth(); // 0-11

                    // Check if we're in a new year and should generate previous year's P&L
                    // Typically want to generate within first 3 months of new year
                    const shouldGeneratePriorYear = currentMonth < 3; // Jan-March
                    const reportYear = shouldGeneratePriorYear ? currentYear - 1 : currentYear;

                    // Check if there are transactions for the report year
                    const hasDataForYear = transactions.some(t => {
                        if (!t.date) return false;
                        return new Date(t.date).getFullYear() === reportYear;
                    });

                    const reportDue = shouldGeneratePriorYear && hasDataForYear;

                    return reportDue ? (
                        <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-purple-700">
                                    📊 P&L Report for {reportYear} is ready to generate
                                </span>
                                <FileText className="h-5 w-5 text-purple-600" />
                            </div>
                        </div>
                    ) : null;
                })()}
            </div>

            {/* Category Management */}
            <div className="bg-white p-6 rounded-lg border">
                <button
                    onClick={() => setCategoryManagementExpanded(!categoryManagementExpanded)}
                    className="w-full flex items-center justify-between mb-4 hover:bg-gray-50 p-2 rounded transition-colors"
                >
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        Category Management
                    </h3>
                    <span className="text-lg" style={{ color: COLORS.darkGray }}>
                        {categoryManagementExpanded ? '▼' : '▶'}
                    </span>
                </button>

                {/* Three Top-Level Boxes */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                    {/* Income */}
                    <button
                        onClick={() => {
                            setCategoryManagementExpanded(true);
                            setExpandedTopLevel(expandedTopLevel === 'income' ? null : 'income');
                        }}
                        className="p-4 rounded-lg border bg-green-50 border-green-200 hover:bg-green-100 transition-colors cursor-pointer text-left"
                    >
                        <div>
                            <p className="text-2xl font-bold text-green-700">
                                {categoryMapping.filter(c => c.type === 'income').length}
                            </p>
                            <p className="text-sm mt-1 text-green-600 font-medium">
                                Income
                            </p>
                            <p className="text-xs mt-1 text-green-600">
                                {expandedTopLevel === 'income' ? 'Click to collapse' : 'Click to view categories'}
                            </p>
                        </div>
                    </button>

                    {/* Expenses */}
                    <button
                        onClick={() => {
                            setCategoryManagementExpanded(true);
                            setExpandedTopLevel(expandedTopLevel === 'expenses' ? null : 'expenses');
                        }}
                        className="p-4 rounded-lg border bg-red-50 border-red-200 hover:bg-red-100 transition-colors cursor-pointer text-left"
                    >
                        <div>
                            <p className="text-2xl font-bold text-red-700">
                                {categoryMapping.filter(c => c.type === 'expense').length}
                            </p>
                            <p className="text-sm mt-1 text-red-600 font-medium">
                                Expenses
                            </p>
                            <p className="text-xs mt-1 text-red-600">
                                {expandedTopLevel === 'expenses' ? 'Click to collapse' : 'Click to view categories'}
                            </p>
                        </div>
                    </button>

                    {/* Non-Business */}
                    <button
                        onClick={() => {
                            setCategoryManagementExpanded(true);
                            setExpandedTopLevel(expandedTopLevel === 'non-business' ? null : 'non-business');
                        }}
                        className="p-4 rounded-lg border bg-blue-50 border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer text-left"
                    >
                        <div>
                            <p className="text-2xl font-bold text-blue-700">
                                {categoryMapping.filter(c => c.type === 'non-business').length}
                            </p>
                            <p className="text-sm mt-1 text-blue-600 font-medium">
                                Non-Business
                            </p>
                            <p className="text-xs mt-1 text-blue-600">
                                {expandedTopLevel === 'non-business' ? 'Click to collapse' : 'Click to view categories'}
                            </p>
                        </div>
                    </button>
                </div>

                <p className="text-sm text-center mb-4" style={{ color: COLORS.mediumGray }}>
                    View and edit category identifiers to resolve conflicts flagged in Identifier Quality Review above.
                </p>

                {categoryManagementExpanded && expandedTopLevel && (
                    // Expanded View
                    <div>
                        {/* Action Buttons */}
                        <div className="mb-6 flex flex-wrap gap-2">
                    <button
                        onClick={() => setShowAdvancedAdd(!showAdvancedAdd)}
                        className="text-sm font-medium flex items-center gap-2 px-3 py-2 rounded border hover:bg-gray-50"
                        style={{ borderColor: COLORS.lightGray, color: COLORS.mediumGray }}
                    >
                        {showAdvancedAdd ? '▼' : '▶'} Advanced: Add Custom Category
                    </button>
                    <button
                        onClick={() => setShowVisibilityPrefs(!showVisibilityPrefs)}
                        className="text-sm font-medium flex items-center gap-2 px-3 py-2 rounded border hover:bg-gray-50"
                        style={{ borderColor: COLORS.lightGray, color: COLORS.mediumGray }}
                    >
                        {showVisibilityPrefs ? '▼' : '▶'} Manage Category Visibility Preferences
                    </button>
                </div>

                {/* Advanced Add Category Form */}
                {showAdvancedAdd && (
                    <div className="mb-6 p-4 bg-yellow-50 rounded-lg border-2 border-yellow-200">
                        <div className="flex items-start gap-2 mb-3">
                            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-yellow-800">
                                    ⚠️ Advanced Feature - Use with caution
                                </p>
                                <p className="text-xs text-yellow-700 mt-1">
                                    Categories follow a structured accounting format. Adding custom categories may affect P&L reporting.
                                    Most needs are covered by the onboarding wizard (staff/partners) or by adding identifiers to existing categories.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 mb-3">
                            <div className="grid grid-cols-6 gap-3">
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: COLORS.darkGray }}>
                                        Code *
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g., 85.1"
                                        value={newCategory.code}
                                        onChange={(e) => setNewCategory(prev => ({ ...prev, code: e.target.value }))}
                                        className="w-full border rounded px-3 py-2 text-sm"
                                        maxLength="5"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-medium mb-1" style={{ color: COLORS.darkGray }}>
                                        Name *
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Category Name"
                                        value={newCategory.name}
                                        onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full border rounded px-3 py-2 text-sm"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-medium mb-1" style={{ color: COLORS.darkGray }}>
                                        Identifiers
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Comma separated"
                                        value={newCategory.identifiers}
                                        onChange={(e) => setNewCategory(prev => ({ ...prev, identifiers: e.target.value }))}
                                        className="w-full border rounded px-3 py-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: COLORS.darkGray }}>
                                        Type *
                                    </label>
                                    <select
                                        value={newCategory.type}
                                        onChange={(e) => setNewCategory(prev => ({ ...prev, type: e.target.value }))}
                                        className="w-full border rounded px-3 py-2 text-sm"
                                    >
                                        <option value="expense">Expense</option>
                                        <option value="income">Income</option>
                                        <option value="non-business">Non-Business</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={addNewCategory}
                                className="px-4 py-2 rounded font-medium text-white flex items-center text-sm"
                                style={{ backgroundColor: COLORS.slainteBlue }}
                                disabled={!newCategory.code || !newCategory.name}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Category
                            </button>
                            <button
                                onClick={generateCategoryCode}
                                className="px-3 py-2 rounded text-sm border"
                                style={{ borderColor: COLORS.lightGray, color: COLORS.mediumGray }}
                                title="Generate next available code"
                            >
                                Generate Code
                            </button>
                        </div>
                    </div>
                )}

                {/* Category Visibility Preferences subsection */}
                {showVisibilityPrefs && (
                    <div className="mb-6">
                        {(() => {
                            const stats = getCategoryVisibilityStats(categoryMapping, categoryPreferences);
                            const categoriesBySection = getCategoriesBySection(categoryMapping, categoryPreferences);

                            const handleToggleCategoryVisibility = (categoryCode) => {
                                const category = categoryMapping.find(cat => cat.code === categoryCode);
                                if (!category) return;

                                // Get default visibility for this category
                                const getDefaultVisibility = (cat) => {
                                    if (!cat.code.includes('.')) return false;
                                    if (cat.personalization === 'Personalize') return false;
                                    return true;
                                };

                                const defaultVisibility = getDefaultVisibility(category);
                                const currentVisibility = categoryPreferences.hasOwnProperty(categoryCode)
                                    ? categoryPreferences[categoryCode]
                                    : defaultVisibility;

                                const newPreferences = {
                                    ...categoryPreferences,
                                    [categoryCode]: !currentVisibility
                                };

                                setCategoryPreferences(newPreferences);
                                saveCategoryPreferences(newPreferences);
                            };

                            const handleResetPreferences = () => {
                                if (window.confirm('Reset all category visibility preferences to defaults?')) {
                                    const emptyPrefs = resetCategoryPreferences();
                                    setCategoryPreferences(emptyPrefs);
                                }
                            };

                            const togglePreferenceSection = (section) => {
                                setExpandedPreferenceSections(prev => ({
                                    ...prev,
                                    [section]: !prev[section]
                                }));
                            };

                            return (
                                <>
                                    {/* Statistics */}
                                    <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="p-3 rounded-lg border" style={{ backgroundColor: COLORS.backgroundGray }}>
                                    <div className="text-center">
                                        <p className="text-xs" style={{ color: COLORS.mediumGray }}>Total Categories</p>
                                        <p className="text-2xl font-bold mt-1" style={{ color: COLORS.darkGray }}>
                                            {stats.total}
                                        </p>
                                    </div>
                                </div>
                                <div className="p-3 rounded-lg border" style={{ backgroundColor: '#DCFCE7' }}>
                                    <div className="text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <Eye className="h-4 w-4" style={{ color: COLORS.incomeColor }} />
                                            <p className="text-xs" style={{ color: COLORS.incomeColor }}>Visible</p>
                                        </div>
                                        <p className="text-2xl font-bold mt-1" style={{ color: COLORS.incomeColor }}>
                                            {stats.visible}
                                        </p>
                                    </div>
                                </div>
                                <div className="p-3 rounded-lg border" style={{ backgroundColor: '#FEF3C7' }}>
                                    <div className="text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <EyeOff className="h-4 w-4" style={{ color: COLORS.highlightYellow }} />
                                            <p className="text-xs" style={{ color: COLORS.highlightYellow }}>Hidden</p>
                                        </div>
                                        <p className="text-2xl font-bold mt-1" style={{ color: COLORS.highlightYellow }}>
                                            {stats.hidden}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Reset Button */}
                            <div className="mb-4 flex justify-end">
                                <button
                                    onClick={handleResetPreferences}
                                    className="px-4 py-2 rounded text-sm font-medium border"
                                    style={{ borderColor: COLORS.lightGray, color: COLORS.mediumGray }}
                                >
                                    Reset to Defaults
                                </button>
                            </div>

                            {/* Categories by Section */}
                            <div className="space-y-2">
                                {Object.entries(categoriesBySection)
                                    .filter(([section, categories]) => categories.length > 0) // Only show sections with categories
                                    .sort(([sectionA, catsA], [sectionB, catsB]) => {
                                        // Sort by type: income first, expense middle, non-business last
                                        const typeOrder = { 'income': 0, 'expense': 1, 'non-business': 2 };
                                        const typeA = catsA[0]?.type || 'expense';
                                        const typeB = catsB[0]?.type || 'expense';

                                        if (typeOrder[typeA] !== typeOrder[typeB]) {
                                            return typeOrder[typeA] - typeOrder[typeB];
                                        }

                                        return sectionA.localeCompare(sectionB);
                                    })
                                    .map(([section, categories]) => {
                                        const visibleCount = categories.filter(cat => cat.visible).length;
                                        const hiddenCount = categories.length - visibleCount;

                                        return (
                                            <div key={section} className="border rounded-lg overflow-hidden">
                                                {/* Section Header */}
                                                <button
                                                    onClick={() => togglePreferenceSection(section)}
                                                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                                                    style={{ backgroundColor: expandedPreferenceSections[section] ? COLORS.backgroundGray : COLORS.white }}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-lg">
                                                            {expandedPreferenceSections[section] ? '▼' : '▶'}
                                                        </span>
                                                        <div className="text-left">
                                                            <h4 className="font-semibold" style={{ color: COLORS.darkGray }}>
                                                                {section}
                                                            </h4>
                                                            <p className="text-xs" style={{ color: COLORS.mediumGray }}>
                                                                {visibleCount} visible, {hiddenCount} hidden
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                        categories[0]?.type === 'income' ? 'bg-green-100 text-green-700' :
                                                        categories[0]?.type === 'expense' ? 'bg-red-100 text-red-700' :
                                                        'bg-blue-100 text-blue-700'
                                                    }`}>
                                                        {categories[0]?.type || 'mixed'}
                                                    </span>
                                                </button>

                                                {/* Section Content */}
                                                {expandedPreferenceSections[section] && (
                                                    <div className="border-t p-4">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                            {categories
                                                                .sort((a, b) => {
                                                                    const aCode = parseFloat(a.code);
                                                                    const bCode = parseFloat(b.code);
                                                                    return aCode - bCode;
                                                                })
                                                                .map(category => (
                                                                    <label
                                                                        key={category.code}
                                                                        className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={category.visible}
                                                                            onChange={() => handleToggleCategoryVisibility(category.code)}
                                                                            className="h-4 w-4 rounded"
                                                                            style={{ accentColor: COLORS.slainteBlue }}
                                                                        />
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="font-mono text-xs" style={{ color: COLORS.mediumGray }}>
                                                                                    {category.code}
                                                                                </span>
                                                                                <span className="text-sm truncate" style={{ color: COLORS.darkGray }}>
                                                                                    {category.name}
                                                                                </span>
                                                                            </div>
                                                                            {category.identifiers && category.identifiers.length > 0 && (
                                                                                <p className="text-xs truncate" style={{ color: COLORS.lightGray }}>
                                                                                    {category.identifiers.length} identifier{category.identifiers.length !== 1 ? 's' : ''}
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                        {category.visible ? (
                                                                            <Eye className="h-4 w-4 flex-shrink-0" style={{ color: COLORS.incomeColor }} />
                                                                        ) : (
                                                                            <EyeOff className="h-4 w-4 flex-shrink-0" style={{ color: COLORS.lightGray }} />
                                                                        )}
                                                                    </label>
                                                                ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                            </div>

                            {/* Help Text */}
                            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-blue-700">
                                        <strong>Tip:</strong> Categories you hide here will still be available for reporting and can be manually selected when needed.
                                        This only affects the quick categorization dropdowns in the Transaction List.
                                    </p>
                                </div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                )}

                {/* Categories List - Grouped by Section */}
                <div className="space-y-2">
                    {/* INCOME - Show all income categories */}
                    {expandedTopLevel === 'income' && (
                        <div className="border rounded-lg overflow-hidden" style={{ borderColor: COLORS.incomeColor }}>
                            <div className="p-4 bg-green-50 border-b">
                                <h4 className="font-semibold" style={{ color: COLORS.incomeColor }}>
                                    Income Categories ({categoryMapping.filter(c => c.type === 'income').length})
                                </h4>
                            </div>
                            <div className="border-t">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Code</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Name</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Identifiers</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {categoryMapping
                                            .filter(c => c.type === 'income')
                                            .sort((a, b) => parseFloat(a.code) - parseFloat(b.code))
                                            .map(category => (
                                            <tr
                                                key={category.code}
                                                ref={(el) => categoryRefs.current[category.code] = el}
                                                className="border-t border-gray-100 hover:bg-gray-50 transition-colors"
                                            >
                                                <td className="px-4 py-2 font-mono text-sm" style={{ color: COLORS.mediumGray }}>
                                                    {category.code}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <span className="text-sm" style={{ color: COLORS.darkGray }}>
                                                        {category.name}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <div className="space-y-2">
                                                        <div className="flex flex-wrap gap-1">
                                                            {category.identifiers.length > 0 ? (
                                                                category.identifiers.map((identifier, idx) => (
                                                                    <span
                                                                        key={idx}
                                                                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs"
                                                                        style={{ backgroundColor: COLORS.backgroundGray, color: COLORS.darkGray }}
                                                                    >
                                                                        {identifier}
                                                                        <button
                                                                            onClick={() => removeIdentifier(category.code, identifier)}
                                                                            className="hover:text-red-600"
                                                                            title="Remove identifier"
                                                                        >
                                                                            ×
                                                                        </button>
                                                                    </span>
                                                                ))
                                                            ) : (
                                                                <span className="text-xs" style={{ color: COLORS.lightGray }}>No identifiers</span>
                                                            )}
                                                        </div>
                                                        {addingIdentifierTo === category.code ? (
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={newIdentifier}
                                                                    onChange={(e) => setNewIdentifier(e.target.value)}
                                                                    onKeyPress={(e) => e.key === 'Enter' && addIdentifier(category.code)}
                                                                    placeholder="New identifier..."
                                                                    className="border rounded px-2 py-1 text-xs w-48"
                                                                    autoFocus
                                                                />
                                                                <button
                                                                    onClick={() => addIdentifier(category.code)}
                                                                    className="px-2 py-1 rounded text-xs text-white"
                                                                    style={{ backgroundColor: COLORS.incomeColor }}
                                                                >
                                                                    Add
                                                                </button>
                                                                <button
                                                                    onClick={() => { setAddingIdentifierTo(null); setNewIdentifier(''); }}
                                                                    className="px-2 py-1 rounded text-xs"
                                                                    style={{ color: COLORS.mediumGray }}
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => setAddingIdentifierTo(category.code)}
                                                                className="text-xs flex items-center gap-1 hover:underline"
                                                                style={{ color: COLORS.slainteBlue }}
                                                            >
                                                                <Plus className="h-3 w-3" />
                                                                Add identifier
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <div className="flex items-center space-x-1">
                                                        <button
                                                            onClick={() => deleteCategory(category.code)}
                                                            className="p-1 hover:bg-red-50 rounded"
                                                            style={{ color: COLORS.expenseColor }}
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* EXPENSES - Show sub-groups */}
                    {expandedTopLevel === 'expenses' && expenseSubGroups.map((group) => (
                        <div key={group.name} className="border rounded-lg overflow-hidden">
                            {/* Group Header */}
                            <button
                                onClick={() => toggleSection(group.name)}
                                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                                style={{ backgroundColor: expandedSections[group.name] ? COLORS.backgroundGray : COLORS.white }}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">
                                        {expandedSections[group.name] ? '▼' : '▶'}
                                    </span>
                                    {group.icon && (
                                        <span className="text-2xl">{group.icon}</span>
                                    )}
                                    <div className="text-left">
                                        <h4 className="font-semibold" style={{ color: COLORS.darkGray }}>
                                            {group.name}
                                        </h4>
                                        <p className="text-xs" style={{ color: COLORS.mediumGray }}>
                                            {group.categories.length} {group.categories.length === 1 ? 'category' : 'categories'} • {group.description}
                                        </p>
                                    </div>
                                </div>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    group.type === 'income' ? 'bg-green-100 text-green-700' :
                                    group.type === 'expense' ? 'bg-red-100 text-red-700' :
                                    'bg-blue-100 text-blue-700'
                                }`}>
                                    {group.type}
                                </span>
                            </button>

                            {/* Group Content */}
                            {expandedSections[group.name] && (
                                <div className="border-t">
                                    <table className="w-full">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Code</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Name</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Identifiers</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {group.categories
                                                .sort((a, b) => {
                                                    const aCode = parseFloat(a.code);
                                                    const bCode = parseFloat(b.code);
                                                    return aCode - bCode;
                                                })
                                                .map(category => (
                                                <tr
                                                    key={category.code}
                                                    ref={(el) => categoryRefs.current[category.code] = el}
                                                    className="border-t border-gray-100 hover:bg-gray-50 transition-colors"
                                                >
                                                    <td className="px-4 py-2 font-mono text-sm" style={{ color: COLORS.mediumGray }}>
                                                        {category.code}
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        {editingCategory === category.code ? (
                                                            <input
                                                                type="text"
                                                                defaultValue={category.name}
                                                                onBlur={(e) => saveInlineEdit(category.code, 'name', e.target.value)}
                                                                onKeyPress={(e) => e.key === 'Enter' && e.target.blur()}
                                                                className="border rounded px-2 py-1 text-sm w-full"
                                                                autoFocus
                                                            />
                                                        ) : (
                                                            <span className="text-sm" style={{ color: COLORS.darkGray }}>
                                                                {category.name}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <div className="space-y-2">
                                                            <div className="flex flex-wrap gap-1">
                                                                {category.identifiers.length > 0 ? (
                                                                    category.identifiers.map((identifier, idx) => (
                                                                        <span
                                                                            key={idx}
                                                                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs"
                                                                            style={{ backgroundColor: COLORS.backgroundGray, color: COLORS.darkGray }}
                                                                        >
                                                                            {identifier}
                                                                            <button
                                                                                onClick={() => removeIdentifier(category.code, identifier)}
                                                                                className="hover:text-red-600"
                                                                                title="Remove identifier"
                                                                            >
                                                                                ×
                                                                            </button>
                                                                        </span>
                                                                    ))
                                                                ) : (
                                                                    <span className="text-xs" style={{ color: COLORS.lightGray }}>No identifiers</span>
                                                                )}
                                                            </div>
                                                            {addingIdentifierTo === category.code ? (
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="text"
                                                                        value={newIdentifier}
                                                                        onChange={(e) => setNewIdentifier(e.target.value)}
                                                                        onKeyPress={(e) => e.key === 'Enter' && addIdentifier(category.code)}
                                                                        placeholder="New identifier..."
                                                                        className="border rounded px-2 py-1 text-xs w-48"
                                                                        autoFocus
                                                                    />
                                                                    <button
                                                                        onClick={() => addIdentifier(category.code)}
                                                                        className="px-2 py-1 rounded text-xs text-white"
                                                                        style={{ backgroundColor: COLORS.incomeColor }}
                                                                    >
                                                                        Add
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { setAddingIdentifierTo(null); setNewIdentifier(''); }}
                                                                        className="px-2 py-1 rounded text-xs"
                                                                        style={{ color: COLORS.mediumGray }}
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => setAddingIdentifierTo(category.code)}
                                                                    className="text-xs flex items-center gap-1 hover:underline"
                                                                    style={{ color: COLORS.slainteBlue }}
                                                                >
                                                                    <Plus className="h-3 w-3" />
                                                                    Add identifier
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <div className="flex items-center space-x-1">
                                                            <button
                                                                onClick={() => setEditingCategory(editingCategory === category.code ? null : category.code)}
                                                                className="p-1 hover:bg-blue-50 rounded"
                                                                style={{ color: COLORS.slainteBlue }}
                                                                title="Edit"
                                                            >
                                                                <Edit3 className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => deleteCategory(category.code)}
                                                                className="p-1 hover:bg-red-50 rounded"
                                                                style={{ color: COLORS.expenseColor }}
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}

                    {/* NON-BUSINESS - Show all non-business categories */}
                    {expandedTopLevel === 'non-business' && (
                        <div className="border rounded-lg overflow-hidden" style={{ borderColor: COLORS.slainteBlue }}>
                            <div className="p-4 bg-blue-50 border-b">
                                <h4 className="font-semibold" style={{ color: COLORS.slainteBlue }}>
                                    Non-Business Categories ({categoryMapping.filter(c => c.type === 'non-business').length})
                                </h4>
                            </div>
                            <div className="border-t">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Code</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Name</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Identifiers</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {categoryMapping
                                            .filter(c => c.type === 'non-business')
                                            .sort((a, b) => parseFloat(a.code) - parseFloat(b.code))
                                            .map(category => (
                                            <tr
                                                key={category.code}
                                                ref={(el) => categoryRefs.current[category.code] = el}
                                                className="border-t border-gray-100 hover:bg-gray-50 transition-colors"
                                            >
                                                <td className="px-4 py-2 font-mono text-sm" style={{ color: COLORS.mediumGray }}>
                                                    {category.code}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <span className="text-sm" style={{ color: COLORS.darkGray }}>
                                                        {category.name}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <div className="space-y-2">
                                                        <div className="flex flex-wrap gap-1">
                                                            {category.identifiers.length > 0 ? (
                                                                category.identifiers.map((identifier, idx) => (
                                                                    <span
                                                                        key={idx}
                                                                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs"
                                                                        style={{ backgroundColor: COLORS.backgroundGray, color: COLORS.darkGray }}
                                                                    >
                                                                        {identifier}
                                                                        <button
                                                                            onClick={() => removeIdentifier(category.code, identifier)}
                                                                            className="hover:text-red-600"
                                                                            title="Remove identifier"
                                                                        >
                                                                            ×
                                                                        </button>
                                                                    </span>
                                                                ))
                                                            ) : (
                                                                <span className="text-xs" style={{ color: COLORS.lightGray }}>No identifiers</span>
                                                            )}
                                                        </div>
                                                        {addingIdentifierTo === category.code ? (
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={newIdentifier}
                                                                    onChange={(e) => setNewIdentifier(e.target.value)}
                                                                    onKeyPress={(e) => e.key === 'Enter' && addIdentifier(category.code)}
                                                                    placeholder="New identifier..."
                                                                    className="border rounded px-2 py-1 text-xs w-48"
                                                                    autoFocus
                                                                />
                                                                <button
                                                                    onClick={() => addIdentifier(category.code)}
                                                                    className="px-2 py-1 rounded text-xs text-white"
                                                                    style={{ backgroundColor: COLORS.slainteBlue }}
                                                                >
                                                                    Add
                                                                </button>
                                                                <button
                                                                    onClick={() => { setAddingIdentifierTo(null); setNewIdentifier(''); }}
                                                                    className="px-2 py-1 rounded text-xs"
                                                                    style={{ color: COLORS.mediumGray }}
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => setAddingIdentifierTo(category.code)}
                                                                className="text-xs flex items-center gap-1 hover:underline"
                                                                style={{ color: COLORS.slainteBlue }}
                                                            >
                                                                <Plus className="h-3 w-3" />
                                                                Add identifier
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <div className="flex items-center space-x-1">
                                                        <button
                                                            onClick={() => deleteCategory(category.code)}
                                                            className="p-1 hover:bg-red-50 rounded"
                                                            style={{ color: COLORS.expenseColor }}
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
                    </div>
                )}
            </div>

            {/* Identifier Review */}
            <div className="bg-white p-6 rounded-lg border">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <Search className="h-5 w-5 mr-2" style={{ color: COLORS.slainteBlue }} />
                    Identifier Quality Review
                </h3>

                {(() => {
                    // Analyze all identifiers for issues
                    const issues = {
                        duplicates: [],
                        conflicts: [],
                        tooBrief: []
                    };

                    // Track all identifiers with their categories
                    const identifierMap = new Map();

                    categoryMapping.forEach(category => {
                        category.identifiers.forEach(identifier => {
                            const lowerIdentifier = identifier.toLowerCase();

                            if (!identifierMap.has(lowerIdentifier)) {
                                identifierMap.set(lowerIdentifier, []);
                            }
                            identifierMap.set(lowerIdentifier, [
                                ...identifierMap.get(lowerIdentifier),
                                { category: category.name, code: category.code, original: identifier }
                            ]);
                        });
                    });

                    // Find duplicates (exact matches across different categories)
                    identifierMap.forEach((categories, identifier) => {
                        if (categories.length > 1) {
                            issues.duplicates.push({
                                identifier: categories[0].original,
                                categories: categories
                            });
                        }
                    });

                    // Find conflicts (substring matches that could cause false positives)
                    const allIdentifiers = Array.from(identifierMap.keys());
                    allIdentifiers.forEach((identifier1, i) => {
                        allIdentifiers.forEach((identifier2, j) => {
                            if (i !== j && identifier1.length < identifier2.length) {
                                // Check if identifier1 is a substring of identifier2
                                if (identifier2.includes(identifier1)) {
                                    const cats1 = identifierMap.get(identifier1);
                                    const cats2 = identifierMap.get(identifier2);

                                    // Only flag as conflict if they're in different categories
                                    const differentCategories = cats1.some(c1 =>
                                        !cats2.some(c2 => c2.code === c1.code)
                                    );

                                    if (differentCategories) {
                                        // Check if this conflict is already added
                                        const alreadyExists = issues.conflicts.some(c =>
                                            c.shorter === identifier1 && c.longer === identifier2
                                        );

                                        if (!alreadyExists) {
                                            issues.conflicts.push({
                                                shorter: identifier1,
                                                shorterCats: cats1,
                                                longer: identifier2,
                                                longerCats: cats2
                                            });
                                        }
                                    }
                                }
                            }
                        });
                    });

                    // Find too brief or generic identifiers (3 chars or less, or common generic words)
                    const genericWords = ['pos', 'atm', 'fee', 'pay', 'tax', 'dd', 'dd '];
                    identifierMap.forEach((categories, identifier) => {
                        if (identifier.length <= 3 || genericWords.includes(identifier)) {
                            issues.tooBrief.push({
                                identifier: categories[0].original,
                                categories: categories
                            });
                        }
                    });

                    const totalIssues = issues.duplicates.length + issues.conflicts.length + issues.tooBrief.length;

                    return (
                        <>
                            {/* Description */}
                            <p className="text-sm mb-4" style={{ color: COLORS.mediumGray }}>
                                {totalIssues === 0 ? (
                                    'All identifiers are unique, specific, and properly configured.'
                                ) : (
                                    <>
                                        Found {issues.duplicates.length > 0 && `${issues.duplicates.length} duplicate identifier${issues.duplicates.length !== 1 ? 's' : ''}`}
                                        {issues.duplicates.length > 0 && issues.conflicts.length > 0 && ', '}
                                        {issues.conflicts.length > 0 && `${issues.conflicts.length} conflict${issues.conflicts.length !== 1 ? 's' : ''}`}
                                        {(issues.duplicates.length > 0 || issues.conflicts.length > 0) && issues.tooBrief.length > 0 && ', and '}
                                        {issues.tooBrief.length > 0 && `${issues.tooBrief.length} overly brief identifier${issues.tooBrief.length !== 1 ? 's' : ''}`}.
                                    </>
                                )}
                            </p>

                            {/* Interactive Statistics Boxes */}
                            <div className="grid grid-cols-4 gap-4 mb-6">
                                <div className="p-3 rounded-lg border" style={{ backgroundColor: COLORS.backgroundGray }}>
                                    <div className="text-center">
                                        <p className="text-xs" style={{ color: COLORS.mediumGray }}>Total Identifiers</p>
                                        <p className="text-2xl font-bold mt-1" style={{ color: COLORS.darkGray }}>
                                            {identifierMap.size}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => issues.duplicates.length > 0 && setShowDuplicateIdentifiers(!showDuplicateIdentifiers)}
                                    disabled={issues.duplicates.length === 0}
                                    className={`p-3 rounded-lg border transition-all ${
                                        issues.duplicates.length > 0
                                            ? 'hover:bg-red-100 cursor-pointer'
                                            : 'cursor-not-allowed'
                                    }`}
                                    style={{ backgroundColor: issues.duplicates.length > 0 ? '#FEE2E2' : '#F3F4F6' }}
                                >
                                    <div className="text-center">
                                        <p className="text-xs" style={{ color: issues.duplicates.length > 0 ? COLORS.expenseColor : COLORS.lightGray }}>
                                            Duplicates
                                        </p>
                                        <p className="text-2xl font-bold mt-1" style={{ color: issues.duplicates.length > 0 ? COLORS.expenseColor : COLORS.lightGray }}>
                                            {issues.duplicates.length}
                                        </p>
                                        {issues.duplicates.length > 0 && (
                                            <p className="text-xs mt-1" style={{ color: COLORS.expenseColor }}>Click to view</p>
                                        )}
                                    </div>
                                </button>
                                <button
                                    onClick={() => issues.conflicts.length > 0 && setShowConflicts(!showConflicts)}
                                    disabled={issues.conflicts.length === 0}
                                    className={`p-3 rounded-lg border transition-all ${
                                        issues.conflicts.length > 0
                                            ? 'hover:bg-orange-100 cursor-pointer'
                                            : 'cursor-not-allowed'
                                    }`}
                                    style={{ backgroundColor: issues.conflicts.length > 0 ? '#FFEDD5' : '#F3F4F6' }}
                                >
                                    <div className="text-center">
                                        <p className="text-xs" style={{ color: issues.conflicts.length > 0 ? '#EA580C' : COLORS.lightGray }}>
                                            Conflicts
                                        </p>
                                        <p className="text-2xl font-bold mt-1" style={{ color: issues.conflicts.length > 0 ? '#EA580C' : COLORS.lightGray }}>
                                            {issues.conflicts.length}
                                        </p>
                                        {issues.conflicts.length > 0 && (
                                            <p className="text-xs mt-1" style={{ color: '#EA580C' }}>Click to view</p>
                                        )}
                                    </div>
                                </button>
                                <button
                                    onClick={() => issues.tooBrief.length > 0 && setShowBriefIdentifiers(!showBriefIdentifiers)}
                                    disabled={issues.tooBrief.length === 0}
                                    className={`p-3 rounded-lg border transition-all ${
                                        issues.tooBrief.length > 0
                                            ? 'hover:bg-yellow-100 cursor-pointer'
                                            : 'cursor-not-allowed'
                                    }`}
                                    style={{ backgroundColor: issues.tooBrief.length > 0 ? '#FEF3C7' : '#F3F4F6' }}
                                >
                                    <div className="text-center">
                                        <p className="text-xs" style={{ color: issues.tooBrief.length > 0 ? COLORS.highlightYellow : COLORS.lightGray }}>
                                            Too Brief
                                        </p>
                                        <p className="text-2xl font-bold mt-1" style={{ color: issues.tooBrief.length > 0 ? COLORS.highlightYellow : COLORS.lightGray }}>
                                            {issues.tooBrief.length}
                                        </p>
                                        {issues.tooBrief.length > 0 && (
                                            <p className="text-xs mt-1" style={{ color: COLORS.highlightYellow }}>Click to view</p>
                                        )}
                                    </div>
                                </button>
                            </div>

                            {totalIssues === 0 ? (
                                <div className="p-8 text-center rounded-lg" style={{ backgroundColor: '#DCFCE7' }}>
                                    <CheckCircle className="h-12 w-12 mx-auto mb-3" style={{ color: COLORS.incomeColor }} />
                                    <p className="font-semibold mb-2" style={{ color: COLORS.incomeColor }}>
                                        Excellent! No identifier issues found
                                    </p>
                                    <p className="text-sm" style={{ color: COLORS.mediumGray }}>
                                        All identifiers are unique, specific, and properly configured
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Duplicates */}
                                    {issues.duplicates.length > 0 && showDuplicateIdentifiers && (
                                        <div className="border rounded-lg overflow-hidden" style={{ borderColor: COLORS.expenseColor }}>
                                            <div className="p-4 text-left" style={{ backgroundColor: '#FEE2E2' }}>
                                                <h4 className="font-semibold flex items-center gap-2" style={{ color: COLORS.expenseColor }}>
                                                    <AlertCircle className="h-5 w-5" />
                                                    Duplicate Identifiers ({issues.duplicates.length})
                                                </h4>
                                                <p className="text-xs mt-1" style={{ color: '#7F1D1D' }}>
                                                    These identifiers appear in multiple categories. This can cause transactions to be categorized incorrectly.
                                                </p>
                                            </div>
                                            <div className="divide-y border-t">
                                                    {issues.duplicates.map((issue, idx) => (
                                                        <div key={idx} className="p-4 hover:bg-gray-50">
                                                            <div className="flex items-start gap-3">
                                                                <div className="flex-1">
                                                                    <p className="font-semibold mb-2" style={{ color: COLORS.darkGray }}>
                                                                        "{issue.identifier}"
                                                                    </p>
                                                                    <p className="text-sm mb-2" style={{ color: COLORS.mediumGray }}>
                                                                        Found in {issue.categories.length} categories:
                                                                    </p>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {issue.categories.map((cat, catIdx) => (
                                                                            <button
                                                                                key={catIdx}
                                                                                onClick={() => scrollToCategory(cat.code)}
                                                                                className="px-2 py-1 rounded text-xs font-medium hover:bg-blue-100 transition-colors cursor-pointer"
                                                                                style={{ backgroundColor: COLORS.backgroundGray, color: COLORS.slainteBlue }}
                                                                                title="Click to view this category"
                                                                            >
                                                                                {cat.code}: {cat.category}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                        </div>
                                    )}

                                    {/* Conflicts */}
                                    {issues.conflicts.length > 0 && showConflicts && (
                                        <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#EA580C' }}>
                                            <div className="p-4 text-left" style={{ backgroundColor: '#FFEDD5' }}>
                                                <h4 className="font-semibold flex items-center gap-2" style={{ color: '#EA580C' }}>
                                                    <AlertCircle className="h-5 w-5" />
                                                    Potential Conflicts ({issues.conflicts.length})
                                                </h4>
                                                <p className="text-xs mt-1" style={{ color: '#7C2D12' }}>
                                                    These identifiers may cause false matches. Example: "Sandra Glen" will match "Sand" if both are identifiers.
                                                </p>
                                            </div>
                                            <div className="divide-y border-t">
                                                    {issues.conflicts.slice(0, 10).map((issue, idx) => (
                                                    <div key={idx} className="p-4 hover:bg-gray-50">
                                                        <div className="flex items-start gap-3">
                                                            <div className="flex-1">
                                                                <p className="text-sm mb-2" style={{ color: COLORS.darkGray }}>
                                                                    <span className="font-mono font-semibold" style={{ color: COLORS.expenseColor }}>
                                                                        "{issue.shorter}"
                                                                    </span>
                                                                    {' '}will match{' '}
                                                                    <span className="font-mono font-semibold" style={{ color: COLORS.slainteBlue }}>
                                                                        "{issue.longer}"
                                                                    </span>
                                                                </p>
                                                                <div className="grid grid-cols-2 gap-4 text-xs">
                                                                    <div>
                                                                        <p className="font-semibold mb-1" style={{ color: COLORS.mediumGray }}>
                                                                            Shorter identifier in:
                                                                        </p>
                                                                        {issue.shorterCats.map((cat, catIdx) => (
                                                                            <button
                                                                                key={catIdx}
                                                                                onClick={() => scrollToCategory(cat.code)}
                                                                                className="ml-2 block text-left hover:bg-blue-50 px-2 py-1 rounded transition-colors cursor-pointer"
                                                                                style={{ color: COLORS.slainteBlue }}
                                                                                title="Click to view this category"
                                                                            >
                                                                                {cat.code}: {cat.category}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                    <div>
                                                                        <p className="font-semibold mb-1" style={{ color: COLORS.mediumGray }}>
                                                                            Longer identifier in:
                                                                        </p>
                                                                        {issue.longerCats.map((cat, catIdx) => (
                                                                            <button
                                                                                key={catIdx}
                                                                                onClick={() => scrollToCategory(cat.code)}
                                                                                className="ml-2 block text-left hover:bg-blue-50 px-2 py-1 rounded transition-colors cursor-pointer"
                                                                                style={{ color: COLORS.slainteBlue }}
                                                                                title="Click to view this category"
                                                                            >
                                                                                {cat.code}: {cat.category}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                                {issues.conflicts.length > 10 && (
                                                    <div className="p-3 text-center text-sm" style={{ backgroundColor: COLORS.backgroundGray, color: COLORS.mediumGray }}>
                                                        ... and {issues.conflicts.length - 10} more conflicts
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Too Brief */}
                                    {issues.tooBrief.length > 0 && showBriefIdentifiers && (
                                        <div className="border rounded-lg overflow-hidden" style={{ borderColor: COLORS.highlightYellow }}>
                                            <div className="p-4 text-left" style={{ backgroundColor: '#FEF3C7' }}>
                                                <h4 className="font-semibold flex items-center gap-2" style={{ color: COLORS.darkGray }}>
                                                    <AlertCircle className="h-5 w-5" style={{ color: COLORS.highlightYellow }} />
                                                    Too Brief or Generic ({issues.tooBrief.length})
                                                </h4>
                                                <p className="text-xs mt-1" style={{ color: '#78350F' }}>
                                                    These identifiers are very short (≤3 characters) or generic (like "POS"). They may cause too many false matches.
                                                </p>
                                            </div>
                                            <div className="divide-y border-t">
                                                    {issues.tooBrief.map((issue, idx) => (
                                                        <div key={idx} className="p-4 hover:bg-gray-50">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div>
                                                                    <p className="font-mono font-semibold mb-1" style={{ color: COLORS.darkGray }}>
                                                                        "{issue.identifier}"
                                                                    </p>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {issue.categories.map((cat, catIdx) => (
                                                                            <button
                                                                                key={catIdx}
                                                                                onClick={() => scrollToCategory(cat.code)}
                                                                                className="px-2 py-1 rounded text-xs font-medium hover:bg-blue-100 transition-colors cursor-pointer"
                                                                                style={{ backgroundColor: COLORS.backgroundGray, color: COLORS.slainteBlue }}
                                                                                title="Click to view this category"
                                                                            >
                                                                                {cat.code}: {cat.category}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                                <span className="px-2 py-1 rounded text-xs font-medium whitespace-nowrap"
                                                                    style={{ backgroundColor: COLORS.backgroundGray, color: COLORS.mediumGray }}>
                                                                    {issue.identifier.length} chars
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    );
                })()}
            </div>

            {/* Backup & Restore Section */}
            <div className="bg-white p-6 rounded-lg border">
                <button
                    onClick={() => setShowExportImport(!showExportImport)}
                    className="w-full flex items-center justify-between mb-4 hover:opacity-70 transition-opacity"
                >
                    <h3 className="text-lg font-semibold flex items-center">
                        <Download className="h-5 w-5 mr-2" style={{ color: COLORS.slainteBlue }} />
                        Backup & Restore
                    </h3>
                    <ChevronDown
                        className={`h-5 w-5 transition-transform ${showExportImport ? 'transform rotate-180' : ''}`}
                        style={{ color: COLORS.slainteBlue }}
                    />
                </button>

                {showExportImport && (
                    <>
                        <p className="text-sm mb-6" style={{ color: COLORS.mediumGray }}>
                            Save your progress before app updates or restore from a previous backup
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Backup */}
                            <div className="p-4 border-2 rounded-lg" style={{ borderColor: COLORS.incomeColor, backgroundColor: `${COLORS.incomeColor}10` }}>
                                <div className="flex items-center gap-2 mb-3">
                                    <Download className="h-5 w-5" style={{ color: COLORS.incomeColor }} />
                                    <h4 className="font-semibold" style={{ color: COLORS.incomeColor }}>Backup All Data</h4>
                                </div>
                                <p className="text-sm mb-4" style={{ color: COLORS.darkGray }}>
                                    Creates a complete backup including all transactions, categories, identifiers, PCRS data, practice profile, and settings.
                                </p>
                                <button
                                    onClick={() => {
                                        const dataToExport = {
                                            version: '2.0',
                                            appVersion: 'Slainte Finance V2',
                                            exportDate: new Date().toISOString(),
                                            transactions,
                                            unidentifiedTransactions,
                                            categoryMapping,
                                            paymentAnalysisData,
                                            settings: {
                                                selectedYear,
                                                showSensitiveData
                                            },
                                            practiceProfile: localStorage.getItem('slainte_practice_profile'),
                                            savedReports: JSON.parse(localStorage.getItem('gp_finance_saved_reports') || '[]'),
                                            aiCorrections: localStorage.getItem('slainte_ai_corrections'),
                                            categoryPreferences: localStorage.getItem('gp_finance_category_preferences')
                                        };
                                        const jsonData = JSON.stringify(dataToExport, null, 2);
                                        const blob = new Blob([jsonData], { type: 'application/json' });
                                        const url = URL.createObjectURL(blob);
                                        const link = document.createElement('a');
                                        link.href = url;
                                        link.download = `slainte-backup-${new Date().toISOString().split('T')[0]}.json`;
                                        link.click();
                                        URL.revokeObjectURL(url);
                                    }}
                                    className="w-full px-4 py-3 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2"
                                    style={{ backgroundColor: COLORS.incomeColor }}
                                >
                                    <Download className="h-4 w-4" />
                                    Download Backup
                                </button>
                                <p className="text-xs mt-3 text-center" style={{ color: COLORS.mediumGray }}>
                                    {transactions.length} transactions, {unidentifiedTransactions.length} unidentified, {paymentAnalysisData.length} PCRS records
                                </p>
                            </div>

                            {/* Restore */}
                            <div className="p-4 border-2 rounded-lg" style={{ borderColor: COLORS.slainteBlue, backgroundColor: `${COLORS.slainteBlue}10` }}>
                                <div className="flex items-center gap-2 mb-3">
                                    <Upload className="h-5 w-5" style={{ color: COLORS.slainteBlue }} />
                                    <h4 className="font-semibold" style={{ color: COLORS.slainteBlue }}>Restore from Backup</h4>
                                </div>
                                <p className="text-sm mb-4" style={{ color: COLORS.darkGray }}>
                                    Restore all data from a previous backup file. This will replace all current data.
                                </p>
                                <label
                                    className="w-full px-4 py-3 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 cursor-pointer"
                                    style={{ backgroundColor: COLORS.slainteBlue }}
                                >
                                    <Upload className="h-4 w-4" />
                                    Select Backup File
                                    <input
                                        type="file"
                                        accept=".json"
                                        onChange={(event) => {
                                            const file = event.target.files[0];
                                            if (!file) return;

                                            const reader = new FileReader();
                                            reader.onload = (e) => {
                                                try {
                                                    const data = JSON.parse(e.target.result);

                                                    // Validate backup file
                                                    if (!data.version || !data.exportDate) {
                                                        alert('Invalid backup file format. Please select a valid Slainte Finance backup file.');
                                                        return;
                                                    }

                                                    const backupDate = new Date(data.exportDate).toLocaleDateString();
                                                    const transCount = (data.transactions || []).length;
                                                    const unidentCount = (data.unidentifiedTransactions || []).length;
                                                    const pcrsCount = (data.paymentAnalysisData || []).length;

                                                    if (window.confirm(
                                                        `Restore backup from ${backupDate}?\n\n` +
                                                        `This backup contains:\n` +
                                                        `• ${transCount} categorised transactions\n` +
                                                        `• ${unidentCount} unidentified transactions\n` +
                                                        `• ${pcrsCount} PCRS payment records\n\n` +
                                                        `This will REPLACE all current data. Continue?`
                                                    )) {
                                                        // Restore all data
                                                        setTransactions(data.transactions || []);
                                                        setUnidentifiedTransactions(data.unidentifiedTransactions || []);
                                                        if (data.categoryMapping) setCategoryMapping(data.categoryMapping);
                                                        if (data.paymentAnalysisData) setPaymentAnalysisData(data.paymentAnalysisData);

                                                        // Restore localStorage items
                                                        if (data.practiceProfile) {
                                                            localStorage.setItem('slainte_practice_profile', data.practiceProfile);
                                                        }
                                                        if (data.savedReports) {
                                                            localStorage.setItem('gp_finance_saved_reports', JSON.stringify(data.savedReports));
                                                        }
                                                        if (data.aiCorrections) {
                                                            localStorage.setItem('slainte_ai_corrections', data.aiCorrections);
                                                        }
                                                        if (data.categoryPreferences) {
                                                            localStorage.setItem('gp_finance_category_preferences', data.categoryPreferences);
                                                        }

                                                        alert('Backup restored successfully! The page will now reload.');
                                                        window.location.reload();
                                                    }
                                                } catch (error) {
                                                    console.error('Restore error:', error);
                                                    alert('Error reading backup file. Please check the file is a valid JSON backup.');
                                                }
                                            };
                                            reader.readAsText(file);
                                            event.target.value = '';
                                        }}
                                        className="hidden"
                                    />
                                </label>
                                <p className="text-xs mt-3 text-center" style={{ color: COLORS.mediumGray }}>
                                    Accepts .json backup files
                                </p>
                            </div>
                        </div>

                        {/* Auto-Backup Section */}
                        {window.electronAPI?.isElectron && (
                            <div className="mt-6 p-4 border-2 rounded-lg" style={{ borderColor: '#8B5CF6', backgroundColor: '#F3E8FF' }}>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <Shield className="h-5 w-5" style={{ color: '#8B5CF6' }} />
                                        <h4 className="font-semibold" style={{ color: '#8B5CF6' }}>Encrypted Auto-Backup</h4>
                                    </div>
                                    {securityPasswordSet ? (
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <span className="text-sm" style={{ color: COLORS.darkGray }}>
                                                {autoBackupEnabled ? 'Enabled' : 'Disabled'}
                                            </span>
                                            <div
                                                onClick={async () => {
                                                    const newValue = !autoBackupEnabled;
                                                    setAutoBackupEnabled(newValue);
                                                    if (window.electronAPI?.setAutoBackupSettings) {
                                                        await window.electronAPI.setAutoBackupSettings({ enabled: newValue });
                                                    }
                                                }}
                                                className="relative w-12 h-6 rounded-full transition-colors cursor-pointer"
                                                style={{ backgroundColor: autoBackupEnabled ? '#8B5CF6' : COLORS.lightGray }}
                                            >
                                                <div
                                                    className="absolute top-1 w-4 h-4 rounded-full bg-white transition-transform"
                                                    style={{ left: autoBackupEnabled ? '28px' : '4px' }}
                                                />
                                            </div>
                                        </label>
                                    ) : (
                                        <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: COLORS.highlightYellow, color: '#92400E' }}>
                                            Set Security Password First
                                        </span>
                                    )}
                                </div>

                                <p className="text-sm mb-4" style={{ color: COLORS.darkGray }}>
                                    When enabled, your data is automatically encrypted and backed up every time you close the app.
                                    Backups use your App Security Password for encryption (AES-256).
                                </p>

                                {lastBackupDate && (
                                    <div className="flex items-center gap-2 mb-4 text-sm" style={{ color: COLORS.mediumGray }}>
                                        <Clock className="h-4 w-4" />
                                        <span>Last backup: {new Date(lastBackupDate).toLocaleString()}</span>
                                    </div>
                                )}

                                <div className="flex flex-wrap gap-3">
                                    {securityPasswordSet && (
                                        <button
                                            onClick={async () => {
                                                setIsCreatingBackup(true);
                                                try {
                                                    const result = await window.electronAPI.createBackup();
                                                    if (result.success) {
                                                        setLastBackupDate(result.timestamp);
                                                        const backups = await window.electronAPI.listBackups();
                                                        setBackupList(backups || []);
                                                        alert(`Encrypted backup created successfully!\n\nFile: ${result.filename}`);
                                                    } else {
                                                        alert('Backup failed: ' + result.error);
                                                    }
                                                } catch (error) {
                                                    alert('Backup failed: ' + error.message);
                                                } finally {
                                                    setIsCreatingBackup(false);
                                                }
                                            }}
                                            disabled={isCreatingBackup}
                                            className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2"
                                            style={{ backgroundColor: '#8B5CF6', opacity: isCreatingBackup ? 0.7 : 1 }}
                                        >
                                            {isCreatingBackup ? (
                                                <>
                                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                                    Creating...
                                                </>
                                            ) : (
                                                <>
                                                    <Download className="h-4 w-4" />
                                                    Create Backup Now
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>

                                {backupList.length > 0 && (
                                    <div className="mt-4 pt-4 border-t" style={{ borderColor: '#D8B4FE' }}>
                                        <p className="text-xs font-semibold mb-2" style={{ color: '#8B5CF6' }}>
                                            Recent Encrypted Backups ({backupList.length})
                                        </p>
                                        <div className="space-y-1 max-h-32 overflow-y-auto">
                                            {backupList.slice(0, 5).map((backup, index) => (
                                                <div key={index} className="flex items-center justify-between text-xs p-2 rounded" style={{ backgroundColor: 'white' }}>
                                                    <span style={{ color: COLORS.darkGray }}>
                                                        {new Date(backup.created).toLocaleString()}
                                                    </span>
                                                    <span style={{ color: COLORS.mediumGray }}>
                                                        {(backup.size / 1024).toFixed(1)} KB
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {!securityPasswordSet && (
                                    <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: '#FEF3C7' }}>
                                        <p className="text-xs" style={{ color: '#92400E' }}>
                                            <strong>Setup Required:</strong> To enable encrypted auto-backups, you need to set up an App Security Password during the initial setup process, or restart onboarding from Data Management below.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Warning note */}
                        <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: '#FEF3C7' }}>
                            <p className="text-xs" style={{ color: '#92400E' }}>
                                <strong>Tip:</strong> {window.electronAPI?.isElectron
                                    ? 'Encrypted backups are stored securely in your app data folder and require your App Security Password to restore.'
                                    : 'Create a backup before major app updates or when you\'ve made significant progress categorising transactions. Backups are saved to your Downloads folder.'}
                            </p>
                        </div>
                    </>
                )}
            </div>

            {/* PCRS Statement Download Section - Desktop Only */}
            {window.electronAPI?.isElectron && (
                <div className="bg-white p-6 rounded-lg border">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold flex items-center">
                            <Activity className="h-5 w-5 mr-2" style={{ color: COLORS.slainteBlue }} />
                            PCRS Statement Downloads
                        </h3>
                        {pcrsSessionStatus?.valid && (
                            <span className="text-sm px-2 py-1 rounded flex items-center gap-1" style={{ backgroundColor: `${COLORS.incomeColor}20`, color: COLORS.incomeColor }}>
                                <CheckCircle className="h-3 w-3" />
                                Session Active
                            </span>
                        )}
                    </div>

                    <p className="text-sm mb-4" style={{ color: COLORS.mediumGray }}>
                        Automatically download your PCRS payment statements directly from the portal.
                        Your login credentials are never stored - you authenticate via the secure PCRS website.
                    </p>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setShowPCRSDownloader(true)}
                            className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2"
                            style={{ backgroundColor: COLORS.slainteBlue }}
                        >
                            <Download className="h-4 w-4" />
                            Download Statements
                        </button>

                        {pcrsSessionStatus?.valid && (
                            <div className="text-sm" style={{ color: COLORS.mediumGray }}>
                                <Clock className="h-4 w-4 inline mr-1" />
                                Session expires in {pcrsSessionStatus.remainingHours} hours
                            </div>
                        )}
                    </div>

                    {pcrsSessionStatus?.exists && !pcrsSessionStatus?.valid && (
                        <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: '#FEF3C7' }}>
                            <p className="text-xs" style={{ color: '#92400E' }}>
                                <AlertCircle className="h-3 w-3 inline mr-1" />
                                Your previous session has expired. Click "Download Statements" to log in again.
                            </p>
                        </div>
                    )}

                    {!pcrsSessionStatus?.exists && (
                        <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: COLORS.backgroundGray }}>
                            <p className="text-xs" style={{ color: COLORS.mediumGray }}>
                                <Shield className="h-3 w-3 inline mr-1" />
                                First time setup: You'll be prompted to log in to the PCRS portal. Your session will be
                                remembered for 24 hours so you don't need to log in each time.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* PCRS Downloader Modal */}
            <PCRSDownloader
                isOpen={showPCRSDownloader}
                onClose={() => setShowPCRSDownloader(false)}
                onStatementsDownloaded={(downloads) => {
                    console.log('PCRS statements downloaded:', downloads);
                    // Could trigger auto-processing of PDFs here if needed
                }}
            />

            {/* Practice Profile Viewer Section */}
            <div id="practice-profile-section" className="bg-white p-6 rounded-lg border">
                <button
                    onClick={() => setShowPracticeProfileViewer(!showPracticeProfileViewer)}
                    className="w-full flex items-center justify-between mb-4 hover:opacity-70 transition-opacity"
                >
                    <h3 className="text-lg font-semibold flex items-center">
                        <Building2 className="h-5 w-5 mr-2" style={{ color: COLORS.slainteBlue }} />
                        Practice Profile
                    </h3>
                    <div className="flex items-center gap-2">
                        {profile?.practiceDetails?.practiceName && (
                            <span className="text-sm px-2 py-1 rounded" style={{ backgroundColor: `${COLORS.incomeColor}20`, color: COLORS.incomeColor }}>
                                {profile.practiceDetails.practiceName}
                            </span>
                        )}
                        <ChevronDown
                            className={`h-5 w-5 transition-transform ${showPracticeProfileViewer ? 'transform rotate-180' : ''}`}
                            style={{ color: COLORS.slainteBlue }}
                        />
                    </div>
                </button>

                {showPracticeProfileViewer && (
                    <div className="space-y-4">
                        {/* Practice Details */}
                        <div className="p-4 rounded-lg" style={{ backgroundColor: COLORS.backgroundGray }}>
                            <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ color: COLORS.darkGray }}>
                                <Building2 className="h-4 w-4" />
                                Practice Details
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <span className="text-sm" style={{ color: COLORS.mediumGray }}>Practice Name:</span>
                                    <p className="font-medium" style={{ color: COLORS.darkGray }}>
                                        {profile?.practiceDetails?.practiceName || <em className="text-gray-400">Not set</em>}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-sm" style={{ color: COLORS.mediumGray }}>Location:</span>
                                    <p className="font-medium" style={{ color: COLORS.darkGray }}>
                                        {(() => {
                                            // Check for locations array (from Cara) or location string (legacy)
                                            if (profile?.practiceDetails?.locations?.length > 0) {
                                                return profile.practiceDetails.locations.join(', ');
                                            }
                                            return profile?.practiceDetails?.location || <em className="text-gray-400">Not set</em>;
                                        })()}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-sm" style={{ color: COLORS.mediumGray }}>Number of GPs:</span>
                                    <p className="font-medium" style={{ color: COLORS.darkGray }}>
                                        {(() => {
                                            const partners = profile?.gps?.partners?.length || 0;
                                            const salaried = profile?.gps?.salaried?.length || 0;
                                            const total = partners + salaried;
                                            if (total > 0) {
                                                return `${total} (${partners} partner${partners !== 1 ? 's' : ''}, ${salaried} salaried)`;
                                            }
                                            return profile?.practiceDetails?.numberOfGPs ?? <em className="text-gray-400">Not set</em>;
                                        })()}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-sm" style={{ color: COLORS.mediumGray }}>Practice Type:</span>
                                    <p className="font-medium" style={{ color: COLORS.darkGray }}>
                                        {(() => {
                                            const partners = profile?.gps?.partners?.length || 0;
                                            if (partners > 1) return 'Partnership';
                                            if (partners === 1) return 'Single-Handed';
                                            return profile?.practiceDetails?.practiceType || <em className="text-gray-400">Not set</em>;
                                        })()}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* GP Partners */}
                        {profile?.gps?.partners && profile.gps.partners.length > 0 && (
                            <div className="p-4 rounded-lg" style={{ backgroundColor: COLORS.backgroundGray }}>
                                <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ color: COLORS.darkGray }}>
                                    <UserCog className="h-4 w-4" />
                                    GP Partners ({profile.gps.partners.length})
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {profile.gps.partners.map((partner, idx) => (
                                        <div key={idx} className="p-2 rounded bg-white border" style={{ borderColor: COLORS.lightGray }}>
                                            <p className="font-medium" style={{ color: COLORS.darkGray }}>{partner.name || `Partner ${idx + 1}`}</p>
                                            {partner.profitShare && <p className="text-xs" style={{ color: COLORS.mediumGray }}>{partner.profitShare}% profit share</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Salaried GPs */}
                        {profile?.gps?.salaried && profile.gps.salaried.length > 0 && (
                            <div className="p-4 rounded-lg" style={{ backgroundColor: COLORS.backgroundGray }}>
                                <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ color: COLORS.darkGray }}>
                                    <UserCog className="h-4 w-4" />
                                    Salaried GPs ({profile.gps.salaried.length})
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {profile.gps.salaried.map((gp, idx) => (
                                        <div key={idx} className="p-2 rounded bg-white border" style={{ borderColor: COLORS.lightGray }}>
                                            <p className="font-medium" style={{ color: COLORS.darkGray }}>{gp.name || `Salaried GP ${idx + 1}`}</p>
                                            <p className="text-xs" style={{ color: COLORS.mediumGray }}>Salaried GP</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Staff Members */}
                        {profile?.staff && profile.staff.length > 0 && (
                            <div className="p-4 rounded-lg" style={{ backgroundColor: COLORS.backgroundGray }}>
                                <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ color: COLORS.darkGray }}>
                                    <UserCog className="h-4 w-4" />
                                    Staff Members ({profile.staff.length})
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {profile.staff.map((staff, idx) => (
                                        <div key={idx} className="p-2 rounded bg-white border" style={{ borderColor: COLORS.lightGray }}>
                                            <p className="font-medium" style={{ color: COLORS.darkGray }}>{staff.name || `Staff ${idx + 1}`}</p>
                                            {staff.role && (
                                                <p className="text-xs capitalize" style={{ color: COLORS.mediumGray }}>
                                                    {staff.role.replace(/_/g, ' ')}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* GMS Contract Info */}
                        {(profile?.gmsContract?.panelSize || profile?.gmsContract?.gmsIncomePercentage) && (
                            <div className="p-4 rounded-lg" style={{ backgroundColor: COLORS.backgroundGray }}>
                                <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ color: COLORS.darkGray }}>
                                    <Activity className="h-4 w-4" />
                                    GMS Contract
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {profile.gmsContract.panelSize && (
                                        <div>
                                            <span className="text-sm" style={{ color: COLORS.mediumGray }}>Panel Size:</span>
                                            <p className="font-medium" style={{ color: COLORS.darkGray }}>{profile.gmsContract.panelSize.toLocaleString()} patients</p>
                                        </div>
                                    )}
                                    {profile.gmsContract.averageCapitationRate && (
                                        <div>
                                            <span className="text-sm" style={{ color: COLORS.mediumGray }}>Avg Capitation Rate:</span>
                                            <p className="font-medium" style={{ color: COLORS.darkGray }}>€{profile.gmsContract.averageCapitationRate}/patient/year</p>
                                        </div>
                                    )}
                                    {profile.gmsContract.gmsIncomePercentage && (
                                        <div>
                                            <span className="text-sm" style={{ color: COLORS.mediumGray }}>GMS % of Income:</span>
                                            <p className="font-medium" style={{ color: COLORS.darkGray }}>{profile.gmsContract.gmsIncomePercentage}%</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Metadata */}
                        <div className="p-4 rounded-lg border-2 border-dashed" style={{ borderColor: COLORS.lightGray }}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm" style={{ color: COLORS.mediumGray }}>
                                        Setup Status: {' '}
                                        <span className={`font-medium ${profile?.metadata?.setupComplete ? 'text-green-600' : 'text-yellow-600'}`}>
                                            {profile?.metadata?.setupComplete ? '✓ Complete' : '⏳ In Progress'}
                                        </span>
                                    </p>
                                    {profile?.metadata?.lastUpdated && (
                                        <p className="text-xs mt-1" style={{ color: COLORS.mediumGray }}>
                                            Last updated: {new Date(profile.metadata.lastUpdated).toLocaleDateString('en-IE', {
                                                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={() => setShowOnboardingEdit(true)}
                                    className="px-3 py-1.5 rounded text-sm font-medium"
                                    style={{ backgroundColor: COLORS.slainteBlue, color: COLORS.white }}
                                >
                                    Edit Profile
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Data Management Section */}
            <div className="bg-white p-6 rounded-lg border" data-tour-id="admin-data-management">
                <button
                    onClick={() => setShowDataManagement(!showDataManagement)}
                    className="w-full flex items-center justify-between mb-4 hover:opacity-70 transition-opacity"
                >
                    <h3 className="text-lg font-semibold flex items-center">
                        <Settings className="h-5 w-5 mr-2" style={{ color: COLORS.slainteBlue }} />
                        Data Management
                    </h3>
                    <ChevronDown
                        className={`h-5 w-5 transition-transform ${showDataManagement ? 'transform rotate-180' : ''}`}
                        style={{ color: COLORS.slainteBlue }}
                    />
                </button>

                {showDataManagement && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Take App Tour */}
                    <div className="p-4 border-2 rounded-lg" style={{ borderColor: COLORS.slainteBlue, backgroundColor: `${COLORS.slainteBlue}10` }}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 rounded-lg" style={{ backgroundColor: COLORS.white }}>
                                <Play className="h-5 w-5" style={{ color: COLORS.slainteBlue }} />
                            </div>
                            <h4 className="font-semibold" style={{ color: COLORS.slainteBlue }}>App Tour</h4>
                        </div>
                        <p className="text-sm mb-4" style={{ color: COLORS.darkGray }}>
                            Take a guided tour through the key features of Sláinte Finance. Perfect for new users or a quick refresher.
                        </p>
                        {getTourCompletionDate() && (
                            <p className="text-xs mb-3" style={{ color: COLORS.mediumGray }}>
                                Last completed: {getTourCompletionDate().toLocaleDateString()}
                            </p>
                        )}
                        <button
                            onClick={startTour}
                            className="w-full px-4 py-2 rounded font-medium text-white flex items-center justify-center gap-2"
                            style={{ backgroundColor: COLORS.slainteBlue }}
                        >
                            <Play className="h-4 w-4" />
                            Start Tour
                        </button>
                    </div>

                    {/* Download User Guide */}
                    <div className="p-4 border-2 rounded-lg" style={{ borderColor: COLORS.incomeColor, backgroundColor: `${COLORS.incomeColor}10` }}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 rounded-lg" style={{ backgroundColor: COLORS.white }}>
                                <BookOpen className="h-5 w-5" style={{ color: COLORS.incomeColor }} />
                            </div>
                            <h4 className="font-semibold" style={{ color: COLORS.incomeColor }}>User Guide</h4>
                        </div>
                        <p className="text-sm mb-4" style={{ color: COLORS.darkGray }}>
                            View or print a comprehensive guide to all features in Sláinte Finance. Perfect for training or reference.
                        </p>
                        <button
                            onClick={() => setShowPrintableGuide(true)}
                            className="w-full px-4 py-2 rounded font-medium text-white flex items-center justify-center gap-2"
                            style={{ backgroundColor: COLORS.incomeColor }}
                        >
                            <BookOpen className="h-4 w-4" />
                            Open User Guide
                        </button>
                    </div>

                    {/* Restart from Scratch */}
                    <div className="p-4 border-2 rounded-lg" style={{ borderColor: COLORS.highlightYellow, backgroundColor: `${COLORS.highlightYellow}10` }}>
                        <h4 className="font-semibold mb-2" style={{ color: COLORS.darkGray }}>🔄 Start Fresh</h4>
                        <p className="text-sm mb-4" style={{ color: COLORS.darkGray }}>
                            Clear all personalized categories and restart the onboarding wizard from scratch. This will not delete transaction data.
                        </p>
                        <button
                            onClick={() => {
                                if (window.confirm('This will remove all personalized categories and restart onboarding. Transaction data will NOT be deleted. Continue?')) {
                                    // Remove the new unified practice profile
                                    localStorage.removeItem('slainte_practice_profile');
                                    // Remove old keys for backward compatibility
                                    localStorage.removeItem('slainte_onboarding_complete');
                                    window.location.reload();
                                }
                            }}
                            className="px-4 py-2 rounded font-medium"
                            style={{ backgroundColor: COLORS.highlightYellow, color: COLORS.darkGray }}
                        >
                            Restart Onboarding
                        </button>
                    </div>

                    {/* AI Staff Suggestions */}
                    {unidentifiedTransactions.length > 0 && (
                        <div className="p-4 border-2 rounded-lg" style={{ borderColor: COLORS.slainteBlue, backgroundColor: '#DBEAFE' }}>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 rounded-lg" style={{ backgroundColor: COLORS.white }}>
                                    <Brain className="h-5 w-5" style={{ color: COLORS.slainteBlue }} />
                                </div>
                                <h4 className="font-semibold" style={{ color: COLORS.slainteBlue }}>AI Staff Suggestions</h4>
                            </div>
                            <p className="text-sm mb-4" style={{ color: COLORS.darkGray }}>
                                Automatically identify and categorize staff-related payments. Best for detecting salaries, wages, and regular staff expenses.
                            </p>
                            <button
                                onClick={() => setShowAISuggestions(true)}
                                className="w-full px-4 py-2 rounded font-medium text-white flex items-center justify-center gap-2"
                                style={{ backgroundColor: COLORS.slainteBlue }}
                            >
                                <Brain className="h-4 w-4" />
                                Analyze Staff Payments
                            </button>
                        </div>
                    )}

                    {/* AI Expense Patterns */}
                    {unidentifiedTransactions.length > 0 && (
                        <div className="p-4 border-2 rounded-lg" style={{ borderColor: COLORS.highlightYellow, backgroundColor: '#FEF3C7' }}>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 rounded-lg" style={{ backgroundColor: COLORS.white }}>
                                    <Activity className="h-5 w-5" style={{ color: COLORS.highlightYellow }} />
                                </div>
                                <h4 className="font-semibold" style={{ color: COLORS.darkGray }}>AI Expense Patterns</h4>
                            </div>
                            <p className="text-sm mb-4" style={{ color: COLORS.darkGray }}>
                                Identify common expense patterns and suggest appropriate categories. Helps with utilities, supplies, and recurring expenses.
                            </p>
                            <button
                                onClick={() => setShowExpenseCategorization(true)}
                                className="w-full px-4 py-2 rounded font-medium flex items-center justify-center gap-2"
                                style={{
                                    color: COLORS.slainteBlue,
                                    backgroundColor: 'transparent',
                                    border: `2px solid ${COLORS.slainteBlue}`
                                }}
                            >
                                <Activity className="h-4 w-4" />
                                Analyze Expense Patterns
                            </button>
                        </div>
                    )}

                    {/* Re-apply Categories */}
                    <div className="p-4 border-2 rounded-lg" style={{ borderColor: '#8B5CF6', backgroundColor: '#F3E8FF' }}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 rounded-lg" style={{ backgroundColor: COLORS.white }}>
                                <RefreshCw className="h-5 w-5" style={{ color: '#8B5CF6' }} />
                            </div>
                            <h4 className="font-semibold" style={{ color: '#8B5CF6' }}>Re-apply Categories</h4>
                        </div>
                        <p className="text-sm mb-4" style={{ color: COLORS.darkGray }}>
                            Re-categorize all transactions based on current identifier mappings. Use this after moving identifiers between subcategories.
                        </p>
                        {recategorizeResult && (
                            <div className="mb-3 p-2 rounded text-sm" style={{ backgroundColor: COLORS.white }}>
                                <CheckCircle className="h-4 w-4 inline mr-1" style={{ color: COLORS.incomeColor }} />
                                {recategorizeResult.updated > 0
                                    ? `Updated ${recategorizeResult.updated} transaction${recategorizeResult.updated !== 1 ? 's' : ''}`
                                    : 'All transactions are correctly categorized'}
                            </div>
                        )}
                        <button
                            onClick={() => {
                                setIsRecategorizing(true);
                                setRecategorizeResult(null);
                                setTimeout(() => {
                                    const result = reapplyCategories();
                                    setRecategorizeResult(result);
                                    setIsRecategorizing(false);
                                }, 100);
                            }}
                            disabled={isRecategorizing}
                            className="w-full px-4 py-2 rounded font-medium text-white flex items-center justify-center gap-2"
                            style={{ backgroundColor: '#8B5CF6', opacity: isRecategorizing ? 0.7 : 1 }}
                        >
                            <RefreshCw className={`h-4 w-4 ${isRecategorizing ? 'animate-spin' : ''}`} />
                            {isRecategorizing ? 'Re-applying...' : 'Re-apply Categories'}
                        </button>
                    </div>

                    {/* Danger Zone */}
                    <div className="p-4 border-2 rounded-lg md:col-span-2" style={{ borderColor: COLORS.expenseColor, backgroundColor: `${COLORS.expenseColor}10` }}>
                        <h4 className="font-semibold mb-2" style={{ color: COLORS.expenseColor }}>⚠️ Danger Zone</h4>
                        <p className="text-sm mb-4" style={{ color: COLORS.darkGray }}>
                            <strong>Warning:</strong> This will permanently delete ALL data including transactions, categories, and settings. This cannot be undone.
                        </p>
                        <ClearAllDataButton onClear={clearAllData} />
                    </div>
                </div>
                )}
            </div>

            {/* App Updates Section */}
            <div className="bg-white p-6 rounded-lg border">
                <button
                    onClick={() => setShowAppUpdates(!showAppUpdates)}
                    className="w-full flex items-center justify-between mb-4 hover:opacity-70 transition-opacity"
                >
                    <h3 className="text-lg font-semibold flex items-center">
                        <Download className="h-5 w-5 mr-2" style={{ color: COLORS.slainteBlue }} />
                        App Updates
                    </h3>
                    <ChevronDown
                        className={`h-5 w-5 transition-transform ${showAppUpdates ? 'transform rotate-180' : ''}`}
                        style={{ color: COLORS.slainteBlue }}
                    />
                </button>

                {showAppUpdates && (
                    <div className="space-y-4">
                        {/* Current Version */}
                        <div className="p-4 border rounded-lg" style={{ backgroundColor: COLORS.backgroundGray }}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm" style={{ color: COLORS.mediumGray }}>Current Version</p>
                                    <p className="text-xl font-semibold" style={{ color: COLORS.darkGray }}>
                                        {appVersion || 'Loading...'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm" style={{ color: COLORS.mediumGray }}>Status</p>
                                    <p className="font-medium" style={{
                                        color: updateStatus === 'ready' ? COLORS.incomeColor :
                                               updateStatus === 'available' ? COLORS.highlightYellow :
                                               updateStatus === 'error' ? COLORS.expenseColor :
                                               COLORS.darkGray
                                    }}>
                                        {updateStatus === 'idle' && 'Up to date'}
                                        {updateStatus === 'checking' && 'Checking...'}
                                        {updateStatus === 'available' && `v${updateInfo?.version} available`}
                                        {updateStatus === 'downloading' && `Downloading... ${downloadProgress.toFixed(0)}%`}
                                        {updateStatus === 'ready' && 'Ready to install'}
                                        {updateStatus === 'error' && 'Update check failed'}
                                    </p>
                                </div>
                            </div>

                            {/* Download Progress Bar */}
                            {updateStatus === 'downloading' && (
                                <div className="mt-3">
                                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full transition-all duration-300"
                                            style={{
                                                width: `${downloadProgress}%`,
                                                backgroundColor: COLORS.slainteBlue
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Update Actions */}
                        <div className="flex gap-3">
                            {(updateStatus === 'idle' || updateStatus === 'error') && (
                                <button
                                    onClick={handleCheckForUpdates}
                                    disabled={updateStatus === 'checking'}
                                    className="flex-1 px-4 py-2 rounded font-medium text-white flex items-center justify-center gap-2"
                                    style={{ backgroundColor: COLORS.slainteBlue }}
                                >
                                    <Download className="h-4 w-4" />
                                    Check for Updates
                                </button>
                            )}

                            {updateStatus === 'checking' && (
                                <button
                                    disabled
                                    className="flex-1 px-4 py-2 rounded font-medium text-white flex items-center justify-center gap-2 opacity-70"
                                    style={{ backgroundColor: COLORS.slainteBlue }}
                                >
                                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                    Checking...
                                </button>
                            )}

                            {updateStatus === 'ready' && (
                                <button
                                    onClick={handleInstallUpdate}
                                    className="flex-1 px-4 py-2 rounded font-medium text-white flex items-center justify-center gap-2"
                                    style={{ backgroundColor: COLORS.incomeColor }}
                                >
                                    <CheckCircle className="h-4 w-4" />
                                    Restart & Install Update
                                </button>
                            )}
                        </div>

                        {/* Update Note */}
                        <p className="text-xs" style={{ color: COLORS.mediumGray }}>
                            Updates are downloaded automatically when available. Your data is preserved during updates.
                        </p>
                    </div>
                )}
            </div>

            {/* AI Tools Modals */}
            {showAISuggestions && (
                <AIIdentifierSuggestions onClose={() => setShowAISuggestions(false)} />
            )}
            {showExpenseCategorization && (
                <AIExpenseCategorization onClose={() => setShowExpenseCategorization(false)} />
            )}

            {/* Category Refinement Wizard */}
            <CategoryRefinementWizard
                isOpen={showRefinementWizard}
                onClose={() => setShowRefinementWizard(false)}
            />

            {/* Printable User Guide Modal */}
            {showPrintableGuide && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        zIndex: 9999,
                        overflow: 'auto',
                    }}
                >
                    <PrintableGuide onClose={() => setShowPrintableGuide(false)} />
                </div>
            )}
        </div>
    );
}
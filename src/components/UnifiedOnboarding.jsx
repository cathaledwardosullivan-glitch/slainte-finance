import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { usePracticeProfile } from '../hooks/usePracticeProfile';
import { createUnifiedProfile } from '../data/practiceProfileSchemaV2';
import { generateCategoriesFromProfile } from '../utils/categoryGenerator';
import * as storage from '../storage/practiceProfileStorage';
import { CURRENT_VERSION as TERMS_VERSION } from '../data/termsAndConditions';
import { saveTransactions, saveCategoryMapping, saveUnidentifiedTransactions } from '../utils/storageUtils';
import { analyzeWebsite } from '../utils/websiteAnalyzer';
import { processTransactionsWithEngine } from '../utils/transactionProcessor';
import { batchAICategorization } from '../utils/aiCategorization';
import { COHORTS } from './ProcessingFlow/ProcessingFlowContext';
import COLORS from '../utils/colors';
import { DEMO_PROFILE, generateDemoTransactions, generateDemoGMSPanelData, DEMO_CATEGORY_MAPPING, generateDemoChatData, generateDemoSavedReport, generateDemoTasks } from '../data/demoData';

// Step components
import TermsAndConditions from './Onboarding/TermsAndConditions';
import APIKeySetup from './Onboarding/APIKeySetup';
import PathSelection from './Onboarding/PathSelection';
import WebsiteAnalysis from './Onboarding/WebsiteAnalysis';
import StaffProfileForm from './Onboarding/StaffProfileForm';
import OnboardingBankUpload from './Onboarding/OnboardingBankUpload';
import OnboardingInboxUpload from './Onboarding/OnboardingInboxUpload';
import OnboardingTransactionUpload from './Onboarding/OnboardingTransactionUpload';
import GMSPanelUploadPrompt from './Onboarding/GMSPanelUploadPrompt';
import QuickConnectSetup from './Onboarding/QuickConnectSetup';


const STEPS = {
  TERMS: -1,
  API_KEY: 0,
  PRIVACY_CHOICE: 0.5,
  PATH_SELECTION: 1,
  QUICK_CONNECT: 1.5,       // Connect to another practice computer on LAN
  WEBSITE_URL: 2,            // Enter URL only (non-blocking)
  BANK_UPLOAD: 3,            // Single 1-month bank statement → parse only
  PRACTICE_PROFILE: 4,       // Staff profile form (pre-populated from website)
  GMS_PANEL: 5,              // GMS panel upload (synchronous)
  TRANSACTION_PROCESSING: 6, // Review pre-categorized transactions
  COMPLETE: 7
};

// Steps used for progress bar calculation (excluding TERMS, API_KEY, PATH_SELECTION)
const PROGRESS_STEPS = [
  STEPS.WEBSITE_URL,
  STEPS.BANK_UPLOAD,
  STEPS.PRACTICE_PROFILE,
  STEPS.GMS_PANEL,
  STEPS.TRANSACTION_PROCESSING,
  STEPS.COMPLETE
];

export default function UnifiedOnboarding({ onComplete, onSkip }) {
  const { transactions, categoryMapping, setCategoryMapping, uploadTransactions, setTransactions, setPaymentAnalysisData, setUnidentifiedTransactions, setSelectedYear } = useAppContext();
  const { updateProfile, completeSetup, setupComplete } = usePracticeProfile();

  const [currentStep, setCurrentStep] = useState(null); // Start as null until we check API key
  const [apiKey, setApiKey] = useState('');
  const [profile, setProfile] = useState(createUnifiedProfile());
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isCheckingApiKey, setIsCheckingApiKey] = useState(true);

  // Background website analysis state
  const [websiteAnalysisResult, setWebsiteAnalysisResult] = useState(null);
  const [websiteAnalysisError, setWebsiteAnalysisError] = useState(null);
  const [isWebsiteAnalyzing, setIsWebsiteAnalyzing] = useState(false);

  // Raw parsed transactions (from bank upload, before categorization)
  const [rawParsedTransactions, setRawParsedTransactions] = useState([]);

  // Background transaction categorization
  const [categorizationResult, setCategorizationResult] = useState(null);
  const [isCategorizationRunning, setIsCategorizationRunning] = useState(false);

  // Check for terms acceptance and existing API key on mount
  useEffect(() => {
    const checkTermsAndApiKey = async () => {
      setIsCheckingApiKey(true);

      // First, check if terms have been accepted
      const termsAccepted = storage.hasAcceptedTerms(TERMS_VERSION);
      console.log('[UnifiedOnboarding] Terms accepted:', termsAccepted, 'Required version:', TERMS_VERSION);

      if (!termsAccepted) {
        setCurrentStep(STEPS.TERMS);
        setIsCheckingApiKey(false);
        return;
      }

      // Terms accepted, now check for API key
      let savedApiKey = null;

      if (window.electronAPI?.isElectron) {
        savedApiKey = await window.electronAPI.getLocalStorage('claude_api_key');
      }

      if (!savedApiKey) {
        savedApiKey = localStorage.getItem('anthropic_api_key');
      }

      if (savedApiKey) {
        setApiKey(savedApiKey);
        setCurrentStep(STEPS.PATH_SELECTION);
      } else {
        setCurrentStep(STEPS.API_KEY);
      }
      setIsCheckingApiKey(false);
    };

    checkTermsAndApiKey();
  }, []);

  // ─── Terms & API Key Handlers ───

  const handleTermsAccept = (termsData) => {
    storage.acceptTerms(termsData);
    setCurrentStep(STEPS.API_KEY);
  };

  const clearDemoData = () => {
    console.log('[UnifiedOnboarding] Clearing demo data before proper setup');
    localStorage.removeItem('gp_finance_transactions');
    localStorage.removeItem('gp_finance_unidentified');
    localStorage.removeItem('gp_finance_category_mapping');
    localStorage.removeItem('gp_finance_payment_analysis');
    localStorage.removeItem('gp_finance_saved_reports');
    localStorage.removeItem('ciaran_chats');
    localStorage.removeItem('ciaran_current_chat_id');
    setTransactions([]);
    setUnidentifiedTransactions([]);
    setCategoryMapping([]);
    setPaymentAnalysisData([]);
    setProfile(createUnifiedProfile());
    setIsDemoMode(false);
  };

  const handleAPIKeyComplete = (key) => {
    setApiKey(key);
    clearDemoData();
    setCurrentStep(STEPS.PRIVACY_CHOICE);
  };

  // ─── Privacy Choice Handler ───

  const handlePrivacyChoice = (enableAI) => {
    if (!enableAI) {
      storage.setLocalOnlyMode(true);
      // Local Only: skip website analysis, go straight to bank upload
      setCurrentStep(STEPS.BANK_UPLOAD);
    } else {
      storage.setLocalOnlyMode(false);
      setCurrentStep(STEPS.WEBSITE_URL);
    }
  };

  // ─── Path Selection Handlers ───

  const handlePathQuickConnect = () => {
    setCurrentStep(STEPS.QUICK_CONNECT);
  };

  const handleQuickConnectComplete = ({ practiceName }) => {
    console.log('[UnifiedOnboarding] Quick connect complete, pulled data from:', practiceName);
    // The pulled profile includes setupComplete: true, so completeSetup is handled.
    // Reload to pick up the pulled practice profile and all data cleanly.
    if (completeSetup) completeSetup();
    alert(`Connected to ${practiceName}! The app will now reload with your practice data.`);
    window.location.reload();
  };

  const handlePathSetup = () => {
    clearDemoData();
    setCurrentStep(STEPS.WEBSITE_URL);
  };

  const handlePathDemo = () => {
    // Guard: demo mode wipes and seeds fake data. Blocking it once setup is
    // complete prevents an already-onboarded user from silently replacing
    // their real ledger (previously caused a data-corruption incident).
    if (setupComplete) {
      console.warn('[UnifiedOnboarding] handlePathDemo blocked — setup already complete. Use Settings → Clear All Data first if demo mode is genuinely intended.');
      alert('Demo mode is only available during initial onboarding. Your practice is already set up; demo mode would overwrite your real data.');
      return;
    }

    setIsDemoMode(true);

    const { transactions: demoTransactions, unidentified: demoUnidentified } = generateDemoTransactions();
    const demoGMSData = generateDemoGMSPanelData();
    const demoChatData = generateDemoChatData();
    const demoReports = generateDemoSavedReport();
    const demoTasks = generateDemoTasks();

    const profileWithTasks = {
      ...DEMO_PROFILE,
      actionPlan: { actions: demoTasks.actionItems, lastUpdated: new Date().toISOString() },
      financialActionPlan: { tasks: demoTasks.financialTasks, lastUpdated: new Date().toISOString() }
    };

    saveTransactions(demoTransactions);
    saveUnidentifiedTransactions(demoUnidentified);
    saveCategoryMapping(DEMO_CATEGORY_MAPPING);
    localStorage.setItem('gp_finance_payment_analysis', JSON.stringify(demoGMSData));
    localStorage.setItem('gp_finance_saved_reports', JSON.stringify(demoReports));
    localStorage.setItem('ciaran_chats', JSON.stringify(demoChatData.chats));
    localStorage.setItem('ciaran_current_chat_id', demoChatData.currentChatId);
    storage.save(profileWithTasks);
    completeSetup();

    setProfile(profileWithTasks);
    setCategoryMapping(DEMO_CATEGORY_MAPPING);
    setTransactions(demoTransactions);
    setUnidentifiedTransactions(demoUnidentified);
    setPaymentAnalysisData(demoGMSData);
    setSelectedYear(new Date().getFullYear() - 1);

    handleFinalComplete();
  };

  // ─── Website URL Handler (non-blocking) ───

  const handleWebsiteComplete = (data) => {
    if (data?.url) {
      console.log('[UnifiedOnboarding] Starting background website analysis for:', data.url);
      setIsWebsiteAnalyzing(true);

      analyzeWebsite(data.url, apiKey)
        .then(result => {
          console.log('[UnifiedOnboarding] Background website analysis complete:', result.success);
          setWebsiteAnalysisResult(result);
          setIsWebsiteAnalyzing(false);
        })
        .catch(err => {
          console.error('[UnifiedOnboarding] Background website analysis failed:', err);
          setWebsiteAnalysisError(err.message);
          setIsWebsiteAnalyzing(false);
        });
    }

    setCurrentStep(STEPS.BANK_UPLOAD);
  };

  const handleWebsiteSkip = () => {
    setCurrentStep(STEPS.BANK_UPLOAD);
  };

  // ─── Bank Upload Handler (parse only, no categorization) ───

  const handleBankUploadComplete = (result) => {
    console.log(`[UnifiedOnboarding] Bank statement parsed: ${result.transactions.length} transactions (${result.bank})`);
    setRawParsedTransactions(result.transactions);
    setUploadedFile(result.fileName);
    setCurrentStep(STEPS.PRACTICE_PROFILE);
  };

  const handleInboxUploadComplete = (result) => {
    console.log(`[UnifiedOnboarding] Files copied to inbox: ${result.filesCopied}`);
    // Background processor picks up files automatically — no browser-side parsing needed
    setUploadedFile(true);
    setCurrentStep(STEPS.PRACTICE_PROFILE);
  };

  const handleBankUploadSkip = () => {
    setCurrentStep(STEPS.PRACTICE_PROFILE);
  };

  // ─── Practice Profile Handler + Background Categorization ───

  const mergeWebsiteDataIntoProfile = (baseProfile, websiteResult) => {
    if (!websiteResult?.success) return baseProfile;
    const merged = JSON.parse(JSON.stringify(baseProfile)); // Deep clone
    if (websiteResult.data.practiceName) {
      merged.practiceDetails.practiceName = websiteResult.data.practiceName;
    }
    if (websiteResult.data.locations?.length > 0) {
      merged.practiceDetails.locations = websiteResult.data.locations;
    }
    if (websiteResult.data.gpNames?.length > 0) {
      merged.gps = {
        ...merged.gps,
        partners: websiteResult.data.gpNames.map(name => ({ name }))
      };
    }
    if (websiteResult.data.consultationFee) {
      if (!merged.privatePatients) merged.privatePatients = {};
      merged.privatePatients.averageConsultationFee = websiteResult.data.consultationFee;
    }
    merged.practiceDetails.website = websiteResult.data.url || '';
    merged.metadata.websiteAnalyzed = true;
    merged.metadata.websiteAnalyzedAt = new Date().toISOString();
    return merged;
  };

  const startBackgroundCategorization = useCallback(async (txns, categories) => {
    console.log(`[UnifiedOnboarding] Starting background categorization for ${txns.length} transactions`);
    setIsCategorizationRunning(true);

    try {
      // Step 1: Rule-based processing (fast)
      const { transactions: processed, stats } = processTransactionsWithEngine(
        txns, categories, []
      );

      console.log('[UnifiedOnboarding] Rule-based processing complete:', {
        total: processed.length,
        auto: processed.filter(t => t.groupCohort === COHORTS.AUTO).length,
        needsAI: processed.filter(t => t.groupCohort === COHORTS.AI_ASSIST || t.groupCohort === COHORTS.REVIEW).length
      });

      // Step 2: AI categorization for uncertain transactions
      const needsAI = processed.filter(t =>
        t.groupCohort === COHORTS.AI_ASSIST || t.groupCohort === COHORTS.REVIEW
      );

      if (needsAI.length > 0) {
        console.log(`[UnifiedOnboarding] Running AI categorization for ${needsAI.length} transactions...`);

        const aiResults = await batchAICategorization(needsAI, 'group', {
          existingTransactions: [],
          corrections: [],
          categoryMapping: categories
        });

        // Merge AI results into processed transactions
        const aiMap = new Map(aiResults.map(r => [r.transactionId, r.suggestion]));
        const withAI = processed.map(t => {
          const suggestion = aiMap.get(t.id);
          if (suggestion?.confidence >= 0.5) {
            return {
              ...t,
              group: suggestion.group,
              groupReason: suggestion.reasoning,
              groupAISuggested: true,
              aiGroupSuggestion: suggestion
            };
          }
          return t;
        });

        console.log('[UnifiedOnboarding] Background categorization complete (with AI)');
        setCategorizationResult({ transactions: withAI, stats });
      } else {
        console.log('[UnifiedOnboarding] Background categorization complete (no AI needed)');
        setCategorizationResult({ transactions: processed, stats });
      }
    } catch (err) {
      console.error('[UnifiedOnboarding] Background categorization failed:', err);
      // Fallback: pass raw transactions to review step (they'll be processed there)
      setCategorizationResult({ transactions: txns, stats: null, error: true });
    } finally {
      setIsCategorizationRunning(false);
    }
  }, []);

  const handleProfileComplete = (updatedProfile) => {
    setProfile(updatedProfile);

    // Generate personalized categories from completed profile
    const generatedCategories = generateCategoriesFromProfile(updatedProfile);
    console.log('[UnifiedOnboarding] Generated categories:', generatedCategories.filter(c => c.personalization === 'Personalized').length, 'personalized');
    setCategoryMapping(generatedCategories);

    // Save profile to storage
    const completedProfile = {
      ...updatedProfile,
      metadata: {
        ...updatedProfile.metadata,
        setupComplete: false, // Not fully complete yet — finalized in handleFinalComplete
        profileCompletedAt: new Date().toISOString()
      }
    };
    storage.save(completedProfile);
    if (updateProfile) {
      updateProfile(completedProfile);
    }

    // If we have raw transactions (Path A / local-only), start browser-side categorization.
    // Inbox path users skip this — the background processor handles everything automatically.
    if (rawParsedTransactions.length > 0 && storage.isLocalOnlyMode()) {
      startBackgroundCategorization(rawParsedTransactions, generatedCategories);
    }

    setCurrentStep(STEPS.GMS_PANEL);
  };

  // ─── GMS Panel Handlers ───

  const handleGMSUpload = (file) => {
    if (file) {
      console.log('[UnifiedOnboarding] GMS file selected:', file.name);
    }
    goToTransactionProcessingOrComplete();
  };

  const handleGMSSkip = () => {
    goToTransactionProcessingOrComplete();
  };

  // Helper: go to transaction processing if we have transactions, otherwise complete
  const goToTransactionProcessingOrComplete = () => {
    if (!storage.isLocalOnlyMode() && window.electronAPI?.backgroundProcessor) {
      // Inbox path: skip wave processing — Finn handles review post-onboarding
      handleFinalComplete();
    } else if (rawParsedTransactions.length > 0) {
      setCurrentStep(STEPS.TRANSACTION_PROCESSING);
    } else {
      handleFinalComplete();
    }
  };

  // ─── Transaction Processing Handler ───

  const handleTransactionProcessingComplete = (result) => {
    console.log('[UnifiedOnboarding] Transaction processing complete:', result);
    handleFinalComplete();
  };

  // ─── Final Completion ───

  const handleFinalComplete = () => {
    if (completeSetup) {
      completeSetup();
    }

    const savedProfile = storage.get();

    // Add post-onboarding tasks
    if (!isDemoMode && savedProfile) {
      // Financial task: bulk bank statement upload
      storage.addFinancialTask({
        id: `fin-task-bulk-upload-${Date.now()}`,
        title: 'Upload remaining bank statements (up to 24 months)',
        description: 'Upload your full set of bank statements to unlock year-on-year comparison and detailed financial trends.',
        priority: 'medium',
        category: 'upload',
        actionLink: 'settings:data',
        autoGenerated: true,
        createdDate: new Date().toISOString(),
        status: 'pending'
      });

      // GMS task: upload remaining GMS panel data
      const existingActions = savedProfile.actionPlan?.actions || [];
      if (!existingActions.some(a => a.id?.startsWith('task-gms-upload'))) {
        storage.addActionItem({
          id: `task-gms-upload-${Date.now()}`,
          title: 'Upload 24 months of GMS panel data',
          description: 'Upload your PCRS payment PDFs (up to 24 months) to unlock full income analysis, leave tracking, and panel size trends.',
          category: 'setup',
          type: 'growth',
          status: 'pending',
          actionLink: 'settings:data',
          showOnDashboard: true,
          createdDate: new Date().toISOString()
        });
      }

      // GMS task: setup automatic PCRS download (Electron only)
      if (window.electronAPI?.isElectron) {
        if (!existingActions.some(a => a.id?.startsWith('task-pcrs-setup'))) {
          storage.addActionItem({
            id: `task-pcrs-setup-${Date.now()}`,
            title: 'Set up automatic PCRS downloads',
            description: 'Configure your PCRS portal credentials to enable automatic monthly download of GMS payment data.',
            category: 'setup',
            type: 'growth',
            status: 'pending',
            actionLink: 'settings:data',
            showOnDashboard: true,
            createdDate: new Date().toISOString()
          });
        }
      }
    }

    console.log('[UnifiedOnboarding] Final completion - profile saved with setupComplete=true');

    if (onComplete) {
      onComplete({
        profile: savedProfile,
        uploadedTransactions: uploadedFile !== null,
        isDemoMode: isDemoMode,
        offerTour: true
      });
    }
  };

  // ─── Progress Bar ───

  const getProgressInfo = () => {
    if (currentStep === null || currentStep <= STEPS.PATH_SELECTION || isDemoMode) {
      return { show: false, percent: 0, label: '' };
    }

    const stepIndex = PROGRESS_STEPS.indexOf(currentStep);
    if (stepIndex === -1) {
      return { show: false, percent: 0, label: '' };
    }

    const percent = ((stepIndex + 1) / PROGRESS_STEPS.length) * 100;
    return { show: true, percent, label: `Step ${stepIndex + 1} of ${PROGRESS_STEPS.length}` };
  };

  const progressInfo = getProgressInfo();

  // ─── Loading State ───

  if (isCheckingApiKey || currentStep === null) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: COLORS.bgPage,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: `3px solid ${COLORS.borderLight}`,
            borderTopColor: COLORS.slainteBlue,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }} />
          <p style={{ color: COLORS.textSecondary }}>Loading...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // Determine wide layout steps
  const isWideStep = [
    STEPS.PRIVACY_CHOICE, STEPS.PATH_SELECTION, STEPS.WEBSITE_URL,
    STEPS.BANK_UPLOAD, STEPS.PRACTICE_PROFILE,
    STEPS.TRANSACTION_PROCESSING,
    STEPS.GMS_PANEL
  ].includes(currentStep);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: COLORS.bgPage,
      padding: '2rem 1rem'
    }}>
      <div style={{
        maxWidth: isWideStep ? '1600px' : '900px',
        margin: '0 auto',
        transition: 'max-width 0.3s ease'
      }}>
        {/* Progress Bar */}
        {progressInfo.show && (
          <div style={{ marginBottom: '2rem' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              color: COLORS.textSecondary
            }}>
              <span>Setup Progress</span>
              <span>{progressInfo.label}</span>
            </div>
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: COLORS.borderLight,
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${progressInfo.percent}%`,
                height: '100%',
                backgroundColor: COLORS.slainteBlue,
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>
        )}

        {/* Step Content */}
        <div style={{
          backgroundColor: COLORS.white,
          borderRadius: '12px',
          padding: isWideStep || currentStep === STEPS.TERMS ? '2.5rem' : '2rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          {currentStep === STEPS.TERMS && (
            <TermsAndConditions
              onAccept={handleTermsAccept}
              onDecline={onSkip}
            />
          )}

          {currentStep === STEPS.API_KEY && (
            <APIKeySetup
              onComplete={handleAPIKeyComplete}
              onDemo={handlePathDemo}
            />
          )}

          {currentStep === STEPS.PRIVACY_CHOICE && (
            <div style={{
              maxWidth: '750px',
              margin: '0 auto',
              padding: '2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem'
            }}>
              <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  How would you like to use Sláinte?
                </h2>
                <p style={{ color: COLORS.textPrimary, fontSize: '0.95rem' }}>
                  You can change this at any time in Settings &gt; Privacy &amp; AI.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                {/* AI-Powered Option */}
                <button
                  onClick={() => handlePrivacyChoice(true)}
                  style={{
                    flex: 1,
                    padding: '1.25rem',
                    borderRadius: '0.75rem',
                    border: `2px solid ${COLORS.slainteBlue}`,
                    backgroundColor: 'rgba(74, 144, 226, 0.05)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(74, 144, 226, 0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(74, 144, 226, 0.05)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1.125rem', fontWeight: 600, color: COLORS.slainteBlue }}>
                      AI-Powered Mode
                    </span>
                    <span style={{
                      backgroundColor: COLORS.slainteBlue,
                      color: COLORS.white,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.65rem',
                      fontWeight: 600
                    }}>RECOMMENDED</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: COLORS.textPrimary, lineHeight: 1.5 }}>
                    Finn helps categorise transactions, generate reports, and answer questions.
                    Data is sent securely and never stored externally.
                  </p>
                </button>

                {/* Local Only Option */}
                <button
                  onClick={() => handlePrivacyChoice(false)}
                  style={{
                    flex: 1,
                    padding: '1.25rem',
                    borderRadius: '0.75rem',
                    border: `1px solid ${COLORS.borderLight}`,
                    backgroundColor: COLORS.white,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.bgPage}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.white}
                >
                  <div style={{ marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1.125rem', fontWeight: 600 }}>
                      Local Only Mode
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: COLORS.textPrimary, lineHeight: 1.5 }}>
                    No data leaves your computer. AI features are disabled but all core features work.
                    You can enable AI later in Settings.
                  </p>
                </button>
              </div>

              {/* Comparison Table */}
              <div style={{
                border: `1px solid ${COLORS.borderLight}`,
                borderRadius: '0.75rem',
                overflow: 'hidden'
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.8125rem'
                }}>
                  <thead>
                    <tr style={{ backgroundColor: COLORS.bgPage }}>
                      <th style={{ padding: '0.625rem 1rem', textAlign: 'left', fontWeight: 600, color: COLORS.textPrimary, borderBottom: `1px solid ${COLORS.borderLight}` }}>Feature</th>
                      <th style={{ padding: '0.625rem 1rem', textAlign: 'center', fontWeight: 600, color: COLORS.slainteBlue, borderBottom: `1px solid ${COLORS.borderLight}`, width: '140px' }}>AI-Powered</th>
                      <th style={{ padding: '0.625rem 1rem', textAlign: 'center', fontWeight: 600, color: COLORS.textPrimary, borderBottom: `1px solid ${COLORS.borderLight}`, width: '140px' }}>Local Only</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Financial dashboard & charts', true, true],
                      ['Transaction categorisation', 'AI + rules', 'Rules only'],
                      ['Bank statement import', true, true],
                      ['GMS Health Check analysis', true, true],
                      ['Encrypted backups', true, true],
                      ['Mobile partner access', true, true],
                      ['Finn chat & reports', true, false],
                      ['PCRS automated downloads', true, false],
                      ['External connections', 'Anthropic API (encrypted)', 'None'],
                      ['Data stored externally', 'Never', 'Never'],
                    ].map(([feature, ai, local], idx) => (
                      <tr key={idx} style={{
                        borderBottom: idx < 9 ? `1px solid ${COLORS.borderLight}20` : 'none',
                        backgroundColor: idx % 2 === 0 ? COLORS.white : `${COLORS.bgPage}80`
                      }}>
                        <td style={{ padding: '0.5rem 1rem', color: COLORS.textPrimary }}>{feature}</td>
                        <td style={{ padding: '0.5rem 1rem', textAlign: 'center', color: ai === true ? COLORS.incomeColor : ai === false ? COLORS.expenseColor : COLORS.textPrimary }}>
                          {ai === true ? 'Yes' : ai === false ? 'No' : ai}
                        </td>
                        <td style={{ padding: '0.5rem 1rem', textAlign: 'center', color: local === true ? COLORS.incomeColor : local === false ? COLORS.expenseColor : COLORS.textPrimary }}>
                          {local === true ? 'Yes' : local === false ? 'No' : local}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {currentStep === STEPS.PATH_SELECTION && (
            <PathSelection
              onSelectSetup={handlePathSetup}
              onSelectDemo={handlePathDemo}
              onSelectQuickConnect={handlePathQuickConnect}
            />
          )}

          {currentStep === STEPS.QUICK_CONNECT && (
            <QuickConnectSetup
              onComplete={handleQuickConnectComplete}
              onBack={() => setCurrentStep(STEPS.PATH_SELECTION)}
            />
          )}

          {currentStep === STEPS.WEBSITE_URL && (
            <WebsiteAnalysis
              onComplete={handleWebsiteComplete}
              onSkip={handleWebsiteSkip}
              onBack={() => setCurrentStep(STEPS.PATH_SELECTION)}
            />
          )}

          {currentStep === STEPS.BANK_UPLOAD && (
            !storage.isLocalOnlyMode() && window.electronAPI?.backgroundProcessor
              ? <OnboardingInboxUpload
                  onComplete={handleInboxUploadComplete}
                  onSkip={handleBankUploadSkip}
                  onBack={() => setCurrentStep(isWebsiteAnalyzing || websiteAnalysisResult ? STEPS.WEBSITE_URL : STEPS.PATH_SELECTION)}
                />
              : <OnboardingBankUpload
                  onComplete={handleBankUploadComplete}
                  onSkip={handleBankUploadSkip}
                  onBack={() => setCurrentStep(isWebsiteAnalyzing || websiteAnalysisResult ? STEPS.WEBSITE_URL : STEPS.PATH_SELECTION)}
                />
          )}

          {currentStep === STEPS.PRACTICE_PROFILE && (
            <StaffProfileForm
              initialProfile={mergeWebsiteDataIntoProfile(profile, websiteAnalysisResult)}
              websiteData={websiteAnalysisResult}
              websiteLoading={isWebsiteAnalyzing}
              onComplete={handleProfileComplete}
              onBack={() => setCurrentStep(STEPS.BANK_UPLOAD)}
            />
          )}

          {currentStep === STEPS.GMS_PANEL && (
            <GMSPanelUploadPrompt
              onUpload={handleGMSUpload}
              onSkip={handleGMSSkip}
            />
          )}

          {currentStep === STEPS.TRANSACTION_PROCESSING && (
            <>
              {/* Show loading if categorization is still running */}
              {isCategorizationRunning && !categorizationResult && (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    border: `3px solid ${COLORS.borderLight}`,
                    borderTopColor: COLORS.slainteBlue,
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 1rem'
                  }} />
                  <p style={{ color: COLORS.textPrimary, fontSize: '1rem', fontWeight: 500 }}>
                    Finishing up transaction analysis...
                  </p>
                  <p style={{ color: COLORS.textSecondary, fontSize: '0.875rem' }}>
                    This should only take a moment.
                  </p>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}

              {/* Show transaction processing once categorization is ready */}
              {(!isCategorizationRunning || categorizationResult) && (
                <OnboardingTransactionUpload
                  initialTransactions={categorizationResult?.transactions || rawParsedTransactions}
                  onComplete={handleTransactionProcessingComplete}
                  onSkip={() => handleFinalComplete()}
                  onBack={() => setCurrentStep(STEPS.GMS_PANEL)}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

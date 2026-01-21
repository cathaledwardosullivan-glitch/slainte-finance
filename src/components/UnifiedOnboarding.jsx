import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { usePracticeProfile } from '../hooks/usePracticeProfile';
import { createUnifiedProfile } from '../data/practiceProfileSchemaV2';
import { generateCategoriesFromProfile } from '../utils/categoryGenerator';
import * as storage from '../storage/practiceProfileStorage';
import { saveTransactions, saveCategoryMapping } from '../utils/storageUtils';
import COLORS from '../utils/colors';
import { DEMO_PROFILE, generateDemoTransactions, generateDemoGMSPanelData, DEMO_CATEGORY_MAPPING } from '../data/demoData';

// Step components
import APIKeySetup from './Onboarding/APIKeySetup';
import PathSelection from './Onboarding/PathSelection';
import StructureExplanation from './Onboarding/StructureExplanation';
import WebsiteAnalysis from './Onboarding/WebsiteAnalysis';
import ConversationalSetup from './Onboarding/ConversationalSetup';
import ProgressCheckpoint from './Onboarding/ProgressCheckpoint';
import CategoryPreferences from './Onboarding/CategoryPreferences';
import ReviewAndComplete from './Onboarding/ReviewAndComplete';
import TransactionUploadTypeSelection from './Onboarding/TransactionUploadTypeSelection';
import TransactionUploadPrompt from './Onboarding/TransactionUploadPrompt';
import LabelledTransactionImport from './Onboarding/LabelledTransactionImport';
import CategoryMappingReview from './Onboarding/CategoryMappingReview';
import LabelledIdentifierExtraction from './Onboarding/LabelledIdentifierExtraction';
import GuidedAIIdentifierSuggestions from './Onboarding/GuidedAIIdentifierSuggestions';
import GuidedAIExpenseCategorization from './Onboarding/GuidedAIExpenseCategorization';
import GMSPanelUploadPrompt from './Onboarding/GMSPanelUploadPrompt';
import FeatureTour from './Onboarding/FeatureTour';

const STEPS = {
  API_KEY: 0,
  PATH_SELECTION: 1,
  STRUCTURE: 2,
  WEBSITE: 3,
  CONVERSATION: 4,
  PROGRESS_CHECKPOINT: 5,
  CATEGORIES: 6,
  REVIEW: 7,
  UPLOAD_TYPE_SELECTION: 8,
  TRANSACTION_UPLOAD: 9,
  LABELLED_IMPORT: 10,
  CATEGORY_MAPPING: 11,
  LABELLED_EXTRACTION: 12,
  AI_STAFF: 13,
  AI_CATEGORIZATION: 14,
  GMS_PANEL: 15,
  FEATURE_TOUR: 16,
  COMPLETE: 17
};

export default function UnifiedOnboarding({ onComplete, onSkip }) {
  const { setCategoryMapping, uploadTransactions, setTransactions, setPaymentAnalysisData } = useAppContext();
  const { updateProfile, completeSetup } = usePracticeProfile();

  const [currentStep, setCurrentStep] = useState(null); // Start as null until we check API key
  const [apiKey, setApiKey] = useState('');
  const [profile, setProfile] = useState(createUnifiedProfile());
  const [websiteData, setWebsiteData] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isCheckingApiKey, setIsCheckingApiKey] = useState(true);
  const [labelledImportData, setLabelledImportData] = useState(null);
  const [categoryMappingData, setCategoryMappingData] = useState(null);

  // Check for existing API key on mount
  useEffect(() => {
    const checkApiKey = async () => {
      setIsCheckingApiKey(true);
      let savedApiKey = null;

      // Check via Electron API first (preferred)
      if (window.electronAPI?.isElectron) {
        savedApiKey = await window.electronAPI.getLocalStorage('claude_api_key');
        console.log('[UnifiedOnboarding] Electron API key check result:', savedApiKey ? 'Found' : 'Not found');
      }

      // Fallback to localStorage for backwards compatibility
      if (!savedApiKey) {
        savedApiKey = localStorage.getItem('anthropic_api_key');
        console.log('[UnifiedOnboarding] localStorage API key check result:', savedApiKey ? 'Found' : 'Not found');
      }

      if (savedApiKey) {
        setApiKey(savedApiKey);
        setCurrentStep(STEPS.PATH_SELECTION);
      } else {
        setCurrentStep(STEPS.API_KEY);
      }
      setIsCheckingApiKey(false);
    };

    checkApiKey();
  }, []);

  // Handle API key setup
  const handleAPIKeyComplete = (key) => {
    setApiKey(key);
    // API key is already saved via Electron IPC in APIKeySetup component
    // No need to save to localStorage here
    setCurrentStep(STEPS.PATH_SELECTION);
  };

  // Handle path selection
  const handlePathSetup = () => {
    setIsDemoMode(false);
    // Skip structure explanation and go directly to website analysis
    setCurrentStep(STEPS.WEBSITE);
  };

  const handlePathDemo = () => {
    setIsDemoMode(true);

    // Generate demo data
    const demoTransactions = generateDemoTransactions();
    const demoGMSData = generateDemoGMSPanelData();
    console.log(`[Demo Mode] Generated ${demoTransactions.length} transactions for year ${new Date().getFullYear()}`);
    console.log(`[Demo Mode] Generated ${demoGMSData.length} GMS panel entries (${demoGMSData.length / 3} months x 3 partners)`);
    console.log('[Demo Mode] Sample transaction:', demoTransactions[0]);
    console.log('[Demo Mode] Sample GMS data:', demoGMSData[0]);
    console.log(`[Demo Mode] Date range: ${demoTransactions[demoTransactions.length - 1]?.date} to ${demoTransactions[0]?.date}`);

    // Save directly to localStorage (not just React state)
    saveTransactions(demoTransactions);
    saveCategoryMapping(DEMO_CATEGORY_MAPPING);
    localStorage.setItem('gp_finance_payment_analysis', JSON.stringify(demoGMSData));
    storage.save(DEMO_PROFILE);
    completeSetup();

    // Also set in React state for immediate use
    setProfile(DEMO_PROFILE);
    setCategoryMapping(DEMO_CATEGORY_MAPPING);
    setTransactions(demoTransactions);
    setPaymentAnalysisData(demoGMSData);
    console.log('[Demo Mode] Demo data saved to localStorage and AppContext');

    // Jump to feature tour
    setCurrentStep(STEPS.FEATURE_TOUR);
  };

  // Handle structure explanation
  const handleStructureExplanationComplete = () => {
    setCurrentStep(STEPS.WEBSITE);
  };

  // Handle website analysis
  const handleWebsiteComplete = (data) => {
    setWebsiteData(data);

    // Pre-fill profile with website data if available
    if (data && data.success) {
      const updatedProfile = { ...profile };

      if (data.data.practiceName) {
        updatedProfile.practiceDetails.practiceName = data.data.practiceName;
      }
      if (data.data.locations?.length > 0) {
        updatedProfile.practiceDetails.locations = data.data.locations;
      }
      if (data.data.services) {
        updatedProfile.services = {
          ...updatedProfile.services,
          ...data.data.services
        };
      }

      updatedProfile.practiceDetails.website = data.url;
      updatedProfile.metadata.websiteAnalyzed = true;
      updatedProfile.metadata.websiteAnalyzedAt = new Date();

      setProfile(updatedProfile);
    }

    setCurrentStep(STEPS.CONVERSATION);
  };

  // Handle website skip
  const handleWebsiteSkip = () => {
    setCurrentStep(STEPS.CONVERSATION);
  };

  // Handle conversational setup
  const handleConversationComplete = (updatedProfile) => {
    setProfile(updatedProfile);

    // Generate categories from profile (moved from progress checkpoint)
    const generatedCategories = generateCategoriesFromProfile(updatedProfile);
    console.log('[UnifiedOnboarding] Generated categories:', generatedCategories.filter(c => c.personalization === 'Personalized').length, 'personalized');
    setCategoryMapping(generatedCategories);

    // Go to upload type selection
    setCurrentStep(STEPS.UPLOAD_TYPE_SELECTION);
  };

  // Handle progress checkpoint
  const handleProgressCheckpointContinue = () => {
    // Generate categories from profile so AI Staff Analysis can use them
    const generatedCategories = generateCategoriesFromProfile(profile);
    console.log('[UnifiedOnboarding] Generated categories after progress checkpoint:', generatedCategories.filter(c => c.personalization === 'Personalized').length, 'personalized categories');
    console.log('[UnifiedOnboarding] Staff categories:', generatedCategories.filter(c => ['3','4','5','6','7'].includes(c.role)).length);
    console.log('[UnifiedOnboarding] Partner categories:', generatedCategories.filter(c => c.role === '90').length);

    // Set categories in context so AI Staff Analysis can see them
    setCategoryMapping(generatedCategories);

    setCurrentStep(STEPS.TRANSACTION_UPLOAD);
  };

  const handleProgressCheckpointSkip = () => {
    // Skip directly to feature tour, bypassing data upload
    handleFinalComplete();
  };

  // Handle category preferences
  const handleCategoryPreferencesComplete = (preferences) => {
    const updatedProfile = {
      ...profile,
      categoryPreferences: preferences
    };
    setProfile(updatedProfile);
    setCurrentStep(STEPS.REVIEW);
  };

  // Handle review complete
  const handleReviewComplete = () => {
    // Generate and save categories
    const finalCategories = generateCategoriesFromProfile(profile);
    console.log('[UnifiedOnboarding] Generated categories:', finalCategories.filter(c => c.personalization === 'Personalized').length, 'personalized categories');
    console.log('[UnifiedOnboarding] Partners:', profile.gps?.partners?.length || 0);
    console.log('[UnifiedOnboarding] Salaried GPs:', profile.gps?.salaried?.length || 0);
    console.log('[UnifiedOnboarding] Staff:', profile.staff?.length || 0);
    setCategoryMapping(finalCategories);

    // Mark profile as complete
    const completedProfile = {
      ...profile,
      metadata: {
        ...profile.metadata,
        setupComplete: true,
        setupCompletedAt: new Date()
      }
    };

    // Save to storage
    storage.save(completedProfile);

    // Update via hook
    if (updateProfile) {
      updateProfile(completedProfile);
    }
    if (completeSetup) {
      completeSetup();
    }

    // Move to transaction upload step
    setCurrentStep(STEPS.TRANSACTION_UPLOAD);
  };

  // Handle transaction upload
  const handleTransactionUpload = async (file) => {
    setUploadedFile(file);

    // Upload transactions using AppContext
    if (uploadTransactions) {
      try {
        await uploadTransactions(file);

        // Wait a moment for transactions to be processed and loaded into context
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Move to AI staff suggestions
        setCurrentStep(STEPS.AI_STAFF);
      } catch (error) {
        console.error('Error uploading transactions:', error);
        alert('Failed to upload transactions. You can try again later from the dashboard.');
        setCurrentStep(STEPS.AI_STAFF);
      }
    } else {
      // Move to AI staff suggestions anyway
      setCurrentStep(STEPS.AI_STAFF);
    }
  };

  // Handle transaction upload skip
  const handleTransactionSkip = () => {
    // Skip to GMS panel (no transactions to categorize)
    setCurrentStep(STEPS.GMS_PANEL);
  };

  // Handle upload type selection
  const handleUploadTypeRaw = () => {
    setCurrentStep(STEPS.TRANSACTION_UPLOAD);
  };

  const handleUploadTypeLabelled = () => {
    setCurrentStep(STEPS.LABELLED_IMPORT);
  };

  const handleUploadTypeBackup = () => {
    // TODO: Implement backup restore flow
    // For now, go to raw upload
    setCurrentStep(STEPS.TRANSACTION_UPLOAD);
  };

  const handleUploadTypeSkip = () => {
    setCurrentStep(STEPS.GMS_PANEL);
  };

  // Handle labelled transaction import
  const handleLabelledImportComplete = (data) => {
    setLabelledImportData(data);
    setCurrentStep(STEPS.CATEGORY_MAPPING);
  };

  const handleLabelledImportSwitchToRaw = () => {
    setCurrentStep(STEPS.TRANSACTION_UPLOAD);
  };

  const handleLabelledImportSkip = () => {
    setCurrentStep(STEPS.GMS_PANEL);
  };

  // Handle category mapping review
  const handleCategoryMappingComplete = (data) => {
    setCategoryMappingData(data);
    setCurrentStep(STEPS.LABELLED_EXTRACTION);
  };

  const handleCategoryMappingBack = () => {
    setCurrentStep(STEPS.LABELLED_IMPORT);
  };

  // Handle labelled identifier extraction complete
  const handleLabelledExtractionComplete = () => {
    // After labelled import, go to GMS panel (skip AI staff/categorization since data is already categorized)
    setCurrentStep(STEPS.GMS_PANEL);
  };

  // Handle AI staff suggestions complete
  const handleAIStaffComplete = () => {
    setCurrentStep(STEPS.AI_CATEGORIZATION);
  };

  // Handle AI categorization complete
  const handleAICategorizationComplete = () => {
    setCurrentStep(STEPS.GMS_PANEL);
  };

  // Handle GMS panel upload
  const handleGMSUpload = (file) => {
    // File was selected and processed
    if (file) {
      console.log('[UnifiedOnboarding] GMS file selected:', file.name);
    }
    setCurrentStep(STEPS.FEATURE_TOUR);
  };

  // Handle GMS panel skip
  const handleGMSSkip = () => {
    setCurrentStep(STEPS.FEATURE_TOUR);
  };

  // Handle feature tour
  const handleFeatureTourComplete = () => {
    handleFinalComplete();
  };

  const handleFeatureTourSkip = () => {
    handleFinalComplete();
  };

  // Final completion
  const handleFinalComplete = () => {
    // Ensure profile is marked as complete before finishing
    const completedProfile = {
      ...profile,
      metadata: {
        ...profile.metadata,
        setupComplete: true,
        setupCompletedAt: new Date()
      }
    };

    // Save to storage
    storage.save(completedProfile);

    // Also mark via hook
    if (completeSetup) {
      completeSetup();
    }

    console.log('[UnifiedOnboarding] Final completion - profile saved with setupComplete=true');

    // Call completion callback
    if (onComplete) {
      onComplete({
        profile: completedProfile,
        uploadedTransactions: uploadedFile !== null,
        isDemoMode: isDemoMode
      });
    }
  };

  // Calculate progress
  const totalSteps = Object.keys(STEPS).length;
  const progress = currentStep !== null ? ((currentStep + 1) / totalSteps) * 100 : 0;

  // Determine if we should show progress bar
  // Don't show for: API_KEY, PATH_SELECTION, FEATURE_TOUR, or COMPLETE
  const showProgressBar = currentStep !== null &&
                          currentStep > STEPS.PATH_SELECTION &&
                          currentStep < STEPS.FEATURE_TOUR &&
                          !isDemoMode;

  // Show loading while checking for API key
  if (isCheckingApiKey || currentStep === null) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: COLORS.backgroundGray,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: `3px solid ${COLORS.lightGray}`,
            borderTopColor: COLORS.slainteBlue,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }} />
          <p style={{ color: COLORS.mediumGray }}>Loading...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: COLORS.backgroundGray,
      padding: '2rem 1rem'
    }}>
      <div style={{
        maxWidth: (currentStep === STEPS.PATH_SELECTION || currentStep === STEPS.WEBSITE || currentStep === STEPS.CONVERSATION || currentStep === STEPS.UPLOAD_TYPE_SELECTION || currentStep === STEPS.TRANSACTION_UPLOAD || currentStep === STEPS.LABELLED_IMPORT || currentStep === STEPS.CATEGORY_MAPPING || currentStep === STEPS.LABELLED_EXTRACTION || currentStep === STEPS.AI_STAFF || currentStep === STEPS.AI_CATEGORIZATION || currentStep === STEPS.GMS_PANEL) ? '1600px' : '900px',
        margin: '0 auto',
        transition: 'max-width 0.3s ease'
      }}>
        {/* Progress Bar */}
        {showProgressBar && (
          <div style={{ marginBottom: '2rem' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              color: COLORS.mediumGray
            }}>
              <span>Setup Progress</span>
              <span>Step {currentStep + 1} of {totalSteps}</span>
            </div>
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: COLORS.lightGray,
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${progress}%`,
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
          padding: (currentStep === STEPS.PATH_SELECTION || currentStep === STEPS.WEBSITE || currentStep === STEPS.CONVERSATION || currentStep === STEPS.UPLOAD_TYPE_SELECTION || currentStep === STEPS.TRANSACTION_UPLOAD || currentStep === STEPS.LABELLED_IMPORT || currentStep === STEPS.CATEGORY_MAPPING || currentStep === STEPS.LABELLED_EXTRACTION || currentStep === STEPS.AI_STAFF || currentStep === STEPS.AI_CATEGORIZATION || currentStep === STEPS.GMS_PANEL) ? '2.5rem' : '2rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          {currentStep === STEPS.API_KEY && (
            <APIKeySetup
              onComplete={handleAPIKeyComplete}
              onSkip={onSkip}
            />
          )}

          {currentStep === STEPS.PATH_SELECTION && (
            <PathSelection
              onSelectSetup={handlePathSetup}
              onSelectDemo={handlePathDemo}
            />
          )}

          {currentStep === STEPS.STRUCTURE && (
            <StructureExplanation
              practiceName={profile?.practiceDetails?.practiceName}
              onContinue={handleStructureExplanationComplete}
              onBack={() => setCurrentStep(STEPS.PATH_SELECTION)}
            />
          )}

          {currentStep === STEPS.WEBSITE && (
            <WebsiteAnalysis
              apiKey={apiKey}
              onComplete={handleWebsiteComplete}
              onSkip={handleWebsiteSkip}
              onBack={() => setCurrentStep(STEPS.PATH_SELECTION)}
            />
          )}

          {currentStep === STEPS.CONVERSATION && (
            <ConversationalSetup
              apiKey={apiKey}
              initialProfile={profile}
              websiteData={websiteData}
              onComplete={handleConversationComplete}
              onBack={() => setCurrentStep(STEPS.WEBSITE)}
            />
          )}

          {currentStep === STEPS.PROGRESS_CHECKPOINT && (
            <ProgressCheckpoint
              profile={profile}
              onContinue={handleProgressCheckpointContinue}
              onSkipToUpload={handleProgressCheckpointSkip}
            />
          )}

          {currentStep === STEPS.CATEGORIES && (
            <CategoryPreferences
              profile={profile}
              onComplete={handleCategoryPreferencesComplete}
              onBack={() => setCurrentStep(STEPS.CONVERSATION)}
            />
          )}

          {currentStep === STEPS.REVIEW && (
            <ReviewAndComplete
              profile={profile}
              onComplete={handleReviewComplete}
              onBack={() => setCurrentStep(STEPS.CATEGORIES)}
            />
          )}

          {currentStep === STEPS.UPLOAD_TYPE_SELECTION && (
            <TransactionUploadTypeSelection
              onSelectRaw={handleUploadTypeRaw}
              onSelectLabelled={handleUploadTypeLabelled}
              onSelectBackup={handleUploadTypeBackup}
              onSkip={handleUploadTypeSkip}
            />
          )}

          {currentStep === STEPS.TRANSACTION_UPLOAD && (
            <TransactionUploadPrompt
              onUpload={handleTransactionUpload}
              onSkip={handleTransactionSkip}
            />
          )}

          {currentStep === STEPS.LABELLED_IMPORT && (
            <LabelledTransactionImport
              onComplete={handleLabelledImportComplete}
              onSwitchToRaw={handleLabelledImportSwitchToRaw}
              onSkip={handleLabelledImportSkip}
            />
          )}

          {currentStep === STEPS.CATEGORY_MAPPING && (
            <CategoryMappingReview
              importData={labelledImportData}
              onComplete={handleCategoryMappingComplete}
              onBack={handleCategoryMappingBack}
            />
          )}

          {currentStep === STEPS.LABELLED_EXTRACTION && (
            <LabelledIdentifierExtraction
              mappingData={categoryMappingData}
              onComplete={handleLabelledExtractionComplete}
            />
          )}

          {currentStep === STEPS.AI_STAFF && (
            <GuidedAIIdentifierSuggestions
              onComplete={handleAIStaffComplete}
            />
          )}

          {currentStep === STEPS.AI_CATEGORIZATION && (
            <GuidedAIExpenseCategorization
              onComplete={handleAICategorizationComplete}
            />
          )}

          {currentStep === STEPS.GMS_PANEL && (
            <GMSPanelUploadPrompt
              onUpload={handleGMSUpload}
              onSkip={handleGMSSkip}
            />
          )}

          {currentStep === STEPS.FEATURE_TOUR && (
            <FeatureTour
              onComplete={handleFeatureTourComplete}
              onSkip={handleFeatureTourSkip}
            />
          )}
        </div>
      </div>
    </div>
  );
}

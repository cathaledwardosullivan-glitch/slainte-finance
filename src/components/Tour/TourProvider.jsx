import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { TOUR_STEPS, GMS_HEALTH_CHECK_TOUR_STEPS } from './tourSteps';

const TourContext = createContext(null);

export const TourProvider = ({ children, setCurrentView, currentView, onTourStart }) => {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [activeTourSteps, setActiveTourSteps] = useState(TOUR_STEPS);
  const [isMiniTour, setIsMiniTour] = useState(false);

  const totalSteps = activeTourSteps.length;
  const currentStepData = activeTourSteps[currentStep] || null;

  // Check if tour was completed before
  const getTourCompletionDate = useCallback(() => {
    const completedDate = localStorage.getItem('slainte_app_tour_completed');
    return completedDate ? new Date(completedDate) : null;
  }, []);

  // Tour actions for controlling modals and UI during tour
  const tourActions = {
    openReportsModal: () => window.dispatchEvent(new CustomEvent('tour:openReportsModal')),
    closeReportsModal: () => window.dispatchEvent(new CustomEvent('tour:closeReportsModal')),
    openSettingsModal: () => window.dispatchEvent(new CustomEvent('tour:openSettingsModal')),
    closeSettingsModal: () => window.dispatchEvent(new CustomEvent('tour:closeSettingsModal')),
    switchToHealthCheck: () => {
      // Health check is now its own top-level tab
      if (setCurrentView) setCurrentView('gms-health-check');
    },
    switchToDashboard: () => {
      // Financial Dashboard is now a toggle within Business Overview
      if (setCurrentView) setCurrentView('business-overview');
      window.dispatchEvent(new CustomEvent('tour:switchToDashboard'));
    },
    switchToGMSDashboard: () => {
      // GMS Dashboard is now a toggle within Business Overview
      if (setCurrentView) setCurrentView('business-overview');
      window.dispatchEvent(new CustomEvent('tour:switchToGMSDashboard'));
    },
    // Settings section navigation
    switchToSettingsData: () => window.dispatchEvent(new CustomEvent('tour:switchSettingsSection', { detail: 'data' })),
    switchToSettingsCategories: () => window.dispatchEvent(new CustomEvent('tour:switchSettingsSection', { detail: 'categories' })),
    switchToSettingsAccountant: () => window.dispatchEvent(new CustomEvent('tour:switchSettingsSection', { detail: 'accountant' })),
    // Tasks widget
    openTasksWidget: () => window.dispatchEvent(new CustomEvent('tour:openTasksWidget')),
    closeTasksWidget: () => window.dispatchEvent(new CustomEvent('tour:closeTasksWidget')),
    openManageTasksModal: () => window.dispatchEvent(new CustomEvent('tour:openManageTasksModal')),
    closeManageTasksModal: () => window.dispatchEvent(new CustomEvent('tour:closeManageTasksModal')),
  };

  // Execute tour action by name
  const executeTourAction = useCallback((actionName) => {
    if (actionName && tourActions[actionName]) {
      tourActions[actionName]();
    }
  }, []);

  // Start the main app tour
  const startTour = useCallback(() => {
    // Close any open modals first (e.g., Settings modal)
    if (onTourStart) {
      onTourStart();
    }

    setActiveTourSteps(TOUR_STEPS);
    setIsMiniTour(false);
    setCurrentStep(0);
    setIsActive(true);

    // Navigate to the first step's page if specified
    const firstStep = TOUR_STEPS[0];
    if (firstStep?.page && setCurrentView) {
      setCurrentView(firstStep.page);
    }
  }, [setCurrentView, onTourStart]);

  // Start the GMS Health Check mini-tour
  const startGMSHealthCheckTour = useCallback(() => {
    if (onTourStart) {
      onTourStart();
    }

    setActiveTourSteps(GMS_HEALTH_CHECK_TOUR_STEPS);
    setIsMiniTour(true);
    setCurrentStep(0);
    setIsActive(true);

    // Navigate to GMS Health Check page (now its own top-level tab)
    if (setCurrentView) {
      setCurrentView('gms-health-check');
    }
  }, [setCurrentView, onTourStart]);

  // Listen for Finn's agentic start-app-tour request
  useEffect(() => {
    const handleFinnTourRequest = () => {
      startTour();
    };

    window.addEventListener('finn:start-app-tour', handleFinnTourRequest);
    return () => window.removeEventListener('finn:start-app-tour', handleFinnTourRequest);
  }, [startTour]);

  // End the tour (completion)
  const endTour = useCallback(() => {
    // Close any modals that might be open
    tourActions.closeReportsModal();
    tourActions.closeSettingsModal();

    setIsActive(false);
    setCurrentStep(0);

    if (isMiniTour) {
      localStorage.setItem('slainte_gms_hc_tour_completed', new Date().toISOString());
    } else {
      localStorage.setItem('slainte_app_tour_completed', new Date().toISOString());
    }

    // Reset to main tour steps
    setActiveTourSteps(TOUR_STEPS);
    setIsMiniTour(false);
  }, [isMiniTour]);

  // End the tour with a next-step choice (navigates + sends Finn message)
  const endTourWithChoice = useCallback((choiceId) => {
    // End the tour first
    endTour();

    // Navigate based on choice after a brief delay for cleanup
    setTimeout(() => {
      if (choiceId === 'bank-transactions') {
        // Open Settings > Data tab for bank uploads
        tourActions.openSettingsModal();
        setTimeout(() => {
          tourActions.switchToSettingsData();
        }, 300);
      } else if (choiceId === 'gms-payments') {
        // Navigate to Business Overview (GMS Dashboard is now a toggle within it)
        if (setCurrentView) {
          setCurrentView('business-overview');
        }
      }

      // Dispatch event for FinnContext to show a follow-up message
      window.dispatchEvent(new CustomEvent('tour:choiceMade', { detail: { choiceId } }));
    }, 200);
  }, [endTour, setCurrentView]);

  // Skip the tour without marking complete
  const skipTour = useCallback(() => {
    // Execute onExit for current step to clean up any open modals
    const currentStepInfo = activeTourSteps[currentStep];
    if (currentStepInfo?.onExit) {
      executeTourAction(currentStepInfo.onExit);
    }
    // Also close any modals that might be open
    tourActions.closeReportsModal();
    tourActions.closeSettingsModal();

    setIsActive(false);
    setCurrentStep(0);

    if (isMiniTour) {
      localStorage.setItem('slainte_gms_hc_tour_skipped', new Date().toISOString());
    } else {
      localStorage.setItem('slainte_app_tour_skipped', new Date().toISOString());
    }

    // Reset to main tour steps
    setActiveTourSteps(TOUR_STEPS);
    setIsMiniTour(false);
  }, [currentStep, executeTourAction, activeTourSteps, isMiniTour]);

  // Navigate to next step
  const nextStep = useCallback(() => {
    if (currentStep >= totalSteps - 1) {
      // Execute onExit for current step before ending
      const currentStepInfo = activeTourSteps[currentStep];
      if (currentStepInfo?.onExit) {
        executeTourAction(currentStepInfo.onExit);
      }
      endTour();
      return;
    }

    const currentStepInfo = activeTourSteps[currentStep];
    const nextStepIndex = currentStep + 1;
    const nextStepData = activeTourSteps[nextStepIndex];

    // Execute onExit action for current step
    if (currentStepInfo?.onExit) {
      executeTourAction(currentStepInfo.onExit);
    }

    // Handle special view state requirements (e.g., showing report selection)
    if (nextStepData?.viewState) {
      localStorage.setItem('tour_view_state', JSON.stringify({
        page: nextStepData.page,
        view: nextStepData.viewState,
        stepId: nextStepData.id
      }));
    } else {
      localStorage.removeItem('tour_view_state');
    }

    // If next step is on a different page, navigate first
    if (nextStepData?.page && nextStepData.page !== currentView && setCurrentView) {
      setIsTransitioning(true);
      setCurrentView(nextStepData.page);

      // Wait for page transition before updating step and executing onEnter
      setTimeout(() => {
        setCurrentStep(nextStepIndex);
        setIsTransitioning(false);
        // Execute onEnter action for new step
        if (nextStepData?.onEnter) {
          executeTourAction(nextStepData.onEnter);
        }
      }, 300);
    } else {
      setCurrentStep(nextStepIndex);
      // Execute onEnter action for new step
      if (nextStepData?.onEnter) {
        setTimeout(() => executeTourAction(nextStepData.onEnter), 100);
      }
    }
  }, [currentStep, totalSteps, currentView, setCurrentView, endTour, executeTourAction, activeTourSteps]);

  // Navigate to previous step
  const prevStep = useCallback(() => {
    if (currentStep <= 0) return;

    const currentStepInfo = activeTourSteps[currentStep];
    const prevStepIndex = currentStep - 1;
    const prevStepData = activeTourSteps[prevStepIndex];

    // Execute onExit action for current step
    if (currentStepInfo?.onExit) {
      executeTourAction(currentStepInfo.onExit);
    }

    // If previous step is on a different page, navigate first
    if (prevStepData?.page && prevStepData.page !== currentView && setCurrentView) {
      setIsTransitioning(true);
      setCurrentView(prevStepData.page);

      setTimeout(() => {
        setCurrentStep(prevStepIndex);
        setIsTransitioning(false);
        // Execute onEnter action for previous step
        if (prevStepData?.onEnter) {
          executeTourAction(prevStepData.onEnter);
        }
      }, 300);
    } else {
      setCurrentStep(prevStepIndex);
      // Execute onEnter action for previous step
      if (prevStepData?.onEnter) {
        setTimeout(() => executeTourAction(prevStepData.onEnter), 100);
      }
    }
  }, [currentStep, currentView, setCurrentView, executeTourAction, activeTourSteps]);

  // Go to specific step
  const goToStep = useCallback((stepIndex) => {
    if (stepIndex < 0 || stepIndex >= totalSteps) return;

    const targetStep = activeTourSteps[stepIndex];

    if (targetStep?.page && targetStep.page !== currentView && setCurrentView) {
      setIsTransitioning(true);
      setCurrentView(targetStep.page);

      setTimeout(() => {
        setCurrentStep(stepIndex);
        setIsTransitioning(false);
      }, 300);
    } else {
      setCurrentStep(stepIndex);
    }
  }, [totalSteps, currentView, setCurrentView, activeTourSteps]);

  // Check if GMS HC tour was completed
  const getGMSHCTourCompletionDate = useCallback(() => {
    const completedDate = localStorage.getItem('slainte_gms_hc_tour_completed');
    return completedDate ? new Date(completedDate) : null;
  }, []);

  const value = {
    // State
    isActive,
    currentStep,
    totalSteps,
    currentStepData,
    isTransitioning,
    isMiniTour,

    // Actions
    startTour,
    startGMSHealthCheckTour,
    endTour,
    endTourWithChoice,
    skipTour,
    nextStep,
    prevStep,
    goToStep,

    // Utilities
    getTourCompletionDate,
    getGMSHCTourCompletionDate,
    executeTourAction,
    isFirstStep: currentStep === 0,
    isLastStep: currentStep === totalSteps - 1,
  };

  return (
    <TourContext.Provider value={value}>
      {children}
    </TourContext.Provider>
  );
};

export const useTour = () => {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
};

export default TourProvider;

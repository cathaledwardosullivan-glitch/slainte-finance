import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { TOUR_STEPS } from './tourSteps';

const TourContext = createContext(null);

export const TourProvider = ({ children, setCurrentView, currentView }) => {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const totalSteps = TOUR_STEPS.length;
  const currentStepData = TOUR_STEPS[currentStep] || null;

  // Check if tour was completed before
  const getTourCompletionDate = useCallback(() => {
    const completedDate = localStorage.getItem('slainte_app_tour_completed');
    return completedDate ? new Date(completedDate) : null;
  }, []);

  // Start the tour
  const startTour = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);

    // Navigate to the first step's page if specified
    const firstStep = TOUR_STEPS[0];
    if (firstStep?.page && setCurrentView) {
      setCurrentView(firstStep.page);
    }
  }, [setCurrentView]);

  // End the tour (completion)
  const endTour = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    localStorage.setItem('slainte_app_tour_completed', new Date().toISOString());
  }, []);

  // Skip the tour without marking complete
  const skipTour = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    // Optionally mark as skipped
    localStorage.setItem('slainte_app_tour_skipped', new Date().toISOString());
  }, []);

  // Navigate to next step
  const nextStep = useCallback(() => {
    if (currentStep >= totalSteps - 1) {
      endTour();
      return;
    }

    const nextStepIndex = currentStep + 1;
    const nextStepData = TOUR_STEPS[nextStepIndex];

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

      // Wait for page transition before updating step
      setTimeout(() => {
        setCurrentStep(nextStepIndex);
        setIsTransitioning(false);
      }, 300);
    } else {
      setCurrentStep(nextStepIndex);
    }
  }, [currentStep, totalSteps, currentView, setCurrentView, endTour]);

  // Navigate to previous step
  const prevStep = useCallback(() => {
    if (currentStep <= 0) return;

    const prevStepIndex = currentStep - 1;
    const prevStepData = TOUR_STEPS[prevStepIndex];

    // If previous step is on a different page, navigate first
    if (prevStepData?.page && prevStepData.page !== currentView && setCurrentView) {
      setIsTransitioning(true);
      setCurrentView(prevStepData.page);

      setTimeout(() => {
        setCurrentStep(prevStepIndex);
        setIsTransitioning(false);
      }, 300);
    } else {
      setCurrentStep(prevStepIndex);
    }
  }, [currentStep, currentView, setCurrentView]);

  // Go to specific step
  const goToStep = useCallback((stepIndex) => {
    if (stepIndex < 0 || stepIndex >= totalSteps) return;

    const targetStep = TOUR_STEPS[stepIndex];

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
  }, [totalSteps, currentView, setCurrentView]);

  const value = {
    // State
    isActive,
    currentStep,
    totalSteps,
    currentStepData,
    isTransitioning,

    // Actions
    startTour,
    endTour,
    skipTour,
    nextStep,
    prevStep,
    goToStep,

    // Utilities
    getTourCompletionDate,
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

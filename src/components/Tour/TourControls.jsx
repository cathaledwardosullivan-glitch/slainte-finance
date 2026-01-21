import React from 'react';
import { useTour } from './TourProvider';
import { COLORS } from '../../utils/colors';
import { ChevronLeft, ChevronRight, X, Check } from 'lucide-react';

const TourControls = () => {
  const {
    currentStep,
    totalSteps,
    nextStep,
    prevStep,
    skipTour,
    isFirstStep,
    isLastStep,
    isTransitioning,
  } = useTour();

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10004,
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        backgroundColor: COLORS.white,
        padding: '12px 20px',
        borderRadius: '50px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
      }}
    >
      {/* Skip button */}
      <button
        onClick={skipTour}
        disabled={isTransitioning}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '8px 12px',
          backgroundColor: 'transparent',
          border: 'none',
          color: COLORS.mediumGray,
          fontSize: '13px',
          fontWeight: '500',
          cursor: isTransitioning ? 'not-allowed' : 'pointer',
          opacity: isTransitioning ? 0.5 : 1,
          borderRadius: '20px',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          if (!isTransitioning) {
            e.target.style.backgroundColor = COLORS.backgroundGray;
            e.target.style.color = COLORS.darkGray;
          }
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = 'transparent';
          e.target.style.color = COLORS.mediumGray;
        }}
      >
        <X size={14} />
        Skip tour
      </button>

      {/* Divider */}
      <div
        style={{
          width: '1px',
          height: '24px',
          backgroundColor: COLORS.lightGray,
        }}
      />

      {/* Previous button */}
      <button
        onClick={prevStep}
        disabled={isFirstStep || isTransitioning}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '36px',
          height: '36px',
          backgroundColor: isFirstStep ? COLORS.backgroundGray : COLORS.white,
          border: `1px solid ${isFirstStep ? COLORS.lightGray : COLORS.slainteBlue}`,
          borderRadius: '50%',
          color: isFirstStep ? COLORS.lightGray : COLORS.slainteBlue,
          cursor: isFirstStep || isTransitioning ? 'not-allowed' : 'pointer',
          opacity: isTransitioning ? 0.5 : 1,
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          if (!isFirstStep && !isTransitioning) {
            e.target.style.backgroundColor = `${COLORS.slainteBlue}10`;
          }
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = isFirstStep ? COLORS.backgroundGray : COLORS.white;
        }}
      >
        <ChevronLeft size={20} />
      </button>

      {/* Progress dots */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '0 8px',
        }}
      >
        {Array.from({ length: totalSteps }).map((_, idx) => (
          <div
            key={idx}
            style={{
              width: idx === currentStep ? '24px' : '8px',
              height: '8px',
              borderRadius: '4px',
              backgroundColor:
                idx === currentStep
                  ? COLORS.slainteBlue
                  : idx < currentStep
                  ? COLORS.incomeColor
                  : COLORS.lightGray,
              transition: 'all 0.3s ease',
            }}
          />
        ))}
      </div>

      {/* Next/Finish button */}
      <button
        onClick={nextStep}
        disabled={isTransitioning}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: isLastStep ? '10px 20px' : '10px 16px',
          backgroundColor: isLastStep ? COLORS.incomeColor : COLORS.slainteBlue,
          border: 'none',
          borderRadius: '20px',
          color: COLORS.white,
          fontSize: '14px',
          fontWeight: '600',
          cursor: isTransitioning ? 'not-allowed' : 'pointer',
          opacity: isTransitioning ? 0.5 : 1,
          transition: 'all 0.2s',
          boxShadow: `0 4px 12px ${isLastStep ? COLORS.incomeColor : COLORS.slainteBlue}40`,
        }}
        onMouseEnter={(e) => {
          if (!isTransitioning) {
            e.target.style.transform = 'scale(1.05)';
          }
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'scale(1)';
        }}
      >
        {isLastStep ? (
          <>
            <Check size={18} />
            Finish Tour
          </>
        ) : (
          <>
            Next
            <ChevronRight size={18} />
          </>
        )}
      </button>
    </div>
  );
};

export default TourControls;

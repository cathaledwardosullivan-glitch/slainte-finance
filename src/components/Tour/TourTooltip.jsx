import React, { useState, useEffect, useCallback } from 'react';
import { useTour } from './TourProvider';
import { COLORS } from '../../utils/colors';
import { Sparkles } from 'lucide-react';

const TourTooltip = () => {
  const { currentStepData, currentStep, totalSteps, isTransitioning } = useTour();
  const [position, setPosition] = useState({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });

  const PADDING = 16;
  const HIGHLIGHT_PADDING = 8;

  const findTargetElement = useCallback(() => {
    if (!currentStepData?.target) return null;
    let element = document.querySelector(`[data-tour-id="${currentStepData.target}"]`);
    if (!element && currentStepData.targetSelector) {
      element = document.querySelector(currentStepData.targetSelector);
    }
    return element;
  }, [currentStepData]);

  const calculatePosition = useCallback(() => {
    const element = findTargetElement();

    // Centered position for steps without a target
    if (!element || !currentStepData?.target || currentStepData.position === 'center') {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        isCentered: true,
      };
    }

    const rect = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;

    // Always position label ABOVE the highlighted element
    let top = rect.top - HIGHLIGHT_PADDING - 12;
    let left = rect.left + rect.width / 2;

    // Keep horizontally on screen
    if (left < PADDING + 80) left = PADDING + 80; // Account for label width
    if (left > viewportWidth - PADDING - 80) left = viewportWidth - PADDING - 80;

    // If there's not enough room above, position below instead
    if (top < PADDING + 40) {
      top = rect.bottom + HIGHLIGHT_PADDING + 12;
      return {
        top: `${top}px`,
        left: `${left}px`,
        transform: 'translate(-50%, 0)',
        isCentered: false,
      };
    }

    return {
      top: `${top}px`,
      left: `${left}px`,
      transform: 'translate(-50%, -100%)',
      isCentered: false,
    };
  }, [findTargetElement, currentStepData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPosition(calculatePosition());
    }, 150);

    return () => clearTimeout(timer);
  }, [currentStepData, calculatePosition]);

  useEffect(() => {
    const handleResize = () => setPosition(calculatePosition());
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [calculatePosition]);

  if (!currentStepData || isTransitioning) return null;

  const { isCentered, ...positionStyles } = position;

  // For centered steps (welcome, complete), show just the title - content is in Finn panel
  // Skip rendering if hideCenterSplash is true (content is only in Finn panel)
  if (isCentered) {
    if (currentStepData.hideCenterSplash) {
      return null; // Don't show center splash, Finn panel has all the content
    }
    return (
      <div
        style={{
          position: 'fixed',
          ...positionStyles,
          backgroundColor: COLORS.white,
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          zIndex: 10002,
          overflow: 'hidden',
          animation: 'tooltipFadeIn 0.3s ease',
          padding: '24px 40px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: `${COLORS.slainteBlue}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
          }}
        >
          <Sparkles size={24} style={{ color: COLORS.slainteBlue }} />
        </div>
        <h2
          style={{
            margin: 0,
            fontSize: '22px',
            fontWeight: '600',
            color: COLORS.textPrimary,
          }}
        >
          {currentStepData.title}
        </h2>

        {/* Inject animation keyframes */}
        <style>
          {`
            @keyframes tooltipFadeIn {
              from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
              to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            }
          `}
        </style>
      </div>
    );
  }

  // For element-targeted steps, show a minimal label
  return (
    <div
      style={{
        position: 'fixed',
        ...positionStyles,
        backgroundColor: COLORS.slainteBlue,
        color: COLORS.white,
        padding: '8px 16px',
        borderRadius: '20px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
        zIndex: 10002,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        animation: 'labelFadeIn 0.3s ease',
        whiteSpace: 'nowrap',
      }}
    >
      {/* Step number */}
      <div
        style={{
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          backgroundColor: 'rgba(255,255,255,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: '600',
        }}
      >
        {currentStep + 1}
      </div>

      {/* Title */}
      <span style={{ fontSize: '14px', fontWeight: '500' }}>
        {currentStepData.title}
      </span>

      {/* Inject animation keyframes */}
      <style>
        {`
          @keyframes labelFadeIn {
            from { opacity: 0; transform: ${positionStyles.transform} scale(0.9); }
            to { opacity: 1; transform: ${positionStyles.transform} scale(1); }
          }
        `}
      </style>
    </div>
  );
};

export default TourTooltip;

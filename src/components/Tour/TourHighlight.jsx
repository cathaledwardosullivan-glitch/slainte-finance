import React, { useState, useEffect, useCallback } from 'react';
import { useTour } from './TourProvider';
import { COLORS } from '../../utils/colors';

const TourHighlight = () => {
  const { currentStepData, isTransitioning } = useTour();
  const [targetRect, setTargetRect] = useState(null);

  const findTargetElement = useCallback(() => {
    if (!currentStepData?.target) return null;

    // Try data-tour-id first
    let element = document.querySelector(`[data-tour-id="${currentStepData.target}"]`);

    // Fallback to CSS selector if provided
    if (!element && currentStepData.targetSelector) {
      element = document.querySelector(currentStepData.targetSelector);
    }

    return element;
  }, [currentStepData]);

  const updatePosition = useCallback(() => {
    const element = findTargetElement();
    if (element) {
      const rect = element.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    } else {
      setTargetRect(null);
    }
  }, [findTargetElement]);

  // Scroll element into view and update position on step change
  useEffect(() => {
    // Small delay to allow page transitions to complete
    const timer = setTimeout(() => {
      const element = findTargetElement();
      if (element) {
        // Scroll the element into view, centered vertically
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });

        // Update position after scroll completes
        setTimeout(() => {
          updatePosition();
        }, 400);
      } else {
        updatePosition();
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [currentStepData, updatePosition, findTargetElement]);

  // Update position on window resize/scroll
  useEffect(() => {
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [updatePosition]);

  // Re-check position periodically in case of dynamic content
  useEffect(() => {
    const interval = setInterval(updatePosition, 500);
    return () => clearInterval(interval);
  }, [updatePosition]);

  // Don't render if no target or centered step
  if (!currentStepData?.target || !targetRect || isTransitioning) {
    return null;
  }

  const padding = 8; // Padding around the highlighted element

  return (
    <>
      {/* Clear cutout in the overlay - using box-shadow technique */}
      <div
        style={{
          position: 'fixed',
          top: targetRect.top - padding,
          left: targetRect.left - padding,
          width: targetRect.width + padding * 2,
          height: targetRect.height + padding * 2,
          zIndex: 10001,
          pointerEvents: 'none',
          borderRadius: '8px',
          // Create a "hole" effect using box-shadow
          boxShadow: `
            0 0 0 4px ${COLORS.slainteBlue},
            0 0 0 9999px rgba(0, 0, 0, 0.5)
          `,
          transition: 'all 0.3s ease',
        }}
      />

      {/* Glowing border effect */}
      <div
        style={{
          position: 'fixed',
          top: targetRect.top - padding,
          left: targetRect.left - padding,
          width: targetRect.width + padding * 2,
          height: targetRect.height + padding * 2,
          zIndex: 10002,
          pointerEvents: 'none',
          borderRadius: '8px',
          border: `3px solid ${COLORS.slainteBlue}`,
          boxShadow: `
            0 0 20px ${COLORS.slainteBlue}80,
            inset 0 0 20px ${COLORS.slainteBlue}20
          `,
          animation: 'tourPulse 2s ease-in-out infinite',
          transition: 'all 0.3s ease',
        }}
      />

      {/* Inject keyframes for pulse animation */}
      <style>
        {`
          @keyframes tourPulse {
            0%, 100% {
              box-shadow: 0 0 20px ${COLORS.slainteBlue}80, inset 0 0 20px ${COLORS.slainteBlue}20;
            }
            50% {
              box-shadow: 0 0 30px ${COLORS.slainteBlue}A0, inset 0 0 30px ${COLORS.slainteBlue}30;
            }
          }
        `}
      </style>
    </>
  );
};

export default TourHighlight;

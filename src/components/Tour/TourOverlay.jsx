import React from 'react';
import COLORS from '../../utils/colors';
import { useTour } from './TourProvider';
import TourHighlight from './TourHighlight';
import TourTooltip from './TourTooltip';

const TourOverlay = () => {
  const { isActive, isTransitioning } = useTour();

  if (!isActive) return null;

  return (
    <>
      {/* Dark overlay that blocks interaction */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: COLORS.overlayDark,
          zIndex: 10000,
          pointerEvents: 'auto',
          opacity: isTransitioning ? 0.3 : 1,
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Highlight around target element */}
      <TourHighlight />

      {/* Simple label tooltip near the highlighted element */}
      <TourTooltip />

      {/* Navigation controls are now integrated into FloatingFinancialChat (real Cara) */}
    </>
  );
};

export default TourOverlay;

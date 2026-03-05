import React from 'react';
import { useFinn } from '../../context/FinnContext';
import { MessageSquare } from 'lucide-react';
import COLORS from '../../utils/colors';
import FeedbackModal from './FeedbackModal';

/**
 * FloatingFeedbackButton - Fixed-position button in bottom-left corner
 * Opens the FeedbackModal via FinnContext.
 * Also renders FeedbackModal here so it's always mounted,
 * regardless of whether the Finn widget is open or closed.
 */
const FloatingFeedbackButton = () => {
  const { openFeedback } = useFinn();

  return (
    <>
      <button
        onClick={() => openFeedback()}
        title="Send Feedback"
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          left: '1.5rem',
          zIndex: 40,
          backgroundColor: COLORS.mediumGray,
          color: COLORS.white,
          borderRadius: '9999px',
          height: '56px',
          padding: '0 1rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          transition: 'all 0.2s ease',
          fontSize: '0.8125rem',
          fontWeight: 500
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = COLORS.darkGray;
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = COLORS.mediumGray;
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <MessageSquare style={{ height: '1rem', width: '1rem' }} />
        Send Feedback
      </button>

      {/* FeedbackModal rendered here so it's always available,
          even when the Finn widget is collapsed */}
      <FeedbackModal />
    </>
  );
};

export default FloatingFeedbackButton;

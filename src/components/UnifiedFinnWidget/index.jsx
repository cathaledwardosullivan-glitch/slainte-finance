import React, { useEffect } from 'react';
import { useFinn } from '../../context/FinnContext';
import { useTour } from '../Tour';
import FinnChatPanel from './FinnChatPanel';
import FinnTourMode from './FinnTourMode';
import { MessageCircle, X, Minus } from 'lucide-react';
import COLORS from '../../utils/colors';

/**
 * UnifiedFinnWidget - The main floating Finn assistant widget
 * Combines functionality from Cara (quick support) and Finn (financial consultation)
 */
const UnifiedFinnWidget = ({ currentView = 'dashboard' }) => {
  const {
    isOpen,
    openWidget,
    closeWidget,
    backgroundTask,
    hasData,
    setCurrentView,
    localOnlyMode
  } = useFinn();

  const { isActive: isTourActive, currentStepData } = useTour();

  // Sync the current view/page with FinnContext so Finn knows what the user is looking at
  useEffect(() => {
    setCurrentView(currentView);
  }, [currentView, setCurrentView]);

  // Show tour mode when tour is active
  if (isTourActive && currentStepData) {
    return <FinnTourMode />;
  }

  // Collapsed pill state
  if (!isOpen) {
    return (
      <div
        style={{
          position: 'fixed',
          top: '5rem',
          left: '1.5rem',
          zIndex: 50
        }}
        data-tour-id="finn-button"
      >
        <button
          onClick={openWidget}
          style={{
            backgroundColor: COLORS.slainteBlue,
            color: COLORS.white,
            borderRadius: '9999px',
            padding: '0.5rem 1rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            border: 'none',
            cursor: 'pointer',
            position: 'relative'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = COLORS.slainteBlueDark;
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = COLORS.slainteBlue;
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <MessageCircle style={{ height: '1.5rem', width: '1.5rem' }} />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Finn</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
              {localOnlyMode ? 'Local Only' : 'Financial Advisor'}
            </div>
          </div>

          {/* Badge for background task */}
          {backgroundTask?.status === 'running' && (
            <div
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                width: '12px',
                height: '12px',
                backgroundColor: COLORS.highlightYellow,
                borderRadius: '50%',
                border: '2px solid white',
                animation: 'pulse 2s infinite'
              }}
            />
          )}
        </button>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
      </div>
    );
  }

  // Expanded widget
  return (
    <div
      style={{
        position: 'fixed',
        top: '5rem',
        left: '1.5rem',
        bottom: '5.5rem', // Leave space for floating feedback button below
        zIndex: 50,
        backgroundColor: COLORS.white,
        borderRadius: '0.75rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: `1px solid ${COLORS.borderLight}`,
        width: 'min(400px, calc(100vw - 3rem))', // Match Tasks Widget width
        maxHeight: 'calc(100vh - 7rem)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
      data-tour-id="finn-widget"
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: COLORS.slainteBlue,
          color: COLORS.white,
          padding: '0.875rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '2rem',
              height: '2rem',
              backgroundColor: COLORS.slainteBlueDark,
              borderRadius: '9999px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <MessageCircle style={{ height: '1rem', width: '1rem' }} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Finn</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {localOnlyMode ? (
                <>
                  <span style={{
                    backgroundColor: 'rgba(255,255,255,0.25)',
                    padding: '0.1rem 0.4rem',
                    borderRadius: '0.25rem',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    letterSpacing: '0.03em'
                  }}>LOCAL ONLY</span>
                </>
              ) : 'Financial Advisor'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {/* Minimize button */}
          <button
            onClick={closeWidget}
            title="Minimize"
            style={{
              color: COLORS.white,
              padding: '0.375rem',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              borderRadius: '0.375rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Minus style={{ height: '1.125rem', width: '1.125rem' }} />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <FinnChatPanel currentView={currentView} />
      </div>

    </div>
  );
};

export default UnifiedFinnWidget;

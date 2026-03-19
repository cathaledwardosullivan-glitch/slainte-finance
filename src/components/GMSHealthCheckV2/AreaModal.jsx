import React, { useEffect, useState } from 'react';
import { X, MessageCircle } from 'lucide-react';
import COLORS from '../../utils/colors';
import AreaDetailPanel from './AreaDetailPanel';
import AreaConversation from './AreaConversation';
import { AREA_COLORS, CARD_TITLES } from './AreaCard';

/**
 * AreaModal - Full-screen modal for a GMS area's data/analysis/actions.
 * Includes an "Ask Finn" toggle that opens a conversation side panel.
 */
const AreaModal = ({
  areaId,
  readiness,
  analysis,
  recommendations,
  healthCheckData,
  paymentAnalysisData,
  onUpdate,
  onClose
}) => {
  const [showConversation, setShowConversation] = useState(true);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  const accentColor = AREA_COLORS[areaId] || COLORS.slainteBlue;
  const title = CARD_TITLES[areaId] || areaId;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: COLORS.overlayMedium || 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '2rem'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: COLORS.white,
          borderRadius: '1rem',
          width: '100%',
          maxWidth: showConversation ? '1280px' : '900px',
          maxHeight: '85vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          transition: 'max-width 0.3s ease'
        }}
      >
        {/* Header with area color bar */}
        <div style={{
          background: accentColor,
          padding: '1rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'white' }}>
            {title}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Ask Finn toggle */}
            <button
              onClick={() => setShowConversation(!showConversation)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '9999px',
                border: 'none',
                background: showConversation ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)',
                color: 'white',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.35)'}
              onMouseLeave={(e) => e.currentTarget.style.background = showConversation ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)'}
            >
              <MessageCircle size={14} />
              Ask Finn
            </button>
            {/* Close */}
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '50%',
                width: '2rem',
                height: '2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'white'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content area: detail panel + optional conversation */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Main content (scrollable) */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            <AreaDetailPanel
              areaId={areaId}
              readiness={readiness}
              analysis={analysis}
              recommendations={recommendations}
              healthCheckData={healthCheckData}
              paymentAnalysisData={paymentAnalysisData}
              onUpdate={onUpdate}
            />
          </div>

          {/* Conversation side panel */}
          {showConversation && (
            <AreaConversation
              areaId={areaId}
              analysis={analysis}
              readiness={readiness}
              recommendations={recommendations}
              onClose={() => setShowConversation(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AreaModal;

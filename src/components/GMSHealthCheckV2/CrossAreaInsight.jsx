import React from 'react';
import { Sparkles, X } from 'lucide-react';
import COLORS from '../../utils/colors';

/**
 * CrossAreaInsight - A subtle card displaying an AI-generated cross-area insight.
 * Shown between area cards when Finn spots connections across GMS areas.
 */
const CrossAreaInsight = ({ insight, onDismiss }) => {
  if (!insight) return null;

  return (
    <div style={{
      gridColumn: '1 / -1',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.75rem 1rem',
      backgroundColor: `${COLORS.slainteBlue}08`,
      border: `1px solid ${COLORS.slainteBlue}20`,
      borderRadius: '0.5rem'
    }}>
      <Sparkles size={14} style={{ color: COLORS.slainteBlue, flexShrink: 0 }} />
      <span style={{
        flex: 1,
        fontSize: '0.8rem',
        color: COLORS.textPrimary,
        fontStyle: 'italic',
        lineHeight: 1.4
      }}>
        {insight}
      </span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: COLORS.textSecondary,
            padding: '0.15rem',
            flexShrink: 0,
            display: 'flex'
          }}
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
};

export default CrossAreaInsight;

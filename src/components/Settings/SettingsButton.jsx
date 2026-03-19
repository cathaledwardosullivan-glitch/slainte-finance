import React from 'react';
import { Settings } from 'lucide-react';
import COLORS from '../../utils/colors';

/**
 * SettingsButton - Fixed-position gear icon button
 * Positioned in bottom-right corner, triggers Settings Modal
 */
const SettingsButton = ({ onClick }) => {
  return (
    <button
      data-tour-id="settings-button"
      onClick={onClick}
      title="Settings"
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 40,
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        backgroundColor: COLORS.textSecondary,
        color: COLORS.white,
        border: 'none',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = COLORS.textPrimary;
        e.currentTarget.style.transform = 'scale(1.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = COLORS.textSecondary;
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      <Settings style={{ width: '24px', height: '24px' }} />
    </button>
  );
};

export default SettingsButton;

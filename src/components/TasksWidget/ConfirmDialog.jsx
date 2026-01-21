import React from 'react';
import { AlertTriangle } from 'lucide-react';
import COLORS from '../../utils/colors';

/**
 * ConfirmDialog - Custom confirmation dialog to replace window.confirm()
 * Provides a styled modal with customizable title and message
 */
const ConfirmDialog = ({
  isOpen,
  onConfirm,
  onCancel,
  title = '',
  message = 'Are you sure?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmStyle = 'danger' // 'danger' or 'primary'
}) => {
  if (!isOpen) return null;

  const confirmButtonStyle = confirmStyle === 'danger'
    ? { backgroundColor: COLORS.expenseColor, color: COLORS.white }
    : { backgroundColor: COLORS.slainteBlue, color: COLORS.white };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        backgroundColor: 'rgba(0, 0, 0, 0.5)'
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: COLORS.white,
          borderRadius: '0.75rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          width: '100%',
          maxWidth: '24rem',
          border: `1px solid ${COLORS.lightGray}`,
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {title && (
          <div
            style={{
              padding: '1rem 1.25rem',
              borderBottom: `1px solid ${COLORS.lightGray}`,
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}
          >
            <AlertTriangle
              style={{
                width: '1.25rem',
                height: '1.25rem',
                color: confirmStyle === 'danger' ? COLORS.expenseColor : COLORS.slainteBlue
              }}
            />
            <h3
              style={{
                fontWeight: 600,
                fontSize: '1rem',
                color: COLORS.darkGray,
                margin: 0
              }}
            >
              {title}
            </h3>
          </div>
        )}

        {/* Body */}
        <div style={{ padding: '1.25rem' }}>
          <p
            style={{
              color: COLORS.darkGray,
              fontSize: '0.9375rem',
              lineHeight: 1.5,
              margin: 0
            }}
          >
            {message}
          </p>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderTop: `1px solid ${COLORS.lightGray}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem'
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: `1px solid ${COLORS.lightGray}`,
              backgroundColor: COLORS.white,
              color: COLORS.darkGray,
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background-color 0.15s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.backgroundGray}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.white}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'opacity 0.15s',
              ...confirmButtonStyle
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;

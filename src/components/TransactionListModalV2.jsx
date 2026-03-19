import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import COLORS from '../utils/colors';
import TransactionListV2 from './TransactionListV2';

/**
 * TransactionListModalV2 - Full-screen modal wrapper for the redesigned TransactionListV2
 * Drop-in replacement for TransactionListModal with identical props interface
 */
const TransactionListModalV2 = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: COLORS.overlayDark,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: COLORS.bgPage,
          borderRadius: '16px',
          width: '100%',
          maxWidth: '1400px',
          height: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.5rem',
            backgroundColor: COLORS.white,
            borderBottom: `1px solid ${COLORS.borderLight}`,
            flexShrink: 0
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: COLORS.textPrimary }}>
            Manage Transactions
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              padding: '0.5rem',
              cursor: 'pointer',
              borderRadius: '0.375rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.bgPage}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X style={{ width: '1.25rem', height: '1.25rem', color: COLORS.textSecondary }} />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '1.5rem'
          }}
        >
          <TransactionListV2 />
        </div>
      </div>
    </div>
  );
};

export default TransactionListModalV2;

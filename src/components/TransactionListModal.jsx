import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import COLORS from '../utils/colors';
import TransactionList from './TransactionList';

/**
 * TransactionListModal - Full-screen modal wrapper for TransactionList
 * Used in Finances Overview to manage transactions without leaving the page
 */
const TransactionListModal = ({ isOpen, onClose }) => {
  // Handle escape key to close
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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
          backgroundColor: COLORS.backgroundGray,
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
            borderBottom: `1px solid ${COLORS.lightGray}`,
            flexShrink: 0
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: COLORS.darkGray }}>
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
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.backgroundGray}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X style={{ width: '1.25rem', height: '1.25rem', color: COLORS.mediumGray }} />
          </button>
        </div>

        {/* Content - TransactionList */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '1.5rem'
          }}
        >
          <TransactionList />
        </div>
      </div>
    </div>
  );
};

export default TransactionListModal;

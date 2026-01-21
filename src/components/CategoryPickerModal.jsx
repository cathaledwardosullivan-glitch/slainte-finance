import React from 'react';
import { X } from 'lucide-react';
import COLORS from '../utils/colors';
import SimpleCategoryPicker from './SimpleCategoryPicker';

/**
 * CategoryPickerModal
 *
 * Modal wrapper for SimpleCategoryPicker that can be used anywhere in the app
 * for manual transaction categorization.
 */
export default function CategoryPickerModal({
  isOpen,
  onClose,
  transaction,
  onCategorySelect,
  categoryMapping
}) {
  if (!isOpen) return null;

  const handleSelect = (categoryCode) => {
    onCategorySelect(categoryCode);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
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
          backgroundColor: COLORS.white,
          borderRadius: '16px',
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.5rem',
            borderBottom: `2px solid ${COLORS.lightGray}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            backgroundColor: COLORS.white,
            zIndex: 1
          }}
        >
          <h2
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: COLORS.darkGray,
              margin: 0
            }}
          >
            Categorize Transaction
          </h2>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: COLORS.backgroundGray,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = COLORS.lightGray;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = COLORS.backgroundGray;
            }}
          >
            <X style={{ width: '18px', height: '18px', color: COLORS.mediumGray }} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          <SimpleCategoryPicker
            transaction={transaction}
            onCategorySelect={handleSelect}
            categoryMapping={categoryMapping}
            showStaffMembers={true}
          />
        </div>
      </div>
    </div>
  );
}

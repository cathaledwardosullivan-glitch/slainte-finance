import React, { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import COLORS from '../../utils/colors';

/**
 * DeleteConfirmDialog — Modal confirmation before deleting a report.
 */
const DeleteConfirmDialog = ({ title, onConfirm, onCancel }) => {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onCancel(); }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '2rem'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: COLORS.white,
          borderRadius: '0.75rem',
          width: '100%',
          maxWidth: '400px',
          padding: '1.5rem',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '2.5rem',
            height: '2.5rem',
            borderRadius: '50%',
            backgroundColor: `${COLORS.expenseColor}12`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <AlertTriangle style={{ width: '1.25rem', height: '1.25rem', color: COLORS.expenseColor }} />
          </div>
          <div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: COLORS.textPrimary }}>
              Delete Report
            </div>
            <div style={{ fontSize: '0.8125rem', color: COLORS.textSecondary, marginTop: '0.125rem' }}>
              This cannot be undone.
            </div>
          </div>
        </div>

        <div style={{
          fontSize: '0.8125rem',
          color: COLORS.textPrimary,
          lineHeight: 1.5,
          padding: '0.75rem',
          backgroundColor: COLORS.bgPage,
          borderRadius: '0.375rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {title}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: `1px solid ${COLORS.borderLight}`,
              backgroundColor: COLORS.white,
              color: COLORS.textPrimary,
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: 'none',
              backgroundColor: COLORS.expenseColor,
              color: COLORS.white,
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmDialog;

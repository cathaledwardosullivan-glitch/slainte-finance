import React, { useState } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { Brain, Activity, RefreshCw, CheckCircle } from 'lucide-react';
import COLORS from '../../../utils/colors';
import AIIdentifierSuggestions from '../../AIIdentifierSuggestions';
import AIExpenseCategorization from '../../AIExpenseCategorization';

/**
 * LegacyToolsSection - AI Tools and Re-apply Categories
 * These tools are from the old version and may be removed later
 */
const LegacyToolsSection = () => {
  const {
    unidentifiedTransactions,
    reapplyCategories
  } = useAppContext();

  // AI Tools state
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [showExpenseCategorization, setShowExpenseCategorization] = useState(false);

  // Re-categorization state
  const [recategorizeResult, setRecategorizeResult] = useState(null);
  const [isRecategorizing, setIsRecategorizing] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Info banner */}
      <div style={{ padding: '1rem', borderRadius: '0.5rem', backgroundColor: COLORS.warningLight, border: `1px solid ${COLORS.warning}` }}>
        <p style={{ fontSize: '0.875rem', color: COLORS.warningText }}>
          <strong>Note:</strong> These tools are from an earlier version of the app. They may be removed in a future update as new features are developed.
        </p>
      </div>

      {/* AI Tools */}
      <div style={{ backgroundColor: COLORS.white, padding: '1.5rem', borderRadius: '0.5rem', border: `1px solid ${COLORS.borderLight}` }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: COLORS.textPrimary, marginBottom: '1rem' }}>
          AI Categorization Tools
        </h3>
        <p style={{ fontSize: '0.875rem', color: COLORS.textSecondary, marginBottom: '1.5rem' }}>
          Use AI to help categorize your unidentified transactions.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          {/* AI Staff Suggestions */}
          <div style={{
            padding: '1.25rem',
            border: `2px solid ${COLORS.slainteBlue}`,
            borderRadius: '0.5rem',
            backgroundColor: COLORS.infoLighter,
            opacity: unidentifiedTransactions.length > 0 ? 1 : 0.6
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ padding: '0.5rem', borderRadius: '0.5rem', backgroundColor: COLORS.white }}>
                <Brain style={{ height: '1.25rem', width: '1.25rem', color: COLORS.slainteBlue }} />
              </div>
              <h4 style={{ fontWeight: 600, color: COLORS.slainteBlue }}>AI Staff Suggestions</h4>
            </div>
            <p style={{ fontSize: '0.875rem', color: COLORS.textPrimary, marginBottom: '1rem' }}>
              Automatically identify and categorize staff-related payments. Best for detecting salaries, wages, and regular staff expenses.
            </p>
            {unidentifiedTransactions.length === 0 && (
              <p style={{ fontSize: '0.75rem', color: COLORS.textSecondary, marginBottom: '0.75rem' }}>
                No unidentified transactions to analyze.
              </p>
            )}
            <button
              onClick={() => setShowAISuggestions(true)}
              disabled={unidentifiedTransactions.length === 0}
              style={{
                width: '100%',
                padding: '0.625rem 1rem',
                borderRadius: '0.375rem',
                fontWeight: 500,
                color: COLORS.white,
                backgroundColor: COLORS.slainteBlue,
                border: 'none',
                cursor: unidentifiedTransactions.length === 0 ? 'not-allowed' : 'pointer',
                opacity: unidentifiedTransactions.length === 0 ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <Brain style={{ height: '1rem', width: '1rem' }} />
              Analyze Staff Payments
            </button>
          </div>

          {/* AI Expense Patterns */}
          <div style={{
            padding: '1.25rem',
            border: `2px solid ${COLORS.highlightYellow}`,
            borderRadius: '0.5rem',
            backgroundColor: COLORS.warningLight,
            opacity: unidentifiedTransactions.length > 0 ? 1 : 0.6
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ padding: '0.5rem', borderRadius: '0.5rem', backgroundColor: COLORS.white }}>
                <Activity style={{ height: '1.25rem', width: '1.25rem', color: COLORS.warningDark }} />
              </div>
              <h4 style={{ fontWeight: 600, color: COLORS.textPrimary }}>AI Expense Patterns</h4>
            </div>
            <p style={{ fontSize: '0.875rem', color: COLORS.textPrimary, marginBottom: '1rem' }}>
              Identify common expense patterns and suggest appropriate categories. Helps with utilities, supplies, and recurring expenses.
            </p>
            {unidentifiedTransactions.length === 0 && (
              <p style={{ fontSize: '0.75rem', color: COLORS.textSecondary, marginBottom: '0.75rem' }}>
                No unidentified transactions to analyze.
              </p>
            )}
            <button
              onClick={() => setShowExpenseCategorization(true)}
              disabled={unidentifiedTransactions.length === 0}
              style={{
                width: '100%',
                padding: '0.625rem 1rem',
                borderRadius: '0.375rem',
                fontWeight: 500,
                color: COLORS.slainteBlue,
                backgroundColor: 'transparent',
                border: `2px solid ${COLORS.slainteBlue}`,
                cursor: unidentifiedTransactions.length === 0 ? 'not-allowed' : 'pointer',
                opacity: unidentifiedTransactions.length === 0 ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <Activity style={{ height: '1rem', width: '1rem' }} />
              Analyze Expense Patterns
            </button>
          </div>
        </div>
      </div>

      {/* Re-apply Categories */}
      <div style={{ backgroundColor: COLORS.white, padding: '1.5rem', borderRadius: '0.5rem', border: `1px solid ${COLORS.borderLight}` }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: COLORS.textPrimary, marginBottom: '1rem' }}>
          Re-apply Categories
        </h3>

        <div style={{ padding: '1.25rem', border: `2px solid ${COLORS.chartViolet}`, borderRadius: '0.5rem', backgroundColor: COLORS.accentPurpleLight }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ padding: '0.5rem', borderRadius: '0.5rem', backgroundColor: COLORS.white }}>
              <RefreshCw style={{ height: '1.25rem', width: '1.25rem', color: COLORS.chartViolet }} />
            </div>
            <h4 style={{ fontWeight: 600, color: COLORS.chartViolet }}>Re-apply Categories</h4>
          </div>
          <p style={{ fontSize: '0.875rem', color: COLORS.textPrimary, marginBottom: '1rem' }}>
            Re-categorize all transactions based on current identifier mappings. Use this after moving identifiers between subcategories.
          </p>
          {recategorizeResult && (
            <div style={{ marginBottom: '0.75rem', padding: '0.5rem', borderRadius: '0.25rem', fontSize: '0.875rem', backgroundColor: COLORS.white }}>
              <CheckCircle style={{ height: '1rem', width: '1rem', display: 'inline', marginRight: '0.25rem', verticalAlign: 'middle', color: COLORS.incomeColor }} />
              {recategorizeResult.updated > 0
                ? `Updated ${recategorizeResult.updated} transaction${recategorizeResult.updated !== 1 ? 's' : ''}`
                : 'All transactions are correctly categorized'}
            </div>
          )}
          <button
            onClick={() => {
              setIsRecategorizing(true);
              setRecategorizeResult(null);
              setTimeout(() => {
                const result = reapplyCategories();
                setRecategorizeResult(result);
                setIsRecategorizing(false);
              }, 100);
            }}
            disabled={isRecategorizing}
            style={{
              padding: '0.625rem 1rem',
              borderRadius: '0.375rem',
              fontWeight: 500,
              color: COLORS.white,
              backgroundColor: COLORS.chartViolet,
              border: 'none',
              cursor: isRecategorizing ? 'not-allowed' : 'pointer',
              opacity: isRecategorizing ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <RefreshCw style={{ height: '1rem', width: '1rem', animation: isRecategorizing ? 'spin 1s linear infinite' : 'none' }} />
            {isRecategorizing ? 'Re-applying...' : 'Re-apply Categories'}
          </button>
        </div>
      </div>

      {/* AI Tools Modals */}
      {showAISuggestions && (
        <AIIdentifierSuggestions onClose={() => setShowAISuggestions(false)} />
      )}
      {showExpenseCategorization && (
        <AIExpenseCategorization onClose={() => setShowExpenseCategorization(false)} />
      )}

      {/* CSS Animation for spinner */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LegacyToolsSection;

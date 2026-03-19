import React, { useState, useEffect } from 'react';
import { useFinn } from '../../context/FinnContext';
import { usePracticeProfile } from '../../hooks/usePracticeProfile';
import { X, Send, ChevronDown, ChevronUp, MessageSquare, AlertCircle, CheckCircle2 } from 'lucide-react';
import COLORS from '../../utils/colors';

const CATEGORIES = [
  { value: 'bug', label: 'Bug Report', description: 'Something isn\'t working correctly' },
  { value: 'feature', label: 'Feature Request', description: 'Suggest an improvement or new feature' },
  { value: 'question', label: 'Question', description: 'Need help understanding something' },
  { value: 'general', label: 'General Feedback', description: 'Praise, thoughts, or other feedback' }
];

/**
 * FeedbackModal - Modal overlay for composing and sending beta feedback
 * Can be opened from Finn chat escalation (pre-filled) or footer link (empty)
 */
const FeedbackModal = () => {
  const { feedbackModalOpen, feedbackPreFill, closeFeedback, submitFeedback, localOnlyMode } = useFinn();
  const { profile } = usePracticeProfile();

  const [category, setCategory] = useState('bug');
  const [description, setDescription] = useState('');
  const [contextExpanded, setContextExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [savedLocally, setSavedLocally] = useState(false);

  // Pre-fill from chat escalation when modal opens
  useEffect(() => {
    if (feedbackModalOpen) {
      setError(null);
      setSavedLocally(false);
      setSubmitting(false);
      if (feedbackPreFill) {
        setDescription(feedbackPreFill.summary || '');
        setCategory(feedbackPreFill.category || 'bug');
      } else {
        setDescription('');
        setCategory('bug');
      }
      setContextExpanded(false);
    }
  }, [feedbackModalOpen, feedbackPreFill]);

  if (!feedbackModalOpen) return null;

  const practiceId = profile?.metadata?.practiceId || '';

  const handleSubmit = async () => {
    if (!description.trim()) return;

    setSubmitting(true);
    setError(null);

    const feedbackData = {
      category: CATEGORIES.find(c => c.value === category)?.label || category,
      description: description.trim(),
      finnSummary: feedbackPreFill?.summary || ''
    };

    const result = await submitFeedback(feedbackData);

    if (!result.success) {
      setError(result.error || 'Failed to send feedback');
      setSavedLocally(!!result.savedLocally);
      setSubmitting(false);
    }
    // On success, submitFeedback calls closeFeedback() internally
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: COLORS.overlayDark,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeFeedback();
      }}
    >
      <div
        style={{
          backgroundColor: COLORS.white,
          borderRadius: '0.75rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxWidth: '480px',
          width: '100%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '1rem 1.25rem',
          borderBottom: `1px solid ${COLORS.borderLight}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '2.25rem',
              height: '2.25rem',
              backgroundColor: `${COLORS.slainteBlue}15`,
              borderRadius: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <MessageSquare style={{ height: '1.125rem', width: '1.125rem', color: COLORS.slainteBlue }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: COLORS.textPrimary }}>
                Send Feedback
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: COLORS.textSecondary }}>
                Help us improve Sláinte Finance
              </p>
            </div>
          </div>
          <button
            onClick={closeFeedback}
            style={{
              padding: '0.375rem',
              background: 'none',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              color: COLORS.textSecondary,
              display: 'flex'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.bgPage}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X style={{ height: '1.125rem', width: '1.125rem' }} />
          </button>
        </div>

        {/* Body */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.25rem'
        }}>
          {/* Category selection */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: COLORS.textPrimary, marginBottom: '0.5rem' }}>
              Category
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.5rem',
                    border: `1.5px solid ${category === cat.value ? COLORS.slainteBlue : COLORS.borderLight}`,
                    backgroundColor: category === cat.value ? `${COLORS.slainteBlue}10` : COLORS.white,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (category !== cat.value) e.currentTarget.style.borderColor = COLORS.textSecondary;
                  }}
                  onMouseLeave={(e) => {
                    if (category !== cat.value) e.currentTarget.style.borderColor = COLORS.borderLight;
                  }}
                >
                  <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: category === cat.value ? COLORS.slainteBlue : COLORS.textPrimary }}>
                    {cat.label}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: COLORS.textSecondary, marginTop: '0.125rem' }}>
                    {cat.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: COLORS.textPrimary, marginBottom: '0.5rem' }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell us what's on your mind..."
              rows={5}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                border: `1px solid ${COLORS.borderLight}`,
                fontSize: '0.875rem',
                lineHeight: '1.5',
                color: COLORS.textPrimary,
                resize: 'vertical',
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = COLORS.slainteBlue}
              onBlur={(e) => e.currentTarget.style.borderColor = COLORS.borderLight}
            />
          </div>

          {/* Context panel */}
          <div style={{
            border: `1px solid ${COLORS.borderLight}`,
            borderRadius: '0.5rem',
            overflow: 'hidden'
          }}>
            <button
              onClick={() => setContextExpanded(!contextExpanded)}
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                backgroundColor: COLORS.bgPage,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.75rem',
                fontWeight: 500,
                color: COLORS.textSecondary
              }}
            >
              <span>This information will also be included</span>
              {contextExpanded
                ? <ChevronUp style={{ height: '0.875rem', width: '0.875rem' }} />
                : <ChevronDown style={{ height: '0.875rem', width: '0.875rem' }} />
              }
            </button>
            {contextExpanded && (
              <div style={{
                padding: '0.625rem 0.75rem',
                fontSize: '0.75rem',
                color: COLORS.textSecondary,
                lineHeight: '1.6'
              }}>
                {practiceId && <div>Your Practice ID ({practiceId})</div>}
                <div>App version (from package.json)</div>
                <div>Operating system</div>
                <div>Current page/view</div>
                <div>Transaction & category counts (numbers only)</div>
                {feedbackPreFill?.summary && <div>Finn's conversation summary</div>}
                <div style={{ marginTop: '0.5rem', fontStyle: 'italic', fontSize: '0.6875rem' }}>
                  No financial data, transaction details, or API keys are ever included.
                </div>
              </div>
            )}
          </div>

          {/* Local Only Mode notice */}
          {localOnlyMode && (
            <div style={{
              marginTop: '0.75rem',
              padding: '0.625rem 0.75rem',
              backgroundColor: `${COLORS.highlightYellow}15`,
              border: `1px solid ${COLORS.highlightYellow}40`,
              borderRadius: '0.5rem',
              fontSize: '0.75rem',
              color: COLORS.textPrimary
            }}>
              <strong>Local Only Mode is active.</strong> Feedback will be saved locally.
              To deliver it to the Sláinte team, temporarily disable Local Only Mode or email the saved file.
            </div>
          )}

          {/* Error message */}
          {error && (
            <div style={{
              marginTop: '0.75rem',
              padding: '0.625rem 0.75rem',
              backgroundColor: `${COLORS.expenseColor}10`,
              border: `1px solid ${COLORS.expenseColor}30`,
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              color: COLORS.textPrimary
            }}>
              <AlertCircle style={{ height: '1rem', width: '1rem', color: COLORS.expenseColor, flexShrink: 0, marginTop: '0.0625rem' }} />
              <div>
                <div>{error}</div>
                {savedLocally && (
                  <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: COLORS.textSecondary }}>
                    <CheckCircle2 style={{ height: '0.75rem', width: '0.75rem', display: 'inline', verticalAlign: 'middle' }} /> Your feedback was saved locally as a backup.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '0.875rem 1.25rem',
          borderTop: `1px solid ${COLORS.borderLight}`,
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.5rem',
          flexShrink: 0
        }}>
          <button
            onClick={closeFeedback}
            disabled={submitting}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: COLORS.white,
              border: `1px solid ${COLORS.borderLight}`,
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: COLORS.textPrimary,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.5 : 1
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!description.trim() || submitting}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: !description.trim() || submitting ? COLORS.textSecondary : COLORS.slainteBlue,
              color: COLORS.white,
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: !description.trim() || submitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onMouseEnter={(e) => {
              if (description.trim() && !submitting) e.currentTarget.style.backgroundColor = COLORS.slainteBlueDark;
            }}
            onMouseLeave={(e) => {
              if (description.trim() && !submitting) e.currentTarget.style.backgroundColor = COLORS.slainteBlue;
            }}
          >
            {submitting ? (
              <>
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', width: '0.875rem', height: '0.875rem', border: '2px solid transparent', borderTopColor: COLORS.white, borderRadius: '50%' }} />
                Sending...
              </>
            ) : (
              <>
                <Send style={{ height: '0.875rem', width: '0.875rem' }} />
                Send to Sláinte Team
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default FeedbackModal;

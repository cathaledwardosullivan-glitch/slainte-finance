import React, { useState, useEffect, useCallback } from 'react';
import { ThumbsUp, ThumbsDown, Send, Check } from 'lucide-react';
import { get as getProfile } from '../../storage/practiceProfileStorage';
import COLORS from '../../utils/colors';

const POSITIVE_TAGS = ['Actionable', 'Good analysis', 'Will share', 'Learned something'];
const NEGATIVE_TAGS = ['Not relevant', 'Inaccurate data', 'Too vague', 'Already knew this'];

const STORAGE_PREFIX = 'report-feedback-';

/**
 * Hook that manages report feedback state and submission.
 * Shared between ReportFeedbackThumbs (action bar) and ReportFeedbackPanel (body).
 */
export const useReportFeedback = (report) => {
  const [rating, setRating] = useState(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const [comment, setComment] = useState('');
  const [showComment, setShowComment] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [hoveredThumb, setHoveredThumb] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_PREFIX + report.id);
    if (stored) setSubmitted(true);
  }, [report.id]);

  const toggleRating = useCallback((value) => {
    setRating(prev => prev === value ? null : value);
    setSelectedTags([]);
  }, []);

  const toggleTag = useCallback((tag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }, []);

  const handleSubmit = useCallback(async () => {
    const profile = getProfile();
    const practiceId = profile?.metadata?.practiceId || '';

    let appVersion = '';
    try {
      appVersion = await window.electronAPI?.getAppVersion?.() || '';
    } catch { /* ignore */ }

    const data = {
      reportId: report.id || '',
      reportTitle: report.title || '',
      suggestedAnalysisId: report.suggestedAnalysisId || 'custom',
      rating,
      tags: selectedTags.join(', '),
      comment: comment.trim(),
      model: report.metadata?.model || '',
      practiceId,
      appVersion
    };

    localStorage.setItem(STORAGE_PREFIX + report.id, JSON.stringify({
      rating,
      tags: selectedTags
    }));

    setSubmitted(true);

    try {
      if (window.electronAPI?.submitReportFeedback) {
        await window.electronAPI.submitReportFeedback(data);
      }
    } catch (err) {
      console.warn('[ReportFeedback] Submission failed (saved locally):', err.message);
    }
  }, [report, rating, selectedTags, comment]);

  return {
    rating, toggleRating,
    selectedTags, toggleTag,
    comment, setComment,
    showComment, setShowComment,
    submitted,
    hoveredThumb, setHoveredThumb,
    handleSubmit
  };
};

/**
 * ReportFeedbackThumbs — Compact thumbs up/down for the action bar.
 * Shows thumbs buttons, or a small "Thanks" badge if already submitted.
 */
export const ReportFeedbackThumbs = ({ feedback }) => {
  const { rating, toggleRating, submitted, hoveredThumb, setHoveredThumb } = feedback;

  if (submitted) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: '0.5rem 0.875rem',
        fontSize: '0.8125rem',
        color: COLORS.incomeColor,
        fontWeight: 500
      }}>
        <Check style={{ height: '0.75rem', width: '0.75rem' }} />
        Thanks!
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
      <span style={{
        fontSize: '0.8125rem',
        color: COLORS.textSecondary,
        fontWeight: 500,
        marginRight: '0.25rem'
      }}>
        Helpful?
      </span>

      <button
        onClick={() => toggleRating('up')}
        onMouseEnter={() => setHoveredThumb('up')}
        onMouseLeave={() => setHoveredThumb(null)}
        style={{
          padding: '0.375rem 0.5rem',
          backgroundColor: rating === 'up' ? `${COLORS.incomeColor}15` : COLORS.white,
          border: `1px solid ${rating === 'up' ? COLORS.incomeColor : hoveredThumb === 'up' ? COLORS.incomeColor : COLORS.borderLight}`,
          borderRadius: '0.375rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          color: rating === 'up' ? COLORS.incomeColor : hoveredThumb === 'up' ? COLORS.incomeColor : COLORS.textSecondary,
          transition: 'all 0.15s'
        }}
      >
        <ThumbsUp style={{ height: '0.875rem', width: '0.875rem' }} />
      </button>

      <button
        onClick={() => toggleRating('down')}
        onMouseEnter={() => setHoveredThumb('down')}
        onMouseLeave={() => setHoveredThumb(null)}
        style={{
          padding: '0.375rem 0.5rem',
          backgroundColor: rating === 'down' ? `${COLORS.expenseColor}15` : COLORS.white,
          border: `1px solid ${rating === 'down' ? COLORS.expenseColor : hoveredThumb === 'down' ? COLORS.expenseColor : COLORS.borderLight}`,
          borderRadius: '0.375rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          color: rating === 'down' ? COLORS.expenseColor : hoveredThumb === 'down' ? COLORS.expenseColor : COLORS.textSecondary,
          transition: 'all 0.15s'
        }}
      >
        <ThumbsDown style={{ height: '0.875rem', width: '0.875rem' }} />
      </button>
    </div>
  );
};

/**
 * ReportFeedbackPanel — Tags, comment, and submit button.
 * Renders below the report content when a rating has been selected.
 * Hidden when no rating or already submitted.
 */
export const ReportFeedbackPanel = ({ feedback }) => {
  const {
    rating, selectedTags, toggleTag,
    comment, setComment,
    showComment, setShowComment,
    submitted, handleSubmit
  } = feedback;

  if (submitted || !rating) return null;

  const tags = rating === 'up' ? POSITIVE_TAGS : NEGATIVE_TAGS;
  const accentColor = rating === 'up' ? COLORS.incomeColor : COLORS.expenseColor;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.625rem',
      padding: '0.75rem 1rem',
      animation: 'feedbackFadeIn 0.2s ease-out'
    }}>
      {/* Tag chips */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.375rem',
        justifyContent: 'center'
      }}>
        {tags.map(tag => {
          const isSelected = selectedTags.includes(tag);
          return (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              style={{
                padding: '0.25rem 0.625rem',
                fontSize: '0.75rem',
                fontWeight: 500,
                backgroundColor: isSelected ? `${accentColor}15` : COLORS.white,
                border: `1px solid ${isSelected ? accentColor : COLORS.borderLight}`,
                borderRadius: '1rem',
                color: isSelected ? accentColor : COLORS.textSecondary,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {tag}
            </button>
          );
        })}
      </div>

      {/* Comment toggle + input */}
      {!showComment ? (
        <button
          onClick={() => setShowComment(true)}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '0.75rem',
            color: COLORS.textSecondary,
            cursor: 'pointer',
            textDecoration: 'underline',
            padding: 0
          }}
        >
          Add a comment...
        </button>
      ) : (
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional comment..."
          rows={2}
          style={{
            width: '100%',
            maxWidth: '400px',
            padding: '0.5rem 0.625rem',
            fontSize: '0.8125rem',
            border: `1px solid ${COLORS.borderLight}`,
            borderRadius: '0.375rem',
            resize: 'vertical',
            fontFamily: 'inherit',
            color: COLORS.textPrimary,
            outline: 'none'
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = COLORS.slainteBlue}
          onBlur={(e) => e.currentTarget.style.borderColor = COLORS.borderLight}
        />
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        style={{
          padding: '0.375rem 1rem',
          fontSize: '0.8125rem',
          fontWeight: 500,
          backgroundColor: COLORS.slainteBlue,
          color: COLORS.white,
          border: 'none',
          borderRadius: '0.375rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          transition: 'opacity 0.15s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.85'}
        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
      >
        <Send style={{ height: '0.75rem', width: '0.75rem' }} />
        Send feedback
      </button>

      <style>{`
        @keyframes feedbackFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

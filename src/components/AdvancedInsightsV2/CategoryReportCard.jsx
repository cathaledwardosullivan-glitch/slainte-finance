import React, { useState } from 'react';
import { FileText, Play, RotateCw, Clock, Sparkles, Zap, CheckCircle, Circle, Trash2 } from 'lucide-react';
import { REPORT_TYPE_LABELS } from '../../data/suggestedAnalyses';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import COLORS from '../../utils/colors';

/**
 * Time-ago formatter for report dates.
 */
const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

/**
 * UnifiedAnalysisCard — Shows a suggested analysis in one of two states:
 * 1. Generated: question title + Read/Re-generate buttons + date/model info
 * 2. Not generated: question title + description + Generate button
 */
const UnifiedAnalysisCard = ({ analysis, report, onRead, onGenerate, onDelete }) => {
  const [hovered, setHovered] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const hasReport = !!report;
  const typeInfo = REPORT_TYPE_LABELS[analysis.reportType] || REPORT_TYPE_LABELS.standard;
  const color = typeInfo.color;
  const model = report?.metadata?.model || '';
  const isOpus = model.includes('opus');
  const displayTitle = analysis.shortQuestion || analysis.title;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '1rem 1.25rem',
        backgroundColor: hovered ? COLORS.bgPage : COLORS.white,
        border: `1px ${hasReport ? 'solid' : 'dashed'} ${COLORS.borderLight}`,
        borderLeft: hasReport ? `3px solid ${COLORS.slainteBlue}` : undefined,
        borderRadius: '0.625rem',
        transition: 'all 0.2s',
        boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem'
      }}
    >
      {/* Icon */}
      <div style={{
        width: '2.25rem',
        height: '2.25rem',
        borderRadius: '0.5rem',
        backgroundColor: hasReport ? `${COLORS.slainteBlue}12` : `${color}12`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        {hasReport
          ? <CheckCircle style={{ width: '1.125rem', height: '1.125rem', color: COLORS.success }} />
          : analysis.reportType === 'strategic'
            ? <Sparkles style={{ width: '1.125rem', height: '1.125rem', color }} />
            : <Circle style={{ width: '1.125rem', height: '1.125rem', color: COLORS.borderLight }} />
        }
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          color: COLORS.textPrimary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {displayTitle}
        </div>
        {hasReport ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginTop: '0.25rem',
            fontSize: '0.75rem',
            color: COLORS.textSecondary
          }}>
            <Clock style={{ width: '0.6875rem', height: '0.6875rem' }} />
            {timeAgo(report.generatedDate)}
            <span style={{
              padding: '0.0625rem 0.375rem',
              borderRadius: '0.25rem',
              backgroundColor: isOpus ? `${COLORS.chartViolet}12` : `${COLORS.slainteBlue}12`,
              color: isOpus ? COLORS.chartViolet : COLORS.slainteBlue,
              fontSize: '0.6875rem',
              fontWeight: 500
            }}>
              {isOpus ? 'Opus' : 'Sonnet'}
            </span>
          </div>
        ) : (
          <div style={{
            fontSize: '0.75rem',
            color: COLORS.textSecondary,
            marginTop: '0.125rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {analysis.description}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        {hasReport && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onRead(report); }}
              style={{
                padding: '0.375rem 0.875rem',
                borderRadius: '0.375rem',
                border: 'none',
                backgroundColor: `${COLORS.slainteBlue}14`,
                color: COLORS.slainteBlue,
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                whiteSpace: 'nowrap',
                transition: 'background-color 0.15s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${COLORS.slainteBlue}24`; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = `${COLORS.slainteBlue}14`; }}
            >
              <FileText style={{ width: '0.75rem', height: '0.75rem' }} /> Read
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }}
              title="Delete report"
              style={{
                padding: '0.375rem',
                borderRadius: '0.375rem',
                border: 'none',
                backgroundColor: 'transparent',
                color: COLORS.textSecondary,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.15s, background-color 0.15s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = COLORS.expenseColor; e.currentTarget.style.backgroundColor = `${COLORS.expenseColor}12`; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = COLORS.textSecondary; e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <Trash2 style={{ width: '0.75rem', height: '0.75rem' }} />
            </button>
          </>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onGenerate(analysis); }}
          style={{
            padding: '0.375rem 0.875rem',
            borderRadius: '0.375rem',
            border: 'none',
            backgroundColor: hasReport ? `${COLORS.textSecondary}18` : `${color}14`,
            color: hasReport ? COLORS.textSecondary : color,
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            whiteSpace: 'nowrap',
            transition: 'background-color 0.15s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = hasReport ? `${COLORS.textSecondary}28` : `${color}24`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = hasReport ? `${COLORS.textSecondary}18` : `${color}14`;
          }}
        >
          {hasReport ? (
            <><RotateCw style={{ width: '0.75rem', height: '0.75rem' }} /> Re-generate</>
          ) : (
            <><Play style={{ width: '0.75rem', height: '0.75rem' }} /> Generate</>
          )}
        </button>
      </div>

      {showDeleteConfirm && (
        <DeleteConfirmDialog
          title={displayTitle}
          onConfirm={() => { onDelete(report.id); setShowDeleteConfirm(false); }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
};

/**
 * GeneratedReportCard — A saved report (used by CustomReportsRow for non-categorised reports).
 */
const GeneratedReportCard = ({ report, onRead, onDelete }) => {
  const [hovered, setHovered] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const model = report.metadata?.model || '';
  const isOpus = model.includes('opus');

  return (
    <div
      onClick={() => onRead(report)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '1rem 1.25rem',
        backgroundColor: hovered ? COLORS.bgPage : COLORS.white,
        border: `1px solid ${COLORS.borderLight}`,
        borderLeft: `3px solid ${COLORS.slainteBlue}`,
        borderRadius: '0.625rem',
        cursor: 'pointer',
        transition: 'all 0.2s',
        boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem'
      }}
    >
      <div style={{
        width: '2.25rem',
        height: '2.25rem',
        borderRadius: '0.5rem',
        backgroundColor: `${COLORS.slainteBlue}12`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <FileText style={{ width: '1.125rem', height: '1.125rem', color: COLORS.slainteBlue }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          color: COLORS.textPrimary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {report.title}
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginTop: '0.25rem',
          fontSize: '0.75rem',
          color: COLORS.textSecondary
        }}>
          <Clock style={{ width: '0.6875rem', height: '0.6875rem' }} />
          {timeAgo(report.generatedDate)}
          <span style={{
            padding: '0.0625rem 0.375rem',
            borderRadius: '0.25rem',
            backgroundColor: isOpus ? `${COLORS.chartViolet}12` : `${COLORS.slainteBlue}12`,
            color: isOpus ? COLORS.chartViolet : COLORS.slainteBlue,
            fontSize: '0.6875rem',
            fontWeight: 500
          }}>
            {isOpus ? 'Opus' : 'Sonnet'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        <span style={{
          fontSize: '0.75rem',
          fontWeight: 500,
          color: COLORS.slainteBlue,
          whiteSpace: 'nowrap'
        }}>
          Read →
        </span>
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }}
            title="Delete report"
            style={{
              padding: '0.375rem',
              borderRadius: '0.375rem',
              border: 'none',
              backgroundColor: 'transparent',
              color: COLORS.textSecondary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              transition: 'color 0.15s, background-color 0.15s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = COLORS.expenseColor; e.currentTarget.style.backgroundColor = `${COLORS.expenseColor}12`; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = COLORS.textSecondary; e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <Trash2 style={{ width: '0.75rem', height: '0.75rem' }} />
          </button>
        )}
      </div>

      {showDeleteConfirm && (
        <DeleteConfirmDialog
          title={report.title}
          onConfirm={() => { onDelete(report.id); setShowDeleteConfirm(false); }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
};

export { UnifiedAnalysisCard, GeneratedReportCard };

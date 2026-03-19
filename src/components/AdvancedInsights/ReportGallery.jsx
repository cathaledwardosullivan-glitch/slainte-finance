import React, { useState, useMemo } from 'react';
import { FileText, Clock, Trash2, Search, ArrowUpDown, Library } from 'lucide-react';
import { useFinn } from '../../context/FinnContext';
import COLORS from '../../utils/colors';

/**
 * Format relative time from an ISO date string.
 */
const formatRelativeTime = (isoString) => {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * Get model display name from metadata.
 */
const getModelBadge = (report) => {
  const model = report.metadata?.model || '';
  if (model.includes('opus')) return { label: 'Opus', color: COLORS.chartViolet };
  if (model.includes('sonnet')) return { label: 'Sonnet', color: COLORS.slainteBlue };
  return null;
};

/**
 * ReportGallery - Visual card grid of saved Finn reports.
 * Same data source as FinnReportsPanel (shared via useFinn).
 */
const ReportGallery = ({ reports, onSelectReport, compact = false }) => {
  const { deleteReport } = useFinn();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortNewest, setSortNewest] = useState(true);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [showAll, setShowAll] = useState(false);

  // Filter and sort reports
  const displayReports = useMemo(() => {
    let filtered = reports;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = reports.filter(r =>
        r.title?.toLowerCase().includes(q) ||
        r.originalQuestion?.toLowerCase().includes(q)
      );
    }

    return [...filtered].sort((a, b) => {
      const dateA = new Date(a.generatedDate);
      const dateB = new Date(b.generatedDate);
      return sortNewest ? dateB - dateA : dateA - dateB;
    });
  }, [reports, searchQuery, sortNewest]);

  // Show all when searching, otherwise respect toggle
  const isSearching = searchQuery.trim().length > 0;
  const defaultCount = compact ? 3 : 3;
  const visibleReports = (showAll || isSearching) ? displayReports : displayReports.slice(0, defaultCount);
  const hasMore = displayReports.length > defaultCount && !isSearching;

  const handleDelete = (reportId, e) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this report?')) {
      deleteReport(reportId);
    }
  };

  return (
    <div>
      {/* Section Header + Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Library style={{ height: '1.25rem', width: '1.25rem', color: COLORS.slainteBlue }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: COLORS.textPrimary, margin: 0 }}>
            Your Reports
          </h3>
          <span style={{
            padding: '0.125rem 0.5rem',
            backgroundColor: `${COLORS.slainteBlue}15`,
            borderRadius: '0.75rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: COLORS.slainteBlue
          }}>
            {reports.length}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search style={{
              position: 'absolute',
              left: '0.625rem',
              top: '50%',
              transform: 'translateY(-50%)',
              height: '0.875rem',
              width: '0.875rem',
              color: COLORS.textSecondary
            }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reports..."
              style={{
                padding: '0.4375rem 0.75rem 0.4375rem 2rem',
                border: `1px solid ${COLORS.borderLight}`,
                borderRadius: '0.5rem',
                fontSize: '0.8125rem',
                width: '200px',
                outline: 'none',
                backgroundColor: COLORS.white
              }}
              onFocus={(e) => e.target.style.borderColor = COLORS.slainteBlue}
              onBlur={(e) => e.target.style.borderColor = COLORS.borderLight}
            />
          </div>

          {/* Sort toggle */}
          <button
            onClick={() => setSortNewest(!sortNewest)}
            style={{
              padding: '0.4375rem 0.75rem',
              border: `1px solid ${COLORS.borderLight}`,
              borderRadius: '0.5rem',
              backgroundColor: COLORS.white,
              fontSize: '0.8125rem',
              color: COLORS.textSecondary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem'
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = COLORS.slainteBlue}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = COLORS.borderLight}
          >
            <ArrowUpDown style={{ height: '0.875rem', width: '0.875rem' }} />
            {sortNewest ? 'Newest' : 'Oldest'}
          </button>
        </div>
      </div>

      {/* Report Cards Grid */}
      {displayReports.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: COLORS.textSecondary }}>
          <p style={{ fontSize: '0.875rem' }}>No reports match your search.</p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: compact ? '1fr' : 'repeat(3, minmax(0, 1fr))',
            gap: compact ? '0.75rem' : '1rem'
          }}
        >
          {visibleReports.map((report) => {
            const isHovered = hoveredCard === report.id;
            const modelBadge = getModelBadge(report);

            return (
              <div
                key={report.id}
                onClick={() => onSelectReport(report)}
                onMouseEnter={() => setHoveredCard(report.id)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  backgroundColor: COLORS.white,
                  borderRadius: '0.75rem',
                  padding: '1.25rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  borderTop: `1px solid ${isHovered ? `${COLORS.slainteBlue}40` : COLORS.borderLight}`,
                  borderRight: `1px solid ${isHovered ? `${COLORS.slainteBlue}40` : COLORS.borderLight}`,
                  borderBottom: `1px solid ${isHovered ? `${COLORS.slainteBlue}40` : COLORS.borderLight}`,
                  borderLeft: `3px solid ${COLORS.slainteBlue}`,
                  transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                  boxShadow: isHovered
                    ? '0 4px 12px rgba(0, 0, 0, 0.08)'
                    : '0 1px 3px rgba(0, 0, 0, 0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.625rem',
                  minWidth: 0,
                  overflow: 'hidden',
                  ...(compact ? { minHeight: '9.5rem' } : {})
                }}
              >
                {/* Top row: icon + time + delete */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div
                      style={{
                        width: '1.75rem',
                        height: '1.75rem',
                        backgroundColor: `${COLORS.slainteBlue}12`,
                        borderRadius: '0.375rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <FileText style={{ height: '0.875rem', width: '0.875rem', color: COLORS.slainteBlue }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', color: COLORS.textSecondary, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock style={{ height: '0.625rem', width: '0.625rem' }} />
                      {formatRelativeTime(report.generatedDate)}
                    </span>
                  </div>

                  <button
                    onClick={(e) => handleDelete(report.id, e)}
                    style={{
                      padding: '0.25rem',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderRadius: '0.25rem',
                      cursor: 'pointer',
                      color: COLORS.textSecondary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: isHovered ? 1 : 0,
                      transition: 'opacity 0.2s'
                    }}
                    title="Delete report"
                    onMouseEnter={(e) => e.currentTarget.style.color = COLORS.expenseColor}
                    onMouseLeave={(e) => e.currentTarget.style.color = COLORS.textSecondary}
                  >
                    <Trash2 style={{ height: '0.875rem', width: '0.875rem' }} />
                  </button>
                </div>

                {/* Title (2-line clamp) */}
                <h4 style={{
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  color: COLORS.textPrimary,
                  margin: 0,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  lineHeight: 1.3
                }}>
                  {report.title}
                </h4>

                {/* Original question */}
                {report.originalQuestion && (
                  <p style={{
                    fontSize: '0.8125rem',
                    color: COLORS.textSecondary,
                    margin: 0,
                    overflow: 'hidden',
                    ...(compact ? {
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      lineHeight: 1.4
                    } : {
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    })
                  }}>
                    Q: {report.originalQuestion}
                  </p>
                )}

                {/* Bottom row: model badge + read link */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    {modelBadge && (
                      <span style={{
                        padding: '0.125rem 0.5rem',
                        backgroundColor: `${modelBadge.color}12`,
                        color: modelBadge.color,
                        borderRadius: '0.25rem',
                        fontSize: '0.6875rem',
                        fontWeight: 600
                      }}>
                        {modelBadge.label}
                      </span>
                    )}
                    {report.metadata?.revisedAt && (
                      <span style={{
                        padding: '0.125rem 0.5rem',
                        backgroundColor: `${COLORS.incomeColor}15`,
                        color: COLORS.incomeColor,
                        borderRadius: '0.25rem',
                        fontSize: '0.6875rem',
                        fontWeight: 600
                      }}>
                        Revised
                      </span>
                    )}
                  </div>
                  <span style={{
                    fontSize: '0.8125rem',
                    color: COLORS.slainteBlue,
                    fontWeight: 500
                  }}>
                    Read Report &rarr;
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View All / Show Fewer toggle */}
      {hasMore && (
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button
            onClick={() => setShowAll(!showAll)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: COLORS.slainteBlue,
              fontSize: '0.8125rem',
              fontWeight: 500,
              padding: '0.5rem 1rem'
            }}
            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
          >
            {showAll ? 'Show Fewer' : `View All Reports (${displayReports.length})`}
          </button>
        </div>
      )}
    </div>
  );
};

export default ReportGallery;

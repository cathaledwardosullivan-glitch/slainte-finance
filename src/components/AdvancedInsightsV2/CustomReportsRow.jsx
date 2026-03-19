import React, { useState } from 'react';
import { Wand2, FileText, Clock, MessageSquare } from 'lucide-react';
import COLORS from '../../utils/colors';

const CUSTOM_COLOR = COLORS.textSecondary;

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
 * CustomReportsBanner — Banner card matching CategoryBanner style for custom reports.
 * Left zone: flip card (title front / explanation back). Right zone: recent report list.
 */
const CustomReportsBanner = ({ reports, onReadReport }) => {
  const [flipped, setFlipped] = useState(false);
  const sorted = [...(reports || [])].sort((a, b) =>
    new Date(b.generatedDate) - new Date(a.generatedDate)
  );
  const preview = sorted.slice(0, 3);
  const count = reports?.length || 0;

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        minHeight: '9rem',
        backgroundColor: COLORS.white,
        border: `1px solid ${COLORS.borderLight}`,
        borderTop: `3px solid ${CUSTOM_COLOR}`,
        borderRadius: '0.75rem',
        opacity: count === 0 ? 0.55 : 1,
        transition: 'box-shadow 0.2s, transform 0.15s',
        overflow: 'hidden'
      }}
      onMouseEnter={(e) => {
        if (count > 0) {
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.07)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'none';
      }}
    >
      {/* ═══ LEFT ZONE: Flip Card ═══ */}
      <div
        style={{
          flex: '0 0 36%',
          perspective: '1000px',
          minWidth: 0
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            transition: 'transform 0.6s ease',
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
          }}
        >
          {/* ─── FRONT FACE: Title ─── */}
          <div
            onClick={() => setFlipped(true)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              backgroundColor: CUSTOM_COLOR,
              borderRadius: '0 0 0 0.625rem',
              padding: '0.75rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
          >
            <div>
              <Wand2 style={{
                width: '1.125rem',
                height: '1.125rem',
                color: 'rgba(255,255,255,0.7)',
                marginBottom: '0.375rem'
              }} />
              <div style={{
                fontSize: '1.0625rem',
                fontWeight: 800,
                color: COLORS.white,
                lineHeight: 1.2,
                letterSpacing: '-0.01em'
              }}>
                Custom Reports
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginTop: '0.375rem'
            }}>
              <span style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.7)' }}>
                {count} report{count !== 1 ? 's' : ''} via Finn
              </span>
            </div>
          </div>

          {/* ─── BACK FACE: Explanation ─── */}
          <div
            onClick={() => setFlipped(false)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              backgroundColor: COLORS.white,
              borderRight: `1px solid ${COLORS.borderLight}`,
              borderRadius: '0 0 0 0.625rem',
              padding: '0.75rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: '0.5rem',
              cursor: 'pointer'
            }}
          >
            <MessageSquare style={{
              width: '1rem',
              height: '1rem',
              color: CUSTOM_COLOR,
              flexShrink: 0
            }} />
            <div style={{
              fontSize: '0.6875rem',
              color: COLORS.textPrimary,
              lineHeight: 1.5
            }}>
              This section is for any custom reports that were created through a conversation with Finn, rather than from the suggested analyses.
            </div>
          </div>
        </div>
      </div>

      {/* ═══ DIVIDER ═══ */}
      <div style={{
        width: '1px',
        backgroundColor: COLORS.borderLight,
        margin: '0.75rem 0'
      }} />

      {/* ═══ RIGHT ZONE: Recent reports list ═══ */}
      <div
        style={{
          flex: '1 1 62%',
          padding: '0.75rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '0.375rem',
          minWidth: 0
        }}
      >
        {count === 0 ? (
          <div style={{
            fontSize: '0.8125rem',
            color: COLORS.textSecondary,
            fontStyle: 'italic'
          }}>
            Ask Finn a custom question to generate reports here
          </div>
        ) : (
          <>
            {preview.map(report => {
              const model = report.metadata?.model || '';
              const isOpus = model.includes('opus');
              return (
                <div
                  key={report.id}
                  onClick={() => onReadReport(report)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.25rem 0.375rem',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = COLORS.bgPage; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <FileText style={{
                    width: '0.75rem',
                    height: '0.75rem',
                    color: COLORS.slainteBlue,
                    flexShrink: 0
                  }} />
                  <span style={{
                    flex: 1,
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    color: COLORS.textPrimary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {report.title}
                  </span>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    flexShrink: 0
                  }}>
                    <span style={{
                      fontSize: '0.5625rem',
                      color: COLORS.textSecondary,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.1875rem'
                    }}>
                      <Clock style={{ width: '0.5625rem', height: '0.5625rem' }} />
                      {timeAgo(report.generatedDate)}
                    </span>
                    <span style={{
                      padding: '0rem 0.25rem',
                      borderRadius: '0.1875rem',
                      backgroundColor: isOpus ? `${COLORS.chartViolet}12` : `${COLORS.slainteBlue}12`,
                      color: isOpus ? COLORS.chartViolet : COLORS.slainteBlue,
                      fontSize: '0.5625rem',
                      fontWeight: 500
                    }}>
                      {isOpus ? 'Opus' : 'Sonnet'}
                    </span>
                  </div>
                </div>
              );
            })}
            {count > 3 && (
              <div style={{
                fontSize: '0.625rem',
                color: COLORS.textSecondary,
                paddingLeft: '0.375rem',
                marginTop: '0.125rem'
              }}>
                +{count - 3} more report{count - 3 !== 1 ? 's' : ''}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CustomReportsBanner;

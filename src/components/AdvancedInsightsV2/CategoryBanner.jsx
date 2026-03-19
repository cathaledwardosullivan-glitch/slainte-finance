import React, { useState } from 'react';
import { LayoutDashboard, Stethoscope, Receipt, TrendingDown, Users, ArrowRight, Sparkles, Check, Circle } from 'lucide-react';
import COLORS from '../../utils/colors';

const CATEGORY_ICONS = {
  overview: LayoutDashboard,
  gms: Stethoscope,
  tax: Receipt,
  costs: TrendingDown,
  growth: Users
};

const fmtPct = (value) => {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

/**
 * CategoryBanner — Full-card flip: front = coloured title + insight panel,
 * back = full-width report list. Click left zone to flip, click back to flip back.
 */
const CategoryBanner = ({
  category,
  metric,
  subtitle,
  narrative,
  narrativeVisible,
  change,
  chart,
  disabled,
  suggestedAnalyses,
  generatedAnalysisIds,
  generatedCount,
  totalCount,
  onExplore,
  onInsightClick,
  onAnalysisClick
}) => {
  const Icon = CATEGORY_ICONS[category.id] || LayoutDashboard;
  const color = category.color;
  const [flipped, setFlipped] = useState(false);
  const bannerTitle = category.bannerTitle || category.label;

  return (
    <div style={{ perspective: '1200px', minHeight: '9rem' }}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          minHeight: '9rem',
          transition: 'transform 0.6s ease',
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
        }}
      >
        {/* ═══════════════════════════════════════════════════════════════
            FRONT FACE — Two-zone: coloured title (left) + insight (right)
            ═══════════════════════════════════════════════════════════════ */}
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            display: 'flex',
            backgroundColor: COLORS.white,
            border: `1px solid ${COLORS.borderLight}`,
            borderTop: `3px solid ${color}`,
            borderRadius: '0.75rem',
            opacity: disabled ? 0.55 : 1,
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            if (!disabled) {
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.07)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {/* LEFT: Coloured title zone — click to flip */}
          <div
            onClick={() => !disabled && setFlipped(true)}
            style={{
              flex: '0 0 36%',
              backgroundColor: color,
              borderRadius: '0 0 0 0.625rem',
              padding: '0.75rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: disabled ? 'default' : 'pointer',
              minWidth: 0
            }}
          >
            <div>
              <Icon style={{
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
                {bannerTitle}
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '0.375rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  {Array.from({ length: totalCount }, (_, i) => (
                    <div
                      key={i}
                      style={{
                        width: '0.375rem',
                        height: '0.375rem',
                        borderRadius: '50%',
                        backgroundColor: i < generatedCount ? COLORS.white : 'rgba(255,255,255,0.35)'
                      }}
                    />
                  ))}
                </div>
                <span style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.7)' }}>
                  {generatedCount}/{totalCount}
                </span>
              </div>

              {!disabled && (
                <button
                  onClick={(e) => { e.stopPropagation(); onExplore(); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: COLORS.white,
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.1875rem',
                    padding: '0.125rem 0',
                    opacity: 0.85
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.textDecoration = 'underline'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.textDecoration = 'none'; }}
                >
                  Explore <ArrowRight style={{ width: '0.625rem', height: '0.625rem' }} />
                </button>
              )}
            </div>
          </div>

          {/* DIVIDER */}
          <div style={{
            width: '1px',
            backgroundColor: COLORS.borderLight,
            margin: '0.75rem 0'
          }} />

          {/* RIGHT: Insight panel — click to open report */}
          <div
            onClick={() => !disabled && onInsightClick?.()}
            style={{
              flex: '1 1 62%',
              padding: '0.75rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: '0.375rem',
              minWidth: 0,
              cursor: disabled ? 'default' : 'pointer',
              transition: 'background-color 0.15s'
            }}
            onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.backgroundColor = COLORS.bgPage; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <div style={{
              fontSize: '0.8125rem',
              color: COLORS.textPrimary,
              fontStyle: 'italic',
              lineHeight: 1.3,
              fontWeight: 500
            }}>
              "{category.bannerQuestion}"
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <div style={{
                fontSize: '1.125rem',
                fontWeight: 700,
                color: COLORS.textPrimary,
                lineHeight: 1.2
              }}>
                {metric || '—'}
              </div>
              {change && (
                <span style={{
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  color: change.value >= 0 ? COLORS.incomeColor : COLORS.expenseColor,
                  backgroundColor: change.value >= 0 ? `${COLORS.incomeColor}12` : `${COLORS.expenseColor}12`,
                  padding: '0.125rem 0.375rem',
                  borderRadius: '0.25rem'
                }}>
                  {fmtPct(change.value)} {change.label}
                </span>
              )}
            </div>

            {narrative ? (
              <div style={{
                fontSize: '0.6875rem',
                color: COLORS.textPrimary,
                fontStyle: 'italic',
                lineHeight: 1.4,
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.25rem',
                opacity: narrativeVisible ? 1 : 0,
                transform: narrativeVisible ? 'translateY(0)' : 'translateY(3px)',
                transition: 'opacity 0.5s ease, transform 0.5s ease',
                minHeight: '1rem'
              }}>
                <Sparkles style={{
                  height: '0.625rem',
                  width: '0.625rem',
                  color: COLORS.highlightYellow,
                  flexShrink: 0,
                  marginTop: '0.125rem'
                }} />
                {narrative}
              </div>
            ) : subtitle ? (
              <div style={{
                fontSize: '0.6875rem',
                color: COLORS.textSecondary,
                lineHeight: 1.4,
                minHeight: '1rem'
              }}>
                {subtitle}
              </div>
            ) : null}

            {chart && (
              <div style={{ marginTop: '0.125rem' }}>
                {chart}
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            BACK FACE — Full-width report list
            ═══════════════════════════════════════════════════════════════ */}
        <div
          onClick={() => setFlipped(false)}
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            backgroundColor: COLORS.white,
            border: `1px solid ${COLORS.borderLight}`,
            borderTop: `3px solid ${color}`,
            borderRadius: '0.75rem',
            padding: '0.75rem 1.25rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            cursor: 'pointer',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.07)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div>
            {/* Report list — full width, two columns if enough items */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: (suggestedAnalyses || []).length > 3 ? '1fr 1fr' : '1fr',
              gap: '0.25rem 1rem',
              paddingLeft: '0.125rem'
            }}>
              {(suggestedAnalyses || []).map(analysis => {
                const isGenerated = generatedAnalysisIds?.has(analysis.id);
                return (
                  <div
                    key={analysis.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAnalysisClick?.(analysis);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      fontSize: '0.8125rem',
                      fontStyle: 'italic',
                      color: isGenerated ? COLORS.textPrimary : COLORS.textSecondary,
                      cursor: 'pointer',
                      padding: '0.125rem 0.25rem',
                      borderRadius: '0.25rem',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = `${category.color}15`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {isGenerated ? (
                      <Check style={{ width: '0.875rem', height: '0.875rem', color: COLORS.success, flexShrink: 0 }} />
                    ) : (
                      <Circle style={{ width: '0.6875rem', height: '0.6875rem', color: COLORS.borderLight, flexShrink: 0 }} />
                    )}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {analysis.shortQuestion || analysis.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer: progress + explore */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '0.5rem',
            paddingTop: '0.375rem',
            borderTop: `1px solid ${COLORS.borderLight}40`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                {Array.from({ length: totalCount }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      width: '0.375rem',
                      height: '0.375rem',
                      borderRadius: '50%',
                      backgroundColor: i < generatedCount ? color : `${color}30`
                    }}
                  />
                ))}
              </div>
              <span style={{ fontSize: '0.625rem', color: COLORS.textSecondary }}>
                {generatedCount}/{totalCount}
              </span>
            </div>

            {!disabled && (
              <button
                onClick={(e) => { e.stopPropagation(); onExplore(); }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: color,
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.1875rem',
                  padding: '0.125rem 0'
                }}
                onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
              >
                Explore <ArrowRight style={{ width: '0.625rem', height: '0.625rem' }} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryBanner;

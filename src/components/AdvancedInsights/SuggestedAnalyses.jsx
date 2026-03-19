import React, { useState } from 'react';
import { LayoutDashboard, Receipt, Users, Stethoscope, TrendingDown, Search, ArrowRight, Zap, ChevronDown } from 'lucide-react';
import { useFinn } from '../../context/FinnContext';
import { useAppContext } from '../../context/AppContext';
import { usePracticeProfile } from '../../hooks/usePracticeProfile';
import { ANALYSIS_CATEGORIES, SUGGESTED_ANALYSES } from '../../data/suggestedAnalyses';
import { getHealthCheckSectionStatus } from '../../utils/healthCheckCalculations';
import COLORS from '../../utils/colors';

// Map category IDs to icons
const CATEGORY_ICONS = {
  overview: LayoutDashboard,
  tax: Receipt,
  growth: Users,
  gms: Stethoscope,
  costs: TrendingDown
};

/**
 * SuggestedAnalyses - Grid of curated prompt cards that trigger Finn reports.
 */
const SuggestedAnalyses = ({ onPreviewAnalysis, compact = false }) => {
  const { backgroundTask, TASK_STATUS } = useFinn();
  const { transactions, paymentAnalysisData } = useAppContext();
  const { profile } = usePracticeProfile();
  const [activeFilter, setActiveFilter] = useState('all');
  const [hoveredCard, setHoveredCard] = useState(null);
  const [showAll, setShowAll] = useState(false);

  // Check which data is available for enabling/disabling cards
  const healthCheckStatus = getHealthCheckSectionStatus(profile, paymentAnalysisData);
  const availableData = {
    transactions: transactions && transactions.length > 0,
    paymentAnalysisData: paymentAnalysisData && paymentAnalysisData.length > 0,
    healthCheckPartial: healthCheckStatus.meetsMinimum
  };

  const isReportRunning = backgroundTask?.status === TASK_STATUS?.RUNNING;

  // Filter analyses by selected category
  const filteredAnalyses = activeFilter === 'all'
    ? SUGGESTED_ANALYSES
    : SUGGESTED_ANALYSES.filter(a => a.categoryId === activeFilter);

  // Show fewer by default in compact mode
  const defaultCount = compact ? 3 : 6;

  // In compact "All" mode, curate 1 from each colourful category for variety
  const curatedDefault = (compact && activeFilter === 'all' && !showAll)
    ? ['overview', 'costs', 'growth'].map(catId =>
        filteredAnalyses.find(a => a.categoryId === catId)
      ).filter(Boolean)
    : null;

  const visibleAnalyses = showAll
    ? filteredAnalyses
    : (curatedDefault || filteredAnalyses.slice(0, defaultCount));
  const hasMore = filteredAnalyses.length > defaultCount;

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    setShowAll(false);
  };

  const handleGenerateReport = (analysis) => {
    if (isReportRunning || !onPreviewAnalysis) return;

    // Check required data
    const hasData = analysis.requiresData.every(key => availableData[key]);
    if (!hasData) return;

    onPreviewAnalysis(analysis);
  };

  const isCardDisabled = (analysis) => {
    return !analysis.requiresData.every(key => availableData[key]);
  };

  const getCategoryInfo = (categoryId) => {
    return ANALYSIS_CATEGORIES.find(c => c.id === categoryId);
  };

  return (
    <div>
      {/* Section Header + Filter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Zap style={{ height: '1.25rem', width: '1.25rem', color: COLORS.slainteBlue }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: COLORS.textPrimary, margin: 0 }}>
            Suggested Analyses
          </h3>
        </div>

        {compact ? (
          /* Dropdown selector in compact mode */
          <div style={{ position: 'relative' }}>
            <select
              value={activeFilter}
              onChange={(e) => handleFilterChange(e.target.value)}
              style={{
                padding: '0.375rem 2rem 0.375rem 0.75rem',
                border: `1px solid ${COLORS.borderLight}`,
                borderRadius: '0.5rem',
                fontSize: '0.8125rem',
                color: COLORS.textPrimary,
                backgroundColor: COLORS.white,
                cursor: 'pointer',
                outline: 'none',
                appearance: 'none',
                WebkitAppearance: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = COLORS.slainteBlue}
              onBlur={(e) => e.target.style.borderColor = COLORS.borderLight}
            >
              <option value="all">All Categories</option>
              {ANALYSIS_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>
            <ChevronDown style={{
              position: 'absolute',
              right: '0.5rem',
              top: '50%',
              transform: 'translateY(-50%)',
              height: '0.875rem',
              width: '0.875rem',
              color: COLORS.textSecondary,
              pointerEvents: 'none'
            }} />
          </div>
        ) : null}
      </div>

      {/* Category Filter Pills - full width mode only */}
      {!compact && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => handleFilterChange('all')}
            style={{
              padding: '0.375rem 0.875rem',
              borderRadius: '1rem',
              border: `1px solid ${activeFilter === 'all' ? COLORS.slainteBlue : COLORS.borderLight}`,
              backgroundColor: activeFilter === 'all' ? COLORS.slainteBlue : COLORS.white,
              color: activeFilter === 'all' ? COLORS.white : COLORS.textSecondary,
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            All
          </button>
          {ANALYSIS_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleFilterChange(cat.id)}
              style={{
                padding: '0.375rem 0.875rem',
                borderRadius: '1rem',
                border: `1px solid ${activeFilter === cat.id ? cat.color : COLORS.borderLight}`,
                backgroundColor: activeFilter === cat.id ? cat.color : COLORS.white,
                color: activeFilter === cat.id ? COLORS.white : COLORS.textSecondary,
                fontSize: '0.8125rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: compact ? '1fr' : 'repeat(3, 1fr)',
          gap: compact ? '0.75rem' : '1rem'
        }}
      >
        {visibleAnalyses.map((analysis) => {
          const category = getCategoryInfo(analysis.categoryId);
          const disabled = isCardDisabled(analysis);
          const isHovered = hoveredCard === analysis.id;
          const CategoryIcon = CATEGORY_ICONS[analysis.categoryId] || Search;

          return (
            <div
              key={analysis.id}
              onMouseEnter={() => !disabled && setHoveredCard(analysis.id)}
              onMouseLeave={() => setHoveredCard(null)}
              style={{
                backgroundColor: COLORS.white,
                borderRadius: '0.75rem',
                padding: '1.25rem',
                border: `1px solid ${isHovered ? `${category.color}40` : COLORS.borderLight}`,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                transition: 'all 0.2s',
                transform: isHovered && !disabled ? 'translateY(-2px)' : 'translateY(0)',
                boxShadow: isHovered && !disabled
                  ? '0 4px 12px rgba(0, 0, 0, 0.08)'
                  : '0 1px 3px rgba(0, 0, 0, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                ...(compact ? { minHeight: '9.5rem' } : {})
              }}
              onClick={() => !disabled && handleGenerateReport(analysis)}
            >
              {/* Category Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.25rem',
                    backgroundColor: `${category.color}15`,
                    color: category.color,
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em'
                  }}
                >
                  {category.label}
                </span>
              </div>

              {/* Title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CategoryIcon style={{ height: '1rem', width: '1rem', color: category.color, flexShrink: 0 }} />
                <h4 style={{
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  color: COLORS.textPrimary,
                  margin: 0
                }}>
                  {analysis.title}
                </h4>
              </div>

              {/* Description */}
              <p style={{
                fontSize: '0.8125rem',
                color: COLORS.textSecondary,
                lineHeight: 1.5,
                margin: 0,
                flex: 1
              }}>
                {analysis.description}
              </p>

              {/* Action */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                color: disabled ? COLORS.borderLight : COLORS.slainteBlue,
                fontSize: '0.8125rem',
                fontWeight: 500
              }}>
                {disabled ? (
                  <span style={{ color: COLORS.textSecondary, fontSize: '0.75rem' }}>
                    Upload data to enable
                  </span>
                ) : (
                  <>
                    <span>Generate Report</span>
                    <ArrowRight style={{ height: '0.875rem', width: '0.875rem' }} />
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Show More / Show Fewer toggle */}
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
            {showAll ? 'Show Fewer' : `Show More Analyses (${filteredAnalyses.length - defaultCount} more)`}
          </button>
        </div>
      )}
    </div>
  );
};

export default SuggestedAnalyses;

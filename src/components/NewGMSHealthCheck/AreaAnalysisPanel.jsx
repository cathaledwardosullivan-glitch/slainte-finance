import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, AlertCircle } from 'lucide-react';
import COLORS from '../../utils/colors';
import {
  STCBreakdown,
  LeaveBreakdown,
  CDMBreakdown,
  CapitationBreakdown,
  PracticeSupportBreakdown,
  CervicalCheckBreakdown
} from './CategoryBreakdowns';

/**
 * Render the detailed category breakdown for a specific area
 * Uses the shared CategoryBreakdowns components extracted from the legacy report
 */
function renderCategoryBreakdown(areaId, breakdown, healthCheckData) {
  if (!breakdown) return null;

  switch (areaId) {
    case 'leave':
      return <LeaveBreakdown leaveDetails={breakdown.leaveDetails} />;
    case 'practiceSupport':
      return (
        <PracticeSupportBreakdown
          entitlement={breakdown.entitlement}
          current={breakdown.current}
          employed={breakdown.employed}
          issues={breakdown.issues}
          opportunities={breakdown.opportunities}
          weightedPanel={breakdown.weightedPanel}
          numGPs={breakdown.numGPs}
          totalRecoverable={breakdown.totalRecoverable}
          staffDetails={healthCheckData?.staffDetails}
        />
      );
    case 'capitation':
      return <CapitationBreakdown capitationAnalysis={breakdown.capitationAnalysis} />;
    case 'cervicalCheck':
      return <CervicalCheckBreakdown cervicalScreeningAnalysis={breakdown.cervicalScreeningAnalysis} />;
    case 'stc':
      return <STCBreakdown stcAnalysis={breakdown.stcAnalysis} />;
    case 'cdm':
      return <CDMBreakdown cdmAnalysis={breakdown.cdmAnalysis} />;
    default:
      return <p style={{ margin: 0, color: COLORS.mediumGray }}>Calculation details not available for this area.</p>;
  }
}

/**
 * AreaAnalysisPanel - Shows analysis results for a single GMS area
 * Layout: Unclaimed callout → Bar chart → Key findings (where relevant) → Detailed breakdown (always visible)
 */
const AreaAnalysisPanel = ({ areaId, analysis, canAnalyze, readiness, healthCheckData }) => {
  if (!canAnalyze) {
    return (
      <div style={{
        padding: '1.5rem',
        backgroundColor: '#FAFAFA',
        borderRadius: '0.5rem',
        border: `1px solid ${COLORS.lightGray}`,
        textAlign: 'center'
      }}>
        <AlertCircle style={{ width: '2rem', height: '2rem', color: COLORS.mediumGray, margin: '0 auto 0.75rem' }} />
        <p style={{ margin: 0, color: COLORS.mediumGray, fontSize: '0.9rem' }}>
          More data needed to run analysis
        </p>
        {readiness?.missingData?.length > 0 && (
          <ul style={{ margin: '0.75rem 0 0', padding: '0 1rem', textAlign: 'left', fontSize: '0.85rem', color: COLORS.darkGray }}>
            {readiness.missingData.map((item, i) => (
              <li key={i} style={{ marginBottom: '0.25rem' }}>{item}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (!analysis) return null;

  const { actual, potential, findings, breakdown } = analysis;

  // Build chart data
  const chartData = [
    {
      name: 'Current',
      value: actual || 0,
      fill: COLORS.incomeColor
    },
    {
      name: 'Potential',
      value: potential || 0,
      fill: COLORS.slainteBlue
    }
  ];

  const unclaimed = (potential || 0) - (actual || 0);
  const hasUnclaimed = unclaimed > 50; // Threshold to avoid noise

  // These areas show details in their own breakdown components — skip duplicate Key Findings
  const showFindings = !['leave', 'practiceSupport', 'cervicalCheck', 'capitation', 'stc', 'cdm'].includes(areaId) && findings && findings.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Unclaimed income callout (shown first) */}
      {hasUnclaimed && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '1rem',
          backgroundColor: '#FFF7ED',
          borderRadius: '0.5rem',
          border: '1px solid #FDBA74'
        }}>
          <TrendingUp style={{ width: '1.25rem', height: '1.25rem', color: '#EA580C', flexShrink: 0 }} />
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem', color: '#9A3412' }}>
              {areaId === 'cdm'
                ? `Potential Additional CDM Income: \u20AC${Math.round(unclaimed).toLocaleString()}`
                : `\u20AC${Math.round(unclaimed).toLocaleString()} potential unclaimed`
              }
            </p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#C2410C' }}>
              {areaId === 'cdm'
                ? 'Based on disease register patients and 75% target uptake rate'
                : 'Difference between current income and estimated potential'
              }
            </p>
          </div>
        </div>
      )}

      {/* Bar chart */}
      {(actual > 0 || potential > 0) && (
        <div style={{
          padding: '1rem',
          backgroundColor: COLORS.white,
          borderRadius: '0.5rem',
          border: `1px solid ${COLORS.lightGray}`
        }}>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" fontSize={13} />
              <YAxis
                tickFormatter={(v) => `\u20AC${v >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v)}`}
                fontSize={12}
              />
              <Tooltip
                formatter={(v) => [`\u20AC${Math.round(v).toLocaleString()}`, '']}
                contentStyle={{ borderRadius: '0.375rem', fontSize: '0.875rem' }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={80}>
                {chartData.map((entry, index) => (
                  <rect key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Key findings (skipped for Leave — the breakdown already shows the same info) */}
      {showFindings && (
        <div style={{
          padding: '1rem',
          backgroundColor: COLORS.white,
          borderRadius: '0.5rem',
          border: `1px solid ${COLORS.lightGray}`
        }}>
          <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 600, color: COLORS.darkGray }}>
            Key Findings
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {findings.map((finding, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
                fontSize: '0.85rem',
                color: COLORS.darkGray
              }}>
                <span style={{ color: finding.type === 'issue' ? COLORS.expenseColor : COLORS.incomeColor, fontWeight: 600 }}>
                  {finding.type === 'issue' ? '!' : '\u2713'}
                </span>
                <span>{finding.message}</span>
                {finding.value > 0 && (
                  <span style={{ marginLeft: 'auto', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {'\u20AC'}{finding.value.toLocaleString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed breakdown (always visible) */}
      {breakdown && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#FAFAFA',
          borderRadius: '0.5rem',
          border: `1px solid ${COLORS.lightGray}`
        }}>
          {renderCategoryBreakdown(areaId, breakdown, healthCheckData)}
        </div>
      )}
    </div>
  );
};

export default AreaAnalysisPanel;

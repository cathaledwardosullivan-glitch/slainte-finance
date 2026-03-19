import React, { useState, useMemo } from 'react';
import { CheckCircle, AlertCircle, TrendingUp, Users, User, ChevronDown, ChevronUp, Info } from 'lucide-react';
import COLORS from '../../utils/colors';
import gmsRates from '../../data/gmsRates';
import { usePracticeProfile } from '../../hooks/usePracticeProfile';

/**
 * Shared currency formatter
 */
const formatCurrency = (value) => new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
}).format(value || 0);

// ─── Shared style helpers ───────────────────────────────────────────
const cardStyle = {
  padding: '1rem',
  borderRadius: '0.5rem',
  border: `1px solid ${COLORS.borderLight}`,
  backgroundColor: COLORS.white
};

const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' };
const thBase = { padding: '0.5rem', border: `1px solid ${COLORS.borderLight}` };
const tdBase = { padding: '0.5rem', border: `1px solid ${COLORS.borderLight}` };
const headerRow = { backgroundColor: COLORS.bgPage };

const sectionHeading = (icon, text) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
    {icon}
    <h5 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: COLORS.textPrimary }}>{text}</h5>
  </div>
);

const statusBadge = (status, text) => {
  const colors = {
    ok: { bg: COLORS.successLighter, color: COLORS.successText },
    gap: { bg: COLORS.errorLight, color: COLORS.errorText },
    review: { bg: COLORS.warningLight, color: COLORS.warningText },
    opportunity: { bg: COLORS.successLighter, color: COLORS.successText },
    info: { bg: `${COLORS.slainteBlue}15`, color: COLORS.slainteBlue },
    paid: { bg: COLORS.successLighter, color: COLORS.successText },
    nopay: { bg: COLORS.errorLight, color: COLORS.errorText }
  };
  const c = colors[status] || colors.info;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0.125rem 0.5rem',
      borderRadius: '9999px',
      fontSize: '0.75rem',
      fontWeight: 500,
      backgroundColor: c.bg,
      color: c.color
    }}>
      {text}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// 1. STC BREAKDOWN
// ═══════════════════════════════════════════════════════════════════════
export const STCBreakdown = ({ stcAnalysis }) => {
  const [showAllCodes, setShowAllCodes] = useState(false);
  const [showTargetInfo, setShowTargetInfo] = useState(false);
  const [showDormantCodes, setShowDormantCodes] = useState(false);

  if (!stcAnalysis) return null;

  const currentActivity = stcAnalysis.currentActivity || {};
  const activeCodes = Object.values(currentActivity)
    .filter(code => code.actualCount > 0 && !['cdm', 'ocf', 'pp'].includes(code.category))
    .sort((a, b) => b.actualCount - a.actualCount);
  const totalClaims = activeCodes.reduce((sum, c) => sum + c.actualCount, 0);
  const totalValue = activeCodes.reduce((sum, c) => sum + c.actualTotal, 0);
  const zeroClaimCodes = Object.values(currentActivity)
    .filter(code => code.actualCount === 0 && !['cdm', 'ocf', 'pp'].includes(code.category))
    .sort((a, b) => a.code.localeCompare(b.code));

  // Top 3 by claims (strengths)
  const topByClaims = activeCodes.slice(0, 3);

  // Top 3 by negative difference in value (biggest gaps)
  const topByGap = activeCodes
    .filter(c => c.expectedAnnual && c.expectedAnnual > 0)
    .map(c => ({ ...c, gapValue: (c.actualCount - c.expectedAnnual) * c.fee }))
    .sort((a, b) => a.gapValue - b.gapValue)
    .filter(c => c.gapValue < 0)
    .slice(0, 3);

  // Codes with benchmarks (for the "How are targets calculated?" section)
  const codesWithBenchmarks = Object.values(currentActivity)
    .filter(c => c.benchmarkBasis && !['cdm', 'ocf', 'pp'].includes(c.category))
    .sort((a, b) => a.code.localeCompare(b.code));

  // All codes below target (active under-claimers + zero-claim codes with a target), sorted by potential value
  const allBelowTarget = Object.values(currentActivity)
    .filter(c => !['cdm', 'ocf', 'pp'].includes(c.category) && c.expectedAnnual && c.expectedAnnual > 0 && c.actualCount < c.expectedAnnual)
    .map(c => ({ ...c, gap: c.actualCount - c.expectedAnnual, potentialValue: (c.expectedAnnual - c.actualCount) * c.fee }))
    .sort((a, b) => b.potentialValue - a.potentialValue);

  // Zero-claim codes with no benchmark (dormant/unquantifiable)
  const dormantCodes = zeroClaimCodes.filter(c => !c.expectedAnnual);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Activity by Service Code table */}
      {stcAnalysis.hasData ? (
        <div style={cardStyle}>
          {sectionHeading(
            <CheckCircle style={{ width: '1rem', height: '1rem', color: COLORS.incomeColor }} />,
            'STC Activity by Service Code (PCRS Data)'
          )}

          {/* Summary line */}
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: COLORS.textPrimary }}>
            <strong>{totalClaims}</strong> claims across <strong>{activeCodes.length}</strong> codes totalling <strong style={{ color: COLORS.incomeColor }}>{formatCurrency(totalValue)}</strong>
          </p>

          {/* Top Performers */}
          {topByClaims.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <p style={{ margin: '0 0 0.375rem', fontSize: '0.8rem', fontWeight: 600, color: COLORS.textPrimary }}>Most Active</p>
              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={headerRow}>
                      <th style={{ ...thBase, textAlign: 'left' }} rowSpan={2}>Code</th>
                      <th style={{ ...thBase, textAlign: 'left' }} rowSpan={2}>Service</th>
                      <th style={{ ...thBase, textAlign: 'right' }} rowSpan={2}>Fee</th>
                      <th style={{ ...thBase, textAlign: 'center', borderBottom: 'none', paddingBottom: 0 }} colSpan={2}>Claims</th>
                      <th style={{ ...thBase, textAlign: 'center', borderBottom: 'none', paddingBottom: 0 }} colSpan={2}>Target</th>
                      <th style={{ ...thBase, textAlign: 'center', borderBottom: 'none', paddingBottom: 0 }} colSpan={2}>Difference</th>
                    </tr>
                    <tr style={headerRow}>
                      <th style={{ ...thBase, textAlign: 'right', fontSize: '0.7rem', fontWeight: 400, paddingTop: 0 }}>#</th>
                      <th style={{ ...thBase, textAlign: 'right', fontSize: '0.7rem', fontWeight: 400, paddingTop: 0 }}>Value</th>
                      <th style={{ ...thBase, textAlign: 'right', fontSize: '0.7rem', fontWeight: 400, paddingTop: 0 }}>#</th>
                      <th style={{ ...thBase, textAlign: 'right', fontSize: '0.7rem', fontWeight: 400, paddingTop: 0 }}>Value</th>
                      <th style={{ ...thBase, textAlign: 'right', fontSize: '0.7rem', fontWeight: 400, paddingTop: 0 }}>#</th>
                      <th style={{ ...thBase, textAlign: 'right', fontSize: '0.7rem', fontWeight: 400, paddingTop: 0 }}>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topByClaims.map((codeData, idx) => {
                      const target = codeData.expectedAnnual;
                      const gap = target ? codeData.actualCount - target : null;
                      const gapValue = gap !== null ? gap * codeData.fee : null;
                      const diffColor = gap === null ? COLORS.textSecondary : gap >= 0 ? COLORS.successDark : COLORS.warningDark;
                      return (
                        <tr key={idx}>
                          <td style={{ ...tdBase, fontFamily: 'monospace', fontWeight: 600, color: COLORS.slainteBlue }}>{codeData.code}</td>
                          <td style={{ ...tdBase, fontSize: '0.875rem' }}>{codeData.name}</td>
                          <td style={{ ...tdBase, textAlign: 'right', color: COLORS.textSecondary }}>{formatCurrency(codeData.fee)}</td>
                          <td style={{ ...tdBase, textAlign: 'right', fontWeight: 500 }}>{codeData.actualCount}</td>
                          <td style={{ ...tdBase, textAlign: 'right', color: COLORS.textSecondary }}>{formatCurrency(codeData.actualTotal)}</td>
                          <td style={{ ...tdBase, textAlign: 'right' }}>{target ? `~${target}` : '\u2014'}</td>
                          <td style={{ ...tdBase, textAlign: 'right', color: COLORS.textSecondary }}>{target ? formatCurrency(target * codeData.fee) : ''}</td>
                          <td style={{ ...tdBase, textAlign: 'right', fontWeight: 500, color: diffColor }}>
                            {gap !== null ? `${gap > 0 ? '+' : ''}${gap}` : '\u2014'}
                          </td>
                          <td style={{ ...tdBase, textAlign: 'right', color: diffColor }}>
                            {gapValue !== null ? `${gapValue > 0 ? '+' : ''}${formatCurrency(gapValue)}` : ''}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Biggest Gaps */}
          {topByGap.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <p style={{ margin: '0 0 0.375rem', fontSize: '0.8rem', fontWeight: 600, color: COLORS.textPrimary }}>Biggest Gaps</p>
              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={headerRow}>
                      <th style={{ ...thBase, textAlign: 'left' }} rowSpan={2}>Code</th>
                      <th style={{ ...thBase, textAlign: 'left' }} rowSpan={2}>Service</th>
                      <th style={{ ...thBase, textAlign: 'right' }} rowSpan={2}>Fee</th>
                      <th style={{ ...thBase, textAlign: 'center', borderBottom: 'none', paddingBottom: 0 }} colSpan={2}>Claims</th>
                      <th style={{ ...thBase, textAlign: 'center', borderBottom: 'none', paddingBottom: 0 }} colSpan={2}>Target</th>
                      <th style={{ ...thBase, textAlign: 'center', borderBottom: 'none', paddingBottom: 0 }} colSpan={2}>Difference</th>
                    </tr>
                    <tr style={headerRow}>
                      <th style={{ ...thBase, textAlign: 'right', fontSize: '0.7rem', fontWeight: 400, paddingTop: 0 }}>#</th>
                      <th style={{ ...thBase, textAlign: 'right', fontSize: '0.7rem', fontWeight: 400, paddingTop: 0 }}>Value</th>
                      <th style={{ ...thBase, textAlign: 'right', fontSize: '0.7rem', fontWeight: 400, paddingTop: 0 }}>#</th>
                      <th style={{ ...thBase, textAlign: 'right', fontSize: '0.7rem', fontWeight: 400, paddingTop: 0 }}>Value</th>
                      <th style={{ ...thBase, textAlign: 'right', fontSize: '0.7rem', fontWeight: 400, paddingTop: 0 }}>#</th>
                      <th style={{ ...thBase, textAlign: 'right', fontSize: '0.7rem', fontWeight: 400, paddingTop: 0 }}>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topByGap.map((codeData, idx) => {
                      const target = codeData.expectedAnnual;
                      const gap = codeData.actualCount - target;
                      const gapValue = gap * codeData.fee;
                      return (
                        <tr key={idx}>
                          <td style={{ ...tdBase, fontFamily: 'monospace', fontWeight: 600, color: COLORS.slainteBlue }}>{codeData.code}</td>
                          <td style={{ ...tdBase, fontSize: '0.875rem' }}>{codeData.name}</td>
                          <td style={{ ...tdBase, textAlign: 'right', color: COLORS.textSecondary }}>{formatCurrency(codeData.fee)}</td>
                          <td style={{ ...tdBase, textAlign: 'right', fontWeight: 500 }}>{codeData.actualCount}</td>
                          <td style={{ ...tdBase, textAlign: 'right', color: COLORS.textSecondary }}>{formatCurrency(codeData.actualTotal)}</td>
                          <td style={{ ...tdBase, textAlign: 'right' }}>~{target}</td>
                          <td style={{ ...tdBase, textAlign: 'right', color: COLORS.textSecondary }}>{formatCurrency(target * codeData.fee)}</td>
                          <td style={{ ...tdBase, textAlign: 'right', fontWeight: 500, color: COLORS.warningDark }}>{gap}</td>
                          <td style={{ ...tdBase, textAlign: 'right', color: COLORS.warningDark }}>{formatCurrency(gapValue)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Show All Codes (collapsible) */}
          {activeCodes.length > 3 && (
            <div style={{
              marginBottom: '0.75rem',
              borderRadius: '0.25rem',
              border: `1px solid ${COLORS.borderLight}`,
              overflow: 'hidden'
            }}>
              <button
                onClick={() => setShowAllCodes(!showAllCodes)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '0.6rem 0.75rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: COLORS.textPrimary }}>
                  Show all {activeCodes.length} active codes
                </span>
                <ChevronDown size={14} style={{
                  color: COLORS.textSecondary,
                  transition: 'transform 0.2s',
                  transform: showAllCodes ? 'rotate(180deg)' : 'none'
                }} />
              </button>
              {showAllCodes && (
                <div style={{ padding: '0 0.75rem 0.75rem', overflowX: 'auto' }}>
                  <table style={tableStyle}>
                    <thead>
                      <tr style={headerRow}>
                        <th style={{ ...thBase, textAlign: 'left' }} rowSpan={2}>Code</th>
                        <th style={{ ...thBase, textAlign: 'left' }} rowSpan={2}>Service</th>
                        <th style={{ ...thBase, textAlign: 'right' }} rowSpan={2}>Fee</th>
                        <th style={{ ...thBase, textAlign: 'center', borderBottom: 'none', paddingBottom: 0 }} colSpan={2}>Claims</th>
                        <th style={{ ...thBase, textAlign: 'center', borderBottom: 'none', paddingBottom: 0 }} colSpan={2}>Target</th>
                        <th style={{ ...thBase, textAlign: 'center', borderBottom: 'none', paddingBottom: 0 }} colSpan={2}>Difference</th>
                      </tr>
                      <tr style={headerRow}>
                        <th style={{ ...thBase, textAlign: 'right', fontSize: '0.7rem', fontWeight: 400, paddingTop: 0 }}>#</th>
                        <th style={{ ...thBase, textAlign: 'right', fontSize: '0.7rem', fontWeight: 400, paddingTop: 0 }}>Value</th>
                        <th style={{ ...thBase, textAlign: 'right', fontSize: '0.7rem', fontWeight: 400, paddingTop: 0 }}>#</th>
                        <th style={{ ...thBase, textAlign: 'right', fontSize: '0.7rem', fontWeight: 400, paddingTop: 0 }}>Value</th>
                        <th style={{ ...thBase, textAlign: 'right', fontSize: '0.7rem', fontWeight: 400, paddingTop: 0 }}>#</th>
                        <th style={{ ...thBase, textAlign: 'right', fontSize: '0.7rem', fontWeight: 400, paddingTop: 0 }}>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeCodes.map((codeData, idx) => {
                        const target = codeData.expectedAnnual;
                        const gap = target ? codeData.actualCount - target : null;
                        const gapValue = gap !== null ? gap * codeData.fee : null;
                        const diffColor = gap === null ? COLORS.textSecondary : gap >= 0 ? COLORS.successDark : COLORS.warningDark;
                        return (
                          <tr key={idx}>
                            <td style={{ ...tdBase, fontFamily: 'monospace', fontWeight: 600, color: COLORS.slainteBlue }}>{codeData.code}</td>
                            <td style={{ ...tdBase, fontSize: '0.875rem' }}>{codeData.name}</td>
                            <td style={{ ...tdBase, textAlign: 'right', color: COLORS.textSecondary }}>{formatCurrency(codeData.fee)}</td>
                            <td style={{ ...tdBase, textAlign: 'right', fontWeight: 500 }}>{codeData.actualCount}</td>
                            <td style={{ ...tdBase, textAlign: 'right', color: COLORS.textSecondary }}>{formatCurrency(codeData.actualTotal)}</td>
                            <td style={{ ...tdBase, textAlign: 'right' }}>{target ? `~${target}` : '\u2014'}</td>
                            <td style={{ ...tdBase, textAlign: 'right', color: COLORS.textSecondary }}>{target ? formatCurrency(target * codeData.fee) : ''}</td>
                            <td style={{ ...tdBase, textAlign: 'right', fontWeight: 500, color: diffColor }}>
                              {gap !== null ? `${gap > 0 ? '+' : ''}${gap}` : '\u2014'}
                            </td>
                            <td style={{ ...tdBase, textAlign: 'right', color: diffColor }}>
                              {gapValue !== null ? `${gapValue > 0 ? '+' : ''}${formatCurrency(gapValue)}` : ''}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Total row */}
                      <tr style={headerRow}>
                        <td colSpan={3} style={{ ...tdBase, fontWeight: 700 }}>Total STC</td>
                        <td style={{ ...tdBase, textAlign: 'right', fontWeight: 700 }}>{totalClaims}</td>
                        <td style={{ ...tdBase, textAlign: 'right', fontWeight: 700 }}>{formatCurrency(totalValue)}</td>
                        <td colSpan={2} style={tdBase}></td>
                        <td colSpan={2} style={tdBase}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Panel size reference */}
          {stcAnalysis.panelSize > 0 && (
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: COLORS.textSecondary }}>
              Based on panel size of {stcAnalysis.panelSize.toLocaleString()} GMS patients
            </p>
          )}

          {/* How are targets calculated? (collapsible) */}
          {codesWithBenchmarks.length > 0 && (
            <div style={{
              borderRadius: '0.25rem',
              border: `1px solid ${COLORS.borderLight}`,
              overflow: 'hidden'
            }}>
              <button
                onClick={() => setShowTargetInfo(!showTargetInfo)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '0.6rem 0.75rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', fontWeight: 600, color: COLORS.textPrimary }}>
                  <Info size={14} style={{ color: COLORS.slainteBlue }} />
                  How are targets calculated?
                </span>
                <ChevronDown size={14} style={{
                  color: COLORS.textSecondary,
                  transition: 'transform 0.2s',
                  transform: showTargetInfo ? 'rotate(180deg)' : 'none'
                }} />
              </button>
              {showTargetInfo && (
                <div style={{ padding: '0 0.75rem 0.75rem' }}>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: COLORS.textSecondary }}>
                    Targets are estimated from national PCRS claims data scaled to your panel size.
                    Contraception targets use your practice's demographic data where available.
                    The tilde (~) indicates these are estimates, not contractual targets.
                  </p>
                  <table style={{ ...tableStyle, fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={headerRow}>
                        <th style={{ ...thBase, textAlign: 'left', padding: '0.375rem' }}>Code</th>
                        <th style={{ ...thBase, textAlign: 'right', padding: '0.375rem' }}>Target</th>
                        <th style={{ ...thBase, textAlign: 'left', padding: '0.375rem' }}>Basis</th>
                      </tr>
                    </thead>
                    <tbody>
                      {codesWithBenchmarks.map((c, idx) => (
                        <tr key={idx}>
                          <td style={{ ...tdBase, fontFamily: 'monospace', fontWeight: 600, color: COLORS.slainteBlue, padding: '0.375rem' }}>{c.code}</td>
                          <td style={{ ...tdBase, textAlign: 'right', padding: '0.375rem' }}>{c.expectedAnnual ? `~${c.expectedAnnual}` : '\u2014'}</td>
                          <td style={{ ...tdBase, fontSize: '0.75rem', color: COLORS.textSecondary, padding: '0.375rem' }}>{c.benchmarkBasis}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '1.5rem' }}>
          {stcAnalysis.hasTotalOnly && stcAnalysis.totalSTCPayment > 0 && (
            <div style={{ marginBottom: '1rem', padding: '1rem', borderRadius: '0.5rem', backgroundColor: COLORS.bgPage }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: COLORS.textPrimary }}>
                Your PCRS data shows <strong style={{ color: COLORS.incomeColor }}>{formatCurrency(stcAnalysis.totalSTCPayment)}</strong> in STC income
              </p>
            </div>
          )}
          <AlertCircle style={{ width: '2rem', height: '2rem', margin: '0 auto 0.75rem', color: COLORS.warning }} />
          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 500, color: COLORS.textPrimary }}>
            Detailed STC Analysis Requires Re-Upload
          </p>
          <p style={{ margin: '0.5rem auto 0', fontSize: '0.75rem', color: COLORS.textSecondary, maxWidth: '28rem' }}>
            Your PCRS statements were uploaded before this feature was added. To see detailed STC analysis by service code,
            please go to GMS Panel Analysis, delete your existing statements, and re-upload them.
          </p>
        </div>
      )}

      {/* Growth Opportunities */}
      {(allBelowTarget.length > 0 || dormantCodes.length > 0) && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <TrendingUp style={{ width: '1rem', height: '1rem', color: COLORS.successDark }} />
            <h5 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: COLORS.textPrimary }}>Growth Opportunities</h5>
          </div>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: COLORS.textSecondary }}>
            Top 5 services below target, ranked by potential value.
          </p>

          {allBelowTarget.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={headerRow}>
                    <th style={{ ...thBase, textAlign: 'left' }}>Code</th>
                    <th style={{ ...thBase, textAlign: 'left' }}>Service</th>
                    <th style={{ ...thBase, textAlign: 'right' }}>Gap</th>
                    <th style={{ ...thBase, textAlign: 'right' }}>Potential</th>
                  </tr>
                </thead>
                <tbody>
                  {allBelowTarget.slice(0, 5).map((c, idx) => (
                    <tr key={idx}>
                      <td style={{ ...tdBase, fontFamily: 'monospace', fontWeight: 600, color: COLORS.slainteBlue }}>{c.code}</td>
                      <td style={{ ...tdBase, fontSize: '0.875rem' }}>{c.name}</td>
                      <td style={{ ...tdBase, textAlign: 'right', color: COLORS.warningDark }}>{c.gap}</td>
                      <td style={{ ...tdBase, textAlign: 'right', fontWeight: 500, color: COLORS.successDark }}>+{formatCurrency(c.potentialValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Total Growth Potential */}
          {allBelowTarget.length > 0 && (
            <div style={{
              marginTop: '0.75rem',
              paddingTop: '0.75rem',
              borderTop: `1px solid ${COLORS.borderLight}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: COLORS.textPrimary }}>Total Growth Potential:</p>
              <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: COLORS.successDark }}>
                +{formatCurrency(allBelowTarget.reduce((sum, c) => sum + c.potentialValue, 0))}/year
              </p>
            </div>
          )}

          {/* Dormant codes — 0 claims, no benchmark */}
          {dormantCodes.length > 0 && (
            <div style={{
              marginTop: '0.75rem',
              borderRadius: '0.25rem',
              border: `1px solid ${COLORS.borderLight}`,
              overflow: 'hidden'
            }}>
              <button
                onClick={() => setShowDormantCodes(!showDormantCodes)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '0.6rem 0.75rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: COLORS.textSecondary }}>
                  {dormantCodes.length} services with 0 claims and no benchmark
                </span>
                <ChevronDown size={14} style={{
                  color: COLORS.textSecondary,
                  transition: 'transform 0.2s',
                  transform: showDormantCodes ? 'rotate(180deg)' : 'none'
                }} />
              </button>
              {showDormantCodes && (
                <div style={{ padding: '0 0.75rem 0.6rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {dormantCodes.map((code, idx) => (
                    <p key={idx} style={{ margin: 0, fontSize: '0.75rem', color: COLORS.textSecondary }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{code.code}</span>: {code.name}
                      <span style={{ color: COLORS.textMuted }}> ({'\u20AC'}{code.fee})</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Success message */}
      {(!stcAnalysis.opportunities || stcAnalysis.opportunities.length === 0) && stcAnalysis.hasData && (
        <div style={{
          padding: '1rem',
          borderRadius: '0.5rem',
          border: `2px solid ${COLORS.successDark}`,
          backgroundColor: COLORS.successLight,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <CheckCircle style={{ width: '1.25rem', height: '1.25rem', color: COLORS.successDark }} />
          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 500, color: COLORS.successText }}>
            Your STC activity is well-aligned with expected benchmarks for your panel size.
          </p>
        </div>
      )}
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════════════
// 2. LEAVE BREAKDOWN
// ═══════════════════════════════════════════════════════════════════════
export const LeaveBreakdown = ({ leaveDetails }) => {
  if (!leaveDetails) return <p style={{ margin: 0, color: COLORS.textSecondary }}>No leave calculation data available.</p>;

  const dailyRate = leaveDetails.studyLeavePotential > 0 && leaveDetails.studyLeaveEntitlement > 0
    ? leaveDetails.studyLeavePotential / leaveDetails.studyLeaveEntitlement
    : 197.24;

  // Build structured rows
  const rows = [];
  if (leaveDetails.studyLeaveEntitlement > 0 || leaveDetails.studyLeavePotential > 0) {
    rows.push({
      category: 'Study Leave',
      entitledDays: leaveDetails.studyLeaveEntitlement || 0,
      claimedDays: (leaveDetails.studyLeaveEntitlement || 0) - (leaveDetails.studyLeaveUnclaimedDays || 0),
      unclaimedDays: leaveDetails.studyLeaveUnclaimedDays || 0,
      entitledValue: leaveDetails.studyLeavePotential || 0,
      claimedValue: leaveDetails.actualStudyLeave || 0,
      unclaimedValue: leaveDetails.studyLeaveUnclaimedValue || 0
    });
  }
  if (leaveDetails.annualLeaveEntitlement > 0 || leaveDetails.annualLeavePotential > 0) {
    rows.push({
      category: 'Annual Leave',
      entitledDays: leaveDetails.annualLeaveEntitlement || 0,
      claimedDays: (leaveDetails.annualLeaveEntitlement || 0) - (leaveDetails.annualLeaveUnclaimedDays || 0),
      unclaimedDays: leaveDetails.annualLeaveUnclaimedDays || 0,
      entitledValue: leaveDetails.annualLeavePotential || 0,
      claimedValue: leaveDetails.actualAnnualLeave || 0,
      unclaimedValue: leaveDetails.annualLeaveUnclaimedValue || 0
    });
  }
  const totalUnclaimed = (leaveDetails.studyLeaveUnclaimedValue || 0) + (leaveDetails.annualLeaveUnclaimedValue || 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Study Leave unclaimed callout */}
      {leaveDetails.studyLeaveUnclaimedDays > 0 && (
        <div style={{
          padding: '0.75rem',
          borderRadius: '0.25rem',
          backgroundColor: COLORS.warningLight,
          border: `1px solid ${COLORS.warning}`
        }}>
          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 500, color: COLORS.warningText }}>
            Study Leave: {leaveDetails.studyLeaveUnclaimedDays} days unclaimed = {formatCurrency(leaveDetails.studyLeaveUnclaimedValue)} potential income
          </p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: COLORS.warningText }}>
            Claim study leave by submitting CME certificates.
          </p>
        </div>
      )}

      {/* Annual Leave unclaimed callout */}
      {leaveDetails.annualLeaveUnclaimedDays > 0 && (
        <div style={{
          padding: '0.75rem',
          borderRadius: '0.25rem',
          backgroundColor: COLORS.infoLighter,
          border: `1px solid ${COLORS.slainteBlue}`
        }}>
          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 500, color: COLORS.infoText }}>
            Annual Leave: {leaveDetails.annualLeaveUnclaimedDays} days unclaimed = {formatCurrency(leaveDetails.annualLeaveUnclaimedValue)} potential income
          </p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: COLORS.infoText }}>
            Claim annual leave via PCRS form submission.
          </p>
        </div>
      )}

      {/* Explanation */}
      <p style={{ margin: 0, fontSize: '0.85rem', color: COLORS.textPrimary }}>
        Leave entitlements are calculated based on your GMS panel(s). Each panel is entitled to
        10 study leave days and up to 20 annual leave days per year, at {'\u20AC'}{dailyRate.toFixed(2)} per day.
      </p>

      {/* Detailed table */}
      {rows.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${COLORS.borderLight}` }}>
              <th style={{ textAlign: 'left', padding: '0.5rem', color: COLORS.textSecondary, fontWeight: 500 }}>Category</th>
              <th style={{ textAlign: 'right', padding: '0.5rem', color: COLORS.textSecondary, fontWeight: 500 }}>Entitled</th>
              <th style={{ textAlign: 'right', padding: '0.5rem', color: COLORS.textSecondary, fontWeight: 500 }}>Claimed</th>
              <th style={{ textAlign: 'right', padding: '0.5rem', color: COLORS.textSecondary, fontWeight: 500 }}>Unclaimed</th>
              <th style={{ textAlign: 'right', padding: '0.5rem', color: COLORS.textSecondary, fontWeight: 500 }}>Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${COLORS.borderLight}` }}>
                <td style={{ padding: '0.5rem', color: COLORS.textPrimary, fontWeight: 500 }}>{row.category}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right', color: COLORS.textPrimary }}>{row.entitledDays} days</td>
                <td style={{ padding: '0.5rem', textAlign: 'right', color: COLORS.incomeColor }}>{row.claimedDays} days</td>
                <td style={{
                  padding: '0.5rem',
                  textAlign: 'right',
                  color: row.unclaimedDays > 0 ? COLORS.expenseColor : COLORS.textPrimary,
                  fontWeight: row.unclaimedDays > 0 ? 600 : 400
                }}>
                  {row.unclaimedDays} days
                </td>
                <td style={{
                  padding: '0.5rem',
                  textAlign: 'right',
                  fontWeight: 600,
                  color: row.unclaimedDays > 0 ? COLORS.expenseColor : COLORS.textPrimary
                }}>
                  {row.unclaimedValue > 0 ? `\u20AC${row.unclaimedValue.toLocaleString()}` : '\u2014'}
                </td>
              </tr>
            ))}
            {/* Total row */}
            {rows.length > 1 && totalUnclaimed > 0 && (
              <tr style={{ borderTop: `2px solid ${COLORS.borderLight}`, backgroundColor: COLORS.bgPage }}>
                <td colSpan={3} style={{ padding: '0.5rem', fontWeight: 600, color: COLORS.textPrimary }}>Total Unclaimed</td>
                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600, color: COLORS.expenseColor }}>
                  {(leaveDetails.studyLeaveUnclaimedDays || 0) + (leaveDetails.annualLeaveUnclaimedDays || 0)} days
                </td>
                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700, color: COLORS.expenseColor }}>
                  {'\u20AC'}{totalUnclaimed.toLocaleString()}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {/* Source note */}
      <p style={{ margin: 0, fontSize: '0.75rem', color: COLORS.textSecondary, fontStyle: 'italic' }}>
        Source: Leave entitlements and balances from your uploaded PCRS statements.
      </p>
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════════════
// 3a. CDM GROWTH POTENTIAL TABLE
// ═══════════════════════════════════════════════════════════════════════
// EHR-specific CDM guidance keyed by ehrSystem value from practice profile
const CDM_EHR_GUIDANCE = {
  socrates: {
    name: 'Socrates',
    identify: `In Socrates, go to My Control Panel \u2192 Patient Finder \u2192 New List \u2192 Patients \u2192 CDM Registrations to see all CDM-enrolled patients. To find patients who may be eligible but not yet enrolled, use Reports \u2192 Patients \u2192 Patients with Multiple Conditions and search by ICPC-2 code (e.g. T90 for Type 2 Diabetes, R96 for Asthma, K77 for Heart Failure). Also run a Medication Report for CDM-related drugs (e.g. Metformin, inhalers, anticoagulants) to catch patients who are being treated but don't have a diagnosis coded.`,
    recall: `Socrates supports date-based recalls. Set a 6-month recall from the patient's CDM review date so they are automatically flagged when due. View overdue patients from the Recalls section and generate batch recall lists for letters or texts. Some CDM recalls are automatically generated from the programme schedule \u2014 check your recall list regularly for overdue patients.`,
    submit: `After completing the structured review, go to the patient's CDM section and submit the claim via Healthlink. Socrates will assign the correct code based on the number of conditions (AO/AP/AQ for in-surgery, AR/AS/AT for phone). Check your Healthlink outbox to confirm successful submission.`
  },
  practicemanager: {
    name: 'Helix Practice Manager',
    identify: `In HPM, go to Reports \u2192 Diagnosis Report and search by ICPC-2 code (T90 for Diabetes, R96 for Asthma, R95 for COPD, K77 for Heart Failure, K78 for AF, K74/K76 for IHD, K90 for Stroke/TIA). The patient count appears at the top. Also check Tasks \u2192 Claim Tracker \u2192 Chronic Disease Tracker to see enrolled vs. unenrolled patients. HPM auto-populates the CDM diseases list from coded conditions in Medical History \u2014 ensure every patient has the correct ICPC-2 or ICD-10 code under Active conditions.`,
    recall: `Use HPM's Claim Tracker (Tasks \u2192 Claim Tracker \u2192 Chronic Disease Tracker) to monitor review status. Filter by "Incomplete" or "Unsent" to find patients due for review. Set recalls from the patient file to flag 6-month review dates. Batch-submit unsent claims when reviews are complete.`,
    submit: `Open the patient file \u2192 Protocols \u2192 Chronic Disease Management \u2192 Add Review. Complete all three phases (Registration \u2192 Review \u2192 Care Plan) and submit via Healthlink. Check the Claim Tracker regularly for rejected claims \u2014 common reasons include missing coding or patient registration issues.`
  },
  healthone: {
    name: 'HealthOne',
    identify: `In HealthOne, use the CDM Dashboard (Clinical/Programmes menu) to view all CDM-registered patients and their review status. For patients not yet enrolled, use the Database Analysis tool (Tools \u2192 Database Analysis) to search by condition, then filter by patient type (GMS/DVC). Cross-reference medication lists to find patients on CDM-related treatments who may not have a coded diagnosis.`,
    recall: `The HealthOne CDM Dashboard tracks review dates and flags overdue reviews. Filter by programme type (CDM Treatment, Prevention, OCF) and status to identify patients due for their 6-monthly review. Use the overdue list to prioritise patients and maintain a steady flow of reviews throughout the year.`,
    submit: `Complete the structured CDM review in the patient's CDM section and submit the claim via Healthlink. The CDM Dashboard shows pending submissions. Check for rejected or failed submissions and correct any issues promptly.`
  },
  completegp: {
    name: 'CompleteGP',
    identify: `In CompleteGP, use the Search Tool to find patients by condition code. CompleteGP supports SNOMED, ICD-10, ICPC-2, and LOINC \u2014 use whichever coding system your practice has adopted (ICPC-2 codes: T90 for Diabetes, R96 for Asthma, R95 for COPD, K77 for Heart Failure, K78 for AF, K74/K76 for IHD, K90 for Stroke/TIA). Filter by patient type (GMS/DVC) and export results to check counts. Search by medication to catch patients being treated without a coded diagnosis.`,
    recall: `Set up CDM review recalls within each patient's clinical record. Use the Search Tool to periodically generate lists of CDM patients, then check which are overdue for their 6-monthly review. CompleteGP's structured record keeping helps track care plan completion.`,
    submit: `Complete the structured review and record it in the patient's clinical file. Submit the CDM claim via Healthlink. Track review dates and care plans within the patient file to ensure the 6-month cycle is maintained.`
  }
};

const CDMGrowthPotentialTable = ({ growthPotential }) => {
  const [tipExpanded, setTipExpanded] = useState(false);
  const { profile } = usePracticeProfile();
  const ehrSystem = profile?.practiceDetails?.ehrSystem || '';
  const ehrGuide = CDM_EHR_GUIDANCE[ehrSystem] || null;
  const ehrName = ehrGuide?.name || 'your EHR';

  if (!growthPotential?.hasData) return null;

  return (
    <div style={{ ...cardStyle, marginTop: '1rem' }}>
      {sectionHeading(
        <TrendingUp style={{ width: '1rem', height: '1rem', color: COLORS.success }} />,
        'CDM Growth Potential (Based on Disease Registers)'
      )}
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: COLORS.textSecondary }}>
        Estimated additional income based on disease register patients with 75% target uptake rate.
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr style={headerRow}>
              <th style={{ ...thBase, textAlign: 'left' }}>Programme</th>
              <th style={{ ...thBase, textAlign: 'center' }}>Eligible</th>
              <th style={{ ...thBase, textAlign: 'center' }}>Expected/yr</th>
              <th style={{ ...thBase, textAlign: 'center' }}>Actual</th>
              <th style={{ ...thBase, textAlign: 'center' }}>Gap</th>
              <th style={{ ...thBase, textAlign: 'right' }}>Avg Fee</th>
              <th style={{ ...thBase, textAlign: 'right' }}>Potential</th>
            </tr>
          </thead>
          <tbody>
            {growthPotential.breakdown.map((item, idx) => (
              <React.Fragment key={idx}>
                <tr>
                  <td style={tdBase}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                      {item.category}
                    </span>
                    {item.code && (
                      <span style={{ marginLeft: '0.375rem', fontSize: '0.75rem', fontFamily: 'monospace', color: COLORS.textSecondary }}>({item.code})</span>
                    )}
                    <p style={{ margin: '0.125rem 0 0', fontSize: '0.75rem', color: COLORS.textSecondary }}>{item.description}</p>
                  </td>
                  <td style={{ ...tdBase, textAlign: 'center', fontWeight: 500 }}>{item.eligiblePatients}</td>
                  <td style={{ ...tdBase, textAlign: 'center', fontWeight: 500 }}>{item.expectedAnnual}</td>
                  <td style={{ ...tdBase, textAlign: 'center', fontWeight: 500 }}>{item.actualClaims}</td>
                  <td style={{ ...tdBase, textAlign: 'center', fontWeight: 600, color: item.gap > 0 ? COLORS.error : COLORS.successText }}>{item.gap}</td>
                  <td style={{ ...tdBase, textAlign: 'right', color: COLORS.textSecondary }}>{formatCurrency(item.avgFee || item.fee)}</td>
                  <td style={{ ...tdBase, textAlign: 'right', fontWeight: 600, color: item.potentialValue > 0 ? COLORS.success : COLORS.textPrimary }}>
                    {item.potentialValue > 0 ? `+${formatCurrency(item.potentialValue)}` : formatCurrency(0)}
                  </td>
                </tr>
                {/* Conditions sub-row */}
                {item.conditions && item.conditions.length > 0 && (
                  <tr>
                    <td colSpan={7} style={{ ...tdBase, padding: '0.25rem 0.5rem', backgroundColor: COLORS.bgPage, borderTop: 'none' }}>
                      <span style={{ fontSize: '0.7rem', color: COLORS.textSecondary }}>
                        {item.conditions.map(c => `${c.name} (${c.patients})`).join('  \u2022  ')}
                      </span>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {/* Total row */}
            <tr style={headerRow}>
              <td colSpan={6} style={{ ...tdBase, fontWeight: 700 }}>Total CDM Growth Potential</td>
              <td style={{ ...tdBase, textAlign: 'right', fontWeight: 700, color: COLORS.success }}>
                +{formatCurrency(growthPotential.totalValue)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Expandable TIP about maximising CDM income — EHR-specific */}
      <div style={{ marginTop: '0.75rem' }}>
        <div
          onClick={() => setTipExpanded(!tipExpanded)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.375rem',
            cursor: 'pointer', userSelect: 'none',
            padding: '0.5rem 0.625rem', borderRadius: '0.375rem',
            backgroundColor: COLORS.warningLight, border: `1px solid ${COLORS.warning}`
          }}
        >
          <Info style={{ width: '0.875rem', height: '0.875rem', color: COLORS.warningText, flexShrink: 0 }} />
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: COLORS.warningText, flex: 1 }}>
            TIP: How to close the CDM gap using {ehrName}
          </span>
          {tipExpanded
            ? <ChevronUp style={{ width: '0.875rem', height: '0.875rem', color: COLORS.warningText, flexShrink: 0 }} />
            : <ChevronDown style={{ width: '0.875rem', height: '0.875rem', color: COLORS.warningText, flexShrink: 0 }} />
          }
        </div>
        {tipExpanded && (
          <div style={{
            padding: '0.75rem', fontSize: '0.8rem', lineHeight: 1.5,
            color: COLORS.warningText, backgroundColor: COLORS.warningLighter,
            border: `1px solid ${COLORS.warning}`, borderTop: 'none',
            borderRadius: '0 0 0.375rem 0.375rem'
          }}>
            <p style={{ margin: '0 0 0.375rem', fontWeight: 600 }}>1. Identify all eligible patients</p>
            <p style={{ margin: '0 0 0.625rem' }}>
              {ehrGuide
                ? ehrGuide.identify
                : `Use your EHR's disease register or search tools to find every patient with an eligible chronic condition (Type 2 Diabetes, Asthma, COPD, Heart Failure, AF, IHD, Stroke/TIA) and ensure each has the correct ICPC-2 code recorded. Many practices under-claim because patients are not coded or not enrolled on the CDM programme. Run a search for patients on relevant medications who may not yet have a diagnosis coded.`
              }
            </p>
            <p style={{ margin: '0 0 0.375rem', fontWeight: 600 }}>2. Set up a recall system for 6-monthly reviews</p>
            <p style={{ margin: '0 0 0.625rem' }}>
              {ehrGuide
                ? ehrGuide.recall
                : `CDM reviews are payable every 6 months per patient. Configure your EHR to automatically flag patients due for review. A reliable recall system ensures no patient falls through the cracks and maintains a steady flow of claimable reviews throughout the year.`
              }
            </p>
            <p style={{ margin: '0 0 0.375rem', fontWeight: 600 }}>3. Complete and submit the review</p>
            <p style={{ margin: 0 }}>
              {ehrGuide
                ? ehrGuide.submit
                : `Each CDM patient should receive two structured reviews per year (every 6 months). The review must follow the HSE-agreed care pathway for the relevant condition. On completion, submit the appropriate PCRS claim code (AO/AP/AQ for in-surgery, AR/AS/AT for phone reviews) via Healthlink.`
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// 3b. CDM BREAKDOWN
// ═══════════════════════════════════════════════════════════════════════
export const CDMBreakdown = ({ cdmAnalysis }) => {
  if (!cdmAnalysis) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* CDM Claims table */}
      {cdmAnalysis.hasData && (
        <div style={cardStyle}>
          {sectionHeading(
            <CheckCircle style={{ width: '1rem', height: '1rem', color: COLORS.error }} />,
            'Current CDM Activity'
          )}
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: COLORS.textSecondary }}>
            CDM claims from your PCRS statements (AO/AP/AQ/AR/AS/AT in-surgery and phone reviews, BB Prevention Programme, BC Opportunistic Case Finding, AM Virtual Clinics).
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr style={headerRow}>
                  <th style={{ ...thBase, textAlign: 'left' }}>Code</th>
                  <th style={{ ...thBase, textAlign: 'left' }}>Service</th>
                  <th style={{ ...thBase, textAlign: 'center' }}>Claims</th>
                  <th style={{ ...thBase, textAlign: 'right' }}>Fee</th>
                  <th style={{ ...thBase, textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {cdmAnalysis.claims.map((claim, idx) => (
                  <tr key={idx}>
                    <td style={{ ...tdBase, fontFamily: 'monospace', fontWeight: 600, color: COLORS.error }}>{claim.code}</td>
                    <td style={tdBase}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{claim.name}</span>
                      {claim.description && (
                        <p style={{ margin: '0.125rem 0 0', fontSize: '0.75rem', color: COLORS.textSecondary }}>{claim.description}</p>
                      )}
                    </td>
                    <td style={{ ...tdBase, textAlign: 'center', fontWeight: 500 }}>{claim.count}</td>
                    <td style={{ ...tdBase, textAlign: 'right', color: COLORS.textSecondary }}>{formatCurrency(claim.fee)}</td>
                    <td style={{ ...tdBase, textAlign: 'right', fontWeight: 500, color: COLORS.incomeColor }}>{formatCurrency(claim.total)}</td>
                  </tr>
                ))}
                {/* Total row */}
                <tr style={headerRow}>
                  <td colSpan={2} style={{ ...tdBase, fontWeight: 700 }}>Total CDM Claims</td>
                  <td style={{ ...tdBase, textAlign: 'center', fontWeight: 700 }}>{cdmAnalysis.totalClaims}</td>
                  <td style={tdBase}></td>
                  <td style={{ ...tdBase, textAlign: 'right', fontWeight: 700, color: COLORS.incomeColor }}>{formatCurrency(cdmAnalysis.totalAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Growth Potential from disease registers */}
          {cdmAnalysis.growthPotential?.hasData && (
            <CDMGrowthPotentialTable growthPotential={cdmAnalysis.growthPotential} />
          )}

          {/* Tip when no disease register data */}
          {!cdmAnalysis.growthPotential?.hasData && (
            <div style={{
              marginTop: '1rem',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              backgroundColor: COLORS.warningLight,
              border: `1px solid ${COLORS.warning}`
            }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: COLORS.warningText }}>
                <strong>Tip:</strong> Enter your disease register counts in the Data Collection form to calculate CDM growth potential.
              </p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: COLORS.warningText }}>
                <strong>CDM Treatment:</strong> Type 2 Diabetes, Asthma, COPD, Heart Failure, AF, IHD, Stroke/TIA
              </p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: COLORS.warningText }}>
                <strong>Prevention Programme:</strong> Hypertension (18+), Pre-diabetes (45+), QRISK{'\u2265'}20%, GDM/Pre-eclampsia history
              </p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: COLORS.warningText }}>
                <strong>OCF:</strong> Patients 45+ with risk factors (smoker, BMI{'\u2265'}30, dyslipidaemia) not on CDM/PP
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════════════
// 4. CAPITATION BREAKDOWN
// ═══════════════════════════════════════════════════════════════════════
export const CapitationBreakdown = ({ capitationAnalysis }) => {
  if (!capitationAnalysis) return <p style={{ margin: 0, color: COLORS.textSecondary }}>No capitation analysis data available.</p>;

  const checks = capitationAnalysis.registrationChecks || [];
  const age5to8 = capitationAnalysis.age5to8Check;
  const panel = capitationAnalysis.panelAssessment;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Registration Status Table */}
      {checks.length > 0 && (
        <div style={cardStyle}>
          {sectionHeading(
            <CheckCircle style={{ width: '1rem', height: '1rem' }} />,
            'Registration Status (EHR vs PCRS)'
          )}
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr style={headerRow}>
                  <th style={{ ...thBase, textAlign: 'left' }}>Category</th>
                  <th style={{ ...thBase, textAlign: 'center' }}>EHR Count</th>
                  <th style={{ ...thBase, textAlign: 'center' }}>PCRS Registered</th>
                  <th style={{ ...thBase, textAlign: 'center' }}>Status</th>
                  <th style={{ ...thBase, textAlign: 'right' }}>Potential Value</th>
                </tr>
              </thead>
              <tbody>
                {checks.map((check, idx) => (
                  <tr key={idx}>
                    <td style={{ ...tdBase, fontWeight: 500 }}>{check.category}</td>
                    <td style={{ ...tdBase, textAlign: 'center' }}>{check.ehrCount}</td>
                    <td style={{ ...tdBase, textAlign: 'center' }}>{check.pcrsCount !== undefined ? check.pcrsCount : '\u2014'}</td>
                    <td style={{ ...tdBase, textAlign: 'center' }}>
                      {check.status === 'ok' && statusBadge('ok', check.statusText)}
                      {check.status === 'gap' && statusBadge('gap', `\u26A0\uFE0F ${check.statusText}`)}
                      {check.status === 'review' && statusBadge('review', `\uD83D\uDD0D ${check.statusText}`)}
                    </td>
                    <td style={{
                      ...tdBase,
                      textAlign: 'right',
                      fontWeight: 500,
                      color: check.potentialValue > 0 ? COLORS.incomeColor : COLORS.textSecondary
                    }}>
                      {check.potentialValue > 0 ? formatCurrency(check.potentialValue) : '\u2014'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Total Registration Gap Value */}
          {capitationAnalysis.totalPotentialValue > 0 && (
            <div style={{
              marginTop: '1rem',
              paddingTop: '0.75rem',
              borderTop: `1px solid ${COLORS.borderLight}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: COLORS.textPrimary }}>Total Registration Gap Value:</p>
              <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: COLORS.incomeColor }}>
                {formatCurrency(capitationAnalysis.totalPotentialValue)}/year
              </p>
            </div>
          )}
        </div>
      )}

      {/* Ages 5-8 Tip */}
      {age5to8 && age5to8.estimatedCount > 0 && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: '0.375rem',
          backgroundColor: COLORS.slainteBlueLight,
          border: '1px solid #BFDBFE',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.5rem'
        }}>
          <Info style={{ width: '1rem', height: '1rem', color: COLORS.slainteBlue, flexShrink: 0, marginTop: '1px' }} />
          <div style={{ fontSize: '0.8rem', color: COLORS.infoText, lineHeight: 1.5 }}>
            <strong>Tip:</strong> Children aged 5{'\u2013'}8 are entitled to a GP Visit Card but PCRS doesn{'\u2019'}t break down this age group separately.
            Consider running an age search in your EHR for patients aged 5{'\u2013'}8 to check their GMS/GP Visit Card status.
          </div>
        </div>
      )}

      {/* Panel Size Assessment */}
      {panel && (
        <div style={cardStyle}>
          {sectionHeading(
            <TrendingUp style={{ width: '1rem', height: '1rem' }} />,
            'Panel Size Overview'
          )}
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr style={headerRow}>
                  <th style={{ ...thBase, textAlign: 'left' }}></th>
                  <th style={{ ...thBase, textAlign: 'center' }}>GPs</th>
                  <th style={{ ...thBase, textAlign: 'center' }}>Panel Size</th>
                  <th style={{ ...thBase, textAlign: 'center' }}>Weighted Panel</th>
                  <th style={{ ...thBase, textAlign: 'center' }}>Weighted / GP</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...tdBase, fontWeight: 600 }}>Current</td>
                  <td style={{ ...tdBase, textAlign: 'center', fontWeight: 600 }}>{panel.numGPs || 'N/A'}</td>
                  <td style={{ ...tdBase, textAlign: 'center', fontWeight: 600 }}>{panel.currentPanelSize?.toLocaleString() || 'N/A'}</td>
                  <td style={{ ...tdBase, textAlign: 'center', fontWeight: 600 }}>{panel.weightedPanel?.toLocaleString() || 'N/A'}</td>
                  <td style={{ ...tdBase, textAlign: 'center', fontWeight: 600 }}>{panel.weightedPerGP?.toLocaleString() || 'N/A'}</td>
                </tr>
                <tr style={{ backgroundColor: COLORS.bgPage }}>
                  <td style={{ ...tdBase, fontWeight: 600, color: COLORS.textSecondary }}>Target</td>
                  <td style={{ ...tdBase, textAlign: 'center', color: COLORS.textSecondary }}>{'\u2014'}</td>
                  <td style={{ ...tdBase, textAlign: 'center', color: COLORS.textSecondary }}>
                    {panel.atSubsidyMax
                      ? <span>{panel.currentPanelSize?.toLocaleString()}</span>
                      : <span>
                          {panel.targetPanelSize?.toLocaleString()}
                          {panel.panelSizeShortfall > 0 && (
                            <span style={{ color: COLORS.incomeColor, fontSize: '0.75rem', marginLeft: '0.35rem' }}>
                              (+{panel.panelSizeShortfall?.toLocaleString()})
                            </span>
                          )}
                        </span>
                    }
                  </td>
                  <td style={{ ...tdBase, textAlign: 'center', color: COLORS.textSecondary }}>
                    {panel.targetWeightedTotal?.toLocaleString()}
                    {!panel.atSubsidyMax && panel.targetWeightedTotal - panel.weightedPanel > 0 && (
                      <span style={{ color: COLORS.incomeColor, fontSize: '0.75rem', marginLeft: '0.35rem' }}>
                        (+{(panel.targetWeightedTotal - panel.weightedPanel).toLocaleString()})
                      </span>
                    )}
                  </td>
                  <td style={{ ...tdBase, textAlign: 'center' }}>
                    {panel.atSubsidyMax
                      ? statusBadge('ok', `${panel.fullSubsidyTarget.toLocaleString()}`)
                      : <span style={{ color: COLORS.textSecondary }}>{panel.fullSubsidyTarget?.toLocaleString()}</span>
                    }
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p style={{ margin: '0.75rem 0 0', fontSize: '0.85rem', color: COLORS.textPrimary, lineHeight: 1.5 }}>
            {panel.recommendation}
          </p>
          {panel.note && (
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', fontStyle: 'italic', color: COLORS.textSecondary }}>
              {panel.note}
            </p>
          )}
          {panel.potentialValue > 0 && (
            <div style={{
              marginTop: '0.75rem',
              paddingTop: '0.75rem',
              borderTop: `1px solid ${COLORS.borderLight}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: COLORS.textPrimary }}>
                Each additional 100 patients could add approximately:
              </p>
              <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: COLORS.incomeColor }}>
                +{formatCurrency(panel.valuePer100)}/year
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════════════
// 5. PRACTICE SUPPORT BREAKDOWN
// ═══════════════════════════════════════════════════════════════════════

/** GMS rates for estimating subsidy values when the engine hasn't run */
const PS_RATES = {
  secretary: { 1: 22694, 2: 24586, 3: 26477 },
  nurse: { 1: 34041, 2: 35933, 3: 37824, 4: 41606 },
  practiceManager: { 1: 34041 }
};
const PS_MAX_POINTS = { secretary: 3, nurse: 4, practiceManager: 1 };
const FULL_TIME_HOURS = 35;

function getCorrectPoint(staffType, yearsExperience) {
  const maxPt = PS_MAX_POINTS[staffType] || 1;
  return Math.min(Math.max(1, Math.ceil(yearsExperience || 1)), maxPt);
}

function getRateForPoint(staffType, point) {
  return PS_RATES[staffType]?.[point] || 0;
}

const ROLE_LABELS = {
  secretary: 'Secretary',
  nurse: 'Practice Nurse',
  practiceManager: 'Practice Manager'
};

/**
 * Full-mode Practice Support rendering (extracted to use useState for collapsible)
 * Order: Summary table → collapsible Staff Status → Entitlement → Growth/Capacity → Success
 */
const PracticeSupportFullMode = ({
  allStaff, unregisteredStaff, recRow, nurseRow, issues, opportunities,
  entitlement, weightedPanel, numGPs, totalRecoverable, staffDetails, current, employed
}) => {
  const [showStaffDetail, setShowStaffDetail] = useState(false);
  const [showEntitlement, setShowEntitlement] = useState(false);

  // Compute per-staff stats by category — matches the individual staff table
  const perStaffStats = useMemo(() => {
    const entitled = entitlement?.totalHours || 0;
    const receptionists = allStaff.filter(s => s.staffType === 'secretary');
    const nursesPM = allStaff.filter(s => s.staffType === 'nurse' || s.staffType === 'practiceManager');
    const recUnreg = unregisteredStaff.filter(s => s.staffType === 'secretary');
    const nurseUnreg = unregisteredStaff.filter(s => s.staffType === 'nurse' || s.staffType === 'practiceManager');

    const compute = (registeredStaff, unregStaff) => {
      let pcrsHrs = 0, underpaidValue = 0, underpaidHrs = 0;
      let incrementIssues = 0, incrementValue = 0;

      registeredStaff.forEach(staff => {
        const staffName = `${staff.firstName} ${staff.surname}`;
        const matchedDetail = (staffDetails || []).find(sd => {
          const detailName = `${sd.firstName || ''} ${sd.surname || ''}`.trim();
          return detailName.toLowerCase() === staffName.toLowerCase();
        });

        const pHrs = staff.weeklyHours || 0;
        pcrsHrs += pHrs;

        const actualHrs = matchedDetail ? (parseFloat(matchedDetail.actualHoursWorked) || 0) : null;
        const claimable = actualHrs !== null ? Math.min(actualHrs, FULL_TIME_HOURS) : null;
        const gap = claimable !== null && claimable > pHrs ? claimable - pHrs : 0;
        underpaidHrs += gap;

        if (gap > 0) {
          const point = Math.min(staff.incrementPoint || 1, PS_MAX_POINTS[staff.staffType] || 1);
          const rate = getRateForPoint(staff.staffType, point);
          underpaidValue += Math.round((gap / FULL_TIME_HOURS) * rate);
        }

        const staffIssue = (issues || []).find(i => i.type === 'WRONG_INCREMENT' && i.staffName === staffName);
        if (staffIssue) {
          incrementIssues++;
          incrementValue += staffIssue.annualLoss || 0;
        }
      });

      // Unrecognised staff: value capped by remaining entitlement after fixing underpaid
      const afterFix = pcrsHrs + underpaidHrs;
      let remainingEntitlement = Math.max(0, entitled - afterFix);
      let unrecognisedValue = 0;
      let unrecognisedCount = 0;

      unregStaff.forEach(s => {
        const hours = Math.min(parseFloat(s.actualHoursWorked) || 0, FULL_TIME_HOURS);
        const claimableHrs = Math.min(hours, remainingEntitlement);
        if (claimableHrs > 0) {
          unrecognisedCount++;
          remainingEntitlement -= claimableHrs;
          const rate = getRateForPoint(s.staffType, getCorrectPoint(s.staffType, s.yearsExperience || 1));
          unrecognisedValue += Math.round((claimableHrs / FULL_TIME_HOURS) * rate);
        } else {
          unrecognisedCount++; // still count them even if entitlement exhausted
        }
      });

      return { pcrsHrs, underpaidHrs, underpaidValue, incrementIssues, incrementValue,
               unrecognisedCount, unrecognisedValue };
    };

    const rec = compute(receptionists, recUnreg);
    const nurse = compute(nursesPM, nurseUnreg);

    return { rec, nurse, entitled };
  }, [allStaff, staffDetails, issues, unregisteredStaff, entitlement]);

  const grandTotal =
    perStaffStats.rec.underpaidValue + perStaffStats.nurse.underpaidValue +
    perStaffStats.rec.unrecognisedValue + perStaffStats.nurse.unrecognisedValue +
    perStaffStats.rec.incrementValue + perStaffStats.nurse.incrementValue;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* 1. Staff Subsidy Summary (high-level, always visible) */}
      {(current || employed) && (() => {
        const valueCellStyle = (val) => ({
          ...tdBase,
          textAlign: 'right',
          fontWeight: val > 0 ? 600 : 400,
          color: val > 0 ? COLORS.expenseColor : COLORS.textSecondary,
          whiteSpace: 'nowrap'
        });
        const rows = [
          { label: 'Receptionists', stats: perStaffStats.rec, emp: recRow.emp },
          { label: 'Nurses/PM', stats: perStaffStats.nurse, emp: nurseRow.emp }
        ];
        const totalUnderpaid = perStaffStats.rec.underpaidValue + perStaffStats.nurse.underpaidValue;
        const totalUnrecognised = perStaffStats.rec.unrecognisedValue + perStaffStats.nurse.unrecognisedValue;
        const totalIncrement = perStaffStats.rec.incrementValue + perStaffStats.nurse.incrementValue;

        return (
          <div style={cardStyle}>
            {sectionHeading(
              <Users style={{ width: '1rem', height: '1rem' }} />,
              'Staff Subsidy Summary'
            )}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ ...tableStyle, fontSize: '0.825rem' }}>
                <thead>
                  <tr style={headerRow}>
                    <th style={{ ...thBase, textAlign: 'left', padding: '0.5rem 0.375rem' }}>Category</th>
                    <th style={{ ...thBase, textAlign: 'center', padding: '0.5rem 0.375rem' }}>Entitled</th>
                    <th style={{ ...thBase, textAlign: 'center', padding: '0.5rem 0.375rem' }}>PCRS Pay</th>
                    <th style={{ ...thBase, textAlign: 'right', padding: '0.5rem 0.375rem' }}>Staff Underpaid</th>
                    <th style={{ ...thBase, textAlign: 'right', padding: '0.5rem 0.375rem' }}>Staff Unrecognised</th>
                    <th style={{ ...thBase, textAlign: 'right', padding: '0.5rem 0.375rem' }}>Wrong Increment</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ ...tdBase, fontWeight: 500, padding: '0.5rem 0.375rem' }}>{row.label}</td>
                      <td style={{ ...tdBase, textAlign: 'center', padding: '0.5rem 0.375rem' }}>
                        {perStaffStats.entitled} hrs
                      </td>
                      <td style={{ ...tdBase, textAlign: 'center', padding: '0.5rem 0.375rem' }}>
                        {row.stats.pcrsHrs} hrs
                      </td>
                      <td style={{ ...valueCellStyle(row.stats.underpaidValue), padding: '0.5rem 0.375rem' }}>
                        {row.stats.underpaidValue > 0
                          ? `${formatCurrency(row.stats.underpaidValue)} (${row.stats.underpaidHrs} hrs)`
                          : '\u2713'}
                      </td>
                      <td style={{ ...valueCellStyle(row.stats.unrecognisedValue), padding: '0.5rem 0.375rem' }}>
                        {row.stats.unrecognisedCount > 0
                          ? row.stats.unrecognisedValue > 0
                            ? `${formatCurrency(row.stats.unrecognisedValue)} (${row.stats.unrecognisedCount})`
                            : `${row.stats.unrecognisedCount} staff`
                          : '\u2713'}
                      </td>
                      <td style={{ ...valueCellStyle(row.stats.incrementValue), padding: '0.5rem 0.375rem' }}>
                        {row.stats.incrementValue > 0
                          ? `${formatCurrency(row.stats.incrementValue)} (${row.stats.incrementIssues})`
                          : '\u2713'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Total row */}
                {grandTotal > 0 && (
                  <tfoot>
                    <tr style={{ borderTop: `2px solid ${COLORS.textPrimary}` }}>
                      <td colSpan={3} style={{ ...tdBase, fontWeight: 600, padding: '0.5rem 0.375rem' }}>
                        Total Recoverable
                      </td>
                      <td style={{ ...tdBase, textAlign: 'right', fontWeight: 600, padding: '0.5rem 0.375rem', color: totalUnderpaid > 0 ? COLORS.incomeColor : COLORS.textSecondary }}>
                        {totalUnderpaid > 0 ? formatCurrency(totalUnderpaid) : '\u2014'}
                      </td>
                      <td style={{ ...tdBase, textAlign: 'right', fontWeight: 600, padding: '0.5rem 0.375rem', color: totalUnrecognised > 0 ? COLORS.incomeColor : COLORS.textSecondary }}>
                        {totalUnrecognised > 0 ? formatCurrency(totalUnrecognised) : '\u2014'}
                      </td>
                      <td style={{ ...tdBase, textAlign: 'right', fontWeight: 600, padding: '0.5rem 0.375rem', color: totalIncrement > 0 ? COLORS.incomeColor : COLORS.textSecondary }}>
                        {totalIncrement > 0 ? formatCurrency(totalIncrement) : '\u2014'}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Grand total */}
            {grandTotal > 0 && (
              <div style={{
                marginTop: '0.75rem',
                paddingTop: '0.75rem',
                borderTop: `1px solid ${COLORS.borderLight}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: COLORS.textPrimary }}>Total Recoverable Value:</p>
                <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: COLORS.incomeColor }}>
                  {formatCurrency(grandTotal)}/year
                </p>
              </div>
            )}
          </div>
        );
      })()}

      {/* 2. Staff Subsidy Status — collapsible per-staff detail */}
      {(allStaff.length > 0 || unregisteredStaff.length > 0) && (
        <div style={cardStyle}>
          <button
            onClick={() => setShowStaffDetail(prev => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              width: '100%',
              padding: 0,
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <User style={{ width: '1rem', height: '1rem', color: COLORS.textPrimary }} />
            <h5 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: COLORS.textPrimary, flex: 1 }}>
              Staff Subsidy Status per Staff Member
            </h5>
            <span style={{ fontSize: '0.75rem', color: COLORS.slainteBlue, fontWeight: 500 }}>
              {showStaffDetail ? 'Hide Detail' : 'See More Detail'}
            </span>
            <ChevronDown style={{
              width: '1rem',
              height: '1rem',
              color: COLORS.slainteBlue,
              transition: 'transform 0.2s',
              transform: showStaffDetail ? 'rotate(180deg)' : 'rotate(0deg)'
            }} />
          </button>

          {showStaffDetail && (
            <div style={{ marginTop: '0.75rem' }}>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: COLORS.textSecondary }}>
                PCRS payments compared against your practice data. PCRS subsidises up to {FULL_TIME_HOURS} hrs/week per staff member.
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ ...tableStyle, fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={headerRow}>
                      <th style={{ ...thBase, textAlign: 'left', padding: '0.375rem' }}>Name</th>
                      <th style={{ ...thBase, textAlign: 'center', padding: '0.375rem' }}>Role</th>
                      <th style={{ ...thBase, textAlign: 'center', padding: '0.375rem' }}>PCRS Hrs</th>
                      <th style={{ ...thBase, textAlign: 'center', padding: '0.375rem' }}>Actual Hrs</th>
                      <th style={{ ...thBase, textAlign: 'center', padding: '0.375rem' }}>Hours Check</th>
                      <th style={{ ...thBase, textAlign: 'center', padding: '0.375rem' }}>Increment</th>
                      <th style={{ ...thBase, textAlign: 'center', padding: '0.375rem' }}>Increment Check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allStaff.map((staff, idx) => {
                      const staffName = `${staff.firstName} ${staff.surname}`;
                      const staffIssue = (issues || []).find(i =>
                        i.type === 'WRONG_INCREMENT' && i.staffName === staffName
                      );
                      const matchedDetail = (staffDetails || []).find(sd => {
                        const detailName = `${sd.firstName || ''} ${sd.surname || ''}`.trim();
                        return detailName.toLowerCase() === staffName.toLowerCase();
                      });
                      const pcrsHours = staff.weeklyHours || 0;
                      const actualHours = matchedDetail ? (parseFloat(matchedDetail.actualHoursWorked) || 0) : null;
                      const yearsExp = matchedDetail ? (parseFloat(matchedDetail.yearsExperience) || null) : null;
                      const claimableActual = actualHours !== null ? Math.min(actualHours, FULL_TIME_HOURS) : null;
                      const hoursGap = claimableActual !== null && claimableActual > pcrsHours ? claimableActual - pcrsHours : 0;
                      const rawPoint = staff.incrementPoint || 1;
                      const maxPoint = PS_MAX_POINTS[staff.staffType] || rawPoint;
                      const displayPoint = Math.min(rawPoint, maxPoint);
                      const expectedPoint = yearsExp !== null ? getCorrectPoint(staff.staffType, yearsExp) : null;
                      const incrementOk = expectedPoint !== null ? displayPoint >= expectedPoint : !staffIssue;

                      return (
                        <tr key={`pcrs-${idx}`}>
                          <td style={{ ...tdBase, fontWeight: 500, padding: '0.375rem' }}>{staffName}</td>
                          <td style={{ ...tdBase, textAlign: 'center', padding: '0.375rem' }}>{staff.roleLabel}</td>
                          <td style={{ ...tdBase, textAlign: 'center', padding: '0.375rem' }}>{pcrsHours}</td>
                          <td style={{ ...tdBase, textAlign: 'center', padding: '0.375rem' }}>
                            {actualHours !== null ? actualHours : (
                              <span style={{ color: COLORS.textSecondary }}>{'\u2014'}</span>
                            )}
                          </td>
                          <td style={{ ...tdBase, textAlign: 'center', padding: '0.375rem' }}>
                            {actualHours === null ? (
                              <span style={{ color: COLORS.textSecondary }}>No data</span>
                            ) : hoursGap > 0 ? (
                              statusBadge('gap', `${hoursGap} unclaimed`)
                            ) : (
                              statusBadge('ok', 'OK \u2713')
                            )}
                          </td>
                          <td style={{ ...tdBase, textAlign: 'center', padding: '0.375rem' }}>
                            Pt {displayPoint}
                            {yearsExp !== null && (
                              <span style={{ color: COLORS.textSecondary, fontSize: '0.7rem' }}> ({yearsExp} yrs)</span>
                            )}
                          </td>
                          <td style={{ ...tdBase, textAlign: 'center', padding: '0.375rem' }}>
                            {expectedPoint !== null ? (
                              incrementOk
                                ? statusBadge('ok', 'OK \u2713')
                                : statusBadge('gap', `Should be Pt ${expectedPoint}`)
                            ) : staffIssue ? (
                              statusBadge('gap', `Should be Pt ${staffIssue.correctIncrement}`)
                            ) : (
                              <span style={{ color: COLORS.textSecondary }}>No data</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {/* Unregistered staff */}
                    {unregisteredStaff.map((staff, idx) => {
                      const name = `${staff.firstName || ''} ${staff.surname || ''}`.trim();
                      const roleLabel = ROLE_LABELS[staff.staffType] || staff.staffType;
                      const hours = parseFloat(staff.actualHoursWorked) || 0;
                      return (
                        <tr key={`unreg-${idx}`} style={{ backgroundColor: COLORS.warningLighter }}>
                          <td style={{ ...tdBase, fontWeight: 500, padding: '0.375rem' }}>{name}</td>
                          <td style={{ ...tdBase, textAlign: 'center', padding: '0.375rem' }}>{roleLabel}</td>
                          <td style={{ ...tdBase, textAlign: 'center', padding: '0.375rem' }}>
                            <span style={{ color: COLORS.error }}>0</span>
                          </td>
                          <td style={{ ...tdBase, textAlign: 'center', padding: '0.375rem' }}>{hours}</td>
                          <td style={{ ...tdBase, textAlign: 'center', padding: '0.375rem' }}>
                            {statusBadge('gap', 'Not registered')}
                          </td>
                          <td style={{ ...tdBase, textAlign: 'center', padding: '0.375rem' }}>{'\u2014'}</td>
                          <td style={{ ...tdBase, textAlign: 'center', padding: '0.375rem' }}>{'\u2014'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Entitlement Explained — collapsible */}
      <div style={cardStyle}>
        <button
          onClick={() => setShowEntitlement(prev => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            width: '100%',
            padding: 0,
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <TrendingUp style={{ width: '1rem', height: '1rem', color: COLORS.slainteBlue }} />
          <h5 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: COLORS.textPrimary, flex: 1 }}>
            Your Entitlement Explained
          </h5>
          <span style={{ fontSize: '0.75rem', color: COLORS.slainteBlue, fontWeight: 500 }}>
            {showEntitlement ? 'Hide Detail' : 'See More Detail'}
          </span>
          <ChevronDown style={{
            width: '1rem',
            height: '1rem',
            color: COLORS.slainteBlue,
            transition: 'transform 0.2s',
            transform: showEntitlement ? 'rotate(180deg)' : 'rotate(0deg)'
          }} />
        </button>

        {showEntitlement && (
          <div style={{ marginTop: '0.75rem' }}>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: COLORS.textSecondary }}>
              Based on weighted panel of {weightedPanel?.toLocaleString()} with {numGPs} GPs
              {entitlement.subsidyUnits != null && ` (${entitlement.subsidyUnits?.toFixed(2)} subsidy units)`}
            </p>
            <div style={{
              padding: '0.75rem',
              borderRadius: '0.25rem',
              border: `1px solid ${COLORS.borderLight}`,
              backgroundColor: COLORS.bgPage
            }}>
              {entitlement.explanation && (
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: COLORS.textPrimary }}>
                  {entitlement.explanation}
                </p>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                <div style={{ padding: '0.75rem', backgroundColor: COLORS.white, borderRadius: '0.25rem', border: `1px solid ${COLORS.borderLight}` }}>
                  <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: COLORS.textSecondary }}>Receptionists</p>
                  <p style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: COLORS.slainteBlue }}>{entitlement.totalHours} hours/week</p>
                  {entitlement.receptionists?.maxAnnual > 0 && (
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: COLORS.textSecondary }}>
                      Up to {formatCurrency(entitlement.receptionists.maxAnnual)}/year at max rate
                    </p>
                  )}
                </div>
                <div style={{ padding: '0.75rem', backgroundColor: COLORS.white, borderRadius: '0.25rem', border: `1px solid ${COLORS.borderLight}` }}>
                  <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: COLORS.textSecondary }}>Nurses / Practice Manager</p>
                  <p style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: COLORS.slainteBlue }}>{entitlement.totalHours} hours/week</p>
                  {entitlement.nursesOrPM?.maxNurseAnnual > 0 && (
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: COLORS.textSecondary }}>
                      Up to {formatCurrency(entitlement.nursesOrPM.maxNurseAnnual)}/year at max rate
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Success message */}
      {(!issues || issues.length === 0) && (!opportunities || opportunities.length === 0) && unregisteredStaff.length === 0 && (
        <div style={{
          padding: '1rem',
          borderRadius: '0.5rem',
          border: `2px solid ${COLORS.successDark}`,
          backgroundColor: COLORS.successLight,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <CheckCircle style={{ width: '1.25rem', height: '1.25rem', color: COLORS.successDark }} />
          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 500, color: COLORS.successText }}>
            Your Practice Support subsidies are fully optimised. You are claiming your full entitlement.
          </p>
        </div>
      )}
    </div>
  );
};

export const PracticeSupportBreakdown = ({ entitlement, current, employed, issues, opportunities, weightedPanel, numGPs, totalRecoverable, staffDetails }) => {
  const eligibleRoles = ['secretary', 'nurse', 'practiceManager'];

  // ─── FULL MODE: entitlement exists (demographics entered, engine ran) ───
  if (entitlement) {
    // Combine all staff from current PCRS data (with staffType for max-point lookups)
    const allStaff = [
      ...(current?.receptionists?.staff || []).map(s => ({ ...s, roleLabel: 'Receptionist', staffType: 'secretary' })),
      ...(current?.nurses?.staff || []).map(s => ({ ...s, roleLabel: 'Nurse', staffType: 'nurse' })),
      ...(current?.practiceManager?.staff || []).map(s => ({ ...s, roleLabel: 'Practice Manager', staffType: 'practiceManager' })),
      ...(current?.unknown?.staff || []).map(s => ({ ...s, roleLabel: 'Unknown Role', staffType: null }))
    ];

    // Build summary rows for Receptionists and Nurses/PM
    const buildSummaryRow = (label, category, issueCategory) => {
      const entitled = entitlement?.totalHours || 0;
      let pcrs, emp;
      if (category === 'receptionists') {
        pcrs = current?.receptionists?.hours || 0;
        emp = employed?.receptionists?.hours || 0;
      } else {
        pcrs = current?.totalNursesPMHours || 0;
        emp = employed?.totalNursesPMHours || 0;
      }
      const canClaim = pcrs < entitled && emp >= pcrs ? Math.min(emp, entitled) - pcrs : 0;
      const hiringGap = emp < entitled ? entitled - emp : 0;
      const issue = (issues || []).find(i => i.type === 'UNCLAIMED_HOURS' && i.category === issueCategory);
      const potentialValue = issue?.potentialGain || 0;

      let status = 'ok';
      let statusText = 'Maximised \u2713';
      if (canClaim > 0) { status = 'gap'; statusText = `${canClaim} hrs unclaimed`; }
      else if (hiringGap > 0) { status = 'opportunity'; statusText = 'Hiring opportunity'; }

      return { label, entitled, pcrs, emp, status, statusText, potentialValue };
    };

    const recRow = buildSummaryRow('Receptionists', 'receptionists', 'receptionists');
    const nurseRow = buildSummaryRow('Nurses/PM', 'nurses', 'nurses/practiceManager');

    // Check for unregistered staff (from staffDetails) even when entitlement exists
    const unregisteredStaff = (staffDetails || []).filter(s =>
      !s.fromPCRS && eligibleRoles.includes(s.staffType) && parseFloat(s.actualHoursWorked) > 0
    );

    return (
      <PracticeSupportFullMode
        allStaff={allStaff}
        unregisteredStaff={unregisteredStaff}
        recRow={recRow}
        nurseRow={nurseRow}
        issues={issues}
        opportunities={opportunities}
        entitlement={entitlement}
        weightedPanel={weightedPanel}
        numGPs={numGPs}
        totalRecoverable={totalRecoverable}
        staffDetails={staffDetails}
        current={current}
        employed={employed}
      />
    );
  }

  // ─── DEGRADED MODE: no demographics, but we may have staff data ───
  const allKnownStaff = staffDetails || [];
  const pcrsStaff = allKnownStaff.filter(s => s.fromPCRS);
  const nonPcrsStaff = allKnownStaff.filter(s => !s.fromPCRS && eligibleRoles.includes(s.staffType) && parseFloat(s.actualHoursWorked) > 0);

  if (pcrsStaff.length === 0 && nonPcrsStaff.length === 0) {
    return <p style={{ margin: 0, color: COLORS.textSecondary }}>No practice support analysis data available. Enter staff details and patient demographics to see the full analysis.</p>;
  }

  // Build increment check issues locally (without panel factor for financial values)
  const localIssues = [];
  pcrsStaff.forEach(staff => {
    if (staff.yearsExperience != null && staff.incrementPoint != null && eligibleRoles.includes(staff.staffType)) {
      const correctPt = getCorrectPoint(staff.staffType, staff.yearsExperience);
      if (staff.incrementPoint < correctPt) {
        const currentRate = getRateForPoint(staff.staffType, staff.incrementPoint);
        const correctRate = getRateForPoint(staff.staffType, correctPt);
        const name = `${staff.firstName || ''} ${staff.surname || ''}`.trim();
        localIssues.push({
          name,
          staffType: staff.staffType,
          currentPoint: staff.incrementPoint,
          correctPoint: correctPt,
          rateDiff: correctRate - currentRate
        });
      }
    }
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* PCRS-Registered Staff Table */}
      {pcrsStaff.length > 0 && (
        <div style={cardStyle}>
          {sectionHeading(
            <User style={{ width: '1rem', height: '1rem' }} />,
            'Staff Subsidy Status'
          )}
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: COLORS.textSecondary }}>
            PCRS payments compared against your practice data. PCRS subsidises up to {FULL_TIME_HOURS} hrs/week per staff member.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ ...tableStyle, fontSize: '0.8rem' }}>
              <thead>
                <tr style={headerRow}>
                  <th style={{ ...thBase, textAlign: 'left', padding: '0.375rem' }}>Name</th>
                  <th style={{ ...thBase, textAlign: 'center', padding: '0.375rem' }}>Role</th>
                  <th style={{ ...thBase, textAlign: 'center', padding: '0.375rem' }}>PCRS Hrs</th>
                  <th style={{ ...thBase, textAlign: 'center', padding: '0.375rem' }}>Actual Hrs</th>
                  <th style={{ ...thBase, textAlign: 'center', padding: '0.375rem' }}>Hours Check</th>
                  <th style={{ ...thBase, textAlign: 'center', padding: '0.375rem' }}>Increment</th>
                  <th style={{ ...thBase, textAlign: 'center', padding: '0.375rem' }}>Increment Check</th>
                </tr>
              </thead>
              <tbody>
                {pcrsStaff.map((staff, idx) => {
                  const name = `${staff.firstName || ''} ${staff.surname || ''}`.trim();
                  const localIssue = localIssues.find(i => i.name === name);
                  const roleLabel = ROLE_LABELS[staff.staffType] || staff.staffType || 'Unknown';
                  const pcrsHours = staff.weeklyHours || 0;
                  const actualHours = parseFloat(staff.actualHoursWorked) || 0;
                  const yearsExp = parseFloat(staff.yearsExperience) || null;

                  // Cap unclaimed hours at FULL_TIME_HOURS
                  const claimableActual = actualHours > 0 ? Math.min(actualHours, FULL_TIME_HOURS) : 0;
                  const hoursGap = claimableActual > pcrsHours ? claimableActual - pcrsHours : 0;

                  // Cap increment point at the max for this role
                  const rawPoint = staff.incrementPoint || 1;
                  const maxPoint = PS_MAX_POINTS[staff.staffType] || rawPoint;
                  const displayPoint = Math.min(rawPoint, maxPoint);

                  // Check increment against years experience
                  const expectedPoint = yearsExp !== null ? getCorrectPoint(staff.staffType, yearsExp) : null;
                  const incrementOk = expectedPoint !== null ? displayPoint >= expectedPoint : !localIssue;

                  return (
                    <tr key={`pcrs-${idx}`}>
                      <td style={{ ...tdBase, fontWeight: 500, padding: '0.375rem' }}>{name}</td>
                      <td style={{ ...tdBase, textAlign: 'center', padding: '0.375rem' }}>{roleLabel}</td>
                      <td style={{ ...tdBase, textAlign: 'center', padding: '0.375rem' }}>{pcrsHours}</td>
                      <td style={{ ...tdBase, textAlign: 'center', padding: '0.375rem' }}>
                        {actualHours > 0 ? actualHours : (
                          <span style={{ color: COLORS.textSecondary }}>{'\u2014'}</span>
                        )}
                      </td>
                      <td style={{ ...tdBase, textAlign: 'center', padding: '0.375rem' }}>
                        {actualHours <= 0 ? (
                          <span style={{ color: COLORS.textSecondary }}>No data</span>
                        ) : hoursGap > 0 ? (
                          statusBadge('gap', `${hoursGap} unclaimed`)
                        ) : (
                          statusBadge('ok', 'OK \u2713')
                        )}
                      </td>
                      <td style={{ ...tdBase, textAlign: 'center', padding: '0.375rem' }}>
                        Pt {displayPoint}
                        {yearsExp !== null && (
                          <span style={{ color: COLORS.textSecondary, fontSize: '0.7rem' }}> ({yearsExp} yrs)</span>
                        )}
                      </td>
                      <td style={{ ...tdBase, textAlign: 'center', padding: '0.375rem' }}>
                        {expectedPoint !== null ? (
                          incrementOk
                            ? statusBadge('ok', 'OK \u2713')
                            : statusBadge('gap', `Should be Pt ${expectedPoint}`)
                        ) : localIssue ? (
                          statusBadge('gap', `Should be Pt ${localIssue.correctPoint}`)
                        ) : (
                          <span style={{ color: COLORS.textSecondary }}>No data</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Increment Point Issues (local checks) */}
      {localIssues.length > 0 && (
        <div style={cardStyle}>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: COLORS.textSecondary }}>
            Action Required:
          </p>
          {localIssues.map((issue, idx) => (
            <div key={idx} style={{
              padding: '0.75rem',
              marginBottom: idx < localIssues.length - 1 ? '0.5rem' : 0,
              borderRadius: '0.25rem',
              borderLeft: `4px solid ${COLORS.error}`,
              backgroundColor: COLORS.errorLighter
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 500, color: COLORS.errorText }}>
                  Wrong Increment Point: {issue.name} is on Point {issue.currentPoint} but should be Point {issue.correctPoint}
                </p>
                {issue.rateDiff > 0 && (
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, whiteSpace: 'nowrap', marginLeft: '0.5rem', color: COLORS.incomeColor }}>
                    +{formatCurrency(issue.rateDiff)}/yr*
                  </span>
                )}
              </div>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: COLORS.textSecondary }}>
                Contact PCRS to update increment point. *Value shown is the rate difference before panel factor adjustment.
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Unregistered Staff */}
      {nonPcrsStaff.length > 0 && (
        <div style={{
          padding: '1rem',
          borderRadius: '0.5rem',
          border: `2px solid ${COLORS.warning}`,
          backgroundColor: COLORS.warningLighter
        }}>
          {sectionHeading(
            <AlertCircle style={{ width: '1rem', height: '1rem', color: COLORS.warningDark }} />,
            'Staff Not Receiving PCRS Subsidy'
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {nonPcrsStaff.map((staff, idx) => {
              const name = `${staff.firstName || ''} ${staff.surname || ''}`.trim();
              const hours = parseFloat(staff.actualHoursWorked) || 0;
              const roleLabel = ROLE_LABELS[staff.staffType] || staff.staffType;
              const defaultRate = getRateForPoint(staff.staffType, getCorrectPoint(staff.staffType, staff.yearsExperience || 1));
              const estimatedValue = Math.round((Math.min(hours, FULL_TIME_HOURS) / FULL_TIME_HOURS) * defaultRate);

              return (
                <div key={idx} style={{
                  padding: '0.75rem',
                  borderRadius: '0.25rem',
                  backgroundColor: COLORS.white,
                  border: '1px solid #FDE68A'
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 500, color: COLORS.warningText }}>
                        {name} ({roleLabel}, {hours} hrs/week)
                      </p>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: COLORS.textSecondary }}>
                        Not registered with PCRS for a practice support subsidy
                      </p>
                    </div>
                    {estimatedValue > 0 && (
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, whiteSpace: 'nowrap', marginLeft: '0.5rem', color: COLORS.warningDark }}>
                        ~{formatCurrency(estimatedValue)}/yr*
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: COLORS.warningText }}>
            *Estimated value before panel factor adjustment. Enter patient demographics to see the exact subsidy amount.
          </p>

          {/* Capacity Grant mention */}
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '0.25rem', backgroundColor: COLORS.white, border: '1px solid #FDE68A' }}>
            <p style={{ margin: '0 0 0.25rem', fontSize: '0.875rem', fontWeight: 500, color: COLORS.successText }}>
              {'\uD83D\uDCB0'} Capacity Grant: {formatCurrency(15000)} per GP
            </p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: COLORS.textSecondary }}>
              If these staff were hired or given additional hours after July 2023, they may qualify for the Capacity Grant ({'\u20AC'}15,000 per GP with weighted panel 500+).
            </p>
          </div>
        </div>
      )}

      {/* Demographics tip (optional, not a blocker) */}
      <div style={{
        padding: '0.75rem',
        borderRadius: '0.5rem',
        backgroundColor: COLORS.slainteBlueLight,
        border: '1px solid #BFDBFE'
      }}>
        <p style={{ margin: 0, fontSize: '0.875rem', color: COLORS.infoText }}>
          <strong>Tip:</strong> Enter patient demographics in the Data Collection view to cross-check the PCRS weighted panel and refine entitlement calculations.
        </p>
      </div>
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════════════
// 6. CERVICAL CHECK BREAKDOWN
// ═══════════════════════════════════════════════════════════════════════
export const CervicalCheckBreakdown = ({ cervicalScreeningAnalysis }) => {
  if (!cervicalScreeningAnalysis) return null;

  const [zeroPaymentExpanded, setZeroPaymentExpanded] = useState(false);
  const data = cervicalScreeningAnalysis;
  const targetSmears = data.targetSmears ||
    (Math.round((data.eligible25to44 || 0) / 3) + Math.round((data.eligible45to65 || 0) / 5));
  const ratePerSmear = gmsRates.cervicalCheck.perSmear;
  const smearsFrom25to44 = data.smearsFrom25to44 || Math.round((data.eligible25to44 || 0) / 3);
  const smearsFrom45to65 = data.smearsFrom45to65 || Math.round((data.eligible45to65 || 0) / 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Smear Payment Status Table */}
      {data.totalSmearsPerformed > 0 && (
        <div style={cardStyle}>
          {sectionHeading(
            <CheckCircle style={{ width: '1rem', height: '1rem' }} />,
            'Smear Payment Status (PCRS Data)'
          )}
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr style={headerRow}>
                  <th style={{ ...thBase, textAlign: 'left' }}>Category</th>
                  <th style={{ ...thBase, textAlign: 'center' }}>Count</th>
                  <th style={{ ...thBase, textAlign: 'center' }}>Status</th>
                  <th style={{ ...thBase, textAlign: 'right' }}>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...tdBase, fontWeight: 500 }}>Smears Performed</td>
                  <td style={{ ...tdBase, textAlign: 'center' }}>{data.totalSmearsPerformed}</td>
                  <td style={{ ...tdBase, textAlign: 'center' }}>{statusBadge('info', 'Total Activity')}</td>
                  <td style={{ ...tdBase, textAlign: 'right', color: COLORS.textSecondary }}>{'\u2014'}</td>
                </tr>
                <tr>
                  <td style={{ ...tdBase, fontWeight: 500 }}>Smears Paid</td>
                  <td style={{ ...tdBase, textAlign: 'center' }}>{data.smearsPaid}</td>
                  <td style={{ ...tdBase, textAlign: 'center' }}>{statusBadge('paid', `${data.paidRate}% Paid \u2713`)}</td>
                  <td style={{ ...tdBase, textAlign: 'right', fontWeight: 500, color: COLORS.incomeColor }}>
                    {formatCurrency(data.totalPaidAmount)}
                  </td>
                </tr>
                {data.smearsZeroPayment > 0 && (
                  <tr>
                    <td style={{ ...tdBase, fontWeight: 500 }}>Zero Payment Smears</td>
                    <td style={{ ...tdBase, textAlign: 'center' }}>{data.smearsZeroPayment}</td>
                    <td style={{ ...tdBase, textAlign: 'center' }}>{statusBadge('nopay', '\u26A0\uFE0F No Payment')}</td>
                    <td style={{ ...tdBase, textAlign: 'right', fontWeight: 500, color: COLORS.error }}>
                      -{formatCurrency(data.lostIncome)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Total Recoverable Value */}
          {data.lostIncome > 0 && (
            <div style={{
              marginTop: '1rem',
              paddingTop: '0.75rem',
              borderTop: `1px solid ${COLORS.borderLight}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: COLORS.textPrimary }}>Total Recoverable (Admin Fixes):</p>
              <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: COLORS.incomeColor }}>
                {formatCurrency(data.lostIncome)}/year
              </p>
            </div>
          )}
        </div>
      )}

      {/* Zero Payment Breakdown (collapsible) */}
      {data.recommendations && data.recommendations.length > 0 && (
        <div style={cardStyle}>
          <button
            onClick={() => setZeroPaymentExpanded(!zeroPaymentExpanded)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle style={{ width: '1rem', height: '1rem', color: COLORS.slainteBlue }} />
              <h5 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: COLORS.textPrimary }}>Zero Payment Breakdown</h5>
              <span style={{
                fontSize: '0.75rem',
                padding: '0.125rem 0.5rem',
                borderRadius: '9999px',
                backgroundColor: `${COLORS.slainteBlue}15`,
                color: COLORS.slainteBlue
              }}>
                {data.recommendations.length} reason{data.recommendations.length !== 1 ? 's' : ''}
              </span>
            </div>
            {zeroPaymentExpanded
              ? <ChevronUp style={{ width: '1rem', height: '1rem', color: COLORS.textSecondary }} />
              : <ChevronDown style={{ width: '1rem', height: '1rem', color: COLORS.textSecondary }} />
            }
          </button>

          {zeroPaymentExpanded && (
            <div style={{ marginTop: '0.75rem' }}>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: COLORS.textSecondary }}>
                Understanding why smears were not paid helps prevent future lost income.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {data.recommendations.map((rec, idx) => (
                  <div key={idx} style={{
                    padding: '0.75rem',
                    borderRadius: '0.25rem',
                    border: `1px solid ${COLORS.borderLight}`,
                    backgroundColor: COLORS.bgPage
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 500, color: COLORS.textPrimary }}>
                        {rec.preventable ? '\uD83D\uDD27 ' : '\u2139\uFE0F '}{rec.reason}
                      </p>
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '0.125rem 0.5rem',
                        borderRadius: '9999px',
                        backgroundColor: rec.preventable ? COLORS.errorLight : `${COLORS.textSecondary}20`,
                        color: rec.preventable ? COLORS.errorText : COLORS.textSecondary
                      }}>
                        {rec.count} smear{rec.count > 1 ? 's' : ''}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: COLORS.textSecondary }}>{rec.advice}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Growth Opportunity: Expected Annual Smears — table-based layout */}
      {(data.eligible25to44 > 0 || data.eligible45to65 > 0) && (
        <div style={cardStyle}>
          {sectionHeading(
            <TrendingUp style={{ width: '1rem', height: '1rem' }} />,
            'Growth Opportunity: Expected Annual Smears'
          )}
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr style={headerRow}>
                  <th style={{ ...thBase, textAlign: 'left' }}>Age Group</th>
                  <th style={{ ...thBase, textAlign: 'center' }}>Eligible Women</th>
                  <th style={{ ...thBase, textAlign: 'center' }}>Screening Interval</th>
                  <th style={{ ...thBase, textAlign: 'center' }}>Target Smears/Year</th>
                  <th style={{ ...thBase, textAlign: 'right' }}>Potential Income</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...tdBase, fontWeight: 500 }}>Women 25-44</td>
                  <td style={{ ...tdBase, textAlign: 'center' }}>{data.eligible25to44 || 0}</td>
                  <td style={{ ...tdBase, textAlign: 'center' }}>Every 3 years</td>
                  <td style={{ ...tdBase, textAlign: 'center', fontWeight: 500 }}>{smearsFrom25to44}</td>
                  <td style={{ ...tdBase, textAlign: 'right', fontWeight: 500, color: COLORS.incomeColor }}>
                    {formatCurrency(smearsFrom25to44 * ratePerSmear)}
                  </td>
                </tr>
                <tr>
                  <td style={{ ...tdBase, fontWeight: 500 }}>Women 45-65</td>
                  <td style={{ ...tdBase, textAlign: 'center' }}>{data.eligible45to65 || 0}</td>
                  <td style={{ ...tdBase, textAlign: 'center' }}>Every 5 years</td>
                  <td style={{ ...tdBase, textAlign: 'center', fontWeight: 500 }}>{smearsFrom45to65}</td>
                  <td style={{ ...tdBase, textAlign: 'right', fontWeight: 500, color: COLORS.incomeColor }}>
                    {formatCurrency(smearsFrom45to65 * ratePerSmear)}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: `${COLORS.slainteBlue}08` }}>
                  <td style={{ ...tdBase, fontWeight: 600 }}>Total Target</td>
                  <td style={{ ...tdBase, textAlign: 'center', fontWeight: 600 }}>{(data.eligible25to44 || 0) + (data.eligible45to65 || 0)}</td>
                  <td style={{ ...tdBase }}></td>
                  <td style={{ ...tdBase, textAlign: 'center', fontWeight: 700 }}>{targetSmears}</td>
                  <td style={{ ...tdBase, textAlign: 'right', fontWeight: 700, color: COLORS.incomeColor }}>
                    {formatCurrency(targetSmears * ratePerSmear)}/yr
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: COLORS.textSecondary }}>
            Rate: {'\u20AC'}{ratePerSmear.toFixed(2)} per smear (HPV primary screening)
          </p>
        </div>
      )}

      {/* Success message */}
      {data.smearsZeroPayment === 0 && !(data.eligible25to44 > 0 || data.eligible45to65 > 0) && (
        <div style={{
          padding: '1rem',
          borderRadius: '0.5rem',
          border: `2px solid ${COLORS.successDark}`,
          backgroundColor: COLORS.successLight,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <CheckCircle style={{ width: '1.25rem', height: '1.25rem', color: COLORS.successDark }} />
          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 500, color: COLORS.successText }}>
            Excellent! All smears are being paid. Your cervical screening claims are fully optimised.
          </p>
        </div>
      )}
    </div>
  );
};

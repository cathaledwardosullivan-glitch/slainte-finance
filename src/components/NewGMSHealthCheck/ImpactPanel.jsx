import React, { useState } from 'react';
import { TrendingUp, CheckCircle, Clock, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import COLORS from '../../utils/colors';

const AREA_LABELS = {
  leave: 'Study & Annual Leave',
  practiceSupport: 'Practice Support',
  capitation: 'Capitation',
  cervicalCheck: 'Cervical Check',
  stc: 'Special Type Consultations',
  cdm: 'Chronic Disease Management',
};

const AREA_IDS = ['leave', 'practiceSupport', 'capitation', 'cervicalCheck', 'stc', 'cdm'];

/**
 * ImpactPanel — Shows projected and verified savings from GMS Health Check cycles.
 *
 * Props:
 *   impactSummary      — from calculateImpactSummary()
 *   sectorComparisons  — from compareSnapshots() (null if no previous snapshot)
 *   snapshots          — array of snapshot objects
 *   onClose            — callback to close the panel
 */
const ImpactPanel = ({ impactSummary, sectorComparisons, snapshots, onClose }) => {
  const [expandedSection, setExpandedSection] = useState('sectors');
  const [sectorFilter, setSectorFilter] = useState('all');

  const hasData = impactSummary && impactSummary.totalCombined > 0;
  const hasComparison = sectorComparisons && sectorComparisons.sectorsWithNewData > 0;

  return (
    <div style={{ backgroundColor: COLORS.bgPage, minHeight: '100%', padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem',
            color: COLORS.textSecondary, display: 'flex', alignItems: 'center'
          }}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: COLORS.textPrimary }}>
            Impact Tracker
          </h2>
          <p style={{ margin: 0, fontSize: '0.8rem', color: COLORS.textSecondary }}>
            Track savings and improvements from your GMS Health Check
          </p>
        </div>
      </div>

      {/* Summary Bar */}
      <div style={{
        display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap'
      }}>
        <SummaryCard
          label="Projected Savings"
          value={impactSummary?.totalProjected || 0}
          icon={<Clock size={18} />}
          color="#F39C12"
          subtitle="From completed tasks"
        />
        <SummaryCard
          label="Verified Savings"
          value={impactSummary?.totalVerified || 0}
          icon={<CheckCircle size={18} />}
          color="#2ECC71"
          subtitle="Confirmed by data"
        />
        <SummaryCard
          label="Total Recovered"
          value={impactSummary?.totalCombined || 0}
          icon={<TrendingUp size={18} />}
          color={COLORS.slainteBlue}
          subtitle="Combined impact"
          highlight
        />
      </div>

      {!hasData && (
        <div style={{
          textAlign: 'center', padding: '3rem 1rem',
          backgroundColor: COLORS.bgCard, borderRadius: '0.75rem',
          border: `1px solid ${COLORS.borderLight}`
        }}>
          <TrendingUp size={40} style={{ color: COLORS.textTertiary, marginBottom: '0.75rem' }} />
          <h3 style={{ color: COLORS.textSecondary, margin: '0 0 0.5rem 0', fontSize: '1rem' }}>
            No savings tracked yet
          </h3>
          <p style={{ color: COLORS.textTertiary, margin: 0, fontSize: '0.85rem', maxWidth: '400px', marginInline: 'auto' }}>
            Complete Health Check tasks to start tracking projected savings.
            When you start a new cycle and upload fresh data, we'll verify improvements.
          </p>
        </div>
      )}

      {hasData && (
        <>
          {/* Per-Sector Breakdown */}
          <CollapsibleSection
            title="Sector Breakdown"
            subtitle={hasComparison ? `${sectorComparisons.sectorsImproved} of ${sectorComparisons.sectorsWithNewData} sectors improved` : null}
            isOpen={expandedSection === 'sectors'}
            onToggle={() => setExpandedSection(expandedSection === 'sectors' ? null : 'sectors')}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {AREA_IDS.map(areaId => {
                const sectorData = impactSummary?.bySector?.[areaId] || { projected: 0, verified: 0 };
                const comparison = sectorComparisons?.sectorComparisons?.[areaId];
                const total = sectorData.projected + sectorData.verified;
                if (total === 0 && !comparison?.hasNewData) return null;

                return (
                  <div key={areaId} style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: COLORS.bgCard,
                    borderRadius: '0.5rem',
                    border: `1px solid ${COLORS.borderLight}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', color: COLORS.textPrimary }}>
                        {AREA_LABELS[areaId]}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {comparison?.verifiedSaving > 0 && (
                          <span style={{
                            fontSize: '0.65rem', padding: '0.15rem 0.4rem',
                            backgroundColor: '#E8F8F0', color: '#2ECC71',
                            borderRadius: '0.25rem', fontWeight: 600
                          }}>
                            Verified
                          </span>
                        )}
                        {total > 0 && (
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: COLORS.textPrimary }}>
                            {'\u20AC'}{Math.round(total).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Breakdown row */}
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: COLORS.textSecondary }}>
                      {sectorData.projected > 0 && (
                        <span>{'\u20AC'}{Math.round(sectorData.projected).toLocaleString()} projected</span>
                      )}
                      {sectorData.verified > 0 && (
                        <span style={{ color: '#2ECC71' }}>{'\u20AC'}{Math.round(sectorData.verified).toLocaleString()} verified</span>
                      )}
                    </div>

                    {/* Comparison summary */}
                    {comparison && comparison.hasNewData && (
                      <div style={{
                        marginTop: '0.35rem', fontSize: '0.75rem',
                        color: comparison.verifiedSaving > 0 ? '#2ECC71' : COLORS.textTertiary,
                        fontStyle: comparison.verifiedSaving > 0 ? 'normal' : 'italic'
                      }}>
                        {comparison.summary}
                      </div>
                    )}
                    {comparison && !comparison.hasNewData && (
                      <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: COLORS.textTertiary, fontStyle: 'italic' }}>
                        Awaiting new data
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>

          {/* Savings Timeline */}
          <CollapsibleSection
            title="Savings Timeline"
            subtitle={`${impactSummary?.timeline?.length || 0} entries`}
            isOpen={expandedSection === 'timeline'}
            onToggle={() => setExpandedSection(expandedSection === 'timeline' ? null : 'timeline')}
          >
            {/* Filter */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <FilterChip label="All" active={sectorFilter === 'all'} onClick={() => setSectorFilter('all')} />
              {AREA_IDS.map(id => {
                const has = impactSummary?.timeline?.some(e => e.areaId === id);
                if (!has) return null;
                return <FilterChip key={id} label={AREA_LABELS[id]} active={sectorFilter === id} onClick={() => setSectorFilter(id)} />;
              })}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {(impactSummary?.timeline || [])
                .filter(e => sectorFilter === 'all' || e.areaId === sectorFilter)
                .reverse() // Most recent first
                .map(entry => (
                  <div key={entry.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.5rem 0.75rem', backgroundColor: COLORS.bgCard,
                    borderRadius: '0.375rem', border: `1px solid ${COLORS.borderLight}`,
                    fontSize: '0.8rem'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: COLORS.textPrimary, fontWeight: 500 }}>
                        {entry.description}
                      </div>
                      <div style={{ color: COLORS.textTertiary, fontSize: '0.7rem' }}>
                        {AREA_LABELS[entry.areaId] || entry.category} · {formatDate(entry.createdDate)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{
                        fontSize: '0.65rem', padding: '0.1rem 0.35rem', borderRadius: '0.2rem',
                        backgroundColor: entry.type === 'verified' ? '#E8F8F0' : '#FEF3E2',
                        color: entry.type === 'verified' ? '#2ECC71' : '#F39C12',
                        fontWeight: 600
                      }}>
                        {entry.type === 'verified' ? 'Verified' : 'Projected'}
                      </span>
                      <span style={{ fontWeight: 700, color: COLORS.textPrimary }}>
                        {'\u20AC'}{Math.round(entry.amount).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              {(impactSummary?.timeline || []).filter(e => sectorFilter === 'all' || e.areaId === sectorFilter).length === 0 && (
                <div style={{ textAlign: 'center', padding: '1rem', color: COLORS.textTertiary, fontSize: '0.85rem' }}>
                  No entries for this filter
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* Cycle History */}
          {snapshots && snapshots.length > 0 && (
            <CollapsibleSection
              title="Cycle History"
              subtitle={`${snapshots.length} cycle${snapshots.length !== 1 ? 's' : ''} recorded`}
              isOpen={expandedSection === 'cycles'}
              onToggle={() => setExpandedSection(expandedSection === 'cycles' ? null : 'cycles')}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[...snapshots].reverse().map(snap => (
                  <div key={snap.id} style={{
                    padding: '0.75rem 1rem', backgroundColor: COLORS.bgCard,
                    borderRadius: '0.5rem', border: `1px solid ${COLORS.borderLight}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: COLORS.textPrimary }}>
                          Cycle {snap.cycleNumber}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: COLORS.textTertiary, marginLeft: '0.5rem' }}>
                          {formatDate(snap.createdDate)}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.35rem', fontSize: '0.75rem', color: COLORS.textSecondary }}>
                      <span>Unclaimed: {'\u20AC'}{Math.round(snap.totalUnclaimed || 0).toLocaleString()}</span>
                      <span>Tasks completed: {snap.tasksAtSnapshot?.completed || 0}/{snap.tasksAtSnapshot?.total || 0}</span>
                      {snap.tasksAtSnapshot?.projectedSavings > 0 && (
                        <span>Projected: {'\u20AC'}{Math.round(snap.tasksAtSnapshot.projectedSavings).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}
        </>
      )}
    </div>
  );
};

// ============================================
// Sub-components
// ============================================

const SummaryCard = ({ label, value, icon, color, subtitle, highlight }) => (
  <div style={{
    flex: '1 1 160px', padding: '1rem', borderRadius: '0.75rem',
    backgroundColor: highlight ? `${color}0A` : COLORS.bgCard,
    border: `1px solid ${highlight ? `${color}30` : COLORS.borderLight}`,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
      <span style={{ color }}>{icon}</span>
      <span style={{ fontSize: '0.75rem', color: COLORS.textSecondary, fontWeight: 500 }}>{label}</span>
    </div>
    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: value > 0 ? color : COLORS.textTertiary }}>
      {'\u20AC'}{Math.round(value).toLocaleString()}
    </div>
    {subtitle && (
      <div style={{ fontSize: '0.7rem', color: COLORS.textTertiary, marginTop: '0.15rem' }}>{subtitle}</div>
    )}
  </div>
);

const CollapsibleSection = ({ title, subtitle, isOpen, onToggle, children }) => (
  <div style={{ marginBottom: '1rem' }}>
    <button
      onClick={onToggle}
      style={{
        width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0.75rem 1rem', backgroundColor: COLORS.bgCard, borderRadius: '0.5rem',
        border: `1px solid ${COLORS.borderLight}`, cursor: 'pointer', marginBottom: isOpen ? '0.5rem' : 0
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: COLORS.textPrimary }}>{title}</span>
        {subtitle && <span style={{ fontSize: '0.75rem', color: COLORS.textTertiary }}>({subtitle})</span>}
      </div>
      {isOpen ? <ChevronUp size={16} color={COLORS.textSecondary} /> : <ChevronDown size={16} color={COLORS.textSecondary} />}
    </button>
    {isOpen && children}
  </div>
);

const FilterChip = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: '0.25rem 0.6rem', borderRadius: '1rem', fontSize: '0.7rem', fontWeight: 500,
      border: `1px solid ${active ? COLORS.slainteBlue : COLORS.borderLight}`,
      backgroundColor: active ? `${COLORS.slainteBlue}15` : 'transparent',
      color: active ? COLORS.slainteBlue : COLORS.textSecondary,
      cursor: 'pointer'
    }}
  >
    {label}
  </button>
);

function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default ImpactPanel;

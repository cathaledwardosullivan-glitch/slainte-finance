/**
 * Impact Comparison Engine
 *
 * Compares a previous cycle snapshot against current analysis results
 * to determine per-sector verified savings and attribute improvements
 * to completed tasks where possible.
 */

import { extractSnapshotMetrics, RECOMMENDATION_METRIC_MAP } from './healthCheckCalculations';

/**
 * Compare a previous snapshot against current analysis results.
 *
 * @param {Object} previousSnapshot - Snapshot from addSnapshot() (has .sectorMetrics)
 * @param {Object} currentAnalysisResults - Return value of analyzeGMSIncome()
 * @returns {Object} Comparison results per sector
 */
export function compareSnapshots(previousSnapshot, currentAnalysisResults) {
  if (!previousSnapshot?.sectorMetrics || !currentAnalysisResults) {
    return null;
  }

  const prev = previousSnapshot.sectorMetrics;
  const current = extractSnapshotMetrics(currentAnalysisResults);

  const sectorComparisons = {
    leave: compareLeave(prev.leave, current.leave),
    practiceSupport: comparePracticeSupport(prev.practiceSupport, current.practiceSupport),
    capitation: compareCapitation(prev.capitation, current.capitation),
    cervicalCheck: compareCervicalCheck(prev.cervicalCheck, current.cervicalCheck),
    stc: compareSTC(prev.stc, current.stc),
    cdm: compareCDM(prev.cdm, current.cdm),
  };

  const sectorsWithNewData = Object.values(sectorComparisons).filter(s => s.hasNewData).length;
  const sectorsImproved = Object.values(sectorComparisons).filter(s => s.verifiedSaving > 0).length;
  const totalVerifiedSaving = Object.values(sectorComparisons).reduce((sum, s) => sum + s.verifiedSaving, 0);

  return {
    comparisonDate: new Date().toISOString(),
    previousSnapshotDate: previousSnapshot.createdDate,
    previousSnapshotId: previousSnapshot.id,
    sectorComparisons,
    totalVerifiedSaving: Math.round(totalVerifiedSaving),
    sectorsWithNewData,
    sectorsImproved,
  };
}

/**
 * Attribute verified savings to projected ledger entries.
 * Promotes projected entries to verified where the targeted metric improved.
 *
 * @param {Object} comparisonResult - Return value of compareSnapshots()
 * @param {Array} savingsLedger - Current savings ledger entries
 * @param {Function} updateSavingsEntry - Storage function to update an entry
 * @param {Function} addSavingsEntry - Storage function to add a new entry
 * @returns {Object} { promoted: number, unattributed: number }
 */
export function attributeVerifiedSavings(comparisonResult, savingsLedger, updateSavingsEntry, addSavingsEntry) {
  if (!comparisonResult?.sectorComparisons) return { promoted: 0, unattributed: 0 };

  const now = new Date().toISOString();
  let promoted = 0;
  let unattributed = 0;

  Object.entries(comparisonResult.sectorComparisons).forEach(([areaId, comparison]) => {
    if (!comparison.hasNewData || comparison.verifiedSaving <= 0) return;

    let remainingVerified = comparison.verifiedSaving;

    // Find projected entries for this sector that haven't been verified yet
    const projectedEntries = (savingsLedger || []).filter(
      entry => entry.areaId === areaId && entry.type === 'projected'
    );

    // Try to match projected entries by metric
    for (const entry of projectedEntries) {
      if (remainingVerified <= 0) break;

      // Check if this entry's metric matches one that improved
      const metricImproved = entry.metric && comparison.metrics?.[entry.metric]?.improved;
      if (!metricImproved && entry.metric) continue;

      // Verified amount is the minimum of projected and remaining verified
      const verifiedAmount = Math.min(entry.amount, remainingVerified);
      remainingVerified -= verifiedAmount;

      updateSavingsEntry(entry.id, {
        type: 'verified',
        amount: verifiedAmount,
        verifiedDate: now,
        verifiedFromSnapshot: comparisonResult.previousSnapshotId,
      });
      promoted++;
    }

    // If there's unattributed improvement, record it
    if (remainingVerified > 50) { // Ignore trivial rounding differences
      addSavingsEntry({
        taskId: null,
        recommendationId: null,
        category: AREA_DISPLAY_NAMES[areaId] || areaId,
        areaId,
        type: 'verified',
        amount: Math.round(remainingVerified),
        description: `Data shows ${AREA_DISPLAY_NAMES[areaId] || areaId} improvement (unattributed)`,
        metric: null,
        verifiedDate: now,
        verifiedFromSnapshot: comparisonResult.previousSnapshotId,
      });
      unattributed++;
    }
  });

  return { promoted, unattributed };
}

// ============================================
// Per-Sector Comparison Functions
// ============================================

function compareLeave(prev, current) {
  if (!prev || !current) return emptySector();
  const hasNewData = current.actualTotal !== prev.actualTotal;
  const saving = Math.max(0, prev.unclaimedValue - current.unclaimedValue);
  return {
    hasNewData,
    metrics: {
      unclaimedDays: delta(prev.unclaimedDays, current.unclaimedDays, true),
      unclaimedValue: delta(prev.unclaimedValue, current.unclaimedValue, true),
      actualTotal: delta(prev.actualTotal, current.actualTotal, false),
    },
    verifiedSaving: hasNewData ? Math.round(saving) : 0,
    summary: hasNewData
      ? saving > 0
        ? `Unclaimed leave reduced by ${prev.unclaimedDays - current.unclaimedDays} days (€${Math.round(saving).toLocaleString()})`
        : 'No change in unclaimed leave'
      : 'Awaiting new data',
  };
}

function comparePracticeSupport(prev, current) {
  if (!prev || !current) return emptySector();
  const hasNewData = current.actualIncome !== prev.actualIncome || current.issueCount !== prev.issueCount;
  const saving = Math.max(0, prev.totalRecoverable - current.totalRecoverable);
  return {
    hasNewData,
    metrics: {
      psIssues: delta(prev.issueCount, current.issueCount, true),
      totalRecoverable: delta(prev.totalRecoverable, current.totalRecoverable, true),
      actualIncome: delta(prev.actualIncome, current.actualIncome, false),
    },
    verifiedSaving: hasNewData ? Math.round(saving) : 0,
    summary: hasNewData
      ? saving > 0
        ? `Practice support issues reduced — €${Math.round(saving).toLocaleString()} recovered`
        : 'No change in practice support issues'
      : 'Awaiting new data',
  };
}

function compareCapitation(prev, current) {
  if (!prev || !current) return emptySector();
  const hasNewData = current.actualIncome !== prev.actualIncome;
  const saving = Math.max(0, prev.registrationGapValue - current.registrationGapValue);
  return {
    hasNewData,
    metrics: {
      registrationGap: delta(prev.registrationGapValue, current.registrationGapValue, true),
      actualIncome: delta(prev.actualIncome, current.actualIncome, false),
    },
    verifiedSaving: hasNewData ? Math.round(saving) : 0,
    summary: hasNewData
      ? saving > 0
        ? `Registration gap reduced by €${Math.round(saving).toLocaleString()}`
        : 'No change in registration gap'
      : 'Awaiting new data',
  };
}

function compareCervicalCheck(prev, current) {
  if (!prev || !current) return emptySector();
  const hasNewData = current.totalSmears !== prev.totalSmears || current.lostIncome !== prev.lostIncome;
  // Two components: zero-payment recovery + activity growth
  const zeroPaymentRecovery = Math.max(0, prev.lostIncome - current.lostIncome);
  const activityGrowth = Math.max(0, current.actualIncome - prev.actualIncome);
  // Only count activity growth if smear count actually increased
  const smearGrowthValue = current.totalSmears > prev.totalSmears ? activityGrowth : 0;
  const saving = zeroPaymentRecovery + smearGrowthValue;
  return {
    hasNewData,
    metrics: {
      zeroPaymentSmears: delta(prev.smearsZeroPayment, current.smearsZeroPayment, true),
      lostIncome: delta(prev.lostIncome, current.lostIncome, true),
      smearActivity: delta(prev.totalSmears, current.totalSmears, false),
    },
    verifiedSaving: hasNewData ? Math.round(saving) : 0,
    summary: hasNewData
      ? saving > 0
        ? `Cervical screening improved — €${Math.round(saving).toLocaleString()} recovered`
        : 'No change in cervical screening'
      : 'Awaiting new data',
  };
}

function compareSTC(prev, current) {
  if (!prev || !current) return emptySector();
  const hasNewData = current.totalClaims !== prev.totalClaims;
  // Sum per-code increases (conservative: only count increases, not decreases)
  let codeGrowthValue = 0;
  if (current.byCode && prev.byCode) {
    Object.entries(current.byCode).forEach(([code, data]) => {
      const prevTotal = prev.byCode[code]?.total || 0;
      if (data.total > prevTotal) {
        codeGrowthValue += data.total - prevTotal;
      }
    });
  }
  // Also check overall increase as a fallback
  const overallIncrease = Math.max(0, current.totalAmount - prev.totalAmount);
  const saving = Math.min(codeGrowthValue, overallIncrease); // Conservative
  return {
    hasNewData,
    metrics: {
      stcClaims: delta(prev.totalClaims, current.totalClaims, false),
      totalAmount: delta(prev.totalAmount, current.totalAmount, false),
    },
    verifiedSaving: hasNewData ? Math.round(saving) : 0,
    summary: hasNewData
      ? saving > 0
        ? `STC claims increased — €${Math.round(saving).toLocaleString()} additional income`
        : 'No change in STC claims'
      : 'Awaiting new data',
  };
}

function compareCDM(prev, current) {
  if (!prev || !current) return emptySector();
  const hasNewData = current.totalAmount !== prev.totalAmount;
  const saving = Math.max(0, current.totalAmount - prev.totalAmount);
  return {
    hasNewData,
    metrics: {
      cdmRegistration: delta(prev.totalAmount, current.totalAmount, false),
      growthPotentialValue: delta(prev.growthPotentialValue, current.growthPotentialValue, true),
    },
    verifiedSaving: hasNewData ? Math.round(saving) : 0,
    summary: hasNewData
      ? saving > 0
        ? `CDM income increased by €${Math.round(saving).toLocaleString()}`
        : 'No change in CDM income'
      : 'Awaiting new data',
  };
}

// ============================================
// Helpers
// ============================================

const AREA_DISPLAY_NAMES = {
  leave: 'Study & Annual Leave',
  practiceSupport: 'Practice Support',
  capitation: 'Capitation',
  cervicalCheck: 'Cervical Check',
  stc: 'Special Type Consultations',
  cdm: 'Chronic Disease Management',
};

function emptySector() {
  return { hasNewData: false, metrics: {}, verifiedSaving: 0, summary: 'No data' };
}

/**
 * Create a metric delta object.
 * @param {number} previous
 * @param {number} current
 * @param {boolean} lowerIsBetter - If true, a decrease = improvement
 */
function delta(previous, current, lowerIsBetter) {
  const prev = previous || 0;
  const curr = current || 0;
  const change = curr - prev;
  return {
    previous: prev,
    current: curr,
    change,
    improved: lowerIsBetter ? change < 0 : change > 0,
  };
}

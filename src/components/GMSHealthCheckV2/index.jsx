import React, { useState, useMemo, useCallback, useContext, useEffect } from 'react';
import { Printer, TrendingUp } from 'lucide-react';
import COLORS from '../../utils/colors';
import { useAppContext } from '../../context/AppContext';
import { usePracticeProfile } from '../../hooks/usePracticeProfile';
import TasksContext from '../../context/TasksContext';
import { generateHealthCheckReportHTML } from '../NewGMSHealthCheck/HealthCheckReport';
import {
  aggregateGMSPayments,
  getUniquePanelCount,
  analyzeGMSIncome,
  generateRecommendations,
  extractSnapshotMetrics,
  calculateImpactSummary
} from '../../utils/healthCheckCalculations';
import { compareSnapshots } from '../../utils/impactComparisonEngine';
import { useAreaReadiness, AREAS } from '../NewGMSHealthCheck/useAreaReadiness';
import {
  getActionItems,
  saveActionItems,
  addSnapshot,
  getLatestSnapshot,
  getSavingsLedger,
  getSnapshots
} from '../../storage/practiceProfileStorage';
import { useGMSNarratives } from '../../hooks/useGMSNarratives';
import SummaryHeader from './SummaryHeader';
import AreaCard from './AreaCard';
import AreaModal from './AreaModal';
import ImpactPanel from '../NewGMSHealthCheck/ImpactPanel';

/**
 * Map area IDs to recommendation categories for filtering
 */
const AREA_CATEGORY_MAP = {
  leave: 'Leave',
  practiceSupport: 'Practice Support',
  capitation: 'Capitation',
  cervicalCheck: 'Cervical Screening',
  stc: 'STC',
  cdm: 'CDM'
};

/**
 * Map recommendation IDs to area IDs
 */
const REC_AREA_MAP = {
  'capitation-registration': 'capitation',
  'capitation-growth': 'capitation',
  'practice-support-issues': 'practiceSupport',
  'practice-support-growth': 'practiceSupport',
  'leave-payments': 'leave',
  'disease-management': 'cdm',
  'cervical-check-issues': 'cervicalCheck',
  'cervical-check-growth': 'cervicalCheck',
  'stc-opportunities': 'stc',
  'cdm-growth': 'cdm'
};

/**
 * Extract findings from analysis results for a specific area.
 * Copied from NewGMSHealthCheck/index.jsx — same logic, shared extraction.
 */
function extractFindings(areaId, analysisResults, healthCheckData) {
  if (!analysisResults) return [];
  const findings = [];
  const breakdowns = analysisResults.potentialBreakdowns || {};

  if (areaId === 'leave') {
    const leave = breakdowns.leaveDetails;
    if (leave) {
      if (leave.studyLeaveUnclaimedDays > 0) {
        findings.push({ type: 'issue', message: `${leave.studyLeaveUnclaimedDays} days study leave unclaimed`, value: leave.studyLeaveUnclaimedValue || 0 });
      }
      if (leave.annualLeaveUnclaimedDays > 0) {
        findings.push({ type: 'issue', message: `${leave.annualLeaveUnclaimedDays} days annual leave unclaimed`, value: leave.annualLeaveUnclaimedValue || 0 });
      }
      if (leave.studyLeaveUnclaimedDays === 0 && leave.annualLeaveUnclaimedDays === 0) {
        findings.push({ type: 'positive', message: 'All leave entitlements are being claimed', value: 0 });
      }
    }
  }

  if (areaId === 'practiceSupport') {
    const issues = breakdowns.issues || [];
    issues.forEach(issue => {
      if (issue.type === 'WRONG_INCREMENT') {
        findings.push({ type: 'issue', message: `${issue.staffName}: should be on increment ${issue.correctIncrement} (currently ${issue.currentIncrement})`, value: issue.annualLoss || 0 });
      }
      if (issue.type === 'UNCLAIMED_HOURS') {
        findings.push({ type: 'issue', message: issue.message || `${issue.unclaimedHours} unclaimed ${issue.category} hours`, value: issue.potentialGain || 0 });
      }
    });

    const opportunities = breakdowns.opportunities || [];
    opportunities.forEach(opp => {
      if (opp.type === 'HIRING_OPPORTUNITY') {
        findings.push({ type: 'opportunity', message: opp.message || 'Hiring opportunity available', value: opp.potentialSubsidy || 0 });
      }
    });

    // Unregistered staff detection
    const staffDetails = healthCheckData?.staffDetails || [];
    const eligibleRoles = ['secretary', 'nurse', 'practiceManager'];
    const unregisteredStaff = staffDetails.filter(s =>
      !s.fromPCRS && eligibleRoles.includes(s.staffType) && parseFloat(s.actualHoursWorked) > 0
    );
    const engineCoversRole = {
      secretary: issues.some(i => i.type === 'UNCLAIMED_HOURS' && i.category === 'receptionists'),
      nurse: issues.some(i => i.type === 'UNCLAIMED_HOURS' && i.category?.includes('nurse')),
      practiceManager: issues.some(i => i.type === 'UNCLAIMED_HOURS' && i.category?.includes('nurse'))
    };
    const RATE_DEFAULTS = { secretary: 24586, nurse: 37824, practiceManager: 34041 };
    const FULL_TIME_HOURS = 35;

    unregisteredStaff.forEach(staff => {
      const name = `${staff.firstName || ''} ${staff.surname || ''}`.trim();
      const roleLabel = staff.staffType === 'secretary' ? 'secretary'
        : staff.staffType === 'practiceManager' ? 'practice manager' : staff.staffType;
      const hours = parseFloat(staff.actualHoursWorked) || 0;
      const engineHandled = engineCoversRole[staff.staffType];
      const defaultRate = RATE_DEFAULTS[staff.staffType] || 0;
      const estimatedValue = engineHandled ? 0 : Math.round((hours / FULL_TIME_HOURS) * defaultRate);
      findings.push({ type: 'issue', message: `${name} (${roleLabel}, ${hours} hrs/week) is not registered with PCRS for a subsidy`, value: estimatedValue, isUnregistered: true });
    });

    if (findings.length === 0) {
      findings.push({ type: 'positive', message: 'No issues found in this area', value: 0 });
    }
  }

  if (areaId === 'capitation') {
    const capAnalysis = breakdowns.capitationAnalysis;
    if (capAnalysis?.registrationChecks) {
      capAnalysis.registrationChecks.forEach(check => {
        if (check.gap > 0) {
          findings.push({ type: 'issue', message: `${check.ageGroup}: ${check.gap} patients may not be registered with PCRS`, value: check.gapValue || 0 });
        }
      });
    }
  }

  if (areaId === 'cervicalCheck') {
    const cervical = breakdowns.cervicalScreeningAnalysis;
    if (cervical && cervical.smearsZeroPayment > 0) {
      findings.push({ type: 'issue', message: `${cervical.smearsZeroPayment} smears with zero payment`, value: cervical.lostIncome || 0 });
    }
  }

  if (areaId === 'stc') {
    const stcAnalysis = breakdowns.stcAnalysis;
    if (stcAnalysis?.opportunities) {
      stcAnalysis.opportunities.slice(0, 3).forEach(opp => {
        findings.push({ type: 'opportunity', message: opp.message || opp.description || `${opp.code}: growth opportunity`, value: opp.value || 0 });
      });
    }
  }

  if (areaId === 'cdm') {
    const cdmAnalysis = breakdowns.cdmAnalysis;
    if (cdmAnalysis?.growthPotential?.breakdown) {
      cdmAnalysis.growthPotential.breakdown.slice(0, 3).forEach(item => {
        if (item.potentialValue > 0) {
          findings.push({ type: 'opportunity', message: `${item.category}: ${item.gap} additional claims gap (${item.eligiblePatients} eligible patients)`, value: item.potentialValue });
        }
      });
    }
  }

  return findings;
}


/**
 * GMSHealthCheckV2 - Card-based, AI-ready GMS Health Check.
 * Same deterministic engine, presented as 6 expandable area cards
 * with confidence bands and a summary header.
 */
const GMSHealthCheckV2 = () => {
  const { paymentAnalysisData } = useAppContext();
  const { profile, updateProfile } = usePracticeProfile();
  const { readiness, summary } = useAreaReadiness(profile);
  const tasksCtx = useContext(TasksContext);
  const tasks = tasksCtx?.tasks || [];

  const [activeModal, setActiveModal] = useState(null); // area ID or null
  const [showImpactPanel, setShowImpactPanel] = useState(false);

  const healthCheckData = profile?.healthCheckData || {};

  // --- Memoised calculations (same as v1) ---

  const aggregatedData = useMemo(() => {
    if (!paymentAnalysisData || paymentAnalysisData.length === 0) return null;
    try {
      return aggregateGMSPayments(paymentAnalysisData, profile);
    } catch (e) {
      console.error('[GMSHealthCheckV2] Error aggregating:', e);
      return null;
    }
  }, [paymentAnalysisData, profile]);

  const numGPs = useMemo(() => getUniquePanelCount(paymentAnalysisData), [paymentAnalysisData]);

  const analysisResults = useMemo(() => {
    if (!aggregatedData) return null;
    try {
      return analyzeGMSIncome(paymentAnalysisData, profile, healthCheckData);
    } catch (e) {
      console.error('[GMSHealthCheckV2] Error analysing:', e);
      return null;
    }
  }, [paymentAnalysisData, profile, healthCheckData, aggregatedData]);

  // --- Impact tracking ---
  const [impactRefreshKey, setImpactRefreshKey] = useState(0);

  useEffect(() => {
    const handler = () => setImpactRefreshKey(k => k + 1);
    window.addEventListener('impact:refresh', handler);
    return () => window.removeEventListener('impact:refresh', handler);
  }, []);

  const impactSummary = useMemo(() => {
    return calculateImpactSummary(getSavingsLedger());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [impactRefreshKey]);

  const sectorComparisons = useMemo(() => {
    const latest = getLatestSnapshot();
    if (!latest || !analysisResults) return null;
    return compareSnapshots(latest, analysisResults);
  }, [analysisResults]);

  // --- Recommendations & financial summary ---

  const { allRecommendations, financialSummary, perAreaFinancials } = useMemo(() => {
    const empty = { allRecommendations: [], financialSummary: { unclaimed: 0, growth: 0 }, perAreaFinancials: {} };
    if (!analysisResults) return empty;
    try {
      const recs = generateRecommendations(analysisResults, profile, healthCheckData, paymentAnalysisData);
      const priority = recs.priorityRecommendations || [];
      const growthRecs = recs.growthOpportunities || [];
      const allRecs = [...priority, ...growthRecs];

      const areaFin = {};
      allRecs.forEach(rec => {
        const areaId = REC_AREA_MAP[rec.id];
        if (!areaId) return;
        if (!areaFin[areaId]) areaFin[areaId] = { unclaimed: 0, growth: 0 };
        if (rec.type === 'priority') {
          areaFin[areaId].unclaimed += rec.potential || 0;
        } else {
          areaFin[areaId].growth += rec.potential || 0;
        }
      });

      return {
        allRecommendations: allRecs,
        financialSummary: {
          unclaimed: priority.reduce((sum, r) => sum + (r.potential || 0), 0),
          growth: growthRecs.reduce((sum, r) => sum + (r.potential || 0), 0)
        },
        perAreaFinancials: areaFin
      };
    } catch (e) {
      console.error('[GMSHealthCheckV2] Error generating recommendations:', e);
      return empty;
    }
  }, [analysisResults, profile, healthCheckData, paymentAnalysisData]);

  // --- Per-area analysis objects ---

  const getAreaAnalysis = useCallback((areaId) => {
    if (!analysisResults) return null;

    const incomeKey = areaId === 'leave' ? 'leavePayments'
      : areaId === 'practiceSupport' ? 'practiceSupport'
        : areaId === 'cervicalCheck' ? 'cervicalCheck'
          : areaId;

    let actual;
    if (areaId === 'leave') {
      const leaveDetails = analysisResults.potentialBreakdowns?.leaveDetails;
      actual = leaveDetails?.actualTotal ||
        (leaveDetails?.actualStudyLeave || 0) + (leaveDetails?.actualAnnualLeave || 0);
    } else {
      actual = analysisResults.actualIncome?.[incomeKey] || 0;
    }

    let potential = analysisResults.potentialIncome?.[incomeKey] || 0;

    if (areaId === 'cervicalCheck') {
      const upper = analysisResults.potentialIncome?.cervicalCheckUpper || 0;
      if (upper > potential) potential = upper;
    }

    const findings = extractFindings(areaId, analysisResults, healthCheckData);

    // Practice support per-staff override (same logic as v1)
    if (areaId === 'practiceSupport') {
      const breakdowns = analysisResults.potentialBreakdowns;
      const psEntitlement = breakdowns?.entitlement;
      const psCurrent = breakdowns?.current;
      const psStaffDetails = healthCheckData?.staffDetails || [];

      if (psEntitlement && psCurrent) {
        const FULL_TIME = 35;
        const PS_RATES = {
          secretary: { 1: 22694, 2: 24586, 3: 26477 },
          nurse: { 1: 34041, 2: 35933, 3: 37824, 4: 41606 },
          practiceManager: { 1: 34041 }
        };
        const PS_MAX = { secretary: 3, nurse: 4, practiceManager: 1 };
        const getRate = (type, pt) => PS_RATES[type]?.[pt] || 0;
        const getPoint = (type, yrs) => Math.min(Math.max(1, Math.ceil(yrs || 1)), PS_MAX[type] || 1);
        const entitled = psEntitlement.totalHours || 0;

        let perStaffTotal = 0;

        [
          {
            registered: (psCurrent.receptionists?.staff || []).map(s => ({ ...s, staffType: 'secretary' })),
            unregistered: psStaffDetails.filter(s => !s.fromPCRS && s.staffType === 'secretary' && parseFloat(s.actualHoursWorked) > 0)
          },
          {
            registered: [
              ...(psCurrent.nurses?.staff || []).map(s => ({ ...s, staffType: 'nurse' })),
              ...(psCurrent.practiceManager?.staff || []).map(s => ({ ...s, staffType: 'practiceManager' }))
            ],
            unregistered: psStaffDetails.filter(s => !s.fromPCRS && (s.staffType === 'nurse' || s.staffType === 'practiceManager') && parseFloat(s.actualHoursWorked) > 0)
          }
        ].forEach(({ registered, unregistered }) => {
          let catUnderpaidHrs = 0;
          registered.forEach(staff => {
            const name = `${staff.firstName} ${staff.surname}`;
            const matched = psStaffDetails.find(sd =>
              `${sd.firstName || ''} ${sd.surname || ''}`.trim().toLowerCase() === name.toLowerCase()
            );
            const pcrsHrs = staff.weeklyHours || 0;
            const actualHrs = matched ? (parseFloat(matched.actualHoursWorked) || 0) : null;
            const claimable = actualHrs !== null ? Math.min(actualHrs, FULL_TIME) : null;
            const gap = claimable !== null && claimable > pcrsHrs ? claimable - pcrsHrs : 0;
            if (gap > 0) {
              const pt = Math.min(staff.incrementPoint || 1, PS_MAX[staff.staffType] || 1);
              catUnderpaidHrs += gap;
              perStaffTotal += Math.round((gap / FULL_TIME) * getRate(staff.staffType, pt));
            }
          });

          if (unregistered.length > 0) {
            const pcrsTotal = registered.reduce((s, st) => s + (st.weeklyHours || 0), 0);
            let remaining = Math.max(0, entitled - pcrsTotal - catUnderpaidHrs);
            unregistered.forEach(s => {
              const hrs = Math.min(parseFloat(s.actualHoursWorked) || 0, FULL_TIME);
              const claimableHrs = Math.min(hrs, remaining);
              if (claimableHrs > 0) {
                remaining -= claimableHrs;
                perStaffTotal += Math.round((claimableHrs / FULL_TIME) * getRate(s.staffType, getPoint(s.staffType, s.yearsExperience || 1)));
              }
            });
          }
        });

        (breakdowns.issues || []).filter(i => i.type === 'WRONG_INCREMENT').forEach(issue => {
          perStaffTotal += issue.annualLoss || 0;
        });

        potential = actual + perStaffTotal;
      } else {
        const unregisteredValue = findings
          .filter(f => f.isUnregistered && f.value > 0)
          .reduce((sum, f) => sum + f.value, 0);
        if (unregisteredValue > 0) {
          potential = Math.max(potential, actual + unregisteredValue);
        }
      }
    }

    return { actual, potential, findings, breakdown: analysisResults.potentialBreakdowns };
  }, [analysisResults, healthCheckData]);

  // --- AI Narratives ---
  // Built AFTER getAreaAnalysis so it uses the same overridden figures the cards display

  const narrativeMetrics = useMemo(() => {
    if (!analysisResults || summary.analyzableCount === 0) return null;

    const areas = {};
    for (const area of AREAS) {
      const areaId = area.id;
      const areaAnalysis = readiness[areaId]?.canAnalyze ? getAreaAnalysis(areaId) : null;
      areas[areaId] = {
        actual: areaAnalysis?.actual || 0,
        potential: areaAnalysis?.potential || 0,
        status: readiness[areaId]?.status || 'no-data'
      };
    }

    return {
      totalActual: Object.values(areas).reduce((s, a) => s + a.actual, 0),
      totalPotential: Object.values(areas).reduce((s, a) => s + a.potential, 0),
      readyCount: summary.readyCount,
      analyzableCount: summary.analyzableCount,
      areas
    };
  }, [analysisResults, readiness, summary, getAreaAnalysis]);

  const { narratives, isLoading: narrativesLoading } = useGMSNarratives(narrativeMetrics);

  // --- Per-area recommendations (same logic as v1) ---

  const getAreaRecommendations = useCallback((areaId, findings = []) => {
    const categoryName = AREA_CATEGORY_MAP[areaId];
    if (!categoryName) return [];
    const engineRecs = allRecommendations.filter(rec =>
      rec.category === categoryName ||
      rec.area === areaId ||
      (rec.title || rec.description || '').toLowerCase().includes(categoryName.toLowerCase())
    );

    // Practice support: rebuild priority actions with per-staff detail (same as v1)
    if (areaId === 'practiceSupport') {
      const breakdowns = analysisResults?.potentialBreakdowns;
      const psEntitlement = breakdowns?.entitlement;
      const psCurrent = breakdowns?.current;
      const psStaffDetails = healthCheckData?.staffDetails || [];
      const priorityRec = engineRecs.find(r => r.type === 'priority');

      if (priorityRec && psEntitlement && psCurrent) {
        const FULL_TIME = 35;
        const PS_RATES = {
          secretary: { 1: 22694, 2: 24586, 3: 26477 },
          nurse: { 1: 34041, 2: 35933, 3: 37824, 4: 41606 },
          practiceManager: { 1: 34041 }
        };
        const PS_MAX = { secretary: 3, nurse: 4, practiceManager: 1 };
        const getRate = (type, pt) => PS_RATES[type]?.[pt] || 0;
        const getPoint = (type, yrs) => Math.min(Math.max(1, Math.ceil(yrs || 1)), PS_MAX[type] || 1);
        const entitled = psEntitlement.totalHours || 0;

        const newActions = [];
        let newTotal = 0;

        [
          {
            label: 'receptionist',
            registered: (psCurrent.receptionists?.staff || []).map(s => ({ ...s, staffType: 'secretary' })),
            unregistered: psStaffDetails.filter(s => !s.fromPCRS && s.staffType === 'secretary' && parseFloat(s.actualHoursWorked) > 0)
          },
          {
            label: 'nurse/practice manager',
            registered: [
              ...(psCurrent.nurses?.staff || []).map(s => ({ ...s, staffType: 'nurse' })),
              ...(psCurrent.practiceManager?.staff || []).map(s => ({ ...s, staffType: 'practiceManager' }))
            ],
            unregistered: psStaffDetails.filter(s => !s.fromPCRS && (s.staffType === 'nurse' || s.staffType === 'practiceManager') && parseFloat(s.actualHoursWorked) > 0)
          }
        ].forEach(({ label, registered, unregistered }) => {
          let catUnderpaidHrs = 0;
          let catUnderpaidValue = 0;
          registered.forEach(staff => {
            const name = `${staff.firstName} ${staff.surname}`;
            const matched = psStaffDetails.find(sd =>
              `${sd.firstName || ''} ${sd.surname || ''}`.trim().toLowerCase() === name.toLowerCase()
            );
            const pcrsHrs = staff.weeklyHours || 0;
            const actualHrs = matched ? (parseFloat(matched.actualHoursWorked) || 0) : null;
            const claimable = actualHrs !== null ? Math.min(actualHrs, FULL_TIME) : null;
            const gap = claimable !== null && claimable > pcrsHrs ? claimable - pcrsHrs : 0;
            if (gap > 0) {
              const pt = Math.min(staff.incrementPoint || 1, PS_MAX[staff.staffType] || 1);
              catUnderpaidHrs += gap;
              catUnderpaidValue += Math.round((gap / FULL_TIME) * getRate(staff.staffType, pt));
            }
          });

          if (catUnderpaidHrs > 0) {
            newActions.push({
              action: `Claim additional ${catUnderpaidHrs} ${label} hours: registered staff working more hours than PCRS is paying for`,
              value: catUnderpaidValue,
              effort: 'Low',
              detail: `Contact PCRS to update registered hours to match actual hours worked (up to ${FULL_TIME} hr cap).`
            });
            newTotal += catUnderpaidValue;
          }

          if (unregistered.length > 0) {
            const pcrsTotal = registered.reduce((s, st) => s + (st.weeklyHours || 0), 0);
            let remaining = Math.max(0, entitled - pcrsTotal - catUnderpaidHrs);
            let unregValue = 0;
            const names = [];

            unregistered.forEach(s => {
              const hrs = Math.min(parseFloat(s.actualHoursWorked) || 0, FULL_TIME);
              const claimableHrs = Math.min(hrs, remaining);
              if (claimableHrs > 0) {
                remaining -= claimableHrs;
                unregValue += Math.round((claimableHrs / FULL_TIME) * getRate(s.staffType, getPoint(s.staffType, s.yearsExperience || 1)));
              }
              names.push(`${s.firstName || ''} ${s.surname || ''}`.trim());
            });

            newActions.push({
              action: `Register ${names.join(', ')} with PCRS for ${label} subsidy`,
              value: unregValue,
              effort: 'Low',
              detail: 'Contact PCRS to register this staff member for the practice support subsidy scheme.'
            });
            newTotal += unregValue;
          }
        });

        const wrongIncrements = (breakdowns.issues || []).filter(i => i.type === 'WRONG_INCREMENT');
        wrongIncrements.forEach(issue => {
          newActions.push({
            action: `Update ${issue.staffName}'s increment point from ${issue.currentIncrement} to ${issue.correctIncrement} (${issue.yearsExperience} years experience)`,
            value: issue.annualLoss || 0,
            effort: 'Low'
          });
          newTotal += issue.annualLoss || 0;
        });

        priorityRec.actions = newActions;
        priorityRec.potential = newTotal;
        priorityRec.summary = `Based on your panel size, you are entitled to ${entitled} hours/week each for receptionists AND nurses/PM.`;
      }

      // Fallback synthetic recs for unregistered staff
      if (engineRecs.length === 0) {
        const unregisteredFindings = findings.filter(f => f.isUnregistered && f.value > 0);
        if (unregisteredFindings.length > 0) {
          const totalValue = unregisteredFindings.reduce((sum, f) => sum + f.value, 0);
          engineRecs.push({
            id: 'practice-support-unregistered',
            title: 'Register Staff with PCRS for Subsidies',
            category: 'Practice Support',
            potential: totalValue,
            type: 'priority',
            effort: 'Low',
            impact: 'High',
            summary: `${unregisteredFindings.length} staff member${unregisteredFindings.length !== 1 ? 's' : ''} working in eligible roles but not receiving PCRS subsidies.`,
            actions: unregisteredFindings.map(f => ({
              action: `Register for PCRS subsidy: ${f.message}`,
              value: f.value,
              effort: 'Low',
              detail: 'Contact PCRS to register this staff member for the practice support subsidy scheme.'
            }))
          });
        }
      }

      // Capacity Grant
      const psEntitlement2 = analysisResults?.potentialBreakdowns?.entitlement;
      if (psEntitlement2?.capacityGrantEligible) {
        const grantPerGP = 15000;
        const eligibleGPs = psEntitlement2.eligibleGPsForGrant || numGPs;
        const grantTotal = eligibleGPs * grantPerGP;
        engineRecs.forEach(rec => {
          if (rec.type !== 'priority') {
            const actions = rec.actions || [];
            const alreadyHasGrant = actions.some(a => a.action?.startsWith('Apply for Capacity Support Grant'));
            if (!alreadyHasGrant) {
              actions.push({
                action: `Apply for Capacity Support Grant: €${grantPerGP.toLocaleString()} per GP (${eligibleGPs} GP${eligibleGPs !== 1 ? 's' : ''} = €${grantTotal.toLocaleString()}) for new staff hired or additional hours since July 2023`,
                value: grantTotal,
                effort: 'Medium'
              });
              rec.actions = actions;
            }
          }
        });
      }
    }

    return engineRecs;
  }, [allRecommendations, analysisResults, numGPs, healthCheckData]);

  // --- Data update handler ---

  const TRACKED_SECTIONS = [
    'demographics', 'cervicalCheckActivity', 'diseaseRegisters',
    'stcServices', 'stcDemographics', 'staffDetails'
  ];

  const handleUpdate = useCallback((newHealthCheckData) => {
    const oldData = profile?.healthCheckData || {};
    const now = new Date().toISOString();
    const timestamps = { ...(oldData._timestamps || {}) };

    for (const section of TRACKED_SECTIONS) {
      if (JSON.stringify(newHealthCheckData[section]) !== JSON.stringify(oldData[section])) {
        timestamps[section] = now;
      }
    }

    updateProfile({ healthCheckData: { ...newHealthCheckData, _timestamps: timestamps } });
  }, [updateProfile, profile]);

  // --- Cycle management ---

  const cycleState = summary.analyzableCount >= 6 ? 'ready'
    : summary.analyzableCount >= 4 ? 'warming'
      : 'dormant';

  const handleStartNewCycle = useCallback(() => {
    try {
      if (analysisResults) {
        const sectorMetrics = extractSnapshotMetrics(analysisResults);
        const allItems = getActionItems() || [];
        const completedGMS = allItems.filter(t => t.status === 'completed' && t.recommendationId);
        addSnapshot({
          sectorMetrics,
          totalUnclaimed: analysisResults.totalUnclaimed || 0,
          totalActual: analysisResults.totalActual || 0,
          totalPotential: analysisResults.totalPotential || 0,
          tasksAtSnapshot: {
            total: allItems.filter(t => t.recommendationId).length,
            completed: completedGMS.length,
            projectedSavings: completedGMS.reduce((sum, t) => sum + (t.potentialValue || 0), 0),
          },
        });
      }

      const staleDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
      const updatedTimestamps = {};
      if (healthCheckData._timestamps) {
        Object.keys(healthCheckData._timestamps).forEach(key => {
          updatedTimestamps[key] = staleDate;
        });
      }
      handleUpdate({ ...healthCheckData, _timestamps: updatedTimestamps });

      const allItems = getActionItems() || [];
      const remaining = allItems.filter(t => !(t.status === 'completed' && t.recommendationId));
      saveActionItems(remaining);
      window.dispatchEvent(new Event('tasks:refresh'));
      window.dispatchEvent(new Event('impact:refresh'));
    } catch (err) {
      console.error('Failed to start new cycle:', err);
    }
  }, [healthCheckData, handleUpdate, analysisResults]);

  // --- Print report ---

  const canPrint = summary.analyzableCount > 0;

  const handlePrintReport = useCallback(() => {
    if (!analysisResults) return;
    const recommendations = (() => {
      try {
        return generateRecommendations(analysisResults, profile, healthCheckData, paymentAnalysisData);
      } catch { return {}; }
    })();

    const html = generateHealthCheckReportHTML({
      analysisResults,
      recommendations,
      healthCheckData,
      practiceProfile: profile,
      paymentAnalysisData,
      perAreaFinancials,
      financialSummary,
      readiness,
      tasks
    });

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  }, [analysisResults, profile, healthCheckData, paymentAnalysisData, perAreaFinancials, financialSummary, readiness, tasks]);

  // --- Deep-linking: listen for external navigation events ---

  useEffect(() => {
    const handler = (e) => {
      const areaId = e.detail?.areaId;
      if (areaId && AREAS.some(a => a.id === areaId)) {
        setActiveModal(areaId);
      }
    };
    window.addEventListener('gms-health-check-v2:openArea', handler);
    return () => window.removeEventListener('gms-health-check-v2:openArea', handler);
  }, []);

  // --- Impact panel view ---

  if (showImpactPanel) {
    return (
      <ImpactPanel
        impactSummary={impactSummary}
        sectorComparisons={sectorComparisons}
        snapshots={getSnapshots()}
        onClose={() => setShowImpactPanel(false)}
      />
    );
  }

  // --- Main render ---

  return (
    <div style={{ backgroundColor: COLORS.bgPage, minHeight: '100%' }}>
      <div style={{ maxWidth: '64rem', margin: '0 auto' }}>
        {/* Summary header with mini donut */}
        <SummaryHeader
          financialSummary={financialSummary}
          readiness={readiness}
          summary={summary}
          narratives={narratives}
          narrativesLoading={narrativesLoading}
        />

        {/* Action buttons row */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <button
            onClick={handlePrintReport}
            disabled={!canPrint}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.4rem 0.85rem',
              borderRadius: '9999px',
              border: `1px solid ${canPrint ? COLORS.slainteBlue : COLORS.borderDark}`,
              background: canPrint ? COLORS.slainteBlue : 'transparent',
              color: canPrint ? 'white' : COLORS.textSecondary,
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: canPrint ? 'pointer' : 'not-allowed',
              opacity: canPrint ? 1 : 0.5
            }}
          >
            <Printer size={14} />
            Print Report
          </button>

          <button
            onClick={() => setShowImpactPanel(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.4rem 0.85rem',
              borderRadius: '9999px',
              border: `1px solid ${impactSummary?.totalCombined > 0 ? '#2ECC71' : COLORS.borderDark}`,
              background: impactSummary?.totalCombined > 0 ? 'rgba(46, 204, 113, 0.1)' : 'transparent',
              color: impactSummary?.totalCombined > 0 ? '#2ECC71' : COLORS.textSecondary,
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <TrendingUp size={14} />
            Impact{impactSummary?.totalCombined > 0 ? `: €${Math.round(impactSummary.totalCombined).toLocaleString()}` : ''}
          </button>

          {cycleState !== 'dormant' && (
            <button
              onClick={handleStartNewCycle}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.4rem 0.85rem',
                borderRadius: '9999px',
                border: `1px solid ${COLORS.slainteBlue}`,
                background: 'transparent',
                color: COLORS.slainteBlue,
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Start New Cycle
            </button>
          )}
        </div>

        {/* 6 area cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
          {AREAS.map(area => {
            const areaAnalysis = readiness[area.id]?.canAnalyze ? getAreaAnalysis(area.id) : null;

            return (
              <AreaCard
                key={area.id}
                areaId={area.id}
                readiness={readiness}
                analysis={areaAnalysis}
                narrative={narratives?.[area.id]}
                onClick={() => setActiveModal(area.id)}
              />
            );
          })}
        </div>

        {/* Area detail modal */}
        {activeModal && (() => {
          const areaAnalysis = readiness[activeModal]?.canAnalyze ? getAreaAnalysis(activeModal) : null;
          const areaFindings = areaAnalysis?.findings || [];
          const areaRecs = readiness[activeModal]?.canAnalyze ? getAreaRecommendations(activeModal, areaFindings) : [];

          return (
            <AreaModal
              areaId={activeModal}
              readiness={readiness}
              analysis={areaAnalysis}
              recommendations={areaRecs}
              healthCheckData={healthCheckData}
              paymentAnalysisData={paymentAnalysisData}
              onUpdate={handleUpdate}
              onClose={() => setActiveModal(null)}
            />
          );
        })()}
      </div>
    </div>
  );
};

export default GMSHealthCheckV2;

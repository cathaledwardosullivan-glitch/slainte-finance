import React, { useState, useMemo, useCallback, useContext } from 'react';
import { Printer, Upload, CheckCircle, RefreshCw } from 'lucide-react';
import COLORS from '../../utils/colors';
import { useAppContext } from '../../context/AppContext';
import { usePracticeProfile } from '../../hooks/usePracticeProfile';
import TasksContext from '../../context/TasksContext';
import { generateHealthCheckReportHTML } from './HealthCheckReport';
import { applySocratesCSV } from '../../utils/quickFillEngine';
import {
  aggregateGMSPayments,
  getUniquePanelCount,
  calculateLeavePotential,
  calculatePracticeSupportPotential,
  analyzeCapitationOpportunities,
  calculateCervicalCheckPotential,
  analyzeSTCOpportunities,
  analyzeCDMFromSTCDetails,
  generateRecommendations,
  analyzeGMSIncome
} from '../../utils/healthCheckCalculations';
import { useAreaReadiness, AREAS } from './useAreaReadiness';
import { getActionItems, saveActionItems } from '../../storage/practiceProfileStorage';
import CircularWorkflow from './CircularWorkflow';
import AreaDetailView from './AreaDetailView';

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
 * Extract findings from analysis results for a specific area
 */
function extractFindings(areaId, analysisResults, healthCheckData) {
  if (!analysisResults) return [];
  const findings = [];
  const breakdowns = analysisResults.potentialBreakdowns || {};

  if (areaId === 'leave') {
    const leave = breakdowns.leaveDetails;
    if (leave) {
      if (leave.studyLeaveUnclaimedDays > 0) {
        findings.push({
          type: 'issue',
          message: `${leave.studyLeaveUnclaimedDays} days study leave unclaimed`,
          value: leave.studyLeaveUnclaimedValue || 0
        });
      }
      if (leave.annualLeaveUnclaimedDays > 0) {
        findings.push({
          type: 'issue',
          message: `${leave.annualLeaveUnclaimedDays} days annual leave unclaimed`,
          value: leave.annualLeaveUnclaimedValue || 0
        });
      }
      if (leave.studyLeaveUnclaimedDays === 0 && leave.annualLeaveUnclaimedDays === 0) {
        findings.push({ type: 'positive', message: 'All leave entitlements are being claimed', value: 0 });
      }
    }
  }

  if (areaId === 'practiceSupport') {
    // Issues from the calculation engine (wrong increments, unclaimed hours)
    const issues = breakdowns.issues || [];
    issues.forEach(issue => {
      if (issue.type === 'WRONG_INCREMENT') {
        findings.push({
          type: 'issue',
          message: `${issue.staffName}: should be on increment ${issue.correctIncrement} (currently ${issue.currentIncrement})`,
          value: issue.annualLoss || 0
        });
      }
      if (issue.type === 'UNCLAIMED_HOURS') {
        findings.push({
          type: 'issue',
          message: issue.message || `${issue.unclaimedHours} unclaimed ${issue.category} hours`,
          value: issue.potentialGain || 0
        });
      }
    });

    // Opportunities from the calculation engine (hiring potential)
    const opportunities = breakdowns.opportunities || [];
    opportunities.forEach(opp => {
      if (opp.type === 'HIRING_OPPORTUNITY') {
        findings.push({
          type: 'opportunity',
          message: opp.message || 'Hiring opportunity available',
          value: opp.potentialSubsidy || 0
        });
      }
    });

    // Per-staff detection: eligible staff NOT registered with PCRS
    // These represent potential missed income that the aggregate checks may not catch
    const staffDetails = healthCheckData?.staffDetails || [];
    const eligibleRoles = ['secretary', 'nurse', 'practiceManager'];
    const unregisteredStaff = staffDetails.filter(s =>
      !s.fromPCRS && eligibleRoles.includes(s.staffType) && parseFloat(s.actualHoursWorked) > 0
    );

    // Check which role categories the engine already covers via UNCLAIMED_HOURS
    // When the engine has already quantified the gap for a role, we don't double-count
    const engineCoversRole = {
      secretary: issues.some(i => i.type === 'UNCLAIMED_HOURS' && i.category === 'receptionists'),
      nurse: issues.some(i => i.type === 'UNCLAIMED_HOURS' && i.category?.includes('nurse')),
      practiceManager: issues.some(i => i.type === 'UNCLAIMED_HOURS' && i.category?.includes('nurse'))
    };

    // GMS rate defaults for estimating subsidy value (from gmsRates.js)
    const RATE_DEFAULTS = { secretary: 24586, nurse: 37824, practiceManager: 34041 };
    const FULL_TIME_HOURS = 35;

    unregisteredStaff.forEach(staff => {
      const name = `${staff.firstName || ''} ${staff.surname || ''}`.trim();
      const roleLabel = staff.staffType === 'secretary' ? 'secretary'
        : staff.staffType === 'practiceManager' ? 'practice manager' : staff.staffType;
      const hours = parseFloat(staff.actualHoursWorked) || 0;

      // Estimate annual subsidy value using GMS rates, but only when the
      // calculation engine hasn't already captured this role's gap (e.g. no demographics entered)
      const engineHandled = engineCoversRole[staff.staffType];
      const defaultRate = RATE_DEFAULTS[staff.staffType] || 0;
      const estimatedValue = engineHandled ? 0 : Math.round((hours / FULL_TIME_HOURS) * defaultRate);

      findings.push({
        type: 'issue',
        message: `${name} (${roleLabel}, ${hours} hrs/week) is not registered with PCRS for a subsidy`,
        value: estimatedValue,
        isUnregistered: true
      });
    });

    // If no issues or opportunities found, show positive message
    if (findings.length === 0 && issues.length === 0 && opportunities.length === 0 && unregisteredStaff.length === 0) {
      findings.push({ type: 'positive', message: 'No issues found in this area', value: 0 });
    }
  }

  if (areaId === 'capitation') {
    const capAnalysis = breakdowns.capitationAnalysis;
    if (capAnalysis?.registrationChecks) {
      capAnalysis.registrationChecks.forEach(check => {
        if (check.gap > 0) {
          findings.push({
            type: 'issue',
            message: `${check.ageGroup}: ${check.gap} patients may not be registered with PCRS`,
            value: check.gapValue || 0
          });
        }
      });
    }
  }

  if (areaId === 'cervicalCheck') {
    const cervical = breakdowns.cervicalScreeningAnalysis;
    if (cervical) {
      if (cervical.smearsZeroPayment > 0) {
        findings.push({
          type: 'issue',
          message: `${cervical.smearsZeroPayment} smears with zero payment`,
          value: cervical.lostIncome || 0
        });
      }
    }
  }

  if (areaId === 'stc') {
    const stcAnalysis = breakdowns.stcAnalysis;
    if (stcAnalysis?.opportunities) {
      stcAnalysis.opportunities.slice(0, 3).forEach(opp => {
        findings.push({
          type: 'opportunity',
          message: opp.message || opp.description || `${opp.code}: growth opportunity`,
          value: opp.value || 0
        });
      });
    }
  }

  if (areaId === 'cdm') {
    const cdmAnalysis = breakdowns.cdmAnalysis;
    if (cdmAnalysis?.growthPotential?.breakdown) {
      cdmAnalysis.growthPotential.breakdown.slice(0, 3).forEach(item => {
        if (item.potentialValue > 0) {
          findings.push({
            type: 'opportunity',
            message: `${item.category}: ${item.gap} additional claims gap (${item.eligiblePatients} eligible patients)`,
            value: item.potentialValue
          });
        }
      });
    }
  }

  return findings;
}

/**
 * NewGMSHealthCheck - Progressive, area-by-area health check
 * Shows results as soon as minimum data requirements are met per area
 */
const NewGMSHealthCheck = () => {
  const { paymentAnalysisData } = useAppContext();
  const { profile, updateProfile } = usePracticeProfile();
  const { readiness, summary } = useAreaReadiness(profile);
  const tasksCtx = useContext(TasksContext);
  const tasks = tasksCtx?.tasks || [];
  const [selectedArea, setSelectedArea] = useState(null);
  const [csvProcessing, setCsvProcessing] = useState(false);
  const [csvResult, setCsvResult] = useState(null);
  const [showCycleDropdown, setShowCycleDropdown] = useState(false);
  const [cycleProcessing, setCycleProcessing] = useState(false);

  const healthCheckData = profile?.healthCheckData || {};
  const isSocrates = profile?.practiceDetails?.ehrSystem === 'socrates';

  // Aggregate GMS payments once (expensive, memoized)
  const aggregatedData = useMemo(() => {
    if (!paymentAnalysisData || paymentAnalysisData.length === 0) return null;
    try {
      return aggregateGMSPayments(paymentAnalysisData, profile);
    } catch (e) {
      console.error('[NewHealthCheck] Error aggregating payments:', e);
      return null;
    }
  }, [paymentAnalysisData, profile]);

  const numGPs = useMemo(() => getUniquePanelCount(paymentAnalysisData), [paymentAnalysisData]);

  // Run full analysis when possible (reuses existing monolithic function)
  const analysisResults = useMemo(() => {
    if (!aggregatedData) return null;
    try {
      return analyzeGMSIncome(paymentAnalysisData, profile, healthCheckData);
    } catch (e) {
      console.error('[NewHealthCheck] Error running analysis:', e);
      return null;
    }
  }, [paymentAnalysisData, profile, healthCheckData, aggregatedData]);

  // Map recommendation IDs to area IDs for per-area financial breakdown
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

  // Generate recommendations and compute financial summary for the donut
  const { allRecommendations, financialSummary, perAreaFinancials } = useMemo(() => {
    const empty = { allRecommendations: [], financialSummary: { unclaimed: 0, growth: 0 }, perAreaFinancials: {} };
    if (!analysisResults) return empty;
    try {
      const recs = generateRecommendations(analysisResults, profile, healthCheckData, paymentAnalysisData);
      const priority = recs.priorityRecommendations || [];
      const growthRecs = recs.growthOpportunities || [];
      const allRecs = [...priority, ...growthRecs];

      // Build per-area financials from recommendation IDs
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
      console.error('[NewHealthCheck] Error generating recommendations:', e);
      return empty;
    }
  }, [analysisResults, profile, healthCheckData, paymentAnalysisData]);

  // Build per-area analysis objects
  const getAreaAnalysis = useCallback((areaId) => {
    if (!analysisResults) return null;

    // For leave, use the calculated actual from PCRS leave balance data (days taken × rate),
    // not the raw payment amount — matches the original Health Check report approach
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

    // For cervical check: use the upper bound (includes growth opportunity from eligible population)
    if (areaId === 'cervicalCheck') {
      const upper = analysisResults.potentialIncome?.cervicalCheckUpper || 0;
      if (upper > potential) potential = upper;
    }

    const findings = extractFindings(areaId, analysisResults, healthCheckData);

    // For practice support: override the engine's aggregate potential with per-staff calculation
    // (the engine uses min(employed, entitled) - pcrs which overcounts; per-staff is more accurate)
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

        // Per-staff underpaid + unrecognised for each category
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

        // Wrong increment values
        (breakdowns.issues || []).filter(i => i.type === 'WRONG_INCREMENT').forEach(issue => {
          perStaffTotal += issue.annualLoss || 0;
        });

        potential = actual + perStaffTotal;
      } else {
        // No demographics — fall back to unregistered findings estimate
        const unregisteredValue = findings
          .filter(f => f.isUnregistered && f.value > 0)
          .reduce((sum, f) => sum + f.value, 0);
        if (unregisteredValue > 0) {
          potential = Math.max(potential, actual + unregisteredValue);
        }
      }
    }

    return {
      actual,
      potential,
      findings,
      breakdown: analysisResults.potentialBreakdowns
    };
  }, [analysisResults, healthCheckData]);

  // Filter recommendations for a specific area, with fallback synthetic recommendations
  const getAreaRecommendations = useCallback((areaId, findings = []) => {
    const categoryName = AREA_CATEGORY_MAP[areaId];
    if (!categoryName) return [];
    const engineRecs = allRecommendations.filter(rec =>
      rec.category === categoryName ||
      rec.area === areaId ||
      (rec.title || rec.description || '').toLowerCase().includes(categoryName.toLowerCase())
    );

    // For practice support: rebuild priority actions with per-staff detail
    // (the engine uses aggregate hours which can overcount; per-staff is more accurate)
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

        // Process each category: receptionists, then nurses/PM
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
          // 1. Underpaid: registered staff with hours gap
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

          // 2. Unrecognised: staff not on PCRS, capped by remaining entitlement
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

        // 3. Wrong increment actions (already per-staff in the engine)
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

      // Fallback: generate synthetic recommendations for unregistered staff
      // when the engine hasn't produced any (e.g. demographics not entered)
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

      // Add Capacity Grant as an action item within growth opportunity recs
      const capacityGrantEligible = psEntitlement?.capacityGrantEligible;
      if (capacityGrantEligible) {
        const grantPerGP = 15000;
        const eligibleGPs = psEntitlement.eligibleGPsForGrant || numGPs;
        const grantTotal = eligibleGPs * grantPerGP;
        engineRecs.forEach(rec => {
          if (rec.type !== 'priority') {
            const actions = rec.actions || [];
            // Guard against duplicate push (this callback mutates the original rec objects)
            const alreadyHasGrant = actions.some(a => a.action?.startsWith('Apply for Capacity Support Grant'));
            if (!alreadyHasGrant) {
              actions.push({
                action: `Apply for Capacity Support Grant: \u20AC${grantPerGP.toLocaleString()} per GP (${eligibleGPs} GP${eligibleGPs !== 1 ? 's' : ''} = \u20AC${grantTotal.toLocaleString()}) for new staff hired or additional hours since July 2023`,
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

  // Sections whose data gets per-section timestamps for staleness detection
  const TRACKED_SECTIONS = [
    'demographics', 'cervicalCheckActivity', 'diseaseRegisters',
    'stcServices', 'stcDemographics', 'staffDetails'
  ];

  // Handle health check data updates from area forms
  // Auto-diffs old vs new data to stamp only the sections that actually changed
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

  // Print report handler
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

  // Socrates CSV upload handler
  const handleCSVUpload = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCsvProcessing(true);
    setCsvResult(null);
    try {
      const csvText = await file.text();
      const result = applySocratesCSV(csvText, healthCheckData);
      setCsvResult(result);
      if (result.success) {
        handleUpdate(result.updatedData);
      }
    } catch (err) {
      setCsvResult({ success: false, warnings: [`Error reading file: ${err.message}`] });
    }
    setCsvProcessing(false);
    event.target.value = '';
  }, [healthCheckData, handleUpdate]);

  // Cycle state: dormant → warming → ready
  const cycleState = summary.analyzableCount >= 6 ? 'ready'
    : summary.analyzableCount >= 4 ? 'warming'
    : 'dormant';

  // Soft reset: mark data as stale + archive completed tasks
  const handleStartNewCycle = useCallback(() => {
    setCycleProcessing(true);
    try {
      // 1. Set all timestamps to 365 days ago to trigger staleness indicators
      const staleDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
      const updatedTimestamps = {};
      if (healthCheckData._timestamps) {
        Object.keys(healthCheckData._timestamps).forEach(key => {
          updatedTimestamps[key] = staleDate;
        });
      }
      const updatedData = {
        ...healthCheckData,
        _timestamps: updatedTimestamps
      };
      handleUpdate(updatedData);

      // 2. Archive completed GMS health check tasks (remove from active list)
      const allItems = getActionItems() || [];
      const remaining = allItems.filter(t => !(t.status === 'completed' && t.recommendationId));
      saveActionItems(remaining);
      window.dispatchEvent(new Event('tasks:refresh'));

      setShowCycleDropdown(false);
      setCsvResult(null);
    } catch (err) {
      console.error('Failed to start new cycle:', err);
    }
    setCycleProcessing(false);
  }, [healthCheckData, handleUpdate]);

  // --- Render ---

  // Detail view for a selected area
  if (selectedArea) {
    const { areaId: selAreaId, source } = selectedArea;
    const areaAnalysis = readiness[selAreaId]?.canAnalyze ? getAreaAnalysis(selAreaId) : null;
    return (
      <div style={{ backgroundColor: COLORS.backgroundGray, minHeight: '100%' }}>
        <AreaDetailView
          areaId={selAreaId}
          source={source}
          readiness={readiness}
          analysis={areaAnalysis}
          recommendations={readiness[selAreaId]?.canAnalyze ? getAreaRecommendations(selAreaId, areaAnalysis?.findings) : []}
          healthCheckData={healthCheckData}
          paymentAnalysisData={paymentAnalysisData}
          onUpdate={handleUpdate}
          onBack={() => setSelectedArea(null)}
          onViewAnalysis={() => setSelectedArea({ areaId: selAreaId, source: 'analysis' })}
        />
      </div>
    );
  }

  // Overview with circular workflow
  return (
    <div style={{
      backgroundColor: COLORS.backgroundGray,
      minHeight: '100%',
      padding: '0.625rem 1.5rem'
    }}>
      <div style={{ maxWidth: '64rem', margin: '0 auto' }}>
        {/* White card for chart area */}
        <div style={{
          backgroundColor: COLORS.white,
          borderRadius: '0.75rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
          borderTop: `3px solid ${COLORS.slainteBlue}`,
          padding: '1.5rem 1rem 1.25rem',
          position: 'relative'
        }}>
          {/* Print Report — top-left corner */}
          <div style={{ position: 'absolute', top: '0.75rem', left: '0.75rem', zIndex: 5 }}>
            <button
              onClick={handlePrintReport}
              disabled={!canPrint}
              title={canPrint ? 'Print full report' : 'Complete at least one section to print'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.3rem 0.7rem',
                borderRadius: '9999px',
                border: '1px solid',
                borderColor: canPrint ? COLORS.slainteBlue : '#d1d5db',
                background: canPrint ? COLORS.slainteBlue : 'transparent',
                color: canPrint ? 'white' : '#9ca3af',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: canPrint ? 'pointer' : 'not-allowed',
                opacity: canPrint ? 1 : 0.5
              }}
            >
              <Printer size={13} />
              Print Report
            </button>
          </div>

          {/* New Cycle button — top-right corner */}
          <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', zIndex: 5 }}>
            <button
              onClick={() => cycleState !== 'dormant' && setShowCycleDropdown(!showCycleDropdown)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.3rem 0.7rem',
                borderRadius: '9999px',
                border: '1px solid',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: cycleState === 'dormant' ? 'default' : 'pointer',
                transition: 'all 0.3s ease',
                ...(cycleState === 'ready' ? {
                  backgroundColor: 'rgba(78, 205, 196, 0.12)',
                  borderColor: 'rgba(78, 205, 196, 0.5)',
                  color: COLORS.incomeColor,
                  boxShadow: '0 0 8px rgba(78, 205, 196, 0.25)'
                } : cycleState === 'warming' ? {
                  backgroundColor: 'rgba(255, 210, 60, 0.12)',
                  borderColor: 'rgba(255, 210, 60, 0.5)',
                  color: '#B8960A',
                  animation: 'none'
                } : {
                  backgroundColor: 'transparent',
                  borderColor: COLORS.lightGray,
                  color: COLORS.mediumGray,
                  opacity: 0.5
                })
              }}
            >
              <RefreshCw size={13} />
              New Cycle
            </button>

            {/* Dropdown popover */}
            {showCycleDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '0.4rem',
                width: '280px',
                backgroundColor: COLORS.white,
                borderRadius: '0.5rem',
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                border: `1px solid ${COLORS.lightGray}`,
                padding: '1rem',
                zIndex: 20
              }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: COLORS.darkGray, marginBottom: '0.5rem' }}>
                  Start a new cycle
                </div>
                <div style={{ fontSize: '0.75rem', color: COLORS.mediumGray, lineHeight: 1.5, marginBottom: '0.75rem' }}>
                  This will mark current data as stale and archive completed tasks, so you can re-verify and refresh your data.
                </div>

                {/* Socrates CSV upload (optional) */}
                {isSocrates && (
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.5rem 0.6rem',
                    borderRadius: '0.375rem',
                    border: `1px dashed ${COLORS.lightGray}`,
                    backgroundColor: COLORS.backgroundGray,
                    cursor: 'pointer',
                    marginBottom: '0.75rem',
                    transition: 'border-color 0.15s ease'
                  }}>
                    <input type="file" accept=".csv" onChange={handleCSVUpload} style={{ display: 'none' }} />
                    <Upload size={14} color={COLORS.slainteBlue} />
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 500, color: COLORS.darkGray }}>
                        {csvProcessing ? 'Processing...' : 'Upload new Socrates CSV'}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: COLORS.mediumGray }}>Optional — refresh demographics</div>
                    </div>
                  </label>
                )}

                {/* CSV result feedback */}
                {csvResult && (
                  <div style={{
                    marginBottom: '0.5rem',
                    fontSize: '0.75rem',
                    color: csvResult.success ? '#16A34A' : '#991B1B'
                  }}>
                    {csvResult.success
                      ? <><CheckCircle size={12} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />CSV loaded</>
                      : (csvResult.warnings?.[0] || 'Failed to parse CSV')
                    }
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => { setShowCycleDropdown(false); setCsvResult(null); }}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '0.25rem',
                      border: `1px solid ${COLORS.lightGray}`,
                      backgroundColor: 'transparent',
                      color: COLORS.mediumGray,
                      fontSize: '0.78rem',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStartNewCycle}
                    disabled={cycleProcessing}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '0.25rem',
                      border: 'none',
                      backgroundColor: COLORS.slainteBlue,
                      color: 'white',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: cycleProcessing ? 'not-allowed' : 'pointer',
                      opacity: cycleProcessing ? 0.6 : 1
                    }}
                  >
                    {cycleProcessing ? 'Resetting...' : 'Start Cycle'}
                  </button>
                </div>
              </div>
            )}
          </div>
          <CircularWorkflow
            readiness={readiness}
            summary={summary}
            onAreaClick={(areaId, source) => setSelectedArea({ areaId, source: source || 'data' })}
            financialSummary={financialSummary}
            perAreaFinancials={perAreaFinancials}
          />

        </div>

      </div>
    </div>
  );
};

export default NewGMSHealthCheck;

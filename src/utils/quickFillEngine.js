/**
 * Quick Fill Engine — Smart data pre-population for the GMS Health Check
 *
 * Centralises all "smart fill" logic that reduces manual data entry by leveraging
 * existing parsed PCRS data, Socrates CSV exports, and inference from known data.
 */

import { parsePracticeDistributionCSV } from './socratesReportParser';
import { aggregateGMSPayments } from './healthCheckCalculations';

/**
 * STC service-to-code mapping (mirrors STC_SERVICE_GROUPS in AreaDataCollector)
 * Used to detect which services a practice offers from their PCRS claim codes.
 */
const SERVICE_CODE_MAP = {
  ecg: ['F'],
  abpm: ['AD'],
  skinExcision: ['A'],
  suturing: ['B'],
  catheterisation: ['L'],
  nebuliser: ['K'],
  phlebotomy: ['AL'],
  contraceptionConsult: ['CF', 'CL'],
  larcImplantFitting: ['CG', 'CO'],
  larcCoilFitting: ['CH', 'CM'],
  larcRemoval: ['CI', 'CJ', 'CN', 'CQ', 'AC'],
  larcFollowUp: ['CK'],
  paediatricForeignBody: ['X'],
  paediatricSuturing: ['Y'],
  paediatricAbscess: ['Z']
};

/**
 * CDM-related STC codes that appear in PCRS statements.
 * Treatment: AO (1 condition), AP (2), AQ (3+)
 * Phone/MCDM: AR (1), AS (2), AT (3+)
 * Prevention: BB (hypertension/pre-disease)
 * OCF: BC (opportunistic case finding)
 * Virtual: AM (heart failure virtual clinics)
 */
const CDM_TREATMENT_CODES = ['AO', 'AP', 'AQ'];
const CDM_PHONE_CODES = ['AR', 'AS', 'AT'];
const CDM_PP_CODES = ['BB'];
const CDM_OCF_CODES = ['BC'];
const CDM_VIRTUAL_CODES = ['AM'];

// ─── 1. Socrates CSV Quick Fill ─────────────────────────────────────────

/**
 * Parse a Socrates Practice Distribution Breakdown CSV and map the results
 * to healthCheckData fields. One upload fills Capitation, Cervical Check,
 * and STC demographics sections simultaneously.
 *
 * @param {string} csvText - Raw CSV file content
 * @param {Object} currentHealthCheckData - Current healthCheckData to merge into
 * @returns {{ updatedData: Object, filledSections: string[], warnings: string[] }}
 */
export function applySocratesCSV(csvText, currentHealthCheckData = {}) {
  const result = parsePracticeDistributionCSV(csvText);

  if (!result.success) {
    return {
      updatedData: currentHealthCheckData,
      filledSections: [],
      warnings: [result.error],
      success: false
    };
  }

  const { data, warnings } = result;
  const filledSections = [];
  const updated = { ...currentHealthCheckData };

  // Capitation demographics
  if (data.demographics) {
    updated.demographics = {
      ...updated.demographics,
      under6: data.demographics.under6 || updated.demographics?.under6 || 0,
      over70: data.demographics.over70 || updated.demographics?.over70 || 0
      // nursingHomeResidents stays manual — not available from CSV
    };
    if (data.demographics.under6 > 0 || data.demographics.over70 > 0) {
      filledSections.push('demographics');
    }
  }

  // Cervical Check demographics
  if (data.cervicalScreening) {
    updated.cervicalCheckActivity = {
      ...updated.cervicalCheckActivity,
      eligibleWomen25to44: data.cervicalScreening.eligibleWomen25to44 || updated.cervicalCheckActivity?.eligibleWomen25to44 || 0,
      eligibleWomen45to65: data.cervicalScreening.eligibleWomen45to65 || updated.cervicalCheckActivity?.eligibleWomen45to65 || 0
    };
    if (data.cervicalScreening.eligibleWomen25to44 > 0 || data.cervicalScreening.eligibleWomen45to65 > 0) {
      filledSections.push('cervicalCheckActivity');
    }
  }

  // STC contraception demographics
  if (data.contraceptionDemographics) {
    updated.stcDemographics = {
      ...updated.stcDemographics,
      gmsFemale17to35: data.contraceptionDemographics.gmsFemale17to35 || updated.stcDemographics?.gmsFemale17to35 || 0,
      gmsFemale36to44: data.contraceptionDemographics.gmsFemale36to44 || updated.stcDemographics?.gmsFemale36to44 || 0
    };
    if (data.contraceptionDemographics.gmsFemale17to35 > 0 || data.contraceptionDemographics.gmsFemale36to44 > 0) {
      filledSections.push('stcDemographics');
    }
  }

  return {
    updatedData: updated,
    filledSections,
    warnings,
    success: true,
    panelSummary: data.panelSummary
  };
}

// ─── 2. Practice Support Staff Defaults ─────────────────────────────────

/**
 * Suggest default values for staff fields based on PCRS data.
 * Increment point implies minimum years of experience (point = ceil(years)).
 * PCRS weeklyHours provides a starting default for actualHoursWorked.
 *
 * @param {Object} staffMember - Staff record with incrementPoint, weeklyHours, staffType
 * @returns {{ yearsExperience: number|null, actualHoursWorked: number|null }}
 */
export function suggestStaffDefaults(staffMember) {
  const result = { yearsExperience: null, actualHoursWorked: null };

  if (!staffMember) return result;

  // Suggest years from increment point (only for non-PM staff from PCRS)
  const incPoint = parseInt(staffMember.incrementPoint) || 0;
  if (incPoint > 0 && staffMember.staffType !== 'practiceManager' && staffMember.fromPCRS) {
    result.yearsExperience = incPoint;
  }

  // Suggest actual hours from PCRS registered hours
  const pcrsHours = parseFloat(staffMember.weeklyHours) || 0;
  if (pcrsHours > 0 && staffMember.fromPCRS) {
    result.actualHoursWorked = pcrsHours;
  }

  return result;
}

// ─── 3. STC Service Auto-Detection ──────────────────────────────────────

/**
 * Detect which STC services a practice provides based on their PCRS claim codes.
 * Aggregates stcDetails.byCode across all uploaded PDFs and checks which service
 * codes have non-zero claim counts.
 *
 * @param {Array} paymentAnalysisData - Array of parsed PCRS monthly data
 * @returns {{ detectedServices: Object, hasData: boolean }}
 *   detectedServices: { [serviceId]: true } for each service with existing claims
 */
export function detectServicesFromClaims(paymentAnalysisData) {
  if (!paymentAnalysisData?.length) {
    return { detectedServices: {}, hasData: false };
  }

  // Aggregate all STC codes across all months
  const aggregatedCodes = {};
  paymentAnalysisData.forEach(entry => {
    const byCode = entry.stcDetails?.byCode;
    if (byCode) {
      Object.entries(byCode).forEach(([code, data]) => {
        if (!aggregatedCodes[code]) {
          aggregatedCodes[code] = 0;
        }
        aggregatedCodes[code] += data.count || 0;
      });
    }
  });

  if (Object.keys(aggregatedCodes).length === 0) {
    return { detectedServices: {}, hasData: false };
  }

  // Map codes back to services
  const detectedServices = {};
  Object.entries(SERVICE_CODE_MAP).forEach(([serviceId, codes]) => {
    const hasActivity = codes.some(code => (aggregatedCodes[code] || 0) > 0);
    if (hasActivity) {
      detectedServices[serviceId] = true;
    }
  });

  return { detectedServices, hasData: true };
}

// ─── 4. CDM Context from PCRS Claims ───────────────────────────────────

/**
 * Estimate CDM programme activity from PCRS STC claim codes.
 * Cannot determine per-condition breakdown — returns aggregate totals only,
 * intended as contextual info for the user, not auto-fill values.
 *
 * @param {Array} paymentAnalysisData - Array of parsed PCRS monthly data
 * @returns {{ totalCDMReviews: number, estimatedEnrolled: number, ppReviews: number, ocfDone: number, hasData: boolean }}
 */
export function estimateCDMContextFromClaims(paymentAnalysisData) {
  const empty = { totalCDMReviews: 0, estimatedEnrolled: 0, ppReviews: 0, ocfDone: 0, hasData: false };

  if (!paymentAnalysisData?.length) return empty;

  // Aggregate CDM codes across all months
  const codeCounts = {};
  paymentAnalysisData.forEach(entry => {
    const byCode = entry.stcDetails?.byCode;
    if (byCode) {
      Object.entries(byCode).forEach(([code, data]) => {
        codeCounts[code] = (codeCounts[code] || 0) + (data.count || 0);
      });
    }
  });

  // Sum CDM treatment reviews (in-surgery + phone + virtual)
  const treatmentReviews = CDM_TREATMENT_CODES.reduce((sum, c) => sum + (codeCounts[c] || 0), 0);
  const phoneReviews = CDM_PHONE_CODES.reduce((sum, c) => sum + (codeCounts[c] || 0), 0);
  const virtualReviews = CDM_VIRTUAL_CODES.reduce((sum, c) => sum + (codeCounts[c] || 0), 0);
  const totalCDMReviews = treatmentReviews + phoneReviews + virtualReviews;

  // Prevention Programme reviews
  const ppReviews = CDM_PP_CODES.reduce((sum, c) => sum + (codeCounts[c] || 0), 0);

  // OCF assessments
  const ocfDone = CDM_OCF_CODES.reduce((sum, c) => sum + (codeCounts[c] || 0), 0);

  // Estimate enrolled patients: each patient gets ~2 reviews per year
  // This is a rough floor estimate
  const estimatedEnrolled = totalCDMReviews > 0 ? Math.ceil(totalCDMReviews / 2) : 0;

  const hasData = totalCDMReviews > 0 || ppReviews > 0 || ocfDone > 0;

  return { totalCDMReviews, estimatedEnrolled, ppReviews, ocfDone, hasData };
}

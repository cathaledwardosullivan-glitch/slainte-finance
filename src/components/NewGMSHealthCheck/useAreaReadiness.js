import { useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { getUniquePanelCount } from '../../utils/healthCheckCalculations';

/**
 * Area IDs and display metadata
 */
export const AREAS = [
  { id: 'leave', label: 'Leave', shortLabel: 'LV', description: 'Study & Annual Leave' },
  { id: 'practiceSupport', label: 'Practice Support', shortLabel: 'PS', description: 'Practice Support Subsidies' },
  { id: 'capitation', label: 'Capitation', shortLabel: 'Cap', description: 'Capitation Payments' },
  { id: 'cervicalCheck', label: 'Cervical Check', shortLabel: 'CC', description: 'Cervical Screening Programme' },
  { id: 'stc', label: 'STC', shortLabel: 'STC', description: 'Special Type Consultations' },
  { id: 'cdm', label: 'CDM', shortLabel: 'CDM', description: 'Chronic Disease Management' }
];

/**
 * Count unique months of PDF data available
 */
function countUniqueMonths(paymentAnalysisData) {
  const months = new Set();
  const data = Array.isArray(paymentAnalysisData) ? paymentAnalysisData : [];
  data.forEach(pdf => {
    if (pdf.month && pdf.year) {
      months.add(`${pdf.year}-${pdf.month}`);
    }
  });
  return months.size;
}

/**
 * Check if any PDF has leave data with entitlements
 */
function hasLeaveData(paymentAnalysisData) {
  return paymentAnalysisData.some(pdf =>
    pdf.leaveData && (
      pdf.leaveData.studyLeaveEntitlement > 0 ||
      pdf.leaveData.annualLeaveEntitlement > 0
    )
  );
}

/**
 * Check if any PDF has practice subsidy staff data
 */
function hasPCRSStaffData(paymentAnalysisData) {
  return paymentAnalysisData.some(pdf =>
    pdf.practiceSubsidy?.staff?.length > 0
  );
}

/**
 * Check if health check staff details have experience filled in
 */
function hasStaffExperience(healthCheckData) {
  const staff = healthCheckData?.staffDetails;
  if (!staff || staff.length === 0) return false;
  return staff.some(s => s.yearsExperience > 0 || s.actualHoursWorked > 0);
}

/**
 * Check if EHR demographics have been entered
 */
function hasEHRDemographics(healthCheckData) {
  const d = healthCheckData?.demographics;
  if (!d) return false;
  return (d.under6 > 0 || d.over70 > 0);
}

/**
 * Check if PCRS demographics are available from PDFs
 */
function hasPCRSDemographics(paymentAnalysisData) {
  return paymentAnalysisData.some(pdf =>
    pdf.demographics && (
      pdf.demographics.totalUnder6 > 0 ||
      pdf.demographics.total70Plus > 0 ||
      pdf.demographics.panelSize > 0
    )
  );
}

/**
 * Check if cervical screening data is available
 */
function hasCervicalData(paymentAnalysisData) {
  return paymentAnalysisData.some(pdf =>
    pdf.cervicalScreening && pdf.cervicalScreening.totalSmears > 0
  );
}

/**
 * Check if cervical check demographics (eligible women) have been entered
 */
function hasCervicalDemographics(healthCheckData) {
  const c = healthCheckData?.cervicalCheckActivity;
  if (!c) return false;
  return (c.eligibleWomen25to44 > 0 || c.eligibleWomen45to65 > 0);
}

/**
 * Check if STC detail data is available
 */
function hasSTCData(paymentAnalysisData) {
  return paymentAnalysisData.some(pdf =>
    pdf.stcDetails && pdf.stcDetails.totalClaims > 0
  );
}

/**
 * Check if disease registers have been entered
 */
function hasDiseaseRegisters(healthCheckData) {
  const d = healthCheckData?.diseaseRegisters;
  if (!d) return false;
  return Object.values(d).some(v => v > 0);
}

/**
 * Map area IDs to the healthCheckData section keys they depend on.
 * Used for per-section staleness detection.
 */
const AREA_SECTION_MAP = {
  capitation: ['demographics'],
  cervicalCheck: ['cervicalCheckActivity'],
  cdm: ['diseaseRegisters'],
  stc: ['stcServices', 'stcDemographics'],
  practiceSupport: ['staffDetails'],
  // leave has no user-entered data
};

/** Default staleness threshold in days (6 months) */
export const STALE_THRESHOLD_DAYS = 180;

/**
 * Compute data age info for an area based on per-section timestamps.
 * Returns { lastUpdated, oldestSection, daysOld, isStale }
 */
function getAreaDataAge(areaId, timestamps) {
  const sections = AREA_SECTION_MAP[areaId];
  if (!sections) return { lastUpdated: null, oldestSection: null, daysOld: null, isStale: false };

  const now = Date.now();
  let newest = null;
  let oldest = null;

  for (const section of sections) {
    const ts = timestamps?.[section];
    if (!ts) continue;
    const date = new Date(ts);
    if (!newest || date > newest) newest = date;
    if (!oldest || date < oldest) oldest = date;
  }

  if (!oldest) return { lastUpdated: null, oldestSection: null, daysOld: null, isStale: false };

  const daysOld = Math.floor((now - oldest.getTime()) / (1000 * 60 * 60 * 24));

  return {
    lastUpdated: newest,
    oldestSection: oldest,
    daysOld,
    isStale: daysOld > STALE_THRESHOLD_DAYS
  };
}

/**
 * useAreaReadiness - Hook that computes data readiness per GMS area
 *
 * Returns an object keyed by area ID with:
 * - status: 'ready' | 'partial' | 'no-data'
 * - canAnalyze: boolean
 * - missingData: string[] (what's needed for full analysis)
 * - dataAvailable: object (area-specific flags)
 */
export function useAreaReadiness(profile) {
  const { paymentAnalysisData } = useAppContext();

  const readiness = useMemo(() => {
    const healthCheckData = profile?.healthCheckData || {};
    const timestamps = healthCheckData._timestamps || {};
    const hasPDFs = paymentAnalysisData.length > 0;
    const uniqueMonths = countUniqueMonths(paymentAnalysisData);
    const numGPs = getUniquePanelCount(paymentAnalysisData);

    // --- Leave ---
    const leaveHasData = hasLeaveData(paymentAnalysisData);
    const leave = {
      status: leaveHasData ? 'ready' : hasPDFs ? 'partial' : 'no-data',
      canAnalyze: leaveHasData,
      missingData: !hasPDFs
        ? ['Upload at least one GMS PDF']
        : !leaveHasData
          ? ['Leave data not found in uploaded PDFs']
          : [],
      dataAvailable: { hasPDFs, hasLeaveBalance: leaveHasData },
      dataAge: { lastUpdated: null, oldestSection: null, daysOld: null, isStale: false }
    };

    // --- Practice Support ---
    const psHasPCRS = hasPCRSStaffData(paymentAnalysisData);
    const psHasExperience = hasStaffExperience(healthCheckData);
    const practiceSupport = {
      status: psHasPCRS && psHasExperience ? 'ready'
        : (psHasPCRS || psHasExperience) ? 'partial'
          : 'no-data',
      canAnalyze: psHasPCRS, // can run partial analysis with just PCRS data
      missingData: [
        ...(!psHasPCRS ? ['Upload GMS PDFs with staff subsidy data'] : []),
        ...(!psHasExperience ? ['Enter staff years of experience and hours worked'] : [])
      ],
      dataAvailable: { hasStaffFromPCRS: psHasPCRS, hasStaffExperience: psHasExperience },
      dataAge: getAreaDataAge('practiceSupport', timestamps)
    };

    // --- Capitation ---
    const capHasEHR = hasEHRDemographics(healthCheckData);
    const capHasPCRS = hasPCRSDemographics(paymentAnalysisData);
    const capitation = {
      status: capHasEHR && capHasPCRS ? 'ready'
        : (capHasEHR || capHasPCRS) ? 'partial'
          : 'no-data',
      canAnalyze: capHasEHR && capHasPCRS,
      missingData: [
        ...(!capHasPCRS ? ['Upload GMS PDFs with demographics data'] : []),
        ...(!capHasEHR ? ['Enter patient demographics from your EHR'] : [])
      ],
      dataAvailable: { hasEHRDemographics: capHasEHR, hasPCRSDemographics: capHasPCRS },
      dataAge: getAreaDataAge('capitation', timestamps)
    };

    // --- Cervical Check ---
    const ccHasData = hasCervicalData(paymentAnalysisData);
    const ccHasDemographics = hasCervicalDemographics(healthCheckData);
    const ccHas12Months = uniqueMonths >= 12;
    const cervicalCheck = {
      status: ccHasData && ccHasDemographics && ccHas12Months ? 'ready'
        : (ccHasData || ccHasDemographics) ? 'partial'
          : 'no-data',
      // Allow analysis with either PCRS data OR demographics (or both)
      canAnalyze: ccHasData || ccHasDemographics,
      missingData: [
        ...(!ccHasData ? ['Upload GMS PDFs with cervical screening data for payment analysis'] : []),
        ...(!ccHasDemographics ? ['Enter eligible women counts for growth opportunity analysis'] : []),
        ...(!ccHas12Months ? [`Upload more GMS PDFs (${uniqueMonths}/12 months available)`] : [])
      ],
      dataAvailable: {
        hasCervicalData: ccHasData,
        hasCervicalDemographics: ccHasDemographics,
        monthsAvailable: uniqueMonths,
        has12Months: ccHas12Months
      },
      dataAge: getAreaDataAge('cervicalCheck', timestamps)
    };

    // --- STC ---
    const stcHasData = hasSTCData(paymentAnalysisData);
    const stc = {
      status: stcHasData && ccHas12Months ? 'ready'
        : stcHasData ? 'partial'
          : 'no-data',
      canAnalyze: stcHasData,
      missingData: [
        ...(!stcHasData ? ['Upload GMS PDFs with STC claim data'] : []),
        ...(!ccHas12Months ? [`Upload more GMS PDFs for benchmarking (${uniqueMonths}/12 months)`] : [])
      ],
      dataAvailable: {
        hasSTCData: stcHasData,
        monthsAvailable: uniqueMonths,
        has12Months: ccHas12Months
      },
      dataAge: getAreaDataAge('stc', timestamps)
    };

    // --- CDM ---
    const cdmHasRegisters = hasDiseaseRegisters(healthCheckData);
    const cdmHasSTC = stcHasData;
    const cdm = {
      status: cdmHasRegisters && cdmHasSTC ? 'ready'
        : cdmHasSTC ? 'partial'
          : 'no-data',
      canAnalyze: cdmHasSTC, // can run partial analysis from STC details alone
      missingData: [
        ...(!cdmHasSTC ? ['Upload GMS PDFs with STC/CDM claim data'] : []),
        ...(!cdmHasRegisters ? ['Enter disease register counts from your EHR'] : [])
      ],
      dataAvailable: { hasDiseaseRegisters: cdmHasRegisters, hasSTCData: cdmHasSTC },
      dataAge: getAreaDataAge('cdm', timestamps)
    };

    return { leave, practiceSupport, capitation, cervicalCheck, stc, cdm };
  }, [paymentAnalysisData, profile]);

  // Summary stats
  const summary = useMemo(() => {
    const areas = Object.values(readiness);
    const readyCount = areas.filter(a => a.status === 'ready').length;
    const partialCount = areas.filter(a => a.status === 'partial').length;
    const analyzableCount = areas.filter(a => a.canAnalyze).length;
    return { readyCount, partialCount, analyzableCount, totalAreas: 6 };
  }, [readiness]);

  return { readiness, summary };
}

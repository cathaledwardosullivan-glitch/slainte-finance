import React, { useState, useMemo } from 'react';
import { ArrowLeft, ArrowRight, Database, BarChart3, ListTodo, CheckCircle2, Circle, AlertCircle, Upload, FileText, ChevronDown, Clock } from 'lucide-react';
import COLORS from '../../utils/colors';
import { AREAS } from './useAreaReadiness';
import AreaDataCollector from './AreaDataCollector';
import AreaAnalysisPanel from './AreaAnalysisPanel';
import AreaTaskPanel from './AreaTaskPanel';

const STATUS_COLORS = {
  ready: COLORS.incomeColor,     // #4ECDC4 turquoise
  partial: COLORS.highlightYellow, // #FFD23C yellow
  'no-data': COLORS.lightGray     // #E0E0E0 grey
};

const STATUS_LABELS = {
  ready: 'Ready',
  partial: 'Partial Data',
  'no-data': 'No Data'
};

/**
 * Rich category explanations for the Data Collection view.
 * Describes what the income category is, how it's paid, and key rates.
 */
const CATEGORY_EXPLANATIONS = {
  leave: {
    title: 'Study & Annual Leave',
    what: 'GMS GPs are entitled to paid study leave (10 days) and annual leave (up to 20 days) per panel per year, at \u20AC197.24 per day. Unclaimed leave is forfeited on 1st April each year \u2014 it does not carry over. This is one of the most common areas of unclaimed GMS income.',
    brief: true,
    details: [
      { label: 'Study Leave', text: '10 days per year per panel (for panels over 100 patients). This covers CME and professional development.' },
      { label: 'Annual Leave', text: 'Up to 20 days per year per panel. The exact entitlement depends on your panel size and is specified on your PCRS statement.' }
    ],
    rates: 'Full study leave is worth \u20AC1,972 per panel per year, and full annual leave up to \u20AC3,945.',
    howPaid: 'Leave payments appear on your monthly PCRS statement. Claims are submitted using the ALF/1 form via the PCRS online system.',
    leaveYear: 'The GMS leave year runs from 1st April to 31st March. Unclaimed leave is forfeited when the leave year resets on 1st April \u2014 it does not carry over.',
    tip: 'Many GPs do not claim their full leave entitlement, particularly study leave. Check your PCRS statement regularly to track your balance before the 31st March deadline.'
  },
  practiceSupport: {
    title: 'Practice Support Subsidies',
    what: 'The HSE subsidises the cost of employing practice nurses, secretaries, and practice managers. The subsidy amount is based on your GMS panel size and staff hours.',
    brief: true,
    details: [
      { label: 'Secretary/Administrator', text: 'Up to 35 hours/week subsidised. Rates range from \u20AC22,694 (Point 1) to \u20AC26,477 (Point 3) per year.' },
      { label: 'Practice Nurse', text: 'Up to 35 hours/week subsidised. Rates range from \u20AC34,041 (Point 1) to \u20AC41,606 (Point 4) per year.' },
      { label: 'Practice Manager', text: 'Available to partnerships not maximising nurse subsidy. Rate is \u20AC34,041 per year.' },
      { label: 'Capacity Grant', text: '\u20AC15,000 per GP (weighted panel 500+) for staff hired or additional hours created after July 2023.' }
    ],
    rates: 'Subsidies are pro-rated based on your weighted GMS panel size (over-70s count double). The maximum weighted panel per GP is 1,200 patients.',
    howPaid: 'Paid monthly via PCRS, based on the increment point and hours registered for each staff member.',
    tip: 'Common issues include staff being on the wrong increment point for their experience, or not all eligible hours being claimed. Both can be identified by comparing PCRS data against actual staff details.'
  },
  capitation: {
    title: 'Capitation Payments',
    what: 'Capitation is the core GMS payment \u2014 a quarterly fee per registered patient. Under 6s, Over 70s, and Nursing Home residents have significantly higher rates and are automatically entitled to GMS/DVC cards. Comparing your EHR counts for these groups against PCRS registrations is an efficient way to find patients who attend your practice but aren\u2019t yet on your panel.',
    brief: true,
    details: [
      { label: 'Under 6', text: 'Approximately \u20AC125 per year (\u20AC30.88/quarter). Includes all consultations and basic procedures.' },
      { label: 'Over 70', text: 'Approximately \u20AC272 per year (\u20AC70.88/quarter). Significantly higher due to care complexity.' },
      { label: 'Nursing Home', text: '\u20AC927 per year (Form 903 patients). Highest rate, reflecting intensive care needs.' }
    ],
    rates: 'Total capitation income depends on both your panel composition and whether all eligible patients are properly registered with PCRS.',
    howPaid: 'Paid quarterly by PCRS based on the patients registered on your panel at the start of each quarter.',
    tip: 'The most common issue is patients who attend your practice but are not registered on your GMS panel with PCRS. Comparing your EHR patient demographics against PCRS registration data can reveal these gaps.'
  },
  cervicalCheck: {
    title: 'CervicalCheck Programme',
    what: 'GPs are paid \u20AC65.00 per eligible smear test under CervicalCheck, Ireland\'s national cervical screening programme. Women aged 25\u201344 are screened every 3 years, and 45\u201365 every 5 years.',
    brief: true,
    details: [
      { label: 'Payment per smear', text: '\u20AC65.00 per eligible smear (increased from \u20AC49.10 with the move to HPV primary screening in March 2020).' },
      { label: 'Eligibility', text: 'Open to ALL women aged 25\u201365 (GMS, DVC and private patients). The GP must hold a National Cancer Screening Contract.' },
      { label: 'Screening intervals', text: 'Every 3 years for women aged 25\u201344. Every 5 years for women aged 45\u201365.' }
    ],
    rates: null,
    howPaid: 'Payments appear on your PCRS statement. The smear must be performed on a registered CervicalCheck patient and the sample sent to a designated lab.',
    tip: 'Zero-payment smears (where the test was done but no payment was received) are a common issue. This can happen if the patient wasn\'t registered with CervicalCheck or the screening interval had not elapsed. Comparing your smear count against payments received can identify lost income.'
  },
  stc: {
    title: 'Special Type Consultations',
    what: 'STCs are fee-per-item payments for specific clinical procedures and services performed for GMS patients. They cover minor surgery, diagnostics, contraception/LARC, and paediatric procedures. Many practices under-claim STCs \u2014 benchmarking your claims against expected volumes can reveal significant growth opportunities.',
    brief: true,
    details: [
      { label: 'Clinical Procedures', text: 'Skin excisions (\u20AC24.80), suturing (\u20AC50.00), catheterisation (\u20AC60.00), therapeutic phlebotomy (\u20AC100.00).' },
      { label: 'Diagnostics', text: 'ECG (\u20AC24.80), 24hr ABPM (\u20AC60.00). Must be for individual patient care, not routine screening.' },
      { label: 'Contraception/LARC', text: 'LARC fitting (\u20AC100\u2013\u20AC160), consultations (\u20AC55), removals (\u20AC50\u2013\u20AC110). Covers both Free Contraception (17\u201335) and GMS/DVC (36\u201344) schemes.' },
      { label: 'Paediatric (<8)', text: 'Foreign body removal (\u20AC24.80), suturing (\u20AC37.21), abscess drainage (\u20AC24.80).' }
    ],
    rates: 'STC fees range from \u20AC24.80 to \u20AC160.00 depending on the procedure. Each claim is made individually via PCRS.',
    howPaid: 'Claimed per-item via PCRS online system. Payments appear on your monthly PCRS statement under STC Details.',
    tip: 'Many practices under-claim STCs, particularly ECGs, ABPM, and LARC procedures. Benchmarking your claims against expected volumes for your panel size can reveal growth opportunities.'
  },
  cdm: {
    title: 'Chronic Disease Management',
    what: 'The CDM programme pays GPs for structured reviews of patients with chronic conditions like diabetes, asthma, COPD, and heart disease. It covers three strands \u2014 Treatment, Prevention, and Opportunistic Case Finding \u2014 with fees from \u20AC60 to \u20AC300 per patient per year.',
    brief: true,
    details: [
      { label: 'CDM Treatment Programme', text: '7 eligible conditions: Type 2 Diabetes, Asthma, COPD, Heart Failure, IHD, Stroke/TIA, Atrial Fibrillation. Two reviews per year (annual + interim, min 4 months apart). Fees: \u20AC210/yr (1 condition), \u20AC250/yr (2 conditions), \u20AC300/yr (3+ conditions).' },
      { label: 'Prevention Programme', text: 'For high-risk patients (QRISK3 \u226520%, Stage 2 HTN, pre-diabetes, elevated BNP). One annual review at \u20AC82 + 10% superannuation.' },
      { label: 'Opportunistic Case Finding', text: 'For GMS/DVC patients aged 65+ not already on CDM. Assessment fee \u20AC60 per patient.' }
    ],
    rates: 'A practice with 100 CDM patients averaging 1.5 conditions each could earn over \u20AC23,000 per year from CDM reviews alone.',
    howPaid: 'CDM claims are submitted via PCRS using codes AO\u2013AT (in-surgery and modified reviews). Payments appear on your PCRS statement.',
    tip: 'The gap between disease register numbers and CDM claims often indicates patients who are diagnosed but not yet enrolled in the CDM programme. Enrolling these patients can be a significant source of growth.'
  }
};

/**
 * Format a number of days into a human-readable relative time string
 */
function formatDaysAgo(days) {
  if (days == null) return 'an unknown time ago';
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (remainingMonths === 0) return `${years} year${years !== 1 ? 's' : ''} ago`;
  return `${years} year${years !== 1 ? 's' : ''} and ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''} ago`;
}

/**
 * Month name ordering for finding the latest PDF
 */
const MONTH_ORDER = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Extract leave-specific details from paymentAnalysisData:
 * latest PDF month/year and per-panel leave balances
 */
function getLeaveDetails(paymentAnalysisData) {
  if (!paymentAnalysisData || paymentAnalysisData.length === 0) return null;

  // Find the latest PDF by year then month
  const withLeave = paymentAnalysisData.filter(pdf =>
    pdf.leaveData && (pdf.leaveData.studyLeaveEntitlement > 0 || pdf.leaveData.annualLeaveEntitlement > 0)
  );
  if (withLeave.length === 0) return null;

  // Sort to find latest
  withLeave.sort((a, b) => {
    const yearDiff = (parseInt(b.year) || 0) - (parseInt(a.year) || 0);
    if (yearDiff !== 0) return yearDiff;
    return MONTH_ORDER.indexOf(b.month) - MONTH_ORDER.indexOf(a.month);
  });

  const latest = withLeave[0];
  const latestMonth = latest.month;
  const latestYear = latest.year;

  // Aggregate leave balances across all panels for the latest month
  const latestMonthPDFs = withLeave.filter(pdf => pdf.month === latestMonth && String(pdf.year) === String(latestYear));

  let totalStudyEntitlement = 0, totalStudyTaken = 0, totalStudyBalance = 0;
  let totalAnnualEntitlement = 0, totalAnnualTaken = 0, totalAnnualBalance = 0;

  latestMonthPDFs.forEach(pdf => {
    const ld = pdf.leaveData;
    totalStudyEntitlement += ld.studyLeaveEntitlement || 0;
    totalStudyTaken += ld.studyLeaveTaken || 0;
    totalStudyBalance += ld.studyLeaveBalance || 0;
    totalAnnualEntitlement += ld.annualLeaveEntitlement || 0;
    totalAnnualTaken += ld.annualLeaveTaken || 0;
    totalAnnualBalance += ld.annualLeaveBalance || 0;
  });

  return {
    latestMonth,
    latestYear,
    panelCount: latestMonthPDFs.length,
    study: { entitlement: totalStudyEntitlement, taken: totalStudyTaken, balance: totalStudyBalance },
    annual: { entitlement: totalAnnualEntitlement, taken: totalAnnualTaken, balance: totalAnnualBalance }
  };
}

/**
 * Build a data requirements checklist from readiness data
 */
function buildDataChecklist(areaId, readiness, leaveDetails) {
  if (!readiness) return [];

  const da = readiness.dataAvailable || {};
  const items = [];

  if (areaId === 'leave') {
    items.push({
      label: 'GMS PDFs uploaded',
      done: da.hasPDFs,
      detail: da.hasPDFs ? 'PDF data available' : 'Upload at least one GMS PDF from the GMS Dashboard'
    });

    // Enhanced leave balance item with specific amounts
    if (da.hasLeaveBalance && leaveDetails) {
      const dailyRate = 197.24;
      const studyBalanceValue = leaveDetails.study.balance * dailyRate;
      const annualBalanceValue = leaveDetails.annual.balance * dailyRate;
      const panelNote = leaveDetails.panelCount > 1 ? ` (across ${leaveDetails.panelCount} panels)` : '';

      // Build a detailed summary
      const lines = [];
      lines.push(`As of ${leaveDetails.latestMonth} ${leaveDetails.latestYear}${panelNote}:`);

      if (leaveDetails.study.entitlement > 0) {
        lines.push(`Study Leave: ${leaveDetails.study.taken} of ${leaveDetails.study.entitlement} days claimed`
          + (leaveDetails.study.balance > 0 ? ` \u2014 ${leaveDetails.study.balance} days unclaimed (\u20AC${Math.round(studyBalanceValue).toLocaleString()})` : ' \u2014 fully claimed'));
      }
      if (leaveDetails.annual.entitlement > 0) {
        lines.push(`Annual Leave: ${leaveDetails.annual.taken} of ${leaveDetails.annual.entitlement} days claimed`
          + (leaveDetails.annual.balance > 0 ? ` \u2014 ${leaveDetails.annual.balance} days unclaimed (\u20AC${Math.round(annualBalanceValue).toLocaleString()})` : ' \u2014 fully claimed'));
      }

      const hasUnclaimed = leaveDetails.study.balance > 0 || leaveDetails.annual.balance > 0;

      items.push({
        label: 'Leave balance data found',
        done: true,
        detail: lines.join('\n'),
        multiLine: true,
        hasUnclaimed
      });
    } else {
      items.push({
        label: 'Leave balance data found',
        done: da.hasLeaveBalance,
        detail: da.hasLeaveBalance
          ? 'Study and/or annual leave entitlements detected'
          : 'Leave data not found in uploaded PDFs \u2014 ensure your PDFs include the leave balance section'
      });
    }
  }

  if (areaId === 'practiceSupport') {
    items.push({
      label: 'Staff data from PCRS',
      done: da.hasStaffFromPCRS,
      detail: da.hasStaffFromPCRS
        ? 'Staff names, roles, and increment points detected from PCRS subsidy data'
        : 'Upload GMS PDFs that contain practice subsidy staff listings'
    });
    items.push({
      label: 'Staff experience & hours',
      done: da.hasStaffExperience,
      detail: da.hasStaffExperience
        ? 'Years of experience and actual hours recorded'
        : 'Enter each staff member\'s years of experience and actual weekly hours to check for increment errors and unclaimed hours'
    });
  }

  if (areaId === 'capitation') {
    items.push({
      label: 'PCRS demographics',
      done: da.hasPCRSDemographics,
      detail: da.hasPCRSDemographics
        ? 'PCRS patient demographics available from uploaded PDFs'
        : 'Upload GMS PDFs that include patient demographics breakdown'
    });
    items.push({
      label: 'EHR patient demographics',
      done: da.hasEHRDemographics,
      detail: da.hasEHRDemographics
        ? 'Patient age band counts entered from your EHR system'
        : 'Enter your practice\'s patient numbers by age band from your clinical system (Socrates, Health One, etc.)'
    });
  }

  if (areaId === 'cervicalCheck') {
    items.push({
      label: 'Cervical screening data',
      done: da.hasCervicalData,
      detail: da.hasCervicalData
        ? 'Smear test counts and payment data detected from PCRS statements'
        : 'Upload GMS PDFs that include cervical screening payment data'
    });
    items.push({
      label: 'Eligible women counts',
      done: da.hasCervicalDemographics,
      detail: da.hasCervicalDemographics
        ? 'Eligible women counts (25\u201344 and 45\u201365) recorded'
        : 'Enter the number of eligible women from your EHR by age group'
    });
    items.push({
      label: '12 months of data',
      done: da.has12Months,
      detail: da.has12Months
        ? `${da.monthsAvailable} months of PDF data available`
        : `${da.monthsAvailable || 0}/12 months uploaded \u2014 more PDFs needed for full annual analysis`
    });
  }

  if (areaId === 'stc') {
    items.push({
      label: 'STC claim data',
      done: da.hasSTCData,
      detail: da.hasSTCData
        ? 'STC claim details detected from PCRS statements'
        : 'Upload GMS PDFs that include Special Type Consultation claim data'
    });
    items.push({
      label: '12 months of data',
      done: da.has12Months,
      detail: da.has12Months
        ? `${da.monthsAvailable} months of data for benchmarking`
        : `${da.monthsAvailable || 0}/12 months uploaded \u2014 more PDFs needed for accurate benchmarking`
    });
  }

  if (areaId === 'cdm') {
    items.push({
      label: 'STC/CDM claim data',
      done: da.hasSTCData,
      detail: da.hasSTCData
        ? 'CDM review claims detected from PCRS statements'
        : 'Upload GMS PDFs that include STC/CDM claim data'
    });
    items.push({
      label: 'Disease register counts',
      done: da.hasDiseaseRegisters,
      detail: da.hasDiseaseRegisters
        ? 'Disease register counts entered from your EHR'
        : 'Enter your disease register numbers (Type 2 Diabetes, Asthma, COPD, etc.) from your EHR system'
    });
  }

  return items;
}

/**
 * AreaDetailView - Full-page detail for a single GMS area
 *
 * source === 'data':     Rich explanation + data requirements checklist + data collection form
 * source === 'analysis': Analysis charts/findings + recommended tasks
 */
const AreaDetailView = ({
  areaId,
  source,
  readiness,
  analysis,
  recommendations,
  healthCheckData,
  paymentAnalysisData,
  onUpdate,
  onBack,
  onViewAnalysis
}) => {
  const area = AREAS.find(a => a.id === areaId);
  if (!area) return null;

  const areaReadiness = readiness[areaId];
  const status = areaReadiness?.status || 'no-data';
  const isDataView = source === 'data';
  const explanation = CATEGORY_EXPLANATIONS[areaId];

  // Compute leave-specific details (used for checklist on data view and freshness warning on both views)
  const leaveDetails = useMemo(() => {
    if (areaId !== 'leave') return null;
    return getLeaveDetails(paymentAnalysisData);
  }, [areaId, paymentAnalysisData]);

  // Compute data freshness for Leave (months since latest PDF)
  const leaveFreshness = useMemo(() => {
    if (areaId !== 'leave' || !leaveDetails) return null;
    const monthIdx = MONTH_ORDER.indexOf(leaveDetails.latestMonth);
    if (monthIdx === -1) return null;
    const pdfYear = parseInt(leaveDetails.latestYear);
    if (!pdfYear) return null;
    const now = new Date();
    const monthsSince = (now.getFullYear() - pdfYear) * 12 + now.getMonth() - monthIdx;
    return { monthsSince, latestMonth: leaveDetails.latestMonth, latestYear: leaveDetails.latestYear };
  }, [areaId, leaveDetails]);

  const [showMoreDetails, setShowMoreDetails] = useState(false);

  const checklist = isDataView ? buildDataChecklist(areaId, areaReadiness, leaveDetails) : [];

  return (
    <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '1.5rem' }}>
      {/* Header with back button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.5rem'
      }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            backgroundColor: 'transparent',
            border: `1px solid ${COLORS.lightGray}`,
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontSize: '0.875rem',
            color: COLORS.darkGray,
            transition: 'background-color 0.15s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.backgroundGray}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <ArrowLeft size={16} />
          Back to Overview
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Source badge */}
          <span style={{
            padding: '0.25rem 0.75rem',
            borderRadius: '9999px',
            backgroundColor: isDataView ? `${COLORS.slainteBlue}15` : `${COLORS.incomeColor}15`,
            border: `1px solid ${isDataView ? COLORS.slainteBlue : COLORS.incomeColor}40`,
            fontSize: '0.75rem',
            fontWeight: 500,
            color: isDataView ? COLORS.slainteBlue : COLORS.incomeColor
          }}>
            {isDataView ? 'Data Collection' : 'Analysis'}
          </span>

          {/* Status badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.25rem 0.75rem',
            borderRadius: '9999px',
            backgroundColor: `${STATUS_COLORS[status]}15`,
            border: `1px solid ${STATUS_COLORS[status]}40`
          }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              backgroundColor: STATUS_COLORS[status]
            }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 500, color: STATUS_COLORS[status] }}>
              {STATUS_LABELS[status]}
            </span>
          </div>
        </div>
      </div>

      {/* Area title */}
      <h2 style={{
        margin: '0 0 0.5rem',
        fontSize: '1.5rem',
        fontWeight: 700,
        color: COLORS.darkGray
      }}>
        {explanation?.title || area.description}
      </h2>

      {/* Leave data freshness warning */}
      {leaveFreshness && leaveFreshness.monthsSince > 1 && (
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          borderRadius: '0.5rem',
          backgroundColor: leaveFreshness.monthsSince >= 3 ? '#FEF2F2' : '#FFFBEB',
          border: `1px solid ${leaveFreshness.monthsSince >= 3 ? '#FECACA' : '#FDE68A'}`
        }}>
          <AlertCircle style={{
            width: '1.25rem',
            height: '1.25rem',
            flexShrink: 0,
            marginTop: '0.1rem',
            color: leaveFreshness.monthsSince >= 3 ? '#DC2626' : '#D97706'
          }} />
          <div>
            <p style={{
              margin: 0,
              fontSize: '0.875rem',
              fontWeight: 600,
              color: leaveFreshness.monthsSince >= 3 ? '#991B1B' : '#92400E'
            }}>
              {leaveFreshness.monthsSince >= 3
                ? `Leave data is ${leaveFreshness.monthsSince} months old \u2014 likely inaccurate`
                : 'Leave data may be out of date'
              }
            </p>
            <p style={{
              margin: '0.25rem 0 0',
              fontSize: '0.8rem',
              color: leaveFreshness.monthsSince >= 3 ? '#B91C1C' : '#78350F'
            }}>
              Latest PDF is from {leaveFreshness.latestMonth} {leaveFreshness.latestYear}.
              {leaveFreshness.monthsSince >= 3
                ? ' Unclaimed balances reduce each month. Upload a recent PCRS statement for an accurate picture.'
                : ' Consider uploading the latest month\u2019s PDF for the most current leave balances.'
              }
            </p>
          </div>
        </div>
      )}

      {/* ─────────── DATA COLLECTION VIEW ─────────── */}
      {isDataView && explanation && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* What is this category? */}
          <section style={{
            padding: '1.25rem',
            backgroundColor: COLORS.white,
            borderRadius: '0.5rem',
            border: `1px solid ${COLORS.lightGray}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <FileText size={18} color={COLORS.slainteBlue} />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: COLORS.darkGray }}>
                What is this?
              </h3>
            </div>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: COLORS.darkGray, lineHeight: 1.6 }}>
              {explanation.what}
            </p>

            {/* Brief mode: collapsible details */}
            {explanation.brief ? (
              <>
                <button
                  onClick={() => setShowMoreDetails(!showMoreDetails)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.5rem 0.75rem',
                    backgroundColor: COLORS.backgroundGray,
                    border: `1px solid ${COLORS.lightGray}`,
                    borderRadius: '0.375rem',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    color: COLORS.slainteBlue,
                    cursor: 'pointer',
                    marginBottom: showMoreDetails ? '0.75rem' : 0
                  }}
                >
                  <ChevronDown size={14} style={{
                    transition: 'transform 0.2s',
                    transform: showMoreDetails ? 'rotate(180deg)' : 'none'
                  }} />
                  {showMoreDetails ? 'Hide details' : 'See rates & details'}
                </button>
                {showMoreDetails && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {explanation.details.map((item, i) => (
                        <div key={i} style={{
                          padding: '0.6rem 0.75rem',
                          backgroundColor: COLORS.backgroundGray,
                          borderRadius: '0.375rem',
                          borderLeft: `3px solid ${COLORS.slainteBlue}`
                        }}>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem', color: COLORS.darkGray }}>
                            {item.label}:
                          </span>{' '}
                          <span style={{ fontSize: '0.85rem', color: COLORS.darkGray, lineHeight: 1.5 }}>
                            {item.text}
                          </span>
                        </div>
                      ))}
                    </div>
                    {explanation.rates && (
                      <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: COLORS.darkGray, lineHeight: 1.5 }}>
                        <strong>Rates:</strong> {explanation.rates}
                      </p>
                    )}
                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: COLORS.darkGray, lineHeight: 1.5 }}>
                      <strong>How it's paid:</strong> {explanation.howPaid}
                    </p>
                    {explanation.tip && (
                      <div style={{
                        padding: '0.75rem',
                        backgroundColor: '#FFF7ED',
                        borderRadius: '0.375rem',
                        border: '1px solid #FDBA74',
                        fontSize: '0.85rem',
                        color: '#9A3412',
                        lineHeight: 1.5
                      }}>
                        <strong>Tip:</strong> {explanation.tip}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Full mode: all details visible */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  {explanation.details.map((item, i) => (
                    <div key={i} style={{
                      padding: '0.6rem 0.75rem',
                      backgroundColor: COLORS.backgroundGray,
                      borderRadius: '0.375rem',
                      borderLeft: `3px solid ${COLORS.slainteBlue}`
                    }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', color: COLORS.darkGray }}>
                        {item.label}:
                      </span>{' '}
                      <span style={{ fontSize: '0.85rem', color: COLORS.darkGray, lineHeight: 1.5 }}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Rates & payment info */}
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: COLORS.darkGray, lineHeight: 1.5 }}>
                  <strong>Rates:</strong> {explanation.rates}
                </p>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: COLORS.darkGray, lineHeight: 1.5 }}>
                  <strong>How it's paid:</strong> {explanation.howPaid}
                </p>
              </>
            )}

            {/* Leave year reset info (leave-specific) */}
            {explanation.leaveYear && (
              <div style={{
                marginTop: '0.25rem',
                padding: '0.75rem',
                backgroundColor: '#EFF6FF',
                borderRadius: '0.375rem',
                border: '1px solid #BFDBFE',
                fontSize: '0.85rem',
                color: '#1E40AF',
                lineHeight: 1.5
              }}>
                <strong>Leave year:</strong> {explanation.leaveYear}
              </div>
            )}

            {/* Tip (shown outside collapsible for non-brief sections) */}
            {!explanation.brief && explanation.tip && (
              <div style={{
                marginTop: '0.5rem',
                padding: '0.75rem',
                backgroundColor: '#FFF7ED',
                borderRadius: '0.375rem',
                border: '1px solid #FDBA74',
                fontSize: '0.85rem',
                color: '#9A3412',
                lineHeight: 1.5
              }}>
                <strong>Tip:</strong> {explanation.tip}
              </div>
            )}
          </section>

          {/* Data Requirements Checklist */}
          <section style={{
            padding: '1.25rem',
            backgroundColor: COLORS.white,
            borderRadius: '0.5rem',
            border: `1px solid ${COLORS.lightGray}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Database size={18} color={COLORS.slainteBlue} />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: COLORS.darkGray }}>
                Data Requirements
              </h3>
            </div>

            {checklist.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {checklist.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      backgroundColor: item.done ? '#F0FDF4' : COLORS.backgroundGray,
                      borderRadius: '0.375rem',
                      border: `1px solid ${item.done ? '#BBF7D0' : COLORS.lightGray}`
                    }}
                  >
                    <div style={{ flexShrink: 0, marginTop: '0.1rem' }}>
                      {item.done ? (
                        <CheckCircle2 size={18} color="#22C55E" />
                      ) : (
                        <Circle size={18} color={COLORS.mediumGray} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        margin: 0,
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: item.done ? '#166534' : COLORS.darkGray
                      }}>
                        {item.label}
                      </p>
                      {/* Multi-line detail for enhanced leave balances */}
                      {item.multiLine ? (
                        <div style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: item.done ? '#15803D' : COLORS.mediumGray }}>
                          {item.detail.split('\n').map((line, j) => (
                            <p key={j} style={{
                              margin: j === 0 ? 0 : '0.2rem 0 0',
                              fontWeight: j === 0 ? 500 : 400,
                              color: j > 0 && item.hasUnclaimed && line.includes('unclaimed') ? COLORS.expenseColor : undefined
                            }}>
                              {line}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p style={{
                          margin: '0.15rem 0 0',
                          fontSize: '0.8rem',
                          color: item.done ? '#15803D' : COLORS.mediumGray
                        }}>
                          {item.detail}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '0.85rem', color: COLORS.mediumGray }}>
                Data requirements information not available for this area.
              </p>
            )}

            {/* Overall readiness summary + Continue to Analysis button */}
            {checklist.length > 0 && (() => {
              const doneCount = checklist.filter(c => c.done).length;
              const allDone = doneCount === checklist.length;
              const showAnalysisButton = allDone && areaReadiness?.canAnalyze;
              return (
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{
                    padding: '0.5rem 0.75rem',
                    backgroundColor: allDone ? '#F0FDF4' : '#FFFBEB',
                    borderRadius: showAnalysisButton ? '0.375rem 0.375rem 0 0' : '0.375rem',
                    border: `1px solid ${allDone ? '#BBF7D0' : '#FDE68A'}`,
                    borderBottom: showAnalysisButton ? 'none' : undefined,
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    color: allDone ? '#166534' : '#92400E',
                    textAlign: 'center'
                  }}>
                    {allDone
                      ? 'All data requirements met \u2014 this area is ready for analysis'
                      : `${doneCount}/${checklist.length} requirements met \u2014 complete the outstanding items to enable full analysis`
                    }
                  </div>
                  {showAnalysisButton && onViewAnalysis && (
                    <button
                      onClick={onViewAnalysis}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        width: '100%',
                        padding: '0.75rem',
                        backgroundColor: COLORS.slainteBlue,
                        color: COLORS.white,
                        border: 'none',
                        borderRadius: '0 0 0.375rem 0.375rem',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'opacity 0.15s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                    >
                      View Analysis
                      <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              );
            })()}
          </section>

          {/* Staleness warning for user-entered data */}
          {areaReadiness?.dataAge?.isStale && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              backgroundColor: '#FFFBEB',
              border: '1px solid #FDE68A'
            }}>
              <Clock style={{
                width: '1.25rem',
                height: '1.25rem',
                flexShrink: 0,
                marginTop: '0.1rem',
                color: '#D97706'
              }} />
              <div>
                <p style={{
                  margin: 0,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#92400E'
                }}>
                  This data was last updated {formatDaysAgo(areaReadiness.dataAge.daysOld)}
                </p>
                <p style={{
                  margin: '0.25rem 0 0',
                  fontSize: '0.8rem',
                  color: '#78350F'
                }}>
                  Consider refreshing these figures from your EHR to ensure analysis accuracy.
                </p>
              </div>
            </div>
          )}

          {/* Data Collection Form (where applicable) */}
          {needsUserInput(areaId) && (
            <section style={{
              padding: '1.25rem',
              backgroundColor: COLORS.white,
              borderRadius: '0.5rem',
              border: `1px solid ${COLORS.lightGray}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Upload size={18} color={COLORS.slainteBlue} />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: COLORS.darkGray }}>
                  {getFormTitle(areaId)}
                </h3>
              </div>
              <AreaDataCollector
                areaId={areaId}
                readiness={areaReadiness}
                healthCheckData={healthCheckData}
                paymentAnalysisData={paymentAnalysisData}
                onUpdate={onUpdate}
              />
            </section>
          )}
        </div>
      )}

      {/* ─────────── ANALYSIS VIEW ─────────── */}
      {!isDataView && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Analysis section */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <BarChart3 size={18} color={COLORS.slainteBlue} />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: COLORS.darkGray }}>
                Analysis
              </h3>
            </div>
            <AreaAnalysisPanel
              areaId={areaId}
              analysis={analysis}
              canAnalyze={areaReadiness?.canAnalyze}
              readiness={areaReadiness}
              healthCheckData={healthCheckData}
            />
          </section>

          {/* Tasks section */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <ListTodo size={18} color={COLORS.slainteBlue} />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: COLORS.darkGray }}>
                Recommended Actions
              </h3>
            </div>
            <AreaTaskPanel
              areaId={areaId}
              recommendations={recommendations}
              canAnalyze={areaReadiness?.canAnalyze}
              healthCheckData={healthCheckData}
            />
          </section>
        </div>
      )}
    </div>
  );
};

/**
 * Check if an area requires user input (vs auto-extracted from PDFs)
 */
function needsUserInput(areaId) {
  // Leave is fully auto-extracted from PDFs — no form needed
  // Practice Support has a partial form (staff experience)
  // Capitation, Cervical Check, CDM need user-entered data
  // STC: auto-extracted from PDFs but also collects which services the practice offers
  return ['practiceSupport', 'capitation', 'cervicalCheck', 'cdm', 'stc'].includes(areaId);
}

/**
 * Get the form section title for areas that need user input
 */
function getFormTitle(areaId) {
  const titles = {
    practiceSupport: 'Enter Staff Details',
    capitation: 'Enter Patient Demographics',
    cervicalCheck: 'Enter Eligible Women Counts',
    cdm: 'Enter Disease Register Counts',
    stc: 'Services Your Practice Provides'
  };
  return titles[areaId] || 'Enter Data';
}

export default AreaDetailView;

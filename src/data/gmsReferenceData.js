/**
 * GMS Reference Data — detailed explanations of every GMS payment area.
 * Used by Finn's context builder for Q&A, NOT displayed in the UI directly.
 * Content extracted from NewGMSHealthCheck/AreaDetailView.jsx CATEGORY_EXPLANATIONS.
 */

const GMS_REFERENCE = {
  leave: {
    title: 'Study & Annual Leave',
    summary: 'GMS GPs receive 10 days study leave + up to 20 days annual leave per panel/year at €197.24/day. Forfeited on 1st April each year.',
    rates: [
      'Study Leave: 10 days/year per panel for panels >100 patients = €1,972.40/year',
      'Annual Leave: Up to 20 days/year per panel = up to €3,944.80/year',
      'Daily rate: €197.24',
      'Maximum combined: €5,917.20/year per panel'
    ],
    howPaid: 'Monthly via PCRS statement. Claims via ALF/1 form.',
    leaveYear: 'Runs 1st April–31st March. Unclaimed balance is forfeited on 1st April — there is no carryover.',
    commonIssues: [
      'Many GPs do not claim their full study leave entitlement',
      'Leave balance should be checked regularly before 31st March deadline',
      'Some GPs are unaware they can claim study leave for CPD activities'
    ],
    calculationMethod: 'The analysis compares PCRS leave balance data (days taken × €197.24 daily rate) against the full entitlement. Any gap between claimed and entitled days represents unclaimed income.'
  },

  practiceSupport: {
    title: 'Practice Support Subsidies',
    summary: 'HSE subsidises practice nurses, secretaries, and practice managers based on GMS panel size and staff working hours.',
    rates: [
      'Secretary/Administrator: €22,694 (Point 1), €24,586 (Point 2), €26,477 (Point 3) — up to 35 hrs/week',
      'Practice Nurse: €34,041 (Point 1), €35,933 (Point 2), €37,824 (Point 3), €41,606 (Point 4) — up to 35 hrs/week',
      'Practice Manager: €34,041/year — for partnerships where nurse subsidy is maximised',
      'Capacity Support Grant: €15,000 per GP (weighted panel 500+) for staff hired or additional hours since July 2023'
    ],
    howPaid: 'Monthly via PCRS. Pro-rated on weighted GMS panel (over-70s count as 2 patients). Maximum 1,200 weighted panel per GP.',
    panelProRating: 'Entitlement is calculated as: (weighted panel / 1200) × full-time hours (35 hrs/week). Practices with larger panels get more hours covered. Multiple GPs share the same entitlement pool.',
    incrementPoints: 'Staff move to the next increment point based on years of experience: Point 1 (0–1 years), Point 2 (2–3 years), Point 3 (4+ years for secretaries), Point 4 (4+ years for nurses only).',
    commonIssues: [
      'Staff registered with PCRS on the wrong increment point (e.g., 5 years experience but still on Point 1)',
      'Not all eligible hours being claimed (staff working 30 hrs but PCRS only shows 20)',
      'Eligible staff not registered with PCRS at all',
      'Practice unaware of Capacity Support Grant eligibility'
    ],
    calculationMethod: 'Per-staff analysis compares PCRS-registered hours and increment points against actual hours worked and years of experience. Gaps represent recoverable income. Unregistered staff represent new subsidy claims.'
  },

  capitation: {
    title: 'Capitation Payments',
    summary: 'Core GMS payment — quarterly fee per registered patient. Under-6s, over-70s, and nursing home residents have higher rates. Compare EHR patient counts vs PCRS registrations to find unregistered patients.',
    rates: [
      'Under 6: €30.88/quarter (~€125/year)',
      'Over 70: €70.88/quarter (~€272/year)',
      'Nursing Home (Form 903): €927/year',
      'Standard adult GMS: varies by contract type'
    ],
    howPaid: 'Quarterly by PCRS based on registered patient panel.',
    eligibility: 'Under-6s and over-70s are auto-eligible for GMS/DVC cards regardless of income. This means all patients in these age groups attending the practice should be on the GMS panel.',
    commonIssues: [
      'Patients attending the practice but not registered on the GMS panel',
      'Most common gap: under-6 and over-70 patients — compare EHR demographics vs PCRS registrations',
      'New patients not added to panel promptly',
      'Panel cleanup needed after patient transfers or deaths'
    ],
    calculationMethod: 'Compares EHR patient demographics (from user input or Socrates CSV) against PCRS-registered demographics. Any gap (EHR count > PCRS count) in an age band represents potentially unregistered patients, valued at the quarterly capitation rate × 4.'
  },

  cervicalCheck: {
    title: 'CervicalCheck Programme',
    summary: 'GPs paid €65 per eligible smear under national screening. Open to all women 25–65 (GMS, DVC, and private patients). GP must hold National Cancer Screening Contract.',
    rates: [
      'Payment per smear: €65.00 (increased from €49.10 in March 2020 with HPV primary screening)',
      'Screening intervals: Every 3 years for women 25–44, every 5 years for women 45–65'
    ],
    howPaid: 'Via PCRS statement. Sample must be sent to the designated CervicalCheck lab.',
    eligibility: 'All women aged 25–65 are eligible regardless of GMS/private status. The GP practice must have a National Cancer Screening Contract in place.',
    commonIssues: [
      'Zero-payment smears: test performed and recorded but no payment received from PCRS',
      'Common causes of zero payment: patient not registered with CervicalCheck, screening interval not yet elapsed, sample sent to wrong lab',
      'Under-activity: eligible women in the practice not being offered/receiving screening'
    ],
    calculationMethod: 'Analyses PCRS cervical screening data to identify zero-payment smears (tests done without payment) and compares screening activity against eligible population (from user-entered demographics) to identify growth potential.'
  },

  stc: {
    title: 'Special Type Consultations',
    summary: 'Fee-per-item payments for specific procedures: minor surgery, diagnostics, contraception/LARC, paediatric procedures. Many practices significantly under-claim.',
    rates: [
      'Clinical Procedures: Skin excisions €24.80, suturing €50, catheterisation €60, phlebotomy €100',
      'Diagnostics: ECG €24.80, 24hr ABPM €60 (for individual patient care only)',
      'Contraception/LARC: Fitting €100–€160, consultations €55, removals €50–€110',
      'Free Contraception Scheme: Women 17–35 + GMS/DVC women 36–44',
      'Paediatric (<8): Foreign body removal €24.80, suturing €37.21, abscess drainage €24.80'
    ],
    howPaid: 'Per-item via PCRS online claims system. Claims must be submitted within the claim period.',
    benchmarking: 'National benchmarks are calculated per 1,000 GMS panel patients. A practice claiming significantly below national average for a procedure code likely has an under-claiming gap.',
    commonIssues: [
      'Under-claiming of ECGs and ABPM (common procedures often not submitted to PCRS)',
      'LARC procedures not being claimed through PCRS',
      'Lack of awareness of claimable procedures',
      'Claims not submitted within the required timeframe'
    ],
    calculationMethod: 'Compares per-code claim rates against national benchmarks (claims per 1,000 panel patients). Codes where the practice is significantly below benchmark are flagged as growth opportunities with estimated annual value.'
  },

  cdm: {
    title: 'Chronic Disease Management',
    summary: 'Structured reviews of patients with chronic conditions (diabetes, asthma, COPD, heart disease, IHD, stroke/TIA, atrial fibrillation, hypertension). Three strands with fees €60–€300/patient/year.',
    rates: [
      'CDM Treatment: 1 condition = €210/year, 2 conditions = €250/year, 3+ conditions = €300/year',
      'CDM Treatment requires 2 reviews/year: annual + interim (≥4 months apart)',
      'CDM Prevention: High-risk patients (QRISK3≥20%, Stage 2 HTN, pre-diabetes, elevated BNP) = €82 + 10% superannuation annually',
      'Opportunistic Case Finding: GMS/DVC patients 65+, not yet on CDM = €60/patient assessment'
    ],
    conditions: [
      'Type 2 Diabetes (ICPC-2: T90)',
      'Asthma (R96)',
      'COPD (R95)',
      'Heart Failure (K77)',
      'Atrial Fibrillation (K78)',
      'IHD (K74/K76)',
      'Stroke/TIA (K90)',
      'Hypertension (K86/K87)'
    ],
    howPaid: 'Via PCRS using CDM claim codes AO–AT.',
    commonIssues: [
      'Gap between disease register numbers and CDM claims = diagnosed but unenrolled patients',
      'Practices not claiming for multi-morbidity uplift (2+ conditions)',
      'Prevention strand often underutilised',
      'Opportunistic Case Finding not being performed on eligible 65+ patients'
    ],
    calculationMethod: 'Compares disease register counts (from user input) against CDM claim data from PCRS/STC details. Gap between registered patients and claimed patients represents enrolment opportunity. Uses 75% uptake target as benchmark. Values calculated using condition-count tiered rates.'
  }
};

/**
 * Format a single area's reference data as a text block for Finn's context.
 */
export function formatAreaReference(areaId) {
  const ref = GMS_REFERENCE[areaId];
  if (!ref) return '';

  const lines = [
    `## ${ref.title}`,
    '',
    ref.summary,
    '',
    '### Rates & Payments',
    ...ref.rates.map(r => `- ${r}`),
    '',
    `**How Paid:** ${ref.howPaid}`,
  ];

  if (ref.leaveYear) lines.push(`**Leave Year:** ${ref.leaveYear}`);
  if (ref.panelProRating) lines.push(`**Panel Pro-Rating:** ${ref.panelProRating}`);
  if (ref.incrementPoints) lines.push(`**Increment Points:** ${ref.incrementPoints}`);
  if (ref.eligibility) lines.push(`**Eligibility:** ${ref.eligibility}`);
  if (ref.benchmarking) lines.push(`**Benchmarking:** ${ref.benchmarking}`);
  if (ref.conditions) {
    lines.push('', '### Covered Conditions', ...ref.conditions.map(c => `- ${c}`));
  }

  lines.push('', '### Common Issues', ...ref.commonIssues.map(i => `- ${i}`));
  lines.push('', `**Calculation Method:** ${ref.calculationMethod}`);

  return lines.join('\n');
}

/**
 * Format all areas' reference data as a combined text block.
 */
export function formatAllReferences() {
  return Object.keys(GMS_REFERENCE).map(formatAreaReference).join('\n\n---\n\n');
}

export default GMS_REFERENCE;

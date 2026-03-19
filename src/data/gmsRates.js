// GMS Payment Rates
// Based on 2024 GP Agreement and PCRS Fee Schedule
// These rates are stable and updated only when HSE changes them
//
// IMPORTANT: Capitation rates are QUARTERLY payments per patient
// Annual capitation = quarterly rate × 4
import COLORS from '../utils/colors';

const gmsRates = {
  // Version tracking
  version: '2024.2',
  lastUpdated: '2024-12-01',

  // Capitation Rates (QUARTERLY payments per patient)
  // Note: Actual rates vary by gender and distance code
  // These are approximate averages based on typical urban/suburban practices
  // Source: PCRS Fee Schedule - GMS capitation payments
  capitation: {
    under6: {
      male: 31.25,      // ~€125/year
      female: 30.50,
      average: 30.88
    },
    age6to7: {
      male: 45.00,      // ~€180/year
      female: 44.50,
      average: 44.75
    },
    age8to12: {
      male: 21.25,      // ~€85/year
      female: 21.75,
      average: 21.50
    },
    age13to69: {
      male: 11.00,      // ~€44/year (base rate, varies by distance)
      female: 13.00,
      average: 12.00
    },
    over70: {
      male: 68.00,      // ~€272/year
      female: 73.75,
      average: 70.88
    },
    nursingHome: 927  // Annual rate for nursing home residents (Form 903)
  },

  // Practice Support Subsidies (annual payments)
  // Pro-rated based on weighted panel size (max at 1200 per GP)
  // Weighted panel = regular patients + (over 70s × 2)
  // Rural Practice Allowance holders automatically qualify for 1200 weighted panel
  practiceSupport: {
    // Secretary/Administrator rates by increment point (years of experience)
    // Increment points typically map to years: Point 1 = Year 1, Point 2 = Year 2, etc.
    secretary: {
      // Annual rates by increment point
      rates: {
        1: 22694,   // Year 1 / Increment Point 1
        2: 24586,   // Year 2 / Increment Point 2
        3: 26477,   // Year 3+ / Increment Point 3
      },
      maxIncrementPoint: 3,
      fullTimeHoursPerWeek: 35,  // PCRS maximum subsidised hours per week (not 39)
      default: 24586  // Use point 2 as default when unknown
    },

    // Nurse rates by increment point
    nurse: {
      rates: {
        1: 34041,   // Year 1 / Increment Point 1
        2: 35933,   // Year 2 / Increment Point 2
        3: 37824,   // Year 3 / Increment Point 3
        4: 41606,   // Year 4+ / Increment Point 4+
      },
      maxIncrementPoint: 4,
      fullTimeHoursPerWeek: 35,  // PCRS maximum subsidised hours per week (not 39)
      default: 37824  // Use point 3 as default when unknown
    },

    // Practice Manager (only available to partnerships not maximising nurse subsidy)
    practiceManager: {
      rate: 34041,
      fullTimeHoursPerWeek: 35  // PCRS maximum subsidised hours per week (not 39)
    },

    // Capacity Grant (2023 GP Agreement)
    // €15,000 per GP with weighted panel 500+
    // For staff hired or additional hours created after July 2023
    capacityGrant: {
      amount: 15000,
      minWeightedPanel: 500,
      effectiveDate: '2023-07-01'
    },

    // Panel calculation parameters
    maxWeightedPanelPerGP: 1200,
    minPanelForSubsidy: 100,

    // Panel increments for pro-rata calculation
    // Subsidy is calculated in 12 increments from 100 to 1200
    increments: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200],

    // Staff type codes (as they may appear in PCRS reports)
    staffTypeCodes: {
      'SEC': 'secretary',
      'SECRETARY': 'secretary',
      'ADMIN': 'secretary',
      'ADMINISTRATOR': 'secretary',
      'NUR': 'nurse',
      'NURSE': 'nurse',
      'PN': 'nurse',
      'PRACTICE NURSE': 'nurse',
      'MGR': 'practiceManager',
      'MANAGER': 'practiceManager',
      'PM': 'practiceManager',
      'PRACTICE MANAGER': 'practiceManager'
    }
  },

  // Leave Payment Rates
  // Note: Annual leave entitlement varies by panel size - extracted from PCRS PDF
  // Study leave is flat 10 days for panels over 100 patients
  leave: {
    perDay: 197.24,
    studyLeaveDays: 10,      // 10 days study leave per GP panel >100 (flat rate)
    studyLeaveTotal: 1972    // €197.24 x 10
    // Annual leave entitlement is panel-size dependent and read from PCRS data
  },

  // Disease Management Payments
  diseaseManagement: {
    asthmaUnder8: {
      registration: 125,  // One-time registration fee
      review: 75          // Annual review fee
    },
    type2Diabetes: {
      registration: 120,  // One-time registration fee
      review: 60          // Annual review fee
    },
    cvdRisk: {
      registration: 100,  // One-time registration fee (if applicable)
      review: 50          // Annual review fee (if applicable)
    }
  },

  // Cervical Check Payments
  // Rate changed from €49.10 to €65.00 when HPV primary screening was introduced (30 March 2020)
  cervicalCheck: {
    perSmear: 65.00,
    rateHistory: [
      { rate: 49.10, from: '2008-09-01', to: '2020-03-29', label: 'Cytology screening' },
      { rate: 65.00, from: '2020-03-30', to: null, label: 'HPV primary screening' }
    ]
  },

  // Special Type Consultations (STCs) - Complete Code List
  // Source: HSE PCRS Schedule of Fees (2024)
  stc: {
    // Master list of all STC codes with fees and metadata
    codes: {
      // Traditional Procedures
      A: {
        name: 'Excision/Cryotherapy/Diathermy of Skin Lesions',
        fee: 24.80,
        category: 'procedures',
        description: 'Removal or destruction of skin lesions'
      },
      B: {
        name: 'Suturing Cuts & Lacerations',
        fee: 50.00,
        category: 'procedures',
        description: 'Includes tissue glue, does not include paper sutures'
      },
      C: {
        name: 'Draining of Hydroceles',
        fee: 24.80,
        category: 'procedures',
        description: 'Drainage procedure'
      },
      D: {
        name: 'Dental/Nasal Haemorrhage Treatment',
        fee: 24.80,
        category: 'procedures',
        description: 'Treatment and plugging of dental and nasal haemorrhages'
      },
      F: {
        name: 'ECG',
        fee: 24.80,
        category: 'diagnostics',
        description: 'ECG tests & interpretation - individual patient care, not general/routine test'
      },
      G: {
        name: 'Diaphragm Fitting Instruction',
        fee: 24.80,
        category: 'contraception',
        description: 'Instruction in the fitting of a diaphragm'
      },
      H: {
        name: 'Foreign Body Removal (Eye)',
        fee: 24.80,
        category: 'procedures',
        description: 'Removal of adherent foreign bodies from the conjunctival surface of the eye'
      },
      J: {
        name: 'Foreign Body Removal (ENT)',
        fee: 24.80,
        category: 'procedures',
        description: 'Removal of lodged or impacted foreign bodies from the ear, nose & throat'
      },
      K: {
        name: 'Nebuliser Treatment',
        fee: 37.21,
        category: 'respiratory',
        description: 'Nebuliser treatment in the case of acute asthmatic attack'
      },
      L: {
        name: 'Bladder Catheterisation',
        fee: 60.00,
        category: 'procedures',
        description: 'Composite fee for insertion & removal'
      },
      M: {
        name: 'HSE Case Conference',
        fee: 62.02,
        category: 'admin',
        description: 'Attendance at HSE convened case conference'
      },

      // Under 8s Procedures
      X: {
        name: 'Under 8 - Foreign Body Removal',
        fee: 24.80,
        category: 'paediatric',
        description: 'Removal of lodged or impacted foreign bodies from ear, nose, throat & skin'
      },
      Y: {
        name: 'Under 8 - Suturing',
        fee: 37.21,
        category: 'paediatric',
        description: 'Suturing of cuts & lacerations (includes tissue glue)'
      },
      Z: {
        name: 'Under 8 - Draining Abscess',
        fee: 24.80,
        category: 'paediatric',
        description: 'Draining of abscess'
      },

      // LARC (Long-Acting Reversible Contraception) - GMS 31-44
      AB: {
        name: 'LARC Counselling/Insertion/Monitoring',
        fee: 70.00,
        category: 'contraception',
        description: 'Long Acting Reversible Contraceptive Device from certified GP (GMS 31-44)'
      },
      AC: {
        name: 'LARC Removal',
        fee: 50.00,
        category: 'contraception',
        description: 'Removal of Long Acting Reversible Contraceptive Device (GMS 31-44)'
      },

      // Specialist Diagnostics & Treatment
      AD: {
        name: '24hr ABPM',
        fee: 60.00,
        category: 'diagnostics',
        description: '24Hr Ambulatory Blood Pressure Monitoring - diagnosis & treatment for individual patient care'
      },
      AL: {
        name: 'Therapeutic Phlebotomy',
        fee: 100.00,
        category: 'procedures',
        description: 'Therapeutic phlebotomy for haemochromatosis'
      },
      AM: {
        name: 'Virtual Clinics (Heart Failure)',
        fee: 100.00,
        category: 'cdm',
        description: 'Virtual clinics for heart failure patients'
      },

      // Free Contraception Scheme (17-35)
      CF: {
        name: 'Free Contraception Consultation',
        fee: 55.00,
        category: 'contraception',
        description: 'Contraception consultation for accessing relevant products (17-35)'
      },
      CG: {
        name: 'Free Contraception - LARC Implant Fitting',
        fee: 100.00,
        category: 'contraception',
        description: 'LARC Implant fitting under Free Contraception Scheme (17-35)'
      },
      CH: {
        name: 'Free Contraception - LARC Coil Fitting',
        fee: 160.00,
        category: 'contraception',
        description: 'LARC Coil fitting under Free Contraception Scheme (17-35)'
      },
      CI: {
        name: 'Free Contraception - LARC Implant Removal',
        fee: 110.00,
        category: 'contraception',
        description: 'LARC Implant removal under Free Contraception Scheme (17-35)'
      },
      CJ: {
        name: 'Free Contraception - LARC Coil Removal',
        fee: 50.00,
        category: 'contraception',
        description: 'LARC Coil removal under Free Contraception Scheme (17-35)'
      },
      CK: {
        name: 'Free Contraception - Post-LARC Follow-up',
        fee: 55.00,
        category: 'contraception',
        description: 'Follow-up consultation post LARC fitting (17-35)'
      },

      // GMS/DVC Contraception (36-44) - 2023 Agreement
      CL: {
        name: 'GMS/DVC Contraception Consultation',
        fee: 55.00,
        category: 'contraception',
        description: 'Contraception consultation for accessing relevant products (36-44)'
      },
      CM: {
        name: 'GMS/DVC - LARC Coil Fitting',
        fee: 160.00,
        category: 'contraception',
        description: 'LARC Coil fitting (36-44) - Agreement 2023'
      },
      CN: {
        name: 'GMS/DVC - LARC Coil Removal',
        fee: 50.00,
        category: 'contraception',
        description: 'LARC Coil removal (36-44) - Agreement 2023'
      },
      CO: {
        name: 'GMS/DVC - LARC Implant Fitting',
        fee: 100.00,
        category: 'contraception',
        description: 'LARC Implant fitting (36-44) - Agreement 2023'
      },
      CQ: {
        name: 'GMS/DVC - LARC Implant Removal',
        fee: 110.00,
        category: 'contraception',
        description: 'LARC Implant removal (36-44) - Agreement 2023'
      },

      // COVID Vaccinations (legacy)
      AU: {
        name: 'COVID Vaccine 1st Dose',
        fee: 25.00,
        category: 'vaccines',
        description: 'COVID-19 vaccination first dose'
      },
      AV: {
        name: 'COVID Vaccine 2nd Dose',
        fee: 25.00,
        category: 'vaccines',
        description: 'COVID-19 vaccination second dose'
      },
      AZ: {
        name: 'COVID Booster',
        fee: 25.00,
        category: 'vaccines',
        description: 'COVID-19 booster vaccination'
      },

      // ===== CHRONIC DISEASE MANAGEMENT (CDM) TREATMENT PROGRAMME =====
      // Fee based on NUMBER OF CONDITIONS, not disease type
      // Conditions: Asthma, Type 2 Diabetes, COPD, Heart Failure, IHD, Stroke/TIA, AF
      // Two reviews per annum: Annual Review + Interim Review (min 4 months apart)
      // 50% of annual fee per review, +10% superannuation

      // CDM In-Surgery Reviews (full fee)
      AO: {
        name: 'CDM Review - 1 Condition',
        fee: 105.00,
        category: 'cdm',
        description: 'CDM in-surgery review for patient with 1 chronic condition (€210/year total)'
      },
      AP: {
        name: 'CDM Review - 2 Conditions',
        fee: 125.00,
        category: 'cdm',
        description: 'CDM in-surgery review for patient with 2 chronic conditions (€250/year total)'
      },
      AQ: {
        name: 'CDM Review - 3+ Conditions',
        fee: 150.00,
        category: 'cdm',
        description: 'CDM in-surgery review for patient with 3+ chronic conditions (€300/year total)'
      },

      // Modified CDM (MCDM) - Phone/Video Reviews (reduced fee)
      AR: {
        name: 'MCDM Phone Review - 1 Condition',
        fee: 55.00,
        category: 'cdm',
        description: 'Modified CDM phone/video review for patient with 1 chronic condition'
      },
      AS: {
        name: 'MCDM Phone Review - 2 Conditions',
        fee: 65.00,
        category: 'cdm',
        description: 'Modified CDM phone/video review for patient with 2 chronic conditions'
      },
      AT: {
        name: 'MCDM Phone Review - 3+ Conditions',
        fee: 75.00,
        category: 'cdm',
        description: 'Modified CDM phone/video review for patient with 3+ chronic conditions'
      },

      // ===== OPPORTUNISTIC CASE FINDING (OCF) =====
      // For GMS/DVC patients aged 65+ not already on CDM programme
      // Identifies undiagnosed chronic disease or high risk patients
      // No superannuation payable
      BC: {
        name: 'OCF Assessment',
        fee: 60.00,
        category: 'ocf',
        description: 'Opportunistic Case Finding assessment for patients 65+ (no superannuation)'
      },

      // ===== PREVENTION PROGRAMME (PP) =====
      // For high-risk patients: QRISK3≥20%, Stage 2 HTN, pre-diabetes, elevated BNP
      // Aged 45+ GMS/DVC at high risk, or 18+ with hypertension, or gestational diabetes/pre-eclampsia
      // One annual review (min 9 months interval), +10% superannuation
      BB: {
        name: 'Prevention Programme Review',
        fee: 82.00,
        category: 'pp',
        description: 'Annual Prevention Programme review for high-risk patients (+10% superannuation)'
      }
    },

    // Categories for grouping in analysis
    categories: {
      procedures: { name: 'Clinical Procedures', color: COLORS.slainteBlue },
      diagnostics: { name: 'Diagnostics', color: COLORS.chartViolet },
      contraception: { name: 'Contraception/LARC', color: COLORS.chartPink },
      respiratory: { name: 'Respiratory', color: COLORS.success },
      paediatric: { name: 'Paediatric (Under 8)', color: COLORS.warning },
      cdm: { name: 'Chronic Disease Management', color: COLORS.error },
      ocf: { name: 'Opportunistic Case Finding', color: COLORS.warning },
      pp: { name: 'Practice Programme', color: COLORS.incomeColor },
      vaccines: { name: 'Vaccinations', color: COLORS.slainteBlue },
      admin: { name: 'Administrative', color: COLORS.textMuted }
    },

    // National benchmark data from PCRS annual reports
    // Per-code data: PCRS 2018 Special Items of Service (most recent per-code breakdown available)
    // Aggregate data: PCRS 2023 Statistical Analysis of Claims and Payments
    nationalData: {
      source: 'PCRS Statistical Analysis of Claims and Payments',
      perCodeYear: 2018,
      aggregateYear: 2023,
      // 2018 denominators (MC + GPVC)
      gmsEligiblePersons2018: 2068378,
      gpContracts2018: 2921,
      // 2023 denominators
      gmsEligiblePersons2023: 2241662,
      gpContracts2023: 3110,
      // 2023 aggregate totals
      totalSpecialServiceClaims2023: 3358063,
      totalSpecialServicePayments2023: 154319857,
      // 2018 per-code claims and cost (€)
      claims2018: {
        A:  { claims: 154129, cost: 3821363 },
        AB: { claims: 18376,  cost: 1286320 },
        AC: { claims: 10003,  cost: 500150 },
        AD: { claims: 126404, cost: 7584240 },
        AE: { claims: 109665, cost: 5483250 },
        B:  { claims: 53984,  cost: 2697980 },
        C:  { claims: 1535,   cost: 38059 },
        D:  { claims: 2690,   cost: 66712 },
        F:  { claims: 179536, cost: 4452140 },
        H:  { claims: 12018,  cost: 298051 },
        J:  { claims: 64091,  cost: 1589459 },
        K:  { claims: 94983,  cost: 3534157 },
        L:  { claims: 9752,   cost: 584941 },
        M:  { claims: 481,    cost: 29832 },
        R:  { claims: 24266,  cost: 691581 },
        S:  { claims: 449032, cost: 6735495 },
        T:  { claims: 12576,  cost: 537624 },
        U:  { claims: 3977,   cost: 188991 },
        X:  { claims: 719,    cost: 17831 },
        Y:  { claims: 402,    cost: 14958 },
        Z:  { claims: 61,     cost: 1513 }
      },
      totalClaims2018: 1328715,
      totalCost2018: 40156079
    },

    // Benchmarks: Expected claims per 1000 GMS eligible persons per year
    // Source: PCRS 2018 national data (2,068,378 eligible persons, 2,921 GP contracts)
    // Post-2018 codes use estimates pending per-code national data
    benchmarks: {
      // === Traditional procedures (PCRS 2018 national data) ===
      A:  { ratePerThousand: 74.5,  basis: 'PCRS 2018: 154,129 national claims' },
      B:  { ratePerThousand: 26.1,  basis: 'PCRS 2018: 53,984 national claims' },
      D:  { ratePerThousand: 1.3,   basis: 'PCRS 2018: 2,690 national claims' },
      H:  { ratePerThousand: 5.8,   basis: 'PCRS 2018: 12,018 national claims' },
      J:  { ratePerThousand: 31.0,  basis: 'PCRS 2018: 64,091 national claims' },
      L:  { ratePerThousand: 4.7,   basis: 'PCRS 2018: 9,752 national claims' },

      // === Diagnostics (PCRS 2018 national data) ===
      F:  { ratePerThousand: 86.8,  basis: 'PCRS 2018: 179,536 national claims' },
      AD: { ratePerThousand: 61.1,  basis: 'PCRS 2018: 126,404 national claims' },

      // === Respiratory (PCRS 2018 national data) ===
      K:  { ratePerThousand: 45.9,  basis: 'PCRS 2018: 94,983 national claims' },

      // === LARC GMS (PCRS 2018 national data) ===
      AB: { ratePerThousand: 8.9,   basis: 'PCRS 2018: 18,376 national claims' },
      AC: { ratePerThousand: 4.8,   basis: 'PCRS 2018: 10,003 national claims' },

      // === Vaccinations (PCRS 2018 national data) ===
      S:  { ratePerThousand: 217.1, basis: 'PCRS 2018: 449,032 national claims' },
      R:  { ratePerThousand: 11.7,  basis: 'PCRS 2018: 24,266 national claims' },

      // === Paediatric under 8 (PCRS 2018 national data — under 6 only at time) ===
      X:  { ratePerThousand: 0.35,  basis: 'PCRS 2018: 719 national claims (under 6 only pre-2023)' },
      Y:  { ratePerThousand: 0.19,  basis: 'PCRS 2018: 402 national claims (under 6 only pre-2023)' },
      Z:  { ratePerThousand: 0.03,  basis: 'PCRS 2018: 61 national claims (under 6 only pre-2023)' },

      // === Free Contraception Scheme (estimated — no per-code national data, scheme from 2022) ===
      // Note: CF/CG/CH flat rates are fallbacks only — when stcDemographics are available,
      // demographic-derived targets are used instead (see healthCheckCalculations.js)
      CF: { ratePerThousand: 30,    basis: 'Estimated — ~245K women accessing scheme nationally (2024)' },
      CG: { ratePerThousand: 4.6,   basis: 'UK OHID 2022/23: 14 per 1,000 eligible women × ~33% GMS panel share' },
      CH: { ratePerThousand: 9.9,   basis: 'UK OHID 2022/23: 30 per 1,000 eligible women × ~33% GMS panel share' }
    }
  }
};

// Helper functions for calculations

/**
 * Get the CervicalCheck rate applicable for a given date
 * @param {string|Date} date - Date string or Date object (defaults to current rate if null)
 * @returns {number} The rate per smear applicable at that time
 */
export function getCervicalCheckRate(date = null) {
  if (!date) return gmsRates.cervicalCheck.perSmear;
  const d = typeof date === 'string' ? new Date(date) : date;
  const history = gmsRates.cervicalCheck.rateHistory;
  // Find the rate active at the given date (search in reverse for most recent first)
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i];
    const from = new Date(entry.from);
    if (d >= from) return entry.rate;
  }
  return history[0].rate; // Fallback to earliest rate
}

/**
 * Calculate weighted panel for capacity grant eligibility
 * Over-70s count as 2 patients
 */
export function calculateWeightedPanel(demographics) {
  const regularPanel =
    (demographics.under6 || 0) +
    (demographics.age6to7 || 0) +
    (demographics.age8to12 || 0) +
    (demographics.age13to69 || 0);

  const over70Panel = (demographics.over70 || 0) * 2;

  return regularPanel + over70Panel;
}

/**
 * Calculate panel factor for practice support subsidies
 *
 * IMPORTANT: The subsidy works on a "per GP" basis with aggregated panels.
 * Each GP can claim one full-time secretary and one full-time nurse subsidy.
 * The weighted panel is divided into 1200-patient increments.
 *
 * Example: 4 GPs with weighted panel of 2,941
 * - First 1,200 = 1 full subsidy (100%)
 * - Second 1,200 = 1 full subsidy (100%)
 * - Remaining 541 = 500 increment = 42% of a third subsidy
 * - Total subsidy entitlement = 2.42 full subsidies (not 4 at 61% each)
 *
 * However, for simplicity in estimation, we calculate the total subsidy units available.
 * This function returns the TOTAL subsidy units as a factor.
 *
 * @param {number} weightedPanel - The weighted panel size (over 70s count double)
 * @param {number} numGPs - Number of GMS GPs in the practice
 * @returns {number} Number of full subsidy units available (e.g., 2.42)
 */
export function calculatePanelFactor(weightedPanel, numGPs) {
  const maxPanelPerGP = 1200;
  const increments = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200];

  // Calculate how many full subsidies and partial subsidies we get
  let remainingPanel = weightedPanel;
  let totalSubsidyUnits = 0;

  // Each GP can claim one full subsidy worth of secretary + nurse
  // We allocate panel in 1200-patient chunks
  for (let gp = 0; gp < numGPs && remainingPanel > 0; gp++) {
    if (remainingPanel >= maxPanelPerGP) {
      // Full subsidy for this GP slot
      totalSubsidyUnits += 1;
      remainingPanel -= maxPanelPerGP;
    } else if (remainingPanel >= 100) {
      // Partial subsidy - find the applicable increment
      let applicableIncrement = 0;
      for (const inc of increments) {
        if (remainingPanel >= inc) {
          applicableIncrement = inc;
        } else {
          break;
        }
      }
      totalSubsidyUnits += applicableIncrement / maxPanelPerGP;
      remainingPanel = 0;
    }
  }

  return totalSubsidyUnits;
}

/**
 * Get average capitation rate for age band
 */
export function getCapitationRate(ageBand) {
  return gmsRates.capitation[ageBand]?.average || 0;
}

/**
 * Get Practice Support subsidy rate for a staff type at a specific increment point
 * @param {string} staffType - 'secretary', 'nurse', or 'practiceManager'
 * @param {number} incrementPoint - The increment point (1, 2, 3, 4, etc.)
 * @returns {number} Annual subsidy rate
 */
export function getPracticeSupportRate(staffType, incrementPoint = null) {
  const support = gmsRates.practiceSupport;

  if (staffType === 'practiceManager') {
    return support.practiceManager.rate;
  }

  const staffConfig = support[staffType];
  if (!staffConfig || !staffConfig.rates) {
    return 0;
  }

  if (incrementPoint === null) {
    return staffConfig.default;
  }

  // Cap at max increment point
  const cappedPoint = Math.min(incrementPoint, staffConfig.maxIncrementPoint);
  return staffConfig.rates[cappedPoint] || staffConfig.default;
}

/**
 * Calculate the correct increment point rate that SHOULD apply based on years of experience
 * Returns the increment point that should be used
 * @param {string} staffType - 'secretary' or 'nurse'
 * @param {number} yearsExperience - Years in the role
 * @returns {number} The increment point that should apply
 */
export function getCorrectIncrementPoint(staffType, yearsExperience) {
  const staffConfig = gmsRates.practiceSupport[staffType];
  if (!staffConfig) return 1;

  // Increment points typically correspond to years of experience
  // Year 1 = Point 1, Year 2 = Point 2, etc.
  const point = Math.max(1, Math.ceil(yearsExperience));
  return Math.min(point, staffConfig.maxIncrementPoint);
}

/**
 * Calculate panel factor using the increment system
 * Panel factor determines what proportion of the full subsidy is payable
 * @param {number} weightedPanel - The weighted panel size
 * @param {number} numGPs - Number of GPs in the practice
 * @returns {object} { factor, increment, explanation }
 */
export function calculatePanelFactorWithIncrements(weightedPanel, numGPs) {
  const maxPerGP = gmsRates.practiceSupport.maxWeightedPanelPerGP;
  const increments = gmsRates.practiceSupport.increments;
  const minPanel = gmsRates.practiceSupport.minPanelForSubsidy;

  // Total max panel for the practice
  const maxTotal = maxPerGP * numGPs;

  // If below minimum, no subsidy
  if (weightedPanel < minPanel) {
    return {
      factor: 0,
      increment: 0,
      explanation: `Weighted panel (${weightedPanel}) below minimum (${minPanel})`
    };
  }

  // Find which increment applies
  // The subsidy is calculated in 12 increments
  // Panel 100-199 = 100 increment = 100/1200 factor
  // Panel 200-299 = 200 increment = 200/1200 factor
  // etc.
  let applicableIncrement = 0;
  for (const inc of increments) {
    if (weightedPanel >= inc * numGPs) {
      applicableIncrement = inc * numGPs;
    } else {
      break;
    }
  }

  // Cap at max
  applicableIncrement = Math.min(applicableIncrement, maxTotal);

  const factor = applicableIncrement / maxTotal;

  return {
    factor,
    increment: applicableIncrement,
    maxPanel: maxTotal,
    explanation: `${applicableIncrement}/${maxTotal} weighted panel = ${(factor * 100).toFixed(0)}% subsidy`
  };
}

/**
 * Calculate annual subsidy for a staff member
 * @param {string} staffType - 'secretary', 'nurse', or 'practiceManager'
 * @param {number} incrementPoint - The increment point being paid
 * @param {number} weeklyHours - Hours worked per week
 * @param {number} panelFactor - The panel factor (0 to 1)
 * @returns {number} Annual subsidy amount
 */
export function calculateStaffSubsidy(staffType, incrementPoint, weeklyHours, panelFactor) {
  const rate = getPracticeSupportRate(staffType, incrementPoint);
  const staffConfig = gmsRates.practiceSupport[staffType];
  const fullTimeHours = staffConfig?.fullTimeHoursPerWeek || 39;

  // Pro-rate for hours worked
  const hoursFactor = Math.min(weeklyHours / fullTimeHours, 1);

  return Math.round(rate * hoursFactor * panelFactor);
}

/**
 * Detect potential issues with a staff member's subsidy
 * @param {object} staffMember - { staffType, incrementPoint, weeklyHours, yearsExperience, actualPayment }
 * @param {number} panelFactor - The practice's panel factor
 * @returns {array} Array of issues found
 */
export function detectPracticeSupportIssues(staffMember, panelFactor) {
  const issues = [];
  const { staffType, incrementPoint, weeklyHours, yearsExperience, actualPayment } = staffMember;

  // Check 1: Wrong increment point for experience
  if (yearsExperience !== undefined && incrementPoint !== undefined) {
    const correctPoint = getCorrectIncrementPoint(staffType, yearsExperience);
    if (incrementPoint < correctPoint) {
      const currentRate = getPracticeSupportRate(staffType, incrementPoint);
      const correctRate = getPracticeSupportRate(staffType, correctPoint);
      const potentialGain = correctRate - currentRate;

      issues.push({
        type: 'WRONG_INCREMENT',
        severity: 'high',
        message: `Increment point ${incrementPoint} but has ${yearsExperience} years experience (should be point ${correctPoint})`,
        currentRate,
        correctRate,
        potentialGain: Math.round(potentialGain * panelFactor),
        recommendation: `Update PCRS to increment point ${correctPoint} for additional €${Math.round(potentialGain * panelFactor).toLocaleString()}/year`
      });
    }
  }

  // Check 2: Under-claimed hours
  const staffConfig = gmsRates.practiceSupport[staffType];
  const fullTimeHours = staffConfig?.fullTimeHoursPerWeek || 39;

  if (weeklyHours && staffMember.hoursClaimed && weeklyHours > staffMember.hoursClaimed) {
    const currentHoursFactor = staffMember.hoursClaimed / fullTimeHours;
    const potentialHoursFactor = Math.min(weeklyHours / fullTimeHours, 1);
    const rate = getPracticeSupportRate(staffType, incrementPoint);
    const potentialGain = rate * (potentialHoursFactor - currentHoursFactor) * panelFactor;

    if (potentialGain > 100) { // Only flag if meaningful difference
      issues.push({
        type: 'UNDER_CLAIMED_HOURS',
        severity: 'medium',
        message: `Working ${weeklyHours} hours but only claiming ${staffMember.hoursClaimed} hours`,
        hoursClaimed: staffMember.hoursClaimed,
        hoursWorked: weeklyHours,
        potentialGain: Math.round(potentialGain),
        recommendation: `Update PCRS to claim ${Math.min(weeklyHours, fullTimeHours)} hours for additional €${Math.round(potentialGain).toLocaleString()}/year`
      });
    }
  }

  return issues;
}

export default gmsRates;

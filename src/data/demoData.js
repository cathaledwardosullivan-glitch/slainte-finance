/**
 * Demo Data for Sláinte Finance
 * Used when users choose "Explore with Demo Data" during onboarding
 *
 * Generates realistic data for a 3-partner Dublin GP practice to showcase:
 * Financial Overview, P&L Reports, GMS Overview, GMS Health Check,
 * Tasks Widget, and Finn Chat.
 */

import { createUnifiedProfile } from './practiceProfileSchemaV2';
import COLORS from '../utils/colors';

export const DEMO_PROFILE = {
  ...createUnifiedProfile(),
  practiceDetails: {
    practiceName: 'Ballsbridge Medical Centre',
    locations: ['Ballsbridge', 'Dublin 4'],
    website: 'https://example-practice.ie',
    accountant: 'Deloitte',
    yearEndDate: '31-12',
    superannuationAllocation: 'equal',
    setupComplete: true,
    setupCompletedAt: new Date()
  },
  gps: {
    partners: [
      { name: 'Dr. Sarah Murphy', email: 'sarah@example.ie', profitShare: 40, categoryCode: '90.1' },
      { name: 'Dr. Michael O\'Connor', email: 'michael@example.ie', profitShare: 35, categoryCode: '90.2' },
      { name: 'Dr. Emma Kelly', email: 'emma@example.ie', profitShare: 25, categoryCode: '90.3' }
    ],
    salaried: [
      { name: 'Dr. James Walsh', email: 'james@example.ie', categoryCode: '7.1' }
    ]
  },
  staff: [
    { name: 'Mary O\'Brien', role: 'Reception', roleCode: '3' },
    { name: 'Sarah Byrne', role: 'Reception', roleCode: '3' },
    { name: 'Tom Brennan', role: 'Reception', roleCode: '3' },
    { name: 'Aoife Lynch', role: 'Practice Nurse', roleCode: '4' },
    { name: 'John Murphy', role: 'Phlebotomist', roleCode: '5' },
    { name: 'Lisa Chen', role: 'Practice Manager', roleCode: '6' }
  ],
  services: {
    dspPayments: true,
    methadoneServices: false,
    medservFees: true,
    icgpMembership: true,
    medicalCouncil: true
  },
  // GMS Health Check data — pre-populated as if the user already entered EHR data
  healthCheckData: {
    healthCheckComplete: true,
    demographics: {
      under6: 620,
      age6to7: 180,
      over70: 745,
      nursingHomeResidents: 38
    },
    staffDetails: [
      { firstName: 'Mary', surname: 'O\'Brien', staffType: 'secretary', incrementPoint: 5, weeklyHours: 37.5, yearsExperience: 8, actualHoursWorked: 37.5 },
      { firstName: 'Sarah', surname: 'Byrne', staffType: 'secretary', incrementPoint: 3, weeklyHours: 30, yearsExperience: 4, actualHoursWorked: 30 },
      { firstName: 'Tom', surname: 'Brennan', staffType: 'secretary', incrementPoint: 2, weeklyHours: 20, yearsExperience: 2, actualHoursWorked: 20 },
      { firstName: 'Aoife', surname: 'Lynch', staffType: 'nurse', incrementPoint: 6, weeklyHours: 37.5, yearsExperience: 12, actualHoursWorked: 37.5 },
      { firstName: 'Lisa', surname: 'Chen', staffType: 'practiceManager', incrementPoint: 7, weeklyHours: 37.5, yearsExperience: 10, actualHoursWorked: 37.5 }
    ],
    diseaseRegisters: {
      // CDM Treatment Programme
      type2Diabetes: 285,
      asthma: 210,
      copd: 145,
      heartFailure: 62,
      atrialFibrillation: 88,
      ihd: 95,
      stroke: 42,
      // Prevention Programme
      hypertension: 380,
      preDiabetes: 65,
      highCVDRisk: 45,
      gestationalDMHistory: 18,
      preEclampsiaHistory: 12,
      // OCF
      ocfEligible: 120
    },
    cervicalCheckActivity: {
      eligibleWomen25to44: 820,
      eligibleWomen45to65: 560
    }
  },
  metadata: {
    setupComplete: true,
    setupCompletedAt: new Date(),
    isDemoMode: true,
    termsAccepted: { version: '3.0.0', acceptedAt: new Date().toISOString(), scrolledToEnd: true },
    localOnlyMode: false,
    localOnlyModeSetAt: null
  }
};

// Month abbreviations for transaction descriptions
const MONTH_ABBREVS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/**
 * Generate demo transactions spanning full previous year + current year to date.
 * This ensures the Financial Overview has a full 12-month year to display (previous year)
 * plus current year data, matching the GMS panel data approach.
 */
export function generateDemoTransactions() {
  const transactions = [];
  const unidentified = [];
  const today = new Date();
  const currentYear = today.getFullYear();
  const prevYear = currentYear - 1;
  const currentMonth = today.getMonth(); // 0-based

  // Build list of year/month pairs: all 12 months of previous year + current year through today
  const months = [];
  for (let m = 0; m < 12; m++) {
    months.push({ year: prevYear, month: m });
  }
  for (let m = 0; m <= currentMonth; m++) {
    months.push({ year: currentYear, month: m });
  }

  // Seeded random for consistent demo data
  let seed = 99;
  const seededRandom = () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const variation = (base, range) => base + Math.round((seededRandom() - 0.5) * range);
  const upwardBias = (base, range) => base + Math.round((seededRandom() - 0.3) * range);

  // Helper to create a date, clamped to today
  const makeDate = (year, month, day) => {
    const d = new Date(year, month, Math.min(day, 28));
    return d <= today ? d.toISOString().split('T')[0] : null;
  };

  // Staff payments (monthly, 28th)
  const staffPayments = [
    { name: 'MARY OBRIEN', amount: 2400, code: '3.1', categoryName: 'Receptionist - Mary O\'Brien' },
    { name: 'SARAH BYRNE', amount: 2350, code: '3.2', categoryName: 'Receptionist - Sarah Byrne' },
    { name: 'TOM BRENNAN', amount: 1540, code: '3.3', categoryName: 'Receptionist - Tom Brennan' },
    { name: 'AOIFE LYNCH', amount: 3200, code: '4.1', categoryName: 'Practice Nurse - Aoife Lynch' },
    { name: 'JOHN MURPHY', amount: 2800, code: '5.1', categoryName: 'Phlebotomist - John Murphy' },
    { name: 'LISA CHEN', amount: 4500, code: '6.1', categoryName: 'Practice Manager - Lisa Chen' },
    { name: 'DR JAMES WALSH', amount: 7500, code: '7.1', categoryName: 'Salaried GP - Dr. James Walsh' }
  ];

  // Recurring monthly expenses
  const monthlyExpenses = [
    { payee: 'ELECTRIC IRELAND', amount: 450, range: 80, code: '12', categoryName: 'Heat & Light', day: 5 },
    { payee: 'VODAFONE BUSINESS', amount: 180, range: 15, code: '17', categoryName: 'Telephone', day: 10 },
    { payee: 'CLEANCO LTD', amount: 320, range: 0, code: '11', categoryName: 'Cleaning', day: 15 },
    { payee: 'CLANWILLIAM HEALTH SOCRATES', amount: 650, range: 0, code: '16', categoryName: 'IT Systems & Software', day: 8 },
    { payee: 'ZURICH LIFE', amount: 380, range: 0, code: '14', categoryName: 'Insurance', day: 1 },
    { payee: 'MEDISUPPLY IRELAND', amount: 1200, range: 400, code: '30', categoryName: 'Medical & Surgical Supplies', day: 18 },
    { payee: 'SHREDBANK', amount: 85, range: 0, code: '32', categoryName: 'Waste Disposal', day: 22 },
    { payee: 'ELAVON MERCHANT SERVICES', amount: 65, range: 20, code: '10', categoryName: 'Bank Charges', day: 28 },
  ];

  // Monthly income
  const monthlyIncome = [
    { source: 'PCRS GMS', amount: 15000, range: 1500, code: '100', categoryName: 'GMS Income', day: 12 },
    { source: 'PRIVATE FEES LODGMENT', amount: 3500, range: 800, code: '110', categoryName: 'Private Patient Fees', day: 25 },
    { source: 'DSP PAYMENTS', amount: 1800, range: 300, code: '120', categoryName: 'DSP Payments', day: 18 },
    { source: 'MEDSERV FEES', amount: 600, range: 200, code: '130', categoryName: 'Medserv Fees', day: 20 },
  ];

  let txCounter = 0;

  months.forEach(({ year, month }, mi) => {
    const monthAbbr = MONTH_ABBREVS[month];

    // Staff payments (28th)
    staffPayments.forEach((staff, si) => {
      const date = makeDate(year, month, 28);
      if (!date) return;
      transactions.push({
        id: `demo-staff-${txCounter++}`,
        date,
        details: `${staff.name} SALARY ${monthAbbr}`,
        debit: staff.amount,
        credit: null,
        balance: 85000 - (mi * 1500 + si * 100),
        category: { code: staff.code, name: staff.categoryName, type: 'expense', section: 'Staff Costs' }
      });
    });

    // Rent (1st)
    const rentDate = makeDate(year, month, 1);
    if (rentDate) {
      transactions.push({
        id: `demo-rent-${txCounter++}`,
        date: rentDate,
        details: 'BALLSBRIDGE PROPERTY MGMT RENT',
        debit: 4200,
        credit: null,
        balance: 80000 - (mi * 1200),
        category: { code: '28', name: 'Rent & Rates', type: 'expense', section: 'Practice Expenses' }
      });
    }

    // Monthly expenses
    monthlyExpenses.forEach((expense, ei) => {
      const date = makeDate(year, month, expense.day);
      if (!date) return;
      transactions.push({
        id: `demo-monthly-${txCounter++}`,
        date,
        details: `${expense.payee} PAYMENT`,
        debit: variation(expense.amount, expense.range),
        credit: null,
        balance: 75000 - (mi * 800 + ei * 50),
        category: { code: expense.code, name: expense.categoryName, type: 'expense', section: 'Practice Expenses' }
      });
    });

    // Quarterly expenses (every 3 months)
    if (month % 3 === 0) {
      const quarterlyExpenses = [
        { payee: 'MEDISEC IRELAND', amount: 2200, code: '22', categoryName: 'Medical Indemnity', day: 1 },
        { payee: 'DELOITTE DUBLIN', amount: 1500, code: '1', categoryName: 'Accountancy', day: 20 },
        { payee: 'IRISH WATER COMMERCIAL', amount: 280, code: '12', categoryName: 'Heat & Light', day: 12 },
      ];
      quarterlyExpenses.forEach((expense, qi) => {
        const date = makeDate(year, month, expense.day);
        if (!date) return;
        transactions.push({
          id: `demo-quarterly-${txCounter++}`,
          date,
          details: `${expense.payee} PAYMENT`,
          debit: expense.amount,
          credit: null,
          balance: 70000 - (mi * 600 + qi * 80),
          category: { code: expense.code, name: expense.categoryName, type: 'expense', section: 'Practice Expenses' }
        });
      });
    }

    // Monthly income
    monthlyIncome.forEach((income, ii) => {
      const date = makeDate(year, month, income.day);
      if (!date) return;
      transactions.push({
        id: `demo-income-${txCounter++}`,
        date,
        details: `${income.source} LODGMENT`,
        debit: null,
        credit: upwardBias(income.amount, income.range),
        balance: 90000 + (mi * 3000 + ii * 500),
        category: { code: income.code, name: income.categoryName, type: 'income', section: 'Income' }
      });
    });
  });

  // Annual/one-off expenses scattered across the 12-month window
  // Use relative offsets from start of window so they always appear
  const annualExpenses = [
    { payee: 'ICGP MEMBERSHIP', amount: 850, code: '35', categoryName: 'Professional Subscriptions', monthOffset: 0, day: 15 },
    { payee: 'OFFICE SUPPLIES DIRECT', amount: 420, code: '31', categoryName: 'Stationery & Printing', monthOffset: 1, day: 7 },
    { payee: 'MEDICAL COUNCIL IRELAND', amount: 750, code: '35', categoryName: 'Professional Subscriptions', monthOffset: 2, day: 10 },
    { payee: 'PROPERTY MAINTENANCE DUBLIN', amount: 2800, code: '29', categoryName: 'Repairs & Maintenance', monthOffset: 3, day: 14 },
    { payee: 'CME CONFERENCE RCPI', amount: 1200, code: '38', categoryName: 'Training & CPD', monthOffset: 4, day: 20 },
    { payee: 'OFFICE SUPPLIES DIRECT', amount: 380, code: '31', categoryName: 'Stationery & Printing', monthOffset: 5, day: 7 },
    { payee: 'LOCUM DR K FITZGERALD', amount: 3500, code: '7', categoryName: 'Locum Costs', monthOffset: 6, day: 25 },
    { payee: 'LOCUM DR K FITZGERALD', amount: 3500, code: '7', categoryName: 'Locum Costs', monthOffset: 7, day: 25 },
    { payee: 'OFFICE SUPPLIES DIRECT', amount: 510, code: '31', categoryName: 'Stationery & Printing', monthOffset: 9, day: 7 },
  ];

  annualExpenses.forEach((expense, idx) => {
    if (expense.monthOffset >= months.length) return;
    const { year, month } = months[expense.monthOffset];
    const date = makeDate(year, month, expense.day);
    if (!date) return;
    transactions.push({
      id: `demo-annual-${txCounter++}`,
      date,
      details: `${expense.payee} PAYMENT`,
      debit: expense.amount,
      credit: null,
      balance: 65000 - idx * 200,
      category: { code: expense.code, name: expense.categoryName, type: 'expense', section: 'Practice Expenses' }
    });
  });

  // Occasional one-off income
  const oneOffIncome = [
    { source: 'FLU VACCINE REIMBURSEMENT HSE', amount: 4200, code: '140', categoryName: 'Other Income', monthOffset: 2, day: 8 },
    { source: 'INSURANCE REPORT FEES', amount: 850, code: '140', categoryName: 'Other Income', monthOffset: 5, day: 14 },
    { source: 'INSURANCE REPORT FEES', amount: 650, code: '140', categoryName: 'Other Income', monthOffset: 8, day: 22 },
  ];

  oneOffIncome.forEach((income, idx) => {
    if (income.monthOffset >= months.length) return;
    const { year, month } = months[income.monthOffset];
    const date = makeDate(year, month, income.day);
    if (!date) return;
    transactions.push({
      id: `demo-oneoff-income-${txCounter++}`,
      date,
      details: `${income.source}`,
      debit: null,
      credit: income.amount,
      balance: 92000 + idx * 1000,
      category: { code: income.code, name: income.categoryName, type: 'income', section: 'Income' }
    });
  });

  // Unidentified transactions spread across the window
  const unidentifiedItems = [
    { details: 'POS DEBIT 2847 AMAZON', amount: 89.99, monthOffset: 1, day: 11 },
    { details: 'CHQ 001247', amount: 1200.00, monthOffset: 3, day: 16 },
    { details: 'DD REF 4471 UNKNOWN', amount: 156.00, monthOffset: 5, day: 19 },
    { details: 'TRANSFER TO 93847261', amount: 500.00, monthOffset: 7, day: 3 },
    { details: 'POS 8812 ARGOS DUBLIN', amount: 245.00, monthOffset: 9, day: 27 },
  ];

  unidentifiedItems.forEach((item, idx) => {
    if (item.monthOffset >= months.length) return;
    const { year, month } = months[item.monthOffset];
    const date = makeDate(year, month, item.day);
    if (!date) return;
    unidentified.push({
      id: `demo-unid-${idx}`,
      date,
      details: item.details,
      debit: item.amount,
      credit: null,
      balance: 50000 - idx * 200,
      category: null
    });
  });

  // Sort by date descending
  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  unidentified.sort((a, b) => new Date(b.date) - new Date(a.date));

  return { transactions, unidentified };
}

/**
 * Generate GMS panel analysis data for 3 partners.
 * Generates full previous year (12 months) + current year up to today.
 * This enables the year-over-year comparison chart and gives a full year
 * of data to explore in the GMS Overview.
 * Uses exact PCRS_PAYMENT_CATEGORIES and DEDUCTION_CATEGORIES names
 * so data renders correctly in PaymentAnalysis tables and charts.
 */
export function generateDemoGMSPanelData() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const prevYear = currentYear - 1;
  const currentMonth = today.getMonth(); // 0-based
  const panelData = [];

  const partners = [
    { name: 'Dr. Sarah Murphy', doctorNumber: '123456', panelSize: 1850, monthlyVariation: 30 },
    { name: 'Dr. Michael O\'Connor', doctorNumber: '234567', panelSize: 1620, monthlyVariation: 25 },
    { name: 'Dr. Emma Kelly', doctorNumber: '345678', panelSize: 1480, monthlyVariation: 20 }
  ];

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthAbbrev = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Use seeded pseudo-random for consistent demo data across sessions
  let seed = 42;
  const seededRandom = () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const randomInRange = (min, max) => min + seededRandom() * (max - min);
  const round2 = (n) => parseFloat(n.toFixed(2));

  // Build list of year/month pairs: all 12 months of previous year + current year through today
  const yearMonths = [];
  for (let m = 0; m < 12; m++) {
    yearMonths.push({ year: prevYear, month: m });
  }
  for (let m = 0; m <= currentMonth; m++) {
    yearMonths.push({ year: currentYear, month: m });
  }

  yearMonths.forEach(({ year, month }) => {
    // Seasonal flags
    const isFluSeason = month >= 9 && month <= 11; // Oct-Dec
    const isSummerLeave = month >= 5 && month <= 7; // Jun-Aug
    const isWinterPlan = month >= 10 || month <= 2; // Nov-Mar

    partners.forEach((partner, partnerIdx) => {
      const variation = Math.floor(seededRandom() * partner.monthlyVariation) - (partner.monthlyVariation / 2);
      // Slight panel growth from previous year to current year
      const yearGrowth = year === currentYear ? 20 : 0;
      const currentPanelSize = partner.panelSize + variation + yearGrowth;

      // --- Payment categories using exact PCRS names ---

      // Capitation: main payment, ~€5.50/patient/month average across age mix
      const capitation = round2(currentPanelSize * randomInRange(5.20, 5.80));

      // Special Type Consultations / Out of Hours / CDM combined
      const stcOoh = round2(randomInRange(650, 1100));

      // Doctor Vaccinations: flu season spike
      const vaccinations = round2(isFluSeason ? randomInRange(800, 1600) : randomInRange(40, 180));

      // Practice Support Subsidy: fixed quarterly but shown monthly (~€1,900-2,200)
      const practiceSupport = round2(randomInRange(1850, 2250));

      // Locum Expenses: mainly summer months when partners take leave
      const locumExpenses = round2(isSummerLeave ? randomInRange(600, 1400) : (seededRandom() > 0.7 ? randomInRange(100, 400) : 0));

      // Enhanced Capitation for Asthma: ~€250-450 based on register
      const asthmaCapitation = round2(randomInRange(250, 450));

      // Enhanced Capitation for Diabetes: ~€350-550 based on register
      const diabetesCapitation = round2(randomInRange(350, 550));

      // Asthma registration fee: small monthly amount for new registrations
      const asthmaReg = round2(randomInRange(30, 90));

      // Diabetes registration fee: small monthly amount for new registrations
      const diabetesReg = round2(randomInRange(40, 110));

      // National Cervical Screening Programme: ~€200-400/month
      const cervicalScreening = round2(randomInRange(180, 420));

      // Maternity and Infant Care Scheme: ~€120-350/month
      const maternity = round2(randomInRange(120, 350));

      // Winter Plan Support Grant: Nov-Mar only
      const winterPlan = round2(isWinterPlan ? randomInRange(300, 600) : 0);

      // QIV & LAIV vaccine incentives: flu season only
      const qivIncentive = round2(isFluSeason ? randomInRange(200, 500) : 0);
      const laivIncentive = round2(isFluSeason ? randomInRange(100, 300) : 0);

      // Asylum Seeker registration: occasional
      const asylumReg = round2(seededRandom() > 0.5 ? randomInRange(50, 200) : 0);

      // Ukrainian Patient Registration: occasional
      const ukrainianReg = round2(seededRandom() > 0.6 ? randomInRange(30, 150) : 0);

      // Build payments object with exact PCRS_PAYMENT_CATEGORIES names
      const payments = {
        'Special Type/OOH/SS/H1N1': stcOoh,
        'Doctor Vaccinations': vaccinations,
        'Doctor Outbreak Vaccinations': 0,
        'Covid-19 Vaccine Admin Fee': 0,
        'Incentivised payments under Covid Vaccine': 0,
        'Incentivised payments under QIV vaccine': qivIncentive,
        'Incentivised payments under LAIV vaccine': laivIncentive,
        'Capitation Payment/Supplementary Allowance': capitation,
        'Locum Expenses For Leave': locumExpenses,
        'Practice Support Subsidy': practiceSupport,
        'Enhanced Capitation for Asthma': asthmaCapitation,
        'Enhanced Capitation for Diabetes': diabetesCapitation,
        'National Cervical Screening Programme': cervicalScreening,
        'Maternity and Infant Care Scheme': maternity,
        'Winter Plan Support Grant': winterPlan,
        'Asylum Seeker/ Non EU Registration fee': asylumReg,
        'Asthma registration fee': asthmaReg,
        'Diabetes registration fee': diabetesReg,
        'Ukrainian Patient Registration': ukrainianReg
      };

      const totalGross = round2(Object.values(payments).reduce((sum, v) => sum + v, 0));

      // --- Deductions using exact DEDUCTION_CATEGORIES names ---
      const superannuation = round2(totalGross * randomInRange(0.04, 0.06));
      const cdmSuperannuation = round2((asthmaCapitation + diabetesCapitation + asthmaReg + diabetesReg) * randomInRange(0.04, 0.06));
      const withholdingTax = round2(totalGross * 0.25);

      const deductions = {
        'Less Superannuation': superannuation,
        'Less CDM/PP Superannuation': cdmSuperannuation,
        'Less withholding Tax': withholdingTax
      };

      const totalDeductions = round2(superannuation + cdmSuperannuation + withholdingTax);
      const netPayment = round2(totalGross - totalDeductions);

      const entry = {
        doctor: partner.name,
        doctorNumber: partner.doctorNumber,
        paymentDate: `15 ${monthNames[month]} ${year}`,
        period: `${monthAbbrev[month]} ${year}`,
        month: monthAbbrev[month],
        year: year.toString(),
        payments,
        totalGrossPayment: totalGross,
        deductions,
        panelSize: currentPanelSize,
        numberOfClaims: Math.floor(currentPanelSize * 0.8),
        claimsPaid: Math.floor(currentPanelSize * 0.78),
        demographics: {
          total70Plus: Math.floor(currentPanelSize * 0.15),
          male70Plus: Math.floor(currentPanelSize * 0.07),
          female70Plus: Math.floor(currentPanelSize * 0.08),
          nursingHome70Plus: Math.floor(currentPanelSize * 0.02),
          stateMed70Plus: 0,
          total70PlusAllCategories: Math.floor(currentPanelSize * 0.15)
        },
        claims: {
          numberOfClaims: Math.floor(currentPanelSize * 0.8),
          claimsPaid: Math.floor(currentPanelSize * 0.78),
          stcClaims: Math.floor(currentPanelSize * 0.05),
          stcClaimsPaid: Math.floor(currentPanelSize * 0.048)
        },
        leaveData: {
          annualLeaveEntitlement: 30,
          annualLeaveTaken: month * 2,
          annualLeaveBalance: 30 - (month * 2),
          studyLeaveEntitlement: 5,
          studyLeaveTaken: Math.min(month, 3),
          studyLeaveBalance: Math.max(5 - month, 0)
        },
        practiceSummary: partnerIdx === 0 ? {
          totalGrossPayment: round2(totalGross * 3),
          withholdingTax: round2(withholdingTax * 3),
          totalDeductions: round2(totalDeductions * 3),
          netPayment: round2(netPayment * 3)
        } : {
          totalGrossPayment: 0,
          withholdingTax: 0,
          totalDeductions: 0,
          netPayment: 0
        },
        fileName: `PCRS_${partner.name.replace(/\s+/g, '_')}_${monthNames[month]}_${year}.pdf`,
        extractedAt: new Date().toISOString(),
        parsingMethod: 'demo-data'
      };

      panelData.push(entry);
    });
  });

  return panelData;
}

/**
 * Category mapping with full range of GP practice expense types
 */
export const DEMO_CATEGORY_MAPPING = [
  // Income
  { code: '100', name: 'GMS Income', type: 'income', personalization: 'Default', identifiers: ['PCRS GMS'] },
  { code: '110', name: 'Private Patient Fees', type: 'income', personalization: 'Default', identifiers: ['PRIVATE FEES'] },
  { code: '120', name: 'DSP Payments', type: 'income', personalization: 'Default', identifiers: ['DSP PAYMENTS', 'DSP'] },
  { code: '130', name: 'Medserv Fees', type: 'income', personalization: 'Default', identifiers: ['MEDSERV'] },
  { code: '140', name: 'Other Income', type: 'income', personalization: 'Default', identifiers: ['FLU VACCINE REIMBURSEMENT', 'INSURANCE REPORT'] },

  // Staff Costs (Personalized)
  { code: '3.1', name: 'Receptionist - Mary O\'Brien', staffMember: 'Mary O\'Brien', type: 'expense', personalization: 'Personalized', role: '3', identifiers: ['MARY OBRIEN', 'MARY O\'BRIEN', 'OBRIEN MARY'] },
  { code: '3.2', name: 'Receptionist - Sarah Byrne', staffMember: 'Sarah Byrne', type: 'expense', personalization: 'Personalized', role: '3', identifiers: ['SARAH BYRNE', 'BYRNE SARAH'] },
  { code: '3.3', name: 'Receptionist - Tom Brennan', staffMember: 'Tom Brennan', type: 'expense', personalization: 'Personalized', role: '3', identifiers: ['TOM BRENNAN', 'BRENNAN TOM'] },
  { code: '4.1', name: 'Practice Nurse - Aoife Lynch', staffMember: 'Aoife Lynch', type: 'expense', personalization: 'Personalized', role: '4', identifiers: ['AOIFE LYNCH', 'LYNCH AOIFE'] },
  { code: '5.1', name: 'Phlebotomist - John Murphy', staffMember: 'John Murphy', type: 'expense', personalization: 'Personalized', role: '5', identifiers: ['JOHN MURPHY', 'MURPHY JOHN'] },
  { code: '6.1', name: 'Practice Manager - Lisa Chen', staffMember: 'Lisa Chen', type: 'expense', personalization: 'Personalized', role: '6', identifiers: ['LISA CHEN', 'CHEN LISA'] },
  { code: '7.1', name: 'Salaried GP - Dr. James Walsh', staffMember: 'Dr. James Walsh', type: 'expense', personalization: 'Personalized', role: '7', identifiers: ['DR JAMES WALSH', 'WALSH JAMES', 'DR J WALSH'] },

  // Practice Expenses
  { code: '1', name: 'Accountancy', type: 'expense', personalization: 'Default', role: '1', identifiers: ['DELOITTE', 'REVENUE'] },
  { code: '7', name: 'Locum Costs', type: 'expense', personalization: 'Default', role: '7', identifiers: ['LOCUM'] },
  { code: '10', name: 'Bank Charges', type: 'expense', personalization: 'Default', role: '10', identifiers: ['ELAVON', 'BANK CHARGE', 'MERCHANT'] },
  { code: '11', name: 'Cleaning', type: 'expense', personalization: 'Default', role: '11', identifiers: ['CLEANCO', 'CLEAN CO'] },
  { code: '12', name: 'Heat & Light', type: 'expense', personalization: 'Default', role: '12', identifiers: ['ELECTRIC IRELAND', 'ESB', 'GAS NETWORKS', 'IRISH WATER'] },
  { code: '14', name: 'Insurance', type: 'expense', personalization: 'Default', role: '14', identifiers: ['ZURICH', 'ALLIANZ', 'AXA'] },
  { code: '16', name: 'IT Systems & Software', type: 'expense', personalization: 'Default', role: '16', identifiers: ['CLANWILLIAM', 'SOCRATES', 'HEALTHONE'] },
  { code: '17', name: 'Telephone', type: 'expense', personalization: 'Default', role: '17', identifiers: ['VODAFONE', 'THREE', 'EIR'] },
  { code: '22', name: 'Medical Indemnity', type: 'expense', personalization: 'Default', role: '22', identifiers: ['MEDISEC', 'MPS'] },
  { code: '28', name: 'Rent & Rates', type: 'expense', personalization: 'Default', role: '28', identifiers: ['BALLSBRIDGE PROPERTY', 'RENT'] },
  { code: '29', name: 'Repairs & Maintenance', type: 'expense', personalization: 'Default', role: '29', identifiers: ['PROPERTY MAINTENANCE', 'REPAIRS'] },
  { code: '30', name: 'Medical & Surgical Supplies', type: 'expense', personalization: 'Default', role: '30', identifiers: ['MEDISUPPLY', 'MEDICAL SUPPLY'] },
  { code: '31', name: 'Stationery & Printing', type: 'expense', personalization: 'Default', role: '31', identifiers: ['OFFICE SUPPLIES', 'STATIONERY'] },
  { code: '32', name: 'Waste Disposal', type: 'expense', personalization: 'Default', role: '32', identifiers: ['SHREDBANK', 'WASTE'] },
  { code: '35', name: 'Professional Subscriptions', type: 'expense', personalization: 'Default', role: '35', identifiers: ['ICGP', 'MEDICAL COUNCIL'] },
  { code: '38', name: 'Training & CPD', type: 'expense', personalization: 'Default', role: '38', identifiers: ['CME CONFERENCE', 'RCPI', 'TRAINING'] },
];

/**
 * Generate a sample P&L report for the Saved Reports section.
 * Mimics the HTML format produced by ExportReports.jsx.
 */
export function generateDemoSavedReport() {
  const currentYear = new Date().getFullYear();
  const prevYear = currentYear - 1;
  const now = new Date();

  // Build realistic P&L figures from the demo transactions
  const income = { current: 262800, previous: 248400 }; // ~21,900/mo
  const expenses = {
    'Receptionist - Mary O\'Brien': { current: 26400, previous: 25200 },
    'Receptionist - Sarah Byrne': { current: 25200, previous: 24000 },
    'Receptionist - Tom Brennan': { current: 22800, previous: 21600 },
    'Practice Nurse - Aoife Lynch': { current: 40800, previous: 39600 },
    'Phlebotomist - John Murphy': { current: 26400, previous: 25200 },
    'Practice Manager - Lisa Chen': { current: 43200, previous: 42000 },
    'Salaried GP - Dr. James Walsh': { current: 90000, previous: 87000 },
    'Rent & Rates': { current: 50400, previous: 50400 },
    'Heat & Light': { current: 3420, previous: 3180 },
    'Telephone': { current: 1740, previous: 1680 },
    'Cleaning': { current: 5280, previous: 5040 },
    'IT Systems & Software': { current: 4920, previous: 4680 },
    'Insurance': { current: 5400, previous: 5400 },
    'Medical & Surgical Supplies': { current: 2880, previous: 2640 },
    'Waste Disposal': { current: 2400, previous: 2280 },
    'Bank Charges': { current: 1560, previous: 1440 },
    'Medical Indemnity': { current: 4200, previous: 4200 },
    'Accountancy': { current: 3600, previous: 3600 },
    'Professional Subscriptions': { current: 1600, previous: 1600 },
    'Training & CPD': { current: 1200, previous: 1050 },
    'Stationery & Printing': { current: 780, previous: 720 },
    'Locum Costs': { current: 3000, previous: 2400 },
    'Repairs & Maintenance': { current: 1800, previous: 0 }
  };

  const totalExpCurrent = Object.values(expenses).reduce((s, e) => s + e.current, 0);
  const totalExpPrev = Object.values(expenses).reduce((s, e) => s + e.previous, 0);
  const netCurrent = income.current - totalExpCurrent;
  const netPrev = income.previous - totalExpPrev;

  const fmt = (n) => n.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const expenseRows = Object.entries(expenses)
    .filter(([, v]) => v.current > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cat, v]) => `<tr><td>${cat}</td><td class="amount">${fmt(v.current)}</td><td class="amount">${fmt(v.previous)}</td></tr>`)
    .join('');

  const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>GP Practice - Year to Date Profit &amp; Loss Statement</title>
<style>body{font-family:Arial,sans-serif;margin:20px;font-size:11px}.header{text-align:center;margin-bottom:30px}.draft-badge{display:inline-block;background-color:${COLORS.expenseColor};color:${COLORS.white};padding:4px 12px;border-radius:4px;font-size:10px;font-weight:bold;margin-left:10px;vertical-align:middle}.pl-table{width:100%;border-collapse:collapse}.pl-table th,.pl-table td{border:1px solid #ddd;padding:6px;text-align:left}.pl-table th{background-color:${COLORS.bgPage};font-weight:bold}.amount{text-align:right;font-family:monospace}.total-line{border-top:2px solid #000;font-weight:bold}.section-header{background-color:#e6f3ff;font-weight:bold}.notes{margin-top:30px;padding:15px;background-color:#fff9e6;border-left:4px solid #ffc107}.notes h4{margin:0 0 10px 0;color:#856404}.notes ul{margin:5px 0;padding-left:20px}.notes li{margin:5px 0;color:#856404}.notes .important{font-weight:bold;color:#d32f2f}</style></head>
<body><div class="header"><h2>Ballsbridge Medical Centre</h2><h3>Year to Date Profit &amp; Loss Statement<span class="draft-badge">DRAFT</span></h3><p>For the period 1st January to ${now.toLocaleDateString('en-IE')} for ${currentYear} and ${prevYear}</p></div>
<table class="pl-table"><thead><tr><th style="width:60%">Description</th><th style="width:20%" class="amount">${currentYear} \u20ac</th><th style="width:20%" class="amount">${prevYear} \u20ac</th></tr></thead>
<tbody><tr class="section-header"><td><strong>INCOME</strong></td><td class="amount"></td><td class="amount"></td></tr>
<tr><td>Fee income</td><td class="amount">${fmt(income.current)}</td><td class="amount">${fmt(income.previous)}</td></tr>
<tr class="total-line"><td><strong>Total Income</strong></td><td class="amount"><strong>${fmt(income.current)}</strong></td><td class="amount"><strong>${fmt(income.previous)}</strong></td></tr>
<tr class="section-header"><td><strong>EXPENDITURE</strong></td><td class="amount"></td><td class="amount"></td></tr>
${expenseRows}
<tr class="total-line"><td><strong>Total Expenditure</strong></td><td class="amount"><strong>(${fmt(totalExpCurrent)})</strong></td><td class="amount"><strong>(${fmt(totalExpPrev)})</strong></td></tr>
<tr class="total-line" style="background-color:#e6f3ff"><td><strong>Net Divisible Profit</strong></td><td class="amount"><strong>${fmt(netCurrent)}</strong></td><td class="amount"><strong>${fmt(netPrev)}</strong></td></tr>
</tbody></table>
<div class="notes"><h4>\u26a0\ufe0f DRAFT REPORT - Important Notes:</h4><p class="important">This report is a DRAFT and should not be used for official submissions without review by a qualified accountant.</p>
<ul><li><strong>GMS Statements:</strong> \u2713 GMS statements uploaded for ${currentYear}</li>
<li><strong>Income Figure:</strong> This represents NET INCOME as recorded in bank transactions (after withholding tax deduction).</li>
<li><strong>Classification:</strong> Some transactions may be partially classified or unclassified. Review the transaction list for accuracy.</li>
<li><strong>Period:</strong> This is a YEAR-TO-DATE report. Full year figures will differ.</li></ul>
<p style="margin-top:10px;font-style:italic">Please review all figures with your accountant before using for tax returns or official purposes.</p></div>
<div style="margin-top:30px;font-size:10px;color:#666">Generated on ${now.toLocaleDateString('en-IE')} by sl[Ai]nte.Finance</div></body></html>`;

  return [{
    id: `report-demo-${now.getTime()}`,
    title: `YTD P&L - ${currentYear} vs ${prevYear}`,
    generatedDate: new Date(now.getTime() - 86400000).toISOString(),
    year: currentYear,
    htmlContent
  }];
}

/**
 * Generate sample tasks for the Tasks Widget.
 * Returns { actionItems, financialTasks } to be saved into the practice profile.
 */
export function generateDemoTasks() {
  const now = new Date();
  const currentYear = now.getFullYear();

  // GMS Action Items (from Health Check recommendations)
  const actionItems = [
    {
      id: 'action_demo_1',
      recommendationId: 'rec_cdm_enrolment',
      title: 'Enrol eligible diabetes patients in CDM programme',
      description: '42 patients with Type 2 Diabetes on your register may be eligible for CDM quarterly reviews. Each enrolment generates structured review fees.',
      category: 'cdm',
      type: 'priority',
      potentialValue: 8400,
      effort: 'Medium',
      assignedTo: 'Dr. Sarah Murphy',
      status: 'pending',
      dueDate: new Date(currentYear, now.getMonth() + 1, 15).toISOString(),
      createdDate: new Date(now.getTime() - 7 * 86400000).toISOString(),
      completedDate: null,
      notes: '',
      showOnDashboard: true
    },
    {
      id: 'action_demo_2',
      recommendationId: 'rec_cervical_screening',
      title: 'Review cervical screening uptake rates',
      description: 'Current screening rate is below the national target of 80%. Increasing uptake by 10% could generate additional screening fees.',
      category: 'screening',
      type: 'growth',
      potentialValue: 3200,
      effort: 'Low',
      assignedTo: 'Aoife Lynch',
      status: 'in_progress',
      dueDate: new Date(currentYear, now.getMonth(), 28).toISOString(),
      createdDate: new Date(now.getTime() - 14 * 86400000).toISOString(),
      completedDate: null,
      notes: 'Aoife pulling patient list from HealthOne',
      showOnDashboard: true
    },
    {
      id: 'action_demo_3',
      recommendationId: 'rec_practice_support',
      title: 'Verify practice support subsidy staff hours',
      description: 'Ensure all eligible staff hours are claimed under the Practice Support Subsidy. Current claims may not reflect actual hours worked.',
      category: 'practice_support',
      type: 'priority',
      potentialValue: 2400,
      effort: 'Low',
      assignedTo: 'Lisa Chen',
      status: 'pending',
      dueDate: new Date(currentYear, now.getMonth() + 1, 1).toISOString(),
      createdDate: new Date(now.getTime() - 5 * 86400000).toISOString(),
      completedDate: null,
      notes: '',
      showOnDashboard: true
    }
  ];

  // Financial Tasks
  const financialTasks = [
    {
      id: 'fin_task_demo_1',
      title: 'Categorize unidentified transactions',
      description: '5 transactions need to be categorized for accurate financial reporting.',
      category: 'transactions',
      priority: 'medium',
      assignedTo: null,
      status: 'pending',
      dueDate: null,
      createdDate: new Date(now.getTime() - 2 * 86400000).toISOString(),
      completedDate: null,
      autoGenerated: true,
      actionLink: 'transactions',
      metadata: {}
    },
    {
      id: 'fin_task_demo_2',
      title: `Review ${new Date(currentYear, now.getMonth() - 1, 1).toLocaleString('default', { month: 'long' })} expenses`,
      description: 'Monthly expense review recommended. Check for unusual charges or missing categorizations.',
      category: 'reporting',
      priority: 'medium',
      assignedTo: null,
      status: 'pending',
      dueDate: new Date(currentYear, now.getMonth(), 14).toISOString(),
      createdDate: new Date(now.getTime() - 3 * 86400000).toISOString(),
      completedDate: null,
      autoGenerated: false,
      actionLink: 'export',
      metadata: {}
    },
    {
      id: 'fin_task_demo_3',
      title: 'Upload latest bank statements',
      description: 'Keep financial data current by uploading recent bank statements.',
      category: 'upload',
      priority: 'low',
      assignedTo: null,
      status: 'pending',
      dueDate: null,
      createdDate: new Date(now.getTime() - 86400000).toISOString(),
      completedDate: null,
      autoGenerated: true,
      actionLink: 'upload',
      metadata: {}
    }
  ];

  return { actionItems, financialTasks };
}

/**
 * Pre-seeded Finn chat conversation to showcase the AI assistant
 */
export function generateDemoChatData() {
  const now = new Date();
  const chatId = `chat_demo_${now.getTime()}`;

  return {
    chats: [{
      id: chatId,
      title: 'Practice Financial Overview',
      messages: [
        {
          type: 'user',
          content: 'Hi Finn, can you give me a quick overview of how the practice is doing financially?',
          timestamp: new Date(now.getTime() - 3600000).toISOString()
        },
        {
          type: 'assistant',
          content: 'Good morning! Here\'s a snapshot of Ballsbridge Medical Centre\'s finances:\n\n**Income** is tracking well with GMS payments averaging around \u20ac15,000/month across the three partners, plus private fees and DSP payments bringing your total monthly income to approximately \u20ac21,900.\n\n**Staff costs** are your largest expense at roughly \u20ac24,290/month (including Dr. Walsh\'s salary), followed by rent at \u20ac4,200/month.\n\n**Key observation:** Your staff-to-income ratio is healthy for a practice of this size. The three receptionists provide good coverage across the week.\n\nWould you like me to generate a detailed P&L report, or would you prefer to look at a specific area like GMS trends or expense breakdown?',
          timestamp: new Date(now.getTime() - 3500000).toISOString()
        },
        {
          type: 'user',
          content: 'What about the GMS Health Check - are we claiming everything we should?',
          timestamp: new Date(now.getTime() - 3000000).toISOString()
        },
        {
          type: 'assistant',
          content: 'Great question! Based on your panel data and the Health Check analysis:\n\n**Combined panel size:** ~4,950 patients across the 3 partners\n\n**Areas performing well:**\n- Capitation claims are consistent month-to-month\n- Items of Service claims are being submitted regularly\n\n**Potential opportunities:**\n- With 285 Type 2 Diabetes patients and 210 asthma patients on your registers, make sure all eligible patients are enrolled in the **CDM Treatment Programme** - each enrolled patient generates quarterly structured review fees\n- Your **Prevention Programme** numbers (380 hypertension, 65 pre-diabetes) suggest good screening, but check that all eligible patients have been formally registered\n- **Practice Support** allowances should be reviewed against your actual staff hours to ensure you\'re claiming the full entitlement\n\nYou can run the full GMS Health Check from the Health Check tab to see the detailed calculations. Would you like me to explain any of these programmes in more detail?',
          timestamp: new Date(now.getTime() - 2900000).toISOString()
        }
      ],
      artifacts: [],
      created_at: new Date(now.getTime() - 3600000).toISOString(),
      updated_at: new Date(now.getTime() - 2900000).toISOString(),
      is_setup: false
    }],
    currentChatId: chatId
  };
}

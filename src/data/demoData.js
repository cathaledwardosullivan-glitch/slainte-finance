/**
 * Demo Data for Sláinte Finance
 * Used when users choose "Explore with Demo Data" during onboarding
 */

import { createUnifiedProfile } from './practiceProfileSchemaV2';

export const DEMO_PROFILE = {
  ...createUnifiedProfile(),
  practiceDetails: {
    practiceName: 'Ballsbridge Medical Centre',
    locations: ['Ballsbridge', 'Dublin 4'],
    website: 'https://example-practice.ie',
    accountant: 'Deloitte',
    yearEndDate: '31-12',
    setupComplete: true,
    setupCompletedAt: new Date()
  },
  gps: {
    partners: [
      { name: 'Dr. Sarah Murphy', email: 'sarah@example.ie' },
      { name: 'Dr. Michael O\'Connor', email: 'michael@example.ie' },
      { name: 'Dr. Emma Kelly', email: 'emma@example.ie' }
    ],
    salaried: [
      { name: 'Dr. James Walsh', email: 'james@example.ie' }
    ]
  },
  staff: [
    { name: 'Mary O\'Brien', role: 'Reception' },
    { name: 'Sarah Byrne', role: 'Reception' },
    { name: 'Tom Brennan', role: 'Reception' },
    { name: 'Aoife Lynch', role: 'Practice Nurse' },
    { name: 'John Murphy', role: 'Phlebotomist' },
    { name: 'Lisa Chen', role: 'Practice Manager' }
  ],
  metadata: {
    setupComplete: true,
    setupCompletedAt: new Date(),
    isDemoMode: true
  }
};

// Generate sample transactions
export function generateDemoTransactions() {
  const transactions = [];
  const currentYear = new Date().getFullYear(); // Use current year
  const startDate = new Date(currentYear, 0, 1);
  const today = new Date();

  // Staff payments (monthly)
  const staffPayments = [
    { name: 'MARY OBRIEN', amount: 2400, code: '3.1', categoryName: 'Receptionist - Mary O\'Brien' },
    { name: 'SARAH BYRNE', amount: 2350, code: '3.2', categoryName: 'Receptionist - Sarah Byrne' },
    { name: 'TOM BRENNAN', amount: 2300, code: '3.3', categoryName: 'Receptionist - Tom Brennan' },
    { name: 'AOIFE LYNCH', amount: 3200, code: '4.1', categoryName: 'Practice Nurse - Aoife Lynch' },
    { name: 'JOHN MURPHY', amount: 2800, code: '5.1', categoryName: 'Phlebotomist - John Murphy' },
    { name: 'LISA CHEN', amount: 4500, code: '6.1', categoryName: 'Practice Manager - Lisa Chen' }
  ];

  for (let month = 0; month < 10; month++) {
    const date = new Date(currentYear, month, 28);
    if (date > today) break;

    staffPayments.forEach((staff, idx) => {
      transactions.push({
        id: `demo-staff-${month}-${idx}`,
        date: date.toISOString().split('T')[0],
        details: `${staff.name} SALARY ${['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT'][month]}`,
        debit: staff.amount,
        credit: null,
        balance: 50000 - (month * 1000 + idx * 100),
        category: {
          code: staff.code,
          name: staff.categoryName,
          type: 'expense',
          section: 'Staff Costs'
        }
      });
    });
  }

  // Recurring expenses
  const recurringExpenses = [
    { payee: 'ELECTRIC IRELAND', amount: 450, code: '12', categoryName: 'Heat & Light', day: 5 },
    { payee: 'VODAFONE', amount: 180, code: '17', categoryName: 'Telephone', day: 10 },
    { payee: 'CLEANCO LTD', amount: 320, code: '11', categoryName: 'Cleaning', day: 15 },
    { payee: 'MEDISEC', amount: 2200, code: '22', categoryName: 'Medical Indemnity', day: 1, quarterly: true },
    { payee: 'REVENUE', amount: 1500, code: '1', categoryName: 'Accountancy', day: 20, quarterly: true }
  ];

  for (let month = 0; month < 10; month++) {
    recurringExpenses.forEach((expense, idx) => {
      if (expense.quarterly && month % 3 !== 0) return;

      const date = new Date(currentYear, month, expense.day);
      if (date > today) return;

      transactions.push({
        id: `demo-expense-${month}-${idx}`,
        date: date.toISOString().split('T')[0],
        details: `${expense.payee} PAYMENT`,
        debit: expense.amount,
        credit: null,
        balance: 45000 - (month * 500 + idx * 50),
        category: {
          code: expense.code,
          name: expense.categoryName,
          type: 'expense',
          section: 'Practice Expenses'
        }
      });
    });
  }

  // Income transactions
  const incomeTypes = [
    { source: 'PCRS GMS', amount: 15000, code: '100', categoryName: 'GMS Income', day: 12 },
    { source: 'PRIVATE FEES', amount: 3500, code: '110', categoryName: 'Private Patient Fees', day: 25 }
  ];

  for (let month = 0; month < 10; month++) {
    incomeTypes.forEach((income, idx) => {
      const date = new Date(currentYear, month, income.day);
      if (date > today) return;

      transactions.push({
        id: `demo-income-${month}-${idx}`,
        date: date.toISOString().split('T')[0],
        details: `${income.source} LODGMENT`,
        debit: null,
        credit: income.amount,
        balance: 60000 + (month * 2000 + idx * 500),
        category: {
          code: income.code,
          name: income.categoryName,
          type: 'income',
          section: 'Income'
        }
      });
    });
  }

  // Sort by date
  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

  return transactions;
}

// Generate sample GMS panel analysis data
export function generateDemoGMSPanelData() {
  const currentYear = new Date().getFullYear();
  const today = new Date();
  const panelData = [];

  // GMS partners from demo profile
  const partners = [
    { name: 'Dr. Sarah Murphy', doctorNumber: '123456', panelSize: 1850, monthlyVariation: 30 },
    { name: 'Dr. Michael O\'Connor', doctorNumber: '234567', panelSize: 1620, monthlyVariation: 25 },
    { name: 'Dr. Emma Kelly', doctorNumber: '345678', panelSize: 1480, monthlyVariation: 20 }
  ];

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthAbbrev = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Generate 10 months of data for each partner
  for (let month = 0; month < 10; month++) {
    const date = new Date(currentYear, month, 15);
    if (date > today) break;

    partners.forEach((partner, partnerIdx) => {
      // Add some realistic variation to panel size
      const variation = Math.floor(Math.random() * partner.monthlyVariation) - (partner.monthlyVariation / 2);
      const currentPanelSize = partner.panelSize + variation;

      // Calculate payments based on panel size and typical rates
      const capitation = currentPanelSize * 42.50; // Average capitation per patient
      const items = Math.floor(currentPanelSize * 0.8) * 2.5; // Items of service
      const consultations = Math.floor(currentPanelSize * 0.15) * 45; // Out of hours
      const otherPayments = Math.random() * 500 + 200; // Misc payments

      const totalGross = capitation + items + consultations + otherPayments;
      const withholdingTax = totalGross * 0.25; // 25% withholding
      const otherDeductions = Math.random() * 300 + 100;
      const netPayment = totalGross - withholdingTax - otherDeductions;

      const entry = {
        doctor: partner.name,
        doctorNumber: partner.doctorNumber,
        paymentDate: `15 ${monthNames[month]} ${currentYear}`,
        period: `${monthAbbrev[month]} ${currentYear}`,
        month: monthNames[month],
        year: currentYear.toString(),
        payments: {
          'Capitation': parseFloat(capitation.toFixed(2)),
          'Items of Service': parseFloat(items.toFixed(2)),
          'Out of Hours': parseFloat(consultations.toFixed(2)),
          'Other Payments': parseFloat(otherPayments.toFixed(2))
        },
        totalGrossPayment: parseFloat(totalGross.toFixed(2)),
        deductions: {
          'Withholding Tax': parseFloat(withholdingTax.toFixed(2)),
          'Other Deductions': parseFloat(otherDeductions.toFixed(2))
        },
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
        // Practice-wide summary (only on first partner's data each month to avoid duplication)
        practiceSummary: partnerIdx === 0 ? {
          totalGrossPayment: parseFloat((totalGross * 3).toFixed(2)), // Sum of all 3 partners (approximate)
          withholdingTax: parseFloat((withholdingTax * 3).toFixed(2)),
          totalDeductions: parseFloat(((withholdingTax + otherDeductions) * 3).toFixed(2)),
          netPayment: parseFloat((netPayment * 3).toFixed(2))
        } : {
          totalGrossPayment: 0,
          withholdingTax: 0,
          totalDeductions: 0,
          netPayment: 0
        },
        fileName: `PCRS_${partner.name.replace(/\s+/g, '_')}_${monthNames[month]}_${currentYear}.pdf`,
        extractedAt: new Date().toISOString(),
        parsingMethod: 'demo-data'
      };

      panelData.push(entry);
    });
  }

  return panelData;
}

export const DEMO_CATEGORY_MAPPING = [
  // Income
  { code: '100', name: 'GMS Income', type: 'income', personalization: 'Default', identifiers: [] },
  { code: '110', name: 'Private Patient Fees', type: 'income', personalization: 'Default', identifiers: [] },

  // Staff Costs (Personalized)
  { code: '3.1', name: 'Receptionist - Mary O\'Brien', staffMember: 'Mary O\'Brien', type: 'expense', personalization: 'Personalized', role: '3', identifiers: ['MARY OBRIEN', 'MARY O\'BRIEN', 'OBRIEN MARY'] },
  { code: '3.2', name: 'Receptionist - Sarah Byrne', staffMember: 'Sarah Byrne', type: 'expense', personalization: 'Personalized', role: '3', identifiers: ['SARAH BYRNE', 'BYRNE SARAH'] },
  { code: '3.3', name: 'Receptionist - Tom Brennan', staffMember: 'Tom Brennan', type: 'expense', personalization: 'Personalized', role: '3', identifiers: ['TOM BRENNAN', 'BRENNAN TOM'] },
  { code: '4.1', name: 'Practice Nurse - Aoife Lynch', staffMember: 'Aoife Lynch', type: 'expense', personalization: 'Personalized', role: '4', identifiers: ['AOIFE LYNCH', 'LYNCH AOIFE'] },
  { code: '5.1', name: 'Phlebotomist - John Murphy', staffMember: 'John Murphy', type: 'expense', personalization: 'Personalized', role: '5', identifiers: ['JOHN MURPHY', 'MURPHY JOHN'] },
  { code: '6.1', name: 'Practice Manager - Lisa Chen', staffMember: 'Lisa Chen', type: 'expense', personalization: 'Personalized', role: '6', identifiers: ['LISA CHEN', 'CHEN LISA'] },

  // Expenses
  { code: '1', name: 'Accountancy', type: 'expense', personalization: 'Default', role: '1', identifiers: ['REVENUE'] },
  { code: '11', name: 'Cleaning', type: 'expense', personalization: 'Default', role: '11', identifiers: ['CLEANCO', 'CLEAN CO'] },
  { code: '12', name: 'Heat & Light', type: 'expense', personalization: 'Default', role: '12', identifiers: ['ELECTRIC IRELAND', 'ESB', 'GAS NETWORKS'] },
  { code: '17', name: 'Telephone', type: 'expense', personalization: 'Default', role: '17', identifiers: ['VODAFONE', 'THREE', 'EIR'] },
  { code: '22', name: 'Medical Indemnity', type: 'expense', personalization: 'Default', role: '22', identifiers: ['MEDISEC', 'MPS'] },
  { code: '30', name: 'Medical & Surgical Supplies', type: 'expense', personalization: 'Default', role: '30', identifiers: [] }
];

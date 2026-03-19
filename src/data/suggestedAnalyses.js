/**
 * Suggested Analyses — Curated prompt cards for the Advanced Insights tab.
 * Each card triggers a Finn report generation via the AnalysisPreviewModal.
 */
import COLORS from '../utils/colors';

export const ANALYSIS_CATEGORIES = [
  { id: 'overview', label: 'Business Overview', bannerTitle: 'Business Optimisation', color: COLORS.slainteBlue, bannerQuestion: 'How healthy is my practice overall?' },
  { id: 'gms', label: 'GMS & PCRS', bannerTitle: 'GMS Maximiser', color: COLORS.expenseColor, bannerQuestion: 'Am I getting all my PCRS entitlements?' },
  { id: 'growth', label: 'Growth & Strategy', bannerTitle: 'Growth & Strategy', color: COLORS.accentPurple, bannerQuestion: 'Where are my growth opportunities?' },
  { id: 'costs', label: 'Costs & Cash Flow', bannerTitle: 'Spending Insights', color: COLORS.incomeColor, bannerQuestion: "What's costing me the most to run?" },
  { id: 'tax', label: 'Tax & Compliance', bannerTitle: 'Tax & Compliance', color: COLORS.warning, bannerQuestion: 'Am I tax-efficient and compliant?' }
];

export const DATA_SOURCE_LABELS = {
  transactions: 'Transaction Data',
  paymentAnalysisData: 'GMS Payment Statements'
};

/**
 * dataInputs — optional fields shown in the AnalysisPreviewModal before generation.
 * Each input maps to a profile storage path for pre-fill and save-back.
 * Only reports that need operational data should include this.
 */
export const OPERATIONAL_DATA_INPUTS = [
  {
    key: 'privateConsultationFee',
    label: 'Private consultation fee',
    unit: '€',
    placeholder: '60',
    profilePath: 'privatePatients.averageConsultationFee',
    type: 'number',
    min: 0,
    max: 500,
  },
  {
    key: 'gpClinicalHoursPerWeek',
    label: 'Clinical hours per GP per week',
    unit: 'hrs',
    placeholder: '40',
    profilePath: 'operations.gpClinicalHoursPerWeek',
    type: 'number',
    min: 1,
    max: 80,
  },
  {
    key: 'workingWeeksPerYear',
    label: 'Working weeks per year',
    unit: 'wks',
    placeholder: '48',
    profilePath: 'operations.workingWeeksPerYear',
    type: 'number',
    min: 20,
    max: 52,
  },
  {
    key: 'appointmentDuration',
    label: 'Appointment duration',
    unit: 'min',
    placeholder: '15',
    profilePath: 'operations.appointmentDuration',
    type: 'number',
    min: 5,
    max: 60,
  }
];

export const REPORT_TYPE_LABELS = {
  strategic: { label: 'Deep Analysis', sublabel: 'Uses Opus — more thorough', color: COLORS.chartViolet },
  standard: { label: 'Standard Analysis', sublabel: 'Uses Sonnet — faster', color: COLORS.slainteBlue }
};

export const SUGGESTED_ANALYSES = [

  // ─── Practice Overview ───────────────────────────────────────────────

  {
    id: 'income-sources',
    categoryId: 'overview',
    title: 'Income Source Analysis',
    shortQuestion: 'Where does my income actually come from?',
    description: 'See exactly where your practice revenue comes from — and how exposed you are to any single income stream.',
    details: [
      'Break down total income: GMS capitation, CDM, STCs, cervical screening, private fees, other',
      'Calculate your public vs private income split',
      'Flag concentration risk if one stream dominates',
      'Track how the mix has shifted over time'
    ],
    prompt: `Produce an Income Source Analysis for this practice.

CALCULATIONS TO PERFORM:
1. From the income breakdown, group all income into these buckets: (a) GMS/PCRS payments (any category mentioning PCRS, GMS, capitation, HSE), (b) Private/patient fees (consultations, procedures not via GMS), (c) State contracts (DSP, medicals, insurance reports), (d) Other income. Show euro amounts and percentages.
2. If GMS gross payment data is available, break it further into: capitation, CDM, cervical screening, STCs, practice support, leave payments, other PCRS.
3. Calculate the year-on-year change in each bucket. Which income streams are growing vs declining?
4. Flag if any single stream exceeds 60% of total income — this is a concentration risk.

CHART: Create a donut/pie chart showing the income split by source. Use palette colours in series order (#4A90E2, #4ECDC4, #FF6B6B, #7C6EBF, #F9A826, #FFD23C, #8B5CF6, #EC4899). Use a second line chart showing how the top 3 income streams have trended month-by-month if multi-month data is available.

INSIGHT: What does this mix tell the GP about their practice's financial resilience? If GMS is dominant, note the implications (income subject to government policy). If private is dominant, note the implications (vulnerable to competition/demographics). Recommend specific diversification actions.`,
    reportType: 'strategic',
    requiresData: ['transactions'],
    dataSources: ['transactions', 'paymentAnalysisData'],
    contextProfile: {
      incomeCategories: 'all',
      expenseCategories: 'top',
      gmsData: 'full',
      monthlyTrends: true,
      previousYear: true,
      contextNotes: 'Include ALL income sources regardless of size. Compare net bank income vs gross PCRS payments.'
    }
  },
  {
    id: 'operating-cost',
    categoryId: 'overview',
    title: 'Practice Operating Cost',
    shortQuestion: 'What does it cost per hour to stay open?',
    description: 'What does it cost per hour to keep your practice open? The number most GPs have never calculated.',
    details: [
      'Calculate your total fixed costs (rent, salaries, insurance, utilities)',
      'Derive your cost-per-clinical-hour using GP working hours',
      'Calculate the break-even number of consultations per day',
      'Compare fixed vs variable cost structure'
    ],
    prompt: `Produce a Practice Operating Cost report.

CALCULATIONS TO PERFORM:
1. FIXED COSTS: Sum all expenses that recur regardless of patient volume — rent/rates, staff salaries (all non-GP staff), insurance, utilities, software/IT, professional fees, loan repayments. Show the monthly and annual total.
2. VARIABLE COSTS: Sum expenses that scale with activity — medical supplies, locum fees, lab costs. Show monthly and annual.
3. TOTAL OPERATING COST: Fixed + Variable. Show monthly average.
4. COST PER CLINICAL HOUR: Look in the PRACTICE OPERATIONS section of the practice context for "GP Clinical Hours per Week" and "Working Weeks per Year". Use those exact values — do NOT assume defaults. If they are not available, state that you cannot calculate this figure without knowing GP hours and ask the user to provide them. Formula: Total operating cost / (number of GPs x weekly hours x working weeks).
5. BREAK-EVEN CONSULTATIONS: Look in the PRACTICE OPERATIONS section for "Private Consultation Fee". Use that exact value — do NOT assume a default fee. If not available, state you need the consultation fee to calculate break-even. Formula: (Daily operating cost - daily GMS income) / consultation fee = consultations needed per day.
6. FIXED COST RATIO: Fixed costs as a percentage of total costs. Above 80% means the practice has very little flexibility to cut costs in a downturn.
7. SANITY CHECKS: If employer PRSI exceeds 15% of the salary amount it relates to, flag this as unusual and worth verifying with the practice accountant (the standard employer PRSI rate is 11.05%).

CHART: A stacked bar chart showing fixed vs variable costs by month. Use #4A90E2 (blue) for fixed and #F9A826 (marigold) for variable costs.

CONTEXT: Frame this as "what it costs to turn the lights on each morning". Most GPs have never seen this number. It directly informs whether their consultation fees are set correctly, whether they can absorb a quiet month, and whether hiring makes financial sense.`,
    reportType: 'strategic',
    requiresData: ['transactions'],
    dataSources: ['transactions'],
    dataInputs: OPERATIONAL_DATA_INPUTS,
    contextProfile: {
      incomeCategories: 'top',
      expenseCategories: 'all',
      gmsData: 'none',
      monthlyTrends: true,
      previousYear: true,
      contextNotes: 'Focus on classifying expenses as fixed vs variable costs.'
    }
  },
  {
    id: 'practice-health',
    categoryId: 'overview',
    title: 'Practice Health Check',
    shortQuestion: 'Is my practice financially healthy?',
    description: 'A composite snapshot: is your practice financially healthy? Red/amber/green across the key metrics.',
    details: [
      'Score your profit margin, income diversity, cost trajectory, and cash stability',
      'Present a simple red/amber/green dashboard of key indicators',
      'Identify the 1-2 areas dragging performance down most',
      'Recommend the single highest-impact action to take'
    ],
    prompt: `Produce a Practice Health Check — a composite financial health assessment.

SCORE THESE INDICATORS (rate each Red / Amber / Green with a brief justification):

1. PROFIT MARGIN: Green if above 40%, Amber if 25-40%, Red if below 25%. Use the net profit / gross income ratio.
2. INCOME TREND: Green if income grew year-on-year, Amber if flat (within 3%), Red if declined.
3. EXPENSE CONTROL: Green if expenses grew slower than income, Amber if at the same rate, Red if faster.
4. STAFF COST RATIO: Green if staff costs (all salary/wage categories) are below 45% of income, Amber if 45-55%, Red if above 55%.
5. CASH FLOW STABILITY: Look at the monthly trends. Green if no month has expenses exceeding income by more than 20%, Amber if 1-2 months breach this, Red if 3+ months.
6. INCOME DIVERSITY: Green if no single income source exceeds 60% of total, Amber if 60-75%, Red if above 75%.
7. GMS OPTIMISATION (if GMS data available): Green if CDM, cervical screening, and STC claims appear active, Amber if one area looks underutilised, Red if multiple areas show gaps.

OVERALL ASSESSMENT: Summarise with a single headline ("Your practice is in strong financial health" / "Your practice has some areas to address" / "Your practice needs attention on several fronts").

PRIORITY ACTION: Based on the red/amber areas, recommend the single most impactful thing the GP should focus on first, with a specific next step.

FORMAT: Present the indicators in a clean table. Keep the narrative short — this report is about the dashboard, not the deep dive. Point the user to other specific reports (by name) for each area that needs attention.`,
    reportType: 'strategic',
    requiresData: ['transactions'],
    dataSources: ['transactions', 'paymentAnalysisData'],
    contextProfile: {
      incomeCategories: 'all',
      expenseCategories: 'all',
      gmsData: 'summary',
      monthlyTrends: true,
      previousYear: true,
      contextNotes: 'Comprehensive overview — all financial dimensions needed for scoring.'
    }
  },

  // ─── GMS & PCRS ─────────────────────────────────────────────────────

  {
    id: 'gms-optimisation',
    categoryId: 'gms',
    title: 'GMS Optimisation Summary',
    shortQuestion: 'Am I leaving GMS money on the table?',
    description: 'A polished summary of your GMS Health Check findings — unclaimed income, priority actions, and growth opportunities.',
    showSectionStatus: true,
    forceFullGMSContext: true,
    prompt: `Produce a GMS Optimisation Summary for this practice.

You are SUMMARISING the results of the app's GMS Health Check analysis, which has already been computed. The detailed results are in the GMS DATA section of the context. Use those EXACT figures — do NOT recalculate, estimate, or use benchmarks.

STRUCTURE:
1. HEADLINE: One sentence stating the total unclaimed income identified and the number of Health Check sections analysed. If not all sections are complete, note this (e.g. "Based on 4 of 6 Health Check areas analysed, your practice has an estimated €X in recoverable GMS income").

2. PRIORITY ACTIONS TABLE: From the priority recommendations in the context, create a table with columns: Priority, Action, Category, Estimated Value, Effort. Order by value (highest first). Use the exact euro figures from the recommendations.

3. SECTION SUMMARIES: For each area that HAS data in the context, write 2-3 sentences summarising the key finding and the specific action. Only cover sections where the context provides actual analysis results:
   - Capitation & Registration
   - Practice Support Subsidy
   - Leave Entitlements
   - Chronic Disease Management (CDM)
   - Cervical Screening
   - Special Type Consultations (STCs)

4. INCOMPLETE SECTIONS: If any sections are noted as not yet completed or have no data in the context, list them under a "Not Yet Analysed" heading. State: "Completing these sections in the GMS Health Check may reveal additional opportunities." Do NOT estimate, guess, or use national benchmarks for incomplete sections.

5. GROWTH OPPORTUNITIES: Separately from priority actions (which are administrative fixes), list the growth opportunities from the context with their potential values.

6. NEXT STEPS: 3-5 specific, actionable next steps in priority order.

CHART: A horizontal bar chart showing unclaimed/recoverable income by category (only for sections with data). Use #10B981 (green) for recoverable amounts. Use the exact values from the analysis.

CRITICAL RULES:
- Every number in this report MUST come from the GMS Health Check analysis in the context
- Do NOT invent STC codes, benchmark rates, or national averages
- Do NOT estimate panel sizes — use the exact figures from the analysis
- If the context shows €0 unclaimed for a section, report it as "no issues identified"
- If a section has no data at all, put it under "Not Yet Analysed" — do NOT fill with estimates
- This report should read as a polished executive summary suitable for printing and sharing with a practice manager`,
    reportType: 'standard',
    requiresData: ['healthCheckPartial'],
    dataSources: ['paymentAnalysisData'],
    contextProfile: {
      incomeCategories: 'none',
      expenseCategories: 'none',
      gmsData: 'full',
      monthlyTrends: false,
      previousYear: false,
      contextNotes: 'This report summarises the GMS Health Check analysis. Use ONLY the pre-computed figures from the GMS context — do not estimate or calculate independently.'
    }
  },
  {
    id: 'gms-trends',
    categoryId: 'gms',
    title: 'PCRS Payment Trends',
    shortQuestion: 'How are my GMS payments trending?',
    description: 'How have your GMS payment streams changed over time? Spot dropped claims and shifting income.',
    details: [
      'Plot each PCRS payment category month by month',
      'Flag schemes that suddenly drop (likely missed claims)',
      'Identify growing vs declining income streams',
      'Compare per-panel performance in multi-GP practices'
    ],
    prompt: `Analyse the trends in this practice's PCRS/GMS payments over time.

CALCULATIONS TO PERFORM:
1. SCHEME BREAKDOWN OVER TIME: From the monthly GMS payment data, plot the following categories month by month: (a) Capitation, (b) Practice Support Subsidy, (c) CDM payments (asthma + diabetes enhanced capitation and registration fees combined), (d) Cervical Screening, (e) STCs, (f) Leave payments, (g) Other.
2. TREND DETECTION: For each category, calculate the average monthly payment over the data period. Flag any month where a category drops more than 40% below its average — this likely indicates missed claims, not a rate change.
3. GROWTH RATES: Calculate the year-on-year change for each payment category if multi-year data is available.
4. SEASONAL PATTERNS: Note if certain categories have predictable seasonal patterns (e.g., CDM reviews tend to spike at quarter-ends).
5. If this is a multi-GP practice (multiple doctor numbers), compare total GMS income per panel to identify if one panel is significantly underperforming.

CHART: A multi-line chart showing the top 4-5 payment categories over time. Use palette colours in series order: #4A90E2, #4ECDC4, #FF6B6B, #7C6EBF, #F9A826.

INSIGHT: What story do these trends tell? Are they capturing more CDM income over time (good) or is it declining (concerning)? Are STCs being used consistently or sporadically? What specific actions should they take based on the trends?`,
    reportType: 'standard',
    requiresData: ['paymentAnalysisData'],
    dataSources: ['paymentAnalysisData'],
    contextProfile: {
      incomeCategories: 'none',
      expenseCategories: 'none',
      gmsData: 'full',
      monthlyTrends: false,
      previousYear: false,
      contextNotes: 'Focus on PCRS payment scheme trends only.'
    }
  },

  // ─── Tax & Compliance ───────────────────────────────────────────────

  {
    id: 'tax-planning',
    categoryId: 'tax',
    title: 'Tax Planning Checkpoint',
    shortQuestion: 'What is my current tax position?',
    description: 'Review your tax position: withholding tax credits, deduction gaps, and planning opportunities.',
    details: [
      'Calculate total withholding tax from GMS and state contracts',
      'Identify potentially under-claimed expense deductions',
      'Flag pension contribution and capital allowance opportunities',
      'Estimate your current taxable profit position'
    ],
    prompt: `Produce a Tax Planning Checkpoint for this Irish GP practice.

CALCULATIONS TO PERFORM:

1. WITHHOLDING TAX POSITION:
   - From the GMS data, extract total withholding tax deducted (shown on PCRS statements at 25%).
   - From income categories, identify state contract income (DSP medicals, insurance reports, nursing home work) and calculate 25% withholding.
   - Total withholding tax = GMS withholding + state contract withholding. This is a TAX CREDIT the GP can claim on their return.

2. TAXABLE PROFIT ESTIMATE:
   - Gross income minus allowable deductions = estimated taxable profit.
   - Note: partner drawings are NOT deductible. Show the distinction between profit and drawings.
   - If profit margin is above 50%, flag that the GP may want to review whether all deductions are being captured.

3. DEDUCTION REVIEW:
   - Scan expense categories for common gaps in GP practices:
     * Motor expenses / mileage claims (common if GPs do home visits or nursing home rounds)
     * Professional development / CPD costs
     * Professional indemnity insurance
     * Medical council and ICGP fees
     * Use of home as office (if applicable)
     * Pension contributions (most tax-efficient deduction for higher earners)
   - For each, note if the category appears in their expenses or is missing/low.

4. KEY DATES AND ACTIONS:
   - Note the standard Irish self-assessment dates (preliminary tax Oct 31, return Nov 15 for ROS).
   - Suggest timing strategies (e.g., accelerate equipment purchases before year-end for capital allowances, maximise pension contributions before deadline).

IMPORTANT: Be clear this is for planning purposes — the GP should confirm all figures with their accountant before filing.`,
    reportType: 'strategic',
    requiresData: ['transactions'],
    dataSources: ['transactions', 'paymentAnalysisData'],
    contextProfile: {
      incomeCategories: 'all',
      expenseCategories: 'all',
      gmsData: 'summary',
      monthlyTrends: true,
      previousYear: true,
      contextNotes: 'Complete expense view needed to identify missing deductions.'
    }
  },
  {
    id: 'year-end-planning',
    categoryId: 'tax',
    title: 'Year-End Tax Planning',
    shortQuestion: 'What should I do before year-end?',
    description: 'Strategic financial moves to consider before your financial year closes.',
    details: [
      'Review current income and expense position for the year',
      'Identify strategic purchases or deferrals to consider',
      'Suggest pension and retirement planning actions',
      'Recommend year-end financial housekeeping tasks'
    ],
    prompt: `What strategic financial actions should this practice consider before their financial year ends?

CALCULATIONS TO PERFORM:
1. YEAR-TO-DATE POSITION: Summarise current year income, expenses, and estimated profit.
2. PROJECTED FULL-YEAR: If we're partway through the year, project the full-year figures based on the monthly run-rate.
3. COMPARED TO PRIOR YEAR: How does this year compare? Higher profit means higher tax — which creates more urgency for year-end planning.

SPECIFIC STRATEGIES TO EVALUATE:
1. PENSION CONTRIBUTIONS: For self-employed GPs, pension contributions are the most tax-efficient deduction. Maximum allowable contribution depends on age (15% of income under 30, scaling to 40% over 60). Estimate headroom.
2. CAPITAL PURCHASES: Equipment, computers, and medical devices can qualify for capital allowances (12.5% over 8 years, or accelerated for energy-efficient equipment). If they're planning purchases, doing them before year-end captures the allowance sooner.
3. INCOME DEFERRAL / ACCELERATION: If profit is unusually high this year, consider whether any income can legitimately be deferred. If unusually low, consider bringing forward invoicing.
4. EXPENSE PREPAYMENT: Some expenses (insurance, subscriptions, maintenance) can be prepaid to bring the deduction into the current year.
5. BAD DEBT WRITE-OFFS: If there are outstanding patient debts unlikely to be collected, writing them off before year-end creates a deduction.

Prioritise recommendations by estimated tax impact (largest savings first). Be specific about amounts where possible.`,
    reportType: 'strategic',
    requiresData: ['transactions'],
    dataSources: ['transactions'],
    contextProfile: {
      incomeCategories: 'all',
      expenseCategories: 'all',
      gmsData: 'none',
      monthlyTrends: true,
      previousYear: true,
      contextNotes: 'Complete income and expense view for year-end strategy.'
    }
  },

  // ─── Costs & Cash Flow ──────────────────────────────────────────────

  {
    id: 'expense-deep-dive',
    categoryId: 'costs',
    title: 'Expense Deep Dive',
    shortQuestion: 'Where are my biggest costs hiding?',
    description: 'Identify unusual spending patterns, fastest-growing costs, and the biggest savings opportunities.',
    details: [
      'Rank all expense categories by size and growth rate',
      'Flag the fastest-growing categories year-on-year',
      'Detect one-off anomalies and unusual patterns',
      'Identify the best opportunities to reduce costs'
    ],
    prompt: `Analyse this practice's expenses for anomalies, trends, and savings opportunities.

CALCULATIONS TO PERFORM:
1. TOP 10 EXPENSE CATEGORIES: List the 10 largest expense categories by annual spend. Show amount, percentage of total expenses, and year-on-year change if prior year data is available.
2. FASTEST GROWING: Identify the 3 categories with the highest percentage growth rate year-on-year. A 50% jump in a category is worth investigating even if the absolute amount is small.
3. ANOMALY SCAN: For each category, calculate the average monthly spend. Flag any month where spending exceeded 2x the monthly average — these are anomalies worth explaining (one-off purchase? billing error? missed duplicate?).
4. STAFF COST RATIO: Calculate total staff costs (all salary, PRSI, pension categories) as a percentage of total income. This is the single most important cost ratio for a GP practice.
5. PREMISES COST RATIO: Calculate total premises costs (rent, rates, insurance, utilities, maintenance) as a percentage of income.
6. SAVINGS OPPORTUNITIES: Based on the data, identify the 3 categories with the most realistic potential for savings. Focus on recurring costs where renegotiation or switching is possible (insurance, utilities, supplies, IT/software).

CHART: A horizontal bar chart of the top 10 expense categories, sized by annual spend. Use #FF6B6B (coral) for all bars.

Keep it factual and data-driven. Don't speculate about costs you can't see in the data.`,
    reportType: 'strategic',
    requiresData: ['transactions'],
    dataSources: ['transactions'],
    contextProfile: {
      incomeCategories: 'top',
      expenseCategories: 'all',
      gmsData: 'none',
      monthlyTrends: true,
      previousYear: true,
      contextNotes: 'ALL expense categories needed for comprehensive analysis.'
    }
  },
  {
    id: 'seasonal-cashflow',
    categoryId: 'costs',
    title: 'Seasonal Cash Flow',
    shortQuestion: 'Which months do I need to watch?',
    description: 'Understand your practice\'s financial rhythm and plan for lean months.',
    details: [
      'Map income and expense patterns by month',
      'Identify your strongest and weakest periods',
      'Calculate the cash buffer needed to smooth the cycle',
      'Suggest strategies for managing lean months'
    ],
    prompt: `Analyse this practice's monthly cash flow patterns to identify seasonal rhythms.

CALCULATIONS TO PERFORM:
1. MONTHLY NET CASH FLOW: For each month in the data, calculate income minus expenses. Rank months from strongest to weakest.
2. BEST AND WORST MONTHS: Identify the 3 strongest months and 3 weakest months. Are these consistent across years (true seasonal pattern) or one-off events?
3. INCOME SEASONALITY: Which months have the highest income? Factors in GP practices: flu season (Oct-Mar) drives consultations, summer holidays reduce private visits, PCRS payments may have quarterly patterns.
4. EXPENSE SEASONALITY: Which months have the highest costs? Common drivers: locum costs during holiday periods, insurance renewals, equipment purchases, tax payments.
5. CASH BUFFER CALCULATION: What is the practice's worst single month net cash flow? Multiply the largest monthly deficit by 1.5 to get a recommended cash buffer. "You should keep at least €X accessible to cover your worst months."
6. CUMULATIVE CASH FLOW: Show a running total of net cash flow through the year. This reveals if there are extended periods where the practice is drawing down reserves.

CHART: A combination chart showing monthly income (bars in #4ECDC4 turquoise) and expenses (bars in #FF6B6B coral) with a net cash flow line (#4A90E2 blue) overlaid, for the most recent complete year.

ACTIONABLE ADVICE: What specific scheduling, billing, or cost management actions could smooth the cash flow cycle? Be practical — e.g. "Schedule annual insurance renewal in your strongest month" or "Consider staggering locum cover rather than concentrating it in August."`,
    reportType: 'standard',
    requiresData: ['transactions'],
    dataSources: ['transactions'],
    contextProfile: {
      incomeCategories: 'top',
      expenseCategories: 'top',
      gmsData: 'summary',
      monthlyTrends: true,
      previousYear: true,
      contextNotes: 'Monthly trends are the primary data — include all months available.'
    }
  },
  {
    id: 'vendor-review',
    categoryId: 'costs',
    title: 'Supplier & Vendor Review',
    shortQuestion: 'Am I getting value from my suppliers?',
    description: 'Are you getting the best value from your regular expenses and suppliers?',
    details: [
      'Identify your largest ongoing supplier costs',
      'Detect recurring payment patterns and subscriptions',
      'Highlight categories where rates could be renegotiated',
      'Focus on the biggest cost-saving opportunities'
    ],
    prompt: `Review this practice's recurring and regular expenses to assess vendor value.

CALCULATIONS TO PERFORM:
1. RECURRING PAYMENTS: From the transaction details, identify expenses that appear monthly or regularly with similar amounts. Group by likely vendor/supplier (based on transaction descriptions).
2. TOP 5 VENDORS BY ANNUAL COST: List the 5 largest recurring expense relationships by total annual spend.
3. PRICE STABILITY: For each major recurring cost, has the amount been stable or has it crept up? Calculate the percentage change from the earliest to most recent payment.
4. CATEGORY REVIEW: For each major cost category (insurance, utilities, IT/software, medical supplies, cleaning/waste), show the annual total and note if this is a single vendor or multiple.
5. RENEGOTIATION CANDIDATES: Flag expenses where (a) the cost has increased significantly, (b) the annual spend is large enough to be worth renegotiating, and (c) the market typically offers competitive alternatives. Insurance, utilities, and medical supplies are the usual candidates for GP practices.

IMPORTANT CAVEAT: Bank transaction descriptions are limited — we can see payment amounts and approximate vendor names but not contract details. Recommendations should be framed as "areas to investigate" rather than definitive switching advice.

Focus on the 3 highest-impact opportunities with estimated annual savings potential.`,
    reportType: 'standard',
    requiresData: ['transactions'],
    dataSources: ['transactions'],
    contextProfile: {
      incomeCategories: 'none',
      expenseCategories: 'all',
      gmsData: 'none',
      monthlyTrends: false,
      previousYear: true,
      contextNotes: 'Focus on recurring expense patterns and vendor cost changes.'
    }
  },

  // ─── Growth & Strategy ──────────────────────────────────────────────

  {
    id: 'staffing-analysis',
    categoryId: 'growth',
    title: 'Should We Hire?',
    shortQuestion: 'Can I afford to hire someone new?',
    description: 'Financial impact analysis of adding a nurse, practice manager, or additional GP to your team.',
    details: [
      'Assess whether current income supports additional staff',
      'Model the cost of different roles using HSE scales',
      'Calculate break-even point for a new hire',
      'Factor in practice support subsidy recovery'
    ],
    prompt: `Analyse whether this practice can financially support hiring an additional staff member.

CALCULATIONS TO PERFORM:

1. CURRENT POSITION:
   - Total income, total expenses, current profit, profit margin.
   - Current staff costs as % of income.
   - Current number of GPs and staff from the PRACTICE TEAM section of the practice context.
   - Use the GP Clinical Hours per Week and Working Weeks per Year from the PRACTICE OPERATIONS section if available (do NOT assume defaults if these are not provided).

2. COST OF A NEW HIRE (model three scenarios):
   a) PRACTICE NURSE: Approximate salary €35,000-€42,000 (HSE scale), plus employer PRSI (~11%), plus any equipment/training. Total estimated cost: €39,000-€47,000.
   b) RECEPTIONIST/SECRETARY: Approximate salary €23,000-€27,000 (HSE scale), plus employer PRSI. Total estimated cost: €25,500-€30,000.
   c) ADDITIONAL GP (salaried): Approximate salary €80,000-€120,000 depending on experience, plus PRSI. Total estimated cost: €89,000-€133,000.

3. SUBSIDY OFFSET: If the practice is eligible for practice support subsidy, a new nurse or secretary could be partially subsidised by PCRS. Calculate the approximate subsidy recovery based on the practice's weighted panel and the relevant HSE scale rate (pro-rated for hours worked). This could offset 40-70% of the cost for practices with qualifying panel sizes.

4. BREAK-EVEN ANALYSIS: For each hire scenario, calculate:
   - How much additional revenue would the hire need to generate (directly or indirectly) to cover their cost?
   - For a nurse: how many additional CDM registrations, cervical screenings, or vaccinations would cover the cost?
   - For a GP: how many additional patients/consultations per day would be needed?
   - For a receptionist: this is typically a capacity/quality hire — frame it as "your practice can afford this when profit exceeds €X."

5. AFFORDABILITY ASSESSMENT: Based on current profit, what percentage of profit would each hire consume? Below 30% is comfortable, 30-50% is stretch, above 50% is risky.

Present as a clear comparison table of the three options, with a recommended priority order.`,
    reportType: 'strategic',
    requiresData: ['transactions'],
    dataSources: ['transactions', 'paymentAnalysisData'],
    dataInputs: OPERATIONAL_DATA_INPUTS,
    contextProfile: {
      incomeCategories: 'all',
      expenseCategories: 'all',
      gmsData: 'summary',
      monthlyTrends: true,
      previousYear: true,
      contextNotes: 'Staff cost categories and practice profile team details are critical.'
    }
  },
  {
    id: 'revenue-per-gp',
    categoryId: 'growth',
    title: 'Revenue Per GP',
    shortQuestion: 'How productive is each GP?',
    description: 'Compare GP productivity and identify optimisation opportunities across the practice.',
    details: [
      'Calculate revenue and profit per GP',
      'Benchmark against expected norms for Irish practices',
      'Identify productivity optimisation opportunities',
      'Show how the metric has changed over time'
    ],
    prompt: `Analyse revenue and profit per GP for this practice.

IMPORTANT: Use the number of GPs from the PRACTICE TEAM section of the practice context. Use GP Clinical Hours per Week and Working Weeks per Year from PRACTICE OPERATIONS if available — do NOT assume defaults.

CALCULATIONS TO PERFORM:
1. REVENUE PER GP: Total income / number of GPs. Show the annual and monthly figure.
2. PROFIT PER GP: Net profit / number of GPs. This is effectively the GP's earning power before drawings.
3. EXPENSES PER GP: Total expenses / number of GPs. What each GP "costs" the practice in overheads.
4. GMS INCOME PER GP: If GMS data is available, calculate total GMS income / number of GPs. This indicates how much each GP earns from their panel alone.
5. OVERHEAD ABSORPTION RATE: Total overheads (non-GP staff costs + premises + supplies + admin) / number of GPs. This is what each GP must earn before they start generating profit.
6. REVENUE PER CLINICAL HOUR: If GP hours are available, calculate total income / total clinical hours. This measures how effectively clinical time converts to income.
7. TREND: If multi-year data is available, show how revenue per GP has changed. Is it growing (good — the practice is becoming more productive) or declining (concerning — could indicate panel erosion or fee stagnation)?

BENCHMARKING: Typical Irish GP practices generate €250,000-€400,000 gross income per GP depending on panel size and private patient mix. Flag where this practice sits relative to that range.

CHART: A bar chart comparing Revenue per GP (#4ECDC4 turquoise), Expenses per GP (#FF6B6B coral), and Profit per GP (#4A90E2 blue) as three grouped bars.

INTERPRETATION: What does the revenue-per-GP number tell us? If it's low, is the practice under-billing, under-claiming GMS items, or carrying too many GPs for its patient base? If it's high, is the practice at capacity and potentially missing growth opportunities?`,
    reportType: 'standard',
    requiresData: ['transactions'],
    dataSources: ['transactions'],
    dataInputs: OPERATIONAL_DATA_INPUTS,
    contextProfile: {
      incomeCategories: 'all',
      expenseCategories: 'all',
      gmsData: 'summary',
      monthlyTrends: true,
      previousYear: true,
      contextNotes: 'Need complete totals for per-GP ratio calculations.'
    }
  },
  {
    id: 'five-year-outlook',
    categoryId: 'growth',
    title: 'Five-Year Financial Outlook',
    shortQuestion: 'Where will my practice be in 5 years?',
    description: 'Model your practice\'s growth trajectory based on current trends and market conditions.',
    details: [
      'Project income and expenses forward from historical trends',
      'Model 3 scenarios: conservative, steady, and growth',
      'Factor in GMS rate changes and expense inflation',
      'Identify when current trends may become unsustainable'
    ],
    prompt: `Project a 5-year financial outlook for this practice based on current trends.

CALCULATIONS TO PERFORM:

1. BASELINE TRENDS: From the available data, calculate the annual growth rate for: (a) total income, (b) total expenses, (c) net profit. If only one year of data is available, use that as the baseline and apply reasonable growth assumptions.

2. THREE SCENARIOS — project each year for 5 years:

   a) CONSERVATIVE SCENARIO:
      - Income grows at 2% per year (in line with typical GMS rate adjustments)
      - Expenses grow at 4% per year (general inflation plus healthcare cost inflation)
      - Note the year when this trajectory turns profit-negative, if applicable

   b) STEADY STATE SCENARIO:
      - Income and expenses both grow at their historical rate (calculated in step 1)
      - If no historical trend is available, use 3% income growth and 3.5% expense growth

   c) GROWTH SCENARIO:
      - Income grows at 5% per year (assumes adding patients, new services, or better GMS claiming)
      - Expenses grow at 3.5% per year (assumes some efficiencies)
      - Show the profit improvement over 5 years

3. KEY METRICS AT YEAR 5: For each scenario, show: projected annual income, projected annual expenses, projected profit, projected profit margin.

4. CRITICAL DECISIONS: Based on the projections, what decisions should the GP consider now?
   - If the conservative scenario shows declining profit, what levers could change the trajectory?
   - If the growth scenario is attractive, what investment would be needed to achieve it?
   - At what point (year X) might the practice need to add a GP or nurse to sustain growth?

CHART: A line chart showing projected net profit under all 3 scenarios over 5 years. Use #10B981 (green) for optimistic, #4A90E2 (blue) for moderate, #FF6B6B (coral) for conservative. Use distinct line styles (solid, dashed, dotted).

IMPORTANT CAVEAT: These are projections based on simple trend extrapolation, not predictions. State this clearly. Real outcomes depend on policy changes, patient demographics, and management decisions.`,
    reportType: 'strategic',
    requiresData: ['transactions'],
    dataSources: ['transactions', 'paymentAnalysisData'],
    contextProfile: {
      incomeCategories: 'all',
      expenseCategories: 'all',
      gmsData: 'full',
      monthlyTrends: true,
      previousYear: true,
      contextNotes: 'All historical data needed for trend extrapolation.'
    }
  }
];

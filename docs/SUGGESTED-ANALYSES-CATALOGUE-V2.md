# Suggested Analyses Catalogue — V2

Reference document for all pre-built report templates in the Advanced Insights tab.
Includes full prompts as implemented in `src/data/suggestedAnalyses.js`.

---

## Overview

| # | Report | Category | Model | Data Required | Data Inputs | Context Profile |
|---|--------|----------|-------|---------------|-------------|-----------------|
| 1 | Income Source Analysis | Practice Overview | Opus (Strategic) | Transactions | None | All income, top expenses, full GMS, monthly trends, prior year |
| 2 | Practice Operating Cost | Practice Overview | Opus (Strategic) | Transactions | Consultation fee, GP hours, working weeks, appointment duration | Top income, all expenses, no GMS, monthly trends, prior year |
| 3 | Practice Health Check | Practice Overview | Opus (Strategic) | Transactions | None | All income, all expenses, GMS summary, monthly trends, prior year |
| 4 | GMS Optimisation Summary | GMS & PCRS | Sonnet (Standard) | GMS Health Check (partial OK) | None | No income/expenses, full GMS, no trends |
| 5 | PCRS Payment Trends | GMS & PCRS | Sonnet (Standard) | GMS Statements | None | No income/expenses, full GMS, no trends |
| 6 | Tax Planning Checkpoint | Tax & Compliance | Opus (Strategic) | Transactions | None | All income, all expenses, GMS summary, monthly trends, prior year |
| 7 | Year-End Tax Planning | Tax & Compliance | Opus (Strategic) | Transactions | None | All income, all expenses, no GMS, monthly trends, prior year |
| 8 | Expense Deep Dive | Costs & Cash Flow | Sonnet (Standard) | Transactions | None | Top income, all expenses, no GMS, monthly trends, prior year |
| 9 | Seasonal Cash Flow | Costs & Cash Flow | Sonnet (Standard) | Transactions | None | Top income, top expenses, GMS summary, monthly trends, prior year |
| 10 | Supplier & Vendor Review | Costs & Cash Flow | Sonnet (Standard) | Transactions | None | No income, all expenses, no GMS, no trends, prior year |
| 11 | Should We Hire? | Growth & Strategy | Opus (Strategic) | Transactions | Consultation fee, GP hours, working weeks, appointment duration | All income, all expenses, GMS summary, monthly trends, prior year |
| 12 | Revenue Per GP | Growth & Strategy | Sonnet (Standard) | Transactions | Consultation fee, GP hours, working weeks, appointment duration | All income, all expenses, GMS summary, monthly trends, prior year |
| 13 | Five-Year Financial Outlook | Growth & Strategy | Opus (Strategic) | Transactions | None | All income, all expenses, full GMS, monthly trends, prior year |

---

## Categories

- **Practice Overview** (blue `#3B82F6`) — Big-picture financial health and structure
- **GMS & PCRS** (pink `#E91E63`) — Public health scheme income analysis
- **Tax & Compliance** (amber `#F59E0B`) — Tax position, deductions, and planning
- **Costs & Cash Flow** (green `#10B981`) — Expense analysis and cash flow patterns
- **Growth & Strategy** (purple `#8B5CF6`) — Hiring, productivity, and forward planning

---

## Data Inputs (Operational Details)

Three reports (Operating Cost, Should We Hire?, Revenue Per GP) prompt the user to enter operational details before generation. These are pre-filled from the practice profile if previously saved, and saved back on generate.

| Field | Unit | Range | Profile Storage Path |
|-------|------|-------|---------------------|
| Private consultation fee | € | 0–500 | `privatePatients.averageConsultationFee` |
| Clinical hours per GP per week | hrs | 1–80 | `operations.gpClinicalHoursPerWeek` |
| Working weeks per year | wks | 20–52 | `operations.workingWeeksPerYear` |
| Appointment duration | min | 5–60 | `operations.appointmentDuration` |

---

## Report Details

---

### 1. Income Source Analysis

**ID:** `income-sources`
**Category:** Practice Overview
**Model:** Opus (Strategic)
**Data:** Transactions + GMS Statements (optional)
**Data Inputs:** None

**Question:** Where does the practice's revenue come from, and how exposed is it to any single income stream?

**Calculations:**
1. Group all income into buckets: GMS/PCRS payments, private/patient fees, state contracts (DSP, medicals, insurance), other
2. If GMS data available, break PCRS further into capitation, CDM, cervical screening, STCs, practice support, leave, other
3. Year-on-year change per bucket — which streams are growing vs declining
4. Concentration risk flag if any single stream exceeds 60% of total income

**Report structure:**
- Donut/pie chart of income split by source
- Line chart of top 3 income streams month-by-month (if multi-month data available)
- Insight on financial resilience based on income mix
- Specific diversification recommendations

**Context profile:**
- Income categories: all
- Expense categories: top
- GMS data: full
- Monthly trends: yes
- Prior year: yes
- Notes: Include ALL income sources regardless of size. Compare net bank income vs gross PCRS payments.

**Prompt:**

```
Produce an Income Source Analysis for this practice.

CALCULATIONS TO PERFORM:
1. From the income breakdown, group all income into these buckets: (a) GMS/PCRS payments (any category mentioning PCRS, GMS, capitation, HSE), (b) Private/patient fees (consultations, procedures not via GMS), (c) State contracts (DSP, medicals, insurance reports), (d) Other income. Show euro amounts and percentages.
2. If GMS gross payment data is available, break it further into: capitation, CDM, cervical screening, STCs, practice support, leave payments, other PCRS.
3. Calculate the year-on-year change in each bucket. Which income streams are growing vs declining?
4. Flag if any single stream exceeds 60% of total income — this is a concentration risk.

CHART: Create a donut/pie chart showing the income split by source. Use a second line chart showing how the top 3 income streams have trended month-by-month if multi-month data is available.

INSIGHT: What does this mix tell the GP about their practice's financial resilience? If GMS is dominant, note the implications (income subject to government policy). If private is dominant, note the implications (vulnerable to competition/demographics). Recommend specific diversification actions.
```

---

### 2. Practice Operating Cost

**ID:** `operating-cost`
**Category:** Practice Overview
**Model:** Opus (Strategic)
**Data:** Transactions
**Data Inputs:** Consultation fee, GP hours, working weeks, appointment duration

**Question:** What does it cost per hour to keep the practice open? What is the break-even number of consultations per day?

**Calculations:**
1. **Fixed costs:** Rent/rates, staff salaries (non-GP), insurance, utilities, software/IT, professional fees, loan repayments — monthly and annual
2. **Variable costs:** Medical supplies, locum fees, lab costs — monthly and annual
3. **Total operating cost:** Fixed + variable, monthly average
4. **Cost per clinical hour:** Total operating cost / (GPs × weekly hours × working weeks). Uses exact values from PRACTICE OPERATIONS — will not assume defaults
5. **Break-even consultations:** (Daily operating cost − daily GMS income) / consultation fee. Uses exact consultation fee from PRACTICE OPERATIONS
6. **Fixed cost ratio:** Fixed costs as % of total. Above 80% = very little flexibility in a downturn
7. **PRSI sanity check:** Flags if employer PRSI exceeds 15% of salary base (standard rate is 11.05%)

**Report structure:**
- Stacked bar chart of fixed vs variable costs by month
- Framed as "what it costs to turn the lights on each morning"
- Directly informs consultation fee setting, capacity to absorb quiet months, and hiring decisions

**Context profile:**
- Income categories: top
- Expense categories: all
- GMS data: none
- Monthly trends: yes
- Prior year: yes
- Notes: Focus on classifying expenses as fixed vs variable costs.

**Prompt:**

```
Produce a Practice Operating Cost report.

CALCULATIONS TO PERFORM:
1. FIXED COSTS: Sum all expenses that recur regardless of patient volume — rent/rates, staff salaries (all non-GP staff), insurance, utilities, software/IT, professional fees, loan repayments. Show the monthly and annual total.
2. VARIABLE COSTS: Sum expenses that scale with activity — medical supplies, locum fees, lab costs. Show monthly and annual.
3. TOTAL OPERATING COST: Fixed + Variable. Show monthly average.
4. COST PER CLINICAL HOUR: Look in the PRACTICE OPERATIONS section of the practice context for "GP Clinical Hours per Week" and "Working Weeks per Year". Use those exact values — do NOT assume defaults. If they are not available, state that you cannot calculate this figure without knowing GP hours and ask the user to provide them. Formula: Total operating cost / (number of GPs x weekly hours x working weeks).
5. BREAK-EVEN CONSULTATIONS: Look in the PRACTICE OPERATIONS section for "Private Consultation Fee". Use that exact value — do NOT assume a default fee. If not available, state you need the consultation fee to calculate break-even. Formula: (Daily operating cost - daily GMS income) / consultation fee = consultations needed per day.
6. FIXED COST RATIO: Fixed costs as a percentage of total costs. Above 80% means the practice has very little flexibility to cut costs in a downturn.
7. SANITY CHECKS: If employer PRSI exceeds 15% of the salary amount it relates to, flag this as unusual and worth verifying with the practice accountant (the standard employer PRSI rate is 11.05%).

CHART: A stacked bar chart showing fixed vs variable costs by month, so the GP can see how their cost base shifts over the year.

CONTEXT: Frame this as "what it costs to turn the lights on each morning". Most GPs have never seen this number. It directly informs whether their consultation fees are set correctly, whether they can absorb a quiet month, and whether hiring makes financial sense.
```

---

### 3. Practice Health Check

**ID:** `practice-health`
**Category:** Practice Overview
**Model:** Opus (Strategic)
**Data:** Transactions + GMS Statements (optional)
**Data Inputs:** None

**Question:** Is the practice financially healthy? A composite red/amber/green scorecard across key metrics.

**Indicators scored (Red / Amber / Green):**
1. **Profit margin:** Green >40%, Amber 25–40%, Red <25%
2. **Income trend:** Green if grew YoY, Amber if flat (within 3%), Red if declined
3. **Expense control:** Green if expenses grew slower than income, Amber same rate, Red faster
4. **Staff cost ratio:** Green <45% of income, Amber 45–55%, Red >55%
5. **Cash flow stability:** Green if no month has expenses exceeding income by >20%, Amber 1–2 months, Red 3+
6. **Income diversity:** Green if no source >60%, Amber 60–75%, Red >75%
7. **GMS optimisation:** Green if CDM/screening/STCs active, Amber if one underutilised, Red if multiple gaps

**Report structure:**
- Clean indicator table with RAG status
- Single headline overall assessment
- Priority action: the single most impactful thing to focus on first
- Points to other specific reports for deep dives on problem areas

**Context profile:**
- Income categories: all
- Expense categories: all
- GMS data: summary
- Monthly trends: yes
- Prior year: yes
- Notes: Comprehensive overview — all financial dimensions needed for scoring.

**Prompt:**

```
Produce a Practice Health Check — a composite financial health assessment.

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

FORMAT: Present the indicators in a clean table. Keep the narrative short — this report is about the dashboard, not the deep dive. Point the user to other specific reports (by name) for each area that needs attention.
```

---

### 4. GMS Optimisation Summary

**ID:** `gms-optimisation`
**Category:** GMS & PCRS
**Model:** Sonnet (Standard)
**Data:** GMS Health Check (partial completion OK — minimum: PCRS statements + 1 Health Check section)
**Data Inputs:** None
**Special flags:** `showSectionStatus: true`, `forceFullGMSContext: true`

**Question:** What does the GMS Health Check analysis reveal about unclaimed income, and what are the priority actions?

**Key design principle:** Claude **summarises and presents** the app's pre-computed GMS Health Check results. It does NOT perform its own analysis, estimate panel sizes, or use national benchmarks. All numbers come from `analyzeGMSIncome()` and `generateRecommendations()`.

**Prerequisite:** The modal shows a 6-section checklist (PCRS Statements, Patient Demographics, Practice Support, Leave Entitlements, Disease Registers, Cervical Screening) with tick/cross indicators. At least PCRS data plus one section must be available.

**Report structure:**
1. **Headline** with total unclaimed income and sections-analysed count
2. **Priority actions table** — from recommendations, ordered by value
3. **Section summaries** — 2–3 sentences per available section
4. **Not Yet Analysed** — lists incomplete sections with nudge to complete the Health Check
5. **Growth opportunities** — separate from priority actions (administrative fixes vs activity increases)
6. **Next steps** — 3–5 actionable items
7. **Horizontal bar chart** of unclaimed income by category

**Context profile:**
- Income categories: none
- Expense categories: none
- GMS data: full (forced via `forceFullGMSContext`)
- Monthly trends: no
- Prior year: no
- Notes: This report summarises the GMS Health Check analysis. Use ONLY the pre-computed figures from the GMS context — do not estimate or calculate independently.

**Prompt:**

```
Produce a GMS Optimisation Summary for this practice.

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

CHART: A horizontal bar chart showing unclaimed/recoverable income by category (only for sections with data). Use the exact values from the analysis.

CRITICAL RULES:
- Every number in this report MUST come from the GMS Health Check analysis in the context
- Do NOT invent STC codes, benchmark rates, or national averages
- Do NOT estimate panel sizes — use the exact figures from the analysis
- If the context shows €0 unclaimed for a section, report it as "no issues identified"
- If a section has no data at all, put it under "Not Yet Analysed" — do NOT fill with estimates
- This report should read as a polished executive summary suitable for printing and sharing with a practice manager
```

---

### 5. PCRS Payment Trends

**ID:** `gms-trends`
**Category:** GMS & PCRS
**Model:** Sonnet (Standard)
**Data:** GMS Statements only
**Data Inputs:** None

**Question:** How have GMS payment streams changed over time? Are there dropped claims or shifting income patterns?

**Calculations:**
1. **Scheme breakdown over time:** Monthly plot of capitation, practice support, CDM, cervical screening, STCs, leave, other
2. **Trend detection:** Flag any month where a category drops >40% below its average (likely missed claims, not rate change)
3. **Growth rates:** Year-on-year change per payment category
4. **Seasonal patterns:** Note predictable seasonal spikes (e.g. CDM reviews at quarter-ends)
5. **Per-panel comparison:** In multi-GP practices, compare GMS income per panel to identify underperforming panels

**Report structure:**
- Multi-line chart of top 4–5 payment categories over time
- Narrative on what the trends reveal
- Specific actions based on trend patterns

**Context profile:**
- Income categories: none
- Expense categories: none
- GMS data: full
- Monthly trends: no
- Prior year: no
- Notes: Focus on PCRS payment scheme trends only.

**Prompt:**

```
Analyse the trends in this practice's PCRS/GMS payments over time.

CALCULATIONS TO PERFORM:
1. SCHEME BREAKDOWN OVER TIME: From the monthly GMS payment data, plot the following categories month by month: (a) Capitation, (b) Practice Support Subsidy, (c) CDM payments (asthma + diabetes enhanced capitation and registration fees combined), (d) Cervical Screening, (e) STCs, (f) Leave payments, (g) Other.
2. TREND DETECTION: For each category, calculate the average monthly payment over the data period. Flag any month where a category drops more than 40% below its average — this likely indicates missed claims, not a rate change.
3. GROWTH RATES: Calculate the year-on-year change for each payment category if multi-year data is available.
4. SEASONAL PATTERNS: Note if certain categories have predictable seasonal patterns (e.g., CDM reviews tend to spike at quarter-ends).
5. If this is a multi-GP practice (multiple doctor numbers), compare total GMS income per panel to identify if one panel is significantly underperforming.

CHART: A multi-line chart showing the top 4-5 payment categories over time. Use distinct colours for each line.

INSIGHT: What story do these trends tell? Are they capturing more CDM income over time (good) or is it declining (concerning)? Are STCs being used consistently or sporadically? What specific actions should they take based on the trends?
```

---

### 6. Tax Planning Checkpoint

**ID:** `tax-planning`
**Category:** Tax & Compliance
**Model:** Opus (Strategic)
**Data:** Transactions + GMS Statements (optional)
**Data Inputs:** None

**Question:** What is the practice's current tax position — withholding credits, deduction gaps, and planning opportunities?

**Calculations:**
1. **Withholding tax position:** GMS withholding (25%) + state contract withholding (25%) = total tax credit to claim on return
2. **Taxable profit estimate:** Gross income minus allowable deductions. Note partner drawings are NOT deductible. Flag if profit margin >50% (possible missed deductions)
3. **Deduction review — scan for common gaps:**
   - Motor expenses / mileage claims
   - CPD costs
   - Professional indemnity insurance
   - Medical council and ICGP fees
   - Use of home as office
   - Pension contributions (most tax-efficient for higher earners)
4. **Key dates:** Self-assessment dates (preliminary tax Oct 31, return Nov 15 for ROS). Timing strategies for capital allowances and pension contributions

**Report structure:**
- Clear disclaimer: for planning purposes, confirm with accountant before filing
- Complete expense view needed to identify missing deductions

**Context profile:**
- Income categories: all
- Expense categories: all
- GMS data: summary
- Monthly trends: yes
- Prior year: yes
- Notes: Complete expense view needed to identify missing deductions.

**Prompt:**

```
Produce a Tax Planning Checkpoint for this Irish GP practice.

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

IMPORTANT: Be clear this is for planning purposes — the GP should confirm all figures with their accountant before filing.
```

---

### 7. Year-End Tax Planning

**ID:** `year-end-planning`
**Category:** Tax & Compliance
**Model:** Opus (Strategic)
**Data:** Transactions
**Data Inputs:** None

**Question:** What strategic financial moves should the practice consider before the financial year closes?

**Calculations:**
1. **Year-to-date position:** Current year income, expenses, estimated profit
2. **Projected full-year:** Extrapolate from monthly run-rate if partway through year
3. **Compared to prior year:** Higher profit = higher tax = more urgency for planning

**Strategies evaluated:**
1. **Pension contributions:** Maximum depends on age (15% under 30, scaling to 40% over 60). Estimate headroom
2. **Capital purchases:** Equipment qualifies for 12.5% over 8 years (accelerated for energy-efficient). Pre-year-end captures allowance sooner
3. **Income deferral/acceleration:** If profit unusually high, consider deferral. If low, bring forward invoicing
4. **Expense prepayment:** Insurance, subscriptions, maintenance — bring deduction into current year
5. **Bad debt write-offs:** Outstanding patient debts unlikely to be collected

**Report structure:**
- Recommendations prioritised by estimated tax impact (largest savings first)
- Specific amounts where possible

**Context profile:**
- Income categories: all
- Expense categories: all
- GMS data: none
- Monthly trends: yes
- Prior year: yes
- Notes: Complete income and expense view for year-end strategy.

**Prompt:**

```
What strategic financial actions should this practice consider before their financial year ends?

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

Prioritise recommendations by estimated tax impact (largest savings first). Be specific about amounts where possible.
```

---

### 8. Expense Deep Dive

**ID:** `expense-deep-dive`
**Category:** Costs & Cash Flow
**Model:** Sonnet (Standard)
**Data:** Transactions
**Data Inputs:** None

**Question:** What are the unusual spending patterns, fastest-growing costs, and biggest savings opportunities?

**Calculations:**
1. **Top 10 expense categories:** Amount, % of total, YoY change
2. **Fastest growing:** 3 categories with highest % growth YoY. Even small absolute amounts worth investigating if 50%+ jump
3. **Anomaly scan:** Flag any month where a category exceeds 2× its monthly average (one-off purchase? billing error? duplicate?)
4. **Staff cost ratio:** All salary/PRSI/pension as % of income
5. **Premises cost ratio:** Rent/rates/insurance/utilities/maintenance as % of income
6. **Savings opportunities:** 3 categories with most realistic savings potential — recurring costs where renegotiation or switching is possible

**Report structure:**
- Horizontal bar chart of top 10 expenses by annual spend
- Factual and data-driven — no speculation on costs not visible in data

**Context profile:**
- Income categories: top
- Expense categories: all
- GMS data: none
- Monthly trends: yes
- Prior year: yes
- Notes: ALL expense categories needed for comprehensive analysis.

**Prompt:**

```
Analyse this practice's expenses for anomalies, trends, and savings opportunities.

CALCULATIONS TO PERFORM:
1. TOP 10 EXPENSE CATEGORIES: List the 10 largest expense categories by annual spend. Show amount, percentage of total expenses, and year-on-year change if prior year data is available.
2. FASTEST GROWING: Identify the 3 categories with the highest percentage growth rate year-on-year. A 50% jump in a category is worth investigating even if the absolute amount is small.
3. ANOMALY SCAN: For each category, calculate the average monthly spend. Flag any month where spending exceeded 2x the monthly average — these are anomalies worth explaining (one-off purchase? billing error? missed duplicate?).
4. STAFF COST RATIO: Calculate total staff costs (all salary, PRSI, pension categories) as a percentage of total income. This is the single most important cost ratio for a GP practice.
5. PREMISES COST RATIO: Calculate total premises costs (rent, rates, insurance, utilities, maintenance) as a percentage of income.
6. SAVINGS OPPORTUNITIES: Based on the data, identify the 3 categories with the most realistic potential for savings. Focus on recurring costs where renegotiation or switching is possible (insurance, utilities, supplies, IT/software).

CHART: A horizontal bar chart of the top 10 expense categories, sized by annual spend.

Keep it factual and data-driven. Don't speculate about costs you can't see in the data.
```

---

### 9. Seasonal Cash Flow

**ID:** `seasonal-cashflow`
**Category:** Costs & Cash Flow
**Model:** Sonnet (Standard)
**Data:** Transactions
**Data Inputs:** None

**Question:** What is the practice's financial rhythm through the year, and how should it plan for lean months?

**Calculations:**
1. **Monthly net cash flow:** Income minus expenses per month, ranked strongest to weakest
2. **Best and worst months:** Top 3 and bottom 3. Are they consistent across years (true seasonal) or one-off?
3. **Income seasonality:** Flu season (Oct–Mar) drives consultations, summer holidays reduce private visits, PCRS quarterly patterns
4. **Expense seasonality:** Locum costs during holidays, insurance renewals, equipment purchases, tax payments
5. **Cash buffer calculation:** Worst single month deficit × 1.5 = recommended accessible cash buffer
6. **Cumulative cash flow:** Running total through the year to reveal extended draw-down periods

**Report structure:**
- Combination chart: monthly income bars + expense bars + net cash flow line overlay (most recent complete year)
- Practical scheduling, billing, and cost management actions to smooth the cycle

**Context profile:**
- Income categories: top
- Expense categories: top
- GMS data: summary
- Monthly trends: yes
- Prior year: yes
- Notes: Monthly trends are the primary data — include all months available.

**Prompt:**

```
Analyse this practice's monthly cash flow patterns to identify seasonal rhythms.

CALCULATIONS TO PERFORM:
1. MONTHLY NET CASH FLOW: For each month in the data, calculate income minus expenses. Rank months from strongest to weakest.
2. BEST AND WORST MONTHS: Identify the 3 strongest months and 3 weakest months. Are these consistent across years (true seasonal pattern) or one-off events?
3. INCOME SEASONALITY: Which months have the highest income? Factors in GP practices: flu season (Oct-Mar) drives consultations, summer holidays reduce private visits, PCRS payments may have quarterly patterns.
4. EXPENSE SEASONALITY: Which months have the highest costs? Common drivers: locum costs during holiday periods, insurance renewals, equipment purchases, tax payments.
5. CASH BUFFER CALCULATION: What is the practice's worst single month net cash flow? Multiply the largest monthly deficit by 1.5 to get a recommended cash buffer. "You should keep at least €X accessible to cover your worst months."
6. CUMULATIVE CASH FLOW: Show a running total of net cash flow through the year. This reveals if there are extended periods where the practice is drawing down reserves.

CHART: A combination chart showing monthly income (bars) and expenses (bars) with a net cash flow line overlaid, for the most recent complete year.

ACTIONABLE ADVICE: What specific scheduling, billing, or cost management actions could smooth the cash flow cycle? Be practical — e.g. "Schedule annual insurance renewal in your strongest month" or "Consider staggering locum cover rather than concentrating it in August."
```

---

### 10. Supplier & Vendor Review

**ID:** `vendor-review`
**Category:** Costs & Cash Flow
**Model:** Sonnet (Standard)
**Data:** Transactions
**Data Inputs:** None

**Question:** Is the practice getting the best value from its regular expenses and suppliers?

**Calculations:**
1. **Recurring payments:** Identify monthly/regular expenses with similar amounts, grouped by likely vendor
2. **Top 5 vendors by annual cost**
3. **Price stability:** % change from earliest to most recent payment per major recurring cost
4. **Category review:** Annual total per major category (insurance, utilities, IT/software, supplies, cleaning/waste) — single vs multiple vendors
5. **Renegotiation candidates:** Flag where cost has increased significantly, annual spend is large enough to warrant action, and market offers alternatives. Typical candidates: insurance, utilities, medical supplies

**Report structure:**
- Caveat: bank descriptions are limited — recommendations framed as "areas to investigate"
- Focus on 3 highest-impact opportunities with estimated annual savings

**Context profile:**
- Income categories: none
- Expense categories: all
- GMS data: none
- Monthly trends: no
- Prior year: yes
- Notes: Focus on recurring expense patterns and vendor cost changes.

**Prompt:**

```
Review this practice's recurring and regular expenses to assess vendor value.

CALCULATIONS TO PERFORM:
1. RECURRING PAYMENTS: From the transaction details, identify expenses that appear monthly or regularly with similar amounts. Group by likely vendor/supplier (based on transaction descriptions).
2. TOP 5 VENDORS BY ANNUAL COST: List the 5 largest recurring expense relationships by total annual spend.
3. PRICE STABILITY: For each major recurring cost, has the amount been stable or has it crept up? Calculate the percentage change from the earliest to most recent payment.
4. CATEGORY REVIEW: For each major cost category (insurance, utilities, IT/software, medical supplies, cleaning/waste), show the annual total and note if this is a single vendor or multiple.
5. RENEGOTIATION CANDIDATES: Flag expenses where (a) the cost has increased significantly, (b) the annual spend is large enough to be worth renegotiating, and (c) the market typically offers competitive alternatives. Insurance, utilities, and medical supplies are the usual candidates for GP practices.

IMPORTANT CAVEAT: Bank transaction descriptions are limited — we can see payment amounts and approximate vendor names but not contract details. Recommendations should be framed as "areas to investigate" rather than definitive switching advice.

Focus on the 3 highest-impact opportunities with estimated annual savings potential.
```

---

### 11. Should We Hire?

**ID:** `staffing-analysis`
**Category:** Growth & Strategy
**Model:** Opus (Strategic)
**Data:** Transactions + GMS Statements (optional)
**Data Inputs:** Consultation fee, GP hours, working weeks, appointment duration

**Question:** Can the practice financially support hiring an additional staff member? Which role gives the best return?

**Calculations:**
1. **Current position:** Income, expenses, profit, margin, staff costs as % of income. GP count and hours from PRACTICE TEAM and PRACTICE OPERATIONS
2. **Cost of a new hire — three scenarios:**
   - Practice nurse: €35k–€42k salary + ~11% PRSI = €39k–€47k total
   - Receptionist: €23k–€27k + PRSI = €25.5k–€30k total
   - Salaried GP: €80k–€120k + PRSI = €89k–€133k total
3. **Subsidy offset:** PCRS practice support subsidy could offset 40–70% for qualifying practices
4. **Break-even analysis per role:**
   - Nurse: how many additional CDM registrations/screenings/vaccinations needed?
   - GP: how many additional consultations per day?
   - Receptionist: capacity/quality hire — affordable when profit exceeds €X
5. **Affordability assessment:** % of profit consumed. <30% comfortable, 30–50% stretch, >50% risky

**Report structure:**
- Comparison table of three options
- Recommended priority order

**Context profile:**
- Income categories: all
- Expense categories: all
- GMS data: summary
- Monthly trends: yes
- Prior year: yes
- Notes: Staff cost categories and practice profile team details are critical.

**Prompt:**

```
Analyse whether this practice can financially support hiring an additional staff member.

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

Present as a clear comparison table of the three options, with a recommended priority order.
```

---

### 12. Revenue Per GP

**ID:** `revenue-per-gp`
**Category:** Growth & Strategy
**Model:** Sonnet (Standard)
**Data:** Transactions
**Data Inputs:** Consultation fee, GP hours, working weeks, appointment duration

**Question:** How productive is each GP and where are the optimisation opportunities?

**Calculations:**
1. **Revenue per GP:** Total income / number of GPs (annual and monthly)
2. **Profit per GP:** Net profit / GPs — the GP's earning power before drawings
3. **Expenses per GP:** Total expenses / GPs — what each GP "costs" in overheads
4. **GMS income per GP:** If available, total GMS income / GPs — income from panel alone
5. **Overhead absorption rate:** (Non-GP staff + premises + supplies + admin) / GPs — what each GP must earn before generating profit
6. **Revenue per clinical hour:** Total income / total clinical hours (if GP hours available)
7. **Trend:** YoY change — growing (more productive) or declining (panel erosion/fee stagnation)

**Benchmarking:** Irish GP practices typically generate €250k–€400k gross income per GP depending on panel size and private mix.

**Report structure:**
- Bar chart comparing revenue, expenses, and profit per GP (grouped bars)
- Interpretation: low = under-billing/under-claiming/too many GPs? High = at capacity/missing growth?

**Context profile:**
- Income categories: all
- Expense categories: all
- GMS data: summary
- Monthly trends: yes
- Prior year: yes
- Notes: Need complete totals for per-GP ratio calculations.

**Prompt:**

```
Analyse revenue and profit per GP for this practice.

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

CHART: A bar chart comparing Revenue per GP, Expenses per GP, and Profit per GP as three grouped bars.

INTERPRETATION: What does the revenue-per-GP number tell us? If it's low, is the practice under-billing, under-claiming GMS items, or carrying too many GPs for its patient base? If it's high, is the practice at capacity and potentially missing growth opportunities?
```

---

### 13. Five-Year Financial Outlook

**ID:** `five-year-outlook`
**Category:** Growth & Strategy
**Model:** Opus (Strategic)
**Data:** Transactions + GMS Statements (optional)
**Data Inputs:** None

**Question:** What does the practice's growth trajectory look like based on current trends?

**Calculations:**
1. **Baseline trends:** Annual growth rate for income, expenses, net profit from available data
2. **Three scenarios projected over 5 years:**
   - **Conservative:** Income +2%/yr (typical GMS adjustments), expenses +4%/yr (inflation). Note when this turns profit-negative
   - **Steady state:** Historical rates (or 3% income / 3.5% expense if unavailable)
   - **Growth:** Income +5%/yr (new patients, services, better claiming), expenses +3.5%/yr (efficiencies)
3. **Year 5 metrics per scenario:** Projected income, expenses, profit, margin
4. **Critical decisions:**
   - Conservative shows decline — what levers change the trajectory?
   - Growth is attractive — what investment is needed?
   - At what year might the practice need to add a GP or nurse?

**Report structure:**
- Line chart of projected net profit under all 3 scenarios (solid, dashed, dotted lines)
- Clear caveat: projections based on trend extrapolation, not predictions

**Context profile:**
- Income categories: all
- Expense categories: all
- GMS data: full
- Monthly trends: yes
- Prior year: yes
- Notes: All historical data needed for trend extrapolation.

**Prompt:**

```
Project a 5-year financial outlook for this practice based on current trends.

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

CHART: A line chart showing projected net profit under all 3 scenarios over 5 years. Use distinct line styles (solid, dashed, dotted).

IMPORTANT CAVEAT: These are projections based on simple trend extrapolation, not predictions. State this clearly. Real outcomes depend on policy changes, patient demographics, and management decisions.
```

---

## Appendix: Context Profile Reference

Each report declares a `contextProfile` that controls what financial data is sent to Claude. This avoids sending irrelevant data (which wastes tokens and can confuse the analysis).

| Setting | Options | Effect |
|---------|---------|--------|
| `incomeCategories` | `'all'`, `'top'`, `'none'` | How many income categories to include |
| `expenseCategories` | `'all'`, `'top'`, `'none'` | How many expense categories to include |
| `gmsData` | `'full'`, `'summary'`, `'none'` | GMS/PCRS payment detail level |
| `monthlyTrends` | `true`, `false` | Include month-by-month breakdowns |
| `previousYear` | `true`, `false` | Include prior year data for YoY comparisons |
| `contextNotes` | string | Additional instruction to the context builder |

Special flags:
- `forceFullGMSContext: true` — Overrides the default GMS summary mode and sends the complete GMS Health Check analysis (used by GMS Optimisation Summary)
- `showSectionStatus: true` — Shows the 6-section Health Check completion checklist in the pre-generation modal
- `dataInputs: OPERATIONAL_DATA_INPUTS` — Shows the operational data input form before generation

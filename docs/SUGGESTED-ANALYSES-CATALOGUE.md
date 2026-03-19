# Suggested Analyses Catalogue

Reference document for all pre-built report templates in the Advanced Insights tab.

---

## Overview

| # | Report | Category | Model | Data Required | Data Inputs |
|---|--------|----------|-------|---------------|-------------|
| 1 | Income Source Analysis | Practice Overview | Opus (Strategic) | Transactions, GMS Statements | None |
| 2 | Practice Operating Cost | Practice Overview | Opus (Strategic) | Transactions | Consultation fee, GP hours, working weeks, appointment duration |
| 3 | Practice Health Check | Practice Overview | Opus (Strategic) | Transactions, GMS Statements | None |
| 4 | GMS Optimisation Summary | GMS & PCRS | Sonnet (Standard) | GMS Health Check (partial OK) | None |
| 5 | PCRS Payment Trends | GMS & PCRS | Sonnet (Standard) | GMS Statements | None |
| 6 | Tax Planning Checkpoint | Tax & Compliance | Opus (Strategic) | Transactions, GMS Statements | None |
| 7 | Year-End Tax Planning | Tax & Compliance | Opus (Strategic) | Transactions | None |
| 8 | Expense Deep Dive | Costs & Cash Flow | Sonnet (Standard) | Transactions | None |
| 9 | Seasonal Cash Flow | Costs & Cash Flow | Sonnet (Standard) | Transactions | None |
| 10 | Supplier & Vendor Review | Costs & Cash Flow | Sonnet (Standard) | Transactions | None |
| 11 | Should We Hire? | Growth & Strategy | Opus (Strategic) | Transactions, GMS Statements | Consultation fee, GP hours, working weeks, appointment duration |
| 12 | Revenue Per GP | Growth & Strategy | Sonnet (Standard) | Transactions | Consultation fee, GP hours, working weeks, appointment duration |
| 13 | Five-Year Financial Outlook | Growth & Strategy | Opus (Strategic) | Transactions, GMS Statements | None |

---

## Categories

- **Practice Overview** (blue) — Big-picture financial health and structure
- **GMS & PCRS** (pink) — Public health scheme income analysis
- **Tax & Compliance** (amber) — Tax position, deductions, and planning
- **Costs & Cash Flow** (green) — Expense analysis and cash flow patterns
- **Growth & Strategy** (purple) — Hiring, productivity, and forward planning

---

## Data Inputs (Operational Details)

Three reports prompt the user to enter operational details before generation. These are pre-filled from the practice profile if previously saved, and saved back on generate.

| Field | Unit | Range | Profile Storage Path |
|-------|------|-------|---------------------|
| Private consultation fee | € | 0–500 | `privatePatients.averageConsultationFee` |
| Clinical hours per GP per week | hrs | 1–80 | `operations.gpClinicalHoursPerWeek` |
| Working weeks per year | wks | 20–52 | `operations.workingWeeksPerYear` |
| Appointment duration | min | 5–60 | `operations.appointmentDuration` |

---

## Report Details

### 1. Income Source Analysis

**Category:** Practice Overview
**Model:** Opus (Strategic)
**Data:** Transactions + GMS Statements

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

**Context profile:** All income categories, top expenses, full GMS data, monthly trends, prior year

---

### 2. Practice Operating Cost

**Category:** Practice Overview
**Model:** Opus (Strategic)
**Data:** Transactions
**Data inputs:** Consultation fee, GP hours, working weeks, appointment duration

**Question:** What does it cost per hour to keep the practice open? What is the break-even number of consultations per day?

**Calculations:**
1. **Fixed costs:** Rent/rates, staff salaries (non-GP), insurance, utilities, software/IT, professional fees, loan repayments — monthly and annual
2. **Variable costs:** Medical supplies, locum fees, lab costs — monthly and annual
3. **Total operating cost:** Fixed + variable, monthly average
4. **Cost per clinical hour:** Total operating cost / (GPs x weekly hours x working weeks). Uses exact values from PRACTICE OPERATIONS — will not assume defaults
5. **Break-even consultations:** (Daily operating cost - daily GMS income) / consultation fee. Uses exact consultation fee from PRACTICE OPERATIONS
6. **Fixed cost ratio:** Fixed costs as % of total. Above 80% = very little flexibility in a downturn
7. **PRSI sanity check:** Flags if employer PRSI exceeds 15% of salary base (standard rate is 11.05%)

**Report structure:**
- Stacked bar chart of fixed vs variable costs by month
- Framed as "what it costs to turn the lights on each morning"
- Directly informs consultation fee setting, capacity to absorb quiet months, and hiring decisions

**Context profile:** Top income, all expenses, no GMS data, monthly trends, prior year

---

### 3. Practice Health Check

**Category:** Practice Overview
**Model:** Opus (Strategic)
**Data:** Transactions + GMS Statements

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

**Context profile:** All income, all expenses, GMS summary, monthly trends, prior year

---

### 4. GMS Optimisation Summary

**Category:** GMS & PCRS
**Model:** Sonnet (Standard)
**Data:** GMS Health Check (partial completion OK — minimum: PCRS statements + 1 Health Check section)

**Question:** What does the GMS Health Check analysis reveal about unclaimed income, and what are the priority actions?

**Key design principle:** Claude **summarises and presents** the app's pre-computed GMS Health Check results. It does NOT perform its own analysis, estimate panel sizes, or use national benchmarks. All numbers come from `analyzeGMSIncome()` and `generateRecommendations()`.

**Prerequisite:** The modal shows a 6-section checklist (PCRS Statements, Patient Demographics, Practice Support, Leave Entitlements, Disease Registers, Cervical Screening) with tick/cross indicators. At least PCRS data plus one section must be available.

**Report structure:**
1. **Headline** with total unclaimed income and sections-analysed count (e.g. "Based on 4 of 6 Health Check areas...")
2. **Priority actions table** — from recommendations, ordered by value
3. **Section summaries** — 2-3 sentences per available section (capitation, practice support, leave, CDM, cervical screening, STCs)
4. **Not Yet Analysed** — lists incomplete sections with nudge to complete the Health Check
5. **Growth opportunities** — separate from priority actions (administrative fixes vs activity increases)
6. **Next steps** — 3-5 actionable items
7. **Horizontal bar chart** of unclaimed income by category

**Context:** Uses `forceFullGMSContext: true` to send the complete GMS Health Check analysis to Claude, bypassing the summary-only default for non-Health-Check pages.

**Context profile:** No income/expense categories, full GMS data, no trends

---

### 5. PCRS Payment Trends

**Category:** GMS & PCRS
**Model:** Sonnet (Standard)
**Data:** GMS Statements only

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

**Context profile:** No income/expense categories, full GMS data

---

### 6. Tax Planning Checkpoint

**Category:** Tax & Compliance
**Model:** Opus (Strategic)
**Data:** Transactions + GMS Statements

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

**Context profile:** All income, all expenses, GMS summary, monthly trends, prior year

---

### 7. Year-End Tax Planning

**Category:** Tax & Compliance
**Model:** Opus (Strategic)
**Data:** Transactions

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

**Context profile:** All income, all expenses, no GMS, monthly trends, prior year

---

### 8. Expense Deep Dive

**Category:** Costs & Cash Flow
**Model:** Sonnet (Standard)
**Data:** Transactions

**Question:** What are the unusual spending patterns, fastest-growing costs, and biggest savings opportunities?

**Calculations:**
1. **Top 10 expense categories:** Amount, % of total, YoY change
2. **Fastest growing:** 3 categories with highest % growth YoY. Even small absolute amounts worth investigating if 50%+ jump
3. **Anomaly scan:** Flag any month where a category exceeds 2x its monthly average (one-off purchase? billing error? duplicate?)
4. **Staff cost ratio:** All salary/PRSI/pension as % of income
5. **Premises cost ratio:** Rent/rates/insurance/utilities/maintenance as % of income
6. **Savings opportunities:** 3 categories with most realistic savings potential — recurring costs where renegotiation or switching is possible

**Report structure:**
- Horizontal bar chart of top 10 expenses by annual spend
- Factual and data-driven — no speculation on costs not visible in data

**Context profile:** Top income, all expenses, no GMS, monthly trends, prior year

---

### 9. Seasonal Cash Flow

**Category:** Costs & Cash Flow
**Model:** Sonnet (Standard)
**Data:** Transactions

**Question:** What is the practice's financial rhythm through the year, and how should it plan for lean months?

**Calculations:**
1. **Monthly net cash flow:** Income minus expenses per month, ranked strongest to weakest
2. **Best and worst months:** Top 3 and bottom 3. Are they consistent across years (true seasonal) or one-off?
3. **Income seasonality:** Flu season (Oct–Mar) drives consultations, summer holidays reduce private visits, PCRS quarterly patterns
4. **Expense seasonality:** Locum costs during holidays, insurance renewals, equipment purchases, tax payments
5. **Cash buffer calculation:** Worst single month deficit x 1.5 = recommended accessible cash buffer
6. **Cumulative cash flow:** Running total through the year to reveal extended draw-down periods

**Report structure:**
- Combination chart: monthly income bars + expense bars + net cash flow line overlay (most recent complete year)
- Practical scheduling, billing, and cost management actions to smooth the cycle

**Context profile:** Top income, top expenses, GMS summary, monthly trends, prior year

---

### 10. Supplier & Vendor Review

**Category:** Costs & Cash Flow
**Model:** Sonnet (Standard)
**Data:** Transactions

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

**Context profile:** No income, all expenses, no GMS, no trends, prior year

---

### 11. Should We Hire?

**Category:** Growth & Strategy
**Model:** Opus (Strategic)
**Data:** Transactions + GMS Statements
**Data inputs:** Consultation fee, GP hours, working weeks, appointment duration

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

**Context profile:** All income, all expenses, GMS summary, monthly trends, prior year

---

### 12. Revenue Per GP

**Category:** Growth & Strategy
**Model:** Sonnet (Standard)
**Data:** Transactions
**Data inputs:** Consultation fee, GP hours, working weeks, appointment duration

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

**Context profile:** All income, all expenses, GMS summary, monthly trends, prior year

---

### 13. Five-Year Financial Outlook

**Category:** Growth & Strategy
**Model:** Opus (Strategic)
**Data:** Transactions + GMS Statements

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

**Context profile:** All income, all expenses, full GMS, monthly trends, prior year

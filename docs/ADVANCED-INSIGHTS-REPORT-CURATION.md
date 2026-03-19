# Advanced Insights — Report Curation Analysis

## Part 1: Evaluation of External Agent's Suggestions

### CSV Document: "GP Analytics Report Framework Development"

The agent proposed 4 report concepts. I've evaluated each against our actual data.

#### 1. Operational Efficiency & Patient Flow
- **Requires:** Appointment timestamps, DNA flags, wait times, provider IDs
- **We have:** None of this
- **Verdict: NOT FEASIBLE.** We have zero appointment or scheduling data. We're a financial tool, not a practice management system. This entire concept requires EHR/PMS integration we don't have and shouldn't pursue — it's a completely different product.

#### 2. Financial Mix & Revenue Cycle
- **Requires:** Billing records, payer type, service codes, claim status
- **We have:** Bank transactions (categorised), PCRS payment breakdowns, withholding tax data
- **Verdict: PARTIALLY FEASIBLE — and the feasible parts are excellent.** We can derive the GMS vs private income split (total income minus PCRS = private). We can track PCRS payment categories over time. We cannot do per-patient billing analysis, individual claim status tracking, or debtor days. But the core insight — "where does your money come from?" — is achievable and high-value.

#### 3. Population Health & Capacity Planning
- **Requires:** Demographics, diagnosis codes, last visit dates, care flags
- **We have:** PCRS panel demographics (age bands), disease register counts (asthma/diabetes if from EHR), panel size
- **Verdict: MOSTLY NOT FEASIBLE.** We have demographic totals from PCRS statements, but no diagnosis codes, no visit dates, no care flags. We could show a basic demographic breakdown but not the sophisticated capacity planning they envision. The seasonal demand aspect could be approximated from financial data patterns.

#### 4. Staff Utilization & Task Shifting
- **Requires:** Appointment and task logs mapped to staff role
- **We have:** Staff profiles (roles, hours, costs), practice support subsidy data
- **Verdict: NOT FEASIBLE as described, but a FINANCIAL VERSION is possible.** We can't track what tasks staff do. But we can calculate staff cost per clinical hour, revenue per FTE, and whether subsidy claims match actual staffing — which is arguably more useful for a business tool anyway.

### DOCX Document: "GP Data Analysis for Practice Insights"

This agent clearly understood our constraints better. All 3 suggestions are grounded in data we actually have.

#### 1. Payer Mix & Private Fee Viability Report
- **Requires:** Total bank deposits + PCRS totals
- **We have:** Both — transactions give total income, PCRS data gives state payments
- **Verdict: HIGHLY FEASIBLE and HIGH VALUE.** The insight (total income minus PCRS = private revenue) is simple but most GPs have never seen it presented clearly. Combining this with the practice profile's consultation fee data lets us estimate whether their private fees cover their costs. This should be a priority report.

#### 2. PCRS Scheme Yield & Trend Analysis
- **Requires:** PCRS statement line items month-by-month
- **We have:** Exactly this — our `paymentAnalysisData` has per-category, per-month breakdowns
- **Verdict: HIGHLY FEASIBLE and HIGH VALUE.** This is essentially a deeper version of what the GMS Health Check already surfaces, but packaged as a trend analysis rather than a point-in-time check. Spotting CDM payment drops, cervical screening gaps, and subsidy changes over time is the kind of insight GPs would pay for.

#### 3. Clinical Capacity & Revenue Per Hour
- **Requires:** Staff hours + revenue data
- **We have:** Practice profile has GP count and staff hours; transactions have revenue
- **Verdict: FEASIBLE with caveats.** We have total hours from the practice profile (which may not be exact) and total revenue from transactions. The "cost per hour to operate" metric is powerful — GPs rarely know this number. The caveat is that our hours data is static (from profile setup) rather than tracked over time.

---

## Part 2: What Data Do We Actually Have?

Before proposing reports, here's an honest inventory:

### Rich Data (high confidence, granular)
- **Bank transactions:** Every credit/debit, categorised into 90+ categories, with dates and descriptions. Multiple years possible.
- **PCRS/GMS payments:** Monthly breakdowns by payment type (capitation, CDM, cervical screening, STCs, practice support, leave). Per-doctor granularity. Demographics per panel.
- **GMS rates:** Full Irish rate cards — capitation by age band, STC code fees, subsidy scales, disease management rates. Plus national benchmark data.
- **Category mappings:** Deep knowledge of what each expense category means in a GP practice context.

### Moderate Data (useful but limited)
- **Practice profile:** Number of GPs, staff roles/hours, practice type, location, panel size, private patient estimates. Static — set once during onboarding.
- **Withholding tax:** Calculated from PCRS and state contract income.
- **Financial calculations:** P&L, monthly trends, year-on-year comparisons, profit margins.

### Data We Don't Have (and shouldn't pretend we do)
- Appointment/scheduling data
- Patient-level clinical records
- Per-patient billing
- Time tracking per GP or per activity
- Insurance/claim submission status
- Debtor aging or accounts receivable
- Drug/prescription data
- KPI targets or goals

---

## Part 3: Independent Report Recommendations

Thinking from the GP practice owner's perspective, here are the problems they actually face — and which ones we can help solve.

### Tier 1: High-Confidence, High-Value (build these)

These reports use our richest data and solve problems GPs genuinely have.

---

#### 1. "Where Does Your Money Come From?" — Income Source Analysis
**Problem:** GPs know roughly what they earn but rarely see the composition clearly. They don't know how dependent they are on any single income stream.

**What we can do:**
- Break total income into: GMS capitation, CDM/disease management, cervical screening, STCs, practice support, leave payments, private consultations (derived), other income
- Show this as proportions and trends over time
- Flag concentration risk (e.g., "72% of income comes from GMS — here's what that means")
- Compare their mix to what we know about typical Irish practices

**Data sources:** transactions (income categories) + paymentAnalysisData (PCRS breakdown)

**Why it matters:** This is the single most requested insight from any small business owner. For GPs, the public/private split has massive strategic implications.

---

#### 2. "Are You Leaving Money on the Table?" — Unclaimed Income Audit
**Problem:** The PCRS system is complex. GPs routinely under-claim CDM payments, miss cervical screening opportunities, and don't optimise their STC billing.

**What we can do:**
- Compare their CDM claims against panel demographics (if they have 500 over-70s but only 50 CDM registrations, that's a gap)
- Analyse cervical screening zero-payment reasons and calculate lost income
- Compare their STC claiming pattern against national benchmarks (per 1,000 patients)
- Check practice support subsidy against entitlements (wrong increment points, under-claimed hours)
- Estimate the euro value of each gap

**Data sources:** paymentAnalysisData (PCRS details) + gmsRates (benchmarks) + practice profile

**Why it matters:** This is where we can deliver immediate, concrete financial value. "You could be earning €12,400 more per year" is the kind of insight that sells software.

---

#### 3. "What Does It Cost to Open Your Doors?" — Practice Operating Cost Analysis
**Problem:** GPs think in terms of "I earn X and spend Y" but rarely calculate their cost-per-hour of operation or understand their fixed vs variable cost structure.

**What we can do:**
- Calculate total fixed costs (rent, insurance, salaries, utilities) vs variable costs (supplies, locums)
- Derive cost-per-clinical-hour using practice profile hours
- Show how this cost changes over time
- Calculate break-even: how many consultations per day at their fee to cover costs
- "Your practice costs €X per hour to operate. At €Y per private consultation, you need Z patients per hour just to break even."

**Data sources:** transactions (expense categories) + practice profile (hours, GPs)

**Why it matters:** This is the fundamental business metric that 95% of GPs have never calculated. It directly informs hiring decisions, fee setting, and whether the practice is sustainable.

---

#### 4. "Month-by-Month: Your Practice's Financial Rhythm" — Cash Flow Pattern Analysis
**Problem:** GP practices have seasonal patterns (flu season revenue, summer locum costs, quarterly PCRS payments) but most owners are surprised by lean months every year.

**What we can do:**
- Map income and expense by month across multiple years
- Identify their 3 strongest and 3 weakest months
- Detect recurring seasonal patterns (Q4 locum spike, January private drop-off, etc.)
- Calculate monthly cash buffer needed to smooth the cycle
- Flag months where expenses exceed income

**Data sources:** transactions (dated, categorised)

**Why it matters:** Cash flow kills small businesses. Knowing "February and August are always tight" lets practices plan rather than panic.

---

#### 5. "Your Expenses Under the Microscope" — Cost Category Deep Dive
**Problem:** GPs know their total costs but often don't scrutinise where costs are rising fastest or whether specific categories are out of line.

**What we can do:**
- Rank all expense categories by size and growth rate
- Flag the fastest-growing categories year-on-year
- Identify expense anomalies (unusual one-off costs, sudden category jumps)
- Show staff costs as % of revenue (the single most important GP expense ratio)
- Highlight recurring subscription/vendor costs that might be renegotiable

**Data sources:** transactions (expense categories, multi-year)

**Why it matters:** "Your medical supply costs rose 34% this year while everything else rose 5%" is actionable intelligence.

---

### Tier 2: Valuable With Some Inference (worth building, with honest caveats)

These require combining our data with AI reasoning and domain knowledge. Claude makes these possible where a pure-data tool couldn't.

---

#### 6. "Should You Hire?" — New Hire Financial Impact Model
**Problem:** The #1 strategic question in any growing practice. GPs agonise over whether they can afford another nurse, secretary, or GP.

**What we can do:**
- Calculate current revenue per GP and per staff member
- Model the cost of a new hire (using HSE pay scales we know)
- Estimate break-even: how much additional revenue the hire would need to generate
- Factor in practice support subsidy recovery (a new nurse may be partially subsidised)
- Compare staffing ratios to practice profile benchmarks

**Caveat:** We don't have workload data, so we can't tell them if they *need* to hire — only whether they can *afford* to.

**Data sources:** transactions + practice profile + gmsRates (subsidy scales)

---

#### 7. "Tax Planning Checkpoint" — Annual Tax Position Summary
**Problem:** GPs often don't think about tax strategy until year-end when it's too late to optimise.

**What we can do:**
- Calculate known withholding tax (from PCRS + state contracts)
- Estimate taxable profit based on income minus deductible expenses
- Flag potentially under-claimed deduction categories
- Remind about pension contributions, capital allowances, and timing strategies
- Show drawings vs profit to flag personal tax planning needs

**Caveat:** We're not an accounting system. Must be clear this is for planning, not filing.

**Data sources:** transactions + paymentAnalysisData (withholding tax) + practice profile

---

#### 8. "PCRS Payment Trends" — Scheme-by-Scheme Trajectory
**Problem:** GPs look at the bottom line of their PCRS statement but miss important trends in individual payment streams.

**What we can do:**
- Plot each PCRS payment category over time (capitation, CDM, cervical screening, STCs, practice support)
- Highlight schemes that are growing, declining, or volatile
- Correlate changes with known rate changes or policy shifts
- Flag when a scheme suddenly drops (likely missed claims, not rate change)
- Compare per-panel performance if multi-doctor practice

**Data sources:** paymentAnalysisData (monthly breakdowns)

**Why it matters:** "Your CDM payments dropped 40% in Q3 — did you miss annual reviews?" is the kind of alert that pays for itself.

---

#### 9. "Practice Viability Score" — Composite Health Dashboard
**Problem:** GPs want a simple answer to "how is my practice doing?" but the reality involves multiple interconnected factors.

**What we can do:**
- Compute a composite score based on: profit margin, income diversity, cost trajectory, GMS optimisation, staff cost ratio, cash flow stability
- Present as a simple dashboard with red/amber/green indicators
- Identify the 1-2 areas dragging the score down most
- Suggest the single highest-impact action to improve

**Caveat:** The weighting of the composite is inherently subjective. Be transparent about methodology.

**Data sources:** All available data

---

#### 10. "Five-Year Outlook" — Trend Projection
**Problem:** GPs rarely think beyond the next quarter. They need a long-term view for partnership decisions, retirement planning, and practice investment.

**What we can do:**
- Project income and expense trends forward based on historical growth rates
- Factor in known GMS rate change patterns
- Model different scenarios (status quo, add a GP, lose 100 panel patients, etc.)
- Highlight the year when current trends become unsustainable if they do

**Caveat:** Projections are inherently speculative. Must be presented as scenarios, not predictions.

**Data sources:** transactions (multi-year trends) + gmsRates + practice profile

---

### Tier 3: Aspirational (don't build yet, but worth noting for the roadmap)

#### 11. Peer Benchmarking
If we ever accumulate anonymised data across practices, comparing "your staff cost ratio vs practices in your size band" would be transformative. Not feasible until we have enough users.

#### 12. Appointment Yield Analysis
If we ever integrate with a scheduling system, combining financial data with appointment data would enable revenue-per-appointment, optimal scheduling, and true capacity planning. This is the full vision of Report 1 from the CSV.

#### 13. Drug Cost Analysis
If we ever get prescription data (via EHR integration), we could analyse prescribing costs and identify generics savings. Currently impossible.

---

## Part 4: Mapping Against Existing Suggested Analyses

Current `suggestedAnalyses.js` has 12 reports in 4 categories. Here's how they map:

| Existing Report | My Assessment | Notes |
|---|---|---|
| Tax Efficiency Review | Keep — maps to my #7 | Good prompt, high value |
| Withholding Tax Strategy | Keep but merge into #7 | Too narrow as standalone |
| Year-End Tax Planning | Keep — seasonal variant of #7 | Time it to Q4 |
| Should We Hire? | Keep — my #6 | Excellent concept |
| Revenue Per GP | Keep — feeds into #3 | Good standalone metric |
| Five-Year Outlook | Keep — my #10 | Add scenario modelling |
| Unclaimed GMS Income | Keep — my #2 | This is our killer feature |
| GMS Payment Trends | Keep — my #8 | Strong with our PCRS data |
| GMS vs Private Balance | Keep — my #1 | Rename, make it broader |
| Expense Anomaly Detection | Keep — part of my #5 | Good concept |
| Seasonal Cash Flow | Keep — my #4 | Very practical |
| Supplier & Vendor Review | Keep but refine | Limited by transaction descriptions |

### Recommended Changes to Existing Set

1. **Add:** "Practice Operating Cost" report (#3 above) — the cost-per-hour insight is missing and it's arguably the most valuable single number
2. **Add:** "Practice Viability Score" (#9) — GPs want a simple summary before diving into details
3. **Merge:** Withholding Tax Strategy into a broader "Tax Planning Checkpoint"
4. **Rename:** "GMS vs Private Balance" → "Income Source Analysis" (broader, less jargon)
5. **Add category:** Consider a 5th category: "Practice Health" or "Business Overview" for the composite/holistic reports

### New Category Structure Proposal

| Category | Reports | Focus |
|---|---|---|
| **Practice Overview** | Income Source Analysis, Practice Viability Score, Operating Cost Analysis | "How is my business doing?" |
| **GMS & PCRS** | Unclaimed GMS Income, PCRS Payment Trends, GMS vs Private Balance | "Am I getting everything I'm owed?" |
| **Tax & Compliance** | Tax Planning Checkpoint, Year-End Planning | "Am I being tax-efficient?" |
| **Costs & Cash Flow** | Expense Deep Dive, Seasonal Cash Flow, Supplier Review | "Where is my money going?" |
| **Growth & Strategy** | Should We Hire?, Revenue Per GP, Five-Year Outlook | "What should I do next?" |

---

## Part 5: Implementation Priority

If I were sequencing these for maximum user impact:

1. **Unclaimed GMS Income** — immediate, concrete financial value. "You're missing €X."
2. **Income Source Analysis** — every GP wants to know this, and we can compute it today
3. **Practice Operating Cost** — the "aha moment" metric most GPs have never seen
4. **PCRS Payment Trends** — leverages our richest unique data
5. **Expense Deep Dive** — straightforward, universally useful
6. **Seasonal Cash Flow** — practical planning tool
7. **Should We Hire?** — high-value strategic question
8. **Tax Planning Checkpoint** — seasonal relevance
9. **Practice Viability Score** — once we've validated the individual reports
10. **Five-Year Outlook** — nice to have, lower urgency

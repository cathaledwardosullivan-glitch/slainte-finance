# Report Quality Improvement Plan

> **Status:** Planning — no code changes yet. For review and discussion.
> **Date:** 2026-03-12

---

## Problem Statement

Finn-generated reports sometimes suffer from:
- **Confabulation** — when data is missing, Finn fills gaps with general population statistics or invented details instead of acknowledging the limitation
- **Inconsistent voice** — reports feel like they were written by different people depending on the model's mood
- **Unanswered questions** — reports contain hedged conclusions where a simple clarifying question to the user could have produced a definitive answer
- **Unvalidated claims** — numbers in the narrative may not match the source data, and there's no verification step before presentation

---

## Three Improvement Tracks

### Track 1: Style Guide

**What:** A set of voice, formatting, and behavioural rules injected into the `reportSystemPrompt` in `generateDetailedReport()` (FinnContext.jsx ~line 1841).

**Current state:** Draft complete at `docs/FINN-REPORT-STYLE-GUIDE-DRAFT.md`. Seven open decisions marked `[DECISION NEEDED]`.

**Key components:**
- Voice/tone definition — direct, data-grounded, concise, honest about limits
- Confidence language table — different phrasing for facts vs estimates vs benchmarks vs speculation
- Data formatting rules — monetary values, percentages, date references
- Chart rules — Y-axis at zero, max charts per report, chart-vs-table decision, colour palette
- "Things Finn Should Never Do" — no emojis, no self-introduction, no fabricated data, no marketing language
- Consistent recommendation format — action verb + specific thing + one sentence why

**Recommended decisions on open items:**
| # | Decision | Recommendation |
|---|----------|----------------|
| 1 | How to address the GP | Option C: Mix — "Your" for actions, "The practice" for facts |
| 2 | Section naming | Fixed core (Key Findings, Analysis, Recommendations) + 1 contextual |
| 3 | Monetary format | Full figures in tables (€274,968), rounded in narrative (€275K) |
| 4 | Chart colours | Option C: Hybrid — brand colours for income/expense, professional palette for multi-series |
| 5 | Number of recommendations | Always 3–5, prioritised by financial impact |
| 6 | Y-axis at zero | Always, with rare annotated exceptions |
| 7 | Max charts per report | 1–2 standard, 2–3 strategic |

**Implementation:** Add style guide as a new section within `reportSystemPrompt`. System-level instructions are followed more reliably than user-level ones. The guide is compact enough to fit without significant token cost.

**Impact:** High. Single change improves consistency across all 13 reports and ad-hoc reports.

---

### Track 2: Prompt Curation

**What:** Improve the individual prompts in `src/data/suggestedAnalyses.js` so each report has clear instructions for what to do when data is complete, partial, or missing.

**Current state:** Catalogue with full prompts documented at `docs/SUGGESTED-ANALYSES-CATALOGUE-V2.md`. Prompts already specify calculations and chart types. Some (e.g., Operating Cost) have good guardrails. Others (e.g., Five-Year Outlook) lack failure-mode instructions.

**Key improvement: Failure-mode tiers for every prompt.**

Each prompt should define three tiers:

1. **Primary analysis** — what to calculate when all data is present (already done for most reports)
2. **Degraded analysis** — what to do with partial data. E.g., "If only 1 year of data is available, skip YoY comparisons and state this limitation."
3. **Hard stops** — what to refuse to attempt. E.g., "If no transaction data is loaded, do NOT generate this report. State that transaction data is required."

**Example of a missing guardrail (Five-Year Outlook):**
> Current: "If only one year of data is available, use that as the baseline and apply reasonable growth assumptions."
>
> Problem: "reasonable growth assumptions" gives Finn licence to fabricate. Better:
>
> "If only one year of data is available, state that trend-based projections require at least 2 years. Present the three scenarios using the fixed growth rates only (2%/3%/5% income growth) and clearly label them as assumed rates, not derived from practice data."

**Pre-validation using `contextProfile`:**

Each report already declares its data requirements via `contextProfile` (e.g., `gmsData: 'full'`). The context builder could check these before sending to Claude:
- If a required data source is missing, either block generation with a clear message, or inject a warning into the prompt: `"WARNING: This report requires GMS data but none is available. Limit your analysis to what can be derived from transaction data alone."`
- This catches the problem *before* the API call rather than relying on Claude to notice.

**Impact:** High. Directly addresses the confabulation problem at source.

---

### Track 3: Draft Review System

**What:** After Finn generates a report, a second API call reviews the draft against the source data before presenting it to the user. Two distinct sub-features.

#### 3a. Quality Review (Accuracy Check)

**Concept:** A Haiku-based reviewer receives the draft report + the same source data and checks for:
- Factual claims that don't match the numbers in the data
- Claims presented as practice-specific that are actually general knowledge
- Confidence language mismatches (stating speculation as fact)
- Mathematical errors (e.g., percentages that don't add up)

**Implementation sketch:**
```
[User clicks Generate]
  → Build context (existing flow)
  → Call Opus/Sonnet to generate draft (existing flow)
  → Call Haiku with review prompt:
      "Review this report against the source data.
       For each factual claim:
       1. Can it be verified from the source data?
       2. Does the number match?
       3. Is it labelled with the correct confidence level?
       Return issues found, or PASS."
  → If PASS: save and present report (existing flow)
  → If issues found: either auto-correct numbers, or re-generate
      with issues as additional constraints
```

**Cost:** One additional Haiku call per report. Haiku is fast and cheap — an Opus draft + Haiku review is cheaper than two Opus calls.

**Where in the code:** After the `generateDetailedReport()` call returns but before `saveReport()` in the `startBackgroundReport` function.

**Impact:** High. Catches errors that no amount of prompt engineering can fully prevent.

#### 3b. Pre-Report Clarification Questions

**Concept:** Before generating (or after a draft), identify questions that would materially improve the report and ask the user.

**Two approaches:**

| | Approach A: Pre-generation | Approach B: Post-draft |
|---|---|---|
| **When** | Before the Opus/Sonnet call | After draft, before presentation |
| **How** | Haiku examines context vs report requirements, returns 0–3 questions | Reviewer identifies unanswered questions from the draft |
| **Pro** | Doesn't waste an expensive call on an incomplete report | Questions are more precise; user gets something immediately |
| **Con** | Adds friction; some questions only emerge mid-analysis | Two full calls if user answers and re-generates |
| **Best for** | Reports with `dataInputs` (already has pre-generation modal) | Ad-hoc reports and reports without predictable gaps |

**Recommendation:** Start with Approach A for reports that already have the `dataInputs` modal (Operating Cost, Should We Hire?, Revenue Per GP). The infrastructure exists — extend the modal to show "Finn has a question" alongside the operational data inputs. For other reports, defer to Approach B as a later enhancement.

**Example interaction:**
> User clicks "Income Source Analysis" → Haiku scans context → finds no consultation fee data →
> Modal shows: "To make this report more specific, could you confirm: What is your average private consultation fee? (Skip to generate without this)"
> User enters €65 → report uses real figure instead of hedging.

**Impact:** Very high per-report improvement, but more complex to build. Start narrow (extend `dataInputs`), expand later.

---

## Recommended Priority Order

| Priority | Track | Effort | Impact | Risk |
|----------|-------|--------|--------|------|
| 1 | **Style Guide → `reportSystemPrompt`** | Low (prompt text change) | High (all reports improve) | Low |
| 2 | **Failure-mode tiers in prompts** | Medium (13 prompts to update) | High (fixes confabulation) | Low |
| 3 | **Context pre-validation** | Medium (code change in context builder) | Medium (prevents bad inputs) | Low |
| 4 | **Haiku quality review** | Medium (new API call + logic) | High (catches remaining errors) | Low |
| 5 | **Pre-generation clarification** | Higher (UX + API changes) | Very high per-report | Medium (UX friction) |

Tracks 1 and 2 are pure prompt improvements — no architectural changes, no new API calls, no UX changes. They should be done first and will resolve the majority of current issues.

Tracks 3–5 are code changes that add defence-in-depth. The quality review (Track 4) is the best bang-for-buck code change. Clarification questions (Track 5) are the most impactful but need careful UX design to avoid slowing down the "one-click generate" experience.

---

## Reference Documents

| Document | Location | Purpose |
|----------|----------|---------|
| Style Guide Draft | `docs/FINN-REPORT-STYLE-GUIDE-DRAFT.md` | Voice, formatting, and behavioural rules |
| Analyses Catalogue V2 | `docs/SUGGESTED-ANALYSES-CATALOGUE-V2.md` | All 13 reports with full prompts |
| Curation Analysis | `docs/ADVANCED-INSIGHTS-REPORT-CURATION.md` | Data feasibility assessment and report recommendations |
| Report Generation Code | `src/context/FinnContext.jsx` (~line 1821) | `generateDetailedReport()` function |
| Suggested Analyses Code | `src/data/suggestedAnalyses.js` | Prompt definitions and context profiles |
| Context Builder | `src/utils/ciaranContextBuilder.js` | Builds practice context for prompts |

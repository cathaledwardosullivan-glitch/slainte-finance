# Context-Compiled Architecture Review

**Date:** 2026-04-06
**Origin:** Review of "LLM Wiki" / Context-Compiled architecture spec against existing codebase
**Inspiration:** [YouTube — Context Compiled LLM pattern](https://youtu.be/2X4m2ws82iY)

---

## Summary

An architecture spec for a "Context Compiled" financial advisor was evaluated against the existing Finn implementation. The core finding: **Slainte Finance already implements this pattern organically**, and in some respects has gone further than the spec describes.

The spec proposed four layers — Local Data Engine, Context Compiler, LLM Advisor, and Background Linting. Three of the four are already built. The fourth (background linting) is better served by deterministic local checks than by LLM calls.

---

## What We Already Have (Mapped to Spec)

| Spec Component | Existing Implementation |
|---|---|
| **Local Data Engine** (raw math, secure storage) | `financialCalculations.js`, `transactionProcessor.js`, `gmsRates.js`, `healthCheckCalculations.js` |
| **Context Compiler** (structured profile for LLM) | `ciaranContextBuilder.js` (practice profile), `FinnContext.jsx` → `getFinancialContext()` (financial snapshot), `gmsHealthCheckContext.js` (GMS analysis) |
| **LLM Advisor** (Claude + guardrails) | `claudeAPI.js` + `FinnContext.jsx` agentic tool loop with system prompt constraints |
| **PII Sanitization** | Not built — determined unnecessary (see below) |
| **Background Linting** | Partial — `system_status` tool + proactive greeting on chat open |

### Where We've Gone Further Than the Spec

The spec assumes all context is **pushed** into the prompt window. Finn uses a **pull model** via agentic tools — a lean summary is injected, and Finn calls `lookup_financial_data` / `search_transactions` to retrieve specifics on demand. This is more token-efficient and scales better as data grows.

---

## Decisions Made

### PII Sanitization Layer — Not Building

**Reasoning:** The Anthropic API terms (no training on API data, 7-day log retention, SOC 2 Type II, HIPAA BAA available) are the same commitments relied upon by:
- NBIM (Norway's $1.7T sovereign wealth fund, 600+ employees)
- Citi, AIG, LPL Financial, Bridgewater Associates
- Banner Health (55,000 employees, clinical use)
- Novo Nordisk (pharma regulatory content)
- PwC, Accenture, Deloitte, KPMG (for regulated-industry clients)

A regex-based PII scrubber would add maintenance burden, risk false positives on legitimate financial reference numbers, and solve a problem that contractual terms already address. If needed for marketing: *"We use the same Anthropic API trusted by Citigroup, AIG, and Norway's sovereign wealth fund."*

### Unified Wiki Compiler — Not Building

**Reasoning:** The current scattered builders (`buildCiaranContext`, `getFinancialContext`, `buildGMSHealthCheckContext`) are a feature, not a bug. They enable selective context injection — only relevant context per query. A unified compiler would either waste tokens (include everything) or replicate the same conditional logic in a new location. The tool-use architecture already solved the "too much context" problem more elegantly.

### Formalized Guardrails File — Not Building Now

**Reasoning:** System prompt guardrails (role constraint, math constraint, hallucination prevention) already exist inline in FinnContext. Extracting to a separate file is pure refactoring with no forcing function. Revisit if the system prompt grows significantly or another developer needs to modify guardrails independently.

---

## What To Build: Deterministic Anomaly Detection

The one genuinely new capability from the spec, reimagined as local logic rather than LLM calls.

### Concept

A `src/utils/anomalyDetection.js` module with focused, rule-based checks that run after transaction imports via `backgroundProcessor.cjs`. No API cost, instant results, high signal-to-noise.

### Candidate Checks

1. **PCRS payment deviation** — Compare received payment against expected capitation for panel size. Flag if >10% below expected.
2. **Missing recurring payment** — Detect regular payments (same description, monthly frequency) that didn't appear in the latest import.
3. **Unclaimed leave approaching deadline** — Compare claimed study/annual leave days against entitlement as year-end approaches.
4. **Staff salary anomaly** — Flag if a regular salary payment amount changed unexpectedly (could indicate payroll error).
5. **Categorisation quality drift** — Track unidentified transaction rate over time; flag if it increases after an import.

### Integration Point

Wire into `backgroundProcessor.cjs` — after processing a new file, run anomaly checks against the updated dataset. Attach findings to the staged results so they appear in the review panel alongside the transactions. No separate notification system required.

Finn already handles the narrative layer — if a user asks "what should I do about this?", the existing agentic flow provides the explanation and recommendation.

### Priority

Low-to-medium. High ROI relative to effort, but not blocking any current work. Good candidate for a quiet week or when expanding the background processor's capabilities.

---

## Future Considerations (Low Priority)

### User-Facing Financial Profile Export

The "wiki" concept repurposed: a compiled practice financial summary that the owner can view, export as PDF, or share with their accountant. Uses the same data sources and builders that Finn uses. Closer to a report template in `suggestedAnalyses.js` than a new architecture component.

### Background Processor as General-Purpose Job Runner

Currently watches the inbox for bank statements. Could also be the execution point for:
- Anomaly detection (above)
- Scheduled report generation
- Data quality checks
- Any periodic local computation

The infrastructure is new and underutilised. Worth considering what other processes could benefit from background execution as new features are built.

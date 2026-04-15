# Sláinte Finance — Development Roadmap

> **Last updated:** 2026-04-08
> **Purpose:** Single source of truth for all planned, in-progress, and backlog features.
> Items are grouped by priority tier. Each links to its detailed plan document where one exists.

---

## Tier 1: Pre-Beta / High Priority

| Feature | Status | Detail Doc | Notes |
|---------|--------|-----------|-------|
| Security Audit Phase 3 — Prompt injection mitigations | TODO | `docs/SECURITY-AUDIT-PRE-BETA.md` | Wrap user data in `<user_data>` delimiters, max-length truncation. Moderate risk — test with real data. Post-beta OK. |
| Security Audit Phase 4 — Defence-in-depth | TODO | `docs/SECURITY-AUDIT-PRE-BETA.md` | Electron sandbox, reduce body limit to 5MB, IPv6 validation. Post-beta OK. |
| Electron 41 Upgrade | PLANNED | `memory/electron-upgrade-plan.md` | 15 high CVEs in Electron <=39.8.4. Requires preload/IPC and electron-builder compat testing. |
| Post-onboarding TransactionUpload → inbox routing | TODO | `memory/inbox-onboarding-plan.md` | Main TransactionUpload.jsx should route through inbox like onboarding does, not browser-side parsing. |

---

## Tier 2: Report System

| Feature | Status | Detail Doc | Notes |
|---------|--------|-----------|-------|
| Report Style Guide — prompt injection (Phase 1) | DONE | `docs/FINN-REPORT-STYLE-GUIDE-DRAFT.md` | Voice, formatting, confidence language, chart rules injected into `reportSystemPrompt`. |
| Report Theme Object (Phase 2) | DONE | `src/utils/reportTheme.js` | Shared theme consumed by screen renderer and PDF export. |
| Unify non-AI report visuals (Phase 3) | TODO | — | Apply shared visual language to GMS Health Check, P&L. **Must build as parallel components** — no in-place edits. |
| PDF chart rendering (Phase 4) | BACKLOG | `memory/pdf-chart-rendering.md` | Render actual Vega-Lite charts in PDF instead of placeholders. Pre-render to SVG/PNG. |
| Report Quality — Track 2: Prompt curation | TODO | `docs/REPORT-QUALITY-IMPROVEMENT-PLAN.md` | Add failure-mode tiers (primary/degraded/hard-stop) to each of 13 suggested analyses. |
| Report Quality — Track 3a: Haiku quality review | TODO | `docs/REPORT-QUALITY-IMPROVEMENT-PLAN.md` | Post-generation accuracy check: Haiku reviews draft against source data before presentation. |
| Report Quality — Track 3b: Clarifying questions | PLANNED | `docs/REPORT-QUALITY-IMPROVEMENT-PLAN.md` | Pre-generation questions to fill data gaps. Extend `dataInputs` modal. Higher UX complexity. |

---

## Tier 3: Finn AI Enhancements

| Feature | Status | Detail Doc | Notes |
|---------|--------|-----------|-------|
| Comparative analysis (period-over-period) | PLANNED | `docs/FINN-EXTENDED-AGENCY-PLAN.md` (Tier 2) | "Compare Q1 this year vs Q1 last year" — low-hanging fruit. |
| What-if scenario modelling | PLANNED | `docs/FINN-EXTENDED-AGENCY-PLAN.md` (Tier 2) | "What if we hired a nurse at €45k?" — via `generate_report` with scenario type. |
| Finn navigate timing | BACKLOG | `memory/finn-navigate-timing.md` | Modal opens before user reads Finn's response. Add 2-3s delay. UX polish. |

---

## Tier 4: Analytics & Tracking

| Feature | Status | Detail Doc | Notes |
|---------|--------|-----------|-------|
| GMS Impact Tracking | PLANNED | `memory/gms-impact-tracking.md` | Track projected savings (task completion) + verified savings (data comparison across cycles). Snapshots on "Start New Cycle". |

---

## Tier 5: External Agents

| Feature | Status | Detail Doc | Notes |
|---------|--------|-----------|-------|
| Dara Agent Layer 2 — Feedback triage | TODO | `C:\Users\user\slainteAgents\dara-agent\` | Claude classification of user feedback (severity/category), developer briefs, Google Sheets API. |
| Dara Agent Layer 2 — Maintenance automation | TODO | Same | `npm audit` delta, `npm outdated`, Electron version lag monitoring. |
| Dara Agent Layer 2 — Notifications | TODO | Same | Google Chat webhooks (critical alerts) + daily email digest. |
| Dara Agent Layer 3 — GitHub issues | FUTURE | `memory/dara-agent.md` | Auto-create GitHub issues from developer briefs. |

---

## Completed (Recent)

For reference — major features shipped, most recent first.

| Feature | Completed | Detail |
|---------|-----------|--------|
| Report Style System Phases 1-2 | 2026-04-08 | Style guide in prompts + shared theme object |
| Encrypted backup restore | 2026-04-06 | Full restore-from-UI with browser localStorage sync |
| Inbox batch processing + unified review | 2026-04-05 | Batch mode, AI correction learning, unified review flow |
| Pass 2 category assignment | 2026-04-04 | Full pipeline with optimised Sonnet prompt |
| Two-pass architecture (group-first Opus) | 2026-04-03 | 99.2% accuracy at 0.85 threshold |
| Security Audit Phases 1-2 | 2026-03 | XSS, DOMPurify, CSP, rate limiting, password validation, path traversal |
| Advanced Insights Tab (all phases) | 2026-03 | Report gallery, insight dashboard, in-report Q&A, AI narratives |
| GMS Health Check v2 (all phases) | 2026-03 | Card-based redesign, AI narratives, guided data entry, deep linking |
| Finn agentic tool use (all phases) | 2026-03 | 8 tools, agentic loop, extended agency batches A-C |
| Inbox-first onboarding | 2026-03 | File routing, batch mode, review flow |

---

## Key Constraints

- **Non-AI reports (GMS Health Check, P&L):** Any visual changes must be built as parallel components. Legacy version stays untouched until testing is complete and switch-over is approved.
- **Finn tool count:** Never exceed ~15-20 tools — Claude degrades. Extend existing tools with new params instead of adding new ones.
- **`actualHoursWorked` / `yearsExperience`:** Must be stored as numbers, not strings, to avoid JS concatenation bugs.

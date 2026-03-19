# Finn Extended Agency — Brainstorm & Plan

> Status: Planning / Not yet started
> Date: 2025-03-17

## Context

Finn has evolved from a chatbot to an agentic assistant with 9 tools (navigate, lookup_financial_data, search_transactions, generate_report, lookup_saved_reports, lookup_available_analyses, start_app_tour, send_feedback). This document captures ideas for extending his capabilities further.

## Key Constraint: Tool Count

Claude's tool selection degrades past ~15-20 tools, and overlapping semantics cause confusion even below that threshold. The current 9 tools work well because they have clearly distinct intents. **The strategy is to extend existing tools with new parameters rather than adding new tools wherever possible.**

---

## Tier 1: Low-Hanging Fruit

### 1.1 Draft Communications (via `generate_report`)

**Concept:** When health check recommendations say "Contact PCRS to claim correct Practice Support Subsidy hours", Finn can draft the actual email with figures, context, and the correct contact address.

**Implementation approach:** Add a `reportType` option `"communication_draft"` to the existing `generate_report` tool. Update the description to include: *"Use 'communication_draft' for emails, letters, or correspondence the user needs to send (e.g. PCRS claims queries, appeals)."*

**UX:** Render the output as an artifact card with "Copy to clipboard" and "Open in email client" (`mailto:` link with pre-filled subject/body) buttons.

**Data needed:** Centralise PCRS/HSE contact details (some already exist in `electron/pcrs/pcrsConstants.cjs` and `src/utils/healthCheckCalculations.js`). Create a contact directory the report generator can reference.

**Generalises to:** Any recommendation that involves "contact X about Y" could offer "Draft this for me". Letters to HSE, appeals, staff contract amendments, patient notification letters, practice policy documents.

### 1.2 Create/Update Tasks (via `navigate`)

**Concept:** Finn can create tasks in the TasksWidget from conversation. "Add a task to follow up on the PCRS underpayment" → task appears in the panel.

**Implementation approach:** Add navigate targets like `"tasks:create"` with an optional `taskData` payload (title, description, priority, dueDate, category). The navigate handler dispatches a CustomEvent that TasksContext listens for.

**Also useful for:** Marking tasks complete from chat, updating task notes.

### 1.3 Modify Settings (via `navigate`) — Low Priority

**Concept:** "Change the financial year end to March" or "set the practice name to X".

**Implementation approach:** Navigate target `"settings:update"` with payload. However, settings changes are rare and the stakes of getting it wrong are higher — deprioritise this.

---

## Tier 2: Medium Effort, High Value

### 2.1 Export/Download Actions (via `navigate`)

**Concept:** "Export my P&L for 2025 as PDF" or "download categorised transactions as CSV".

**Implementation approach:** Add navigate targets like `"export:pl"`, `"export:transactions-csv"`, `"export:accountant-pack"`. The existing export logic in `ExportReports.jsx` and `AccountantExport.jsx` would be triggered via CustomEvent dispatch.

### 2.2 Bulk Category Operations (via `search_transactions`)

**Concept:** "Move all transactions from 'Miscellaneous' that mention 'Medisec' into 'Insurance — Medical Indemnity'".

**Implementation approach:** Add an optional `action` parameter to `search_transactions`: `"list"` (default/current behaviour), `"recategorize"` (with `newCategory` param), `"export"`. Finn already searches — now he can act on results.

**Safety:** Should require user confirmation before applying bulk changes. Finn presents the matches first, user confirms, then Finn executes.

### 2.3 Proactive Awareness (via `lookup_financial_data`)

**Concept:** Finn notices what needs attention and mentions it proactively.

**Implementation approach:** Add a `"pending_tasks"` or `"system_status"` query to the existing `lookup_financial_data` tool. This returns data from the existing TasksContext auto-generated tasks (stale data warnings, uncategorised transactions, overdue P&L, etc.). Finn can then open conversations with *"I noticed your transaction data is 45 days old — want me to walk you through uploading a new statement?"*

**Existing infrastructure (TasksContext.jsx auto-generates):**
- Stale transaction data (>30 days) → "Upload monthly transactions"
- Unidentified transactions → "Categorize unidentified transactions"
- Prior year P&L (Jan-March) → "Generate prior year P&L"
- Monthly P&L (first week of month) → "Run last month's P&L"
- GMS Health Check (12+ months data) → "Run Health Check"

**No new scheduling needed.** TasksContext already computes what needs attention. Finn just needs visibility and the ability to surface it conversationally.

### 2.4 Comparative Analysis

**Concept:** "Compare Q1 this year vs Q1 last year" or "How has locum spending changed?"

**Implementation approach:** Could be a new `lookup_financial_data` query like `"period_comparison"` with additional parameters, or handled by `generate_report` with a `"comparison"` reportType that structures the output as a delta table.

### 2.5 What-If Scenario Modelling

**Concept:** "What if we hired a practice nurse at €45k?" or "What if we lost 200 GMS patients?"

**Implementation approach:** Best handled via `generate_report` with a `"scenario"` reportType. The report generator clones current numbers, applies the hypothetical, and shows impact. The financial data and health check calculations are already available in context.

---

## Tool Impact Summary

| Capability | Approach | New Tools | Tool Changes |
|---|---|---|---|
| Draft emails/letters | Extend `generate_report` | 0 | +1 reportType enum |
| Create tasks | Extend `navigate` | 0 | +1 navigate target |
| Export/download | Extend `navigate` | 0 | +3 navigate targets |
| Bulk recategorise | Extend `search_transactions` | 0 | +1 action param |
| Proactive awareness | Extend `lookup_financial_data` | 0 | +1 query enum |
| Period comparison | Extend `lookup_financial_data` or `generate_report` | 0 | +1 query/type |
| Scenario modelling | Extend `generate_report` | 0 | +1 reportType enum |
| Modify settings | Extend `navigate` | 0 | +1 navigate target |

**Total: 0 new tools. All delivered through parameter extensions to existing tools.**

---

## Future Consideration: True Proactive Nudges

The above gives Finn awareness of pending tasks when asked. For truly proactive behaviour (Finn speaking first without being prompted), there are two options:

1. **On-open check:** When Finn's chat panel opens, run a quick `system_status` lookup and have Finn greet with relevant nudges. Low effort, high impact.
2. **Scheduled background check:** Periodic evaluation of system state with notification badge on Finn's icon. Higher effort, feels more "alive".

Option 1 is recommended as the starting point.

---

## Implementation Priority (Suggested)

1. **Draft communications** — Highest user value, strong demo story, builds on existing generate_report
2. **Proactive awareness** — Connects Finn to TasksContext, makes him feel "alive"
3. **Create tasks** — Natural companion to awareness + health check recommendations
4. **Bulk recategorise** — Power-user feature, high time savings
5. **Export/download** — Convenience, moderate value
6. **Scenario modelling** — Compelling but can use freeform reports as interim
7. **Period comparison** — Similar, freeform reports work today
8. **Modify settings** — Low priority, rare use case

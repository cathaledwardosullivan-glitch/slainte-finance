# Pass 2: Category Assignment Plan

## Context

The two-pass architecture separates GROUP assignment (Pass 1, done) from CATEGORY assignment (Pass 2, this document). After Pass 1, every transaction has one of 10 groups. The dashboard and financial overview work with groups alone. Pass 2 assigns specific categories within confirmed groups, needed for P&L reports, advanced insight reports, and detailed financial analysis.

## Key Advantage

Pass 2 benefits from the group-first approach:
- AI/deterministic engine chooses from **6-10 categories within a group**, not 125 across all groups
- Expected accuracy improvement mirrors what we saw at group level (10 options >> 125 options)
- User review is faster — small dropdown within a known group

## Pipeline

### Step 1: Already Categorised (~77%)

Identifier and profile matches from Pass 1 already have both group AND category. These need no further processing. Skip them.

### Step 2: Deterministic Similarity Within Group

For each uncategorised transaction that has a confirmed group:
1. Find the corpus of categorised transactions in the same group
2. Run similarity matching (descriptions, amounts) against this narrowed corpus
3. If a strong match exists (similarity >= threshold), assign that category

This is cheap, instant, and should catch recurring vendors that were identified in other files or by other users.

### Step 3: AI Category Assignment (Opus or Haiku)

For remaining uncategorised transactions, call the API with a narrowed prompt per group:

```
You are assigning expense categories to Irish GP practice transactions.

All transactions below belong to the group: PROFESSIONAL (Professional Fees)

Available categories in this group:
- PRO-01: Accountancy Fees
- PRO-02: Legal Fees
- PRO-03: Bank Charges
- PRO-04: ICGP Membership
- PRO-05: Insurance (Professional Indemnity)
- PRO-06: Consultant Fees
- PRO-07: Other Professional Fees

TRANSACTIONS:
1. [DEBIT] €2.59 | "NEPOSCHGUSD 000002.59"
2. [DEBIT] €3,500.00 | "SMITH & PARTNERS SOLI"
...

Respond with JSON: [{"index": 1, "categoryCode": "PRO-03", "confidence": 0.95, "reasoning": "..."}]
```

**Model choice:** Haiku may be sufficient here (small option space, group already confirmed). Test both. Use Opus only if Haiku accuracy is inadequate.

**Batching:** Group transactions by group code, then batch within each group. This keeps prompts focused and maximises the benefit of the narrowed category list.

### Step 4: Review Panel — Category Within Group

Uncategorised transactions after steps 2-3 go to the review panel:
- Panel shows the confirmed group name as context
- Category picker is pre-filtered to categories in that group
- Much faster UX than searching 125 categories

## Triggers

### 1. Manual Button
Add a "Categorise transactions" button in the transaction list or settings area. Only visible when there are grouped-but-uncategorised transactions.

### 2. Finn Proactive Suggestion
Finn's `system_status` already tracks grouped-but-uncategorised count (from TasksContext). The proactive greeting can mention it: "You have 293 transactions with groups but no detailed categories. Want me to start categorising?"

### 3. Report Gate
When the user generates a P&L report or other report requiring categories:
- Check if there are uncategorised transactions in the date range
- If yes, prompt: "This report needs detailed categories. X transactions are grouped but not categorised. Run categorisation first?"
- If user agrees, run Pass 2 → then generate the report

### 4. Auto-Generated Task
TasksContext already creates "Assign detailed categories to grouped transactions" (medium priority) when there are grouped-but-uncategorised transactions.

## Files to Create/Modify

### New Files
- `electron/utils/categoryAssignmentPass.cjs` — AI prompt builder + API call for category assignment within groups
- Potentially a new IPC handler for triggering Pass 2 from the renderer

### Modify
- `electron/backgroundProcessor.cjs` — Add `runCategoryAssignment(stagedId)` method or a new trigger path
- `src/context/FinnContext.jsx` — New action on `staged:review` or new navigate target for triggering Pass 2
- `src/components/UnifiedFinnWidget/StagedReviewPanel.jsx` — Add category-within-group mode (toggled when Pass 2 runs)
- Report generation components — Add gate check for uncategorised transactions
- `src/components/TransactionListV2.jsx` — Add "Categorise" button when grouped-but-uncategorised > 0

## Design Decisions to Make

1. **Model for Pass 2:** Haiku (cheap, fast, sufficient for small option space?) vs Opus (higher accuracy but expensive). Test with ground truth.
2. **Batch structure:** One API call per group (all PROFESSIONAL transactions together) vs one call per batch across groups. Per-group is cleaner for the prompt.
3. **Warm corpus path:** Do returning users (rich identifiers) ever need Pass 2? Probably not — their identifiers already assign categories. Pass 2 is mainly for cold-start users.
4. **Incremental vs batch:** Should Pass 2 run on individual transactions as they arrive, or only in batch when triggered? Batch is simpler and cheaper.
5. **Review panel mode:** Reuse StagedReviewPanel with a mode flag, or create a separate component? Reuse is cleaner — the panel already has the cluster/accept/change pattern.

## Estimated Effort

- `categoryAssignmentPass.cjs`: ~2 hours (prompt building, API call, response parsing — similar pattern to opusAnalysisPass.cjs)
- Background processor integration: ~1 hour (new method, IPC wiring)
- FinnContext integration: ~1 hour (new trigger, messaging)
- Review panel category mode: ~2 hours (mode toggle, filtered category picker, group context display)
- Report gate: ~1 hour (check + prompt in report generation flow)
- Testing: ~2 hours (ground truth comparison at category level)

Total: ~9 hours

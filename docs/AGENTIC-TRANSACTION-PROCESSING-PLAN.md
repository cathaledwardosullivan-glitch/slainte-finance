# Agentic Transaction Processing — Complete Plan

> Status: PLANNED — Not yet built
> Date: 2026-03-18
> Last revised: 2026-03-20

## 1. Vision

Replace the synchronous, modal-based transaction upload flow with a background processing pipeline that Finn presents conversationally. The user drops bank statement files into a designated folder. While the app is open, Finn parses, categorizes, and stages the results. When ready, Finn proactively offers a summary and walks the user through approving high-confidence results and reviewing uncertain ones — via conversation, not modals.

### What Changes for the User

**Before (current):**
1. Open app → navigate to upload → select file → wait
2. Watch processing modal → review identifier suggestions → wait for AI calls
3. Step through category picker for each uncertain transaction
4. Session takes 10-15 minutes for a large statement

**After (returning user):**
1. Save bank statement PDF to the Sláinte inbox folder
2. Open app sometime later. Finn says: "I processed your February BOI statement — 430 of 445 transactions categorized automatically. Want me to apply those? I have 15 that need your input."
3. User says "yes, apply them" → Finn imports 430 transactions
4. Finn walks through the 15 uncertain ones conversationally in grouped rounds: "I found 8 payments to 'Medisec' — that's medical indemnity insurance. File them all there?" → "Yes" → done
5. Session takes 1-2 minutes

**After (first-time user, ~1000 transactions):**
1. Drop bank statements into inbox folder
2. Finn runs convergence loop: identifiers → fee matching → similarity cascading → group confidence → Opus 4.6 deep analysis → further cascading. Background, no user involvement yet.
3. Finn says: "I've automatically categorized 850 of 1000 transactions. I need your help with about 25 questions to handle most of the rest."
4. Finn presents one representative from each large cluster, biggest first. User answers ~10 questions. Finn re-loops, auto-categorizes ~100 more via cascading.
5. Finn presents next round of ~15 medium clusters. User answers. Finn re-loops.
6. ~30-50 genuine singletons remain — user reviews individually or defers.
7. Total: ~25-30 decisions to categorize 1000 transactions, ~5 minutes.

### What Doesn't Change

- The core categorization engine functions (identifier matching, Levenshtein similarity, unified confidence scoring, clustering)
- The existing upload UI — remains available as an alternative path
- The category mapping data structure
- How transactions are stored in AppContext/localStorage

### What Is Replaced

- **Wave processing** is retired for the background path. It was designed to avoid overwhelming the user during synchronous processing. In a background context, that constraint doesn't exist. It is replaced by the convergence loop (Section 3.3.3).

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                  Electron Main Process                    │
│                                                          │
│  ┌──────────┐    ┌──────────────────┐    ┌───────────┐  │
│  │  Folder   │───▶│   Background     │───▶│  Staging  │  │
│  │  Watcher  │    │   Processor      │    │   Store   │  │
│  └──────────┘    │                  │    └─────┬─────┘  │
│                   │  ┌────────────┐  │          │        │
│                   │  │Convergence │  │          │        │
│                   │  │   Loop     │  │          │        │
│                   │  │ (bundled   │  │          │        │
│                   │  │  engine)   │  │          │        │
│                   │  └─────┬──────┘  │          │        │
│                   │        │         │          │        │
│                   │  ┌─────▼──────┐  │          │        │
│                   │  │ Opus 4.6   │  │          │        │
│                   │  │ Deep Pass  │  │          │        │
│                   │  │(cold start)│  │          │        │
│                   │  └────────────┘  │          │        │
│                   └──────────────────┘          │        │
│                                                  │        │
├──────────────────────────────────────────────────┼────────┤
│              IPC Bridge (preload.cjs)            │        │
├──────────────────────────────────────────────────┼────────┤
│                                                  │        │
│                  React Renderer                  ▼        │
│                                                          │
│  ┌──────────────┐    ┌──────────────────────────────┐   │
│  │ FinnContext   │───▶│  Conversational Review        │   │
│  │ (proactive    │    │  (strategic handover +        │   │
│  │  greeting     │    │   in-renderer re-scoring      │   │
│  │  extension)   │    │   between user rounds)        │   │
│  └──────────────┘    └──────────────────────────────┘   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Implementation Phases

### Phase 1: Engine Portability (Foundation)

**Goal:** Make the categorization engine available to the Electron main process without duplicating code.

#### 3.1.1 Add esbuild as a dev dependency

```bash
npm install --save-dev esbuild
```

#### 3.1.2 Create build script

New file: `scripts/build-engine-bundle.cjs`

```javascript
const esbuild = require('esbuild');
const path = require('path');

esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'src', 'utils', 'engineExports.js')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: path.join(__dirname, '..', 'electron', 'utils', 'categorizationBundle.cjs'),
  external: [],  // No external deps — everything is pure JS
});

console.log('[build-engine-bundle] Done');
```

#### 3.1.3 Create engine entry point

New file: `src/utils/engineExports.js`

This is a barrel file that re-exports everything the main process needs from the engine. It exists solely as the esbuild entry point — not imported by any React code.

```javascript
// Entry point for esbuild bundling into electron/utils/categorizationBundle.cjs
// Do NOT import this file from React components — use the source files directly.

export { categorizeTransactionBatch, CONFIDENCE_THRESHOLDS, GROUPS } from './categorizationEngine';
export { levenshteinSimilarity, differenceRatio, calculateUnifiedConfidence, getAdaptiveWeights, clusterSimilarTransactions } from './stringUtils';
export { processTransactionsWithEngine } from './transactionProcessor';
```

Note: `processInWaves` / `WAVE_CONFIG` are NOT exported. The background processor uses the convergence loop (Section 3.3.3) instead.

#### 3.1.4 Add npm scripts

In `package.json`:

```json
{
  "scripts": {
    "build:engine": "node scripts/build-engine-bundle.cjs",
    "electron-dev": "npm run build:engine && concurrently ..."
  }
}
```

The engine bundle rebuilds automatically whenever `electron-dev` starts. During active development on the engine files, run `npm run build:engine` manually after changes.

#### 3.1.5 Commit the bundle

`electron/utils/categorizationBundle.cjs` should be committed to git (not gitignored). This ensures the production build works without needing esbuild at runtime.

#### 3.1.6 Validation

Write a quick smoke test: `node -e "const e = require('./electron/utils/categorizationBundle.cjs'); console.log(Object.keys(e))"` — should print all exported function names.

---

### Phase 2: PDF Adapter for Node.js

**Goal:** Parse bank statement PDFs from the filesystem (file path, not File object) in the Electron main process.

#### 3.2.1 Install pdfjs-dist for Node.js

`pdfjs-dist` already exists in `node_modules` (used by the renderer). It supports Node.js without web workers — we just need to configure it differently.

#### 3.2.2 Create Node.js PDF adapter

New file: `electron/utils/pdfAdapter.cjs`

**Responsibilities:**
- Accept a file path (string), not a File object
- Read bytes via `fs.readFileSync()`
- Use `pdfjs-dist` Node.js API (no worker needed)
- Extract text and positioned items using the same logic as `bankStatementParser.js`
- Return the same data structure: `{ transactions, bank, metadata }`

**Key difference from browser parser:** The browser parser's `extractPdfText()` and `extractPdfWithPositions()` accept `file.arrayBuffer()`. The Node adapter uses `fs.readFileSync(filePath)` which returns a Buffer — `pdfjs-dist` accepts both `Uint8Array` and `ArrayBuffer`, so we pass `new Uint8Array(buffer)`.

**Parsing logic reuse:** The actual bank-specific parsing functions (BOI pattern matching, AIB detection, date extraction, debit/credit logic) are string manipulation. These are already bundled in the categorization bundle if we add `bankStatementParser.js` to the engine exports — OR we duplicate just the parsing functions (they're stable and rarely change). **Recommendation: add to the bundle.** This means:
- Extract the pure parsing functions from `bankStatementParser.js` into a new file `src/utils/bankStatementParsers.js` (no PDF.js dependency — just the string parsing logic that operates on already-extracted text/positions)
- Keep `bankStatementParser.js` as the browser entry point (PDF.js + web worker + calls into the pure parsers)
- The pure parsers get bundled and the Node adapter calls them after its own PDF text extraction

#### 3.2.3 Supported file types

The adapter should handle:
- `.pdf` — Bank statement PDFs (BOI, AIB)
- `.csv` — Direct CSV parsing (reuse `transactionProcessor.js` CSV logic, already in the bundle)

File type detection by extension. Unknown extensions are skipped with a log warning.

---

### Phase 3: Background Processor & Convergence Loop

**Goal:** Watch a folder for new files, process them through an iterative convergence loop, write results to staging.

#### 3.3.1 Install chokidar

```bash
npm install chokidar
```

`chokidar` is the standard Node.js file watcher. It handles OS-level quirks (Windows FSEvents, debouncing, etc.) that `fs.watch` doesn't.

#### 3.3.2 Create background processor module

New file: `electron/backgroundProcessor.cjs`

**Responsibilities:**

1. **Folder management**
   - Inbox folder: `{userData}/inbox/` — where user drops files
   - Processed folder: `{userData}/inbox/processed/` — files moved here after processing
   - Create both folders on first run if they don't exist

2. **File watcher**
   - Watch `{userData}/inbox/` for new `.pdf` and `.csv` files using chokidar
   - Debounce: wait 2 seconds after file appears before processing (ensures write is complete)
   - Ignore dotfiles, temp files, and the `processed/` subfolder
   - Only active while the app is running (watcher starts in `app.whenReady()`, stops on `app.on('will-quit')`)

3. **Processing pipeline** (per file) — see Section 3.3.3 for the convergence loop detail
   ```
   detect file type
   → parse (PDF adapter or CSV parser)
   → load current category mappings from localStorage.json
   → load existing transactions from localStorage.json (for similarity corpus)
   → load practice profile from localStorage.json (for fee matching + AI context)
   → run convergence loop (Section 3.3.3)
   → run anomaly detection (Section 3.3.6)
   → write results to staging file
   → move source file to processed/ folder
   → notify renderer via IPC event
   ```

4. **Concurrency**
   - Process one file at a time (queue additional files)
   - Set a `processing` flag to prevent re-entry
   - If app quits mid-processing, the file remains in inbox/ and will be re-processed on next launch

5. **Error handling**
   - If parsing fails: log error, leave file in inbox/, notify renderer with error details
   - If categorization fails: same — leave file, notify with error
   - Never crash the main process — all errors caught and reported

#### 3.3.3 Convergence loop (replaces wave processing)

The convergence loop runs the categorization engine iteratively. Each pass enriches the corpus for the next pass. The loop stops when no new categorizations are produced or a maximum iteration count is hit.

**Why this replaces wave processing:** Wave processing was designed to avoid overwhelming the user during synchronous UI-driven upload (small batches, user reviews between waves). In background mode, the user isn't waiting — there's no reason to batch or pause. The convergence loop runs the full engine repeatedly, with each pass building on the last, until it converges.

**Loop structure:**

```
iteration = 0
corpus = existingTransactions (from localStorage)

repeat:
  iteration++

  // Pass A: Identifier matching
  Run identifier match on all uncategorized transactions.
  Move newly matched to categorized set. Add to corpus.

  // Pass B: Known fee amount matching (Section 3.3.4)
  Match incoming amounts against known practice fees (consultation fee,
  medicolegal fee from practice profile). Apply to uncategorized income
  transactions with exact amount matches.
  Move newly matched to categorized set. Add to corpus.

  // Pass C: Similarity matching against corpus
  For each uncategorized transaction, find similar categorized transactions
  in corpus (including this-batch results from passes A and B).
  Score using existing calculateUnifiedConfidence().
  Move transactions scoring >= auto threshold to categorized set. Add to corpus.

  // Pass D: Group confidence propagation (Section 3.3.5)
  Cluster all remaining uncategorized transactions using clusterSimilarTransactions().
  For each cluster: if any member was categorized in this or prior iterations,
  propagate confidence to uncategorized cluster members via group confidence formula.
  Move newly promoted transactions to categorized set. Add to corpus.

  newCategorizations = count of transactions categorized this iteration

  if newCategorizations == 0 OR iteration >= MAX_ITERATIONS (10):
    break

// After deterministic convergence: AI pass for cold start (Section 3.3.7)
if uncategorized count is significant (> 15% of total OR > 50 transactions):
  Run Opus 4.6 deep analysis pass
  Add AI results to corpus
  Run one more similarity + group confidence pass to cascade from AI results
```

**Key property:** Each pass can only categorize transactions, never un-categorize. The corpus grows monotonically. Convergence is guaranteed because the uncategorized set shrinks or stays the same each iteration.

**Performance:** The deterministic passes (A-D) run in milliseconds even for 1000 transactions — these are pure JS string operations. The loop typically converges in 2-4 iterations. The Opus call (if triggered) takes 30-60 seconds but runs in the background.

#### 3.3.4 Known fee amount matching

The practice profile (captured during onboarding) contains specific fee amounts:
- `privatePatients.averageConsultationFee` — e.g., €60 (extracted from practice website during onboarding)
- Any medicolegal/report fees the user has configured

**Matching logic:**
- For each uncategorized **income** (credit) transaction, check if the amount is an exact match for a known fee
- Consultation fee exact match → categorize as consultation income (high confidence, ~0.92)
- Medicolegal fee exact match → categorize as medicolegal income (high confidence, ~0.92)

**Confidence is high but not maximum** (0.92 not 1.0) because amount coincidence is possible — a €60 payment could theoretically be something other than a consultation. But for a GP practice, the hit rate is very high.

This pass is most valuable for first-time users where the similarity corpus is empty but the practice profile has fee information from the website analysis.

#### 3.3.5 Group confidence scoring

**Concept:** When a cluster of similar transactions exists and one or more members are confidently categorized, that confidence should propagate to the uncategorized members. This is a new scoring layer that sits on top of the existing per-transaction confidence.

**Formula:**

```javascript
groupConfidence = max(
  individualConfidence,
  bestClusterMemberConfidence × intraClusterSimilarity
)
```

Where:
- `individualConfidence` = the transaction's own score from `calculateUnifiedConfidence()`
- `bestClusterMemberConfidence` = the highest confidence among categorized members of the same cluster
- `intraClusterSimilarity` = Levenshtein similarity between this transaction and that best-scoring member

**Properties:**
- Can only **elevate** confidence, never lower it (takes max of individual and group)
- The `intraClusterSimilarity` acts as a discount — a weak cluster member (0.60 similarity) doesn't get a free ride from a confident neighbor
- Uses the existing `clusterSimilarTransactions()` from `stringUtils.js` (Union-Find at 85% Levenshtein threshold)

**Example:**
```
Transaction "MEDISEC IRE" — no identifier match, 1 similar in corpus at 0.78
→ individualConfidence = 0.72 (below auto threshold)
→ Cluster contains "MEDISEC IRELAND LTD" categorized at 0.95
→ intraClusterSimilarity("MEDISEC IRE", "MEDISEC IRELAND LTD") = 0.88
→ groupConfidence = max(0.72, 0.95 × 0.88) = max(0.72, 0.836) = 0.836
```

In this example the transaction is elevated but still below auto threshold (0.90). However, if the cluster had 3 confidently categorized members, the combined evidence might push it over — this is handled by using the best member, not an average, so a single strong match is sufficient.

**Where this matters most:** The 0.70-0.89 confidence band — transactions that the individual scoring model considers "almost but not quite." Group confidence directly attacks this band, promoting clustered transactions to auto-apply when their neighbors are already confident.

#### 3.3.6 Post-categorization anomaly detection

After the convergence loop completes and before staging results, run a quality check:

**Amount outliers within categories:** If "Staff Salaries" contains 5 transactions of ~€4,000 and 2 transactions of €15, the €15 transactions are statistical outliers. Demote them from "auto" back to "review" cohort.

**Missing expected categories:** Every GP practice has utilities, insurance, and staff costs. If the categorized results show zero transactions in a category that should exist for any practice, log a warning (informational — doesn't change categorization, but Finn can mention it during review).

**Proportion sanity:** If known profile data conflicts with categorized results (e.g., total salary spend is implausibly low given stated staff count), flag for review.

**Purpose:** The more aggressive the auto-categorization (group confidence, Opus, fee matching), the more important a safety net becomes. Anomaly detection earns permission to set confident thresholds by catching errors before the user sees them.

#### 3.3.7 Opus 4.6 deep analysis pass (cold start)

**When it runs:** After the deterministic convergence loop, if a significant number of transactions remain uncategorized. Threshold: > 15% of total OR > 50 transactions. This typically triggers for first-time users (thin corpus) and rarely for returning users (rich corpus handles most).

**Why Opus 4.6:** Background processing removes the speed constraint that previously mandated Haiku. The user isn't watching a spinner — the file was dropped in an inbox and processing is invisible. Opus provides the deepest reasoning about Irish businesses, GP practice expense structures, and cross-transaction patterns.

**Enriched context — feed deterministic results INTO the AI call:**

The Opus call receives not just the uncategorized transactions but also a summary of what the engine already categorized. This gives Opus the financial shape of the practice:

```
Prompt structure:

"You are analysing bank transactions from an Irish GP practice.

PRACTICE PROFILE:
- [GP count, staff count, consultation fee, services — from onboarding profile]

ALREADY CATEGORIZED BY OUR ENGINE (for context — do not re-categorize these):
- 15 payments to individuals categorized as Staff Salaries (€4,200/month avg)
- 12 incoming payments of €60 categorized as Consultation Fees
- 1 large HSE payment of €34,000 categorized as GMS Income
- 8 payments to MEDISEC categorized as Medical Indemnity Insurance
- [... summary of all auto-categorized groups ...]

AVAILABLE CATEGORIES:
- [Full category mapping with descriptions and section grouping]

UNCATEGORIZED TRANSACTIONS NEEDING YOUR ANALYSIS:
- [Full list with amounts, dates, descriptions, debit/credit]

For each transaction, provide:
1. Recommended category code
2. Confidence (0.0-1.0)
3. Brief reasoning

Use your knowledge of Irish businesses and GP practice operations.
Reason structurally — identify patterns across transactions (recurring payments,
related vendors, salary vs locum patterns) rather than categorizing each in isolation.
Cross-reference against the already-categorized data to identify what roles are
filled and what expenses are accounted for."
```

**Narrative prompting:** The prompt asks Opus to reason structurally about the practice's finances rather than treating each transaction independently. "They have 5 staff at ~€4,200/month — DR K WALSH at €900 quarterly is not staff, probably a locum." This cross-referencing produces better categorizations than isolated per-transaction analysis.

**Cost:**
- First-time user with ~300-500 uncategorized transactions: ~€0.50-1.00 per Opus call
- Only triggers when corpus is thin (first upload, or first upload of a new year with many new vendors)
- Returning users with healthy corpus: rarely triggers (deterministic loop handles >85%)
- Cost guardrail: max 1 Opus call per processing run. If >500 uncategorized remain, send the 500 with largest clusters first.

**Post-AI cascading:** After the Opus results are applied, run one more similarity + group confidence pass. The AI categorizations become high-quality corpus entries that can cascade to remaining uncategorized transactions via similarity matching.

#### 3.3.8 Staging store

New file location: `{userData}/staged-results/`

Each processed file produces a staging JSON file:

```javascript
{
  id: "staged-{timestamp}",
  sourceFile: "February-2026-BOI.pdf",
  processedAt: "2026-03-18T14:30:00Z",
  processingTimeMs: 4500,

  summary: {
    totalTransactions: 445,
    auto: 412,        // confidence >= 0.90 (includes group-confidence promotions)
    review: 33,       // < 0.90
    dateRange: { from: "2026-02-01", to: "2026-02-28" },
    totalDebits: 45230.50,
    totalCredits: 62100.00,
    convergenceIterations: 3,
    opusPassTriggered: false
  },

  // Cluster information for strategic handover (Section 3.6)
  reviewClusters: [
    {
      representativeId: "txn-123",
      representativeDescription: "MEDISEC IRE",
      suggestedCategory: "Insurance - Medical Indemnity",
      suggestedConfidence: 0.82,
      memberCount: 8,
      totalAmount: 4200.00
    }
    // ... sorted by memberCount descending
  ],

  transactions: [
    {
      // Full transaction object (same structure as current)
      // Plus:
      categoryMatchType: "finn-background",
      stagedCohort: "auto" | "review",
      convergencePass: "identifier" | "fee_match" | "similarity" | "group_confidence" | "opus_ai",
      clusterId: "cluster-xyz" | null  // For review-cohort transactions
    }
  ],

  // Duplicate detection results
  duplicates: {
    count: 3,
    ids: ["..."]  // Transaction IDs that match existing data
  },

  status: "ready" | "error",
  error: null | "Parse error: unrecognised bank format"
}
```

#### 3.3.9 Duplicate detection

Before staging, compare incoming transactions against existing transactions in localStorage.json:
- Match on: date + absolute amount + normalised details (lowercase, trimmed)
- Flag exact duplicates in the staging file's `duplicates` field
- Don't auto-exclude — let the user decide during review (they may have legitimate duplicate payments)

#### 3.3.10 Integration with main.cjs

In `electron/main.cjs`, within `app.whenReady()`:

```javascript
const BackgroundProcessor = require('./backgroundProcessor.cjs');
const bgProcessor = new BackgroundProcessor({
  userDataPath: app.getPath('userData'),
  onReady: (stagedResult) => {
    // Notify renderer that results are available
    mainWindow?.webContents.send('background:results-ready', {
      id: stagedResult.id,
      sourceFile: stagedResult.sourceFile,
      summary: stagedResult.summary
    });
  },
  onError: (error, fileName) => {
    mainWindow?.webContents.send('background:processing-error', {
      fileName,
      error: error.message
    });
  },
  onProgress: (fileName, percent) => {
    mainWindow?.webContents.send('background:processing-progress', {
      fileName,
      percent
    });
  }
});

bgProcessor.start();

app.on('will-quit', () => {
  bgProcessor.stop();
});
```

---

### Phase 4: IPC Bridge Extensions

**Goal:** Let the React renderer communicate with the background processor.

#### 3.4.1 New IPC handlers in main.cjs

```javascript
// Get all staged results (summaries only, not full transactions)
ipcMain.handle('background:get-staged', async () => {
  return bgProcessor.getStagedResults();  // Array of { id, sourceFile, summary, processedAt }
});

// Get full staged result by ID (includes all transactions)
ipcMain.handle('background:get-staged-detail', async (event, stagedId) => {
  return bgProcessor.getStagedDetail(stagedId);
});

// Apply approved transactions from staging to live data
ipcMain.handle('background:apply-staged', async (event, stagedId, approvedTransactionIds) => {
  return bgProcessor.applyStagedTransactions(stagedId, approvedTransactionIds);
});

// Dismiss/delete a staged result
ipcMain.handle('background:dismiss-staged', async (event, stagedId) => {
  return bgProcessor.dismissStaged(stagedId);
});

// Get inbox folder path (for showing user where to put files)
ipcMain.handle('background:get-inbox-path', async () => {
  return bgProcessor.getInboxPath();
});

// Open inbox folder in system file explorer
ipcMain.handle('background:open-inbox', async () => {
  const { shell } = require('electron');
  shell.openPath(bgProcessor.getInboxPath());
});
```

#### 3.4.2 Preload bridge additions

In `electron/preload.cjs`:

```javascript
backgroundProcessor: {
  getStagedResults: () => ipcRenderer.invoke('background:get-staged'),
  getStagedDetail: (id) => ipcRenderer.invoke('background:get-staged-detail', id),
  applyStaged: (id, txIds) => ipcRenderer.invoke('background:apply-staged', id, txIds),
  dismissStaged: (id) => ipcRenderer.invoke('background:dismiss-staged', id),
  getInboxPath: () => ipcRenderer.invoke('background:get-inbox-path'),
  openInbox: () => ipcRenderer.invoke('background:open-inbox'),
  onResultsReady: (cb) => ipcRenderer.on('background:results-ready', (e, data) => cb(data)),
  onProcessingError: (cb) => ipcRenderer.on('background:processing-error', (e, data) => cb(data)),
  onProcessingProgress: (cb) => ipcRenderer.on('background:processing-progress', (e, data) => cb(data)),
  removeListeners: () => {
    ipcRenderer.removeAllListeners('background:results-ready');
    ipcRenderer.removeAllListeners('background:processing-error');
    ipcRenderer.removeAllListeners('background:processing-progress');
  }
}
```

---

### Phase 5: Finn Integration — Proactive Awareness

**Goal:** Finn knows about staged results and proactively tells the user.

#### 3.5.1 Extend system_status in FinnContext

In the `lookupDataPoint('system_status')` handler, add a check for staged results:

```javascript
// Check for background-processed transactions awaiting review
if (window.electronAPI?.backgroundProcessor) {
  const staged = await window.electronAPI.backgroundProcessor.getStagedResults();
  if (staged.length > 0) {
    const totalTxns = staged.reduce((sum, s) => sum + s.summary.totalTransactions, 0);
    const totalAuto = staged.reduce((sum, s) => sum + s.summary.auto, 0);
    const totalReview = staged.reduce((sum, s) => sum + s.summary.review, 0);
    statusItems.push({
      type: 'staged_transactions',
      severity: 'high',  // This is actionable and time-sensitive
      message: `${staged.length} bank statement${staged.length > 1 ? 's' : ''} processed — ${totalTxns} transactions (${totalAuto} auto-categorized, ${totalReview} need review)`,
      data: { staged }
    });
  }
}
```

This slots into the existing proactive greeting system naturally. When Finn opens and finds staged results, the greeting becomes: "I've processed your February bank statement — 412 transactions categorized. Want to review them?"

#### 3.5.2 Extend lookup_financial_data tool

Add a `"staged_results"` query to the existing `lookup_financial_data` tool:

```javascript
case 'staged_results': {
  const staged = await window.electronAPI.backgroundProcessor.getStagedResults();
  return {
    results: staged,
    totalFiles: staged.length,
    // ... summary stats
  };
}
```

This lets Finn check for staged results mid-conversation, not just on open.

#### 3.5.3 Real-time notification listener

In FinnContext, add a useEffect that listens for `background:results-ready` events:

```javascript
useEffect(() => {
  if (!window.electronAPI?.backgroundProcessor) return;

  const handler = (data) => {
    // If Finn's panel is open and chat is active, inject a notification
    if (isOpen && messages.length > 0) {
      addAssistantMessage(
        `I just finished processing "${data.sourceFile}" — ${data.summary.totalTransactions} transactions found, ` +
        `${data.summary.auto} auto-categorized. Say "review" when you're ready to look at them.`
      );
    }
    // If panel is closed, the next proactive greeting will pick it up via system_status
  };

  window.electronAPI.backgroundProcessor.onResultsReady(handler);
  return () => window.electronAPI.backgroundProcessor.removeListeners();
}, [isOpen]);
```

---

### Phase 6: Conversational Review with Strategic Handover

**Goal:** Finn walks the user through approving and reviewing staged transactions via conversation, using existing tool patterns. Reviews happen in **rounds** — Finn presents cluster representatives, the user answers, Finn re-runs the engine with the enriched corpus, and presents the next round.

#### 3.6.1 New navigate target: staged review

Add `"staged:review"` as a navigate target. When Finn calls navigate with this target, the handler:

1. Fetches the full staged result via IPC
2. Separates transactions into cohorts: auto (>= 0.90), needs-review (< 0.90)
3. Returns the `reviewClusters` array (pre-computed in staging, sorted by cluster size descending)
4. Returns a structured summary to Finn

Finn then has the information to drive the conversation.

#### 3.6.2 Strategic handover — round-based conversation flow

The key insight: **not all user decisions are equal in cascade value.** Categorizing one transaction from a cluster of 45 potentially auto-categorizes the other 44 via group confidence. Categorizing a singleton helps exactly 1 transaction.

The strategy: present one representative from each cluster, sorted by cluster size descending. After each round of user answers, re-run the convergence loop with the enriched corpus to cascade.

**Round-based flow:**

**Round 1 — Finn presents auto-categorized batch for bulk approval:**
"I processed February-2026-BOI.pdf. 850 of 1000 transactions categorized automatically. Want me to apply those?"
→ User: "Yes" → Finn applies via IPC.

**Round 2 — Finn presents largest clusters (one representative each):**
"For the remaining 150, I only need your help with about 10 questions to handle most of them:
1. 'MEDISEC IRELAND' appears 45 times (€18,900 total) — which category?
2. 'JOHNSON CLEANING SVC' appears 32 times (€12,000 total) — which category?
3. 'VHI GROUP' appears 28 times (€8,400 total) — which category?
..."
→ User answers 10 questions.

**Re-scoring pass (in renderer):**
Finn runs a lightweight convergence loop in the React renderer using the engine (already available via direct import). The user's answers are added to the corpus. Similarity + group confidence re-scores remaining uncategorized transactions. Expect ~100-150 additional auto-categorizations from cascading.

**Round 3 — Finn presents medium clusters:**
"That unlocked 120 more. Down to 30 remaining. Here are the next 12..."
→ User answers.
→ Re-scoring pass catches another ~15.

**Round 4 — Singletons:**
"15 left — these are one-offs. Want to go through them or file as 'Uncategorized' for now?"

**When to stop re-looping:** When the largest remaining cluster has fewer than 5 members. Below that, cascade yield per user decision drops below ~3 transactions — not worth the round-trip.

**Total user decisions for 1000 first-time transactions: ~25-30, in ~5 minutes.**

#### 3.6.3 In-renderer re-scoring

The re-scoring between user rounds runs in the React renderer, not via IPC to the main process.

**Why:** The categorization engine is already available in React (it's the same code the current upload flow uses). It runs in milliseconds for the remaining uncategorized set. Sending IPC round-trips to the main process for each re-scoring pass adds latency and complexity for no benefit.

**What runs:** Passes C (similarity) and D (group confidence) from the convergence loop. Passes A (identifiers) and B (fee matching) don't need to re-run — they're deterministic and already ran in the background processor.

**What the corpus includes:** All previously categorized transactions (from localStorage) + all auto-applied transactions from this session + all user-confirmed transactions from the current review rounds.

#### 3.6.4 How the tools work together

No new tools needed. The conversational review uses:

| Existing Tool | Role in Review |
|---|---|
| `lookup_financial_data` (staged_results) | Check what's pending |
| `navigate` (staged:review) | Load full staged data with clusters |
| `search_transactions` (list + recategorize) | Review and apply changes |
| `navigate` (categories:create) | Create new categories if needed |

The agentic loop (max 5 rounds) handles the multi-step flow. For large reviews with many groups, Finn may need multiple conversation turns (user responds, Finn continues). This is fine — it's how bulk recategorise already works.

#### 3.6.5 Applying staged transactions

When the user approves transactions (either in bulk or after review), the apply flow:

1. Finn calls a handler that invokes `background:apply-staged` IPC with the approved transaction IDs
2. Main process reads the staged file, extracts approved transactions
3. Main process loads current transactions from localStorage.json, appends new ones, saves
4. Renderer is notified via IPC event to reload transactions from storage
5. AppContext picks up the new data
6. Staged file is updated (approved transactions removed, or file deleted if all applied)

**Critical:** Transactions applied from staging use `categoryMatchType: 'finn-background'` so they don't pollute identifier learning (same pattern as `'finn-bulk'`). If the user later corrects a background-categorized transaction manually, THAT correction feeds back into identifiers normally.

#### 3.6.6 Identifier learning from review

When the user confirms a categorization during conversational review ("yes, Medisec is medical indemnity"), Finn should add "MEDISEC" as an identifier for that category. This happens naturally through the existing `recategorize` flow if we add identifier creation to the confirmation step. This is the feedback loop that makes the system smarter over time — the same loop the current modal flow provides, just delivered conversationally.

---

## 4. Folder Setup & User Experience

### 4.1 First-time setup

On first app launch after this feature is built:
- Create `{userData}/inbox/` and `{userData}/inbox/processed/`
- Create a desktop shortcut named "Sláinte Inbox" pointing to the inbox folder. Use Electron's `shell.writeShortcutLink()` (Windows .lnk file) with the app icon. Only created once — if the user deletes it, it doesn't reappear.
- Show a one-time notification (via Finn or a toast): "You can now drop bank statements into your Sláinte inbox folder and I'll process them automatically. I've added a shortcut to your desktop."
- Mark setup as complete in localStorage (`background_processor_setup_done`) to prevent repeat setup on subsequent launches

### 4.2 Folder location

`{userData}/inbox/` resolves to something like:
`C:\Users\{username}\AppData\Roaming\slainte-finance\inbox\`

This is inside Electron's managed userData directory — it's app-specific, won't conflict with other programs, and is automatically cleaned up if the app is uninstalled.

### 4.3 Discoverability

- Add an "Inbox Folder" button to Settings (Data section) that opens the folder
- Finn can tell the user about it: "Did you know you can drop bank statements into your inbox folder and I'll process them automatically? [Open Inbox]"
- The existing TransactionUpload component could include a note: "Or drop files in your inbox folder for automatic processing"

### 4.4 Security considerations

- The inbox folder is inside userData (app-controlled, not user-accessible system folder)
- Files are moved to `processed/` after processing (not left sitting in inbox)
- No encryption at rest for now — the files are bank statements the user already has on their computer. The staging JSON files contain the same data that ends up in localStorage.json
- If encryption becomes a requirement later, we can add AES encryption to staging files using the API key or a derived key

---

## 5. Ground Truth Testing Strategy

### 5.1 Approach

Before deploying, validate the convergence loop against the existing corpus of ~1000 manually categorized transactions. This is the same methodology used to validate the BOI PDF parser (compare output against known-good data).

### 5.2 Two testing paths

Development uses two complementary testing approaches that run in parallel. Neither requires modifying or deleting existing app data.

**Path 1: Standalone test harness (primary development tool)**

A Node.js script that runs in the terminal, completely outside Electron. No app running, no inbox folder, no duplicate detection, no UI. Loads the engine bundle, strips categories from ground truth data, runs the convergence loop, and compares results. Fast iteration cycle — change engine code, run script, see accuracy numbers.

```bash
node scripts/test-convergence-loop.cjs          # all test scenarios
node scripts/test-convergence-loop.cjs --cold    # cold start only
node scripts/test-convergence-loop.cjs --warm    # warm corpus only
```

**Path 2: Isolated Electron instance (end-to-end validation)**

For testing the full flow (inbox → background processing → Finn review), launch Electron with a separate user data directory. This gives a clean slate — empty localStorage, empty transactions, fresh inbox — while existing app data is untouched.

```bash
# Normal dev (real data, untouched)
npm run electron-dev

# Test mode (isolated data directory)
npm run electron-dev:test
```

The `electron-dev:test` script uses `--user-data-dir=./test-userdata` to isolate completely. You'd run through onboarding in the test instance (profile, API key), then drop a bank statement PDF in the test instance's inbox and observe the full pipeline end-to-end.

Add to `package.json`:
```json
{
  "scripts": {
    "electron-dev:test": "npm run build:engine && concurrently ... -- --user-data-dir=./test-userdata"
  }
}
```

**When to use which:**
- Engine accuracy tuning → Path 1 (fast, no app, pure numbers)
- UX flow validation (Finn conversation, IPC, staging) → Path 2 (full app, isolated data)
- Both can run without touching existing production data

### 5.3 Test harness detail

New file: `scripts/test-convergence-loop.cjs`

**Setup:**
1. Load the ~1000 existing categorized transactions from localStorage (or an exported JSON snapshot)
2. Strip all category assignments — treat them as uncategorized incoming transactions
3. Optionally strip the similarity corpus to simulate a true first-time user (cold start)
4. Load the current category mapping (identifiers remain — these are the engine's built-in knowledge)
5. Load the practice profile (for fee matching and AI context)

**Test runs:**

| Test | Corpus | AI Pass | Simulates |
|---|---|---|---|
| A: Cold start, no AI | Empty | Off | First-time user, deterministic only |
| B: Cold start, with Opus | Empty | On | First-time user, full pipeline |
| C: Warm corpus, no AI | Full existing | Off | Returning user, deterministic only |
| D: Warm corpus, with AI | Full existing | On | Returning user, full pipeline |

**For each test run, measure:**
- Total auto-categorized (confidence >= 0.90)
- Total needing review (confidence < 0.90)
- **Accuracy** — compare auto-categorized category assignments against ground truth
  - True positives: correctly categorized
  - False positives: categorized with high confidence but wrong category
  - Cluster accuracy: when a cluster representative is correct, are all members correct?
- Convergence profile: how many iterations, how many transactions categorized per pass
- Time taken (deterministic passes vs AI pass)

### 5.3 Accuracy targets

| Metric | Target |
|---|---|
| Auto-categorization rate (cold start, with AI) | > 80% |
| Auto-categorization rate (warm corpus) | > 90% |
| Accuracy of auto-categorized transactions | > 95% |
| False positive rate (wrong category at high confidence) | < 2% |
| User decisions needed (cold start, 1000 txns) | < 40 |
| User decisions needed (warm corpus, 500 txns) | < 15 |

### 5.4 Refinement loop

The test harness is not a one-shot validation — it's a development tool:

1. Run test → identify failure patterns (which transactions were miscategorized and why?)
2. Adjust: tune confidence thresholds, group confidence formula, identifier list, Opus prompt
3. Re-run test → measure improvement
4. Repeat until accuracy targets are met

**Key failure patterns to watch for:**
- Group confidence promoting an entire cluster incorrectly (one bad member drags the group)
- Fee matching false positives (€60 payment that isn't a consultation)
- Opus hallucinating categories for ambiguous transactions
- Anomaly detection being too aggressive (demoting correct categorizations)

### 5.5 Exporting ground truth

Add a utility to export the current categorized transactions as a ground truth JSON file. This is distinct from the live data — it's a test fixture that can be version-controlled and reused as the engine evolves.

```javascript
// scripts/export-ground-truth.cjs
// Reads localStorage.json, extracts categorized transactions,
// saves as test-data/ground-truth-{date}.json
```

---

## 6. Risk Assessment

### 6.1 Accuracy risk: LOW

The same categorization engine runs with the same core logic. The convergence loop adds group confidence as a new signal, which could theoretically propagate errors through clusters. Anomaly detection (Section 3.3.6) mitigates this. The ground truth testing strategy (Section 5) validates accuracy before deployment.

**Mitigation:** The `categoryMatchType: 'finn-background'` marker lets us track accuracy of background-processed transactions separately. If accuracy degrades, we can tighten the auto-apply threshold (e.g., 0.95 instead of 0.90).

### 6.2 Data integrity risk: MEDIUM

Background processing writes to staging files, not live data. The apply step goes through IPC with explicit user approval. However, the transition from staging → live data must handle:
- App closing mid-apply (staging file should be the source of truth until fully applied)
- Concurrent processing of multiple files (queue, not parallel)
- Category mappings changing between processing and review (re-validate before apply)

**Mitigation:** Atomic apply — read staging, merge with live data, write live data, then mark staging as applied. If any step fails, staging file remains intact for retry.

### 6.3 User trust risk: MEDIUM

Users may be uncomfortable with the app "doing things" to their financial data without being asked. This is mitigated by:
- Nothing touches live data without explicit approval
- Finn explains what happened and asks before acting
- The user can dismiss staged results without applying
- The existing upload flow remains available as a fallback

### 6.4 API cost risk: LOW (deterministic), MEDIUM (Opus pass)

The deterministic convergence loop (Passes A-D) has zero API cost. The Opus deep analysis pass needs guardrails:
- Only triggers when corpus is thin (> 15% uncategorized or > 50 transactions)
- Max 1 Opus call per processing run
- Estimated cost: €0.50-1.00 for first-time upload of 1000 transactions
- Returning users rarely trigger AI pass (deterministic loop handles >85%)
- Cost shown to user in staging summary so there are no surprises

### 6.5 Build complexity risk: MEDIUM

The esbuild bundling and PDF adapter are straightforward. The file watcher is well-understood (chokidar is battle-tested). The convergence loop is a clean `while` loop over existing engine functions. The main complexity is in:
- Group confidence scoring (new formula, needs tuning via ground truth testing)
- The Opus prompt engineering (iterative refinement against test data)
- The round-based conversational review (prompt engineering for Finn, re-scoring integration)

---

## 7. What We Are NOT Building

To keep scope manageable:

- **No new UI modals or screens.** The entire review happens through Finn's chat. Settings gets one new button ("Open Inbox Folder").
- **No background processing when app is closed.** Processing only runs while Electron is open. No system services, no tray icons, no startup tasks.
- **No automatic application.** Even high-confidence results wait for user approval. Finn always asks first.
- **No cloud sync of staged results.** Staging is local only, same as all other data.
- **No multi-user conflict handling.** Single-user desktop app — no concurrent access concerns.
- **No mobile LAN access to background processing.** Mobile users use the existing upload flow. Background processing is desktop-only.

---

## 8. Build Sequence

| Phase | Description | Dependencies | Estimated Complexity |
|---|---|---|---|
| 1 | Engine portability (esbuild bundle) | None | Small — script + barrel file |
| 2 | PDF adapter for Node.js | Phase 1 | Small — thin wrapper |
| 3a | Background processor + convergence loop (no AI) | Phases 1, 2 | Medium — watcher + loop + staging |
| 3b | Group confidence scoring | Phase 3a | Small-Medium — new formula + tuning |
| 3c | Known fee amount matching | Phase 3a | Small — profile lookup + exact match |
| 3d | Anomaly detection | Phase 3b | Small — statistical checks |
| 3e | Opus 4.6 deep analysis pass | Phase 3a | Medium — prompt engineering + API integration |
| T | Ground truth testing harness | Phase 3a | Small — test script + export utility |
| 4 | IPC bridge extensions | Phase 3a | Small — standard pattern |
| 5 | Finn proactive awareness | Phase 4 | Small — extend existing system_status |
| 6 | Conversational review with strategic handover | Phases 4, 5 | Medium — prompt engineering + re-scoring |

**Recommended build order:**
1. Phases 1, 2 (foundation — can validate independently)
2. Phase 3a + Phase T (core loop + test harness — validate against ground truth immediately)
3. Phases 3b, 3c, 3d (refinements — add to loop, re-test against ground truth each time)
4. Phase 3e (Opus pass — test against cold-start ground truth)
5. Phase 4 (IPC bridge)
6. Phases 5, 6 (user-facing layer)

The ground truth testing harness (Phase T) is built alongside Phase 3a and used continuously throughout development. Every change to the convergence loop, group confidence formula, or Opus prompt is validated against the known-good data before proceeding.

---

## 9. Resolved Design Decisions

1. **Inbox folder is NOT configurable.** Fixed at `{userData}/inbox/`. A configurable path introduces a security risk — it could be pointed at sensitive system directories. The fixed path is inside Electron's managed userData directory, app-specific, and can't be manipulated externally.

2. **Existing upload UI is completely untouched.** This build creates an entirely separate code path — new files in `electron/`, new IPC channels, new staging storage. No modifications to `TransactionUpload.jsx`, `ProcessingFlow/`, `OnboardingProcessingFlow.jsx`, `GuidedAIExpenseCategorization.jsx`, `GuidedAIIdentifierSuggestions.jsx`, or any modal/picker components. The two paths converge only when approved staged transactions are added to the `transactions` array in AppContext — the same destination the existing upload flow uses.

3. **Wave processing is retired for the background path.** The convergence loop replaces wave processing entirely in the background processor. Wave processing remains available in the existing synchronous upload flow (untouched). The convergence loop is simpler (a `while` loop with a stopping condition vs. configurable wave batches) and produces better results (cascading enrichment).

4. **First-ever upload uses Opus 4.6 for deep analysis.** Unlike the original plan's Haiku batches, the background processor sends uncategorized transactions to Opus 4.6 with narrative prompting and enriched context. This only triggers when the corpus is thin. The cost (~€0.50-1.00) is justified by the dramatic reduction in user review burden on first use.

5. **Group confidence can only elevate, never lower.** The formula `max(individual, clusterBest × similarity)` ensures group membership never hurts a transaction's confidence. A well-scored individual transaction is never demoted by being in a cluster with low-confidence neighbors.

6. **Re-scoring between review rounds runs in the renderer.** The categorization engine is already available in React. Running re-scoring via IPC to the main process adds latency for no benefit. Only the initial convergence loop + Opus pass runs in the main process.

7. **The ground truth test harness is a first-class deliverable, not an afterthought.** It's built alongside the core loop (Phase T) and used continuously. Every engine change is validated against the ~1000 known-good transactions before proceeding.

8. **Cold-start pipeline is GROUP-first, not CATEGORY-first.** Testing revealed that Opus achieves 99.2% accuracy assigning transactions to 10 groups vs ~72% accuracy across 125 categories. Group errors cascade downstream (wrong P&L line, wrong category options). The revised pipeline completes group-level sorting before attempting category assignment.

9. **Similarity propagation removed from cold start.** At the cold-start stage, remaining transactions are genuinely dissimilar to everything the engine has seen. Similarity matching produced 50% accuracy — worse than Opus's below-threshold suggestions. Similarity propagation remains valuable for warm corpus (returning user) scenarios.

10. **Anomaly detection is advisory, not automatic.** MAD-based and ratio-based outlier detection both produced too many false alarms on GP practice data (1.6% and 25.4% precision respectively). Flags are stored on transactions for Finn to mention during review, but do not demote transactions from the auto cohort.

11. **Opus's self-reported confidence is well-calibrated at group level.** At >=0.90 confidence: 100% accuracy. At >=0.85: 99.2%. Below 0.80: error rate increases sharply. The 0.85 threshold is the sweet spot.

12. **Few-shot examples in the Opus prompt are critical.** Without them: 51.2% group accuracy. With enriched descriptions only: 81.5%. With few-shot examples: 100% at >=0.90. The examples teach boundary cases (NEPOSCHG → PROFESSIONAL, Fruit People → OTHER) more effectively than rules.

---

## 11. Revised Cold-Start Pipeline (2026-03-21)

The original plan (Section 3) described a single convergence loop for all scenarios. Testing revealed that cold start (new user, no learned identifiers) requires a fundamentally different pipeline from warm corpus (returning user).

### 11.1 Cold-Start Pipeline

```
Step 1: Default identifier matching (204 hardcoded identifiers)
  → ~73% of transactions assigned to category + group
  → Free, instant

Step 2: Practice profile & type matching
  → Income type detection (all credits → INCOME group)
  → Staff name matching from onboarding profile
  → Consultation fee matching
  → ~4% additional
  → Free, instant

Step 3: Opus GROUP-level assignment
  → Few-shot enriched prompt with category lists per group
  → 0.85 confidence threshold
  → Batches of 100 transactions
  → UNCERTAIN escape hatch
  → ~19% additional
  → Cost: ~€1-2 for 300-400 transactions

Step 4: Present to user
  → Remaining ~4%, clustered for strategic handover
  → Opus below-threshold suggestions shown as hints
  → ~46 decisions for 1542 transactions (~30 for 1000)
```

### 11.2 Warm-Corpus Pipeline (unchanged from Section 3)

Returning users with rich identifiers use the deterministic convergence loop. Opus rarely triggers (>15% uncategorized threshold). 91.7% coverage at 97.5% accuracy without any API cost.

### 11.3 Cold-Start Test Results

Tested against 1542 transactions with default identifiers only (corrected ground truth):

| Step | Assigned | Cumulative | Group Accuracy |
|---|---|---|---|
| Identifiers (204 default) | 1121 | 72.7% | 99.8% |
| Profile/Type | 60 | 76.6% | ~97% |
| Opus group (>=0.85) | 293 | 95.6% | ~82% |
| **Total before user** | **1474** | **96.0%** | **96.1%** |
| Remaining for user | 62 | — | ~46 decisions |

### 11.4 Opus Prompt Structure (Group-Level)

```
You are analysing bank transactions from an Irish GP practice.

PRACTICE PROFILE: [from onboarding]

AVAILABLE GROUPS (with the categories each contains):
  INCOME: Income
    Categories include: Patient Fees, PCRS Payments, ...
  STAFF: Staff Costs
    Categories include: GP Salaries, Locum Fees, Reception Salaries, ...
  [... all 10 groups with full category lists ...]

EXAMPLES: [8 few-shot examples covering boundary cases]

KEY RULES: [disambiguation rules for PREMISES vs OTHER, PROFESSIONAL vs OFFICE, etc.]

TRANSACTIONS TO CLASSIFY: [batches of 100]

→ JSON array response with group, confidence, reasoning
→ UNCERTAIN escape hatch available
```

### 11.5 Default Identifier Quality

Two default identifiers were fixed during testing:
- `"DUNNES"` → `"DUNNES STORES"` (was matching staff surname "Dunne")
- `"ISS"` → `"ISS Facility"` (was matching inside staff name "Melissa")

Short identifiers that appear as substrings in names are a recurring risk. Default identifiers should be at least 5 characters and avoid common name fragments.

---

## 12. Future Considerations (Post-MVP)

These ideas were discussed during planning and deferred as not immediately necessary but worth revisiting:

- **CRO business registry lookup** — Resolve counterparty names to Companies Registration Office entries, get NACE industry codes, map to categories. Requires API integration. Could significantly help with unknown vendors.
- **Multi-statement bootstrap** — Prompt users to upload 2-3 months of statements for first-time setup. More data = more temporal patterns = better convergence without increasing user burden.
- **Encryption at rest** — AES encryption for staging files if required for compliance.

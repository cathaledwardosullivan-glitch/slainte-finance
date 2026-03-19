# Agentic Transaction Processing — Complete Plan

> Status: PLANNED — Not yet built
> Date: 2026-03-18

## 1. Vision

Replace the synchronous, modal-based transaction upload flow with a background processing pipeline that Finn presents conversationally. The user drops bank statement files into a designated folder. While the app is open, Finn parses, categorizes, and stages the results. When ready, Finn proactively offers a summary and walks the user through approving high-confidence results and reviewing uncertain ones — via conversation, not modals.

### What Changes for the User

**Before (current):**
1. Open app → navigate to upload → select file → wait
2. Watch processing modal → review identifier suggestions → wait for AI calls
3. Step through category picker for each uncertain transaction
4. Session takes 10-15 minutes for a large statement

**After:**
1. Save bank statement PDF to the Sláinte inbox folder
2. Open app sometime later. Finn says: "I processed your February BOI statement — 412 of 445 transactions categorized at high confidence. Want me to apply those? I have 33 that need your input."
3. User says "yes, apply them" → Finn imports 412 transactions
4. Finn walks through the 33 uncertain ones conversationally: "I found 8 payments to 'Medisec' — that's medical indemnity insurance. File them all there?" → "Yes" → done
5. Session takes 2-3 minutes

### What Doesn't Change

- The categorization engine itself (identifier matching, Levenshtein similarity, unified confidence scoring, wave processing)
- The accuracy model — same thresholds, same cohort assignments
- The existing upload UI — remains available as an alternative path
- The category mapping data structure
- How transactions are stored in AppContext/localStorage

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  Electron Main Process               │
│                                                      │
│  ┌──────────┐    ┌──────────────┐    ┌───────────┐  │
│  │  Folder   │───▶│  Background  │───▶│  Staging  │  │
│  │  Watcher  │    │  Processor   │    │   Store   │  │
│  └──────────┘    └──────┬───────┘    └─────┬─────┘  │
│                         │                   │        │
│              ┌──────────▼───────┐           │        │
│              │ Categorization   │           │        │
│              │ Bundle (from     │           │        │
│              │ src/utils via    │           │        │
│              │ esbuild)         │           │        │
│              └──────────────────┘           │        │
│                                             │        │
├─────────────────────────────────────────────┼────────┤
│              IPC Bridge (preload.cjs)       │        │
├─────────────────────────────────────────────┼────────┤
│                                             │        │
│                  React Renderer             ▼        │
│                                                      │
│  ┌──────────────┐    ┌───────────────────────────┐  │
│  │ FinnContext   │───▶│  Conversational Review    │  │
│  │ (proactive    │    │  (search_transactions +   │  │
│  │  greeting     │    │   recategorize action)    │  │
│  │  extension)   │    └───────────────────────────┘  │
│  └──────────────┘                                    │
│                                                      │
└─────────────────────────────────────────────────────┘
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
export { levenshteinSimilarity, differenceRatio, calculateUnifiedConfidence, getAdaptiveWeights } from './stringUtils';
export { processInWaves, WAVE_CONFIG } from './waveProcessor';
export { processTransactionsWithEngine } from './transactionProcessor';
```

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

### Phase 3: Background Processor

**Goal:** Watch a folder for new files, process them through the engine, write results to staging.

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

3. **Processing pipeline** (per file)
   ```
   detect file type
   → parse (PDF adapter or CSV parser)
   → load current category mappings from localStorage.json
   → load existing transactions from localStorage.json (for similarity corpus)
   → run categorization engine (wave processor for large batches)
   → optional: AI pass for ai_assist cohort (see 3.3.4)
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

#### 3.3.3 Staging store

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
    auto: 412,        // confidence >= 0.90
    aiAssist: 21,     // 0.50 - 0.89
    review: 12,       // < 0.50
    dateRange: { from: "2026-02-01", to: "2026-02-28" },
    totalDebits: 45230.50,
    totalCredits: 62100.00
  },

  transactions: [
    {
      // Full transaction object (same structure as current)
      // Plus:
      categoryMatchType: "finn-background",  // Distinguishes from user/AI categorization
      stagedCohort: "auto" | "ai_assist" | "review"
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

#### 3.3.4 AI pass (optional, Phase 3b)

For transactions in the `ai_assist` cohort (confidence 0.50-0.89), the background processor can optionally call Claude Haiku to improve categorization. This is deferred to Phase 3b because:

- It requires API key access from secure credentials
- It needs cost guardrails (max calls per run, batch sizing)
- The non-AI pipeline already achieves good results for returning users (large similarity corpus)
- It can be added later without changing the staging format

**When implemented:**
- Batch ai_assist transactions in groups of 30-50
- Single Haiku call per batch with category mapping context
- Max 5 API calls per processing run (configurable)
- Results update the staged transactions' confidence and cohort
- Cost tracked and logged

#### 3.3.5 Duplicate detection

Before staging, compare incoming transactions against existing transactions in localStorage.json:
- Match on: date + absolute amount + normalised details (lowercase, trimmed)
- Flag exact duplicates in the staging file's `duplicates` field
- Don't auto-exclude — let the user decide during review (they may have legitimate duplicate payments)

#### 3.3.6 Integration with main.cjs

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
    const totalReview = staged.reduce((sum, s) => sum + s.summary.review + s.summary.aiAssist, 0);
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

### Phase 6: Conversational Review

**Goal:** Finn walks the user through approving and reviewing staged transactions via conversation, using existing tool patterns.

#### 3.6.1 New navigate target: staged review

Add `"staged:review"` as a navigate target. When Finn calls navigate with this target, the handler:

1. Fetches the full staged result via IPC
2. Separates transactions into cohorts: auto (>= 0.90), needs-review (< 0.90)
3. Returns a structured summary to Finn

Finn then has the information to drive the conversation.

#### 3.6.2 Conversation flow (prompt-engineered)

The flow is driven by Finn's tool descriptions and the agentic loop, not custom UI code. Finn already has the patterns from bulk recategorise:

**Step 1 — Finn presents the summary:**
"I processed February-2026-BOI.pdf. Here's what I found:
- 412 transactions categorized with high confidence (auto)
- 21 with moderate confidence (I'm fairly sure but want you to check)
- 12 I couldn't determine — need your input
- 3 possible duplicates of existing transactions

Want me to apply the 412 high-confidence ones?"

**Step 2 — User approves high-confidence batch:**
User: "Yes, apply them"
→ Finn calls IPC to apply auto-cohort transactions
→ Finn confirms: "Done — 412 transactions imported."

**Step 3 — Finn groups uncertain transactions by pattern:**
"For the ones needing review, I've grouped them by similarity:
1. 8 payments to 'MEDISEC IRELAND' — looks like medical indemnity (€4,200 total)
2. 5 payments to 'JOHNSON CLEANING' — looks like premises cleaning (€1,875 total)
3. 4 payments to 'DR K WALSH' — could be locum or referring consultant (€3,600 total)
4. 4 miscellaneous one-offs

Let's start with group 1 — should those go under 'Insurance - Medical Indemnity'?"

**Step 4 — User confirms/corrects each group:**
User: "Yes for Medisec. Johnson Cleaning goes under Premises. Dr Walsh is a locum."
→ Finn calls search_transactions with action="recategorize" for each group
→ Uses existing bulk recategorise flow (list → confirm → act)

**Step 5 — Handle remaining one-offs:**
Finn presents each individually or asks user to classify manually.

**Step 6 — Duplicates:**
"I also found 3 transactions that look like duplicates of ones already in your data. Want me to show them so you can decide?"

#### 3.6.3 How the tools work together

No new tools needed. The conversational review uses:

| Existing Tool | Role in Review |
|---|---|
| `lookup_financial_data` (staged_results) | Check what's pending |
| `navigate` (staged:review) | Load full staged data |
| `search_transactions` (list + recategorize) | Review and apply changes |
| `navigate` (categories:create) | Create new categories if needed |

The agentic loop (max 5 rounds) handles the multi-step flow. For large reviews with many groups, Finn may need multiple conversation turns (user responds, Finn continues). This is fine — it's how bulk recategorise already works.

#### 3.6.4 Applying staged transactions

When the user approves transactions (either in bulk or after review), the apply flow:

1. Finn calls a handler that invokes `background:apply-staged` IPC with the approved transaction IDs
2. Main process reads the staged file, extracts approved transactions
3. Main process loads current transactions from localStorage.json, appends new ones, saves
4. Renderer is notified via IPC event to reload transactions from storage
5. AppContext picks up the new data
6. Staged file is updated (approved transactions removed, or file deleted if all applied)

**Critical:** Transactions applied from staging use `categoryMatchType: 'finn-background'` so they don't pollute identifier learning (same pattern as `'finn-bulk'`). If the user later corrects a background-categorized transaction manually, THAT correction feeds back into identifiers normally.

#### 3.6.5 Identifier learning from review

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

## 5. Risk Assessment

### 5.1 Accuracy risk: LOW

The same categorization engine runs with the same thresholds. The only difference is delivery mechanism (background vs synchronous). The conversational review step ensures the user still validates uncertain transactions.

**Mitigation:** The `categoryMatchType: 'finn-background'` marker lets us track accuracy of background-processed transactions separately. If accuracy degrades, we can tighten the auto-apply threshold (e.g., 0.95 instead of 0.90).

### 5.2 Data integrity risk: MEDIUM

Background processing writes to staging files, not live data. The apply step goes through IPC with explicit user approval. However, the transition from staging → live data must handle:
- App closing mid-apply (staging file should be the source of truth until fully applied)
- Concurrent processing of multiple files (queue, not parallel)
- Category mappings changing between processing and review (re-validate before apply)

**Mitigation:** Atomic apply — read staging, merge with live data, write live data, then mark staging as applied. If any step fails, staging file remains intact for retry.

### 5.3 User trust risk: MEDIUM

Users may be uncomfortable with the app "doing things" to their financial data without being asked. This is mitigated by:
- Nothing touches live data without explicit approval
- Finn explains what happened and asks before acting
- The user can dismiss staged results without applying
- The existing upload flow remains available as a fallback

### 5.4 API cost risk: LOW (Phase 3a), MEDIUM (Phase 3b)

Phase 3a (no AI pass) has zero API cost — the engine is deterministic + similarity-based. Phase 3b (AI pass) needs guardrails:
- Max 5 Haiku calls per processing run
- Batch 30-50 transactions per call
- User-configurable: "Use AI for better accuracy" toggle in Settings
- Cost estimate shown before enabling: "Approximately €0.01-0.05 per bank statement"

### 5.5 Build complexity risk: MEDIUM

The esbuild bundling and PDF adapter are straightforward. The file watcher is well-understood (chokidar is battle-tested). The main complexity is in the conversational review flow — but it builds on established patterns (bulk recategorise, proactive greeting).

---

## 6. What We Are NOT Building

To keep scope manageable:

- **No new UI modals or screens.** The entire review happens through Finn's chat. Settings gets one new button ("Open Inbox Folder").
- **No background processing when app is closed.** Processing only runs while Electron is open. No system services, no tray icons, no startup tasks.
- **No automatic application.** Even high-confidence results wait for user approval. Finn always asks first.
- **No cloud sync of staged results.** Staging is local only, same as all other data.
- **No multi-user conflict handling.** Single-user desktop app — no concurrent access concerns.
- **No mobile LAN access to background processing.** Mobile users use the existing upload flow. Background processing is desktop-only.

---

## 7. Build Sequence

| Phase | Description | Dependencies | Estimated Complexity |
|---|---|---|---|
| 1 | Engine portability (esbuild bundle) | None | Small — script + barrel file |
| 2 | PDF adapter for Node.js | Phase 1 | Small — thin wrapper |
| 3a | Background processor (no AI) | Phases 1, 2 | Medium — watcher + pipeline + staging |
| 3b | Background processor AI pass | Phase 3a | Small — batch Haiku calls |
| 4 | IPC bridge extensions | Phase 3a | Small — standard pattern |
| 5 | Finn proactive awareness | Phase 4 | Small — extend existing system_status |
| 6 | Conversational review | Phases 4, 5 + bulk recategorise | Medium — prompt engineering + apply flow |

Phases 1 and 2 can be built and validated independently. Phase 3a is the core. Phases 4-6 are the user-facing layer. Phase 3b is optional and can be added anytime after 3a.

---

## 8. Resolved Design Decisions

1. **Inbox folder is NOT configurable.** Fixed at `{userData}/inbox/`. A configurable path introduces a security risk — it could be pointed at sensitive system directories. The fixed path is inside Electron's managed userData directory, app-specific, and can't be manipulated externally.

2. **Existing upload UI is completely untouched.** This build creates an entirely separate code path — new files in `electron/`, new IPC channels, new staging storage. No modifications to `TransactionUpload.jsx`, `ProcessingFlow/`, `OnboardingProcessingFlow.jsx`, `GuidedAIExpenseCategorization.jsx`, `GuidedAIIdentifierSuggestions.jsx`, or any modal/picker components. The two paths converge only when approved staged transactions are added to the `transactions` array in AppContext — the same destination the existing upload flow uses.

3. **Auto-apply uses existing engine thresholds.** The categorization engine's `CONFIDENCE_THRESHOLDS` already define the auto cohort at >= 0.90. The background processor uses these same thresholds unchanged. No new confidence logic. The only difference is that auto-cohort results still require one explicit user approval ("apply these?") before touching live data — but the accuracy bar is the same as the current system.

4. **First-ever upload works the same as today.** The wave processor already handles cold starts (no corpus = heavier reliance on identifiers, adaptive weighting as corpus grows). The background processor runs the same wave processor. More transactions will land in the review cohort, meaning Finn's conversational review will have more to walk through — the same experience as the current modal flow, delivered as dialogue. Every answer builds the corpus for next time.

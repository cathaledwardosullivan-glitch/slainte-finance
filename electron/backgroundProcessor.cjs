/**
 * Background Transaction Processor
 *
 * Watches the inbox folder for new bank statement files (PDF/CSV),
 * processes them through the convergence loop, and writes results
 * to staging files for Finn to present to the user.
 *
 * Runs in the Electron main process. Only active while the app is open.
 */

const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

// Bundled categorization engine (pure JS, no browser deps)
const engine = require('./utils/categorizationBundle.cjs');

// Shared convergence loop and anomaly detection
const { runConvergenceLoop, runAnomalyDetection } = require('./utils/convergenceLoop.cjs');

// Opus group-level analysis pass (Pass 1 of two-pass architecture)
const { shouldRunOpusPass, runOpusPass, GROUP_AUTO_THRESHOLD } = require('./utils/opusAnalysisPass.cjs');

// Category assignment pass (Pass 2 of two-pass architecture)
const { runCategoryAssignmentPass, CATEGORY_AUTO_THRESHOLD } = require('./utils/categoryAssignmentPass.cjs');

// Node.js PDF/CSV adapter
const { parseStatement } = require('./utils/pdfAdapter.cjs');

// Model configuration
const { MODELS } = require('./modelConfig.cjs');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIDENCE_AUTO_THRESHOLD = 0.90;
const FILE_DEBOUNCE_MS = 2000; // Wait for file write to complete
const BATCH_WINDOW_MS = 5000;  // Accumulate files arriving within this window into one batch
const SUPPORTED_EXTENSIONS = ['.pdf', '.csv'];

// ============================================================================
// BACKGROUND PROCESSOR CLASS
// ============================================================================

class BackgroundProcessor {
  /**
   * @param {Object} options
   * @param {string} options.userDataPath - Electron app.getPath('userData')
   * @param {function} options.onReady - Called when a file finishes processing
   * @param {function} options.onError - Called when processing fails
   * @param {function} options.onProgress - Called with progress updates
   */
  constructor({ userDataPath, onReady, onError, onProgress }) {
    this.userDataPath = userDataPath;
    this.onReady = onReady || (() => {});
    this.onError = onError || (() => {});
    this.onProgress = onProgress || (() => {});

    this.inboxPath = path.join(userDataPath, 'inbox');
    this.processedPath = path.join(userDataPath, 'inbox', 'processed');
    this.stagingPath = path.join(userDataPath, 'staged-results');
    this.localStoragePath = path.join(userDataPath, 'localStorage.json');

    this.watcher = null;
    this.processing = false;
    this.queue = [];

    // Batch window: accumulate files arriving close together
    this.batchWindowMs = BATCH_WINDOW_MS;
    this._batchTimer = null;
    this._batchQueue = [];
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  start() {
    this._ensureDirectories();
    this._startWatcher();
    // Process any files already in the inbox (from before app was opened)
    this._scanInbox();
    console.log('[BackgroundProcessor] Started — watching', this.inboxPath);
  }

  stop() {
    if (this._batchTimer) {
      clearTimeout(this._batchTimer);
      this._batchTimer = null;
    }
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    console.log('[BackgroundProcessor] Stopped');
  }

  getInboxPath() {
    return this.inboxPath;
  }

  // --------------------------------------------------------------------------
  // Folder Management
  // --------------------------------------------------------------------------

  _ensureDirectories() {
    for (const dir of [this.inboxPath, this.processedPath, this.stagingPath]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log('[BackgroundProcessor] Created directory:', dir);
      }
    }
  }

  // --------------------------------------------------------------------------
  // File Watcher
  // --------------------------------------------------------------------------

  _startWatcher() {
    this.watcher = chokidar.watch(this.inboxPath, {
      ignored: [
        this.processedPath,        // Ignore the processed subfolder
        /(^|[\/\\])\../,           // Ignore dotfiles
        /\.tmp$/i,                 // Ignore temp files
        /~$/,                      // Ignore backup files
      ],
      depth: 0,                    // Only watch top-level inbox, not subdirs
      awaitWriteFinish: {
        stabilityThreshold: FILE_DEBOUNCE_MS,
        pollInterval: 500,
      },
    });

    this.watcher.on('add', (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.includes(ext)) return;

      console.log('[BackgroundProcessor] New file detected:', path.basename(filePath));
      this._enqueue(filePath);
    });

    this.watcher.on('error', (error) => {
      console.error('[BackgroundProcessor] Watcher error:', error);
    });
  }

  _scanInbox() {
    try {
      const files = fs.readdirSync(this.inboxPath);
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (!SUPPORTED_EXTENSIONS.includes(ext)) continue;

        const filePath = path.join(this.inboxPath, file);
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          console.log('[BackgroundProcessor] Found existing file in inbox:', file);
          this._enqueue(filePath);
        }
      }
    } catch (error) {
      console.error('[BackgroundProcessor] Error scanning inbox:', error);
    }
  }

  // --------------------------------------------------------------------------
  // Processing Queue
  // --------------------------------------------------------------------------

  _enqueue(filePath) {
    // Don't queue duplicates
    if (this._batchQueue.includes(filePath)) return;
    if (this.queue.some(q => Array.isArray(q) ? q.includes(filePath) : q === filePath)) return;

    this._batchQueue.push(filePath);

    // Reset the batch window timer — keep accumulating if more files arrive
    if (this._batchTimer) clearTimeout(this._batchTimer);
    this._batchTimer = setTimeout(() => this._flushBatch(), this.batchWindowMs);
  }

  _flushBatch() {
    this._batchTimer = null;
    if (this._batchQueue.length === 0) return;

    const batch = [...this._batchQueue];
    this._batchQueue = [];

    if (batch.length === 1) {
      // Single file — queue as a plain path (existing behavior)
      this.queue.push(batch[0]);
    } else {
      // Multiple files — queue as an array (batch)
      console.log(`[BackgroundProcessor] Batching ${batch.length} files for combined processing`);
      this.queue.push(batch);
    }

    this._processNext();
  }

  async _processNext() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const item = this.queue.shift();
    const isBatch = Array.isArray(item);

    try {
      if (isBatch) {
        const fileNames = item.map(f => path.basename(f));
        console.log(`[BackgroundProcessor] Processing batch of ${item.length} files:`, fileNames.join(', '));
        this.onProgress(fileNames.join(', '), 0);

        const result = await this._processBatch(item);

        // Move all files to processed folder
        for (const filePath of item) {
          const destPath = path.join(this.processedPath, path.basename(filePath));
          fs.renameSync(filePath, destPath);
        }
        console.log(`[BackgroundProcessor] Moved ${item.length} files to processed`);

        this.onReady(result);
      } else {
        const filePath = item;
        const fileName = path.basename(filePath);
        console.log('[BackgroundProcessor] Processing:', fileName);
        this.onProgress(fileName, 0);

        const result = await this._processFile(filePath);

        // Move file to processed folder
        const destPath = path.join(this.processedPath, fileName);
        fs.renameSync(filePath, destPath);
        console.log('[BackgroundProcessor] Moved to processed:', fileName);

        this.onReady(result);
      }
    } catch (error) {
      if (isBatch) {
        const fileNames = item.map(f => path.basename(f)).join(', ');
        console.error('[BackgroundProcessor] Error processing batch:', fileNames, ':', error.message);
        this.onError(error, fileNames);
      } else {
        const fileName = path.basename(item);
        console.error('[BackgroundProcessor] Error processing', fileName, ':', error.message);
        this.onError(error, fileName);
      }
    } finally {
      this.processing = false;
      // Process next in queue
      if (this.queue.length > 0) {
        this._processNext();
      }
    }
  }

  // --------------------------------------------------------------------------
  // Core Processing Pipeline
  // --------------------------------------------------------------------------

  async _processFile(filePath) {
    const fileName = path.basename(filePath);

    // Step 1: Parse the file (PDF or CSV)
    this.onProgress(fileName, 10);
    const parsed = await parseStatement(filePath);
    console.log('[BackgroundProcessor] Parsed', parsed.transactions.length, 'transactions from', fileName);

    if (parsed.transactions.length === 0) {
      throw new Error(`No transactions found in ${fileName}`);
    }

    // Step 2: Load current data from localStorage
    this.onProgress(fileName, 20);
    const categoryMapping = this._loadCategoryMapping();
    const existingTransactions = this._loadExistingTransactions();
    const practiceProfile = this._loadPracticeProfile();

    console.log('[BackgroundProcessor] Loaded context:', {
      categories: categoryMapping.length,
      existingTransactions: existingTransactions.length,
      hasProfile: !!practiceProfile,
    });

    // Step 3: Normalize parsed transactions (add IDs, standard fields)
    const incoming = this._normalizeTransactions(parsed.transactions, fileName);

    // Step 4: Duplicate detection
    this.onProgress(fileName, 30);
    const duplicates = this._detectDuplicates(incoming, existingTransactions);

    // Step 5: Run convergence loop (deterministic passes A-D)
    this.onProgress(fileName, 40);
    const convergenceResult = this._runConvergenceLoop(
      incoming,
      categoryMapping,
      existingTransactions,
      practiceProfile
    );

    // Step 5b: Opus GROUP-level analysis pass (cold start / high uncategorized count)
    // Two-pass architecture: Pass 1 assigns groups only. Groups are sufficient for dashboard.
    // Categories assigned later (Pass 2) when detailed reports are needed.
    let opusTriggered = false;
    const totalTxns = convergenceResult.categorized.length + convergenceResult.uncategorized.length;
    if (shouldRunOpusPass(totalTxns, convergenceResult.uncategorized.length)) {
      this.onProgress(fileName, 60);
      const apiKey = this._loadApiKey();
      if (apiKey && !this._isLocalOnlyMode()) {
        opusTriggered = true;
        const corrections = this._loadAICorrections();
        const groupCorrections = this._formatCorrectionsForPrompt(corrections, 'group_assignment');
        console.log(`[BackgroundProcessor] Opus group pass triggered: ${convergenceResult.uncategorized.length}/${totalTxns} uncategorized`);

        const opusResult = await runOpusPass(
          convergenceResult.uncategorized,
          categoryMapping,
          practiceProfile,
          apiKey,
          groupCorrections
        );

        if (opusResult.results.length > 0) {
          // Opus assigned groups — move from uncategorized based on confidence
          const opusHandledIds = new Set(opusResult.results.map(r => r.id));
          convergenceResult.uncategorized = convergenceResult.uncategorized.filter(t => !opusHandledIds.has(t.id));

          // Group-confirmed (>=0.85) go to 'group-confirmed' cohort
          // Below threshold go to 'review' with group as hint
          for (const txn of opusResult.results) {
            txn.stagedCohort = txn.groupConfirmed ? 'group-confirmed' : 'review';
            convergenceResult.categorized.push(txn);
          }

          console.log(`[BackgroundProcessor] Opus grouped ${opusResult.results.length} transactions (${opusResult.results.filter(r => r.groupConfirmed).length} auto-confirmed)`);
        }

        // UNCERTAIN results also move out of uncategorized — they go to review with no group hint
        if (opusResult.uncertain.length > 0) {
          const uncertainIds = new Set(opusResult.uncertain.map(r => r.id));
          convergenceResult.uncategorized = convergenceResult.uncategorized.filter(t => !uncertainIds.has(t.id));

          for (const txn of opusResult.uncertain) {
            txn.stagedCohort = 'review';
          }
          convergenceResult.categorized.push(...opusResult.uncertain);
          console.log(`[BackgroundProcessor] Opus uncertain: ${opusResult.uncertain.length} transactions (no group suggestion)`);
        }

        // Step 5c: Post-AI cascade on remaining (UNCERTAIN + below threshold)
        // Uses identifier/profile corpus which has full categories — any similarity
        // matches get both group AND category, going straight to auto cohort.
        const remainingForCascade = convergenceResult.uncategorized;
        if (remainingForCascade.length > 0) {
          this.onProgress(fileName, 70);
          const cascadeCorpus = [...existingTransactions, ...convergenceResult.categorized.filter(t => !!t.categoryCode)];
          const postAiResult = runConvergenceLoop(
            remainingForCascade,
            categoryMapping,
            cascadeCorpus,
            practiceProfile,
            { maxIterations: 3 }
          );

          if (postAiResult.categorized.length > 0) {
            for (const txn of postAiResult.categorized) {
              txn.categoryMatchType = 'finn-background';
              txn.stagedCohort = txn.unifiedConfidence >= CONFIDENCE_AUTO_THRESHOLD ? 'auto' : 'review';
              txn.convergencePass = 'post_ai_cascade';
            }
            convergenceResult.categorized.push(...postAiResult.categorized);
            convergenceResult.uncategorized = postAiResult.uncategorized;
            console.log(`[BackgroundProcessor] Post-AI cascade: +${postAiResult.categorized.length} categorized`);
          }
        }

        if (opusResult.error) {
          console.warn(`[BackgroundProcessor] Opus pass error: ${opusResult.error}`);
        }
      } else {
        console.log('[BackgroundProcessor] Opus pass skipped: no API key or Local Only Mode');
      }
    }

    // Step 5d: Anomaly detection + correlation with Opus
    this.onProgress(fileName, 80);
    const anomalies = runAnomalyDetection(
      convergenceResult.categorized,
      categoryMapping,
      practiceProfile
    );

    // Correlate anomaly flags with Opus results
    if (opusTriggered) {
      for (const flaggedTxn of anomalies.demoted) {
        // Check if Opus independently categorized this transaction the same way
        const opusCategorized = convergenceResult.categorized.find(
          t => t.id === flaggedTxn.id && t.convergencePass === 'opus_ai'
        );
        if (opusCategorized) {
          // Opus agrees with the categorization — likely a false alarm
          flaggedTxn.anomalyCorrelation = 'opus_agrees';
        } else {
          // Opus didn't categorize this (it was categorized by deterministic passes)
          // The flag stands as uncorroborated
          flaggedTxn.anomalyCorrelation = 'opus_not_assessed';
        }
      }
    }

    if (anomalies.demoted.length > 0) {
      console.log(`[BackgroundProcessor] Anomaly flags: ${anomalies.demoted.length} transaction(s) flagged`);
    }
    if (anomalies.warnings.length > 0) {
      anomalies.warnings.forEach(w => console.log(`[BackgroundProcessor] Warning: ${w}`));
    }

    this.onProgress(fileName, 90);

    // Step 6: Build staging result
    const staged = this._buildStagedResult(
      fileName,
      convergenceResult,
      duplicates,
      parsed.metadata,
      anomalies,
      opusTriggered
    );

    // Step 7: Write staging file
    const stagingFile = path.join(this.stagingPath, `${staged.id}.json`);
    fs.writeFileSync(stagingFile, JSON.stringify(staged, null, 2));
    console.log('[BackgroundProcessor] Staged result written:', staged.id);

    this.onProgress(fileName, 100);

    return staged;
  }

  // --------------------------------------------------------------------------
  // Batch Processing (multiple files → single staged result)
  // --------------------------------------------------------------------------

  async _processBatch(filePaths) {
    const fileNames = filePaths.map(f => path.basename(f));
    const batchLabel = `${fileNames.length} files`;

    // Step 1: Parse all files
    this.onProgress(batchLabel, 5);
    const allParsed = [];
    const parseMetadata = { dateRange: null, sourceFiles: [] };

    for (const filePath of filePaths) {
      const fileName = path.basename(filePath);
      try {
        const parsed = await parseStatement(filePath);
        console.log(`[BackgroundProcessor] Batch parsed ${parsed.transactions.length} transactions from ${fileName}`);

        if (parsed.transactions.length === 0) {
          console.warn(`[BackgroundProcessor] Batch: no transactions in ${fileName}, skipping`);
          continue;
        }

        // Normalize with source file tracking (already built into _normalizeTransactions)
        const normalized = this._normalizeTransactions(parsed.transactions, fileName);
        allParsed.push(...normalized);
        parseMetadata.sourceFiles.push(fileName);

        // Merge date ranges
        if (parsed.metadata?.dateRange) {
          if (!parseMetadata.dateRange) {
            parseMetadata.dateRange = { ...parsed.metadata.dateRange };
          } else {
            if (parsed.metadata.dateRange.from < parseMetadata.dateRange.from) {
              parseMetadata.dateRange.from = parsed.metadata.dateRange.from;
            }
            if (parsed.metadata.dateRange.to > parseMetadata.dateRange.to) {
              parseMetadata.dateRange.to = parsed.metadata.dateRange.to;
            }
          }
        }
      } catch (err) {
        console.error(`[BackgroundProcessor] Batch: error parsing ${fileName}:`, err.message);
        // Continue with other files — don't fail the whole batch
      }
    }

    if (allParsed.length === 0) {
      throw new Error(`No transactions found across ${fileNames.length} files`);
    }

    console.log(`[BackgroundProcessor] Batch: ${allParsed.length} total transactions from ${parseMetadata.sourceFiles.length} files`);

    // Step 2: Load context (once for the whole batch)
    this.onProgress(batchLabel, 15);
    const categoryMapping = this._loadCategoryMapping();
    const existingTransactions = this._loadExistingTransactions();
    const practiceProfile = this._loadPracticeProfile();

    console.log('[BackgroundProcessor] Batch loaded context:', {
      categories: categoryMapping.length,
      existingTransactions: existingTransactions.length,
      hasProfile: !!practiceProfile,
    });

    // Step 3: Cross-file duplicate detection (against existing + within batch)
    this.onProgress(batchLabel, 25);
    const duplicates = this._detectDuplicates(allParsed, existingTransactions);
    // Also detect intra-batch duplicates (same transaction in overlapping statements)
    const intraBatchDups = this._detectIntraBatchDuplicates(allParsed);
    if (intraBatchDups.length > 0) {
      console.log(`[BackgroundProcessor] Batch: ${intraBatchDups.length} intra-batch duplicates removed`);
      const intraDupSet = new Set(intraBatchDups);
      // Remove intra-batch duplicates (keep first occurrence)
      const deduped = [];
      for (const t of allParsed) {
        if (!intraDupSet.has(t.id)) {
          deduped.push(t);
        }
      }
      allParsed.length = 0;
      allParsed.push(...deduped);
      duplicates.intraBatchCount = intraBatchDups.length;
    }

    // Step 4: Convergence loop on combined set
    this.onProgress(batchLabel, 35);
    const convergenceResult = this._runConvergenceLoop(
      allParsed,
      categoryMapping,
      existingTransactions,
      practiceProfile
    );

    // Step 5: Opus GROUP-level analysis (same logic as single-file)
    let opusTriggered = false;
    const totalTxns = convergenceResult.categorized.length + convergenceResult.uncategorized.length;
    if (shouldRunOpusPass(totalTxns, convergenceResult.uncategorized.length)) {
      this.onProgress(batchLabel, 55);
      const apiKey = this._loadApiKey();
      if (apiKey && !this._isLocalOnlyMode()) {
        opusTriggered = true;
        const corrections = this._loadAICorrections();
        const groupCorrections = this._formatCorrectionsForPrompt(corrections, 'group_assignment');
        console.log(`[BackgroundProcessor] Batch Opus group pass: ${convergenceResult.uncategorized.length}/${totalTxns} uncategorized`);

        const opusResult = await runOpusPass(
          convergenceResult.uncategorized,
          categoryMapping,
          practiceProfile,
          apiKey,
          groupCorrections
        );

        if (opusResult.results.length > 0) {
          const opusHandledIds = new Set(opusResult.results.map(r => r.id));
          convergenceResult.uncategorized = convergenceResult.uncategorized.filter(t => !opusHandledIds.has(t.id));

          for (const txn of opusResult.results) {
            txn.stagedCohort = txn.groupConfirmed ? 'group-confirmed' : 'review';
            convergenceResult.categorized.push(txn);
          }

          console.log(`[BackgroundProcessor] Batch Opus grouped ${opusResult.results.length} transactions (${opusResult.results.filter(r => r.groupConfirmed).length} auto-confirmed)`);
        }

        if (opusResult.uncertain.length > 0) {
          const uncertainIds = new Set(opusResult.uncertain.map(r => r.id));
          convergenceResult.uncategorized = convergenceResult.uncategorized.filter(t => !uncertainIds.has(t.id));

          for (const txn of opusResult.uncertain) {
            txn.stagedCohort = 'review';
          }
          convergenceResult.categorized.push(...opusResult.uncertain);
          console.log(`[BackgroundProcessor] Batch Opus uncertain: ${opusResult.uncertain.length} transactions`);
        }

        // Post-AI cascade
        const remainingForCascade = convergenceResult.uncategorized;
        if (remainingForCascade.length > 0) {
          this.onProgress(batchLabel, 70);
          const cascadeCorpus = [...existingTransactions, ...convergenceResult.categorized.filter(t => !!t.categoryCode)];
          const postAiResult = runConvergenceLoop(
            remainingForCascade,
            categoryMapping,
            cascadeCorpus,
            practiceProfile,
            { maxIterations: 3 }
          );

          if (postAiResult.categorized.length > 0) {
            for (const txn of postAiResult.categorized) {
              txn.categoryMatchType = 'finn-background';
              txn.stagedCohort = txn.unifiedConfidence >= CONFIDENCE_AUTO_THRESHOLD ? 'auto' : 'review';
              txn.convergencePass = 'post_ai_cascade';
            }
            convergenceResult.categorized.push(...postAiResult.categorized);
            convergenceResult.uncategorized = postAiResult.uncategorized;
            console.log(`[BackgroundProcessor] Batch post-AI cascade: +${postAiResult.categorized.length} categorized`);
          }
        }

        if (opusResult.error) {
          console.warn(`[BackgroundProcessor] Batch Opus pass error: ${opusResult.error}`);
        }
      }
    }

    // Step 6: Anomaly detection
    this.onProgress(batchLabel, 80);
    const anomalies = runAnomalyDetection(
      convergenceResult.categorized,
      categoryMapping,
      practiceProfile
    );

    if (opusTriggered) {
      for (const flaggedTxn of anomalies.demoted) {
        const opusCategorized = convergenceResult.categorized.find(
          t => t.id === flaggedTxn.id && t.convergencePass === 'opus_ai'
        );
        flaggedTxn.anomalyCorrelation = opusCategorized ? 'opus_agrees' : 'opus_not_assessed';
      }
    }

    if (anomalies.demoted.length > 0) {
      console.log(`[BackgroundProcessor] Batch anomaly flags: ${anomalies.demoted.length}`);
    }

    // Step 7: Build single staged result for the entire batch
    this.onProgress(batchLabel, 90);
    const staged = this._buildStagedResult(
      parseMetadata.sourceFiles.join(', '),
      convergenceResult,
      duplicates,
      parseMetadata,
      anomalies,
      opusTriggered
    );

    // Add batch-specific metadata
    staged.sourceFiles = parseMetadata.sourceFiles;
    staged.isBatch = true;

    // Per-file breakdown for the summary
    staged.summary.fileBreakdown = parseMetadata.sourceFiles.map(sf => {
      const fileTxns = staged.transactions.filter(t => t.fileName === sf);
      return {
        fileName: sf,
        transactionCount: fileTxns.length,
        debits: Math.round(fileTxns.reduce((sum, t) => sum + (t.debit || 0), 0) * 100) / 100,
        credits: Math.round(fileTxns.reduce((sum, t) => sum + (t.credit || 0), 0) * 100) / 100,
      };
    });

    if (duplicates.intraBatchCount) {
      staged.summary.intraBatchDuplicates = duplicates.intraBatchCount;
    }

    // Step 8: Write staging file
    const stagingFile = path.join(this.stagingPath, `${staged.id}.json`);
    fs.writeFileSync(stagingFile, JSON.stringify(staged, null, 2));
    console.log(`[BackgroundProcessor] Batch staged result written: ${staged.id} (${allParsed.length} transactions from ${parseMetadata.sourceFiles.length} files)`);

    this.onProgress(batchLabel, 100);
    return staged;
  }

  /**
   * Detect duplicate transactions within a batch (overlapping bank statements).
   * Returns IDs to remove (keeps first occurrence by array order).
   */
  _detectIntraBatchDuplicates(transactions) {
    const seen = new Set();
    const duplicateIds = [];

    for (const t of transactions) {
      const sig = this._transactionSignature(t);
      if (!sig) continue;

      // Include source file in the key — same transaction in different files is a duplicate
      // Same transaction in the same file is NOT a duplicate (could be legit same-day same-amount)
      const crossFileSig = sig; // Signature without file — matches across files
      if (seen.has(crossFileSig)) {
        // Only flag as intra-batch dup if from a DIFFERENT source file
        const firstMatch = transactions.find(
          other => other.id !== t.id && this._transactionSignature(other) === crossFileSig
        );
        if (firstMatch && firstMatch.fileName !== t.fileName) {
          duplicateIds.push(t.id);
          continue;
        }
      }
      seen.add(crossFileSig);
    }

    return duplicateIds;
  }

  // --------------------------------------------------------------------------
  // Data Loading
  // --------------------------------------------------------------------------

  _loadLocalStorageKey(key) {
    try {
      if (!fs.existsSync(this.localStoragePath)) return null;
      const data = JSON.parse(fs.readFileSync(this.localStoragePath, 'utf-8'));
      const value = data[key];
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`[BackgroundProcessor] Error loading ${key}:`, error.message);
      return null;
    }
  }

  _loadCategoryMapping() {
    return this._loadLocalStorageKey('gp_finance_category_mapping') || [];
  }

  _loadExistingTransactions() {
    return this._loadLocalStorageKey('gp_finance_transactions') || [];
  }

  _loadPracticeProfile() {
    return this._loadLocalStorageKey('slainte_practice_profile') || {};
  }

  _loadApiKey() {
    try {
      if (!fs.existsSync(this.localStoragePath)) return null;
      const data = JSON.parse(fs.readFileSync(this.localStoragePath, 'utf-8'));
      return data.claude_api_key || null;
    } catch {
      return null;
    }
  }

  _isLocalOnlyMode() {
    const profile = this._loadPracticeProfile();
    return profile?.operations?.localOnlyMode === true;
  }

  _loadAICorrections() {
    return this._loadLocalStorageKey('slainte_ai_corrections') || {};
  }

  /**
   * Format corrections for a given feature into a prompt block.
   * @param {Object} corrections - Full aiCorrections object
   * @param {string} feature - 'group_assignment' or 'expense_categorization'
   * @param {number} limit - Max corrections to include
   * @returns {string} Prompt block or empty string
   */
  _formatCorrectionsForPrompt(corrections, feature, limit = 20) {
    const featureCorrections = corrections[feature] || [];
    if (featureCorrections.length === 0) return '';

    const sorted = [...featureCorrections]
      .sort((a, b) => (b.frequency !== a.frequency) ? b.frequency - a.frequency : b.timestamp - a.timestamp)
      .slice(0, limit);

    const lines = sorted.map(c => {
      const freq = c.frequency > 1 ? ` [corrected ${c.frequency}x]` : '';
      return `- "${c.pattern}": AI suggested ${c.aiSuggested.name} → User corrected to ${c.userChose.name}${freq}`;
    });

    return `\nLEARNED CORRECTIONS (from user feedback — avoid repeating these mistakes):\n${lines.join('\n')}\n`;
  }

  // --------------------------------------------------------------------------
  // Transaction Normalization
  // --------------------------------------------------------------------------

  _normalizeTransactions(rawTransactions, sourceFile) {
    return rawTransactions.map((t, idx) => {
      const date = t.date instanceof Date ? t.date : new Date(t.date);
      const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      return {
        id: `bg-${Date.now()}-${idx}`,
        date: date.toISOString(),
        details: t.details || '',
        debit: t.debit || null,
        credit: t.credit || null,
        amount: t.amount || t.debit || t.credit || 0,
        balance: t.balance || null,
        monthYear,
        fileName: sourceFile,
        type: t.isIncome ? 'income' : 'expense',
        isIncome: t.isIncome || false,
      };
    });
  }

  // --------------------------------------------------------------------------
  // Duplicate Detection
  // --------------------------------------------------------------------------

  _detectDuplicates(incoming, existing) {
    // Build a Set of existing transaction signatures for fast lookup
    const existingSignatures = new Set();
    for (const t of existing) {
      const sig = this._transactionSignature(t);
      if (sig) existingSignatures.add(sig);
    }

    const duplicateIds = [];
    for (const t of incoming) {
      const sig = this._transactionSignature(t);
      if (sig && existingSignatures.has(sig)) {
        duplicateIds.push(t.id);
      }
    }

    if (duplicateIds.length > 0) {
      console.log('[BackgroundProcessor] Found', duplicateIds.length, 'potential duplicates');
    }

    return {
      count: duplicateIds.length,
      ids: duplicateIds,
    };
  }

  _transactionSignature(t) {
    // Match on: date + absolute amount + normalised details
    try {
      const date = new Date(t.date).toISOString().split('T')[0];
      const amount = Math.abs(t.amount || t.debit || t.credit || 0).toFixed(2);
      const details = (t.details || '').toLowerCase().trim();
      return `${date}|${amount}|${details}`;
    } catch {
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Convergence Loop (delegates to shared module)
  // --------------------------------------------------------------------------

  _runConvergenceLoop(incomingTransactions, categoryMapping, existingTransactions, practiceProfile) {
    const result = runConvergenceLoop(
      incomingTransactions,
      categoryMapping,
      existingTransactions,
      practiceProfile
    );

    // Add background-processor-specific fields
    for (const txn of result.categorized) {
      txn.categoryMatchType = 'finn-background';
      txn.stagedCohort = txn.unifiedConfidence >= CONFIDENCE_AUTO_THRESHOLD ? 'auto' : 'review';
    }
    for (const txn of result.uncategorized) {
      txn.stagedCohort = 'review';
      txn.unifiedConfidence = 0;
      txn.convergencePass = 'none';
      txn.categoryMatchType = 'finn-background';
    }

    // Log summary
    for (const iter of result.passBreakdown) {
      console.log(`[BackgroundProcessor] Iteration ${iter.iteration}: +${iter.total} categorized (A=${iter.passA} B=${iter.passB} C=${iter.passC} D=${iter.passD})`);
    }

    return result;
  }

  // --------------------------------------------------------------------------
  // Staging
  // --------------------------------------------------------------------------

  _buildStagedResult(sourceFile, convergenceResult, duplicates, parseMetadata, anomalies = { demoted: [], warnings: [] }, opusTriggered = false) {
    const { categorized, uncategorized, iterations, passBreakdown } = convergenceResult;
    const allTransactions = [...categorized, ...uncategorized];

    // Anomaly-flagged transactions stay in their cohort — flags are advisory, not demotions.
    // Finn mentions them during review.
    const auto = categorized.filter(t => t.stagedCohort === 'auto');
    const groupConfirmed = categorized.filter(t => t.stagedCohort === 'group-confirmed');
    const review = [...categorized.filter(t => t.stagedCohort === 'review'), ...uncategorized];

    // Build review clusters for strategic handover (groups-only review)
    const reviewClusters = this._buildReviewClusters(review);

    const totalDebits = allTransactions.reduce((sum, t) => sum + (t.debit || 0), 0);
    const totalCredits = allTransactions.reduce((sum, t) => sum + (t.credit || 0), 0);

    return {
      id: `staged-${Date.now()}`,
      sourceFile,
      processedAt: new Date().toISOString(),

      summary: {
        totalTransactions: allTransactions.length,
        auto: auto.length,
        groupConfirmed: groupConfirmed.length,
        review: review.length,
        dateRange: parseMetadata.dateRange || null,
        totalDebits: Math.round(totalDebits * 100) / 100,
        totalCredits: Math.round(totalCredits * 100) / 100,
        convergenceIterations: iterations,
        passBreakdown,
        opusPassTriggered: opusTriggered,
        anomaliesDemoted: anomalies.demoted.length,
      },

      anomalyWarnings: anomalies.warnings,
      reviewClusters,

      transactions: allTransactions.map(t => {
        // Strip the full category object for JSON serialization (keep code/name)
        const { category, ...rest } = t;
        return rest;
      }),

      duplicates,

      status: 'ready',
      error: null,
    };
  }

  _buildReviewClusters(reviewTransactions) {
    if (reviewTransactions.length === 0) return [];

    // Cluster the review transactions
    const clusters = engine.clusterSimilarTransactions(reviewTransactions);

    return clusters
      .filter(c => c.size >= 1)
      .map(cluster => {
        const rep = cluster.representative;
        // Check if any member has a suggested category (from identifier/cascade matches)
        const categorizedMember = cluster.transactions.find(t => t.categoryCode);
        // Check if any member has a suggested group (from Opus group pass)
        const groupedMember = cluster.transactions.find(t => t.suggestedGroup);

        return {
          representativeId: rep.id,
          representativeDescription: rep.details,
          // Category data (from identifier/cascade — may be null for Opus-grouped txns)
          suggestedCategory: categorizedMember?.categoryName || null,
          suggestedCategoryCode: categorizedMember?.categoryCode || null,
          suggestedConfidence: categorizedMember?.unifiedConfidence || 0,
          // Group data (from Opus group pass)
          suggestedGroup: groupedMember?.suggestedGroup || null,
          opusGroupConfidence: groupedMember?.opusGroupConfidence || 0,
          opusReasoning: groupedMember?.opusReasoning || null,
          memberCount: cluster.size,
          totalAmount: cluster.transactions.reduce((sum, t) => sum + (t.amount || 0), 0),
        };
      })
      .sort((a, b) => b.memberCount - a.memberCount);
  }

  // --------------------------------------------------------------------------
  // Staging Query API (called via IPC from renderer)
  // --------------------------------------------------------------------------

  getStagedResults() {
    try {
      if (!fs.existsSync(this.stagingPath)) return [];

      const files = fs.readdirSync(this.stagingPath)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse();

      return files.map(f => {
        const data = JSON.parse(fs.readFileSync(path.join(this.stagingPath, f), 'utf8'));
        return {
          id: data.id,
          sourceFile: data.sourceFile,
          summary: data.summary,
          processedAt: data.processedAt,
          status: data.status,
        };
      });
    } catch (error) {
      console.error('[BackgroundProcessor] Error reading staged results:', error);
      return [];
    }
  }

  getStagedDetail(stagedId) {
    try {
      const filePath = path.join(this.stagingPath, `${stagedId}.json`);
      if (!fs.existsSync(filePath)) return null;
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      console.error('[BackgroundProcessor] Error reading staged detail:', error);
      return null;
    }
  }

  applyStagedTransactions(stagedId, approvedTransactionIds) {
    try {
      const stagingFile = path.join(this.stagingPath, `${stagedId}.json`);
      if (!fs.existsSync(stagingFile)) {
        throw new Error(`Staged result ${stagedId} not found`);
      }

      const staged = JSON.parse(fs.readFileSync(stagingFile, 'utf8'));

      // Extract approved transactions
      const approvedSet = new Set(approvedTransactionIds);
      const approved = staged.transactions.filter(t => approvedSet.has(t.id));

      if (approved.length === 0) {
        throw new Error('No matching transactions found for the provided IDs');
      }

      // Load current transactions from localStorage
      const currentTransactions = this._loadExistingTransactions();

      // Append approved transactions
      const merged = [...currentTransactions, ...approved];

      // Write back to localStorage.json
      const storageData = fs.existsSync(this.localStoragePath)
        ? JSON.parse(fs.readFileSync(this.localStoragePath, 'utf8'))
        : {};
      storageData.gp_finance_transactions = JSON.stringify(merged);
      fs.writeFileSync(this.localStoragePath, JSON.stringify(storageData, null, 2));

      console.log('[BackgroundProcessor] Applied', approved.length, 'transactions from', stagedId);

      // Remove applied transactions from staging, or delete if all applied
      const remaining = staged.transactions.filter(t => !approvedSet.has(t.id));
      if (remaining.length === 0) {
        fs.unlinkSync(stagingFile);
        console.log('[BackgroundProcessor] Staging file removed (all applied):', stagedId);
      } else {
        staged.transactions = remaining;
        staged.summary.totalTransactions = remaining.length;
        staged.summary.auto = remaining.filter(t => t.stagedCohort === 'auto').length;
        staged.summary.review = remaining.filter(t => t.stagedCohort === 'review').length;
        fs.writeFileSync(stagingFile, JSON.stringify(staged, null, 2));
      }

      return { applied: approved.length, remaining: remaining.length };
    } catch (error) {
      console.error('[BackgroundProcessor] Error applying staged:', error);
      throw error;
    }
  }

  dismissStaged(stagedId) {
    try {
      const filePath = path.join(this.stagingPath, `${stagedId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('[BackgroundProcessor] Dismissed staged result:', stagedId);
      }
    } catch (error) {
      console.error('[BackgroundProcessor] Error dismissing staged:', error);
    }
  }

  /**
   * Remove specific transactions from a staging file without merging into localStorage.
   * React handles state updates and persistence — this just cleans up the staging file.
   * Deletes the file entirely if no transactions remain.
   */
  removeFromStaged(stagedId, txIds) {
    try {
      const stagingFile = path.join(this.stagingPath, `${stagedId}.json`);
      if (!fs.existsSync(stagingFile)) {
        throw new Error(`Staged result ${stagedId} not found`);
      }

      const staged = JSON.parse(fs.readFileSync(stagingFile, 'utf8'));
      const removeSet = new Set(txIds);
      const removed = staged.transactions.filter(t => removeSet.has(t.id)).length;
      const remaining = staged.transactions.filter(t => !removeSet.has(t.id));

      if (removed === 0) {
        return { removed: 0, remaining: staged.transactions.length };
      }

      if (remaining.length === 0) {
        fs.unlinkSync(stagingFile);
        console.log('[BackgroundProcessor] Staging file removed (all transactions cleared):', stagedId);
        return { removed, remaining: 0 };
      }

      // Update staging file with remaining transactions
      staged.transactions = remaining;
      staged.summary.totalTransactions = remaining.length;
      staged.summary.auto = remaining.filter(t => t.stagedCohort === 'auto').length;
      staged.summary.groupConfirmed = remaining.filter(t => t.stagedCohort === 'group-confirmed').length;
      staged.summary.review = remaining.filter(t => t.stagedCohort === 'review').length;

      // Rebuild review clusters from remaining review transactions
      const reviewTxns = remaining.filter(t => t.stagedCohort === 'review');
      staged.reviewClusters = this._buildReviewClusters(reviewTxns);

      fs.writeFileSync(stagingFile, JSON.stringify(staged, null, 2));
      console.log('[BackgroundProcessor] Removed', removed, 'transactions from staging, remaining:', remaining.length);

      return { removed, remaining: remaining.length };
    } catch (error) {
      console.error('[BackgroundProcessor] Error removing from staged:', error);
      throw error;
    }
  }

  /**
   * Re-score remaining staged transactions using passes C (similarity) and D (group confidence).
   * Called between conversational review rounds — user's recent approvals enrich the corpus,
   * potentially cascading into more auto-categorizations.
   *
   * Runs in the main process. Finn tells the user he's working on it.
   */
  rescoreStaged(stagedId) {
    try {
      const stagingFile = path.join(this.stagingPath, `${stagedId}.json`);
      if (!fs.existsSync(stagingFile)) {
        throw new Error(`Staged result ${stagedId} not found`);
      }

      const staged = JSON.parse(fs.readFileSync(stagingFile, 'utf8'));

      // Only re-score transactions still in the review cohort
      const reviewTxns = staged.transactions.filter(t => t.stagedCohort === 'review');
      const nonReviewTxns = staged.transactions.filter(t => t.stagedCohort !== 'review');

      if (reviewTxns.length === 0) {
        return {
          promoted: 0,
          remainingReview: 0,
          remainingAuto: nonReviewTxns.filter(t => t.stagedCohort === 'auto').length,
          reviewClusters: [],
          summary: staged.summary,
        };
      }

      // Load the full corpus — existing transactions in localStorage now include
      // everything the user has approved so far this session
      const existingCorpus = this._loadExistingTransactions() || [];
      const categoryMapping = this._loadCategoryMapping();
      const practiceProfile = this._loadPracticeProfile();

      // Run the full convergence loop on review transactions using the enriched corpus.
      // After user confirms/corrects groups, similarity matching may find new matches
      // from the newly enriched corpus (user-applied transactions with identifiers).
      const result = runConvergenceLoop(
        reviewTxns.map(t => {
          // Strip existing categorization so the loop can re-assess
          // But preserve group data from Opus — it's still valid context
          const { categoryCode, categoryName, unifiedConfidence, convergencePass, convergenceIteration, ...clean } = t;
          return clean;
        }),
        categoryMapping,
        existingCorpus,
        practiceProfile
      );

      // Apply background-processor fields to newly categorized
      let promoted = 0;
      for (const txn of result.categorized) {
        txn.categoryMatchType = 'finn-background';
        // Convergence found a full category match — this can go to auto
        txn.stagedCohort = txn.unifiedConfidence >= CONFIDENCE_AUTO_THRESHOLD ? 'auto' : 'review';
        if (txn.stagedCohort === 'auto') promoted++;
      }
      for (const txn of result.uncategorized) {
        txn.stagedCohort = 'review';
        txn.unifiedConfidence = 0;
        txn.convergencePass = 'none';
        txn.categoryMatchType = 'finn-background';
      }

      // Rebuild staged file with updated transactions
      const updatedTransactions = [...nonReviewTxns, ...result.categorized, ...result.uncategorized];
      staged.transactions = updatedTransactions;
      staged.summary.totalTransactions = updatedTransactions.length;
      staged.summary.auto = updatedTransactions.filter(t => t.stagedCohort === 'auto').length;
      staged.summary.groupConfirmed = updatedTransactions.filter(t => t.stagedCohort === 'group-confirmed').length;
      staged.summary.review = updatedTransactions.filter(t => t.stagedCohort === 'review').length;

      // Rebuild review clusters
      const newReviewTxns = updatedTransactions.filter(t => t.stagedCohort === 'review');
      staged.reviewClusters = this._buildReviewClusters(newReviewTxns);

      fs.writeFileSync(stagingFile, JSON.stringify(staged, null, 2));

      console.log(`[BackgroundProcessor] Rescore: ${promoted} promoted to auto, ${newReviewTxns.length} still in review`);

      return {
        promoted,
        remainingReview: newReviewTxns.length,
        remainingAuto: staged.summary.auto,
        reviewClusters: staged.reviewClusters,
        summary: staged.summary,
      };
    } catch (error) {
      console.error('[BackgroundProcessor] Error rescoring staged:', error);
      throw error;
    }
  }

  /**
   * Between-batch Sonnet rescore.
   *
   * After the deterministic rescore, if review items remain, run a lightweight
   * Sonnet call using the user's corrections from this batch as few-shot examples.
   * This catches semantic patterns that similarity matching misses.
   *
   * @param {string} stagedId - Staged result ID
   * @param {Array<{description: string, groupCode: string, groupName: string}>} corrections - User corrections from this batch
   * @returns {Promise<{promoted: number, remainingReview: number, reviewClusters: Array}>}
   */
  async sonnetRescoreStaged(stagedId, corrections) {
    const MIN_REVIEW_FOR_SONNET = 3;  // Don't waste an API call for < 3 items
    const SONNET_BATCH_SIZE = 50;     // Sonnet is fast, keep batches moderate
    const SONNET_AUTO_THRESHOLD = 0.85;

    try {
      const stagingFile = path.join(this.stagingPath, `${stagedId}.json`);
      if (!fs.existsSync(stagingFile)) {
        throw new Error(`Staged result ${stagedId} not found`);
      }

      const staged = JSON.parse(fs.readFileSync(stagingFile, 'utf8'));
      const reviewTxns = staged.transactions.filter(t => t.stagedCohort === 'review');
      const nonReviewTxns = staged.transactions.filter(t => t.stagedCohort !== 'review');

      if (reviewTxns.length < MIN_REVIEW_FOR_SONNET) {
        return {
          promoted: 0,
          remainingReview: reviewTxns.length,
          reviewClusters: staged.reviewClusters,
          skipped: true,
          reason: `Only ${reviewTxns.length} review items — Sonnet pass skipped`,
        };
      }

      const apiKey = this._loadApiKey();
      if (!apiKey || this._isLocalOnlyMode()) {
        return {
          promoted: 0,
          remainingReview: reviewTxns.length,
          reviewClusters: staged.reviewClusters,
          skipped: true,
          reason: 'No API key or local-only mode',
        };
      }

      // Build few-shot corrections block from user's batch decisions
      let correctionsBlock = '';
      if (corrections && corrections.length > 0) {
        const lines = corrections.map(c =>
          `- "${c.description}" → ${c.groupCode} (${c.groupName})`
        );
        correctionsBlock = `\nUSER CORRECTIONS FROM THIS SESSION (use these as definitive examples):\n${lines.join('\n')}\n\n`;
      }

      // Build prompt — reuse the Opus prompt builder with corrections injected
      const { buildOpusPrompt } = require('./utils/opusAnalysisPass.cjs');
      const categoryMapping = this._loadCategoryMapping();
      const practiceProfile = this._loadPracticeProfile();

      let promoted = 0;
      const updatedReview = [];

      // Process in batches
      for (let i = 0; i < reviewTxns.length; i += SONNET_BATCH_SIZE) {
        const batch = reviewTxns.slice(i, i + SONNET_BATCH_SIZE);
        const batchNum = Math.floor(i / SONNET_BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(reviewTxns.length / SONNET_BATCH_SIZE);

        console.log(`[SonnetRescore] Batch ${batchNum}/${totalBatches}: ${batch.length} transactions`);

        try {
          const prompt = buildOpusPrompt(batch, categoryMapping, practiceProfile, correctionsBlock);

          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: MODELS.STANDARD,
              max_tokens: 4096,
              temperature: 0.2,
              messages: [{ role: 'user', content: prompt }],
            }),
          });

          if (!response.ok) {
            const errorBody = await response.text();
            console.warn(`[SonnetRescore] API error: ${response.status} - ${errorBody.substring(0, 200)}`);
            updatedReview.push(...batch);
            continue;
          }

          const data = await response.json();
          if (data.usage) {
            console.log(`[SonnetRescore] Token usage — input: ${data.usage.input_tokens}, output: ${data.usage.output_tokens}`);
          }

          // Parse JSON response
          const text = data.content?.[0]?.text || '';
          let jsonText = text;
          const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (fenceMatch) jsonText = fenceMatch[1];

          let results = [];
          const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            results = JSON.parse(jsonMatch[0]);
          } else {
            // Try salvaging truncated response
            const partial = jsonText.match(/\[[\s\S]*/);
            if (partial) {
              const lastComplete = partial[0].lastIndexOf('}');
              if (lastComplete > 0) {
                try {
                  results = JSON.parse(partial[0].substring(0, lastComplete + 1) + ']');
                } catch { /* fall through */ }
              }
            }
          }

          // Apply results to batch
          for (const result of results) {
            const idx = result.index - 1;
            if (idx < 0 || idx >= batch.length) continue;
            const txn = batch[idx];

            if (result.group && result.group !== 'UNCERTAIN' && result.confidence >= SONNET_AUTO_THRESHOLD) {
              txn.suggestedGroup = result.group;
              txn.opusGroupConfidence = result.confidence;
              txn.opusReasoning = result.reasoning || 'Sonnet between-batch rescore';
              txn.groupConfirmed = true;
              txn.stagedCohort = 'group-confirmed';
              txn.categoryMatchType = 'sonnet-rescore';
              promoted++;
            } else if (result.group && result.group !== 'UNCERTAIN') {
              // Below threshold — keep as review but add Sonnet's suggestion
              txn.suggestedGroup = result.group;
              txn.opusGroupConfidence = result.confidence || 0;
              txn.opusReasoning = result.reasoning || 'Sonnet between-batch suggestion';
            }
          }

          // Collect remaining review items from this batch
          for (const txn of batch) {
            if (txn.stagedCohort === 'review') {
              updatedReview.push(txn);
            }
          }
        } catch (err) {
          console.error(`[SonnetRescore] Batch ${batchNum} failed:`, err.message);
          updatedReview.push(...batch);
        }
      }

      // Rebuild staged file
      const promotedTxns = reviewTxns.filter(t => t.stagedCohort === 'group-confirmed');
      const allTxns = [...nonReviewTxns, ...promotedTxns, ...updatedReview];
      staged.transactions = allTxns;
      staged.summary.totalTransactions = allTxns.length;
      staged.summary.auto = allTxns.filter(t => t.stagedCohort === 'auto').length;
      staged.summary.groupConfirmed = allTxns.filter(t => t.stagedCohort === 'group-confirmed').length;
      staged.summary.review = updatedReview.length;

      staged.reviewClusters = this._buildReviewClusters(updatedReview);
      fs.writeFileSync(stagingFile, JSON.stringify(staged, null, 2));

      console.log(`[SonnetRescore] Complete: ${promoted} promoted, ${updatedReview.length} still in review`);

      return {
        promoted,
        remainingReview: updatedReview.length,
        reviewClusters: staged.reviewClusters,
        summary: staged.summary,
      };
    } catch (error) {
      console.error('[BackgroundProcessor] Sonnet rescore error:', error);
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Pass 2: Category Assignment Within Groups
  // --------------------------------------------------------------------------

  /**
   * Run Pass 2 category assignment on staged transactions that have confirmed
   * groups but no categoryCode. Can run on a specific staged file, or on
   * already-applied transactions from localStorage.
   *
   * @param {string} stagedId - The staged result ID, OR 'applied' to process localStorage transactions
   * @returns {{ autoConfirmed, aiMatched, similarityMatched, uncertain, reviewClusters, summary }}
   */
  async runCategoryAssignment(stagedId) {
    const apiKey = this._loadApiKey();
    if (!apiKey) {
      throw new Error('No API key available for category assignment');
    }
    if (this._isLocalOnlyMode()) {
      throw new Error('Category assignment requires AI and is not available in Local Only Mode');
    }

    const categoryMapping = this._loadCategoryMapping();
    const practiceProfile = this._loadPracticeProfile();
    const corrections = this._loadAICorrections();
    const categoryCorrections = this._formatCorrectionsForPrompt(corrections, 'expense_categorization');

    // Build corpus of fully-categorised transactions for similarity matching
    const existingTransactions = this._loadExistingTransactions() || [];
    const corpus = existingTransactions.filter(t => t.categoryCode && t.suggestedGroup);

    if (stagedId === 'applied') {
      // Process already-applied transactions in localStorage that have group but no category
      const needsCategorisation = existingTransactions.filter(t =>
        t.suggestedGroup && t.groupConfirmed && !t.categoryCode
      );

      if (needsCategorisation.length === 0) {
        return { autoConfirmed: 0, aiMatched: 0, similarityMatched: 0, uncertain: 0, total: 0 };
      }

      console.log(`[BackgroundProcessor] Pass 2 on ${needsCategorisation.length} applied transactions`);

      const result = await runCategoryAssignmentPass(
        needsCategorisation, categoryMapping, corpus, practiceProfile, apiKey, categoryCorrections
      );

      if (result.error) {
        throw new Error(result.error);
      }

      // Merge results back into localStorage
      const resultMap = new Map();
      for (const txn of result.results) {
        resultMap.set(txn.id, txn);
      }
      for (const txn of result.uncertain) {
        resultMap.set(txn.id, txn);
      }

      const updatedTransactions = existingTransactions.map(t => {
        const updated = resultMap.get(t.id);
        if (updated) {
          return {
            ...t,
            categoryCode: updated.categoryCode || t.categoryCode,
            categoryName: updated.categoryName || t.categoryName,
            categorySection: updated.categorySection || t.categorySection,
            categoryCohort: updated.categoryCohort || t.categoryCohort,
            categoryConfidence: updated.categoryConfidence,
            categoryReasoning: updated.categoryReasoning,
            categoryMatchType: updated.categoryMatchType || t.categoryMatchType,
          };
        }
        return t;
      });

      // Write back to localStorage.json
      const storageData = fs.existsSync(this.localStoragePath)
        ? JSON.parse(fs.readFileSync(this.localStoragePath, 'utf8'))
        : {};
      storageData.gp_finance_transactions = JSON.stringify(updatedTransactions);
      fs.writeFileSync(this.localStoragePath, JSON.stringify(storageData, null, 2));

      const autoConfirmed = result.results.filter(r => r.categoryCohort === 'auto').length;

      console.log(`[BackgroundProcessor] Pass 2 complete: ${autoConfirmed} auto-confirmed, ${result.uncertain.length} uncertain`);

      // Build review clusters for uncertain transactions (same as staged path)
      const reviewClusters = this._buildCategoryReviewClusters(
        updatedTransactions.filter(t => t.categoryCohort === 'review' || (!t.categoryCode && t.suggestedGroup)),
        categoryMapping
      );

      return {
        autoConfirmed,
        aiMatched: result.aiMatched,
        similarityMatched: result.similarityMatched,
        uncertain: result.uncertain.length,
        total: needsCategorisation.length,
        reviewClusters,
        summary: {
          categoryPass: {
            autoConfirmed,
            aiMatched: result.aiMatched,
            similarityMatched: result.similarityMatched,
            uncertain: result.uncertain.length,
            total: needsCategorisation.length,
          }
        },
        updatedTransactions,
      };
    }

    // Process a staged file
    const stagingFile = path.join(this.stagingPath, `${stagedId}.json`);
    if (!fs.existsSync(stagingFile)) {
      throw new Error(`Staged result ${stagedId} not found`);
    }

    const staged = JSON.parse(fs.readFileSync(stagingFile, 'utf8'));

    // Find transactions that have a confirmed group but no categoryCode
    const needsCategorisation = staged.transactions.filter(t =>
      t.suggestedGroup && (t.groupConfirmed || t.stagedCohort === 'group-confirmed') && !t.categoryCode
    );

    if (needsCategorisation.length === 0) {
      return { autoConfirmed: 0, aiMatched: 0, similarityMatched: 0, uncertain: 0, total: 0, summary: staged.summary };
    }

    console.log(`[BackgroundProcessor] Pass 2 on staged ${stagedId}: ${needsCategorisation.length} transactions`);

    const result = await runCategoryAssignmentPass(
      needsCategorisation, categoryMapping, corpus, practiceProfile, apiKey
    );

    if (result.error) {
      throw new Error(result.error);
    }

    // Merge results back into staged transactions
    const resultMap = new Map();
    for (const txn of result.results) {
      resultMap.set(txn.id, txn);
    }
    for (const txn of result.uncertain) {
      resultMap.set(txn.id, txn);
    }

    staged.transactions = staged.transactions.map(t => {
      const updated = resultMap.get(t.id);
      if (updated) {
        return {
          ...t,
          categoryCode: updated.categoryCode || null,
          categoryName: updated.categoryName || null,
          categorySection: updated.categorySection || null,
          categoryCohort: updated.categoryCohort || 'review',
          categoryConfidence: updated.categoryConfidence || 0,
          categoryReasoning: updated.categoryReasoning || null,
          categoryMatchType: updated.categoryMatchType || t.categoryMatchType,
          convergencePass: updated.convergencePass || t.convergencePass,
        };
      }
      return t;
    });

    // Rebuild review clusters with category data
    const reviewTxns = staged.transactions.filter(t =>
      !t.categoryCode || (t.categoryCohort === 'review')
    );
    staged.reviewClusters = this._buildCategoryReviewClusters(
      staged.transactions.filter(t => t.categoryCohort === 'review' || (!t.categoryCode && t.suggestedGroup)),
      categoryMapping
    );

    // Update summary
    const autoConfirmed = result.results.filter(r => r.categoryCohort === 'auto').length;
    staged.summary.categoryPass = {
      autoConfirmed,
      aiMatched: result.aiMatched,
      similarityMatched: result.similarityMatched,
      uncertain: result.uncertain.length,
      total: needsCategorisation.length,
    };

    fs.writeFileSync(stagingFile, JSON.stringify(staged, null, 2));

    console.log(`[BackgroundProcessor] Pass 2 staged complete: ${autoConfirmed} auto, ${result.uncertain.length} uncertain`);

    return {
      autoConfirmed,
      aiMatched: result.aiMatched,
      similarityMatched: result.similarityMatched,
      uncertain: result.uncertain.length,
      total: needsCategorisation.length,
      reviewClusters: staged.reviewClusters,
      summary: staged.summary,
    };
  }

  /**
   * Build review clusters for Pass 2 (category assignment).
   * Groups uncategorised transactions by description similarity,
   * with category suggestions from the AI pass.
   */
  _buildCategoryReviewClusters(reviewTransactions, categoryMapping) {
    if (reviewTransactions.length === 0) return [];

    const clusters = engine.clusterSimilarTransactions(reviewTransactions);
    const sectionToGroup = engine.SECTION_TO_GROUP;

    return clusters
      .filter(c => c.size >= 1)
      .map(cluster => {
        const rep = cluster.representative;
        // Check if any member has a category suggestion from Pass 2
        const categorisedMember = cluster.transactions.find(t => t.categoryCode);

        return {
          representativeId: rep.id,
          representativeDescription: rep.details,
          suggestedGroup: rep.suggestedGroup || null,
          suggestedCategory: categorisedMember?.categoryName || null,
          suggestedCategoryCode: categorisedMember?.categoryCode || null,
          categoryConfidence: categorisedMember?.categoryConfidence || 0,
          categoryReasoning: categorisedMember?.categoryReasoning || null,
          memberCount: cluster.size,
          totalAmount: cluster.transactions.reduce((sum, t) => sum + (t.amount || 0), 0),
        };
      })
      .sort((a, b) => b.memberCount - a.memberCount);
  }
}

module.exports = BackgroundProcessor;

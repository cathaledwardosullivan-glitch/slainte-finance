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

// Opus deep analysis pass
const { shouldRunOpusPass, runOpusPass } = require('./utils/opusAnalysisPass.cjs');

// Node.js PDF/CSV adapter
const { parseStatement } = require('./utils/pdfAdapter.cjs');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIDENCE_AUTO_THRESHOLD = 0.90;
const FILE_DEBOUNCE_MS = 2000; // Wait for file write to complete
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
    if (this.queue.includes(filePath)) return;
    this.queue.push(filePath);
    this._processNext();
  }

  async _processNext() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const filePath = this.queue.shift();
    const fileName = path.basename(filePath);

    try {
      console.log('[BackgroundProcessor] Processing:', fileName);
      this.onProgress(fileName, 0);

      const result = await this._processFile(filePath);

      // Move file to processed folder
      const destPath = path.join(this.processedPath, fileName);
      fs.renameSync(filePath, destPath);
      console.log('[BackgroundProcessor] Moved to processed:', fileName);

      this.onReady(result);
    } catch (error) {
      console.error('[BackgroundProcessor] Error processing', fileName, ':', error.message);
      // Leave file in inbox for retry on next app launch
      this.onError(error, fileName);
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

    // Step 5b: Opus deep analysis pass (cold start / high uncategorized count)
    let opusTriggered = false;
    const totalTxns = convergenceResult.categorized.length + convergenceResult.uncategorized.length;
    if (shouldRunOpusPass(totalTxns, convergenceResult.uncategorized.length)) {
      this.onProgress(fileName, 60);
      const apiKey = this._loadApiKey();
      if (apiKey && !this._isLocalOnlyMode()) {
        opusTriggered = true;
        console.log(`[BackgroundProcessor] Opus pass triggered: ${convergenceResult.uncategorized.length}/${totalTxns} uncategorized`);

        const opusResult = await runOpusPass(
          convergenceResult.uncategorized,
          convergenceResult.categorized,
          categoryMapping,
          practiceProfile,
          apiKey
        );

        if (opusResult.results.length > 0) {
          // Move Opus-categorized transactions from uncategorized to categorized
          const opusCategorizedIds = new Set(opusResult.results.map(r => r.id));
          convergenceResult.uncategorized = convergenceResult.uncategorized.filter(t => !opusCategorizedIds.has(t.id));

          // Add background-processor fields and push to categorized
          for (const txn of opusResult.results) {
            txn.categoryMatchType = 'finn-background';
            txn.stagedCohort = txn.unifiedConfidence >= CONFIDENCE_AUTO_THRESHOLD ? 'auto' : 'review';
            convergenceResult.categorized.push(txn);
          }

          console.log(`[BackgroundProcessor] Opus categorized ${opusResult.results.length} transactions`);

          // Step 5c: Post-AI cascading — run similarity + group confidence on remaining
          if (convergenceResult.uncategorized.length > 0) {
            this.onProgress(fileName, 70);
            const cascadeCorpus = [...existingTransactions, ...convergenceResult.categorized];
            const postAiResult = runConvergenceLoop(
              convergenceResult.uncategorized,
              categoryMapping,
              cascadeCorpus,
              practiceProfile,
              { maxIterations: 3 } // Limited iterations for cascading
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
    const review = [...categorized.filter(t => t.stagedCohort === 'review'), ...uncategorized];

    // Build review clusters for strategic handover
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
        // Check if any member has a suggested category
        const categorizedMember = cluster.transactions.find(t => t.categoryCode);

        return {
          representativeId: rep.id,
          representativeDescription: rep.details,
          suggestedCategory: categorizedMember?.categoryName || null,
          suggestedCategoryCode: categorizedMember?.categoryCode || null,
          suggestedConfidence: categorizedMember?.unifiedConfidence || 0,
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
}

module.exports = BackgroundProcessor;

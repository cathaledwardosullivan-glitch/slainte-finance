import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, MessageCircle, FileSpreadsheet, CheckCircle, AlertCircle, Loader, Building2, AlertTriangle, ArrowLeft, ArrowRight, ListChecks, Filter, Save, ChevronDown } from 'lucide-react';
import COLORS from '../../utils/colors';
import { useAppContext } from '../../context/AppContext';
import { useProcessingFlow } from '../ProcessingFlow/ProcessingFlowContext';
import ProcessingFlowPanel from '../ProcessingFlow';
import Papa from 'papaparse';
import { parseBankStatementPDF } from '../../utils/bankStatementParser';
import { processTransactionsWithEngine } from '../../utils/transactionProcessor';
import { batchAICategorization } from '../../utils/aiCategorization';
import { COHORTS } from '../ProcessingFlow/ProcessingFlowContext';
import { saveTransactions, saveUnidentifiedTransactions } from '../../utils/storageUtils';

/**
 * OnboardingTransactionUpload - File upload with interactive wave processing
 *
 * During onboarding, transactions are processed in WAVES with user interaction:
 * - Wave 1: 100 transactions → user reviews → builds initial corpus
 * - Wave 2: 400 transactions → user reviews → background AI starts for Wave 3
 * - Wave 3: All remaining → AI mostly pre-processed, fast review
 *
 * OPTIMIZATION: While user reviews Wave 2, Wave 3's AI categorization runs in background.
 * This eliminates the 2+ minute wait for large final waves.
 *
 * Each wave uses adaptive confidence weighting that improves as the corpus grows.
 * All waves stop at Group stage (skip Category stage for onboarding simplicity).
 */

// Wave sizes: 100 → 400 → all remaining (3 waves for typical uploads)
const WAVE_1_SIZE = 100;   // First wave: bootstrap the corpus
const WAVE_2_SIZE = 400;   // Second wave: larger batch, background prefetch starts

// Instant text display (typing animation disabled)
const useTypingEffect = (text) => {
  return { displayedText: text || '', isComplete: true };
};

// Helper function for duplicate detection
const getTransactionKey = (t) => {
  let dateStr = '';
  if (t.date) {
    const d = new Date(t.date);
    if (!isNaN(d.getTime())) {
      dateStr = d.toISOString().split('T')[0];
    }
  }
  const amount = Math.abs(t.debit || t.credit || t.amount || 0).toFixed(2);
  const details = (t.details || '').toLowerCase().trim();
  return `${dateStr}|${amount}|${details}`;
};

// Interactive group info item for the Finn sidebar
const GroupInfoItem = ({ group }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          padding: '0.5rem 0.625rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          border: 'none',
          background: expanded ? `${COLORS.slainteBlue}10` : 'transparent',
          cursor: 'pointer',
          borderRadius: '6px',
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: COLORS.slainteBlue,
          textAlign: 'left'
        }}
      >
        {group.name}
        <ChevronDown style={{
          width: '14px',
          height: '14px',
          color: COLORS.mediumGray,
          transition: 'transform 0.15s',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)'
        }} />
      </button>
      {expanded && (
        <div style={{
          padding: '0.25rem 0.625rem 0.5rem',
          fontSize: '0.75rem',
          color: COLORS.mediumGray,
          lineHeight: 1.4
        }}>
          {group.desc}
        </div>
      )}
    </div>
  );
};

export default function OnboardingTransactionUpload({ onComplete, onSkip, onBack, initialTransactions }) {
  const {
    transactions,
    setTransactions,
    unidentifiedTransactions,
    setUnidentifiedTransactions,
    categoryMapping,
    aiCorrections,
    recordAICorrection
  } = useAppContext();

  // Processing flow context - for the step-by-step modal
  const processingFlow = useProcessingFlow();
  const { isFlowOpen, startProcessing, completeFlow, cancelFlow } = processingFlow;

  // Upload state
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [parsedTransactions, setParsedTransactions] = useState([]);

  // Wave processing state - interactive waves with user review
  const [allUploadedTransactions, setAllUploadedTransactions] = useState([]); // All transactions from upload
  const [currentWaveNumber, setCurrentWaveNumber] = useState(0);
  const [totalWaves, setTotalWaves] = useState(0);
  const [processedCorpus, setProcessedCorpus] = useState([]); // Approved transactions from previous waves
  const [pendingWaves, setPendingWaves] = useState([]);       // Remaining waves to process
  const [allProcessedResults, setAllProcessedResults] = useState([]); // All results across all waves

  // Background prefetch state - AI processing runs ahead while user reviews
  const [prefetchStatus, setPrefetchStatus] = useState({ inProgress: false, waveNum: 0, progress: 0, total: 0 });
  const [prefetchedResults, setPrefetchedResults] = useState(null); // Pre-processed transactions for next wave
  const prefetchAbortRef = useRef(false); // For cancelling prefetch if user cancels flow

  // Finn introduction screen state (onboarding path with initialTransactions)
  const [showFinnIntro, setShowFinnIntro] = useState(false);

  // Duplicate detection state
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState(null);
  const [pendingTransactions, setPendingTransactions] = useState(null);
  const [skippedDuplicates, setSkippedDuplicates] = useState(0);

  // Finn messages
  const [showGreeting, setShowGreeting] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [showTip, setShowTip] = useState(false);

  const greetingText = "Now let's import your bank statements.";
  const messageText = "Upload your bank statements (CSV or PDF). I'll guide you through categorizing each transaction step by step.";
  const tipText = "Tip: You can upload multiple PDF bank statements at once. Bank of Ireland PDFs are fully supported.";

  const { displayedText: greeting, isComplete: greetingComplete } = useTypingEffect(showGreeting ? greetingText : '', 25);
  const { displayedText: message, isComplete: messageComplete } = useTypingEffect(showMessage ? messageText : '', 15);
  const { displayedText: tip, isComplete: tipComplete } = useTypingEffect(showTip ? tipText : '', 15);

  // Animation sequence
  useEffect(() => {
    const timer = setTimeout(() => setShowGreeting(true), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (greetingComplete) {
      const timer = setTimeout(() => setShowMessage(true), 200);
      return () => clearTimeout(timer);
    }
  }, [greetingComplete]);

  useEffect(() => {
    if (messageComplete) {
      const timer = setTimeout(() => setShowTip(true), 300);
      return () => clearTimeout(timer);
    }
  }, [messageComplete]);

  // Show Finn introduction when initialTransactions are provided (from background categorization)
  useEffect(() => {
    if (initialTransactions?.length > 0 && allUploadedTransactions.length === 0 && !isProcessing && !showFinnIntro) {
      console.log(`[OnboardingTransactionUpload] Showing Finn intro for ${initialTransactions.length} pre-loaded transactions`);
      setShowFinnIntro(true);
    }
  }, [initialTransactions]);

  // Handler for when user clicks "Begin Review" on the intro screen
  const handleIntroComplete = useCallback(() => {
    setShowFinnIntro(false);
    completeUpload(initialTransactions);
  }, [initialTransactions]);

  // Check for duplicates
  const checkForDuplicates = useCallback((newTransactions) => {
    const existingKeys = new Set();
    transactions.forEach(t => existingKeys.add(getTransactionKey(t)));
    unidentifiedTransactions.forEach(t => existingKeys.add(getTransactionKey(t)));

    const duplicates = [];
    const unique = [];

    newTransactions.forEach(t => {
      const key = getTransactionKey(t);
      if (existingKeys.has(key)) {
        duplicates.push(t);
      } else {
        unique.push(t);
      }
    });

    return { duplicates, unique };
  }, [transactions, unidentifiedTransactions]);

  // Handle file selection
  const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setSelectedFiles(files);
    setIsProcessing(true);

    const hasCsv = files.some(f => f.name.toLowerCase().endsWith('.csv'));
    const hasPdf = files.some(f => f.name.toLowerCase().endsWith('.pdf'));

    if (hasCsv && hasPdf) {
      alert('Please upload either CSV or PDF files, not both');
      setIsProcessing(false);
      return;
    }

    try {
      let allTransactions = [];

      if (hasPdf) {
        // Process PDFs
        for (const file of files) {
          if (file.name.toLowerCase().endsWith('.pdf')) {
            const result = await parseBankStatementPDF(file);

            const transformedTransactions = result.transactions.map((tx, index) => {
              const dateObj = tx.date instanceof Date ? tx.date : new Date(tx.date);
              const monthYear = !isNaN(dateObj.getTime())
                ? dateObj.toISOString().substring(0, 7)
                : null;

              return {
                id: `${file.name}-${index}-${Date.now()}`,
                date: dateObj,
                monthYear: monthYear,
                details: tx.details || '',
                debit: tx.debit || 0,
                credit: tx.credit || 0,
                amount: Math.abs(tx.debit || tx.credit || tx.amount || 0),
                balance: tx.balance || 0,
                fileName: file.name,
                source: 'bank-pdf',
                bank: result.bank
              };
            });

            allTransactions = [...allTransactions, ...transformedTransactions];
          }
        }
      } else {
        // Process CSVs
        for (const file of files) {
          if (file.name.toLowerCase().endsWith('.csv')) {
            await new Promise((resolve, reject) => {
              Papa.parse(file, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: (results) => {
                  // Transform CSV data to transaction format
                  const csvTransactions = results.data.map((row, index) => {
                    // Try to find date, details, debit, credit fields
                    const dateValue = row.Date || row.date || row.TransactionDate || row['Transaction Date'];
                    const details = row.Details || row.details || row.Description || row.description || row.Narrative || '';
                    const debit = parseFloat(row.Debit || row.debit || row['Debit Amount'] || 0) || 0;
                    const credit = parseFloat(row.Credit || row.credit || row['Credit Amount'] || 0) || 0;
                    const balance = parseFloat(row.Balance || row.balance || 0) || 0;

                    const dateObj = dateValue ? new Date(dateValue) : new Date();
                    const monthYear = !isNaN(dateObj.getTime())
                      ? dateObj.toISOString().substring(0, 7)
                      : null;

                    return {
                      id: `${file.name}-${index}-${Date.now()}`,
                      date: dateObj,
                      monthYear: monthYear,
                      details: details,
                      debit: Math.abs(debit),
                      credit: Math.abs(credit),
                      amount: Math.abs(debit || credit),
                      balance: balance,
                      fileName: file.name,
                      source: 'csv'
                    };
                  }).filter(t => t.details && (t.debit > 0 || t.credit > 0));

                  allTransactions = [...allTransactions, ...csvTransactions];
                  resolve();
                },
                error: reject
              });
            });
          }
        }
      }

      setParsedTransactions(allTransactions);

      // Check for duplicates
      const { duplicates, unique } = checkForDuplicates(allTransactions);

      if (duplicates.length > 0) {
        setDuplicateInfo({
          duplicateCount: duplicates.length,
          uniqueCount: unique.length,
          totalCount: allTransactions.length,
          sampleDuplicates: duplicates.slice(0, 3)
        });
        setPendingTransactions({ all: allTransactions, unique });
        setShowDuplicateModal(true);
        setIsProcessing(false);
      } else {
        // No duplicates - complete upload and move to wave processing
        completeUpload(allTransactions);
      }
    } catch (error) {
      console.error('Error processing files:', error);
      alert('Error processing files: ' + error.message);
      setIsProcessing(false);
    }
  };

  // Split transactions into waves and start interactive processing
  const completeUpload = (transactionsToProcess) => {
    setIsProcessing(false);

    if (transactionsToProcess.length === 0) {
      alert('No transactions to process');
      return;
    }

    // Store all transactions for wave processing
    setAllUploadedTransactions(transactionsToProcess);

    // If initialTransactions provided (from background categorization during onboarding),
    // process as a single batch (up to 250). No wave splitting needed for 1-month statements.
    const isSingleBatch = initialTransactions && initialTransactions.length > 0;
    const SINGLE_BATCH_MAX = 250;

    const waves = [];
    let remaining = [...transactionsToProcess];

    if (isSingleBatch && remaining.length <= SINGLE_BATCH_MAX) {
      // Single batch: all transactions in one wave
      waves.push(remaining);
      remaining = [];
    } else {
      // Standard wave splitting for bulk uploads or large single batches
      // Wave 1: First 100 transactions (bootstrap corpus)
      if (remaining.length > 0) {
        const wave1Size = Math.min(WAVE_1_SIZE, remaining.length);
        waves.push(remaining.slice(0, wave1Size));
        remaining = remaining.slice(wave1Size);
      }

      // Wave 2: Next 400 transactions (while user reviews, Wave 3 prefetches)
      if (remaining.length > 0) {
        const wave2Size = Math.min(WAVE_2_SIZE, remaining.length);
        waves.push(remaining.slice(0, wave2Size));
        remaining = remaining.slice(wave2Size);
      }

      // Wave 3: All remaining transactions (AI pre-processed in background)
      if (remaining.length > 0) {
        waves.push(remaining);
      }
    }

    console.log(`[OnboardingTransactionUpload] Created ${waves.length} waves:`,
      waves.map((w, i) => `Wave ${i + 1}: ${w.length} txns`).join(', ')
    );

    // Reset prefetch state
    setPrefetchedResults(null);
    setPrefetchStatus({ inProgress: false, waveNum: 0, progress: 0, total: 0 });
    prefetchAbortRef.current = false;

    setTotalWaves(waves.length);
    setPendingWaves(waves);
    setCurrentWaveNumber(1);
    setProcessedCorpus([]);
    setAllProcessedResults([]);

    // Start first wave
    startWave(waves[0], [], 1, waves.length);
  };

  // Start a wave in ProcessingFlowPanel
  const startWave = useCallback((waveTransactions, existingCorpus, waveNum, total) => {
    console.log(`[OnboardingTransactionUpload] Starting Wave ${waveNum}/${total} with ${waveTransactions.length} transactions`);
    console.log(`[OnboardingTransactionUpload] Existing corpus size: ${existingCorpus.length}`);

    // Convert aiCorrections object to flat array format for AI categorization
    // aiCorrections is { feature: [...] }, but AI expects [{ layer, ... }]
    const flatCorrections = [];
    if (aiCorrections && typeof aiCorrections === 'object') {
      Object.entries(aiCorrections).forEach(([feature, corrections]) => {
        if (Array.isArray(corrections)) {
          corrections.forEach(c => {
            flatCorrections.push({
              ...c,
              layer: feature.includes('group') ? 'group' : 'category'
            });
          });
        }
      });
    }

    // Open ProcessingFlowPanel for this wave
    // The existing corpus (from previous waves) helps with confidence scoring
    startProcessing(waveTransactions, categoryMapping, {
      existingTransactions: [...transactions, ...existingCorpus], // Include both app transactions and wave corpus
      corrections: flatCorrections,
      recordCorrection: recordAICorrection,
      skipCategoryStage: true, // Onboarding: stop at Group level, skip Category
      waveInfo: {
        current: waveNum,
        total: total,
        isOnboarding: true
      }
    });
  }, [startProcessing, categoryMapping, transactions, aiCorrections, recordAICorrection]);

  /**
   * Background prefetch: Run AI categorization for a future wave while user reviews current wave
   * This eliminates the 2+ minute wait for large waves with many AI-needing transactions
   *
   * @param {Array} waveTransactions - Transactions to pre-process
   * @param {Array} corpusAtPrefetchStart - Corpus available when prefetch starts (Wave 1 data only for Wave 3)
   * @param {number} waveNum - Wave number being prefetched
   */
  const startBackgroundPrefetch = useCallback(async (waveTransactions, corpusAtPrefetchStart, waveNum) => {
    if (prefetchAbortRef.current) return;

    console.log(`[BackgroundPrefetch] Starting prefetch for Wave ${waveNum} with ${waveTransactions.length} transactions`);
    console.log(`[BackgroundPrefetch] Corpus size at prefetch start: ${corpusAtPrefetchStart.length}`);

    setPrefetchStatus({ inProgress: true, waveNum, progress: 0, total: waveTransactions.length });

    try {
      // Step 1: Run initial processing (type sorting, identifier matching)
      // This is fast and doesn't need AI
      const { transactions: processed, stats } = processTransactionsWithEngine(
        waveTransactions,
        categoryMapping,
        [...transactions, ...corpusAtPrefetchStart] // Use corpus from completed waves
      );

      if (prefetchAbortRef.current) return;

      console.log(`[BackgroundPrefetch] Initial processing complete:`, {
        total: processed.length,
        needsAI: processed.filter(t => t.groupCohort === COHORTS.AI_ASSIST || t.groupCohort === COHORTS.REVIEW).length
      });

      // Step 2: Run AI categorization for transactions that need it
      const transactionsNeedingAI = processed.filter(t =>
        t.groupCohort === COHORTS.AI_ASSIST || t.groupCohort === COHORTS.REVIEW
      );

      if (transactionsNeedingAI.length > 0 && !prefetchAbortRef.current) {
        console.log(`[BackgroundPrefetch] Running AI for ${transactionsNeedingAI.length} transactions...`);

        // Flatten corrections for AI
        const flatCorrections = [];
        if (aiCorrections && typeof aiCorrections === 'object') {
          Object.entries(aiCorrections).forEach(([feature, corrections]) => {
            if (Array.isArray(corrections)) {
              corrections.forEach(c => {
                flatCorrections.push({ ...c, layer: feature.includes('group') ? 'group' : 'category' });
              });
            }
          });
        }

        // Run AI categorization (this is the slow part - now runs in background!)
        const aiResults = await batchAICategorization(transactionsNeedingAI, 'group', {
          existingTransactions: [...transactions, ...corpusAtPrefetchStart],
          corrections: flatCorrections,
          categoryMapping
        });

        if (prefetchAbortRef.current) return;

        // Apply AI results to processed transactions
        const aiResultMap = new Map(aiResults.map(r => [r.transactionId, r.suggestion]));
        const processedWithAI = processed.map(t => {
          const aiSuggestion = aiResultMap.get(t.id);
          if (aiSuggestion) {
            return {
              ...t,
              aiGroupSuggestion: aiSuggestion,
              groupAISuggested: true,
              // Apply AI suggestion to group if confidence is decent
              ...(aiSuggestion.confidence >= 0.5 ? {
                group: aiSuggestion.group,
                groupReason: aiSuggestion.reasoning
              } : {})
            };
          }
          return t;
        });

        console.log(`[BackgroundPrefetch] Wave ${waveNum} prefetch complete!`);
        setPrefetchedResults({
          waveNum,
          transactions: processedWithAI,
          stats,
          aiProcessed: true
        });
      } else {
        // No AI needed - just store the processed transactions
        console.log(`[BackgroundPrefetch] Wave ${waveNum} prefetch complete (no AI needed)`);
        setPrefetchedResults({
          waveNum,
          transactions: processed,
          stats,
          aiProcessed: false
        });
      }

      setPrefetchStatus({ inProgress: false, waveNum, progress: transactionsNeedingAI.length, total: transactionsNeedingAI.length });

    } catch (error) {
      console.error(`[BackgroundPrefetch] Error prefetching Wave ${waveNum}:`, error);
      setPrefetchStatus({ inProgress: false, waveNum: 0, progress: 0, total: 0 });
      // Don't set prefetchedResults - wave will process normally
    }
  }, [categoryMapping, transactions, aiCorrections]);

  // Handle duplicate resolution
  const handleDuplicateResolution = (action) => {
    if (!pendingTransactions) return;

    if (action === 'skip') {
      // Only process unique transactions
      setSkippedDuplicates(pendingTransactions.all.length - pendingTransactions.unique.length);
      completeUpload(pendingTransactions.unique);
    } else if (action === 'add') {
      // Process all transactions including duplicates
      completeUpload(pendingTransactions.all);
    }

    setShowDuplicateModal(false);
    setDuplicateInfo(null);
    setPendingTransactions(null);
  };

  // Handle ProcessingFlowPanel completion for a wave
  const handleProcessingComplete = useCallback((result) => {
    const { transactions: processedTransactions, stats } = result;

    console.log(`[OnboardingTransactionUpload] Wave ${currentWaveNumber} complete:`, {
      processed: processedTransactions.length,
      stats
    });

    // Add this wave's results to all processed results
    const updatedAllResults = [...allProcessedResults, ...processedTransactions];
    setAllProcessedResults(updatedAllResults);

    // Add approved transactions to corpus for next wave's confidence scoring
    // "Approved" = has a group or category assigned
    const approvedTransactions = processedTransactions.filter(t =>
      t.groupCode || t.categoryCode || t.group || t.category
    );
    const updatedCorpus = [...processedCorpus, ...approvedTransactions];
    setProcessedCorpus(updatedCorpus);

    // Complete the current flow
    completeFlow();

    // Check if there are more waves
    const remainingWaves = pendingWaves.slice(1); // Remove current wave
    setPendingWaves(remainingWaves);

    if (remainingWaves.length > 0) {
      // More waves to process - start next wave
      const nextWaveNum = currentWaveNumber + 1;
      setCurrentWaveNumber(nextWaveNum);

      console.log(`[OnboardingTransactionUpload] Starting next wave (${nextWaveNum}/${totalWaves})`);

      // Check if we have prefetched results for this wave
      if (prefetchedResults && prefetchedResults.waveNum === nextWaveNum) {
        console.log(`[OnboardingTransactionUpload] Using prefetched results for Wave ${nextWaveNum}!`);
        console.log(`[OnboardingTransactionUpload] AI already processed: ${prefetchedResults.aiProcessed}`);

        // Clear prefetch state
        setPrefetchedResults(null);

        // Start wave with prefetched data - the ProcessingFlow will skip AI processing
        setTimeout(() => {
          startProcessing(prefetchedResults.transactions, categoryMapping, {
            existingTransactions: [...transactions, ...updatedCorpus],
            corrections: [],
            recordCorrection: recordAICorrection,
            skipCategoryStage: true,
            waveInfo: { current: nextWaveNum, total: totalWaves, isOnboarding: true },
            // Signal that AI is already done
            prefetchedAI: prefetchedResults.aiProcessed
          });
        }, 300);
      } else {
        // No prefetch available - start normally
        setTimeout(() => {
          startWave(remainingWaves[0], updatedCorpus, nextWaveNum, totalWaves);
        }, 500);
      }

      // Start background prefetch for wave AFTER next (e.g., when starting Wave 2, prefetch Wave 3)
      // This runs the slow AI processing while user reviews the current wave
      if (remainingWaves.length > 1) {
        const waveToPrefetch = remainingWaves[1]; // Wave after the one we just started
        const prefetchWaveNum = nextWaveNum + 1;

        console.log(`[OnboardingTransactionUpload] Starting background prefetch for Wave ${prefetchWaveNum}`);

        // Start prefetch with current corpus (doesn't include the wave user is about to review)
        // This is a tradeoff: Wave 3 AI won't have Wave 2 corpus, but still has Wave 1
        startBackgroundPrefetch(waveToPrefetch, updatedCorpus, prefetchWaveNum);
      }

      return; // Don't call onComplete yet
    }

    // All waves complete! Now finalize
    console.log(`[OnboardingTransactionUpload] All ${totalWaves} waves complete!`);
    console.log(`[OnboardingTransactionUpload] Total processed: ${updatedAllResults.length}`);

    // Separate into categorized and unidentified
    const newCategorized = [];
    const newUnidentified = [];

    updatedAllResults.forEach(t => {
      if (t.categoryCode || (t.category && t.category.code) || t.groupCode || t.group) {
        newCategorized.push(t);
      } else {
        newUnidentified.push(t);
      }
    });

    // Add all processed transactions to app state
    if (newCategorized.length > 0) {
      setTransactions(prev => [...prev, ...newCategorized]);
    }
    if (newUnidentified.length > 0) {
      setUnidentifiedTransactions(prev => [...prev, ...newUnidentified]);
    }

    // Explicitly persist to localStorage NOW — the parent's onComplete triggers
    // a full page reload (window.location.href), so the AppContext auto-save
    // useEffect would never fire. We must save synchronously before that happens.
    saveTransactions([...transactions, ...newCategorized]);
    saveUnidentifiedTransactions([...unidentifiedTransactions, ...newUnidentified]);

    // Notify parent of completion
    onComplete({
      categorized: newCategorized.length,
      unidentified: newUnidentified.length,
      skippedDuplicates: skippedDuplicates,
      totalWaves: totalWaves,
      stats
    });
  }, [completeFlow, onComplete, setTransactions, setUnidentifiedTransactions, skippedDuplicates,
      allProcessedResults, processedCorpus, pendingWaves, currentWaveNumber, totalWaves,
      startWave, startProcessing, startBackgroundPrefetch, categoryMapping, transactions,
      aiCorrections, recordAICorrection, prefetchedResults]);

  // Handle ProcessingFlowPanel cancel
  const handleProcessingCancel = useCallback(() => {
    cancelFlow();
    // Abort any background prefetch
    prefetchAbortRef.current = true;
    // Reset all wave state
    setAllUploadedTransactions([]);
    setCurrentWaveNumber(0);
    setTotalWaves(0);
    setProcessedCorpus([]);
    setPendingWaves([]);
    setAllProcessedResults([]);
    setPrefetchedResults(null);
    setPrefetchStatus({ inProgress: false, waveNum: 0, progress: 0, total: 0 });
  }, [cancelFlow]);

  // Handle identifier removal
  const handleRemoveIdentifier = useCallback((categoryCode, identifier) => {
    console.log('[OnboardingTransactionUpload] Remove identifier:', categoryCode, identifier);
  }, []);

  return (
    <>
      {/* Finn Introduction Screen - shown before processing when initialTransactions provided */}
      {showFinnIntro && !isFlowOpen && (
        <div style={{
          display: 'flex',
          gap: '2rem',
          alignItems: 'flex-start',
          maxWidth: '1600px',
          margin: '0 auto',
          height: 'min(75vh, 700px)'
        }}>
          {/* Left side - Finn Chat Box */}
          <div style={{
            flex: '1 1 40%',
            minWidth: '400px',
            maxWidth: '550px',
            height: '100%',
            backgroundColor: COLORS.white,
            borderRadius: '0.75rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: `1px solid ${COLORS.lightGray}`,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Chat Header */}
            <div style={{
              backgroundColor: COLORS.slainteBlue,
              color: COLORS.white,
              padding: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <div style={{
                width: '2.5rem',
                height: '2.5rem',
                backgroundColor: COLORS.slainteBlueDark,
                borderRadius: '9999px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <User style={{ height: '1.25rem', width: '1.25rem' }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '1rem' }}>Finn</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>Sláinte Guide</div>
              </div>
            </div>

            {/* Chat Messages */}
            <div style={{
              padding: '1.5rem',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              overflowY: 'auto'
            }}>
              {/* Greeting */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: COLORS.backgroundGray,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <MessageCircle style={{ width: '16px', height: '16px', color: COLORS.slainteBlue }} />
                </div>
                <div style={{
                  backgroundColor: COLORS.backgroundGray,
                  padding: '0.875rem 1rem',
                  borderRadius: '12px',
                  maxWidth: '85%'
                }}>
                  <div style={{
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    color: COLORS.darkGray
                  }}>
                    Let's review your bank transactions together.
                  </div>
                </div>
              </div>

              {/* Explanation */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={{ width: '32px', flexShrink: 0 }} />
                <div style={{
                  backgroundColor: COLORS.backgroundGray,
                  padding: '0.875rem 1rem',
                  borderRadius: '12px',
                  maxWidth: '85%'
                }}>
                  <div style={{
                    fontSize: '0.9375rem',
                    color: COLORS.darkGray,
                    lineHeight: 1.5
                  }}>
                    I've sorted them broadly into Income, Expenditure, and Non-Business. Now we'll assign each to a Group. Click any Group below to see what belongs there:
                  </div>
                </div>
              </div>

              {/* Interactive Group List */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={{ width: '32px', flexShrink: 0 }} />
                <div style={{
                  backgroundColor: COLORS.white,
                  padding: '0.5rem',
                  borderRadius: '12px',
                  maxWidth: '85%',
                  border: `1px solid ${COLORS.lightGray}`,
                  width: '100%'
                }}>
                  {[
                    { code: 'INCOME', name: 'Income', desc: 'GMS payments, private consultations, insurance claims, other practice revenue' },
                    { code: 'STAFF', name: 'Staff Costs', desc: 'GP salaries, locum fees, nursing staff, reception wages, PRSI, pensions' },
                    { code: 'PREMISES', name: 'Premises', desc: 'Rent, rates, insurance, utilities, repairs, cleaning, security' },
                    { code: 'MEDICAL', name: 'Medical Supplies', desc: 'Medications, vaccines, surgical supplies, lab testing, medical equipment' },
                    { code: 'OFFICE', name: 'Office & IT', desc: 'Software, hardware, stationery, postage, phone, broadband' },
                    { code: 'PROFESSIONAL', name: 'Professional Fees', desc: 'Accountancy, legal, consulting, training, subscriptions' },
                    { code: 'MOTOR', name: 'Motor Expenses', desc: 'Fuel, insurance, maintenance, leasing for practice vehicles' },
                    { code: 'OTHER', name: 'Petty Cash / Other', desc: 'Small purchases, sundries, bank charges, miscellaneous' },
                    { code: 'NON_BUSINESS', name: 'Non-Business', desc: 'Personal drawings, non-practice transfers, personal expenses' }
                  ].map(group => (
                    <GroupInfoItem key={group.code} group={group} />
                  ))}
                </div>
              </div>

              {/* Expectation setting */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={{ width: '32px', flexShrink: 0 }} />
                <div style={{
                  backgroundColor: `${COLORS.highlightYellow}15`,
                  padding: '0.875rem 1rem',
                  borderRadius: '12px',
                  maxWidth: '85%',
                  border: `1px solid ${COLORS.highlightYellow}50`
                }}>
                  <div style={{
                    fontSize: '0.875rem',
                    color: COLORS.darkGray,
                    lineHeight: 1.5
                  }}>
                    I'll sort most transactions automatically. For the rest, I'll ask you to confirm or correct. The more you guide me now, the better I get over time.
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom navigation */}
            <div style={{
              padding: '1rem',
              borderTop: `1px solid ${COLORS.lightGray}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              {onBack && (
                <button
                  onClick={onBack}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: `1px solid ${COLORS.lightGray}`,
                    color: COLORS.mediumGray,
                    backgroundColor: 'transparent'
                  }}
                >
                  <ArrowLeft style={{ width: '16px', height: '16px' }} />
                  Back
                </button>
              )}
              <button
                onClick={onSkip}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: `1px solid ${COLORS.lightGray}`,
                  color: COLORS.mediumGray,
                  backgroundColor: 'transparent',
                  marginLeft: onBack ? '0' : 'auto'
                }}
              >
                Skip for Now
              </button>
            </div>
          </div>

          {/* Right side - What Happens Next */}
          <div style={{
            flex: '1 1 60%',
            minWidth: '500px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{
              backgroundColor: COLORS.white,
              border: `3px solid ${COLORS.slainteBlue}`,
              borderRadius: '16px',
              padding: '2.5rem',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: COLORS.darkGray,
                marginBottom: '0.5rem',
                textAlign: 'center'
              }}>
                What happens next
              </h3>

              {/* Transaction count */}
              <div style={{
                textAlign: 'center',
                marginBottom: '2rem'
              }}>
                <span style={{
                  display: 'inline-block',
                  padding: '0.375rem 1rem',
                  borderRadius: '9999px',
                  backgroundColor: `${COLORS.slainteBlue}15`,
                  color: COLORS.slainteBlue,
                  fontSize: '0.9375rem',
                  fontWeight: 600
                }}>
                  {initialTransactions?.length || 0} transactions ready to review
                </span>
              </div>

              {/* Three steps */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                maxWidth: '400px',
                margin: '0 auto',
                marginBottom: '2.5rem'
              }}>
                {[
                  { icon: Filter, label: 'Sort by Type', desc: 'Income vs Expenditure — mostly automatic' },
                  { icon: ListChecks, label: 'Assign to Groups', desc: 'Staff Costs, Premises, Professional Fees, etc.' },
                  { icon: Save, label: 'Review & Save', desc: 'Confirm and save to your practice data' }
                ].map((step, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                      width: '3rem',
                      height: '3rem',
                      borderRadius: '50%',
                      backgroundColor: `${COLORS.slainteBlue}15`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <step.icon style={{ width: '1.25rem', height: '1.25rem', color: COLORS.slainteBlue }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '1rem', color: COLORS.darkGray }}>
                        {i + 1}. {step.label}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>
                        {step.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Begin Review button */}
              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={handleIntroComplete}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.875rem 2rem',
                    borderRadius: '12px',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: 'none',
                    backgroundColor: COLORS.slainteBlue,
                    color: COLORS.white,
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                >
                  Begin Review
                  <ArrowRight style={{ width: '18px', height: '18px' }} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main upload UI - shown when processing flow is NOT open and NOT showing intro */}
      {!isFlowOpen && !showFinnIntro && (
        <div style={{
          display: 'flex',
          gap: '2rem',
          alignItems: 'flex-start',
          maxWidth: '1600px',
          margin: '0 auto',
          height: 'min(75vh, 700px)'
        }}>
          {/* Left side - Finn Chat Box */}
          <div style={{
            flex: '1 1 40%',
            minWidth: '400px',
            maxWidth: '550px',
            height: '100%',
            backgroundColor: COLORS.white,
            borderRadius: '0.75rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: `1px solid ${COLORS.lightGray}`,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Chat Header */}
            <div style={{
              backgroundColor: COLORS.slainteBlue,
              color: COLORS.white,
              padding: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <div style={{
                width: '2.5rem',
                height: '2.5rem',
                backgroundColor: COLORS.slainteBlueDark,
                borderRadius: '9999px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <User style={{ height: '1.25rem', width: '1.25rem' }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '1rem' }}>Finn</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>Sláinte Guide</div>
              </div>
            </div>

            {/* Chat Messages Area */}
            <div style={{
              padding: '1.5rem',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              overflowY: 'auto'
            }}>
              {/* Greeting */}
              {showGreeting && (
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: COLORS.backgroundGray,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <MessageCircle style={{ width: '16px', height: '16px', color: COLORS.slainteBlue }} />
                  </div>
                  <div style={{
                    backgroundColor: COLORS.backgroundGray,
                    padding: '0.875rem 1rem',
                    borderRadius: '12px',
                    maxWidth: '85%'
                  }}>
                    <div style={{
                      fontSize: '1.125rem',
                      fontWeight: 600,
                      color: COLORS.darkGray
                    }}>
                      {greeting}
                    </div>
                  </div>
                </div>
              )}

              {/* Message */}
              {showMessage && (
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <div style={{ width: '32px', flexShrink: 0 }} />
                  <div style={{
                    backgroundColor: COLORS.backgroundGray,
                    padding: '0.875rem 1rem',
                    borderRadius: '12px',
                    maxWidth: '85%'
                  }}>
                    <div style={{
                      fontSize: '0.9375rem',
                      color: COLORS.darkGray,
                      lineHeight: 1.5
                    }}>
                      {message}
                    </div>
                  </div>
                </div>
              )}

              {/* Tip */}
              {showTip && (
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <div style={{ width: '32px', flexShrink: 0 }} />
                  <div style={{
                    backgroundColor: `${COLORS.highlightYellow}15`,
                    padding: '0.875rem 1rem',
                    borderRadius: '12px',
                    maxWidth: '85%',
                    border: `1px solid ${COLORS.highlightYellow}50`
                  }}>
                    <div style={{
                      fontSize: '0.875rem',
                      color: COLORS.darkGray,
                      lineHeight: 1.5
                    }}>
                      {tip}
                    </div>
                  </div>
                </div>
              )}

              {/* File parsing message */}
              {isProcessing && (
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <div style={{ width: '32px', flexShrink: 0 }} />
                  <div style={{
                    backgroundColor: `${COLORS.slainteBlue}15`,
                    padding: '0.875rem 1rem',
                    borderRadius: '12px',
                    maxWidth: '85%',
                    border: `1px solid ${COLORS.slainteBlue}`
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      color: COLORS.darkGray,
                      fontSize: '0.9375rem'
                    }}>
                      <Loader style={{
                        width: '18px',
                        height: '18px',
                        color: COLORS.slainteBlue,
                        animation: 'spin 1s linear infinite'
                      }} />
                      Reading your bank statements...
                    </div>
                  </div>
                </div>
              )}

              {/* Wave info message - shown when processing waves */}
              {totalWaves > 0 && currentWaveNumber > 0 && !isFlowOpen && (
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <div style={{ width: '32px', flexShrink: 0 }} />
                  <div style={{
                    backgroundColor: `${COLORS.incomeColor}15`,
                    padding: '0.875rem 1rem',
                    borderRadius: '12px',
                    maxWidth: '85%',
                    border: `1px solid ${COLORS.incomeColor}`
                  }}>
                    <div style={{
                      fontSize: '0.9375rem',
                      color: COLORS.darkGray,
                      marginBottom: '0.25rem'
                    }}>
                      <strong>Wave {currentWaveNumber} of {totalWaves}</strong>
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: COLORS.mediumGray }}>
                      {currentWaveNumber === 1
                        ? "I'll learn from how you categorize these first transactions to improve accuracy for the rest."
                        : `Using patterns from ${processedCorpus.length} reviewed transactions to improve suggestions.`}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation options */}
            <div style={{
              padding: '1rem',
              borderTop: `1px solid ${COLORS.lightGray}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              {onBack && (
                <button
                  onClick={onBack}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: `1px solid ${COLORS.lightGray}`,
                    color: COLORS.mediumGray,
                    backgroundColor: 'transparent'
                  }}
                >
                  <ArrowLeft style={{ width: '16px', height: '16px' }} />
                  Back
                </button>
              )}
              <button
                onClick={onSkip}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: `1px solid ${COLORS.lightGray}`,
                  color: COLORS.mediumGray,
                  backgroundColor: 'transparent',
                  marginLeft: onBack ? '0' : 'auto'
                }}
              >
                Skip for Now
              </button>
            </div>
          </div>

          {/* Right side - Upload Area */}
          <div style={{
            flex: '1 1 60%',
            minWidth: '500px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            opacity: tipComplete ? 1 : 0.3,
            transition: 'opacity 0.5s ease-out',
            pointerEvents: tipComplete ? 'auto' : 'none'
          }}>
            <div style={{
              backgroundColor: COLORS.white,
              border: `3px solid ${COLORS.slainteBlue}`,
              borderRadius: '16px',
              padding: '2rem',
              flex: 1,
              display: 'flex',
              flexDirection: 'column'
            }}>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: COLORS.darkGray,
                marginBottom: '0.5rem'
              }}>
                Upload Bank Statements
              </h3>
              <p style={{
                fontSize: '1rem',
                color: COLORS.mediumGray,
                marginBottom: '1.5rem'
              }}>
                Select one or more bank statement files
              </p>

              {/* File type columns */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                {/* PDF Column */}
                <div style={{
                  border: `2px dashed ${COLORS.incomeColor}`,
                  borderRadius: '0.5rem',
                  padding: '1.5rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.pdf';
                  input.multiple = true;
                  input.onchange = handleFileSelect;
                  input.click();
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = `${COLORS.incomeColor}10`;
                  e.currentTarget.style.borderColor = COLORS.incomeColor;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = COLORS.incomeColor;
                }}
                >
                  <Building2 style={{ margin: '0 auto 0.75rem', height: '2.5rem', width: '2.5rem', color: COLORS.incomeColor }} />
                  <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem', color: COLORS.darkGray }}>Bank Statement PDFs</h4>
                  <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray }}>
                    Multiple files supported
                  </p>
                  <p style={{ fontSize: '0.6875rem', color: COLORS.mediumGray, marginTop: '0.5rem', fontStyle: 'italic' }}>
                    Bank of Ireland supported
                  </p>
                </div>

                {/* CSV Column */}
                <div style={{
                  border: `2px dashed ${COLORS.slainteBlue}`,
                  borderRadius: '0.5rem',
                  padding: '1.5rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.csv';
                  input.multiple = true;
                  input.onchange = handleFileSelect;
                  input.click();
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = `${COLORS.slainteBlue}10`;
                  e.currentTarget.style.borderColor = COLORS.slainteBlue;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = COLORS.slainteBlue;
                }}
                >
                  <FileSpreadsheet style={{ margin: '0 auto 0.75rem', height: '2.5rem', width: '2.5rem', color: COLORS.slainteBlue }} />
                  <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem', color: COLORS.darkGray }}>CSV Exports</h4>
                  <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray }}>
                    From online banking
                  </p>
                </div>
              </div>

              {/* Processing indicator */}
              {isProcessing && (
                <div style={{ padding: '1rem', backgroundColor: `${COLORS.slainteBlue}15`, borderRadius: '0.5rem', textAlign: 'center', marginBottom: '1rem' }}>
                  <div style={{
                    animation: 'spin 1s linear infinite',
                    borderRadius: '9999px',
                    height: '2rem',
                    width: '2rem',
                    border: `2px solid ${COLORS.slainteBlue}`,
                    borderTopColor: 'transparent',
                    margin: '0 auto'
                  }}></div>
                  <p style={{ fontSize: '0.875rem', color: COLORS.darkGray, marginTop: '0.5rem' }}>
                    Processing your files...
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Detection Modal */}
      {showDuplicateModal && duplicateInfo && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: COLORS.white,
            borderRadius: '0.75rem',
            padding: '1.5rem',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{
                backgroundColor: `${COLORS.highlightYellow}20`,
                borderRadius: '50%',
                padding: '0.5rem'
              }}>
                <AlertTriangle style={{ width: '1.5rem', height: '1.5rem', color: COLORS.highlightYellow }} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: COLORS.darkGray, margin: 0 }}>
                Duplicate Transactions Detected
              </h3>
            </div>

            <div style={{
              backgroundColor: COLORS.backgroundGray,
              borderRadius: '0.5rem',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <p style={{ fontSize: '0.875rem', color: COLORS.darkGray, margin: 0 }}>
                <strong>{duplicateInfo.duplicateCount}</strong> of {duplicateInfo.totalCount} transactions appear to already exist.
              </p>
              {duplicateInfo.uniqueCount > 0 && (
                <p style={{ fontSize: '0.875rem', color: COLORS.mediumGray, margin: '0.5rem 0 0 0' }}>
                  {duplicateInfo.uniqueCount} new transactions can be added.
                </p>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                onClick={() => handleDuplicateResolution('skip')}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  backgroundColor: COLORS.slainteBlue,
                  color: COLORS.white,
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Skip Duplicates ({duplicateInfo.uniqueCount} new will be added)
              </button>

              <button
                onClick={() => handleDuplicateResolution('add')}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  backgroundColor: 'transparent',
                  color: COLORS.darkGray,
                  border: `1px solid ${COLORS.lightGray}`,
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Add All Anyway ({duplicateInfo.totalCount} transactions)
              </button>

              <button
                onClick={() => {
                  setShowDuplicateModal(false);
                  setDuplicateInfo(null);
                  setPendingTransactions(null);
                  setSelectedFiles([]);
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  backgroundColor: 'transparent',
                  color: COLORS.mediumGray,
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  cursor: 'pointer'
                }}
              >
                Cancel Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ProcessingFlowPanel - embedded side-by-side for onboarding, modal for bulk uploads */}
      {isFlowOpen && initialTransactions && (
        <div style={{
          display: 'flex',
          gap: '1.5rem',
          alignItems: 'stretch',
          maxWidth: '1600px',
          margin: '0 auto',
          height: 'min(80vh, 750px)'
        }}>
          {/* Left side - Finn Chat Panel */}
          <div style={{
            flex: '0 0 320px',
            maxWidth: '350px',
            backgroundColor: COLORS.white,
            borderRadius: '0.75rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: `1px solid ${COLORS.lightGray}`,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Chat Header */}
            <div style={{
              backgroundColor: COLORS.slainteBlue,
              color: COLORS.white,
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <div style={{
                width: '2rem',
                height: '2rem',
                backgroundColor: COLORS.slainteBlueDark,
                borderRadius: '9999px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <User style={{ height: '1rem', width: '1rem' }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Finn</div>
              </div>
            </div>

            {/* Chat Messages + Group List */}
            <div style={{
              padding: '1rem',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              overflowY: 'auto'
            }}>
              {/* Contextual message */}
              <div style={{
                backgroundColor: COLORS.backgroundGray,
                padding: '0.75rem',
                borderRadius: '10px',
                fontSize: '0.8125rem',
                color: COLORS.darkGray,
                lineHeight: 1.4
              }}>
                Review how I've sorted your transactions into groups. Click any group name below to see what belongs there.
              </div>

              {/* Interactive Group List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {[
                  { code: 'INCOME', name: 'Income', desc: 'GMS payments, private consultations, insurance claims, other practice revenue' },
                  { code: 'STAFF', name: 'Staff Costs', desc: 'GP salaries, locum fees, nursing staff, reception wages, PRSI, pensions' },
                  { code: 'PREMISES', name: 'Premises', desc: 'Rent, rates, insurance, utilities, repairs, cleaning, security' },
                  { code: 'MEDICAL', name: 'Medical Supplies', desc: 'Medications, vaccines, surgical supplies, lab testing, medical equipment' },
                  { code: 'OFFICE', name: 'Office & IT', desc: 'Software, hardware, stationery, postage, phone, broadband' },
                  { code: 'PROFESSIONAL', name: 'Professional Fees', desc: 'Accountancy, legal, consulting, training, subscriptions' },
                  { code: 'MOTOR', name: 'Motor Expenses', desc: 'Fuel, insurance, maintenance, leasing for practice vehicles' },
                  { code: 'OTHER', name: 'Petty Cash / Other', desc: 'Small purchases, sundries, bank charges, miscellaneous' },
                  { code: 'NON_BUSINESS', name: 'Non-Business', desc: 'Personal drawings, non-practice transfers, personal expenses' }
                ].map(group => (
                  <GroupInfoItem key={group.code} group={group} />
                ))}
              </div>

              {/* Tip */}
              <div style={{
                backgroundColor: `${COLORS.highlightYellow}15`,
                padding: '0.625rem 0.75rem',
                borderRadius: '10px',
                border: `1px solid ${COLORS.highlightYellow}50`,
                fontSize: '0.75rem',
                color: COLORS.darkGray,
                lineHeight: 1.4
              }}>
                The more you guide me now, the better I get over time. After a few months, I should sort 95-99% automatically.
              </div>
            </div>

            {/* Bottom navigation */}
            <div style={{
              padding: '0.75rem 1rem',
              borderTop: `1px solid ${COLORS.lightGray}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              {onBack && (
                <button
                  onClick={onBack}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.375rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: `1px solid ${COLORS.lightGray}`,
                    color: COLORS.mediumGray,
                    backgroundColor: 'transparent'
                  }}
                >
                  <ArrowLeft style={{ width: '14px', height: '14px' }} />
                  Back
                </button>
              )}
              <button
                onClick={onSkip}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.375rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: `1px solid ${COLORS.lightGray}`,
                  color: COLORS.mediumGray,
                  backgroundColor: 'transparent',
                  marginLeft: onBack ? '0' : 'auto'
                }}
              >
                Skip
              </button>
            </div>
          </div>

          {/* Right side - Embedded ProcessingFlowPanel */}
          <div style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            borderRadius: '0.75rem',
            overflow: 'hidden',
            border: `1px solid ${COLORS.lightGray}`,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <ProcessingFlowPanel
              categoryMapping={categoryMapping}
              onComplete={handleProcessingComplete}
              onCancel={handleProcessingCancel}
              onRemoveIdentifier={handleRemoveIdentifier}
              embedded={true}
            />
          </div>
        </div>
      )}

      {/* ProcessingFlowPanel - modal mode for non-onboarding (bulk uploads from main app) */}
      {isFlowOpen && !initialTransactions && (
        <ProcessingFlowPanel
          categoryMapping={categoryMapping}
          onComplete={handleProcessingComplete}
          onCancel={handleProcessingCancel}
          onRemoveIdentifier={handleRemoveIdentifier}
        />
      )}

      {/* CSS for spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

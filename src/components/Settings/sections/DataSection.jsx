import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { useFinnSafe } from '../../../context/FinnContext';
import { useProcessingFlow } from '../../ProcessingFlow/ProcessingFlowContext';
import ProcessingFlowPanel from '../../ProcessingFlow';
import {
  Upload,
  Download,
  FileText,
  Building2,
  Activity,
  CheckCircle,
  AlertCircle,
  Shield,
  Clock,
  Calendar
} from 'lucide-react';
import COLORS from '../../../utils/colors';
import Papa from 'papaparse';
import { categorizeTransactionSimple, processTransactionData } from '../../../utils/transactionProcessor';
import { parsePCRSPaymentPDF, validateExtractedData } from '../../../utils/pdfParser';
import { syncPanelNumbersFromPaymentData } from '../../../storage/practiceProfileStorage';
import { parseBankStatementPDF } from '../../../utils/bankStatementParser';
import PCRSDownloader from '../../PCRSDownloader';
import BulkUploadFlow, { PENDING_UPLOAD_KEY } from '../../ProcessingFlow/BulkUploadFlow';

const BULK_UPLOAD_THRESHOLD = 200;

// Helper function to create a unique key for a transaction (for duplicate detection)
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

/**
 * DataSection - Upload Data and PCRS Downloads
 */
const DataSection = () => {
  const {
    transactions,
    setTransactions,
    unidentifiedTransactions,
    setUnidentifiedTransactions,
    categoryMapping,
    setCategoryMapping,
    paymentAnalysisData,
    setPaymentAnalysisData,
    aiCorrections,
    recordAICorrection
  } = useAppContext();

  // Get Finn context for background task status (may be null if outside FinnProvider)
  const finnContext = useFinnSafe();
  const backgroundTask = finnContext?.backgroundTask;
  const TASK_TYPES = finnContext?.TASK_TYPES;
  const TASK_STATUS = finnContext?.TASK_STATUS;

  // Get processing flow context for the new Finn-guided upload flow
  const processingFlow = useProcessingFlow();
  const { isFlowOpen, startProcessing, completeFlow, cancelFlow } = processingFlow;

  // State for pending transactions during processing flow
  const [pendingUploadData, setPendingUploadData] = useState(null);

  // State for bulk upload flow (200+ transactions)
  const [pendingBulkUpload, setPendingBulkUpload] = useState(null);

  // State for resumable bulk upload (saved progress)
  const [bulkResumeData, setBulkResumeData] = useState(() => {
    try {
      const stash = localStorage.getItem(PENDING_UPLOAD_KEY);
      return stash ? JSON.parse(stash) : null;
    } catch { return null; }
  });

  // Handler for when processing flow completes
  const handleProcessingComplete = useCallback((result) => {
    const { transactions: processedTransactions, stats } = result;

    // Separate into categorized and unidentified based on category assignment
    const newCategorized = [];
    const newUnidentified = [];

    processedTransactions.forEach(t => {
      if (t.category && t.categoryCode) {
        newCategorized.push(t);
      } else {
        newUnidentified.push(t);
      }
    });

    // Add to app state
    if (newCategorized.length > 0) {
      setTransactions(prev => [...prev, ...newCategorized]);
    }
    if (newUnidentified.length > 0) {
      setUnidentifiedTransactions(prev => [...prev, ...newUnidentified]);
    }

    // Show result
    setUploadResult({
      type: pendingUploadData?.type || 'csv',
      categorized: newCategorized.length,
      unidentified: newUnidentified.length,
      skippedDuplicates: pendingUploadData?.skippedDuplicates || 0,
      stats // Include cohort stats for display
    });

    setPendingUploadData(null);
    console.log('[DataSection] Processing complete:', stats);
  }, [setTransactions, setUnidentifiedTransactions, pendingUploadData]);

  // Handler for when processing flow is cancelled
  const handleProcessingCancel = useCallback(() => {
    setPendingUploadData(null);
    setUploadResult(null);
    console.log('[DataSection] Processing cancelled');
  }, []);

  // Handler for bulk upload flow completion (all waves done)
  // Note: individual waves are already committed via onWaveComplete,
  // so this just closes the flow and shows the summary.
  const handleBulkProcessingComplete = useCallback((result) => {
    const { transactions: processedTransactions, stats } = result;

    // Count categorized vs unidentified for display
    const categorizedCount = processedTransactions.filter(t => t.category && t.categoryCode).length;
    const unidentifiedCount = processedTransactions.length - categorizedCount;

    setUploadResult({
      type: pendingBulkUpload?.type || 'csv',
      categorized: categorizedCount,
      unidentified: unidentifiedCount,
      skippedDuplicates: pendingBulkUpload?.skippedDuplicates || 0,
      stats
    });

    setPendingBulkUpload(null);
    localStorage.removeItem(PENDING_UPLOAD_KEY);
    setBulkResumeData(null);
    console.log('[DataSection] Bulk processing complete:', stats);
  }, [pendingBulkUpload]);

  // Handler for per-wave commit (saves each wave's transactions to app state immediately)
  const handleBulkWaveComplete = useCallback((result) => {
    const { transactions: waveTransactions } = result;

    const newCategorized = [];
    const newUnidentified = [];

    waveTransactions.forEach(t => {
      if (t.category && t.categoryCode) {
        newCategorized.push(t);
      } else {
        newUnidentified.push(t);
      }
    });

    if (newCategorized.length > 0) {
      setTransactions(prev => [...prev, ...newCategorized]);
    }
    if (newUnidentified.length > 0) {
      setUnidentifiedTransactions(prev => [...prev, ...newUnidentified]);
    }

    console.log(`[DataSection] Wave committed: ${newCategorized.length} categorized, ${newUnidentified.length} unidentified`);
  }, [setTransactions, setUnidentifiedTransactions]);

  // Handler for Save & Exit from bulk flow
  const handleBulkSaveAndExit = useCallback((remainingTransactions) => {
    // Waves already committed per-wave, just close the flow
    setPendingBulkUpload(null);
    cancelFlow();
    // Update resume data from fresh localStorage read
    try {
      const stash = localStorage.getItem(PENDING_UPLOAD_KEY);
      setBulkResumeData(stash ? JSON.parse(stash) : null);
    } catch { setBulkResumeData(null); }
    console.log(`[DataSection] Bulk upload saved: ${remainingTransactions.length} transactions remaining`);
  }, [cancelFlow]);

  // Handler for resuming a saved bulk upload
  const handleBulkResume = useCallback(() => {
    if (!bulkResumeData?.remainingTransactions?.length) return;
    setPendingBulkUpload({
      transactions: bulkResumeData.remainingTransactions,
      type: 'csv',
      skippedDuplicates: 0,
      isResume: true
    });
    // Clear the stash — it will be re-created if user saves again
    localStorage.removeItem(PENDING_UPLOAD_KEY);
    setBulkResumeData(null);
  }, [bulkResumeData]);

  // Handler for discarding a saved bulk upload
  const handleBulkResumeDiscard = useCallback(() => {
    localStorage.removeItem(PENDING_UPLOAD_KEY);
    setBulkResumeData(null);
  }, []);

  // Handler for removing an identifier from a category (used in conflict resolution)
  const handleRemoveIdentifier = useCallback((categoryCode, identifier) => {
    console.log('[DataSection] Removing identifier:', { categoryCode, identifier });
    setCategoryMapping(prev => prev.map(cat => {
      if (cat.code === categoryCode && cat.identifiers?.includes(identifier)) {
        return {
          ...cat,
          identifiers: cat.identifiers.filter(id => id !== identifier)
        };
      }
      return cat;
    }));
    console.log('[DataSection] Identifier removed successfully');
  }, [setCategoryMapping]);

  // Upload Data state
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [pcrsProcessing, setPcrsProcessing] = useState(false);
  const [pcrsUploadResult, setPcrsUploadResult] = useState(null);
  const [pcrsProgress, setPcrsProgress] = useState(null); // { current, total, startTime }
  const pcrsFileInputRef = useRef(null);
  const bankFileInputRef = useRef(null);

  // Bank Statement PDF state
  const [bankPdfProcessing, setBankPdfProcessing] = useState(false);
  const [bankPdfResult, setBankPdfResult] = useState(null);
  const bankPdfInputRef = useRef(null);

  // PCRS Downloader state
  const [showPCRSDownloader, setShowPCRSDownloader] = useState(false);
  const [pcrsDownloaderQuickSelect, setPcrsDownloaderQuickSelect] = useState('latest'); // 'latest', '6', '12', '24', 'all'
  const [pcrsSessionStatus, setPcrsSessionStatus] = useState(null);

  // Load PCRS session status
  useEffect(() => {
    const checkPCRSSession = async () => {
      if (window.electronAPI?.pcrs?.checkSession) {
        try {
          const status = await window.electronAPI.pcrs.checkSession();
          setPcrsSessionStatus(status);
        } catch (error) {
          console.error('Error checking PCRS session:', error);
        }
      }
    };
    checkPCRSSession();
  }, [showPCRSDownloader]);

  // Auto-import function for PCRS downloads (used by both modal and background)
  const autoImportPCRSDownloads = useCallback(async (downloads) => {
    console.log('Auto-importing PCRS statements:', downloads);

    if (!window.electronAPI?.pcrs?.readFile) {
      console.warn('readFile API not available');
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    const allDownloadedPcrs = [];

    for (const download of downloads) {
      try {
        // Read the file content from main process
        const arrayBuffer = await window.electronAPI.pcrs.readFile(download.filename);

        if (!arrayBuffer) {
          console.error('Failed to read file:', download.filename);
          errorCount++;
          continue;
        }

        // Create a File-like object for the parser
        const fileBlob = new Blob([arrayBuffer], { type: 'application/pdf' });
        const file = new File([fileBlob], download.filename, { type: 'application/pdf' });

        // Parse the PDF
        const result = await parsePCRSPaymentPDF(file);

        if (result && validateExtractedData(result)) {
          // Add panel info to the result
          result.panelId = download.panelId;
          result.panelName = download.panelName;

          setPaymentAnalysisData(prev => {
            // Check for duplicates using paymentDate, totalGrossPayment, and doctorNumber/panelId
            const exists = prev.some(p =>
              p.paymentDate === result.paymentDate &&
              p.totalGrossPayment === result.totalGrossPayment &&
              (p.panelId === result.panelId || p.doctorNumber === result.doctorNumber)
            );
            if (exists) {
              console.log('Skipping duplicate:', download.filename);
              return prev;
            }
            console.log('Added payment data:', download.filename);
            return [...prev, result];
          });
          allDownloadedPcrs.push(result);
          successCount++;
        } else {
          console.error('Failed to parse/validate:', download.filename);
          errorCount++;
        }
      } catch (error) {
        console.error('Error processing downloaded PDF:', download.filename, error);
        errorCount++;
      }
    }

    // Sync panel numbers from downloaded PCRS data
    if (allDownloadedPcrs.length > 0) {
      syncPanelNumbersFromPaymentData(allDownloadedPcrs);
    }

    console.log(`Auto-import complete: ${successCount} succeeded, ${errorCount} failed`);

    // Show result to user via the existing PCRS upload result UI
    if (successCount > 0 || errorCount > 0) {
      setPcrsUploadResult({ success: successCount, error: errorCount });
    }
  }, [setPaymentAnalysisData]);

  // Track previous background task status to detect completion
  const prevBackgroundTaskRef = useRef(null);

  // Listen for background PCRS download completion
  useEffect(() => {
    const prevTask = prevBackgroundTaskRef.current;
    const currentTask = backgroundTask;

    // Check if PCRS download just completed
    if (
      currentTask?.type === TASK_TYPES?.PCRS_DOWNLOAD &&
      currentTask?.status === TASK_STATUS?.COMPLETED &&
      currentTask?.downloadedFiles?.length > 0 &&
      prevTask?.status === TASK_STATUS?.RUNNING
    ) {
      console.log('[DataSection] Background PCRS download completed, auto-importing...');
      autoImportPCRSDownloads(currentTask.downloadedFiles);
    }

    prevBackgroundTaskRef.current = currentTask;
  }, [backgroundTask, TASK_TYPES, TASK_STATUS, autoImportPCRSDownloads]);

  // Listen for custom events from Finn chat panel
  useEffect(() => {
    const handleNavigateToData = () => {
      // This component is already the data section, so just scroll to top or highlight
      console.log('[DataSection] Navigate to data section requested');
      // Could potentially trigger a visual highlight or scroll
    };

    const handleOpenPCRSDownloader = () => {
      console.log('[DataSection] Open PCRS downloader requested');
      setShowPCRSDownloader(true);
    };

    window.addEventListener('navigate-to-data-section', handleNavigateToData);
    window.addEventListener('open-pcrs-downloader', handleOpenPCRSDownloader);

    return () => {
      window.removeEventListener('navigate-to-data-section', handleNavigateToData);
      window.removeEventListener('open-pcrs-downloader', handleOpenPCRSDownloader);
    };
  }, []);

  // File upload handler
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setUploadResult(null);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;

      if (file.name.endsWith('.json')) {
        try {
          const data = JSON.parse(content);
          if (Array.isArray(data)) {
            const existingKeys = new Set();
            transactions.forEach(t => existingKeys.add(getTransactionKey(t)));
            unidentifiedTransactions.forEach(t => existingKeys.add(getTransactionKey(t)));

            let addedCount = 0;
            let skippedDuplicates = 0;

            const newTransactions = data.filter(t => {
              const key = getTransactionKey(t);
              if (existingKeys.has(key)) {
                skippedDuplicates++;
                return false;
              }
              existingKeys.add(key);
              addedCount++;
              return true;
            });

            setTransactions(prev => [...prev, ...newTransactions]);
            setUploadResult({
              type: 'training',
              categorized: addedCount,
              skippedDuplicates
            });
          }
        } catch (error) {
          console.error('Error parsing JSON:', error);
          alert('Error parsing JSON file. Please check the file format.');
        }
        setIsProcessing(false);
      } else {
        Papa.parse(content, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            // Build basic transaction objects from CSV rows
            const rawTransactions = results.data
              .filter(row => row && Object.keys(row).length > 0 && (row.Details || row.details))
              .map((row, index) => {
                const details = row.Details || row.details || row.Description || row.description ||
                               row.Particulars || row.particulars || row.Transaction || row.transaction ||
                               row.Narrative || row.narrative || row.Reference || row.reference || '';

                const debitValue = row.Debit || row.debit || row['Debit Amount'] || row['Debit_Amount'] ||
                                 row.DR || row.dr || row.Out || row.out || row.Withdrawal || row.withdrawal || 0;

                const creditValue = row.Credit || row.credit || row['Credit Amount'] || row['Credit_Amount'] ||
                                  row.CR || row.cr || row.In || row.in || row.Deposit || row.deposit || 0;

                const amountValue = row.Amount || row.amount || row.Value || row.value || 0;

                const debit = parseFloat(debitValue) || 0;
                const credit = parseFloat(creditValue) || 0;
                const amount = parseFloat(amountValue) || 0;

                // Parse date
                let parsedDate = null;
                let monthYear = null;
                const dateValue = row.Date || row.date || row['Transaction Date'] || row['Value Date'] ||
                                row['Date'] || row.TransactionDate || row['Processing Date'] || '';

                if (dateValue) {
                  try {
                    const dateStr = dateValue.toString().trim();
                    if (dateStr.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/)) {
                      const parts = dateStr.split(/[\/\-]/);
                      const day = parseInt(parts[0], 10);
                      const month = parseInt(parts[1], 10);
                      const year = parseInt(parts[2], 10);
                      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900) {
                        parsedDate = new Date(year, month - 1, day);
                      }
                    } else {
                      parsedDate = new Date(dateStr);
                    }
                    if (parsedDate && !isNaN(parsedDate.getTime())) {
                      monthYear = parsedDate.toISOString().substring(0, 7);
                    }
                  } catch (e) {
                    console.warn('Date parsing error:', dateValue);
                  }
                }

                return {
                  id: `${file.name}-${index}`,
                  date: parsedDate,
                  details,
                  debit,
                  credit,
                  amount: Math.max(Math.abs(debit), Math.abs(credit), Math.abs(amount)),
                  balance: parseFloat(row.Balance || row.balance || 0) || 0,
                  monthYear,
                  fileName: file.name
                };
              });

            // Filter duplicates
            const existingKeys = new Set();
            transactions.forEach(t => existingKeys.add(getTransactionKey(t)));
            unidentifiedTransactions.forEach(t => existingKeys.add(getTransactionKey(t)));

            let skippedDuplicates = 0;
            const nonDuplicates = rawTransactions.filter(t => {
              const key = getTransactionKey(t);
              if (existingKeys.has(key)) {
                skippedDuplicates++;
                return false;
              }
              existingKeys.add(key);
              return true;
            });

            if (nonDuplicates.length === 0) {
              setUploadResult({
                type: 'csv',
                categorized: 0,
                unidentified: 0,
                skippedDuplicates
              });
              setIsProcessing(false);
              return;
            }

            if (nonDuplicates.length > BULK_UPLOAD_THRESHOLD) {
              // Bulk upload: use BulkUploadFlow with Finn education panel + waves
              setPendingBulkUpload({
                transactions: nonDuplicates,
                type: 'csv',
                skippedDuplicates,
                fileName: file.name
              });
            } else {
              // Standard upload: use ProcessingFlowPanel
              setPendingUploadData({
                type: 'csv',
                skippedDuplicates,
                fileName: file.name
              });

              startProcessing(nonDuplicates, categoryMapping, {
                existingTransactions: [...transactions, ...unidentifiedTransactions],
                corrections: aiCorrections?.expense_categorization || [],
                recordCorrection: recordAICorrection
              });
            }
            setIsProcessing(false);
          },
          error: (error) => {
            console.error('CSV parsing error:', error);
            alert('Error parsing CSV file');
            setIsProcessing(false);
          }
        });
      }
    };
    reader.readAsText(file);
  };

  // PCRS upload handler
  const handlePcrsUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setPcrsProcessing(true);
    setPcrsUploadResult(null);
    const isBulk = files.length >= 15;
    if (isBulk) {
      setPcrsProgress({ current: 0, total: files.length, startTime: Date.now() });
    }

    let successCount = 0;
    let errorCount = 0;
    const allExtractedPcrs = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (isBulk) {
        setPcrsProgress(prev => ({ ...prev, current: i + 1 }));
      }
      try {
        const result = await parsePCRSPaymentPDF(file);

        if (result && validateExtractedData(result)) {
          setPaymentAnalysisData(prev => {
            const exists = prev.some(p =>
              p.paymentDate === result.paymentDate &&
              p.totalGrossPayment === result.totalGrossPayment &&
              p.doctorNumber === result.doctorNumber
            );
            if (exists) {
              console.log('Skipping duplicate PCRS statement:', result.doctorNumber, result.paymentDate);
              return prev;
            }
            console.log('Added PCRS payment data:', result.doctorNumber, result.paymentDate);
            return [...prev, result];
          });
          allExtractedPcrs.push(result);
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        console.error('Error processing PCRS PDF:', error);
        errorCount++;
      }
    }

    // Sync panel numbers from extracted PCRS data
    if (allExtractedPcrs.length > 0) {
      syncPanelNumbersFromPaymentData(allExtractedPcrs);
    }

    setPcrsUploadResult({ success: successCount, error: errorCount });
    setPcrsProcessing(false);
    setPcrsProgress(null);
    event.target.value = '';
  };

  // Bank PDF upload handler - now uses ProcessingFlow like CSV uploads
  const handleBankPdfUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setBankPdfProcessing(true);
    setBankPdfResult(null);

    // Collect all transactions from all PDFs
    let allTransactions = [];
    let totalDuplicates = 0;
    let detectedBank = '';
    let lastError = null;

    const existingKeys = new Set();
    transactions.forEach(t => existingKeys.add(getTransactionKey(t)));
    unidentifiedTransactions.forEach(t => existingKeys.add(getTransactionKey(t)));

    for (const file of files) {
      try {
        console.log('[BankPDF] Processing file:', file.name);
        const result = await parseBankStatementPDF(file);
        console.log('[BankPDF] Parse result:', result);

        if (result && result.transactions && result.transactions.length > 0) {
          detectedBank = result.bank;

          // Filter duplicates and add unique transactions
          result.transactions.forEach(t => {
            const key = getTransactionKey(t);
            if (existingKeys.has(key)) {
              totalDuplicates++;
              return;
            }
            existingKeys.add(key);

            // Add file source info and unique ID
            allTransactions.push({
              ...t,
              id: t.id || `${file.name}-${allTransactions.length}`,
              fileName: file.name
            });
          });
        } else {
          console.warn('[BankPDF] No transactions found in result:', result);
          lastError = 'No transactions found in PDF';
        }
      } catch (error) {
        console.error('[BankPDF] Error processing:', file.name, error);
        lastError = error.message || 'Unknown error processing PDF';
      }
    }

    setBankPdfProcessing(false);
    event.target.value = '';

    // If we have transactions, start the ProcessingFlow
    if (allTransactions.length > 0) {
      if (allTransactions.length > BULK_UPLOAD_THRESHOLD) {
        // Bulk upload: use BulkUploadFlow
        setPendingBulkUpload({
          transactions: allTransactions,
          type: 'bank_pdf',
          skippedDuplicates: totalDuplicates,
          bank: detectedBank,
          fileCount: files.length
        });
      } else {
        // Standard upload: use ProcessingFlowPanel
        setPendingUploadData({
          type: 'bank_pdf',
          skippedDuplicates: totalDuplicates,
          bank: detectedBank,
          fileCount: files.length
        });

        console.log('[BankPDF] Starting ProcessingFlow with', allTransactions.length, 'transactions');
        startProcessing(allTransactions, categoryMapping, {
          existingTransactions: [...transactions, ...unidentifiedTransactions],
          corrections: aiCorrections?.expense_categorization || [],
          recordCorrection: recordAICorrection
        });
      }
    } else {
      // Distinguish "all rows were duplicates" from a genuine parse failure.
      // Without this, the user sees "Could not extract transactions from PDF"
      // even when the parse succeeded and every row was already in the ledger.
      const allWereDuplicates = totalDuplicates > 0 && !lastError;
      setBankPdfResult({
        success: 0,
        transactionCount: 0,
        categorized: 0,
        unidentified: 0,
        duplicates: totalDuplicates,
        bank: detectedBank,
        errorMessage: allWereDuplicates
          ? `All ${totalDuplicates} transaction${totalDuplicates === 1 ? '' : 's'} from this statement ${totalDuplicates === 1 ? 'is' : 'are'} already in your ledger`
          : (lastError || 'Could not extract transactions from PDF')
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Upload Data Card */}
      <div style={{ backgroundColor: COLORS.white, padding: '1.5rem', borderRadius: '0.5rem', border: `1px solid ${COLORS.borderLight}` }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', color: COLORS.textPrimary, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Upload style={{ height: '1.25rem', width: '1.25rem', color: COLORS.slainteBlue }} />
          Upload Data
        </h2>
        <p style={{ fontSize: '0.875rem', color: COLORS.textSecondary, marginBottom: '1rem' }}>
          Import financial data and upload PCRS PDFs
        </p>

        {/* Resume banner for saved bulk upload */}
        {bulkResumeData && bulkResumeData.remainingTransactions?.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            borderRadius: '0.5rem',
            backgroundColor: `${COLORS.slainteBlue}08`,
            border: `1px solid ${COLORS.slainteBlue}30`
          }}>
            <Clock style={{ width: '1.25rem', height: '1.25rem', color: COLORS.slainteBlue, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: COLORS.textPrimary }}>
                Saved upload in progress
              </div>
              <div style={{ fontSize: '0.8125rem', color: COLORS.textSecondary }}>
                {bulkResumeData.remainingTransactions.length} transactions remaining
                ({bulkResumeData.completedWaveCount} of {bulkResumeData.totalWaveCount} waves completed)
                — saved {new Date(bulkResumeData.savedAt).toLocaleDateString()}
              </div>
            </div>
            <button
              onClick={handleBulkResume}
              style={{
                padding: '0.375rem 0.875rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: COLORS.slainteBlue,
                color: COLORS.white,
                fontSize: '0.8125rem',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Resume
            </button>
            <button
              onClick={handleBulkResumeDiscard}
              style={{
                padding: '0.375rem 0.625rem',
                borderRadius: '6px',
                border: `1px solid ${COLORS.borderLight}`,
                backgroundColor: 'transparent',
                color: COLORS.textSecondary,
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >
              Discard
            </button>
          </div>
        )}

        {/* Compact 4-Column Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
          {/* Column 1: Bank Transactions */}
          <div style={{ border: `2px dashed ${COLORS.slainteBlue}`, borderRadius: '0.5rem', padding: '1rem', textAlign: 'center' }}>
            <Upload style={{ margin: '0 auto 0.5rem', height: '1.75rem', width: '1.75rem', color: COLORS.slainteBlue }} />
            <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem', color: COLORS.textPrimary }}>Bank CSV</h3>
            <p style={{ fontSize: '0.6875rem', color: COLORS.textSecondary, marginBottom: '0.5rem' }}>
              CSV from your bank
            </p>
            <label style={{
              display: 'inline-block',
              padding: '0.375rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: 500,
              color: COLORS.slainteBlue,
              backgroundColor: 'transparent',
              border: `1px solid ${COLORS.slainteBlue}`,
              borderRadius: '0.25rem',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              opacity: isProcessing ? 0.5 : 1
            }}>
              Choose File
              <input
                ref={bankFileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={isProcessing}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          {/* Column 2: Training Data */}
          <div style={{ border: `2px dashed ${COLORS.highlightYellow}`, borderRadius: '0.5rem', padding: '1rem', textAlign: 'center' }}>
            <FileText style={{ margin: '0 auto 0.5rem', height: '1.75rem', width: '1.75rem', color: COLORS.highlightYellow }} />
            <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem', color: COLORS.textPrimary }}>Training JSON</h3>
            <p style={{ fontSize: '0.6875rem', color: COLORS.textSecondary, marginBottom: '0.5rem' }}>
              Pre-categorized data
            </p>
            <label style={{
              display: 'inline-block',
              padding: '0.375rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: 500,
              color: COLORS.warningText,
              backgroundColor: 'transparent',
              border: `1px solid ${COLORS.warningText}`,
              borderRadius: '0.25rem',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              opacity: isProcessing ? 0.5 : 1
            }}>
              Choose File
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                disabled={isProcessing}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          {/* Column 3: Bank Statement PDFs */}
          <div style={{ border: `2px dashed ${COLORS.incomeColor}`, borderRadius: '0.5rem', padding: '1rem', textAlign: 'center' }}>
            <Building2 style={{ margin: '0 auto 0.5rem', height: '1.75rem', width: '1.75rem', color: COLORS.incomeColor }} />
            <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem', color: COLORS.textPrimary }}>Bank PDFs</h3>
            <p style={{ fontSize: '0.6875rem', color: COLORS.textSecondary, marginBottom: '0.5rem' }}>
              Bank Statements
            </p>
            <label style={{
              display: 'inline-block',
              padding: '0.375rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: 500,
              color: COLORS.incomeColor,
              backgroundColor: 'transparent',
              border: `1px solid ${COLORS.incomeColor}`,
              borderRadius: '0.25rem',
              cursor: bankPdfProcessing ? 'not-allowed' : 'pointer',
              opacity: bankPdfProcessing ? 0.5 : 1
            }}>
              Choose Files
              <input
                ref={bankPdfInputRef}
                type="file"
                accept=".pdf"
                multiple
                onChange={handleBankPdfUpload}
                disabled={bankPdfProcessing}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          {/* Column 4: PCRS Payment PDFs */}
          <div style={{ border: `2px dashed ${COLORS.expenseColor}`, borderRadius: '0.5rem', padding: '1rem', textAlign: 'center' }}>
            <Activity style={{ margin: '0 auto 0.5rem', height: '1.75rem', width: '1.75rem', color: COLORS.expenseColor }} />
            <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem', color: COLORS.textPrimary }}>PCRS PDFs</h3>
            <p style={{ fontSize: '0.6875rem', color: COLORS.textSecondary, marginBottom: '0.5rem' }}>
              GMS statements
            </p>
            <label style={{
              display: 'inline-block',
              padding: '0.375rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: 500,
              color: COLORS.expenseColor,
              backgroundColor: 'transparent',
              border: `1px solid ${COLORS.expenseColor}`,
              borderRadius: '0.25rem',
              cursor: pcrsProcessing ? 'not-allowed' : 'pointer',
              opacity: pcrsProcessing ? 0.5 : 1
            }}>
              Choose Files
              <input
                ref={pcrsFileInputRef}
                type="file"
                accept=".pdf"
                multiple
                onChange={handlePcrsUpload}
                disabled={pcrsProcessing}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>

        {/* Processing indicators and results */}
        {isProcessing && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: `${COLORS.slainteBlue}15`, borderRadius: '0.5rem', textAlign: 'center' }}>
            <div style={{
              animation: 'spin 1s linear infinite',
              borderRadius: '9999px',
              height: '1.5rem',
              width: '1.5rem',
              border: `2px solid ${COLORS.slainteBlue}`,
              borderTopColor: 'transparent',
              margin: '0 auto'
            }}></div>
            <p style={{ fontSize: '0.8125rem', color: COLORS.textPrimary, marginTop: '0.5rem' }}>
              Processing {selectedFile?.name.endsWith('.json') ? 'training data' : 'transactions'}...
            </p>
          </div>
        )}

        {selectedFile && !isProcessing && uploadResult && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: `${COLORS.incomeColor}20`, borderRadius: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
              <CheckCircle style={{ height: '1rem', width: '1rem', color: COLORS.incomeColor, marginRight: '0.5rem' }} />
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: COLORS.textPrimary }}>
                Processed {selectedFile.name}
              </span>
            </div>
            {uploadResult.type === 'training' ? (
              <p style={{ fontSize: '0.8125rem', color: COLORS.textPrimary }}>
                {uploadResult.categorized} transactions imported
                {uploadResult.skippedDuplicates > 0 && ` (${uploadResult.skippedDuplicates} duplicates skipped)`}
              </p>
            ) : (
              <p style={{ fontSize: '0.8125rem', color: COLORS.textPrimary }}>
                {uploadResult.categorized} categorized, {uploadResult.unidentified} need review
                {uploadResult.skippedDuplicates > 0 && ` (${uploadResult.skippedDuplicates} duplicates skipped)`}
              </p>
            )}
          </div>
        )}

        {pcrsProcessing && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: `${COLORS.expenseColor}15`, borderRadius: '0.5rem', textAlign: 'center' }}>
            <div style={{
              animation: 'spin 1s linear infinite',
              borderRadius: '9999px',
              height: '1.5rem',
              width: '1.5rem',
              border: `2px solid ${COLORS.expenseColor}`,
              borderTopColor: 'transparent',
              margin: '0 auto'
            }}></div>
            {pcrsProgress ? (
              <>
                <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: COLORS.textPrimary, marginTop: '0.5rem' }}>
                  Processing PDF {pcrsProgress.current} of {pcrsProgress.total}
                </p>
                {/* Progress bar */}
                <div style={{ margin: '0.5rem auto', maxWidth: '200px', height: '4px', backgroundColor: `${COLORS.expenseColor}30`, borderRadius: '2px' }}>
                  <div style={{
                    height: '100%',
                    width: `${(pcrsProgress.current / pcrsProgress.total) * 100}%`,
                    backgroundColor: COLORS.expenseColor,
                    borderRadius: '2px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                {/* Estimated time remaining */}
                {pcrsProgress.current > 1 && (() => {
                  const elapsed = (Date.now() - pcrsProgress.startTime) / 1000;
                  const perFile = elapsed / pcrsProgress.current;
                  const remaining = Math.ceil(perFile * (pcrsProgress.total - pcrsProgress.current));
                  return (
                    <p style={{ fontSize: '0.75rem', color: COLORS.textSecondary, marginTop: '0.25rem' }}>
                      ~{remaining}s remaining
                    </p>
                  );
                })()}
                <p style={{ fontSize: '0.75rem', color: COLORS.textSecondary, marginTop: '0.5rem', lineHeight: 1.4 }}>
                  Each PDF contains panel sizes, demographics, and payment breakdowns.
                  <br />Duplicates are automatically detected and skipped.
                </p>
              </>
            ) : (
              <p style={{ fontSize: '0.8125rem', color: COLORS.textPrimary, marginTop: '0.5rem' }}>
                Processing PCRS PDFs...
              </p>
            )}
          </div>
        )}

        {pcrsUploadResult && !pcrsProcessing && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: pcrsUploadResult.success > 0 ? `${COLORS.incomeColor}20` : `${COLORS.expenseColor}20`,
            borderRadius: '0.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
              <CheckCircle style={{ height: '1rem', width: '1rem', color: pcrsUploadResult.success > 0 ? COLORS.incomeColor : COLORS.expenseColor, marginRight: '0.5rem' }} />
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: COLORS.textPrimary }}>
                PCRS Processing Complete
              </span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: COLORS.textPrimary }}>
              {pcrsUploadResult.success} uploaded{pcrsUploadResult.error > 0 && `, ${pcrsUploadResult.error} failed`}
            </p>
          </div>
        )}

        {bankPdfProcessing && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: `${COLORS.incomeColor}15`, borderRadius: '0.5rem', textAlign: 'center' }}>
            <div style={{
              animation: 'spin 1s linear infinite',
              borderRadius: '9999px',
              height: '1.5rem',
              width: '1.5rem',
              border: `2px solid ${COLORS.incomeColor}`,
              borderTopColor: 'transparent',
              margin: '0 auto'
            }}></div>
            <p style={{ fontSize: '0.8125rem', color: COLORS.textPrimary, marginTop: '0.5rem' }}>
              Extracting from bank statement PDF...
            </p>
          </div>
        )}

        {bankPdfResult && !bankPdfProcessing && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: bankPdfResult.success > 0 ? `${COLORS.incomeColor}20` : `${COLORS.expenseColor}20`,
            borderRadius: '0.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
              {bankPdfResult.success > 0 ? (
                <CheckCircle style={{ height: '1rem', width: '1rem', color: COLORS.incomeColor, marginRight: '0.5rem' }} />
              ) : (
                <AlertCircle style={{ height: '1rem', width: '1rem', color: COLORS.expenseColor, marginRight: '0.5rem' }} />
              )}
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: COLORS.textPrimary }}>
                {bankPdfResult.success > 0 ? 'Bank PDF Processed' : 'Error Processing PDF'}
              </span>
            </div>
            {bankPdfResult.success > 0 ? (
              <p style={{ fontSize: '0.8125rem', color: COLORS.textPrimary }}>
                {bankPdfResult.transactionCount} transactions: {bankPdfResult.categorized} categorized, {bankPdfResult.unidentified} need review
                {bankPdfResult.duplicates > 0 && ` (${bankPdfResult.duplicates} duplicates skipped)`}
              </p>
            ) : (
              <p style={{ fontSize: '0.8125rem', color: COLORS.expenseColor }}>
                {bankPdfResult.errorMessage}
              </p>
            )}
          </div>
        )}
      </div>

      {/* PCRS Statement Download Section - Desktop Only */}
      {window.electronAPI?.isElectron && (
        <div style={{ backgroundColor: COLORS.white, padding: '1.5rem', borderRadius: '0.5rem', border: `1px solid ${COLORS.borderLight}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', color: COLORS.textPrimary }}>
              <Activity style={{ height: '1.25rem', width: '1.25rem', marginRight: '0.5rem', color: COLORS.slainteBlue }} />
              PCRS Statement Downloads
            </h3>
            {pcrsSessionStatus?.valid && (
              <span style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', backgroundColor: `${COLORS.incomeColor}20`, color: COLORS.incomeColor, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <CheckCircle style={{ height: '0.75rem', width: '0.75rem' }} />
                Session Active
              </span>
            )}
          </div>

          <p style={{ fontSize: '0.875rem', color: COLORS.textSecondary, marginBottom: '1rem' }}>
            Automatically download your PCRS payment statements directly from the portal.
            Your login credentials are never stored - you authenticate via the secure PCRS website.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                setPcrsDownloaderQuickSelect('latest');
                setShowPCRSDownloader(true);
              }}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: COLORS.white,
                backgroundColor: COLORS.slainteBlue,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Download style={{ height: '1rem', width: '1rem' }} />
              Latest Statement
            </button>

            <button
              onClick={() => {
                setPcrsDownloaderQuickSelect('24');
                setShowPCRSDownloader(true);
              }}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: COLORS.slainteBlue,
                backgroundColor: 'transparent',
                border: `1px solid ${COLORS.slainteBlue}`,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Calendar style={{ height: '1rem', width: '1rem' }} />
              Bulk Download (24 months)
            </button>

            {pcrsSessionStatus?.valid && (
              <div style={{ fontSize: '0.875rem', color: COLORS.textSecondary }}>
                <Clock style={{ height: '1rem', width: '1rem', display: 'inline', marginRight: '0.25rem', verticalAlign: 'middle' }} />
                Session expires in {pcrsSessionStatus.remainingHours} hours
              </div>
            )}
          </div>

          {pcrsSessionStatus?.exists && !pcrsSessionStatus?.valid && (
            <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: COLORS.warningLight }}>
              <p style={{ fontSize: '0.75rem', color: COLORS.warningText }}>
                <AlertCircle style={{ height: '0.75rem', width: '0.75rem', display: 'inline', marginRight: '0.25rem', verticalAlign: 'middle' }} />
                Your previous session has expired. Click "Download Statements" to log in again.
              </p>
            </div>
          )}

          {!pcrsSessionStatus?.exists && (
            <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: COLORS.bgPage }}>
              <p style={{ fontSize: '0.75rem', color: COLORS.textSecondary }}>
                <Shield style={{ height: '0.75rem', width: '0.75rem', display: 'inline', marginRight: '0.25rem', verticalAlign: 'middle' }} />
                First time setup: You'll be prompted to log in to the PCRS portal. Your session will be remembered for 24 hours.
              </p>
            </div>
          )}
        </div>
      )}

      {/* PCRS Downloader Modal */}
      <PCRSDownloader
        isOpen={showPCRSDownloader}
        onClose={() => setShowPCRSDownloader(false)}
        onStatementsDownloaded={autoImportPCRSDownloads}
        defaultQuickSelect={pcrsDownloaderQuickSelect}
      />

      {/* Finn-Guided Processing Flow Modal (standard uploads <200 txns) */}
      {isFlowOpen && !pendingBulkUpload && (
        <ProcessingFlowPanel
          categoryMapping={categoryMapping}
          onComplete={handleProcessingComplete}
          onCancel={handleProcessingCancel}
          onRemoveIdentifier={handleRemoveIdentifier}
        />
      )}

      {/* Bulk Upload Flow (200+ transactions with Finn education panel) */}
      {pendingBulkUpload && (
        <BulkUploadFlow
          transactions={pendingBulkUpload.transactions}
          categoryMapping={categoryMapping}
          existingTransactions={[...transactions, ...unidentifiedTransactions]}
          corrections={aiCorrections?.expense_categorization || []}
          recordCorrection={recordAICorrection}
          onComplete={handleBulkProcessingComplete}
          onWaveComplete={handleBulkWaveComplete}
          onSaveAndExit={handleBulkSaveAndExit}
          onCancel={() => { setPendingBulkUpload(null); cancelFlow(); }}
          onRemoveIdentifier={handleRemoveIdentifier}
        />
      )}

      {/* CSS Animation for spinner */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default DataSection;

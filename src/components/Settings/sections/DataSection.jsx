import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../../../context/AppContext';
import {
  Upload,
  Download,
  FileText,
  Building2,
  Activity,
  CheckCircle,
  AlertCircle,
  Shield,
  Clock
} from 'lucide-react';
import COLORS from '../../../utils/colors';
import Papa from 'papaparse';
import { categorizeTransactionSimple, processTransactionData } from '../../../utils/transactionProcessor';
import { parsePCRSPaymentPDF, validateExtractedData } from '../../../utils/pdfParser';
import { parseBankStatementPDF } from '../../../utils/bankStatementParser';
import PCRSDownloader from '../../PCRSDownloader';

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
    paymentAnalysisData,
    setPaymentAnalysisData
  } = useAppContext();

  // Upload Data state
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [pcrsProcessing, setPcrsProcessing] = useState(false);
  const [pcrsUploadResult, setPcrsUploadResult] = useState(null);
  const pcrsFileInputRef = useRef(null);
  const bankFileInputRef = useRef(null);

  // Bank Statement PDF state
  const [bankPdfProcessing, setBankPdfProcessing] = useState(false);
  const [bankPdfResult, setBankPdfResult] = useState(null);
  const bankPdfInputRef = useRef(null);

  // PCRS Downloader state
  const [showPCRSDownloader, setShowPCRSDownloader] = useState(false);
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
            const processed = processTransactionData(results.data, categoryMapping);

            const existingKeys = new Set();
            transactions.forEach(t => existingKeys.add(getTransactionKey(t)));
            unidentifiedTransactions.forEach(t => existingKeys.add(getTransactionKey(t)));

            let categorizedCount = 0;
            let unidentifiedCount = 0;
            let skippedDuplicates = 0;
            const newCategorized = [];
            const newUnidentified = [];

            processed.forEach(t => {
              const key = getTransactionKey(t);
              if (existingKeys.has(key)) {
                skippedDuplicates++;
                return;
              }
              existingKeys.add(key);

              if (t.category && t.category !== 'Unidentified') {
                categorizedCount++;
                newCategorized.push(t);
              } else {
                unidentifiedCount++;
                newUnidentified.push(t);
              }
            });

            setTransactions(prev => [...prev, ...newCategorized]);
            setUnidentifiedTransactions(prev => [...prev, ...newUnidentified]);
            setUploadResult({
              type: 'csv',
              categorized: categorizedCount,
              unidentified: unidentifiedCount,
              skippedDuplicates
            });
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

    let successCount = 0;
    let errorCount = 0;

    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await parsePCRSPaymentPDF(arrayBuffer);

        if (result && validateExtractedData(result)) {
          setPaymentAnalysisData(prev => {
            const exists = prev.some(p =>
              p.paymentDate === result.paymentDate &&
              p.totalAmount === result.totalAmount
            );
            if (exists) return prev;
            return [...prev, result];
          });
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        console.error('Error processing PCRS PDF:', error);
        errorCount++;
      }
    }

    setPcrsUploadResult({ success: successCount, error: errorCount });
    setPcrsProcessing(false);
    event.target.value = '';
  };

  // Bank PDF upload handler
  const handleBankPdfUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setBankPdfProcessing(true);
    setBankPdfResult(null);

    let totalTransactions = 0;
    let totalCategorized = 0;
    let totalUnidentified = 0;
    let totalDuplicates = 0;
    let successCount = 0;
    let detectedBank = '';

    const existingKeys = new Set();
    transactions.forEach(t => existingKeys.add(getTransactionKey(t)));
    unidentifiedTransactions.forEach(t => existingKeys.add(getTransactionKey(t)));

    for (const file of files) {
      try {
        const result = await parseBankStatementPDF(file);

        if (result && result.transactions && result.transactions.length > 0) {
          detectedBank = result.bank;
          totalTransactions += result.transactions.length;

          const newCategorized = [];
          const newUnidentified = [];

          result.transactions.forEach(t => {
            const key = getTransactionKey(t);
            if (existingKeys.has(key)) {
              totalDuplicates++;
              return;
            }
            existingKeys.add(key);

            const categorized = categorizeTransactionSimple(t, categoryMapping);

            if (categorized.category && categorized.category !== 'Unidentified') {
              totalCategorized++;
              newCategorized.push(categorized);
            } else {
              totalUnidentified++;
              newUnidentified.push({ ...t, category: 'Unidentified' });
            }
          });

          if (newCategorized.length > 0) {
            setTransactions(prev => [...prev, ...newCategorized]);
          }
          if (newUnidentified.length > 0) {
            setUnidentifiedTransactions(prev => [...prev, ...newUnidentified]);
          }

          successCount++;
        }
      } catch (error) {
        console.error('Error processing bank PDF:', error);
      }
    }

    setBankPdfResult({
      success: successCount,
      transactionCount: totalTransactions,
      categorized: totalCategorized,
      unidentified: totalUnidentified,
      duplicates: totalDuplicates,
      bank: detectedBank,
      errorMessage: successCount === 0 ? 'Could not extract transactions from PDF' : null
    });
    setBankPdfProcessing(false);
    event.target.value = '';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Upload Data Card */}
      <div style={{ backgroundColor: COLORS.white, padding: '1.5rem', borderRadius: '0.5rem', border: `1px solid ${COLORS.lightGray}` }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', color: COLORS.darkGray, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Upload style={{ height: '1.25rem', width: '1.25rem', color: COLORS.slainteBlue }} />
          Upload Data
        </h2>
        <p style={{ fontSize: '0.875rem', color: COLORS.mediumGray, marginBottom: '1rem' }}>
          Import financial data and upload PCRS PDFs
        </p>

        {/* Compact 4-Column Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
          {/* Column 1: Bank Transactions */}
          <div style={{ border: `2px dashed ${COLORS.slainteBlue}`, borderRadius: '0.5rem', padding: '1rem', textAlign: 'center' }}>
            <Upload style={{ margin: '0 auto 0.5rem', height: '1.75rem', width: '1.75rem', color: COLORS.slainteBlue }} />
            <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem', color: COLORS.darkGray }}>Bank CSV</h3>
            <p style={{ fontSize: '0.6875rem', color: COLORS.mediumGray, marginBottom: '0.5rem' }}>
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
            <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem', color: COLORS.darkGray }}>Training JSON</h3>
            <p style={{ fontSize: '0.6875rem', color: COLORS.mediumGray, marginBottom: '0.5rem' }}>
              Pre-categorized data
            </p>
            <label style={{
              display: 'inline-block',
              padding: '0.375rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: 500,
              color: '#B45309',
              backgroundColor: 'transparent',
              border: '1px solid #B45309',
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
            <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem', color: COLORS.darkGray }}>Bank PDFs</h3>
            <p style={{ fontSize: '0.6875rem', color: COLORS.mediumGray, marginBottom: '0.5rem' }}>
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
            <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem', color: COLORS.darkGray }}>PCRS PDFs</h3>
            <p style={{ fontSize: '0.6875rem', color: COLORS.mediumGray, marginBottom: '0.5rem' }}>
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
            <p style={{ fontSize: '0.8125rem', color: COLORS.darkGray, marginTop: '0.5rem' }}>
              Processing {selectedFile?.name.endsWith('.json') ? 'training data' : 'transactions'}...
            </p>
          </div>
        )}

        {selectedFile && !isProcessing && uploadResult && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: `${COLORS.incomeColor}20`, borderRadius: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
              <CheckCircle style={{ height: '1rem', width: '1rem', color: COLORS.incomeColor, marginRight: '0.5rem' }} />
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: COLORS.darkGray }}>
                Processed {selectedFile.name}
              </span>
            </div>
            {uploadResult.type === 'training' ? (
              <p style={{ fontSize: '0.8125rem', color: COLORS.darkGray }}>
                {uploadResult.categorized} transactions imported
                {uploadResult.skippedDuplicates > 0 && ` (${uploadResult.skippedDuplicates} duplicates skipped)`}
              </p>
            ) : (
              <p style={{ fontSize: '0.8125rem', color: COLORS.darkGray }}>
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
            <p style={{ fontSize: '0.8125rem', color: COLORS.darkGray, marginTop: '0.5rem' }}>
              Processing PCRS PDFs...
            </p>
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
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: COLORS.darkGray }}>
                PCRS Processing Complete
              </span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: COLORS.darkGray }}>
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
            <p style={{ fontSize: '0.8125rem', color: COLORS.darkGray, marginTop: '0.5rem' }}>
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
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: COLORS.darkGray }}>
                {bankPdfResult.success > 0 ? 'Bank PDF Processed' : 'Error Processing PDF'}
              </span>
            </div>
            {bankPdfResult.success > 0 ? (
              <p style={{ fontSize: '0.8125rem', color: COLORS.darkGray }}>
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
        <div style={{ backgroundColor: COLORS.white, padding: '1.5rem', borderRadius: '0.5rem', border: `1px solid ${COLORS.lightGray}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', color: COLORS.darkGray }}>
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

          <p style={{ fontSize: '0.875rem', color: COLORS.mediumGray, marginBottom: '1rem' }}>
            Automatically download your PCRS payment statements directly from the portal.
            Your login credentials are never stored - you authenticate via the secure PCRS website.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => setShowPCRSDownloader(true)}
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
              Download Statements
            </button>

            {pcrsSessionStatus?.valid && (
              <div style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>
                <Clock style={{ height: '1rem', width: '1rem', display: 'inline', marginRight: '0.25rem', verticalAlign: 'middle' }} />
                Session expires in {pcrsSessionStatus.remainingHours} hours
              </div>
            )}
          </div>

          {pcrsSessionStatus?.exists && !pcrsSessionStatus?.valid && (
            <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#FEF3C7' }}>
              <p style={{ fontSize: '0.75rem', color: '#92400E' }}>
                <AlertCircle style={{ height: '0.75rem', width: '0.75rem', display: 'inline', marginRight: '0.25rem', verticalAlign: 'middle' }} />
                Your previous session has expired. Click "Download Statements" to log in again.
              </p>
            </div>
          )}

          {!pcrsSessionStatus?.exists && (
            <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: COLORS.backgroundGray }}>
              <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray }}>
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
        onStatementsDownloaded={(downloads) => {
          console.log('PCRS statements downloaded:', downloads);
        }}
      />

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

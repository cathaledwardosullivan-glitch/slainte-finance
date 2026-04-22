import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
// ... other imports
import { Upload, CheckCircle, FileText, Activity, Brain, AlertTriangle, X, Building2 } from 'lucide-react';
import Papa from 'papaparse';
import { categorizeTransaction, categorizeTransactionSimple, processTransactionData } from '../utils/transactionProcessor';
import { parsePCRSPaymentPDF, validateExtractedData } from '../utils/pdfParser';
import { parseBankStatementPDF, getSupportedBanks } from '../utils/bankStatementParser';
import COLORS from '../utils/colors';
import AIIdentifierSuggestions from './AIIdentifierSuggestions';
import AIExpenseCategorization from './AIExpenseCategorization';

// Helper function to create a unique key for a transaction (for duplicate detection)
const getTransactionKey = (t) => {
    // Normalize date to YYYY-MM-DD string
    let dateStr = '';
    if (t.date) {
        const d = new Date(t.date);
        if (!isNaN(d.getTime())) {
            dateStr = d.toISOString().split('T')[0];
        }
    }
    // Normalize amount (use absolute value of debit or credit)
    const amount = Math.abs(t.debit || t.credit || t.amount || 0).toFixed(2);
    // Normalize details (lowercase, trim whitespace)
    const details = (t.details || '').toLowerCase().trim();
    return `${dateStr}|${amount}|${details}`;
};

// Filter out items whose id already exists in the prev array. Guards against
// re-uploading the same file producing ID collisions (since upload IDs are
// {fileName}-{index} and restart at 0 on every upload).
const dedupeById = (prev, incoming) => {
    if (!incoming?.length) return incoming || [];
    const existingIds = new Set(prev.map(t => t.id));
    const kept = incoming.filter(t => !existingIds.has(t.id));
    const skipped = incoming.length - kept.length;
    if (skipped > 0) {
        console.warn(`[TransactionUpload] Skipped ${skipped} row(s) with IDs already in the ledger (same file uploaded previously?)`);
    }
    return kept;
};

export default function TransactionUpload() {
    const {
        transactions,
        setTransactions,
        unidentifiedTransactions,
        setUnidentifiedTransactions,
        categoryMapping,
        paymentAnalysisData,
        setPaymentAnalysisData
    } = useAppContext();
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadResult, setUploadResult] = useState(null);
    const [pcrsProcessing, setPcrsProcessing] = useState(false);
    const [pcrsUploadResult, setPcrsUploadResult] = useState(null);
    const pcrsFileInputRef = useRef(null);
    const [showAISuggestions, setShowAISuggestions] = useState(false);
    const [showExpenseCategorization, setShowExpenseCategorization] = useState(false);

    // Bank statement PDF state
    const [bankPdfProcessing, setBankPdfProcessing] = useState(false);
    const [bankPdfResult, setBankPdfResult] = useState(null);
    const bankPdfInputRef = useRef(null);

    // Duplicate detection state
    const [showDuplicateModal, setShowDuplicateModal] = useState(false);
    const [duplicateInfo, setDuplicateInfo] = useState(null);
    const [pendingUpload, setPendingUpload] = useState(null);

    // Simplified categorization function for onboarding (uses parent categories)
    const categorizeTransactionWithContext = (transaction) => {
        return categorizeTransactionSimple(transaction, categoryMapping);
    };

    // Check for duplicate transactions
    const checkForDuplicates = (newCategorized, newUnidentified) => {
        // Build a set of existing transaction keys
        const existingKeys = new Set();
        transactions.forEach(t => existingKeys.add(getTransactionKey(t)));
        unidentifiedTransactions.forEach(t => existingKeys.add(getTransactionKey(t)));

        // Check new transactions against existing
        const duplicateCategorized = [];
        const uniqueCategorized = [];
        newCategorized.forEach(t => {
            const key = getTransactionKey(t);
            if (existingKeys.has(key)) {
                duplicateCategorized.push(t);
            } else {
                uniqueCategorized.push(t);
            }
        });

        const duplicateUnidentified = [];
        const uniqueUnidentified = [];
        newUnidentified.forEach(t => {
            const key = getTransactionKey(t);
            if (existingKeys.has(key)) {
                duplicateUnidentified.push(t);
            } else {
                uniqueUnidentified.push(t);
            }
        });

        return {
            duplicates: {
                categorized: duplicateCategorized,
                unidentified: duplicateUnidentified,
                total: duplicateCategorized.length + duplicateUnidentified.length
            },
            unique: {
                categorized: uniqueCategorized,
                unidentified: uniqueUnidentified,
                total: uniqueCategorized.length + uniqueUnidentified.length
            }
        };
    };

    // Handle duplicate resolution
    const handleDuplicateResolution = (action) => {
        if (!pendingUpload) return;

        const { categorized, unidentified, duplicateCheck } = pendingUpload;

        if (action === 'skip') {
            // Only add unique transactions
            setTransactions(prev => [...prev, ...dedupeById(prev, duplicateCheck.unique.categorized)]);
            setUnidentifiedTransactions(prev => [...prev, ...dedupeById(prev, duplicateCheck.unique.unidentified)]);
            setUploadResult({
                type: 'regular',
                categorized: duplicateCheck.unique.categorized.length,
                unidentified: duplicateCheck.unique.unidentified.length,
                skippedDuplicates: duplicateCheck.duplicates.total
            });
        } else if (action === 'add') {
            // Add all transactions including signature duplicates, but still
            // dedupe by ID to prevent row-level collisions from same-file re-upload
            setTransactions(prev => [...prev, ...dedupeById(prev, categorized)]);
            setUnidentifiedTransactions(prev => [...prev, ...dedupeById(prev, unidentified)]);
            setUploadResult({
                type: 'regular',
                categorized: categorized.length,
                unidentified: unidentified.length
            });
        }

        setShowDuplicateModal(false);
        setDuplicateInfo(null);
        setPendingUpload(null);
        setIsProcessing(false);
    };

    // NEW: Process JSON training data (skip categorization)
    const processJsonTrainingData = (jsonData) => {
        try {
            // Validate JSON structure
            if (!jsonData.trainingTransactions || !Array.isArray(jsonData.trainingTransactions)) {
                throw new Error('Invalid training data format - missing trainingTransactions array');
            }

            const processedTransactions = jsonData.trainingTransactions.map((transaction, index) => {
                // Transform the training data structure to match expected transaction format
                const amount = Math.abs(transaction.amount || 0);

                return {
                    id: `training-${Date.now()}-${index}`,
                    date: transaction.date || new Date().toISOString(),
                    details: transaction.details || 'Imported Training Data',
                    debit: transaction.amount < 0 ? amount : 0,
                    credit: transaction.amount >= 0 ? amount : 0,
                    amount: transaction.amount || 0,
                    category: transaction.category || null,
                    type: transaction.category?.type || 'unknown',
                    isTrainingData: true, // Mark as training data
                    imported: true,
                    fileName: selectedFile?.name || 'training-data.json',
                    rawData: transaction
                };
            });

            // All training transactions are already categorized, so they go directly to categorized
            const categorized = processedTransactions.filter(t => t.category);
            const unidentified = processedTransactions.filter(t => !t.category);

            setTransactions(prev => [...prev, ...dedupeById(prev, categorized)]);
            setUnidentifiedTransactions(prev => [...prev, ...dedupeById(prev, unidentified)]);

            setUploadResult({
                type: 'training',
                totalCount: jsonData.totalCount || processedTransactions.length,
                categorized: categorized.length,
                unidentified: unidentified.length,
                exportDate: jsonData.exportDate
            });

            setIsProcessing(false);

            alert(`Training data imported successfully!\n\nImported: ${categorized.length} categorized transactions\nUnidentified: ${unidentified.length} transactions\n\nNote: These transactions were pre-categorized and did not require AI processing.`);

        } catch (error) {
            console.error('Error processing JSON training data:', error);
            setIsProcessing(false);
            alert('Error processing training data: ' + error.message);
        }
    };

    // Process regular transaction data (CSV/Excel)
    const processUploadedData = (results) => {
        try {
            const { categorized, unidentified, autoIncome } = processTransactionData(
                results,
                selectedFile,
                categorizeTransactionWithContext
            );

            // Find the "Income Unclassified" category (code 1.0) for auto-income transactions
            const incomeUnclassifiedCategory = categoryMapping.find(c => c.code === '1.0') ||
                categoryMapping.find(c => c.name === 'Income Unclassified') ||
                categoryMapping.find(c => c.type === 'income');

            // Process auto-income transactions
            const processedAutoIncome = (autoIncome || []).map(t => ({
                ...t,
                category: incomeUnclassifiedCategory,
                autoCategorized: true // Flag to indicate this was auto-categorized
            }));

            // Combine all categorized transactions
            const allCategorized = [...categorized, ...processedAutoIncome];

            // Check for duplicates
            const duplicateCheck = checkForDuplicates(allCategorized, unidentified);

            if (duplicateCheck.duplicates.total > 0) {
                // Show duplicate warning modal
                setDuplicateInfo({
                    duplicateCount: duplicateCheck.duplicates.total,
                    uniqueCount: duplicateCheck.unique.total,
                    totalCount: allCategorized.length + unidentified.length,
                    sampleDuplicates: [
                        ...duplicateCheck.duplicates.categorized.slice(0, 3),
                        ...duplicateCheck.duplicates.unidentified.slice(0, 3)
                    ].slice(0, 3) // Show up to 3 examples
                });
                setPendingUpload({ categorized: allCategorized, unidentified, duplicateCheck });
                setShowDuplicateModal(true);
                // Don't set isProcessing to false yet - wait for user decision
            } else {
                // No duplicates, proceed normally
                setTransactions(prev => [...prev, ...dedupeById(prev, allCategorized)]);
                setUnidentifiedTransactions(prev => [...prev, ...dedupeById(prev, unidentified)]);

                setUploadResult({
                    type: 'regular',
                    categorized: allCategorized.length,
                    unidentified: unidentified.length,
                    autoIncome: processedAutoIncome.length
                });

                setIsProcessing(false);
            }

        } catch (error) {
            console.error('Error processing transactions:', error);
            setIsProcessing(false);
            alert('Error processing file data: ' + error.message);
        }
    };

    // File upload handler - ENHANCED with JSON support
    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setIsProcessing(true);
        setSelectedFile(file);
        setUploadResult(null);

        const fileExtension = file.name.split('.').pop().toLowerCase();

        // NEW: Handle JSON files (training data)
        if (fileExtension === 'json') {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const jsonData = JSON.parse(e.target.result);
                    processJsonTrainingData(jsonData);
                } catch (error) {
                    console.error('JSON parsing error:', error);
                    setIsProcessing(false);
                    alert('Error reading JSON file: ' + error.message + '\n\nPlease ensure the file is valid JSON from the training data export.');
                }
            };
            reader.readAsText(file);

        } else if (fileExtension === 'csv') {
            Papa.parse(file, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: processUploadedData,
                error: (error) => {
                    console.error('CSV parsing error:', error);
                    setIsProcessing(false);
                    alert('Error parsing CSV file: ' + error.message);
                }
            });
        } else {
            setIsProcessing(false);
            alert('Please upload a supported file format:\n- CSV (.csv)\n- Training Data (.json)');
        }
    };

    // Handle PCRS PDF upload
    const handlePcrsUpload = async (event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        setPcrsProcessing(true);
        setPcrsUploadResult(null);

        let successCount = 0;
        let errorCount = 0;

        for (const file of files) {
            if (file.type === 'application/pdf') {
                try {
                    const extractedData = await parsePCRSPaymentPDF(file);
                    extractedData.fileName = file.name;

                    const validationErrors = validateExtractedData(extractedData);

                    if (validationErrors.length === 0) {
                        setPaymentAnalysisData(prev => [...prev, extractedData]);
                        successCount++;
                    } else {
                        errorCount++;
                    }
                } catch (error) {
                    console.error('Error processing PCRS PDF:', error);
                    errorCount++;
                }
            }
        }

        setPcrsProcessing(false);
        setPcrsUploadResult({
            success: successCount,
            error: errorCount,
            total: files.length
        });
    };

    // Handle Bank Statement PDF upload
    const handleBankPdfUpload = async (event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        setBankPdfProcessing(true);
        setBankPdfResult(null);
        setUploadResult(null);

        let allTransactions = [];
        let successCount = 0;
        let errorCount = 0;
        let detectedBank = null;

        for (const file of files) {
            if (file.type === 'application/pdf') {
                try {
                    const result = await parseBankStatementPDF(file);
                    detectedBank = result.bank;

                    // Transform transactions to match app format
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
                    successCount++;
                } catch (error) {
                    console.error('Error processing bank PDF:', error);
                    errorCount++;
                    setBankPdfResult({
                        success: 0,
                        error: 1,
                        errorMessage: error.message
                    });
                    setBankPdfProcessing(false);
                    return;
                }
            }
        }

        if (allTransactions.length > 0) {
            // Categorize the transactions
            const categorized = [];
            const unidentified = [];
            const autoIncome = [];

            for (const tx of allTransactions) {
                const category = categorizeTransactionWithContext(tx);

                if (category) {
                    categorized.push({ ...tx, category, isIncome: category.type === 'income' });
                } else if (tx.credit > 0) {
                    // Auto-categorize income
                    autoIncome.push({ ...tx, category: '__AUTO_INCOME__', isIncome: true });
                } else {
                    unidentified.push(tx);
                }
            }

            // Find income unclassified category for auto-income
            const incomeUnclassifiedCategory = categoryMapping.find(c => c.code === '1.0') ||
                categoryMapping.find(c => c.name === 'Income Unclassified') ||
                categoryMapping.find(c => c.type === 'income');

            const processedAutoIncome = autoIncome.map(t => ({
                ...t,
                category: incomeUnclassifiedCategory,
                autoCategorized: true
            }));

            const allCategorized = [...categorized, ...processedAutoIncome];

            // Check for duplicates
            const duplicateCheck = checkForDuplicates(allCategorized, unidentified);

            if (duplicateCheck.duplicates.total > 0) {
                setDuplicateInfo({
                    duplicateCount: duplicateCheck.duplicates.total,
                    uniqueCount: duplicateCheck.unique.total,
                    totalCount: allCategorized.length + unidentified.length,
                    sampleDuplicates: [
                        ...duplicateCheck.duplicates.categorized.slice(0, 3),
                        ...duplicateCheck.duplicates.unidentified.slice(0, 3)
                    ].slice(0, 3)
                });
                setPendingUpload({ categorized: allCategorized, unidentified, duplicateCheck });
                setShowDuplicateModal(true);
                setBankPdfProcessing(false);
                setBankPdfResult({
                    success: successCount,
                    error: errorCount,
                    total: files.length,
                    transactionCount: allTransactions.length,
                    bank: detectedBank,
                    pendingDuplicateCheck: true
                });
            } else {
                // No duplicates - add directly
                setTransactions(prev => [...prev, ...dedupeById(prev, allCategorized)]);
                setUnidentifiedTransactions(prev => [...prev, ...dedupeById(prev, unidentified)]);

                setBankPdfResult({
                    success: successCount,
                    error: errorCount,
                    total: files.length,
                    transactionCount: allTransactions.length,
                    categorized: allCategorized.length,
                    unidentified: unidentified.length,
                    bank: detectedBank
                });

                setUploadResult({
                    type: 'bank-pdf',
                    categorized: allCategorized.length,
                    unidentified: unidentified.length,
                    autoIncome: processedAutoIncome.length
                });
            }
        }

        setBankPdfProcessing(false);

        // Reset file input
        if (bankPdfInputRef.current) {
            bankPdfInputRef.current.value = '';
        }
    };


    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ backgroundColor: COLORS.white, padding: '1.5rem', borderRadius: '0.5rem', border: `1px solid ${COLORS.borderLight}` }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem', color: COLORS.textPrimary }}>Upload Data</h2>
                <p style={{ fontSize: '0.875rem', color: COLORS.textSecondary, marginBottom: '1.5rem' }}>
                    Import financial data and upload PCRS PDFs
                </p>

                {/* 3-Column Layout */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                    {/* Column 1: Bank Transactions */}
                    <div style={{ border: `2px dashed ${COLORS.slainteBlue}`, borderRadius: '0.5rem', padding: '1.5rem', textAlign: 'center' }}>
                        <Upload style={{ margin: '0 auto 0.75rem', height: '2.5rem', width: '2.5rem', color: COLORS.slainteBlue }} />
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: COLORS.textPrimary }}>Bank Transactions</h3>
                        <p style={{ fontSize: '0.75rem', color: COLORS.textSecondary, marginBottom: '1rem' }}>
                            CSV files from your bank
                        </p>
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileUpload}
                            disabled={isProcessing}
                            style={{ width: '100%' }}
                        />
                    </div>

                    {/* Column 2: Training Data */}
                    <div style={{ border: `2px dashed ${COLORS.highlightYellow}`, borderRadius: '0.5rem', padding: '1.5rem', textAlign: 'center' }}>
                        <FileText style={{ margin: '0 auto 0.75rem', height: '2.5rem', width: '2.5rem', color: COLORS.highlightYellow }} />
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: COLORS.textPrimary }}>Training Data</h3>
                        <p style={{ fontSize: '0.75rem', color: COLORS.textSecondary, marginBottom: '1rem' }}>
                            Pre-categorized JSON backup files
                        </p>
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleFileUpload}
                            disabled={isProcessing}
                            style={{ width: '100%' }}
                        />
                    </div>

                    {/* Column 3: Bank Statement PDFs */}
                    <div style={{ border: `2px dashed ${COLORS.incomeColor}`, borderRadius: '0.5rem', padding: '1.5rem', textAlign: 'center' }}>
                        <Building2 style={{ margin: '0 auto 0.75rem', height: '2.5rem', width: '2.5rem', color: COLORS.incomeColor }} />
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: COLORS.textPrimary }}>Bank Statement PDFs</h3>
                        <p style={{ fontSize: '0.75rem', color: COLORS.textSecondary, marginBottom: '1rem' }}>
                            BOI statement PDFs (beta)
                        </p>
                        <input
                            ref={bankPdfInputRef}
                            type="file"
                            accept=".pdf"
                            multiple
                            onChange={handleBankPdfUpload}
                            disabled={bankPdfProcessing}
                            style={{ width: '100%' }}
                        />
                    </div>

                    {/* Column 4: PCRS Payment PDFs */}
                    <div style={{ border: `2px dashed ${COLORS.expenseColor}`, borderRadius: '0.5rem', padding: '1.5rem', textAlign: 'center' }}>
                        <Activity style={{ margin: '0 auto 0.75rem', height: '2.5rem', width: '2.5rem', color: COLORS.expenseColor }} />
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: COLORS.textPrimary }}>PCRS Payments</h3>
                        <p style={{ fontSize: '0.75rem', color: COLORS.textSecondary, marginBottom: '1rem' }}>
                            GMS payment statement PDFs
                        </p>
                        <input
                            ref={pcrsFileInputRef}
                            type="file"
                            accept=".pdf"
                            multiple
                            onChange={handlePcrsUpload}
                            disabled={pcrsProcessing}
                            style={{ width: '100%' }}
                        />
                    </div>
                </div>

                {/* Processing indicator */}
                {isProcessing && (
                    <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: `${COLORS.slainteBlue}15`, borderRadius: '0.5rem', textAlign: 'center' }}>
                        <div style={{
                            animation: 'spin 1s linear infinite',
                            borderRadius: '9999px',
                            height: '2rem',
                            width: '2rem',
                            border: `2px solid ${COLORS.slainteBlue}`,
                            borderTopColor: 'transparent',
                            margin: '0 auto'
                        }}></div>
                        <p style={{ fontSize: '0.875rem', color: COLORS.textPrimary, marginTop: '0.5rem' }}>
                            Processing {selectedFile?.name.endsWith('.json') ? 'training data' : 'transactions'}...
                        </p>
                    </div>
                )}

                {/* Bank PDF Processing indicator */}
                {bankPdfProcessing && (
                    <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: `${COLORS.incomeColor}15`, borderRadius: '0.5rem', textAlign: 'center' }}>
                        <div style={{
                            animation: 'spin 1s linear infinite',
                            borderRadius: '9999px',
                            height: '2rem',
                            width: '2rem',
                            border: `2px solid ${COLORS.incomeColor}`,
                            borderTopColor: 'transparent',
                            margin: '0 auto'
                        }}></div>
                        <p style={{ fontSize: '0.875rem', color: COLORS.textPrimary, marginTop: '0.5rem' }}>
                            Extracting transactions from bank statement PDF...
                        </p>
                    </div>
                )}

                {/* Bank PDF Upload Result */}
                {bankPdfResult && !bankPdfProcessing && !bankPdfResult.pendingDuplicateCheck && (
                    <div style={{
                        marginTop: '1.5rem',
                        padding: '1rem',
                        backgroundColor: bankPdfResult.success > 0 ? `${COLORS.incomeColor}20` : `${COLORS.expenseColor}20`,
                        borderRadius: '0.5rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                            {bankPdfResult.success > 0 ? (
                                <CheckCircle style={{ height: '1.25rem', width: '1.25rem', color: COLORS.incomeColor, marginRight: '0.5rem' }} />
                            ) : (
                                <AlertTriangle style={{ height: '1.25rem', width: '1.25rem', color: COLORS.expenseColor, marginRight: '0.5rem' }} />
                            )}
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: COLORS.textPrimary }}>
                                {bankPdfResult.success > 0 ? 'Bank Statement PDF Processed' : 'Error Processing PDF'}
                            </span>
                        </div>
                        {bankPdfResult.success > 0 ? (
                            <>
                                <p style={{ fontSize: '0.875rem', color: COLORS.textPrimary }}>
                                    {bankPdfResult.transactionCount} transactions extracted from {bankPdfResult.bank === 'boi' ? 'Bank of Ireland' : bankPdfResult.bank} statement
                                </p>
                                <p style={{ fontSize: '0.875rem', color: COLORS.textPrimary }}>
                                    {bankPdfResult.categorized} categorized, {bankPdfResult.unidentified} need review
                                </p>
                            </>
                        ) : (
                            <p style={{ fontSize: '0.875rem', color: COLORS.expenseColor }}>
                                {bankPdfResult.errorMessage || 'Could not extract transactions from PDF'}
                            </p>
                        )}
                    </div>
                )}

                {/* Success message */}
                {selectedFile && !isProcessing && uploadResult && (
                    <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: `${COLORS.incomeColor}20`, borderRadius: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <CheckCircle style={{ height: '1.25rem', width: '1.25rem', color: COLORS.incomeColor, marginRight: '0.5rem' }} />
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: COLORS.textPrimary }}>
                                Processed {selectedFile.name}
                            </span>
                        </div>
                        {uploadResult.type === 'training' ? (
                            <p style={{ fontSize: '0.875rem', color: COLORS.textPrimary }}>
                                {uploadResult.categorized} pre-categorized transactions imported
                            </p>
                        ) : (
                            <>
                                <p style={{ fontSize: '0.875rem', color: COLORS.textPrimary, marginBottom: '0.75rem' }}>
                                    {uploadResult.categorized} categorized, {uploadResult.unidentified} need review
                                    {uploadResult.skippedDuplicates > 0 && (
                                        <span style={{ color: COLORS.textSecondary }}>
                                            {' '}({uploadResult.skippedDuplicates} duplicates skipped)
                                        </span>
                                    )}
                                </p>
                                {uploadResult.unidentified > 0 && (
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setShowAISuggestions(true)}
                                            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium text-white"
                                            style={{ backgroundColor: COLORS.slainteBlue }}
                                        >
                                            <Brain className="h-4 w-4" />
                                            AI Staff Suggestions
                                        </button>
                                        <button
                                            onClick={() => setShowExpenseCategorization(true)}
                                            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium border-2"
                                            style={{ borderColor: COLORS.slainteBlue, color: COLORS.slainteBlue }}
                                        >
                                            <Activity className="h-4 w-4" />
                                            AI Expense Patterns
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* PCRS Upload Result */}
                {pcrsUploadResult && !pcrsProcessing && (
                    <div style={{
                        marginTop: '1.5rem',
                        padding: '1rem',
                        backgroundColor: pcrsUploadResult.success > 0 ? `${COLORS.incomeColor}20` : `${COLORS.expenseColor}20`,
                        borderRadius: '0.5rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <CheckCircle style={{
                                height: '1.25rem',
                                width: '1.25rem',
                                color: pcrsUploadResult.success > 0 ? COLORS.incomeColor : COLORS.expenseColor,
                                marginRight: '0.5rem'
                            }} />
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: COLORS.textPrimary }}>
                                PCRS PDF Processing Complete
                            </span>
                        </div>
                        <p style={{ fontSize: '0.875rem', color: COLORS.textPrimary }}>
                            {pcrsUploadResult.success} uploaded successfully
                            {pcrsUploadResult.error > 0 && `, ${pcrsUploadResult.error} failed`}
                        </p>
                        {pcrsUploadResult.success > 0 && (
                            <p style={{ fontSize: '0.75rem', color: COLORS.textSecondary, marginTop: '0.5rem' }}>
                                View extracted data in GMS Panel Analysis tab
                            </p>
                        )}
                    </div>
                )}

                {/* PCRS Processing indicator */}
                {pcrsProcessing && (
                    <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: `${COLORS.expenseColor}15`, borderRadius: '0.5rem', textAlign: 'center' }}>
                        <div style={{
                            animation: 'spin 1s linear infinite',
                            borderRadius: '9999px',
                            height: '2rem',
                            width: '2rem',
                            border: `2px solid ${COLORS.expenseColor}`,
                            borderTopColor: 'transparent',
                            margin: '0 auto'
                        }}></div>
                        <p style={{ fontSize: '0.875rem', color: COLORS.textPrimary, marginTop: '0.5rem' }}>
                            Processing PCRS payment PDFs...
                        </p>
                    </div>
                )}
            </div>

            {/* AI Identifier Suggestions Modal */}
            {showAISuggestions && (
                <AIIdentifierSuggestions onClose={() => setShowAISuggestions(false)} />
            )}

            {/* AI Expense Categorization Modal */}
            {showExpenseCategorization && (
                <AIExpenseCategorization onClose={() => setShowExpenseCategorization(false)} />
            )}

            {/* Duplicate Detection Modal */}
            {showDuplicateModal && duplicateInfo && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: COLORS.overlayDark,
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
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                            <div style={{
                                backgroundColor: `${COLORS.highlightYellow}20`,
                                borderRadius: '50%',
                                padding: '0.5rem'
                            }}>
                                <AlertTriangle style={{ width: '1.5rem', height: '1.5rem', color: COLORS.highlightYellow }} />
                            </div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: COLORS.textPrimary, margin: 0 }}>
                                Duplicate Transactions Detected
                            </h3>
                        </div>

                        {/* Summary */}
                        <div style={{
                            backgroundColor: COLORS.bgPage,
                            borderRadius: '0.5rem',
                            padding: '1rem',
                            marginBottom: '1rem'
                        }}>
                            <p style={{ fontSize: '0.875rem', color: COLORS.textPrimary, margin: 0 }}>
                                <strong>{duplicateInfo.duplicateCount}</strong> of {duplicateInfo.totalCount} transactions appear to already exist in your data.
                            </p>
                            {duplicateInfo.uniqueCount > 0 && (
                                <p style={{ fontSize: '0.875rem', color: COLORS.textSecondary, margin: '0.5rem 0 0 0' }}>
                                    {duplicateInfo.uniqueCount} new transactions can be added.
                                </p>
                            )}
                        </div>

                        {/* Sample duplicates */}
                        {duplicateInfo.sampleDuplicates && duplicateInfo.sampleDuplicates.length > 0 && (
                            <div style={{ marginBottom: '1rem' }}>
                                <p style={{ fontSize: '0.75rem', fontWeight: 500, color: COLORS.textSecondary, marginBottom: '0.5rem' }}>
                                    Example duplicates:
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {duplicateInfo.sampleDuplicates.map((t, i) => (
                                        <div key={i} style={{
                                            fontSize: '0.75rem',
                                            color: COLORS.textPrimary,
                                            backgroundColor: COLORS.white,
                                            border: `1px solid ${COLORS.borderLight}`,
                                            borderRadius: '0.25rem',
                                            padding: '0.5rem'
                                        }}>
                                            <div style={{ fontWeight: 500 }}>
                                                {new Date(t.date).toLocaleDateString()} - €{(t.debit || t.credit || 0).toFixed(2)}
                                            </div>
                                            <div style={{ color: COLORS.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {t.details}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Actions */}
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
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                <CheckCircle style={{ width: '1rem', height: '1rem' }} />
                                Skip Duplicates ({duplicateInfo.uniqueCount} new will be added)
                            </button>

                            <button
                                onClick={() => handleDuplicateResolution('add')}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem 1rem',
                                    backgroundColor: 'transparent',
                                    color: COLORS.textPrimary,
                                    border: `1px solid ${COLORS.borderLight}`,
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
                                    setPendingUpload(null);
                                    setIsProcessing(false);
                                    setSelectedFile(null);
                                }}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem 1rem',
                                    backgroundColor: 'transparent',
                                    color: COLORS.textSecondary,
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
        </div>
    );
}
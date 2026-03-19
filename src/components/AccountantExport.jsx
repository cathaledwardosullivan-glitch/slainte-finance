import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import COLORS from '../utils/colors';
import { Download, FileText, Table, FileSpreadsheet, File, CheckCircle, AlertCircle, ChevronDown, Package } from 'lucide-react';
import {
    buildSimpleTransactionsCSV,
    buildDetailedTransactionsCSV,
    buildPCRSSummaryCSV,
    buildPaymentOverviewCSV,
    buildPLReportCSV,
    buildAndDownloadAccountantPackZIP,
    downloadBlob
} from '../utils/exportUtils';

export default function AccountantExport({ onClose }) {
    const {
        transactions,
        paymentAnalysisData,
        selectedYear,
        categoryMapping
    } = useAppContext();

    const [exportYear, setExportYear] = useState(selectedYear);
    const [exporting, setExporting] = useState(false);
    const [exportStatus, setExportStatus] = useState({});

    // Get available years from transactions
    const availableYears = useMemo(() => {
        const years = new Set();
        transactions.forEach(t => {
            if (t.date) {
                years.add(new Date(t.date).getFullYear());
            }
        });
        paymentAnalysisData.forEach(p => {
            if (p.year) {
                years.add(parseInt(p.year));
            }
        });
        return Array.from(years).sort((a, b) => b - a);
    }, [transactions, paymentAnalysisData]);

    // Filter transactions by year
    const yearTransactions = useMemo(() => {
        return transactions.filter(t => {
            if (!t.date) return false;
            return new Date(t.date).getFullYear() === exportYear;
        });
    }, [transactions, exportYear]);

    // Filter PCRS data by year
    const yearPCRSData = useMemo(() => {
        return paymentAnalysisData.filter(p => parseInt(p.year) === exportYear);
    }, [paymentAnalysisData, exportYear]);

    // Export 1: Transactions with Simple Categories
    const exportSimpleTransactions = () => {
        const { content, filename } = buildSimpleTransactionsCSV(yearTransactions, exportYear);
        downloadBlob(content, filename, 'text/csv');
        setExportStatus(prev => ({ ...prev, simple: 'success' }));
    };

    // Export 2: Transactions with Detailed Categories
    const exportDetailedTransactions = () => {
        const { content, filename } = buildDetailedTransactionsCSV(yearTransactions, exportYear);
        downloadBlob(content, filename, 'text/csv');
        setExportStatus(prev => ({ ...prev, detailed: 'success' }));
    };

    // Export 3: PCRS Payment Summary
    const exportPCRSData = () => {
        if (yearPCRSData.length === 0) {
            setExportStatus(prev => ({ ...prev, pcrs: 'empty' }));
            return;
        }
        const { content, filename } = buildPCRSSummaryCSV(yearPCRSData, exportYear);
        downloadBlob(content, filename, 'text/csv');
        setExportStatus(prev => ({ ...prev, pcrs: 'success' }));
    };

    // Export 4: Payment Overview Table (GMS Panel Analysis)
    const exportPaymentOverview = () => {
        if (yearPCRSData.length === 0) {
            setExportStatus(prev => ({ ...prev, overview: 'empty' }));
            return;
        }
        const { content, filename } = buildPaymentOverviewCSV(yearPCRSData, exportYear);
        downloadBlob(content, filename, 'text/csv');
        setExportStatus(prev => ({ ...prev, overview: 'success' }));
    };

    // Export 5: P&L Report Draft
    const exportPLReport = () => {
        const { content, filename } = buildPLReportCSV(yearTransactions, exportYear);
        downloadBlob(content, filename, 'text/csv');
        setExportStatus(prev => ({ ...prev, pl: 'success' }));
    };

    // Export All as ZIP
    const exportAllAsZip = async () => {
        setExporting(true);
        setExportStatus({});
        try {
            await buildAndDownloadAccountantPackZIP(yearTransactions, yearPCRSData, exportYear);
            setExportStatus({ all: 'success' });
        } catch (error) {
            console.error('Error creating ZIP:', error);
            setExportStatus({ all: 'error' });
        } finally {
            setExporting(false);
        }
    };

    // Status icon helper
    const StatusIcon = ({ status }) => {
        if (status === 'success') return <CheckCircle className="h-4 w-4 text-green-600" />;
        if (status === 'empty') return <AlertCircle className="h-4 w-4 text-yellow-600" />;
        if (status === 'error') return <AlertCircle className="h-4 w-4 text-red-600" />;
        return null;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: COLORS.textPrimary }}>
                        <FileText className="h-5 w-5" style={{ color: COLORS.slainteBlue }} />
                        Export Data for Accountant
                    </h3>
                    <p className="text-sm mt-1" style={{ color: COLORS.textSecondary }}>
                        Prepare and export financial data for your practice accountant
                    </p>
                </div>
            </div>

            {/* Year Selection */}
            <div className="p-4 rounded-lg" style={{ backgroundColor: COLORS.bgPage }}>
                <label className="block text-sm font-medium mb-2" style={{ color: COLORS.textPrimary }}>
                    Select Financial Year
                </label>
                <select
                    value={exportYear}
                    onChange={(e) => {
                        setExportYear(parseInt(e.target.value));
                        setExportStatus({});
                    }}
                    className="w-full md:w-48 p-2 border rounded-lg"
                    style={{ borderColor: COLORS.borderLight }}
                >
                    {availableYears.map(year => (
                        <option key={year} value={year}>{year}</option>
                    ))}
                </select>
                <p className="text-xs mt-2" style={{ color: COLORS.textSecondary }}>
                    {yearTransactions.length} transactions | {yearPCRSData.length} PCRS records for {exportYear}
                </p>
            </div>

            {/* Export Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Simple Transactions */}
                <div className="p-4 border rounded-lg" style={{ borderColor: COLORS.borderLight }}>
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <FileSpreadsheet className="h-5 w-5" style={{ color: COLORS.incomeColor }} />
                            <h4 className="font-medium" style={{ color: COLORS.textPrimary }}>Transactions (Simple)</h4>
                        </div>
                        <StatusIcon status={exportStatus.simple} />
                    </div>
                    <p className="text-sm mb-3" style={{ color: COLORS.textSecondary }}>
                        All transactions with simplified category labels (Income, Staff Costs, Premises, etc.)
                    </p>
                    <button
                        onClick={exportSimpleTransactions}
                        disabled={yearTransactions.length === 0}
                        className="w-full px-4 py-2 rounded text-sm font-medium text-white flex items-center justify-center gap-2"
                        style={{
                            backgroundColor: yearTransactions.length > 0 ? COLORS.incomeColor : COLORS.borderLight,
                            cursor: yearTransactions.length > 0 ? 'pointer' : 'not-allowed'
                        }}
                    >
                        <Download className="h-4 w-4" />
                        Export CSV
                    </button>
                </div>

                {/* 2. Detailed Transactions */}
                <div className="p-4 border rounded-lg" style={{ borderColor: COLORS.borderLight }}>
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Table className="h-5 w-5" style={{ color: COLORS.slainteBlue }} />
                            <h4 className="font-medium" style={{ color: COLORS.textPrimary }}>Transactions (Detailed)</h4>
                        </div>
                        <StatusIcon status={exportStatus.detailed} />
                    </div>
                    <p className="text-sm mb-3" style={{ color: COLORS.textSecondary }}>
                        Full categorisation with type, group, category, and P&L line mappings
                    </p>
                    <button
                        onClick={exportDetailedTransactions}
                        disabled={yearTransactions.length === 0}
                        className="w-full px-4 py-2 rounded text-sm font-medium text-white flex items-center justify-center gap-2"
                        style={{
                            backgroundColor: yearTransactions.length > 0 ? COLORS.slainteBlue : COLORS.borderLight,
                            cursor: yearTransactions.length > 0 ? 'pointer' : 'not-allowed'
                        }}
                    >
                        <Download className="h-4 w-4" />
                        Export CSV
                    </button>
                </div>

                {/* 3. PCRS Summary */}
                <div className="p-4 border rounded-lg" style={{ borderColor: COLORS.borderLight }}>
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <File className="h-5 w-5" style={{ color: COLORS.accentPurple }} />
                            <h4 className="font-medium" style={{ color: COLORS.textPrimary }}>PCRS Payment Summary</h4>
                        </div>
                        <StatusIcon status={exportStatus.pcrs} />
                    </div>
                    <p className="text-sm mb-3" style={{ color: COLORS.textSecondary }}>
                        Summary of all PCRS payments with category breakdown
                    </p>
                    <button
                        onClick={exportPCRSData}
                        disabled={yearPCRSData.length === 0}
                        className="w-full px-4 py-2 rounded text-sm font-medium text-white flex items-center justify-center gap-2"
                        style={{
                            backgroundColor: yearPCRSData.length > 0 ? COLORS.accentPurple : COLORS.borderLight,
                            cursor: yearPCRSData.length > 0 ? 'pointer' : 'not-allowed'
                        }}
                    >
                        <Download className="h-4 w-4" />
                        {yearPCRSData.length > 0 ? 'Export CSV' : 'No PCRS Data'}
                    </button>
                </div>

                {/* 4. Payment Overview */}
                <div className="p-4 border rounded-lg" style={{ borderColor: COLORS.borderLight }}>
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Table className="h-5 w-5" style={{ color: COLORS.highlightYellow }} />
                            <h4 className="font-medium" style={{ color: COLORS.textPrimary }}>Payment Overview</h4>
                        </div>
                        <StatusIcon status={exportStatus.overview} />
                    </div>
                    <p className="text-sm mb-3" style={{ color: COLORS.textSecondary }}>
                        Monthly breakdown of GMS payments by category (from Panel Analysis)
                    </p>
                    <button
                        onClick={exportPaymentOverview}
                        disabled={yearPCRSData.length === 0}
                        className="w-full px-4 py-2 rounded text-sm font-medium flex items-center justify-center gap-2"
                        style={{
                            backgroundColor: yearPCRSData.length > 0 ? COLORS.highlightYellow : COLORS.borderLight,
                            color: yearPCRSData.length > 0 ? COLORS.textPrimary : COLORS.white,
                            cursor: yearPCRSData.length > 0 ? 'pointer' : 'not-allowed'
                        }}
                    >
                        <Download className="h-4 w-4" />
                        {yearPCRSData.length > 0 ? 'Export CSV' : 'No Payment Data'}
                    </button>
                </div>

                {/* 5. P&L Report Draft */}
                <div className="p-4 border rounded-lg md:col-span-2" style={{ borderColor: COLORS.borderLight }}>
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5" style={{ color: COLORS.expenseColor }} />
                            <h4 className="font-medium" style={{ color: COLORS.textPrimary }}>P&L Report Draft</h4>
                        </div>
                        <StatusIcon status={exportStatus.pl} />
                    </div>
                    <p className="text-sm mb-3" style={{ color: COLORS.textSecondary }}>
                        Draft Profit & Loss statement with income and expense totals by category
                    </p>
                    <button
                        onClick={exportPLReport}
                        disabled={yearTransactions.length === 0}
                        className="w-full md:w-auto px-6 py-2 rounded text-sm font-medium text-white flex items-center justify-center gap-2"
                        style={{
                            backgroundColor: yearTransactions.length > 0 ? COLORS.expenseColor : COLORS.borderLight,
                            cursor: yearTransactions.length > 0 ? 'pointer' : 'not-allowed'
                        }}
                    >
                        <Download className="h-4 w-4" />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Export All Button */}
            <div className="p-4 rounded-lg border-2" style={{ borderColor: COLORS.slainteBlue, backgroundColor: `${COLORS.slainteBlue}10` }}>
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Package className="h-5 w-5" style={{ color: COLORS.slainteBlue }} />
                            <h4 className="font-semibold" style={{ color: COLORS.slainteBlue }}>Export Complete Pack</h4>
                            {exportStatus.all === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
                        </div>
                        <p className="text-sm" style={{ color: COLORS.textSecondary }}>
                            Download all exports as a single ZIP file - ready to share with your accountant
                        </p>
                    </div>
                    <button
                        onClick={exportAllAsZip}
                        disabled={exporting || yearTransactions.length === 0}
                        className="px-6 py-3 rounded-lg text-sm font-semibold text-white flex items-center gap-2"
                        style={{
                            backgroundColor: (exporting || yearTransactions.length === 0) ? COLORS.borderLight : COLORS.slainteBlue,
                            cursor: (exporting || yearTransactions.length === 0) ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {exporting ? (
                            <>
                                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                Creating ZIP...
                            </>
                        ) : (
                            <>
                                <Download className="h-5 w-5" />
                                Download All as ZIP
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Help Text */}
            <div className="text-xs p-3 rounded-lg" style={{ backgroundColor: COLORS.bgPage, color: COLORS.textSecondary }}>
                <strong>Note:</strong> These exports are drafts for review with your accountant.
                The P&L report may need adjustments for items like depreciation, motor expenses (business use %),
                and other accountant-specific calculations.
            </div>
        </div>
    );
}

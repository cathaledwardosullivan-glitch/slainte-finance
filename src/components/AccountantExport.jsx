import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import COLORS from '../utils/colors';
import { Download, FileText, Table, FileSpreadsheet, File, CheckCircle, AlertCircle, ChevronDown, Package } from 'lucide-react';
import { PCRS_PAYMENT_CATEGORIES } from '../data/paymentCategories';
import JSZip from 'jszip';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Accountant-friendly category labels (simplified from detailed internal categories)
const SIMPLE_CATEGORY_MAP = {
    // Income
    'income': 'Income',
    // Expenses - simplified groupings
    'Staff Costs': 'Staff Costs',
    'Medical Supplies': 'Medical Supplies',
    'Premises Costs': 'Premises Costs',
    'Office & IT': 'Office & Administration',
    'Professional Services': 'Professional Services',
    'Motor Expenses': 'Motor Expenses',
    'Capital Items': 'Capital Items',
    'Other Expenses': 'Other Expenses'
};

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

    // Get simple category label for a transaction
    const getSimpleCategoryLabel = (transaction) => {
        if (!transaction.category) return 'Uncategorised';

        const cat = transaction.category;
        if (cat.type === 'income') return 'Income';

        // Map section to simple label
        const section = cat.section || '';
        if (section.includes('STAFF') || section.includes('Staff')) return 'Staff Costs';
        if (section.includes('MEDICAL') || section.includes('Medical')) return 'Medical Supplies';
        if (section.includes('PREMISES') || section.includes('Premises')) return 'Premises Costs';
        if (section.includes('OFFICE') || section.includes('Office') || section.includes('IT')) return 'Office & Administration';
        if (section.includes('PROFESSIONAL') || section.includes('Professional')) return 'Professional Services';
        if (section.includes('MOTOR') || section.includes('Motor')) return 'Motor Expenses';
        if (section.includes('CAPITAL') || section.includes('Capital')) return 'Capital Items';

        return 'Other Expenses';
    };

    // Format date for CSV
    const formatDate = (date) => {
        if (!date) return '';
        const d = new Date(date);
        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    };

    // Format currency
    const formatCurrency = (amount) => {
        return (amount || 0).toFixed(2);
    };

    // Export 1: Transactions with Simple Categories
    const exportSimpleTransactions = () => {
        const csvRows = [
            ['Date', 'Description', 'Debit', 'Credit', 'Category']
        ];

        yearTransactions
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .forEach(t => {
                csvRows.push([
                    formatDate(t.date),
                    `"${(t.details || '').replace(/"/g, '""')}"`,
                    formatCurrency(t.debit),
                    formatCurrency(t.credit),
                    getSimpleCategoryLabel(t)
                ]);
            });

        const csvContent = csvRows.map(row => row.join(',')).join('\n');
        downloadFile(csvContent, `transactions-simple-${exportYear}.csv`, 'text/csv');
        setExportStatus(prev => ({ ...prev, simple: 'success' }));
    };

    // Export 2: Transactions with Detailed Categories
    const exportDetailedTransactions = () => {
        const csvRows = [
            ['Date', 'Description', 'Debit', 'Credit', 'Category Code', 'Category Name', 'Category Section', 'Accountant Line', 'Type']
        ];

        yearTransactions
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .forEach(t => {
                const cat = t.category || {};
                csvRows.push([
                    formatDate(t.date),
                    `"${(t.details || '').replace(/"/g, '""')}"`,
                    formatCurrency(t.debit),
                    formatCurrency(t.credit),
                    cat.code || '',
                    `"${(cat.name || 'Uncategorised').replace(/"/g, '""')}"`,
                    `"${(cat.section || '').replace(/"/g, '""')}"`,
                    `"${(cat.accountantLine || '').replace(/"/g, '""')}"`,
                    cat.type || ''
                ]);
            });

        const csvContent = csvRows.map(row => row.join(',')).join('\n');
        downloadFile(csvContent, `transactions-detailed-${exportYear}.csv`, 'text/csv');
        setExportStatus(prev => ({ ...prev, detailed: 'success' }));
    };

    // Export 3: PCRS PDFs as ZIP (metadata + instructions)
    const exportPCRSData = async () => {
        if (yearPCRSData.length === 0) {
            setExportStatus(prev => ({ ...prev, pcrs: 'empty' }));
            return;
        }

        // Create a summary CSV of all PCRS payments
        const csvRows = [
            ['Month', 'Doctor', 'Doctor Number', 'Payment Date', 'Gross Payment', 'Withholding Tax', 'Net Payment', 'Panel Size']
        ];

        yearPCRSData.forEach(p => {
            csvRows.push([
                p.month || '',
                `"${(p.doctor || '').replace(/"/g, '""')}"`,
                p.doctorNumber || '',
                p.paymentDate || '',
                formatCurrency(p.totalGrossPayment),
                formatCurrency(p.deductions?.['Less withholding Tax'] || 0),
                formatCurrency((p.totalGrossPayment || 0) - Object.values(p.deductions || {}).reduce((a, b) => a + b, 0)),
                p.panelSize || ''
            ]);
        });

        // Add detailed breakdown
        csvRows.push([]);
        csvRows.push(['--- Payment Category Breakdown ---']);
        csvRows.push(['Category', ...yearPCRSData.map(p => p.month || 'Unknown')]);

        PCRS_PAYMENT_CATEGORIES.forEach(category => {
            const row = [
                `"${category}"`,
                ...yearPCRSData.map(p => formatCurrency(p.payments?.[category] || 0))
            ];
            csvRows.push(row);
        });

        const csvContent = csvRows.map(row => row.join(',')).join('\n');
        downloadFile(csvContent, `pcrs-summary-${exportYear}.csv`, 'text/csv');
        setExportStatus(prev => ({ ...prev, pcrs: 'success' }));
    };

    // Export 4: Payment Overview Table (GMS Panel Analysis)
    const exportPaymentOverview = () => {
        if (yearPCRSData.length === 0) {
            setExportStatus(prev => ({ ...prev, overview: 'empty' }));
            return;
        }

        // Generate summary table like PaymentAnalysis component
        const summary = {};
        PCRS_PAYMENT_CATEGORIES.forEach(category => {
            summary[category] = { TOTAL: 0 };
            MONTHS.forEach(month => {
                summary[category][month] = 0;
            });
        });

        yearPCRSData.forEach(record => {
            const month = record.month;
            if (!month) return;

            PCRS_PAYMENT_CATEGORIES.forEach(category => {
                const amount = record.payments?.[category] || 0;
                summary[category][month] = (summary[category][month] || 0) + amount;
                summary[category].TOTAL = (summary[category].TOTAL || 0) + amount;
            });
        });

        // Build CSV
        let csvContent = `Payment Category,TOTAL,${MONTHS.join(',')}\n`;

        PCRS_PAYMENT_CATEGORIES.forEach(category => {
            const row = [
                `"${category}"`,
                formatCurrency(summary[category].TOTAL),
                ...MONTHS.map(month => formatCurrency(summary[category][month]))
            ];
            csvContent += row.join(',') + '\n';
        });

        // Add totals row
        const monthTotals = MONTHS.map(month =>
            PCRS_PAYMENT_CATEGORIES.reduce((sum, cat) => sum + (summary[cat][month] || 0), 0)
        );
        const grandTotal = PCRS_PAYMENT_CATEGORIES.reduce((sum, cat) => sum + (summary[cat].TOTAL || 0), 0);
        csvContent += `"TOTAL",${formatCurrency(grandTotal)},${monthTotals.map(t => formatCurrency(t)).join(',')}\n`;

        downloadFile(csvContent, `payment-overview-${exportYear}.csv`, 'text/csv');
        setExportStatus(prev => ({ ...prev, overview: 'success' }));
    };

    // Export 5: P&L Report Draft
    const exportPLReport = () => {
        // Process transactions into P&L format
        const income = {};
        const expenses = {};

        yearTransactions.forEach(t => {
            const cat = t.category;
            if (!cat) return;

            const accountantLine = cat.accountantLine || cat.name || 'Other';
            const amount = Math.abs(t.debit || t.credit || t.amount || 0);

            if (cat.type === 'income') {
                income[accountantLine] = (income[accountantLine] || 0) + amount;
            } else if (cat.type === 'expense') {
                expenses[accountantLine] = (expenses[accountantLine] || 0) + amount;
            }
        });

        // Build report content
        const totalIncome = Object.values(income).reduce((a, b) => a + b, 0);
        const totalExpenses = Object.values(expenses).reduce((a, b) => a + b, 0);
        const netProfit = totalIncome - totalExpenses;

        let csvContent = `P&L Report Draft - ${exportYear}\n`;
        csvContent += `Generated: ${new Date().toLocaleDateString()}\n\n`;

        csvContent += `INCOME\n`;
        csvContent += `Category,Amount\n`;
        Object.entries(income)
            .sort((a, b) => b[1] - a[1])
            .forEach(([cat, amount]) => {
                csvContent += `"${cat}",${formatCurrency(amount)}\n`;
            });
        csvContent += `"TOTAL INCOME",${formatCurrency(totalIncome)}\n\n`;

        csvContent += `EXPENSES\n`;
        csvContent += `Category,Amount\n`;
        Object.entries(expenses)
            .sort((a, b) => b[1] - a[1])
            .forEach(([cat, amount]) => {
                csvContent += `"${cat}",${formatCurrency(amount)}\n`;
            });
        csvContent += `"TOTAL EXPENSES",${formatCurrency(totalExpenses)}\n\n`;

        csvContent += `SUMMARY\n`;
        csvContent += `"Total Income",${formatCurrency(totalIncome)}\n`;
        csvContent += `"Total Expenses",${formatCurrency(totalExpenses)}\n`;
        csvContent += `"Net Profit/(Loss)",${formatCurrency(netProfit)}\n`;

        downloadFile(csvContent, `pl-report-draft-${exportYear}.csv`, 'text/csv');
        setExportStatus(prev => ({ ...prev, pl: 'success' }));
    };

    // Export All as ZIP
    const exportAllAsZip = async () => {
        setExporting(true);
        setExportStatus({});

        try {
            const zip = new JSZip();
            const folder = zip.folder(`accountant-pack-${exportYear}`);

            // 1. Simple transactions
            const simpleRows = [['Date', 'Description', 'Debit', 'Credit', 'Category']];
            yearTransactions.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(t => {
                simpleRows.push([
                    formatDate(t.date),
                    `"${(t.details || '').replace(/"/g, '""')}"`,
                    formatCurrency(t.debit),
                    formatCurrency(t.credit),
                    getSimpleCategoryLabel(t)
                ]);
            });
            folder.file(`transactions-simple-${exportYear}.csv`, simpleRows.map(r => r.join(',')).join('\n'));

            // 2. Detailed transactions
            const detailedRows = [['Date', 'Description', 'Debit', 'Credit', 'Category Code', 'Category Name', 'Category Section', 'Accountant Line', 'Type']];
            yearTransactions.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(t => {
                const cat = t.category || {};
                detailedRows.push([
                    formatDate(t.date),
                    `"${(t.details || '').replace(/"/g, '""')}"`,
                    formatCurrency(t.debit),
                    formatCurrency(t.credit),
                    cat.code || '',
                    `"${(cat.name || 'Uncategorised').replace(/"/g, '""')}"`,
                    `"${(cat.section || '').replace(/"/g, '""')}"`,
                    `"${(cat.accountantLine || '').replace(/"/g, '""')}"`,
                    cat.type || ''
                ]);
            });
            folder.file(`transactions-detailed-${exportYear}.csv`, detailedRows.map(r => r.join(',')).join('\n'));

            // 3. PCRS Summary
            if (yearPCRSData.length > 0) {
                const pcrsRows = [['Month', 'Doctor', 'Doctor Number', 'Payment Date', 'Gross Payment', 'Withholding Tax', 'Net Payment', 'Panel Size']];
                yearPCRSData.forEach(p => {
                    pcrsRows.push([
                        p.month || '',
                        `"${(p.doctor || '').replace(/"/g, '""')}"`,
                        p.doctorNumber || '',
                        p.paymentDate || '',
                        formatCurrency(p.totalGrossPayment),
                        formatCurrency(p.deductions?.['Less withholding Tax'] || 0),
                        formatCurrency((p.totalGrossPayment || 0) - Object.values(p.deductions || {}).reduce((a, b) => a + b, 0)),
                        p.panelSize || ''
                    ]);
                });
                folder.file(`pcrs-summary-${exportYear}.csv`, pcrsRows.map(r => r.join(',')).join('\n'));

                // 4. Payment Overview
                const summary = {};
                PCRS_PAYMENT_CATEGORIES.forEach(category => {
                    summary[category] = { TOTAL: 0 };
                    MONTHS.forEach(month => { summary[category][month] = 0; });
                });
                yearPCRSData.forEach(record => {
                    const month = record.month;
                    if (!month) return;
                    PCRS_PAYMENT_CATEGORIES.forEach(category => {
                        const amount = record.payments?.[category] || 0;
                        summary[category][month] = (summary[category][month] || 0) + amount;
                        summary[category].TOTAL = (summary[category].TOTAL || 0) + amount;
                    });
                });
                let overviewCSV = `Payment Category,TOTAL,${MONTHS.join(',')}\n`;
                PCRS_PAYMENT_CATEGORIES.forEach(category => {
                    overviewCSV += `"${category}",${formatCurrency(summary[category].TOTAL)},${MONTHS.map(m => formatCurrency(summary[category][m])).join(',')}\n`;
                });
                folder.file(`payment-overview-${exportYear}.csv`, overviewCSV);
            }

            // 5. P&L Draft
            const income = {};
            const expenses = {};
            yearTransactions.forEach(t => {
                const cat = t.category;
                if (!cat) return;
                const accountantLine = cat.accountantLine || cat.name || 'Other';
                const amount = Math.abs(t.debit || t.credit || t.amount || 0);
                if (cat.type === 'income') {
                    income[accountantLine] = (income[accountantLine] || 0) + amount;
                } else if (cat.type === 'expense') {
                    expenses[accountantLine] = (expenses[accountantLine] || 0) + amount;
                }
            });
            const totalIncome = Object.values(income).reduce((a, b) => a + b, 0);
            const totalExpenses = Object.values(expenses).reduce((a, b) => a + b, 0);
            let plContent = `P&L Report Draft - ${exportYear}\nGenerated: ${new Date().toLocaleDateString()}\n\n`;
            plContent += `INCOME\nCategory,Amount\n`;
            Object.entries(income).sort((a, b) => b[1] - a[1]).forEach(([cat, amt]) => {
                plContent += `"${cat}",${formatCurrency(amt)}\n`;
            });
            plContent += `"TOTAL INCOME",${formatCurrency(totalIncome)}\n\n`;
            plContent += `EXPENSES\nCategory,Amount\n`;
            Object.entries(expenses).sort((a, b) => b[1] - a[1]).forEach(([cat, amt]) => {
                plContent += `"${cat}",${formatCurrency(amt)}\n`;
            });
            plContent += `"TOTAL EXPENSES",${formatCurrency(totalExpenses)}\n\n`;
            plContent += `SUMMARY\n"Total Income",${formatCurrency(totalIncome)}\n"Total Expenses",${formatCurrency(totalExpenses)}\n"Net Profit/(Loss)",${formatCurrency(totalIncome - totalExpenses)}\n`;
            folder.file(`pl-report-draft-${exportYear}.csv`, plContent);

            // Add README
            const readme = `Accountant Export Pack - ${exportYear}
Generated: ${new Date().toLocaleString()}

Contents:
1. transactions-simple-${exportYear}.csv - All transactions with simplified category labels
2. transactions-detailed-${exportYear}.csv - All transactions with full categorisation details
3. pcrs-summary-${exportYear}.csv - PCRS payment summaries (if available)
4. payment-overview-${exportYear}.csv - Monthly payment breakdown by category (if available)
5. pl-report-draft-${exportYear}.csv - Draft P&L report

Notes:
- All amounts are in EUR
- Dates are in DD/MM/YYYY format
- This is a draft export - please review with your accountant

Generated by Slainte Finance
`;
            folder.file('README.txt', readme);

            // Generate and download ZIP
            const content = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(content);
            const link = document.createElement('a');
            link.href = url;
            link.download = `accountant-pack-${exportYear}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            setExportStatus({ all: 'success' });
        } catch (error) {
            console.error('Error creating ZIP:', error);
            setExportStatus({ all: 'error' });
        } finally {
            setExporting(false);
        }
    };

    // Helper to download a file
    const downloadFile = (content, filename, mimeType) => {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
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
                    <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: COLORS.darkGray }}>
                        <FileText className="h-5 w-5" style={{ color: COLORS.slainteBlue }} />
                        Export Data for Accountant
                    </h3>
                    <p className="text-sm mt-1" style={{ color: COLORS.mediumGray }}>
                        Prepare and export financial data for your practice accountant
                    </p>
                </div>
            </div>

            {/* Year Selection */}
            <div className="p-4 rounded-lg" style={{ backgroundColor: COLORS.backgroundGray }}>
                <label className="block text-sm font-medium mb-2" style={{ color: COLORS.darkGray }}>
                    Select Financial Year
                </label>
                <select
                    value={exportYear}
                    onChange={(e) => {
                        setExportYear(parseInt(e.target.value));
                        setExportStatus({});
                    }}
                    className="w-full md:w-48 p-2 border rounded-lg"
                    style={{ borderColor: COLORS.lightGray }}
                >
                    {availableYears.map(year => (
                        <option key={year} value={year}>{year}</option>
                    ))}
                </select>
                <p className="text-xs mt-2" style={{ color: COLORS.mediumGray }}>
                    {yearTransactions.length} transactions | {yearPCRSData.length} PCRS records for {exportYear}
                </p>
            </div>

            {/* Export Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Simple Transactions */}
                <div className="p-4 border rounded-lg" style={{ borderColor: COLORS.lightGray }}>
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <FileSpreadsheet className="h-5 w-5" style={{ color: COLORS.incomeColor }} />
                            <h4 className="font-medium" style={{ color: COLORS.darkGray }}>Transactions (Simple)</h4>
                        </div>
                        <StatusIcon status={exportStatus.simple} />
                    </div>
                    <p className="text-sm mb-3" style={{ color: COLORS.mediumGray }}>
                        All transactions with simplified category labels (Income, Staff Costs, Premises, etc.)
                    </p>
                    <button
                        onClick={exportSimpleTransactions}
                        disabled={yearTransactions.length === 0}
                        className="w-full px-4 py-2 rounded text-sm font-medium text-white flex items-center justify-center gap-2"
                        style={{
                            backgroundColor: yearTransactions.length > 0 ? COLORS.incomeColor : COLORS.lightGray,
                            cursor: yearTransactions.length > 0 ? 'pointer' : 'not-allowed'
                        }}
                    >
                        <Download className="h-4 w-4" />
                        Export CSV
                    </button>
                </div>

                {/* 2. Detailed Transactions */}
                <div className="p-4 border rounded-lg" style={{ borderColor: COLORS.lightGray }}>
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Table className="h-5 w-5" style={{ color: COLORS.slainteBlue }} />
                            <h4 className="font-medium" style={{ color: COLORS.darkGray }}>Transactions (Detailed)</h4>
                        </div>
                        <StatusIcon status={exportStatus.detailed} />
                    </div>
                    <p className="text-sm mb-3" style={{ color: COLORS.mediumGray }}>
                        Full categorisation with codes, sections, and accountant line mappings
                    </p>
                    <button
                        onClick={exportDetailedTransactions}
                        disabled={yearTransactions.length === 0}
                        className="w-full px-4 py-2 rounded text-sm font-medium text-white flex items-center justify-center gap-2"
                        style={{
                            backgroundColor: yearTransactions.length > 0 ? COLORS.slainteBlue : COLORS.lightGray,
                            cursor: yearTransactions.length > 0 ? 'pointer' : 'not-allowed'
                        }}
                    >
                        <Download className="h-4 w-4" />
                        Export CSV
                    </button>
                </div>

                {/* 3. PCRS Summary */}
                <div className="p-4 border rounded-lg" style={{ borderColor: COLORS.lightGray }}>
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <File className="h-5 w-5" style={{ color: '#9333EA' }} />
                            <h4 className="font-medium" style={{ color: COLORS.darkGray }}>PCRS Payment Summary</h4>
                        </div>
                        <StatusIcon status={exportStatus.pcrs} />
                    </div>
                    <p className="text-sm mb-3" style={{ color: COLORS.mediumGray }}>
                        Summary of all PCRS payments with category breakdown
                    </p>
                    <button
                        onClick={exportPCRSData}
                        disabled={yearPCRSData.length === 0}
                        className="w-full px-4 py-2 rounded text-sm font-medium text-white flex items-center justify-center gap-2"
                        style={{
                            backgroundColor: yearPCRSData.length > 0 ? '#9333EA' : COLORS.lightGray,
                            cursor: yearPCRSData.length > 0 ? 'pointer' : 'not-allowed'
                        }}
                    >
                        <Download className="h-4 w-4" />
                        {yearPCRSData.length > 0 ? 'Export CSV' : 'No PCRS Data'}
                    </button>
                </div>

                {/* 4. Payment Overview */}
                <div className="p-4 border rounded-lg" style={{ borderColor: COLORS.lightGray }}>
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Table className="h-5 w-5" style={{ color: COLORS.highlightYellow }} />
                            <h4 className="font-medium" style={{ color: COLORS.darkGray }}>Payment Overview</h4>
                        </div>
                        <StatusIcon status={exportStatus.overview} />
                    </div>
                    <p className="text-sm mb-3" style={{ color: COLORS.mediumGray }}>
                        Monthly breakdown of GMS payments by category (from Panel Analysis)
                    </p>
                    <button
                        onClick={exportPaymentOverview}
                        disabled={yearPCRSData.length === 0}
                        className="w-full px-4 py-2 rounded text-sm font-medium flex items-center justify-center gap-2"
                        style={{
                            backgroundColor: yearPCRSData.length > 0 ? COLORS.highlightYellow : COLORS.lightGray,
                            color: yearPCRSData.length > 0 ? COLORS.darkGray : COLORS.white,
                            cursor: yearPCRSData.length > 0 ? 'pointer' : 'not-allowed'
                        }}
                    >
                        <Download className="h-4 w-4" />
                        {yearPCRSData.length > 0 ? 'Export CSV' : 'No Payment Data'}
                    </button>
                </div>

                {/* 5. P&L Report Draft */}
                <div className="p-4 border rounded-lg md:col-span-2" style={{ borderColor: COLORS.lightGray }}>
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5" style={{ color: COLORS.expenseColor }} />
                            <h4 className="font-medium" style={{ color: COLORS.darkGray }}>P&L Report Draft</h4>
                        </div>
                        <StatusIcon status={exportStatus.pl} />
                    </div>
                    <p className="text-sm mb-3" style={{ color: COLORS.mediumGray }}>
                        Draft Profit & Loss statement with income and expense totals by category
                    </p>
                    <button
                        onClick={exportPLReport}
                        disabled={yearTransactions.length === 0}
                        className="w-full md:w-auto px-6 py-2 rounded text-sm font-medium text-white flex items-center justify-center gap-2"
                        style={{
                            backgroundColor: yearTransactions.length > 0 ? COLORS.expenseColor : COLORS.lightGray,
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
                        <p className="text-sm" style={{ color: COLORS.mediumGray }}>
                            Download all exports as a single ZIP file - ready to share with your accountant
                        </p>
                    </div>
                    <button
                        onClick={exportAllAsZip}
                        disabled={exporting || yearTransactions.length === 0}
                        className="px-6 py-3 rounded-lg text-sm font-semibold text-white flex items-center gap-2"
                        style={{
                            backgroundColor: (exporting || yearTransactions.length === 0) ? COLORS.lightGray : COLORS.slainteBlue,
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
            <div className="text-xs p-3 rounded-lg" style={{ backgroundColor: COLORS.backgroundGray, color: COLORS.mediumGray }}>
                <strong>Note:</strong> These exports are drafts for review with your accountant.
                The P&L report may need adjustments for items like depreciation, motor expenses (business use %),
                and other accountant-specific calculations.
            </div>
        </div>
    );
}

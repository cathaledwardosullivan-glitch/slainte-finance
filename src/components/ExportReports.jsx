import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import COLORS from '../utils/colors';
import { calculateWithholdingTax } from '../utils/financialCalculations';
// ... other imports
import {
    Download, Upload, FileText, Calculator, X, Car, Building,
    Trash2, Eye, EyeOff, AlertCircle, CheckCircle
} from 'lucide-react';
import Papa from 'papaparse';

const ExportReports = () => {
    const {
        transactions,
        unidentifiedTransactions,
        selectedYear,
        setSelectedYear,
        paymentAnalysisData
    } = useAppContext();

    const saveGeneratedReport = (reportData) => {
        const savedReports = JSON.parse(localStorage.getItem('gp_finance_saved_reports') || '[]');

        const newReport = {
            id: `report-${Date.now()}`,
            title: `${reportData.type} - ${reportData.year} vs ${reportData.year - 1}`,
            type: reportData.type, // 'P&L', 'YTD-P&L', etc.
            generatedDate: new Date().toISOString(),
            year: reportData.year,
            data: reportData // Store the full report data
        };

        savedReports.push(newReport);

        // Keep only last 20 reports
        if (savedReports.length > 20) {
            savedReports.shift();
        }

        localStorage.setItem('gp_finance_saved_reports', JSON.stringify(savedReports));
        return newReport.id;
    };
    // P&L Converter State
    const [plData, setPLData] = useState(null);
    const [showReportModal, setShowReportModal] = useState(false);
    const [showMotorCalculator, setShowMotorCalculator] = useState(false);
    const [showDepreciationCalculator, setShowDepreciationCalculator] = useState(false);
    const [motorExpenses, setMotorExpenses] = useState({
        [selectedYear]: 0,
        [selectedYear - 1]: 0
    });
    const [depreciationExpenses, setDepreciationExpenses] = useState({
        [selectedYear]: 0,
        [selectedYear - 1]: 0
    });
    const [processing, setProcessing] = useState(false);
    const [practiceName, setPracticeName] = useState('GP Practice Partnership');
    const [withholdingTaxData, setWithholdingTaxData] = useState({ total: 0, gmsWithholdingTax: 0, stateContractTax: 0 });

    // Load practice name on mount
    useEffect(() => {
        try {
            const profileData = localStorage.getItem('slainte_practice_profile');
            if (profileData) {
                const profile = JSON.parse(profileData);
                setPracticeName(profile.practiceDetails?.practiceName || 'GP Practice Partnership');
            }
        } catch (error) {
            console.log('Could not load practice name, using default');
        }
    }, []);

    // Calculate withholding tax when data changes
    useEffect(() => {
        if (transactions && transactions.length > 0) {
            const wtData = calculateWithholdingTax(transactions, selectedYear, false, paymentAnalysisData);
            setWithholdingTaxData(wtData);
        }
    }, [transactions, selectedYear, paymentAnalysisData]);

    /**
     * Calculate GROSS income for P&L Report
     *
     * This function calculates income at GROSS values (before deductions) for proper P&L reporting:
     * - GMS Income: Uses GROSS from PCRS PDFs (not NET from bank)
     * - State Contracts: Grosses up bank amounts (NET ÷ 0.80) since 20% withholding is deducted
     * - Other Income: Uses bank amounts directly (no deductions at source)
     *
     * Also extracts withholding tax and superannuation for footnotes.
     * These go to Partner's Capital Accounts, not P&L expenses.
     */
    const calculateGrossPLIncome = (year, periodInfo = null) => {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // === GMS INCOME (from PCRS PDFs - already GROSS) ===
        const gmsPaymentsForYear = (paymentAnalysisData || []).filter(p => {
            if (!p.paymentDate) return false;
            const paymentYear = new Date(p.paymentDate).getFullYear();
            return paymentYear === year;
        });

        // Sum gross GMS payments
        const gmsGross = gmsPaymentsForYear.reduce((sum, p) => sum + (p.totalGrossPayment || 0), 0);

        // Extract superannuation from deductions (all types)
        const gmsSuperannuation = gmsPaymentsForYear.reduce((sum, p) => {
            if (!p.deductions) return sum;
            return sum + Object.entries(p.deductions)
                .filter(([key]) => key.toLowerCase().includes('superannuation'))
                .reduce((s, [_, val]) => s + (val || 0), 0);
        }, 0);

        // Extract withholding tax from practice summary (deduplicate by month)
        const processedMonths = new Set();
        const gmsWithholding = gmsPaymentsForYear.reduce((sum, p) => {
            if (!p.practiceSummary?.withholdingTax) return sum;
            const monthKey = p.paymentDate ? new Date(p.paymentDate).toISOString().slice(0, 7) : null;
            if (monthKey && !processedMonths.has(monthKey)) {
                processedMonths.add(monthKey);
                return sum + p.practiceSummary.withholdingTax;
            }
            return sum;
        }, 0);

        // Check GMS data completeness
        const monthsWithPayments = new Set(gmsPaymentsForYear.map(p =>
            p.paymentDate ? new Date(p.paymentDate).getMonth() : -1
        ).filter(m => m >= 0));
        const gmsMonthsFound = monthsWithPayments.size;
        const gmsMissingMonths = [];
        for (let m = 0; m < 12; m++) {
            if (!monthsWithPayments.has(m)) {
                gmsMissingMonths.push(monthNames[m]);
            }
        }

        // === TRANSACTION-BASED INCOME ===
        // Filter transactions for the year (respecting partial year cutoff if applicable)
        const yearTransactions = transactions.filter(t => {
            if (!t.date) return false;
            const txDate = new Date(t.date);
            const txYear = txDate.getFullYear();
            if (txYear !== year) return false;

            // For partial year reports, respect the cutoff date
            if (periodInfo?.isPartialYear && periodInfo?.cutoffDate) {
                const yearCutoff = new Date(year, periodInfo.cutoffDate.getMonth(), periodInfo.cutoffDate.getDate());
                if (txDate > yearCutoff) return false;
            }
            return true;
        });

        // Identify category names that should be excluded from "other income"
        // because we're using PCRS gross instead of bank NET
        const pcrsCategories = ['PCRS Payments', 'PCRS', 'GMS Income'];
        const stateContractCategories = ['State Contracts'];

        // STATE CONTRACTS: Gross up from bank (NET ÷ 0.80)
        const stateContractsNet = yearTransactions
            .filter(t => t.category?.type === 'income' &&
                stateContractCategories.some(cat =>
                    t.category?.name?.toLowerCase().includes(cat.toLowerCase())
                ))
            .reduce((sum, t) => sum + (t.credit || t.amount || 0), 0);

        const stateContractsGross = stateContractsNet / 0.80;
        const stateContractsWithholding = stateContractsGross - stateContractsNet;

        // OTHER INCOME: All income EXCEPT PCRS and State Contracts
        const otherIncome = yearTransactions
            .filter(t => {
                if (t.category?.type !== 'income') return false;
                const catName = t.category?.name || '';
                // Exclude PCRS (using PCRS gross instead)
                if (pcrsCategories.some(cat => catName.toLowerCase().includes(cat.toLowerCase()))) return false;
                // Exclude State Contracts (using grossed up amount instead)
                if (stateContractCategories.some(cat => catName.toLowerCase().includes(cat.toLowerCase()))) return false;
                return true;
            })
            .reduce((sum, t) => sum + (t.credit || t.amount || 0), 0);

        // NET PCRS from bank (for comparison/validation - not used in P&L)
        const pcrsNetFromBank = yearTransactions
            .filter(t => t.category?.type === 'income' &&
                pcrsCategories.some(cat =>
                    t.category?.name?.toLowerCase().includes(cat.toLowerCase())
                ))
            .reduce((sum, t) => sum + (t.credit || t.amount || 0), 0);

        // === TOTALS ===
        const totalGrossIncome = gmsGross + stateContractsGross + otherIncome;
        const totalWithholding = gmsWithholding + stateContractsWithholding;
        const totalSuperannuation = gmsSuperannuation;

        return {
            // GMS (from PCRS)
            gmsGross,
            gmsSuperannuation,
            gmsWithholding,
            gmsMonthsFound,
            gmsMissingMonths,
            gmsComplete: gmsMonthsFound >= 12,

            // State Contracts (grossed up)
            stateContractsNet,
            stateContractsGross,
            stateContractsWithholding,

            // Other income (no adjustment)
            otherIncome,

            // For reference/validation
            pcrsNetFromBank,

            // Totals
            totalGrossIncome,
            totalWithholding,
            totalSuperannuation,

            // Has PCRS data?
            hasPCRSData: gmsPaymentsForYear.length > 0
        };
    };

    // Get available years from transaction data
    const getAvailableYears = () => {
        const years = new Set();
        transactions.forEach(t => {
            if (t.date) {
                years.add(new Date(t.date).getFullYear());
            }
        });
        return Array.from(years).sort((a, b) => b - a);
    };

    // Get the latest transaction date and determine if this is a partial year report
    const getReportPeriodInfo = () => {
        if (transactions.length === 0) return { isPartialYear: false, cutoffDate: null, reportType: 'Full Year' };

        // Find latest transaction date in selected year
        const currentYearTransactions = transactions.filter(t =>
            new Date(t.date).getFullYear() === selectedYear
        );

        if (currentYearTransactions.length === 0) return { isPartialYear: false, cutoffDate: null, reportType: 'Full Year' };

        const latestTransaction = currentYearTransactions.reduce((latest, transaction) => {
            const transactionDate = new Date(transaction.date);
            return transactionDate > new Date(latest.date) ? transaction : latest;
        });

        const latestDate = new Date(latestTransaction.date);
        const december25 = new Date(selectedYear, 11, 25); // December 25th of selected year

        const isPartialYear = latestDate < december25;

        return {
            isPartialYear,
            cutoffDate: isPartialYear ? latestDate : null,
            reportType: isPartialYear ? 'Year to Date' : 'Full Year',
            cutoffDateString: isPartialYear ? latestDate.toLocaleDateString('en-GB') : null
        };
    };

    const reportPeriod = getReportPeriodInfo();
    const availableYears = getAvailableYears();

    // Accountant mapping from standalone converter
    const accountantMapping = {
        'Fee income': ['01', '02', '03', '04', '05', '06', '07', '08', '09'],
        'Receptionists Salaries and Social Welfare': ['10', '12', '13', '14', '15', '16', '17', '18', '19'],
        'Medical Locums': ['11'],
        'Surgical supplies/drugs etc': ['50', '51', '53', '54', '55', '56', '59'],
        'Rent payable': ['38'],
        'Rates': ['31'],
        'Traders combined insurance': ['34'],
        'Professional indemnity insurance': ['40'],
        'Computer costs': ['60', '62', '63', '64', '69'],
        'Light and heat': ['32', '33'],
        'Cleaning': ['37'],
        'Repairs and maintenance': ['36'],
        'Printing postage and stationery': ['71', '73', '74'],
        'Telephone': ['61'],
        'Bank charges': ['20'],
        'Motor expenses': ['35', '84'],
        'Professional fees': ['39'],
        'Subscriptions and Courses': ['41', '42', '49'],
        'Sundry expenses': []
    };

    // Currency formatter
    const formatCurrency = (amount) => {
        if (amount === 0 || amount === null || amount === undefined) return '€0.00';
        return new Intl.NumberFormat('en-IE', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2
        }).format(Math.abs(amount));
    };

    // Extract category code from transaction
    const extractCategoryCode = (category) => {
        if (!category) return null;
        if (typeof category === 'string') {
            const match = category.match(/^(\d{2})/);
            return match ? match[1] : null;
        }
        if (category.code) return category.code;
        return null;
    };

    // Process transactions for P&L format
    const processTransactionsForPL = () => {
        if (transactions.length === 0) {
            alert('No transaction data available. Please upload transactions first.');
            return;
        }

        setProcessing(true);
        setPLData(null); // Reset while processing

        // Small delay to show processing state
        setTimeout(() => {
            const currentYear = selectedYear;
            const previousYear = selectedYear - 1;
            const period = getReportPeriodInfo();

            const plResult = {
                income: { [currentYear]: {}, [previousYear]: {} },
                expenses: { [currentYear]: {}, [previousYear]: {} },
                reportPeriod: period,
                // Store gross income data for footnotes
                grossIncomeData: { [currentYear]: null, [previousYear]: null }
            };

            // Initialize all categories with 0
            Object.keys(accountantMapping).forEach(category => {
                plResult.income[currentYear][category] = 0;
                plResult.income[previousYear][category] = 0;
                plResult.expenses[currentYear][category] = 0;
                plResult.expenses[previousYear][category] = 0;
            });

            // === GROSS INCOME CALCULATION ===
            // Calculate GROSS income for P&L (not NET from bank)
            // This uses PCRS gross for GMS and grosses up State Contracts
            const grossIncomeCurrentYear = calculateGrossPLIncome(currentYear, period);
            const grossIncomePreviousYear = calculateGrossPLIncome(previousYear, period);

            // Store for footnotes and reference
            plResult.grossIncomeData[currentYear] = grossIncomeCurrentYear;
            plResult.grossIncomeData[previousYear] = grossIncomePreviousYear;

            // Set gross income as "Fee income" (the accountant's category for all practice income)
            plResult.income[currentYear]['Fee income'] = grossIncomeCurrentYear.totalGrossIncome;
            plResult.income[previousYear]['Fee income'] = grossIncomePreviousYear.totalGrossIncome;

            console.log('Gross P&L Income calculated:', {
                currentYear: {
                    gmsGross: grossIncomeCurrentYear.gmsGross,
                    stateContractsGross: grossIncomeCurrentYear.stateContractsGross,
                    otherIncome: grossIncomeCurrentYear.otherIncome,
                    totalGrossIncome: grossIncomeCurrentYear.totalGrossIncome,
                    gmsComplete: grossIncomeCurrentYear.gmsComplete,
                    withholdingTotal: grossIncomeCurrentYear.totalWithholding,
                    superannuationTotal: grossIncomeCurrentYear.totalSuperannuation
                },
                previousYear: {
                    totalGrossIncome: grossIncomePreviousYear.totalGrossIncome
                }
            });

            // Debug: Log first few transactions to understand structure (remove in production)
            console.log('Processing transactions for P&L (expenses only - income uses gross calculations)...');
            console.log('Total transactions:', transactions.length);
            console.log('Report period:', period);

            let processedCount = 0;
            let skippedCount = 0;

            // Process transactions
            transactions.forEach((transaction, index) => {
                const transactionDate = new Date(transaction.date);
                const year = transactionDate.getFullYear();

                if (year !== currentYear && year !== previousYear) {
                    skippedCount++;
                    return;
                }

                // For partial year reports, only include transactions up to the cutoff date for both years
                if (period.isPartialYear && period.cutoffDate) {
                    const yearCutoff = new Date(year, period.cutoffDate.getMonth(), period.cutoffDate.getDate());
                    if (transactionDate > yearCutoff) {
                        skippedCount++;
                        return;
                    }
                }

                const categoryCode = extractCategoryCode(transaction.category);
                if (!categoryCode) {
                    skippedCount++;
                    return;
                }

                // Calculate amount - handle both debit and credit
                let amount = 0;
                if (transaction.debit && parseFloat(transaction.debit) > 0) {
                    amount = parseFloat(transaction.debit);
                } else if (transaction.credit && parseFloat(transaction.credit) > 0) {
                    amount = parseFloat(transaction.credit);
                }

                if (amount === 0) {
                    skippedCount++;
                    return;
                }

                // Get type from category.type, not transaction.type
                const type = transaction.category?.type || transaction.type;

                // Get accountant line directly from category (instead of old code mapping)
                let accountantCategory = transaction.category?.accountantLine || 'Sundry expenses';

                // Add to appropriate section
                // NOTE: Income is now calculated separately using GROSS values (calculateGrossPLIncome)
                // So we only process EXPENSES from transactions here
                if (type === 'expense') {
                    // Initialize to 0 if doesn't exist (for accountantLine values not in old mapping)
                    plResult.expenses[year][accountantCategory] = (plResult.expenses[year][accountantCategory] || 0) + amount;
                    processedCount++;
                }
                // Skip income (handled by gross income calculation) and drawings (don't go on P&L)
            });

            // Add manual expenses (don't prorate these as they're manually calculated)
            if (motorExpenses[currentYear] > 0) {
                plResult.expenses[currentYear]['Motor expenses'] += motorExpenses[currentYear];
            }
            if (motorExpenses[previousYear] > 0) {
                plResult.expenses[previousYear]['Motor expenses'] += motorExpenses[previousYear];
            }
            if (depreciationExpenses[currentYear] > 0) {
                plResult.expenses[currentYear]['Depreciation'] =
                    (plResult.expenses[currentYear]['Depreciation'] || 0) + depreciationExpenses[currentYear];
            }
            if (depreciationExpenses[previousYear] > 0) {
                plResult.expenses[previousYear]['Depreciation'] =
                    (plResult.expenses[previousYear]['Depreciation'] || 0) + depreciationExpenses[previousYear];
            }

            console.log('P&L processing complete:', {
                totalTransactions: transactions.length,
                processedCount,
                skippedCount
            });

            // Show alert if no data was processed
            if (processedCount === 0) {
                alert(`No transactions were processed for P&L. 
        
Debug info:
- Total transactions: ${transactions.length}
- Transactions for ${currentYear}: ${transactions.filter(t => new Date(t.date).getFullYear() === currentYear).length}
- Transactions for ${previousYear}: ${transactions.filter(t => new Date(t.date).getFullYear() === previousYear).length}

Check console for detailed debugging information.`);
            }

            // After setPLData(plResult) in processTransactionsForPL:
            setPLData(plResult);
            setShowReportModal(true);
            setProcessing(false);

            // Auto-save all reports to library (no confirmation needed)
            const totalIncome = {
                [currentYear]: Object.values(plResult.income[currentYear]).reduce((sum, val) => sum + val, 0),
                [currentYear - 1]: Object.values(plResult.income[currentYear - 1]).reduce((sum, val) => sum + val, 0)
            };

            const totalExpenses = {
                [currentYear]: Object.values(plResult.expenses[currentYear]).filter(v => !isNaN(v)).reduce((sum, val) => sum + val, 0),
                [currentYear - 1]: Object.values(plResult.expenses[currentYear - 1]).filter(v => !isNaN(v)).reduce((sum, val) => sum + val, 0)
            };

            const netProfit = {
                [currentYear]: totalIncome[currentYear] - totalExpenses[currentYear],
                [currentYear - 1]: totalIncome[currentYear - 1] - totalExpenses[currentYear - 1]
            };

            const reportTitle = period.isPartialYear ? 'Year to Date Profit & Loss Statement' : 'Profit and Loss Account';
            const periodDescription = period.isPartialYear
                ? `For the period 1st January to ${period.cutoffDateString} for ${currentYear} and ${currentYear - 1}`
                : `For the years ended 31st December ${currentYear} and ${currentYear - 1}`;

            // Get practice name from profile
            let practiceName = 'GP Practice Partnership';
            try {
                const profileData = localStorage.getItem('slainte_practice_profile');
                if (profileData) {
                    const profile = JSON.parse(profileData);
                    practiceName = profile.practiceDetails?.practiceName || 'GP Practice Partnership';
                }
            } catch (error) {
                console.log('Could not load practice name, using default');
            }

            // Calculate GMS payment status for this report
            const gmsPaymentsForYear = paymentAnalysisData?.filter(p => {
                const paymentYear = new Date(p.paymentDate).getFullYear();
                return paymentYear === currentYear;
            }) || [];
            const gmsMonthsFound = new Set(gmsPaymentsForYear.map(p => new Date(p.paymentDate).getMonth())).size;
            const gmsComplete = gmsMonthsFound === 12;
            const gmsMissingMonths = [];
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            if (!gmsComplete) {
                const monthsWithPayments = new Set(gmsPaymentsForYear.map(p => new Date(p.paymentDate).getMonth()));
                for (let m = 0; m < 12; m++) {
                    if (!monthsWithPayments.has(m)) {
                        gmsMissingMonths.push(monthNames[m]);
                    }
                }
            }

            // Generate HTML content
            const reportHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GP Practice - ${reportTitle}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; font-size: 11px; }
        .header { text-align: center; margin-bottom: 30px; position: relative; }
        .draft-badge {
            display: inline-block;
            background-color: #ff6b6b;
            color: white;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: bold;
            margin-left: 10px;
            vertical-align: middle;
        }
        .pl-table { width: 100%; border-collapse: collapse; }
        .pl-table th, .pl-table td { border: 1px solid #ddd; padding: 6px; text-align: left; }
        .pl-table th { background-color: #f5f5f5; font-weight: bold; }
        .amount { text-align: right; font-family: monospace; }
        .total-line { border-top: 2px solid #000; font-weight: bold; }
        .section-header { background-color: #e6f3ff; font-weight: bold; }
        .notes { margin-top: 30px; padding: 15px; background-color: #fff9e6; border-left: 4px solid #ffc107; }
        .notes h4 { margin: 0 0 10px 0; color: #856404; }
        .notes ul { margin: 5px 0; padding-left: 20px; }
        .notes li { margin: 5px 0; color: #856404; }
        .notes .important { font-weight: bold; color: #d32f2f; }
        @media print { body { margin: 10px; } }
    </style>
</head>
<body>
    <div class="header">
        <h2>${practiceName}</h2>
        <h3>${reportTitle}<span class="draft-badge">DRAFT</span></h3>
        <p>${periodDescription}</p>
    </div>
    
    <table class="pl-table">
        <thead>
            <tr>
                <th style="width: 60%;">Description</th>
                <th style="width: 20%;" class="amount">${currentYear} €</th>
                <th style="width: 20%;" class="amount">${currentYear - 1} €</th>
            </tr>
        </thead>
        <tbody>
            <tr class="section-header">
                <td><strong>INCOME</strong></td>
                <td class="amount"></td>
                <td class="amount"></td>
            </tr>
            <tr>
                <td>Fee income</td>
                <td class="amount">${formatCurrency(plResult.income[currentYear]['Fee income'])}</td>
                <td class="amount">${formatCurrency(plResult.income[currentYear - 1]['Fee income'])}</td>
            </tr>
            <tr class="total-line">
                <td><strong>Total Income</strong></td>
                <td class="amount"><strong>${formatCurrency(totalIncome[currentYear])}</strong></td>
                <td class="amount"><strong>${formatCurrency(totalIncome[currentYear - 1])}</strong></td>
            </tr>
            
            <tr class="section-header">
                <td><strong>EXPENDITURE</strong></td>
                <td class="amount"></td>
                <td class="amount"></td>
            </tr>
            ${Object.entries(plResult.expenses[currentYear])
                        .filter(([_, amount]) => amount > 0)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([category, amount]) =>
                            `<tr>
                        <td>${category}</td>
                        <td class="amount">${formatCurrency(amount)}</td>
                        <td class="amount">${formatCurrency(plResult.expenses[currentYear - 1][category] || 0)}</td>
                    </tr>`
                        ).join('')}
            
            <tr class="total-line">
                <td><strong>Total Expenditure</strong></td>
                <td class="amount"><strong>(${formatCurrency(totalExpenses[currentYear])})</strong></td>
                <td class="amount"><strong>(${formatCurrency(totalExpenses[currentYear - 1])})</strong></td>
            </tr>
            
            <tr class="total-line" style="background-color: #e6f3ff;">
                <td><strong>Net Divisible Profit</strong></td>
                <td class="amount"><strong>${formatCurrency(netProfit[currentYear])}</strong></td>
                <td class="amount"><strong>${formatCurrency(netProfit[currentYear - 1])}</strong></td>
            </tr>
        </tbody>
    </table>

    <div class="notes">
        <h4>⚠️ DRAFT REPORT - Important Notes:</h4>
        <p class="important">This report is a DRAFT and should not be used for official submissions without review by a qualified accountant.</p>
        <ul>
            <li><strong>GMS Statements:</strong> ${gmsComplete ? `✓ All 12 months of GMS statements uploaded for ${currentYear}` : gmsMonthsFound > 0 ? `⚠ ${gmsMonthsFound}/12 months of GMS statements uploaded. Missing: ${gmsMissingMonths.join(', ')}` : `✗ No GMS statements uploaded for ${currentYear} - withholding tax cannot be calculated`}</li>
            <li><strong>Income Figure:</strong> This represents NET INCOME as recorded in bank transactions (after withholding tax deduction). ${withholdingTaxData.total > 0 ? `Withholding tax has been calculated: €${withholdingTaxData.total.toLocaleString()} (GMS: €${withholdingTaxData.gmsWithholdingTax.toLocaleString()}, State Contracts: €${withholdingTaxData.stateContractTax.toLocaleString()}). Add this to Net Income to calculate GROSS income for tax purposes.` : 'To calculate GROSS income for tax purposes, withholding tax amounts must be gathered from 12 months of PCRS statements and added back to this figure.'}</li>
            <li><strong>Withholding Tax:</strong> ${withholdingTaxData.total > 0 ? `✓ Calculated from PCRS statements: €${withholdingTaxData.total.toLocaleString()} total for ${currentYear}` : '✗ NOT calculated - Upload PCRS GMS panel statements to calculate withholding tax automatically'}</li>
            <li><strong>Motor Expenses:</strong> ${motorExpenses[currentYear] > 0 || motorExpenses[currentYear - 1] > 0 ? `✓ Calculated and included (${currentYear}: €${motorExpenses[currentYear].toFixed(2)}, ${currentYear - 1}: €${motorExpenses[currentYear - 1].toFixed(2)})` : '○ NOT calculated - Use the Motor Expenses Calculator for mileage claims'}</li>
            <li><strong>Depreciation:</strong> ${depreciationExpenses[currentYear] > 0 || depreciationExpenses[currentYear - 1] > 0 ? `✓ Calculated and included (${currentYear}: €${depreciationExpenses[currentYear].toFixed(2)}, ${currentYear - 1}: €${depreciationExpenses[currentYear - 1].toFixed(2)})` : '○ NOT calculated - Use the Depreciation Calculator for capital allowances'}</li>
            <li><strong>Classification:</strong> Some transactions may be partially classified or unclassified. Review the transaction list for accuracy.</li>
            <li><strong>Period:</strong> ${period.isPartialYear ? `This is a YEAR-TO-DATE report covering transactions up to ${period.cutoffDateString}. Full year figures will differ.` : 'This report covers full calendar years.'}</li>
        </ul>
        <p style="margin-top: 10px; font-style: italic;">Please review all figures with your accountant before using for tax returns or official purposes.</p>
    </div>

    <div style="margin-top: 30px; font-size: 10px; color: #666;">
        Generated on ${new Date().toLocaleDateString('en-IE')} by sl[Ai]nte.Finance
    </div>
</body>
</html>`;

            // Save to localStorage
            const savedReports = JSON.parse(localStorage.getItem('gp_finance_saved_reports') || '[]');
            const newReport = {
                id: `report-${Date.now()}`,
                title: `${period.isPartialYear ? 'YTD' : 'Full Year'} P&L - ${currentYear} vs ${currentYear - 1}`,
                generatedDate: new Date().toISOString(),
                year: currentYear,
                htmlContent: reportHTML
            };

            savedReports.push(newReport);
            if (savedReports.length > 20) savedReports.shift();

            localStorage.setItem('gp_finance_saved_reports', JSON.stringify(savedReports));
            console.log('✓ Report automatically saved to library');
        }, 500);
    };

    // Optional: Auto-generate P&L when manual expenses change (but not on initial load)
    useEffect(() => {
        if (plData && (motorExpenses[selectedYear] > 0 || depreciationExpenses[selectedYear] > 0)) {
            processTransactionsForPL();
        }
    }, [motorExpenses, depreciationExpenses]);

    // Export functions
    const exportAccountantPDF = () => {
        if (!plData) return;

        const totalIncome = {
            [selectedYear]: Object.values(plData.income[selectedYear]).reduce((sum, val) => sum + val, 0),
            [selectedYear - 1]: Object.values(plData.income[selectedYear - 1]).reduce((sum, val) => sum + val, 0)
        };

        const totalExpenses = {
            [selectedYear]: Object.values(plData.expenses[selectedYear]).filter(v => !isNaN(v)).reduce((sum, val) => sum + val, 0),
            [selectedYear - 1]: Object.values(plData.expenses[selectedYear - 1]).filter(v => !isNaN(v)).reduce((sum, val) => sum + val, 0)
        };

        const netProfit = {
            [selectedYear]: totalIncome[selectedYear] - totalExpenses[selectedYear],
            [selectedYear - 1]: totalIncome[selectedYear - 1] - totalExpenses[selectedYear - 1]
        };

        // Calculate GMS payment status for print report
        const gmsPaymentsForYear = paymentAnalysisData?.filter(p => {
            const paymentYear = new Date(p.paymentDate).getFullYear();
            return paymentYear === selectedYear;
        }) || [];
        const gmsMonthsFound = new Set(gmsPaymentsForYear.map(p => new Date(p.paymentDate).getMonth())).size;
        const gmsComplete = gmsMonthsFound === 12;
        const gmsMissingMonths = [];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        if (!gmsComplete) {
            const monthsWithPayments = new Set(gmsPaymentsForYear.map(p => new Date(p.paymentDate).getMonth()));
            for (let m = 0; m < 12; m++) {
                if (!monthsWithPayments.has(m)) {
                    gmsMissingMonths.push(monthNames[m]);
                }
            }
        }

        const reportTitle = plData.reportPeriod?.isPartialYear ? 'Year to Date Profit & Loss Statement' : 'Profit and Loss Account';
        const periodDescription = plData.reportPeriod?.isPartialYear
            ? `For the period 1st January to ${plData.reportPeriod.cutoffDateString} for ${selectedYear} and ${selectedYear - 1}`
            : `For the years ended 31st December ${selectedYear} and ${selectedYear - 1}`;

        const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <title>GP Practice - ${reportTitle}</title>
          <style>
              body { font-family: Arial, sans-serif; margin: 20px; font-size: 11px; }
              .header { text-align: center; margin-bottom: 30px; position: relative; }
              .draft-badge {
                  display: inline-block;
                  background-color: #ff6b6b;
                  color: white;
                  padding: 4px 12px;
                  border-radius: 4px;
                  font-size: 10px;
                  font-weight: bold;
                  margin-left: 10px;
                  vertical-align: middle;
              }
              .pl-table { width: 100%; border-collapse: collapse; }
              .pl-table th, .pl-table td { border: 1px solid #ddd; padding: 6px; text-align: left; }
              .pl-table th { background-color: #f5f5f5; font-weight: bold; }
              .amount { text-align: right; font-family: monospace; }
              .total-line { border-top: 2px solid #000; font-weight: bold; }
              .section-header { background-color: #e6f3ff; font-weight: bold; }
              .notes { margin-top: 30px; padding: 15px; background-color: #fff9e6; border-left: 4px solid #ffc107; }
              .notes h4 { margin: 0 0 10px 0; color: #856404; }
              .notes ul { margin: 5px 0; padding-left: 20px; }
              .notes li { margin: 5px 0; color: #856404; }
              .notes .important { font-weight: bold; color: #d32f2f; }
          </style>
      </head>
      <body>
          <div class="header">
              <h2>${practiceName}</h2>
              <h3>${reportTitle}<span class="draft-badge">DRAFT</span></h3>
              <p>${periodDescription}</p>
          </div>
          
          <table class="pl-table">
              <thead>
                  <tr>
                      <th style="width: 60%;">Description</th>
                      <th style="width: 20%;" class="amount">${selectedYear} €</th>
                      <th style="width: 20%;" class="amount">${selectedYear - 1} €</th>
                  </tr>
              </thead>
              <tbody>
                  <tr class="section-header">
                      <td><strong>INCOME</strong></td>
                      <td class="amount"></td>
                      <td class="amount"></td>
                  </tr>
                  <tr>
                      <td>Fee income</td>
                      <td class="amount">${formatCurrency(plData.income[selectedYear]['Fee income'])}</td>
                      <td class="amount">${formatCurrency(plData.income[selectedYear - 1]['Fee income'])}</td>
                  </tr>
                  <tr class="total-line">
                      <td><strong>Total Income</strong></td>
                      <td class="amount"><strong>${formatCurrency(totalIncome[selectedYear])}</strong></td>
                      <td class="amount"><strong>${formatCurrency(totalIncome[selectedYear - 1])}</strong></td>
                  </tr>
                  
                  <tr class="section-header">
                      <td><strong>EXPENDITURE</strong></td>
                      <td class="amount"></td>
                      <td class="amount"></td>
                  </tr>
                  ${Object.entries(plData.expenses[selectedYear])
                .filter(([_, amount]) => amount > 0)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([category, amount]) =>
                    `<tr>
                          <td>${category}</td>
                          <td class="amount">${formatCurrency(amount)}</td>
                          <td class="amount">${formatCurrency(plData.expenses[selectedYear - 1][category] || 0)}</td>
                      </tr>`
                ).join('')}
                  
                  <tr class="total-line">
                      <td><strong>Total Expenditure</strong></td>
                      <td class="amount"><strong>(${formatCurrency(totalExpenses[selectedYear])})</strong></td>
                      <td class="amount"><strong>(${formatCurrency(totalExpenses[selectedYear - 1])})</strong></td>
                  </tr>
                  
                  <tr class="total-line" style="background-color: #f0f8ff;">
                      <td><strong>Profit before appropriation</strong></td>
                      <td class="amount"><strong>${formatCurrency(netProfit[selectedYear])}</strong></td>
                      <td class="amount"><strong>${formatCurrency(netProfit[selectedYear - 1])}</strong></td>
                  </tr>
                  
                  <tr class="total-line" style="background-color: #e6f3ff;">
                      <td><strong>Net Divisible Profit</strong></td>
                      <td class="amount"><strong>${formatCurrency(netProfit[selectedYear])}</strong></td>
                      <td class="amount"><strong>${formatCurrency(netProfit[selectedYear - 1])}</strong></td>
                  </tr>
              </tbody>
          </table>

          ${(plData.grossIncomeData?.[selectedYear]?.totalWithholding > 0 || plData.grossIncomeData?.[selectedYear]?.totalSuperannuation > 0) ? `
          <!-- Footnotes for deductions at source -->
          <div style="margin-top: 20px; padding: 12px 16px; background-color: #f9f9f9; border: 1px solid #ddd; border-radius: 4px; font-size: 10px; color: #666;">
              <div style="font-weight: 600; color: #333; margin-bottom: 6px;">Notes - Deductions at Source (not P&L expenses):</div>
              ${plData.grossIncomeData[selectedYear]?.totalWithholding > 0 ? `<div style="margin-bottom: 3px;">¹ Withholding tax deducted at source: €${plData.grossIncomeData[selectedYear].totalWithholding.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}${plData.grossIncomeData[selectedYear - 1]?.totalWithholding > 0 ? ` (prior year: €${plData.grossIncomeData[selectedYear - 1].totalWithholding.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})` : ''}</div>` : ''}
              ${plData.grossIncomeData[selectedYear]?.totalSuperannuation > 0 ? `<div style="margin-bottom: 3px;">² Superannuation deducted at source: €${plData.grossIncomeData[selectedYear].totalSuperannuation.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}${plData.grossIncomeData[selectedYear - 1]?.totalSuperannuation > 0 ? ` (prior year: €${plData.grossIncomeData[selectedYear - 1].totalSuperannuation.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})` : ''}</div>` : ''}
              <div style="margin-top: 6px; font-style: italic;">These items are allocated to Partner's Capital Accounts, not treated as P&L expenses.</div>
          </div>
          ` : ''}

          ${(!plData.grossIncomeData?.[selectedYear]?.gmsComplete && plData.grossIncomeData?.[selectedYear]?.hasPCRSData) ? `
          <!-- GMS Incomplete Warning -->
          <div style="margin-top: 15px; padding: 10px 14px; background-color: #fff3e0; border-left: 4px solid #ff9800; border-radius: 4px; font-size: 10px;">
              <div style="font-weight: 600; color: #e65100;">⚠️ Incomplete GMS Data for ${selectedYear}</div>
              <div style="color: #795548;">Only ${plData.grossIncomeData[selectedYear].gmsMonthsFound}/12 months of PCRS statements uploaded. Missing: ${plData.grossIncomeData[selectedYear].gmsMissingMonths?.join(', ')}. GMS income may be understated.</div>
          </div>
          ` : ''}

          ${(!plData.grossIncomeData?.[selectedYear]?.hasPCRSData) ? `
          <!-- No PCRS Data Warning -->
          <div style="margin-top: 15px; padding: 10px 14px; background-color: #ffebee; border-left: 4px solid #f44336; border-radius: 4px; font-size: 10px;">
              <div style="font-weight: 600; color: #c62828;">❌ No PCRS Data for ${selectedYear}</div>
              <div style="color: #795548;">GMS income is based on bank deposits (NET) rather than PCRS statements (GROSS). Upload PCRS GMS statements for accurate gross income calculation.</div>
          </div>
          ` : ''}

          <!-- Year-on-Year Comparison Chart -->
          <div style="margin-top: 30px; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
              <h4 style="margin: 0 0 15px 0; font-size: 14px;">Year-on-Year Comparison</h4>
              <div style="display: flex; gap: 40px;">
                  <!-- Income Chart -->
                  <div style="flex: 1; text-align: center;">
                      <div style="font-size: 11px; color: #666; margin-bottom: 8px; font-weight: 600;">Income</div>
                      <div style="display: flex; align-items: flex-end; justify-content: center; gap: 10px; height: 80px; border-left: 1px solid #ddd; border-bottom: 1px solid #ddd; padding: 0 15px;">
                          <div style="display: flex; flex-direction: column; align-items: center; flex: 1;">
                              <div style="width: 40px; height: ${Math.round((totalIncome[selectedYear - 1] / Math.max(totalIncome[selectedYear], totalIncome[selectedYear - 1], 1)) * 60)}px; background-color: #A5D6A7; border-radius: 3px 3px 0 0; min-height: 4px;"></div>
                              <span style="font-size: 9px; color: #666; margin-top: 3px;">${selectedYear - 1}</span>
                          </div>
                          <div style="display: flex; flex-direction: column; align-items: center; flex: 1;">
                              <div style="width: 40px; height: ${Math.round((totalIncome[selectedYear] / Math.max(totalIncome[selectedYear], totalIncome[selectedYear - 1], 1)) * 60)}px; background-color: #4ECDC4; border-radius: 3px 3px 0 0; min-height: 4px;"></div>
                              <span style="font-size: 9px; color: #333; font-weight: 600; margin-top: 3px;">${selectedYear}</span>
                          </div>
                      </div>
                      <div style="font-size: 12px; font-weight: 600; color: #4ECDC4; margin-top: 8px;">${formatCurrency(totalIncome[selectedYear])}</div>
                      <div style="font-size: 10px; color: #666;">${totalIncome[selectedYear] >= totalIncome[selectedYear - 1] ? '+' : ''}${((totalIncome[selectedYear] - totalIncome[selectedYear - 1]) / (totalIncome[selectedYear - 1] || 1) * 100).toFixed(1)}%</div>
                  </div>
                  <!-- Expenditure Chart -->
                  <div style="flex: 1; text-align: center;">
                      <div style="font-size: 11px; color: #666; margin-bottom: 8px; font-weight: 600;">Expenditure</div>
                      <div style="display: flex; align-items: flex-end; justify-content: center; gap: 10px; height: 80px; border-left: 1px solid #ddd; border-bottom: 1px solid #ddd; padding: 0 15px;">
                          <div style="display: flex; flex-direction: column; align-items: center; flex: 1;">
                              <div style="width: 40px; height: ${Math.round((totalExpenses[selectedYear - 1] / Math.max(totalExpenses[selectedYear], totalExpenses[selectedYear - 1], 1)) * 60)}px; background-color: #FFCDD2; border-radius: 3px 3px 0 0; min-height: 4px;"></div>
                              <span style="font-size: 9px; color: #666; margin-top: 3px;">${selectedYear - 1}</span>
                          </div>
                          <div style="display: flex; flex-direction: column; align-items: center; flex: 1;">
                              <div style="width: 40px; height: ${Math.round((totalExpenses[selectedYear] / Math.max(totalExpenses[selectedYear], totalExpenses[selectedYear - 1], 1)) * 60)}px; background-color: #FF6B6B; border-radius: 3px 3px 0 0; min-height: 4px;"></div>
                              <span style="font-size: 9px; color: #333; font-weight: 600; margin-top: 3px;">${selectedYear}</span>
                          </div>
                      </div>
                      <div style="font-size: 12px; font-weight: 600; color: #FF6B6B; margin-top: 8px;">${formatCurrency(totalExpenses[selectedYear])}</div>
                      <div style="font-size: 10px; color: #666;">${totalExpenses[selectedYear] >= totalExpenses[selectedYear - 1] ? '+' : ''}${((totalExpenses[selectedYear] - totalExpenses[selectedYear - 1]) / (totalExpenses[selectedYear - 1] || 1) * 100).toFixed(1)}%</div>
                  </div>
                  <!-- Profit Chart -->
                  <div style="flex: 1; text-align: center;">
                      <div style="font-size: 11px; color: #666; margin-bottom: 8px; font-weight: 600;">Net Profit</div>
                      <div style="display: flex; align-items: flex-end; justify-content: center; gap: 10px; height: 80px; border-left: 1px solid #ddd; border-bottom: 1px solid #ddd; padding: 0 15px;">
                          <div style="display: flex; flex-direction: column; align-items: center; flex: 1;">
                              <div style="width: 40px; height: ${Math.round((Math.abs(netProfit[selectedYear - 1]) / Math.max(Math.abs(netProfit[selectedYear]), Math.abs(netProfit[selectedYear - 1]), 1)) * 60)}px; background-color: #BBDEFB; border-radius: 3px 3px 0 0; min-height: 4px;"></div>
                              <span style="font-size: 9px; color: #666; margin-top: 3px;">${selectedYear - 1}</span>
                          </div>
                          <div style="display: flex; flex-direction: column; align-items: center; flex: 1;">
                              <div style="width: 40px; height: ${Math.round((Math.abs(netProfit[selectedYear]) / Math.max(Math.abs(netProfit[selectedYear]), Math.abs(netProfit[selectedYear - 1]), 1)) * 60)}px; background-color: #4A90E2; border-radius: 3px 3px 0 0; min-height: 4px;"></div>
                              <span style="font-size: 9px; color: #333; font-weight: 600; margin-top: 3px;">${selectedYear}</span>
                          </div>
                      </div>
                      <div style="font-size: 12px; font-weight: 600; color: #4A90E2; margin-top: 8px;">${formatCurrency(netProfit[selectedYear])}</div>
                      <div style="font-size: 10px; color: #666;">${netProfit[selectedYear] >= netProfit[selectedYear - 1] ? '+' : ''}${((netProfit[selectedYear] - netProfit[selectedYear - 1]) / (Math.abs(netProfit[selectedYear - 1]) || 1) * 100).toFixed(1)}%</div>
                  </div>
              </div>
          </div>

          <div class="notes">
              <h4>⚠️ DRAFT REPORT - Important Notes:</h4>
              <p class="important">This report is a DRAFT and should not be used for official submissions without review by a qualified accountant.</p>
              <ul>
                  <li><strong>GMS Statements:</strong> ${plData.grossIncomeData?.[selectedYear]?.gmsComplete ? `✓ All 12 months of GMS statements uploaded for ${selectedYear}` : plData.grossIncomeData?.[selectedYear]?.hasPCRSData ? `⚠ ${plData.grossIncomeData[selectedYear].gmsMonthsFound}/12 months of GMS statements uploaded. Missing: ${plData.grossIncomeData[selectedYear].gmsMissingMonths?.join(', ')}` : `✗ No GMS statements uploaded for ${selectedYear} - using bank NET instead of PCRS GROSS`}</li>
                  <li><strong>Income Calculation:</strong> ${plData.grossIncomeData?.[selectedYear]?.hasPCRSData ? `✓ Using GROSS income (GMS: €${plData.grossIncomeData[selectedYear].gmsGross?.toLocaleString() || 0} from PCRS, State Contracts grossed up, Other: bank deposits)` : '⚠ Using bank deposits (NET) - upload PCRS statements for accurate GROSS income'}</li>
                  <li><strong>Motor Expenses:</strong> ${motorExpenses[selectedYear] > 0 || motorExpenses[selectedYear - 1] > 0 ? `✓ Calculated and included (${selectedYear}: €${motorExpenses[selectedYear].toFixed(2)}, ${selectedYear - 1}: €${motorExpenses[selectedYear - 1].toFixed(2)})` : '○ NOT calculated - Use the Motor Expenses Calculator for mileage claims'}</li>
                  <li><strong>Depreciation:</strong> ${depreciationExpenses[selectedYear] > 0 || depreciationExpenses[selectedYear - 1] > 0 ? `✓ Calculated and included (${selectedYear}: €${depreciationExpenses[selectedYear].toFixed(2)}, ${selectedYear - 1}: €${depreciationExpenses[selectedYear - 1].toFixed(2)})` : '○ NOT calculated - Use the Depreciation Calculator for capital allowances'}</li>
                  <li><strong>Classification:</strong> Some transactions may be partially classified or unclassified. Review the transaction list for accuracy.</li>
                  <li><strong>Period:</strong> ${plData.reportPeriod?.isPartialYear ? `This is a YEAR-TO-DATE report covering transactions up to ${plData.reportPeriod.cutoffDateString}. Full year figures will differ.` : 'This report covers full calendar years.'}</li>
              </ul>
              <p style="margin-top: 10px; font-style: italic;">Please review all figures with your accountant before using for tax returns or official purposes.</p>
          </div>

          <div style="margin-top: 30px; font-size: 10px; color: #666;">
              Generated on ${new Date().toLocaleDateString('en-IE')} by sl[Ai]nte.Finance
          </div>
      </body>
      </html>
    `;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.print();
    };

    const exportAccountantCSV = () => {
        if (!plData) return;

        const totalIncome = {
            [selectedYear]: Object.values(plData.income[selectedYear]).reduce((sum, val) => sum + val, 0),
            [selectedYear - 1]: Object.values(plData.income[selectedYear - 1]).reduce((sum, val) => sum + val, 0)
        };

        const totalExpenses = {
            [selectedYear]: Object.values(plData.expenses[selectedYear]).filter(v => !isNaN(v)).reduce((sum, val) => sum + val, 0),
            [selectedYear - 1]: Object.values(plData.expenses[selectedYear - 1]).filter(v => !isNaN(v)).reduce((sum, val) => sum + val, 0)
        };

        const netProfit = {
            [selectedYear]: totalIncome[selectedYear] - totalExpenses[selectedYear],
            [selectedYear - 1]: totalIncome[selectedYear - 1] - totalExpenses[selectedYear - 1]
        };

        const reportTitle = plData.reportPeriod?.isPartialYear ? 'GP Practice - Year to Date P&L Statement' : 'GP Practice - Profit & Loss Statement';
        const periodDescription = plData.reportPeriod?.isPartialYear
            ? `Period 1st January to ${plData.reportPeriod.cutoffDateString} for ${selectedYear} and ${selectedYear - 1}`
            : `Years ended 31st December ${selectedYear} and ${selectedYear - 1}`;
        const filename = plData.reportPeriod?.isPartialYear
            ? `YTD_PL_${selectedYear}_${selectedYear - 1}.csv`
            : `Accountant_PL_Format_${selectedYear}_${selectedYear - 1}.csv`;

        // Build footnotes for CSV
        const footnoteRows = [];
        if (plData.grossIncomeData?.[selectedYear]?.totalWithholding > 0 || plData.grossIncomeData?.[selectedYear]?.totalSuperannuation > 0) {
            footnoteRows.push(['', '', '']);
            footnoteRows.push(['NOTES - Deductions at Source (not P&L expenses)', '', '']);
            if (plData.grossIncomeData[selectedYear]?.totalWithholding > 0) {
                footnoteRows.push([
                    'Withholding tax deducted at source',
                    plData.grossIncomeData[selectedYear].totalWithholding.toFixed(2),
                    (plData.grossIncomeData[selectedYear - 1]?.totalWithholding || 0).toFixed(2)
                ]);
            }
            if (plData.grossIncomeData[selectedYear]?.totalSuperannuation > 0) {
                footnoteRows.push([
                    'Superannuation deducted at source',
                    plData.grossIncomeData[selectedYear].totalSuperannuation.toFixed(2),
                    (plData.grossIncomeData[selectedYear - 1]?.totalSuperannuation || 0).toFixed(2)
                ]);
            }
            footnoteRows.push(['(These items are allocated to Partner\'s Capital Accounts)', '', '']);
        }

        const csvRows = [
            [reportTitle, '', ''],
            [periodDescription, '', ''],
            ['', '', ''],
            ...(plData.reportPeriod?.isPartialYear ? [['Note: Year to Date report comparing same periods for accurate comparison', '', ''], ['', '', '']] : []),
            ...(plData.grossIncomeData?.[selectedYear]?.hasPCRSData ? [['Note: Income calculated using GROSS values (GMS from PCRS, State Contracts grossed up)', '', ''], ['', '', '']] : [['Note: GMS income based on bank deposits (NET) - upload PCRS statements for GROSS income', '', ''], ['', '', '']]),
            ['Description', `${selectedYear} €`, `${selectedYear - 1} €`],
            ['INCOME', '', ''],
            ['Fee income', plData.income[selectedYear]['Fee income'].toFixed(2), plData.income[selectedYear - 1]['Fee income'].toFixed(2)],
            ['Total Income', totalIncome[selectedYear].toFixed(2), totalIncome[selectedYear - 1].toFixed(2)],
            ['', '', ''],
            ['EXPENDITURE', '', ''],
            ...Object.entries(plData.expenses[selectedYear])
                .filter(([_, amount]) => amount > 0)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([category, amount]) => [
                    category,
                    amount.toFixed(2),
                    (plData.expenses[selectedYear - 1][category] || 0).toFixed(2)
                ]),
            ['Total Expenditure', totalExpenses[selectedYear].toFixed(2), totalExpenses[selectedYear - 1].toFixed(2)],
            ['', '', ''],
            ['Net Divisible Profit', netProfit[selectedYear].toFixed(2), netProfit[selectedYear - 1].toFixed(2)],
            ...footnoteRows
        ];

        const csvContent = csvRows.map(row =>
            row.map(field => `"${field}"`).join(',')
        ).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };


    // Calculate totals for display
    const totalIncome = plData ? Object.values(plData.income[selectedYear]).reduce((sum, val) => sum + val, 0) : 0;
    const totalIncomePrev = plData ? Object.values(plData.income[selectedYear - 1]).reduce((sum, val) => sum + val, 0) : 0;
    const totalExpenses = plData ? Object.values(plData.expenses[selectedYear]).reduce((sum, val) => sum + val, 0) : 0;
    const totalExpensesPrev = plData ? Object.values(plData.expenses[selectedYear - 1]).reduce((sum, val) => sum + val, 0) : 0;
    const netProfit = totalIncome - totalExpenses;
    const netProfitPrev = totalIncomePrev - totalExpensesPrev;

    // Check GMS payment completeness for the selected year
    const getGMSPaymentStatus = () => {
        if (!paymentAnalysisData || paymentAnalysisData.length === 0) {
            return { complete: false, monthsFound: 0, missingMonths: [], hasAnyData: false };
        }

        const yearPayments = paymentAnalysisData.filter(p => {
            const paymentYear = new Date(p.paymentDate).getFullYear();
            return paymentYear === selectedYear;
        });

        const monthsWithPayments = new Set();
        yearPayments.forEach(p => {
            const month = new Date(p.paymentDate).getMonth();
            monthsWithPayments.add(month);
        });

        const allMonths = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const missingMonths = allMonths
            .filter(m => !monthsWithPayments.has(m))
            .map(m => monthNames[m]);

        return {
            complete: missingMonths.length === 0,
            monthsFound: monthsWithPayments.size,
            missingMonths,
            hasAnyData: yearPayments.length > 0
        };
    };

    const gmsStatus = getGMSPaymentStatus();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* HEADER: Year Selector */}
            <div style={{
                backgroundColor: COLORS.white,
                padding: '24px',
                borderRadius: '8px',
                border: `1px solid ${COLORS.lightGray}`
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h2 style={{
                            fontSize: '24px',
                            fontWeight: 'bold',
                            color: COLORS.darkGray,
                            display: 'flex',
                            alignItems: 'center',
                            margin: 0
                        }}>
                            <FileText style={{ height: '24px', width: '24px', marginRight: '12px', color: COLORS.slainteBlue }} />
                            Profit & Loss Report
                        </h2>
                        <p style={{ color: COLORS.mediumGray, marginTop: '8px', marginBottom: 0 }}>
                            Generate a professional P&L report for your accountant
                        </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <label style={{ fontSize: '14px', fontWeight: '500', color: COLORS.darkGray }}>Report Year:</label>
                        <select
                            value={selectedYear}
                            onChange={(e) => {
                                const newYear = parseInt(e.target.value);
                                if (setSelectedYear && newYear !== selectedYear) {
                                    setSelectedYear(newYear);
                                    setPLData(null);
                                }
                            }}
                            style={{
                                border: `2px solid ${COLORS.slainteBlue}`,
                                borderRadius: '8px',
                                padding: '10px 16px',
                                backgroundColor: COLORS.white,
                                fontSize: '16px',
                                fontWeight: '600',
                                color: COLORS.slainteBlue,
                                cursor: 'pointer',
                                minWidth: '100px'
                            }}
                            disabled={availableYears.length === 0}
                        >
                            {availableYears.length > 0 ? (
                                availableYears.map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))
                            ) : (
                                <option value={selectedYear}>{selectedYear}</option>
                            )}
                        </select>
                    </div>
                </div>
                {transactions.length > 0 && (
                    <div style={{
                        marginTop: '16px',
                        padding: '12px 16px',
                        backgroundColor: COLORS.backgroundGray,
                        borderRadius: '6px',
                        display: 'flex',
                        gap: '24px',
                        fontSize: '14px'
                    }}>
                        <span><strong>{transactions.filter(t => new Date(t.date).getFullYear() === selectedYear).length}</strong> transactions in {selectedYear}</span>
                        <span><strong>{transactions.filter(t => new Date(t.date).getFullYear() === selectedYear - 1).length}</strong> transactions in {selectedYear - 1}</span>
                        <span style={{ color: COLORS.mediumGray }}>|</span>
                        <span style={{ color: reportPeriod.isPartialYear ? COLORS.slainteBlue : COLORS.incomeColor, fontWeight: '500' }}>
                            {reportPeriod.isPartialYear ? `Year to Date (1 Jan - ${reportPeriod.cutoffDateString})` : 'Full Year Report'}
                        </span>
                    </div>
                )}
            </div>

            {/* PRE-REQUISITES: GMS & Withholding Tax Status */}
            <div style={{
                backgroundColor: COLORS.white,
                padding: '24px',
                borderRadius: '8px',
                border: `1px solid ${COLORS.lightGray}`
            }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: COLORS.darkGray, marginTop: 0, marginBottom: '16px' }}>
                    Data Status for {selectedYear}
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {/* GMS Payment Status */}
                    <div style={{
                        padding: '16px',
                        borderRadius: '8px',
                        backgroundColor: gmsStatus.complete ? '#E8F5E9' : gmsStatus.hasAnyData ? '#FFF3E0' : '#FFEBEE',
                        border: `1px solid ${gmsStatus.complete ? COLORS.incomeColor : gmsStatus.hasAnyData ? '#FFB74D' : COLORS.expenseColor}`
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            {gmsStatus.complete ? (
                                <CheckCircle style={{ height: '20px', width: '20px', color: COLORS.incomeColor }} />
                            ) : (
                                <AlertCircle style={{ height: '20px', width: '20px', color: gmsStatus.hasAnyData ? '#F57C00' : COLORS.expenseColor }} />
                            )}
                            <span style={{ fontWeight: '600', color: COLORS.darkGray }}>GMS Payment Statements</span>
                        </div>
                        <p style={{ fontSize: '14px', color: COLORS.darkGray, margin: 0 }}>
                            {gmsStatus.complete ? (
                                <>All 12 months of GMS statements uploaded for {selectedYear}</>
                            ) : gmsStatus.hasAnyData ? (
                                <>{gmsStatus.monthsFound}/12 months uploaded. Missing: {gmsStatus.missingMonths.join(', ')}</>
                            ) : (
                                <>No GMS statements uploaded for {selectedYear}</>
                            )}
                        </p>
                        {!gmsStatus.complete && (
                            <p style={{ fontSize: '13px', color: COLORS.mediumGray, margin: '8px 0 0 0' }}>
                                Upload PCRS GMS panel PDFs in Settings → Data to calculate withholding tax accurately.
                            </p>
                        )}
                    </div>

                    {/* Withholding Tax Status */}
                    <div style={{
                        padding: '16px',
                        borderRadius: '8px',
                        backgroundColor: withholdingTaxData.total > 0 ? '#E8F5E9' : '#FFF9E6',
                        border: `1px solid ${withholdingTaxData.total > 0 ? COLORS.incomeColor : '#FFC107'}`
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            {withholdingTaxData.total > 0 ? (
                                <CheckCircle style={{ height: '20px', width: '20px', color: COLORS.incomeColor }} />
                            ) : (
                                <AlertCircle style={{ height: '20px', width: '20px', color: '#F57C00' }} />
                            )}
                            <span style={{ fontWeight: '600', color: COLORS.darkGray }}>Withholding Tax</span>
                        </div>
                        <p style={{ fontSize: '14px', color: COLORS.darkGray, margin: 0 }}>
                            {withholdingTaxData.total > 0 ? (
                                <>Calculated: €{withholdingTaxData.total.toLocaleString()} (GMS: €{withholdingTaxData.gmsWithholdingTax.toLocaleString()}, State: €{withholdingTaxData.stateContractTax.toLocaleString()})</>
                            ) : (
                                <>Not yet calculated - upload GMS statements to calculate</>
                            )}
                        </p>
                        <p style={{ fontSize: '13px', color: COLORS.mediumGray, margin: '8px 0 0 0' }}>
                            Bank income shows <strong>net</strong> amounts (after tax deducted). Withholding tax must be added back to calculate <strong>gross</strong> income for tax returns.
                        </p>
                    </div>
                </div>
            </div>

            {/* OPTIONAL CALCULATIONS: Motor & Depreciation */}
            <div style={{
                backgroundColor: COLORS.white,
                padding: '24px',
                borderRadius: '8px',
                border: `1px solid ${COLORS.lightGray}`
            }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: COLORS.darkGray, marginTop: 0, marginBottom: '8px' }}>
                    Optional Calculations
                </h3>
                <p style={{ fontSize: '14px', color: COLORS.mediumGray, marginBottom: '16px' }}>
                    For a complete P&L report, these calculations should be completed. You can generate a draft report without them,
                    but the draft will indicate that these figures are missing.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {/* Motor Expenses Calculator Card */}
                    <div style={{
                        padding: '20px',
                        borderRadius: '8px',
                        border: `1px solid ${motorExpenses[selectedYear] > 0 ? COLORS.incomeColor : COLORS.lightGray}`,
                        backgroundColor: motorExpenses[selectedYear] > 0 ? '#E8F5E9' : COLORS.backgroundGray
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '8px',
                                    backgroundColor: COLORS.slainteBlue,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Car style={{ height: '20px', width: '20px', color: COLORS.white }} />
                                </div>
                                <div>
                                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: COLORS.darkGray }}>Motor Expenses</h4>
                                    <p style={{ margin: 0, fontSize: '13px', color: COLORS.mediumGray }}>Business mileage calculator</p>
                                </div>
                            </div>
                            {motorExpenses[selectedYear] > 0 && (
                                <CheckCircle style={{ height: '20px', width: '20px', color: COLORS.incomeColor }} />
                            )}
                        </div>

                        {motorExpenses[selectedYear] > 0 || motorExpenses[selectedYear - 1] > 0 ? (
                            <div style={{ marginBottom: '12px', padding: '10px', backgroundColor: COLORS.white, borderRadius: '6px' }}>
                                <div style={{ fontSize: '14px', color: COLORS.darkGray }}>
                                    <strong>{selectedYear}:</strong> €{motorExpenses[selectedYear].toFixed(2)}
                                </div>
                                <div style={{ fontSize: '14px', color: COLORS.mediumGray }}>
                                    <strong>{selectedYear - 1}:</strong> €{motorExpenses[selectedYear - 1].toFixed(2)}
                                </div>
                            </div>
                        ) : (
                            <p style={{ fontSize: '13px', color: COLORS.mediumGray, marginBottom: '12px' }}>
                                Calculate business mileage using Irish Civil Service rates. Required for claiming motor expenses.
                            </p>
                        )}

                        <button
                            onClick={() => setShowMotorCalculator(true)}
                            style={{
                                width: '100%',
                                backgroundColor: motorExpenses[selectedYear] > 0 ? COLORS.white : COLORS.slainteBlue,
                                color: motorExpenses[selectedYear] > 0 ? COLORS.slainteBlue : COLORS.white,
                                padding: '10px 16px',
                                borderRadius: '6px',
                                border: motorExpenses[selectedYear] > 0 ? `1px solid ${COLORS.slainteBlue}` : 'none',
                                cursor: 'pointer',
                                fontWeight: '500',
                                fontSize: '14px'
                            }}
                        >
                            {motorExpenses[selectedYear] > 0 ? 'Edit Calculation' : 'Open Calculator'}
                        </button>
                    </div>

                    {/* Depreciation Calculator Card */}
                    <div style={{
                        padding: '20px',
                        borderRadius: '8px',
                        border: `1px solid ${depreciationExpenses[selectedYear] > 0 ? COLORS.incomeColor : COLORS.lightGray}`,
                        backgroundColor: depreciationExpenses[selectedYear] > 0 ? '#E8F5E9' : COLORS.backgroundGray
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '8px',
                                    backgroundColor: '#9C27B0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Building style={{ height: '20px', width: '20px', color: COLORS.white }} />
                                </div>
                                <div>
                                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: COLORS.darkGray }}>Depreciation</h4>
                                    <p style={{ margin: 0, fontSize: '13px', color: COLORS.mediumGray }}>Capital allowances calculator</p>
                                </div>
                            </div>
                            {depreciationExpenses[selectedYear] > 0 && (
                                <CheckCircle style={{ height: '20px', width: '20px', color: COLORS.incomeColor }} />
                            )}
                        </div>

                        {depreciationExpenses[selectedYear] > 0 || depreciationExpenses[selectedYear - 1] > 0 ? (
                            <div style={{ marginBottom: '12px', padding: '10px', backgroundColor: COLORS.white, borderRadius: '6px' }}>
                                <div style={{ fontSize: '14px', color: COLORS.darkGray }}>
                                    <strong>{selectedYear}:</strong> €{depreciationExpenses[selectedYear].toFixed(2)}
                                </div>
                                <div style={{ fontSize: '14px', color: COLORS.mediumGray }}>
                                    <strong>{selectedYear - 1}:</strong> €{depreciationExpenses[selectedYear - 1].toFixed(2)}
                                </div>
                            </div>
                        ) : (
                            <p style={{ fontSize: '13px', color: COLORS.mediumGray, marginBottom: '12px' }}>
                                Calculate capital allowances on equipment, furniture, and other assets using straight-line depreciation.
                            </p>
                        )}

                        <button
                            onClick={() => setShowDepreciationCalculator(true)}
                            style={{
                                width: '100%',
                                backgroundColor: depreciationExpenses[selectedYear] > 0 ? COLORS.white : '#9C27B0',
                                color: depreciationExpenses[selectedYear] > 0 ? '#9C27B0' : COLORS.white,
                                padding: '10px 16px',
                                borderRadius: '6px',
                                border: depreciationExpenses[selectedYear] > 0 ? '1px solid #9C27B0' : 'none',
                                cursor: 'pointer',
                                fontWeight: '500',
                                fontSize: '14px'
                            }}
                        >
                            {depreciationExpenses[selectedYear] > 0 ? 'Edit Calculation' : 'Open Calculator'}
                        </button>
                    </div>
                </div>
            </div>

            {/* GENERATE BUTTON */}
            <div style={{
                backgroundColor: COLORS.white,
                padding: '24px',
                borderRadius: '8px',
                border: `2px solid ${COLORS.slainteBlue}`
            }}>
                {/* Summary of what will be included/missing */}
                <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', color: COLORS.darkGray, marginTop: 0, marginBottom: '12px' }}>
                        Report Summary
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                        <span style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '13px',
                            fontWeight: '500',
                            backgroundColor: transactions.length > 0 ? '#E8F5E9' : '#FFEBEE',
                            color: transactions.length > 0 ? COLORS.incomeColor : COLORS.expenseColor
                        }}>
                            {transactions.length > 0 ? '✓' : '✗'} Bank Transactions
                        </span>
                        <span style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '13px',
                            fontWeight: '500',
                            backgroundColor: gmsStatus.complete ? '#E8F5E9' : gmsStatus.hasAnyData ? '#FFF3E0' : '#FFEBEE',
                            color: gmsStatus.complete ? COLORS.incomeColor : gmsStatus.hasAnyData ? '#E65100' : COLORS.expenseColor
                        }}>
                            {gmsStatus.complete ? '✓' : gmsStatus.hasAnyData ? '~' : '✗'} GMS Statements ({gmsStatus.monthsFound}/12)
                        </span>
                        <span style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '13px',
                            fontWeight: '500',
                            backgroundColor: withholdingTaxData.total > 0 ? '#E8F5E9' : '#FFF3E0',
                            color: withholdingTaxData.total > 0 ? COLORS.incomeColor : '#E65100'
                        }}>
                            {withholdingTaxData.total > 0 ? '✓' : '~'} Withholding Tax
                        </span>
                        <span style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '13px',
                            fontWeight: '500',
                            backgroundColor: motorExpenses[selectedYear] > 0 ? '#E8F5E9' : COLORS.backgroundGray,
                            color: motorExpenses[selectedYear] > 0 ? COLORS.incomeColor : COLORS.mediumGray
                        }}>
                            {motorExpenses[selectedYear] > 0 ? '✓' : '○'} Motor Expenses
                        </span>
                        <span style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '13px',
                            fontWeight: '500',
                            backgroundColor: depreciationExpenses[selectedYear] > 0 ? '#E8F5E9' : COLORS.backgroundGray,
                            color: depreciationExpenses[selectedYear] > 0 ? COLORS.incomeColor : COLORS.mediumGray
                        }}>
                            {depreciationExpenses[selectedYear] > 0 ? '✓' : '○'} Depreciation
                        </span>
                    </div>
                </div>

                <button
                    onClick={processTransactionsForPL}
                    disabled={transactions.length === 0 || processing}
                    style={{
                        width: '100%',
                        backgroundColor: transactions.length === 0 || processing ? COLORS.mediumGray : COLORS.slainteBlue,
                        color: COLORS.white,
                        padding: '16px 24px',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: transactions.length === 0 || processing ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '600',
                        fontSize: '16px',
                        transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                        if (transactions.length > 0 && !processing) {
                            e.currentTarget.style.backgroundColor = COLORS.slainteBlueDark;
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (transactions.length > 0 && !processing) {
                            e.currentTarget.style.backgroundColor = COLORS.slainteBlue;
                        }
                    }}
                >
                    {processing ? (
                        <>
                            <div style={{
                                animation: 'spin 1s linear infinite',
                                borderRadius: '50%',
                                height: '20px',
                                width: '20px',
                                border: `2px solid ${COLORS.white}`,
                                borderTopColor: 'transparent',
                                marginRight: '10px'
                            }}></div>
                            Generating Report...
                        </>
                    ) : (
                        <>
                            <Calculator style={{ height: '20px', width: '20px', marginRight: '10px' }} />
                            Generate P&L Report for {selectedYear}
                        </>
                    )}
                </button>

                {transactions.length === 0 && (
                    <p style={{ fontSize: '14px', color: COLORS.expenseColor, textAlign: 'center', marginTop: '12px', marginBottom: 0 }}>
                        Upload bank transaction data first to generate a P&L report
                    </p>
                )}

                {transactions.length > 0 && (motorExpenses[selectedYear] === 0 || depreciationExpenses[selectedYear] === 0 || !gmsStatus.complete) && (
                    <p style={{ fontSize: '13px', color: COLORS.mediumGray, textAlign: 'center', marginTop: '12px', marginBottom: 0 }}>
                        Report will be marked as <strong>DRAFT</strong> with notes about missing calculations
                    </p>
                )}
            </div>

            {/* P&L Report Modal */}
            {showReportModal && plData && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999,
                        padding: '2rem'
                    }}
                    onClick={() => setShowReportModal(false)}
                >
                    <div
                        style={{
                            backgroundColor: COLORS.white,
                            borderRadius: '16px',
                            maxWidth: '900px',
                            width: '100%',
                            maxHeight: '90vh',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                            overflow: 'hidden'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '1rem 1.5rem',
                            borderBottom: `1px solid ${COLORS.lightGray}`,
                            backgroundColor: COLORS.backgroundGray,
                            flexShrink: 0
                        }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: COLORS.darkGray }}>
                                    {practiceName}
                                </h2>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                    <span style={{ fontSize: '1rem', color: COLORS.mediumGray }}>
                                        {plData.reportPeriod?.isPartialYear ? 'Year to Date' : 'Full Year'} P&L Statement
                                    </span>
                                    <span style={{
                                        backgroundColor: '#ff6b6b',
                                        color: 'white',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        fontSize: '10px',
                                        fontWeight: 'bold'
                                    }}>DRAFT</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowReportModal(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: '0.5rem',
                                    cursor: 'pointer',
                                    borderRadius: '0.375rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.lightGray}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <X style={{ width: '1.25rem', height: '1.25rem', color: COLORS.mediumGray }} />
                            </button>
                        </div>

                        {/* Modal Content - Scrollable */}
                        <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>
                            {/* P&L Table */}
                            <div style={{
                                backgroundColor: COLORS.white,
                                border: `1px solid ${COLORS.lightGray}`,
                                borderRadius: '8px',
                                overflow: 'hidden',
                                marginBottom: '1.5rem'
                            }}>
                                <div style={{
                                    backgroundColor: COLORS.backgroundGray,
                                    padding: '12px 24px',
                                    borderBottom: `1px solid ${COLORS.lightGray}`
                                }}>
                                    <p style={{ fontSize: '14px', color: COLORS.mediumGray, margin: 0 }}>
                                        {plData.reportPeriod?.isPartialYear ? (
                                            <>Period: 1 January - {plData.reportPeriod.cutoffDateString} for years {selectedYear} and {selectedYear - 1}</>
                                        ) : (
                                            <>Years ended 31st December {selectedYear} and {selectedYear - 1}</>
                                        )}
                                    </p>
                                </div>

                                <div style={{ padding: '24px' }}>
                                    <div style={{ fontFamily: 'monospace', fontSize: '14px' }}>
                                        {/* Header */}
                                        <div style={{
                                            display: 'flex',
                                            borderBottom: `1px solid ${COLORS.lightGray}`,
                                            paddingBottom: '8px',
                                            marginBottom: '16px',
                                            fontWeight: '600'
                                        }}>
                                            <span style={{ flex: 1 }}>Description</span>
                                            <span style={{ textAlign: 'right', width: '128px' }}>{selectedYear} €</span>
                                            <span style={{ textAlign: 'right', width: '128px' }}>{selectedYear - 1} €</span>
                                        </div>

                                        {/* Income Section */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                                            <div style={{
                                                display: 'flex',
                                                fontWeight: '600',
                                                backgroundColor: '#E3F2FD',
                                                padding: '8px',
                                                borderRadius: '4px'
                                            }}>
                                                <span style={{ flex: 1 }}>INCOME</span>
                                                <span style={{ textAlign: 'right', width: '128px' }}></span>
                                                <span style={{ textAlign: 'right', width: '128px' }}></span>
                                            </div>
                                            <div style={{ display: 'flex' }}>
                                                <span style={{ flex: 1 }}>Fee income</span>
                                                <span style={{ textAlign: 'right', width: '128px' }}>{formatCurrency(plData.income[selectedYear]['Fee income'])}</span>
                                                <span style={{ textAlign: 'right', width: '128px' }}>{formatCurrency(plData.income[selectedYear - 1]['Fee income'])}</span>
                                            </div>
                                            <div style={{
                                                display: 'flex',
                                                fontWeight: '600',
                                                borderTop: `1px solid ${COLORS.lightGray}`,
                                                paddingTop: '8px'
                                            }}>
                                                <span style={{ flex: 1 }}>Total Income</span>
                                                <span style={{ textAlign: 'right', width: '128px' }}>{formatCurrency(totalIncome)}</span>
                                                <span style={{ textAlign: 'right', width: '128px' }}>{formatCurrency(totalIncomePrev)}</span>
                                            </div>
                                        </div>

                                        {/* Expenses Section */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                                            <div style={{
                                                display: 'flex',
                                                fontWeight: '600',
                                                backgroundColor: '#FFEBEE',
                                                padding: '8px',
                                                borderRadius: '4px'
                                            }}>
                                                <span style={{ flex: 1 }}>EXPENDITURE</span>
                                                <span style={{ textAlign: 'right', width: '128px' }}></span>
                                                <span style={{ textAlign: 'right', width: '128px' }}></span>
                                            </div>
                                            {Object.entries(plData.expenses[selectedYear])
                                                .filter(([_, amount]) => amount > 0)
                                                .sort(([a], [b]) => a.localeCompare(b))
                                                .map(([category, amount]) => (
                                                    <div key={category} style={{ display: 'flex' }}>
                                                        <span style={{ flex: 1 }}>{category}</span>
                                                        <span style={{ textAlign: 'right', width: '128px' }}>{formatCurrency(amount)}</span>
                                                        <span style={{ textAlign: 'right', width: '128px' }}>{formatCurrency(plData.expenses[selectedYear - 1][category] || 0)}</span>
                                                    </div>
                                                ))}
                                            <div style={{
                                                display: 'flex',
                                                fontWeight: '600',
                                                borderTop: `1px solid ${COLORS.lightGray}`,
                                                paddingTop: '8px'
                                            }}>
                                                <span style={{ flex: 1 }}>Total Expenditure</span>
                                                <span style={{ textAlign: 'right', width: '128px' }}>({formatCurrency(totalExpenses)})</span>
                                                <span style={{ textAlign: 'right', width: '128px' }}>({formatCurrency(totalExpensesPrev)})</span>
                                            </div>
                                        </div>

                                        {/* Profit Section */}
                                        <div style={{
                                            borderTop: `1px solid ${COLORS.lightGray}`,
                                            paddingTop: '16px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '8px'
                                        }}>
                                            <div style={{ display: 'flex', fontWeight: '600' }}>
                                                <span style={{ flex: 1 }}>Profit before appropriation</span>
                                                <span style={{ textAlign: 'right', width: '128px' }}>{formatCurrency(netProfit)}</span>
                                                <span style={{ textAlign: 'right', width: '128px' }}>{formatCurrency(netProfitPrev)}</span>
                                            </div>
                                            <div style={{ display: 'flex', fontWeight: 'bold', fontSize: '18px' }}>
                                                <span style={{ flex: 1 }}>Net Divisible Profit</span>
                                                <span style={{ textAlign: 'right', width: '128px' }}>{formatCurrency(netProfit)}</span>
                                                <span style={{ textAlign: 'right', width: '128px' }}>{formatCurrency(netProfitPrev)}</span>
                                            </div>
                                        </div>

                                        {/* Footnotes for deductions at source */}
                                        {plData.grossIncomeData && (plData.grossIncomeData[selectedYear]?.totalWithholding > 0 || plData.grossIncomeData[selectedYear]?.totalSuperannuation > 0) && (
                                            <div style={{
                                                marginTop: '24px',
                                                paddingTop: '16px',
                                                borderTop: `1px solid ${COLORS.lightGray}`,
                                                fontSize: '12px',
                                                color: COLORS.mediumGray
                                            }}>
                                                <div style={{ fontWeight: '600', marginBottom: '8px', color: COLORS.darkGray }}>
                                                    Notes - Deductions at Source (not P&L expenses):
                                                </div>
                                                {plData.grossIncomeData[selectedYear]?.totalWithholding > 0 && (
                                                    <div style={{ marginBottom: '4px' }}>
                                                        ¹ Withholding tax deducted at source: €{plData.grossIncomeData[selectedYear].totalWithholding.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                        {plData.grossIncomeData[selectedYear - 1]?.totalWithholding > 0 && (
                                                            <span> (prior year: €{plData.grossIncomeData[selectedYear - 1].totalWithholding.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})</span>
                                                        )}
                                                    </div>
                                                )}
                                                {plData.grossIncomeData[selectedYear]?.totalSuperannuation > 0 && (
                                                    <div style={{ marginBottom: '4px' }}>
                                                        ² Superannuation deducted at source: €{plData.grossIncomeData[selectedYear].totalSuperannuation.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                        {plData.grossIncomeData[selectedYear - 1]?.totalSuperannuation > 0 && (
                                                            <span> (prior year: €{plData.grossIncomeData[selectedYear - 1].totalSuperannuation.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})</span>
                                                        )}
                                                    </div>
                                                )}
                                                <div style={{ marginTop: '8px', fontStyle: 'italic' }}>
                                                    These items are allocated to Partner's Capital Accounts, not treated as P&L expenses.
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* GMS Data Completeness Warning */}
                            {plData.grossIncomeData && !plData.grossIncomeData[selectedYear]?.gmsComplete && plData.grossIncomeData[selectedYear]?.hasPCRSData && (
                                <div style={{
                                    padding: '12px 16px',
                                    backgroundColor: '#fff3e0',
                                    borderLeft: `4px solid #ff9800`,
                                    borderRadius: '4px',
                                    marginBottom: '1rem',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '12px'
                                }}>
                                    <span style={{ fontSize: '16px' }}>⚠️</span>
                                    <div>
                                        <div style={{ fontWeight: '600', color: '#e65100', marginBottom: '4px' }}>
                                            Incomplete GMS Data for {selectedYear}
                                        </div>
                                        <div style={{ fontSize: '13px', color: '#795548' }}>
                                            Only {plData.grossIncomeData[selectedYear].gmsMonthsFound}/12 months of PCRS statements uploaded.
                                            Missing: {plData.grossIncomeData[selectedYear].gmsMissingMonths?.join(', ')}.
                                            GMS income may be understated.
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* No PCRS Data Warning */}
                            {plData.grossIncomeData && !plData.grossIncomeData[selectedYear]?.hasPCRSData && (
                                <div style={{
                                    padding: '12px 16px',
                                    backgroundColor: '#ffebee',
                                    borderLeft: `4px solid #f44336`,
                                    borderRadius: '4px',
                                    marginBottom: '1rem',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '12px'
                                }}>
                                    <span style={{ fontSize: '16px' }}>❌</span>
                                    <div>
                                        <div style={{ fontWeight: '600', color: '#c62828', marginBottom: '4px' }}>
                                            No PCRS Data for {selectedYear}
                                        </div>
                                        <div style={{ fontSize: '13px', color: '#795548' }}>
                                            GMS income is based on bank deposits (NET) rather than PCRS statements (GROSS).
                                            Upload PCRS GMS statements in the GMS Overview tab for accurate gross income calculation.
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Bar Chart Comparison */}
                            <div style={{
                                backgroundColor: COLORS.white,
                                border: `1px solid ${COLORS.lightGray}`,
                                borderRadius: '8px',
                                padding: '20px',
                                marginBottom: '1.5rem'
                            }}>
                                <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '600', color: COLORS.darkGray }}>
                                    Year-on-Year Comparison
                                </h4>
                                <div style={{ display: 'flex', gap: '32px' }}>
                                    {/* Income Chart */}
                                    {(() => {
                                        const maxVal = Math.max(totalIncome, totalIncomePrev, 1);
                                        const chartHeight = 100;
                                        const formatYAxis = (val) => val >= 1000000 ? `€${(val/1000000).toFixed(1)}M` : val >= 1000 ? `€${(val/1000).toFixed(0)}K` : `€${val.toFixed(0)}`;
                                        return (
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '12px', color: COLORS.mediumGray, marginBottom: '8px', fontWeight: '600' }}>Income</div>
                                                <div style={{ display: 'flex' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: `${chartHeight}px`, marginRight: '6px', paddingBottom: '18px' }}>
                                                        <span style={{ fontSize: '9px', color: COLORS.mediumGray, textAlign: 'right' }}>{formatYAxis(maxVal)}</span>
                                                        <span style={{ fontSize: '9px', color: COLORS.mediumGray, textAlign: 'right' }}>{formatYAxis(maxVal * 0.5)}</span>
                                                        <span style={{ fontSize: '9px', color: COLORS.mediumGray, textAlign: 'right' }}>€0</span>
                                                    </div>
                                                    <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '6px', height: `${chartHeight}px`, borderLeft: `1px solid ${COLORS.lightGray}`, borderBottom: `1px solid ${COLORS.lightGray}`, paddingLeft: '6px' }}>
                                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                            <div style={{ width: '100%', height: `${(totalIncomePrev / maxVal) * (chartHeight - 18)}px`, backgroundColor: '#A5D6A7', borderRadius: '3px 3px 0 0', minHeight: '4px' }} />
                                                            <span style={{ fontSize: '10px', color: COLORS.mediumGray, marginTop: '3px' }}>{selectedYear - 1}</span>
                                                        </div>
                                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                            <div style={{ width: '100%', height: `${(totalIncome / maxVal) * (chartHeight - 18)}px`, backgroundColor: COLORS.incomeColor, borderRadius: '3px 3px 0 0', minHeight: '4px' }} />
                                                            <span style={{ fontSize: '10px', color: COLORS.darkGray, fontWeight: '600', marginTop: '3px' }}>{selectedYear}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'center', marginTop: '8px' }}>
                                                    <div style={{ fontSize: '13px', fontWeight: '600', color: COLORS.incomeColor }}>{formatCurrency(totalIncome)}</div>
                                                    <div style={{ fontSize: '11px', color: COLORS.mediumGray }}>
                                                        {totalIncome >= totalIncomePrev ? '+' : ''}{((totalIncome - totalIncomePrev) / (totalIncomePrev || 1) * 100).toFixed(1)}%
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Expenditure Chart */}
                                    {(() => {
                                        const maxVal = Math.max(totalExpenses, totalExpensesPrev, 1);
                                        const chartHeight = 100;
                                        const formatYAxis = (val) => val >= 1000000 ? `€${(val/1000000).toFixed(1)}M` : val >= 1000 ? `€${(val/1000).toFixed(0)}K` : `€${val.toFixed(0)}`;
                                        return (
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '12px', color: COLORS.mediumGray, marginBottom: '8px', fontWeight: '600' }}>Expenditure</div>
                                                <div style={{ display: 'flex' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: `${chartHeight}px`, marginRight: '6px', paddingBottom: '18px' }}>
                                                        <span style={{ fontSize: '9px', color: COLORS.mediumGray, textAlign: 'right' }}>{formatYAxis(maxVal)}</span>
                                                        <span style={{ fontSize: '9px', color: COLORS.mediumGray, textAlign: 'right' }}>{formatYAxis(maxVal * 0.5)}</span>
                                                        <span style={{ fontSize: '9px', color: COLORS.mediumGray, textAlign: 'right' }}>€0</span>
                                                    </div>
                                                    <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '6px', height: `${chartHeight}px`, borderLeft: `1px solid ${COLORS.lightGray}`, borderBottom: `1px solid ${COLORS.lightGray}`, paddingLeft: '6px' }}>
                                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                            <div style={{ width: '100%', height: `${(totalExpensesPrev / maxVal) * (chartHeight - 18)}px`, backgroundColor: '#FFCDD2', borderRadius: '3px 3px 0 0', minHeight: '4px' }} />
                                                            <span style={{ fontSize: '10px', color: COLORS.mediumGray, marginTop: '3px' }}>{selectedYear - 1}</span>
                                                        </div>
                                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                            <div style={{ width: '100%', height: `${(totalExpenses / maxVal) * (chartHeight - 18)}px`, backgroundColor: COLORS.expenseColor, borderRadius: '3px 3px 0 0', minHeight: '4px' }} />
                                                            <span style={{ fontSize: '10px', color: COLORS.darkGray, fontWeight: '600', marginTop: '3px' }}>{selectedYear}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'center', marginTop: '8px' }}>
                                                    <div style={{ fontSize: '13px', fontWeight: '600', color: COLORS.expenseColor }}>{formatCurrency(totalExpenses)}</div>
                                                    <div style={{ fontSize: '11px', color: COLORS.mediumGray }}>
                                                        {totalExpenses >= totalExpensesPrev ? '+' : ''}{((totalExpenses - totalExpensesPrev) / (totalExpensesPrev || 1) * 100).toFixed(1)}%
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Profit Chart */}
                                    {(() => {
                                        const maxVal = Math.max(Math.abs(netProfit), Math.abs(netProfitPrev), 1);
                                        const chartHeight = 100;
                                        const formatYAxis = (val) => val >= 1000000 ? `€${(val/1000000).toFixed(1)}M` : val >= 1000 ? `€${(val/1000).toFixed(0)}K` : `€${val.toFixed(0)}`;
                                        return (
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '12px', color: COLORS.mediumGray, marginBottom: '8px', fontWeight: '600' }}>Net Profit</div>
                                                <div style={{ display: 'flex' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: `${chartHeight}px`, marginRight: '6px', paddingBottom: '18px' }}>
                                                        <span style={{ fontSize: '9px', color: COLORS.mediumGray, textAlign: 'right' }}>{formatYAxis(maxVal)}</span>
                                                        <span style={{ fontSize: '9px', color: COLORS.mediumGray, textAlign: 'right' }}>{formatYAxis(maxVal * 0.5)}</span>
                                                        <span style={{ fontSize: '9px', color: COLORS.mediumGray, textAlign: 'right' }}>€0</span>
                                                    </div>
                                                    <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '6px', height: `${chartHeight}px`, borderLeft: `1px solid ${COLORS.lightGray}`, borderBottom: `1px solid ${COLORS.lightGray}`, paddingLeft: '6px' }}>
                                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                            <div style={{ width: '100%', height: `${(Math.abs(netProfitPrev) / maxVal) * (chartHeight - 18)}px`, backgroundColor: '#BBDEFB', borderRadius: '3px 3px 0 0', minHeight: '4px' }} />
                                                            <span style={{ fontSize: '10px', color: COLORS.mediumGray, marginTop: '3px' }}>{selectedYear - 1}</span>
                                                        </div>
                                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                            <div style={{ width: '100%', height: `${(Math.abs(netProfit) / maxVal) * (chartHeight - 18)}px`, backgroundColor: '#4A90E2', borderRadius: '3px 3px 0 0', minHeight: '4px' }} />
                                                            <span style={{ fontSize: '10px', color: COLORS.darkGray, fontWeight: '600', marginTop: '3px' }}>{selectedYear}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'center', marginTop: '8px' }}>
                                                    <div style={{ fontSize: '13px', fontWeight: '600', color: COLORS.slainteBlue }}>{formatCurrency(netProfit)}</div>
                                                    <div style={{ fontSize: '11px', color: COLORS.mediumGray }}>
                                                        {netProfit >= netProfitPrev ? '+' : ''}{((netProfit - netProfitPrev) / (Math.abs(netProfitPrev) || 1) * 100).toFixed(1)}%
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Draft Notes Section */}
                            <div style={{
                                padding: '20px',
                                backgroundColor: '#fff9e6',
                                borderLeft: `4px solid #ffc107`,
                                borderRadius: '4px'
                            }}>
                                <h4 style={{ margin: '0 0 12px 0', color: '#856404', fontSize: '16px', fontWeight: '600' }}>
                                    ⚠️ DRAFT REPORT - Important Notes:
                                </h4>
                                <p style={{ fontWeight: 'bold', color: '#d32f2f', marginBottom: '12px' }}>
                                    This report is a DRAFT and should not be used for official submissions without review by a qualified accountant.
                                </p>
                                <ul style={{ margin: '8px 0', paddingLeft: '20px', color: '#856404' }}>
                                    <li style={{ marginBottom: '8px' }}>
                                        <strong>GMS Statements:</strong> {plData.grossIncomeData?.[selectedYear]?.gmsComplete
                                            ? `✓ All 12 months of GMS statements uploaded for ${selectedYear}`
                                            : plData.grossIncomeData?.[selectedYear]?.hasPCRSData
                                            ? `⚠ ${plData.grossIncomeData[selectedYear].gmsMonthsFound}/12 months of GMS statements uploaded. Missing: ${plData.grossIncomeData[selectedYear].gmsMissingMonths?.join(', ')}`
                                            : `✗ No GMS statements uploaded for ${selectedYear} - using bank NET instead of PCRS GROSS`}
                                    </li>
                                    <li style={{ marginBottom: '8px' }}>
                                        <strong>Income Calculation:</strong> {plData.grossIncomeData?.[selectedYear]?.hasPCRSData
                                            ? `✓ Using GROSS income (GMS: €${plData.grossIncomeData[selectedYear].gmsGross?.toLocaleString() || 0}, State Contracts grossed up, Other: bank)`
                                            : '⚠ Using bank deposits (NET) - upload PCRS statements for accurate GROSS income'}
                                    </li>
                                    <li style={{ marginBottom: '8px' }}>
                                        <strong>Motor Expenses:</strong> {motorExpenses[selectedYear] > 0
                                            ? `✓ Included: €${motorExpenses[selectedYear].toFixed(2)}`
                                            : '○ NOT calculated'}
                                    </li>
                                    <li style={{ marginBottom: '8px' }}>
                                        <strong>Depreciation:</strong> {depreciationExpenses[selectedYear] > 0
                                            ? `✓ Included: €${depreciationExpenses[selectedYear].toFixed(2)}`
                                            : '○ NOT calculated'}
                                    </li>
                                    <li style={{ marginBottom: '8px' }}>
                                        <strong>Period:</strong> {plData.reportPeriod?.isPartialYear
                                            ? `Year-to-date through ${plData.reportPeriod.cutoffDateString}`
                                            : 'Full calendar years'}
                                    </li>
                                </ul>
                                <p style={{ marginTop: '12px', fontStyle: 'italic', color: '#856404', fontSize: '13px' }}>
                                    Please review all figures with your accountant before using for tax returns or official purposes.
                                </p>
                            </div>
                        </div>

                        {/* Modal Footer - Export Buttons */}
                        <div style={{
                            display: 'flex',
                            gap: '12px',
                            padding: '1rem 1.5rem',
                            borderTop: `1px solid ${COLORS.lightGray}`,
                            backgroundColor: COLORS.backgroundGray,
                            flexShrink: 0
                        }}>
                            <button
                                onClick={exportAccountantPDF}
                                style={{
                                    backgroundColor: COLORS.slainteBlue,
                                    color: COLORS.white,
                                    padding: '10px 20px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    transition: 'background-color 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.slainteBlueDark}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.slainteBlue}
                            >
                                <FileText style={{ height: '18px', width: '18px', marginRight: '8px' }} />
                                Print/Save as PDF
                            </button>
                            <button
                                onClick={exportAccountantCSV}
                                style={{
                                    backgroundColor: COLORS.incomeColor,
                                    color: COLORS.white,
                                    padding: '10px 20px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    transition: 'background-color 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3DB0A8'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.incomeColor}
                            >
                                <Download style={{ height: '18px', width: '18px', marginRight: '8px' }} />
                                Export CSV
                            </button>
                            <div style={{ flex: 1 }} />
                            <button
                                onClick={() => setShowReportModal(false)}
                                style={{
                                    backgroundColor: COLORS.white,
                                    color: COLORS.darkGray,
                                    padding: '10px 20px',
                                    borderRadius: '8px',
                                    border: `1px solid ${COLORS.lightGray}`,
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.backgroundGray}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.white}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Success banner when report was generated (show briefly after modal is closed) */}
            {plData && !showReportModal && (
                <div style={{
                    backgroundColor: '#E8F5E9',
                    padding: '16px',
                    borderRadius: '8px',
                    border: `1px solid ${COLORS.incomeColor}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <CheckCircle style={{ height: '20px', width: '20px', color: COLORS.incomeColor, marginRight: '12px' }} />
                        <span style={{ fontSize: '14px', color: COLORS.darkGray }}>
                            <strong>{plData.reportPeriod?.isPartialYear ? 'Year to Date' : 'Full Year'} P&L Report</strong> generated and saved to your report library.
                        </span>
                    </div>
                    <button
                        onClick={() => setShowReportModal(true)}
                        style={{
                            backgroundColor: COLORS.slainteBlue,
                            color: COLORS.white,
                            padding: '8px 16px',
                            borderRadius: '6px',
                            border: 'none',
                            fontWeight: '500',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.slainteBlueDark}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.slainteBlue}
                    >
                        View Report
                    </button>
                </div>
            )}



            {/* Calculator Modals */}
            {showMotorCalculator && (
                <MotorExpenseCalculator
                    onClose={() => setShowMotorCalculator(false)}
                    onSave={setMotorExpenses}
                    currentExpenses={motorExpenses}
                    selectedYear={selectedYear}
                />
            )}

            {showDepreciationCalculator && (
                <DepreciationCalculator
                    onClose={() => setShowDepreciationCalculator(false)}
                    onSave={setDepreciationExpenses}
                    currentExpenses={depreciationExpenses}
                    selectedYear={selectedYear}
                    reportPeriod={plData?.reportPeriod}  // Add this line
                />
            )}
        </div>
    );
};

// Motor Expense Calculator Component
const MotorExpenseCalculator = ({ onClose, onSave, currentExpenses, selectedYear }) => {
    const [vehicles, setVehicles] = useState({
        [selectedYear]: [{ engineSize: '1201-1500cc', kilometers: 0 }],
        [selectedYear - 1]: [{ engineSize: '1201-1500cc', kilometers: 0 }]
    });

    const rates = {
        'up-to-1200cc': { tier1: 0.3937, tier2: 0.1967, tier3: 0.0984 },
        '1201-1500cc': { tier1: 0.4488, tier2: 0.2244, tier3: 0.1122 },
        'over-1500cc': { tier1: 0.5539, tier2: 0.2770, tier3: 0.1385 }
    };

    const calculateMotorExpense = (engineSize, kilometers) => {
        const rateKey = engineSize === 'up-to-1200cc' ? 'up-to-1200cc' :
            engineSize === '1201-1500cc' ? '1201-1500cc' : 'over-1500cc';
        const rate = rates[rateKey];

        if (kilometers <= 1500) {
            return kilometers * rate.tier1;
        } else if (kilometers <= 5500) {
            return (1500 * rate.tier1) + ((kilometers - 1500) * rate.tier2);
        } else {
            return (1500 * rate.tier1) + (4000 * rate.tier2) + ((kilometers - 5500) * rate.tier3);
        }
    };

    const addVehicle = (year) => {
        setVehicles(prev => ({
            ...prev,
            [year]: [...prev[year], { engineSize: '1201-1500cc', kilometers: 0 }]
        }));
    };

    const removeVehicle = (year, index) => {
        setVehicles(prev => ({
            ...prev,
            [year]: prev[year].filter((_, i) => i !== index)
        }));
    };

    const updateVehicle = (year, index, field, value) => {
        setVehicles(prev => ({
            ...prev,
            [year]: prev[year].map((vehicle, i) =>
                i === index ? { ...vehicle, [field]: field === 'kilometers' ? parseInt(value) || 0 : value } : vehicle
            )
        }));
    };

    const calculateYearTotal = (year) => {
        return vehicles[year].reduce((total, vehicle) =>
            total + calculateMotorExpense(vehicle.engineSize, vehicle.kilometers), 0
        );
    };

    const handleSave = () => {
        const newExpenses = {
            [selectedYear]: calculateYearTotal(selectedYear),
            [selectedYear - 1]: calculateYearTotal(selectedYear - 1)
        };
        onSave(newExpenses);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold">Motor Expense Calculator</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Current Year */}
                    <div className="bg-blue-50 p-4 rounded-lg">
                        <h4 className="font-semibold mb-4">{selectedYear}</h4>
                        {vehicles[selectedYear].map((vehicle, index) => (
                            <div key={index} className="bg-white p-3 rounded mb-3">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-medium">Vehicle {index + 1}</span>
                                    {vehicles[selectedYear].length > 1 && (
                                        <button
                                            onClick={() => removeVehicle(selectedYear, index)}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Engine Size</label>
                                        <select
                                            value={vehicle.engineSize}
                                            onChange={(e) => updateVehicle(selectedYear, index, 'engineSize', e.target.value)}
                                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                                        >
                                            <option value="up-to-1200cc">Up to 1,200cc</option>
                                            <option value="1201-1500cc">1,201 - 1,500cc</option>
                                            <option value="over-1500cc">Over 1,500cc</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Business Kilometers</label>
                                        <input
                                            type="number"
                                            value={vehicle.kilometers}
                                            onChange={(e) => updateVehicle(selectedYear, index, 'kilometers', e.target.value)}
                                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        Calculated: €{calculateMotorExpense(vehicle.engineSize, vehicle.kilometers).toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        ))}
                        <button
                            onClick={() => addVehicle(selectedYear)}
                            className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700"
                        >
                            Add Another Vehicle
                        </button>
                        <div className="mt-4 p-3 bg-white rounded">
                            <div className="font-semibold">Total {selectedYear}: €{calculateYearTotal(selectedYear).toFixed(2)}</div>
                        </div>
                    </div>

                    {/* Previous Year */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-semibold mb-4">{selectedYear - 1}</h4>
                        {vehicles[selectedYear - 1].map((vehicle, index) => (
                            <div key={index} className="bg-white p-3 rounded mb-3">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-medium">Vehicle {index + 1}</span>
                                    {vehicles[selectedYear - 1].length > 1 && (
                                        <button
                                            onClick={() => removeVehicle(selectedYear - 1, index)}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Engine Size</label>
                                        <select
                                            value={vehicle.engineSize}
                                            onChange={(e) => updateVehicle(selectedYear - 1, index, 'engineSize', e.target.value)}
                                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                                        >
                                            <option value="up-to-1200cc">Up to 1,200cc</option>
                                            <option value="1201-1500cc">1,201 - 1,500cc</option>
                                            <option value="over-1500cc">Over 1,500cc</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Business Kilometers</label>
                                        <input
                                            type="number"
                                            value={vehicle.kilometers}
                                            onChange={(e) => updateVehicle(selectedYear - 1, index, 'kilometers', e.target.value)}
                                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        Calculated: €{calculateMotorExpense(vehicle.engineSize, vehicle.kilometers).toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        ))}
                        <button
                            onClick={() => addVehicle(selectedYear - 1)}
                            className="w-full bg-gray-600 text-white py-2 rounded hover:bg-gray-700"
                        >
                            Add Another Vehicle
                        </button>
                        <div className="mt-4 p-3 bg-white rounded">
                            <div className="font-semibold">Total {selectedYear - 1}: €{calculateYearTotal(selectedYear - 1).toFixed(2)}</div>
                        </div>
                    </div>
                </div>

                {/* Rate Information */}
                <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
                    <h5 className="font-semibold mb-2">Irish Civil Service Mileage Rates (2024)</h5>
                    <div className="text-sm text-gray-700 space-y-1">
                        <p><strong>Up to 1,200cc:</strong> €0.39 (first 1,500km), €0.20 (1,501-5,500km), €0.10 (over 5,500km)</p>
                        <p><strong>1,201-1,500cc:</strong> €0.45 (first 1,500km), €0.22 (1,501-5,500km), €0.11 (over 5,500km)</p>
                        <p><strong>Over 1,500cc:</strong> €0.55 (first 1,500km), €0.28 (1,501-5,500km), €0.14 (over 5,500km)</p>
                    </div>
                </div>

                <div className="flex justify-end space-x-4 mt-6">
                    <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                        Save Motor Expenses
                    </button>
                </div>
            </div>
        </div>
    );
};

// Depreciation Calculator Component  
const DepreciationCalculator = ({ onClose, onSave, currentExpenses, selectedYear, reportPeriod }) => {
    const [assets, setAssets] = useState([
        { description: '', cost: 0, purchaseDate: '', rate: 12.5 }
    ]);

    const addAsset = () => {
        setAssets([...assets, { description: '', cost: 0, purchaseDate: '', rate: 12.5 }]);
    };

    const removeAsset = (index) => {
        setAssets(assets.filter((_, i) => i !== index));
    };

    const updateAsset = (index, field, value) => {
        setAssets(assets.map((asset, i) =>
            i === index ? { ...asset, [field]: field === 'cost' || field === 'rate' ? parseFloat(value) || 0 : value } : asset
        ));
    };

    const calculateDepreciation = (asset, year) => {
        if (!asset.cost || !asset.purchaseDate) return 0;

        const purchaseDate = new Date(asset.purchaseDate);
        const purchaseYear = purchaseDate.getFullYear();

        // Only depreciate if asset was owned during the year
        if (purchaseYear > year) return 0;

        const annualDepreciation = asset.cost * (asset.rate / 100);

        // If purchased mid-year, prorate depreciation
        if (purchaseYear === year) {
            const monthsOwned = 12 - purchaseDate.getMonth();
            return (annualDepreciation * monthsOwned) / 12;
        }

        // Full year depreciation for subsequent years
        return annualDepreciation;
    };

    const calculateYearTotal = (year) => {
        return assets.reduce((total, asset) => total + calculateDepreciation(asset, year), 0);
    };

    const handleSave = () => {
        const newExpenses = {
            [selectedYear]: calculateYearTotal(selectedYear),
            [selectedYear - 1]: calculateYearTotal(selectedYear - 1)
        };
        onSave(newExpenses);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold">Depreciation Calculator</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="space-y-4">
                    {assets.map((asset, index) => (
                        <div key={index} className="bg-gray-50 p-4 rounded-lg">
                            <div className="flex justify-between items-center mb-4">
                                <span className="font-medium">Asset {index + 1}</span>
                                {assets.length > 1 && (
                                    <button
                                        onClick={() => removeAsset(index)}
                                        className="text-red-500 hover:text-red-700"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Description</label>
                                    <input
                                        type="text"
                                        value={asset.description}
                                        onChange={(e) => updateAsset(index, 'description', e.target.value)}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                                        placeholder="e.g., Office Furniture"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Cost (€)</label>
                                    <input
                                        type="number"
                                        value={asset.cost}
                                        onChange={(e) => updateAsset(index, 'cost', e.target.value)}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Purchase Date</label>
                                    <input
                                        type="date"
                                        value={asset.purchaseDate}
                                        onChange={(e) => updateAsset(index, 'purchaseDate', e.target.value)}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Rate (%)</label>
                                    <input
                                        type="number"
                                        value={asset.rate}
                                        onChange={(e) => updateAsset(index, 'rate', e.target.value)}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                                        step="0.1"
                                        placeholder="12.5"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-4">
                                <div className="text-sm">
                                    <span className="font-medium">{selectedYear}: </span>
                                    €{calculateDepreciation(asset, selectedYear).toFixed(2)}
                                </div>
                                <div className="text-sm">
                                    <span className="font-medium">{selectedYear - 1}: </span>
                                    €{calculateDepreciation(asset, selectedYear - 1).toFixed(2)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <button
                    onClick={addAsset}
                    className="w-full mt-4 bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700"
                >
                    Add Another Asset
                </button>

                <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="font-semibold">Total {selectedYear}: €{calculateYearTotal(selectedYear).toFixed(2)}</div>
                    </div>
                    <div className="bg-gray-100 p-4 rounded-lg">
                        <div className="font-semibold">Total {selectedYear - 1}: €{calculateYearTotal(selectedYear - 1).toFixed(2)}</div>
                    </div>
                </div>

                <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
                    <h5 className="font-semibold mb-2">Depreciation Information</h5>
                    <div className="text-sm text-gray-700 space-y-1">
                        <p><strong>Default Rate:</strong> 12.5% (8-year useful life for furniture/equipment)</p>
                        <p><strong>Mid-year Rule:</strong> Assets purchased during the year are depreciated proportionally</p>
                        <p><strong>Method:</strong> Straight-line depreciation</p>
                    </div>
                </div>

                {/* Pro-rating notice for partial years */}
                {reportPeriod?.isPartialYear && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h5 className="font-semibold mb-2 text-blue-800">📅 Year to Date Report Notice</h5>
                        <div className="text-sm text-blue-700">
                            <p>Since this is a Year to Date report (through {reportPeriod.cutoffDateString}), depreciation calculations are not automatically pro-rated. Consider whether your annual depreciation amounts should be adjusted for the partial year period.</p>
                        </div>
                    </div>
                )}

                <div className="flex justify-end space-x-4 mt-6">
                    <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                        Save Depreciation
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExportReports;
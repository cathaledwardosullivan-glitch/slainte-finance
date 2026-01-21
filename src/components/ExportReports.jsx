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
                reportPeriod: period
            };

            // Initialize all categories with 0
            Object.keys(accountantMapping).forEach(category => {
                plResult.income[currentYear][category] = 0;
                plResult.income[previousYear][category] = 0;
                plResult.expenses[currentYear][category] = 0;
                plResult.expenses[previousYear][category] = 0;
            });

            // Debug: Log first few transactions to understand structure (remove in production)
            console.log('Processing transactions for P&L...');
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
                if (type === 'income') {
                    if (accountantCategory === 'Fee income') {
                        plResult.income[year]['Fee income'] = (plResult.income[year]['Fee income'] || 0) + amount;
                        processedCount++;
                    } else {
                        // Income categories might not all map to 'Fee income' - let's handle this
                        plResult.income[year]['Fee income'] = (plResult.income[year]['Fee income'] || 0) + amount;
                        processedCount++;
                    }
                } else if (type === 'expense') {
                    // Initialize to 0 if doesn't exist (for accountantLine values not in old mapping)
                    plResult.expenses[year][accountantCategory] = (plResult.expenses[year][accountantCategory] || 0) + amount;
                    processedCount++;
                }
                // Skip drawings as they don't go on P&L
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
            <li><strong>Income Figure:</strong> This represents NET INCOME as recorded in bank transactions (after withholding tax deduction). ${withholdingTaxData.total > 0 ? `Withholding tax has been calculated: €${withholdingTaxData.total.toLocaleString()} (GMS: €${withholdingTaxData.gmsWithholdingTax.toLocaleString()}, State Contracts: €${withholdingTaxData.stateContractTax.toLocaleString()}). Add this to Net Income to calculate GROSS income for tax purposes.` : 'To calculate GROSS income for tax purposes, withholding tax amounts must be gathered from 12 months of PCRS statements and added back to this figure.'}</li>
            <li><strong>Withholding Tax:</strong> ${withholdingTaxData.total > 0 ? `✓ Calculated from PCRS statements: €${withholdingTaxData.total.toLocaleString()} total for ${currentYear}` : '✗ NOT calculated - Upload PCRS GMS panel statements to calculate withholding tax automatically'}</li>
            <li><strong>Motor Expenses:</strong> ${motorExpenses[currentYear] > 0 || motorExpenses[currentYear - 1] > 0 ? `✓ Calculated and included (${currentYear}: €${motorExpenses[currentYear].toFixed(2)}, ${currentYear - 1}: €${motorExpenses[currentYear - 1].toFixed(2)})` : '✗ NOT calculated - Manual calculation required for private use adjustment'}</li>
            <li><strong>Depreciation:</strong> ${depreciationExpenses[currentYear] > 0 || depreciationExpenses[currentYear - 1] > 0 ? `✓ Calculated and included (${currentYear}: €${depreciationExpenses[currentYear].toFixed(2)}, ${currentYear - 1}: €${depreciationExpenses[currentYear - 1].toFixed(2)})` : '✗ NOT calculated - Capital allowances need to be calculated separately'}</li>
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

          <div class="notes">
              <h4>⚠️ DRAFT REPORT - Important Notes:</h4>
              <p class="important">This report is a DRAFT and should not be used for official submissions without review by a qualified accountant.</p>
              <ul>
                  <li><strong>Income Figure:</strong> This represents NET INCOME as recorded in bank transactions (after withholding tax deduction). ${withholdingTaxData.total > 0 ? `Withholding tax has been calculated: €${withholdingTaxData.total.toLocaleString()} (GMS: €${withholdingTaxData.gmsWithholdingTax.toLocaleString()}, State Contracts: €${withholdingTaxData.stateContractTax.toLocaleString()}). Add this to Net Income to calculate GROSS income for tax purposes.` : 'To calculate GROSS income for tax purposes, withholding tax amounts must be gathered from 12 months of PCRS statements and added back to this figure.'}</li>
                  <li><strong>Withholding Tax:</strong> ${withholdingTaxData.total > 0 ? `✓ Calculated from PCRS statements: €${withholdingTaxData.total.toLocaleString()} total for ${selectedYear}` : '✗ NOT calculated - Upload PCRS GMS panel statements to calculate withholding tax automatically'}</li>
                  <li><strong>Motor Expenses:</strong> ${motorExpenses[selectedYear] > 0 || motorExpenses[selectedYear - 1] > 0 ? `✓ Calculated and included (${selectedYear}: €${motorExpenses[selectedYear].toFixed(2)}, ${selectedYear - 1}: €${motorExpenses[selectedYear - 1].toFixed(2)})` : '✗ NOT calculated - Manual calculation required for private use adjustment'}</li>
                  <li><strong>Depreciation:</strong> ${depreciationExpenses[selectedYear] > 0 || depreciationExpenses[selectedYear - 1] > 0 ? `✓ Calculated and included (${selectedYear}: €${depreciationExpenses[selectedYear].toFixed(2)}, ${selectedYear - 1}: €${depreciationExpenses[selectedYear - 1].toFixed(2)})` : '✗ NOT calculated - Capital allowances need to be calculated separately'}</li>
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

        const csvRows = [
            [reportTitle, '', ''],
            [periodDescription, '', ''],
            ['', '', ''],
            ...(plData.reportPeriod?.isPartialYear ? [['Note: Year to Date report comparing same periods for accurate comparison', '', ''], ['', '', '']] : []),
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
            ['Net Divisible Profit', netProfit[selectedYear].toFixed(2), netProfit[selectedYear - 1].toFixed(2)]
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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* PRIMARY FEATURE: Professional Accountant P&L */}
            <div style={{
                backgroundColor: COLORS.white,
                padding: '24px',
                borderRadius: '8px',
                border: `2px solid ${COLORS.slainteBlue}`
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <div>
                        <h2 style={{
                            fontSize: '24px',
                            fontWeight: 'bold',
                            color: COLORS.darkGray,
                            display: 'flex',
                            alignItems: 'center'
                        }}>
                            <FileText style={{ height: '24px', width: '24px', marginRight: '12px', color: COLORS.slainteBlue }} />
                            Professional Accountant P&L Report
                        </h2>
                        <p style={{ color: COLORS.mediumGray, marginTop: '8px' }}>
                            Converts your detailed transactions into professional accountant format
                            ({Object.keys(accountantMapping).length} standardized expense lines)
                        </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{
                            backgroundColor: COLORS.highlightYellow,
                            color: COLORS.darkGray,
                            padding: '4px 12px',
                            borderRadius: '9999px',
                            fontSize: '14px',
                            fontWeight: '500',
                            marginBottom: '8px'
                        }}>
                            ⭐ Recommended
                        </div>
                        {transactions.length > 0 && (
                            <div style={{ fontSize: '14px', color: COLORS.mediumGray }}>
                                <div>{transactions.length} transactions loaded</div>
                                <div>{transactions.filter(t => new Date(t.date).getFullYear() === selectedYear).length} from {selectedYear} • {transactions.filter(t => new Date(t.date).getFullYear() === selectedYear - 1).length} from {selectedYear - 1}</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* P&L Generation Controls */}
                <div style={{
                    backgroundColor: COLORS.backgroundGray,
                    padding: '24px',
                    borderRadius: '8px',
                    marginBottom: '24px'
                }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                        gap: '24px'
                    }}>
                        {/* Left side: Generate P&L */}
                        <div>
                            <h4 style={{ fontWeight: '500', color: COLORS.slainteBlue, marginBottom: '12px' }}>Generate P&L Report</h4>
                            <p style={{ fontSize: '14px', color: COLORS.mediumGray, marginBottom: '16px' }}>
                                {reportPeriod.isPartialYear ? (
                                    <>
                                        Generate <strong>Year to Date</strong> P&L comparing {selectedYear} vs {selectedYear - 1}<br />
                                        <span style={{ color: COLORS.slainteBlue, fontWeight: '500' }}>
                                            Period: 1 Jan - {reportPeriod.cutoffDateString} (both years)
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        Generate <strong>Full Year</strong> P&L comparing {selectedYear} vs {selectedYear - 1}
                                    </>
                                )}
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div>
                                    <label style={{
                                        display: 'block',
                                        fontSize: '14px',
                                        fontWeight: '500',
                                        color: COLORS.slainteBlue,
                                        marginBottom: '4px'
                                    }}>Report Year</label>
                                    <select
                                        value={selectedYear}
                                        onChange={(e) => {
                                            const newYear = parseInt(e.target.value);
                                            if (setSelectedYear && newYear !== selectedYear) {
                                                setSelectedYear(newYear);
                                                // Clear P&L data when year changes - user needs to regenerate
                                                setPLData(null);
                                            }
                                        }}
                                        style={{
                                            width: '100%',
                                            border: `1px solid ${COLORS.lightGray}`,
                                            borderRadius: '6px',
                                            padding: '8px 12px',
                                            backgroundColor: COLORS.white
                                        }}
                                        disabled={availableYears.length === 0}
                                    >
                                        {availableYears.length > 0 ? (
                                            availableYears.map(year => (
                                                <option key={year} value={year}>{year}</option>
                                            ))
                                        ) : (
                                            <option value={selectedYear}>{selectedYear} (No data)</option>
                                        )}
                                    </select>
                                    <p style={{ fontSize: '12px', color: COLORS.slainteBlue, marginTop: '4px' }}>
                                        {reportPeriod.isPartialYear ? (
                                            <>
                                                Year to Date report: 1 Jan - {reportPeriod.cutoffDateString} • {transactions.filter(t => {
                                                    const date = new Date(t.date);
                                                    return date.getFullYear() === selectedYear && date <= reportPeriod.cutoffDate;
                                                }).length} transactions in period
                                            </>
                                        ) : (
                                            <>
                                                Will compare {selectedYear} vs {selectedYear - 1} • {transactions.filter(t => new Date(t.date).getFullYear() === selectedYear).length} transactions in {selectedYear}
                                            </>
                                        )}
                                        {plData && <span style={{ color: COLORS.expenseColor, fontWeight: '500', marginLeft: '8px' }}>→ Click "Generate P&L Report" to update</span>}
                                    </p>
                                </div>

                                <button
                                    onClick={processTransactionsForPL}
                                    disabled={transactions.length === 0 || processing}
                                    style={{
                                        width: '100%',
                                        backgroundColor: transactions.length === 0 || processing ? COLORS.mediumGray : COLORS.slainteBlue,
                                        color: COLORS.white,
                                        padding: '12px 16px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        cursor: transactions.length === 0 || processing ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: '500',
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
                                                height: '16px',
                                                width: '16px',
                                                border: `2px solid ${COLORS.white}`,
                                                borderTopColor: 'transparent',
                                                marginRight: '8px'
                                            }}></div>
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <Calculator style={{ height: '20px', width: '20px', marginRight: '8px' }} />
                                            Generate P&L Report
                                        </>
                                    )}
                                </button>

                                {transactions.length === 0 && (
                                    <p style={{ fontSize: '12px', color: COLORS.expenseColor }}>Upload transaction data first to generate P&L report</p>
                                )}
                            </div>
                        </div>

                        {/* Right side: Manual Calculations */}
                        <div>
                            <h4 style={{ fontWeight: '500', color: COLORS.slainteBlue, marginBottom: '12px' }}>Optional Manual Calculations</h4>
                            <p style={{ fontSize: '14px', color: COLORS.mediumGray, marginBottom: '16px' }}>
                                Add expenses not captured in transaction data:
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <button
                                    onClick={() => setShowMotorCalculator(true)}
                                    style={{
                                        width: '100%',
                                        backgroundColor: COLORS.slainteBlue,
                                        color: COLORS.white,
                                        padding: '8px 16px',
                                        borderRadius: '8px',
                                        border: `1px solid ${COLORS.slainteBlueDark}`,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        fontSize: '14px',
                                        transition: 'background-color 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.slainteBlueDark}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.slainteBlue}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <Car style={{ height: '16px', width: '16px', marginRight: '8px' }} />
                                        Motor Expenses Calculator
                                    </div>
                                    {motorExpenses[selectedYear] > 0 && (
                                        <span style={{
                                            backgroundColor: COLORS.white,
                                            color: COLORS.slainteBlue,
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                            fontWeight: '500'
                                        }}>
                                            {formatCurrency(motorExpenses[selectedYear])}
                                        </span>
                                    )}
                                </button>

                                <button
                                    onClick={() => setShowDepreciationCalculator(true)}
                                    style={{
                                        width: '100%',
                                        backgroundColor: COLORS.slainteBlue,
                                        color: COLORS.white,
                                        padding: '8px 16px',
                                        borderRadius: '8px',
                                        border: `1px solid ${COLORS.slainteBlueDark}`,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        fontSize: '14px',
                                        transition: 'background-color 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.slainteBlueDark}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.slainteBlue}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <Building style={{ height: '16px', width: '16px', marginRight: '8px' }} />
                                        Depreciation Calculator
                                    </div>
                                    {depreciationExpenses[selectedYear] > 0 && (
                                        <span style={{
                                            backgroundColor: COLORS.white,
                                            color: COLORS.slainteBlue,
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                            fontWeight: '500'
                                        }}>
                                            {formatCurrency(depreciationExpenses[selectedYear])}
                                        </span>
                                    )}
                                </button>

                                <p style={{ fontSize: '12px', color: COLORS.slainteBlue, marginTop: '8px' }}>
                                    💡 Add manual calculations first, then generate P&L report
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* P&L Results Display */}
                {plData && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* Success Message */}
                        <div style={{
                            backgroundColor: '#E8F5E9',
                            padding: '16px',
                            borderRadius: '8px',
                            border: `1px solid ${COLORS.incomeColor}`
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <CheckCircle style={{ height: '20px', width: '20px', color: COLORS.incomeColor, marginRight: '8px' }} />
                                <span style={{ fontSize: '14px', fontWeight: '500', color: COLORS.darkGray }}>
                                    {plData.reportPeriod?.isPartialYear ? (
                                        <>
                                            <strong>Year to Date</strong> P&L Report Generated Successfully!
                                            <span style={{ fontWeight: 'normal', marginLeft: '4px' }}>
                                                Comparing 1 Jan - {plData.reportPeriod.cutoffDateString} for {selectedYear} vs {selectedYear - 1}. Saved to your report library.
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <strong>Full Year</strong> P&L Report Generated Successfully!
                                            <span style={{ fontWeight: 'normal', marginLeft: '4px' }}>
                                                Report saved to your library. Ready to export.
                                            </span>
                                        </>
                                    )}
                                </span>
                            </div>
                        </div>
                        {/* P&L Table */}
                        <div style={{
                            backgroundColor: COLORS.white,
                            border: `1px solid ${COLORS.lightGray}`,
                            borderRadius: '8px',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                backgroundColor: COLORS.backgroundGray,
                                padding: '12px 24px',
                                borderBottom: `1px solid ${COLORS.lightGray}`
                            }}>
                                <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px', color: COLORS.darkGray }}>
                                    {practiceName}
                                </h2>
                                <h3 style={{ fontSize: '18px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {plData.reportPeriod?.isPartialYear ? 'Year to Date' : 'Full Year'} Profit & Loss Statement
                                    <span style={{
                                        backgroundColor: '#ff6b6b',
                                        color: 'white',
                                        padding: '4px 12px',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: 'bold'
                                    }}>DRAFT</span>
                                </h3>
                                <p style={{ fontSize: '14px', color: COLORS.mediumGray }}>
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
                                </div>
                            </div>
                        </div>

                        {/* Draft Notes Section */}
                        <div style={{
                            marginTop: '24px',
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
                                    <strong>Income Figure:</strong> This represents NET INCOME as recorded in bank transactions (after withholding tax deduction). {withholdingTaxData.total > 0
                                        ? `Withholding tax has been calculated: €${withholdingTaxData.total.toLocaleString()} (GMS: €${withholdingTaxData.gmsWithholdingTax.toLocaleString()}, State Contracts: €${withholdingTaxData.stateContractTax.toLocaleString()}). Add this to Net Income to calculate GROSS income for tax purposes.`
                                        : 'To calculate GROSS income for tax purposes, withholding tax amounts must be gathered from 12 months of PCRS statements and added back to this figure.'}
                                </li>
                                <li style={{ marginBottom: '8px' }}>
                                    <strong>Withholding Tax:</strong> {withholdingTaxData.total > 0
                                        ? `✓ Calculated from PCRS statements: €${withholdingTaxData.total.toLocaleString()} total for ${selectedYear}`
                                        : '✗ NOT calculated - Upload PCRS GMS panel statements to calculate withholding tax automatically'}
                                </li>
                                <li style={{ marginBottom: '8px' }}>
                                    <strong>Motor Expenses:</strong> {motorExpenses[selectedYear] > 0 || motorExpenses[selectedYear - 1] > 0
                                        ? `✓ Calculated and included (${selectedYear}: €${motorExpenses[selectedYear].toFixed(2)}, ${selectedYear - 1}: €${motorExpenses[selectedYear - 1].toFixed(2)})`
                                        : '✗ NOT calculated - Manual calculation required for private use adjustment'}
                                </li>
                                <li style={{ marginBottom: '8px' }}>
                                    <strong>Depreciation:</strong> {depreciationExpenses[selectedYear] > 0 || depreciationExpenses[selectedYear - 1] > 0
                                        ? `✓ Calculated and included (${selectedYear}: €${depreciationExpenses[selectedYear].toFixed(2)}, ${selectedYear - 1}: €${depreciationExpenses[selectedYear - 1].toFixed(2)})`
                                        : '✗ NOT calculated - Capital allowances need to be calculated separately'}
                                </li>
                                <li style={{ marginBottom: '8px' }}>
                                    <strong>Classification:</strong> Some transactions may be partially classified or unclassified. Review the transaction list for accuracy.
                                </li>
                                <li style={{ marginBottom: '8px' }}>
                                    <strong>Period:</strong> {plData.reportPeriod?.isPartialYear
                                        ? `This is a YEAR-TO-DATE report covering transactions up to ${plData.reportPeriod.cutoffDateString}. Full year figures will differ.`
                                        : 'This report covers full calendar years.'}
                                </li>
                            </ul>
                            <p style={{ marginTop: '12px', fontStyle: 'italic', color: '#856404' }}>
                                Please review all figures with your accountant before using for tax returns or official purposes.
                            </p>
                        </div>

                        {/* Export Buttons */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                            <button
                                onClick={exportAccountantPDF}
                                style={{
                                    backgroundColor: COLORS.slainteBlue,
                                    color: COLORS.white,
                                    padding: '12px 24px',
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
                                <FileText style={{ height: '20px', width: '20px', marginRight: '8px' }} />
                                Print/Save as PDF
                            </button>
                            <button
                                onClick={exportAccountantCSV}
                                style={{
                                    backgroundColor: COLORS.incomeColor,
                                    color: COLORS.white,
                                    padding: '12px 24px',
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
                                <Download style={{ height: '20px', width: '20px', marginRight: '8px' }} />
                                Export CSV (Data)
                            </button>
                            <button
                                onClick={processTransactionsForPL}
                                disabled={processing}
                                style={{
                                    backgroundColor: processing ? COLORS.mediumGray : COLORS.mediumGray,
                                    color: COLORS.white,
                                    padding: '12px 24px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    fontWeight: '500',
                                    cursor: processing ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    transition: 'background-color 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    if (!processing) e.currentTarget.style.backgroundColor = COLORS.darkGray;
                                }}
                                onMouseLeave={(e) => {
                                    if (!processing) e.currentTarget.style.backgroundColor = COLORS.mediumGray;
                                }}
                            >
                                {processing ? (
                                    <>
                                        <div style={{
                                            animation: 'spin 1s linear infinite',
                                            borderRadius: '50%',
                                            height: '16px',
                                            width: '16px',
                                            border: `2px solid ${COLORS.white}`,
                                            borderTopColor: 'transparent',
                                            marginRight: '8px'
                                        }}></div>
                                        Regenerating...
                                    </>
                                ) : (
                                    <>
                                        <Calculator style={{ height: '20px', width: '20px', marginRight: '8px' }} />
                                        Regenerate P&L
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Summary Stats */}
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <h4 className="text-lg font-semibold mb-3">{selectedYear}</h4>
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="bg-green-50 p-4 rounded-lg">
                                        <div className="text-sm text-gray-600 mb-1">Income</div>
                                        <div className="text-lg font-bold text-green-700">{formatCurrency(totalIncome)}</div>
                                    </div>
                                    <div className="bg-red-50 p-4 rounded-lg">
                                        <div className="text-sm text-gray-600 mb-1">Expenses</div>
                                        <div className="text-lg font-bold text-red-700">{formatCurrency(totalExpenses)}</div>
                                    </div>
                                    <div className="bg-blue-50 p-4 rounded-lg">
                                        <div className="text-sm text-gray-600 mb-1">Net Profit</div>
                                        <div className="text-lg font-bold text-blue-700">{formatCurrency(netProfit)}</div>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h4 className="text-lg font-semibold mb-3">{selectedYear - 1}</h4>
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="bg-green-50 p-4 rounded-lg">
                                        <div className="text-sm text-gray-600 mb-1">Income</div>
                                        <div className="text-lg font-bold text-green-700">{formatCurrency(totalIncomePrev)}</div>
                                    </div>
                                    <div className="bg-red-50 p-4 rounded-lg">
                                        <div className="text-sm text-gray-600 mb-1">Expenses</div>
                                        <div className="text-lg font-bold text-red-700">{formatCurrency(totalExpensesPrev)}</div>
                                    </div>
                                    <div className="bg-blue-50 p-4 rounded-lg">
                                        <div className="text-sm text-gray-600 mb-1">Net Profit</div>
                                        <div className="text-lg font-bold text-blue-700">{formatCurrency(netProfitPrev)}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Processing Summary */}
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <div className="flex items-center mb-2">
                                <Calculator className="h-5 w-5 mr-2 text-gray-600" />
                                <span className="font-medium">Processing Summary</span>
                            </div>
                            <p className="text-sm text-gray-600">
                                Processed {transactions.length} transactions from your detailed system into {Object.keys(plData.expenses[selectedYear]).filter(key => plData.expenses[selectedYear][key] > 0).length} expense categories matching your accountant's format.
                            </p>
                        </div>
                    </div>
                )}

                {/* Year Changed Warning */}
                {!plData && availableYears.includes(selectedYear) && transactions.filter(t => new Date(t.date).getFullYear() === selectedYear).length > 0 && (
                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                        <div className="flex items-start">
                            <AlertCircle className="h-5 w-5 text-orange-600 mr-3 mt-0.5" />
                            <div>
                                <h4 className="font-medium text-orange-900 mb-1">Report Year Changed</h4>
                                <p className="text-sm text-orange-800">
                                    You've selected {selectedYear} for reporting. Click "Generate P&L Report" below to create the {selectedYear} vs {selectedYear - 1} comparison.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Instructions when no P&L generated yet */}
                {!plData && transactions.length > 0 && (
                    <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                        <div className="flex items-start">
                            <CheckCircle className="h-5 w-5 text-green-600 mr-3 mt-0.5" />
                            <div>
                                <h3 className="font-medium text-green-900 mb-2">Ready to Generate P&L Report</h3>
                                <p className="text-sm text-green-800 mb-3">
                                    Found {transactions.length} transactions in your system. Ready to convert to professional accountant format.
                                </p>
                                <ul className="text-sm text-green-700 space-y-1">
                                    {reportPeriod.isPartialYear ? (
                                        <>
                                            <li>• <strong>Year to Date Report:</strong> Will compare 1 Jan - {reportPeriod.cutoffDateString} for both years</li>
                                            <li>• <strong>Smart Analysis:</strong> Latest transaction is {reportPeriod.cutoffDateString} (before 25 Dec), so using partial year comparison</li>
                                            <li>• Converts {Object.keys(accountantMapping).length} detailed categories to accountant's format</li>
                                        </>
                                    ) : (
                                        <>
                                            <li>• <strong>Full Year Report:</strong> Will analyze complete {selectedYear} vs {selectedYear - 1} transactions</li>
                                            <li>• Converts {Object.keys(accountantMapping).length} detailed categories to accountant's 23-line format</li>
                                            <li>• Add manual calculations first (optional), then click "Generate P&L Report"</li>
                                        </>
                                    )}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                {/* Instructions when no transaction data */}
                {transactions.length === 0 && (
                    <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200">
                        <div className="flex items-start">
                            <AlertCircle className="h-5 w-5 text-yellow-600 mr-3 mt-0.5" />
                            <div>
                                <h3 className="font-medium text-yellow-900 mb-2">No Transaction Data Found</h3>
                                <p className="text-sm text-yellow-800 mb-3">
                                    To generate your Professional P&L Report:
                                </p>
                                <ol className="text-sm text-yellow-700 space-y-1 list-decimal list-inside">
                                    <li>Go to the "Upload Data" section to import your transaction data</li>
                                    <li>Return here and click "Generate P&L Report"</li>
                                    <li>Export the result as PDF or CSV to share with your accountant</li>
                                </ol>
                            </div>
                        </div>
                    </div>
                )}
            </div>


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
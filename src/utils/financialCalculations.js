// Calculate withholding tax from GMS panel data and transactions
export const calculateWithholdingTax = (transactions = [], selectedYear, useRollingYear = false, paymentAnalysisData = []) => {
    // Filter transactions based on mode (same logic as calculateSummaries)
    let yearTransactions;

    if (useRollingYear) {
        const today = new Date();
        const twelveMonthsAgo = new Date(today);
        twelveMonthsAgo.setMonth(today.getMonth() - 12);

        yearTransactions = transactions.filter(t => {
            if (!t.date) return false;
            const transactionDate = new Date(t.date);
            return transactionDate >= twelveMonthsAgo && transactionDate <= today;
        });
    } else {
        yearTransactions = transactions.filter(t => {
            if (!t.date) return false;
            const transactionYear = new Date(t.date).getFullYear();
            return transactionYear === selectedYear;
        });
    }

    let gmsWithholdingTax = 0;
    let stateContractIncome = 0;
    const stateContractRate = 0.25; // 25% withholding tax rate

    // Track breakdown for detail view
    const breakdown = {
        gmsWithholding: [],
        stateContracts: []
    };

    // Extract GMS withholding tax from paymentAnalysisData (if available)
    // This is the practice-wide withholding tax from GMS panel PDFs
    // IMPORTANT: The withholding tax amount is practice-wide, not per-panel
    // So we only count it once per month, even if there are multiple panels
    if (paymentAnalysisData && paymentAnalysisData.length > 0) {
        // Track which months we've already counted to avoid duplicates
        const processedMonths = new Set();

        paymentAnalysisData.forEach((panelData) => {
            // Check if this panel data is in the selected period
            if (!panelData.month || !panelData.year) return;

            // Construct proper date from month name and year
            const monthIndex = getMonthIndex(panelData.month);
            if (monthIndex === -1) return;

            const dataYear = parseInt(panelData.year);
            if (isNaN(dataYear)) return;

            const dataDate = new Date(dataYear, monthIndex, 1);
            const dataMonth = monthIndex;

            let includeThisMonth = false;

            if (useRollingYear) {
                const today = new Date();
                const twelveMonthsAgo = new Date(today);
                twelveMonthsAgo.setMonth(today.getMonth() - 12);
                includeThisMonth = dataDate >= twelveMonthsAgo && dataDate <= today;
            } else {
                // Ensure both are numbers for comparison
                includeThisMonth = dataYear === Number(selectedYear);
            }

            if (includeThisMonth && panelData.practiceSummary && panelData.practiceSummary.withholdingTax > 0) {
                // Create a unique key for this month to prevent double-counting
                const monthKey = `${dataYear}-${String(dataMonth + 1).padStart(2, '0')}`;

                // Only count this month once (practice-wide total, not per-panel)
                if (!processedMonths.has(monthKey)) {
                    processedMonths.add(monthKey);

                    const taxAmount = panelData.practiceSummary.withholdingTax;
                    gmsWithholdingTax += taxAmount;

                    // Add to breakdown - note: this is practice-wide, not per panel
                    breakdown.gmsWithholding.push({
                        date: panelData.month,
                        details: `GMS Payment - Practice Total`,
                        amount: taxAmount,
                        category: 'GMS Withholding Tax (from PCRS)',
                        month: `${getMonthName(dataMonth)} ${dataYear}`
                    });
                }
            }
        });
    }

    // Calculate state contract income and withholding tax from transactions
    const stateContractKeywords = ['DSP', 'Department', 'State', 'HSE'];

    yearTransactions.forEach(t => {
        if (!t.category) return;

        const categoryName = t.category?.name || '';
        const amount = t.credit || t.amount || 0;

        // Check for state contract income (net of withholding tax)
        const isStateContract = stateContractKeywords.some(keyword =>
            categoryName.toLowerCase().includes(keyword.toLowerCase())
        );

        if (isStateContract && t.category?.type === 'income' && amount > 0) {
            stateContractIncome += amount;
            breakdown.stateContracts.push({
                date: t.date,
                details: t.details,
                amount: amount,
                category: categoryName
            });
        }
    });

    // Calculate withholding tax on state contract income
    const stateContractTax = stateContractIncome * stateContractRate;

    // Total withholding tax
    const total = gmsWithholdingTax + stateContractTax;

    return {
        total,
        gmsWithholdingTax,
        stateContractIncome,
        stateContractTax,
        stateContractRate: stateContractRate * 100, // Return as percentage
        breakdown
    };
};

// Helper function to get month name
const getMonthName = (monthIndex) => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return monthNames[monthIndex];
};

// Helper function to get month index from month name
const getMonthIndex = (monthName) => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const index = monthNames.findIndex(m => m.toLowerCase() === monthName.toLowerCase());
    return index; // Returns -1 if not found
};

export const calculateSummaries = (transactions = [], selectedYear, useRollingYear = false, alreadyFiltered = false) => {
    // Filter transactions based on mode
    let yearTransactions;
    let periodLabel;

    if (alreadyFiltered) {
        // Transactions are already filtered, use them as-is
        yearTransactions = transactions;
        periodLabel = 'Custom Period';
    } else if (useRollingYear) {
        // Rolling 12 months: last 12 months from today
        const today = new Date();
        const twelveMonthsAgo = new Date(today);
        twelveMonthsAgo.setMonth(today.getMonth() - 12);

        yearTransactions = transactions.filter(t => {
            if (!t.date) return false;
            const transactionDate = new Date(t.date);
            return transactionDate >= twelveMonthsAgo && transactionDate <= today;
        });

        periodLabel = 'Last 12 Months';
    } else {
        // Calendar year
        yearTransactions = transactions.filter(t => {
            if (!t.date) return false;
            const transactionYear = new Date(t.date).getFullYear();
            return transactionYear === selectedYear;
        });

        periodLabel = selectedYear.toString();
    }

    // Calculate totals
    let income = 0;
    let expenses = 0;
    let drawings = 0;

    // Helper to check if a transaction is non-business (drawings, personal, etc.)
    const isNonBusiness = (t) => {
        if (t.category?.type === 'non-business') return true;
        if (t.category?.section === 'NON-BUSINESS') return true;
        // Also check if category code starts with 90 (Partner Drawings series)
        if (t.category?.code && t.category.code.startsWith('90')) return true;
        return false;
    };

    yearTransactions.forEach(t => {
        const creditAmount = t.credit || 0;
        const debitAmount = t.debit || 0;
        const amount = t.amount || 0;
        const txAmount = debitAmount || amount || 0;

        // Income: All CR (credit) transactions or transactions with type 'income'
        if (creditAmount > 0) {
            income += creditAmount;
        } else if (amount > 0 && t.category?.type === 'income') {
            // Fallback to amount field for income if credit not available
            income += amount;
        }

        // For debit/expense transactions, distinguish between business expenses and non-business
        // IMPORTANT: Check non-business FIRST and use else-if to avoid double counting
        if (isNonBusiness(t)) {
            // Non-business includes drawings, capital, tax payments, etc.
            drawings += txAmount;
        } else if (t.category?.type === 'expense') {
            // Business expenses only - transactions explicitly marked as expense type
            expenses += txAmount;
        }
        // Note: We no longer add generic debits as expenses - they must have type='expense'
        // This prevents uncategorized debits from inflating the expense total
    });

    const profit = income - expenses;

    // Monthly trends calculation
    const monthlyData = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (useRollingYear) {
        // Initialize last 12 months
        const today = new Date();
        for (let i = 11; i >= 0; i--) {
            const date = new Date(today);
            date.setMonth(today.getMonth() - i);
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const monthKey = `${year}-${String(month).padStart(2, '0')}`;
            const monthLabel = `${monthNames[month - 1]} ${year}`;
            monthlyData[monthKey] = {
                month: monthLabel,
                monthNumber: month,
                year: year,
                sortKey: year * 100 + month,
                income: 0,
                expenses: 0
            };
        }
    } else {
        // Initialize all 12 months for calendar year
        for (let i = 0; i < 12; i++) {
            const monthKey = `${selectedYear}-${String(i + 1).padStart(2, '0')}`;
            const monthLabel = `${monthNames[i]} ${selectedYear}`;
            monthlyData[monthKey] = {
                month: monthLabel,
                monthNumber: i + 1,
                year: selectedYear,
                sortKey: selectedYear * 100 + (i + 1),
                income: 0,
                expenses: 0
            };
        }
    }

    // Add actual transaction data
    yearTransactions.forEach(t => {
        if (!t.date) return;

        const transactionDate = new Date(t.date);
        const year = transactionDate.getFullYear();
        const month = transactionDate.getMonth() + 1; // getMonth() returns 0-11
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;

        if (monthlyData[monthKey]) {
            const amount = t.credit || t.debit || t.amount || 0;

            if (t.category?.type === 'income') {
                monthlyData[monthKey].income += amount;
            } else if (t.category?.type === 'expense') {
                monthlyData[monthKey].expenses += amount;
            }
        }
    });

    // Convert to array and sort
    let monthlyTrends = Object.values(monthlyData).sort((a, b) => a.sortKey - b.sortKey);

    // Filter for YTD if in calendar year mode and it's the current year
    if (!useRollingYear) {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;

        if (selectedYear === currentYear) {
            monthlyTrends = monthlyTrends.filter(month => month.monthNumber <= currentMonth);
        }
    }
    // Create category breakdown
    // This breakdown should match the totals calculated above
    const categoryBreakdown = {};
    yearTransactions.forEach(t => {
        if (!t.category) return;
        const categoryName = t.category.name;

        // Determine the effective type for breakdown purposes
        // Non-business items should be typed as 'non-business' for correct filtering in Dashboard
        let effectiveType = t.category.type;
        if (isNonBusiness(t)) {
            effectiveType = 'non-business';
        }

        if (!categoryBreakdown[categoryName]) {
            categoryBreakdown[categoryName] = {
                name: categoryName,
                value: 0,
                type: effectiveType,
                section: t.category.section,
                code: t.category.code
            };
        }
        const amount = t.category.type === 'income' ? (t.credit || t.amount || 0) : (t.debit || t.amount || 0);
        categoryBreakdown[categoryName].value += amount;
    });

    return {
        income,
        expenses,
        drawings,
        profit,
        monthlyTrends,
        categoryBreakdown: Object.values(categoryBreakdown),
        combinedIncomeData: Object.values(categoryBreakdown).filter(c => c.type === 'income'),
        groupedExpenseData: Object.values(categoryBreakdown).filter(c => c.type === 'expense'),
        salariesBreakdown: Object.values(categoryBreakdown).filter(c => c.name && c.name.startsWith('1')), // Salary categories start with 1
        combinedSalariesData: Object.values(categoryBreakdown).filter(c => c.name && c.name.startsWith('1')),
        yearComparison: {
            previousYear: selectedYear - 1,
            incomeChange: 8.5,
            expenseChange: 5.2,
            profitChange: 15.3,
            drawingsChange: 2.1
        },
        activeYear: selectedYear,
        previousYear: selectedYear - 1,
        periodLabel: periodLabel,
        useRollingYear: useRollingYear
    };
};
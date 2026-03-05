import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import {
    Activity,
    BarChart3,
    Tag,
    MessageCircle,
    FileText,
    ArrowUp,
    ArrowDown,
    CheckCircle,
    AlertCircle,
    Send,
    Mail,
    Download,
    User,
    TrendingUp,
    PieChart,
    Upload,
    Eye,
    X,
    Calendar,
    Cloud
} from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart as RechartsPieChart,
    Pie,
    Cell
} from 'recharts';
import { useAppContext } from '../context/AppContext';
import { usePracticeProfile } from '../hooks/usePracticeProfile';
import { calculateSummaries } from '../utils/financialCalculations';
import { getLatestMonthData } from '../utils/paymentCalculations';
import { parseArtifactResponse } from '../utils/artifactBuilder';
import { DEMO_PROFILE, generateDemoTransactions, generateDemoGMSPanelData, DEMO_CATEGORY_MAPPING } from '../data/demoData';
import { saveTransactions, saveCategoryMapping } from '../utils/storageUtils';
import * as storage from '../storage/practiceProfileStorage';
import COLORS from '../utils/colors';
import { MODELS } from '../data/modelConfig';
import SlainteLogo from './SlainteLogo';
import SyncManager from './SyncManager';

const MobileLayout = () => {
    const [currentTab, setCurrentTab] = useState('dashboard');
    const [selectedMetric, setSelectedMetric] = useState(null);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [isLoadingChat, setIsLoadingChat] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [showApiKeyInput, setShowApiKeyInput] = useState(false);
    const [viewingArtifact, setViewingArtifact] = useState(null);
    const [artifacts, setArtifacts] = useState([]);
    const [viewingGMSReport, setViewingGMSReport] = useState(null);
    // Scroll to top whenever tab changes
    React.useEffect(() => {
        window.scrollTo(0, 0);
    }, [currentTab]);

    // Load API key on mount
    React.useEffect(() => {
        const loadApiKey = async () => {
            let savedKey = null;
            // Check Electron storage first
            if (window.electronAPI?.isElectron) {
                savedKey = await window.electronAPI.getLocalStorage('claude_api_key');
            }
            // Fallback to localStorage
            if (!savedKey) {
                savedKey = localStorage.getItem('anthropic_api_key');
            }
            if (savedKey) {
                setApiKey(savedKey);
            }
        };
        loadApiKey();
    }, []);

    // Get data from context
    const contextData = useAppContext();
    const {
        transactions = [],
        setTransactions,  // Add this
        unidentifiedTransactions = [],
        setUnidentifiedTransactions,  // Add this
        paymentAnalysisData = [],  // ← Add this
        setPaymentAnalysisData,
        selectedYear = new Date().getFullYear(),
        setSelectedYear,
        setLearnedIdentifiers,  // Add this
        getAvailableYears,
        categoryMapping = [],
        setCategoryMapping
    } = contextData;
    // ADD THIS IMPORT FUNCTION HERE
    const importDataFromDesktop = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);

                if (!importedData.version) {
                    throw new Error('Invalid file format');
                }

                localStorage.setItem('gp_finance_transactions', JSON.stringify(importedData.transactions || []));
                localStorage.setItem('gp_finance_unidentified', JSON.stringify(importedData.unidentifiedTransactions || []));
                localStorage.setItem('gp_finance_category_mapping', JSON.stringify(importedData.categoryMapping || []));
                localStorage.setItem('gp_finance_payment_analysis', JSON.stringify(importedData.paymentAnalysisData || []));
                localStorage.setItem('gp_finance_saved_reports', JSON.stringify(importedData.savedReports || []));

                if (importedData.learnedIdentifiers) {
                    localStorage.setItem('gp_finance_learned_identifiers', JSON.stringify(importedData.learnedIdentifiers));
                }

                if (importedData.settings) {
                    localStorage.setItem('gp_finance_settings', JSON.stringify(importedData.settings));
                }

                alert(`Data imported successfully!\n\nImported:\n• ${importedData.transactions?.length || 0} transactions\n• ${importedData.savedReports?.length || 0} reports\n\nReloading app...`);

                window.location.reload();
            } catch (error) {
                alert('Error importing file: ' + error.message);
                console.error('Import error:', error);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };
    const categorizeTransaction = contextData.categorizeTransaction || (() => { });

    // Get practice profile context
    const { getCiaranContext, completeSetup } = usePracticeProfile();

    // Load demo data function
    const loadDemoData = () => {
        if (!window.confirm('Load demo data? This will replace any existing data.')) {
            return;
        }

        const demoTransactions = generateDemoTransactions();
        const demoGMSData = generateDemoGMSPanelData();

        // Save to localStorage
        saveTransactions(demoTransactions);
        saveCategoryMapping(DEMO_CATEGORY_MAPPING);
        localStorage.setItem('gp_finance_payment_analysis', JSON.stringify(demoGMSData));
        storage.save(DEMO_PROFILE);
        completeSetup();

        // Set in context
        setTransactions(demoTransactions);
        setCategoryMapping(DEMO_CATEGORY_MAPPING);
        setPaymentAnalysisData(demoGMSData);

        alert('Demo data loaded successfully! Refresh the page to see all changes.');
        window.location.reload();
    };

    const summaries = calculateSummaries(transactions, selectedYear);
    const profit = summaries.income - summaries.expenses;
    const profitMargin = summaries.income > 0 ? ((profit / summaries.income) * 100).toFixed(1) : 0;
    const latestPaymentData = getLatestMonthData(paymentAnalysisData, selectedYear);

    // Simplified categories for mobile labeling (7 main categories)
    const simplifiedCategories = [
        { code: '1', name: 'Income', type: 'income' },
        { code: '2', name: 'Staff Costs', type: 'expense' },
        { code: '3', name: 'Premises Costs', type: 'expense' },
        { code: '4', name: 'Medical & Clinical', type: 'expense' },
        { code: '5', name: 'Administration', type: 'expense' },
        { code: '6', name: 'Professional Fees', type: 'expense' },
        { code: '7', name: 'Partner Drawings', type: 'expense' }
    ];

    // Calculate real category breakdowns from transactions
    const calculateCategoryBreakdown = React.useMemo(() => {
        // Filter transactions for selected year
        const yearTransactions = transactions.filter(t => {
            const txDate = new Date(t.date);
            return txDate.getFullYear() === selectedYear && t.category;
        });

        // Group by category
        const categoryTotals = {};
        let totalIncome = 0;
        let totalExpenses = 0;

        yearTransactions.forEach(tx => {
            const categoryName = tx.category.name || 'Uncategorized';
            const categoryType = tx.category.type || 'expense';

            // Calculate transaction amount
            let amount = 0;
            if (tx.debit) {
                amount = -Math.abs(tx.debit);
            } else if (tx.credit) {
                amount = Math.abs(tx.credit);
            } else if (tx.amount) {
                amount = tx.amount;
            }

            // Add to category totals
            if (!categoryTotals[categoryName]) {
                categoryTotals[categoryName] = {
                    category: categoryName,
                    type: categoryType,
                    amount: 0
                };
            }
            categoryTotals[categoryName].amount += Math.abs(amount);

            // Track income vs expenses
            if (categoryType === 'income' || amount > 0) {
                totalIncome += Math.abs(amount);
            } else {
                totalExpenses += Math.abs(amount);
            }
        });

        // Convert to arrays and calculate percentages
        const incomeBreakdown = Object.values(categoryTotals)
            .filter(cat => cat.type === 'income')
            .map(cat => ({
                category: cat.category,
                amount: cat.amount,
                percentage: totalIncome > 0 ? (cat.amount / totalIncome) * 100 : 0
            }))
            .sort((a, b) => b.amount - a.amount);

        const expenseBreakdown = Object.values(categoryTotals)
            .filter(cat => cat.type === 'expense')
            .map(cat => ({
                category: cat.category,
                amount: cat.amount,
                percentage: totalExpenses > 0 ? (cat.amount / totalExpenses) * 100 : 0
            }))
            .sort((a, b) => b.amount - a.amount);

        return { incomeBreakdown, expenseBreakdown };
    }, [transactions, selectedYear]);

    // Format currency for mobile
    const formatCurrency = (amount) => {
        if (typeof amount !== 'number') return '€0';
        // Round to whole number (no decimals)
        const rounded = Math.round(Math.abs(amount));
        return `€${rounded.toLocaleString()}`;
    };

    // Get change indicator
    const getChangeIndicator = (positive) => positive ?
        <ArrowUp className="h-4 w-4" style={{ color: COLORS.incomeColor }} /> :
        <ArrowDown className="h-4 w-4" style={{ color: COLORS.expenseColor }} />;

    // Detail Modal Component
    const DetailModal = ({ metric, onClose }) => {
        if (!metric) return null;

        let data = [];
        let title = '';
        let totalAmount = 0;

        switch (metric) {
            case 'income':
                data = calculateCategoryBreakdown.incomeBreakdown;
                title = 'Income Breakdown';
                totalAmount = summaries.income;
                break;
            case 'expenses':
                data = calculateCategoryBreakdown.expenseBreakdown;
                title = 'Expense Breakdown';
                totalAmount = summaries.expenses;
                break;
            case 'profit':
                title = 'Profit Analysis';
                totalAmount = profit;
                break;
        }

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div style={{ backgroundColor: COLORS.white }} className="rounded-lg w-full max-w-sm max-h-[85vh] overflow-hidden">
                    <div className="flex items-center justify-between p-4" style={{ borderBottom: `1px solid ${COLORS.lightGray}` }}>
                        <h2 className="text-lg font-bold" style={{ color: COLORS.darkGray }}>{title}</h2>
                        <button onClick={onClose} className="p-2 rounded-lg" style={{ backgroundColor: 'transparent' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${COLORS.lightGray}40`} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 64px)' }}>
                        <div className="rounded-lg p-4 mb-4" style={{ backgroundColor: COLORS.backgroundGray }}>
                            <div className="text-center">
                                <p className="text-sm" style={{ color: COLORS.mediumGray }}>Total {title.split(' ')[0]}</p>
                                <p className="text-2xl font-bold" style={{ color: metric === 'income' ? COLORS.incomeColor : metric === 'expenses' ? COLORS.expenseColor : COLORS.slainteBlue }}>
                                    {formatCurrency(totalAmount)}
                                </p>
                                {metric === 'profit' && (
                                    <p className="text-sm mt-1" style={{ color: COLORS.mediumGray }}>
                                        {summaries.income > 0 ? ((totalAmount / summaries.income) * 100).toFixed(1) : 0}% profit margin
                                    </p>
                                )}
                            </div>
                        </div>

                        {metric === 'profit' ? (
                            <div className="space-y-3">
                                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                    <div className="flex justify-between items-center">
                                        <span className="font-medium text-green-700">Total Income</span>
                                        <span className="text-lg font-bold text-green-600">{formatCurrency(summaries.income)}</span>
                                    </div>
                                </div>
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                    <div className="flex justify-between items-center">
                                        <span className="font-medium text-red-700">Total Expenses</span>
                                        <span className="text-lg font-bold text-red-600">{formatCurrency(summaries.expenses)}</span>
                                    </div>
                                </div>
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                    <div className="flex justify-between items-center">
                                        <span className="font-medium text-blue-700">Net Profit</span>
                                        <span className="text-lg font-bold text-blue-600">{formatCurrency(profit)}</span>
                                    </div>
                                </div>
                            </div>
                        ) : data.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-sm" style={{ color: COLORS.mediumGray }}>
                                    No categorized transactions yet.
                                </p>
                                <p className="text-xs mt-2" style={{ color: COLORS.mediumGray }}>
                                    Label your transactions to see breakdown by category.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {data.map((item, index) => (
                                    <div key={index} className="bg-white border rounded-lg p-3">
                                        <div className="flex justify-between items-center mb-2">
                                            <div className="flex-1">
                                                <p className="font-medium text-gray-900 text-sm">{item.category}</p>
                                                <p className="text-xs text-gray-500">{item.percentage.toFixed(1)}% of total</p>
                                            </div>
                                            <div className="text-right">
                                                <p className={`font-bold ${metric === 'income' ? 'text-green-600' : 'text-red-600'
                                                    }`}>
                                                    {formatCurrency(item.amount)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                                            <div
                                                className={`h-1.5 rounded-full ${metric === 'income' ? 'bg-green-500' : 'bg-red-500'
                                                    }`}
                                                style={{ width: `${item.percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // 1. MOBILE DASHBOARD
    const MobileDashboard = () => (
        <div className="p-4 space-y-4 max-w-sm mx-auto">

            <div className="flex items-center justify-center space-x-2 mb-2">
                <label className="text-sm" style={{ color: COLORS.mediumGray }}>Year:</label>
                <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="border rounded px-3 py-1 text-sm"
                    style={{ borderColor: COLORS.lightGray }}
                >
                    {getAvailableYears().length > 0 ? (
                        getAvailableYears().map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))
                    ) : (
                        <option value={selectedYear}>{selectedYear}</option>
                    )}
                </select>
            </div>

            {/* Financial Metrics - Single Row */}
            <div className="grid grid-cols-3 gap-2">
                {/* Income */}
                <div
                    onClick={() => setSelectedMetric('income')}
                    className="rounded-lg p-2 cursor-pointer"
                    style={{
                        backgroundColor: `${COLORS.incomeColor}15`,
                        border: `1px solid ${COLORS.incomeColor}40`
                    }}
                    onMouseDown={(e) => e.currentTarget.style.backgroundColor = `${COLORS.incomeColor}25`}
                    onMouseUp={(e) => e.currentTarget.style.backgroundColor = `${COLORS.incomeColor}15`}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = `${COLORS.incomeColor}15`}
                >
                    <p className="text-xs font-medium" style={{ color: COLORS.incomeColor }}>Income</p>
                    <p className="text-lg font-bold" style={{ color: COLORS.incomeColor }}>{formatCurrency(summaries.income)}</p>
                    <TrendingUp className="h-4 w-4 mt-1" style={{ color: COLORS.incomeColor }} />
                </div>

                {/* Expenses */}
                <div
                    onClick={() => setSelectedMetric('expenses')}
                    className="rounded-lg p-2 cursor-pointer"
                    style={{
                        backgroundColor: `${COLORS.expenseColor}15`,
                        border: `1px solid ${COLORS.expenseColor}40`
                    }}
                    onMouseDown={(e) => e.currentTarget.style.backgroundColor = `${COLORS.expenseColor}25`}
                    onMouseUp={(e) => e.currentTarget.style.backgroundColor = `${COLORS.expenseColor}15`}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = `${COLORS.expenseColor}15`}
                >
                    <p className="text-xs font-medium" style={{ color: COLORS.expenseColor }}>Expenses</p>
                    <p className="text-lg font-bold" style={{ color: COLORS.expenseColor }}>{formatCurrency(summaries.expenses)}</p>
                    <BarChart3 className="h-4 w-4 mt-1" style={{ color: COLORS.expenseColor }} />
                </div>

                {/* Net Profit */}
                <div
                    onClick={() => setSelectedMetric('profit')}
                    className="rounded-lg p-2 cursor-pointer"
                    style={{
                        backgroundColor: `${COLORS.slainteBlue}15`,
                        border: `1px solid ${COLORS.slainteBlue}40`
                    }}
                    onMouseDown={(e) => e.currentTarget.style.backgroundColor = `${COLORS.slainteBlue}25`}
                    onMouseUp={(e) => e.currentTarget.style.backgroundColor = `${COLORS.slainteBlue}15`}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = `${COLORS.slainteBlue}15`}
                >
                    <p className="text-xs font-medium" style={{ color: COLORS.slainteBlue }}>Profit</p>
                    <p className="text-lg font-bold" style={{ color: COLORS.slainteBlue }}>{formatCurrency(profit)}</p>
                    <PieChart className="h-4 w-4 mt-1" style={{ color: COLORS.slainteBlue }} />
                </div>
            </div>
           
            {/* Patient Demographics Card - Matching Desktop */}
            <div className="rounded-lg p-4 shadow-sm" style={{ backgroundColor: COLORS.white, border: `1px solid ${COLORS.lightGray}` }}>
                <h3 className="font-semibold flex items-center gap-2 mb-3" style={{ color: COLORS.darkGray }}>
                    <User className="h-5 w-5" style={{ color: COLORS.slainteBlue }} />
                    Latest Patient Demographics
                </h3>
                {latestPaymentData ? (
                    <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 rounded-lg text-center" style={{ backgroundColor: `${COLORS.slainteBlue}15` }}>
                            <p className="text-lg font-bold" style={{ color: COLORS.darkGray }}>
                                {latestPaymentData.totalPanelSize?.toLocaleString() || 0}
                            </p>
                            <p className="text-xs font-medium mt-1" style={{ color: COLORS.slainteBlue }}>Total Panel Size</p>
                        </div>
                        <div className="p-3 rounded-lg text-center" style={{ backgroundColor: `${COLORS.slainteBlue}20` }}>
                            <p className="text-lg font-bold" style={{ color: COLORS.darkGray }}>
                                {latestPaymentData.totalPatientsOver70?.toLocaleString() || 0}
                            </p>
                            <p className="text-xs font-medium mt-1" style={{ color: COLORS.slainteBlue }}>Patients Over 70</p>
                        </div>
                        <div className="p-3 rounded-lg text-center" style={{ backgroundColor: `${COLORS.highlightYellow}30` }}>
                            <p className="text-lg font-bold" style={{ color: COLORS.darkGray }}>
                                {latestPaymentData.totalNursingHome?.toLocaleString() || 0}
                            </p>
                            <p className="text-xs font-medium mt-1" style={{ color: COLORS.darkGray }}>Nursing Home</p>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-4 text-sm" style={{ color: COLORS.mediumGray }}>
                        No payment analysis data available. Upload PCRS PDFs to see panel demographics.
                    </div>
                )}
            </div>

            {/* Latest Claims & Leave Data - Matching Desktop */}
            <div className="rounded-lg p-4 shadow-sm" style={{ backgroundColor: COLORS.white, border: `1px solid ${COLORS.lightGray}` }}>
                <h3 className="font-semibold flex items-center gap-2 mb-3" style={{ color: COLORS.darkGray }}>
                    <Activity className="h-5 w-5" style={{ color: COLORS.slainteBlue }} />
                    Latest Claims & Leave Data
                </h3>
                {latestPaymentData ? (
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg" style={{ backgroundColor: `${COLORS.slainteBlue}15` }}>
                            <h4 className="text-xs font-semibold mb-1" style={{ color: COLORS.slainteBlue }}>STC Claims</h4>
                            <p className="text-lg font-bold" style={{ color: COLORS.darkGray }}>
                                {latestPaymentData.totalSTCClaims?.toLocaleString() || 0}
                            </p>
                        </div>
                        <div className="p-3 rounded-lg" style={{ backgroundColor: `${COLORS.incomeColor}15` }}>
                            <h4 className="text-xs font-semibold mb-1" style={{ color: COLORS.incomeColor }}>STC Claims Paid</h4>
                            <p className="text-lg font-bold" style={{ color: COLORS.darkGray }}>
                                {latestPaymentData.totalSTCClaimsPaid?.toLocaleString() || 0}
                            </p>
                        </div>
                        <div className="p-3 rounded-lg" style={{ backgroundColor: `${COLORS.highlightYellow}30` }}>
                            <h4 className="text-xs font-semibold mb-1" style={{ color: COLORS.darkGray }}>Annual Leave Balance</h4>
                            <p className="text-lg font-bold" style={{ color: COLORS.darkGray }}>
                                {latestPaymentData.totalAnnualLeaveBalance?.toLocaleString() || 0}
                            </p>
                        </div>
                        <div className="p-3 rounded-lg" style={{ backgroundColor: `${COLORS.expenseColor}15` }}>
                            <h4 className="text-xs font-semibold mb-1" style={{ color: COLORS.expenseColor }}>Study Leave Balance</h4>
                            <p className="text-lg font-bold" style={{ color: COLORS.darkGray }}>
                                {latestPaymentData.totalStudyLeaveBalance?.toLocaleString() || 0}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-4 text-sm" style={{ color: COLORS.mediumGray }}>
                        No claims and leave data available.
                    </div>
                )}
            </div>

            {/* Tasks & Reports - Matching Desktop */}
            <div className="rounded-lg p-4 shadow-sm" style={{ backgroundColor: COLORS.white, border: `1px solid ${COLORS.lightGray}` }}>
                <h3 className="font-semibold flex items-center gap-2 mb-3" style={{ color: COLORS.darkGray }}>
                    <FileText className="h-5 w-5" style={{ color: COLORS.slainteBlue }} />
                    Tasks & Reports
                </h3>
                <div className="grid grid-cols-2 gap-3">
                    {/* GMS Health Check Box */}
                    {(() => {
                        // Check localStorage for saved GMS reports - get the most recent one
                        const savedReports = JSON.parse(localStorage.getItem('gp_finance_saved_reports') || '[]');
                        const gmsReports = savedReports.filter(r => r.type === 'GMS Health Check');
                        const latestGMSReport = gmsReports.length > 0 ? gmsReports[gmsReports.length - 1] : null;

                        const statusColor = latestGMSReport ? COLORS.incomeColor : COLORS.slainteBlue;
                        const statusBg = latestGMSReport ? `${COLORS.incomeColor}15` : `${COLORS.slainteBlue}15`;
                        const statusBorder = latestGMSReport ? `${COLORS.incomeColor}40` : `${COLORS.slainteBlue}40`;

                        return (
                            <div
                                onClick={() => {
                                    if (latestGMSReport) {
                                        setViewingGMSReport(latestGMSReport);
                                    }
                                }}
                                className={latestGMSReport ? "p-3 rounded-lg cursor-pointer active:opacity-75" : "p-3 rounded-lg"}
                                style={{
                                    backgroundColor: statusBg,
                                    border: `1px solid ${statusBorder}`
                                }}
                            >
                                <h4 className="text-xs font-semibold mb-1" style={{ color: statusColor }}>
                                    GMS Health Check
                                </h4>
                                <p className="text-lg font-bold" style={{ color: COLORS.darkGray }}>
                                    {latestGMSReport ? 'View Report' : 'Desktop Only'}
                                </p>
                            </div>
                        );
                    })()}

                    {/* P&L Report Status */}
                    {(() => {
                        const now = new Date();
                        const currentYear = now.getFullYear();
                        const currentMonth = now.getMonth();
                        const shouldGeneratePriorYear = currentMonth < 3;
                        const reportYear = shouldGeneratePriorYear ? currentYear - 1 : currentYear;

                        const hasDataForYear = transactions.some(t => {
                            if (!t.date) return false;
                            return new Date(t.date).getFullYear() === reportYear;
                        });

                        const reportDue = shouldGeneratePriorYear && hasDataForYear;
                        const statusColor = reportDue ? '#9333EA' : COLORS.incomeColor; // Purple or Green
                        const statusBg = reportDue ? '#9333EA20' : `${COLORS.incomeColor}15`;
                        const statusBorder = reportDue ? '#9333EA40' : `${COLORS.incomeColor}40`;

                        return (
                            <div
                                onClick={() => setCurrentTab('reports')}
                                className="p-3 rounded-lg cursor-pointer active:opacity-75"
                                style={{
                                    backgroundColor: statusBg,
                                    border: `1px solid ${statusBorder}`
                                }}
                            >
                                <h4 className="text-xs font-semibold mb-1" style={{ color: statusColor }}>
                                    P&L Report
                                </h4>
                                <p className="text-lg font-bold" style={{ color: COLORS.darkGray }}>
                                    {reportDue ? reportYear : 'Current'}
                                </p>
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* Demo Data Card */}
            {transactions.length === 0 && (
                <div className="rounded-lg p-4 mt-4" style={{ backgroundColor: `${COLORS.incomeColor}15`, border: `1px solid ${COLORS.incomeColor}40` }}>
                    <h3 className="font-semibold mb-2" style={{ color: COLORS.darkGray }}>Get Started</h3>
                    <p className="text-sm mb-3" style={{ color: COLORS.mediumGray }}>
                        Load demo data to explore the app's features
                    </p>
                    <button
                        onClick={loadDemoData}
                        className="w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center"
                        style={{ backgroundColor: COLORS.incomeColor, color: COLORS.white }}
                    >
                        <Activity className="h-5 w-5 mr-2" />
                        Load Demo Data
                    </button>
                </div>
            )}
        </div>


        
    );

    // 2. MOBILE TRANSACTION LABELING
    const MobileTransactionLabeling = () => {
        const [displayCount, setDisplayCount] = React.useState(10);
        const [sortOrder, setSortOrder] = React.useState('newest'); // 'newest' or 'oldest'
        const [pendingCategorization, setPendingCategorization] = React.useState(null); // Add this state
        const [showPatternSelection, setShowPatternSelection] = React.useState(false); // Add this
        const [selectedPattern, setSelectedPattern] = React.useState(''); // Add this

        // Sort transactions by date
        const sortedTransactions = [...unidentifiedTransactions].sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
        });

        const displayedTransactions = sortedTransactions.slice(0, displayCount);
        const hasMore = displayCount < unidentifiedTransactions.length;

        return (
            <div className="p-4 max-w-sm mx-auto">
                <div className="mb-4 text-center">
                    <p className="text-sm" style={{ color: COLORS.mediumGray }}>
                        {displayedTransactions.length} of {unidentifiedTransactions.length} transactions
                    </p>
                </div>

                {/* Sort Filter */}
                {unidentifiedTransactions.length > 0 && (
                    <div className="mb-4 flex items-center justify-between rounded-lg p-3" style={{ backgroundColor: COLORS.white, border: `1px solid ${COLORS.lightGray}` }}>
                        <span className="text-sm" style={{ color: COLORS.mediumGray }}>Sort by date:</span>
                        <select
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value)}
                            className="text-sm rounded px-3 py-1"
                            style={{ border: `1px solid ${COLORS.lightGray}` }}
                        >
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                        </select>
                    </div>
                )}

                {unidentifiedTransactions.length === 0 ? (
                    <div className="text-center py-12">
                        <CheckCircle className="h-12 w-12 mx-auto mb-4" style={{ color: COLORS.incomeColor }} />
                        <h3 className="text-lg font-medium" style={{ color: COLORS.darkGray }}>All caught up!</h3>
                        <p style={{ color: COLORS.mediumGray }}>No transactions need categorization</p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-4">
                            {displayedTransactions.map((transaction) => (
                                <div key={transaction.id} className="rounded-lg shadow-sm" style={{ backgroundColor: COLORS.white, border: `1px solid ${COLORS.lightGray}` }}>
                                    <div className="p-4" style={{ borderBottom: `1px solid ${COLORS.lightGray}` }}>
                                        <div className="space-y-2 mb-3">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1 mr-2">
                                                    <p className="text-xs mb-1" style={{ color: COLORS.mediumGray }}>Details</p>
                                                    <p className="font-medium text-sm leading-tight" style={{ color: COLORS.darkGray }}>
                                                        {transaction.description ||
                                                            transaction.details ||
                                                            transaction.narrative ||
                                                            transaction.reference ||
                                                            'No description'}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs mb-1" style={{ color: COLORS.mediumGray }}>Amount</p>
                                                    {transaction.debit ? (
                                                        <p className="text-lg font-bold" style={{ color: COLORS.expenseColor }}>
                                                            -€{Math.abs(transaction.debit).toLocaleString()}
                                                        </p>
                                                    ) : transaction.credit ? (
                                                        <p className="text-lg font-bold" style={{ color: COLORS.incomeColor }}>
                                                            +€{Math.abs(transaction.credit).toLocaleString()}
                                                        </p>
                                                    ) : (
                                                        <p className="text-lg font-bold" style={{ color: transaction.amount < 0 ? COLORS.expenseColor : COLORS.incomeColor }}>
                                                            {transaction.amount < 0 ? '-' : '+'}€{Math.abs(transaction.amount).toLocaleString()}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            <div>
                                                <p className="text-xs" style={{ color: COLORS.mediumGray }}>Date</p>
                                                <p className="text-sm" style={{ color: COLORS.darkGray }}>
                                                    {new Date(transaction.date).toLocaleDateString('en-IE', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        year: 'numeric'
                                                    })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-4 space-y-3">
                                        <select
                                            className="w-full p-3 rounded-lg text-sm"
                                            style={{ border: `1px solid ${COLORS.lightGray}` }}
                                            onChange={(e) => {
                                                if (e.target.value) {
                                                    // Immediately categorize without AI training prompt (mobile-only)
                                                    const simplifiedCat = simplifiedCategories.find(c => c.name === e.target.value);

                                                    if (simplifiedCat) {
                                                        const category = {
                                                            code: simplifiedCat.code,
                                                            name: simplifiedCat.name,
                                                            type: simplifiedCat.type
                                                        };
                                                        setTransactions(prev => [...prev, { ...transaction, category }]);
                                                        setUnidentifiedTransactions(prev => prev.filter(t => t.id !== transaction.id));
                                                    }

                                                    // Reset dropdown
                                                    e.target.value = "";
                                                }
                                            }}
                                            defaultValue=""
                                        >
                                            <option value="">Select category...</option>
                                            {simplifiedCategories.map(cat => (
                                                <option key={cat.code} value={cat.name}>
                                                    {cat.name}
                                                </option>
                                            ))}
                                        </select>

                                        <button
                                            onClick={() => {
                                                // Skip this transaction
                                                setUnidentifiedTransactions(prev => [...prev.filter(t => t.id !== transaction.id), transaction]);
                                            }}
                                            className="w-full py-2 px-4 rounded-lg text-sm"
                                            style={{ color: COLORS.mediumGray, border: `1px solid ${COLORS.lightGray}` }}
                                        >
                                            Skip for now
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Load More Button */}
                        {hasMore && (
                            <div className="mt-4">
                                <button
                                    onClick={() => setDisplayCount(prev => prev + 10)}
                                    className="w-full py-3 px-4 rounded-lg font-medium"
                                    style={{ backgroundColor: COLORS.slainteBlue, color: COLORS.white }}
                                >
                                    Load More ({unidentifiedTransactions.length - displayCount} remaining)
                                </button>
                            </div>
                        )}

                        {!hasMore && unidentifiedTransactions.length > 10 && (
                            <div className="mt-4 text-center">
                                <p className="text-sm" style={{ color: COLORS.mediumGray }}>All transactions loaded</p>
                                <button
                                    onClick={() => setDisplayCount(10)}
                                    className="text-sm underline mt-2"
                                    style={{ color: COLORS.slainteBlue }}
                                >
                                    Show less
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    };

    // 3. MOBILE REPORTS (View Only)
    const MobileReports = () => {
        const [savedReports, setSavedReports] = useState([]);

        React.useEffect(() => {
            const reports = JSON.parse(localStorage.getItem('gp_finance_saved_reports') || '[]');
            setSavedReports(reports.sort((a, b) => new Date(b.generatedDate) - new Date(a.generatedDate)));
        }, []);

        const deleteReport = (reportId) => {
            if (window.confirm('Delete this report?')) {
                const updated = savedReports.filter(r => r.id !== reportId);
                setSavedReports(updated);
                localStorage.setItem('gp_finance_saved_reports', JSON.stringify(updated));
            }
        };

        const openReport = (report) => {
            const newWindow = window.open('', '_blank');
            newWindow.document.write(report.htmlContent);
            newWindow.document.close();
        };

        return (
            <div className="p-4 max-w-sm mx-auto"  style={{ paddingTop: '1rem' }}>

                {/* Current Year Summary */}
                <div className="rounded-lg p-4 mb-4" style={{ backgroundColor: COLORS.white, border: `1px solid ${COLORS.lightGray}` }}>
                    <h3 className="font-semibold mb-3">Current Year Summary</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span style={{ color: COLORS.mediumGray }}>Total Income</span>
                            <span className="font-semibold" style={{ color: COLORS.incomeColor }}>{formatCurrency(summaries.income)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span style={{ color: COLORS.mediumGray }}>Total Expenses</span>
                            <span className="font-semibold" style={{ color: COLORS.expenseColor }}>{formatCurrency(summaries.expenses)}</span>
                        </div>
                        <div className="flex justify-between text-sm pt-2" style={{ borderTop: `1px solid ${COLORS.lightGray}` }}>
                            <span className="font-medium" style={{ color: COLORS.darkGray }}>Net Profit</span>
                            <span className="font-bold" style={{ color: COLORS.slainteBlue }}>{formatCurrency(profit)}</span>
                        </div>
                    </div>
                </div>

                {/* Saved Reports */}
                <div className="space-y-3">
                    <h3 className="font-semibold" style={{ color: COLORS.darkGray }}>Saved Reports</h3>

                    {savedReports.length === 0 ? (
                        <div className="rounded-lg p-6 text-center" style={{ backgroundColor: COLORS.backgroundGray, border: `1px solid ${COLORS.lightGray}` }}>
                            <FileText className="h-12 w-12 mx-auto mb-2" style={{ color: COLORS.mediumGray }} />
                            <p className="text-sm" style={{ color: COLORS.mediumGray }}>No saved reports</p>
                            <p className="text-xs mt-1" style={{ color: COLORS.mediumGray }}>
                                Generate reports on desktop to view them here
                            </p>
                        </div>
                    ) : (
                        savedReports.map((report) => {
                            // Determine badge style based on report type
                            const getReportBadge = () => {
                                const type = report.type || 'Report';
                                let badgeStyle = {};

                                switch(type) {
                                    case 'AI Report':
                                        badgeStyle = {
                                            backgroundColor: `${COLORS.slainteBlue}20`,
                                            color: COLORS.slainteBlue,
                                            border: `1px solid ${COLORS.slainteBlue}40`
                                        };
                                        break;
                                    case 'GMS Health Check':
                                        badgeStyle = {
                                            backgroundColor: `${COLORS.incomeColor}20`,
                                            color: COLORS.incomeColor,
                                            border: `1px solid ${COLORS.incomeColor}40`
                                        };
                                        break;
                                    case 'P&L Report':
                                        badgeStyle = {
                                            backgroundColor: `${COLORS.highlightYellow}40`,
                                            color: COLORS.darkGray,
                                            border: `1px solid ${COLORS.highlightYellow}`
                                        };
                                        break;
                                    default:
                                        badgeStyle = {
                                            backgroundColor: COLORS.backgroundGray,
                                            color: COLORS.mediumGray,
                                            border: `1px solid ${COLORS.lightGray}`
                                        };
                                }

                                return (
                                    <span
                                        className="px-2 py-1 rounded-full text-xs font-medium"
                                        style={badgeStyle}
                                    >
                                        {type}
                                    </span>
                                );
                            };

                            return (
                                <div key={report.id} className="rounded-lg p-4" style={{ backgroundColor: COLORS.white, border: `1px solid ${COLORS.lightGray}` }}>
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-medium text-sm" style={{ color: COLORS.darkGray }}>{report.title}</h4>
                                            </div>
                                            <div className="mb-2">
                                                {getReportBadge()}
                                            </div>
                                            <p className="text-xs" style={{ color: COLORS.mediumGray }}>
                                                {new Date(report.generatedDate).toLocaleDateString('en-IE', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => deleteReport(report.id)}
                                            className="p-2 rounded"
                                            style={{ color: COLORS.expenseColor }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${COLORS.expenseColor}15`}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                            <X className="h-5 w-5" />
                                        </button>
                                    </div>

                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => openReport(report)}
                                            className="flex-1 flex items-center justify-center p-2 rounded"
                                            style={{ backgroundColor: COLORS.slainteBlue, color: COLORS.white }}
                                        >
                                            <FileText className="h-4 w-4 mr-1" />
                                            <span className="text-sm font-medium">View/Print</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                const subject = encodeURIComponent(report.title);
                                                window.location.href = `mailto:?subject=${subject}`;
                                            }}
                                            className="flex-1 flex items-center justify-center p-2 rounded"
                                            style={{ backgroundColor: COLORS.backgroundGray, border: `1px solid ${COLORS.lightGray}` }}
                                        >
                                            <Mail className="h-4 w-4 mr-1" style={{ color: COLORS.mediumGray }} />
                                            <span className="text-sm font-medium" style={{ color: COLORS.darkGray }}>Email</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        );
    };

    // 4. MOBILE FINANCIAL CHAT
    const MobileChat = () => {
        const messagesEndRef = React.useRef(null);
        const inputRef = React.useRef(null);

        // Auto-scroll to bottom
        React.useEffect(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, [chatMessages]);

        // Keep input focused
        React.useEffect(() => {
            if (inputRef.current && !isLoadingChat) {
                inputRef.current.focus();
            }
        }, [isLoadingChat]);

        const handleSendMessage = async () => {
            if (!chatInput.trim()) return;

            if (!apiKey) {
                setShowApiKeyInput(true);
                return;
            }

            const userMessage = {
                type: 'user',
                content: chatInput,
                timestamp: new Date().toISOString(),
                id: `user-${Date.now()}`
            };

            setChatMessages(prev => [...prev, userMessage]);
            setChatInput('');
            setIsLoadingChat(true);

            // Add loading message
            const loadingMessage = {
                type: 'assistant',
                content: 'Finn is thinking...',
                isLoading: true,
                timestamp: new Date().toISOString(),
                id: `loading-${Date.now()}`
            };
            setChatMessages(prev => [...prev, loadingMessage]);

            try {
                // Build context
                const practiceContext = getCiaranContext();
                const financialContext = {
                    selectedYear,
                    totalTransactions: transactions.length,
                    yearToDateIncome: summaries.income,
                    yearToDateExpenses: summaries.expenses,
                    profit: profit,
                    profitMargin: profitMargin
                };

                // Build system prompt (simplified for mobile)
                const systemPrompt = `You are Finn, an expert financial advisor for Irish GP practices.

${practiceContext}

**FINANCIAL DATA FOR ${selectedYear}:**
- Total transactions: ${financialContext.totalTransactions}
- Income: €${financialContext.yearToDateIncome.toLocaleString()}
- Expenses: €${financialContext.yearToDateExpenses.toLocaleString()}
- Profit: €${financialContext.profit.toLocaleString()} (${financialContext.profitMargin}% margin)

**MOBILE INTERFACE RULES:**
- Keep responses concise (2-4 paragraphs max)
- Use simple formatting
- Avoid creating artifacts unless explicitly requested
- Be conversational and direct`;

                // Prepare messages
                const messages = [
                    { role: "user", content: systemPrompt },
                    { role: "assistant", content: "I understand. I'll provide concise, mobile-friendly financial advice for this Irish GP practice." },
                    ...chatMessages.filter(m => !m.isLoading).map(m => ({
                        role: m.type === 'user' ? 'user' : 'assistant',
                        content: m.content
                    })),
                    { role: "user", content: chatInput }
                ];

                // Check if running on Netlify or production (no API server available)
                const isProduction = window.location.hostname.includes('netlify.app') ||
                                   window.location.hostname.includes('vercel.app') ||
                                   window.location.protocol === 'https:';

                if (isProduction) {
                    throw new Error('Chat is only available when running locally. Please use the desktop app for AI chat features.');
                }

                // Use current host for API calls (works on mobile and desktop locally)
                const apiHost = window.location.hostname;
                const apiUrl = `http://${apiHost}:3001/api/chat`;

                // Get authentication token - use Electron token if available, otherwise partner token
                let authToken;
                if (window.electronAPI?.isElectron) {
                    authToken = await window.electronAPI.getInternalToken();
                } else {
                    authToken = localStorage.getItem('partner_token');
                    if (!authToken) {
                        throw new Error('Authentication required. Please log in.');
                    }
                }

                const response = await fetch(apiUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${authToken}`
                    },
                    body: JSON.stringify({
                        message: JSON.stringify({
                            model: MODELS.STANDARD,
                            max_tokens: 1500,
                            messages: messages
                        })
                    })
                });

                if (!response.ok) {
                    throw new Error('Failed to get response from API server');
                }

                const data = await response.json();
                const claudeResponse = data.content[0].text;

                // Remove loading message
                setChatMessages(prev => prev.filter(msg => !msg.isLoading));

                // Check for artifact
                const parsedArtifact = parseArtifactResponse(claudeResponse);

                if (parsedArtifact) {
                    // Has artifact
                    const newArtifact = {
                        title: parsedArtifact.title,
                        content: parsedArtifact.content,
                        type: parsedArtifact.type || 'report',
                        created_at: new Date().toISOString(),
                        id: `artifact-${Date.now()}`
                    };
                    setArtifacts(prev => [...prev, newArtifact]);

                    const assistantMessage = {
                        type: 'assistant',
                        content: parsedArtifact.beforeText + (parsedArtifact.afterText ? '\n\n' + parsedArtifact.afterText : ''),
                        timestamp: new Date().toISOString(),
                        id: `assistant-${Date.now()}`,
                        hasArtifact: true,
                        artifactId: newArtifact.id
                    };
                    setChatMessages(prev => [...prev, assistantMessage]);
                } else {
                    // No artifact
                    const assistantMessage = {
                        type: 'assistant',
                        content: claudeResponse,
                        timestamp: new Date().toISOString(),
                        id: `assistant-${Date.now()}`
                    };
                    setChatMessages(prev => [...prev, assistantMessage]);
                }

            } catch (error) {
                console.error('Chat error:', error);
                setChatMessages(prev => prev.filter(msg => !msg.isLoading));
                const errorMessage = {
                    type: 'assistant',
                    content: 'Sorry, I encountered an error. Please try again.',
                    isError: true,
                    timestamp: new Date().toISOString(),
                    id: `error-${Date.now()}`
                };
                setChatMessages(prev => [...prev, errorMessage]);
            } finally {
                setIsLoadingChat(false);
            }
        };

        return (
            <div className="flex flex-col h-[calc(100vh-110px)] max-w-sm mx-auto">
                {/* Header */}
                {!apiKey && (
                    <div className="p-3 text-center" style={{ borderBottom: `1px solid ${COLORS.lightGray}`, backgroundColor: COLORS.white }}>
                        <button
                            onClick={() => setShowApiKeyInput(true)}
                            className="text-xs px-3 py-2 rounded"
                            style={{ backgroundColor: COLORS.highlightYellow, color: COLORS.darkGray }}
                        >
                            Set API Key to Chat with Finn
                        </button>
                    </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ backgroundColor: COLORS.backgroundGray }}>
                    {chatMessages.length === 0 && (
                        <div className="text-center py-8">
                            <p className="text-sm mb-4" style={{ color: COLORS.mediumGray }}>
                                Hi! I'm Finn, your AI financial advisor. Ask me anything about your practice finances.
                            </p>
                        </div>
                    )}

                    {chatMessages.map((message) => (
                        <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div
                                className="max-w-[85%] px-4 py-2 rounded-lg"
                                style={message.type === 'user'
                                    ? { backgroundColor: COLORS.slainteBlue, color: COLORS.white }
                                    : message.isLoading
                                    ? { backgroundColor: `${COLORS.highlightYellow}20`, border: `1px solid ${COLORS.highlightYellow}`, color: COLORS.darkGray }
                                    : message.isError
                                    ? { backgroundColor: `${COLORS.expenseColor}20`, border: `1px solid ${COLORS.expenseColor}`, color: COLORS.darkGray }
                                    : { backgroundColor: COLORS.white, color: COLORS.darkGray, border: `1px solid ${COLORS.lightGray}` }
                                }
                            >
                                <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                                {/* Show artifact preview button */}
                                {message.hasArtifact && (
                                    <button
                                        onClick={() => {
                                            const artifact = artifacts.find(a => a.id === message.artifactId);
                                            setViewingArtifact(artifact);
                                        }}
                                        className="mt-2 px-3 py-1 rounded text-xs font-medium"
                                        style={{ backgroundColor: COLORS.slainteBlue, color: COLORS.white }}
                                    >
                                        View Report
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4" style={{ backgroundColor: COLORS.white, borderTop: `1px solid ${COLORS.lightGray}` }}>
                    <div className="flex space-x-3">
                        <input
                            ref={inputRef}
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && !isLoadingChat && handleSendMessage()}
                            placeholder="Ask about your finances..."
                            disabled={isLoadingChat}
                            className="flex-1 p-3 rounded-lg text-sm"
                            style={{ border: `1px solid ${COLORS.lightGray}` }}
                            autoComplete="off"
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={isLoadingChat || !chatInput.trim()}
                            className="p-3 rounded-lg disabled:opacity-50"
                            style={{ backgroundColor: COLORS.slainteBlue, color: COLORS.white }}
                        >
                            <Send className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                        {['Profit margin?', 'Top expenses?', 'Income breakdown?', 'Financial advice?'].map((question) => (
                            <button
                                key={question}
                                onClick={() => setChatInput(question)}
                                disabled={isLoadingChat}
                                className="text-xs px-3 py-1 rounded-full disabled:opacity-50"
                                style={{ backgroundColor: COLORS.backgroundGray, color: COLORS.darkGray }}
                            >
                                {question}
                            </button>
                        ))}
                    </div>
                </div>

                {/* API Key Input Modal */}
                {showApiKeyInput && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="rounded-lg w-full max-w-sm p-6" style={{ backgroundColor: COLORS.white }}>
                            <h3 className="text-lg font-bold mb-3" style={{ color: COLORS.darkGray }}>License Key Required</h3>
                            <p className="text-sm mb-4" style={{ color: COLORS.mediumGray }}>
                                Enter your Sláinte License Key to chat with Finn
                            </p>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Enter your license key"
                                className="w-full p-3 rounded mb-4 text-sm"
                                style={{ border: `1px solid ${COLORS.lightGray}` }}
                            />
                            <div className="flex space-x-3">
                                <button
                                    onClick={() => setShowApiKeyInput(false)}
                                    className="flex-1 py-2 px-4 rounded font-medium"
                                    style={{ backgroundColor: COLORS.lightGray, color: COLORS.darkGray }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        if (apiKey.trim()) {
                                            localStorage.setItem('anthropic_api_key', apiKey);
                                            setShowApiKeyInput(false);
                                        }
                                    }}
                                    className="flex-1 py-2 px-4 rounded font-medium"
                                    style={{ backgroundColor: COLORS.slainteBlue, color: COLORS.white }}
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // Mobile Artifact Viewer
    const MobileArtifactViewer = ({ artifact, onClose }) => {
        if (!artifact) return null;

        const handleSave = () => {
            const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>${artifact.title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 100%;
            margin: 0;
            padding: 20px;
            line-height: 1.6;
            color: #333;
        }
        h1 { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px; font-size: 24px; }
        h2 { color: #2563eb; margin-top: 24px; font-size: 20px; }
        h3 { color: #3b82f6; margin-top: 20px; font-size: 18px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background-color: #f3f4f6; font-weight: 600; }
        @media print {
            body { margin: 0; padding: 15px; }
            h1 { font-size: 20px; }
            h2 { font-size: 18px; }
            h3 { font-size: 16px; }
        }
    </style>
</head>
<body>
    <div>${artifact.content}</div>
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
        <p>Generated by Finn (AI Financial Assistant) | Sláinte Finance</p>
        <p>Created: ${new Date(artifact.created_at).toLocaleString('en-IE')}</p>
    </div>
</body>
</html>
            `;

            const savedReports = JSON.parse(localStorage.getItem('gp_finance_saved_reports') || '[]');
            const newReport = {
                id: `mobile-artifact-${Date.now()}`,
                title: artifact.title,
                type: 'AI Report',
                generatedDate: artifact.created_at,
                year: new Date().getFullYear(),
                htmlContent: htmlContent,
                metadata: {
                    artifactType: artifact.type,
                    generatedBy: 'Finn AI',
                    generatedFrom: 'Mobile'
                }
            };

            savedReports.push(newReport);
            if (savedReports.length > 20) {
                savedReports.shift();
            }

            localStorage.setItem('gp_finance_saved_reports', JSON.stringify(savedReports));
            alert('Report saved successfully!');
        };

        const handleView = () => {
            const newWindow = window.open('', '_blank');
            const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>${artifact.title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 100%;
            margin: 0;
            padding: 20px;
            line-height: 1.6;
            color: #333;
        }
        h1 { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px; }
        h2 { color: #2563eb; margin-top: 24px; }
        h3 { color: #3b82f6; margin-top: 20px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background-color: #f3f4f6; font-weight: 600; }
    </style>
</head>
<body>
    <div>${artifact.content}</div>
</body>
</html>
            `;
            newWindow.document.write(htmlContent);
            newWindow.document.close();
        };

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                <div className="bg-white rounded-lg w-full max-w-sm max-h-[90vh] overflow-hidden flex flex-col my-auto">
                    {/* Header */}
                    <div className="p-4 border-b flex items-center justify-between flex-shrink-0" style={{ borderBottom: `1px solid ${COLORS.lightGray}` }}>
                        <div>
                            <h3 className="font-bold text-base" style={{ color: COLORS.darkGray }}>{artifact.title}</h3>
                            <p className="text-xs mt-1" style={{ color: COLORS.mediumGray }}>
                                {new Date(artifact.created_at).toLocaleDateString('en-IE')}
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 rounded" style={{ backgroundColor: COLORS.lightGray }}>
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Actions */}
                    <div className="p-3 border-b flex gap-2 flex-shrink-0" style={{ borderBottom: `1px solid ${COLORS.lightGray}` }}>
                        <button
                            onClick={handleSave}
                            className="flex-1 px-3 py-2 rounded text-xs font-medium"
                            style={{ backgroundColor: COLORS.slainteBlue, color: COLORS.white }}
                        >
                            <Download className="h-4 w-4 inline mr-1" />
                            Save
                        </button>
                        <button
                            onClick={handleView}
                            className="flex-1 px-3 py-2 rounded text-xs font-medium"
                            style={{ backgroundColor: COLORS.backgroundGray, color: COLORS.darkGray, border: `1px solid ${COLORS.lightGray}` }}
                        >
                            <Eye className="h-4 w-4 inline mr-1" />
                            View/Print
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-4 overflow-y-auto flex-1 text-sm" style={{ color: COLORS.darkGray }}>
                        <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(artifact.content) }} />
                    </div>
                </div>
            </div>
        );
    };

    // 5. MOBILE DATA VISUALISATION
    const MobileDataVisualisation = () => {
        const CHART_COLORS = [COLORS.slainteBlue, COLORS.incomeColor, COLORS.highlightYellow, COLORS.expenseColor, '#8884D8', '#82CA9D'];

        if (transactions.length === 0) {
            return (
                <div className="p-4 max-w-sm mx-auto">
                    <div className="text-center py-12">
                        <TrendingUp className="h-16 w-16 mx-auto mb-4" style={{ color: COLORS.mediumGray }} />
                        <h3 className="text-lg font-medium mb-2" style={{ color: COLORS.darkGray }}>No Data Available</h3>
                        <p className="text-sm" style={{ color: COLORS.mediumGray }}>
                            Upload transaction data to see visualizations
                        </p>
                    </div>
                </div>
            );
        }

        // Get top income categories
        const incomeData = calculateCategoryBreakdown.incomeBreakdown.slice(0, 5);
        const totalIncome = incomeData.reduce((sum, cat) => sum + cat.amount, 0);

        // Get top expense categories
        const expenseData = calculateCategoryBreakdown.expenseBreakdown.slice(0, 5);
        const totalExpenses = expenseData.reduce((sum, cat) => sum + cat.amount, 0);

        return (
            <div className="p-4 space-y-4 max-w-sm mx-auto">
                {/* Year Selector */}
                <div className="flex items-center justify-center space-x-2 mb-2">
                    <Calendar className="h-4 w-4" style={{ color: COLORS.mediumGray }} />
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="border rounded px-3 py-1 text-sm"
                        style={{ borderColor: COLORS.lightGray }}
                    >
                        {getAvailableYears().length > 0 ? (
                            getAvailableYears().map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))
                        ) : (
                            <option value={selectedYear}>{selectedYear}</option>
                        )}
                    </select>
                </div>

                {/* Monthly Trends Line Chart */}
                {summaries.monthlyTrends && summaries.monthlyTrends.length > 0 && (
                    <div className="rounded-lg p-4 shadow-sm" style={{ backgroundColor: COLORS.white, border: `1px solid ${COLORS.lightGray}` }}>
                        <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: COLORS.slainteBlue }}>
                            <TrendingUp className="h-5 w-5" />
                            Monthly Trends
                        </h3>
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={summaries.monthlyTrends}>
                                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.lightGray} />
                                <XAxis
                                    dataKey="month"
                                    tick={{ fontSize: 10 }}
                                    stroke={COLORS.mediumGray}
                                />
                                <YAxis
                                    tick={{ fontSize: 10 }}
                                    stroke={COLORS.mediumGray}
                                />
                                <Tooltip
                                    formatter={(value) => `€${value.toLocaleString()}`}
                                    contentStyle={{ fontSize: '12px' }}
                                />
                                <Legend wrapperStyle={{ fontSize: '12px' }} />
                                <Line
                                    type="monotone"
                                    dataKey="income"
                                    stroke={COLORS.incomeColor}
                                    strokeWidth={2}
                                    name="Income"
                                    dot={{ r: 3 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="expenses"
                                    stroke={COLORS.expenseColor}
                                    strokeWidth={2}
                                    name="Expenses"
                                    dot={{ r: 3 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Income Breakdown Pie Chart */}
                {incomeData.length > 0 && (
                    <div className="rounded-lg p-4 shadow-sm" style={{ backgroundColor: COLORS.white, border: `1px solid ${COLORS.lightGray}` }}>
                        <h3 className="font-semibold mb-3" style={{ color: COLORS.incomeColor }}>
                            Top Income Categories
                        </h3>
                        <ResponsiveContainer width="100%" height={200}>
                            <RechartsPieChart>
                                <Pie
                                    data={incomeData}
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={60}
                                    fill="#8884d8"
                                    dataKey="amount"
                                    nameKey="category"
                                >
                                    {incomeData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value) => `€${value.toLocaleString()}`}
                                    contentStyle={{ fontSize: '12px' }}
                                />
                            </RechartsPieChart>
                        </ResponsiveContainer>
                        {/* Legend */}
                        <div className="mt-3 space-y-1">
                            {incomeData.map((cat, index) => (
                                <div key={index} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                                        />
                                        <span style={{ color: COLORS.darkGray }}>{cat.category}</span>
                                    </div>
                                    <span className="font-semibold" style={{ color: COLORS.incomeColor }}>
                                        {formatCurrency(cat.amount)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Expense Breakdown Pie Chart */}
                {expenseData.length > 0 && (
                    <div className="rounded-lg p-4 shadow-sm" style={{ backgroundColor: COLORS.white, border: `1px solid ${COLORS.lightGray}` }}>
                        <h3 className="font-semibold mb-3" style={{ color: COLORS.expenseColor }}>
                            Top Expense Categories
                        </h3>
                        <ResponsiveContainer width="100%" height={200}>
                            <RechartsPieChart>
                                <Pie
                                    data={expenseData}
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={60}
                                    fill="#8884d8"
                                    dataKey="amount"
                                    nameKey="category"
                                >
                                    {expenseData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value) => `€${value.toLocaleString()}`}
                                    contentStyle={{ fontSize: '12px' }}
                                />
                            </RechartsPieChart>
                        </ResponsiveContainer>
                        {/* Legend */}
                        <div className="mt-3 space-y-1">
                            {expenseData.map((cat, index) => (
                                <div key={index} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                                        />
                                        <span style={{ color: COLORS.darkGray }}>{cat.category}</span>
                                    </div>
                                    <span className="font-semibold" style={{ color: COLORS.expenseColor }}>
                                        {formatCurrency(cat.amount)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Summary Card */}
                <div className="rounded-lg p-4 shadow-sm" style={{ backgroundColor: `${COLORS.slainteBlue}10`, border: `1px solid ${COLORS.slainteBlue}40` }}>
                    <h3 className="font-semibold mb-2 text-sm" style={{ color: COLORS.slainteBlue }}>
                        Year Summary
                    </h3>
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                            <p className="text-xs" style={{ color: COLORS.mediumGray }}>Income</p>
                            <p className="text-sm font-bold" style={{ color: COLORS.incomeColor }}>
                                {formatCurrency(summaries.income)}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs" style={{ color: COLORS.mediumGray }}>Expenses</p>
                            <p className="text-sm font-bold" style={{ color: COLORS.expenseColor }}>
                                {formatCurrency(summaries.expenses)}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs" style={{ color: COLORS.mediumGray }}>Profit</p>
                            <p className="text-sm font-bold" style={{ color: COLORS.slainteBlue }}>
                                {formatCurrency(profit)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Bottom Navigation - 5 TABS
    const BottomNav = () => {
        const tabs = [
            { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
            { id: 'charts', icon: TrendingUp, label: 'Charts' },
            { id: 'label', icon: Tag, label: 'Label', badge: unidentifiedTransactions.length },
            { id: 'reports', icon: FileText, label: 'Reports' },
            { id: 'sync', icon: Cloud, label: 'Sync' },
            { id: 'chat', icon: MessageCircle, label: 'Chat' }
        ];

        return (
            <div className="px-4 py-2 fixed bottom-0 left-0 right-0 z-40" style={{ backgroundColor: COLORS.white, borderTop: `1px solid ${COLORS.lightGray}` }}>
                <div className="flex justify-around max-w-sm mx-auto">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setCurrentTab(tab.id)}
                            className="flex flex-col items-center py-2 px-2 rounded-lg transition-colors"
                            style={currentTab === tab.id
                                ? { color: COLORS.slainteBlue, backgroundColor: `${COLORS.slainteBlue}15` }
                                : { color: COLORS.mediumGray }
                            }
                        >
                            <div className="relative">
                                <tab.icon className="h-5 w-5" />
                                {tab.badge && tab.badge > 0 && (
                                    <span className="absolute -top-2 -right-2 text-xs rounded-full h-5 w-5 flex items-center justify-center" style={{ backgroundColor: COLORS.expenseColor, color: COLORS.white }}>
                                        {tab.badge}
                                    </span>
                                )}
                            </div>
                            <span className="text-[10px] mt-1">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    // Mobile GMS Report Viewer
    const MobileGMSReportViewer = ({ report, onClose }) => {
        if (!report) return null;

        // Extract the report content from the HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(report.htmlContent, 'text/html');

        // Remove only the header title and practice info, not the whole section
        // Find and remove the h2 with "GMS Health Check Report"
        const reportTitle = doc.querySelector('h2');
        if (reportTitle && reportTitle.textContent.includes('GMS Health Check')) {
            // Remove the title
            reportTitle.remove();

            // Remove the practice name/date paragraph that follows
            const practiceInfo = doc.querySelector('p.text-sm.mt-1');
            if (practiceInfo) {
                practiceInfo.remove();
            }
        }

        const reportContent = doc.body.innerHTML;

        // Handle clicks on the alert banner
        const handleReportClick = (e) => {
            // Check if clicked element is within the alert banner
            const alertBanner = e.target.closest('.alert, [class*="amber"]');
            if (alertBanner) {
                alert('Please use the desktop app to upload your PCRS PDFs');
            }
        };

        return (
            <div className="fixed inset-0 bg-white z-50 flex flex-col">
                {/* Header with back button */}
                <div className="flex items-center p-4 shadow-sm" style={{ borderBottom: `1px solid ${COLORS.lightGray}` }}>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg mr-3"
                        style={{ backgroundColor: `${COLORS.slainteBlue}15`, color: COLORS.slainteBlue }}
                    >
                        <ArrowDown className="h-5 w-5 transform rotate-90" />
                    </button>
                    <div className="flex-1">
                        <h2 className="text-lg font-bold" style={{ color: COLORS.darkGray }}>GMS Health Check</h2>
                        <p className="text-xs" style={{ color: COLORS.mediumGray }}>
                            {new Date(report.generatedDate).toLocaleDateString('en-IE', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                            })}
                        </p>
                    </div>
                </div>

                {/* Report content with mobile-optimized styling */}
                <div className="flex-1 overflow-y-auto p-4" onClick={handleReportClick}>
                    <style>{`
                        .gms-report-content h1 {
                            color: ${COLORS.slainteBlue};
                            font-size: 1.5rem;
                            font-weight: 700;
                            margin-bottom: 1rem;
                            padding-bottom: 0.5rem;
                            border-bottom: 2px solid ${COLORS.slainteBlue};
                        }
                        .gms-report-content h2 {
                            color: ${COLORS.slainteBlue};
                            font-size: 1.25rem;
                            font-weight: 600;
                            margin-top: 1.5rem;
                            margin-bottom: 0.75rem;
                            padding-bottom: 0.5rem;
                            border-bottom: 1px solid ${COLORS.lightGray};
                        }
                        .gms-report-content h3 {
                            color: ${COLORS.darkGray};
                            font-size: 1.1rem;
                            font-weight: 600;
                            margin-top: 1rem;
                            margin-bottom: 0.5rem;
                        }
                        .gms-report-content p {
                            color: ${COLORS.darkGray};
                            font-size: 0.95rem;
                            line-height: 1.6;
                            margin-bottom: 0.75rem;
                        }
                        .gms-report-content ul, .gms-report-content ol {
                            margin-left: 1.25rem;
                            margin-bottom: 1rem;
                        }
                        .gms-report-content li {
                            color: ${COLORS.darkGray};
                            font-size: 0.95rem;
                            line-height: 1.6;
                            margin-bottom: 0.5rem;
                        }
                        .gms-report-content table {
                            width: 100%;
                            border-collapse: collapse;
                            margin: 1rem 0;
                            font-size: 0.85rem;
                            overflow-x: auto;
                            display: block;
                        }
                        .gms-report-content table thead {
                            display: table;
                            width: 100%;
                            table-layout: fixed;
                        }
                        .gms-report-content table tbody {
                            display: table;
                            width: 100%;
                            table-layout: fixed;
                        }
                        .gms-report-content th {
                            background-color: ${COLORS.slainteBlue};
                            color: white;
                            padding: 0.5rem;
                            text-align: left;
                            font-weight: 600;
                            border: 1px solid ${COLORS.lightGray};
                        }
                        .gms-report-content td {
                            padding: 0.5rem;
                            border: 1px solid ${COLORS.lightGray};
                            color: ${COLORS.darkGray};
                        }
                        .gms-report-content .alert {
                            background-color: ${COLORS.highlightYellow}30;
                            border-left: 4px solid ${COLORS.highlightYellow};
                            padding: 0.5rem;
                            margin: 0.5rem 0;
                            border-radius: 4px;
                            font-size: 0.75rem;
                            line-height: 1.3;
                            cursor: pointer;
                        }
                        .gms-report-content .alert:active {
                            background-color: ${COLORS.highlightYellow}50;
                        }
                        .gms-report-content .bg-amber-50 {
                            cursor: pointer;
                        }
                        .gms-report-content .bg-amber-50:active {
                            background-color: ${COLORS.highlightYellow}50;
                        }
                        .gms-report-content .alert p {
                            font-size: 0.75rem;
                            margin-bottom: 0;
                            line-height: 1.3;
                        }
                        .gms-report-content .alert strong {
                            font-size: 0.75rem;
                        }
                        .gms-report-content .grid {
                            display: grid;
                            gap: 1rem;
                            margin: 1rem 0;
                        }
                        .gms-report-content .card {
                            border: 1px solid ${COLORS.lightGray};
                            border-radius: 8px;
                            padding: 1rem;
                            background: ${COLORS.backgroundGray};
                        }
                        .gms-report-content strong {
                            color: ${COLORS.slainteBlue};
                            font-weight: 600;
                        }
                        .gms-report-content button {
                            display: none !important;
                        }
                        .gms-report-content .no-print {
                            display: none !important;
                        }
                        /* Hide the duplicate header at top of report */
                        .gms-report-content > div:first-child {
                            display: none !important;
                        }
                    `}</style>
                    <div
                        className="gms-report-content"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(reportContent) }}
                    />
                </div>
            </div>
        );
    };

    // Mobile Header Component with compact logo
    const MobileHeader = () => (
        <div
            className="fixed top-0 left-0 right-0 z-30 shadow-sm"
            style={{
                backgroundColor: COLORS.white,
                borderBottom: `1px solid ${COLORS.lightGray}`
            }}
        >
            <div className="flex items-center justify-center py-1 px-4">
                {/* Compact mobile logo - 40% shorter banner */}
                <svg
                    width="120"
                    height="30"
                    viewBox="0 0 240 60"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="inline-block"
                >
                    {/* Main logo text: sl[Ai]nte */}
                    <text
                        x="0"
                        y="28"
                        fontSize="36"
                        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                        fontWeight="700"
                        letterSpacing="-1"
                    >
                        <tspan fill={COLORS.darkGray}>sl</tspan>
                        <tspan fill={COLORS.slainteBlue}>[Ai]</tspan>
                        <tspan fill={COLORS.darkGray}>nte</tspan>
                    </text>

                    {/* Finance subtitle - positioned lower */}
                    <text
                        x="52"
                        y="50"
                        fill={COLORS.slainteBlue}
                        fontSize="14"
                        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                        fontWeight="500"
                    >
                        Finance
                    </text>
                </svg>
            </div>
        </div>
    );

    // Main Mobile Layout
    return (
        <div className="bg-gray-50 min-h-screen relative">
            <MobileHeader />

            {/* Main content area with padding for fixed header and bottom nav */}
            <div className="pt-10 pb-20">
                {currentTab === 'dashboard' && <MobileDashboard />}
                {currentTab === 'charts' && <MobileDataVisualisation />}
                {currentTab === 'label' && <MobileTransactionLabeling />}
                {currentTab === 'reports' && <MobileReports />}
                {currentTab === 'sync' && <SyncManager />}
                {currentTab === 'chat' && <MobileChat />}
            </div>

            {/* Detail Modal */}
            {selectedMetric && (
                <DetailModal
                    metric={selectedMetric}
                    onClose={() => setSelectedMetric(null)}
                />
            )}

            {/* GMS Report Viewer */}
            {viewingGMSReport && (
                <MobileGMSReportViewer
                    report={viewingGMSReport}
                    onClose={() => setViewingGMSReport(null)}
                />
            )}

            {/* Artifact Viewer */}
            {viewingArtifact && (
                <MobileArtifactViewer
                    artifact={viewingArtifact}
                    onClose={() => setViewingArtifact(null)}
                />
            )}

            <BottomNav />
        </div>
    );
};

export default MobileLayout;
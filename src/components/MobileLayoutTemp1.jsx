import React, { useState } from 'react';
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
    X
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { calculateSummaries } from '../utils/financialCalculations';
import { getLatestMonthData } from '../utils/paymentCalculations';

const MobileLayout = () => {
    const [currentTab, setCurrentTab] = useState('dashboard');
    const [selectedMetric, setSelectedMetric] = useState(null);
    const [chatMessages, setChatMessages] = useState([
        { id: 1, type: 'bot', content: 'Hello! I can help you analyze your practice finances. What would you like to know?' }
    ]);
    const [chatInput, setChatInput] = useState('');

    // Get data from context
    const contextData = useAppContext();
    const {
        transactions = [],
        unidentifiedTransactions = [],
        paymentAnalysisData = [],  // ← Add this
        showSensitiveData = true,
        selectedYear = new Date().getFullYear(),
        categoryMapping = []
    } = contextData;

    const categorizeTransaction = contextData.categorizeTransaction || (() => { });
    const summaries = calculateSummaries(transactions, selectedYear);
    const profit = summaries.income - summaries.expenses;
    const profitMargin = summaries.income > 0 ? ((profit / summaries.income) * 100).toFixed(1) : 0;
    const latestPaymentData = getLatestMonthData(paymentAnalysisData, selectedYear);

    // Mock breakdown data for detail modal
    const mockIncomeBreakdown = [
        { category: '01-NET GMS', amount: summaries.income * 0.384, percentage: 38.4 },
        { category: '02-Patient Fees', amount: summaries.income * 0.263, percentage: 26.3 },
        { category: '03-Net State Contracts', amount: summaries.income * 0.224, percentage: 22.4 },
        { category: '04-DSP', amount: summaries.income * 0.071, percentage: 7.1 },
        { category: '06-Insurance Reports', amount: summaries.income * 0.038, percentage: 3.8 },
        { category: '09-Income: Other', amount: summaries.income * 0.020, percentage: 2.0 }
    ];

    const mockExpenseBreakdown = [
        { category: '10-GP Assistant', amount: summaries.expenses * 0.211, percentage: 21.1 },
        { category: '11-GP Locum', amount: summaries.expenses * 0.174, percentage: 17.4 },
        { category: '12-Nurse', amount: summaries.expenses * 0.147, percentage: 14.7 },
        { category: '15-Medical Supplies', amount: summaries.expenses * 0.113, percentage: 11.3 },
        { category: '25-Office Supplies', amount: summaries.expenses * 0.091, percentage: 9.1 },
        { category: '30-Professional Services', amount: summaries.expenses * 0.071, percentage: 7.1 },
        { category: '35-Utilities', amount: summaries.expenses * 0.055, percentage: 5.5 },
        { category: '40-Insurance', amount: summaries.expenses * 0.045, percentage: 4.5 },
        { category: '20-Bank Charges', amount: summaries.expenses * 0.027, percentage: 2.7 },
        { category: '45-Other Expenses', amount: summaries.expenses * 0.066, percentage: 6.6 }
    ];

    // Format currency for mobile
    const formatCurrency = (amount) => {
        if (typeof amount !== 'number') return '€0';
        return showSensitiveData ? `€${Math.abs(amount).toLocaleString()}` : '€***';
    };

    // Get change indicator
    const getChangeIndicator = (positive) => positive ?
        <ArrowUp className="h-4 w-4 text-green-500" /> :
        <ArrowDown className="h-4 w-4 text-red-500" />;

    // Detail Modal Component
    const DetailModal = ({ metric, onClose }) => {
        if (!metric) return null;

        let data = [];
        let title = '';
        let totalAmount = 0;

        switch (metric) {
            case 'income':
                data = mockIncomeBreakdown;
                title = 'Income Breakdown';
                totalAmount = summaries.income;
                break;
            case 'expenses':
                data = mockExpenseBreakdown;
                title = 'Expense Breakdown';
                totalAmount = summaries.expenses;
                break;
            case 'profit':
                title = 'Profit Analysis';
                totalAmount = profit;
                break;
        }

        return (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-end z-50">
                <div className="bg-white rounded-t-2xl w-full max-h-[80%] overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b">
                        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 80px)' }}>
                        <div className="bg-gray-50 rounded-lg p-4 mb-4">
                            <div className="text-center">
                                <p className="text-sm text-gray-600">Total {title.split(' ')[0]}</p>
                                <p className={`text-2xl font-bold ${metric === 'income' ? 'text-green-600' :
                                        metric === 'expenses' ? 'text-red-600' : 'text-blue-600'
                                    }`}>
                                    {formatCurrency(totalAmount)}
                                </p>
                                {metric === 'profit' && (
                                    <p className="text-sm text-gray-500 mt-1">
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
            <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Financial Overview</h1>
                <p className="text-sm text-gray-500">
                    Year {selectedYear} • Last updated: {new Date().toLocaleDateString()}
                </p>
            </div>

            {/* Financial Cards */}
            <div className="grid grid-cols-1 gap-4">
                {/* Income Card */}
                <div
                    onClick={() => setSelectedMetric('income')}
                    className="bg-green-50 rounded-lg p-4 border border-green-200 cursor-pointer active:bg-green-100"
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-green-600 text-sm font-medium">Total Income (YTD)</p>
                            <p className="text-2xl font-bold text-green-700">{formatCurrency(summaries.income)}</p>
                            <div className="flex items-center mt-2">
                                {getChangeIndicator(true)}
                                <span className="text-sm text-green-600">+12.3% vs last month</span>
                            </div>
                            <p className="text-xs text-green-600 mt-1">Tap for breakdown →</p>
                        </div>
                        <ArrowUp className="h-8 w-8 text-green-500" />
                    </div>
                </div>

                {/* Expenses Card */}
                <div
                    onClick={() => setSelectedMetric('expenses')}
                    className="bg-red-50 rounded-lg p-4 border border-red-200 cursor-pointer active:bg-red-100"
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-red-600 text-sm font-medium">Total Expenses (YTD)</p>
                            <p className="text-2xl font-bold text-red-700">{formatCurrency(summaries.expenses)}</p>
                            <div className="flex items-center mt-2">
                                {getChangeIndicator(false)}
                                <span className="text-sm text-red-600">+4.1% vs last month</span>
                            </div>
                            <p className="text-xs text-red-600 mt-1">Tap for breakdown →</p>
                        </div>
                        <ArrowDown className="h-8 w-8 text-red-500" />
                    </div>
                </div>

                {/* Net Profit Card */}
                <div
                    onClick={() => setSelectedMetric('profit')}
                    className="bg-blue-50 rounded-lg p-4 border border-blue-200 cursor-pointer active:bg-blue-100"
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-blue-600 text-sm font-medium">Net Profit (YTD)</p>
                            <p className="text-2xl font-bold text-blue-700">{formatCurrency(profit)}</p>
                            <div className="flex items-center mt-2">
                                {getChangeIndicator(true)}
                                <span className="text-sm text-blue-600">+8.2% vs last month</span>
                                <span className="text-xs text-blue-500 ml-2">
                                    ({summaries.income > 0 ? ((profit / summaries.income) * 100).toFixed(1) : 0}% margin)
                                </span>
                            </div>
                            <p className="text-xs text-blue-600 mt-1">Tap for analysis →</p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-blue-500" />
                    </div>
                </div>
            </div>

            {/* Patient Demographics Card - Matching Desktop */}
            <div className="bg-white rounded-lg p-4 border shadow-sm">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                    <User className="h-5 w-5 text-purple-600" />
                    Latest Patient Demographics
                </h3>
                {latestPaymentData ? (
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-blue-50 p-3 rounded-lg text-center">
                            <p className="text-lg font-bold text-blue-900">
                                {latestPaymentData.totalPanelSize?.toLocaleString() || 0}
                            </p>
                            <p className="text-xs text-blue-800 font-medium mt-1">Total Panel Size</p>
                        </div>
                        <div className="bg-purple-50 p-3 rounded-lg text-center">
                            <p className="text-lg font-bold text-purple-900">
                                {latestPaymentData.totalPatientsOver70?.toLocaleString() || 0}
                            </p>
                            <p className="text-xs text-purple-800 font-medium mt-1">Patients Over 70</p>
                        </div>
                        <div className="bg-orange-50 p-3 rounded-lg text-center">
                            <p className="text-lg font-bold text-orange-900">
                                {latestPaymentData.totalNursingHome?.toLocaleString() || 0}
                            </p>
                            <p className="text-xs text-orange-800 font-medium mt-1">Nursing Home</p>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-4 text-gray-500 text-sm">
                        No payment analysis data available. Upload PCRS PDFs to see panel demographics.
                    </div>
                )}
            </div>

            {/* Latest Claims & Leave Data - Matching Desktop */}
            <div className="bg-white rounded-lg p-4 border shadow-sm">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                    <Activity className="h-5 w-5 text-indigo-600" />
                    Latest Claims & Leave Data
                </h3>
                {latestPaymentData ? (
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-indigo-50 p-3 rounded-lg">
                            <h4 className="text-xs font-semibold text-indigo-800 mb-1">STC Claims</h4>
                            <p className="text-lg font-bold text-indigo-900">
                                {latestPaymentData.totalSTCClaims?.toLocaleString() || 0}
                            </p>
                        </div>
                        <div className="bg-green-50 p-3 rounded-lg">
                            <h4 className="text-xs font-semibold text-green-800 mb-1">STC Claims Paid</h4>
                            <p className="text-lg font-bold text-green-900">
                                {latestPaymentData.totalSTCClaimsPaid?.toLocaleString() || 0}
                            </p>
                        </div>
                        <div className="bg-yellow-50 p-3 rounded-lg">
                            <h4 className="text-xs font-semibold text-yellow-800 mb-1">Annual Leave Balance</h4>
                            <p className="text-lg font-bold text-yellow-900">
                                {latestPaymentData.totalAnnualLeaveBalance?.toLocaleString() || 0}
                            </p>
                        </div>
                        <div className="bg-red-50 p-3 rounded-lg">
                            <h4 className="text-xs font-semibold text-red-800 mb-1">Study Leave Balance</h4>
                            <p className="text-lg font-bold text-red-900">
                                {latestPaymentData.totalStudyLeaveBalance?.toLocaleString() || 0}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-4 text-gray-500 text-sm">
                        No claims and leave data available.
                    </div>
                )}
            </div>

            {/* Uncategorized Alert */}
            {unidentifiedTransactions.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center">
                        <AlertCircle className="h-5 w-5 text-yellow-600 mr-3" />
                        <div>
                            <p className="font-medium text-yellow-800">
                                {unidentifiedTransactions.length} uncategorized transactions
                            </p>
                            <button
                                onClick={() => setCurrentTab('label')}
                                className="text-sm text-yellow-700 underline"
                            >
                                Review and categorize →
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    // 2. MOBILE TRANSACTION LABELING
    const MobileTransactionLabeling = () => (
        <div className="p-4 max-w-sm mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Label Transactions</h1>
                <p className="text-sm text-gray-500">
                    {unidentifiedTransactions.length} transactions need categorization
                </p>
            </div>

            {unidentifiedTransactions.length === 0 ? (
                <div className="text-center py-12">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">All caught up!</h3>
                    <p className="text-gray-500">No transactions need categorization</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {unidentifiedTransactions.slice(0, 5).map((transaction) => (
                        <div key={transaction.id} className="bg-white rounded-lg border shadow-sm">
                            <div className="p-4 border-b">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-900">{transaction.description}</p>
                                        <p className="text-sm text-gray-500">{new Date(transaction.date).toLocaleDateString()}</p>
                                    </div>
                                    <p className={`text-lg font-bold ${transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        €{Math.abs(transaction.amount).toLocaleString()}
                                    </p>
                                </div>

                                <div className="bg-blue-50 rounded-lg p-3">
                                    <p className="text-sm text-blue-700">
                                        <span className="font-medium">AI Suggests:</span> {transaction.suggestedCategory || '01-NET GMS'}
                                    </p>
                                </div>
                            </div>

                            <div className="p-4 space-y-3">
                                <button
                                    onClick={() => categorizeTransaction(transaction.id, transaction.suggestedCategory || '01-NET GMS')}
                                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium"
                                >
                                    Use AI Suggestion
                                </button>

                                <div className="grid grid-cols-2 gap-2">
                                    <select
                                        className="p-2 border rounded-lg text-sm"
                                        onChange={(e) => e.target.value && categorizeTransaction(transaction.id, e.target.value)}
                                        defaultValue=""
                                    >
                                        <option value="">Choose different...</option>
                                        {categoryMapping.map(cat => (
                                            <option key={cat.code} value={cat.name}>{cat.name}</option>
                                        ))}
                                    </select>
                                    <button className="text-gray-500 border border-gray-300 py-2 px-4 rounded-lg text-sm">
                                        Skip
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    // 3. MOBILE REPORTS (View Only)
    const MobileReports = () => (
        <div className="p-4 max-w-sm mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Financial Reports</h1>
                <p className="text-sm text-gray-500">View and share professional reports</p>
            </div>

            {/* Quick Summary */}
            <div className="bg-white rounded-lg border p-4 mb-4">
                <h3 className="font-semibold mb-3">Current Year Summary</h3>
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Total Income</span>
                        <span className="font-semibold text-green-600">{formatCurrency(summaries.income)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Total Expenses</span>
                        <span className="font-semibold text-red-600">{formatCurrency(summaries.expenses)}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t pt-2">
                        <span className="text-gray-900 font-medium">Net Profit</span>
                        <span className="font-bold text-blue-600">{formatCurrency(profit)}</span>
                    </div>
                </div>
            </div>

            {/* Available Reports */}
            <div className="space-y-3">
                <div className="bg-white border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                            <h4 className="font-medium text-gray-900">Monthly Summary Report</h4>
                            <p className="text-xs text-gray-500 mt-1">Income, expenses, and key metrics</p>
                        </div>
                        <FileText className="h-5 w-5 text-gray-400" />
                    </div>
                    <div className="flex space-x-2">
                        <button className="flex-1 flex items-center justify-center p-2 bg-blue-50 rounded border border-blue-200">
                            <Mail className="h-4 w-4 text-blue-600 mr-1" />
                            <span className="text-sm font-medium text-blue-700">Email</span>
                        </button>
                        <button className="flex-1 flex items-center justify-center p-2 bg-green-50 rounded border border-green-200">
                            <Download className="h-4 w-4 text-green-600 mr-1" />
                            <span className="text-sm font-medium text-green-700">Download</span>
                        </button>
                    </div>
                </div>

                <div className="bg-white border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                            <h4 className="font-medium text-gray-900">Year-to-Date Overview</h4>
                            <p className="text-xs text-gray-500 mt-1">Complete financial performance for {selectedYear}</p>
                        </div>
                        <FileText className="h-5 w-5 text-gray-400" />
                    </div>
                    <div className="flex space-x-2">
                        <button className="flex-1 flex items-center justify-center p-2 bg-blue-50 rounded border border-blue-200">
                            <Mail className="h-4 w-4 text-blue-600 mr-1" />
                            <span className="text-sm font-medium text-blue-700">Email</span>
                        </button>
                        <button className="flex-1 flex items-center justify-center p-2 bg-green-50 rounded border border-green-200">
                            <Download className="h-4 w-4 text-green-600 mr-1" />
                            <span className="text-sm font-medium text-green-700">Download</span>
                        </button>
                    </div>
                </div>

                <div className="bg-white border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                            <h4 className="font-medium text-gray-900">Claims & Patient Report</h4>
                            <p className="text-xs text-gray-500 mt-1">Panel size, claims status, demographics</p>
                        </div>
                        <FileText className="h-5 w-5 text-gray-400" />
                    </div>
                    <div className="flex space-x-2">
                        <button className="flex-1 flex items-center justify-center p-2 bg-blue-50 rounded border border-blue-200">
                            <Mail className="h-4 w-4 text-blue-600 mr-1" />
                            <span className="text-sm font-medium text-blue-700">Email</span>
                        </button>
                        <button className="flex-1 flex items-center justify-center p-2 bg-green-50 rounded border border-green-200">
                            <Download className="h-4 w-4 text-green-600 mr-1" />
                            <span className="text-sm font-medium text-green-700">Download</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                    <strong>Note:</strong> For detailed report customization and bulk exports, please use the desktop version.
                </p>
            </div>
        </div>
    );

    // 4. MOBILE FINANCIAL CHAT
    const MobileChat = () => {
        const handleSendMessage = () => {
            if (!chatInput.trim()) return;

            const newMessage = {
                id: chatMessages.length + 1,
                type: 'user',
                content: chatInput
            };

            setChatMessages(prev => [...prev, newMessage]);
            setChatInput('');

            setTimeout(() => {
                const botResponse = {
                    id: chatMessages.length + 2,
                    type: 'bot',
                    content: `Based on your current data for ${selectedYear}, your practice is performing well with a ${summaries.income > 0 ? ((profit / summaries.income) * 100).toFixed(1) : 0}% profit margin. Total income is ${formatCurrency(summaries.income)} and expenses are ${formatCurrency(summaries.expenses)}.`
                };
                setChatMessages(prev => [...prev, botResponse]);
            }, 1000);
        };

        return (
            <div className="flex flex-col h-[calc(100vh-140px)] max-w-sm mx-auto">
                <div className="p-4 border-b bg-white">
                    <h1 className="text-xl font-bold text-gray-900">Financial Assistant</h1>
                    <p className="text-sm text-gray-500">Ask me about your practice finances</p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                    {chatMessages.map((message) => (
                        <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xs px-4 py-2 rounded-lg ${message.type === 'user'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-gray-900 border'
                                }`}>
                                <p className="text-sm">{message.content}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-4 bg-white border-t">
                    <div className="flex space-x-3">
                        <input
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                            placeholder="Ask about your finances..."
                            className="flex-1 p-3 border rounded-lg"
                        />
                        <button
                            onClick={handleSendMessage}
                            className="bg-blue-600 text-white p-3 rounded-lg"
                        >
                            <Send className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                        {['Profit margin?', 'Top expenses?', 'Cash flow?', 'Panel info?'].map((question) => (
                            <button
                                key={question}
                                onClick={() => setChatInput(question)}
                                className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full"
                            >
                                {question}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    // Bottom Navigation - ONLY 4 TABS
    const BottomNav = () => {
        const tabs = [
            { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
            { id: 'label', icon: Tag, label: 'Label', badge: unidentifiedTransactions.length },
            { id: 'reports', icon: FileText, label: 'Reports' },
            { id: 'chat', icon: MessageCircle, label: 'Chat' }
        ];

        return (
            <div className="bg-white border-t px-4 py-2 fixed bottom-0 left-0 right-0 z-40">
                <div className="flex justify-around max-w-sm mx-auto">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setCurrentTab(tab.id)}
                            className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${currentTab === tab.id
                                    ? 'text-blue-600 bg-blue-50'
                                    : 'text-gray-500'
                                }`}
                        >
                            <div className="relative">
                                <tab.icon className="h-6 w-6" />
                                {tab.badge && tab.badge > 0 && (
                                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                        {tab.badge}
                                    </span>
                                )}
                            </div>
                            <span className="text-xs mt-1">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    // Main Mobile Layout
    return (
        <div className="bg-gray-50 min-h-screen pb-20 relative">
            {currentTab === 'dashboard' && <MobileDashboard />}
            {currentTab === 'label' && <MobileTransactionLabeling />}
            {currentTab === 'reports' && <MobileReports />}
            {currentTab === 'chat' && <MobileChat />}

            {/* Detail Modal */}
            {selectedMetric && (
                <DetailModal
                    metric={selectedMetric}
                    onClose={() => setSelectedMetric(null)}
                />
            )}

            <BottomNav />
        </div>
    );
};

export default MobileLayout;
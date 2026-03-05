import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { getLatestMonthData } from '../utils/paymentCalculations'; //  Import the new function
import { COLORS } from '../utils/colors'; // Import color palette
import {
    TrendingUp,
    BarChart3,
    PieChart,
    Download,
    AlertCircle,
    Calendar,
    X,
    ChevronRight,
    Info,
    FileText,
    Upload,
    CheckCircle,
    Activity,
    Layers,
    Target,
    Clock,
    User,
    Users,
    DollarSign
} from 'lucide-react';
import { getDashboardActions, getOverdueActions, updateActionItem, getActionItems } from '../storage/practiceProfileStorage';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    BarChart,
    Bar,
    PieChart as RechartsPieChart,
    Pie,
    Cell
} from 'recharts';
import { calculateSummaries, calculateWithholdingTax } from '../utils/financialCalculations';
import { shouldRecommendRefinement, getRefinementCategoryCounts } from '../utils/categoryRefinementUtils';
import CategoryRefinementWizard from './CategoryRefinementWizard';
import { usePracticeProfile } from '../hooks/usePracticeProfile';
import { analyzeGMSIncome } from '../utils/healthCheckCalculations';

const CHART_COLORS = [COLORS.slainteBlue, COLORS.incomeColor, COLORS.highlightYellow, COLORS.expenseColor, '#8884D8', '#82CA9D'];

export default function Dashboard({ setCurrentView }) {
    const {
        transactions,
        unidentifiedTransactions,
        paymentAnalysisData, // 👈 Get the payment data
        selectedYear,
        setSelectedYear,
        useRollingYear,
        setUseRollingYear,
        getAvailableYears
    } = useAppContext();

    const [selectedMetric, setSelectedMetric] = useState(null); // 'income', 'expenses', 'profit', or 'withholding'
    const [showRefinementWizard, setShowRefinementWizard] = useState(false);
    const [actionItems, setActionItems] = useState([]); // Filtered for dashboard display
    const [allActionItems, setAllActionItems] = useState([]); // All tasks for the modal
    const [overdueActions, setOverdueActions] = useState([]);
    const [editingAction, setEditingAction] = useState(null);
    const [editForm, setEditForm] = useState({ assignedTo: '', dueDate: '', status: 'pending' });
    const [showAllTasks, setShowAllTasks] = useState(false);

    // GMS KPI modal state
    const [showGMSKPIModal, setShowGMSKPIModal] = useState(null); // 'unclaimed', 'panel', 'upload', 'leave'

    // Dashboard chart mode state
    const [dashboardChartMode, setDashboardChartMode] = useState('income'); // 'income', 'expenses', 'profit'

    // Get practice profile for health check
    const { profile } = usePracticeProfile();

    // Load action items for dashboard
    useEffect(() => {
        const loadActionItems = () => {
            setActionItems(getDashboardActions());
            setAllActionItems(getActionItems());
            setOverdueActions(getOverdueActions());
        };
        loadActionItems();
        // Refresh every minute to check for overdue items
        const interval = setInterval(loadActionItems, 60000);
        return () => clearInterval(interval);
    }, []);

    // Handler to update action status from dashboard
    const handleQuickStatusUpdate = (actionId, newStatus) => {
        updateActionItem(actionId, { status: newStatus });
        setActionItems(getDashboardActions());
        setAllActionItems(getActionItems());
        setOverdueActions(getOverdueActions());
    };

    // Open edit dialog for an action
    const handleEditAction = (action) => {
        setEditingAction(action);
        setEditForm({
            assignedTo: action.assignedTo || '',
            dueDate: action.dueDate ? action.dueDate.split('T')[0] : '',
            status: action.status
        });
    };

    // Save edited action
    const handleSaveEdit = () => {
        if (!editingAction) return;
        updateActionItem(editingAction.id, {
            assignedTo: editForm.assignedTo || null,
            dueDate: editForm.dueDate ? new Date(editForm.dueDate).toISOString() : null,
            status: editForm.status
        });
        setActionItems(getDashboardActions());
        setAllActionItems(getActionItems());
        setOverdueActions(getOverdueActions());
        setEditingAction(null);
    };

    // Get assignee list from profile
    const getAssigneeList = () => {
        const list = [];
        if (profile?.gps?.partners) {
            profile.gps.partners.forEach(p => list.push({ name: p.name, role: 'Partner' }));
        }
        if (profile?.gps?.salaried) {
            profile.gps.salaried.forEach(g => list.push({ name: g.name, role: 'Salaried GP' }));
        }
        if (profile?.staff) {
            profile.staff.forEach(s => {
                const name = s.name || `${s.firstName || ''} ${s.surname || ''}`.trim();
                list.push({ name, role: s.role || 'Staff' });
            });
        }
        if (profile?.healthCheckData?.staffDetails) {
            profile.healthCheckData.staffDetails.forEach(s => {
                list.push({
                    name: `${s.firstName} ${s.surname}`.trim(),
                    role: s.staffType === 'nurse' ? 'Nurse' : s.staffType === 'practiceManager' ? 'Practice Manager' : s.staffType
                });
            });
        }
        return list;
    };

    const summaries = calculateSummaries(transactions, selectedYear, useRollingYear);
    const withholdingTaxData = calculateWithholdingTax(transactions, selectedYear, useRollingYear, paymentAnalysisData);

    // Check if refinement should be recommended
    const refinementCheck = shouldRecommendRefinement(transactions);
    const refinementCounts = getRefinementCategoryCounts(transactions);
    const showRefinementIndicator = refinementCheck.shouldShow;

    // Calculate profit without drawings (Income - Expenses only)
    const profit = summaries.income - summaries.expenses;
    const profitMargin = summaries.income > 0 ? ((profit / summaries.income) * 100).toFixed(1) : 0;
    const latestPaymentData = getLatestMonthData(paymentAnalysisData, selectedYear);

    // Get detailed breakdowns
    const getIncomeBreakdown = () => {
        return summaries.categoryBreakdown
            .filter(c => c.type === 'income')
            .sort((a, b) => b.value - a.value)
            .map(category => ({
                ...category,
                percentage: summaries.income > 0 ? ((category.value / summaries.income) * 100).toFixed(1) : 0
            }));
    };

    const getExpenseBreakdown = () => {
        // Group expenses by section (from new category structure)
        const expenseGroups = {};

        // Group current year expenses by their section
        summaries.categoryBreakdown
            .filter(c => c.type === 'expense')
            .forEach(category => {
                // Use section if available, otherwise create a default group
                const section = category.section || 'Petty Cash / Other';

                if (!expenseGroups[section]) {
                    expenseGroups[section] = { value: 0, categories: [] };
                }
                expenseGroups[section].value += category.value;
                expenseGroups[section].categories.push(category);
            });

        // Convert to array format and add percentages
        return Object.keys(expenseGroups)
            .map(groupName => ({
                name: groupName,
                value: expenseGroups[groupName].value,
                percentage: summaries.expenses > 0 ? ((expenseGroups[groupName].value / summaries.expenses) * 100).toFixed(1) : 0,
                categories: expenseGroups[groupName].categories
            }))
            .filter(group => group.value > 0) // Only show groups with actual expenses
            .sort((a, b) => b.value - a.value);
    };

    const getProfitBreakdown = () => {
        // Show profit analysis by major categories
        const monthlyProfits = summaries.monthlyTrends.map(month => ({
            month: month.month,
            profit: month.income - month.expenses,
            income: month.income,
            expenses: month.expenses,
            margin: month.income > 0 ? (((month.income - month.expenses) / month.income) * 100).toFixed(1) : 0
        }));

        return {
            monthlyProfits,
            totalProfit: profit,
            profitMargin: profitMargin,
            averageMonthlyProfit: monthlyProfits.length > 0 ?
                (monthlyProfits.reduce((sum, m) => sum + m.profit, 0) / monthlyProfits.length) : 0,
            bestMonth: monthlyProfits.length > 0 ?
                monthlyProfits.reduce((best, current) => current.profit > best.profit ? current : best, monthlyProfits[0]) : null,
            worstMonth: monthlyProfits.length > 0 ?
                monthlyProfits.reduce((worst, current) => current.profit < worst.profit ? current : worst, monthlyProfits[0]) : null
        };
    };

    // Modal component for detailed breakdown
    const DetailModal = ({ metric, onClose }) => {
        if (!metric) return null;

        const renderIncomeDetails = () => {
            const incomeData = getIncomeBreakdown();
            return (
                <div>
                    <h3 className="text-xl font-bold mb-4" style={{ color: COLORS.incomeColor }}>Income Breakdown - {selectedYear}</h3>
                    <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: `${COLORS.incomeColor}15` }}>
                        <div className="text-2xl font-bold" style={{ color: COLORS.incomeColor }}>
                            {`€${Math.round(summaries.income).toLocaleString()}`}
                        </div>
                        <div className="text-sm" style={{ color: COLORS.incomeColor }}>Total Income</div>
                        {summaries.yearComparison && (
                            <div className="text-sm mt-1" style={{ color: COLORS.incomeColor }}>
                                {summaries.yearComparison.incomeChange >= 0 ? '↗' : '↘'}
                                {Math.abs(summaries.yearComparison.incomeChange).toFixed(1)}% vs {summaries.yearComparison.previousYear}
                            </div>
                        )}
                    </div>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                        {incomeData.map((category, index) => (
                            <div key={category.name} className="flex items-center justify-between p-3 rounded-lg transition-colors" style={{ backgroundColor: COLORS.backgroundGray }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.lightGray} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.backgroundGray}>
                                <div className="flex-1">
                                    <div className="font-medium" style={{ color: COLORS.darkGray }}>{category.name}</div>
                                    <div className="text-sm" style={{ color: COLORS.mediumGray }}>{category.percentage}% of total income</div>
                                    {category.code && (
                                        <div className="text-xs" style={{ color: COLORS.mediumGray }}>
                                            Code: {category.code}
                                        </div>
                                    )}
                                </div>
                                <div className="text-right">
                                    <div className="font-bold" style={{ color: COLORS.incomeColor }}>
                                        {`€${category.value.toLocaleString()}`}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {incomeData.length === 0 && (
                        <div className="text-center py-8" style={{ color: COLORS.mediumGray }}>
                            No income data available for {selectedYear}
                        </div>
                    )}
                </div>
            );
        };

        const renderExpenseDetails = () => {
            const [selectedExpenseGroup, setSelectedExpenseGroup] = useState(null);
            const expenseData = getExpenseBreakdown();

            // If a group is selected, show the detailed view
            if (selectedExpenseGroup) {
                // Find the group data which includes the categories
                const groupData = expenseData.find(g => g.name === selectedExpenseGroup);
                const detailedCategories = groupData ? groupData.categories.sort((a, b) => b.value - a.value) : [];
                const groupTotal = detailedCategories.reduce((sum, cat) => sum + cat.value, 0);

                return (
                    <div>
                        <div className="flex items-center mb-4">
                            <button onClick={() => setSelectedExpenseGroup(null)} className="mr-2 p-1 rounded-full" style={{ backgroundColor: 'transparent' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.lightGray} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                &larr; Back
                            </button>
                            <h3 className="text-xl font-bold" style={{ color: COLORS.expenseColor }}>{selectedExpenseGroup} Details - {selectedYear}</h3>
                        </div>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {detailedCategories.map((category) => (
                                <div key={category.name} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: COLORS.backgroundGray }}>
                                    <div className="flex-1">
                                        <div className="font-medium" style={{ color: COLORS.darkGray }}>{category.name}</div>
                                        <div className="text-sm" style={{ color: COLORS.mediumGray }}>
                                            {groupTotal > 0 ? ((category.value / groupTotal) * 100).toFixed(1) : 0}% of {selectedExpenseGroup}
                                        </div>
                                        {category.code && (
                                            <div className="text-xs" style={{ color: COLORS.mediumGray }}>
                                                Code: {category.code}
                                            </div>
                                        )}
                                    </div>
                                    <div className="font-bold text-right" style={{ color: COLORS.expenseColor }}>
                                        {`€${category.value.toLocaleString()}`}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            }

            // Default view: Show the grouped summary
            return (
                <div>
                    <h3 className="text-xl font-bold mb-4" style={{ color: COLORS.expenseColor }}>Expense Breakdown - {selectedYear}</h3>
                    <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: `${COLORS.expenseColor}15` }}>
                        <div className="text-2xl font-bold" style={{ color: COLORS.expenseColor }}>
                            {`€${Math.round(summaries.expenses).toLocaleString()}`}
                        </div>
                        <div className="text-sm" style={{ color: COLORS.expenseColor }}>Total Expenses</div>
                    </div>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                        {expenseData.map((group) => (
                            <div
                                key={group.name}
                                onClick={() => setSelectedExpenseGroup(group.name)}
                                className="flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer"
                                style={{ backgroundColor: COLORS.backgroundGray }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.lightGray}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.backgroundGray}
                            >
                                <div className="flex-1">
                                    <div className="font-medium" style={{ color: COLORS.darkGray }}>{group.name}</div>
                                    <div className="text-sm" style={{ color: COLORS.mediumGray }}>{group.percentage}% of total expenses</div>
                                </div>
                                <div className="text-right flex items-center">
                                    <div className="font-bold" style={{ color: COLORS.expenseColor }}>
                                        {`€${group.value.toLocaleString()}`}
                                    </div>
                                    <ChevronRight className="h-4 w-4 ml-2" style={{ color: COLORS.mediumGray }} />
                                </div>
                            </div>
                        ))}
                    </div>
                    {expenseData.length === 0 && (
                        <div className="text-center py-8" style={{ color: COLORS.mediumGray }}>
                            No expense data available for {selectedYear}
                        </div>
                    )}
                </div>
            );
        };
        const renderProfitDetails = () => {
            const profitData = getProfitBreakdown();
            return (
                <div>
                    <h3 className="text-xl font-bold mb-4" style={{ color: COLORS.slainteBlue }}>Profit Analysis - {selectedYear}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="p-4 rounded-lg" style={{ backgroundColor: `${COLORS.slainteBlue}15` }}>
                            <div className="text-xl font-bold" style={{ color: profit >= 0 ? COLORS.incomeColor : COLORS.expenseColor }}>
                                {`€${profit.toLocaleString()}`}
                            </div>
                            <div className="text-sm" style={{ color: COLORS.slainteBlue }}>Total Profit</div>
                            <div className="text-xs mt-1" style={{ color: COLORS.mediumGray }}>Income - Expenses</div>
                        </div>
                        <div className="p-4 rounded-lg" style={{ backgroundColor: `${COLORS.incomeColor}15` }}>
                            <div className="text-xl font-bold" style={{ color: parseFloat(profitMargin) >= 0 ? COLORS.incomeColor : COLORS.expenseColor }}>
                                {profitMargin}%
                            </div>
                            <div className="text-sm" style={{ color: COLORS.incomeColor }}>Profit Margin</div>
                            <div className="text-xs mt-1" style={{ color: COLORS.mediumGray }}>Profit ÷ Income</div>
                        </div>
                        <div className="p-4 rounded-lg" style={{ backgroundColor: `${COLORS.slainteBlue}20` }}>
                            <div className="text-xl font-bold" style={{ color: profitData.averageMonthlyProfit >= 0 ? COLORS.slainteBlue : COLORS.expenseColor }}>
                                {`€${Math.round(profitData.averageMonthlyProfit).toLocaleString()}`}
                            </div>
                            <div className="text-sm" style={{ color: COLORS.slainteBlue }}>Avg Monthly Profit</div>
                            <div className="text-xs mt-1" style={{ color: COLORS.mediumGray }}>Per month average</div>
                        </div>
                    </div>

                    {/* Best and Worst Months */}
                    {profitData.bestMonth && profitData.worstMonth && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div className="p-4 rounded-lg" style={{ backgroundColor: `${COLORS.incomeColor}15` }}>
                                <h4 className="font-semibold mb-2" style={{ color: COLORS.incomeColor }}>Best Month</h4>
                                <div className="text-lg font-bold" style={{ color: COLORS.incomeColor }}>
                                    {profitData.bestMonth.month}
                                </div>
                                <div className="text-sm" style={{ color: COLORS.incomeColor }}>
                                    {`€${profitData.bestMonth.profit.toLocaleString()}`} profit
                                </div>
                                <div className="text-xs" style={{ color: COLORS.mediumGray }}>
                                    {profitData.bestMonth.margin}% margin
                                </div>
                            </div>
                            <div className="p-4 rounded-lg" style={{ backgroundColor: `${COLORS.expenseColor}15` }}>
                                <h4 className="font-semibold mb-2" style={{ color: COLORS.expenseColor }}>Lowest Month</h4>
                                <div className="text-lg font-bold" style={{ color: COLORS.expenseColor }}>
                                    {profitData.worstMonth.month}
                                </div>
                                <div className="text-sm" style={{ color: COLORS.expenseColor }}>
                                    {`€${profitData.worstMonth.profit.toLocaleString()}`} profit
                                </div>
                                <div className="text-xs" style={{ color: COLORS.mediumGray }}>
                                    {profitData.worstMonth.margin}% margin
                                </div>
                            </div>
                        </div>
                    )}

                    <h4 className="font-semibold mb-3">Monthly Profit Trend</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {profitData.monthlyProfits.map((month, index) => (
                            <div key={month.month} className="flex items-center justify-between p-2 rounded transition-colors" style={{ backgroundColor: COLORS.backgroundGray }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.lightGray} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.backgroundGray}>
                                <div className="font-medium" style={{ color: COLORS.darkGray }}>{month.month}</div>
                                <div className="text-right">
                                    <div className="font-bold" style={{ color: month.profit >= 0 ? COLORS.incomeColor : COLORS.expenseColor }}>
                                        {`€${month.profit.toLocaleString()}`}
                                    </div>
                                    <div className="text-xs" style={{ color: COLORS.mediumGray }}>
                                        {month.margin}% margin
                                    </div>
                                    <div className="text-xs" style={{ color: COLORS.mediumGray }}>
                                        {`€${month.income.toLocaleString()} - €${month.expenses.toLocaleString()}`}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {profitData.monthlyProfits.length === 0 && (
                        <div className="text-center py-8" style={{ color: COLORS.mediumGray }}>
                            No monthly data available for {selectedYear}
                        </div>
                    )}
                </div>
            );
        };

        const renderWithholdingDetails = () => {
            return (
                <div>
                    <h3 className="text-xl font-bold mb-4" style={{ color: COLORS.expenseColor }}>
                        Withholding Tax Breakdown - {selectedYear}
                    </h3>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="p-4 rounded-lg" style={{ backgroundColor: `${COLORS.expenseColor}15` }}>
                            <div className="text-sm mb-1" style={{ color: COLORS.mediumGray }}>
                                GMS Withholding Tax
                            </div>
                            <div className="text-2xl font-bold" style={{ color: COLORS.expenseColor }}>
                                {`€${withholdingTaxData.gmsWithholdingTax.toLocaleString()}`}
                            </div>
                            <div className="text-xs mt-1" style={{ color: COLORS.mediumGray }}>
                                From PCRS payments
                            </div>
                        </div>

                        <div className="p-4 rounded-lg" style={{ backgroundColor: `${COLORS.expenseColor}15` }}>
                            <div className="text-sm mb-1" style={{ color: COLORS.mediumGray }}>
                                State Contract Tax
                            </div>
                            <div className="text-2xl font-bold" style={{ color: COLORS.expenseColor }}>
                                {`€${withholdingTaxData.stateContractTax.toLocaleString()}`}
                            </div>
                            <div className="text-xs mt-1" style={{ color: COLORS.mediumGray }}>
                                {withholdingTaxData.stateContractRate}% of €{withholdingTaxData.stateContractIncome.toLocaleString()}
                            </div>
                        </div>
                    </div>

                    {/* Total */}
                    <div className="p-4 rounded-lg mb-6" style={{ backgroundColor: COLORS.backgroundGray, border: `2px solid ${COLORS.expenseColor}` }}>
                        <div className="flex justify-between items-center">
                            <span className="font-semibold" style={{ color: COLORS.darkGray }}>
                                Total Withholding Tax:
                            </span>
                            <span className="text-2xl font-bold" style={{ color: COLORS.expenseColor }}>
                                {`€${withholdingTaxData.total.toLocaleString()}`}
                            </span>
                        </div>
                    </div>

                    {/* GMS Withholding Breakdown */}
                    {withholdingTaxData.breakdown.gmsWithholding.length > 0 && (
                        <div className="mb-6">
                            <h4 className="font-semibold mb-3" style={{ color: COLORS.darkGray }}>
                                GMS Withholding Tax Transactions
                            </h4>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {withholdingTaxData.breakdown.gmsWithholding.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between p-3 rounded-lg"
                                        style={{ backgroundColor: COLORS.backgroundGray }}
                                    >
                                        <div className="flex-1">
                                            <div className="font-medium text-sm" style={{ color: COLORS.darkGray }}>
                                                {item.details}
                                            </div>
                                            <div className="text-xs" style={{ color: COLORS.mediumGray }}>
                                                {new Date(item.date).toLocaleDateString('en-IE')} • {item.category}
                                            </div>
                                        </div>
                                        <div className="font-bold" style={{ color: COLORS.expenseColor }}>
                                            {`€${item.amount.toLocaleString()}`}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* State Contract Income Breakdown */}
                    {withholdingTaxData.breakdown.stateContracts.length > 0 && (
                        <div>
                            <h4 className="font-semibold mb-3" style={{ color: COLORS.darkGray }}>
                                State Contract Income (Net of {withholdingTaxData.stateContractRate}% Withholding)
                            </h4>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {withholdingTaxData.breakdown.stateContracts.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between p-3 rounded-lg"
                                        style={{ backgroundColor: COLORS.backgroundGray }}
                                    >
                                        <div className="flex-1">
                                            <div className="font-medium text-sm" style={{ color: COLORS.darkGray }}>
                                                {item.details}
                                            </div>
                                            <div className="text-xs" style={{ color: COLORS.mediumGray }}>
                                                {new Date(item.date).toLocaleDateString('en-IE')} • {item.category}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold" style={{ color: COLORS.incomeColor }}>
                                                {`€${item.amount.toLocaleString()}`}
                                            </div>
                                            <div className="text-xs" style={{ color: COLORS.expenseColor }}>
                                                Tax: {`€${(item.amount * (withholdingTaxData.stateContractRate / 100)).toLocaleString()}`}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Help Text */}
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-start gap-2">
                            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-blue-800">
                                <p className="font-medium mb-1">About Withholding Tax</p>
                                <ul className="space-y-1 text-xs">
                                    <li>• <strong>GMS Withholding:</strong> Tax deducted from GMS payments by PCRS</li>
                                    <li>• <strong>State Contracts:</strong> Income received net of {withholdingTaxData.stateContractRate}% withholding tax</li>
                                    <li>• This amount reduces your tax liability when filing returns</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            );
        };

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b">
                        <h2 className="text-lg font-semibold">Detailed Breakdown</h2>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    <div className="p-6 overflow-y-auto">
                        {metric === 'income' && renderIncomeDetails()}
                        {metric === 'expenses' && renderExpenseDetails()}
                        {metric === 'profit' && renderProfitDetails()}
                        {metric === 'withholding' && renderWithholdingDetails()}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Year Selector */}
            <div className="bg-white p-4 rounded-lg border">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold" style={{ color: COLORS.darkGray }}>Financial Overview</h3>
                        <span
                            className="text-xs font-semibold px-3 py-1 rounded-full"
                            style={{ backgroundColor: COLORS.highlightYellow, color: COLORS.darkGray }}
                        >
                            {summaries.periodLabel || `${selectedYear} YTD`}
                        </span>
                    </div>
                    <div className="flex items-center space-x-4">
                        {/* Toggle: Calendar Year vs Rolling 12 Months */}
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => setUseRollingYear(!useRollingYear)}
                                className="border rounded px-3 py-1 text-sm font-medium transition-colors"
                                style={{
                                    borderColor: COLORS.slainteBlue,
                                    backgroundColor: useRollingYear ? COLORS.slainteBlue : COLORS.white,
                                    color: useRollingYear ? COLORS.white : COLORS.slainteBlue
                                }}
                            >
                                {useRollingYear ? 'Last 12 Months' : 'Calendar Year'}
                            </button>
                        </div>

                        {/* Year Selector - only shown in calendar year mode */}
                        {!useRollingYear && (
                            <div className="flex items-center space-x-2">
                                <Calendar className="h-4 w-4" style={{ color: COLORS.mediumGray }} />
                                <select
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                    className="border rounded px-3 py-1"
                                    style={{ borderColor: COLORS.lightGray }}
                                >
                                    {getAvailableYears().length > 0 ? getAvailableYears().map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    )) : (
                                        <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                                    )}
                                </select>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Key Metrics - Income, Expenses, Profit, Withholding Tax */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4" data-tour-id="dashboard-summary-cards">
                {/* Income - Solid Turquoise Background */}
                <div
                    onClick={() => setSelectedMetric('income')}
                    className="p-4 rounded-lg cursor-pointer transition-all shadow-md hover:shadow-lg"
                    style={{ backgroundColor: COLORS.incomeColor }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.95'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-white opacity-90">Total Income</p>
                            <p className="text-2xl font-bold text-white mt-1">
                                {`€${Math.round(summaries.income).toLocaleString()}`}
                            </p>
                            {summaries.yearComparison && (
                                <p className="text-xs text-white opacity-90 mt-1">
                                    {summaries.yearComparison.incomeChange >= 0 ? '↗' : '↘'} {Math.abs(summaries.yearComparison.incomeChange).toFixed(1)}% vs {summaries.yearComparison.previousYear}
                                </p>
                            )}
                        </div>
                        <TrendingUp className="h-8 w-8 text-white opacity-80" />
                    </div>
                </div>

                {/* Expenses - Solid Coral Background */}
                <div
                    onClick={() => setSelectedMetric('expenses')}
                    className="p-4 rounded-lg cursor-pointer transition-all shadow-md hover:shadow-lg"
                    style={{ backgroundColor: COLORS.expenseColor }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.95'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-white opacity-90">Total Expenses</p>
                            <p className="text-2xl font-bold text-white mt-1">
                                {`€${Math.round(summaries.expenses).toLocaleString()}`}
                            </p>
                            {summaries.yearComparison && (
                                <p className="text-xs text-white opacity-90 mt-1">
                                    {summaries.yearComparison.expenseChange >= 0 ? '↗' : '↘'} {Math.abs(summaries.yearComparison.expenseChange).toFixed(1)}% vs {summaries.yearComparison.previousYear}
                                </p>
                            )}
                        </div>
                        <BarChart3 className="h-8 w-8 text-white opacity-80" />
                    </div>
                </div>

                {/* Net Profit - Solid Slainte Blue Background */}
                <div
                    onClick={() => setSelectedMetric('profit')}
                    className="p-4 rounded-lg cursor-pointer transition-all shadow-md hover:shadow-lg"
                    style={{ backgroundColor: COLORS.slainteBlue }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.95'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-white opacity-90">Net Profit</p>
                            <p className="text-2xl font-bold text-white mt-1">
                                {`€${profit.toLocaleString()}`}
                            </p>
                            <p className="text-xs text-white opacity-90 mt-1">
                                {profitMargin}% profit margin
                            </p>
                        </div>
                        <PieChart className="h-8 w-8 text-white opacity-80" />
                    </div>
                </div>

                {/* Withholding Tax - Amber/Orange Background */}
                <div
                    onClick={() => setSelectedMetric('withholding')}
                    className="p-4 rounded-lg cursor-pointer transition-all shadow-md hover:shadow-lg"
                    style={{ backgroundColor: '#F59E0B' }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.95'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-white opacity-90">Withholding Tax</p>
                            <p className="text-2xl font-bold text-white mt-1">
                                {`€${withholdingTaxData.total.toLocaleString()}`}
                            </p>
                            <p className="text-xs text-white opacity-90 mt-1">
                                Tax credit available
                            </p>
                        </div>
                        <FileText className="h-8 w-8 text-white opacity-80" />
                    </div>
                </div>
            </div>

            {/* Monthly Comparison Chart - Interactive */}
            {summaries.monthlyTrends && summaries.monthlyTrends.length > 0 && (() => {
                // Calculate previous year data for comparison
                const previousYearSummaries = calculateSummaries(transactions, selectedYear - 1, false);
                const previousYearTrends = previousYearSummaries.monthlyTrends || [];

                // Build comparison data - align months between years using monthNumber
                const comparisonData = summaries.monthlyTrends.map(currentMonth => {
                    // Match by monthNumber (1-12) since month labels include year (e.g., "January 2025")
                    const prevMonth = previousYearTrends.find(p => p.monthNumber === currentMonth.monthNumber);
                    // Extract just the month name for cleaner x-axis labels (e.g., "Jan" instead of "January 2025")
                    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const shortMonthLabel = monthNames[currentMonth.monthNumber - 1] || currentMonth.month;
                    return {
                        month: shortMonthLabel,
                        currentIncome: currentMonth.income || 0,
                        previousIncome: prevMonth?.income || 0,
                        currentExpenses: currentMonth.expenses || 0,
                        previousExpenses: prevMonth?.expenses || 0,
                        currentProfit: (currentMonth.income || 0) - (currentMonth.expenses || 0),
                        previousProfit: (prevMonth?.income || 0) - (prevMonth?.expenses || 0),
                    };
                });

                // Chart config based on mode
                const chartConfig = {
                    income: {
                        title: 'Monthly Income',
                        currentKey: 'currentIncome',
                        previousKey: 'previousIncome',
                        currentColor: COLORS.incomeColor,
                        previousColor: '#86EFAC', // Lighter green
                        currentLabel: `${selectedYear}`,
                        previousLabel: `${selectedYear - 1}`,
                    },
                    expenses: {
                        title: 'Monthly Expenses',
                        currentKey: 'currentExpenses',
                        previousKey: 'previousExpenses',
                        currentColor: COLORS.expenseColor,
                        previousColor: '#FCA5A5', // Lighter red
                        currentLabel: `${selectedYear}`,
                        previousLabel: `${selectedYear - 1}`,
                    },
                    profit: {
                        title: 'Monthly Profit',
                        currentKey: 'currentProfit',
                        previousKey: 'previousProfit',
                        currentColor: COLORS.slainteBlue,
                        previousColor: '#93C5FD', // Lighter blue
                        currentLabel: `${selectedYear}`,
                        previousLabel: `${selectedYear - 1}`,
                    },
                };

                const config = chartConfig[dashboardChartMode];

                return (
                    <div className="bg-white p-6 rounded-lg border" style={{ borderColor: COLORS.lightGray }} data-tour-id="dashboard-charts">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold flex items-center" style={{ color: COLORS.darkGray }}>
                                <TrendingUp className="h-5 w-5 mr-2" style={{ color: COLORS.slainteBlue }} />
                                {config.title}: {selectedYear} vs {selectedYear - 1}
                            </h3>
                            {/* Toggle buttons */}
                            <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: COLORS.lightGray }}>
                                <button
                                    onClick={() => setDashboardChartMode('income')}
                                    className="px-3 py-1.5 text-sm font-medium transition-colors"
                                    style={{
                                        backgroundColor: dashboardChartMode === 'income' ? COLORS.incomeColor : 'white',
                                        color: dashboardChartMode === 'income' ? 'white' : COLORS.mediumGray,
                                    }}
                                >
                                    Income
                                </button>
                                <button
                                    onClick={() => setDashboardChartMode('expenses')}
                                    className="px-3 py-1.5 text-sm font-medium transition-colors border-l border-r"
                                    style={{
                                        backgroundColor: dashboardChartMode === 'expenses' ? COLORS.expenseColor : 'white',
                                        color: dashboardChartMode === 'expenses' ? 'white' : COLORS.mediumGray,
                                        borderColor: COLORS.lightGray,
                                    }}
                                >
                                    Expenses
                                </button>
                                <button
                                    onClick={() => setDashboardChartMode('profit')}
                                    className="px-3 py-1.5 text-sm font-medium transition-colors"
                                    style={{
                                        backgroundColor: dashboardChartMode === 'profit' ? COLORS.slainteBlue : 'white',
                                        color: dashboardChartMode === 'profit' ? 'white' : COLORS.mediumGray,
                                    }}
                                >
                                    Profit
                                </button>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={280}>
                            <LineChart data={comparisonData}>
                                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.lightGray} />
                                <XAxis
                                    dataKey="month"
                                    tick={{ fill: COLORS.mediumGray, fontSize: 12 }}
                                    axisLine={{ stroke: COLORS.lightGray }}
                                />
                                <YAxis
                                    tick={{ fill: COLORS.mediumGray, fontSize: 12 }}
                                    axisLine={{ stroke: COLORS.lightGray }}
                                    tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
                                />
                                <Tooltip
                                    formatter={(value, name) => [
                                        `€${value.toLocaleString()}`,
                                        name
                                    ]}
                                    contentStyle={{
                                        backgroundColor: 'white',
                                        border: `1px solid ${COLORS.lightGray}`,
                                        borderRadius: '8px',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}
                                />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey={config.currentKey}
                                    stroke={config.currentColor}
                                    strokeWidth={2.5}
                                    name={config.currentLabel}
                                    dot={{ fill: config.currentColor, strokeWidth: 2, r: 4 }}
                                    activeDot={{ r: 6 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey={config.previousKey}
                                    stroke={config.previousColor}
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    name={config.previousLabel}
                                    dot={{ fill: config.previousColor, strokeWidth: 2, r: 3 }}
                                    activeDot={{ r: 5 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                        {/* Year-over-year summary */}
                        {(() => {
                            const currentTotal = comparisonData.reduce((sum, d) => sum + d[config.currentKey], 0);
                            const previousTotal = comparisonData.reduce((sum, d) => sum + d[config.previousKey], 0);
                            const change = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal * 100) : 0;
                            const isPositive = dashboardChartMode === 'expenses' ? change < 0 : change > 0;

                            return (
                                <div className="mt-4 pt-4 border-t flex items-center justify-between" style={{ borderColor: COLORS.lightGray }}>
                                    <div className="flex items-center gap-6">
                                        <div>
                                            <p className="text-xs" style={{ color: COLORS.mediumGray }}>{selectedYear} Total</p>
                                            <p className="text-lg font-semibold" style={{ color: config.currentColor }}>
                                                {`€${Math.round(currentTotal).toLocaleString()}`}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs" style={{ color: COLORS.mediumGray }}>{selectedYear - 1} Total</p>
                                            <p className="text-lg font-semibold" style={{ color: config.previousColor }}>
                                                {`€${Math.round(previousTotal).toLocaleString()}`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs" style={{ color: COLORS.mediumGray }}>Year-over-Year</p>
                                        <p className={`text-lg font-semibold flex items-center justify-end gap-1`} style={{ color: isPositive ? COLORS.incomeColor : COLORS.expenseColor }}>
                                            {isPositive ? '↗' : '↘'} {`${Math.abs(change).toFixed(1)}%`}
                                        </p>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                );
            })()}

            {/* Detail Modal */}
            <DetailModal
                metric={selectedMetric}
                onClose={() => setSelectedMetric(null)}
            />

            {/* Category Refinement Wizard */}
            <CategoryRefinementWizard
                isOpen={showRefinementWizard}
                onClose={() => setShowRefinementWizard(false)}
            />
        </div>
    );
}
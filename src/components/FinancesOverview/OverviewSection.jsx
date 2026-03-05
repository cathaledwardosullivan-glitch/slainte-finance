import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { getLatestMonthData } from '../../utils/paymentCalculations';
import { COLORS } from '../../utils/colors';
import {
  TrendingUp,
  BarChart3,
  PieChart,
  X,
  ChevronRight,
  Info,
  FileText,
  List,
  Download
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { calculateSummaries, calculateWithholdingTax } from '../../utils/financialCalculations';

/**
 * OverviewSection - Financial KPIs and charts from Dashboard
 * This is the Overview sub-view within Finances Overview tab
 */
const OverviewSection = ({ onOpenReports, onOpenTransactions }) => {
  const {
    transactions,
    paymentAnalysisData,
    selectedYear,
    useRollingYear
  } = useAppContext();

  const [selectedMetric, setSelectedMetric] = useState(null);
  const [dashboardChartMode, setDashboardChartMode] = useState('income');

  const summaries = calculateSummaries(transactions, selectedYear, useRollingYear);
  const withholdingTaxData = calculateWithholdingTax(transactions, selectedYear, useRollingYear, paymentAnalysisData);

  // Calculate profit without drawings (Income - Expenses only)
  const profit = summaries.income - summaries.expenses;
  const profitMargin = summaries.income > 0 ? ((profit / summaries.income) * 100).toFixed(1) : 0;

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
    const expenseGroups = {};
    summaries.categoryBreakdown
      .filter(c => c.type === 'expense')
      .forEach(category => {
        const section = category.section || 'Petty Cash / Other';
        if (!expenseGroups[section]) {
          expenseGroups[section] = { value: 0, categories: [] };
        }
        expenseGroups[section].value += category.value;
        expenseGroups[section].categories.push(category);
      });

    return Object.keys(expenseGroups)
      .map(groupName => ({
        name: groupName,
        value: expenseGroups[groupName].value,
        percentage: summaries.expenses > 0 ? ((expenseGroups[groupName].value / summaries.expenses) * 100).toFixed(1) : 0,
        categories: expenseGroups[groupName].categories
      }))
      .filter(group => group.value > 0)
      .sort((a, b) => b.value - a.value);
  };

  const getProfitBreakdown = () => {
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

  // Detail Modal Component
  const DetailModal = ({ metric, onClose }) => {
    const [selectedExpenseGroup, setSelectedExpenseGroup] = useState(null);

    if (!metric) return null;

    const renderIncomeDetails = () => {
      const incomeData = getIncomeBreakdown();
      return (
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: COLORS.incomeColor }}>
            Income Breakdown - {selectedYear}
          </h3>
          <div style={{ marginBottom: '1rem', padding: '1rem', borderRadius: '0.5rem', backgroundColor: `${COLORS.incomeColor}15` }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: COLORS.incomeColor }}>
              {`€${Math.round(summaries.income).toLocaleString()}`}
            </div>
            <div style={{ fontSize: '0.875rem', color: COLORS.incomeColor }}>Total Income</div>
          </div>
          <div style={{ maxHeight: '24rem', overflowY: 'auto' }}>
            {incomeData.map((category) => (
              <div
                key={category.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  backgroundColor: COLORS.backgroundGray,
                  marginBottom: '0.5rem'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, color: COLORS.darkGray }}>{category.name}</div>
                  <div style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>{category.percentage}% of total income</div>
                </div>
                <div style={{ fontWeight: 'bold', color: COLORS.incomeColor }}>
                  {`€${category.value.toLocaleString()}`}
                </div>
              </div>
            ))}
            {incomeData.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: COLORS.mediumGray }}>
                No income data available for {selectedYear}
              </div>
            )}
          </div>
        </div>
      );
    };

    const renderExpenseDetails = () => {
      const expenseData = getExpenseBreakdown();

      if (selectedExpenseGroup) {
        const groupData = expenseData.find(g => g.name === selectedExpenseGroup);
        const detailedCategories = groupData ? groupData.categories.sort((a, b) => b.value - a.value) : [];
        const groupTotal = detailedCategories.reduce((sum, cat) => sum + cat.value, 0);

        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
              <button
                onClick={() => setSelectedExpenseGroup(null)}
                style={{
                  marginRight: '0.5rem',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '9999px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: COLORS.mediumGray
                }}
              >
                &larr; Back
              </button>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: COLORS.expenseColor }}>
                {selectedExpenseGroup} Details - {selectedYear}
              </h3>
            </div>
            <div style={{ maxHeight: '24rem', overflowY: 'auto' }}>
              {detailedCategories.map((category) => (
                <div
                  key={category.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    backgroundColor: COLORS.backgroundGray,
                    marginBottom: '0.5rem'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, color: COLORS.darkGray }}>{category.name}</div>
                    <div style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>
                      {groupTotal > 0 ? ((category.value / groupTotal) * 100).toFixed(1) : 0}% of {selectedExpenseGroup}
                    </div>
                  </div>
                  <div style={{ fontWeight: 'bold', color: COLORS.expenseColor }}>
                    {`€${category.value.toLocaleString()}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      return (
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: COLORS.expenseColor }}>
            Expense Breakdown - {selectedYear}
          </h3>
          <div style={{ marginBottom: '1rem', padding: '1rem', borderRadius: '0.5rem', backgroundColor: `${COLORS.expenseColor}15` }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: COLORS.expenseColor }}>
              {`€${Math.round(summaries.expenses).toLocaleString()}`}
            </div>
            <div style={{ fontSize: '0.875rem', color: COLORS.expenseColor }}>Total Expenses</div>
          </div>
          <div style={{ maxHeight: '24rem', overflowY: 'auto' }}>
            {expenseData.map((group) => (
              <div
                key={group.name}
                onClick={() => setSelectedExpenseGroup(group.name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  backgroundColor: COLORS.backgroundGray,
                  marginBottom: '0.5rem',
                  cursor: 'pointer'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, color: COLORS.darkGray }}>{group.name}</div>
                  <div style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>{group.percentage}% of total expenses</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ fontWeight: 'bold', color: COLORS.expenseColor }}>
                    {`€${group.value.toLocaleString()}`}
                  </div>
                  <ChevronRight style={{ height: '1rem', width: '1rem', marginLeft: '0.5rem', color: COLORS.mediumGray }} />
                </div>
              </div>
            ))}
            {expenseData.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: COLORS.mediumGray }}>
                No expense data available for {selectedYear}
              </div>
            )}
          </div>
        </div>
      );
    };

    const renderProfitDetails = () => {
      const profitData = getProfitBreakdown();
      return (
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: COLORS.slainteBlue }}>
            Profit Analysis - {selectedYear}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ padding: '1rem', borderRadius: '0.5rem', backgroundColor: `${COLORS.slainteBlue}15` }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: profit >= 0 ? COLORS.incomeColor : COLORS.expenseColor }}>
                {`€${profit.toLocaleString()}`}
              </div>
              <div style={{ fontSize: '0.875rem', color: COLORS.slainteBlue }}>Total Profit</div>
            </div>
            <div style={{ padding: '1rem', borderRadius: '0.5rem', backgroundColor: `${COLORS.incomeColor}15` }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: parseFloat(profitMargin) >= 0 ? COLORS.incomeColor : COLORS.expenseColor }}>
                {profitMargin}%
              </div>
              <div style={{ fontSize: '0.875rem', color: COLORS.incomeColor }}>Profit Margin</div>
            </div>
            <div style={{ padding: '1rem', borderRadius: '0.5rem', backgroundColor: `${COLORS.slainteBlue}20` }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: profitData.averageMonthlyProfit >= 0 ? COLORS.slainteBlue : COLORS.expenseColor }}>
                {`€${Math.round(profitData.averageMonthlyProfit).toLocaleString()}`}
              </div>
              <div style={{ fontSize: '0.875rem', color: COLORS.slainteBlue }}>Avg Monthly Profit</div>
            </div>
          </div>

          {profitData.bestMonth && profitData.worstMonth && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '1rem', borderRadius: '0.5rem', backgroundColor: `${COLORS.incomeColor}15` }}>
                <h4 style={{ fontWeight: 600, marginBottom: '0.5rem', color: COLORS.incomeColor }}>Best Month</h4>
                <div style={{ fontSize: '1.125rem', fontWeight: 'bold', color: COLORS.incomeColor }}>{profitData.bestMonth.month}</div>
                <div style={{ fontSize: '0.875rem', color: COLORS.incomeColor }}>
                  {`€${profitData.bestMonth.profit.toLocaleString()}`} profit
                </div>
              </div>
              <div style={{ padding: '1rem', borderRadius: '0.5rem', backgroundColor: `${COLORS.expenseColor}15` }}>
                <h4 style={{ fontWeight: 600, marginBottom: '0.5rem', color: COLORS.expenseColor }}>Lowest Month</h4>
                <div style={{ fontSize: '1.125rem', fontWeight: 'bold', color: COLORS.expenseColor }}>{profitData.worstMonth.month}</div>
                <div style={{ fontSize: '0.875rem', color: COLORS.expenseColor }}>
                  {`€${profitData.worstMonth.profit.toLocaleString()}`} profit
                </div>
              </div>
            </div>
          )}

          <h4 style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Monthly Profit Trend</h4>
          <div style={{ maxHeight: '16rem', overflowY: 'auto' }}>
            {profitData.monthlyProfits.map((month) => (
              <div
                key={month.month}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem',
                  borderRadius: '0.25rem',
                  backgroundColor: COLORS.backgroundGray,
                  marginBottom: '0.25rem'
                }}
              >
                <div style={{ fontWeight: 500, color: COLORS.darkGray }}>{month.month}</div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 'bold', color: month.profit >= 0 ? COLORS.incomeColor : COLORS.expenseColor }}>
                    {`€${month.profit.toLocaleString()}`}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: COLORS.mediumGray }}>{month.margin}% margin</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    };

    const renderWithholdingDetails = () => {
      return (
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: COLORS.expenseColor }}>
            Withholding Tax Breakdown - {selectedYear}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ padding: '1rem', borderRadius: '0.5rem', backgroundColor: `${COLORS.expenseColor}15` }}>
              <div style={{ fontSize: '0.875rem', marginBottom: '0.25rem', color: COLORS.mediumGray }}>GMS Withholding Tax</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: COLORS.expenseColor }}>
                {`€${withholdingTaxData.gmsWithholdingTax.toLocaleString()}`}
              </div>
              <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: COLORS.mediumGray }}>From PCRS payments</div>
            </div>
            <div style={{ padding: '1rem', borderRadius: '0.5rem', backgroundColor: `${COLORS.expenseColor}15` }}>
              <div style={{ fontSize: '0.875rem', marginBottom: '0.25rem', color: COLORS.mediumGray }}>State Contract Tax</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: COLORS.expenseColor }}>
                {`€${withholdingTaxData.stateContractTax.toLocaleString()}`}
              </div>
              <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: COLORS.mediumGray }}>
                {withholdingTaxData.stateContractRate}% of €{withholdingTaxData.stateContractIncome.toLocaleString()}
              </div>
            </div>
          </div>

          <div style={{ padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', backgroundColor: COLORS.backgroundGray, border: `2px solid ${COLORS.expenseColor}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: COLORS.darkGray }}>Total Withholding Tax:</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: COLORS.expenseColor }}>
                {`€${withholdingTaxData.total.toLocaleString()}`}
              </span>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#EFF6FF', borderRadius: '0.5rem', border: '1px solid #BFDBFE' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <Info style={{ height: '1.25rem', width: '1.25rem', color: '#2563EB', flexShrink: 0, marginTop: '0.125rem' }} />
              <div style={{ fontSize: '0.875rem', color: '#1E40AF' }}>
                <p style={{ fontWeight: 500, marginBottom: '0.25rem' }}>About Withholding Tax</p>
                <ul style={{ fontSize: '0.75rem', margin: 0, paddingLeft: '1rem' }}>
                  <li><strong>GMS Withholding:</strong> Tax deducted from GMS payments by PCRS</li>
                  <li><strong>State Contracts:</strong> Income received net of {withholdingTaxData.stateContractRate}% withholding tax</li>
                  <li>This amount reduces your tax liability when filing returns</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: '1rem'
        }}
      >
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            maxWidth: '42rem',
            width: '100%',
            maxHeight: '80vh',
            overflow: 'hidden'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', borderBottom: `1px solid ${COLORS.lightGray}` }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Detailed Breakdown</h2>
            <button
              onClick={onClose}
              style={{ padding: '0.25rem', cursor: 'pointer', border: 'none', background: 'none', color: COLORS.mediumGray }}
            >
              <X style={{ height: '1.25rem', width: '1.25rem' }} />
            </button>
          </div>
          <div style={{ padding: '1.5rem', overflowY: 'auto', maxHeight: 'calc(80vh - 4rem)' }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Key Metrics - Income, Expenses, Profit, Withholding Tax */}
      <div data-tour-id="finance-kpi-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        {/* Income */}
        <div
          onClick={() => setSelectedMetric('income')}
          style={{
            padding: '1rem',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            backgroundColor: COLORS.incomeColor,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'white', opacity: 0.9 }}>Total Income</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', marginTop: '0.25rem' }}>
                {`€${Math.round(summaries.income).toLocaleString()}`}
              </p>
              {summaries.yearComparison && (
                <p style={{ fontSize: '0.75rem', color: 'white', opacity: 0.9, marginTop: '0.25rem' }}>
                  {summaries.yearComparison.incomeChange >= 0 ? '↗' : '↘'} {Math.abs(summaries.yearComparison.incomeChange).toFixed(1)}% vs {summaries.yearComparison.previousYear}
                </p>
              )}
            </div>
            <TrendingUp style={{ height: '2rem', width: '2rem', color: 'white', opacity: 0.8 }} />
          </div>
        </div>

        {/* Expenses */}
        <div
          onClick={() => setSelectedMetric('expenses')}
          style={{
            padding: '1rem',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            backgroundColor: COLORS.expenseColor,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'white', opacity: 0.9 }}>Total Expenses</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', marginTop: '0.25rem' }}>
                {`€${Math.round(summaries.expenses).toLocaleString()}`}
              </p>
              {summaries.yearComparison && (
                <p style={{ fontSize: '0.75rem', color: 'white', opacity: 0.9, marginTop: '0.25rem' }}>
                  {summaries.yearComparison.expenseChange >= 0 ? '↗' : '↘'} {Math.abs(summaries.yearComparison.expenseChange).toFixed(1)}% vs {summaries.yearComparison.previousYear}
                </p>
              )}
            </div>
            <BarChart3 style={{ height: '2rem', width: '2rem', color: 'white', opacity: 0.8 }} />
          </div>
        </div>

        {/* Net Profit */}
        <div
          onClick={() => setSelectedMetric('profit')}
          style={{
            padding: '1rem',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            backgroundColor: COLORS.slainteBlue,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'white', opacity: 0.9 }}>Net Profit</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', marginTop: '0.25rem' }}>
                {`€${profit.toLocaleString()}`}
              </p>
              <p style={{ fontSize: '0.75rem', color: 'white', opacity: 0.9, marginTop: '0.25rem' }}>
                {profitMargin}% profit margin
              </p>
            </div>
            <PieChart style={{ height: '2rem', width: '2rem', color: 'white', opacity: 0.8 }} />
          </div>
        </div>

        {/* Withholding Tax */}
        <div
          onClick={() => setSelectedMetric('withholding')}
          style={{
            padding: '1rem',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            backgroundColor: '#F59E0B',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'white', opacity: 0.9 }}>Withholding Tax</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', marginTop: '0.25rem' }}>
                {`€${withholdingTaxData.total.toLocaleString()}`}
              </p>
              <p style={{ fontSize: '0.75rem', color: 'white', opacity: 0.9, marginTop: '0.25rem' }}>
                Tax credit available
              </p>
            </div>
            <FileText style={{ height: '2rem', width: '2rem', color: 'white', opacity: 0.8 }} />
          </div>
        </div>
      </div>

      {/* Monthly Comparison Chart */}
      {summaries.monthlyTrends && summaries.monthlyTrends.length > 0 && (() => {
        const previousYearSummaries = calculateSummaries(transactions, selectedYear - 1, false);
        const previousYearTrends = previousYearSummaries.monthlyTrends || [];

        const comparisonData = summaries.monthlyTrends.map(currentMonth => {
          const prevMonth = previousYearTrends.find(p => p.monthNumber === currentMonth.monthNumber);
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const shortMonthLabel = monthNames[currentMonth.monthNumber - 1] || currentMonth.month;
          return {
            month: shortMonthLabel,
            currentIncome: currentMonth.income || 0,
            previousIncome: prevMonth?.income || 0,
            currentExpenses: currentMonth.expenses || 0,
            previousExpenses: prevMonth?.expenses || 0,
            currentProfit: (currentMonth.income || 0) - (currentMonth.expenses || 0),
            previousProfit: (prevMonth?.income || 0) - (prevMonth?.expenses || 0)
          };
        });

        const chartConfig = {
          income: {
            title: 'Monthly Income',
            currentKey: 'currentIncome',
            previousKey: 'previousIncome',
            currentColor: COLORS.incomeColor,
            previousColor: '#86EFAC',
            currentLabel: `${selectedYear}`,
            previousLabel: `${selectedYear - 1}`
          },
          expenses: {
            title: 'Monthly Expenses',
            currentKey: 'currentExpenses',
            previousKey: 'previousExpenses',
            currentColor: COLORS.expenseColor,
            previousColor: '#FCA5A5',
            currentLabel: `${selectedYear}`,
            previousLabel: `${selectedYear - 1}`
          },
          profit: {
            title: 'Monthly Profit',
            currentKey: 'currentProfit',
            previousKey: 'previousProfit',
            currentColor: COLORS.slainteBlue,
            previousColor: '#93C5FD',
            currentLabel: `${selectedYear}`,
            previousLabel: `${selectedYear - 1}`
          }
        };

        const config = chartConfig[dashboardChartMode];

        return (
          <div data-tour-id="finance-chart" style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: `1px solid ${COLORS.lightGray}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', color: COLORS.darkGray }}>
                <TrendingUp style={{ height: '1.25rem', width: '1.25rem', marginRight: '0.5rem', color: COLORS.slainteBlue }} />
                {config.title}: {selectedYear} vs {selectedYear - 1}
              </h3>
              {/* Toggle buttons */}
              <div style={{ display: 'flex', borderRadius: '0.5rem', overflow: 'hidden', border: `1px solid ${COLORS.lightGray}` }}>
                <button
                  onClick={() => setDashboardChartMode('income')}
                  style={{
                    padding: '0.375rem 0.75rem',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: dashboardChartMode === 'income' ? COLORS.incomeColor : 'white',
                    color: dashboardChartMode === 'income' ? 'white' : COLORS.mediumGray
                  }}
                >
                  Income
                </button>
                <button
                  onClick={() => setDashboardChartMode('expenses')}
                  style={{
                    padding: '0.375rem 0.75rem',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    border: 'none',
                    borderLeft: `1px solid ${COLORS.lightGray}`,
                    borderRight: `1px solid ${COLORS.lightGray}`,
                    cursor: 'pointer',
                    backgroundColor: dashboardChartMode === 'expenses' ? COLORS.expenseColor : 'white',
                    color: dashboardChartMode === 'expenses' ? 'white' : COLORS.mediumGray
                  }}
                >
                  Expenses
                </button>
                <button
                  onClick={() => setDashboardChartMode('profit')}
                  style={{
                    padding: '0.375rem 0.75rem',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: dashboardChartMode === 'profit' ? COLORS.slainteBlue : 'white',
                    color: dashboardChartMode === 'profit' ? 'white' : COLORS.mediumGray
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
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${COLORS.lightGray}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div>
                      <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray }}>{selectedYear} Total</p>
                      <p style={{ fontSize: '1.125rem', fontWeight: 600, color: config.currentColor }}>
                        {`€${Math.round(currentTotal).toLocaleString()}`}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray }}>{selectedYear - 1} Total</p>
                      <p style={{ fontSize: '1.125rem', fontWeight: 600, color: config.previousColor }}>
                        {`€${Math.round(previousTotal).toLocaleString()}`}
                      </p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray }}>Year-over-Year</p>
                    <p style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem', color: isPositive ? COLORS.incomeColor : COLORS.expenseColor }}>
                      {isPositive ? '↗' : '↘'} {`${Math.abs(change).toFixed(1)}%`}
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* Reports and Transactions Quick Access Boxes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
        {/* Reports Box */}
        <div
          data-tour-id="finance-reports-box"
          onClick={onOpenReports}
          style={{
            padding: '1rem',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            backgroundColor: COLORS.white,
            border: `1px solid ${COLORS.lightGray}`,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.12)';
            e.currentTarget.style.borderColor = COLORS.slainteBlue;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.08)';
            e.currentTarget.style.borderColor = COLORS.lightGray;
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: 500, color: COLORS.mediumGray }}>Generate & View</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: COLORS.darkGray, marginTop: '0.25rem' }}>
                Reports
              </p>
              <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray, marginTop: '0.25rem' }}>
                P&L, Tax Returns, Partner Accounts
              </p>
            </div>
            <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: `${COLORS.slainteBlue}15` }}>
              <Download style={{ height: '1.5rem', width: '1.5rem', color: COLORS.slainteBlue }} />
            </div>
          </div>
        </div>

        {/* Transactions Box */}
        <div
          data-tour-id="finance-transactions-box"
          onClick={onOpenTransactions}
          style={{
            padding: '1rem',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            backgroundColor: COLORS.white,
            border: `1px solid ${COLORS.lightGray}`,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.12)';
            e.currentTarget.style.borderColor = COLORS.slainteBlue;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.08)';
            e.currentTarget.style.borderColor = COLORS.lightGray;
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: 500, color: COLORS.mediumGray }}>Manage & Categorise</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: COLORS.darkGray, marginTop: '0.25rem' }}>
                Transactions
              </p>
              <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray, marginTop: '0.25rem' }}>
                View, edit, and categorise entries
              </p>
            </div>
            <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: `${COLORS.slainteBlue}15` }}>
              <List style={{ height: '1.5rem', width: '1.5rem', color: COLORS.slainteBlue }} />
            </div>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <DetailModal
        metric={selectedMetric}
        onClose={() => setSelectedMetric(null)}
      />
    </div>
  );
};

export default OverviewSection;

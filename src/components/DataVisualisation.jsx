import React from 'react';
import { BarChart3, TrendingUp, Calendar } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import COLORS from '../utils/colors';
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
import { calculateSummaries } from '../utils/financialCalculations';
import { PCRS_PAYMENT_CATEGORIES } from '../data/paymentCategories';

const CHART_COLORS = [COLORS.slainteBlue, COLORS.incomeColor, COLORS.highlightYellow, COLORS.expenseColor, '#8884D8', '#82CA9D', '#FF8042', '#00C49F', '#FFBB28', '#0088FE', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788'];

export default function DataVisualisation() {
  const { transactions, selectedYear, setSelectedYear, getAvailableYears, showSensitiveData, useRollingYear, setUseRollingYear, paymentAnalysisData } = useAppContext();
  const summaries = calculateSummaries(transactions, selectedYear, useRollingYear);

  if (transactions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center mb-6">
          <BarChart3 className="h-6 w-6 mr-2" style={{ color: COLORS.slainteBlue }} />
          <h2 className="text-2xl font-semibold" style={{ color: COLORS.darkGray }}>
            Data Visualisation
          </h2>
        </div>
        <div className="p-8 text-center rounded-lg" style={{ backgroundColor: `${COLORS.highlightYellow}20`, borderLeft: `4px solid ${COLORS.highlightYellow}` }}>
          <p style={{ color: COLORS.darkGray, fontSize: '1.125rem', fontWeight: 500 }}>
            <strong>No data available.</strong> Upload transaction data to see visualisations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Year Selector */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <BarChart3 className="h-6 w-6 mr-2" style={{ color: COLORS.slainteBlue }} />
            <h2 className="text-2xl font-semibold" style={{ color: COLORS.darkGray }}>
              Data Visualisation
            </h2>
          </div>
          <div className="flex items-center space-x-4">
            {/* Toggle Button */}
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
        <p className="text-sm" style={{ color: COLORS.mediumGray }}>
          Visual analysis of your financial data {summaries.periodLabel ? `(${summaries.periodLabel})` : `for ${selectedYear}`}
        </p>
      </div>

      {/* Monthly Income vs Expenses */}
      {summaries.monthlyTrends && summaries.monthlyTrends.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4" style={{ color: COLORS.slainteBlue }}>
            Monthly Income vs Expenses ({selectedYear})
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={summaries.monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => showSensitiveData ? `€${value.toLocaleString()}` : '€***'} />
              <Legend />
              <Line type="monotone" dataKey="income" stroke={COLORS.incomeColor} strokeWidth={2} name="Income" />
              <Line type="monotone" dataKey="expenses" stroke={COLORS.expenseColor} strokeWidth={2} name="Expenses" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income Categories Chart */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4" style={{ color: COLORS.incomeColor }}>
            Income Categories Comparison: {useRollingYear ? 'Last 12 vs Previous 12 Months' : `${selectedYear} vs ${selectedYear - 1}`}
          </h3>
          {summaries.categoryBreakdown.filter(c => c.type === 'income').length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={(() => {
                // Get current period income categories
                const currentPeriodData = summaries.categoryBreakdown
                  .filter(c => c.type === 'income')
                  .sort((a, b) => b.value - a.value)
                  .slice(0, 10);

                // Calculate previous period data
                let previousPeriodSummaries;
                if (useRollingYear) {
                  // For rolling: get data from 12-24 months ago
                  const today = new Date();
                  const twelveMonthsAgo = new Date(today);
                  twelveMonthsAgo.setMonth(today.getMonth() - 12);
                  const twentyFourMonthsAgo = new Date(today);
                  twentyFourMonthsAgo.setMonth(today.getMonth() - 24);

                  const prevPeriodTransactions = transactions.filter(t => {
                    if (!t.date) return false;
                    const transactionDate = new Date(t.date);
                    return transactionDate >= twentyFourMonthsAgo && transactionDate < twelveMonthsAgo;
                  });

                  previousPeriodSummaries = calculateSummaries(prevPeriodTransactions, selectedYear, false, true);
                } else {
                  previousPeriodSummaries = calculateSummaries(transactions, selectedYear - 1, false);
                }

                const currentLabel = useRollingYear ? 'Last 12 Months' : selectedYear.toString();
                const previousLabel = useRollingYear ? 'Previous 12 Months' : (selectedYear - 1).toString();

                // Combine both periods data
                return currentPeriodData.map(currentCategory => {
                  const prevCategory = previousPeriodSummaries.categoryBreakdown.find(
                    c => c.name === currentCategory.name && c.type === 'income'
                  );

                  return {
                    name: currentCategory.name,
                    [currentLabel]: currentCategory.value,
                    [previousLabel]: prevCategory ? prevCategory.value : 0
                  };
                });
              })()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={120}
                  interval={0}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value) => value.substring(0, 20)}
                />
                <YAxis />
                <Tooltip
                  formatter={(value, name) => [
                    showSensitiveData ? `€${value.toLocaleString()}` : '€***',
                    name
                  ]}
                />
                <Legend />
                <Bar
                  dataKey={useRollingYear ? 'Previous 12 Months' : (selectedYear - 1).toString()}
                  fill={COLORS.slainteBlue}
                  name={useRollingYear ? 'Previous 12 Months' : (selectedYear - 1).toString()}
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  dataKey={useRollingYear ? 'Last 12 Months' : selectedYear.toString()}
                  fill={COLORS.incomeColor}
                  name={useRollingYear ? 'Last 12 Months' : selectedYear.toString()}
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-300 flex items-center justify-center" style={{ color: COLORS.mediumGray }}>
              No income data available
            </div>
          )}
        </div>

        {/* Expense Sections Chart */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4" style={{ color: COLORS.expenseColor }}>
            Expense Sections Comparison: {useRollingYear ? 'Last 12 vs Previous 12 Months' : `${selectedYear} vs ${selectedYear - 1}`}
          </h3>
          {summaries.categoryBreakdown.filter(c => c.type === 'expense').length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={(() => {
                // Group current period expenses by section
                const currentPeriodSections = {};
                summaries.categoryBreakdown
                  .filter(c => c.type === 'expense')
                  .forEach(category => {
                    const section = category.section || 'Other Expenses';
                    if (!currentPeriodSections[section]) {
                      currentPeriodSections[section] = 0;
                    }
                    currentPeriodSections[section] += category.value;
                  });

                // Calculate previous period data
                let previousPeriodSummaries;
                if (useRollingYear) {
                  // For rolling: get data from 12-24 months ago
                  const today = new Date();
                  const twelveMonthsAgo = new Date(today);
                  twelveMonthsAgo.setMonth(today.getMonth() - 12);
                  const twentyFourMonthsAgo = new Date(today);
                  twentyFourMonthsAgo.setMonth(today.getMonth() - 24);

                  const prevPeriodTransactions = transactions.filter(t => {
                    if (!t.date) return false;
                    const transactionDate = new Date(t.date);
                    return transactionDate >= twentyFourMonthsAgo && transactionDate < twelveMonthsAgo;
                  });

                  previousPeriodSummaries = calculateSummaries(prevPeriodTransactions, selectedYear, false, true);
                } else {
                  previousPeriodSummaries = calculateSummaries(transactions, selectedYear - 1, false);
                }

                const previousPeriodSections = {};
                previousPeriodSummaries.categoryBreakdown
                  .filter(c => c.type === 'expense')
                  .forEach(category => {
                    const section = category.section || 'Other Expenses';
                    if (!previousPeriodSections[section]) {
                      previousPeriodSections[section] = 0;
                    }
                    previousPeriodSections[section] += category.value;
                  });

                // Combine both periods data
                const allSections = new Set([
                  ...Object.keys(currentPeriodSections),
                  ...Object.keys(previousPeriodSections)
                ]);

                const currentLabel = useRollingYear ? 'Last 12 Months' : selectedYear.toString();
                const previousLabel = useRollingYear ? 'Previous 12 Months' : (selectedYear - 1).toString();

                return Array.from(allSections)
                  .map(section => ({
                    name: section,
                    [currentLabel]: currentPeriodSections[section] || 0,
                    [previousLabel]: previousPeriodSections[section] || 0
                  }))
                  .sort((a, b) => b[currentLabel] - a[currentLabel]);
              })()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={120}
                  interval={0}
                  tick={{ fontSize: 10 }}
                />
                <YAxis />
                <Tooltip
                  formatter={(value, name) => [
                    showSensitiveData ? `€${value.toLocaleString()}` : '€***',
                    name
                  ]}
                />
                <Legend />
                <Bar
                  dataKey={useRollingYear ? 'Previous 12 Months' : (selectedYear - 1).toString()}
                  fill={COLORS.slainteBlue}
                  name={useRollingYear ? 'Previous 12 Months' : (selectedYear - 1).toString()}
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  dataKey={useRollingYear ? 'Last 12 Months' : selectedYear.toString()}
                  fill={COLORS.expenseColor}
                  name={useRollingYear ? 'Last 12 Months' : selectedYear.toString()}
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-300 flex items-center justify-center" style={{ color: COLORS.mediumGray }}>
              No expense data available
            </div>
          )}
        </div>
      </div>

      {/* Salaries Breakdown */}
      {summaries.salariesBreakdown && summaries.salariesBreakdown.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4" style={{ color: COLORS.slainteBlue }}>
            Salaries Breakdown ({selectedYear})
          </h3>

          <div className="mb-6">
            <h4 className="text-md font-medium mb-3" style={{ color: COLORS.darkGray }}>
              Salary Distribution
            </h4>
            <ResponsiveContainer width="100%" height={400}>
              <RechartsPieChart>
                <Pie
                  dataKey="value"
                  data={summaries.salariesBreakdown}
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  label={({ name, value, percent }) =>
                    showSensitiveData
                      ? `${name.replace(/^\d{2}-/, '')}: €${value.toLocaleString()} (${(percent * 100).toFixed(1)}%)`
                      : `${name.replace(/^\d{2}-/, '')}: ${(percent * 100).toFixed(1)}%`
                  }
                >
                  {summaries.salariesBreakdown.map((entry, index) => (
                    <Cell key={`salary-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => showSensitiveData ? `€${value.toLocaleString()}` : '€***'}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>

          {/* Year-over-Year Comparison Table */}
          <div className="mt-6">
            <h4 className="text-md font-medium mb-3" style={{ color: COLORS.darkGray }}>
              Salary Costs Comparison: {selectedYear} vs {summaries.previousYear || 'Previous Year'}
            </h4>
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto border" style={{ borderColor: COLORS.lightGray }}>
                <thead>
                  <tr style={{ backgroundColor: `${COLORS.slainteBlue}15` }}>
                    <th className="px-4 py-3 text-left border-b font-medium" style={{ borderColor: COLORS.lightGray, color: COLORS.slainteBlue }}>
                      Salary Category
                    </th>
                    <th className="px-4 py-3 text-right border-b font-medium" style={{ borderColor: COLORS.lightGray, color: COLORS.slainteBlue }}>
                      {summaries.previousYear || 'Previous Year'}
                    </th>
                    <th className="px-4 py-3 text-right border-b font-medium" style={{ borderColor: COLORS.lightGray, color: COLORS.slainteBlue }}>
                      {selectedYear}
                    </th>
                    <th className="px-4 py-3 text-right border-b font-medium" style={{ borderColor: COLORS.lightGray, color: COLORS.slainteBlue }}>
                      Change
                    </th>
                    <th className="px-4 py-3 text-center border-b font-medium" style={{ borderColor: COLORS.lightGray, color: COLORS.slainteBlue }}>
                      % Change
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.salariesBreakdown
                    .sort((a, b) => (b.value || 0) - (a.value || 0))
                    .map((category, index) => {
                      const currentYear = category.value || 0;

                      // Calculate previous year data
                      let prevYear = 0;
                      if (summaries.previousYear) {
                        const prevYearTransactions = transactions.filter(t => {
                          if (!t.date || !t.category) return false;
                          const transactionYear = new Date(t.date).getFullYear();
                          const categoryCode = t.category.name.substring(0, 2);
                          const isSalaryCategory = ['10', '11', '12', '13', '14', '15', '16', '17', '18', '19'].includes(categoryCode);
                          return transactionYear === summaries.previousYear &&
                            t.category.name === category.name &&
                            isSalaryCategory;
                        });
                        prevYear = prevYearTransactions.reduce((sum, t) => sum + (t.debit || t.amount || 0), 0);
                      }

                      const change = currentYear - prevYear;
                      const percentChange = prevYear > 0 ? ((change / prevYear) * 100) : (currentYear > 0 && prevYear === 0 ? 100 : 0);

                      return (
                        <tr key={category.name} style={{ backgroundColor: index % 2 === 0 ? COLORS.backgroundGray : COLORS.white }}>
                          <td className="px-4 py-3 border-b font-medium" style={{ borderColor: COLORS.lightGray, color: COLORS.darkGray }}>
                            {category.name.replace(/^\d{2}-/, '')}
                          </td>
                          <td className="px-4 py-3 border-b text-right font-mono" style={{ borderColor: COLORS.lightGray, color: COLORS.darkGray }}>
                            {prevYear > 0 ?
                              (showSensitiveData ? `€${prevYear.toLocaleString()}` : '€***') :
                              <span style={{ color: COLORS.mediumGray }}>€0</span>
                            }
                          </td>
                          <td className="px-4 py-3 border-b text-right font-mono font-semibold" style={{ borderColor: COLORS.lightGray, color: COLORS.darkGray }}>
                            {showSensitiveData ? `€${currentYear.toLocaleString()}` : '€***'}
                          </td>
                          <td className="px-4 py-3 border-b text-right font-mono font-semibold" style={{ borderColor: COLORS.lightGray, color: change > 0 ? COLORS.expenseColor : change < 0 ? COLORS.incomeColor : COLORS.darkGray }}>
                            {prevYear > 0 ? (
                              showSensitiveData
                                ? `${change >= 0 ? '+' : ''}€${change.toLocaleString()}`
                                : (change === 0 ? '€0' : (change > 0 ? '+€***' : '-€***'))
                            ) : (
                              <span style={{ color: COLORS.mediumGray }}>N/A</span>
                            )}
                          </td>
                          <td className="px-4 py-3 border-b text-center font-semibold" style={{ borderColor: COLORS.lightGray, color: percentChange > 0 ? COLORS.expenseColor : percentChange < 0 ? COLORS.incomeColor : COLORS.darkGray }}>
                            {prevYear > 0 ? (
                              <>
                                {percentChange === 0 ? '0%' : `${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(1)}%`}
                                {percentChange > 0 && <span className="ml-1">↗</span>}
                                {percentChange < 0 && <span className="ml-1">↘</span>}
                              </>
                            ) : (
                              <span style={{ color: COLORS.mediumGray }}>N/A</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PCRS Payment Breakdown */}
      {paymentAnalysisData && paymentAnalysisData.length > 0 && (() => {
        // Calculate PCRS payment breakdown for selected year
        const pcrsBreakdown = {};

        // Initialize all categories
        PCRS_PAYMENT_CATEGORIES.forEach(category => {
          pcrsBreakdown[category] = 0;
        });

        // Sum up payments from all months in selected year
        paymentAnalysisData
          .filter(data => data.year === selectedYear.toString())
          .forEach(data => {
            PCRS_PAYMENT_CATEGORIES.forEach(category => {
              const amount = data.payments[category] || 0;
              pcrsBreakdown[category] += amount;
            });
          });

        // Convert to array and filter out zero values
        const chartData = Object.entries(pcrsBreakdown)
          .filter(([category, value]) => value > 0)
          .map(([category, value]) => ({
            name: category,
            value: value
          }))
          .sort((a, b) => b.value - a.value);

        // Calculate total for percentage display
        const totalPayment = chartData.reduce((sum, item) => sum + item.value, 0);

        if (chartData.length === 0) return null;

        return (
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4" style={{ color: COLORS.slainteBlue }}>
              PCRS Payment Breakdown ({selectedYear})
            </h3>
            <p className="text-sm mb-4" style={{ color: COLORS.mediumGray }}>
              Distribution of Total Gross Payment across payment categories from GMS Panel Analysis
            </p>

            <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: `${COLORS.incomeColor}15` }}>
              <div className="text-2xl font-bold" style={{ color: COLORS.incomeColor }}>
                {showSensitiveData ? `€${totalPayment.toLocaleString()}` : '€***,***'}
              </div>
              <div className="text-sm" style={{ color: COLORS.incomeColor }}>Total Gross Payment</div>
            </div>

            <ResponsiveContainer width="100%" height={500}>
              <RechartsPieChart>
                <Pie
                  dataKey="value"
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={150}
                  label={({ name, value, percent }) => {
                    // Shorten category names for display
                    const shortName = name.length > 25 ? name.substring(0, 22) + '...' : name;
                    return showSensitiveData
                      ? `${shortName}: €${value.toLocaleString()} (${(percent * 100).toFixed(1)}%)`
                      : `${shortName}: ${(percent * 100).toFixed(1)}%`;
                  }}
                  labelLine={{ stroke: COLORS.mediumGray, strokeWidth: 1 }}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`pcrs-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => showSensitiveData ? `€${value.toLocaleString()}` : '€***'}
                />
              </RechartsPieChart>
            </ResponsiveContainer>

            {/* Category Legend Table */}
            <div className="mt-6">
              <h4 className="text-md font-medium mb-3" style={{ color: COLORS.darkGray }}>
                Payment Category Details
              </h4>
              <div className="overflow-x-auto">
                <table className="min-w-full table-auto border" style={{ borderColor: COLORS.lightGray }}>
                  <thead>
                    <tr style={{ backgroundColor: `${COLORS.slainteBlue}15` }}>
                      <th className="px-4 py-3 text-left border-b font-medium" style={{ borderColor: COLORS.lightGray, color: COLORS.slainteBlue }}>
                        Category
                      </th>
                      <th className="px-4 py-3 text-right border-b font-medium" style={{ borderColor: COLORS.lightGray, color: COLORS.slainteBlue }}>
                        Amount
                      </th>
                      <th className="px-4 py-3 text-center border-b font-medium" style={{ borderColor: COLORS.lightGray, color: COLORS.slainteBlue }}>
                        % of Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.map((item, index) => {
                      const percentage = ((item.value / totalPayment) * 100).toFixed(1);
                      return (
                        <tr key={item.name} style={{ backgroundColor: index % 2 === 0 ? COLORS.backgroundGray : COLORS.white }}>
                          <td className="px-4 py-3 border-b font-medium" style={{ borderColor: COLORS.lightGray, color: COLORS.darkGray }}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-4 h-4 rounded"
                                style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                              ></div>
                              {item.name}
                            </div>
                          </td>
                          <td className="px-4 py-3 border-b text-right font-mono font-semibold" style={{ borderColor: COLORS.lightGray, color: COLORS.darkGray }}>
                            {showSensitiveData ? `€${item.value.toLocaleString()}` : '€***'}
                          </td>
                          <td className="px-4 py-3 border-b text-center font-semibold" style={{ borderColor: COLORS.lightGray, color: COLORS.darkGray }}>
                            {percentage}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: `${COLORS.incomeColor}15` }}>
                      <td className="px-4 py-3 border-t font-bold" style={{ borderColor: COLORS.lightGray, color: COLORS.darkGray }}>
                        TOTAL
                      </td>
                      <td className="px-4 py-3 border-t text-right font-mono font-bold" style={{ borderColor: COLORS.lightGray, color: COLORS.incomeColor }}>
                        {showSensitiveData ? `€${totalPayment.toLocaleString()}` : '€***'}
                      </td>
                      <td className="px-4 py-3 border-t text-center font-bold" style={{ borderColor: COLORS.lightGray, color: COLORS.darkGray }}>
                        100%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

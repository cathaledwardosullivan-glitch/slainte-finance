import React, { useMemo, useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, BarChart3, Stethoscope, CalendarRange, ArrowRight, Sparkles } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { calculateSummaries } from '../../utils/financialCalculations';
import { SUGGESTED_ANALYSES } from '../../data/suggestedAnalyses';
import { useInsightNarratives } from '../../hooks/useInsightNarratives';
import {
  LineChart, Line, BarChart, Bar,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import COLORS from '../../utils/colors';

/**
 * Format currency for display.
 */
const fmt = (value) => `€${Math.round(value).toLocaleString()}`;

/**
 * Format percentage with sign.
 */
const fmtPct = (value) => {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

/**
 * InsightDashboard - Computed insight cards with mini charts.
 * No AI calls — uses existing financial calculations.
 */
const InsightDashboard = ({ onPreviewAnalysis }) => {
  const {
    transactions,
    paymentAnalysisData,
    selectedYear,
    useRollingYear
  } = useAppContext();

  // Calculate current and previous period summaries
  const { current, previous, insights } = useMemo(() => {
    const cur = calculateSummaries(transactions, selectedYear, useRollingYear);
    const prev = calculateSummaries(transactions, selectedYear - 1, false);

    const curProfit = cur.income - cur.expenses;
    const prevProfit = prev.income - prev.expenses;
    const profitChange = prevProfit > 0 ? ((curProfit - prevProfit) / prevProfit * 100) : 0;
    const profitMargin = cur.income > 0 ? (curProfit / cur.income * 100) : 0;

    // Top expense categories
    const topExpenses = cur.categoryBreakdown
      .filter(c => c.type === 'expense')
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);

    // Monthly profit data for sparkline
    const monthlyProfits = (cur.monthlyTrends || []).map(m => ({
      month: m.month?.substring(0, 3) || '',
      profit: (m.income || 0) - (m.expenses || 0),
      income: m.income || 0,
      expenses: m.expenses || 0
    }));

    // Best and worst months
    const sortedByIncome = [...monthlyProfits].filter(m => m.income > 0).sort((a, b) => b.income - a.income);
    const bestMonth = sortedByIncome[0];
    const worstMonth = sortedByIncome[sortedByIncome.length - 1];

    // Income variability (coefficient of variation)
    const incomeValues = monthlyProfits.filter(m => m.income > 0).map(m => m.income);
    const avgIncome = incomeValues.length > 0 ? incomeValues.reduce((s, v) => s + v, 0) / incomeValues.length : 0;

    // GMS income from payment analysis data
    let totalPCRS = 0;
    if (paymentAnalysisData && paymentAnalysisData.length > 0) {
      paymentAnalysisData.forEach(panel => {
        totalPCRS += panel.totalGrossPayment
          || panel.practiceSummary?.totalGrossPayment
          || panel.yearlyTotal
          || 0;
      });
    }

    return {
      current: cur,
      previous: prev,
      insights: {
        profit: curProfit,
        profitChange,
        profitMargin,
        topExpenses,
        monthlyProfits,
        bestMonth,
        worstMonth,
        avgIncome,
        totalPCRS,
        hasGMSData: paymentAnalysisData && paymentAnalysisData.length > 0,
        hasData: transactions && transactions.length > 0
      }
    };
  }, [transactions, selectedYear, useRollingYear, paymentAnalysisData]);

  // Build metrics for AI narrative generation
  const narrativeMetrics = useMemo(() => {
    if (!insights.hasData) return null;
    return {
      profit: insights.profit,
      profitMargin: insights.profitMargin,
      profitChange: previous.income > 0 ? insights.profitChange : null,
      topExpenses: insights.topExpenses.map(e => ({
        name: e.name,
        value: e.value,
        percent: current.expenses > 0 ? Math.round(e.value / current.expenses * 100) : 0
      })),
      gmsTotal: insights.totalPCRS,
      gmsHasData: insights.hasGMSData,
      bestMonth: insights.bestMonth?.month || null,
      worstMonth: insights.worstMonth?.month || null,
      incomeGap: insights.bestMonth && insights.worstMonth
        ? insights.bestMonth.income - insights.worstMonth.income : 0,
      avgIncome: insights.avgIncome,
      monthlyProfits: insights.monthlyProfits,
      totalIncome: current.income,
      totalExpenses: current.expenses,
      txCount: transactions?.length || 0,
      year: selectedYear,
      rolling: useRollingYear
    };
  }, [insights, current, previous, transactions, selectedYear, useRollingYear]);

  const { narratives, isLoading: narrativesLoading } = useInsightNarratives(narrativeMetrics);

  const handleDeepDive = (linkedAnalysisId) => {
    if (!onPreviewAnalysis || !linkedAnalysisId) return;
    const analysis = SUGGESTED_ANALYSES.find(a => a.id === linkedAnalysisId);
    if (analysis) onPreviewAnalysis(analysis);
  };

  // Crossfade rotation state — staggered across cards
  const [rotationTick, setRotationTick] = useState(0);
  const [fadeStates, setFadeStates] = useState([true, true, true, true]); // true = visible

  useEffect(() => {
    const interval = setInterval(() => {
      setRotationTick(prev => prev + 1);
    }, 7500); // Tick every 7.5s — each card changes every 30s (4 cards × 7.5s)
    return () => clearInterval(interval);
  }, []);

  // Determine which card should transition on this tick
  const activeCardIndex = rotationTick % 4;
  const narrativeIndices = useRef([0, 0, 0, 0]);

  useEffect(() => {
    if (rotationTick === 0) return; // Skip initial

    // Fade out the active card
    setFadeStates(prev => {
      const next = [...prev];
      next[activeCardIndex] = false;
      return next;
    });

    // After fade out, update index and fade back in
    const timer = setTimeout(() => {
      narrativeIndices.current[activeCardIndex] = (narrativeIndices.current[activeCardIndex] + 1) % 3;
      setFadeStates(prev => {
        const next = [...prev];
        next[activeCardIndex] = true;
        return next;
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [rotationTick, activeCardIndex]);

  if (!insights.hasData) return null;

  const cards = [
    // Card 1: Profit Trend
    {
      id: 'profit',
      title: 'Profit Trend',
      relatableQuestion: 'How much profit am I actually making?',
      icon: insights.profitChange >= 0 ? TrendingUp : TrendingDown,
      accentColor: insights.profitChange >= 0 ? COLORS.incomeColor : COLORS.expenseColor,
      metric: fmt(insights.profit),
      subtitle: insights.profitMargin > 0 ? `${insights.profitMargin.toFixed(1)}% margin` : null,
      change: previous.income > 0 ? {
        value: insights.profitChange,
        label: `vs ${selectedYear - 1}`
      } : null,
      chart: insights.monthlyProfits.length > 1 ? (
        <ResponsiveContainer width="100%" height={48}>
          <LineChart data={insights.monthlyProfits}>
            <Line
              type="monotone"
              dataKey="profit"
              stroke={insights.profitChange >= 0 ? COLORS.incomeColor : COLORS.expenseColor}
              strokeWidth={2}
              dot={false}
            />
            <Tooltip
              formatter={(value) => [fmt(value), 'Profit']}
              labelFormatter={() => ''}
              contentStyle={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : null,
      linkedAnalysisId: 'five-year-outlook'
    },

    // Card 2: Top Expenses
    {
      id: 'expenses',
      title: 'Top Expenses',
      relatableQuestion: "What's costing me the most to run?",
      icon: BarChart3,
      accentColor: COLORS.expenseColor,
      metric: insights.topExpenses[0] ? insights.topExpenses[0].name : 'N/A',
      subtitle: insights.topExpenses[0] && current.expenses > 0
        ? `${fmt(insights.topExpenses[0].value)} (${(insights.topExpenses[0].value / current.expenses * 100).toFixed(0)}% of total)`
        : null,
      change: null,
      chart: insights.topExpenses.length > 0 ? (
        <ResponsiveContainer width="100%" height={48}>
          <BarChart data={insights.topExpenses.map(e => ({
            name: e.name.length > 12 ? e.name.substring(0, 12) + '...' : e.name,
            value: e.value
          }))} layout="vertical" barSize={10}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" hide />
            <Bar dataKey="value" fill={COLORS.expenseColor} radius={[0, 4, 4, 0]} />
            <Tooltip
              formatter={(value) => [fmt(value)]}
              contentStyle={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : null,
      linkedAnalysisId: 'expense-anomalies'
    },

    // Card 3: GMS Income
    {
      id: 'gms',
      title: 'GMS Income',
      relatableQuestion: 'Am I getting all my PCRS entitlements?',
      icon: Stethoscope,
      accentColor: COLORS.chartPink,
      metric: insights.hasGMSData ? fmt(insights.totalPCRS) : 'No Data',
      subtitle: insights.hasGMSData
        ? 'Total PCRS payments'
        : 'Upload GMS statements to unlock',
      change: null,
      chart: null,
      linkedAnalysisId: insights.hasGMSData ? 'unclaimed-gms' : null,
      disabled: !insights.hasGMSData
    },

    // Card 4: Cash Flow Rhythm
    {
      id: 'cashflow',
      title: 'Cash Flow Rhythm',
      relatableQuestion: 'Which months do I need to watch?',
      icon: CalendarRange,
      accentColor: COLORS.slainteBlue,
      metric: insights.bestMonth ? `${insights.bestMonth.month} strongest` : 'N/A',
      subtitle: insights.bestMonth && insights.worstMonth && insights.bestMonth.month !== insights.worstMonth.month
        ? `${insights.worstMonth.month} weakest (${fmt(insights.bestMonth.income - insights.worstMonth.income)} gap)`
        : insights.avgIncome > 0 ? `Avg ${fmt(insights.avgIncome)}/month` : null,
      change: null,
      chart: insights.monthlyProfits.length > 1 ? (
        <ResponsiveContainer width="100%" height={48}>
          <BarChart data={insights.monthlyProfits}>
            <Bar dataKey="income" fill={`${COLORS.slainteBlue}60`} radius={[2, 2, 0, 0]} />
            <Tooltip
              formatter={(value) => [fmt(value), 'Income']}
              labelFormatter={(label) => ''}
              contentStyle={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : null,
      linkedAnalysisId: 'seasonal-cashflow'
    }
  ];

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1rem'
        }}
      >
        {cards.map((card, cardIndex) => {
          const Icon = card.icon;
          const isDisabled = card.disabled;
          const narrativeArr = narratives?.[card.id];
          const currentNarrative = Array.isArray(narrativeArr)
            ? narrativeArr[narrativeIndices.current[cardIndex] % narrativeArr.length]
            : narrativeArr; // fallback for old cached single-string format
          const isFadedIn = fadeStates[cardIndex];

          return (
            <div
              key={card.id}
              style={{
                backgroundColor: COLORS.white,
                borderRadius: '0.75rem',
                padding: '1.25rem',
                border: `1px solid ${COLORS.borderLight}`,
                borderTop: `3px solid ${card.accentColor}`,
                opacity: isDisabled ? 0.6 : 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                transition: 'box-shadow 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!isDisabled) e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div
                    style={{
                      width: '1.75rem',
                      height: '1.75rem',
                      backgroundColor: `${card.accentColor}12`,
                      borderRadius: '0.375rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Icon style={{ height: '0.875rem', width: '0.875rem', color: card.accentColor }} />
                  </div>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: COLORS.textSecondary }}>
                    {card.title}
                  </span>
                </div>
                {card.change && (
                  <span style={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    color: card.change.value >= 0 ? COLORS.incomeColor : COLORS.expenseColor,
                    backgroundColor: card.change.value >= 0 ? `${COLORS.incomeColor}12` : `${COLORS.expenseColor}12`,
                    padding: '0.125rem 0.375rem',
                    borderRadius: '0.25rem'
                  }}>
                    {fmtPct(card.change.value)} {card.change.label}
                  </span>
                )}
              </div>

              {/* Relatable Question */}
              {card.relatableQuestion && (
                <div style={{
                  fontSize: '0.75rem',
                  color: COLORS.textSecondary,
                  fontStyle: 'italic',
                  lineHeight: 1.3,
                  marginTop: '-0.25rem'
                }}>
                  "{card.relatableQuestion}"
                </div>
              )}

              {/* Metric */}
              <div>
                <div style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: COLORS.textPrimary,
                  lineHeight: 1.2
                }}>
                  {card.metric}
                </div>
                {currentNarrative ? (
                  <div style={{
                    fontSize: '0.75rem',
                    color: COLORS.textPrimary,
                    marginTop: '0.25rem',
                    fontStyle: 'italic',
                    lineHeight: 1.4,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.25rem',
                    opacity: isFadedIn ? 1 : 0,
                    transform: isFadedIn ? 'translateY(0)' : 'translateY(4px)',
                    transition: 'opacity 0.5s ease, transform 0.5s ease'
                  }}>
                    <Sparkles style={{
                      height: '0.625rem',
                      width: '0.625rem',
                      color: COLORS.highlightYellow,
                      flexShrink: 0,
                      marginTop: '0.125rem'
                    }} />
                    {currentNarrative}
                  </div>
                ) : card.subtitle ? (
                  <div style={{
                    fontSize: '0.75rem',
                    color: COLORS.textSecondary,
                    marginTop: '0.25rem'
                  }}>
                    {card.subtitle}
                  </div>
                ) : null}
              </div>

              {/* Mini Chart */}
              {card.chart && (
                <div style={{ margin: '0 -0.25rem' }}>
                  {card.chart}
                </div>
              )}

              {/* Deep Dive */}
              {card.linkedAnalysisId && !isDisabled && (
                <button
                  onClick={() => handleDeepDive(card.linkedAnalysisId)}
                  style={{
                    marginTop: 'auto',
                    padding: '0.375rem 0',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: COLORS.slainteBlue,
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                  onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                >
                  Deep Dive <ArrowRight style={{ height: '0.75rem', width: '0.75rem' }} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default InsightDashboard;

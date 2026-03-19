import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useFinn } from '../../context/FinnContext';
import { useAppContext } from '../../context/AppContext';
import { ANALYSIS_CATEGORIES, SUGGESTED_ANALYSES } from '../../data/suggestedAnalyses';
import { classifyCustomReport } from '../../utils/reportCategorizer';
import { calculateSummaries } from '../../utils/financialCalculations';
import { useInsightNarratives } from '../../hooks/useInsightNarratives';
import {
  LineChart, Line, BarChart, Bar,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import CategoryBanner from './CategoryBanner';
import CategoryModal from './CategoryModal';
import CustomReportsBanner from './CustomReportsRow';
import ReportReader from '../AdvancedInsights/ReportReader';
import AnalysisPreviewModal from '../AdvancedInsights/AnalysisPreviewModal';
import COLORS from '../../utils/colors';

const fmt = (value) => `€${Math.round(value).toLocaleString()}`;

/**
 * AdvancedInsightsV2 — Category-driven layout with rich banner rows.
 * Each category gets a two-zone banner (insight panel + report list);
 * "Explore" opens a modal with generated reports and suggested analyses.
 */
const AdvancedInsightsV2 = ({ setCurrentView }) => {
  const { savedReports, deleteReport } = useFinn();
  const {
    transactions,
    paymentAnalysisData,
    selectedYear,
    useRollingYear
  } = useAppContext();

  const [selectedReport, setSelectedReport] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [previewAnalysis, setPreviewAnalysis] = useState(null);

  // Listen for deep-link events from Finn's navigate tool
  useEffect(() => {
    const handleOpenCategory = (e) => {
      const { categoryId } = e.detail || {};
      if (categoryId) {
        const cat = ANALYSIS_CATEGORIES.find(c => c.id === categoryId);
        if (cat) setActiveCategory(cat);
      }
    };
    const handleOpenReport = (e) => {
      const { reportId } = e.detail || {};
      if (reportId) {
        const report = savedReports.find(r => r.id === reportId);
        if (report) setSelectedReport(report);
      }
    };
    window.addEventListener('advanced-insights:openCategory', handleOpenCategory);
    window.addEventListener('advanced-insights:openReport', handleOpenReport);
    return () => {
      window.removeEventListener('advanced-insights:openCategory', handleOpenCategory);
      window.removeEventListener('advanced-insights:openReport', handleOpenReport);
    };
  }, [savedReports]);

  // ─── Report grouping ────────────────────────────────────────────────

  const finnReports = useMemo(() =>
    savedReports.filter(r => r.type === 'AI Report' || r.metadata?.generatedBy === 'Finn AI'),
    [savedReports]
  );

  const analysesByCategory = useMemo(() => {
    const map = new Map();
    for (const cat of ANALYSIS_CATEGORIES) {
      map.set(cat.id, SUGGESTED_ANALYSES.filter(a => a.categoryId === cat.id));
    }
    return map;
  }, []);

  const reportsByCategory = useMemo(() => {
    const map = new Map();
    for (const cat of ANALYSIS_CATEGORIES) {
      map.set(cat.id, []);
    }
    map.set('custom', []);

    for (const report of finnReports) {
      if (report.suggestedAnalysisId) {
        const analysis = SUGGESTED_ANALYSES.find(a => a.id === report.suggestedAnalysisId);
        if (analysis) {
          map.get(analysis.categoryId).push(report);
          continue;
        }
      }
      const cat = classifyCustomReport(report);
      map.get(cat).push(report);
    }
    return map;
  }, [finnReports]);

  const generatedAnalysisIds = useMemo(() => {
    const ids = new Set();
    for (const report of finnReports) {
      if (report.suggestedAnalysisId) ids.add(report.suggestedAnalysisId);
    }
    return ids;
  }, [finnReports]);

  // ─── Metrics computation (ported from InsightDashboard) ─────────────

  const { current, previous, insights } = useMemo(() => {
    const cur = calculateSummaries(transactions, selectedYear, useRollingYear);
    const prev = calculateSummaries(transactions, selectedYear - 1, false);

    const curProfit = cur.income - cur.expenses;
    const prevProfit = prev.income - prev.expenses;
    const profitChange = prevProfit > 0 ? ((curProfit - prevProfit) / prevProfit * 100) : 0;
    const profitMargin = cur.income > 0 ? (curProfit / cur.income * 100) : 0;

    const topExpenses = cur.categoryBreakdown
      .filter(c => c.type === 'expense')
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);

    const monthlyProfits = (cur.monthlyTrends || []).map(m => ({
      month: m.month?.substring(0, 3) || '',
      profit: (m.income || 0) - (m.expenses || 0),
      income: m.income || 0,
      expenses: m.expenses || 0
    }));

    const sortedByIncome = [...monthlyProfits].filter(m => m.income > 0).sort((a, b) => b.income - a.income);
    const bestMonth = sortedByIncome[0];
    const worstMonth = sortedByIncome[sortedByIncome.length - 1];

    const incomeValues = monthlyProfits.filter(m => m.income > 0).map(m => m.income);
    const avgIncome = incomeValues.length > 0 ? incomeValues.reduce((s, v) => s + v, 0) / incomeValues.length : 0;

    let totalPCRS = 0;
    if (paymentAnalysisData && paymentAnalysisData.length > 0) {
      paymentAnalysisData.forEach(panel => {
        // Primary: totalGrossPayment (current data format)
        // Fallbacks: practiceSummary.totalGrossPayment, yearlyTotal (legacy)
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

  // ─── AI Narratives ──────────────────────────────────────────────────

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

  const { narratives } = useInsightNarratives(narrativeMetrics);

  // Map narrative keys to category IDs
  const NARRATIVE_KEY_MAP = {
    overview: 'profit',
    gms: 'gms',
    tax: null,       // static subtitle only
    costs: 'expenses',
    growth: 'cashflow'
  };

  // ─── Crossfade rotation (5 banners) ─────────────────────────────────

  const [rotationTick, setRotationTick] = useState(0);
  const [fadeStates, setFadeStates] = useState([true, true, true, true, true]);
  const narrativeIndices = useRef([0, 0, 0, 0, 0]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRotationTick(prev => prev + 1);
    }, 7500);
    return () => clearInterval(interval);
  }, []);

  const activeCardIndex = rotationTick % 5;

  useEffect(() => {
    if (rotationTick === 0) return;

    setFadeStates(prev => {
      const next = [...prev];
      next[activeCardIndex] = false;
      return next;
    });

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

  // ─── Per-category banner config ─────────────────────────────────────

  const bannerConfigs = useMemo(() => {
    if (!insights.hasData) return {};

    return {
      overview: {
        metric: fmt(insights.profit),
        subtitle: insights.profitMargin > 0 ? `${insights.profitMargin.toFixed(1)}% margin` : null,
        change: previous.income > 0 ? { value: insights.profitChange, label: `vs ${selectedYear - 1}` } : null,
        chart: insights.monthlyProfits.length > 1 ? (
          <ResponsiveContainer width="100%" height={36}>
            <LineChart data={insights.monthlyProfits}>
              <Line type="monotone" dataKey="profit"
                stroke={insights.profitChange >= 0 ? COLORS.incomeColor : COLORS.expenseColor}
                strokeWidth={2} dot={false} />
              <Tooltip
                formatter={(v) => [fmt(v), 'Profit']}
                labelFormatter={() => ''}
                contentStyle={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : null
      },
      gms: {
        metric: insights.hasGMSData ? fmt(insights.totalPCRS) : 'No Data',
        subtitle: insights.hasGMSData ? 'Total PCRS payments' : 'Upload GMS statements to unlock',
        change: null,
        chart: null
      },
      tax: {
        metric: fmt(current.income - current.expenses),
        subtitle: `${fmt(current.income)} income − ${fmt(current.expenses)} expenses`,
        change: null,
        chart: null
      },
      costs: {
        metric: insights.topExpenses[0] ? insights.topExpenses[0].name : 'N/A',
        subtitle: insights.topExpenses[0] && current.expenses > 0
          ? `${fmt(insights.topExpenses[0].value)} (${(insights.topExpenses[0].value / current.expenses * 100).toFixed(0)}% of total)`
          : null,
        change: null,
        chart: insights.topExpenses.length > 0 ? (
          <ResponsiveContainer width="100%" height={36}>
            <BarChart data={insights.topExpenses.map(e => ({
              name: e.name.length > 12 ? e.name.substring(0, 12) + '...' : e.name,
              value: e.value
            }))} layout="vertical" barSize={8}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" hide />
              <Bar dataKey="value" fill={COLORS.expenseColor} radius={[0, 4, 4, 0]} />
              <Tooltip
                formatter={(v) => [fmt(v)]}
                contentStyle={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : null
      },
      growth: {
        metric: insights.bestMonth ? `${insights.bestMonth.month} strongest` : 'N/A',
        subtitle: insights.bestMonth && insights.worstMonth && insights.bestMonth.month !== insights.worstMonth.month
          ? `${insights.worstMonth.month} weakest (${fmt(insights.bestMonth.income - insights.worstMonth.income)} gap)`
          : insights.avgIncome > 0 ? `Avg ${fmt(insights.avgIncome)}/month` : null,
        change: null,
        chart: insights.monthlyProfits.length > 1 ? (
          <ResponsiveContainer width="100%" height={36}>
            <BarChart data={insights.monthlyProfits}>
              <Bar dataKey="income" fill={`${COLORS.slainteBlue}60`} radius={[2, 2, 0, 0]} />
              <Tooltip
                formatter={(v) => [fmt(v), 'Income']}
                labelFormatter={() => ''}
                contentStyle={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : null
      }
    };
  }, [insights, current, previous, selectedYear]);

  // ─── Data availability ──────────────────────────────────────────────

  const hasTransactions = transactions && transactions.length > 0;
  const hasGMSData = paymentAnalysisData && paymentAnalysisData.length > 0;

  const isCategoryDisabled = (catId) => {
    if (catId === 'gms') return !hasGMSData;
    return !hasTransactions;
  };

  // ─── Handlers ───────────────────────────────────────────────────────

  const handleReadReport = (report) => {
    setActiveCategory(null);
    setSelectedReport(report);
  };

  const handleGenerateAnalysis = (analysis) => {
    setActiveCategory(null);
    setPreviewAnalysis(analysis);
  };

  // Map analysis IDs to their most recent report (for back-face click routing)
  const reportByAnalysisId = useMemo(() => {
    const map = new Map();
    for (const report of finnReports) {
      if (report.suggestedAnalysisId) {
        const existing = map.get(report.suggestedAnalysisId);
        if (!existing || new Date(report.generatedDate) > new Date(existing.generatedDate)) {
          map.set(report.suggestedAnalysisId, report);
        }
      }
    }
    return map;
  }, [finnReports]);

  const handleAnalysisClick = (analysis) => {
    const existingReport = reportByAnalysisId.get(analysis.id);
    if (existingReport) {
      // Already generated — open the report
      setSelectedReport(existingReport);
    } else {
      // Not yet generated — open the generate modal
      setPreviewAnalysis(analysis);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────

  if (selectedReport) {
    return (
      <ReportReader
        report={selectedReport}
        onBack={() => setSelectedReport(null)}
        onDelete={deleteReport}
      />
    );
  }

  const customReports = reportsByCategory.get('custom') || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Category banner grid — 3×2 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '0.75rem'
      }}>
      {ANALYSIS_CATEGORIES.map((category, catIndex) => {
        const catReports = reportsByCategory.get(category.id) || [];
        const catAnalyses = analysesByCategory.get(category.id) || [];
        const disabled = isCategoryDisabled(category.id);
        const config = bannerConfigs[category.id] || {};

        // Resolve narrative for this banner
        const narrativeKey = NARRATIVE_KEY_MAP[category.id];
        const narrativeArr = narrativeKey ? narratives?.[narrativeKey] : null;
        const currentNarrative = Array.isArray(narrativeArr)
          ? narrativeArr[narrativeIndices.current[catIndex] % narrativeArr.length]
          : narrativeArr;

        return (
          <CategoryBanner
            key={category.id}
            category={category}
            // Insight panel
            metric={config.metric}
            subtitle={config.subtitle}
            narrative={currentNarrative || null}
            narrativeVisible={fadeStates[catIndex]}
            change={config.change}
            chart={config.chart}
            disabled={disabled}
            // Report list
            suggestedAnalyses={catAnalyses}
            generatedAnalysisIds={generatedAnalysisIds}
            generatedCount={catReports.length}
            totalCount={catAnalyses.length}
            // Actions
            onExplore={() => setActiveCategory(category)}
            onAnalysisClick={handleAnalysisClick}
            onInsightClick={() => {
              if (catReports.length > 0) {
                // Open the most recent report
                const sorted = [...catReports].sort((a, b) =>
                  new Date(b.generatedDate) - new Date(a.generatedDate)
                );
                setSelectedReport(sorted[0]);
              } else {
                // No reports yet — open the modal
                setActiveCategory(category);
              }
            }}
          />
        );
      })}

      {/* Custom reports banner — 6th card in the grid */}
      <CustomReportsBanner
        reports={customReports}
        onReadReport={handleReadReport}
      />
      </div>

      {/* Category modal */}
      {activeCategory && (
        <CategoryModal
          category={activeCategory}
          generatedReports={reportsByCategory.get(activeCategory.id) || []}
          suggestedAnalyses={analysesByCategory.get(activeCategory.id) || []}
          generatedAnalysisIds={generatedAnalysisIds}
          onClose={() => setActiveCategory(null)}
          onReadReport={handleReadReport}
          onGenerateAnalysis={handleGenerateAnalysis}
          onDeleteReport={deleteReport}
        />
      )}

      {/* Analysis preview modal (existing component) */}
      {previewAnalysis && (
        <AnalysisPreviewModal
          analysis={previewAnalysis}
          onClose={() => setPreviewAnalysis(null)}
          onReportReady={(report) => setSelectedReport(report)}
        />
      )}
    </div>
  );
};

export default AdvancedInsightsV2;

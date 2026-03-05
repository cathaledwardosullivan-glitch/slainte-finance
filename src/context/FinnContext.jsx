import React, { createContext, useState, useEffect, useContext, useRef, useCallback } from 'react';
import { useAppContext } from './AppContext';
import { usePracticeProfile } from '../hooks/usePracticeProfile';
import { chatStorage } from '../storage/chatStorage';
import { callClaude, callClaudeWithTools } from '../utils/claudeAPI';
import { parseArtifactResponse, createArtifact } from '../utils/artifactBuilder';
import { analyzeGMSIncome, generateRecommendations } from '../utils/healthCheckCalculations';
import { buildInteractiveGMSContext } from '../utils/gmsHealthCheckContext';
import { MODELS } from '../data/modelConfig';
import { isAppHelpQuestion, buildAppKnowledgeContext } from '../utils/appContextBuilder';

// Create the context
const FinnContext = createContext(null);

// Background task status constants
const TASK_STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

// Task types - to differentiate between report and PCRS download tasks
const TASK_TYPES = {
  REPORT: 'report',
  PCRS_DOWNLOAD: 'pcrs-download'
};

// Task timeout (3 minutes for reports, PCRS uses its own timeout)
const TASK_TIMEOUT_MS = 3 * 60 * 1000;

// Agentic tool definitions — Phase 1: Navigation + Data Lookup
const FINN_TOOLS = [
  {
    name: 'navigate',
    description: 'Navigate to a page, section, or modal in Sláinte Finance. Use when the user wants to go somewhere or open something.',
    input_schema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          enum: [
            'finances-overview', 'gms-overview', 'gms-health-check',
            'settings', 'transactions', 'reports', 'pcrs-downloader',
            'settings:profile', 'settings:data', 'settings:categories',
            'settings:backup', 'settings:privacy'
          ],
          description: 'The page or section to navigate to. "reports" opens the Financial Dashboard Reports panel (P&L, Balance Sheet, etc.). "finances-overview" opens the Financial Dashboard main page. "gms-health-check" opens the GMS Health Check tool. "pcrs-downloader" opens the built-in PCRS/GMS statement downloader.'
        }
      },
      required: ['target']
    }
  },
  {
    name: 'lookup_financial_data',
    description: 'Look up specific financial data points from the practice\'s records. Use this to answer questions about income, expenses, profit, categories, trends, or transaction counts instead of guessing.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          enum: [
            'total_income', 'total_expenses', 'profit', 'profit_margin',
            'top_expenses', 'top_income', 'gms_payments', 'uncategorized_count',
            'monthly_trends', 'transaction_count', 'available_years', 'expense_breakdown', 'income_breakdown'
          ],
          description: 'The data point to retrieve'
        },
        period: {
          type: 'string',
          enum: ['most_recent_year', 'last_12_months'],
          description: 'Time period for the data (defaults to most_recent_year)'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'search_transactions',
    description: 'Search and filter individual transactions by category, date, amount, or description text. Use this when the user asks about spending on a specific item, category, or time period — e.g. "how much did we spend on uniforms" or "show me transactions over €5000".',
    input_schema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Category name to filter by (partial match, case-insensitive)'
        },
        dateFrom: {
          type: 'string',
          description: 'Start date filter (YYYY-MM-DD)'
        },
        dateTo: {
          type: 'string',
          description: 'End date filter (YYYY-MM-DD)'
        },
        minAmount: {
          type: 'number',
          description: 'Minimum transaction amount'
        },
        maxAmount: {
          type: 'number',
          description: 'Maximum transaction amount'
        },
        searchText: {
          type: 'string',
          description: 'Search transaction descriptions/details (partial match, case-insensitive)'
        },
        type: {
          type: 'string',
          enum: ['income', 'expense', 'drawings'],
          description: 'Filter by transaction type'
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default 20)'
        }
      }
    }
  },
  {
    name: 'generate_report',
    description: 'Generate a CUSTOM AI advisory report. ONLY use for open-ended advisory questions like "Should I hire a nurse?", "What is my 5-year financial outlook?", "Analyse spending trends". Do NOT use for standard reports (P&L, Balance Sheet, Partner Capital Accounts, GMS Health Check, Tax Return) — those have pre-built tools in the app and should be navigated to instead.',
    input_schema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'The custom advisory question — e.g. "Should we hire a nurse?", "What is our 5-year financial outlook?", "Analyse our spending efficiency"'
        },
        reportType: {
          type: 'string',
          enum: ['standard', 'strategic'],
          description: 'Use "standard" for data analysis. Use "strategic" for forward-looking advisory/planning/business decisions.'
        }
      },
      required: ['topic']
    }
  },
  {
    name: 'lookup_saved_reports',
    description: 'Look up previously generated reports. Use when the user references "the report", "your analysis", asks about something in a report, or wants to see their saved reports.',
    input_schema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Search term to find reports by title or original question, or "latest" for the most recent report, or "list" to show all saved reports'
        }
      },
      required: ['search']
    }
  },
  {
    name: 'start_app_tour',
    description: 'Start a guided tour of the Sláinte Finance app. Use when the user asks for a tour, wants to be shown around, asks "how does this app work?", "show me around", "walk me through", or "getting started".',
    input_schema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'send_feedback',
    description: 'Open the feedback form so the user can send feedback, report a bug, or request a feature. Use when you cannot resolve an issue yourself (e.g., a bug, missing feature, or something outside your control), or when the user explicitly asks to send feedback or report a problem.',
    input_schema: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'A brief 1-sentence summary of the issue or feedback topic to pre-fill in the form'
        },
        category: {
          type: 'string',
          enum: ['bug', 'feature', 'question', 'general'],
          description: 'The feedback category. Use "bug" for things not working, "feature" for enhancement requests, "question" for user confusion, "general" for other.'
        }
      },
      required: ['summary', 'category']
    }
  }
];

// Max tool-use rounds before giving up (safety limit)
const MAX_TOOL_ROUNDS = 5;

// Greeting fast path — exact matches skip the agentic loop and use Haiku
const GREETING_FAST_PATH = new Set([
  'hi', 'hello', 'hey', 'thanks', 'thank you', 'cheers', 'ok', 'great',
  'good morning', 'good afternoon', 'good evening', 'hiya', 'howdy',
  'perfect', 'okay', 'got it', 'understood', 'yep', 'cool'
]);

export const FinnProvider = ({ children }) => {
  // App context for financial data
  const {
    transactions,
    unidentifiedTransactions,
    selectedYear,
    categoryMapping,
    paymentAnalysisData,
    localOnlyMode
  } = useAppContext();

  // Practice profile for context
  const {
    profile,
    getCiaranContext,
  } = usePracticeProfile();

  // Check for post-onboarding tour offer via URL parameter (?tour=offer)
  // URL params are bulletproof across page reload (localStorage was unreliable in Electron)
  const [tourOfferPending, setTourOfferPending] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tour') === 'offer') {
      // Clean up URL without triggering a reload
      window.history.replaceState({}, '', window.location.pathname);
      console.log('[Finn] Tour offer detected via URL parameter');
      return true;
    }
    return false;
  });

  // Widget UI state
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' or 'reports'

  // Chat state
  const [currentChatId, setCurrentChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');

  // Background task state (single task only - either report OR PCRS download)
  const [backgroundTask, setBackgroundTask] = useState(null);
  const backgroundTaskRef = useRef(null); // For cancellation
  const taskTimeoutRef = useRef(null);
  const startBackgroundReportRef = useRef(null); // For retry functionality
  const pcrsListenerSetupRef = useRef(false); // Track if PCRS IPC listeners are set up

  // Reports state
  const [savedReports, setSavedReports] = useState([]);

  // Pending report offer (when Finn offers to generate detailed report)


  // Failed report context (for retry functionality)
  const [failedReportContext, setFailedReportContext] = useState(null);

  // Last generated report (for follow-up questions)
  const [lastGeneratedReport, setLastGeneratedReport] = useState(null);

  // Two-phase report generation state
  const [pendingClarifications, setPendingClarifications] = useState(null);
  // { context, questions: [{id, question, placeholder}], phase: 'asking' | 'answered' }

  // Current view/page context - allows Finn to know what the user is looking at
  const [currentView, setCurrentView] = useState('dashboard');

  // Cached GMS Health Check context (to avoid recalculating on every message)
  const gmsHealthCheckContextRef = useRef(null);
  const gmsHealthCheckContextDepsRef = useRef(null);

  // Load API key on mount
  useEffect(() => {
    const loadApiKey = async () => {
      let savedKey = null;

      // Check Electron storage first (preferred)
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

  // Initialize chat on mount
  useEffect(() => {
    // Migrate old history if needed
    chatStorage.migrateOldHistory();

    // Create a new chat session
    const newChat = chatStorage.createChat();
    setCurrentChatId(newChat.id);
    setMessages([]);

    // Load saved reports
    loadSavedReports();
  }, []);

  // Offer a guided tour after onboarding completes (flag captured in tourOfferPending state)
  useEffect(() => {
    if (!tourOfferPending) return;

    console.log('[Finn] Scheduling tour offer widget open');
    const timer = setTimeout(() => {
      console.log('[Finn] Opening widget with tour offer message');
      setIsOpen(true);
      setActiveTab('chat');
      setMessages(prev => [...prev, {
        type: 'assistant',
        content: "Welcome to Sláinte Finance! I'm Finn, your financial advisor. Let me give you a tour of the app — I'll walk you through each section so you know where everything is.",
        timestamp: new Date().toISOString(),
        id: `tour-offer-${Date.now()}`,
        action: { type: 'start_tour', label: 'Start Tour' }
      }]);
      setTourOfferPending(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, [tourOfferPending]);

  // Listen for post-tour choice to show contextual follow-up message
  useEffect(() => {
    const handleTourChoice = (e) => {
      const { choiceId } = e.detail || {};

      let content;
      if (choiceId === 'bank-transactions') {
        content = "Great choice! I've opened the Data section where you can upload your bank statements. You can upload CSV files or PDF bank statements — I'll categorise everything automatically based on what we set up during onboarding. If anything needs correcting, just head to Transactions afterwards.";
      } else if (choiceId === 'gms-payments') {
        content = "Great choice! Here's your GMS Overview. To get started, upload your PCRS statements via Settings > Data. Once the data is in, you'll see your payment breakdown here on the Dashboard. When you have 12 months uploaded, you can run the Health Check for a full income analysis.";
      } else {
        // "I'll explore on my own" - still show a helpful message
        content = "No problem! I'm right here whenever you need me. You can ask me anything about your finances, generate reports, or just say 'tour' if you'd like a guided walkthrough later. Happy exploring!";
      }

      // Open Finn widget with the follow-up message after a brief delay
      setTimeout(() => {
        setIsOpen(true);
        setActiveTab('chat');
        setMessages(prev => [...prev, {
          type: 'assistant',
          content,
          timestamp: new Date().toISOString(),
          id: `tour-followup-${Date.now()}`,
        }]);
      }, 800);
    };

    window.addEventListener('tour:choiceMade', handleTourChoice);
    return () => window.removeEventListener('tour:choiceMade', handleTourChoice);
  }, []);

  // Load saved reports from localStorage
  const loadSavedReports = useCallback(() => {
    const reports = JSON.parse(localStorage.getItem('gp_finance_saved_reports') || '[]');
    // Sort by date, newest first
    reports.sort((a, b) => new Date(b.generatedDate) - new Date(a.generatedDate));
    setSavedReports(reports);
  }, []);

  // Beta Feedback state
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackPreFill, setFeedbackPreFill] = useState(null); // { summary, category }

  // PCRS download state for tracking progress
  const [pcrsDownloadProgress, setPcrsDownloadProgress] = useState(null);
  // { completed: 0, total: 0, currentPanel: '', currentMonth: '', downloadedFiles: [] }

  // Refs to hold the latest notify functions (to avoid circular dependencies)
  const notifyPCRSCompleteRef = useRef(null);
  const notifyPCRSFailedRef = useRef(null);

  // Handle PCRS status updates from IPC
  const handlePCRSStatusUpdate = useCallback((data) => {
    console.log('[Finn] PCRS status update:', data);

    // Only process if we have an active PCRS background task
    setBackgroundTask(prev => {
      if (!prev || prev.type !== TASK_TYPES.PCRS_DOWNLOAD) {
        return prev;
      }

      if (data.status === 'downloading') {
        // Update progress state (via separate setState to avoid stale closure)
        setPcrsDownloadProgress({
          completed: data.completed || 0,
          total: data.total || 0,
          currentPanel: data.panelName || '',
          currentMonth: data.currentMonth || '',  // For bulk downloads: "January 2024"
          downloadedFiles: data.downloadedFiles || []
        });
        return prev;
      } else if (data.status === 'complete') {
        // Download complete - notify via ref
        setTimeout(() => {
          if (notifyPCRSCompleteRef.current) {
            notifyPCRSCompleteRef.current(data.downloadedFiles || []);
          }
          setPcrsDownloadProgress(null);
        }, 0);
        return {
          ...prev,
          status: TASK_STATUS.COMPLETED,
          completedAt: Date.now(),
          downloadedFiles: data.downloadedFiles || []
        };
      } else if (data.status === 'error') {
        // Download failed - notify via ref
        setTimeout(() => {
          if (notifyPCRSFailedRef.current) {
            notifyPCRSFailedRef.current(data.message || 'The PCRS download encountered an error.');
          }
          setPcrsDownloadProgress(null);
        }, 0);
        return {
          ...prev,
          status: TASK_STATUS.FAILED,
          error: data.message || 'Download failed'
        };
      }
      return prev;
    });
  }, []);

  // Set up PCRS IPC listeners
  useEffect(() => {
    if (!window.electronAPI?.pcrs || pcrsListenerSetupRef.current) {
      return;
    }

    console.log('[Finn] Setting up PCRS status listener');
    pcrsListenerSetupRef.current = true;

    window.electronAPI.pcrs.onStatus(handlePCRSStatusUpdate);

    return () => {
      console.log('[Finn] Cleaning up PCRS status listener');
      window.electronAPI.pcrs.removeStatusListener();
      pcrsListenerSetupRef.current = false;
    };
  }, [handlePCRSStatusUpdate]);

  // Calculate financial context for AI
  const getFinancialContext = useCallback(() => {
    // Determine available years and date range from all transactions
    const allDates = transactions
      .filter(t => t.date)
      .map(t => new Date(t.date));

    const availableYears = [...new Set(allDates.map(d => d.getFullYear()))].sort((a, b) => b - a);
    const oldestDate = allDates.length > 0 ? new Date(Math.min(...allDates)) : null;
    const newestDate = allDates.length > 0 ? new Date(Math.max(...allDates)) : null;

    // Get the most recent full year of data (for "last 12 months" type queries)
    const currentYear = new Date().getFullYear();
    const mostRecentYearWithData = availableYears[0] || currentYear;

    // Calculate data for the most recent year (regardless of dashboard selection)
    const recentYearTransactions = transactions.filter(t => {
      if (!t.date) return false;
      return new Date(t.date).getFullYear() === mostRecentYearWithData;
    });

    // Also get "last 12 months" data (rolling window)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const last12MonthsTransactions = transactions.filter(t => {
      if (!t.date) return false;
      const txDate = new Date(t.date);
      return txDate >= twelveMonthsAgo;
    });

    // Helper function to calculate summaries
    const calculateSummary = (txList) => {
      let income = 0, expenses = 0, drawings = 0;
      const categoryBreakdown = {};
      const monthlyBreakdown = {};

      txList.forEach(t => {
        const amount = t.credit || t.debit || t.amount || 0;
        if (t.category?.type === 'income') income += amount;
        else if (t.category?.type === 'expense') expenses += amount;
        else if (t.category?.type === 'drawings') drawings += amount;

        // Category breakdown
        if (t.category) {
          const categoryName = t.category.name;
          if (!categoryBreakdown[categoryName]) {
            categoryBreakdown[categoryName] = { name: categoryName, value: 0, type: t.category.type };
          }
          categoryBreakdown[categoryName].value += amount;
        }

        // Monthly breakdown
        if (t.monthYear) {
          if (!monthlyBreakdown[t.monthYear]) {
            monthlyBreakdown[t.monthYear] = { month: t.monthYear, income: 0, expenses: 0 };
          }
          if (t.category?.type === 'income') {
            monthlyBreakdown[t.monthYear].income += amount;
          } else if (t.category?.type === 'expense' || t.category?.type === 'drawings') {
            monthlyBreakdown[t.monthYear].expenses += amount;
          }
        }
      });

      const topExpenseCategories = Object.values(categoryBreakdown)
        .filter(c => c.type === 'expense')
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      const topIncomeCategories = Object.values(categoryBreakdown)
        .filter(c => c.type === 'income')
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      return {
        income,
        expenses,
        drawings,
        profit: income - expenses - drawings,
        profitMargin: income > 0 ? ((income - expenses - drawings) / income * 100).toFixed(1) : 0,
        topExpenseCategories,
        topIncomeCategories,
        monthlyTrends: Object.values(monthlyBreakdown).sort((a, b) => a.month.localeCompare(b.month))
      };
    };

    // Calculate summaries for both time periods
    const recentYearSummary = calculateSummary(recentYearTransactions);
    const last12MonthsSummary = calculateSummary(last12MonthsTransactions);

    return {
      // Metadata about available data
      availableYears,
      oldestDataDate: oldestDate ? oldestDate.toISOString().split('T')[0] : null,
      newestDataDate: newestDate ? newestDate.toISOString().split('T')[0] : null,
      totalTransactions: transactions.length,
      currentDate: new Date().toISOString().split('T')[0],

      // Most recent year with data (use this by default)
      mostRecentYear: mostRecentYearWithData,
      yearToDateIncome: recentYearSummary.income,
      yearToDateExpenses: recentYearSummary.expenses,
      yearToDateDrawings: recentYearSummary.drawings,
      profit: recentYearSummary.profit,
      profitMargin: recentYearSummary.profitMargin,
      topExpenseCategories: recentYearSummary.topExpenseCategories,
      topIncomeCategories: recentYearSummary.topIncomeCategories,
      monthlyTrends: recentYearSummary.monthlyTrends,

      // Last 12 months rolling data (for "last 12 months" queries)
      last12Months: {
        income: last12MonthsSummary.income,
        expenses: last12MonthsSummary.expenses,
        profit: last12MonthsSummary.profit,
        profitMargin: last12MonthsSummary.profitMargin,
        topExpenseCategories: last12MonthsSummary.topExpenseCategories,
        topIncomeCategories: last12MonthsSummary.topIncomeCategories,
        monthlyTrends: last12MonthsSummary.monthlyTrends
      },

      // Dashboard-selected year (for reference, but Finn should prefer recent data)
      dashboardSelectedYear: selectedYear,

      // Other metadata
      unidentifiedCount: unidentifiedTransactions.length,
      learnedPatterns: categoryMapping.reduce((sum, cat) => sum + cat.identifiers.length, 0),
      categorizationRate: transactions.length > 0 ?
        ((transactions.length / (transactions.length + unidentifiedTransactions.length)) * 100).toFixed(1) : 0,

      // GMS Payment Data from PCRS PDFs (paymentAnalysisData)
      // This is the GROSS GMS payment data extracted from PCRS payment statements
      gmsPaymentData: (() => {
        if (!paymentAnalysisData || paymentAnalysisData.length === 0) {
          return { hasData: false, payments: [], summary: null };
        }

        // Group payments by month/year and sum totals (for multi-panel practices)
        const monthlyPayments = {};
        const yearlyTotals = {};

        paymentAnalysisData.forEach(payment => {
          const date = new Date(payment.paymentDate);
          const year = date.getFullYear();
          const month = date.toLocaleDateString('en-IE', { month: 'short', year: 'numeric' });
          const monthKey = `${year}-${String(date.getMonth() + 1).padStart(2, '0')}`;

          if (!monthlyPayments[monthKey]) {
            monthlyPayments[monthKey] = {
              monthKey,
              month,
              year,
              totalGross: 0,
              panelCount: 0
            };
          }
          monthlyPayments[monthKey].totalGross += payment.totalGrossPayment || 0;
          monthlyPayments[monthKey].panelCount += 1;

          // Track yearly totals
          if (!yearlyTotals[year]) {
            yearlyTotals[year] = { gross: 0, monthCount: 0 };
          }
          yearlyTotals[year].gross += payment.totalGrossPayment || 0;
        });

        // Sort by date
        const sortedPayments = Object.values(monthlyPayments)
          .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

        // Get most recent year data
        const recentYear = mostRecentYearWithData;
        const recentYearPayments = sortedPayments.filter(p => p.year === recentYear);
        const recentYearTotal = yearlyTotals[recentYear]?.gross || 0;

        return {
          hasData: true,
          totalPayments: paymentAnalysisData.length,
          payments: sortedPayments,
          recentYearPayments,
          recentYearTotal,
          yearlyTotals,
          availableYears: Object.keys(yearlyTotals).map(Number).sort((a, b) => b - a)
        };
      })(),

      // Previously generated reports (from Reports tab)
      // This gives Finn awareness of reports it has created
      previousReports: (() => {
        if (!savedReports || savedReports.length === 0) {
          return { hasReports: false, reports: [] };
        }

        // Get Finn-generated reports only
        const finnReports = savedReports
          .filter(r => r.type === 'AI Report' || r.metadata?.generatedBy === 'Finn AI')
          .map(r => ({
            id: r.id,
            title: r.title,
            generatedDate: r.generatedDate,
            originalQuestion: r.originalQuestion,
            // Include a brief summary from the content (first 200 chars)
            contentPreview: r.content ? r.content.substring(0, 200).replace(/[#*`]/g, '').trim() + '...' : null,
            // Calculate relative time
            ageInHours: Math.round((new Date() - new Date(r.generatedDate)) / (1000 * 60 * 60))
          }));

        return {
          hasReports: finnReports.length > 0,
          reportCount: finnReports.length,
          reports: finnReports,
          // Reports from today
          recentReports: finnReports.filter(r => r.ageInHours < 24),
          // Reports from last 7 days
          weeklyReports: finnReports.filter(r => r.ageInHours < 168)
        };
      })()
    };
  }, [transactions, unidentifiedTransactions, selectedYear, categoryMapping, paymentAnalysisData, savedReports]);

  // Build GMS Health Check context - full or summary based on current view
  const buildGMSHealthCheckContext = useCallback((forceFullContext = false) => {
    if (!profile?.healthCheckData?.healthCheckComplete) {
      return '';
    }

    try {
      const analysisResults = analyzeGMSIncome(paymentAnalysisData, profile, profile.healthCheckData);
      const recommendations = generateRecommendations(analysisResults, profile, profile.healthCheckData, paymentAnalysisData);

      if (!analysisResults || !recommendations) {
        return '';
      }

      // Use full context when on the GMS Health Check page or when explicitly requested
      const useFullContext = forceFullContext || currentView === 'gms-health-check';

      if (useFullContext) {
        // Check if we have a cached version with the same deps
        const currentDeps = JSON.stringify({
          healthCheckData: profile.healthCheckData,
          paymentAnalysisDataLength: paymentAnalysisData?.length
        });

        if (gmsHealthCheckContextRef.current && gmsHealthCheckContextDepsRef.current === currentDeps) {
          return gmsHealthCheckContextRef.current;
        }

        // Build full context using the comprehensive builder
        const fullContext = buildInteractiveGMSContext(
          analysisResults,
          profile.healthCheckData,
          profile,
          recommendations
        );

        // Cache it
        gmsHealthCheckContextRef.current = fullContext;
        gmsHealthCheckContextDepsRef.current = currentDeps;

        return fullContext;
      }

      // Summary context for other pages (lighter weight)
      const parts = [];
      parts.push('**GMS HEALTH CHECK ANALYSIS:**');

      if (analysisResults.totalUnclaimedPotential > 0) {
        parts.push(`\n**Total Unclaimed GMS Income Potential: €${analysisResults.totalUnclaimedPotential.toLocaleString()}**`);
      }

      if (recommendations.priorityRecommendations?.length > 0) {
        parts.push('\n**PRIORITY RECOMMENDATIONS:**');
        recommendations.priorityRecommendations.slice(0, 3).forEach((rec, i) => {
          parts.push(`${i + 1}. **${rec.title}** - Potential: €${rec.potential.toLocaleString()}`);
        });
      }

      return parts.join('\n');
    } catch (err) {
      console.error('Error building GMS Health Check context:', err);
      return '';
    }
  }, [profile, paymentAnalysisData, currentView]);

  // Detect if message is a retry request (only for failed report context)
  // Must be very specific to avoid false positives
  const isRetryRequest = useCallback((message) => {
    const lowerMsg = message.toLowerCase().trim();
    // Only match EXACT short phrases that clearly mean "retry the failed task"
    const exactRetryPhrases = [
      'yes', 'yes please', 'yeah', 'yep', 'sure', 'ok', 'okay',
      'try again', 'retry', 'go ahead', 'please do', 'do it',
      'yes do it', 'yes go ahead', 'please retry'
    ];
    // Must be an exact match (not just starts with) to avoid catching longer messages
    return exactRetryPhrases.includes(lowerMsg);
  }, []);

  // ============================================
  // AGENTIC TOOL USE — Phase 1
  // ============================================

  // Look up a specific financial data point from the practice's data
  const lookupDataPoint = useCallback((query, period = 'most_recent_year') => {
    const financialContext = getFinancialContext();
    const data = period === 'last_12_months' ? financialContext.last12Months : financialContext;

    // For last_12_months, some fields are nested differently
    const income = period === 'last_12_months' ? data?.income : data?.yearToDateIncome;
    const expenses = period === 'last_12_months' ? data?.expenses : data?.yearToDateExpenses;
    const profit = period === 'last_12_months' ? (data?.income - data?.expenses) : data?.profit;
    const margin = period === 'last_12_months'
      ? (data?.income > 0 ? ((data?.income - data?.expenses) / data?.income * 100).toFixed(1) : '0')
      : data?.profitMargin;

    switch (query) {
      case 'total_income':
        return { value: income, formatted: `€${(income || 0).toLocaleString()}`, period };
      case 'total_expenses':
        return { value: expenses, formatted: `€${(expenses || 0).toLocaleString()}`, period };
      case 'profit':
        return { value: profit, formatted: `€${(profit || 0).toLocaleString()}`, period };
      case 'profit_margin':
        return { value: margin, formatted: `${margin}%`, period };
      case 'top_expenses':
        return { categories: (period === 'last_12_months' ? data?.topExpenseCategories : financialContext.topExpenseCategories) || [] };
      case 'top_income':
        return { categories: (period === 'last_12_months' ? data?.topIncomeCategories : financialContext.topIncomeCategories) || [] };
      case 'expense_breakdown':
        return { categories: financialContext.topExpenseCategories || [], year: financialContext.mostRecentYear };
      case 'income_breakdown':
        return { categories: financialContext.topIncomeCategories || [], year: financialContext.mostRecentYear };
      case 'gms_payments':
        return financialContext.gmsPaymentData || { hasData: false };
      case 'uncategorized_count':
        return { count: financialContext.unidentifiedCount || unidentifiedTransactions.length };
      case 'monthly_trends':
        return { trends: financialContext.monthlyTrends || [] };
      case 'transaction_count':
        return { count: financialContext.totalTransactions || transactions.length };
      case 'available_years':
        return { years: financialContext.availableYears || [], mostRecent: financialContext.mostRecentYear };
      default:
        return { error: `Unknown query type: ${query}` };
    }
  }, [getFinancialContext, transactions, unidentifiedTransactions]);

  // Search transactions by category, date, amount, or description
  const searchTransactions = useCallback((input) => {
    let results = [...transactions];

    // Filter by type
    if (input.type) {
      results = results.filter(t => t.category?.type === input.type || t.type === input.type);
    }

    // Filter by category name (partial match, case-insensitive)
    if (input.category) {
      const cat = input.category.toLowerCase();
      results = results.filter(t => {
        const catName = (t.categoryName || t.category?.name || '').toLowerCase();
        const groupName = (t.group || '').toLowerCase();
        return catName.includes(cat) || groupName.includes(cat);
      });
    }

    // Filter by description text (partial match, case-insensitive)
    if (input.searchText) {
      const text = input.searchText.toLowerCase();
      results = results.filter(t => {
        const details = (t.details || '').toLowerCase();
        return details.includes(text);
      });
    }

    // Filter by date range
    if (input.dateFrom) {
      const from = new Date(input.dateFrom);
      results = results.filter(t => t.date && new Date(t.date) >= from);
    }
    if (input.dateTo) {
      const to = new Date(input.dateTo);
      results = results.filter(t => t.date && new Date(t.date) <= to);
    }

    // Filter by amount range
    if (input.minAmount != null) {
      results = results.filter(t => {
        const amt = Math.abs(t.amount || t.debit || t.credit || 0);
        return amt >= input.minAmount;
      });
    }
    if (input.maxAmount != null) {
      results = results.filter(t => {
        const amt = Math.abs(t.amount || t.debit || t.credit || 0);
        return amt <= input.maxAmount;
      });
    }

    // Sort by date descending
    results.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    // Calculate summary stats before limiting
    const totalAmount = results.reduce((sum, t) => {
      return sum + Math.abs(t.amount || t.debit || t.credit || 0);
    }, 0);
    const totalCount = results.length;

    // Limit results
    const limit = input.limit || 20;
    const limited = results.slice(0, limit);

    return {
      matchCount: totalCount,
      totalAmount: totalAmount,
      totalFormatted: `€${totalAmount.toLocaleString('en-IE', { minimumFractionDigits: 2 })}`,
      showing: limited.length,
      transactions: limited.map(t => ({
        date: t.date ? new Date(t.date).toLocaleDateString('en-IE') : 'Unknown',
        description: t.details || 'No description',
        amount: Math.abs(t.amount || t.debit || t.credit || 0),
        amountFormatted: `€${Math.abs(t.amount || t.debit || t.credit || 0).toLocaleString('en-IE', { minimumFractionDigits: 2 })}`,
        type: t.category?.type || t.type || 'unknown',
        category: t.categoryName || t.category?.name || 'Uncategorized',
        group: t.group || 'Unknown'
      }))
    };
  }, [transactions]);

  // Look up saved reports
  const lookupSavedReports = useCallback((search) => {
    if (!savedReports || savedReports.length === 0) {
      return { found: false, message: 'No saved reports yet. Reports are generated and saved when you ask for one.' };
    }

    const term = (search || '').toLowerCase().trim();

    // Return all reports (list view)
    if (term === 'list' || term === 'all') {
      return {
        found: true,
        count: savedReports.length,
        reports: savedReports.map(r => ({
          id: r.id,
          title: r.title,
          date: r.generatedDate ? new Date(r.generatedDate).toLocaleDateString('en-IE') : 'Unknown',
          originalQuestion: r.originalQuestion || ''
        }))
      };
    }

    // Return latest report
    if (term === 'latest' || term === 'last' || term === 'recent') {
      const latest = savedReports[0]; // Already sorted newest-first
      return {
        found: true,
        report: {
          id: latest.id,
          title: latest.title,
          date: latest.generatedDate ? new Date(latest.generatedDate).toLocaleDateString('en-IE') : 'Unknown',
          originalQuestion: latest.originalQuestion || '',
          content: (latest.content || '').substring(0, 3000) // Truncate for token safety
        }
      };
    }

    // Search by title or original question
    const matches = savedReports.filter(r => {
      const title = (r.title || '').toLowerCase();
      const question = (r.originalQuestion || '').toLowerCase();
      const content = (r.content || '').toLowerCase();
      return title.includes(term) || question.includes(term) || content.includes(term);
    });

    if (matches.length === 0) {
      return { found: false, message: `No reports found matching "${search}". There are ${savedReports.length} saved reports total.` };
    }

    // Return the best match with content
    const best = matches[0];
    return {
      found: true,
      matchCount: matches.length,
      report: {
        id: best.id,
        title: best.title,
        date: best.generatedDate ? new Date(best.generatedDate).toLocaleDateString('en-IE') : 'Unknown',
        originalQuestion: best.originalQuestion || '',
        content: (best.content || '').substring(0, 3000)
      },
      otherMatches: matches.length > 1 ? matches.slice(1, 5).map(r => ({
        id: r.id,
        title: r.title,
        date: r.generatedDate ? new Date(r.generatedDate).toLocaleDateString('en-IE') : 'Unknown'
      })) : []
    };
  }, [savedReports]);

  // Feedback modal controls (defined here so executeToolAction can reference openFeedback)
  const openFeedback = useCallback((preFill = null) => {
    setFeedbackPreFill(preFill);
    setFeedbackModalOpen(true);
  }, []);

  const closeFeedback = useCallback(() => {
    setFeedbackModalOpen(false);
    setFeedbackPreFill(null);
  }, []);

  // Execute a tool action and return the result
  const executeToolAction = useCallback((toolName, input) => {
    switch (toolName) {
      case 'navigate': {
        const target = input.target;

        if (target.startsWith('settings:')) {
          const section = target.split(':')[1];
          setCurrentView('settings');
          window.dispatchEvent(new CustomEvent('navigate-to-settings', { detail: { section } }));
          return { success: true, message: `Navigated to Settings → ${section}` };
        }

        if (target === 'settings') {
          window.dispatchEvent(new CustomEvent('navigate-to-settings'));
          return { success: true, message: 'Navigated to Settings' };
        }

        if (target === 'transactions') {
          window.dispatchEvent(new CustomEvent('task:openTransactions'));
          return { success: true, message: 'Opened Transactions' };
        }

        if (target === 'reports') {
          // Navigate to Financial Dashboard and open the Reports modal (P&L, Balance Sheet, etc.)
          setCurrentView('business-overview');
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('tour:openReportsModal'));
          }, 300);
          return { success: true, message: 'Navigated to Financial Dashboard and opened the Reports panel where you can generate P&L Reports, Balance Sheets, and more.' };
        }

        if (target === 'gms-health-check') {
          setCurrentView('gms-overview');
          window.dispatchEvent(new CustomEvent('tour:switchToHealthCheck'));
          return { success: true, message: 'Navigated to GMS Health Check' };
        }

        if (target === 'pcrs-downloader') {
          // PCRS downloader lives inside Settings → Data section
          setCurrentView('settings');
          window.dispatchEvent(new CustomEvent('navigate-to-settings', { detail: { section: 'data' } }));
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('open-pcrs-downloader'));
          }, 300);
          return { success: true, message: 'Opened the PCRS Statement Downloader. You can log in to download your latest GMS/PCRS statements directly from here.' };
        }

        // Direct page navigation
        setCurrentView(target);
        return { success: true, message: `Navigated to ${target}` };
      }

      case 'lookup_financial_data': {
        return lookupDataPoint(input.query, input.period);
      }

      case 'search_transactions': {
        return searchTransactions(input);
      }

      case 'generate_report': {
        // Build the context object for startBackgroundReport
        const financialContext = getFinancialContext();
        const practiceContext = getCiaranContext();
        const gmsContext = buildGMSHealthCheckContext();
        const reportContext = {
          originalQuestion: input.topic,
          financialContext,
          practiceContext,
          gmsContext,
          isStrategic: input.reportType === 'strategic'
        };

        // Use the ref since startBackgroundReport is defined later in the file
        if (startBackgroundReportRef.current) {
          startBackgroundReportRef.current(reportContext, true); // skipClarification=true, Claude handles that
          return { success: true, message: `Report generation started: "${input.topic}". The user will be notified when it is ready. This typically takes 15-30 seconds.` };
        }
        return { success: false, error: 'Report generation not available right now. Please try again.' };
      }

      case 'lookup_saved_reports': {
        return lookupSavedReports(input.search);
      }

      case 'start_app_tour': {
        // Dispatch event for TourProvider to pick up (FinnContext has no direct access to startTour)
        window.dispatchEvent(new CustomEvent('finn:start-app-tour'));
        // Close the Finn widget so the tour overlay is visible
        setIsOpen(false);
        return { success: true, message: 'App tour started. The Finn widget has been closed so the user can see the tour overlay.' };
      }

      case 'send_feedback': {
        openFeedback({
          summary: input.summary || '',
          category: input.category || 'general'
        });
        return { success: true, message: 'Feedback form opened and pre-filled with the issue summary. The user can now review and submit it.' };
      }

      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  }, [lookupDataPoint, searchTransactions, lookupSavedReports, getFinancialContext, getCiaranContext, buildGMSHealthCheckContext, setCurrentView, setActiveTab, setIsOpen, openFeedback]);

  // Handle quick queries (greetings, thanks, etc.)
  const handleQuickQuery = useCallback(async (message, queryType) => {
    const quickSystemPrompt = `You are Finn, a warm and professional Irish financial advisor for GP practices. You work for Sláinte Finance.

${queryType.type === 'greeting' ? 'The user is greeting you. Respond warmly but briefly. Do NOT introduce yourself — the user already knows who you are. Just say hello back and ask what they need help with.' : ''}
${queryType.type === 'acknowledgment' ? 'The user is thanking you or acknowledging something. Respond graciously and briefly. Offer to help with anything else.' : ''}
${queryType.type === 'casual' ? 'The user is asking a casual question. Be friendly and helpful. If they need more detailed analysis, offer to help.' : ''}

Keep your response to 1-3 sentences maximum. Be warm but concise.`;

    const response = await callClaude(quickSystemPrompt + '\n\nUser: ' + message, {
      model: MODELS.FAST,
      maxTokens: 256,
      apiKey: apiKey
    });

    if (response.success) {
      return response.content;
    }
    throw new Error(response.error || 'Failed to get response');
  }, [apiKey]);

  // Build recent conversation history for context
  const getRecentConversationHistory = useCallback(() => {
    // Get last 6 messages (3 exchanges) for context
    const recentMessages = messages.slice(-6);
    if (recentMessages.length === 0) return '';

    return recentMessages.map(msg => {
      const role = msg.type === 'user' ? 'User' : 'Finn';
      // Truncate long messages
      const content = msg.content.length > 300 ? msg.content.substring(0, 300) + '...' : msg.content;
      return `${role}: ${content}`;
    }).join('\n');
  }, [messages]);

  // Get page-specific context description
  const getPageContextDescription = useCallback(() => {
    const pageDescriptions = {
      'dashboard': 'The user is viewing the main Dashboard with financial overview charts.',
      'business-overview': 'The user is viewing the Business Overview page showing income, expenses, profit charts, GMS Dashboard with monthly PCRS payment data, and GMS Health Check for analyzing unclaimed income opportunities.',
      'transactions': 'The user is viewing the Transactions list where they can see and categorize individual transactions.',
      'export': 'The user is on the Export/Reports page.',
      'gms-panel': 'The user is viewing the GMS Panel Analysis page with PCRS payment breakdowns showing Total Gross Payments and payment categories.',
      'gms-health-check': 'The user is viewing the GMS Health Check Report. They can see all the recommendations, unclaimed income analysis, and growth opportunities displayed on their screen. When they ask about "the report" or "these recommendations", they are referring to the GMS Health Check data shown below.',
      'admin': 'The user is on the Admin/Settings page.'
    };
    return pageDescriptions[currentView] || 'The user is using the Sláinte Finance app.';
  }, [currentView]);

  // Human-readable description for tool execution indicators
  function getToolDescription(toolName, input) {
    switch (toolName) {
      case 'navigate':
        return `Navigating to ${input.target?.replace(/-/g, ' ').replace(':', ' → ')}`;
      case 'lookup_financial_data':
        return `Looking up ${input.query?.replace(/_/g, ' ')}`;
      case 'search_transactions':
        return `Searching transactions${input.category ? ` for "${input.category}"` : ''}${input.searchText ? ` matching "${input.searchText}"` : ''}`;
      case 'generate_report':
        return `Generating report: ${input.topic}`;
      case 'lookup_saved_reports':
        return `Looking up saved reports${input.search ? `: "${input.search}"` : ''}`;
      case 'start_app_tour':
        return 'Starting app tour';
      case 'send_feedback':
        return `Opening feedback form${input.summary ? `: "${input.summary}"` : ''}`;
      default:
        return `Running ${toolName}`;
    }
  }

  // Agentic query — sends message to Claude with tools, runs the tool-use loop
  const agenticQuery = useCallback(async (message) => {
    const conversationHistory = getRecentConversationHistory();
    const pageContext = getPageContextDescription();
    const practiceContext = getCiaranContext();
    const gmsContext = buildGMSHealthCheckContext();
    const appKnowledge = isAppHelpQuestion(message) ? buildAppKnowledgeContext(message) : '';

    const systemPrompt = `You are Finn, a professional Irish financial advisor for GP practices. You work for Sláinte Finance. Be warm, concise, and professional. Never use emojis.

CURRENT PAGE: ${pageContext}
TODAY'S DATE: ${new Date().toLocaleDateString('en-IE')}
${practiceContext ? `\nPRACTICE CONTEXT: ${practiceContext.substring(0, 300)}` : ''}
${gmsContext ? `\nGMS HEALTH CHECK SUMMARY: ${gmsContext.substring(0, 500)}` : ''}
${appKnowledge ? `\n${appKnowledge}` : ''}

RULES:
- For simple questions, answer in 2-4 sentences. This is a chat widget, not a report.
- Do NOT introduce yourself. The user already knows who you are. Never say "I am Finn" or "Welcome to Sláinte Finance".
- Use your tools to look up financial data rather than guessing. You have access to live practice data via the lookup_financial_data tool.
- Use search_transactions when the user asks about spending on a specific category, item, or wants to find specific transactions. It supports filtering by category name, description text, date range, amount range, and transaction type.
- The app has PRE-BUILT REPORTS that the user should be navigated to — do NOT use generate_report for these:
  • "Profit & Loss Report" / "P&L" → navigate to "reports" (opens the Reports panel on the Financial Dashboard)
  • "Partner's Capital Accounts" → navigate to "reports"
  • "Personal Tax Return Form" → navigate to "reports"
  • "Balance Sheet" → navigate to "reports"
  • "GMS Health Check" → navigate to "gms-health-check" (separate page with its own analysis tool)
  • "Accountant Export" → navigate to "settings:data"
  When the user asks for any of these, use the navigate tool to take them there. Tell them the report is ready to generate from that page.
- ONLY use generate_report for CUSTOM advisory questions that don't match a pre-built report — e.g. "Should I hire a nurse?", "What's my 5-year financial outlook?", "Analyse my spending trends". These are AI-generated analyses.
- Use lookup_saved_reports when the user references a previous report, asks "what did the report say", or wants to see their saved reports.
- Use the navigate tool when the user wants to go to a page or open something.
- You ARE qualified to help with business planning, investment analysis, and financial projections. NEVER refuse a financial question.
- GMS Overview page shows GROSS payments (before deductions). Financial Overview shows NET payments received in bank transactions. These are DIFFERENT.
- If the user is asking about how to use a Sláinte Finance feature and an APP FEATURE GUIDE section is provided above, use it to give specific navigation steps.
- NEVER say you don't have access to data — use your tools to check.
- The app has a built-in PCRS/GMS statement downloader. Users do NOT need to log into the PCRS portal manually. Navigate to the PCRS downloader page if they ask about downloading statements.
- Use start_app_tour when the user asks for a tour, wants to be shown around, or asks how the app works. The tour starts automatically — just call the tool.
- If you cannot resolve a user's issue (bug, missing feature, or something outside your control), use send_feedback to open the feedback form pre-filled with a summary. Do NOT tell the user to contact support — use the tool to open the form for them.`;

    // Build messages array with conversation history
    const recentMessages = messages.slice(-6);
    const apiMessages = [];

    for (const msg of recentMessages) {
      const role = msg.type === 'user' ? 'user' : 'assistant';
      const content = msg.content?.length > 300 ? msg.content.substring(0, 300) + '...' : msg.content;
      if (content) {
        apiMessages.push({ role, content });
      }
    }

    // Ensure messages alternate properly (Claude API requirement)
    // Remove consecutive same-role messages
    const cleanedMessages = [];
    for (const msg of apiMessages) {
      if (cleanedMessages.length === 0 || cleanedMessages[cleanedMessages.length - 1].role !== msg.role) {
        cleanedMessages.push(msg);
      }
    }

    // Add the current user message
    cleanedMessages.push({ role: 'user', content: message });

    // Ensure first message is from user (Claude API requirement)
    while (cleanedMessages.length > 0 && cleanedMessages[0].role !== 'user') {
      cleanedMessages.shift();
    }

    const toolActions = [];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      let response;
      try {
        response = await callClaudeWithTools({
          model: MODELS.STANDARD,
          max_tokens: 1024,
          cache_control: { type: 'ephemeral' },
          system: systemPrompt,
          messages: cleanedMessages,
          tools: FINN_TOOLS,
          tool_choice: { type: 'auto' }
        });
      } catch (err) {
        console.error(`[Finn] API error on tool round ${round}:`, err);
        return {
          content: "I ran into a connection issue. Please try again in a moment.",
          toolActions,
          isError: true
        };
      }

      // Claude is done — extract text and return
      if (response.stop_reason === 'end_turn') {
        const text = response.content
          .filter(b => b.type === 'text')
          .map(b => b.text)
          .join('\n\n');
        return { content: text, toolActions };
      }

      // Claude wants to use tools
      if (response.stop_reason === 'tool_use') {
        const toolResults = [];

        for (const block of response.content.filter(b => b.type === 'tool_use')) {
          console.log(`[Finn] Tool call: ${block.name}`, block.input);

          const result = executeToolAction(block.name, block.input);
          toolActions.push({
            name: block.name,
            input: block.input,
            status: 'completed',
            description: getToolDescription(block.name, block.input)
          });

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result)
          });
        }

        // Feed results back to Claude for the next round
        cleanedMessages.push({ role: 'assistant', content: response.content });
        cleanedMessages.push({ role: 'user', content: toolResults });
      }
    }

    // Hit max rounds without finishing
    console.warn('[Finn] Hit MAX_TOOL_ROUNDS limit');
    return {
      content: "I ran into an issue completing that action. Please try again.",
      toolActions,
      isError: true
    };
  }, [messages, getRecentConversationHistory, getPageContextDescription, getCiaranContext, buildGMSHealthCheckContext, executeToolAction]);

  // Send a message to Finn
  const sendMessage = useCallback(async (userMessage) => {
    if (!userMessage.trim() || isLoading) return;

    // Block all AI chat in Local Only Mode
    if (localOnlyMode) {
      const localOnlyMsg = {
        type: 'assistant',
        content: "I'm unavailable in Local Only Mode. No data is being sent externally. You can re-enable AI features in **Settings > Privacy & AI**.",
        timestamp: new Date().toISOString(),
        id: `assistant-${Date.now()}`
      };

      const userMsg = {
        type: 'user',
        content: userMessage,
        timestamp: new Date().toISOString(),
        id: `user-${Date.now()}`
      };
      setMessages(prev => [...prev, userMsg, localOnlyMsg]);
      return;
    }

    if (!apiKey) {
      console.error('No API key available');
      return;
    }

    // Add user message
    const userMsg = {
      type: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
      id: `user-${Date.now()}`
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    if (currentChatId) {
      chatStorage.addMessage(currentChatId, userMsg);
    }

    try {
      // Check if this is a retry request and we have failed context
      if (isRetryRequest(userMessage) && failedReportContext) {
        console.log('[Finn] Detected retry request, regenerating report...');
        setIsLoading(false);
        if (startBackgroundReportRef.current) {
          startBackgroundReportRef.current(failedReportContext);
        }
        setFailedReportContext(null);
        return;
      }

      // Greeting fast path — use Haiku for obvious greetings/acknowledgments
      const normalizedMsg = userMessage.toLowerCase().trim().replace(/[!.]+$/, '');
      if (GREETING_FAST_PATH.has(normalizedMsg)) {
        console.log('[Finn] Greeting fast path:', normalizedMsg);
        const quickResponse = await handleQuickQuery(userMessage, { type: 'greeting' });
        addAssistantMessage(quickResponse);
        return;
      }

      // Agentic query — Claude decides whether to use tools or answer directly
      console.log('[Finn] Routing through agentic query');
      const result = await agenticQuery(userMessage);

      const assistantMsg = {
        type: 'assistant',
        content: result.content,
        timestamp: new Date().toISOString(),
        id: `assistant-${Date.now()}`,
        isError: result.isError || false,
        toolActions: result.toolActions?.length > 0 ? result.toolActions : undefined
      };

      setMessages(prev => [...prev, assistantMsg]);
      if (currentChatId) {
        chatStorage.addMessage(currentChatId, assistantMsg);
      }

    } catch (error) {
      console.error('Finn chat error:', error);
      addAssistantMessage(
        "I'm having trouble connecting right now. Please try again in a moment.",
        true
      );
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, currentChatId, isLoading, isRetryRequest, failedReportContext, messages, agenticQuery]);

  // Add assistant message to chat
  const addAssistantMessage = useCallback((content, isError = false, extras = {}) => {
    const assistantMsg = {
      type: 'assistant',
      content,
      timestamp: new Date().toISOString(),
      id: `assistant-${Date.now()}`,
      isError,
      ...extras
    };

    setMessages(prev => [...prev, assistantMsg]);

    if (currentChatId) {
      chatStorage.addMessage(currentChatId, assistantMsg);
    }
  }, [currentChatId]);

  // Analyze if clarifying questions would improve the report
  const analyzeForClarifications = useCallback(async (context) => {
    const { originalQuestion, financialContext, practiceContext } = context;

    const analysisPrompt = `You are Finn, a financial advisor. Determine if clarifying questions are ABSOLUTELY NECESSARY before generating a report.

**IMPORTANT: DEFAULT TO NO QUESTIONS.** Most reports can be generated well without clarification. Only ask if the report would be FUNDAMENTALLY WRONG without the answer.

**USER'S QUESTION:**
${originalQuestion}

**PRACTICE CONTEXT:**
${practiceContext || 'Irish GP practice'}

**FINANCIAL DATA AVAILABLE:**
- Income: €${financialContext.yearToDateIncome.toLocaleString()}
- Expenses: €${financialContext.yearToDateExpenses.toLocaleString()}
- Top expense categories: ${financialContext.topExpenseCategories.map(c => c.name).join(', ')}
${financialContext.gmsPaymentData?.hasData ? `- GMS Payment Data: ${financialContext.gmsPaymentData.totalPayments} PCRS statements loaded with gross payment amounts` : ''}

**ONLY ask questions if ALL of these are true:**
1. The question is about something you genuinely cannot infer from the data
2. Without the answer, the report would give WRONG advice (not just less detailed advice)
3. The user hasn't already provided enough context in their question

**NEVER ask about:**
- Data sources (you have access to Financial Overview and GMS Overview data)
- What the user means by standard terms (GMS, PCRS, gross vs net, etc.)
- Preferences that can be addressed with sensible defaults
- Things you can make reasonable assumptions about

**RESPOND IN THIS EXACT JSON FORMAT:**
{"needsClarification": false, "questions": []}

Only change needsClarification to true if you have an ESSENTIAL question. 90%+ of the time, the answer should be false.`;

    try {
      const response = await callClaude(analysisPrompt, {
        model: MODELS.FAST,
        maxTokens: 500,
        apiKey: apiKey
      });

      if (response.success) {
        // Parse JSON response
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return parsed;
        }
      }
      return { needsClarification: false, questions: [] };
    } catch (error) {
      console.error('[Finn] Clarification analysis error:', error);
      return { needsClarification: false, questions: [] };
    }
  }, [apiKey]);

  // Start background report generation (with optional clarification phase)
  const startBackgroundReport = useCallback(async (context, skipClarification = false) => {
    if (backgroundTask?.status === TASK_STATUS.RUNNING) {
      console.log('Background task already running');
      return;
    }

    // If not skipping clarification and no clarifications provided, check if we need them
    if (!skipClarification && !context.clarifications) {
      // Show "analyzing" message
      addAssistantMessage(
        "Let me analyze your question to see if I need any clarifications before generating the report..."
      );

      try {
        const clarificationResult = await analyzeForClarifications(context);

        if (clarificationResult.needsClarification && clarificationResult.questions?.length > 0) {
          // Store context and show clarification questions
          setPendingClarifications({
            context,
            questions: clarificationResult.questions,
            phase: 'asking'
          });

          // Add message with questions
          const questionText = clarificationResult.questions.map((q, i) =>
            `${i + 1}. ${q.question}${q.reason ? ` (${q.reason})` : ''}`
          ).join('\n');

          const clarificationMsg = {
            type: 'assistant',
            content: `Before I generate the detailed report, could you clarify:\n\n${questionText}\n\nYou can answer below, or click "Skip" to generate the report without these details.`,
            timestamp: new Date().toISOString(),
            id: `assistant-${Date.now()}`,
            isClarificationRequest: true,
            questions: clarificationResult.questions
          };

          setMessages(prev => [...prev, clarificationMsg]);
          if (currentChatId) {
            chatStorage.addMessage(currentChatId, clarificationMsg);
          }
          return; // Wait for user response
        }
      } catch (error) {
        console.error('[Finn] Clarification check failed, proceeding with report:', error);
        // Continue with report generation if clarification check fails
      }
    }

    const taskId = `task-${Date.now()}`;

    // Set up task state
    setBackgroundTask({
      id: taskId,
      status: TASK_STATUS.RUNNING,
      startedAt: Date.now(),
      context
    });
    backgroundTaskRef.current = { cancelled: false };

    // Add "working on it" message - vary based on model tier
    const workingMessage = context.isStrategic
      ? "This is a strategic question, so I'm going to do a deeper analysis for you. Feel free to continue using the app - I'll let you know when it's ready."
      : "I'll work on that detailed report now. Feel free to continue using the app - I'll let you know when it's ready.";
    addAssistantMessage(workingMessage);

    // Clear any pending clarifications
    setPendingClarifications(null);

    // Set timeout
    taskTimeoutRef.current = setTimeout(() => {
      if (backgroundTaskRef.current && !backgroundTaskRef.current.cancelled) {
        // Preserve context for retry
        setFailedReportContext(context);

        setBackgroundTask(prev => ({
          ...prev,
          status: TASK_STATUS.FAILED,
          error: 'Report generation took too long. Would you like me to try again?'
        }));
        notifyReportFailed('That took longer than expected. Would you like me to try again?');
      }
    }, TASK_TIMEOUT_MS);

    try {
      // Generate the detailed report
      const report = await generateDetailedReport(context);

      // Check if cancelled
      if (backgroundTaskRef.current?.cancelled) {
        return;
      }

      // Clear timeout
      if (taskTimeoutRef.current) {
        clearTimeout(taskTimeoutRef.current);
      }

      // Save report
      const savedReport = saveReport(report);

      // Update task status
      setBackgroundTask(prev => ({
        ...prev,
        status: TASK_STATUS.COMPLETED,
        completedAt: Date.now(),
        reportId: savedReport.id
      }));

      // Store for follow-up questions
      setLastGeneratedReport(savedReport);

      // Notify user
      notifyReportReady(savedReport);

    } catch (error) {
      console.error('Background report error:', error);

      if (taskTimeoutRef.current) {
        clearTimeout(taskTimeoutRef.current);
      }

      if (!backgroundTaskRef.current?.cancelled) {
        // Preserve context for retry
        setFailedReportContext(context);

        setBackgroundTask(prev => ({
          ...prev,
          status: TASK_STATUS.FAILED,
          error: error.message
        }));
        notifyReportFailed('I ran into a problem generating that report. Would you like me to try again?');
      }
    }
  }, [backgroundTask, addAssistantMessage, analyzeForClarifications, currentChatId]);

  // Submit clarification answers and continue with report
  const submitClarifications = useCallback((answers) => {
    if (!pendingClarifications) return;

    const { context, questions } = pendingClarifications;

    // Format clarifications as text
    const clarificationText = questions.map((q, i) =>
      `Q: ${q.question}\nA: ${answers[q.id] || 'Not provided'}`
    ).join('\n\n');

    // Add user message showing their answers
    const userMsg = {
      type: 'user',
      content: Object.values(answers).filter(a => a).join('. '),
      timestamp: new Date().toISOString(),
      id: `user-${Date.now()}`
    };
    setMessages(prev => [...prev, userMsg]);

    // Continue with report generation, including clarifications
    const enrichedContext = {
      ...context,
      clarifications: clarificationText
    };

    // Clear pending and start report (skip clarification phase)
    setPendingClarifications(null);
    startBackgroundReport(enrichedContext, true);
  }, [pendingClarifications, startBackgroundReport]);

  // Skip clarifications and generate report anyway
  const skipClarifications = useCallback(() => {
    if (!pendingClarifications) return;

    const { context } = pendingClarifications;
    setPendingClarifications(null);
    startBackgroundReport(context, true);
  }, [pendingClarifications, startBackgroundReport]);

  // Keep ref in sync for retry functionality
  useEffect(() => {
    startBackgroundReportRef.current = startBackgroundReport;
  }, [startBackgroundReport]);

  // Common acronyms used in Irish GP practice finance - for reference in prompts
  const COMMON_ACRONYMS = [
    'GMS (General Medical Services)',
    'PRSI (Pay Related Social Insurance)',
    'SPV (Special Purpose Vehicle)',
    'LTV (Loan to Value)',
    'CGT (Capital Gains Tax)',
    'FTE (Full-Time Equivalent)',
    'HSE (Health Service Executive)',
    'PCRS (Primary Care Reimbursement Service)',
    'GP (General Practitioner)',
    'VAT (Value Added Tax)',
    'PAYE (Pay As You Earn)',
    'USC (Universal Social Charge)',
    'BOI (Bank of Ireland)',
    'AIB (Allied Irish Banks)',
    'ICGP (Irish College of General Practitioners)'
  ];

  // Generate detailed report - uses Opus for strategic advisory, Sonnet for standard reports
  const generateDetailedReport = useCallback(async (context) => {
    const { originalQuestion, financialContext, practiceContext, gmsContext, clarifications, isStrategic } = context;

    // Select model tier based on question type
    const modelId = isStrategic ? MODELS.STRATEGIC : MODELS.STANDARD;
    const modelLabel = isStrategic ? 'Opus (Strategic Advisory)' : 'Sonnet (Standard Report)';
    console.log(`[Finn] Report model: ${modelLabel}`);

    const strategicPreamble = isStrategic ? `
**STRATEGIC ADVISORY MODE:**
This is a strategic question requiring deeper analysis. You should:
- Consider multiple scenarios and their financial implications
- Provide forward-looking projections grounded in the practice's actual data
- Weigh pros and cons of different approaches with specific numbers
- Consider Irish GP-specific factors (GMS contracts, HSE policies, PCRS dynamics)
- Include risk assessment and mitigation strategies where relevant
- Think holistically about the business, not just the immediate financials
` : '';

    // Static report instructions (cacheable across multiple report generations)
    const reportSystemPrompt = `You are Finn, an expert financial advisor for Irish GP practices. Create a CONCISE, professional report.
${strategicPreamble}
**CRITICAL FORMATTING RULES:**
1. **MAXIMUM ${isStrategic ? '1,800' : '1,200'} WORDS** - GPs are busy. Be concise. Every sentence must add value.
2. **NO REPETITION** - Never present the same data in multiple formats (e.g., table AND text AND chart showing identical information)
3. **ACRONYMS** - On first use, write the full term followed by acronym in parentheses. Example: "General Medical Services (GMS)". After first use, use acronym only.
   Common acronyms to expand on first use: ${COMMON_ACRONYMS.slice(0, 8).join(', ')}
4. **LEAD WITH INSIGHTS** - Executive summary should give the key takeaway in the first sentence
5. **NEVER use emojis**

**REFERENCE REQUIREMENTS:**
- When citing industry benchmarks, standards, or statistics, add a footnote reference [1], [2], etc.
- At the end of the report, include a "References" section with sources
- If a claim is based on general industry knowledge without a specific source, note it as "Based on industry practice" rather than inventing a citation
- When using data from the user's own records, note it as "Source: Practice financial data"

**CHART REQUIREMENTS:**
Include 1-2 Vega-Lite charts where they add visual value. Embed charts INSIDE the report using this exact format:

\`\`\`vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "width": 400,
  "height": 250,
  "title": "Chart Title Here",
  "data": { "values": [{"category": "A", "value": 100}, {"category": "B", "value": 200}] },
  "mark": "bar",
  "encoding": {
    "x": {"field": "category", "type": "nominal", "title": "X Axis Label"},
    "y": {"field": "value", "type": "quantitative", "title": "Y Axis Label"}
  }
}
\`\`\`

**Chart best practices:**
- Bar charts for comparing categories (expenses, income sources)
- Line charts for trends over time (monthly income/expenses)
- Pie/donut charts for composition (expense breakdown as percentages)
- Always include meaningful titles and axis labels
- Use appropriate colors (green for income/positive, red for expenses/negative)
- Do NOT create a chart that just repeats what's already in a table - use one or the other

**REPORT STRUCTURE:**
Use the <artifact> tag format. Keep it tight and actionable:

${isStrategic ? `<artifact title="Report Title Here" type="report">
# Strategic Analysis Title

## Executive Summary
[Clear statement of the question and the recommended course of action]

## Key Findings
[3-4 bullet points with the most important insights]

## Scenario Analysis
[Compare 2-3 realistic options/scenarios with projected financial impact. Use specific numbers from the practice data.]

## Risk Assessment
[Key risks for each scenario and mitigation strategies]

## Recommendations
[3-5 prioritized, actionable recommendations with estimated timeline]

## References
[1] Source name, date (or "Based on practice financial data")
[2] etc.

</artifact>` : `<artifact title="Report Title Here" type="report">
# Concise Report Title

## Key Findings
[2-3 bullet points with the most important insights - this is what the GP will read if nothing else]

## Analysis
[Focused analysis with specific numbers. Include 1 chart if it adds clarity. One table maximum.]

## Recommendations
[3-5 actionable, prioritized recommendations]

## References
[1] Source name, date (or "Based on practice financial data")
[2] etc.

</artifact>`}

After the artifact, add 1 sentence offering to clarify or explore specific aspects.`;

    // Dynamic practice data and question (changes per report)
    const reportUserMessage = `**PRACTICE CONTEXT:**
${practiceContext}

${gmsContext ? `**GMS DATA:**\n${gmsContext}` : ''}

**TODAY'S DATE:** ${financialContext.currentDate}
**DATA AVAILABLE:** ${financialContext.oldestDataDate} to ${financialContext.newestDataDate}
**YEARS WITH DATA:** ${financialContext.availableYears?.join(', ') || 'Unknown'}

**${financialContext.mostRecentYear} FINANCIAL DATA (most recent full year):**
- Total transactions: ${financialContext.totalTransactions}
- Gross income: €${financialContext.yearToDateIncome.toLocaleString()}
- Total expenses: €${financialContext.yearToDateExpenses.toLocaleString()}
- Partner drawings: €${financialContext.yearToDateDrawings?.toLocaleString() || '0'}
- Net profit: €${financialContext.profit.toLocaleString()}
- Profit margin: ${financialContext.profitMargin}%

**TOP EXPENSE CATEGORIES (${financialContext.mostRecentYear}):**
${financialContext.topExpenseCategories.map((cat, i) =>
      `${i + 1}. ${cat.name}: €${cat.value.toLocaleString()}`
    ).join('\n')}

**INCOME BREAKDOWN (${financialContext.mostRecentYear}):**
${financialContext.topIncomeCategories.map((cat, i) =>
      `${i + 1}. ${cat.name}: €${cat.value.toLocaleString()}`
    ).join('\n')}

**MONTHLY TRENDS (${financialContext.mostRecentYear}):**
${financialContext.monthlyTrends.map(month =>
      `${month.month}: Income €${month.income.toLocaleString()}, Expenses €${month.expenses.toLocaleString()}`
    ).join('\n')}

**LAST 12 MONTHS ROLLING DATA:**
- Income: €${financialContext.last12Months?.income?.toLocaleString() || 'N/A'}
- Expenses: €${financialContext.last12Months?.expenses?.toLocaleString() || 'N/A'}
- Profit: €${financialContext.last12Months?.profit?.toLocaleString() || 'N/A'}
- Monthly trends: ${financialContext.last12Months?.monthlyTrends?.map(m => `${m.month}: €${m.expenses.toLocaleString()} expenses`).join(', ') || 'N/A'}

${financialContext.gmsPaymentData?.hasData ? `**GMS GROSS PAYMENT DATA (from PCRS PDF Statements):**
This is the GROSS GMS payment data from uploaded PCRS statements (shown on GMS Overview page).
The income figures in "FINANCIAL DATA" above show NET payments received in bank transactions.
GROSS vs NET: Gross is before HSE deductions (PRSI, superannuation, withholding tax). Net is what actually arrived in the bank.

- Total PCRS statements loaded: ${financialContext.gmsPaymentData.totalPayments}
- Years with GMS data: ${financialContext.gmsPaymentData.availableYears?.join(', ')}
${financialContext.gmsPaymentData.recentYearPayments?.length > 0 ? `
**${financialContext.mostRecentYear} MONTHLY GROSS GMS PAYMENTS:**
${financialContext.gmsPaymentData.recentYearPayments.map(p => `${p.month}: €${p.totalGross.toLocaleString()}`).join('\n')}

**${financialContext.mostRecentYear} TOTAL GROSS GMS: €${financialContext.gmsPaymentData.recentYearTotal?.toLocaleString()}**` : ''}
` : ''}

${financialContext.previousReports?.hasReports ? `**PREVIOUSLY GENERATED REPORTS:**
If the user is asking to UPDATE a previous report, use the same structure but with updated financial data.
${financialContext.previousReports.recentReports?.map(r => `- "${r.title}" (${r.ageInHours < 1 ? 'just now' : r.ageInHours + 'h ago'})${r.originalQuestion ? ` - Original question: "${r.originalQuestion}"` : ''}${r.contentPreview ? `\n  Preview: ${r.contentPreview}` : ''}`).join('\n') || ''}
` : ''}
${isAppHelpQuestion(originalQuestion) ? buildAppKnowledgeContext(originalQuestion) : ''}
**IMPORTANT:**
- When user asks about "last 12 months", "recent data", or similar, use the LAST 12 MONTHS ROLLING DATA section
- Default to ${financialContext.mostRecentYear} data for general queries
- GMS Overview page shows GROSS payments (before deductions). Financial Overview shows NET payments (after deductions). When comparing, use the correct data source.
- ONLY use the ACTUAL data provided above in charts and tables. NEVER fabricate or estimate values.

**USER'S ORIGINAL QUESTION:**
${originalQuestion}

${clarifications ? `**USER'S CLARIFICATIONS:**\n${clarifications}\n` : ''}
Generate the report now.`;

    console.log('[Finn] Starting detailed report generation...');

    const reportRequest = {
      model: modelId,
      max_tokens: isStrategic ? 8192 : 4096,
      cache_control: { type: 'ephemeral' },
      system: reportSystemPrompt,
      messages: [
        { role: 'user', content: reportUserMessage }
      ]
    };

    // Enable extended thinking for strategic advisory reports (Opus)
    // Gives Claude a reasoning budget for deeper scenario analysis and projections
    if (isStrategic) {
      reportRequest.thinking = { type: 'enabled', budget_tokens: 4096 };
    }

    const data = await callClaudeWithTools(reportRequest);
    console.log('[Finn] Report generated successfully');

    // Extract response content
    let reportContent = '';
    if (data.content && Array.isArray(data.content)) {
      reportContent = data.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n\n');
    }

    // Parse artifact from response
    const parsed = parseArtifactResponse(reportContent);

    if (parsed && parsed.artifact) {
      return {
        title: parsed.artifact.title,
        type: parsed.artifact.type,
        content: parsed.artifact.content,
        intro: parsed.intro,
        conclusion: parsed.conclusion,
        originalQuestion,
        modelUsed: modelId
      };
    }

    // Fallback if no artifact tags
    return {
      title: 'Financial Analysis Report',
      type: 'report',
      content: reportContent,
      originalQuestion,
      modelUsed: modelId
    };
  }, []);

  // Save report to localStorage
  const saveReport = useCallback((report) => {
    const savedReports = JSON.parse(localStorage.getItem('gp_finance_saved_reports') || '[]');

    const newReport = {
      id: `finn-report-${Date.now()}`,
      title: report.title,
      type: 'AI Report',
      generatedDate: new Date().toISOString(),
      year: new Date().getFullYear(),
      content: report.content,
      htmlContent: null, // Will be rendered by ArtifactViewer
      artifactType: report.type,
      originalQuestion: report.originalQuestion,
      intro: report.intro,
      conclusion: report.conclusion,
      metadata: {
        generatedBy: 'Finn AI',
        model: report.modelUsed || MODELS.STANDARD
      }
    };

    savedReports.unshift(newReport);

    // Keep only last 20 reports
    if (savedReports.length > 20) {
      savedReports.pop();
    }

    localStorage.setItem('gp_finance_saved_reports', JSON.stringify(savedReports));
    setSavedReports(savedReports);

    return newReport;
  }, []);

  // Notify user that report is ready
  const notifyReportReady = useCallback((report) => {
    // Open the widget if closed
    setIsOpen(true);

    // Add notification message to chat
    const notificationMsg = {
      type: 'assistant',
      content: `That report I've been working on is now ready for you to read. I've put together a detailed analysis based on your question.`,
      timestamp: new Date().toISOString(),
      id: `assistant-${Date.now()}`,
      isReportNotification: true,
      reportId: report.id,
      reportTitle: report.title
    };

    setMessages(prev => [...prev, notificationMsg]);

    if (currentChatId) {
      chatStorage.addMessage(currentChatId, notificationMsg);
    }
  }, [currentChatId]);

  // Notify user that report failed
  const notifyReportFailed = useCallback((errorMessage) => {
    setIsOpen(true);

    const errorMsg = {
      type: 'assistant',
      content: errorMessage,
      timestamp: new Date().toISOString(),
      id: `assistant-${Date.now()}`,
      isError: true,
      canRetry: true
    };

    setMessages(prev => [...prev, errorMsg]);

    if (currentChatId) {
      chatStorage.addMessage(currentChatId, errorMsg);
    }
  }, [currentChatId]);

  // Cancel background task
  const cancelBackgroundTask = useCallback(() => {
    if (backgroundTaskRef.current) {
      backgroundTaskRef.current.cancelled = true;
    }

    if (taskTimeoutRef.current) {
      clearTimeout(taskTimeoutRef.current);
    }

    setBackgroundTask(prev => ({
      ...prev,
      status: TASK_STATUS.CANCELLED
    }));

    addAssistantMessage('Report cancelled.');
  }, [addAssistantMessage]);

  // Start PCRS background download
  const startPCRSDownload = useCallback(async (config) => {
    // Check if another task is already running
    if (backgroundTask?.status === TASK_STATUS.RUNNING) {
      const taskName = backgroundTask.type === TASK_TYPES.REPORT ? 'a detailed report' : 'a PCRS download';
      addAssistantMessage(
        `I'm currently working on ${taskName}. Please wait for that to finish before starting another background task.`
      );
      return false;
    }

    const taskId = `pcrs-${Date.now()}`;

    // Set up task state
    setBackgroundTask({
      id: taskId,
      type: TASK_TYPES.PCRS_DOWNLOAD,
      status: TASK_STATUS.RUNNING,
      startedAt: Date.now(),
      config
    });
    backgroundTaskRef.current = { cancelled: false };

    // Open Finn and show starting message
    setIsOpen(true);

    const panelCount = config.panels?.length || 'all';
    addAssistantMessage(
      `I'll download those PCRS statements now (${panelCount} panel${panelCount !== 1 ? 's' : ''}). Feel free to keep using the app - I'll let you know when they're ready.`
    );

    // Initialize progress tracking
    setPcrsDownloadProgress({
      completed: 0,
      total: config.panels?.length || 0,
      currentPanel: '',
      currentMonth: '',  // For bulk downloads: "January 2024"
      downloadedFiles: []
    });

    try {
      // Start the actual download via IPC
      // The downloadStatements call will trigger status updates via pcrs:status
      const result = await window.electronAPI.pcrs.downloadStatements({
        panels: config.panels,
        dateRange: config.dateRange,
        backgroundMode: true
      });

      // Note: Completion is handled by the IPC status listener (handlePCRSStatusUpdate)
      // If the call itself fails immediately, handle it here
      if (!result.success && result.error) {
        throw new Error(result.error);
      }

      return true;
    } catch (error) {
      console.error('[Finn] PCRS download start error:', error);
      setBackgroundTask(prev => ({
        ...prev,
        status: TASK_STATUS.FAILED,
        error: error.message
      }));
      notifyPCRSFailed(error.message || 'Failed to start PCRS download.');
      setPcrsDownloadProgress(null);
      return false;
    }
  }, [backgroundTask, addAssistantMessage]);

  // Notify user that PCRS download is complete
  const notifyPCRSComplete = useCallback((downloadedFiles) => {
    // Open the widget if closed
    setIsOpen(true);

    const fileCount = downloadedFiles?.length || 0;

    // Add notification message to chat
    const notificationMsg = {
      type: 'assistant',
      content: `Great news - your PCRS statements are ready! I've downloaded ${fileCount} statement${fileCount !== 1 ? 's' : ''}. You can now import them into your Payment Analysis.`,
      timestamp: new Date().toISOString(),
      id: `assistant-${Date.now()}`,
      isPCRSNotification: true,
      pcrsComplete: true,
      downloadedFiles
    };

    setMessages(prev => [...prev, notificationMsg]);

    if (currentChatId) {
      chatStorage.addMessage(currentChatId, notificationMsg);
    }
  }, [currentChatId]);

  // Notify user that PCRS download failed
  const notifyPCRSFailed = useCallback((errorMessage) => {
    setIsOpen(true);

    const errorMsg = {
      type: 'assistant',
      content: `I ran into a problem downloading the PCRS statements: ${errorMessage}`,
      timestamp: new Date().toISOString(),
      id: `assistant-${Date.now()}`,
      isError: true,
      isPCRSNotification: true,
      pcrsError: true,
      canRetryPCRS: true
    };

    setMessages(prev => [...prev, errorMsg]);

    if (currentChatId) {
      chatStorage.addMessage(currentChatId, errorMsg);
    }
  }, [currentChatId]);

  // Keep PCRS notify refs in sync (for use in IPC handler)
  useEffect(() => {
    notifyPCRSCompleteRef.current = notifyPCRSComplete;
    notifyPCRSFailedRef.current = notifyPCRSFailed;
  }, [notifyPCRSComplete, notifyPCRSFailed]);

  // Start a new chat
  const startNewChat = useCallback(() => {
    const newChat = chatStorage.createChat();
    setCurrentChatId(newChat.id);
    setMessages([]);
  }, []);

  // Open widget
  const openWidget = useCallback(() => {
    setIsOpen(true);
  }, []);

  // Close widget
  const closeWidget = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Toggle widget
  const toggleWidget = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  // Delete a report
  const deleteReport = useCallback((reportId) => {
    const reports = JSON.parse(localStorage.getItem('gp_finance_saved_reports') || '[]');
    const filtered = reports.filter(r => r.id !== reportId);
    localStorage.setItem('gp_finance_saved_reports', JSON.stringify(filtered));
    setSavedReports(filtered);
  }, []);


  const submitFeedback = useCallback(async (feedbackData) => {
    try {
      // Gather auto-context
      const context = {
        ...feedbackData,
        practiceId: profile?.metadata?.practiceId || '',
        appVersion: window.electronAPI?.getAppVersion ? await window.electronAPI.getAppVersion() : 'unknown',
        os: navigator.userAgent,
        currentPage: currentView || 'unknown',
        dataStats: `${transactions.length} transactions, ${categoryMapping.length} categories`,
        timestamp: new Date().toISOString()
      };

      // Submit via Electron IPC (falls back gracefully if not in Electron)
      if (window.electronAPI?.submitFeedback) {
        const result = await window.electronAPI.submitFeedback(context);
        if (result.success) {
          // Post confirmation to chat
          setMessages(prev => [...prev, {
            type: 'assistant',
            content: 'Feedback sent successfully! The Sláinte team will review it shortly. Thank you!',
            timestamp: new Date().toISOString(),
            id: `feedback-confirm-${Date.now()}`
          }]);
          closeFeedback();
          return { success: true };
        } else {
          return { success: false, error: result.error, savedLocally: !!result.localFile };
        }
      } else {
        // Not in Electron (dev mode) — just log
        console.log('[Feedback] Dev mode — feedback data:', context);
        closeFeedback();
        return { success: true };
      }
    } catch (err) {
      console.error('[Feedback] Submit error:', err);
      return { success: false, error: err.message };
    }
  }, [currentView, transactions.length, categoryMapping.length, closeFeedback, profile]);

  // Context value
  const value = {
    // Widget state
    isOpen,
    activeTab,
    setActiveTab,
    openWidget,
    closeWidget,
    toggleWidget,

    // Chat state
    messages,
    isLoading,
    currentChatId,
    sendMessage,
    startNewChat,
    apiKey,

    // Background task (shared between reports and PCRS)
    backgroundTask,
    startBackgroundReport,
    cancelBackgroundTask,
    TASK_TYPES,
    TASK_STATUS,

    // PCRS background download
    startPCRSDownload,
    pcrsDownloadProgress,

    // Clarifications (two-phase report generation)
    pendingClarifications,
    submitClarifications,
    skipClarifications,

    // Reports
    savedReports,
    loadSavedReports,
    deleteReport,
    lastGeneratedReport,

    // Financial context (for components that need it)
    getFinancialContext,

    // Page context - allows parent components to tell Finn what the user is looking at
    currentView,
    setCurrentView,

    // Has data check
    hasData: transactions.length > 0,

    // Local Only Mode status
    localOnlyMode,

    // Beta Feedback
    feedbackModalOpen,
    feedbackPreFill,
    openFeedback,
    closeFeedback,
    submitFeedback
  };

  return (
    <FinnContext.Provider value={value}>
      {children}
    </FinnContext.Provider>
  );
};

// Custom hook for consuming the context
export const useFinn = () => {
  const context = useContext(FinnContext);
  if (!context) {
    throw new Error('useFinn must be used within a FinnProvider');
  }
  return context;
};

// Safe version that returns null if outside provider (for optional usage)
export const useFinnSafe = () => {
  return useContext(FinnContext);
};

export default FinnContext;

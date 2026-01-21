import React, { createContext, useState, useEffect, useContext, useRef, useCallback } from 'react';
import { useAppContext } from './AppContext';
import { usePracticeProfile } from '../hooks/usePracticeProfile';
import { chatStorage } from '../storage/chatStorage';
import { callClaude } from '../utils/claudeAPI';
import { parseArtifactResponse, createArtifact } from '../utils/artifactBuilder';
import { analyzeGMSIncome, generateRecommendations } from '../utils/healthCheckCalculations';
import { buildInteractiveGMSContext } from '../utils/gmsHealthCheckContext';

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

// Task timeout (3 minutes)
const TASK_TIMEOUT_MS = 3 * 60 * 1000;

export const FinnProvider = ({ children }) => {
  // App context for financial data
  const {
    transactions,
    unidentifiedTransactions,
    selectedYear,
    categoryMapping,
    paymentAnalysisData
  } = useAppContext();

  // Practice profile for context
  const {
    profile,
    getCiaranContext,
  } = usePracticeProfile();

  // Widget UI state
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' or 'reports'

  // Chat state
  const [currentChatId, setCurrentChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');

  // Background task state (single task only)
  const [backgroundTask, setBackgroundTask] = useState(null);
  const backgroundTaskRef = useRef(null); // For cancellation
  const taskTimeoutRef = useRef(null);
  const startBackgroundReportRef = useRef(null); // For retry functionality

  // Reports state
  const [savedReports, setSavedReports] = useState([]);

  // Pending report offer (when Finn offers to generate detailed report)
  const [pendingReportOffer, setPendingReportOffer] = useState(null);

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

  // Load saved reports from localStorage
  const loadSavedReports = useCallback(() => {
    const reports = JSON.parse(localStorage.getItem('gp_finance_saved_reports') || '[]');
    // Sort by date, newest first
    reports.sort((a, b) => new Date(b.generatedDate) - new Date(a.generatedDate));
    setSavedReports(reports);
  }, []);

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
        ((transactions.length / (transactions.length + unidentifiedTransactions.length)) * 100).toFixed(1) : 0
    };
  }, [transactions, unidentifiedTransactions, selectedYear, categoryMapping]);

  // Detect if a query is a quick/simple greeting or casual question
  const isQuickQuery = useCallback((message) => {
    const lowerMsg = message.toLowerCase().trim();

    // Greetings and pleasantries
    const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy', 'hiya'];
    if (greetings.some(g => lowerMsg === g || lowerMsg === g + '!' || lowerMsg === g + '.')) {
      return { isQuick: true, type: 'greeting' };
    }

    // Thanks/acknowledgments
    const thanks = ['thanks', 'thank you', 'cheers', 'great', 'perfect', 'ok', 'okay', 'got it', 'understood'];
    if (thanks.some(t => lowerMsg === t || lowerMsg === t + '!' || lowerMsg === t + '.')) {
      return { isQuick: true, type: 'acknowledgment' };
    }

    // Very short queries (likely casual)
    if (lowerMsg.split(' ').length <= 3 && !lowerMsg.includes('analyze') && !lowerMsg.includes('report') && !lowerMsg.includes('detailed')) {
      if (lowerMsg.startsWith('how are') || lowerMsg.startsWith('what\'s up') || lowerMsg === 'help' || lowerMsg === 'help?') {
        return { isQuick: true, type: 'casual' };
      }
    }

    return { isQuick: false, type: 'full' };
  }, []);

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

  // Detect if message is a tour request
  const isTourRequest = useCallback((message) => {
    const lowerMsg = message.toLowerCase();
    const tourPhrases = [
      'tour', 'show me around', 'walk me through', 'guide me',
      'how does this work', 'getting started', 'show me how', 'walkthrough'
    ];
    return tourPhrases.some(phrase => lowerMsg.includes(phrase));
  }, []);

  // Detect if message is asking about a report
  const isReportQuestion = useCallback((message) => {
    const lowerMsg = message.toLowerCase();
    const reportPhrases = [
      'the report', 'that report', 'your report', 'this report',
      'the analysis', 'that analysis', 'your analysis',
      'what you wrote', 'what you generated', 'what you created',
      'tell me more about', 'explain the', 'clarify the',
      'in the report', 'from the report', 'about the report'
    ];
    return reportPhrases.some(phrase => lowerMsg.includes(phrase));
  }, []);

  // Send a message to Finn
  const sendMessage = useCallback(async (userMessage) => {
    if (!userMessage.trim() || isLoading) return;

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

    // Save to storage
    if (currentChatId) {
      chatStorage.addMessage(currentChatId, userMsg);
    }

    try {
      // Check if this is a retry request and we have failed context
      if (isRetryRequest(userMessage) && failedReportContext) {
        console.log('[Finn] Detected retry request, regenerating report...');
        setIsLoading(false); // Will be managed by startBackgroundReport
        if (startBackgroundReportRef.current) {
          startBackgroundReportRef.current(failedReportContext);
        }
        setFailedReportContext(null); // Clear after retry
        return;
      }

      // Check if this is a tour request
      if (isTourRequest(userMessage)) {
        const tourMsg = {
          type: 'assistant',
          content: "I'd be happy to show you around! Click the button below to start a guided tour of Sláinte Finance. I'll walk you through all the key features.",
          timestamp: new Date().toISOString(),
          id: `assistant-${Date.now()}`,
          showTourButton: true
        };
        setMessages(prev => [...prev, tourMsg]);
        if (currentChatId) {
          chatStorage.addMessage(currentChatId, tourMsg);
        }
        return;
      }

      // Check if asking about a previously generated report
      if (isReportQuestion(userMessage) && lastGeneratedReport) {
        const reportFollowUp = await handleReportFollowUp(userMessage, lastGeneratedReport);
        addAssistantMessage(reportFollowUp);
        return;
      }

      const queryType = isQuickQuery(userMessage);
      const financialContext = getFinancialContext();

      // For quick queries, use Haiku with minimal context
      if (queryType.isQuick) {
        const quickResponse = await handleQuickQuery(userMessage, queryType);
        addAssistantMessage(quickResponse);
        return;
      }

      // For substantive queries, provide quick answer + offer detailed report
      const response = await handleSubstantiveQuery(userMessage, financialContext);
      addAssistantMessage(response.content, response.offerDetailedReport, response.reportContext);

    } catch (error) {
      console.error('Finn chat error:', error);
      addAssistantMessage(
        "I'm having trouble connecting right now. Please try again in a moment.",
        false,
        null,
        true
      );
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, currentChatId, isLoading, isQuickQuery, getFinancialContext, isRetryRequest, failedReportContext, isTourRequest, isReportQuestion, lastGeneratedReport]);

  // Handle follow-up questions about a generated report
  const handleReportFollowUp = useCallback(async (message, report) => {
    // Get recent conversation for context
    const recentMessages = messages.slice(-6);
    const conversationHistory = recentMessages.map(msg => {
      const role = msg.type === 'user' ? 'User' : 'Finn';
      const content = msg.content.length > 300 ? msg.content.substring(0, 300) + '...' : msg.content;
      return `${role}: ${content}`;
    }).join('\n');

    const systemPrompt = `You are Finn, a professional financial advisor. The user is asking a follow-up question about a report you recently generated.

**REPORT TITLE:** ${report.title}

**REPORT CONTENT:**
${report.content.substring(0, 4000)}${report.content.length > 4000 ? '...[truncated]' : ''}

**ORIGINAL QUESTION THAT PROMPTED THE REPORT:**
${report.originalQuestion || 'Not available'}

**RECENT CONVERSATION:**
${conversationHistory}

**USER'S CURRENT MESSAGE:**
${message}

**RULES:**
1. Answer based on the report content AND the conversation context
2. Keep your response concise (3-5 sentences)
3. Reference specific points from the report where relevant
4. If they ask about sources or data origins, be honest if the data wasn't from a cited source
5. If they want you to research something, acknowledge and confirm you'll look into it
6. Never use emojis`;

    const response = await callClaude(systemPrompt, {
      model: 'claude-haiku-4-5-20251001',
      maxTokens: 500,
      apiKey: apiKey
    });

    if (response.success) {
      return response.content;
    }
    throw new Error(response.error || 'Failed to get response');
  }, [apiKey, messages]);

  // Handle quick queries (greetings, thanks, etc.)
  const handleQuickQuery = useCallback(async (message, queryType) => {
    const quickSystemPrompt = `You are Finn, a warm and professional Irish financial advisor for GP practices. You work for Sláinte Finance.

${queryType.type === 'greeting' ? 'The user is greeting you. Respond warmly but briefly. Mention you\'re ready to help with their practice finances.' : ''}
${queryType.type === 'acknowledgment' ? 'The user is thanking you or acknowledging something. Respond graciously and briefly. Offer to help with anything else.' : ''}
${queryType.type === 'casual' ? 'The user is asking a casual question. Be friendly and helpful. If they need more detailed analysis, offer to help.' : ''}

Keep your response to 1-3 sentences maximum. Be warm but concise.`;

    const response = await callClaude(quickSystemPrompt + '\n\nUser: ' + message, {
      model: 'claude-haiku-4-5-20251001',
      maxTokens: 256,
      apiKey: apiKey
    });

    if (response.success) {
      return response.content;
    }
    throw new Error(response.error || 'Failed to get response');
  }, [apiKey]);

  // Detect if a query warrants offering a detailed report
  const shouldOfferDetailedReport = useCallback((message) => {
    const lowerMsg = message.toLowerCase();
    const wordCount = message.split(/\s+/).length;

    // Direct report requests - always offer (e.g., "generate a report", "I'd like a report")
    const directReportPhrases = [
      'report', 'generate', 'create a', 'prepare a', 'put together',
      'chart', 'graph', 'visualization', 'visual'
    ];
    const isDirectReportRequest = directReportPhrases.some(phrase => lowerMsg.includes(phrase));
    if (isDirectReportRequest) {
      return true;
    }

    // Keywords that suggest the user wants deep analysis/advice
    const analysisKeywords = [
      'analyze', 'analysis', 'analyse', 'detailed', 'breakdown',
      'compare', 'comparison', 'assess', 'assessment', 'evaluate',
      'should i', 'would it be', 'is it worth', 'can i afford',
      'what would', 'what if', 'pros and cons', 'advantages', 'disadvantages',
      'recommend', 'advice', 'advise', 'suggestion', 'options',
      'plan', 'planning', 'strategy', 'forecast', 'projection', 'budget',
      'purchase', 'buy', 'invest', 'investment', 'hire', 'hiring',
      'premises', 'property', 'equipment', 'expansion',
      'financing', 'loan', 'mortgage', 'pitfalls', 'efficiently',
      'trends', 'trend', 'over time', 'year over year', 'monthly'
    ];

    // Check for analysis keywords
    const hasAnalysisKeyword = analysisKeywords.some(keyword => lowerMsg.includes(keyword));

    // Offer report for messages with analysis keywords (5+ words to avoid false positives)
    // OR very long messages (40+ words) that clearly need deep analysis
    return (wordCount >= 5 && hasAnalysisKeyword) || wordCount >= 40;
  }, []);

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
      'transactions': 'The user is viewing the Transactions list where they can see and categorize individual transactions.',
      'export': 'The user is on the Export/Reports page.',
      'gms-panel': 'The user is viewing the GMS Panel Analysis page with PCRS payment breakdowns.',
      'gms-health-check': 'The user is viewing the GMS Health Check Report. They can see all the recommendations, unclaimed income analysis, and growth opportunities displayed on their screen. When they ask about "the report" or "these recommendations", they are referring to the GMS Health Check data shown below.',
      'admin': 'The user is on the Admin/Settings page.'
    };
    return pageDescriptions[currentView] || 'The user is using the Sláinte Finance app.';
  }, [currentView]);

  // Handle substantive queries - provide quick answer + offer detailed report
  const handleSubstantiveQuery = useCallback(async (message, financialContext) => {
    const practiceContext = getCiaranContext();
    const gmsContext = buildGMSHealthCheckContext();
    const conversationHistory = getRecentConversationHistory();
    const pageContext = getPageContextDescription();

    // Determine if we should offer a detailed report
    const offerReport = shouldOfferDetailedReport(message);

    // Check if we have a recent report to reference
    const reportContext = lastGeneratedReport ? `
**RECENT REPORT GENERATED:** "${lastGeneratedReport.title}"
(User may be asking follow-up questions about this report)` : '';

    // Build expense breakdown string (use most recent year data)
    const expenseBreakdown = financialContext.topExpenseCategories.length > 0
      ? financialContext.topExpenseCategories.map((cat, i) => `${cat.name}: €${cat.value.toLocaleString()}`).join(', ')
      : 'No expense data available';

    // Build income breakdown string
    const incomeBreakdown = financialContext.topIncomeCategories.length > 0
      ? financialContext.topIncomeCategories.map((cat, i) => `${cat.name}: €${cat.value.toLocaleString()}`).join(', ')
      : 'No income data available';

    // Build last 12 months expense breakdown
    const last12MonthsExpenses = financialContext.last12Months?.topExpenseCategories?.length > 0
      ? financialContext.last12Months.topExpenseCategories.map((cat) => `${cat.name}: €${cat.value.toLocaleString()}`).join(', ')
      : expenseBreakdown; // Fallback to year data

    // Build GMS-specific section for health check page
    const gmsSection = (currentView === 'gms-health-check' && gmsContext) ? `
**GMS HEALTH CHECK REPORT (currently displayed to user):**
${gmsContext}
` : (gmsContext ? `
**GMS Health Check Summary:**
${gmsContext}
` : '');

    // System prompt for quick but helpful response
    const systemPrompt = `You are Finn, a professional Irish financial advisor for GP practices.

**CRITICAL: KEEP YOUR RESPONSE SHORT** - Maximum 3-4 sentences. This is a chat widget, not a report.

${offerReport ? `The user's question is complex. Give a BRIEF initial take (2-3 sentences max), then the user can click a button to get a detailed report.` : 'Give a helpful but concise answer.'}

**CURRENT PAGE:** ${pageContext}

**Practice context:** ${practiceContext ? practiceContext.substring(0, 200) : 'Irish GP practice'}

**TODAY'S DATE:** ${financialContext.currentDate}
**DATA AVAILABLE:** ${financialContext.oldestDataDate} to ${financialContext.newestDataDate} (Years: ${financialContext.availableYears?.join(', ')})

**${financialContext.mostRecentYear} FINANCIAL DATA (most recent full year):**
- Total Income: €${financialContext.yearToDateIncome.toLocaleString()}
- Total Expenses: €${financialContext.yearToDateExpenses.toLocaleString()}
- Net Profit: €${financialContext.profit.toLocaleString()} (${financialContext.profitMargin}% margin)

**EXPENSE BREAKDOWN BY CATEGORY (${financialContext.mostRecentYear}):**
${expenseBreakdown}

**INCOME SOURCES (${financialContext.mostRecentYear}):**
${incomeBreakdown}

**LAST 12 MONTHS ROLLING DATA:**
- Income: €${financialContext.last12Months?.income?.toLocaleString() || 'N/A'}
- Expenses: €${financialContext.last12Months?.expenses?.toLocaleString() || 'N/A'}
- Expense Categories: ${last12MonthsExpenses}
${gmsSection}
${reportContext}

${conversationHistory ? `**RECENT CONVERSATION:**\n${conversationHistory}\n` : ''}

**RULES:**
1. MAXIMUM 3-4 sentences - this is a chat, not an essay
2. Be professional but approachable - you DO have access to their financial data, USE IT
3. Don't list multiple points or use headers
4. If the question is complex, just give your quick take - the detailed report button handles the rest
5. If this appears to be a follow-up to the conversation, respond in context
6. Never use emojis
7. NEVER say you don't have access to data - you have their full expense/income breakdown above
8. When user asks about "last 12 months" or "recent", use the LAST 12 MONTHS ROLLING DATA
9. Default to the most recent year data (${financialContext.mostRecentYear}), NOT older years
10. When user references "the report", "these figures", or "the recommendations" - refer to the CURRENT PAGE context and any GMS Health Check data provided above

User: ${message}`;

    const response = await callClaude(systemPrompt, {
      model: 'claude-haiku-4-5-20251001',
      maxTokens: 350,  // Keep inline responses short
      apiKey: apiKey
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to get response');
    }

    const content = response.content;

    return {
      content,
      offerDetailedReport: offerReport,
      reportContext: offerReport ? {
        originalQuestion: message,
        financialContext,
        practiceContext,
        gmsContext
      } : null
    };
  }, [apiKey, getCiaranContext, buildGMSHealthCheckContext, shouldOfferDetailedReport, getRecentConversationHistory, lastGeneratedReport, getPageContextDescription, currentView]);

  // Add assistant message to chat
  const addAssistantMessage = useCallback((content, offerDetailedReport = false, reportContext = null, isError = false) => {
    const assistantMsg = {
      type: 'assistant',
      content,
      timestamp: new Date().toISOString(),
      id: `assistant-${Date.now()}`,
      isError,
      offerDetailedReport,
      reportContext
    };

    setMessages(prev => [...prev, assistantMsg]);

    if (currentChatId) {
      chatStorage.addMessage(currentChatId, assistantMsg);
    }

    if (offerDetailedReport && reportContext) {
      setPendingReportOffer(reportContext);
    }
  }, [currentChatId]);

  // Analyze if clarifying questions would improve the report
  const analyzeForClarifications = useCallback(async (context) => {
    const { originalQuestion, financialContext, practiceContext } = context;

    const analysisPrompt = `You are Finn, a financial advisor. Before generating a detailed report, you need to determine if any clarifying questions would significantly improve the report quality.

**USER'S QUESTION:**
${originalQuestion}

**PRACTICE CONTEXT:**
${practiceContext || 'Irish GP practice'}

**FINANCIAL DATA AVAILABLE:**
- Income: €${financialContext.yearToDateIncome.toLocaleString()}
- Expenses: €${financialContext.yearToDateExpenses.toLocaleString()}
- Top expense categories: ${financialContext.topExpenseCategories.map(c => c.name).join(', ')}

**YOUR TASK:**
Analyze if there are 1-2 clarifying questions that would SIGNIFICANTLY improve the report. Only ask questions if:
1. The answer would materially change your recommendations
2. The data shows something ambiguous that needs explanation (e.g., unclear category names, unusual patterns)
3. The question involves a decision that depends on user preferences

DO NOT ask questions about:
- Things you can reasonably infer from the data
- General background information
- Things that would only marginally improve the report

**RESPOND IN THIS EXACT JSON FORMAT:**
{
  "needsClarification": true/false,
  "questions": [
    {
      "id": "q1",
      "question": "The question text here?",
      "reason": "Brief explanation of why this matters for the report",
      "placeholder": "Example answer format"
    }
  ]
}

If no clarification needed, respond with:
{"needsClarification": false, "questions": []}

Maximum 2 questions. Keep questions specific and answerable in one sentence.`;

    try {
      const response = await callClaude(analysisPrompt, {
        model: 'claude-haiku-4-5-20251001',
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

    // Clear any pending clarifications
    setPendingReportOffer(null);

    // If not skipping clarification and no clarifications provided, check if we need them
    if (!skipClarification && !context.clarifications) {
      // Show "analyzing" message
      addAssistantMessage(
        "Let me analyze your question to see if I need any clarifications before generating the report...",
        false,
        null
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

    // Add "working on it" message
    addAssistantMessage(
      "I'll work on that detailed report now. Feel free to continue using the app - I'll let you know when it's ready.",
      false,
      null
    );

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

  // Generate detailed report using Sonnet
  const generateDetailedReport = useCallback(async (context) => {
    const { originalQuestion, financialContext, practiceContext, gmsContext, clarifications } = context;

    const systemPrompt = `You are Finn, an expert financial advisor for Irish GP practices. Create a CONCISE, professional report.

**CRITICAL FORMATTING RULES:**
1. **MAXIMUM 1,200 WORDS** - GPs are busy. Be concise. Every sentence must add value.
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

**PRACTICE CONTEXT:**
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

**IMPORTANT:** When user asks about "last 12 months", "recent data", or similar, use the LAST 12 MONTHS ROLLING DATA section. Default to ${financialContext.mostRecentYear} data for general queries.

**USER'S ORIGINAL QUESTION:**
${originalQuestion}

${clarifications ? `**USER'S CLARIFICATIONS:**\n${clarifications}\n` : ''}

**REPORT STRUCTURE:**
Use the <artifact> tag format. Keep it tight and actionable:

<artifact title="Report Title Here" type="report">
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

</artifact>

After the artifact, add 1 sentence offering to clarify or explore specific aspects.`;

    // Get internal token for API call
    let token = null;
    if (window.electronAPI?.isElectron) {
      token = await window.electronAPI.getInternalToken();
    } else {
      // Fallback for non-Electron (e.g., web dev)
      token = localStorage.getItem('partner_token');
    }

    if (!token) {
      console.error('[Finn] No authentication token available');
      throw new Error('Authentication required');
    }

    console.log('[Finn] Starting detailed report generation...');

    const response = await fetch("http://localhost:3001/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        message: JSON.stringify({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 4096,
          messages: [
            { role: "user", content: systemPrompt }
          ]
        })
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Finn] API error:', response.status, errorText);
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
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
        originalQuestion
      };
    }

    // Fallback if no artifact tags
    return {
      title: 'Financial Analysis Report',
      type: 'report',
      content: reportContent,
      originalQuestion
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
        model: 'claude-sonnet-4-5-20250929'
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

    addAssistantMessage('Report cancelled.', false, null);
  }, [addAssistantMessage]);

  // Start a new chat
  const startNewChat = useCallback(() => {
    const newChat = chatStorage.createChat();
    setCurrentChatId(newChat.id);
    setMessages([]);
    setPendingReportOffer(null);
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

    // Background task
    backgroundTask,
    startBackgroundReport,
    cancelBackgroundTask,
    pendingReportOffer,
    setPendingReportOffer,

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
    hasData: transactions.length > 0
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

export default FinnContext;

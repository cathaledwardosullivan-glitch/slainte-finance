import React, { createContext, useState, useEffect, useContext, useRef, useCallback } from 'react';
import { useAppContext } from './AppContext';
import { usePracticeProfile } from '../hooks/usePracticeProfile';
import { chatStorage } from '../storage/chatStorage';
import { callClaude, callClaudeWithTools } from '../utils/claudeAPI';
import { parseArtifactResponse, createArtifact } from '../utils/artifactBuilder';
import { analyzeGMSIncome, generateRecommendations } from '../utils/healthCheckCalculations';
import { buildInteractiveGMSContext, buildAreaMetricsSummary } from '../utils/gmsHealthCheckContext';
import { MODELS } from '../data/modelConfig';
import { isAppHelpQuestion, buildAppKnowledgeContext } from '../utils/appContextBuilder';
import { get as getProfileFromStorage, getOverdueActions, getActiveFinancialTasks, getActionsDueSoon, createFinancialTask, addFinancialTask, addActionItem } from '../storage/practiceProfileStorage';
import { buildCiaranContext } from '../utils/ciaranContextBuilder';
import { isDemoMode, getDemoApiKey } from '../utils/demoMode';
import { GROUPS } from '../utils/categorizationEngine';
import { isLANMode } from '../hooks/useLANMode';
import { SUGGESTED_ANALYSES } from '../data/suggestedAnalyses';
import { getContactInfo } from '../data/contactDirectory';
import {
  buildSimpleTransactionsCSV, buildDetailedTransactionsCSV,
  buildPCRSSummaryCSV, buildPaymentOverviewCSV,
  buildPLReportCSV, buildAndDownloadAccountantPackZIP, downloadBlob
} from '../utils/exportUtils';

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
    description: 'Navigate to a page, section, or modal in Sláinte Finance, create a task, create a new category, review staged transactions, or trigger a file export/download. Use when the user wants to go somewhere, open something, add a task, create a category, or download data. Use "tasks:create" to create a task — provide just the title and description, then the Tasks panel will open for the user to set assignee, due date, and priority. IMPORTANT: Always describe the proposed task to the user and get their confirmation BEFORE calling with tasks:create. Use "categories:create" to create a new expense/income category — provide categoryData with name, type, and section. IMPORTANT: Always describe the proposed category to the user and get their confirmation BEFORE calling with categories:create. After creating a category, you can immediately recategorize matching transactions using search_transactions with action="recategorize". Use "staged:review" to review background-processed bank statements — provide stagedReviewData with stagedId and action. REVIEW FLOW: First call with action "review" to get the full picture, then "apply-auto" for high-confidence transactions, then present review clusters to the user one round at a time (largest clusters first). For each cluster the user categorises, call "apply-cluster" with the category. Between rounds call "rescore" to cascade the user\'s answers. Stop presenting clusters when the largest has fewer than 5 members and offer "apply-remaining". EXPORT RULE: When the user says "export", "download", "give me", or "send me" a data file (transactions CSV, PCRS summary, payment overview, accountant pack), use the matching "export:*" target for an instant download. EXCEPTION — P&L REPORTS: For P&L requests, navigate to "reports" instead of using "export:pl-draft", because the Reports panel lets the user choose the year and flags incomplete items like motor expenses and depreciation. Only use "export:pl-draft" if the user specifically asks for a quick/draft/raw P&L data extract.',
    input_schema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          enum: [
            'finances-overview', 'gms-overview', 'gms-health-check',
            'gms-health-check:leave', 'gms-health-check:practiceSupport',
            'gms-health-check:capitation', 'gms-health-check:cervicalCheck',
            'gms-health-check:stc', 'gms-health-check:cdm',
            'advanced-insights',
            'advanced-insights:overview', 'advanced-insights:gms',
            'advanced-insights:growth', 'advanced-insights:costs', 'advanced-insights:tax',
            'settings', 'transactions', 'reports', 'pcrs-downloader',
            'settings:profile', 'settings:data', 'settings:categories',
            'settings:backup', 'settings:privacy',
            'tasks:create', 'categories:create', 'staged:review',
            'export:transactions-simple', 'export:transactions-detailed',
            'export:pcrs-summary', 'export:payment-overview',
            'export:pl-draft', 'export:accountant-pack'
          ],
          description: 'The page or section to navigate to. "reports" opens the Reports panel where the user can generate a proper P&L report (with year selection, motor expenses, depreciation flags) — use this for P&L requests. "finances-overview" opens the Financial Dashboard. "gms-health-check" opens the GMS Health Check. "pcrs-downloader" opens the PCRS statement downloader. "advanced-insights" opens the Advanced Insights tab. "advanced-insights:overview/gms/growth/costs/tax" opens a specific Advanced Insights category. "tasks:create" creates a new task (requires taskData). "categories:create" creates a new expense/income category (requires categoryData) — use when the user wants a category that doesn\'t exist yet. "staged:review" reviews background-processed bank statements (requires stagedReviewData with stagedId and action) — use when there are staged transactions to review. FILE DOWNLOADS (instant): "export:transactions-simple" downloads simplified transaction CSV. "export:transactions-detailed" downloads full transaction CSV with categories. "export:pcrs-summary" downloads PCRS payment summary CSV. "export:payment-overview" downloads monthly payment breakdown CSV. "export:pl-draft" downloads a quick draft P&L CSV (raw data only — no motor expenses or depreciation, use only when user explicitly wants a quick/draft extract). "export:accountant-pack" downloads all exports bundled as ZIP.'
        },
        taskData: {
          type: 'object',
          description: 'Only used when target is "tasks:create". Defines the task to create. Finn creates the task with title and description, then opens the Tasks panel for the user to assign, set due date, and prioritize.',
          properties: {
            title: { type: 'string', description: 'Short task title (max 80 chars)' },
            description: { type: 'string', description: 'Detailed description of what needs to be done' },
            taskType: { type: 'string', enum: ['financial', 'gms'], description: 'Use "gms" for GMS/PCRS/Health Check related tasks, "financial" for everything else. Default: "financial".' },
            category: { type: 'string', description: 'Task category (e.g. "reporting", "transactions", "upload", "follow-up", "general", or a GMS area like "Practice Support", "Capitation")' }
          }
        },
        categoryData: {
          type: 'object',
          description: 'Only used when target is "categories:create". Defines the new category. IMPORTANT: Always describe the proposed category (name, section, identifiers) to the user and get their confirmation BEFORE calling. When the correct section is ambiguous, explain your reasoning and offer the most likely alternative — e.g. "This sounds like Medical Supplies (dispensing costs) — or would Professional Fees be more appropriate?" Only proceed after the user confirms. GP practice section guidance: Revenue payments (PAYE/PRSI/USC) → DIRECT STAFF COSTS. Locum fees → DIRECT STAFF COSTS. Professional indemnity → PROFESSIONAL DEV. Cleaning → PREMISES COSTS. Software subscriptions → OFFICE & IT. Bank charges → PROFESSIONAL FEES.',
          properties: {
            name: { type: 'string', description: 'Category display name (e.g. "Payments to Revenue")' },
            type: { type: 'string', enum: ['income', 'expense', 'non-business'], description: 'Category type' },
            section: {
              type: 'string',
              enum: [
                'INCOME', 'DIRECT STAFF COSTS', 'MEDICAL SUPPLIES',
                'PREMISES COSTS', 'OFFICE & IT', 'PROFESSIONAL FEES',
                'PROFESSIONAL DEV', 'MOTOR & TRANSPORT',
                'PETTY CASH / OTHER EXPENSES', 'CAPITAL & DEPRECIATION', 'NON-BUSINESS'
              ],
              description: 'The P&L section this category belongs to. Must be one of the 11 fixed sections.'
            },
            identifiers: {
              type: 'array',
              items: { type: 'string' },
              description: 'Keywords that auto-match transactions to this category (e.g. ["REVENUE COMMISSIONERS"])'
            },
            accountantLine: {
              type: 'string',
              description: 'P&L reporting line for the accountant (e.g. "Employer\'s PRSI & PAYE", "Staff costs")'
            }
          }
        },
        stagedReviewData: {
          type: 'object',
          description: 'Only used when target is "staged:review". Controls the conversational review of background-processed bank statements. Two-pass system: Pass 1 assigns GROUPS (10 options like Staff Costs, Premises, Income), Pass 2 assigns specific CATEGORIES within confirmed groups (6-10 options per group). Use "review" to fetch staged data. Use "apply-auto" to bulk-apply all auto-grouped and AI-grouped transactions. Use "apply-cluster" with groupCode to assign a group (Pass 1) or categoryCode to assign a category (Pass 2). Use "categorise" to trigger Pass 2 category assignment on grouped-but-uncategorised transactions — this runs AI analysis and opens the category review panel. Use "rescore" after applying clusters to cascade answers. Use "apply-remaining" to finish.',
          properties: {
            stagedId: { type: 'string', description: 'The staged result ID to review (from staged_results lookup), or "applied" to run category assignment on already-imported transactions' },
            action: {
              type: 'string',
              enum: ['review', 'apply-auto', 'apply-cluster', 'categorise', 'rescore', 'apply-remaining'],
              description: 'The review action to perform. Pass 1 flow: "review" → "apply-auto" → "apply-cluster" with groupCode → "rescore" → "apply-remaining". Pass 2 flow: "categorise" (triggers AI category assignment) → then "apply-cluster" with categoryCode for items needing review. Use "categorise" when the user wants detailed categories assigned (e.g. for P&L reports).'
            },
            clusterIndex: { type: 'number', description: 'For apply-cluster: the 0-based index of the cluster to apply (from the reviewClusters array)' },
            groupCode: { type: 'string', description: 'For apply-cluster (Pass 1): the group code to assign (INCOME, STAFF, PREMISES, MEDICAL, OFFICE, PROFESSIONAL, MOTOR, OTHER, NON_BUSINESS)' },
            categoryCode: { type: 'string', description: 'For apply-cluster (Pass 2/legacy): the category code to assign to all cluster members' },
            categoryName: { type: 'string', description: 'For apply-cluster (Pass 2/legacy): the category name' }
          }
        }
      },
      required: ['target']
    }
  },
  {
    name: 'lookup_financial_data',
    description: 'Look up specific financial data points from the practice\'s records. Use this to answer questions about income, expenses, profit, categories, trends, or transaction counts instead of guessing. Use "system_status" to check what needs attention — stale data, uncategorised transactions, overdue tasks, staged transactions. Use "staged_results" for details on background-processed bank statements awaiting review.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          enum: [
            'total_income', 'total_expenses', 'profit', 'profit_margin',
            'top_expenses', 'top_income', 'gms_payments', 'uncategorized_count',
            'monthly_trends', 'transaction_count', 'available_years', 'expense_breakdown', 'income_breakdown',
            'system_status', 'staged_results'
          ],
          description: 'The data point to retrieve. Use "system_status" to check for stale data, uncategorised transactions, overdue tasks, and other items needing attention. Use "staged_results" for details on background-processed bank statements awaiting review.'
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
    description: 'Search and filter individual transactions by category, date, amount, or description text. Use this when the user asks about spending on a specific item, category, or time period — e.g. "how much did we spend on uniforms" or "show me transactions over €5000". Can also BULK RECATEGORIZE matching transactions when action is "recategorize". IMPORTANT: For recategorize, you MUST first call with action "list" (or omit action) to show the user exactly what will be changed and the target category, then get their explicit confirmation BEFORE calling again with action "recategorize". Never recategorize without confirmation.',
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
        },
        action: {
          type: 'string',
          enum: ['list', 'recategorize'],
          description: 'Action to perform on matched transactions. "list" (default) returns matching transactions. "recategorize" changes the category of ALL matching transactions to newCategory — REQUIRES prior user confirmation.'
        },
        newCategory: {
          type: 'string',
          description: 'Only for action "recategorize". The target category name (matched against available categories, case-insensitive). Must match exactly one category.'
        }
      }
    }
  },
  {
    name: 'generate_report',
    description: 'Generate a CUSTOM AI advisory report or draft a communication. ONLY use for open-ended advisory questions like "Should I hire a nurse?", or for drafting emails/letters when the user wants to contact someone about a financial matter (e.g. "draft an email to PCRS about our unclaimed hours"). Do NOT use for standard reports (P&L, Balance Sheet, Partner Capital Accounts, GMS Health Check, Tax Return) — those have pre-built tools in the app and should be navigated to instead. Use reportType "communication_draft" ONLY when the user explicitly wants an email, letter, or formal correspondence drafted.',
    input_schema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'The custom advisory question or communication topic — e.g. "Should we hire a nurse?", "Draft an email to PCRS about unclaimed Practice Support hours"'
        },
        reportType: {
          type: 'string',
          enum: ['standard', 'strategic', 'communication_draft'],
          description: 'Use "standard" for data analysis. Use "strategic" for forward-looking advisory/planning/business decisions. Use "communication_draft" for emails, letters, or formal correspondence.'
        },
        recipient: {
          type: 'string',
          description: 'Only for communication_draft. Who the communication is addressed to — e.g. "PCRS", "HSE", "accountant", "Revenue". Used to look up contact details.'
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
    name: 'lookup_available_analyses',
    description: 'Look up pre-defined analysis reports available in the Advanced Insights tab. Use BEFORE generate_report to check if a curated analysis matches the user\'s question. Pre-defined analyses produce significantly better reports than freeform generation.',
    input_schema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['all', 'overview', 'gms', 'growth', 'costs', 'tax'],
          description: 'Filter by category, or "all" to see everything'
        }
      }
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
  },
  {
    name: 'lookup_gms_metrics',
    description: 'Look up GMS Health Check analysis metrics for a specific area or overall summary. Use when the user asks about GMS payments, PCRS income, leave entitlements, practice support subsidies, capitation, cervical screening, STC procedures, or chronic disease management.',
    input_schema: {
      type: 'object',
      properties: {
        area: {
          type: 'string',
          enum: ['summary', 'leave', 'practiceSupport', 'capitation', 'cervicalCheck', 'stc', 'cdm'],
          description: 'Which GMS area to look up. Use "summary" for an overall view across all areas.'
        },
        detail_level: {
          type: 'string',
          enum: ['headline', 'detailed'],
          description: 'headline = key figures only; detailed = full breakdowns and recommendations. Default headline.'
        }
      },
      required: ['area']
    }
  }
];

// Max tool-use rounds before giving up (safety limit)
const MAX_TOOL_ROUNDS = 5;

// Tool subset for report Q&A — data lookup only, no navigation/generation
const REPORT_QA_TOOLS = FINN_TOOLS.filter(t =>
  ['lookup_financial_data', 'search_transactions', 'lookup_saved_reports', 'lookup_gms_metrics'].includes(t.name)
);
const MAX_QA_TOOL_ROUNDS = 3;

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
    setTransactions,
    unidentifiedTransactions,
    selectedYear,
    categoryMapping,
    setCategoryMapping,
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
  const lastCreatedCategoryRef = useRef(null); // For immediate recategorize after category creation
  const stagedResultsListenerRef = useRef(false); // Track if background processor listener is set up
  const stagedDetailCacheRef = useRef({}); // Cache staged detail between tool calls in same agentic loop

  // Background processor staged results (cached for synchronous access in system_status)
  const [stagedResults, setStagedResults] = useState([]);

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

      // In demo mode, use the TTL-protected demo key
      if (isDemoMode()) {
        savedKey = getDemoApiKey();
      } else if (window.electronAPI?.isElectron) {
        // Check Electron storage first (preferred)
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

  // Proactive greeting: when widget opens with empty chat, check system status and nudge
  const prevIsOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      // Only nudge if: empty chat, has API key, not local-only, has data
      if (messages.length === 0 && apiKey && !localOnlyMode && transactions.length > 0) {
        // 4-hour cooldown to avoid nagging
        const lastNudge = localStorage.getItem('finn_last_proactive_nudge');
        const COOLDOWN_MS = 4 * 60 * 60 * 1000;
        const now = Date.now();
        if (lastNudge && (now - parseInt(lastNudge)) < COOLDOWN_MS) {
          prevIsOpenRef.current = isOpen;
          return;
        }

        // Run system status check (synchronous, no API call)
        const status = lookupDataPoint('system_status');
        if (status.statusItems && status.statusItems.length > 0) {
          const nudgeContext = JSON.stringify(status.statusItems.slice(0, 3));
          callClaude(
            `You are Finn, a professional Irish financial advisor for GP practices. Based on the following system status items, write a brief 1-2 sentence greeting that naturally mentions the most important item. Be helpful, not nagging. Do NOT list all items — pick the single most actionable one. Do NOT use emojis. Use professional language — no slang or colloquialisms.\n\nStatus: ${nudgeContext}`,
            { model: MODELS.FAST, maxTokens: 150, apiKey }
          ).then(response => {
            if (response && response.content) {
              const content = typeof response.content === 'string'
                ? response.content
                : Array.isArray(response.content)
                  ? response.content.filter(b => b.type === 'text').map(b => b.text).join('')
                  : '';
              if (content) {
                addAssistantMessage(content);
                localStorage.setItem('finn_last_proactive_nudge', now.toString());
              }
            }
          }).catch(() => {
            // Silent fail — nudge is non-critical
          });
        }
      }
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Background processor: fetch staged results on mount + listen for real-time updates
  useEffect(() => {
    if (!window.electronAPI?.backgroundProcessor || stagedResultsListenerRef.current) return;
    stagedResultsListenerRef.current = true;

    // Initial fetch — pick up anything processed before this session
    window.electronAPI.backgroundProcessor.getStagedResults().then(results => {
      if (results && results.length > 0) {
        setStagedResults(results);
      }
    }).catch(() => {});

    // Real-time listener — file just finished processing
    window.electronAPI.backgroundProcessor.onResultsReady((data) => {
      // Refresh the full staged results list
      window.electronAPI.backgroundProcessor.getStagedResults().then(results => {
        setStagedResults(results || []);
      }).catch(() => {});

      // Open Finn and tell the user
      setIsOpen(true);
      const { id: stagedId, sourceFile, summary, duplicateCount } = data;
      const newCount = summary.totalTransactions - duplicateCount;
      let msg;
      let showReviewAction = false;
      if (duplicateCount > 0 && newCount === 0) {
        msg = `I processed "${sourceFile}" but all ${summary.totalTransactions} transactions are duplicates of ones you've already imported. Nothing new to add.`;
      } else if (duplicateCount > 0) {
        msg = `I just finished processing "${sourceFile}" — ${summary.totalTransactions} transactions found, ${duplicateCount} are duplicates I'll skip. ` +
          `Of the ${newCount} new ones, ${summary.auto - duplicateCount} categorised automatically` +
          (summary.review > 0 ? ` and ${summary.review} ${summary.review === 1 ? 'needs' : 'need'} your input` : '') +
          `.`;
        showReviewAction = true;
      } else {
        msg = `I just finished processing "${sourceFile}" — ${summary.totalTransactions} transactions found, ` +
          `${summary.auto} categorised automatically` +
          (summary.review > 0 ? ` and ${summary.review} ${summary.review === 1 ? 'needs' : 'need'} your input` : '') +
          `.`;
        showReviewAction = true;
      }
      // Small delay so the panel has time to open before message appears
      const extras = showReviewAction ? { action: { type: 'review_staged', label: 'Review Transactions', stagedId } } : {};
      setTimeout(() => addAssistantMessage(msg, false, extras), 300);
    });

    return () => {
      if (window.electronAPI?.backgroundProcessor) {
        window.electronAPI.backgroundProcessor.removeListeners();
      }
      stagedResultsListenerRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Listen for Finn-triggered file exports
  useEffect(() => {
    const handleExport = async (e) => {
      const { exportType, year } = e.detail;
      try {
        const yearTxns = transactions.filter(t => t.date && new Date(t.date).getFullYear() === year);
        const yearPCRS = paymentAnalysisData.filter(p => parseInt(p.year) === year);

        switch (exportType) {
          case 'transactions-simple': {
            const { content, filename } = buildSimpleTransactionsCSV(yearTxns, year);
            downloadBlob(content, filename, 'text/csv');
            break;
          }
          case 'transactions-detailed': {
            const { content, filename } = buildDetailedTransactionsCSV(yearTxns, year);
            downloadBlob(content, filename, 'text/csv');
            break;
          }
          case 'pcrs-summary': {
            const { content, filename } = buildPCRSSummaryCSV(yearPCRS, year);
            downloadBlob(content, filename, 'text/csv');
            break;
          }
          case 'payment-overview': {
            const { content, filename } = buildPaymentOverviewCSV(yearPCRS, year);
            downloadBlob(content, filename, 'text/csv');
            break;
          }
          case 'pl-draft': {
            const { content, filename } = buildPLReportCSV(yearTxns, year);
            downloadBlob(content, filename, 'text/csv');
            break;
          }
          case 'accountant-pack': {
            await buildAndDownloadAccountantPackZIP(yearTxns, yearPCRS, year);
            break;
          }
        }
      } catch (err) {
        console.error('[Finn] Export failed:', err);
      }
    };

    window.addEventListener('finn:export', handleExport);
    return () => window.removeEventListener('finn:export', handleExport);
  }, [transactions, paymentAnalysisData]);

  // Load saved reports from localStorage
  const loadSavedReports = useCallback(() => {
    let reports = JSON.parse(localStorage.getItem('gp_finance_saved_reports') || '[]');
    // Handle storageUtils wrapper format { data, timestamp, version }
    if (reports && !Array.isArray(reports) && Array.isArray(reports.data)) {
      reports = reports.data;
    }
    if (!Array.isArray(reports)) reports = [];
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

        // Monthly breakdown — derive month from t.date (not t.monthYear which can be null)
        if (t.date) {
          const d = new Date(t.date);
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const monthKey = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
          if (!monthlyBreakdown[monthKey]) {
            monthlyBreakdown[monthKey] = { month: monthKey, income: 0, expenses: 0 };
          }
          if (t.category?.type === 'income') {
            monthlyBreakdown[monthKey].income += amount;
          } else if (t.category?.type === 'expense' || t.category?.type === 'drawings') {
            monthlyBreakdown[monthKey].expenses += amount;
          }
        }
      });

      // Full sorted lists (for reports that need complete data)
      const allExpenseCategories = Object.values(categoryBreakdown)
        .filter(c => c.type === 'expense')
        .sort((a, b) => b.value - a.value);
      const allIncomeCategories = Object.values(categoryBreakdown)
        .filter(c => c.type === 'income')
        .sort((a, b) => b.value - a.value);

      // Top-N for backward compatibility (Finn chat uses these)
      const topExpenseCategories = allExpenseCategories.slice(0, 10);
      const topIncomeCategories = allIncomeCategories.slice(0, 5);

      return {
        income,
        expenses,
        drawings,
        profit: income - expenses - drawings,
        profitMargin: income > 0 ? ((income - expenses - drawings) / income * 100).toFixed(1) : 0,
        topExpenseCategories,
        topIncomeCategories,
        allExpenseCategories,
        allIncomeCategories,
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
      allExpenseCategories: recentYearSummary.allExpenseCategories,
      allIncomeCategories: recentYearSummary.allIncomeCategories,
      monthlyTrends: recentYearSummary.monthlyTrends,

      // Last 12 months rolling data (for "last 12 months" queries)
      last12Months: {
        income: last12MonthsSummary.income,
        expenses: last12MonthsSummary.expenses,
        profit: last12MonthsSummary.profit,
        profitMargin: last12MonthsSummary.profitMargin,
        topExpenseCategories: last12MonthsSummary.topExpenseCategories,
        topIncomeCategories: last12MonthsSummary.topIncomeCategories,
        allExpenseCategories: last12MonthsSummary.allExpenseCategories,
        allIncomeCategories: last12MonthsSummary.allIncomeCategories,
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

  // Build a lean financial summary for report Q&A (compact awareness of what data exists)
  const buildLeanFinancialSummary = useCallback(() => {
    const fc = getFinancialContext();
    const incomeCount = fc.allIncomeCategories?.length || fc.topIncomeCategories?.length || 0;
    const expenseCount = fc.allExpenseCategories?.length || fc.topExpenseCategories?.length || 0;

    let summary = `PRACTICE FINANCIAL SNAPSHOT (${fc.mostRecentYear}):
- Total Income: €${(fc.yearToDateIncome || 0).toLocaleString()} across ${incomeCount} income categories
- Total Expenses: €${(fc.yearToDateExpenses || 0).toLocaleString()} across ${expenseCount} expense categories
- Net Profit: €${(fc.profit || 0).toLocaleString()} (${fc.profitMargin || 0}% margin)
- Transactions: ${fc.totalTransactions || 0} (${fc.oldestDataDate || 'N/A'} to ${fc.newestDataDate || 'N/A'})
- Years with data: ${fc.availableYears?.join(', ') || 'Unknown'}`;

    if (fc.gmsPaymentData?.hasData) {
      summary += `\n- GMS/PCRS Data: Available (${fc.gmsPaymentData.availableYears?.join(', ') || 'unknown years'}), ${fc.gmsPaymentData.totalPayments || 0} statements`;
    }

    summary += `\n\nUse lookup_financial_data and search_transactions to access specific data. Do not guess — look it up.`;

    return summary;
  }, [getFinancialContext]);

  // Build GMS Health Check context - full or summary based on current view
  const buildGMSHealthCheckContext = useCallback((forceFullContext = false) => {
    // When forceFullContext is true (e.g. GMS Optimisation Summary report),
    // allow partial health check data through. Otherwise require full completion.
    if (!forceFullContext && !profile?.healthCheckData?.healthCheckComplete) {
      return '';
    }
    // Even with forceFullContext, we still need SOME health check data to work with
    if (!profile?.healthCheckData) {
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
        return { categories: financialContext.allExpenseCategories || financialContext.topExpenseCategories || [], year: financialContext.mostRecentYear };
      case 'income_breakdown':
        return { categories: financialContext.allIncomeCategories || financialContext.topIncomeCategories || [], year: financialContext.mostRecentYear };
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
      case 'staged_results': {
        if (stagedResults.length === 0) {
          return { hasStaged: false, message: 'No background-processed transactions waiting.' };
        }
        const totalTxns = stagedResults.reduce((sum, s) => sum + s.summary.totalTransactions, 0);
        const totalAuto = stagedResults.reduce((sum, s) => sum + s.summary.auto, 0);
        const totalGroupConfirmed = stagedResults.reduce((sum, s) => sum + (s.summary.groupConfirmed || 0), 0);
        const totalReview = stagedResults.reduce((sum, s) => sum + s.summary.review, 0);
        return {
          hasStaged: true,
          fileCount: stagedResults.length,
          files: stagedResults.map(s => ({
            id: s.id,
            sourceFile: s.sourceFile,
            processedAt: s.processedAt,
            totalTransactions: s.summary.totalTransactions,
            auto: s.summary.auto,
            groupConfirmed: s.summary.groupConfirmed || 0,
            review: s.summary.review,
            dateRange: s.summary.dateRange
          })),
          totalTransactions: totalTxns,
          totalAuto,
          totalGroupConfirmed,
          totalReview
        };
      }
      case 'system_status': {
        const statusItems = [];

        // 1. Stale data check
        const allDates = transactions.filter(t => t.date).map(t => new Date(t.date));
        if (allDates.length > 0) {
          const newestDate = new Date(Math.max(...allDates));
          const daysSince = Math.floor((new Date() - newestDate) / (1000 * 60 * 60 * 24));
          if (daysSince > 30) {
            statusItems.push({ type: 'stale_data', severity: 'high', message: `Transaction data is ${daysSince} days old`, daysSince });
          }
        } else {
          statusItems.push({ type: 'no_data', severity: 'high', message: 'No transaction data uploaded yet' });
        }

        // 2. Uncategorised transactions
        const uncatCount = unidentifiedTransactions.length;
        if (uncatCount > 0) {
          statusItems.push({ type: 'uncategorised', severity: uncatCount > 20 ? 'high' : 'medium', message: `${uncatCount} uncategorised transaction${uncatCount !== 1 ? 's' : ''}`, count: uncatCount });
        }

        // 3. Overdue GMS action items
        const overdueGMS = getOverdueActions();
        if (overdueGMS.length > 0) {
          statusItems.push({ type: 'overdue_gms_tasks', severity: 'high', message: `${overdueGMS.length} overdue GMS action item${overdueGMS.length !== 1 ? 's' : ''}`, tasks: overdueGMS.slice(0, 3).map(t => t.title) });
        }

        // 4. Overdue financial tasks
        const activeFinancial = getActiveFinancialTasks();
        const now = new Date();
        const overdueFinancial = activeFinancial.filter(t => t.dueDate && new Date(t.dueDate) < now);
        if (overdueFinancial.length > 0) {
          statusItems.push({ type: 'overdue_financial_tasks', severity: 'high', message: `${overdueFinancial.length} overdue financial task${overdueFinancial.length !== 1 ? 's' : ''}`, tasks: overdueFinancial.slice(0, 3).map(t => t.title) });
        }

        // 5. Tasks due soon (within 7 days)
        const dueSoon = getActionsDueSoon();
        if (dueSoon.length > 0) {
          statusItems.push({ type: 'tasks_due_soon', severity: 'medium', message: `${dueSoon.length} task${dueSoon.length !== 1 ? 's' : ''} due this week`, tasks: dueSoon.slice(0, 3).map(t => t.title) });
        }

        // 6. GMS Health Check available but not run
        if (paymentAnalysisData && paymentAnalysisData.length > 0) {
          const uniqueMonths = new Set(paymentAnalysisData.map(d => `${d.month}-${d.year}`)).size;
          const profile = getProfileFromStorage();
          if (uniqueMonths >= 12 && !profile?.healthCheckData?.healthCheckComplete) {
            statusItems.push({ type: 'gms_health_check_available', severity: 'medium', message: `${uniqueMonths} months of GMS data uploaded but Health Check not yet run` });
          }
        }

        // 7. Background-processed transactions awaiting review
        if (stagedResults.length > 0) {
          const totalTxns = stagedResults.reduce((sum, s) => sum + s.summary.totalTransactions, 0);
          const totalAuto = stagedResults.reduce((sum, s) => sum + s.summary.auto, 0);
          const totalGroupConf = stagedResults.reduce((sum, s) => sum + (s.summary.groupConfirmed || 0), 0);
          const totalReview = stagedResults.reduce((sum, s) => sum + s.summary.review, 0);
          statusItems.push({
            type: 'staged_transactions',
            severity: 'high',
            message: `${stagedResults.length} bank statement${stagedResults.length > 1 ? 's' : ''} processed — ${totalTxns} transactions (${totalAuto} auto-grouped, ${totalGroupConf} AI-grouped, ${totalReview} need group assignment)`,
            data: { fileCount: stagedResults.length, totalTxns, totalAuto, totalGroupConfirmed: totalGroupConf, totalReview }
          });
        }

        // 8. Grouped-but-uncategorised transactions (Pass 2 candidates)
        const groupedNoCat = transactions.filter(t =>
          t.suggestedGroup && t.groupConfirmed && !t.categoryCode
        ).length;
        if (groupedNoCat > 0) {
          statusItems.push({
            type: 'needs_category_assignment',
            severity: 'low',
            message: `${groupedNoCat} transactions have groups but no detailed categories. Use "categorise" action to assign categories for P&L reports.`,
            data: { count: groupedNoCat }
          });
        }

        const totalActive = activeFinancial.length + (getOverdueActions().length > 0 ? overdueGMS.length : 0);
        return {
          statusItems,
          totalActiveTaskCount: totalActive,
          hasHighSeverity: statusItems.some(s => s.severity === 'high'),
          allClear: statusItems.length === 0
        };
      }
      default:
        return { error: `Unknown query type: ${query}` };
    }
  }, [getFinancialContext, transactions, unidentifiedTransactions, paymentAnalysisData, stagedResults]);

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

    const action = input.action || 'list';

    // === RECATEGORIZE ACTION ===
    if (action === 'recategorize') {
      if (!input.newCategory) {
        return { success: false, error: 'newCategory is required for recategorize action.' };
      }
      if (totalCount === 0) {
        return { success: false, error: 'No transactions match the search criteria.' };
      }

      // Find matching category (partial match, case-insensitive)
      // Also check lastCreatedCategoryRef for categories created in the same tool-use loop (before React re-renders)
      const searchCat = input.newCategory.toLowerCase();
      let allCategories = categoryMapping;
      if (lastCreatedCategoryRef.current && !categoryMapping.find(c => c.code === lastCreatedCategoryRef.current.code)) {
        allCategories = [...categoryMapping, lastCreatedCategoryRef.current];
      }
      const matchingCategories = allCategories.filter(c =>
        c.name.toLowerCase().includes(searchCat)
      );

      if (matchingCategories.length === 0) {
        return {
          success: false,
          error: `No category found matching "${input.newCategory}". Some available categories: ${categoryMapping.slice(0, 10).map(c => c.name).join(', ')}...`
        };
      }

      // If multiple matches, try exact match first
      let targetCategory;
      if (matchingCategories.length === 1) {
        targetCategory = matchingCategories[0];
      } else {
        const exact = matchingCategories.find(c => c.name.toLowerCase() === searchCat);
        if (exact) {
          targetCategory = exact;
        } else {
          return {
            success: false,
            error: `Multiple categories match "${input.newCategory}": ${matchingCategories.map(c => c.name).join(', ')}. Please be more specific.`
          };
        }
      }

      const matchedIds = new Set(results.map(t => t.id));

      // Apply recategorization via setTransactions
      setTransactions(prev => prev.map(t => {
        if (!matchedIds.has(t.id)) return t;
        return {
          ...t,
          category: { code: targetCategory.code, name: targetCategory.name, type: targetCategory.type, section: targetCategory.section },
          categoryCode: targetCategory.code,
          categoryName: targetCategory.name,
          categoryMatchType: 'finn-bulk',
          categoryReviewed: true,
          categoryCohort: 'auto'
        };
      }));

      return {
        success: true,
        action: 'recategorize',
        message: `Successfully recategorized ${totalCount} transaction${totalCount !== 1 ? 's' : ''} to "${targetCategory.name}".`,
        count: totalCount,
        newCategory: targetCategory.name,
        totalAmount: `€${totalAmount.toLocaleString('en-IE', { minimumFractionDigits: 2 })}`
      };
    }

    // === DEFAULT LIST ACTION ===
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
  }, [transactions, categoryMapping, setTransactions]);

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
  const executeToolAction = useCallback(async (toolName, input) => {
    switch (toolName) {
      case 'navigate': {
        const target = input.target;

        // Task creation
        if (target === 'tasks:create') {
          if (isLANMode()) {
            return { success: false, message: 'Task creation is only available on the desktop app.' };
          }
          const data = input.taskData;
          if (!data || !data.title) {
            return { success: false, message: 'Task title is required.' };
          }

          const isGMS = data.taskType === 'gms';
          let taskId;

          if (isGMS) {
            // Create GMS action item
            const now = new Date();
            const gmsTask = {
              id: `action_${now.getTime()}_${Math.random().toString(36).substr(2, 9)}`,
              recommendationId: null,
              title: data.title.slice(0, 80),
              description: data.description || '',
              category: data.category || 'General',
              type: 'priority',
              potentialValue: 0,
              effort: 'Medium',
              assignedTo: null,
              status: 'pending',
              dueDate: null,
              createdDate: now.toISOString(),
              completedDate: null,
              notes: '',
              showOnDashboard: true
            };
            addActionItem(gmsTask);
            taskId = gmsTask.id;
          } else {
            // Create financial task
            const task = createFinancialTask({
              title: data.title.slice(0, 80),
              description: data.description || '',
              category: data.category || 'general',
              priority: 'medium',
              dueDate: null,
              autoGenerated: false,
              metadata: { createdBy: 'finn' }
            });
            addFinancialTask(task);
            taskId = task.id;
          }

          // Refresh tasks, open widget, highlight the new task, then open the modal for editing
          window.dispatchEvent(new CustomEvent('tasks:refresh'));
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('tasks:openAndHighlight', {
              detail: { taskId, expandSection: isGMS ? 'gms' : 'financial' }
            }));
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent(
                isGMS ? 'tasks:openGMSModal' : 'tasks:openFinancialModal',
                { detail: { editTaskId: taskId } }
              ));
            }, 300);
          }, 100);

          return {
            success: true,
            message: `Task created: "${data.title}". The Tasks panel is opening so the user can set the assignee, due date, and priority.`,
            taskId
          };
        }

        // Category creation
        if (target === 'categories:create') {
          if (isLANMode()) {
            return { success: false, message: 'Category creation is only available on the desktop app.' };
          }
          const data = input.categoryData;
          if (!data?.name || !data?.type || !data?.section) {
            return { success: false, error: 'Category name, type, and section are all required.' };
          }

          const validSections = [
            'INCOME', 'DIRECT STAFF COSTS', 'MEDICAL SUPPLIES',
            'PREMISES COSTS', 'OFFICE & IT', 'PROFESSIONAL FEES',
            'PROFESSIONAL DEV', 'MOTOR & TRANSPORT',
            'PETTY CASH / OTHER EXPENSES', 'CAPITAL & DEPRECIATION', 'NON-BUSINESS'
          ];
          if (!validSections.includes(data.section)) {
            return { success: false, error: `Invalid section "${data.section}". Valid sections: ${validSections.join(', ')}` };
          }

          // Check for duplicate name
          if (categoryMapping.find(c => c.name.toLowerCase() === data.name.toLowerCase())) {
            const existing = categoryMapping.find(c => c.name.toLowerCase() === data.name.toLowerCase());
            return { success: false, error: `Category "${existing.name}" already exists (in ${existing.section || 'unknown section'}). Use search_transactions with action="recategorize" to move transactions there.` };
          }

          // Generate unique code: F-{timestamp} to avoid collisions with numeric scheme
          const code = `F-${Date.now()}`;

          const newCategory = {
            code,
            name: data.name,
            type: data.type,
            section: data.section,
            identifiers: data.identifiers || [],
            accountantLine: data.accountantLine || '',
            description: 'Created by Finn'
          };

          setCategoryMapping(prev => [...prev, newCategory]);
          // Stash in ref so recategorize can find it immediately (before React re-renders)
          lastCreatedCategoryRef.current = newCategory;

          return {
            success: true,
            message: `Category "${data.name}" created in ${data.section} (code ${code}).${data.identifiers?.length ? ` Auto-match identifiers: ${data.identifiers.join(', ')}.` : ''} The user can now recategorize transactions into this category.`,
            categoryCode: code,
            categoryName: data.name
          };
        }

        // Staged transaction review — conversational review of background-processed bank statements
        if (target === 'staged:review') {
          if (!window.electronAPI?.backgroundProcessor) {
            return { success: false, error: 'Background processor not available.' };
          }
          const data = input.stagedReviewData || {};
          const { stagedId, action = 'review' } = data;

          if (!stagedId) {
            return { success: false, error: 'stagedId is required. Use lookup_financial_data with query "staged_results" to find available staged files.' };
          }

          // Helper: get staged detail (cached within an agentic loop)
          const getStagedDetailCached = async (id) => {
            if (stagedDetailCacheRef.current[id]) return stagedDetailCacheRef.current[id];
            const detail = await window.electronAPI.backgroundProcessor.getStagedDetail(id);
            if (detail) stagedDetailCacheRef.current[id] = detail;
            return detail;
          };

          // Helper: invalidate cache after mutations
          const invalidateCache = (id) => {
            delete stagedDetailCacheRef.current[id];
          };

          if (action === 'review') {
            // Fetch and return the full staged review data
            const detail = await getStagedDetailCached(stagedId);
            if (!detail) {
              return { success: false, error: `Staged result "${stagedId}" not found. It may have already been applied.` };
            }

            const autoTxns = detail.transactions.filter(t => t.stagedCohort === 'auto');
            const groupConfirmedTxns = detail.transactions.filter(t => t.stagedCohort === 'group-confirmed');
            const reviewTxns = detail.transactions.filter(t => t.stagedCohort === 'review');

            // Transactions ready to apply without review: auto (full category) + group-confirmed (group assigned by AI)
            const readyToApply = [...autoTxns, ...groupConfirmedTxns];

            // If ALL transactions are auto/group-confirmed, apply immediately without review
            if (reviewTxns.length === 0 && readyToApply.length > 0) {
              setTransactions(prev => [...prev, ...readyToApply]);
              await window.electronAPI.backgroundProcessor.dismissStaged(stagedId);
              invalidateCache(stagedId);
              const updatedResults = await window.electronAPI.backgroundProcessor.getStagedResults();
              setStagedResults(updatedResults || []);

              return {
                success: true,
                stagedId,
                autoApplied: true,
                applied: readyToApply.length,
                reviewTransactions: 0,
                message: `${detail.sourceFile}: All ${readyToApply.length} transactions grouped successfully — ${autoTxns.length} with exact categories, ${groupConfirmedTxns.length} with AI-confirmed groups. Applied automatically. No review needed.`
              };
            }

            // Open the review panel (only when there are transactions to review)
            window.dispatchEvent(new CustomEvent('staged-review:open', {
              detail: { stagedData: detail }
            }));

            return {
              success: true,
              stagedId,
              sourceFile: detail.sourceFile,
              processedAt: detail.processedAt,
              summary: detail.summary,
              autoTransactions: autoTxns.length,
              groupConfirmedTransactions: groupConfirmedTxns.length,
              reviewTransactions: reviewTxns.length,
              reviewClusters: (detail.reviewClusters || []).map((c, i) => ({
                index: i,
                representativeDescription: c.representativeDescription,
                suggestedGroup: c.suggestedGroup,
                opusGroupConfidence: c.opusGroupConfidence,
                opusReasoning: c.opusReasoning,
                memberCount: c.memberCount,
                totalAmount: Math.round(c.totalAmount * 100) / 100,
              })),
              anomalyWarnings: detail.anomalyWarnings || [],
              message: `${detail.sourceFile}: ${detail.summary.totalTransactions} transactions — ${autoTxns.length} auto-grouped, ${groupConfirmedTxns.length} AI-grouped, ${reviewTxns.length} need group assignment across ${(detail.reviewClusters || []).length} clusters.`
            };
          }

          if (action === 'apply-auto') {
            // Bulk-apply all auto + group-confirmed transactions
            const detail = await getStagedDetailCached(stagedId);
            if (!detail) {
              return { success: false, error: `Staged result "${stagedId}" not found.` };
            }

            const autoTxns = detail.transactions.filter(t => t.stagedCohort === 'auto');
            const groupConfirmedTxns = detail.transactions.filter(t => t.stagedCohort === 'group-confirmed');
            const readyToApply = [...autoTxns, ...groupConfirmedTxns];

            if (readyToApply.length === 0) {
              return { success: true, applied: 0, message: 'No auto-grouped transactions to apply.' };
            }

            // Add to React state (auto-save handles persistence)
            setTransactions(prev => [...prev, ...readyToApply]);

            // Clean up staging file
            const applyIds = readyToApply.map(t => t.id);
            const result = await window.electronAPI.backgroundProcessor.removeFromStaged(stagedId, applyIds);
            invalidateCache(stagedId);

            // Refresh staged results summary for system_status awareness
            const updatedResults = await window.electronAPI.backgroundProcessor.getStagedResults();
            setStagedResults(updatedResults || []);

            // Notify review panel
            window.dispatchEvent(new CustomEvent('staged-review:applied', {
              detail: { stagedId, appliedCount: readyToApply.length, isAuto: true }
            }));

            return {
              success: true,
              applied: readyToApply.length,
              autoCategorised: autoTxns.length,
              aiGrouped: groupConfirmedTxns.length,
              remaining: result.remaining,
              message: `Applied ${readyToApply.length} transactions (${autoTxns.length} fully categorised, ${groupConfirmedTxns.length} AI-grouped).${result.remaining > 0 ? ` ${result.remaining} still need group assignment.` : ' All transactions applied.'}`
            };
          }

          if (action === 'apply-cluster') {
            // Apply all members of a specific cluster with the user's chosen GROUP (Pass 1)
            // or CATEGORY (Pass 2).
            const { clusterIndex, groupCode, categoryCode, categoryName } = data;

            if (clusterIndex === undefined || clusterIndex === null) {
              return { success: false, error: 'clusterIndex is required for apply-cluster.' };
            }

            const detail = await getStagedDetailCached(stagedId);
            if (!detail) {
              return { success: false, error: `Staged result "${stagedId}" not found.` };
            }

            // Get cluster and its member transactions
            const cluster = (detail.reviewClusters || [])[clusterIndex];
            if (!cluster) {
              return { success: false, error: `Cluster at index ${clusterIndex} not found. There are ${(detail.reviewClusters || []).length} clusters.` };
            }

            // Find all transactions belonging to this cluster
            const clusterTxns = detail.transactions.filter(t => {
              if (t.id === cluster.representativeId) return true;
              if (t.stagedCohort !== 'review') return false;
              const repClean = (cluster.representativeDescription || '').replace(/[0-9]/g, '').trim().substring(0, 8).toLowerCase();
              const txnClean = (t.details || '').replace(/[0-9]/g, '').trim().substring(0, 8).toLowerCase();
              return repClean.length >= 4 && repClean === txnClean;
            });

            let finalTxns = clusterTxns;
            if (clusterTxns.length < cluster.memberCount) {
              const repDesc = (cluster.representativeDescription || '').toLowerCase();
              const reviewTxns = detail.transactions.filter(t => t.stagedCohort === 'review');
              const scored = reviewTxns.map(t => {
                const desc = (t.details || '').toLowerCase();
                let shared = 0;
                const minLen = Math.min(desc.length, repDesc.length);
                for (let i = 0; i < minLen; i++) {
                  if (desc[i] === repDesc[i]) shared++;
                  else break;
                }
                return { txn: t, score: minLen > 0 ? shared / Math.max(desc.length, repDesc.length) : 0 };
              }).filter(s => s.score >= 0.6)
                .sort((a, b) => b.score - a.score)
                .slice(0, cluster.memberCount);
              finalTxns = scored.map(s => s.txn);
            }

            if (finalTxns.length === 0) {
              return { success: false, error: 'Could not find transactions for this cluster.' };
            }

            // Determine mode: group assignment (Pass 1) vs category assignment (Pass 2)
            const isGroupAssignment = !!groupCode && !categoryCode && !categoryName;

            if (isGroupAssignment) {
              // Pass 1: Assign GROUP only
              const overriddenTxns = finalTxns.map(t => ({
                ...t,
                suggestedGroup: groupCode,
                groupConfirmed: true,
                categoryMatchType: 'finn-background',
                stagedCohort: 'group-confirmed',
              }));

              setTransactions(prev => [...prev, ...overriddenTxns]);

              const txnIds = finalTxns.map(t => t.id);
              const result = await window.electronAPI.backgroundProcessor.removeFromStaged(stagedId, txnIds);
              invalidateCache(stagedId);

              // Notify review panel
              const groupName = Object.values(GROUPS).find(g => g.code === groupCode)?.name || groupCode;
              window.dispatchEvent(new CustomEvent('staged-review:applied', {
                detail: { stagedId, appliedCount: finalTxns.length, clusterIndex, groupName, isAuto: false }
              }));

              return {
                success: true,
                applied: finalTxns.length,
                remaining: result.remaining,
                groupApplied: groupName,
                message: `Assigned group "${groupName}" to ${finalTxns.length} transactions.${result.remaining > 0 ? ` ${result.remaining} transactions remaining.` : ' All transactions grouped.'}`
              };
            }

            // Pass 2 / legacy: Assign CATEGORY
            if (!categoryCode && !categoryName) {
              return { success: false, error: 'groupCode or categoryCode/categoryName is required for apply-cluster.' };
            }

            let targetCat = null;
            if (categoryCode) {
              targetCat = categoryMapping.find(c => c.code === categoryCode);
              if (!targetCat && lastCreatedCategoryRef.current?.code === categoryCode) {
                targetCat = lastCreatedCategoryRef.current;
              }
            }
            if (!targetCat && categoryName) {
              const lowerName = categoryName.toLowerCase();
              const matches = categoryMapping.filter(c => c.name.toLowerCase().includes(lowerName));
              if (matches.length === 1) {
                targetCat = matches[0];
              } else if (matches.length > 1) {
                const exact = matches.find(c => c.name.toLowerCase() === lowerName);
                targetCat = exact || null;
                if (!targetCat) {
                  return { success: false, error: `Multiple categories match "${categoryName}": ${matches.map(m => m.name).join(', ')}. Please be more specific or use the exact categoryCode.` };
                }
              }
              if (!targetCat && lastCreatedCategoryRef.current?.name.toLowerCase().includes(categoryName.toLowerCase())) {
                targetCat = lastCreatedCategoryRef.current;
              }
            }

            if (!targetCat) {
              const searchTerm = (categoryName || categoryCode || '').toLowerCase();
              const closeMatches = categoryMapping
                .filter(c => {
                  const name = c.name.toLowerCase();
                  const words = searchTerm.split(/\s+/).filter(w => w.length >= 3);
                  return words.some(w => name.includes(w));
                })
                .slice(0, 5)
                .map(c => `"${c.name}" (code: ${c.code})`);
              const suggestion = closeMatches.length > 0
                ? ` Did you mean: ${closeMatches.join(', ')}?`
                : ' Use categories:create to create it first.';
              return { success: false, error: `Category "${categoryCode || categoryName}" not found.${suggestion}` };
            }

            const overriddenTxns = finalTxns.map(t => ({
              ...t,
              categoryCode: targetCat.code,
              categoryName: targetCat.name,
              categoryMatchType: 'finn-background',
              categoryReviewed: true,
              categoryCohort: 'auto',
            }));

            setTransactions(prev => [...prev, ...overriddenTxns]);

            const txnIds = finalTxns.map(t => t.id);
            const result = await window.electronAPI.backgroundProcessor.removeFromStaged(stagedId, txnIds);
            invalidateCache(stagedId);

            // Add identifier for future learning
            const identifier = (cluster.representativeDescription || '').trim();
            let identifierAdded = null;
            if (identifier && identifier.length >= 3) {
              const cleanId = identifier.replace(/\d{2,}/g, '').replace(/\s+/g, ' ').trim().split(/\s{2,}/)[0].trim();
              if (cleanId.length >= 3) {
                const existingIds = (targetCat.identifiers || []).map(id => id.toLowerCase());
                if (!existingIds.includes(cleanId.toLowerCase())) {
                  setCategoryMapping(prev => prev.map(cat => {
                    if (cat.code === targetCat.code) {
                      return { ...cat, identifiers: [...(cat.identifiers || []), cleanId] };
                    }
                    return cat;
                  }));
                  identifierAdded = cleanId;
                }
              }
            }

            window.dispatchEvent(new CustomEvent('staged-review:applied', {
              detail: { stagedId, appliedCount: finalTxns.length, clusterIndex, categoryName: targetCat.name, isAuto: false }
            }));

            return {
              success: true,
              applied: finalTxns.length,
              remaining: result.remaining,
              categoryApplied: targetCat.name,
              identifierAdded,
              message: `Applied "${targetCat.name}" to ${finalTxns.length} transactions.${identifierAdded ? ` Added "${identifierAdded}" as a keyword — these will auto-categorise in future.` : ''}${result.remaining > 0 ? ` ${result.remaining} transactions remaining.` : ' All transactions applied.'}`
            };
          }

          if (action === 'rescore') {
            // Re-run categorisation engine on remaining review transactions
            // This cascades the user's recent category decisions into more auto-categorisations
            window.dispatchEvent(new CustomEvent('staged-review:rescore-start', { detail: { stagedId } }));

            const result = await window.electronAPI.backgroundProcessor.rescoreStaged(stagedId);
            invalidateCache(stagedId);

            if (!result || result.remainingReview === undefined) {
              return { success: false, error: 'Rescore failed. The staged file may have been removed.' };
            }

            // Notify review panel with updated clusters
            window.dispatchEvent(new CustomEvent('staged-review:rescore-done', {
              detail: { stagedId, promoted: result.promoted, updatedClusters: result.reviewClusters }
            }));

            return {
              success: true,
              promoted: result.promoted,
              remainingReview: result.remainingReview,
              remainingAuto: result.remainingAuto,
              reviewClusters: (result.reviewClusters || []).map((c, i) => ({
                index: i,
                representativeDescription: c.representativeDescription,
                suggestedGroup: c.suggestedGroup,
                opusGroupConfidence: c.opusGroupConfidence,
                opusReasoning: c.opusReasoning,
                memberCount: c.memberCount,
                totalAmount: Math.round(c.totalAmount * 100) / 100,
              })),
              message: result.promoted > 0
                ? `Rescoring complete — ${result.promoted} more transactions auto-grouped from your answers. ${result.remainingReview} still need group assignment.`
                : `Rescoring complete — no additional matches found. ${result.remainingReview} still need group assignment.`
            };
          }

          if (action === 'apply-remaining') {
            // Apply all remaining transactions (categorised or not) and finish the review
            const detail = await getStagedDetailCached(stagedId);
            if (!detail) {
              return { success: false, error: `Staged result "${stagedId}" not found.` };
            }

            const remaining = detail.transactions;
            if (remaining.length === 0) {
              return { success: true, applied: 0, message: 'No remaining transactions — review is complete.' };
            }

            // Add to React state
            setTransactions(prev => [...prev, ...remaining]);

            // Dismiss the entire staged file
            await window.electronAPI.backgroundProcessor.dismissStaged(stagedId);
            invalidateCache(stagedId);

            // Refresh staged results state
            const updatedResults = await window.electronAPI.backgroundProcessor.getStagedResults();
            setStagedResults(updatedResults || []);

            const grouped = remaining.filter(t => t.suggestedGroup || t.categoryCode).length;
            const ungrouped = remaining.length - grouped;

            // Close review panel
            window.dispatchEvent(new CustomEvent('staged-review:close', { detail: { stagedId } }));

            return {
              success: true,
              applied: remaining.length,
              grouped,
              ungrouped,
              message: `Applied all ${remaining.length} remaining transactions (${grouped} grouped, ${ungrouped} ungrouped). Group assignment complete.`
            };
          }

          if (action === 'categorise') {
            // Pass 2: Trigger category assignment on grouped-but-uncategorised transactions.
            // Can run on a staged file or on already-applied transactions ('applied').
            const targetId = stagedId || 'applied';

            if (!window.electronAPI?.backgroundProcessor?.runCategoryAssignment) {
              return { success: false, error: 'Category assignment not available in this version.' };
            }

            try {
              const result = await window.electronAPI.backgroundProcessor.runCategoryAssignment(targetId);

              if (result.total === 0) {
                return {
                  success: true,
                  message: 'All transactions already have categories assigned. No action needed.',
                };
              }

              // If running on applied transactions, sync React state
              if (targetId === 'applied' && result.updatedTransactions) {
                setTransactions(result.updatedTransactions);
              }

              // Build review cluster data for the panel (only if there are items needing review)
              const reviewCount = result.total - result.autoConfirmed;
              if (reviewCount > 0 && result.reviewClusters) {
                // Open review panel in category mode
                const panelData = targetId === 'applied'
                  ? {
                      id: 'applied',
                      sourceFile: 'Applied transactions',
                      summary: { totalTransactions: result.total },
                      transactions: result.updatedTransactions?.filter(t =>
                        t.suggestedGroup && t.groupConfirmed && (!t.categoryCode || t.categoryCohort === 'review')
                      ) || [],
                      reviewClusters: result.reviewClusters,
                    }
                  : await getStagedDetailCached(targetId);

                if (panelData) {
                  invalidateCache(targetId);
                  window.dispatchEvent(new CustomEvent('staged-review:pass2', {
                    detail: {
                      stagedData: panelData,
                      reviewClusters: result.reviewClusters,
                      autoApplied: result.autoConfirmed,
                    }
                  }));
                }
              }

              return {
                success: true,
                total: result.total,
                autoConfirmed: result.autoConfirmed,
                similarityMatched: result.similarityMatched,
                aiMatched: result.aiMatched,
                uncertain: result.uncertain,
                message: `Category assignment complete: ${result.autoConfirmed} auto-confirmed (${result.similarityMatched} by similarity, ${result.aiMatched} by AI).${reviewCount > 0 ? ` ${reviewCount} need your input — the review panel is open.` : ' All transactions categorised.'}`
              };
            } catch (error) {
              return { success: false, error: `Category assignment failed: ${error.message}` };
            }
          }

          return { success: false, error: `Unknown staged review action: "${action}". Valid actions: review, apply-auto, apply-cluster, categorise, rescore, apply-remaining.` };
        }

        // Export actions — trigger file downloads without navigating away
        if (target.startsWith('export:')) {
          if (isLANMode()) {
            return { success: false, message: 'File exports are only available on the desktop app.' };
          }
          const exportType = target.split(':')[1];
          const validExports = {
            'transactions-simple': 'Simplified Transactions CSV',
            'transactions-detailed': 'Detailed Transactions CSV',
            'pcrs-summary': 'PCRS Payment Summary CSV',
            'payment-overview': 'Monthly Payment Overview CSV',
            'pl-draft': 'Draft P&L Report CSV',
            'accountant-pack': 'Full Accountant Pack ZIP'
          };
          if (!validExports[exportType]) {
            return { success: false, error: `Unknown export type: ${exportType}` };
          }
          // Pre-check PCRS data availability
          if (['pcrs-summary', 'payment-overview'].includes(exportType)) {
            const yearPCRS = paymentAnalysisData.filter(p => parseInt(p.year) === selectedYear);
            if (yearPCRS.length === 0) {
              return { success: false, message: `No PCRS data available for ${selectedYear}. Upload GMS monthly payment PDFs first.` };
            }
          }
          window.dispatchEvent(new CustomEvent('finn:export', {
            detail: { exportType, year: selectedYear }
          }));
          return { success: true, message: `Downloading ${validExports[exportType]} for ${selectedYear}. The file download should begin shortly.` };
        }

        // Companion mode: only data-viewing targets are supported
        if (isLANMode()) {
          const companionTargets = ['business-overview', 'gms-overview', 'advanced-insights', 'reports'];
          if (!companionTargets.includes(target)) {
            return { success: false, message: `The "${target}" feature is only available on the desktop app. On this companion device you can view the Dashboard, Reports, Charts, and talk to me here.` };
          }
          // For supported targets, we can't navigate desktop pages — inform the user
          return { success: true, message: `That information is available in the companion app. Check the relevant tab in the bottom navigation.` };
        }

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

        if (target === 'gms-health-check' || target.startsWith('gms-health-check:')) {
          setCurrentView('gms-health-check');
          const areaId = target.includes(':') ? target.split(':')[1] : null;
          if (areaId) {
            // Deep-link to a specific area modal (v2 listens for this event)
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('gms-health-check-v2:openArea', { detail: { areaId } }));
            }, 100);
          }
          return { success: true, message: `Navigated to GMS Health Check${areaId ? ` — ${areaId}` : ''}` };
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

        // Advanced Insights deep-link: navigate to tab and open a specific category modal
        if (target.startsWith('advanced-insights:')) {
          const categoryId = target.split(':')[1];
          setCurrentView('advanced-insights');
          window.dispatchEvent(new CustomEvent('navigate:advancedInsights'));
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('advanced-insights:openCategory', { detail: { categoryId } }));
          }, 300);
          const categoryNames = { overview: 'Business Overview', gms: 'GMS & PCRS', growth: 'Growth & Strategy', costs: 'Costs & Cash Flow', tax: 'Tax & Compliance' };
          return { success: true, message: `Navigated to Advanced Insights and opened the ${categoryNames[categoryId] || categoryId} category.` };
        }

        // Advanced Insights (no deep-link)
        if (target === 'advanced-insights') {
          setCurrentView('advanced-insights');
          window.dispatchEvent(new CustomEvent('navigate:advancedInsights'));
          return { success: true, message: 'Navigated to Advanced Insights' };
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
        const isCommunicationDraft = input.reportType === 'communication_draft';
        const reportContext = {
          originalQuestion: input.topic,
          financialContext,
          practiceContext,
          gmsContext,
          isStrategic: input.reportType === 'strategic',
          isCommunicationDraft,
          contactInfo: isCommunicationDraft ? getContactInfo(input.recipient) : null,
          recipient: isCommunicationDraft ? input.recipient : null
        };

        // Use the ref since startBackgroundReport is defined later in the file
        if (startBackgroundReportRef.current) {
          startBackgroundReportRef.current(reportContext, true); // skipClarification=true, Claude handles that
          const timeEstimate = isCommunicationDraft ? '10-20 seconds' : '15-30 seconds';
          return { success: true, message: `${isCommunicationDraft ? 'Draft communication' : 'Report'} generation started: "${input.topic}". The user will be notified when it is ready. This typically takes ${timeEstimate}.` };
        }
        return { success: false, error: 'Report generation not available right now. Please try again.' };
      }

      case 'lookup_saved_reports': {
        return lookupSavedReports(input.search);
      }

      case 'lookup_available_analyses': {
        const category = input.category || 'all';
        const analyses = category === 'all'
          ? SUGGESTED_ANALYSES
          : SUGGESTED_ANALYSES.filter(a => a.categoryId === category);

        const hasTransactions = transactions && transactions.length > 0;
        const hasPaymentData = paymentAnalysisData && paymentAnalysisData.length > 0;

        return {
          success: true,
          analyses: analyses.map(a => ({
            id: a.id,
            title: a.title,
            shortQuestion: a.shortQuestion,
            categoryId: a.categoryId,
            reportType: a.reportType,
            requiresData: a.requiresData,
            dataAvailable: {
              transactions: hasTransactions,
              paymentAnalysisData: hasPaymentData
            }
          }))
        };
      }

      case 'start_app_tour': {
        if (isLANMode()) {
          return { success: false, message: 'App tours are only available on the desktop app. But I can help you understand any feature — just ask!' };
        }
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

      case 'lookup_gms_metrics': {
        const area = input.area || 'summary';
        const detailLevel = input.detail_level || 'headline';
        try {
          if (!paymentAnalysisData || paymentAnalysisData.length === 0) {
            return { success: false, message: 'No PCRS data available. The user needs to upload GMS monthly payment PDFs first.' };
          }
          const healthCheckData = profile?.healthCheckData || {};
          const analysisResults = analyzeGMSIncome(paymentAnalysisData, profile, healthCheckData);
          if (!analysisResults) {
            return { success: false, message: 'Unable to analyse GMS data. The uploaded PDFs may not contain the expected payment data.' };
          }
          const summary = buildAreaMetricsSummary(area, analysisResults, detailLevel, profile, healthCheckData);
          return { success: true, data: summary };
        } catch (err) {
          console.error('[Finn] lookup_gms_metrics error:', err);
          return { success: false, message: 'Error analysing GMS data.' };
        }
      }

      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  }, [lookupDataPoint, searchTransactions, lookupSavedReports, getFinancialContext, getCiaranContext, buildGMSHealthCheckContext, setCurrentView, setIsOpen, openFeedback, transactions, setTransactions, paymentAnalysisData, profile, categoryMapping, setCategoryMapping, stagedResults]);

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
      'admin': 'The user is on the Admin/Settings page.',
      'advanced-insights': 'The user is viewing the Advanced Insights tab, which showcases AI-generated reports, suggested analyses, and deep financial insights. They can browse saved Finn reports, request new analyses, and follow up on existing reports.'
    };
    return pageDescriptions[currentView] || 'The user is using the Sláinte Finance app.';
  }, [currentView]);

  // Human-readable description for tool execution indicators
  function getToolDescription(toolName, input) {
    switch (toolName) {
      case 'navigate':
        if (input.target === 'tasks:create') return `Creating task: ${input.taskData?.title || 'new task'}`;
        if (input.target?.startsWith('export:')) return `Downloading ${input.target.split(':')[1]?.replace(/-/g, ' ')}`;
        if (input.target === 'staged:review') {
          const action = input.stagedReviewData?.action || 'review';
          if (action === 'review') return 'Reviewing staged transactions';
          if (action === 'apply-auto') return 'Applying auto-categorised transactions';
          if (action === 'apply-cluster') return `Applying category to transaction cluster`;
          if (action === 'categorise') return 'Running category assignment on grouped transactions';
          if (action === 'rescore') return 'Re-scoring remaining transactions';
          if (action === 'apply-remaining') return 'Applying remaining transactions';
          return 'Reviewing staged transactions';
        }
        return `Navigating to ${input.target?.replace(/-/g, ' ').replace(':', ' → ')}`;
      case 'lookup_financial_data':
        if (input.query === 'system_status') return 'Checking what needs attention';
        if (input.query === 'staged_results') return 'Checking for processed bank statements';
        return `Looking up ${input.query?.replace(/_/g, ' ')}`;
      case 'search_transactions':
        if (input.action === 'recategorize') return `Recategorizing ${input.category || 'matching'} transactions to "${input.newCategory}"`;
        return `Searching transactions${input.category ? ` for "${input.category}"` : ''}${input.searchText ? ` matching "${input.searchText}"` : ''}`;
      case 'generate_report':
        if (input.reportType === 'communication_draft') return `Drafting communication: ${input.topic}`;
        return `Generating report: ${input.topic}`;
      case 'lookup_saved_reports':
        return `Looking up saved reports${input.search ? `: "${input.search}"` : ''}`;
      case 'start_app_tour':
        return 'Starting app tour';
      case 'send_feedback':
        return `Opening feedback form${input.summary ? `: "${input.summary}"` : ''}`;
      case 'lookup_gms_metrics':
        return `Looking up GMS ${input.area === 'summary' ? 'overall summary' : input.area} metrics`;
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
- Keep ALL responses brief — this is a chat widget, not a report. Maximum 3-4 sentences. When sharing data, highlight the 2-3 most important figures only. Do NOT list every category. If the user needs a comprehensive breakdown, suggest a pre-defined analysis or offer to generate a report.
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
- BEFORE generating a custom report, ALWAYS call lookup_available_analyses first to check if a pre-defined analysis matches the user's request. If a match exists, navigate to "advanced-insights" and tell the user which analysis matches their question and why it would be a good fit. Let them review the analysis details and generate it themselves from the Advanced Insights tab.
- When an analysis requires data the user hasn't uploaded (check the dataAvailable field), tell them what's missing and offer to navigate to the upload page.
- ONLY use generate_report for truly custom advisory questions that don't match any pre-defined analysis — e.g. "Should I buy the building next door?", "Compare leasing vs buying equipment".
- Use lookup_saved_reports when the user references a previous report, asks "what did the report say", or wants to see their saved reports.
- Use the navigate tool when the user wants to go to a page or open something.
- You ARE qualified to help with business planning, investment analysis, and financial projections. NEVER refuse a financial question.
- GMS Overview page shows GROSS payments (before deductions). Financial Overview shows NET payments received in bank transactions. These are DIFFERENT.
- If the user is asking about how to use a Sláinte Finance feature and an APP FEATURE GUIDE section is provided above, use it to give specific navigation steps.
- NEVER say you don't have access to data — use your tools to check.
- The app has a built-in PCRS/GMS statement downloader. Users do NOT need to log into the PCRS portal manually. Navigate to the PCRS downloader page if they ask about downloading statements.
- Use start_app_tour when the user asks for a tour, wants to be shown around, or asks how the app works. The tour starts automatically — just call the tool.
- If you cannot resolve a user's issue (bug, missing feature, or something outside your control), use send_feedback to open the feedback form pre-filled with a summary. Do NOT tell the user to contact support — use the tool to open the form for them.
- STAGED TRANSACTION REVIEW: When staged transactions are pending (check via system_status or staged_results), guide the user through a review. IMPORTANT: When the user asks about pending transactions, says "review", or responds "yes" to your offer to review, immediately navigate to staged:review — do NOT ask for further confirmation. Process each staged file one at a time. Flow: (1) navigate staged:review with action "review" — this auto-applies any all-auto files and opens the Transaction Review panel for files that need review, (2) immediately call "apply-auto" to apply the high-confidence batch (do NOT ask for permission — just apply and report the count), (3) tell the user the remaining clusters are shown in the Transaction Review panel beside you, where they can Accept the suggested category or Change it using the buttons on each cluster. You do NOT need to list every cluster in chat — the panel shows them. Just summarise briefly (e.g. "5 clusters remaining — you can accept or change the suggestions in the panel"). If the user asks you about a specific transaction in chat, help them, but the panel is the primary interaction surface for categorisation. (4) If the user asks you to apply remaining or finish up, call "apply-remaining".`;

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

          const result = await executeToolAction(block.name, block.input);
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
  }, [getRecentConversationHistory, getPageContextDescription, getCiaranContext, buildGMSHealthCheckContext, executeToolAction]);

  // Report Q&A — mini agentic loop for follow-up questions about a report
  const reportQA = useCallback(async (message, report, conversationHistory = []) => {
    const practiceContext = getCiaranContext();
    const financialSummary = buildLeanFinancialSummary();

    const reportContent = report.content?.length > 8000
      ? report.content.slice(0, 8000) + '\n\n[Report truncated for context length]'
      : report.content || '';

    const systemPrompt = `You are Finn, a financial advisor for Irish GP practices. You work for Sláinte Finance. The user is reading a saved report and asking follow-up questions.

${practiceContext ? `PRACTICE CONTEXT: ${practiceContext.substring(0, 300)}` : ''}

${financialSummary}

Report title: "${report.title}"
${report.originalQuestion ? `Original question: "${report.originalQuestion}"` : ''}

<report_content>
${reportContent}
</report_content>

RULES:
- Answer follow-up questions about this specific report. Be concise (2-4 paragraphs max).
- Reference specific data from the report where relevant.
- If the user asks about data NOT in the report (e.g. a specific category, monthly breakdown, or transaction details), use your tools to look it up. Do not guess.
- For "what if" scenarios, use the financial data as your baseline.
- Use euro (€) for currency. Never use emojis.
- NEVER say you don't have access to data — use your tools to check.`;

    // Build messages array from conversation history
    const apiMessages = [];
    for (const msg of conversationHistory) {
      if (msg.content) {
        apiMessages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content.substring(0, 500) });
      }
    }
    apiMessages.push({ role: 'user', content: message });

    // Ensure first message is from user
    while (apiMessages.length > 0 && apiMessages[0].role !== 'user') {
      apiMessages.shift();
    }

    // Ensure alternation
    const cleanedMessages = [];
    for (const msg of apiMessages) {
      if (cleanedMessages.length === 0 || cleanedMessages[cleanedMessages.length - 1].role !== msg.role) {
        cleanedMessages.push(msg);
      }
    }

    const toolActions = [];

    for (let round = 0; round < MAX_QA_TOOL_ROUNDS; round++) {
      let response;
      try {
        response = await callClaudeWithTools({
          model: MODELS.STANDARD,
          max_tokens: 1024,
          system: systemPrompt,
          messages: cleanedMessages,
          tools: REPORT_QA_TOOLS,
          tool_choice: { type: 'auto' }
        });
      } catch (err) {
        console.error(`[Finn Q&A] API error on round ${round}:`, err);
        return {
          content: "I ran into a connection issue. Please try again in a moment.",
          toolActions,
          isError: true
        };
      }

      if (response.stop_reason === 'end_turn') {
        const text = response.content
          .filter(b => b.type === 'text')
          .map(b => b.text)
          .join('\n\n');
        return { content: text, toolActions };
      }

      if (response.stop_reason === 'tool_use') {
        const toolResults = [];
        for (const block of response.content.filter(b => b.type === 'tool_use')) {
          console.log(`[Finn Q&A] Tool call: ${block.name}`, block.input);
          const result = await executeToolAction(block.name, block.input);
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
        cleanedMessages.push({ role: 'assistant', content: response.content });
        cleanedMessages.push({ role: 'user', content: toolResults });
      }
    }

    console.warn('[Finn Q&A] Hit MAX_QA_TOOL_ROUNDS limit');
    return {
      content: "I ran into an issue completing that lookup. Please try asking in a different way.",
      toolActions,
      isError: true
    };
  }, [getCiaranContext, buildLeanFinancialSummary, executeToolAction]);

  // GMS Area Q&A — per-area follow-up questions within the Health Check v2
  const gmsAreaQA = useCallback(async (message, areaId, areaContext, conversationHistory = []) => {
    const practiceContext = getCiaranContext();

    const systemPrompt = `You are Finn, a financial advisor for Irish GP practices. You work for Sláinte Finance. The user is reviewing the "${areaId}" area of their GMS Health Check and asking questions.

${practiceContext ? `PRACTICE CONTEXT: ${practiceContext.substring(0, 300)}` : ''}

<area_context>
${areaContext}
</area_context>

RULES:
- Answer questions about this specific GMS area. Be concise (2-4 paragraphs max).
- Reference specific figures from the analysis where relevant.
- You have full reference data on GMS rates, rules, and calculation methods — use it to explain how things work.
- If the user asks about data NOT in the analysis, use your tools to look it up. Do not guess.
- Use euro (€) for currency. Never use emojis.
- NEVER say you don't have access to data — use your tools to check.
- Be practical and actionable — tell them exactly what steps to take.`;

    // Build messages array from conversation history
    const apiMessages = [];
    for (const msg of conversationHistory) {
      if (msg.content) {
        apiMessages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content.substring(0, 500) });
      }
    }
    apiMessages.push({ role: 'user', content: message });

    // Ensure first message is from user
    while (apiMessages.length > 0 && apiMessages[0].role !== 'user') {
      apiMessages.shift();
    }

    // Ensure alternation
    const cleanedMessages = [];
    for (const msg of apiMessages) {
      if (cleanedMessages.length === 0 || cleanedMessages[cleanedMessages.length - 1].role !== msg.role) {
        cleanedMessages.push(msg);
      }
    }

    const toolActions = [];

    for (let round = 0; round < MAX_QA_TOOL_ROUNDS; round++) {
      let response;
      try {
        response = await callClaudeWithTools({
          model: MODELS.STANDARD,
          max_tokens: 1024,
          system: systemPrompt,
          messages: cleanedMessages,
          tools: REPORT_QA_TOOLS,
          tool_choice: { type: 'auto' }
        });
      } catch (err) {
        console.error(`[Finn GMS Q&A] API error on round ${round}:`, err);
        return {
          content: "I ran into a connection issue. Please try again in a moment.",
          toolActions,
          isError: true
        };
      }

      if (response.stop_reason === 'end_turn') {
        const text = response.content
          .filter(b => b.type === 'text')
          .map(b => b.text)
          .join('\n\n');
        return { content: text, toolActions };
      }

      if (response.stop_reason === 'tool_use') {
        const toolResults = [];
        for (const block of response.content.filter(b => b.type === 'tool_use')) {
          console.log(`[Finn GMS Q&A] Tool call: ${block.name}`, block.input);
          const result = await executeToolAction(block.name, block.input);
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
        cleanedMessages.push({ role: 'assistant', content: response.content });
        cleanedMessages.push({ role: 'user', content: toolResults });
      }
    }

    console.warn('[Finn GMS Q&A] Hit MAX_QA_TOOL_ROUNDS limit');
    return {
      content: "I ran into an issue completing that lookup. Please try asking in a different way.",
      toolActions,
      isError: true
    };
  }, [getCiaranContext, executeToolAction]);

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

      // If the agentic loop looked up staged_results and there are staged files,
      // attach a review button so the user can start review with one click
      const lookedUpStaged = result.toolActions?.some(a =>
        a.name === 'lookup_financial_data' && (a.input?.query === 'staged_results' || a.input?.query === 'system_status')
      );
      const didNavigateToReview = result.toolActions?.some(a =>
        a.name === 'navigate' && a.input?.target === 'staged:review'
      );
      let reviewAction;
      if (lookedUpStaged && !didNavigateToReview && stagedResults.length > 0) {
        // Pick the first staged file for the button (most common case)
        reviewAction = { type: 'review_staged', label: 'Review Transactions', stagedId: stagedResults[0].id };
      }

      const assistantMsg = {
        type: 'assistant',
        content: result.content,
        timestamp: new Date().toISOString(),
        id: `assistant-${Date.now()}`,
        isError: result.isError || false,
        toolActions: result.toolActions?.length > 0 ? result.toolActions : undefined,
        ...(reviewAction ? { action: reviewAction } : {})
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
  }, [apiKey, currentChatId, isLoading, isRetryRequest, failedReportContext, agenticQuery]);

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

    // Add "working on it" message - vary based on model tier and type
    const workingMessage = context.isCommunicationDraft
      ? "I'll draft that for you now. Feel free to continue using the app - I'll let you know when it's ready."
      : context.isStrategic
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

  // Keep refs in sync for retry functionality and suggested analysis triggering
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
    const { originalQuestion, financialContext, practiceContext, gmsContext, clarifications, isStrategic, isCommunicationDraft, contactInfo, recipient, contextProfile, revisionContext } = context;

    // Select model tier based on question type
    const modelId = isCommunicationDraft ? MODELS.STANDARD : (isStrategic ? MODELS.STRATEGIC : MODELS.STANDARD);
    const modelLabel = isCommunicationDraft ? 'Sonnet (Communication Draft)' : (isStrategic ? 'Opus (Strategic Advisory)' : 'Sonnet (Standard Report)');
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

    const communicationDraftPreamble = isCommunicationDraft ? `
**COMMUNICATION DRAFT MODE:**
You are drafting a formal email or letter on behalf of the GP practice. Structure it as:

1. **Subject line** — clearly prefixed with "Subject:" on its own line
2. **To** — the recipient name and email (from CONTACT_INFO below if available)
3. **Body** — professional, factual, referencing specific figures from the practice data where relevant. Be clear about what is being requested or queried.
4. **Sign-off** — use the practice name from the profile data

${contactInfo ? `**CONTACT_INFO:**
- Name: ${contactInfo.name}
- Email: ${contactInfo.email || 'Not available'}
- Phone: ${contactInfo.phone || 'Not available'}
- Address: ${contactInfo.address || 'Not available'}
- Notes: ${contactInfo.notes || ''}` : `No contact info found for "${recipient || 'unknown'}". Use a generic "To whom it may concern" format and note that the practice should verify the correct contact details.`}

**CRITICAL RULES:**
- Use the practice name and contact person from the profile (no "[Practice Name]" placeholders if you have the data)
- ONLY include data that is DIRECTLY relevant to the specific topic of this email. If the email is about study leave, do NOT include gross GMS totals, patient demographics, or staff headcounts unless they directly support the query.
- The email should be SHORT and focused — a real practice manager would not write a 500-word email for a simple query
- Keep the "before sending" checklist to 2-3 genuinely useful items maximum
- Do NOT include charts, tables, or financial breakdowns
- Keep the draft under 300 words (excluding the checklist)
- Only use [square bracket placeholders] for data you genuinely do not have. GMS panel numbers should be in the practice context — always use them when writing to PCRS.
` : '';

    // Static report instructions (cacheable across multiple report generations)
    const reportSystemPrompt = `You are Finn, an expert financial advisor for Irish GP practices. ${isCommunicationDraft ? 'Draft a professional communication.' : 'Create a CONCISE, professional report.'}
${isCommunicationDraft ? communicationDraftPreamble : strategicPreamble}
**CRITICAL FORMATTING RULES:**
1. **MAXIMUM ${isCommunicationDraft ? '600' : (isStrategic ? '1,800' : '1,200')} WORDS** - GPs are busy. Be concise. Every sentence must add value.
   **Do NOT output <thinking> tags or chain-of-thought working.** Go straight to writing the report. All reasoning must happen internally — the output must contain ONLY the finished report.
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
- Do NOT create a chart that just repeats what's already in a table - use one or the other
- **Format strings use d3-format syntax** — do NOT put currency symbols (€, $) in format strings. Use ",.0f" not "€,.0f". Put the currency symbol in the axis title instead (e.g., "title": "Value (€)")

**CHART COLOUR PALETTE (you MUST use these exact hex values — no other colours):**
- Income/positive data: #4ECDC4 (turquoise)
- Expense/negative data: #FF6B6B (coral)
- Primary/default: #4A90E2 (blue)
- Warning/attention: #F9A826 (marigold)
- Success/complete: #10B981 (green)
- Purple accent: #7C6EBF (periwinkle)
- Highlight: #FFD23C (yellow)
- Extended series: #8B5CF6 (violet), #EC4899 (pink)
- For multi-series charts, use colours in this order: #4A90E2, #4ECDC4, #FF6B6B, #7C6EBF, #F9A826, #FFD23C, #8B5CF6, #EC4899
- For income vs expense comparisons, always use #4ECDC4 for income and #FF6B6B for expense
- For positive/negative indicators (e.g. profit vs loss), use #10B981 (green) and #FF6B6B (coral)

**${isCommunicationDraft ? 'COMMUNICATION' : 'REPORT'} STRUCTURE:**
Use the <artifact> tag format. Keep it tight and actionable:

${isCommunicationDraft ? `<artifact title="Draft: [Brief Subject]" type="report">
Subject: [Clear, specific subject line]

To: [Recipient name and email]

Dear [Appropriate salutation],

[1-2 paragraphs maximum. State the purpose, what is being queried, and what response is needed. Keep it direct and professional.]

Yours sincerely,
[Practice Name and contact details]

</artifact>

After the artifact, add 2-3 bullet points of things to check before sending. Keep these brief and genuinely useful.` : isStrategic ? `<artifact title="Report Title Here" type="report">
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

${!isCommunicationDraft ? 'After the artifact, add 1 sentence offering to clarify or explore specific aspects.' : ''}`;

    // For communication drafts, build a focused user message with only relevant context
    if (isCommunicationDraft) {
      const commUserMessage = `**PRACTICE CONTEXT:**
${practiceContext}

${gmsContext ? `**GMS HEALTH CHECK DATA (use ONLY if directly relevant to the email topic):**\n${gmsContext}` : ''}

**TODAY'S DATE:** ${financialContext.currentDate}

**USER'S REQUEST:**
${originalQuestion}

${clarifications ? `**USER'S CLARIFICATIONS:**\n${clarifications}\n` : ''}
IMPORTANT RULES FOR THIS COMMUNICATION DRAFT:
- Write a SHORT, focused email. Do NOT pad it with unnecessary detail.
- ONLY include data points that are DIRECTLY relevant to the specific query topic.
- Do NOT dump financial totals, income breakdowns, or general practice statistics into the email unless the user specifically asked about those topics.
- The email should read as something a practice manager would naturally write — concise and to the point.
- If the user is asking about a specific issue (e.g. study leave, Practice Support hours), focus ONLY on that issue.
- Use actual staff names and practice details from the context above, but only where relevant.
- Keep the "before sending" checklist to 2-3 genuinely useful items, not a comprehensive audit.
Draft the communication now.`;

      console.log('[Finn] Starting communication draft generation...');

      const commRequest = {
        model: modelId,
        max_tokens: 2048,
        system: reportSystemPrompt,
        messages: [
          { role: 'user', content: commUserMessage }
        ]
      };

      const commResponse = await callClaudeWithTools(commRequest);
      const commContent = commResponse.content
        ?.filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n\n')
        .replace(/<thinking>[\s\S]*?<\/thinking>/g, '');

      const commParsed = parseArtifactResponse(commContent);

      if (commParsed && commParsed.artifact) {
        return {
          title: commParsed.artifact.title,
          type: commParsed.artifact.type,
          content: commParsed.artifact.content,
          intro: commParsed.intro,
          conclusion: commParsed.conclusion,
          originalQuestion,
          modelUsed: modelId,
          isCommunicationDraft: true
        };
      }

      return {
        title: 'Draft Communication',
        type: 'report',
        content: commContent,
        originalQuestion,
        modelUsed: modelId,
        isCommunicationDraft: true
      };
    }

    // Dynamic practice data and question (changes per report) — for standard/strategic reports
    const reportUserMessage = `${revisionContext ? `**⚠️ REVISION MODE — READ THIS FIRST ⚠️**
This is a REVISION of an existing report, not a new report. The user has discussed the report with you and provided corrections, clarifications, or new context. You MUST incorporate their feedback into the revised report. Do NOT simply regenerate the same analysis — the whole point is that the user wants the report updated based on what they told you.

**CONVERSATION WITH THE USER (read carefully — this is what changed):**
${revisionContext.conversationTranscript}

**ORIGINAL REPORT (for reference — revise, don't repeat):**
${revisionContext.originalContent}

Now generate a revised version that integrates the above conversation. The financial data below is unchanged — but your INTERPRETATION of it must reflect what the user told you.
---

` : ''}**PRACTICE CONTEXT:**
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

${(!contextProfile || contextProfile.expenseCategories !== 'none') ? `**${contextProfile?.expenseCategories === 'all' ? 'ALL EXPENSE CATEGORIES' : 'TOP EXPENSE CATEGORIES'} (${financialContext.mostRecentYear}):**
${(contextProfile?.expenseCategories === 'all'
      ? (financialContext.allExpenseCategories || financialContext.topExpenseCategories)
      : financialContext.topExpenseCategories
    ).map((cat, i) =>
      `${i + 1}. ${cat.name}: €${cat.value.toLocaleString()}`
    ).join('\n')}` : ''}

${(!contextProfile || contextProfile.incomeCategories !== 'none') ? `**${contextProfile?.incomeCategories === 'all' ? 'ALL INCOME SOURCES' : 'TOP INCOME SOURCES'} (${financialContext.mostRecentYear}):**
${(contextProfile?.incomeCategories === 'all'
      ? (financialContext.allIncomeCategories || financialContext.topIncomeCategories)
      : financialContext.topIncomeCategories
    ).map((cat, i) =>
      `${i + 1}. ${cat.name}: €${cat.value.toLocaleString()}`
    ).join('\n')}` : ''}

${(!contextProfile || contextProfile.monthlyTrends !== false) ? `**MONTHLY TRENDS (${financialContext.mostRecentYear}):**
${financialContext.monthlyTrends.map(month =>
      `${month.month}: Income €${month.income.toLocaleString()}, Expenses €${month.expenses.toLocaleString()}`
    ).join('\n')}` : ''}

${(!contextProfile || contextProfile.previousYear !== false) ? `**LAST 12 MONTHS ROLLING DATA:**
- Income: €${financialContext.last12Months?.income?.toLocaleString() || 'N/A'}
- Expenses: €${financialContext.last12Months?.expenses?.toLocaleString() || 'N/A'}
- Profit: €${financialContext.last12Months?.profit?.toLocaleString() || 'N/A'}
- Monthly trends: ${financialContext.last12Months?.monthlyTrends?.map(m => `${m.month}: €${m.expenses.toLocaleString()} expenses`).join(', ') || 'N/A'}` : ''}

${((!contextProfile || contextProfile.gmsData !== 'none') && financialContext.gmsPaymentData?.hasData) ? `**GMS GROSS PAYMENT DATA (from PCRS PDF Statements):**
This is the GROSS GMS payment data from uploaded PCRS statements (shown on GMS Overview page).
The income figures in "FINANCIAL DATA" above show NET payments received in bank transactions.
GROSS vs NET: Gross is before HSE deductions (PRSI, superannuation, withholding tax). Net is what actually arrived in the bank.

- Total PCRS statements loaded: ${financialContext.gmsPaymentData.totalPayments}
- Years with GMS data: ${financialContext.gmsPaymentData.availableYears?.join(', ')}
${(contextProfile?.gmsData !== 'summary' && financialContext.gmsPaymentData.recentYearPayments?.length > 0) ? `
**${financialContext.mostRecentYear} MONTHLY GROSS GMS PAYMENTS:**
${financialContext.gmsPaymentData.recentYearPayments.map(p => `${p.month}: €${p.totalGross.toLocaleString()}`).join('\n')}

**${financialContext.mostRecentYear} TOTAL GROSS GMS: €${financialContext.gmsPaymentData.recentYearTotal?.toLocaleString()}**` : `
**${financialContext.mostRecentYear} TOTAL GROSS GMS: €${financialContext.gmsPaymentData.recentYearTotal?.toLocaleString()}**`}
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

${contextProfile?.contextNotes ? `**ANALYSIS FOCUS:**\n${contextProfile.contextNotes}\n` : ''}**USER'S ORIGINAL QUESTION:**
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

    // Strip any <thinking> tags that leaked into the response as literal text
    reportContent = reportContent.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();

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
        modelUsed: modelId,
        isCommunicationDraft: isCommunicationDraft || false
      };
    }

    // Fallback if no artifact tags
    return {
      title: isCommunicationDraft ? 'Draft Communication' : 'Financial Analysis Report',
      type: 'report',
      content: reportContent,
      originalQuestion,
      modelUsed: modelId,
      isCommunicationDraft: isCommunicationDraft || false
    };
  }, []);

  // Save report to localStorage
  const saveReport = useCallback((report) => {
    const savedReports = JSON.parse(localStorage.getItem('gp_finance_saved_reports') || '[]');

    // Extract email subject and body for communication drafts
    let emailSubject = '';
    let emailBody = '';
    if (report.isCommunicationDraft && report.content) {
      const subjectMatch = report.content.match(/Subject:\s*(.+)/i);
      if (subjectMatch) emailSubject = subjectMatch[1].trim();
      // Extract body: everything after the Subject/To/Dear lines, before sign-off
      const bodyMatch = report.content.match(/Dear[\s\S]*?(Yours[\s\S]*?\n)/i);
      if (bodyMatch) {
        emailBody = bodyMatch[0].trim();
      } else {
        // Fallback: use content after Subject line
        const afterSubject = report.content.split(/Subject:.*\n/i)[1];
        if (afterSubject) emailBody = afterSubject.trim();
      }
    }

    const newReport = {
      id: `finn-report-${Date.now()}`,
      title: report.title,
      type: report.isCommunicationDraft ? 'Communication Draft' : 'AI Report',
      generatedDate: new Date().toISOString(),
      year: new Date().getFullYear(),
      content: report.content,
      htmlContent: null, // Will be rendered by ArtifactViewer
      artifactType: report.type,
      originalQuestion: report.originalQuestion,
      suggestedAnalysisId: report.suggestedAnalysisId || null,
      intro: report.intro,
      conclusion: report.conclusion,
      ...(report.isCommunicationDraft && { emailSubject, emailBody, isCommunicationDraft: true }),
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

  // Update an existing report in localStorage (used by report revision)
  const updateReport = useCallback((reportId, updatedFields) => {
    const reports = JSON.parse(localStorage.getItem('gp_finance_saved_reports') || '[]');
    const index = reports.findIndex(r => r.id === reportId);
    if (index === -1) return null;

    const updated = {
      ...reports[index],
      ...updatedFields,
      metadata: {
        ...reports[index].metadata,
        ...(updatedFields.metadata || {}),
        revisedAt: new Date().toISOString(),
        revisionNumber: (reports[index].metadata?.revisionNumber || 0) + 1,
        originalReportId: reports[index].metadata?.originalReportId || reportId
      }
    };

    reports[index] = updated;
    localStorage.setItem('gp_finance_saved_reports', JSON.stringify(reports));
    setSavedReports(reports);
    return updated;
  }, []);

  // Revise an existing report based on a conversation about it
  const reviseReport = useCallback(async (report, conversationMessages) => {
    // Guard: only one background task at a time
    if (backgroundTask?.status === TASK_STATUS.RUNNING) return null;

    // Gather fresh financial context (same pattern as generateReportFromTab)
    const financialContext = getFinancialContext();
    const freshProfile = getProfileFromStorage();
    const practiceContext = freshProfile
      ? buildCiaranContext(freshProfile)
      : getCiaranContext();
    const gmsContext = buildGMSHealthCheckContext(false);

    // Format conversation transcript (capped at ~3000 chars)
    const transcript = conversationMessages
      .filter(m => !m.isError)
      .map(m => `${m.role === 'user' ? 'User' : 'Finn'}: ${m.content}`)
      .join('\n\n');
    const cappedTranscript = transcript.length > 3000
      ? '...\n\n' + transcript.slice(transcript.length - 3000)
      : transcript;

    // Cap original report content
    const cappedOriginal = (report.content || '').length > 6000
      ? report.content.slice(0, 6000) + '\n\n[... truncated for length]'
      : report.content;

    const isStrategic = report.metadata?.model?.includes('opus');

    const context = {
      originalQuestion: report.originalQuestion,
      financialContext,
      practiceContext,
      gmsContext,
      isStrategic,
      revisionContext: {
        originalContent: cappedOriginal,
        conversationTranscript: cappedTranscript
      }
    };

    // Set background task state (prevents concurrent generation, shows progress)
    setBackgroundTask({
      id: `task-${Date.now()}`,
      status: TASK_STATUS.RUNNING,
      startedAt: Date.now(),
      context,
      isRevision: true,
      reportId: report.id
    });

    try {
      const result = await generateDetailedReport(context);

      // Update the existing report in localStorage
      const updated = updateReport(report.id, {
        title: result.title,
        content: result.content,
        artifactType: result.type,
        intro: result.intro,
        conclusion: result.conclusion
      });

      // Update task state
      setBackgroundTask(prev => ({
        ...prev,
        status: TASK_STATUS.COMPLETED,
        completedAt: Date.now(),
        reportId: updated.id
      }));

      // Notify via Finn widget
      addAssistantMessage(
        `Your revised "${updated.title}" report is ready. You'll find it updated in Your Reports on the Advanced Insights tab.`,
        false,
        { isReportNotification: true, reportId: updated.id, reportTitle: updated.title }
      );

      return updated;
    } catch (error) {
      setBackgroundTask(prev => ({
        ...prev,
        status: TASK_STATUS.FAILED,
        error: error.message
      }));
      throw error;
    }
  }, [backgroundTask, getFinancialContext, getCiaranContext, buildGMSHealthCheckContext, generateDetailedReport, updateReport, addAssistantMessage]);

  // Generate a report directly from the Advanced Insights tab (no agentic loop, no widget)
  const generateReportFromTab = useCallback(async (analysisConfig) => {
    // Guard: only one report at a time
    if (backgroundTask?.status === TASK_STATUS.RUNNING) return null;

    const financialContext = getFinancialContext();
    // Read profile fresh from localStorage — the modal may have just saved
    // new operational data (consultation fee, GP hours, etc.) that the hook's
    // cached profile state hasn't picked up yet.
    const freshProfile = getProfileFromStorage();
    const practiceContext = freshProfile
      ? buildCiaranContext(freshProfile)
      : getCiaranContext();
    // Force full GMS Health Check context for reports that summarise Health Check data
    // (e.g. GMS Optimisation Summary). Otherwise uses the default view-aware context.
    const gmsContext = buildGMSHealthCheckContext(analysisConfig.forceFullGMSContext || false);

    const context = {
      originalQuestion: analysisConfig.prompt,
      financialContext,
      practiceContext,
      gmsContext,
      isStrategic: analysisConfig.reportType === 'strategic',
      contextProfile: analysisConfig.contextProfile || null,
      suggestedAnalysisId: analysisConfig.id || null
    };

    // Set background task state (prevents concurrent generation)
    setBackgroundTask({
      id: `task-${Date.now()}`,
      status: TASK_STATUS.RUNNING,
      startedAt: Date.now(),
      context
    });

    try {
      const report = await generateDetailedReport(context);
      report.suggestedAnalysisId = context.suggestedAnalysisId;
      const savedReport = saveReport(report);

      // Update task state
      setBackgroundTask(prev => ({
        ...prev,
        status: TASK_STATUS.COMPLETED,
        completedAt: Date.now(),
        reportId: savedReport.id
      }));

      // Open widget and notify user the report is ready
      setIsOpen(true);
      const isCommDraft = context.isCommunicationDraft;
      addAssistantMessage(
        isCommDraft
          ? `Your draft communication is ready. You can view it, copy it, or open it directly in your email client.`
          : `Your "${savedReport.title}" report is ready. Click below to read it.`,
        false,
        {
          isReportNotification: true,
          reportId: savedReport.id,
          reportTitle: savedReport.title,
          ...(isCommDraft && {
            isCommunicationDraft: true,
            contactInfo: context.contactInfo,
            emailSubject: savedReport.emailSubject || '',
            emailBody: savedReport.emailBody || ''
          })
        }
      );

      return savedReport;
    } catch (error) {
      setBackgroundTask(prev => ({
        ...prev,
        status: TASK_STATUS.FAILED,
        error: error.message
      }));
      throw error;
    }
  }, [backgroundTask, getFinancialContext, getCiaranContext, buildGMSHealthCheckContext, generateDetailedReport, saveReport, addAssistantMessage]);

  // Notify user that report is ready
  const notifyReportReady = useCallback((report) => {
    // Open the widget if closed
    setIsOpen(true);

    // Add notification message to chat
    const isCommDraft = report.isCommunicationDraft;
    const notificationMsg = {
      type: 'assistant',
      content: isCommDraft
        ? `Your draft email is ready. You can view it, copy it, or open it directly in your email client.`
        : `That report I've been working on is now ready for you to read. I've put together a detailed analysis based on your question.`,
      timestamp: new Date().toISOString(),
      id: `assistant-${Date.now()}`,
      isReportNotification: true,
      reportId: report.id,
      reportTitle: report.title,
      ...(isCommDraft && { isCommunicationDraft: true, contactInfo: report.contactInfo, emailSubject: report.emailSubject || '', emailBody: report.emailBody || '' })
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
    setApiKey,

    // Background task (shared between reports and PCRS)
    backgroundTask,
    startBackgroundReport,
    generateReportFromTab,
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

    // Report Q&A (for ReportConversation side panel)
    reportQA,

    // GMS Area Q&A (for Health Check v2 area conversation)
    gmsAreaQA,

    // Report revision (update report based on conversation)
    reviseReport,

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

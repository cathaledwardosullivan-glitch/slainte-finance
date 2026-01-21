import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
// ... other imports
import { MessageCircle, Send, Download, Trash2, Copy, RefreshCw, AlertTriangle, Sparkles, Plus, FileText, Clock, ChevronRight, X } from 'lucide-react';
import COLORS from '../utils/colors';
import { usePracticeProfile } from '../hooks/usePracticeProfile';
import { ArtifactViewer, InlineArtifact } from './FinancialChat/ArtifactViewer';
import { chatStorage } from '../storage/chatStorage';
import { shouldCreateArtifact, createArtifact, parseArtifactResponse } from '../utils/artifactBuilder';
import { callClaude, formatClaudeResponse } from '../utils/claudeAPI';
import { analyzeGMSIncome, generateRecommendations } from '../utils/healthCheckCalculations';

export default function FinancialChat() {
    const {
        transactions,
        unidentifiedTransactions,
        selectedYear,
        categoryMapping,
        paymentAnalysisData
    } = useAppContext();
  const [chatMessages, setChatMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const chatInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Chat history and artifacts
  const [currentChatId, setCurrentChatId] = useState(null);
  const [artifacts, setArtifacts] = useState([]);
  const [viewingArtifact, setViewingArtifact] = useState(null);

  // New UI state for tabbed header and slide-out
  const [headerTab, setHeaderTab] = useState('chats'); // 'chats' or 'artifacts'
  const [allChats, setAllChats] = useState([]);
  const [allArtifacts, setAllArtifacts] = useState([]);
  const [showSlideOutPanel, setShowSlideOutPanel] = useState(false);

  // Practice profile integration
  const {
    profile,
    getCiaranContext,
    getContextSummary,
    hasContext
  } = usePracticeProfile();

  // Load all chats and artifacts for the header cards
  const refreshAllChatsAndArtifacts = () => {
    const chats = chatStorage.getAllChats();
    setAllChats(chats);

    // Collect all artifacts from all chats
    const allArts = [];
    chats.forEach(chat => {
      if (chat.artifacts && chat.artifacts.length > 0) {
        chat.artifacts.forEach(artifact => {
          allArts.push({
            ...artifact,
            chatId: chat.id,
            chatTitle: chat.title
          });
        });
      }
    });
    // Sort by creation date, newest first
    allArts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    setAllArtifacts(allArts);
  };

  // Initialize - migrate old history and load/create chat
  useEffect(() => {
    // Load API key - check Electron storage first, then localStorage
    const loadApiKey = async () => {
      let savedApiKey = null;

      // Check Electron storage first (preferred)
      if (window.electronAPI?.isElectron) {
        savedApiKey = await window.electronAPI.getLocalStorage('claude_api_key');
      }

      // Fallback to localStorage for backwards compatibility
      if (!savedApiKey) {
        savedApiKey = localStorage.getItem('anthropic_api_key') || '';
      }

      setApiKey(savedApiKey);
    };

    loadApiKey();

    // Migrate old chat history to new system
    chatStorage.migrateOldHistory();

    // Load all chats for header
    refreshAllChatsAndArtifacts();

    // Start with a blank chat - don't auto-load previous conversation
    // User can click on a recent chat card to continue a conversation
    handleNewChat();
  }, []);

  // Auto-scroll to bottom when messages change (only if there are messages)
  useEffect(() => {
    if (chatMessages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isLoading]);

  // Check for preloaded context from Interactive GMS Health Check
  useEffect(() => {
    const preloadedData = sessionStorage.getItem('finn_preloaded_context');
    if (preloadedData) {
      try {
        const data = JSON.parse(preloadedData);
        // Only process if it's recent (within 30 seconds)
        if (data.timestamp && Date.now() - data.timestamp < 30000) {
          // Clear immediately to prevent reprocessing
          sessionStorage.removeItem('finn_preloaded_context');

          // Create a new chat with the preloaded context
          const newChat = chatStorage.createChat('GMS Health Check Discussion');
          setCurrentChatId(newChat.id);

          // Store the context for the next message
          sessionStorage.setItem('finn_context_for_next_message', data.context);

          // Add Finn's initial message
          const assistantMessage = {
            role: 'assistant',
            content: data.initialMessage || "I've reviewed your GMS Health Check results. What would you like to discuss?",
            timestamp: new Date().toISOString()
          };

          setChatMessages([assistantMessage]);
          chatStorage.addMessage(newChat.id, assistantMessage);
          refreshAllChatsAndArtifacts();
        } else {
          // Context is stale, remove it
          sessionStorage.removeItem('finn_preloaded_context');
        }
      } catch (error) {
        console.error('[FinancialChat] Error parsing preloaded context:', error);
        sessionStorage.removeItem('finn_preloaded_context');
      }
    }
  }, []);

  // Load a chat by ID
  const loadChat = (chatId) => {
    const chat = chatStorage.getChat(chatId);
    if (chat) {
      setCurrentChatId(chatId);
      setChatMessages(chat.messages || []);
      setArtifacts(chat.artifacts || []);
      chatStorage.setCurrentChatId(chatId);
      setShowSlideOutPanel(false); // Close panel when selecting a chat
    }
  };

  // Create new chat
  const handleNewChat = () => {
    const newChat = chatStorage.createChat();
    setCurrentChatId(newChat.id);
    setChatMessages([]);
    setArtifacts([]);
    refreshAllChatsAndArtifacts();
    setShowSlideOutPanel(false);
  };

  // Delete chat
  const handleDeleteChat = (chatId) => {
    chatStorage.deleteChat(chatId);
    refreshAllChatsAndArtifacts();
    if (chatId === currentChatId) {
      handleNewChat();
    }
  };

  // Format relative time for chat cards
  const formatRelativeTime = (isoString) => {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  // Calculate financial context for AI (enhanced version from your improved file)
  const getFinancialContext = () => {
    const yearTransactions = transactions.filter(t => {
      if (!t.date) return false;
      return new Date(t.date).getFullYear() === selectedYear;
    });

    let income = 0, expenses = 0, drawings = 0;
    const categoryBreakdown = {};
    const monthlyBreakdown = {};
    
    yearTransactions.forEach(t => {
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
      totalTransactions: transactions.length,
      yearToDateIncome: income,
      yearToDateExpenses: expenses,
      yearToDateDrawings: drawings,
      profit: income - expenses - drawings,
      profitMargin: income > 0 ? 
        ((income - expenses - drawings) / income * 100).toFixed(1) : 0,
      topExpenseCategories,
      topIncomeCategories,
      monthlyTrends: Object.values(monthlyBreakdown).sort((a, b) => a.month.localeCompare(b.month)),
      unidentifiedCount: unidentifiedTransactions.length,
      learnedPatterns: categoryMapping.reduce((sum, cat) => sum + cat.identifiers.length, 0),
      selectedYear: selectedYear,
      categorizationRate: transactions.length > 0 ?
        ((transactions.length / (transactions.length + unidentifiedTransactions.length)) * 100).toFixed(1) : 0
    };
  };

  // Detect if a query is a quick/simple greeting or casual question
  // These can be handled with minimal context for faster responses
  const isQuickQuery = (message) => {
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
      // Simple questions like "How am I doing?" are still quick
      if (lowerMsg.startsWith('how are') || lowerMsg.startsWith('what\'s up') || lowerMsg === 'help' || lowerMsg === 'help?') {
        return { isQuick: true, type: 'casual' };
      }
    }

    return { isQuick: false, type: 'full' };
  };

  // Format AI response for better readability (from your improved version)
  const formatAIResponse = (text) => {
    const paragraphs = text.split('\n\n').filter(p => p.trim());

    return paragraphs.map((paragraph, index) => {
      const trimmed = paragraph.trim();

      // Handle numbered lists
      if (trimmed.match(/^\d+\./)) {
        return (
          <div key={index} style={{ marginBottom: '0.75rem' }}>
            <div style={{ backgroundColor: `${COLORS.slainteBlue}15`, padding: '0.75rem', borderRadius: '0.5rem', borderLeft: `4px solid ${COLORS.slainteBlue}` }}>
              {trimmed}
            </div>
          </div>
        );
      }

      // Handle bullet points
      if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
        return (
          <div key={index} style={{ marginBottom: '0.5rem' }}>
            <div style={{ backgroundColor: COLORS.backgroundGray, padding: '0.5rem', borderRadius: '0.25rem', borderLeft: `2px solid ${COLORS.lightGray}` }}>
              {trimmed}
            </div>
          </div>
        );
      }

      // Handle headers (text starting with **)
      if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        const headerText = trimmed.slice(2, -2);
        return (
          <h4 key={index} style={{ fontWeight: 600, color: COLORS.darkGray, marginTop: '1rem', marginBottom: '0.5rem', fontSize: '1rem' }}>
            {headerText}
          </h4>
        );
      }

      // Handle sub-headers or emphasized text
      if (trimmed.includes('**')) {
        const parts = trimmed.split('**');
        return (
          <p key={index} style={{ marginBottom: '0.75rem', lineHeight: 1.625 }}>
            {parts.map((part, i) =>
              i % 2 === 1 ? <strong key={i} style={{ fontWeight: 600, color: COLORS.darkGray }}>{part}</strong> : part
            )}
          </p>
        );
      }

      // Regular paragraphs
      return (
        <p key={index} style={{ marginBottom: '0.75rem', lineHeight: 1.625, color: COLORS.darkGray }}>
          {trimmed}
        </p>
      );
    });
  };

  // Handle chat submission with proxy server and conversation history
  const handleChatSubmit = async (message) => {
    if (!message.trim()) return;

    if (!apiKey) {
      alert('License key not configured. Please set up your license key in the app settings.');
      return;
    }

    const timestamp = new Date().toISOString();
    const userMessage = { 
      type: 'user', 
      content: message,
      timestamp: timestamp,
      id: `user-${Date.now()}`
    };

    setChatMessages(prev => [...prev, userMessage]);

    // Save user message to chat storage
    if (currentChatId) {
      chatStorage.addMessage(currentChatId, userMessage);
    }

    setIsLoading(true);
    
    // Check if this is a quick query (greeting, thanks, etc.)
    const queryType = isQuickQuery(message);

    const loadingMessage = {
      type: 'assistant',
      content: queryType.isQuick
        ? 'One moment...'
        : 'Finn is considering his response based on what he knows of the practice. Please give him a moment...',
      isLoading: true,
      timestamp: timestamp,
      id: `loading-${Date.now()}`
    };

    setChatMessages(prev => [...prev, loadingMessage]);

    // For quick queries, use a fast path with minimal context
    if (queryType.isQuick) {
      try {
        let token;
        if (window.electronAPI?.isElectron) {
          token = await window.electronAPI.getInternalToken();
        } else {
          token = localStorage.getItem('partner_token');
          if (!token) {
            throw new Error('Authentication required. Please log in.');
          }
        }

        // Simple system prompt for quick responses
        const quickSystemPrompt = `You are Finn, a warm and professional Irish financial advisor for GP practices. You work for Sláinte Finance.

${queryType.type === 'greeting' ? 'The user is greeting you. Respond warmly but briefly. Mention you\'re ready to help with their practice finances.' : ''}
${queryType.type === 'acknowledgment' ? 'The user is thanking you or acknowledging something. Respond graciously and briefly. Offer to help with anything else.' : ''}
${queryType.type === 'casual' ? 'The user is asking a casual question. Be friendly and helpful. If they need more detailed analysis, offer to dive deeper.' : ''}

Keep your response to 1-3 sentences maximum. Be warm but concise.`;

        const quickMessages = [
          { role: "user", content: quickSystemPrompt },
          { role: "assistant", content: "Understood, I'll be Finn - warm, professional, and concise." },
          { role: "user", content: message }
        ];

        const response = await fetch("http://localhost:3001/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            message: JSON.stringify({
              model: "claude-haiku-4-5-20251001", // Fast model for quick responses
              max_tokens: 256,
              messages: quickMessages
            })
          })
        });

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();

        // Remove loading message
        setChatMessages(prev => prev.filter(msg => !msg.isLoading));
        setIsLoading(false);

        // Extract response
        let claudeResponse = '';
        if (data.content && Array.isArray(data.content)) {
          claudeResponse = data.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('\n\n');
        } else if (data.content && data.content[0]?.text) {
          claudeResponse = data.content[0].text;
        }

        const assistantMessage = {
          type: 'assistant',
          content: claudeResponse,
          timestamp: new Date().toISOString(),
          id: `assistant-${Date.now()}`
        };

        setChatMessages(prev => [...prev, assistantMessage]);

        if (currentChatId) {
          chatStorage.addMessage(currentChatId, assistantMessage);
        }

        return; // Exit early for quick queries
      } catch (error) {
        console.error('Quick query error:', error);
        // Fall through to full query handling on error
      }
    }

    const financialContext = getFinancialContext();

    // Build conversation history for Claude - include all previous messages
    const conversationMessages = [];

    // Get practice profile context
    const practiceContext = getCiaranContext();

    // Build GMS Health Check context if available
    const buildGMSHealthCheckContext = () => {
      // Check if health check has been run
      if (!profile?.healthCheckData?.healthCheckComplete) {
        return `**GMS HEALTH CHECK TOOL:**
The practice has a GMS Health Check tool available in the app but has not yet run it. This tool analyzes their GMS panel data, identifies unclaimed income opportunities, and generates personalized recommendations. If the user asks about GMS optimization, unclaimed income, or panel management, you can suggest they run the GMS Health Check in the app.`;
      }

      // Run the analysis
      try {
        const analysisResults = analyzeGMSIncome(paymentAnalysisData, profile, profile.healthCheckData);
        const recommendations = generateRecommendations(analysisResults, profile, profile.healthCheckData, paymentAnalysisData);

        if (!analysisResults || !recommendations) {
          return '';
        }

        const parts = [];
        parts.push('**GMS HEALTH CHECK ANALYSIS:**');
        parts.push('The practice has run a GMS Health Check. Below are the findings and recommendations.');

        // Summary of unclaimed income
        if (analysisResults.totalUnclaimedPotential > 0) {
          parts.push(`\n**Total Unclaimed GMS Income Potential: €${analysisResults.totalUnclaimedPotential.toLocaleString()}**`);
        }

        // Breakdown by category
        if (analysisResults.capitationDetails) {
          const cap = analysisResults.capitationDetails;
          if (cap.unclaimedAmount > 0) {
            parts.push(`- Unclaimed Capitation: €${cap.unclaimedAmount.toLocaleString()}`);
          }
        }
        if (analysisResults.practiceSupportDetails?.unclaimedAmount > 0) {
          parts.push(`- Unclaimed Practice Support: €${analysisResults.practiceSupportDetails.unclaimedAmount.toLocaleString()}`);
        }
        if (analysisResults.leaveDetails) {
          const leave = analysisResults.leaveDetails;
          const totalLeaveUnclaimed = (leave.studyLeavePotential || 0) + (leave.annualLeavePotential || 0);
          if (totalLeaveUnclaimed > 0) {
            parts.push(`- Unclaimed Leave Payments: €${totalLeaveUnclaimed.toLocaleString()} (Study: €${(leave.studyLeavePotential || 0).toLocaleString()}, Annual: €${(leave.annualLeavePotential || 0).toLocaleString()})`);
          }
        }
        if (analysisResults.cdmDetails?.unclaimedAmount > 0) {
          parts.push(`- Unclaimed CDM (Chronic Disease Management): €${analysisResults.cdmDetails.unclaimedAmount.toLocaleString()}`);
        }
        if (analysisResults.cervicalDetails?.unclaimedAmount > 0) {
          parts.push(`- Unclaimed Cervical Screening: €${analysisResults.cervicalDetails.unclaimedAmount.toLocaleString()}`);
        }

        // Priority Recommendations
        if (recommendations.priorityRecommendations?.length > 0) {
          parts.push('\n**PRIORITY RECOMMENDATIONS (Quick Wins):**');
          recommendations.priorityRecommendations.slice(0, 5).forEach((rec, i) => {
            parts.push(`${i + 1}. **${rec.title}** - Potential: €${rec.potential.toLocaleString()}`);
            if (rec.summary) parts.push(`   ${rec.summary}`);
            if (rec.actions?.length > 0) {
              parts.push(`   Actions: ${rec.actions.map(a => a.action).join('; ')}`);
            }
          });
        }

        // Growth Opportunities
        if (recommendations.growthOpportunities?.length > 0) {
          parts.push('\n**GROWTH OPPORTUNITIES (Longer-term):**');
          recommendations.growthOpportunities.slice(0, 5).forEach((rec, i) => {
            parts.push(`${i + 1}. **${rec.title}** - Potential: €${rec.potential.toLocaleString()}`);
            if (rec.summary) parts.push(`   ${rec.summary}`);
          });
        }

        parts.push('\n**USAGE RULES FOR GMS HEALTH CHECK DATA:**');
        parts.push('- Only reference this GMS data when the user asks about GMS income, panel management, unclaimed payments, or practice optimization');
        parts.push('- When discussing these topics, reference specific recommendations and potential values');
        parts.push('- If the user asks about a specific recommendation, provide detailed guidance on how to implement it');
        parts.push('- Do NOT bring up GMS Health Check data when the user is asking about unrelated topics (like general P&L, staff costs unrelated to GMS, etc.)');

        return parts.join('\n');
      } catch (err) {
        console.error('Error building GMS Health Check context:', err);
        return '';
      }
    };

    const gmsHealthCheckContext = buildGMSHealthCheckContext();

    // Check for preloaded context from Interactive GMS Health Check
    let interactiveHealthCheckContext = '';
    const storedContext = sessionStorage.getItem('finn_context_for_next_message');
    if (storedContext) {
      interactiveHealthCheckContext = `
**INTERACTIVE GMS HEALTH CHECK CONTEXT:**
The user has just completed an Interactive GMS Health Check with AI-generated insights. They clicked "Discuss with Finn" to ask follow-up questions. You already provided an initial greeting. Use the following comprehensive analysis data to inform your responses:

${storedContext}

When responding to their questions:
- Be specific and reference actual figures from this analysis
- Provide practical, actionable advice for their situation
- Be pragmatic about what's achievable given their practice size
- If they ask about something not covered, let them know what additional information would help

`;
      // Clear after first use - context is now embedded in the conversation
      sessionStorage.removeItem('finn_context_for_next_message');
    }

    // System prompt with financial context (first message)
    const systemPrompt = `You are Finn, an expert financial advisor specializing in Irish GP practice management. You are having an ongoing conversation with a GP practice owner about their finances. Remember our previous discussions and build upon them to provide increasingly personalized advice.

**YOUR APPROACH AS A PROFESSIONAL ADVISOR:**

Before responding to any request, you should:

1. **Consider the question thoughtfully** - What is the user really asking? What would a specialist financial advisor need to know to give proper advice?

2. **Assess what information you need:**
   - Do you have all the data required in the practice profile and transaction data below?
   - Are there Irish-specific regulations, benchmarks, or current market conditions you should verify?
   - Would current information from the web improve your advice (e.g., current tax rates, HSE payment schedules, industry benchmarks)?
   - Are there ambiguities or missing details you should clarify with the user?

3. **Gather information proactively:**
   - If you need current/factual information: USE web_search to get accurate, up-to-date information
   - If you need clarification from the user: ASK specific questions before giving advice
   - Don't make assumptions - if you're unsure, search or ask first

4. **Then provide considered advice:**
   - Give thoughtful, evidence-based recommendations
   - Reference specific data points from their practice
   - Explain your reasoning like a professional advisor would
   - Be direct but warm

**Example of thoughtful approach:**
- User asks: "Should I hire another receptionist?"
- You think: "I need to understand their current staff costs, workload, and whether they have capacity. I should also check current salary benchmarks for Irish GP receptionists."
- You respond: "Let me help you think this through properly. First, let me check current salary benchmarks for GP receptionists in Ireland..." [uses web_search] "Based on current market rates of €28k-€35k, and looking at your practice data, I can see your current reception costs are €X. Before I give you advice, can you tell me what's driving this - are you experiencing long wait times, staff burnout, or expanding services?"

${practiceContext}

${gmsHealthCheckContext}

${interactiveHealthCheckContext}

**TRANSACTION DATA FOR ${financialContext.selectedYear}:**
- Total transactions processed: ${financialContext.totalTransactions}
- Gross income: €${financialContext.yearToDateIncome.toLocaleString()}
- Total expenses: €${financialContext.yearToDateExpenses.toLocaleString()}
- Partner drawings: €${financialContext.yearToDateDrawings.toLocaleString()}
- Net profit: €${financialContext.profit.toLocaleString()}
- Profit margin: ${financialContext.profitMargin}%
- Data quality: ${financialContext.categorizationRate}% transactions categorized

**TOP EXPENSE CATEGORIES:**
${financialContext.topExpenseCategories.map((cat, i) =>
  `${i + 1}. ${cat.name}: €${cat.value.toLocaleString()} (${((cat.value / financialContext.yearToDateExpenses) * 100).toFixed(1)}%)`
).join('\n')}

**INCOME BREAKDOWN:**
${financialContext.topIncomeCategories.map((cat, i) =>
  `${i + 1}. ${cat.name}: €${cat.value.toLocaleString()} (${((cat.value / financialContext.yearToDateIncome) * 100).toFixed(1)}%)`
).join('\n')}

**MONTHLY PERFORMANCE:**
${financialContext.monthlyTrends.map(month =>
  `${month.month}: Income €${month.income.toLocaleString()}, Expenses €${month.expenses.toLocaleString()}, Net €${(month.income - month.expenses).toLocaleString()}`
).join('\n')}

As their trusted financial advisor, provide specific, actionable advice. Remember our conversation history and build upon previous recommendations.

**IMPORTANT CONTEXT USAGE RULES:**
- This financial data is reference material - only mention it when directly relevant to their question
- Don't recite profit margins or income totals unless the question specifically relates to overall performance
- For specific questions (e.g., "How are my staff costs?"), focus only on that topic
- For general questions (e.g., "How am I doing?"), provide an overview using the data
- Use your judgment: if they're asking about a specific transaction or category, don't bring up unrelated financial metrics

IMPORTANT: This is a continuing conversation - refer back to previous topics we've discussed and build upon them.

**WEB SEARCH TOOL - USE IT PROACTIVELY:**

You have access to a web_search tool. Think of it as your research assistant - use it frequently to provide accurate, current information that strengthens your advice.

**When to use web search (use liberally!):**
- ✅ Current Irish tax rates, thresholds, and allowances (2025 rates)
- ✅ HSE payment schedules, GMS contract updates, PCRS changes
- ✅ Industry benchmarks: "average GP practice profit margin Ireland 2025"
- ✅ Current salary benchmarks: "GP receptionist salary Ireland 2025"
- ✅ Regulatory requirements: "Irish GP practice accounting requirements"
- ✅ Market conditions: "Irish GP practice expenses rising 2025"
- ✅ Before recommending ANY specific company, product, or service name
- ✅ Software/tools: "Irish GP practice management software 2025"
- ✅ Any factual claim you're uncertain about

**How to use web search effectively:**
- Limit to 2-3 searches per response (be strategic)
- Use specific queries with year/location: "Irish GP locum rates 2025" not just "locum rates"
- Search BEFORE giving advice, not after
- Use search results to ground your recommendations in facts

**Examples of thoughtful search usage:**
- User asks about expenses: Search "Irish GP practice average expenses 2025" to provide benchmarks
- User asks about staffing: Search "GP practice staff costs Ireland 2025" for current data
- User asks about tax: Search "Irish self-employed GP tax rates 2025" for accurate rates
- User asks about recommendations: Search for specific companies/products before suggesting them

**CRITICAL: NEVER invent or hallucinate:**
- Don't make up company names, statistics, or regulations
- If you need facts: SEARCH FIRST
- If you can't find something: Say so and explain what to look for
- Better to search and find nothing than to invent something

**Search examples:**
- ✅ "Let me check current Irish GP salary benchmarks..." [searches "Irish GP salary 2025"]
- ✅ "I'll look up the latest HSE payment rates..." [searches "HSE GP payment rates 2025"]
- ✅ "Let me verify current tax treatment..." [searches "Irish self-employed GP tax 2025"]

**RESPONSE STYLE - NATURAL CONVERSATION WITH SMART ARTIFACT USAGE:**

Your responses should feel natural and conversational, like a real financial advisor having a chat.

**For simple questions and casual conversation: Respond inline**
- Keep it conversational - like chatting over coffee
- Use 1-4 paragraphs for typical responses
- Include specific numbers directly in your message
- Be personable and build on previous conversations

**For analytical questions that require data analysis: Create an artifact**
When the user asks you to analyze, review, compare, or break down their financial data, CREATE AN ARTIFACT. This includes:
- Expense analysis or breakdowns
- Income analysis
- Profit analysis or margins
- Category comparisons
- Trend analysis
- Monthly/quarterly/annual reviews
- Any request involving tables or multiple data points
- Anything you'd want to print or share with an accountant

**Examples that SHOULD be artifacts:**
- "Analyze my expenses" → Artifact with expense breakdown
- "How are my staff costs?" → Artifact with staff cost analysis and comparison
- "Break down my income" → Artifact with income analysis
- "Show me my Q4 performance" → Artifact with quarterly review
- "Compare this year to last year" → Artifact with comparison tables
- "What are my biggest expenses?" → Artifact with ranked expense analysis

**Examples that should be INLINE (not artifacts):**
- "Hi Finn" → Greeting, inline
- "Thanks!" → Acknowledgment, inline
- "Should I hire someone?" → Advisory question, inline (unless they ask for detailed analysis)
- "What do you think about X?" → Opinion/advice, inline
- "Can you explain capitation?" → Educational, inline

**When you DO need to create an artifact, follow this thoughtful process:**

**BEFORE creating the artifact:**
1. **Assess if you need more information:**
   - Do you need to search for industry benchmarks, current rates, or best practices?
   - Should you ask the user clarifying questions first?
   - Is there missing data that would make the report incomplete?

2. **If information is needed:**
   - Use web_search to get current benchmarks, rates, regulations
   - Ask the user specific questions to understand their goals/concerns
   - Gather what you need BEFORE starting the artifact

**THEN use this three-part structure:**

1. **Introduction** (3-5 sentences before the artifact):
   - Acknowledge their question naturally and show you've thought about it
   - Mention any research you've done ("I've checked current industry benchmarks...")
   - Share your main insight or observation upfront
   - Explain what you've prepared and why it's structured this way
   - Keep it warm but professional

2. **Artifact** (the detailed content):
   <artifact title="Descriptive Title" type="report">
   # Full Report Title

   [Comprehensive structured content with sections, tables, analysis backed by data/research]
   </artifact>

3. **Conclusion** (2-4 sentences after the artifact):
   - Summarize the key takeaway or action item
   - Reference specific numbers or recommendations from the report
   - Offer to dive deeper into any specific area or do additional research
   - End with a helpful question or next step

**Example of a thoughtful artifact response:**

"This is a great question about your Q4 performance. Before diving in, let me check current industry benchmarks for Irish GP practices... [uses web_search for 'Irish GP practice profit margins 2025']. Based on what I'm seeing, the average profit margin for similar practices is running at 22-28% right now.

Looking at your numbers, your Q4 income held steady at €180k which is solid, but I'm seeing a 15% jump in expenses compared to Q3 - that's worth understanding. I've analyzed your complete Q4 data against industry benchmarks and your historical performance. I've structured this as a detailed report so you can see exactly where every euro went and what it means for your practice.

<artifact title="Q4 2024 Financial Performance Review" type="report">
# Q4 2024 Financial Performance Review

## Executive Summary
Your Q4 profit margin was 18.5%, below the industry average of 22-28% for similar Irish GP practices. The primary driver was a €27k increase in staff costs...

## Income Analysis
[Detailed breakdown with specific numbers and comparisons...]

## Expense Trends
[Comprehensive review with benchmarks...]

## Strategic Recommendations
Based on current market conditions and your practice profile:
1. Staff cost optimization: Your reception costs are 8% above sector average...
[Specific, actionable recommendations backed by data...]
</artifact>

The key finding is that staff costs increase of €27k - your total staff spend is now running at €165k annually, which is about 8% above the Irish GP practice average for a practice of your size. Is this the new receptionist you mentioned last month? I can help you model different scenarios for 2025, or we can dive into any of these categories in more detail. What would be most useful?"

**Remember:** Think before you write. Search for facts. Ask questions. Then provide comprehensive, evidence-based analysis.`;

    // Add the system prompt as the first message
    conversationMessages.push({ role: "user", content: systemPrompt });
    conversationMessages.push({ 
      role: "assistant", 
      content: "I understand. I'm your AI financial advisor and I'll remember our conversations to provide increasingly personalized advice for your GP practice. I have your complete financial data and I'm ready to help with any questions or concerns you have about your practice's financial health." 
    });

    // Add all previous conversation messages (excluding loading messages and system setup)
    const relevantMessages = chatMessages.filter(msg => 
      !msg.isLoading && !msg.isError && msg.content !== 'Analyzing your financial data with AI...'
    );

    relevantMessages.forEach(msg => {
      if (msg.type === 'user') {
        conversationMessages.push({ role: "user", content: msg.content });
      } else if (msg.type === 'assistant') {
        conversationMessages.push({ role: "assistant", content: msg.content });
      }
    });

    // Add the current user message
    conversationMessages.push({ role: "user", content: message });

    // Define Anthropic's built-in web search tool
    // This is a server-side tool that Anthropic executes automatically
    const tools = [{
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 3  // Limit searches per request to control costs
    }];

    try {
        // Use Claude API via HTTP endpoint (supports built-in tools like web search)
        let data;
        let token;

        if (window.electronAPI?.isElectron) {
          token = await window.electronAPI.getInternalToken();
        } else {
          token = localStorage.getItem('partner_token');
          if (!token) {
            throw new Error('Authentication required. Please log in.');
          }
        }

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
              messages: conversationMessages,
              tools: tools
            })
          })
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            throw new Error('Authentication expired. Please log in again.');
          }
          throw new Error(`API request failed: ${response.status}`);
        }

        data = await response.json();

      // Remove the loading message
      setChatMessages(prev => prev.filter(msg => !msg.isLoading));
      setIsLoading(false);

      // Get Claude's response - extract text from content blocks
      // With web search, response may contain multiple content blocks (text, web_search_tool_result, etc.)
      let claudeResponse = '';
      if (data.content && Array.isArray(data.content)) {
        // Extract all text blocks and concatenate them
        claudeResponse = data.content
          .filter(block => block.type === 'text')
          .map(block => block.text)
          .join('\n\n');

        // Log if web search was used (for debugging)
        const searchResults = data.content.filter(block => block.type === 'web_search_tool_result');
        if (searchResults.length > 0) {
          console.log('[FinancialChat] Web search was used:', searchResults.length, 'searches performed');
        }
      } else if (data.content && data.content[0]?.text) {
        // Fallback for simple responses
        claudeResponse = data.content[0].text;
      }

      // Try to parse artifact tags first (new method)
      const parsedArtifact = parseArtifactResponse(claudeResponse);
      console.log('Parsed artifact:', parsedArtifact);

      let chatContent = claudeResponse;
      let artifactMetadata = null;
      let artifactContent = null;

      if (parsedArtifact) {
        // New format: response has intro + artifact tags + conclusion
        const introPart = parsedArtifact.intro || `I've prepared a detailed analysis for you. See the full report below.`;
        const conclusionPart = parsedArtifact.conclusion || '';

        // Combine intro and conclusion with artifact reference in between
        chatContent = conclusionPart
          ? `${introPart}\n\n[Detailed report below]\n\n${conclusionPart}`
          : introPart;

        artifactMetadata = {
          type: parsedArtifact.artifact.type,
          title: parsedArtifact.artifact.title,
          format: 'markdown'
        };
        artifactContent = parsedArtifact.artifact.content;
        console.log('Using new artifact format with intro and conclusion');
      } else {
        // Legacy format: check if response should be an artifact
        console.log('Checking for artifact (legacy). Response length:', claudeResponse.length);
        artifactMetadata = shouldCreateArtifact(claudeResponse);
        console.log('Artifact metadata (legacy):', artifactMetadata);

        if (artifactMetadata) {
          // Old format: replace entire response with generic message
          chatContent = `I've prepared a detailed ${artifactMetadata.title} for you. Click "View Full Report" below to see the complete analysis with all details, charts, and recommendations.`;
          artifactContent = claudeResponse;
        }
      }

      const assistantMessage = {
        type: 'assistant',
        content: chatContent,
        timestamp: new Date().toISOString(),
        id: `assistant-${Date.now()}`,
        context: {
          year: selectedYear,
          transactionCount: transactions.length,
          income: financialContext.yearToDateIncome,
          expenses: financialContext.yearToDateExpenses,
          profit: financialContext.profit,
          conversationLength: relevantMessages.length + 1 // Track conversation depth
        }
      };

      setChatMessages(prev => [...prev, assistantMessage]);

      // Save assistant message to chat storage
      if (currentChatId) {
        chatStorage.addMessage(currentChatId, assistantMessage);

        if (artifactMetadata && artifactContent) {
          // Create artifact with same timestamp as message for matching
          const artifact = createArtifact(artifactContent, {
            ...artifactMetadata,
            created_at: assistantMessage.timestamp
          });
          console.log('Created artifact:', artifact);
          chatStorage.addArtifact(currentChatId, artifact);
          setArtifacts(prev => [...prev, artifact]);
        }
      }
      
    } catch (error) {
      console.error('Chat error details:', error);
      
      // Remove the loading message
      setChatMessages(prev => prev.filter(msg => !msg.isLoading));
      setIsLoading(false);
      
      let errorMessage = 'I apologize, but I encountered an error analyzing your financial data.';
      
      if (error.message.includes('Invalid API key')) {
        errorMessage = 'Invalid license key. Please contact support to verify your license.';
      } else if (error.message.includes('Rate limit')) {
        errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Cannot connect to API server. Please ensure the desktop app is running.';
      } else if (error.message.includes('Authentication')) {
        errorMessage = error.message;
      } else {
        errorMessage = `Error: ${error.message}. Please try again or check the console for details.`;
      }
      
      setChatMessages(prev => [...prev, { 
        type: 'assistant', 
        content: errorMessage,
        timestamp: new Date().toISOString(),
        id: `error-${Date.now()}`,
        isError: true
      }]);
    }
  };

  // Retry last failed message
  const retryLastMessage = () => {
    const lastUserMessage = chatMessages
      .filter(msg => msg.type === 'user')
      .pop();
    
    if (lastUserMessage) {
      setChatMessages(prev => 
        prev.filter(msg => !msg.isError && !msg.isLoading)
      );
      handleChatSubmit(lastUserMessage.content);
    }
  };

  // Clear chat history
  const clearChatHistory = () => {
    if (window.confirm('Are you sure you want to clear all chat history? This cannot be undone.')) {
      chatStorage.clearAll();
      handleNewChat();
    }
  };

  // Export chat as text
  const exportChatAsText = () => {
    if (chatMessages.length === 0) {
      alert('No chat history to export.');
      return;
    }

    const chatText = chatMessages
      .filter(msg => !msg.isLoading)
      .map(msg => {
        const timestamp = new Date(msg.timestamp).toLocaleString();
        const role = msg.type === 'user' ? 'YOU' : 'FINANCIAL ASSISTANT';
        return `[${timestamp}] ${role}:\n${msg.content}\n\n`;
      })
      .join('');

    const financialContext = getFinancialContext();
    const header = `GP PRACTICE FINANCIAL CHAT EXPORT
Export Date: ${new Date().toLocaleString()}
Analysis Year: ${selectedYear}
Total Transactions: ${transactions.length}
Year-to-Date Income: €${financialContext.yearToDateIncome.toLocaleString()}
Year-to-Date Expenses: €${financialContext.yearToDateExpenses.toLocaleString()}
Net Profit: €${financialContext.profit.toLocaleString()}

CHAT HISTORY:
================

`;

    const fullContent = header + chatText;
    const blob = new Blob([fullContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GP-Practice-Financial-Chat-${selectedYear}-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Copy message to clipboard
  const copyMessage = async (content) => {
    try {
      await navigator.clipboard.writeText(content);
      alert('Message copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy message to clipboard.');
    }
  };

  // Handle input key events
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const message = e.target.value.trim();
      if (message) {
        handleChatSubmit(message);
        e.target.value = '';
      }
    }
  };

  // Handle send button click
  const handleSendClick = () => {
    const input = chatInputRef.current;
    if (input && input.value.trim()) {
      handleChatSubmit(input.value.trim());
      input.value = '';
    }
  };

  const financialContext = getFinancialContext();

  // Quick question suggestions for empty state
  const quickQuestions = [
    { text: "How is my practice performing financially?", color: COLORS.slainteBlue },
    { text: "What are my biggest expense categories?", color: COLORS.expenseColor },
    { text: "Give me a financial health assessment", color: COLORS.incomeColor },
    { text: "What opportunities do you see for growth?", color: COLORS.highlightYellow }
  ];

  const handleQuickQuestion = (question) => {
    if (apiKey && transactions.length > 0 && !isLoading) {
      handleChatSubmit(question);
    }
  };

  // Get recent 4 chats for header cards (only show chats with messages)
  const recentChats = allChats.filter(chat => chat.messages && chat.messages.length > 0).slice(0, 4);
  const recentArtifacts = allArtifacts.slice(0, 4);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 220px)' }} data-tour-id="financial-consultation-section">
      {/* Header Card with Tabs */}
      <div style={{
        backgroundColor: COLORS.white,
        borderRadius: '0.75rem',
        border: `1px solid ${COLORS.lightGray}`,
        padding: '1rem 1.25rem',
        marginBottom: '1rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        {/* Top Row: Title + Tabs + Settings */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              background: `linear-gradient(135deg, ${COLORS.slainteBlue}15 0%, ${COLORS.slainteBlue}08 100%)`,
              borderRadius: '0.625rem',
              padding: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Sparkles style={{ height: '1.25rem', width: '1.25rem', color: COLORS.slainteBlue }} />
            </div>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: COLORS.darkGray }}>
              Finn - <span style={{ fontWeight: 400, color: COLORS.mediumGray }}>Your Practice Chief Financial Officer</span>
            </h2>
          </div>

          {/* Tabs in the middle-right area */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <button
              onClick={() => setHeaderTab('chats')}
              style={{
                padding: '0.4rem 0.75rem',
                backgroundColor: headerTab === 'chats' ? `${COLORS.slainteBlue}10` : 'transparent',
                color: headerTab === 'chats' ? COLORS.slainteBlue : COLORS.mediumGray,
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (headerTab !== 'chats') e.currentTarget.style.backgroundColor = COLORS.backgroundGray;
              }}
              onMouseLeave={(e) => {
                if (headerTab !== 'chats') e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <MessageCircle style={{ height: '0.8rem', width: '0.8rem' }} />
              Recent Chats
              {allChats.filter(c => c.messages && c.messages.length > 0).length > 0 && (
                <span style={{
                  backgroundColor: headerTab === 'chats' ? COLORS.slainteBlue : COLORS.lightGray,
                  color: headerTab === 'chats' ? COLORS.white : COLORS.mediumGray,
                  fontSize: '0.6rem',
                  padding: '0.1rem 0.35rem',
                  borderRadius: '0.75rem',
                  fontWeight: 600
                }}>{allChats.filter(c => c.messages && c.messages.length > 0).length}</span>
              )}
            </button>
            <button
              onClick={() => setHeaderTab('artifacts')}
              style={{
                padding: '0.4rem 0.75rem',
                backgroundColor: headerTab === 'artifacts' ? `${COLORS.slainteBlue}10` : 'transparent',
                color: headerTab === 'artifacts' ? COLORS.slainteBlue : COLORS.mediumGray,
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (headerTab !== 'artifacts') e.currentTarget.style.backgroundColor = COLORS.backgroundGray;
              }}
              onMouseLeave={(e) => {
                if (headerTab !== 'artifacts') e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <FileText style={{ height: '0.8rem', width: '0.8rem' }} />
              Reports
              {allArtifacts.length > 0 && (
                <span style={{
                  backgroundColor: headerTab === 'artifacts' ? COLORS.slainteBlue : COLORS.lightGray,
                  color: headerTab === 'artifacts' ? COLORS.white : COLORS.mediumGray,
                  fontSize: '0.6rem',
                  padding: '0.1rem 0.35rem',
                  borderRadius: '0.75rem',
                  fontWeight: 600
                }}>{allArtifacts.length}</span>
              )}
            </button>

            {/* New Chat button */}
            <button
              onClick={handleNewChat}
              style={{
                padding: '0.4rem 0.75rem',
                backgroundColor: COLORS.slainteBlue,
                color: COLORS.white,
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                transition: 'all 0.2s',
                marginLeft: '0.5rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#1e40af';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = COLORS.slainteBlue;
              }}
            >
              <Plus style={{ height: '0.8rem', width: '0.8rem' }} />
              New Chat
            </button>

          </div>
        </div>

        {/* Tab Content: Recent Chats */}
        {headerTab === 'chats' && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'stretch' }}>
            {recentChats.length > 0 ? (
              <>
                {recentChats.map((chat, idx) => {
                  // Subtle color accents for each card position
                  const cardColors = [
                    { bg: COLORS.slainteBlue, light: `${COLORS.slainteBlue}08`, border: `${COLORS.slainteBlue}20` },
                    { bg: COLORS.incomeColor, light: `${COLORS.incomeColor}06`, border: `${COLORS.incomeColor}18` },
                    { bg: '#8b5cf6', light: 'rgba(139,92,246,0.05)', border: 'rgba(139,92,246,0.15)' }, // purple
                    { bg: COLORS.highlightYellow, light: `${COLORS.highlightYellow}08`, border: `${COLORS.highlightYellow}25` }
                  ];
                  const cardColor = cardColors[idx % cardColors.length];
                  const isSelected = chat.id === currentChatId;

                  return (
                    <div
                      key={chat.id}
                      onClick={() => loadChat(chat.id)}
                      style={{
                        flex: '1 1 0',
                        minWidth: 0,
                        maxWidth: '200px',
                        padding: '0.75rem',
                        background: isSelected
                          ? `linear-gradient(135deg, ${cardColor.bg}15 0%, ${cardColor.bg}08 100%)`
                          : `linear-gradient(135deg, ${cardColor.light} 0%, ${COLORS.white} 100%)`,
                        border: `1px solid ${isSelected ? cardColor.bg + '50' : cardColor.border}`,
                        borderLeft: `3px solid ${cardColor.bg}${isSelected ? '' : '60'}`,
                        borderRadius: '0.625rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = cardColor.bg + '40';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = isSelected ? cardColor.bg + '50' : cardColor.border;
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <p style={{
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        color: COLORS.darkGray,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginBottom: '0.375rem'
                      }}>
                        {chat.title || 'New conversation'}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem', color: COLORS.mediumGray }}>
                        <Clock style={{ height: '0.7rem', width: '0.7rem', color: cardColor.bg }} />
                        {formatRelativeTime(chat.updated_at)}
                        <span style={{ color: COLORS.lightGray }}>•</span>
                        {chat.messages?.length || 0} msgs
                      </div>
                    </div>
                  );
                })}
                {allChats.filter(c => c.messages && c.messages.length > 0).length > 4 && (
                  <button
                    onClick={() => setShowSlideOutPanel(true)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.75rem',
                      minWidth: '80px',
                      background: 'none',
                      border: `1px dashed ${COLORS.lightGray}`,
                      borderRadius: '0.625rem',
                      cursor: 'pointer',
                      color: COLORS.mediumGray,
                      fontSize: '0.75rem',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = COLORS.slainteBlue;
                      e.currentTarget.style.color = COLORS.slainteBlue;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = COLORS.lightGray;
                      e.currentTarget.style.color = COLORS.mediumGray;
                    }}
                  >
                    <ChevronRight style={{ height: '1rem', width: '1rem', marginBottom: '0.25rem' }} />
                    View All
                  </button>
                )}
              </>
            ) : (
              <div style={{ padding: '1rem', color: COLORS.mediumGray, fontSize: '0.8rem', textAlign: 'center', width: '100%' }}>
                No conversations yet. Start a new chat!
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Artifacts */}
        {headerTab === 'artifacts' && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'stretch' }}>
            {recentArtifacts.length > 0 ? (
              <>
                {recentArtifacts.map((artifact, idx) => (
                  <div
                    key={artifact.id || idx}
                    onClick={() => setViewingArtifact(artifact)}
                    style={{
                      flex: '1 1 0',
                      minWidth: 0,
                      maxWidth: '200px',
                      padding: '0.75rem',
                      background: `linear-gradient(135deg, ${COLORS.incomeColor}06 0%, ${COLORS.white} 100%)`,
                      border: `1px solid ${COLORS.incomeColor}20`,
                      borderRadius: '0.625rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = COLORS.incomeColor + '50';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = COLORS.incomeColor + '20';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem' }}>
                      <FileText style={{ height: '0.8rem', width: '0.8rem', color: COLORS.incomeColor }} />
                      <span style={{ fontSize: '0.65rem', fontWeight: 600, color: COLORS.incomeColor, textTransform: 'uppercase' }}>
                        {artifact.type || 'Report'}
                      </span>
                    </div>
                    <p style={{
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      color: COLORS.darkGray,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginBottom: '0.375rem'
                    }}>
                      {artifact.title || 'Untitled Report'}
                    </p>
                    <div style={{ fontSize: '0.7rem', color: COLORS.mediumGray }}>
                      {formatRelativeTime(artifact.created_at)}
                    </div>
                  </div>
                ))}
                {allArtifacts.length > 4 && (
                  <button
                    onClick={() => setShowSlideOutPanel(true)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.75rem',
                      minWidth: '80px',
                      background: 'none',
                      border: `1px dashed ${COLORS.lightGray}`,
                      borderRadius: '0.625rem',
                      cursor: 'pointer',
                      color: COLORS.mediumGray,
                      fontSize: '0.75rem',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = COLORS.incomeColor;
                      e.currentTarget.style.color = COLORS.incomeColor;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = COLORS.lightGray;
                      e.currentTarget.style.color = COLORS.mediumGray;
                    }}
                  >
                    <ChevronRight style={{ height: '1rem', width: '1rem', marginBottom: '0.25rem' }} />
                    View All
                  </button>
                )}
              </>
            ) : (
              <div style={{ padding: '1rem', color: COLORS.mediumGray, fontSize: '0.8rem', textAlign: 'center', width: '100%' }}>
                No reports yet. Ask Finn for a detailed analysis to create one!
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input Area - Separate Card, positioned below Finn AI card when no messages */}
      {chatMessages.length === 0 && (
        <div style={{
          backgroundColor: COLORS.white,
          borderRadius: '0.75rem',
          border: `1px solid ${COLORS.lightGray}`,
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <div style={{
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'center',
            backgroundColor: COLORS.backgroundGray,
            borderRadius: '2rem',
            padding: '0.5rem 0.625rem 0.5rem 1.25rem',
            border: `1px solid ${COLORS.lightGray}`,
            transition: 'all 0.2s'
          }}>
            <input
              ref={chatInputRef}
              type="text"
              placeholder={!apiKey ? "Set up API key to start chatting..." : transactions.length === 0 ? "Upload transaction data to start..." : "Ask Finn about your practice and its finances..."}
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                padding: '0.625rem 0',
                fontSize: '0.9375rem',
                outline: 'none',
                color: COLORS.darkGray,
                fontWeight: 400
              }}
              disabled={!apiKey || transactions.length === 0 || isLoading}
              onKeyDown={handleKeyDown}
            />
            <button
              onClick={handleSendClick}
              style={{
                backgroundColor: (!apiKey || transactions.length === 0 || isLoading) ? COLORS.lightGray : COLORS.slainteBlue,
                color: COLORS.white,
                padding: '0.75rem',
                borderRadius: '50%',
                fontSize: '0.875rem',
                border: 'none',
                cursor: (!apiKey || transactions.length === 0 || isLoading) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                flexShrink: 0,
                boxShadow: (!apiKey || transactions.length === 0 || isLoading) ? 'none' : '0 2px 8px rgba(0,98,204,0.3)'
              }}
              disabled={!apiKey || transactions.length === 0 || isLoading}
              onMouseEnter={(e) => {
                if (!(!apiKey || transactions.length === 0 || isLoading)) {
                  e.currentTarget.style.backgroundColor = COLORS.slainteBlueDark;
                  e.currentTarget.style.transform = 'scale(1.05)';
                }
              }}
              onMouseLeave={(e) => {
                if (!(!apiKey || transactions.length === 0 || isLoading)) {
                  e.currentTarget.style.backgroundColor = COLORS.slainteBlue;
                  e.currentTarget.style.transform = 'scale(1)';
                }
              }}
            >
              <Send style={{ height: '1.125rem', width: '1.125rem' }} />
            </button>
          </div>
          {!apiKey && (
            <p style={{ fontSize: '0.7rem', color: COLORS.expenseColor, marginTop: '0.5rem', textAlign: 'center' }}>
              Click the settings icon to enter your API key
            </p>
          )}
          {apiKey && transactions.length === 0 && (
            <p style={{ fontSize: '0.7rem', color: COLORS.mediumGray, marginTop: '0.5rem', textAlign: 'center' }}>
              Upload transaction data to enable AI financial analysis
            </p>
          )}
        </div>
      )}

      {/* Main Chat Area - Full Height */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: COLORS.white,
        borderRadius: '0.75rem',
        border: `1px solid ${COLORS.lightGray}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        minHeight: 0,
        overflow: 'hidden'
      }}>
        {/* Minimal Chat Header */}
        {chatMessages.length > 0 && (
          <div style={{
            padding: '0.5rem 1rem',
            borderBottom: `1px solid ${COLORS.lightGray}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: COLORS.backgroundGray
          }}>
            <span style={{ fontSize: '0.75rem', color: COLORS.mediumGray }}>
              {chatMessages.filter(m => !m.isLoading).length} messages
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              {chatMessages.some(msg => msg.isError) && (
                <button
                  onClick={retryLastMessage}
                  style={{
                    padding: '0.25rem',
                    color: COLORS.expenseColor,
                    background: 'none',
                    border: 'none',
                    borderRadius: '0.25rem',
                    cursor: 'pointer'
                  }}
                  title="Retry"
                >
                  <RefreshCw style={{ height: '0.75rem', width: '0.75rem' }} />
                </button>
              )}
              <button
                onClick={() => copyMessage(chatMessages.filter(m => !m.isLoading).map(m => `${m.type.toUpperCase()}: ${m.content}`).join('\n\n'))}
                style={{
                  padding: '0.25rem',
                  color: COLORS.mediumGray,
                  background: 'none',
                  border: 'none',
                  borderRadius: '0.25rem',
                  cursor: 'pointer'
                }}
                title="Copy chat"
                onMouseEnter={(e) => e.currentTarget.style.color = COLORS.darkGray}
                onMouseLeave={(e) => e.currentTarget.style.color = COLORS.mediumGray}
              >
                <Copy style={{ height: '0.75rem', width: '0.75rem' }} />
              </button>
              <button
                onClick={exportChatAsText}
                style={{
                  padding: '0.25rem',
                  color: COLORS.mediumGray,
                  background: 'none',
                  border: 'none',
                  borderRadius: '0.25rem',
                  cursor: 'pointer'
                }}
                title="Export"
                onMouseEnter={(e) => e.currentTarget.style.color = COLORS.darkGray}
                onMouseLeave={(e) => e.currentTarget.style.color = COLORS.mediumGray}
              >
                <Download style={{ height: '0.75rem', width: '0.75rem' }} />
              </button>
              <button
                onClick={clearChatHistory}
                style={{
                  padding: '0.25rem',
                  color: COLORS.mediumGray,
                  background: 'none',
                  border: 'none',
                  borderRadius: '0.25rem',
                  cursor: 'pointer'
                }}
                title="Clear"
                onMouseEnter={(e) => e.currentTarget.style.color = COLORS.expenseColor}
                onMouseLeave={(e) => e.currentTarget.style.color = COLORS.mediumGray}
              >
                <Trash2 style={{ height: '0.75rem', width: '0.75rem' }} />
              </button>
            </div>
          </div>
        )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {chatMessages.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '2rem'
          }}>
            {/* Clean, minimal empty state */}
            <div style={{
              background: `linear-gradient(135deg, ${COLORS.slainteBlue}10 0%, ${COLORS.slainteBlue}03 100%)`,
              borderRadius: '50%',
              padding: '1.5rem',
              marginBottom: '1.5rem'
            }}>
              <Sparkles style={{ height: '2.5rem', width: '2.5rem', color: COLORS.slainteBlue }} />
            </div>

            {/* Quick question chips - subtle suggestions */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', maxWidth: '550px', marginTop: '0.5rem' }}>
              {quickQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickQuestion(q.text)}
                  disabled={!apiKey || transactions.length === 0 || isLoading}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: COLORS.white,
                    border: `1px solid ${COLORS.lightGray}`,
                    borderRadius: '2rem',
                    cursor: (!apiKey || transactions.length === 0 || isLoading) ? 'not-allowed' : 'pointer',
                    fontSize: '0.75rem',
                    color: COLORS.mediumGray,
                    transition: 'all 0.2s',
                    opacity: (!apiKey || transactions.length === 0 || isLoading) ? 0.5 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (apiKey && transactions.length > 0 && !isLoading) {
                      e.currentTarget.style.backgroundColor = `${q.color}08`;
                      e.currentTarget.style.borderColor = `${q.color}40`;
                      e.currentTarget.style.color = q.color;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = COLORS.white;
                    e.currentTarget.style.borderColor = COLORS.lightGray;
                    e.currentTarget.style.color = COLORS.mediumGray;
                  }}
                >
                  {q.text}
                </button>
              ))}
            </div>

            {!apiKey && (
              <p style={{ fontSize: '0.75rem', color: COLORS.expenseColor, marginTop: '1.5rem' }}>
                Set up your API key to start chatting
              </p>
            )}
            {apiKey && transactions.length === 0 && (
              <p style={{ fontSize: '0.7rem', color: COLORS.mediumGray, marginTop: '1.5rem' }}>
                Upload transaction data to enable AI analysis
              </p>
            )}
          </div>
        )}

        {chatMessages.map((message, index) => (
          <div key={message.id || index} style={{ display: 'flex', justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%',
              position: 'relative',
              backgroundColor: message.type === 'user'
                ? COLORS.slainteBlue
                : message.isLoading
                ? COLORS.white
                : message.isError
                ? `${COLORS.expenseColor}08`
                : COLORS.white,
              color: message.type === 'user' ? COLORS.white : COLORS.darkGray,
              padding: message.type === 'user' ? '0.875rem 1rem' : '1rem 1.25rem',
              borderRadius: message.type === 'user' ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
              border: message.isLoading
                ? `1px solid ${COLORS.lightGray}`
                : message.isError
                ? `1px solid ${COLORS.expenseColor}30`
                : message.type === 'user'
                ? 'none'
                : `1px solid ${COLORS.lightGray}`,
              boxShadow: message.type === 'user'
                ? '0 2px 8px rgba(0,98,204,0.2)'
                : message.isLoading
                ? 'none'
                : '0 2px 8px rgba(0,0,0,0.06)'
            }}>
              {message.isLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    backgroundColor: `${COLORS.slainteBlue}15`,
                    borderRadius: '50%',
                    padding: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <div style={{
                      animation: 'spin 1s linear infinite',
                      borderRadius: '50%',
                      height: '1rem',
                      width: '1rem',
                      border: `2px solid ${COLORS.slainteBlue}`,
                      borderTopColor: 'transparent'
                    }}></div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: COLORS.darkGray }}>Finn is thinking...</span>
                    <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray, marginTop: '0.125rem' }}>Analyzing your financial data</p>
                  </div>
                </div>
              )}

              {message.isError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', padding: '0.5rem 0.75rem', backgroundColor: `${COLORS.expenseColor}10`, borderRadius: '0.5rem' }}>
                  <AlertTriangle style={{ height: '1rem', width: '1rem', color: COLORS.expenseColor }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: COLORS.expenseColor }}>Something went wrong</span>
                </div>
              )}

              {message.type === 'user' ? (
                <div style={{ fontSize: '0.875rem', lineHeight: 1.5 }}>
                  {message.content}
                </div>
              ) : !message.isLoading ? (
                <div style={{ fontSize: '0.875rem' }}>
                  {/* Assistant name badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <div style={{
                      backgroundColor: `${COLORS.slainteBlue}15`,
                      borderRadius: '50%',
                      padding: '0.35rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Sparkles style={{ height: '0.75rem', width: '0.75rem', color: COLORS.slainteBlue }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: COLORS.slainteBlue }}>Finn</span>
                  </div>
                  {formatAIResponse(message.content)}

                  {/* Show inline artifact if this message generated one */}
                  {artifacts.some(a => a.created_at === message.timestamp) && (
                    <InlineArtifact
                      artifact={artifacts.find(a => a.created_at === message.timestamp)}
                      onExpand={() => setViewingArtifact(artifacts.find(a => a.created_at === message.timestamp))}
                    />
                  )}
                </div>
              ) : null}

              {/* Message controls - visible on hover */}
              {!message.isLoading && (
                <div
                  style={{
                    position: 'absolute',
                    top: '0.5rem',
                    right: '0.5rem',
                    opacity: 0,
                    transition: 'opacity 0.2s'
                  }}
                  className="message-controls"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {message.isError && (
                      <button
                        onClick={retryLastMessage}
                        style={{
                          padding: '0.35rem',
                          color: COLORS.expenseColor,
                          backgroundColor: COLORS.white,
                          border: `1px solid ${COLORS.lightGray}`,
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        title="Retry"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = `${COLORS.expenseColor}10`;
                          e.currentTarget.style.borderColor = COLORS.expenseColor;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = COLORS.white;
                          e.currentTarget.style.borderColor = COLORS.lightGray;
                        }}
                      >
                        <RefreshCw style={{ height: '0.75rem', width: '0.75rem' }} />
                      </button>
                    )}
                    <button
                      onClick={() => copyMessage(message.content)}
                      style={{
                        padding: '0.35rem',
                        color: COLORS.mediumGray,
                        backgroundColor: COLORS.white,
                        border: `1px solid ${COLORS.lightGray}`,
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      title="Copy message"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = `${COLORS.slainteBlue}10`;
                        e.currentTarget.style.borderColor = COLORS.slainteBlue;
                        e.currentTarget.style.color = COLORS.slainteBlue;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = COLORS.white;
                        e.currentTarget.style.borderColor = COLORS.lightGray;
                        e.currentTarget.style.color = COLORS.mediumGray;
                      }}
                    >
                      <Copy style={{ height: '0.75rem', width: '0.75rem' }} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {/* Invisible element at the bottom for auto-scroll */}
        <div ref={messagesEndRef} />
      </div>

        {/* Input Area at bottom of chat - when conversation has started */}
        {chatMessages.length > 0 && (
          <div style={{
            padding: '0.75rem 1rem',
            borderTop: `1px solid ${COLORS.lightGray}`,
            backgroundColor: COLORS.white
          }}>
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'center',
              backgroundColor: COLORS.backgroundGray,
              borderRadius: '2rem',
              padding: '0.5rem 0.625rem 0.5rem 1.25rem',
              border: `1px solid ${COLORS.lightGray}`,
              transition: 'all 0.2s'
            }}>
              <input
                ref={chatInputRef}
                type="text"
                placeholder="Ask a follow-up question..."
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  padding: '0.625rem 0',
                  fontSize: '0.9375rem',
                  outline: 'none',
                  color: COLORS.darkGray,
                  fontWeight: 400
                }}
                disabled={!apiKey || transactions.length === 0 || isLoading}
                onKeyDown={handleKeyDown}
              />
              <button
                onClick={handleSendClick}
                style={{
                  backgroundColor: (!apiKey || transactions.length === 0 || isLoading) ? COLORS.lightGray : COLORS.slainteBlue,
                  color: COLORS.white,
                  padding: '0.75rem',
                  borderRadius: '50%',
                  fontSize: '0.875rem',
                  border: 'none',
                  cursor: (!apiKey || transactions.length === 0 || isLoading) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  flexShrink: 0,
                  boxShadow: (!apiKey || transactions.length === 0 || isLoading) ? 'none' : '0 2px 8px rgba(0,98,204,0.3)'
                }}
                disabled={!apiKey || transactions.length === 0 || isLoading}
                onMouseEnter={(e) => {
                  if (!(!apiKey || transactions.length === 0 || isLoading)) {
                    e.currentTarget.style.backgroundColor = COLORS.slainteBlueDark;
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!(!apiKey || transactions.length === 0 || isLoading)) {
                    e.currentTarget.style.backgroundColor = COLORS.slainteBlue;
                    e.currentTarget.style.transform = 'scale(1)';
                  }
                }}
              >
                <Send style={{ height: '1.125rem', width: '1.125rem' }} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slide-Out Panel for All Chats/Artifacts */}
      {showSlideOutPanel && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowSlideOutPanel(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.3)',
              zIndex: 40
            }}
          />
          {/* Panel */}
          <div style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: '350px',
            backgroundColor: COLORS.white,
            boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideIn 0.2s ease-out'
          }}>
            {/* Panel Header */}
            <div style={{
              padding: '1rem 1.25rem',
              borderBottom: `1px solid ${COLORS.lightGray}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: COLORS.darkGray }}>
                {headerTab === 'chats' ? 'All Conversations' : 'All Reports'}
              </h3>
              <button
                onClick={() => setShowSlideOutPanel(false)}
                style={{
                  padding: '0.375rem',
                  background: 'none',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  color: COLORS.mediumGray
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.backgroundGray}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <X style={{ height: '1.25rem', width: '1.25rem' }} />
              </button>
            </div>

            {/* Panel Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
              {headerTab === 'chats' ? (
                /* All Chats List - only show chats with messages */
                allChats.filter(chat => chat.messages && chat.messages.length > 0).map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => {
                      loadChat(chat.id);
                      setShowSlideOutPanel(false);
                    }}
                    style={{
                      padding: '0.75rem',
                      marginBottom: '0.5rem',
                      backgroundColor: chat.id === currentChatId ? `${COLORS.slainteBlue}08` : COLORS.backgroundGray,
                      border: `1px solid ${chat.id === currentChatId ? COLORS.slainteBlue + '30' : COLORS.lightGray}`,
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (chat.id !== currentChatId) {
                        e.currentTarget.style.backgroundColor = `${COLORS.slainteBlue}05`;
                        e.currentTarget.style.borderColor = COLORS.slainteBlue + '20';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (chat.id !== currentChatId) {
                        e.currentTarget.style.backgroundColor = COLORS.backgroundGray;
                        e.currentTarget.style.borderColor = COLORS.lightGray;
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontSize: '0.8rem',
                          fontWeight: 500,
                          color: COLORS.darkGray,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {chat.title || 'New conversation'}
                        </p>
                        <div style={{ fontSize: '0.7rem', color: COLORS.mediumGray, marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span>{formatRelativeTime(chat.updated_at)}</span>
                          <span style={{ color: COLORS.lightGray }}>•</span>
                          <span>{chat.messages?.length || 0} messages</span>
                          {chat.artifacts?.length > 0 && (
                            <>
                              <span style={{ color: COLORS.lightGray }}>•</span>
                              <span style={{ color: COLORS.incomeColor }}>{chat.artifacts.length} reports</span>
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm('Delete this conversation?')) {
                            handleDeleteChat(chat.id);
                          }
                        }}
                        style={{
                          padding: '0.25rem',
                          background: 'none',
                          border: 'none',
                          borderRadius: '0.25rem',
                          cursor: 'pointer',
                          color: COLORS.mediumGray,
                          flexShrink: 0
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = COLORS.expenseColor}
                        onMouseLeave={(e) => e.currentTarget.style.color = COLORS.mediumGray}
                      >
                        <Trash2 style={{ height: '0.875rem', width: '0.875rem' }} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                /* All Artifacts List */
                allArtifacts.map((artifact, idx) => (
                  <div
                    key={artifact.id || idx}
                    onClick={() => {
                      setViewingArtifact(artifact);
                      setShowSlideOutPanel(false);
                    }}
                    style={{
                      padding: '0.75rem',
                      marginBottom: '0.5rem',
                      backgroundColor: COLORS.backgroundGray,
                      border: `1px solid ${COLORS.lightGray}`,
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = `${COLORS.incomeColor}05`;
                      e.currentTarget.style.borderColor = COLORS.incomeColor + '30';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = COLORS.backgroundGray;
                      e.currentTarget.style.borderColor = COLORS.lightGray;
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem' }}>
                      <FileText style={{ height: '0.8rem', width: '0.8rem', color: COLORS.incomeColor }} />
                      <span style={{ fontSize: '0.65rem', fontWeight: 600, color: COLORS.incomeColor, textTransform: 'uppercase' }}>
                        {artifact.type || 'Report'}
                      </span>
                    </div>
                    <p style={{
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      color: COLORS.darkGray,
                      marginBottom: '0.25rem'
                    }}>
                      {artifact.title || 'Untitled Report'}
                    </p>
                    <div style={{ fontSize: '0.7rem', color: COLORS.mediumGray, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>{formatRelativeTime(artifact.created_at)}</span>
                      {artifact.chatTitle && (
                        <>
                          <span style={{ color: COLORS.lightGray }}>•</span>
                          <span>from "{artifact.chatTitle}"</span>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Artifact Viewer Modal */}
      {viewingArtifact && (
        <ArtifactViewer
          artifact={viewingArtifact}
          onClose={() => setViewingArtifact(null)}
        />
      )}
    </div>
  );
}
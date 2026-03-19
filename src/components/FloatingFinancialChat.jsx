import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
// ... other imports
import { MessageCircle, X, Minimize2, User, Send, Play, ChevronLeft, ChevronRight, Check, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { calculateSummaries } from '../utils/financialCalculations';
import COLORS from '../utils/colors';
import { callClaude, formatClaudeResponse } from '../utils/claudeAPI';
import { MODELS } from '../data/modelConfig';
import { useTour } from './Tour';

export const FloatingFinancialChat = ({
    currentView = 'dashboard',
    dashboardContext = null
}) => {
  const { transactions, selectedYear, categoryMapping } = useAppContext();
  const {
    isActive: isTourActive,
    currentStep,
    totalSteps,
    currentStepData,
    nextStep,
    prevStep,
    skipTour,
    startTour,
    isFirstStep,
    isLastStep,
    isTransitioning
  } = useTour();
  const [isOpen, setIsOpen] = useState(false);
  const [isTourExpanded, setIsTourExpanded] = useState(true);

  // Tour Q&A state
  const [showTourQuestion, setShowTourQuestion] = useState(false);
  const [tourQuestion, setTourQuestion] = useState('');
  const [tourAnswer, setTourAnswer] = useState('');
  const [isTourQALoading, setIsTourQALoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Financial advisor persona
  const advisorName = "Cara";
  const advisorTitle = "Sláinte Guide";

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  // Reset tour Q&A state when step changes
  useEffect(() => {
    setShowTourQuestion(false);
    setTourQuestion('');
    setTourAnswer('');
  }, [currentStep]);

  // Handle tour Q&A
  const handleTourQuestion = async () => {
    if (!tourQuestion.trim() || isTourQALoading) return;

    if (!apiKey) {
      setTourAnswer("I'd love to answer, but I need an API key set up first. You can configure this in Admin Settings after the tour.");
      return;
    }

    setIsTourQALoading(true);
    setTourAnswer('');

    try {
      const prompt = `You are Cara, a friendly guide for Sláinte Finance app. The user is currently on a tour of the app and is viewing the "${currentStepData?.title || 'feature tour'}" step.

The feature being shown is: ${currentStepData?.content || 'general app overview'}

The user has a follow-up question: "${tourQuestion}"

Provide a helpful, concise answer (2-3 sentences max) that addresses their question in the context of this feature. Be friendly and encouraging. If the question is unrelated to the current feature, briefly acknowledge it and suggest they explore after the tour.`;

      const response = await callClaude(prompt, {
        model: MODELS.FAST,
        maxTokens: 300,
        apiKey: apiKey,
      });

      if (response.success) {
        setTourAnswer(response.content);
      } else {
        setTourAnswer("I'm having trouble connecting right now. Feel free to ask me again after the tour!");
      }
    } catch (error) {
      console.error('Tour Cara Q&A error:', error);
      setTourAnswer("Something went wrong. Don't worry - you can always ask me questions after the tour!");
    } finally {
      setIsTourQALoading(false);
    }
  };

  // Load API key on mount
  useEffect(() => {
    const loadApiKey = async () => {
      let savedKey = null;

      // Check Electron storage first (preferred)
      if (window.electronAPI?.isElectron) {
        savedKey = await window.electronAPI.getLocalStorage('claude_api_key');
        console.log('FloatingChat: Loading API key from Electron storage:', savedKey ? 'Found' : 'Not found');
      }

      // Fallback to localStorage for backwards compatibility
      if (!savedKey) {
        savedKey = localStorage.getItem('anthropic_api_key');
        console.log('FloatingChat: Loading API key from localStorage:', savedKey ? 'Found' : 'Not found');
      }

      if (savedKey) {
        setApiKey(savedKey);
        console.log('FloatingChat: API key loaded successfully');
      }
    };

    loadApiKey();
  }, []);

    // Get financial context for AI
    const getFinancialContext = () => {
        // Use the same calculation logic as Dashboard
        const summaries = calculateSummaries(transactions, selectedYear);

        // Calculate profit the same way Dashboard does
        const profit = summaries.income - summaries.expenses;
        const profitMargin = summaries.income > 0 ? ((profit / summaries.income) * 100).toFixed(1) : 0;

        // Get top expense categories from summaries
        const topExpenses = summaries.categoryBreakdown
            .filter(c => c.type === 'expense')
            .sort((a, b) => b.value - a.value)
            .slice(0, 3)
            .map(category => ({ category: category.name, amount: category.value }));

        // Count transactions for the selected year
        const totalTransactions = transactions.filter(t => {
            if (!t.date) return false;
            const txYear = new Date(t.date).getFullYear();
            return txYear === selectedYear;
        }).length;

        return {
            totalTransactions,
            income: summaries.income,
            expenses: summaries.expenses,
            drawings: summaries.drawings || 0,
            profit: profit,
            profitMargin: profitMargin,
            topExpenses,
            selectedYear,
            currentView
        };
    };
  // Check if user is asking for a tour
  const isTourRequest = (message) => {
    const lowerMsg = message.toLowerCase();
    const tourPhrases = [
      'tour', 'show me around', 'walk me through', 'walkthrough', 'guide me',
      'how does this work', 'how do i use this', 'show me the app',
      'what can this do', 'what does this app do', 'help me understand',
      'new to this', 'getting started', 'where do i start'
    ];
    return tourPhrases.some(phrase => lowerMsg.includes(phrase));
  };

  // Handle launching the tour from Cara
  const handleLaunchTour = () => {
    setIsOpen(false); // Close Cara's chat panel
    startTour(); // Start the tour
  };

  // Handle sending messages
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    console.log('FloatingChat: API key status:', apiKey ? 'Present' : 'Missing');

    if (!apiKey) {
      console.log('FloatingChat: No API key, showing input form');
      setShowApiKeyInput(true);
      return;
    }

    const userMessage = inputValue.trim();
    setInputValue('');
    setChatMessages(prev => [...prev, { type: 'user', content: userMessage }]);

    // Check if this is a tour request - handle it immediately without API call
    if (isTourRequest(userMessage)) {
      setChatMessages(prev => [...prev, {
        type: 'assistant',
        content: "I'd love to show you around! Let me start the app tour for you. Click the button below to begin!",
        timestamp: new Date(),
        showTourButton: true
      }]);
      return;
    }

    setIsLoading(true);

    try {
      const financialContext = getFinancialContext();
      console.log('FloatingChat: Making request to proxy...');

      // Create concise prompt for personal chat style
      const prompt = `You are Cara, a friendly app support assistant for Sláinte Finance - a financial management app for Irish GP practices. You help users navigate the app and answer how-to questions.

USER QUESTION: "${userMessage}"

=== APP FEATURE REFERENCE (use this to answer accurately) ===

NAVIGATION TABS (7 tabs, left to right):
1. Finances - Home (dashboard) - Financial overview with summary cards (income/expenses/profit), charts showing trends, and Financial Action Plans suggesting tasks
2. Reports - Generate P&L Report, Partner Capital Accounts, Personal Tax Return Form; view saved reports
3. Transactions - View/categorize all bank transactions, Repeating Transactions card (groups recurring payments), Smart AI Learning for auto-categorization
4. Financial Consultation - Chat with Finn, your AI financial advisor for detailed financial analysis and advice
5. GMS Overview - PCRS payment breakdown by category (capitation, items of service, etc.), GMS Action Plan with income optimization suggestions
6. GMS Health Check - Comprehensive analysis of GMS income potential, identifies unclaimed income and growth opportunities
7. Admin Settings - Category management, backup/restore, accountant exports, practice profile, start app tour

KEY FEATURES BY LOCATION:

**Finances - Home (Dashboard)**:
- Summary Cards: Total income, expenses, and net profit at a glance
- Charts: Income/expense trends over time
- Financial Action Plans: AI-suggested tasks based on what needs attention

**Reports page**:
- Generate New Report → choose: P&L Report, Partner Capital Accounts, Personal Tax Return Form
- View Saved Reports → see previously generated reports

**Transactions page**:
- Transaction table: All bank transactions, searchable and filterable
- Repeating Transactions card: Groups recurring transactions by pattern
- Smart AI Learning: When categorizing, teaches app to recognize patterns for future matching

**Financial Consultation page**:
- Chat with Finn (AI financial advisor)
- Get detailed analysis, insights, and personalized recommendations
- Create artifacts (reports, analyses)

**GMS Overview page**:
- Upload PCRS PDFs for payment analysis
- Monthly payment breakdown by category
- GMS Action Plan: Specific actions to maximize GMS income
- Export as CSV

**GMS Health Check page**:
- Enter practice data (demographics, staff, activity)
- Comprehensive income analysis comparing actual vs potential
- Identifies unclaimed income: registration gaps, unclaimed leaves, missed opportunities
- Growth potential analysis

**Admin Settings page** (expand each section):
- Backup & Restore: "Download Backup" saves ALL data as JSON; "Select Backup File" restores
- Collect & Share Data for Accountant: Export transactions, PCRS summary, P&L draft, or "Download All as ZIP"
- Data Management: Update practice profile, AI tools, clear data, START APP TOUR
- Category Management: View/edit category identifiers

CATEGORIES (7 parent types):
Income, Staff Costs, Medical Supplies (includes Uniforms, PPE), Premises, Office & IT, Professional Fees, Petty Cash / Other

=== END REFERENCE ===

FINANCIAL CONTEXT (${financialContext.selectedYear}): ${financialContext.totalTransactions} transactions, €${financialContext.income.toLocaleString()} income, €${financialContext.expenses.toLocaleString()} expenses, ${financialContext.profitMargin}% margin. Currently viewing: ${financialContext.currentView}

INSTRUCTIONS:
- Answer based ONLY on the feature reference above - do not invent features
- Be concise: 2-4 sentences, like texting a colleague
- Give specific navigation steps when relevant (e.g., "Go to Admin Settings → Data Management → Start App Tour")
- Only mention financial numbers if the user asks about their finances
- If user asks for a tour/walkthrough, tell them you can start it for them (the system will handle this automatically)
- If you cannot answer confidently, suggest emailing slainte.finance@gmail.com for support

Respond as Cara:`;

        // Call Claude API using the unified helper (works in both Electron and PWA)
        const response = await callClaude(prompt, {
            model: MODELS.FAST,
            maxTokens: 1000,
            apiKey: apiKey
        });

        console.log('API Response:', response);

        if (!response.success) {
            throw new Error(response.error || 'Failed to get response from Claude');
        }

        const aiResponse = response.content;

      setChatMessages(prev => [...prev, { 
        type: 'assistant', 
        content: aiResponse,
        timestamp: new Date()
      }]);
      
    } catch (error) {
      console.error('Chat error:', error);
      console.error('Error details:', error.message, error.stack);

      // Show actual error message to user
      let errorMessage = "Sorry, I'm having trouble connecting right now. ";
      if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += "Please try again.";
      }

      setChatMessages(prev => [...prev, {
        type: 'assistant',
        content: errorMessage,
        isError: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Show different welcome messages based on page
  const getWelcomeMessage = () => {
    if (transactions.length === 0) return null;

    const context = getFinancialContext();
    const pageSpecificMessages = {
      dashboard: `Hey! I can see your Finances overview - ${context.totalTransactions} transactions, €${context.profit?.toLocaleString() || '0'} profit. What would you like to know?`,
      transactions: `I'm looking at your Transactions. Need help analyzing any patterns or categories?`,
      export: `Ready to help with Reports! Your current profit margin is ${context.profitMargin}%. What kind of analysis do you need?`,
      chat: `You're in Financial Consultation with Finn. I'm here too if you need app guidance!`,
      'gms-panel': `Looking at your GMS Overview. Need help understanding your PCRS payments or the Action Plan?`,
      'gms-health-check': `This is the GMS Health Check - a deep dive into your income potential. Need help with anything?`,
      admin: `Need help with Admin Settings? I can explain backup, exports, categories, or start the app tour for you!`,
      default: `I'm Cara, your Sláinte guide. I have access to your ${context.totalTransactions} transactions for ${selectedYear}.`
    };

    return pageSpecificMessages[currentView] || pageSpecificMessages.default;
  };

  // TOUR MODE: Show tour content in Cara panel
  if (isTourActive && currentStepData) {
    return (
      <div
        style={{
          position: 'fixed',
          top: '4.25rem',
          left: '1.5rem',
          width: '320px',
          backgroundColor: COLORS.white,
          borderRadius: '0.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: `1px solid ${COLORS.borderLight}`,
          zIndex: 10003, // Above tour overlay
          overflow: 'hidden',
          transition: 'all 0.3s ease',
        }}
        data-tour-id="cara-button"
      >
        {/* Header - clickable to expand/collapse */}
        <div
          onClick={() => setIsTourExpanded(!isTourExpanded)}
          style={{
            padding: '1rem',
            backgroundColor: COLORS.slainteBlue,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: '2rem',
              height: '2rem',
              backgroundColor: COLORS.slainteBlueDark,
              borderRadius: '9999px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MessageCircle size={16} color={COLORS.white} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '600', fontSize: '0.875rem', color: COLORS.white }}>
              {advisorName}
            </div>
            <div style={{ fontSize: '0.75rem', color: COLORS.white, opacity: 0.9 }}>
              Step {currentStep + 1} of {totalSteps}
            </div>
          </div>
          {isTourExpanded ? (
            <ChevronDown size={20} color={COLORS.white} style={{ opacity: 0.8 }} />
          ) : (
            <ChevronUp size={20} color={COLORS.white} style={{ opacity: 0.8 }} />
          )}
        </div>

        {/* Collapsible Content */}
        {isTourExpanded && (
          <>
            {/* Cara's narration message */}
            <div
              style={{
                padding: '16px',
                fontSize: '14px',
                lineHeight: '1.6',
                color: COLORS.textPrimary,
                maxHeight: '180px',
                overflowY: 'auto',
              }}
            >
              {currentStepData.finnText || currentStepData.caraText}
            </div>

            {/* Q&A Section */}
            {currentStepData.allowQuestions && (
              <div
                style={{
                  padding: '0 16px 12px',
                  borderTop: `1px solid ${COLORS.borderLight}`,
                  paddingTop: '12px',
                }}
              >
                {!showTourQuestion && !tourAnswer ? (
                  <button
                    onClick={() => setShowTourQuestion(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      backgroundColor: `${COLORS.slainteBlue}10`,
                      border: `1px solid ${COLORS.slainteBlue}30`,
                      borderRadius: '8px',
                      color: COLORS.slainteBlue,
                      fontSize: '13px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      width: '100%',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = `${COLORS.slainteBlue}20`}
                    onMouseLeave={(e) => e.target.style.backgroundColor = `${COLORS.slainteBlue}10`}
                  >
                    <HelpCircle size={16} />
                    Have a question about this?
                  </button>
                ) : (
                  <div>
                    {/* Question input */}
                    {showTourQuestion && !tourAnswer && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          value={tourQuestion}
                          onChange={(e) => setTourQuestion(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleTourQuestion()}
                          placeholder="Ask about this feature..."
                          disabled={isTourQALoading}
                          style={{
                            flex: 1,
                            padding: '10px 12px',
                            border: `1px solid ${COLORS.borderLight}`,
                            borderRadius: '8px',
                            fontSize: '13px',
                            outline: 'none',
                            backgroundColor: isTourQALoading ? COLORS.bgPage : COLORS.white,
                          }}
                        />
                        <button
                          onClick={handleTourQuestion}
                          disabled={isTourQALoading || !tourQuestion.trim()}
                          style={{
                            padding: '10px 14px',
                            backgroundColor: isTourQALoading || !tourQuestion.trim() ? COLORS.borderLight : COLORS.slainteBlue,
                            border: 'none',
                            borderRadius: '8px',
                            color: COLORS.white,
                            cursor: isTourQALoading || !tourQuestion.trim() ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Send size={16} />
                        </button>
                      </div>
                    )}

                    {/* Loading indicator */}
                    {isTourQALoading && (
                      <div
                        style={{
                          marginTop: '12px',
                          padding: '12px',
                          backgroundColor: COLORS.bgPage,
                          borderRadius: '8px',
                          fontSize: '13px',
                          color: COLORS.textSecondary,
                          textAlign: 'center',
                        }}
                      >
                        Cara is thinking...
                      </div>
                    )}

                    {/* Answer display */}
                    {tourAnswer && (
                      <div
                        style={{
                          marginTop: showTourQuestion ? '12px' : 0,
                          padding: '12px',
                          backgroundColor: `${COLORS.incomeColor}15`,
                          borderRadius: '8px',
                          fontSize: '13px',
                          lineHeight: '1.5',
                          color: COLORS.textPrimary,
                          borderLeft: `3px solid ${COLORS.incomeColor}`,
                        }}
                      >
                        {tourAnswer}
                      </div>
                    )}

                    {/* Ask another question */}
                    {tourAnswer && (
                      <button
                        onClick={() => {
                          setTourAnswer('');
                          setTourQuestion('');
                          setShowTourQuestion(true);
                        }}
                        style={{
                          marginTop: '8px',
                          padding: '6px 12px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: COLORS.slainteBlue,
                          fontSize: '12px',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        Ask another question
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Navigation Controls */}
            <div
              style={{
                padding: '12px 16px',
                borderTop: `1px solid ${COLORS.borderLight}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: COLORS.bgPage,
              }}
            >
              {/* Skip button */}
              <button
                onClick={skipTour}
                disabled={isTransitioning}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: COLORS.textSecondary,
                  fontSize: '13px',
                  cursor: isTransitioning ? 'not-allowed' : 'pointer',
                  opacity: isTransitioning ? 0.5 : 1,
                }}
              >
                <X size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                Skip
              </button>

              {/* Prev/Next buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={prevStep}
                  disabled={isFirstStep || isTransitioning}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    backgroundColor: isFirstStep ? COLORS.bgPage : COLORS.white,
                    border: `1px solid ${isFirstStep ? COLORS.borderLight : COLORS.slainteBlue}`,
                    borderRadius: '50%',
                    color: isFirstStep ? COLORS.borderLight : COLORS.slainteBlue,
                    cursor: isFirstStep || isTransitioning ? 'not-allowed' : 'pointer',
                    opacity: isTransitioning ? 0.5 : 1,
                  }}
                >
                  <ChevronLeft size={18} />
                </button>

                <button
                  onClick={nextStep}
                  disabled={isTransitioning}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: isLastStep ? '8px 16px' : '8px 12px',
                    backgroundColor: isLastStep ? COLORS.incomeColor : COLORS.slainteBlue,
                    border: 'none',
                    borderRadius: '16px',
                    color: COLORS.white,
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: isTransitioning ? 'not-allowed' : 'pointer',
                    opacity: isTransitioning ? 0.5 : 1,
                  }}
                >
                  {isLastStep ? (
                    <>
                      <Check size={16} />
                      Finish
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Normal mode: closed button
  if (!isOpen) {
    return (
      <div style={{ position: 'fixed', top: '4.25rem', left: '1.5rem', zIndex: 50 }} data-tour-id="cara-button">
        <button
          onClick={() => setIsOpen(true)}
          style={{
            backgroundColor: COLORS.slainteBlue,
            color: COLORS.white,
            borderRadius: '9999px',
            padding: '0.5rem 1rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            border: 'none',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = COLORS.slainteBlueDark;
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = COLORS.slainteBlue;
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <MessageCircle style={{ height: '1.5rem', width: '1.5rem' }} />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{advisorName}</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>{advisorTitle}</div>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: '4.25rem',
      left: '1.5rem',
      zIndex: 50,
      backgroundColor: COLORS.white,
      borderRadius: '0.5rem',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      border: `1px solid ${COLORS.borderLight}`,
      transition: 'all 0.3s',
      width: isMinimized ? '20rem' : '24rem',
      height: isMinimized ? '4rem' : '36rem'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: COLORS.slainteBlue,
        color: COLORS.white,
        padding: '1rem',
        borderTopLeftRadius: '0.5rem',
        borderTopRightRadius: '0.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '2rem',
            height: '2rem',
            backgroundColor: COLORS.slainteBlueDark,
            borderRadius: '9999px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <User style={{ height: '1rem', width: '1rem' }} />
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>{advisorName}</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>{advisorTitle}</div>
          </div>
          {!apiKey && (
            <div style={{ fontSize: '0.75rem', backgroundColor: COLORS.highlightYellow, color: COLORS.textPrimary, padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>Setup needed</div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            style={{ color: COLORS.white, padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer' }}
            title={isMinimized ? "Expand" : "Minimize"}
            onMouseEnter={(e) => e.currentTarget.style.color = COLORS.borderLight}
            onMouseLeave={(e) => e.currentTarget.style.color = COLORS.white}
          >
            <Minimize2 style={{ height: '1rem', width: '1rem' }} />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            style={{ color: COLORS.white, padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer' }}
            title="Close"
            onMouseEnter={(e) => e.currentTarget.style.color = COLORS.borderLight}
            onMouseLeave={(e) => e.currentTarget.style.color = COLORS.white}
          >
            <X style={{ height: '1rem', width: '1rem' }} />
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      {!isMinimized && (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', height: '27rem' }}>
            {chatMessages.length === 0 && getWelcomeMessage() && (
              <div style={{ backgroundColor: `${COLORS.slainteBlue}15`, padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.875rem', border: `1px solid ${COLORS.slainteBlue}` }}>
                <div style={{ color: COLORS.textPrimary }}>{getWelcomeMessage()}</div>
              </div>
            )}

            {transactions.length === 0 && (
              <div style={{ textAlign: 'center', color: COLORS.textSecondary, padding: '1rem' }}>
                <MessageCircle style={{ margin: '0 auto 0.5rem', height: '2rem', width: '2rem', color: COLORS.borderLight }} />
                <div style={{ fontSize: '0.875rem' }}>Upload transaction data to start chatting with {advisorName}</div>
              </div>
            )}

            {chatMessages.map((message, index) => (
              <div key={index} style={{ display: 'flex', justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  backgroundColor: message.type === 'user'
                    ? COLORS.slainteBlue
                    : message.isError
                    ? `${COLORS.expenseColor}20`
                    : COLORS.bgPage,
                  color: message.type === 'user'
                    ? COLORS.white
                    : COLORS.textPrimary,
                  border: message.isError ? `1px solid ${COLORS.expenseColor}` : 'none'
                }}>
                  {message.content}
                  {/* Show tour launch button if this is a tour response */}
                  {message.showTourButton && (
                    <button
                      onClick={handleLaunchTour}
                      style={{
                        marginTop: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 1rem',
                        backgroundColor: COLORS.slainteBlue,
                        color: COLORS.white,
                        border: 'none',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        width: '100%',
                        justifyContent: 'center'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.slainteBlueDark}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.slainteBlue}
                    >
                      <Play style={{ height: '1rem', width: '1rem' }} />
                      Start App Tour
                    </button>
                  )}
                  {message.type === 'assistant' && message.timestamp && (
                    <div style={{ fontSize: '0.75rem', color: COLORS.textSecondary, marginTop: '0.25rem' }}>
                      {advisorName} • {message.timestamp.toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ backgroundColor: COLORS.bgPage, padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <div style={{ width: '0.5rem', height: '0.5rem', backgroundColor: COLORS.textSecondary, borderRadius: '9999px', animation: 'pulse 1.5s infinite' }}></div>
                    <div style={{ width: '0.5rem', height: '0.5rem', backgroundColor: COLORS.textSecondary, borderRadius: '9999px', animation: 'pulse 1.5s infinite 0.2s' }}></div>
                    <div style={{ width: '0.5rem', height: '0.5rem', backgroundColor: COLORS.textSecondary, borderRadius: '9999px', animation: 'pulse 1.5s infinite 0.4s' }}></div>
                  </div>
                  <span style={{ color: COLORS.textPrimary }}>{advisorName} is typing...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div style={{ borderTop: `1px solid ${COLORS.borderLight}`, padding: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={transactions.length === 0 ? "Upload data first..." : "Ask about your finances..."}
                style={{
                  flex: 1,
                  border: `1px solid ${COLORS.borderLight}`,
                  borderRadius: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.875rem',
                  outline: 'none',
                  backgroundColor: transactions.length === 0 || isLoading ? COLORS.bgPage : COLORS.white
                }}
                disabled={transactions.length === 0 || isLoading}
                onFocus={(e) => e.target.style.boxShadow = `0 0 0 2px ${COLORS.slainteBlue}`}
                onBlur={(e) => e.target.style.boxShadow = 'none'}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isLoading || transactions.length === 0}
                style={{
                  backgroundColor: COLORS.slainteBlue,
                  color: COLORS.white,
                  padding: '0.5rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  cursor: !inputValue.trim() || isLoading || transactions.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: !inputValue.trim() || isLoading || transactions.length === 0 ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!(!inputValue.trim() || isLoading || transactions.length === 0)) {
                    e.currentTarget.style.backgroundColor = COLORS.slainteBlueDark;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!(!inputValue.trim() || isLoading || transactions.length === 0)) {
                    e.currentTarget.style.backgroundColor = COLORS.slainteBlue;
                  }
                }}
              >
                <Send style={{ height: '1rem', width: '1rem' }} />
              </button>
            </div>
            {transactions.length > 0 && apiKey && (
              <div style={{ fontSize: '0.75rem', color: COLORS.textSecondary, marginTop: '0.25rem' }}>
                Ready to analyze {transactions.length} transactions • Press Enter to send
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
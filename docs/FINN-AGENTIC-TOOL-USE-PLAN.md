# Finn Agentic Tool Use — Implementation Plan

> **Status:** Ready to implement. Prerequisites (model centralization + app knowledge base) are complete.
>
> **Goal:** Transform Finn from a chat-only advisor into an agentic assistant that can take actions in the app — navigate pages, generate reports, run health checks, and manage data on the user's behalf.

---

## Architecture Overview

```
User: "Generate a P&L report for 2025"
  ↓
FinnContext.jsx: agenticQuery()
  ↓  (sends message + tool definitions to Claude API)
Express /api/chat proxy → Anthropic API
  ↓  (returns stop_reason: "tool_use" + tool_use content blocks)
FinnContext.jsx: parseToolUseResponse()
  ↓
executeToolAction("generate_report", { topic: "P&L for 2025" })
  ↓  (triggers existing startBackgroundReport flow)
FinnContext.jsx: sends tool result back to Claude
  ↓  (Claude responds with final text)
FinnChatPanel.jsx: renders text + tool execution indicator
  ↓
User sees: "I've started generating your 2025 Profit & Loss report. You'll be notified when it's ready."
```

**Key decision: Frontend-side agentic loop, not server-side.**
All navigation state, financial data, and React dispatch functions live in the browser. The Express server remains a pure API proxy. The agentic loop (tool call → execute → return result → next API call) runs entirely in FinnContext.jsx.

---

## 1. Tool Definitions

Seven tools for the first release, in three implementation phases:

### Phase 1: Navigation + Data Lookup (lowest risk, highest immediate value)

```javascript
{
  name: "navigate_to_page",
  description: "Navigate the user to a specific page or section of Slainte Finance",
  input_schema: {
    type: "object",
    properties: {
      page: {
        type: "string",
        enum: ["finances-overview", "gms-overview", "gms-health-check",
               "settings", "transactions", "reports"],
        description: "The page to navigate to"
      },
      settingsSection: {
        type: "string",
        enum: ["profile", "data", "categories", "backup", "tour", "privacy"],
        description: "If navigating to settings, which section to open"
      }
    },
    required: ["page"]
  }
}
```

```javascript
{
  name: "open_modal",
  description: "Open a specific modal in the app (reports, transactions, settings)",
  input_schema: {
    type: "object",
    properties: {
      modal: {
        type: "string",
        enum: ["reports", "transactions", "settings"],
        description: "The modal to open"
      }
    },
    required: ["modal"]
  }
}
```

```javascript
{
  name: "lookup_financial_data",
  description: "Look up specific financial data points from the practice's records",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        enum: ["total_income", "total_expenses", "profit", "profit_margin",
               "top_expenses", "top_income", "gms_payments", "uncategorized_count",
               "monthly_trends", "transaction_count"],
        description: "The data point to retrieve"
      },
      year: {
        type: "number",
        description: "Financial year (optional, defaults to most recent)"
      }
    },
    required: ["query"]
  }
}
```

### Phase 2: Report Generation + Tour (medium risk, delegates to existing flows)

```javascript
{
  name: "generate_report",
  description: "Generate a detailed financial report. Use when user explicitly asks for a report.",
  input_schema: {
    type: "object",
    properties: {
      topic: {
        type: "string",
        description: "What the report should cover"
      },
      reportType: {
        type: "string",
        enum: ["standard", "strategic"],
        description: "Standard for data summaries, strategic for advisory/planning"
      }
    },
    required: ["topic"]
  }
}
```

```javascript
{
  name: "start_app_tour",
  description: "Start the guided app tour to show the user around Slainte Finance",
  input_schema: {
    type: "object",
    properties: {}
  }
}
```

### Phase 3: External Integrations (contacts external services, needs robust error handling)

```javascript
{
  name: "start_pcrs_download",
  description: "Initiate automated PCRS statement download from the PCRS website",
  input_schema: {
    type: "object",
    properties: {
      months: {
        type: "number",
        description: "How many months of statements to download (default 12)"
      }
    }
  }
}
```

```javascript
{
  name: "send_feedback",
  description: "Send feedback to the Slainte Finance team when unable to resolve user's issue",
  input_schema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "Brief description of the issue"
      },
      category: {
        type: "string",
        enum: ["bug", "feature_request", "help_needed"],
        description: "Type of feedback"
      }
    },
    required: ["summary"]
  }
}
```

---

## 2. File Changes Required

### 2.1 FinnContext.jsx — Core Changes

**New constant: Tool definitions array**
```javascript
// After MODELS import
const FINN_TOOLS = [
  // ... tool definitions from above
];
```

**New function: `agenticQuery()`**
Replaces or wraps `handleSubstantiveQuery` when tool use is detected.

```javascript
const agenticQuery = useCallback(async (message, financialContext) => {
  const systemPrompt = buildFinnSystemPrompt(message, financialContext);

  let messages = [
    { role: "user", content: systemPrompt + "\n\nUser: " + message }
  ];

  const MAX_TOOL_ROUNDS = 5; // Safety limit to prevent infinite loops

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await callClaudeWithTools(messages, FINN_TOOLS);

    if (response.stop_reason === 'end_turn') {
      // Done — extract text content and return
      const textContent = response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n\n');
      return { content: textContent, toolsUsed: round > 0 };
    }

    if (response.stop_reason === 'tool_use') {
      const toolResults = [];

      for (const block of response.content.filter(b => b.type === 'tool_use')) {
        // Check if confirmation required
        if (requiresConfirmation(block.name)) {
          const confirmed = await requestUserConfirmation(block.name, block.input);
          if (!confirmed) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify({ success: false, reason: 'User declined' })
            });
            continue;
          }
        }

        // Execute the tool
        const result = await executeToolAction(block.name, block.input);

        // Show execution status in chat
        addToolExecutionMessage(block.name, block.input, result);

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result)
        });
      }

      // Build next turn of conversation
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });
    }
  }

  return { content: 'I ran into an issue completing that action. Please try again.', toolsUsed: true };
}, [/* deps */]);
```

**New function: `executeToolAction()`**

```javascript
const executeToolAction = useCallback(async (toolName, input) => {
  switch (toolName) {
    case 'navigate_to_page': {
      if (input.page === 'settings') {
        window.dispatchEvent(new CustomEvent('navigate-to-settings',
          { detail: input.settingsSection ? { section: input.settingsSection } : undefined }));
      } else if (input.page === 'transactions') {
        window.dispatchEvent(new CustomEvent('task:openTransactions'));
      } else if (input.page === 'reports') {
        window.dispatchEvent(new CustomEvent('tour:openReportsModal'));
      } else if (input.page === 'gms-health-check') {
        setCurrentView('gms-overview');
        window.dispatchEvent(new CustomEvent('tour:switchToHealthCheck'));
      } else {
        setCurrentView(input.page);
      }
      return { success: true, message: `Navigated to ${input.page}` };
    }

    case 'open_modal': {
      const eventMap = {
        reports: 'tour:openReportsModal',
        transactions: 'task:openTransactions',
        settings: 'navigate-to-settings'
      };
      window.dispatchEvent(new CustomEvent(eventMap[input.modal]));
      return { success: true, message: `Opened ${input.modal}` };
    }

    case 'generate_report': {
      const context = {
        originalQuestion: input.topic,
        financialContext: getFinancialContext(),
        practiceContext: getCiaranContext(),
        gmsContext: buildGMSHealthCheckContext(),
        isStrategic: input.reportType === 'strategic'
      };
      startBackgroundReport(context);
      return { success: true, message: 'Report generation started in background' };
    }

    case 'start_app_tour': {
      // Trigger existing tour start mechanism
      window.dispatchEvent(new CustomEvent('start-app-tour'));
      return { success: true, message: 'App tour started' };
    }

    case 'start_pcrs_download': {
      startPCRSDownload();
      return { success: true, message: 'PCRS download initiated' };
    }

    case 'lookup_financial_data': {
      const data = getFinancialContext();
      return lookupDataPoint(data, input.query, input.year);
    }

    case 'send_feedback': {
      // Open feedback modal with pre-filled summary
      window.dispatchEvent(new CustomEvent('open-feedback',
        { detail: { summary: input.summary, category: input.category } }));
      return { success: true, message: 'Feedback dialog opened' };
    }

    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}, [/* deps */]);
```

**New function: `lookupDataPoint()`**

```javascript
function lookupDataPoint(financialContext, query, year) {
  const yearData = year ? /* filter by year */ financialContext : financialContext;

  switch (query) {
    case 'total_income':
      return { value: yearData.yearToDateIncome, formatted: `€${yearData.yearToDateIncome.toLocaleString()}` };
    case 'total_expenses':
      return { value: yearData.yearToDateExpenses, formatted: `€${yearData.yearToDateExpenses.toLocaleString()}` };
    case 'profit':
      return { value: yearData.profit, formatted: `€${yearData.profit.toLocaleString()}` };
    case 'profit_margin':
      return { value: yearData.profitMargin, formatted: `${yearData.profitMargin}%` };
    case 'top_expenses':
      return { categories: yearData.topExpenseCategories };
    case 'top_income':
      return { categories: yearData.topIncomeCategories };
    case 'gms_payments':
      return yearData.gmsPaymentData || { hasData: false };
    case 'uncategorized_count':
      return { count: yearData.unidentifiedCount };
    case 'monthly_trends':
      return { trends: yearData.monthlyTrends };
    case 'transaction_count':
      return { count: yearData.totalTransactions };
    default:
      return { error: 'Unknown query type' };
  }
}
```

**New function: `callClaudeWithTools()`**

```javascript
async function callClaudeWithTools(messages, tools) {
  const response = await fetch("http://localhost:3001/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      message: JSON.stringify({
        model: MODELS.STANDARD, // Sonnet for tool use
        max_tokens: 1024,
        messages: messages,
        tools: tools
      })
    })
  });

  return await response.json();
}
```

### 2.2 FinnChatPanel.jsx — UI Changes

Add rendering for tool execution status in the message list:

```jsx
// New message type: tool execution indicator
{message.toolActions?.map((action, i) => (
  <div key={i} style={{
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
    backgroundColor: COLORS.backgroundGray, fontSize: '0.8125rem',
    color: COLORS.mediumGray, marginBottom: '0.25rem'
  }}>
    {action.status === 'executing' && <Loader2 size={14} className="animate-spin" />}
    {action.status === 'completed' && <CheckCircle size={14} color={COLORS.incomeColor} />}
    {action.status === 'declined' && <X size={14} color={COLORS.expenseColor} />}
    <span>{action.description}</span>
  </div>
))}
```

### 2.3 Express Server (electron/main.cjs) — Minimal Changes

The server already handles full JSON requests with `messages` array (line ~1414). The only change needed is ensuring `tools` is passed through:

```javascript
// In the /api/chat handler, after parsing the JSON request:
if (parsed.messages) {
  claudeRequest = {
    model: parsed.model || MODELS.FAST,
    max_tokens: parsed.max_tokens || 1024,
    messages: parsed.messages,
    ...(parsed.tools && { tools: parsed.tools }),  // Pass through tool definitions
    ...(parsed.system && { system: parsed.system })
  };
}
```

Verify this already works — the current code at line ~1419 does `claudeRequest = { ...parsed }` for full JSON requests, which would naturally include `tools` if present.

---

## 3. Query Routing: When to Use Tools

Not every query should trigger tool use. Add a detection function:

```javascript
function shouldUseTools(message) {
  const lowerMsg = message.toLowerCase();

  // Action verbs that suggest the user wants something done, not explained
  const actionPatterns = [
    'create a', 'generate a', 'make a', 'run a', 'start a',
    'open the', 'go to', 'take me to', 'show me the',
    'navigate to', 'switch to', 'download my',
    'send feedback', 'report a bug'
  ];

  return actionPatterns.some(p => lowerMsg.includes(p));
}
```

In `sendMessage()`, before the existing routing logic:

```javascript
if (shouldUseTools(message) && !isQuickQuery(message)) {
  return agenticQuery(message, financialContext);
}
// ... existing routing continues
```

---

## 4. Confirmation UX

| Tool | Auto-execute? | Reason |
|------|--------------|--------|
| `navigate_to_page` | Yes | Non-destructive, user can navigate back |
| `open_modal` | Yes | Non-destructive, user can close |
| `lookup_financial_data` | Yes | Read-only |
| `start_app_tour` | Yes | Non-destructive |
| `generate_report` | **Confirm** | Costs API tokens, takes time |
| `start_pcrs_download` | **Confirm** | Contacts external service |
| `send_feedback` | **Confirm** | Sends data externally |

Confirmation renders as a message with Accept/Decline buttons (reuse existing action button pattern from report offers):

```javascript
function requiresConfirmation(toolName) {
  return ['generate_report', 'start_pcrs_download', 'send_feedback'].includes(toolName);
}

async function requestUserConfirmation(toolName, input) {
  return new Promise((resolve) => {
    const descriptions = {
      generate_report: `Generate a detailed report on "${input.topic}"`,
      start_pcrs_download: 'Download PCRS statements from the PCRS website',
      send_feedback: `Send feedback to the Slainte team: "${input.summary}"`
    };

    addAssistantMessage({
      content: `I'd like to ${descriptions[toolName]}. Shall I go ahead?`,
      isConfirmationRequest: true,
      confirmationCallback: resolve
    });
  });
}
```

---

## 5. Model Selection

**STANDARD tier (Sonnet 4.6)** for all agentic queries.

Rationale:
- Tool use requires nuanced judgement about when to use tools vs. answer directly — Haiku may over-trigger
- Opus is too expensive for interactive chat with 2-5 API roundtrips per query
- Sonnet 4.6 has strong tool use capabilities and acceptable latency
- The initial quick-answer path still uses Haiku (no change to existing flow)

---

## 6. Implementation Phases

### Phase 1: Navigation + Data Lookup
- Implement `navigate_to_page`, `open_modal`, `lookup_financial_data`
- Add `callClaudeWithTools`, `agenticQuery`, `executeToolAction` to FinnContext
- Add tool execution indicators to FinnChatPanel
- Test: "Take me to the GMS Health Check", "How many uncategorized transactions do I have?", "Open my settings"

### Phase 2: Report Generation + Tour
- Add `generate_report`, `start_app_tour` tools
- Wire `generate_report` into existing `startBackgroundReport` flow
- Add confirmation UX for report generation
- Test: "Generate a P&L report for 2024", "Give me a tour of the app"

### Phase 3: External Integrations
- Add `start_pcrs_download`, `send_feedback` tools
- Add confirmation UX for both
- Robust error handling for PCRS connection failures
- Test: "Download my latest PCRS statements", "There's a bug with the export"

---

## 7. Testing Checklist

- [ ] Navigation tools work for all page targets
- [ ] Settings modal opens to correct section
- [ ] Data lookup returns accurate figures matching dashboard
- [ ] Report generation triggers correctly with right model tier
- [ ] Confirmation dialogs appear for destructive actions
- [ ] Declining a confirmation stops the action gracefully
- [ ] Tool execution indicators render correctly in chat
- [ ] MAX_TOOL_ROUNDS limit prevents infinite loops
- [ ] Non-tool queries still route through existing Haiku quick-answer path
- [ ] `shouldUseTools()` doesn't false-positive on financial questions
- [ ] PCRS download integrates with existing IPC flow
- [ ] Feedback sends to correct endpoint

---

## 8. Existing Code to Reuse

| What | Where | How |
|------|-------|-----|
| Navigation events | `window.dispatchEvent(new CustomEvent(...))` | Already used throughout for tour events |
| Report generation | `startBackgroundReport()` in FinnContext | Call directly from tool executor |
| PCRS download | `startPCRSDownload()` in FinnContext | Call directly from tool executor |
| Action buttons | FinnChatPanel lines 126-291 | Pattern for confirmation/action UI |
| Financial data | `getFinancialContext()` in FinnContext | Already builds the full data context |
| Practice context | `getCiaranContext()` from ciaranContextBuilder | Already builds practice data |
| Model config | `MODELS.STANDARD` from modelConfig.js | Use for tool-use API calls |

---

## 9. Revised Recommendations (Feb 2026 Review)

After reviewing the current FinnContext.jsx implementation against this plan, the following modifications were identified to reduce risk, fill gaps, and improve the rollout.

### 9.1 Drop `shouldUseTools()` — Let Claude Decide

The plan originally introduced `shouldUseTools()` with keyword matching ("create a", "generate a", "take me to"). This recreates the same fragile routing pattern we're trying to eliminate. Instead, **always pass tools** with `tool_choice: "auto"` and let Claude decide whether to use them. Claude with `tool_choice: "auto"` handles "what's my profit?" (calls `lookup_financial_data`) and "what is GMS?" (answers directly, no tool) correctly without keyword detection.

### 9.2 Keep a Minimal Greeting Fast Path

Without a fast path, every "hello" costs a Sonnet call with tool definitions (~1500 input tokens) instead of a Haiku call (~256 tokens). Keep a 3-line exact-match check:

```javascript
const GREETINGS = new Set(['hi', 'hello', 'hey', 'thanks', 'thank you', 'cheers', 'ok', 'great']);

if (GREETINGS.has(userMessage.toLowerCase().trim().replace(/[!.]$/, ''))) {
  return handleQuickQuery(userMessage); // Still uses Haiku
}
```

Everything else goes through the agentic loop. This replaces 40+ lines of `isQuickQuery()` with 3 lines.

### 9.3 Use the `system` Parameter Properly

The plan puts the system prompt into the first user message (`systemPrompt + "\n\nUser: " + message`). The Claude API has a dedicated `system` field — mixing instructions into user messages degrades tool-use accuracy. Send it as a proper field:

```javascript
const response = await callClaudeWithTools({
  system: systemPrompt,
  messages: messages,
  tools: FINN_TOOLS,
  tool_choice: { type: "auto" }
});
```

### 9.4 Merge `open_modal` into `navigate_to_page`

These two tools overlap significantly. "Open transactions" vs "Navigate to transactions" is the same action from the user's perspective. Fewer tools = better selection accuracy. Merge into a single `navigate` tool with a broader `target` enum:

```javascript
{
  name: "navigate",
  description: "Navigate to a page, section, or modal in Sláinte Finance",
  input_schema: {
    type: "object",
    properties: {
      target: {
        type: "string",
        enum: ["finances-overview", "gms-overview", "gms-health-check",
               "settings", "transactions", "reports", "tour",
               "settings:profile", "settings:data", "settings:categories",
               "settings:backup", "settings:privacy"]
      }
    },
    required: ["target"]
  }
}
```

### 9.5 Add Missing Tools: `lookup_saved_reports` and `search_transactions`

**`lookup_saved_reports`** — Without this, Claude has no way to answer "what did you mean by recommendation 3?" after a report is generated in the background. The report content isn't in conversation history. Replaces both `isReportQuestion()` and `handleReportFollowUp()`.

```javascript
{
  name: "lookup_saved_reports",
  description: "Look up previously generated reports. Use when user references 'the report', 'your analysis', etc.",
  input_schema: {
    type: "object",
    properties: {
      search: { type: "string", description: "Search term or 'latest' for most recent" }
    },
    required: ["search"]
  }
}
```

**`search_transactions`** — The plan's `lookup_financial_data` only has 10 fixed enum values. It can't answer "what did I spend on locums in Q3?" Add a flexible search tool:

```javascript
{
  name: "search_transactions",
  description: "Search and filter individual transactions by category, date, amount, or description",
  input_schema: {
    type: "object",
    properties: {
      category: { type: "string", description: "Category name to filter by" },
      dateFrom: { type: "string", description: "Start date (YYYY-MM-DD)" },
      dateTo: { type: "string", description: "End date (YYYY-MM-DD)" },
      minAmount: { type: "number" },
      maxAmount: { type: "number" },
      searchText: { type: "string", description: "Search transaction descriptions" },
      limit: { type: "number", description: "Max results to return (default 20)" }
    }
  }
}
```

### 9.6 Let Claude Handle Report Clarifications Conversationally

The current `analyzeForClarifications()` function exists because the old flow was one-shot. With tool use, Claude has multi-turn conversation naturally. Instead of a separate clarification phase, Claude simply asks follow-up questions before calling `generate_report`:

```
User: "Generate a report on whether I should hire a nurse"
Claude: "Before I put that together — what hourly rate are you looking at,
         and would this be full-time or part-time?"
User: "Full time, around €35/hour"
Claude: [calls generate_report with enriched topic]
```

### 9.7 Add Error Handling Inside the Loop

The plan's `agenticQuery()` has no try/catch around the API call inside the for-loop. A network error on round 3 (after successful tool calls that already triggered navigation) would throw unhandled. Wrap each round:

```javascript
for (let round = 0; round < MAX_ROUNDS; round++) {
  let response;
  try {
    response = await callClaudeWithTools(systemPrompt, messages, FINN_TOOLS);
  } catch (err) {
    console.error(`[Finn] API error on tool round ${round}:`, err);
    return {
      content: "I ran into a connection issue. Please try again in a moment.",
      toolActions
    };
  }
  // ... rest of loop
}
```

### 9.8 Revised Rollout Phases (By Risk, Not Tool Type)

The original plan phases by tool category (navigation → reports → external). The revised approach phases by **risk to existing functionality**:

| Phase | What | Why This Order |
|-------|------|----------------|
| **Phase 1** | Wire up agentic loop + `lookup_financial_data` + `navigate`. Keep existing `handleSubstantiveQuery` as fallback. | Proves the plumbing works without removing anything. If tools fail, existing path still works. |
| **Phase 2** | Add `generate_report`, `search_transactions`, `lookup_saved_reports`. Remove `shouldOfferDetailedReport()`, `isReportQuestion()`, `handleReportFollowUp()`, `pendingReportOffer` state. | Replacing old code with tool equivalents, one function at a time. |
| **Phase 3** | Add `start_app_tour`, `send_feedback`, `start_pcrs_download`. Remove `isTourRequest()`, `[FEEDBACK_SUMMARY]` regex, remaining routing branches. | External/side-effect tools last, when we trust the loop. |

**Key difference:** Phase 1 runs **alongside** the existing system, not instead of it. We can route queries through `agenticQuery()` and fall back to the old path if tools return nothing.

### 9.9 What Gets Deleted (After All Phases)

| Function | Why It's Gone |
|----------|---------------|
| `isQuickQuery()` (504-527) | Replaced by 3-line greeting check |
| `isTourRequest()` (609-616) | Claude calls `start_app_tour` tool |
| `isReportQuestion()` (618-629) | Claude calls `lookup_saved_reports` |
| `shouldOfferDetailedReport()` (852-889) | Claude calls `generate_report` when appropriate |
| `isStrategicQuery()` (893-936) | Claude picks `reportType: "strategic"` in tool input |
| `isRetryRequest()` (596-606) | Claude has conversation history, knows what failed |
| `handleQuickQuery()` (830-849) | Only kept for greeting fast path |
| `handleReportFollowUp()` (784-827) | Claude uses `lookup_saved_reports` + conversation context |
| `[FEEDBACK_SUMMARY:]` regex (1087-1092) | Claude calls `send_feedback` tool |
| `pendingReportOffer` state (679-719) | No intermediate "offer" step — Claude acts directly |
| `shouldUseTools()` | Never implemented — Claude decides via `tool_choice: "auto"` |

~200+ lines of routing and keyword matching replaced by Claude's native intent understanding.

---

## 10. Future Extensions

Once the core agentic framework is in place, additional tools could include:

- `create_backup` — Trigger a full data backup
- `import_transactions` — Open the import dialog for a specific file type
- `categorize_transactions` — Run AI categorization on uncategorized transactions
- `compare_years` — Generate a year-over-year comparison
- `schedule_reminder` — Set a reminder for the user (if task system is enhanced)
- `export_for_accountant` — Generate and download the accountant export package

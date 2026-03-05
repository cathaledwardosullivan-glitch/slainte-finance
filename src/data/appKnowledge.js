/**
 * App Knowledge Base for Finn
 *
 * Documents Slainte Finance features so Finn can answer
 * "how do I..." questions about the app itself.
 *
 * Structure mirrors ehrKnowledge.js for consistency.
 * Retrieved via keyword matching in appContextBuilder.js.
 */

export const APP_KNOWLEDGE = {
  name: 'Slainte Finance',
  version: 'Current',
  topics: [
    {
      id: 'app_finances_overview',
      title: 'Finances Overview',
      keywords: ['finances', 'overview', 'dashboard', 'income', 'expenses', 'profit',
                 'chart', 'financial', 'home', 'main page', 'summary', 'net profit',
                 'profit margin', 'monthly trends'],
      content: `The Finances Overview is the main page showing your practice's financial health.

**What you'll see:**
- Income, Expenses, and Net Profit summary boxes for the selected year
- Monthly trends chart showing income vs expenses over time
- Expense breakdown by category (pie chart)
- Year selector to compare different financial years
- Rolling 12-month toggle for trailing year view

**How to access:** This is the default view when you open the app. Click "Finances Overview" in the top navigation.

**Key actions:**
- Click the Reports box to open the Reports modal for P&L statements and accountant exports
- Click the Transactions box to view and manage individual transactions
- Use the year dropdown to switch between financial years
- Toggle "Rolling 12 months" for a trailing year view instead of calendar year`
    },
    {
      id: 'app_reports',
      title: 'Reports & Profit and Loss',
      keywords: ['report', 'p&l', 'profit and loss', 'accountant', 'export',
                 'statement', 'financial report', 'download', 'pdf', 'print',
                 'profit loss', 'pnl'],
      content: `Reports can be accessed from the Reports box on the Finances Overview page.

**Available reports:**
- Profit & Loss Statement — shows income, expenses, and net profit for a selected period
- Accountant Export — formatted spreadsheet for your accountant
- AI-generated detailed analysis reports (via Finn)

**How to access:** Click the Reports box on the Finances Overview page to open the Reports modal.

**Finn Reports:** Ask Finn any financial question and click "Generate Detailed Report" for an in-depth AI analysis with charts and recommendations. Finn reports are saved in the Reports tab within the Finn chat widget and can be revisited anytime.`
    },
    {
      id: 'app_transactions',
      title: 'Transaction Management',
      keywords: ['transaction', 'categorize', 'categorise', 'category', 'uncategorized',
                 'uncategorised', 'search', 'import', 'upload', 'csv', 'bank statement',
                 'pdf', 'bank', 'recategorize', 'recategorise'],
      content: `View and manage individual transactions from the Transaction List.

**How to access:** Click the Transactions box on the Finances Overview page.

**Key features:**
- Search transactions by description or amount
- Change categories for individual transactions by clicking on a transaction
- View uncategorized transactions that need attention
- Filter by income, expenses, or all transactions
- Toggle sensitive data visibility on/off

**Importing transactions:**
- Go to Settings (gear icon, top-right) > Data Management > Import Transactions
- Upload CSV files from your bank (Bank of Ireland CSV format supported)
- Upload bank statement PDFs (Bank of Ireland PDF supported)
- Transactions are automatically categorized using your category identifiers`
    },
    {
      id: 'app_gms_overview',
      title: 'GMS Overview & PCRS Payments',
      keywords: ['gms', 'pcrs', 'payment', 'gross', 'panel', 'medical services',
                 'gms overview', 'gms dashboard', 'pcrs download', 'pcrs statement',
                 'gms income', 'hse'],
      content: `The GMS Overview page shows PCRS (Primary Care Reimbursement Service) payment data.

**How to access:** Click "GMS Overview" in the top navigation bar.

**Two sub-tabs:**
1. **GMS Dashboard** — Monthly PCRS payment breakdowns showing Total Gross Payments, payment categories, and trends from each uploaded statement
2. **GMS Health Check** — Analysis of unclaimed income opportunities and growth potential

**Importing PCRS data:**
- Ask Finn to "download my PCRS statements" for automated bulk download
- Or go to Settings > Data Management and upload PCRS PDF statements manually

**Important:** PCRS data shows GROSS payments (before HSE deductions like superannuation). Bank transactions show NET payments (after deductions). These numbers will differ — that's expected.`
    },
    {
      id: 'app_gms_healthcheck',
      title: 'GMS Health Check',
      keywords: ['health check', 'unclaimed', 'income', 'opportunity', 'growth',
                 'cdm', 'chronic disease', 'missing', 'potential', 'recommendation',
                 'practice support', 'special items', 'stc', 'special type consultation'],
      content: `The GMS Health Check analyses your practice data to find unclaimed GMS income opportunities.

**How to access:** GMS Overview > GMS Health Check tab (click the stethoscope icon).

**What it analyses:**
- CDM (Chronic Disease Management) registration rates vs potential patient numbers
- Under-claimed special items and special type consultations
- Practice Support potential based on staffing levels and qualifications
- Comparison against expected norms for your panel size and demographics

**Requirements:** You need:
1. PCRS payment data uploaded (for baseline GMS income)
2. Practice profile completed with staff details (Settings > Practice Profile)
3. Patient demographics entered (age breakdowns, nursing home patients)

**Prioritising recommendations:** Each recommendation shows estimated annual value. Focus on the highest-value items first. Finn can help you decide which recommendations to pursue — just ask.`
    },
    {
      id: 'app_settings',
      title: 'Settings',
      keywords: ['settings', 'admin', 'configure', 'setup', 'api key', 'backup',
                 'restore', 'profile', 'practice profile', 'data management',
                 'gear', 'preferences'],
      content: `Settings contains all configuration options for your practice.

**How to access:** Click the gear icon in the top-right corner of the app.

**Sections:**
- **Practice Profile** — Practice name, location, number of GPs, staff details, patient demographics
- **Data Management** — Import/export transactions, upload PCRS statements, manage data
- **Categories** — Manage expense/income categories and keyword identifiers
- **Backup & Restore** — Create full data backups or restore from a previous backup file
- **Tour & Onboarding** — Restart the guided app tour or re-run the setup wizard
- **Privacy & AI** — Toggle Local Only Mode (disables all AI features for complete offline use)`
    },
    {
      id: 'app_finn',
      title: 'Finn - AI Financial Advisor',
      keywords: ['finn', 'chat', 'ai', 'ask', 'question', 'advisor', 'widget',
                 'report', 'generate', 'analysis', 'assistant', 'chatbot',
                 'bottom right', 'floating'],
      content: `Finn is your AI financial advisor, available via the chat widget in the bottom-right corner.

**What Finn can do:**
- Answer financial questions about your practice using your actual uploaded data
- Generate detailed reports with charts (P&L analysis, expense breakdowns, strategic advisory)
- Help analyse GMS/PCRS payment data and health check recommendations
- Download PCRS statements automatically from the PCRS website
- Start an app tour to show you around all features

**How to use:**
- Click the Finn widget icon (chat bubble) in the bottom-right corner
- Type your question in the chat box and press Enter
- For complex questions, Finn gives a quick answer then offers a "Generate Detailed Report" button
- Click "Generate Detailed Report" for an in-depth analysis with charts — this runs in the background
- View saved reports in the "Reports" tab within the Finn widget

**Tips:**
- Be specific in your questions for better answers (e.g. "What were my top 5 expenses in 2024?" rather than "Tell me about expenses")
- Strategic questions (long-term planning, investment analysis) automatically use a more powerful AI model
- Finn knows your financial data, practice profile, and GMS health check results`
    },
    {
      id: 'app_tour',
      title: 'App Tour',
      keywords: ['tour', 'walkthrough', 'guide', 'show me', 'how to use',
                 'getting started', 'learn', 'features', 'tutorial'],
      content: `The App Tour is a guided walkthrough of all Slainte Finance features.

**How to start:**
- Ask Finn "show me around" or "start a tour"
- Or go to Settings > Tour & Onboarding > Start Tour

**What it covers:**
- Financial Overview and how to read your financial dashboard
- How to view and manage transactions
- GMS Overview and PCRS payment analysis
- Settings and configuration options
- How to use Finn for AI-powered financial advice`
    },
    {
      id: 'app_onboarding',
      title: 'Onboarding & Initial Setup',
      keywords: ['onboarding', 'setup', 'first time', 'new practice', 'getting started',
                 'wizard', 'configure', 'initial', 'new user'],
      content: `The Onboarding wizard guides new practices through initial setup.

**Steps:**
1. API Key Setup — enter your Claude API key (needed for AI features)
2. Practice Profile — practice name, address, number of GPs, staff details
3. Transaction Import — upload your bank CSV or bank statement PDF
4. Category Mapping — AI suggests categories for your transactions, you review and approve
5. PCRS Data Import — optional upload of PCRS statements for GMS analysis

**Re-running onboarding:** Go to Settings > Tour & Onboarding > Re-run Onboarding`
    },
    {
      id: 'app_pcrs_download',
      title: 'PCRS Bulk Download',
      keywords: ['pcrs', 'download', 'bulk', 'automated', 'login', 'credentials',
                 'renewal', 'certificate', 'pcrs website', 'automatic'],
      content: `Finn can automatically download your PCRS statements from the PCRS website.

**How to use:**
- Ask Finn: "Download my PCRS statements" or "Get my PCRS data"
- Finn will guide you through entering your PCRS credentials if not already saved
- Downloads run in the background — Finn notifies you when each panel's statements are complete
- Downloaded statements are automatically imported and available on the GMS Overview page

**Requirements:**
- PCRS login credentials (username and password)
- A valid PCRS digital certificate installed on this computer`
    },
    {
      id: 'app_categories',
      title: 'Category Management',
      keywords: ['category', 'categories', 'mapping', 'identifier', 'keyword',
                 'expense category', 'income category', 'manage categories',
                 'add category', 'custom category', 'identifiers'],
      content: `Categories determine how transactions are classified (e.g., Staff Costs, Premises, Medical Supplies).

**How to access:** Settings > Categories

**Key features:**
- View all expense and income categories with their current keyword identifiers
- Add keyword identifiers to categories (e.g., adding "BUPA" to "Medical Insurance")
- Create custom categories for your practice's specific needs
- AI can suggest identifiers based on your uncategorized transaction descriptions

**How categorization works:**
- When transactions are imported, the app matches description keywords against your category identifiers
- Matched transactions are automatically categorized
- Unmatched transactions appear as "Uncategorized" for manual review
- You can ask the AI to suggest categories for uncategorized transactions from the Transaction List`
    },
    {
      id: 'app_backup',
      title: 'Backup & Restore',
      keywords: ['backup', 'restore', 'export', 'save', 'data', 'lost',
                 'recover', 'download backup', 'data loss'],
      content: `Create and restore full backups of your Slainte Finance data.

**How to access:** Settings > Backup & Restore

**Creating a backup:**
- Click "Create Backup" to download a JSON file containing all your data
- Includes: transactions, categories, practice profile, GMS data, saved reports, and all settings

**Restoring from backup:**
- Click "Restore from Backup" and select a previously saved backup file
- This replaces all current data with the backup data

**Recommendation:** Create regular backups, especially before importing large datasets or making significant category changes.`
    },
    {
      id: 'app_local_only',
      title: 'Local Only Mode & Privacy',
      keywords: ['local only', 'privacy', 'offline', 'no ai', 'data privacy',
                 'local mode', 'disable ai', 'private'],
      content: `Local Only Mode disables all AI features for complete offline, private use.

**How to toggle:** Settings > Privacy & AI > Local Only Mode

**When enabled:**
- No data is sent to any AI service
- Finn chat is disabled
- AI categorization suggestions are disabled
- All financial data stays entirely on your computer
- Manual categorization and all non-AI features continue to work normally

**When disabled (default):**
- Finn and AI features are available
- Financial data is sent to Claude API only when you actively use AI features (asking Finn questions, generating reports, AI categorization)
- Your API key is stored securely in the Electron userData directory, never in browser storage`
    }
  ]
};

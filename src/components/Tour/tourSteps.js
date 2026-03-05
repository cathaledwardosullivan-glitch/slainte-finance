// Tour Step Definitions
// Each step defines where to navigate, what to highlight, and what to explain
// Updated for 2-tab navigation: Business Overview / GMS Health Check

export const TOUR_STEPS = [
  // ============================================
  // PHASE 1: Introduction (Step 1)
  // ============================================
  // Note: Finn introduction (welcome) step removed - already done during onboarding

  // Step 1: Navigation Tabs
  {
    id: 'navigation',
    page: 'business-overview',
    target: 'nav-tabs',
    position: 'bottom',
    title: 'Two Sides of Your Practice',
    content: 'The app is organised into two main areas.',
    finnText: "Let me show you around! Sláinte Finance has two main views: Financial Overview shows your bank transactions, income, and expenses. GMS Overview is for HSE payments - uploading your statements and analysing your GMS income. Let's start with Financial Overview!",
    allowQuestions: true,
  },

  // ============================================
  // PHASE 2: Financial Overview (Steps 2-6)
  // ============================================

  // Step 2: Key Financial Metrics (4 cards)
  {
    id: 'kpi-cards',
    page: 'business-overview',
    target: 'finance-kpi-cards',
    position: 'bottom',
    title: 'Key Financial Metrics',
    content: 'Your practice finances at a glance.',
    finnText: "These four cards give you the big picture: Total Income, Total Expenses, Net Profit, and Withholding Tax. Click any card to see a detailed breakdown. They update in real-time as you categorise transactions.",
    allowQuestions: true,
  },

  // Step 3: Income & Expense Trends Chart
  {
    id: 'trends-chart',
    page: 'business-overview',
    target: 'finance-chart',
    position: 'top',
    title: 'Income & Expense Trends',
    content: 'See your finances over time.',
    finnText: "This chart shows your financial trends month by month. Use the toggle buttons to switch between Income, Expenses, and Profit views. The dashed line shows last year for comparison - great for spotting seasonal patterns!",
    allowQuestions: true,
  },

  // Step 4: Reports Box
  {
    id: 'reports-box',
    page: 'business-overview',
    target: 'finance-reports-box',
    position: 'top',
    title: 'Reports',
    content: 'Generate professional reports for your accountant.',
    finnText: "Click here to generate and view reports. Whether it's P&L statements, Tax Returns, or Partner Accounts - everything your accountant needs is just a click away. Let me show you inside...",
    allowQuestions: true,
  },

  // Step 5: Reports Modal (opens during this step)
  {
    id: 'reports-modal',
    page: 'business-overview',
    target: null,
    position: 'center',
    hideCenterSplash: true, // No centre splash - modal is visible
    title: 'Generate Reports',
    content: 'Professional reports ready for your accountant.',
    finnText: "Here you can generate P&L Reports, Partner Capital Accounts, and Personal Tax Return forms. Your saved reports appear below in the collapsible section. I can also generate comprehensive reports for you in the background - just ask me in chat!",
    onEnter: 'openReportsModal',
    onExit: 'closeReportsModal',
    allowQuestions: true,
  },

  // Step 6: Transactions Box (merged with smart learning tip)
  {
    id: 'transactions-box',
    page: 'business-overview',
    target: 'finance-transactions-box',
    position: 'top',
    title: 'Transactions',
    content: 'Review and manage your categorised transactions.',
    finnText: "Click here to view and manage your transactions. You can review categorisations, add comments, and correct any that need attention. When you correct a categorisation, the app remembers - next time the same payee appears, it'll be categorised automatically. The more you use it, the smarter it gets!",
    allowQuestions: true,
  },

  // ============================================
  // PHASE 3: GMS Overview (Steps 7-9)
  // ============================================

  // Step 7: GMS Dashboard Navigation (within Business Overview)
  {
    id: 'gms-overview',
    page: 'business-overview',
    target: 'business-dashboard-toggle',
    position: 'bottom',
    finnPosition: 'bottom-left', // Move Finn to bottom-left on GMS pages
    title: 'GMS Overview',
    content: 'Your HSE income centre.',
    finnText: "Now we're in GMS Overview - your hub for HSE income. You can toggle between GMS Dashboard (your payment breakdown) and GMS Health Check (a deep analysis of your income). Upload your GMS PDFs in Settings to see your data here.",
    onEnter: 'switchToGMSDashboard',
    allowQuestions: true,
  },

  // Step 8: GMS Dashboard Content - highlight the chart
  {
    id: 'gms-dashboard',
    page: 'business-overview',
    target: 'gms-dashboard-chart',
    position: 'bottom',
    finnPosition: 'bottom-left',
    title: 'GMS Dashboard',
    content: 'See where your GMS income comes from.',
    finnText: "The Dashboard shows your payment breakdown - capitation, items of service, special items, and more. This chart visualises your GMS income over time, making it easy to spot trends and understand your panel value.",
    onEnter: 'switchToDashboard',
    allowQuestions: true,
  },

  // Step 9: GMS Health Check availability (single summary panel)
  {
    id: 'gms-health-check-summary',
    page: 'gms-health-check',
    target: 'nav-tabs',
    position: 'bottom',
    finnPosition: 'bottom-left',
    title: 'GMS Health Check',
    content: 'Deep analysis of your GMS income.',
    finnText: "The GMS Health Check is a powerful analysis tool that compares what you're receiving from the HSE against what you should be earning. It covers capitation, practice support, leave entitlements, chronic disease management, and more. It becomes available once you've uploaded 12 months of GMS statements - I'll guide you through it with a dedicated walkthrough when you're ready!",
    allowQuestions: true,
  },

  // ============================================
  // PHASE 4: Tasks, Settings & Completion (Steps 10-16)
  // ============================================

  // Step 10: Tasks Widget
  {
    id: 'tasks-widget',
    page: 'business-overview',
    target: 'tasks-widget',
    position: 'left',
    title: 'Tasks Widget',
    content: 'Your combined action items.',
    finnText: "This is your Tasks widget - it combines financial tasks and GMS action items in one place. Overdue uploads, reports to generate, opportunities to chase - everything that needs your attention is right here!",
    onEnter: 'openTasksWidget',
    allowQuestions: true,
  },

  // Step 11: Manage Tasks Modal
  {
    id: 'manage-tasks',
    page: 'business-overview',
    target: null,
    position: 'center',
    hideCenterSplash: true,
    title: 'Manage Tasks',
    content: 'Create and assign tasks.',
    finnText: "Click 'Manage Tasks' to open the full task manager. Here you can create new tasks with due dates, assign them to staff members, and track progress. You'll also see Financial Tasks that are automatically generated based on your data - like overdue bank uploads or reports to generate.",
    onEnter: 'openManageTasksModal',
    onExit: 'closeManageTasksModal',
    allowQuestions: true,
  },

  // Step 12: Settings Button (opens Settings modal)
  {
    id: 'settings-button',
    page: 'business-overview',
    target: 'settings-button',
    position: 'left',
    title: 'Settings',
    content: 'Your control centre for the app.',
    finnText: "The Settings button opens your control centre. From here you can upload data, manage categories, back up your work, and configure your practice profile. Let me show you the key sections...",
    allowQuestions: true,
  },

  // Step 13: Settings - Data Tab (inside modal)
  {
    id: 'settings-data-tab',
    page: 'business-overview',
    target: 'settings-data-tab',
    position: 'right',
    title: 'Upload Data',
    content: 'Bank statements and GMS PDFs.',
    finnText: "The Data section is where you upload bank statements and GMS PDFs. You can also set up automatic downloads for your GMS statements - the app will fetch them for you each month!",
    onEnter: 'openSettingsModal',
    allowQuestions: true,
  },

  // Step 14: Settings - Categories Tab
  {
    id: 'settings-categories-tab',
    page: 'business-overview',
    target: 'settings-categories-tab',
    position: 'right',
    title: 'Categories',
    content: 'Manage expense categories.',
    finnText: "The Categories section lets you manage your expense categories and add keyword identifiers. This helps the app categorise transactions more accurately. You can personalise categories to match your practice.",
    onEnter: 'switchToSettingsCategories',
    allowQuestions: true,
  },

  // Step 15: Settings - Data for Accountant Tab
  {
    id: 'settings-accountant-tab',
    page: 'business-overview',
    target: 'settings-accountant-tab',
    position: 'right',
    title: 'Data for Accountant',
    content: 'Export data for your accountant.',
    finnText: "The Data for Accountant section lets you export your financial data in formats your accountant can use. You can export transactions, P&L summaries, and other reports as spreadsheets or PDFs - making tax time much easier!",
    onEnter: 'switchToSettingsAccountant',
    allowQuestions: true,
  },

  // Step 16: Completion with next-step choice
  {
    id: 'complete',
    page: 'business-overview',
    target: 'finn-widget',
    position: 'left',
    hideCenterSplash: true,
    title: "You're All Set!",
    content: '',
    finnText: "That's the tour complete! I'm always here in this chat widget when you need me. Now, which area would you like to focus on first?",
    onEnter: 'closeSettingsModal',
    allowQuestions: false,
    choices: [
      {
        id: 'bank-transactions',
        label: 'Bank Transactions',
        description: 'Upload and review your bank statements',
      },
      {
        id: 'gms-payments',
        label: 'GMS Payments',
        description: 'Upload and analyse your PCRS statements',
      },
    ],
  },
];

// ============================================
// GMS Health Check Mini-Tour
// Separate walkthrough for the Health Check feature
// Triggered when user has 12+ months of GMS data
// ============================================

export const GMS_HEALTH_CHECK_TOUR_STEPS = [
  // Step 1: Health Check Overview
  {
    id: 'hc-overview',
    page: 'gms-health-check',
    target: 'nav-tabs',
    position: 'bottom',
    finnPosition: 'bottom-left',
    title: 'GMS Health Check',
    content: 'Deep analysis of your GMS income.',
    finnText: "Welcome to the GMS Health Check walkthrough! This tool compares what you're receiving from the HSE against what you should be earning. Let me walk you through the 6 key income categories...",
    onEnter: 'switchToHealthCheck',
    allowQuestions: true,
  },

  // Step 2: Capitation Income
  {
    id: 'hc-capitation',
    page: 'gms-health-check',
    target: 'hc-capitation',
    position: 'bottom',
    finnPosition: 'bottom-left',
    title: 'Capitation Income',
    content: 'Patient registration payments.',
    finnText: "Capitation is your base payment for each registered patient. The Health Check identifies registration gaps - patients attending your practice who aren't registered with you. Even a small gap can mean thousands in lost income!",
    allowQuestions: true,
  },

  // Step 3: Practice Support
  {
    id: 'hc-practiceSupport',
    page: 'gms-health-check',
    target: 'hc-practiceSupport',
    position: 'bottom',
    finnPosition: 'bottom-left',
    title: 'Practice Support',
    content: 'Staff subsidies and allowances.',
    finnText: "Practice Support Subsidy covers your staff costs - practice nurses, secretaries, and managers. The Health Check verifies you're claiming the correct tier based on your panel size.",
    allowQuestions: true,
  },

  // Step 4: Leave Payments
  {
    id: 'hc-leavePayments',
    page: 'gms-health-check',
    target: 'hc-leavePayments',
    position: 'bottom',
    finnPosition: 'bottom-left',
    title: 'Leave Payments',
    content: 'Study leave and annual leave claims.',
    finnText: "You're entitled to paid study leave (10 days) and annual leave (up to 5 weeks). Many GPs don't claim their full entitlement. The Health Check highlights any unclaimed leave payments.",
    allowQuestions: true,
  },

  // Step 5: Chronic Disease Management
  {
    id: 'hc-diseaseManagement',
    page: 'gms-health-check',
    target: 'hc-diseaseManagement',
    position: 'bottom',
    finnPosition: 'bottom-left',
    title: 'Chronic Disease Management',
    content: 'CDM programme payments.',
    finnText: "CDM payments reward structured care for patients with diabetes, COPD, asthma, and cardiovascular disease. The Health Check compares your income against your disease register.",
    allowQuestions: true,
  },

  // Step 6: Cervical Screening
  {
    id: 'hc-cervicalCheck',
    page: 'gms-health-check',
    target: 'hc-cervicalCheck',
    position: 'bottom',
    finnPosition: 'bottom-left',
    title: 'Cervical Screening',
    content: 'CervicalCheck programme payments.',
    finnText: "CervicalCheck payments are made for smear tests on eligible patients. The Health Check identifies zero-payment months and shows growth potential against benchmarks.",
    allowQuestions: true,
  },

  // Step 7: STC Payments
  {
    id: 'hc-stc',
    page: 'gms-health-check',
    target: 'hc-stc',
    position: 'bottom',
    finnPosition: 'bottom-left',
    title: 'STC Payments',
    content: 'Special Type Consultations.',
    finnText: "STC payments cover specific services like out-of-hours, excisions, ECGs, and spirometry. The Health Check identifies opportunities to grow this income through additional services.",
    allowQuestions: true,
  },

  // Step 8: Completion
  {
    id: 'hc-complete',
    page: 'gms-health-check',
    target: 'nav-tabs',
    position: 'bottom',
    finnPosition: 'bottom-left',
    hideCenterSplash: true,
    title: 'Health Check Complete!',
    content: '',
    finnText: "That's your GMS Health Check walkthrough complete! Each category card shows your current income, potential gaps, and actionable recommendations. Review them regularly to make sure you're claiming everything you're entitled to. I'm always here if you have questions!",
    allowQuestions: true,
  },
];

export default TOUR_STEPS;

// Tour Step Definitions
// Each step defines where to navigate, what to highlight, and what to explain
// Order follows navigation tabs: Finances - Home, Reports, Transactions, Financial Consultation, GMS Overview, GMS Health Check, Admin Settings

export const TOUR_STEPS = [
  // Step 1: Welcome
  {
    id: 'welcome',
    page: 'dashboard',
    target: null,
    position: 'center',
    title: 'Welcome',
    content: '',
    caraText: "Hi! I'm Cara, your guide to Sláinte Finance. I'm going to show you around the key features of the app. This tour takes about 3 minutes and you can skip it anytime. Ready? Let's go!",
    allowQuestions: true,
  },

  // Step 2: Navigation
  {
    id: 'navigation',
    page: 'dashboard',
    target: 'nav-tabs',
    position: 'bottom',
    title: 'Navigation',
    content: 'Use these tabs to move between different sections of the app.',
    caraText: "These tabs are your main navigation. You'll spend most of your time on Finances - Home and Transactions, but Reports and GMS Overview are essential for accountant prep and PCRS analysis.",
    allowQuestions: true,
  },

  // Step 3: Summary Cards (Finances - Home)
  {
    id: 'summary-cards',
    page: 'dashboard',
    target: 'dashboard-summary-cards',
    position: 'bottom',
    title: 'Financial Summary',
    content: 'Your income, expenses, and net profit at a glance.',
    caraText: "Your financial snapshot! These three cards give you the big picture: what came in, what went out, and what's left. They update in real-time as you categorize transactions.",
    allowQuestions: true,
  },

  // Step 4: Charts Section (Finances - Home)
  {
    id: 'charts-section',
    page: 'dashboard',
    target: 'dashboard-charts',
    position: 'top',
    title: 'Trends & Visualizations',
    content: 'See your income and expenses over time.',
    caraText: "Visual data is easier to digest. These charts help you see patterns in your finances - like which months are strongest for income or when expenses tend to spike.",
    allowQuestions: true,
  },

  // Step 5: Financial Action Plans (Finances - Home)
  {
    id: 'action-plans',
    page: 'dashboard',
    target: 'dashboard-action-plans',
    position: 'top',
    title: 'Financial Action Plans',
    content: 'AI-suggested tasks to keep your finances on track.',
    caraText: "Think of this as your financial to-do list. The app suggests tasks based on what needs attention - overdue uploads, reports to generate, transactions to review. It keeps you on track!",
    allowQuestions: true,
  },

  // Step 6: Reports Home
  {
    id: 'reports',
    page: 'export',
    target: 'reports-home',
    position: 'bottom',
    title: 'Reports',
    content: 'Your reports hub for accountant preparation.',
    caraText: "When it's time to talk to your accountant, this is your go-to page. You can generate new reports or access ones you've already created.",
    allowQuestions: true,
  },

  // Step 7: Report Types Selection
  {
    id: 'report-types',
    page: 'export',
    target: 'reports-section',
    viewState: 'generate',
    position: 'bottom',
    title: 'Available Reports',
    content: 'Choose from P&L, Partner Accounts, Tax Returns, and more.',
    caraText: "Here are all the reports you can generate. The P&L Report gives your accountant a professional profit and loss statement. Partner Capital Accounts help with profit sharing. The Personal Tax Return form prepares everything you need for your tax filing. Each report is designed to give your accountant exactly what they need.",
    allowQuestions: true,
  },

  // Step 8: Transaction Table
  {
    id: 'transaction-table',
    page: 'transactions',
    target: 'transaction-table',
    position: 'top',
    title: 'Your Transactions',
    content: 'All your bank transactions in one place.',
    caraText: "This is where the magic happens! Every transaction from your bank statements appears here. The AI tries to categorize them automatically, but you can always correct it.",
    allowQuestions: true,
  },

  // Step 9: Repeating Transactions
  {
    id: 'repeating-transactions',
    page: 'transactions',
    target: 'repeating-transactions-card',
    position: 'left',
    title: 'Smart Learning',
    content: 'The app learns from your categorization choices.',
    caraText: "This is the learning engine! When you categorize a transaction, the app remembers. Next time the same payee appears, it'll be categorized automatically. Less work for you over time!",
    allowQuestions: true,
  },

  // Step 10: Financial Consultation (Finn)
  {
    id: 'financial-consultation',
    page: 'chat',
    target: 'financial-consultation-section',
    position: 'bottom',
    title: 'Financial Consultation',
    content: 'Your AI financial advisor for deep analysis.',
    caraText: "Meet Finn, your practice CFO! He uses the latest and most advanced AI models to think deeply about any big questions your practice is facing. Finn provides responses based on his in-depth and constantly growing knowledge of your practice - from cash flow analysis to strategic planning. It's like having a financial expert on call 24/7.",
    allowQuestions: true,
  },

  // Step 11: GMS Dashboard Overview
  {
    id: 'gms-overview',
    page: 'gms-panel',
    target: 'gms-overview-section',
    position: 'bottom',
    title: 'GMS Overview',
    content: 'Your PCRS payment breakdown.',
    caraText: "This page is for GMS practices. Upload your monthly PCRS PDFs and see exactly where your GMS income comes from - capitation, items of service, special items, and more. Great for understanding your panel value!",
    allowQuestions: true,
  },

  // Step 12: GMS Action Plan
  {
    id: 'gms-action-plan',
    page: 'gms-panel',
    target: 'gms-action-plan',
    position: 'top',
    title: 'GMS Action Plan',
    content: 'Opportunities to maximize your GMS income.',
    caraText: "This is where the magic happens for GMS! The app analyzes your PCRS data and suggests specific actions to boost your income. Missing registrations, unclaimed leaves, growth opportunities - it's all here.",
    allowQuestions: true,
  },

  // Step 13: GMS Health Check - Introduction
  {
    id: 'gms-health-check-intro',
    page: 'gms-health-check',
    target: 'gms-health-check-section',
    viewState: 'report',
    position: 'bottom',
    title: 'GMS Health Check',
    content: 'Comprehensive GMS income analysis.',
    caraText: "This is the deep dive! The Health Check compares what you're actually receiving from the HSE against what you should be earning. It analyzes 6 key income categories and identifies exactly where you're leaving money on the table. Let me show you each one...",
    allowQuestions: true,
  },

  // Step 14: Capitation Income
  {
    id: 'hc-capitation',
    page: 'gms-health-check',
    target: 'hc-capitation',
    viewState: 'report',
    position: 'bottom',
    title: 'Capitation Income',
    content: 'Patient registration payments.',
    caraText: "Capitation is your base payment for each registered patient. The Health Check identifies registration gaps - patients attending your practice who aren't registered with you on the GMS panel. Even a small registration gap can mean thousands in lost income annually.",
    allowQuestions: true,
  },

  // Step 15: Practice Support
  {
    id: 'hc-practiceSupport',
    page: 'gms-health-check',
    target: 'hc-practiceSupport',
    viewState: 'report',
    position: 'bottom',
    title: 'Practice Support',
    content: 'Staff subsidies and allowances.',
    caraText: "Practice Support Subsidy covers your staff costs - practice nurses, secretaries, and practice managers. The Health Check verifies you're claiming the correct tier based on your panel size and identifies if you're missing any allowances you're entitled to.",
    allowQuestions: true,
  },

  // Step 16: Study and Annual Leave
  {
    id: 'hc-leavePayments',
    page: 'gms-health-check',
    target: 'hc-leavePayments',
    viewState: 'report',
    position: 'bottom',
    title: 'Leave Payments',
    content: 'Study leave and annual leave claims.',
    caraText: "You're entitled to paid study leave (10 days) and annual leave (up to 5 weeks). Many GPs don't claim their full entitlement. The Health Check calculates what you should be receiving and highlights any unclaimed leave payments.",
    allowQuestions: true,
  },

  // Step 17: Chronic Disease Management
  {
    id: 'hc-diseaseManagement',
    page: 'gms-health-check',
    target: 'hc-diseaseManagement',
    viewState: 'report',
    position: 'bottom',
    title: 'Chronic Disease Management',
    content: 'CDM programme payments.',
    caraText: "CDM payments reward you for structured care of patients with diabetes, COPD, asthma, and cardiovascular disease. The Health Check compares your CDM income against your disease register to identify patients who may be missing structured reviews.",
    allowQuestions: true,
  },

  // Step 18: Cervical Screening
  {
    id: 'hc-cervicalCheck',
    page: 'gms-health-check',
    target: 'hc-cervicalCheck',
    viewState: 'report',
    position: 'bottom',
    title: 'Cervical Screening',
    content: 'CervicalCheck programme payments.',
    caraText: "CervicalCheck payments are made for smear tests on eligible patients. The Health Check identifies zero-payment months and compares your screening rate against benchmarks to show growth potential.",
    allowQuestions: true,
  },

  // Step 19: STC (Special Type Consultations)
  {
    id: 'hc-stc',
    page: 'gms-health-check',
    target: 'hc-stc',
    viewState: 'report',
    position: 'bottom',
    title: 'STC Payments',
    content: 'Special Type Consultation fees.',
    caraText: "STC payments cover specific services like out-of-hours, excisions, ECGs, and spirometry. The Health Check identifies opportunities to grow this income through additional services your practice could offer.",
    allowQuestions: true,
  },

  // Step 20: Admin Settings
  {
    id: 'admin-settings',
    page: 'admin',
    target: 'admin-upload-data',
    position: 'bottom',
    title: 'Admin Settings',
    content: 'Your control centre for the app.',
    caraText: "The Admin page is your control centre! From here you can upload bank statements and PCRS data, manage your expense categories, back up your data, update your practice profile, and access data management tools. You can also restart this tour anytime. Pro tip: back up your data regularly!",
    allowQuestions: true,
  },

  // Step 21: Meet Cara
  {
    id: 'meet-cara',
    page: 'dashboard',
    target: 'cara-button',
    position: 'left',
    title: 'Meet Cara',
    content: 'Your guide to the app.',
    caraText: "Then there's me! I'm always here when you need me to answer your questions about the app. If you ever get stuck or can't find something, just click my button and ask. I know this app inside and out!",
    allowQuestions: true,
  },

  // Step 22: Completion
  {
    id: 'complete',
    page: 'dashboard',
    target: null,
    position: 'center',
    title: "You're All Set!",
    content: '',
    caraText: "That's the tour complete! You now know your way around Sláinte Finance. Ready to get started? Upload a bank statement from the Transactions page, or explore with the demo data. You can restart this tour anytime from Admin Settings. I'm always here if you need help!",
    allowQuestions: true,
  },
];

export default TOUR_STEPS;

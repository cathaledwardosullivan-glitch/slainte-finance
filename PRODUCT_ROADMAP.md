# Sláinte Finance: Product Roadmap & Scaling Strategy

**Document Version:** 1.0
**Last Updated:** 2025-01-12
**Author:** Development Team

---

## Executive Summary

This document outlines the strategic roadmap for Sláinte Finance from single-practice prototype to multi-practice SaaS product. The approach prioritizes security and simplicity in Phase 1, with a clear path to scalable cloud infrastructure as the product grows.

**Key Philosophy:** Build for security first, scale when validated.

---

## Current State (Pre-Phase 1)

### Technology Stack
- **Frontend:** React + Vite
- **Storage:** localStorage (browser-based)
- **Deployment:** Netlify (static PWA)
- **Chat:** Local API server (localhost:3001)
- **Sync:** Manual JSON export/import via cloud storage

### Limitations
- ❌ Chat doesn't work on deployed PWA
- ❌ Manual sync workflow too complex for users
- ❌ No desktop installation (browser-only)
- ❌ No multi-device support
- ❌ Not installable on practice Windows computers

### Assets Completed
- ✅ Full financial dashboard
- ✅ Transaction import and categorization
- ✅ PCRS payment analysis
- ✅ GMS Health Check feature
- ✅ Saved reports system
- ✅ AI chat interface (frontend)
- ✅ PWA manifest and service worker

---

## Phase 1: Single Practice Prototype (Months 1-3)

**Goal:** Deploy working system for own practice with desktop + mobile access

### Architecture: Direct-Connect (Option D)

```
Desktop Computer (Practice Office)
├── Electron App (Windows installation)
│   ├── Full Sláinte Finance UI (practice manager)
│   ├── localStorage (existing data storage)
│   ├── Express API server (built-in, port 3001)
│   └── Chat AI integration (direct Claude API calls)
└── Cloudflare Tunnel
    └── Public URL: https://yourpractice.slainte.com
        ↓
Mobile PWAs (Partners)
├── Partner 1 → View dashboards, reports, chat
├── Partner 2 → View dashboards, reports, chat
└── Partner 3 → View dashboards, reports, chat
```

### Technical Changes Required

#### 1. Electron Desktop App
- **Package existing React app** as Electron
- **Add Express server** to Electron main process
- **Expose API endpoints** for mobile:
  - `GET /api/dashboard` - Summary data
  - `GET /api/reports` - Saved reports
  - `GET /api/gms-health-check` - Latest health check
  - `POST /api/chat` - AI chat (proxies to Claude)
- **Authentication:** Simple JWT tokens for partners
- **Keep localStorage** - no database migration needed

#### 2. Cloudflare Tunnel Setup
- Install cloudflared in Electron
- Auto-connect on app startup
- Stable public URL for mobile access
- Zero port forwarding/firewall config

#### 3. Mobile PWA Updates
- Change API base URL to Cloudflare Tunnel URL
- Add authentication (partner login)
- Remove sync manager (not needed - direct connection)
- Keep all existing UI components

### Data Flow

```
Practice Manager (Desktop)
├── Imports bank statements
├── Generates reports
├── Uses chat locally
└── Data stored in localStorage
    ↓
Partners (Mobile)
├── Authenticate with token
├── Fetch data via API (real-time)
├── View dashboards/reports
└── Use chat (routed through desktop)
```

### Features

**Desktop (Full Access):**
- ✅ All current features
- ✅ Transaction import and categorization
- ✅ Report generation
- ✅ GMS Health Check
- ✅ AI chat (unlimited, direct API)
- ✅ Runs 24/7 (or on schedule)

**Mobile (Read + Chat):**
- ✅ Dashboard view (income, expenses, profit)
- ✅ Saved reports browsing
- ✅ GMS Health Check results
- ✅ AI chat (routed through desktop)
- ❌ No transaction editing (one-way data flow)
- ❌ No imports (desktop only)

### Success Criteria

- [ ] Electron app installed on practice Windows PC
- [ ] Desktop runs 24/7 with API server
- [ ] 3 partners can access via mobile
- [ ] Chat works on mobile
- [ ] Reports update in real-time on mobile
- [ ] Zero cloud costs
- [ ] System runs for 3 months without issues

### Timeline: 6-8 Weeks

**Weeks 1-2: Electron Setup**
- Package React app as Electron
- Test desktop installation
- Verify localStorage works in Electron

**Weeks 3-4: API Server**
- Build Express server in Electron main process
- Create API endpoints
- Implement JWT authentication
- Test with Postman/curl

**Weeks 5-6: Cloudflare Tunnel**
- Set up cloudflared
- Configure auto-start
- Test external access
- Secure tunnel configuration

**Weeks 7-8: Mobile Integration**
- Update PWA to call new API
- Add authentication UI
- Test on partner phones
- Deploy to Netlify (PWA shell)
- End-to-end testing

### Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Desktop must stay on | High | Set up auto-start, monitor uptime |
| Internet outage | Medium | Desktop continues working offline, mobile waits |
| Cloudflare Tunnel drops | Medium | Auto-reconnect logic, fallback to ngrok |
| Security breach | High | Strong JWT secrets, HTTPS only, regular token rotation |

### Costs

- **Cloudflare Tunnel:** €0 (free)
- **Netlify (PWA hosting):** €0 (free tier)
- **Claude API:** ~€20-50/month (usage-based)
- **Total:** ~€20-50/month

---

## Phase 2: Multi-Practice Product (Months 4-12)

**Goal:** Offer to 5-20 other practices, validate market fit

### Decision Point: Stay Standalone or Migrate to Cloud?

At ~5-10 practices, evaluate:

#### **Option A: Replicate Standalone** (Continue Option D)

**Each practice gets:**
- Their own Electron installation
- Their own Cloudflare Tunnel URL
- Fully isolated data
- Manual updates (you push Electron updates)

**Pros:**
- ✅ Maximum security/privacy
- ✅ No cloud costs
- ✅ Practice owns their data
- ✅ No shared failure point

**Cons:**
- ❌ Support burden scales linearly (10 practices = 10x support)
- ❌ Must individually update each installation
- ❌ No benchmarking/network effects
- ❌ Can't remotely debug issues

**Best for:** Security-conscious practices, slow growth (5-10 practices max)

#### **Option B: Migrate to Cloud** (Supabase + Vercel)

**Architecture:**
```
Cloud Infrastructure (Supabase + Vercel)
├── PostgreSQL Database (practice data isolated by RLS)
├── Authentication (user accounts)
├── Vercel Edge Functions (chat API)
└── Automatic backups
    ↓
All Practices Connect
├── Practice 1: Desktop + Mobile → Cloud
├── Practice 2: Desktop + Mobile → Cloud
└── Practice N: Desktop + Mobile → Cloud
```

**Pros:**
- ✅ Deploy once, everyone updates
- ✅ Central support/monitoring
- ✅ Automatic backups
- ✅ Enables benchmarking
- ✅ Scales to 100s of practices
- ✅ Remote debugging possible

**Cons:**
- ❌ Data in cloud (requires trust)
- ❌ Monthly costs (~€25-50 for 50 practices)
- ❌ Must implement robust security (RLS, encryption)
- ❌ Single point of failure (mitigated by cloud SLA)

**Best for:** Growth-focused, 10+ practices, want network effects

### Recommended Strategy: **Hybrid Offering**

Offer both deployment models as different tiers:

#### Tier 1: "Standalone Edition" (Option D)
- **Target:** Large/security-conscious practices
- **Price:** €199/month (reflects manual support cost)
- **Features:**
  - On-premise Electron deployment
  - Private Cloudflare Tunnel
  - No cloud dependencies
  - Data stays on-site
  - Manual updates (white-glove service)
- **Positioning:** Premium, maximum security

#### Tier 2: "Cloud Edition" (Supabase)
- **Target:** Small-medium practices, tech-forward
- **Price:** €79/month
- **Features:**
  - Web + mobile access
  - Automatic updates
  - Cloud backups
  - 99.9% uptime SLA
  - Self-service support
- **Positioning:** Convenient, modern

### Cloud Architecture (If Chosen)

#### Technology Stack
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Backend API:** Vercel Serverless Functions
- **Frontend:** React (Desktop web + Mobile PWA)
- **File Storage:** Supabase Storage (for PDFs/reports)

#### Security Model

**Row Level Security (RLS) Policies:**
```sql
-- Practices can only see their own data
CREATE POLICY "Practice isolation"
ON transactions
FOR ALL
USING (
  practice_id IN (
    SELECT practice_id
    FROM practice_members
    WHERE user_id = auth.uid()
  )
);

-- Partners are read-only
CREATE POLICY "Partners read-only"
ON transactions
FOR SELECT
USING (
  auth.jwt() ->> 'role' IN ('partner', 'manager')
);

-- Only managers can edit
CREATE POLICY "Managers can edit"
ON transactions
FOR UPDATE
USING (
  auth.jwt() ->> 'role' = 'manager'
);
```

#### Database Schema

```sql
-- Practices table
CREATE TABLE practices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  location TEXT,
  practice_size TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Practice members (managers + partners)
CREATE TABLE practice_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  practice_id UUID REFERENCES practices(id),
  user_id UUID REFERENCES auth.users(id),
  role TEXT CHECK (role IN ('manager', 'partner')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(practice_id, user_id)
);

-- Transactions (existing structure)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  practice_id UUID REFERENCES practices(id),
  date DATE,
  description TEXT,
  amount DECIMAL(10,2),
  category TEXT,
  year INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved reports
CREATE TABLE saved_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  practice_id UUID REFERENCES practices(id),
  report_type TEXT,
  report_data JSONB,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Migration from localStorage

```javascript
// migration-tool.js - Run once per practice
async function migrateToSupabase(supabase, practiceId) {
  // Export from localStorage
  const transactions = JSON.parse(localStorage.getItem('gp_finance_transactions') || '[]');
  const reports = JSON.parse(localStorage.getItem('gp_finance_saved_reports') || '[]');
  const categories = JSON.parse(localStorage.getItem('gp_finance_categories') || '[]');

  // Import to Supabase with practice_id
  await supabase.from('transactions').insert(
    transactions.map(t => ({ ...t, practice_id: practiceId }))
  );

  await supabase.from('saved_reports').insert(
    reports.map(r => ({ ...r, practice_id: practiceId }))
  );

  await supabase.from('category_mappings').insert(
    categories.map(c => ({ ...c, practice_id: practiceId }))
  );

  console.log('Migration complete!');
}
```

### Phase 2 Success Criteria

- [ ] 5-20 practices using the system
- [ ] Choose standalone vs cloud path (or hybrid)
- [ ] If cloud: Migration tool tested with 3 practices
- [ ] Support processes documented
- [ ] Pricing validated with customers
- [ ] Monthly recurring revenue > €500

### Timeline: 6-12 Months

**Months 4-6: First 5 Practices**
- Replicate Phase 1 setup for each practice
- Document installation process
- Build support knowledge base
- Gather feedback

**Months 7-9: Scale Decision**
- Evaluate support burden
- Decide standalone vs cloud
- If cloud: Build Supabase infrastructure
- If standalone: Automate deployment

**Months 10-12: Growth**
- Onboard 10-20 practices
- Refine pricing
- Build marketing site
- Establish product-market fit

---

## Phase 3: Network Intelligence (Months 13-24)

**Goal:** Enable opt-in benchmarking and competitive intelligence

### Prerequisites

- ✅ 30+ practices on cloud infrastructure
- ✅ Trust established with customer base
- ✅ Legal review of data aggregation (GDPR)
- ✅ Anonymization system tested

### Anonymized Benchmarking Architecture

```javascript
// Aggregation Service (runs nightly)
async function aggregateBenchmarks() {
  // Group practices by similarity
  const practices = await supabase
    .from('practices')
    .select('id, location, practice_size, gp_count');

  const cohorts = groupPractices(practices, {
    location: ['Leinster', 'Munster', 'Connacht', 'Ulster'],
    size: ['1-2 GPs', '3-5 GPs', '6+ GPs'],
    setting: ['Urban', 'Rural']
  });

  // Aggregate anonymized metrics
  for (const cohort of cohorts) {
    const metrics = await supabase
      .from('transactions')
      .select('category, SUM(amount) as total, practice_id')
      .in('practice_id', cohort.practiceIds)
      .groupBy('category', 'practice_id');

    const anonymized = {
      cohort_id: cohort.id,
      cohort_size: cohort.practiceIds.length, // Must be 5+ for anonymity
      avg_capitation_per_patient: calculateMedian(metrics.capitation),
      avg_total_income: calculateMedian(metrics.income),
      stc_uptake_rate: calculateMedian(metrics.stc_rate),
      // ... other metrics

      // NO practice identifiers
      // NO individual practice data
      // Only aggregates of 5+ practices
    };

    await supabase.from('benchmark_cohorts').upsert(anonymized);
  }
}
```

### Features Enabled by Network Data

#### 1. Practice Benchmarking
```
Your Dashboard:
┌─────────────────────────────────────────┐
│ Your Performance vs Similar Practices   │
├─────────────────────────────────────────┤
│ Capitation per patient:        €185     │
│ Cohort average:                €210     │
│ Your position:          ▓░░░░░ 35th %   │
│                                          │
│ 💡 Opportunity: You're €25 below avg    │
│    Review patient list accuracy          │
└─────────────────────────────────────────┘
```

#### 2. Market Intelligence
```
Practice News:
• PCRS payments delayed 3-5 days this month (85% of practices affected)
• STC uptake trending +8% nationally vs last quarter
• Disease Management claims up 12% in urban practices
```

#### 3. Learned Auto-Categorization
```javascript
// ML model improves from network
const categoryModel = trainFromAllPractices(
  transactions // From 100+ practices
);

// Your practice benefits
transaction: "HSE PCRS DEC 2024 CAPITATION"
→ Predicted: "GMS Capitation" (99.8% confidence)
   Based on 15,000 similar transactions across network
```

#### 4. Recommendations Engine
```
Personalized Insights:
✓ Practices similar to yours increased income by 8% by focusing on:
  1. Chronic Disease Management program enrollment
  2. Cervical Check campaign in Q1
  3. STC optimization (you're at 67%, top quartile is 92%)

🎯 Estimated opportunity: €12,000-18,000 annually
```

### Opt-In Model

**Default:** No data sharing
- Practices function normally
- No benchmarking shown
- 100% private

**Opt-In:** Enable benchmarking
```javascript
// Settings page
<Toggle>
  Enable Practice Benchmarking

  ℹ️ This shares anonymized aggregate data only:
     • Practice size and location (region only)
     • Income/expense categories (totals, not transactions)
     • PCRS metrics (aggregated)

  ❌ Never shared:
     • Practice name or identifying details
     • Individual transaction descriptions
     • Patient information
     • Exact income figures (only ranges)

  ✓ You get:
     • Compare to similar practices
     • National trend insights
     • Personalized recommendations
     • Improved auto-categorization
</Toggle>
```

### GDPR Compliance

**Requirements:**
- [ ] Data Processing Agreement with customers
- [ ] Privacy policy updated for aggregation
- [ ] Anonymization audit (k-anonymity ≥ 5)
- [ ] Right to withdraw consent
- [ ] Data retention policy (benchmarks only, not raw data)
- [ ] EU data residency (Supabase EU region)

**Anonymization Standards:**
- Minimum cohort size: 5 practices
- No unique identifiers in aggregates
- Geographic granularity: Province level only
- Income: Ranges/percentiles, not exact figures

### Phase 3 Success Criteria

- [ ] 30+ practices on cloud platform
- [ ] 40%+ opt-in rate for benchmarking
- [ ] GDPR compliance verified by legal review
- [ ] Benchmarking adds measurable value (user survey)
- [ ] Zero data breach incidents
- [ ] Anonymization verified (no practice re-identification possible)

### Timeline: Months 13-24

**Months 13-15: Build Infrastructure**
- Aggregation pipeline
- Benchmark calculation engine
- Cohort definition logic
- UI for benchmark display

**Months 16-18: Legal & Privacy**
- GDPR legal review
- Update privacy policy
- Customer communication campaign
- Opt-in mechanism

**Months 19-21: Beta Launch**
- Launch with 10 pilot practices
- Gather feedback
- Refine anonymization
- Test value proposition

**Months 22-24: Full Rollout**
- Open to all practices (opt-in)
- Monitor adoption rate
- Build advanced features
- Premium tier for full intelligence

---

## Phase 4: Enterprise & Scale (Months 25+)

**Goal:** Scale to 100+ practices, enterprise features

### Features

#### Practice Management
- Multi-user support (multiple managers per practice)
- Role-based access control
- Audit logs (who changed what)
- Bulk operations

#### Advanced Analytics
- Predictive income forecasting
- Anomaly detection (unusual transactions)
- Custom report builder
- API access for accountants

#### Integration
- Export to accounting software (Xero, QuickBooks)
- Import from practice management systems
- Bank feed integration (Open Banking)
- PCRS portal scraping automation

#### White-Label
- Allow practices to customize branding
- Custom domain (practice.yourpracticename.ie)
- White-label mobile apps (App Store/Play Store)

### Enterprise Tier Pricing

**Standard:** €79/month
- Up to 5 users
- Core features
- Email support

**Professional:** €149/month
- Up to 15 users
- Benchmarking included
- Advanced reporting
- Priority support

**Enterprise:** €299/month
- Unlimited users
- Custom integrations
- Dedicated account manager
- White-label options
- SLA guarantee

---

## Technology Evolution

### Phase 1: Simple
```
Electron + localStorage + Cloudflare Tunnel
```

### Phase 2: Cloud Migration
```
React + Supabase + Vercel Functions
```

### Phase 3: Intelligence Layer
```
React + Supabase + Vercel + ML Aggregation Pipeline
```

### Phase 4: Enterprise
```
React + Supabase + Vercel + ML + Integrations + White-Label
```

---

## Key Decision Points

### Decision 1: When to migrate to cloud?
**Trigger:** 5-10 practices OR support burden > 20hrs/week

**Factors:**
- Support time per practice
- Update frequency needed
- Customer demand for cloud features
- Capital available for infrastructure

### Decision 2: When to enable benchmarking?
**Trigger:** 30+ practices on cloud AND legal review complete

**Factors:**
- Sufficient data for anonymization
- Customer trust established
- Legal compliance verified
- Clear value proposition

### Decision 3: When to build integrations?
**Trigger:** 50+ practices AND customer demand

**Factors:**
- Most requested integration (likely Xero/QuickBooks)
- Development resources available
- ROI on integration effort

### Decision 4: When to go enterprise?
**Trigger:** Large practice (10+ GPs) requests multi-user

**Factors:**
- Practice size distribution
- Willingness to pay premium
- Competitive landscape

---

## Risk Management

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Electron desktop crashes | Medium | High | Auto-restart, error logging, fallback to web |
| Cloudflare Tunnel drops | Low | Medium | Auto-reconnect, health monitoring, ngrok fallback |
| Data loss (localStorage) | Low | Critical | Regular backups to desktop disk, cloud sync option |
| Security breach | Low | Critical | JWT rotation, HTTPS only, security audit |
| Supabase outage | Low | High | 99.9% SLA, status monitoring, fallback to read-only |

### Business Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| No market demand | Low | Critical | Validate with own practice first, early customer interviews |
| Competitors emerge | Medium | Medium | Focus on GP-specific features, Irish market knowledge |
| GDPR violations | Low | Critical | Legal review, privacy-first design, opt-in only |
| Support burden unsustainable | High | High | Automate early, clear docs, cloud migration path |
| Practices won't pay | Medium | High | Freemium model, prove value first, flexible pricing |

---

## Success Metrics

### Phase 1 (Months 1-3)
- [ ] 1 practice fully operational (own practice)
- [ ] 100% uptime over 1 month
- [ ] Partners use mobile 3+ times/week
- [ ] Chat used regularly
- [ ] Zero critical bugs

### Phase 2 (Months 4-12)
- [ ] 10+ paying practices
- [ ] Monthly Recurring Revenue > €1,000
- [ ] Average support time < 2hrs/practice/month
- [ ] Customer satisfaction > 8/10
- [ ] Churn rate < 5%

### Phase 3 (Months 13-24)
- [ ] 50+ practices
- [ ] MRR > €5,000
- [ ] 40%+ benchmarking opt-in
- [ ] Net Promoter Score > 50
- [ ] Break-even or profitable

### Phase 4 (Months 25+)
- [ ] 100+ practices
- [ ] MRR > €10,000
- [ ] Team of 2-3 people
- [ ] Enterprise customers (10+ GPs)
- [ ] Sustainable business

---

## Financial Projections

### Phase 1: Prototype (Months 1-3)
**Costs:**
- Development time (your time): €0 (sweat equity)
- Claude API: €50/month
- Cloudflare: €0
- **Total: €150**

**Revenue:** €0

### Phase 2: Early Customers (Months 4-12)
**Costs:**
- Support time: €500/month (10hrs @ €50/hr)
- Infrastructure: €25/month (if cloud)
- Claude API: €100/month
- **Total: €5,625**

**Revenue:**
- 10 practices @ €79/month avg: €7,110
- **Net: +€1,485**

### Phase 3: Growth (Months 13-24)
**Costs:**
- Support/development: €2,000/month
- Infrastructure: €100/month
- Claude API: €300/month
- **Total: €28,800**

**Revenue:**
- 50 practices @ €100/month avg: €60,000
- **Net: +€31,200**

### Phase 4: Scale (Months 25+)
**Costs:**
- Team (2 people): €8,000/month
- Infrastructure: €500/month
- Support: €1,000/month
- **Total: €114,000**

**Revenue:**
- 100 practices @ €120/month avg: €144,000
- **Net: +€30,000**

---

## Next Steps (Immediate Actions)

### Week 1: Planning
- [ ] Review and approve this roadmap
- [ ] Decide: Keep localStorage or plan SQLite migration
- [ ] Set up development timeline
- [ ] Identify technical blockers

### Week 2: Electron Setup
- [ ] Install Electron dependencies
- [ ] Package existing React app
- [ ] Test desktop build
- [ ] Verify localStorage access

### Week 3: API Server
- [ ] Add Express to Electron main process
- [ ] Create API endpoints
- [ ] Test with Postman
- [ ] Implement authentication

### Week 4: Cloudflare Tunnel
- [ ] Install cloudflared
- [ ] Configure tunnel
- [ ] Test external access
- [ ] Document setup process

---

## Appendix A: Technical Architecture Diagrams

### Phase 1: Direct Connect
```
┌─────────────────────────────────────────────┐
│         Practice Office (Windows PC)        │
│  ┌──────────────────────────────────────┐   │
│  │      Electron Application            │   │
│  │  ┌────────────┐  ┌─────────────┐     │   │
│  │  │   React    │  │  Express    │     │   │
│  │  │   UI       │  │  API Server │     │   │
│  │  │            │  │  :3001      │     │   │
│  │  └────────────┘  └─────────────┘     │   │
│  │         │               │             │   │
│  │         ↓               ↓             │   │
│  │    localStorage    Claude API         │   │
│  └──────────────────────────────────────┘   │
│              │                               │
│              ↓                               │
│    ┌─────────────────┐                      │
│    │ Cloudflare      │                      │
│    │ Tunnel          │                      │
│    └─────────────────┘                      │
└──────────────┼───────────────────────────────┘
               │
               │ HTTPS
               │
    ┏━━━━━━━━━┷━━━━━━━━━━┓
    ┃  Internet Cloud    ┃
    ┗━━━━━━━━━┯━━━━━━━━━━┛
               │
       ┌───────┴───────┐
       │               │
   ┌───▼────┐    ┌────▼───┐
   │Partner │    │Partner │
   │Mobile 1│    │Mobile 2│
   └────────┘    └────────┘
```

### Phase 2: Cloud Infrastructure
```
┌──────────────────────────────────────────────────────┐
│              Supabase (PostgreSQL)                   │
│  ┌────────────────────────────────────────────┐      │
│  │  Practices Table  │  Transactions Table    │      │
│  │  └─ Practice 1    │  └─ practice_id: 1     │      │
│  │  └─ Practice 2    │  └─ practice_id: 2     │      │
│  │  └─ Practice N    │  └─ practice_id: N     │      │
│  └────────────────────────────────────────────┘      │
│            ↑                    ↑                     │
│            │                    │                     │
│    ┌───────┴────────┐   ┌──────┴──────┐             │
│    │  RLS Policies  │   │  Auth Users │             │
│    └────────────────┘   └─────────────┘             │
└──────────────────────────────────────────────────────┘
           ↑                                  ↑
           │                                  │
     ┌─────┴─────┐                      ┌────┴────┐
     │ Practice 1│                      │Vercel   │
     │ Desktop + │                      │Edge Fn  │
     │ Mobile    │                      │(Chat)   │
     └───────────┘                      └─────────┘
```

---

## Appendix B: Code Examples

### Electron Main Process (API Server)

```javascript
// electron/main.js
const { app, BrowserWindow } = require('electron');
const express = require('express');
const jwt = require('jsonwebtoken');
const expressApp = express();

const JWT_SECRET = 'your-secret-key-here'; // Store securely

// Middleware
expressApp.use(express.json());

// Authentication middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// API Routes
expressApp.get('/api/dashboard', authenticate, (req, res) => {
  // Read from localStorage (via Electron store or direct access)
  const transactions = getFromLocalStorage('gp_finance_transactions');
  const summary = calculateDashboardSummary(transactions);
  res.json(summary);
});

expressApp.get('/api/reports', authenticate, (req, res) => {
  const reports = getFromLocalStorage('gp_finance_saved_reports');
  res.json(reports);
});

expressApp.post('/api/chat', authenticate, async (req, res) => {
  const { message } = req.body;
  const response = await callClaudeAPI(message);
  res.json(response);
});

// Start server
const server = expressApp.listen(3001, () => {
  console.log('API server running on port 3001');
});

// Cloudflare Tunnel
const { exec } = require('child_process');
exec('cloudflared tunnel --url http://localhost:3001', (err, stdout) => {
  if (err) console.error('Tunnel error:', err);
  console.log('Tunnel started:', stdout);
});

// Create Electron window
app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true
    }
  });

  win.loadFile('dist/index.html');
});
```

### Mobile API Client

```javascript
// mobile/src/api/client.js
const API_BASE = 'https://yourpractice.slainte.com/api';

class APIClient {
  constructor() {
    this.token = localStorage.getItem('partner_token');
  }

  async request(endpoint, options = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  }

  async getDashboard() {
    return this.request('/dashboard');
  }

  async getReports() {
    return this.request('/reports');
  }

  async sendChatMessage(message) {
    return this.request('/chat', {
      method: 'POST',
      body: JSON.stringify({ message })
    });
  }
}

export default new APIClient();
```

---

## Document History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-01-12 | Initial roadmap created | Development Team |

---

## Contact & Questions

For questions about this roadmap, contact the development team.

**Next Review Date:** End of Phase 1 (Month 3)

# Transaction Processing Pipeline: Journey Map & Improvement Analysis

## Overview

This document maps the complete data journey from bank statement upload to detailed CSV export, identifying improvement opportunities at each stage.

---

## THE DATA JOURNEY

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           STAGE 1: DATA INGESTION                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   CSV Upload ─────┐                                                         │
│   (Bank Export)   │                                                         │
│                   ├──► Papa.parse() ──► processTransactionData()            │
│   PDF Upload ─────┤                              │                          │
│   (Bank Statement)├──► pdfjs-dist ──► parseBOIStatement()                   │
│                   │                              │                          │
│   JSON Upload ────┘                              ▼                          │
│   (Training Data)          ┌──────────────────────────────────┐             │
│                            │  Transaction Object Created      │             │
│                            │  {id, date, details, debit,     │             │
│                            │   credit, amount, balance}      │             │
│                            └──────────────────────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        STAGE 2: DUPLICATE DETECTION                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   getTransactionKey() creates composite key:                                │
│   "{YYYY-MM-DD}|{amount}|{details_lowercase}"                               │
│                                                                             │
│   Compare against existing transactions ──► Show duplicate modal if found   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       STAGE 3: AUTO-CATEGORIZATION                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   categorizeTransaction(details, categoryMapping)                           │
│                     │                                                       │
│                     ▼                                                       │
│   Loop through ALL categories × ALL identifiers (O(n×m))                    │
│   Case-insensitive substring match                                          │
│                     │                                                       │
│           ┌────────┴────────┐                                               │
│           ▼                 ▼                                               │
│      MATCHED            NOT MATCHED                                         │
│         │                   │                                               │
│         │          ┌───────┴───────┐                                        │
│         │          ▼               ▼                                        │
│         │     Is Credit?      Is Debit?                                     │
│         │          │               │                                        │
│         │          ▼               ▼                                        │
│         │   Auto-Income      Unidentified                                   │
│         │   (code 1.0)       Transaction                                    │
│         │          │               │                                        │
│         └────┬─────┘               │                                        │
│              ▼                     ▼                                        │
│        transactions[]      unidentifiedTransactions[]                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        STAGE 4: MANUAL PROCESSING                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   REPEATING TRANSACTIONS (2+ occurrences)                                   │
│   ├── Group by extracted pattern                                            │
│   ├── AI Batch Analysis (Claude API, 80 patterns/batch)                     │
│   │   └── Returns: {categoryCode, confidence, reasoning}                    │
│   ├── User accepts/rejects AI suggestion                                    │
│   └── Pattern learned → added to category.identifiers                       │
│                                                                             │
│   ONE-OFF TRANSACTIONS                                                      │
│   ├── Manual category selection                                             │
│   ├── Learning modal offers pattern extraction                              │
│   └── Pattern learned → added to category.identifiers                       │
│                                                                             │
│   AI LEARNING SYSTEM                                                        │
│   ├── recordAICorrection() when user overrides AI                           │
│   ├── Stores in aiCorrections (100 per feature, frequency-ranked)           │
│   └── Included in future AI prompts as learning context                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          STAGE 5: STORAGE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   AUTO-SAVE (useEffect triggers on state change)                            │
│                                                                             │
│   localStorage (Browser)                                                    │
│   ├── gp_finance_transactions (wrapped: {data, timestamp, version})         │
│   ├── gp_finance_unidentified (wrapped)                                     │
│   ├── gp_finance_category_mapping (wrapped)                                 │
│   ├── gp_finance_payment_analysis (NOT wrapped)                             │
│   ├── slainte_ai_corrections (NOT wrapped)                                  │
│   └── ... other keys                                                        │
│                                                                             │
│   Electron userData (File System Mirror)                                    │
│   ├── localStorage.json (mirrors all keys)                                  │
│   ├── secure-credentials.json (JWT secret, passwords)                       │
│   └── backups/*.slainte-backup (AES-256-GCM encrypted)                      │
│                                                                             │
│   Sync: Every save triggers syncAllToElectron() via IPC                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           STAGE 6: EXPORT                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   DETAILED TRANSACTIONS CSV                                                 │
│   Columns: Date, Description, Debit, Credit, Type, Group, Category,         │
│            P&L Line, Comments                                               │
│                                                                             │
│   P&L REPORT                                                                │
│   ├── Groups transactions by category.accountantLine                        │
│   ├── Income vs Expense sections                                            │
│   └── Net profit calculation                                                │
│                                                                             │
│   ZIP PACK                                                                  │
│   ├── transactions-simple-{year}.csv                                        │
│   ├── transactions-detailed-{year}.csv                                      │
│   ├── pcrs-summary-{year}.csv                                               │
│   ├── payment-overview-{year}.csv                                           │
│   ├── pl-report-draft-{year}.csv                                            │
│   └── README.txt                                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## IMPROVEMENT OPPORTUNITIES BY STAGE

### STAGE 1: Data Ingestion

| Issue | Current State | Improvement Option | Type |
|-------|---------------|-------------------|------|
| **Date parsing fragility** | Multiple format handlers, fallback to native Date.parse | Create unified date parser with explicit format detection | Code |
| **PDF parsing limited** | Only Bank of Ireland supported | Add AIB, PTSB parsers or use AI-based extraction | Feature |
| **Amount ambiguity** | `Math.max(debit, credit, amount)` if all present | Prefer single source, validate others | Code |
| **No file validation** | Accepts any CSV structure | Validate expected columns before processing | Code |

### STAGE 2: Duplicate Detection

| Issue | Current State | Improvement Option | Type |
|-------|---------------|-------------------|------|
| **Duplicate code** | `getTransactionKey()` defined in 3+ files | Extract to shared utility | Code |
| **Exact match only** | Requires exact amount + date + details | Fuzzy matching for similar transactions | ML |
| **No merge option** | Skip or add all | Allow merging (keep both with flag) | Feature |

### STAGE 3: Auto-Categorization

| Issue | Current State | Improvement Option | Type |
|-------|---------------|-------------------|------|
| **O(n×m) performance** | Loop through all categories × identifiers | Build trie/prefix tree or Set-based lookup | Code |
| **First match wins** | Returns first matching category | Score by specificity, return best match | Code |
| **No confidence score** | Binary match/no-match | Add confidence based on identifier length/specificity | ML |
| **Identifier conflicts** | Same identifier in multiple categories | Detect and warn about conflicts | Code |
| **No learning from context** | Only pattern matching | Use transaction amount, time of month, etc. | ML |

### STAGE 4: Manual Processing

| Issue | Current State | Improvement Option | Type |
|-------|---------------|-------------------|------|
| **AI suggestions not cached** | Re-analyze patterns each session | Cache suggestions with TTL | Code |
| **100 correction limit** | Oldest corrections discarded | Implement decay scoring instead of hard limit | ML |
| **Batch size fixed** | 80 patterns per Claude call | Dynamic batching based on pattern complexity | Code |
| **No active learning** | User must initiate AI analysis | Proactive suggestions when patterns detected | ML |
| **Pattern similarity not checked** | Can add near-duplicate identifiers | Edit distance check before adding | Code |

### STAGE 5: Storage

| Issue | Current State | Improvement Option | Type |
|-------|---------------|-------------------|------|
| **Inconsistent wrapping** | Some keys wrapped, some not | Standardize on single format | Code |
| **Full sync on every change** | Writes all 7+ keys per transaction | Differential sync or batched writes | Code |
| **No structured database** | Everything is JSON blobs in localStorage | IndexedDB or SQLite for transactions | Architecture |
| **Category embedded in transaction** | Full category object stored with each transaction | Store category code only, lookup on display | Architecture |
| **5-10MB localStorage limit** | Risk of QuotaExceededError with 10k+ transactions | Move to IndexedDB or file storage | Architecture |
| **Legacy keys unused** | `gp_finance_learned_patterns` exists but unused | Remove or migrate | Cleanup |

### STAGE 6: Export

| Issue | Current State | Improvement Option | Type |
|-------|---------------|-------------------|------|
| **No export of learning data** | AI corrections, identifiers not exported | Add "full backup" vs "accountant export" | Feature |
| **In-memory CSV generation** | Large datasets may cause memory issues | Stream to file | Code |
| **No export validation** | Generated CSV not validated | Verify row counts, totals match | Code |

---

## ARCHITECTURAL IMPROVEMENT OPTIONS

### Option A: Structured Database (IndexedDB)

**Current:** All data stored as JSON blobs in localStorage
**Proposed:** Use IndexedDB for transactions, keep localStorage for settings

**Benefits:**
- No 5-10MB limit (IndexedDB is effectively unlimited)
- Query capabilities (filter by date, category, amount)
- Better performance for large datasets
- Cursor-based pagination

**Trade-offs:**
- More complex code
- Need migration strategy for existing users
- Async API requires code changes

### Option B: Category Reference Model

**Current:** Full category object embedded in each transaction
```javascript
transaction.category = { code: "3.1", name: "Cleaning", type: "expense", ... }
```

**Proposed:** Store only category code, resolve on display
```javascript
transaction.categoryCode = "3.1"
// Resolve: categoryMapping.find(c => c.code === transaction.categoryCode)
```

**Benefits:**
- Smaller storage footprint (10x reduction for category data)
- Category updates automatically reflected
- Consistent with relational model

**Trade-offs:**
- Need migration for existing transactions
- Historical category names lost (could add `categoryNameAtImport` for audit)
- Lookup on every render (cache in context)

### Option C: Identifier Index (Performance)

**Current:** O(n×m) identifier matching per transaction
```javascript
for (category of categories) {
  for (identifier of category.identifiers) {
    if (details.includes(identifier)) return category
  }
}
```

**Proposed:** Build prefix tree or Set-based index on category load
```javascript
identifierIndex = new Map() // identifier -> category
// O(1) lookup per identifier check
```

**Benefits:**
- O(k) where k = number of unique words in transaction
- Much faster for large category mappings

**Trade-offs:**
- Index rebuild on category change
- Memory overhead for index

### Option D: AI-First Categorization

**Current:** Pattern matching first, AI as fallback for uncategorized
**Proposed:** AI categorization with pattern matching as validation

**Benefits:**
- Better handling of novel transactions
- Learns user preferences faster
- Context-aware (amount, date, sequence)

**Trade-offs:**
- API cost per transaction
- Latency for real-time categorization
- Need offline fallback

### Option E: Layered Processing Pipeline

**Current:** All categorization in one step
**Proposed:** Sequential layers as discussed in previous planning

```
Raw Transaction
    ↓ Layer 1: Type Detection (income/expense/transfer)
    ↓ Layer 2: Group Detection (staff/premises/medical/etc)
    ↓ Layer 3: Category Detection (specific category)
    ↓ Layer 4: P&L Line Mapping (automatic from category)
    ↓ Layer 5: User Comments (manual annotation)
```

**Benefits:**
- Clearer mental model for users
- Partial categorization is useful (know it's "expense" even if not specific category)
- Each layer can have its own ML model

**Trade-offs:**
- More complex UI flow
- Users may want to skip layers
- Existing data needs migration

---

## LEGACY CODE TO REMOVE

| Item | Location | Status | Action |
|------|----------|--------|--------|
| `gp_finance_learned_patterns` key | storageUtils.js lines 91-99 | Unused | Remove functions, migrate data |
| Duplicate `getTransactionKey()` | TransactionUpload, CategoryManager, DataSection | Redundant | Extract to transactionProcessor.js |
| `__AUTO_INCOME__` placeholder | transactionProcessor.js line 188 | Fragile pattern | Use proper flag object |
| Old wrapped format handlers | Multiple files | Inconsistent | Standardize on unwrapped |
| `anthropic_api_key` localStorage | AppContext line 463 | Deprecated | Remove after migration |

---

## RECOMMENDED PRIORITIES

### Quick Wins (Low effort, immediate value)
1. Extract duplicate utility functions to shared location
2. Add identifier conflict detection/warning
3. Cache AI suggestions in localStorage with TTL
4. Remove legacy unused storage keys

### Medium Term (Architecture improvements)
5. Standardize storage format (unwrapped everywhere)
6. Implement identifier index for O(1) lookup
7. Add pattern similarity check before learning
8. Batch storage writes (debounce sync)

### Long Term (Major refactoring)
9. Migrate to IndexedDB for transactions
10. Implement category reference model
11. Build layered processing pipeline
12. Add AI-first categorization option

---

## USER DIRECTION: SIMPLIFICATION

**Goal:** Simplify the entire journey, not just optimize pieces
**Migration:** Backup/restore acceptable (only 3 users currently)

---

## SIMPLIFICATION STRATEGY

### Core Principle: Layered Processing

The user's earlier vision of sequential layers provides a natural simplification framework:

```
CURRENT (Complex)                      PROPOSED (Simple)
─────────────────                      ──────────────────
Multiple entry points                  → Single normalized entry
Identifier matching (O(n×m))           → Layer 1: Type (income/expense)
First-match-wins                       → Layer 2: Group (section)
Full category embedded                 → Layer 3: Category (specific)
Inconsistent storage                   → Layer 4: P&L Line (auto-mapped)
Multiple AI touchpoints                → Layer 5: Comments (user input)
```

### What Gets Simpler:

1. **Categorization Logic**
   - Instead of searching 100+ categories with 1000s of identifiers
   - First classify: income or expense? (trivial - check debit/credit)
   - Then narrow: which section? (8 options instead of 100)
   - Finally: which specific category? (10-15 per section)

2. **Storage Model**
   - Remove wrapped/unwrapped inconsistency
   - Store `{typeCode, groupCode, categoryCode}` instead of full object
   - Single source of truth for category definitions

3. **UI Flow**
   - Clear progression matches user mental model
   - Partial categorization is valid (know type even if not specific)
   - Each step has smaller decision space

4. **AI Integration**
   - AI helps at each layer independently
   - Smaller, focused prompts
   - Clearer learning targets

### What Gets Removed:

- Legacy `gp_finance_learned_patterns` key and functions
- Duplicate `getTransactionKey()` implementations
- `__AUTO_INCOME__` placeholder pattern
- Inconsistent storage format wrappers
- Category code as primary key (use separate Type/Group/Category codes)

---

## SIMPLIFIED DATA MODEL

### Current Transaction Object:
```javascript
{
  id, date, details, debit, credit, amount, balance,
  category: {  // FULL EMBEDDED OBJECT
    code: "3.1.1",
    name: "Cleaning & Laundry",
    type: "expense",
    section: "PREMISES COSTS",
    identifiers: [...],
    accountantLine: "Cleaning"
  }
}
```

### Proposed Transaction Object:
```javascript
{
  id, date, details, debit, credit, amount, balance,
  type: "expense",           // Layer 1: income | expense | transfer
  group: "PREMISES",         // Layer 2: Section code
  categoryCode: "3.1.1",     // Layer 3: Specific category (lookup)
  comment: ""                // Layer 5: User annotation
  // Layer 4 (P&L Line) auto-derived from categoryCode
}
```

### Category Definition (Simpler):
```javascript
{
  code: "3.1.1",
  name: "Cleaning & Laundry",
  group: "PREMISES",           // Links to group
  accountantLine: "Cleaning",  // For P&L
  identifiers: [...]           // Still used for auto-match within group
}
```

### Group Definition (New):
```javascript
{
  code: "PREMISES",
  name: "Premises Costs",
  type: "expense",             // All categories in group share type
  displayOrder: 3
}
```

---

---

## ANALYSIS: TYPE LAYER (Layer 1)

**Question:** Should we have a Type layer (income/expense) as the first step, or skip to Group?

### Option 1: Include Type Layer

```
Transaction → Type (income/expense) → Group → Category
```

**Pros:**
| Benefit | Explanation |
|---------|-------------|
| **Trivial automation** | Credit = income, Debit = expense (99% accurate from bank data) |
| **Early error detection** | Catch mis-categorized items (expense in income category) before they compound |
| **Simpler Group logic** | Each Group belongs to one Type, so fewer Groups to choose from |
| **Cleaner P&L structure** | Income and Expense sections are fundamental to accounting |
| **Smaller decision space** | 2 choices → 4-5 groups → 10-15 categories |

**Cons:**
| Drawback | Explanation |
|----------|-------------|
| **Extra step in UI** | One more screen/interaction before reaching category |
| **Mostly redundant** | Bank already tells us debit/credit, we're just confirming |
| **Edge cases exist** | Refunds, reversals, transfers don't fit clean income/expense split |
| **Minimal learning** | Type is deterministic, no ML benefit |

**Verdict:** Low cost, catches validation errors early, but could be **implicit** (auto-detected, shown but not requiring user action).

---

### Option 2: Skip Type, Start with Group

```
Transaction → Group (8 options) → Category
```

**Pros:**
| Benefit | Explanation |
|---------|-------------|
| **Faster flow** | One less step for users |
| **Groups imply Type** | INCOME group = income type, all others = expense |
| **Current system is similar** | Section (Group) already implies Type |

**Cons:**
| Drawback | Explanation |
|----------|-------------|
| **Larger initial choice** | 8+ Groups vs 2 Types |
| **Validation later** | Type mismatch only caught at Category level |
| **Mixed mental model** | User picks "STAFF" but system needs to know it's expense |

**Verdict:** Works, but loses early validation benefit.

---

### Recommended Hybrid: Implicit Type

```
Transaction → [Type auto-detected] → Group (filtered by Type) → Category
```

- Type determined automatically from debit/credit
- Shown in UI but not requiring user action
- User only sees Groups matching the detected Type
- Validation alert if user tries to override (e.g., putting credit in expense)

---

## ANALYSIS: AUTO-CATEGORIZATION APPROACHES

### Current Approach: Identifier Matching

```javascript
for (category of categories) {
  for (identifier of category.identifiers) {
    if (details.toUpperCase().includes(identifier.toUpperCase())) {
      return category;
    }
  }
}
```

| Aspect | Assessment |
|--------|------------|
| **Accuracy** | High for known patterns, zero for new patterns |
| **Speed** | O(n×m) - slow with 100+ categories × 1000s identifiers |
| **Cost** | Free (no API calls) |
| **Learning** | Manual - user adds identifiers |
| **Maintenance** | Growing identifier list becomes unwieldy |
| **Conflicts** | Same identifier in multiple categories causes first-match issues |

---

### Alternative 1: AI-First Categorization

```javascript
const suggestion = await callClaude({
  prompt: `Categorize this transaction: "${details}" (${amount})`,
  categories: categoryMapping
});
return suggestion.categoryCode;
```

| Aspect | Assessment |
|--------|------------|
| **Accuracy** | Good for novel patterns, may miss user-specific preferences |
| **Speed** | Slow (API latency per transaction) |
| **Cost** | ~$0.001-0.005 per transaction with Haiku |
| **Learning** | Records corrections, includes in future prompts |
| **Maintenance** | Minimal - AI generalizes |
| **Conflicts** | AI resolves based on context |

**Cost Estimate:**
- 500 transactions/month × $0.003 = $1.50/month
- 2000 transactions/month × $0.003 = $6.00/month

---

### Alternative 2: Hybrid Smart (Recommended)

```javascript
// Step 1: Try fast identifier match
const identifierMatch = matchIdentifiers(details);
if (identifierMatch && identifierMatch.confidence > 0.9) {
  return identifierMatch.category;
}

// Step 2: AI for uncertain cases
const aiSuggestion = await callClaude({ details, amount, type });
return aiSuggestion.categoryCode;
```

| Aspect | Assessment |
|--------|------------|
| **Accuracy** | Best of both - fast paths for known, AI for unknown |
| **Speed** | Fast for 70-80% (matched), slow for rest |
| **Cost** | Only pay for AI on uncertain transactions |
| **Learning** | AI suggestions become identifiers when confirmed |
| **Maintenance** | Self-improving over time |
| **Conflicts** | Identifier index detects conflicts upfront |

**Key Enhancement: Confidence Scoring**

Instead of binary match/no-match:
```javascript
{
  category: {...},
  confidence: 0.95,        // Based on identifier specificity
  matchedIdentifier: "SHELL",
  alternativeMatches: []   // Other categories that also matched
}
```

High confidence → auto-accept
Medium confidence → show for review
Low/no confidence → AI suggestion

---

### Alternative 3: Layered Hybrid

Apply different strategies at each layer:

| Layer | Strategy | Rationale |
|-------|----------|-----------|
| **Type** | Deterministic | Credit/debit is unambiguous |
| **Group** | Identifier + AI fallback | 8 options, simple patterns |
| **Category** | AI-first with identifier validation | Complex, benefits from context |

This reduces AI calls because:
- Type is automatic (no AI)
- Group has fewer options (cheaper AI call if needed)
- Category AI only runs within the Group (smaller context)

---

## COMPARISON TABLE

| Approach | Accuracy | Speed | Cost | Complexity | Learning |
|----------|----------|-------|------|------------|----------|
| **Identifiers Only** | ★★★☆☆ | ★★★★★ | Free | Medium | Manual |
| **AI Only** | ★★★★☆ | ★★☆☆☆ | $2-6/mo | Low | Automatic |
| **Hybrid Smart** | ★★★★★ | ★★★★☆ | $0.50-2/mo | Medium | Best of both |
| **Layered Hybrid** | ★★★★★ | ★★★★☆ | $0.30-1/mo | High | Targeted |

---

---

## USER-PROPOSED FLOW: FINN-GUIDED PROCESSING

### Overview

User has proposed a conversational flow where Finn guides the user through layered processing, with confidence-based cohorts and deferred review options.

### The Flow

```
UPLOAD
    ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STAGE 1: TYPE SORTING                                               │
│                                                                     │
│ Finn: "I'm sorting 800 transactions by Type..."                     │
│                                                                     │
│ Auto-sort: Credit → Income, Debit → Expense                         │
│                                                                     │
│ ANOMALY DETECTION:                                                  │
│ Finn: "I noticed a few unusual ones - expenses that look like       │
│        credits. Usually refunds. Can you clarify?"                  │
│        → Show anomalies for user review                             │
│        → User feedback trains Type detection                        │
└─────────────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STAGE 2: GROUP SORTING                                              │
│                                                                     │
│ Finn: "Now sorting them into Groups..."                             │
│                                                                     │
│ For each transaction, calculate match score against ALL groups:     │
│   - Income identifiers → score                                      │
│   - Staff identifiers → score                                       │
│   - Premises identifiers → score                                    │
│   - ... (all groups)                                                │
│                                                                     │
│ DECISION LOGIC:                                                     │
│ ┌─────────────────────────────────────────────────────────────┐     │
│ │ >1 groups at 100%  → FLAG: Duplicate identifier conflict    │     │
│ │ Best match ≥90%    → Auto-sort to that group                │     │
│ │ Best match 50-90%  → AI recommends, auto-sort [Cohort 1]    │     │
│ │ Best match <50%    → AI recommends [Cohort 2] - USER REVIEW │     │
│ └─────────────────────────────────────────────────────────────┘     │
│                                                                     │
│ Finn: "Most are sorted. A few need your help." → Show Cohort 2      │
│ Finn: "These I sorted but was less confident." → Show Cohort 1      │
│        (Optional review, can skip - noted as Task for later)        │
│                                                                     │
│ User feedback trains Group detection                                │
└─────────────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STAGE 3: CATEGORY SORTING (Can be deferred)                         │
│                                                                     │
│ Finn: "Want to continue to Categories, or pause here?"              │
│       → Estimate: "About 50 transactions to review, ~10 mins"       │
│       → If skip: Create Task reminder for later                     │
│                                                                     │
│ RUNS IN BACKGROUND regardless of user choice:                       │
│ Same logic as Groups but within each Group's categories:            │
│ ┌─────────────────────────────────────────────────────────────┐     │
│ │ >1 categories at 100%  → FLAG: Duplicate identifier         │     │
│ │ Best match ≥90%        → Auto-sort                          │     │
│ │ Best match 50-90%      → AI recommends, auto-sort [Cohort 3]│     │
│ │ Best match <50%        → AI recommends [Cohort 4] - REVIEW  │     │
│ └─────────────────────────────────────────────────────────────┘     │
│                                                                     │
│ When user returns:                                                  │
│ Finn: "Let's look at Income first. Most categorized, but a few      │
│        I'm uncertain about..." → Show Cohort 4 for Income           │
│ Finn: "These I assigned but you may want to check..." → Cohort 3    │
│                                                                     │
│ User feedback trains Category detection                             │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions in This Flow

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| **Duplicate detection** | Runs silently on upload | Not user-facing, automatic |
| **Type sorting** | Mostly automatic, anomalies surfaced | Trivial for 99%, only exceptions need attention |
| **Group sorting** | Confidence-based cohorts | Users only review uncertain items |
| **Category sorting** | Deferrable | Most app features work with Groups; categories can wait |
| **User feedback** | Trains each layer independently | Targeted learning improves specific tasks |
| **Skip handling** | Noted as Task for later | Nothing falls through cracks |

---

## ANALYSIS: HOW THIS FITS WITH EARLIER PLANNING

### Alignment ✅

| Earlier Plan Element | User Flow | Fit |
|---------------------|-----------|-----|
| Layered processing (Type→Group→Category) | ✅ Exact match | Perfect |
| Implicit Type detection | ✅ Auto-sort with anomaly review | Better - adds anomaly handling |
| Confidence scoring | ✅ Explicit thresholds (50%, 90%, 100%) | Concrete implementation |
| AI for uncertain cases | ✅ Cohorts 1-4 use AI for 50-90% and <50% | Matches Hybrid Smart approach |
| User feedback loop | ✅ Each stage trains that layer | Targeted learning |
| Deferred processing | ✅ Category can wait, Task reminder | New addition - very practical |

### Enhancements Over Earlier Plan

1. **Finn as UX guide** - Makes technical process feel conversational
2. **Cohort system** - Clear triage: must-review vs can-review
3. **Time estimates** - "About 50 transactions, ~10 mins" helps user decide
4. **Background processing** - Categories computed even if user defers
5. **Task integration** - Skipped reviews become reminders

### Gaps Still to Address

The user correctly identified these aren't covered:

1. **How to calculate confidence scores**
2. **Whether to keep pattern recognition for identifiers**
3. **How to fine-tune AI prompts**
4. **Database benefits**

---

## ADDRESSING THE GAPS

### 1. CONFIDENCE SCORING

**Current state:** Binary match (identifier found or not)

**Proposed scoring model:**

```javascript
calculateMatchScore(transaction, group) {
  const details = transaction.details.toUpperCase();
  let bestScore = 0;
  let matchedIdentifier = null;

  for (const identifier of group.identifiers) {
    const score = calculateIdentifierScore(details, identifier);
    if (score > bestScore) {
      bestScore = score;
      matchedIdentifier = identifier;
    }
  }

  return { score: bestScore, identifier: matchedIdentifier };
}
```

**Scoring factors:**

| Factor | Weight | Rationale |
|--------|--------|-----------|
| **Identifier length** | 30% | Longer = more specific ("SHELL GARAGE CORK" > "SHELL") |
| **Match coverage** | 30% | What % of transaction text is the identifier? |
| **Historical accuracy** | 25% | How often was this identifier correct? (from user feedback) |
| **Uniqueness** | 15% | Does this identifier appear in only one category? |

**Example calculation:**

```
Transaction: "SHELL GARAGE DUBLIN FUEL"
Identifier: "SHELL GARAGE"

Length score:     12 chars / 20 max = 0.60 × 0.30 = 0.18
Coverage score:   12 chars / 24 total = 0.50 × 0.30 = 0.15
Historical:       95% accuracy × 0.25 = 0.24
Uniqueness:       Only in "Fuel" category × 0.15 = 0.15

TOTAL: 0.72 (72%) → Falls in 50-90% cohort → AI assists
```

**Thresholds (user-proposed, seem reasonable):**

| Score | Action |
|-------|--------|
| ≥90% | Auto-accept |
| 50-90% | AI recommends, auto-accept, flag for optional review |
| <50% | AI recommends, require user review |
| Multiple 100% | Flag as identifier conflict |

---

### 2. PATTERN RECOGNITION FOR IDENTIFIERS

**Current approach:** Extract longest common substring, filter generic words

**Should we keep it?** Yes, but enhanced.

**Current problems:**
- Extracts patterns that are too generic ("PAYMENT", "FEE")
- Doesn't weight by usefulness
- No feedback loop

**Proposed enhancement:**

```javascript
extractIdentifierCandidate(transaction, confirmedCategory) {
  const details = transaction.details;

  // 1. Extract candidate patterns (current logic)
  const candidates = extractPatterns(details);

  // 2. Score each candidate
  const scored = candidates.map(pattern => ({
    pattern,
    specificity: calculateSpecificity(pattern),      // How unique is this?
    coverage: pattern.length / details.length,       // How much does it cover?
    conflicts: findConflicts(pattern, categoryMapping) // Any other categories use this?
  }));

  // 3. Filter and rank
  return scored
    .filter(c => c.specificity > 0.5 && c.conflicts.length === 0)
    .sort((a, b) => b.specificity - a.specificity)[0];
}
```

**Generic word blacklist (expand current):**
```
PAYMENT, FEE, CHARGE, TRANSFER, POS, ATM, DEBIT, CREDIT,
JAN, FEB, MAR, APR, MAY, JUN, JUL, AUG, SEP, OCT, NOV, DEC,
LTD, LIMITED, THE, AND, FOR, FROM, TO, OF,
IRELAND, DUBLIN, CORK, GALWAY, ... (cities)
```

**Recommendation:** Keep pattern recognition but add:
- Specificity scoring before accepting
- Conflict detection before adding
- User confirmation for borderline patterns

---

### 3. AI PROMPT FINE-TUNING

**Current prompts:** Generic categorization requests

**Proposed layered prompts:**

**For Group classification (Stage 2):**
```
You are helping categorize Irish GP practice expenses.

Transaction: "${details}" (€${amount}, ${type})

Which GROUP does this belong to?
- INCOME: Patient fees, GMS/PCRS payments, grants
- STAFF: Salaries, locums, pensions, training
- MEDICAL: Drugs, supplies, equipment
- PREMISES: Rent, utilities, cleaning, repairs
- OFFICE: IT, stationery, phones, subscriptions
- PROFESSIONAL: Accountant, legal, insurance
- MOTOR: Fuel, maintenance, leasing
- NON-BUSINESS: Personal drawings, loans

Previous corrections for similar patterns:
${aiCorrectionsForGroups}

Respond with JSON: {"group": "GROUP_CODE", "confidence": 0.0-1.0, "reasoning": "..."}
```

**For Category classification (Stage 3):**
```
You are helping categorize Irish GP practice expenses.

Transaction: "${details}" (€${amount})
Already classified as GROUP: ${group}

Which specific CATEGORY within ${group}?
${categoriesInGroup.map(c => `- ${c.code}: ${c.name}`).join('\n')}

Previous corrections:
${aiCorrectionsForCategories}

Respond with JSON: {"categoryCode": "X.X", "confidence": 0.0-1.0, "reasoning": "..."}
```

**Key prompt improvements:**
1. **Layered context** - Category prompt knows the Group already
2. **Smaller decision space** - Category only chooses within Group (10-15 options, not 100+)
3. **Corrections included** - AI learns from user overrides
4. **Structured output** - JSON for reliable parsing
5. **Irish GP context** - Domain-specific guidance

---

### 4. DATABASE BENEFITS

**Current:** JSON blobs in localStorage

**What a database (IndexedDB) would enable:**

| Capability | Benefit for This Flow |
|------------|----------------------|
| **Indexed queries** | Find all transactions in Cohort 2 instantly |
| **Filtering** | "Show me all Staff transactions with <50% confidence" |
| **Aggregation** | "How many transactions per Group?" without full scan |
| **Pagination** | Load 50 transactions at a time, not all 800 |
| **Partial updates** | Update one transaction without rewriting all |
| **Storage limit** | No 5-10MB cap, can handle years of data |

**Specific to this flow:**

```javascript
// With IndexedDB, cohort queries are trivial:
const cohort2 = await db.transactions
  .where('groupConfidence').below(0.5)
  .and(t => t.groupReviewed === false)
  .toArray();

// Current approach requires full array scan:
const cohort2 = transactions.filter(t =>
  t.groupConfidence < 0.5 && !t.groupReviewed
);
```

**Recommendation:** IndexedDB would significantly improve this flow, especially for:
- Cohort management (tracking review status)
- Background processing (update confidence scores without blocking UI)
- Historical accuracy tracking (query past corrections efficiently)

---

## UPDATED TRANSACTION SCHEMA

To support this flow, transactions need additional fields:

```javascript
{
  // Core data (unchanged)
  id, date, details, debit, credit, amount,

  // Layer 1: Type
  type: "expense",                    // income | expense | non-business
  typeConfidence: 0.99,               // How confident (usually 1.0)
  typeReviewed: false,                // Has user confirmed?
  typeAnomaly: false,                 // Flagged as unusual?

  // Layer 2: Group
  group: "STAFF",                     // Group code
  groupConfidence: 0.72,              // Match score
  groupMatchedIdentifier: "SALARY",   // What matched
  groupAISuggested: true,             // Was AI involved?
  groupReviewed: false,               // Has user confirmed?

  // Layer 3: Category
  categoryCode: "2.1",                // Specific category
  categoryConfidence: 0.85,           // Match score
  categoryMatchedIdentifier: "SANDRA",
  categoryAISuggested: false,
  categoryReviewed: true,             // User confirmed

  // Layer 5: User annotation
  comment: ""
}
```

---

## SUMMARY: MY OPINION

### On the Flow

**This is a strong design.** The Finn-guided approach transforms a technical process into a conversation. The cohort system is smart - users only review what matters. The deferral option for Categories is pragmatic (most features work with Groups). The Task integration prevents things falling through cracks.

**One suggestion:** Consider adding a "quick mode" for experienced users who want to blast through reviews without Finn's commentary. Toggle in settings.

### On Confidence Scoring

The 50%/90% thresholds are reasonable starting points. I'd suggest:
- Make thresholds configurable (some users want more control, some less)
- Track actual accuracy per threshold to tune over time
- The 4-factor scoring model (length, coverage, history, uniqueness) is sound

### On Pattern Recognition

Keep it, but add guards:
- Specificity scoring before accepting
- Conflict detection before adding
- Consider a "pattern quality" score that improves with user feedback

### On AI Prompts

The layered approach (smaller context per layer) will improve accuracy and reduce cost. Including corrections is crucial. Structured JSON output prevents parsing failures.

### On Database

IndexedDB would be a significant enabler for this flow. Not strictly required, but cohort management and confidence tracking become much cleaner. Worth the migration effort given only 3 users.

---

## NEXT STEPS (When Ready to Build)

1. **Define Group identifiers** - Currently categories have identifiers; need Group-level identifiers
2. **Implement confidence scoring** - Start with simple length + coverage, add history later
3. **Create Finn dialogue scripts** - The actual messages for each stage
4. **Build cohort tracking** - New fields on transactions, possibly IndexedDB
5. **Update AI prompts** - Layered prompts with corrections
6. **Task widget integration** - Deferred reviews become reminders

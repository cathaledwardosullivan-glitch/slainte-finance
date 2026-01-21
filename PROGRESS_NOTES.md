# Sláinte Finance V2 - Development Progress Notes

## Session: December 3, 2025

### Completed Work

#### 1. Cara's Practice Profile Conversation (ConversationalSetup.jsx)
- **Fixed GP Partners collection issue**: Cara now reliably collects GP Partners during onboarding
- Updated system prompt to clearly mark required vs optional fields
- Added conversation approach guidance for natural flow
- Enhanced progress summary to show what's collected and what's still needed
- Cara won't say "COMPLETE:" until practice name, location, AND at least one GP Partner are collected

#### 2. Expense Categorization Page (GuidedAIExpenseCategorization.jsx)
- **Widened the background card**: Added `AI_CATEGORIZATION` to wider maxWidth conditions (1600px)
- **Removed stat boxes**: Removed "To Categorize" and "Categories" boxes that were unnecessary
- **Improved category picker UX** (SimpleCategoryPicker.jsx):
  - Made boxes smaller/more compact
  - Added click-to-confirm interaction: first click highlights green, second click confirms
  - Shows "Click to Confirm" text with checkmark on pending selection
  - Auto-applies category on confirmation (no need to scroll and click "Add to Selected")
- **Improved AI categorization prompts**:
  - Updated MEDICAL category description to include "staff uniforms, workwear, PPE, scrubs"
  - Added "CATEGORY GUIDANCE FOR GP PRACTICES" section to AI prompt
  - Added specific note: "Uniform/workwear suppliers go to MEDICAL not OFFICE_IT"
  - Updated both `GuidedAIExpenseCategorization.jsx` and `AIExpenseCategorization.jsx`

#### 3. GMS Panel Upload Page (GMSPanelUploadPrompt.jsx)
- **Complete redesign** to match other onboarding pages:
  - Left side: Cara chat box with animated typing
  - Right side: Upload functionality card
- **Cara is now partner-aware**:
  - Reads partner count from practice profile
  - Says something like: "I noticed you have 3 partners... you may have 3 panels to upload"
- **Improved upload UX**:
  - Clean upload drop zone
  - Shows list of uploaded files with panel number and month/year
  - "Upload More Files" button after initial upload
  - Can remove files with X button
- **Dynamic navigation button**:
  - "Skip for Now" when no files uploaded
  - "Continue to Dashboard" when files have been uploaded
- Added `GMS_PANEL` step to wider card conditions in `UnifiedOnboarding.jsx`

### Files Modified
1. `src/components/Onboarding/ConversationalSetup.jsx` - Cara's conversation prompts
2. `src/components/Onboarding/GuidedAIExpenseCategorization.jsx` - Expense categorization UI
3. `src/components/SimpleCategoryPicker.jsx` - Category selection with click-to-confirm
4. `src/components/AIExpenseCategorization.jsx` - AI prompt improvements
5. `src/utils/parentCategoryMapping.js` - MEDICAL category description update
6. `src/components/Onboarding/GMSPanelUploadPrompt.jsx` - Complete redesign with Cara
7. `src/components/UnifiedOnboarding.jsx` - Added steps to wider card conditions

### Dev Server
- Running on `http://localhost:5173` (Vite)
- API Server on `http://localhost:3001`
- Command: `npm run electron-dev`

#### 4. Labelled Transaction Import System (NEW FEATURE)
- **Complete new onboarding path** for users with pre-categorized transaction data
- **Upload Type Selection** (`TransactionUploadTypeSelection.jsx`):
  - Three options: Pre-Labelled Transactions (recommended), Raw Bank Transactions, Sláinte Backup
  - Cara explains benefits of labelled data import
  - "Recommended" badge highlights the labelled option
- **Labelled Transaction Import** (`LabelledTransactionImport.jsx`):
  - CSV upload with drag-and-drop
  - Automatic column detection (date, description, amount, category)
  - Column mapping UI with sample value preview
  - Key field: "Your Category Labels Column" with highlighting
  - Preview step showing mapped data before processing
- **Category Mapping Review** (`CategoryMappingReview.jsx`):
  - Extracts unique user categories from uploaded data
  - **Exact matching**: Uses synonym dictionary (e.g., "wages" → STAFF, "rent" → PREMISES)
  - **AI-powered matching**: For ambiguous categories, uses Claude Haiku to suggest mappings
  - Confidence indicators: High (green), Medium (yellow), Review (red)
  - Inline editing: Users can change any mapping with dropdown
  - Summary view shows mappings grouped by Sláinte category
- **Identifier Extraction** (`LabelledIdentifierExtraction.jsx`):
  - Analyzes transaction descriptions within each category
  - Extracts recurring patterns using longest common substring algorithm
  - Adds patterns as identifiers to category mapping
  - Shows extracted identifiers grouped by parent category
  - Imports transactions with pre-applied categories
- **Integration** (`UnifiedOnboarding.jsx`):
  - Added 5 new steps: UPLOAD_TYPE_SELECTION, LABELLED_IMPORT, CATEGORY_MAPPING, LABELLED_EXTRACTION
  - Updated step numbering and maxWidth conditions
  - Labelled path skips AI Staff/Expense categorization (already categorized)
  - Raw path continues through existing flow

### New Files Created
1. `src/components/Onboarding/TransactionUploadTypeSelection.jsx` - Upload type chooser
2. `src/components/Onboarding/LabelledTransactionImport.jsx` - CSV upload and column mapping
3. `src/components/Onboarding/CategoryMappingReview.jsx` - AI-powered category mapping with review
4. `src/components/Onboarding/LabelledIdentifierExtraction.jsx` - Pattern extraction and import

### Files Modified
1. `src/components/Onboarding/ConversationalSetup.jsx` - Cara's conversation prompts
2. `src/components/Onboarding/GuidedAIExpenseCategorization.jsx` - Expense categorization UI
3. `src/components/SimpleCategoryPicker.jsx` - Category selection with click-to-confirm
4. `src/components/AIExpenseCategorization.jsx` - AI prompt improvements
5. `src/utils/parentCategoryMapping.js` - MEDICAL category description update
6. `src/components/Onboarding/GMSPanelUploadPrompt.jsx` - Complete redesign with Cara
7. `src/components/UnifiedOnboarding.jsx` - Added new steps and handlers for labelled import

### Dev Server
- Running on `http://localhost:5173` (Vite)
- API Server on `http://localhost:3001`
- Command: `npm run electron-dev`

### Architecture Notes

**Labelled Import Flow:**
```
Conversation → Upload Type Selection → (choice)
  ├── Pre-Labelled → Labelled Import → Category Mapping → Identifier Extraction → GMS Panel
  ├── Raw Transactions → Transaction Upload → AI Staff → AI Categorization → GMS Panel
  └── Backup → (TODO: Backup restore) → GMS Panel
```

**Category Synonym Dictionary** (in CategoryMappingReview.jsx):
- Maps common accounting terms to Sláinte parent categories
- Examples: "wages/salaries/payroll" → STAFF, "rent/rates/utilities" → PREMISES
- Fallback to AI for unrecognized categories

**Identifier Extraction Algorithm:**
1. Group transactions by mapped category
2. For each category group, extract patterns from descriptions
3. Find patterns appearing 2+ times (recurring)
4. Use longest common substring to refine patterns
5. Add as identifiers to category mapping

#### 5. Critical Bug Fixes for Labelled Import (Session 2)

**Issue 1: Transactions not being categorized (Category blank, Type "unknown")**
- **Root Cause**: `category` was being set as a string code instead of a full object
- **Fix** (`LabelledIdentifierExtraction.jsx`): Changed category assignment to create full object with `code`, `name`, `type`, `section` properties

**Issue 2: All values showing 0 in app**
- **Root Cause**: `isIncome` was being determined by `t.amount > 0`, but CSV imports typically have all positive amounts
- **Fix** (`LabelledIdentifierExtraction.jsx`): Changed to use `mapping?.isIncome` from the category mapping step, which is determined by the Sláinte category (INCOME = income, everything else = expense)

**Issue 3: Income/expense misclassification in CategoryMappingReview**
- **Root Cause**: The code tried to determine income vs expense from amount signs, which doesn't work for CSVs with all positive amounts
- **Fix** (`CategoryMappingReview.jsx`):
  - Removed amount-based income/expense detection
  - `isIncome` is now determined by the **mapped Sláinte category** (INCOME = true, all others = false)
  - Updated AI matching to set `isIncome` after category suggestion, not before
  - Updated manual mapping to also set `isIncome` when user changes category

**Issue 4: AI prompt improvements**
- **Fix** (`CategoryMappingReview.jsx`):
  - Upgraded from Haiku to Sonnet for better accuracy
  - Removed flow-type hinting that was causing confusion
  - Added more synonyms: building-related terms → PREMISES, partner/drawings → OTHER
  - Simplified prompt to focus on category semantics, not amount signs

**Files Modified:**
- `src/components/Onboarding/LabelledIdentifierExtraction.jsx` - Fixed category object and income determination
- `src/components/Onboarding/CategoryMappingReview.jsx` - Fixed income/expense logic, improved AI prompt

#### 6. Additional Fixes for Category Mapping (Session 3)

**Issue: "Legal Fees" and similar expense categories being matched to INCOME**
- **Root Cause**: The synonym dictionary had `'fees': 'INCOME'`, and the matching logic iterated in insertion order, so "legal fees" matched "fees" → INCOME before "legal" → PROFESSIONAL
- **Fix** (`CategoryMappingReview.jsx`):
  - Added explicit synonyms: `'legal fees'`, `'accountancy fees'`, `'solicitor fees'`, `'audit fees'`, `'bank fees'`, `'membership fees'` → PROFESSIONAL
  - Changed matching algorithm to sort synonyms by length (longest first), so more specific matches take priority
  - Removed bidirectional matching (`phrase.includes(normalized)`) - now only matches if user category contains the synonym phrase

**Added Debug Logging:**
- Added console logging to `calculateSummaries()` in `financialCalculations.js` to help debug year filter issues

#### 7. Dashboard Year Filter and Non-Business Category Fixes (Session 3 continued)

**Issue: Dashboard always showed 2025 even when data was from 2024**
- **Root Cause**: Saved settings had `selectedYear: 2025` and this was loaded even when no transactions existed for that year
- **Fix** (`AppContext.jsx`): On app load, check if saved year has transactions. If not, auto-switch to the most recent year with data.

**Issue: "Non-Business / Drawings" was not available as a mapping option**
- **Root Cause**: NON-BUSINESS was lumped under OTHER in parent categories
- **Fixes**:
  - Added `NON_BUSINESS` as a separate parent category in `parentCategoryMapping.js`
  - Added synonym mappings for drawings, partner, personal, loan, tax → NON_BUSINESS
  - Updated AI prompt to clearly distinguish NON_BUSINESS from OTHER
  - Updated `LabelledIdentifierExtraction.jsx` to set `type: 'non-business'` for these transactions

**Files Modified:**
- `src/context/AppContext.jsx` - Auto-select year with data on load
- `src/utils/parentCategoryMapping.js` - Added NON_BUSINESS parent category
- `src/components/Onboarding/CategoryMappingReview.jsx` - Updated synonyms and AI prompt
- `src/components/Onboarding/LabelledIdentifierExtraction.jsx` - Handle non-business type

#### 8. Category Mapping Improvements and Expense Calculation Fix (Session 4)

**Issue 1: Card Machine Fees appearing as Income**
- **Root Cause**: The word "fees" in the synonym dictionary matched to INCOME, and there was no logical check for money direction
- **Fix** (`CategoryMappingReview.jsx`):
  - Added money direction analysis for each category - counts incoming vs outgoing transactions
  - If >70% of transactions are outgoing (debits), category is flagged as `isLikelyExpense`
  - Validation step: If exact match returns INCOME but transactions are clearly outgoing, override to PROFESSIONAL
  - AI prompt now includes "Money direction: OUTGOING/INCOMING" for each category
  - AI validation: If AI suggests INCOME for outgoing transactions, override to PROFESSIONAL

**Issue 2: Missing synonyms**
- **Fix** (`CategoryMappingReview.jsx`): Added synonyms:
  - `'liquid nitrogen'`, `'nitrogen'`, `'cryotherapy'` → MEDICAL
  - `'medical indemnity'`, `'card machine fees'`, `'card machine'`, `'card fees'`, `'merchant fees'`, `'payment processing'` → PROFESSIONAL

**Issue 3: Total Expenses including Non-Business/Drawings**
- **Root Cause**: The expense calculation was adding all debits to expenses, then trying to subtract drawings, but drawings weren't being properly identified for imported transactions
- **Fix** (`financialCalculations.js`):
  - Added `isNonBusiness()` helper function that checks:
    - `t.category?.type === 'non-business'`
    - `t.category?.section === 'NON-BUSINESS'`
    - `t.category?.code.startsWith('90')` (Partner Drawings series)
  - Changed calculation to check `isNonBusiness()` first and add to `drawings` instead of `expenses`
  - Business expenses are now only counted if NOT non-business

**Files Modified:**
- `src/components/Onboarding/CategoryMappingReview.jsx` - Money direction check, new synonyms, AI validation
- `src/utils/financialCalculations.js` - Fixed expense calculation to properly exclude non-business

### Next Steps / Ideas for Future
- Implement Sláinte backup restore flow
- Add progress indicator showing "X of Y panels uploaded" based on partner count
- Consider batch import summary showing before/after statistics
- May want staff name detection in labelled data (currently skips AI staff step)

---
*Last updated: December 3, 2025*

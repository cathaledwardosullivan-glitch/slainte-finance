# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
# Development
npm run dev                 # Start Vite dev server (localhost:5173)
npm run electron-dev        # Run Electron app with hot reload (concurrent dev server + Electron)

# Build
npm run build               # Build React app to dist/
npm run electron-build      # Build and package as Windows NSIS installer

# Publish
npm run publish             # Build and upload to GitHub releases
npm run publish-dry         # Build without uploading (for testing)
```

## Architecture Overview

Sláinte Finance is an Electron desktop app for Irish GP practices to manage financial data and analyze PCRS/GMS payments, with AI-powered insights via Claude API.

### Dual Runtime Model

The app runs in two contexts:
1. **Electron Main Process** (`electron/main.cjs`) - Runs Express API server on port 3001, handles IPC, manages secure storage in userData directory
2. **React Renderer** (`src/`) - UI layer with Vite/React, stores data in localStorage, syncs to Electron via IPC

Mobile partners access the app via LAN by connecting to the Express API server with JWT authentication.

### State Management

Global state lives in `src/context/AppContext.jsx`:
- `transactions[]` / `unidentifiedTransactions[]` - Financial data
- `categoryMapping[]` - Expense categories with keyword identifiers
- `paymentAnalysisData[]` - PCRS/GMS analysis results
- `aiCorrections{}` - User corrections for AI learning

Data flows: CSV Upload → `transactionProcessor.js` → categorization → localStorage → `syncAllToElectron()` → Electron userData

### Storage Layer

Two storage locations:
- **localStorage** (browser) - Primary React storage, accessed via `src/utils/storageUtils.js`
- **Electron userData** (filesystem) - Secure credentials, API mirror for Express server

Key storage functions in `storageUtils.js`: `saveToStorage()`, `loadFromStorage()`, `saveTransactions()`, `saveCategoryMapping()`

### IPC Bridge

`electron/preload.cjs` exposes `window.electronAPI` with:
- Storage: `getLocalStorage()`, `setLocalStorage()`
- Auth: `getMobileAccessStatus()`, `setMobilePassword()`
- License: `getLicenseStatus()`, `onLicenseStatus()`
- PCRS: `initiateRenewal()`, `checkRenewalStatus()`

### Key Directories

- `src/components/` - React components including `Dashboard`, `FinancialChat`, `CategoryManager`, `TransactionList`, `PaymentAnalysis`, `GMSHealthCheck`
- `src/components/Onboarding/` - Multi-step setup wizard (profile, API key, import, categorization)
- `src/hooks/` - `useLANMode.js` (mobile detection/API), `usePracticeProfile.js`
- `src/utils/` - Business logic: `transactionProcessor.js`, `financialCalculations.js`, `healthCheckCalculations.js`, `claudeAPI.js`
- `src/storage/` - Persistence: `practiceProfileStorage.js`, `chatStorage.js`
- `src/data/` - Static data: `categoryMappings.js`, `gmsRates.js`, `practiceProfileSchema.js`

### Authentication

- Desktop: No login required, license validation only
- Mobile LAN access: Password configured in onboarding, JWT tokens from `/api/auth/login`
- API key stored in Electron userData (`secure-credentials.json`), never in .env

### Color System

Use constants from `src/utils/colors.js`:
- `slainteBlue` (#4A90E2) - Primary brand
- `incomeColor` (#4ECDC4) - Positive/income
- `expenseColor` (#FF6B6B) - Negative/expense
- `highlightYellow` (#FFD23C) - Callouts

### LAN Mode Detection

`isLANMode()` checks if hostname is private IP (192.168.x.x, 10.x.x.x). Components use `useLANMode()` hook for mobile-specific behavior and API calls.

### Bank Statement PDF Parser

The app supports uploading bank statement PDFs as an alternative to CSV files. Located in `src/utils/bankStatementParser.js`.

**Currently Supported Banks:**
- Bank of Ireland (BOI) - 98.5% accuracy validated against CSV ground truth

**Architecture:**
```javascript
// Main export
parseBankStatementPDF(file, bankHint = null)
// Returns: { transactions: [], bank: string, metadata: {} }

// Bank detection is automatic via detectBank()
// Bank-specific parsers registered in BANK_PARSERS object
```

**Adding a New Bank Parser:**
1. Add detection patterns to `detectBank()` function
2. Create parser function (e.g., `parseAIBStatement()`)
3. Register in `BANK_PARSERS` object
4. Update `getSupportedBanks()` return value

**Key Parsing Challenges:**
- BOI uses "DD MMM YYYY" date format with continuation lines (same date spans multiple lines)
- Debit/credit determined by comparing transaction amount against running balance changes
- Skip patterns filter out headers, footers, and informational notices

**Testing:**
Test script at `scripts/test-boi-parser.cjs` compares PDF extraction against CSV ground truth. Requires:
- PDF files and matching CSV in same folder
- Run with: `node scripts/test-boi-parser.cjs "path/to/folder"`

**UI Integration:**
`TransactionUpload.jsx` includes a 4th upload column for bank PDFs with automatic categorization and duplicate detection.

# PCRS Statement Automation - Complete Implementation Guide

## Sláinte Finance Feature: Automated PCRS Statement Download

**Document Version:** 1.1  
**Date:** December 2024  
**Project:** Sláinte Finance (sl[AI]nte Finance)  
**Feature:** Embedded browser automation for PCRS statement retrieval

---

## 1. Executive Summary

This document provides everything needed to implement automated PCRS (Primary Care Reimbursement Service) statement downloads within the Sláinte Finance Electron application. 

The solution uses an embedded BrowserView where users authenticate manually, after which the application automates navigation and PDF downloads. Session persistence allows subsequent uses to skip re-authentication when sessions remain valid.

### Key Design Principles
- **User-controlled authentication** - No credential storage; users log in via embedded browser
- **Session persistence** - Store encrypted session cookies for faster subsequent access
- **Full integration** - Feature lives entirely within Sláinte, no external tools required
- **Direct URL construction** - Build download URLs programmatically (no brittle DOM clicking)
- **Multi-panel support** - Handle practices with multiple GP panels

---

## 2. Portal Investigation Findings

Investigation of the live PCRS portal revealed clear, predictable URL patterns that significantly simplify automation.

### 2.1 Key URLs

| Purpose | URL |
|---------|-----|
| Login | `https://secure.sspcrs.ie/portal/userAdmin/login` |
| Panel Switching | `https://secure.sspcrs.ie/doctor/sec/switchDoc` |
| Statements List | `https://secure.sspcrs.ie/secure/listings/sec/doctor/list/itemised` |

### 2.2 Download URL Pattern (Critical!)

We can **construct download URLs directly** - no need to click through the UI:

```
/secure/listings/sec/doctor/view/itemised?year={YYYY}&month={YYYYMM}&filename={YYYYMM}_{PANEL_ID}_statement.pdf
```

**Example:**
```
https://secure.sspcrs.ie/secure/listings/sec/doctor/view/itemised?year=2025&month=202511&filename=202511_60265_statement.pdf
```

### 2.3 Panel Switching Pattern

```
/doctor/sec/switchDoc?docNum={PANEL_ID}
```

**HTML structure on switch page:**
```html
<a href="/doctor/sec/switchDoc?docNum=60268" class="btn btn-primary btn-lg" role="button">
    <span>60268</span>      <!-- Panel ID -->
    <span>DR.</span>        <!-- Title -->
    <span>ROBERT</span>     <!-- First Name -->
    <span>SCANLON</span>    <!-- Last Name -->
</a>
```

### 2.4 File Naming Convention

**Pattern:** `{YYYYMM}_{PANEL_ID}_statement.pdf`

**Example:** `202511_60265_statement.pdf`

---

## 3. Technical Architecture

### 3.1 High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      Sláinte Finance App                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌─────────────────┐    ┌───────────────┐  │
│  │   Main UI    │───▶│  PCRS Manager   │───▶│ PDF Processor │  │
│  │  (React)     │    │   Component     │    │   (Existing)  │  │
│  └──────────────┘    └────────┬────────┘    └───────────────┘  │
│                               │                                 │
│                               ▼                                 │
│                    ┌─────────────────────┐                     │
│                    │   BrowserView       │                     │
│                    │  (Electron)         │                     │
│                    │                     │                     │
│                    │  ┌───────────────┐  │                     │
│                    │  │ PCRS Portal   │  │                     │
│                    │  │ sspcrs.ie     │  │                     │
│                    │  └───────────────┘  │                     │
│                    └─────────────────────┘                     │
│                               │                                 │
│                               ▼                                 │
│                    ┌─────────────────────┐                     │
│                    │  Session Store      │                     │
│                    │  (Encrypted)        │                     │
│                    └─────────────────────┘                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Simplified Automation Flow

```
1. DETECT LOGIN
   └─> Check for 'a[href*="logout"]' or 'a[href*="switchDoc"]'

2. GET AVAILABLE PANELS (if multi-panel practice)
   └─> Navigate to: /doctor/sec/switchDoc
   └─> Scrape: a[href*="switchDoc?docNum="]
   └─> Extract: Panel ID, Doctor Name from <span> children

3. FOR EACH SELECTED PANEL:
   │
   ├─> SWITCH PANEL (if not current)
   │   └─> Navigate to: /doctor/sec/switchDoc?docNum={ID}
   │
   ├─> GET AVAILABLE STATEMENTS
   │   └─> Navigate to: /secure/listings/sec/doctor/list/itemised
   │   └─> Scrape table for: a[href*="view/itemised"]
   │   └─> Parse URL params: year, month, filename
   │
   └─> DOWNLOAD LATEST (or selected month)
       └─> Navigate to constructed download URL (triggers download)
```

### 3.3 Component Structure

```
src/
├── main/
│   ├── pcrs/
│   │   ├── pcrsAutomation.js      # Main process automation logic
│   │   ├── sessionManager.js       # Cookie/session persistence
│   │   └── downloadManager.js      # PDF download handling
│   └── preload/
│       └── pcrsPreload.js          # Secure bridge for BrowserView
│
├── renderer/
│   └── components/
│       └── PCRSDownloader/
│           ├── PCRSDownloader.jsx  # Main UI component
│           └── DownloadProgress.jsx # Progress indicator
│
└── shared/
    └── pcrsConstants.js            # URLs, selectors, timeouts
```

---

## 4. Constants and Configuration

**File: `src/shared/pcrsConstants.js`**

```javascript
/**
 * PCRS Portal Constants
 * Based on investigation of secure.sspcrs.ie portal structure
 */

const PCRS_URLS = {
  BASE: 'https://secure.sspcrs.ie',
  LOGIN: 'https://secure.sspcrs.ie/portal/userAdmin/login',
  SWITCH_DOCTOR: 'https://secure.sspcrs.ie/doctor/sec/switchDoc',
  STATEMENTS_LIST: 'https://secure.sspcrs.ie/secure/listings/sec/doctor/list/itemised',
  STATEMENT_DOWNLOAD_BASE: '/secure/listings/sec/doctor/view/itemised'
};

/**
 * Construct a direct download URL for a statement
 */
function buildStatementDownloadUrl(year, month, panelId) {
  const filename = `${month}_${panelId}_statement.pdf`;
  const params = new URLSearchParams({
    year: year,
    month: month,
    filename: filename
  });
  return `${PCRS_URLS.BASE}${PCRS_URLS.STATEMENT_DOWNLOAD_BASE}?${params.toString()}`;
}

/**
 * Construct panel switch URL
 */
function buildPanelSwitchUrl(panelId) {
  return `${PCRS_URLS.SWITCH_DOCTOR}?docNum=${panelId}`;
}

// CSS Selectors
const PCRS_SELECTORS = {
  // Panel/doctor buttons on switch page
  PANEL_BUTTONS: 'a[href*="switchDoc?docNum="]',
  
  // Download links in statements table
  DOWNLOAD_LINKS: 'a[href*="view/itemised"]',
  
  // Login detection - if these exist, user is logged in
  LOGGED_IN_INDICATORS: 'a[href*="logout"], a[href*="switchDoc"]',
  
  // Login form - if this exists, user is NOT logged in
  LOGIN_FORM: 'form[action*="login"], #loginForm'
};

// Regex patterns
const PCRS_PATTERNS = {
  // Match statement filename: 202511_60265_statement.pdf
  FILENAME: /^(\d{6})_(\d+)_statement\.pdf$/,
  
  // Extract panel ID from switch URL
  PANEL_ID_FROM_URL: /switchDoc\?docNum=(\d+)/,
  
  // Extract download params from URL
  DOWNLOAD_PARAMS: /year=(\d{4})&month=(\d{6})&filename=(.+\.pdf)/
};

// Timeouts (milliseconds)
const TIMEOUTS = {
  SESSION_CHECK: 10000,
  PAGE_LOAD: 20000,
  NAVIGATION: 15000,
  DOWNLOAD: 30000,
  PANEL_SWITCH: 5000,
  BETWEEN_DOWNLOADS: 1000,
  LOGIN_DETECTION: 500
};

// Session config
const SESSION_CONFIG = {
  PARTITION_NAME: 'persist:pcrs',
  MAX_AGE_HOURS: 24,
  COOKIE_DOMAIN: '.sspcrs.ie'
};

/**
 * Scripts to inject into BrowserView for data extraction
 */
const SCRIPTS = {
  // Extract all available panels from switch page
  GET_PANELS: `
    (function() {
      const panelLinks = document.querySelectorAll('a[href*="switchDoc?docNum="]');
      
      return Array.from(panelLinks).map(link => {
        const href = link.getAttribute('href');
        const panelIdMatch = href.match(/docNum=(\\d+)/);
        const panelId = panelIdMatch ? panelIdMatch[1] : null;
        
        const spans = link.querySelectorAll('span');
        const parts = Array.from(spans).map(s => s.textContent.trim());
        
        return {
          id: panelId,
          number: parts[0] || panelId,
          title: parts[1] || '',
          firstName: parts[2] || '',
          lastName: parts[3] || '',
          fullName: parts.slice(1).join(' ').trim(),
          displayName: parts.slice(2).join(' ').trim() || 'Panel ' + panelId
        };
      }).filter(p => p.id);
    })();
  `,

  // Extract available statements from listing page
  GET_STATEMENTS: `
    (function() {
      const links = document.querySelectorAll('a[href*="view/itemised"]');
      
      return Array.from(links).map(link => {
        const href = link.getAttribute('href');
        const filename = link.textContent.trim();
        const urlParams = new URLSearchParams(href.split('?')[1]);
        
        return {
          year: urlParams.get('year'),
          month: urlParams.get('month'),
          filename: filename,
          downloadUrl: href
        };
      });
    })();
  `,

  // Check login status
  CHECK_LOGIN_STATUS: `
    (function() {
      const logoutLink = document.querySelector('a[href*="logout"]');
      if (logoutLink) return { loggedIn: true, indicator: 'logout-link' };
      
      const switchLink = document.querySelector('a[href*="switchDoc"]');
      if (switchLink) return { loggedIn: true, indicator: 'switch-link' };
      
      const loginForm = document.querySelector('form[action*="login"], #loginForm');
      if (loginForm) return { loggedIn: false, indicator: 'login-form' };
      
      const url = window.location.href;
      if (url.includes('/login')) return { loggedIn: false, indicator: 'login-url' };
      if (url.includes('/secure/') || url.includes('/doctor/')) {
        return { loggedIn: true, indicator: 'secure-url' };
      }
      
      return { loggedIn: false, indicator: 'unknown' };
    })();
  `,

  // Get current panel from page content
  GET_CURRENT_PANEL: `
    (function() {
      const statementLink = document.querySelector('a[href*="_statement.pdf"]');
      if (statementLink) {
        const filename = statementLink.textContent;
        const match = filename.match(/\\d{6}_(\\d+)_statement/);
        if (match) return { panelId: match[1], source: 'filename' };
      }
      return { panelId: null, source: 'not-found' };
    })();
  `
};

module.exports = {
  PCRS_URLS,
  PCRS_SELECTORS,
  PCRS_PATTERNS,
  TIMEOUTS,
  SESSION_CONFIG,
  SCRIPTS,
  buildStatementDownloadUrl,
  buildPanelSwitchUrl
};
```

---

## 5. Main Process Implementation

### 5.1 PCRS Automation Module

**File: `src/main/pcrs/pcrsAutomation.js`**

```javascript
const { BrowserView, session, ipcMain } = require('electron');
const path = require('path');
const { SessionManager } = require('./sessionManager');
const { DownloadManager } = require('./downloadManager');
const { 
  PCRS_URLS, 
  SCRIPTS, 
  TIMEOUTS, 
  SESSION_CONFIG,
  buildStatementDownloadUrl,
  buildPanelSwitchUrl 
} = require('../../shared/pcrsConstants');

class PCRSAutomation {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.browserView = null;
    this.sessionManager = new SessionManager();
    this.downloadManager = new DownloadManager();
    this.isAuthenticated = false;
    this.currentPanelId = null;
    
    this.setupIPC();
  }

  setupIPC() {
    ipcMain.handle('pcrs:start', async (event, options) => {
      return await this.start(options);
    });

    ipcMain.handle('pcrs:checkSession', async () => {
      return await this.sessionManager.hasSession();
    });

    ipcMain.handle('pcrs:getPanels', async () => {
      return await this.getAvailablePanels();
    });

    ipcMain.handle('pcrs:getStatements', async (event, panelId) => {
      return await this.getStatementsForPanel(panelId);
    });

    ipcMain.handle('pcrs:downloadStatements', async (event, { panels, months }) => {
      return await this.downloadStatements(panels, months);
    });

    ipcMain.handle('pcrs:close', () => {
      this.close();
    });

    ipcMain.handle('pcrs:setBounds', (event, bounds) => {
      this.setBounds(bounds);
    });

    ipcMain.handle('pcrs:getDownloadPath', () => {
      return this.downloadManager.getDownloadPath();
    });
  }

  async start(options = {}) {
    const { forceNewSession = false } = options;
    
    const pcrsSession = session.fromPartition(SESSION_CONFIG.PARTITION_NAME);
    
    if (!forceNewSession) {
      const hasValidSession = await this.tryRestoreSession(pcrsSession);
      if (hasValidSession) {
        this.isAuthenticated = true;
        this.sendStatus('session-restored');
        return { status: 'authenticated', needsLogin: false };
      }
    }

    this.createBrowserView(pcrsSession);
    return { status: 'login-required', needsLogin: true };
  }

  createBrowserView(pcrsSession) {
    this.browserView = new BrowserView({
      webPreferences: {
        session: pcrsSession,
        preload: path.join(__dirname, '../preload/pcrsPreload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    });

    this.mainWindow.setBrowserView(this.browserView);
    this.browserView.webContents.loadURL(PCRS_URLS.LOGIN);

    // Monitor for successful login
    this.browserView.webContents.on('did-finish-load', async () => {
      const url = this.browserView.webContents.getURL();
      await this.checkLoginStatus(url);
    });

    // Handle downloads
    pcrsSession.on('will-download', (event, item, webContents) => {
      this.downloadManager.handleDownload(item, this.currentPanelId);
    });
  }

  async checkLoginStatus(url) {
    if (this.isAuthenticated) return;

    try {
      const status = await this.browserView.webContents.executeJavaScript(SCRIPTS.CHECK_LOGIN_STATUS);
      
      if (status.loggedIn) {
        this.isAuthenticated = true;
        await this.saveSession();
        this.sendStatus('login-success');
        
        this.mainWindow.webContents.send('pcrs:authStateChanged', {
          authenticated: true,
          url: url
        });
      }
    } catch (error) {
      console.error('[PCRS] Login check failed:', error);
    }
  }

  async tryRestoreSession(pcrsSession) {
    try {
      const savedCookies = await this.sessionManager.loadSession();
      if (!savedCookies || savedCookies.length === 0) return false;

      for (const cookie of savedCookies) {
        try {
          await pcrsSession.cookies.set(cookie);
        } catch (e) {
          console.warn('[PCRS] Failed to restore cookie:', cookie.name);
        }
      }

      return await this.verifySession(pcrsSession);
    } catch (error) {
      console.error('[PCRS] Session restore failed:', error);
      return false;
    }
  }

  async verifySession(pcrsSession) {
    const testView = new BrowserView({
      webPreferences: { session: pcrsSession, nodeIntegration: false }
    });

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        testView.webContents.destroy();
        resolve(false);
      }, TIMEOUTS.SESSION_CHECK);

      testView.webContents.on('did-finish-load', async () => {
        clearTimeout(timeout);
        
        try {
          const status = await testView.webContents.executeJavaScript(SCRIPTS.CHECK_LOGIN_STATUS);
          testView.webContents.destroy();
          resolve(status.loggedIn);
        } catch {
          testView.webContents.destroy();
          resolve(false);
        }
      });

      testView.webContents.loadURL(PCRS_URLS.STATEMENTS_LIST);
    });
  }

  async saveSession() {
    try {
      const pcrsSession = session.fromPartition(SESSION_CONFIG.PARTITION_NAME);
      const cookies = await pcrsSession.cookies.get({ domain: SESSION_CONFIG.COOKIE_DOMAIN });
      await this.sessionManager.saveSession(cookies);
      console.log('[PCRS] Session saved:', cookies.length, 'cookies');
    } catch (error) {
      console.error('[PCRS] Failed to save session:', error);
    }
  }

  async getAvailablePanels() {
    if (!this.browserView || !this.isAuthenticated) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      // Navigate to switch doctor page
      await this.navigateTo(PCRS_URLS.SWITCH_DOCTOR);
      
      // Extract panels
      const panels = await this.browserView.webContents.executeJavaScript(SCRIPTS.GET_PANELS);
      
      if (panels.length === 0) {
        // Single panel practice - get panel ID from statements page
        await this.navigateTo(PCRS_URLS.STATEMENTS_LIST);
        const currentPanel = await this.browserView.webContents.executeJavaScript(SCRIPTS.GET_CURRENT_PANEL);
        
        if (currentPanel.panelId) {
          return {
            success: true,
            panels: [{
              id: currentPanel.panelId,
              displayName: 'Your Practice',
              isDefault: true
            }]
          };
        }
      }

      return { success: true, panels };
    } catch (error) {
      console.error('[PCRS] Failed to get panels:', error);
      return { success: false, error: error.message };
    }
  }

  async getStatementsForPanel(panelId) {
    if (!this.browserView || !this.isAuthenticated) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      // Switch panel if needed
      if (panelId !== this.currentPanelId) {
        await this.switchToPanel(panelId);
      }

      // Navigate to statements list
      await this.navigateTo(PCRS_URLS.STATEMENTS_LIST);
      
      // Extract available statements
      const statements = await this.browserView.webContents.executeJavaScript(SCRIPTS.GET_STATEMENTS);
      
      return { success: true, statements, panelId };
    } catch (error) {
      console.error('[PCRS] Failed to get statements:', error);
      return { success: false, error: error.message };
    }
  }

  async switchToPanel(panelId) {
    const switchUrl = buildPanelSwitchUrl(panelId);
    await this.navigateTo(switchUrl);
    this.currentPanelId = panelId;
    await this.delay(TIMEOUTS.PANEL_SWITCH);
  }

  async downloadStatements(panels, months = ['latest']) {
    if (!this.browserView || !this.isAuthenticated) {
      return { success: false, error: 'Not authenticated' };
    }

    const results = [];
    
    for (const panel of panels) {
      try {
        this.sendStatus('switching-panel', { panel: panel.displayName });
        
        // Get statements for this panel
        const statementsResult = await this.getStatementsForPanel(panel.id);
        
        if (!statementsResult.success) {
          results.push({
            panelId: panel.id,
            panelName: panel.displayName,
            success: false,
            error: statementsResult.error
          });
          continue;
        }

        const statements = statementsResult.statements;
        
        // Determine which statements to download
        let toDownload = [];
        if (months.includes('latest') && statements.length > 0) {
          toDownload = [statements[0]]; // First is most recent
        } else {
          toDownload = statements.filter(s => months.includes(s.month));
        }

        // Download each statement
        for (const statement of toDownload) {
          this.sendStatus('downloading', { 
            panel: panel.displayName, 
            month: statement.month 
          });

          const downloadUrl = `${PCRS_URLS.BASE}${statement.downloadUrl}`;
          
          // Trigger download by navigating to the URL
          await this.browserView.webContents.loadURL(downloadUrl);
          await this.delay(TIMEOUTS.BETWEEN_DOWNLOADS);

          results.push({
            panelId: panel.id,
            panelName: panel.displayName,
            month: statement.month,
            filename: statement.filename,
            success: true
          });
        }

      } catch (error) {
        results.push({
          panelId: panel.id,
          panelName: panel.displayName,
          success: false,
          error: error.message
        });
      }
    }

    this.sendStatus('complete', { results });
    return { success: true, results };
  }

  async navigateTo(url) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Navigation timeout'));
      }, TIMEOUTS.NAVIGATION);

      this.browserView.webContents.once('did-finish-load', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.browserView.webContents.loadURL(url);
    });
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  sendStatus(status, data = {}) {
    this.mainWindow.webContents.send('pcrs:status', { status, ...data });
  }

  setBounds(bounds) {
    if (this.browserView) {
      this.browserView.setBounds(bounds);
    }
  }

  close() {
    if (this.browserView) {
      this.mainWindow.removeBrowserView(this.browserView);
      this.browserView.webContents.destroy();
      this.browserView = null;
    }
    this.isAuthenticated = false;
    this.currentPanelId = null;
  }
}

module.exports = { PCRSAutomation };
```

### 5.2 Session Manager

**File: `src/main/pcrs/sessionManager.js`**

```javascript
const { safeStorage } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');
const { SESSION_CONFIG } = require('../../shared/pcrsConstants');

class SessionManager {
  constructor() {
    this.sessionFile = path.join(app.getPath('userData'), 'pcrs-session.enc');
  }

  async saveSession(cookies) {
    if (!safeStorage.isEncryptionAvailable()) {
      console.warn('[SessionManager] Encryption not available');
      return false;
    }

    try {
      const sessionData = JSON.stringify({
        cookies,
        savedAt: Date.now(),
        version: 1
      });

      const encrypted = safeStorage.encryptString(sessionData);
      await fs.writeFile(this.sessionFile, encrypted);
      return true;
    } catch (error) {
      console.error('[SessionManager] Save failed:', error);
      return false;
    }
  }

  async loadSession() {
    try {
      const encrypted = await fs.readFile(this.sessionFile);
      const decrypted = safeStorage.decryptString(encrypted);
      const sessionData = JSON.parse(decrypted);

      // Check session age
      const maxAge = SESSION_CONFIG.MAX_AGE_HOURS * 60 * 60 * 1000;
      if (Date.now() - sessionData.savedAt > maxAge) {
        console.log('[SessionManager] Session expired');
        await this.clearSession();
        return null;
      }

      return sessionData.cookies;
    } catch (error) {
      return null;
    }
  }

  async clearSession() {
    try {
      await fs.unlink(this.sessionFile);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  }

  async hasSession() {
    try {
      await fs.access(this.sessionFile);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = { SessionManager };
```

### 5.3 Download Manager

**File: `src/main/pcrs/downloadManager.js`**

```javascript
const { app } = require('electron');
const path = require('path');
const fs = require('fs').promises;

class DownloadManager {
  constructor() {
    this.downloadPath = path.join(app.getPath('userData'), 'pcrs-downloads');
    this.ensureDownloadDirectory();
  }

  async ensureDownloadDirectory() {
    try {
      await fs.mkdir(this.downloadPath, { recursive: true });
    } catch (error) {
      console.error('[DownloadManager] Failed to create directory:', error);
    }
  }

  handleDownload(item, panelId) {
    const originalFilename = item.getFilename();
    const savePath = path.join(this.downloadPath, originalFilename);
    
    item.setSavePath(savePath);

    item.once('done', (event, state) => {
      if (state === 'completed') {
        console.log('[DownloadManager] Download completed:', originalFilename);
      } else {
        console.error('[DownloadManager] Download failed:', state);
      }
    });
  }

  getDownloadPath() {
    return this.downloadPath;
  }

  async getDownloadedFiles() {
    try {
      const files = await fs.readdir(this.downloadPath);
      return files.filter(f => f.endsWith('.pdf'));
    } catch {
      return [];
    }
  }
}

module.exports = { DownloadManager };
```

---

## 6. React Component

**File: `src/renderer/components/PCRSDownloader/PCRSDownloader.jsx`**

```jsx
import React, { useState, useEffect, useRef } from 'react';
import { Download, RefreshCw, CheckCircle, AlertCircle, Loader, X } from 'lucide-react';

const PCRSDownloader = ({ onStatementsDownloaded, onClose }) => {
  const [status, setStatus] = useState('idle');
  const [panels, setPanels] = useState([]);
  const [selectedPanels, setSelectedPanels] = useState([]);
  const [downloadResults, setDownloadResults] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentAction, setCurrentAction] = useState('');

  useEffect(() => {
    checkSession();

    const handleStatus = (event, data) => {
      handleStatusUpdate(data);
    };

    const handleAuthChange = (event, data) => {
      if (data.authenticated) {
        setStatus('authenticated');
        fetchPanels();
      }
    };

    window.electron.ipcRenderer.on('pcrs:status', handleStatus);
    window.electron.ipcRenderer.on('pcrs:authStateChanged', handleAuthChange);

    return () => {
      window.electron.ipcRenderer.removeListener('pcrs:status', handleStatus);
      window.electron.ipcRenderer.removeListener('pcrs:authStateChanged', handleAuthChange);
    };
  }, []);

  const handleStatusUpdate = (data) => {
    switch (data.status) {
      case 'session-restored':
        setStatus('authenticated');
        setCurrentAction('Session restored');
        fetchPanels();
        break;
      case 'login-success':
        setStatus('authenticated');
        setCurrentAction('Login successful');
        fetchPanels();
        break;
      case 'switching-panel':
        setCurrentAction(`Switching to: ${data.panel}`);
        break;
      case 'downloading':
        setCurrentAction(`Downloading: ${data.panel} - ${data.month}`);
        break;
      case 'complete':
        setStatus('complete');
        setDownloadResults(data.results || []);
        break;
      case 'error':
        setStatus('error');
        setErrorMessage(data.error || 'An error occurred');
        break;
    }
  };

  const checkSession = async () => {
    setStatus('checking');
    setCurrentAction('Checking for existing session...');
    
    try {
      const hasSession = await window.electron.ipcRenderer.invoke('pcrs:checkSession');
      
      if (hasSession) {
        const result = await window.electron.ipcRenderer.invoke('pcrs:start', { forceNewSession: false });
        
        if (!result.needsLogin) {
          setStatus('authenticated');
          fetchPanels();
        } else {
          setStatus('login-required');
        }
      } else {
        await startLogin();
      }
    } catch (error) {
      setStatus('login-required');
    }
  };

  const startLogin = async () => {
    setStatus('login-required');
    setCurrentAction('Please log in to PCRS portal');
    
    try {
      await window.electron.ipcRenderer.invoke('pcrs:start', { forceNewSession: true });
    } catch (error) {
      setStatus('error');
      setErrorMessage(error.message);
    }
  };

  const fetchPanels = async () => {
    setCurrentAction('Fetching available panels...');
    
    try {
      const result = await window.electron.ipcRenderer.invoke('pcrs:getPanels');
      
      if (result.success && result.panels.length > 0) {
        setPanels(result.panels);
        setSelectedPanels(result.panels.map(p => p.id));
      }
    } catch (error) {
      console.error('Failed to fetch panels:', error);
    }
  };

  const togglePanel = (panelId) => {
    setSelectedPanels(prev => 
      prev.includes(panelId)
        ? prev.filter(id => id !== panelId)
        : [...prev, panelId]
    );
  };

  const startDownload = async () => {
    if (selectedPanels.length === 0) return;

    setStatus('downloading');
    setCurrentAction('Starting download...');

    try {
      const panelsToDownload = panels.filter(p => selectedPanels.includes(p.id));
      const result = await window.electron.ipcRenderer.invoke('pcrs:downloadStatements', {
        panels: panelsToDownload,
        months: ['latest']
      });
      
      if (result.success) {
        setDownloadResults(result.results);
        setStatus('complete');
        
        if (onStatementsDownloaded) {
          const successfulDownloads = result.results.filter(r => r.success);
          onStatementsDownloaded(successfulDownloads);
        }
      } else {
        setStatus('error');
        setErrorMessage(result.error);
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage(error.message);
    }
  };

  const handleClose = () => {
    window.electron.ipcRenderer.invoke('pcrs:close');
    if (onClose) onClose();
  };

  const renderContent = () => {
    switch (status) {
      case 'idle':
      case 'checking':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader className="w-8 h-8 animate-spin text-emerald-500 mb-4" />
            <p className="text-gray-600">{currentAction || 'Initializing...'}</p>
          </div>
        );

      case 'login-required':
        return (
          <div className="flex flex-col">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-amber-500 mr-2 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-800">Login Required</h4>
                  <p className="text-sm text-amber-700 mt-1">
                    Please log in to the PCRS portal below. Your credentials are not stored.
                  </p>
                </div>
              </div>
            </div>
            
            <div 
              className="border rounded-lg overflow-hidden bg-white"
              style={{ height: '500px' }}
              id="pcrs-browser-container"
            />

            <p className="text-xs text-gray-500 mt-2 text-center">
              Once logged in, you'll be able to download statements.
            </p>
          </div>
        );

      case 'authenticated':
        return (
          <div className="flex flex-col">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                <span className="text-green-800 font-medium">Connected to PCRS</span>
              </div>
            </div>

            {panels.length > 1 && (
              <div className="mb-4">
                <h4 className="font-medium text-gray-700 mb-2">Select Panels to Download</h4>
                <div className="space-y-2">
                  {panels.map(panel => (
                    <label 
                      key={panel.id}
                      className="flex items-center p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPanels.includes(panel.id)}
                        onChange={() => togglePanel(panel.id)}
                        className="w-4 h-4 text-emerald-600 rounded"
                      />
                      <span className="ml-3 text-gray-700">
                        {panel.displayName || panel.fullName || `Panel ${panel.id}`}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={startDownload}
              disabled={selectedPanels.length === 0}
              className="w-full py-3 px-4 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 
                       disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
            >
              <Download className="w-5 h-5 mr-2" />
              Download Latest Statements
            </button>
          </div>
        );

      case 'downloading':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader className="w-8 h-8 animate-spin text-emerald-500 mb-4" />
            <p className="text-gray-600 font-medium">{currentAction}</p>
          </div>
        );

      case 'complete':
        return (
          <div className="flex flex-col">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                <span className="text-green-800 font-medium">Download Complete</span>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              {downloadResults.map((result, index) => (
                <div 
                  key={index}
                  className={`p-3 rounded-lg ${result.success ? 'bg-green-50' : 'bg-red-50'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={result.success ? 'text-green-800' : 'text-red-800'}>
                      {result.panelName}
                    </span>
                    {result.success ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                  {result.filename && (
                    <p className="text-sm text-gray-600 mt-1">{result.filename}</p>
                  )}
                  {result.error && (
                    <p className="text-sm text-red-600 mt-1">{result.error}</p>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={handleClose}
              className="w-full py-2 px-4 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              Done
            </button>
          </div>
        );

      case 'error':
        return (
          <div className="flex flex-col">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-red-500 mr-2 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-800">Error</h4>
                  <p className="text-sm text-red-700 mt-1">{errorMessage}</p>
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={startLogin}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4 mr-2 inline" />
                Try Again
              </button>
              <button
                onClick={handleClose}
                className="flex-1 py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center">
            <Download className="w-5 h-5 text-emerald-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-800">Download PCRS Statements</h2>
          </div>
          <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default PCRSDownloader;
```

---

## 7. Integration

### 7.1 Main Process Setup

Add to your main Electron file:

```javascript
const { PCRSAutomation } = require('./pcrs/pcrsAutomation');

let pcrsAutomation;

function createWindow() {
  mainWindow = new BrowserWindow({ /* ... */ });
  
  // Initialize PCRS automation
  pcrsAutomation = new PCRSAutomation(mainWindow);
}
```

### 7.2 Preload Script

Add these channels to your preload script:

```javascript
const validInvokeChannels = [
  'pcrs:start',
  'pcrs:checkSession',
  'pcrs:getPanels',
  'pcrs:getStatements',
  'pcrs:downloadStatements',
  'pcrs:close',
  'pcrs:setBounds',
  'pcrs:getDownloadPath'
];

const validOnChannels = [
  'pcrs:status',
  'pcrs:authStateChanged'
];
```

### 7.3 Add to Dashboard

```jsx
import PCRSDownloader from './PCRSDownloader/PCRSDownloader';

const Dashboard = () => {
  const [showPCRSDownloader, setShowPCRSDownloader] = useState(false);

  return (
    <div>
      <button onClick={() => setShowPCRSDownloader(true)}>
        Download PCRS Statements
      </button>

      {showPCRSDownloader && (
        <PCRSDownloader
          onStatementsDownloaded={(downloads) => {
            console.log('Downloaded:', downloads);
            // Process/import the PDFs
          }}
          onClose={() => setShowPCRSDownloader(false)}
        />
      )}
    </div>
  );
};
```

---

## 8. Security Notes

### What We Store
- Session cookies only (encrypted via OS keychain)
- No credentials ever stored
- Sessions expire after 24 hours

### What We Don't Store
- Usernames or passwords
- Personal data from portal

---

## 9. Testing Checklist

- [ ] Fresh install - no existing session
- [ ] Login flow completes successfully  
- [ ] Session persists after app restart
- [ ] Session expiry handled gracefully
- [ ] Multi-panel selection works
- [ ] Single-panel practices work
- [ ] Downloads complete for each panel
- [ ] Downloaded PDFs are valid

---

## 10. Implementation Timeline

| Phase | Tasks | Time |
|-------|-------|------|
| 1 | Set up BrowserView, session manager, basic UI | 2-3 days |
| 2 | Panel detection, statement scraping | 1-2 days |
| 3 | Download automation, error handling | 1-2 days |
| 4 | Polish, testing | 1 day |

**Total: 5-8 days**

---

*Complete implementation guide for Sláinte Finance PCRS automation*

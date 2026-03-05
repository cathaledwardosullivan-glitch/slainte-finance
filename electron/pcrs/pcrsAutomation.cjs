/**
 * PCRS Automation Module
 * Manages BrowserView for authentication and automated statement downloads
 */

const { app, BrowserView, session, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { SessionManager } = require('./sessionManager.cjs');
const { DownloadManager } = require('./downloadManager.cjs');
const {
  PCRS_URLS,
  SCRIPTS,
  TIMEOUTS,
  SESSION_CONFIG,
  buildStatementDownloadUrl,
  buildPanelSwitchUrl
} = require('./pcrsConstants.cjs');

class PCRSAutomation {
  constructor(mainWindow, options = {}) {
    this.mainWindow = mainWindow;
    this.browserView = null;
    this.isAuthenticated = false;
    this.currentPanelId = null;
    this.isInitialized = false;
    this.pendingDownloadResolvers = new Map(); // Track pending download promises
    this.downloadListenerRegistered = false; // Track if download listener is set up
    this.onError = options.onError || null; // Optional error reporting callback

    // Register IPC handlers immediately (synchronously)
    this.setupIPC();
  }

  /**
   * Initialize the automation system (async parts)
   */
  async init() {
    if (this.isInitialized) return;

    try {
      SessionManager.init();
      await DownloadManager.init();
      this.isInitialized = true;
      console.log('[PCRS Automation] Fully initialized');
    } catch (error) {
      console.error('[PCRS Automation] Init error:', error);
      throw error;
    }
  }

  /**
   * Ensure initialization is complete before operations
   */
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.init();
    }
  }

  /**
   * Check if Local Only Mode is enabled
   */
  isLocalOnlyMode() {
    try {
      const userDataPath = app.getPath('userData');
      const storagePath = path.join(userDataPath, 'localStorage.json');
      if (!fs.existsSync(storagePath)) return false;
      const data = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
      const profileData = data['slainte_practice_profile'];
      if (!profileData) return false;
      const profile = typeof profileData === 'string' ? JSON.parse(profileData) : profileData;
      return profile?.metadata?.localOnlyMode === true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Set up IPC handlers for renderer communication
   */
  setupIPC() {
    ipcMain.handle('pcrs:start', async (event, options) => {
      if (this.isLocalOnlyMode()) {
        return { success: false, error: 'PCRS downloads are disabled in Local Only Mode. You can download statements manually from pcrs.ie and import the PDFs.' };
      }
      await this.ensureInitialized();
      return await this.start(options);
    });

    ipcMain.handle('pcrs:checkSession', async () => {
      if (this.isLocalOnlyMode()) {
        return { hasSession: false, localOnly: true };
      }
      await this.ensureInitialized();
      return await SessionManager.getSessionStatus();
    });

    ipcMain.handle('pcrs:clearSession', async () => {
      await this.ensureInitialized();
      await SessionManager.clearSession();
      return { success: true };
    });

    ipcMain.handle('pcrs:getPanels', async () => {
      if (this.isLocalOnlyMode()) {
        return { success: false, error: 'PCRS downloads are disabled in Local Only Mode.' };
      }
      await this.ensureInitialized();
      return await this.getAvailablePanels();
    });

    ipcMain.handle('pcrs:getStatements', async (event, panelId) => {
      if (this.isLocalOnlyMode()) {
        return { success: false, error: 'PCRS downloads are disabled in Local Only Mode.' };
      }
      await this.ensureInitialized();
      return await this.getStatementsForPanel(panelId);
    });

    ipcMain.handle('pcrs:downloadStatements', async (event, { panels, months, backgroundMode }) => {
      if (this.isLocalOnlyMode()) {
        return { success: false, error: 'PCRS downloads are disabled in Local Only Mode. You can download statements manually from pcrs.ie and import the PDFs.' };
      }
      await this.ensureInitialized();
      return await this.downloadStatements(panels, months, backgroundMode);
    });

    ipcMain.handle('pcrs:close', () => {
      this.close();
      return { success: true };
    });

    ipcMain.handle('pcrs:setBounds', (event, bounds) => {
      this.setBounds(bounds);
      return { success: true };
    });

    ipcMain.handle('pcrs:getDownloadPath', async () => {
      await this.ensureInitialized();
      return DownloadManager.getDownloadPath();
    });

    ipcMain.handle('pcrs:getDownloadedFiles', async () => {
      await this.ensureInitialized();
      return await DownloadManager.getDownloadedFiles();
    });

    ipcMain.handle('pcrs:readFile', async (event, filename) => {
      await this.ensureInitialized();
      const buffer = await DownloadManager.getFileBuffer(filename);
      if (buffer) {
        // Convert Buffer to ArrayBuffer for transfer to renderer
        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      }
      return null;
    });

    console.log('[PCRS Automation] IPC handlers registered');
  }

  /**
   * Start the PCRS automation session
   * @param {Object} options - Start options
   * @returns {Promise<Object>} Status result
   */
  async start(options = {}) {
    const { forceNewSession = false } = options;

    // Get or create the PCRS session partition
    const pcrsSession = session.fromPartition(SESSION_CONFIG.PARTITION_NAME);

    // Try to restore existing session if not forcing new
    if (!forceNewSession) {
      const hasValidSession = await this.tryRestoreSession(pcrsSession);
      if (hasValidSession) {
        this.isAuthenticated = true;
        // Create a hidden BrowserView for automation (needed for downloads)
        await this.createHiddenBrowserView(pcrsSession);
        this.sendStatus('session-restored');
        return { status: 'authenticated', needsLogin: false };
      }
    }

    // Create BrowserView for login
    this.createBrowserView(pcrsSession);
    return { status: 'login-required', needsLogin: true };
  }

  /**
   * Create a hidden BrowserView for automation when session is restored
   * @param {Session} pcrsSession - Electron session to use
   */
  async createHiddenBrowserView(pcrsSession) {
    // Clean up existing view if any
    if (this.browserView) {
      this.close();
    }

    console.log('[PCRS Automation] Creating hidden BrowserView for automation...');

    this.browserView = new BrowserView({
      webPreferences: {
        session: pcrsSession,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    });

    // Don't attach to window - keep it hidden
    // Set up download handler (only once per session)
    this.setupDownloadHandler(pcrsSession);

    // Load the switch doctor page to initialize webContents
    // This ensures the BrowserView is ready for navigation
    try {
      await this.navigateHidden(PCRS_URLS.SWITCH_DOCTOR);
      console.log('[PCRS Automation] Hidden BrowserView initialized with switch page');
    } catch (error) {
      console.warn('[PCRS Automation] Failed to load initial page:', error.message);
    }

    console.log('[PCRS Automation] Hidden BrowserView created');
  }

  /**
   * Navigate the hidden BrowserView to a URL
   * @param {string} url - URL to navigate to
   * @returns {Promise<void>}
   */
  navigateHidden(url) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Hidden navigation timeout'));
      }, TIMEOUTS.NAVIGATION);

      const onLoad = () => {
        clearTimeout(timeout);
        this.browserView.webContents.removeListener('did-fail-load', onFail);
        resolve();
      };

      const onFail = (event, errorCode, errorDescription) => {
        clearTimeout(timeout);
        this.browserView.webContents.removeListener('did-finish-load', onLoad);
        reject(new Error(`Hidden navigation failed: ${errorDescription}`));
      };

      this.browserView.webContents.once('did-finish-load', onLoad);
      this.browserView.webContents.once('did-fail-load', onFail);

      this.browserView.webContents.loadURL(url);
    });
  }

  /**
   * Set up download handler on the session (only once)
   * @param {Session} pcrsSession - Electron session
   */
  setupDownloadHandler(pcrsSession) {
    if (this.downloadListenerRegistered) {
      return; // Already set up
    }

    // Capture 'this' for use in callback
    const self = this;

    pcrsSession.on('will-download', (event, item, webContents) => {
      const filename = item.getFilename();
      self.log('[PCRS] Download started (will-download event):', filename);

      // Skip error pages
      if (filename === 'error.htm' || !filename.endsWith('.pdf')) {
        self.log('[PCRS] Skipping non-PDF download:', filename);
        item.cancel();
        return;
      }

      DownloadManager.handleDownload(item, self.currentPanelId)
        .then((result) => {
          self.log('[PCRS] Download completed:', filename);

          // Try to find resolver by exact filename first
          let resolver = self.pendingDownloadResolvers.get(filename);

          // If not found, try pattern-based resolver for current panel
          if (!resolver && self.currentPanelId) {
            const patternKey = `pending_${self.currentPanelId}`;
            resolver = self.pendingDownloadResolvers.get(patternKey);
            if (resolver) {
              self.log('[PCRS] Found pattern resolver for panel:', self.currentPanelId);
            }
          }

          if (resolver) {
            self.log('[PCRS] Resolving download for:', filename);
            resolver.resolve(result);
          } else {
            self.log('[PCRS] WARNING: No resolver found for:', filename);
            self.log('[PCRS] Available resolvers:', Array.from(self.pendingDownloadResolvers.keys()));
          }
        })
        .catch((error) => {
          self.log('[PCRS] Download failed:', `${filename} - ${error.message}`);

          // Try to find and reject the resolver
          let resolver = self.pendingDownloadResolvers.get(filename);
          if (!resolver && self.currentPanelId) {
            resolver = self.pendingDownloadResolvers.get(`pending_${self.currentPanelId}`);
          }
          if (resolver) {
            resolver.reject(error);
          }
        });
    });

    this.downloadListenerRegistered = true;
    this.log('[PCRS] Download handler registered');
  }

  /**
   * Create and configure the BrowserView
   * @param {Session} pcrsSession - Electron session to use
   */
  createBrowserView(pcrsSession) {
    // Clean up existing view if any
    if (this.browserView) {
      this.close();
    }

    console.log('[PCRS Automation] Creating BrowserView...');

    this.browserView = new BrowserView({
      webPreferences: {
        session: pcrsSession,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    });

    // Attach to main window using addBrowserView
    this.mainWindow.addBrowserView(this.browserView);

    // Get window size for positioning
    const [windowWidth, windowHeight] = this.mainWindow.getSize();
    console.log('[PCRS Automation] Window size:', windowWidth, 'x', windowHeight);

    // Position BrowserView in center of window, leaving space for app UI
    const viewWidth = Math.min(900, windowWidth - 100);
    const viewHeight = Math.min(600, windowHeight - 200);
    const initialBounds = {
      x: Math.round((windowWidth - viewWidth) / 2),
      y: 100, // Below header
      width: viewWidth,
      height: viewHeight
    };

    console.log('[PCRS Automation] Setting BrowserView bounds:', initialBounds);
    this.browserView.setBounds(initialBounds);

    // Set background color
    this.browserView.setBackgroundColor('#ffffff');

    // Load login page
    console.log('[PCRS Automation] Loading URL:', PCRS_URLS.LOGIN);
    this.browserView.webContents.loadURL(PCRS_URLS.LOGIN);

    // Monitor page load events
    this.browserView.webContents.on('did-start-loading', () => {
      console.log('[PCRS Automation] Started loading...');
    });

    this.browserView.webContents.on('did-finish-load', async () => {
      const url = this.browserView.webContents.getURL();
      console.log('[PCRS Automation] Page loaded:', url);
      await this.checkLoginStatus(url);
    });

    this.browserView.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('[PCRS Automation] Failed to load:', validatedURL);
      console.error('[PCRS Automation] Error code:', errorCode, '- Description:', errorDescription);

      // Provide user-friendly error messages
      let userMessage = errorDescription;
      if (errorCode === -117 || errorDescription.includes('ERR_BAD_SSL_CLIENT_AUTH_CERT')) {
        userMessage = 'The PCRS portal requires a client SSL certificate. Please ensure your PCRS certificate is installed in your system\'s certificate store. Contact PCRS support if you need to obtain or renew your certificate.';
      } else if (errorCode === -105 || errorDescription.includes('ERR_NAME_NOT_RESOLVED')) {
        userMessage = 'Cannot reach the PCRS portal. Please check your internet connection.';
      } else if (errorCode === -102 || errorDescription.includes('ERR_CONNECTION_REFUSED')) {
        userMessage = 'Connection to PCRS portal was refused. The service may be temporarily unavailable.';
      }

      // Close the BrowserView before showing error so it doesn't obscure the error message
      this.close();
      this.sendStatus('error', { error: userMessage });
    });

    this.browserView.webContents.on('did-navigate', (event, url) => {
      console.log('[PCRS Automation] Navigated to:', url);
    });

    // Handle download events (only register once)
    this.setupDownloadHandler(pcrsSession);

    console.log('[PCRS Automation] BrowserView created and loading URL');
  }

  /**
   * Check if user is logged in after page load
   * @param {string} url - Current page URL
   */
  async checkLoginStatus(url) {
    if (this.isAuthenticated) return;

    try {
      await this.delay(TIMEOUTS.LOGIN_DETECTION);
      const status = await this.browserView.webContents.executeJavaScript(SCRIPTS.CHECK_LOGIN_STATUS);

      console.log('[PCRS Automation] Login check for URL:', url);
      console.log('[PCRS Automation] Login status:', JSON.stringify(status));

      if (status.loggedIn) {
        this.isAuthenticated = true;
        await this.saveSession();
        this.hideBrowserView();
        this.sendStatus('login-success');

        // Notify renderer of auth state change
        this.mainWindow.webContents.send('pcrs:authStateChanged', {
          authenticated: true,
          url: url
        });
      }
    } catch (error) {
      console.error('[PCRS Automation] Login check failed:', error);
    }
  }

  /**
   * Try to restore session from saved cookies
   * @param {Session} pcrsSession - Electron session
   * @returns {Promise<boolean>} Whether session was restored and is valid
   */
  async tryRestoreSession(pcrsSession) {
    try {
      const savedCookies = await SessionManager.loadSession();
      if (!savedCookies || savedCookies.length === 0) {
        console.log('[PCRS Automation] No saved session to restore');
        return false;
      }

      // Restore cookies to session
      for (const cookie of savedCookies) {
        try {
          // Ensure cookie has required fields
          const cookieToSet = {
            url: `https://${cookie.domain || SESSION_CONFIG.COOKIE_DOMAIN}`,
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path || '/',
            secure: cookie.secure !== false,
            httpOnly: cookie.httpOnly !== false
          };

          if (cookie.expirationDate) {
            cookieToSet.expirationDate = cookie.expirationDate;
          }

          await pcrsSession.cookies.set(cookieToSet);
        } catch (e) {
          console.warn('[PCRS Automation] Failed to restore cookie:', cookie.name, e.message);
        }
      }

      console.log('[PCRS Automation] Restored', savedCookies.length, 'cookies, verifying session...');

      // Verify the session is actually valid by testing a protected page
      return await this.verifySession(pcrsSession);
    } catch (error) {
      console.error('[PCRS Automation] Session restore failed:', error);
      return false;
    }
  }

  /**
   * Verify that a session is valid by loading a protected page
   * @param {Session} pcrsSession - Electron session to verify
   * @returns {Promise<boolean>}
   */
  async verifySession(pcrsSession) {
    return new Promise((resolve) => {
      const testView = new BrowserView({
        webPreferences: {
          session: pcrsSession,
          nodeIntegration: false
        }
      });

      const timeout = setTimeout(() => {
        console.log('[PCRS Automation] Session verification timeout');
        testView.webContents.destroy();
        resolve(false);
      }, TIMEOUTS.SESSION_CHECK);

      testView.webContents.on('did-finish-load', async () => {
        clearTimeout(timeout);

        try {
          const status = await testView.webContents.executeJavaScript(SCRIPTS.CHECK_LOGIN_STATUS);
          console.log('[PCRS Automation] Session verification result:', status);
          testView.webContents.destroy();
          resolve(status.loggedIn);
        } catch (error) {
          console.error('[PCRS Automation] Session verification error:', error);
          testView.webContents.destroy();
          resolve(false);
        }
      });

      testView.webContents.on('did-fail-load', () => {
        clearTimeout(timeout);
        console.log('[PCRS Automation] Session verification page failed to load');
        testView.webContents.destroy();
        resolve(false);
      });

      // Load the statements list page (requires auth)
      testView.webContents.loadURL(PCRS_URLS.STATEMENTS_LIST);
    });
  }

  /**
   * Save current session cookies
   */
  async saveSession() {
    try {
      const pcrsSession = session.fromPartition(SESSION_CONFIG.PARTITION_NAME);
      const cookies = await pcrsSession.cookies.get({ domain: SESSION_CONFIG.COOKIE_DOMAIN });

      if (cookies.length > 0) {
        await SessionManager.saveSession(cookies);
        console.log('[PCRS Automation] Session saved:', cookies.length, 'cookies');
      }
    } catch (error) {
      console.error('[PCRS Automation] Failed to save session:', error);
    }
  }

  /**
   * Get available panels (GP practices)
   * @returns {Promise<Object>}
   */
  async getAvailablePanels() {
    if (!this.browserView || !this.isAuthenticated) {
      this.log('[PCRS] getAvailablePanels - Not authenticated');
      return { success: false, error: 'Not authenticated' };
    }

    try {
      // Navigate to switch doctor page
      this.log('[PCRS] Navigating to switch doctor page...');
      await this.navigateTo(PCRS_URLS.SWITCH_DOCTOR);

      // Debug: log current URL and page info
      const currentUrl = this.browserView.webContents.getURL();
      this.log('[PCRS] Switch page URL:', currentUrl);

      // Check if we're actually on the switch page or got redirected
      const pageInfo = await this.browserView.webContents.executeJavaScript(`
        (function() {
          const allLinks = document.querySelectorAll('a');
          const switchLinks = document.querySelectorAll('a[href*="switchDoc"]');
          return {
            title: document.title,
            allLinksCount: allLinks.length,
            switchLinksCount: switchLinks.length,
            bodySnippet: document.body ? document.body.innerText.substring(0, 500) : 'no body'
          };
        })();
      `);
      this.log('[PCRS] Page info:', pageInfo);

      // Extract panels
      const panels = await this.browserView.webContents.executeJavaScript(SCRIPTS.GET_PANELS);
      this.log('[PCRS] Found panels:', panels);

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
            }],
            singlePanel: true
          };
        }
      }

      return { success: true, panels, singlePanel: panels.length === 1 };
    } catch (error) {
      console.error('[PCRS Automation] Failed to get panels:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get available statements for a specific panel
   * This follows the EXACT user navigation flow by CLICKING links rather than direct URL navigation.
   * Clicking links sends proper Referer headers and triggers any JavaScript that sets session state.
   *
   * Flow:
   * 1. Switch panel (click link on switch page)
   * 2. Click "Panel Management" menu link
   * 3. Click "All Listings" link (this has the backLink that establishes context)
   * 4. Click "Itemised Listings" link
   *
   * @param {string} panelId - Panel ID to get statements for
   * @returns {Promise<Object>}
   */
  async getStatementsForPanel(panelId) {
    if (!this.browserView || !this.isAuthenticated) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      // Step 1: Switch panel by clicking the panel link on switch page
      await this.switchToPanelByClick(panelId);

      // Step 2: Click "Panel Management" in the menu (with proper wait)
      this.log('[PCRS] Clicking Panel Management menu link...');
      const panelMgmtClicked = await this.clickAndWaitForNavigation(`
        (function() {
          const links = document.querySelectorAll('a');
          for (const link of links) {
            if (link.textContent.includes('Panel Management') && link.href.includes('/panel')) {
              link.click();
              return { clicked: true, href: link.href };
            }
          }
          return { clicked: false };
        })();
      `);
      this.log('[PCRS] Panel Management click result:', panelMgmtClicked);

      if (!panelMgmtClicked.clicked) {
        this.log('[PCRS] Fallback: navigating directly to Panel Management');
        await this.navigateTo(PCRS_URLS.PANEL_MANAGEMENT);
        await this.waitForNavigation();
      }

      // Step 3: Click "All Listings" link (this is the critical step - has resetUser=true)
      this.log('[PCRS] Looking for All Listings link...');
      const listingsClicked = await this.clickAndWaitForNavigation(`
        (function() {
          const links = document.querySelectorAll('a');
          for (const link of links) {
            const text = link.textContent.trim();
            const href = link.href || '';
            // Look for "All Listings" or link to listings/sec/doctor
            if ((text.includes('All Listings') || text.includes('Listings')) &&
                href.includes('/listings/sec/doctor')) {
              link.click();
              return { clicked: true, href: href, text: text };
            }
          }
          // Also try looking for any link with listings in it
          for (const link of links) {
            if (link.href && link.href.includes('/secure/listings/sec/doctor') &&
                !link.href.includes('/list/')) {
              link.click();
              return { clicked: true, href: link.href, text: link.textContent.trim(), fallback: true };
            }
          }
          return { clicked: false, availableLinks: Array.from(links).slice(0, 20).map(l => ({ text: l.textContent.trim().substring(0, 30), href: l.href })) };
        })();
      `);
      this.log('[PCRS] All Listings click result:', listingsClicked);

      if (!listingsClicked.clicked) {
        this.log('[PCRS] Could not find All Listings link, trying direct navigation with resetUser');
        const listingsWelcomeUrl = `${PCRS_URLS.LISTINGS_WELCOME}?resetUser=true&backLink=/doctor/sec/panel&backLinkDesc=Doctor%20Suite`;
        await this.navigateTo(listingsWelcomeUrl);
        await this.waitForNavigation();
      }

      // Step 4: Click "Itemised Listings" link
      this.log('[PCRS] Looking for Itemised Listings link...');
      const itemisedClicked = await this.clickAndWaitForNavigation(`
        (function() {
          const links = document.querySelectorAll('a');
          for (const link of links) {
            const text = link.textContent.trim();
            const href = link.href || '';
            if ((text.includes('Itemised') || text.includes('itemised')) &&
                href.includes('/list/itemised')) {
              link.click();
              return { clicked: true, href: href, text: text };
            }
          }
          return { clicked: false, availableLinks: Array.from(links).slice(0, 20).map(l => ({ text: l.textContent.trim().substring(0, 30), href: l.href })) };
        })();
      `);
      this.log('[PCRS] Itemised Listings click result:', itemisedClicked);

      if (!itemisedClicked.clicked) {
        this.log('[PCRS] Fallback: navigating directly to Itemised Listings');
        await this.navigateTo(PCRS_URLS.STATEMENTS_LIST);
        await this.waitForNavigation();
      }

      // Extract available statements
      const statements = await this.browserView.webContents.executeJavaScript(SCRIPTS.GET_STATEMENTS);
      this.log('[PCRS] Found statements for panel', `${panelId}: ${statements.length} statements`);

      // Verify the statements are for the correct panel by checking the filename
      if (statements.length > 0) {
        const firstFilename = statements[0].filename || '';
        const expectedPanelInFilename = `_${panelId}_`;
        if (!firstFilename.includes(expectedPanelInFilename)) {
          this.log('[PCRS] WARNING: Statements appear to be for wrong panel!');
          this.log('[PCRS] Expected panel:', panelId);
          this.log('[PCRS] Got filename:', firstFilename);

          // Try to extract actual panel from filename and report
          const actualPanelMatch = firstFilename.match(/_(\d+)_statement/);
          if (actualPanelMatch) {
            this.log('[PCRS] Statements are actually for panel:', actualPanelMatch[1]);
          }
        } else {
          this.log('[PCRS] Verified: Statements ARE for the correct panel:', panelId);
        }
      }

      return { success: true, statements, panelId };
    } catch (error) {
      console.error('[PCRS Automation] Failed to get statements:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Click a link and wait for navigation to complete
   * IMPORTANT: Sets up the listener BEFORE clicking to avoid race conditions
   * @param {string} clickScript - JavaScript to execute that clicks and returns result
   * @returns {Promise<Object>} The click result
   */
  async clickAndWaitForNavigation(clickScript) {
    return new Promise(async (resolve) => {
      let clickResult = null;
      let navigationComplete = false;
      let timeoutId = null;

      const onLoad = () => {
        navigationComplete = true;
        if (timeoutId) clearTimeout(timeoutId);
        // Add a small delay after load to ensure page is fully rendered
        setTimeout(() => resolve(clickResult), 300);
      };

      // Set up the listener BEFORE clicking
      this.browserView.webContents.once('did-finish-load', onLoad);

      // Set up timeout
      timeoutId = setTimeout(() => {
        this.browserView.webContents.removeListener('did-finish-load', onLoad);
        this.log('[PCRS] Navigation timeout, continuing anyway');
        resolve(clickResult);
      }, TIMEOUTS.NAVIGATION);

      // Now execute the click
      try {
        clickResult = await this.browserView.webContents.executeJavaScript(clickScript);
      } catch (error) {
        this.log('[PCRS] Click script error:', error.message);
        clickResult = { clicked: false, error: error.message };
      }

      // If click didn't trigger navigation (nothing was clicked), resolve immediately
      if (clickResult && !clickResult.clicked) {
        clearTimeout(timeoutId);
        this.browserView.webContents.removeListener('did-finish-load', onLoad);
        resolve(clickResult);
      }
    });
  }

  /**
   * Wait for navigation to complete (use after direct navigateTo calls)
   * @returns {Promise<void>}
   */
  waitForNavigation() {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.browserView.webContents.removeListener('did-finish-load', onLoad);
        resolve(); // Resolve anyway after timeout
      }, TIMEOUTS.NAVIGATION);

      const onLoad = () => {
        clearTimeout(timeout);
        // Add a small delay after load to ensure page is fully rendered
        setTimeout(resolve, 300);
      };

      this.browserView.webContents.once('did-finish-load', onLoad);
    });
  }

  /**
   * Switch to a specific panel by clicking the link on the switch page
   * This ensures proper Referer headers and session handling
   * @param {string} panelId - Panel ID to switch to
   */
  async switchToPanelByClick(panelId) {
    this.log('[PCRS] Switching to panel by click:', `${panelId} (current: ${this.currentPanelId})`);

    // First navigate to the switch doctor page and wait for it to load
    await this.navigateTo(PCRS_URLS.SWITCH_DOCTOR);
    await this.waitForNavigation();
    await this.delay(300);

    // Click the panel link with proper wait
    const clicked = await this.clickAndWaitForNavigation(`
      (function() {
        const link = document.querySelector('a[href*="switchDoc?docNum=${panelId}"]');
        if (link) {
          link.click();
          return { clicked: true, href: link.href };
        }
        return { clicked: false };
      })();
    `);
    this.log('[PCRS] Panel switch click result:', clicked);

    if (!clicked.clicked) {
      // Fallback to direct navigation
      this.log('[PCRS] Fallback: navigating directly to switch URL');
      const switchUrl = buildPanelSwitchUrl(panelId);
      await this.navigateTo(switchUrl);
      await this.waitForNavigation();
    }

    // Verify the switch
    const pageCheck = await this.browserView.webContents.executeJavaScript(`
      (function() {
        const bodyText = document.body ? document.body.innerText : '';
        const actingForMatch = bodyText.match(/Acting for doctor (\\d+)/);
        return {
          actingFor: actingForMatch ? actingForMatch[1] : null,
          url: window.location.href,
          title: document.title
        };
      })();
    `);
    this.log('[PCRS] After switch, page shows:', pageCheck);

    // If switch didn't work, try again with a longer wait
    if (!pageCheck.actingFor || pageCheck.actingFor !== panelId) {
      this.log('[PCRS] Switch may have failed, retrying...');
      await this.delay(1000);
      const switchUrl = buildPanelSwitchUrl(panelId);
      await this.navigateTo(switchUrl);
      await this.waitForNavigation();
      await this.delay(500);

      // Verify again
      const retryCheck = await this.browserView.webContents.executeJavaScript(`
        (function() {
          const bodyText = document.body ? document.body.innerText : '';
          const actingForMatch = bodyText.match(/Acting for doctor (\\d+)/);
          return {
            actingFor: actingForMatch ? actingForMatch[1] : null,
            url: window.location.href,
            title: document.title
          };
        })();
      `);
      this.log('[PCRS] Retry switch result:', retryCheck);
    }

    this.currentPanelId = panelId;
    this.log('[PCRS] Switched to panel:', panelId);
  }

  /**
   * Switch to a specific panel by navigating directly to the switch URL
   * @param {string} panelId - Panel ID to switch to
   */
  async switchToPanel(panelId) {
    this.log('[PCRS] Switching to panel:', `${panelId} (current: ${this.currentPanelId})`);

    // Navigate directly to the switch URL - this is more reliable than clicking
    const switchUrl = buildPanelSwitchUrl(panelId);
    this.log('[PCRS] Navigating to switch URL:', switchUrl);
    await this.navigateTo(switchUrl);

    // Wait for session to update
    await this.delay(1000);

    // Verify the switch by checking the page header
    const pageCheck = await this.browserView.webContents.executeJavaScript(`
      (function() {
        const bodyText = document.body ? document.body.innerText : '';
        const actingForMatch = bodyText.match(/Acting for doctor (\\d+)/);
        return {
          actingFor: actingForMatch ? actingForMatch[1] : null,
          url: window.location.href,
          title: document.title
        };
      })();
    `);
    this.log('[PCRS] After switch, page shows:', pageCheck);

    // Verify we're acting as the correct panel
    if (pageCheck.actingFor && pageCheck.actingFor !== panelId) {
      this.log('[PCRS] WARNING: Switch may have failed! Acting for:', pageCheck.actingFor, 'but wanted:', panelId);

      // Try clicking the link as fallback
      await this.navigateTo(PCRS_URLS.SWITCH_DOCTOR);
      await this.delay(500);

      const clicked = await this.browserView.webContents.executeJavaScript(`
        (function() {
          const link = document.querySelector('a[href*="switchDoc?docNum=${panelId}"]');
          if (link) {
            link.click();
            return true;
          }
          return false;
        })();
      `);

      if (clicked) {
        await this.delay(2000); // Extra delay for click-based switch
        this.log('[PCRS] Retried switch by clicking link');
      }
    }

    this.currentPanelId = panelId;
    this.log('[PCRS] Switched to panel:', panelId);
  }

  /**
   * Download statements for selected panels
   * @param {Array} panels - Array of panel objects to download for
   * @param {Array} months - Array of months to download ('latest' or YYYYMM format)
   * @param {boolean} backgroundMode - Whether this is a background download (for Finn notifications)
   * @returns {Promise<Object>}
   */
  async downloadStatements(panels, months = ['latest'], backgroundMode = false) {
    if (!this.browserView || !this.isAuthenticated) {
      const error = 'Not authenticated';
      if (backgroundMode) {
        this.sendStatus('error', { message: error });
      }
      return { success: false, error };
    }

    const results = [];
    const downloadedFiles = [];

    // Calculate total downloads for progress tracking
    // (we'll refine this as we discover actual statement counts)
    let totalDownloads = panels.length; // Estimate: 1 per panel for 'latest'
    let completedDownloads = 0;

    for (const panel of panels) {
      try {
        this.sendStatus('switching-panel', {
          panel: panel.displayName || panel.id,
          panelName: panel.displayName || panel.id,
          completed: completedDownloads,
          total: totalDownloads,
          downloadedFiles
        });

        // Get statements for this panel
        const statementsResult = await this.getStatementsForPanel(panel.id);

        if (!statementsResult.success) {
          results.push({
            panelId: panel.id,
            panelName: panel.displayName || panel.id,
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
          // Build correct filename for THIS panel
          const correctFilename = `${statement.month}_${panel.id}_statement.pdf`;

          this.sendStatus('downloading', {
            panel: panel.displayName || panel.id,
            panelName: panel.displayName || panel.id,
            month: statement.month,
            filename: correctFilename,
            completed: completedDownloads,
            total: totalDownloads,
            downloadedFiles
          });

          try {
            this.log('[PCRS] Downloading for panel', panel.id);
            this.log('[PCRS] Expected filename:', correctFilename);

            // Create a promise that will resolve when download completes
            // We'll accept ANY PDF filename since the server determines the actual name
            const downloadPromise = new Promise((resolve, reject) => {
              // Set a timeout for the download
              const timeout = setTimeout(() => {
                this.log('[PCRS] TIMEOUT waiting for download');
                this.log('[PCRS] Pending resolvers:', Array.from(this.pendingDownloadResolvers.keys()));
                // Clean up the resolver
                for (const key of this.pendingDownloadResolvers.keys()) {
                  if (key.endsWith('_statement.pdf')) {
                    this.pendingDownloadResolvers.delete(key);
                  }
                }
                reject(new Error('Download timeout'));
              }, TIMEOUTS.DOWNLOAD || 60000);

              // Use a pattern-based key to match any statement PDF for this panel
              const resolverKey = `pending_${panel.id}`;
              this.pendingDownloadResolvers.set(resolverKey, {
                resolve: (result) => {
                  clearTimeout(timeout);
                  this.pendingDownloadResolvers.delete(resolverKey);
                  resolve(result);
                },
                reject: (error) => {
                  clearTimeout(timeout);
                  this.pendingDownloadResolvers.delete(resolverKey);
                  reject(error);
                }
              });
            });

            // Click the download link on the page (this uses proper session context)
            this.log('[PCRS] Clicking download link for:', statement.filename);
            const clicked = await this.browserView.webContents.executeJavaScript(`
              (function() {
                // Find link containing this statement's filename or month
                const links = document.querySelectorAll('a[href*="view/itemised"]');
                for (const link of links) {
                  const href = link.getAttribute('href');
                  if (href.includes('month=${statement.month}') || link.textContent.includes('${statement.month}')) {
                    link.click();
                    return { clicked: true, href: href };
                  }
                }
                // Fallback: click first statement link
                if (links.length > 0) {
                  links[0].click();
                  return { clicked: true, href: links[0].getAttribute('href'), fallback: true };
                }
                return { clicked: false };
              })();
            `);
            this.log('[PCRS] Click result:', clicked);

            if (!clicked.clicked) {
              throw new Error('Could not find download link on page');
            }

            // Wait for download to complete
            const downloadResult = await downloadPromise;
            await this.delay(TIMEOUTS.BETWEEN_DOWNLOADS);

            const downloadedFile = {
              panelId: panel.id,
              panelName: panel.displayName || panel.id,
              month: statement.month,
              filename: downloadResult.filename || correctFilename,
              path: downloadResult.path,
              success: true
            };
            results.push(downloadedFile);
            downloadedFiles.push(downloadedFile);
            completedDownloads++;

            // Send progress update
            this.sendStatus('downloading', {
              panel: panel.displayName || panel.id,
              panelName: panel.displayName || panel.id,
              completed: completedDownloads,
              total: totalDownloads,
              downloadedFiles
            });
          } catch (downloadError) {
            console.error('[PCRS Automation] Download error:', downloadError);
            if (this.onError) this.onError(downloadError, 'pcrs-download');
            results.push({
              panelId: panel.id,
              panelName: panel.displayName || panel.id,
              month: statement.month,
              success: false,
              error: downloadError.message
            });
          }
        }

      } catch (error) {
        results.push({
          panelId: panel.id,
          panelName: panel.displayName || panel.id,
          success: false,
          error: error.message
        });
      }
    }

    this.sendStatus('complete', {
      results,
      downloadedFiles,
      completed: completedDownloads,
      total: totalDownloads
    });
    return { success: true, results, downloadedFiles };
  }

  /**
   * Navigate to a URL and wait for load
   * @param {string} url - URL to navigate to
   * @returns {Promise<void>}
   */
  navigateTo(url) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Navigation timeout'));
      }, TIMEOUTS.NAVIGATION);

      const onLoad = () => {
        clearTimeout(timeout);
        this.browserView.webContents.removeListener('did-fail-load', onFail);
        resolve();
      };

      const onFail = (event, errorCode, errorDescription) => {
        clearTimeout(timeout);
        this.browserView.webContents.removeListener('did-finish-load', onLoad);
        reject(new Error(`Navigation failed: ${errorDescription}`));
      };

      this.browserView.webContents.once('did-finish-load', onLoad);
      this.browserView.webContents.once('did-fail-load', onFail);

      this.browserView.webContents.loadURL(url);
    });
  }

  /**
   * Utility delay function
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Send status update to renderer
   * @param {string} status - Status code
   * @param {Object} data - Additional data
   */
  sendStatus(status, data = {}) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('pcrs:status', { status, ...data });
    }
  }

  /**
   * Log message to both main process console AND renderer DevTools
   * @param {string} message - Log message
   * @param {any} data - Optional data to log
   */
  log(message, data = null) {
    const fullMessage = data !== null ? `${message} ${typeof data === 'object' ? JSON.stringify(data) : data}` : message;
    console.log(fullMessage);
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('pcrs:log', { message: fullMessage, timestamp: Date.now() });
    }
  }

  /**
   * Hide the BrowserView without destroying it (keeps webContents alive for automation)
   */
  hideBrowserView() {
    if (this.browserView) {
      try {
        this.mainWindow.removeBrowserView(this.browserView);
      } catch (e) {
        // Already removed
      }
      console.log('[PCRS Automation] BrowserView hidden');
    }
  }

  /**
   * Show the BrowserView (re-attach to window)
   */
  showBrowserView() {
    if (this.browserView) {
      this.mainWindow.addBrowserView(this.browserView);
      const [windowWidth, windowHeight] = this.mainWindow.getSize();
      const viewWidth = Math.min(900, windowWidth - 100);
      const viewHeight = Math.min(600, windowHeight - 200);
      this.browserView.setBounds({
        x: Math.round((windowWidth - viewWidth) / 2),
        y: 100,
        width: viewWidth,
        height: viewHeight
      });
      console.log('[PCRS Automation] BrowserView shown');
    }
  }

  /**
   * Set BrowserView bounds
   * @param {Object} bounds - Bounds object {x, y, width, height}
   */
  setBounds(bounds) {
    if (this.browserView) {
      this.browserView.setBounds(bounds);
    }
  }

  /**
   * Close and clean up the BrowserView
   */
  close() {
    if (this.browserView) {
      try {
        this.mainWindow.removeBrowserView(this.browserView);
      } catch (e) {
        // Already removed (hidden)
      }
      this.browserView.webContents.destroy();
      this.browserView = null;
      console.log('[PCRS Automation] BrowserView closed');
    }
    this.isAuthenticated = false;
    this.currentPanelId = null;
  }

  /**
   * Check if currently authenticated
   * @returns {boolean}
   */
  isLoggedIn() {
    return this.isAuthenticated;
  }
}

module.exports = { PCRSAutomation };

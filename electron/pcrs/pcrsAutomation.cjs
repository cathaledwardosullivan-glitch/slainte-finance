/**
 * PCRS Automation Module
 * Manages BrowserView for authentication and automated statement downloads
 */

const { BrowserView, session, ipcMain } = require('electron');
const path = require('path');
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
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.browserView = null;
    this.isAuthenticated = false;
    this.currentPanelId = null;
    this.isInitialized = false;
    this.pendingDownloadResolvers = new Map(); // Track pending download promises

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
   * Set up IPC handlers for renderer communication
   */
  setupIPC() {
    ipcMain.handle('pcrs:start', async (event, options) => {
      await this.ensureInitialized();
      return await this.start(options);
    });

    ipcMain.handle('pcrs:checkSession', async () => {
      await this.ensureInitialized();
      return await SessionManager.getSessionStatus();
    });

    ipcMain.handle('pcrs:clearSession', async () => {
      await this.ensureInitialized();
      await SessionManager.clearSession();
      return { success: true };
    });

    ipcMain.handle('pcrs:getPanels', async () => {
      await this.ensureInitialized();
      return await this.getAvailablePanels();
    });

    ipcMain.handle('pcrs:getStatements', async (event, panelId) => {
      await this.ensureInitialized();
      return await this.getStatementsForPanel(panelId);
    });

    ipcMain.handle('pcrs:downloadStatements', async (event, { panels, months }) => {
      await this.ensureInitialized();
      return await this.downloadStatements(panels, months);
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
        this.sendStatus('session-restored');
        return { status: 'authenticated', needsLogin: false };
      }
    }

    // Create BrowserView for login
    this.createBrowserView(pcrsSession);
    return { status: 'login-required', needsLogin: true };
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

    // Handle download events
    pcrsSession.on('will-download', (event, item, webContents) => {
      const filename = item.getFilename();
      console.log('[PCRS Automation] Download started:', filename);

      // Handle the download and track completion
      DownloadManager.handleDownload(item, this.currentPanelId)
        .then((result) => {
          console.log('[PCRS Automation] Download completed:', filename);
          // Resolve any pending download promise for this filename
          const resolver = this.pendingDownloadResolvers.get(filename);
          if (resolver) {
            resolver.resolve(result);
            this.pendingDownloadResolvers.delete(filename);
          }
        })
        .catch((error) => {
          console.error('[PCRS Automation] Download failed:', filename, error);
          const resolver = this.pendingDownloadResolvers.get(filename);
          if (resolver) {
            resolver.reject(error);
            this.pendingDownloadResolvers.delete(filename);
          }
        });
    });

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

      console.log('[PCRS Automation] Login status:', status);

      if (status.loggedIn) {
        this.isAuthenticated = true;
        await this.saveSession();
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
      return { success: false, error: 'Not authenticated' };
    }

    try {
      // Navigate to switch doctor page
      await this.navigateTo(PCRS_URLS.SWITCH_DOCTOR);

      // Extract panels
      const panels = await this.browserView.webContents.executeJavaScript(SCRIPTS.GET_PANELS);
      console.log('[PCRS Automation] Found', panels.length, 'panels');

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
   * @param {string} panelId - Panel ID to get statements for
   * @returns {Promise<Object>}
   */
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
      console.log('[PCRS Automation] Found', statements.length, 'statements for panel', panelId);

      return { success: true, statements, panelId };
    } catch (error) {
      console.error('[PCRS Automation] Failed to get statements:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Switch to a specific panel
   * @param {string} panelId - Panel ID to switch to
   */
  async switchToPanel(panelId) {
    console.log('[PCRS Automation] Switching to panel:', panelId);
    const switchUrl = buildPanelSwitchUrl(panelId);
    await this.navigateTo(switchUrl);
    this.currentPanelId = panelId;
    await this.delay(TIMEOUTS.PANEL_SWITCH);
  }

  /**
   * Download statements for selected panels
   * @param {Array} panels - Array of panel objects to download for
   * @param {Array} months - Array of months to download ('latest' or YYYYMM format)
   * @returns {Promise<Object>}
   */
  async downloadStatements(panels, months = ['latest']) {
    if (!this.browserView || !this.isAuthenticated) {
      return { success: false, error: 'Not authenticated' };
    }

    const results = [];

    for (const panel of panels) {
      try {
        this.sendStatus('switching-panel', { panel: panel.displayName || panel.id });

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
          this.sendStatus('downloading', {
            panel: panel.displayName || panel.id,
            month: statement.month,
            filename: statement.filename
          });

          try {
            const downloadUrl = `${PCRS_URLS.BASE}${statement.downloadUrl}`;
            console.log('[PCRS Automation] Downloading:', downloadUrl);

            // Create a promise that will resolve when download completes
            const downloadPromise = new Promise((resolve, reject) => {
              // Set a timeout for the download
              const timeout = setTimeout(() => {
                this.pendingDownloadResolvers.delete(statement.filename);
                reject(new Error('Download timeout'));
              }, TIMEOUTS.DOWNLOAD || 60000);

              this.pendingDownloadResolvers.set(statement.filename, {
                resolve: (result) => {
                  clearTimeout(timeout);
                  resolve(result);
                },
                reject: (error) => {
                  clearTimeout(timeout);
                  reject(error);
                }
              });
            });

            // Trigger download using downloadURL (not loadURL!)
            this.browserView.webContents.downloadURL(downloadUrl);

            // Wait for download to complete
            const downloadResult = await downloadPromise;
            await this.delay(TIMEOUTS.BETWEEN_DOWNLOADS);

            results.push({
              panelId: panel.id,
              panelName: panel.displayName || panel.id,
              month: statement.month,
              filename: downloadResult.filename || statement.filename,
              path: downloadResult.path,
              success: true
            });
          } catch (downloadError) {
            console.error('[PCRS Automation] Download error:', downloadError);
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

    this.sendStatus('complete', { results });
    return { success: true, results };
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
      this.mainWindow.removeBrowserView(this.browserView);
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

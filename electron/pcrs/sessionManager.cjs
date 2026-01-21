/**
 * PCRS Session Manager
 * Handles encrypted storage of session cookies using Electron's safeStorage API
 */

const { safeStorage, app } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const { SESSION_CONFIG } = require('./pcrsConstants.cjs');

class SessionManager {
  constructor() {
    this.sessionFile = null;
    this.initialized = false;
  }

  /**
   * Initialize the session manager (must be called after app is ready)
   */
  init() {
    if (this.initialized) return;
    this.sessionFile = path.join(app.getPath('userData'), SESSION_CONFIG.SESSION_FILE);
    this.initialized = true;
    console.log('[PCRS SessionManager] Initialized, session file:', this.sessionFile);
  }

  /**
   * Check if encryption is available on this system
   * @returns {boolean}
   */
  isEncryptionAvailable() {
    return safeStorage.isEncryptionAvailable();
  }

  /**
   * Save session cookies to encrypted storage
   * @param {Array} cookies - Array of cookie objects from Electron session
   * @returns {Promise<boolean>} Success status
   */
  async saveSession(cookies) {
    if (!this.initialized) {
      console.error('[PCRS SessionManager] Not initialized');
      return false;
    }

    if (!this.isEncryptionAvailable()) {
      console.warn('[PCRS SessionManager] Encryption not available on this system');
      return false;
    }

    try {
      const sessionData = JSON.stringify({
        cookies: cookies,
        savedAt: Date.now(),
        version: 1
      });

      const encrypted = safeStorage.encryptString(sessionData);
      await fs.writeFile(this.sessionFile, encrypted);
      console.log('[PCRS SessionManager] Session saved:', cookies.length, 'cookies');
      return true;
    } catch (error) {
      console.error('[PCRS SessionManager] Save failed:', error);
      return false;
    }
  }

  /**
   * Load session cookies from encrypted storage
   * @returns {Promise<Array|null>} Array of cookies or null if not found/expired
   */
  async loadSession() {
    if (!this.initialized) {
      console.error('[PCRS SessionManager] Not initialized');
      return null;
    }

    try {
      const encrypted = await fs.readFile(this.sessionFile);
      const decrypted = safeStorage.decryptString(encrypted);
      const sessionData = JSON.parse(decrypted);

      // Check session age
      const maxAge = SESSION_CONFIG.MAX_AGE_HOURS * 60 * 60 * 1000;
      const age = Date.now() - sessionData.savedAt;

      if (age > maxAge) {
        console.log('[PCRS SessionManager] Session expired (age:', Math.round(age / 3600000), 'hours)');
        await this.clearSession();
        return null;
      }

      console.log('[PCRS SessionManager] Session loaded:', sessionData.cookies.length, 'cookies, age:', Math.round(age / 60000), 'minutes');
      return sessionData.cookies;
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('[PCRS SessionManager] No session file found');
      } else {
        console.error('[PCRS SessionManager] Load failed:', error.message);
      }
      return null;
    }
  }

  /**
   * Clear the stored session
   * @returns {Promise<void>}
   */
  async clearSession() {
    if (!this.initialized) return;

    try {
      await fs.unlink(this.sessionFile);
      console.log('[PCRS SessionManager] Session cleared');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('[PCRS SessionManager] Clear failed:', error);
      }
    }
  }

  /**
   * Check if a session file exists
   * @returns {Promise<boolean>}
   */
  async hasSession() {
    if (!this.initialized) return false;

    try {
      await fs.access(this.sessionFile);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get session status information
   * @returns {Promise<Object>} Status object with details
   */
  async getSessionStatus() {
    if (!this.initialized) {
      return { exists: false, valid: false, reason: 'not-initialized' };
    }

    try {
      const encrypted = await fs.readFile(this.sessionFile);
      const decrypted = safeStorage.decryptString(encrypted);
      const sessionData = JSON.parse(decrypted);

      const maxAge = SESSION_CONFIG.MAX_AGE_HOURS * 60 * 60 * 1000;
      const age = Date.now() - sessionData.savedAt;
      const remainingMs = maxAge - age;

      if (remainingMs <= 0) {
        return {
          exists: true,
          valid: false,
          reason: 'expired',
          savedAt: sessionData.savedAt,
          expiredAt: sessionData.savedAt + maxAge
        };
      }

      return {
        exists: true,
        valid: true,
        reason: 'valid',
        savedAt: sessionData.savedAt,
        expiresAt: sessionData.savedAt + maxAge,
        remainingHours: Math.round(remainingMs / 3600000 * 10) / 10,
        cookieCount: sessionData.cookies.length
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { exists: false, valid: false, reason: 'no-session' };
      }
      return { exists: false, valid: false, reason: 'error', error: error.message };
    }
  }
}

// Export singleton instance
const sessionManager = new SessionManager();
module.exports = { SessionManager: sessionManager };

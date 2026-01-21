const { app, BrowserWindow, ipcMain, dialog } = require('electron');
// electron-updater is loaded lazily in setupAutoUpdater() to avoid accessing app before ready
let autoUpdater = null;
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// PCRS Automation Module
const { PCRSAutomation } = require('./pcrs/pcrsAutomation.cjs');

// Security: Generate a unique internal token at startup (not hardcoded)
const INTERNAL_TOKEN = crypto.randomBytes(32).toString('hex');

// Configuration
const isDev = process.env.NODE_ENV === 'development';
const API_PORT = 3001;

// ============================================
// SECURE CREDENTIALS MANAGEMENT
// ============================================
// JWT_SECRET and Partner Password are stored in userData, not .env
// This ensures each installation has unique, secure credentials

/**
 * Get the path to the secure credentials file
 */
function getCredentialsPath() {
  // app.getPath('userData') returns the user data directory
  // On Windows: %APPDATA%/slainte-finance
  // On macOS: ~/Library/Application Support/slainte-finance
  // On Linux: ~/.config/slainte-finance
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'secure-credentials.json');
}

/**
 * Load or generate secure credentials
 */
function loadOrGenerateCredentials() {
  const credentialsPath = getCredentialsPath();

  try {
    if (fs.existsSync(credentialsPath)) {
      const data = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
      console.log('[Security] Loaded existing credentials from userData');
      return data;
    }
  } catch (error) {
    console.error('[Security] Error reading credentials file:', error);
  }

  // Generate new JWT_SECRET if none exists
  const newCredentials = {
    jwtSecret: crypto.randomBytes(32).toString('hex'),
    partnerPassword: null, // Will be set during onboarding
    createdAt: new Date().toISOString()
  };

  // Save the new credentials
  try {
    fs.writeFileSync(credentialsPath, JSON.stringify(newCredentials, null, 2));
    console.log('[Security] Generated new JWT secret and saved to userData');
  } catch (error) {
    console.error('[Security] Error saving credentials:', error);
  }

  return newCredentials;
}

/**
 * Update the partner password
 */
function setPartnerPassword(password) {
  const credentialsPath = getCredentialsPath();

  try {
    let credentials = {};
    if (fs.existsSync(credentialsPath)) {
      credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
    }

    credentials.partnerPassword = password;
    credentials.passwordSetAt = new Date().toISOString();

    fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
    console.log('[Security] Partner password updated');
    return true;
  } catch (error) {
    console.error('[Security] Error saving partner password:', error);
    return false;
  }
}

/**
 * Get the partner password
 */
function getPartnerPassword() {
  const credentialsPath = getCredentialsPath();

  try {
    if (fs.existsSync(credentialsPath)) {
      const data = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
      return data.partnerPassword || null;
    }
  } catch (error) {
    console.error('[Security] Error reading partner password:', error);
  }

  return null;
}

/**
 * Check if mobile access is configured
 */
function isMobileAccessConfigured() {
  return getPartnerPassword() !== null;
}

// Load credentials at startup (JWT_SECRET is auto-generated if needed)
const credentials = loadOrGenerateCredentials();
const JWT_SECRET = credentials.jwtSecret;

// ============================================
// LICENSE VALIDATION SYSTEM
// ============================================

const GRACE_PERIOD_DAYS = 7;

/**
 * Get license validation data from secure credentials
 */
function getLicenseValidationData() {
  const credentialsPath = getCredentialsPath();
  try {
    if (fs.existsSync(credentialsPath)) {
      const data = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
      return {
        lastValidation: data.lastLicenseValidation || null,
        status: data.licenseValidationStatus || 'unknown'
      };
    }
  } catch (error) {
    console.error('[License] Error reading validation data:', error);
  }
  return { lastValidation: null, status: 'unknown' };
}

/**
 * Save license validation data to secure credentials
 */
function saveLicenseValidationData(isValid) {
  const credentialsPath = getCredentialsPath();
  try {
    let credentials = {};
    if (fs.existsSync(credentialsPath)) {
      credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
    }

    credentials.lastLicenseValidation = new Date().toISOString();
    credentials.licenseValidationStatus = isValid ? 'valid' : 'invalid';

    fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
    console.log(`[License] Validation recorded: ${isValid ? 'valid' : 'invalid'}`);
    return true;
  } catch (error) {
    console.error('[License] Error saving validation data:', error);
    return false;
  }
}

/**
 * Check if still within grace period
 */
function isWithinGracePeriod() {
  const { lastValidation } = getLicenseValidationData();
  if (!lastValidation) return false;

  const lastDate = new Date(lastValidation);
  const now = new Date();
  const daysDiff = (now - lastDate) / (1000 * 60 * 60 * 24);

  return daysDiff <= GRACE_PERIOD_DAYS;
}

/**
 * Validate license key with minimal API call
 */
async function validateLicenseKey(apiKey) {
  if (!apiKey) return { valid: false, error: 'No license key provided' };

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'x' }]
      })
    });

    if (response.ok) {
      saveLicenseValidationData(true);
      return { valid: true };
    }

    // Key is invalid/revoked
    saveLicenseValidationData(false);
    const errorStatus = response.status;
    let errorMsg = 'License validation failed';
    if (errorStatus === 401) errorMsg = 'License key revoked or invalid';
    else if (errorStatus === 403) errorMsg = 'License key disabled';
    else if (errorStatus === 402) errorMsg = 'License payment required';

    return { valid: false, error: errorMsg };

  } catch (error) {
    console.error('[License] Validation network error:', error);
    // Network error - check grace period
    if (isWithinGracePeriod()) {
      return { valid: true, offline: true, gracePeriod: true };
    }
    return { valid: false, error: 'Unable to validate license (offline)', offline: true };
  }
}

/**
 * Get current license status
 */
function getLicenseStatus(apiKey) {
  if (!apiKey) {
    return { hasKey: false, valid: false, locked: false };
  }

  const { lastValidation, status } = getLicenseValidationData();
  const withinGrace = isWithinGracePeriod();

  return {
    hasKey: true,
    lastValidation,
    status,
    withinGracePeriod: withinGrace,
    locked: status === 'invalid' && !withinGrace
  };
}

// ============================================
// ENCRYPTED BACKUP SYSTEM
// ============================================

const BACKUP_FOLDER = 'backups';
const MAX_BACKUPS = 7;
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

/**
 * Get the backups directory path
 */
function getBackupsPath() {
  const userDataPath = app.getPath('userData');
  const backupsPath = path.join(userDataPath, BACKUP_FOLDER);

  // Create directory if it doesn't exist
  if (!fs.existsSync(backupsPath)) {
    fs.mkdirSync(backupsPath, { recursive: true });
  }

  return backupsPath;
}

/**
 * Get auto-backup settings
 */
function getAutoBackupSettings() {
  const credentialsPath = getCredentialsPath();

  try {
    if (fs.existsSync(credentialsPath)) {
      const data = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
      return {
        enabled: data.autoBackupEnabled || false,
        lastBackup: data.lastBackupDate || null,
        backupCount: data.backupRetention || MAX_BACKUPS
      };
    }
  } catch (error) {
    console.error('[Backup] Error reading auto-backup settings:', error);
  }

  return { enabled: false, lastBackup: null, backupCount: MAX_BACKUPS };
}

/**
 * Save auto-backup settings
 */
function setAutoBackupSettings(settings) {
  const credentialsPath = getCredentialsPath();

  try {
    let credentials = {};
    if (fs.existsSync(credentialsPath)) {
      credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
    }

    if (settings.enabled !== undefined) credentials.autoBackupEnabled = settings.enabled;
    if (settings.lastBackup !== undefined) credentials.lastBackupDate = settings.lastBackup;
    if (settings.backupCount !== undefined) credentials.backupRetention = settings.backupCount;

    fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
    console.log('[Backup] Auto-backup settings updated');
    return true;
  } catch (error) {
    console.error('[Backup] Error saving auto-backup settings:', error);
    return false;
  }
}

/**
 * Derive encryption key from password using PBKDF2
 */
function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
}

/**
 * Encrypt data using AES-256-GCM
 */
function encryptData(data, password) {
  try {
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const key = deriveKey(password, salt);

    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    const jsonData = JSON.stringify(data);

    let encrypted = cipher.update(jsonData, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Combine salt + iv + authTag + encrypted data
    return {
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      data: encrypted,
      version: '1.0'
    };
  } catch (error) {
    console.error('[Backup] Encryption error:', error);
    throw error;
  }
}

/**
 * Decrypt data using AES-256-GCM
 */
function decryptData(encryptedPackage, password) {
  try {
    const salt = Buffer.from(encryptedPackage.salt, 'hex');
    const iv = Buffer.from(encryptedPackage.iv, 'hex');
    const authTag = Buffer.from(encryptedPackage.authTag, 'hex');
    const key = deriveKey(password, salt);

    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedPackage.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (error) {
    console.error('[Backup] Decryption error:', error);
    throw new Error('Decryption failed - incorrect password or corrupted file');
  }
}

/**
 * Gather all app data for backup
 */
function gatherBackupData() {
  const userDataPath = app.getPath('userData');
  const storagePath = path.join(userDataPath, 'localStorage.json');

  try {
    let storageData = {};
    if (fs.existsSync(storagePath)) {
      storageData = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
    }

    // Parse each data type safely
    const safeParse = (data, defaultVal) => {
      if (!data) return defaultVal;
      try {
        return typeof data === 'string' ? JSON.parse(data) : data;
      } catch {
        return defaultVal;
      }
    };

    return {
      version: '2.0',
      appVersion: 'Slainte Finance V2',
      exportDate: new Date().toISOString(),
      backupType: 'encrypted-auto',
      transactions: safeParse(storageData['gp_finance_transactions'], []),
      unidentifiedTransactions: safeParse(storageData['gp_finance_unidentified'], []),
      categoryMapping: safeParse(storageData['gp_finance_category_mapping'], []),
      paymentAnalysisData: safeParse(storageData['gp_finance_payment_analysis'], []),
      savedReports: safeParse(storageData['gp_finance_saved_reports'], []),
      practiceProfile: safeParse(storageData['slainte_practice_profile'], null),
      settings: safeParse(storageData['gp_finance_settings'], {}),
      aiCorrections: safeParse(storageData['slainte_ai_corrections'], {}),
      categoryPreferences: safeParse(storageData['gp_finance_category_preferences'], null)
    };
  } catch (error) {
    console.error('[Backup] Error gathering backup data:', error);
    throw error;
  }
}

/**
 * Clean up old backups, keeping only the most recent N
 */
function cleanupOldBackups(maxBackups = MAX_BACKUPS) {
  const backupsPath = getBackupsPath();

  try {
    const files = fs.readdirSync(backupsPath)
      .filter(f => f.endsWith('.slainte-backup'))
      .map(f => ({
        name: f,
        path: path.join(backupsPath, f),
        time: fs.statSync(path.join(backupsPath, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time); // Newest first

    // Delete files beyond the max
    if (files.length > maxBackups) {
      const toDelete = files.slice(maxBackups);
      toDelete.forEach(file => {
        fs.unlinkSync(file.path);
        console.log(`[Backup] Deleted old backup: ${file.name}`);
      });
    }

    return files.length - Math.min(files.length, maxBackups);
  } catch (error) {
    console.error('[Backup] Error cleaning up old backups:', error);
    return 0;
  }
}

/**
 * Create an encrypted backup
 */
function createEncryptedBackup(password, isAuto = false) {
  if (!password) {
    throw new Error('Password is required for encrypted backup');
  }

  try {
    const backupData = gatherBackupData();
    backupData.backupType = isAuto ? 'encrypted-auto' : 'encrypted-manual';

    const encryptedData = encryptData(backupData, password);

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.slainte-backup`;
    const filepath = path.join(getBackupsPath(), filename);

    // Write encrypted backup
    fs.writeFileSync(filepath, JSON.stringify(encryptedData, null, 2));

    // Update last backup date
    setAutoBackupSettings({ lastBackup: new Date().toISOString() });

    // Clean up old backups
    const settings = getAutoBackupSettings();
    cleanupOldBackups(settings.backupCount);

    console.log(`[Backup] Created encrypted backup: ${filename}`);

    return {
      success: true,
      filename,
      filepath,
      timestamp: backupData.exportDate,
      transactionCount: backupData.transactions?.length || 0
    };
  } catch (error) {
    console.error('[Backup] Error creating encrypted backup:', error);
    throw error;
  }
}

/**
 * List available backups
 */
function listBackups() {
  const backupsPath = getBackupsPath();

  try {
    const files = fs.readdirSync(backupsPath)
      .filter(f => f.endsWith('.slainte-backup'))
      .map(f => {
        const filepath = path.join(backupsPath, f);
        const stats = fs.statSync(filepath);

        // Try to read backup metadata
        let metadata = {};
        try {
          const content = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
          metadata.version = content.version;
        } catch {}

        return {
          filename: f,
          filepath,
          size: stats.size,
          created: stats.mtime.toISOString(),
          ...metadata
        };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created));

    return files;
  } catch (error) {
    console.error('[Backup] Error listing backups:', error);
    return [];
  }
}

/**
 * Restore from encrypted backup
 */
function restoreFromBackup(filepath, password) {
  try {
    const content = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    const decryptedData = decryptData(content, password);

    // Validate decrypted data
    if (!decryptedData.version || !decryptedData.exportDate) {
      throw new Error('Invalid backup file format');
    }

    // Write restored data to localStorage
    const userDataPath = app.getPath('userData');
    const storagePath = path.join(userDataPath, 'localStorage.json');

    let storageData = {};
    if (fs.existsSync(storagePath)) {
      storageData = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
    }

    // Restore each data type
    if (decryptedData.transactions) storageData['gp_finance_transactions'] = JSON.stringify(decryptedData.transactions);
    if (decryptedData.unidentifiedTransactions) storageData['gp_finance_unidentified'] = JSON.stringify(decryptedData.unidentifiedTransactions);
    if (decryptedData.categoryMapping) storageData['gp_finance_category_mapping'] = JSON.stringify(decryptedData.categoryMapping);
    if (decryptedData.paymentAnalysisData) storageData['gp_finance_payment_analysis'] = JSON.stringify(decryptedData.paymentAnalysisData);
    if (decryptedData.savedReports) storageData['gp_finance_saved_reports'] = JSON.stringify(decryptedData.savedReports);
    if (decryptedData.practiceProfile) storageData['slainte_practice_profile'] = JSON.stringify(decryptedData.practiceProfile);
    if (decryptedData.settings) storageData['gp_finance_settings'] = JSON.stringify(decryptedData.settings);
    if (decryptedData.aiCorrections) storageData['slainte_ai_corrections'] = JSON.stringify(decryptedData.aiCorrections);
    if (decryptedData.categoryPreferences) storageData['gp_finance_category_preferences'] = JSON.stringify(decryptedData.categoryPreferences);

    fs.writeFileSync(storagePath, JSON.stringify(storageData, null, 2));

    console.log('[Backup] Successfully restored from backup');

    return {
      success: true,
      backupDate: decryptedData.exportDate,
      transactionCount: decryptedData.transactions?.length || 0,
      unidentifiedCount: decryptedData.unidentifiedTransactions?.length || 0
    };
  } catch (error) {
    console.error('[Backup] Error restoring from backup:', error);
    throw error;
  }
}

// Store reference to main window
let mainWindow = null;

// PCRS Automation instance
let pcrsAutomation = null;

// Express API Server
const expressApp = express();

// Security: Configure CORS to allow localhost and LAN access for mobile
const allowedOrigins = [
  'http://localhost:5173',   // Vite dev server
  'http://localhost:3001',   // API server itself
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3001',
  'app://.'                  // Electron app origin
];

// Add production API URL if configured
if (process.env.VITE_API_URL && !process.env.VITE_API_URL.includes('localhost')) {
  allowedOrigins.push(process.env.VITE_API_URL);
}

expressApp.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like Electron, curl, or same-origin requests)
    if (!origin) return callback(null, true);

    // Allow localhost origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow LAN access (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    // This enables mobile devices on the same network to access the app
    const lanPatterns = [
      /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
      /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
      /^http:\/\/172\.(1[6-9]|2[0-9]|3[01])\.\d{1,3}\.\d{1,3}(:\d+)?$/
    ];

    if (lanPatterns.some(pattern => pattern.test(origin))) {
      console.log(`[CORS] Allowing LAN origin: ${origin}`);
      return callback(null, true);
    }

    console.warn(`[CORS] Blocked request from origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

expressApp.use(express.json({ limit: '50mb' }));

// ============================================
// STATIC FILE SERVING FOR MOBILE/PWA ACCESS
// ============================================
// Serve the built React app for mobile browsers accessing via the API server
// This allows phones to access the full app at http://your-ip:3001/

// Determine the path to the built dist folder
const getDistPath = () => {
  if (isDev) {
    // In development, dist might not exist - mobile should use Vite dev server
    return path.join(__dirname, '..', 'dist');
  } else {
    // In production (packaged app), dist is inside the asar
    return path.join(app.getAppPath(), 'dist');
  }
};

// Serve static files from dist
const distPath = getDistPath();
expressApp.use(express.static(distPath));

// Serve index.html for all non-API routes (SPA fallback)
expressApp.get('*', (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api')) {
    return next();
  }

  const indexPath = path.join(distPath, 'index.html');
  const fs = require('fs');

  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // In development, redirect to Vite dev server
    if (isDev) {
      res.redirect(`http://localhost:5173${req.path}`);
    } else {
      res.status(404).send('App not found. Please ensure the app is built.');
    }
  }
});

// ============================================
// WEBSITE RENDERING HELPER
// ============================================

/**
 * Fetch and render a website using a hidden BrowserWindow
 * This allows JavaScript to execute and content to render before extracting HTML
 */
async function fetchRenderedWebsite(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    let scrapeWindow = null;
    let isResolved = false;

    // Create hidden browser window to load the page
    scrapeWindow = new BrowserWindow({
      width: 1920,
      height: 1080,
      show: false, // Keep hidden
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        javascript: true // Enable JavaScript execution
      }
    });

    // Set timeout to prevent hanging
    const timeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        console.log('[Website Scraper] Timeout reached, extracting HTML anyway');
        extractHTML();
      }
    }, timeoutMs);

    // Function to extract HTML and clean up
    const extractHTML = async () => {
      try {
        const html = await scrapeWindow.webContents.executeJavaScript(
          'document.documentElement.outerHTML'
        );

        clearTimeout(timeout);
        scrapeWindow.close();
        scrapeWindow = null;
        resolve(html);
      } catch (error) {
        clearTimeout(timeout);
        if (scrapeWindow) {
          scrapeWindow.close();
          scrapeWindow = null;
        }
        reject(error);
      }
    };

    // Handle page load completion
    scrapeWindow.webContents.on('did-finish-load', () => {
      // Wait for dynamic content to load
      // Wix sites need extra time for JavaScript to render content
      setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          extractHTML();
        }
      }, 8000); // Wait 8 seconds after page load for dynamic content
    });

    // Handle load failure
    scrapeWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeout);
        scrapeWindow.close();
        scrapeWindow = null;
        reject(new Error(`Failed to load website: ${errorDescription} (${errorCode})`));
      }
    });

    // Start loading the URL
    console.log('[Website Scraper] Loading URL:', url);
    scrapeWindow.loadURL(url).catch((error) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeout);
        if (scrapeWindow) {
          scrapeWindow.close();
          scrapeWindow = null;
        }
        reject(error);
      }
    });
  });
}

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  // Allow internal token for local Electron requests
  // This token is randomly generated at startup and shared via IPC
  if (token === INTERNAL_TOKEN) {
    req.user = { role: 'electron', source: 'local' };
    return next();
  }

  // For mobile/external requests, validate JWT
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

// ============================================
// HELPER FUNCTIONS - LocalStorage Access
// ============================================

/**
 * Get data from Electron localStorage
 * Since localStorage is in the renderer, we'll use IPC or file-based storage
 * For now, we'll read from a JSON file that mirrors localStorage
 */
function getLocalStorageData(key) {
  try {
    const userDataPath = app.getPath('userData');
    const storagePath = path.join(userDataPath, 'localStorage.json');

    if (!fs.existsSync(storagePath)) {
      return null;
    }

    const data = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
    return data[key] || null;
  } catch (error) {
    console.error(`Error reading localStorage key ${key}:`, error);
    return null;
  }
}

/**
 * Save data to localStorage mirror
 */
function setLocalStorageData(key, value) {
  try {
    const userDataPath = app.getPath('userData');
    const storagePath = path.join(userDataPath, 'localStorage.json');

    let data = {};
    if (fs.existsSync(storagePath)) {
      data = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
    }

    data[key] = value;
    fs.writeFileSync(storagePath, JSON.stringify(data, null, 2));

    return true;
  } catch (error) {
    console.error(`Error writing localStorage key ${key}:`, error);
    return false;
  }
}

/**
 * Helper to safely parse JSON with fallback
 */
function safeParse(data, fallback) {
  if (!data) return fallback;

  try {
    const parsed = JSON.parse(data);

    // Check if wrapped format {data: ..., timestamp: ...}
    if (parsed && typeof parsed === 'object' && 'data' in parsed) {
      return parsed.data || fallback;
    }

    return parsed || fallback;
  } catch (error) {
    console.error('JSON parse error:', error);
    return fallback;
  }
}

// ============================================
// API ENDPOINTS
// ============================================

// Health check
expressApp.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Login endpoint - Generate JWT token for partners
expressApp.post('/api/auth/login', (req, res) => {
  const { password } = req.body;

  // Get partner password from secure storage
  const PARTNER_PASSWORD = getPartnerPassword();

  // Reject if mobile access not configured
  if (!PARTNER_PASSWORD) {
    console.log('[Auth] Partner login attempted but mobile access not configured');
    return res.status(503).json({
      success: false,
      error: 'Mobile access not configured. Please set up a Mobile Access Password in the desktop app settings.'
    });
  }

  if (password === PARTNER_PASSWORD) {
    const token = jwt.sign(
      { role: 'partner', timestamp: Date.now() },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, error: 'Invalid password' });
  }
});

// Dashboard summary
expressApp.get('/api/dashboard', authenticateToken, (req, res) => {
  try {
    const transactionsData = getLocalStorageData('gp_finance_transactions');
    const transactions = safeParse(transactionsData, []);

    // Calculate summary
    let income = 0;
    let expenses = 0;

    transactions.forEach(tx => {
      const amount = Math.abs(parseFloat(tx.amount) || 0);
      if (tx.category === 'Income' || tx.type === 'Income') {
        income += amount;
      } else {
        expenses += amount;
      }
    });

    const profit = income - expenses;

    res.json({
      income,
      expenses,
      profit,
      transactionCount: transactions.length,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// Saved reports
expressApp.get('/api/reports', authenticateToken, (req, res) => {
  try {
    const reportsData = getLocalStorageData('gp_finance_saved_reports');
    const reports = safeParse(reportsData, []);

    res.json(reports);
  } catch (error) {
    console.error('Reports error:', error);
    res.status(500).json({ error: 'Failed to load reports' });
  }
});

// GMS Health Check
expressApp.get('/api/gms-health-check', authenticateToken, (req, res) => {
  try {
    const reportsData = getLocalStorageData('gp_finance_saved_reports');
    const reports = safeParse(reportsData, []);

    // Find most recent GMS Health Check report
    const gmsReports = reports.filter(r => r.type === 'gms-health-check');
    const latestReport = gmsReports.sort((a, b) =>
      new Date(b.generatedDate) - new Date(a.generatedDate)
    )[0];

    res.json(latestReport || null);
  } catch (error) {
    console.error('GMS Health Check error:', error);
    res.status(500).json({ error: 'Failed to load GMS Health Check' });
  }
});

// ============================================
// MOBILE SYNC API ENDPOINTS
// ============================================

// Get all transactions
expressApp.get('/api/transactions', authenticateToken, (req, res) => {
  try {
    const transactionsData = getLocalStorageData('gp_finance_transactions');
    const transactions = safeParse(transactionsData, []);

    const unidentifiedData = getLocalStorageData('gp_finance_unidentified');
    const unidentifiedTransactions = safeParse(unidentifiedData, []);

    res.json({
      transactions,
      unidentifiedTransactions,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Transactions error:', error);
    res.status(500).json({ error: 'Failed to load transactions' });
  }
});

// Get full sync data (all localStorage data for mobile)
expressApp.get('/api/sync/data', authenticateToken, (req, res) => {
  try {
    // Gather all relevant localStorage data
    const transactions = safeParse(getLocalStorageData('gp_finance_transactions'), []);
    const unidentifiedTransactions = safeParse(getLocalStorageData('gp_finance_unidentified'), []);
    const categoryMapping = safeParse(getLocalStorageData('gp_finance_category_mapping'), []);
    const paymentAnalysisData = safeParse(getLocalStorageData('gp_finance_payment_analysis'), []);
    const savedReports = safeParse(getLocalStorageData('gp_finance_saved_reports'), []);
    const learnedIdentifiers = safeParse(getLocalStorageData('gp_finance_learned_identifiers'), []);
    const practiceProfile = safeParse(getLocalStorageData('slainte_practice_profile'), null);
    const settings = safeParse(getLocalStorageData('gp_finance_settings'), {});

    res.json({
      success: true,
      data: {
        transactions,
        unidentifiedTransactions,
        categoryMapping,
        paymentAnalysisData,
        savedReports,
        learnedIdentifiers,
        practiceProfile,
        settings
      },
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Sync data error:', error);
    res.status(500).json({ error: 'Failed to load sync data' });
  }
});

// Get payment analysis data
expressApp.get('/api/payment-analysis', authenticateToken, (req, res) => {
  try {
    const paymentData = getLocalStorageData('gp_finance_payment_analysis');
    const data = safeParse(paymentData, []);
    res.json(data);
  } catch (error) {
    console.error('Payment analysis error:', error);
    res.status(500).json({ error: 'Failed to load payment analysis' });
  }
});

// Get category mapping
expressApp.get('/api/categories', authenticateToken, (req, res) => {
  try {
    const categoryData = getLocalStorageData('gp_finance_category_mapping');
    const categories = safeParse(categoryData, []);
    res.json(categories);
  } catch (error) {
    console.error('Categories error:', error);
    res.status(500).json({ error: 'Failed to load categories' });
  }
});

// Website analysis endpoint - Fetches website and analyzes with Claude
expressApp.post('/api/analyze-website', authenticateToken, async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Security: Validate and sanitize URL to prevent SSRF attacks
    let parsedUrl;
    try {
      // Ensure URL has protocol
      const urlWithProtocol = url.startsWith('http') ? url : `https://${url}`;
      parsedUrl = new URL(urlWithProtocol);

      // Only allow HTTP and HTTPS protocols
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return res.status(400).json({ error: 'Only HTTP and HTTPS URLs are allowed' });
      }

      // Block internal/private IP ranges to prevent SSRF
      const hostname = parsedUrl.hostname.toLowerCase();

      // Block localhost and loopback addresses
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
        return res.status(400).json({ error: 'Internal URLs are not allowed' });
      }

      // Block private IP ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
      const ipRegexes = [
        /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
        /^172\.(1[6-9]|2[0-9]|3[01])\.\d{1,3}\.\d{1,3}$/,
        /^192\.168\.\d{1,3}\.\d{1,3}$/,
        /^169\.254\.\d{1,3}\.\d{1,3}$/,  // Link-local
        /^0\.\d{1,3}\.\d{1,3}\.\d{1,3}$/ // 0.0.0.0
      ];

      if (ipRegexes.some(regex => regex.test(hostname))) {
        return res.status(400).json({ error: 'Internal URLs are not allowed' });
      }

      // Must have a valid domain with at least one dot (e.g., example.com)
      if (!hostname.includes('.')) {
        return res.status(400).json({ error: 'Please provide a valid website URL' });
      }

    } catch (urlError) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Get Claude API key
    let apiKey = getLocalStorageData('claude_api_key');
    if (!apiKey && process.env.NODE_ENV === 'development') {
      apiKey = process.env.ANTHROPIC_API_KEY;
    }

    if (!apiKey) {
      return res.status(500).json({ error: 'Claude API key not configured' });
    }

    // Use the sanitized URL
    const sanitizedUrl = parsedUrl.href;
    console.log('[Website Analysis] Fetching and rendering:', sanitizedUrl);

    // Fetch and render the website content (allows JavaScript to execute)
    const html = await fetchRenderedWebsite(sanitizedUrl, 15000); // 15 second timeout
    console.log('[Website Analysis] Rendered HTML length:', html.length, 'characters');

    // Strip HTML tags and clean the text (like V1 does)
    // This gives Claude clean text to analyze instead of raw HTML
    const textContent = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove styles
      .replace(/<[^>]+>/g, ' ') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    // Limit content length
    const maxLength = 40000;
    const truncatedContent = textContent.length > maxLength
      ? textContent.substring(0, maxLength) + '... [content truncated for length]'
      : textContent;

    console.log('[Website Analysis] Cleaned text length:', truncatedContent.length, 'characters');

    // Analyze with Claude
    const analysisPrompt = `I need you to analyze a GP practice website and extract key information for practice setup.

Website URL: ${sanitizedUrl}

Here is the website's text content:

${truncatedContent}

Extract the following information in JSON format:

{
  "success": true,
  "data": {
    "practiceName": "string - The official practice name",
    "locations": ["string array - Full addresses found on the website"],
    "gpNames": ["string array - All GP/doctor names (format: Dr. FirstName LastName)"],
    "services": {
      "gms": boolean (look for mentions of GMS, medical card, public patients),
      "private": boolean (look for private consultations, private fees),
      "methadone": boolean,
      "dsp": boolean (Department of Social Protection, illness benefit),
      "vaccinations": boolean,
      "medserv": boolean (look for mentions of medserv or third-party admin fees),
      "icgp": boolean (Irish College of General Practitioners),
      "medicalCouncil": boolean (Medical Council registration)
    },
    "practiceManagerName": "string or null - If a practice manager is mentioned",
    "notes": "string - Any additional relevant information you found"
  },
  "confidence": "high/medium/low - Your overall confidence in the extracted data",
  "warnings": ["string array - Any issues or uncertainties"]
}

If you cannot find sufficient information, return:
{
  "success": false,
  "error": "Unable to extract sufficient information from website"
}

Return ONLY valid JSON, no additional text before or after the JSON.`;

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 3000,
        messages: [{ role: 'user', content: analysisPrompt }]
      })
    });

    if (!claudeResponse.ok) {
      throw new Error(`Claude API error: ${claudeResponse.status}`);
    }

    const claudeData = await claudeResponse.json();
    res.json(claudeData);

  } catch (error) {
    console.error('[Website Analysis] Error:', error);
    res.status(500).json({
      error: 'Failed to analyze website',
      details: error.message
    });
  }
});

// Chat endpoint - Proxy to Claude API
expressApp.post('/api/chat', authenticateToken, async (req, res) => {
  try {
    const { message, context } = req.body;

    // Get Claude API key from localStorage (user-entered during onboarding)
    // This is more secure than .env which could be accidentally committed
    let apiKey = getLocalStorageData('claude_api_key');

    // Fallback to .env ONLY in development for convenience
    if (!apiKey && process.env.NODE_ENV === 'development') {
      apiKey = process.env.ANTHROPIC_API_KEY;
      console.warn('[API] Using API key from .env (development only). In production, users should enter their key during onboarding.');
    }

    if (!apiKey) {
      return res.status(500).json({
        error: 'Claude API key not configured'
      });
    }

    // Check if message is a full Claude API request (for tools support)
    let claudeRequest;
    try {
      const parsed = JSON.parse(message);
      // If it's a full request with messages array, use it directly
      if (parsed.messages && Array.isArray(parsed.messages)) {
        claudeRequest = parsed;
      } else {
        // Simple message format
        claudeRequest = {
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          messages: [{ role: 'user', content: message }]
        };
      }
    } catch (e) {
      // Not JSON, treat as simple string message
      claudeRequest = {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: message }]
      };
    }

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(claudeRequest)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] Claude API error:', errorText);
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: 'Failed to process chat message',
      details: error.message
    });
  }
});

// Streaming Chat endpoint - Proxy to Claude API with SSE streaming
expressApp.post('/api/chat/stream', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;

    let apiKey = getLocalStorageData('claude_api_key');
    if (!apiKey && process.env.NODE_ENV === 'development') {
      apiKey = process.env.ANTHROPIC_API_KEY;
    }

    if (!apiKey) {
      return res.status(500).json({ error: 'Claude API key not configured' });
    }

    // Parse the request
    let claudeRequest;
    try {
      const parsed = JSON.parse(message);
      if (parsed.messages && Array.isArray(parsed.messages)) {
        claudeRequest = { ...parsed, stream: true };
      } else {
        claudeRequest = {
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          messages: [{ role: 'user', content: message }],
          stream: true
        };
      }
    } catch (e) {
      claudeRequest = {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: message }],
        stream: true
      };
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Call Claude API with streaming
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(claudeRequest)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] Claude API streaming error:', errorText);
      res.write(`data: ${JSON.stringify({ error: `Claude API error: ${response.status}` })}\n\n`);
      res.end();
      return;
    }

    // Stream the response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      // Forward the SSE events directly to the client
      res.write(chunk);
    }

    res.end();

  } catch (error) {
    console.error('Streaming chat error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

// ============================================
// IPC HANDLERS (for renderer -> main communication)
// ============================================

// IPC: Get the internal authentication token for API calls
ipcMain.handle('get-internal-token', async () => {
  return INTERNAL_TOKEN;
});

// IPC: Mobile Access Password management
ipcMain.handle('set-mobile-password', async (event, password) => {
  return setPartnerPassword(password);
});

ipcMain.handle('get-mobile-access-status', async () => {
  return {
    isConfigured: isMobileAccessConfigured(),
    configuredAt: credentials.passwordSetAt || null
  };
});

ipcMain.handle('verify-password', async (event, password) => {
  const storedPassword = getPartnerPassword();
  if (!storedPassword) {
    // No password set - shouldn't happen but allow access
    return { success: true, reason: 'no_password_set' };
  }
  if (password === storedPassword) {
    return { success: true };
  }
  return { success: false, reason: 'invalid_password' };
});

// ============================================
// LICENSE VALIDATION IPC HANDLERS
// ============================================

ipcMain.handle('validate-license', async () => {
  const apiKey = getLocalStorageData('claude_api_key');
  return await validateLicenseKey(apiKey);
});

ipcMain.handle('get-license-status', async () => {
  const apiKey = getLocalStorageData('claude_api_key');
  return getLicenseStatus(apiKey);
});

// ============================================
// BACKUP IPC HANDLERS
// ============================================

ipcMain.handle('get-auto-backup-settings', async () => {
  return getAutoBackupSettings();
});

ipcMain.handle('set-auto-backup-settings', async (event, settings) => {
  return setAutoBackupSettings(settings);
});

ipcMain.handle('list-backups', async () => {
  return listBackups();
});

ipcMain.handle('create-backup', async (event, password) => {
  try {
    const result = createEncryptedBackup(password || getPartnerPassword(), false);
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('restore-backup', async (event, filepath, password) => {
  try {
    const result = restoreFromBackup(filepath, password || getPartnerPassword());
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-backup', async (event, filepath) => {
  try {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      return { success: true };
    }
    return { success: false, error: 'File not found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-backups-folder', async () => {
  return getBackupsPath();
});

ipcMain.handle('get-localStorage', async (event, key) => {
  return getLocalStorageData(key);
});

ipcMain.handle('set-localStorage', async (event, key, value) => {
  return setLocalStorageData(key, value);
});

ipcMain.handle('call-claude', async (event, message, context, options = {}) => {
  try {
    // Get Claude API key from localStorage (user-entered during onboarding)
    let apiKey = getLocalStorageData('claude_api_key');

    // Fallback to .env ONLY in development
    if (!apiKey && process.env.NODE_ENV === 'development') {
      apiKey = process.env.ANTHROPIC_API_KEY;
      console.warn('[IPC] Using API key from .env (development only).');
    }

    if (!apiKey) {
      throw new Error('Claude API key not configured. Please enter your API key in the app settings.');
    }

    // Extract options with defaults
    const {
      model = 'claude-haiku-4-5-20251001',
      maxTokens = 1024,
      temperature = 1.0
    } = options;

    console.log(`[IPC] Making Claude API call with model: ${model}, maxTokens: ${maxTokens}`);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model,
        max_tokens: maxTokens,
        temperature: temperature,
        messages: [
          {
            role: 'user',
            content: message
          }
        ]
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[IPC] Claude API error response:', errorBody);
      throw new Error(`Claude API error: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();
    console.log('[IPC] Claude API call successful');
    return data;

  } catch (error) {
    console.error('[IPC] Claude call error:', error);
    throw error;
  }
});

// ============================================
// AUTO-UPDATER SETUP
// ============================================

// Setup auto-updater - must be called after app is ready
function setupAutoUpdater() {
  // Load electron-updater lazily to avoid accessing app before ready
  const { autoUpdater: updater } = require('electron-updater');
  autoUpdater = updater;

  // Configure auto-updater
  autoUpdater.autoDownload = false; // Don't download automatically, ask user first
  autoUpdater.autoInstallOnAppQuit = true; // Install on quit if downloaded

  // Auto-updater event handlers
  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Update available:', info.version);

    // Notify the renderer process
    if (mainWindow) {
      mainWindow.webContents.send('update-available', {
        version: info.version,
        releaseNotes: info.releaseNotes,
        releaseDate: info.releaseDate
      });
    }

    // Show dialog to user
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `A new version (${info.version}) of Sláinte Finance is available.`,
      detail: 'Would you like to download it now? The update will be installed when you restart the app.',
      buttons: ['Download Now', 'Later'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        console.log('[AutoUpdater] User chose to download update');
        autoUpdater.downloadUpdate();

        // Notify renderer that download started
        if (mainWindow) {
          mainWindow.webContents.send('update-downloading');
        }
      }
    });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[AutoUpdater] No updates available - app is up to date');
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent.toFixed(1)}%`;
    console.log('[AutoUpdater]', logMessage);

    // Send progress to renderer
    if (mainWindow) {
      mainWindow.webContents.send('update-progress', {
        percent: progressObj.percent,
        bytesPerSecond: progressObj.bytesPerSecond,
        transferred: progressObj.transferred,
        total: progressObj.total
      });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Update downloaded:', info.version);

    // Notify renderer
    if (mainWindow) {
      mainWindow.webContents.send('update-downloaded', {
        version: info.version
      });
    }

    // Show dialog to user
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded successfully!',
      detail: `Version ${info.version} has been downloaded. Restart now to install the update. Your data will be preserved.`,
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        console.log('[AutoUpdater] User chose to restart and install');
        autoUpdater.quitAndInstall(false, true);
      }
    });
  });

  autoUpdater.on('error', (error) => {
    console.error('[AutoUpdater] Error:', error);

    // Only show error dialog if it's not a "no update" situation
    if (!error.message.includes('net::ERR') && !error.message.includes('ENOENT')) {
      if (mainWindow) {
        mainWindow.webContents.send('update-error', {
          message: error.message
        });
      }
    }
  });

  console.log('[AutoUpdater] Setup complete');
}

// IPC handler for manual update check
ipcMain.handle('check-for-updates', async () => {
  try {
    console.log('[AutoUpdater] Manual update check requested');
    if (!autoUpdater) {
      return { success: false, error: 'Auto-updater not initialized' };
    }
    const result = await autoUpdater.checkForUpdates();
    return { success: true, updateInfo: result?.updateInfo };
  } catch (error) {
    console.error('[AutoUpdater] Manual check error:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler to get current version
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// IPC handler to install downloaded update
ipcMain.handle('install-update', () => {
  if (autoUpdater) {
    autoUpdater.quitAndInstall(false, true);
  }
});

// ============================================
// ELECTRON WINDOW SETUP
// ============================================

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    icon: path.join(__dirname, '../public/icon-512.png'),
    titleBarStyle: 'default',
    title: 'Sláinte Finance',
    show: false
  });

  // Load app
  if (isDev) {
    console.log('[Electron] Loading development server at http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, use app.getAppPath() which correctly resolves inside the asar
    const appPath = app.getAppPath();
    const indexPath = path.join(appPath, 'dist', 'index.html');
    console.log('[Electron] Loading production build from:', indexPath);
    mainWindow.loadFile(indexPath);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('[Electron] Window shown');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Error handling
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('[Electron] Failed to load:', validatedURL);
    console.error('[Electron] Error:', errorCode, errorDescription);
  });
}

// ============================================
// APP LIFECYCLE
// ============================================

// Handle client certificate selection for PCRS portal
// The PCRS portal requires a valid client SSL certificate
app.on('select-client-certificate', (event, webContents, url, certificateList, callback) => {
  console.log('[Electron] Client certificate requested for:', url);
  console.log('[Electron] Available certificates:', certificateList.length);

  if (certificateList.length > 0) {
    // Log available certificates for debugging
    certificateList.forEach((cert, index) => {
      console.log(`[Electron] Certificate ${index}: ${cert.subjectName} (Issuer: ${cert.issuerName})`);
    });

    // If only one certificate, use it automatically
    if (certificateList.length === 1) {
      console.log('[Electron] Auto-selecting single available certificate');
      event.preventDefault();
      callback(certificateList[0]);
    } else {
      // Let the default certificate selection dialog appear
      // User will be prompted to choose a certificate
      console.log('[Electron] Multiple certificates available - showing selection dialog');
    }
  } else {
    console.warn('[Electron] No client certificates available');
    // Continue without certificate - will likely fail
  }
});

app.whenReady().then(() => {
  // Setup auto-updater (must be done after app is ready)
  setupAutoUpdater();

  // Start Express API server
  const server = expressApp.listen(API_PORT, () => {
    console.log(`[API Server] Running on http://localhost:${API_PORT}`);
    console.log(`[API Server] JWT Secret: ${JWT_SECRET.substring(0, 10)}...`);
  });

  // Create window
  createWindow();

  // Initialize PCRS Automation
  pcrsAutomation = new PCRSAutomation(mainWindow);
  pcrsAutomation.init().then(() => {
    console.log('[PCRS] Automation module initialized');
  }).catch((err) => {
    console.error('[PCRS] Failed to initialize automation:', err);
  });

  // Check for updates after a short delay (only in production)
  if (!isDev) {
    setTimeout(() => {
      console.log('[AutoUpdater] Checking for updates on startup...');
      autoUpdater.checkForUpdates().catch((err) => {
        console.log('[AutoUpdater] Update check failed (this is normal if offline):', err.message);
      });
    }, 3000); // Wait 3 seconds after app starts
  } else {
    console.log('[AutoUpdater] Skipping update check in development mode');
  }

  // License validation on startup (daily check)
  setTimeout(async () => {
    const apiKey = getLocalStorageData('claude_api_key');
    if (apiKey) {
      console.log('[License] Validating license on startup...');
      const result = await validateLicenseKey(apiKey);
      if (result.valid) {
        console.log('[License] License valid' + (result.gracePeriod ? ' (grace period)' : ''));
      } else {
        console.warn('[License] License validation failed:', result.error);
        // Notify renderer about lockout status
        if (mainWindow && !mainWindow.isDestroyed()) {
          const status = getLicenseStatus(apiKey);
          if (status.locked) {
            mainWindow.webContents.send('license-status', { locked: true, error: result.error });
          }
        }
      }
    } else {
      console.log('[License] No license key configured - skipping validation');
    }
  }, 2000); // Wait 2 seconds for app to initialize

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  console.log('[Electron] Shutting down...');

  // Auto-backup on close if enabled
  try {
    const backupSettings = getAutoBackupSettings();
    const password = getPartnerPassword();

    if (backupSettings.enabled && password) {
      console.log('[Backup] Creating auto-backup on app close...');
      const result = createEncryptedBackup(password, true);
      console.log(`[Backup] Auto-backup completed: ${result.filename}`);
    } else if (backupSettings.enabled && !password) {
      console.log('[Backup] Auto-backup enabled but no password set - skipping');
    }
  } catch (error) {
    console.error('[Backup] Auto-backup on close failed:', error);
    // Don't prevent app from closing even if backup fails
  }
});

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('[Electron] Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Electron] Unhandled rejection at:', promise, 'reason:', reason);
});

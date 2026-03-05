/**
 * PCRS Portal Constants
 * Based on investigation of secure.sspcrs.ie portal structure
 */

const PCRS_URLS = {
  BASE: 'https://secure.sspcrs.ie',
  LOGIN: 'https://secure.sspcrs.ie/portal/userAdmin/login',
  SWITCH_DOCTOR: 'https://secure.sspcrs.ie/doctor/sec/switchDoc',
  PANEL_MANAGEMENT: 'https://secure.sspcrs.ie/doctor/sec/panel',
  LISTINGS_WELCOME: 'https://secure.sspcrs.ie/secure/listings/sec/doctor',
  STATEMENTS_LIST: 'https://secure.sspcrs.ie/secure/listings/sec/doctor/list/itemised',
  STATEMENT_DOWNLOAD_BASE: '/secure/listings/sec/doctor/view/itemised'
};

/**
 * Construct a direct download URL for a statement
 * @param {string} year - Year (YYYY format)
 * @param {string} month - Month (YYYYMM format)
 * @param {string} panelId - Panel/doctor number
 * @returns {string} Full download URL
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
 * @param {string} panelId - Panel/doctor number
 * @returns {string} Panel switch URL
 */
function buildPanelSwitchUrl(panelId) {
  return `${PCRS_URLS.SWITCH_DOCTOR}?docNum=${panelId}`;
}

// CSS Selectors for DOM scraping
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

// Regex patterns for parsing
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
  DOWNLOAD: 60000,  // Increased to 60s for slow connections
  PANEL_SWITCH: 5000,
  BETWEEN_DOWNLOADS: 2000,  // Increased to give server time between requests
  LOGIN_DETECTION: 500
};

// Session configuration
const SESSION_CONFIG = {
  PARTITION_NAME: 'persist:pcrs',
  MAX_AGE_HOURS: 24,
  COOKIE_DOMAIN: '.sspcrs.ie',
  SESSION_FILE: 'pcrs-session.enc'
};

/**
 * JavaScript scripts to inject into BrowserView for data extraction
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

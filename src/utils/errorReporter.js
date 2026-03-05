/**
 * Lightweight error reporter for renderer process.
 * Sends sanitised error reports via Electron IPC to Google Form webhook.
 * Fire-and-forget — never throws, never blocks UI.
 */

const recentErrors = new Map();
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Report an error to the error reporting webhook.
 * Deduplicates identical errors within a 5-minute window.
 *
 * @param {Error|string} error - The error to report
 * @param {string} component - Identifier for where the error occurred (e.g. 'bank-parser', 'storage-quota')
 */
export function reportError(error, component) {
  try {
    if (!window.electronAPI?.submitErrorReport) return;

    const errorMessage = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? (error.stack || '') : '';

    // Dedup: skip if same error reported within 5 minutes
    const dedupKey = `${component}:${errorMessage}`;
    const now = Date.now();
    if (recentErrors.has(dedupKey) && (now - recentErrors.get(dedupKey)) < DEDUP_WINDOW_MS) return;
    recentErrors.set(dedupKey, now);

    // Clean old entries
    for (const [k, t] of recentErrors) {
      if (now - t > DEDUP_WINDOW_MS) recentErrors.delete(k);
    }

    // Get practice ID from localStorage
    let practiceId = '';
    try {
      const stored = localStorage.getItem('slainte_practice_profile');
      if (stored) {
        const parsed = JSON.parse(stored);
        practiceId = parsed?.data?.metadata?.practiceId || '';
      }
    } catch { /* ignore */ }

    window.electronAPI.submitErrorReport({
      errorType: component,
      errorMessage: errorMessage.substring(0, 500),
      stackTrace: stack.substring(0, 500),
      appVersion: window.electronAPI?.version || 'unknown',
      os: navigator.userAgent,
      practiceId
    });
    // Fire-and-forget — don't await
  } catch {
    // Never throw from the error reporter
  }
}

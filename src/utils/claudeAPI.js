/**
 * Claude API Helper
 * Handles API calls to Claude in both Electron and PWA/Browser environments
 */

// Configuration - Set this to your Cloudflare Tunnel URL when deployed
const CLOUDFLARE_TUNNEL_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Check if running in Electron
 */
export function isElectron() {
  return typeof window !== 'undefined' && window.electronAPI?.isElectron === true;
}

/**
 * Call Claude API
 * Works in both Electron (direct IPC) and Browser/PWA (HTTP API)
 *
 * @param {string} message - The user's message
 * @param {object} options - Additional options
 * @param {string} options.model - Claude model to use
 * @param {number} options.maxTokens - Max tokens in response
 * @param {string} options.apiKey - API key (only needed in browser mode)
 * @returns {Promise<object>} - Claude API response
 */
export async function callClaude(message, options = {}) {
  const {
    model = 'claude-haiku-4-5-20251001',
    maxTokens = 1024,
    temperature = 1.0,
    apiKey = null,
    context = null
  } = options;

  try {
    if (isElectron()) {
      // Running in Electron - use IPC
      console.log('[Claude API] Calling via Electron IPC with model:', model);

      const response = await window.electronAPI.callClaude(message, context, {
        model,
        maxTokens,
        temperature
      });

      return {
        success: true,
        data: response,
        content: response.content?.[0]?.text || '',
        source: 'electron'
      };

    } else {
      // Running in Browser/PWA - use HTTP API
      console.log('[Claude API] Calling via HTTP API');

      // Get auth token (for mobile PWA accessing desktop API)
      const token = localStorage.getItem('partner_token');

      if (!token) {
        throw new Error('Authentication required. Please log in.');
      }

      const response = await fetch(`${CLOUDFLARE_TUNNEL_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message,
          context
        })
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication expired. Please log in again.');
        }
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        data: data,
        content: data.content?.[0]?.text || '',
        source: 'api'
      };
    }

  } catch (error) {
    console.error('[Claude API] Error:', error);

    return {
      success: false,
      error: error.message,
      source: isElectron() ? 'electron' : 'api'
    };
  }
}

/**
 * Format Claude response for chat UI
 * Extracts text content from Claude API response
 */
export function formatClaudeResponse(response) {
  if (!response.success) {
    return {
      error: true,
      message: response.error || 'Failed to get response'
    };
  }

  return {
    error: false,
    message: response.content,
    raw: response.data
  };
}

/**
 * Check API availability
 * Useful for showing status indicators
 */
export async function checkAPIAvailability() {
  try {
    if (isElectron()) {
      // In Electron, API is always available if app is running
      return { available: true, source: 'electron' };
    } else {
      // In browser, check if API server is reachable
      const response = await fetch(`${CLOUDFLARE_TUNNEL_URL}/api/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return {
        available: response.ok,
        source: 'api',
        status: response.status
      };
    }
  } catch (error) {
    return {
      available: false,
      error: error.message
    };
  }
}

export default {
  callClaude,
  formatClaudeResponse,
  checkAPIAvailability,
  isElectron
};

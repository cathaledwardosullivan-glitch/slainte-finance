/**
 * Claude API Helper
 * Handles API calls to Claude in both Electron and PWA/Browser environments
 */

import { isAIEnabled } from './privacyGate';
import { MODELS } from '../data/modelConfig';
import { isDemoMode, getDemoApiKey } from './demoMode';
import { isLANMode, getAPIBaseURL } from '../hooks/useLANMode';

// Fallback URL for non-LAN browser environments (e.g. local dev)
const DEFAULT_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Get the correct API base URL for the current environment.
 * LAN companion devices use the hub's origin; otherwise use the default.
 */
function getBaseURL() {
  if (isLANMode()) {
    return getAPIBaseURL();
  }
  return DEFAULT_API_URL;
}

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
    model = MODELS.FAST,
    maxTokens = 1024,
    temperature = 1.0,
    apiKey = null,
    context = null
  } = options;

  // Block all external AI calls when Local Only Mode is enabled
  if (!isAIEnabled()) {
    console.log('[Claude API] Blocked: Local Only Mode is enabled');
    return {
      success: false,
      error: 'Local Only Mode is enabled. AI features are unavailable.',
      localOnly: true,
      source: 'blocked'
    };
  }

  try {
    if (isElectron()) {
      // Running in Electron — check if we have a local API key
      const hasLocalKey = await window.electronAPI.getLocalStorage('claude_api_key');

      if (hasLocalKey) {
        // Normal IPC path — local API key available
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
      }

      // No local API key — try hub proxy if this is a connected install
      const hubAddress = localStorage.getItem('connected_practice_address');
      const hubToken = localStorage.getItem('connected_practice_token');

      if (hubAddress && hubToken) {
        console.log('[Claude API] No local key, routing through hub proxy at', hubAddress);
        const hubBaseURL = `http://${hubAddress.includes(':') ? hubAddress : hubAddress + ':3001'}`;

        const response = await fetch(`${hubBaseURL}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${hubToken}`
          },
          body: JSON.stringify({ message, context })
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            throw new Error('Hub connection expired. Go to Settings → Connected Practice to reconnect.');
          }
          throw new Error(`Hub API error: ${response.status}`);
        }

        const data = await response.json();
        return {
          success: true,
          data: data,
          content: data.content?.[0]?.text || '',
          source: 'hub-proxy'
        };
      }

      // Neither local key nor hub connection
      return {
        success: false,
        error: 'No API key configured. Add your own key in Settings, or connect to the practice network.',
        source: 'electron'
      };

    } else if (isDemoMode()) {
      // Offline demo mode — call Claude API directly
      const demoKey = getDemoApiKey();
      if (!demoKey) {
        throw new Error('Demo API key has expired. Please re-enter it.');
      }

      console.log('[Claude API] Direct call (demo mode)');

      const requestBody = {
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [{ role: 'user', content: context ? `${context}\n\n${message}` : message }]
      };

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': demoKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        data: data,
        content: data.content?.[0]?.text || '',
        source: 'demo-direct'
      };

    } else {
      // Running in Browser/PWA - use HTTP API
      console.log('[Claude API] Calling via HTTP API');

      // Get auth token (for mobile PWA accessing desktop API)
      const token = localStorage.getItem('partner_token');

      if (!token) {
        throw new Error('Authentication required. Please log in.');
      }

      const response = await fetch(`${getBaseURL()}/api/chat`, {
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
 * Call Claude API with full request — supports tools, system prompt, messages array.
 * Used by the Finn agentic loop for tool-use conversations.
 *
 * @param {object} request - Full Anthropic API request (model, system, messages, tools, tool_choice, max_tokens)
 * @returns {Promise<object>} - Raw Anthropic API response (content blocks, stop_reason, etc.)
 */
export async function callClaudeWithTools(request) {
  // Block all external AI calls when Local Only Mode is enabled
  if (!isAIEnabled()) {
    console.log('[Claude API] Blocked: Local Only Mode is enabled');
    throw new Error('Local Only Mode is enabled. AI features are unavailable.');
  }

  try {
    if (isElectron()) {
      // Electron desktop — use raw IPC handler
      const hasLocalKey = await window.electronAPI.getLocalStorage('claude_api_key');

      if (hasLocalKey) {
        console.log(`[Claude API] Raw call via Electron IPC, model: ${request.model}, tools: ${request.tools?.length || 0}`);
        return await window.electronAPI.callClaudeRaw(request);
      }

      // No local key — try hub proxy
      const hubAddress = localStorage.getItem('connected_practice_address');
      const hubToken = localStorage.getItem('connected_practice_token');

      if (hubAddress && hubToken) {
        console.log('[Claude API] Raw call via hub proxy at', hubAddress);
        const hubBaseURL = `http://${hubAddress.includes(':') ? hubAddress : hubAddress + ':3001'}`;

        const response = await fetch(`${hubBaseURL}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${hubToken}`
          },
          body: JSON.stringify({ message: JSON.stringify(request) })
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            throw new Error('Hub connection expired. Go to Settings → Connected Practice to reconnect.');
          }
          throw new Error(`Hub API error: ${response.status}`);
        }

        return await response.json();
      }

      throw new Error('No API key configured. Add your own key in Settings, or connect to the practice network.');

    } else if (isDemoMode()) {
      // Offline demo mode — call Claude API directly with client-side key
      const demoKey = getDemoApiKey();
      if (!demoKey) {
        throw new Error('Demo API key has expired. Please re-enter it in the chat panel.');
      }

      console.log(`[Claude API] Direct call (demo mode), model: ${request.model}, tools: ${request.tools?.length || 0}`);

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': demoKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `API error: ${response.status}`);
      }

      return await response.json();

    } else {
      // Browser/PWA — use Express proxy
      const token = localStorage.getItem('partner_token');
      if (!token) throw new Error('Authentication required. Please log in.');

      console.log(`[Claude API] Raw call via HTTP, model: ${request.model}, tools: ${request.tools?.length || 0}`);

      const response = await fetch(`${getBaseURL()}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: JSON.stringify(request) })
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication expired. Please log in again.');
        }
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    }

  } catch (error) {
    console.error('[Claude API] Raw call error:', error);
    throw error;
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
      const response = await fetch(`${getBaseURL()}/api/health`, {
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
  callClaudeWithTools,
  formatClaudeResponse,
  checkAPIAvailability,
  isElectron
};

/**
 * Privacy Gate - Controls whether external AI calls are allowed
 *
 * Reads the localOnlyMode setting from the practice profile.
 * When Local Only Mode is enabled, all external connections are blocked.
 */

const STORAGE_KEY = 'slainte_practice_profile';

/**
 * Check if AI/external calls are enabled (i.e., Local Only Mode is OFF)
 * @returns {boolean} True if external AI calls are allowed
 */
export function isAIEnabled() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return true; // Default to enabled if no profile exists yet

        const profile = JSON.parse(data);
        return profile?.metadata?.localOnlyMode !== true;
    } catch (error) {
        console.error('[PrivacyGate] Error reading local only mode:', error);
        return true; // Default to enabled on error
    }
}

/**
 * Check if Local Only Mode is active
 * @returns {boolean} True if Local Only Mode is enabled
 */
export function isLocalOnly() {
    return !isAIEnabled();
}

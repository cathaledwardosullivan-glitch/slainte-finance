/**
 * Centralized Model Configuration
 *
 * All Claude model IDs used across the application.
 * To upgrade models, change the ID here — all consumers import from this file.
 *
 * IMPORTANT: Keep electron/modelConfig.cjs in sync with this file.
 *
 * Tiers:
 *   FAST      - Quick chat, categorization, tour Q&A (low latency, low cost)
 *   STANDARD  - Reports, GMS analysis, onboarding (balanced quality/cost)
 *   STRATEGIC - Deep advisory, scenario planning (highest quality)
 */

export const MODELS = {
  FAST: 'claude-haiku-4-5',
  STANDARD: 'claude-sonnet-4-6',
  STRATEGIC: 'claude-opus-4-6',
};

export default MODELS;

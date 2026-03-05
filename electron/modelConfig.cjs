/**
 * Centralized Model Configuration (CJS mirror for Electron main process)
 *
 * IMPORTANT: Keep src/data/modelConfig.js in sync with this file.
 *
 * Tiers:
 *   FAST      - Quick chat, categorization, tour Q&A (low latency, low cost)
 *   STANDARD  - Reports, GMS analysis, onboarding (balanced quality/cost)
 *   STRATEGIC - Deep advisory, scenario planning (highest quality)
 */

const MODELS = {
  FAST: 'claude-haiku-4-5',
  STANDARD: 'claude-sonnet-4-6',
  STRATEGIC: 'claude-opus-4-6',
};

module.exports = { MODELS };

import { useState, useEffect, useRef } from 'react';
import { callClaude } from '../utils/claudeAPI';
import { MODELS } from '../data/modelConfig';

const STORAGE_KEY = 'slainte_gms_narratives';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Build a fingerprint from GMS metrics so we regenerate when data changes.
 */
const buildFingerprint = (metrics) => {
  if (!metrics) return null;
  return JSON.stringify({
    totalActual: Math.round(metrics.totalActual || 0),
    totalPotential: Math.round(metrics.totalPotential || 0),
    readyCount: metrics.readyCount || 0,
    analyzableCount: metrics.analyzableCount || 0
  });
};

/**
 * Check if cached narratives are still valid.
 */
const getCachedNarratives = (fingerprint) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (cached.fingerprint !== fingerprint) return null;
    if (Date.now() - cached.timestamp > CACHE_TTL) return null;
    return cached.narratives;
  } catch {
    return null;
  }
};

/**
 * Save narratives to cache.
 */
const saveCachedNarratives = (narratives, fingerprint) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      narratives,
      fingerprint,
      timestamp: Date.now()
    }));
  } catch {
    // localStorage full or unavailable — ignore
  }
};

/**
 * Build the prompt from GMS area metrics.
 */
const buildPrompt = (metrics) => {
  const { areas, totalActual, totalPotential } = metrics;
  const totalOpportunity = (totalPotential || 0) - (totalActual || 0);

  const areaLines = Object.entries(areas || {}).map(([id, a]) => {
    const opp = Math.max(0, (a.potential || 0) - (a.actual || 0));
    const status = a.status || 'no-data';
    const statusLabel = status === 'ready' ? 'full data' : status === 'partial' ? 'estimated' : 'no data';
    return `${id.toUpperCase()}: actual €${Math.round(a.actual || 0).toLocaleString()}, potential €${Math.round(a.potential || 0).toLocaleString()}, opportunity €${Math.round(opp).toLocaleString()} (${statusLabel})`;
  }).join('\n');

  return `You are a financial analyst for an Irish GP practice reviewing their GMS Health Check results. Given these metrics, write insights in the exact format below.

<user_data>
TOTAL: actual €${Math.round(totalActual || 0).toLocaleString()}, potential €${Math.round(totalPotential || 0).toLocaleString()}, total opportunity €${Math.round(totalOpportunity).toLocaleString()}
${areaLines}
</user_data>

Rules:
- Use euro (€) symbol
- Be encouraging but honest
- Write 3 variants for the headline (different angles, max 18 words each)
- Write 1 ACTION-FOCUSED insight per area (6 total, max 18 words each)
- Each area insight MUST be a specific recommended action or next step, NOT a description of the current state
- Good example: "Claim 4 unclaimed study leave days before March 31st deadline to recover €789"
- Good example: "Register 12 unregistered under-6 patients to capture €1,500 additional capitation"
- Bad example: "Practice support fully optimized at €129,460" (this just describes the status — not actionable)
- If no opportunity exists for an area, suggest a monitoring action like "Review quarterly to ensure continued full claiming"

Reply in this exact format with no extra text:
HEADLINE_1: [overall GMS position insight]
HEADLINE_2: [different angle on overall position]
HEADLINE_3: [third angle — could be action-oriented]
LEAVE: [action-focused insight]
PRACTICESUPPORT: [action-focused insight]
CAPITATION: [action-focused insight]
CERVICALCHECK: [action-focused insight]
STC: [action-focused insight]
CDM: [action-focused insight]`;
};

/**
 * Parse the response into a narratives object.
 */
const parseResponse = (text) => {
  if (!text) return null;
  const narratives = {
    headline: [],
    leave: null,
    practiceSupport: null,
    capitation: null,
    cervicalCheck: null,
    stc: null,
    cdm: null
  };

  const AREA_MAP = {
    'HEADLINE': 'headline',
    'LEAVE': 'leave',
    'PRACTICESUPPORT': 'practiceSupport',
    'CAPITATION': 'capitation',
    'CERVICALCHECK': 'cervicalCheck',
    'STC': 'stc',
    'CDM': 'cdm'
  };

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^(HEADLINE_?\d?|LEAVE|PRACTICESUPPORT|CAPITATION|CERVICALCHECK|STC|CDM):\s*(.+)$/i);
    if (match) {
      const rawKey = match[1].replace(/_?\d$/, '').toUpperCase();
      const key = AREA_MAP[rawKey];
      const value = match[2].trim();
      if (key === 'headline') {
        narratives.headline.push(value);
      } else if (key) {
        narratives[key] = value;
      }
    }
  }

  // Need at least 1 headline and 2 area insights
  const areaCount = ['leave', 'practiceSupport', 'capitation', 'cervicalCheck', 'stc', 'cdm']
    .filter(k => narratives[k]).length;
  if (narratives.headline.length === 0 || areaCount < 2) return null;

  // Pad headlines to 3
  while (narratives.headline.length < 3) {
    narratives.headline.push(narratives.headline[0]);
  }

  return narratives;
};

/**
 * useGMSNarratives - Fetches AI-generated one-sentence insights for GMS Health Check cards.
 * Single Haiku call, cached in localStorage for 24 hours or until data changes.
 *
 * @param {object} metrics - { totalActual, totalPotential, readyCount, analyzableCount, areas: { [id]: { actual, potential, status } } }
 * @returns {{ narratives: object|null, isLoading: boolean }}
 */
export const useGMSNarratives = (metrics) => {
  const [narratives, setNarratives] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef(false);

  useEffect(() => {
    abortRef.current = false;

    // Don't call if no analyzable data
    if (!metrics || !metrics.analyzableCount) {
      setNarratives(null);
      return;
    }

    const fingerprint = buildFingerprint(metrics);
    if (!fingerprint) return;

    // Check cache first
    const cached = getCachedNarratives(fingerprint);
    if (cached) {
      setNarratives(cached);
      return;
    }

    // Cache miss — call Haiku
    const fetchNarratives = async () => {
      setIsLoading(true);
      try {
        const prompt = buildPrompt(metrics);
        const result = await callClaude(prompt, {
          model: MODELS.FAST,
          maxTokens: 600,
          temperature: 0.7
        });

        if (abortRef.current) return;

        if (result.success && result.content) {
          const parsed = parseResponse(result.content);
          if (parsed) {
            setNarratives(parsed);
            saveCachedNarratives(parsed, fingerprint);
          }
        }
      } catch {
        // Silently fail — cards will show static text
      } finally {
        if (!abortRef.current) setIsLoading(false);
      }
    };

    fetchNarratives();

    return () => {
      abortRef.current = true;
    };
  }, [metrics]);

  return { narratives, isLoading };
};

export default useGMSNarratives;

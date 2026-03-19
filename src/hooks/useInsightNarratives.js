import { useState, useEffect, useRef } from 'react';
import { callClaude } from '../utils/claudeAPI';
import { MODELS } from '../data/modelConfig';

const STORAGE_KEY = 'slainte_insight_narratives';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Build a fingerprint from the metrics so we regenerate when data changes.
 */
const buildFingerprint = (metrics) => {
  if (!metrics) return null;
  return JSON.stringify({
    income: Math.round(metrics.totalIncome || 0),
    expenses: Math.round(metrics.totalExpenses || 0),
    gms: Math.round(metrics.gmsTotal || 0),
    txCount: metrics.txCount || 0,
    year: metrics.year,
    rolling: metrics.rolling
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
 * Build the prompt from metrics.
 */
const buildPrompt = (metrics) => {
  const { profit, profitMargin, profitChange, topExpenses, gmsTotal, gmsHasData,
    bestMonth, worstMonth, incomeGap, avgIncome, monthlyProfits } = metrics;

  const monthlyStr = (monthlyProfits || [])
    .map(m => `${m.month}: €${Math.round(m.income || 0).toLocaleString()}`)
    .join(', ');

  const expenseStr = (topExpenses || [])
    .map(e => `${e.name} €${Math.round(e.value).toLocaleString()} (${e.percent}%)`)
    .join(', ');

  return `You are a financial analyst for an Irish GP practice. Given these metrics, write exactly 3 different one-sentence insights per category (12 total, max 15 words each). Be specific, reference the data, and suggest action where relevant. Use euro (€). Each variant should offer a different angle or observation.

<user_data>
PROFIT: €${Math.round(profit || 0).toLocaleString()} net profit, ${(profitMargin || 0).toFixed(1)}% margin${profitChange != null ? `, ${profitChange > 0 ? '+' : ''}${profitChange.toFixed(1)}% vs prior year` : ''}. Monthly income: ${monthlyStr || 'N/A'}
EXPENSES: Top categories: ${expenseStr || 'N/A'}
GMS: ${gmsHasData ? `€${Math.round(gmsTotal || 0).toLocaleString()} total PCRS payments` : 'No GMS data available'}
CASHFLOW: Strongest: ${bestMonth || 'N/A'}. Weakest: ${worstMonth || 'N/A'}. Gap: €${Math.round(incomeGap || 0).toLocaleString()}. Avg: €${Math.round(avgIncome || 0).toLocaleString()}/month
</user_data>

Reply in this exact format with no extra text:
PROFIT_1: [insight]
PROFIT_2: [insight]
PROFIT_3: [insight]
EXPENSES_1: [insight]
EXPENSES_2: [insight]
EXPENSES_3: [insight]
GMS_1: [insight]
GMS_2: [insight]
GMS_3: [insight]
CASHFLOW_1: [insight]
CASHFLOW_2: [insight]
CASHFLOW_3: [insight]`;
};

/**
 * Parse the response into a narratives object.
 */
const parseResponse = (text) => {
  if (!text) return null;
  const narratives = { profit: [], expenses: [], gms: [], cashflow: [] };
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^(PROFIT|EXPENSES|GMS|CASHFLOW)_?\d?:\s*(.+)$/i);
    if (match) {
      const key = match[1].toLowerCase();
      const mapped = key === 'cashflow' ? 'cashflow' : key;
      if (narratives[mapped]) {
        narratives[mapped].push(match[2].trim());
      }
    }
  }

  // Check we got at least 2 categories with content
  const populated = Object.values(narratives).filter(arr => arr.length > 0).length;
  if (populated < 2) return null;

  // Pad any short arrays to 3 by repeating the first entry
  for (const key of Object.keys(narratives)) {
    while (narratives[key].length > 0 && narratives[key].length < 3) {
      narratives[key].push(narratives[key][0]);
    }
  }

  return narratives;
};

/**
 * useInsightNarratives - Fetches AI-generated one-sentence insights for dashboard cards.
 * Single Haiku call, cached in localStorage for 24 hours or until data changes.
 *
 * @param {object} metrics - Computed metrics from InsightDashboard
 * @returns {{ narratives: object|null, isLoading: boolean }}
 */
export const useInsightNarratives = (metrics) => {
  const [narratives, setNarratives] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef(false);

  useEffect(() => {
    abortRef.current = false;

    // Don't call if no meaningful data
    if (!metrics || !metrics.txCount) {
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
          maxTokens: 500,
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

export default useInsightNarratives;

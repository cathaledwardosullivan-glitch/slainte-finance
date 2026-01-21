/**
 * GMS Health Check AI Analysis
 * Generates intelligent, nuanced AI summaries of health check findings
 */

import { callClaude } from './claudeAPI';
import { buildInteractiveGMSContext, buildCondensedSummary } from './gmsHealthCheckContext';

/**
 * Generate AI insights for GMS Health Check results
 * Creates a prioritized, pragmatic analysis with actionable recommendations
 *
 * @param {Object} analysisResults - Results from analyzeGMSIncome()
 * @param {Object} formData - Health check form data
 * @param {Object} practiceProfile - Practice profile data
 * @param {Object} recommendations - Results from generateRecommendations()
 * @returns {Promise<Object>} - { success: boolean, summary?: string, error?: string }
 */
export async function generateGMSInsights(analysisResults, formData, practiceProfile, recommendations) {
  if (!analysisResults) {
    return {
      success: false,
      error: 'No analysis data available'
    };
  }

  try {
    // Build the context for the AI
    const fullContext = buildInteractiveGMSContext(
      analysisResults,
      formData,
      practiceProfile,
      recommendations
    );

    // Build condensed summary for quick reference
    const condensedSummary = buildCondensedSummary(analysisResults, practiceProfile, recommendations);

    // Build the prompt
    const prompt = buildAnalysisPrompt(condensedSummary, fullContext);

    // Call Claude API
    const response = await callClaude(prompt, {
      model: 'claude-sonnet-4-20250514',  // Use Sonnet for quality analysis
      maxTokens: 2048,
      temperature: 0.7,  // Some creativity for helpful insights
      context: null  // Context is embedded in prompt
    });

    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Failed to generate AI insights'
      };
    }

    // Extract and clean the response
    const summary = response.content.trim();

    return {
      success: true,
      summary
    };

  } catch (error) {
    console.error('[GMS AI Analysis] Error:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
}

/**
 * Build the analysis prompt for Claude
 * Instructs the AI to provide pragmatic, prioritized recommendations
 */
function buildAnalysisPrompt(condensedSummary, fullContext) {
  return `You are Finn, a pragmatic and knowledgeable financial advisor for Irish GP practices. You've just reviewed a comprehensive GMS Health Check for this practice and need to provide an executive summary.

## Your Personality
- You're friendly but professional
- You're honest and realistic about what's achievable
- You focus on practical, actionable advice
- You understand the realities of running a GP practice in Ireland
- You prioritize effort-to-impact ratio

## Practice Summary
- Practice: ${condensedSummary.practice.name}
- GPs: ${condensedSummary.practice.numGPs}
- Panel Size: ${condensedSummary.practice.panelSize.toLocaleString()} patients
- Patients per GP: ${condensedSummary.practice.patientsPerGP.toLocaleString()}

## Key Figures
- Current Annual GMS Income: ${condensedSummary.totals.current}
- Unclaimed Income (Admin Issues): ${condensedSummary.totals.unclaimed}
- Growth Potential (New Activity): ${condensedSummary.totals.growth}

## Full Analysis Data
${fullContext}

## Your Task
Provide an executive summary that:
1. Gives a realistic assessment of what's achievable (not just the theoretical maximum)
2. Prioritizes the TOP 3 actions by effort-to-impact ratio
3. Identifies anything that should be deprioritized or reconsidered
4. Notes any key caveats or assumptions

## Response Format
Use this exact format with markdown:

**My Assessment**

Brief 2-3 sentence overview of the practice's GMS income situation and the realistic opportunity.

**Top 3 Priority Actions**

1. **[Action Title]** - [Expected Value]
   [Why this is prioritized and practical implementation advice in 1-2 sentences]

2. **[Action Title]** - [Expected Value]
   [Why this is prioritized and practical implementation advice in 1-2 sentences]

3. **[Action Title]** - [Expected Value]
   [Why this is prioritized and practical implementation advice in 1-2 sentences]

**Worth Considering**

- [Medium-term opportunity 1]
- [Medium-term opportunity 2]

**Deprioritize or Reconsider**

- [Item that may not be realistic with explanation]

**Key Caveats**

- [Important assumption or limitation]

---

Keep your response concise but informative. Be specific with figures where possible. Your tone should be pragmatic and encouraging - honest about challenges but positive about achievable improvements.`;
}

/**
 * Parse the AI summary to extract structured sections
 * Useful if you want to display sections separately in the UI
 *
 * @param {string} summary - The raw AI summary text
 * @returns {Object} - Parsed sections { assessment, priorities, worthConsidering, deprioritize, caveats }
 */
export function parseAISummary(summary) {
  if (!summary) return null;

  const sections = {
    assessment: '',
    priorities: [],
    worthConsidering: [],
    deprioritize: [],
    caveats: []
  };

  try {
    // Extract "My Assessment" section
    const assessmentMatch = summary.match(/\*\*My Assessment\*\*\s*([\s\S]*?)(?=\*\*Top 3|$)/i);
    if (assessmentMatch) {
      sections.assessment = assessmentMatch[1].trim();
    }

    // Extract priorities
    const prioritiesMatch = summary.match(/\*\*Top 3 Priority Actions\*\*\s*([\s\S]*?)(?=\*\*Worth Considering|$)/i);
    if (prioritiesMatch) {
      const priorityText = prioritiesMatch[1];
      const priorityItems = priorityText.match(/\d+\.\s*\*\*([^*]+)\*\*\s*-\s*([^\n]+)\n\s*([^\n]+)/g);
      if (priorityItems) {
        sections.priorities = priorityItems.map(item => {
          const match = item.match(/\d+\.\s*\*\*([^*]+)\*\*\s*-\s*([^\n]+)\n\s*(.+)/);
          if (match) {
            return {
              title: match[1].trim(),
              value: match[2].trim(),
              detail: match[3].trim()
            };
          }
          return null;
        }).filter(Boolean);
      }
    }

    // Extract "Worth Considering" items
    const worthMatch = summary.match(/\*\*Worth Considering\*\*\s*([\s\S]*?)(?=\*\*Deprioritize|$)/i);
    if (worthMatch) {
      const items = worthMatch[1].match(/-\s*([^\n]+)/g);
      if (items) {
        sections.worthConsidering = items.map(item => item.replace(/^-\s*/, '').trim());
      }
    }

    // Extract "Deprioritize" items
    const deprioritizeMatch = summary.match(/\*\*Deprioritize[^*]*\*\*\s*([\s\S]*?)(?=\*\*Key Caveats|$)/i);
    if (deprioritizeMatch) {
      const items = deprioritizeMatch[1].match(/-\s*([^\n]+)/g);
      if (items) {
        sections.deprioritize = items.map(item => item.replace(/^-\s*/, '').trim());
      }
    }

    // Extract caveats
    const caveatsMatch = summary.match(/\*\*Key Caveats\*\*\s*([\s\S]*?)(?=---|$)/i);
    if (caveatsMatch) {
      const items = caveatsMatch[1].match(/-\s*([^\n]+)/g);
      if (items) {
        sections.caveats = items.map(item => item.replace(/^-\s*/, '').trim());
      }
    }

  } catch (error) {
    console.error('[GMS AI Analysis] Error parsing summary:', error);
  }

  return sections;
}

export default {
  generateGMSInsights,
  parseAISummary
};

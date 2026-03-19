/**
 * reportCategorizer.js — Keyword-based classifier for custom Finn reports.
 * Assigns custom reports (no suggestedAnalysisId) to an ANALYSIS_CATEGORY
 * by matching title and originalQuestion against category keyword lists.
 */

const CATEGORY_KEYWORDS = {
  overview: ['income source', 'revenue breakdown', 'profit', 'margin', 'overview', 'summary', 'financial health', 'practice health', 'operating cost', 'cost per hour', 'break-even'],
  gms: ['gms', 'pcrs', 'capitation', 'cdm', 'chronic disease', 'cervical', 'stc', 'panel size', 'health check', 'special type'],
  tax: ['tax', 'withholding', 'deduction', 'compliance', 'year-end', 'pension', 'revenue commissioners', 'capital allowance', 'self-assessment'],
  costs: ['expense', 'cost analysis', 'cash flow', 'supplier', 'vendor', 'spending', 'budget', 'seasonal', 'anomaly', 'savings'],
  growth: ['hire', 'hiring', 'staffing', 'growth', 'strategy', 'five year', '5 year', 'revenue per gp', 'outlook', 'expansion', 'productivity']
};

/**
 * Classify a custom report into a category by keyword matching.
 * @param {Object} report - A saved report object
 * @returns {string} categoryId ('overview', 'gms', 'tax', 'costs', 'growth', or 'custom')
 */
export function classifyCustomReport(report) {
  const text = `${report.title || ''} ${report.originalQuestion || ''}`.toLowerCase();

  let bestCategory = 'custom';
  let bestScore = 0;

  for (const [categoryId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = categoryId;
    }
  }

  return bestCategory;
}

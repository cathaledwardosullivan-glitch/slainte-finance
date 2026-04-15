/**
 * Report Theme — Single source of truth for report visual styling.
 *
 * Consumed by:
 *   - ReportContentRenderer (screen rendering)
 *   - artifactBuilder.js (PDF export)
 *   - Future: GMS Health Check v2, P&L v2
 *
 * All values use rem for screen, converted to px for PDF via REPORT_THEME.pdf.
 */
import COLORS from './colors';

const REPORT_THEME = {
  // ── Typography ──────────────────────────────────────────────
  typography: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    // Segoe UI has hinting issues with 'l' glyphs in Windows print contexts — use Calibri as fallback for PDF
    fontFamilyPrint: "Calibri, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    h1: {
      fontSize: '1.5rem',
      fontWeight: 600,
      color: COLORS.slainteBlue,
      marginBottom: '1.5rem',
      paddingBottom: '0.75rem',
      borderBottom: `2px solid ${COLORS.slainteBlue}`,
    },
    h2: {
      fontSize: '1.25rem',
      fontWeight: 600,
      color: COLORS.slainteBlue,
      marginTop: '2rem',
      marginBottom: '1rem',
    },
    h3: {
      fontSize: '1.0625rem',
      fontWeight: 600,
      color: COLORS.textPrimary,
      marginTop: '1.5rem',
      marginBottom: '0.75rem',
    },
    body: {
      fontSize: '0.9375rem',
      lineHeight: 1.7,
      color: COLORS.textPrimary,
    },
    strong: {
      fontWeight: 600,
      color: COLORS.textPrimary,
    },
    caption: {
      fontSize: '0.8125rem',
      color: COLORS.textSecondary,
    },
  },

  // ── Layout ──────────────────────────────────────────────────
  layout: {
    maxWidth: '900px',
    contentPadding: '2rem',
  },

  // ── Callout boxes (intro, conclusion, warning) ──────────────
  callout: {
    borderRadius: '0.5rem',
    padding: '1rem',
    borderLeftWidth: '3px',
    fontSize: '0.9375rem',
    lineHeight: 1.6,
    color: COLORS.textPrimary,
    intro: {
      backgroundColor: `${COLORS.slainteBlue}08`,
      borderLeftColor: COLORS.slainteBlue,
    },
    conclusion: {
      backgroundColor: `${COLORS.incomeColor}08`,
      borderLeftColor: COLORS.incomeColor,
    },
    warning: {
      backgroundColor: `${COLORS.warning}08`,
      borderLeftColor: COLORS.warning,
    },
  },

  // ── Tables ──────────────────────────────────────────────────
  table: {
    fontSize: '0.875rem',
    margin: '1.5rem 0',
    cell: {
      padding: '0.75rem',
      textAlign: 'left',
      border: `1px solid ${COLORS.borderLight}`,
    },
    header: {
      backgroundColor: COLORS.bgPage,
      fontWeight: 600,
    },
    stripeBackground: COLORS.bgPage,
    hoverBackground: COLORS.bgPage,
  },

  // ── Charts (Vega-Lite containers) ───────────────────────────
  chart: {
    container: {
      margin: '1.5rem 0',
      padding: '1rem',
      backgroundColor: COLORS.bgPage,
      borderRadius: '0.5rem',
      border: `1px solid ${COLORS.borderLight}`,
      minHeight: '200px',
    },
    loading: {
      fontSize: '0.875rem',
      color: COLORS.textSecondary,
    },
    error: {
      padding: '1rem',
      backgroundColor: `${COLORS.expenseColor}10`,
      border: `1px solid ${COLORS.expenseColor}30`,
      borderRadius: '0.5rem',
      margin: '1rem 0',
      iconColor: COLORS.expenseColor,
      textColor: COLORS.expenseColor,
      detailColor: COLORS.textSecondary,
      detailFontSize: '0.8125rem',
    },
  },

  // ── Lists ───────────────────────────────────────────────────
  list: {
    marginLeft: '1.5rem',
    marginBottom: '1rem',
    itemMargin: '0.5rem 0',
  },

  // ── Paragraph ───────────────────────────────────────────────
  paragraph: {
    marginBottom: '1rem',
  },

  // ── Code blocks ─────────────────────────────────────────────
  code: {
    backgroundColor: COLORS.bgHover,
    border: `1px solid ${COLORS.borderLight}`,
    borderRadius: '6px',
    padding: '1rem',
    fontSize: '0.8125rem',
    lineHeight: 1.5,
    fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
  },

  // ── Footer / metadata ──────────────────────────────────────
  meta: {
    color: COLORS.textMuted,
    fontSize: '0.875rem',
    marginTop: '2.5rem',
    paddingTop: '1.25rem',
    borderTop: `1px solid ${COLORS.borderLight}`,
  },

  // ── Chart placeholder (PDF only — shown where interactive charts can't render) ──
  chartPlaceholder: {
    border: `2px dashed ${COLORS.slainteBlue}60`,
    borderRadius: '0.5rem',
    padding: '1.5rem',
    margin: '1.25rem 0',
    textAlign: 'center',
    backgroundColor: COLORS.slainteBlueLight,
    titleColor: COLORS.infoText,
    titleFontSize: '1rem',
    noteColor: COLORS.textMuted,
    noteFontSize: '0.8125rem',
  },
};

/**
 * Convert rem theme values to px for PDF print context.
 * 1rem = 16px base.
 */
const remToPx = (rem) => {
  if (typeof rem !== 'string' || !rem.endsWith('rem')) return rem;
  return `${parseFloat(rem) * 16}px`;
};

/**
 * Generate CSS string from theme for use in <style> tags.
 * Used by ReportContentRenderer (screen) and exportArtifactPDF (print).
 *
 * @param {'screen' | 'pdf'} target - Controls unit conversion and minor layout tweaks
 */
export function generateReportCSS(target = 'screen') {
  const t = REPORT_THEME;
  const px = target === 'pdf' ? remToPx : (v) => v;

  return `
    .report-content {
      line-height: ${t.typography.body.lineHeight};
      color: ${t.typography.body.color};
      font-size: ${px(t.typography.body.fontSize)};
      ${target === 'pdf' ? `font-family: ${t.typography.fontFamilyPrint};` : ''}
    }
    .report-content h1 {
      color: ${t.typography.h1.color};
      border-bottom: ${t.typography.h1.borderBottom};
      padding-bottom: ${px(t.typography.h1.paddingBottom)};
      margin-bottom: ${px(t.typography.h1.marginBottom)};
      font-size: ${px(t.typography.h1.fontSize)};
      font-weight: ${t.typography.h1.fontWeight};
    }
    .report-content h2 {
      color: ${t.typography.h2.color};
      margin-top: ${px(t.typography.h2.marginTop)};
      margin-bottom: ${px(t.typography.h2.marginBottom)};
      font-size: ${px(t.typography.h2.fontSize)};
      font-weight: ${t.typography.h2.fontWeight};
    }
    .report-content h3 {
      color: ${t.typography.h3.color};
      margin-top: ${px(t.typography.h3.marginTop)};
      margin-bottom: ${px(t.typography.h3.marginBottom)};
      font-size: ${px(t.typography.h3.fontSize)};
      font-weight: ${t.typography.h3.fontWeight};
    }
    .report-content p {
      margin-bottom: ${px(t.paragraph.marginBottom)};
    }
    .report-content ul, .report-content ol {
      margin-left: ${px(t.list.marginLeft)};
      margin-bottom: ${px(t.list.marginBottom)};
    }
    .report-content li {
      margin: ${t.list.itemMargin};
    }
    .report-content strong {
      font-weight: ${t.typography.strong.fontWeight};
      color: ${t.typography.strong.color};
    }
    .report-content table.artifact-table {
      width: 100%;
      border-collapse: collapse;
      margin: ${px(t.table.margin)};
      font-size: ${px(t.table.fontSize)};
    }
    .report-content table.artifact-table th,
    .report-content table.artifact-table td {
      border: ${t.table.cell.border};
      padding: ${px(t.table.cell.padding)};
      text-align: ${t.table.cell.textAlign};
    }
    .report-content table.artifact-table th {
      background-color: ${t.table.header.backgroundColor};
      font-weight: ${t.table.header.fontWeight};
    }
    .report-content table.artifact-table tr:nth-child(even) {
      background-color: ${t.table.stripeBackground};
    }
    .report-content pre.artifact-code {
      background-color: ${t.code.backgroundColor};
      border: ${t.code.border};
      border-radius: ${t.code.borderRadius};
      padding: ${px(t.code.padding)};
      overflow-x: auto;
      font-size: ${px(t.code.fontSize)};
      line-height: ${t.code.lineHeight};
      margin: 1rem 0;
    }
    .report-content pre.artifact-code code {
      font-family: ${t.code.fontFamily};
    }
    ${target === 'pdf' ? `
    .chart-placeholder {
      border: ${t.chartPlaceholder.border};
      border-radius: ${px(t.chartPlaceholder.borderRadius)};
      padding: ${px(t.chartPlaceholder.padding)};
      margin: ${px(t.chartPlaceholder.margin)};
      text-align: ${t.chartPlaceholder.textAlign};
      background-color: ${t.chartPlaceholder.backgroundColor};
    }
    .chart-placeholder-title {
      font-weight: 600;
      color: ${t.chartPlaceholder.titleColor};
      font-size: ${px(t.chartPlaceholder.titleFontSize)};
      margin-bottom: 4px;
    }
    .chart-placeholder-note {
      color: ${t.chartPlaceholder.noteColor};
      font-size: ${px(t.chartPlaceholder.noteFontSize)};
    }
    .meta {
      color: ${t.meta.color};
      font-size: ${px(t.meta.fontSize)};
      margin-top: ${px(t.meta.marginTop)};
      padding-top: ${px(t.meta.paddingTop)};
      border-top: ${t.meta.borderTop};
    }
    @media print {
      body { margin: 0; padding: 20px; }
    }` : ''}
  `;
}

export default REPORT_THEME;

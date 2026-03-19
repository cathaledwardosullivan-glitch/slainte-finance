// Sláinte Finance Color Palette
// Centralized color definitions for consistent theming across the application
//
// USAGE GUIDE:
//   import COLORS from '../utils/colors';
//   style={{ color: COLORS.textPrimary, background: COLORS.bgPage }}
//
// RULES:
//   1. Never hardcode hex values in components — always reference COLORS
//   2. Use semantic names (success, error, warning) for status — not financial names
//   3. Use financial names (income, expense) only for monetary data
//   4. Use STATUS_COLORS for status-dependent styling (badges, alerts, indicators)

export const COLORS = {
  // ──────────────────────────────────────────────
  // PRIMARY BRAND
  // ──────────────────────────────────────────────
  slainteBlue:      '#4A90E2',  // Primary brand — logo, nav, primary buttons
  slainteBlueDark:  '#3D7BC7',  // Hover/active state for primary
  slainteBlueLight: '#EFF6FF',  // Light tint for info backgrounds

  // ──────────────────────────────────────────────
  // FINANCIAL DATA (income vs expense only)
  // ──────────────────────────────────────────────
  incomeColor:      '#4ECDC4',  // Turquoise — income, positive financial indicators
  incomeColorDark:  '#3AB5AD',  // Hover/active state for income elements
  incomeColorLight: '#E6FAF8',  // Light tint for income backgrounds

  expenseColor:      '#FF6B6B', // Coral — expenses, negative financial indicators
  expenseColorDark:  '#E55A5A', // Hover/active state for expense elements
  expenseColorLight: '#FFE5E5', // Light tint for expense backgrounds

  // ──────────────────────────────────────────────
  // SEMANTIC STATUS (success / error / warning / info)
  // ──────────────────────────────────────────────
  success:        '#10B981',  // Green — completed, positive feedback, confirmations
  successDark:    '#059669',  // Hover/active, strong emphasis
  successLight:   '#ECFDF5',  // Background tint for success alerts/badges
  successLighter: '#D1FAE5',  // Lighter green for borders, badges, soft fills
  successText:    '#065F46',  // Dark green text on success backgrounds

  error:        '#DC2626',    // Red — errors, destructive actions, critical alerts
  errorDark:    '#B91C1C',    // Hover/active for error buttons
  errorLight:   '#FEE2E2',    // Background tint for error alerts/badges
  errorLighter: '#FEF2F2',    // Very light red background
  errorText:    '#991B1B',    // Dark red text on error backgrounds

  warning:        '#F9A826',  // Marigold — warnings, in-progress, attention needed
  warningDark:    '#D97706',  // Hover/active for warning elements
  warningLight:   '#FEF3C7',  // Background tint for warning alerts/badges
  warningLighter: '#FFFBEB',  // Very light warm warning background
  warningText:    '#92400E',  // Dark amber text on warning backgrounds

  info:        '#4A90E2',     // Same as primary — informational states
  infoDark:    '#3D7BC7',     // Alias for primary dark
  infoLight:   '#EFF6FF',     // Alias for primary light tint
  infoLighter: '#DBEAFE',     // Lighter blue for borders, badges
  infoText:    '#1E40AF',     // Dark blue text on info backgrounds

  // ──────────────────────────────────────────────
  // ACCENT COLORS
  // ──────────────────────────────────────────────
  highlightYellow:      '#FFD23C',  // Badges, highlights, important callouts
  highlightYellowLight: '#FFF9E6',  // Background tint for highlighted sections

  accentPurple:      '#7C6EBF',  // Growth/strategy, Dara agent, premium features
  accentPurpleDark:  '#6358A4',  // Hover/active state
  accentPurpleLight: '#F0EDFA',  // Background tint for purple elements


  // ──────────────────────────────────────────────
  // DARA AGENT BRAND
  // ──────────────────────────────────────────────
  daraViolet:       '#7C3AED',                    // Dara agent primary purple
  daraVioletDark:   '#6D28D9',                    // Hover/active state
  daraVioletLight:  'rgba(124, 58, 237, 0.08)',   // Subtle background tint
  daraVioletMedium: 'rgba(124, 58, 237, 0.15)',   // Medium emphasis background
  daraVioletBorder: 'rgba(124, 58, 237, 0.19)',   // Border color

  // ──────────────────────────────────────────────
  // EXTENDED CHART SERIES
  // ──────────────────────────────────────────────
  chartViolet: '#8B5CF6',  // Extended series color
  chartPink:   '#EC4899',  // Extended series color

  // ──────────────────────────────────────────────
  // NEUTRALS
  // ──────────────────────────────────────────────
  textPrimary:   '#1F2937',  // Main text, headings
  textMuted:     '#6B7280',  // Body text, paragraphs (between primary and secondary)
  textSecondary: '#9CA3AF',  // Secondary text, placeholders, icons
  textTertiary:  '#D1D5DB',  // Disabled text, subtle labels

  borderLight: '#E5E7EB',   // Dividers, card borders, input borders
  borderDark:  '#D1D5DB',   // Stronger borders, focused input borders

  bgPage:  '#F8FAFC',       // Page background
  bgCard:  '#FFFFFF',       // Cards, containers, modals
  bgHover: '#F3F4F6',       // Row/item hover states
  white:   '#FFFFFF',       // Explicit white

  // ──────────────────────────────────────────────
  // OVERLAYS & SHADOWS
  // ──────────────────────────────────────────────
  overlayLight:  'rgba(0, 0, 0, 0.25)',  // Light modal backdrop
  overlayMedium: 'rgba(0, 0, 0, 0.40)',  // Standard modal backdrop
  overlayDark:   'rgba(0, 0, 0, 0.50)',  // Heavy modal backdrop
};

// ──────────────────────────────────────────────
// STATUS COLOR MAP
// Use for dynamic status-based styling:
//   const colors = STATUS_COLORS[status]; // 'success' | 'error' | 'warning' | 'info' | 'pending'
//   style={{ color: colors.text, background: colors.bg, borderColor: colors.border }}
// ──────────────────────────────────────────────
export const STATUS_COLORS = {
  success: {
    text:     COLORS.success,
    textOn:   COLORS.successText,    // Text on successLight background
    bg:       COLORS.successLight,
    bgSubtle: COLORS.successLighter,
    border:   COLORS.success,
    dark:     COLORS.successDark,
  },
  completed: { // alias
    text:     COLORS.success,
    textOn:   COLORS.successText,
    bg:       COLORS.successLight,
    bgSubtle: COLORS.successLighter,
    border:   COLORS.success,
    dark:     COLORS.successDark,
  },
  error: {
    text:     COLORS.error,
    textOn:   COLORS.errorText,
    bg:       COLORS.errorLight,
    bgSubtle: COLORS.errorLighter,
    border:   COLORS.error,
    dark:     COLORS.errorDark,
  },
  critical: { // alias
    text:     COLORS.error,
    textOn:   COLORS.errorText,
    bg:       COLORS.errorLight,
    bgSubtle: COLORS.errorLighter,
    border:   COLORS.error,
    dark:     COLORS.errorDark,
  },
  warning: {
    text:     COLORS.warningDark,
    textOn:   COLORS.warningText,
    bg:       COLORS.warningLight,
    bgSubtle: COLORS.warningLighter,
    border:   COLORS.warning,
    dark:     COLORS.warningDark,
  },
  in_progress: { // alias
    text:     COLORS.warningDark,
    textOn:   COLORS.warningText,
    bg:       COLORS.warningLight,
    bgSubtle: COLORS.warningLighter,
    border:   COLORS.warning,
    dark:     COLORS.warningDark,
  },
  info: {
    text:     COLORS.info,
    textOn:   COLORS.infoText,
    bg:       COLORS.infoLight,
    bgSubtle: COLORS.infoLighter,
    border:   COLORS.info,
    dark:     COLORS.infoDark,
  },
  pending: {
    text:     COLORS.textSecondary,
    textOn:   COLORS.textMuted,
    bg:       COLORS.bgHover,
    bgSubtle: COLORS.bgPage,
    border:   COLORS.borderLight,
    dark:     COLORS.textPrimary,
  },
};

// ──────────────────────────────────────────────
// CHART COLORS
// ──────────────────────────────────────────────
export const CHART_COLORS = {
  income:    COLORS.incomeColor,
  expense:   COLORS.expenseColor,
  netProfit: COLORS.slainteBlue,
  highlight: COLORS.highlightYellow,
  series: [
    COLORS.slainteBlue,
    COLORS.incomeColor,
    COLORS.expenseColor,
    COLORS.accentPurple,
    COLORS.warning,
    COLORS.highlightYellow,
    COLORS.chartViolet,
    COLORS.chartPink,
  ],
};

// ──────────────────────────────────────────────
// HELPER FUNCTIONS
// ──────────────────────────────────────────────
export const getIncomeColor = () => COLORS.incomeColor;
export const getExpenseColor = () => COLORS.expenseColor;
export const getPrimaryColor = () => COLORS.slainteBlue;
export const getHighlightColor = () => COLORS.highlightYellow;

/**
 * Get status colors by status string.
 * Falls back to 'pending' for unknown statuses.
 *   const { text, bg, border } = getStatusColors('success');
 */
export const getStatusColors = (status) => {
  return STATUS_COLORS[status] || STATUS_COLORS.pending;
};

export default COLORS;

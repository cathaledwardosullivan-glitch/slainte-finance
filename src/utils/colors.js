// Slainte Finance Color Palette
// Centralized color definitions for consistent theming across the application

export const COLORS = {
  // Primary Brand Colors
  slainteBlue: '#4A90E2',      // Primary brand color - logo, buttons, navigation
  slainteBlueDark: '#3D7BC7',  // Hover states for blue elements

  // Financial Data Colors
  incomeColor: '#4ECDC4',      // Turquoise - for income/positive indicators
  expenseColor: '#FF6B6B',     // Coral red - for expenses/negative indicators

  // Accent Colors
  highlightYellow: '#FFD23C',  // Yellow - for badges, highlights, important callouts

  // Neutral Colors
  darkGray: '#333333',         // Primary text, headings
  mediumGray: '#9B9B9B',       // Secondary text, placeholders
  lightGray: '#E0E0E0',        // Borders, dividers
  backgroundGray: '#FAFAFA',   // Page background
  white: '#FFFFFF'             // Cards, containers
};

// Color Usage Helper Functions
export const getIncomeColor = () => COLORS.incomeColor;
export const getExpenseColor = () => COLORS.expenseColor;
export const getPrimaryColor = () => COLORS.slainteBlue;
export const getHighlightColor = () => COLORS.highlightYellow;

// For chart colors
export const CHART_COLORS = {
  income: COLORS.incomeColor,
  expense: COLORS.expenseColor,
  netProfit: COLORS.slainteBlue,
  highlight: COLORS.highlightYellow
};

export default COLORS;

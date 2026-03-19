# Sláinte Finance — Colour Palette Reference

> **Source of truth:** `src/utils/colors.js`
> **Rule:** Never hardcode hex values in components — always import `COLORS` from `../utils/colors`

---

## Core Palette

Ordered by colour spectrum (reds → oranges → yellows → greens → blues → purples → neutrals).

### Chromatic Colours

| Swatch | Token | Hex | Plain Name | Role | Tier | Used In |
|--------|-------|-----|------------|------|------|---------|
| 🔴 | `error` | `#DC2626` | Crimson Red | Errors, destructive actions, critical alerts | Primary | ActionPlanManager, HealthCheckDataForm, AreaDetailView, AreaTaskPanel, CategoryBreakdowns, HealthCheckReport, PCRSDownloader, ProcessingFlow, FinancialTasksModal, taskUtils, gmsRates |
| 🔴 | `errorDark` | `#B91C1C` | Dark Crimson | Hover/active for error buttons | Secondary | ExportReports, AreaDetailView, PCRSDownloader, ProcessingFlow |
| 🔴 | `errorText` | `#991B1B` | Blood Red | Dark red text on error backgrounds | Secondary | App, CategoryManager, ExportReports, GMSHealthCheckReport, AreaAnalysisPanel, AreaDetailView, AreaTaskPanel, CategoryBreakdowns, HealthCheckReport, PCRSDownloader, Settings sections, TransactionListV2 |
| 🔴 | `errorLight` | `#FEE2E2` | Blush Pink | Background tint for error alerts/badges | Tertiary | ActionPlanManager, CategoryManager, Dashboard, FinancesOverview, AreaDetailView, AreaTaskPanel, CategoryBreakdowns, HealthCheckReport, PCRSDownloader, ProcessingFlow, Settings, FinancialTasksModal, TransactionListV2 |
| 🔴 | `errorLighter` | `#FEF2F2` | Barely Pink | Very light red background | Tertiary | ArtifactViewer, GMSHealthCheckReport, HealthCheckDataForm, AreaDetailView, AreaTaskPanel, CategoryBreakdowns, HealthCheckReport, PersonalTaxReturnForm, FinancialTasksModal |
| 🟠 | `expenseColor` | `#FF6B6B` | Coral | Expenses, negative financial indicators | Primary | Dashboard, CategoryManager, TransactionListV2, TransactionUpload, WithholdingTaxCalculator, AIExpenseCategorization, FinancialChat, LoginScreen, MobileLayout, Settings, Onboarding (many), ProcessingFlow, UnifiedFinnWidget, DaraSupport, PCRSDownloader + 40 more |
| 🟠 | `expenseColorDark` | `#E55A5A` | Dark Coral | Hover/active for expense elements | Secondary | PaymentAnalysis, Reports |
| 🟠 | `expenseColorLight` | `#FFE5E5` | Pale Coral | Light tint for expense backgrounds | Tertiary | ExportReports, GMSHealthCheckReport, HealthCheckDataForm, AreaDetailView, AreaDataCollector, HealthCheckReport, CategoryBreakdowns, TransactionListV2 |
| 🟠 | `warning` | `#F9A826` | Marigold Orange | Warnings, in-progress, attention needed | Primary | ActionPlanManager, Dashboard, DataVisualisation, FinancesOverview, PaymentAnalysis, CircularWorkflow, CategoryBreakdowns, AreaDataCollector, Onboarding, Reports, Settings, TasksWidget, TransactionListV2, DaraSupport, parentCategoryMapping, gmsRates |
| 🟠 | `warningDark` | `#D97706` | Dark Amber | Hover/active for warning elements | Secondary | CategoryManager, ExportReports, GMSHealthCheckReport, AreaAnalysisPanel, AreaDetailView, NewGMSHealthCheck index, PCRSDownloader, ProcessingFlow, Settings, FinancialTasksModal, TransactionListV2 |
| 🟠 | `warningText` | `#92400E` | Burnt Umber | Dark amber text on warning backgrounds | Secondary | App, CategoryManager, ExportReports, GMSHealthCheckReport, AreaDataCollector, AreaDetailView, AreaTaskPanel, CategoryBreakdowns, HealthCheckReport, PCRSDownloader, Settings sections, TransactionListV2 |
| 🟠 | `warningLight` | `#FEF3C7` | Pale Cream | Background tint for warning alerts/badges | Tertiary | CategoryManager, DataVisualisation, GMSHealthCheckReport, AreaDataCollector, CategoryBreakdowns, HealthCheckReport, PaymentAnalysis, PCRSDownloader, ProcessingFlow, Settings, FinancialTasksModal, TransactionListV2 |
| 🟠 | `warningLighter` | `#FFFBEB` | Cream | Very light warm warning background | Tertiary | ExportReports, GMSHealthCheckReport, AreaDataCollector, AreaDetailView, AreaTaskPanel, CategoryBreakdowns, HealthCheckReport, ProcessingFlow, Settings, TransactionListV2 |
| 🟡 | `highlightYellow` | `#FFD23C` | Sunflower Yellow | Badges, highlights, important callouts | Primary | AccountantExport, CategoryManager, DataVisualisation, ExportReports, PaymentAnalysis, Reports, FinancesOverview, BusinessOverview, GMSOverview, Settings, AreaDataCollector, InsightDashboard, parentCategoryMapping, gmsRates |
| 🟡 | `highlightYellowLight` | `#FFF9E6` | Pale Lemon | Background tint for highlighted sections | Tertiary | *Currently unused — available for future use* |
| 🟢 | `success` | `#10B981` | Emerald Green | Completed, positive feedback, confirmations | Primary | CategoryManager, Dashboard, DataVisualisation, FinancesOverview, AreaDataCollector, AreaTaskPanel, CategoryBreakdowns, CircularWorkflow, Onboarding, PCRSDownloader, ProcessingFlow, Settings, FinancialTasksModal, GMSTasksModal, taskUtils, ReportGallery |
| 🟢 | `successDark` | `#059669` | Forest Green | Hover/active, strong emphasis | Secondary | ActionPlanManager, CategoryRefinementWizard, GMSHealthCheckReport, AreaTaskPanel, HealthCheckReport, CategoryBreakdowns, PCRSDownloader, PaymentAnalysis, Settings, FinancialTasksModal, GMSTasksModal |
| 🟢 | `successText` | `#065F46` | Dark Forest | Dark green text on success backgrounds | Secondary | GMSHealthCheckReport, HealthCheckDataForm, AreaDetailView, AreaTaskPanel, CategoryBreakdowns, HealthCheckReport, PersonalTaxReturnForm, FinancialTasksModal |
| 🟢 | `successLight` | `#ECFDF5` | Mint Cream | Background tint for success alerts/badges | Tertiary | ExportReports, GMSHealthCheckReport, HealthCheckDataForm, AreaDetailView, AreaDataCollector, HealthCheckReport, CategoryBreakdowns, Settings, TransactionListV2, FinancialTasksModal |
| 🟢 | `successLighter` | `#D1FAE5` | Pale Mint | Lighter green for borders, badges, soft fills | Tertiary | CategoryManager, Dashboard, ExportReports, FinancesOverview, HealthCheckDataForm, AreaDataCollector, AreaDetailView, AreaTaskPanel, CategoryBreakdowns, Onboarding, PaymentAnalysis, ProcessingFlow, Settings, FinancialTasksModal, TransactionListV2 |
| 🔵 | `incomeColor` | `#4ECDC4` | Turquoise | Income, positive financial indicators | Primary | ClaimsCards, PaymentAnalysis, PersonalTaxReturnForm, Reports, TransactionListV2 |
| 🔵 | `incomeColorDark` | `#3AB5AD` | Deep Teal | Hover/active for income elements | Secondary | ExportReports, PersonalTaxReturnForm, Reports, TransactionListV2 |
| 🔵 | `incomeColorLight` | `#E6FAF8` | Pale Aqua | Light tint for income backgrounds | Tertiary | PaymentAnalysis, PersonalTaxReturnForm, Reports, TransactionListV2 |
| 🔵 | `slainteBlue` | `#4A90E2` | Cornflower Blue | Primary brand — logo, nav, primary buttons | Primary | *~85 files* — the most widely used colour in the app. All major components, nav, buttons, links, form accents |
| 🔵 | `slainteBlueDark` | `#3D7BC7` | Steel Blue | Hover/active state for primary | Secondary | AdvancedInsights, CategoryRefinementWizard, DataVisualisation, ExportReports, FinancialChat, FloatingFinancialChat, Onboarding (many), ProcessingFlow, Tour, UnifiedFinnWidget, PWAInstallPrompt |
| 🔵 | `slainteBlueLight` | `#EFF6FF` | Ice Blue | Light tint for info backgrounds | Tertiary | ActionPlanManager, AreaDataCollector, ArtifactViewer, ExportReports, HealthCheckDataForm, HealthCheckReport, CategoryBreakdowns, Onboarding, Settings, FinancialTasksModal, taskUtils, artifactBuilder |
| 🔵 | `info` | `#4A90E2` | Cornflower Blue | Informational states (alias for slainteBlue) | Primary | *Available — use via STATUS_COLORS.info map* |
| 🔵 | `infoDark` | `#3D7BC7` | Steel Blue | Alias for primary dark | Secondary | *Available — use via STATUS_COLORS.info map* |
| 🔵 | `infoLight` | `#EFF6FF` | Ice Blue | Alias for primary light tint | Tertiary | *Available — use via STATUS_COLORS.info map* |
| 🔵 | `infoLighter` | `#DBEAFE` | Periwinkle Mist | Lighter blue for borders, badges | Tertiary | CategoryManager, Dashboard, ExportReports, FinancesOverview, GMSHealthCheckReport, HealthCheckDataForm, PaymentAnalysis, AreaDetailView, CategoryBreakdowns, ProcessingFlow, Settings, FinancialTasksModal |
| 🔵 | `infoText` | `#1E40AF` | Navy | Dark blue text on info backgrounds | Secondary | ArtifactViewer, FinancialChat, ChatSidebar, GMSHealthCheckReport, HealthCheckReport, FinancesOverview, CategoryBreakdowns, Onboarding, ProcessingFlow, Settings, artifactBuilder |
| 🟣 | `accentPurple` | `#7C6EBF` | Periwinkle | Growth/strategy, premium features | Primary | AccountantExport, DataVisualisation, ExportReports, FinancesOverview, PaymentAnalysis, ProcessingFlow, Reports, Settings, FinancialTasksModal, taskUtils |
| 🟣 | `accentPurpleDark` | `#6358A4` | Dark Periwinkle | Hover/active state | Secondary | *Currently unused — available for future use* |
| 🟣 | `accentPurpleLight` | `#F0EDFA` | Lavender Mist | Background tint for purple elements | Tertiary | CategoryManager, FinancesOverview, PaymentAnalysis, ProcessingFlow, Reports, Settings, FinancialTasksModal |
| 🟣 | `daraViolet` | `#7C3AED` | Vivid Violet | Dara agent primary brand | Primary | DaraSupport, MobileLayout, Settings, FinancialTasksModal |
| 🟣 | `daraVioletDark` | `#6D28D9` | Deep Violet | Dara hover/active state | Secondary | DaraSupport |
| 🟣 | `daraVioletLight` | `rgba(124,58,237,0.08)` | Ghost Violet | Subtle Dara background tint | Tertiary | DaraSupport |
| 🟣 | `daraVioletMedium` | `rgba(124,58,237,0.15)` | Light Violet | Medium Dara emphasis background | Tertiary | DaraSupport |
| 🟣 | `daraVioletBorder` | `rgba(124,58,237,0.19)` | Violet Border | Dara border colour | Tertiary | *Currently unused — available for future use* |
| 🟣 | `chartViolet` | `#8B5CF6` | Amethyst | Extended chart series colour | Primary | AdvancedInsights, CategoryManager, CategoryRefinementWizard, Dashboard, DataVisualisation, FinancialChat, MobileLayout, PaymentAnalysis, Settings, TransactionListV2, AreaDataCollector, parentCategoryMapping, gmsRates |
| 🌸 | `chartPink` | `#EC4899` | Hot Pink | Extended chart series colour | Primary | AdvancedInsights, BusinessOverview, DataVisualisation, GMSOverview, PaymentAnalysis, Settings |

### Neutrals

| Swatch | Token | Hex | Plain Name | Role | Tier | Used In |
|--------|-------|-----|------------|------|------|---------|
| ⬛ | `textPrimary` | `#1F2937` | Dark Slate | Main text, headings | Primary | ~124 files — all components with text |
| ⬛ | `textMuted` | `#6B7280` | Slate Grey | Body text, paragraphs | Secondary | artifactBuilder, healthCheckCalculations, Onboarding, PrintableGuide, Settings, ExportReports, ArtifactViewer, ActionPlanManager, PaymentAnalysis, HealthCheckReport, ProcessingFlow, FinancialTasksModal, gmsRates, parentCategoryMapping, taskUtils |
| ⬛ | `textSecondary` | `#9CA3AF` | Cool Grey | Secondary text, placeholders, icons | Secondary | ~122 files — widely used across most components |
| ⬛ | `textTertiary` | `#D1D5DB` | Silver | Disabled text, subtle labels | Tertiary | *Currently unused — available for future use* |
| ⬜ | `borderLight` | `#E5E7EB` | Light Grey | Dividers, card borders, input borders | Primary | ExportReports, NewGMSHealthCheck, PaymentAnalysis, TransactionListV2 |
| ⬜ | `borderDark` | `#D1D5DB` | Medium Grey | Stronger borders, focused inputs | Secondary | ~123 files — widely used |
| ⬜ | `bgPage` | `#F8FAFC` | Off-White | Page background | Primary | ~107 files — widely used |
| ⬜ | `bgCard` | `#FFFFFF` | White | Cards, containers, modals | Primary | ~113 files — widely used |
| ⬜ | `bgHover` | `#F3F4F6` | Pale Grey | Row/item hover states | Secondary | AdvancedInsights, CategoryManager, ExportReports, ArtifactViewer, Settings, AreaDetailView, CategoryBreakdowns, HealthCheckReport, ProcessingFlow, FinancialTasksModal |
| ⬜ | `white` | `#FFFFFF` | White | Explicit white (text on dark bg, etc.) | Primary | ~113 files — widely used |

### Overlays

| Swatch | Token | Value | Plain Name | Role | Used In |
|--------|-------|-------|------------|------|---------|
| ⬛ | `overlayLight` | `rgba(0,0,0,0.25)` | Light Veil | Light modal backdrop | FinancialChat |
| ⬛ | `overlayMedium` | `rgba(0,0,0,0.40)` | Medium Veil | Standard modal backdrop | AdvancedInsights modals |
| ⬛ | `overlayDark` | `rgba(0,0,0,0.50)` | Dark Veil | Heavy modal backdrop | CategoryManager, CategoryPickerModal, CategoryRefinementWizard, ExportReports, ArtifactViewer, ReportsModal, AreaTaskPanel, Onboarding, ProcessingFlow, Settings, Tour, TransactionListModalV2, TransactionUpload, UnifiedFinnWidget, DaraSupport, PCRSDownloader, AreaDataCollector, FinancesOverview, FinancialTasksModal, GMSTasksModal |

---

## Pre-Built Maps

### `STATUS_COLORS` — Dynamic status-based styling

```js
import { STATUS_COLORS } from '../utils/colors';
const colors = STATUS_COLORS['success']; // or 'error', 'warning', 'info', 'pending'
// colors.text, colors.textOn, colors.bg, colors.bgSubtle, colors.border, colors.dark
```

| Status Key | Maps To | Aliases |
|------------|---------|---------|
| `success` | Green family | `completed` |
| `error` | Red family | `critical` |
| `warning` | Marigold family | `in_progress` |
| `info` | Blue (primary) family | — |
| `pending` | Neutral grey family | — |

### `CHART_COLORS` — Chart/graph series

```js
import { CHART_COLORS } from '../utils/colors';
// CHART_COLORS.income, .expense, .netProfit, .highlight
// CHART_COLORS.series[0..7] for multi-series charts
```

| Index | Token | Colour |
|-------|-------|--------|
| 0 | slainteBlue | Cornflower Blue |
| 1 | incomeColor | Turquoise |
| 2 | expenseColor | Coral |
| 3 | accentPurple | Periwinkle |
| 4 | warning | Marigold Orange |
| 5 | highlightYellow | Sunflower Yellow |
| 6 | chartViolet | Amethyst |
| 7 | chartPink | Hot Pink |

---

## Unused Tokens (available for future use)

| Token | Hex | Notes |
|-------|-----|-------|
| `highlightYellowLight` | `#FFF9E6` | Background tint for highlight — no current usage |
| `accentPurpleDark` | `#6358A4` | Hover state for purple — no current usage |
| `daraVioletBorder` | `rgba(124,58,237,0.19)` | Dara-specific border — no current usage |
| `textTertiary` | `#D1D5DB` | Disabled/subtle text — no current usage |
| `info` / `infoDark` / `infoLight` | Blue aliases | Used indirectly via STATUS_COLORS map |

---

## Quick-Reference: Semantic Usage Guide

| Context | Use This | Not This |
|---------|----------|----------|
| Income / positive financial data | `incomeColor` | `success` |
| Expense / negative financial data | `expenseColor` | `error` |
| Task completed / form valid | `success` | `incomeColor` |
| Error message / failed action | `error` | `expenseColor` |
| Warning / needs attention | `warning` | `highlightYellow` |
| Highlight / badge / callout | `highlightYellow` | `warning` |
| Primary button / brand element | `slainteBlue` | `info` |
| Informational status badge | `STATUS_COLORS.info` | `slainteBlue` directly |

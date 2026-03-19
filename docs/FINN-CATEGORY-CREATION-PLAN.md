# Finn Category Creation — Plan

**Status:** PLANNED (not yet built)
**Depends on:** Batch B bulk recategorize (COMPLETE)
**Date:** 2026-03-18

## Context

When users ask Finn to recategorize transactions into a category that doesn't exist, Finn currently navigates to Settings > Categories and asks the user to create it manually. This breaks the conversational flow. Finn should be able to create the category itself (with confirmation), then immediately recategorize the matching transactions.

Real example that motivated this:
> User: "Move all Employer PRSI transactions to Payments to Revenue"
> Finn: matched to "VAT Payments to Revenue" (wrong — that's a different thing)
> User: "No, I want a new category called Payments to Revenue"
> Finn: navigated to Settings > Categories (flow broken)

## Category System Overview

### Structure
```
Section (11 fixed)  →  Category (user-extensible)  →  Transaction
   e.g. DIRECT STAFF COSTS  →  "Payments to Revenue" (code 2.8)  →  12 transactions
```

### The 11 Sections (fixed, cannot be created)
| Section | Type | Group Code | Typical Categories |
|---------|------|------------|-------------------|
| INCOME | income | INCOME | GMS Income, Fee Income, State Contracts |
| DIRECT STAFF COSTS | expense | STAFF | GP Salary, Receptionist, Nurse, Employer PRSI, **Payments to Revenue (PAYE/PRSI/USC)** |
| MEDICAL SUPPLIES | expense | MEDICAL | Drugs, Equipment, Lab Fees |
| PREMISES COSTS | expense | PREMISES | Rent, Rates, Utilities, Insurance |
| OFFICE & IT | expense | OFFICE | Phone, Stationery, Software |
| PROFESSIONAL FEES | expense | PROFESSIONAL | Accountancy, Legal, Banking |
| PROFESSIONAL DEV | expense | PROFESSIONAL | Training, Memberships, Indemnity |
| MOTOR & TRANSPORT | expense | MOTOR | Fuel, Motor Insurance |
| PETTY CASH / OTHER EXPENSES | expense | OTHER | Sundry, Miscellaneous |
| CAPITAL & DEPRECIATION | expense | OTHER | Equipment Purchase, Depreciation |
| NON-BUSINESS | non-business | NON_BUSINESS | Personal, Drawings |

### Category Object Shape
```javascript
{
  code: "2.8",                              // Unique string, numeric convention
  name: "Payments to Revenue",              // User-facing label
  identifiers: ["REVENUE COMMISSIONERS"],   // Keywords for auto-categorization
  type: "expense",                          // "income" | "expense" | "non-business"
  section: "DIRECT STAFF COSTS",            // MUST be one of 11 fixed sections
  accountantLine: "Employer's PRSI & PAYE", // P&L reporting line (recommended)
  description: "PAYE, PRSI, USC payments"   // Help text (optional)
}
```

### Critical Constraint: `section` Field
The categorization engine uses `section` → `SECTION_TO_GROUP` mapping. Without `section`, a category falls through to `OTHER`, breaking P&L structure. The current CategoryManager UI doesn't set `section` on new categories (a known gap). Finn should always set it correctly — making Finn-created categories more robust than UI-created ones.

## Proposed Design

### Approach: Extend `navigate` with `categories:create` target

Follows the `tasks:create` pattern: Finn describes the proposed category, gets user confirmation, then creates it. Optionally recategorizes matching transactions in a follow-up `search_transactions` call.

**Zero new tools** — extends existing `navigate` tool with a new target and `categoryData` parameter.

### Schema Addition
```javascript
// New target in navigate enum
'categories:create'

// New param (alongside existing taskData)
categoryData: {
  type: 'object',
  description: 'Only for categories:create. Defines the new category.',
  properties: {
    name: { type: 'string', description: 'Category display name' },
    type: { type: 'string', enum: ['income', 'expense', 'non-business'] },
    section: {
      type: 'string',
      enum: [
        'INCOME', 'DIRECT STAFF COSTS', 'MEDICAL SUPPLIES',
        'PREMISES COSTS', 'OFFICE & IT', 'PROFESSIONAL FEES',
        'PROFESSIONAL DEV', 'MOTOR & TRANSPORT',
        'PETTY CASH / OTHER EXPENSES', 'CAPITAL & DEPRECIATION', 'NON-BUSINESS'
      ],
      description: 'The section/group this category belongs to. IMPORTANT: Revenue payments (PAYE/PRSI/USC) go in DIRECT STAFF COSTS, not PETTY CASH. Professional indemnity goes in PROFESSIONAL DEV, not PROFESSIONAL FEES.'
    },
    identifiers: {
      type: 'array',
      items: { type: 'string' },
      description: 'Keywords that auto-match transactions to this category'
    },
    accountantLine: {
      type: 'string',
      description: 'P&L reporting line (e.g. "Employer\'s PRSI & PAYE", "Staff costs", "Rent payable")'
    }
  }
}
```

### Implementation in executeToolAction

```javascript
if (target === 'categories:create') {
  const data = input.categoryData;
  if (!data?.name || !data?.type || !data?.section) {
    return { success: false, error: 'name, type, and section are required.' };
  }

  // Validate section
  const validSections = [...]; // the 11 sections
  if (!validSections.includes(data.section)) {
    return { success: false, error: `Invalid section "${data.section}".` };
  }

  // Check for duplicate name
  if (categoryMapping.find(c => c.name.toLowerCase() === data.name.toLowerCase())) {
    return { success: false, error: `Category "${data.name}" already exists.` };
  }

  // Auto-generate unique code
  const code = generateNextCode(categoryMapping, data.section);

  const newCategory = {
    code,
    name: data.name,
    type: data.type,
    section: data.section,
    identifiers: data.identifiers || [],
    accountantLine: data.accountantLine || '',
    description: `Created by Finn`
  };

  setCategoryMapping(prev => [...prev, newCategory]);

  return {
    success: true,
    message: `Category "${data.name}" created in ${data.section} (code ${code}).`,
    categoryCode: code,
    categoryName: data.name
  };
}
```

### Code Generation Logic
Categories use a numeric convention: section-based prefix + incremental suffix.
- INCOME: 1.x
- DIRECT STAFF COSTS: 2.x - 3.x
- PREMISES COSTS: 10.x - 19.x
- etc.

For simplicity, use a high-range prefix (80.x, 81.x, etc.) for Finn-created categories to avoid collisions with the default mapping, or scan existing codes and pick `max + 1` within the section range.

Simpler approach: use `F-{timestamp}` codes (e.g. `F-1710774000`) since code format is not validated anywhere — it just needs to be unique. This avoids all numbering scheme complexity.

### Expected Conversation Flow

```
User: "Move all Employer PRSI transactions to Payments to Revenue"

Finn: [calls search_transactions with category="Employer PRSI", action="list"]
Finn: "I found 12 transactions totalling €201,933. There's no existing category
       called 'Payments to Revenue' — shall I create it? It would sit under
       Direct Staff Costs (since these are PAYE/PRSI/USC payments to Revenue)."

User: "Yes please"

Finn: [calls navigate with target="categories:create", categoryData={
        name: "Payments to Revenue",
        type: "expense",
        section: "DIRECT STAFF COSTS",
        identifiers: ["REVENUE COMMISSIONERS"],
        accountantLine: "Employer's PRSI & PAYE"
      }]
Finn: [calls search_transactions with category="Employer PRSI",
        action="recategorize", newCategory="Payments to Revenue"]
Finn: "Done — created 'Payments to Revenue' under Staff Costs and moved
       all 12 transactions into it. Future Revenue Commissioners transactions
       will auto-categorize there too."
```

**Example 2: Ambiguous section — Finn surfaces reasoning**
```
User: "I want a category called Payments to the Pharmacist"

Finn: [calls search_transactions to check if any transactions mention pharmacist-related terms]
Finn: "I can create 'Payments to the Pharmacist' for you. This sounds like it
       belongs under Medical Supplies (drugs and dispensing costs) — does that
       sound right, or would Professional Fees be more appropriate if it's a
       retainer or consultancy arrangement?"

User: "Medical Supplies is right"

Finn: [calls navigate with target="categories:create", categoryData={
        name: "Payments to the Pharmacist",
        type: "expense",
        section: "MEDICAL SUPPLIES",
        identifiers: ["PHARMACY", "PHARMACIST"],
        accountantLine: "Drugs and medical supplies"
      }]
Finn: "Done — 'Payments to the Pharmacist' created under Medical Supplies.
       Would you like me to move any existing transactions into it?"
```

### Domain Knowledge for Finn

The tool description and/or system prompt needs GP practice-specific guidance:
- Revenue payments (PAYE/PRSI/USC) → DIRECT STAFF COSTS (not "Other")
- Professional indemnity (MPS, MDU, Medisec) → PROFESSIONAL DEV (not PROFESSIONAL FEES)
- Locum fees → DIRECT STAFF COSTS
- Cleaning → PREMISES COSTS
- Software subscriptions → OFFICE & IT
- Bank charges → PROFESSIONAL FEES

This could be a short lookup table in the section enum description, or injected as part of the system context.

### Section Reasoning for Ambiguous Categories

Not every category has an obvious section. Clear-cut examples:
- "Payments to Revenue" → DIRECT STAFF COSTS (PAYE/PRSI/USC — always staff-related)
- "Printer Ink" → OFFICE & IT

Ambiguous examples:
- "Payments to the Pharmacist" → probably MEDICAL SUPPLIES (dispensing/drugs), but could be PROFESSIONAL FEES (retainer)
- "Security System" → could be PREMISES COSTS or OFFICE & IT
- "Staff Uniforms" → could be DIRECT STAFF COSTS or MEDICAL SUPPLIES

**Prompt engineering rule:** When Finn is confident about the section (clear domain mapping), it should state its choice and ask for confirmation in the normal flow. When the section is ambiguous, Finn should **explicitly surface its reasoning and offer the alternative**:

> "I'll create 'Payments to the Pharmacist'. This sounds like it belongs under
> Medical Supplies (drugs and dispensing costs) — does that sound right, or
> would it fit better under Professional Fees?"

This can be achieved without code changes — it's a prompt engineering pattern in the tool description:

```
IMPORTANT: When the correct section is ambiguous, explain your reasoning
and offer the most likely alternative. For example: "This sounds like
Medical Supplies (dispensing costs) — or would Professional Fees be
more appropriate?" Only proceed after the user confirms the section.
```

This makes Finn a collaborative partner rather than a black box — the user learns about the P&L structure while Finn learns their preferences.

### What Needs `setCategoryMapping` Access

FinnContext already has `categoryMapping` (read). Needs `setCategoryMapping` added to the AppContext destructure (same pattern as `setTransactions` added for bulk recategorize).

## Edge Cases

1. **Duplicate name** — reject with error, suggest existing category
2. **Invalid section** — reject with error, list valid sections
3. **User changes mind** — categories can be deleted from CategoryManager UI; Finn doesn't need delete capability initially
4. **Identifiers suggested wrong** — user can refine in CategoryManager; Finn could also update identifiers via a future extension
5. **accountantLine wrong** — not critical, accountant reviews anyway

## Files to Modify

- `src/context/FinnContext.jsx` — navigate schema, executeToolAction handler, setCategoryMapping destructure
- `src/context/AppContext.jsx` — no changes (setCategoryMapping already exposed)

## Verification

1. "Create a new category called X under Y" → category created, visible in CategoryManager
2. "Move transactions mentioning Z to X" → recategorize works with the new category
3. Duplicate name → clear error
4. Check that new category has `section` set → appears in correct P&L group
5. Upload new transactions with matching identifiers → auto-categorize to new category

# Equity Projection Improvements Design

**Date:** 2026-01-31
**Status:** Approved

## Problem

The dashboard shows projected equity based on static values seeded in December 2025. Over time this drifts from reality because:

- Home value is fixed at $330K with a 4% growth assumption that may not match the market
- Loan balance never updates in the database (only decreases in projections)
- There is no way to adjust projection assumptions from the UI
- No scenario comparison to understand the range of outcomes

## Goals

1. Accurate current equity — reflect today's real home value and loan balance
2. Better projections — anchor to actual values, adjustable assumptions, scenario comparison
3. Keep the routine update workflow fast and separate from assumption tweaking

## Data Model Changes

### New table: `property_value_history`

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid PK | Default gen_random_uuid() |
| recorded_at | date | When this estimate was recorded |
| home_value | numeric | Estimated market value |
| source | text | Where the estimate came from (Zillow, Redfin, Appraisal, Other) |
| note | text, nullable | Optional context |
| created_at | timestamptz | Auto-set |

### New table: `loan_balance_history`

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid PK | Default gen_random_uuid() |
| recorded_at | date | Statement date |
| balance | numeric | Actual remaining balance |
| note | text, nullable | e.g., "Extra principal payment" |
| created_at | timestamptz | Auto-set |

### Changes to `property` table

- Add `loan_start_date` (date) — needed for auto-amortization calculation
- Add `original_loan_amount` (numeric) — the initial loan principal
- `home_value` and `loan_balance` become fallbacks. App logic prefers the latest history entry (or auto-calculated balance) over these static fields.

### RLS policies

- Anon read on both history tables (consistent with existing policy)
- Anon insert on both history tables (admin mode handles gating in the UI)

## Projection Logic Changes

### Anchoring to real values

`generateProjections()` currently starts from static `property.home_value` and `property.loan_balance`. New logic:

1. **Home value**: Use the most recent `property_value_history` entry. Fall back to `property.home_value` if no history exists.
2. **Loan balance**: Auto-calculate from `loan_start_date`, `interest_rate`, `loan_term_years`, and `original_loan_amount`. If a `loan_balance_history` entry is more recent than the last auto-calc point, use that instead (manual override wins).
3. **Year 0**: Add a "Now" data point to the chart showing actual current equity, so the projection starts from reality.

### Scenario generation

`generateProjections(property)` becomes `generateProjections(property, { rateOffset = 0 })`. The dashboard calls it three times:

- `generateProjections(property, { rateOffset: -0.02 })` — pessimistic
- `generateProjections(property, { rateOffset: 0 })` — base case
- `generateProjections(property, { rateOffset: 0.02 })` — optimistic

`rateOffset` applies to `home_growth_rate` only. Rent growth, inflation, and other rates stay at base values — home appreciation is the dominant equity variable and carries the most uncertainty.

### New utility: amortization.js

Auto-calculate current loan balance from origination details:

- Input: original loan amount, annual interest rate, term in years, loan start date
- Output: remaining balance as of today
- Standard amortization math, stepping through elapsed months

## UI: Update Values Panel

Quick-action admin feature for routine updates. Appears when admin mode is active.

### Trigger

"Update Values" button near the summary cards in admin mode. Opens a modal.

### Home Value Update

- Displays current value (from latest history entry)
- Input for new estimated value
- Source dropdown: Zillow, Redfin, Appraisal, Other
- Optional note field
- "Last updated: [date]" for context

### Loan Balance Override

- Displays auto-calculated balance with label: "Calculated: $XXX,XXX"
- Toggle: "Override with actual balance"
- When on: input for actual balance, optional note
- When off: system uses amortization math

### Behavior

Save inserts a row into the respective history table. Dashboard re-fetches and recalculates projections immediately.

### Design

- Matches existing dark/cream aesthetic with amber accents
- Playfair Display / JetBrains Mono typography
- Modal overlay consistent with passcode gate style
- Mobile-friendly: full-width on small screens, centered modal on desktop

## UI: Projection Settings

Separate admin screen for tweaking growth rates and assumptions. Less frequent usage.

### Trigger

Gear icon on equity chart header, visible in admin mode only. Opens an inline settings panel below the chart (not a modal — so you can see the chart update as you adjust).

### Settings grouped logically

**Growth Assumptions:**
- Home appreciation rate (default 4%)
- Rent growth rate (default 4%)
- Inflation rate (default 3%)

**Income & Vacancy:**
- Monthly rent
- Vacancy rate (default 5%)

**Expenses:**
- Monthly maintenance
- Monthly management fee
- PMI annual / PMI years remaining

**Tax:**
- Effective tax rate (default 24%)
- Annual depreciation

### Behavior

- Changes update the chart in real-time (debounced)
- "Save" persists to `property` table
- "Reset to defaults" restores original seeded values
- No history tracking on assumptions — these are modeling inputs, not observed data
- Scenario bands (±2%) auto-adjust with the base appreciation rate

## Equity Chart Updates

### Three scenario bands

- **Base case**: Solid line with filled area underneath (current amber/gold)
- **Optimistic (+2%)**: Dashed line above, no fill, lighter color
- **Pessimistic (-2%)**: Dashed line below, no fill, muted color
- Subtle fill between optimistic and pessimistic (5-8% opacity) for confidence band effect

### Year 0 anchor

- Chart starts at "Now" instead of "Year 1"
- Shows actual current equity from real values
- Clear visual transition from known to projected

### Tooltips

- Hover shows all three scenarios: "Base: $X / Optimistic: $Y / Pessimistic: $Z"
- Respects existing "Total Property / Your Share" toggle

### Legend

Small legend below chart: solid = base, dashed = ±2% scenarios.

### Future: Value history overlay

Plot recorded home values from `property_value_history` as discrete dots on the chart to compare real appreciation against projected curves. Not in MVP — add once there are enough data points to be useful.

## Implementation Scope

### What gets built

| Piece | Detail |
|-------|--------|
| 2 new Supabase tables | `property_value_history`, `loan_balance_history` with RLS |
| 1 migration on `property` | Add `loan_start_date` and `original_loan_amount` |
| Updated `projections.js` | Anchor to real values, accept `rateOffset`, add Year 0 |
| New `amortization.js` | Auto-calculate current loan balance from origination details |
| Updated `Dashboard.jsx` | Fetch history tables, derive current values, pass to components |
| New `UpdateValuesModal.jsx` | Quick admin panel for home value and loan balance updates |
| New `ProjectionSettings.jsx` | Inline settings panel for growth rate assumptions |
| Updated `EquityChart.jsx` | Three scenario lines, Year 0 anchor, updated tooltips/legend |
| Updated `SummaryCards.jsx` | Use real current equity instead of Year 1 projection |

### What doesn't change

- PasscodeGate, auth flow, transaction system, AddTransaction
- Overall layout, typography, color system
- Partners table, ownership share logic

### Migration path

Seed the history tables with the current static values as the first entry so there is no data gap. Existing functionality keeps working throughout.

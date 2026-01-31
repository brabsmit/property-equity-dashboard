# Cash Flow Projection Design

## Overview

Add a multi-year monthly cash flow projection to the dashboard, displayed as a tabbed view alongside the existing equity projection chart. Shows 120 months (10 years) of monthly net cash flow as bars with cumulative cash position as overlaid lines, including optimistic/pessimistic scenario bands.

## Data Model & Calculation

No new database tables. Extend the existing projection engine.

### New function: `generateMonthlyCashFlow(property, options)`

Inputs match `generateProjections` — the `property` row plus `rateOffset`, `currentHomeValue`, `currentLoanBalance` overrides.

For each of 120 months, calculate:

- **Income:** Monthly rent, escalated annually at `rent_growth_rate`, reduced by vacancy rate
- **Expenses:** Mortgage P&I (amortization step), escrow, maintenance (escalated at inflation), management fee, PMI (only for first N years)
- **Net cash flow:** Income minus expenses
- **Tax benefit:** Monthly allocation (annual depreciation + interest deduction + deductible expenses) / 12
- **Adjusted net:** Net cash flow + monthly tax benefit
- **Cumulative:** Running sum of adjusted net from month 0

Returns array of 120 objects: `{ month, monthLabel, income, expenses, net, taxBenefit, adjustedNet, cumulative }`

For scenarios: three cumulative series (base, optimistic +2%, pessimistic -2%) but only one set of monthly bars (base case).

## Chart Component

### `CashFlowChart.jsx`

Built with Recharts `ComposedChart`:

- **X-axis:** "Now" at start, then "Yr 1", "Yr 2", etc. every 12th month
- **Y-axis left:** Dollar scale for monthly net (bars)
- **Y-axis right:** Dollar scale for cumulative (lines)
- **Bars:** `net` per month — amber for positive, rose for negative. Thin bars, slight opacity for density
- **Cumulative lines:**
  - Base case: solid amber
  - Optimistic: dashed amber, lighter opacity
  - Pessimistic: dashed gray
- **Zero line:** Subtle horizontal reference at $0 on both axes
- **Tooltip:** Month label, income, expenses, net, cumulative (base/optimistic/pessimistic)
- **Responsive:** Full width, 300px height, matching equity chart

## Tab UI & Integration

### Modify `EquityChart.jsx` to become a tabbed container

- Two tabs: "Equity Projection" and "Cash Flow Projection"
- Tab styling: subtle underline on active tab, amber/cream palette
- Shared controls:
  - "Total Property / Your Share" toggle applies to active chart
  - Projection Settings gear icon (admin only) drives both charts

### Data flow

- `Dashboard.jsx` already fetches `property`, transactions, and history data
- Call `generateMonthlyCashFlow()` alongside existing `generateProjections()`
- Both computed once on data load, passed down to tabbed chart component

### File changes

- `EquityChart.jsx` — Add tab UI, conditionally render equity vs. cash flow
- `CashFlowChart.jsx` — New component (bar + line chart)
- `projections.js` — Add `generateMonthlyCashFlow()` function

## Edge Cases

- **Dense bars (120):** Thin bars, no gap, slight opacity. On mobile, bars blur together — acceptable since cumulative line carries the story
- **Negative cumulative:** If cumulative never crosses zero, that's honest data. No forced breakeven
- **PMI dropoff:** Visible step-change in monthly net when PMI stops — this is a feature
- **Vacancy rate:** Applied as percentage reduction to rent each month (e.g., 5% vacancy = rent x 0.95)

## Out of Scope (YAGNI)

- No CSV/PDF export
- No click-to-drill-down on individual months
- No editable month-by-month overrides
- No separate scenario toggle — hardcoded ±2% matching equity chart
- No animation on tab switch

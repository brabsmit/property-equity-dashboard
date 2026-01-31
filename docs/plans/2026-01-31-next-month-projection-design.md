# Next Month Projected Amount Due — Design

## Problem

The dashboard shows historical data (This Month, Running Balance) and long-term projections (10-year equity chart), but there's no forward-looking view of what each partner should expect to owe or receive **next month**. Partners want a quick glance at their upcoming financial obligation.

## Solution

Add a 4th summary card — **"NEXT MONTH"** — that shows each partner's projected net cash flow for the upcoming month, calculated from a hybrid of property assumptions and recent actual transactions.

## Calculation Logic

### Hybrid Approach (Simple)

For each recurring expense/income category, use the most recent month's actual transaction amount if available; otherwise fall back to property assumptions.

```
projectedRent       = lastMonth actual rent       ?? property.monthly_rent
projectedMortgage   = lastMonth actual mortgage   ?? calculated monthly P&I (from amortization)
projectedManagement = lastMonth actual management ?? property.monthly_management
projectedEscrow     = property.monthly_escrow        (always from assumptions)
projectedMaintenance = property.monthly_maintenance   (always from assumptions)

projectedNet = projectedRent
             - projectedMortgage
             - projectedEscrow
             - projectedMaintenance
             - projectedManagement

partnerAmount = projectedNet × ownership_share
```

### Category Rules

| Category | Source | Rationale |
|----------|--------|-----------|
| `rent` | Last month actual, else assumption | Rent may change; actuals more accurate |
| `mortgage` | Last month actual, else P&I calc | Captures actual payment amount |
| `management` | Last month actual, else assumption | Fee may vary |
| `escrow` | Always assumption | Fixed monthly amount, not individually transacted |
| `maintenance` | Always assumption | Fixed budget estimate |
| `repair`, `insurance`, `tax`, `other` | Excluded | Irregular/unpredictable — not part of monthly projection |

### "Last Month" Definition

Look at the most recent calendar month that has at least one transaction. This handles cases where the current month is early and has no entries yet — it will use the previous month's data.

## UI Design

### Card Specification

- **Position:** 4th card in summary row (after Running Balance)
- **Label:** `"NEXT MONTH"` (small caps, tracking-widest, matching existing cards)
- **Value:** Projected net amount formatted as currency with sign prefix
  - Negative (partner owes) → rose color `text-rose-500` / `#c45d5d`
  - Positive (partner receives) → amber color `text-amber-400` / `#d4a853`
- **Subtitle:** `"projected"` (gray muted text)
- **Font:** JetBrains Mono bold (matching other card values)
- **Animation:** Same count-up + fadeInUp, staggered 0.15s after 3rd card

### Grid Layout Change

Current: `grid-cols-1 sm:grid-cols-3`
New: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`

This gives:
- Mobile: 1 column (4 stacked cards)
- Tablet: 2x2 grid
- Desktop: 4 across

### No Emphasis Styling

The new card uses standard styling (no amber border glow) — only the Equity card has emphasis.

## Implementation Scope

### New Utility Function

Add `calculateProjectedMonthlyNet(property, transactions)` to a utility file (or inline in SummaryCards). This function:

1. Finds the most recent month with transactions
2. Sums amounts by category for that month
3. Calculates monthly P&I from loan parameters (reuse amortization logic)
4. Applies hybrid logic per category
5. Returns the projected net

### Modified Files

1. **`SummaryCards.jsx`** — Add 4th card definition, update grid classes, add projected net calculation
2. **`Dashboard.jsx`** — Pass `property` to SummaryCards (already passed)

### No Database Changes

All data needed already exists in the `property` and `transactions` tables.

## Edge Cases

- **No transactions at all:** Fall back to pure assumptions for every category
- **Current month is January with no December data:** Walk back until a month with data is found, or fall back to assumptions
- **Rent not received yet this month:** Uses last month's actual rent, not this month's partial data
- **Partner with different ownership share:** Each partner sees their proportional share (though currently all partners share the same 33.33%)

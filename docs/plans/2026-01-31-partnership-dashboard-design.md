# Property Equity Partnership Dashboard — Design

## Overview

A lightweight, single-page dashboard for a 3-person family partnership (Bryan, Andy, Andy's wife) that tracks equity, cash flow, and expenses on a rental property. Andy (admin) inputs monthly costs; all partners view the current state of the agreement at a glance.

## Partners

| Name        | Share  | Role   |
|-------------|--------|--------|
| Bryan       | 33.33% | Viewer |
| Andy        | 33.33% | Admin  |
| Andy's wife | 33.33% | Viewer |

## Tech Stack

- **Frontend**: React 19 + Vite
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React
- **Backend/DB**: Supabase (Postgres)
- **Auth**: Simple passcode gate (no Supabase Auth)

## Data Model

### `property` (single row)

Stores the core financial assumptions for the property.

| Column               | Type    | Notes                          |
|----------------------|---------|--------------------------------|
| id                   | uuid    | Primary key                    |
| home_value           | numeric | Current estimated home value   |
| purchase_price       | numeric | Original purchase price        |
| land_value           | numeric | Non-depreciable land value     |
| depreciable_basis    | numeric | Purchase price - land value    |
| loan_balance         | numeric | Starting loan balance          |
| interest_rate        | numeric | Annual interest rate (decimal) |
| loan_term_years      | integer | Loan term in years             |
| monthly_escrow       | numeric | Tax + insurance + PMI escrow   |
| depreciation_annual  | numeric | Annual depreciation amount     |
| home_growth_rate     | numeric | Annual appreciation rate       |
| rent_growth_rate     | numeric | Annual rent growth rate        |
| inflation_rate       | numeric | Annual inflation rate           |
| vacancy_rate         | numeric | Vacancy loss percentage        |
| effective_tax_rate   | numeric | Combined federal + state rate  |
| pmi_annual           | numeric | Annual PMI cost                |
| pmi_years            | integer | Years until PMI removal        |
| initial_investment   | numeric | Total closing costs/investment |
| monthly_rent         | numeric | Starting monthly rent          |
| monthly_maintenance  | numeric | Starting monthly maintenance   |
| monthly_management   | numeric | Monthly management fee         |
| property_tax_annual  | numeric | Annual property tax            |
| insurance_annual     | numeric | Annual insurance cost          |

### `partners` (3 rows)

| Column          | Type    | Notes                      |
|-----------------|---------|----------------------------|
| id              | uuid    | Primary key                |
| name            | text    | Partner name               |
| ownership_share | numeric | Decimal (e.g. 0.3333)     |
| role            | text    | `admin` or `viewer`        |

### `transactions`

One row per income or expense entry. This is the running ledger.

| Column     | Type      | Notes                                    |
|------------|-----------|------------------------------------------|
| id         | uuid      | Primary key                              |
| date       | date      | Transaction date                         |
| category   | text      | mortgage, rent, repair, management_fee, insurance, tax, other |
| amount     | numeric   | Positive = income, negative = expense    |
| note       | text      | Optional description                     |
| created_at | timestamp | Auto-generated                           |

### `monthly_summaries` (database view)

Aggregates transactions by month for fast dashboard queries. Columns: `month`, `total_income`, `total_expenses`, `net`.

## Authentication & Access

- **Passcode gate**: Single shared passcode stored as environment variable. On correct entry, saved to `localStorage`. All partners use the same passcode.
- **Admin mode**: Secondary admin passcode (also env variable). Toggled via button in the header. Enables expense input and transaction editing. Admin state stored in `localStorage`.
- **No Supabase Auth**: The Supabase client uses the publishable anon key. RLS keeps reads open and writes gated. Frontend passcode is sufficient for a 3-person family tool.

## Dashboard Layout

### Aesthetic Direction: "Refined Utilitarian"

A private investment ledger feel — not a generic SaaS dashboard.

**Typography:**
- Display headings: DM Serif Display or Playfair Display
- Financial figures: JetBrains Mono or IBM Plex Mono (monospace for ledger feel)

**Color Palette:**
- Dark mode base: `#0f1419` (dark slate)
- Light mode base: `#f5f0e8` (warm cream/parchment)
- Positive values / accent: `#d4a853` (warm amber/gold)
- Negative values / expenses: `#c45d5d` (muted rose)
- Minimal color usage — let numbers breathe

**Atmosphere:**
- Faint noise/grain texture on background
- Thin gold separator lines between sections
- Cards with subtle borders, not heavy shadows
- Generous whitespace throughout

**Motion:**
- Staggered fade-in on load for summary cards
- Count-up animation on equity and balance numbers
- Subtle hover lift on transaction rows
- Chart draws in progressively

### Page Structure

**Header:**
- Property address / partnership name (left)
- Admin toggle button + lock/logout icon (right)

**Top Row — 3 Summary Cards:**
1. **Your Equity**: Current estimated equity (1/3 share), with month-over-month change indicator
2. **This Month's Cash Flow**: Net income minus expenses for current month, per partner share
3. **Running Balance**: Cumulative net since inception (June 2025), per partner share

The equity card gets more visual weight (slightly larger or emphasized).

**Middle Section — Recent Transactions:**
- Clean table: Date, Category (color-coded badge), Description, Amount
- Shows last 10-15 entries
- "View all" to expand full history
- When admin mode active: "+ Add Entry" button opens inline form row (date, amount, category dropdown, note, submit)

**Bottom Section — Equity Projection Chart:**
- Single Recharts area chart showing 10-year equity growth
- Toggleable between total property and 1/3 partner share
- Light, supporting — not the main focus

### Passcode Gate Screen

Centered, minimal. Property address heading, single passcode input with gold focus ring, enter button. No clutter.

### Mobile Responsive

- Cards stack vertically
- Transaction table becomes card-based list
- Chart remains full-width
- Admin form becomes full-width modal on small screens

## Seed Data

On initial setup, the database is seeded from the spreadsheet:

- **Property table**: Financial assumptions from Sheet 1 (home value $330,000, loan balance $274,803.87, 5.99% rate, etc.)
- **Partners table**: Bryan (0.3333, viewer), Andy (0.3333, admin), Andy's wife (0.3333, viewer)
- **Transactions table**: 7 months of actual data from "Running Expenses" sheet (June–December 2025) including all mortgage payments, rent receipts, repair costs, and management fees

## Projection Logic

All 10-year projections are calculated in the frontend from `property` assumptions:

- Annual mortgage amortization (principal + interest split)
- Straight-line depreciation over 27.5 years
- Vacancy loss applied to gross rent
- Inflation adjustment on maintenance and expenses
- PMI removal after configured years
- Tax benefit from depreciation losses
- Home appreciation compounding annually
- All values proportioned by partner ownership share

No projections stored in the database — they recompute from current assumptions.

## Admin Input Flow

When Andy toggles admin mode:
1. Prompted for admin passcode
2. "+ Add Entry" button appears above transactions
3. Clicking opens an inline form row at top of the transaction table
4. Fields: date picker, amount input, category dropdown, optional note
5. Submit saves to `transactions` table via Supabase client
6. Dashboard summary cards and running balance update immediately

Simple ledger-row entry — feels like adding a line to a spreadsheet.

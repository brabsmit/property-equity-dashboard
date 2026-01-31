# Property Equity Dashboard — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a lightweight partnership dashboard that shows equity, cash flow, running balance, and transactions for a 3-person rental property partnership, backed by Supabase.

**Architecture:** React SPA with Vite, connecting to Supabase Postgres for data persistence. Passcode-gated access with admin mode for expense entry. All projection math computed client-side from stored assumptions.

**Tech Stack:** React 19, Vite, Tailwind CSS 3, Recharts, Lucide React, Supabase JS client (@supabase/supabase-js)

**Supabase Project:** `mokjxwwldiyklyzyzsej` (https://mokjxwwldiyklyzyzsej.supabase.co)

**Publishable Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1va2p4d3dsZGl5a2x5enl6c2VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4NTczNTUsImV4cCI6MjA4NTQzMzM1NX0.1peDp5996L-DsWsFACYft5INN9C-fO1u5U0R1saGNls`

**Working Directory:** `/Users/bryan/Documents/GitHub/property-equity-dashboard/property-equity-dashboard`

---

### Task 1: Database Schema & Seed Data

Create all tables, the monthly_summaries view, and seed with spreadsheet data via Supabase migrations.

**Step 1: Apply migration — create tables**

Use `mcp__supabase__apply_migration` with project_id `mokjxwwldiyklyzyzsej`, name `create_tables`:

```sql
-- Property assumptions (single row)
create table property (
  id uuid primary key default gen_random_uuid(),
  home_value numeric not null,
  purchase_price numeric not null,
  land_value numeric not null,
  depreciable_basis numeric not null,
  loan_balance numeric not null,
  interest_rate numeric not null,
  loan_term_years integer not null,
  monthly_escrow numeric not null,
  depreciation_annual numeric not null,
  home_growth_rate numeric not null default 0.04,
  rent_growth_rate numeric not null default 0.04,
  inflation_rate numeric not null default 0.03,
  vacancy_rate numeric not null default 0.05,
  effective_tax_rate numeric not null default 0.24,
  pmi_annual numeric not null default 0,
  pmi_years integer not null default 0,
  initial_investment numeric not null,
  monthly_rent numeric not null,
  monthly_maintenance numeric not null,
  monthly_management numeric not null,
  property_tax_annual numeric not null,
  insurance_annual numeric not null
);

-- Partners
create table partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ownership_share numeric not null,
  role text not null check (role in ('admin', 'viewer'))
);

-- Transaction ledger
create table transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  category text not null check (category in ('mortgage', 'rent', 'repair', 'management_fee', 'insurance', 'tax', 'other')),
  amount numeric not null,
  note text,
  created_at timestamptz not null default now()
);

-- Monthly summaries view
create or replace view monthly_summaries as
select
  date_trunc('month', date)::date as month,
  sum(case when amount > 0 then amount else 0 end) as total_income,
  sum(case when amount < 0 then amount else 0 end) as total_expenses,
  sum(amount) as net
from transactions
group by date_trunc('month', date)
order by month;
```

**Step 2: Apply migration — RLS policies**

Use `mcp__supabase__apply_migration` with name `add_rls_policies`:

```sql
-- Enable RLS on all tables
alter table property enable row level security;
alter table partners enable row level security;
alter table transactions enable row level security;

-- Allow anon reads on all tables
create policy "Allow anon read property" on property for select to anon using (true);
create policy "Allow anon read partners" on partners for select to anon using (true);
create policy "Allow anon read transactions" on transactions for select to anon using (true);

-- Allow anon inserts/updates/deletes on transactions (admin gated in frontend)
create policy "Allow anon insert transactions" on transactions for insert to anon with check (true);
create policy "Allow anon update transactions" on transactions for update to anon using (true);
create policy "Allow anon delete transactions" on transactions for delete to anon using (true);
```

**Step 3: Seed property data**

Use `mcp__supabase__execute_sql`:

```sql
insert into property (
  home_value, purchase_price, land_value, depreciable_basis,
  loan_balance, interest_rate, loan_term_years, monthly_escrow,
  depreciation_annual, home_growth_rate, rent_growth_rate, inflation_rate,
  vacancy_rate, effective_tax_rate, pmi_annual, pmi_years,
  initial_investment, monthly_rent, monthly_maintenance, monthly_management,
  property_tax_annual, insurance_annual
) values (
  330000, 332500, 69200, 281300,
  274803.87, 0.0599, 30, 534.60,
  10229.09, 0.04, 0.04, 0.03,
  0.05, 0.24, 488.88, 4,
  58000, 1850, 300, 95,
  3809.04, 2117.23
);
```

**Step 4: Seed partners**

```sql
insert into partners (name, ownership_share, role) values
  ('Bryan', 0.3333, 'viewer'),
  ('Andy', 0.3333, 'admin'),
  ('Claire', 0.3333, 'viewer');
```

**Step 5: Seed transactions from Running Expenses sheet**

```sql
insert into transactions (date, category, amount, note) values
  -- June 2025
  ('2025-06-01', 'mortgage', -2454.72, 'Mortgage payment'),
  ('2025-06-15', 'rent', 1650.00, 'Partial month rent'),
  ('2025-06-15', 'management_fee', -95.00, 'Management fee'),
  -- July 2025
  ('2025-07-01', 'mortgage', -2377.11, 'Mortgage payment'),
  ('2025-07-01', 'rent', 1850.00, 'Rent'),
  ('2025-07-01', 'management_fee', -95.00, 'Management fee'),
  ('2025-07-15', 'repair', -400.00, 'Deep cleaning'),
  ('2025-07-15', 'repair', -925.00, 'Lease fee'),
  -- August 2025
  ('2025-08-01', 'mortgage', -2377.11, 'Mortgage payment'),
  ('2025-08-01', 'rent', 1850.00, 'Rent'),
  ('2025-08-01', 'management_fee', -95.00, 'Management fee'),
  ('2025-08-20', 'repair', -150.00, 'Toilet repair'),
  -- September 2025
  ('2025-09-01', 'mortgage', -2377.11, 'Mortgage payment'),
  ('2025-09-01', 'rent', 1850.00, 'Rent'),
  ('2025-09-01', 'management_fee', -95.00, 'Management fee'),
  ('2025-09-10', 'repair', -320.00, 'Plumbing leak investigation'),
  -- October 2025
  ('2025-10-01', 'mortgage', -2377.11, 'Mortgage payment'),
  ('2025-10-01', 'rent', 1850.00, 'Rent'),
  ('2025-10-01', 'management_fee', -95.00, 'Management fee'),
  ('2025-10-05', 'repair', -595.00, 'Irrigation leak'),
  -- November 2025
  ('2025-11-01', 'mortgage', -2377.11, 'Mortgage payment'),
  ('2025-11-01', 'rent', 1850.00, 'Rent'),
  ('2025-11-01', 'management_fee', -95.00, 'Management fee'),
  ('2025-11-10', 'repair', -1550.00, 'Water leak repair'),
  ('2025-11-20', 'repair', -475.00, 'Drywall/tile repair'),
  -- December 2025
  ('2025-12-01', 'mortgage', -2377.11, 'Mortgage payment'),
  ('2025-12-01', 'rent', 1836.50, 'Rent'),
  ('2025-12-01', 'management_fee', -95.00, 'Management fee'),
  ('2025-12-15', 'repair', -300.00, 'Garage door fix');
```

**Step 6: Verify seed data**

Run `mcp__supabase__execute_sql`: `select count(*) from transactions;` — expect 29 rows.
Run: `select * from monthly_summaries;` — expect 7 months of data.

---

### Task 2: Scaffold React + Vite Project

**Step 1: Initialize Vite project**

```bash
cd /Users/bryan/Documents/GitHub/property-equity-dashboard/property-equity-dashboard
npm create vite@latest . -- --template react
```

If prompted about existing files, overwrite. This gives us `package.json`, `vite.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx`.

**Step 2: Install dependencies**

```bash
cd /Users/bryan/Documents/GitHub/property-equity-dashboard/property-equity-dashboard
npm install @supabase/supabase-js recharts lucide-react
npm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p
```

**Step 3: Configure Tailwind**

Write `tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        slate: { 950: '#0f1419' },
        cream: { 50: '#f5f0e8', 100: '#ede5d5' },
        amber: { 400: '#d4a853' },
        rose: { 500: '#c45d5d' },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        body: ['"Source Sans 3"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
```

**Step 4: Set up CSS entry point**

Write `src/index.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=JetBrains+Mono:wght@400;500;600&family=Source+Sans+3:wght@300;400;500;600&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-cream-50 text-gray-900 dark:bg-slate-950 dark:text-gray-100 font-body antialiased;
  }
}
```

**Step 5: Create `.env` file**

Write `.env` (already in .gitignore):

```
VITE_SUPABASE_URL=https://mokjxwwldiyklyzyzsej.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1va2p4d3dsZGl5a2x5enl6c2VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4NTczNTUsImV4cCI6MjA4NTQzMzM1NX0.1peDp5996L-DsWsFACYft5INN9C-fO1u5U0R1saGNls
VITE_PASSCODE=partner2728
VITE_ADMIN_PASSCODE=admin2728
```

**Step 6: Create Supabase client**

Write `src/lib/supabase.js`:

```js
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

**Step 7: Verify dev server starts**

```bash
cd /Users/bryan/Documents/GitHub/property-equity-dashboard/property-equity-dashboard
npm run dev
```

Should start on localhost. Kill after verifying.

**Step 8: Commit**

```bash
git add -A && git commit -m "feat: scaffold React + Vite + Tailwind + Supabase project"
```

---

### Task 3: Projection Calculation Engine

Build the pure-JS calculation functions that compute 10-year projections from property assumptions.

**Step 1: Write projection module**

Write `src/lib/projections.js`:

```js
/**
 * Calculate monthly mortgage payment (P&I only) from loan params.
 */
export function monthlyMortgagePI(loanBalance, annualRate, termYears) {
  const r = annualRate / 12;
  const n = termYears * 12;
  return loanBalance * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

/**
 * Generate 10-year projection array from property assumptions.
 * Returns array of { year, homeValue, loanBalance, equity, cashFlow, taxBenefit }
 */
export function generateProjections(property) {
  const {
    home_value, loan_balance, interest_rate, loan_term_years,
    monthly_escrow, depreciation_annual, home_growth_rate,
    rent_growth_rate, inflation_rate, vacancy_rate,
    effective_tax_rate, pmi_annual, pmi_years,
    monthly_rent, monthly_maintenance, monthly_management,
    property_tax_annual, insurance_annual,
  } = property;

  const monthlyPI = monthlyMortgagePI(loan_balance, interest_rate, loan_term_years);
  const projections = [];
  let currentLoanBalance = loan_balance;

  for (let year = 1; year <= 10; year++) {
    const homeValue = home_value * Math.pow(1 + home_growth_rate, year);
    const rent = monthly_rent * Math.pow(1 + rent_growth_rate, year - 1);
    const maintenance = monthly_maintenance * Math.pow(1 + inflation_rate, year - 1);
    const management = monthly_management;
    const pmi = year <= pmi_years ? pmi_annual / 12 : 0;

    // Annual income
    const grossRent = rent * 12;
    const effectiveRent = grossRent * (1 - vacancy_rate);

    // Annual expenses
    const mortgageAnnual = monthlyPI * 12;
    const escrowAnnual = monthly_escrow * 12;
    const maintenanceAnnual = maintenance * 12;
    const managementAnnual = management * 12;
    const pmiAnnual = pmi * 12;
    const totalExpenses = mortgageAnnual + escrowAnnual + maintenanceAnnual + managementAnnual + pmiAnnual;

    const cashFlow = effectiveRent - totalExpenses;

    // Interest paid this year (approximate from amortization)
    const r = interest_rate / 12;
    let interestThisYear = 0;
    let balanceTemp = currentLoanBalance;
    for (let m = 0; m < 12; m++) {
      const interestPayment = balanceTemp * r;
      const principalPayment = monthlyPI - interestPayment;
      interestThisYear += interestPayment;
      balanceTemp -= principalPayment;
    }
    currentLoanBalance = balanceTemp;

    // Tax benefit from depreciation + interest + expenses
    const deductibleExpenses = interestThisYear + property_tax_annual + insurance_annual +
      maintenanceAnnual + managementAnnual + pmiAnnual + depreciation_annual;
    const taxableIncome = effectiveRent - deductibleExpenses;
    const taxBenefit = taxableIncome < 0 ? Math.abs(taxableIncome) * effective_tax_rate : -(taxableIncome * effective_tax_rate);

    const equity = homeValue - currentLoanBalance;

    projections.push({
      year,
      homeValue: Math.round(homeValue),
      loanBalance: Math.round(currentLoanBalance),
      equity: Math.round(equity),
      cashFlow: Math.round(cashFlow),
      taxBenefit: Math.round(taxBenefit),
    });
  }

  return projections;
}
```

**Step 2: Commit**

```bash
git add src/lib/projections.js && git commit -m "feat: add 10-year projection calculation engine"
```

---

### Task 4: Passcode Gate Component

**Step 1: Write the PasscodeGate component**

Write `src/components/PasscodeGate.jsx`:

A centered, minimal screen with property address heading, single passcode input with gold focus ring, and enter button. Uses localStorage to persist auth state.

Props: `onAuthenticated` callback.

Logic:
- Check localStorage for `dashboard_auth` on mount — if present, call `onAuthenticated()` immediately
- On submit, compare input to `import.meta.env.VITE_PASSCODE`
- On success, set `localStorage.setItem('dashboard_auth', 'true')` and call `onAuthenticated()`
- On failure, show brief error message

**Step 2: Commit**

```bash
git add src/components/PasscodeGate.jsx && git commit -m "feat: add passcode gate component"
```

---

### Task 5: Dashboard Layout & Header

**Step 1: Write the Dashboard component**

Write `src/components/Dashboard.jsx`:

Main dashboard container that:
- Fetches property, partners, and transactions from Supabase on mount
- Manages admin mode state (with admin passcode prompt)
- Passes data down to child components
- Renders: Header, SummaryCards, TransactionTable, EquityChart

Header includes:
- Property name "2728 Partnership" (left)
- Admin toggle button + lock/logout icon (right)
- Admin toggle prompts for `VITE_ADMIN_PASSCODE`, stores in localStorage as `dashboard_admin`

**Step 2: Commit**

```bash
git add src/components/Dashboard.jsx && git commit -m "feat: add dashboard layout with header and admin toggle"
```

---

### Task 6: Summary Cards

**Step 1: Write the SummaryCards component**

Write `src/components/SummaryCards.jsx`:

Three cards in a responsive grid:

1. **Your Equity** — Computed from projections: current year's equity * ownership_share. Shows month-over-month delta.
2. **This Month's Cash Flow** — From monthly_summaries for current month * ownership_share.
3. **Running Balance** — Sum of all transaction amounts * ownership_share.

Each card:
- Playfair Display label
- JetBrains Mono large number (green/amber for positive, rose for negative)
- Small subtitle with context
- Staggered fade-in animation via CSS `animation-delay`
- Count-up effect on the number (simple setInterval from 0 to target)

**Step 2: Commit**

```bash
git add src/components/SummaryCards.jsx && git commit -m "feat: add summary cards with equity, cash flow, running balance"
```

---

### Task 7: Transaction Table & Admin Input

**Step 1: Write the TransactionTable component**

Write `src/components/TransactionTable.jsx`:

- Displays transactions sorted by date desc
- Columns: Date, Category (color-coded badge), Note, Amount
- Initially shows 15 rows with "View all" toggle to expand
- Category badges: mortgage=slate, rent=amber, repair=rose, management_fee=gray, other=neutral
- Hover lift effect on rows

**Step 2: Write the AddTransaction component**

Write `src/components/AddTransaction.jsx`:

- Inline form row that appears at top of table when admin mode is active
- Fields: date (input type="date"), amount (number input), category (select dropdown), note (text input)
- Submit button saves to Supabase `transactions` table
- On success, clears form and calls `onTransactionAdded` callback to refresh data
- Amount input: user enters positive number, selects income/expense toggle, amount stored accordingly

**Step 3: Commit**

```bash
git add src/components/TransactionTable.jsx src/components/AddTransaction.jsx && git commit -m "feat: add transaction table with admin input form"
```

---

### Task 8: Equity Projection Chart

**Step 1: Write the EquityChart component**

Write `src/components/EquityChart.jsx`:

- Recharts AreaChart showing 10-year equity projection
- X-axis: Year (1-10), Y-axis: Dollar amount
- Single gradient-filled area in amber/gold
- Toggle button: "Total Property" vs "Your Share (33%)"
- Responsive container, full width
- Tooltip showing year, equity value, cash flow
- Progressive draw-in animation

**Step 2: Commit**

```bash
git add src/components/EquityChart.jsx && git commit -m "feat: add equity projection area chart"
```

---

### Task 9: Wire Everything Together in App.jsx

**Step 1: Write App.jsx**

Wire `PasscodeGate` and `Dashboard` together:

```jsx
function App() {
  const [authenticated, setAuthenticated] = useState(
    () => localStorage.getItem('dashboard_auth') === 'true'
  );

  if (!authenticated) {
    return <PasscodeGate onAuthenticated={() => setAuthenticated(true)} />;
  }

  return <Dashboard />;
}
```

**Step 2: Update index.html**

Add Google Fonts preconnect links in `<head>` for Playfair Display, JetBrains Mono, Source Sans 3. Set page title to "2728 Partnership Dashboard".

**Step 3: Verify full app runs**

```bash
npm run dev
```

Open in browser, verify:
- Passcode gate appears
- Entering `partner2728` shows dashboard
- Summary cards display with real data from Supabase
- Transactions table loads with seeded data
- Equity chart renders
- Admin toggle works with `admin2728`
- Add transaction form appears and works

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: wire up complete dashboard with passcode gate"
```

---

### Task 10: Visual Polish & Responsive Design

**Step 1: Add background grain texture**

Add a subtle SVG noise texture overlay to the body/main container via CSS.

**Step 2: Add gold separator lines**

Thin `border-b border-amber-400/20` between major sections.

**Step 3: Mobile responsive tweaks**

- Cards stack on `sm:` breakpoint
- Transaction table becomes card list on mobile
- Chart stays full-width
- Test on 375px viewport

**Step 4: Final visual pass**

- Verify dark mode (system preference) works correctly
- Check all font weights and sizes
- Ensure proper spacing/whitespace per design spec

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add visual polish, grain texture, responsive layout"
```

---

### Task 11: Final Verification

**Step 1: Run build**

```bash
npm run build
```

Verify no errors.

**Step 2: Run preview**

```bash
npm run preview
```

Open in browser and verify full functionality matches design spec.

**Step 3: Final commit if any remaining changes**

```bash
git add -A && git commit -m "chore: production build verification"
```

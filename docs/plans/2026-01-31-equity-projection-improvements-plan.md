# Equity Projection Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add real-time equity tracking with value history, auto-amortization, adjustable projection assumptions, and scenario comparison to the property equity dashboard.

**Architecture:** Supabase Postgres stores value/balance history. Client-side `amortization.js` auto-calculates loan balance. `projections.js` accepts a `rateOffset` param and emits Year 0. Dashboard fetches history tables and derives current values. Two new admin UI surfaces: a quick "Update Values" modal and an inline "Projection Settings" panel.

**Tech Stack:** React 19, Vite 7, Recharts 3, Supabase (Postgres + JS client), Tailwind CSS 3

---

### Task 1: Database — Create history tables and alter property

**Context:** The Supabase project ID is `mokjxwwldiyklyzyzsej`. There are two existing migrations: `create_tables` and `add_rls_policies`. The property table has 1 row with `loan_balance = 274803.87`, `home_value = 330000`, `interest_rate = 0.0599`, `purchase_price = 332500`.

**Step 1: Apply migration to create `property_value_history` table**

Use the Supabase MCP `apply_migration` tool:

- **name:** `create_property_value_history`
- **query:**
```sql
CREATE TABLE property_value_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at date NOT NULL,
  home_value numeric NOT NULL,
  source text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE property_value_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read on property_value_history"
  ON property_value_history FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert on property_value_history"
  ON property_value_history FOR INSERT TO anon WITH CHECK (true);
```

**Step 2: Apply migration to create `loan_balance_history` table**

- **name:** `create_loan_balance_history`
- **query:**
```sql
CREATE TABLE loan_balance_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at date NOT NULL,
  balance numeric NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE loan_balance_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read on loan_balance_history"
  ON loan_balance_history FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert on loan_balance_history"
  ON loan_balance_history FOR INSERT TO anon WITH CHECK (true);
```

**Step 3: Apply migration to add columns to `property`**

- **name:** `add_loan_origination_columns`
- **query:**
```sql
ALTER TABLE property
  ADD COLUMN loan_start_date date,
  ADD COLUMN original_loan_amount numeric;

UPDATE property
  SET loan_start_date = '2024-12-19',
      original_loan_amount = 274803.87;
```

Note: `original_loan_amount` is set to the current `loan_balance` value since this was the balance at the time the data was seeded. The `loan_start_date` of 2024-12-19 matches the spreadsheet date. The implementer should confirm these values with the user if uncertain.

**Step 4: Seed history tables with initial values**

Use `execute_sql`:

```sql
INSERT INTO property_value_history (recorded_at, home_value, source, note)
VALUES ('2024-12-19', 330000, 'Appraisal', 'Initial seeded value from equity spreadsheet V4');

INSERT INTO loan_balance_history (recorded_at, balance, note)
VALUES ('2024-12-19', 274803.87, 'Initial seeded value from equity spreadsheet V4');
```

**Step 5: Verify**

Run `execute_sql`:

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'property' AND column_name IN ('loan_start_date', 'original_loan_amount');
```

And:

```sql
SELECT * FROM property_value_history;
SELECT * FROM loan_balance_history;
```

Expected: both new columns exist, both history tables have 1 row each.

**Step 6: Commit**

```bash
git add -A && git commit -m "chore: database migrations for value history and loan origination columns"
```

Note: There are no local migration files in this project — all migrations are applied via the Supabase MCP tool. This commit is just a checkpoint.

---

### Task 2: Create amortization utility

**Files:**
- Create: `property-equity-dashboard/src/lib/amortization.js`

**Context:** This utility auto-calculates the remaining loan balance as of today, given origination details. Uses the same `monthlyMortgagePI` formula from `projections.js:4-8`. The property table will have `original_loan_amount`, `interest_rate`, `loan_term_years`, and `loan_start_date`.

**Step 1: Create `amortization.js`**

Create file `property-equity-dashboard/src/lib/amortization.js`:

```js
import { monthlyMortgagePI } from './projections';

/**
 * Calculate remaining loan balance as of today by stepping through
 * each elapsed month since loan origination.
 *
 * @param {Object} params
 * @param {number} params.originalLoanAmount - Initial principal
 * @param {number} params.annualRate - Annual interest rate (e.g. 0.0599)
 * @param {number} params.termYears - Loan term in years (e.g. 30)
 * @param {string} params.loanStartDate - ISO date string (e.g. '2024-12-19')
 * @returns {number} Remaining balance rounded to 2 decimal places
 */
export function calculateCurrentBalance({
  originalLoanAmount,
  annualRate,
  termYears,
  loanStartDate,
}) {
  const monthlyPayment = monthlyMortgagePI(originalLoanAmount, annualRate, termYears);
  const monthlyRate = annualRate / 12;

  const start = new Date(loanStartDate);
  const now = new Date();

  // Count full months elapsed
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());

  // If we haven't reached the start day this month, subtract one
  if (now.getDate() < start.getDate()) {
    months -= 1;
  }

  months = Math.max(0, months);

  let balance = originalLoanAmount;
  for (let m = 0; m < months; m++) {
    const interest = balance * monthlyRate;
    const principal = monthlyPayment - interest;
    balance -= principal;
    if (balance <= 0) return 0;
  }

  return Math.round(balance * 100) / 100;
}

/**
 * Determine the effective current loan balance.
 * Prefers manual override from loan_balance_history if it's more recent
 * than the auto-calculated value's reference point.
 *
 * @param {Object} property - Property row from Supabase
 * @param {Object|null} latestOverride - Most recent loan_balance_history row, or null
 * @returns {number} The effective current loan balance
 */
export function getEffectiveLoanBalance(property, latestOverride) {
  const hasOrigination =
    property.original_loan_amount && property.loan_start_date;

  if (!hasOrigination) {
    // Fallback: use manual override or static property value
    return latestOverride
      ? Number(latestOverride.balance)
      : Number(property.loan_balance);
  }

  const calculated = calculateCurrentBalance({
    originalLoanAmount: Number(property.original_loan_amount),
    annualRate: Number(property.interest_rate),
    termYears: property.loan_term_years,
    loanStartDate: property.loan_start_date,
  });

  if (!latestOverride) return calculated;

  // If the override is from this month or later, prefer it
  const overrideDate = new Date(latestOverride.recorded_at);
  const now = new Date();
  const overrideMonth =
    overrideDate.getFullYear() * 12 + overrideDate.getMonth();
  const currentMonth = now.getFullYear() * 12 + now.getMonth();

  if (overrideMonth >= currentMonth) {
    return Number(latestOverride.balance);
  }

  // Otherwise, the auto-calc is more current
  return calculated;
}
```

**Step 2: Verify the build compiles**

```bash
cd property-equity-dashboard && npm run build
```

Expected: Build succeeds with no errors.

**Step 3: Commit**

```bash
git add src/lib/amortization.js && git commit -m "feat: add amortization utility for auto-calculating loan balance"
```

---

### Task 3: Update projection logic — rateOffset and Year 0

**Files:**
- Modify: `property-equity-dashboard/src/lib/projections.js`

**Context:** Currently `generateProjections(property)` returns an array of 10 objects (year 1-10). We need to:
1. Accept a second parameter `{ rateOffset = 0 }` that offsets `home_growth_rate`
2. Prepend a Year 0 "Now" entry with current values
3. Accept `currentHomeValue` and `currentLoanBalance` as overrides (derived by Dashboard from history tables)

**Step 1: Update `generateProjections` signature and logic**

Replace the entire contents of `property-equity-dashboard/src/lib/projections.js` with:

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
 *
 * @param {Object} property - Property row from Supabase
 * @param {Object} [options]
 * @param {number} [options.rateOffset=0] - Offset applied to home_growth_rate (e.g. 0.02 for optimistic)
 * @param {number} [options.currentHomeValue] - Override starting home value (from history)
 * @param {number} [options.currentLoanBalance] - Override starting loan balance (from amortization/history)
 * @returns {Array<Object>} Array of { year, homeValue, loanBalance, equity, cashFlow, taxBenefit }
 *   Year 0 = "Now" (current actual values), Years 1-10 = projections
 */
export function generateProjections(property, options = {}) {
  const {
    rateOffset = 0,
    currentHomeValue,
    currentLoanBalance,
  } = options;

  const {
    home_value, loan_balance, interest_rate, loan_term_years,
    monthly_escrow, depreciation_annual, home_growth_rate,
    rent_growth_rate, inflation_rate, vacancy_rate,
    effective_tax_rate, pmi_annual, pmi_years,
    monthly_rent, monthly_maintenance, monthly_management,
    property_tax_annual, insurance_annual,
  } = property;

  const startHomeValue = currentHomeValue ?? Number(home_value);
  const startLoanBalance = currentLoanBalance ?? Number(loan_balance);
  const growthRate = Number(home_growth_rate) + rateOffset;

  const monthlyPI = monthlyMortgagePI(startLoanBalance, Number(interest_rate), loan_term_years);
  const projections = [];
  let currentLB = startLoanBalance;

  // Year 0: "Now" — actual current values, no projection math
  projections.push({
    year: 0,
    homeValue: Math.round(startHomeValue),
    loanBalance: Math.round(startLoanBalance),
    equity: Math.round(startHomeValue - startLoanBalance),
    cashFlow: 0,
    taxBenefit: 0,
  });

  for (let year = 1; year <= 10; year++) {
    const homeValue = startHomeValue * Math.pow(1 + growthRate, year);
    const rent = Number(monthly_rent) * Math.pow(1 + Number(rent_growth_rate), year - 1);
    const maintenance = Number(monthly_maintenance) * Math.pow(1 + Number(inflation_rate), year - 1);
    const management = Number(monthly_management);
    const pmi = year <= pmi_years ? Number(pmi_annual) / 12 : 0;

    // Annual income
    const grossRent = rent * 12;
    const effectiveRent = grossRent * (1 - Number(vacancy_rate));

    // Annual expenses
    const mortgageAnnual = monthlyPI * 12;
    const escrowAnnual = Number(monthly_escrow) * 12;
    const maintenanceAnnual = maintenance * 12;
    const managementAnnual = management * 12;
    const pmiAnnual = pmi * 12;
    const totalExpenses = mortgageAnnual + escrowAnnual + maintenanceAnnual + managementAnnual + pmiAnnual;

    const cashFlow = effectiveRent - totalExpenses;

    // Interest paid this year (approximate from amortization)
    const r = Number(interest_rate) / 12;
    let interestThisYear = 0;
    let balanceTemp = currentLB;
    for (let m = 0; m < 12; m++) {
      const interestPayment = balanceTemp * r;
      const principalPayment = monthlyPI - interestPayment;
      interestThisYear += interestPayment;
      balanceTemp -= principalPayment;
    }
    currentLB = balanceTemp;

    // Tax benefit from depreciation + interest + expenses
    const deductibleExpenses = interestThisYear + Number(property_tax_annual) + Number(insurance_annual) +
      maintenanceAnnual + managementAnnual + pmiAnnual + Number(depreciation_annual);
    const taxableIncome = effectiveRent - deductibleExpenses;
    const taxBenefit = taxableIncome < 0 ? Math.abs(taxableIncome) * Number(effective_tax_rate) : -(taxableIncome * Number(effective_tax_rate));

    const equity = homeValue - currentLB;

    projections.push({
      year,
      homeValue: Math.round(homeValue),
      loanBalance: Math.round(currentLB),
      equity: Math.round(equity),
      cashFlow: Math.round(cashFlow),
      taxBenefit: Math.round(taxBenefit),
    });
  }

  return projections;
}
```

**Step 2: Verify the build compiles**

```bash
cd property-equity-dashboard && npm run build
```

Expected: Build succeeds. The chart may look slightly different (Year 0 added) but the app should still load.

**Step 3: Commit**

```bash
git add src/lib/projections.js && git commit -m "feat: add rateOffset, Year 0, and value overrides to projection engine"
```

---

### Task 4: Update Dashboard to fetch history and derive current values

**Files:**
- Modify: `property-equity-dashboard/src/components/Dashboard.jsx`

**Context:** Dashboard currently fetches `property`, `partners`, `transactions` on mount and computes `projections` from static property data. We need to:
1. Also fetch `property_value_history` (latest row) and `loan_balance_history` (latest row)
2. Derive current home value and loan balance using `getEffectiveLoanBalance`
3. Generate three sets of projections (pessimistic, base, optimistic)
4. Pass `isAdmin`, `property`, refresh callbacks, and history data to new child components
5. Add state for the "Update Values" modal

**Step 1: Rewrite Dashboard.jsx**

Replace the entire contents of `property-equity-dashboard/src/components/Dashboard.jsx` with:

```jsx
import { useState, useEffect, useCallback } from 'react';
import { Shield, ShieldCheck, LogOut, PencilLine } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateProjections } from '../lib/projections';
import { getEffectiveLoanBalance } from '../lib/amortization';
import SummaryCards from './SummaryCards';
import EquityChart from './EquityChart';
import TransactionTable from './TransactionTable';
import UpdateValuesModal from './UpdateValuesModal';

export default function Dashboard() {
  const [property, setProperty] = useState(null);
  const [partners, setPartners] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [latestHomeValue, setLatestHomeValue] = useState(null);
  const [latestLoanOverride, setLatestLoanOverride] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(
    () => localStorage.getItem('dashboard_admin') === 'true'
  );
  const [showUpdateValues, setShowUpdateValues] = useState(false);

  // Fetch all data on mount
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [propertyRes, partnersRes, transactionsRes, homeValueRes, loanOverrideRes] =
        await Promise.all([
          supabase.from('property').select('*').single(),
          supabase.from('partners').select('*'),
          supabase.from('transactions').select('*').order('date', { ascending: false }),
          supabase
            .from('property_value_history')
            .select('*')
            .order('recorded_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('loan_balance_history')
            .select('*')
            .order('recorded_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

      if (propertyRes.data) setProperty(propertyRes.data);
      if (partnersRes.data) setPartners(partnersRes.data);
      if (transactionsRes.data) setTransactions(transactionsRes.data);
      if (homeValueRes.data) setLatestHomeValue(homeValueRes.data);
      if (loanOverrideRes.data) setLatestLoanOverride(loanOverrideRes.data);

      setLoading(false);
    }

    fetchData();
  }, []);

  // Refresh transactions (passed to child components)
  const refreshTransactions = useCallback(async () => {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });
    if (data) setTransactions(data);
  }, []);

  // Refresh history data (called after UpdateValuesModal saves)
  const refreshHistory = useCallback(async () => {
    const [homeValueRes, loanOverrideRes] = await Promise.all([
      supabase
        .from('property_value_history')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('loan_balance_history')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (homeValueRes.data) setLatestHomeValue(homeValueRes.data);
    else setLatestHomeValue(null);
    if (loanOverrideRes.data) setLatestLoanOverride(loanOverrideRes.data);
    else setLatestLoanOverride(null);
  }, []);

  // Refresh property (called after ProjectionSettings saves)
  const refreshProperty = useCallback(async () => {
    const { data } = await supabase.from('property').select('*').single();
    if (data) setProperty(data);
  }, []);

  // Admin toggle handler
  function handleAdminToggle() {
    if (isAdmin) {
      localStorage.removeItem('dashboard_admin');
      setIsAdmin(false);
    } else {
      const entered = window.prompt('Enter admin passcode');
      if (entered && entered === import.meta.env.VITE_ADMIN_PASSCODE) {
        localStorage.setItem('dashboard_admin', 'true');
        setIsAdmin(true);
      }
    }
  }

  // Logout handler
  function handleLogout() {
    localStorage.removeItem('dashboard_auth');
    localStorage.removeItem('dashboard_admin');
    window.location.reload();
  }

  // Derive current values from history
  const currentHomeValue = property
    ? latestHomeValue
      ? Number(latestHomeValue.home_value)
      : Number(property.home_value)
    : 0;

  const currentLoanBalance = property
    ? getEffectiveLoanBalance(property, latestLoanOverride)
    : 0;

  // Compute three scenario projections
  const baseProjections = property
    ? generateProjections(property, {
        currentHomeValue,
        currentLoanBalance,
      })
    : [];

  const optimisticProjections = property
    ? generateProjections(property, {
        rateOffset: 0.02,
        currentHomeValue,
        currentLoanBalance,
      })
    : [];

  const pessimisticProjections = property
    ? generateProjections(property, {
        rateOffset: -0.02,
        currentHomeValue,
        currentLoanBalance,
      })
    : [];

  // Derive ownership share from partners (default to 1 if no partner data)
  const ownershipShare =
    partners.length > 0 ? partners[0].ownership_share : 1;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50 dark:bg-slate-950">
        <p className="font-mono text-sm text-gray-500 dark:text-gray-400 animate-pulse">
          Loading dashboard...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-50 dark:bg-slate-950 text-gray-900 dark:text-gray-100">
      {/* Noise texture overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-50">
        <svg width="100%" height="100%">
          <filter id="noise">
            <feTurbulence
              baseFrequency="0.65"
              numOctaves="3"
              stitchTiles="stitch"
            />
          </filter>
          <rect width="100%" height="100%" filter="url(#noise)" />
        </svg>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 mb-8 pb-4 border-b border-amber-400/20">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold">
            2728 Partnership
          </h1>
          <div className="flex items-center gap-3">
            {/* Update Values button (admin only) */}
            {isAdmin && (
              <button
                onClick={() => setShowUpdateValues(true)}
                title="Update property values"
                className="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-amber-400 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <PencilLine size={20} />
              </button>
            )}

            {/* Admin toggle */}
            <button
              onClick={handleAdminToggle}
              title={isAdmin ? 'Disable admin mode' : 'Enable admin mode'}
              className={[
                'p-2 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                isAdmin
                  ? 'text-amber-400 hover:text-amber-300 bg-amber-400/10'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300',
              ].join(' ')}
            >
              {isAdmin ? <ShieldCheck size={20} /> : <Shield size={20} />}
            </button>

            {/* Lock / logout icon */}
            <button
              onClick={handleLogout}
              title="Log out"
              className="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-rose-500 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {/* Summary Cards */}
        <SummaryCards
          property={property}
          transactions={transactions}
          projections={baseProjections}
          ownershipShare={ownershipShare}
          currentHomeValue={currentHomeValue}
          currentLoanBalance={currentLoanBalance}
        />

        {/* Gold separator */}
        <div className="border-b border-amber-400/20 my-8" />

        {/* Transactions */}
        <TransactionTable
          transactions={transactions}
          isAdmin={isAdmin}
          onTransactionAdded={refreshTransactions}
        />

        {/* Gold separator */}
        <div className="border-b border-amber-400/20 my-8" />

        {/* Equity Chart */}
        <EquityChart
          baseProjections={baseProjections}
          optimisticProjections={optimisticProjections}
          pessimisticProjections={pessimisticProjections}
          ownershipShare={ownershipShare}
          isAdmin={isAdmin}
          property={property}
          onPropertySaved={refreshProperty}
        />
      </div>

      {/* Update Values Modal */}
      {showUpdateValues && (
        <UpdateValuesModal
          property={property}
          latestHomeValue={latestHomeValue}
          latestLoanOverride={latestLoanOverride}
          currentCalculatedBalance={
            property?.original_loan_amount && property?.loan_start_date
              ? getEffectiveLoanBalance(property, null)
              : null
          }
          onClose={() => setShowUpdateValues(false)}
          onSaved={refreshHistory}
        />
      )}
    </div>
  );
}
```

**Step 2: Verify the build compiles**

The build will fail because `UpdateValuesModal` doesn't exist yet. That's expected — create a placeholder:

Create `property-equity-dashboard/src/components/UpdateValuesModal.jsx`:

```jsx
export default function UpdateValuesModal() {
  return null;
}
```

Then run:

```bash
cd property-equity-dashboard && npm run build
```

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/components/Dashboard.jsx src/components/UpdateValuesModal.jsx && git commit -m "feat: wire Dashboard to history tables and three-scenario projections"
```

---

### Task 5: Update SummaryCards to use real current equity

**Files:**
- Modify: `property-equity-dashboard/src/components/SummaryCards.jsx`

**Context:** SummaryCards currently reads equity from `projections[0].equity` (Year 1 projected). Now that projections include Year 0 (actual current values), we should use `projections[0]` which is Year 0. The component also receives new props `currentHomeValue` and `currentLoanBalance` from Dashboard, but since Year 0 already reflects these, we just need to adjust the index for the equity delta calculation (Year 2 - Year 1 becomes index 2 - index 1, since index 0 is now "Now").

**Step 1: Update the equity and delta calculations**

In `property-equity-dashboard/src/components/SummaryCards.jsx`, update the props and equity computation.

Change the component signature to accept the new props (even if unused now, Dashboard passes them):

```jsx
export default function SummaryCards({
  property,
  transactions = [],
  projections = [],
  ownershipShare = 1,
  currentHomeValue,
  currentLoanBalance,
}) {
```

Update the equity calculation — `projections[0]` is now Year 0 (current actual):

```jsx
  // Card 1: Your Equity (Year 0 = current actual values)
  const equity =
    projections.length > 0
      ? Math.round(projections[0].equity * ownershipShare)
      : 0;

  // Delta: equity growth per month estimate (Year 2 - Year 1) / 12
  // projections[1] = Year 1, projections[2] = Year 2
  const equityDelta =
    projections.length >= 3
      ? Math.round(
          ((projections[2].equity - projections[1].equity) * ownershipShare) / 12
        )
      : 0;
```

No other changes needed — the rest of the component stays the same.

**Step 2: Verify the build compiles**

```bash
cd property-equity-dashboard && npm run build
```

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/components/SummaryCards.jsx && git commit -m "feat: show actual current equity from Year 0 in summary cards"
```

---

### Task 6: Update EquityChart with three scenario bands and Year 0

**Files:**
- Modify: `property-equity-dashboard/src/components/EquityChart.jsx`

**Context:** The chart currently takes `projections` and `ownershipShare`. It needs to accept `baseProjections`, `optimisticProjections`, `pessimisticProjections`, and render three lines. It also needs to pass through `isAdmin`, `property`, and `onPropertySaved` for the Projection Settings gear icon (implemented in Task 7).

**Step 1: Rewrite EquityChart.jsx**

Replace the entire contents of `property-equity-dashboard/src/components/EquityChart.jsx` with:

```jsx
import { useState } from 'react';
import { Settings } from 'lucide-react';
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';
import ProjectionSettings from './ProjectionSettings';

const formatCurrency = (value) => {
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
};

const currencyFull = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  const base = payload.find((p) => p.dataKey === 'base');
  const optimistic = payload.find((p) => p.dataKey === 'optimistic');
  const pessimistic = payload.find((p) => p.dataKey === 'pessimistic');

  return (
    <div
      className="rounded-lg px-4 py-3 shadow-lg border"
      style={{
        backgroundColor: '#1a1a2e',
        borderColor: '#d4a853',
      }}
    >
      <p className="text-xs font-body text-gray-400 mb-2">{label}</p>
      {optimistic && (
        <p className="text-xs font-mono text-amber-300/70">
          Optimistic: {currencyFull.format(optimistic.value)}
        </p>
      )}
      {base && (
        <p className="text-sm font-mono text-amber-400 font-semibold">
          Base: {currencyFull.format(base.value)}
        </p>
      )}
      {pessimistic && (
        <p className="text-xs font-mono text-gray-400">
          Pessimistic: {currencyFull.format(pessimistic.value)}
        </p>
      )}
    </div>
  );
}

export default function EquityChart({
  baseProjections = [],
  optimisticProjections = [],
  pessimisticProjections = [],
  ownershipShare = 1,
  isAdmin = false,
  property = null,
  onPropertySaved,
}) {
  const [showMyShare, setShowMyShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const sharePercent = Math.round(ownershipShare * 100);

  const applyShare = (val) =>
    showMyShare ? Math.round(val * ownershipShare) : val;

  const chartData = baseProjections.map((p, i) => ({
    year: p.year === 0 ? 'Now' : `Yr ${p.year}`,
    base: applyShare(p.equity),
    optimistic: applyShare(optimisticProjections[i]?.equity ?? p.equity),
    pessimistic: applyShare(pessimisticProjections[i]?.equity ?? p.equity),
  }));

  return (
    <div
      className={[
        'rounded-xl border transition-colors',
        'bg-white/60 border-cream-100',
        'dark:bg-gray-900/50 dark:border-gray-800',
      ].join(' ')}
    >
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 pb-2">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
            EQUITY PROJECTION
          </h2>
          {isAdmin && (
            <button
              onClick={() => setShowSettings(!showSettings)}
              title="Projection settings"
              className={[
                'p-1.5 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                showSettings
                  ? 'text-amber-400 bg-amber-400/10'
                  : 'text-gray-400 dark:text-gray-500 hover:text-amber-400',
              ].join(' ')}
            >
              <Settings size={16} />
            </button>
          )}
        </div>

        {/* Toggle buttons */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800/60 rounded-full p-0.5">
          <button
            onClick={() => setShowMyShare(false)}
            className={[
              'px-3 py-1 rounded-full text-xs font-body font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
              !showMyShare
                ? 'bg-amber-400 text-gray-900 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
            ].join(' ')}
          >
            Total Property
          </button>
          <button
            onClick={() => setShowMyShare(true)}
            className={[
              'px-3 py-1 rounded-full text-xs font-body font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
              showMyShare
                ? 'bg-amber-400 text-gray-900 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
            ].join(' ')}
          >
            Your Share ({sharePercent}%)
          </button>
        </div>
      </div>

      {/* Projection Settings (inline, below header) */}
      {showSettings && property && (
        <ProjectionSettings
          property={property}
          onSaved={onPropertySaved}
        />
      )}

      {/* Chart */}
      <div className="px-3 pb-3 pt-2">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
          >
            <defs>
              <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#d4a853" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#d4a853" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="bandGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#d4a853" stopOpacity={0.06} />
                <stop offset="95%" stopColor="#d4a853" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="currentColor"
              className="text-gray-200 dark:text-gray-800"
              opacity={0.3}
            />

            <XAxis
              dataKey="year"
              tick={{ fontSize: 12, fontFamily: 'Source Sans 3, sans-serif' }}
              stroke="#9ca3af"
              tickLine={false}
              axisLine={{ stroke: '#9ca3af', strokeOpacity: 0.3 }}
            />

            <YAxis
              tickFormatter={formatCurrency}
              tick={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
              stroke="#9ca3af"
              tickLine={false}
              axisLine={false}
              width={55}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Optimistic line (dashed, above) */}
            <Line
              type="monotone"
              dataKey="optimistic"
              stroke="#d4a853"
              strokeWidth={1}
              strokeDasharray="4 4"
              strokeOpacity={0.4}
              dot={false}
              isAnimationActive={true}
              animationDuration={1500}
            />

            {/* Base area (solid fill) */}
            <Area
              type="monotone"
              dataKey="base"
              stroke="#d4a853"
              strokeWidth={2}
              fill="url(#equityGradient)"
              isAnimationActive={true}
              animationDuration={1500}
              animationEasing="ease-out"
            />

            {/* Pessimistic line (dashed, below) */}
            <Line
              type="monotone"
              dataKey="pessimistic"
              stroke="#9ca3af"
              strokeWidth={1}
              strokeDasharray="4 4"
              strokeOpacity={0.5}
              dot={false}
              isAnimationActive={true}
              animationDuration={1500}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 pb-4 text-[11px] font-body text-gray-400 dark:text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5 bg-amber-400 rounded" />
          Base
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5 bg-amber-400/40 rounded" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #d4a853 0, #d4a853 3px, transparent 3px, transparent 6px)' }} />
          +2%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5 bg-gray-400/50 rounded" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #9ca3af 0, #9ca3af 3px, transparent 3px, transparent 6px)' }} />
          -2%
        </span>
      </div>
    </div>
  );
}
```

**Step 2: Create ProjectionSettings placeholder**

Create `property-equity-dashboard/src/components/ProjectionSettings.jsx`:

```jsx
export default function ProjectionSettings() {
  return null;
}
```

**Step 3: Verify the build compiles**

```bash
cd property-equity-dashboard && npm run build
```

Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/components/EquityChart.jsx src/components/ProjectionSettings.jsx && git commit -m "feat: add scenario bands, Year 0 anchor, and legend to equity chart"
```

---

### Task 7: Build UpdateValuesModal

**Files:**
- Modify: `property-equity-dashboard/src/components/UpdateValuesModal.jsx` (replace placeholder)

**Context:** This is a modal with two sections: Home Value Update and Loan Balance Override. It inserts rows into `property_value_history` and `loan_balance_history`. It matches the existing dark/cream aesthetic. See `AddTransaction.jsx` for the styling pattern (input classes, button classes, etc.).

**Step 1: Implement UpdateValuesModal**

Replace the contents of `property-equity-dashboard/src/components/UpdateValuesModal.jsx` with:

```jsx
import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';

const SOURCES = ['Zillow', 'Redfin', 'Appraisal', 'Other'];

const currencyFull = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const inputBase =
  'rounded-md border bg-transparent px-3 py-2 text-sm transition-colors w-full ' +
  'border-gray-300 dark:border-gray-700 ' +
  'focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400 ' +
  'placeholder:text-gray-400 dark:placeholder:text-gray-600';

export default function UpdateValuesModal({
  property,
  latestHomeValue,
  latestLoanOverride,
  currentCalculatedBalance,
  onClose,
  onSaved,
}) {
  // Home value state
  const [homeValue, setHomeValue] = useState('');
  const [source, setSource] = useState('Zillow');
  const [homeNote, setHomeNote] = useState('');
  const [homeDate, setHomeDate] = useState(todayISO);

  // Loan balance state
  const [overrideLoan, setOverrideLoan] = useState(false);
  const [loanBalance, setLoanBalance] = useState('');
  const [loanNote, setLoanNote] = useState('');
  const [loanDate, setLoanDate] = useState(todayISO);

  const [submitting, setSubmitting] = useState(false);

  const currentHomeDisplay = latestHomeValue
    ? Number(latestHomeValue.home_value)
    : Number(property.home_value);

  const lastUpdatedDate = latestHomeValue?.recorded_at ?? null;

  async function handleSave() {
    setSubmitting(true);

    const promises = [];

    // Insert home value if provided
    if (homeValue && Number(homeValue) > 0) {
      promises.push(
        supabase.from('property_value_history').insert({
          recorded_at: homeDate,
          home_value: Number(homeValue),
          source,
          note: homeNote || null,
        })
      );
    }

    // Insert loan override if toggled on and value provided
    if (overrideLoan && loanBalance && Number(loanBalance) > 0) {
      promises.push(
        supabase.from('loan_balance_history').insert({
          recorded_at: loanDate,
          balance: Number(loanBalance),
          note: loanNote || null,
        })
      );
    }

    if (promises.length > 0) {
      await Promise.all(promises);
      onSaved?.();
    }

    setSubmitting(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-xl border bg-white dark:bg-gray-900 border-cream-100 dark:border-gray-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-100 dark:border-gray-800">
          <h2 className="font-display text-lg font-semibold">Update Values</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-6">
          {/* --- Home Value Section --- */}
          <div>
            <h3 className="text-[11px] uppercase tracking-widest font-body text-gray-500 dark:text-gray-400 mb-3">
              Home Value
            </h3>
            <p className="text-sm font-body text-gray-500 dark:text-gray-400 mb-1">
              Current: <span className="font-mono text-amber-400">{currencyFull.format(currentHomeDisplay)}</span>
              {lastUpdatedDate && (
                <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                  (updated {lastUpdatedDate})
                </span>
              )}
            </p>

            <div className="space-y-2 mt-2">
              <input
                type="number"
                step="1000"
                min="0"
                value={homeValue}
                onChange={(e) => setHomeValue(e.target.value)}
                placeholder="New estimated value"
                className={`${inputBase} font-mono`}
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={homeDate}
                  onChange={(e) => setHomeDate(e.target.value)}
                  className={`${inputBase} flex-1`}
                />
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className={`${inputBase} flex-1`}
                >
                  {SOURCES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                value={homeNote}
                onChange={(e) => setHomeNote(e.target.value)}
                placeholder="Note (optional)"
                className={inputBase}
              />
            </div>
          </div>

          {/* --- Loan Balance Section --- */}
          <div>
            <h3 className="text-[11px] uppercase tracking-widest font-body text-gray-500 dark:text-gray-400 mb-3">
              Loan Balance
            </h3>

            {currentCalculatedBalance != null && (
              <p className="text-sm font-body text-gray-500 dark:text-gray-400 mb-1">
                Calculated: <span className="font-mono text-gray-300">{currencyFull.format(currentCalculatedBalance)}</span>
              </p>
            )}

            {latestLoanOverride && (
              <p className="text-sm font-body text-gray-500 dark:text-gray-400 mb-1">
                Last override: <span className="font-mono text-amber-400">{currencyFull.format(Number(latestLoanOverride.balance))}</span>
                <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                  ({latestLoanOverride.recorded_at})
                </span>
              </p>
            )}

            {/* Override toggle */}
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={overrideLoan}
                onChange={(e) => setOverrideLoan(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-amber-400 focus:ring-amber-400"
              />
              <span className="text-sm font-body text-gray-600 dark:text-gray-300">
                Override with actual balance
              </span>
            </label>

            {overrideLoan && (
              <div className="space-y-2 mt-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={loanBalance}
                  onChange={(e) => setLoanBalance(e.target.value)}
                  placeholder="Actual balance from statement"
                  className={`${inputBase} font-mono`}
                />
                <input
                  type="date"
                  value={loanDate}
                  onChange={(e) => setLoanDate(e.target.value)}
                  className={inputBase}
                />
                <input
                  type="text"
                  value={loanNote}
                  onChange={(e) => setLoanNote(e.target.value)}
                  placeholder="Note (optional)"
                  className={inputBase}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-cream-100 dark:border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm font-body text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={submitting}
            className="px-4 py-2 rounded-md bg-amber-400 text-slate-950 text-sm font-semibold
              hover:bg-amber-400/80 transition-colors disabled:opacity-50 cursor-pointer
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1"
          >
            {submitting ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify the build compiles**

```bash
cd property-equity-dashboard && npm run build
```

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/components/UpdateValuesModal.jsx && git commit -m "feat: add Update Values modal for home value and loan balance history"
```

---

### Task 8: Build ProjectionSettings inline panel

**Files:**
- Modify: `property-equity-dashboard/src/components/ProjectionSettings.jsx` (replace placeholder)

**Context:** Inline settings panel that appears below the equity chart header when the gear icon is clicked. Edits are debounced and update the chart in real-time. "Save" persists to the `property` table. "Reset" restores defaults. The property table has existing update RLS (anon can update via the existing policies — check if update policy exists; if not, we'll need to add one).

**Step 1: Check if update RLS policy exists for property table**

Run via Supabase MCP `execute_sql`:

```sql
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'property';
```

If there's no UPDATE policy, apply a migration:

```sql
CREATE POLICY "Allow anon update on property"
  ON property FOR UPDATE TO anon USING (true) WITH CHECK (true);
```

**Step 2: Implement ProjectionSettings**

Replace `property-equity-dashboard/src/components/ProjectionSettings.jsx` with:

```jsx
import { useState, useEffect, useRef } from 'react';
import { RotateCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';

const DEFAULTS = {
  home_growth_rate: 0.04,
  rent_growth_rate: 0.04,
  inflation_rate: 0.03,
  vacancy_rate: 0.05,
  effective_tax_rate: 0.24,
  monthly_rent: 1850,
  monthly_maintenance: 300,
  monthly_management: 95,
  pmi_annual: 488.88,
  pmi_years: 4,
  depreciation_annual: 10229.09,
};

const inputBase =
  'rounded-md border bg-transparent px-2 py-1.5 text-sm transition-colors w-full ' +
  'border-gray-300 dark:border-gray-700 ' +
  'focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400 ' +
  'placeholder:text-gray-400 dark:placeholder:text-gray-600 font-mono';

function SettingRow({ label, value, onChange, step = '0.01', suffix = '' }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-xs font-body text-gray-500 dark:text-gray-400 whitespace-nowrap">
        {label}
      </label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputBase} w-24 text-right`}
        />
        {suffix && (
          <span className="text-xs font-mono text-gray-400">{suffix}</span>
        )}
      </div>
    </div>
  );
}

export default function ProjectionSettings({ property, onSaved }) {
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef(null);

  // Initialize from property
  useEffect(() => {
    if (property) {
      setValues({
        home_growth_rate: Number(property.home_growth_rate) * 100,
        rent_growth_rate: Number(property.rent_growth_rate) * 100,
        inflation_rate: Number(property.inflation_rate) * 100,
        vacancy_rate: Number(property.vacancy_rate) * 100,
        effective_tax_rate: Number(property.effective_tax_rate) * 100,
        monthly_rent: Number(property.monthly_rent),
        monthly_maintenance: Number(property.monthly_maintenance),
        monthly_management: Number(property.monthly_management),
        pmi_annual: Number(property.pmi_annual),
        pmi_years: property.pmi_years,
        depreciation_annual: Number(property.depreciation_annual),
      });
    }
  }, [property]);

  function updateField(field, val) {
    setValues((prev) => ({ ...prev, [field]: val }));
  }

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase
      .from('property')
      .update({
        home_growth_rate: values.home_growth_rate / 100,
        rent_growth_rate: values.rent_growth_rate / 100,
        inflation_rate: values.inflation_rate / 100,
        vacancy_rate: values.vacancy_rate / 100,
        effective_tax_rate: values.effective_tax_rate / 100,
        monthly_rent: values.monthly_rent,
        monthly_maintenance: values.monthly_maintenance,
        monthly_management: values.monthly_management,
        pmi_annual: values.pmi_annual,
        pmi_years: values.pmi_years,
        depreciation_annual: values.depreciation_annual,
      })
      .eq('id', property.id);

    if (!error) {
      onSaved?.();
    }
    setSaving(false);
  }

  function handleReset() {
    setValues({
      home_growth_rate: DEFAULTS.home_growth_rate * 100,
      rent_growth_rate: DEFAULTS.rent_growth_rate * 100,
      inflation_rate: DEFAULTS.inflation_rate * 100,
      vacancy_rate: DEFAULTS.vacancy_rate * 100,
      effective_tax_rate: DEFAULTS.effective_tax_rate * 100,
      monthly_rent: DEFAULTS.monthly_rent,
      monthly_maintenance: DEFAULTS.monthly_maintenance,
      monthly_management: DEFAULTS.monthly_management,
      pmi_annual: DEFAULTS.pmi_annual,
      pmi_years: DEFAULTS.pmi_years,
      depreciation_annual: DEFAULTS.depreciation_annual,
    });
  }

  return (
    <div className="mx-5 mb-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-cream-100 dark:border-gray-700/50">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
        {/* Growth Assumptions */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest font-body text-gray-400 dark:text-gray-500 mb-1">
            Growth
          </p>
          <SettingRow
            label="Home appreciation"
            value={values.home_growth_rate ?? ''}
            onChange={(v) => updateField('home_growth_rate', v)}
            suffix="%"
          />
          <SettingRow
            label="Rent growth"
            value={values.rent_growth_rate ?? ''}
            onChange={(v) => updateField('rent_growth_rate', v)}
            suffix="%"
          />
          <SettingRow
            label="Inflation"
            value={values.inflation_rate ?? ''}
            onChange={(v) => updateField('inflation_rate', v)}
            suffix="%"
          />
        </div>

        {/* Income & Vacancy */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest font-body text-gray-400 dark:text-gray-500 mb-1">
            Income
          </p>
          <SettingRow
            label="Monthly rent"
            value={values.monthly_rent ?? ''}
            onChange={(v) => updateField('monthly_rent', v)}
            step="50"
            suffix="$"
          />
          <SettingRow
            label="Vacancy rate"
            value={values.vacancy_rate ?? ''}
            onChange={(v) => updateField('vacancy_rate', v)}
            suffix="%"
          />
        </div>

        {/* Expenses */}
        <div className="space-y-2 mt-2">
          <p className="text-[10px] uppercase tracking-widest font-body text-gray-400 dark:text-gray-500 mb-1">
            Expenses
          </p>
          <SettingRow
            label="Maintenance"
            value={values.monthly_maintenance ?? ''}
            onChange={(v) => updateField('monthly_maintenance', v)}
            step="25"
            suffix="$/mo"
          />
          <SettingRow
            label="Management"
            value={values.monthly_management ?? ''}
            onChange={(v) => updateField('monthly_management', v)}
            step="5"
            suffix="$/mo"
          />
          <SettingRow
            label="PMI annual"
            value={values.pmi_annual ?? ''}
            onChange={(v) => updateField('pmi_annual', v)}
            suffix="$/yr"
          />
          <SettingRow
            label="PMI years left"
            value={values.pmi_years ?? ''}
            onChange={(v) => updateField('pmi_years', v)}
            step="1"
          />
        </div>

        {/* Tax */}
        <div className="space-y-2 mt-2">
          <p className="text-[10px] uppercase tracking-widest font-body text-gray-400 dark:text-gray-500 mb-1">
            Tax
          </p>
          <SettingRow
            label="Effective tax rate"
            value={values.effective_tax_rate ?? ''}
            onChange={(v) => updateField('effective_tax_rate', v)}
            suffix="%"
          />
          <SettingRow
            label="Depreciation"
            value={values.depreciation_annual ?? ''}
            onChange={(v) => updateField('depreciation_annual', v)}
            suffix="$/yr"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-cream-100 dark:border-gray-700/50">
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-body text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer"
        >
          <RotateCcw size={12} />
          Reset to defaults
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 rounded-md bg-amber-400 text-slate-950 text-sm font-semibold
            hover:bg-amber-400/80 transition-colors disabled:opacity-50 cursor-pointer
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
```

**Step 3: Verify the build compiles**

```bash
cd property-equity-dashboard && npm run build
```

Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/components/ProjectionSettings.jsx && git commit -m "feat: add inline Projection Settings panel with save and reset"
```

---

### Task 9: Add RLS update policy for property table (if missing)

**Context:** The ProjectionSettings panel needs to UPDATE the property table. Check if an UPDATE policy exists.

**Step 1: Check existing policies**

Run via Supabase MCP `execute_sql`:

```sql
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'property';
```

**Step 2: If no UPDATE policy exists, apply migration**

Use Supabase MCP `apply_migration`:

- **name:** `add_property_update_policy`
- **query:**
```sql
CREATE POLICY "Allow anon update on property"
  ON property FOR UPDATE TO anon USING (true) WITH CHECK (true);
```

**Step 3: Verify**

```sql
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'property';
```

Expected: UPDATE policy now listed.

**Step 4: Commit**

```bash
git commit --allow-empty -m "chore: add RLS update policy for property table"
```

---

### Task 10: Manual verification and smoke test

**Step 1: Start the dev server**

```bash
cd property-equity-dashboard && npm run dev
```

**Step 2: Verify the following in the browser**

1. Dashboard loads without errors
2. Summary cards show equity (should be same value as before, since Year 0 uses the seeded history value)
3. Equity chart shows three lines: solid base, dashed optimistic above, dashed pessimistic below
4. Chart starts at "Now" label on x-axis
5. Hovering a year shows all three scenario values in tooltip
6. Legend appears below chart with Base, +2%, -2% labels
7. Toggle "Total Property / Your Share" still works
8. Enable admin mode (passcode: `admin2728`)
9. Pencil icon appears in header — click it
10. Update Values modal opens with current home value displayed
11. Enter a new home value (e.g., 340000), select "Zillow", save
12. Modal closes, equity card and chart update immediately
13. Click gear icon on equity chart header
14. Projection Settings panel appears inline
15. Change home appreciation to 5%, click Save
16. Chart redraws with new projections
17. Click "Reset to defaults" — values restore to originals

**Step 3: Check Supabase data**

Run via `execute_sql`:

```sql
SELECT * FROM property_value_history ORDER BY created_at DESC LIMIT 5;
```

Expected: Shows the initial seed row plus any test entries.

**Step 4: Final commit**

```bash
git add -A && git commit -m "chore: final cleanup after smoke test"
```

---

### Task 11: Run security advisors

**Step 1: Check for security issues**

Use Supabase MCP `get_advisors` with type `security` on project `mokjxwwldiyklyzyzsej`.

**Step 2: Address any RLS warnings on the new tables**

If advisors flag missing RLS on the new tables, verify the policies were applied correctly in Task 1.

**Step 3: Commit any fixes**

```bash
git add -A && git commit -m "fix: address security advisor findings"
```

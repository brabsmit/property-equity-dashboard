# Cash Flow Projection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a 120-month cash flow projection with bar+line chart in a tabbed view alongside the existing equity projection.

**Architecture:** Extend `projections.js` with a `generateMonthlyCashFlow()` function that produces 120 monthly data points. Create a new `CashFlowChart.jsx` component using Recharts `ComposedChart` with bars (monthly net) and lines (cumulative scenarios). Refactor `EquityChart.jsx` into a tabbed container that switches between equity and cash flow views, sharing the ownership toggle and projection settings.

**Tech Stack:** React, Recharts (ComposedChart, Bar, Line), Tailwind CSS, existing projection engine

---

### Task 1: Add `generateMonthlyCashFlow` to projection engine

**Files:**
- Modify: `property-equity-dashboard/src/lib/projections.js`

**Step 1: Add the function below the existing `generateProjections` function**

Add this export to the bottom of `projections.js`:

```js
/**
 * Generate 120-month (10-year) cash flow projection at monthly granularity.
 *
 * @param {Object} property - Property row from Supabase
 * @param {Object} [options]
 * @param {number} [options.rateOffset=0] - Offset applied to rent_growth_rate and inflation_rate
 * @param {number} [options.currentLoanBalance] - Override starting loan balance
 * @returns {Array<Object>} Array of 120 objects with monthly cash flow data
 */
export function generateMonthlyCashFlow(property, options = {}) {
  const { rateOffset = 0, currentLoanBalance } = options;

  const {
    loan_balance, interest_rate, loan_term_years,
    monthly_escrow, depreciation_annual,
    rent_growth_rate, inflation_rate, vacancy_rate,
    effective_tax_rate, pmi_annual, pmi_years,
    monthly_rent, monthly_maintenance, monthly_management,
    property_tax_annual, insurance_annual,
  } = property;

  const startLoanBalance = currentLoanBalance ?? Number(loan_balance);
  const r = Number(interest_rate) / 12;
  const monthlyPI = monthlyMortgagePI(startLoanBalance, Number(interest_rate), loan_term_years);

  const months = [];
  let loanBalance = startLoanBalance;
  let cumulative = 0;

  for (let m = 0; m < 120; m++) {
    const year = Math.floor(m / 12);

    // Escalate annually (year 0 = current rates, year 1 = first escalation)
    const rentGrowth = Number(rent_growth_rate) + rateOffset;
    const inflationGrowth = Number(inflation_rate) + rateOffset;
    const rent = Number(monthly_rent) * Math.pow(1 + rentGrowth, year);
    const maintenance = Number(monthly_maintenance) * Math.pow(1 + inflationGrowth, year);
    const management = Number(monthly_management);
    const pmi = m < (pmi_years * 12) ? Number(pmi_annual) / 12 : 0;
    const escrow = Number(monthly_escrow);

    // Income (vacancy-adjusted)
    const income = rent * (1 - Number(vacancy_rate));

    // Expenses
    const expenses = monthlyPI + escrow + maintenance + management + pmi;

    // Net
    const net = income - expenses;

    // Interest this month (for tax calc)
    const interestThisMonth = loanBalance * r;
    const principalThisMonth = monthlyPI - interestThisMonth;
    loanBalance = Math.max(0, loanBalance - principalThisMonth);

    // Monthly tax benefit approximation
    const monthlyDepreciation = Number(depreciation_annual) / 12;
    const monthlyPropertyTax = Number(property_tax_annual) / 12;
    const monthlyInsurance = Number(insurance_annual) / 12;
    const deductible = interestThisMonth + monthlyPropertyTax + monthlyInsurance +
      maintenance + management + pmi + monthlyDepreciation;
    const taxableIncome = income - deductible;
    const taxBenefit = taxableIncome < 0
      ? Math.abs(taxableIncome) * Number(effective_tax_rate)
      : -(taxableIncome * Number(effective_tax_rate));

    const adjustedNet = net + taxBenefit;
    cumulative += adjustedNet;

    // Label: "Now" for month 0, "Yr N" for every 12th month, empty otherwise
    let monthLabel = '';
    if (m === 0) monthLabel = 'Now';
    else if (m % 12 === 0) monthLabel = `Yr ${m / 12}`;

    months.push({
      month: m,
      monthLabel,
      income: Math.round(income),
      expenses: Math.round(expenses),
      net: Math.round(net),
      taxBenefit: Math.round(taxBenefit),
      adjustedNet: Math.round(adjustedNet),
      cumulative: Math.round(cumulative),
    });
  }

  return months;
}
```

Key differences from the annual `generateProjections`:
- Steps loan balance month-by-month (accurate amortization)
- Applies `rateOffset` to rent growth and inflation (not home appreciation — irrelevant to cash flow)
- Tax benefit calculated monthly from that month's actual interest payment
- Returns 120 data points instead of 11

**Step 2: Verify the app still builds**

Run: `cd property-equity-dashboard && npm run build`
Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add property-equity-dashboard/src/lib/projections.js
git commit -m "feat: add generateMonthlyCashFlow to projection engine"
```

---

### Task 2: Create `CashFlowChart.jsx` component

**Files:**
- Create: `property-equity-dashboard/src/components/CashFlowChart.jsx`

**Step 1: Create the chart component**

```jsx
import {
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  ReferenceLine,
  Cell,
} from 'recharts';

const formatCurrency = (value) => {
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
};

const currencyFull = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function CashFlowTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;

  // Extract data from the first payload item's full data object
  const data = payload[0]?.payload;
  if (!data) return null;

  const label = data.monthLabel || `Month ${data.month}`;

  return (
    <div
      className="rounded-lg px-4 py-3 shadow-lg border"
      style={{ backgroundColor: '#1a1a2e', borderColor: '#d4a853' }}
    >
      <p className="text-xs font-body text-gray-400 mb-2">{label}</p>
      <p className="text-xs font-mono text-green-400">
        Income: {currencyFull.format(data.income)}
      </p>
      <p className="text-xs font-mono text-rose-400">
        Expenses: {currencyFull.format(data.expenses)}
      </p>
      <p className="text-sm font-mono text-amber-400 font-semibold mt-1">
        Net: {currencyFull.format(data.net)}
      </p>
      <div className="mt-2 pt-2 border-t border-gray-700">
        {data.cumulativeOptimistic !== undefined && (
          <p className="text-xs font-mono text-amber-300/70">
            Cumulative (+2%): {currencyFull.format(data.cumulativeOptimistic)}
          </p>
        )}
        <p className="text-xs font-mono text-amber-400">
          Cumulative: {currencyFull.format(data.cumulative)}
        </p>
        {data.cumulativePessimistic !== undefined && (
          <p className="text-xs font-mono text-gray-400">
            Cumulative (-2%): {currencyFull.format(data.cumulativePessimistic)}
          </p>
        )}
      </div>
    </div>
  );
}

export default function CashFlowChart({
  baseCashFlow = [],
  optimisticCashFlow = [],
  pessimisticCashFlow = [],
  ownershipShare = 1,
  showMyShare = false,
}) {
  const applyShare = (val) =>
    showMyShare ? Math.round(val * ownershipShare) : val;

  // Merge base, optimistic, pessimistic into single data array
  const chartData = baseCashFlow.map((d, i) => ({
    ...d,
    month: d.month,
    monthLabel: d.monthLabel,
    income: applyShare(d.income),
    expenses: applyShare(d.expenses),
    net: applyShare(d.net),
    cumulative: applyShare(d.cumulative),
    cumulativeOptimistic: applyShare(optimisticCashFlow[i]?.cumulative ?? d.cumulative),
    cumulativePessimistic: applyShare(pessimisticCashFlow[i]?.cumulative ?? d.cumulative),
  }));

  // Only show tick labels for "Now" and "Yr N" entries
  const ticks = chartData
    .filter((d) => d.monthLabel)
    .map((d) => d.month);

  return (
    <div className="px-3 pb-3 pt-2">
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart
          data={chartData}
          margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            className="text-gray-200 dark:text-gray-800"
            opacity={0.3}
          />

          <XAxis
            dataKey="month"
            ticks={ticks}
            tickFormatter={(month) => {
              const d = chartData.find((item) => item.month === month);
              return d?.monthLabel || '';
            }}
            tick={{ fontSize: 12, fontFamily: 'Source Sans 3, sans-serif' }}
            stroke="#9ca3af"
            tickLine={false}
            axisLine={{ stroke: '#9ca3af', strokeOpacity: 0.3 }}
          />

          {/* Left Y-axis: monthly net (bars) */}
          <YAxis
            yAxisId="monthly"
            tickFormatter={formatCurrency}
            tick={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
            stroke="#9ca3af"
            tickLine={false}
            axisLine={false}
            width={55}
          />

          {/* Right Y-axis: cumulative (lines) */}
          <YAxis
            yAxisId="cumulative"
            orientation="right"
            tickFormatter={formatCurrency}
            tick={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
            stroke="#9ca3af"
            tickLine={false}
            axisLine={false}
            width={55}
          />

          <Tooltip content={<CashFlowTooltip />} />

          {/* Zero reference line */}
          <ReferenceLine
            yAxisId="monthly"
            y={0}
            stroke="#9ca3af"
            strokeOpacity={0.5}
            strokeDasharray="3 3"
          />

          {/* Monthly net bars with dynamic color */}
          <Bar
            yAxisId="monthly"
            dataKey="net"
            opacity={0.7}
            isAnimationActive={true}
            animationDuration={1500}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.net >= 0 ? '#d4a853' : '#f43f5e'}
              />
            ))}
          </Bar>

          {/* Optimistic cumulative (dashed, above) */}
          <Line
            yAxisId="cumulative"
            type="monotone"
            dataKey="cumulativeOptimistic"
            stroke="#d4a853"
            strokeWidth={1}
            strokeDasharray="4 4"
            strokeOpacity={0.4}
            dot={false}
            isAnimationActive={true}
            animationDuration={1500}
          />

          {/* Base cumulative (solid) */}
          <Line
            yAxisId="cumulative"
            type="monotone"
            dataKey="cumulative"
            stroke="#d4a853"
            strokeWidth={2}
            dot={false}
            isAnimationActive={true}
            animationDuration={1500}
          />

          {/* Pessimistic cumulative (dashed, below) */}
          <Line
            yAxisId="cumulative"
            type="monotone"
            dataKey="cumulativePessimistic"
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
  );
}
```

**Step 2: Verify the app still builds**

Run: `cd property-equity-dashboard && npm run build`
Expected: Build succeeds (component not yet imported anywhere — no errors)

**Step 3: Commit**

```bash
git add property-equity-dashboard/src/components/CashFlowChart.jsx
git commit -m "feat: add CashFlowChart component with bar+line visualization"
```

---

### Task 3: Refactor `EquityChart.jsx` into tabbed container

**Files:**
- Modify: `property-equity-dashboard/src/components/EquityChart.jsx`

This is the biggest task. We're adding tabs and conditionally rendering either the equity chart or the new cash flow chart.

**Step 1: Add tab state and imports**

At the top of `EquityChart.jsx`, add the import for `CashFlowChart`:

```js
import CashFlowChart from './CashFlowChart';
```

**Step 2: Add new props and state**

The component needs three new props for cash flow data. Update the function signature:

```js
export default function EquityChart({
  baseProjections = [],
  optimisticProjections = [],
  pessimisticProjections = [],
  baseCashFlow = [],
  optimisticCashFlow = [],
  pessimisticCashFlow = [],
  ownershipShare = 1,
  isAdmin = false,
  property = null,
  onPropertySaved,
}) {
```

Add a new state variable for the active tab:

```js
const [activeTab, setActiveTab] = useState('equity');
```

**Step 3: Replace the header section**

Replace the entire header `<div>` (the one with `flex flex-wrap items-center justify-between`) with a new layout that has tabs:

```jsx
{/* Header row */}
<div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 pb-2">
  <div className="flex items-center gap-2">
    {/* Tabs */}
    <div className="flex items-center gap-0">
      <button
        onClick={() => setActiveTab('equity')}
        className={[
          'font-display text-base sm:text-lg font-semibold transition-colors cursor-pointer pb-1 border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
          activeTab === 'equity'
            ? 'text-gray-900 dark:text-gray-100 border-amber-400'
            : 'text-gray-400 dark:text-gray-500 border-transparent hover:text-gray-600 dark:hover:text-gray-300',
        ].join(' ')}
      >
        EQUITY
      </button>
      <span className="mx-2 text-gray-300 dark:text-gray-600 select-none">/</span>
      <button
        onClick={() => setActiveTab('cashflow')}
        className={[
          'font-display text-base sm:text-lg font-semibold transition-colors cursor-pointer pb-1 border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
          activeTab === 'cashflow'
            ? 'text-gray-900 dark:text-gray-100 border-amber-400'
            : 'text-gray-400 dark:text-gray-500 border-transparent hover:text-gray-600 dark:hover:text-gray-300',
        ].join(' ')}
      >
        CASH FLOW
      </button>
    </div>
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
```

**Step 4: Conditionally render the chart area**

Replace the existing chart `<div className="px-3 pb-3 pt-2">` section with:

```jsx
{/* Chart */}
{activeTab === 'equity' ? (
  <div className="px-3 pb-3 pt-2">
    <ResponsiveContainer width="100%" height={300}>
      {/* ... existing ComposedChart code stays exactly as-is ... */}
    </ResponsiveContainer>
  </div>
) : (
  <CashFlowChart
    baseCashFlow={baseCashFlow}
    optimisticCashFlow={optimisticCashFlow}
    pessimisticCashFlow={pessimisticCashFlow}
    ownershipShare={ownershipShare}
    showMyShare={showMyShare}
  />
)}
```

**Step 5: Update the legend**

Replace the legend section to show context-appropriate legends:

```jsx
{/* Legend */}
{activeTab === 'equity' ? (
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
) : (
  <div className="flex flex-wrap items-center justify-center gap-4 pb-4 text-[11px] font-body text-gray-400 dark:text-gray-500">
    <span className="flex items-center gap-1.5">
      <span className="inline-block w-3 h-3 rounded-sm bg-amber-400/70" />
      Monthly net (+)
    </span>
    <span className="flex items-center gap-1.5">
      <span className="inline-block w-3 h-3 rounded-sm bg-rose-500/70" />
      Monthly net (-)
    </span>
    <span className="flex items-center gap-1.5">
      <span className="inline-block w-4 h-0.5 bg-amber-400 rounded" />
      Cumulative
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
)}
```

**Step 6: Verify the app still builds**

Run: `cd property-equity-dashboard && npm run build`
Expected: Build succeeds

**Step 7: Commit**

```bash
git add property-equity-dashboard/src/components/EquityChart.jsx
git commit -m "feat: refactor EquityChart into tabbed equity/cash-flow container"
```

---

### Task 4: Wire up cash flow data in `Dashboard.jsx`

**Files:**
- Modify: `property-equity-dashboard/src/components/Dashboard.jsx`

**Step 1: Import the new function**

Add `generateMonthlyCashFlow` to the existing import from projections:

```js
import { generateProjections, generateMonthlyCashFlow } from '../lib/projections';
```

**Step 2: Compute cash flow projections**

After the existing `pessimisticProjections` block (around line 148), add:

```js
// Compute three scenario cash flow projections
const baseCashFlow = property
  ? generateMonthlyCashFlow(property, { currentLoanBalance })
  : [];

const optimisticCashFlow = property
  ? generateMonthlyCashFlow(property, { rateOffset: 0.02, currentLoanBalance })
  : [];

const pessimisticCashFlow = property
  ? generateMonthlyCashFlow(property, { rateOffset: -0.02, currentLoanBalance })
  : [];
```

**Step 3: Pass cash flow data to EquityChart**

Update the `<EquityChart>` JSX to include the new props:

```jsx
<EquityChart
  baseProjections={baseProjections}
  optimisticProjections={optimisticProjections}
  pessimisticProjections={pessimisticProjections}
  baseCashFlow={baseCashFlow}
  optimisticCashFlow={optimisticCashFlow}
  pessimisticCashFlow={pessimisticCashFlow}
  ownershipShare={ownershipShare}
  isAdmin={isAdmin}
  property={property}
  onPropertySaved={refreshProperty}
/>
```

**Step 4: Verify the app builds and runs**

Run: `cd property-equity-dashboard && npm run build`
Expected: Build succeeds

Run: `cd property-equity-dashboard && npm run dev`
Manual check:
1. Dashboard loads — equity chart shows as before (default tab)
2. Click "CASH FLOW" tab — bar+line chart renders with 120 months of data
3. Bars are amber (positive) or rose (negative)
4. Three cumulative lines visible (solid base, dashed optimistic/pessimistic)
5. "Total Property / Your Share" toggle works on both tabs
6. Projection Settings (admin) still works
7. Switching tabs preserves toggle state

**Step 5: Commit**

```bash
git add property-equity-dashboard/src/components/Dashboard.jsx
git commit -m "feat: wire up cash flow projection data to tabbed chart"
```

---

### Task 5: Visual polish and edge case handling

**Files:**
- Modify: `property-equity-dashboard/src/components/CashFlowChart.jsx` (minor tweaks based on visual review)

**Step 1: Run the dev server and visually inspect**

Run: `cd property-equity-dashboard && npm run dev`

Check these specific things:
1. **Bar density:** 120 bars should be thin but readable. If bars have visible gaps, reduce bar gap. If bars overlap, they should still look clean.
2. **Dual Y-axis alignment:** The zero line should make sense on both axes. Both axes should show reasonable dollar ranges.
3. **Tooltip positioning:** Hover near edges of chart — tooltip should not clip off-screen.
4. **Mobile view:** Resize browser to ~375px width. Bars will blur together — the cumulative line should still be clearly visible and tell the story.
5. **Tab switching:** Switch between Equity and Cash Flow multiple times. No layout shift, no flicker.
6. **Negative values:** If early months show negative net cash flow, bars should be rose-colored below the zero line.

**Step 2: Fix any visual issues found**

Adjust bar size, opacity, axis formatting, or spacing as needed. Common adjustments:
- `barSize={2}` or `barSize={3}` on the `<Bar>` if bars are too wide
- Adjust `opacity` on bars if they're too visually heavy
- Adjust `margin` on the `ComposedChart` if labels clip

**Step 3: Commit**

```bash
git add property-equity-dashboard/src/components/CashFlowChart.jsx
git commit -m "fix: polish cash flow chart visual density and responsiveness"
```

(Skip this commit if no changes were needed.)

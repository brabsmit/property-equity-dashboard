import { useMemo } from 'react';
import { groupTransactionsByQuarter, getQuarterInfo, quarterDateRange, getMonthsRemainingInQuarter } from '../lib/quarters';
import { monthlyMortgagePI } from '../lib/projections';

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/**
 * Calculate projected net monthly cash flow (same hybrid logic as SummaryCards).
 */
function calculateProjectedMonthlyNet(property, transactions) {
  if (!property) return 0;

  let lastMonthTotals = {};
  if (transactions.length > 0) {
    const sorted = [...transactions].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );
    const latest = new Date(sorted[0].date);
    const targetYear = latest.getFullYear();
    const targetMonth = latest.getMonth();

    for (const t of sorted) {
      const d = new Date(t.date);
      if (d.getFullYear() !== targetYear || d.getMonth() !== targetMonth) break;
      const cat = t.category;
      if (!lastMonthTotals[cat]) lastMonthTotals[cat] = 0;
      lastMonthTotals[cat] += Math.abs(t.amount ?? 0);
    }
  }

  const assumedMortgage =
    property.original_loan_amount && property.interest_rate && property.loan_term_years
      ? monthlyMortgagePI(
          Number(property.original_loan_amount),
          Number(property.interest_rate),
          property.loan_term_years
        )
      : 0;

  const projectedRent = lastMonthTotals.rent ?? Number(property.monthly_rent ?? 0);
  const projectedMortgage = lastMonthTotals.mortgage ?? assumedMortgage;
  const projectedManagement = lastMonthTotals.management_fee ?? Number(property.monthly_management ?? 0);
  const projectedEscrow = Number(property.monthly_escrow ?? 0);
  const projectedMaintenance = Number(property.monthly_maintenance ?? 0);

  return projectedRent - projectedMortgage - projectedEscrow - projectedMaintenance - projectedManagement;
}

export default function QuarterlyReconciliation({
  transactions = [],
  property,
  ownershipShare = 1,
}) {
  const currentQ = getQuarterInfo();
  const currentKey = `${currentQ.year}-Q${currentQ.quarter}`;

  const quarterGroups = useMemo(
    () => groupTransactionsByQuarter(transactions),
    [transactions]
  );

  // Projected remaining for current quarter
  const projectedRemaining = useMemo(() => {
    if (!property) return 0;
    const monthlyNet = calculateProjectedMonthlyNet(property, transactions);
    const remainingMonths = getMonthsRemainingInQuarter();
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeftInMonth = daysInMonth - now.getDate();
    const currentMonthProration = daysLeftInMonth / daysInMonth;
    return (monthlyNet * currentMonthProration) + (monthlyNet * remainingMonths);
  }, [property, transactions]);

  // Ensure current quarter is present even if no transactions yet
  const groups = useMemo(() => {
    const hasCurrentQ = quarterGroups.some(
      (g) => g.year === currentQ.year && g.quarter === currentQ.quarter
    );
    if (hasCurrentQ) return quarterGroups;
    return [
      { quarter: currentQ.quarter, year: currentQ.year, label: currentQ.label, transactions: [], income: 0, expenses: 0, net: 0 },
      ...quarterGroups,
    ];
  }, [quarterGroups, currentQ.quarter, currentQ.year, currentQ.label]);

  return (
    <section>
      <h2 className="font-display text-lg sm:text-xl font-semibold mb-4">
        Quarterly Reconciliation
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups.map((g) => {
          const key = `${g.year}-Q${g.quarter}`;
          const isCurrent = key === currentKey;
          const yourNet = Math.round(g.net * ownershipShare);
          const estEnd = isCurrent
            ? Math.round((g.net + projectedRemaining) * ownershipShare)
            : null;

          return (
            <div
              key={key}
              className={[
                'rounded-xl px-5 py-4 border transition-colors',
                'bg-white/60 dark:bg-gray-900/50',
                isCurrent
                  ? 'border-amber-400/30 dark:border-amber-400/20 shadow-[0_0_20px_-6px_rgba(212,168,83,0.15)]'
                  : 'border-cream-100 dark:border-gray-800',
              ].join(' ')}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-mono text-sm font-semibold text-gray-700 dark:text-gray-200">
                    {g.label}
                  </span>
                  <span className="ml-2 text-[11px] text-gray-400 dark:text-gray-500">
                    {quarterDateRange(g.quarter, g.year)}
                  </span>
                </div>
                <span
                  className={[
                    'text-[10px] uppercase tracking-widest font-mono px-2 py-0.5 rounded-full',
                    isCurrent
                      ? 'bg-amber-400/15 text-amber-400'
                      : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500',
                  ].join(' ')}
                >
                  {isCurrent ? 'Current' : 'Settled'}
                </span>
              </div>

              {/* Income / Expenses */}
              <div className="flex items-center justify-between text-xs font-mono mb-2">
                <span className="text-gray-500 dark:text-gray-400">Income</span>
                <span className="text-amber-400">+{currencyFormat.format(g.income)}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-mono mb-3">
                <span className="text-gray-500 dark:text-gray-400">Expenses</span>
                <span className="text-rose-500 dark:text-rose-400">-{currencyFormat.format(Math.abs(g.expenses))}</span>
              </div>

              {/* Separator */}
              <div className="border-t border-cream-100 dark:border-gray-800 mb-3" />

              {/* Net (your share) */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  Your Share
                </span>
                <span
                  className={[
                    'font-mono font-bold text-base',
                    yourNet >= 0 ? 'text-amber-400' : 'text-rose-500 dark:text-rose-400',
                  ].join(' ')}
                >
                  {yourNet >= 0 ? '+' : '-'}{currencyFormat.format(Math.abs(yourNet))}
                </span>
              </div>

              {/* Est. Quarter End (current quarter only) */}
              {isCurrent && estEnd != null && (
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-gray-400 dark:text-gray-500 font-mono">
                    Est. at Quarter End
                  </span>
                  <span
                    className={[
                      'font-mono text-sm',
                      estEnd >= 0 ? 'text-amber-400/70' : 'text-rose-500/70 dark:text-rose-400/70',
                    ].join(' ')}
                  >
                    {estEnd >= 0 ? '+' : '-'}{currencyFormat.format(Math.abs(estEnd))}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

import { useState, useMemo } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import AddTransaction from './AddTransaction';
import { getQuarterInfo, getDistinctQuarters, filterTransactionsByQuarter } from '../lib/quarters';

const INITIAL_ROWS = 15;

const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

const dateFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

// ── Category badge config ────────────────────────────────────────────
const BADGE_COLORS = {
  mortgage: 'bg-gray-200 text-gray-600 dark:bg-gray-600/20 dark:text-gray-400',
  rent: 'bg-amber-100 text-amber-700 dark:bg-amber-400/20 dark:text-amber-400',
  repair: 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400',
  management_fee: 'bg-gray-100 text-gray-500 dark:bg-gray-500/20 dark:text-gray-500',
  insurance: 'bg-gray-100 text-gray-500 dark:bg-gray-500/20 dark:text-gray-500',
  tax: 'bg-gray-100 text-gray-500 dark:bg-gray-500/20 dark:text-gray-500',
  other: 'bg-gray-100 text-gray-500 dark:bg-gray-500/20 dark:text-gray-500',
};

function CategoryBadge({ category }) {
  const colors =
    BADGE_COLORS[category] || BADGE_COLORS.other;
  const label = (category || 'other')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide whitespace-nowrap ${colors}`}
    >
      {label}
    </span>
  );
}

function formatAmount(amount) {
  const num = Number(amount);
  const formatted = currencyFmt.format(Math.abs(num));
  if (num >= 0) {
    return (
      <span className="text-amber-400 font-mono">+{formatted}</span>
    );
  }
  return (
    <span className="text-rose-500 dark:text-rose-400 font-mono">
      -{formatted}
    </span>
  );
}

function formatDate(dateStr) {
  // Parse YYYY-MM-DD to avoid timezone shift
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return dateFmt.format(date);
}

// ── Mobile card ──────────────────────────────────────────────────────
function TransactionCard({ tx, isAdmin, onEdit, onDelete }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-cream-100 dark:border-gray-800/30 hover:bg-cream-100 dark:hover:bg-gray-800/30 transition-colors">
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-500 font-mono">
            {formatDate(tx.date)}
          </span>
          <CategoryBadge category={tx.category} />
        </div>
        {tx.note && (
          <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
            {tx.note}
          </span>
        )}
      </div>
      <div className="shrink-0 text-sm text-right">{formatAmount(tx.amount)}</div>
      {isAdmin && (
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <button
            type="button"
            onClick={() => onEdit?.(tx)}
            title="Edit"
            aria-label="Edit transaction"
            className="p-1 rounded text-gray-400 hover:text-amber-400 transition-colors cursor-pointer"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => onDelete?.(tx)}
            title="Delete"
            aria-label="Delete transaction"
            className="p-1 rounded text-gray-400 hover:text-rose-500 transition-colors cursor-pointer"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────
export default function TransactionTable({
  transactions = [],
  isAdmin = false,
  onTransactionAdded,
  onEdit,
  onDelete,
}) {
  const [showAll, setShowAll] = useState(false);

  // Quarter filter state — default to current quarter
  const currentQ = getQuarterInfo();
  const [selectedQuarter, setSelectedQuarter] = useState(
    () => `${currentQ.year}-Q${currentQ.quarter}`
  );

  // Available quarters from transaction data
  const quarters = useMemo(() => getDistinctQuarters(transactions), [transactions]);

  // Ensure current quarter is always in the list
  const allQuarters = useMemo(() => {
    const currentKey = `${currentQ.year}-Q${currentQ.quarter}`;
    const hasCurrentQ = quarters.some((q) => `${q.year}-Q${q.quarter}` === currentKey);
    if (hasCurrentQ) return quarters;
    return [{ quarter: currentQ.quarter, year: currentQ.year, label: currentQ.label }, ...quarters];
  }, [quarters, currentQ.quarter, currentQ.year, currentQ.label]);

  // Filter transactions by selected quarter (or show all)
  const filtered = useMemo(() => {
    if (selectedQuarter === 'all') return transactions;
    const [yearStr, qStr] = selectedQuarter.split('-Q');
    return filterTransactionsByQuarter(transactions, Number(qStr), Number(yearStr));
  }, [transactions, selectedQuarter]);

  // Subtotals for filtered view
  const subtotals = useMemo(() => {
    if (selectedQuarter === 'all') return null;
    let income = 0;
    let expenses = 0;
    for (const t of filtered) {
      const amt = t.amount ?? 0;
      if (amt >= 0) income += amt;
      else expenses += amt;
    }
    return { income, expenses, net: income + expenses };
  }, [filtered, selectedQuarter]);

  const visible = showAll
    ? filtered
    : filtered.slice(0, INITIAL_ROWS);

  const hasMore = filtered.length > INITIAL_ROWS;

  return (
    <section>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-lg sm:text-xl font-semibold">
            Recent Transactions
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-500 font-mono">
            {selectedQuarter === 'all'
              ? `${transactions.length} entries`
              : `${filtered.length} of ${transactions.length} entries`}
          </span>
        </div>

        {/* "+ Add Entry" button is cosmetic — the form below is always visible for admins */}
      </div>

      {/* Quarter filter tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => { setSelectedQuarter('all'); setShowAll(false); }}
          className={[
            'px-3 py-1.5 rounded-full text-xs font-mono whitespace-nowrap transition-colors cursor-pointer',
            selectedQuarter === 'all'
              ? 'bg-amber-400/20 text-amber-400 dark:bg-amber-400/15'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
          ].join(' ')}
        >
          All
        </button>
        {allQuarters.map((q) => {
          const key = `${q.year}-Q${q.quarter}`;
          return (
            <button
              key={key}
              onClick={() => { setSelectedQuarter(key); setShowAll(false); }}
              className={[
                'px-3 py-1.5 rounded-full text-xs font-mono whitespace-nowrap transition-colors cursor-pointer',
                selectedQuarter === key
                  ? 'bg-amber-400/20 text-amber-400 dark:bg-amber-400/15'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
              ].join(' ')}
            >
              {q.label}
            </button>
          );
        })}
      </div>

      {/* Container */}
      <div className="rounded-xl border bg-white/60 dark:bg-gray-900/50 border-cream-100 dark:border-gray-800 overflow-hidden">
        {/* Admin form */}
        {isAdmin && (
          <AddTransaction onTransactionAdded={onTransactionAdded} />
        )}

        {/* ── Desktop table (hidden on sm) ─────────────────────────── */}
        <div className="hidden sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-500 font-mono border-b border-cream-100 dark:border-gray-800/30">
                <th className="text-left px-4 py-2.5 font-medium">Date</th>
                <th className="text-left px-4 py-2.5 font-medium">Category</th>
                <th className="text-left px-4 py-2.5 font-medium">Description</th>
                <th className="text-right px-4 py-2.5 font-medium">Amount</th>
                {isAdmin && (
                  <th className="text-right px-4 py-2.5 font-medium w-[80px]">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {visible.map((tx) => (
                <tr
                  key={tx.id}
                  className="border-b border-cream-100 dark:border-gray-800/30 last:border-b-0 hover:bg-cream-100 dark:hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-4 py-2.5 font-mono text-gray-500 dark:text-gray-500 whitespace-nowrap">
                    {formatDate(tx.date)}
                  </td>
                  <td className="px-4 py-2.5">
                    <CategoryBadge category={tx.category} />
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 truncate max-w-[260px]">
                    {tx.note || '\u2014'}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {formatAmount(tx.amount)}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onEdit?.(tx)}
                        title="Edit transaction"
                        aria-label="Edit transaction"
                        className="p-1 rounded text-gray-400 hover:text-amber-400 transition-colors cursor-pointer"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete?.(tx)}
                        title="Delete transaction"
                        aria-label="Delete transaction"
                        className="p-1 rounded text-gray-400 hover:text-rose-500 transition-colors cursor-pointer ml-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}

              {transactions.length === 0 && (
                <tr>
                  <td
                    colSpan={isAdmin ? 5 : 4}
                    className="px-4 py-8 text-center text-gray-500 dark:text-gray-600 font-mono text-xs"
                  >
                    No transactions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Mobile cards (visible only on sm) ────────────────────── */}
        <div className="sm:hidden">
          {visible.map((tx) => (
            <TransactionCard key={tx.id} tx={tx} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} />
          ))}

          {transactions.length === 0 && (
            <p className="px-4 py-8 text-center text-gray-500 dark:text-gray-600 font-mono text-xs">
              No transactions yet.
            </p>
          )}
        </div>

        {/* Quarter subtotal row */}
        {subtotals && filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-cream-100 dark:border-gray-800/30 bg-cream-100/50 dark:bg-gray-800/20">
            <span className="text-xs font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Quarter Total
            </span>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="text-amber-400">+{currencyFmt.format(subtotals.income)}</span>
              <span className="text-rose-500 dark:text-rose-400">-{currencyFmt.format(Math.abs(subtotals.expenses))}</span>
              <span className={subtotals.net >= 0 ? 'text-amber-400 font-semibold' : 'text-rose-500 dark:text-rose-400 font-semibold'}>
                Net: {subtotals.net >= 0 ? '+' : '-'}{currencyFmt.format(Math.abs(subtotals.net))}
              </span>
            </div>
          </div>
        )}

        {/* View all / Show less */}
        {hasMore && (
          <button
            onClick={() => setShowAll((s) => !s)}
            className="w-full py-2.5 text-center text-xs font-mono text-amber-400 hover:text-amber-300 transition-colors border-t border-cream-100 dark:border-gray-800/30 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400"
          >
            {showAll
              ? 'Show less'
              : `View all ${filtered.length} transactions`}
          </button>
        )}
      </div>
    </section>
  );
}

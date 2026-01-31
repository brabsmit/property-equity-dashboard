import { useState } from 'react';
import AddTransaction from './AddTransaction';

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
function TransactionCard({ tx }) {
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
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────
export default function TransactionTable({
  transactions = [],
  isAdmin = false,
  onTransactionAdded,
}) {
  const [showAll, setShowAll] = useState(false);

  const visible = showAll
    ? transactions
    : transactions.slice(0, INITIAL_ROWS);

  const hasMore = transactions.length > INITIAL_ROWS;

  return (
    <section>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-lg sm:text-xl font-semibold">
            Recent Transactions
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-500 font-mono">
            {transactions.length} entries
          </span>
        </div>

        {/* "+ Add Entry" button is cosmetic — the form below is always visible for admins */}
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
                </tr>
              ))}

              {transactions.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
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
            <TransactionCard key={tx.id} tx={tx} />
          ))}

          {transactions.length === 0 && (
            <p className="px-4 py-8 text-center text-gray-500 dark:text-gray-600 font-mono text-xs">
              No transactions yet.
            </p>
          )}
        </div>

        {/* View all / Show less */}
        {hasMore && (
          <button
            onClick={() => setShowAll((s) => !s)}
            className="w-full py-2.5 text-center text-xs font-mono text-amber-400 hover:text-amber-300 transition-colors border-t border-cream-100 dark:border-gray-800/30 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400"
          >
            {showAll
              ? 'Show less'
              : `View all ${transactions.length} transactions`}
          </button>
        )}
      </div>
    </section>
  );
}

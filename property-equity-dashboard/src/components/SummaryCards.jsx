import { useState, useEffect } from 'react';

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/**
 * Hook that counts from 0 to a target value over ~800ms.
 */
function useCountUp(target) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target == null || target === 0) {
      setValue(target ?? 0);
      return;
    }

    const duration = 800;
    const frames = 30;
    const interval = duration / frames;
    const step = target / frames;
    let current = 0;
    let frame = 0;

    const timer = setInterval(() => {
      frame += 1;
      current += step;
      if (frame >= frames) {
        setValue(target);
        clearInterval(timer);
      } else {
        setValue(Math.round(current));
      }
    }, interval);

    return () => clearInterval(timer);
  }, [target]);

  return value;
}

/**
 * Get the sum of transaction amounts for the current calendar month.
 */
function currentMonthTotal(transactions) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  return transactions.reduce((sum, t) => {
    const d = new Date(t.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      return sum + (t.amount ?? 0);
    }
    return sum;
  }, 0);
}

/**
 * Get the sum of ALL transaction amounts.
 */
function runningTotal(transactions) {
  return transactions.reduce((sum, t) => sum + (t.amount ?? 0), 0);
}

export default function SummaryCards({
  property,
  transactions = [],
  projections = [],
  ownershipShare = 1,
  currentHomeValue,
  currentLoanBalance,
}) {
  // --- Compute raw values ---

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

  // Card 2: This Month's Cash Flow
  const monthCashFlow = Math.round(
    currentMonthTotal(transactions) * ownershipShare
  );

  // Card 3: Running Balance
  const running = Math.round(runningTotal(transactions) * ownershipShare);

  // --- Count-up animated values ---
  const animatedEquity = useCountUp(equity);
  const animatedMonth = useCountUp(monthCashFlow);
  const animatedRunning = useCountUp(running);

  // --- Card definitions ---
  const cards = [
    {
      label: 'YOUR EQUITY',
      value: animatedEquity,
      delta:
        equityDelta !== 0
          ? `${equityDelta >= 0 ? '+' : ''}${currencyFormat.format(equityDelta)}/mo est.`
          : null,
      colorClass: 'text-amber-400',
      emphasis: true,
    },
    {
      label: 'THIS MONTH',
      value: animatedMonth,
      delta: null,
      colorClass: monthCashFlow >= 0 ? 'text-amber-400' : 'text-rose-500',
      emphasis: false,
    },
    {
      label: 'RUNNING BALANCE',
      value: animatedRunning,
      delta: 'since Jun 2025',
      colorClass: running >= 0 ? 'text-amber-400' : 'text-rose-500',
      emphasis: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
      {cards.map((card, index) => (
        <div
          key={card.label}
          className={[
            'rounded-xl px-5 py-4 border transition-colors',
            // Dark / light container
            'bg-white/60 border-cream-100',
            'dark:bg-gray-900/50 dark:border-gray-800',
            // First card emphasis
            card.emphasis
              ? 'border-amber-400/30 dark:border-amber-400/20 shadow-[0_0_20px_-6px_rgba(212,168,83,0.15)]'
              : '',
          ].join(' ')}
          style={{
            opacity: 0,
            animation: 'fadeInUp 0.5s ease forwards',
            animationDelay: `${index * 0.1}s`,
          }}
        >
          {/* Label */}
          <p className="text-[11px] uppercase tracking-widest font-body text-gray-500 dark:text-gray-400 mb-1">
            {card.label}
          </p>

          {/* Value */}
          <p
            className={`text-2xl sm:text-3xl font-mono font-bold ${card.colorClass}`}
          >
            {currencyFormat.format(card.value)}
          </p>

          {/* Delta / subtitle */}
          {card.delta && (
            <p className="text-xs font-body text-gray-400 dark:text-gray-500 mt-1">
              {card.delta}
            </p>
          )}
        </div>
      ))}

      {/* Keyframe definition */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

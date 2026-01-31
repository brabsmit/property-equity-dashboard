import { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

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

  const equity = payload.find((p) => p.dataKey === 'equity');
  const cashFlow = payload.find((p) => p.dataKey === 'cashFlow');

  return (
    <div
      className="rounded-lg px-4 py-3 shadow-lg border"
      style={{
        backgroundColor: '#1a1a2e',
        borderColor: '#d4a853',
      }}
    >
      <p className="text-xs font-body text-gray-400 mb-1">{label}</p>
      {equity && (
        <p className="text-sm font-mono text-amber-400">
          Equity: {currencyFull.format(equity.value)}
        </p>
      )}
      {cashFlow && (
        <p className="text-sm font-mono text-gray-300">
          Cash Flow: {currencyFull.format(cashFlow.value)}
        </p>
      )}
    </div>
  );
}

export default function EquityChart({ projections = [], ownershipShare = 1 }) {
  const [showMyShare, setShowMyShare] = useState(false);

  const sharePercent = Math.round(ownershipShare * 100);

  const chartData = projections.map((p) => ({
    year: `Yr ${p.year}`,
    equity: showMyShare ? Math.round(p.equity * ownershipShare) : p.equity,
    cashFlow: showMyShare
      ? Math.round(p.cashFlow * ownershipShare)
      : p.cashFlow,
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
      <div className="flex items-center justify-between px-5 pt-5 pb-2">
        <h2 className="font-display text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
          EQUITY PROJECTION
        </h2>

        {/* Toggle buttons */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800/60 rounded-full p-0.5">
          <button
            onClick={() => setShowMyShare(false)}
            className={[
              'px-3 py-1 rounded-full text-xs font-body font-medium transition-colors cursor-pointer',
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
              'px-3 py-1 rounded-full text-xs font-body font-medium transition-colors cursor-pointer',
              showMyShare
                ? 'bg-amber-400 text-gray-900 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
            ].join(' ')}
          >
            Your Share ({sharePercent}%)
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="px-3 pb-5 pt-2">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
          >
            <defs>
              <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#d4a853" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#d4a853" stopOpacity={0} />
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
              label={{
                value: 'Year',
                position: 'insideBottomRight',
                offset: -5,
                fontSize: 11,
                fill: '#9ca3af',
              }}
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

            <Area
              type="monotone"
              dataKey="equity"
              stroke="#d4a853"
              strokeWidth={2}
              fill="url(#equityGradient)"
              isAnimationActive={true}
              animationDuration={1500}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Settings } from 'lucide-react';
import {
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

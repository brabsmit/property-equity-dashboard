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
            type="number"
            domain={[0, 119]}
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

          <YAxis
            yAxisId="monthly"
            tickFormatter={formatCurrency}
            tick={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
            stroke="#9ca3af"
            tickLine={false}
            axisLine={false}
            width={55}
          />

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

          <ReferenceLine
            yAxisId="monthly"
            y={0}
            stroke="#9ca3af"
            strokeOpacity={0.5}
            strokeDasharray="3 3"
          />

          <Bar
            yAxisId="monthly"
            dataKey="net"
            barSize={3}
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

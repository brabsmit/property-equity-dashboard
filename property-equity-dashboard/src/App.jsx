import React, { useState, useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { DollarSign, TrendingUp, Home, Activity, Settings } from 'lucide-react';

// --- Initial Data from Spreadsheet ---
const INITIAL_DATA = {
  assumptions: {
    homeValue: 330000.0,
    homeGrowth: 0.04,
    inflation: 0.03,
    rentIncrease: 0.04,
    maintenance: 300.0, // Monthly
    propManFee: 95.0, // Monthly
    rent: 1850.0, // Monthly
    taxRate: 0.24, // Income Tax Rate
    propertyTax: 3809.04, // Annual
    insurance: 2117.23, // Annual
    pmi: 488.88, // Annual
    loanBalance: 274803.87,
    loanRate: 0.0599,
    loanTerm: 30,
    initialInvestment: 17478.77,
    ownershipShare: 0.3333 // 1/3 Share
  },
  transactions: [
    { date: "2025-06-01", description: "Mortgage", amount: -2454.72 },
    { date: "2025-06-01", description: "Rent Income", amount: 1836.5 },
    { date: "2025-06-01", description: "Rent Income", amount: 13.5 },
    { date: "2025-06-04", description: "Deep Cleaning", amount: -400.0 },
    { date: "2025-06-09", description: "Lease Fee", amount: -925.0 },
    { date: "2025-06-09", description: "Manag Fee", amount: -95.0 },
    { date: "2025-06-20", description: "Toilet Repair", amount: -150.0 },
    { date: "2025-07-01", description: "Mortgage", amount: -2454.72 },
    { date: "2025-07-01", description: "Rent Income", amount: 1850.0 },
    { date: "2025-07-08", description: "Manag Fee", amount: -95.0 },
    { date: "2025-08-01", description: "Mortgage", amount: -2454.72 },
    { date: "2025-08-01", description: "Plumbing Leak", amount: -320.0 },
    { date: "2025-08-01", description: "Rent Income", amount: 873.5 },
    { date: "2025-08-01", description: "Rent Income", amount: 763.0 },
    { date: "2025-08-04", description: "Irrigation Leak", amount: -595.0 },
    { date: "2025-08-06", description: "Water Leak Repair", amount: -1550.0 },
    { date: "2025-08-07", description: "Manag Fee", amount: -95.0 },
    { date: "2025-08-28", description: "Dry wall repair", amount: -475.0 },
    { date: "2025-09-01", description: "Mortgage", amount: -2377.11 },
    { date: "2025-09-01", description: "Manag Fee", amount: -95.0 },
    { date: "2025-09-01", description: "Rent Income", amount: 1850.0 },
    { date: "2025-09-03", description: "Garage Door Fix", amount: -300.0 },
    { date: "2025-10-01", description: "Mortgage", amount: -2377.11 },
    { date: "2025-10-01", description: "Manag Fee", amount: -95.0 },
    { date: "2025-10-01", description: "Rent Income", amount: 1850.0 },
    { date: "2025-11-01", description: "Mortgage", amount: -2377.11 },
    { date: "2025-11-01", description: "Manag Fee", amount: -95.0 },
    { date: "2025-11-01", description: "Rent Income", amount: 1850.0 },
    { date: "2025-12-01", description: "Mortgage", amount: -2377.11 },
    { date: "2025-12-01", description: "Manag Fee", amount: -95.0 },
    { date: "2025-12-01", description: "Rent Income", amount: 1850.0 }
  ]
};

// --- Helper Components ---
const Card = ({ title, children, className }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-slate-200 p-6 ${className}`}>
    <h3 className="text-lg font-semibold text-slate-800 mb-4">{title}</h3>
    {children}
  </div>
);

const InputGroup = ({ label, value, onChange, type = "number", step = "0.01", prefix = "" }) => (
  <div className="mb-3">
    <label className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
    <div className="relative">
      {prefix && <span className="absolute left-3 top-2 text-slate-400">{prefix}</span>}
      <input
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className={`w-full p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${prefix ? 'pl-7' : ''}`}
      />
    </div>
  </div>
);

const MetricCard = ({ label, value, subtext, icon: Icon, color = "blue" }) => (
  <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-start space-x-4">
    <div className={`p-3 rounded-lg bg-${color}-50 text-${color}-600`}>
      <Icon size={24} />
    </div>
    <div>
      <p className="text-sm text-slate-500">{label}</p>
      <h4 className="text-2xl font-bold text-slate-800">{value}</h4>
      {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
    </div>
  </div>
);

// --- Main App Component ---
export default function PropertyDashboard() {
  const [params, setParams] = useState(INITIAL_DATA.assumptions);
  const [viewMode, setViewMode] = useState('total'); // 'total' or 'share'

  // --- Calculations ---
  const projections = useMemo(() => {
    let data = [];
    let currentHomeValue = params.homeValue;
    let currentRent = params.rent * 12; // Annual
    let currentLoanBalance = params.loanBalance;
    
    // Mortgage Constant Calculation (Annual P+I)
    const r = params.loanRate / 12;
    const n = params.loanTerm * 12;
    const monthlyPI = (params.loanBalance * r * (Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
    const annualPI = monthlyPI * 12;

    for (let year = 1; year <= 10; year++) {
      // Inflate Values
      currentHomeValue = currentHomeValue * (1 + params.homeGrowth);
      currentRent = year === 1 ? currentRent * (1 + params.rentIncrease) : currentRent * (1 + params.rentIncrease); // Apply growth
      
      // Expenses
      const inflationFactor = Math.pow(1 + params.inflation, year);
      const maint = params.maintenance * 12 * inflationFactor;
      const propMan = params.propManFee * 12; // Assuming fixed contract or update logic here
      const taxes = params.propertyTax * inflationFactor;
      const insurance = params.insurance * inflationFactor;
      const pmi = year <= 4 ? params.pmi : 0; // PMI drops off after 4 years roughly
      
      const totalExpenses = maint + propMan + taxes + insurance + pmi;
      
      // Loan Amortization (Rough Annual)
      const interest = currentLoanBalance * params.loanRate;
      const principal = annualPI - interest;
      currentLoanBalance = currentLoanBalance - principal;
      
      // Metrics
      const equity = currentHomeValue - currentLoanBalance;
      const cashFlow = currentRent - totalExpenses - annualPI;
      
      // User Share Logic
      const userEquity = equity * params.ownershipShare;
      // Adjust Cashflow: Year 1 usually has initial investment outlfow, but for "Cash Flow" chart we usually show operating cash flow
      const userCashFlow = cashFlow * params.ownershipShare;

      data.push({
        year,
        homeValue: Math.round(currentHomeValue),
        loanBalance: Math.round(currentLoanBalance),
        equity: Math.round(equity),
        cashFlow: Math.round(cashFlow),
        userEquity: Math.round(userEquity),
        userCashFlow: Math.round(userCashFlow),
        totalExpenses: Math.round(totalExpenses + annualPI) // Expenses + Debt Service
      });
    }
    return data;
  }, [params]);

  const runningTotals = useMemo(() => {
    let running = 0;
    return INITIAL_DATA.transactions.map(t => {
      running += t.amount;
      return { ...t, running };
    });
  }, []);

  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  const formatPercent = (val) => `${(val * 100).toFixed(2)}%`;

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-800">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Property Investment Dashboard</h1>
          <p className="text-slate-500 mt-1">Analyzing equity and cash flow for property at {formatCurrency(params.homeValue)}</p>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-2 bg-white p-1 rounded-lg border border-slate-200">
          <button 
            onClick={() => setViewMode('total')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'total' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Total Property
          </button>
          <button 
            onClick={() => setViewMode('share')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'share' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            My Share (33%)
          </button>
        </div>
      </header>

      {/* High Level Metrics (Year 10 Projection) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <MetricCard 
          label="Proj. Equity (Year 10)" 
          value={formatCurrency(viewMode === 'total' ? projections[9].equity : projections[9].userEquity)} 
          subtext="Based on current growth rates"
          icon={TrendingUp}
          color="emerald"
        />
        <MetricCard 
          label="Avg. Annual Cash Flow" 
          value={formatCurrency(viewMode === 'total' ? projections.reduce((a,b) => a + b.cashFlow, 0)/10 : projections.reduce((a,b) => a + b.userCashFlow, 0)/10)} 
          subtext="Estimated over 10 years"
          icon={DollarSign}
          color="blue"
        />
        <MetricCard 
          label="Current Loan Balance" 
          value={formatCurrency(params.loanBalance)} 
          subtext={`Rate: ${formatPercent(params.loanRate)}`}
          icon={Home}
          color="amber"
        />
        <MetricCard 
          label="Running Net (Actuals)" 
          value={formatCurrency(runningTotals[runningTotals.length-1].running)} 
          subtext="From expenses file"
          icon={Activity}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Sidebar Controls */}
        <div className="lg:col-span-1 space-y-6">
          <Card title="Assumptions & Drivers">
            <div className="space-y-4">
              <InputGroup label="Home Growth Rate" value={params.homeGrowth} onChange={v => setParams({...params, homeGrowth: v})} step="0.005" />
              <InputGroup label="Rent Growth Rate" value={params.rentIncrease} onChange={v => setParams({...params, rentIncrease: v})} step="0.005" />
              <InputGroup label="Inflation Rate" value={params.inflation} onChange={v => setParams({...params, inflation: v})} step="0.005" />
              <div className="border-t border-slate-100 pt-4"></div>
              <InputGroup label="Monthly Rent (Start)" value={params.rent} onChange={v => setParams({...params, rent: v})} prefix="$" />
              <InputGroup label="Monthly Maintenance" value={params.maintenance} onChange={v => setParams({...params, maintenance: v})} prefix="$" />
              <InputGroup label="Property Management" value={params.propManFee} onChange={v => setParams({...params, propManFee: v})} prefix="$" />
            </div>
          </Card>

          <Card title="Loan Details">
             <div className="space-y-4">
               <InputGroup label="Loan Balance" value={params.loanBalance} onChange={v => setParams({...params, loanBalance: v})} prefix="$" />
               <InputGroup label="Interest Rate" value={params.loanRate} onChange={v => setParams({...params, loanRate: v})} step="0.001" />
               <InputGroup label="Initial Home Value" value={params.homeValue} onChange={v => setParams({...params, homeValue: v})} prefix="$" />
             </div>
          </Card>
        </div>

        {/* Charts Area */}
        <div className="lg:col-span-2 space-y-8">
          
          <Card title="Equity Projection (10 Years)" className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projections} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={(val) => `$${val/1000}k`} />
                <Tooltip formatter={(val) => formatCurrency(val)} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey={viewMode === 'total' ? "homeValue" : "userEquity"} 
                  name={viewMode === 'total' ? "Home Value" : "My Equity"} 
                  stroke="#10b981" 
                  strokeWidth={2} 
                />
                {viewMode === 'total' && (
                  <Line 
                    type="monotone" 
                    dataKey="loanBalance" 
                    name="Loan Balance" 
                    stroke="#ef4444" 
                    strokeWidth={2} 
                  />
                )}
                {viewMode === 'total' && (
                  <Line 
                    type="monotone" 
                    dataKey="equity" 
                    name="Net Equity" 
                    stroke="#3b82f6" 
                    strokeWidth={2} 
                    strokeDasharray="5 5"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Cash Flow Projection (10 Years)" className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projections} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="year" />
                <YAxis />
                <Tooltip formatter={(val) => formatCurrency(val)} />
                <Legend />
                <ReferenceLine y={0} stroke="#000" />
                <Bar 
                  dataKey={viewMode === 'total' ? "cashFlow" : "userCashFlow"} 
                  name="Annual Cash Flow" 
                  fill="#8884d8" 
                  radius={[4, 4, 0, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Actual Running Expenses (Latest 10)" className="overflow-hidden">
             <div className="overflow-x-auto">
               <table className="min-w-full text-sm text-left text-slate-600">
                 <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500">
                   <tr>
                     <th className="px-4 py-3">Date</th>
                     <th className="px-4 py-3">Description</th>
                     <th className="px-4 py-3 text-right">Amount</th>
                     <th className="px-4 py-3 text-right">Running Net</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {runningTotals.slice(-10).map((t, idx) => (
                     <tr key={idx} className="hover:bg-slate-50">
                       <td className="px-4 py-3">{t.date}</td>
                       <td className="px-4 py-3">{t.description}</td>
                       <td className={`px-4 py-3 text-right font-medium ${t.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                         {formatCurrency(t.amount)}
                       </td>
                       <td className="px-4 py-3 text-right font-semibold">
                         {formatCurrency(t.running)}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </Card>

        </div>
      </div>
    </div>
  );
}
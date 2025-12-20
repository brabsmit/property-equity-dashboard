import React, { useState, useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, AreaChart, Area } from 'recharts';
import { DollarSign, TrendingUp, Home, Activity, PieChart, Coins } from 'lucide-react';

// --- Initial Data from Spreadsheet ---
const INITIAL_DATA = {
  assumptions: {
    homeValue: 330000.0,
    landValue: 48700.0, // Approx derived from spreadsheet depreciation
    homeGrowth: 0.04,
    inflation: 0.03,
    rentIncrease: 0.04,
    maintenance: 300.0, // Monthly
    propManFee: 95.0, // Monthly
    rent: 1850.0, // Monthly
    taxRate: 0.24, // Income Tax Rate (Federal + State effective)
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

const MetricCard = ({ label, value, subtext, icon: Icon, color = "blue", highlight = false }) => (
  <div className={`p-4 rounded-xl border shadow-sm flex items-start space-x-4 ${highlight ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100'}`}>
    <div className={`p-3 rounded-lg bg-${color}-100 text-${color}-600`}>
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
  const [taxMode, setTaxMode] = useState(true); // Toggle tax calculations

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

    // Depreciation (Straight line 27.5 years)
    const annualDepreciation = (params.homeValue - params.landValue) / 27.5;

    for (let year = 1; year <= 10; year++) {
      // Inflate Values
      currentHomeValue = currentHomeValue * (1 + params.homeGrowth);
      currentRent = year === 1 ? currentRent * (1 + params.rentIncrease) : currentRent * (1 + params.rentIncrease); 
      
      // Expenses
      const inflationFactor = Math.pow(1 + params.inflation, year);
      const maint = params.maintenance * 12 * inflationFactor;
      const propMan = params.propManFee * 12; 
      const taxes = params.propertyTax * inflationFactor;
      const insurance = params.insurance * inflationFactor;
      const pmi = year <= 4 ? params.pmi : 0; 
      
      const operatingExpenses = maint + propMan + taxes + insurance + pmi;
      
      // Loan Amortization
      const interest = currentLoanBalance * params.loanRate;
      const principal = annualPI - interest;
      currentLoanBalance = currentLoanBalance - principal;
      
      // 1. Pre-Tax Cash Flow
      const preTaxCashFlow = currentRent - operatingExpenses - annualPI;

      // 2. Tax Calculation
      // Taxable Income = Rent - Operating Expenses - Interest - Depreciation
      const taxableIncome = currentRent - operatingExpenses - interest - annualDepreciation;
      // Negative tax bill means a tax SAVING (refund/credit)
      const taxBill = taxableIncome * params.taxRate;
      
      // 3. After-Tax Cash Flow
      // If taxBill is negative (saving), we add it back. If positive (owing), we subtract.
      const afterTaxCashFlow = preTaxCashFlow - taxBill;

      // Select Cash Flow based on mode
      const finalCashFlow = taxMode ? afterTaxCashFlow : preTaxCashFlow;

      // Metrics
      const equity = currentHomeValue - currentLoanBalance;
      
      // User Share Logic
      const userEquity = equity * params.ownershipShare;
      const userCashFlow = finalCashFlow * params.ownershipShare;
      const userTaxSavings = (taxBill * -1) * params.ownershipShare;

      data.push({
        year,
        homeValue: Math.round(currentHomeValue),
        loanBalance: Math.round(currentLoanBalance),
        equity: Math.round(equity),
        cashFlow: Math.round(finalCashFlow),
        userEquity: Math.round(userEquity),
        userCashFlow: Math.round(userCashFlow),
        taxableIncome: Math.round(taxableIncome),
        taxSavings: Math.round(taxBill * -1), // Positive number for visualization
        userTaxSavings: Math.round(userTaxSavings)
      });
    }
    return data;
  }, [params, taxMode]);

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
          <p className="text-slate-500 mt-1">
            Analyzing equity and {taxMode ? 'after-tax' : 'pre-tax'} cash flow
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center space-x-4">
           {/* Tax Mode Toggle */}
           <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
            <span className={`text-sm font-medium ${!taxMode ? 'text-blue-600' : 'text-slate-400'}`}>Pre-Tax</span>
            <button 
              onClick={() => setTaxMode(!taxMode)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${taxMode ? 'bg-blue-600' : 'bg-slate-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${taxMode ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className={`text-sm font-medium ${taxMode ? 'text-blue-600' : 'text-slate-400'}`}>After-Tax</span>
          </div>

          <div className="flex space-x-2 bg-white p-1 rounded-lg border border-slate-200">
            <button 
              onClick={() => setViewMode('total')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'total' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Total Property
            </button>
            <button 
              onClick={() => setViewMode('share')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'share' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              My Share (33%)
            </button>
          </div>
        </div>
      </header>

      {/* High Level Metrics (Year 10 Projection) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <MetricCard 
          label="Proj. Equity (Year 10)" 
          value={formatCurrency(viewMode === 'total' ? projections[9].equity : projections[9].userEquity)} 
          subtext="Based on market growth"
          icon={TrendingUp}
          color="emerald"
        />
        <MetricCard 
          label={`Avg. Annual Cash Flow`}
          value={formatCurrency(viewMode === 'total' ? projections.reduce((a,b) => a + b.cashFlow, 0)/10 : projections.reduce((a,b) => a + b.userCashFlow, 0)/10)} 
          subtext={taxMode ? "Includes tax savings" : "Operating cash only"}
          icon={DollarSign}
          color="blue"
          highlight={true}
        />
        {taxMode && (
          <MetricCard 
            label="Avg. Tax Savings / Yr" 
            value={formatCurrency(viewMode === 'total' ? projections.reduce((a,b) => a + b.taxSavings, 0)/10 : projections.reduce((a,b) => a + b.userTaxSavings, 0)/10)} 
            subtext="From Depr. & Losses"
            icon={Coins}
            color="amber"
          />
        )}
        <MetricCard 
          label="Running Net (Actuals)" 
          value={formatCurrency(runningTotals[runningTotals.length-1].running)} 
          subtext="Current bank balance"
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
              <div className="border-t border-slate-100 pt-4"></div>
              <InputGroup label="Monthly Rent (Start)" value={params.rent} onChange={v => setParams({...params, rent: v})} prefix="$" />
              <InputGroup label="Monthly Maintenance" value={params.maintenance} onChange={v => setParams({...params, maintenance: v})} prefix="$" />
            </div>
          </Card>

          <Card title="Tax & Loan Inputs">
             <div className="space-y-4">
               <InputGroup label="Effective Tax Rate" value={params.taxRate} onChange={v => setParams({...params, taxRate: v})} step="0.01" />
               <InputGroup label="Land Value (Non-Depr)" value={params.landValue} onChange={v => setParams({...params, landValue: v})} prefix="$" />
               <div className="border-t border-slate-100 pt-4"></div>
               <InputGroup label="Loan Balance" value={params.loanBalance} onChange={v => setParams({...params, loanBalance: v})} prefix="$" />
               <InputGroup label="Interest Rate" value={params.loanRate} onChange={v => setParams({...params, loanRate: v})} step="0.001" />
             </div>
          </Card>
        </div>

        {/* Charts Area */}
        <div className="lg:col-span-2 space-y-8">
          
          <Card title={`Cash Flow & Tax Impact (${viewMode === 'total' ? 'Total' : 'Your Share'})`} className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projections} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="year" />
                <YAxis />
                <Tooltip formatter={(val) => formatCurrency(val)} cursor={{fill: '#f8fafc'}} />
                <Legend />
                <ReferenceLine y={0} stroke="#cbd5e1" />
                
                <Bar 
                  dataKey={viewMode === 'total' ? "cashFlow" : "userCashFlow"} 
                  name={taxMode ? "Cash Flow (After Tax)" : "Cash Flow (Pre-Tax)"} 
                  fill="#3b82f6" 
                  radius={[4, 4, 0, 0]} 
                />
                
                {taxMode && (
                  <Bar 
                    dataKey={viewMode === 'total' ? "taxSavings" : "userTaxSavings"} 
                    name="Tax Benefit (Phantom)" 
                    fill="#fbbf24" 
                    radius={[4, 4, 0, 0]} 
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-slate-400 mt-2 text-center">
              *Yellow bar represents cash saved from other income sources due to rental losses (depreciation).
            </p>
          </Card>

          <Card title="Equity Projection (10 Years)" className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={projections} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={(val) => `$${val/1000}k`} />
                <Tooltip formatter={(val) => formatCurrency(val)} />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey={viewMode === 'total' ? "equity" : "userEquity"} 
                  name="Net Equity" 
                  stroke="#10b981" 
                  fillOpacity={1} 
                  fill="url(#colorEquity)" 
                />
                <Line 
                  type="monotone" 
                  dataKey={viewMode === 'total' ? "homeValue" : "userEquity"} 
                  name="Asset Value" 
                  stroke="#64748b" 
                  strokeDasharray="5 5"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Transaction Ledger (Actuals)" className="overflow-hidden">
             <div className="overflow-x-auto max-h-64 overflow-y-auto">
               <table className="min-w-full text-sm text-left text-slate-600">
                 <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 sticky top-0">
                   <tr>
                     <th className="px-4 py-3 bg-slate-50">Date</th>
                     <th className="px-4 py-3 bg-slate-50">Description</th>
                     <th className="px-4 py-3 text-right bg-slate-50">Amount</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {runningTotals.slice().reverse().map((t, idx) => (
                     <tr key={idx} className="hover:bg-slate-50">
                       <td className="px-4 py-2">{t.date}</td>
                       <td className="px-4 py-2">{t.description}</td>
                       <td className={`px-4 py-2 text-right font-medium ${t.amount > 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                         {formatCurrency(t.amount)}
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
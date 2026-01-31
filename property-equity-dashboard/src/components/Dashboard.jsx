import { useState, useEffect, useCallback } from 'react';
import { Shield, ShieldCheck, LogOut, PencilLine } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateProjections, generateMonthlyCashFlow } from '../lib/projections';
import { getEffectiveLoanBalance } from '../lib/amortization';
import SummaryCards from './SummaryCards';
import EquityChart from './EquityChart';
import TransactionTable from './TransactionTable';
import UpdateValuesModal from './UpdateValuesModal';

export default function Dashboard() {
  const [property, setProperty] = useState(null);
  const [partners, setPartners] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [latestHomeValue, setLatestHomeValue] = useState(null);
  const [latestLoanOverride, setLatestLoanOverride] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(
    () => localStorage.getItem('dashboard_admin') === 'true'
  );
  const [showUpdateValues, setShowUpdateValues] = useState(false);

  // Fetch all data on mount
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [propertyRes, partnersRes, transactionsRes, homeValueRes, loanOverrideRes] =
        await Promise.all([
          supabase.from('property').select('*').single(),
          supabase.from('partners').select('*'),
          supabase.from('transactions').select('*').order('date', { ascending: false }),
          supabase
            .from('property_value_history')
            .select('*')
            .order('recorded_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('loan_balance_history')
            .select('*')
            .order('recorded_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

      if (propertyRes.data) setProperty(propertyRes.data);
      if (partnersRes.data) setPartners(partnersRes.data);
      if (transactionsRes.data) setTransactions(transactionsRes.data);
      if (homeValueRes.data) setLatestHomeValue(homeValueRes.data);
      if (loanOverrideRes.data) setLatestLoanOverride(loanOverrideRes.data);

      setLoading(false);
    }

    fetchData();
  }, []);

  // Refresh transactions (passed to child components)
  const refreshTransactions = useCallback(async () => {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });
    if (data) setTransactions(data);
  }, []);

  // Refresh history data (called after UpdateValuesModal saves)
  const refreshHistory = useCallback(async () => {
    const [homeValueRes, loanOverrideRes] = await Promise.all([
      supabase
        .from('property_value_history')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('loan_balance_history')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (homeValueRes.data) setLatestHomeValue(homeValueRes.data);
    else setLatestHomeValue(null);
    if (loanOverrideRes.data) setLatestLoanOverride(loanOverrideRes.data);
    else setLatestLoanOverride(null);
  }, []);

  // Refresh property (called after ProjectionSettings saves)
  const refreshProperty = useCallback(async () => {
    const { data } = await supabase.from('property').select('*').single();
    if (data) setProperty(data);
  }, []);

  // Admin toggle handler
  function handleAdminToggle() {
    if (isAdmin) {
      localStorage.removeItem('dashboard_admin');
      setIsAdmin(false);
    } else {
      const entered = window.prompt('Enter admin passcode');
      if (entered && entered === import.meta.env.VITE_ADMIN_PASSCODE) {
        localStorage.setItem('dashboard_admin', 'true');
        setIsAdmin(true);
      }
    }
  }

  // Logout handler
  function handleLogout() {
    localStorage.removeItem('dashboard_auth');
    localStorage.removeItem('dashboard_admin');
    window.location.reload();
  }

  // Derive current values from history
  const currentHomeValue = property
    ? latestHomeValue
      ? Number(latestHomeValue.home_value)
      : Number(property.home_value)
    : 0;

  const currentLoanBalance = property
    ? getEffectiveLoanBalance(property, latestLoanOverride)
    : 0;

  // Compute three scenario projections
  const baseProjections = property
    ? generateProjections(property, {
        currentHomeValue,
        currentLoanBalance,
      })
    : [];

  const optimisticProjections = property
    ? generateProjections(property, {
        rateOffset: 0.02,
        currentHomeValue,
        currentLoanBalance,
      })
    : [];

  const pessimisticProjections = property
    ? generateProjections(property, {
        rateOffset: -0.02,
        currentHomeValue,
        currentLoanBalance,
      })
    : [];

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

  // Derive ownership share from partners (default to 1 if no partner data)
  const ownershipShare =
    partners.length > 0 ? partners[0].ownership_share : 1;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50 dark:bg-slate-950">
        <p className="font-mono text-sm text-gray-500 dark:text-gray-400 animate-pulse">
          Loading dashboard...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-50 dark:bg-slate-950 text-gray-900 dark:text-gray-100">
      {/* Noise texture overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-50">
        <svg width="100%" height="100%">
          <filter id="noise">
            <feTurbulence
              baseFrequency="0.65"
              numOctaves="3"
              stitchTiles="stitch"
            />
          </filter>
          <rect width="100%" height="100%" filter="url(#noise)" />
        </svg>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 mb-8 pb-4 border-b border-amber-400/20">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold">
            2728 Partnership
          </h1>
          <div className="flex items-center gap-3">
            {/* Update Values button (admin only) */}
            {isAdmin && (
              <button
                onClick={() => setShowUpdateValues(true)}
                title="Update property values"
                className="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-amber-400 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <PencilLine size={20} />
              </button>
            )}

            {/* Admin toggle */}
            <button
              onClick={handleAdminToggle}
              title={isAdmin ? 'Disable admin mode' : 'Enable admin mode'}
              className={[
                'p-2 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                isAdmin
                  ? 'text-amber-400 hover:text-amber-300 bg-amber-400/10'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300',
              ].join(' ')}
            >
              {isAdmin ? <ShieldCheck size={20} /> : <Shield size={20} />}
            </button>

            {/* Lock / logout icon */}
            <button
              onClick={handleLogout}
              title="Log out"
              className="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-rose-500 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {/* Summary Cards */}
        <SummaryCards
          property={property}
          transactions={transactions}
          projections={baseProjections}
          ownershipShare={ownershipShare}
          currentHomeValue={currentHomeValue}
          currentLoanBalance={currentLoanBalance}
        />

        {/* Gold separator */}
        <div className="border-b border-amber-400/20 my-8" />

        {/* Transactions */}
        <TransactionTable
          transactions={transactions}
          isAdmin={isAdmin}
          onTransactionAdded={refreshTransactions}
        />

        {/* Gold separator */}
        <div className="border-b border-amber-400/20 my-8" />

        {/* Equity Chart */}
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
      </div>

      {/* Update Values Modal */}
      {showUpdateValues && (
        <UpdateValuesModal
          property={property}
          latestHomeValue={latestHomeValue}
          latestLoanOverride={latestLoanOverride}
          currentCalculatedBalance={
            property?.original_loan_amount && property?.loan_start_date
              ? getEffectiveLoanBalance(property, null)
              : null
          }
          onClose={() => setShowUpdateValues(false)}
          onSaved={refreshHistory}
        />
      )}
    </div>
  );
}

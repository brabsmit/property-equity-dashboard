import { useState, useEffect, useCallback } from 'react';
import { Shield, ShieldCheck, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateProjections } from '../lib/projections';

// Temporary stubs until Tasks 6-8 create these
const SummaryCards = ({ property, transactions, ownershipShare }) => (
  <div className="text-gray-500 font-mono text-sm">Summary Cards loading...</div>
);
const TransactionTable = ({ transactions, isAdmin, onTransactionAdded }) => (
  <div className="text-gray-500 font-mono text-sm">Transactions loading...</div>
);
const EquityChart = ({ projections, ownershipShare }) => (
  <div className="text-gray-500 font-mono text-sm">Equity Chart loading...</div>
);

export default function Dashboard() {
  const [property, setProperty] = useState(null);
  const [partners, setPartners] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(
    () => localStorage.getItem('dashboard_admin') === 'true'
  );

  // Fetch all data on mount
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [propertyRes, partnersRes, transactionsRes] = await Promise.all([
        supabase.from('property').select('*').single(),
        supabase.from('partners').select('*'),
        supabase.from('transactions').select('*').order('date', { ascending: false }),
      ]);

      if (propertyRes.data) setProperty(propertyRes.data);
      if (partnersRes.data) setPartners(partnersRes.data);
      if (transactionsRes.data) setTransactions(transactionsRes.data);

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

  // Compute projections when property data is available
  const projections = property ? generateProjections(property) : [];

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
        <header className="flex items-center justify-between mb-8 pb-4 border-b border-amber-400/20">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold">
            2728 Partnership
          </h1>
          <div className="flex items-center gap-3">
            {/* Admin toggle */}
            <button
              onClick={handleAdminToggle}
              title={isAdmin ? 'Disable admin mode' : 'Enable admin mode'}
              className={[
                'p-2 rounded-lg transition-colors cursor-pointer',
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
              className="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-rose-500 transition-colors cursor-pointer"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {/* Summary Cards */}
        <SummaryCards
          property={property}
          transactions={transactions}
          ownershipShare={ownershipShare}
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
          projections={projections}
          ownershipShare={ownershipShare}
        />
      </div>
    </div>
  );
}

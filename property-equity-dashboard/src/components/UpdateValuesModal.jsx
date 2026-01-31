import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';

const SOURCES = ['Zillow', 'Redfin', 'Appraisal', 'Other'];

const currencyFull = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const inputBase =
  'rounded-md border bg-transparent px-3 py-2 text-sm transition-colors w-full ' +
  'border-gray-300 dark:border-gray-700 ' +
  'focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400 ' +
  'placeholder:text-gray-400 dark:placeholder:text-gray-600';

export default function UpdateValuesModal({
  property,
  latestHomeValue,
  latestLoanOverride,
  currentCalculatedBalance,
  onClose,
  onSaved,
}) {
  // Home value state
  const [homeValue, setHomeValue] = useState('');
  const [source, setSource] = useState('Zillow');
  const [homeNote, setHomeNote] = useState('');
  const [homeDate, setHomeDate] = useState(todayISO);

  // Loan balance state
  const [overrideLoan, setOverrideLoan] = useState(false);
  const [loanBalance, setLoanBalance] = useState('');
  const [loanNote, setLoanNote] = useState('');
  const [loanDate, setLoanDate] = useState(todayISO);

  const [submitting, setSubmitting] = useState(false);

  const currentHomeDisplay = latestHomeValue
    ? Number(latestHomeValue.home_value)
    : Number(property.home_value);

  const lastUpdatedDate = latestHomeValue?.recorded_at ?? null;

  async function handleSave() {
    setSubmitting(true);

    const promises = [];

    // Insert home value if provided
    if (homeValue && Number(homeValue) > 0) {
      promises.push(
        supabase.from('property_value_history').insert({
          recorded_at: homeDate,
          home_value: Number(homeValue),
          source,
          note: homeNote || null,
        })
      );
    }

    // Insert loan override if toggled on and value provided
    if (overrideLoan && loanBalance && Number(loanBalance) > 0) {
      promises.push(
        supabase.from('loan_balance_history').insert({
          recorded_at: loanDate,
          balance: Number(loanBalance),
          note: loanNote || null,
        })
      );
    }

    if (promises.length > 0) {
      await Promise.all(promises);
      onSaved?.();
    }

    setSubmitting(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-xl border bg-white dark:bg-gray-900 border-cream-100 dark:border-gray-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-100 dark:border-gray-800">
          <h2 className="font-display text-lg font-semibold">Update Values</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-6">
          {/* --- Home Value Section --- */}
          <div>
            <h3 className="text-[11px] uppercase tracking-widest font-body text-gray-500 dark:text-gray-400 mb-3">
              Home Value
            </h3>
            <p className="text-sm font-body text-gray-500 dark:text-gray-400 mb-1">
              Current: <span className="font-mono text-amber-400">{currencyFull.format(currentHomeDisplay)}</span>
              {lastUpdatedDate && (
                <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                  (updated {lastUpdatedDate})
                </span>
              )}
            </p>

            <div className="space-y-2 mt-2">
              <input
                type="number"
                step="1000"
                min="0"
                value={homeValue}
                onChange={(e) => setHomeValue(e.target.value)}
                placeholder="New estimated value"
                className={`${inputBase} font-mono`}
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={homeDate}
                  onChange={(e) => setHomeDate(e.target.value)}
                  className={`${inputBase} flex-1`}
                />
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className={`${inputBase} flex-1`}
                >
                  {SOURCES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                value={homeNote}
                onChange={(e) => setHomeNote(e.target.value)}
                placeholder="Note (optional)"
                className={inputBase}
              />
            </div>
          </div>

          {/* --- Loan Balance Section --- */}
          <div>
            <h3 className="text-[11px] uppercase tracking-widest font-body text-gray-500 dark:text-gray-400 mb-3">
              Loan Balance
            </h3>

            {currentCalculatedBalance != null && (
              <p className="text-sm font-body text-gray-500 dark:text-gray-400 mb-1">
                Calculated: <span className="font-mono text-gray-300">{currencyFull.format(currentCalculatedBalance)}</span>
              </p>
            )}

            {latestLoanOverride && (
              <p className="text-sm font-body text-gray-500 dark:text-gray-400 mb-1">
                Last override: <span className="font-mono text-amber-400">{currencyFull.format(Number(latestLoanOverride.balance))}</span>
                <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                  ({latestLoanOverride.recorded_at})
                </span>
              </p>
            )}

            {/* Override toggle */}
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={overrideLoan}
                onChange={(e) => setOverrideLoan(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-amber-400 focus:ring-amber-400"
              />
              <span className="text-sm font-body text-gray-600 dark:text-gray-300">
                Override with actual balance
              </span>
            </label>

            {overrideLoan && (
              <div className="space-y-2 mt-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={loanBalance}
                  onChange={(e) => setLoanBalance(e.target.value)}
                  placeholder="Actual balance from statement"
                  className={`${inputBase} font-mono`}
                />
                <input
                  type="date"
                  value={loanDate}
                  onChange={(e) => setLoanDate(e.target.value)}
                  className={inputBase}
                />
                <input
                  type="text"
                  value={loanNote}
                  onChange={(e) => setLoanNote(e.target.value)}
                  placeholder="Note (optional)"
                  className={inputBase}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-cream-100 dark:border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm font-body text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={submitting}
            className="px-4 py-2 rounded-md bg-amber-400 text-slate-950 text-sm font-semibold
              hover:bg-amber-400/80 transition-colors disabled:opacity-50 cursor-pointer
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1"
          >
            {submitting ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

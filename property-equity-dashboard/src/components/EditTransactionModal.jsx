import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';

const CATEGORIES = [
  'mortgage',
  'rent',
  'repair',
  'management_fee',
  'insurance',
  'tax',
  'other',
];

const inputBase =
  'rounded-md border bg-transparent px-3 py-2 text-sm transition-colors w-full ' +
  'border-gray-300 dark:border-gray-700 ' +
  'focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400 ' +
  'placeholder:text-gray-400 dark:placeholder:text-gray-600';

export default function EditTransactionModal({ transaction, onClose, onSaved }) {
  const [date, setDate] = useState(transaction.date);
  const [type, setType] = useState(Number(transaction.amount) >= 0 ? 'income' : 'expense');
  const [category, setCategory] = useState(transaction.category);
  const [amount, setAmount] = useState(String(Math.abs(Number(transaction.amount))));
  const [note, setNote] = useState(transaction.note || '');
  const [submitting, setSubmitting] = useState(false);

  async function handleSave() {
    if (!amount || Number(amount) === 0) return;

    setSubmitting(true);
    const finalAmount =
      type === 'expense'
        ? -Math.abs(Number(amount))
        : Math.abs(Number(amount));

    const { error } = await supabase
      .from('transactions')
      .update({
        date,
        category,
        amount: finalAmount,
        note: note || null,
      })
      .eq('id', transaction.id);

    if (!error) {
      onSaved?.();
      onClose();
    }

    setSubmitting(false);
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
          <h2 className="font-display text-lg font-semibold">Edit Transaction</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Date */}
          <div>
            <label className="text-[11px] uppercase tracking-widest font-body text-gray-500 dark:text-gray-400 mb-1 block">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className={inputBase}
            />
          </div>

          {/* Type toggle */}
          <div>
            <label className="text-[11px] uppercase tracking-widest font-body text-gray-500 dark:text-gray-400 mb-1 block">
              Type
            </label>
            <div className="flex rounded-md overflow-hidden border border-gray-300 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setType('expense')}
                className={`flex-1 px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                  type === 'expense'
                    ? 'bg-rose-500/20 text-rose-500 dark:text-rose-400'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => setType('income')}
                className={`flex-1 px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                  type === 'income'
                    ? 'bg-amber-400/20 text-amber-400'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                Income
              </button>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="text-[11px] uppercase tracking-widest font-body text-gray-500 dark:text-gray-400 mb-1 block">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputBase}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="text-[11px] uppercase tracking-widest font-body text-gray-500 dark:text-gray-400 mb-1 block">
              Amount
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              className={`${inputBase} font-mono`}
            />
          </div>

          {/* Note */}
          <div>
            <label className="text-[11px] uppercase tracking-widest font-body text-gray-500 dark:text-gray-400 mb-1 block">
              Description
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Description..."
              className={inputBase}
            />
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

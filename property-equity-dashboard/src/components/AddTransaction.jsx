import { useState } from 'react';
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

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default function AddTransaction({ onTransactionAdded }) {
  const [date, setDate] = useState(todayISO);
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense'); // 'expense' | 'income'
  const [category, setCategory] = useState('mortgage');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!amount || Number(amount) === 0) return;

    setSubmitting(true);
    const finalAmount =
      type === 'expense'
        ? -Math.abs(Number(amount))
        : Math.abs(Number(amount));

    const { error } = await supabase.from('transactions').insert({
      date,
      category,
      amount: finalAmount,
      note: note || null,
    });

    if (!error) {
      setAmount('');
      setNote('');
      setDate(todayISO());
      setType('expense');
      setCategory('mortgage');
      onTransactionAdded?.();
    }

    setSubmitting(false);
  }

  const inputBase =
    'rounded-md border bg-transparent px-2 py-1.5 text-sm transition-colors ' +
    'border-gray-300 dark:border-gray-700 ' +
    'focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400 ' +
    'placeholder:text-gray-400 dark:placeholder:text-gray-600';

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-2 px-3 py-3 border-b border-cream-100 dark:border-gray-800/30 bg-amber-400/5"
    >
      {/* Date */}
      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-500 font-mono">
          Date
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className={`${inputBase} w-[130px]`}
        />
      </div>

      {/* Type toggle */}
      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-500 font-mono">
          Type
        </label>
        <div className="flex rounded-md overflow-hidden border border-gray-300 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
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
            className={`px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
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
      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-500 font-mono">
          Category
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={`${inputBase} w-[140px]`}
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </option>
          ))}
        </select>
      </div>

      {/* Amount */}
      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-500 font-mono">
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
          className={`${inputBase} w-[100px] font-mono`}
        />
      </div>

      {/* Note */}
      <div className="flex flex-col gap-0.5 flex-1 min-w-[140px]">
        <label className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-500 font-mono">
          Description
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Description..."
          className={`${inputBase}`}
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="px-4 py-1.5 rounded-md bg-amber-400 text-slate-950 text-sm font-semibold
          hover:bg-amber-400/80 transition-colors disabled:opacity-50 cursor-pointer"
      >
        {submitting ? '...' : 'Add'}
      </button>
    </form>
  );
}

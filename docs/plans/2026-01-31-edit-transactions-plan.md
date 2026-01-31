# Edit Transactions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow admins to edit and delete existing transactions via action icons in the transaction table.

**Architecture:** Add edit/delete icon buttons to each transaction row (admin-only). Edit opens a modal pre-filled with the transaction data. Delete shows a confirmation dialog. Both use existing Supabase RLS policies (UPDATE/DELETE already allowed).

**Tech Stack:** React 19, Supabase JS client, Tailwind CSS, lucide-react icons, Recharts (unchanged)

---

### Task 1: Add Edit/Delete Action Icons to TransactionTable

**Files:**
- Modify: `property-equity-dashboard/src/components/TransactionTable.jsx`

**Step 1: Add Pencil and Trash2 imports**

At the top of `TransactionTable.jsx`, add the lucide import:

```jsx
import { Pencil, Trash2 } from 'lucide-react';
```

**Step 2: Add `onEdit` and `onDelete` to component props**

Change the function signature at line 89 from:

```jsx
export default function TransactionTable({
  transactions = [],
  isAdmin = false,
  onTransactionAdded,
}) {
```

to:

```jsx
export default function TransactionTable({
  transactions = [],
  isAdmin = false,
  onTransactionAdded,
  onEdit,
  onDelete,
}) {
```

**Step 3: Add Actions column header to desktop table**

After the Amount `<th>` (line 133), add a conditional Actions header:

```jsx
{isAdmin && (
  <th className="text-right px-4 py-2.5 font-medium w-[80px]">Actions</th>
)}
```

**Step 4: Add action buttons to each desktop table row**

After the Amount `<td>` (line 151-153), add a conditional Actions cell:

```jsx
{isAdmin && (
  <td className="px-4 py-2.5 text-right whitespace-nowrap">
    <button
      onClick={() => onEdit?.(tx)}
      title="Edit transaction"
      className="p-1 rounded text-gray-400 hover:text-amber-400 transition-colors cursor-pointer"
    >
      <Pencil size={14} />
    </button>
    <button
      onClick={() => onDelete?.(tx)}
      title="Delete transaction"
      className="p-1 rounded text-gray-400 hover:text-rose-500 transition-colors cursor-pointer ml-1"
    >
      <Trash2 size={14} />
    </button>
  </td>
)}
```

**Step 5: Update the empty-state colSpan**

Change the `colSpan={4}` on line 160 to be dynamic:

```jsx
<td
  colSpan={isAdmin ? 5 : 4}
  className="px-4 py-8 text-center text-gray-500 dark:text-gray-600 font-mono text-xs"
>
```

**Step 6: Add action buttons to mobile TransactionCard**

Update the `TransactionCard` component (line 67) to accept `isAdmin`, `onEdit`, and `onDelete` props. Wrap the existing card content in a flex container and add action buttons:

Change the TransactionCard function signature:

```jsx
function TransactionCard({ tx, isAdmin, onEdit, onDelete }) {
```

Add action buttons after the amount div, inside the outer flex:

```jsx
{isAdmin && (
  <div className="flex items-center gap-1 shrink-0 ml-2">
    <button
      onClick={() => onEdit?.(tx)}
      title="Edit"
      className="p-1 rounded text-gray-400 hover:text-amber-400 transition-colors cursor-pointer"
    >
      <Pencil size={14} />
    </button>
    <button
      onClick={() => onDelete?.(tx)}
      title="Delete"
      className="p-1 rounded text-gray-400 hover:text-rose-500 transition-colors cursor-pointer"
    >
      <Trash2 size={14} />
    </button>
  </div>
)}
```

**Step 7: Pass props through to TransactionCard in the mobile section**

Update the mobile card rendering (line 173) to pass the new props:

```jsx
<TransactionCard key={tx.id} tx={tx} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} />
```

**Step 8: Verify the app still renders**

Run: `cd property-equity-dashboard && npm run dev`

Open browser, confirm the table renders. Icons won't do anything yet but should appear in admin mode.

**Step 9: Commit**

```bash
git add property-equity-dashboard/src/components/TransactionTable.jsx
git commit -m "feat: add edit/delete action icons to transaction table"
```

---

### Task 2: Create EditTransactionModal Component

**Files:**
- Create: `property-equity-dashboard/src/components/EditTransactionModal.jsx`

**Step 1: Create the EditTransactionModal component**

Create `property-equity-dashboard/src/components/EditTransactionModal.jsx` with this content:

```jsx
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
```

**Step 2: Commit**

```bash
git add property-equity-dashboard/src/components/EditTransactionModal.jsx
git commit -m "feat: add EditTransactionModal component"
```

---

### Task 3: Wire Up Edit/Delete in Dashboard

**Files:**
- Modify: `property-equity-dashboard/src/components/Dashboard.jsx`

**Step 1: Add imports**

Add to the existing imports at the top of Dashboard.jsx:

```jsx
import EditTransactionModal from './EditTransactionModal';
```

No new lucide imports needed — the confirmation dialog uses plain text buttons.

**Step 2: Add state for editing and deleting**

After the `showUpdateValues` state (line 21), add:

```jsx
const [editingTransaction, setEditingTransaction] = useState(null);
const [deletingTransaction, setDeletingTransaction] = useState(null);
const [deleting, setDeleting] = useState(false);
```

**Step 3: Add delete handler function**

After the `refreshProperty` function (line 93), add:

```jsx
// Delete a transaction after confirmation
const handleDeleteConfirm = useCallback(async () => {
  if (!deletingTransaction) return;
  setDeleting(true);
  await supabase
    .from('transactions')
    .delete()
    .eq('id', deletingTransaction.id);
  await refreshTransactions();
  setDeletingTransaction(null);
  setDeleting(false);
}, [deletingTransaction, refreshTransactions]);
```

Also add `useCallback` to the imports if not already present (it already is on line 1).

**Step 4: Pass onEdit and onDelete to TransactionTable**

Update the `<TransactionTable>` JSX (around line 258) from:

```jsx
<TransactionTable
  transactions={transactions}
  isAdmin={isAdmin}
  onTransactionAdded={refreshTransactions}
/>
```

to:

```jsx
<TransactionTable
  transactions={transactions}
  isAdmin={isAdmin}
  onTransactionAdded={refreshTransactions}
  onEdit={setEditingTransaction}
  onDelete={setDeletingTransaction}
/>
```

**Step 5: Render EditTransactionModal**

After the `UpdateValuesModal` block (after line 296), add:

```jsx
{/* Edit Transaction Modal */}
{editingTransaction && (
  <EditTransactionModal
    transaction={editingTransaction}
    onClose={() => setEditingTransaction(null)}
    onSaved={refreshTransactions}
  />
)}
```

**Step 6: Render Delete Confirmation Dialog**

After the EditTransactionModal block, add:

```jsx
{/* Delete Confirmation Dialog */}
{deletingTransaction && (
  <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
    <div
      className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      onClick={() => setDeletingTransaction(null)}
    />
    <div className="relative w-full max-w-sm rounded-xl border bg-white dark:bg-gray-900 border-cream-100 dark:border-gray-800 shadow-2xl">
      <div className="px-5 py-5">
        <h2 className="font-display text-lg font-semibold mb-2">Delete Transaction?</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {deletingTransaction.category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          {' \u2014 '}
          {Number(deletingTransaction.amount) < 0 ? '-' : '+'}
          ${Math.abs(Number(deletingTransaction.amount)).toFixed(2)}
          {' on '}
          {deletingTransaction.date}
        </p>
      </div>
      <div className="flex justify-end gap-2 px-5 py-4 border-t border-cream-100 dark:border-gray-800">
        <button
          onClick={() => setDeletingTransaction(null)}
          className="px-4 py-2 rounded-md text-sm font-body text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={handleDeleteConfirm}
          disabled={deleting}
          className="px-4 py-2 rounded-md bg-rose-500 text-white text-sm font-semibold
            hover:bg-rose-600 transition-colors disabled:opacity-50 cursor-pointer
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1"
        >
          {deleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  </div>
)}
```

**Step 7: Verify everything works end-to-end**

Run: `cd property-equity-dashboard && npm run dev`

Test in browser:
1. Enable admin mode
2. Click pencil on a transaction — modal should open pre-filled
3. Change a field, click Save — transaction should update in the table
4. Click trash on a transaction — confirmation dialog should appear
5. Click Delete — transaction should be removed from the table
6. Click Cancel on both modals — should dismiss without changes

**Step 8: Commit**

```bash
git add property-equity-dashboard/src/components/Dashboard.jsx
git commit -m "feat: wire up edit and delete transactions in Dashboard"
```

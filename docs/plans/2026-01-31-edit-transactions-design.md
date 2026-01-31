# Edit Transactions Design

## Overview

Add the ability to edit and delete existing transactions. Andy has entered some incorrect transactions and needs to fix amounts, categories, dates, and notes — or remove entries entirely. Changes are admin-only, accessed via action icons in the transaction table.

## UI Entry Points

**Action column in TransactionTable** (admin-only):

- A new "Actions" column on the right side of the desktop table, visible only when `isAdmin` is true
- Each row gets two icon buttons: pencil (edit) and trash (delete), using `lucide-react` (`Pencil`, `Trash2`)
- On mobile card view, the same icons appear in the top-right corner of each card

## Edit Flow

1. Click pencil icon on a transaction row
2. `EditTransactionModal` opens, pre-filled with that transaction's data
3. Modal form has the same fields as AddTransaction: date, type toggle (expense/income), category dropdown, amount, note
4. Save calls `supabase.from('transactions').update(...)` matching on `id`
5. On success, modal closes and transaction list refreshes

### Pre-fill logic

- **Date** — from `transaction.date`
- **Type toggle** — "Income" if `amount > 0`, "Expense" if `amount < 0`
- **Category** — from `transaction.category`
- **Amount** — absolute value (positive number), sign derived from type toggle on save
- **Note** — from `transaction.note` (may be empty)

### Save logic

Same sign conversion as AddTransaction:

```
finalAmount = type === 'expense'
  ? -Math.abs(amount)
  : Math.abs(amount)
```

Then: `supabase.from('transactions').update({ date, category, amount: finalAmount, note }).eq('id', transaction.id)`

### Validation

Same as AddTransaction: amount must be a non-zero number.

## Delete Flow

1. Click trash icon on a transaction row
2. Confirmation dialog appears: "Delete this transaction?" with transaction summary (category, amount, date)
3. Cancel dismisses the dialog
4. Confirm calls `supabase.from('transactions').delete().eq('id', id)`
5. On success, dialog closes and transaction list refreshes

The confirmation dialog is a simple overlay (dark backdrop + centered card with Cancel/Delete buttons), rendered conditionally in Dashboard. No reusable dialog abstraction needed.

## Component Architecture

### New component

- **`EditTransactionModal.jsx`** — Modal dialog for editing a transaction. Receives the transaction object as a prop, pre-fills all fields, handles update via Supabase. Visual pattern matches `UpdateValuesModal.jsx` (dark overlay backdrop, centered white card, header, form fields, Cancel/Save footer).

### Modified components

- **`TransactionTable.jsx`** — Adds Actions column (desktop) and action icons (mobile cards). Receives `isAdmin`, `onEdit`, and `onDelete` callback props.
- **`Dashboard.jsx`** — Manages edit/delete state: `editingTransaction` and `deletingTransaction`. Passes callbacks to TransactionTable. Handles Supabase calls and refreshes transaction list on success.

### Data flow

```
TransactionTable -> onEdit(transaction) -> Dashboard sets editingTransaction
  -> EditTransactionModal opens with transaction data
  -> Save -> Supabase update -> refreshTransactions() -> modal closes

TransactionTable -> onDelete(transaction) -> Dashboard sets deletingTransaction
  -> Confirm dialog renders with transaction summary
  -> Confirm -> Supabase delete -> refreshTransactions() -> dialog closes
```

## Database Changes

None. RLS policies already allow UPDATE and DELETE for anonymous users on the transactions table.

## Out of Scope (YAGNI)

- No soft delete / undo
- No bulk edit or bulk delete
- No edit history or audit log
- No transaction search or filtering
- No drag-to-reorder

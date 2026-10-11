import React, { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { Transaction, Account, Person, CurrencyConfig, AllowedTransactionType } from '../../types';
import { parseCurrencyInput, formatMinorUnitsForInput } from '../../utils/currency';
import { updateTransaction } from '../../services/accounting';
import { db } from '../../db';

interface EditTransactionModalProps {
  transaction: Transaction;
  accounts: Account[];
  people: Person[];
  currency: CurrencyConfig;
  onClose: () => void;
  onSaved: () => void;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  transaction,
  accounts,
  people,
  currency,
  onClose,
  onSaved
}) => {
  // Map transaction type to strictly one of the 4 allowed types
  const initialType: AllowedTransactionType = (
    ['expense', 'income', 'lend', 'borrow'] as AllowedTransactionType[]
  ).includes(transaction.type as AllowedTransactionType)
    ? (transaction.type as AllowedTransactionType)
    : 'expense';

  const [type, setType] = useState<AllowedTransactionType>(initialType);
  const [amountStr, setAmountStr] = useState(() => formatMinorUnitsForInput(transaction.amount, currency.decimalPlaces));
  const [description, setDescription] = useState(transaction.description || transaction.reason || '');
  const [accountId, setAccountId] = useState(transaction.accountId);
  
  // Person handling: can match existing or type new
  const existingPerson = people.find(p => p.id === transaction.personId);
  const [personName, setPersonName] = useState(existingPerson?.name || '');
  const [notes, setNotes] = useState(transaction.notes || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeAccounts = accounts.filter(a => !a.isArchived && a.type !== 'credit');

  // Keyboard Escape listener to dismiss modal without saving
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);
    const amountInPaise = parseCurrencyInput(amountStr, currency.decimalPlaces);

    if (amountInPaise <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    let targetPersonId: string | undefined = undefined;
    if (type === 'lend' || type === 'borrow') {
      const cleanName = personName.trim();
      if (!cleanName) {
        setError('Please enter or select a person name.');
        return;
      }

      const matched = people.find(p => p.name.trim().toLowerCase() === cleanName.toLowerCase());
      if (matched) {
        targetPersonId = matched.id;
      } else {
        const newPersonId = 'person_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const now = new Date().toISOString();
        await db.people.add({
          id: newPersonId,
          name: cleanName,
          totalBorrowed: 0,
          totalLent: 0,
          currentOwedToThem: 0,
          currentOwedToMe: 0,
          createdAt: now,
          updatedAt: now
        });
        targetPersonId = newPersonId;
      }
    }

    setIsSubmitting(true);
    try {
      await updateTransaction({
        ...transaction,
        type,
        amount: amountInPaise,
        description: description.trim(),
        reason: description.trim() || type,
        accountId,
        personId: targetPersonId,
        notes: notes.trim() || undefined,
        // Preserve original createdAt and date timestamp
        createdAt: transaction.createdAt,
        date: transaction.date
      });

      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update transaction';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAccountLabel = (acc: Account) => {
    return `${acc.name} (${acc.type === 'cash' ? 'Cash' : 'Bank'})`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-surface border border-border rounded-xl shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-text-muted hover:text-text-main flex items-center gap-1 mr-2 px-1.5 py-1 rounded hover:bg-surface-hover"
              title="Return to previous list"
            >
              <span>← Back</span>
            </button>
            <h3 className="text-sm font-semibold text-text-main">Edit Journal Entry</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover"
            title="Close without saving"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs font-medium text-rose-600 bg-rose-50 dark:bg-rose-950/30 rounded-lg border border-rose-200 dark:border-rose-900/40">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-main mb-1">Transaction Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as AllowedTransactionType)}
                className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-text-main text-xs focus:outline-none focus:border-accent capitalize"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="lend">Lend</option>
                <option value="borrow">Borrow</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-main mb-1">
                Amount ({currency.symbol})
              </label>
              <input
                type="text"
                value={amountStr}
                onChange={e => setAmountStr(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-text-main text-xs font-semibold focus:outline-none focus:border-accent font-mono"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-text-main mb-1">
              Description <span className="text-text-muted font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What was this for?"
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-text-main text-xs focus:outline-none focus:border-accent"
            />
          </div>

          {/* Account Selection */}
          <div>
            <label className="block text-xs font-medium text-text-main mb-1">
              {type === 'lend' ? 'From Account' : type === 'borrow' ? 'To Account' : 'Account'}
            </label>
            <select
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-text-main text-xs focus:outline-none focus:border-accent"
            >
              {activeAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {getAccountLabel(acc)}
                </option>
              ))}
            </select>
          </div>

          {/* Person for Lend / Borrow */}
          {(type === 'lend' || type === 'borrow') && (
            <div>
              <label className="block text-xs font-medium text-text-main mb-1">
                {type === 'lend' ? 'Person (Money People Need to Give Me)' : 'Person (Money I Need to Give)'}
              </label>
              <input
                type="text"
                list="edit-people-list"
                value={personName}
                onChange={e => setPersonName(e.target.value)}
                placeholder="Enter or select person name..."
                required
                className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-text-main text-xs focus:outline-none focus:border-accent"
              />
              <datalist id="edit-people-list">
                {people.map(p => (
                  <option key={p.id} value={p.name} />
                ))}
              </datalist>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-text-main mb-1">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Additional notes..."
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-text-main text-xs focus:outline-none focus:border-accent resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-xs text-text-muted hover:text-text-main hover:bg-surface-hover"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Update Transaction</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

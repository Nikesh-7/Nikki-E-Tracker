import React, { useState } from 'react';
import { X, Save, AlertCircle, Repeat } from 'lucide-react';
import { RecurringBill, Account, Category, CurrencyConfig } from '../../types';
import { parseCurrencyInput } from '../../utils/currency';
import { toISODateString } from '../../utils/date';
import { db } from '../../db';

interface AddBillModalProps {
  existingBill?: RecurringBill | null;
  accounts: Account[];
  categories: Category[];
  currency: CurrencyConfig;
  onClose: () => void;
  onSaved: () => void;
}

export const AddBillModal: React.FC<AddBillModalProps> = ({
  existingBill,
  accounts,
  categories,
  currency,
  onClose,
  onSaved
}) => {
  const [name, setName] = useState(existingBill?.name || '');
  const [amountStr, setAmountStr] = useState(
    existingBill ? (existingBill.amount / 100).toFixed(2) : '15.00'
  );
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>(
    existingBill?.frequency || 'monthly'
  );
  const [nextDueDate, setNextDueDate] = useState(
    existingBill?.nextDueDate || toISODateString(new Date())
  );
  const [accountId, setAccountId] = useState(
    existingBill?.accountId || accounts[0]?.id || ''
  );
  const [categoryId, setCategoryId] = useState(
    existingBill?.categoryId || categories.find(c => c.name.includes('Subscription'))?.id || categories[0]?.id || ''
  );
  const [notes, setNotes] = useState(existingBill?.notes || '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!name.trim()) {
      setError('Bill name is required.');
      return;
    }

    const amountInCents = parseCurrencyInput(amountStr, currency.decimalPlaces);
    if (amountInCents <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    setIsSubmitting(true);
    const now = new Date().toISOString();

    try {
      if (existingBill) {
        await db.recurringBills.update(existingBill.id, {
          name: name.trim(),
          amount: amountInCents,
          frequency,
          nextDueDate,
          accountId,
          categoryId,
          notes: notes.trim() || undefined,
          updatedAt: now
        });
      } else {
        await db.recurringBills.add({
          id: 'bill_' + Date.now(),
          name: name.trim(),
          amount: amountInCents,
          frequency,
          nextDueDate,
          accountId,
          categoryId,
          notes: notes.trim() || undefined,
          isActive: true,
          createdAt: now,
          updatedAt: now
        });
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving bill';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-surface border border-border rounded-xl shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Repeat className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-text-main">
              {existingBill ? 'Edit Recurring Bill' : 'New Recurring Bill'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs font-medium text-rose-600 bg-rose-50 dark:bg-rose-950/30 rounded-lg border border-rose-200 dark:border-rose-900/40">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-text-main mb-1">
              Subscription or Bill Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Netflix, Gym, Internet, Rent"
              required
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-main focus:outline-none focus:border-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-main mb-1">
                Amount ({currency.symbol})
              </label>
              <input
                type="text"
                value={amountStr}
                onChange={e => setAmountStr(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-main focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-main mb-1">Frequency</label>
              <select
                value={frequency}
                onChange={e => setFrequency(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-main focus:outline-none focus:border-accent"
              >
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="yearly">Yearly</option>
                <option value="daily">Daily</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-main mb-1">Next Due Date</label>
            <input
              type="date"
              value={nextDueDate}
              onChange={e => setNextDueDate(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-main focus:outline-none focus:border-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-main mb-1">Linked Account</label>
              <select
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-main focus:outline-none focus:border-accent"
              >
                {accounts.filter(a => !a.isArchived).map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-main mb-1">Category</label>
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-main focus:outline-none focus:border-accent"
              >
                {categories.filter(c => c.type === 'expense').map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-main mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Account ID, cancellation link, or notes..."
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-main focus:outline-none focus:border-accent resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-xs text-text-muted hover:text-text-main"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{existingBill ? 'Save Bill' : 'Create Bill'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

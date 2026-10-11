import React, { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { Person, Account, CurrencyConfig } from '../../types';
import { parseCurrencyInput, formatMinorUnitsForInput } from '../../utils/currency';
import { toISODateTimeString } from '../../utils/date';
import { createTransaction } from '../../services/accounting';

interface RecordDebtPaymentModalProps {
  person: Person;
  mode: 'repay_them' | 'receive_from_them';
  accounts: Account[];
  currency: CurrencyConfig;
  onClose: () => void;
  onSaved: () => void;
}

export const RecordDebtPaymentModal: React.FC<RecordDebtPaymentModalProps> = ({
  person,
  mode,
  accounts,
  currency,
  onClose,
  onSaved
}) => {
  const maxAmount = mode === 'repay_them' ? person.currentOwedToThem : person.currentOwedToMe;
  const [amountStr, setAmountStr] = useState(() => formatMinorUnitsForInput(maxAmount, currency.decimalPlaces));
  
  // Only cash and bank accounts
  const activeAccounts = accounts.filter(a => !a.isArchived && (a.type === 'cash' || a.type === 'bank'));
  const [accountId, setAccountId] = useState(activeAccounts[0]?.id || '');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);

    const amountInPaise = parseCurrencyInput(amountStr, currency.decimalPlaces);
    if (amountInPaise <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    if (!accountId) {
      setError('Please select an account.');
      return;
    }

    setIsSubmitting(true);
    try {
      const type = mode === 'repay_them' ? 'debt_repayment' : 'repayment_received';
      const description = mode === 'repay_them'
        ? `Paid Money I Need to Give to ${person.name}`
        : `Received Money People Need to Give Me from ${person.name}`;

      await createTransaction({
        date: toISODateTimeString(new Date()),
        type,
        amount: amountInPaise,
        description: notes.trim() ? `${description}: ${notes.trim()}` : description,
        accountId,
        personId: person.id,
        notes: notes.trim() || undefined
      });

      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error recording settlement';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = mode === 'repay_them' 
    ? `Settle: Money I Need to Give to ${person.name}` 
    : `Receive: Money People Need to Give Me from ${person.name}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-surface border border-border rounded-xl shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-text-main truncate pr-2">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover shrink-0"
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
            <div className="flex justify-between items-baseline mb-1">
              <label className="text-xs font-medium text-text-main">
                Settlement Amount ({currency.symbol})
              </label>
              <button
                type="button"
                onClick={() => setAmountStr(formatMinorUnitsForInput(maxAmount, currency.decimalPlaces))}
                className="text-[11px] text-accent font-medium hover:underline"
              >
                Full: {currency.symbol}{(maxAmount / 100).toFixed(2)}
              </button>
            </div>
            <input
              type="text"
              value={amountStr}
              onChange={e => setAmountStr(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-main font-mono font-semibold focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-main mb-1">
              {mode === 'repay_them' ? 'Pay From Account' : 'Deposit Into Account'}
            </label>
            <select
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-main focus:outline-none focus:border-accent"
            >
              {activeAccounts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.type === 'cash' ? 'Physical Cash' : 'Bank Account'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-main mb-1">Optional Note</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Partial cash payment, UPI reference"
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-main focus:outline-none focus:border-accent"
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
              className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors flex items-center gap-1.5 shadow-subtle"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Record Settlement</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { Account, AccountType, CurrencyConfig } from '../../types';
import { parseCurrencyInput } from '../../utils/currency';
import { db } from '../../db';

interface AddAccountModalProps {
  existingAccount?: Account | null;
  currency: CurrencyConfig;
  allAccounts: Account[];
  onClose: () => void;
  onSaved: () => void;
}

export const AddAccountModal: React.FC<AddAccountModalProps> = ({
  existingAccount,
  currency,
  onClose,
  onSaved
}) => {
  const [name, setName] = useState(existingAccount?.name || '');
  const [type, setType] = useState<AccountType>(
    existingAccount?.type === 'cash' ? 'cash' : 'bank'
  );
  const [openingBalanceStr, setOpeningBalanceStr] = useState(
    existingAccount ? (existingAccount.openingBalance / 100).toFixed(2) : '0.00'
  );
  const [notes, setNotes] = useState(existingAccount?.notes || '');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);

    if (!name.trim()) {
      setError('Account name is required.');
      return;
    }

    const openingBalance = parseCurrencyInput(openingBalanceStr, currency.decimalPlaces);
    const now = new Date().toISOString();

    setIsSubmitting(true);
    try {
      if (existingAccount) {
        // Update existing account
        await db.accounts.update(existingAccount.id, {
          name: name.trim(),
          type,
          notes: notes.trim() || undefined,
          updatedAt: now
        });
      } else {
        // Create new account
        const newAccId = 'acc_' + Date.now();
        await db.accounts.add({
          id: newAccId,
          name: name.trim(),
          type,
          openingBalance,
          currentBalance: openingBalance,
          currency: currency.code,
          notes: notes.trim() || undefined,
          isArchived: false,
          createdAt: now,
          updatedAt: now
        });
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving account';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-surface border border-border rounded-xl shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-text-muted hover:text-text-main flex items-center gap-1 mr-2 px-1.5 py-1 rounded hover:bg-surface-hover"
              title="Return to Accounts (Esc)"
            >
              <span>← Back</span>
            </button>
            <h3 className="text-sm font-semibold text-text-main">
              {existingAccount ? 'Edit Account' : 'Add New Account'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover"
            title="Close without saving"
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
              Account Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Primary Bank Account, Physical Cash"
              required
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-main focus:outline-none focus:border-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-main mb-1">Account Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as AccountType)}
                className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-main focus:outline-none focus:border-accent"
              >
                <option value="bank">Bank Account</option>
                <option value="cash">Physical Cash</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-main mb-1">
                Opening Balance ({currency.symbol})
              </label>
              <input
                type="text"
                value={openingBalanceStr}
                onChange={e => setOpeningBalanceStr(e.target.value)}
                disabled={!!existingAccount}
                className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-main focus:outline-none focus:border-accent disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-main mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes or account details..."
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
              <span>{existingAccount ? 'Save Changes' : 'Create Account'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

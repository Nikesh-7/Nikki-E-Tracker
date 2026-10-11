import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, UserPlus, ArrowLeft } from 'lucide-react';
import { Person, CurrencyConfig } from '../../types';
import { parseCurrencyInput } from '../../utils/currency';
import { db } from '../../db';

interface AddPersonModalProps {
  existingPerson?: Person | null;
  currency: CurrencyConfig;
  onClose: () => void;
  onSaved: () => void;
}

export const AddPersonModal: React.FC<AddPersonModalProps> = ({
  existingPerson,
  currency,
  onClose,
  onSaved
}) => {
  const [name, setName] = useState(existingPerson?.name || '');
  
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  
  // Choose whether this represents:
  // - "Money People Need to Give Me" (Receivable: currentOwedToMe)
  // - "Money I Need to Give" (Liability: currentOwedToThem)
  const initialType = (existingPerson && existingPerson.currentOwedToThem > 0)
    ? 'i_need_to_give'
    : 'they_need_to_give';
  const [debtType, setDebtType] = useState<'they_need_to_give' | 'i_need_to_give'>(initialType);

  const initialAmount = existingPerson
    ? (debtType === 'they_need_to_give' ? existingPerson.currentOwedToMe : existingPerson.currentOwedToThem)
    : 0;
  const [amountStr, setAmountStr] = useState(initialAmount > 0 ? (initialAmount / 100).toFixed(2) : '');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!name.trim()) {
      setError('Name is required.');
      return;
    }

    const amountInPaise = parseCurrencyInput(amountStr, currency.decimalPlaces);
    if (amountInPaise <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }

    setIsSubmitting(true);
    const now = new Date().toISOString();

    try {
      const currentOwedToMe = debtType === 'they_need_to_give' ? amountInPaise : 0;
      const currentOwedToThem = debtType === 'i_need_to_give' ? amountInPaise : 0;

      if (existingPerson) {
        await db.people.update(existingPerson.id, {
          name: name.trim(),
          currentOwedToMe,
          currentOwedToThem,
          totalLent: debtType === 'they_need_to_give' ? amountInPaise : existingPerson.totalLent,
          totalBorrowed: debtType === 'i_need_to_give' ? amountInPaise : existingPerson.totalBorrowed,
          updatedAt: now
        });
      } else {
        await db.people.add({
          id: 'person_' + Date.now(),
          name: name.trim(),
          currentOwedToMe,
          currentOwedToThem,
          totalLent: currentOwedToMe,
          totalBorrowed: currentOwedToThem,
          createdAt: now,
          updatedAt: now
        });
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving entry';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-surface border border-border rounded-xl shadow-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1 -ml-1 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover"
              title="Go Back"
              aria-label="Go Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <UserPlus className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-text-main">
              {existingPerson ? 'Edit People & Debts Entry' : 'New People & Debts Entry'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Minimal Form: Exactly 2 data entry fields (Name & Amount) + Type Selection */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs font-medium text-rose-600 bg-rose-50 dark:bg-rose-950/30 rounded-lg border border-rose-200 dark:border-rose-900/40">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Type Selection */}
          <div>
            <label className="block text-xs font-medium text-text-main mb-1.5">
              Category
            </label>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setDebtType('they_need_to_give')}
                className={`py-2.5 px-3 rounded-lg text-xs font-medium border text-left flex items-center justify-between transition-colors ${
                  debtType === 'they_need_to_give'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-semibold'
                    : 'border-border bg-surface text-text-muted hover:text-text-main'
                }`}
              >
                <span>Money People Need to Give Me</span>
                <span className="text-[10px] uppercase font-mono tracking-wider opacity-80">(Receivable)</span>
              </button>

              <button
                type="button"
                onClick={() => setDebtType('i_need_to_give')}
                className={`py-2.5 px-3 rounded-lg text-xs font-medium border text-left flex items-center justify-between transition-colors ${
                  debtType === 'i_need_to_give'
                    ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 font-semibold'
                    : 'border-border bg-surface text-text-muted hover:text-text-main'
                }`}
              >
                <span>Money I Need to Give</span>
                <span className="text-[10px] uppercase font-mono tracking-wider opacity-80">(Liability)</span>
              </button>
            </div>
          </div>

          {/* 1. Name Field */}
          <div>
            <label className="block text-xs font-medium text-text-main mb-1">
              Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Ramesh, Priya, Sharmaji"
              required
              autoFocus
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-main focus:outline-none focus:border-accent"
            />
          </div>

          {/* 2. Amount Field */}
          <div>
            <label className="block text-xs font-medium text-text-main mb-1">
              Amount ({currency.symbol}) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted font-medium text-sm">
                {currency.symbol}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={amountStr}
                onChange={e => setAmountStr(e.target.value)}
                placeholder="0.00"
                required
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-main font-mono font-semibold focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Save & Cancel Controls */}
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
              <span>{existingPerson ? 'Save Changes' : 'Save Entry'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

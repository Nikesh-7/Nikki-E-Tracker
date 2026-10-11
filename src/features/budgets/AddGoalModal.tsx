import React, { useState } from 'react';
import { X, Save, AlertCircle, Target } from 'lucide-react';
import { SavingsGoal, CurrencyConfig } from '../../types';
import { parseCurrencyInput } from '../../utils/currency';
import { db } from '../../db';

interface AddGoalModalProps {
  existingGoal?: SavingsGoal | null;
  currency: CurrencyConfig;
  onClose: () => void;
  onSaved: () => void;
}

export const AddGoalModal: React.FC<AddGoalModalProps> = ({
  existingGoal,
  currency,
  onClose,
  onSaved
}) => {
  const [name, setName] = useState(existingGoal?.name || '');
  const [targetAmountStr, setTargetAmountStr] = useState(
    existingGoal ? (existingGoal.targetAmount / 100).toFixed(2) : '1000.00'
  );
  const [currentAmountStr, setCurrentAmountStr] = useState(
    existingGoal ? (existingGoal.currentAmount / 100).toFixed(2) : '0.00'
  );
  const [targetDate, setTargetDate] = useState(existingGoal?.targetDate || '');
  const [notes, setNotes] = useState(existingGoal?.notes || '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!name.trim()) {
      setError('Goal name is required.');
      return;
    }

    const targetAmount = parseCurrencyInput(targetAmountStr, currency.decimalPlaces);
    const currentAmount = parseCurrencyInput(currentAmountStr, currency.decimalPlaces);

    if (targetAmount <= 0) {
      setError('Target amount must be greater than zero.');
      return;
    }

    setIsSubmitting(true);
    const now = new Date().toISOString();

    try {
      if (existingGoal) {
        await db.savingsGoals.update(existingGoal.id, {
          name: name.trim(),
          targetAmount,
          currentAmount,
          targetDate: targetDate || undefined,
          notes: notes.trim() || undefined,
          updatedAt: now
        });
      } else {
        await db.savingsGoals.add({
          id: 'goal_' + Date.now(),
          name: name.trim(),
          targetAmount,
          currentAmount,
          targetDate: targetDate || undefined,
          notes: notes.trim() || undefined,
          createdAt: now,
          updatedAt: now
        });
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving goal';
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
            <Target className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-text-main">
              {existingGoal ? 'Edit Savings Goal' : 'New Savings Goal'}
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
              Goal Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Vacation Fund, New Laptop, Emergency Fund"
              required
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-main focus:outline-none focus:border-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-main mb-1">
                Target Amount ({currency.symbol})
              </label>
              <input
                type="text"
                value={targetAmountStr}
                onChange={e => setTargetAmountStr(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-main focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-main mb-1">
                Currently Saved ({currency.symbol})
              </label>
              <input
                type="text"
                value={currentAmountStr}
                onChange={e => setCurrentAmountStr(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-main focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-main mb-1">Target Date</label>
            <input
              type="date"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-main focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-main mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Motivation or notes..."
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
              <span>{existingGoal ? 'Save Goal' : 'Create Goal'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

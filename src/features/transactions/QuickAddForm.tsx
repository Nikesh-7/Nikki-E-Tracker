import React, { useState, useEffect, useMemo } from 'react';
import { 
  PlusCircle, 
  CheckCircle2, 
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import { 
  AllowedTransactionType, 
  Account, 
  Person, 
  CurrencyConfig 
} from '../../types';
import { parseCurrencyInput } from '../../utils/currency';
import { createTransaction } from '../../services/accounting';
import { db } from '../../db';

interface QuickAddFormProps {
  accounts: Account[];
  people: Person[];
  currency: CurrencyConfig;
  defaultAccountId: string;
  defaultTransactionType?: AllowedTransactionType;
  onTransactionCreated?: () => void;
  onOpenAddPerson?: () => void;
}

export const QuickAddForm: React.FC<QuickAddFormProps> = ({
  accounts,
  people,
  currency,
  defaultAccountId,
  defaultTransactionType,
  onTransactionCreated,
  onOpenAddPerson
}) => {
  // Exactly 4 allowed transaction types
  const [type, setType] = useState<AllowedTransactionType>(defaultTransactionType || 'expense');
  const [amountStr, setAmountStr] = useState('');
  const [description, setDescription] = useState('');
  
  // Accounts: physical cash and bank accounts (excluding credit cards)
  const activeAccounts = useMemo(
    () => accounts.filter(a => !a.isArchived && a.type !== 'credit'),
    [accounts]
  );
  const [accountId, setAccountId] = useState(() => defaultAccountId || activeAccounts[0]?.id || '');

  // Ensure accountId is valid if active accounts list changes
  useEffect(() => {
    if ((!accountId || !activeAccounts.some(a => a.id === accountId)) && activeAccounts.length > 0) {
      setAccountId(defaultAccountId && activeAccounts.some(a => a.id === defaultAccountId) ? defaultAccountId : activeAccounts[0].id);
    }
  }, [accountId, activeAccounts, defaultAccountId]);

  // Person for Lend and Borrow
  const [personName, setPersonName] = useState('');

  // Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    const amountInPaise = parseCurrencyInput(amountStr, currency.decimalPlaces);

    if (amountInPaise <= 0) {
      setErrorMessage('Please enter a valid positive amount.');
      return;
    }

    if (!accountId) {
      setErrorMessage('Please select an account.');
      return;
    }

    let targetPersonId: string | undefined = undefined;
    if (type === 'lend' || type === 'borrow') {
      const cleanName = personName.trim();
      if (!cleanName) {
        setErrorMessage('Please enter or select a person name.');
        return;
      }

      // Check if person exists (case-insensitive normalized matching to prevent duplicates)
      const existingPerson = people.find(
        p => p.name.trim().toLowerCase() === cleanName.toLowerCase()
      );

      if (existingPerson) {
        targetPersonId = existingPerson.id;
      } else {
        // Automatically create person in People & Debts
        const newPersonId = 'person_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
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
      // Date and time are assigned AUTOMATICALLY on save
      await createTransaction({
        type,
        amount: amountInPaise,
        description: description.trim() || undefined,
        accountId,
        personId: targetPersonId,
      });

      // Reset form
      setAmountStr('');
      setDescription('');
      setPersonName('');
      setSuccessMessage(
        `Recorded ${type} of ${currency.symbol}${(amountInPaise / 100).toFixed(2)} successfully.`
      );

      if (onTransactionCreated) {
        onTransactionCreated();
      }

      setTimeout(() => {
        setSuccessMessage(null);
      }, 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating transaction';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAccountLabel = (acc: Account) => {
    return `${acc.name} (${acc.type === 'cash' ? 'Cash' : 'Bank'})`;
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-subtle">
      <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
        <div className="flex items-center gap-2">
          <PlusCircle className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-text-main">Quick Entry</h2>
        </div>
        <span className="text-[11px] text-text-muted">Fast & instant balance update</span>
      </div>

      {successMessage && (
        <div className="flex items-center gap-2 p-3 mb-4 text-xs font-medium text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-900/40">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2 p-3 mb-4 text-xs font-medium text-rose-600 bg-rose-50 dark:bg-rose-950/30 dark:text-rose-400 rounded-lg border border-rose-200 dark:border-rose-900/40">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Exactly 4 Allowed Transaction Types */}
        <div>
          <label className="block text-[11px] font-medium text-text-muted mb-1.5 uppercase tracking-wider">
            Transaction Type
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'expense' as const, label: 'Expense', icon: TrendingDown },
              { id: 'income' as const, label: 'Income', icon: TrendingUp },
              { id: 'lend' as const, label: 'Lend', icon: ArrowDownLeft },
              { id: 'borrow' as const, label: 'Borrow', icon: ArrowUpRight },
            ].map(item => {
              const Icon = item.icon;
              const isSelected = type === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setType(item.id);
                    setErrorMessage(null);
                  }}
                  className={`py-2 px-1.5 rounded-lg text-xs font-medium transition-colors flex flex-col sm:flex-row items-center justify-center gap-1 text-center ${
                    isSelected
                      ? 'bg-accent text-white shadow-subtle font-semibold'
                      : 'bg-surface-hover text-text-muted hover:text-text-main border border-border'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Fields According to Transaction Type */}

        {/* 1. Lend or Borrow: Person Name Field */}
        {(type === 'lend' || type === 'borrow') && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-text-main">
                {type === 'lend' ? 'Person Who Needs to Give Me Money' : 'Person I Need to Give Money To'} <span className="text-rose-500">*</span>
              </label>
              {onOpenAddPerson && (
                <button
                  type="button"
                  onClick={onOpenAddPerson}
                  className="text-[11px] text-accent hover:underline font-medium"
                >
                  View Debts
                </button>
              )}
            </div>
            <input
              type="text"
              list="people-datalist"
              value={personName}
              onChange={e => setPersonName(e.target.value)}
              placeholder="Enter or select person name..."
              required
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-main focus:outline-none focus:border-accent"
            />
            <datalist id="people-datalist">
              {people.map(p => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
            <span className="text-[10px] text-text-muted mt-1 block">
              Type any new name to automatically create a record in People & Debts, or pick an existing person.
            </span>
          </div>
        )}

        {/* 2. Amount Input (Prominent & Easy) */}
        <div>
          <label className="block text-xs font-medium text-text-main mb-1">
            Amount ({currency.symbol}) <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-text-muted font-mono">
              {currency.symbol}
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={amountStr}
              onChange={e => setAmountStr(e.target.value)}
              placeholder="0.00"
              required
              className="w-full pl-8 pr-3 py-2.5 rounded-lg bg-surface border border-border text-base font-bold font-mono text-text-main focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* 3. Account Selector (Physical Cash and Bank Accounts) */}
        <div>
          <label className="block text-xs font-medium text-text-main mb-1">
            {type === 'lend' ? 'From Account' : type === 'borrow' ? 'To Account' : 'Account'} <span className="text-rose-500">*</span>
          </label>
          <select
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-main focus:outline-none focus:border-accent"
          >
            {activeAccounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                {getAccountLabel(acc)}
              </option>
            ))}
          </select>
        </div>

        {/* 4. Description (Optional) */}
        <div>
          <label className="block text-xs font-medium text-text-main mb-1">
            Description <span className="text-text-muted font-normal">(Optional)</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={
              type === 'expense'
                ? 'e.g. Groceries, fuel, restaurant'
                : type === 'income'
                  ? 'e.g. Salary, client invoice, dividend'
                  : type === 'lend'
                    ? 'e.g. For dinner, medical emergency'
                    : 'e.g. Short term loan'
            }
            className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-main focus:outline-none focus:border-accent"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2.5 px-4 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors shadow-subtle flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>
            {type === 'expense'
              ? 'Record Expense'
              : type === 'income'
                ? 'Record Income'
                : type === 'lend'
                  ? 'Record Money Lent'
                  : 'Record Money Borrowed'}
          </span>
        </button>
      </form>
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { 
  Repeat, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Edit, 
  Trash2, 
  CreditCard,
  Check
} from 'lucide-react';
import { RecurringBill, Account, Category, CurrencyConfig } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { formatDate, toISODateString } from '../../utils/date';
import { AddBillModal } from './AddBillModal';
import { createTransaction } from '../../services/accounting';
import { db } from '../../db';

interface BillsViewProps {
  recurringBills: RecurringBill[];
  accounts: Account[];
  categories: Category[];
  currency: CurrencyConfig;
  onRefreshData?: () => void;
}

export const BillsView: React.FC<BillsViewProps> = ({
  recurringBills,
  accounts,
  categories,
  currency,
  onRefreshData
}) => {
  const [editingBill, setEditingBill] = useState<RecurringBill | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a.name])), [accounts]);
  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);

  // Calculate monthly recurring total
  const monthlyRecurringTotal = useMemo(() => {
    let total = 0;
    for (const b of recurringBills) {
      if (!b.isActive) continue;
      switch (b.frequency) {
        case 'daily': total += b.amount * 30; break;
        case 'weekly': total += Math.round(b.amount * 4.33); break;
        case 'monthly': total += b.amount; break;
        case 'yearly': total += Math.round(b.amount / 12); break;
      }
    }
    return total;
  }, [recurringBills]);

  const handleMarkAsPaid = async (bill: RecurringBill) => {
    try {
      // 1. Record transaction in journal
      await createTransaction({
        date: toISODateString(new Date()) + 'T12:00:00',
        type: 'expense',
        amount: bill.amount,
        reason: `Recurring Bill: ${bill.name}`,
        description: `Automated payment record for ${bill.name} (${bill.frequency})`,
        accountId: bill.accountId,
        categoryId: bill.categoryId,
        tags: ['recurring', 'bill', bill.frequency]
      });

      // 2. Advance next due date
      const currentDue = new Date(bill.nextDueDate);
      const nextDue = new Date(currentDue);
      if (bill.frequency === 'daily') nextDue.setDate(nextDue.getDate() + 1);
      else if (bill.frequency === 'weekly') nextDue.setDate(nextDue.getDate() + 7);
      else if (bill.frequency === 'monthly') nextDue.setMonth(nextDue.getMonth() + 1);
      else if (bill.frequency === 'yearly') nextDue.setFullYear(nextDue.getFullYear() + 1);

      await db.recurringBills.update(bill.id, {
        nextDueDate: toISODateString(nextDue),
        updatedAt: new Date().toISOString()
      });

      setFeedback(`Payment recorded for ${bill.name}. Next due date advanced to ${formatDate(nextDue, 'YYYY-MM-DD')}.`);
      if (onRefreshData) onRefreshData();
      setTimeout(() => setFeedback(null), 4000);
    } catch {
      setFeedback('Error recording bill payment.');
    }
  };

  const handleDelete = async (billId: string) => {
    if (confirm('Are you sure you want to delete this recurring bill?')) {
      await db.recurringBills.delete(billId);
      if (onRefreshData) onRefreshData();
    }
  };

  const handleToggleActive = async (bill: RecurringBill) => {
    await db.recurringBills.update(bill.id, {
      isActive: !bill.isActive,
      updatedAt: new Date().toISOString()
    });
    if (onRefreshData) onRefreshData();
  };

  const todayStr = toISODateString(new Date());

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div>
          <h1 className="text-xl font-semibold text-text-main">Recurring Bills & Subscriptions</h1>
          <p className="text-xs text-text-muted">
            Track fixed expenses, scheduled payments, and service subscriptions
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors shadow-subtle"
        >
          <Plus className="w-4 h-4" />
          <span>Add Recurring Bill</span>
        </button>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 p-3 text-xs font-medium text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-900/40">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Aggregate Metric Card */}
      <div className="p-4 rounded-xl bg-surface border border-border shadow-subtle flex items-center justify-between">
        <div>
          <span className="text-xs text-text-muted font-medium">Estimated Monthly Recurring Cost</span>
          <div className="text-2xl font-bold font-mono text-text-main mt-0.5">
            {formatCurrency(monthlyRecurringTotal, currency)} / month
          </div>
          <span className="text-[11px] text-text-muted">
            {recurringBills.filter(b => b.isActive).length} active recurring subscription{recurringBills.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Bills List */}
      {recurringBills.length === 0 ? (
        <div className="p-12 rounded-xl border border-dashed border-border bg-surface text-center shadow-subtle">
          <Repeat className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-text-main mb-1">No Recurring Bills Configured</h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto mb-4">
            Add recurring commitments like rent, Netflix, gym memberships, or internet to receive reminders.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover"
          >
            Add First Bill
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {recurringBills.map(bill => {
            const isOverdue = bill.nextDueDate < todayStr;
            const isDueToday = bill.nextDueDate === todayStr;
            const accName = accountMap.get(bill.accountId) || 'Account';
            const catName = categoryMap.get(bill.categoryId) || 'Subscription';

            return (
              <div
                key={bill.id}
                className={`p-4 rounded-xl border bg-surface shadow-subtle space-y-3 flex flex-col justify-between ${
                  !bill.isActive ? 'opacity-50 border-dashed border-border' : 'border-border'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-text-main">{bill.name}</h4>
                      <span className="text-[10px] text-text-muted uppercase tracking-wider font-mono">
                        {bill.frequency} • {catName}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingBill(bill)}
                        title="Edit Bill"
                        className="p-1 rounded text-text-muted hover:text-text-main hover:bg-surface-hover"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(bill.id)}
                        title="Delete Bill"
                        className="p-1 rounded text-text-muted hover:text-rose-600 hover:bg-surface-hover"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-border flex items-baseline justify-between text-xs">
                    <span className="text-text-muted">Amount</span>
                    <div className="text-base font-bold font-mono text-rose-600 dark:text-rose-400">
                      {formatCurrency(bill.amount, currency)}
                    </div>
                  </div>

                  {/* Due Date Indicator */}
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-text-muted">Next Due:</span>
                    <span className={`font-medium font-mono ${
                      isOverdue 
                        ? 'text-rose-600 dark:text-rose-400 font-bold' 
                        : isDueToday 
                          ? 'text-amber-600 dark:text-amber-400 font-bold' 
                          : 'text-text-main'
                    }`}>
                      {formatDate(bill.nextDueDate, 'YYYY-MM-DD')}
                      {isOverdue && ' (Overdue)'}
                      {isDueToday && ' (Today)'}
                    </span>
                  </div>

                  <div className="text-[11px] text-text-muted flex items-center gap-1 mt-1">
                    <CreditCard className="w-3 h-3 text-text-muted" />
                    <span>Pay from: {accName}</span>
                  </div>

                  {bill.notes && (
                    <p className="text-[11px] text-text-muted italic line-clamp-1 mt-1">
                      {bill.notes}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-2 border-t border-border flex items-center gap-2">
                  <button
                    onClick={() => handleMarkAsPaid(bill)}
                    disabled={!bill.isActive}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold border border-emerald-200 dark:border-emerald-900/40 hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Mark as Paid</span>
                  </button>

                  <button
                    onClick={() => handleToggleActive(bill)}
                    className="py-1.5 px-2.5 rounded-lg border border-border text-xs text-text-muted hover:text-text-main transition-colors"
                  >
                    {bill.isActive ? 'Pause' : 'Resume'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Bill Modal */}
      {(showAddModal || editingBill) && (
        <AddBillModal
          existingBill={editingBill}
          accounts={accounts}
          categories={categories}
          currency={currency}
          onClose={() => {
            setShowAddModal(false);
            setEditingBill(null);
          }}
          onSaved={() => {
            setFeedback(editingBill ? 'Bill updated.' : 'Bill created.');
            if (onRefreshData) onRefreshData();
            setTimeout(() => setFeedback(null), 3000);
          }}
        />
      )}
    </div>
  );
};

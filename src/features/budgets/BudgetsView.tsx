import React, { useState, useMemo } from 'react';
import { 
  Target, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  Edit, 
  Trash2, 
  ArrowUpRight,
  Sparkles,
  PieChart
} from 'lucide-react';
import { Budget, SavingsGoal, Category, Transaction, CurrencyConfig } from '../../types';
import { formatCurrency, parseCurrencyInput } from '../../utils/currency';
import { formatDate } from '../../utils/date';
import { AddGoalModal } from './AddGoalModal';
import { db } from '../../db';

interface BudgetsViewProps {
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
  categories: Category[];
  transactions: Transaction[];
  currency: CurrencyConfig;
  onRefreshData?: () => void;
}

export const BudgetsView: React.FC<BudgetsViewProps> = ({
  budgets,
  savingsGoals,
  categories,
  transactions,
  currency,
  onRefreshData
}) => {
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [showAddGoalModal, setShowAddGoalModal] = useState(false);
  const [editingOverallBudget, setEditingOverallBudget] = useState(false);
  const [overallLimitInput, setOverallLimitInput] = useState('');
  const [contributeGoal, setContributeGoal] = useState<SavingsGoal | null>(null);
  const [contributionAmount, setContributionAmount] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const overallBudget = budgets.find(b => !b.categoryId);

  // Calculate current month's expenses overall and by category
  const { currentMonthSpent, categorySpending } = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();

    let spent = 0;
    const catMap = new Map<string, number>();

    for (const tx of transactions) {
      const d = new Date(tx.date);
      if (d.getFullYear() === curYear && d.getMonth() === curMonth) {
        if (tx.type === 'expense') {
          spent += tx.amount;
          if (tx.categoryId) {
            catMap.set(tx.categoryId, (catMap.get(tx.categoryId) || 0) + tx.amount);
          }
        } else if (tx.type === 'refund') {
          spent = Math.max(0, spent - tx.amount);
          if (tx.categoryId) {
            catMap.set(tx.categoryId, Math.max(0, (catMap.get(tx.categoryId) || 0) - tx.amount));
          }
        }
      }
    }

    return { currentMonthSpent: spent, categorySpending: catMap };
  }, [transactions]);

  const overallLimit = overallBudget?.monthlyLimit || 250000;
  const overallRemaining = Math.max(0, overallLimit - currentMonthSpent);
  const overallPercent = Math.min(100, Math.round((currentMonthSpent / overallLimit) * 100));

  const handleSaveOverallBudget = async () => {
    const newLimit = parseCurrencyInput(overallLimitInput, currency.decimalPlaces);
    if (newLimit <= 0) return;

    if (overallBudget) {
      await db.budgets.update(overallBudget.id, { monthlyLimit: newLimit });
    } else {
      await db.budgets.add({
        id: 'budget_overall',
        monthlyLimit: newLimit,
        warningThresholdPercent: 80
      });
    }

    setEditingOverallBudget(false);
    setFeedback('Overall monthly budget updated.');
    if (onRefreshData) onRefreshData();
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleUpdateCategoryBudget = async (categoryId: string, limitInput: string) => {
    const limit = parseCurrencyInput(limitInput, currency.decimalPlaces);
    await db.categories.update(categoryId, { monthlyBudget: limit });
    if (onRefreshData) onRefreshData();
  };

  const handleContributeToGoal = async () => {
    if (!contributeGoal) return;
    const addedCents = parseCurrencyInput(contributionAmount, currency.decimalPlaces);
    if (addedCents <= 0) return;

    const newAmount = contributeGoal.currentAmount + addedCents;
    await db.savingsGoals.update(contributeGoal.id, {
      currentAmount: newAmount,
      updatedAt: new Date().toISOString()
    });

    setContributeGoal(null);
    setContributionAmount('');
    setFeedback(`Added ${formatCurrency(addedCents, currency)} to ${contributeGoal.name}!`);
    if (onRefreshData) onRefreshData();
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (confirm('Are you sure you want to delete this savings goal?')) {
      await db.savingsGoals.delete(goalId);
      if (onRefreshData) onRefreshData();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div>
          <h1 className="text-xl font-semibold text-text-main">Budgets & Savings Goals</h1>
          <p className="text-xs text-text-muted">
            Monitor monthly expenditure limits and track savings milestones
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddGoalModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors shadow-subtle"
          >
            <Plus className="w-4 h-4" />
            <span>New Savings Goal</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 p-3 text-xs font-medium text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-900/40">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Section 1: Overall Monthly Budget */}
      <div className="p-5 rounded-xl bg-surface border border-border shadow-subtle space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-text-main">Overall Monthly Budget</h3>
          </div>
          <button
            onClick={() => {
              setOverallLimitInput((overallLimit / 100).toFixed(2));
              setEditingOverallBudget(!editingOverallBudget);
            }}
            className="text-xs text-accent font-medium hover:underline flex items-center gap-1"
          >
            <Edit className="w-3 h-3" />
            <span>{editingOverallBudget ? 'Cancel' : 'Edit Limit'}</span>
          </button>
        </div>

        {editingOverallBudget ? (
          <div className="flex items-center gap-2 pt-2">
            <input
              type="text"
              value={overallLimitInput}
              onChange={e => setOverallLimitInput(e.target.value)}
              placeholder="e.g. 2500.00"
              className="px-3 py-1.5 rounded-lg bg-surface border border-border text-xs text-text-main font-semibold focus:outline-none focus:border-accent"
            />
            <button
              onClick={handleSaveOverallBudget}
              className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover"
            >
              Save Limit
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex justify-between items-baseline text-xs">
              <span className="text-text-muted">
                Spent: <span className="font-mono font-semibold text-text-main">{formatCurrency(currentMonthSpent, currency)}</span> of {formatCurrency(overallLimit, currency)}
              </span>
              <span className="font-mono text-text-muted">
                Remaining: <span className={`font-semibold ${overallRemaining === 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {formatCurrency(overallRemaining, currency)}
                </span>
              </span>
            </div>

            <div className="w-full h-2.5 rounded-full bg-surface-hover overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  overallPercent >= 100 
                    ? 'bg-rose-500' 
                    : overallPercent >= 80 
                      ? 'bg-amber-500' 
                      : 'bg-accent'
                }`}
                style={{ width: `${overallPercent}%` }}
              />
            </div>

            <div className="flex justify-between items-center text-[11px] text-text-muted">
              <span>{overallPercent}% used this month</span>
              {overallPercent >= 80 && (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Warning: Approaching budget ceiling</span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Category Budgets */}
      <div>
        <h3 className="text-sm font-semibold text-text-main mb-3">Category Monthly Budgets</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {categories
            .filter(c => c.type === 'expense')
            .map(cat => {
              const spent = categorySpending.get(cat.id) || 0;
              const limit = cat.monthlyBudget || 0;
              const hasBudget = limit > 0;
              const percent = hasBudget ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
              const remaining = Math.max(0, limit - spent);

              return (
                <div
                  key={cat.id}
                  className="p-4 rounded-xl bg-surface border border-border shadow-subtle space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-main">{cat.name}</span>
                    <span className="text-[10px] font-mono font-medium text-text-muted">
                      {hasBudget ? `${percent}%` : 'No budget set'}
                    </span>
                  </div>

                  {hasBudget ? (
                    <>
                      <div className="w-full h-1.5 rounded-full bg-surface-hover overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            percent >= 100 ? 'bg-rose-500' : percent >= 80 ? 'bg-amber-500' : 'bg-accent'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-text-muted font-mono">
                        <span>Spent: {formatCurrency(spent, currency)}</span>
                        <span>Rem: {formatCurrency(remaining, currency)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-[11px] text-text-muted font-mono">
                      Spent this month: {formatCurrency(spent, currency)}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Section 3: Savings Goals */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-main flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <span>Savings Goals</span>
          </h3>
          <span className="text-xs text-text-muted">{savingsGoals.length} goal{savingsGoals.length === 1 ? '' : 's'}</span>
        </div>

        {savingsGoals.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-border bg-surface text-center">
            <Target className="w-8 h-8 text-text-muted mx-auto mb-2" />
            <p className="text-xs text-text-muted mb-3">No savings goals created yet.</p>
            <button
              onClick={() => setShowAddGoalModal(true)}
              className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover"
            >
              Create Savings Goal
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {savingsGoals.map(goal => {
              const percent = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));

              return (
                <div
                  key={goal.id}
                  className="p-4 rounded-xl bg-surface border border-border shadow-subtle space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-text-main">{goal.name}</h4>
                      {goal.targetDate && (
                        <span className="text-[10px] text-text-muted">
                          Target: {formatDate(goal.targetDate, 'YYYY-MM-DD')}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingGoal(goal)}
                        title="Edit Goal"
                        className="p-1 rounded text-text-muted hover:text-text-main hover:bg-surface-hover"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteGoal(goal.id)}
                        title="Delete Goal"
                        className="p-1 rounded text-text-muted hover:text-rose-600 hover:bg-surface-hover"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-baseline text-xs font-mono">
                      <span className="font-bold text-accent">
                        {formatCurrency(goal.currentAmount, currency)}
                      </span>
                      <span className="text-text-muted text-[11px]">
                        of {formatCurrency(goal.targetAmount, currency)} ({percent}%)
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-surface-hover overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {goal.notes && (
                    <p className="text-[11px] text-text-muted italic line-clamp-1">{goal.notes}</p>
                  )}

                  {/* Quick Action: Contribute to Goal */}
                  <button
                    onClick={() => {
                      setContributeGoal(goal);
                      setContributionAmount('');
                    }}
                    className="w-full py-1.5 rounded-lg border border-border text-xs text-accent font-medium hover:bg-accent-subtle transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Contribute to Goal</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Contribute Modal */}
      {contributeGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-xs bg-surface border border-border rounded-xl shadow-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-text-main">
              Contribute to {contributeGoal.name}
            </h3>
            <div>
              <label className="block text-xs font-medium text-text-main mb-1">
                Amount ({currency.symbol})
              </label>
              <input
                type="text"
                value={contributionAmount}
                onChange={e => setContributionAmount(e.target.value)}
                placeholder="50.00"
                autoFocus
                className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-main font-semibold focus:outline-none focus:border-accent"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setContributeGoal(null)}
                className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-muted hover:text-text-main"
              >
                Cancel
              </button>
              <button
                onClick={handleContributeToGoal}
                className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Goal Modal */}
      {(showAddGoalModal || editingGoal) && (
        <AddGoalModal
          existingGoal={editingGoal}
          currency={currency}
          onClose={() => {
            setShowAddGoalModal(false);
            setEditingGoal(null);
          }}
          onSaved={() => {
            setFeedback(editingGoal ? 'Goal updated.' : 'Goal created.');
            if (onRefreshData) onRefreshData();
            setTimeout(() => setFeedback(null), 3000);
          }}
        />
      )}
    </div>
  );
};

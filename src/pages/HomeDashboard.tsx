import React, { useState, useMemo } from 'react';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Receipt, 
  ArrowRight,
  Landmark,
  Coins,
  ChevronRight,
  Users,
  Eye,
  TrendingDown,
  TrendingUp,
  ArrowRightLeft,
  Square,
  CheckSquare,
  History
} from 'lucide-react';
import { 
  Account, 
  Transaction, 
  Person, 
  CurrencyConfig 
} from '../types';
import { formatCurrency } from '../utils/currency';
import { formatDate } from '../utils/date';
import { calculateFinancialSummary, deleteTransaction, toggleTransactionSettlement } from '../services/accounting';
import { QuickAddForm } from '../features/transactions/QuickAddForm';
import { TransactionDetailsModal } from '../features/transactions/TransactionDetailsModal';
import { EditTransactionModal } from '../features/transactions/EditTransactionModal';
import { ActiveTab } from '../components/Navigation';

interface HomeDashboardProps {
  accounts: Account[];
  transactions: Transaction[];
  people: Person[];
  currency: CurrencyConfig;
  defaultAccountId: string;
  defaultTransactionType: any;
  setActiveTab: (tab: ActiveTab) => void;
  onRefreshData?: () => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  accounts,
  transactions,
  people,
  currency,
  defaultAccountId,
  defaultTransactionType,
  setActiveTab,
  onRefreshData
}) => {
  const [period, setPeriod] = useState<'this_month' | 'last_month' | 'year' | 'all'>('this_month');
  const [selectedTxForDetails, setSelectedTxForDetails] = useState<Transaction | null>(null);
  const [selectedTxForEdit, setSelectedTxForEdit] = useState<Transaction | null>(null);

  // Filter transactions for period summary
  const periodTransactions = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();

    return transactions.filter(tx => {
      const d = new Date(tx.date);
      if (period === 'this_month') return d.getFullYear() === curYear && d.getMonth() === curMonth;
      if (period === 'last_month') {
        const lastMonth = new Date(curYear, curMonth - 1, 1);
        return d.getFullYear() === lastMonth.getFullYear() && d.getMonth() === lastMonth.getMonth();
      }
      if (period === 'year') return d.getFullYear() === curYear;
      return true;
    });
  }, [transactions, period]);

  const summary = useMemo(() => {
    return calculateFinancialSummary(periodTransactions);
  }, [periodTransactions]);

  // Account balances breakdown
  const activeAccounts = accounts.filter(a => !a.isArchived);
  const cashAccounts = activeAccounts.filter(a => a.type === 'cash');
  const bankAccounts = activeAccounts.filter(a => a.type === 'bank' || a.type !== 'cash');

  const totalCash = cashAccounts.reduce((sum, a) => sum + a.currentBalance, 0);
  const totalBank = bankAccounts.reduce((sum, a) => sum + a.currentBalance, 0);

  // Debts breakdown using exact requirement labels
  const peopleWhoOweMe = useMemo(() => {
    return people.filter(p => p.currentOwedToMe > 0);
  }, [people]);

  const peopleIOwe = useMemo(() => {
    return people.filter(p => p.currentOwedToThem > 0);
  }, [people]);

  const totalMoneyPeopleNeedToGiveMe = people.reduce((sum, p) => sum + p.currentOwedToMe, 0);
  const totalMoneyINeedToGive = people.reduce((sum, p) => sum + p.currentOwedToThem, 0);

  // Recent transactions: Strictly only the 4 allowed types, sorted newest first (4 newest by default)
  const allowedFourTypes = new Set(['expense', 'income', 'lend', 'borrow']);
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .filter(tx => allowedFourTypes.has(tx.type))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 4);
  }, [transactions]);

  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a.name])), [accounts]);
  const personMap = useMemo(() => new Map(people.map(p => [p.id, p.name])), [people]);

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'income':
        return 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40';
      case 'expense':
        return 'text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-900/40';
      case 'transfer':
        return 'text-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/40';
      case 'lend':
        return 'text-blue-700 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-900/40';
      case 'borrow':
        return 'text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-900/40';
      default:
        return 'text-text-muted bg-surface-hover border-border';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'income': return <TrendingUp className="w-3.5 h-3.5" />;
      case 'expense': return <TrendingDown className="w-3.5 h-3.5" />;
      case 'transfer': return <ArrowRightLeft className="w-3.5 h-3.5" />;
      case 'lend': return <ArrowDownLeft className="w-3.5 h-3.5" />;
      case 'borrow': return <ArrowUpRight className="w-3.5 h-3.5" />;
      default: return null;
    }
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const dateFormatted = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      const timeFormatted = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
      return `${dateFormatted} · ${timeFormatted}`;
    } catch {
      return dateStr;
    }
  };

  const handleToggleSettlement = async (tx: Transaction) => {
    try {
      await toggleTransactionSettlement(tx.id, !tx.isSettled);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error('Failed to toggle settlement:', err);
    }
  };

  const handleDelete = async (tx: Transaction) => {
    try {
      await deleteTransaction(tx.id);
      setSelectedTxForDetails(null);
      if (onRefreshData) onRefreshData();
    } catch {
      // silently handle
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Welcome & Period Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div>
          <h1 className="text-xl font-semibold text-text-main">Financial Overview</h1>
          <p className="text-xs text-text-muted">
            Personal cashflow, account balances, and debts overview
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'this_month' as const, label: 'This Month' },
            { id: 'last_month' as const, label: 'Last Month' },
            { id: 'year' as const, label: 'Year' },
            { id: 'all' as const, label: 'All' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                period === p.id
                  ? 'bg-accent text-white shadow-subtle'
                  : 'bg-surface border border-border text-text-muted hover:text-text-main hover:bg-surface-hover'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 1: Key Balances & Financial Totals (Physical Cash, Bank Account, Income, Expenses) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Physical Cash Balance */}
        <div 
          onClick={() => setActiveTab('accounts')}
          className="p-4 rounded-xl bg-surface border border-border shadow-subtle hover:border-accent/40 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="font-medium">Physical Cash</span>
            <Coins className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1.5">
            {formatCurrency(totalCash, currency)}
          </div>
          <div className="text-[11px] text-text-muted mt-1 flex items-center justify-between">
            <span>{cashAccounts.length} cash account{cashAccounts.length === 1 ? '' : 's'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Bank Account Balance */}
        <div 
          onClick={() => setActiveTab('accounts')}
          className="p-4 rounded-xl bg-surface border border-border shadow-subtle hover:border-accent/40 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="font-medium">Bank Account</span>
            <Landmark className="w-4 h-4 text-accent" />
          </div>
          <div className="text-xl font-bold font-mono text-accent mt-1.5">
            {formatCurrency(totalBank, currency)}
          </div>
          <div className="text-[11px] text-text-muted mt-1 flex items-center justify-between">
            <span>{bankAccounts.length} bank account{bankAccounts.length === 1 ? '' : 's'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Total Income */}
        <div className="p-4 rounded-xl bg-surface border border-border shadow-subtle">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="font-medium">Total Income</span>
            <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1.5">
            {formatCurrency(summary.totalIncome, currency)}
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            Period cash inflow
          </div>
        </div>

        {/* Total Expenses */}
        <div className="p-4 rounded-xl bg-surface border border-border shadow-subtle">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="font-medium">Total Expenses</span>
            <ArrowUpRight className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1.5">
            {formatCurrency(summary.totalExpense, currency)}
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            Period operating spend
          </div>
        </div>
      </div>

      {/* Row 2: People & Debts Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Money People Need to Give Me */}
        <div 
          onClick={() => setActiveTab('debts')}
          className="p-4 rounded-xl bg-surface border border-border shadow-subtle hover:border-emerald-500/40 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="font-semibold text-text-main">Money People Need to Give Me</span>
            <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1.5">
            {formatCurrency(totalMoneyPeopleNeedToGiveMe, currency)}
          </div>
          <div className="text-[11px] text-text-muted mt-1 flex items-center justify-between">
            <span>{peopleWhoOweMe.length} person(s) owe you</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Money I Need to Give */}
        <div 
          onClick={() => setActiveTab('debts')}
          className="p-4 rounded-xl bg-surface border border-border shadow-subtle hover:border-amber-500/40 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="font-semibold text-text-main">Money I Need to Give</span>
            <ArrowUpRight className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1.5">
            {formatCurrency(totalMoneyINeedToGive, currency)}
          </div>
          <div className="text-[11px] text-text-muted mt-1 flex items-center justify-between">
            <span>{peopleIOwe.length} person(s) you owe</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Main Grid: Quick Entry on Left + People & Debts Breakdown on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Quick Add Transaction Form (Column 1-7) */}
        <div className="lg:col-span-7">
          <QuickAddForm
            accounts={accounts}
            people={people}
            currency={currency}
            defaultAccountId={defaultAccountId}
            defaultTransactionType={defaultTransactionType}
            onTransactionCreated={onRefreshData}
            onOpenAddPerson={() => setActiveTab('debts')}
          />
        </div>

        {/* Right Column: People & Debts Detailed Breakdown Card (Column 8-12) */}
        <div className="lg:col-span-5">
          <div className="p-4 rounded-xl bg-surface border border-border shadow-subtle space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-accent" />
                <span>People & Debts</span>
              </h3>
              <button
                onClick={() => setActiveTab('debts')}
                className="text-[11px] text-accent font-medium hover:underline flex items-center gap-0.5"
              >
                <span>Manage All</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Sub-section: Money People Need to Give Me */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <span>Money People Need to Give Me</span>
                <span className="font-mono">{formatCurrency(totalMoneyPeopleNeedToGiveMe, currency)}</span>
              </div>
              {peopleWhoOweMe.length === 0 ? (
                <p className="text-[11px] text-text-muted italic py-1">
                  No pending amounts owed to you.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {peopleWhoOweMe.map(p => (
                    <div
                      key={p.id}
                      onClick={() => setActiveTab('debts')}
                      className="p-2 rounded-lg bg-surface-hover/30 border border-border hover:bg-surface-hover cursor-pointer transition-colors flex items-center justify-between text-xs"
                    >
                      <span className="font-medium text-text-main">{p.name}</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(p.currentOwedToMe, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sub-section: Money I Need to Give */}
            <div className="space-y-1.5 pt-2 border-t border-border">
              <div className="flex items-center justify-between text-xs font-medium text-amber-600 dark:text-amber-400">
                <span>Money I Need to Give</span>
                <span className="font-mono">{formatCurrency(totalMoneyINeedToGive, currency)}</span>
              </div>
              {peopleIOwe.length === 0 ? (
                <p className="text-[11px] text-text-muted italic py-1">
                  No pending amounts you owe.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {peopleIOwe.map(p => (
                    <div
                      key={p.id}
                      onClick={() => setActiveTab('debts')}
                      className="p-2 rounded-lg bg-surface-hover/30 border border-border hover:bg-surface-hover cursor-pointer transition-colors flex items-center justify-between text-xs"
                    >
                      <span className="font-medium text-text-main">{p.name}</span>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                        {formatCurrency(p.currentOwedToThem, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Redesigned Recent Transactions with Separate, Individually Readable Rows */}
      <div className="bg-surface border border-border rounded-xl shadow-subtle overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-text-main">Recent Transactions</h3>
            <span className="text-xs text-text-muted">({recentTransactions.length} newest)</span>
          </div>
          <button
            onClick={() => setActiveTab('journal')}
            className="text-xs font-medium text-accent hover:underline flex items-center gap-1"
          >
            <span>View All →</span>
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="p-8 text-center text-xs text-text-muted">
            No transactions recorded yet. Use the Quick Entry form above to record your first transaction.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recentTransactions.map(tx => {
              const accName = accountMap.get(tx.accountId) || 'Account';
              const toAccName = tx.toAccountId ? accountMap.get(tx.toAccountId) : null;
              const personName = tx.personId ? personMap.get(tx.personId) : null;

              return (
                <div
                  key={tx.id}
                  onClick={() => setSelectedTxForDetails(tx)}
                  className="p-3.5 hover:bg-surface-hover/30 transition-colors cursor-pointer space-y-1.5"
                >
                  {/* First line: Transaction type / icon on left, Amount right-aligned */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getTypeStyle(tx.type)} capitalize`}>
                        {getTypeIcon(tx.type)}
                        <span>{tx.type}</span>
                      </span>
                    </div>

                    <div className="font-mono font-bold text-sm text-right">
                      {tx.type === 'expense' && (
                        <span className="text-rose-600 dark:text-rose-400">
                          −{formatCurrency(tx.amount, currency)}
                        </span>
                      )}
                      {tx.type === 'income' && (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          +{formatCurrency(tx.amount, currency)}
                        </span>
                      )}
                      {tx.type === 'transfer' && (
                        <span className="text-text-main">
                          {formatCurrency(tx.amount, currency)}
                        </span>
                      )}
                      {tx.type === 'lend' && (
                        <span className="text-blue-600 dark:text-blue-400">
                          {formatCurrency(tx.amount, currency)}
                        </span>
                      )}
                      {tx.type === 'borrow' && (
                        <span className="text-amber-600 dark:text-amber-400">
                          {formatCurrency(tx.amount, currency)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Second line: Description or person's name */}
                  <div className="text-xs font-semibold text-text-main truncate">
                    {tx.type === 'lend' || tx.type === 'borrow'
                      ? (personName || tx.description || '—')
                      : (tx.description || tx.reason || '—')}
                  </div>

                  {/* Third line: Account name (or Transfer flow) · formatted date/time, and view button */}
                  <div className="flex items-center justify-between text-[11px] text-text-muted">
                    <div className="truncate">
                      {tx.type === 'transfer' && toAccName ? (
                        <span>
                          {accName} <span className="text-accent">→</span> {toAccName} · {formatTimestamp(tx.date)}
                        </span>
                      ) : (
                        <span>
                          {accName} · {formatTimestamp(tx.date)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedTxForDetails(tx)}
                        title="View details"
                        className="p-1 rounded text-text-muted hover:text-text-main hover:bg-surface-hover"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Lend / Borrow: Working Checkbox for Pending / Completed */}
                  {(tx.type === 'lend' || tx.type === 'borrow') && (
                    <div className="pt-1 flex items-center justify-between" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleToggleSettlement(tx)}
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border transition-colors ${
                          tx.isSettled
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40'
                            : 'bg-surface-hover text-text-muted hover:text-text-main border-border'
                        }`}
                        title={tx.isSettled ? 'Mark as Pending' : 'Mark as Completed'}
                      >
                        {tx.isSettled ? (
                          <>
                            <CheckSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>☑ Completed</span>
                          </>
                        ) : (
                          <>
                            <Square className="w-3.5 h-3.5" />
                            <span>☐ Pending</span>
                          </>
                        )}
                      </button>
                      <span className="text-[10px] text-text-muted italic">
                        {tx.isSettled ? 'Debt settled' : 'Outstanding debt'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transaction Details Modal */}
      {selectedTxForDetails && (
        <TransactionDetailsModal
          transaction={selectedTxForDetails}
          accounts={accounts}
          people={people}
          currency={currency}
          onClose={() => setSelectedTxForDetails(null)}
          onEdit={() => {
            const tx = selectedTxForDetails;
            setSelectedTxForDetails(null);
            setSelectedTxForEdit(tx);
          }}
          onDelete={() => handleDelete(selectedTxForDetails)}
        />
      )}

      {/* Edit Modal */}
      {selectedTxForEdit && (
        <EditTransactionModal
          transaction={selectedTxForEdit}
          accounts={accounts}
          people={people}
          currency={currency}
          onClose={() => setSelectedTxForEdit(null)}
          onSaved={() => {
            if (onRefreshData) onRefreshData();
          }}
        />
      )}
    </div>
  );
};

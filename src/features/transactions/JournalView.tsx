import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Download, 
  ArrowUpDown, 
  Edit, 
  Trash2, 
  Plus, 
  Receipt,
  Eye,
  CheckCircle2,
  X,
  TrendingDown,
  TrendingUp,
  ArrowRightLeft,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeft,
  Square,
  CheckSquare
} from 'lucide-react';
import { 
  Transaction, 
  Account, 
  Person, 
  CurrencyConfig, 
  AllowedTransactionType 
} from '../../types';
import { formatCurrency } from '../../utils/currency';
import { formatDate } from '../../utils/date';
import { deleteTransaction, toggleTransactionSettlement } from '../../services/accounting';
import { exportTransactionsToCSV } from '../../services/backup';
import { EditTransactionModal } from './EditTransactionModal';
import { TransactionDetailsModal } from './TransactionDetailsModal';

interface JournalViewProps {
  transactions: Transaction[];
  accounts: Account[];
  people: Person[];
  currency: CurrencyConfig;
  onOpenQuickAdd: () => void;
  onBack?: () => void;
  onRefreshData?: () => void;
}

export const JournalView: React.FC<JournalViewProps> = ({
  transactions,
  accounts,
  people,
  currency,
  onOpenQuickAdd,
  onBack,
  onRefreshData
}) => {
  // Search & Filters (exact 5 types + all) - preserved across navigation
  const [searchTerm, setSearchTerm] = useState(() => sessionStorage.getItem('journal_search') || '');
  const [selectedType, setSelectedType] = useState<string>(() => sessionStorage.getItem('journal_type') || 'all');
  const [selectedAccount, setSelectedAccount] = useState<string>(() => sessionStorage.getItem('journal_account') || 'all');
  const [dateFilterRange, setDateFilterRange] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>(() => (sessionStorage.getItem('journal_dateRange') as any) || 'all');
  const [customStartDate, setCustomStartDate] = useState(() => sessionStorage.getItem('journal_startDate') || '');
  const [customEndDate, setCustomEndDate] = useState(() => sessionStorage.getItem('journal_endDate') || '');
  
  // Sorting
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>(() => (sessionStorage.getItem('journal_sortBy') as any) || 'date-desc');

  // Persist filters and scroll position
  useEffect(() => {
    sessionStorage.setItem('journal_search', searchTerm);
    sessionStorage.setItem('journal_type', selectedType);
    sessionStorage.setItem('journal_account', selectedAccount);
    sessionStorage.setItem('journal_dateRange', dateFilterRange);
    sessionStorage.setItem('journal_startDate', customStartDate);
    sessionStorage.setItem('journal_endDate', customEndDate);
    sessionStorage.setItem('journal_sortBy', sortBy);
  }, [searchTerm, selectedType, selectedAccount, dateFilterRange, customStartDate, customEndDate, sortBy]);

  useEffect(() => {
    const savedScroll = sessionStorage.getItem('journal_scroll');
    if (savedScroll) {
      window.scrollTo(0, parseInt(savedScroll, 10));
    }
    const handleScroll = () => {
      sessionStorage.setItem('journal_scroll', window.scrollY.toString());
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Modals
  const [selectedTxForDetails, setSelectedTxForDetails] = useState<Transaction | null>(null);
  const [selectedTxForEdit, setSelectedTxForEdit] = useState<Transaction | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Lookups
  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a.name])), [accounts]);
  const personMap = useMemo(() => new Map(people.map(p => [p.id, p.name])), [people]);

  // Filtered & Sorted Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      // 1. Search filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesDesc = (tx.description || '').toLowerCase().includes(term);
        const matchesReason = (tx.reason || '').toLowerCase().includes(term);
        const personName = tx.personId ? (personMap.get(tx.personId) || '') : '';
        const matchesPerson = personName.toLowerCase().includes(term);
        const matchesNotes = tx.notes ? tx.notes.toLowerCase().includes(term) : false;
        if (!matchesDesc && !matchesReason && !matchesPerson && !matchesNotes) {
          return false;
        }
      }

      // 2. Type filter
      if (selectedType !== 'all' && tx.type !== selectedType) {
        return false;
      }

      // 3. Account filter
      if (selectedAccount !== 'all' && tx.accountId !== selectedAccount && tx.toAccountId !== selectedAccount) {
        return false;
      }

      // 4. Date filter
      if (dateFilterRange !== 'all') {
        const txDate = new Date(tx.date);
        const now = new Date();

        if (dateFilterRange === 'today') {
          if (txDate.toDateString() !== now.toDateString()) return false;
        } else if (dateFilterRange === 'week') {
          const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (txDate < oneWeekAgo) return false;
        } else if (dateFilterRange === 'month') {
          if (txDate.getMonth() !== now.getMonth() || txDate.getFullYear() !== now.getFullYear()) {
            return false;
          }
        } else if (dateFilterRange === 'custom') {
          if (customStartDate && tx.date.slice(0, 10) < customStartDate) return false;
          if (customEndDate && tx.date.slice(0, 10) > customEndDate) return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'date-desc') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortBy === 'date-asc') return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortBy === 'amount-desc') return b.amount - a.amount;
      if (sortBy === 'amount-asc') return a.amount - b.amount;
      return 0;
    });
  }, [
    transactions, 
    searchTerm, 
    selectedType, 
    selectedAccount, 
    dateFilterRange, 
    customStartDate, 
    customEndDate, 
    sortBy,
    personMap
  ]);

  // Income vs Expense comparison calculations for the filtered set (ignoring transfers, lend, borrow)
  const incomeVsExpense = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of filteredTransactions) {
      if (tx.type === 'income') {
        income += tx.amount;
      } else if (tx.type === 'expense') {
        expense += tx.amount;
      }
    }
    const net = income - expense;
    const totalVolume = income + expense;
    const incomePercent = totalVolume > 0 ? Math.round((income / totalVolume) * 100) : 50;
    const expensePercent = totalVolume > 0 ? 100 - incomePercent : 50;

    return { income, expense, net, incomePercent, expensePercent, totalVolume };
  }, [filteredTransactions]);

  const handleToggleSettlement = async (tx: Transaction) => {
    try {
      await toggleTransactionSettlement(tx.id, !tx.isSettled);
      setFeedback(`Transaction marked ${!tx.isSettled ? 'Completed' : 'Pending'}. Debt totals updated.`);
      if (onRefreshData) onRefreshData();
      setTimeout(() => setFeedback(null), 3000);
    } catch {
      setFeedback('Error updating debt status.');
    }
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const dateFormatted = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const timeFormatted = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
      return `${dateFormatted} · ${timeFormatted}`;
    } catch {
      return dateStr;
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

  const handleDelete = async (tx: Transaction) => {
    try {
      await deleteTransaction(tx.id);
      setSelectedTxForDetails(null);
      setFeedback(`Transaction deleted. Balances updated.`);
      if (onRefreshData) onRefreshData();
      setTimeout(() => setFeedback(null), 3500);
    } catch {
      setFeedback('Error deleting transaction.');
    }
  };

  const handleExportCSV = () => {
    exportTransactionsToCSV(filteredTransactions, accounts, [], people);
  };

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

  const filterTabs: { id: string; label: string; icon?: React.ElementType }[] = [
    { id: 'all', label: 'All' },
    { id: 'expense', label: 'Expense', icon: TrendingDown },
    { id: 'income', label: 'Income', icon: TrendingUp },
    { id: 'lend', label: 'Lend', icon: ArrowDownLeft },
    { id: 'borrow', label: 'Borrow', icon: ArrowUpRight },
  ];

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="px-2.5 py-1.5 rounded-lg border border-border text-xs text-text-muted hover:text-text-main hover:bg-surface-hover flex items-center gap-1.5 transition-colors"
              title="Return to Dashboard"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          )}
          <div>
            <h1 className="text-xl font-semibold text-text-main">Journal</h1>
            <p className="text-xs text-text-muted">
              Chronological audit log of all financial events and transactions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={filteredTransactions.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-surface text-xs font-medium text-text-main hover:bg-surface-hover active:scale-[0.99] transition-all disabled:opacity-50"
            title="Download CSV"
          >
            <Download className="w-3.5 h-3.5 text-text-muted" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onOpenQuickAdd}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover active:scale-[0.99] transition-all shadow-subtle"
          >
            <Plus className="w-4 h-4" />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 p-3 text-xs font-medium text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-900/40">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Income & Expense Comparative Visualization Card */}
      <div className="p-4 rounded-xl bg-surface border border-border shadow-subtle space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-semibold text-text-main">
            Income vs Expense Comparison (Filtered Period)
          </span>
          <span className="text-[11px] text-text-muted">
            Lend and Borrow are non-operating and excluded from this comparison
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Income total */}
          <div className="p-3 rounded-lg bg-surface-hover/40 border border-border">
            <span className="text-[11px] text-text-muted font-medium flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Total Income</span>
            </span>
            <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
              +{formatCurrency(incomeVsExpense.income, currency)}
            </div>
          </div>

          {/* Expense total */}
          <div className="p-3 rounded-lg bg-surface-hover/40 border border-border">
            <span className="text-[11px] text-text-muted font-medium flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>Total Expenses</span>
            </span>
            <div className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">
              -{formatCurrency(incomeVsExpense.expense, currency)}
            </div>
          </div>

          {/* Net flow */}
          <div className="p-3 rounded-lg bg-surface-hover/40 border border-border">
            <span className="text-[11px] text-text-muted font-medium">Net Operating Flow</span>
            <div className={`text-lg font-bold font-mono mt-0.5 ${
              incomeVsExpense.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}>
              {formatCurrency(incomeVsExpense.net, currency, true)}
            </div>
          </div>
        </div>

        {/* Ratio bar */}
        {incomeVsExpense.totalVolume > 0 && (
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[10px] text-text-muted font-mono">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                Income: {incomeVsExpense.incomePercent}%
              </span>
              <span className="text-rose-600 dark:text-rose-400 font-medium">
                Expense: {incomeVsExpense.expensePercent}%
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-surface-hover overflow-hidden flex">
              <div 
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${incomeVsExpense.incomePercent}%` }}
              />
              <div 
                className="h-full bg-rose-500 transition-all"
                style={{ width: `${incomeVsExpense.expensePercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Filter and Search Bar with Exact 5 Visual Tabs */}
      <div className="bg-surface border border-border rounded-xl p-4 shadow-subtle space-y-3">
        {/* Visual Tabs for the 5 Types + All */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 border-b border-border pb-3">
          {filterTabs.map(tab => {
            const Icon = tab.icon;
            const isSelected = selectedType === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedType(tab.id)}
                className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 ${
                  isSelected
                    ? 'bg-accent text-white font-semibold shadow-subtle'
                    : 'bg-surface-hover text-text-muted hover:text-text-main border border-border'
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by description, person, or notes..."
              className="w-full pl-9 pr-8 py-2 rounded-lg bg-surface border border-border text-xs text-text-main focus:outline-none focus:border-accent transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Date Range Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {(['all', 'today', 'week', 'month', 'custom'] as const).map(range => (
              <button
                key={range}
                onClick={() => setDateFilterRange(range)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize shrink-0 transition-colors ${
                  dateFilterRange === range
                    ? 'bg-accent text-white font-semibold shadow-subtle'
                    : 'bg-surface-hover text-text-muted hover:text-text-main border border-border'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-text-muted" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-lg bg-surface border border-border text-xs text-text-main focus:outline-none focus:border-accent"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="amount-desc">Amount: High to Low</option>
              <option value="amount-asc">Amount: Low to High</option>
            </select>
          </div>
        </div>

        {/* Dropdown Filters (Accounts) */}
        <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-text-muted text-[11px] font-medium">Filter by Account:</span>
            <select
              value={selectedAccount}
              onChange={e => setSelectedAccount(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-surface border border-border text-xs text-text-main focus:outline-none focus:border-accent"
            >
              <option value="all">All Accounts</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.type === 'cash' ? 'Cash' : 'Bank'})
                </option>
              ))}
            </select>
          </div>

          <span className="text-[11px] text-text-muted">
            Showing {filteredTransactions.length} of {transactions.length} entries
          </span>
        </div>

        {/* Custom Date Pickers */}
        {dateFilterRange === 'custom' && (
          <div className="flex items-center gap-2 pt-2 border-t border-border text-xs">
            <span className="text-text-muted">From:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={e => setCustomStartDate(e.target.value)}
              className="px-2 py-1 rounded-md bg-surface border border-border text-text-main text-xs"
            />
            <span className="text-text-muted">To:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={e => setCustomEndDate(e.target.value)}
              className="px-2 py-1 rounded-md bg-surface border border-border text-text-main text-xs"
            />
          </div>
        )}
      </div>

      {/* Aligned Table with Consistent Rows */}
      {filteredTransactions.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-12 text-center shadow-subtle">
          <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center mx-auto mb-3 text-text-muted">
            <Receipt className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-text-main mb-1">No Journal Entries Found</h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto mb-4">
            {transactions.length === 0
              ? 'Your financial journal is empty. Use the Quick Entry form to record your first transaction.'
              : 'No entries match your search and filter criteria. Try resetting your filters.'}
          </p>
          {transactions.length === 0 && (
            <button
              onClick={onOpenQuickAdd}
              className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors"
            >
              Record First Transaction
            </button>
          )}
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-subtle divide-y divide-border">
          {filteredTransactions.map(tx => {
            const accName = accountMap.get(tx.accountId) || 'Account';
            const toAccName = tx.toAccountId ? accountMap.get(tx.toAccountId) : null;
            const personName = tx.personId ? personMap.get(tx.personId) : null;

            return (
              <div
                key={tx.id}
                onClick={() => setSelectedTxForDetails(tx)}
                className="p-4 hover:bg-surface-hover/30 transition-colors cursor-pointer space-y-2"
              >
                {/* Top line: Type badge + Date/Time on left, Amount right-aligned */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getTypeStyle(tx.type)} capitalize`}>
                      {getTypeIcon(tx.type)}
                      <span>{tx.type}</span>
                    </span>
                    <span className="text-xs font-mono text-text-muted">
                      {formatTimestamp(tx.date)}
                    </span>
                  </div>

                  <div className="font-mono font-bold text-base text-right">
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
                    {tx.type !== 'expense' && tx.type !== 'income' && tx.type !== 'transfer' && tx.type !== 'lend' && tx.type !== 'borrow' && (
                      <span className="text-text-main">
                        {formatCurrency(tx.amount, currency)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Middle line: Description or Person's name */}
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-sm font-semibold text-text-main">
                    {tx.type === 'lend' || tx.type === 'borrow'
                      ? (personName || tx.description || '—')
                      : (tx.description || tx.reason || '—')}
                  </div>
                  {personName && tx.description && tx.type !== 'lend' && tx.type !== 'borrow' && (
                    <span className="text-xs text-text-muted">👤 {personName}</span>
                  )}
                </div>
                {tx.notes && (
                  <div className="text-xs text-text-muted italic">{tx.notes}</div>
                )}

                {/* Bottom line: Account / Transfer flow, Lend/Borrow checkbox, Action buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/60 text-xs">
                  <div className="text-text-muted">
                    {toAccName ? (
                      <span className="text-text-main font-medium">
                        {accName} <span className="text-accent">→</span> {toAccName}
                      </span>
                    ) : (
                      <span className="text-text-main font-medium">{accName}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                    {/* Lend / Borrow Checkbox */}
                    {(tx.type === 'lend' || tx.type === 'borrow') && (
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
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 border-l border-border pl-2">
                      <button
                        onClick={() => setSelectedTxForDetails(tx)}
                        title="View details"
                        className="p-1.5 rounded text-text-muted hover:text-accent hover:bg-surface-hover transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {tx.type !== 'transfer' && (
                        <button
                          onClick={() => setSelectedTxForEdit(tx)}
                          title="Edit entry"
                          className="p-1.5 rounded text-text-muted hover:text-accent hover:bg-surface-hover transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(tx)}
                        title="Delete entry"
                        className="p-1.5 rounded text-text-muted hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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
            setFeedback('Transaction updated successfully.');
            if (onRefreshData) onRefreshData();
            setTimeout(() => setFeedback(null), 3500);
          }}
        />
      )}

      {/* Details Modal */}
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
    </div>
  );
};

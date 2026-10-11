import React, { useState, useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  Legend
} from 'recharts';
import { 
  BarChart3, 
  TrendingUp, 
  Award,
  Wallet,
  ArrowLeft
} from 'lucide-react';
import { Transaction, Account, Person, CurrencyConfig } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { calculateFinancialSummary, calculateNetWorth } from '../../services/accounting';

interface AnalyticsViewProps {
  transactions: Transaction[];
  accounts: Account[];
  people: Person[];
  currency: CurrencyConfig;
  onBack?: () => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  transactions,
  accounts,
  people,
  currency,
  onBack
}) => {
  const [period, setPeriod] = useState<'this_month' | 'last_month' | 'quarter' | 'year' | 'all'>('this_month');

  // Filter transactions by period
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return transactions.filter(tx => {
      const d = new Date(tx.date);
      if (period === 'this_month') {
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      }
      if (period === 'last_month') {
        const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
        return d.getFullYear() === lastMonthDate.getFullYear() && d.getMonth() === lastMonthDate.getMonth();
      }
      if (period === 'quarter') {
        const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        return d >= threeMonthsAgo;
      }
      if (period === 'year') {
        return d.getFullYear() === currentYear;
      }
      return true;
    });
  }, [transactions, period]);

  // Overall Financial Summary for period
  const summary = useMemo(() => {
    return calculateFinancialSummary(filteredTransactions);
  }, [filteredTransactions]);

  // Net Worth (all-time current state)
  const netWorthSummary = useMemo(() => {
    return calculateNetWorth(accounts, people);
  }, [accounts, people]);

  // Monthly Cash Flow Trend (for area/bar chart)
  const monthlyTrendData = useMemo(() => {
    const monthsMap = new Map<string, { month: string; income: number; expense: number }>();

    // Sort transactions chronological
    const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (const tx of sorted) {
      const monthKey = tx.date.slice(0, 7); // YYYY-MM
      const existing = monthsMap.get(monthKey) || { month: monthKey, income: 0, expense: 0 };
      if (tx.type === 'income') {
        existing.income += tx.amount;
      } else if (tx.type === 'expense') {
        existing.expense += tx.amount;
      }
      monthsMap.set(monthKey, existing);
    }

    return Array.from(monthsMap.values()).map(m => ({
      month: m.month,
      income: Number((m.income / 100).toFixed(2)),
      expense: Number((m.expense / 100).toFixed(2)),
      net: Number(((m.income - m.expense) / 100).toFixed(2))
    }));
  }, [transactions]);

  // Account Spending Breakdown (Physical Cash vs Bank Accounts)
  const accountSpendingData = useMemo(() => {
    const accMap = new Map<string, number>();
    for (const tx of filteredTransactions) {
      if (tx.type === 'expense') {
        accMap.set(tx.accountId, (accMap.get(tx.accountId) || 0) + tx.amount);
      }
    }

    const nameMap = new Map(accounts.map(a => [a.id, a.name]));
    return Array.from(accMap.entries()).map(([accId, amount]) => ({
      name: nameMap.get(accId) || 'Account',
      spending: Number((amount / 100).toFixed(2))
    })).sort((a, b) => b.spending - a.spending);
  }, [filteredTransactions, accounts]);

  // Top 5 Largest Expenses
  const topExpenses = useMemo(() => {
    return filteredTransactions
      .filter(t => t.type === 'expense')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [filteredTransactions]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg border border-border text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
              title="Go Back"
              aria-label="Go Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-semibold text-text-main">Analytics & Reports</h1>
            <p className="text-xs text-text-muted">
              Financial trends, spending distribution, savings rates, and net worth
            </p>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'this_month' as const, label: 'This Month' },
            { id: 'last_month' as const, label: 'Last Month' },
            { id: 'quarter' as const, label: 'Quarter' },
            { id: 'year' as const, label: 'Year' },
            { id: 'all' as const, label: 'All Time' },
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-surface border border-border shadow-subtle">
          <span className="text-[11px] font-medium text-text-muted">Period Income</span>
          <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {formatCurrency(summary.totalIncome, currency)}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-border shadow-subtle">
          <span className="text-[11px] font-medium text-text-muted">Period Expenses</span>
          <div className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">
            {formatCurrency(summary.totalExpense, currency)}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-border shadow-subtle">
          <span className="text-[11px] font-medium text-text-muted">Savings Rate</span>
          <div className="text-xl font-bold font-mono text-accent mt-1">
            {summary.savingsRate}%
          </div>
          <span className="text-[10px] text-text-muted mt-0.5 block">
            Net: {formatCurrency(summary.netCashFlow, currency, true)}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-border shadow-subtle">
          <span className="text-[11px] font-medium text-text-muted">Net Worth (Estimate)</span>
          <div className="text-xl font-bold font-mono text-text-main mt-1">
            {formatCurrency(netWorthSummary.netWorth, currency)}
          </div>
          <span className="text-[10px] text-text-muted mt-0.5 block">
            Assets: {formatCurrency(netWorthSummary.totalAssets, currency)}
          </span>
        </div>
      </div>

      {filteredTransactions.length === 0 ? (
        <div className="p-12 rounded-xl border border-dashed border-border bg-surface text-center">
          <BarChart3 className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-text-main mb-1">No Data for Selected Period</h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto">
            No transactions match this time period. Record more transactions or switch to "All Time".
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Charts Row 1: Income vs Expense Bar Chart */}
          <div className="p-5 rounded-xl bg-surface border border-border shadow-subtle">
            <h3 className="text-xs font-semibold text-text-main mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent" />
              <span>Income vs Expenses Over Time ({currency.symbol})</span>
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-card)',
                      borderColor: 'var(--border-color)',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Expense" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Charts Row 2: Account Spending & Top 5 Largest Expenses */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Account Spending */}
            <div className="p-5 rounded-xl bg-surface border border-border shadow-subtle">
              <h3 className="text-xs font-semibold text-text-main mb-4 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-accent" />
                <span>Spending by Account ({currency.symbol})</span>
              </h3>
              {accountSpendingData.length === 0 ? (
                <div className="h-60 flex items-center justify-center text-xs text-text-muted">
                  No account spending in this period.
                </div>
              ) : (
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={accountSpendingData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                      <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                      <YAxis dataKey="name" type="category" stroke="var(--text-muted)" fontSize={11} tickLine={false} width={100} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--bg-card)',
                          borderColor: 'var(--border-color)',
                          borderRadius: '8px',
                          fontSize: '12px'
                        }}
                      />
                      <Bar dataKey="spending" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Top 5 Expenses */}
            <div className="p-5 rounded-xl bg-surface border border-border shadow-subtle">
              <h3 className="text-xs font-semibold text-text-main mb-4 flex items-center gap-2">
                <Award className="w-4 h-4 text-accent" />
                <span>Top 5 Largest Expenses</span>
              </h3>
              {topExpenses.length === 0 ? (
                <div className="h-60 flex items-center justify-center text-xs text-text-muted">
                  No expenses recorded.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {topExpenses.map((tx, idx) => (
                    <div
                      key={tx.id}
                      className="p-3 rounded-lg border border-border bg-surface-hover/30 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-surface-hover text-text-muted flex items-center justify-center text-[10px] font-bold">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-semibold text-text-main">{tx.description || tx.reason || 'Expense'}</div>
                        </div>
                      </div>
                      <div className="font-mono font-bold text-rose-600 dark:text-rose-400">
                        {formatCurrency(tx.amount, currency)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

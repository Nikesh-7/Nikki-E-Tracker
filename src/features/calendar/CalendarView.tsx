import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Plus, 
  Receipt,
  ArrowLeft 
} from 'lucide-react';
import { Transaction, CurrencyConfig } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { getCalendarGrid, getMonthYearLabel, toISODateString, formatDate } from '../../utils/date';

interface CalendarViewProps {
  transactions: Transaction[];
  currency: CurrencyConfig;
  weekStartsOn: 0 | 1;
  onOpenQuickAdd: () => void;
  onBack?: () => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  transactions,
  currency,
  weekStartsOn,
  onOpenQuickAdd,
  onBack
}) => {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDayDateStr, setSelectedDayDateStr] = useState<string | null>(() => toISODateString(new Date()));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDayDateStr(toISODateString(today));
  };

  // Group transactions by YYYY-MM-DD
  const dailyData = useMemo(() => {
    const map = new Map<string, {
      income: number;
      expense: number;
      transactions: Transaction[];
    }>();

    for (const tx of transactions) {
      const dateKey = tx.date.slice(0, 10);
      const existing = map.get(dateKey) || { income: 0, expense: 0, transactions: [] };
      if (tx.type === 'income') {
        existing.income += tx.amount;
      } else if (tx.type === 'expense') {
        existing.expense += tx.amount;
      }
      existing.transactions.push(tx);
      map.set(dateKey, existing);
    }

    return map;
  }, [transactions]);

  // Calendar cells
  const gridDays = useMemo(() => {
    return getCalendarGrid(year, month, weekStartsOn);
  }, [year, month, weekStartsOn]);

  // Current Month Totals
  const monthSummary = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of transactions) {
      const d = new Date(tx.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        if (tx.type === 'income') income += tx.amount;
        if (tx.type === 'expense') expense += tx.amount;
      }
    }
    return { income, expense, net: income - expense };
  }, [transactions, year, month]);

  const selectedDayDetails = selectedDayDateStr ? dailyData.get(selectedDayDateStr) : null;

  const weekdays = weekStartsOn === 1 
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
            <h1 className="text-xl font-semibold text-text-main">Financial Calendar</h1>
            <p className="text-xs text-text-muted">
              Inspect daily cashflow, expenses, and transactions by date
            </p>
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToday}
            className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-text-main hover:bg-surface-hover transition-colors"
          >
            Today
          </button>
          <div className="flex items-center gap-1 border border-border rounded-lg bg-surface p-0.5">
            <button
              onClick={handlePrevMonth}
              className="p-1 rounded text-text-muted hover:text-text-main hover:bg-surface-hover"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold px-2 text-text-main font-mono">
              {getMonthYearLabel(year, month)}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 rounded text-text-muted hover:text-text-main hover:bg-surface-hover"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Monthly Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-surface border border-border text-xs">
          <span className="text-text-muted font-medium">Month Income</span>
          <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
            {formatCurrency(monthSummary.income, currency)}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-surface border border-border text-xs">
          <span className="text-text-muted font-medium">Month Expenses</span>
          <div className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">
            {formatCurrency(monthSummary.expense, currency)}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-surface border border-border text-xs">
          <span className="text-text-muted font-medium">Net Month Flow</span>
          <div className={`text-lg font-bold font-mono mt-0.5 ${
            monthSummary.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          }`}>
            {formatCurrency(monthSummary.net, currency, true)}
          </div>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div className="bg-surface border border-border rounded-xl shadow-subtle overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-border bg-surface-hover/60 text-center text-[11px] font-semibold text-text-muted py-2.5">
          {weekdays.map(d => (
            <div key={d}>{d}</div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 divide-x divide-y divide-border border-b border-border">
          {gridDays.map((cell, idx) => {
            const data = dailyData.get(cell.dateStr);
            const hasIncome = data && data.income > 0;
            const hasExpense = data && data.expense > 0;
            const isSelected = selectedDayDateStr === cell.dateStr;

            return (
              <div
                key={idx}
                onClick={() => setSelectedDayDateStr(cell.dateStr)}
                className={`min-h-[85px] sm:min-h-[100px] p-1.5 sm:p-2 cursor-pointer transition-all flex flex-col justify-between ${
                  !cell.isCurrentMonth ? 'bg-surface-hover/20 text-text-muted/40' : 'bg-surface'
                } ${isSelected ? 'ring-2 ring-accent ring-inset' : 'hover:bg-surface-hover/40'}`}
              >
                {/* Header: Day number & Today indicator */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-semibold ${
                      cell.isToday
                        ? 'w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center font-bold text-[11px]'
                        : isSelected ? 'text-accent font-bold' : cell.isCurrentMonth ? 'text-text-main' : 'text-text-muted/50'
                    }`}
                  >
                    {cell.dayNumber}
                  </span>
                </div>

                {/* Daily Figures */}
                <div className="space-y-0.5 mt-1 text-[10px] sm:text-[11px] font-mono leading-tight">
                  {hasIncome && (
                    <div className="text-emerald-600 dark:text-emerald-400 font-medium truncate">
                      +{formatCurrency(data.income, currency)}
                    </div>
                  )}
                  {hasExpense && (
                    <div className="text-rose-600 dark:text-rose-400 font-medium truncate">
                      -{formatCurrency(data.expense, currency)}
                    </div>
                  )}
                </div>

                {/* Dot indicators for transactions count */}
                {data && data.transactions.length > 0 && (
                  <div className="flex items-center gap-0.5 pt-1">
                    {data.transactions.slice(0, 4).map((_, i) => (
                      <span key={i} className="w-1 h-1 rounded-full bg-text-muted/60" />
                    ))}
                    {data.transactions.length > 4 && (
                      <span className="text-[9px] text-text-muted font-mono leading-none">+</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Details Panel */}
      {selectedDayDateStr && (
        <div className="bg-surface border border-border rounded-xl p-5 shadow-subtle space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-semibold text-text-main">
                {formatDate(selectedDayDateStr, 'YYYY-MM-DD')} Details
              </h3>
            </div>

            <button
              onClick={onOpenQuickAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record for this date</span>
            </button>
          </div>

          {/* Transactions for this date */}
          {(!selectedDayDetails || selectedDayDetails.transactions.length === 0) ? (
            <p className="text-xs text-text-muted py-4 text-center">
              No transactions recorded for this day.
            </p>
          ) : (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-text-main mb-2">Transactions</h4>
              <div className="space-y-2">
                {selectedDayDetails.transactions.map(tx => (
                  <div
                    key={tx.id}
                    className="p-3 rounded-lg border border-border bg-surface-hover/30 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-text-main">{tx.description || tx.reason}</div>
                      {tx.notes && <div className="text-[11px] text-text-muted italic">{tx.notes}</div>}
                    </div>
                    <div className="text-right">
                      <div className={`font-mono font-semibold ${
                        tx.type === 'income' ? 'text-emerald-600' : tx.type === 'expense' ? 'text-rose-600' : 'text-text-main'
                      }`}>
                        {formatCurrency(tx.amount, currency, tx.type === 'income')}
                      </div>
                      <span className="text-[10px] text-accent uppercase font-medium">{tx.type}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

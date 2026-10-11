import React, { useState } from 'react';
import { 
  UserPlus, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  Users,
  ArrowLeft,
  Square,
  CheckSquare,
  History
} from 'lucide-react';
import { Person, Account, CurrencyConfig, Transaction } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { formatDate } from '../../utils/date';
import { AddPersonModal } from './AddPersonModal';
import { RecordDebtPaymentModal } from './RecordDebtPaymentModal';
import { db } from '../../db';
import { toggleTransactionSettlement } from '../../services/accounting';

interface DebtsViewProps {
  people: Person[];
  accounts: Account[];
  transactions: Transaction[];
  currency: CurrencyConfig;
  onRefreshData?: () => void;
  onBack?: () => void;
}

export const DebtsView: React.FC<DebtsViewProps> = ({
  people,
  accounts,
  transactions = [],
  currency,
  onRefreshData,
  onBack
}) => {
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [selectedPersonForRepayment, setSelectedPersonForRepayment] = useState<{
    person: Person;
    mode: 'repay_them' | 'receive_from_them';
  } | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Totals using exact requirement terminology
  const totalMoneyPeopleNeedToGiveMe = people.reduce((sum, p) => sum + p.currentOwedToMe, 0);
  const totalMoneyINeedToGive = people.reduce((sum, p) => sum + p.currentOwedToThem, 0);

  const peopleWhoOweMe = people.filter(p => p.currentOwedToMe > 0);
  const peopleIOwe = people.filter(p => p.currentOwedToThem > 0);
  const settledPeople = people.filter(p => p.currentOwedToMe === 0 && p.currentOwedToThem === 0);

  const handleDeletePerson = async (person: Person) => {
    if (person.currentOwedToThem > 0 || person.currentOwedToMe > 0) {
      if (!confirm(`Warning: ${person.name} has an active balance. Are you sure you want to delete this record?`)) {
        return;
      }
    } else {
      if (!confirm(`Are you sure you want to delete ${person.name}?`)) {
        return;
      }
    }

    await db.people.delete(person.id);
    setFeedback(`Record for ${person.name} deleted.`);
    if (onRefreshData) onRefreshData();
    setTimeout(() => setFeedback(null), 3000);
  };

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

  return (
    <div className="space-y-6">
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
            <h1 className="text-xl font-semibold text-text-main">People & Debts</h1>
            <p className="text-xs text-text-muted">
              Track money people need to give you and money you need to give
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddPersonModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors shadow-subtle"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Entry</span>
        </button>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 p-3 text-xs font-medium text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-900/40">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Aggregate Overview Metrics with Exact Labels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Money People Need to Give Me */}
        <div className="p-4 rounded-xl bg-surface border border-border shadow-subtle">
          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
            <ArrowDownLeft className="w-4 h-4" />
            <span>Money People Need to Give Me</span>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1.5">
            {formatCurrency(totalMoneyPeopleNeedToGiveMe, currency)}
          </div>
          <span className="text-[11px] text-text-muted mt-1 block">
            {peopleWhoOweMe.length} person{peopleWhoOweMe.length === 1 ? '' : 's'} with pending amounts
          </span>
        </div>

        {/* Money I Need to Give */}
        <div className="p-4 rounded-xl bg-surface border border-border shadow-subtle">
          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-semibold">
            <ArrowUpRight className="w-4 h-4" />
            <span>Money I Need to Give</span>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1.5">
            {formatCurrency(totalMoneyINeedToGive, currency)}
          </div>
          <span className="text-[11px] text-text-muted mt-1 block">
            {peopleIOwe.length} person{peopleIOwe.length === 1 ? '' : 's'} to be paid
          </span>
        </div>
      </div>

      {people.length === 0 ? (
        <div className="p-12 rounded-xl border border-dashed border-border bg-surface text-center shadow-subtle">
          <Users className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-text-main mb-1">No People Records</h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto mb-4">
            Add an entry with just Name and Amount to track what people need to give you or what you need to give.
          </p>
          <button
            onClick={() => setShowAddPersonModal(true)}
            className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors"
          >
            Add First Entry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Section 1: Money People Need to Give Me */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <ArrowDownLeft className="w-4 h-4" />
                <span>Money People Need to Give Me</span>
              </h3>
              <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(totalMoneyPeopleNeedToGiveMe, currency)}
              </span>
            </div>

            {peopleWhoOweMe.length === 0 ? (
              <p className="text-xs text-text-muted py-4 text-center bg-surface border border-border rounded-xl">
                No one currently needs to give you money.
              </p>
            ) : (
              <div className="space-y-2.5">
                {peopleWhoOweMe.map(person => {
                  const personTxs = transactions.filter(t => t.personId === person.id && t.type === 'lend');

                  return (
                    <div
                      key={person.id}
                      className="p-3.5 rounded-xl border border-border bg-surface shadow-subtle space-y-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-text-main text-sm">{person.name}</div>
                          <span className="text-[11px] text-text-muted">Outstanding Receivable</span>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                              {formatCurrency(person.currentOwedToMe, currency)}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 border-l border-border pl-2.5">
                            <button
                              onClick={() => setSelectedPersonForRepayment({ person, mode: 'receive_from_them' })}
                              className="px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-[11px] font-medium border border-emerald-200 dark:border-emerald-900/40 hover:bg-emerald-100 transition-colors"
                              title="Record payment received"
                            >
                              Receive
                            </button>
                            <button
                              onClick={() => setEditingPerson(person)}
                              className="p-1 rounded text-text-muted hover:text-text-main hover:bg-surface-hover"
                              title="Edit"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePerson(person)}
                              className="p-1 rounded text-text-muted hover:text-rose-600 hover:bg-surface-hover"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Linked Lend Transactions with Working Checkboxes */}
                      {personTxs.length > 0 && (
                        <div className="pt-2 border-t border-border/60 space-y-1.5">
                          <span className="text-[10px] text-text-muted font-medium block uppercase tracking-wider">
                            Lend Transactions ({personTxs.length})
                          </span>
                          <div className="space-y-1">
                            {personTxs.map(tx => (
                              <div
                                key={tx.id}
                                className="flex items-center justify-between p-2 rounded-lg bg-surface-hover/30 border border-border/50 text-xs"
                              >
                                <div className="truncate mr-2">
                                  <span className="font-medium text-text-main">
                                    {tx.description || 'Lend Entry'}
                                  </span>
                                  <span className="text-[10px] text-text-muted ml-1.5 font-mono">
                                    {formatDate(tx.date, 'YYYY-MM-DD')}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                    {formatCurrency(tx.amount, currency)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSettlement(tx)}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                                      tx.isSettled
                                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40'
                                        : 'bg-surface text-text-muted hover:text-text-main border-border'
                                    }`}
                                    title={tx.isSettled ? 'Mark as Pending' : 'Mark as Completed'}
                                  >
                                    {tx.isSettled ? (
                                      <>
                                        <CheckSquare className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                        <span>☑ Completed</span>
                                      </>
                                    ) : (
                                      <>
                                        <Square className="w-3 h-3" />
                                        <span>☐ Pending</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Money I Need to Give */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <ArrowUpRight className="w-4 h-4" />
                <span>Money I Need to Give</span>
              </h3>
              <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                {formatCurrency(totalMoneyINeedToGive, currency)}
              </span>
            </div>

            {peopleIOwe.length === 0 ? (
              <p className="text-xs text-text-muted py-4 text-center bg-surface border border-border rounded-xl">
                You do not owe money to anyone.
              </p>
            ) : (
              <div className="space-y-2.5">
                {peopleIOwe.map(person => {
                  const personTxs = transactions.filter(t => t.personId === person.id && t.type === 'borrow');

                  return (
                    <div
                      key={person.id}
                      className="p-3.5 rounded-xl border border-border bg-surface shadow-subtle space-y-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-text-main text-sm">{person.name}</div>
                          <span className="text-[11px] text-text-muted">Outstanding Liability</span>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">
                              {formatCurrency(person.currentOwedToThem, currency)}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 border-l border-border pl-2.5">
                            <button
                              onClick={() => setSelectedPersonForRepayment({ person, mode: 'repay_them' })}
                              className="px-2 py-1 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-[11px] font-medium border border-amber-200 dark:border-amber-900/40 hover:bg-amber-100 transition-colors"
                              title="Record payment made"
                            >
                              Settle
                            </button>
                            <button
                              onClick={() => setEditingPerson(person)}
                              className="p-1 rounded text-text-muted hover:text-text-main hover:bg-surface-hover"
                              title="Edit"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePerson(person)}
                              className="p-1 rounded text-text-muted hover:text-rose-600 hover:bg-surface-hover"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Linked Borrow Transactions with Working Checkboxes */}
                      {personTxs.length > 0 && (
                        <div className="pt-2 border-t border-border/60 space-y-1.5">
                          <span className="text-[10px] text-text-muted font-medium block uppercase tracking-wider">
                            Borrow Transactions ({personTxs.length})
                          </span>
                          <div className="space-y-1">
                            {personTxs.map(tx => (
                              <div
                                key={tx.id}
                                className="flex items-center justify-between p-2 rounded-lg bg-surface-hover/30 border border-border/50 text-xs"
                              >
                                <div className="truncate mr-2">
                                  <span className="font-medium text-text-main">
                                    {tx.description || 'Borrow Entry'}
                                  </span>
                                  <span className="text-[10px] text-text-muted ml-1.5 font-mono">
                                    {formatDate(tx.date, 'YYYY-MM-DD')}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                                    {formatCurrency(tx.amount, currency)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSettlement(tx)}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                                      tx.isSettled
                                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40'
                                        : 'bg-surface text-text-muted hover:text-text-main border-border'
                                    }`}
                                    title={tx.isSettled ? 'Mark as Pending' : 'Mark as Completed'}
                                  >
                                    {tx.isSettled ? (
                                      <>
                                        <CheckSquare className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                        <span>☑ Completed</span>
                                      </>
                                    ) : (
                                      <>
                                        <Square className="w-3 h-3" />
                                        <span>☐ Pending</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Settled contacts if any */}
          {settledPeople.length > 0 && (
            <div className="lg:col-span-2 pt-2 border-t border-border">
              <span className="text-xs font-semibold text-text-muted block mb-2">Settled Contacts</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {settledPeople.map(p => (
                  <div key={p.id} className="p-2.5 rounded-lg border border-border bg-surface-hover/30 flex items-center justify-between text-xs">
                    <span className="font-medium text-text-main">{p.name}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingPerson(p)}
                        className="p-1 text-text-muted hover:text-text-main"
                        title="Edit"
                      >
                        <Edit className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeletePerson(p)}
                        className="p-1 text-text-muted hover:text-rose-600"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Simplified Add / Edit Person Modal */}
      {(showAddPersonModal || editingPerson) && (
        <AddPersonModal
          existingPerson={editingPerson}
          currency={currency}
          onClose={() => {
            setShowAddPersonModal(false);
            setEditingPerson(null);
          }}
          onSaved={() => {
            setFeedback(editingPerson ? 'Entry updated.' : 'Entry saved.');
            if (onRefreshData) onRefreshData();
            setTimeout(() => setFeedback(null), 3000);
          }}
        />
      )}

      {/* Record Repayment Modal */}
      {selectedPersonForRepayment && (
        <RecordDebtPaymentModal
          person={selectedPersonForRepayment.person}
          mode={selectedPersonForRepayment.mode}
          accounts={accounts}
          currency={currency}
          onClose={() => setSelectedPersonForRepayment(null)}
          onSaved={() => {
            setFeedback('Settlement recorded and synced to Journal.');
            if (onRefreshData) onRefreshData();
            setTimeout(() => setFeedback(null), 3000);
          }}
        />
      )}
    </div>
  );
};

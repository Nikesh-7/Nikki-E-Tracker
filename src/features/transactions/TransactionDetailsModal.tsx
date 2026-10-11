import React, { useState, useEffect } from 'react';
import { X, Calendar, Landmark, Coins, Edit, Trash2, ShieldCheck, User } from 'lucide-react';
import { Transaction, Account, Person, CurrencyConfig, AuditLog } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { formatDate } from '../../utils/date';
import { db } from '../../db';

interface TransactionDetailsModalProps {
  transaction: Transaction;
  accounts: Account[];
  people: Person[];
  currency: CurrencyConfig;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const TransactionDetailsModal: React.FC<TransactionDetailsModalProps> = ({
  transaction,
  accounts,
  people,
  currency,
  onClose,
  onEdit,
  onDelete
}) => {
  const [auditHistory, setAuditHistory] = useState<AuditLog[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const account = accounts.find(a => a.id === transaction.accountId);
  const toAccount = transaction.toAccountId ? accounts.find(a => a.id === transaction.toAccountId) : null;
  const person = transaction.personId ? people.find(p => p.id === transaction.personId) : null;

  useEffect(() => {
    async function loadAudit() {
      const logs = await db.auditLogs
        .where('entityId')
        .equals(transaction.id)
        .reverse()
        .sortBy('timestamp');
      setAuditHistory(logs);
    }
    loadAudit();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [transaction.id, onClose]);

  const getTypeBadge = (type: string) => {
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
        return 'text-purple-700 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200 dark:border-purple-900/40';
    }
  };

  const displayText = transaction.description || transaction.reason || 'Transaction';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-surface border border-border rounded-xl shadow-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-xs text-text-muted hover:text-text-main flex items-center gap-1 mr-2 px-1.5 py-1 rounded hover:bg-surface-hover"
              title="Return to previous list"
            >
              <span>← Back</span>
            </button>
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getTypeBadge(transaction.type)} capitalize`}>
              {transaction.type.replace('_', ' ')}
            </span>
            <span className="text-xs text-text-muted">ID: {transaction.id.slice(0, 10)}...</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Amount & Prominent Description */}
          <div className="text-center py-2 border-b border-border">
            <div className="text-2xl font-bold text-text-main font-mono">
              {formatCurrency(transaction.amount, currency, transaction.type === 'income')}
            </div>
            <h4 className="text-sm font-semibold text-text-main mt-1">{displayText}</h4>
          </div>

          {/* Key metadata grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-surface-hover/50 border border-border">
              <div className="text-[11px] text-text-muted mb-0.5">Account</div>
              <div className="font-medium text-text-main flex items-center gap-1.5">
                {account?.type === 'cash' ? (
                  <Coins className="w-3.5 h-3.5 text-accent" />
                ) : (
                  <Landmark className="w-3.5 h-3.5 text-accent" />
                )}
                <span>{account ? account.name : 'Unknown Account'}</span>
              </div>
            </div>

            {toAccount && (
              <div className="p-3 rounded-lg bg-surface-hover/50 border border-border">
                <div className="text-[11px] text-text-muted mb-0.5">Destination Account</div>
                <div className="font-medium text-text-main flex items-center gap-1.5">
                  {toAccount.type === 'cash' ? (
                    <Coins className="w-3.5 h-3.5 text-accent" />
                  ) : (
                    <Landmark className="w-3.5 h-3.5 text-accent" />
                  )}
                  <span>{toAccount.name}</span>
                </div>
              </div>
            )}

            <div className="p-3 rounded-lg bg-surface-hover/50 border border-border">
              <div className="text-[11px] text-text-muted mb-0.5">Date & Time</div>
              <div className="font-medium text-text-main flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-text-muted" />
                <span>{formatDate(transaction.date, 'YYYY-MM-DD', true)}</span>
              </div>
            </div>

            {person && (
              <div className="p-3 rounded-lg bg-surface-hover/50 border border-border">
                <div className="text-[11px] text-text-muted mb-0.5">
                  {transaction.type === 'lend' ? 'Money People Need to Give Me' : 'Money I Need to Give'}
                </div>
                <div className="font-medium text-text-main flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-accent" />
                  <span>{person.name}</span>
                </div>
              </div>
            )}

            {(transaction.type === 'lend' || transaction.type === 'borrow') && (
              <div className="p-3 rounded-lg bg-surface-hover/50 border border-border col-span-2 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-text-muted mb-0.5">Debt Settlement Status</div>
                  <div className="font-semibold text-xs text-text-main">
                    {transaction.isSettled ? '☑ Completed (Debt Settled)' : '☐ Pending (Outstanding Debt)'}
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                  transaction.isSettled 
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400' 
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400'
                }`}>
                  {transaction.isSettled ? 'Completed' : 'Pending'}
                </span>
              </div>
            )}
          </div>

          {/* Notes */}
          {transaction.notes && (
            <div className="p-3 rounded-lg bg-surface-hover/30 border border-border text-xs">
              <div className="text-[11px] text-text-muted mb-1 font-medium">Notes</div>
              <p className="text-text-main whitespace-pre-wrap">{transaction.notes}</p>
            </div>
          )}

          {/* Audit History */}
          <div className="pt-2 border-t border-border">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-text-main mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-accent" />
              <span>Audit History</span>
            </div>
            {auditHistory.length === 0 ? (
              <div className="text-[11px] text-text-muted">No modification log recorded yet.</div>
            ) : (
              <div className="space-y-1.5">
                {auditHistory.map(log => (
                  <div
                    key={log.id}
                    className="p-2 rounded bg-surface-hover/30 border border-border text-[11px] flex items-center justify-between"
                  >
                    <div>
                      <span className="font-semibold uppercase text-accent mr-1.5">{log.action}:</span>
                      <span className="text-text-muted">{log.details}</span>
                    </div>
                    <span className="text-[10px] text-text-muted shrink-0 ml-2 font-mono">
                      {formatDate(log.timestamp, 'YYYY-MM-DD', true)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 border-t border-border bg-surface-hover/20">
          {showDeleteConfirm ? (
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                Are you sure you want to delete this entry?
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-muted hover:text-text-main"
                >
                  Cancel
                </button>
                <button
                  onClick={onDelete}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-1.5 rounded-lg text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-muted hover:text-text-main hover:bg-surface-hover"
                >
                  Close
                </button>
                {transaction.type !== 'transfer' && onEdit && (
                  <button
                    onClick={onEdit}
                    className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover flex items-center gap-1.5 shadow-subtle"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

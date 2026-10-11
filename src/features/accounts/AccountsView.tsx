import React, { useState } from 'react';
import { 
  Plus, 
  Landmark, 
  Coins, 
  Edit, 
  Archive, 
  Trash2,
  CheckCircle2,
  AlertTriangle,
  X,
  History,
  ArrowLeft
} from 'lucide-react';
import { Account, CurrencyConfig, Transaction } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { AddAccountModal } from './AddAccountModal';
import { db } from '../../db';

interface AccountsViewProps {
  accounts: Account[];
  transactions: Transaction[];
  currency: CurrencyConfig;
  onOpenQuickAdd?: () => void;
  onRefreshData?: () => void;
  onBack?: () => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  accounts,
  transactions,
  currency,
  onRefreshData,
  onBack
}) => {
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'cash': return Coins;
      case 'bank':
      default: return Landmark;
    }
  };

  const handleToggleArchive = async (acc: Account) => {
    try {
      await db.accounts.update(acc.id, {
        isArchived: !acc.isArchived,
        updatedAt: new Date().toISOString()
      });
      setFeedback(`Account "${acc.name}" ${acc.isArchived ? 'unarchived' : 'archived'}.`);
      if (onRefreshData) onRefreshData();
      setTimeout(() => setFeedback(null), 3000);
    } catch {
      setFeedback('Error updating account.');
    }
  };

  const handlePermanentDelete = async (acc: Account) => {
    setIsDeleting(true);
    try {
      await db.accounts.delete(acc.id);
      setFeedback(`Account "${acc.name}" permanently deleted.`);
      setAccountToDelete(null);
      if (onRefreshData) onRefreshData();
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete account';
      setFeedback(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const displayedAccounts = accounts.filter(a => showArchived || !a.isArchived);

  // Group accounts: Bank Accounts and Physical Cash
  const bankAccounts = displayedAccounts.filter(a => a.type === 'bank' || (a.type !== 'cash' && a.type !== 'credit'));
  const cashAccounts = displayedAccounts.filter(a => a.type === 'cash');

  const totalBank = bankAccounts.reduce((sum, a) => sum + a.currentBalance, 0);
  const totalCash = cashAccounts.reduce((sum, a) => sum + a.currentBalance, 0);
  const totalAll = totalBank + totalCash;

  // Deletion safety check for selected account
  const accountTxCount = accountToDelete
    ? transactions.filter(t => t.accountId === accountToDelete.id || t.toAccountId === accountToDelete.id).length
    : 0;
  const accountHasBalance = accountToDelete ? accountToDelete.currentBalance !== 0 : false;
  const isDeletionBlocked = accountTxCount > 0 || accountHasBalance;

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && accountToDelete) {
        setAccountToDelete(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [accountToDelete]);

  return (
    <div className="space-y-6">
      {/* Header */}
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
            <h1 className="text-xl font-semibold text-text-main">Accounts</h1>
            <p className="text-xs text-text-muted">
              Manage your Physical Cash and Bank Accounts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`px-3 py-2 rounded-lg border border-border text-xs font-medium transition-colors ${
              showArchived ? 'bg-accent text-white' : 'bg-surface text-text-muted hover:text-text-main'
            }`}
          >
            {showArchived ? 'Hide Archived' : 'Show Archived'}
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors shadow-subtle"
          >
            <Plus className="w-4 h-4" />
            <span>Add Account</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 p-3 text-xs font-medium text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-900/40">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-surface border border-border shadow-subtle">
          <span className="text-xs text-text-muted font-medium">Physical Cash Balance</span>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {formatCurrency(totalCash, currency)}
          </div>
          <span className="text-[11px] text-text-muted mt-1 block">
            {cashAccounts.length} cash account{cashAccounts.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-border shadow-subtle">
          <span className="text-xs text-text-muted font-medium">Bank Account Balance</span>
          <div className="text-2xl font-bold font-mono text-accent mt-1">
            {formatCurrency(totalBank, currency)}
          </div>
          <span className="text-[11px] text-text-muted mt-1 block">
            {bankAccounts.length} bank account{bankAccounts.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-border shadow-subtle">
          <span className="text-xs text-text-muted font-medium">Total Balance</span>
          <div className="text-2xl font-bold font-mono text-text-main mt-1">
            {formatCurrency(totalAll, currency)}
          </div>
          <span className="text-[11px] text-text-muted mt-1 block">
            Combined cash and bank deposits
          </span>
        </div>
      </div>

      {/* Section 1: Bank Accounts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-main flex items-center gap-2">
            <Landmark className="w-4 h-4 text-accent" />
            <span>Bank Accounts</span>
          </h3>
          <span className="text-xs text-text-muted font-mono">{formatCurrency(totalBank, currency)}</span>
        </div>

        {bankAccounts.length === 0 ? (
          <div className="p-6 rounded-xl border border-dashed border-border bg-surface text-center text-xs text-text-muted">
            No bank accounts configured. Click "Add Account" to add one.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {bankAccounts.map(account => {
              const Icon = getAccountIcon(account.type);
              const txCount = transactions.filter(
                t => t.accountId === account.id || t.toAccountId === account.id
              ).length;

              return (
                <div
                  key={account.id}
                  className={`p-4 rounded-xl border bg-surface transition-all shadow-subtle ${
                    account.isArchived ? 'opacity-60 border-dashed border-border' : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-surface-hover border border-border text-text-muted">
                        <Icon className="w-4 h-4 text-accent" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-semibold text-text-main">{account.name}</h4>
                          {account.isArchived && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400">
                              Archived
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-text-muted uppercase tracking-wider font-mono">
                          Bank Account
                        </span>
                      </div>
                    </div>

                    {/* Actions: Edit, Archive, and Delete */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingAccount(account)}
                        title="Edit Account"
                        className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleArchive(account)}
                        title={account.isArchived ? 'Unarchive Account' : 'Archive Account'}
                        className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setAccountToDelete(account)}
                        title="Delete Account"
                        className="p-1.5 rounded-lg text-text-muted hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border flex items-baseline justify-between">
                    <span className="text-[11px] text-text-muted">Current Balance</span>
                    <div className="text-base font-bold font-mono text-text-main">
                      {formatCurrency(account.currentBalance, currency)}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-text-muted">
                    <span className="flex items-center gap-1">
                      <History className="w-3 h-3" />
                      <span>{txCount} transaction{txCount === 1 ? '' : 's'} recorded</span>
                    </span>
                  </div>

                  {account.notes && (
                    <p className="mt-2 text-[11px] text-text-muted line-clamp-1 italic">
                      {account.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: Physical Cash Accounts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-main flex items-center gap-2">
            <Coins className="w-4 h-4 text-accent" />
            <span>Physical Cash</span>
          </h3>
          <span className="text-xs text-text-muted font-mono">{formatCurrency(totalCash, currency)}</span>
        </div>

        {cashAccounts.length === 0 ? (
          <div className="p-6 rounded-xl border border-dashed border-border bg-surface text-center text-xs text-text-muted">
            No physical cash accounts configured. Click "Add Account" to add one.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {cashAccounts.map(account => {
              const Icon = getAccountIcon(account.type);
              const txCount = transactions.filter(
                t => t.accountId === account.id || t.toAccountId === account.id
              ).length;

              return (
                <div
                  key={account.id}
                  className={`p-4 rounded-xl border bg-surface transition-all shadow-subtle ${
                    account.isArchived ? 'opacity-60 border-dashed border-border' : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-surface-hover border border-border text-text-muted">
                        <Icon className="w-4 h-4 text-accent" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-semibold text-text-main">{account.name}</h4>
                          {account.isArchived && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400">
                              Archived
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-text-muted uppercase tracking-wider font-mono">
                          Physical Cash
                        </span>
                      </div>
                    </div>

                    {/* Actions: Edit, Archive, and Delete */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingAccount(account)}
                        title="Edit Account"
                        className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleArchive(account)}
                        title={account.isArchived ? 'Unarchive Account' : 'Archive Account'}
                        className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setAccountToDelete(account)}
                        title="Delete Account"
                        className="p-1.5 rounded-lg text-text-muted hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border flex items-baseline justify-between">
                    <span className="text-[11px] text-text-muted">Current Balance</span>
                    <div className="text-base font-bold font-mono text-text-main">
                      {formatCurrency(account.currentBalance, currency)}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-text-muted">
                    <span className="flex items-center gap-1">
                      <History className="w-3 h-3" />
                      <span>{txCount} transaction{txCount === 1 ? '' : 's'} recorded</span>
                    </span>
                  </div>

                  {account.notes && (
                    <p className="mt-2 text-[11px] text-text-muted line-clamp-1 italic">
                      {account.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Account Deletion Modal (Handles both Unsafe/Blocked and Safe Permanent Deletion) */}
      {accountToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface border border-border rounded-xl shadow-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`w-4 h-4 ${isDeletionBlocked ? 'text-amber-500' : 'text-rose-600'}`} />
                <h3 className="text-sm font-semibold text-text-main">
                  {isDeletionBlocked ? 'Deletion Blocked: Data Integrity' : 'Confirm Account Deletion'}
                </h3>
              </div>
              <button
                onClick={() => setAccountToDelete(null)}
                className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs text-text-main">
              {isDeletionBlocked ? (
                <>
                  <p className="font-semibold text-rose-600 dark:text-rose-400">
                    Cannot permanently delete "{accountToDelete.name}".
                  </p>
                  
                  <div className="p-3 rounded-lg bg-surface-hover/60 border border-border space-y-2 text-[11px]">
                    {accountHasBalance && (
                      <p className="text-text-main">
                        • <strong>Active Balance:</strong> This account has an outstanding balance of{' '}
                        <span className="font-mono font-bold text-accent">
                          {formatCurrency(accountToDelete.currentBalance, currency)}
                        </span>
                        . To protect your financial records, accounts with funds cannot be deleted.
                      </p>
                    )}
                    {accountTxCount > 0 && (
                      <p className="text-text-main">
                        • <strong>Historical Transactions:</strong> This account is linked to{' '}
                        <strong>{accountTxCount} recorded transaction(s)</strong>. Deleting it would orphan these records and corrupt your journal history.
                      </p>
                    )}
                  </div>

                  <div className="p-3 rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-[11px] text-blue-900 dark:text-blue-300">
                    <p className="font-semibold mb-0.5">Recommended Safe Alternative: Archive Account</p>
                    <p className="text-text-muted dark:text-blue-200/80">
                      Archiving preserves all your past transactions and reports, while removing this account from active dropdowns and new transaction entry.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                    <button
                      type="button"
                      onClick={() => setAccountToDelete(null)}
                      className="px-3 py-1.5 rounded-lg border border-border text-text-muted hover:text-text-main hover:bg-surface-hover"
                    >
                      Cancel
                    </button>
                    {!accountToDelete.isArchived && (
                      <button
                        type="button"
                        onClick={() => {
                          handleToggleArchive(accountToDelete);
                          setAccountToDelete(null);
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-accent text-white font-semibold hover:bg-accent-hover transition-colors"
                      >
                        Archive Account Instead
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <p>
                    Are you sure you want to permanently delete <strong>"{accountToDelete.name}"</strong>?
                  </p>
                  <p className="text-text-muted text-[11px]">
                    This account has zero balance and no linked transactions. This action cannot be undone.
                  </p>
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                    <button
                      type="button"
                      onClick={() => setAccountToDelete(null)}
                      className="px-3 py-1.5 rounded-lg border border-border text-text-muted hover:text-text-main hover:bg-surface-hover"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => handlePermanentDelete(accountToDelete)}
                      className="px-3.5 py-1.5 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700 transition-colors disabled:opacity-50"
                    >
                      {isDeleting ? 'Deleting...' : 'Delete Permanently'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {(showAddModal || editingAccount) && (
        <AddAccountModal
          existingAccount={editingAccount}
          currency={currency}
          allAccounts={accounts}
          onClose={() => {
            setShowAddModal(false);
            setEditingAccount(null);
          }}
          onSaved={() => {
            setFeedback(editingAccount ? 'Account updated.' : 'Account created.');
            if (onRefreshData) onRefreshData();
            setTimeout(() => setFeedback(null), 3000);
          }}
        />
      )}
    </div>
  );
};

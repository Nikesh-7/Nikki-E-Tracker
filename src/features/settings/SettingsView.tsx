import React, { useState } from 'react';
import { 
  Lock, 
  Palette, 
  DollarSign, 
  Download, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff,
  ShieldAlert,
  ArrowLeft
} from 'lucide-react';
import { 
  UserSettings, 
  Account, 
  CurrencyConfig, 
  TransactionType,
  DashboardCardConfig
} from '../../types';
import { verifyPin, hashPin, generateSalt } from '../../utils/security';
import { 
  downloadFullJSONBackup, 
  validateBackupJSON, 
  executeRestore, 
  resetDatabase,
  RestorePreview
} from '../../services/backup';
import { db } from '../../db';

interface SettingsViewProps {
  settings: UserSettings;
  accounts: Account[];
  theme: 'light' | 'dark' | 'system';
  setTheme: (t: 'light' | 'dark' | 'system') => void;
  onRefreshSettings: () => void;
  onRefreshData?: () => void;
  onLockApp: () => void;
  onBack?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  accounts,
  theme,
  setTheme,
  onRefreshSettings,
  onRefreshData,
  onLockApp,
  onBack
}) => {
  // Feedback states
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Change PIN Workflow state
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [showPins, setShowPins] = useState(false);
  const [isChangingPin, setIsChangingPin] = useState(false);

  // General Settings state - Default currency INR
  const [currencySymbol, setCurrencySymbol] = useState(settings.currency?.symbol || '₹');
  const [currencyCode, setCurrencyCode] = useState(settings.currency?.code || 'INR');
  const [decimalPlaces, setDecimalPlaces] = useState(settings.currency?.decimalPlaces ?? 2);
  const [inactivityMinutes, setInactivityMinutes] = useState(settings.inactivityLockMinutes);
  const [dateFormat, setDateFormat] = useState(settings.dateFormat);
  const [weekStartsOn, setWeekStartsOn] = useState(settings.weekStartsOn);
  const [defaultAccountId, setDefaultAccountId] = useState(settings.defaultAccountId);
  const [defaultType, setDefaultType] = useState<TransactionType>(
    (['expense', 'income', 'lend', 'borrow'] as TransactionType[]).includes(settings.defaultTransactionType)
      ? settings.defaultTransactionType
      : 'expense'
  );

  // Backup / Restore state
  const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Dashboard Cards ordering/visibility state
  const [cardsConfig] = useState<DashboardCardConfig[]>(settings.dashboardCards || []);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setErrorMsg(null);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setSuccessMsg(null);
  };

  // 1. PIN Change Handler
  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isChangingPin) return;

    if (!currentPin || !newPin || !confirmNewPin) {
      showError('Please fill in all PIN fields.');
      return;
    }

    if (newPin !== confirmNewPin) {
      showError('New PINs do not match.');
      return;
    }

    if (newPin.length < 4) {
      showError('New PIN must be at least 4 digits.');
      return;
    }

    setIsChangingPin(true);
    try {
      // Verify current PIN first
      const isCurrentValid = await verifyPin(currentPin, settings.pinSalt, settings.pinHash);
      if (!isCurrentValid) {
        showError('Current PIN is incorrect.');
        setIsChangingPin(false);
        return;
      }

      // Generate new salt and hash
      const newSalt = generateSalt();
      const newHash = await hashPin(newPin, newSalt);

      await db.settings.update(settings.id || 'primary_settings', {
        pinSalt: newSalt,
        pinHash: newHash
      });

      setCurrentPin('');
      setNewPin('');
      setConfirmNewPin('');
      showSuccess('PIN successfully changed!');
      onRefreshSettings();
    } catch {
      showError('Failed to change PIN.');
    } finally {
      setIsChangingPin(false);
    }
  };

  // 2. Preferences Save Handler
  const handleSavePreferences = async () => {
    try {
      const updatedCurrency: CurrencyConfig = {
        code: currencyCode.trim() || 'INR',
        symbol: currencySymbol.trim() || '₹',
        decimalPlaces: Number(decimalPlaces)
      };

      await db.settings.update(settings.id || 'primary_settings', {
        currency: updatedCurrency,
        inactivityLockMinutes: Number(inactivityMinutes),
        dateFormat,
        weekStartsOn: Number(weekStartsOn) as 0 | 1,
        defaultAccountId,
        defaultTransactionType: defaultType,
        dashboardCards: cardsConfig
      });

      showSuccess('Preferences saved successfully.');
      onRefreshSettings();
    } catch {
      showError('Failed to save preferences.');
    }
  };

  // 3. File Restore Handler
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      const preview = validateBackupJSON(content);
      if (!preview.valid) {
        showError(preview.error || 'Invalid backup file.');
        setRestorePreview(null);
      } else {
        setRestorePreview(preview);
        setErrorMsg(null);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmRestore = async () => {
    if (!restorePreview?.backupData) return;
    setIsRestoring(true);
    try {
      await executeRestore(restorePreview.backupData);
      setRestorePreview(null);
      showSuccess('Backup successfully restored! Refreshing records...');
      if (onRefreshData) onRefreshData();
      onRefreshSettings();
    } catch {
      showError('Restore failed. Please verify the backup file integrity.');
    } finally {
      setIsRestoring(false);
    }
  };

  // 4. Data Reset Handler
  const handleFactoryReset = async () => {
    try {
      await resetDatabase();
      localStorage.clear();
      window.location.reload();
    } catch {
      showError('Failed to reset database.');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl pb-12">
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
            <h1 className="text-xl font-semibold text-text-main">Settings & Preferences</h1>
            <p className="text-xs text-text-muted">
              Configure security, appearance, default currency, and offline backup
            </p>
          </div>
        </div>

        <button
          onClick={onLockApp}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
        >
          <Lock className="w-4 h-4" />
          <span>Lock Application Now</span>
        </button>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 p-3 text-xs font-medium text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-900/40">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 p-3 text-xs font-medium text-rose-600 bg-rose-50 dark:bg-rose-950/30 dark:text-rose-400 rounded-lg border border-rose-200 dark:border-rose-900/40">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Card 1: Appearance & Theme */}
      <div className="p-5 rounded-xl bg-surface border border-border shadow-subtle space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <Palette className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold text-text-main">Appearance & Theme</h3>
        </div>

        <div>
          <label className="block text-xs font-medium text-text-main mb-2">Display Mode</label>
          <div className="grid grid-cols-3 gap-2.5 max-w-sm">
            {(['light', 'dark', 'system'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setTheme(mode)}
                className={`py-2 px-3 rounded-lg text-xs font-medium border capitalize transition-all ${
                  theme === mode
                    ? 'bg-accent text-white border-accent shadow-subtle'
                    : 'bg-surface border-border text-text-muted hover:text-text-main hover:bg-surface-hover'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-text-muted mt-2 block">
            Saved locally. In system mode, adheres to your OS dark/light preference automatically.
          </span>
        </div>
      </div>

      {/* Card 2: Security & PIN Management */}
      <div className="p-5 rounded-xl bg-surface border border-border shadow-subtle space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <Lock className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold text-text-main">PIN Lock & Security</h3>
        </div>

        <form onSubmit={handleChangePin} className="space-y-3 max-w-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-main">Change Access PIN</span>
            <button
              type="button"
              onClick={() => setShowPins(!showPins)}
              className="text-[11px] text-accent font-medium hover:underline flex items-center gap-1"
            >
              {showPins ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              <span>{showPins ? 'Hide PINs' : 'Show PINs'}</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              Current PIN (initial default is 2510)
            </label>
            <input
              type={showPins ? 'text' : 'password'}
              inputMode="numeric"
              value={currentPin}
              onChange={e => setCurrentPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              required
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-main font-mono tracking-widest focus:outline-none focus:border-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">New PIN</label>
              <input
                type={showPins ? 'text' : 'password'}
                inputMode="numeric"
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                required
                className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-main font-mono tracking-widest focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Confirm New PIN</label>
              <input
                type={showPins ? 'text' : 'password'}
                inputMode="numeric"
                value={confirmNewPin}
                onChange={e => setConfirmNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                required
                className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-main font-mono tracking-widest focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isChangingPin}
            className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {isChangingPin ? 'Updating...' : 'Update PIN'}
          </button>
        </form>

        <div className="pt-3 border-t border-border">
          <label className="block text-xs font-medium text-text-main mb-1">
            Auto-Lock on Inactivity
          </label>
          <select
            value={inactivityMinutes}
            onChange={e => setInactivityMinutes(Number(e.target.value))}
            className="w-full max-w-xs px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-main focus:outline-none focus:border-accent"
          >
            <option value={1}>1 Minute</option>
            <option value={5}>5 Minutes (Default)</option>
            <option value={15}>15 Minutes</option>
            <option value={30}>30 Minutes</option>
            <option value={0}>Never (Manual Lock Only)</option>
          </select>
          <span className="text-[11px] text-text-muted mt-1 block">
            Locks after idle time or when browser tab is left backgrounded.
          </span>
        </div>
      </div>

      {/* Card 3: Currency & Formats */}
      <div className="p-5 rounded-xl bg-surface border border-border shadow-subtle space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <DollarSign className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold text-text-main">Currency & Localization</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-text-main mb-1">Currency Symbol</label>
            <input
              type="text"
              value={currencySymbol}
              onChange={e => setCurrencySymbol(e.target.value)}
              placeholder="₹"
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-main focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-main mb-1">Currency Code</label>
            <input
              type="text"
              value={currencyCode}
              onChange={e => setCurrencyCode(e.target.value.toUpperCase())}
              placeholder="INR"
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-main focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-main mb-1">Decimal Places</label>
            <select
              value={decimalPlaces}
              onChange={e => setDecimalPlaces(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-main focus:outline-none focus:border-accent"
            >
              <option value={2}>2 (e.g. ₹10.50)</option>
              <option value={0}>0 (e.g. ₹1050)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div>
            <label className="block text-xs font-medium text-text-main mb-1">Date Format</label>
            <select
              value={dateFormat}
              onChange={e => setDateFormat(e.target.value as any)}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-main focus:outline-none focus:border-accent"
            >
              <option value="YYYY-MM-DD">YYYY-MM-DD (2026-10-11)</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY (11/10/2026)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY (10/11/2026)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-main mb-1">Week Starts On</label>
            <select
              value={weekStartsOn}
              onChange={e => setWeekStartsOn(Number(e.target.value) as 0 | 1)}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-main focus:outline-none focus:border-accent"
            >
              <option value={0}>Sunday</option>
              <option value={1}>Monday</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-main mb-1">Default Transaction Type</label>
            <select
              value={defaultType}
              onChange={e => setDefaultType(e.target.value as TransactionType)}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-main focus:outline-none focus:border-accent capitalize"
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="lend">Lend</option>
              <option value="borrow">Borrow</option>
            </select>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={handleSavePreferences}
            className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors"
          >
            Save Preferences
          </button>
        </div>
      </div>

      {/* Card 4: Offline Backup, Restore & CSV */}
      <div className="p-5 rounded-xl bg-surface border border-border shadow-subtle space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <Download className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold text-text-main">Data Backup & Restore</h3>
        </div>

        <p className="text-xs text-text-muted leading-relaxed">
          Your data is stored completely offline inside your browser's IndexedDB. Export a full JSON backup regularly to keep your financial records secure across devices.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          {/* Download JSON Backup */}
          <button
            type="button"
            onClick={downloadFullJSONBackup}
            className="px-4 py-2.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover flex items-center gap-1.5 shadow-subtle"
          >
            <Download className="w-4 h-4" />
            <span>Download JSON Backup</span>
          </button>

          {/* Restore JSON Backup Button (File input) */}
          <label className="px-4 py-2.5 rounded-lg border border-border bg-surface text-text-main text-xs font-semibold hover:bg-surface-hover cursor-pointer flex items-center gap-1.5 transition-colors">
            <Upload className="w-4 h-4 text-text-muted" />
            <span>Select JSON File to Restore</span>
            <input
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        </div>

        {/* Restore Preview Confirmation Modal / Box */}
        {restorePreview && (
          <div className="p-4 rounded-xl border border-accent bg-accent-subtle space-y-3 mt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-accent">Valid Backup File Detected</span>
              <span className="text-[11px] text-text-muted font-mono">{restorePreview.exportedAt}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded bg-surface border border-border">
                <div className="text-[10px] text-text-muted">Accounts</div>
                <div className="font-bold text-text-main">{restorePreview.accountsCount}</div>
              </div>
              <div className="p-2 rounded bg-surface border border-border">
                <div className="text-[10px] text-text-muted">Transactions</div>
                <div className="font-bold text-text-main">{restorePreview.transactionsCount}</div>
              </div>
              <div className="p-2 rounded bg-surface border border-border">
                <div className="text-[10px] text-text-muted">People / Debts</div>
                <div className="font-bold text-text-main">{restorePreview.peopleCount}</div>
              </div>
            </div>

            <p className="text-[11px] text-text-muted">
              Restoring will replace your current records with this backup file safely within a transaction.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRestorePreview(null)}
                className="px-3 py-1.5 rounded-lg border border-border bg-surface text-xs text-text-muted hover:text-text-main"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={isRestoring}
                className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover disabled:opacity-50"
              >
                {isRestoring ? 'Restoring...' : 'Confirm and Restore Data'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Card 5: Danger Zone - Reset Database */}
      <div className="p-5 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/20 dark:bg-rose-950/10 space-y-3">
        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
          <ShieldAlert className="w-4 h-4" />
          <h3 className="text-sm font-semibold">Danger Zone</h3>
        </div>

        <p className="text-xs text-text-muted">
          Permanently delete all transactions, accounts, and debts from this device.
        </p>

        {showResetConfirm ? (
          <div className="flex items-center gap-3 pt-2">
            <span className="text-xs font-semibold text-rose-600">Are you absolutely sure?</span>
            <button
              onClick={() => setShowResetConfirm(false)}
              className="px-3 py-1.5 rounded-lg border border-border bg-surface text-xs text-text-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleFactoryReset}
              className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700"
            >
              Yes, Reset Everything
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="px-4 py-2 rounded-lg border border-rose-300 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-100 dark:hover:bg-rose-950/40 transition-colors"
          >
            Clear and Reset Database
          </button>
        )}
      </div>
    </div>
  );
};

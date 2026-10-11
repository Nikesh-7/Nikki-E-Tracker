import { db } from '../db';
import { 
  Account, 
  Transaction, 
  Category, 
  Person, 
  Budget, 
  SavingsGoal, 
  RecurringBill, 
  UserSettings 
} from '../types';
import { formatCurrency } from '../utils/currency';
import { formatDate } from '../utils/date';

export interface BackupData {
  version: 1;
  appName: 'PersonalFinanceTracker' | 'NikkisETracker';
  exportedAt: string;
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  people: Person[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
  recurringBills: RecurringBill[];
  settings?: UserSettings;
}

/**
 * Generates and downloads a CSV file containing all filtered or total transactions.
 */
export async function exportTransactionsToCSV(
  transactions: Transaction[],
  accounts: Account[],
  categories: Category[],
  people: Person[]
): Promise<void> {
  const accountMap = new Map(accounts.map(a => [a.id, a.name]));
  const categoryMap = new Map(categories.map(c => [c.id, c.name]));
  const personMap = new Map(people.map(p => [p.id, p.name]));

  const headers = [
    'Date & Time',
    'Type',
    'Reason',
    'Description',
    'Category',
    'Account',
    'Destination Account',
    'Person / Counterparty',
    'Payment Method',
    'Amount (Formatted)',
    'Amount (Cents)',
    'Tags',
    'Notes'
  ];

  const escapeCSV = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = transactions.map(tx => {
    const accName = accountMap.get(tx.accountId) || tx.accountId;
    const toAccName = tx.toAccountId ? (accountMap.get(tx.toAccountId) || tx.toAccountId) : '';
    const catName = tx.categoryId ? (categoryMap.get(tx.categoryId) || tx.categoryId) : '';
    const personName = tx.personId ? (personMap.get(tx.personId) || tx.personId) : '';

    return [
      escapeCSV(formatDate(tx.date, 'YYYY-MM-DD', true)),
      escapeCSV(tx.type),
      escapeCSV(tx.reason),
      escapeCSV(tx.description),
      escapeCSV(catName),
      escapeCSV(accName),
      escapeCSV(toAccName),
      escapeCSV(personName),
      escapeCSV(tx.paymentMethod || ''),
      escapeCSV(formatCurrency(tx.amount)),
      escapeCSV(tx.amount),
      escapeCSV(tx.tags ? tx.tags.join('; ') : ''),
      escapeCSV(tx.notes || '')
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `financial-journal-${formatDate(new Date(), 'YYYY-MM-DD')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Creates a complete JSON backup of all tables.
 */
export async function createFullJSONBackup(): Promise<string> {
  const [
    accounts,
    transactions,
    categories,
    people,
    budgets,
    savingsGoals,
    recurringBills,
    settingsList
  ] = await Promise.all([
    db.accounts.toArray(),
    db.transactions.toArray(),
    db.categories.toArray(),
    db.people.toArray(),
    db.budgets.toArray(),
    db.savingsGoals.toArray(),
    db.recurringBills.toArray(),
    db.settings.toArray()
  ]);

  const backup: BackupData = {
    version: 1,
    appName: 'NikkisETracker',
    exportedAt: new Date().toISOString(),
    accounts,
    transactions,
    categories,
    people,
    budgets,
    savingsGoals,
    recurringBills,
    settings: settingsList[0]
  };

  return JSON.stringify(backup, null, 2);
}

/**
 * Triggers a download of the full JSON backup.
 */
export async function downloadFullJSONBackup(): Promise<void> {
  const json = await createFullJSONBackup();
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `nikkis-etracker-backup-${formatDate(new Date(), 'YYYY-MM-DD')}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface RestorePreview {
  valid: boolean;
  error?: string;
  exportedAt?: string;
  accountsCount: number;
  transactionsCount: number;
  categoriesCount: number;
  peopleCount: number;
  budgetsCount: number;
  savingsGoalsCount: number;
  recurringBillsCount: number;
  backupData?: BackupData;
}

/**
 * Validates a JSON backup string and provides an import preview.
 */
export function validateBackupJSON(jsonString: string): RestorePreview {
  try {
    const data = JSON.parse(jsonString) as BackupData;
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'File is not a valid JSON object', accountsCount: 0, transactionsCount: 0, categoriesCount: 0, peopleCount: 0, budgetsCount: 0, savingsGoalsCount: 0, recurringBillsCount: 0 };
    }

    const isValidApp = data.appName === 'NikkisETracker' || data.appName === 'PersonalFinanceTracker' || (data as any).appName === 'Nikkis E&Tracker';
    if (!isValidApp || data.version !== 1) {
      return { valid: false, error: 'Incompatible or unrecognized backup format.', accountsCount: 0, transactionsCount: 0, categoriesCount: 0, peopleCount: 0, budgetsCount: 0, savingsGoalsCount: 0, recurringBillsCount: 0 };
    }

    if (!Array.isArray(data.accounts) || !Array.isArray(data.transactions)) {
      return { valid: false, error: 'Backup is missing required accounts or transactions lists.', accountsCount: 0, transactionsCount: 0, categoriesCount: 0, peopleCount: 0, budgetsCount: 0, savingsGoalsCount: 0, recurringBillsCount: 0 };
    }

    return {
      valid: true,
      exportedAt: data.exportedAt,
      accountsCount: data.accounts.length,
      transactionsCount: data.transactions.length,
      categoriesCount: Array.isArray(data.categories) ? data.categories.length : 0,
      peopleCount: Array.isArray(data.people) ? data.people.length : 0,
      budgetsCount: Array.isArray(data.budgets) ? data.budgets.length : 0,
      savingsGoalsCount: Array.isArray(data.savingsGoals) ? data.savingsGoals.length : 0,
      recurringBillsCount: Array.isArray(data.recurringBills) ? data.recurringBills.length : 0,
      backupData: data
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'JSON parse error';
    return { valid: false, error: `Malformed JSON file: ${msg}`, accountsCount: 0, transactionsCount: 0, categoriesCount: 0, peopleCount: 0, budgetsCount: 0, savingsGoalsCount: 0, recurringBillsCount: 0 };
  }
}

/**
 * Restores data from a validated backup.
 * Overwrites existing records safely inside a transaction.
 */
export async function executeRestore(backup: BackupData): Promise<void> {
  await db.transaction('rw', [
    db.accounts,
    db.transactions,
    db.categories,
    db.people,
    db.budgets,
    db.savingsGoals,
    db.recurringBills,
    db.settings,
    db.auditLogs
  ], async () => {
    await Promise.all([
      db.accounts.clear(),
      db.transactions.clear(),
      db.categories.clear(),
      db.people.clear(),
      db.budgets.clear(),
      db.savingsGoals.clear(),
      db.recurringBills.clear(),
      db.settings.clear()
    ]);

    if (backup.accounts?.length) await db.accounts.bulkAdd(backup.accounts);
    if (backup.transactions?.length) await db.transactions.bulkAdd(backup.transactions);
    if (backup.categories?.length) await db.categories.bulkAdd(backup.categories);
    if (backup.people?.length) await db.people.bulkAdd(backup.people);
    if (backup.budgets?.length) await db.budgets.bulkAdd(backup.budgets);
    if (backup.savingsGoals?.length) await db.savingsGoals.bulkAdd(backup.savingsGoals);
    if (backup.recurringBills?.length) await db.recurringBills.bulkAdd(backup.recurringBills);
    if (backup.settings) await db.settings.add(backup.settings);

    await db.auditLogs.add({
      id: 'aud_restore_' + Date.now(),
      entityType: 'settings',
      entityId: 'backup_restore',
      action: 'update',
      timestamp: new Date().toISOString(),
      details: `Database restored from backup dated ${backup.exportedAt}. Restored ${backup.transactions.length} transactions.`
    });
  });
}

/**
 * Resets the database to a clean initial state.
 */
export async function resetDatabase(): Promise<void> {
  await db.transaction('rw', [
    db.accounts,
    db.transactions,
    db.categories,
    db.people,
    db.budgets,
    db.savingsGoals,
    db.recurringBills,
    db.settings,
    db.auditLogs
  ], async () => {
    await Promise.all([
      db.accounts.clear(),
      db.transactions.clear(),
      db.categories.clear(),
      db.people.clear(),
      db.budgets.clear(),
      db.savingsGoals.clear(),
      db.recurringBills.clear(),
      db.settings.clear(),
      db.auditLogs.clear()
    ]);
  });
}

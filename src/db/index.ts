import Dexie, { type EntityTable } from 'dexie';
import { 
  Account, 
  Transaction, 
  Category, 
  Person, 
  Budget, 
  SavingsGoal, 
  RecurringBill, 
  AuditLog, 
  UserSettings,
  DashboardCardConfig
} from '../types';
import { createInitialPinCredentials } from '../utils/security';
import { DEFAULT_CURRENCY } from '../utils/currency';

export const DEFAULT_DASHBOARD_CARDS: DashboardCardConfig[] = [
  { id: 'balance_summary', label: 'Cash & Bank Balances', visible: true, order: 1 },
  { id: 'debt_summary', label: 'People & Debts', visible: true, order: 2 },
  { id: 'cashflow_summary', label: 'Income & Expenses', visible: true, order: 3 },
  { id: 'quick_add', label: 'Quick Transaction Entry', visible: true, order: 4 },
  { id: 'recent_transactions', label: 'Recent Journal Entries', visible: true, order: 5 },
];

export class FinanceTrackerDB extends Dexie {
  accounts!: EntityTable<Account, 'id'>;
  transactions!: EntityTable<Transaction, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  people!: EntityTable<Person, 'id'>;
  budgets!: EntityTable<Budget, 'id'>;
  savingsGoals!: EntityTable<SavingsGoal, 'id'>;
  recurringBills!: EntityTable<RecurringBill, 'id'>;
  auditLogs!: EntityTable<AuditLog, 'id'>;
  settings!: EntityTable<UserSettings, 'id'>;

  constructor() {
    super('FinanceTrackerDB');

    // Schema: Preserves all existing tables for zero data loss / backwards compatibility
    this.version(1).stores({
      accounts: 'id, name, type, isArchived, createdAt',
      transactions: 'id, date, type, accountId, toAccountId, categoryId, personId, createdAt',
      categories: 'id, name, type, isCustom',
      people: 'id, name, createdAt',
      budgets: 'id, categoryId',
      savingsGoals: 'id, name, createdAt',
      recurringBills: 'id, name, nextDueDate, isActive',
      auditLogs: 'id, entityType, entityId, timestamp',
      settings: 'id'
    });
  }
}

export const db = new FinanceTrackerDB();

/**
 * Initializes database with default accounts (Cash and Bank only) and INR currency.
 * Safely preserves existing data if database already exists.
 */
export async function initializeDatabase(): Promise<void> {
  const settingsCount = await db.settings.count();

  if (settingsCount === 0) {
    const { salt, hash } = await createInitialPinCredentials();

    const defaultBankId = 'acc_bank_default';
    const defaultCashId = 'acc_cash_default';

    const now = new Date().toISOString();

    // 1. Seed Accounts: Physical Cash and Bank Account ONLY
    const defaultAccounts: Account[] = [
      {
        id: defaultBankId,
        name: 'Bank Account',
        type: 'bank',
        openingBalance: 5000000, // ₹50,000.00
        currentBalance: 5000000,
        currency: 'INR',
        notes: 'Primary bank account',
        isArchived: false,
        createdAt: now,
        updatedAt: now
      },
      {
        id: defaultCashId,
        name: 'Physical Cash',
        type: 'cash',
        openingBalance: 500000, // ₹5,000.00
        currentBalance: 500000,
        currency: 'INR',
        notes: 'Physical cash on hand',
        isArchived: false,
        createdAt: now,
        updatedAt: now
      }
    ];

    await db.accounts.bulkAdd(defaultAccounts);

    // 2. Seed Default Settings with INR
    const defaultSettings: UserSettings = {
      id: 'primary_settings',
      theme: 'system',
      pinSalt: salt,
      pinHash: hash,
      inactivityLockMinutes: 5,
      currency: DEFAULT_CURRENCY,
      dateFormat: 'YYYY-MM-DD',
      weekStartsOn: 0,
      defaultAccountId: defaultBankId,
      defaultTransactionType: 'expense',
      dashboardCards: DEFAULT_DASHBOARD_CARDS,
      isConfigured: true,
    };

    await db.settings.add(defaultSettings);
  } else {
    // Migration check: Ensure default currency is INR if previously was USD
    const existingSettings = await db.settings.get('primary_settings');
    if (existingSettings && (!existingSettings.currency || existingSettings.currency.code === 'USD')) {
      await db.settings.update('primary_settings', {
        currency: DEFAULT_CURRENCY
      });
    }
  }
}

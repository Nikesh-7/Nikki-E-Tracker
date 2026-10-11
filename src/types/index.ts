export type AccountType = 
  | 'cash' 
  | 'bank' 
  // Historical types retained for data preservation
  | 'credit' 
  | 'debit' 
  | 'savings' 
  | 'investment' 
  | 'other';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  openingBalance: number; // in minor units (paise)
  currentBalance: number; // in minor units
  currency: string;
  notes?: string;
  linkedBankAccountId?: string;
  creditLimit?: number;
  billingCycleDay?: number;
  paymentDueDay?: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AllowedTransactionType = 
  | 'expense'
  | 'income'
  | 'lend'
  | 'borrow';

export type TransactionType =
  // EXACTLY 4 allowed transaction types for new transactions
  | AllowedTransactionType
  // Historical legacy types retained strictly for backward compatibility
  | 'transfer'
  | 'other'
  | 'debt_repayment'
  | 'repayment_received'
  | 'credit_card_payment'
  | 'refund';

export interface Transaction {
  id: string;
  date: string; // ISO 8601 string: YYYY-MM-DDTHH:mm:ss
  type: TransactionType;
  amount: number; // positive integer in minor units (paise)
  description?: string; // primary optional descriptive field
  reason?: string; // legacy field, kept for historical display
  categoryId?: string;
  accountId: string; // primary account (Physical Cash or Bank Account)
  toAccountId?: string; // destination account for transfers
  personId?: string; // for lend and borrow
  otherDirection?: 'in' | 'out'; // for 'other' type: explicit money in or money out
  paymentMethod?: string;
  tags?: string[];
  notes?: string;
  runningBalance?: number;
  isSettled?: boolean; // false/undefined = Pending, true = Completed (for Lend and Borrow)
  settledAt?: string;  // ISO timestamp when marked completed
  isReversal?: boolean;
  originalTransactionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'expense' | 'income';
  icon: string;
  color: string;
  isCustom: boolean;
  monthlyBudget?: number;
}

export interface Person {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  totalBorrowed: number; // cumulative ever borrowed from them (minor units)
  totalLent: number;     // cumulative ever lent to them (minor units)
  currentOwedToThem: number; // "Money I Need to Give" (minor units)
  currentOwedToMe: number;   // "Money People Need to Give Me" (minor units)
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  categoryId?: string;
  monthlyLimit: number;
  warningThresholdPercent: number;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  notes?: string;
  linkedAccountId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringBill {
  id: string;
  name: string;
  amount: number;
  categoryId: string;
  accountId: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  nextDueDate: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  entityType: 'transaction' | 'account' | 'person' | 'settings';
  entityId: string;
  action: 'create' | 'update' | 'delete';
  timestamp: string;
  details: string;
  previousState?: unknown;
  newState?: unknown;
}

export interface DashboardCardConfig {
  id: string;
  label: string;
  visible: boolean;
  order: number;
}

export interface CurrencyConfig {
  code: string;
  symbol: string;
  decimalPlaces: number;
}

export interface UserSettings {
  id?: string;
  theme: 'light' | 'dark' | 'system';
  pinSalt: string;
  pinHash: string;
  inactivityLockMinutes: number; // 0 = disabled, 1, 5, 15, 30
  currency: CurrencyConfig;
  dateFormat: 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY';
  weekStartsOn: 0 | 1; // 0 = Sunday, 1 = Monday
  defaultAccountId: string;
  defaultTransactionType: TransactionType;
  dashboardCards: DashboardCardConfig[];
  isConfigured: boolean;
}

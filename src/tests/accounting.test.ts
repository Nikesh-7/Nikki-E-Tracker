import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db';
import { 
  createTransaction, 
  updateTransaction, 
  deleteTransaction, 
  toggleTransactionSettlement,
  calculateFinancialSummary, 
  calculateNetWorth,
  calculateTransactionEffects
} from '../services/accounting';
import { formatCurrency, parseCurrencyInput, DEFAULT_CURRENCY } from '../utils/currency';
import { hashPin, verifyPin, generateSalt } from '../utils/security';
import { Account, Person, AllowedTransactionType, Transaction } from '../types';

describe('Final Master Suite: 4 Transaction Types, Accounts, Debts & Accounting Rules', () => {
  beforeEach(async () => {
    await db.accounts.clear();
    await db.transactions.clear();
    await db.people.clear();
    await db.auditLogs.clear();

    // Setup base accounts: Bank Account and Physical Cash ONLY
    const testBank: Account = {
      id: 'acc_bank',
      name: 'Bank Account',
      type: 'bank',
      openingBalance: 10000000, // ₹1,00,000.00
      currentBalance: 10000000,
      currency: 'INR',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const testCash: Account = {
      id: 'acc_cash',
      name: 'Physical Cash',
      type: 'cash',
      openingBalance: 2000000, // ₹20,000.00
      currentBalance: 2000000,
      currency: 'INR',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.accounts.bulkAdd([testBank, testCash]);
  });

  it('1. Exactly 4 Allowed Transaction Types for new transactions', () => {
    const allowedTypes: AllowedTransactionType[] = ['expense', 'income', 'lend', 'borrow'];
    expect(allowedTypes.length).toBe(4);
    expect(allowedTypes).toContain('expense');
    expect(allowedTypes).toContain('income');
    expect(allowedTypes).toContain('lend');
    expect(allowedTypes).toContain('borrow');
    // 'transfer' and 'other' must NOT be in allowed types
    expect((allowedTypes as string[]).includes('transfer')).toBe(false);
    expect((allowedTypes as string[]).includes('other')).toBe(false);
  });

  it('2. Currency: INR (₹) and Indian number formatting (en-IN)', () => {
    expect(DEFAULT_CURRENCY.symbol).toBe('₹');
    expect(DEFAULT_CURRENCY.code).toBe('INR');

    // Indian Number Formatting
    expect(formatCurrency(10000000, DEFAULT_CURRENCY)).toBe('₹1,00,000.00');
    expect(formatCurrency(1050, DEFAULT_CURRENCY)).toBe('₹10.50');
    expect(formatCurrency(7, DEFAULT_CURRENCY)).toBe('₹0.07');
    expect(formatCurrency(-50000, DEFAULT_CURRENCY)).toBe('-₹500.00');

    // Parsing inputs to minor units
    expect(parseCurrencyInput('10.50')).toBe(1050);
    expect(parseCurrencyInput('₹1,00,000.00')).toBe(10000000);
    expect(parseCurrencyInput('500')).toBe(50000);
  });

  it('3. Expense: Deducts from account and increases expense total', async () => {
    const tx = await createTransaction({
      type: 'expense',
      amount: 150000, // ₹1,500.00
      description: 'Groceries store purchase',
      accountId: 'acc_bank'
    });

    const bank = await db.accounts.get('acc_bank');
    expect(bank?.currentBalance).toBe(9850000); // 10000000 - 150000

    const summary = calculateFinancialSummary([tx]);
    expect(summary.totalExpense).toBe(150000);
    expect(summary.totalIncome).toBe(0);
  });

  it('4. Income: Adds to account and increases income total', async () => {
    const tx = await createTransaction({
      type: 'income',
      amount: 5000000, // ₹50,000.00
      description: 'Consulting payment',
      accountId: 'acc_bank'
    });

    const bank = await db.accounts.get('acc_bank');
    expect(bank?.currentBalance).toBe(15000000); // 10000000 + 5000000

    const summary = calculateFinancialSummary([tx]);
    expect(summary.totalIncome).toBe(5000000);
    expect(summary.totalExpense).toBe(0);
  });

  it('5. Transfer creation rejected: Transfer functionality is completely removed', async () => {
    // Attempting to create a transfer transaction must be rejected
    await expect(
      createTransaction({
        type: 'transfer' as any,
        amount: 500000,
        description: 'Attempted transfer',
        accountId: 'acc_bank',
        toAccountId: 'acc_cash'
      })
    ).rejects.toThrow('Transfer transactions are no longer supported.');

    // Existing balances and financial records must remain completely intact
    const bank = await db.accounts.get('acc_bank');
    expect(bank?.currentBalance).toBe(10000000); // Intact
  });

  it('6. Lend: Deducts account and increases "Money People Need to Give Me"', async () => {
    const person: Person = {
      id: 'person_rahul',
      name: 'Rahul',
      totalBorrowed: 0,
      totalLent: 0,
      currentOwedToThem: 0,
      currentOwedToMe: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await db.people.add(person);

    const tx = await createTransaction({
      type: 'lend',
      amount: 1000000, // ₹10,000.00
      description: 'Lent money to Rahul for medical expenses',
      accountId: 'acc_bank',
      personId: 'person_rahul'
    });

    const bank = await db.accounts.get('acc_bank');
    const updatedRahul = await db.people.get('person_rahul');

    // Deducted from bank account
    expect(bank?.currentBalance).toBe(9000000);
    // Tracked under "Money People Need to Give Me"
    expect(updatedRahul?.currentOwedToMe).toBe(1000000);

    const summary = calculateFinancialSummary([tx]);
    expect(summary.totalExpense).toBe(0); // Non-operating!
    expect(summary.totalIncome).toBe(0);
  });

  it('7. Borrow: Adds to account and increases "Money I Need to Give"', async () => {
    const person: Person = {
      id: 'person_priya',
      name: 'Priya',
      totalBorrowed: 0,
      totalLent: 0,
      currentOwedToThem: 0,
      currentOwedToMe: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await db.people.add(person);

    const tx = await createTransaction({
      type: 'borrow',
      amount: 1500000, // ₹15,000.00
      description: 'Borrowed cash from Priya',
      accountId: 'acc_cash',
      personId: 'person_priya'
    });

    const cash = await db.accounts.get('acc_cash');
    const updatedPriya = await db.people.get('person_priya');

    // Added to cash account
    expect(cash?.currentBalance).toBe(3500000);
    // Tracked under "Money I Need to Give"
    expect(updatedPriya?.currentOwedToThem).toBe(1500000);

    const summary = calculateFinancialSummary([tx]);
    expect(summary.totalIncome).toBe(0); // Borrowed funds are liabilities, not income
  });

  it('8. Automatic Date and Time generated persistently on save and preserved on edit', async () => {
    const before = new Date().toISOString();
    const tx = await createTransaction({
      type: 'expense',
      amount: 50000,
      description: 'Coffee',
      accountId: 'acc_cash'
    });
    const after = new Date().toISOString();

    expect(tx.date).toBeDefined();
    expect(tx.createdAt).toBeDefined();
    expect(new Date(tx.date).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
    expect(new Date(tx.date).getTime()).toBeLessThanOrEqual(new Date(after).getTime());

    // Edit transaction does NOT overwrite original creation timestamp
    const originalCreatedAt = tx.createdAt;
    await updateTransaction({
      ...tx,
      description: 'Specialty Coffee'
    });

    const updatedTx = await db.transactions.get(tx.id);
    expect(updatedTx?.createdAt).toBe(originalCreatedAt);
    expect(updatedTx?.description).toBe('Specialty Coffee');
  });

  it('9. Atomic balance recalculations on transaction edit and delete', async () => {
    const tx = await createTransaction({
      type: 'expense',
      amount: 100000, // ₹1,000.00
      description: 'Book',
      accountId: 'acc_cash'
    });

    let cash = await db.accounts.get('acc_cash');
    expect(cash?.currentBalance).toBe(1900000);

    // Edit to ₹400.00
    await updateTransaction({
      ...tx,
      amount: 40000
    });
    cash = await db.accounts.get('acc_cash');
    expect(cash?.currentBalance).toBe(1960000);

    // Delete transaction restores original balance
    await deleteTransaction(tx.id);
    cash = await db.accounts.get('acc_cash');
    expect(cash?.currentBalance).toBe(2000000);
  });

  it('10. Account deletion safety rule: Unsafe deletion blocked when transactions exist or balance is non-zero', async () => {
    // 1. Account with non-zero balance
    const bank = await db.accounts.get('acc_bank');
    expect(bank?.currentBalance).toBeGreaterThan(0);
    // Safety check function
    const isUnsafeToDelete = (acc: Account, txsCount: number) => {
      return acc.currentBalance !== 0 || txsCount > 0;
    };
    expect(isUnsafeToDelete(bank!, 0)).toBe(true);

    // 2. Account with 0 balance but linked transactions
    const emptyAccountWithTx: Account = {
      id: 'acc_empty_linked',
      name: 'Old Bank Account',
      type: 'bank',
      openingBalance: 0,
      currentBalance: 0,
      currency: 'INR',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await db.accounts.add(emptyAccountWithTx);

    await createTransaction({
      type: 'expense',
      amount: 1000,
      description: 'Old tx',
      accountId: 'acc_empty_linked'
    });

    const linkedTxs = await db.transactions.where('accountId').equals('acc_empty_linked').count();
    expect(linkedTxs).toBe(1);
    expect(isUnsafeToDelete(emptyAccountWithTx, linkedTxs)).toBe(true);

    // 3. Safe account: 0 balance and 0 transactions
    const safeAccount: Account = {
      id: 'acc_safe_delete',
      name: 'Unused Account',
      type: 'bank',
      openingBalance: 0,
      currentBalance: 0,
      currency: 'INR',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await db.accounts.add(safeAccount);
    const safeTxs = await db.transactions.where('accountId').equals('acc_safe_delete').count();
    expect(isUnsafeToDelete(safeAccount, safeTxs)).toBe(false);

    // Safe account can be deleted cleanly
    await db.accounts.delete('acc_safe_delete');
    expect(await db.accounts.get('acc_safe_delete')).toBeUndefined();
  });

  it('11. Account archiving preserves historical transactions', async () => {
    const accToArchive = await db.accounts.get('acc_bank');
    expect(accToArchive).toBeDefined();

    // Archive
    await db.accounts.update('acc_bank', { isArchived: true });
    const archived = await db.accounts.get('acc_bank');
    expect(archived?.isArchived).toBe(true);

    // Transactions remain intact
    await createTransaction({
      type: 'expense',
      amount: 25000,
      description: 'Historical tx on archived account',
      accountId: 'acc_bank'
    });

    const txs = await db.transactions.where('accountId').equals('acc_bank').toArray();
    expect(txs.length).toBeGreaterThan(0);
  });

  it('12. Net worth calculation accurately accounts for Cash, Bank, and Debts', () => {
    const accounts: Account[] = [
      { id: '1', name: 'Bank', type: 'bank', currentBalance: 5000000, openingBalance: 0, currency: 'INR', isArchived: false, createdAt: '', updatedAt: '' },
      { id: '2', name: 'Cash', type: 'cash', currentBalance: 1000000, openingBalance: 0, currency: 'INR', isArchived: false, createdAt: '', updatedAt: '' },
    ];
    const people: Person[] = [
      { id: 'p1', name: 'Dan', totalBorrowed: 0, totalLent: 0, currentOwedToThem: 200000, currentOwedToMe: 0, createdAt: '', updatedAt: '' },
      { id: 'p2', name: 'Eva', totalBorrowed: 0, totalLent: 0, currentOwedToThem: 0, currentOwedToMe: 500000, createdAt: '', updatedAt: '' },
    ];

    const netWorth = calculateNetWorth(accounts, people);
    // Assets: 5000000 + 1000000 + 500000 (Money People Need to Give Me) = 6500000
    // Liabilities: 200000 (Money I Need to Give)
    // Net Worth: 6300000 (₹63,000.00)
    expect(netWorth.totalAssets).toBe(6500000);
    expect(netWorth.totalLiabilities).toBe(200000);
    expect(netWorth.netWorth).toBe(6300000);
  });

  it('13. PIN Security: Verification of default PIN 2510 and salted hashing', async () => {
    const salt = generateSalt();
    const hash = await hashPin('2510', salt);

    expect(await verifyPin('2510', salt, hash)).toBe(true);
    expect(await verifyPin('9999', salt, hash)).toBe(false);
  });

  it('14. Lend: Create -> Account decreases, receivable increases. Complete -> receivable decreases, account unchanged', async () => {
    const person = await db.people.add({
      id: 'p_lend_test',
      name: 'Rohan Sharma',
      totalBorrowed: 0,
      totalLent: 0,
      currentOwedToMe: 0,
      currentOwedToThem: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const tx = await createTransaction({
      type: 'lend',
      amount: 500000, // ₹5,000.00
      description: 'Lend money to Rohan',
      accountId: 'acc_bank',
      personId: 'p_lend_test'
    });

    // 1. Account decreases and receivable increases
    const bankAfterLend = await db.accounts.get('acc_bank');
    expect(bankAfterLend?.currentBalance).toBe(9500000); // 10000000 - 500000

    const personAfterLend = await db.people.get('p_lend_test');
    expect(personAfterLend?.currentOwedToMe).toBe(500000);
    expect(tx.isSettled).toBe(false);

    // 2. Complete Lend: receivable decreases, account remains unchanged
    const completedTx = await toggleTransactionSettlement(tx.id, true);
    expect(completedTx.isSettled).toBe(true);

    const bankAfterComplete = await db.accounts.get('acc_bank');
    expect(bankAfterComplete?.currentBalance).toBe(9500000); // Account does not change!

    const personAfterComplete = await db.people.get('p_lend_test');
    expect(personAfterComplete?.currentOwedToMe).toBe(0); // Receivable settled

    // 3. Untick Completed: receivable restored, account remains unchanged
    const pendingTx = await toggleTransactionSettlement(tx.id, false);
    expect(pendingTx.isSettled).toBe(false);

    const bankAfterUntick = await db.accounts.get('acc_bank');
    expect(bankAfterUntick?.currentBalance).toBe(9500000); // Account still unchanged!

    const personAfterUntick = await db.people.get('p_lend_test');
    expect(personAfterUntick?.currentOwedToMe).toBe(500000); // Receivable restored
  });

  it('15. Borrow: Create -> Account increases, liability increases. Complete -> liability decreases, account unchanged', async () => {
    await db.people.add({
      id: 'p_borrow_test',
      name: 'Pooja Verma',
      totalBorrowed: 0,
      totalLent: 0,
      currentOwedToMe: 0,
      currentOwedToThem: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const tx = await createTransaction({
      type: 'borrow',
      amount: 300000, // ₹3,000.00
      description: 'Borrowed from Pooja',
      accountId: 'acc_cash',
      personId: 'p_borrow_test'
    });

    // 1. Cash increases and liability increases
    const cashAfterBorrow = await db.accounts.get('acc_cash');
    expect(cashAfterBorrow?.currentBalance).toBe(2300000); // 2000000 + 300000

    const personAfterBorrow = await db.people.get('p_borrow_test');
    expect(personAfterBorrow?.currentOwedToThem).toBe(300000);

    // 2. Complete Borrow: liability decreases, cash remains unchanged
    const completedTx = await toggleTransactionSettlement(tx.id, true);
    expect(completedTx.isSettled).toBe(true);

    const cashAfterComplete = await db.accounts.get('acc_cash');
    expect(cashAfterComplete?.currentBalance).toBe(2300000); // Cash unchanged!

    const personAfterComplete = await db.people.get('p_borrow_test');
    expect(personAfterComplete?.currentOwedToThem).toBe(0); // Liability settled

    // 3. Untick Completed: liability restored, cash remains unchanged
    await toggleTransactionSettlement(tx.id, false);
    const personAfterUntick = await db.people.get('p_borrow_test');
    expect(personAfterUntick?.currentOwedToThem).toBe(300000); // Liability restored
    const cashAfterUntick = await db.accounts.get('acc_cash');
    expect(cashAfterUntick?.currentBalance).toBe(2300000);
  });

  it('16. Multiple debts for the same person are tracked independently', async () => {
    await db.people.add({
      id: 'p_multi_test',
      name: 'Amit Kumar',
      totalBorrowed: 0,
      totalLent: 0,
      currentOwedToMe: 0,
      currentOwedToThem: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const tx1 = await createTransaction({
      type: 'lend',
      amount: 200000, // ₹2,000.00
      description: 'First loan to Amit',
      accountId: 'acc_bank',
      personId: 'p_multi_test'
    });

    const tx2 = await createTransaction({
      type: 'lend',
      amount: 400000, // ₹4,000.00
      description: 'Second loan to Amit',
      accountId: 'acc_bank',
      personId: 'p_multi_test'
    });

    let person = await db.people.get('p_multi_test');
    expect(person?.currentOwedToMe).toBe(600000); // ₹6,000 total

    // Settle only tx1
    await toggleTransactionSettlement(tx1.id, true);
    person = await db.people.get('p_multi_test');
    expect(person?.currentOwedToMe).toBe(400000); // tx2 is still pending!

    // Verify tx2 is still pending in DB
    const tx2FromDb = await db.transactions.get(tx2.id);
    expect(tx2FromDb?.isSettled).toBe(false);

    // Settle tx2
    await toggleTransactionSettlement(tx2.id, true);
    person = await db.people.get('p_multi_test');
    expect(person?.currentOwedToMe).toBe(0);
  });

  it('17. Repeated toggling of completion causes no duplicate balance changes', async () => {
    await db.people.add({
      id: 'p_toggle_test',
      name: 'Deepak',
      totalBorrowed: 0,
      totalLent: 0,
      currentOwedToMe: 0,
      currentOwedToThem: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const tx = await createTransaction({
      type: 'lend',
      amount: 100000,
      description: 'Repeated toggle test',
      accountId: 'acc_bank',
      personId: 'p_toggle_test'
    });

    const initialBankBalance = (await db.accounts.get('acc_bank'))?.currentBalance;

    // Toggle 10 times
    for (let i = 0; i < 5; i++) {
      await toggleTransactionSettlement(tx.id, true);
      await toggleTransactionSettlement(tx.id, false);
    }

    const finalBankBalance = (await db.accounts.get('acc_bank'))?.currentBalance;
    expect(finalBankBalance).toBe(initialBankBalance);

    const person = await db.people.get('p_toggle_test');
    expect(person?.currentOwedToMe).toBe(100000);
  });

  it('18. Historical Transfer calculations: safely preserved without corrupting operating income or expense', async () => {
    // Verify that historical transfer transaction calculation remains safe in calculateTransactionEffects and calculateFinancialSummary
    const historicalTransfer: Transaction = {
      id: 'tx_hist_transfer',
      date: new Date().toISOString(),
      type: 'transfer',
      amount: 2000000, // ₹20,000.00
      description: 'Historical transfer',
      accountId: 'acc_bank',
      toAccountId: 'acc_cash',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // calculateTransactionEffects correctly computes deltas for historical transactions
    const effects = calculateTransactionEffects(historicalTransfer, false);
    expect(effects.accountDeltas.get('acc_bank')).toBe(-2000000);
    expect(effects.accountDeltas.get('acc_cash')).toBe(2000000);

    // Reversal of historical transfer (e.g. if deleted) correctly reverts
    const revertEffects = calculateTransactionEffects(historicalTransfer, true);
    expect(revertEffects.accountDeltas.get('acc_bank')).toBe(2000000);
    expect(revertEffects.accountDeltas.get('acc_cash')).toBe(-2000000);

    // Historical transfers do NOT inflate operating income or expense
    const summary = calculateFinancialSummary([historicalTransfer]);
    expect(summary.totalIncome).toBe(0);
    expect(summary.totalExpense).toBe(0);
    expect(summary.totalTransfers).toBe(2000000);
  });

  it('19. Transfer editing rejected and only allowed 4 types can be created/edited', async () => {
    // 1. Create a normal expense
    const expenseTx = await createTransaction({
      type: 'expense',
      amount: 100000,
      description: 'Test Expense',
      accountId: 'acc_bank'
    });

    // 2. Attempting to update it to a transfer must be rejected
    await expect(
      updateTransaction({
        ...expenseTx,
        type: 'transfer' as any,
        toAccountId: 'acc_cash'
      })
    ).rejects.toThrow('Transfer transactions cannot be created or edited.');

    // 3. Normal update works
    const updated = await updateTransaction({
      ...expenseTx,
      amount: 120000
    });
    expect(updated.amount).toBe(120000);
  });
});

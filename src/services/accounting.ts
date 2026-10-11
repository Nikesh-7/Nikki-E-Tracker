import { db } from '../db';
import { Transaction, Account, Person, AuditLog } from '../types';
import { toISODateTimeString } from '../utils/date';

export interface FinancialEffect {
  accountDeltas: Map<string, number>; // accountId -> delta to currentBalance
  personOwedToThemDelta?: { personId: string; delta: number };
  personOwedToMeDelta?: { personId: string; delta: number };
}

/**
 * Calculates the balance impact of a single transaction on accounts and people.
 * All amounts are integer minor units (paise).
 */
export function calculateTransactionEffects(
  tx: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> | Transaction,
  isReversion: boolean = false
): FinancialEffect {
  const multiplier = isReversion ? -1 : 1;
  const amount = tx.amount;
  const accountDeltas = new Map<string, number>();

  let personOwedToThemDelta: { personId: string; delta: number } | undefined;
  let personOwedToMeDelta: { personId: string; delta: number } | undefined;

  switch (tx.type) {
    case 'expense':
      // Source account decreases
      accountDeltas.set(tx.accountId, -amount * multiplier);
      break;

    case 'income':
      // Destination account increases
      accountDeltas.set(tx.accountId, amount * multiplier);
      break;

    case 'transfer':
      // Source account decreases, destination account increases
      accountDeltas.set(tx.accountId, -amount * multiplier);
      if (tx.toAccountId) {
        accountDeltas.set(tx.toAccountId, amount * multiplier);
      }
      break;

    case 'lend':
      // Account decreases, "Money People Need to Give Me" increases (only if pending)
      accountDeltas.set(tx.accountId, -amount * multiplier);
      if (tx.personId && !tx.isSettled) {
        personOwedToMeDelta = { personId: tx.personId, delta: amount * multiplier };
      }
      break;

    case 'borrow':
      // Account increases, "Money I Need to Give" increases (only if pending)
      accountDeltas.set(tx.accountId, amount * multiplier);
      if (tx.personId && !tx.isSettled) {
        personOwedToThemDelta = { personId: tx.personId, delta: amount * multiplier };
      }
      break;

    case 'other':
      // Other: user explicitly selects Money In or Money Out
      if (tx.otherDirection === 'in') {
        accountDeltas.set(tx.accountId, amount * multiplier);
      } else {
        accountDeltas.set(tx.accountId, -amount * multiplier);
      }
      break;

    // Backward-compatible handling for historical transaction types
    case 'credit_card_payment':
      accountDeltas.set(tx.accountId, -amount * multiplier);
      if (tx.toAccountId) {
        accountDeltas.set(tx.toAccountId, -amount * multiplier);
      }
      break;

    case 'debt_repayment':
      accountDeltas.set(tx.accountId, -amount * multiplier);
      if (tx.personId) {
        personOwedToThemDelta = { personId: tx.personId, delta: -amount * multiplier };
      }
      break;

    case 'repayment_received':
      accountDeltas.set(tx.accountId, amount * multiplier);
      if (tx.personId) {
        personOwedToMeDelta = { personId: tx.personId, delta: -amount * multiplier };
      }
      break;

    case 'refund':
      accountDeltas.set(tx.accountId, amount * multiplier);
      break;

    default:
      break;
  }

  return { accountDeltas, personOwedToThemDelta, personOwedToMeDelta };
}

/**
 * Executes a new transaction atomically within a Dexie transaction.
 * Date and time are assigned automatically using current local time if not supplied.
 */
export async function createTransaction(
  txData: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'date'> & { date?: string }
): Promise<Transaction> {
  const now = new Date().toISOString();
  const txId = 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

  // Transfers are no longer supported
  if (txData.type === 'transfer') {
    throw new Error('Transfer transactions are no longer supported.');
  }

  // Auto-generate date and time if not explicitly provided
  const txDate = txData.date || toISODateTimeString(new Date());
  const description = txData.description?.trim() || txData.reason?.trim() || `${txData.type.charAt(0).toUpperCase() + txData.type.slice(1)}`;

  const newTx: Transaction = {
    ...txData,
    date: txDate,
    description,
    reason: txData.reason?.trim() || description,
    isSettled: txData.isSettled ?? false,
    id: txId,
    createdAt: now,
    updatedAt: now,
  };

  const effects = calculateTransactionEffects(newTx, false);

  await db.transaction('rw', [db.transactions, db.accounts, db.people, db.auditLogs], async () => {
    // 1. Update Accounts
    for (const [accId, delta] of effects.accountDeltas.entries()) {
      const account = await db.accounts.get(accId);
      if (account) {
        const updatedBalance = account.currentBalance + delta;
        await db.accounts.update(accId, {
          currentBalance: updatedBalance,
          updatedAt: now
        });
      }
    }

    // 2. Update People
    if (effects.personOwedToThemDelta) {
      const { personId, delta } = effects.personOwedToThemDelta;
      const person = await db.people.get(personId);
      if (person) {
        const newOwedToThem = Math.max(0, person.currentOwedToThem + delta);
        const newTotalBorrowed = delta > 0 ? person.totalBorrowed + delta : person.totalBorrowed;
        await db.people.update(personId, {
          currentOwedToThem: newOwedToThem,
          totalBorrowed: newTotalBorrowed,
          updatedAt: now
        });
      }
    }

    if (effects.personOwedToMeDelta) {
      const { personId, delta } = effects.personOwedToMeDelta;
      const person = await db.people.get(personId);
      if (person) {
        const newOwedToMe = Math.max(0, person.currentOwedToMe + delta);
        const newTotalLent = delta > 0 ? person.totalLent + delta : person.totalLent;
        await db.people.update(personId, {
          currentOwedToMe: newOwedToMe,
          totalLent: newTotalLent,
          updatedAt: now
        });
      }
    }

    // 3. Save Transaction
    await db.transactions.add(newTx);

    // 4. Log Audit
    const audit: AuditLog = {
      id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      entityType: 'transaction',
      entityId: txId,
      action: 'create',
      timestamp: now,
      details: `Created ${newTx.type} transaction for amount ${newTx.amount}: ${newTx.description}`,
      newState: newTx
    };
    await db.auditLogs.add(audit);
  });

  return newTx;
}

/**
 * Updates an existing transaction atomically.
 * Preserves the original creation timestamp (`createdAt`).
 */
export async function updateTransaction(
  updatedTxData: Transaction
): Promise<Transaction> {
  const now = new Date().toISOString();
  const txId = updatedTxData.id;

  const existingTx = await db.transactions.get(txId);
  if (!existingTx) {
    throw new Error(`Transaction ${txId} not found`);
  }

  // Transfers are no longer supported
  if (updatedTxData.type === 'transfer') {
    throw new Error('Transfer transactions cannot be created or edited.');
  }

  const revertEffects = calculateTransactionEffects(existingTx, true);
  const applyEffects = calculateTransactionEffects(updatedTxData, false);

  const finalTx: Transaction = {
    ...updatedTxData,
    createdAt: existingTx.createdAt, // Preserve original creation timestamp
    updatedAt: now
  };

  await db.transaction('rw', [db.transactions, db.accounts, db.people, db.auditLogs], async () => {
    // 1. Revert Old Accounts
    for (const [accId, delta] of revertEffects.accountDeltas.entries()) {
      const account = await db.accounts.get(accId);
      if (account) {
        await db.accounts.update(accId, {
          currentBalance: account.currentBalance + delta,
          updatedAt: now
        });
      }
    }

    // 2. Revert Old People
    if (revertEffects.personOwedToThemDelta) {
      const { personId, delta } = revertEffects.personOwedToThemDelta;
      const person = await db.people.get(personId);
      if (person) {
        await db.people.update(personId, {
          currentOwedToThem: Math.max(0, person.currentOwedToThem + delta),
          updatedAt: now
        });
      }
    }

    if (revertEffects.personOwedToMeDelta) {
      const { personId, delta } = revertEffects.personOwedToMeDelta;
      const person = await db.people.get(personId);
      if (person) {
        await db.people.update(personId, {
          currentOwedToMe: Math.max(0, person.currentOwedToMe + delta),
          updatedAt: now
        });
      }
    }

    // 3. Apply New Accounts
    for (const [accId, delta] of applyEffects.accountDeltas.entries()) {
      const account = await db.accounts.get(accId);
      if (account) {
        await db.accounts.update(accId, {
          currentBalance: account.currentBalance + delta,
          updatedAt: now
        });
      }
    }

    // 4. Apply New People
    if (applyEffects.personOwedToThemDelta) {
      const { personId, delta } = applyEffects.personOwedToThemDelta;
      const person = await db.people.get(personId);
      if (person) {
        await db.people.update(personId, {
          currentOwedToThem: Math.max(0, person.currentOwedToThem + delta),
          updatedAt: now
        });
      }
    }

    if (applyEffects.personOwedToMeDelta) {
      const { personId, delta } = applyEffects.personOwedToMeDelta;
      const person = await db.people.get(personId);
      if (person) {
        await db.people.update(personId, {
          currentOwedToMe: Math.max(0, person.currentOwedToMe + delta),
          updatedAt: now
        });
      }
    }

    // 5. Update Transaction
    await db.transactions.put(finalTx);

    // 6. Log Audit
    const audit: AuditLog = {
      id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      entityType: 'transaction',
      entityId: txId,
      action: 'update',
      timestamp: now,
      details: `Updated transaction ${txId}. Description: ${finalTx.description}`,
      previousState: existingTx,
      newState: finalTx
    };
    await db.auditLogs.add(audit);
  });

  return finalTx;
}

/**
 * Deletes a transaction atomically, reverting all affected balances.
 */
export async function deleteTransaction(txId: string): Promise<void> {
  const now = new Date().toISOString();
  const existingTx = await db.transactions.get(txId);
  if (!existingTx) {
    return;
  }

  const revertEffects = calculateTransactionEffects(existingTx, true);

  await db.transaction('rw', [db.transactions, db.accounts, db.people, db.auditLogs], async () => {
    // 1. Revert Accounts
    for (const [accId, delta] of revertEffects.accountDeltas.entries()) {
      const account = await db.accounts.get(accId);
      if (account) {
        await db.accounts.update(accId, {
          currentBalance: account.currentBalance + delta,
          updatedAt: now
        });
      }
    }

    // 2. Revert People
    if (revertEffects.personOwedToThemDelta) {
      const { personId, delta } = revertEffects.personOwedToThemDelta;
      const person = await db.people.get(personId);
      if (person) {
        await db.people.update(personId, {
          currentOwedToThem: Math.max(0, person.currentOwedToThem + delta),
          updatedAt: now
        });
      }
    }

    if (revertEffects.personOwedToMeDelta) {
      const { personId, delta } = revertEffects.personOwedToMeDelta;
      const person = await db.people.get(personId);
      if (person) {
        await db.people.update(personId, {
          currentOwedToMe: Math.max(0, person.currentOwedToMe + delta),
          updatedAt: now
        });
      }
    }

    // 3. Delete Transaction
    await db.transactions.delete(txId);

    // 4. Log Audit
    const audit: AuditLog = {
      id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      entityType: 'transaction',
      entityId: txId,
      action: 'delete',
      timestamp: now,
      details: `Deleted ${existingTx.type} transaction for amount ${existingTx.amount}: ${existingTx.description || existingTx.reason}`,
      previousState: existingTx
    };
    await db.auditLogs.add(audit);
  });
}

/**
 * Financial metrics aggregator for any list of transactions.
 * Strict definitions:
 * - Operating Income = Sum of type 'income' + 'other' (money in)
 * - Operating Expenses = Sum of type 'expense' + 'other' (money out) - 'refund'
 * - Net Cash Flow = Operating Income - Operating Expenses
 * - Transfers, Lend, and Borrow do NOT affect Operating Income or Operating Expense.
 */
export function calculateFinancialSummary(transactions: Transaction[]) {
  let totalIncome = 0;
  let totalExpense = 0;
  let totalTransfers = 0;
  let totalBorrowed = 0;
  let totalLent = 0;

  for (const tx of transactions) {
    switch (tx.type) {
      case 'income':
        totalIncome += tx.amount;
        break;
      case 'expense':
        totalExpense += tx.amount;
        break;
      case 'other':
        if (tx.otherDirection === 'in') {
          totalIncome += tx.amount;
        } else {
          totalExpense += tx.amount;
        }
        break;
      case 'refund':
        totalExpense = Math.max(0, totalExpense - tx.amount);
        break;
      case 'transfer':
        totalTransfers += tx.amount;
        break;
      case 'borrow':
        totalBorrowed += tx.amount;
        break;
      case 'lend':
        totalLent += tx.amount;
        break;
      default:
        break;
    }
  }

  const netCashFlow = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.max(0, Math.round(((totalIncome - totalExpense) / totalIncome) * 100)) : 0;

  return {
    totalIncome,
    totalExpense,
    netCashFlow,
    savingsRate,
    totalTransfers,
    totalBorrowed,
    totalLent,
  };
}

/**
 * Calculates Net Worth based on Physical Cash, Bank accounts, and People balances.
 * Assets = Physical Cash + Bank Accounts + Money People Need to Give Me
 * Liabilities = Money I Need to Give
 * Net Worth = Assets - Liabilities
 */
export function calculateNetWorth(accounts: Account[], people: Person[]) {
  let liquidAssets = 0;
  let creditLiabilities = 0;

  for (const acc of accounts) {
    if (acc.isArchived) continue;
    if (acc.type === 'credit') {
      creditLiabilities += Math.max(0, acc.currentBalance);
    } else {
      liquidAssets += acc.currentBalance;
    }
  }

  let moneyINeedToGive = 0; // Liabilities
  let moneyPeopleNeedToGiveMe = 0; // Receivables

  for (const p of people) {
    moneyINeedToGive += p.currentOwedToThem;
    moneyPeopleNeedToGiveMe += p.currentOwedToMe;
  }

  const totalAssets = liquidAssets + moneyPeopleNeedToGiveMe;
  const totalLiabilities = creditLiabilities + moneyINeedToGive;
  const netWorth = totalAssets - totalLiabilities;

  return {
    liquidAssets,
    moneyINeedToGive,
    moneyPeopleNeedToGiveMe,
    totalAssets,
    totalLiabilities,
    netWorth,
  };
}

/**
 * Toggles the settlement (completion) status of a Lend or Borrow transaction.
 * - When marked Completed (isSettled: true):
 *   - Removes the amount from the person's outstanding receivable/liability.
 *   - Does NOT add or deduct money from the account balance (prevents double cash counting).
 * - When marked Pending (isSettled: false):
 *   - Restores the amount to the person's outstanding receivable/liability.
 *   - Does NOT alter account cash balances.
 * - Updates transaction status atomically in IndexedDB.
 */
export async function toggleTransactionSettlement(
  txId: string,
  isSettled: boolean
): Promise<Transaction> {
  const existingTx = await db.transactions.get(txId);
  if (!existingTx) {
    throw new Error(`Transaction ${txId} not found`);
  }

  if (existingTx.type !== 'lend' && existingTx.type !== 'borrow') {
    return existingTx;
  }

  // Idempotent: prevent duplicate calls and redundant math
  if (Boolean(existingTx.isSettled) === isSettled) {
    return existingTx;
  }

  const now = new Date().toISOString();
  const personId = existingTx.personId;
  const amount = existingTx.amount;

  await db.transaction('rw', [db.transactions, db.people, db.auditLogs], async () => {
    if (personId) {
      const person = await db.people.get(personId);
      if (person) {
        if (existingTx.type === 'lend') {
          // Completed: reduce currentOwedToMe; Pending: restore currentOwedToMe
          const delta = isSettled ? -amount : amount;
          const newOwedToMe = Math.max(0, person.currentOwedToMe + delta);
          await db.people.update(personId, {
            currentOwedToMe: newOwedToMe,
            updatedAt: now
          });
        } else if (existingTx.type === 'borrow') {
          // Completed: reduce currentOwedToThem; Pending: restore currentOwedToThem
          const delta = isSettled ? -amount : amount;
          const newOwedToThem = Math.max(0, person.currentOwedToThem + delta);
          await db.people.update(personId, {
            currentOwedToThem: newOwedToThem,
            updatedAt: now
          });
        }
      }
    }

    await db.transactions.update(txId, {
      isSettled,
      settledAt: isSettled ? now : undefined,
      updatedAt: now
    });

    await db.auditLogs.add({
      id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      entityType: 'transaction',
      entityId: txId,
      action: 'update',
      timestamp: now,
      details: `${existingTx.type.toUpperCase()} transaction ${txId} marked ${isSettled ? 'Completed' : 'Pending'}. Amount: ${amount}`
    });
  });

  const updatedTx = await db.transactions.get(txId);
  return updatedTx!;
}


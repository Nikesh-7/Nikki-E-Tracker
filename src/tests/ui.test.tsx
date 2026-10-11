import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { LockScreen } from '../features/security/LockScreen';
import { generateSalt, hashPin } from '../utils/security';

describe('LockScreen Component UI Tests', () => {
  it('renders clean PIN lock screen without exposing secret PIN', async () => {
    const salt = generateSalt();
    const hash = await hashPin('2510', salt);
    const unlockMock = vi.fn();
    const toggleThemeMock = vi.fn();

    render(
      <LockScreen
        pinSalt={salt}
        pinHash={hash}
        onUnlock={unlockMock}
        theme="dark"
        onToggleTheme={toggleThemeMock}
      />
    );

    expect(screen.getByText('Nikkis E&Tracker')).toBeTruthy();
    expect(screen.getByText('Enter PIN to unlock your private records')).toBeTruthy();

    // Keypad numbers 0-9 should be present
    for (let i = 0; i <= 9; i++) {
      expect(screen.getByRole('button', { name: String(i) })).toBeTruthy();
    }

    // Correct PIN is never in DOM text
    expect(screen.queryByText('2510')).toBeNull();
  });

  it('rejects incorrect PIN with clear error feedback', async () => {
    const salt = generateSalt();
    const hash = await hashPin('2510', salt);
    const unlockMock = vi.fn();

    render(
      <LockScreen
        pinSalt={salt}
        pinHash={hash}
        onUnlock={unlockMock}
        theme="light"
        onToggleTheme={() => {}}
      />
    );

    // Enter wrong PIN: 9999
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '9' }));
      fireEvent.click(screen.getByRole('button', { name: '9' }));
      fireEvent.click(screen.getByRole('button', { name: '9' }));
      fireEvent.click(screen.getByRole('button', { name: '9' }));
    });

    // Wait for async hash verification
    const errorAlert = await screen.findByText(/Incorrect PIN/i);
    expect(errorAlert).toBeTruthy();
    expect(unlockMock).not.toHaveBeenCalled();
  });

  it('unlocks application when correct initial PIN 2510 is entered', async () => {
    const salt = generateSalt();
    const hash = await hashPin('2510', salt);
    const unlockMock = vi.fn();

    render(
      <LockScreen
        pinSalt={salt}
        pinHash={hash}
        onUnlock={unlockMock}
        theme="light"
        onToggleTheme={() => {}}
      />
    );

    // Enter 2510 wrapped in act
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '2' }));
      fireEvent.click(screen.getByRole('button', { name: '5' }));
      fireEvent.click(screen.getByRole('button', { name: '1' }));
      fireEvent.click(screen.getByRole('button', { name: '0' }));
    });

    // After 4th digit, automatic verify triggers
    await vi.waitFor(() => {
      expect(unlockMock).toHaveBeenCalledTimes(1);
    });
  });
});

describe('QuickAddForm (No Transfer) & Home Recent Transactions UI Tests', () => {
  const dummyAccounts = [
    {
      id: 'acc_bank',
      name: 'Bank Account 1',
      type: 'bank' as const,
      openingBalance: 1000000,
      currentBalance: 1000000,
      currency: 'INR',
      isArchived: false,
      createdAt: '',
      updatedAt: ''
    },
    {
      id: 'acc_bank_2',
      name: 'Bank Account 2',
      type: 'bank' as const,
      openingBalance: 500000,
      currentBalance: 500000,
      currency: 'INR',
      isArchived: false,
      createdAt: '',
      updatedAt: ''
    },
    {
      id: 'acc_cash',
      name: 'Physical Cash 1',
      type: 'cash' as const,
      openingBalance: 200000,
      currentBalance: 200000,
      currency: 'INR',
      isArchived: false,
      createdAt: '',
      updatedAt: ''
    },
    {
      id: 'acc_cash_2',
      name: 'Physical Cash 2',
      type: 'cash' as const,
      openingBalance: 100000,
      currentBalance: 100000,
      currency: 'INR',
      isArchived: false,
      createdAt: '',
      updatedAt: ''
    }
  ];

  it('QuickAddForm contains exactly 4 transaction types (Expense, Income, Lend, Borrow) and NO Transfer button or To Account', async () => {
    const { QuickAddForm } = await import('../features/transactions/QuickAddForm');
    const { DEFAULT_CURRENCY } = await import('../utils/currency');

    render(
      <QuickAddForm
        accounts={dummyAccounts}
        people={[]}
        currency={DEFAULT_CURRENCY}
        defaultAccountId="acc_bank"
      />
    );

    // 1. Verify exactly 4 type buttons exist: Expense, Income, Lend, Borrow
    expect(screen.getByRole('button', { name: /^Expense$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Income$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Lend$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Borrow$/i })).toBeTruthy();

    // 2. Transfer button must NOT exist
    expect(screen.queryByRole('button', { name: /Transfer/i })).toBeNull();

    // 3. Exactly 1 Account select dropdown exists (no To Account or destination dropdown)
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBe(1);
    expect(screen.queryByText(/To Account/i)).toBeNull();
    expect(screen.queryByText(/No eligible destination account/i)).toBeNull();
  });

  it('HomeDashboard renders separate recent transaction rows with Lend/Borrow Pending status', async () => {
    const { HomeDashboard } = await import('../pages/HomeDashboard');
    const { DEFAULT_CURRENCY } = await import('../utils/currency');

    const dummyTxs = [
      {
        id: 'tx_lend_1',
        type: 'lend' as const,
        amount: 45000, // ₹450.00
        description: 'Amma loan',
        accountId: 'acc_bank',
        isSettled: false,
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'tx_income_1',
        type: 'income' as const,
        amount: 15000, // ₹150.00
        description: 'Night freelance',
        accountId: 'acc_cash',
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    render(
      <HomeDashboard
        accounts={dummyAccounts}
        transactions={dummyTxs}
        people={[]}
        currency={DEFAULT_CURRENCY}
        defaultAccountId="acc_bank"
        defaultTransactionType="expense"
        setActiveTab={() => {}}
      />
    );

    // Recent Transactions heading
    expect(screen.getByText('Recent Transactions')).toBeTruthy();

    // Descriptions should be rendered clearly in separate rows
    expect(screen.getByText('Amma loan')).toBeTruthy();
    expect(screen.getByText('Night freelance')).toBeTruthy();

    // Lend transaction shows Pending toggle button
    expect(screen.getByText('☐ Pending')).toBeTruthy();
  });
});

# Nikkis E&Tracker

A minimal, clean, professional personal finance management web application engineered for speed, privacy, precision, and reliable offline-first local storage.

---

## 1. Quick Start & Setup

### Prerequisites
- Node.js (v18 or higher)
- npm (v9 or higher)

### Installation
```bash
# Clone or navigate to the project directory
cd "N:\Documents\EXPENSE TRACKER"

# Install dependencies
npm install

# Start development server
npm run dev
```

### Production Build & Local Preview
```bash
# Build production bundle with PWA assets
npm run build

# Preview production build locally
npm run preview
```

### Running Automated Tests
```bash
# Run unit and integration tests with Vitest
npm test
```

---

## 2. Mandatory PIN Lock & Security Architecture

### Initial Access PIN
- **Initial PIN:** `2510`
- On opening the web app, a clean PIN entry screen greets you before **any** financial data or UI trees are rendered into the DOM.
- The session is held strictly in memory (`isUnlocked` React state) and is **never** saved as a persistent "unlocked: true" flag in storage.

### Security Implementation Details
- **PBKDF2-HMAC-SHA256 Derivation:** PINs are never stored in plaintext. They are salted with a cryptographically secure random 128-bit salt (`crypto.getRandomValues`) and derived using 100,000 iterations of PBKDF2 with SHA-256 via the browser's native Web Crypto API.
- **Constant-Time Verification:** PIN hash comparisons use XOR bitwise comparison to eliminate timing attacks.
- **Lockout Protection:** Three consecutive incorrect PIN attempts trigger a mandatory 30-second lockout with countdown feedback.
- **Inactivity Auto-Lock:** Monitors user activity (`mousemove`, `keydown`, `touchstart`, `scroll`) and automatically locks after the configured inactivity threshold (default: 5 minutes).
- **Background Privacy Lock:** Listens to the browser's `visibilitychange` API. If the tab or app window is backgrounded or minimized, it automatically locks to prevent shoulder-surfing.
- **Changing the PIN:** Navigate to **Settings > PIN Lock & Security**. Enter your current PIN once, enter your new PIN twice, and save.

> [!IMPORTANT]
> ### Client-Side Security Boundaries & Privacy Limitations
> A client-side, browser-local PIN lock functions as an effective **privacy barrier** against casual browsing, shared screen viewing, or shoulder-surfing on your device.
> However, because code runs locally in the user's browser, client-side PIN hashing **does not provide server-grade authentication** against a party who has physical access to your device, browser Developer Tools, or raw profile storage. It does not provide database-level filesystem encryption. Keep your operating system user account locked when unattended.

---

## 3. Financial Calculation Rules & Accounting Model

The app enforces strict, testable double-entry accounting rules to guarantee zero discrepancies:

| Action / Type | Source Account | Destination Account / Person | Operational Income | Operational Expense | Accounting Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Expense** | Decreases by amount | N/A | No change | **Increases** | Standard living expenditure. |
| **Income** | Increases by amount | N/A | **Increases** | No change | Operating revenues / wages. |
| **Account Transfer** | Decreases by amount | Increases by amount | **No change** | **No change** | Moving money between own accounts is not an expense or income. |
| **Credit Card Purchase** | Card balance increases | N/A | No change | **Increases** | Spending occurred; liability to bank increased. |
| **Credit Card Bill Pay** | Bank decreases by amount | Card balance decreases | **No change** | **No change** | Settles card liability. Avoids double-counting the earlier purchase. |
| **Lending Money** | Bank/Cash decreases | "Owed to Me" increases | **No change** | **No change** | Asset conversion (cash to receivable), not an expense. |
| **Borrowing Money** | Bank/Cash increases | "Owed to Them" increases | **No change** | **No change** | Liability creation, not revenue. |
| **Repaying Loan** | Bank/Cash decreases | "Owed to Them" decreases | **No change** | **No change** | Settle liability owed to person. |
| **Repayment Received** | Bank/Cash increases | "Owed to Me" decreases | **No change** | **No change** | Collect receivable owed by person. |
| **Refund / Reversal** | Account increases | N/A | No change | **Decreases** | Reverses prior expense accurately. |

### Integer Minor Units (Zero Floating-Point Drift)
All monetary amounts are converted to integer minor units (cents / paise) upon entry (e.g., `$10.50` -> `1050`). All additions, subtractions, running balances, and aggregations operate exclusively on whole integers, completely eliminating floating-point rounding errors (e.g., `0.1 + 0.2 = 0.30000000000000004`).

---

## 4. Database Schema (IndexedDB via Dexie)

The application uses an offline-first **IndexedDB** database (`FinanceTrackerDB`) with the following stores:

- `accounts`: Store for Cash, Bank Accounts, Debit Cards, Credit Cards, Savings/Investments. Includes `creditLimit`, `billingCycleDay`, `paymentDueDay`, `currentBalance`, and archive state.
- `transactions`: Central journal containing every transaction with `date`, `type`, `amount`, `reason`, `description`, `accountId`, `toAccountId`, `categoryId`, `personId`, `paymentMethod`, `tags`, and `notes`.
- `categories`: Preset and user-defined categories with types (`expense` vs `income`), colors, and monthly budget allocations.
- `people`: Contact directory for borrowing and lending records (`currentOwedToThem`, `currentOwedToMe`, `totalBorrowed`, `totalLent`).
- `budgets`: Overall and category-level monthly budgets with threshold alerts.
- `savingsGoals`: Goals with target amounts, current progress, target dates, and contribution tracking.
- `recurringBills`: Subscriptions and fixed bills with frequency schedules, due dates, and "Mark as Paid" automation.
- `auditLogs`: Immutable history tracking creation, updates, and deletions of financial records.
- `settings`: User preferences, hashed PIN credentials, theme, inactivity timeout, and currency configuration.

---

## 5. Offline-First Architecture & PWA

The application uses the `vite-plugin-pwa` service worker and Web App Manifest:
- **Offline Availability:** Once loaded or installed, all assets (`HTML`, `JS`, `CSS`, fonts) are cached in the browser's CacheStorage.
- **Local Persistence:** All financial records are stored in browser-local IndexedDB.
- **Installation:** Can be installed directly as a standalone Progressive Web App (PWA) on Windows, macOS, Android, and iOS.

---

## 6. Backup, Restore & Export

Because data is stored locally in the browser, clearing your browser's site data would remove the database. The app provides built-in tools in **Settings** and the **Journal**:

1. **Full JSON Backup:** Exports all tables, schema version, settings, and journal entries into a clean JSON file with timestamp.
2. **Validated JSON Restore:** Uploads and checks the file for compatibility and valid schema, providing a preview before replacing records safely in a single transaction.
3. **CSV Export:** Generates standard comma-separated transaction journals with formatted and raw minor currency values for spreadsheet analysis (Excel, Google Sheets).

---

## 7. Customization & Extension Guide

The project is structured into modular domain feature directories:

```
src/
├── components/          # Reusable navigation, layout, and common widgets
├── db/                  # Dexie schema, migrations, and database seeders
├── features/
│   ├── accounts/        # Account management, cards, transfers, credit limits
│   ├── analytics/       # Recharts dashboards, cashflow trends, breakdowns
│   ├── bills/           # Recurring subscriptions, due dates, payment action
│   ├── budgets/         # Budget bars, threshold warnings, savings milestones
│   ├── calendar/        # Monthly calendar grid, daily totals, bill flags
│   ├── debts/           # People directory, loans, borrowings, repayments
│   ├── security/        # LockScreen, Web Crypto PBKDF2 hashing, inactivity hook
│   ├── settings/        # Preferences, PIN update, categories, backup/restore
│   └── transactions/    # QuickAddForm, JournalView, detail modals, filters
├── services/
│   ├── accounting.ts    # Core double-entry balance engine & audit logging
│   └── backup.ts        # CSV and JSON backup/restore engine
├── theme/               # Centralized tokens and color definitions
├── types/               # TypeScript interfaces and domain models
└── utils/               # Safe currency parsing, date utilities, crypto helpers
```

### Adding New Features
- **Add a new Account Type:** Add the type to `AccountType` in `src/types/index.ts` and customize its icon in `src/features/accounts/AccountsView.tsx`.
- **Add a new Transaction Type:** Update `TransactionType` in `src/types/index.ts`, specify its balance delta in `calculateTransactionEffects()` in `src/services/accounting.ts`, and run `npm test`.
- **Change Default Currencies:** Modify `DEFAULT_CURRENCY` in `src/utils/currency.ts` or edit directly in **Settings > Currency & Localization**.

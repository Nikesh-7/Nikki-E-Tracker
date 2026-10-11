import React, { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initializeDatabase } from './db';
import { UserSettings } from './types';
import { LockScreen } from './features/security/LockScreen';
import { useInactivityLock } from './features/security/useInactivityLock';
import { Navigation, ActiveTab } from './components/Navigation';
import { HomeDashboard } from './pages/HomeDashboard';
import { JournalView } from './features/transactions/JournalView';
import { AccountsView } from './features/accounts/AccountsView';
import { DebtsView } from './features/debts/DebtsView';
import { CalendarView } from './features/calendar/CalendarView';
import { AnalyticsView } from './features/analytics/AnalyticsView';
import { SettingsView } from './features/settings/SettingsView';

const VALID_TABS: ActiveTab[] = ['home', 'journal', 'accounts', 'debts', 'calendar', 'analytics', 'settings'];

export const App: React.FC = () => {
  const [isDbReady, setIsDbReady] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [activeTab, setActiveTabState] = useState<ActiveTab>(() => {
    const hash = window.location.hash.replace('#', '') as ActiveTab;
    return VALID_TABS.includes(hash) ? hash : 'home';
  });
  const [theme, setThemeState] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('finance_theme') as any) || 'system';
  });

  // Client-side navigation synchronized with browser history
  const navigateToTab = useCallback((tab: ActiveTab, replace = false) => {
    setActiveTabState(tab);
    const hash = `#${tab}`;
    if (replace) {
      window.history.replaceState({ tab }, '', hash);
    } else if (window.history.state?.tab !== tab) {
      window.history.pushState({ tab }, '', hash);
    }
  }, []);

  // Handle in-app Go Back with safe fallback to Home
  const handleGoBack = useCallback(() => {
    if (window.history.state?.tab && window.history.state.tab !== 'home') {
      window.history.back();
    } else {
      navigateToTab('home');
    }
  }, [navigateToTab]);

  // Sync initial history state on mount
  useEffect(() => {
    const currentHash = window.location.hash.replace('#', '') as ActiveTab;
    const initial = VALID_TABS.includes(currentHash) ? currentHash : 'home';
    window.history.replaceState({ tab: initial }, '', `#${initial}`);
  }, []);

  // Handle Browser Back / Forward buttons (popstate)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // Security: If not unlocked, never bypass PIN lock screen
      if (!isUnlocked) {
        return;
      }
      const stateTab = event.state?.tab as ActiveTab;
      const hashTab = window.location.hash.replace('#', '') as ActiveTab;
      const targetTab = VALID_TABS.includes(stateTab)
        ? stateTab
        : (VALID_TABS.includes(hashTab) ? hashTab : 'home');

      setActiveTabState(targetTab);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isUnlocked]);

  // Initialize Dexie DB on mount
  useEffect(() => {
    async function init() {
      try {
        await initializeDatabase();
        setIsDbReady(true);
      } catch (err) {
        console.error('Failed to initialize database:', err);
      }
    }
    init();
  }, []);

  // Live Queries for Dexie Entities
  const settingsList = useLiveQuery(() => db.settings.toArray(), []);
  const accounts = useLiveQuery(() => db.accounts.toArray(), []) || [];
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) || [];
  const people = useLiveQuery(() => db.people.toArray(), []) || [];

  const settings: UserSettings | undefined = settingsList?.[0];

  // Theme Synchronizer
  const applyTheme = useCallback((newTheme: 'light' | 'dark' | 'system') => {
    setThemeState(newTheme);
    localStorage.setItem('finance_theme', newTheme);

    const isDark = newTheme === 'dark' || (newTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Update theme when setting loads or system changes
  useEffect(() => {
    applyTheme(theme);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };
    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [theme, applyTheme]);

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';
    applyTheme(nextTheme);
  };

  // Manual Lock Action
  const handleLock = useCallback(() => {
    setIsUnlocked(false);
  }, []);

  // Auto Inactivity Lock
  useInactivityLock({
    isUnlocked,
    inactivityMinutes: settings?.inactivityLockMinutes ?? 5,
    onLock: handleLock
  });

  // Loading Screen while DB initializes
  if (!isDbReady || !settings) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-text-muted">
        <div className="w-8 h-8 border-2 border-accent/20 border-t-accent rounded-full animate-spin mb-3" />
        <span className="text-xs font-medium">Initializing secure local storage...</span>
      </div>
    );
  }

  // MANDATORY PIN LOCK SCREEN
  if (!isUnlocked) {
    return (
      <LockScreen
        pinSalt={settings.pinSalt}
        pinHash={settings.pinHash}
        onUnlock={() => setIsUnlocked(true)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />
    );
  }

  // Unlocked Application View
  return (
    <div className="min-h-screen bg-background text-text-main flex flex-col md:flex-row pb-16 md:pb-0">
      {/* Navigation Sidebar / Mobile Nav */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={navigateToTab}
        onLock={handleLock}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 overflow-y-auto">
        {activeTab === 'home' && (
          <HomeDashboard
            accounts={accounts}
            transactions={transactions}
            people={people}
            currency={settings.currency}
            defaultAccountId={settings.defaultAccountId}
            defaultTransactionType={settings.defaultTransactionType}
            setActiveTab={navigateToTab}
          />
        )}

        {activeTab === 'journal' && (
          <JournalView
            transactions={transactions}
            accounts={accounts}
            people={people}
            currency={settings.currency}
            onOpenQuickAdd={() => navigateToTab('home')}
            onBack={handleGoBack}
          />
        )}

        {activeTab === 'accounts' && (
          <AccountsView
            accounts={accounts}
            transactions={transactions}
            currency={settings.currency}
            onOpenQuickAdd={() => navigateToTab('home')}
            onBack={handleGoBack}
          />
        )}

        {activeTab === 'debts' && (
          <DebtsView
            people={people}
            accounts={accounts}
            transactions={transactions}
            currency={settings.currency}
            onBack={handleGoBack}
          />
        )}

        {activeTab === 'calendar' && (
          <CalendarView
            transactions={transactions}
            currency={settings.currency}
            weekStartsOn={settings.weekStartsOn}
            onOpenQuickAdd={() => navigateToTab('home')}
            onBack={handleGoBack}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView
            transactions={transactions}
            accounts={accounts}
            people={people}
            currency={settings.currency}
            onBack={handleGoBack}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            accounts={accounts}
            theme={theme}
            setTheme={applyTheme}
            onRefreshSettings={() => {}}
            onLockApp={handleLock}
            onBack={handleGoBack}
          />
        )}
      </main>
    </div>
  );
};

export default App;

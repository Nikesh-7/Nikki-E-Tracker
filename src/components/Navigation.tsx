import React from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  Landmark, 
  Users, 
  CalendarDays, 
  BarChart3, 
  Settings, 
  Lock,
  Sun,
  Moon,
  Laptop
} from 'lucide-react';

export type ActiveTab = 
  | 'home' 
  | 'journal' 
  | 'accounts' 
  | 'debts' 
  | 'calendar' 
  | 'analytics' 
  | 'settings';

interface NavigationProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onLock: () => void;
  theme: 'light' | 'dark' | 'system';
  onToggleTheme: () => void;
}

export const navItems = [
  { id: 'home' as ActiveTab, label: 'Home', icon: LayoutDashboard },
  { id: 'journal' as ActiveTab, label: 'Journal', icon: Receipt },
  { id: 'accounts' as ActiveTab, label: 'Accounts', icon: Landmark },
  { id: 'debts' as ActiveTab, label: 'People & Debts', icon: Users },
  { id: 'calendar' as ActiveTab, label: 'Calendar', icon: CalendarDays },
  { id: 'analytics' as ActiveTab, label: 'Analytics', icon: BarChart3 },
  { id: 'settings' as ActiveTab, label: 'Settings', icon: Settings },
];

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  onLock,
  theme,
  onToggleTheme
}) => {
  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-surface border-r border-border h-screen sticky top-0 shrink-0 select-none">
        {/* Logo / App Name */}
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent text-white flex items-center justify-center font-bold text-sm shadow-subtle">
              ₹
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-main leading-tight">Nikkis E&amp;Tracker</h2>
              <span className="text-[11px] text-text-muted font-normal">Offline & Private</span>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive 
                    ? 'bg-accent-subtle text-accent font-semibold' 
                    : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-accent' : 'text-text-muted'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer Actions: Lock & Theme */}
        <div className="p-3 border-t border-border flex items-center justify-between gap-2">
          <button
            onClick={onToggleTheme}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-border text-xs text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
            title={`Toggle Theme (current: ${theme})`}
          >
            {theme === 'dark' ? (
              <Moon className="w-3.5 h-3.5 text-accent" />
            ) : theme === 'light' ? (
              <Sun className="w-3.5 h-3.5 text-amber-500" />
            ) : (
              <Laptop className="w-3.5 h-3.5" />
            )}
            <span className="capitalize">{theme}</span>
          </button>

          <button
            onClick={onLock}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-border text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
            title="Lock Application Now"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Lock</span>
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border flex items-center justify-around py-1.5 px-1">
        {navItems.slice(0, 5).map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[10px] ${
                isActive ? 'text-accent font-semibold' : 'text-text-muted hover:text-text-main'
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span>{item.label.split(' ')[0]}</span>
            </button>
          );
        })}
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[10px] ${
            activeTab === 'settings' || !navItems.slice(0, 5).some(i => i.id === activeTab)
              ? 'text-accent font-semibold' 
              : 'text-text-muted'
          }`}
        >
          <Settings className="w-4 h-4 mb-0.5" />
          <span>More</span>
        </button>
      </nav>
    </>
  );
};

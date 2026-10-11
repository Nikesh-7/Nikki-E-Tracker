import React, { useState, useEffect, useRef } from 'react';
import { Lock, Eye, EyeOff, Delete, AlertCircle, Sun, Moon, Laptop } from 'lucide-react';
import { verifyPin } from '../../utils/security';

interface LockScreenProps {
  pinSalt: string;
  pinHash: string;
  onUnlock: () => void;
  theme: 'light' | 'dark' | 'system';
  onToggleTheme: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({
  pinSalt,
  pinHash,
  onUnlock,
  theme,
  onToggleTheme
}) => {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input automatically on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const timer = setInterval(() => {
      setLockoutRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  const handleAttemptUnlock = async (pinToTest: string) => {
    if (lockoutRemaining > 0 || isVerifying) return;
    if (!pinToTest.trim()) {
      setError('Please enter your PIN');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const isValid = await verifyPin(pinToTest, pinSalt, pinHash);

      if (isValid) {
        setPin('');
        setFailedAttempts(0);
        onUnlock();
      } else {
        const nextFailed = failedAttempts + 1;
        setFailedAttempts(nextFailed);
        setPin('');

        if (nextFailed >= 3) {
          setLockoutRemaining(30);
          setError('Too many incorrect attempts. Please wait 30 seconds.');
        } else {
          setError(`Incorrect PIN. (${3 - nextFailed} attempts remaining)`);
        }
      }
    } catch {
      setError('Verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleKeyPress = (digit: string) => {
    if (lockoutRemaining > 0) return;
    setError(null);
    setPin(prev => {
      if (prev.length >= 10) return prev;
      const nextPin = prev + digit;
      if (nextPin.length === 4) {
        handleAttemptUnlock(nextPin);
      }
      return nextPin;
    });
  };

  const handleBackspace = () => {
    if (lockoutRemaining > 0) return;
    setPin(prev => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    if (lockoutRemaining > 0) return;
    setPin('');
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAttemptUnlock(pin);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-4 select-none">
      {/* Top bar with theme toggle */}
      <div className="absolute top-6 right-6 flex items-center gap-2">
        <button
          onClick={onToggleTheme}
          aria-label="Toggle Theme"
          className="p-2.5 rounded-lg border border-border bg-surface text-text-muted hover:text-text-main transition-colors"
          title={`Current theme: ${theme}`}
        >
          {theme === 'dark' ? (
            <Moon className="w-4 h-4 text-accent" />
          ) : theme === 'light' ? (
            <Sun className="w-4 h-4 text-amber-500" />
          ) : (
            <Laptop className="w-4 h-4" />
          )}
        </button>
      </div>

      <div className="w-full max-w-sm flex flex-col items-center">
        {/* Lock Icon */}
        <div className="w-14 h-14 rounded-2xl bg-surface border border-border flex items-center justify-center text-text-main mb-6 shadow-subtle">
          <Lock className="w-6 h-6 text-accent" />
        </div>

        <h1 className="text-xl font-semibold text-text-main tracking-tight mb-1 text-center">
          Nikkis E&amp;Tracker
        </h1>
        <p className="text-xs text-text-muted mb-6 text-center">
          Enter PIN to unlock your private records
        </p>

        {/* PIN Input and Display */}
        <div className="w-full relative mb-4">
          <input
            ref={inputRef}
            type={showPin ? 'text' : 'password'}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={10}
            value={pin}
            onChange={e => {
              const val = e.target.value.replace(/\D/g, '');
              setPin(val);
              setError(null);
              if (val.length === 4) {
                handleAttemptUnlock(val);
              }
            }}
            onKeyDown={handleKeyDown}
            disabled={lockoutRemaining > 0}
            placeholder="••••"
            className="w-full text-center text-2xl tracking-[0.4em] font-mono py-3 px-12 rounded-xl bg-surface border border-border text-text-main focus:outline-none focus:border-accent disabled:opacity-50 transition-colors shadow-subtle"
            autoComplete="off"
            aria-label="Enter PIN"
          />
          <button
            type="button"
            onClick={() => setShowPin(!showPin)}
            aria-label={showPin ? "Hide PIN" : "Show PIN"}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main p-1 rounded-md"
            tabIndex={-1}
          >
            {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {/* Error / Lockout Feedback */}
        {error && (
          <div className="w-full flex items-center gap-2 p-2.5 mb-4 text-xs font-medium text-rose-600 bg-rose-50 dark:bg-rose-950/30 dark:text-rose-400 rounded-lg border border-rose-200 dark:border-rose-900/40">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {lockoutRemaining > 0 && (
          <div className="w-full text-center text-xs text-text-muted mb-4 font-mono">
            Retry available in <span className="font-semibold text-text-main">{lockoutRemaining}s</span>
          </div>
        )}

        {/* Numeric Keypad */}
        <div className="w-full grid grid-cols-3 gap-2.5 mb-5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
            <button
              key={digit}
              type="button"
              disabled={lockoutRemaining > 0}
              onClick={() => handleKeyPress(digit)}
              className="py-3.5 rounded-xl bg-surface border border-border text-text-main text-lg font-semibold hover:bg-surface-hover active:scale-[0.98] transition-all disabled:opacity-40"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            disabled={lockoutRemaining > 0 || pin.length === 0}
            onClick={handleClear}
            className="py-3.5 rounded-xl bg-surface border border-border text-text-muted text-xs font-semibold hover:bg-surface-hover hover:text-text-main active:scale-[0.98] transition-all disabled:opacity-40 uppercase tracking-wider"
          >
            Clear
          </button>
          <button
            type="button"
            disabled={lockoutRemaining > 0}
            onClick={() => handleKeyPress('0')}
            className="py-3.5 rounded-xl bg-surface border border-border text-text-main text-lg font-semibold hover:bg-surface-hover active:scale-[0.98] transition-all disabled:opacity-40"
          >
            0
          </button>
          <button
            type="button"
            disabled={lockoutRemaining > 0 || pin.length === 0}
            onClick={handleBackspace}
            aria-label="Backspace"
            className="py-3.5 rounded-xl bg-surface border border-border text-text-muted flex items-center justify-center hover:bg-surface-hover hover:text-text-main active:scale-[0.98] transition-all disabled:opacity-40"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Unlock Button */}
        <button
          type="button"
          onClick={() => handleAttemptUnlock(pin)}
          disabled={lockoutRemaining > 0 || isVerifying || pin.length === 0}
          className="w-full py-3 rounded-xl bg-accent text-white font-medium text-sm hover:bg-accent-hover active:scale-[0.99] disabled:opacity-40 transition-all shadow-subtle flex items-center justify-center gap-2"
        >
          {isVerifying ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            'Unlock'
          )}
        </button>

        {/* Security boundary notice */}
        <p className="mt-8 text-[11px] text-text-muted text-center max-w-xs leading-relaxed">
          Protected by PBKDF2 client-side hashing. Local privacy barrier for distraction-free offline tracking.
        </p>
      </div>
    </div>
  );
};

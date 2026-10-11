import { useEffect, useRef, useCallback } from 'react';

interface UseInactivityLockOptions {
  isUnlocked: boolean;
  inactivityMinutes: number; // 0 = disabled
  onLock: () => void;
}

export function useInactivityLock({
  isUnlocked,
  inactivityMinutes,
  onLock
}: UseInactivityLockOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onLockRef = useRef(onLock);
  onLockRef.current = onLock;

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (!isUnlocked || inactivityMinutes <= 0) {
      return;
    }

    const timeoutMs = inactivityMinutes * 60 * 1000;
    timeoutRef.current = setTimeout(() => {
      onLockRef.current();
    }, timeoutMs);
  }, [isUnlocked, inactivityMinutes]);

  useEffect(() => {
    if (!isUnlocked || inactivityMinutes <= 0) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    resetTimer();

    // User activity listeners
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
    const handleActivity = () => {
      resetTimer();
    };

    events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));

    // Visibility change listener (locks when tab is backgrounded for more than 30s or when returning)
    let backgroundTimestamp: number | null = null;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        backgroundTimestamp = Date.now();
      } else if (document.visibilityState === 'visible' && backgroundTimestamp) {
        const elapsed = (Date.now() - backgroundTimestamp) / 1000;
        // If away for more than 45 seconds or inactivity threshold, lock immediately
        if (elapsed > Math.min(45, inactivityMinutes * 60)) {
          onLockRef.current();
        } else {
          resetTimer();
        }
        backgroundTimestamp = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      events.forEach(e => window.removeEventListener(e, handleActivity));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isUnlocked, inactivityMinutes, resetTimer]);
}

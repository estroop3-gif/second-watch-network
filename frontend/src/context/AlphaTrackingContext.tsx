import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useEnrichedProfile } from '@/context/EnrichedProfileContext';

interface AlphaTrackingContextType {
  recentActions: string[];
  consoleErrors: string[];
  logAction: (action: string) => void;
  getBrowserInfo: () => BrowserInfo;
  getNetworkTiming: () => PerformanceNavigationTiming | null;
}

interface BrowserInfo {
  userAgent: string;
  platform: string;
  language: string;
  screenWidth: number;
  screenHeight: number;
  viewportWidth: number;
  viewportHeight: number;
}

const AlphaTrackingContext = createContext<AlphaTrackingContextType>({
  recentActions: [],
  consoleErrors: [],
  logAction: () => {},
  getBrowserInfo: () => ({
    userAgent: '',
    platform: '',
    language: '',
    screenWidth: 0,
    screenHeight: 0,
    viewportWidth: 0,
    viewportHeight: 0,
  }),
  getNetworkTiming: () => null,
});

export const useAlphaTracking = () => useContext(AlphaTrackingContext);

const MAX_ACTIONS = 50;
const MAX_ERRORS = 20;

export const AlphaTrackingProvider = ({ children }: { children: React.ReactNode }) => {
  const { profile } = useEnrichedProfile();
  const isAlphaTester = profile?.is_alpha_tester === true;

  const [recentActions, setRecentActions] = useState<string[]>([]);
  const [consoleErrors, setConsoleErrors] = useState<string[]>([]);
  const originalConsoleError = useRef<typeof console.error | null>(null);

  // Log user actions
  const logAction = useCallback((action: string) => {
    if (!isAlphaTester) return;

    const timestamp = new Date().toISOString();
    const entry = `${timestamp}: ${action}`;

    setRecentActions(prev => {
      const updated = [...prev, entry];
      // Keep only the most recent actions
      return updated.slice(-MAX_ACTIONS);
    });
  }, [isAlphaTester]);

  // Capture console errors for alpha testers
  useEffect(() => {
    if (!isAlphaTester) return;

    // Store original console.error
    originalConsoleError.current = console.error;

    // Override console.error
    console.error = (...args: unknown[]) => {
      // Add to our error tracking
      const errorMessage = args.map(arg => {
        if (arg instanceof Error) {
          return `${arg.name}: ${arg.message}`;
        }
        return String(arg);
      }).join(' ');

      setConsoleErrors(prev => {
        const updated = [...prev, `${new Date().toISOString()}: ${errorMessage}`];
        return updated.slice(-MAX_ERRORS);
      });

      // Call original console.error
      if (originalConsoleError.current) {
        originalConsoleError.current.apply(console, args);
      }
    };

    // Cleanup
    return () => {
      if (originalConsoleError.current) {
        console.error = originalConsoleError.current;
      }
    };
  }, [isAlphaTester]);

  // Track route changes
  useEffect(() => {
    if (!isAlphaTester) return;

    const handlePopState = () => {
      logAction(`Navigation: ${window.location.pathname}`);
    };

    // Log initial page
    logAction(`Page Load: ${window.location.pathname}`);

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isAlphaTester, logAction]);

  // Track clicks on interactive elements
  useEffect(() => {
    if (!isAlphaTester) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Only track button and link clicks
      const button = target.closest('button');
      const link = target.closest('a');

      if (button) {
        const text = button.textContent?.slice(0, 50) || 'unknown';
        const ariaLabel = button.getAttribute('aria-label');
        logAction(`Click: Button "${ariaLabel || text}"`);
      } else if (link) {
        const href = link.getAttribute('href') || 'unknown';
        logAction(`Click: Link "${href}"`);
      }
    };

    document.addEventListener('click', handleClick, { capture: true });
    return () => document.removeEventListener('click', handleClick, { capture: true });
  }, [isAlphaTester, logAction]);

  // Get browser information
  const getBrowserInfo = useCallback((): BrowserInfo => {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  }, []);

  // Get network timing information
  const getNetworkTiming = useCallback((): PerformanceNavigationTiming | null => {
    const entries = performance.getEntriesByType('navigation');
    if (entries.length > 0) {
      return entries[0] as PerformanceNavigationTiming;
    }
    return null;
  }, []);

  return (
    <AlphaTrackingContext.Provider value={{
      recentActions,
      consoleErrors,
      logAction,
      getBrowserInfo,
      getNetworkTiming,
    }}>
      {children}
    </AlphaTrackingContext.Provider>
  );
};

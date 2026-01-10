/**
 * usePdfCache - Hook for managing PDF loading state
 *
 * This hook manages PDF loading and provides status tracking.
 * Actual caching is handled by browser HTTP cache (S3 sends proper cache headers).
 *
 * We previously tried IndexedDB caching but PDF.js workers have issues with
 * ArrayBuffer transfer that causes "detached ArrayBuffer" errors.
 */
import { useState, useEffect, useCallback, useRef } from 'react';

interface UsePdfCacheResult {
  /** PDF URL to pass to react-pdf */
  pdfSource: string | null;
  isLoading: boolean;
  error: string | null;
  cacheStatus: 'checking' | 'cached' | 'downloading' | 'ready' | 'error';
}

export function usePdfCache(scriptId: string, fileUrl: string | null): UsePdfCacheResult {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cacheStatus, setCacheStatus] = useState<UsePdfCacheResult['cacheStatus']>('checking');
  const [pdfSource, setPdfSource] = useState<string | null>(null);

  // Track loaded scripts to show "cached" status on subsequent views
  const loadedScriptsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!fileUrl || !scriptId) {
      setIsLoading(false);
      setPdfSource(null);
      setCacheStatus('ready');
      return;
    }

    // Check if we've already loaded this script in this session
    const wasLoaded = loadedScriptsRef.current.has(scriptId);

    if (wasLoaded) {
      // Already loaded - browser cache should serve it quickly
      console.log('[PDF Cache] Using browser cached PDF for script:', scriptId);
      setCacheStatus('cached');
      setPdfSource(fileUrl);
      setIsLoading(false);
      return;
    }

    // First load - track status
    console.log('[PDF Cache] Loading PDF for script:', scriptId);
    setCacheStatus('downloading');
    setIsLoading(true);
    setError(null);

    // Use the URL directly - browser HTTP cache handles actual caching
    // S3 URLs have cache headers that enable browser caching
    setPdfSource(fileUrl);

    // Track that we've loaded this script
    loadedScriptsRef.current.add(scriptId);

    // Small delay to ensure loading state is visible, then mark as ready
    const timer = setTimeout(() => {
      setCacheStatus('ready');
      setIsLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, [scriptId, fileUrl]);

  return {
    pdfSource,
    isLoading,
    error,
    cacheStatus,
  };
}

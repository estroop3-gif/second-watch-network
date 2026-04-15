import { useEffect } from 'react';
import { reportError } from '@/lib/errorReporter';

/**
 * Registers global error listeners on mount:
 * - window.onerror — catches uncaught synchronous errors
 * - unhandledrejection — catches unhandled Promise rejections
 *
 * These capture errors outside of React's component tree
 * (e.g. async callbacks, third-party scripts).
 * Renders nothing — purely a side-effect component.
 */
const GlobalErrorSetup = () => {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (!event.error) return;
      reportError(event.error, {
        source: 'window.onerror',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (!reason) return;
      const error =
        reason instanceof Error
          ? reason
          : new Error(typeof reason === 'string' ? reason : JSON.stringify(reason));
      reportError(error, { source: 'unhandledrejection' });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return null;
};

export default GlobalErrorSetup;

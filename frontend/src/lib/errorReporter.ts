/**
 * Client-side error reporter.
 * Fire-and-forget: sends JS errors to /api/v1/client-errors for admin monitoring.
 * Never throws — safe to call from error boundaries and global listeners.
 */

// Deduplication: skip if same message+pathname reported in last 30s
const _recentErrors = new Map<string, number>();
const DEDUP_WINDOW_MS = 30_000;

function _dedupeKey(message: string): string {
  return `${message}::${typeof window !== 'undefined' ? window.location.pathname : ''}`;
}

function _isDuplicate(key: string): boolean {
  const now = Date.now();
  const last = _recentErrors.get(key);
  if (last && now - last < DEDUP_WINDOW_MS) return true;
  _recentErrors.set(key, now);
  // Prune old entries
  if (_recentErrors.size > 100) {
    const cutoff = now - DEDUP_WINDOW_MS;
    for (const [k, t] of _recentErrors) {
      if (t < cutoff) _recentErrors.delete(k);
    }
  }
  return false;
}

function _getToken(): string | null {
  try {
    return localStorage.getItem('accessToken');
  } catch {
    return null;
  }
}

async function _send(
  error: Error | string,
  severity: 'warning' | 'error' | 'fatal',
  extra?: {
    componentStack?: string;
    context?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    const message = typeof error === 'string' ? error : (error?.message || 'Unknown error');
    const key = _dedupeKey(message);
    if (_isDuplicate(key)) return;

    const token = _getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const body: Record<string, unknown> = {
      error_name: typeof error === 'string' ? 'Error' : (error?.name || 'Error'),
      error_message: message.slice(0, 2000),
      error_stack: typeof error !== 'string' ? error?.stack?.slice(0, 8000) : undefined,
      component_stack: extra?.componentStack?.slice(0, 8000),
      pathname: typeof window !== 'undefined' ? window.location.pathname : undefined,
      url: typeof window !== 'undefined' ? window.location.href.slice(0, 500) : undefined,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : undefined,
      severity,
      context: extra?.context,
    };

    const apiBase = import.meta.env.VITE_API_URL || '';
    await fetch(`${apiBase}/api/v1/client-errors`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    // Never throw from error reporter
  }
}

/** Report a standard (non-fatal) error. */
export function reportError(
  error: Error | string,
  context?: Record<string, unknown>
): void {
  _send(error, 'error', { context }).catch(() => {});
}

/** Report a fatal error (triggers admin notification). */
export function reportFatal(
  error: Error | string,
  extra?: { componentStack?: string; context?: Record<string, unknown> }
): void {
  _send(error, 'fatal', extra).catch(() => {});
}

/** Report a warning (non-breaking degraded state). */
export function reportWarning(
  error: Error | string,
  context?: Record<string, unknown>
): void {
  _send(error, 'warning', { context }).catch(() => {});
}

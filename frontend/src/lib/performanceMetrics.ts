/**
 * Performance Metrics for Second Watch Network
 *
 * Lightweight instrumentation for measuring initial load and login timing.
 * Sends metrics to /api/v1/client-metrics for CloudWatch correlation.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Mark when the bundle started loading (captured at module evaluation time)
const BUNDLE_LOAD_START = performance.now();

// Timing marks storage
interface TimingMarks {
  jsBundleLoaded?: number;
  appMounted?: number;
  authCheckStarted?: number;
  authCheckCompleted?: number;
  firstApiCallStarted?: number;
  firstApiCallCompleted?: number;
  // Login flow
  loginButtonClicked?: number;
  cognitoRequestStarted?: number;
  cognitoResponseReceived?: number;
  tokenStored?: number;
  bootstrapStarted?: number;
  bootstrapCompleted?: number;
}

interface InitialLoadMetrics {
  event_type: 'initial_load';
  js_bundle_loaded_ms: number | null;
  app_mounted_ms: number | null;
  auth_check_started_ms: number | null;
  auth_check_completed_ms: number | null;
  first_api_call_started_ms: number | null;
  first_api_call_completed_ms: number | null;
  auth_had_token: boolean | null;
  auth_token_valid: boolean | null;
  first_api_call_path: string | null;
  first_api_call_status: number | null;
  first_api_call_duration_ms: number | null;
  navigation_timing: Record<string, number> | null;
  user_agent: string | null;
  viewport_width: number | null;
  viewport_height: number | null;
  connection_type: string | null;
}

interface LoginMetrics {
  event_type: 'login';
  login_button_clicked_ms: number | null;
  cognito_request_started_ms: number | null;
  cognito_response_received_ms: number | null;
  token_stored_ms: number | null;
  bootstrap_started_ms: number | null;
  bootstrap_completed_ms: number | null;
  cognito_duration_ms: number | null;
  bootstrap_duration_ms: number | null;
  total_login_duration_ms: number | null;
  success: boolean;
  error_message: string | null;
  retry_count: number;
}

// Internal state for tracking auth during initial load
interface AuthTrackingState {
  auth_had_token?: boolean;
  auth_token_valid?: boolean;
  error_message?: string;
  retry_count?: number;
}

class PerformanceMetricsService {
  private marks: TimingMarks = {};
  private initialLoadSent = false;
  private authState: AuthTrackingState = {};
  private debugMode = false;

  constructor() {
    // Enable debug mode in development
    this.debugMode = import.meta.env.DEV;

    // Record bundle load time immediately
    this.marks.jsBundleLoaded = BUNDLE_LOAD_START;

    // Log to console in debug mode
    this.log('Performance metrics initialized', { bundleLoadTime: BUNDLE_LOAD_START });
  }

  private log(message: string, data?: Record<string, unknown>) {
    if (this.debugMode) {
      console.log(`[PerfMetrics] ${message}`, data || '');
    }
  }

  /**
   * Mark a timing event. All times are relative to navigation start.
   */
  mark(name: keyof TimingMarks) {
    const now = performance.now();
    this.marks[name] = now;
    this.log(`Mark: ${name}`, { time: now.toFixed(2) });
  }

  /**
   * Get current timestamp for manual tracking
   */
  now(): number {
    return performance.now();
  }

  /**
   * Record that the app component has mounted
   */
  markAppMounted() {
    this.mark('appMounted');
  }

  /**
   * Record auth check start
   */
  markAuthCheckStarted() {
    this.mark('authCheckStarted');
  }

  /**
   * Record auth check completion
   */
  markAuthCheckCompleted(hadToken: boolean, tokenValid: boolean) {
    this.mark('authCheckCompleted');
    this.authState.auth_had_token = hadToken;
    this.authState.auth_token_valid = tokenValid;
  }

  /**
   * Record first API call timing
   */
  markFirstApiCall(path: string, started: number, completed: number, status: number) {
    this.marks.firstApiCallStarted = started;
    this.marks.firstApiCallCompleted = completed;

    // Send initial load metrics after first API call completes
    this.sendInitialLoadMetrics({
      first_api_call_path: path,
      first_api_call_status: status,
      first_api_call_duration_ms: completed - started,
      auth_had_token: this.authState.auth_had_token ?? null,
      auth_token_valid: this.authState.auth_token_valid ?? null,
    });
  }

  /**
   * Get Navigation Timing API data
   */
  private getNavigationTiming(): Record<string, number> | null {
    try {
      const entries = performance.getEntriesByType('navigation');
      if (entries.length > 0) {
        const nav = entries[0] as PerformanceNavigationTiming;
        return {
          domainLookupStart: nav.domainLookupStart,
          domainLookupEnd: nav.domainLookupEnd,
          connectStart: nav.connectStart,
          connectEnd: nav.connectEnd,
          requestStart: nav.requestStart,
          responseStart: nav.responseStart,
          responseEnd: nav.responseEnd,
          domInteractive: nav.domInteractive,
          domContentLoadedEventEnd: nav.domContentLoadedEventEnd,
          domComplete: nav.domComplete,
          loadEventEnd: nav.loadEventEnd,
        };
      }
    } catch {
      // Navigation Timing not available
    }
    return null;
  }

  /**
   * Get connection type from Network Information API
   */
  private getConnectionType(): string | null {
    try {
      // @ts-expect-error - Network Information API not in all browsers
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      return connection?.effectiveType || null;
    } catch {
      return null;
    }
  }

  /**
   * Send initial load metrics to backend
   */
  private async sendInitialLoadMetrics(extra: Partial<InitialLoadMetrics>) {
    if (this.initialLoadSent) return;
    this.initialLoadSent = true;

    const metrics: InitialLoadMetrics = {
      event_type: 'initial_load',
      js_bundle_loaded_ms: this.marks.jsBundleLoaded ?? null,
      app_mounted_ms: this.marks.appMounted ?? null,
      auth_check_started_ms: this.marks.authCheckStarted ?? null,
      auth_check_completed_ms: this.marks.authCheckCompleted ?? null,
      first_api_call_started_ms: this.marks.firstApiCallStarted ?? null,
      first_api_call_completed_ms: this.marks.firstApiCallCompleted ?? null,
      auth_had_token: extra.auth_had_token ?? null,
      auth_token_valid: extra.auth_token_valid ?? null,
      first_api_call_path: extra.first_api_call_path ?? null,
      first_api_call_status: extra.first_api_call_status ?? null,
      first_api_call_duration_ms: extra.first_api_call_duration_ms ?? null,
      navigation_timing: this.getNavigationTiming(),
      user_agent: navigator.userAgent,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      connection_type: this.getConnectionType(),
    };

    this.log('Sending initial load metrics', metrics as unknown as Record<string, unknown>);

    // Also log to console for easy debugging
    console.log('[PerfMetrics] Initial Load Summary:', {
      bundleLoaded: `${metrics.js_bundle_loaded_ms?.toFixed(0)}ms`,
      appMounted: `${metrics.app_mounted_ms?.toFixed(0)}ms`,
      authCheckDuration: metrics.auth_check_started_ms && metrics.auth_check_completed_ms
        ? `${(metrics.auth_check_completed_ms - metrics.auth_check_started_ms).toFixed(0)}ms`
        : 'N/A',
      firstApiCall: metrics.first_api_call_path
        ? `${metrics.first_api_call_path} (${metrics.first_api_call_duration_ms?.toFixed(0)}ms)`
        : 'N/A',
      hadToken: metrics.auth_had_token,
      tokenValid: metrics.auth_token_valid,
    });

    try {
      await fetch(`${API_BASE_URL}/api/v1/client-metrics/initial-load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metrics),
      });
    } catch (err) {
      // Don't fail on metrics send failure
      this.log('Failed to send initial load metrics', { error: err });
    }
  }

  // =========================================================================
  // Login Flow Tracking
  // =========================================================================

  /**
   * Mark login button clicked
   */
  markLoginClicked() {
    this.mark('loginButtonClicked');
    this.authState = { retry_count: 0 };
  }

  /**
   * Mark Cognito request started
   */
  markCognitoStarted() {
    this.mark('cognitoRequestStarted');
  }

  /**
   * Mark Cognito response received
   */
  markCognitoCompleted(success: boolean, errorMessage?: string) {
    this.mark('cognitoResponseReceived');
    if (!success) {
      this.authState.error_message = errorMessage || 'Unknown error';
    }
  }

  /**
   * Mark token stored
   */
  markTokenStored() {
    this.mark('tokenStored');
  }

  /**
   * Mark bootstrap (profile fetch) started
   */
  markBootstrapStarted() {
    this.mark('bootstrapStarted');
  }

  /**
   * Mark bootstrap completed and send login metrics
   */
  markBootstrapCompleted(success: boolean, errorMessage?: string) {
    this.mark('bootstrapCompleted');
    this.sendLoginMetrics(success, errorMessage);
  }

  /**
   * Increment retry count
   */
  incrementRetry() {
    this.authState.retry_count = (this.authState.retry_count || 0) + 1;
  }

  /**
   * Send login metrics to backend
   */
  private async sendLoginMetrics(success: boolean, errorMessage?: string) {
    const cognitoDuration = this.marks.cognitoRequestStarted && this.marks.cognitoResponseReceived
      ? this.marks.cognitoResponseReceived - this.marks.cognitoRequestStarted
      : null;

    const bootstrapDuration = this.marks.bootstrapStarted && this.marks.bootstrapCompleted
      ? this.marks.bootstrapCompleted - this.marks.bootstrapStarted
      : null;

    const totalDuration = this.marks.loginButtonClicked && this.marks.bootstrapCompleted
      ? this.marks.bootstrapCompleted - this.marks.loginButtonClicked
      : null;

    const metrics: LoginMetrics = {
      event_type: 'login',
      login_button_clicked_ms: this.marks.loginButtonClicked ?? null,
      cognito_request_started_ms: this.marks.cognitoRequestStarted ?? null,
      cognito_response_received_ms: this.marks.cognitoResponseReceived ?? null,
      token_stored_ms: this.marks.tokenStored ?? null,
      bootstrap_started_ms: this.marks.bootstrapStarted ?? null,
      bootstrap_completed_ms: this.marks.bootstrapCompleted ?? null,
      cognito_duration_ms: cognitoDuration,
      bootstrap_duration_ms: bootstrapDuration,
      total_login_duration_ms: totalDuration,
      success,
      error_message: errorMessage || this.authState.error_message || null,
      retry_count: this.authState.retry_count || 0,
    };

    this.log('Sending login metrics', metrics as unknown as Record<string, unknown>);

    // Log summary to console
    console.log('[PerfMetrics] Login Summary:', {
      cognitoDuration: cognitoDuration ? `${cognitoDuration.toFixed(0)}ms` : 'N/A',
      bootstrapDuration: bootstrapDuration ? `${bootstrapDuration.toFixed(0)}ms` : 'N/A',
      totalDuration: totalDuration ? `${totalDuration.toFixed(0)}ms` : 'N/A',
      success,
      retryCount: metrics.retry_count,
    });

    try {
      await fetch(`${API_BASE_URL}/api/v1/client-metrics/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metrics),
      });
    } catch (err) {
      this.log('Failed to send login metrics', { error: err });
    }

    // Reset login marks for next attempt
    delete this.marks.loginButtonClicked;
    delete this.marks.cognitoRequestStarted;
    delete this.marks.cognitoResponseReceived;
    delete this.marks.tokenStored;
    delete this.marks.bootstrapStarted;
    delete this.marks.bootstrapCompleted;
    this.authState = {};
  }

  /**
   * Send initial load metrics manually (fallback if no API call is made)
   */
  sendInitialLoadMetricsFallback() {
    if (!this.initialLoadSent) {
      this.sendInitialLoadMetrics({
        auth_had_token: this.authState.auth_had_token ?? null,
        auth_token_valid: this.authState.auth_token_valid ?? null,
      });
    }
  }
}

// Export singleton instance
export const performanceMetrics = new PerformanceMetricsService();

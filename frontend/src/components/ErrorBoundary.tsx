import React from 'react';
import { reportFatal } from '@/lib/errorReporter';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React error boundary that catches component tree crashes,
 * shows a friendly recovery UI, and silently reports to admin.
 */
class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportFatal(error, {
      componentStack: info.componentStack || undefined,
      context: { source: 'ErrorBoundary' },
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#121212',
            fontFamily: "'IBM Plex Sans', sans-serif",
            padding: '2rem',
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: '480px' }}>
            {/* Icon */}
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                backgroundColor: '#FF3C3C22',
                border: '2px solid #FF3C3C',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem',
                fontSize: '1.75rem',
              }}
            >
              !
            </div>

            <h1
              style={{
                color: '#FF3C3C',
                fontSize: '1.5rem',
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                marginBottom: '0.75rem',
              }}
            >
              Something went wrong
            </h1>

            <p style={{ color: '#F9F5EF', marginBottom: '0.5rem', lineHeight: 1.6 }}>
              An unexpected error occurred. Our team has been notified automatically.
            </p>

            {this.state.error?.message && (
              <p
                style={{
                  color: '#4C4C4C',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: 4,
                  padding: '0.5rem 1rem',
                  marginBottom: '1.5rem',
                  wordBreak: 'break-word',
                }}
              >
                {this.state.error.message}
              </p>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={this.handleReset}
                style={{
                  backgroundColor: '#FCDC58',
                  color: '#121212',
                  border: 'none',
                  borderRadius: 6,
                  padding: '0.6rem 1.4rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
                }}
              >
                Try again
              </button>
              <a
                href="/"
                style={{
                  backgroundColor: 'transparent',
                  color: '#F9F5EF',
                  border: '1px solid #4C4C4C',
                  borderRadius: 6,
                  padding: '0.6rem 1.4rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                }}
              >
                Go home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

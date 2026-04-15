-- Migration 287: Client Error Logs
-- Stores client-side JavaScript errors for admin monitoring

CREATE TABLE IF NOT EXISTS client_error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT,
  error_name TEXT NOT NULL DEFAULT 'Error',
  error_message TEXT NOT NULL,
  error_stack TEXT,
  component_stack TEXT,
  pathname TEXT,
  url TEXT,
  user_agent TEXT,
  severity TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('warning', 'error', 'fatal')),
  context JSONB,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_error_logs_user_id ON client_error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_client_error_logs_severity ON client_error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_client_error_logs_resolved ON client_error_logs(resolved);
CREATE INDEX IF NOT EXISTS idx_client_error_logs_created_at ON client_error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_error_logs_severity_resolved ON client_error_logs(severity, resolved);

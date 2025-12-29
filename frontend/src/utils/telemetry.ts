export type TelemetryEvent =
  | "signup_submit"
  | "signup_success"
  | "signup_email_already_used"
  | "signup_resend_request"
  | "signup_resend_success"
  | "signup_error"
  | "profile_created"
  | "profile_create_error"
  | "gate_shown"
  | "gate_checkout_click"
  | "gate_checkout_success"
  | "gate_cancel"
  | "upgrade_success_return"
  | "upgrade_failed_webhook";

export function track(event: TelemetryEvent, data?: Record<string, unknown>, correlationId?: string) {
  const payload = {
    ts: new Date().toISOString(),
    event,
    correlationId: correlationId ?? crypto.randomUUID(),
    ...data,
  };
  // Replace this with an API call if desired
  // e.g., api.post('/api/v1/telemetry', payload)
  // For now, just console.log
  // eslint-disable-next-line no-console
  console.log("[telemetry]", payload);
}
export function getAuthErrorMessage(error: unknown): string {
  const e = error as { message?: string; status?: number } | undefined;
  const raw = (e?.message || "").toLowerCase();

  if (e?.status === 429 || raw.includes("rate")) {
    return "Too many attempts. Please try again later.";
  }

  if (raw.includes("invalid login credentials")) {
    return "Invalid email or password.";
  }

  if (raw.includes("email not confirmed")) {
    return "Please confirm your email before logging in.";
  }

  if (raw.includes("already registered") || raw.includes("already exists")) {
    return "This email is already registered.";
  }

  if (raw.includes("network")) {
    return "Network error. Please check your connection and try again.";
  }

  return e?.message || "Something went wrong. Please try again.";
}
// Sign-up checks shared by the forms. The server (Supabase Auth) checks again, and its own password length setting still applies.
export const MIN_PASSWORD = 8;

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

/** Returns what is missing from a password, in plain words, or null when it is good enough. */
export function passwordProblem(p: string): string | null {
  if (p.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (p.length > 72) return "Use at most 72 characters.";
  if (!/[a-z]/i.test(p) || !/\d/.test(p)) return "Use letters and at least one number.";
  return null;
}

/** 0 (weak) to 3 (strong), for the strength bar. */
export function passwordStrength(p: string): 0 | 1 | 2 | 3 {
  if (passwordProblem(p)) return p.length >= 4 ? 1 : 0;
  const extra = [/[A-Z]/.test(p) && /[a-z]/.test(p), /[^A-Za-z0-9]/.test(p), p.length >= 12].filter(Boolean).length;
  return extra >= 2 ? 3 : 2;
}

/** Turns the errors Supabase Auth sends back into sentences a runner can act on. */
export function authMessage(err: { message?: string; code?: string } | null | undefined): string {
  const m = `${err?.code ?? ""} ${err?.message ?? ""}`.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid_credentials")) return "Wrong email or password.";
  if (m.includes("email not confirmed") || m.includes("email_not_confirmed")) return "Please verify your email first.";
  if (m.includes("already registered") || m.includes("user_already_exists")) return "An account with this email already exists. Try signing in.";
  if (m.includes("rate limit") || m.includes("over_email_send_rate_limit") || m.includes("too many")) return "Too many tries. Please wait a minute and try again.";
  if (m.includes("otp_expired") || m.includes("expired") || (m.includes("invalid") && (m.includes("token") || m.includes("otp")))) return "That code is wrong or has expired. Check it, or ask for a new one.";
  if (m.includes("weak_password") || m.includes("password should")) return "That password is too weak. Use at least 8 characters with letters and numbers.";
  if (m.includes("same_password") || m.includes("different from the old")) return "Choose a password you have not used before.";
  if (m.includes("failed to fetch") || m.includes("network")) return "We could not reach the server. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}

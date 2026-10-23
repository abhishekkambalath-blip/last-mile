"use client";

import Link from "next/link";
import { useState } from "react";
import AuthShell, { authButton, authInput, Field, FormError } from "@/components/AuthShell";
import { authMessage, isEmail } from "@/lib/authRules";
import { browserClient } from "@/lib/supabase";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const c = browserClient();
    if (!c) return setError("Accounts are not set up on this server yet.");
    if (!isEmail(email)) return setError("Enter a valid email address.");
    setBusy(true);
    const { error: err } = await c.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset` });
    setBusy(false);
    if (err && /rate|too many/i.test(err.message)) return setError(authMessage(err));
    setSent(true); // the same answer whether or not the address has an account
  }

  return (
    <AuthShell
      title="Reset your password"
      sub={sent ? undefined : "Enter your email and we will send you a link to choose a new password."}
      footer={
        <Link href="/signin" className="font-bold text-ink underline">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <p role="status" className="rounded-2xl bg-carbon p-4 text-base text-ink">
          If there is an account for {email.trim()}, a reset link is on its way. It may take a minute. Check your spam folder too.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Email">
            <input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" className={authInput} />
          </Field>
          <FormError>{error}</FormError>
          <button type="submit" disabled={busy} className={authButton}>
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

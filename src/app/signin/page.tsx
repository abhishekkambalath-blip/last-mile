"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthShell, { authButton, authInput, Field, FormError } from "@/components/AuthShell";
import PasswordInput from "@/components/PasswordInput";
import { authMessage, isEmail } from "@/lib/authRules";
import { browserClient } from "@/lib/supabase";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const c = browserClient();
    if (!c) return setError("Accounts are not set up on this server yet.");
    if (!isEmail(email)) return setError("Enter a valid email address.");
    if (!password) return setError("Enter your password.");
    setBusy(true);
    const { error: err } = await c.auth.signInWithPassword({ email: email.trim(), password });
    if (err && (err.code === "email_not_confirmed" || /not confirmed/i.test(err.message))) {
      // They never finished verifying: send a fresh code and take them to the code screen.
      await c.auth.resend({ type: "signup", email: email.trim() });
      return router.push(`/verify?email=${encodeURIComponent(email.trim())}`);
    }
    setBusy(false);
    if (err) return setError(authMessage(err));
    // Signed in: the page gate takes it from here and opens the app.
  }

  return (
    <AuthShell
      title="Welcome back"
      sub="Sign in to see your plan and your runs."
      footer={
        <>
          New to Last Mile?{" "}
          <Link href="/signup" className="font-bold text-ink underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email">
          <input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" className={authInput} />
        </Field>
        <Field label="Password">
          <PasswordInput value={password} onChange={setPassword} label="Password" autoComplete="current-password" />
        </Field>
        <div className="text-right">
          <Link href="/forgot" className="text-sm font-bold text-subtext hover:text-ink">
            Forgot password?
          </Link>
        </div>
        <FormError>{error}</FormError>
        <button type="submit" disabled={busy} className={authButton}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}

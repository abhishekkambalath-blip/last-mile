"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthShell, { authButton, authInput, Field, FormError } from "@/components/AuthShell";
import PasswordInput from "@/components/PasswordInput";
import { authMessage, isEmail, passwordProblem, passwordStrength } from "@/lib/authRules";
import { browserClient } from "@/lib/supabase";

const BARS = ["Too weak", "Weak", "Good", "Strong"];
const COLORS = ["#ef4444", "#f59e0b", "#2ac4bd", "#22c55e"];

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const strength = passwordStrength(password);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const c = browserClient();
    if (!c) return setError("Accounts are not set up on this server yet.");
    if (!name.trim()) return setError("Enter your name.");
    if (!isEmail(email)) return setError("Enter a valid email address.");
    const bad = passwordProblem(password);
    if (bad) return setError(bad);
    if (password !== confirm) return setError("The two passwords do not match.");
    setBusy(true);
    const { data, error: err } = await c.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() }, emailRedirectTo: `${window.location.origin}/verify` } });
    setBusy(false);
    if (err) return setError(authMessage(err));
    // Supabase answers a repeat sign-up for a verified email with a user that has no identities.
    if (data.user && data.user.identities?.length === 0) return setError(authMessage({ code: "user_already_exists" }));
    if (data.session) return router.replace("/new"); // email confirmation is switched off in Supabase
    router.push(`/verify?email=${encodeURIComponent(email.trim())}`);
  }

  return (
    <AuthShell
      title="Create your account"
      sub="Save your plan and runs, and pick them up on any device."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/signin" className="font-bold text-ink underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} placeholder="Your name" className={authInput} />
        </Field>
        <Field label="Email">
          <input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" className={authInput} />
        </Field>
        <Field
          label="Password"
          hint={
            password && (
              <span className="flex items-center gap-2">
                <span className="flex flex-1 gap-1" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i < strength ? COLORS[strength] : "#2a2f3a" }} />
                  ))}
                </span>
                <span>{BARS[strength]}</span>
              </span>
            )
          }
        >
          <PasswordInput value={password} onChange={setPassword} label="Password" autoComplete="new-password" placeholder="8+ characters and a number" />
        </Field>
        <Field label="Confirm password">
          <PasswordInput value={confirm} onChange={setConfirm} label="Confirm password" autoComplete="new-password" placeholder="Type it again" />
        </Field>
        <FormError>{error}</FormError>
        <button type="submit" disabled={busy} className={authButton}>
          {busy ? "Creating…" : "Create account"}
        </button>
        <p className="text-center text-xs text-muted">We will email you a 6-digit code to confirm your address.</p>
      </form>
    </AuthShell>
  );
}

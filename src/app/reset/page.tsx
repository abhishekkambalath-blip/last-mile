"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthShell, { authButton, Field, FormError } from "@/components/AuthShell";
import PasswordInput from "@/components/PasswordInput";
import { authMessage, passwordProblem } from "@/lib/authRules";
import { useAuth } from "@/lib/auth";
import { browserClient } from "@/lib/supabase";

/** Where the reset link in the email lands. Supabase signs the runner in with the link, then they choose a new password. */
export default function ResetPage() {
  const router = useRouter();
  const auth = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const c = browserClient();
    if (!c) return setError("Accounts are not set up on this server yet.");
    const bad = passwordProblem(password);
    if (bad) return setError(bad);
    if (password !== confirm) return setError("The two passwords do not match.");
    setBusy(true);
    const { error: err } = await c.auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(authMessage(err));
    router.replace("/new");
  }

  if (auth.status === "loading") return <AuthShell title="One moment…">{null}</AuthShell>;
  if (auth.status !== "in")
    return (
      <AuthShell
        title="This link has expired"
        sub="Reset links work once and only for a short time."
        footer={
          <Link href="/forgot" className="font-bold text-ink underline">
            Send me a new link
          </Link>
        }
      >
        {null}
      </AuthShell>
    );

  return (
    <AuthShell title="Choose a new password" sub="Pick one you have not used before.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="New password">
          <PasswordInput value={password} onChange={setPassword} label="New password" autoComplete="new-password" placeholder="8+ characters and a number" />
        </Field>
        <Field label="Confirm new password">
          <PasswordInput value={confirm} onChange={setConfirm} label="Confirm new password" autoComplete="new-password" placeholder="Type it again" />
        </Field>
        <FormError>{error}</FormError>
        <button type="submit" disabled={busy} className={authButton}>
          {busy ? "Saving…" : "Save password"}
        </button>
      </form>
    </AuthShell>
  );
}

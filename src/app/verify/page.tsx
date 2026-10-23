"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import AuthShell, { authButton, FormError } from "@/components/AuthShell";
import { authMessage } from "@/lib/authRules";
import { useAuth } from "@/lib/auth";
import { browserClient } from "@/lib/supabase";

const RESEND_SECONDS = 30;
const search = () => window.location.search;
const noop = () => () => {};

export default function VerifyPage() {
  const router = useRouter();
  const auth = useAuth();
  const email = new URLSearchParams(useSyncExternalStore(noop, search, () => "")).get("email") ?? "";
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNote("");
    const c = browserClient();
    if (!c) return setError("Accounts are not set up on this server yet.");
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code from your email.");
    setBusy(true);
    const { error: err } = await c.auth.verifyOtp({ email, token: code, type: "signup" });
    setBusy(false);
    if (err) return setError(authMessage(err));
  }

  async function resend() {
    setError("");
    const c = browserClient();
    if (!c || wait > 0) return;
    const { error: err } = await c.auth.resend({ type: "signup", email });
    if (err) return setError(authMessage(err));
    setNote("A new code is on its way.");
    setWait(RESEND_SECONDS);
  }

  // The code worked: the session exists and the runner is signed in.
  if (auth.status === "in")
    return (
      <AuthShell title="You're all set" sub="Your email is confirmed and your account is ready.">
        <div className="mb-6 flex justify-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#2ac4bd] text-void" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7" />
            </svg>
          </span>
        </div>
        <button type="button" onClick={() => router.replace("/new")} className={authButton}>
          Build my plan
        </button>
      </AuthShell>
    );

  return (
    <AuthShell
      title="Check your email"
      sub={email ? `We sent a 6-digit code to ${email}.` : "Enter the 6-digit code we emailed you."}
      footer={
        <>
          Wrong address?{" "}
          <Link href="/signup" className="font-bold text-ink underline">
            Start again
          </Link>
        </>
      }
    >
      <form onSubmit={verify} className="space-y-4" noValidate>
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          aria-label="6-digit code"
          placeholder="000000"
          className="h-16 w-full rounded-2xl border border-line bg-carbon text-center text-3xl font-extrabold tracking-[0.5em] text-ink outline-none placeholder:text-muted focus:border-[#2f7bff] focus:ring-2 focus:ring-[#2f7bff]/50"
        />
        <FormError>{error}</FormError>
        {note && (
          <p role="status" className="text-sm text-subtext">
            {note}
          </p>
        )}
        <button type="submit" disabled={busy} className={authButton}>
          {busy ? "Checking…" : "Verify"}
        </button>
        <button type="button" onClick={resend} disabled={wait > 0} className="h-11 w-full text-sm font-bold text-subtext hover:text-ink disabled:opacity-60">
          {wait > 0 ? `Send a new code in ${wait}s` : "Send a new code"}
        </button>
      </form>
    </AuthShell>
  );
}

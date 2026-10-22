"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { PriceBadge } from "@/components/PriceBadge";
import RunnerIcon from "@/components/RunnerIcon";
import { saveAccount, useAccount, type Account } from "@/lib/account";
import { useSubscribed } from "@/lib/subscription";

type Field = "name" | "email" | "dob" | "gender" | "injury";

const GENDERS = ["Male", "Female", "Other", "Prefer not to say"];

const input =
  "h-12 w-full rounded-xl border border-line bg-carbon px-4 text-base text-ink placeholder:text-muted outline-none transition focus:border-[#2f7bff] focus:ring-2 focus:ring-[#2f7bff]/50";

const chevron = (open: boolean) => (
  <svg viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 text-muted transition-transform ${open ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** The date picker. It is its own component so the current date is only read once it is on screen. */
function DobInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input type="date" max={todayIso()} className={input} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Date of birth" />;
}

/** One row of the profile: a small label, the saved value, and an editor that opens when tapped. */
function Row({ label, value, placeholder, open, onToggle, children }: { label: string; value: string; placeholder: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div>
      <div className="px-1 pb-1.5 pt-5 text-xs font-bold uppercase tracking-wider text-muted">{label}</div>
      <div className="overflow-hidden rounded-2xl border border-line bg-elevated">
        <button type="button" aria-expanded={open} onClick={onToggle} className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-4 text-left text-base">
          <span className={`min-w-0 truncate ${value ? "text-ink" : "text-muted"}`}>{value || placeholder}</span>
          {chevron(open)}
        </button>
        {open && <div className="space-y-3 border-t border-line p-4">{children}</div>}
      </div>
    </div>
  );
}

function Editor({ onSave, onCancel, error, children }: { onSave: () => void; onCancel: () => void; error?: string; children: ReactNode }) {
  return (
    <>
      {children}
      {error && (
        <p role="alert" className="text-sm text-vo2">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="h-11 flex-1 rounded-full bg-carbon font-bold text-subtext hover:text-ink">
          Cancel
        </button>
        <button type="button" onClick={onSave} className="h-11 flex-1 rounded-full bg-volt font-bold text-void hover:brightness-110">
          Save
        </button>
      </div>
    </>
  );
}

export default function ProfilePage() {
  const account = useAccount();
  const subscribed = useSubscribed();
  const [open, setOpen] = useState<Field | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  function toggle(field: Field) {
    if (open === field) return setOpen(null);
    setOpen(field);
    setDraft(account[field]);
    setError("");
  }

  function save(field: Field, value: string) {
    const v = value.trim();
    if (field === "email" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return setError("Enter a valid email address.");
    if (field === "dob" && v && !(v < todayIso() && v > "1900-01-01")) return setError("Pick a date of birth in the past.");
    saveAccount({ [field]: v } as Partial<Account>);
    setOpen(null);
  }

  const dobLabel = account.dob ? new Date(`${account.dob}T00:00:00`).toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
  const initial = account.name.trim().charAt(0).toUpperCase();
  const cancel = () => setOpen(null);

  return (
    <div className="flex flex-1 flex-col pb-16">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-md items-center px-4">
          <Link href="/today" aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-white/10">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
          <h1 className="flex-1 pr-10 text-center text-lg font-extrabold">Edit Profile</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md px-4">
        {/* Avatar */}
        <div className="flex justify-center pt-7">
          <div className="relative">
            <span className="flex h-32 w-32 items-center justify-center rounded-full bg-brand text-6xl font-semibold text-white" aria-hidden="true">
              {initial || <RunnerIcon className="h-14 w-14" />}
            </span>
            <button
              type="button"
              aria-label="Edit name"
              onClick={() => toggle("name")}
              className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-[#e4e9f3] text-void shadow-lg ring-4 ring-void"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 20h4L19 9l-4-4L4 16z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Subscription */}
        <Link href="/subscribe" className="mt-7 flex items-center gap-3 rounded-2xl p-4 text-white transition hover:brightness-110" style={{ background: "linear-gradient(135deg,#0b3a8a,#16264a)" }}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 18l-1-10 5 4 4-7 4 7 5-4-1 10z" />
            </svg>
          </span>
          <span className="flex-1">
            <span className="block text-xs font-bold uppercase tracking-wider text-white/70">Subscription</span>
            <span className="block text-lg font-extrabold">{subscribed ? "Annual · active" : "Free plan"}</span>
            <span className="block text-sm text-white/75">{subscribed ? "Your full plan is unlocked." : "Unlock every week up to race day."}</span>
          </span>
          {subscribed ? <span className="rounded-full bg-[#2ac4bd] px-3 py-1 text-xs font-extrabold text-void">ACTIVE</span> : <PriceBadge />}
        </Link>

        <Row label="Name" value={account.name} placeholder="Add your name" open={open === "name"} onToggle={() => toggle("name")}>
          <Editor onSave={() => save("name", draft)} onCancel={cancel} error={error}>
            <input autoFocus className={input} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Your name" aria-label="Name" maxLength={60} />
          </Editor>
        </Row>

        <Row label="Email" value={account.email} placeholder="Add your email" open={open === "email"} onToggle={() => toggle("email")}>
          <Editor onSave={() => save("email", draft)} onCancel={cancel} error={error}>
            <input autoFocus type="email" inputMode="email" className={input} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="you@example.com" aria-label="Email" />
          </Editor>
        </Row>

        <Row label="Date of birth" value={dobLabel} placeholder="Select" open={open === "dob"} onToggle={() => toggle("dob")}>
          <Editor onSave={() => save("dob", draft)} onCancel={cancel} error={error}>
            <DobInput value={draft} onChange={setDraft} />
          </Editor>
        </Row>

        <Row label="Gender" value={account.gender} placeholder="Select" open={open === "gender"} onToggle={() => toggle("gender")}>
          <div className="flex flex-wrap gap-2">
            {GENDERS.map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={account.gender === g}
                onClick={() => {
                  saveAccount({ gender: g });
                  setOpen(null);
                }}
                className={`h-11 rounded-full px-5 text-sm font-bold transition ${account.gender === g ? "bg-volt text-void" : "bg-carbon text-subtext hover:text-ink"}`}
              >
                {g}
              </button>
            ))}
          </div>
        </Row>

        <Row label="Injury history" value={account.injury} placeholder="Select" open={open === "injury"} onToggle={() => toggle("injury")}>
          <Editor onSave={() => save("injury", draft)} onCancel={cancel} error={error}>
            <textarea
              autoFocus
              rows={3}
              className={`${input} h-auto py-3`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Past or current injuries, e.g. knee pain after my first 10K"
              aria-label="Injury history"
              maxLength={500}
            />
            <p className="text-xs text-subtext">When you build a plan, this is filled in for you as your injury note.</p>
          </Editor>
        </Row>

        <p className="mt-6 text-center text-xs text-muted">Your details are saved on this device only.</p>
      </main>
    </div>
  );
}

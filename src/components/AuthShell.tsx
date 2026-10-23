import type { ReactNode } from "react";
import { backendOn } from "@/lib/supabase";

export const authInput =
  "h-14 w-full rounded-2xl border border-line bg-carbon px-4 text-base text-ink placeholder:text-muted outline-none transition focus:border-[#2f7bff] focus:ring-2 focus:ring-[#2f7bff]/50";
export const authButton = "flex h-14 w-full items-center justify-center rounded-full bg-volt text-lg font-bold text-void transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60";

/** The page frame for sign in, sign up, verify and reset: a heading, a short line, the form and a footer link. */
export default function AuthShell({ title, sub, children, footer }: { title: string; sub?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex flex-1 justify-center px-5 pb-10 pt-10">
      <main className="w-full max-w-md">
        <p className="text-center text-3xl font-extrabold leading-tight tracking-tight">Last Mile</p>
        <h1 className="mt-8 text-3xl font-extrabold leading-tight">{title}</h1>
        {sub && <p className="mt-2 text-base text-subtext">{sub}</p>}
        {!backendOn && (
          <p role="status" className="mt-6 rounded-2xl bg-carbon p-4 text-sm text-subtext">
            Accounts are not set up on this server yet. Add the Supabase keys (see supabase/README.md) to turn on sign up and sign in.
          </p>
        )}
        <div className="mt-6">{children}</div>
        {footer && <div className="mt-6 text-center text-sm text-subtext">{footer}</div>}
      </main>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-subtext">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-sm text-muted">{hint}</span>}
    </label>
  );
}

export function FormError({ children }: { children?: ReactNode }) {
  return children ? (
    <p role="alert" className="rounded-2xl bg-[#3a1d22] p-3 text-sm text-vo2">
      {children}
    </p>
  ) : null;
}

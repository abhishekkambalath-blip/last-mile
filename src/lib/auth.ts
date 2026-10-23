"use client";

import { useSyncExternalStore } from "react";
import { saveAccount } from "@/lib/account";
import { backendOn, browserClient } from "@/lib/supabase";
import { clearLocalData, pullAll, resetSync } from "@/lib/sync";

// Who is signed in. Supabase Auth keeps the session (and refreshes it); this file keeps the app's view of it.
// "off" means no backend is set up, so the app works for one person in this browser without an account.
export type AuthState = { status: "off" | "loading" | "in" | "out"; email: string | null };

const UID_KEY = "last-mile:uid";
let state: AuthState = backendOn ? { status: "loading", email: null } : { status: "off", email: null };
const listeners = new Set<() => void>();
const set = (next: AuthState) => {
  if (next.status === state.status && next.email === state.email) return;
  state = next;
  listeners.forEach((l) => l());
};

let started = false;
let currentUid: string | null = null;

type Sess = { user: { id: string; email?: string; is_anonymous?: boolean; email_confirmed_at?: string | null; user_metadata?: { name?: string } } } | null;

function apply(session: Sess) {
  const u = session?.user;
  // Only a real account with a verified email counts. A leftover guest session is dropped.
  if (!u || u.is_anonymous || !u.email || !u.email_confirmed_at) {
    if (u?.is_anonymous) void browserClient()?.auth.signOut();
    currentUid = null;
    set({ status: "out", email: null });
    return;
  }
  set({ status: "in", email: u.email });
  if (currentUid === u.id) return; // a refreshed token, not a new sign-in
  currentUid = u.id;
  try {
    const prev = localStorage.getItem(UID_KEY);
    if (prev && prev !== u.id) clearLocalData(); // a different person: never mix their data with the last one's
    localStorage.setItem(UID_KEY, u.id);
  } catch {}
  resetSync();
  // Saved data from before there were accounts is kept and uploaded to this account; otherwise the account's data is loaded.
  void pullAll().then(() => {
    try {
      const a = JSON.parse(localStorage.getItem("last-mile:account") ?? "{}") as { name?: string; email?: string };
      if (!a.email || (!a.name && u.user_metadata?.name)) saveAccount({ email: a.email || u.email!, name: a.name || u.user_metadata?.name || "" });
    } catch {}
  });
}

/** Starts watching the session. Safe to call many times. */
export function startAuth() {
  if (started || !backendOn) return;
  started = true;
  const c = browserClient()!;
  void c.auth.getSession().then(({ data }) => apply(data.session as Sess));
  // Do not call other auth methods inside this callback; hand the work to the next tick.
  c.auth.onAuthStateChange((_event, session) => setTimeout(() => apply(session as Sess), 0));
}

export function useAuth(): AuthState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}

/** Signs out and removes this browser's copy of the runner's data, so the next person on this device sees none of it. */
export async function signOut() {
  try {
    await browserClient()?.auth.signOut();
  } catch {}
  clearLocalData();
  try {
    localStorage.removeItem(UID_KEY);
  } catch {}
  currentUid = null;
  resetSync();
  set({ status: "out", email: null });
}

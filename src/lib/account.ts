"use client";

import { useMemo, useSyncExternalStore } from "react";
import { pushAthleteSoon } from "@/lib/sync";

/** The runner's profile details. Kept in this browser and, when the backend is on, saved to Supabase too. */
export type Account = { name: string; email: string; dob: string; gender: string; injury: string };

export const EMPTY_ACCOUNT: Account = { name: "", email: "", dob: "", gender: "", injury: "" };

const KEY = "last-mile:account";
const EVENT = "last-mile:account-changed";

const read = () => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};

function parse(raw: string): Account {
  try {
    return { ...EMPTY_ACCOUNT, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return EMPTY_ACCOUNT;
  }
}

/** Saves some of the details and keeps the rest as they were. */
export function saveAccount(patch: Partial<Account>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...parse(read()), ...patch }));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
  pushAthleteSoon();
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

/** The saved profile details. Empty during server render. */
export function useAccount(): Account {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  return useMemo(() => parse(raw), [raw]);
}

/** The first name, or an empty string when there is no name yet. */
export const firstName = (a: Account) => a.name.trim().split(/\s+/)[0] ?? "";

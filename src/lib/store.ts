"use client";

import { useMemo, useSyncExternalStore } from "react";
import { PLAN_STORAGE_KEY, type Plan, type Profile } from "@/lib/plan";

export type Saved = { profile: Profile; plan: Plan | null };

const EVENT = "last-mile:store";

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

// The raw string is the snapshot, so React sees a stable value until storage really changes.
const getRaw = () => {
  try {
    return localStorage.getItem(PLAN_STORAGE_KEY);
  } catch {
    return null;
  }
};

export function writeSaved(saved: Saved | null) {
  try {
    if (saved) localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(saved));
    else localStorage.removeItem(PLAN_STORAGE_KEY);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

/** The runner's answers and plan from this browser. `ready` is false during server render. */
export function useSaved(): { saved: Saved | null; ready: boolean } {
  const raw = useSyncExternalStore(subscribe, getRaw, () => undefined);
  return useMemo(() => {
    if (raw === undefined) return { saved: null, ready: false };
    try {
      return { saved: raw ? (JSON.parse(raw) as Saved) : null, ready: true };
    } catch {
      return { saved: null, ready: true };
    }
  }, [raw]);
}

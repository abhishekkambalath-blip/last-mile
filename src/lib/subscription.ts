"use client";

import { useSyncExternalStore } from "react";
import { accessToken, backendOn } from "@/lib/supabase";

const KEY = "last-mile:subscription";
const EVENT = "last-mile:subscription-changed";

function setLocal(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, "active");
    else localStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

/**
 * Prototype only: no payment is taken. With the backend on, the server records the status for the
 * signed-in runner. A real subscription also needs a payment provider that confirms the payment.
 * Returns false if the server refused, in which case nothing changes.
 */
export async function setSubscribed(on: boolean): Promise<boolean> {
  if (!backendOn) {
    setLocal(on);
    return true;
  }
  try {
    const token = await accessToken();
    const res = await fetch("/api/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: on ? "active" : "free" }),
    });
    if (!res.ok) return false;
    setLocal(on);
    return true;
  } catch {
    return false;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

const read = () => {
  try {
    return localStorage.getItem(KEY) === "active";
  } catch {
    return false;
  }
};

/** True when the runner has subscribed. False during server render. */
export function useSubscribed(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}

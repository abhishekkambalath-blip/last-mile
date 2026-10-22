"use client";

import { useSyncExternalStore } from "react";

const KEY = "last-mile:subscription";
const EVENT = "last-mile:subscription-changed";

/**
 * Prototype only. Whether the runner has "subscribed" is a flag in this browser, and no payment is taken.
 * A real subscription needs sign-in, a payment provider, and a server that decides what a runner may see.
 */
export function setSubscribed(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, "active");
    else localStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
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

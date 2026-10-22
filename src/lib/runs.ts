"use client";

import { useMemo, useSyncExternalStore } from "react";

export type CheckIn = { effort: number; feeling: string };

export type Run = {
  id: string;
  date: string; // ISO timestamp
  source: "gps" | "manual";
  distanceKm: number;
  durationSec: number;
  paceMinPerKm: string;
  flagged: boolean; // a GPS pace spike: a person should look at this before the plan changes
  route?: [number, number][]; // simplified GPS route as [lat, lng]; manual runs have none
  checkIn?: CheckIn;
};

const KEY = "last-mile:runs";
const EVENT = "last-mile:runs-changed";

/**
 * Storage for the prototype lives in this browser. Feature 3 needs a shared athlete
 * database (e.g. Supabase); swap these two functions and nothing else has to change.
 */
export function loadRuns(): Run[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveRun(run: Run) {
  const runs = loadRuns().filter((r) => r.id !== run.id);
  runs.unshift(run);
  try {
    localStorage.setItem(KEY, JSON.stringify(runs));
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

const getRaw = () => {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
};

/** Saved runs, kept up to date when a run is saved. Empty during server render. */
export function useRuns(): Run[] {
  const raw = useSyncExternalStore(subscribe, getRaw, () => "[]");
  return useMemo(() => {
    try {
      return JSON.parse(raw) as Run[];
    } catch {
      return [];
    }
  }, [raw]);
}

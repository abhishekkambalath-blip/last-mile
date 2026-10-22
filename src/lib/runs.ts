export type CheckIn = { effort: number; feeling: string };

export type Run = {
  id: string;
  date: string; // ISO timestamp
  source: "gps" | "manual";
  distanceKm: number;
  durationSec: number;
  paceMinPerKm: string;
  flagged: boolean; // a GPS pace spike: a person should look at this before the plan changes
  checkIn?: CheckIn;
};

const KEY = "last-mile:runs";

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
}

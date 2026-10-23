"use client";

import { PLAN_STORAGE_KEY } from "@/lib/plan";
import { accessToken, backendOn, browserClient } from "@/lib/supabase";

// The browser copy is what the screens read. When the backend is on, it is also saved to Supabase,
// and on start-up the Supabase copy is pulled back in, so the same runner sees the same data on any device.
const ACCOUNT_KEY = "last-mile:account";
const RUNS_KEY = "last-mile:runs";
const SUB_KEY = "last-mile:subscription";
const STAMP_KEY = "last-mile:synced-at";

const EVENTS = {
  saved: "last-mile:store",
  account: "last-mile:account-changed",
  runs: "last-mile:runs-changed",
  subscription: "last-mile:subscription-changed",
};

const get = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const set = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {}
};

/** Saves the profile details and plan in one row. Does nothing when the backend is off. */
export async function pushAthlete() {
  const c = browserClient();
  if (!c || !(await accessToken())) return;
  const { data } = await c.auth.getUser();
  if (!data.user) return;
  const now = new Date().toISOString();
  const saved = get(PLAN_STORAGE_KEY);
  const { error } = await c.from("athletes").upsert({
    user_id: data.user.id,
    account: JSON.parse(get(ACCOUNT_KEY) ?? "{}"),
    saved: saved ? JSON.parse(saved) : null,
    updated_at: now,
  });
  if (!error) set(STAMP_KEY, now);
}

export async function pushRun(run: { id: string; date: string }) {
  const c = browserClient();
  if (!c || !(await accessToken())) return;
  const { data } = await c.auth.getUser();
  if (!data.user) return;
  await c.from("runs").upsert({ id: run.id, user_id: data.user.id, data: run, ran_at: run.date, updated_at: new Date().toISOString() });
}

let timer: ReturnType<typeof setTimeout> | undefined;
/** Saves soon, and only once for a burst of edits. */
export function pushAthleteSoon() {
  if (!backendOn) return;
  clearTimeout(timer);
  timer = setTimeout(() => void pushAthlete(), 600);
}

let pulled: Promise<void> | null = null;

/** Forgets that a pull happened, so the next pullAll() reads the server again (after signing in as someone else). */
export function resetSync() {
  pulled = null;
  clearTimeout(timer);
}

/** Removes this browser's copy of the runner's data: when someone signs out, or a different person signs in. */
export function clearLocalData() {
  for (const k of [PLAN_STORAGE_KEY, ACCOUNT_KEY, RUNS_KEY, SUB_KEY, STAMP_KEY]) set(k, null);
  for (const e of Object.values(EVENTS)) window.dispatchEvent(new Event(e));
}

/** Brings the runner's saved data in from Supabase. Newer data wins; runs from both sides are kept. */
export function pullAll(): Promise<void> {
  if (!backendOn) return Promise.resolve();
  pulled ??= (async () => {
    const c = browserClient();
    if (!c || !(await accessToken())) return;
    const { data: u } = await c.auth.getUser();
    if (!u.user) return;
    const uid = u.user.id;

    const { data: row } = await c.from("athletes").select("account, saved, updated_at").eq("user_id", uid).maybeSingle();
    const stamp = get(STAMP_KEY) ?? "";
    const localHas = Boolean(get(PLAN_STORAGE_KEY) || get(ACCOUNT_KEY));
    if (row && (!localHas || row.updated_at > stamp)) {
      set(ACCOUNT_KEY, JSON.stringify(row.account ?? {}));
      set(PLAN_STORAGE_KEY, row.saved ? JSON.stringify(row.saved) : null);
      set(STAMP_KEY, row.updated_at);
      window.dispatchEvent(new Event(EVENTS.account));
      window.dispatchEvent(new Event(EVENTS.saved));
    } else if (localHas) {
      await pushAthlete();
    }

    const { data: remote } = await c.from("runs").select("data").eq("user_id", uid).order("ran_at", { ascending: false }).limit(500);
    const local: { id: string; date: string }[] = JSON.parse(get(RUNS_KEY) ?? "[]");
    const byId = new Map<string, { id: string; date: string }>();
    for (const r of (remote ?? []).map((x) => x.data as { id: string; date: string })) byId.set(r.id, r);
    const missingRemote = local.filter((r) => !byId.has(r.id));
    for (const r of local) if (!byId.has(r.id)) byId.set(r.id, r);
    const merged = [...byId.values()].sort((a, b) => b.date.localeCompare(a.date));
    set(RUNS_KEY, JSON.stringify(merged));
    window.dispatchEvent(new Event(EVENTS.runs));
    await Promise.all(missingRemote.map(pushRun));

    const { data: sub } = await c.from("subscriptions").select("status").eq("user_id", uid).maybeSingle();
    set(SUB_KEY, sub?.status === "active" ? "active" : null);
    window.dispatchEvent(new Event(EVENTS.subscription));
  })().catch(() => {
    pulled = null;
  });
  return pulled;
}

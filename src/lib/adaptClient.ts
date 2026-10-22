"use client";

import { adaptPlan } from "@/lib/adapt";
import { loadRuns } from "@/lib/runs";
import { PLAN_STORAGE_KEY, type Plan } from "@/lib/plan";
import { type Saved, writeSaved } from "@/lib/store";
import { accessToken, backendOn } from "@/lib/supabase";
import { pushAthlete, pushRun } from "@/lib/sync";

export type AdaptResult = { changed: boolean; held: boolean; message: string };

/**
 * Asks to adapt the next sessions after a run. With the backend on, the server decides from the
 * runner's saved data; without it, the same rules run here. The plan is saved if it changed.
 */
export async function adaptAfterRun(): Promise<AdaptResult | null> {
  let saved: Saved | null = null;
  try {
    saved = JSON.parse(localStorage.getItem(PLAN_STORAGE_KEY) ?? "null");
  } catch {}
  if (!saved?.plan) return null;

  if (backendOn) {
    try {
      await Promise.all([pushAthlete(), ...loadRuns().slice(0, 1).map(pushRun)]); // the server needs the latest plan and run first
      const res = await fetch("/api/adapt", { method: "POST", headers: { Authorization: `Bearer ${await accessToken()}` } });
      if (res.ok) {
        const out = (await res.json()) as { changed: boolean; held: boolean; message: string; plan?: Plan };
        if (out.changed && out.plan) writeSaved({ ...saved, plan: out.plan });
        return { changed: out.changed, held: out.held, message: out.message };
      }
    } catch {}
  }

  const out = adaptPlan(saved.plan, saved.profile, saved.createdAt, loadRuns());
  if (out.changed) writeSaved({ ...saved, plan: out.plan });
  return { changed: out.changed, held: out.held ?? false, message: out.message };
}

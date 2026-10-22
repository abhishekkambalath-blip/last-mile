"use client";

import { formatPace } from "@/lib/gps";
import { saveRun, type Run } from "@/lib/runs";
import { accessToken } from "@/lib/supabase";

export type DeviceInfo = { id: string; name: string; note: string; state: "available" | "not-configured" | "coming-soon"; connected: boolean; lastSyncedAt: string | null };

async function call(path: string, method: "GET" | "POST" | "DELETE") {
  const token = await accessToken();
  if (!token) throw new Error("We could not sign you in. Check your connection and try again.");
  const res = await fetch(path, { method, headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? "Something went wrong. Try again.");
  return body;
}

export async function loadDevices(): Promise<{ ready: boolean; devices: DeviceInfo[] }> {
  return call("/api/devices", "GET");
}

/** Sends the runner to the band's own login page. */
export async function connectDevice(id: string) {
  const { url } = (await call(`/api/devices/${id}/connect`, "POST")) as { url: string };
  window.location.assign(url);
}

export const disconnectDevice = (id: string) => call(`/api/devices/${id}`, "DELETE");

/** Reads new running workouts from the band and saves them as runs. Returns how many were read. */
export async function syncDevice(id: string, name: string): Promise<number> {
  const { runs } = (await call(`/api/devices/${id}/sync`, "POST")) as { runs: { externalId: string; start: string; distanceKm: number; durationSec: number }[] };
  for (const r of runs) {
    const run: Run = {
      id: `${id}-${r.externalId}`, // the same workout always gets the same id, so syncing twice never doubles it
      date: new Date(r.start).toISOString(),
      source: "device",
      device: name,
      distanceKm: Math.round(r.distanceKm * 100) / 100,
      durationSec: r.durationSec,
      paceMinPerKm: formatPace(r.distanceKm * 1000, r.durationSec),
      flagged: false,
    };
    saveRun(run);
  }
  return runs.length;
}

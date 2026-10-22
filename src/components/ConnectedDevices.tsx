"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CATALOG } from "@/lib/devices/catalog";
import { connectDevice, disconnectDevice, loadDevices, syncDevice, type DeviceInfo } from "@/lib/devices/client";
import { backendOn } from "@/lib/supabase";

const search = () => window.location.search;
const noop = () => () => {};

const ERRORS: Record<string, string> = {
  denied: "You chose not to share your data, so nothing was connected.",
  expired: "That sign-in took too long. Please try again.",
  failed: "We could not finish connecting. Please try again.",
  server: "The server is not set up for fitness bands yet.",
};

const ago = (iso: string | null) => (iso ? `Last synced ${new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` : "Not synced yet");

/** The "Connected devices" part of the profile: connect, sync and disconnect fitness bands. */
export default function ConnectedDevices() {
  const [data, setData] = useState<{ ready: boolean; devices: DeviceInfo[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const query = useSyncExternalStore(noop, search, () => "");
  const fromRedirect = new URLSearchParams(query).get("device_error");

  // The server says which bands can be connected and which this runner has connected.
  useEffect(() => {
    if (!backendOn) return;
    let alive = true;
    loadDevices()
      .then((d) => alive && setData(d))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  async function act(id: string, name: string, what: "connect" | "sync" | "disconnect") {
    setBusy(id);
    setError("");
    setNotice("");
    try {
      if (what === "connect") return await connectDevice(id);
      if (what === "sync") {
        const n = await syncDevice(id, name);
        setNotice(n === 0 ? `No new runs from ${name}.` : `Added ${n} run${n === 1 ? "" : "s"} from ${name}.`);
      } else {
        await disconnectDevice(id);
        setNotice(`${name} disconnected.`);
      }
      setData(await loadDevices());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  // Every band is listed from the start; the server adds who is connected once it answers.
  const rows: DeviceInfo[] = data?.devices ?? CATALOG.map((c) => ({ ...c, state: c.id === "coros" ? "coming-soon" : "available", connected: false, lastSyncedAt: null }));

  const pill = "h-10 rounded-full px-4 text-sm font-bold transition disabled:opacity-50";

  return (
    <section className="mt-6" aria-labelledby="devices-title">
      <h2 id="devices-title" className="px-1 pb-1.5 text-xs font-bold uppercase tracking-wider text-muted">
        Connected devices
      </h2>
      <div className="rounded-2xl border border-line bg-elevated p-4">
        <p className="text-sm text-subtext">Connect your fitness band and we will bring in your running workouts, so your plan follows what you really did.</p>

        {!backendOn && <p className="mt-3 rounded-xl bg-carbon p-3 text-sm text-subtext">Connecting needs the backend. Turn on Supabase (see supabase/README.md) and these buttons will work.</p>}
        {backendOn && data && !data.ready && <p className="mt-3 rounded-xl bg-carbon p-3 text-sm text-subtext">The server is missing its database or encryption key, so no device can be connected yet.</p>}
        <ul className="mt-3 divide-y divide-line">
          {rows.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-carbon text-sm font-extrabold text-ink" aria-hidden="true">
                {d.name.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-extrabold">{d.name}</div>
                <div className="text-sm text-subtext">{d.connected ? ago(d.lastSyncedAt) : d.state === "not-configured" && backendOn && data ? "Not set up on this server yet." : d.note}</div>
              </div>
              {d.connected ? (
                <div className="flex gap-2">
                  <button type="button" disabled={busy === d.id} onClick={() => act(d.id, d.name, "sync")} className={`${pill} bg-volt text-void hover:brightness-110`}>
                    {busy === d.id ? "Working…" : "Sync now"}
                  </button>
                  <button type="button" disabled={busy === d.id} onClick={() => act(d.id, d.name, "disconnect")} className={`${pill} bg-carbon text-subtext hover:text-ink`}>
                    Disconnect
                  </button>
                </div>
              ) : d.state === "coming-soon" ? (
                <span className="rounded-full bg-carbon px-3 py-1 text-xs font-bold text-muted">Coming soon</span>
              ) : (
                <button type="button" disabled={!backendOn || !data?.ready || d.state !== "available" || busy === d.id} onClick={() => act(d.id, d.name, "connect")} className={`${pill} bg-volt text-void hover:brightness-110`}>
                  Connect
                </button>
              )}
            </li>
          ))}
        </ul>

        {(error || (fromRedirect && ERRORS[fromRedirect])) && (
          <p role="alert" className="mt-3 text-sm text-vo2">
            {error || ERRORS[fromRedirect ?? ""]}
          </p>
        )}
        {notice && (
          <p role="status" className="mt-3 text-sm text-ink">
            {notice}
          </p>
        )}
        <p className="mt-3 text-xs text-muted">We only read running workouts. You can disconnect at any time, which also asks the band to stop sharing.</p>
      </div>
    </section>
  );
}

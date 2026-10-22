"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import BottomTabs from "@/components/BottomTabs";
import { addPoint, formatDuration, formatPace, newTrack, type Track } from "@/lib/gps";
import { loadRuns, saveRun, type Run } from "@/lib/runs";

type Phase = "idle" | "tracking" | "manual" | "checkin" | "saved";

const card = "rounded-xl border border-line bg-elevated p-5";
const input =
  "w-full rounded-md border border-line bg-carbon px-3 py-2.5 text-ink placeholder:text-muted outline-none transition focus:border-volt focus:ring-2 focus:ring-volt/30";
const label = "block space-y-1.5 font-mono-tech text-[11px] font-medium uppercase tracking-wider text-subtext";

const today = () => new Date().toISOString().slice(0, 10);

export default function RunPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [distanceM, setDistanceM] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [draft, setDraft] = useState<Run | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);

  const track = useRef<Track>(newTrack());
  const startedAt = useRef(0);
  const watchId = useRef<number | null>(null);
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    // Runs once on mount; localStorage isn't available during server render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRuns(loadRuns());
  }, []);

  // Timer while tracking.
  useEffect(() => {
    if (phase !== "tracking") return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const releaseWakeLock = useCallback(() => {
    wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
  }, []);

  const requestWakeLock = useCallback(async () => {
    try {
      wakeLock.current = (await navigator.wakeLock?.request("screen")) ?? null;
    } catch {
      // Not supported or denied: the run still records, the screen may just lock.
    }
  }, []);

  // The browser drops the wake lock when the tab is hidden; take it again when we're back.
  useEffect(() => {
    if (phase !== "tracking") return;
    const onVisible = () => document.visibilityState === "visible" && requestWakeLock();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [phase, requestWakeLock]);

  // Stop everything if the runner leaves the page.
  useEffect(
    () => () => {
      if (watchId.current !== null) navigator.geolocation?.clearWatch(watchId.current);
      releaseWakeLock();
    },
    [releaseWakeLock],
  );

  function start() {
    setError("");
    if (!navigator.geolocation) {
      setError("This browser can't read your location. Use manual entry instead.");
      return;
    }
    track.current = newTrack();
    setDistanceM(0);
    setElapsed(0);
    startedAt.current = Date.now();
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        addPoint(track.current, {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          t: pos.timestamp,
        });
        setDistanceM(track.current.distanceM);
      },
      (err) =>
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location is blocked. Allow it in your browser settings, or use manual entry."
            : "Can't get a GPS signal right now. Keep going, or use manual entry afterwards.",
        ),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    requestWakeLock();
    setPhase("tracking");
  }

  function stop() {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    releaseWakeLock();
    const seconds = Math.max(1, Math.floor((Date.now() - startedAt.current) / 1000));
    const dist = track.current.distanceM;
    if (dist < 50) {
      setError("We didn't record any distance. Use manual entry to log this run, or start again.");
      setPhase("idle");
      return;
    }
    setError("");
    setDraft({
      id: crypto.randomUUID(),
      date: new Date(startedAt.current).toISOString(),
      source: "gps",
      distanceKm: Math.round(dist / 10) / 100,
      durationSec: seconds,
      paceMinPerKm: formatPace(dist, seconds),
      flagged: track.current.spike,
    });
    setPhase("checkin");
  }

  function submitManual(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const km = Number(f.get("km"));
    const seconds = Number(f.get("min")) * 60 + Number(f.get("sec") || 0);
    if (!(km > 0 && km <= 100) || !(seconds > 0)) {
      setError("Enter a distance and a time.");
      return;
    }
    setError("");
    setDraft({
      id: crypto.randomUUID(),
      date: new Date(`${f.get("date") || today()}T12:00:00`).toISOString(),
      source: "manual",
      distanceKm: Math.round(km * 100) / 100,
      durationSec: seconds,
      paceMinPerKm: formatPace(km * 1000, seconds),
      flagged: false,
    });
    setPhase("checkin");
  }

  function submitCheckIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft) return;
    const f = new FormData(e.currentTarget);
    const run: Run = {
      ...draft,
      checkIn: { effort: Number(f.get("effort")), feeling: String(f.get("feeling") ?? "").trim().slice(0, 1000) },
    };
    saveRun(run);
    setRuns(loadRuns());
    setDraft(run);
    setPhase("saved");
  }

  const reset = () => {
    setDraft(null);
    setError("");
    setPhase("idle");
  };

  return (
    <div className="flex flex-1 justify-center px-4 pb-28 pt-6">
      <main className="w-full max-w-md space-y-6">
        <header className="flex items-center justify-between">
          <Link href="/plan" className="font-mono-tech text-[11px] uppercase tracking-wider text-subtext hover:text-ink">
            ← My plan
          </Link>
          <h1 className="font-athletic text-2xl font-bold uppercase tracking-widest text-ink">Record a run</h1>
          <span className="w-16" />
        </header>

        {error && (
          <p role="alert" className="rounded-md border border-vo2/40 bg-vo2/10 p-3 text-sm text-vo2">
            {error}
          </p>
        )}

        {phase === "idle" && (
          <section className={`${card} space-y-4 text-center`}>
            <p className="text-subtext">
              Tap Start, then keep this screen open while you run. Your phone&apos;s GPS tracks distance and pace.
            </p>
            <button
              onClick={start}
              className="mx-auto flex h-36 w-36 items-center justify-center rounded-full bg-volt font-athletic text-3xl font-bold uppercase tracking-widest text-void shadow-[0_0_40px_rgba(190,242,100,0.3)] transition hover:scale-105"
            >
              Start
            </button>
            <button
              onClick={() => {
                setError("");
                setPhase("manual");
              }}
              className="text-sm text-subtext underline hover:text-ink"
            >
              GPS not working? Enter a run manually
            </button>
          </section>
        )}

        {phase === "tracking" && (
          <section className={`${card} space-y-5 text-center`}>
            <div>
              <div className="font-mono-tech text-6xl font-semibold tabular-nums text-volt">
                {formatDuration(elapsed)}
              </div>
              <div className="text-sm text-muted">time</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-3xl font-semibold tabular-nums">{(distanceM / 1000).toFixed(2)}</div>
                <div className="text-sm text-muted">km</div>
              </div>
              <div>
                <div className="text-3xl font-semibold tabular-nums">{formatPace(distanceM, elapsed)}</div>
                <div className="text-sm text-muted">min / km</div>
              </div>
            </div>
            <button
              onClick={stop}
              className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-vo2 font-athletic text-2xl font-bold uppercase tracking-widest text-white shadow-[0_0_30px_rgba(239,68,68,0.3)] transition hover:scale-105"
            >
              Stop
            </button>
            <p className="text-xs text-muted">Keep the screen on. Tracking can pause if your phone locks.</p>
          </section>
        )}

        {phase === "manual" && (
          <form onSubmit={submitManual} className={`${card} space-y-4`}>
            <h2 className="font-athletic text-xl font-semibold uppercase tracking-widest">Enter your run</h2>
            <label className={label}>
              Date
              <input name="date" type="date" required defaultValue={today()} max={today()} className={input} />
            </label>
            <label className={label}>
              Distance (km)
              <input name="km" type="number" step="0.01" min="0.1" max="100" required inputMode="decimal" className={input} />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className={label}>
                Minutes
                <input name="min" type="number" min="0" required inputMode="numeric" className={input} />
              </label>
              <label className={label}>
                Seconds
                <input name="sec" type="number" min="0" max="59" defaultValue={0} inputMode="numeric" className={input} />
              </label>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={reset} className="flex-1 rounded-md border border-line py-2.5 text-subtext hover:text-ink">
                Cancel
              </button>
              <button className="flex-1 rounded-md bg-volt py-2.5 font-athletic text-base font-semibold uppercase tracking-widest text-void hover:brightness-110">
                Continue
              </button>
            </div>
          </form>
        )}

        {phase === "checkin" && draft && (
          <form onSubmit={submitCheckIn} className={`${card} space-y-4`}>
            <div className="rounded-md border border-line bg-carbon p-3 text-center">
              <div className="text-2xl font-bold">{draft.distanceKm} km</div>
              <div className="text-sm text-muted">
                {formatDuration(draft.durationSec)} · {draft.paceMinPerKm} min/km
              </div>
              {draft.flagged && (
                <p className="mt-2 text-xs text-threshold">
                  We saw a sudden jump in your GPS speed. A person will check this run before your plan changes.
                </p>
              )}
            </div>
            <h2 className="font-athletic text-xl font-semibold uppercase tracking-widest">Quick check-in</h2>
            <label className={label}>
              How hard did it feel? (1 = very easy, 10 = all out)
              <input name="effort" type="range" min="1" max="10" defaultValue="5" className="w-full accent-[#BEF264]" />
              <span className="flex justify-between text-xs text-muted">
                <span>1</span>
                <span>10</span>
              </span>
            </label>
            <label className={label}>
              How did it feel? Any pain?
              <textarea
                name="feeling"
                rows={3}
                placeholder="e.g. Felt good, my knee was a bit sore"
                className={input}
              />
            </label>
            <button className="w-full rounded-md bg-volt py-3 font-athletic text-base font-semibold uppercase tracking-widest text-void hover:brightness-110">
              Save run
            </button>
          </form>
        )}

        {phase === "saved" && draft && (
          <section className={`${card} space-y-3 text-center`}>
            <div className="text-4xl text-volt">✓</div>
            <h2 className="font-athletic text-2xl font-semibold uppercase tracking-widest">Run saved</h2>
            <p className="text-subtext">
              {draft.distanceKm} km in {formatDuration(draft.durationSec)}. Nice work.
            </p>
            <button onClick={reset} className="w-full rounded-md bg-volt py-3 font-athletic text-base font-semibold uppercase tracking-widest text-void hover:brightness-110">
              Done
            </button>
          </section>
        )}

        {runs.length > 0 && phase !== "tracking" && (
          <section className="space-y-2">
            <h2 className="font-mono-tech text-[11px] uppercase tracking-wider text-muted">Your runs</h2>
            <ul className="space-y-2">
              {runs.map((r) => (
                <li key={r.id} className={`${card} text-sm`}>
                  <div className="flex items-baseline justify-between">
                    <strong>{r.distanceKm} km</strong>
                    <span className="text-muted">{new Date(r.date).toLocaleDateString()}</span>
                  </div>
                  <div className="text-muted">
                    {formatDuration(r.durationSec)} · {r.paceMinPerKm} min/km · {r.source === "gps" ? "GPS" : "manual"}
                    {r.checkIn && ` · effort ${r.checkIn.effort}/10`}
                    {r.flagged && " · flagged"}
                  </div>
                  {r.checkIn?.feeling && <p className="mt-1 text-ink">&ldquo;{r.checkIn.feeling}&rdquo;</p>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      {/* Hidden mid-run so a stray tap can't leave the page and stop tracking. */}
      {phase !== "tracking" && <BottomTabs />}
    </div>
  );
}

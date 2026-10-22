"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import SessionCard from "@/components/SessionCard";
import PaywallDialog, { priceLabel } from "@/components/PaywallDialog";
import { FREE_WEEKS, goalLabel, levelOf, longestRunKm, phasesFor, weeksToRace, type Plan, type PlanDay, type Profile } from "@/lib/plan";
import { addDays, dateOf, estMinutes, SESSION_STYLE, sessionBg, startOfDay, stepsFor } from "@/lib/sessions";
import { useSubscribed } from "@/lib/subscription";

const card = "rounded-2xl bg-elevated p-5";
const label = "text-xs font-bold uppercase tracking-wider text-muted";

const PHASE_COLOR: Record<string, string> = {
  "Base Build": "#4c8dff",
  "Build Peak": "#f97316",
  "Race Specificity": "#ef4444",
  Taper: "#9aa3b2",
};

const weekTotal = (days: PlanDay[]) => Math.round(days.reduce((s, d) => s + d.distanceKm, 0) * 10) / 10;

function paceSeconds(p: string) {
  const [m, s] = p.split(":").map(Number);
  return m * 60 + s;
}

/** Half-circle dial showing where the goal pace sits between 3:00 and 9:00 min/km. */
function PaceDial({ pace }: { pace: string }) {
  const t = Math.min(1, Math.max(0, (540 - paceSeconds(pace)) / 360)); // faster pace = fuller dial
  const len = Math.PI * 52;
  return (
    <div className="relative mx-auto h-[88px] w-[132px]">
      <svg viewBox="0 0 132 80" className="h-full w-full">
        <path d="M 14 70 A 52 52 0 0 1 118 70" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="8" strokeLinecap="round" />
        <motion.path
          d="M 14 70 A 52 52 0 0 1 118 70"
          fill="none"
          stroke="#ffffff"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={len}
          initial={{ strokeDashoffset: len }}
          animate={{ strokeDashoffset: len * (1 - t) }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center text-xl font-extrabold leading-none">{pace}</div>
    </div>
  );
}

/** Live days / hours / minutes to the race. */
function Countdown({ raceDate }: { raceDate: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const ms = Math.max(0, new Date(`${raceDate}T00:00:00`).getTime() - now);
  const parts = [
    ["days", Math.floor(ms / 86400000)],
    ["hrs", Math.floor((ms % 86400000) / 3600000)],
    ["min", Math.floor((ms % 3600000) / 60000)],
  ] as const;
  return (
    <div className="flex gap-2">
      {parts.map(([l, v]) => (
        <div key={l} className="min-w-14 rounded-xl bg-black/25 px-2 py-1.5 text-center">
          <div className="text-xl font-extrabold tabular-nums">{String(v).padStart(2, "0")}</div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-white/60">{l}</div>
        </div>
      ))}
    </div>
  );
}

function Stat({ title, value, unit }: { title: string; value: string | number; unit?: string }) {
  return (
    <div className="rounded-xl bg-black/25 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-white/60">{title}</div>
      <div className="text-3xl font-extrabold leading-tight">
        {value}
        {unit && <span className="ml-1 text-xs font-semibold text-white/70">{unit}</span>}
      </div>
    </div>
  );
}

function Hero({ plan, profile }: { plan: Plan; profile: Profile }) {
  const [w1, w2] = plan.weeks;
  const date = new Date(`${profile.raceDate}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5 rounded-3xl p-5 text-white"
      style={{ background: "linear-gradient(160deg,#0b3a8a 0%,#16264a 70%,#1b2030 100%)" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-white/70">Race day</div>
          <div className="text-6xl font-extrabold leading-none tracking-tight">{goalLabel(profile)}</div>
          <div className="mt-1 text-sm text-white/80">{date}</div>
          <div className="mt-1 text-xs font-semibold uppercase text-white/60">
            {levelOf(profile)} runner{profile.injury.trim() ? " · injury noted" : ""}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Countdown</div>
          <Countdown raceDate={profile.raceDate} />
        </div>
      </div>
      <div className="grid items-center gap-4 sm:grid-cols-[auto_1fr]">
        <div>
          <PaceDial pace={profile.goalPace} />
          <div className="mt-1 text-center text-[10px] font-semibold uppercase tracking-wider text-white/60">Goal pace · min/km</div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat title="Week 1" value={w1 ? weekTotal(w1.days) : 0} unit="km" />
          <Stat title="Week 2" value={w2 ? weekTotal(w2.days) : 0} unit="km" />
          <Stat title="Weeks to race" value={plan.weeks.length} />
        </div>
      </div>
    </motion.section>
  );
}

function Timeline({ weeks }: { weeks: number }) {
  const phases = phasesFor(weeks).map((p) => ({ ...p, color: PHASE_COLOR[p.name] }));
  const total = phases.reduce((s, p) => s + p.weeks, 0);
  return (
    <section className={card}>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-extrabold">Training phases</h2>
        <span className={label}>{weeks} wk to race</span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-carbon">
        {phases.map((p, i) => (
          <motion.div
            key={p.name}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.1 * i, duration: 0.4 }}
            style={{ width: `${(p.weeks / total) * 100}%`, background: p.color, transformOrigin: "left" }}
            className="border-r border-elevated last:border-r-0"
          />
        ))}
      </div>
      <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
        <span className="h-2 w-2 rounded-full bg-white" />
        You are here · week 1
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {phases.map((p) => (
          <li key={p.name} className="flex items-center gap-2 text-xs text-subtext">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
            {p.name} <span className="text-muted">{p.weeks}w</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">The whole block, week by week, up to race day. Weeks 1 and 2 are free; the rest is part of the full plan.</p>
    </section>
  );
}

const lockIcon = (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

function LockedWeek({ week, onUnlock }: { week: number; onUnlock: () => void }) {
  return (
    <div className="space-y-4 rounded-3xl bg-elevated p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-carbon text-subtext">
        <span className="scale-150">{lockIcon}</span>
      </div>
      <div>
        <h3 className="text-xl font-extrabold">Week {week} is locked</h3>
        <p className="mt-1 text-sm text-subtext">Subscribe to see every session from week {FREE_WEEKS + 1} to race day.</p>
      </div>
      {/* Blurred stand-ins only. No real session data is drawn here. */}
      <div className="space-y-2 blur-sm" aria-hidden="true">
        <div className="h-16 rounded-2xl bg-gradient-to-r from-[#58b91e]/60 to-[#d8c80c]/60" />
        <div className="h-16 rounded-2xl bg-gradient-to-r from-[#0ba58f]/60 to-[#17405e]/60" />
        <div className="h-16 rounded-2xl bg-gradient-to-r from-[#5e37a0]/60 to-[#a070dc]/60" />
      </div>
      <button onClick={onUnlock} className="h-12 w-full rounded-full bg-volt font-bold text-void hover:brightness-110">
        Unlock full plan · {priceLabel} / year
      </button>
    </div>
  );
}

function Weeks({ plan, start, subscribed, onUnlock }: { plan: Plan; start: Date; subscribed: boolean; onUnlock: () => void }) {
  const total = plan.weeks.length;
  // Open on the current week.
  const [wk, setWk] = useState(() => Math.min(Math.max(Math.floor((Date.now() - start.getTime()) / (7 * 86400000)), 0), total - 1));
  const [open, setOpen] = useState<string | null>(null);
  const todayStart = startOfDay(new Date());
  const week = plan.weeks[wk];
  const isLocked = (i: number) => i >= FREE_WEEKS && !subscribed;
  const locked = isLocked(wk);
  // Run types shown in the weeks that are open, for the colour key.
  const types = [...new Set(plan.weeks.filter((_, i) => !isLocked(i)).flatMap((w) => w.days.map((d) => d.type)))].filter((t) => t !== "rest");
  const first = addDays(start, wk * 7);
  const range = `${first.toLocaleDateString(undefined, { day: "numeric", month: "short" })} to ${addDays(first, 6).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;

  return (
    <section className="space-y-3">
      {!subscribed && total > FREE_WEEKS && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-elevated px-4 py-3 text-sm">
          <span className="text-subtext">
            <span className="font-bold text-ink">Free:</span> weeks 1 to {FREE_WEEKS}. Full plan to race day: {priceLabel} / year.
          </span>
          <button onClick={onUnlock} className="shrink-0 rounded-full bg-volt px-4 py-2 text-xs font-bold text-void">
            Unlock
          </button>
        </div>
      )}

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Weeks">
        {plan.weeks.map((w, i) => (
          <button
            key={w.week}
            role="tab"
            aria-selected={i === wk}
            onClick={() => {
              setWk(i);
              setOpen(null);
            }}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition ${
              i === wk ? "bg-white text-void" : "bg-elevated text-subtext hover:text-ink"
            }`}
          >
            Week {w.week}
            {isLocked(i) && lockIcon}
          </button>
        ))}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-subtext" aria-label="Run types">
        {types.map((t) => (
          <li key={t} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: sessionBg(t) }} />
            {SESSION_STYLE[t].label}
          </li>
        ))}
      </ul>

      <div className="flex items-baseline justify-between px-1">
        <div>
          <div className="text-lg font-extrabold">
            Week {week.week}
            {week.phase && <span className="text-sm font-semibold text-subtext"> · {week.phase}</span>}
          </div>
          {!locked && week.focus && <div className="text-sm text-subtext">{week.focus}</div>}
          <div className="text-xs text-muted">
            {range}
            {week.kind === "recovery" && " · recovery week"}
            {week.kind === "taper" && " · taper"}
          </div>
        </div>
        {!locked && <span className="text-sm font-semibold text-subtext">{weekTotal(week.days)} km</span>}
      </div>

      {locked ? (
        <LockedWeek week={week.week} onUnlock={onUnlock} />
      ) : (
        <ul className="space-y-3">
          {/* A week is the 7 days from the start date, so list them by date, not Monday to Sunday. */}
          {week.days
            .map((d) => ({ d, date: dateOf(start, wk, d.day) }))
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .map(({ d, date }, i) => {
            const dayLabel = `${d.day} ${date.getDate()}`;
            const past = date < todayStart;
            if (d.type === "rest")
              return (
                <li key={d.day} className={`flex items-center justify-between rounded-2xl bg-elevated/60 px-4 py-3 text-sm text-muted ${past ? "opacity-50" : ""}`}>
                  <span className="font-bold uppercase tracking-wider">{dayLabel}</span>
                  <span>Rest</span>
                </li>
              );
            const key = `${wk}-${d.day}`;
            const mins = estMinutes(d);
            return (
              <motion.li key={key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: past ? 0.55 : 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <SessionCard
                  type={d.type}
                  dayLabel={dayLabel}
                  meta={`${d.distanceKm} km${mins ? ` · ~${mins} min` : ""}`}
                  expanded={open === key}
                  onClick={() => setOpen(open === key ? null : key)}
                >
                  {open === key && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden">
                      <div className="mt-2 space-y-3 rounded-2xl bg-elevated p-4">
                        <div className="text-sm text-subtext">
                          Target pace <span className="font-bold text-ink">{d.pace}</span> · {d.effort}
                        </div>
                        <ol className="space-y-2">
                          {stepsFor(d).map((st, n) => (
                            <li key={st.name} className="flex gap-3 text-sm">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-carbon text-xs font-bold text-subtext">
                                {n + 1}
                              </span>
                              <span>
                                <span className="font-bold">{st.name}</span>
                                <span className="block text-subtext">{st.detail}</span>
                              </span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </motion.div>
                  )}
                </SessionCard>
              </motion.li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Notes({ plan, profile }: { plan: Plan; profile: Profile }) {
  return (
    <section className="space-y-3">
      <div className={card}>
        <div className={label}>Coach&apos;s notes</div>
        <p className="mt-2 leading-relaxed">{plan.summary}</p>
        {plan.source === "fallback" && (
          <p className="mt-3 text-xs text-threshold">The AI was unavailable, so this is a safe starter plan for your level.</p>
        )}
      </div>
      <div className={card}>
        <div className={label}>Safety guardrails</div>
        <ul className="mt-2 space-y-1.5 text-sm text-subtext">
          <li>Weekly distance grows by 10% at most.</li>
          <li>No more than two run days in a row, and rest days are protected.</li>
          <li>No single run is longer than {longestRunKm(profile)} km, the longest run planned for your {goalLabel(profile)}.</li>
          {profile.injury.trim() && <li className="text-threshold">Lower limits applied for your injury.</li>}
        </ul>
        {plan.rulesApplied.length > 0 && (
          <div className="mt-3 border-t border-line pt-3">
            <div className={label}>Adjusted automatically</div>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-subtext">
              {plan.rulesApplied.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function Actions({ plan, profile, subscribed, onRecalibrate }: { plan: Plan; profile: Profile; subscribed: boolean; onRecalibrate: () => void }) {
  const [copied, setCopied] = useState(false);
  // Locked weeks stay out of exports and copies until the runner subscribes.
  const shown = subscribed ? plan.weeks : plan.weeks.slice(0, FREE_WEEKS);
  const summary = [
    `Last Mile: ${goalLabel(profile)} on ${profile.raceDate}, goal pace ${profile.goalPace}/km (${levelOf(profile)})`,
    ...shown.map((w) => `Week ${w.week}: ${weekTotal(w.days)} km, ${w.days.filter((d) => d.type !== "rest").length} runs`),
    plan.summary,
  ].join("\n");

  function exportJson() {
    const blob = new Blob([JSON.stringify({ profile, plan: { ...plan, weeks: shown } }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "last-mile-plan.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  const btn = "rounded-full bg-elevated px-4 py-3 text-center text-sm font-bold text-subtext transition hover:text-ink";
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <button onClick={exportJson} className={btn}>
        Export JSON
      </button>
      <button onClick={copy} className={btn}>
        {copied ? "Copied ✓" : "Copy summary"}
      </button>
      <button onClick={onRecalibrate} className={`${btn} text-ink`}>
        Recalibrate plan
      </button>
    </div>
  );
}

export default function TrainingPlanView({ plan, profile, start, onRecalibrate }: { plan: Plan; profile: Profile; start: Date; onRecalibrate: () => void }) {
  const subscribed = useSubscribed();
  const [paywall, setPaywall] = useState(false);
  return (
    <div className="space-y-5">
      <Hero plan={plan} profile={profile} />
      <Weeks plan={plan} start={start} subscribed={subscribed} onUnlock={() => setPaywall(true)} />
      <Timeline weeks={weeksToRace(profile.raceDate)} />
      <Notes plan={plan} profile={profile} />
      <Actions plan={plan} profile={profile} subscribed={subscribed} onRecalibrate={onRecalibrate} />
      <PaywallDialog open={paywall} onClose={() => setPaywall(false)} totalWeeks={plan.weeks.length} raceDate={profile.raceDate} />
    </div>
  );
}

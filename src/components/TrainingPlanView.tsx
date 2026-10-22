"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { levelOf, weeksToRace, type Plan, type PlanDay, type Profile, type RunType } from "@/lib/plan";

type Tab = "overview" | "workouts" | "week";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "workouts", label: "Key Workouts" },
  { id: "week", label: "Week Grid" },
];

const card = "rounded-xl border border-line bg-elevated";
const mono = "font-mono-tech";

const list = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

// What each session type means in training terms. Colors come from the design palette.
const ZONES: Record<RunType, { tag: string; color: string; warm: string }> = {
  rest: { tag: "Recovery", color: "#6B7280", warm: "" },
  "walk-run": {
    tag: "Z1 · Run / Walk",
    color: "#60A5FA",
    warm: "Warm-up 5 min brisk walk · Cool-down 5 min easy walk",
  },
  easy: {
    tag: "Z2 · Aerobic",
    color: "#3B82F6",
    warm: "Warm-up 5 min walk + 5 min easy jog · Cool-down 5 min walk",
  },
  long: {
    tag: "Long slow distance",
    color: "#BEF264",
    warm: "Warm-up 10 min very easy · Cool-down 5-10 min walk",
  },
};

const PHASE_STYLE = [
  { name: "Base Build", color: "#3B82F6" },
  { name: "Build Peak", color: "#F97316" },
  { name: "Race Specificity", color: "#EF4444" },
  { name: "Taper", color: "#9CA3AF" },
];

/** Splits the weeks until the race into the four classic phases. Only a rough outline. */
function phasesFor(weeks: number) {
  if (weeks < 4) return PHASE_STYLE.slice(4 - Math.max(1, weeks)).map((p) => ({ ...p, weeks: 1 }));
  const share = [0.4, 0.3, 0.2, 0.1];
  const w = share.map((s) => Math.max(1, Math.floor(weeks * s)));
  let left = weeks - w.reduce((a, b) => a + b, 0);
  for (let i = 0; left > 0; i = (i + 1) % 3, left--) w[i]++;
  return PHASE_STYLE.map((p, i) => ({ ...p, weeks: w[i] }));
}

const weekTotal = (days: PlanDay[]) => Math.round(days.reduce((s, d) => s + d.distanceKm, 0) * 10) / 10;

/** Estimated time on feet in minutes, from the middle of the target pace range. */
function estMinutes(d: PlanDay) {
  const m = d.pace.match(/(\d+):(\d+)-(\d+):(\d+)/);
  if (!m || d.distanceKm <= 0) return 0;
  const mid = (Number(m[1]) * 60 + Number(m[2]) + Number(m[3]) * 60 + Number(m[4])) / 2;
  return Math.round((mid * d.distanceKm) / 60);
}

function paceSeconds(p: string) {
  const [m, s] = p.split(":").map(Number);
  return m * 60 + s;
}

/** Half-circle dial showing where the goal pace sits between 3:00 and 9:00 min/km. */
function PaceDial({ pace }: { pace: string }) {
  const min = 180;
  const max = 540;
  const t = Math.min(1, Math.max(0, (max - paceSeconds(pace)) / (max - min))); // faster pace = fuller dial
  const r = 52;
  const len = Math.PI * r;
  return (
    <div className="relative mx-auto h-[88px] w-[132px]">
      <svg viewBox="0 0 132 80" className="h-full w-full">
        <defs>
          <linearGradient id="dial-g" x1="0" x2="1">
            <stop offset="0" stopColor="#BEF264" />
            <stop offset="1" stopColor="#2DD4BF" />
          </linearGradient>
        </defs>
        <path d="M 14 70 A 52 52 0 0 1 118 70" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" strokeLinecap="round" />
        <motion.path
          d="M 14 70 A 52 52 0 0 1 118 70"
          fill="none"
          stroke="url(#dial-g)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={len}
          initial={{ strokeDashoffset: len }}
          animate={{ strokeDashoffset: len * (1 - t) }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className={`${mono} absolute inset-x-0 bottom-0 text-center text-xl font-semibold leading-none text-ink`}>{pace}</div>
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
      {parts.map(([label, v]) => (
        <div key={label} className="min-w-14 rounded-md border border-line bg-carbon px-2 py-1.5 text-center">
          <div className={`${mono} text-xl font-semibold tabular-nums text-volt`}>{String(v).padStart(2, "0")}</div>
          <div className={`${mono} text-[10px] uppercase tracking-wider text-muted`}>{label}</div>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="rounded-md border border-line bg-carbon px-3 py-2">
      <div className={`${mono} text-[10px] uppercase tracking-wider text-muted`}>{label}</div>
      <div className="font-athletic text-3xl font-bold leading-tight text-ink">
        {value}
        {unit && <span className={`${mono} ml-1 text-xs font-normal text-subtext`}>{unit}</span>}
      </div>
    </div>
  );
}

function Hero({ plan, profile }: { plan: Plan; profile: Profile }) {
  const [w1, w2] = plan.weeks;
  const runs = plan.weeks.reduce((s, w) => s + w.days.filter((d) => d.type !== "rest").length, 0);
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
      className={`${card} space-y-5 border-volt/20 p-5`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className={`${mono} text-[11px] uppercase tracking-[0.2em] text-volt`}>Race day</div>
          <div className="text-aurora text-7xl font-extrabold leading-[0.9] tracking-[-0.05em]">{profile.distance}</div>
          <div className={`${mono} mt-1 text-xs text-subtext`}>{date}</div>
          <div className={`${mono} mt-1 text-[11px] uppercase text-muted`}>
            {levelOf(profile)} runner
            {profile.injury.trim() ? ` · injury noted` : ""}
          </div>
        </div>
        <div className="space-y-1">
          <div className={`${mono} text-[10px] uppercase tracking-wider text-muted`}>Countdown</div>
          <Countdown raceDate={profile.raceDate} />
        </div>
      </div>

      <div className="grid items-center gap-4 sm:grid-cols-[auto_1fr]">
        <div>
          <PaceDial pace={profile.goalPace} />
          <div className={`${mono} mt-1 text-center text-[10px] uppercase tracking-wider text-muted`}>Goal pace · min/km</div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Week 1" value={w1 ? weekTotal(w1.days) : 0} unit="km" />
          <Stat label="Week 2" value={w2 ? weekTotal(w2.days) : 0} unit="km" />
          <Stat label="Runs" value={runs} />
        </div>
      </div>
    </motion.section>
  );
}

function Timeline({ weeks }: { weeks: number }) {
  const phases = phasesFor(weeks);
  const total = phases.reduce((s, p) => s + p.weeks, 0);
  return (
    <section className={`${card} p-5`}>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-athletic text-lg font-semibold uppercase tracking-widest">Training phases</h2>
        <span className={`${mono} text-[11px] uppercase text-muted`}>{weeks} wk to race</span>
      </div>
      <div className="relative">
        <div className="flex h-3 overflow-hidden rounded-full bg-carbon">
          {phases.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.1 * i, duration: 0.4 }}
              style={{ width: `${(p.weeks / total) * 100}%`, background: p.color, transformOrigin: "left" }}
              className="border-r border-void last:border-r-0"
            />
          ))}
        </div>
        <div
          className={`${mono} mt-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-volt`}
        >
          <span className="h-2 w-2 rounded-full bg-volt shadow-[0_0_8px_#BEF264]" />
          You are here · week 1
        </div>
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {phases.map((p) => (
          <li key={p.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
            <span className="text-xs text-subtext">
              {p.name} <span className={`${mono} text-muted`}>{p.weeks}w</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">
        A rough outline of the whole block. Only weeks 1 and 2 are planned in detail below.
      </p>
    </section>
  );
}

function Overview({ plan, profile }: { plan: Plan; profile: Profile }) {
  const totals = plan.weeks.map((w) => weekTotal(w.days));
  const peak = Math.max(...totals, 1);
  return (
    <motion.div variants={list} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={item} className={`${card} p-5`}>
        <div className={`${mono} mb-2 text-[11px] uppercase tracking-[0.2em] text-volt`}>Coach&apos;s notes</div>
        <p className="leading-relaxed text-ink">{plan.summary}</p>
        {plan.source === "fallback" && (
          <p className={`${mono} mt-3 text-[11px] text-threshold`}>
            The AI was unavailable, so this is a safe starter plan for your level.
          </p>
        )}
      </motion.div>

      <motion.div variants={item} className={`${card} p-5`}>
        <h3 className="mb-3 font-athletic text-lg font-semibold uppercase tracking-widest">Weekly volume</h3>
        <div className="space-y-3">
          {plan.weeks.map((w, i) => (
            <div key={w.week}>
              <div className={`${mono} mb-1 flex justify-between text-[11px] uppercase text-subtext`}>
                <span>Week {w.week}</span>
                <span className="text-ink">{totals[i]} km</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-carbon">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(totals[i] / peak) * 100}%` }}
                  transition={{ duration: 0.7, delay: 0.1 * i }}
                  className="h-full rounded-full bg-aerobic"
                />
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div variants={item} className={`${card} p-5`}>
        <h3 className="mb-2 font-athletic text-lg font-semibold uppercase tracking-widest">Safety guardrails</h3>
        <ul className="space-y-1.5 text-sm text-subtext">
          <li>Weekly distance grows by 10% at most.</li>
          <li>No more than two run days in a row, and rest days are protected.</li>
          <li>No single run is longer than your {profile.distance} race.</li>
          {profile.injury.trim() && <li className="text-threshold">Lower limits applied for your injury.</li>}
        </ul>
        {plan.rulesApplied.length > 0 && (
          <div className="mt-3 border-t border-line pt-3">
            <div className={`${mono} mb-1 text-[11px] uppercase text-muted`}>Adjusted automatically</div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-subtext">
              {plan.rulesApplied.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function Workouts({ plan }: { plan: Plan }) {
  const sessions = plan.weeks.flatMap((w) => w.days.filter((d) => d.type !== "rest").map((d) => ({ week: w.week, d })));
  return (
    <motion.ul variants={list} initial="hidden" animate="show" className="space-y-3">
      {sessions.map(({ week, d }) => {
        const z = ZONES[d.type];
        const mins = estMinutes(d);
        return (
          <motion.li
            key={`${week}-${d.day}`}
            variants={item}
            className={`${card} border-l-4 p-4 transition hover:-translate-y-px hover:border-volt/40`}
            style={{ borderLeftColor: z.color }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className={`${mono} text-[11px] uppercase tracking-wider`} style={{ color: z.color }}>
                  {z.tag}
                </div>
                <div className="font-athletic text-2xl font-bold uppercase leading-tight">
                  {d.distanceKm} km
                  {mins > 0 && <span className={`${mono} ml-2 text-xs font-normal text-subtext`}>~{mins} min</span>}
                </div>
              </div>
              <div className={`${mono} text-right text-[11px] uppercase text-muted`}>
                <div className="text-ink">{d.day}</div>
                Week {week}
              </div>
            </div>
            <div className={`${mono} mt-2 text-xs text-ink`}>{d.pace}</div>
            <p className="mt-2 text-sm text-subtext">
              <span className="text-ink">{d.effort}.</span> {d.note}
            </p>
            {z.warm && <p className={`${mono} mt-2 border-t border-line pt-2 text-[11px] text-muted`}>{z.warm}</p>}
          </motion.li>
        );
      })}
    </motion.ul>
  );
}

function WeekGrid({ plan }: { plan: Plan }) {
  const [wk, setWk] = useState(0);
  const week = plan.weeks[wk];
  const maxKm = Math.max(...plan.weeks.flatMap((w) => w.days.map((d) => d.distanceKm)), 1);
  const totalMin = week.days.reduce((s, d) => s + estMinutes(d), 0);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {plan.weeks.map((w, i) => (
            <button
              key={w.week}
              onClick={() => setWk(i)}
              className={`${mono} rounded border px-3 py-1.5 text-xs uppercase tracking-wider transition ${
                i === wk ? "border-volt bg-volt/10 text-volt" : "border-line text-subtext hover:border-white/20"
              }`}
            >
              Week {w.week}
            </button>
          ))}
        </div>
        <div className={`${mono} text-[11px] uppercase text-subtext`}>
          {weekTotal(week.days)} km · ~{totalMin} min on feet
        </div>
      </div>

      <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-7 sm:overflow-visible sm:px-0">
        {week.days.map((d, i) => {
          const rest = d.type === "rest";
          const z = ZONES[d.type];
          const mins = estMinutes(d);
          return (
            <motion.div
              key={`${wk}-${d.day}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`${card} flex min-w-[92px] shrink-0 snap-start flex-col p-3 sm:min-w-0 ${
                rest ? "bg-carbon" : "hover:border-volt/40"
              }`}
            >
              <div className={`${mono} text-[11px] uppercase text-subtext`}>{d.day}</div>
              <div className="my-3 flex h-24 items-end">
                {rest ? (
                  <div className={`${mono} w-full text-center text-[10px] uppercase leading-tight text-muted`}>
                    Rest
                    <br />
                    recover
                  </div>
                ) : (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(12, (d.distanceKm / maxKm) * 100)}%` }}
                    transition={{ duration: 0.6, delay: i * 0.04 }}
                    className="w-full rounded-sm"
                    style={{ background: z.color }}
                  />
                )}
              </div>
              {!rest && (
                <>
                  <div className="font-athletic text-xl font-bold leading-none">{d.distanceKm}</div>
                  <div className={`${mono} text-[10px] uppercase text-muted`}>km · ~{mins}m</div>
                  <div className={`${mono} mt-1 text-[10px] uppercase`} style={{ color: z.color }}>
                    {d.type}
                  </div>
                </>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function Actions({ plan, profile }: { plan: Plan; profile: Profile }) {
  const [copied, setCopied] = useState(false);
  const summary = [
    `Last Mile: ${profile.distance} on ${profile.raceDate}, goal pace ${profile.goalPace}/km (${levelOf(profile)})`,
    ...plan.weeks.map((w) => `Week ${w.week}: ${weekTotal(w.days)} km, ${w.days.filter((d) => d.type !== "rest").length} runs`),
    plan.summary,
  ].join("\n");

  function exportJson() {
    const blob = new Blob([JSON.stringify({ profile, plan }, null, 2)], { type: "application/json" });
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

  const btn =
    "rounded-md border border-line px-3 py-2 text-center font-mono-tech text-[11px] uppercase tracking-wider text-subtext transition hover:-translate-y-px hover:border-volt/40 hover:text-ink";
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <button onClick={exportJson} className={btn}>
        Export JSON
      </button>
      <button onClick={copy} className={btn}>
        {copied ? "Copied ✓" : "Copy summary"}
      </button>
      <Link href="/" className={`${btn} border-volt/40 text-volt hover:text-volt`}>
        Recalibrate plan
      </Link>
    </div>
  );
}

export default function TrainingPlanView({ plan, profile }: { plan: Plan; profile: Profile }) {
  const [tab, setTab] = useState<Tab>("overview");
  return (
    <div className="space-y-5">
      <Hero plan={plan} profile={profile} />
      <Timeline weeks={weeksToRace(profile.raceDate)} />

      <div role="tablist" aria-label="Plan sections" className="flex border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`relative flex-1 px-2 py-3 font-athletic text-base font-semibold uppercase tracking-widest transition ${
              tab === t.id ? "text-volt" : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
            {tab === t.id && (
              <motion.span layoutId="tab-underline" className="absolute inset-x-0 -bottom-px h-0.5 bg-volt" />
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          role="tabpanel"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {tab === "overview" && <Overview plan={plan} profile={profile} />}
          {tab === "workouts" && <Workouts plan={plan} />}
          {tab === "week" && <WeekGrid plan={plan} />}
        </motion.div>
      </AnimatePresence>

      <Actions plan={plan} profile={profile} />
    </div>
  );
}

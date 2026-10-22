"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import BottomTabs from "@/components/BottomTabs";
import RunnerIcon from "@/components/RunnerIcon";
import { categoryFor, daysToRace, MAX_CUSTOM_KM, MAX_PLAN_WEEKS, MIN_CUSTOM_KM, normalizePace, type Plan, type Profile } from "@/lib/plan";
import { addDays, sameDay, SESSION_STYLE, sessionBg, startOfDay } from "@/lib/sessions";
import { writeSaved } from "@/lib/store";

/*
 * The plan form, in the same design as the Today screen: slate cards, bold headings, a blue hero card,
 * coloured tiles and a white pill button. Four screens: your race, about you, building the plan, success.
 * The plan is only saved when the runner taps "View my plan" on the last screen.
 */

const BLUE_GRADIENT = "linear-gradient(120deg,#0047AB,#2f7bff)";

type Phase = "details" | "about" | "building" | "success";
type Goal = "5K" | "10K" | "21K" | "Marathon" | "Other";
const GOALS: { value: Goal; from: string; to: string; hint: string }[] = [
  { value: "5K", from: "#ef4444", to: "#f97316", hint: "5 km" },
  { value: "10K", from: "#f97316", to: "#e0c20d", hint: "10 km" },
  { value: "21K", from: "#22c55e", to: "#0ba58f", hint: "21.1 km" },
  { value: "Marathon", from: "#6b7280", to: "#9ca3af", hint: "42.2 km" },
  { value: "Other", from: "#5e37a0", to: "#a070dc", hint: "Your distance" },
];
const LEVELS: { value: Exclude<Profile["level"], "">; color: string; hint: string }[] = [
  { value: "Beginner", color: "#3b82f6", hint: "New to running" },
  { value: "Intermediate", color: "#2563eb", hint: "Some races" },
  { value: "Advanced", color: "#1d4ed8", hint: "Regular racer" },
];

type Answers = { goal: Goal | ""; km: string; date: string; pace: string; level: Profile["level"]; injury: string; agree: boolean };

function answersFrom(p: Profile | null | undefined, injury = ""): Answers {
  if (!p) return { goal: "", km: "", date: "", pace: "", level: "", injury, agree: false };
  const custom = p.raceKm !== undefined;
  return {
    goal: custom ? "Other" : (["5K", "10K", "21K", "Marathon"].includes(p.distance) ? p.distance : ""),
    km: custom ? String(p.raceKm) : "",
    date: p.raceDate ?? "",
    pace: p.goalPace ?? "",
    level: p.level ?? "",
    injury: p.injury ?? "",
    agree: false,
  };
}

function profileFrom(a: Answers): Profile {
  const km = Math.round(Number(a.km) * 10) / 10;
  const goal = a.goal === "Other" ? { distance: categoryFor(km), raceKm: km, label: `${km} km` } : { distance: a.goal as Profile["distance"] };
  return { ...goal, goalPace: normalizePace(a.pace) ?? a.pace, raceDate: a.date, level: a.level, injury: a.injury.trim() };
}

const MIN_BUILD_MS = 4200; // long enough for the four steps to be seen, even if the plan is ready sooner
const STEPS: { label: string; type: "easy" | "long" | "tempo" | "intervals" }[] = [
  { label: "Goal", type: "easy" },
  { label: "Volume", type: "long" },
  { label: "Paces", type: "tempo" },
  { label: "Safety", type: "intervals" },
];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// ---- small pieces ---------------------------------------------------------

const svgProps = { viewBox: "0 0 24 24", className: "h-5 w-5", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const field =
  "h-12 w-full rounded-xl border border-line bg-carbon px-4 text-base font-bold text-ink placeholder:font-normal placeholder:text-muted outline-none transition focus:border-[#2f7bff] focus:ring-2 focus:ring-[#2f7bff]/50";

const star = (
  <span className="text-vo2" aria-hidden="true">
    *
  </span>
);

/** One question, styled like a card on the Today screen: coloured icon, bold title, then the controls. */
function Question({ icon, from, to, title, children }: { icon: ReactNode; from: string; to: string; title: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-elevated p-4">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: `linear-gradient(135deg,${from},${to})` }}>
          {icon}
        </span>
        <h2 className="text-xl font-extrabold">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Hero({ step, title, sub, onBack }: { step: string; title: string; sub: string; onBack?: () => void }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl p-5 text-white"
      style={{ background: "linear-gradient(160deg,#0b3a8a 0%,#16264a 70%,#1b2030 100%)" }}
    >
      <RunnerIcon className="pointer-events-none absolute -bottom-6 -right-2 h-44 w-44 text-white/10" />
      <div className="relative flex items-center gap-3">
        {onBack && (
          <button type="button" onClick={onBack} aria-label="Back" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 transition hover:bg-white/25">
            <svg {...svgProps} strokeWidth={2.4}>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
        )}
        <div className="text-xs font-bold uppercase tracking-wider text-white/70">{step}</div>
      </div>
      <h1 className="relative mt-2 text-4xl font-extrabold leading-tight">{title}</h1>
      <p className="relative mt-2 max-w-md text-white/80">{sub}</p>
    </motion.section>
  );
}

const pill =
  "flex h-14 w-full items-center justify-center gap-3 rounded-full bg-volt text-lg font-bold text-void shadow-lg shadow-black/40 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40";

/**
 * A month calendar for picking the race date. Days up to today are not available,
 * and neither are days beyond the 52 weeks a plan can cover.
 */
function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [month, setMonth] = useState(() => {
    const base = value ? new Date(`${value}T00:00:00`) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const today = startOfDay(new Date());
  const min = addDays(today, 1);
  const max = addDays(today, 7 * MAX_PLAN_WEEKS);
  const firstMonth = new Date(min.getFullYear(), min.getMonth(), 1);
  const lastMonth = new Date(max.getFullYear(), max.getMonth(), 1);
  const lead = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const selected = value ? new Date(`${value}T00:00:00`) : null;
  const days = value ? daysToRace(value) : 0;

  return (
    <div className="rounded-2xl bg-carbon p-3" role="group" aria-label="Race date calendar">
      {selected && days > 0 && (
        <div className="mb-3 rounded-xl px-4 py-3 text-white" style={{ background: BLUE_GRADIENT }}>
          <div className="text-sm font-semibold text-white/80">{selected.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
          <span className="text-2xl font-extrabold">{days}</span> <span className="text-sm font-semibold text-white/80">days to go · {Math.ceil(days / 7)} weeks</span>
        </div>
      )}
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          disabled={month <= firstMonth}
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-subtext hover:bg-white/10 disabled:opacity-30"
        >
          ‹
        </button>
        <span className="font-bold">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
        <button
          type="button"
          aria-label="Next month"
          disabled={month >= lastMonth}
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-subtext hover:bg-white/10 disabled:opacity-30"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="pb-1 text-[11px] font-bold text-muted">
            {d}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`b${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const date = new Date(month.getFullYear(), month.getMonth(), i + 1);
          const out = date < min || date > max;
          const active = !!selected && sameDay(date, selected);
          return (
            <button
              key={i}
              type="button"
              disabled={out}
              aria-label={date.toDateString()}
              aria-pressed={active}
              onClick={() => onChange(iso(date))}
              className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition ${
                active ? "scale-110 text-white ring-2 ring-white" : "text-ink hover:bg-white/10"
              } ${out ? "opacity-25" : ""}`}
              style={active ? { background: BLUE_GRADIENT } : undefined}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- the form -------------------------------------------------------------

export default function PlanForm({ initial, injuryDefault, onCancel, onDone }: { initial?: Profile | null; injuryDefault?: string; onCancel?: () => void; onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>("details");
  const [a, setA] = useState<Answers>(() => answersFrom(initial, injuryDefault));
  const [tried, setTried] = useState(false); // show what is missing after a first attempt
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const built = useRef(false);
  const planRef = useRef<Plan | null>(null);
  const set = <K extends keyof Answers>(k: K, v: Answers[K]) => setA((p) => ({ ...p, [k]: v }));

  const days = a.date && !Number.isNaN(Date.parse(a.date)) ? daysToRace(a.date) : 0;
  const goalOk = !!a.goal && (a.goal !== "Other" || (Number(a.km) >= MIN_CUSTOM_KM && Number(a.km) <= MAX_CUSTOM_KM));
  const detailsOk = goalOk && days > 0 && normalizePace(a.pace) !== null;

  // Progress ticks while the plan is built. It holds at 94% until the plan is really ready.
  useEffect(() => {
    if (phase !== "building" || error) return;
    const t0 = performance.now();
    const id = setInterval(() => {
      const target = Math.min(((performance.now() - t0) / MIN_BUILD_MS) * 100, 100);
      const ready = built.current;
      setProgress((p) => Math.max(p, ready ? target : Math.min(target, 94)));
      if (ready && target >= 100) {
        clearInterval(id);
        setPhase("success");
      }
    }, 80);
    return () => clearInterval(id);
  }, [phase, error]);

  async function build() {
    setError("");
    setProgress(0);
    built.current = false;
    setPhase("building");
    try {
      const res = await fetch("/api/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profileFrom(a)) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      planRef.current = data;
      built.current = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  function viewPlan() {
    if (!planRef.current) return;
    writeSaved({ profile: profileFrom(a), plan: planRef.current, createdAt: new Date().toISOString() });
    onDone();
  }

  const goNext = () => {
    if (detailsOk) {
      setTried(false);
      setPhase("about");
    } else setTried(true);
  };

  const showTabs = phase === "details" || phase === "about";

  return (
    <div className={`flex flex-1 flex-col ${showTabs ? "pb-44" : "pb-12"}`}>
      <main className="mx-auto w-full max-w-3xl space-y-3 px-4 pt-5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={phase} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }} className="space-y-3">
            {phase === "details" && (
              <>
                <Hero step="Step 1 of 2" title="Create your plan" sub="Fill in your race details and we'll build your plan, starting today." onBack={onCancel} />

                <Question
                  icon={
                    <svg {...svgProps}>
                      <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
                    </svg>
                  }
                  from="#f08a1c"
                  to="#db3a2a"
                  title={<>Your goal {star}</>}
                >
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                    {GOALS.map((g) => {
                      const on = a.goal === g.value;
                      return (
                        <button
                          key={g.value}
                          type="button"
                          aria-pressed={on}
                          onClick={() => set("goal", g.value)}
                          className={`relative h-20 overflow-hidden rounded-2xl p-3 text-left text-white transition active:scale-95 ${on ? "scale-[1.03] ring-2 ring-white" : "opacity-85 hover:opacity-100"}`}
                          style={{ background: `linear-gradient(130deg,${g.from},${g.to})` }}
                        >
                          <span className="absolute left-3 top-2.5 text-xl font-extrabold leading-none">{g.value}</span>
                          <span className="absolute bottom-2.5 left-3 text-xs font-semibold text-white/85">{g.hint}</span>
                          {on && <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-extrabold text-void">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                  {tried && !a.goal && <p className="text-sm text-vo2">Pick your goal.</p>}
                  {a.goal === "Other" && (
                    <label className="block space-y-2">
                      <span className="text-sm text-subtext">
                        Distance in km, any number from {MIN_CUSTOM_KM} to {MAX_CUSTOM_KM} (like 3 or 8)
                      </span>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          min={MIN_CUSTOM_KM}
                          max={MAX_CUSTOM_KM}
                          placeholder="8"
                          aria-label="Goal distance in km"
                          className={field}
                          value={a.km}
                          onChange={(e) => set("km", e.target.value)}
                        />
                        <span className="text-base font-bold text-subtext">km</span>
                      </div>
                      {tried && !goalOk && (
                        <span className="block text-sm text-vo2">
                          Enter a distance from {MIN_CUSTOM_KM} to {MAX_CUSTOM_KM} km.
                        </span>
                      )}
                    </label>
                  )}
                </Question>

                <Question
                  icon={
                    <svg {...svgProps}>
                      <rect x="4" y="5" width="16" height="15" rx="2" />
                      <path d="M4 10h16M9 3v4M15 3v4" />
                    </svg>
                  }
                  from="#0047AB"
                  to="#2f7bff"
                  title={<>Race date {star}</>}
                >
                  <DatePicker value={a.date} onChange={(v) => set("date", v)} />
                  {tried && days <= 0 && <p className="text-sm text-vo2">Pick your race day on the calendar.</p>}
                </Question>

                <Question
                  icon={
                    <svg {...svgProps}>
                      <circle cx="12" cy="13" r="8" />
                      <path d="M12 9v4l2.5 2M9 2h6" />
                    </svg>
                  }
                  from="#e0c20d"
                  to="#e8891a"
                  title={<>Your goal pace {star}</>}
                >
                  <div className="flex items-center gap-3">
                    <input
                      placeholder="6:30 or 6"
                      aria-label="Goal pace in minutes per km"
                      className={field}
                      value={a.pace}
                      onChange={(e) => set("pace", e.target.value)}
                    />
                    <span className="shrink-0 text-base font-bold text-subtext">min / km</span>
                  </div>
                  {tried && normalizePace(a.pace) === null && <p className="text-sm text-vo2">Use a pace like 6:30, or a single number like 6 for 6:00.</p>}
                </Question>

                <button type="button" onClick={goNext} className={pill}>
                  Continue
                  <svg {...svgProps} strokeWidth={2.4}>
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
              </>
            )}

            {phase === "about" && (
              <>
                <Hero step="Step 2 of 2" title="About you" sub="Optional details help us keep your plan safe and realistic." onBack={() => setPhase("details")} />

                <Question icon={<RunnerIcon className="h-5 w-5" />} from="#58b91e" to="#d8c80c" title="Running history">
                  <div className="grid grid-cols-3 gap-2.5">
                    {LEVELS.map((l) => {
                      const on = a.level === l.value;
                      return (
                        <button
                          key={l.value}
                          type="button"
                          aria-pressed={on}
                          onClick={() => set("level", on ? "" : l.value)}
                          className={`rounded-2xl px-2 py-3 text-center text-white transition active:scale-95 ${on ? "scale-[1.03] ring-2 ring-white" : "opacity-85 hover:opacity-100"}`}
                          style={{ background: l.color }}
                        >
                          <span className="block text-sm font-extrabold">{l.value}</span>
                          <span className="block text-[11px] text-white/80">{l.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                </Question>

                <Question
                  icon={
                    <svg {...svgProps}>
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  }
                  from="#5e37a0"
                  to="#a070dc"
                  title="Any injury?"
                >
                  <textarea
                    rows={2}
                    placeholder="Leave blank if none, or say what hurts, e.g. knee pain after my first 10K"
                    aria-label="Injury"
                    className={`${field} h-auto py-3 font-normal`}
                    value={a.injury}
                    onChange={(e) => set("injury", e.target.value)}
                  />
                </Question>

                <button type="button" role="checkbox" aria-checked={a.agree} onClick={() => set("agree", !a.agree)} className="flex w-full items-start gap-3 rounded-2xl bg-elevated p-4 text-left text-sm">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: a.agree ? "#58b91e" : "#3a4150" }} aria-hidden="true">
                    {a.agree && (
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12.5l4.5 4.5L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className="text-subtext">
                    I agree to share my training details and any injury notes so Last Mile can build my plan. I understand it is guidance, not medical advice.{" "}
                    <span className="font-bold text-[#58b91e]">Terms &amp; Condition</span>
                  </span>
                </button>

                <button type="button" onClick={build} disabled={!a.agree} className={pill}>
                  Build my plan
                  <svg {...svgProps} strokeWidth={2.4}>
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
              </>
            )}

            {phase === "building" && (
              <>
                <Hero step="Almost there" title="Building your plan" sub="Please wait while we put together every week, up to race day." />
                <section className="rounded-2xl bg-elevated p-5">
                  <div className="flex justify-center gap-3" aria-hidden="true">
                    {STEPS.map((s, i) => {
                      const done = progress >= (i + 1) * 25 - 1;
                      return (
                        <div key={s.label} className="flex flex-col items-center gap-2">
                          <span
                            className="flex h-14 w-14 items-center justify-center rounded-full text-sm font-extrabold text-white transition-all duration-500"
                            style={{ background: done ? sessionBg(s.type) : "#1d2129" }}
                          >
                            {done ? "✓" : i + 1}
                          </span>
                          <span className="text-xs font-semibold text-subtext">{s.label}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-6 h-2.5 overflow-hidden rounded-full bg-carbon" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="Building your plan">
                    <div className="h-full rounded-full transition-all duration-200" style={{ width: `${progress}%`, background: BLUE_GRADIENT }} />
                  </div>
                  {error ? (
                    <div className="mt-5 text-center" role="alert">
                      <p className="text-sm text-vo2">{error}</p>
                      <button onClick={build} className="mt-3 text-sm font-bold text-teal">
                        Try again
                      </button>
                      <button onClick={() => setPhase("about")} className="ml-5 text-sm font-bold text-subtext">
                        Edit my answers
                      </button>
                    </div>
                  ) : (
                    <p className="mt-5 text-center text-sm text-subtext">This can take up to a minute for a long plan.</p>
                  )}
                </section>
              </>
            )}

            {phase === "success" && (
              <>
                <Hero step="Done" title="Your plan is ready" sub="It starts today and runs to race day." />
                <section className="rounded-2xl bg-elevated p-6 text-center">
                  <div className="relative mx-auto flex h-28 w-28 items-center justify-center" aria-hidden="true">
                    <span className="absolute inset-0 rounded-full bg-[#58b91e]/10" />
                    <span className="absolute inset-3 rounded-full bg-[#58b91e]/20" />
                    <span className="relative flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg" style={{ background: sessionBg("easy") }}>
                      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12.5l4.5 4.5L19 7" />
                      </svg>
                    </span>
                  </div>
                  <h2 className="mt-4 text-2xl font-extrabold">Success</h2>
                  <p className="mt-1 text-subtext">Congratulations! Your {SESSION_STYLE.easy.label.toLowerCase()}s, long runs and more are mapped out week by week.</p>
                </section>
                <button type="button" onClick={viewPlan} className={pill}>
                  View my plan
                </button>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      {showTabs && <BottomTabs showRecord={false} />}
    </div>
  );
}

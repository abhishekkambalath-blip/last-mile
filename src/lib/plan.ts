// Where the prototype keeps the runner's answers and their plan (this browser only).
export const PLAN_STORAGE_KEY = "last-mile:onboarding";

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Day = (typeof DAYS)[number];

export type Level = "Beginner" | "Intermediate" | "Advanced";

export type Profile = {
  goalPace: string; // min/km for race day, e.g. "6:30"
  distance: "5K" | "10K" | "21K" | "Marathon";
  raceDate: string; // yyyy-mm-dd
  level: "" | Level; // optional; blank is treated as Beginner
  injury: string;
};

export type RunType = "rest" | "walk-run" | "easy" | "long";

export type PlanDay = {
  day: Day;
  type: RunType;
  distanceKm: number;
  pace: string; // target pace, set by rules from the goal pace
  effort: string;
  note: string;
};

export type PlanWeek = { week: number; days: PlanDay[] };

export type Plan = {
  summary: string;
  weeks: PlanWeek[];
  rulesApplied: string[];
  source: "claude" | "fallback";
};

export const RACE_KM: Record<Profile["distance"], number> = { "5K": 5, "10K": 10, "21K": 21.1, Marathon: 42.2 };

// Rule limits per level. A coach or physio should sign these off (see MVP scope, section 5).
// Week 1 totals are kept low on purpose; later weeks grow by at most 10%.
export const LIMITS: Record<
  Level,
  { runDays: number; restDays: number; week1Km: number; week1KmInjury: number; singleKm: number; singleKmInjury: number }
> = {
  Beginner: { runDays: 4, restDays: 3, week1Km: 12, week1KmInjury: 8, singleKm: 5, singleKmInjury: 3 },
  Intermediate: { runDays: 5, restDays: 2, week1Km: 28, week1KmInjury: 16, singleKm: 12, singleKmInjury: 7 },
  Advanced: { runDays: 6, restDays: 1, week1Km: 45, week1KmInjury: 28, singleKm: 20, singleKmInjury: 12 },
};
const MAX_CONSECUTIVE_RUN_DAYS = 2;
const WEEKLY_GROWTH = 1.1;

const round1 = (n: number) => Math.round(n * 10) / 10;
const isRun = (d: PlanDay) => d.type !== "rest";
const weekKm = (w: PlanWeek) => w.days.reduce((s, d) => s + d.distanceKm, 0);

export const levelOf = (p: Profile): Level => (p.level === "" ? "Beginner" : p.level);

export function hasInjury(p: Profile) {
  const t = p.injury.trim().toLowerCase();
  return t !== "" && !["none", "no", "nil", "n/a", "na"].includes(t);
}

export function daysToRace(raceDate: string, now = new Date()) {
  const ms = new Date(`${raceDate}T00:00:00`).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 3600 * 1000)));
}

export function weeksToRace(raceDate: string, now = new Date()) {
  const ms = new Date(`${raceDate}T00:00:00`).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (7 * 24 * 3600 * 1000)));
}

const toSec = (pace: string) => {
  const [m, s] = pace.split(":").map(Number);
  return m * 60 + s;
};
const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

/** Target pace range for a session, built from the runner's race-day goal pace. */
export function paceFor(type: RunType, goalPace: string): string {
  const g = toSec(goalPace);
  if (type === "rest") return "-";
  // Training is slower than race pace: easy runs are 60-90 s/km slower, long runs a bit more, run/walk slower still.
  const [lo, hi] = type === "easy" ? [60, 90] : type === "long" ? [75, 105] : [90, 135];
  return `${fmt(g + lo)}-${fmt(g + hi)} /km${type === "walk-run" ? " (jog parts)" : ""}`;
}

function toRest(d: PlanDay) {
  d.type = "rest";
  d.distanceKm = 0;
  d.effort = "-";
  d.pace = "-";
  d.note = "Rest day";
}

/** Applies the hard caps and fills in paces. Claude's draft can never override these. */
export function applyRules(weeks: PlanWeek[], profile: Profile): { weeks: PlanWeek[]; applied: string[] } {
  const applied: string[] = [];
  const injured = hasInjury(profile);
  const lim = LIMITS[levelOf(profile)];
  // No single run longer than the race itself.
  const singleCap = Math.min(injured ? lim.singleKmInjury : lim.singleKm, RACE_KM[profile.distance]);
  const maxRuns = Math.min(lim.runDays, 7 - lim.restDays);
  let prevKm = injured ? lim.week1KmInjury : lim.week1Km;

  weeks.forEach((w, wi) => {
    w.days.sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day));

    // 1. Max run days (so at least the minimum rest days): drop the shortest runs first.
    while (w.days.filter(isRun).length > maxRuns) {
      const shortest = w.days.filter(isRun).sort((a, b) => a.distanceKm - b.distanceKm)[0];
      toRest(shortest);
      applied.push(`Week ${w.week}: capped at ${maxRuns} run days (at least ${7 - maxRuns} rest days).`);
    }

    // 2. No more than 2 runs in a row.
    let streak = 0;
    for (const d of w.days) {
      streak = isRun(d) ? streak + 1 : 0;
      if (streak > MAX_CONSECUTIVE_RUN_DAYS) {
        toRest(d);
        streak = 0;
        applied.push(`Week ${w.week}: added a rest day after ${MAX_CONSECUTIVE_RUN_DAYS} runs in a row.`);
      }
    }

    // 3. Cap each single run.
    for (const d of w.days) {
      if (d.distanceKm > singleCap) {
        d.distanceKm = singleCap;
        applied.push(`Week ${w.week}: ${d.day} run shortened to ${singleCap} km.`);
      }
    }

    // 4. Cap weekly volume (week 1 fixed, later weeks +10% at most).
    const cap = wi === 0 ? prevKm : prevKm * WEEKLY_GROWTH;
    const total = weekKm(w);
    if (total > cap) {
      const f = cap / total;
      w.days.forEach((d) => (d.distanceKm = round1(d.distanceKm * f)));
      applied.push(`Week ${w.week}: weekly distance scaled from ${round1(total)} km to ${round1(weekKm(w))} km.`);
    }
    prevKm = Math.max(weekKm(w), prevKm);

    // 5. Round, and set target pace from the goal pace.
    w.days.forEach((d) => {
      d.distanceKm = round1(d.distanceKm);
      d.pace = paceFor(d.type, profile.goalPace);
    });
  });

  return { weeks, applied: [...new Set(applied)] };
}

/** A sensible starter plan for the runner's level, used when Claude is unavailable or invalid. */
export function fallbackWeeks(level: Level): PlanWeek[] {
  const note: Record<RunType, string> = {
    rest: "Rest day",
    "walk-run": "Alternate 1 min easy jog and 2 min walk",
    easy: "Steady, relaxed pace. You can talk in full sentences",
    long: "Your longest run of the week. Keep it relaxed",
  };
  const effort: Record<RunType, string> = {
    rest: "-",
    "walk-run": "Very easy",
    easy: "Easy",
    long: "Easy, steady",
  };
  const week = (n: number, plan: Partial<Record<Day, [RunType, number]>>, scale: number): PlanWeek => ({
    week: n,
    days: DAYS.map((day) => {
      const [type, km] = plan[day] ?? (["rest", 0] as [RunType, number]);
      return { day, type, distanceKm: round1(km * scale), pace: "-", effort: effort[type], note: note[type] };
    }),
  });
  const templates: Record<Level, Partial<Record<Day, [RunType, number]>>> = {
    Beginner: { Tue: ["walk-run", 2], Thu: ["walk-run", 2], Sat: ["walk-run", 3] },
    Intermediate: { Tue: ["easy", 5], Thu: ["easy", 5], Sat: ["long", 8], Sun: ["easy", 4] },
    Advanced: { Tue: ["easy", 8], Wed: ["easy", 6], Fri: ["easy", 8], Sat: ["long", 14], Sun: ["easy", 6] },
  };
  return [week(1, templates[level], 1), week(2, templates[level], WEEKLY_GROWTH)];
}

/** Checks Claude's JSON has the shape we need. Returns null if not. */
export function parseWeeks(raw: unknown): { summary: string; weeks: PlanWeek[] } | null {
  const o = raw as { summary?: unknown; weeks?: unknown };
  if (!o || typeof o.summary !== "string" || !Array.isArray(o.weeks) || o.weeks.length < 1) return null;
  const types: RunType[] = ["rest", "walk-run", "easy", "long"];
  const weeks: PlanWeek[] = [];
  for (const [wi, w] of (o.weeks as { days?: unknown[] }[]).slice(0, 2).entries()) {
    if (!Array.isArray(w?.days)) return null;
    const days: PlanDay[] = [];
    for (const d of w.days as Partial<PlanDay>[]) {
      if (!d || !DAYS.includes(d.day as Day) || !types.includes(d.type as RunType)) return null;
      const km = Number(d.distanceKm);
      if (!Number.isFinite(km) || km < 0) return null;
      days.push({
        day: d.day as Day,
        type: d.type as RunType,
        distanceKm: d.type === "rest" ? 0 : km,
        pace: "-",
        effort: String(d.effort ?? ""),
        note: String(d.note ?? ""),
      });
    }
    // Fill missing days as rest so every week has all 7.
    for (const day of DAYS) {
      if (!days.some((x) => x.day === day))
        days.push({ day, type: "rest", distanceKm: 0, pace: "-", effort: "-", note: "Rest day" });
    }
    weeks.push({ week: wi + 1, days: days.filter((x, i, a) => a.findIndex((y) => y.day === x.day) === i) });
  }
  return { summary: o.summary, weeks };
}

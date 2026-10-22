// Where the prototype keeps the runner's answers and their plan (this browser only).
export const PLAN_STORAGE_KEY = "last-mile:onboarding";

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Day = (typeof DAYS)[number];

export type Level = "Beginner" | "Intermediate" | "Advanced";

export type Profile = {
  goalPace: string; // min/km for race day, e.g. "6:30"
  distance: "5K" | "10K" | "21K" | "Marathon"; // the training category; a custom goal maps to the nearest one
  raceKm?: number; // set only for a custom goal distance, e.g. 8
  label?: string; // what to call a custom goal, e.g. "8 km"
  raceDate: string; // yyyy-mm-dd
  level: "" | Level; // optional; blank is treated as Beginner
  injury: string;
};

export type RunType = "rest" | "walk-run" | "easy" | "long" | "tempo" | "intervals" | "race";

export type PlanDay = {
  day: Day;
  type: RunType;
  distanceKm: number;
  pace: string; // target pace, set by rules from the goal pace
  effort: string;
  note: string;
};

// The first FREE_WEEKS weeks are free. The rest of the plan, up to race day, needs a subscription.
export const FREE_WEEKS = 2;
export const PRICE_INR = 4999; // per year
export const MAX_PLAN_WEEKS = 52;

export type PlanWeek = {
  week: number;
  days: PlanDay[];
  phase?: string; // e.g. "Base Build"
  focus?: string; // one line on what this week is for, e.g. "Build your aerobic base"
  kind?: "build" | "recovery" | "taper";
};

export type Plan = {
  summary: string;
  weeks: PlanWeek[];
  rulesApplied: string[];
  source: "claude" | "fallback";
  totalWeeks?: number; // weeks from the start of week 1 to race week
  aiWeeks?: number; // how many weeks were written by the AI; the rest were written by rules
  adaptedFor?: string[]; // ids of runs the plan has already been eased for
};

export const RACE_KM: Record<Profile["distance"], number> = { "5K": 5, "10K": 10, "21K": 21.1, Marathon: 42.2 };

// A runner may also type their own goal distance, from a single kilometre up to a marathon.
export const MIN_CUSTOM_KM = 1;
export const MAX_CUSTOM_KM = 42.2;

/** The real race distance in km, whether a preset or a custom goal. */
export const raceKmOf = (p: Profile) => p.raceKm ?? RACE_KM[p.distance];

/** How to name the goal on screen: "10K" for a preset, "8 km" for a custom distance. */
export const goalLabel = (p: Profile) => p.label ?? p.distance;

/** Which training category (pace targets, peak distance) a custom distance belongs to. */
export function categoryFor(km: number): Profile["distance"] {
  return km <= 7.5 ? "5K" : km <= 15 ? "10K" : km <= 30 ? "21K" : "Marathon";
}

/** Reads a goal pace. "6" means 6:00 and "6:30" stays as it is. Returns null if it is not a pace. */
export function normalizePace(input: string): string | null {
  const t = input.trim();
  const pace = /^\d{1,2}$/.test(t) ? `${Number(t)}:00` : /^\d{1,2}:[0-5]\d$/.test(t) ? t : null;
  if (!pace) return null;
  const [m, s] = pace.split(":").map(Number);
  const sec = m * 60 + s;
  return sec >= 150 && sec <= 900 ? pace : null; // between 2:30 and 15:00 per km
}

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

// Tempo and interval paces sit around the goal pace, and which side depends on the race:
// for a 5K the goal pace is hard, so tempo is a bit slower than it. For a marathon, tempo is faster.
// Offsets are seconds per km from the goal pace: [from, to].
const TEMPO_OFFSET: Record<Profile["distance"], [number, number]> = { "5K": [20, 35], "10K": [10, 25], "21K": [-5, 10], Marathon: [-20, -5] };
const INTERVAL_OFFSET: Record<Profile["distance"], [number, number]> = { "5K": [-15, -5], "10K": [-25, -15], "21K": [-40, -30], Marathon: [-55, -40] };

/** Target pace range for a session, built from the runner's race-day goal pace. */
export function paceFor(type: RunType, goalPace: string, distance: Profile["distance"] = "10K"): string {
  const g = toSec(goalPace);
  if (type === "rest") return "-";
  if (type === "race") return `${fmt(g - 5)}-${fmt(g + 5)} /km`; // race day: hold the goal pace
  // Easy runs are 60-90 s/km slower than race pace, long runs a bit more, run/walk slower still.
  const [lo, hi] =
    type === "easy" ? [60, 90] : type === "long" ? [75, 105] : type === "tempo" ? TEMPO_OFFSET[distance] : type === "intervals" ? INTERVAL_OFFSET[distance] : [90, 135];
  return `${fmt(g + lo)}-${fmt(g + hi)} /km${type === "walk-run" ? " (jog parts)" : ""}`;
}

const isQuality = (t: RunType) => t === "tempo" || t === "intervals";

/** How many hard sessions (tempo or intervals) a week may hold. */
export function maxQualityFor(level: Level, injured: boolean, week: number, phase?: string, kind?: string): number {
  if (kind === "recovery") return 0;
  if (week < (level === "Beginner" ? 6 : injured ? 4 : 2)) return 0;
  if (kind === "taper") return level === "Beginner" ? 0 : 1;
  const peaking = (phase === "Build Peak" || phase === "Race Specificity") && week >= (level === "Advanced" ? 4 : 6);
  let q = level === "Beginner" ? 1 : peaking ? 2 : 1;
  if (injured) q = level === "Beginner" ? 0 : Math.min(q, 1);
  return q;
}

// Minutes of jogging per run/walk interval, week by week. By week 10 a beginner is running continuously.
const JOG_MIN = [1, 1, 2, 2, 3, 3, 4, 5, 6, 8];
const jogMin = (week: number) => JOG_MIN[Math.min(week - 1, JOG_MIN.length - 1)];

function demoteToEasy(d: PlanDay, level: Level, week: number) {
  const walkRun = level === "Beginner" && week < 10;
  d.type = walkRun ? "walk-run" : "easy";
  d.effort = walkRun ? "Very easy" : "Easy";
  d.note = walkRun ? `Jog ${jogMin(week)} min, walk ${jogMin(week) >= 4 ? 1 : 2} min, repeat.` : "Relaxed pace. You should be able to talk.";
}

function toRest(d: PlanDay) {
  d.type = "rest";
  d.distanceKm = 0;
  d.effort = "-";
  d.pace = "-";
  d.note = "Rest day";
}

const trainKm = (w: PlanWeek) => w.days.filter((d) => d.type !== "race").reduce((sum, d) => sum + d.distanceKm, 0);
const isTrain = (d: PlanDay) => isRun(d) && d.type !== "race"; // the race itself is never capped, shortened or removed

/** Applies the hard caps and fills in paces. Claude's draft can never override these. */
export function applyRules(weeks: PlanWeek[], profile: Profile): { weeks: PlanWeek[]; applied: string[] } {
  const applied: string[] = [];
  const injured = hasInjury(profile);
  const lim = LIMITS[levelOf(profile)];
  const maxRuns = Math.min(lim.runDays, 7 - lim.restDays);
  let prevKm = injured ? lim.week1KmInjury : lim.week1Km;

  weeks.forEach((w, wi) => {
    w.days.sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day));

    // 0. Hard sessions (tempo, intervals): a limited number a week, none next to each other or next to the
    // long run or the race, none too early for the level. Extra ones become easy runs.
    {
      const maxQ = maxQualityFor(levelOf(profile), injured, w.week, w.phase, w.kind);
      let used = 0;
      w.days.forEach((d, i) => {
        if (!isQuality(d.type)) return;
        const near = [w.days[i - 1], w.days[i + 1]].some((n) => n && (isQuality(n.type) || n.type === "long" || n.type === "race"));
        // With an injury, interval sessions are not used at all; easy runs and one tempo run a week at most.
        if (used >= maxQ || near || (injured && d.type === "intervals")) {
          demoteToEasy(d, levelOf(profile), w.week);
          applied.push(`Week ${w.week}: ${d.day} hard session changed to an easy run.`);
        } else used++;
      });
    }

    // 1. Max run days (so at least the minimum rest days): drop the shortest runs first.
    while (w.days.filter(isTrain).length > maxRuns) {
      const shortest = w.days.filter(isTrain).sort((a, b) => a.distanceKm - b.distanceKm)[0];
      toRest(shortest);
      applied.push(`Week ${w.week}: capped at ${maxRuns} run days (at least ${7 - maxRuns} rest days).`);
    }

    // 2. No more than 2 runs in a row.
    let streak = 0;
    for (const d of w.days) {
      streak = isRun(d) ? streak + 1 : 0;
      if (streak > MAX_CONSECUTIVE_RUN_DAYS && d.type !== "race") {
        toRest(d);
        streak = 0;
        applied.push(`Week ${w.week}: added a rest day after ${MAX_CONSECUTIVE_RUN_DAYS} runs in a row.`);
      }
    }

    // 3. Cap each single run. The cap is fixed for weeks 1-2, then may grow 10% a week,
    // and no run is longer than the longest run planned for this race (see longestRunKm).
    const singleCap = singleRunCap(profile, wi);
    for (const d of w.days) {
      if (d.type !== "race" && d.distanceKm > singleCap) {
        d.distanceKm = singleCap;
        applied.push(`Week ${w.week}: ${d.day} run shortened to ${singleCap} km.`);
      }
    }

    // 4. Cap weekly volume (week 1 fixed, later weeks +10% at most). Race day does not count towards it.
    const cap = wi === 0 ? prevKm : prevKm * WEEKLY_GROWTH;
    const total = trainKm(w);
    if (total > cap) {
      const f = cap / total;
      w.days.forEach((d) => {
        if (d.type !== "race") d.distanceKm = round1(d.distanceKm * f);
      });
      applied.push(`Week ${w.week}: weekly distance scaled from ${round1(total)} km to ${round1(trainKm(w))} km.`);
    }
    prevKm = Math.max(trainKm(w), prevKm);

    // 5. Round, and set target pace from the goal pace.
    w.days.forEach((d) => {
      d.distanceKm = round1(d.distanceKm);
      d.pace = paceFor(d.type, profile.goalPace, profile.distance);
    });
  });

  return { weeks, applied: [...new Set(applied)] };
}

// ---------------------------------------------------------------------------
// The whole plan, week by week, up to race day.
// Rules decide the shape of every week. The AI writes the sessions inside that shape.
// If the AI is unavailable, rules write the sessions too.
// ---------------------------------------------------------------------------

const PHASE_NAMES = ["Base Build", "Build Peak", "Race Specificity", "Taper"];

/** Splits the weeks until the race into the four classic phases. */
export function phasesFor(weeks: number): { name: string; weeks: number }[] {
  if (weeks < 4) return PHASE_NAMES.slice(4 - Math.max(1, weeks)).map((name) => ({ name, weeks: 1 }));
  const w = [0.4, 0.3, 0.2, 0.1].map((s) => Math.max(1, Math.floor(weeks * s)));
  let left = weeks - w.reduce((a, b) => a + b, 0);
  for (let i = 0; left > 0; i = (i + 1) % 3, left--) w[i]++;
  return PHASE_NAMES.map((name, i) => ({ name, weeks: w[i] }));
}

/**
 * Number of 7-day weeks from today (week 1 starts today) to the week that holds race day, at least 2.
 */
export function totalPlanWeeks(raceDate: string, from = new Date()) {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const days = Math.round((new Date(`${raceDate}T00:00:00`).getTime() - start.getTime()) / 86400000);
  return Math.min(MAX_PLAN_WEEKS, Math.max(2, Math.ceil((days + 1) / 7)));
}

// What a runner of each level builds up to, for the four standard races. A custom distance falls between them.
// Weekly distance still never grows faster than 10% a week.
type ByLevel = Record<Level, number>;
const ANCHOR_KM = [5, 10, 21.1, 42.2];
const PEAK_WEEK: ByLevel[] = [
  { Beginner: 20, Intermediate: 32, Advanced: 42 }, // 5K
  { Beginner: 28, Intermediate: 42, Advanced: 55 }, // 10K
  { Beginner: 40, Intermediate: 55, Advanced: 72 }, // half marathon
  { Beginner: 52, Intermediate: 68, Advanced: 90 }, // marathon
];
// The longest run of the whole plan. It goes beyond a 5K or 10K, and stays under a marathon.
const PEAK_LONG: ByLevel[] = [
  { Beginner: 6, Intermediate: 9, Advanced: 12 },
  { Beginner: 8, Intermediate: 12, Advanced: 16 },
  { Beginner: 13, Intermediate: 18, Advanced: 22 },
  { Beginner: 24, Intermediate: 30, Advanced: 34 },
];

/**
 * The longest single run the plan may hold: the longest long run that suits this race, and never less than the
 * race itself. For a 5K or 10K that is past the race distance, and for a marathon it stays well under it.
 */
export function longestRunKm(profile: Profile): number {
  const long = byKm(PEAK_LONG, raceKmOf(profile), levelOf(profile)) * (hasInjury(profile) ? 0.75 : 1);
  return round1(Math.max(raceKmOf(profile), long));
}

/** The longest any one run may be in a given week: fixed for weeks 1-2, then up to 10% longer each week. */
export function singleRunCap(profile: Profile, weekIndex: number): number {
  const lim = LIMITS[levelOf(profile)];
  const base = hasInjury(profile) ? lim.singleKmInjury : lim.singleKm;
  return round1(Math.min(base * Math.pow(1.1, Math.max(0, weekIndex - 1)), longestRunKm(profile)));
}

/** Reads a value for a race distance, in between the four standard races when the goal is a custom distance. */
function byKm(table: ByLevel[], km: number, level: Level): number {
  if (km <= ANCHOR_KM[0]) return table[0][level] * Math.max(0.6, km / ANCHOR_KM[0]);
  for (let i = 1; i < ANCHOR_KM.length; i++) {
    if (km <= ANCHOR_KM[i]) {
      const t = (km - ANCHOR_KM[i - 1]) / (ANCHOR_KM[i] - ANCHOR_KM[i - 1]);
      return table[i - 1][level] + (table[i][level] - table[i - 1][level]) * t;
    }
  }
  return table[table.length - 1][level];
}

const RUN_DAYS: Record<Level, number> = { Beginner: 3, Intermediate: 4, Advanced: 5 };

/** What one week of the plan must look like. Sessions are written to fit it. */
export type SkeletonWeek = {
  week: number;
  phase: string;
  kind: "build" | "recovery" | "taper";
  targetKm: number;
  runDays: number;
  maxQuality: number; // hard sessions (tempo or intervals) allowed this week
  longRunKm: number; // the long run this week; 0 in race week
  focus: string; // what the week is for
  raceWeek: boolean;
};

const focusOf = (phase: string, kind: SkeletonWeek["kind"], raceWeek: boolean) =>
  raceWeek
    ? "Race week: stay fresh and trust your training"
    : kind === "taper"
      ? "Taper: keep it light and sharp"
      : kind === "recovery"
        ? "Recovery week: absorb the work"
        : phase === "Base Build"
          ? "Build your aerobic base"
          : phase === "Build Peak"
            ? "Add speed and strength"
            : "Practise your race pace";

export function phaseOfWeek(index: number, total: number) {
  const phases = phasesFor(total);
  let acc = 0;
  for (const p of phases) {
    acc += p.weeks;
    if (index < acc) return p.name;
  }
  return phases[phases.length - 1].name;
}

/**
 * Week-by-week shape of the plan. Weekly distance grows about 9% to the peak for this race and level,
 * every fourth week is a lighter recovery week, and the last one or two weeks taper.
 * The long run builds toward the longest run that suits the race: past a 5K or 10K, up to about 30 km for a marathon.
 */
export function buildSkeleton(profile: Profile, total: number): SkeletonWeek[] {
  const level = levelOf(profile);
  const injured = hasInjury(profile);
  const lim = LIMITS[level];
  const km = raceKmOf(profile);
  const scale = injured ? 0.75 : 1;
  const peak = byKm(PEAK_WEEK, km, level) * scale;
  const peakLong = byKm(PEAK_LONG, km, level) * scale;
  const runDays = injured ? Math.max(3, RUN_DAYS[level] - 1) : RUN_DAYS[level];
  const taperWeeks = total >= 10 ? 2 : 1;

  let base = round1((injured ? lim.week1KmInjury : lim.week1Km) * 0.75); // latest regular build-week distance
  let top = base; // highest regular week so far, used to size the taper
  const out: SkeletonWeek[] = [];

  for (let i = 0; i < total; i++) {
    const week = i + 1;
    const fromEnd = total - i; // 1 = race week
    const phase = phaseOfWeek(i, total);
    let kind: SkeletonWeek["kind"];
    let weekly: number;
    if (fromEnd <= taperWeeks && total > taperWeeks) {
      kind = "taper";
      weekly = top * (fromEnd === 1 ? (taperWeeks === 2 ? 0.5 : 0.6) : 0.75);
    } else if (week % 4 === 0) {
      kind = "recovery";
      weekly = base * 0.8;
    } else {
      kind = "build";
      if (i > 0) base = Math.min(base * 1.09, Math.max(peak, base));
      top = Math.max(top, base);
      weekly = base;
    }
    const raceWeek = fromEnd === 1;
    out.push({
      week,
      phase,
      kind,
      targetKm: round1(weekly),
      runDays,
      maxQuality: maxQualityFor(level, injured, week, phase, kind),
      longRunKm: 0,
      focus: focusOf(phase, kind, raceWeek),
      raceWeek,
    });
  }

  // The long run grows from about a third of the first week toward the peak, week by build week.
  const builds = out.filter((r) => r.kind === "build");
  const startLong = Math.max(2, round1(out[0].targetKm * 0.34));
  const goal = Math.max(peakLong, startLong);
  let lastBuildLong = startLong;
  let b = 0;
  out.forEach((r) => {
    if (r.raceWeek) r.longRunKm = 0;
    else if (r.kind === "build") {
      const t = builds.length > 1 ? b++ / (builds.length - 1) : 1;
      const long = Math.min(startLong + (goal - startLong) * t, goal, r.targetKm * (runDays <= 3 ? 0.5 : 0.45));
      r.longRunKm = round1(Math.max(long, Math.min(r.targetKm * 0.28, goal)));
      lastBuildLong = r.longRunKm;
    } else if (r.kind === "recovery") r.longRunKm = round1(lastBuildLong * 0.75);
    else r.longRunKm = round1(lastBuildLong * 0.65);
  });
  return out;
}

// Which days a week's runs go on. The last day is the long run. Hard sessions go on Tuesday and Thursday,
// so they are never next to the long run.
const LAYOUT: Record<number, Day[]> = {
  3: ["Tue", "Thu", "Sat"],
  4: ["Tue", "Thu", "Sat", "Sun"],
  5: ["Mon", "Tue", "Thu", "Sat", "Sun"],
};

const restDay = (day: Day): PlanDay => ({ day, type: "rest", distanceKm: 0, pace: "-", effort: "-", note: "Rest day" });

function sessionText(type: RunType, row: SkeletonWeek, profile: Profile): { effort: string; note: string } {
  const level = levelOf(profile);
  const week = row.week;
  const taper = row.kind === "taper";
  if (type === "tempo") {
    const start = { Beginner: 10, Intermediate: 15, Advanced: 20 }[level];
    const cap = { Beginner: 20, Intermediate: 30, Advanced: 40 }[level];
    let min = Math.min(start + 2 * Math.floor(week / 2), cap);
    if (taper) min = Math.round(min / 2);
    return { effort: "Comfortably hard", note: `${min} min at tempo pace.` };
  }
  if (type === "intervals") {
    if (level === "Beginner") {
      const reps = Math.min(4 + Math.floor((week - 6) / 2), 8);
      return { effort: "Hard efforts, easy recoveries", note: `${reps} x 1 min faster, 90 s easy jog between.` };
    }
    const rep = { "5K": 400, "10K": 800, "21K": 1000, Marathon: 1000 }[profile.distance];
    let reps = Math.min(4 + Math.floor(week / 2), { Intermediate: 8, Advanced: 10 }[level]);
    if (taper) reps = Math.max(3, Math.round(reps * 0.6));
    const rec = rep === 400 ? "90 s" : "2 min";
    return { effort: "Hard efforts, easy recoveries", note: `${reps} x ${rep} m at interval pace, ${rec} easy jog between.` };
  }
  const prefix = taper ? "Taper: keep it light so you arrive fresh. " : row.kind === "recovery" ? "Recovery week: shorter and easier on purpose. " : "";
  if (type === "walk-run") return { effort: "Very easy", note: `${prefix}Jog ${jogMin(week)} min, walk ${jogMin(week) >= 4 ? 1 : 2} min, repeat.` };
  if (type === "long") {
    if (level === "Beginner" && week < 10) return { effort: "Easy, steady", note: `${prefix}Long run with walk breaks: jog ${jogMin(week)} min, walk 1 min.` };
    return { effort: "Easy, steady", note: `${prefix}Build time on your feet at an easy, steady pace.` };
  }
  return { effort: "Easy", note: `${prefix}Relaxed pace. You should be able to talk.` };
}

/** Rule-written sessions for one week. Used when the AI is unavailable or its answer is not usable. */
export function ruleWeek(row: SkeletonWeek, profile: Profile): PlanDay[] {
  const level = levelOf(profile);
  const days = LAYOUT[row.runDays] ?? LAYOUT[3];
  const longDay = days[days.length - 1];
  const slots = (["Tue", "Thu"] as Day[]).filter((d) => days.includes(d)).slice(0, row.maxQuality);
  const injured = hasInjury(profile);
  const hard: RunType[] = injured
    ? ["tempo"]
    : row.maxQuality >= 2
      ? ["intervals", "tempo"]
      : row.phase === "Build Peak" && row.week % 2 === 0
        ? ["intervals"]
        : ["tempo"];
  const walkRun = level === "Beginner" && row.week < 10;

  // The long run has a set distance for the week (none in race week). The other runs share what is left,
  // with hard sessions a little longer than easy ones.
  const hasLong = row.longRunKm > 0;
  const longKm = hasLong ? Math.min(row.longRunKm, singleRunCap(profile, row.week - 1), row.targetKm * 0.6) : 0;
  const others = days.filter((d) => hasLong ? d !== longDay : true);
  const weight = (d: Day) => (slots.includes(d) ? 1.2 : 1);
  const weightSum = others.reduce((sum, d) => sum + weight(d), 0) || 1;
  const shareKm = (d: Day) => ((row.targetKm - longKm) * weight(d)) / weightSum;

  return DAYS.map((day): PlanDay => {
    if (!days.includes(day)) return restDay(day);
    let type: RunType;
    let km: number;
    if (hasLong && day === longDay) {
      type = walkRun && row.week < 5 ? "walk-run" : "long";
      km = longKm;
    } else if (slots.includes(day)) {
      type = hard[slots.indexOf(day)] ?? "tempo";
      km = shareKm(day);
    } else {
      type = walkRun ? "walk-run" : "easy";
      km = shareKm(day);
    }
    return { day, type, distanceKm: round1(km), pace: "-", ...sessionText(type, row, profile) };
  });
}

const AI_TYPES: RunType[] = ["walk-run", "easy", "long", "tempo", "intervals"];

/** What the AI wrote for one week. */
export type AiWeek = { days: PlanDay[]; focus?: string };

/** Reads one AI answer. Returns what it wrote for each week, plus the summary if it wrote one. */
export function parseAiChunk(raw: unknown): { summary?: string; weeks: Map<number, AiWeek> } | null {
  const o = raw as { summary?: unknown; weeks?: unknown };
  if (!o || !Array.isArray(o.weeks)) return null;
  const weeks = new Map<number, AiWeek>();
  for (const w of o.weeks as { week?: unknown; days?: unknown; focus?: unknown }[]) {
    const n = Number(w?.week);
    if (!Number.isInteger(n) || !Array.isArray(w.days)) continue;
    const runs = new Map<Day, PlanDay>();
    let ok = true;
    for (const d of w.days as Partial<PlanDay>[]) {
      if (!d || !DAYS.includes(d.day as Day)) { ok = false; break; }
      if (d.type === "rest") continue;
      const km = Number(d.distanceKm);
      if (!AI_TYPES.includes(d.type as RunType) || !Number.isFinite(km) || km <= 0) { ok = false; break; }
      runs.set(d.day as Day, { day: d.day as Day, type: d.type as RunType, distanceKm: km, pace: "-", effort: String(d.effort ?? "").slice(0, 80), note: String(d.note ?? "").slice(0, 200) });
    }
    if (ok && runs.size > 0) {
      const focus = typeof w.focus === "string" && w.focus.trim() ? w.focus.trim().slice(0, 70) : undefined;
      weeks.set(n, { days: DAYS.map((day) => runs.get(day) ?? restDay(day)), focus });
    }
  }
  return { summary: typeof o.summary === "string" ? o.summary : undefined, weeks };
}

/**
 * Fits the AI's sessions to the shape of the week. First the structure is repaired (no more runs than the week
 * allows, never three run days in a row), then the long run gets the week's long-run distance and the other runs
 * share what is left of the week's target. Doing it in this order means no distance is lost to the safety rules
 * afterwards. Returns null when the sessions cannot be made to fit.
 */
function fitWeek(days: PlanDay[], row: SkeletonWeek, level: Level, cap: number): PlanDay[] | null {
  const copy = days.map((d) => ({ ...d }));
  const sum = (list: PlanDay[]) => list.reduce((s, d) => s + d.distanceKm, 0);
  const running = () => copy.filter(isRun);
  const keepsLong = (d: PlanDay) => d.type === "long";

  // 1. At most as many runs as the week allows: drop the shortest that is not the long run.
  while (running().length > row.runDays) {
    const drop = running().filter((d) => !keepsLong(d)).sort((a, b) => a.distanceKm - b.distanceKm)[0];
    if (!drop) return null;
    toRest(drop);
  }
  // 2. Never three run days in a row: drop the shortest of the three that is not the long run.
  copy.sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day));
  for (let i = 0; i + 2 < copy.length; i++) {
    const three = [copy[i], copy[i + 1], copy[i + 2]];
    if (three.every(isRun)) {
      const drop = three.filter((d) => !keepsLong(d)).sort((a, b) => a.distanceKm - b.distanceKm)[0];
      if (!drop) return null;
      toRest(drop);
    }
  }
  if (running().length < Math.max(1, row.runDays - 1)) return null;

  // 3. Long run and the shared distance.
  let others = running();
  let remaining = row.targetKm;
  let longCap = cap;
  if (row.longRunKm > 0) {
    const long = running().filter(keepsLong).sort((a, b) => b.distanceKm - a.distanceKm)[0];
    if (!long) return null; // every week except race week needs a long run
    long.distanceKm = Math.min(row.longRunKm, cap);
    others = running().filter((d) => d !== long);
    remaining = Math.max(row.targetKm - long.distanceKm, 0);
    longCap = Math.min(cap, round1(long.distanceKm * 0.9)); // no other run is longer than the long run
  } else {
    // Race week has no long run.
    running().filter(keepsLong).forEach((d) => demoteToEasy(d, level, row.week));
  }
  if (others.length) {
    const have = sum(others);
    if (have <= 0) return null;
    const f = remaining / have;
    if (f < 0.3 || f > 2.5) return null;
    others.forEach((d) => (d.distanceKm = Math.min(round1(d.distanceKm * f), longCap)));
  }
  return copy;
}

/**
 * Puts the plan together: for each week of the skeleton, use the AI's sessions if they can be fitted to the
 * week, and otherwise the rule-written sessions.
 */
export function assemblePlan(skeleton: SkeletonWeek[], ai: Map<number, AiWeek>, profile: Profile): { weeks: PlanWeek[]; aiWeeks: number } {
  let aiWeeks = 0;
  const weeks = skeleton.map((row): PlanWeek => {
    const written = ai.get(row.week);
    const fitted = written ? fitWeek(written.days, row, levelOf(profile), singleRunCap(profile, row.week - 1)) : null;
    if (fitted) aiWeeks++;
    return { week: row.week, phase: row.phase, kind: row.kind, focus: written?.focus ?? row.focus, days: fitted ?? ruleWeek(row, profile) };
  });
  return { weeks, aiWeeks };
}

/**
 * Puts race day on the plan, on its real date, and shapes the days around it: nothing hard in the two days
 * before, a short easy shakeout the day before (or rest for a beginner), and rest after. Week 1 starts on `from`.
 */
export function addRaceDay(weeks: PlanWeek[], profile: Profile, from = new Date()): PlanWeek[] {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const race = new Date(`${profile.raceDate}T00:00:00`);
  const diff = Math.round((race.getTime() - start.getTime()) / 86400000);
  const week = weeks[Math.floor(diff / 7)];
  if (diff < 0 || !week) return weeks; // the race is past the end of the plan
  const raceOffset = diff % 7;
  const level = levelOf(profile);
  const startDow = (start.getDay() + 6) % 7;

  week.focus = "Race week: stay fresh and trust your training";
  for (const d of week.days) {
    const offset = (DAYS.indexOf(d.day) - startDow + 7) % 7;
    if (offset === raceOffset) {
      d.type = "race";
      d.distanceKm = raceKmOf(profile);
      d.effort = "Race effort: start steady, finish strong";
      d.note = "Race day. Settle into your goal pace, and save a little for the final stretch.";
    } else if (offset > raceOffset) toRest(d);
    else if (raceOffset - offset === 1 && isRun(d)) {
      if (level === "Beginner") toRest(d);
      else {
        d.type = "easy";
        d.distanceKm = Math.min(d.distanceKm, 3);
        d.effort = "Very easy";
        d.note = "Short, easy shakeout with a few relaxed strides.";
      }
    } else if (raceOffset - offset === 2 && (isQuality(d.type) || d.type === "long")) {
      d.type = level === "Beginner" ? "walk-run" : "easy";
      d.distanceKm = Math.min(d.distanceKm, 5);
      d.effort = "Easy";
      d.note = "Keep it easy so your legs are fresh for race day.";
    }
  }
  return weeks;
}

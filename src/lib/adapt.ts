import { paceFor, type Plan, type PlanDay, type Profile, type RunType } from "@/lib/plan";
import type { Run } from "@/lib/runs";
import { addDays, daysBetween, planStart, sessionFor, startOfDay } from "@/lib/sessions";

// Feature 3: adapt the next workouts to how the last run went.
// Safety first: this only ever makes upcoming sessions easier. It never adds load by itself.
// These thresholds are starting values for a coach or physio to review (MVP scope, section 5).
export const ADAPT = {
  lookbackDays: 3, // only react to a run from the last few days
  tooHardEffort: 9, // effort 1-10 at or above this counts as too hard
  shortfall: 0.6, // finishing under 60% of the planned distance with high effort counts as struggling
  highEffort: 8,
  easeDays: 3, // how many upcoming run days are eased
  hardFactor: 0.85, // hard sessions become easy runs at this share of their distance
  longFactor: 0.8,
  easyFactor: 0.9,
};

const PAIN = /\b(pain|painful|injur\w*|hurt\w*|sharp|swollen|swelling|limp\w*|twinge|strain\w*|sore)\b/i;

export type Adaptation = {
  plan: Plan;
  changed: boolean;
  message: string;
  held?: boolean; // a person must look at the run before the plan changes
  runId?: string;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

function ease(d: PlanDay, profile: Profile): PlanDay {
  const hard = d.type === "tempo" || d.type === "intervals";
  const factor = hard ? ADAPT.hardFactor : d.type === "long" ? ADAPT.longFactor : ADAPT.easyFactor;
  const type: RunType = hard ? "easy" : d.type;
  return {
    ...d,
    type,
    distanceKm: round1(d.distanceKm * factor),
    pace: paceFor(type, profile.goalPace, profile.distance),
    effort: "Keep it very easy and listen to your body",
    note: `Eased after your last run. ${hard ? "Run it as an easy run instead." : "Shorter and gentler than planned."}`,
  };
}

/** Looks at the most recent run and, if it went badly, eases the next few sessions. Pure: returns a new plan. */
export function adaptPlan(plan: Plan, profile: Profile, createdAt: string | undefined, runs: Run[], now = new Date()): Adaptation {
  const unchanged = (message: string, extra: Partial<Adaptation> = {}): Adaptation => ({ plan, changed: false, message, ...extra });

  const run = [...runs].sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!run) return unchanged("No runs yet. Your plan stays as it is.");

  const runDay = startOfDay(new Date(run.date));
  if (daysBetween(runDay, now) > ADAPT.lookbackDays) return unchanged("Your last run was a while ago. Your plan stays as it is.", { runId: run.id });
  if ((plan.adaptedFor ?? []).includes(run.id)) return unchanged("Your plan already reflects your last run.", { runId: run.id });

  if (run.flagged) return unchanged("That run's GPS pace looked odd, so a person should look at it before your plan changes.", { held: true, runId: run.id });

  const start = planStart(createdAt);
  const planned = sessionFor(plan, start, runDay);
  const effort = run.checkIn?.effort ?? 0;
  const pain = run.checkIn ? PAIN.test(run.checkIn.feeling) : false;
  const short = planned && planned.day.distanceKm > 0 ? run.distanceKm < planned.day.distanceKm * ADAPT.shortfall : false;
  const struggling = pain || effort >= ADAPT.tooHardEffort || (short && effort >= ADAPT.highEffort);

  if (!struggling) return unchanged("Nice run. Your plan stays as it is.", { runId: run.id });

  // Ease the next few run days after the run.
  let left = ADAPT.easeDays;
  const weeks = plan.weeks.map((w) => ({ ...w, days: [...w.days] }));
  const eased: string[] = [];
  for (let i = 1; i <= 14 && left > 0; i++) {
    const date = addDays(runDay, i);
    const hit = sessionFor({ ...plan, weeks }, start, date);
    if (!hit || hit.day.type === "rest" || hit.day.type === "race") continue;
    const idx = weeks[hit.week].days.findIndex((d) => d.day === hit.day.day);
    weeks[hit.week].days[idx] = ease(hit.day, profile);
    eased.push(hit.day.day);
    left--;
  }

  const why = pain ? "You mentioned pain or soreness" : effort >= ADAPT.tooHardEffort ? `You rated that run ${effort}/10` : "You found that run hard and cut it short";
  const extra = pain ? " If it keeps hurting, rest and see a physio." : "";
  return {
    plan: { ...plan, weeks, adaptedFor: [...(plan.adaptedFor ?? []), run.id] },
    changed: eased.length > 0,
    message: eased.length ? `${why}, so your next ${eased.length} sessions (${eased.join(", ")}) are easier.${extra}` : `${why}. There are no sessions left to ease.${extra}`,
    runId: run.id,
  };
}

import { DAYS, type Day, type Plan, type PlanDay, type RunType } from "@/lib/plan";

/** Each run type has one signature color, used for its cards everywhere in the app. */
export const SESSION_STYLE: Record<RunType, { label: string; from: string; to: string }> = {
  rest: { label: "Rest", from: "#262b35", to: "#262b35" },
  "walk-run": { label: "Run / Walk", from: "#0ba58f", to: "#17405e" },
  easy: { label: "Easy Run", from: "#58b91e", to: "#d8c80c" },
  long: { label: "Long Run", from: "#5e37a0", to: "#a070dc" },
  tempo: { label: "Tempo Run", from: "#e0c20d", to: "#e8891a" },
  intervals: { label: "Intervals", from: "#f08a1c", to: "#db3a2a" },
  race: { label: "Race Day", from: "#b91c1c", to: "#f59e0b" },
};

export const sessionBg = (t: RunType) => `linear-gradient(120deg, ${SESSION_STYLE[t].from}, ${SESSION_STYLE[t].to})`;

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function mondayOf(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return addDays(x, -((x.getDay() + 6) % 7));
}

export const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** Whole days from a to b (negative if b is earlier). */
export const daysBetween = (a: Date, b: Date) => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);

/**
 * Week 1 starts on the day the plan was built. A plan saved before that was recorded
 * falls back to the Monday of the current week.
 */
export const planStart = (createdAt?: string) => (createdAt ? startOfDay(new Date(createdAt)) : mondayOf(new Date()));

/** The calendar date of a session: week `weekIdx` runs for 7 days from the start, and each weekday occurs once in it. */
export function dateOf(start: Date, weekIdx: number, day: Day): Date {
  const offset = (DAYS.indexOf(day) - ((start.getDay() + 6) % 7) + 7) % 7;
  return addDays(start, weekIdx * 7 + offset);
}

/** The planned day for a calendar date, or null if the date is outside the plan. */
export function sessionFor(plan: Plan, start: Date, date: Date): { week: number; day: PlanDay } | null {
  const diff = daysBetween(start, date);
  if (diff < 0 || diff >= plan.weeks.length * 7) return null;
  const week = Math.floor(diff / 7);
  const name = DAYS[(date.getDay() + 6) % 7];
  const day = plan.weeks[week]?.days.find((d) => d.day === name);
  return day ? { week, day } : null;
}

/** Estimated time on feet in minutes, from the middle of the target pace range. */
export function estMinutes(d: PlanDay) {
  const m = d.pace.match(/(\d+):(\d+)-(\d+):(\d+)/);
  if (!m || d.distanceKm <= 0) return 0;
  let mid = (Number(m[1]) * 60 + Number(m[2]) + Number(m[3]) * 60 + Number(m[4])) / 2;
  // Tempo and interval sessions include easy jogging, so the middle of their fast pace range is too quick for the whole run.
  if (d.type === "tempo") mid += 20;
  if (d.type === "intervals") mid += 40;
  return Math.round((mid * d.distanceKm) / 60);
}

/** Warm-up, main set and cool-down for a session. */
export function stepsFor(d: PlanDay): { name: string; detail: string }[] {
  if (d.type === "race") {
    const pace = d.pace && d.pace !== "-" ? ` Aim for ${d.pace}.` : "";
    return [
      { name: "Warm-up", detail: "10 to 15 min easy jog, then a few relaxed strides" },
      { name: "Race", detail: `${d.distanceKm} km.${pace} ${d.note}` },
      { name: "Cool-down", detail: "Walk, then jog easily for 10 minutes" },
    ];
  }
  if (d.type === "tempo" || d.type === "intervals") {
    const pace = d.pace && d.pace !== "-" ? ` Target pace ${d.pace}.` : "";
    const note = d.note.trim().replace(/[.\s]*$/, "."); // AI notes may arrive without a full stop
    return [
      { name: "Warm-up", detail: "10 min easy jog, then a few relaxed strides" },
      { name: "Main set", detail: `${note}${pace} About ${d.distanceKm} km in total.` },
      { name: "Cool-down", detail: "10 min easy jog or walk" },
    ];
  }
  const main = `${d.distanceKm} km${d.pace && d.pace !== "-" ? ` at ${d.pace}` : ""}${d.note ? `. ${d.note}` : ""}`;
  if (d.type === "walk-run")
    return [
      { name: "Warm-up", detail: "5 min brisk walk" },
      { name: "Main set", detail: main },
      { name: "Cool-down", detail: "5 min easy walk" },
    ];
  if (d.type === "long")
    return [
      { name: "Warm-up", detail: "10 min very easy" },
      { name: "Main set", detail: main },
      { name: "Cool-down", detail: "5 to 10 min walk" },
    ];
  return [
    { name: "Warm-up", detail: "5 min walk, then 5 min easy jog" },
    { name: "Main set", detail: main },
    { name: "Cool-down", detail: "5 min walk" },
  ];
}

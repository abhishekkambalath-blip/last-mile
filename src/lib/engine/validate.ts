import { CONFIG, type LevelId } from "./config";
import { diffDays, weekdayOf } from "./dates";
import type { EnginePlan, PlanDay, PlanWeek } from "./types";

const EPS = 0.15; // km of slack for rounding to one decimal place
const isRun = (d: PlanDay) => d.type !== "rest" && d.type !== "cross";
const isHard = (d: PlanDay) => d.type === "tempo" || d.type === "intervals";

/** The largest volume a week may have, given the last normal week: +10%, or +2 km when the volume is small. */
export function allowedWeekly(prev: number): number {
  const rise = prev * (1 + CONFIG.maxWeeklyRise);
  return prev < CONFIG.smallVolumeKm ? Math.max(rise, prev + CONFIG.smallVolumeRiseKm) : rise;
}

export const longShareCap = (volume: number) => (volume < CONFIG.smallVolumeKm ? CONFIG.longRunMaxShareSmall : CONFIG.longRunMaxShare);

const isNormal = (w: PlanWeek) => w.phase !== "taper" && w.phase !== "race" && !w.is_cutback;
/** The volume of a week for the volume rules: a partial first week counts as the full week it stands for. */
const volumeOf = (w: PlanWeek) => (w.is_partial ? Math.max(w.target_km, w.planned_km) : w.planned_km);

/** Which weeks (by week number) must be cut-back weeks: every Nth week, not week 1, not the last normal week. */
export function scheduledCutbacks(normalWeeks: number, level: LevelId, weekOffset = 0): Set<number> {
  const cycle = CONFIG.cutbackEvery[level];
  const out = new Set<number>();
  for (let w = 2; w < normalWeeks; w++) if ((w + weekOffset) % cycle === 0) out.add(w);
  return out;
}

/** Checks every hard rule. Returns a list of plain-language problems; an empty list means the plan is valid. */
export function validatePlan(plan: EnginePlan): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(m);
  const { meta, weeks } = plan;
  const level = meta.level;
  const off = meta.week_offset;
  if (weeks.length === 0) return ["The plan has no weeks."];

  // ---- Shape: contiguous days, Monday weeks, race last ----
  const all: { d: PlanDay; w: PlanWeek }[] = [];
  weeks.forEach((w, i) => {
    if (w.week_number !== i + 1) err(`Week numbers must run 1, 2, 3 ... (week ${w.week_number} is at position ${i + 1}).`);
    if (weekdayOf(w.start_date) !== 0) err(`Week ${w.week_number} does not start on a Monday.`);
    w.days.forEach((d) => all.push({ d, w }));
    w.days.forEach((d, j) => {
      if (j > 0 && diffDays(w.days[j - 1].date, d.date) !== 1) err(`Week ${w.week_number} has a gap before ${d.date}.`);
      if (diffDays(w.start_date, d.date) < 0 || diffDays(w.start_date, d.date) > 6) err(`${d.date} is outside week ${w.week_number}.`);
    });
    if (w.days.length < 7 && !(i === 0 || i === weeks.length - 1)) err(`Week ${w.week_number} is partial but is not the first or the last week.`);
  });
  const last = all[all.length - 1];
  if (last.d.type !== "race" || last.d.date !== meta.race_date) err(`The last day of the plan must be the race on ${meta.race_date}.`);
  if (all.filter((x) => x.d.type === "race").length !== 1) err("The plan must hold exactly one race day.");
  if (weeks[0].days[0] && weeks[0].days[0].date !== meta.today) err(`The plan must start on today (${meta.today}).`);
  const expectedWeeks = Math.floor(diffDays(weeks[0].start_date, meta.race_date) / 7) + 1;
  if (weeks.length !== expectedWeeks || meta.weeks_to_race !== expectedWeeks) err(`The plan must cover exactly the ${expectedWeeks} weeks to the race (it has ${weeks.length}).`);
  if (weeks[weeks.length - 1].phase !== "race") err("The last week must be the race week.");
  if (last.d.distance_km !== null && Math.abs(last.d.distance_km - meta.race_km) > 0.05) err("The race day distance must be the race distance.");

  // ---- Volume ----
  const peak = CONFIG.peakWeeklyKm[meta.race_distance][level];
  const peakLong = CONFIG.peakLongRunKm[meta.race_distance][level];
  let lastNormalVol = meta.baseline_km;
  let lastNormalLong = 0;
  let prevWeek: PlanWeek | null = null;
  const cut = scheduledCutbacks(weeks.filter((w) => w.phase !== "taper" && w.phase !== "race").length, level, off);
  for (const w of weeks) {
    const vol = volumeOf(w);
    const sum = w.days.reduce((s, d) => s + (d.distance_km ?? 0), 0);
    if (Math.abs(sum - w.planned_km) > EPS) err(`Week ${w.week_number}: planned_km (${w.planned_km}) does not match its days (${sum.toFixed(1)}).`);
    const race = w.days.find((d) => d.type === "race");
    if (Math.abs(w.training_km - (w.planned_km - (race?.distance_km ?? 0))) > EPS) err(`Week ${w.week_number}: training_km is wrong.`);
    if (w.phase !== "race" && w.phase !== "taper" && w.target_km > peak + EPS) err(`Week ${w.week_number}: volume ${w.target_km} km is above the peak of ${peak} km.`);
    if (w.phase !== "race" && vol > peak + EPS) err(`Week ${w.week_number}: volume ${vol.toFixed(1)} km is above the peak of ${peak} km.`);

    const runs = w.days.filter(isRun);
    const longDays = runs.filter((d) => d.type === "long");
    if (longDays.length > 1) err(`Week ${w.week_number} has more than one long run.`);
    const longKm = longDays[0]?.distance_km ?? 0;

    if (w.phase === "race") {
      // race week: training volume must be lower than the week before
    } else if (w.phase === "taper") {
      if (vol > lastNormalVol + EPS) err(`Week ${w.week_number}: a taper week must be below the last normal week.`);
    } else if (w.is_cutback) {
      if (!cut.has(w.week_number)) err(`Week ${w.week_number} is a cut-back week but it is not a scheduled one.`);
      const drop = 1 - vol / lastNormalVol;
      if (drop < CONFIG.cutbackMinDrop - 0.03 || drop > CONFIG.cutbackMaxDrop + 0.03) err(`Week ${w.week_number}: a cut-back week must be 20-25% lower (it is ${(drop * 100).toFixed(0)}% lower).`);
    } else {
      if (cut.has(w.week_number)) err(`Week ${w.week_number} should be a cut-back week (every ${CONFIG.cutbackEvery[level]}th week).`);
      const afterCut = prevWeek?.is_cutback ?? false;
      const limit = afterCut ? lastNormalVol : allowedWeekly(lastNormalVol);
      if (vol > limit + EPS) err(`Week ${w.week_number}: volume ${vol.toFixed(1)} km is above the allowed ${limit.toFixed(1)} km${afterCut ? " (the week after a cut-back returns to at most the volume before it)" : ""}.`);
      lastNormalVol = vol;
    }

    // long run
    if (w.phase !== "race" && longKm > 0) {
      if (longKm > longShareCap(vol) * vol + EPS) err(`Week ${w.week_number}: the long run (${longKm} km) is more than ${longShareCap(vol) * 100}% of the week (${vol.toFixed(1)} km).`);
      if (longKm > peakLong + EPS) err(`Week ${w.week_number}: the long run (${longKm} km) is above the peak long run of ${peakLong} km.`);
      const rise = meta.race_distance === "42K" ? CONFIG.longRunRiseKm42K : CONFIG.longRunRiseKm;
      if (w.phase !== "taper" && !w.is_cutback) {
        if (lastNormalLong > 0 && longKm > lastNormalLong + rise + EPS) err(`Week ${w.week_number}: the long run grows by more than ${rise} km.`);
        lastNormalLong = longKm;
      }
    }

    // hard sessions
    const hard = runs.filter(isHard).length;
    if (hard > CONFIG.maxHardPerWeek[level]) err(`Week ${w.week_number}: ${hard} hard sessions (the limit for ${level} is ${CONFIG.maxHardPerWeek[level]}).`);
    if (level === "L1" && w.week_number + off <= CONFIG.l1NoHardUntilWeek && hard > 0) err(`Week ${w.week_number}: L1 has no hard sessions in the first ${CONFIG.l1NoHardUntilWeek} weeks.`);
    if (level === "L1" && w.phase === "taper" && hard > 0) err(`Week ${w.week_number}: no hard sessions for L1 in the taper.`);

    // rest days (full weeks only)
    if (w.days.length === 7) {
      const rest = w.days.filter((d) => !isRun(d) && d.type !== "race").length;
      if (rest < CONFIG.minRestDays[level]) err(`Week ${w.week_number}: only ${rest} rest days (${level} needs ${CONFIG.minRestDays[level]}).`);
    }
    prevWeek = w;
  }

  // ---- Taper: training volume falls week by week, up to race week ----
  const taperChain = weeks.filter((w) => w.phase === "taper" || w.phase === "race");
  let before = Math.max(...weeks.filter(isNormal).map(volumeOf), 0);
  const lastNormalWeek = [...weeks].reverse().find((w) => w.phase !== "taper" && w.phase !== "race");
  if (lastNormalWeek) before = volumeOf(lastNormalWeek);
  else before = meta.baseline_km;
  for (const w of taperChain) {
    const v = w.phase === "race" ? w.training_km : volumeOf(w);
    if (!(v < before - 1e-9) && before > 0) err(`Week ${w.week_number}: the taper must lower the volume every week (${v.toFixed(1)} km after ${before.toFixed(1)} km).`);
    before = v;
  }
  const taperWeeks = weeks.filter((w) => w.phase === "taper" || w.phase === "race");
  if (taperWeeks.length === 0) err("The plan has no taper.");
  // inside the taper window each day is no longer than the longest run before it
  const window = CONFIG.taperDays[meta.race_distance];
  const lastDay = all[all.length - 1].d.date;
  const longestBefore = Math.max(0, ...all.filter((x) => diffDays(x.d.date, lastDay) > window && x.d.type !== "race").map((x) => x.d.distance_km ?? 0));
  for (const x of all) {
    const n = diffDays(x.d.date, lastDay);
    if (n > 0 && n <= window && (x.d.distance_km ?? 0) > Math.max(longestBefore, peakLong) + EPS) err(`${x.d.date}: a run in the taper is longer than any run before it.`);
  }

  // ---- Hard sessions never on consecutive days; at least 80% of runs are easy ----
  for (let i = 1; i < all.length; i++) {
    if (isHard(all[i].d) && isHard(all[i - 1].d) && diffDays(all[i - 1].d.date, all[i].d.date) === 1) err(`Hard sessions on consecutive days (${all[i - 1].d.date}, ${all[i].d.date}).`);
  }
  const trainingRuns = all.filter((x) => isRun(x.d) && x.d.type !== "race");
  const hardRuns = trainingRuns.filter((x) => isHard(x.d)).length;
  if (trainingRuns.length > 0 && 1 - hardRuns / trainingRuns.length < CONFIG.minEasyShare - 1e-9) err(`Only ${Math.round((1 - hardRuns / trainingRuns.length) * 100)}% of runs are easy (at least ${CONFIG.minEasyShare * 100}% needed).`);

  // ---- Warnings that must be there ----
  const minWeeks = CONFIG.minWeeks[meta.race_distance][level];
  if (meta.weeks_to_race < minWeeks && plan.warnings.length === 0) err(`The plan is shorter than the ${minWeeks} weeks ${level} needs for a ${meta.race_distance}, so it must carry a warning.`);
  if (meta.weeks_to_race < minWeeks && !meta.compressed) err("A short plan must be marked as compressed.");

  // ---- No claim of injury prevention ----
  const text = JSON.stringify(plan).toLowerCase();
  if (/prevent(s|ing)? (all )?injur/.test(text) || /injury[- ]proof|guarantee/.test(text)) err("The plan must not claim to prevent injury.");

  return errors;
}

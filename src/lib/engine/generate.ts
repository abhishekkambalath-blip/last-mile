import { CONFIG, RACE_KM, type Distance, type LevelId } from "./config";
import { addDays, diffDays, mondayOf, weekdayOf } from "./dates";
import { templateReason } from "./explain";
import { categoryFor, checkInput, levelFor } from "./level";
import { fmtPace, minutesFor, paceRange, targetPace } from "./pace";
import type { DayType, EngineInput, EnginePlan, Phase, PlanDay, PlanWeek, RunWalk } from "./types";
import { allowedWeekly, longShareCap, scheduledCutbacks } from "./validate";

const round1 = (n: number) => Math.round(n * 10) / 10;
const floor1 = (n: number) => Math.floor(n * 10 + 1e-9) / 10;

// Which weekdays (0 = Monday) a runner trains on, by number of runs. The last day is the long run.
const PATTERNS: Record<number, { days: number[]; hard: number[] }> = {
  2: { days: [2, 6], hard: [] },
  3: { days: [1, 3, 6], hard: [1, 3] },
  4: { days: [0, 2, 4, 6], hard: [2, 0, 4] },
  5: { days: [0, 1, 3, 4, 6], hard: [1, 3] },
  6: { days: [0, 1, 2, 4, 5, 6], hard: [1, 4] },
};

const stepUp = (v: number) => (v < CONFIG.smallVolumeKm ? v + CONFIG.planSmallRiseKm : v * (1 + CONFIG.planRise));
const stepDown = (v: number) => (v <= CONFIG.smallVolumeKm ? v - CONFIG.planSmallRiseKm : v / (1 + CONFIG.planRise));

type WeekPlan = {
  phase: Phase;
  cutback: boolean;
  target: number; // the volume this week stands for (km)
  longKm: number; // 0 for none
};

/** The weekly volumes of the normal weeks (before the taper): climb from the baseline, hold steady when there is time to spare. */
function volumePath(n: number, baseline: number, peak: number, level: LevelId, offset: number) {
  const cut = scheduledCutbacks(n, level, offset); // by week number 1..n
  const chain: number[] = []; // week numbers that are not cut-back weeks
  for (let w = 1; w <= n; w++) if (!cut.has(w)) chain.push(w);
  const vol = new Map<number, number>();
  if (n === 0) return { vol, cut, peakEff: baseline };

  // The highest volume that can be reached from the baseline, at the plan's own (gentler) rate.
  let f = baseline;
  for (let k = 1; k < chain.length; k++) f = chain[k] === chain[k - 1] + 2 ? f : stepUp(f);
  const peakEff = Math.min(peak, f);

  // Work backwards from the peak, so a plan with extra weeks stays at the baseline until it is time to climb.
  let v = peakEff;
  for (let k = chain.length - 1; k >= 0; k--) {
    vol.set(chain[k], Math.max(baseline, v));
    v = k > 0 && chain[k] === chain[k - 1] + 2 ? v : stepDown(v);
  }
  for (const w of cut) {
    const prev = [...chain].reverse().find((c) => c < w);
    vol.set(w, (vol.get(prev ?? 1) ?? baseline) * CONFIG.cutbackFactor);
  }
  return { vol, cut, peakEff };
}

export function generatePlan(raw: EngineInput): EnginePlan {
  const input = raw;
  checkInput(input);
  const dist: Distance = input.raceDistance;
  const raceKm = input.raceKm ?? RACE_KM[dist];
  const level: LevelId = input.levelOverride ?? levelFor(input.weeklyKm, input.longestRunKm);
  const off = input.weekOffset ?? 0;
  const warnings: string[] = [];

  // ---- The calendar: Monday-to-Sunday weeks from this week to race week ----
  const firstMonday = mondayOf(input.today);
  const N = Math.floor(diffDays(firstMonday, input.raceDate) / 7) + 1;
  const raceIdx = weekdayOf(input.raceDate); // days of race week before the race
  const taperWeeks = Math.min(N - 1, Math.max(0, Math.ceil((CONFIG.taperDays[dist] - raceIdx) / 7)));
  const normalCount = N - 1 - taperWeeks;
  const minWeeks = CONFIG.minWeeks[dist][level];
  const compressed = N < minWeeks;

  // ---- Where the plan starts ----
  const peak = CONFIG.peakWeeklyKm[dist][level];
  const peakLong = CONFIG.peakLongRunKm[dist][level];
  let baseline = input.weeklyKm;
  if (baseline < CONFIG.minBaselineKm) {
    baseline = CONFIG.minBaselineKm;
    warnings.push(`You run very little at the moment, so the plan starts from ${CONFIG.minBaselineKm} km a week with run/walk intervals.`);
  }
  if (baseline > peak) baseline = peak;

  const { vol, cut, peakEff } = volumePath(normalCount, baseline, peak, level, off);
  const lastNormalVol = normalCount > 0 ? [...vol.entries()].filter(([w]) => !cut.has(w)).sort((a, b) => b[0] - a[0])[0][1] : baseline;

  // ---- Phases ----
  const normalPhases: Phase[] = [];
  if (normalCount > 0) {
    const climbs = [...vol.entries()].filter(([w]) => !cut.has(w) && vol.get(w)! > baseline + 0.05).map(([w]) => w);
    const rampStart = climbs.length ? Math.min(...climbs) : normalCount + 1; // first week above the baseline
    const rampLen = normalCount - rampStart + 1;
    const peakLen = normalCount === 1 ? 1 : Math.max(1, Math.round(normalCount * 0.2));
    const baseLen = rampStart > 1 ? rampStart - 1 + (rampLen >= 5 ? Math.round(rampLen * 0.2) : 0) : normalCount >= 3 ? Math.round(normalCount * 0.3) : 0;
    for (let w = 1; w <= normalCount; w++) normalPhases.push(w > normalCount - peakLen ? "peak" : w <= baseLen ? "base" : "build");
  }

  const weeksPlan: WeekPlan[] = [];
  let lastLong = input.longestRunKm;
  const rise = dist === "42K" ? CONFIG.longRunRiseKm42K : CONFIG.longRunRiseKm;
  for (let w = 1; w <= N; w++) {
    let phase: Phase;
    let target: number;
    let cutback = false;
    let longKm = 0;
    if (w <= normalCount) {
      phase = normalPhases[w - 1];
      cutback = cut.has(w);
      target = round1(vol.get(w)!);
      const cap = longShareCap(target) * target;
      if (cutback) longKm = floor1(Math.min(cap, lastLong));
      else {
        longKm = floor1(Math.min(cap, peakLong, lastLong + rise));
        lastLong = longKm;
      }
    } else if (w < N) {
      phase = "taper";
      const idx = w - normalCount - 1;
      const share = (taperWeeks === 1 ? CONFIG.taperShare.one : CONFIG.taperShare.two)[idx] ?? CONFIG.taperShare.two[1];
      target = round1(lastNormalVol * share);
      longKm = floor1(Math.min(longShareCap(target) * target, lastLong * 0.7));
    } else {
      phase = "race";
      target = round1(lastNormalVol * CONFIG.raceWeekShare);
    }
    weeksPlan.push({ phase, cutback, target, longKm });
  }

  // ---- Days ----
  const runsWanted = Math.min(input.daysPerWeek, CONFIG.maxRunDays[level]);
  const target = targetPace(input, raceKm);
  if (target.warning) warnings.push(target.warning);
  const pace = input.hotWeather ? null : target.secPerKm;
  const rpe = CONFIG.rpe;

  type Draft = { date: string; weekday: number; type: DayType; km: number };
  type Layout = { days: Draft[]; runDays: number[]; longDay: number | null; trainKm: number; isRace: boolean; hardDay: number | null };
  const hardKm = (kind: "tempo" | "intervals", wi: number, v: number) => {
    const mins = (CONFIG.hardMinutes[kind] + Math.min(12, wi)) * (input.hotWeather ? CONFIG.hotWeatherHardFactor : 1);
    return round1(Math.min(v * 0.3, 2.5 + (mins * 60) / (pace ? pace + 15 : 340)));
  };

  // Pass 1: which days each week holds, and which of them are runs.
  const layouts: Layout[] = weeksPlan.map((wp, i) => {
    const start = addDays(firstMonday, i * 7);
    const isRace = wp.phase === "race";
    const days: Draft[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, d);
      if (date < input.today) continue;
      if (date > input.raceDate) break;
      days.push({ date, weekday: d, type: "rest", km: 0 });
    }
    let runDays: number[];
    let longDay: number | null = null;
    let trainKm = wp.target;
    if (isRace) {
      // Race week: a few easy runs early in the week, then rest the day before the race.
      const free = [0, 1, 2, 3, 4, 5, 6].filter((d) => d <= raceIdx - 2);
      runDays = PATTERNS[Math.max(2, Math.min(6, runsWanted))].days.filter((d) => free.includes(d));
      runDays = runDays.slice(0, Math.min(runDays.length, Math.max(1, runsWanted - 2)));
      // No race-week run is longer than half the long run: the legs should be fresh, not tired.
      trainKm = Math.min(wp.target, runDays.length * Math.max(1.5, floor1(lastLong * 0.5)));
    } else {
      let r = Math.max(2, Math.min(6, runsWanted));
      // Enough runs that no run is longer than the long run, and none is shorter than ~1.5 km.
      while (r < 6 && wp.longKm > 0 && trainKm > wp.longKm * r) r++;
      while (r > 2 && (trainKm - wp.longKm) / (r - 1) < 1.5) r--;
      runDays = PATTERNS[r].days;
      longDay = wp.longKm > 0 ? runDays[runDays.length - 1] : null;
    }
    return { days, runDays, longDay, trainKm, isRace, hardDay: null };
  });

  // Pass 2: hard sessions. Build and peak weeks only, within the 80%-easy budget, never on consecutive days.
  const trainingRuns = layouts.reduce((n, l) => n + l.days.filter((d) => l.runDays.includes(d.weekday) && d.date < input.raceDate).length, 0);
  let budget = Math.floor(trainingRuns * (1 - CONFIG.minEasyShare) + 1e-9);
  const hardDates: string[] = [];
  const hardKind = new Map<number, "tempo" | "intervals">();
  const apart = (date: string) => hardDates.every((h) => Math.abs(diffDays(h, date)) > 1);
  const present = (l: Layout, wd: number) => l.days.find((d) => d.weekday === wd && d.date < input.raceDate);

  // Race week: a few short sharp efforts are kept (not for L1).
  if (level !== "L1" && budget > 0) {
    const l = layouts[N - 1];
    const wd = l.runDays.find((d) => d >= 1 && d <= raceIdx - 3 && present(l, d));
    if (wd !== undefined && l.runDays.length >= 2) {
      l.hardDay = wd;
      hardKind.set(N - 1, "intervals");
      hardDates.push(present(l, wd)!.date);
      budget--;
    }
  }
  const slots: { wi: number; slot: number }[] = [];
  weeksPlan.forEach((wp, wi) => {
    if (wp.cutback || (wp.phase !== "build" && wp.phase !== "peak")) return;
    if (level === "L1" && wi + 1 + off <= CONFIG.l1NoHardUntilWeek) return;
    if (wp.target < 12) return;
    for (let slot = 0; slot < CONFIG.maxHardPerWeek[level]; slot++) if (slot === 0 || wp.phase === "peak") slots.push({ wi, slot });
  });
  // Later weeks first: if the budget is short, the earliest slots are the ones dropped.
  slots.sort((a, b) => b.wi - a.wi || a.slot - b.slot);
  const chosen = slots.slice(0, Math.max(0, budget)).sort((a, b) => a.wi - b.wi || a.slot - b.slot);
  let flip = 0;
  const extraHard = new Map<number, number[]>();
  for (const e of chosen) {
    const l = layouts[e.wi];
    const others = l.runDays.filter((d) => d !== l.longDay);
    const taken = (l.hardDay !== null ? 1 : 0) + (extraHard.get(e.wi)?.length ?? 0);
    if (taken >= others.length - 1) continue; // keep at least one easy run next to the long run
    const order = [...PATTERNS[Math.min(6, Math.max(2, l.runDays.length))].hard, ...others];
    const wd = order.find((d) => others.includes(d) && present(l, d) && l.hardDay !== d && !(extraHard.get(e.wi) ?? []).includes(d) && apart(present(l, d)!.date));
    if (wd === undefined) continue;
    if (l.hardDay === null) l.hardDay = wd;
    else extraHard.set(e.wi, [...(extraHard.get(e.wi) ?? []), wd]);
    hardDates.push(present(l, wd)!.date);
    hardKind.set(e.wi * 10 + e.slot, (flip++ % 2 === 0 ? "tempo" : "intervals") as "tempo" | "intervals");
  }

  // Pass 3: spread each week's km over its runs.
  const weekDrafts: Draft[][] = [];
  layouts.forEach((l, wi) => {
    const wp = weeksPlan[wi];
    const hardDays = [l.hardDay, ...(extraHard.get(wi) ?? [])].filter((d): d is number => d !== null);
    const longKm = l.longDay !== null ? wp.longKm : 0;
    const others = l.runDays.filter((d) => d !== l.longDay);
    const dist1: Record<number, number> = {};
    const types: Record<number, DayType> = {};
    let left = Math.max(0, l.trainKm - longKm);
    hardDays.forEach((d, k) => {
      const kind = l.isRace ? "intervals" : (hardKind.get(wi * 10 + k) ?? "tempo");
      types[d] = kind;
      dist1[d] = l.isRace ? Math.min(3.5, left) : hardKm(kind, wi, wp.target);
      left -= dist1[d];
    });
    const easy = others.filter((d) => !hardDays.includes(d));
    // Keep easy runs well under the long run: let the hard sessions take more of the week, up to 30% each.
    if (easy.length && hardDays.length && longKm > 0 && left / easy.length > longKm * 0.8) {
      const extra = (left - easy.length * longKm * 0.8) / hardDays.length;
      hardDays.forEach((d) => {
        const add = Math.min(extra, wp.target * 0.3 - dist1[d]);
        if (add > 0) {
          dist1[d] = round1(dist1[d] + add);
          left -= round1(add);
        }
      });
    }
    const share = easy.length ? floor1(Math.max(0, left) / easy.length) : 0;
    easy.forEach((d) => {
      dist1[d] = share;
      types[d] = "easy";
    });
    if (easy.length) dist1[easy[0]] = round1(dist1[easy[0]] + (Math.max(0, left) - share * easy.length));
    if (l.longDay !== null) {
      dist1[l.longDay] = longKm;
      types[l.longDay] = "long";
    }
    for (const dr of l.days) {
      if (dr.date < input.raceDate && dr.weekday in dist1) {
        dr.type = types[dr.weekday];
        dr.km = dist1[dr.weekday];
      }
    }
    if (l.isRace) {
      const last = l.days[l.days.length - 1];
      last.type = "race";
      last.km = raceKm;
    }
    weekDrafts.push(l.days);
  });

  // ---- Build the output ----
  const weeks: PlanWeek[] = weeksPlan.map((wp, i) => {
    const start = addDays(firstMonday, i * 7);
    const days: PlanDay[] = weekDrafts[i].map((dr) => {
      const isRun = dr.type !== "rest";
      const kind = dr.type === "rest" ? "easy" : (dr.type as "easy" | "long" | "tempo" | "intervals" | "race" | "recovery");
      let runWalk: RunWalk | null = null;
      let minutes: number | null = null;
      if (isRun) minutes = minutesFor(dr.km, kind, dist, pace);
      if (isRun && level === "L1" && i + 1 + off < CONFIG.continuousFromWeek && (dr.type === "easy" || dr.type === "long")) {
        const runMin = CONFIG.jogMin[Math.min(i + off, CONFIG.jogMin.length - 1)];
        const walkMin = runMin >= 4 ? 1 : 2;
        minutes = Math.round(minutes! * 1.15);
        runWalk = { runMin, walkMin, reps: Math.max(2, Math.round(minutes / (runMin + walkMin))) };
      }
      const rpeValue = dr.type === "rest" ? null : dr.type === "long" ? rpe.long : dr.type === "easy" && wp.cutback ? rpe.recovery + 1 : rpe[dr.type as keyof typeof rpe] ?? rpe.easy;
      return {
        date: dr.date,
        type: dr.type,
        distance_km: isRun ? dr.km : null,
        duration_min: minutes,
        effort_rpe: rpeValue,
        pace_range_min_per_km: isRun ? paceRange(kind === "recovery" ? "easy" : kind, dist, pace) : null,
        run_walk_pattern: runWalk,
        ...(input.hotWeather && isRun
          ? { effort_note: "Hot weather: go by effort or heart rate, not pace. Easy means you can talk in full sentences. Run early or late and carry water." }
          : {}),
        reason: templateReason(dr.type, { phase: wp.phase, level, raceLabel: input.raceKm !== undefined ? `${input.raceKm} km` : dist, cutback: wp.cutback }),
      };
    });
    const planned = round1(days.reduce((s, d) => s + (d.distance_km ?? 0), 0));
    const race = days.find((d) => d.type === "race");
    return {
      week_number: i + 1,
      start_date: start,
      phase: wp.phase,
      planned_km: planned,
      target_km: wp.target,
      training_km: round1(planned - (race?.distance_km ?? 0)),
      is_cutback: wp.cutback,
      is_partial: days.length < 7,
      days,
    };
  });

  // ---- Warnings ----
  const peakReached = Math.max(...weeks.filter((w) => w.phase !== "race").map((w) => (w.is_partial ? Math.max(w.target_km, w.planned_km) : w.planned_km)), 0);
  if (compressed) {
    warnings.push(
      `Your race is ${N} week${N === 1 ? "" : "s"} away. A ${input.raceKm !== undefined ? `${input.raceKm} km` : dist} plan at your level normally needs ${minWeeks} weeks. This plan is compressed: it keeps every safety rule and the taper, so your biggest week is ${round1(peakReached)} km, not ${peak} km. Consider a later race date or a shorter distance.`,
    );
    if (dist === "42K" && level === "L1") warnings.push("A first marathon needs the full 20 weeks. With fewer weeks, please think hard about a later date or a shorter race.");
  }
  const longestPlanned = Math.max(...weeks.flatMap((w) => w.days.filter((d) => d.type === "long").map((d) => d.distance_km ?? 0)), 0);
  if ((dist === "21K" || dist === "42K") && longestPlanned < peakLong * 0.75) {
    warnings.push(`Your longest run in this plan is ${round1(longestPlanned)} km. That is shorter than usual for a ${dist === "42K" ? "marathon" : "half marathon"} because a long run may not be more than 35% of a week's distance. A coach should look at this before you rely on it.`);
  }
  else if (longestPlanned < raceKm * 0.6) {
    warnings.push(`Your longest run in this plan is ${round1(longestPlanned)} km, shorter than the ${round1(raceKm)} km race. Starting from ${round1(baseline)} km a week, this is as far as a safe build goes in the time you have. You can still run/walk the race, or pick a later date or a shorter distance.`);
  }
  if (baseline < input.weeklyKm && input.weeklyKm > peak) warnings.push(`You already run more than this plan's peak of ${peak} km a week, so it holds your volume at ${peak} km.`);

  const plan: EnginePlan = {
    meta: {
      race_distance: dist,
      race_km: raceKm,
      race_date: input.raceDate,
      today: input.today,
      level,
      weeks_to_race: N,
      config_version: CONFIG.version,
      baseline_km: round1(baseline),
      peak_km: round1(peakReached),
      compressed,
      days_per_week: input.daysPerWeek,
      hot_weather: Boolean(input.hotWeather),
      week_offset: off,
      target_pace_sec_per_km: target.secPerKm,
    },
    weeks,
    warnings,
    adaptation_log: [],
  };
  void allowedWeekly;
  void categoryFor;
  void fmtPace;
  void peakEff;
  return plan;
}

import { CONFIG, RACE_KM, type Distance } from "./config";
import type { EngineInput } from "./types";

export const fmtPace = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
export const parsePace = (p: string) => {
  const [m, s] = p.split(":").map(Number);
  return m * 60 + s;
};

/** Riegel: T2 = T1 x (D2 / D1) ^ 1.06. Returns seconds. */
export const riegel = (t1: number, d1: number, d2: number) => t1 * Math.pow(d2 / d1, CONFIG.riegelExponent);

export type PaceTarget = { secPerKm: number | null; warning?: string };

/** The race pace the plan is built around, or null when there is no pace data (then only effort is shown). */
export function targetPace(input: EngineInput, raceKm: number): PaceTarget {
  const predicted = input.recentRace ? riegel(input.recentRace.timeSec, input.recentRace.distanceKm, raceKm) / raceKm : null;
  const goal = input.goalPaceSecPerKm ?? null;
  if (predicted && goal && goal < predicted * (1 - CONFIG.goalTooFastTolerance)) {
    return { secPerKm: predicted, warning: `Your goal pace (${fmtPace(goal)}/km) is more than 5% faster than your recent race predicts (${fmtPace(predicted)}/km), so the plan uses ${fmtPace(predicted)}/km.` };
  }
  return { secPerKm: goal ?? predicted };
}

type Kind = "easy" | "long" | "recovery" | "tempo" | "intervals" | "race";

/** The pace range of a session as ["m:ss", "m:ss"], or null when there is no pace data. */
export function paceRange(kind: Kind, race: Distance, target: number | null): [string, string] | null {
  if (target === null) return null;
  const [lo, hi] =
    kind === "race"
      ? [-5, 5]
      : kind === "tempo"
        ? CONFIG.tempoOffsetSec[race]
        : kind === "intervals"
          ? CONFIG.intervalOffsetSec[race]
          : kind === "long"
            ? [CONFIG.easySlowerBySec[0] + 10, CONFIG.easySlowerBySec[1] + 15]
            : CONFIG.easySlowerBySec;
  return [fmtPace(target + lo), fmtPace(target + hi)];
}

/** Rough minutes for a distance, from the middle of the pace range (or 7:00/km when there is no pace data). */
export function minutesFor(km: number, kind: Kind, race: Distance, target: number | null): number {
  const r = paceRange(kind, race, target);
  const sec = r ? (parsePace(r[0]) + parsePace(r[1])) / 2 : kind === "intervals" ? 360 : kind === "tempo" ? 380 : 420;
  return Math.max(5, Math.round((km * sec) / 60));
}

export { RACE_KM };

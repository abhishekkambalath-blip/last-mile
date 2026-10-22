import { DISTANCES, type LevelId } from "@/lib/engine/config";
import { addDays } from "@/lib/engine/dates";
import type { EngineInput } from "@/lib/engine/types";

export { DISTANCES };

export const FITNESS: Record<LevelId, { weeklyKm: number; longestRunKm: number; runsPerWeek: number }> = {
  L1: { weeklyKm: 6, longestRunKm: 3, runsPerWeek: 2 },
  L2: { weeklyKm: 18, longestRunKm: 7, runsPerWeek: 3 },
  L3: { weeklyKm: 40, longestRunKm: 14, runsPerWeek: 5 },
};
// Several start days, so partial first weeks and every race weekday are covered.
export const TODAYS = ["2026-10-22", "2026-10-26", "2026-10-25"];

export function inputFor(distance: (typeof DISTANCES)[number], level: LevelId, weeks: number, days: number, today = TODAYS[0]): EngineInput {
  return { raceDistance: distance, today, raceDate: addDays(today, weeks * 7 - 1 - (weeks % 5)), daysPerWeek: days, ...FITNESS[level] };
}


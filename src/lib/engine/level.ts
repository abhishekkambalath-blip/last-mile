import { CONFIG, type Distance, type LevelId } from "./config";
import type { EngineInput } from "./types";
import { EngineError } from "./types";
import { diffDays, isDate } from "./dates";

/** L1 under 10 km a week or longest run under 5 km. L3 over 25 km a week and longest run at least 10 km. Otherwise L2. */
export function levelFor(weeklyKm: number, longestRunKm: number): LevelId {
  const c = CONFIG.level;
  if (weeklyKm < c.l1.weeklyKmBelow || longestRunKm < c.l1.longestRunKmBelow) return "L1";
  if (weeklyKm > c.l3.weeklyKmAbove && longestRunKm >= c.l3.longestRunKmAtLeast) return "L3";
  return "L2";
}

/** The standard race a custom goal distance is trained as. */
export function categoryFor(km: number): Distance {
  return km <= 7.5 ? "5K" : km <= 15 ? "10K" : km <= 30 ? "21K" : "42K";
}

/** Rejects input the engine cannot plan from, with a message a runner can read. */
export function checkInput(input: Partial<EngineInput>): asserts input is EngineInput {
  if (!input.raceDistance) throw new EngineError("Choose a race distance.");
  if (!isDate(input.today)) throw new EngineError("Today's date is missing.");
  if (!isDate(input.raceDate)) throw new EngineError("Enter your race date.");
  if (diffDays(input.today, input.raceDate) < 1) throw new EngineError("Your race date must be after today.");
  if (diffDays(input.today, input.raceDate) > CONFIG.maxPlanWeeks * 7) throw new EngineError(`Your race is more than ${CONFIG.maxPlanWeeks} weeks away. Pick a date within a year.`);
  const num = (v: unknown, min: number, max: number) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
  if (!num(input.weeklyKm, 0, 250)) throw new EngineError("Enter your average weekly distance over the last 4 weeks (0 to 250 km).");
  if (!num(input.longestRunKm, 0, 100)) throw new EngineError("Enter your longest run in the last 4 weeks (0 to 100 km).");
  if (!num(input.runsPerWeek, 0, 14)) throw new EngineError("Enter how many runs you do in a week.");
  if (!num(input.daysPerWeek, 3, 6)) throw new EngineError("Choose 3 to 6 training days a week.");
  if (input.raceKm !== undefined && !num(input.raceKm, 1, 42.2)) throw new EngineError("A custom race distance must be between 1 and 42.2 km.");
  if (input.recentRace && !(num(input.recentRace.distanceKm, 1, 100) && num(input.recentRace.timeSec, 120, 86400))) throw new EngineError("Check your recent race distance and time.");
  if (input.goalPaceSecPerKm !== undefined && !num(input.goalPaceSecPerKm, 150, 900)) throw new EngineError("Your goal pace must be between 2:30 and 15:00 per km.");
}

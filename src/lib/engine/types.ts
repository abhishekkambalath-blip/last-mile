import type { Distance, LevelId } from "./config";

export type DayType = "rest" | "easy" | "long" | "tempo" | "intervals" | "recovery" | "cross" | "race";
export type Phase = "base" | "build" | "peak" | "taper" | "race";

export type RecentRace = { distanceKm: number; timeSec: number };

export type EngineInput = {
  raceDistance: Distance;
  raceKm?: number; // a custom goal distance between 1 and 42.2 km: it is trained as the nearest standard race
  raceDate: string; // yyyy-mm-dd
  today: string; // yyyy-mm-dd
  weeklyKm: number; // average weekly km over the last 4 weeks
  longestRunKm: number; // longest run in the last 4 weeks
  runsPerWeek: number; // runs per week over the last 4 weeks
  daysPerWeek: number; // days a week the runner can train, 3 to 6
  recentRace?: RecentRace;
  goalPaceSecPerKm?: number;
  painNotes?: string; // free text; the LLM only turns it into structured fields
  hotWeather?: boolean;
  /** Set by adaptation: weeks already done, so week numbers, cut-backs and the L1 no-hard rule carry on. */
  weekOffset?: number;
  /** Set by adaptation: plan from this level instead of working it out. */
  levelOverride?: LevelId;
};

export type RunWalk = { runMin: number; walkMin: number; reps: number };

export type PlanDay = {
  date: string;
  type: DayType;
  distance_km: number | null;
  duration_min: number | null;
  effort_rpe: number | null;
  pace_range_min_per_km: [string, string] | null;
  run_walk_pattern: RunWalk | null;
  effort_note?: string; // effort or heart-rate guidance, used instead of pace (hot weather)
  reason: string; // the only field the LLM writes
};

export type PlanWeek = {
  week_number: number;
  start_date: string; // the Monday of this week
  phase: Phase;
  planned_km: number; // km actually planned in the days that are present, race day included
  target_km: number; // the volume this week stands for: a partial first week still counts as a full week
  training_km: number; // planned_km without the race itself
  is_cutback: boolean;
  is_partial: boolean; // fewer than 7 days (first week, or race week when the race is not on a Sunday)
  days: PlanDay[];
};

export type Meta = {
  race_distance: Distance;
  race_km: number;
  race_date: string;
  today: string;
  level: LevelId;
  weeks_to_race: number;
  config_version: string;
  baseline_km: number; // the weekly volume the plan starts from
  peak_km: number; // the highest weekly volume the plan reaches
  compressed: boolean;
  days_per_week: number;
  hot_weather: boolean;
  week_offset: number;
  target_pace_sec_per_km: number | null;
};

export type AdaptationEntry = { date: string; change: string; reason: string };

export type EnginePlan = {
  meta: Meta;
  weeks: PlanWeek[];
  warnings: string[];
  adaptation_log: AdaptationEntry[];
};

export class EngineError extends Error {}

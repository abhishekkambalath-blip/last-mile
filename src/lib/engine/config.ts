// Every number the plan engine uses lives in this one file, so a coach can tune it.
// NOT medical advice. A coach or physio must review every value here before real runners get plans.

export type Distance = "5K" | "10K" | "21K" | "42K";
export type LevelId = "L1" | "L2" | "L3";

export const DISTANCES: Distance[] = ["5K", "10K", "21K", "42K"];
export const LEVELS: LevelId[] = ["L1", "L2", "L3"];
export const RACE_KM: Record<Distance, number> = { "5K": 5, "10K": 10, "21K": 21.1, "42K": 42.2 };

const byLevel = (l1: number, l2: number, l3: number): Record<LevelId, number> => ({ L1: l1, L2: l2, L3: l3 });

export const CONFIG = {
  version: "2026-10-22.1",

  // ---- Fitness levels, from the runner's last 4 weeks ----
  level: {
    l1: { weeklyKmBelow: 10, longestRunKmBelow: 5 }, // L1 if under 10 km a week OR longest run under 5 km
    l3: { weeklyKmAbove: 25, longestRunKmAtLeast: 10 }, // L3 if over 25 km a week AND longest run at least 10 km
    // everything else is L2
  },
  // A runner who reports almost no running is planned from this weekly volume (and told so).
  minBaselineKm: 4,

  // ---- Plan size ----
  maxPlanWeeks: 52,
  minWeeks: {
    "5K": byLevel(8, 6, 6),
    "10K": byLevel(10, 8, 8),
    "21K": byLevel(14, 12, 10),
    "42K": byLevel(20, 18, 16),
  } as Record<Distance, Record<LevelId, number>>,
  peakWeeklyKm: {
    "5K": byLevel(18, 28, 38),
    "10K": byLevel(24, 36, 50),
    "21K": byLevel(30, 45, 60),
    "42K": byLevel(45, 60, 75),
  } as Record<Distance, Record<LevelId, number>>,
  peakLongRunKm: {
    "5K": byLevel(8, 10, 12),
    "10K": byLevel(12, 14, 16),
    "21K": byLevel(16, 18, 20),
    "42K": byLevel(28, 32, 32),
  } as Record<Distance, Record<LevelId, number>>,
  taperDays: { "5K": 4, "10K": 7, "21K": 10, "42K": 14 } as Record<Distance, number>,

  // ---- Volume rules ----
  maxWeeklyRise: 0.1, // a week may be at most 10% above the last normal week ...
  smallVolumeKm: 20, // ... except under this volume, where a rise of up to smallVolumeRiseKm is allowed
  smallVolumeRiseKm: 2,
  // The plan itself climbs a bit slower than the ceiling, so rounding never breaks the rule.
  planRise: 0.08,
  planSmallRiseKm: 1.5,
  cutbackEvery: { L1: 3, L2: 4, L3: 4 } as Record<LevelId, number>,
  cutbackFactor: 0.775, // a cut-back week is 20 to 25% lower than the last normal week
  cutbackMinDrop: 0.2,
  cutbackMaxDrop: 0.25,
  // Training volume of each taper week and of race week, as a share of the last normal week.
  taperShare: { one: [0.7], two: [0.8, 0.6] } as { one: number[]; two: number[] },
  raceWeekShare: 0.4,

  // ---- Long run ----
  longRunMaxShare: 0.35, // of the week's volume
  longRunMaxShareSmall: 0.4, // when the week is under smallVolumeKm
  longRunRiseKm: 2, // per week, compared with the last normal week
  longRunRiseKm42K: 3,

  // ---- Hard sessions (tempo, intervals) ----
  maxHardPerWeek: byLevel(1, 1, 2),
  l1NoHardUntilWeek: 4, // L1 has no hard session in weeks 1..4
  minEasyShare: 0.8, // across the whole plan, at least this share of runs is easy
  hardMinutes: { tempo: 20, intervals: 18 }, // main set minutes at the start; grows a little each week
  hotWeatherHardFactor: 0.8,

  // ---- Rest ----
  minRestDays: byLevel(2, 1, 1), // in every full week
  maxRunDays: byLevel(5, 6, 6),

  // ---- Run / walk (L1) ----
  // Minutes of jogging per interval, week by week. Walk minutes are in walkMinFor. After the last entry the runner jogs continuously.
  jogMin: [1, 1, 2, 2, 3, 3, 4, 5, 6, 8],
  continuousFromWeek: 10,

  // ---- Effort (RPE, 1-10) ----
  rpe: { easy: 3, recovery: 2, long: 4, tempo: 7, intervals: 8, race: 9 },

  // ---- Pace ----
  riegelExponent: 1.06,
  goalTooFastTolerance: 0.05, // goal pace more than 5% faster than predicted: warn and use the prediction
  easySlowerBySec: [45, 90] as [number, number],
  // Seconds per km from race pace: [from, to]. Tempo is about 10K to half marathon effort, intervals about 5K effort.
  tempoOffsetSec: { "5K": [20, 35], "10K": [10, 25], "21K": [-5, 10], "42K": [-20, -5] } as Record<Distance, [number, number]>,
  intervalOffsetSec: { "5K": [-15, -5], "10K": [-25, -15], "21K": [-40, -30], "42K": [-55, -40] } as Record<Distance, [number, number]>,

  // ---- Adaptation ----
  adapt: {
    progressCompletion: 0.8, // at least this share of planned runs done: progress as planned
    repeatCompletion: 0.5, // between repeatCompletion and progressCompletion: repeat the same volume
    lowCompletionFactor: 0.8, // below repeatCompletion (or 2 missed runs in a row): repeat last week at 80%
    missedInARow: 2,
    layoffRestart: [
      { fromDays: 7, toDays: 14, factor: 0.7 },
      { fromDays: 15, toDays: 28, factor: 0.5 },
    ],
    layoffRederiveDays: 28, // more than this: work out the level from scratch
    illnessResumeFactor: 0.7,
    highRpe: 8, // RPE at or above this on easy runs ...
    highRpeEasyRuns: 2, // ... on this many easy runs in a week ...
    highRpeCut: 0.125, // ... lowers next week by this much (10 to 15%)
    fastEasyBySec: 30, // easy runs this much faster than the target ...
    fastEasyMaxRpe: 4, // ... with RPE at or below this ...
    fastEasyWeeks: 2, // ... for this many weeks: allow the target to improve
    paceImprovePct: 0.02,
    painScore: 4, // pain of 4/10 or more is a flag
    painRestRuns: 3, // the next runs replaced by rest
  },
};

export type Config = typeof CONFIG;

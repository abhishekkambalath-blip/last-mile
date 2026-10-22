import {
  addRaceDay,
  applyRules,
  assemblePlan,
  buildSkeleton,
  categoryFor,
  FREE_WEEKS,
  goalLabel,
  hasInjury,
  levelOf,
  MAX_CUSTOM_KM,
  MIN_CUSTOM_KM,
  normalizePace,
  parseAiChunk,
  phasesFor,
  RACE_KM,
  raceKmOf,
  totalPlanWeeks,
  weeksToRace,
  type Plan,
  type AiWeek,
  type Profile,
  type SkeletonWeek,
} from "@/lib/plan";

const MODEL = process.env.OPENROUTER_MODEL ?? "google/gemini-3.8-flash";

// The plan is written in groups of weeks, a few groups at a time, so a long plan still comes back quickly.
const CHUNK_WEEKS = 4;
const CONCURRENCY = 6;

// What a good plan for each race contains. The AI picks from this, and builds the work up week by week.
const GOAL_GUIDE: Record<Profile["distance"], string> = {
  "5K":
    "5K training is about speed. Key workouts: short reps of 200 to 400 m with strides, 600 to 1000 m intervals around 5K pace, a 15 to 25 minute tempo, hill repeats or a fartlek. The long run reaches about 8 to 12 km and stays easy. Race-specific weeks: 3 to 5 x 1000 m at goal pace or slightly faster.",
  "10K":
    "10K training mixes speed and stamina. Key workouts: 800 to 1200 m reps between 10K and 5K pace, a 20 to 35 minute tempo, cruise intervals such as 3 x 8 minutes, a progression run. The long run reaches about 12 to 16 km. Race-specific weeks: 4 to 6 x 1 km, or 3 x 2 km, at goal pace.",
  "21K":
    "Half marathon training is about stamina at a strong effort. Key workouts: a 25 to 45 minute tempo, cruise intervals such as 3 x 10 minutes, 1 to 2 km reps near 10K pace, and long runs that finish faster or include 4 to 10 km at goal pace. The long run reaches about 18 to 22 km. A medium-long run midweek helps.",
  Marathon:
    "Marathon training is about endurance and fuelling the legs for a long effort. Key workouts: long runs that build to about 30 to 34 km, with the last 8 to 16 km at goal pace in the peak weeks, a 30 to 50 minute tempo, 2 to 3 km reps between 10K and half-marathon pace, and a medium-long run midweek. Every fourth long run steps back.",
};

const goalGuide = (profile: Profile) =>
  profile.raceKm !== undefined ? `The goal is a custom ${profile.raceKm} km race, so train like the nearest standard race. ${GOAL_GUIDE[profile.distance]}` : GOAL_GUIDE[profile.distance];

const SYSTEM = `You are an experienced running coach writing part of a training plan for one runner. The app has already decided the shape of every week (the "weeks" list you are given: distance, long run, run days, hard sessions allowed, phase). Your job is to write the sessions inside that shape, so that the plan is specific to this runner's race. Reply with JSON only, no prose, in this shape:
{"summary": string, "weeks": [{"week": 3, "focus": string, "days": [{"day": "Mon"|"Tue"|"Wed"|"Thu"|"Fri"|"Sat"|"Sun", "type": "walk-run"|"easy"|"long"|"tempo"|"intervals", "distanceKm": number, "effort": string, "note": string}]}]}
Only list run days. Leave rest days out. Include "summary" only if the request says to.

Rules for every week you write:
- Write exactly the weeks you are given, using the same week numbers.
- Use exactly "runDays" run days. The total of distanceKm in the week must be within 5% of "targetKm".
- The long run ("long") is on Saturday or Sunday, and its distanceKm is exactly "longRunKm". It is the longest run of the week. When "longRunKm" is 0 (race week) there is no long run at all.
- "maxQuality" is how many hard sessions ("tempo" or "intervals") the week may have. Use that many when it is above 0, and none when it is 0. Never put a hard session on consecutive days or the day before or after the long run. Prefer Tuesday and Thursday.
- Choose the hard sessions from the "goalGuide" so the plan trains what this race needs. Build them up in small steps week by week (a little more time or one more rep), and vary them: base weeks lean on tempo and steady work, build weeks add intervals, race-specific weeks practise goal pace, taper weeks keep one short sharp session at most. In the peak weeks of a half marathon or marathon, put goal-pace running inside the long run and say so in its note.
- Everything else is "easy". Beginners use "walk-run" for easy days until week 9 (put the jog and walk minutes in the note) and may run continuously from week 10.
- For tempo and intervals, "distanceKm" is the whole session including warm-up and cool-down, and "note" describes ONLY the main set, for example "20 min at tempo pace" or "6 x 800 m at interval pace, 2 min easy jog between". The app adds the warm-up and cool-down. Keep reps and times realistic for the runner's level.
- "effort" is how it should feel in plain words. Never write paces or times per km: the app adds paces. You may say "goal pace" or "tempo pace".
- "note" is one short instruction. Never write more than 20 words.
- "focus" is a headline for the week, at most 8 words, saying what this week is for.
- In recovery weeks, use easy runs only and say so. In taper weeks, cut volume as given and keep things light.
- In race week ("raceWeek" true) write only light easy runs and at most one short sharp session early in the week. Do not write any run on or after the race day ("race.raceDay"), and do not write the race itself: the app adds race day.
- If the runner reports an injury, avoid long intervals, keep hard sessions short, and add a note to stop and rest if the pain returns. Give no medical or treatment advice.
- "summary" (when asked for) is 2 or 3 plain sentences about the whole plan: the race distance and date, the weeks left, how the build-up and phases work, and why it fits this runner.`;

function validate(p: Partial<Profile>): Profile | string {
  const pace = normalizePace(String(p.goalPace ?? ""));
  if (!pace) return "Goal pace must look like 6:30, or just 6 for 6:00 (min per km, between 2:30 and 15:00).";
  if (!p.raceDate || Number.isNaN(Date.parse(p.raceDate))) return "Pick a race date.";
  if (weeksToRace(p.raceDate) < 1) return "Pick a race date in the future.";

  // A goal is either one of the four races, or a custom distance in km (for example 3 or 8).
  let goal: Pick<Profile, "distance" | "raceKm" | "label">;
  if (p.raceKm !== undefined && p.raceKm !== null) {
    const km = Math.round(Number(p.raceKm) * 10) / 10;
    if (!(km >= MIN_CUSTOM_KM && km <= MAX_CUSTOM_KM)) return `Goal distance must be between ${MIN_CUSTOM_KM} and ${MAX_CUSTOM_KM} km.`;
    goal = { distance: categoryFor(km), raceKm: km, label: `${km} km` };
  } else if (Object.keys(RACE_KM).includes(p.distance ?? "")) {
    goal = { distance: p.distance as Profile["distance"] };
  } else return "Pick your goal.";

  return {
    ...goal,
    goalPace: pace,
    raceDate: p.raceDate,
    level: ["Beginner", "Intermediate", "Advanced"].includes(p.level ?? "") ? (p.level as Profile["level"]) : "",
    injury: String(p.injury ?? "").slice(0, 1000),
  };
}

const raceDayName = (raceDate: string) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][(new Date(`${raceDate}T00:00:00`).getDay() + 6) % 7];

/** Asks the AI to write the sessions for one group of weeks. Returns null if it fails. */
async function draftChunk(profile: Profile, rows: SkeletonWeek[], total: number, wantSummary: boolean) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;

  let from = 1;
  const phases = phasesFor(total).map((p) => {
    const range = `weeks ${from} to ${from + p.weeks - 1}`;
    from += p.weeks;
    return `${p.name}: ${range}`;
  });
  const request = {
    today: new Date().toISOString().slice(0, 10),
    runner: { ...profile, level: levelOf(profile), injury: hasInjury(profile) ? profile.injury : "none" },
    race: { distance: goalLabel(profile), distanceKm: raceKmOf(profile), raceDay: raceDayName(profile.raceDate), weeksInPlan: total, phases },
    goalGuide: goalGuide(profile),
    includeSummary: wantSummary,
    weeks: rows,
  };

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: JSON.stringify(request) },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      console.error("OpenRouter error", res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content ?? "";
    return parseAiChunk(JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)));
  } catch (e) {
    console.error("AI chunk failed", e);
    return null;
  }
}

/** Runs `fn` over `items`, at most `limit` at a time, keeping the order of the results. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const profile = validate(body);
  if (typeof profile === "string") return Response.json({ error: profile }, { status: 400 });

  // 1. Rules decide the shape of every week up to race week.
  const total = totalPlanWeeks(profile.raceDate);
  const skeleton = buildSkeleton(profile, total);

  // 2. The AI writes the sessions, a group of weeks at a time.
  const chunks: SkeletonWeek[][] = [];
  for (let i = 0; i < skeleton.length; i += CHUNK_WEEKS) chunks.push(skeleton.slice(i, i + CHUNK_WEEKS));
  const results = await mapLimit(chunks, CONCURRENCY, (rows, i) => draftChunk(profile, rows, total, i === 0));

  const written = new Map<number, AiWeek>();
  for (const r of results) r?.weeks.forEach((days, week) => written.set(week, days));

  // 3. Weeks the AI wrote are used if they fit the shape. Any others are written by rules.
  const { weeks, aiWeeks } = assemblePlan(skeleton, written, profile);
  // Race day goes on the plan on its real date, with the days around it shaped for it.
  addRaceDay(weeks, profile);

  // 4. The safety rules check every week, and have the last word.
  const checked = applyRules(weeks, profile);
  // Only notes about the free weeks are shown on the plan screen.
  const shown = checked.applied.filter((n) => Number(n.match(/^Week (\d+)/)?.[1] ?? 99) <= FREE_WEEKS);

  const weeksLeft = weeksToRace(profile.raceDate);
  const summary =
    results[0]?.summary ??
    `Here is a plan for your ${goalLabel(profile)} in ${weeksLeft} week${weeksLeft === 1 ? "" : "s"}, built for a ${levelOf(profile).toLowerCase()} runner${
      hasInjury(profile) ? " and kept lighter because of the injury you mentioned" : ""
    }. Training paces are set from your ${profile.goalPace} goal pace.`;

  const plan: Plan = {
    summary,
    weeks: checked.weeks,
    rulesApplied: shown,
    source: aiWeeks > 0 ? "claude" : "fallback",
    totalWeeks: checked.weeks.length,
    aiWeeks,
  };
  return Response.json(plan);
}

import {
  applyRules,
  fallbackWeeks,
  hasInjury,
  LIMITS,
  levelOf,
  parseWeeks,
  RACE_KM,
  weeksToRace,
  type Plan,
  type Profile,
} from "@/lib/plan";

const MODEL = process.env.OPENROUTER_MODEL ?? "google/gemini-3.8-flash";

const SYSTEM = `You are a running coach drafting the FIRST TWO WEEKS of a training plan. Reply with JSON only, no prose, in this shape:
{"summary": string, "weeks": [{"week": 1, "days": [{"day": "Mon"|"Tue"|"Wed"|"Thu"|"Fri"|"Sat"|"Sun", "type": "rest"|"walk-run"|"easy"|"long", "distanceKm": number, "effort": string, "note": string}]}]}

Rules for the plan:
- Exactly 2 weeks, all 7 days each (list rest days too, with distanceKm 0).
- Personalise it to the runner's level, race distance, weeks until the race, and injury. Use the targets in the "Guidance" block.
- Week 2 is at most 10% more total distance than week 1. Never put hard runs on back-to-back days. Put the long run on a weekend day.
- Beginners use "walk-run" sessions (say the interval in "note", e.g. "1 min jog, 2 min walk x 6"). Intermediate and advanced runners use "easy" runs and one "long" run.
- "effort" is how it should feel in plain words (e.g. "Easy, you can chat"). Do not write paces: the app adds them.
- "note" is one short, specific instruction for that session (warm-up, intervals, or what to focus on). Rest days may suggest gentle stretching or an easy walk.
- If the race is under 4 weeks away, keep volume steady and sharpen only lightly. If the runner reports an injury or past injury, cut volume further, avoid long runs, and add a note to stop and rest if the pain returns.
- "summary" is 2 or 3 plain sentences that mention the race distance and date, the weeks left, and why this plan fits this runner. Give no medical or treatment advice.`;

function validate(p: Partial<Profile>): Profile | string {
  if (!p.goalPace || !/^\d{1,2}:[0-5]\d$/.test(p.goalPace)) return "Goal pace must look like 6:30 (min per km).";
  if (!Object.keys(RACE_KM).includes(p.distance ?? "")) return "Pick a race distance.";
  if (!p.raceDate || Number.isNaN(Date.parse(p.raceDate))) return "Pick a race date.";
  if (weeksToRace(p.raceDate) < 1) return "Pick a race date in the future.";
  return {
    goalPace: p.goalPace,
    distance: p.distance as Profile["distance"],
    raceDate: p.raceDate,
    level: ["Beginner", "Intermediate", "Advanced"].includes(p.level ?? "") ? (p.level as Profile["level"]) : "",
    injury: String(p.injury ?? "").slice(0, 1000),
  };
}

const RUN_DAYS = { Beginner: 3, Intermediate: 4, Advanced: 5 } as const;

/** Targets that go to Claude. The rules in plan.ts enforce the same limits afterwards. */
function guidance(profile: Profile) {
  const level = levelOf(profile);
  const lim = LIMITS[level];
  const injured = hasInjury(profile);
  const cap = injured ? lim.week1KmInjury : lim.week1Km;
  return {
    level,
    raceDistance: profile.distance,
    raceDate: profile.raceDate,
    weeksToRace: weeksToRace(profile.raceDate),
    raceDayGoalPace: `${profile.goalPace} min/km`,
    injury: injured ? profile.injury : "none",
    runDaysPerWeek: injured ? Math.max(3, RUN_DAYS[level] - 1) : RUN_DAYS[level],
    week1TotalKm: `between ${Math.round(cap * 0.6)} and ${cap}`,
    longestSingleRunKm: Math.min(injured ? lim.singleKmInjury : lim.singleKm, RACE_KM[profile.distance]),
  };
}

async function draftWithClaude(profile: Profile) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
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
          {
            role: "user",
            content: `Today's date: ${new Date().toISOString().slice(0, 10)}\nRunner answers:\n${JSON.stringify(profile, null, 2)}\n\nGuidance (targets the plan must respect):\n${JSON.stringify(guidance(profile), null, 2)}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      console.error("OpenRouter error", res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content ?? "";
    const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    return parseWeeks(JSON.parse(json));
  } catch (e) {
    console.error("Claude draft failed", e);
    return null;
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const profile = validate(body);
  if (typeof profile === "string") return Response.json({ error: profile }, { status: 400 });

  const draft = await draftWithClaude(profile);
  const source: Plan["source"] = draft ? "claude" : "fallback";
  const weeksLeft = weeksToRace(profile.raceDate);
  const level = levelOf(profile);
  const base = draft ?? {
    summary: `Here is a starter plan for your ${profile.distance} in ${weeksLeft} week${weeksLeft === 1 ? "" : "s"}, built for a ${level.toLowerCase()} runner${
      hasInjury(profile) ? " and kept lighter because of the injury you mentioned" : ""
    }. Training paces are set from your ${profile.goalPace} goal pace.`,
    weeks: fallbackWeeks(level),
  };

  const { weeks, applied } = applyRules(base.weeks, profile);
  const plan: Plan = { summary: base.summary, weeks, rulesApplied: applied, source };
  return Response.json(plan);
}

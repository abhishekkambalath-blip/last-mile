import { expect, test } from "vitest";
import { generatePlan } from "@/lib/engine/generate";
import { validatePlan } from "@/lib/engine/validate";
import type { EngineInput } from "@/lib/engine/types";

const base: EngineInput = { raceDistance: "10K", raceDate: "2026-12-30", today: "2026-10-22", weeklyKm: 6, longestRunKm: 3, runsPerWeek: 2, daysPerWeek: 4 };

test("smoke", () => {
  const p = generatePlan(base);
  console.log(p.weeks.map((w) => `w${w.week_number} ${w.phase}${w.is_cutback ? "*" : ""} ${w.planned_km} ${w.days.map((d) => (d.type === "rest" ? "." : d.type[0] + (d.distance_km ?? ""))).join(" ")}`).join("\n"));
  console.log(validatePlan(p));
  expect(validatePlan(p)).toEqual([]);
});

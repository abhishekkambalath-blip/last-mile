import { expect, test } from "vitest";
import type { LevelId } from "@/lib/engine/config";
import { generatePlan } from "@/lib/engine/generate";
import { validatePlan } from "@/lib/engine/validate";
import { DISTANCES, inputFor, TODAYS } from "./helpers";

test("every rule holds for distance x level x weeks (1-40) x days per week (3-6)", () => {
  const bad: string[] = [];
  let count = 0;
  for (const d of DISTANCES)
    for (const level of ["L1", "L2", "L3"] as LevelId[])
      for (let weeks = 1; weeks <= 40; weeks++)
        for (let days = 3; days <= 6; days++)
          for (const today of TODAYS) {
            const input = inputFor(d, level, weeks, days, today);
            let plan;
            try {
              plan = generatePlan(input);
            } catch (e) {
              bad.push(`${d} ${level} ${weeks}w ${days}d ${today}: THREW ${(e as Error).message}`);
              continue;
            }
            count++;
            const errs = validatePlan(plan);
            if (errs.length) bad.push(`${d} ${level} ${weeks}w ${days}d ${today}: ${errs[0]}`);
          }
  console.log(`${count} plans, ${bad.length} bad`);
  const kinds = new Map<string, number>();
  for (const b of bad) {
    const k = b.replace(/^.*?: /, "").replace(/[0-9.]+/g, "#");
    kinds.set(k, (kinds.get(k) ?? 0) + 1);
  }
  console.log([...kinds.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15));
  console.log(bad.slice(0, 8));
  expect(bad).toEqual([]);
});

test("the same input gives the same plan", () => {
  const a = generatePlan(inputFor("21K", "L2", 14, 4));
  const b = generatePlan(inputFor("21K", "L2", 14, 4));
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
});

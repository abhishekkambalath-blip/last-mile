import type { DayType, Phase } from "./types";

type Ctx = { phase: Phase; level: string; raceLabel: string; cutback: boolean };

/**
 * A plain reason for a workout, written by rules. The LLM may replace it with friendlier words,
 * but it never changes any number: only this text is taken from it.
 */
export function templateReason(type: DayType, c: Ctx): string {
  const taper = c.phase === "taper" || c.phase === "race";
  switch (type) {
    case "rest":
      return c.cutback ? "A lighter week lets your body absorb the training." : "Rest is when your body gets stronger.";
    case "race":
      return `Race day. Start easy and settle into your own pace for the ${c.raceLabel}.`;
    case "long":
      return taper ? "A shorter long run keeps your legs ready while you freshen up." : c.phase === "base" ? "Builds your endurance gently." : "Your long run builds the stamina for race day.";
    case "tempo":
      return "Comfortably hard running teaches your body to hold a faster pace for longer.";
    case "intervals":
      return taper ? "A few short, sharp efforts keep your legs lively before the race." : "Short fast efforts build speed, with easy jogging to recover between them.";
    case "recovery":
      return "Very easy running helps your legs recover.";
    case "cross":
      return "Low-impact work builds fitness while your legs rest.";
    default:
      return c.cutback ? "An easy run in a lighter week." : taper ? "Easy and short, so you arrive at the start line fresh." : "An easy run builds your base. You should be able to talk in full sentences.";
  }
}

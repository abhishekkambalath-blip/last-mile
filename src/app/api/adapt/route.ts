import { adaptPlan } from "@/lib/adapt";
import type { Plan } from "@/lib/plan";
import type { Run } from "@/lib/runs";
import type { Saved } from "@/lib/store";
import { clientFor, userFrom } from "@/lib/supabase";

// Feature 3: reads the signed-in runner's plan and recent runs from the database and returns a plan
// whose next sessions are eased if the last run went badly. The browser then saves the returned plan.
export async function POST(req: Request) {
  const user = await userFrom(req);
  if (!user) return Response.json({ error: "Sign-in needed." }, { status: 401 });

  const db = clientFor(user.token);
  const [{ data: row }, { data: runRows }] = await Promise.all([
    db.from("athletes").select("saved").eq("user_id", user.id).maybeSingle(),
    db.from("runs").select("data").eq("user_id", user.id).order("ran_at", { ascending: false }).limit(10),
  ]);

  const saved = row?.saved as Saved | null | undefined;
  if (!saved?.plan) return Response.json({ error: "No plan to adapt yet." }, { status: 404 });

  const runs = (runRows ?? []).map((r) => r.data as Run);
  const result = adaptPlan(saved.plan as Plan, saved.profile, saved.createdAt, runs);
  return Response.json({ changed: result.changed, held: result.held ?? false, message: result.message, runId: result.runId, plan: result.changed ? result.plan : undefined });
}

import { paymentsLive } from "@/lib/payments";
import { adminClient, userFrom } from "@/lib/supabase";

// Records "free" (cancel) or, in demo mode only, "active". When real payments are on, "active" is only ever set
// by a verified payment (see /api/payments/verify and /api/payments/webhook), so asking for it here is refused.
export async function POST(req: Request) {
  const user = await userFrom(req);
  if (!user) return Response.json({ error: "Sign-in needed." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { status?: unknown } | null;
  if (body?.status !== "active" && body?.status !== "free") return Response.json({ error: "Status must be active or free." }, { status: 400 });

  if (body.status === "active" && paymentsLive()) return Response.json({ error: "Please pay to subscribe." }, { status: 402 });

  const admin = adminClient();
  if (!admin) return Response.json({ error: "The server has no SUPABASE_SERVICE_ROLE_KEY." }, { status: 503 });

  const { error } = await admin.from("subscriptions").upsert({ user_id: user.id, status: body.status, updated_at: new Date().toISOString() });
  if (error) return Response.json({ error: "Could not save the subscription." }, { status: 500 });
  return Response.json({ status: body.status });
}

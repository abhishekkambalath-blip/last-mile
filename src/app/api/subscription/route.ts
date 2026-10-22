import { adminClient, userFrom } from "@/lib/supabase";

// Prototype: this records "active" or "free" for the signed-in runner. No payment is taken.
// A real version would only set "active" after the payment provider confirms a payment (a webhook).
export async function POST(req: Request) {
  const user = await userFrom(req);
  if (!user) return Response.json({ error: "Sign-in needed." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { status?: unknown } | null;
  if (body?.status !== "active" && body?.status !== "free") return Response.json({ error: "Status must be active or free." }, { status: 400 });

  const admin = adminClient();
  if (!admin) return Response.json({ error: "The server has no SUPABASE_SERVICE_ROLE_KEY." }, { status: 503 });

  const { error } = await admin.from("subscriptions").upsert({ user_id: user.id, status: body.status, updated_at: new Date().toISOString() });
  if (error) return Response.json({ error: "Could not save the subscription." }, { status: 500 });
  return Response.json({ status: body.status });
}

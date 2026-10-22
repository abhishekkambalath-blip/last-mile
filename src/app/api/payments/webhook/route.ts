import { verifyWebhookSignature } from "@/lib/payments";
import { adminClient } from "@/lib/supabase";

// Razorpay calls this when a payment is captured, even if the runner closed the page before the app heard back.
// In the Razorpay dashboard: Webhooks > add <APP_URL>/api/payments/webhook, event payment.captured, and the same secret as RAZORPAY_WEBHOOK_SECRET.
export async function POST(req: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
  const db = adminClient();
  if (!secret || !db) return new Response("Not set up", { status: 503 });

  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature") ?? "", secret)) return new Response("Bad signature", { status: 400 });

  const event = JSON.parse(raw) as { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string; status?: string } } } };
  const pay = event.payload?.payment?.entity;
  if (event.event === "payment.captured" && pay?.order_id && pay.id) {
    // Only an order we created on the server can switch a subscription on.
    const { data: order } = await db.from("payments").select("order_id, user_id").eq("order_id", pay.order_id).maybeSingle();
    if (order) {
      await db.from("payments").update({ status: "paid", payment_id: pay.id, paid_at: new Date().toISOString() }).eq("order_id", order.order_id);
      await db.from("subscriptions").upsert({ user_id: order.user_id, status: "active", updated_at: new Date().toISOString() });
    }
  }
  return new Response("ok");
}

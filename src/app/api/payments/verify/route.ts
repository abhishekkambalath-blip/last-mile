import { razorpayKeys, verifyPaymentSignature } from "@/lib/payments";
import { adminClient, userFrom } from "@/lib/supabase";

// Step 2 of paying: the browser reports that Checkout succeeded. Trust nothing until the signature checks out.
export async function POST(req: Request) {
  const user = await userFrom(req);
  if (!user) return Response.json({ error: "Sign-in needed." }, { status: 401 });
  const keys = razorpayKeys();
  const db = adminClient();
  if (!keys || !db) return Response.json({ error: "Payments are not set up on this server." }, { status: 503 });

  const b = (await req.json().catch(() => null)) as { razorpay_order_id?: unknown; razorpay_payment_id?: unknown; razorpay_signature?: unknown } | null;
  if (typeof b?.razorpay_order_id !== "string" || typeof b.razorpay_payment_id !== "string" || typeof b.razorpay_signature !== "string") return Response.json({ error: "The payment details are incomplete." }, { status: 400 });

  // The order must be one this runner started on the server.
  const { data: order } = await db.from("payments").select("order_id, status").eq("order_id", b.razorpay_order_id).eq("user_id", user.id).maybeSingle();
  if (!order) return Response.json({ error: "Unknown order." }, { status: 404 });
  if (!verifyPaymentSignature(order.order_id, b.razorpay_payment_id, b.razorpay_signature, keys.secret)) return Response.json({ error: "We could not confirm this payment." }, { status: 400 });

  await db.from("payments").update({ status: "paid", payment_id: b.razorpay_payment_id, paid_at: new Date().toISOString() }).eq("order_id", order.order_id);
  await db.from("subscriptions").upsert({ user_id: user.id, status: "active", updated_at: new Date().toISOString() });
  return Response.json({ status: "active" });
}

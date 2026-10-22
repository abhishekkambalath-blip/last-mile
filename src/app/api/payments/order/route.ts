import { AMOUNT_PAISE, createOrder, razorpayKeys } from "@/lib/payments";
import { adminClient, userFrom } from "@/lib/supabase";

// Step 1 of paying: create the order on the server, with the price set here, and remember who it is for.
export async function POST(req: Request) {
  const user = await userFrom(req);
  if (!user) return Response.json({ error: "Sign-in needed." }, { status: 401 });
  const keys = razorpayKeys();
  if (!keys) return Response.json({ error: "Payments are not set up on this server.", code: "not-configured" }, { status: 503 });
  const db = adminClient();
  if (!db) return Response.json({ error: "The server has no SUPABASE_SERVICE_ROLE_KEY." }, { status: 503 });

  try {
    const order = await createOrder(user.id);
    const { error } = await db.from("payments").insert({ order_id: order.id, user_id: user.id, amount_paise: AMOUNT_PAISE, status: "created" });
    if (error) throw new Error("Could not save the order.");
    return Response.json({ orderId: order.id, keyId: keys.id, amount: AMOUNT_PAISE });
  } catch {
    return Response.json({ error: "We could not start the payment. Please try again." }, { status: 502 });
  }
}

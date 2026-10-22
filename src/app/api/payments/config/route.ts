import { paymentsLive } from "@/lib/payments";

// Tells the subscription page whether real payments are switched on (so it can say "demo" when they are not).
export async function GET() {
  return Response.json({ live: paymentsLive() });
}

import { createHmac, timingSafeEqual } from "node:crypto";
import { PRICE_INR } from "@/lib/plan";

// Server only. Payments go through Razorpay Checkout, which shows UPI and card (and handles the card details itself,
// so this app never sees a card number). The amount is always set here, never taken from the browser.
export const AMOUNT_PAISE = PRICE_INR * 100;

export const razorpayKeys = () => {
  const id = process.env.RAZORPAY_KEY_ID ?? "";
  const secret = process.env.RAZORPAY_KEY_SECRET ?? "";
  return id && secret ? { id, secret } : null;
};

export const paymentsLive = () => razorpayKeys() !== null;

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Razorpay's check that a payment is real: HMAC-SHA256 of "order_id|payment_id" with the key secret. */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string, secret: string) {
  return safeEqual(createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex"), signature);
}

/** Razorpay signs webhooks with the webhook secret over the raw request body. */
export function verifyWebhookSignature(rawBody: string, signature: string, secret: string) {
  return safeEqual(createHmac("sha256", secret).update(rawBody).digest("hex"), signature);
}

export async function createOrder(userId: string): Promise<{ id: string }> {
  const keys = razorpayKeys();
  if (!keys) throw new Error("not-configured");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${Buffer.from(`${keys.id}:${keys.secret}`).toString("base64")}` },
    body: JSON.stringify({ amount: AMOUNT_PAISE, currency: "INR", receipt: `lm_${Date.now()}`.slice(0, 40), notes: { user_id: userId, plan: "annual" } }),
  });
  if (!res.ok) throw new Error(`Razorpay answered ${res.status}`);
  return (await res.json()) as { id: string };
}

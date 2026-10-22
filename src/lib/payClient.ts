"use client";

import { setSubscribedLocal } from "@/lib/subscription";
import { accessToken, backendOn } from "@/lib/supabase";

export type PayMethod = "upi" | "card";
export type PayResult = "paid" | "demo" | "cancelled";

type Success = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type Razorpay = new (o: Record<string, unknown>) => { open: () => void; on: (e: string, f: (r: { error?: { description?: string } }) => void) => void };
declare global {
  interface Window {
    Razorpay?: Razorpay;
  }
}

function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("We could not load the payment window. Check your connection and try again."));
    document.head.appendChild(s);
  });
}

async function api(path: string, token: string, body?: unknown) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
  const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string; orderId?: string; keyId?: string; amount?: number };
  return { ok: res.ok, status: res.status, data };
}

/**
 * Pays for the yearly plan. Returns "demo" when real payments are not switched on (the caller then uses the demo
 * subscription), "paid" after the server has verified the payment, and "cancelled" if the runner closed the window.
 */
export async function pay(opts: { method: PayMethod; name: string; email: string; phone: string }): Promise<PayResult> {
  if (!backendOn) return "demo";
  const token = await accessToken();
  if (!token) throw new Error("We could not sign you in. Check your connection and try again.");

  const order = await api("/api/payments/order", token);
  if (order.data.code === "not-configured") return "demo";
  if (!order.ok || !order.data.orderId || !order.data.keyId) throw new Error(order.data.error ?? "We could not start the payment. Please try again.");

  await loadCheckout();
  const response = await new Promise<Success | null>((resolve, reject) => {
    const rz = new window.Razorpay!({
      key: order.data.keyId,
      order_id: order.data.orderId,
      amount: order.data.amount,
      currency: "INR",
      name: "Last Mile",
      description: "Annual plan",
      prefill: { name: opts.name, email: opts.email, contact: `+91${opts.phone}` },
      method: opts.method, // opens on UPI or card first (needs the email and mobile above)
      theme: { color: "#2ac4bd" },
      handler: (r: Success) => resolve(r),
      modal: { ondismiss: () => resolve(null) },
    });
    rz.on("payment.failed", (r) => reject(new Error(r.error?.description ?? "The payment did not go through. You have not been charged.")));
    rz.open();
  });
  if (!response) return "cancelled";

  const check = await api("/api/payments/verify", token, response);
  if (!check.ok) throw new Error(check.data.error ?? "We could not confirm your payment. If money was taken, it will be refunded or confirmed shortly.");
  setSubscribedLocal(true);
  return "paid";
}

import { createHmac } from "node:crypto";
import { afterEach, expect, test, vi } from "vitest";
import { AMOUNT_PAISE, createOrder, verifyPaymentSignature, verifyWebhookSignature } from "@/lib/payments";

const sign = (data: string, secret: string) => createHmac("sha256", secret).update(data).digest("hex");
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
});

test("the price is Rs 4,999, in paise", () => {
  expect(AMOUNT_PAISE).toBe(499900);
});

test("a payment is accepted only with the right signature of order_id|payment_id", () => {
  const good = sign("order_1|pay_1", "secret");
  expect(verifyPaymentSignature("order_1", "pay_1", good, "secret")).toBe(true);
  expect(verifyPaymentSignature("order_1", "pay_2", good, "secret")).toBe(false); // another payment
  expect(verifyPaymentSignature("order_2", "pay_1", good, "secret")).toBe(false); // another order
  expect(verifyPaymentSignature("order_1", "pay_1", good, "other-secret")).toBe(false);
  expect(verifyPaymentSignature("order_1", "pay_1", "short", "secret")).toBe(false);
});

test("a webhook is accepted only with the right signature of the raw body", () => {
  const body = '{"event":"payment.captured"}';
  expect(verifyWebhookSignature(body, sign(body, "whsec"), "whsec")).toBe(true);
  expect(verifyWebhookSignature(body + " ", sign(body, "whsec"), "whsec")).toBe(false);
});

test("the order is created with the server's price, whatever the browser says", async () => {
  process.env.RAZORPAY_KEY_ID = "rzp_test_x";
  process.env.RAZORPAY_KEY_SECRET = "s";
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "order_9" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  expect(await createOrder("user-1")).toEqual({ id: "order_9" });
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe("https://api.razorpay.com/v1/orders");
  const body = JSON.parse(init.body as string);
  expect(body).toMatchObject({ amount: 499900, currency: "INR", notes: { user_id: "user-1" } });
  expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from("rzp_test_x:s").toString("base64")}`);
});

test("without keys no order is made", async () => {
  await expect(createOrder("u")).rejects.toThrow("not-configured");
});

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Device tokens are encrypted before they are stored, so a leaked database row is not a working token.
function key(): Buffer {
  const hex = process.env.DEVICE_TOKEN_KEY ?? "";
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("DEVICE_TOKEN_KEY must be 64 hex characters (32 bytes).");
  return Buffer.from(hex, "hex");
}

export const cryptoReady = () => /^[0-9a-f]{64}$/i.test(process.env.DEVICE_TOKEN_KEY ?? "");

export function seal(text: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("base64")).join(".");
}

export function open(sealed: string): string {
  const [iv, tag, body] = sealed.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString("utf8");
}

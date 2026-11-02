/**
 * Verifies the payment provider's webhook signature: HMAC-SHA256 of the raw
 * body with the shared secret, hex, compared in constant time.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET = process.env.PAYMENTS_WEBHOOK_SECRET ?? "test-secret";

export function sign(rawBody, secret = SECRET) {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function verifyWebhook(rawBody, signature) {
  if (typeof signature !== "string" || signature.length !== 64) return false;
  const expected = Buffer.from(sign(rawBody), "hex");
  const given = Buffer.from(signature, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

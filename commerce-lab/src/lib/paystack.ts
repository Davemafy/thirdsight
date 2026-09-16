import { createHmac, timingSafeEqual } from "node:crypto";
import { emitAccessEvidence } from "@/lib/thirdsight";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

export async function initializePaystackTransaction(input: {
  email: string;
  amountKobo: number;
  reference: string;
  orderId: string;
}) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error("PAYSTACK_SECRET_KEY is not configured");
  if (!secret.startsWith("sk_test_")) {
    throw new Error("Commerce Lab refuses non-test Paystack keys");
  }

  const callbackBase = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";
  const payload = {
    email: input.email,
    amount: input.amountKobo,
    reference: input.reference,
    callback_url: `${callbackBase}/?payment=return`,
    metadata: { order_id: input.orderId },
  };

  await emitAccessEvidence({
    integrationId: "paystack",
    direction: "outbound",
    operation: "transaction.initialize",
    resource: "payment",
    fieldNames: ["email", "amount", "reference", "callback_url", "metadata.order_id"],
    businessObjectId: input.orderId,
  });

  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  await emitAccessEvidence({
    integrationId: "paystack",
    direction: "inbound",
    operation: "transaction.initialize.response",
    resource: "payment",
    fieldNames: ["status", "message", "data.authorization_url", "data.access_code", "data.reference"],
    businessObjectId: input.orderId,
    responseStatus: response.status,
  });

  const body = await response.json();
  if (!response.ok || !body.status || !body.data?.authorization_url) {
    throw new Error(body.message ?? "Paystack initialization failed");
  }

  return body.data as { authorization_url: string; access_code: string; reference: string };
}

export function verifyPaystackWebhook(rawBody: string, signature: string | null) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature || !secret.startsWith("sk_test_")) return false;

  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(signature, "utf8");
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

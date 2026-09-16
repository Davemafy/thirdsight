import { NextResponse } from "next/server";
import { verifyPaystackWebhook } from "@/lib/paystack";
import { emitAccessEvidence, emitBusinessEvidence } from "@/lib/thirdsight";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!verifyPaystackWebhook(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderId = event?.data?.metadata?.order_id;

  await emitAccessEvidence({
    integrationId: "paystack",
    direction: "inbound",
    operation: `webhook.${String(event?.event ?? "unknown")}`,
    resource: "payment",
    fieldNames: [
      "event",
      "data.reference",
      "data.status",
      "data.amount",
      "data.metadata.order_id",
    ],
    businessObjectId: typeof orderId === "string" ? orderId : undefined,
  });

  if (event?.event === "charge.success" && typeof orderId === "string") {
    await emitBusinessEvidence({
      type: "PAYMENT_COMPLETED",
      orderId,
      integrationId: "paystack",
    });
  }

  return NextResponse.json({ received: true });
}

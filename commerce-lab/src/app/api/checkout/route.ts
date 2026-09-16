import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { findProduct } from "@/lib/catalog";
import { initializePaystackTransaction } from "@/lib/paystack";
import { emitBusinessEvidence } from "@/lib/thirdsight";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const productId = typeof body.productId === "string" ? body.productId : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const quantity = Number(body.quantity);

    const product = findProduct(productId);
    if (!product) return NextResponse.json({ error: "Unknown product" }, { status: 400 });
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5) {
      return NextResponse.json({ error: "Quantity must be between 1 and 5" }, { status: 400 });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "A valid synthetic email is required" }, { status: 400 });
    }

    // The browser never controls price. Authoritative amount comes from the server catalog.
    const amountKobo = product.priceNaira * quantity * 100;
    const orderId = randomUUID();
    const reference = `TSLAB-${Date.now()}-${orderId.slice(0, 8)}`;

    await emitBusinessEvidence({ type: "ORDER_CREATED", orderId });

    const transaction = await initializePaystackTransaction({
      email,
      amountKobo,
      reference,
      orderId,
    });

    await emitBusinessEvidence({
      type: "PAYMENT_INITIALIZED",
      orderId,
      integrationId: "paystack",
    });

    return NextResponse.json({
      orderId,
      reference,
      authorizationUrl: transaction.authorization_url,
    });
  } catch (error) {
    console.error("Checkout failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed" },
      { status: 500 },
    );
  }
}

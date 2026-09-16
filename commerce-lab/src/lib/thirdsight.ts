type AccessEvidence = {
  integrationId: string;
  direction: "outbound" | "inbound";
  operation: string;
  resource: string;
  fieldNames: string[];
  businessObjectId?: string;
  responseStatus?: number;
};

type BusinessEvidence = {
  type: "ORDER_CREATED" | "PAYMENT_INITIALIZED" | "PAYMENT_COMPLETED" | "PAYMENT_FAILED";
  orderId: string;
  integrationId?: string;
  occurredAt?: string;
};

async function emit(path: string, body: unknown) {
  const baseUrl = process.env.THIRDSIGHT_INGEST_URL;
  if (!baseUrl) {
    console.info(`[ThirdSight lab] ${path}`, body);
    return;
  }

  try {
    await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.THIRDSIGHT_INGEST_TOKEN
          ? { authorization: `Bearer ${process.env.THIRDSIGHT_INGEST_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (error) {
    // Evidence delivery must never take the commerce path down.
    console.warn("ThirdSight evidence delivery failed", error);
  }
}

export function emitAccessEvidence(evidence: AccessEvidence) {
  return emit("/ingest/access", {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    source: "commerce-lab",
    ...evidence,
  });
}

export function emitBusinessEvidence(evidence: BusinessEvidence) {
  return emit("/ingest/business", {
    id: crypto.randomUUID(),
    occurredAt: evidence.occurredAt ?? new Date().toISOString(),
    source: "commerce-lab",
    ...evidence,
  });
}

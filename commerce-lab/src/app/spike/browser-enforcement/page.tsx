'use client';

import { useState } from 'react';

type ReceiverResult = {
  ok: boolean;
  phoneReceived: boolean;
  receivedFields: string[];
  receivedPayload: unknown;
};

export default function BrowserEnforcementSpikePage() {
  const [result, setResult] = useState<ReceiverResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function sendAttemptedAnalyticsEvent() {
    setSending(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/spike/analytics', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          event: 'product_viewed',
          product: {
            id: 'orbit-desk-lamp',
            category: 'home-office',
            price: 28500,
          },
          customer: {
            phone: '+2348000000000',
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Receiver returned HTTP ${response.status}`);
      }

      setResult((await response.json()) as ReceiverResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unknown request failure');
    } finally {
      setSending(false);
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: '48px auto', padding: 24, fontFamily: 'system-ui' }}>
      <h1>ThirdSight browser enforcement spike</h1>
      <p>
        This page intentionally sends synthetic <code>customer.phone</code> alongside
        approved product analytics fields. Attach the spike extension before sending.
      </p>

      <button type="button" onClick={sendAttemptedAnalyticsEvent} disabled={sending}>
        {sending ? 'Sending…' : 'Send attempted analytics event'}
      </button>

      {error ? <pre>{error}</pre> : null}

      {result ? (
        <section style={{ marginTop: 24 }}>
          <h2>Receiver proof</h2>
          <p>
            <strong>customer.phone reached receiver:</strong>{' '}
            {result.phoneReceived ? 'YES — enforcement failed' : 'NO — field was prevented'}
          </p>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </section>
      ) : null}
    </main>
  );
}

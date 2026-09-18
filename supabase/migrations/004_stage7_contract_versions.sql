-- Stage 7 Purpose Contract version transition fixture.
-- v4 remains historical; v5 becomes the active approved policy after the transition.

insert into public.purpose_contracts (
  contract_id, version, integration_id, environment, payload, valid_from, expires_at
)
values
(
  'analytics-product-view',
  '4',
  'analytics-partner',
  'production',
  '{
    "contractId":"analytics-product-view",
    "integrationId":"analytics-partner",
    "version":"4",
    "purpose":"Measure product interest",
    "resources":["analytics.events"],
    "fields":["product.id","product.category","product.price"],
    "operations":["send"],
    "validTriggers":["product.viewed"],
    "environment":"production",
    "validFrom":"2026-09-18T10:00:00.000Z",
    "reviewAt":"2026-09-18T11:00:00.000Z",
    "expiresAt":"2026-09-18T11:00:00.000Z",
    "owner":"commerce",
    "approvedBy":"privacy",
    "changeReason":"Pre-loyalty analytics scope"
  }'::jsonb,
  '2026-09-18T10:00:00.000Z',
  '2026-09-18T11:00:00.000Z'
),
(
  'analytics-product-view',
  '5',
  'analytics-partner',
  'production',
  '{
    "contractId":"analytics-product-view",
    "integrationId":"analytics-partner",
    "version":"5",
    "purpose":"Measure product interest with loyalty segmentation",
    "resources":["analytics.events"],
    "fields":["product.id","product.category","product.price","customer.loyalty_tier"],
    "operations":["send"],
    "validTriggers":["product.viewed"],
    "environment":"production",
    "validFrom":"2026-09-18T11:00:00.000Z",
    "reviewAt":"2026-10-18T11:00:00.000Z",
    "expiresAt":null,
    "owner":"commerce",
    "approvedBy":"privacy",
    "changeReason":"Approved loyalty segmentation field"
  }'::jsonb,
  '2026-09-18T11:00:00.000Z',
  null
)
on conflict (contract_id, version) do update
set payload=excluded.payload,
    valid_from=excluded.valid_from,
    expires_at=excluded.expires_at,
    environment=excluded.environment,
    integration_id=excluded.integration_id;

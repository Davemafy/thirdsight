-- CEDAR Commerce managed gateway. Additive only: frozen verifier sources and historical rows are unchanged.
create table if not exists public.gateway_dispatches(
  evidence_id text primary key,
  merchant_id text not null,
  integration_id text not null,
  purpose text not null,
  event_name text not null,
  idempotency_key text not null unique,
  occurred_at timestamptz not null,
  attempted_payload jsonb not null,
  forwarded_payload jsonb,
  blocked_fields jsonb not null default '[]'::jsonb,
  decision text not null,
  reason_code text not null,
  partner_delivered boolean not null default false,
  forbidden_field_delivered boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.gateway_replay_nonces(
  signature_hash text primary key,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists gateway_dispatches_integration_time_idx on public.gateway_dispatches(integration_id,created_at desc);
alter table public.gateway_dispatches enable row level security;
alter table public.gateway_replay_nonces enable row level security;

insert into public.integration_registry(integration_id,display_name,lifecycle_status,owner) values
 ('analytics-partner','Cedar Analytics Partner','ACTIVE','CEDAR Commerce'),
 ('advertising-partner','Cedar Advertising Partner','ACTIVE','CEDAR Commerce'),
 ('crm-partner','Cedar CRM Partner','ACTIVE','CEDAR Commerce')
on conflict(integration_id) do update set display_name=excluded.display_name,lifecycle_status=excluded.lifecycle_status,owner=excluded.owner;

insert into public.purpose_contracts(contract_id,version,integration_id,environment,payload,valid_from,expires_at) values
('cedar-purchase-measurement','1.0.0','analytics-partner','synthetic-demo',jsonb_build_object(
 'contractId','cedar-purchase-measurement','integrationId','analytics-partner','version','1.0.0','purpose','purchase-measurement',
 'resources',jsonb_build_array('orders','products'),'fields',jsonb_build_array('order.id','order.value','product.id','product.category'),
 'operations',jsonb_build_array('deliver'),'validTriggers',jsonb_build_array('checkout.completed'),'environment','synthetic-demo',
 'validFrom','2026-09-01T00:00:00.000Z','reviewAt','2027-01-15T00:00:00.000Z','expiresAt',null,
 'owner','CEDAR Commerce','approvedBy','ThirdSight Demo Authority','changeReason','Initial scoped purchase measurement contract'
),'2026-09-01T00:00:00Z',null),
('cedar-conversion-attribution','1.0.0','advertising-partner','synthetic-demo',jsonb_build_object(
 'contractId','cedar-conversion-attribution','integrationId','advertising-partner','version','1.0.0','purpose','conversion-attribution',
 'resources',jsonb_build_array('orders','campaigns'),'fields',jsonb_build_array('order.id','order.value','product.id','campaign.id'),
 'operations',jsonb_build_array('deliver'),'validTriggers',jsonb_build_array('checkout.completed'),'environment','synthetic-demo',
 'validFrom','2026-09-01T00:00:00.000Z','reviewAt','2027-01-15T00:00:00.000Z','expiresAt',null,
 'owner','CEDAR Commerce','approvedBy','ThirdSight Demo Authority','changeReason','Initial scoped conversion contract'
),'2026-09-01T00:00:00Z',null),
('cedar-crm-service','1.0.0','crm-partner','synthetic-demo',jsonb_build_object(
 'contractId','cedar-crm-service','integrationId','crm-partner','version','1.0.0','purpose','customer-relationship',
 'resources',jsonb_build_array('orders','customers'),'fields',jsonb_build_array('order.id','customer.reference'),
 'operations',jsonb_build_array('deliver'),'validTriggers',jsonb_build_array('checkout.completed'),'environment','synthetic-demo',
 'validFrom','2026-08-01T00:00:00.000Z','reviewAt','2026-09-01T00:00:00.000Z','expiresAt','2026-09-15T00:00:00.000Z',
 'owner','CEDAR Commerce','approvedBy','ThirdSight Demo Authority','changeReason','Expired CRM lab approval'
),'2026-08-01T00:00:00Z','2026-09-15T00:00:00Z')
on conflict(contract_id,version) do update set payload=excluded.payload,valid_from=excluded.valid_from,expires_at=excluded.expires_at;

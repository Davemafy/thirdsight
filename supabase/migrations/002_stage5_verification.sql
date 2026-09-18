-- ThirdSight Stage 5: independent verification sources + durable outcomes
create table if not exists public.purpose_contracts (
 contract_id text not null, version text not null, integration_id text not null references public.integration_registry(integration_id),
 environment text not null, payload jsonb not null, valid_from timestamptz not null, expires_at timestamptz,
 primary key(contract_id,version), check(expires_at is null or expires_at>valid_from)
);
create table if not exists public.capability_grants (
 capability_id text primary key, integration_id text not null references public.integration_registry(integration_id),
 environment text not null, payload jsonb not null, valid_from timestamptz not null, valid_to timestamptz,
 check(valid_to is null or valid_to>valid_from)
);
create table if not exists public.business_events (
 event_id text primary key, integration_id text references public.integration_registry(integration_id),
 occurred_at timestamptz not null, payload jsonb not null
);
alter table public.browser_evidence_history add column if not exists findings jsonb not null default '[]'::jsonb;
alter table public.browser_evidence_history add column if not exists enforcement jsonb;
alter table public.browser_evidence_history add column if not exists outcome text check(outcome in ('PREVENTED','DETECTED'));
alter table public.purpose_contracts enable row level security;
alter table public.capability_grants enable row level security;
alter table public.business_events enable row level security;

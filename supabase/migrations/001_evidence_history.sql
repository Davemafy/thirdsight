-- ThirdSight evidence persistence v0
-- Apply in the Supabase SQL editor for the prototype project.

create table if not exists public.integration_registry (
  integration_id text primary key,
  display_name text not null,
  lifecycle_status text not null check (lifecycle_status in ('ACTIVE', 'RETIRED')),
  owner text,
  created_at timestamptz not null default now()
);

create table if not exists public.integration_origin_bindings (
  binding_id uuid primary key default gen_random_uuid(),
  integration_id text not null references public.integration_registry(integration_id),
  origin text not null,
  environment text not null,
  confidence text not null check (confidence in ('AUTHORITATIVE', 'DECLARED')),
  source_id text not null,
  valid_from timestamptz not null,
  valid_to timestamptz,
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_to > valid_from)
);

create index if not exists integration_origin_bindings_lookup_idx
  on public.integration_origin_bindings (origin, environment, valid_from, valid_to);

create table if not exists public.browser_evidence_history (
  record_id text primary key,
  observation_id text not null unique,
  accepted_at timestamptz not null,
  observed_at timestamptz not null,
  destination_origin text,
  integration_id text references public.integration_registry(integration_id),
  integration_resolution text not null check (
    integration_resolution in ('RESOLVED', 'UNRESOLVED', 'AMBIGUOUS')
  ),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists browser_evidence_history_observed_at_idx
  on public.browser_evidence_history (observed_at desc);

create index if not exists browser_evidence_history_integration_idx
  on public.browser_evidence_history (integration_id, observed_at desc);

alter table public.integration_registry enable row level security;
alter table public.integration_origin_bindings enable row level security;
alter table public.browser_evidence_history enable row level security;

-- Intentionally create no public/anon policies. The server-side ThirdSight API uses
-- a Supabase service-role key. That key must never be shipped in the browser extension.

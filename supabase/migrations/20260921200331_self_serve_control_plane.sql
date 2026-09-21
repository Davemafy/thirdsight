-- Recording-ready self-service control plane for merchant-scoped managed requests.
-- Additive only. Existing verifier sources and historical evidence remain unchanged.

create table if not exists public.merchant_workspaces (
  merchant_id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'SUSPENDED')),
  created_at timestamptz not null default now()
);

create table if not exists public.merchant_api_keys (
  key_id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchant_workspaces(merchant_id),
  key_hash text not null unique check (char_length(key_hash) = 64),
  key_prefix text not null,
  key_last_four text not null check (char_length(key_last_four) = 4),
  label text not null default 'Default managed gateway key',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists merchant_api_keys_merchant_idx
  on public.merchant_api_keys (merchant_id, created_at desc);

create table if not exists public.merchant_integrations (
  merchant_integration_id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchant_workspaces(merchant_id),
  preset_id text not null check (preset_id in ('cedar-analytics', 'cedar-delivery')),
  integration_id text not null references public.integration_registry(integration_id),
  environment text not null,
  lifecycle_status text not null default 'ACTIVE' check (lifecycle_status in ('ACTIVE', 'RETIRED')),
  purpose_contract jsonb not null,
  installed_at timestamptz not null default now(),
  unique (merchant_id, integration_id)
);

create index if not exists merchant_integrations_lookup_idx
  on public.merchant_integrations (merchant_id, integration_id, environment);

alter table public.browser_evidence_history
  add column if not exists merchant_id uuid references public.merchant_workspaces(merchant_id);

alter table public.business_events
  add column if not exists merchant_id uuid references public.merchant_workspaces(merchant_id);

create index if not exists browser_evidence_history_merchant_time_idx
  on public.browser_evidence_history (merchant_id, observed_at desc);

create index if not exists business_events_merchant_time_idx
  on public.business_events (merchant_id, occurred_at desc);

alter table public.merchant_workspaces enable row level security;
alter table public.merchant_api_keys enable row level security;
alter table public.merchant_integrations enable row level security;

-- These tables are server-side control-plane state. Browser roles have no direct access.
revoke all on public.merchant_workspaces from anon, authenticated;
revoke all on public.merchant_api_keys from anon, authenticated;
revoke all on public.merchant_integrations from anon, authenticated;

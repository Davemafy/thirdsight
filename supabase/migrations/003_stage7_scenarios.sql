-- Stage 7 controlled Commerce Lab scenario support.
create table if not exists public.integration_credentials (
  credential_id text primary key,
  integration_id text not null references public.integration_registry(integration_id),
  environment text not null,
  status text not null check (status in ('ACTIVE','REVOKED')),
  valid_from timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.integration_credentials enable row level security;

insert into public.integration_registry(integration_id,display_name,lifecycle_status,owner)
values ('legacy-crm','Legacy CRM','RETIRED','Commerce Ops')
on conflict(integration_id) do update
set display_name=excluded.display_name,lifecycle_status=excluded.lifecycle_status,owner=excluded.owner;

insert into public.integration_credentials(credential_id,integration_id,environment,status,valid_from,revoked_at)
values ('legacy-crm-db','legacy-crm','production','ACTIVE','2026-09-18T00:00:00Z',null)
on conflict(credential_id) do update
set integration_id=excluded.integration_id,environment=excluded.environment,status='ACTIVE',valid_from=excluded.valid_from,revoked_at=null;

-- Stage 8 held-out AI evaluation runs.
create table if not exists public.ai_evaluation_runs (
  run_id text primary key,
  analyst_version text not null,
  model text not null,
  case_count integer not null,
  ai_off jsonb not null,
  ai_on jsonb not null,
  improvement jsonb not null,
  surface_prominently boolean not null,
  surface_reason text not null,
  created_at timestamptz not null default now()
);

alter table public.ai_evaluation_runs enable row level security;

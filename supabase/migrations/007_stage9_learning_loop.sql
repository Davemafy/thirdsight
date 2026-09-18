-- Stage 9 verified learning loop.
-- Human review stores only structured, PII-minimized features and an advisory label.
create table if not exists public.learning_feedback (
  feedback_id text primary key,
  record_id text not null unique,
  label text not null check (label in ('REVIEW','OBSERVE','ABSTAIN')),
  features jsonb not null,
  source text not null default 'HUMAN_VERIFIED' check (source = 'HUMAN_VERIFIED'),
  created_at timestamptz not null default now()
);

create table if not exists public.learning_model_runs (
  run_id text primary key,
  model_version text not null,
  algorithm text not null,
  training_examples integer not null,
  human_verified_examples integer not null,
  benchmark_id text not null,
  baseline_metrics jsonb not null,
  candidate_metrics jsonb not null,
  model jsonb not null,
  promoted boolean not null,
  promotion_reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists learning_feedback_created_at_idx
  on public.learning_feedback (created_at desc);
create index if not exists learning_model_runs_created_at_idx
  on public.learning_model_runs (created_at desc);
create index if not exists learning_model_runs_promoted_idx
  on public.learning_model_runs (promoted, created_at desc);

alter table public.learning_feedback enable row level security;
alter table public.learning_model_runs enable row level security;

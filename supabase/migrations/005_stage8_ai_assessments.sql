-- Stage 8 AI analyst persistence.
-- AI assessments are intentionally separate from factual ThirdSight evidence.
create table if not exists public.ai_assessments (
  assessment_id text primary key,
  record_id text not null references public.browser_evidence_history(record_id) on delete cascade,
  analyst_version text not null,
  model text not null,
  evaluation_case_id text,
  input_snapshot jsonb not null,
  output jsonb not null,
  accepted boolean not null,
  authority_violation boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists ai_assessments_record_id_created_at_idx
  on public.ai_assessments(record_id, created_at desc);

alter table public.ai_assessments enable row level security;

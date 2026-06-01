-- Esboço feedback loop 30 dias (Analista v13)

create table if not exists public.diagnosis_metric_snapshots (
  diagnosis_id uuid primary key references public.diagnoses (id) on delete cascade,
  captured_at timestamptz not null default now(),
  spend_30d numeric,
  revenue_30d numeric,
  roas_sales numeric,
  score int,
  facts_digest jsonb
);

create table if not exists public.diagnosis_followup_jobs (
  id uuid primary key default gen_random_uuid(),
  diagnosis_id uuid not null references public.diagnoses (id) on delete cascade,
  due_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'done', 'skipped')),
  outcome_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists diagnosis_followup_jobs_due_status_idx
  on public.diagnosis_followup_jobs (status, due_at);

alter table public.diagnosis_metric_snapshots enable row level security;
alter table public.diagnosis_followup_jobs enable row level security;

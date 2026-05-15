-- Diagnóstico Meta (produto à parte na mesma base): tabelas dedicadas, acesso via Edge Functions + service role.
create extension if not exists pgcrypto with schema extensions;

create table public.diagnoses (
  id uuid primary key default gen_random_uuid(),
  status text not null
    check (status in (
      'awaiting_payment',
      'awaiting_connection',
      'processing',
      'completed',
      'failed'
    )),
  secret_slug text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  mp_payment_id text unique,
  mp_preference_id text,
  amount_cents integer not null default 3700,
  currency text not null default 'BRL',
  meta_ad_account_id text,
  meta_user_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  failed_reason text,
  viewed_at timestamptz,
  cta_clicked_at timestamptz,
  report_version integer not null default 1
);

create index diagnoses_status_created_idx
  on public.diagnoses (status, created_at);

create table public.diagnosis_secrets (
  diagnosis_id uuid primary key references public.diagnoses (id) on delete cascade,
  access_token text,
  token_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.diagnosis_reports (
  diagnosis_id uuid primary key references public.diagnoses (id) on delete cascade,
  facts_json jsonb,
  analysis_json jsonb,
  prompt_version text,
  updated_at timestamptz not null default now()
);

alter table public.diagnoses enable row level security;
alter table public.diagnosis_secrets enable row level security;
alter table public.diagnosis_reports enable row level security;

create policy diagnoses_block_all on public.diagnoses
  for all using (false) with check (false);

create policy diagnosis_secrets_block_all on public.diagnosis_secrets
  for all using (false) with check (false);

create policy diagnosis_reports_block_all on public.diagnosis_reports
  for all using (false) with check (false);

comment on table public.diagnoses is 'Funil diagnóstico Meta (produto); leituras/escritas via Edge com service role.';
comment on column public.diagnoses.secret_slug is 'Segredo na URL com id; não usar só UUID.';

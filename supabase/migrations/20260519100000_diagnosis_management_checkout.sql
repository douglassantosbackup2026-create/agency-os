-- Segundo checkout (gestão Meta/Google) ligado ao mesmo diagnóstico; Mercado Pago external_reference: mgmt:{uuid}.
alter table public.diagnoses
  add column if not exists management_status text not null default 'none'
    check (management_status in ('none', 'awaiting_payment', 'paid')),
  add column if not exists management_amount_cents integer not null default 199700,
  add column if not exists management_mp_preference_id text,
  add column if not exists management_mp_payment_id text unique,
  add column if not exists management_business_name text,
  add column if not exists management_website text,
  add column if not exists management_instagram text,
  add column if not exists management_paid_at timestamptz;

comment on column public.diagnoses.management_status is 'Upsell gestão: none | awaiting_payment | paid';
comment on column public.diagnoses.management_mp_payment_id is 'Pagamento MP da gestão; distinto do Diagnóstico R$37 (mp_payment_id).';

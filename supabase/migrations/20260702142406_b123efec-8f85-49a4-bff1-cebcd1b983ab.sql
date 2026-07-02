ALTER TABLE public.ecommerce_leads
  ADD COLUMN IF NOT EXISTS mp_preference_id TEXT,
  ADD COLUMN IF NOT EXISTS mp_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS amount_cents INTEGER,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS ecommerce_leads_status_idx ON public.ecommerce_leads (status);
CREATE INDEX IF NOT EXISTS ecommerce_leads_mp_payment_id_idx ON public.ecommerce_leads (mp_payment_id) WHERE mp_payment_id IS NOT NULL;
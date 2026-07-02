-- Checkout transparente funil /gestao-trafego (PIX inline + preapproval cartão).

ALTER TABLE public.ecommerce_leads
  ADD COLUMN IF NOT EXISTS payer_cpf TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS pix_qr_code TEXT,
  ADD COLUMN IF NOT EXISTS pix_qr_code_base64 TEXT,
  ADD COLUMN IF NOT EXISTS pix_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mp_preapproval_id TEXT;

CREATE INDEX IF NOT EXISTS ecommerce_leads_mp_preapproval_id_idx
  ON public.ecommerce_leads (mp_preapproval_id)
  WHERE mp_preapproval_id IS NOT NULL;

ALTER TABLE public.management_subscriptions
  ALTER COLUMN diagnosis_id DROP NOT NULL;

ALTER TABLE public.management_subscriptions
  ADD COLUMN IF NOT EXISTS ecommerce_lead_id UUID REFERENCES public.ecommerce_leads (id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS management_subscriptions_ecommerce_lead_id_idx
  ON public.management_subscriptions (ecommerce_lead_id)
  WHERE ecommerce_lead_id IS NOT NULL;

ALTER TABLE public.management_subscriptions
  DROP CONSTRAINT IF EXISTS management_subscriptions_owner_check;

ALTER TABLE public.management_subscriptions
  ADD CONSTRAINT management_subscriptions_owner_check
  CHECK (
    (diagnosis_id IS NOT NULL AND ecommerce_lead_id IS NULL)
    OR (diagnosis_id IS NULL AND ecommerce_lead_id IS NOT NULL)
  );

ALTER TABLE public.management_subscription_charges
  ALTER COLUMN diagnosis_id DROP NOT NULL;

ALTER TABLE public.management_subscription_charges
  ADD COLUMN IF NOT EXISTS ecommerce_lead_id UUID REFERENCES public.ecommerce_leads (id) ON DELETE CASCADE;

ALTER TABLE public.management_subscription_charges
  DROP CONSTRAINT IF EXISTS management_subscription_charges_owner_check;

ALTER TABLE public.management_subscription_charges
  ADD CONSTRAINT management_subscription_charges_owner_check
  CHECK (
    (diagnosis_id IS NOT NULL AND ecommerce_lead_id IS NULL)
    OR (diagnosis_id IS NULL AND ecommerce_lead_id IS NOT NULL)
  );

COMMENT ON COLUMN public.ecommerce_leads.payer_cpf IS 'CPF do pagador (checkout transparente MP).';
COMMENT ON COLUMN public.ecommerce_leads.payment_method IS 'pix ou card no checkout transparente.';
COMMENT ON COLUMN public.ecommerce_leads.mp_preapproval_id IS 'Preapproval MP para assinatura recorrente (cartão).';

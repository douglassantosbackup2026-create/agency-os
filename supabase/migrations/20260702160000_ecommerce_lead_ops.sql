-- Funil /gestao-trafego: access_slug, ops pós-pagamento e link com clients.

ALTER TABLE public.ecommerce_leads
  ADD COLUMN IF NOT EXISTS access_slug TEXT,
  ADD COLUMN IF NOT EXISTS ops_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provisioned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provisioned_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients (id) ON DELETE SET NULL;

UPDATE public.ecommerce_leads
SET access_slug = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
WHERE access_slug IS NULL OR btrim(access_slug) = '';

ALTER TABLE public.ecommerce_leads
  ALTER COLUMN access_slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ecommerce_leads_access_slug_idx
  ON public.ecommerce_leads (access_slug);

CREATE UNIQUE INDEX IF NOT EXISTS ecommerce_leads_client_id_unique_idx
  ON public.ecommerce_leads (client_id)
  WHERE client_id IS NOT NULL;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS ecommerce_lead_id UUID REFERENCES public.ecommerce_leads (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS clients_ecommerce_lead_id_unique_idx
  ON public.clients (ecommerce_lead_id)
  WHERE ecommerce_lead_id IS NOT NULL;

COMMENT ON COLUMN public.ecommerce_leads.access_slug IS 'Segredo na URL (?lead=&s=) para checkout e poll de pagamento.';
COMMENT ON COLUMN public.ecommerce_leads.ops_notified_at IS 'Idempotência do hook pós-pagamento (alerta + action center).';
COMMENT ON COLUMN public.ecommerce_leads.client_id IS 'Cliente provisionado a partir deste lead.';
COMMENT ON COLUMN public.clients.ecommerce_lead_id IS 'Origem funil gestão-trafego (lead direto, sem diagnóstico).';

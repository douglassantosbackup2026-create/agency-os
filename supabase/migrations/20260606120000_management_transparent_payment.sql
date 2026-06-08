-- Checkout transparente gestão: colunas PIX separadas do diagnóstico R$37.

ALTER TABLE public.diagnoses
  ADD COLUMN IF NOT EXISTS management_pix_qr_code text,
  ADD COLUMN IF NOT EXISTS management_pix_qr_code_base64 text,
  ADD COLUMN IF NOT EXISTS management_pix_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS management_payment_method text;

COMMENT ON COLUMN public.diagnoses.management_pix_qr_code IS 'PIX gestão (transparente); distinto de pix_qr_code do diagnóstico.';
COMMENT ON COLUMN public.diagnoses.management_payment_method IS 'card | pix — upsell gestão';
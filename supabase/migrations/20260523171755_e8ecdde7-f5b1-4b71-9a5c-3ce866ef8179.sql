ALTER TABLE public.diagnoses
  ADD COLUMN IF NOT EXISTS payer_name text,
  ADD COLUMN IF NOT EXISTS payer_email text,
  ADD COLUMN IF NOT EXISTS payer_cpf text,
  ADD COLUMN IF NOT EXISTS payer_phone text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS pix_qr_code text,
  ADD COLUMN IF NOT EXISTS pix_qr_code_base64 text,
  ADD COLUMN IF NOT EXISTS pix_expires_at timestamptz;
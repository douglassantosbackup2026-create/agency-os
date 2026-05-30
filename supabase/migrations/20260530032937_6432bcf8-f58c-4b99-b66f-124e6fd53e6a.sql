ALTER TABLE public.diagnoses
  ADD COLUMN IF NOT EXISTS pending_ad_accounts jsonb;
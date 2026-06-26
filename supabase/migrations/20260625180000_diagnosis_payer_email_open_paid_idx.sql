-- Índice para lookup de diagnóstico pago em aberto por e-mail do pagador.
CREATE INDEX IF NOT EXISTS diagnoses_payer_email_open_paid_idx
  ON public.diagnoses (lower(payer_email), created_at DESC)
  WHERE mp_payment_id IS NOT NULL AND payer_email IS NOT NULL;

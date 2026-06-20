
ALTER TABLE public.retentio_ops_config
  ADD COLUMN IF NOT EXISTS diagnosis_funnel_agency_id uuid;

ALTER TABLE public.diagnoses
  ADD COLUMN IF NOT EXISTS management_whatsapp_clicked_at timestamptz;

CREATE TABLE IF NOT EXISTS public.diagnosis_handoff_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_id uuid NOT NULL REFERENCES public.diagnoses(id) ON DELETE CASCADE,
  kind text NOT NULL,
  ip text,
  user_agent text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS diagnosis_handoff_events_diagnosis_id_idx
  ON public.diagnosis_handoff_events (diagnosis_id, created_at DESC);

GRANT ALL ON public.diagnosis_handoff_events TO service_role;

ALTER TABLE public.diagnosis_handoff_events ENABLE ROW LEVEL SECURITY;
-- Sem policies: só service_role escreve/lê (via edge functions).

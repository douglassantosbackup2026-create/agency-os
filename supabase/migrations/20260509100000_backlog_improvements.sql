-- Briefing por agência, proveniência de métricas, revisão WhatsApp e auditoria de merge.

CREATE TABLE IF NOT EXISTS public.agency_briefings (
  agency_id UUID PRIMARY KEY REFERENCES public.agencies(id) ON DELETE CASCADE,
  buckets JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agency_briefings_computed
  ON public.agency_briefings(computed_at DESC);

ALTER TABLE public.agency_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY agency_briefings_select ON public.agency_briefings
  FOR SELECT USING (public.is_member_of(agency_id));

CREATE POLICY agency_briefings_insert ON public.agency_briefings
  FOR INSERT WITH CHECK (public.is_member_of(agency_id));

CREATE POLICY agency_briefings_update ON public.agency_briefings
  FOR UPDATE USING (public.is_member_of(agency_id));

CREATE POLICY agency_briefings_delete ON public.agency_briefings
  FOR DELETE USING (public.is_owner_or_admin(agency_id));

ALTER TABLE public.metrics_daily
  ADD COLUMN IF NOT EXISTS data_source TEXT NOT NULL DEFAULT 'api_sync',
  ADD COLUMN IF NOT EXISTS data_reliability TEXT NOT NULL DEFAULT 'high';

ALTER TABLE public.whatsapp_logs
  ADD COLUMN IF NOT EXISTS pending_review BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS merge_variables JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_whatsapp_pending_review
  ON public.whatsapp_logs(agency_id, pending_review, created_at DESC);

-- Uso estimado de IA (eventos por chamada) para painel admin.

CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  day DATE NOT NULL DEFAULT (timezone('utc', now()))::date,
  function_name TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(14, 8) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_agency_day
  ON public.ai_usage_events(agency_id, day DESC);

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_usage_events_select ON public.ai_usage_events
  FOR SELECT USING (public.is_owner_or_admin(agency_id));
CREATE POLICY ai_usage_events_insert ON public.ai_usage_events
  FOR INSERT WITH CHECK (public.is_owner_or_admin(agency_id));
